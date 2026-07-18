# 11 — Hybrid Art System

> NFT addicts get unique pre-drawn art + traits + rarity. EVO enthusiasts get evolution + generative effects. Both, together.

---

## The Problem

Traditional NFT collectors expect:
- Unique art per token (10k unique images)
- Trait-based rarity (hat, eyes, background, etc.)
- Pre-reveal → reveal → evolve lifecycle

EVO's generative-only model (art computed from on-chain data, no images) doesn't satisfy collectors who want unique, ownable, display-able art. But pure traditional NFTs don't evolve or respond to on-chain activity.

## The Solution: Hybrid Art

Each EVO gets **its own unique pre-drawn art** that **changes through lifecycle states**, with **generative effects layered on top** from on-chain data.

```
EVO #0001, State 1 (pre-reveal)  →  unique mystery image
EVO #0001, State 2 (base)       →  unique base art with traits
EVO #0001, State 3 (final)      →  unique evolved art

EVO #0002, State 1              →  different mystery image
EVO #0002, State 2              →  different base art
EVO #0002, State 3              →  different final art
```

### Three Layers

**Layer 1: Unique Pre-Drawn Art (Static, per-EVO)**
- Creator provides 10,000 unique images per state
- 3 states = 30,000 images total
- Stored on Arweave (permanent, ~$3-5 total)
- Each EVO has a `mintIndex` that maps to its specific image set

**Layer 2: Generative Effects (Dynamic, per-EVO)**
- Applied on top of the unique art, client-side
- Size scaling based on `locked_lamports`
- Color/glow intensity based on `is_listed`
- Crack/fracture lines based on `trade_count`
- Color palette shift based on `resonance_seed`
- Facet complexity based on age (`forged_at`)

**Layer 3: Real-Time Effects (Cosmetic, client-side)**
- Listed EVOs pulse softly
- Recently fed EVOs flash briefly
- Subtle shimmer/breathing animation

## On-Chain Architecture (No Protocol Changes)

The existing EVO protocol already supports this model:

```
Collection account:
  - metadataUri    → points to manifest JSON on Arweave
  - manifestRoot   → Merkle root for verification
  - maxStates      → number of lifecycle states (e.g., 3)

EVO account:
  - mintIndex      → which EVO number (0-9999)
  - currentState   → which state (0, 1, 2)
```

### Manifest JSON Structure

```json
{
  "name": "My Collection",
  "description": "10k evolving EVOs",
  "image": "arweave://txId_state0_index0",
  "lifecycle": {
    "maxStates": 3,
    "stateNames": ["pre-reveal", "base", "final"]
  },
  "items": [
    {
      "index": 0,
      "name": "EVO #0001",
      "traits": { "background": "void", "body": "crystal", "rarity": "legendary" },
      "states": [
        "arweave://txId_0_0",
        "arweave://txId_0_1",
        "arweave://txId_0_2"
      ]
    },
    {
      "index": 1,
      "name": "EVO #0002",
      "traits": { "background": "fire", "body": "stone", "rarity": "rare" },
      "states": [
        "arweave://txId_1_0",
        "arweave://txId_1_1",
        "arweave://txId_1_2"
      ]
    }
  ]
}
```

### Rendering Flow

1. Fetch manifest JSON from `collection.metadataUri`
2. For a given EVO, look up `items[mintIndex]`
3. Get `items[mintIndex].states[currentState]` → Arweave URI
4. Display the unique image
5. Apply generative effects (Layer 2) on top via canvas/CSS
6. Apply real-time effects (Layer 3) via CSS animation

### Merkle Root Verification

- Each item's states array is hashed (SHA-256)
- Leaves = hash of each item's state URIs
- Merkle root computed over all 10,000 leaves
- Stored on-chain as `manifestRoot`
- Allows trustless verification that a given image belongs to the collection

## Storage: Arweave via Irys

### Why Arweave (not IPFS/Pinata)

| | Pinata free | Arweave (Irys) |
|---|---|---|
| 30k files | 300 days @ 100/day | Minutes |
| Cost | Free (but too slow) | ~$3-5 |
| Permanence | While account active | Permanent (200+ years) |
| Best for | Small collections | Production scale |

### Upload Flow

1. Creator connects Solana wallet
2. Drags 3 folders (or ZIPs) of 10k images each
3. App uploads each image to Arweave via Irys
   - Uses `@irys/sdk` with creator's wallet for signing
   - Pays in SOL (~$3-5 total for 30k images)
   - Returns `arweave://<txId>` URIs
4. App builds manifest JSON with all URIs + traits
5. App uploads manifest JSON to Arweave
6. App computes Merkle root from manifest items
7. App fills create form: `metadataUri` + `manifestRoot`
8. Creator clicks "Create Collection" → on-chain tx

### Cost Breakdown (10k collection, 3 states)

- 30,000 images × ~100KB avg = ~3GB
- Arweave cost: ~$0.000001 per byte ≈ **$3-5 total**
- 1 manifest JSON (~5MB) ≈ $0.005
- Solana on-chain tx ≈ 0.001 SOL

## Creator Experience

```
1. Connect wallet
2. Drag 3 folders of images (or ZIPs)
   - "Pre-reveal images" (10k files)
   - "Base images" (10k files)
   - "Final images" (10k files)
3. See cost estimate: "~$5 in SOL for Arweave storage"
4. Click "Upload to Arweave"
   - Progress bar: uploading 30,000 images...
   - Building manifest...
   - Computing Merkle root...
5. Form auto-filled with manifest URI + Merkle root
6. Set economics (mint price, lock amount, fees)
7. Click "Create Collection"
8. Done — each EVO has unique, evolving art
```

## Two Art Modes

The create form offers two modes:

### Upload Images Mode (this document)
- Creator provides pre-drawn art
- 3 sub-modes:
  - **Bulk**: 10k+ images per state (traditional NFT style)
  - **Shared**: 1 image per state (all EVOs share same art)
  - **ZIP/Folder**: drag a structured folder/ZIP

### Generative Mode
- No images uploaded
- Art computed from on-chain data
- 0 storage cost
- Every EVO looks unique via algorithm

## Implementation Status

- [ ] Arweave upload pipeline (`arweave-upload.ts`)
- [ ] Bulk upload UI (`BulkArtworkUploader.tsx`)
- [ ] Manifest builder for 10k+ entries
- [ ] Collection page per-EVO image rendering
- [ ] Generative effects overlay on EvoCard
- [ ] Merkle root verification

## Packages

- `@irys/sdk` — Arweave uploads via Irys, pays with SOL
- `fflate` — client-side ZIP extraction (for folder/ZIP uploads)
- `multiformats` — IPFS CID computation (already installed)