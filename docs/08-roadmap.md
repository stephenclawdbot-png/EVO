# 08 — Roadmap

## The Strategy

> **Ship the primitive and the art together. Value + visual expression, side by side.**

EVO is stateful capital — but it's also a collectible. Degens trade stories, and stories need expression. The art IS the story made visible. Build them together.

---

## Phase 1 — Primitive + Art + First Collection (NOW)

**Goal:** Launch "speculation with a floor" with full visual expression on mainnet.

### Program (DONE — live on mainnet)
- [x] Deploy EVO program to mainnet
- [x] Initialize protocol
- [x] 9 instructions working (forge, feed, list, buy, shatter, transfer, etc.)
- [x] Mint price + lock amount economic model
- [x] Fee destinations (Treasury/Creator/Burn/Split)

### Art System
- [ ] Define art parameter mapping (on-chain data → visual properties)
- [ ] Engage artist for visual identity
- [ ] Curate 10-20 color palettes
- [ ] Design facet geometry templates
- [ ] Design fracture line rendering
- [ ] Implement WebGL renderer
- [ ] Implement SVG renderer (for thumbnails/marketplace grid)
- [ ] Determinism tests (same data = same art)

### Frontend
- [x] Wallet adapter (Phantom, Solflare, Backpack)
- [ ] Wire frontend to real on-chain PDAs
- [ ] Forge page — mint an EVO with real SOL + see art
- [ ] EVO detail page — live art render, stats, floor, feed
- [ ] Marketplace page — browse, filter, buy (with art)
- [ ] Shatter interface — reclaim SOL
- [ ] Feed interface — add SOL to EVO, watch it grow

### Launch
- [ ] Create first collection on mainnet
- [ ] Public mint opens
- [ ] First trades happen
- [ ] First shatter happens (proves the floor works)

### Success Criteria
> A user can: forge an EVO with real SOL, see its generative art, see their floor, list it for sale, sell it to someone else, and the buyer can shatter it to reclaim SOL. The full cycle works with visuals.

---

## Phase 2 — Standard & Composability

**Goal:** Make EVO a primitive other developers can build on.

### EVO Standard Interface (ESI)
- [ ] Publish ESI spec
- [ ] Public SDK (read owner, value, floor, behavior type)
- [ ] CPI examples for other programs
- [ ] Documentation for developers

### Protocol Improvements
- [ ] Split listing state to separate PDA (marketplace-neutral)
- [ ] Split history to separate append-only PDA
- [ ] Reduce base EVO account to ~170 bytes
- [ ] Add behavior_type + behavior_params fields
- [ ] Add AuthorityState (owner + delegate minimum)

### Composability Demos
- [ ] Lending protocol integration (EVO as collateral)
- [ ] Independent marketplace integration
- [ ] One demo app built by someone else

---

## Phase 3 — Behaviors & Community

**Goal:** Let others build apps on the EVO interface.

### Behavior Apps (built by others)
- [ ] Vault — time-locked SOL (gift that unlocks on a date)
- [ ] Legacy — directed redemption (shatter routes to multiple wallets)
- [ ] Patron — creator gets a cut of feed, principal preserved
- [ ] Community-built behaviors we haven't thought of

### Ecosystem
- [ ] Multi-collection marketplace
- [ ] Collection analytics
- [ ] EVO explorer (browse all collections)
- [ ] Developer grants

### Governance
- [ ] Lock redemption kernel (immutable)
- [ ] Multisig for behavior layer upgrades
- [ ] Community proposals

---

## What We Explicitly DON'T Build Yet

| Thing | Why |
|------|-----|
| Behavior templates (Vault/Legacy/Patron) | These are apps, not protocol. Let others build them. |
| Custom DSL for behaviors | Too complex, too early. Config + templates first. |
| Cross-chain | Premature. Nail Solana first. |
| DAO governance | Earn the right to govern first. |

---

## Timeline (Estimates)

| Phase | Duration | Depends On |
|---|---|---|
| Phase 1 | 4-8 weeks | Artist engagement, frontend wiring |
| Phase 2 | 4-8 weeks | Phase 1 complete |
| Phase 3 | Ongoing | Ecosystem demand |

---

## Immediate Next Steps

1. **Engage an artist** — Define the visual identity (palettes, shapes, facet styles)
2. **Create first collection on mainnet** — test the full cycle with real SOL
3. **Wire frontend to real on-chain PDAs** — make buttons actually work
4. **Build the art renderer** — WebGL + SVG, deterministic from on-chain data
5. **Test forge → trade → shatter cycle** — prove the floor works
6. **Open public mint** — let people speculate with a floor

---

*Part of the [EVO documentation](../README.md)*
