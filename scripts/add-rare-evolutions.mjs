#!/usr/bin/env node
// RARE EVOLUTION DROPS — inject rare evolved-form variants into a bulk manifest.
//
// The protocol needs NO changes for this: per-item `states` arrays already give
// each EVO its own stage art, and the terminal's locked-stage blur hides future
// forms until earned. Deterministic rarity + hidden outcome = plays like a
// random drop at evolution time.
//
// Usage:
//   node scripts/add-rare-evolutions.mjs <manifest.json> <rare-urls.txt> <rate> [seed]
//     manifest.json  — bulk manifest (local file)
//     rare-urls.txt  — one Irys/Arweave URL per line (upload rare art FIRST)
//     rate           — e.g. 0.03 = ~3% of items get a rare evolved form
//     seed           — optional integer; same seed = same picks (reproducible)
//   Writes: manifest-with-rares.json + rare-assignments.json (keep PRIVATE
//   until reveal-worthy — it lists which ids are rare).
//
// Honest caveat: the published manifest is public — determined snipers can read
// which ids hold rare stage-2 URLs. Fine for fun collections; true unsnipeable
// randomness needs committed art / VRF (protocol v2).
//
// STAGE INDEX: replaces the LAST state (the final evolved form). Adjust
// STAGE_IDX if your rare form is a different stage.

import fs from 'node:fs';
const [,, manifestPath, rareListPath, rateStr, seedStr] = process.argv;
if (!manifestPath || !rareListPath || !rateStr) {
  console.error('usage: add-rare-evolutions.mjs <manifest.json> <rare-urls.txt> <rate 0-1> [seed]');
  process.exit(1);
}
const m = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
if (!Array.isArray(m.items)) throw new Error('not a bulk manifest (no items[])');
const rares = fs.readFileSync(rareListPath, 'utf8').split('\n').map(s => s.trim()).filter(Boolean);
if (!rares.length) throw new Error('rare-urls.txt is empty');
const rate = parseFloat(rateStr);
if (!(rate > 0 && rate < 1)) throw new Error('rate must be between 0 and 1');

// mulberry32 — seeded PRNG so assignments are reproducible with the same seed
let s = (seedStr ? parseInt(seedStr, 10) : 1337) >>> 0;
const rand = () => { s |= 0; s = (s + 0x6D2B79F5) | 0;
  let t = Math.imul(s ^ (s >>> 15), 1 | s);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

const assignments = [];
let ri = 0;
for (const item of m.items) {
  if (!Array.isArray(item.states) || item.states.length < 2) continue;
  if (rand() < rate) {
    const STAGE_IDX = item.states.length - 1;
    const rareUrl = rares[ri % rares.length]; ri++;
    assignments.push({ index: item.index, name: item.name, was: item.states[STAGE_IDX], now: rareUrl });
    item.states[STAGE_IDX] = rareUrl;
    item.traits = { ...(item.traits || {}), Evolution: 'Rare' };
  } else {
    item.traits = { ...(item.traits || {}), Evolution: 'Standard' };
  }
}
fs.writeFileSync('manifest-with-rares.json', JSON.stringify(m, null, 2));
fs.writeFileSync('rare-assignments.json', JSON.stringify(assignments, null, 2));
console.log(`rare evolved forms: ${assignments.length}/${m.items.length} items (${(assignments.length / m.items.length * 100).toFixed(1)}%)`);
console.log('wrote manifest-with-rares.json (+ rare-assignments.json — keep private)');
console.log('next: upload manifest-with-rares.json to Irys -> update_metadata (keep social params)');
