# 05 — Protocol Model

## From Collection to Protocol

EVO is not just a collection — it's a **protocol** that anyone can build on.

```
EVO Protocol (Solana program)
├── Z (our flagship collection, 2000 cap)
├── Orbs (competitor collection, 5000 cap)
├── Geodes (competitor collection, 10000 cap)
├── Cores (competitor collection, 500 cap)
└── ...anyone can launch here
```

---

## Why Be a Protocol?

### Collection-Only Model (Small)
```
You deploy EVO program for Z only
Competitor copies code, deploys their own program
→ You earn: only from z trades
→ You're a single product
→ Competitors are independent
```

### Protocol Model (Big)
```
You deploy ONE EVO program that supports multiple collections
Competitors launch their collections ON YOUR PROGRAM
→ You earn: protocol fee on EVERY trade across ALL collections
→ You're infrastructure
→ Competitors are your customers
```

This is the difference between being **a NFT collection** and being **Metaplex.** Between being **a token** and being **pump.fun.**

---

## How Multi-Collection Works

### Collection Configuration

Each collection on the EVO protocol is configured with:

```rust
struct CollectionConfig {
  authority: Pubkey,           // who manages this collection
  name: String,                // "Z", "Orbs", etc.
  max_supply: u32,             // 2000, 5000, etc.
  mint_price: u64,             // lamports required to mint
  collection_treasury: Pubkey, // where collection fees go
  art_seed: [u8; 32],          // base seed for art variation
  mint_authority: Pubkey,     // who can mint (or null for public)
  trade_fee_bps: u16,          // collection trade fee (e.g., 100 = 1%)
  shatter_fee_bps: u16,        // collection shatter fee (e.g., 0)
  is_paused: bool,             // emergency pause
}
```

### Protocol Configuration

The protocol itself has:

```rust
struct ProtocolConfig {
  protocol_treasury: Pubkey,   // where protocol fees go
  protocol_trade_fee_bps: u16, // protocol cut of trades (e.g., 100 = 1%)
  protocol_shatter_fee_bps: u16, // protocol cut of shatters (e.g., 100 = 1%)
  protocol_mint_fee_bps: u16,  // protocol cut of mints (e.g., 0)
  authority: Pubkey,           // protocol authority (multisig)
}
```

### Fee Flow on Trade

```
Buyer pays X SOL for a z from collection Y:

  → Seller receives: X - (collection_fee + protocol_fee)
  → Collection Y treasury receives: X * collection_trade_fee_bps / 10000
  → Protocol treasury receives: X * protocol_trade_fee_bps / 10000

Example:
  Sale price: 10 SOL
  Collection trade fee: 1% → 0.1 SOL to collection treasury
  Protocol trade fee: 1% → 0.1 SOL to protocol treasury
  Seller receives: 9.8 SOL
```

---

## Why Competitors Use Our Program

| If they deploy their own | If they use EVO protocol |
|---|---|
| Build everything from scratch | Just configure a collection, done |
| Build their own marketplace | Marketplace already built in |
| No existing liquidity | Tap into EVO ecosystem liquidity |
| No existing users | Access EVO community of traders |
| Build their own frontend | Can use shared EVO frontend components |
| Fight for attention alone | Ride the EVO category wave |
| Maintain their own program | Protocol upgrades handled by us |
| No trust track record | EVO protocol is audited and battle-tested |

**The convenience moat:** It's 10x easier to launch on EVO than to build from scratch. Most competitors will choose the easy path.

---

## Launching a Collection on EVO

```
1. Call create_collection() on EVO program
   → Provide: name, max_supply, mint_price, art_seed, fees
   → Pay: collection creation fee (e.g., 1 SOL to protocol treasury)
   → Receive: Collection PDA + config

2. Configure art (off-chain)
   → Artist creates color palettes, shapes, facet styles
   → Art config uploaded to a CDN (or embedded in frontend)
   → Art config is referenced by collection's art_seed

3. Users mint EVOs in your collection
   → Call forge() with your collection ID
   → Pay mint_price (split: rent + collection treasury + protocol treasury)

4. Users feed, trade, shatter
   → All goes through the EVO program
   → Protocol earns fees on every action
```

---

## EVO Protocol Governance

### Phase 1: Team-controlled
- Protocol treasury is a multisig (team + advisors)
- Protocol parameters (fees) set by team
- Collection approvals manual

### Phase 2: Community proposals
- Anyone can propose treasury usage
- Token holders vote (governance token? or z-weighted voting?)
- Protocol parameters adjustable via governance

### Phase 3: Full DAO
- Protocol treasury fully DAO-governed
- Fee changes, upgrade decisions, grants — all on-chain governance
- EVO becomes a decentralized protocol

---

## The Flywheel

```
More collections launch on EVO
  → More EVOs in existence
  → More people discover EVOs
  → More people want to trade EVOs
  → More liquidity in the EVO marketplace
  → More attractive for new collections to launch on EVO
  → More protocol revenue
  → More development, better features
  → More collections launch on EVO
  → (flywheel spins faster)
```

Each new collection:
1. Brings its own community to EVO
2. Pays protocol fees on every trade
3. Makes the EVO category more legitimate
4. Drives attention back to Z (the original)

---

*Part of the [EVO documentation](../README.md)*