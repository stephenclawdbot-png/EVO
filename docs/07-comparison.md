# 07 — EVO vs Everything

## The Asset Class Comparison

| Property | Fungible Token | NFT | Mutable Metadata NFT | **EVO** |
|---|---|---|---|---|
| Fungible | ✅ | ❌ | ❌ | ❌ |
| Unique | ❌ | ✅ | ✅ | ✅ |
| Backed by value | ❌ | ❌ | ❌ | ✅ (locked SOL) |
| Price floor | ❌ | ❌ | ❌ | ✅ (shatter to redeem) |
| Evolving art | ❌ | ❌ | ❌ (manual) | ✅ (automatic) |
| Art changes | N/A | Never | When authority updates | **When value/time changes** |
| Who controls art | N/A | Nobody | Update authority | **Nobody — pure math** |
| Trustless art | N/A | ✅ | ❌ | ✅ |
| Has metadata URI | N/A | ✅ | ✅ | ❌ |
| Uses token standard | ✅ (SPL) | ✅ (Metaplex) | ✅ (Metaplex) | ❌ (custom PDA) |
| Provenance in art | ❌ | ❌ | ❌ | ✅ (fracture lines) |
| Supply changes | N/A | Fixed | Fixed | ✅ (decreases via shatter) |
| Store of value | Maybe | Maybe | Maybe | ✅ (by design) |
| Simple to trade | ✅ | ✅ | ✅ | ✅ |

---

## EVO vs NFT

```
NFT:
  → Mint a token with metadata URI → image on IPFS
  → Art is static forever
  → No value backing
  → No price floor
  → Traded on external marketplaces (Magic Eden, Tensor)

EVO:
  → Forge a PDA with locked SOL
  → Art evolves as value grows and time passes
  → Backed by real SOL
  → Price floor = locked SOL
  → Traded on built-in program marketplace
```

**Key difference:** NFTs are digital art with scarcity. EVOs are digital art with scarcity AND value backing AND evolution.

---

## EVO vs Mutable Metadata NFT

This is the most important comparison — because mutable metadata NFTs are the closest existing thing to EVOs.

```
Mutable Metadata NFT:
  → Regular NFT (SPL/Metaplex token)
  → Metadata URI points to an image
  → Someone with update authority can change the URI
  → "Dynamic" because the image can be swapped
  → TRUST REQUIRED: you trust the authority not to rug the art

EVO:
  → NOT an NFT (no SPL token, no Metaplex)
  → No metadata, no URI, no image file
  → Art is COMPUTED from on-chain data
  → NOBODY can change the art manually
  → Art changes because the DATA changes (SOL fed, time passes, trades happen)
  → TRUSTLESS: the art is a pure function of on-chain state
```

| Question | Mutable Metadata NFT | EVO |
|---|---|---|
| Is it an NFT? | Yes (SPL/Metaplex) | No (custom PDA) |
| Is there metadata? | Yes (URI to image) | No (rendered from data) |
| How does art change? | Authority swaps the image | Value/time changes the data |
| Who controls the art? | Update authority holder | **Nobody** |
| Can art be ruggged? | Yes (authority can change to anything) | **No** (deterministic function) |
| Is there value backing? | No | Yes (locked SOL) |
| Is there a price floor? | No | Yes (shatter to redeem) |
| Is the change automatic? | No (requires manual tx) | Yes (happens with every feed/trade/time) |
| Trust model | Trust the authority | Trustless (pure math) |

**The fundamental difference:**
- Mutable metadata = **someone has the POWER to change the art**
- EVO = **nobody has power. The value itself drives the art.**

This is why EVO is a new primitive, not just a fancy NFT.

---

## EVO vs Token

```
Token:
  → Fungible units of a supply
  → No art
  → No uniqueness
  → Value from utility or speculation
  → Traded on DEXs (Jupiter, Raydium)

EVO:
  → Non-fungible (each is unique)
  → Art that evolves
  → Value from locked SOL + art premium
  → Traded on built-in marketplace
```

---

## EVO vs LP Position

```
LP Position:
  → Represents liquidity in a pool
  → Value fluctuates with pool performance
  → Some can be traded (Uniswap V3 NFTs)
  → No art, no evolution
  → Complex to understand

EVO:
  → Represents locked SOL
  → Value = locked SOL (stable, doesn't fluctuate)
  → Tradeable with art premium
  → Beautiful, evolving art
  → Simple to understand: lock SOL, it grows, trade or shatter
```

---

## EVO vs Savings Account

```
Savings Account:
  → Deposit money, earn interest
  → No art, no uniqueness
  → Centralized (bank controls it)
  → Can't trade the account

EVO:
  → Deposit SOL, it stays (no interest, but art grows)
  → Each EVO is unique with evolving art
  → Decentralized (program-controlled)
  → Tradeable — sell the whole EVO to someone else
  → The "interest" is the art becoming more valuable over time
```

---

## The Unique Position of EVO

EVO sits in a position no existing asset class occupies:

```
           Value-backed?
                |
    YES        |        NO
    ─────────────────────────────
    LP pos     |     Token (SOL)
    Savings    |     NFT
    EVO ←      |     Mutable NFT
               |     Art Blocks
    ─────────────────────────────
               |
           Evolving art?
                |
    YES ← EVO is the ONLY thing in this quadrant
          (value-backed AND evolving art)
```

**EVO is the only asset class that is both value-backed AND has evolving art.** That's the novel position.

---

*Part of the [EVO documentation](../README.md)*