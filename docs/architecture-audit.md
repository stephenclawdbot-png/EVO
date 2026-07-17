# EVO Protocol Architecture Audit

**Date:** 2026-07-18
**Commit:** e82bab6
**Scope:** Protocol and account model only (frontend excluded)

---

## Question

Can an arbitrary creator launch a collection with their own name, branding,
artwork, metadata, evolution stages, and 10,000 max supply — using the exact
same on-chain flow as any other creator — without requiring future protocol
changes?

## Answer

**Yes.** The protocol is collection-agnostic. There is no Z-specific logic,
no hardcoded collection assumptions, and no special-case code paths for any
collection. Two unrelated creators can launch two completely different
collections using the same `create_collection` instruction with different
arguments. No protocol changes are required.

---

## 1. What On-Chain Accounts Are Created?

### Protocol-level (created once, globally)

| Account | PDA Seeds | Created By | Purpose |
|---------|-----------|-----------|---------|
| `ProtocolConfig` | `["protocol"]` | Protocol deployer via `initialize_protocol` | Treasury address + collection creation fee. Immutable after init. |

There is exactly one `ProtocolConfig` for the entire program. It contains
nothing collection-specific — just a treasury pubkey and a creation fee.

### Per-collection (created by each creator)

| Account | PDA Seeds | Created By | Purpose |
|---------|-----------|-----------|---------|
| `CollectionConfig` | `["collection", name_bytes]` | Creator via `create_collection` | All collection parameters (name, supply cap, fees, lifecycle, metadata URI, evolution thresholds, etc.) |

### Per-EVO (created by users forging)

| Account | PDA Seeds | Created By | Purpose |
|---------|-----------|-----------|---------|
| `EVOAccount` | `["evo", collection_pda, evo_id_le]` | Any user via `forge` | Individual asset state (owner, locked SOL, trade count, fractures, lifecycle stage, etc.) |

**Total account types: 3.** ProtocolConfig (1 global), CollectionConfig (1 per
collection), EVOAccount (1 per forged EVO). No other accounts exist.

---

## 2. Does the Creator Only Create a Single CollectionConfig?

**Yes.** The creator calls `create_collection` once, which creates exactly one
`CollectionConfig` PDA. That single account encodes everything the protocol
needs to know about the collection:

```
create_collection(
    name:           "MyCollection",         // 1-32 chars, unique PDA seed
    supply_cap:     10_000,                 // 1 ≤ cap ≤ 20,000
    shatter_fee_bps: 500,                   // 5% shatter fee
    shatter_fee_destination: Creator,       // where shatter fee goes
    trade_royalty_bps: 500,                 // 5% trade royalty
    royalty_destination: Creator,           // where royalty goes
    mint_price_lamports: 0.05 * LAMPORTS_PER_SOL,
    lock_amount_lamports: 0.05 * LAMPORTS_PER_SOL,
    metadata_uri:   "https://arweave.net/abc/manifest.json",
    lifecycle: LifecycleParams { ... },     // evolution config
)
```

After this single transaction:
- The collection exists on-chain.
- Any user can forge EVOs (each forge creates a new `EVOAccount`).
- The protocol enforces all rules from the `CollectionConfig`.
- The frontend can discover the collection via `getProgramAccounts`.
- No further protocol interaction is needed from the creator (unless they want
  to reveal, evolve, or update metadata).

**Individual EVO accounts are NOT created by the creator.** They are created
lazily by users who call `forge`. Each forge creates one `EVOAccount` PDA,
transfers the mint price to the creator, and locks SOL inside the EVO account.

---

## 3. Is Every Piece of Collection-Specific Behavior Derived from CollectionConfig?

**Yes.** Every instruction that operates on an EVO reads the `CollectionConfig`
to determine collection-specific behavior. There are no hardcoded constants,
no collection name checks, and no special-case branches.

### Proof: Instruction-by-Instruction Audit

