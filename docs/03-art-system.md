# 03 — Art System (Future, Not Priority)

> ⚠️ Art is the LAST priority. The primitive works without any media.
> Prove the value first. Add art later.

---

## Why Art Is Last

The team's strategic review identified a critical risk:

> "EVO is more advanced economically than programmatically. You have the value container. You now need to prove the programmable value part."

Art pulls EVO back toward NFT comparisons. The primitive is **stateful capital** — SOL that carries state. Art is one possible expression of that state, not the reason it exists.

Build the value primitive first. Let people trade stories with a floor. Then add visual expression.

---

## How Art Works (When We Build It)

EVO art is **not stored** anywhere. There is no image file, no IPFS pin, no Arweave upload. The art is **computed** from on-chain data, client-side, every time it's viewed.

```
On-chain data → Deterministic algorithm → Rendered art
```

Same data = same art. Always. For everyone.

### Art Parameters (From On-Chain Data)

| Parameter | Source | Visual Effect |
|---|---|---|
| `locked_lamports` | Total SOL inside | Size (more SOL = bigger) |
| `forged_at` | Timestamp at creation | Age → intricacy |
| `trade_count` | Number of trades | Fracture lines |
| `resonance_seed` | Provided at forge | Color palette + shape |
| `fracture_lines` | Trade history | Visible marks of provenance |

### Hybrid Model

- **Layer 1 (Static):** Artist defines base shapes, color palettes, fracture styles
- **Layer 2 (Dynamic):** Algorithm generates unique art from on-chain state
- **Layer 3 (Real-time):** Client-side effects (glow, shimmer)

### Determinism

No `Math.random()` in the render path. No external API calls. Same input = same output, every time, for every viewer.

### Pre-made Art Support (Future)

For creators with pre-made collections:
- `image_ref` — Arweave/IPFS URI stored on-chain
- `image_hash` — hash to verify integrity
- `merkle_root` — optional Merkle validation for approved seeds

This is a **future enhancement**, not part of the core primitive.

---

## Rarity (When Art Exists)

Rarity emerges from behavior, not from assigned traits:

| Factor | Why It's Rare |
|---|---|
| Age | Old EVOs can't be faked. Many were shattered. |
| Size | Big EVOs require real SOL locked. |
| Provenance | Rich trade history = storied object |
| Clean (never traded) | Pristine EVOs become rare as trading happens |
| Creator reputation | First edition from a known creator |
| Supply decrease | Shattering makes survivors more scarce |

Rarity is earned through time, value, and trading — not assigned at mint.

---

## Rendering (Future)

| Method | Use Case |
|---|---|
| SVG | Thumbnails, marketplace grid (lightweight) |
| Canvas 2D | Good performance, widely supported |
| WebGL | Best visuals, shaders, 3D effects |

Recommended: WebGL for full experience, SVG for thumbnails.

---

*Part of the [EVO documentation](../README.md)*
