# EVO — Stateful Capital on Solana

### A White Paper

**Version 1.0 — July 2026**

---

## 1. Abstract

EVO (Evolving Value Object) is a Solana-native digital asset primitive where SOL is locked *inside* the asset account itself. Unlike NFTs, where lamports serve only as rent for metadata storage, EVO treats lamports as economic state. Each EVO is a single program-owned account that simultaneously holds ownership, intrinsic value, generative state, listing state, and trade history.

The result is a digital asset with a **protocol-guaranteed floor price**: the locked SOL can always be reclaimed through a process called *shatter*, which atomically distributes the reserve and destroys the asset. This creates a third model for digital ownership — neither purely fungible (tokens) nor purely speculative (NFTs), but **unique assets with redeemable intrinsic value**.

---

## 2. The Problem

### 2.1 NFTs Have No Floor

A standard Metaplex NFT is a metadata PDA owned by the Metaplex program. Its lamport balance exists solely to keep the account rent-exempt. The token has no intrinsic value — its price is 100% speculative. When hype dies, liquidity evaporates and holders are left with irredeemable assets.

Markets have tried to solve this with:
- **Escrow locks** — wrapping NFTs in vault contracts. This is a lock on a door: the value is external to the asset.
- **Buyback programs** — centralized promises that can be revoked.
- **Fractionalization** — splitting an NFT into fungible tokens, which loses the uniqueness.

None of these make the floor *structural*. The floor is always an external promise, never a property of the asset itself.

### 2.2 The EVO Insight

EVO asks: *what if the asset account itself holds the value?*

```
Traditional NFT:
  Account = metadata + rent
  Value   = 100% speculative

EVO:
  Account = ownership + locked SOL + state + history
  Value   = intrinsic floor + speculative premium
```

The locked SOL is not a deposit wrapper. It is not an escrow. It lives inside the same account as the ownership record, the generative seed, and the trade scars. Transferring the EVO transfers the SOL. There is no separate vault to audit, no wrapper to unwrap, no external promise to trust.

---

## 3. Architecture

### 3.1 One Account, Five Layers

Every EVO is a single PDA (Program Derived Address) owned by the EVO program:

```
EVO Account
├── Identity       — collection, mint index, permanent seed
├── Ownership      — current owner (Pubkey)
├── Intrinsic Value — locked_lamports (SOL, redeemable via shatter)
├── Lifecycle State — current_state, evolution points, feed history
└── Market Memory   — trade count, fracture lines, listing state
```

All five layers occupy the same account. All transitions are governed by the same program. There is no separation between the asset and its value.

### 3.2 The Protocol Program

The EVO program (`7USTJBsRTmCnjowPgmh6s5igTZeaFPE7X43rZnhmm5sc`) defines:

| Instruction | Description |
|---|---|
| `initialize_protocol` | One-time setup: treasury + creation fee |
| `create_collection` | Creator launches a collection with lifecycle + randomness config |
| `forge` | Mint a new EVO — pays mint price to creator, locks SOL inside EVO |
| `feed` | Owner adds more SOL to increase the floor |
| `list` / `delist` | List or delist on the built-in marketplace |
| `buy` | Purchase a listed EVO — royalty routed per collection config |
| `transfer` | Transfer ownership without payment |
| `shatter` | Reclaim locked SOL — asset is permanently destroyed |
| `reveal_collection` | Reveal authority provides secret; program verifies keccak256(secret) == commitment, derives entropy |
| `commit_reveal` | Creator commits hash(secret) before minting for provably fair reveal |
| `evolve` | Permissionless — advances EVO to next lifecycle stage if thresholds met |
| `close_collection` | Close empty collection, refund rent |
| `update_metadata` | Update collection metadata URI |

### 3.3 Fee Model

All fees are enforced on-chain at the program level. Even direct program calls cannot bypass them.

