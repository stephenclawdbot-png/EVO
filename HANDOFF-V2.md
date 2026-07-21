# HANDOFF V2 — THE ONLY FILE YOU NEED · branch `stephen-claude`

> **AGENT: READ THIS, IGNORE ALL OTHER .md HANDOFFS.** This supersedes
> HANDOFF-stephen-claude.md. Other docs (PLATFORM-AUDIT, UX-ROADMAP, SECURITY)
> are background reference only — do NOT treat them as task lists.
> **Keyword:** `EVO-V2-TERMINAL-2026-07-21`

## ANTI-LOOP RULES (obey these before anything else)

1. Work the tasks **in order**. One task = one commit. Run `npx tsc --noEmit` after each.
2. **Timebox: 30 min per task.** Stuck? Leave `// TODO(v2): <why>`, commit what compiles, move on. Do NOT investigate side quests.
3. **Never touch `programs/`** (on-chain, live mainnet, real money). Frontend only.
4. Only modify the files listed in each task. No refactors beyond the task.
5. If `vitest` fails in `evo-visuals` tests asserting the OLD raw-manifest return: **update the test assertions** (normalized manifest is the fix, not a regression). Any other unrelated failure: note it, skip it.
6. This repo's Next.js is modified — check `frontend/node_modules/next/dist/docs/` if an API surprises you. Do NOT run `playwright install`.
7. Do not redeploy or touch Vercel config unless a task says so.

## THE VIBE TARGET (design north star — no bikeshedding)

Tensor/Magic Eden data-density × memecoin terminal (Axiom/Photon) energy:
- **Dense monospace numbers everywhere** (JetBrains Mono is already loaded).
- Dark, tight rows, hover-highlight, green=value/up, red=risk/down.
- Stats visible at ALL times (sticky bars), not buried in tabs.
- Every number the trader cares about: floor, coverage %, premium, progress.
- Existing tailwind tokens to reuse: `bg-bg bg-surface bg-surface-2 border-border
  text-muted text-dim text-positive text-negative text-accent font-mono t-row t-input`.
- Number format: SOL always 3 decimals (`0.050`), percents 0 decimals (`+150%`).

---

## STATE OF THE WORLD (verified facts, don't re-derive)

- Program LIVE on mainnet: `Aw4mAC5oUfQCP65a8a6mTwkrL2CoUMsBa45KvWPY3CN2`. 7/900 Kitties minted, revealed, all at state 0.
- Manifest is HEALTHY: 900/900 items, per-item `traits` {Breed, Background, Type},
  30×30 balanced, names are 1-BASED (`#0001` = index 0). Images all load (verified).
- **Stage order is INVERTED** (state0=adult, state1=kitten). Fix script exists
  and is TESTED: `scripts/fix-stage-order.mjs`. Nobody has evolved yet.
- This branch already fixed: image latch + missing placeholder.png, home
  "0.00 SOL" double division, stale caches, buy max_price=0, shatter dialog,
  blockhash confirms, EvoDetail crash guards, manifest normalization (traits
  now flow through `manifest.items` — typed).

---

## TASK LIST (check off in this file as you go)

- [ ] **T0 — Verify & ship the branch** (gate for everything)
- [ ] **T1 — Stage-order data fix** (with the user; needs creator wallet)
- [ ] **T2 — EVO deep links** `/c/[name]/[id]`
- [ ] **T3 — Real names + traits on detail** (mostly done; wire `item.name`)
- [ ] **T4 — Terminal table view** on collection page (THE vibe task)
- [ ] **T5 — Floor coverage + BELOW FLOOR badge**
- [ ] **T6 — Trait filter chips + rarity**
- [ ] **T7 — Live activity ticker**
- [ ] **T8 — Buy modal with fee breakdown**
- [ ] **T9 — Error translator + toasts**
- [ ] **T10 — Skeletons + empty states**

---

### T0 — Verify & ship (DO THIS FIRST, nothing else matters until deployed)
```bash
cd frontend && npm i && npx tsc --noEmit && npm run build && npx vitest run
```
Fix only what blocks (rule 5 for vitest). Then merge `stephen-claude` → deploy
branch and confirm on the live site: images render, home shows `LOCKED 0.30 SOL`
(or current), detail page opens.
**Done when:** live site shows kitty images + non-zero locked totals.

