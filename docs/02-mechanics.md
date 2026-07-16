# 02 — Mechanics

## Lifecycle of an EVO

```
Forge → Feed → Grow → Trade → Shatter
```

Every EVO goes through this lifecycle. Some Z are forged, fed, and held forever. Others are traded dozens of times. Each path creates a unique object with unique art.

---

## 1. Forging (Minting)

**What happens:** A user creates a new, empty EVO by paying a small fixed mint price.

```
User pays: 0.05 SOL
  → 0.01 SOL = rent for the PDA account (Solana rent-exempt minimum)
  → 0.04 SOL = treasury fee

Result: Empty z PDA created
  → locked_lamports = 0 (no value inside yet)
  → facet_count = 0 (just born)
  → resonance_seed = hash(forge_tx_signature)
  → forged_at = current_timestamp
```

**Key points:**
- Mint price is **fixed** — same for all 2,000 Z
- The z starts **empty** — no SOL locked inside yet
- The resonance seed is **deterministic** from the forge transaction signature — unpredictable but permanent
- The resonance seed determines the z's base color palette and shape tendency
- **2,000 cap** — hardcoded in the program. No more can ever be minted.

---

## 2. Feeding (Depositing Value)

**What happens:** The owner deposits SOL into their z. This is the core "store of value" action.

```
User feeds: 1 SOL
  → 1 SOL added to z's locked_lamports
  → z grows visually (more SOL = bigger z)
  → Fee: 0 SOL (or 0.001 SOL to treasury)

Result: locked_lamports increases
  → Art updates: z is now bigger
```

**Key points:**
- **No minimum feed amount** — feed 0.001 SOL or 100 SOL
- **No maximum** — feed as much as you want, as often as you want
- **No lockup period** — you can shatter and reclaim anytime
- **All fed SOL stays in the PDA** — it's not spent, it's stored
- **Feeding is what makes the z grow** — size = total SOL locked
- **Fee is zero or near-zero** — we want feeding to be frictionless

**Why feeding instead of fixed-price minting:**
- Fixed-price minting means only rich people get big Z
- Feeding means anyone can start small and grow over time
- A z that was fed 0.1 SOL every week for a year tells a different story than one that was fed 50 SOL in one shot — even if the total is the same
- This creates **diverse z histories** — some are slowly grown, some are instantly massive

---

## 3. Growing (Time Evolution)

**What happens:** The z gains facets over time — automatically, no action required.

```
Facet growth formula:
  facets_gained = floor((current_time - last_growth_time) / GROWTH_INTERVAL)

  GROWTH_INTERVAL = 7 days (1 facet per week held)

Example:
  z forged 30 days ago → 4 facets
  z forged 365 days ago → 52 facets
  z forged 1 day ago → 0 facets
```

**Key points:**
- **Automatic** — no transaction needed. Facets are computed from `forged_at` timestamp
- **Continuous** — the z is always growing, even while you sleep
- **More facets = more intricate art** — the generative algorithm adds complexity per facet
- **Time held is total** — trading doesn't reset the timer. A z forged 2 years ago that was traded 5 times still has 2 years of facets
- **Capped at some maximum** — e.g., 100 facets max, to prevent infinite complexity

**The `grow` instruction:**
- Technically, facets are computed on-the-fly from `forged_at` — no on-chain update needed
- But we may include a `grow` instruction that snapshots the current facet count for optimization (caching for render performance)
- The on-chain truth is always: `facet_count = floor((now - forged_at) / 7_days)`

---

## 4. Trading (Marketplace)

**What happens:** Owner lists z for sale, buyer pays, ownership transfers.

```
Step 1: Owner lists z
  → Sets asking price (e.g., 8 SOL)
  → z marked as "listed" in program state

Step 2: Buyer pays 8 SOL
  → Program splits payment:
    → Seller receives: 8 SOL - 2% fee = 7.84 SOL
    → Protocol treasury receives: 0.08 SOL (1% protocol fee)
    → Collection treasury receives: 0.08 SOL (1% collection fee)
  → PDA ownership transfers to buyer
  → Fracture line recorded (trade #, previous owner, timestamp)
  → trade_count increments

Step 3: Art updates
  → New fracture line appears on the z
  → Buyer sees their new z with its full history
```

**Key points:**
- **Price is set by the seller** — free market, no bonding curve
- **Floor price = locked SOL** — nobody sells below their locked value (they'd shatter instead)
- **Premium = art + history + rarity** — the market decides how much the art is worth above the floor
- **Trading is program-mediated** — all trades go through our program, not external marketplaces
- **Why not external marketplaces?** EVOs aren't NFTs — no SPL token, no Metaplex. They can't be listed on Magic Eden or Tensor. The marketplace IS the program.
- **Every trade leaves a mark** — fracture lines are permanent visual additions to the art

**Fracture lines:**
```
FractureLine {
  trade_number: u32,       // 1st trade, 2nd trade, etc.
  previous_owner: Pubkey,  // who sold it
  timestamp: i64,          // when
  position: u8,            // where on the z (deterministic from trade data)
  intensity: u8,            // how visible (based on trade price relative to locked SOL)
}
```

A z traded 20 times has 20 fracture lines — a rich, cracked, storied appearance. A z never traded has zero fracture lines — clean, pristine. Both are beautiful in different ways.

---

## 5. Shattering (Redemption)

**What happens:** Owner destroys the z and reclaims all locked SOL.

```
User calls shatter()
  → Program returns ALL locked_lamports to owner
  → 1% fee deducted → goes to protocol treasury
  → PDA is closed (account destroyed)
  → Art is gone forever
  → z ceases to exist
```

**Key points:**
- **Always available** — no lockup, no waiting period
- **Reclaims 99% of locked SOL** — 1% shatter fee to treasury
- **Destroys the z** — the art, the history, the facets — all gone
- **This is the price floor mechanism** — if market price drops below locked SOL, someone arbitrages by shattering
- **Creates scarcity** — shattering reduces total supply. Over time, Z are destroyed, making remaining ones more rare
- **Irreversible** — once shattered, the z's resonance seed is gone forever. Even if you forge a new z, it gets a new seed.

---

## State Machine

```
                    ┌──────────┐
                    │  EMPTY   │ ← minted, no SOL fed yet
                    └────┬─────┘
                         │ feed()
                         ▼
                    ┌──────────┐
         ┌───────── │  GROWING  │ ← has locked SOL, gaining facets over time
         │           └────┬─────┘
         │                │ trade()
         │                ▼
         │           ┌──────────┐
         │           │  LISTED   │ ← for sale on marketplace
         │           └────┬─────┘
         │                │ bought
         │                ▼
         │           ┌──────────┐
         └────────── │  GROWING  │ ← new owner, continues growing
                     └────┬─────┘
                          │ shatter()
                          ▼
                    ┌──────────┐
                    │ DESTROYED │ ← SOL returned, PDA closed
                    └──────────┘
```

---

*Part of the [EVO documentation](../README.md)*