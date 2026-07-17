# EVO Marketplace Integration Guide

**For:** OpenSea, Magic Eden, Tensor, and other Solana NFT/marketplace platforms.
**SDK:** `@evo/sdk` v0.2.0+
**Program ID:** `7USTJBsRTmCnjowPgmh6s5igTZeaFPE7X43rZnhmm5sc`

---

## TL;DR

EVOs are **not SPL tokens.** They are custom PDAs with their own account layout,
ownership model, and trading mechanism. You cannot use the Metaplex Token Metadata
indexer. You must integrate via the `@evo/sdk`.

The good news: the SDK gives you everything you need in ~100 lines of code.

---

## What is an EVO?

An EVO (Evolving Value Object) is a Solana PDA that holds **locked SOL** and evolves
over time. Think of it as a savings bond crossed with a collectible:

| Property | NFT (Metaplex) | EVO |
|---|---|---|
| Account type | SPL Token + Metadata | Custom PDA |
| Ownership | Token account balance | `owner` field in PDA |
| Transfer | SPL `transfer` | EVO `transfer` instruction |
| Value | Market-determined | Locked SOL (floor) + market premium |
| Evolution | Static (or dynamic via metadata) | On-chain state machine |
| Royalties | Metaplex creators array | Collection config (bps + destination) |
| Listing | Marketplace escrow / SPL delegate | On-chain `isListed` + `listPriceLamports` |

---

## Integration Steps

### 1. Install the SDK

```bash
npm install @evo/sdk @solana/web3.js
```

### 2. Index EVOs

EVOs are program accounts. Use `getProgramAccounts` with the EVO discriminator:

```typescript
import { Connection, PublicKey } from '@solana/web3.js';
import {
  EvoClient,
  EVO_PROGRAM_ID,
  EVO_ACCOUNT_DISCRIMINATOR,
  deserializeEVOAccount,
  COLLECTION_CONFIG_DISCRIMINATOR,
  deserializeCollectionConfig,
} from '@evo/sdk';

const connection = new Connection('https://api.mainnet-beta.solana.com');

// Index all collections
const collectionAccounts = await connection.getProgramAccounts(
  new PublicKey(EVO_PROGRAM_ID),
  {
    filters: [
      { memcmp: { offset: 0, bytes: base58(COLLECTION_CONFIG_DISCRIMINATOR) } },
    ],
  },
);
const collections = collectionAccounts
  .map(({ account, pubkey }) => {
    try {
      return deserializeCollectionConfig(account.data, pubkey.toBase58());
    } catch { return null; }
  })
  .filter(Boolean);

// Index all EVOs
const evoAccounts = await connection.getProgramAccounts(
  new PublicKey(EVO_PROGRAM_ID),
  {
    filters: [
      { memcmp: { offset: 0, bytes: base58(EVO_ACCOUNT_DISCRIMINATOR) } },
    ],
  },
);
const evos = evoAccounts
  .map(({ account, pubkey }) => {
    try {
      return deserializeEVOAccount(account.data, pubkey.toBase58());
    } catch { return null; }
  })
  .filter(Boolean);
```

### 3. Show listed EVOs on your marketplace

```typescript
const listedEvos = evos.filter(e => e.isListed && !e.isShattered);

// Display each listed EVO:
listedEvos.forEach(evo => {
  const collection = collections.find(c => /* match by PDA */);
  console.log({
    name: `${collection.name} #${evo.id}`,
    price: lamportsToSol(evo.listPriceLamports) + ' SOL',
    lockedSol: lamportsToSol(evo.lockedLamports),
    owner: evo.owner,
  });
});
```

### 4. Implement "Buy" flow

When a buyer clicks Buy on a listed EVO:

```typescript
import { createBuyIx, getCollectionPDA, getEVOPDA } from '@evo/sdk';

const [collectionPda] = getCollectionPDA(collectionName);
const [evoPda] = getEVOPDA(collectionPda, evoId);

