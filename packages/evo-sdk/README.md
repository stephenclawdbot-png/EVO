# @evo/sdk

TypeScript SDK for reading EVO (Evolving Value Object) data from Solana.

## Install

```bash
npm install @evo/sdk @solana/web3.js
```

## Quick Start

```typescript
import { Connection } from '@solana/web3.js';
import { EvoClient } from '@evo/sdk';

const connection = new Connection('https://api.mainnet-beta.solana.com');
const client = new EvoClient(connection);

// Find all EVOs owned by a wallet
const evos = await client.findByOwner('7xKnt...');
console.log(evos); // EVOAccount[]

// Get display data (human-readable)
const display = await client.findDisplayByOwner('7xKnt...');
console.log(display);
// [{ lockedSol: 5.2, stage: 'adult', ageString: '3w ago', ... }]
```

## Wallet Integration (30 minutes)

### 1. Show user's EVOs

```typescript
import { EvoClient } from '@evo/sdk';

// On wallet connect:
const client = new EvoClient(connection);
const myEvos = await client.findDisplayByOwner(wallet.publicKey);

// Render in your wallet UI:
myEvos.forEach(evo => {
  console.log(`${evo.account.address} — ${evo.lockedSol} SOL — ${evo.stage}`);
});
```

### 2. Show total locked value

```typescript
const totalLocked = myEvos.reduce((sum, e) => sum + e.lockedSol, 0);
console.log(`Total EVO value: ${totalLocked} SOL`);
```

### 3. Show EVO art (with @evo/renderer)

```typescript
import { renderEvo } from '@evo/renderer';

const canvas = document.createElement('canvas');
const rawEvo = await client.getEvo('Z', 42);
if (rawEvo) {
  renderEvo(canvas, rawEvo, { width: 128, height: 128 });
  // Append canvas to your UI
}
```

## API Reference

### `EvoClient`

| Method | Returns | Description |
|---|---|---|
| `findByOwner(wallet)` | `EVOAccount[]` | All EVOs owned by a wallet |
| `findDisplayByOwner(wallet)` | `EvoDisplayData[]` | Same, with human-readable values |
| `getEvo(collection, id)` | `EVOAccount \| null` | Single EVO by collection name + ID |
| `getEvoByAddress(address)` | `EVOAccount \| null` | Single EVO by PDA address |
| `getCollectionEvos(name)` | `EVOAccount[]` | All EVOs in a collection |
| `getCollectionConfig(name)` | `CollectionConfig \| null` | Collection metadata |

### Types

```typescript
interface EVOAccount {
  address: string;        // PDA address
  collection: string;     // Collection PDA
  owner: string;          // Current owner's wallet
  lockedLamports: number; // Locked SOL (in lamports)
  forgedAt: number;       // Unix timestamp
  facetCount: number;     // Evolution progress (0-100)
  tradeCount: number;     // Times traded
  resonanceSeed: string;  // 32-byte hex (art seed)
  fractureLines: FractureLine[]; // Trade scars
  isListed: boolean;      // Currently for sale
  listPriceLamports: number | null;
  isShattered: boolean;   // Destroyed
}

interface EvoDisplayData {
  account: EVOAccount;
  lockedSol: number;      // Human-readable SOL
  stage: 'baby' | 'juvenile' | 'adult' | 'elder';
  ageString: string;       // "3w ago"
  totalValueSol: number;
  listPriceSol: number | null;
}
```

## Constants

```typescript
import { EVO_PROGRAM_ID, LAMPORTS_PER_SOL } from '@evo/sdk';
```

Replace `EVO_PROGRAM_ID` with the actual mainnet program ID after deployment.

## License

MIT