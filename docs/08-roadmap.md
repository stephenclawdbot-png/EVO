# 08 — Roadmap

## The Strategy

> **Prove the value first. Add art last.**

The biggest risk identified by the team: "EVO is more advanced economically than programmatically." The fix: prove the primitive works — people can mint, trade, and shatter with real SOL and a real floor — before adding any visual/art layer.

---

## Phase 1 — Primitive + First Collection (NOW)

**Goal:** Prove "speculation with a floor" works on mainnet.

### Program (DONE — live on mainnet)
- [x] Deploy EVO program to mainnet
- [x] Initialize protocol
- [x] 9 instructions working (forge, feed, list, buy, shatter, transfer, etc.)
- [x] Mint price + lock amount economic model
- [x] Fee destinations (Treasury/Creator/Burn/Split)

### Frontend
- [x] Wallet adapter (Phantom, Solflare, Backpack)
- [ ] Wire frontend to real on-chain PDAs
- [ ] Forge page — mint an EVO with real SOL
- [ ] EVO detail page — show locked SOL, floor, premium
- [ ] Marketplace page — browse, list, buy
- [ ] Shatter interface — reclaim SOL
- [ ] Feed interface — add SOL to EVO

### Launch
- [ ] Create first collection on mainnet
- [ ] Public mint opens
- [ ] First trades happen
- [ ] First shatter happens (proves the floor works)

### Success Criteria
> A user can: forge an EVO with real SOL, see their floor, list it for sale, sell it to someone else, and the buyer can shatter it to reclaim SOL. The full cycle works.

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

### Behavior Apps (built by others, not us)
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

## Phase 4 — Media & Art (LAST)

**Goal:** Add visual expression to the stateful capital primitive.

### Art System
- [ ] Define art parameter mapping (on-chain data → visuals)
- [ ] Artist engagement for visual identity
- [ ] Color palettes, shapes, facet styles
- [ ] WebGL renderer (full experience)
- [ ] SVG renderer (thumbnails)

### Pre-made Art Support
- [ ] Arweave integration (image_ref + image_hash)
- [ ] Merkle validation for approved seeds
- [ ] Creator dashboard for uploading art

### Advanced
- [ ] Generative rendering from resonance_seed
- [ ] Evolution overlays (fracture lines, facet growth)
- [ ] Multiple rendering frontends
- [ ] Wallet integration (show EVO art in Phantom/Solflare)

---

## What We Explicitly DON'T Build Yet

| Thing | Why |
|------|-----|
| Behavior templates (Vault/Legacy/Patron) | These are apps, not protocol. Let others build them. |
| Custom DSL for behaviors | Too complex, too early. Config + templates first. |
| Art/media | Last priority. Prove value first. |
| Cross-chain | Premature. Nail Solana first. |
| DAO governance | Earn the right to govern first. |

---

## Timeline (Estimates)

| Phase | Duration | Depends On |
|---|---|---|
| Phase 1 | 2-4 weeks | Frontend wiring |
| Phase 2 | 4-8 weeks | Phase 1 complete |
| Phase 3 | Ongoing | Ecosystem demand |
| Phase 4 | 4-8 weeks | After primitive is proven |

---

## Immediate Next Steps

1. **Create first collection on mainnet** — test the full cycle with real SOL
2. **Wire frontend to real on-chain PDAs** — make buttons actually work
3. **Test forge → trade → shatter cycle** — prove the floor works
4. **Open public mint** — let people speculate with a floor
5. **Publish SDK** — let developers read EVO state

---

*Part of the [EVO documentation](../README.md)*
