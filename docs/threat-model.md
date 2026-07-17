# EVO Protocol Threat Model

> **Status:** V1 — prepared for independent security audit
> **Scope:** EVO Solana program (`programs/evo/`), all instructions, account layouts, and CPIs
> **Out of scope (for V1 audit):** Frontend, SDK, off-chain indexer, marketplace UI

---

## 1. Assets

| Asset | Location | Protected by |
|---|---|---|
| Locked SOL | EVO PDA lamport balance | Program ownership + `locked_lamports` accounting + `verify_reserve_invariant` |
| EVO ownership | `EVOAccount.owner` field | Owner signature constraint on `transfer`, `list`, `delist`, `shatter` |
| Collection configuration | `CollectionConfig` PDA | Creator signature on `update_metadata`, `close_collection` |
| Collection supply cap | `CollectionConfig.supply_cap` | `forge` checks `current_supply < supply_cap` |
| Reveal secret | `CollectionConfig.reveal_commitment` | `keccak256(secret) == commitment` check in `reveal_collection` |
| Visual stage | `EVOAccount.current_state` | Lifecycle rules in `evolve` / `set_visual_stage` |
| Protocol fee treasury | `ProtocolConfig.treasury` | `address = protocol_config.treasury` on `create_collection` |
| Mint price | `CollectionConfig.mint_price_lamports` | Set at creation, paid by `forge` to creator |
| Creation fee | `ProtocolConfig.creation_fee_lamports` | Set at `initialize`, paid by `create_collection` to treasury |

---

## 2. Trust assumptions

1. **Solana runtime** is trusted to enforce:
   - PDA derivation (seeds must match)
   - Account ownership (only owner program can debit program-owned accounts)
   - Signer verification
   - Rent exemption (runtime does not drain rent-exempt accounts)
   - Atomic transaction execution (all-or-nothing per instruction)

2. **System Program** is trusted to:
   - Transfer SOL only from signer-authorized accounts
   - Reject transfers from program-owned accounts (forces `transfer_lamports` path)

3. **Collection creators** are trusted to:
   - Set fair fee parameters (bounded by `MAX_SHATTER_FEE_BPS = 2000`, `MAX_ROYALTY_BPS = 2500`)
   - Choose a reliable `reveal_authority` if using Reveal lifecycle
   - Host off-chain artwork manifests at `metadata_uri`

4. **EVO owners** are trusted to:
   - Sign their own transactions (transfer, list, delist, shatter)
   - Accept that shatter is irreversible

5. **Off-chain infrastructure** (marketplaces, indexers, frontend) is NOT trusted to be authoritative — the on-chain program state is the source of truth for ownership, locked SOL, and visual stage.

---

## 3. Attackers

| Attacker | Capabilities | Motivation |
|---|---|---|
| Unauthorized wallet | Submit any transaction, craft arbitrary accounts | Steal locked SOL, forge ownership, buy below market |
| Malicious collection creator | Set fee parameters, choose lifecycle, set reveal authority | Maximize fees, trap user SOL, front-run reveals |
| Compromised reveal authority | Reveal secrets, set visual stages (Custom only) | Bias reveal entropy, manipulate stage transitions |
| Rogue EVO owner | List, delist, transfer, shatter own EVOs | Double-spend via listing+shatter, evade fees |
| Third-party depositor | Send SOL to any PDA via System Program | Inflate apparent value, grief accounting |
| MEV/searcher | Front-run, back-run, sandwich transactions | Extract value from buy/list/delist ordering |

---

## 4. Attacker capabilities

- Submit arbitrary instructions with arbitrary account combinations
- Substitute wrong accounts (wrong collection, wrong EVO, wrong seller)
- Provide malformed instruction arguments (zero, max u64, empty strings)
- Send external SOL deposits to any PDA
- Observe mempool and front-run transactions
- Sign only with their own keypairs

---

## 5. Security goals

1. **Locked SOL can only leave an EVO PDA via `shatter`, and only to the owner** (minus fee to configured destination).
2. **Only the current `owner` field can transfer, list, delist, or shatter** an EVO.
3. **Supply cap cannot be exceeded.**
4. **Fee parameters cannot exceed protocol maximums** (20% shatter, 25% royalty).
5. **Reveal cannot be biased** — commitment must precede reveal, hash must match.
6. **Stage transitions follow lifecycle rules** — Static never transitions, Reveal is one-shot, RevealAndEvolve/Custom enforce `current_state < max_states`.
7. **Listed EVOs cannot be shattered** — `require!(!evo.is_listed)` prevents listed-and-destroyed ambiguity.
8. **`locked_lamports` field always matches or underestimates the actual PDA balance** — `PDA_balance >= rent_minimum + locked_lamports`.
9. **Reserve invariant is verified** after forge, feed, and shatter (defense-in-depth).
10. **No arithmetic overflow** — all additions use `checked_add`/`checked_sub`.

---

## 6. Out of scope

