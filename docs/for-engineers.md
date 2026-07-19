# EVO Protocol: Engineer and Integrator Guide

> For developers, protocol engineers, and infrastructure teams building on or integrating with EVO.

---

## What EVO Is

EVO is a Solana program that lets anyone create collections of stateful assets. Each asset (called an EVO) is a PDA account that holds locked SOL. The owner can feed it more SOL, trade it on the built-in marketplace, evolve it through visual stages, or shatter it to reclaim the locked SOL minus a fee.

Think of it as an NFT with a bank account inside, except the bank account is the floor price and the NFT can change appearance over time. The program enforces all value transfers. No external marketplace contract needed.

**Program ID (mainnet):** `7USTJBsRTmCnjowPgmh6s5igTZeaFPE7X43rZnhmm5sc`
**Status:** Deployed, not yet initialized. Upgrade authority retained.
**Source:** https://github.com/stephenclawdbot-png/EVO

---

## Architecture At A Glance

```
EVO Program (Solana BPF)
  |
  +-- Protocol (singleton)
  |     - treasury
  |     - authority
  |     - collection_count
  |
  +-- Collection (PDA, one per collection)
  |     - supply_cap (immutable after creation)
  |     - mint_price, lock_amount (immutable)
  |     - royalty_bps, shatter_fee_bps (immutable)
  |     - lifecycle_type, randomness_policy
  |     - artwork_manifest_hash
  |
  +-- EVOAccount (PDA, one per asset)
        - owner
        - locked_lamports
        - current_state (visual stage)
        - is_listed, asking_price
        - trade_count, forged_at
        - resonance_seed
        - fracture_lines (history)
        - manifest_verified
```

The protocol is a singleton initialized once. Collections are PDAs derived from creator plus a seed. EVO accounts are PDAs derived from collection plus a mint index. All value flows through the program. No CPI to external programs for core operations.

---

## The 15 Instructions

| Instruction | Who Can Call | What It Does |
|---|---|---|
| `initialize_protocol` | deployer | Sets up the singleton protocol state |
| `create_collection` | anyone | Creates a new collection with immutable fee and supply params |
| `forge` | anyone | Mints a new EVO into a collection (pays mint_price + lock_amount) |
| `feed` | EVO owner | Adds SOL to an existing EVO, raising its floor |
| `list` | EVO owner | Lists an EVO for sale at a chosen price |
| `delist` | EVO owner | Removes a listing |
| `buy` | anyone | Purchases a listed EVO, pays seller minus royalty |
| `transfer` | EVO owner | Sends an EVO to another wallet (no payment) |
| `shatter` | EVO owner | Destroys the EVO and reclaims locked SOL minus fee |
| `evolve` | EVO owner | Advances visual stage if conditions are met |
| `reveal_collection` | collection creator | Reveals a Reveal or RevealAndEvolve collection |
| `commit_reveal` | collection creator | Commits a keccak256 hash of the secret before minting |
| `close_collection` | collection creator | Closes an empty collection (only if zero supply) |
| `update_metadata` | collection creator | Updates off-chain metadata URI |
| `set_visual_stage` | collection authority | Manually sets visual stage for Custom lifecycle |
| `verify_merkle_proof` | anyone | Verifies a Merkle proof against an on-chain root, sets manifest_verified |

All instructions are permissionless unless explicitly gated. The program is the source of truth for ownership, value, and visual state.

---

## Account Layouts

### Protocol (singleton)

Initialized once by the deployer. Holds the treasury address, protocol authority, and collection counter.

### CollectionConfig (PDA)

Derived from creator key and a collection seed. Stores all immutable parameters: supply cap, mint price, lock amount, royalty, shatter fee, lifecycle type, randomness policy, and the artwork manifest hash.

Once the first EVO is forged, fee parameters and supply cap are locked forever. The creator can still update the metadata URI and manage the reveal process.

### EVOAccount (PDA)

Derived from collection and a mint index. Stores owner, locked lamports, current visual state, listing info, trade history, and the resonance seed. This is the asset itself. The account's actual lamport balance is the source of truth for redeemable value, not a stored field.

---

## Value Flow

```
forge():
  payer -> EVO PDA:  lock_amount (SOL locked inside)
  payer -> creator:   mint_price (creator revenue)

feed():
  payer -> EVO PDA:  additional SOL (floor goes up)

buy():
  buyer -> seller:    asking_price - royalty
  buyer -> royalty:   asking_price * royalty_bps / 10000

shatter():
  EVO PDA -> owner:   locked_lamports - shatter_fee
  EVO PDA -> fee:     shatter_fee (to configured destination)
  EVO PDA closed, lamports swept
```

The program uses direct lamport manipulation for shatter because the EVO PDA is program-owned and cannot use the System Program transfer CPI. This is the correct Solana pattern for program-owned accounts. The reserve invariant `account.lamports >= rent_minimum + locked_lamports` is enforced on every state-changing instruction.

---

## Lifecycle System

Every collection declares a lifecycle type at creation. This controls how visual stages progress.

