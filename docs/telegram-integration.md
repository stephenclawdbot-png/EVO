# EVO Telegram Trading Bot Integration Guide

**For:** gmgn, fomo, bloom, and other Telegram-based Solana trading terminals.
**SDK:** `@evo/sdk` v0.2.0+
**Program ID:** `7USTJBsRTmCnjowPgmh6s5igTZeaFPE7X43rZnhmm5sc`

---

## TL;DR

EVOs are Solana PDAs with locked SOL inside. Users can forge, buy, sell, feed,
evolve, and shatter them — all via on-chain instructions. Your Telegram bot can
support all of these operations using `@evo/sdk`.

The SDK gives you instruction builders for every operation. Your bot constructs
the transaction, the user signs it (via deep link or keypad), and the program
executes atomically.

---

## What is EVO?

EVO = **Evolving Value Object.** A Solana PDA that:
- Holds locked SOL (the "floor value")
- Evolves visually over time (stages: baby → juvenile → adult → elder)
- Can be traded (buy/list/delist) with enforced royalties
- Can be fed (add more SOL to increase locked value)
- Can be shattered (destroy to recover SOL, minus fee)

Think pump.fun meets savings bond. The locked SOL gives every EVO a real floor
price — you can always shatter to recover.

---

## Setup

```bash
npm install @evo/sdk @solana/web3.js
```

```typescript
import { Connection } from '@solana/web3.js';
import {
  EvoClient,
  createForgeIx,
  createBuyIx,
  createListIx,
  createDelistIx,
  createFeedIx,
  createShatterIx,
  createEvolveIx,
  generateResonanceSeed,
  getCollectionPDA,
  getEVOPDA,
  LAMPORTS_PER_SOL,
} from '@evo/sdk';

const connection = new Connection('https://api.mainnet-beta.solana.com');
const client = new EvoClient(connection);
```

---

## Commands

### `/collections` — List all collections

```typescript
async function listCollections() {
  // Scan all CollectionConfig accounts
  const accounts = await connection.getProgramAccounts(PROGRAM, {
    filters: [{ memcmp: { offset: 0, bytes: base58(COLLECTION_CONFIG_DISCRIMINATOR) } }],
  });
  // Deserialize and display:
  // Genesis — 85/10,000 — 0.5 SOL mint — 28.5 SOL locked
  // Lunar Raiders — 38/5,000 — 0.3 SOL mint — 15.2 SOL locked
}
```

### `/floor <collection>` — Show floor price

```typescript
async function showFloor(collectionName: string) {
  const evos = await client.getCollectionEvos(collectionName);
  const listed = evos.filter(e => e.isListed && !e.isShattered);
  if (listed.length === 0) return 'No listings';
  const floor = Math.min(...listed.map(e => e.listPriceLamports));
  return `Floor: ${lamportsToSol(floor)} SOL (${listed.length} listed)`;
}
```

### `/forge <collection>` — Mint a new EVO

```typescript
async function forge(userPubkey: PublicKey, collectionName: string) {
  const cfg = await client.getCollectionConfig(collectionName);
  if (!cfg) throw new Error('Collection not found');
  if (cfg.currentSupply >= cfg.maxSupply) throw new Error('Collection full');

  const [collectionPda] = getCollectionPDA(collectionName);
  const ix = createForgeIx(
    userPubkey,
    collectionPda,
    new PublicKey(cfg.authority),
    cfg.currentSupply,
    generateResonanceSeed(),
  );

  const tx = new Transaction().add(ix);
  // ... add blockhash, set feePayer, send to user for signing
}
```

### `/buy <collection> <id>` — Buy a listed EVO

```typescript
async function buy(userPubkey: PublicKey, collectionName: string, evoId: number) {
  const evo = await client.getEvo(collectionName, evoId);
  if (!evo || !evo.isListed) throw new Error('Not for sale');

  const [collectionPda] = getCollectionPDA(collectionName);
  const [evoPda] = getEVOPDA(collectionPda, evoId);
  const cfg = await client.getCollectionConfig(collectionName);

  const ix = createBuyIx(
    evoPda,
    collectionPda,
    new PublicKey(evo.owner),       // seller
    new PublicKey(cfg.authority),   // creator
    userPubkey,                     // buyer (signer)
    protocolTreasury,
    cfg.royaltyDest,
  );

  const tx = new Transaction().add(ix);
  // ... sign and send
}
```

### `/list <collection> <id> <price>` — List for sale

```typescript
async function list(userPubkey: PublicKey, collectionName: string, evoId: number, priceSol: number) {
  const [collectionPda] = getCollectionPDA(collectionName);
  const [evoPda] = getEVOPDA(collectionPda, evoId);

  const ix = createListIx(evoPda, userPubkey, priceSol * LAMPORTS_PER_SOL);
  const tx = new Transaction().add(ix);
  // ... sign and send
}
```

### `/delist <collection> <id>` — Remove from sale

```typescript
async function delist(userPubkey: PublicKey, collectionName: string, evoId: number) {
  const [collectionPda] = getCollectionPDA(collectionName);
  const [evoPda] = getEVOPDA(collectionPda, evoId);

  const ix = createDelistIx(evoPda, userPubkey);
  const tx = new Transaction().add(ix);
  // ... sign and send
}
```

### `/feed <collection> <id> <amount>` — Add SOL to EVO