- Frontend / marketplace UI bugs
- Off-chain metadata hosting availability or content moderation
- Key management (users losing private keys — locked SOL becomes unrecoverable)
- MEV protection (the protocol does not implement anti-sandwich; marketplaces must handle this)
- Staking or yield-bearing mechanisms (not in V1)
- Cross-program composability beyond System Program transfers
- Quantum-resistant cryptography (Solana uses standard curves)
- Governance or DAO mechanisms
- Insurance fund for lost SOL due to user error

---

## 7. Threats and mitigations

### T1: Unauthorized shatter (steal locked SOL)

**Threat:** Attacker calls `shatter` on an EVO they don't own.

**Mitigation:**
- `constraint = evo.owner == owner.key()` — only the owner field can shatter
- `owner` is a `Signer` — must sign the transaction
- PDA seeds include `collection_config.key()` and `evo_id` — cannot forge a different EVO

**Residual risk:** None — owner signature is enforced at the Solana runtime level.

---

### T2: Shatter while listed (marketplace ambiguity)

**Threat:** Owner lists an EVO, then shatters it while listed. A buyer's `buy` could fail because the account is closed.

**Mitigation (V3):**
- `require!(!evo.is_listed)` in `shatter` — listed EVOs must be delisted first
- This makes marketplace semantics explicit: listed = tradable, not destructible

**Residual risk:** None — the protocol now rejects shatter while listed.

---

### T3: Stale listing after transfer

**Threat:** Owner lists EVO, transfers it, then buyer tries to buy from the old listing.

**Mitigation:**
- `transfer` sets `is_listed = false` and `list_price_lamports = 0`
- `buy` requires `evo.is_listed` — stale listings are not buyable

**Residual risk:** None — transfer clears listing state atomically.

---

### T4: Substituted collection account

**Threat:** Attacker passes a different collection's PDA to `shatter` or `buy`.

**Mitigation:**
- `shatter` derives EVO PDA from `collection_config.key()` — substituted collection produces wrong PDA (seeds mismatch)
- `buy` uses `seeds = [COLLECTION_SEED, collection_config.name.as_bytes()]` — wrong collection fails seed derivation
- `evolve` checks `evo.collection == collection.key()`

**Residual risk:** None — PDA derivation is enforced by the runtime.

---

### T5: Fee parameter overflow / boundary

**Threat:** Creator sets shatter fee or royalty above 100% to steal all locked SOL.

**Mitigation:**
- `require!(shatter_fee_bps <= MAX_SHATTER_FEE_BPS)` — 2000 (20% max)
- `require!(trade_royalty_bps <= MAX_ROYALTY_BPS)` — 2500 (25% max)
- Checked at `create_collection` — cannot be set higher

**Residual risk:** None — hard-coded maximums.

---

### T6: Buy with insufficient payment

**Threat:** Buyer submits `buy` with less SOL than the list price.

**Mitigation:**
- `require!(buyer_balance >= price)` — checked before any transfer
- System Program transfer would fail anyway if buyer has insufficient balance

**Residual risk:** None — double-checked.

---

### T7: Zero-price listing

**Threat:** Owner lists for 0 lamports, causing division-by-zero or free acquisition.

**Mitigation:**
- `list` requires `price_lamports > 0`
- `buy` requires `price > 0`

**Residual risk:** None.

---

### T8: Max u64 price overflow

**Threat:** Owner lists for `u64::MAX`, buyer pays, royalty calculation overflows.

**Mitigation:**
- `calculate_fee` uses `u128` intermediate: `(amount as u128 * bps as u128 / 10000) as u64`
- `seller_proceeds = price.checked_sub(royalty)` — checked subtraction
- Buyer must actually have `u64::MAX` lamports (impossible — total SOL supply is ~550M)

**Residual risk:** None — buyer can never have enough SOL to buy at max price.

---

### T9: Reveal entropy bias

**Threat:** Reveal authority changes the secret after seeing minted indices to assign favorable artwork.

**Mitigation:**
- `commit_reveal` must be called BEFORE minting starts (`current_supply == 0`)
- `reveal_collection` checks `keccak256(secret) == commitment`
- Once committed, hash cannot be changed (`require!(reveal_commitment == [0u8; 32])`)

**Residual risk:** Low — requires creator to pre-commit. If creator never commits, `reveal_collection` can reveal with any secret (no commitment check when commitment is zero). This is documented behavior: collections without commit-reveal trust the reveal authority entirely.

---

### T10: External SOL deposit to EVO PDA

**Threat:** Attacker sends SOL directly to an EVO PDA via System Program, inflating its balance beyond `locked_lamports`.

**Mitigation:**
- This is NOT a security violation — the invariant is a lower bound (`>=`)
- Extra lamports go to the owner on shatter via `close = owner`
- `locked_lamports` is not affected — the accounting field remains correct
- `verify_reserve_invariant` checks `>=`, not `==`, so surplus is allowed