### T1 — Stage-order fix (coordinate with user; 10 min)
```bash
node scripts/fix-stage-order.mjs        # writes fixed-manifest.json (tested: 900/900)
# user uploads fixed-manifest.json to Irys with creator wallet
# then update_metadata with the NEW uri + KEEP ?website=...&twitter=... params
```
**Done when:** state 0 renders KITTENS on the live site.

### T2 — EVO deep links (foundation for sharing; ~45 min)
New file `frontend/src/app/c/[name]/[id]/page.tsx`:
- `'use client'`; read `params.name`, `params.id`.
- Fetch: `readCollectionConfig(connection, name)` → `getCollectionPDA` →
  `readEVO(connection, collectionPda, Number(id))` → `evoAccountToData(evo, name)`
  → `mergeSingleListing(connection, data)` (all exist in `lib/evo-program` / `lib/evo-data`).
- Render `<EvoDetail evo={data} onBack={() => router.push('/c/'+name)} onRefresh={refetch} />`.
- Loading: centered spinner. Not found: message + link back.
In `c/[name]/page.tsx` change card onClick to `router.push` the deep link
(keep `setSelectedEvo` fallback OUT — URL is now the source of truth).
**Done when:** refresh on `/c/Solana%20Evo%20Kitties/5` shows EVO #5; card clicks change the URL.

### T3 — Real names + traits (~20 min)
`lib/evo-data.ts` → `evoAccountToData` gains optional param `manifestItem?: {name?: string}`;
if `manifestItem?.name` use it, else keep `${collectionName} #${evo.evoId}`.
Callers that have the manifest (collection page, detail route) pass
`manifest.items?.find(it => it.index === evo.id)`. Detail traits already render
post-T0 (they flow via `manifest.items[].traits`).
**Done when:** card + detail show "Solana Evo Kitties #0006" for index 5 (names are 1-based).

### T4 — TERMINAL TABLE VIEW (the Tensor/Axiom feel; ~2 hr, biggest payoff)
`c/[name]/page.tsx`: add a Grid|Table toggle (default **Table**). Table spec —
one dense row per EVO, `font-mono`, `text-xs`, hover `bg-surface-2`:

| col | source | style |
|---|---|---|
| img 24px | resolved image (already available) | rounded |
| # / name | T3 name | text-text |
| STAGE | `S{currentState}` + stage name from manifest | accent color chip |
| LOCKED | `lockedLamports` (already SOL) `.toFixed(3)` | text-positive |
| ASK | `listPrice ?? '—'` | positive if listed |
| COVER% | see T5 formula | color-coded T5 |
| PREMIUM | `((ask-locked)/locked*100).toFixed(0)+'%'` or '—' | green/red |
| EVOLVE | progress `min(fed/0.05, locked/0.15, held/1h)` as mini-bar | accent |
| [BUY] | listed && !own → sm button → deep link (T2) | bg-positive |

Sticky sub-header ABOVE the table (always visible, `sticky top-0 z-10 bg-bg`):
`FLOOR <min ask> · LOCKED <sum> SOL · LISTED <n>/<supply> · SHATTERED <total_minted-current> · 24H TRADES <n or —>`.
Sortable: click LOCKED/ASK/COVER%/PREMIUM headers (simple `useState` sort key + dir).
**Done when:** table renders all EVOs, sorts on click, buy button navigates.

### T5 — Floor coverage + BELOW FLOOR (~30 min; do inside T4's row + EvoCard)
```ts
const coverage = listPrice ? Math.round((lockedSol / listPrice) * 100) : null; // %
// color: >=100 → text-positive + badge 'BELOW FLOOR' (pulse), >=50 → text-warn, else text-muted
```
`coverage >= 100` means ask ≤ locked → free-money arb → render an animated
`BELOW FLOOR` badge (reuse the `evo-pulse` keyframe that exists in EvoCard).
Also add one line to the buy area in `EvoDetail`: `Max loss if you shatter after buying: −{(ask − locked·(1−fee)).toFixed(3)} SOL` (fee = shatterFeeBps, already fetched).
**Done when:** every listed row/card shows COVER% and sub-floor listings scream.

