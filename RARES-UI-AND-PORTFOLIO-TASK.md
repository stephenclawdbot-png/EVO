# TASK: Rare evolutions in the CREATE flow + portfolio always 1 tap away

> AGENT: two features, one commit each, tsc after each. Frontend only.

## Feature 1 — "Rare Evolutions" option for creators (create page UI)
Make the rare-drop mechanic a checkbox in the create flow — no CLI. The logic
already exists in `scripts/add-rare-evolutions.mjs` (seeded mulberry32,
swap last state, tag Evolution: Rare/Standard) — PORT it into the uploader,
do not reinvent.

In `create/page.tsx` (only when lifecycle = RevealAndEvolve or Custom):
- Checkbox: "✨ Rare evolutions — some items evolve into a rare variant"
- When on: (a) a rarity % input (default 3, clamp 0.1–50);
  (b) BulkArtworkUploader gains ONE extra drop zone labeled
  "RARE evolved forms (optional — a few images, reused across winners)";
  (c) a seed is generated once (crypto.getRandomValues → uint32) and shown
  to the creator: "Fairness seed: 123456 — publish this later to prove the
  rare assignment was fixed at creation."
In `lib/bulk-manifest.ts` (where the manifest is built): after items are
assembled, if rares enabled, run the ported inject logic (seeded PRNG, swap
final state URL for winners, tag Evolution trait on every item). The private
winners list is NOT written anywhere client-side beyond the manifest itself.
Copy under the checkbox: "Deterministic under the hood, hidden until earned —
holders discover their variant at evolution. Note: manifest is public JSON."
**Done when:** a creator can tick the box, drop 2 rare images, set 3%, and the
uploaded manifest has ~3% items with rare final-state URLs + Evolution traits.

## Feature 2 — portfolio is never more than 1 tap away (common holder feedback)
Holders report they can't find their portfolio quickly. Fixes:
1. `Nav.tsx`: when wallet connected, the Portfolio link shows an owned-count
   pill: "Portfolio (3)" — count via one cached `readAllEVOsByOwner` (cache in
   sessionStorage 60s, fire-and-forget, no layout shift while loading).
   Ensure Portfolio is visible on MOBILE nav too (icon + label, not buried).
2. Home page: when wallet connected and count > 0, insert a "Your EVOs (N) →"
   row ABOVE the collections grid linking to /portfolio.
3. After EVERY successful tx (forge success card, buy, feed, evolve): add a
   "View in portfolio →" link next to the Solscan link.
4. Collection page: if the connected wallet owns items IN THIS collection,
   show a filter chip "Mine (N)" that filters the grid to owned EVOs.
5. Portfolio page itself: skeleton cards while loading (never blank), and the
   wallet-not-connected state says exactly one thing: connect button +
   "Connect to see your EVOs".
**Done when:** from any page, a connected holder reaches their EVOs in one
tap, sees their count in the nav, and portfolio never renders blank.
