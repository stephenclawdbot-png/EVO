# EVO: A Third Model for Digital Assets

## The thesis

Digital assets today force you to choose between fungibility (tokens) and uniqueness (NFTs). EVO introduces a third model: unique programmable assets with intrinsic redeemable value. Market participants speculate on everything above the reserve, while the reserve itself provides a protocol-defined economic floor.

---

## The value model

An EVO has two sources of value:

1. **Intrinsic value** — the redeemable reserve (SOL locked inside the asset)
2. **Market value** — novelty, rarity, culture, utility, speculation

```
Market Price = Intrinsic Floor + Speculative Premium
```

Every financial asset has some version of this:

- Stocks: book value + growth expectations
- Bonds: redemption value + interest rate expectations
- Gold coins: metal value + collectible premium
- Rare watches: material value + brand premium

The concept isn't new. What's new is applying it to a programmable digital asset whose reserve and identity are inseparable — enforced by account structure, not by a team's promise.

---

## The payoff curve

Today's NFT:

```
0 -----------------------> infinity
```

Can go to zero. Often does.

EVO:

```
Intrinsic Floor -----> infinity
```

The reserve changes the payoff curve. Speculation still happens — degens still chase the premium. But the downside has a floor that's protocol-defined, not market-defined.

The precise, defensible claim:

> **An EVO's redeemable value cannot fall below its protocol-defined reserve while the protocol guarantees redemption.**

Not "it doesn't go to zero." Engineers will ask what happens if redemption is disabled, if fees exceed the reserve, if the account is frozen. The honest claim accounts for those: the floor holds while the protocol guarantees redemption. That's a structural property, not a marketing promise.

---

## Shatter: the floor becomes a mechanism

The reserve isn't just a number. It's a mechanism.

```
Collection A (JPEG)
  Floor: 0.5 SOL
  Hype dies -> 0.01 -> 0 -> Dead.

Collection B (EVO)
  Contains: 0.25 SOL
  Market: 1.4 SOL
  Hype dies -> people shatter.
    Supply decreases.
    Remaining supply becomes scarcer.
    Floor holds at the reserve.
```

Shatter is the most novel mechanic in EVO. It makes three actions rational choices:

- **Hold** — bet the premium stays or grows
- **Trade** — capture market price above floor
- **Shatter** — redeem the floor, reduce supply, increase scarcity for everyone who holds

When hype dies, supply contracts. The collection self-cleans. Remaining holders benefit from increased scarcity. The floor doesn't just protect — it creates a negative feedback loop that stabilizes the asset.

That's a game. Holding, trading, and destroying all become economically rational depending on where the market price sits relative to the floor.

---

## What EVO combines

Not "traded like tokens and NFTs" — everything is tradable. Instead:

> **EVO combines the price discovery of markets with the uniqueness of collectibles while maintaining a redeemable reserve.**

Price discovery: market-driven trading, bids, asks, last-sale data.
Uniqueness: each EVO has distinct identity, metadata, provenance, art.
Reserve: SOL locked inside, redeemable on demand via shatter.

All three in one atomic object. Not three features layered on a token — three properties of the same account.

---

## The technical foundation

**Metaplex treats lamports as rent. EVO treats lamports as economic state.**

Every Solana account holds lamports. The distinction is what the protocol says those lamports ARE:

- Mint account: lamports = rent
- Token account: lamports = rent
- Metadata account: lamports = rent
- EVO account: lamports = economic state inseparable from identity

If you close a Metaplex metadata account, the rent goes back and the NFT still exists. The lamports were incidental. If you close an EVO account, you've destroyed the asset AND released the floor. There's nothing left to reference.

Rent is an implementation detail. Economic state is a protocol guarantee.

---

## "Can Metaplex become EVO via an extension?"

```rust
struct EvoExtension {
    locked_sol: u64,
    trade_count: u32,
    ...
}
```

An extension can store the same fields. **It cannot store the same SOL.**

Every Metaplex account has pre-defined lamport semantics: they're rent. You cannot repurpose a Metaplex account's lamports as locked economic state without modifying the Token program or Metaplex program themselves.

So where does the locked SOL go?

**In a separate vault PDA.** Every time. The extension tracks the number. The vault holds the value. Two accounts. A pointer between them. The separation IS the problem EVO solves.

EVO accounts have no pre-defined lamport semantics. We define their lamports as economic state. No vault. No pointer. No separation.

> **An extension can store EVO's fields. It cannot store EVO's value. The value requires the account model, not an extension.**

---

## Structural, not enforced

EVO doesn't claim Metaplex can't achieve similar guarantees. EVO claims those guarantees are **structural, not enforced**.

You could write a wrapper program that freezes NFT transfers unless a vault co-signs. But:

1. The vault is still a separate account — a bug or upgrade breaks the link
2. Redemption is multi-step (burn token + close vault + transfer SOL) — each can fail independently
3. The freeze is policy, not structure — a lock on a door, not a wall