```typescript
async function feed(userPubkey: PublicKey, collectionName: string, evoId: number, amountSol: number) {
  const [collectionPda] = getCollectionPDA(collectionName);
  const [evoPda] = getEVOPDA(collectionPda, evoId);

  const ix = createFeedIx(evoPda, userPubkey, amountSol * LAMPORTS_PER_SOL);
  const tx = new Transaction().add(ix);
  // ... sign and send
}
```

### `/shatter <collection> <id>` — Destroy EVO, recover SOL

```typescript
async function shatter(userPubkey: PublicKey, collectionName: string, evoId: number) {
  const [collectionPda] = getCollectionPDA(collectionName);
  const [evoPda] = getEVOPDA(collectionPda, evoId);
  const cfg = await client.getCollectionConfig(collectionName);

  const ix = createShatterIx(
    evoPda,
    collectionPda,
    userPubkey,                    // owner (signer)
    new PublicKey(cfg.authority),  // creator
    protocolTreasury,
    evoId,
    cfg.shatterFeeDest,
  );

  const tx = new Transaction().add(ix);
  // ... sign and send
  // User receives: lockedLamports * (1 - shatterFeeBps/10000)
}
```

### `/evolve <collection> <id>` — Evolve EVO (permissionless)

```typescript
async function evolve(collectionName: string, evoId: number) {
  const [collectionPda] = getCollectionPDA(collectionName);
  const [evoPda] = getEVOPDA(collectionPda, evoId);

  const ix = createEvolveIx(evoPda, collectionPda);
  const tx = new Transaction().add(ix);
  // No signer needed — permissionless
  // But only advances if thresholds are met
}
```

### `/portfolio <wallet>` — Show user's EVOs

```typescript
async function portfolio(walletAddress: string) {
  const evos = await client.findDisplayByOwner(walletAddress);
  const totalLocked = evos.reduce((s, e) => s + e.lockedSol, 0);

  return {
    count: evos.length,
    totalLockedSol: totalLocked,
    evos: evos.map(e => ({
      name: `#${e.account.id}`,
      lockedSol: e.lockedSol,
      stage: e.stage,
      listed: e.account.isListed,
      listPrice: e.listPriceSol,
    })),
  };
}
```

---

## Signing Methods

### Option 1: Deep link to wallet (recommended)

Generate a transaction, serialize it, and create a deep link:

```typescript
import { Transaction } from '@solana/web3.js';

const tx = new Transaction().add(ix);
tx.feePayer = userPubkey;
const { blockhash } = await connection.getLatestBlockhash();
tx.recentBlockhash = blockhash;
const serialized = tx.serialize({ requireAllSignatures: false });
const base64 = serialized.toString('base64');
const deepLink = `https://phantom.app/ul/v1/sign-and-send-transaction?...`;
// Send deepLink in Telegram chat
```

### Option 2: Keypad signing (if bot holds encrypted keypair)

If your bot manages wallets (users deposit to bot-managed wallet):

```typescript
const tx = new Transaction().add(ix);
tx.feePayer = botWallet.publicKey;
tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
tx.sign(botWallet);
const sig = await connection.sendRawTransaction(tx.serialize());
```

---

## Important Notes

### Self-trade protection

The program blocks `buyer == seller`. Your bot should catch this error and inform
the user.

### Royalties are enforced on-chain

You cannot bypass royalties. Every `buy` transaction routes royalties to the
configured destination (Treasury, Creator, Burn, or Split).

### Locked SOL is the floor

Every EVO has locked SOL. The `shatter` instruction lets users recover it (minus
fee). This means EVOs cannot trade below their locked value on rational markets.

### EVOs are NOT SPL tokens

Do not try to use SPL token instructions. Use the EVO SDK instruction builders.

### Transaction size

Most EVO instructions are small (< 500 bytes). They fit easily in a single
transaction with room for a taker fee instruction if your bot charges fees.

---

## Bot UX Suggestions

```
User: /collections
Bot: 📊 EVO Collections
     1. Genesis — 85/10,000 — 0.5 SOL mint — 28.5 SOL locked
     2. Lunar Raiders — 38/5,000 — 0.3 SOL mint — 15.2 SOL locked
     Reply with /floor <name> to see floor

User: /floor Genesis
Bot: Genesis Floor: 2.50 SOL (5 listed)
     Lowest: Genesis #0 — 2.50 SOL (0.10 SOL locked)
     Reply with /buy Genesis 0 to purchase

User: /buy Genesis 0
Bot: ✅ Confirm purchase
     Item: Genesis #0
     Price: 2.50 SOL
     Locked: 0.10 SOL (your floor)
     Total: 2.50 SOL
     [Sign Transaction] <- deep link

User: /portfolio
Bot: 📁 Your EVOs (3 items, 0.30 SOL locked)
     1. Genesis #0 — 0.10 SOL — adult — LISTED 2.50 SOL
     2. Genesis #3 — 0.10 SOL — juvenile
     3. Lunar Raiders #5 — 0.10 SOL — baby
```

---

## Contact

- GitHub: https://github.com/stephenclawdbot-png/EVO
- Program: `7USTJBsRTmCnjowPgmh6s5igTZeaFPE7X43rZnhmm5sc`
- SDK: `@evo/sdk` on npm (after mainnet launch)
