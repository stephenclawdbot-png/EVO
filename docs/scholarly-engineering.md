# EVO Protocol: Scholarly and Engineering Document

> A formal treatment of the EVO primitive: design rationale, invariants, formal value model, security analysis, and comparison to existing systems.

---

## 1. Abstract

EVO (Evolving Value Object) is a Solana-native digital asset primitive that unifies speculative collectibility with guaranteed price floors. Each EVO is a program-derived address (PDA) holding locked SOL, where the account balance itself serves as the source of truth for redeemable value. The primitive introduces four operations that are absent from existing NFT and token standards: feed (incremental floor increase by the owner), shatter (irreversible redemption that destroys the asset), evolve (protocol-enforced visual stage transition), and commit-reveal (provably fair reveal via keccak256 commitments).

This document presents the formal value model, state machine, invariant set, security properties, and a comparative analysis against existing Solana asset standards. The protocol has undergone two independent security reviews with all findings remediated, and 57 tests across happy-path and adversarial scenarios.

---

## 2. Problem Statement

Existing digital asset standards on Solana (Metaplex NFTs, SPL tokens, cNFTs) share a common limitation: the asset has no intrinsic value backing. An NFT is a pointer to off-chain metadata. A token is a balance field. Neither has a guaranteed redemption value. Price floors are social conventions enforced by marketplaces and community sentiment, not by the asset itself.

This creates several failure modes:

1. **No downside protection.** Holders of standard NFTs have no guaranteed exit. If market sentiment drops, the asset can go to zero with no floor mechanism.

2. **Wash trading and manipulation.** Without an enforced floor, marketplaces rely on royalty enforcement and reputation. These are gameable.

3. **No progressive value accumulation.** Standard assets cannot absorb additional value after mint. The holder can only sell or hold.

4. **No supply discipline.** Collections have fixed supply but no mechanism to reduce supply organically. Dead collections stay dead at full supply.

5. **No provable fairness for reveals.** Reveal-based collections rely on creator honesty. The creator can see mints before revealing and adjust the randomness.

EVO addresses all five.

---

## 3. Design Principles

### 3.1 The Program Is The Source Of Truth

All value, ownership, and visual state live on-chain in the EVO program. No off-chain indexer, no centralized database, no marketplace enforcement layer. The account's actual lamport balance is the redeemable value, not a stored field. This eliminates a class of bugs where a stored balance can diverge from the actual balance.

### 3.2 Immutability After First Mint

Collection parameters (supply cap, mint price, lock amount, royalty, shatter fee, lifecycle type) are immutable after the first EVO is forged. This is enforced in the `create_collection` and `forge` instructions. The creator cannot change the rules after collectors have committed. This is a trust minimization property.

### 3.3 Permissionless Creation

Anyone can create a collection by paying a fixed protocol fee. There is no authority gate, no application, no allowlist. This follows the Solana philosophy of open access. The protocol does not curate quality. The market does.

### 3.4 Optional Complexity

The lifecycle system supports five types ranging from Static (no visual changes) to Custom (authority-controlled stages). A creator who wants a simple collectible can use Static and never think about evolution. A creator who wants a complex evolving collection can use RevealAndEvolve or Custom. The protocol does not force complexity.

---

## 4. Formal Value Model

### 4.1 Definitions

Let:
- `L` = locked_lamports (SOL locked inside the EVO at forge time, plus all fed SOL)
- `R` = rent_exempt_minimum (Solana rent for the PDA account)
- `B` = actual account balance in lamports
- `F_s` = shatter_fee_bps / 10000 (shatter fee fraction)
- `P_m` = mint_price (paid to creator at forge)
- `P_a` = asking_price (set by seller when listing)
- `F_r` = royalty_bps / 10000 (royalty fraction)

### 4.2 The Floor

The floor is the guaranteed minimum redemption value:

```
floor = min(B - R, L) * (1 - F_s)
```

This is what the owner receives upon shatter. The `min(B - R, L)` term ensures that:
- If `B - R >= L`: the owner gets L minus fee (normal case)
- If `B - R < L`: the owner gets only what is actually there (defensive case, should not happen if invariant holds)

### 4.3 The Market Price

```
market_price = floor + premium
```

Where premium is a function of:
- `S` = scarcity (minted / cap, and survivors after shatters)
- `A` = age (time since forge)
- `T` = trade count
- `C` = creator reputation (off-chain signal)
- `D` = community desire (off-chain signal)

