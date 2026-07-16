# 10 — Wallet & Developer Integration

## Overview

How wallet developers and application builders integrate EVO support.

## Program Details

| | |
|---|---|
| **Program ID** | `2AUfmSABAwfSAzMWuDfWXzm6TVVvVapWgtrAEBU4FHeR` |
| **Network** | Solana Mainnet |
| **Protocol Config PDA** | `EuLuQqUVq5ze2E5P43MLsYUxQLXskCCAvMK1evdNajRi` |
| **Authority** | `G3aWJsdtrRT12HnC9R2BVoyErQbtGXseaM9c2xt1MJUJ` |

## PDA Derivation

```
Protocol Config:  PDA(["protocol"], program_id)
Collection:       PDA(["collection", name_bytes], program_id)
EVO:              PDA(["evo", collection_pda, evo_id_u32_le], program_id)
```

## Account Layout — EVOAccount

```
Offset  Size   Field
0       8      Anchor discriminator
8       32     collection (Pubkey)
40      32     owner (Pubkey)           ← filter on this for findByOwner
72      8      locked_lamports (u64)
80      8      forged_at (i64)
88      4      facet_count (u32)
92      4      trade_count (u32)
96      32     resonance_seed ([u8; 32])
128     4      fracture_lines.length (u32)
132     var    fracture_lines[] (47 bytes each)
...     1      is_listed (bool)
...     8      list_price_lamports (u64)
...     1      is_shattered (bool)
...     1      bump (u8)
```

## Account Layout — CollectionConfig

```
Offset  Size   Field
0       8      Anchor discriminator
8       32     creator (Pubkey)
40      4      supply_cap (u32)
44      4      current_supply (u32)
48      2      shatter_fee_bps (u16)
50      1      shatter_fee_destination (u8 enum)
51      2      trade_royalty_bps (u16)
53      1      royalty_destination (u8 enum)
54      8      mint_price_lamports (u64)
62      8      lock_amount_lamports (u64)
70      var    name (String)
...     1      bump (u8)
```

## Reading EVO Data (Any Language)

### JavaScript/TypeScript

```typescript
import { Connection, PublicKey } from '@solana/web3.js';
import { Program, AnchorProvider } from '@coral-xyz/anchor';

const connection = new Connection('https://api.mainnet-beta.solana.com');
const programId = new PublicKey('2AUfmSABAwfSAzMWuDfWXzm6TVVvVapWgtrAEBU4FHeR');

// Find all EVOs owned by a wallet
async function findEVOsByOwner(ownerPubkey: string) {
  const filters = [
    { dataSize: 1055 }, // EVO account size
    { memcmp: { offset: 40, bytes: ownerPubkey } }, // owner field
  ];
  const accounts = await connection.getProgramAccounts(programId, { filters });
  return accounts.map(parseEVOAccount);
}

// Read redeemable value
function getRedeemableValue(evo, accountLamports: number): number {
  const shatterFee = evo.locked_lamports * evo.shatter_fee_bps / 10000;
  const net = evo.locked_lamports - shatterFee;
  return Math.min(accountLamports, net);
}
```

### Direct Account Parse (No SDK)

```typescript
function parseEVOAccount(account: Buffer) {
  return {
    collection: new PublicKey(account.slice(8, 40)).toString(),
    owner: new PublicKey(account.slice(40, 72)).toString(),
    locked_lamports: account.readBigUInt64LE(72),
    forged_at: Number(account.readBigInt64LE(80)),
    facet_count: account.readUInt32LE(88),
    trade_count: account.readUInt32LE(92),
    resonance_seed: account.slice(96, 128),
    // ... fracture_lines, is_listed, etc.
  };
}
```

## SDK (Future)

| Package | Purpose | Status |
|---|---|---|
| `@evo/sdk` | Read EVO accounts, find by owner, get value | Not yet published |
| `@evo/renderer` | Canvas-based generative art (optional) | Not yet published |

Both will be MIT licensed, open source, on npm.

## Safety Guarantees

- **Shatter always works** — users can reclaim SOL even if frontend goes down
- **No admin keys** — no one can freeze, modify, or steal EVOs
- **SOL is in the PDA** — not held by any team wallet
- **Fees are immutable** — set at collection creation, locked forever
- **Upgrade authority** — will be locked post-audit (redemption kernel immutable)

## Instruction Discriminators

For CPI calls, use these 8-byte discriminators:

```
initialize_protocol:  [188, 233, 252, 106, 134, 146, 202, 91]
create_collection:    [156, 251, 92, 54, 233, 2, 16, 82]
forge:                 [63, 5, 211, 28, 237, 195, 110, 144]
feed:                  [46, 213, 237, 176, 190, 113, 182, 94]
list:                  [54, 174, 193, 67, 17, 41, 132, 38]
delist:                [55, 136, 205, 107, 107, 173, 4, 31]
buy:                   [102, 6, 61, 18, 1, 218, 235, 234]
shatter:               [158, 63, 226, 126, 18, 89, 130, 128]
transfer:              [163, 52, 200, 231, 140, 3, 69, 186]
```

## Contact

- GitHub: https://github.com/stephenclawdbot-png/EVO
- Program ID: `2AUfmSABAwfSAzMWuDfWXzm6TVVvVapWgtrAEBU4FHeR`

---

*Part of the [EVO documentation](../README.md)*