| Type | Behavior | Trigger |
|---|---|---|
| Static | No visual changes ever | N/A |
| Reveal | Hidden stage 0, then revealed to stage 1 | Creator calls reveal_collection |
| CommitReveal | Same as Reveal but with commit hash first | Creator commits, then reveals |
| RevealAndEvolve | Reveal plus subsequent evolution stages | Reveal then evolve when conditions met |
| Custom | Authority sets stages manually | Authority calls set_visual_stage |

Randomness policies: None, Predetermined, BatchReveal. The commit-reveal flow uses keccak256 hashing. The creator commits a hash of the secret before minting starts. After minting, the creator reveals the actual secret. The program verifies it matches the committed hash. This prevents creators from cherry-picking favorable entropy after seeing mints.

---

## Integrating EVO Into Your App

### TypeScript Client

The frontend ships a TypeScript client library at `frontend/src/lib/evo-program.ts`. It exposes typed instruction builders for all 15 instructions. Example usage:

```typescript
import { createForgeInstruction } from './lib/evo-program';

const ix = createForgeInstruction({
  collection: collectionPda,
  evo: evoPda,
  owner: userWallet,
  resonanceSeed: new Uint8Array(32),
  mintIndex: 1,
});
```

### Visual Resolution

For wallets and marketplaces that need to render EVOs, the visual resolver at `frontend/src/lib/evo-visuals.ts` fetches the collection's visual manifest from the `metadata_uri` (which can use `http://`, `https://`, `ipfs://`, or `arweave://` schemes). The on-chain `current_state` and `isRevealed` fields are the source of truth for the visual stage. The manifest maps stages to actual images. Two image modes: per-stage (one image per stage, shared by all EVOs) or per-EVO (URL template with `{id}` and `{stage}` patterns).

### Image Upload Pipeline

The MELD terminal includes a full upload pipeline:
- `artwork-upload.ts`: IPFS CID computation, base64 previews, manifest generation
- `arweave-upload.ts`: Irys/Arweave upload with Solana wallet signing, concurrent sliding-window workers, resume support
- `BulkArtworkUploader`: bulk upload of per-EVO images (supports 10k+ images, ZIP files)
- `ArtworkDropzone`: small upload with auto-manifest generation

Creators choose between bulk upload (images stored on Arweave via Irys, permanent, costs SOL) or pointing to an existing metadata URI (for creators who host their own art).

If you are building a wallet or explorer, read `current_state` from the EVOAccount. That integer is the visual stage. Map it to your rendering pipeline. For Reveal and CommitReveal collections, check `isRevealed` first. Stage 0 means unrevealed.

### Account Discovery

To find all EVOs in a collection, derive PDAs from the collection address with incrementing mint indices. Start at 0 and increment until you hit the supply cap or get a null account. For user portfolios, filter by owner field.

### Merkle Verification

For collections that use Merkle-based allowlists or manifest verification, the `verify_merkle_proof` instruction is permissionless. Anyone can submit a proof. If valid, the EVO's `manifest_verified` flag is set to true. This is useful for proving that an EVO matches a specific artwork manifest without storing the manifest on-chain.

---

## Security Model

### What The Program Guarantees

1. **Floor enforcement.** The redeemable value is `min(account.lamports - rent_exempt, locked_lamports) - shatter_fee`. No authority can reduce this. No upgrade can change this without breaking the invariant (and we do not plan to upgrade).

2. **Immutable fees.** Once the first EVO is forged, collection fee parameters are locked. The creator cannot raise the shatter fee, change the royalty, or alter the supply cap.

3. **Permissionless creation.** Anyone can create a collection. There is no allowlist, no authority gate, no application process. The protocol charges a fixed creation fee (0.06789 SOL) to the treasury.

4. **Self-trade guard.** A wallet cannot buy its own listed EVO. This prevents wash trading through the program.

5. **Listed EVO transfer rejection.** An EVO that is currently listed for sale cannot be transferred. The owner must delist first. This prevents listing hijacking and race conditions.

### What The Program Does NOT Guarantee

1. **Market price.** The program enforces a floor but the premium is set by the market. The program has no opinion on what an EVO trades for above floor.

2. **Art quality.** The program stores a manifest hash and visual stage. It does not verify that the art is good, unique, or non-infringing. That is the creator's responsibility.

3. **Creator reputation.** The protocol is permissionless. Bad actors can create collections. Buyers must do their own diligence on the creator, the art, and the lock amount.

### Audit Status

Two independent security reviews completed. First was a line-by-line manual review. Second was an agent-based adversarial review. Combined findings: 5 CRITICAL, 6 HIGH, 1 MEDIUM. All fixed. Build verification is byte-for-byte reproducible.

The program has 57 tests. 41 happy path tests covering forge, feed, transfer, list, buy, shatter, commit-reveal, reveal, evolve, burn fee routing, and all four lifecycle types. 16 adversarial tests covering double commits, wrong secrets, non-authority calls, overflow attempts, max state rejection, and edge cases.

Devnet: 64/64 tests passing. Localnet: 17 consecutive green CI runs.

