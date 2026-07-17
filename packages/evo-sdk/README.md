# @evo/sdk

TypeScript SDK for reading AND writing EVO (Evolving Value Object) data on Solana.

**v0.2.0** — now with full write support (instruction builders for all 14 protocol operations).

## What is EVO?

EVO is a Solana-native primitive: **SOL locked inside a PDA that evolves over time.**
Not a token. Not an NFT. Stateful capital you can forge, trade, feed, evolve, and shatter.

- **Forge:** Lock SOL inside a new EVO PDA
- **Trade:** Buy/list/delist on-chain (no escrow — price includes locked SOL)
- **Feed:** Add more SOL to increase locked value
- **Evolve:** Advance visual stage by hitting trade/feed/hold/lock thresholds
- **Shatter:** Destroy the EVO and recover locked SOL (minus fee)

## Install

```bash
npm install @evo/sdk @solana/web3.js
```

## Program ID

```
7USTJBsRTmCnjowPgmh6s5igTZeaFPE7X43rZnhmm5sc
```

Deployed on devnet. Ready for mainnet initialization.

---

## Quick Start

### Read: Show a user's EVOs (for wallets)

```typescript
import { Connection } from '@solana/web3.js';
import { EvoClient } from '@evo/sdk';

const connection = new Connection('https://api.mainnet-beta.solana.com');
const client = new EvoClient(connection);

// On wallet connect:
const myEvos = await client.findDisplayByOwner(wallet.publicKey);

// Render in wallet UI:
myEvos.forEach(evo => {
  console.log(`${evo.account.address} — ${evo.lockedSol} SOL — ${evo.stage}`);
});
```

### Write: Forge an EVO (for marketplaces / Telegram bots)

```typescript
import { Connection, Transaction, PublicKey } from '@solana/web3.js';
import {
  EvoClient,
  createForgeIx,
  generateResonanceSeed,
  LAMPORTS_PER_SOL,
} from '@evo/sdk';

const client = new EvoClient(connection);

// 1. Read collection config to get current supply + creator
const cfg = await client.getCollectionConfig('Genesis');
if (!cfg) throw new Error('Collection not found');

// 2. Build forge instruction
const collectionPda = (await import('@evo/sdk')).getCollectionPDA('Genesis')[0];
const ix = createForgeIx(
  buyerPubkey,             // owner (signer)
  collectionPda,           // collection PDA
  new PublicKey(cfg.authority), // creator
  cfg.currentSupply,       // next EVO ID
  generateResonanceSeed(), // random 32-byte seed
);

// 3. Send transaction
const tx = new Transaction().add(ix);
// ... sign and send
```

### Write: Buy a listed EVO (for marketplaces)

```typescript
import { createBuyIx, EvoClient } from '@evo/sdk';

const client = new EvoClient(connection);
const evo = await client.getEvo('Genesis', 5);
const cfg = await client.getCollectionConfig('Genesis');

if (!evo || !evo.isListed) throw new Error('Not listed');

const [collectionPda] = getCollectionPDA('Genesis');
const [evoPda] = getEVOPDA(collectionPda, 5);

const ix = createBuyIx(
  evoPda,
  collectionPda,
  new PublicKey(evo.owner),    // seller
  new PublicKey(cfg.authority), // creator
  buyerPubkey,                  // buyer (signer)
  protocolTreasury,             // protocol treasury
  'Creator',                    // royalty destination
);

const tx = new Transaction().add(ix);
// ... sign and send
```

### Write: Shatter to recover SOL

```typescript
import { createShatterIx } from '@evo/sdk';

const ix = createShatterIx(
  evoPda,
  collectionPda,
  ownerPubkey,    // signer
  creatorPubkey,
  protocolTreasury,
  evoId,
  'Treasury',     // shatter fee destination
);

const tx = new Transaction().add(ix);
// ... sign and send
```

---

## Wallet Integration Guide

### 1. Display EVOs in a user's portfolio

```typescript
import { EvoClient } from '@evo/sdk';

const client = new EvoClient(connection);

// On connect:
const evos = await client.findDisplayByOwner(wallet.publicKey);

// Group by collection
const byCollection = new Map();
for (const evo of evos) {
  const key = evo.account.collection;
  if (!byCollection.has(key)) byCollection.set(key, []);
  byCollection.get(key).push(evo);
}

// Total locked SOL
const totalLocked = evos.reduce((s, e) => s + e.lockedSol, 0);
```