| Fee | Paid By | Goes To | Configurable? |
|---|---|---|---|
| Collection creation fee | Collection creator | Protocol treasury | Yes (set at `initialize_protocol`) |
| Mint price | Forger | Collection creator | Yes (per collection) |
| Trade royalty | Buyer | Creator / Treasury / Burn / Split | Yes (basis points, per collection) |
| Shatter fee | EVO owner | Creator / Treasury / Burn / Split | Yes (basis points, per collection) |

---

## 4. The Value Model

### 4.1 Market Price = Intrinsic Floor + Speculative Premium

```
Market Price = Intrinsic Floor + Speculative Premium

Intrinsic Floor  = locked_lamports (redeemable via shatter)
Speculative Premium = community, art, rarity, utility, evolution state
```

The floor is not a promise. It is lamports inside the account, enforced by the program's shatter instruction. The premium is everything else — art, rarity, community, utility.

### 4.2 Shatter — The Hero Mechanism

Shatter is what makes EVO different from an NFT with extra steps.

When an EVO is shattered:
1. The program verifies the reserve invariant (account balance ≥ rent + locked_lamports)
2. The shatter fee is routed to the configured destination
3. The remaining locked SOL is sent to the owner
4. The account is closed (rent refunded to owner)
5. The EVO is permanently destroyed — it can never be traded, evolved, or shattered again

This creates a **self-correcting supply**: when market price approaches the floor, holders can shatter to reclaim SOL. Supply contracts. Scarcity increases. The floor becomes a mechanism, not a hope.

### 4.3 Reserve Invariant

Before any shatter, the program verifies:

```
account.lamports ≥ rent_minimum_balance + locked_lamports
```

This ensures `locked_lamports` is not merely a number — it is backed by real lamports in the account.

---

## 5. Lifecycle & Evolution

### 5.1 Per-Collection Lifecycle

EVO does not hardcode a single lifecycle. Each collection chooses its own:

| LifecycleType | Behavior |
|---|---|
| `Static` | Art is final from forge. No reveal, no evolution. |
| `Reveal` | Pre-reveal art shown at stage 0; reveal advances to stage 1. No evolution. |
| `CommitReveal` | Commit before mint, reveal after mint-out with injected entropy. |
| `RevealAndEvolve` | Reveal then per-asset evolution through multiple stages based on on-chain conditions. |
| `Custom` | Creator defines custom transition rules; authority can call `set_visual_stage` to any valid stage. |

### 5.2 Evolution Triggers

For `RevealAndEvolve` collections, the program supports modular triggers — all enabled thresholds must be met (AND logic) to advance one stage:

| Trigger | Field | Example |
|---|---|---|
| Trade count | `evolve_trade_threshold` | 10 trades per stage |
| Feed amount | `evolve_feed_threshold` | 0.1 SOL fed per stage |
| Holding duration | `evolve_hold_seconds` | 30 days per stage |
| Locked value | `evolve_locked_threshold` | Reserve reaches 1 SOL |

Evolution is **permissionless** — anyone can call `evolve`, but the EVO only advances if conditions are met. The program verifies the condition; it does not trust the caller.

### 5.3 Path-Dependent Final Form

Two EVOs from the same collection with similar genetic seeds can diverge completely based on their economic history:

```
EVO #1842: Held 180 days, fed to 2 SOL, traded twice → Sovereign Guardian
EVO #7712: Traded 240 times, fed 0.1 SOL, 80 owners  → Fractured Nomad
```

This is not a predetermined reveal. It is a visual record of the asset's life. **SOL that remembers.**

### 5.4 Randomness

Each collection selects a `RandomnessPolicy`:

| Policy | Description |
|---|---|
| `None` | No randomness. EVO #N = Artwork #N. |
| `Predetermined` | Creator pre-assigns art deterministically. |
| `BatchReveal` | Manifest committed before mint. One VRF result shuffles all assignments at reveal. |

For `BatchReveal`:
1. Creator commits a Merkle root of all 10,000 assets before minting
2. Creator calls `commit_reveal(keccak256(secret))` — locking the reveal commitment before anyone mints
3. Users mint unrevealed EVOs (sequential mint_index)
4. After mint-out, reveal authority calls `reveal_collection(secret)`
5. Program verifies `keccak256(secret) == reveal_commitment` and derives `reveal_entropy = keccak256(secret)`
6. Assignment = `permutation(reveal_entropy, supply)[mint_index]`
7. Anyone can verify: no duplicates, no skips, no creator manipulation