| Instruction | Reads CollectionConfig? | Collection-Specific Behavior Derived From Config? | Any Hardcoded Assumption? |
|-------------|:---:|---|---|
| `forge` | ✅ | Supply cap, mint price, lock amount, creator address | None |
| `feed` | ❌ | Owner-only, adds locked SOL | None (no collection needed) |
| `list` | ❌ | Owner-only, sets price | None |
| `delist` | ❌ | Owner-only | None |
| `buy` | ✅ | Trade royalty bps, royalty destination, burn destination | None |
| `shatter` | ✅ | Shatter fee bps, fee destination, burn destination | None |
| `transfer` | ❌ | Owner-only | None |
| `evolve` | ✅ | Lifecycle type, max states, reveal status, all 4 evolution thresholds | None |
| `reveal_collection` | ✅ | Reveal authority, commitment hash, lifecycle type | None |
| `commit_reveal` | ✅ | Creator-only, before minting starts | None |
| `set_visual_stage` | ✅ | Lifecycle type (Custom only), reveal authority, max states | None |
| `update_metadata` | ✅ | Creator-only, updates metadata_uri | None |
| `close_collection` | ✅ | Creator-only, must be empty | None |

**Every collection-specific behavior is a field on `CollectionConfig`:**

| Behavior | Config Field | Set By Creator? |
|----------|-------------|:---:|
| Max supply | `supply_cap` | ✅ |
| Mint price | `mint_price_lamports` | ✅ |
| Lock amount (floor) | `lock_amount_lamports` | ✅ |
| Shatter fee % | `shatter_fee_bps` | ✅ |
| Shatter fee destination | `shatter_fee_destination` | ✅ |
| Trade royalty % | `trade_royalty_bps` | ✅ |
| Royalty destination | `royalty_destination` | ✅ |
| Metadata URI (artwork/manifest) | `metadata_uri` | ✅ |
| Lifecycle type | `lifecycle_type` | ✅ |
| Number of evolution stages | `max_states` | ✅ |
| Reveal authority | `reveal_authority` | ✅ |
| Trade threshold for evolution | `evolve_trade_threshold` | ✅ |
| Feed threshold for evolution | `evolve_feed_threshold` | ✅ |
| Hold time threshold | `evolve_hold_seconds` | ✅ |
| Locked value threshold | `evolve_locked_threshold` | ✅ |
| Randomness policy | `randomness_policy` | ✅ |
| Manifest root hash | `manifest_root` | ✅ |
| Artwork manifest hash | `artwork_manifest_hash` | ✅ |
| Custom burn destination | `burn_destination` | ✅ |

**What the protocol does NOT know or care about:**
- What the artwork looks like
- What the stages are named
- How many items have unique art (that's the manifest's job, off-chain)
- What "elements" or "rarities" exist (there are none in the protocol)
- What the collection's branding is
- Whether the collection is "Z" or anything else

The protocol is a **value-locking and lifecycle engine**. Artwork, metadata,
and visual identity live off-chain at the `metadata_uri`. The protocol only
enforces economic rules (locked SOL, fees, royalties, supply cap) and lifecycle
rules (evolution thresholds, reveal mechanics).

---

## 4. Can Two Unrelated Creators Launch Two Different Collections Without Protocol Changes?

**Yes.** The flow is identical for every creator:

```
Creator A                          Creator B
    |                                  |
    | create_collection(               | create_collection(
    |   name: "Dragons",               |   name: "Robots",
    |   supply_cap: 10_000,            |   supply_cap: 500,
    |   metadata_uri: "arweave.net/A", |   metadata_uri: "ipfs://B",
    |   lifecycle: RevealAndEvolve,    |   lifecycle: Static,
    |   max_states: 4,                 |   max_states: 0,
    |   ...                            |   ...
    | )                                | )
    |                                  |
    v                                  v
CollectionConfig["Dragons"]      CollectionConfig["Robots"]
    |                                  |
    | Users forge EVOs                 | Users forge EVOs
    v                                  v
EVOAccount["evo", Dragons_pda, 0]  EVOAccount["evo", Robots_pda, 0]
EVOAccount["evo", Dragons_pda, 1]  EVOAccount["evo", Robots_pda, 0]
...                                ...
```

Both collections:
- Are PDA-addressed by their name (unique namespace)
- Have independent supply caps, fees, royalties
- Have independent lifecycle configurations
- Have independent metadata URIs
- Are discovered by the same `getProgramAccounts` call
- Use the same `forge`, `feed`, `list`, `buy`, `shatter`, `evolve` instructions

**No protocol change, no redepoy, no team approval.** The only requirement is
that collection names are unique (PDA seeds enforce this — `create_collection`
will fail with `AccountAlreadyExists` if the name is taken).

---

## 5. Is the Protocol Truly Collection-Agnostic?

**Yes.** Here is the complete list of things the protocol hardcodes:

| Hardcoded Value | Location | Is It Collection-Specific? |
|----------------|----------|:---:|
| `PROTOCOL_SEED = b"protocol"` | constants.rs | No — global program seed |
| `COLLECTION_SEED = b"collection"` | constants.rs | No — PDA seed prefix |
| `EVO_SEED = b"evo"` | constants.rs | No — PDA seed prefix |
| `MAX_SUPPLY_CEILING = 20_000` | constants.rs | No — protocol-wide ceiling, not per-collection |
| `MAX_SHATTER_FEE_BPS = 2000` | constants.rs | No — max allowed, creator chooses any value ≤ this |
| `MAX_ROYALTY_BPS = 2500` | constants.rs | No — max allowed, creator chooses any value ≤ this |
| `MAX_COLLECTION_NAME_LEN = 32` | constants.rs | No — name length limit |
| `MAX_METADATA_URI_LEN = 200` | constants.rs | No — URI length limit |
| `MAX_FRACTURE_LINES = 20` | constants.rs | No — per-EVO scar limit |
| `INCINERATOR` pubkey | constants.rs | No — Solana's built-in burn address |

**There are zero collection-specific hardcoded values.** Every limit is a
protocol-wide ceiling or structural constant. Creators choose their own values
within the allowed ranges.

### What About Evolution Logic?

The `evolve` instruction is fully parameterized by `CollectionConfig`:

```rust
// All four thresholds are per-collection, set by the creator:
if collection.evolve_trade_threshold > 0 {
    let required = collection.evolve_trade_threshold * next_state;
    require!(evo.trade_count >= required, ...);
}
if collection.evolve_feed_threshold > 0 {
    let required = collection.evolve_feed_threshold * next_state;
    require!(evo.total_fed_lamports >= required, ...);
}
if collection.evolve_hold_seconds > 0 {
    let required = collection.evolve_hold_seconds * next_state;
    require!(held >= required, ...);
}
if collection.evolve_locked_threshold > 0 {
    let required = collection.evolve_locked_threshold * next_state;
    require!(evo.locked_lamports >= required, ...);
}
```

A threshold of `0` means "disabled." A creator who wants pure trade-based
evolution sets only `evolve_trade_threshold` and leaves the rest at 0. A
creator who wants no evolution at all uses `LifecycleType::Static`. A creator
who wants authority-controlled stages uses `LifecycleType::Custom` +
`set_visual_stage`.

**No evolution behavior is hardcoded.** The protocol provides the mechanism
(threshold checking, state advancement); the creator defines the policy.

---

## 6. Remaining Limitations

These are protocol-level constraints, not Z-specific assumptions. They apply
equally to all collections:

### 6.1 Supply Cap Ceiling

The protocol enforces `1 ≤ supply_cap ≤ 20,000`. A creator who wants more than
20,000 items cannot do so without a protocol upgrade (changing
`MAX_SUPPLY_CEILING`). This is a deliberate protocol-wide safety limit, not a
collection-specific restriction. For your 10,000-item collection: no problem.

### 6.2 Name Uniqueness

Collection names are PDA seeds. Two collections cannot share a name. This is
enforced by Solana's PDA derivation (the second `create_collection` with the
same name fails at `init`). First-come-first-served.

### 6.3 Metadata URI Length

`metadata_uri` is capped at 200 characters. Arweave URIs
(`https://arweave.net/<64-char-hash>`) are ~67 chars. IPFS URIs via gateways
are similar. 200 chars is sufficient for any standard URI scheme. If a creator
needs a longer URI (e.g., a very long query string), they would need to use a
shortener or a proxy. This is a storage cost trade-off, not a collection
assumption.

### 6.4 No On-Chain Artwork Storage

The protocol does not store artwork on-chain. It stores a `metadata_uri`
pointer and an optional `artwork_manifest_hash` for integrity verification.
The actual artwork, stage names, item metadata, and branding live off-chain
at the URI. This is by design — on-chain artwork storage would be
prohibitively expensive. Creators are responsible for hosting their manifest
(Arweave, IPFS, or any HTTP endpoint).

### 6.5 Creation Fee

Every `create_collection` pays a fee to the protocol treasury
(`protocol_config.creation_fee_lamports`, default ~0.068 SOL). This is a
protocol-wide spam deterrent, not a collection-specific assumption. The fee
goes to the treasury, not to any collection-specific address.

### 6.6 Immutable Parameters

Once a collection is created, these fields are immutable:
- `supply_cap` (no inflation after launch)
- `shatter_fee_bps`, `trade_royalty_bps` (no fee changes after launch)
- `fee_destinations` (no redirecting fees after launch)
- `lock_amount_lamports`, `mint_price_lamports` (no price changes after launch)
- `lifecycle_type`, `max_states`, evolution thresholds
- `reveal_authority`

