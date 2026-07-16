# 03 — Art System

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
| `locked_lamports` | Total SOL fed | Crystal size (bigger = more SOL) |
| `forged_at` | Timestamp at creation | Age → facet count → intricacy |
| `facet_count` | Derived from age | Number of geometric facets |
| `trade_count` | Number of trades | Number of fracture lines |
| `resonance_seed` | Hash of forge tx | Base color palette + shape tendency |
| `fracture_lines` | Trade history | Visible cracks/marks on crystal surface |
| `is_listed` | Whether for sale | Glow indicator (listed crystals pulse) |

---

## The Hybrid Art Model

We use a **hybrid approach** — artist-designed base + algorithmically generated dynamic layers:

### Layer 1: Artist-Defined Base (Static)
- The artist designs the **base crystal shape** and **rendering style**
- The artist defines **color palettes** mapped to resonance seed ranges
- The artist creates the **facet geometry templates** (how facets look at each level)
- The artist sets the **fracture line style** (how cracks appear)
- This is the visual identity of the collection — the brand

### Layer 2: Algorithmically Generated (Dynamic)
- The algorithm places facets based on `facet_count` and `resonance_seed`
- The algorithm colors the crystal based on `resonance_seed` → palette mapping
- The algorithm sizes the crystal based on `locked_lamports`
- The algorithm draws fracture lines based on `fracture_lines` data
- The algorithm adds inner glow based on total value × time multiplier
- This is what makes each crystal unique and evolving

### Layer 3: Real-Time Effects (Client-side)
- Listed crystals pulse softly
- Newly fed crystals flash briefly
- Facets shimmer subtly (ambient animation)
- Inner glow breathes slowly
- These are purely cosmetic — they don't affect the on-chain data

---

## Visual Progression

A crystal's appearance changes dramatically over its lifecycle:

### Just Forged (0 SOL, 0 facets)
```
- Tiny, rough shard
- Single muted color
- No facets, no glow
- Raw, unpolished appearance
```

### Fed 1 SOL, 2 weeks old (2 facets)
```
- Small crystal, starting to take shape
- Color palette emerging
- 2 visible facets catching light
- Faint inner glow beginning
```

### Fed 10 SOL, 6 months old (26 facets)
```
- Medium-large crystal
- Rich, saturated colors
- 26 intricate facets refracting light
- Strong inner glow
- Complex geometry visible
```

### Fed 50 SOL, 2 years old, traded 5 times
```
- Large, magnificent crystal
- Deep, layered color palette
- 100+ facets (capped) — extremely intricate
- 5 visible fracture lines telling its trade history
- Powerful inner glow
- Legendary appearance
```

---

## Rendering Options

| Method | Pros | Cons |
|---|---|---|
| **SVG** | Crisp at any size, lightweight, inspectable | Limited effects (no shaders) |
| **Canvas 2D** | Good performance, widely supported | No 3D, limited shaders |
| **WebGL** | Best visuals, shaders, 3D effects, glow | Heavier, needs GPU |

**Recommended: WebGL with SVG fallback.**
- WebGL for the full experience (shaders for refraction, glow, fractures)
- SVG for thumbnails and marketplace grid views (fast, crisp)
- Same deterministic algorithm, different render targets

---

## Determinism Guarantee

The art must be **perfectly deterministic:**

```
function renderCrystal(onChainData) → Image {
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
- No time-based randomness (time is read from on-chain `forged_at`, not `Date.now()`)
- Every viewer sees the exact same crystal for the same on-chain state

---

## Rarity System

Rarity emerges naturally from the data:

| Rarity Factor | How It's Determined | Why It's Rare |
|---|---|---|
| Color palette | Resonance seed hash | Some palettes are rarer (e.g., 5% chance for "Aurora") |
| Shape tendency | Resonance seed hash | Some shapes are rarer (e.g., elongated vs round) |
| Size | Total SOL fed | Big crystals require real money |
| Facet count | Time held | Old crystals are rare (many were shattered) |
| Fracture patterns | Trade history | Unique to each crystal's journey |
| Clean crystals | Never traded | Pristine crystals become rare as trading happens |
| Legendary crystals | Oldest + largest + most-traded | The intersection is extremely rare |

**Rarity is not forced — it emerges from behavior.** This is fundamentally different from NFT rarity (where traits are assigned at mint). EVO rarity is earned through time, value, and trading.

---

## Artist's Role

The artist is responsible for:

1. **Visual identity** — The overall aesthetic (dark, luminous, geometric)
2. **Color palettes** — 10-20 curated palettes mapped to resonance seeds
3. **Facet geometry** — How facets look at each level (0-100)
4. **Fracture line style** — How trade marks appear
5. **Glow and lighting** — How the crystal catches light
6. **Base shapes** — Crystal morphology variations

The artist does NOT:
- Draw individual crystals (the algorithm does that)
- Choose which crystal gets which palette (the resonance seed does that)
- Manually update any art (the on-chain data does that)
- Have any "update authority" (nobody does)

The artist builds the **visual language.** The algorithm speaks it. The on-chain data provides the words.

---

*Part of the [EVO documentation](../README.md)*