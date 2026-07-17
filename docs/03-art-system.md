# 03 — Art System

> Art is part of EVO from the start. The value primitive and the visual expression ship together.

---

## How EVO Art Works

EVO art is **not stored** anywhere. There is no image file, no IPFS pin, no Arweave upload. The art is **computed** from on-chain data, client-side, every time it's viewed.

```
On-chain data → Deterministic algorithm → Rendered art
```

Same data = same art. Always. For everyone. No human intervention possible.

---

## Art Parameters (From On-Chain Data)

| Parameter | Source | Visual Effect |
|---|---|---|
| `locked_lamports` | Total SOL inside | Size (more SOL = bigger) |
| `forged_at` | Timestamp at creation | Age → intricacy |
| `facet_count` | Derived from age | Number of geometric facets |
| `trade_count` | Number of trades | Fracture lines |
| `resonance_seed` | Provided at forge | Color palette + shape tendency |
| `fracture_lines` | Trade history | Visible cracks/marks of provenance |
| `is_listed` | Whether for sale | Glow indicator (listed EVOs pulse) |

---

## The Hybrid Art Model

### Layer 1: Artist-Defined Base (Static)
- Artist designs the **base shape** and **rendering style**
- Artist defines **color palettes** mapped to resonance seed ranges
- Artist creates **facet geometry templates**
- Artist sets **fracture line style**
- This is the visual identity of the collection — the brand

### Layer 2: Algorithmically Generated (Dynamic)
- Algorithm places facets based on `facet_count` and `resonance_seed`
- Algorithm colors based on `resonance_seed` → palette mapping
- Algorithm sizes based on `locked_lamports`
- Algorithm draws fracture lines based on `fracture_lines` data
- Algorithm adds inner glow based on total value × time multiplier

### Layer 3: Real-Time Effects (Client-side)
- Listed EVOs pulse softly
- Newly fed EVOs flash briefly
- Facets shimmer subtly (ambient animation)
- Inner glow breathes slowly
- Purely cosmetic — don't affect on-chain data

---

## Visual Progression

A EVO's appearance changes dramatically over its lifecycle:

### Just Forged (small SOL, 0 facets)
```
- Tiny, rough shard
- Single muted color
- No facets, no glow
- Raw, unpolished appearance
```

### Fed more SOL, weeks old
```
- Starting to take shape
- Color palette emerging
- Facets catching light
- Faint inner glow beginning
```

### Fed significant SOL, months old
```
- Medium-large size
- Rich, saturated colors
- Many intricate facets refracting light
- Strong inner glow
```

### Old, large, traded many times
```
- Large, magnificent
- Deep, layered color palette
- Maximum facets — extremely intricate
- Visible fracture lines telling its trade history
- Powerful inner glow
- Legendary appearance
```

---

## Rendering

| Method | Pros | Cons |
|---|---|---|
| **SVG** | Crisp at any size, lightweight | Limited effects |
| **Canvas 2D** | Good performance, widely supported | No 3D, limited shaders |
| **WebGL** | Best visuals, shaders, 3D effects | Heavier, needs GPU |

**Recommended: WebGL with SVG fallback.**
- WebGL for the full experience (refraction, glow, fractures)
- SVG for thumbnails and marketplace grid views (fast, crisp)

---

## Determinism Guarantee

```javascript
function renderEvo(onChainData) → Image {
  // Pure function — no randomness, no external calls
  // Same input = same output, every time

  size = map(locked_lamports, 0, MAX_SOL, MIN_SIZE, MAX_SIZE)
  facets = min(facet_count, MAX_FACETS)
  palette = palettes[resonance_seed % NUM_PALETTES]
  fractures = fracture_lines.map(fl => drawFracture(fl))
  glow = map(locked_lamports * age, 0, MAX_GLOW, 0, 1)

  return render(size, facets, palette, fractures, glow)
}
```

- No `Math.random()` anywhere in the render path
- No external API calls
- Same on-chain state = same art, every viewer, every time

---

## Pre-made Art Support

For creators with pre-made collections (e.g., 1000 images):
- `image_ref` — Arweave/IPFS URI stored on-chain
- `image_hash` — hash to verify integrity
- `merkle_root` — optional Merkle validation for approved seeds

Creators can use generative art (computed from resonance_seed) OR pre-made art (referenced on-chain). Both work.

---

## Visual Lifecycle (Protocol-Native)

EVO supports protocol-native visual lifecycles. The collection creator chooses one lifecycle type at creation. Every individual EVO asset stores its own `current_stage` on-chain, and the program enforces valid stage transitions.

