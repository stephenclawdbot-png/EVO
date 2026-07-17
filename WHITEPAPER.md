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

The program remains upgradeable. EVO launches as a **public beta** — unaudited, with upgrade authority kept so bugs can be patched. Upgrade authority will be revoked only after:
1. All invariant and adversarial tests pass
2. Independent security audit is complete and findings are resolved
3. Protocol is stable for months on mainnet with real SOL flows

> **Beta disclaimer:** EVO is open-source and launches as a public beta without an independent security audit. Users interact with real SOL at their own risk. The team keeps upgrade authority to patch bugs as they're discovered. An independent audit is planned post-beta when funding allows.

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
    .supply(10_000)          // 1–20,000, immutable after creation
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
- ✅ Protocol-enforced max supply ceiling (20,000 per collection, immutable after creation)
- ✅ Permissionless collection creation (unlimited collections, no authority gate)
- ✅ Configurable lifecycle system (Static, Reveal, CommitReveal, RevealAndEvolve, Custom)
- ✅ Configurable randomness (None, Predetermined, BatchReveal)
- ✅ Permissionless evolution with modular triggers
- ✅ Commit-reveal for provably fair reveal (keccak256 commitment before minting)
- ✅ Configurable burn destination for test verification
- ✅ Evolve boundary fixed (off-by-one: max_states = total stages, not transitions)
- ✅ Protocol-native visual lifecycle (per-asset current_stage, on-chain source of truth)
- ✅ set_visual_stage instruction for Custom lifecycle authority override
- ✅ Visual manifest resolver + wallet integration guide
- ✅ Comprehensive test suite — 57 tests (41 happy path + 16 adversarial)
- ✅ 18+ consecutive green localnet CI runs, zero flaky tests
- ✅ Devnet testing PASSED — 41/41 tests on real Solana devnet cluster
- ✅ Threat model document (docs/threat-model.md)
- ✅ Invariant 18 justified by code inspection, documented reasoning, and test coverage

### Phase 2: Developer Experience
- ⬜ SDK with CollectionBuilder pattern
- ⬜ TypeScript client library
- ⬜ Frontend marketplace integration
- ⬜ Documentation and tutorials

### Phase 3: Beta Launch (Unaudited)
> EVO launches as public beta. Users interact with real SOL at their own risk.
> Upgrade authority is KEPT so bugs can be patched. Audit deferred to post-beta.
> Permissionless from day one — anyone can create collections, unlimited.

- ⬜ Initialize protocol on mainnet (conservative parameters)
- ⬜ Create first collection on mainnet (beta) — Z collection, 108 EVOs
- ⬜ Public mint opens (beta — clearly labeled as unaudited)
- ⬜ Collection-first frontend (discover collections → open collection → forge/trade)
- ⬜ Portfolio page (your EVOs across all collections)
- ⬜ Monitor all forge/shatter/buy transactions closely
- ⬜ Gather feedback from early users
- ⬜ Fix bugs as discovered (upgrade authority kept)

### Phase 4: Audit & Full Launch
- ⬜ Engage independent Solana security firm when funding allows
- ⬜ Apply audit fixes
- ⬜ Rerun localnet and devnet test suites after fixes
- ⬜ Upgrade mainnet program with audited binary
- ⬜ Remove "BETA" label

### Phase 5: Observe & Mature
- ⬜ Monitor protocol for several months (do NOT revoke authority yet)
- ⬜ Second security review if necessary
- ⬜ On-chain VRF verification (Switchboard/ORAO adapter)
- ⬜ Multisig upgrade authority
- ⬜ Revoke upgrade authority only after audit passes and protocol is stable for months
- ⬜ Ecosystem grants for third-party collections

---

## Protocol Invariants

These invariants define the safety guarantees the EVO protocol must always uphold. Auditors should focus on verifying these properties hold across all code paths.

### Value Invariants

1. **Locked SOL never decreases except via shatter.** The `locked_lamports` field on an EVO account can only decrease when the owner calls `shatter`. No other instruction — forge, feed, transfer, list, buy, evolve, reveal, set_visual_stage — may reduce `locked_lamports`.

2. **Only the owner can shatter.** The `shatter` instruction requires the EVO owner's signature. No other wallet can trigger redemption of locked SOL.

3. **Feed only increases principal.** The `feed` instruction may only increase `locked_lamports` and `total_fed_lamports`. It can never decrease them.

4. **Transfer never moves locked SOL.** The `transfer` instruction changes the `owner` field but does not touch `locked_lamports`. The locked SOL stays in the EVO PDA, not the owner's wallet.

5. **Reserve invariant always holds.** Every EVO account maintains `balance >= rent_minimum + locked_lamports` at all times. This is enforced after forge, feed, and shatter via `verify_reserve_invariant`.