```
premium = f(S, A, T, C, D)
```

The protocol does not model premium. The market does.

### 4.4 The Reserve Invariant

For every EVO account at all times:

```
B >= R + L
```

This is enforced on every state-changing instruction:
- `forge`: B is set to R + L (mint price goes to creator, lock amount goes to PDA)
- `feed`: B increases by feed amount, L increases by feed amount
- `buy`: B unchanged (SOL moves between buyer and seller, not from PDA)
- `shatter`: B is swept to owner and fee destination, PDA closed
- `evolve`: B unchanged (state change only)
- `transfer`: B unchanged (ownership change only)

The invariant ensures the floor is always backed by actual lamports.

---

## 5. State Machine

```
                    FORGED
                       |
              +--------+--------+
              |                 |
           feed()           list()
              |                 |
              v                 v
            HELD             LISTED
              |                 |
              |              bought
              |                 |
              +--------+--------+
                       |
                    shatter()
                       |
                       v
                   DESTROYED

  transfer(): HELD -> HELD (new owner)
  evolve():   HELD -> HELD (new stage, same owner)
  feed():     HELD -> HELD (higher floor, same owner)
  list():     HELD -> LISTED
  delist():   LISTED -> HELD
  buy():      LISTED -> HELD (new owner)
  shatter():  HELD or LISTED -> DESTROYED
```

Note: listed EVOs cannot be transferred. The owner must delist first. This prevents listing hijacking and race conditions between transfer and buy.

---

## 6. Instruction Set

The protocol exposes 16 instructions (15 core plus Merkle verification):

| Instruction | Authority | Pre-conditions | Post-conditions |
|---|---|---|---|
| initialize_protocol | deployer | Protocol not initialized | Protocol singleton created |
| create_collection | anyone | Protocol initialized, fee paid | Collection PDA created, params set |
| forge | anyone | Collection not closed, supply < cap | EVO PDA created, SOL locked |
| feed | EVO owner | EVO exists, not listed | locked_lamports increased |
| list | EVO owner | EVO exists, not listed | is_listed = true, asking_price set |
| delist | EVO owner | EVO is listed | is_listed = false |
| buy | anyone (not seller) | EVO is listed, buyer != seller | Ownership transferred, royalty paid |
| transfer | EVO owner | EVO exists, not listed | Ownership changed, no SOL moved |
| shatter | EVO owner | EVO exists | SOL returned, PDA closed |
| evolve | EVO owner | Conditions met (lifecycle-dependent) | current_state incremented |
| commit_reveal | creator | Collection uses CommitReveal, no mints yet | Commit hash stored |
| reveal_collection | creator | Commit exists or Reveal type | EVOs advanced to stage 1 |
| close_collection | creator | Supply = 0 | Collection PDA closed |
| update_metadata | creator | Collection exists | metadata_uri updated |
| set_visual_stage | authority | Collection uses Custom | current_state set |
| verify_merkle_proof | anyone | Proof valid | manifest_verified = true |

---

## 7. Security Properties

### 7.1 Floor Guarantee

**Property:** For any EVO account, `shatter()` returns at least `min(B - R, L) * (1 - F_s)` lamports to the owner.

**Proof sketch:** The `shatter` instruction reads `account.lamports()`, computes `redeemable = min(balance - rent_minimum, locked_lamports)`, subtracts the shatter fee, and transfers via direct lamport manipulation to the owner and fee destination. The reserve invariant (Section 4.4) ensures `B >= R + L` at all times, so `B - R >= L`, so `min(B - R, L) = L`. The owner receives `L * (1 - F_s)`.

**Adversarial test:** The test suite includes cases where extra lamports are sent to the PDA (should be ignored, only locked_lamports tracked) and where the balance is manually reduced (should only return what is there).

### 7.2 Immutability

**Property:** After the first `forge()` call on a collection, the parameters `supply_cap`, `mint_price`, `lock_amount`, `royalty_bps`, `shatter_fee_bps`, `lifecycle_type`, and `randomness_policy` cannot be changed by any instruction.

**Implementation:** The `forge` instruction checks if `current_supply == 0`. If so, it sets `params_locked = true` on the collection. No instruction modifies these fields when `params_locked` is true. There is no "unlock" instruction.

### 7.3 Self-Trade Prevention

**Property:** A wallet cannot purchase an EVO it has listed for sale.

