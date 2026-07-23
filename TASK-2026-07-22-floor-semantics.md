# TASK 2026-07-22 — "FLOOR" must mean the TRUE floor, not the lowest ask

> AGENT: fresh file, prior task files complete. One commit. Frontend only.
> Trigger: one holder listed #0 at 10 SOL (backed 0.050) and the collection
> header now shows "FLOOR 10.000" — a single outlier ask defines the metric.

EVO's differentiator IS the real floor (locked SOL). Never label an ask "floor".

1. RENAME the metric everywhere:
   - Collection sticky bar + home cards: "FLOOR <min ask>" → "BEST ASK <min ask>".
   - Add the true metric beside it: "TRUE FLOOR <lock_amount> SOL (backed)" —
     use collection lock_amount (min locked across live EVOs if feeds vary;
     cheap: min(evo.lockedLamports) from already-loaded list).
   - Order: TRUE FLOOR first (green), BEST ASK second (neutral).
2. EvoCard `isFloor` badge ("FLOOR" on the lowest-ask card) → rename "BEST ASK".
3. Outlier de-emphasis: if best-ask coverage < 10% (ask > 10× locked), render
   BEST ASK dimmed with a "thin market" hint (tooltip/label: "1 listing —
   backed only N%"). Do NOT hide or block the listing — permissionless is the
   point; the coverage line already warns buyers (it worked: shows −9.950 max).
4. Home collection cards use the same two-metric labeling.
**Done when:** a lone 10 SOL listing can no longer make the header claim the
collection floor is 10 SOL; TRUE FLOOR (locked) leads everywhere.
