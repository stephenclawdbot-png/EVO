# 07 — EVO vs Everything

## The Asset Class Comparison

| Property | Fungible Token | NFT | NFT + Escrow | **EVO** |
|---|---|---|---|---|
| Fungible | ✅ | ❌ | ❌ | ❌ |
| Unique | ❌ | ✅ | ✅ | ✅ |
| Backed by value | ❌ | ❌ | ✅ (separate) | ✅ (inside) |
| Price floor | ❌ | ❌ | Maybe | ✅ (shatter) |
| Has memory/state | ❌ | ❌ | ❌ | ✅ |
| Carries behavior | ❌ | ❌ | ❌ | ✅ (interface) |
| Standard interface | ✅ (SPL) | ✅ (Metaplex) | ❌ (ad hoc) | ✅ (ESI) |
| Token standard | ✅ (SPL) | ✅ (Metaplex) | ✅ | ❌ (custom PDA) |
| Media required | N/A | ✅ (URI) | ✅ | ❌ (optional) |
| Supply changes | Mintable | Fixed | Fixed | ✅ (decreases via shatter) |
| Can go to zero | N/A | ✅ | Maybe | ❌ (floor protects) |
| Other programs compose | Easy | Easy | Hard | ✅ (ESI) |

---

## EVO vs NFT

```
NFT:
  → Mint a token with metadata URI → image on IPFS
  → Static art forever (or mutable by authority)
  → No value backing — can go to zero
  → No price floor
  → Traded on external marketplaces

EVO:
  → Forge a PDA with locked SOL
  → Art is optional (primitive works without media)
  → Backed by real SOL — floor = locked amount
  → Shatter to reclaim — downside is defined
  → Carries state (history, provenance) without becoming a token
```

**Key difference:** NFTs are digital art with scarcity. EVOs are stateful capital with a floor.

---

## EVO vs NFT + Escrow

This is the closest existing pattern. Someone creates an NFT, locks SOL in a separate escrow PDA, and ties them together.

```
NFT + Escrow:
  → Two separate accounts (NFT + escrow PDA)
  → Value is in the escrow, not the NFT
  → No standard — each implementation is ad hoc
  → Other programs must understand both accounts
  → Must reimplement for every collection

EVO:
  → One account (SOL + state together)
  → Value is inside the owned object
  → Standard interface (ESI) — defined once
  → Other programs read one account
  → One protocol, all collections
```

**The distinction:** NFT + escrow is a **pattern** reimplemented every time. EVO is a **standard** composed by anyone.

---

## EVO vs Token

```
Token:
  → Fungible units of a supply
  → No memory, no uniqueness
  → Value from utility or speculation
  → Can go to zero

EVO:
  → Non-fungible (each is unique)
  → Carries state (history, provenance)
  → Floor from locked SOL
  → Cannot go below floor (shatter protects)
```

---

## EVO vs LP Position

```
LP Position:
  → Represents liquidity in a pool
  → Value fluctuates with pool performance
  → Complex to understand
  → No art, no story

EVO:
  → Represents locked SOL
  → Floor is stable (doesn't fluctuate)
  → Simple: lock SOL, trade or shatter
  → Carries provenance and state
```

---

## The Unique Position

EVO occupies a position no existing asset class fills:

```
                    Has a floor?
                         |
           YES           |          NO
    ──────────────────────────────────────
    LP Position         |    Token (SOL)
    Savings             |    NFT
    EVO ←               |    Art Blocks
                        |    Mutable NFT
    ──────────────────────────────────────
                         |
                    Carries state?
                         |
           YES ← EVO is the ONLY thing in this quadrant
                 (has a floor AND carries state through transfer)
```

**EVO is the only asset class that has a SOL-backed floor AND carries state.**

---

## The Simplest Distinction

```
SOL     = value, no identity, no floor (it IS the floor)
NFT     = identity, no value, no floor (can go to zero)
EVO     = value + identity + floor (speculation with a floor)
```

---

*Part of the [EVO documentation](../README.md)*
