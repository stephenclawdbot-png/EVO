# 04 — Economics

## The Core Idea

> **Speculation with a floor.**

Degens trade narratives — rarity, provenance, status, upside. EVO gives that speculation a safety net: the locked SOL inside is always reclaimable.

Not a store of value (too boring). Not a pure degen casino (too risky). Both.

---

## Two-Layer Value Model

```
Total cost to forge = mint_price + lock_amount

  mint_price  → goes to creator        (the speculative entry — buying the shell)
  lock_amount → locked inside EVO PDA  (the floor — always reclaimable via shatter)
```

| Layer | What it is | Who gets it | When |
|-------|-----------|-------------|------|
| **lock_amount** | SOL inside the EVO — the floor | Owner (reclaimable via shatter) | At forge |
| **mint_price** | Price to forge — speculative entry | Creator | At forge |
| **market premium** | What someone pays above floor | Seller | On resale |

Both mint_price and lock_amount are **set at collection creation and locked forever.**

---

## The Floor

```
floor = locked_lamports - shatter_fee
```

A EVO with 5 SOL locked and a 10% shatter fee has a floor of 4.5 SOL.

No rational seller would accept less than the floor — they'd shatter instead. This creates a hard price floor that no NFT has.

**The actual PDA balance is the source of truth, not a stored field:**
```
redeemable = min(account.lamports() - rent_exempt, locked_lamports) - shatter_fee
```

If someone sends extra SOL to the PDA → they lose it (only locked_lamports tracked).
If a bug reduces the balance → only what's actually there is redeemable.

---

## The Premium

```
market_price = floor + premium

premium = f(rarity, provenance, age, creator reputation, community desire, scarcity)
```

| Factor | Why It Drives Premium |
|---|---|
| Creator reputation | First edition from a known artist |
| Age | Time can't be faked. Old EVOs are scarce. |
| Trade history | 500 trades = legendary provenance |
| Clean (never traded) | Pristine EVOs become rare |
| Large size (lots of SOL) | Visible wealth = status |
| Supply decrease | Shattering makes survivors more rare |
| Community desire | "I need THAT EVO" — collectible demand |

### Example Scenarios

```
EVO A: 1 SOL locked, 1 week old, never traded
  → Floor: 1 SOL (minus fee)
  → Premium: ~0 (too new)
  → Market price: ~1 SOL

EVO B: 5 SOL locked, 6 months old, traded twice
  → Floor: 5 SOL
  → Premium: 2-5 SOL (decent age, some history)
  → Market price: 7-10 SOL

EVO C: 1 SOL locked, 2 years old, traded 500 times, first edition from famous creator
  → Floor: 1 SOL
  → Premium: 10-50 SOL (legendary provenance, rare, ancient)
  → Market price: 11-51 SOL
```

The premium is pure speculation. The floor is pure guarantee. Together: **speculation with a floor.**

---

## Fee Structure

### Collection Creation
```
0.06789 SOL → Protocol treasury (fixed, one-time)
```

### Forge
```
mint_price → Creator wallet
lock_amount → Stays inside EVO PDA
```

### Feed
```
0 fees — adding SOL is free
```

### Trade (Royalty)
```
sale_price * royalty_bps / 10000 → Creator's chosen destination
0-25% (set at collection creation, locked forever)
```

### Shatter
```
locked_lamports * shatter_fee_bps / 10000 → Creator's chosen destination
0-20% (set at collection creation, locked forever)
```

### Fee Destinations (Creator Chooses)

| Destination | What happens |
|---|---|
| `Treasury` | Goes to protocol treasury |
| `Creator` | Goes to creator's wallet |
| `Burn` | Permanently destroyed (deflationary) |
| `Split` | Split between multiple destinations |

All fees are **immutable after collection creation.** Creators cannot change fees once the first EVO is forged.

---

## Supply Dynamics

```
Max supply = supply_cap (set at collection creation)
Current supply = forged count - shattered count
```

Unlike NFTs where supply is fixed forever, EVO supply **decreases** as people shatter:

```
Year 1:  ~2,000 EVOs (some shattered)
Year 2:  ~1,600 EVOs (more shattered)
Year 3:  ~1,200 EVOs (survivors becoming rare)
Year 5:  ~800 EVOs (legendary survivors)
```

Increasing scarcity over time. The survivors become more valuable.

---

## Why People Trade EVOs

| Motivation | Description |
|---|---|
| **Speculation** | Buy young, sell old. Buy small, feed SOL, sell bigger. |
| **Floor safety** | Can always shatter for locked SOL. Downside is limited. |
| **Collection** | Collect rare EVOs, pristine pieces, legendary objects. |
| **Status** | Owning a massive ancient EVO is a flex. |
| **Story** | Each fracture line tells who held it and when. |
| **Creator support** | mint_price goes to creators. Royalties on every trade. |

Volume never comes from technology. It comes from desire. EVO creates desire with a safety net.

---

## Protocol Revenue

The EVO protocol earns from ALL collections built on it:

```
Revenue sources:
  1. Collection creation fee (0.06789 SOL per collection)
  2. Protocol fee on trades (if configured)
  3. Protocol fee on shatters (if configured)
```

As more collections launch on EVO, protocol revenue grows — even if individual collection trading volume stays flat.

---

*Part of the [EVO documentation](../README.md)*
