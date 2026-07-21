# POLISH PASS — same UI, highest quality. NO new features.

> AGENT: this is a refinement sweep across existing pages. Do NOT add features,
> pages, or refactors. One discipline = one commit. `tsc --noEmit` after each.
> Timebox 30 min each; stuck → TODO comment, move on.

## P1 — Number discipline (global)
- All SOL: `X.toFixed(3)` + ` SOL`; all %: `Math.round` + `%`; all counts plain.
- Add `tabular-nums` (font-variant-numeric) to every `font-mono` number.
- One helper `lib/format.ts`: `fmtSol(n)`, `fmtPct(n)` — replace ad-hoc toFixed calls.
Done when: no number anywhere renders with inconsistent decimals.

## P2 — Value-change flash
- Tiny hook `useFlash(value)`: on change, add class `flash-up`/`flash-down`
  (green/red bg fading 400ms via CSS transition). Apply to: home stats bar,
  collection sticky stats, card LOCKED/ASK, detail locked value.
Done when: minting/feeding visibly flashes the numbers that changed.

## P3 — Zero layout shift
- Skeletons exactly match final component dimensions (card = aspect-square + 2 text rows).
- All `<img>`: mount at `opacity-0`, `onLoad` → `opacity-100 transition-opacity duration-150`.
- Buttons: fixed height; pending state swaps label for inline spinner, width unchanged.
Done when: loading → loaded causes no element to move.

## P4 — Interaction speed
- Rows/cards/buttons: `transition duration-100` only on transform/opacity/bg.
- Add pressed state (`active:scale-[0.98]` on buttons, `active:bg-surface-2` rows).
- Cursor-pointer on everything clickable (audit for missing).
Done when: every interactive element reacts <100ms with hover AND press states.

## P5 — Live pulse
- Stats bars (home + collection): green dot + "LIVE" label; dot `animate-pulse`.
- Auto-refetch collection + home every 30s (silent, no spinner — numbers just
  flash via P2). Pause when tab hidden (`document.visibilityState`).
Done when: leaving the page open shows numbers updating on their own.

## P6 — Color semantics audit
- Green (`text-positive`) ONLY on: locked value, gains, buy/confirm, live dot.
- Red (`text-negative`) ONLY on: shatter, losses, errors.
- Accent ONLY on interactive/selected. Remove any decorative color use found.
Done when: every colored element's color carries meaning.

## P7 — Microcopy + dead ends
- Labels ≤2 words; strip filler sentences near buttons.
- Every empty state names the next action; every error says what to DO
  (use humanizeError everywhere it isn't yet).
Done when: no blank screens, no paragraph-length UI copy, no raw error strings.
