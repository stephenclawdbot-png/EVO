# EVO — A Third Model for Digital Assets

> **Speculation with a floor. SOL that remembers.**
>
> Not a token. Not an NFT. A third model for digital assets.

---

## What Is EVO?

Digital assets today force you to choose between fungibility (tokens) and uniqueness (NFTs). EVO introduces a third model: unique programmable assets with intrinsic redeemable value.

```
Token  = fungible, no memory, no floor
NFT    = non-fungible, static, no floor, can go to zero
EVO    = non-fungible, SOL-backed floor, carries state, always redeemable
```

### The Value Model

```
Market Price = Intrinsic Floor + Speculative Premium
```

- **Intrinsic value**: SOL locked inside the EVO account — redeemable via shatter
- **Market value**: novelty, rarity, culture, speculation

An EVO trades like a collectible, holds like an NFT, and can't go below its floor. Degens speculate on the premium. The reserve protects the downside. When hype dies, supply contracts via shatter — remaining holders benefit from increased scarcity.

### The Architectural Claim

**Metaplex treats lamports as rent. EVO treats lamports as economic state.**

An EVO is one atomic economic object — identity, value, and behavior in the same account. Not a token pointing to a vault. The account IS the asset. The SOL is in the account, not next to it.

> Transfer a Metaplex NFT without its vault. You can. Transfer an EVO without its SOL. You can't — the reserve and object state occupy the same program-owned account, and every ownership transition is governed by the same protocol.

See [Protocol Design](docs/11-protocol-design.md) for the full architectural thesis.

---

## The One-Sentence Pitch

> Every collectible has real value inside it. Trade stories. Keep your floor.

Degens trade narratives — rarity, provenance, status, upside. EVO gives that speculation a safety net: the locked SOL inside is always reclaimable via shatter.

**Worst case:** shatter and recover your floor.
**Best case:** trade it for 10x because the story is hot.

That's **speculation with a floor.** Not a store of value. Not a degen casino. Both.

---

## How It Works

```
Forge   → Create an EVO. Pay mint_price (to creator) + lock_amount (inside EVO).
Feed    → Add more SOL. Floor goes up.
Trade   → Sell to anyone. Market sets the premium. Floor protects the downside.
Shatter → Destroy the EVO. Reclaim locked SOL (minus fee). Object gone forever.
Transfer → Send to anyone. No marketplace required.
```

### The Two-Layer Value Model

| Layer | What it is | Who gets it |
|-------|-----------|-------------|
| **lock_amount** | SOL locked inside the EVO PDA — the floor | Owner (reclaimable via shatter) |
| **mint_price** | Price to forge — the speculative entry | Creator (at mint) |
| **market premium** | What someone pays above the floor | Seller (on resale) |

Example: An EVO contains 1 SOL. It trades for 4 SOL. Why? Because it's the first Genesis object from Artist X, survived 500 trades, and only 100 exist.

Worst case: shatter, recover ~1 SOL. The downside is defined.

---

## The Primitive (Minimal)

What's the smallest possible EVO?

**Value + ownership + a behavior interface.**

That's it. Everything else is built BY OTHER PEOPLE:

| Layer | What it is | Who builds it |
|-------|-----------|---------------|
| Protocol (EVO) | forge, shatter, transfer, feed, behavior interface | Us |
| Apps (Vault, Legacy, Patron, etc.) | Behavior templates using the interface | Anyone |
| Marketplace | Trading layer | Independent protocols |
| History | Provenance tracking | Indexers |
| Art/media | Visual presentation | Frontends |

EVO exposes the interface. The community builds the behaviors.

---

## Program — Deployed on Mainnet

| | |
|---|---|
| **Program ID** | `7USTJBsRTmCnjowPgmh6s5igTZeaFPE7X43rZnhmm5sc` |
| **Old Program (CLOSED)** | `2AUfmSABAwfSAzMWuDfWXzm6TVVvVapWgtrAEBU4FHeR` |
| **Authority/Treasury** | `G3aWJsdtrRT12HnC9R2BVoyErQbtGXseaM9c2xt1MJUJ` |
| **Network** | Solana Mainnet |
| **Status** | Deployed, NOT yet initialized |

### Instructions
- `initialize_protocol` — one-time setup
- `create_collection` — creator sets supply, mint_price, lock_amount, fees, metadata_uri, lifecycle, randomness, burn_destination
- `commit_reveal` — creator commits hash(secret) before minting for provably fair reveal
- `forge` — mint EVO (pays mint_price to creator, locks SOL inside)
- `feed` — add SOL to existing EVO (increases floor, tracked for evolution)
- `list` / `delist` — marketplace listing
- `buy` — purchase listed EVO (royalties distributed)
- `shatter` — destroy EVO, reclaim locked SOL
- `transfer` — send EVO to new owner
- `close_collection` — close empty collection, refund rent to creator
- `update_metadata` — update collection metadata_uri (creator only)
- `reveal_collection` — reveal authority provides secret, program verifies against commitment and derives entropy = keccak256(secret)
- `evolve` — permissionless, advances EVO to next lifecycle stage if thresholds met

### Provably Fair Reveal

Collections can use commit-reveal to prevent the creator from choosing favorable reveal entropy:

1. **Before minting**: Creator calls `commit_reveal(keccak256(secret))` — stores the commitment hash
2. **Minting occurs**: Users forge EVOs with sequential mint indices
3. **Reveal**: Reveal authority calls `reveal_collection(secret)` — program verifies `keccak256(secret) == commitment` and derives `reveal_entropy = keccak256(secret)`

The creator cannot try multiple secrets to find a favorable assignment — the commitment is locked before anyone mints.

### Configurable Burn Destination

Collections can configure a custom burn destination (defaults to Solana's incinerator). This allows:
- **Production**: Burn fees go to `1nc1nerator11111111111111111111111111111111` (irreversible)
- **Testing**: Burn fees go to a test wallet — enabling exact balance verification

Set via `burn_destination` in `LifecycleParams` at collection creation time.

---

## Documentation

| Document | Description |
|----------|-------------|
| [01 — Concept](docs/01-concept.md) | Why capital needs identity — the stateful capital thesis |
| [02 — Mechanics](docs/02-mechanics.md) | Forge, feed, trade, shatter — the lifecycle |
| [03 — Art System](docs/03-art-system.md) | Generative art from on-chain data — ships with the primitive |
| [04 — Economics](docs/04-economics.md) | Two-layer value, speculation with a floor, fee structure |
| [05 — Protocol](docs/05-protocol.md) | Minimal primitive, behavior interface, composability |
| [06 — Competitive Moat](docs/06-competitive-moat.md) | Why EVO wins as a category |
| [07 — EVO vs Everything](docs/07-comparison.md) | EVO vs tokens, NFTs, escrow |
| [08 — Roadmap](docs/08-roadmap.md) | Build phases — primitive + art together, behaviors next |
| [09 — Security](docs/09-security-review.md) | Audit notes, security model |
| [10 — Wallet Integration](docs/10-wallet-integration.md) | SDK for wallets and developers |
| [11 — Protocol Design](docs/11-protocol-design.md) | Why EVO is a third model for digital assets — the architectural thesis |
| [White Paper](WHITEPAPER.md) | Full technical white paper — architecture, value model, lifecycle, security, roadmap |

---

## Quick Start

```bash
git clone https://github.com/stephenclawdbot-png/EVO.git
cd EVO

# Build the program (requires Anchor + Solana CLI)
anchor build

# Frontend
cd frontend
npm install
npm run dev
```

---

*EVO — Stateful Capital. SOL that remembers.*
*Not a token. Not an NFT. Programmable value.*
