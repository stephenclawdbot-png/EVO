# 10 — Wallet & Developer Integration

## Overview

How wallet developers and application builders integrate EVO support.

## Program Details

| | |
|---|---|
| **Program ID** | `7USTJBsRTmCnjowPgmh6s5igTZeaFPE7X43rZnhmm5sc` |
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
...     4      mint_index (u32)
...     2      current_state (u16)       ← visual stage (lifecycle)
...     8      last_transition_at (i64)  ← timestamp of last stage change
...     4      feed_count (u32)
...     8      total_fed_lamports (u64)
```

The `current_state` field is the asset's current visual stage (0-indexed). It is the **source of truth** for which artwork image to display. Read this from the on-chain account — do not trust off-chain metadata for stage state.

## Account Layout — CollectionConfig

```
Offset  Size   Field
0       8      Anchor discriminator
8       4+var  name (String, max 32 chars)
...     32     creator (Pubkey)
...     4      supply_cap (u32)
...     4      current_supply (u32)
...     2      shatter_fee_bps (u16)
...     1      shatter_fee_destination (u8 enum)
...     2      trade_royalty_bps (u16)
...     1      royalty_destination (u8 enum)
...     8      mint_price_lamports (u64)
...     8      lock_amount_lamports (u64)
...     1      bump (u8)
...     4+var  metadata_uri (String, max 200 chars)  ← points to visual manifest
...     1      lifecycle_type (u8 enum)              ← Static=0, Reveal=1, CommitReveal=2, RevealAndEvolve=3, Custom=4
...     2      max_states (u16)                     ← total visual stages
...     32     reveal_authority (Pubkey)
...     32     reveal_entropy ([u8; 32])
...     1      is_revealed (bool)                    ← true after reveal_collection called
...     4      evolve_trade_threshold (u32)
...     8      evolve_feed_threshold (u64)
...     8      evolve_hold_seconds (i64)
...     8      evolve_locked_threshold (u64)
...     32     transition_policy_hash ([u8; 32])
...     1      randomness_policy (u8 enum)
...     32     manifest_root ([u8; 32])
...     32     reveal_commitment ([u8; 32])           ← keccak256(secret) committed before mint
...     32     burn_destination (Pubkey)              ← configurable burn wallet
...     32     artwork_manifest_hash ([u8; 32])      ← optional hash of off-chain manifest
```

Key lifecycle fields:
- `lifecycle_type` — determines which transitions are allowed
- `is_revealed` — set to true by `reveal_collection` instruction
- `max_states` — maximum stage index (0 = single-stage)
- `artwork_manifest_hash` — optional keccak256 of the manifest JSON for integrity verification
- `metadata_uri` — points to the off-chain visual manifest (JSON, not a direct image)

## Reading EVO Data (Any Language)

### JavaScript/TypeScript

```typescript
import { Connection, PublicKey } from '@solana/web3.js';
import { Program, AnchorProvider } from '@coral-xyz/anchor';

const connection = new Connection('https://api.mainnet-beta.solana.com');
const programId = new PublicKey('7USTJBsRTmCnjowPgmh6s5igTZeaFPE7X43rZnhmm5sc');

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

For CPI calls, use these 8-byte discriminators (computed via sha256("global:<name>")[:8]):

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
close_collection:      [102, 161, 227, 152, 71, 5, 188, 142]
update_metadata:       [55, 236, 214, 224, 33, 65, 144, 194]
reveal_collection:     [181, 252, 135, 115, 216, 100, 60, 200]
commit_reveal:         [30, 139, 34, 56, 94, 246, 114, 243]
evolve:                [139, 139, 160, 98, 252, 226, 106, 81]
set_visual_stage:      [44, 218, 23, 167, 61, 241, 78, 244]
```

## Visual Lifecycle — How to Resolve Artwork

Every EVO collection declares a visual lifecycle on-chain. Every EVO asset stores its own `current_state`. Wallets must follow this resolution flow to display the correct image:

### Step 1: Read on-chain state

```
CollectionConfig → lifecycle_type, max_states, metadata_uri, is_revealed, artwork_manifest_hash
EVOAccount       → current_state (the asset's visual stage)
```

### Step 2: Fetch the visual manifest

`metadata_uri` points to a JSON file (not a direct image). Fetch it and parse as `evo-visual-manifest-v1`:

```json
{
  "schema": "evo-visual-manifest-v1",
  "name": "Collection Name",
  "description": "...",
  "lifecycle": "reveal_and_evolve",
  "fallback_image": "https://arweave.net/hidden.png",
  "stages": [
    { "id": 0, "name": "Pre-Reveal", "image": "https://arweave.net/hidden.png" },
    { "id": 1, "name": "Revealed",  "image": "https://arweave.net/revealed.png" },
    { "id": 2, "name": "Evolved",   "image": "https://arweave.net/evolved.png" }
  ]
}
```

### Step 3: Resolve the active stage

| LifecycleType | Stage source | Image |
|---|---|---|
| `Static` (0) | Always 0 | `stages[0].image` |
| `Reveal` (1) | `is_revealed ? 1 : 0` | `stages[stage].image` |
| `CommitReveal` (2) | `is_revealed ? 1 : 0` | `stages[stage].image` |
| `RevealAndEvolve` (3) | `EVOAccount.current_state` | `stages[stage].image` |
| `Custom` (4) | `EVOAccount.current_state` | `stages[stage].image` |

### Step 4: Verify integrity (optional)

If `artwork_manifest_hash` is non-zero, compute `keccak256(manifest_bytes)` and compare. If mismatch, use `fallback_image`.

### Step 5: Display

Use `stages[stage].image`. If stage is out of range or manifest is invalid, use `fallback_image`. **Never crash on invalid metadata.**

### Reference resolver

The frontend ships a TypeScript resolver at `frontend/src/lib/evo-visuals.ts`. Wallets can import or reimplement it:

```typescript
import { resolveActiveStage, resolveImage, fetchVisualManifest } from './evo-visuals';

// On-chain state from program
const onChainStage = evoAccount.currentState;   // u16
const isRevealed = collectionConfig.isRevealed;   // bool

// Fetch manifest from metadata_uri
const manifest = await fetchVisualManifest(collectionConfig.metadataUri);

// Resolve active image
const stage = resolveActiveStage(manifest, onChainStage, isRevealed);
const imageUrl = stage.image;
```

### What NOT to do

- Do not use `metadata_uri` as a direct image URL — it points to a JSON manifest
- Do not trust an off-chain `state.current_stage` field — always read `current_state` from the EVO account
- Do not assume all collections use reveal — check `lifecycle_type` first
- Do not crash on invalid manifests — always fall back to `fallback_image`
- Do not hardcode stage logic per collection — use the lifecycle_type rules above

## Contact

- GitHub: https://github.com/stephenclawdbot-png/EVO
- Program ID: `7USTJBsRTmCnjowPgmh6s5igTZeaFPE7X43rZnhmm5sc`

---

*Part of the [EVO documentation](../README.md)*
