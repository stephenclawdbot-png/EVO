# 02 — Mechanics

## The Lifecycle

```
Forge → Feed → Trade → Shatter (or Transfer)
```

Every EVO follows this lifecycle. Some are forged and held forever. Others are traded dozens of times. Each path creates a unique object with a unique story.

---

## 1. Forging (Minting)

**What happens:** A user creates a new EVO by paying the mint_price + lock_amount.

```
User pays: mint_price + lock_amount
  → mint_price  → goes to the creator (the speculative entry — "buying the shell")
  → lock_amount → locked inside the EVO PDA (the floor — always reclaimable)

Result: EVO PDA created
  → locked_lamports = lock_amount
  → owner = caller
  → resonance_seed = provided by caller (drives optional generative art)
  → forged_at = current_timestamp
```

**Key points:**
- **mint_price goes to the creator** — this is how creators earn from forging
- **lock_amount stays inside the EVO** — this is the floor, reclaimable via shatter
- Both are set at collection creation and are **immutable** — can never change
- The resonance_seed is provided by the forger — can be derived from a hash, random, or from pre-made art
- Supply cap is enforced — once the cap is reached, no more EVOs can be forged

---

## 2. Feeding (Adding Value)

**What happens:** The owner deposits more SOL into their EVO. The floor goes up.

```
User feeds: 1 SOL
  → 1 SOL added to EVO's locked_lamports
  → Floor price increases

Result: locked_lamports increases
```

**Key points:**
- **No minimum feed amount** (practically — program may set a small minimum to prevent spam)
- **No maximum** — feed as much as you want, as often as you want
- **No lockup period** — you can shatter and reclaim anytime
- **All fed SOL stays in the PDA** — it's not spent, it's stored
- **Feeding increases the floor** — more SOL inside = higher downside protection
- **Only the owner can feed**

---

## 3. Trading (Marketplace)

**What happens:** Owner lists EVO for sale, buyer pays, ownership transfers.

```
Step 1: Owner lists EVO
  → Sets asking price (e.g., 8 SOL)
  → EVO marked as "listed" in program state

Step 2: Buyer pays 8 SOL
  → Program splits payment:
    → Seller receives: 8 SOL - royalty
    → Royalty destination receives: 8 SOL * royalty_bps / 10000
  → PDA ownership transfers to buyer
  → Trade count increments
  → Fracture line recorded (trade #, previous owner, timestamp)

Step 3: Premium is set by the market
  → Floor = locked SOL (nobody sells below floor — they'd shatter instead)
  → Premium = story, rarity, provenance, scarcity, creator reputation
```

**Key points:**
- **Price is set by the seller** — free market, no bonding curve
- **Floor price = locked SOL** — if market drops below floor, someone arbitrages by shattering
- **Premium = the story** — why someone pays 4 SOL for something containing 1 SOL
- **Trading is program-mediated** — all trades go through the EVO program
- **Every trade leaves a mark** — fracture lines are permanent records of provenance

**Why the premium exists:**
- Famous creator — first edition from a known artist
- Rarity — only 100 exist, supply decreases as people shatter
- Age — old EVOs can't be faked, time can't be shortcut
- Provenance — traded 500 times = storied history
- Community desire — "I need THAT EVO"

---

## 4. Shattering (Redemption)

**What happens:** Owner destroys the EVO and reclaims locked SOL.

```
User calls shatter()
  → Program returns locked_lamports - shatter_fee to owner
  → Shatter fee goes to configured destination (Treasury/Creator/Burn/Split)
  → PDA is closed (account destroyed)
  → EVO ceases to exist — state, history, everything gone
```

**Key points:**
- **Always available** — no lockup, no waiting period, no authority can prevent it
- **Reclaims locked SOL minus fee** — the floor minus the creator's cut
- **Destroys the EVO** — the story, the history, the state — all gone
- **This is the floor mechanism** — if market price drops below locked SOL, someone shatters
- **Creates scarcity** — shattering reduces supply, making survivors more rare
- **Irreversible** — once shattered, the EVO is gone forever

