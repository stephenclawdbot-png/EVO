# MELD UX/QoL Roadmap — four personas

**By:** Stephen (in Claude) · branch `stephen-claude` · 2026-07-21
Grounded in the actual codebase (pages/components read this session), not generic advice.
Implementation notes reference real files. Priorities: ★★★ do first, ★★ soon, ★ later.

---

## 0. The one structural fix that helps every persona ★★★

**EVOs have no URLs.** `selectedEvo` is component state in `c/[name]/page.tsx` and
`portfolio` — clicking an EVO doesn't change the address bar, refresh loses your
place, and **nobody can share a link to their EVO**. For a marketplace this is the
single biggest gap: every listing conversation ("look at this one") needs a link.

→ Add route `c/[name]/[id]/page.tsx` rendering `EvoDetail` from URL params
(fetch single EVO via `readEVO` — cheap). Make cards `<Link>`s. Keep the modal
behavior if you like, but the URL must change. Bonus: this page IS the
"proof of ownership" permalink the architecture docs wanted (on-chain owner,
locked SOL, history — shareable, wallet-independent).

---

## 1. CREATOR — creating a collection

Current pain: one 820-line form; generic "State 1/State 2" drop zones (caused the
900-item kitten inversion); lamports/bps jargon; hash committing optional & hidden.

★★★ **Stage semantics + progression confirm** — zones labeled
"Stage 1 — BASE (what holders see first)" … "FINAL EVOLUTION"; before upload, a
confirm screen shows 3 sample items as thumbnails left→right with arrows:
"Your collection evolves in this order." Would have prevented the Kitties inversion.

★★★ **Holder-math live preview** — as they set mint/lock/fees, render the exact
card a collector sees: "Collector pays 0.15 · you receive 0.10 · their floor 0.05 ·
if they shatter day one they recover 0.05 (33% of cost)." Creators currently
can't see their own deal from the buyer's side.

★★★ **Plain-language evolution builder** — thresholds as a sentence:
"An EVO evolves when it has been fed ≥ [0.05] SOL AND held [1] hour AND holds
≥ [0.15] SOL." Warnings: all-zero = "anyone can evolve instantly";
`locked_threshold ≤ lock_amount` = "met at mint — gate does nothing."

★★ **Commit `artwork_manifest_hash` by default** — it's immutable-after-create
(Kitties can never add it now). Make it opt-OUT ("Provenance: ON"), computed
automatically from the uploaded manifest.

★★ **"View as collector" dry-run** — render the real forge page + EvoCard +
EvoDetail with the uploaded art BEFORE the on-chain create. Catches wrong art,
wrong stages, broken images with zero cost.

★★ **Preflight costs + name check** — upfront: Irys upload estimate + 0.0459
creation fee + rent, vs wallet balance; live PDA-availability check on the name
(unique, first-come — fail early, not at submit).

★ Wizard structure (Identity → Art → Economics → Review), full-form draft
persistence (uploads already persist — extend to fields), post-launch checklist
(commit-reveal? reveal? admin link, share link).

---

## 2. TRADER — speculating

Current pain: listings-only UI shows price + premium, but EVO's entire thesis
(downside protection) is invisible at decision time.

★★★ **Floor-coverage on every listing** — "Ask 0.2 · backed 0.05 (25%) ·
max loss if you shatter: −0.15." One line, every card + buy modal. This is the
product's differentiator — surface it or it doesn't exist.

★★★ **Below-floor arbitrage badge** — a listing priced under its locked SOL is
literally free money (buy 0.04 → shatter for 0.05). Detect `listPrice <
lockedSol`, badge it "BELOW FLOOR", add premium-sort. Traders will patrol this —
that's engagement.

★★★ **Evolution progress on cards** — "0.08/0.15 SOL fed · evolves in 40m" as a
progress ring. Near-evolution EVOs are speculation targets (pre-transformation
sniping); currently that data is buried in a detail-page tab. Add one-click
**"Feed to evolve"** that prefills the exact remaining SOL.

★★ **Fees-transparent buy modal** — price → seller receives X, royalty Y (4.5%),
your total, your recoverable floor after purchase, and "price is slippage-capped:
you cannot pay more than shown" (the max_price protection already exists — brag
about it).

★★ **Collection scarcity stats** — shatter count ("34 destroyed — supply only
goes down"), evolution distribution (how many at each stage), locked-SOL trend.
Scarcity is the story; show it.

★ Activity feed (recent forges/trades/shatters/evolutions), watchlist,
last-sale vs ask on cards.

---

## 3. THE NEWCOMER — "what the fuck is an evo"

Current pain: docs/degens pages are dense manifesto prose. Nothing explains the
object in the first 10 seconds.

★★★ **Three-panel explainer above the fold** (use the actual kitten art):
1. "It's a collectible with SOL sealed inside" (kitten + coin)
2. "Feed it SOL and it grows" (kitten → evolved cat)
3. "Smash it anytime, take the SOL out" (shatter + SOL back)
That's the whole product. Ten words a panel.

★★★ **Interactive demo EVO — no wallet needed.** A demo kitten on the landing
page you can feed fake SOL, watch evolve, and shatter. Learn-by-doing in 20
seconds beats every doc page. `@evo/renderer` already exists for exactly this
kind of thing; or use two kitten stage images + a progress bar. This is the
highest-leverage onboarding artifact possible.

★★ **Subtitle the jargon in-UI** — keep the brand verbs, gloss them once:
"Forge (mint)", "Feed (add SOL — raises its floor)", "Shatter (destroy it,
take the SOL inside)". Tooltip on every stat: hover "Locked" → "SOL sealed
inside. Yours whenever you shatter."

