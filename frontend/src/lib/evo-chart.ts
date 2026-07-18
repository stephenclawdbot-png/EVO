'use client';

import { Connection, PublicKey, VersionedTransactionResponse, SystemProgram } from '@solana/web3.js';
import { getCollectionPDA, PROGRAM_ID } from './evo-program';

// Instruction discriminators (must match evo-program.ts DISC)
const DISC_FORGE  = Buffer.from([63, 5, 211, 28, 237, 195, 110, 144]);
const DISC_BUY    = Buffer.from([102, 6, 61, 18, 1, 218, 235, 234]);
const DISC_FEED   = Buffer.from([46, 213, 237, 176, 190, 113, 182, 94]);
const DISC_SHATT  = Buffer.from([158, 63, 226, 126, 18, 89, 130, 128]);
const DISC_LIST   = Buffer.from([54, 174, 193, 67, 17, 41, 132, 38]);
const DISC_DELIST = Buffer.from([55, 136, 205, 107, 107, 173, 4, 31]);

// System Program Transfer instruction discriminator (u32 LE = 2)
const SYS_TRANSFER = Buffer.from([2, 0, 0, 0]);

export type TradeKind = 'forge' | 'buy' | 'feed' | 'shatter' | 'list' | 'delist';

export interface TradeEvent {
  signature: string;
  kind: TradeKind;
  timestamp: number;   // unix seconds (blockTime)
  priceSol: number;     // trade price in SOL (0 for non-priced events)
  amountSol: number;    // SOL moved/locked for feed/shatter
  evoId: number | null; // resolved when possible
}

function readU64LE(buf: Buffer, off: number): number {
  return Number(buf.readBigUInt64LE(off));
}

/** Resolve an EVO id from its PDA by matching the tx account list against known evo PDAs is expensive;
 *  we instead parse the evoId directly from forge/shatter instruction data when present. */
function resolveEvoId(data: Buffer, kind: TradeKind): number | null {
  try {
    if (kind === 'forge' && data.length >= 12) return data.readUInt32LE(8);
    if (kind === 'shatter' && data.length >= 12) return data.readUInt32LE(8);
  } catch { /* ignore */ }
  return null;
}

/** Sum all System Program Transfer lamports sourced from `from` in a tx (incl. inner ix). */
function totalOutflow(tx: VersionedTransactionResponse, from: PublicKey): number {
  let sum = 0;
  const checkIx = (prog: PublicKey, data: Buffer, keys: { pubkey: PublicKey; isSigner: boolean }[]) => {
    if (!prog.equals(SystemProgram.programId)) return;
    if (!data.subarray(0, 4).equals(SYS_TRANSFER)) return;
    if (keys.length < 2) return;
    if (keys[0].pubkey.equals(from)) sum += readU64LE(Buffer.from(data), 4);
  };

  const msg = tx.transaction.message as any;
  const acctKeys = msg.staticAccountKeys ?? [];
  const allIx = (msg.compiledInstructions ?? msg.instructions ?? []) as any[];
  // outer instructions
  for (const ix of allIx) {
    const progId = (ix as any).programIdIndex != null
      ? acctKeys[(ix as any).programIdIndex]
      : new PublicKey((ix as any).programId);
    const data = Buffer.from((ix as any).data as any, 'base64');
    const keys = ((ix as any).accounts ?? (ix as any).accountKeyIndexes ?? []).map((i: number) =>
      acctKeys[i] ?? acctKeys[i]
    ).map((k: PublicKey) => ({ pubkey: k, isSigner: false }));
    checkIx(progId, data, keys);
  }
  // inner instructions
  const inner = (tx.meta as any)?.innerInstructions ?? [];
  for (const group of inner) {
    for (const ix of group.instructions) {
      const progId = ix.programId ? new PublicKey(ix.programId) : acctKeys[ix.programIdIndex];
      const data = Buffer.from(ix.data as any, 'base64');
      const keys = (ix.accounts ?? []).map((i: number) => acctKeys[i]).map((k: PublicKey) => ({ pubkey: k, isSigner: false }));
      checkIx(progId, data, keys);
    }
  }
  return sum;
}