### Lifecycle Types

| Type | Stages | Transitions | Source of Truth |
|---|---|---|---|
| `Static` | 1 (stage 0) | None — always stage 0 | Program |
| `Reveal` | 2 (0→1) | `reveal_collection()` moves 0→1 | `is_revealed` flag |
| `CommitReveal` | 2 (0→1) | `commit_reveal()` then `reveal_collection()` | `is_revealed` flag + commitment hash |
| `RevealAndEvolve` | N (0→max) | `reveal_collection()` then `evolve()` | `current_stage` field |
| `Custom` | N (0→max) | `set_visual_stage()` by authority | `current_stage` field |

### How It Works

```
Collection (on-chain)
  ├─ lifecycle_type: u8
  ├─ max_states: u16
  ├─ artwork_manifest_uri: metadata_uri (existing field)
  ├─ artwork_manifest_hash: [u8;32] (integrity check)
  └─ reveal_authority: Pubkey

EVO Asset (on-chain)
  ├─ current_state: u16 (per-asset visual stage)
  └─ last_transition_at: i64 (timestamp)

Manifest (off-chain JSON)
  └─ stages: [{ id, name, image }]
```

### Resolution Flow

1. Read `lifecycle_type` and `current_state`/`is_revealed` from on-chain accounts
2. Fetch the artwork manifest from `metadata_uri`
3. Verify manifest hash matches `artwork_manifest_hash` (if non-zero)
4. Resolve the active stage using protocol state:
   - Static → always stage 0
   - Reveal/CommitReveal → `is_revealed ? 1 : 0`
   - RevealAndEvolve/Custom → `current_state`
5. Display the image for the resolved stage

The marketplace never decides the stage — it only reads what the program says. This makes visual state verifiable, tamper-proof, and consistent across all marketplaces and wallets.

### Commit-Reveal for Provably Fair Reveal

For `CommitReveal` lifecycle, the creator commits `keccak256(secret)` before minting begins. After all mints complete, the creator reveals the secret. The program verifies it matches the commitment, then uses it as entropy for the reveal.

This prevents the creator from trying different entropy values to find a favorable outcome after seeing who owns which mint index.

### Permissionless Evolution

For `RevealAndEvolve`, evolution is permissionless — anyone can call `evolve()` on an EVO that meets the evolution thresholds. Thresholds are configurable:

- **Trade trigger:** EVO has been traded N times
- **Feed trigger:** EVO has been fed N times
- **Hold trigger:** EVO has existed for N seconds
- **Locked value trigger:** EVO has ≥ N lamports locked

This means evolution can happen automatically as EVOs are used, traded, and fed — without requiring the creator to manually advance each one.

### Authority Override for Custom

For `Custom` lifecycle, the collection's `reveal_authority` can call `set_visual_stage()` to set any stage 0..max_states-1. This gives creators full manual control when they want it, while the program still enforces bounds and authorization.

---

## Rarity System

Rarity emerges from behavior, not from assigned traits:

| Factor | How It's Determined | Why It's Rare |
|---|---|---|
| Color palette | Resonance seed hash | Some palettes are rarer |
| Shape tendency | Resonance seed hash | Some shapes are rarer |
| Size | Total SOL locked | Big EVOs require real money |
| Facet count | Time held | Old EVOs are scarce (many shattered) |
| Fracture patterns | Trade history | Unique to each EVO's journey |
| Clean (never traded) | No fracture lines | Pristine EVOs become rare |
| Legendary | Oldest + largest + most-traded | Extremely rare intersection |

**Rarity is not forced — it emerges from behavior.** This is fundamentally different from NFT rarity (where traits are assigned at mint). EVO rarity is earned through time, value, and trading.

---

## Artist's Role

The artist is responsible for:
1. **Visual identity** — The overall aesthetic
2. **Color palettes** — 10-20 curated palettes mapped to resonance seeds
3. **Facet geometry** — How facets look at each level
4. **Fracture line style** — How trade marks appear
5. **Glow and lighting** — How the EVO catches light
6. **Base shapes** — Morphology variations

The artist does NOT:
- Draw individual EVOs (the algorithm does that)
- Choose which EVO gets which palette (the resonance seed does that)
- Manually update any art (the on-chain data does that)
- Have any "update authority" (nobody does)

The artist builds the **visual language.** The algorithm speaks it. The on-chain data provides the words.

---

*Part of the [EVO documentation](../README.md)*
