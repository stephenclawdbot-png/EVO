# 04 — Economics

## Overview

EVO economics have three layers:
1. **Per-z economics** — how individual Z are priced
2. **Collection economics** — how the Z collection works as a whole
3. **Protocol economics** — how the EVO protocol earns from all collections

---

## Fee Structure

| Action | Fee | Split | Who Pays |
|---|---|---|---|
| Mint (forge) | 0.05 SOL | 0.01 rent + 0.04 treasury | Minter |
| Feed (deposit) | 0 or 0.001 SOL | Treasury | Feeder |
| Trade (sale) | 2% of sale price | 1% protocol + 1% collection | Buyer (included in price) |
| Shatter (redeem) | 1% of locked SOL | Protocol treasury | Shatterer |

### Fee Distribution

```
Mint fee:
  → 0.01 SOL: Solana rent (stays in PDA, reclaimable on shatter)
  → 0.04 SOL: Collection treasury (Z team)

Trade fee (2% of sale price):
  → 1%: Protocol treasury (EVO protocol — benefits all collections)
  → 1%: Collection treasury (the specific collection's team)

Shatter fee (1% of locked SOL):
  → 100%: Protocol treasury
```

**For competitor collections on the EVO protocol:**
- They set their own mint price and collection trade fee
- The protocol always takes its 1% cut on trades
- The protocol always takes its 1% cut on shatters
- This is how the EVO protocol earns from the entire ecosystem

---

## Pricing Model

### The Price Floor

```
floor_price = locked_lamports (in SOL)
```

A z with 5 SOL locked inside has a floor of 5 SOL. Why? Because you can always shatter it to reclaim 5 SOL (minus 1% fee = 4.95 SOL). No rational seller would accept less than 4.95 SOL — they'd shatter instead.

### The Premium

```
market_price = locked_sol + premium

premium = f(rarity, facets, trade_history, market_demand, aesthetic_appeal)
```

The premium is set by the free market. Factors that increase premium:

| Factor | Why It Increases Premium |
|---|---|
| Many facets (old z) | Time can't be faked. Old Z are scarce. |
| Rare color palette | Some resonance seeds produce rare palettes |
| Rich fracture history | Traded many times = storied provenance |
| Pristine (never traded) | Clean Z become rare as trading happens |
| Large size (lots of SOL) | Visible wealth = status symbol |
| Legendary status | Oldest + largest + most-traded Z |

### Example Pricing Scenarios

```
z A: 0.5 SOL locked, 1 week old, never traded
  → Floor: 0.5 SOL
  → Premium: ~0 (too new, too small)
  → Market price: ~0.5 SOL

z B: 5 SOL locked, 6 months old, traded twice
  → Floor: 5 SOL
  → Premium: 2-5 SOL (decent age, some history)
  → Market price: 7-10 SOL

z C: 50 SOL locked, 2 years old, traded 8 times, rare palette
  → Floor: 50 SOL
  → Premium: 30-100 SOL (legendary status, rare, huge, ancient)
  → Market price: 80-150 SOL
```

---

## Supply Dynamics

### Total Supply
```
Max Z: 2,000 (hardcoded, can never increase)
```

### Supply Decreases Over Time
```
Z shattered → supply decreases → remaining Z more scarce

Year 1:  ~2,000 Z (some shattered)
Year 2:  ~1,600 Z (more shattered)
Year 3:  ~1,200 Z (survivors becoming rare)
Year 5:  ~800 Z (legendary survivors)
```

Unlike NFTs where supply is fixed forever, EVO supply **decreases** as people shatter to reclaim SOL. This creates increasing scarcity over time — the survivors become more valuable.

### New Supply = Zero After Cap
Once all 2,000 Z are minted, no new ones can ever be created. The only way to get one is to buy from an existing holder. Combined with decreasing supply from shattering, this creates strong scarcity pressure.

---

## Treasury

### Collection Treasury (Z)
Funds:
- Artist commissions and ongoing art development
- Frontend development and hosting
- Community rewards and incentives
- Marketing and partnerships
- Team operations

### Protocol Treasury (EVO)
Funds:
- Protocol development and maintenance
- Ecosystem grants (for competitors building on EVO)
- Open source contributions
- Long-term: DAO governance

### Treasury Management
- Initially: multisig (team-controlled)
- Phase 2: community proposals for treasury usage
- Phase 3: full DAO governance

---

## Protocol Revenue Model

The EVO protocol earns from ALL collections built on it:

```
Revenue sources:
  1. 1% protocol fee on every trade (all collections)
  2. 1% protocol fee on every shatter (all collections)
  3. Protocol-level mint fees (if any)

Example (hypothetical, mature ecosystem):
  Z:  500 trades/month × avg 10 SOL × 1% = 50 SOL/month
  Orbs:      300 trades/month × avg 5 SOL × 1%  = 15 SOL/month
  Geodes:    200 trades/month × avg 3 SOL × 1%  = 6 SOL/month
  Others:    100 trades/month × avg 2 SOL × 1%  = 2 SOL/month
  
  Total protocol revenue: ~73 SOL/month ≈ $5,600/month (at $77/SOL)
```

As more collections launch on EVO, protocol revenue grows — even if Z trading volume stays flat.

---

## Why People Trade EVOs

| Motivation | Description |
|---|---|
| **Speculation** | Buy young, sell old. Buy small, feed SOL, sell bigger. |
| **Collection** | Collect rare palettes, pristine Z, legendary pieces. |
| **Status** | Owning a massive ancient z is a flex. Display it. |
| **Story** | Each fracture line tells who held it and when. Rich history = valuable. |
| **Floor safety** | Can always shatter for locked SOL. Downside is limited. |
| **Gamification** | Challenges: "hold for 1 year," "trade 10 times," "grow to 100 facets." |
| **Art appreciation** | The Z are genuinely beautiful. Some people just want to own pretty things. |
| **Store of value** | It's SOL with a face. You're holding value, but it's beautiful. |

---

*Part of the [EVO documentation](../README.md)*