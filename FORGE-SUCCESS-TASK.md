# TASK: Forge success card — real holder feedback ("silent state")

> Holder 0x1admiral: "when you forge it dont tell you it succeed. silent
> state. should have a card forge succeed or somthing." He is right — the
> current success UI is a 1-line strip. The mint is the peak emotional moment;
> make it an event. AGENT: one commit, frontend only, 30-min timebox.

## File: frontend/src/app/c/[name]/forge/page.tsx

When `txSig` is set, REPLACE the whole forge form area (preview + cost + button)
with a SUCCESS CARD (don't just append a banner below):

1. Big card, `border-positive/40 bg-positive-soft`, centered:
   - "⚡ FORGED" heading + IconCheck, text-positive, text-lg font-bold
   - The minted EVO's image LARGE (the `resolvedImage` for the id just minted —
     capture `nextId` into a `mintedId` state BEFORE refetching, because
     fetchCollection() advances nextId to the next slot; then resolve the image
     for `mintedId`)
   - "{collectionName} #{mintedId} is yours"
   - Row: `Locked inside: 0.050 SOL (your floor — recover anytime via shatter)`
2. Three buttons:
   - **View my EVO** → deep link `/c/{name}/{mintedId}` (route exists)
   - **Share on X** → `https://twitter.com/intent/tweet?text=${encodeURIComponent(
       `Just forged ${collectionName} #${mintedId} on @meldterminal — SOL locked inside, floor guaranteed 🐱`)}&url=${encodeURIComponent(
       `https://meldterminal.io/c/${encodeURIComponent(collectionName)}/${mintedId}`)}`
     (target=_blank rel=noopener)
   - **Forge another** → resets txSig/error, refetches (form returns)
3. Keep the small Solscan link row under the card (already exists).
4. While `forging`: disable the button AND show a persistent status line under
   it: "Confirming on Solana… ~5s" — so the wait is never silent either.

## Done when
Minting shows a full success card with the kitty image, a working deep link,
and a working X share — no more silent state. Reply to 0x1admiral with a
screenshot when shipped.