function ixMatches(data: Buffer, disc: Buffer): boolean {
  return data.length >= 8 && data.subarray(0, 8).equals(disc);
}

/**
 * Fetch the recent trade history for a collection by scanning on-chain tx logs.
 * Returns events newest-first. Price (SOL) is derived from buyer outflow for `buy`,
 * mint price for `forge`, feed amount for `feed`, and locked recovery for `shatter`.
 */
export async function readCollectionTradeHistory(
  conn: Connection,
  collectionName: string,
  mintPriceLamports: number,
  limit = 80,
): Promise<TradeEvent[]> {
  const [collectionPda] = getCollectionPDA(collectionName);
  const events: TradeEvent[] = [];

  let sigs: { signature: string; blockTime?: number | null }[] = [];
  try {
    sigs = await conn.getSignaturesForAddress(collectionPda, { limit });
  } catch {
    return [];
  }

  for (const s of sigs) {
    if (!s.signature) continue;
    let tx: VersionedTransactionResponse | null = null;
    try {
      tx = await conn.getTransaction(s.signature, {
        maxSupportedTransactionVersion: 0,
        commitment: 'confirmed',
      });
    } catch { continue; }
    if (!tx || !tx.meta || tx.meta.err) continue;
    const blockTime = s.blockTime ?? tx.blockTime ?? Math.floor(Date.now() / 1000);

    const msg = tx.transaction.message as any;
    const acctKeys = msg.staticAccountKeys ?? msg.accountKeys ?? [];
    const allIx = (msg.compiledInstructions ?? msg.instructions ?? []) as any[];

    for (const ix of allIx) {
      const progIdx = ix.programIdIndex ?? ix.programIdIndex;
      const progId = progIdx != null ? acctKeys[progIdx] : new PublicKey(ix.programId);
      if (!progId) continue;
      // We only care about our own program's instructions.
      if (!progId.equals(PROGRAM_ID)) continue;
      const data = Buffer.from(ix.data as any, 'base64');
      const accIdxs: number[] = ix.accounts ?? ix.accountKeyIndexes ?? [];
      const keys = accIdxs.map((i: number) => acctKeys[i]).filter(Boolean) as PublicKey[];

      if (ixMatches(data, DISC_FORGE)) {
        events.push({
          signature: s.signature, kind: 'forge', timestamp: blockTime,
          priceSol: mintPriceLamports / 1e9, amountSol: mintPriceLamports / 1e9,
          evoId: resolveEvoId(data, 'forge'),
        });
      } else if (ixMatches(data, DISC_BUY)) {
        // buyer is the last signer account in createBuyIx keys
        const buyer = keys[keys.length - 1];
        const outflow = buyer ? totalOutflow(tx, buyer) : 0;
        events.push({
          signature: s.signature, kind: 'buy', timestamp: blockTime,
          priceSol: outflow / 1e9, amountSol: outflow / 1e9,
          evoId: null,
        });
      } else if (ixMatches(data, DISC_FEED)) {
        const lamports = data.length >= 16 ? readU64LE(data, 8) : 0;
        events.push({
          signature: s.signature, kind: 'feed', timestamp: blockTime,
          priceSol: 0, amountSol: lamports / 1e9, evoId: null,
        });
      } else if (ixMatches(data, DISC_SHATT)) {
        events.push({
          signature: s.signature, kind: 'shatter', timestamp: blockTime,
          priceSol: 0, amountSol: 0, evoId: resolveEvoId(data, 'shatter'),
        });
      } else if (ixMatches(data, DISC_LIST)) {
        const lamports = data.length >= 16 ? readU64LE(data, 8) : 0;
        events.push({
          signature: s.signature, kind: 'list', timestamp: blockTime,
          priceSol: lamports / 1e9, amountSol: 0, evoId: null,
        });
      } else if (ixMatches(data, DISC_DELIST)) {
        events.push({
          signature: s.signature, kind: 'delist', timestamp: blockTime,
          priceSol: 0, amountSol: 0, evoId: null,
        });
      }
    }
  }

  // newest first
  events.sort((a, b) => b.timestamp - a.timestamp);
  return events;
}