# 01 — The Concept

## The Thesis

> **Why should capital become an object instead of remaining fungible?**

Because **fungibility erases meaning.**

When I send you 1 SOL, you don't know if I earned it, was gifted it, or what it was meant for. The history is gone. The value is clean — but it's anonymous. Fungibility is great for exchange. It's terrible for meaning.

EVO's thesis: sometimes meaning is worth more than liquidity.

A gift of SOL should carry the fact that it was a gift. A commitment should carry its conditions. A patron's contribution should carry its provenance. Today, none of that can survive a transfer. The moment SOL moves, it's blank again.

**Stateless capital → stateful capital.** That's the whole primitive.

---

## What Is an EVO?

An **EVO** is a Solana account that:

1. **Holds SOL** — Lamports live inside the PDA, physically isolated
2. **Carries state** — History, behavior, permissions — without becoming a token
3. **Has a floor** — Shatter to reclaim locked SOL. The downside is defined
4. **Is transferable** — Move the whole object — value + state — to anyone
5. **Is composable** — Other programs can read ownership, value, and behavior

No SPL token. No Metaplex metadata. No image file. Just a PDA with SOL and state.

---

## The One Sentence

> **EVO makes SOL stateful — letting capital carry history, permissions, and behavior as a transferable object, without becoming a token.**

Or even shorter:

> **SOL that remembers.**

---

## Speculation With a Floor

This is the pitch that makes it click:

```
An EVO contains 1 SOL.
It trades for 4 SOL.
Why? Because famous creator, rare, old, survived 500 trades, community wants it.
Worst case? Shatter. Recover your floor.
```

That's psychologically very different from buying a JPEG that can go to zero.

You're not eliminating speculation. You're **grounding it.**

Every collectible has real value inside it. Trade stories. Keep your floor.

---

## Why It's Not a Token

- No fungible supply. Each EVO is a unique position, not an SPL token
- No token mint, no token account
- You don't send tokens to trade — you transfer ownership of the PDA
- No mint authority after the collection cap is reached

## Why It's Not an NFT

- No static image. No metadata URI. No Arweave/IPFS pin
- No Metaplex standard. No token standard at all — just a custom program account
- Backed by real value (locked SOL), not just scarcity
- Art is optional and LAST priority — the primitive works without any media

## Why It's Not Just "NFT + Escrow"

| | NFT + Escrow | EVO |
|---|---|---|
| Token mint exists | Yes (SPL/Metaplex) | No |
| Ownership | Token standard | Native program state |
| Value location | Separate escrow PDA | Inside the owned object |
| Redemption | Requires escrow program | Built into the object |
| Standard interface | No (each is ad hoc) | Yes (EVO Standard Interface) |
| Other programs verify | Must read escrow separately | Read EVO directly |

NFT + escrow is a **pattern** that must be reimplemented every time. EVO is a **standard** — defined once, composed by anyone.

---

## The Smallest Possible EVO

Delete every feature. Delete behaviors, art, marketplace, history. What remains?

**Value + ownership + a behavior interface.**

Three things. That's the primitive.

Bitcoin's genius was **money**, not scripting.
Ethereum's genius was **computation**, not NFTs.
SPL Token's genius was **fungible asset**, not wallets.

EVO's genius: **stateful capital.**

The behaviors (Vault, Legacy, Patron) are apps built BY OTHER PEOPLE on top of the interface. The protocol just exposes the surface. That's what makes it a primitive, not an app.

---

## The Category

| Asset Class | Key Property | Example |
|---|---|---|
| Fungible Token | Interchangeable units | SOL, USDC |
| Non-Fungible Token | Unique static items | CryptoPunks, Bored Apes |
| **Stateful Capital** | **Value + state, transferable, redeemable** | **EVO** |

---

*Part of the [EVO documentation](../README.md)*
