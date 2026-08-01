# Survivor Pools — CANDIDATE concept (not approved, banked for evaluation)

> Status: creator is NOT sold on this yet. Do not build. This spec exists so
> the mechanic is fully thought through whenever it gets evaluated.
> Pitch: "The collection where quitters pay the diamond hands."

## Mechanic (one new fee destination, nothing else)
- Trading is untouched (only normal royalty). The fee triggers ONLY on
  **shatter** — the existing immutable `shatter_fee_bps`.
- New routing option alongside Treasury/Creator/Burn/Split: **Holders** —
  the quitter's fee is redistributed into the floors of all remaining EVOs.
- Result: supply only shrinks (slots never reused — already guaranteed),
  survivors' floors only grow. Zero-sum, emissions-free, real reserves.

## Why it is honest (the anti-tax-token)
- Fee % fixed immutably at creation, visible before mint.
- Exit ALWAYS works: leave any time at floor − posted fee. No trap, no pause,
  no authority. The toll is public and goes to peers, not the dev.
- No promised yield — only actual exit fees over actual reserves.

## Implementation — rewards-index pattern (O(1), both chains)
Cannot pay N holders in one tx. Standard lazy accumulator (Synthetix-style):
- Per collection: `pool_lamports` + cumulative `acc_per_survivor` index
  (fee_amount / live_supply added on each shatter; fixed-point 1e12).
- Per EVO: `reward_debt` snapshot. Pending = acc_per_survivor − reward_debt.
- Claim folds pending into `locked` lazily on next touch (feed / evolve /
  buy / shatter), then resets debt. O(1) per tx.
- Decision needed: pro-rata per-EVO (equal, game-like — RECOMMENDED) vs
  by locked amount (whale-favoring).
- Solana: needs program upgrade (new enum variant + 2 fields on collection,
  1 on EVO — account migration plan required). ERC-EVO: native from day one.

## UI hooks (the psychology IS the product)
- Collection bar: `SHATTERED 34 · POOL PAID 1.2 SOL to survivors`.
- Per-EVO: `+0.0021 pending from 3 capitulations — claims on next feed`.
- Feed ticker: `#41 shattered → 0.0004 to every survivor`.
- Rare evolutions on top = jackpot layer (gacha where the stake stays yours).

## Open questions (answer before any build)
1. Per-EVO equal vs locked-weighted distribution?
2. Does the last holder standing get the whole remaining pool? (fun: yes)
3. Ponzinomics optics — marketing must lead with "real reserves, open exit".
4. Solana upgrade vs ERC-EVO-first debut?
