# MELD Terminal Whitepaper

> The consumer terminal for EVO. Where stateful capital meets the market.

Version 1.0
Authors: naps (@naps000), admiralfinest (@admiralfinest), Benedict A.

---

## 1. Introduction

MELD is the terminal for EVO. It is the place where you discover collections, mint EVOs, trade them, feed them, evolve them, and shatter them. Think of it as the marketplace and gallery for the EVO protocol.

The EVO protocol is the infrastructure. It is the Solana program that holds locked SOL, enforces floors, and manages visual states. MELD is the product. It is the interface that makes EVO accessible to humans.

This is the same relationship as Uniswap to ERC-20 tokens, or OpenSea to NFTs, or Pump.fun to memecoins. The protocol is the rails. The terminal is the experience.

---

## 2. Why MELD Exists

The EVO protocol is permissionless. Anyone can create collections and forge EVOs by calling the program directly. But most people do not want to interact with a Solana program directly. They want a UI. They want to see the art, browse collections, click buttons, and manage their assets visually.

MELD provides that experience. Without a terminal, EVO is infrastructure that only developers can use. With MELD, EVO is a product that anyone can use.

### The Problem With Existing Marketplaces

Existing NFT marketplaces (Magic Eden, Tensor, OpenSea) are built for pointer-based assets. They display images from IPFS, read metadata from Metaplex, and facilitate trades. They do not understand floors, feeding, shattering, or evolution. They cannot render EVOs because EVO's hybrid art system (on-chain stage state plus IPFS/Arweave manifest) is not compatible with their rendering pipeline.

MELD is built specifically for EVO. It reads on-chain visual state, renders art from the protocol data, and exposes all EVO operations (forge, feed, list, buy, shatter, evolve, transfer) through a clean interface.

---

## 3. What MELD Does

### 3.1 Discovery

Browse EVO collections. See new drops, trending collections, and featured projects. Each collection page shows the supply cap, minted count, floor price, and lifecycle type. You can see how many EVOs have been shattered (supply burn) and how the collection has evolved over time.

### 3.2 Minting

Mint new EVOs directly from the terminal. The interface shows the mint price, the lock amount (your floor), and the total cost. You connect your wallet, click mint, and the EVO is yours. The locked SOL is inside the PDA. Your floor is set.

### 3.3 Trading

The EVO protocol has a built-in marketplace. MELD is the frontend for it. You can list your EVOs for sale, browse listings, and buy EVOs from other users. The protocol handles the trade, the royalty, and the ownership transfer. MELD just shows it to you.

No external marketplace. No escrow. No third party. The trade happens in the EVO program. MELD reads the state and displays it.

### 3.4 Feeding

Feed your EVOs more SOL to raise their floor. The terminal shows your current floor and lets you add SOL with a click. The fed SOL goes into the PDA. The floor goes up. The art gets bigger. This is unique to EVO and MELD is the only place to do it visually.

### 3.5 Evolution

For RevealAndEvolve collections, MELD shows the current visual stage and the evolution progress. You can see what stage your EVO is at, what the next stage looks like, and whether the evolution conditions are met. When you are ready, click evolve and the stage advances.

### 3.6 Shattering

Shatter your EVO to reclaim the locked SOL. The terminal shows the redeemable amount (locked SOL minus shatter fee) and a clear warning that the EVO will be destroyed. Click shatter, the SOL goes to your wallet, the EVO is gone.

### 3.7 Portfolio

Track all your EVOs in one place. See their floors, visual stages, trade histories, and current market values. Watch your portfolio evolve over time as you feed, trade, and evolve.

---

## 4. The Visual Layer

No external image hosting dependency for the protocol itself. The protocol stores the stage on-chain. Images are resolved from the metadata_uri manifest (IPFS or Arweave). MELD renders art from the manifest in real-time.

### How It Works

1. MELD reads the EVOAccount from the Solana program
2. It extracts: locked_lamports, forged_at, trade_count, resonance_seed, current_state, is_listed
3. It fetches the visual manifest from the collection's metadata_uri (IPFS, Arweave, or HTTPS)
4. The manifest maps the current_state to an image URL (per-stage or per-EVO template with {id} and {stage})
5. The renderer loads the image and applies real-time effects (pulse, shimmer, glow)

### The Visual Resolver

The resolver at `frontend/src/lib/evo-visuals.ts` is open source. Any wallet or explorer can use it. The resolver maps:

- `current_state` to visual stage (for RevealAndEvolve collections)
- `isRevealed` to hidden/revealed (for Reveal collections)
- `locked_lamports` to size
- `forged_at` to age (intricacy)
- `trade_count` to fracture line count
- `resonance_seed` to color palette
- `is_listed` to glow

The resolver is deterministic. It does not use randomness. The art is a pure function of on-chain state.

---

## 5. The MELD Brand

MELD is the consumer brand. EVO is the protocol. The relationship:

- **EVO** = the on-chain primitive (like "NFT" or "token")
- **MELD** = the terminal where you use EVOs (like "OpenSea" or "Pump.fun")

The tagline: "Assets that don't stay the same."

This captures the core idea: EVOs evolve. They grow (feeding), they change (evolution), they trade (fracture lines), and they can be destroyed (shatter). They are not static pointers. They are living assets.