**Why commit-reveal?** Without the commitment, the creator could try multiple entropy values after seeing who minted which index, searching for a favorable assignment. The commitment locks the secret before minting begins — the creator cannot change it afterward.

The genetic seed is derived off-chain:
```
genetic_seed = hash(reveal_entropy + collection_address + mint_index)
```

This avoids updating 10,000 on-chain accounts at reveal time.

### 5.5 Visual Lifecycle — Protocol as Source of Truth

Every EVO collection declares its visual lifecycle on-chain at creation. Every individual EVO asset stores its own `current_stage: u16` on-chain. The Solana program is the **sole source of truth** for stage state. The marketplace and wallets only read and render — they never decide which image to show.

#### Collection-level fields

| Field | Type | Purpose |
|---|---|---|
| `lifecycle_type` | `LifecycleType` (1 byte) | Which lifecycle this collection uses |
| `max_states` | `u16` | Total number of visual stages (0 = single-stage) |
| `artwork_manifest_hash` | `[u8; 32]` | Optional keccak256 hash of the off-chain manifest for integrity verification |

The collection's existing `metadata_uri` field points to an off-chain **visual manifest** (JSON) that maps each stage to an image URL. The manifest is not stored on-chain — only the `metadata_uri` pointer and the optional hash are.

#### EVO asset-level fields

| Field | Type | Purpose |
|---|---|---|
| `current_state` | `u16` | The asset's current visual stage (0-indexed) |
| `last_transition_at` | `i64` | Timestamp of last stage transition |

#### Stage transition rules (enforced by the program)

| LifecycleType | Allowed transitions | Authority |
|---|---|---|
| `Static` | None — `StaticNoTransitions` error | N/A |
| `Reveal` | Stage 0 → 1 only (via `reveal_collection`) | Reveal authority |
| `CommitReveal` | Stage 0 → 1 only (via `reveal_collection` with committed secret) | Reveal authority |
| `RevealAndEvolve` | Reveal (0→1), then `evolve()` advances by 1 when conditions met | Permissionless (conditions enforced on-chain) |
| `Custom` | Any stage < `max_states` via `set_visual_stage` | Reveal authority only |

The program rejects:
- Backward transitions on non-`Custom` lifecycles
- Transitions past `max_states`
- Unauthorized callers
- Transitions on `Static` collections

#### Visual manifest schema (`evo-visual-manifest-v1`)

```json
{
  "schema": "evo-visual-manifest-v1",
  "name": "Collection Name",
  "description": "Collection description",
  "lifecycle": "reveal_and_evolve",
  "fallback_image": "https://arweave.net/hidden.png",
  "stages": [
    { "id": 0, "name": "Pre-Reveal", "image": "https://arweave.net/hidden.png" },
    { "id": 1, "name": "Revealed",  "image": "https://arweave.net/revealed.png" },
    { "id": 2, "name": "Evolved",   "image": "https://arweave.net/evolved.png" }
  ]
}
```

The `fallback_image` is used when the manifest is unavailable, invalid, or references a missing stage. Wallets and marketplaces must **never crash** because metadata cannot be loaded.

---

### 5.6 Wallet Integration Guide

Wallets and third-party marketplaces that want to display EVO artwork must follow this resolution flow:

```
1. Read CollectionConfig from chain
   → get lifecycle_type, max_states, metadata_uri, artwork_manifest_hash, is_revealed

2. Read EVOAccount from chain
   → get current_state (the asset's visual stage)

3. Fetch the visual manifest from metadata_uri (off-chain JSON)
   → parse as evo-visual-manifest-v1

4. (Optional) Verify integrity
   → keccak256(manifest_bytes) == artwork_manifest_hash
   → if mismatch, use fallback_image

5. Resolve the active image
   → stage = current_state from EVOAccount
   → image = manifest.stages[stage].image
   → if stage out of range, use fallback_image
```