---

## Fee Mechanics In Detail

| Fee | Setter | Range | Destination |
|---|---|---|---|
| Collection creation | Protocol (fixed) | 0.06789 SOL | Protocol treasury |
| Mint price | Collection creator | 0 to whatever | Creator wallet |
| Trade royalty | Collection creator | 0 to 2500 bps (25%) | Creator's chosen destination |
| Shatter fee | Collection creator | 0 to 2000 bps (20%) | Creator's chosen destination |

Shatter fee destinations: Treasury, Creator wallet, Burn (incinerator), or Split (divided among multiple destinations). All set at collection creation and immutable after the first forge.

---

## Building A Collection

If you want to create an EVO collection, here is the flow:

1. Call `initialize_protocol` if not already initialized (only the deployer does this, once).
2. Call `create_collection` with your parameters: supply cap (1 to 20,000), mint price, lock amount, royalty bps, shatter fee bps, lifecycle type, randomness policy.
3. Pay the creation fee (0.06789 SOL) to the treasury.
4. If using CommitReveal, call `commit_reveal` with a keccak256 hash of your secret before minting starts.
5. Users call `forge` to mint EVOs. Each pays your mint price (goes to you) plus the lock amount (goes into the EVO).
6. If using Reveal or RevealAndEvolve, call `reveal_collection` after minting completes to reveal the hidden stage.
7. The collection is now live. Owners can feed, list, trade, evolve, and shatter.

### Supply Cap

Set between 1 and 20,000. Immutable after creation. Choose carefully. If you set 100 and sell out, you cannot mint more. If you set 10,000 and only sell 50, the remaining 9,950 slots are unused but not reclaimable until you close the collection (only possible if supply is zero).

### Lock Amount

This is the floor. If you set it too low, EVOs have no downside protection. If you set it too high, minting becomes expensive and fewer people forge. A good starting point: 0.1 to 1 SOL. The lock amount is the same for every EVO in the collection and cannot change.

---

## SDK and Builder API

The EVO SDK at `packages/evo-sdk/src/builder.ts` provides a fluent API for building collections programmatically:

```typescript
const collection = await new CollectionBuilder(rpc)
  .withSupplyCap(1000)
  .withMintPrice(0.05 * LAMPORTS_PER_SOL)
  .withLockAmount(0.5 * LAMPORTS_PER_SOL)
  .withRoyalty(500) // 5%
  .withShatterFee(100) // 1%
  .withLifecycle(LifecycleType.RevealAndEvolve)
  .build();
```

This handles PDA derivation, instruction building, and transaction signing. Useful for scripts, bots, and automated deployment pipelines.

---

## Running Tests

```bash
# Localnet (default, fast)
anchor test

# Devnet (requires funded wallet)
anchor test --provider.cluster devnet

# Specific test
anchor test -- --grep "forge"
```

The test suite is cluster-aware. On localnet it airdrops SOL. On devnet it transfers from a pre-funded wallet. Devnet CI uses a GitHub secret `DEVNET_FUNDED_KEYPAIR` for the funded wallet.

---

## Known Limitations

1. **No partial redemption.** You shatter the whole EVO or nothing. No withdrawing half the locked SOL.

2. **No lending against EVOs.** The program does not support collateralized borrowing. Third parties could build this on top.

3. **No batch operations.** Each instruction is one EVO at a time. No batch forge, batch feed, batch list. Third parties can wrap these in a single transaction.

4. **Upgrade authority is retained.** The program can be upgraded. The plan is to renounce after formal third-party audit. Until then, the authority exists but is not used.

5. **No on-chain art verification.** The manifest hash is stored but the program does not verify that the art matches. The `verify_merkle_proof` instruction verifies structure, not content.

---

## Questions Engineers Ask

**Can I build a marketplace on top of EVO?**
Yes. The program has a built-in marketplace (list and buy) but you can build your own frontend. You cannot build an external escrow because the program owns the PDAs. All trades must go through the program.

**Can I compose EVOs with other Solana programs?**
Yes. EVOs are standard PDAs. You can read their state from any program. You cannot transfer them from another program (ownership changes go through the EVO program). Composable reads, isolated writes.

**What happens if the program is upgraded?**
Until upgrade authority is renounced, the program could be upgraded. We commit to not changing fee logic, floor mechanics, or the shatter guarantee. After formal audit, we plan to renounce.

**How do I handle metadata?**
The collection stores a metadata URI. Update it with `update_metadata`. The URI should point to a JSON file with collection-level info. Per-EVO metadata is derived from on-chain state plus the resonance seed. No per-EVO URI needed.

**What about MEV and front-running?**
Listings are program-state, not mempool transactions. A buyer sees a listed EVO and submits a buy. There is no auction, no bidding, no time priority. First transaction to land wins. Standard Solana MEV considerations apply.

---

## Contact

Repo: https://github.com/stephenclawdbot-png/EVO
Authors: naps (@naps000), admiralfinest (@admiralfinest), Benedict A.

For integration support, open an issue on GitHub or reach out on X.