★★ **First-buy explainer modal** — before a newcomer's first purchase: art,
what they're paying, what they can ALWAYS get back, link to "how floors work."

★★ **Honest FAQ** — the five real questions: Where is my SOL actually held?
(in the EVO's own on-chain account — address linked) · What if this website
dies? (the protocol is on-chain; any client can read it) · Why does Phantom
warn me? (unaudited program — honest answer + SECURITY.md link) · Can price
go below floor? (yes — then shatter) · Who are you?

---

## 4. COLLECTOR — checking my collection

Current pain: portfolio lists holdings + basic totals; no P&L, no care loop,
no way to show anyone.

★★★ **Portfolio that answers "how am I doing?"** — header: total recoverable
now (floors), total at ask (if listed), total fed, and per-EVO cost basis
(mint price + feeds are all derivable on-chain) → simple net position.

★★★ **"Ready to evolve" surfacing** — banner: "2 of your EVOs can evolve" +
per-card progress ("feed 0.07 more · 20m left"). Gives holders a reason to
return daily — the care loop IS the retention mechanic, and the data is
already parsed.

★★ **Flex/share card** — one click renders a PNG (or OG-image route) of your
EVO: art + name + locked SOL + stage + trades survived, sized for X. Uses the
deep-link URL from §0. Every share is free acquisition.

★★ **Per-EVO timeline** — forged → fed (n times) → evolved → traded → now.
All reconstructable from `fracture_lines` + counts. Makes "SOL that remembers"
visible instead of a slogan.

★ Trait filters + rarity counts (traits are in the manifest already —
"Deep Space: 12% of collection"), shattered-graveyard view (art persists as
record — sentimental + scarcity proof).

---

## Cross-cutting QoL (all personas)

- **Toasts, not raw error strings** — map program errors to human text
  ("SelfTradeNotAllowed" → "You can't buy your own listing").
- **Skeleton loaders** instead of spinners; **empty states with CTAs**
  ("No EVOs yet — forge your first for 0.15 SOL").
- **Optimistic refresh** after tx: update the card locally, reconcile on refetch.
- **Mobile pass** — degens trade from phones; test the buy flow at 390px.
- Keyboard: `r` refresh exists on home — document it, add `/` for search.

## Suggested build order

1. §0 EVO URLs (unlocks share cards, proof page, all social loops)
2. Trader floor-coverage + below-floor badges (thesis, visible)
3. Newcomer three-panel + demo EVO (conversion)
4. Creator stage-confirm + holder-math (prevents the next Kitties inversion)
5. Portfolio P&L + ready-to-evolve (retention)

---

# Appendix: Frontend engineering suggestions (bug-class killers)

Each item targets a CLASS of bug actually hit in this codebase, not hypotheticals.
Ordered by ROI for a solo developer.

1. **Sentry (free tier), ~1 hr** — the EvoDetail crash survived "exhaustive
   inspection" because nobody had a stack trace. Production error monitoring
   converts "users say it's broken" into file:line + component stack + device.
   Highest-leverage hour available.

2. **TanStack Query for all chain reads** — the stale-stats, stale-manifest,
   stuck-verification, and unmerged-listing bugs are all symptoms of five
   hand-built cache systems (home localStorage SWR, two Maps in evo-visuals,
   per-page useEffect fetches). Query replaces them: SWR, retries, focus
   revalidation, and `invalidateQueries(['collection', name])` after every tx.
   Kills the class. (~1 weekend)

3. **Unit-safe types, ~2 hrs** — four double-division bugs came from
   `lockedLamports` (a field that actually holds SOL). Either rename display
   fields (`lockedSol`) or better: keep `bigint` lamports through the data
   layer and convert to SOL only at render, in one function.

4. **Generate the client from the Anchor IDL** — three hand-maintained
   encodings of the program exist (frontend lib, @evo/sdk, tests) and the SDK
   already drifted into building broken transactions. `@coral-xyz/anchor` +
   the emitted IDL derives account order/arg encoding — drift becomes
   impossible. Pairs with the SDK regen already in HANDOFF §4.

5. **Server-side aggregation before scale** — today every visitor's browser
   runs getProgramAccounts over every EVO (1101 B each) + a 348 KB manifest
   fetch. At 900 mints that's ~1 MB+ RPC per pageview against the paid Helius
   key. Add `/api/collections` (aggregation once, `s-maxage=30` — CDN serves
   the rest) and `s-maxage=300` on `/api/manifest` (Irys content is immutable;
   the URI changes, not the content).

6. **Test the money layer** — all 53 vitest tests are visuals; the parsers and
   ix builders (where audit findings C-1..C-4 lived) have zero. Add: golden
   parser tests using REAL mainnet account bytes as fixtures (layout drift
   fails CI instantly); builder tests asserting account order against the
   program's Accounts structs; one Playwright smoke test with mocked RPC to
   catch white-screens pre-deploy.

7. **Zod manifest schemas** — replaces ~100 lines of hand-rolled
   isValidManifest/isBulkManifest checks + scattered `as any`; malformed
   creator manifests become typed errors at the boundary.

8. **Central program-error translator** — map error codes to human copy once
   ("PriceExceedsMax" → "Price changed — refresh and try again"). Raw hex
   errors read as "broken" even when the protocol is correctly protecting
   the user.

Build order: 1 → 3 → 2 → 5 → 6 → 4 → 7/8.
