#!/usr/bin/env node
// Fix the Solana Evo Kitties stage-order mix-up.
// Uses the manifest already fetched via the Vercel proxy (original-manifest.json).

const fs = await import('node:fs');
const raw = fs.readFileSync('original-manifest.json', 'utf-8');
const manifest = JSON.parse(raw);

if (!Array.isArray(manifest.items)) throw new Error('Not a bulk manifest — no items[]');

const NEW_STATE_NAMES = ['Kitten', 'Evolved Cat'];

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

// Cover image: point at the new state 0 (kitten) of the first item
if (manifest.items[0]?.states?.[0]) manifest.image = manifest.items[0].states[0];

fs.writeFileSync('fixed-manifest.json', JSON.stringify(manifest, null, 2));
console.log(`Swapped ${swapped}/${manifest.items.length} items.`);
console.log(`stateNames -> ${JSON.stringify(manifest.lifecycle?.stateNames)}`);
console.log('Wrote fixed-manifest.json — upload it and run update_metadata (see header).');