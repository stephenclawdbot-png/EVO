# HANDOFF → branch `stephen-claude`

**Keyword:** `EVO-STEPHEN-CLAUDE-HARDENING-2026-07-21`
**Branch:** `stephen-claude` · **Commits:** `f328c42` (tier1/3 + docs + SECURITY) → `f4961ad` (EvoDetail crash-proofing)
**Author on commits:** `Stephen in Claude`
**From:** Stephen (in Claude / Anthropic) → **To:** the local agent (Stephen in Copilot)

---

## 0. READ THIS FIRST — verification status

**Nothing in this branch was built or run.** The environment it was authored in
had **no `anchor`, no `solana` CLI, and no `node_modules`** (and the frontend is a
modified Next.js). So every change is **correct-by-inspection only**.

**Your job before any deploy:**
- `anchor build && anchor test` (localnet) for the Rust.
- `cd frontend && npm i && npx tsc --noEmit && npm run build && npx vitest` for the frontend.
- The program is **LIVE ON MAINNET WITH REAL USER SOL** — treat any redeploy as
  high-stakes. See `SECURITY.md`.

---

## 1. Live mainnet facts (verified on-chain this session, not from docs)

| Item | Value |
|---|---|
| Program (live, upgradeable) | `Aw4mAC5oUfQCP65a8a6mTwkrL2CoUMsBa45KvWPY3CN2` |
| Upgrade authority = treasury authority | `G3aWJsdtrRT12HnC9R2BVoyErQbtGXseaM9c2xt1MJUJ` |
| Treasury (fee sink) | `8McmuNBz7NHToGG2pBcJEuUpcof5T8HJ7DPG2A1xfkQc` |
| Creation fee | 0.0459 SOL |
| Live collection | `Solana Evo Kitties` (cap 900) |
| Minted / holders / locked | **6 minted · 4 holders · 0.30 SOL locked · 0 listings** |

The docs previously showed a **stale devnet program id** (`7UST…`) as if current —
that has been corrected across user/integration docs (historical devnet-proof and
`build-verification.txt` left intact on purpose).

---

## 2. What changed

### Commit `f328c42` — tier-1 + tier-3 + docs
- **`frontend/.../c/[name]/forge/page.tsx`** — *behavior fix.* Forge now uses
  `total_minted` (not `current_supply`) as the new EVO's id. Latent bug: after any
  shatter, `current_supply < total_minted`, so a `current_supply`-derived id
  collides with a still-live EVO PDA and **minting breaks**. Display id shown as
  `nextId` (= total_minted); supply counter still uses `current_supply`.
- **`programs/evo/src/instructions/{forge,buy,reveal_collection}.rs`** — comments
  only, **no behavior change**: documents the `evo_id` vs `mint_index` convention,
  the intentional non-reset of `last_transition_at` on trades, and the on-chain vs
  off-chain boundary of the "provably fair reveal" claim.
- **`packages/evo-sdk/`** — flagged `createBuyIx` / `createShatterIx` as **broken
  vs the deployed program** (buy missing `listing` + `incinerator_fallback`
  accounts AND the `max_price` arg; shatter missing optional `listing` +
  `incinerator_fallback`). Documented the correct account layout inline + README
  drift warning. **Not rewritten** (no way to typecheck here, SDK not in CI).
- **Docs** — program-id fix, VRF reframed as a stub (not active), self-trade MEDIUM
  marked fixed (guard is in `buy.rs`), README/START_HERE set to live-mainnet +
  not-audited. New **`SECURITY.md`** (honest posture + $0 hardening plan +
  invariants to test + disclosure). Credit "Stephen (in Claude)" added.

### Commit `f4961ad` — EvoDetail crash-proofing
- **`frontend/src/components/EvoDetail.tsx`** — added a per-section `<Guard>` error
  boundary around the left column (art + tabs) and right column (sidebar). A render
  throw now degrades to an inline message **and logs the section name + React
  component stack** instead of white-screening. Pre-return derived data
  (`premium`, `holderHistory`, `uniqueHolders`, `sparkPoints`) made defensive
  (normalize `fractureLines`, try/catch with safe defaults) because that code runs
  in EvoDetail's own render where a child boundary can't help.
- **`frontend/src/lib/evo-data.ts`** — fracture-line `timestamp` was on-chain
  **seconds** mapped into a **millisecond** field → Activity tab showed "56y ago".
  Now `* 1000`.

---

## 3. The still-open frontend crash (needs YOUR run)

The "EVO detail page blank on click" root cause was **not** found by static reading:
data reaching `EvoDetail` is well-formed (both mount paths use `evoAccountToData`,
which normalizes everything and filters nulls), and there's no unconditional render
throw with valid data. It's a value-edge or browser-only condition.

**The Guard added in `f4961ad` is the trap.** Run the app, click an EVO, and the
console will print:
```
EvoDetail section "detail-left" crashed: <the real error> <component stack>
```
That names the exact line. Capture it and fix the root cause there (or send it back).

Other open items from the user's list to keep in mind: images not loading in browser
(proxy works server-side), collection page `fetchData` silently failing in browser,
Phantom tx warnings.

---

## 4. What is NOT done — CI-gated / needs the toolchain

1. **On-chain `evo_id` guard.** The clean fix is `require!(evo_id == collection.total_minted)`
   in `forge.rs` + a new error, but it **breaks ~24 tests** that forge non-sequential
   ids, and it couldn't be verified here. Do it as its own commit: add the guard,
   update the tests to forge sequentially, get CI green, THEN consider deploy. The
   frontend already forges at `total_minted`, so it's compatible.
2. **SDK regen from IDL.** Fix `createBuyIx` / `createShatterIx` properly (see the
   inline spec in `packages/evo-sdk/src/instructions.ts`) or regenerate from the
   Anchor IDL, then typecheck.
3. **Tier-0 trust work (SECURITY.md):** multisig with **independent** signers +
   published signer set; an **exit-safe pause flag** (can freeze forge/list/buy but
   NEVER shatter/transfer/delist/feed); `solana-verify` reproducible-build hash;
   Trident fuzzing + the invariant tests listed in SECURITY.md §4.

---

## 5. Deploy guidance
- **Frontend** (both frontend commits): safe to ship **after** a clean `tsc`/build.
- **On-chain comments only** (`f328c42` .rs changes): no behavior change; safe, but
  still rebuild + test.
- **Do NOT** deploy the on-chain `evo_id` guard until it exists and CI is green (§4).

---

*Authored by Stephen (in Claude). If any statement here drifts from the branch, the
branch wins — re-read the diffs: `git log --stat f4961ad~2..f4961ad`.*
