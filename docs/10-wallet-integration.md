# 10 — Wallet Integration Guide

## Overview

This document explains how wallet developers (Phantom, Solflare, Backpack, etc.) integrate EVO support so users can see their EVOs and locked SOL directly in their wallet UI.

## Why Integrate

- **User demand** — EVO owners want to see their locked SOL and evolving art
- **No cost** — our SDK does all the work, wallets just import it
- **30-minute integration** — one npm package, one function call

## What We Provide

| Package | Purpose |
|---|---|
| `@evo/sdk` | Read EVO accounts from Solana (findByOwner, getEvo, etc.) |
| `@evo/renderer` | Canvas-based generative art renderer (no images needed) |

Both are MIT licensed, open source, and available on npm.

## Integration Steps

### Step 1: Install

```bash
npm install @evo/sdk @evo/renderer @solana/web3.js
```

### Step 2: Find User's EVOs

```typescript
import { Connection } from '@solana/web3.js';
import { EvoClient } from '@evo/sdk';

// When user connects wallet:
const connection = new Connection(rpcEndpoint);
const client = new EvoClient(connection);

const evos = await client.findDisplayByOwner(wallet.publicKey);
```

### Step 3: Display in Wallet UI

```typescript
// Total locked value
const totalLocked = evos.reduce((sum, e) => sum + e.lockedSol, 0);

// Render in wallet's asset list:
evos.forEach(evo => {
  // evo.account.address — PDA address
  // evo.lockedSol — locked SOL amount
  // evo.stage — 'baby' | 'juvenile' | 'adult' | 'elder'
  // evo.ageString — "3w ago"
  // evo.listPriceSol — if listed for sale
});
```

### Step 4: Render Art (optional)

```typescript
import { renderEvo } from '@evo/renderer';

const canvas = document.createElement('canvas');
const rawAccount = await client.getEvo('Z', 42);
if (rawAccount) {
  renderEvo(canvas, rawAccount, { width: 128, height: 128 });
  // Use canvas in your UI
}
```

### Step 5: Deep Link to z.fun (optional)

```typescript
// Link to EVO detail page
const url = `https://z.fun/z/${evoId}`;
```

## Account Layout

EVO PDAs have a fixed binary layout. Wallets can also deserialize manually:

```
Offset  Size  Field
0       8     Anchor discriminator
8       32    collection (Pubkey)
40      32    owner (Pubkey)        ← filter on this for findByOwner
72      8     lockedLamports (u64)
80      8     forgedAt (i64)
88      4     facetCount (u32)
92      4     tradeCount (u32)
96      32    resonanceSeed ([u8; 32])
128     4     fractureLines.length (u32)
132     var   fractureLines[] (48 bytes each)
...     1     isListed (bool)
...     1+8   listPriceLamports (Option<u64>)
...     1     isShattered (bool)
```

## PDA Derivation

```
Collection PDA = ["collection", collectionName] + programId
EVO PDA        = ["evo", collectionPDA, evoId(u32 LE)] + programId
```

## Safety Guarantees

- **Program is immutable** — no upgrade authority after deployment
- **Shatter always works** — users can reclaim SOL even if z.fun goes down
- **No admin keys** — no one can freeze, modify, or steal EVOs
- **SOL is in the PDA** — not held by any team wallet

## Contact

- GitHub: https://github.com/stephenclawdbot-png/EVO
- Program ID: `Ev0Evo11111111111111111111111111111111111111` (placeholder — update after mainnet deploy)

---

*Part of the [EVO documentation](../README.md)*