**The guarantee:**
> The holder can always shatter their EVO and receive `min(actual_balance, locked_lamports) - shatter_fee` in SOL. No upgrade, no authority, no governance can prevent this.

---

## 5. Transfer (Gifting)

**What happens:** Owner sends EVO to a new wallet. No payment involved.

```
User calls transfer(new_owner)
  → Ownership changes to new_owner
  → No SOL moves — just the EVO's ownership field
```

**Key points:**
- **No marketplace required** — direct transfer
- **No fees** — free to transfer
- **Value moves with the EVO** — the locked SOL goes with the object
- **Use case:** gifting, rewards, community distributions

---

## The State Machine

```
                    ┌──────────┐
                    │  FORGED   │ ← minted, has locked SOL
                    └────┬─────┘
                         │ feed()
                         ▼
                    ┌──────────┐
         ┌───────── │   HELD    │ ← owner holds, floor grows with feeding
         │           └────┬─────┘
         │                │ list()
         │                ▼
         │           ┌──────────┐
         │           │  LISTED   │ ← for sale on marketplace
         │           └────┬─────┘
         │                │ bought
         │                ▼
         │           ┌──────────┐
         └────────── │   HELD    │ ← new owner
                     └────┬─────┘
                          │ shatter()
                          ▼
                    ┌──────────┐
                    │ DESTROYED │ ← SOL returned, PDA closed
                    └──────────┘

  transfer() can happen from FORGED or HELD → new owner, same state
```

---

## Fee Model

| Action | Fee | Who sets it | Where it goes |
|---------|-----|-------------|---------------|
| Collection creation | 0.06789 SOL | Protocol (fixed) | Protocol treasury |
| Forge | mint_price (to creator) | Collection creator | Creator wallet |
| Feed | 0 | N/A | N/A |
| Trade | 0-25% royalty | Collection creator | Creator's chosen destination |
| Shatter | 0-20% fee | Collection creator | Creator's chosen destination |

**Fee destinations (creator chooses):**
- `Treasury` — protocol treasury
- `Creator` — creator's wallet
- `Burn` — permanently destroyed
- `Split` — split between multiple destinations

All fees are **set at collection creation and locked forever.** Creators cannot change fees after the first EVO is forged.

---

## Visual Lifecycle

Every EVO collection declares a visual lifecycle type at creation. Each individual EVO stores its own `current_stage` on-chain. The program enforces valid transitions — marketplaces only read and render.

### Lifecycle Types

| Type | Behavior | Transition Instruction |
|---|---|---|
| `Static` | Art is final at forge. No transitions. | None (rejected) |
| `Reveal` | Pre-reveal → revealed (one transition) | `reveal_collection` |
| `CommitReveal` | Like Reveal but with pre-committed secret | `reveal_collection` |
| `RevealAndEvolve` | Reveal then per-asset evolution | `reveal_collection` then `evolve` |
| `Custom` | Authority sets any valid stage | `set_visual_stage` |

### Evolution Triggers (RevealAndEvolve)

For `RevealAndEvolve` collections, `evolve()` is permissionless — anyone can call it, but the EVO only advances if ALL enabled thresholds are met:

| Trigger | Field | Example |
|---|---|---|
| Trade count | `evolve_trade_threshold` | 10 trades per stage |
| Feed amount | `evolve_feed_threshold` | 0.1 SOL fed per stage |
| Holding duration | `evolve_hold_seconds` | 30 days per stage |
| Locked value | `evolve_locked_threshold` | Reserve reaches 1 SOL |

### Artwork Resolution

The collection's `metadata_uri` points to an off-chain **visual manifest** (JSON) that maps each stage to an image URL. Wallets read `current_stage` from the EVO account and resolve the image from the manifest. See the [Wallet Integration Guide](10-wallet-integration.md) for the full resolution flow.

---

*Part of the [EVO documentation](../README.md)*
