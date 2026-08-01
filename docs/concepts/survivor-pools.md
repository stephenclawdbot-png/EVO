# Survivor Pools — CANDIDATE concept (not approved, banked for evaluation)

> Status: creator is NOT sold on this yet. Do not build. This spec exists so
> the mechanic is fully thought through whenever it gets evaluated.
> Pitch: "The collection where quitters pay the diamond hands."

## Mechanic (one new fee destination, nothing else)
- Trading untouched (only normal royalty). The fee triggers ONLY on
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
  (fee / live_supply added on each shatter; fixed-point 1e12).
- Per EVO: `reward_debt` snapshot. Pending = acc_per_survivor − reward_debt.
- Pending folds into `locked` lazily on next touch (feed / evolve / buy /
  shatter), then debt resets. O(1) per tx.
- Decision needed: pro-rata per-EVO (equal, game-like — RECOMMENDED) vs
  locked-weighted (whale-favoring).
- Solana: needs program upgrade (new enum variant, 2 collection fields,
  1 EVO field — account migration plan required). ERC-EVO: native day one.

## UI hooks (the psychology IS the product)
- Collection bar: `SHATTERED 34 · POOL PAID 1.2 SOL to survivors`
- Per-EVO: `+0.0021 pending from 3 capitulations — claims on next feed`
- Ticker: `#41 shattered → 0.0004 to every survivor`
- Rare evolutions on top = jackpot layer (gacha where the stake stays yours).

## Open questions (answer before any build)
1. Per-EVO equal vs locked-weighted distribution?
2. Last holder standing gets the whole remaining pool? (fun: yes)
3. Ponzinomics optics — marketing must lead with "real reserves, open exit".
4. Solana upgrade vs ERC-EVO-first debut?
