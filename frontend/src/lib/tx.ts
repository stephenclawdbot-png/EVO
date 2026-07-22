import { Transaction, ComputeBudgetProgram, PublicKey, Connection, TransactionInstruction, VersionedTransaction } from '@solana/web3.js';

type SignFn = (tx: Transaction) => Promise<Transaction | VersionedTransaction>;

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

export async function sendAndConfirmTx(
  connection: Connection,
  signTransaction: SignFn | undefined,
  feePayer: PublicKey,
  ix: TransactionInstruction,
): Promise<string> {
  if (!signTransaction) throw new Error('Transaction signing failed');

  const tx = new Transaction()
    .add(ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 150_000 }))
    .add(ix);
  tx.feePayer = feePayer;
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
  tx.recentBlockhash = blockhash;

  const signed = await signTransaction(tx);
  const sig = await connection.sendRawTransaction(
    ('serialize' in signed ? signed.serialize() : (signed as any).serialize()),
    { maxRetries: 5 },
  );

  try {
    const conf = await connection.confirmTransaction(
      { signature: sig, blockhash, lastValidBlockHeight },
      'confirmed',
    );
    if (conf.value.err) throw new Error(`Transaction failed on-chain: ${JSON.stringify(conf.value.err)}`);
    return sig;
  } catch (err: any) {
    const msg = err?.message || '';
    if (msg.includes('block height exceeded') || msg.includes('TransactionExpired') || msg.includes('TX_EXPIRED')) {
      // Expired ≠ failed — the tx may have landed after the blockhash window.
      const st = await connection.getSignatureStatus(sig, { searchTransactionHistory: true });
      if (st.value && !st.value.err) return sig; // it LANDED
      throw new Error('TX_EXPIRED');
    }
    throw err;
  }
}

/**
 * Re-fetch until the result differs from `prev` (RPC serves stale state
 * right after a tx confirms). Polls up to maxRetries times with gapMs between
 * each attempt. Hard timeout at timeoutMs — returns whatever the last fetch
 * produced with timedOut=true so the caller can show a "taking longer" UI.
 */
export async function refetchUntilChanged<T>(
  fetcher: () => Promise<T>,
  prev: T,
  isSame: (a: T, b: T) => boolean,
  opts: { maxRetries?: number; gapMs?: number; timeoutMs?: number } = {},
): Promise<{ data: T; changed: boolean; timedOut: boolean }> {
  const { maxRetries = 5, gapMs = 1500, timeoutMs = 12000 } = opts;
  const start = Date.now();
  let last: T = prev;
  for (let i = 0; i < maxRetries; i++) {
    if (Date.now() - start > timeoutMs) {
      try { last = await fetcher(); } catch { /* use prev */ }
      return { data: last, changed: !isSame(last, prev), timedOut: true };
    }
    await sleep(gapMs);
    try { last = await fetcher(); } catch { continue; }
    if (!isSame(last, prev)) return { data: last, changed: true, timedOut: false };
  }
  return { data: last, changed: !isSame(last, prev), timedOut: false };
}