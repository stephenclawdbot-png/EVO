// ⛔ OBSOLETE — creator decided the stage order is INTENTIONAL (adults evolve into kitties). DO NOT RUN.
#!/usr/bin/env node
// Fix the Solana Evo Kitties stage-order mix-up.
//
// PROBLEM (verified 2026-07-21 by downloading and viewing the images):
//   state 0 (what every EVO shows pre-evolution) = ADULT cat
//   state 1 (the evolution target)               = KITTEN
// i.e. the collection evolves BACKWARDS. Nobody has evolved yet (all minted
// EVOs are at state 0), so swapping the manifest now fixes it cleanly.
//
// WHAT THIS DOES (read-only; writes fixed-manifest.json locally):
//   1. Fetches the CURRENT on-chain manifest from its Irys URI
//   2. Swaps every item's states array (reverse: [adult, kitten] -> [kitten, adult])
//   3. Renames stateNames to meaningful labels
//   4. Sets the collection cover image to the new state-0 (kitten) of item 0
//   5. Writes fixed-manifest.json for you to upload
//
// THEN (manual, requires the creator wallet):
//   a. Upload fixed-manifest.json to Irys/Arweave (same flow used originally,
//      or `irys upload fixed-manifest.json ...`)
//   b. Call update_metadata with the NEW URI **plus the original query params**
//      (?website=...&twitter=...) — the frontend parses social links from them.
//      The admin page's pre-reveal handler shows the pattern for rebuilding
//      params; or use createUpdateMetadataIx directly.
//   c. Hard-refresh the terminal (manifest cache busts on admin tx already).
//
// NOTE: artwork_manifest_hash CANNOT be added after create_collection (it is
// immutable; update_metadata only changes the URI). This collection was created
// with a zero hash, so authenticity will stay "no hash committed" either way.

const CURRENT_URI =
  'https://gateway.irys.xyz/AaNHSK5HZf9LEuNQVkpsHNGabtjJzu3EZ2Hnp3bXy6H5';
const NEW_STATE_NAMES = ['Kitten', 'Evolved Cat'];

const res = await fetch(CURRENT_URI);
if (!res.ok) throw new Error(`Fetch failed: HTTP ${res.status}`);
const manifest = await res.json();

if (!Array.isArray(manifest.items)) throw new Error('Not a bulk manifest — no items[]');

let swapped = 0;
for (const item of manifest.items) {
  if (Array.isArray(item.states) && item.states.length === 2) {
    item.states = [item.states[1], item.states[0]];
    swapped++;
  } else {
    console.warn(`item ${item.index}: expected 2 states, got ${item.states?.length} — left untouched`);
  }
}

if (manifest.lifecycle && Array.isArray(manifest.lifecycle.stateNames)) {
  manifest.lifecycle.stateNames = NEW_STATE_NAMES.slice(0, manifest.lifecycle.stateNames.length);
}

// Cover image: point at the new state 0 (kitten) of the first item so the
// collection branding matches what holders actually see pre-evolution.
if (manifest.items[0]?.states?.[0]) manifest.image = manifest.items[0].states[0];

const fs = await import('node:fs');
fs.writeFileSync('fixed-manifest.json', JSON.stringify(manifest, null, 2));
console.log(`Swapped ${swapped}/${manifest.items.length} items.`);
console.log(`stateNames -> ${JSON.stringify(manifest.lifecycle?.stateNames)}`);
console.log('Wrote fixed-manifest.json — upload it and run update_metadata (see header).');