### Brand Positioning

MELD is positioned as the home of stateful capital on Solana. Where other marketplaces sell static images, MELD sells assets with floors, histories, and futures. The brand is for people who want more than a JPEG. People who want an asset.

---

## 6. Business Model

### 6.1 Revenue Streams

| Stream | Source | Status |
|---|---|---|
| Featured placement | Collections pay for visibility | Planned |
| Premium analytics | Traders pay for advanced tools | Planned |
| Creator services | Creators pay for launch support | Planned |
| Trading interface fees | Small fee on top of protocol royalty | Potential |

The terminal does not take a cut of protocol royalties. Those go to the collection creator as configured. MELD monetizes through services and features on top of the protocol, not by intercepting protocol revenue.

### 6.2 The Flywheel

```
MELD attracts users
  -> users mint and trade EVOs
  -> creators see volume and launch collections on MELD
  -> more collections attract more users
  -> MELD grows
```

The terminal and the protocol reinforce each other. More users on MELD means more EVOs minted. More EVOs minted means more SOL locked. More SOL locked means more attention. More attention means more users on MELD.

### 6.3 Competitive Advantage

1. **Only terminal for EVO.** MELD is the first and only terminal built specifically for the EVO protocol. Other marketplaces cannot render EVO art or expose EVO operations.

2. **Protocol-native rendering.** MELD reads on-chain visual state and renders art in real-time. No image hosting, no metadata fetching. The art is the chain.

3. **Full EVO lifecycle support.** Mint, feed, list, buy, shatter, evolve, transfer. All in one place. No other terminal supports these operations.

4. **Open visual resolver.** The rendering logic is open source. Any wallet or explorer can use it. This makes EVO rendering a standard, not a MELD monopoly. MELD benefits from ecosystem-wide EVO support.

---

## 7. Architecture

### Frontend

- Built in TypeScript with Next.js
- Solana wallet adapter for connection
- On-chain data via RPC (Helius)
- Visual resolver (evo-visuals.ts) for art rendering
- Program client (evo-program.ts) for instruction building
- Supabase for off-chain indexing (collection metadata, social links)
- Deployed on Vercel

### Data Flow

```
User -> MELD frontend -> Solana RPC (Helius) -> EVO Program
                                        |
                                        v
                                   EVOAccount PDA
                                        |
                                        v
                                   Visual Resolver
                                        |
                                        v
                                   Rendered Art (browser)
```

MELD does not store EVO state. It reads it from the chain every time. The chain is the source of truth. MELD is a view layer.

For collection-level metadata (social links, descriptions, featured status), MELD uses Supabase. This is off-chain data that does not affect the protocol. The protocol remains the source of truth for all value and ownership.

---

## 8. Roadmap

### Phase 1: Launch
- Terminal live at z-evo-three.vercel.app
- Core operations: mint, feed, list, buy, shatter, evolve
- Visual rendering for all lifecycle types
- Portfolio view

### Phase 2: Growth
- Point meldterminal.io domain to terminal
- Featured collection system
- Creator analytics dashboard
- Advanced trading interface (price charts, order book)

### Phase 3: Scale
- Mobile-optimized interface
- Wallet integration SDK (for third-party wallets to render EVOs)
- API for third-party terminals
- Cross-platform EVO rendering standard

### Phase 4: Ecosystem
- Lending integration (borrow against EVO floors)
- Fractional EVO ownership
- EVO-backed derivatives
- Multi-terminal support (MELD as one of many EVO terminals)

---

## 9. The MELD and EVO Relationship

MELD and EVO are separate but complementary.

**EVO is the protocol.** It is open source, permissionless, and deployed on Solana mainnet. Anyone can build on it. Anyone can create a terminal. The protocol does not depend on MELD.

**MELD is the terminal.** It is the primary consumer interface for EVO. It is built by the same team. It is the brand that users see. It is where the business lives.

The protocol is infrastructure. The terminal is the product. The protocol succeeds if the EVO standard is adopted by anyone. The terminal succeeds if users choose MELD specifically.

This separation is intentional. If the terminal fails, the protocol still has value. If a better terminal emerges, the protocol benefits. MELD has the first-mover advantage and the deepest integration, but it does not have a monopoly on EVO access.

---

## 10. Conclusion

MELD is the terminal for EVO. It is where stateful capital meets the market. It is the place to discover, mint, trade, feed, evolve, and shatter EVOs. It renders art from on-chain data. It exposes every EVO operation through a clean interface.

The EVO protocol gives Solana a new asset primitive: unique assets with guaranteed floors, progressive value, and visual evolution. MELD gives that primitive a home.

Assets that don't stay the same.

---

## References

- EVO Protocol: https://github.com/stephenclawdbot-png/EVO
- EVO Whitepaper: https://github.com/stephenclawdbot-png/EVO/blob/main/docs/evo-whitepaper.md
- Terminal: MELD (meldterminal.io)
- Visual Resolver: https://github.com/stephenclawdbot-png/EVO/blob/main/frontend/src/lib/evo-visuals.ts

---

## Authors

naps (@naps000), admiralfinest (@admiralfinest), Benedict A.