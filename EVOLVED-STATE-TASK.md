# TASK: "Ready" badge stuck after evolution + owner stage-view toggle

> AGENT: two steps, one commit each, 30-min timebox each. Frontend only.

## Step 1 — BUG: Ready badge persists on fully-evolved EVOs
Cause: `EvoCard.tsx` computes its own `readyToEvolve` (feed% + locked only) and
never checks max stage. The shared helper already does it right.
Fix:
- Delete EvoCard's ad-hoc readiness math (`feedPct/lockedMet/readyToEvolve`).
- Import `isReadyToEvolve` from `@/lib/evo-data` and call it with the evo +
  thresholds. EvoCard needs `maxStates`, `lifecycleType`, `isRevealed` — extend
  its existing evolve props (callers in portfolio/collection page already hold
  the CollectionData; pass them through).
- While there: same check anywhere else "Ready" renders (portfolio banner
  count must also use the shared helper — no duplicates of this logic anywhere).
- Fully-evolved EVOs instead show a small badge: `MAX` (or `★ Final form`),
  dim accent style, NOT green.
**Done when:** an evolved kitty (state 1 of 2) shows no Ready badge anywhere;
portfolio banner count excludes it.

## Step 2 — FEATURE: owner display toggle on fully-evolved EVOs
On-chain `current_state` CANNOT go backwards (evolve only advances) — this is a
LOCAL VIEW preference only. Be honest in the UI about that.
In `EvoDetail.tsx`:
- When `evo.currentState >= maxStates - 1` and the manifest has >1 stage for
  this EVO (`manifest.items[evo.id].states.length > 1` or stages array):
  render small pill-toggles under the main image: one per stage, labeled with
  stage names ("Cat" / "Kitten" or Stage N). Active = accent.
- Clicking sets `viewStage` state → main image resolves via
  `resolveActiveImage(manifest, evo.id, viewStage, isRevealed)`.
- Persist per-EVO: `localStorage['evo_view_stage_' + evo.evoPda] = viewStage`;
  read it on mount (default = actual current_state).
- Caption under toggle when viewing a non-current stage:
  "Viewing past form — on-chain stage is {currentStageName}".
- Owner-only? No — anyone can flip the view (it's cosmetic); but persist only
  locally. The stage gallery strip stays as-is.
**Done when:** a fully-evolved kitty's owner can flip between adult and kitten
art on the detail page, preference survives refresh, and the caption keeps the
on-chain truth visible.