### Lifecycle Invariants

6. **current_state never exceeds max_states.** The `current_state` field on an EVO account is always `<= max_states - 1` (zero-indexed). Forge initializes to 0. Evolve checks `current_state < max_states - 1`. set_visual_stage checks `new_stage < max_states`.

7. **Lifecycle type is immutable after creation.** Once a collection is created with a lifecycle type (Static, Reveal, CommitReveal, RevealAndEvolve, Custom), it cannot be changed. No instruction modifies `lifecycle_type` on an existing collection.

8. **Static assets cannot transition.** Collections with `Static` lifecycle reject all calls to `evolve`, `reveal`, and `set_visual_stage`.

9. **Reveal assets can only move from stage 0 to stage 1.** The `reveal_collection` instruction sets the collection's `is_revealed` flag. Individual EVO accounts in a Reveal collection cannot evolve beyond stage 1.

10. **RevealAndEvolve assets advance only through valid stages.** Evolution requires cumulative feed thresholds to be met. No backward transitions are supported. Each call to `evolve` advances `current_state` by exactly 1.

### Authority Invariants

11. **Unauthorized wallets cannot change stages.** Only the collection authority (for set_visual_stage) or the protocol-defined conditions (for evolve) can change an EVO's visual state. The EVO owner cannot manually set their stage.

12. **Creation fee always routes to treasury.** Every `create_collection` call transfers the creation fee to the protocol treasury PDA. This fee cannot be redirected or skipped.

13. **Shatter fee routes to configurable burn destination.** The shatter fee is sent to the collection's configured `burn_destination` (defaults to the Solana incinerator). The owner receives `locked_lamports - fee`. The fee recipient receives exactly `fee`.

14. **Buy uses checked math.** The buy instruction uses `checked_sub` for `price - royalty`. If royalty exceeds price (impossible with valid config, but defense-in-depth), the transaction fails with `MathOverflow` rather than wrapping around.

### Supply Invariants

15. **Supply cap is 1–20,000.** `create_collection` rejects `supply_cap < 1` (`SupplyCapTooLow`) and `supply_cap > 20,000` (`SupplyCapTooHigh`). The ceiling is `MAX_SUPPLY_CEILING = 20_000`.

16. **Supply cap is immutable after creation.** No instruction modifies `supply_cap` on an existing collection. The creator's chosen cap is permanent.

17. **Forge respects supply cap.** `forge` checks `current_supply < supply_cap` and rejects with `SupplyCapReached` if the cap is met. No EVO can be minted past the collection's fixed cap.

18. **Collections are permissionless and unlimited.** `create_collection` has no authority gate. Anyone can create collections. The number of collections is not capped by the protocol.

### Commit-Reveal Invariants

19. **Commit must precede reveal.** `reveal_collection` requires a prior `commit_reveal` with a matching hash. No reveal is possible without a committed secret.

20. **Double commit is rejected.** Once a commit hash is submitted, no further commits are accepted.

21. **Reveal uses keccak256 verification.** The revealed secret is hashed with keccak256 and compared to the committed hash. Mismatched secrets are rejected.

### Balance Consistency Invariant

22. **locked_lamports field matches PDA balance.** The `locked_lamports` accounting field is always backed by actual lamports in the EVO PDA. Specifically, `evo.lamports() >= rent_minimum + evo.locked_lamports` must hold after every instruction. This is verified by `verify_reserve_invariant` after forge, feed, and shatter. No instruction can modify the EVO PDA's lamport balance without correspondingly updating `locked_lamports`:

- **forge:** Transfers `lock_amount` to EVO PDA, sets `locked_lamports = lock_amount` ✓
- **feed:** Transfers feed amount to EVO PDA, increments `locked_lamports` by feed amount ✓
- **shatter:** Sets `locked_lamports = 0` before moving lamports out, closes account to owner ✓
- **transfer, list, delist, buy, evolve, set_visual_stage:** Do not touch EVO PDA lamports or `locked_lamports` ✓

#### Justification of invariant 22 (code inspection + documented reasoning + tests)

The invariant is a **lower bound**: `PDA_balance >= rent_minimum + locked_lamports`.

**Credit path (lamports entering the EVO PDA):**

The EVO PDA is owned by the EVO program. Only two EVO instructions credit lamports to it:

1. `forge` — Anchor's `init` pays `rent_minimum` from the `owner` signer; the instruction body then transfers `lock_amount` from `owner` to the PDA via System Program CPI. Immediately after, `locked_lamports` is set to `lock_amount`. Net: `PDA_balance = rent_minimum + lock_amount`, `locked_lamports = lock_amount`. Equality holds. `verify_reserve_invariant` runs afterward and would revert on violation.
2. `feed` — Transfers `additional_lamports` from `feeder` to the PDA via System Program CPI, then `locked_lamports += additional_lamports` with checked add. Net: both `PDA_balance` and `locked_lamports` increase by the same delta. `verify_reserve_invariant` runs afterward.