**Residual risk:** Low — griefing (attacker wastes SOL to inflate an EVO's apparent value), but the SOL goes to the owner, not the attacker. This is effectively a forced donation.

---

### T11: Account closure destination manipulation

**Threat:** Attacker manipulates the `close` destination to send rent to themselves.

**Mitigation:**
- `shatter` uses `close = owner` — destination is the owner signer, hardcoded in the `#[account]` macro
- `close_collection` manually sets `**creator.lamports.borrow_mut() += lamports` — creator is the signer
- Neither instruction accepts a configurable closure destination

**Residual risk:** None — closure destinations are enforced by signer constraints.

---

### T12: Duplicate mutable account aliases

**Threat:** Attacker passes the same account twice with different aliases, causing double-debit.

**Mitigation:**
- Anchor's `#[derive(Accounts)]` detects duplicate accounts with different mutability and rejects
- All accounts are distinct PDA derivations or signers — cannot alias

**Residual risk:** None — Anchor framework protection.

---

### T13: Malformed lifecycle configuration

**Threat:** Creator sets `max_states = 0` for RevealAndEvolve, causing underflow in `evolve` (`max_states - 1`).

**Mitigation:**
- `create_collection` requires `lifecycle.max_states > 0` for RevealAndEvolve and Custom
- `evolve` checks `max_states > 0` before subtracting
- `set_visual_stage` checks `stage < max_states`

**Residual risk:** None — validated at creation and rechecked at use.

---

### T14: Reentrancy via shatter

**Threat:** `shatter` moves lamports, but a re-entrant call could double-shatter.

**Mitigation:**
- `is_shattered = true` and `locked_lamports = 0` are set BEFORE any lamport movement
- `verify_reserve_invariant` runs before mutation
- Solana's runtime is single-threaded per account — no re-entrancy within a single instruction
- The EVO PDA is closed (`close = owner`) — the account is gone after shatter

**Residual risk:** None — Solana does not support re-entrancy, and the account is destroyed.

---

### T15: Missing treasury account

**Threat:** Fee destination is Treasury or Split, but the `treasury` account is not provided.

**Mitigation:**
- `shatter` and `route_fee` return `EvoError::MissingTreasury` when `treasury` is `None`
- `treasury` is `Option<UncheckedAccount>` / `Option<SystemAccount>` — Anchor enforces presence at runtime

**Residual risk:** None — explicit error.

---

### T16: Invalid burn destination

**Threat:** Attacker substitutes a burn destination to redirect burned fees.

**Mitigation:**
- `shatter` checks `incinerator.key() == burn_dest` where `burn_dest` is `collection.burn_destination` or `INCINERATOR`
- `route_fee` checks the same for `buy` royalties
- `burn_destination` is set at `create_collection` and is immutable

**Residual risk:** None — verified at runtime against the collection's stored value.

---

## 8. Remaining risks (to discuss with auditor)

### R1: Owner key loss = permanent SOL lock

If an EVO owner loses their private key, the locked SOL is permanently unrecoverable. There is no recovery mechanism, no time-locked rescue, and no admin override. This is by design (true ownership) but should be communicated clearly to users.

**Recommendation:** Frontend should warn users about key management. Consider a future "dead EVO" recovery proposal requiring protocol governance.

### R2: Collection creator can set fees up to 20%/25%

The protocol enforces maximums, but a malicious creator can still set fees at the maximum, extracting significant value from owners on shatter or trade. Users must evaluate collection terms before minting.

**Recommendation:** Frontend should display fee parameters prominently before minting.

### R3: Reveal authority trust

For Reveal/CommitReveal/RevealAndEvolve collections, the `reveal_authority` controls reveal entropy (and visual stages in Custom mode). If the authority key is compromised, artwork assignment can be manipulated. Without `commit_reveal`, the authority can choose the secret freely.

**Recommendation:** Collections should always use `commit_reveal` before minting. Document this as a best practice.

### R4: Upgrade authority is not yet revoked

The program remains upgradeable. A compromised upgrade authority key could deploy a malicious upgrade. This is intentional during the testing/audit phase.

**Recommendation:** Revoke upgrade authority only after audit passes and the protocol is stable for months (see Mainnet Launch Strategy in WHITEPAPER.md).

### R5: No MEV protection

The protocol does not implement anti-sandwich or commit-reveal for trades. Marketplaces building on EVO must handle MEV protection (e.g., Jito bundles, private mempools).

**Recommendation:** This is a marketplace-layer concern, not a protocol-layer one. Document for integrators.

### R6: No pause/circuit breaker

There is no admin "pause" instruction. If a bug is discovered post-launch, the only remediation is a program upgrade (if upgrade authority is not yet revoked).

**Recommendation:** Consider adding an optional `is_paused` flag to `CollectionConfig` or `ProtocolConfig` in a future version. For V1, rely on upgrade authority.

---

## 9. Summary

The EVO protocol is designed around a single core guarantee: **locked SOL is always backed by real lamports in the EVO PDA, and only the owner can release them via shatter.** The threat model identifies 16 specific threats, all mitigated by on-chain constraints. Six remaining risks are design tradeoffs, not vulnerabilities, and should be communicated to users and auditors.

The protocol is ready to **enter independent security audit**. It is not yet ready to hold public mainnet SOL.