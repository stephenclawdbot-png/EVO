# MELD / EVO Platform Audit — 2026-07-21

**By:** Stephen (in Claude) · branch `stephen-claude`
**Method:** on-chain reads (mainnet), live-deployment requests, code inspection,
and visual verification of the actual artwork. Facts below are verified, not assumed.

---

## 1. THE STAGE-ORDER MIX-UP — CONFIRMED, WITH FIX READY

Downloaded and visually inspected item #0's two stage images from the live manifest:

| On-chain state | What it should be | What it actually is |
|---|---|---|
| **state 0** (every EVO shows this now; evolution START) | Kitten | **ADULT ginger cat** ❌ |
| **state 1** (evolution TARGET) | Evolved/adult cat | **KITTEN** ❌ |

**The collection evolves backwards — cats de-age.** Cause: the bulk uploader has
one drop-zone per state labeled generically "State 1 / State 2" with no hint that
State 1 = what holders see first. The evolved art was dropped in zone 1, kittens
in zone 2. All 900 items are inverted consistently.

**Why it's cleanly fixable right now:** nobody has evolved yet. Evolution requires
feed ≥ 0.05 SOL AND locked ≥ 0.15 SOL AND 1h hold (verified on-chain) — all
minted EVOs are still at state 0. Swap the manifest before anyone evolves.

**Fix (script ready and TESTED — it ran successfully in this session):**
1. `node scripts/fix-stage-order.mjs` → writes `fixed-manifest.json`
   (900/900 items swapped, stateNames → ["Kitten", "Evolved Cat"], cover → kitten).
2. Upload `fixed-manifest.json` to Irys with the creator wallet.
3. `update_metadata` with the new URI **preserving the social query params**
   (`?website=meldterminal.io&twitter=...`) — the frontend parses socials from them.
4. Done. The admin tx now busts the manifest cache automatically (fixed on branch).

⚠️ `artwork_manifest_hash` is immutable after `create_collection` and this
collection was created with a zero hash — authenticity will stay "no hash
committed" forever for Kitties. Future collections: commit the hash at creation.

---

## 2. LIVE ON-CHAIN FACTS (Solana Evo Kitties, verified this session)

| | |
|---|---|
| Minted | **7 / 900** (grew from 6 during this session — minting works!) |
| Economics | mint 0.1 SOL → creator · lock 0.05 SOL → floor |
| Shatter fee | **0 bps** → holders recover the full 0.05 SOL floor |
| Royalty | 4.5% → creator |
| Lifecycle | RevealAndEvolve, 2 states, **already revealed** |
| Evolution gate | feed ≥ 0.05 SOL + locked ≥ 0.15 SOL + 1h hold (AND) |
| Commit-reveal | not used (reveal was authority-only switch) |
| Manifest hash | not committed (zero) |

Note: transfer costs a flat protocol fee of 0.009 SOL (protocol-wide constant).

---

## 3. AS A CONSUMER (browse → mint → view)

**Fixed on `stephen-claude` (deploy to get these):**
- "Image not found" everywhere — root cause was `public/placeholder.png` NOT
  EXISTING + an error latch that permanently hid the real image after the first
  404. Images and manifest were healthy all along (verified against the live site).
- Home "LOCKED 0.00 SOL" — double-division (0.30 SOL → 3e-10). Cache bumped v3→v4.
- Stage gallery/names never showed for bulk collections — `fetchVisualManifest`
  returned the raw manifest instead of the normalized one.
- Stale stats after minting — caches now invalidated after every successful tx.
- Detail page white-screen — per-section error boundaries; any remaining crash
  names itself in the console (`EvoDetail section "..." crashed: ...`).
- Activity tab "56y ago" ages — seconds/ms fix.
- Forge id collision after future shatters — forge now uses `total_minted`.

**Still open:**
- Stage order (Section 1) — data fix, not code.
- Phantom transaction warning — operational: publish `solana-verify` build, keep
  one stable domain, submit to Phantom/Blowfish review. Code can't fix it.
- Detail-crash root cause — trapped by the Guard, awaiting one console log.
- Kitties authenticity will always read "no hash committed" (see Section 1).

---

## 4. AS A CREATOR (create → upload → admin)

**Fixed on branch:** admin actions (reveal / evolve / set-stage / update-metadata)
now bust the manifest + home caches (was the "mystery image not updating" bug);
blockhash-based confirmations in create + admin.

**Gaps found (spec'd, NOT yet implemented):**
1. **The gap that caused Section 1:** uploader zones say "State 1 / State 2" with
   no semantics. Needed: label zone 0 as "BASE — what holders see first" and the
   last zone "FINAL EVOLUTION", plus a confirmation step showing the actual
   progression (thumbnails left→right with an arrow) before upload. This one UX
   screen would have prevented the 900-item inversion.
2. No way to commit `artwork_manifest_hash` after creation (protocol-immutable) —
   the create flow should compute and commit it by default, not as an option.
3. Create page (820 lines) not fully audited this session — flagged, not cleared.
4. Uploads resume from localStorage cache (good), but there's no "verify my
   uploaded manifest" button (fetch URI → render what holders will see). Cheap
   to add, catches mistakes like Section 1 post-upload.

---

## 5. AS A TRADER (list → buy → feed → evolve → shatter)

**Fixed on branch:**
- Buy was guaranteed to fail whenever listing data hadn't merged (max_price
  defaulted to 0 → on-chain PriceExceedsMax). Now reads the live listing.
- Shatter button silently died on RPC hiccup (read outside try/catch) and the
  confirm dialog said "recover 0.0000 SOL" for sub-1-SOL floors (Math.floor on a
  SOL value). Both fixed.
- "Not saving" — deprecated tx confirmation could time out while the tx landed;
  all senders now use blockhash confirmation + explicit on-chain error check.

**Verified correct (not bugs):**
- Frontend ix builders match the deployed program account-for-account
  (listing, incinerator_fallback, max_price all present, correct order).
- Slippage protection (max_price) works as designed.
- Kitties economics: shatter returns the full 0.05 floor (0% fee); evolving costs
  +0.10 SOL fed (reaching the 0.15 locked threshold) + 1h hold.

**Open / unaudited:**
- Trade-history chart (`evo-chart.ts`) heuristics — unaudited; treat prices shown
  there as indicative.
- No bids — listings only ("coming soon" is accurate).
- Portfolio page internals not deep-audited this session.

---

## 6. PRIORITY ORDER

1. **Deploy the branch** (after local `tsc` + build + vitest — nothing was
   compiled in the authoring env; see HANDOFF-stephen-claude.md §0).
2. **Run the stage-order fix** (Section 1) before anyone evolves.
3. Capture the Guard console log if the detail crash recurs → fix root cause.
4. Creator-UX guard rails (Section 4.1) before the next collection launches.
5. Phantom/Blowfish submission once `solana-verify` hash is published.

*Cross-references: HANDOFF-stephen-claude.md (per-commit detail), SECURITY.md
(protocol trust posture). If this doc drifts from the branch, the branch wins.*