### 2. Show EVO detail

```typescript
const evo = await client.getEvoDisplay('Genesis', 42);
if (evo) {
  // {
  //   account: { address, owner, lockedLamports, ... },
  //   lockedSol: 0.1,
  //   stage: 'juvenile',
  //   ageString: '3w ago',
  //   totalValueSol: 0.1,
  //   listPriceSol: 2.5
  // }
}
```

### 3. Listen for EVOs by scanning all program accounts

```typescript
import { EvoClient, EVO_ACCOUNT_DISCRIMINATOR } from '@evo/sdk';

// Use getProgramAccounts with memcmp on discriminator
const allEvos = await connection.getProgramAccounts(
  new PublicKey(EVO_PROGRAM_ID),
  {
    filters: [
      { memcmp: { offset: 0, bytes: base58(EVO_ACCOUNT_DISCRIMINATOR) } },
    ],
  },
);
```

---

## Marketplace Integration Guide

EVOs are **PDAs, not SPL tokens.** Marketplaces cannot use the standard
Metaplex token metadata indexer. Instead, they integrate via this SDK.

### OpenSea / Magic Eden integration

```typescript
import {
  EvoClient,
  createListIx,
  createDelistIx,
  createBuyIx,
  getCollectionPDA,
  getEVOPDA,
} from '@evo/sdk';

const client = new EvoClient(connection);

// --- Listing flow ---
// 1. User lists their EVO on your marketplace
const [evoPda] = getEVOPDA(collectionPda, evoId);
const listIx = createListIx(evoPda, sellerPubkey, priceLamports);
// User signs the list transaction
// 2. Your marketplace indexes listed EVOs by scanning isListed=true

// --- Buying flow ---
// 1. Buyer clicks "Buy" on your marketplace
const buyIx = createBuyIx(
  evoPda,
  collectionPda,
  sellerPubkey,
  creatorPubkey,
  buyerPubkey,
  treasuryPubkey,
  royaltyDest,
);
// 2. Buyer signs the buy transaction
// 3. EVO ownership transfers on-chain, locked SOL stays
```

### Indexing listed EVOs

```typescript
// Scan all EVOs that are listed for sale
const listedEvos = await connection.getProgramAccounts(PROGRAM, {
  filters: [
    { memcmp: { offset: 0, bytes: base58(EVO_ACCOUNT_DISCRIMINATOR) } },
    // isListed is at a fixed offset after discriminator + collection + owner +
    // lockedLamports + forgedAt + facetCount + tradeCount + resonanceSeed +
    // fractureLines(vec) — use the layout from layout.ts
  ],
});
// Parse with deserializeEVOAccount, filter isListed === true
```

### Important: EVOs are NOT SPL tokens

- EVOs do not use the Metaplex Token Metadata program
- EVOs are custom PDAs with their own account layout
- Ownership is tracked in the EVO account's `owner` field, not via token accounts
- Transfers use the EVO `transfer` instruction, not SPL `transfer`
- Marketplaces must build EVO-specific buy/list/delist flows using this SDK

---

## Telegram Trading Bot Integration Guide

For bots like gmgn, fomo, bloom that let users trade via Telegram:

### 1. Forge command

```typescript
// /forge Genesis
import { createForgeIx, generateResonanceSeed } from '@evo/sdk';

const ix = createForgeIx(
  userPubkey,
  collectionPda,
  creatorPubkey,
  currentSupply,
  generateResonanceSeed(),
);
// Build tx, user signs via wallet adapter or keypad
```

### 2. Buy command

```typescript
// /buy Genesis 5
import { createBuyIx } from '@evo/sdk';

const evo = await client.getEvo('Genesis', 5);
if (!evo?.isListed) throw new Error('Not for sale');

const ix = createBuyIx(
  evoPda,
  collectionPda,
  new PublicKey(evo.owner),
  creatorPubkey,
  userPubkey,
  treasuryPubkey,
  'Creator',
);
```

### 3. Shatter command

```typescript
// /shatter Genesis 5
import { createShatterIx } from '@evo/sdk';

const ix = createShatterIx(
  evoPda,
  collectionPda,
  userPubkey,
  creatorPubkey,
  treasuryPubkey,
  5,
  'Treasury',
);
```