**Implementation:** The `buy` instruction checks `buyer.key() != seller.key()` and reverts with `SelfTradeNotAllowed` if violated.

### 7.4 Commit-Reveal Fairness

**Property:** The creator cannot change the reveal secret after mints have occurred.

**Implementation:** The `commit_reveal` instruction stores `keccak256(secret)` before minting starts. The `reveal_collection` instruction verifies that `keccak256(submitted_secret) == committed_hash`. If the creator tries to submit a different secret, verification fails with `WrongRevealSecret`.

**Adversarial tests:** Double commit (rejected), non-creator commit (rejected), wrong secret at reveal (rejected).

### 7.5 Listed Transfer Rejection

**Property:** An EVO that is listed for sale cannot be transferred.

**Implementation:** The `transfer` instruction checks `!is_listed` and reverts with `EvoIsListed` if true. The owner must call `delist` first.

**Rationale:** Without this, a race condition exists where an owner transfers an EVO to themselves at a different wallet to dodge a sale, or a buyer and seller could collude to bypass royalty by transferring instead of buying.

### 7.6 Direct Lamport Manipulation

**Property:** Shatter correctly returns SOL to the owner even though the PDA is program-owned.

**Implementation detail:** Standard Solana practice is to use `system::transfer` CPI for SOL transfers. However, when the source account is owned by the program itself (not the System Program), the System Program cannot transfer from it. The EVO program uses direct lamport manipulation: `*to_account_info.lamports.borrow_mut() += amount; *from_account_info.lamports.borrow_mut() -= amount;`. This is the correct pattern for program-owned accounts and was verified in the security review.

---

## 8. Lifecycle System

### 8.1 Lifecycle Types

| Type | Stage Transitions | Trigger |
|---|---|---|
| Static | None | N/A |
| Reveal | 0 -> 1 | Creator calls reveal_collection |
| CommitReveal | 0 -> 1 | Creator commits hash, then reveals |
| RevealAndEvolve | 0 -> 1 -> 2 -> ... -> max | Reveal then evolve when conditions met |
| Custom | Arbitrary | Authority calls set_visual_stage |

### 8.2 Evolution Conditions

For RevealAndEvolve collections, `evolve()` checks:
- `lifecycle_type == RevealAndEvolve`
- `is_revealed == true`
- `current_state < max_states - 1` (off-by-one fixed: cannot evolve past max)
- Additional conditions per collection config (trade count, feed amount, hold time, locked value)

### 8.3 Randomness Policies

| Policy | Description |
|---|---|
| None | Deterministic stages, no randomness |
| Predetermined | Creator sets a secret at creation |
| BatchReveal | Reveal in batches for efficiency |

The commit-reveal flow uses keccak256 for commitment. The secret is a 32-byte value. The hash is stored on-chain. The reveal submits the preimage.

---

## 9. Comparison To Existing Standards

| Feature | Metaplex NFT | SPL Token | cNFT | EVO |
|---|---|---|---|---|
| Intrinsic value | No | No | No | Yes (locked SOL) |
| Guaranteed floor | No | No | No | Yes |
| Built-in marketplace | No (external) | No (external) | No (external) | Yes (list/buy) |
| Progressive value (feed) | No | No | No | Yes |
| Redemption (shatter) | No | No | No | Yes |
| Visual evolution | No | No | No | Yes (5 types) |
| Provably fair reveal | No | N/A | No | Yes (commit-reveal) |
| Immutable params | No (metadata mutable) | No (authority can mint) | No | Yes (after first forge) |
| Permissionless creation | Yes | Yes | Yes | Yes |
| Royalty enforcement | Marketplace-dependent | N/A | Marketplace-dependent | Program-enforced |
| Supply reduction | No (can burn) | Yes (burn) | Yes (burn) | Yes (shatter) |
| Composable (reads) | Yes | Yes | Yes | Yes |
| Composable (writes) | No | No | No | No (EVO program owns PDAs) |

### Key Distinction

The fundamental difference is that EVO assets hold value inside themselves. All other standards are pointers. An NFT points to metadata. A token points to a balance. An EVO is the balance. This eliminates the need for external price floors, marketplace enforcement, and trust in off-chain systems.

---

## 10. Fee Model

### 10.1 Protocol Fee

Collection creation: 0.06789 SOL, paid to protocol treasury. Fixed and non-configurable. This is a spam prevention measure, not a revenue mechanism.

### 10.2 Collection Fees (Creator-Set, Immutable)

