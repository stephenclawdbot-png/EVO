# 05 — Protocol

## The Smallest Primitive

EVO is a protocol, not an app. The smallest version is:

```
Value + ownership + behavior interface
```

Everything else is built BY OTHER PEOPLE:

| Layer | What it is | Who builds it |
|-------|-----------|---------------|
| Protocol (EVO) | forge, shatter, transfer, feed, behavior interface | Us |
| Apps | Vault, Legacy, Patron, games, DeFi integrations | Anyone |
| Marketplace | Trading layer | Independent protocols |
| History | Provenance tracking | Indexers |
| Art/media | Visual expression — ships with the primitive | Frontends |

---

## The EVO Standard Interface (ESI)

The minimum interface for any program to compose with EVO:

```
fn forge(collection, evo_id, seed, behavior_params) -> EVO
fn shatter(evo) -> SOL to owner
fn transfer(evo, new_owner) -> EVO
fn feed(evo, amount) -> EVO (increases floor)
fn get_owner(evo) -> Pubkey
fn get_redeemable_value(evo) -> u64
fn get_behavior_type(evo) -> u32
```

7 functions. Any Solana program can verify ownership, read value, and interact with EVOs via CPI.

---

## Program Architecture

### Current (Deployed)

The program is live on mainnet with these instructions:

| Instruction | What it does |
|---|---|
| `initialize_protocol` | One-time setup — treasury, creation fee |
| `create_collection` | Creator sets supply, mint_price, lock_amount, fees, lifecycle |
| `forge` | Mint EVO — pays mint_price to creator, locks SOL inside |
| `feed` | Add SOL to existing EVO — increases floor |
| `list` | Owner sets sale price |
| `delist` | Owner removes listing |
| `buy` | Purchase listed EVO — royalties distributed |
| `shatter` | Destroy EVO — reclaim locked SOL (minus fee) |
| `transfer` | Send EVO to new owner — no payment |
| `close_collection` | Close empty collection, refund rent |
| `update_metadata` | Update collection metadata_uri (creator only) |
| `commit_reveal` | Creator commits keccak256(secret) before minting |
| `reveal_collection` | Reveal authority reveals collection (commit-reveal verified) |
| `evolve` | Permissionless stage advancement when thresholds met |
| `set_visual_stage` | Authority-only stage override (Custom lifecycle) |

### Future Architecture (Redesign)

```
Layer 1: Redemption Kernel (Immutable)
  → forge, shatter, transfer
  → Cannot be upgraded. Shatter always works.

Layer 2: Value Layer (Governed)
  → feed, set_authority

Layer 3: Market Layer (Independent)
  → list, buy, delist (separate PDAs, not in base EVO)

Layer 4: Collection Layer (Governed)
  → create_collection

Layer 5: History Layer (Optional)
  → Separate PDA, append-only
```

### Why Split Layers?

- **Redemption must be immutable** — users locking 100 SOL need to know shatter can never be blocked
- **Marketplace should be neutral** — listing state doesn't belong in the base primitive
- **History should be unbounded** — separate PDA, not limited to 20 fracture lines in the base account
- **Base account should be minimal** — ~170 bytes instead of ~1055 bytes

---

## Multi-Collection Protocol

Anyone can launch an EVO collection on the protocol:

```
EVO Protocol (one program on Solana)
├── Collection A (our flagship)
├── Collection B (competitor)
├── Collection C (another competitor)
└── ...anyone can launch here
```

### Why Competitors Use Our Protocol

| If they deploy their own | If they use EVO protocol |
|---|---|
| Build everything from scratch | Just call `create_collection` |
| Build their own marketplace | Marketplace already built in |
| No existing liquidity | Tap into EVO ecosystem |
| Maintain their own program | Protocol upgrades handled by us |
| No trust track record | EVO protocol is audited |

**The convenience moat:** It's 10x easier to launch on EVO than to build from scratch.

---

## Composability

### How Other Programs Compose

```rust
// 1. Verify it's a real EVO
fn is_valid_evo(account: &AccountInfo, program_id: &Pubkey) -> bool {
    account.owner == program_id && account.data_len() >= EVO_MIN_SIZE
}

// 2. Read redeemable value
fn get_redeemable_value(account: &AccountInfo) -> u64 {
    let evo = EVOAccount::deserialize(account.data);
    let actual_balance = account.lamports();
    let net_after_fee = evo.locked_lamports - calc_shatter_fee(evo);
    min(actual_balance, net_after_fee)
}

// 3. Read ownership
fn get_owner(account: &AccountInfo) -> Pubkey {
    EVOAccount::deserialize(account.data).owner
}
```

### Future: Authority States

For DeFi composability (lending, collateral, escrow):

```
enum AuthorityState {
    Owned,        // owner has full control
    Delegated,    // delegate can transfer (marketplace escrow)
    Custodied,    // custodian holds, owner can shatter
    Liened,       // lienholder has claim, owner cannot shatter
    Frozen,       // no operations (governance emergency only)
}
```

This is a **future enhancement.** The minimal version just has owner + transfer.

---

## Upgrade Policy

| Layer | Upgradable? | Why |
|-------|------------|-----|
| Redemption (forge/shatter/transfer) | NO (immutable after audit) | Store of value requires immutability |
| Value (feed) | Yes (governed) | Low risk, additive |
| Market (list/buy) | Yes (governed) | Independent, doesn't affect redemption |
| Collection | Yes (governed) | Configuration, not value |

**Timeline:**
1. Now: upgradeable (still building)
2. Post-audit: lock redemption kernel (immutable)
3. Behavior/market layers: DAO or multisig governance with timelock

---

## The Flywheel

```
More collections launch on EVO
  → More EVOs in existence
  → More people discover EVOs
  → More people trade EVOs
  → More liquidity
  → More attractive for new collections
  → More protocol revenue
  → Better development
  → (flywheel spins faster)
```

---

### Lifecycle Instructions (New)

EVO supports protocol-native visual lifecycles. The collection creator chooses one lifecycle type at creation:

| Lifecycle | Stages | Transition Method | Authority |
|---|---|---|---|
| `Static` | 1 (stage 0) | None | N/A |
| `Reveal` | 2 (0→1) | `reveal_collection()` | Reveal authority |
| `CommitReveal` | 2 (0→1) | `commit_reveal()` → `reveal_collection()` | Reveal authority |
| `RevealAndEvolve` | N (0→max) | `reveal_collection()` → `evolve()` | Permissionless evolution |
| `Custom` | N (0→max) | `set_visual_stage()` | Reveal authority |

**Key properties:**
- Per-asset `current_state: u16` stored on-chain (program is source of truth)
- `artwork_manifest_hash: [u8;32]` on collection for manifest integrity
- Static assets cannot transition
- Reveal assets can only go 0→1
- RevealAndEvolve: `evolve()` is permissionless when thresholds met
- Custom: authority can set any stage 0..max_states-1
- No backward transitions (forward only)

**Commit-reveal for provably fair reveal:**
1. Creator commits `keccak256(secret)` before minting begins
2. After all mints, creator reveals the secret
3. Program verifies hash matches commitment
4. Secret used as reveal entropy
5. Creator cannot change secret after committing

---

## PDA Seeds

```
Protocol Config:  ["protocol"]
Collection:       ["collection", name_bytes]
EVO:              ["evo", collection_key, evo_id_as_u32_le_bytes]
```

---

*Part of the [EVO documentation](../README.md)*