EVO's inseparability is structural. One account. One instruction. One atomic state transition. You can't break it because there's nothing to break.

The difference between enforced and structural is the difference between a lock on a door and a wall where the door would be.

---

## The one-liner

> Transfer a Metaplex NFT without its vault. You can. Transfer an EVO without its SOL. You can't — the reserve and object state occupy the same program-owned account, and every ownership or redemption transition is governed by the same protocol.

---

## Account comparison

| | NFT + Vault | EVO |
|---|---|---|
| Asset model | Reference (token points to everything) | Account-oriented (account IS the asset) |
| Where SOL lives | Separate vault PDA | Inside the asset account |
| Lamport semantics | Rent | Economic state |
| Inseparability | Enforced (wrapper program / hooks) | Structural (same account) |
| Transfer | Token moves, vault stays | Entire object moves atomically |
| Destruction | 2-3 transactions across 3 programs | 1 instruction (shatter) |
| Can Metaplex extension replicate? | Can store fields, not value | Value requires the account model |
| Floor guarantee | None (vault can be drained separately) | Enforced (SOL locked in account) |
| Hype death | Price -> 0, collection dies | Supply contracts via shatter, scarcity increases |

---

## What EVO doesn't replace

Not all digital assets need a floor. A profile picture doesn't need intrinsic value. A game item doesn't need a redeemable reserve.

EVO is a superior model for a specific class: assets where value and identity should be inseparable. Collectibles with floors. Programmable assets with locked capital. Speculation with a guarantee.

Not "EVO replaces all NFTs." EVO creates a category where the floor is structural — and for that category, it's a fundamentally different asset model.

---

## What to verify before staking the protocol

Test with real Solana engineers:

> "Can a Metaplex extension store locked SOL without a separate vault account?"

If they say "no, because Metaplex account lamports are rent" — EVO has identified a genuinely different asset model.

If they say "yes, with Token-2022 transfer hooks and a vault" — then EVO's advantage is structural simplicity and atomic guarantees, not impossibility. Still valid, but framed as superiority for a specific class.

Either way, the honest claim holds: **structural, not enforced. Account-oriented, not reference-based. A floor you can't break because there's nothing to break.**

---

## Why EVO is Solana-native: cross-chain analysis

EVO's architecture depends on one property: **the account IS the asset.** The SOL lives inside the same account as the identity. This is native on Solana. On EVM chains (Ethereum, BSC), it's a workaround.

### The fundamental difference

On Solana, every asset is an account — a first-class object with its own lamport balance. Accounts are cheap (~0.002 SOL rent). One account = one EVO. The SOL is in the account. Transfer the account, the SOL goes with it. Close the account, the SOL is released. Structural.

On EVM, assets are entries in a contract's storage (`mapping(uint256 => address) owner`). There is no per-token account. No per-token ETH balance. The "account IS the asset" model does not exist.

### Option A: One contract per EVO (CREATE2)

Each EVO is its own smart contract with its own ETH balance and storage. Closest to Solana's model: transfer = change ownership, shatter = selfdestruct + send ETH.

Problems:
- **Cost:** Deploying a contract per asset on Ethereum costs ~$50-200 in gas. BSC is cheaper (~$0.10-1) but still far more than Solana's ~$0.001.
- **EIP-6780:** Ethereum's Cancun upgrade changed `selfdestruct` — it only works if called in the same transaction as contract creation. This would break shatter. You could not destroy an EVO and reclaim ETH in a later transaction. BSC may or may not follow this change.

### Option B: Vault mapping inside NFT contract

`mapping(uint256 => uint256) lockedValue` inside an ERC-721 contract. Override `transfer` to prevent moving the NFT without the locked value.

Problem: This is **enforced, not structural.** You're back to custom transfer logic on top of a model that assumes tokens are just ownership entries. The exact weakness identified above — a lock on a door, not a wall.

### Comparison

| | Solana | Ethereum | BSC |
|---|---|---|---|
| Account-per-asset | Native, cheap | Expensive (contract deploy) | Cheaper but still costly |
| Atomic destruction | Native (close account) | Broken by EIP-6780 | Uncertain |
| Lamports as economic state | Native | N/A (no rent model) | N/A |
| Inseparability | Structural | Enforced (custom logic) | Enforced |
| Per-asset cost | ~$0.001 | ~$50-200 | ~$0.10-1 |

### The honest position

EVO is doable on EVM chains, but architecturally weaker. On Solana, "the account IS the asset" is native — one account, one atomic object, structural inseparability. On EVM, you either pay a premium for contract-per-asset (and fight selfdestruct changes), or fall back to enforced inseparability — the exact weakness that distinguishes EVO from NFT+Vault.

This is not a limitation. It's a moat. EVO belongs on Solana where the primitive is native, not bolted on. Cross-chain expansion, if it happens, should be honest about the tradeoff: the same mechanic implemented on a different architecture is not the same primitive — it's an emulation.

> **EVO on Solana: the wall. EVO on EVM: the lock.**
