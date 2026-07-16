# 08 — Roadmap

## Phase 1 — Core Protocol & Z Collection

**Goal:** Launch the EVO program + Z collection + basic frontend.

### Solana Program
- [ ] `create_collection` — Initialize a new EVO collection (Z first)
- [ ] `forge` — Mint empty z PDA, generate resonance seed
- [ ] `feed` — Deposit SOL into existing z
- [ ] `grow` — Snapshot facet count (optimization, or compute on-the-fly)
- [ ] `list` — Owner sets sale price
- [ ] `delist` — Owner removes listing
- [ ] `buy` — Pay price, transfer ownership, record fracture line
- [ ] `shatter` — Reclaim locked SOL, close PDA
- [ ] Protocol fee distribution on all actions
- [ ] 2,000 supply cap enforcement
- [ ] Upgrade authority revoked after deployment

### Generative Art
- [ ] Define art parameter mapping (on-chain data → visual properties)
- [ ] Curate 10-20 color palettes
- [ ] Design facet geometry templates (0-100 facets)
- [ ] Design fracture line rendering
- [ ] Implement WebGL renderer
- [ ] Implement SVG renderer (for thumbnails/marketplace grid)
- [ ] Determinism tests (same data = same art)

### Frontend
- [ ] Next.js + Solana wallet adapter (Phantom, Solflare, Backpack)
- [ ] Forge page (mint empty z)
- [ ] z page (live art render, stats, feed button)
- [ ] Marketplace page (browse, filter, buy)
- [ ] Feed interface (deposit SOL into z)
- [ ] Shatter interface (reclaim SOL)
- [ ] Wallet integration (view your Z)

### Launch
- [ ] Deploy program to Solana mainnet
- [ ] Create Z collection (2000 cap)
- [ ] Revoke upgrade authority
- [ ] Public mint opens
- [ ] Announcement + marketing

---

## Phase 2 — Marketplace & Social

**Goal:** Full trading experience + social features.

### Marketplace
- [ ] Order book / listing UI with filters
- [ ] Rarity scoring system
- [ ] Price history charts per z
- [ ] Collection-wide statistics (total locked SOL, supply, etc.)
- [ ] Featured Z (legendary, high-value, rare)

### Social
- [ ] z lineage — trace all previous owners
- [ ] Legendary Z page (oldest, most-traded, largest)
- [ ] Community challenges (forge + hold 365 days, trade 10x, etc.)
- [ ] z profiles (each z gets a page with full history)
- [ ] Owner profiles (show off your collection)

---

## Phase 3 — Protocol Expansion

**Goal:** Open EVO to other collections.

### Multi-Collection
- [ ] `create_collection` live for anyone
- [ ] Collection configuration UI
- [ ] Shared marketplace (browse all EVO collections)
- [ ] Per-collection pages
- [ ] Collection analytics dashboard

### Ecosystem
- [ ] EVO SDK (JavaScript/TypeScript for other developers)
- [ ] Art template system (artists can define palettes/shapes for their collection)
- [ ] Documentation for collection creators
- [ ] Grants program for notable EVO collections

---

## Phase 4 — Advanced Features

**Goal:** Push the boundaries of what EVOs can do.

### z Mechanics
- [ ] z splitting (break one into two smaller ones)
- [ ] z merging (combine two into one larger)
- [ ] z lending (rent your z's art for a fee)
- [ ] z gifting (transfer without payment)

### DeFi Integration
- [ ] EVO as collateral (borrow against locked SOL)
- [ ] EVO fractionalization (split a z into tradeable shares)
- [ ] EVO index (basket of Z as a single tradeable position)

### Cross-Chain
- [ ] EVO recognition on Ethereum (read Solana state, render art)
- [ ] EVO on Base (native deployment)
- [ ] Cross-chain trading (buy on one chain, hold on another)

### Governance
- [ ] Protocol DAO
- [ ] Treasury governance
- [ ] Fee adjustment via governance
- [ ] Community grants program

---

## Timeline (Estimates)

| Phase | Duration | Depends On |
|---|---|---|
| Phase 1 | 4-8 weeks | Artist engagement, Solana dev |
| Phase 2 | 4-6 weeks | Phase 1 complete |
| Phase 3 | 6-10 weeks | Phase 2 complete, ecosystem demand |
| Phase 4 | Ongoing | Community needs, market conditions |

---

## Immediate Next Steps

1. **Engage an artist** — Define the visual identity (palettes, shapes, facet styles)
2. **Build the Solana program** — forge, feed, grow, trade, shatter
3. **Build the art renderer** — WebGL + SVG, deterministic from on-chain data
4. **Build the frontend** — Forge, view, feed, trade, shatter
5. **Deploy + launch** — Mainnet, revoke authority, open mint

---

*Part of the [EVO documentation](../README.md)*