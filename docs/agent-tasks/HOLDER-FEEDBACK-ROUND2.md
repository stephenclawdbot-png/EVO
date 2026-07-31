# NEW TASKS — holder feedback round 2 (nothing here is done yet)

> AGENT: fresh work only. Prior task files are COMPLETE — ignore them.
> Two items, one commit each, 30-min timebox, tsc after each. Frontend only.

## 1. Calm the "Artwork Authenticity" panel (holders read it as a scam warning)
Where: EvoDetail's authenticity panel, `status === 'no-hash'` branch.
Kitties can NEVER commit a hash (immutable at create) — so the current
"art unverified / cannot be cryptographically verified" copy alarms holders
about something unfixable. Replace with honest-calm:
- Info icon (not warning triangle), dim/neutral style, smaller text.
- Copy: "Provenance hash: not enabled for this collection. Artwork is stored
  on permanent content-addressed storage (Irys) — files cannot be altered at
  their URLs. On-chain manifest hashing is available for new collections."
- Keep loud RED only for `status === 'mismatch'` (actual tampering).
**Done when:** no-hash renders as a neutral info note; mismatch still screams.

## 2. Endless loading after forge/evolve until manual refresh (Don's report)
Where: EvoDetail `onRefresh` consumers + collection page `fetchData` +
portfolio `fetchData` + forge page post-mint refetch.
1. Retry-until-changed: after a confirmed tx, poll the affected account
   (readEVO / readCollectionConfig) up to 5× with 1.5s gaps until the data
   differs from pre-tx (RPC serves stale state right after confirm), THEN
   update the UI.
2. Hard timeout: no spinner may live >12s — on timeout render
   "Taking longer than usual — [Refresh]" button instead of spinning.
3. Optimistic: after evolve, bump currentState locally at once; after feed,
   bump locked locally; reconcile when the refetch lands.
4. try/finally on every fetch body so loading=false ALWAYS runs.
**Done when:** forge/evolve updates the page by itself within seconds and no
spinner can spin forever.
