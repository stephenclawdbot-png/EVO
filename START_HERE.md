# START HERE — Session Recovery Guide

> **If you lost context, read this first.** This file tells you everything you need to know to continue working on EVO.

---

## What Is EVO?

**EVO = Evolving Value Object** — a new on-chain primitive on Solana.

It's not a token. It's not an NFT. It's a Program Derived Account (PDA) that:
1. Holds locked SOL (store of value)
2. Generates evolving generative art (beauty driven by value + time)
3. Has a price floor (shatter to reclaim SOL)
4. Is trustless (no admin, no metadata, art is pure math from on-chain data)

**Crystals** is the first EVO collection — 2,000 evolving gemstones on Solana.

EVO is also a **protocol** — anyone can launch their own EVO collection on our program, and we earn protocol fees from every trade across all collections.

---

## Current Status

**Phase: Pre-build (documentation complete, code not started)**

### ✅ Done
- [x] Concept ideation and validation
- [x] Full documentation written and pushed to GitHub
- [x] EVO category named and defined
- [x] Competitive moat strategy defined
- [x] Protocol model designed (multi-collection)
- [x] Fee structure designed
- [x] Art system designed (hybrid: artist base + algorithmic dynamic layers)
- [x] Comparison with NFTs, tokens, mutable metadata NFTs
- [x] Roadmap created (4 phases)

### ⬜ Not Started
- [ ] Solana program (Rust/Anchor)
- [ ] Generative art renderer (WebGL + SVG)
- [ ] Frontend (Next.js + Solana wallet adapter)
- [ ] Artist engagement
- [ ] Deployment to mainnet

---

## Key Decisions Made

1. **Name:** EVO (Evolving Value Object) — the category name, like "NFT"
2. **First collection:** Crystals — 2,000 supply cap, hardcoded
3. **Mint model:** Mint empty (cheap ~0.05 SOL), then feed SOL over time
4. **Art system:** Hybrid — artist creates base/palettes, algorithm generates dynamic layers from on-chain data
5. **Trading:** Program-mediated (built-in marketplace, not external like Magic Eden)
6. **Protocol model:** Multi-collection — competitors launch on our program, we earn 1% protocol fee on all trades
7. **Trustless:** No admin, no update authority, no metadata. Art is deterministic from on-chain state.
8. **Supply dynamics:** 2,000 max, decreases over time as people shatter crystals
9. **Not an NFT:** No SPL token, no Metaplex, no metadata URI. Custom PDA only.

---

## Repository Structure

```
EVO/
├── README.md              — Overview (start here for the pitch)
├── START_HERE.md          — THIS FILE (session recovery)
├── docs/
│   ├── 01-concept.md      — What EVOs are, why they're new
│   ├── 02-mechanics.md    — Forge → Feed → Grow → Trade → Shatter lifecycle
│   ├── 03-art-system.md   — Hybrid art model, rendering, rarity
│   ├── 04-economics.md    — Fees, pricing, treasury, protocol revenue
│   ├── 05-protocol.md     — Multi-collection protocol model
│   ├── 06-competitive-moat.md — Why copying can't beat us
│   ├── 07-comparison.md   — EVO vs tokens, NFTs, mutable metadata NFTs
│   └── 08-roadmap.md      — 4 phases, next steps
└── (code coming soon)
    ├── program/           — Solana program (Rust/Anchor)
    ├── renderer/          — Art renderer (TypeScript/WebGL)
    └── frontend/          — Next.js app
```

---

## How to Continue

### If starting a new session:
1. Read this file (`START_HERE.md`)
2. Read `docs/02-mechanics.md` for the lifecycle
3. Read `docs/04-economics.md` for the fee structure
4. Read `docs/05-protocol.md` for the multi-collection model
5. Check git log for latest changes
6. Continue from "Not Started" section above

### What to build next:
1. **Solana program** (Rust/Anchor) — forge, feed, grow, trade, shatter instructions
2. **Art renderer** — deterministic WebGL + SVG from on-chain data
3. **Frontend** — Next.js with wallet adapter, forge/feed/trade/shatter UI

### Key technical details:
- Program needs: ProtocolConfig, CollectionConfig, CrystalAccount (PDA) structs
- PDA seeds: `[collection_id, crystal_index]` or `[collection_id, owner, nonce]`
- Facet count computed from `forged_at` timestamp (no on-chain update needed)
- Fracture lines stored as Vec in PDA (or separate account if too large)
- Fee splits: 1% protocol + 1% collection on trades, 1% protocol on shatters
- 2,000 supply cap hardcoded in program
- Upgrade authority revoked after deployment

---

## User Context

- **GitHub:** stephenclawdbot-png
- **Repo:** https://github.com/stephenclawdbot-png/EVO
- **Local path:** C:\Users\napol\EVO
- **OS:** Windows (use backslash paths)
- **Other repos:** stack (https://github.com/stephenclawdbot-png/stack) — AI agent commerce framework (parked)
- **Prior work:** zenko-dev (Solana game, parked), pons.family audit (completed), meowdot.fun (parked)

---

## Quick Pitch (for reference)

> *"NFTs were static art. EVOs are living art backed by real value. Crystals is the first EVO collection — 2,000 evolving gemstones on Solana, each one growing more beautiful as you feed it SOL. And EVO is a protocol — anyone can launch their own EVO collection, and we earn fees from every trade across the entire ecosystem."*

---

*Last updated: July 16, 2026*