### T6 — Trait filter chips (~45 min)
Collection page: from `manifest.items` build `Map<traitKey, Map<value, count>>`.
Render chip rows above the grid/table: `Breed ▾` `Background ▾` dropdowns of
values with counts ("Russian Blue · 30 · 3.3%"). Selecting filters the EVO list
(match via `manifest.items[evo.id].traits`). Multi-select = AND across keys,
OR within a key. Store in `useState`, no URL sync needed yet.
**Done when:** picking "Ginger Maine Coon" shows only those EVOs with a count.

### T7 — Activity ticker (~45 min, memecoin energy)
Data already exists: `readCollectionTradeHistory` (`lib/evo-chart.ts`) is fetched
on the collection page (`trades` state). Render a slim marquee bar under the Nav:
`🔨 #12 forged · 0.15` `⚡ #5 sold 0.20 (+300%)` `💥 #3 shattered` — newest left,
horizontal scroll-animation (CSS `@keyframes` translate, pause on hover), green
for buys/forges, red for shatters, `font-mono text-[11px]`.
**Done when:** the bar animates with real events on the Kitties page.

### T8 — Buy confirmation panel (~30 min)
In `EvoDetail`, replace the bare Buy button flow with an expandable confirm:
```
Price               0.200 SOL
Creator royalty 4.5%  −0.009 → to creator
Seller receives      0.191 SOL
Your floor after buy  0.050 SOL  (recover via shatter, 0% fee)
Max loss             −0.150 SOL
[ CONFIRM BUY — price locked, cannot be front-run ]
```
All values from `cfg` already fetched in `handleBuy`. Mention slippage cap — it's real (`max_price`).
**Done when:** buy shows the breakdown before signing.

### T9 — Error translator + toasts (~30 min)
New `frontend/src/lib/errors.ts`:
```ts
const MAP: Record<string,string> = {
  SelfTradeNotAllowed: "You can't buy your own listing.",
  PriceExceedsMax: 'Price changed under you — refresh and retry.',
  EvolutionConditionsNotMet: 'Not ready to evolve yet — check feed/hold/locked progress.',
  SupplyCapReached: 'Collection is minted out.',
  EvoShattered: 'This EVO was shattered — it no longer exists.',
  InsufficientTransferFee: 'Transfer costs 0.009 SOL — top up your wallet.',
  NotEvoOwner: "You don't own this EVO.",
  InsufficientPayment: 'Not enough SOL in your wallet.',
  AlreadyAtMaxState: 'Already fully evolved.',
  NotRevealed: 'Collection not revealed yet.',
};
export function humanizeError(raw: string): string {
  for (const [k,v] of Object.entries(MAP)) if (raw.includes(k)) return v;
  if (/0x1$|insufficient lamports/i.test(raw)) return 'Not enough SOL in your wallet.';
  return raw.length > 140 ? raw.slice(0,140)+'…' : raw;
}
```
Wrap every `setError(err.message)` in the app with `humanizeError(...)`.
**Done when:** a self-buy attempt shows the friendly message, not hex.

### T10 — Skeletons + empty states (~30 min)
Replace spinner-only loading on home + collection with 8 shimmering card
skeletons (`animate-pulse bg-surface` blocks, aspect-square). Empty gallery:
"No EVOs forged yet — be first for 0.150 SOL → [Forge]".
**Done when:** loading no longer looks broken.

---

## LATER (do NOT start these now; here so you don't invent them)
Sentry setup · TanStack Query migration · server-side `/api/collections`
aggregation · IDL-generated client · walletless demo EVO on landing ·
flex/share OG cards · portfolio P&L. Specs live in UX-ROADMAP.md appendix.

## IF THE DETAIL PAGE CRASHES AGAIN
Console will print `EvoDetail section "detail-left|right" crashed: <error + stack>`
(the Guard from this branch). Fix THAT line. Do not speculate beyond the log.
