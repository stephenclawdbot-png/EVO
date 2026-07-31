# TASK: Holders can't evolve — add EVOLVE button (EvoDetail + portfolio)

> AGENT: do exactly this, one numbered step = one commit, `npx tsc --noEmit`
> after each. No refactors, no side quests. Frontend only — never touch `programs/`.
> Context: an EVO with ALL progress bars full shows NO evolve button anywhere —
> the only evolve trigger in the app is on the admin page. The protocol's
> `evolve` is PERMISSIONLESS; the UI just never exposed it to holders.

## UNITS WARNING (this is where you'd loop — read twice)
- `evo.lockedLamports` = **SOL** (field name lies)
- `evo.totalFedLamports` = **raw lamports**
- `evolveThresholds.feed` / `.locked` = **raw lamports**
- `evo.lastTransitionAt` = **milliseconds**
- Thresholds are **CUMULATIVE × next_state** (on-chain evolve.rs logic)

## Step 1 — shared readiness helper
In `frontend/src/lib/evo-data.ts` add + export:

```ts
export function isReadyToEvolve(
  evo: EVOData,
  t: { trade: number; feed: number; hold: number; locked: number;
       maxStates: number; lifecycleType: string },
  isRevealed: boolean,
): boolean {
  const next = evo.currentState + 1;
  return isRevealed &&
    (t.lifecycleType === 'RevealAndEvolve' || t.lifecycleType === 'Custom') &&
    evo.currentState < t.maxStates - 1 && !evo.isShattered &&
    (t.trade === 0 || evo.tradeCount >= t.trade * next) &&
    (t.feed === 0 || evo.totalFedLamports >= t.feed * next) &&
    (t.hold === 0 || (Date.now() - evo.lastTransitionAt) / 1000 >= t.hold * next) &&
    (t.locked === 0 || evo.lockedLamports * 1e9 >= t.locked * next);
}
```

## Step 2 — EVOLVE button in EvoDetail.tsx
- Import `createEvolveIx` from `@/lib/evo-program` (exists — admin page uses it)
  and `isReadyToEvolve` from `@/lib/evo-data`.
- `const canEvolve = evolveThresholds && isRevealed !== undefined
    && isReadyToEvolve(evo, evolveThresholds, !!isRevealed);`
- Handler (same pattern as handleFeed):

```ts
const handleEvolve = async () => {
  setAction('evolve'); setError(null); setTxResult(null);
  try {
    const sig = await sendTx(createEvolveIx(
      new PublicKey(evo.evoPda!), new PublicKey(evo.collectionPda!), evo.id));
    if (sig) { setTxResult(sig); onRefresh?.(); }
  } catch (err: any) { setError(humanizeError(err.message || 'Evolve failed')); }
  finally { setAction(null); }
};
```

- UI, THREE placements (do not hide behind tabs):
  1. Inside the "Progress to stage N" panel: when `canEvolve`, replace the
     passive "All conditions must be met..." caption with a full-width accent
     button: `⚡ EVOLVE NOW` (disabled while `action === 'evolve'`).
  2. Owner actions sidebar: when `canEvolve`, same button ABOVE Feed.
  3. Slim banner above the tabs when `canEvolve`:
     "Ready to evolve ⚡" + button. Accent bg, not red/green.
- When progress exists but !canEvolve, keep the bars as-is.

**Done when:** an EVO with full bars shows ⚡ EVOLVE NOW; clicking lands the tx
and the art flips to the next stage after refresh.

## Step 3 — surface on portfolio (holders' holdings view)
`frontend/src/app/portfolio/page.tsx`:
- Each collection group already has its `CollectionData` (thresholds + isRevealed).
- Compute `isReadyToEvolve(evo, cfgThresholds, cfg.isRevealed)` per owned EVO.
- Pass EvoCard's existing evolve props so its "Ready" badge shows.
- Top-of-page banner when any ready: `N of your EVOs are ready to evolve ⚡`.
- Card click already goes to the deep link where EVOLVE NOW lives.

## Step 4 — small fixes while in there (same commit as step 3 is fine)
- `EvoCard.tsx`: `bg-warning` → `bg-warn` (token doesn't exist; the Below Floor
  badge is currently invisible).
- `EvoDetail.tsx` owner actions: move the Shatter button directly under
  Feed/Transfer (not last), label `Shatter — recover X.XXX SOL`, keep red style.

## Done-when (whole task)
The kitty from the user's screenshot (fed 0.100/0.050 ✓, held 1.5h/1.0h ✓,
locked 0.150/0.150 ✓) shows ⚡ EVOLVE NOW on its detail page, portfolio shows
the ready banner, and one click evolves it — the first evolution in the
collection's history.
