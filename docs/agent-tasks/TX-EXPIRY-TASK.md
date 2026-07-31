# TASK: tx expired "block height exceeded" (holder report) — priority fees + landed-check

> Holder tx expired without landing: no priority fee = dropped under mainnet
> congestion. Three fixes, ONE commit, frontend only. Apply to EVERY tx sender
> (EvoDetail sendTx, forge page, admin sendTx, create page).

## 1. Add a priority fee to every transaction
```ts
import { ComputeBudgetProgram } from '@solana/web3.js';
const tx = new Transaction()
  .add(ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 150_000 }))
  .add(ix);
```
(~0.00003 SOL per tx — negligible; makes validators pick it up under load.)

## 2. Send with retries
`connection.sendRawTransaction(signed.serialize(), { maxRetries: 5 })`

## 3. On expiry, CHECK before declaring failure (expired ≠ failed)
Wrap the confirm; on error message containing "block height exceeded":
```ts
const st = await connection.getSignatureStatus(sig, { searchTransactionHistory: true });
if (st.value && !st.value.err) { /* it LANDED — treat as success, continue */ }
else throw new Error('TX_EXPIRED');
```

## 4. humanizeError entries (lib/errors.ts)
- 'block height exceeded' / 'TX_EXPIRED' →
  "Solana was congested and your transaction expired before landing. No SOL
   left your wallet — it's safe to try again."
- 'TransactionExpired' → same.

**Done when:** all four senders add the compute-budget ix, expiry triggers the
landed-check, and users see the friendly retry message instead of a raw
signature dump.