| Fee | Range | Destination |
|---|---|---|
| Mint price | 0 to unlimited | Creator wallet |
| Royalty | 0 to 2500 bps | Creator-chosen |
| Shatter fee | 0 to 2000 bps | Creator-chosen |

Fee destinations: Treasury, Creator, Burn (incinerator 1nc1nerator11111111111111111111111111111111), or Split.

All collection fees are set at `create_collection` and locked after the first `forge`. The creator cannot change them. This is a property of the protocol, not a configuration option.

---

## 11. Testing and Verification

### 11.1 Test Coverage

57 tests total:
- 41 happy-path tests: forge, feed, transfer, list, buy, shatter, commit-reveal, reveal, evolve, burn fee routing, all lifecycle types
- 16 adversarial tests: double commit, wrong secret, non-authority calls, overflow, max state, self-trade, listed transfer

### 11.2 CI Status

- Localnet: 17 consecutive green runs (41 tests each)
- Devnet: 64/64 passing (run #29657843293)
- Cluster-aware test suite (airdrops on localnet, transfers on devnet)

### 11.3 Security Reviews

Two independent reviews:
1. Line-by-line manual review: identified 5 CRITICAL, 6 HIGH, 1 MEDIUM findings
2. Agent-based adversarial review: confirmed fixes, no new findings

All findings remediated. Build verification is byte-for-byte reproducible.

### 11.4 Key Findings Remediated

| Finding | Severity | Fix |
|---|---|---|
| Deployer authority check on initialize | CRITICAL | Added deployer key check |
| Burn destination PDA validation | CRITICAL | Added PDA derivation check |
| Listed EVO transfer | HIGH | Reject transfer when is_listed |
| close_collection panic on parse | HIGH | Panic-free parsing |
| buy.rs seller UncheckedAccount | HIGH | Added ownership and signer checks |
| Evolve off-by-one | MEDIUM | Fixed boundary to current_state < max_states - 1 |

---

## 12. Limitations and Future Work

### 12.1 Current Limitations

1. **No partial redemption.** Shatter is all-or-nothing.
2. **No lending.** No built-in collateralization. Third parties can build on top.
3. **No batch operations.** One EVO per instruction.
4. **Upgrade authority retained.** To be renounced after formal third-party audit.
5. **No on-chain art verification.** Manifest hash stored but content not verified.
6. **No VRF integration.** Commit-reveal is active. VRF adapter framework exists but not wired to Switchboard.

### 12.2 Roadmap

1. Engage Solana security firm for formal third-party review
2. Renounce upgrade authority
3. Wire VRF adapter to Switchboard for production randomness
4. Explore partial redemption patterns
5. Explore lending integration with Solana lending protocols
6. Explore batch operations via transaction composition

---

## 13. Formal Invariant Set

For the EVO program to be correct, the following invariants must hold at all times:

**I1: Reserve.** For every EVO PDA, `account.lamports() >= rent_exempt_minimum + locked_lamports`.

**I2: Supply.** For every collection, `current_supply <= supply_cap`. Equality holds when collection is sold out.

**I3: Immutability.** For every collection with `current_supply > 0`, the parameters `supply_cap`, `mint_price`, `lock_amount`, `royalty_bps`, `shatter_fee_bps`, `lifecycle_type`, `randomness_policy` are unchanged from their values at the first `forge` call.

**I4: Ownership.** For every EVO PDA, `owner` is the signer of the last `forge`, `buy`, or `transfer` call. No instruction changes `owner` except these three.

**I5: Listed.** For every EVO PDA with `is_listed = true`, no `transfer` or `evolve` call can succeed. Only `delist`, `buy`, and `shatter` can act on a listed EVO.

**I6: Commit-Reveal.** For every collection using `CommitReveal`, the `reveal_collection` call must submit a secret whose keccak256 hash equals the committed hash. No other secret is accepted.

**I7: Self-Trade.** For every `buy` call, `buyer.key() != seller.key()`.

---

## 14. References

- Solana Account Model: https://docs.solana.com/developing/programming-model/accounts
- Program-Derived Addresses: https://docs.solana.com/developing/programming-model/accounts#program-derived-addresses
- Metaplex Token Standard: https://docs.metaplex.com/
- Switchboard VRF: https://docs.switchboard.xyz/
- Source code: https://github.com/stephenclawdbot-png/EVO

---

## Authors

naps (@naps000), admiralfinest (@admiralfinest), Benedict A.