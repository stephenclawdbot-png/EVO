# TASK 2026-07-22 — visual cleanup (replaces floor-semantics task — CANCELLED,
# user wants "floor" kept as-is; these are DESIGN fixes only)

> AGENT: one commit per item, tsc after each. No metric renames.

## 1. Listed-price bar covers the art + collides with FLOOR chip (EvoCard)
The green "10 SOL" bar overlays the image and sits on top of the FLOOR badge —
covers the kitty, looks broken.
- Move the price OUT of the image area: no overlay. Put it in the card footer
  row (price is already shown there on the right — make THAT the only price:
  bold, text-positive, slightly larger). Delete the sliding/static image
  overlay bar entirely.
- FLOOR badge: keep on-image but top-left is taken by #id — move FLOOR to
  bottom-right of the image, small, so nothing stacks.
- Result: art is NEVER covered by anything except the tiny corner badges.

## 2. Mobile stats/ticker bar gets cut ("LOCKED 8.560 SOL" wraps, LISTED clipped)
- Make the LIVE stats bar one horizontal line, `overflow-x-auto`
  `whitespace-nowrap` `scrollbar-none` — swipeable, never wraps, never clips.
- Value stays on the same line as its label ("LOCKED 8.560 SOL" one unit).

## 3. Supply dropdown/popover clipped off-screen on mobile
The "741 left / Available / 18% claimed" popover renders past the left edge
(half the button cut). Fix: on <sm render it full-width under the row
(static block or bottom-sheet style), not an absolutely-positioned popover;
on desktop clamp within viewport (left-0 right-auto + max-w).

## 4. Chart header truncation ("...ties Chart")
Long collection names truncate the title awkwardly. Use `truncate` with the
price pinned right: flex row, title `min-w-0 truncate`, price `shrink-0`.

**Done when (390px):** nothing is clipped off-screen, the stats bar swipes in
one line, and no card art is covered by any price bar.

## 5. Footer unreachable on mobile — hidden behind the fixed bottom tab bar
The new tab bar is `fixed bottom-0` but page content has no bottom padding, so
the footer (Guide/Docs/GitHub links) is permanently covered — users cannot
scroll to or tap the doc links.
- Add global bottom padding on mobile equal to the bar height + safe area:
  on the layout/page wrapper `pb-20 sm:pb-0` (adjust 20 to actual bar height),
  and give the tab bar itself `pb-[env(safe-area-inset-bottom)]`.
- Verify EVERY page (home, collection, detail, forge, portfolio, create,
  docs, guide): scrolled to the very bottom, the last element clears the bar
  fully and all footer links are tappable.
**Done when:** on a phone, the footer's Docs/Guide/GitHub links are fully
visible and tappable above the tab bar on every page.