#### Resolution rules by lifecycle

| LifecycleType | Stage source | Image |
|---|---|---|
| `Static` | Always 0 | `stages[0].image` |
| `Reveal` / `CommitReveal` | `is_revealed ? 1 : 0` | `stages[stage].image` |
| `RevealAndEvolve` | `EVOAccount.current_state` | `stages[stage].image` |
| `Custom` | `EVOAccount.current_state` | `stages[stage].image` |

#### TypeScript resolver reference

The frontend ships a reference resolver at `frontend/src/lib/evo-visuals.ts`:

```ts
function resolveActiveStage(
  manifest: EvoVisualManifest,
  onChainStage?: number,    // from EVOAccount.current_state
  isRevealed?: boolean,      // from CollectionConfig.is_revealed
): EvoVisualStage
```

Wallets can import or reimplement this resolver. The on-chain `current_state` always takes precedence over any manifest `state.current_stage` field (which exists only for backward compatibility with older collections).

#### What NOT to do

- Do not use `metadata_uri` as a direct image URL — it points to a JSON manifest
- Do not trust an off-chain `current_stage` field — always read `current_state` from the EVO account
- Do not assume all collections use reveal — check `lifecycle_type` first
- Do not crash on invalid manifests — always fall back to `fallback_image`

---

## 6. Security

### 6.1 Shatter Implementation

The EVO PDA is owned by the EVO program. It cannot send SOL via System Program transfer CPI (that requires the *signer* to be system-owned). Instead, shatter uses **direct lamport manipulation**:

```rust
**from.try_borrow_mut_lamports()? = from.lamports().checked_sub(amount)?;
**to.try_borrow_mut_lamports()? = to.lamports().checked_add(amount)?;
```

This is the correct Solana pattern for program-owned accounts transferring lamports.

### 6.2 Checked Math

All arithmetic uses `checked_add` / `checked_sub` with `MathOverflow` error. No silent overflow is possible.

### 6.3 Fee Routing

