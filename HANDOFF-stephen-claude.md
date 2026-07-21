# HANDOFF → branch `stephen-claude`

**Keyword:** `EVO-STEPHEN-CLAUDE-HARDENING-2026-07-21`
**Branch:** `stephen-claude`
**Commits:** `f328c42` (tier1/3 + docs + SECURITY) → `f4961ad` (EvoDetail crash-proofing) → `1f58649` (handoff v1) → **latest: frontend seamlessness sweep**
**Author on commits:** `Stephen in Claude`
**From:** Stephen (in Claude / Anthropic) → **To:** the local agent (Stephen in Copilot)

---

## 0. READ THIS FIRST — verification status

**Nothing in this branch was built or run.** The authoring environment has **no
`anchor`, no `solana` CLI, and no `node_modules`** (and the frontend is a modified
Next.js). Every change is **correct-by-inspection only**.

**Your job before any deploy:**
```
anchor build && anchor test                          # Rust (only comments changed)
cd frontend && npm i && npx tsc --noEmit && npm run build && npx vitest
```
The program is **LIVE ON MAINNET WITH REAL USER SOL** — see `SECURITY.md`.
Frontend vitest note: `evo-visuals` tests may assert the OLD (buggy) behavior of
`fetchVisualManifest` returning the raw manifest — if tests fail there, update the
assertions to expect the NORMALIZED manifest (that's the fix, not a regression).

---

## 1. Live mainnet facts (verified on-chain, not from docs)

| Item | Value |
|---|---|
| Program (live, upgradeable) | `Aw4mAC5oUfQCP65a8a6mTwkrL2CoUMsBa45KvWPY3CN2` |
| Upgrade authority = treasury authority | `G3aWJsdtrRT12HnC9R2BVoyErQbtGXseaM9c2xt1MJUJ` |
| Treasury (fee sink) | `8McmuNBz7NHToGG2pBcJEuUpcof5T8HJ7DPG2A1xfkQc` |
| Live collection | `Solana Evo Kitties` (cap 900) — 6 minted · 4 holders · 0.30 SOL locked |

---

## 2. FRONTEND SEAMLESSNESS SWEEP (latest commit) — the important one

Context: the user is frustrated that the terminal "always gets broken" — this pass
systematically fixed every provable bug in the mint → view → trade → detail flow.
Verified first that the frontend ix builders are **complete and correctly ordered**
vs the deployed program (buy has `listing` + `incinerator_fallback` + `max_price`;
shatter has both too) — so trading failures were NOT account-layout.

### Real bugs found & fixed

| # | File | Bug | User symptom it explains |
|---|---|---|---|
| 1 | `lib/evo-visuals.ts` | `fetchVisualManifest` **returned the RAW manifest, not the normalized one** (`return data` instead of `return normalized`). Bulk/small manifests don't have v1's `stages`/`fallback_image`/`lifecycle` shape, so stage names, the stage gallery, and fallbacks silently broke for bulk collections (= the Kitties). Now returns/caches the normalized manifest, with bulk `items` (+ traits) carried through on a new typed `items?` field. | "Kittens not updating", stage strip never showing, wrong stage names |
| 2 | `lib/evo-visuals.ts` | `resolveActiveImage` scanned the **global** bulk cache across ALL collections — EVO #N exists in every collection, so collection B's EVO could resolve to collection A's artwork. Now uses `manifest.items` only. | wrong/mixed images once a 2nd collection exists |
| 3 | `components/EvoDetail.tsx` `handleShatter` | RPC read ran **outside** try/catch → any RPC hiccup = unhandled rejection, button silently dead. AND `Math.floor` applied to a SOL-denominated value → confirm dialog said "recover **0.0000** SOL" for any sub-1-SOL floor (Kitties lock 0.05). Both fixed. | "buttons not working", scary 0.0000 dialog |
| 4 | `components/EvoDetail.tsx` `handleBuy` | `maxPrice = BigInt(evo.listPriceLamports ?? 0)` — if listing merge failed, max_price=0 makes the on-chain `price <= max_price` check fail **every** buy. Now falls back to a live `readListing` read; errors clearly if no listing. | "cannot trade" |
| 5 | ALL tx senders (`EvoDetail`, `forge`, `admin`, `create`) | Deprecated signature-only `confirmTransaction(sig, 'confirmed')` polls with a fixed timeout and can report failure while the tx actually lands. Switched to blockhash-form confirm (`{signature, blockhash, lastValidBlockHeight}`) + explicit `conf.value.err` check. | "not saving", "state changes not persisting" |
| 6 | `lib/evo-data.ts` + call sites | NEW `invalidateCollectionsCache()` — clears the home page's `evo_collections*` localStorage cache. Called after every successful tx (EvoDetail sendTx, forge success, admin sendTx). | "locked SOL stale after minting", stale home stats |
| 7 | `app/admin/page.tsx` | After reveal/evolve/set-stage/update-metadata, nothing busted the 60s manifest cache or home cache → old art kept rendering. Admin `sendTx` now calls `invalidateManifestCache()` + `invalidateCollectionsCache()` on success. | "mystery placeholder not changing" |
| 8 | `lib/evo-data.ts` (commit `f4961ad`) | Fracture-line timestamps were on-chain **seconds** stored in a **ms** field → Activity tab "56y ago". `* 1000`. | wrong ages |

### From commit `f4961ad` (still relevant)
`EvoDetail` is wrapped in per-section `<Guard>` error boundaries (left column /
right column). Any remaining render crash now degrades to an inline message and
logs `EvoDetail section "detail-left|right" crashed: <error + component stack>`
— **run the app, click an EVO, and the console names the exact crashing line.**
That's the trap for the one still-unreproduced crash.

### Explicitly NOT touched (couldn't verify or out of code's reach)
- **Phantom warnings** — that's Blowfish/Phantom flagging an unverified program +
  raw PDA txs. Code can't fix it: submit the domain + program for review
  (Phantom's dapp allowlisting), publish `solana-verify` build, stable domain.
- `BulkArtworkUploader` / `ArtworkDropzone` / Irys upload paths, `evo-chart.ts`
  heuristics, portfolio page internals — not audited this pass.
- The on-chain program — zero behavior changes anywhere in this branch.

---

## 3. Commit `f328c42` recap (tier-1/3 + docs)

- **forge page**: forge id now `total_minted` (not `current_supply`) — after any
  shatter the old code collides with a live PDA and minting breaks permanently.
- **Rust**: comment-only docs of `evo_id`/`mint_index` convention, `last_transition_at`
  non-reset on trade, and the real scope of "provably fair reveal".
- **`@evo/sdk`**: `createBuyIx`/`createShatterIx` are **broken vs deployed program**
  (missing `listing` + `incinerator_fallback`; buy missing `max_price`). Flagged
  inline with the correct layouts; regenerate from IDL.
- **Docs**: stale devnet id `7UST…` → live id; VRF is a stub; self-trade MEDIUM is
  fixed; README/START_HERE reflect live-mainnet + unaudited. New `SECURITY.md`.

---

## 4. Follow-ups (CI-gated, need your toolchain)

1. **Run the build + tests** (§0). Fix any type nits my inspection missed.
2. **Reproduce the detail-page crash** with the Guard logs; fix root cause.
3. **On-chain `evo_id` guard**: `require!(evo_id == collection.total_minted)` in
   `forge.rs` + new error + update ~24 tests that forge non-sequentially. Only
   deploy after green CI. (Frontend already forges at `total_minted`.)
4. **SDK regen from IDL**, then typecheck.
5. **Tier-0 trust (SECURITY.md)**: independent multisig signers, exit-safe pause
   (never blocks shatter/transfer/delist/feed), `solana-verify` hash, Trident
   fuzzing + invariant tests (SECURITY.md §4).
6. **Phantom**: submit for Blowfish/Phantom review once domain + verified build exist.

---

*If this doc drifts from the branch, the branch wins: `git log --stat origin/stephen-claude`.*
