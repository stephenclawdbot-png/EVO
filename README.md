# EVO — Stateful Capital

> **Speculation with a floor. SOL that remembers.**
>
> Not a token. Not an NFT. Capital that carries state through transfer.

---

## What Is EVO?

An **EVO** is a Solana account that holds SOL and carries state — history, permissions, and behavior — as a single transferable object.

```
Token  = fungible, no memory, no floor
NFT    = non-fungible, static, no floor, can go to zero
EVO    = non-fungible, SOL-backed floor, carries state, always redeemable
```

The thesis is simple:

> **Fungibility erases meaning. EVO lets capital carry context without becoming a token.**

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

## Program — Live on Mainnet

| | |
|---|---|
| **Program ID** | `2AUfmSABAwfSAzMWuDfWXzm6TVVvVapWgtrAEBU4FHeR` |
| **Protocol Config PDA** | `EuLuQqUVq5ze2E5P43MLsYUxQLXskCCAvMK1evdNajRi` |
| **Authority** | `G3aWJsdtrRT12HnC9R2BVoyErQbtGXseaM9c2xt1MJUJ` |
| **Network** | Solana Mainnet |
| **Creation Fee** | 0.06789 SOL |

### Instructions
- `initialize_protocol` — one-time setup
- `create_collection` — creator sets supply, mint_price, lock_amount, fees
- `forge` — mint EVO (pays mint_price to creator, locks SOL inside)
- `feed` — add SOL to existing EVO
- `list` / `delist` — marketplace listing
- `buy` — purchase listed EVO (royalties distributed)
- `shatter` — destroy EVO, reclaim locked SOL
- `transfer` — send EVO to new owner

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