Fees support four destinations:
- **Creator** — sent to collection creator
- **Treasury** — sent to protocol treasury
- **Burn** — sent to the burn destination (defaults to Solana's incinerator `1nc1nerator11111111111111111111111111111111`, permanently destroyed). Collections may configure a custom `burn_destination` for testing — in production this should always be the real incinerator.
- **Split** — 50/50 creator/treasury (requires treasury account)

### 6.4 Reserve Invariant

Before shattering, the program verifies the EVO account contains at least:

```rust
let rent_minimum = rent.minimum_balance(evo.data_len());
let required = rent_minimum.checked_add(locked_lamports).ok_or(EvoError::MathOverflow)?;
require!(evo.lamports() >= required, EvoError::ReserveInvariantViolated);
```

This ensures `locked_lamports` can never claim more SOL than the account genuinely holds.

### 6.5 Provably Fair Reveal

The commit-reveal mechanism prevents the creator from choosing favorable reveal entropy:

1. **Commit phase** (before minting): Creator calls `commit_reveal(commitment)` where `commitment = keccak256(secret)`. This can only be done once and only before any minting occurs.
2. **Mint phase**: Users forge EVOs with sequential mint indices. The commitment is already locked.
3. **Reveal phase**: Reveal authority calls `reveal_collection(secret)`. The program verifies `keccak256(secret) == reveal_commitment` and derives `reveal_entropy = keccak256(secret)`.

The creator cannot try multiple secrets to find a favorable assignment — the commitment is immutable before the first mint. If no commitment is set (`reveal_commitment == [0u8; 32]`), the secret is used directly as entropy (backward compatible with collections that don't use commit-reveal).

### 6.6 Upgrade Authority

The program remains upgradeable during development. Upgrade authority will be revoked only after:
1. All invariant tests pass
2. Independent security review is complete
3. Protocol design is finalized

---

## 7. EVO vs. Existing Models

| Property | Fungible Tokens | NFTs (Metaplex) | EVO |
|---|---|---|---|
| Uniqueness | No | Yes | Yes |
| Intrinsic value | No | No | Yes (locked SOL) |
| Floor price | Market-determined | None | Protocol-guaranteed |
| Value storage | External (pool) | External (market) | Internal (same account) |
| Redeemability | No | No | Yes (shatter) |
| State evolution | No | No | Yes (configurable) |
| Trade history on-chain | No | No | Yes (fracture lines) |
| Marketplace | External | External | Built-in |

EVO is not an NFT with extra steps. It is a different way to model digital assets — one where the asset *is* the value, not merely a pointer to value.

---

## 8. The Builder API

EVO is designed to be enjoyable to build on. The target developer experience:

```rust
CollectionBuilder::new()
    .name("Z")
    .supply(10_000)
    .randomness(BatchReveal)
    .lifecycle(Evolving)
    .evolve_on_trade(10)
    .evolve_on_feed(0.1 * SOL)
    .evolve_on_hold(30 * DAYS)
    .intrinsic_value(0.05 * SOL)
    .mint_price(0.01 * SOL)
    .shatter_fee(500)        // 5%
    .royalty(250)            // 2.5%
    .build();
```

A creator should think about their collection, not about account sizes and PDA seeds.

---

## 9. Roadmap

### Phase 1: Protocol Hardening (Current)
- ✅ Shatter bugs fixed (direct lamport manipulation)
- ✅ Reserve invariant enforced
- ✅ Checked math throughout
- ✅ Configurable lifecycle system (Static, Reveal, CommitReveal, RevealAndEvolve, Custom)
- ✅ Configurable randomness (None, Predetermined, BatchReveal)
- ✅ Permissionless evolution with modular triggers
- ✅ Commit-reveal for provably fair reveal (keccak256 commitment before minting)
- ✅ Configurable burn destination for test verification
- ✅ Evolve boundary fixed (off-by-one: max_states = total stages, not transitions)
- ✅ Protocol-native visual lifecycle (per-asset current_stage, on-chain source of truth)
- ✅ set_visual_stage instruction for Custom lifecycle authority override
- ✅ Visual manifest resolver + wallet integration guide
- ✅ Comprehensive test suite — 40+ tests (forge, feed, transfer, buy, shatter, evolution, commit-reveal, burn destination, visual lifecycle)
- ✅ 9+ consecutive green CI runs, zero flaky tests
- ⬜ Devnet testing with real RPC
- ⬜ Independent security review

### Phase 2: Developer Experience
- ⬜ SDK with CollectionBuilder pattern
- ⬜ TypeScript client library
- ⬜ Frontend marketplace integration
- ⬜ Documentation and tutorials

### Phase 3: Launch
- ⬜ Upgrade mainnet program with hardened binary
- ⬜ Initialize protocol (creation fee = 0.05 SOL)
- ⬜ Create Z collection on mainnet
- ⬜ Deploy frontend to Vercel
- ⬜ Public launch with "hello world" collection tutorial

### Phase 4: Maturity
- ⬜ On-chain VRF verification (Switchboard/ORAO adapter)
- ⬜ Multisig upgrade authority
- ⬜ Revoke upgrade authority after audit
- ⬜ Ecosystem grants for third-party collections

---

## 10. Conclusion

EVO is a bet that digital assets can have intrinsic value without sacrificing uniqueness or composability. The protocol does not promise that EVOs will be valuable — it promises that they will be *honest*. The floor is real. The evolution is on-chain. The history is permanent.

Whether the Solana ecosystem adopts this model depends on execution: security, usability, and the quality of collections built on top. But the core thesis is sound: **SOL that remembers.**

---

*EVO is in active development. The program remains upgradeable while protocol mechanics and security invariants are finalized. Nothing in this white paper constitutes financial advice or a guarantee of returns.*

*Program ID: `7USTJBsRTmCnjowPgmh6s5igTZeaFPE7X43rZnhmm5sc`*
*Repository: [github.com/stephenclawdbot-png/EVO](https://github.com/stephenclawdbot-png/EVO)*