### 4. Feed command

```typescript
// /feed Genesis 5 0.1
import { createFeedIx, LAMPORTS_PER_SOL } from '@evo/sdk';

const ix = createFeedIx(evoPda, userPubkey, 0.1 * LAMPORTS_PER_SOL);
```

### 5. List / Delist

```typescript
// /list Genesis 5 2.5
const listIx = createListIx(evoPda, userPubkey, 2.5 * LAMPORTS_PER_SOL);

// /delist Genesis 5
const delistIx = createDelistIx(evoPda, userPubkey);
```

### Important for Telegram bots

- Users sign transactions via deep link to wallet (Phantom, Solflare)
- Or via keypad-based signing if bot holds encrypted keypair
- Always verify the EVO exists and is listed before building buy ix
- Self-trade is blocked (buyer != seller enforced on-chain)

---

## API Reference

### `EvoClient` (read)

| Method | Returns | Description |
|---|---|---|
| `findByOwner(wallet)` | `EVOAccount[]` | All EVOs owned by a wallet |
| `findDisplayByOwner(wallet)` | `EvoDisplayData[]` | Same, with human-readable values |
| `getEvo(collection, id)` | `EVOAccount \| null` | Single EVO by collection name + ID |
| `getEvoByAddress(address)` | `EVOAccount \| null` | Single EVO by PDA address |
| `getCollectionEvos(name)` | `EVOAccount[]` | All EVOs in a collection |
| `getCollectionConfig(name)` | `CollectionConfig \| null` | Collection metadata |
| `getEvoDisplay(collection, id)` | `EvoDisplayData \| null` | Display data for one EVO |

### Instruction Builders (write)

| Function | Description | Signer |
|---|---|---|
| `createInitializeProtocolIx` | One-time protocol init | authority |
| `createCreateCollectionIx` | Create a new collection | payer |
| `createForgeIx` | Mint a new EVO with locked SOL | owner |
| `createFeedIx` | Add SOL to an EVO | feeder |
| `createListIx` | List EVO for sale | seller |
| `createDelistIx` | Remove from sale | seller |
| `createBuyIx` | Buy a listed EVO | buyer |
| `createShatterIx` | Destroy EVO, recover SOL | owner |
| `createTransferIx` | Transfer EVO ownership | currentOwner |
| `createUpdateMetadataIx` | Update collection URI | creator |
| `createRevealCollectionIx` | Reveal collection art | authority |
| `createEvolveIx` | Evolve EVO (permissionless) | none |
| `createSetVisualStageIx` | Override stage (custom) | authority |
| `generateResonanceSeed()` | Random 32-byte seed | — |

### PDA Derivation

```typescript
import { getCollectionPDA, getEVOPDA, getProtocolConfigPDA } from '@evo/sdk';

const [collectionPda, bump] = getCollectionPDA('Genesis');
const [evoPda, bump] = getEVOPDA(collectionPda, 42);
const [protocolPda, bump] = getProtocolConfigPDA();
```

### Display Helpers

```typescript
import { getStage, lamportsToSol, getAgeString } from '@evo/sdk';

getStage(35);              // 'adult'
lamportsToSol(100_000_000); // 0.1
getAgeString(forgedAt);     // '3w ago'
```

### Types

```typescript
interface EVOAccount {
  address: string;
  collection: string;
  owner: string;
  lockedLamports: number;
  forgedAt: number;
  facetCount: number;
  tradeCount: number;
  resonanceSeed: string;
  fractureLines: FractureLine[];
  isListed: boolean;
  listPriceLamports: number | null;
  isShattered: boolean;
}

interface EvoDisplayData {
  account: EVOAccount;
  lockedSol: number;
  stage: 'baby' | 'juvenile' | 'adult' | 'elder';
  ageString: string;
  totalValueSol: number;
  listPriceSol: number | null;
}
```

## Constants

```typescript
import { EVO_PROGRAM_ID, LAMPORTS_PER_SOL, INCINERATOR } from '@evo/sdk';

EVO_PROGRAM_ID  // '7USTJBsRTmCnjowPgmh6s5igTZeaFPE7X43rZnhmm5sc'
LAMPORTS_PER_SOL // 1_000_000_000
INCINERATOR     // '1nc1nerator11111111111111111111111111111111'
```

## License

MIT