The only field that can be updated is `metadata_uri` (via `update_metadata`,
creator-only). This allows creators to fix broken art links or update manifests
while keeping all economic parameters locked forever. This is a security
feature, not a limitation.

---

## 7. End-to-End Lifecycle for an Arbitrary Creator

### Step 1: Prepare Off-Chain Assets

The creator prepares:
- A manifest JSON file (stage names, image templates, fallback image)
- Individual artwork files (one per EVO, or a template with `{id}` and `{stage}`)
- Hosts everything at a public URI (e.g., `https://arweave.net/abc/manifest.json`)

The protocol does not need to know the manifest format — it only stores the URI.
The frontend reads the manifest to render images and stage names.

### Step 2: Create Collection On-Chain

The creator calls `create_collection` with their parameters. This creates one
`CollectionConfig` PDA. The creator pays the creation fee to the protocol
treasury.

**Accounts created: 1 (`CollectionConfig`)**

### Step 3: (Optional) Commit Reveal

If the creator chose `CommitReveal` lifecycle, they call `commit_reveal` with
`keccak256(secret)` before any EVOs are forged. This proves the reveal will be
fair.

**Accounts created: 0** (modifies `CollectionConfig.reveal_commitment`)

### Step 4: Users Forge EVOs

Any user calls `forge(evo_id, resonance_seed)`. The protocol:
1. Checks `current_supply < supply_cap`
2. Creates a new `EVOAccount` PDA
3. Transfers mint price from user to creator
4. Transfers lock amount from user to EVO PDA (locked SOL)
5. Increments `current_supply`

**Accounts created: 1 (`EVOAccount`) per forge**

### Step 5: (Optional) Reveal

If the creator chose `Reveal`, `CommitReveal`, or `RevealAndEvolve` lifecycle,
the reveal authority calls `reveal_collection(secret)`. The protocol:
1. Verifies the authority matches `reveal_authority`
2. Verifies the secret matches the commitment (if `CommitReveal`)
3. Sets `is_revealed = true` and derives `reveal_entropy`

**Accounts created: 0** (modifies `CollectionConfig`)

### Step 6: Trading

Users can `list`, `delist`, `buy`, `transfer`, and `feed` at any time. Each
`buy` increments the trade count and adds a fracture line. The protocol routes
royalties based on `CollectionConfig.trade_royalty_bps` and
`royalty_destination`.

**Accounts created: 0** (modifies `EVOAccount`)

### Step 7: (Optional) Evolution

If the creator chose `RevealAndEvolve` or `Custom` lifecycle, EVOs can evolve:
- `RevealAndEvolve`: anyone calls `evolve()` — the EVO advances if all enabled
  thresholds are met (trades, feeds, hold time, locked value)
- `Custom`: the reveal authority calls `set_visual_stage(stage)` to override
  stages without threshold checks

**Accounts created: 0** (modifies `EVOAccount.current_state`)

### Step 8: Shatter

An EVO owner can `shatter` to reclaim locked SOL minus the shatter fee. The
EVO is marked as shattered and the account is closed (lamports returned to
owner).

**Accounts destroyed: 1 (`EVOAccount`)**

### Step 9: (Optional) Close Collection

If the collection is empty (0 forged EVOs), the creator can `close_collection`
to reclaim rent.

**Accounts destroyed: 1 (`CollectionConfig`)**

---

## 8. Conclusion

The EVO protocol is a **generic, collection-agnostic, value-locking lifecycle
engine**. An arbitrary creator can launch a 10,000-item collection with custom
artwork, metadata, and evolution stages using the same `create_collection`
instruction as any other creator. No protocol changes, no team approval, no
special-case code.

The protocol's role is precisely scoped:
1. **Lock SOL** inside EVO accounts (forge, feed)
2. **Enforce supply caps** (forge checks `supply_cap`)
3. **Route fees** (buy royalty, shatter fee — all creator-configured)
4. **Manage lifecycle** (reveal, evolve — all creator-configured thresholds)
5. **Record provenance** (trade count, fracture lines, owner history)

Everything visual — artwork, stage names, branding, item metadata — lives
off-chain at the creator's `metadata_uri`. The protocol never makes assumptions
about what the art looks like, what stages are called, or what the collection
represents.

**The protocol is ready for arbitrary creators today.**