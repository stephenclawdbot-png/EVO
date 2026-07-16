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

> Transfer a Metaplex NFT without its vault. You can. Transfer an EVO without its SOL. You can't — the SOL is in the account, not next to it.

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