Any other credit to the PDA must come from an **external System Program transfer** addressed to the PDA's public key. Such a transfer is not an EVO program instruction and does not update `locked_lamports`, but it can only **increase** the balance. Since the invariant is a lower bound (`>=`), adding lamports without updating the field preserves the invariant — it merely creates surplus lamports that the owner receives on shatter via `close = owner`.

**Debit path (lamports leaving the EVO PDA):**

Because the PDA is program-owned, only the EVO program can debit it. The only instruction that does so is `shatter`, which:

1. Calls `verify_reserve_invariant` **before** any mutation (would revert if balance < rent + locked).
2. Sets `is_shattered = true` and `locked_lamports = 0` **before** any lamport movement (anti-reentrancy).
3. Moves the fee out of the PDA via `transfer_lamports` (direct lamport manipulation, since System Program transfer cannot debit a program-owned account).
4. `close = owner` drains the remainder (reserve − fee + rent + any surplus) to the owner and zeroes the account.

After `shatter`, the account is closed: `PDA_balance = 0` and `locked_lamports = 0`. Both sides are zero — consistent.

**Instructions that mark `evo` as `mut` but do not move lamports:**

`transfer`, `list`, `delist`, `buy`, `evolve`, `set_visual_stage`, and `commit_reveal` mark the EVO account `mut` so Anchor can re-serialize data fields (e.g. `owner`, `is_listed`, `current_state`). Anchor re-serialization writes data, never lamports. No System Program CPI in these instructions targets the EVO PDA. Therefore `PDA_balance` and `locked_lamports` are both unchanged.

**Rent refunds:**

Solana credits rent-exempt accounts periodically from the runtime, not from any program instruction. Rent-exempt accounts (which all EVO PDAs are, by `init`) do not lose lamports to rent. There is no rent-debit path that could reduce `PDA_balance` below `rent_minimum + locked_lamports`.

**CPI surface:**

The only CPIs in the program are `system_program::transfer` (in `forge`, `feed`, `buy`, `create_collection`, and `route_fee`) and direct `transfer_lamports` (in `shatter`). None of these debit the EVO PDA except `shatter`, which is analyzed above. `route_fee` debits the `buyer` signer, never the EVO PDA.

**Conclusion:** For every EVO program instruction, the lower-bound invariant `PDA_balance >= rent_minimum + locked_lamports` is preserved. External deposits can only strengthen it. The only debit path is `shatter`, which zeroes both sides atomically. This justification is based on code inspection of all 15 instructions, documented reasoning about each lamport path, and test coverage verifying the invariant at runtime. It is not a machine-verified formal proof (K framework, Coq, Lean, SMT, etc.) — that level of verification would require an independent formal verification engagement.

---

## Mainnet Launch Strategy

> **EVO launches as a public beta — unaudited, with informed consent.**

EVO is open-source and launches as a public beta without an independent security audit. Users interact with real SOL at their own risk. Upgrade authority is KEPT so bugs can be patched. The sequence is:

1. **Beta Launch** — Initialize protocol, create first collection, open public mint (clearly labeled as BETA / UNAUDITED)
2. **Observe** — Monitor all forge/shatter/buy transactions closely, gather feedback from early users
3. **Audit** — Engage an independent Solana security firm when funding allows
4. **Fix** — Apply any audit findings via program upgrade
5. **Rerun** — Rerun localnet and devnet test suites to verify fixes
6. **Full Launch** — Remove BETA label, expand to broader audience
7. **Observe** — Monitor protocol for several months
8. **Review** — Second security review if necessary
9. **Revoke** — Only after audit passes and protocol is stable for months, revoke upgrade authority

Upgrade authority revocation is permanent. It should be the last step, not the first.

---

## 10. Conclusion

EVO is a bet that digital assets can have intrinsic value without sacrificing uniqueness or composability. The protocol does not promise that EVOs will be valuable — it promises that they will be *honest*. The floor is real. The evolution is on-chain. The history is permanent.

Whether the Solana ecosystem adopts this model depends on execution: security, usability, and the quality of collections built on top. But the core thesis is sound: **SOL that remembers.**

---

*EVO is in active development and launches as a public beta. The program remains upgradeable so bugs can be patched. Nothing in this white paper constitutes financial advice or a guarantee of returns. EVO is unaudited — use at your own risk.*

*Program ID: `7USTJBsRTmCnjowPgmh6s5igTZeaFPE7X43rZnhmm5sc`*
*Repository: [github.com/stephenclawdbot-png/EVO](https://github.com/stephenclawdbot-png/EVO)*