const ix = createBuyIx(
  evoPda,
  collectionPda,
  new PublicKey(evo.owner),      // seller (current owner)
  new PublicKey(collection.creator), // creator
  buyer.publicKey,                // buyer (signer)
  protocolTreasury,               // from ProtocolConfig
  collection.royaltyDest,         // 'Treasury' | 'Creator' | 'Burn' | 'Split'
);

const tx = new Transaction().add(ix);
tx.feePayer = buyer.publicKey;
// ... get blockhash, sign, send
```

### 5. Implement "List" flow

```typescript
import { createListIx, LAMPORTS_PER_SOL } from '@evo/sdk';

const ix = createListIx(evoPda, seller.publicKey, 2.5 * LAMPORTS_PER_SOL);
// Seller signs
```

### 6. Implement "Delist" flow

```typescript
import { createDelistIx } from '@evo/sdk';

const ix = createDelistIx(evoPda, seller.publicKey);
// Seller signs
```

---

## Key Differences from NFT Marketplaces

### No escrow needed

EVOs use **on-chain listing.** The `isListed` and `listPriceLamports` fields are
stored in the EVO PDA itself. There is no separate escrow account or delegate.
The marketplace just builds the `buy` instruction — the program handles ownership
transfer, SOL payment, and royalties atomically.

### No token accounts

EVO ownership is tracked in the PDA's `owner` field. There are no SPL token
accounts to check. A user "owns" an EVO if `evo.owner == userPublicKey`.

### Royalties are enforced on-chain

The collection config specifies `tradeRoyaltyBps` and `royaltyDest`. The program
enforces these — buyers cannot bypass royalties. Marketplaces do not need to
enforce royalties separately.

### No Metaplex metadata

EVOs do not have Metaplex metadata accounts. The collection's `metadataUri`
points to an off-chain JSON manifest (hosted on Arweave) that contains artwork
URLs, descriptions, and traits. Use this URI to display artwork.

### Locked SOL is the floor price

Every EVO has locked SOL. If an EVO has 0.1 SOL locked, its floor value is 0.1 SOL
(recoverable via shatter, minus fee). Market prices can be above this floor but
never below (rational actors would shatter instead of selling below floor).

---

## Webhook / Indexer Setup

For real-time updates, subscribe to program account changes:

```typescript
const subscriptionId = connection.onProgramAccountChange(
  new PublicKey(EVO_PROGRAM_ID),
  (accountInfo, context) => {
    // Parse accountInfo.data as EVO or CollectionConfig
    // Update your index
  },
);
```

---

## FAQ

**Can we use our existing Metaplex indexer?**
No. EVOs are not Metaplex NFTs. You need a separate indexer using the EVO SDK.

**Can users list on both EVO and OpenSea simultaneously?**
No. Listing is on-chain in the EVO PDA. An EVO is either listed (on EVO's native
marketplace) or not. However, a marketplace can build a UI that reads EVO listings
and presents them alongside NFT listings.

**How do we handle "offers"?**
Offers are not yet supported on-chain. If demand exists, the protocol can add an
offer instruction. For now, marketplaces can implement off-chain offer books with
on-chain settlement via `createBuyIx` when an offer is accepted (seller lists at
the offer price, buyer buys).

**How do we display EVO artwork?**
The collection's `metadataUri` points to a JSON manifest. Fetch it, then use the
manifest's image URLs to display artwork. The `@evo/renderer` package can render
generative art from the on-chain `resonanceSeed` if the collection uses generative
art instead of static images.

**What about royalties on secondary sales?**
Royalties are enforced on-chain via `tradeRoyaltyBps` in the collection config.
Every `buy` transaction routes royalties automatically. Marketplaces cannot
bypass this.

---

## Contact

- GitHub: https://github.com/stephenclawdbot-png/EVO
- Program: `7USTJBsRTmCnjowPgmh6s5igTZeaFPE7X43rZnhmm5sc`
- SDK: `@evo/sdk` on npm (after mainnet launch)
