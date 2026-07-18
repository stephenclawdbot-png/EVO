# EVO Protocol — Design Q&A

> Targeted security questions from protocol review feedback, with answers
> grounded in the actual instruction code and state design.

---

## 1. Can every invariant be violated through arbitrary instruction ordering?

**No.** Each instruction's `#[derive(Accounts)]` constraints enforce ownership,
collection binding, and state flags **before** the handler runs. The key
invariants and their enforcement:

| Invariant | Enforcement |
|---|---|
| Only owner can list/delist/feed/shatter/transfer | `constraint = evo.owner == signer.key()` in every mutating instruction |
| Shattered EVOs are frozen | `constraint = !evo.is_shattered` in forge, feed, list, buy, transfer, evolve |
| Listed EVOs can't be re-listed or transferred | `constraint = !evo.is_listed` in list; transfer clears listing |
| Supply cap enforced | `require!(collection.current_supply < collection.supply_cap)` in forge |
| Collection↔EVO binding | `constraint = evo.collection == collection_config.key()` in buy, evolve, shatter |
| Protocol must be initialized | `constraint = protocol_is_initialized(&protocol_config)` in forge, create_collection |

**Instruction ordering that cannot bypass these:**

- **Forge → Feed → Shatter**: shatter checks `!evo.is_listed` and `evo.owner == signer`. If you forge, feed, then shatter — all three are owner-gated. No ordering bypasses the owner check.
- **List → Transfer**: transfer clears `is_listed` and sets `list_price = 0`. You can't list, then transfer to bypass the royalty, because transfer charges the flat 0.009 SOL fee.
- **Commit → Reveal → Forge → Evolve**: reveal requires commitment (for CommitReveal type). Evolve requires `is_revealed`. No ordering skips the reveal gate.

**One area to watch**: `evolve` is **permissionless** — anyone can call it, but it
only advances if all thresholds are met. An attacker calling evolve early just
wastes their compute budget; it won't advance the state prematurely. This is
by design.

---

## 2. Can locked SOL ever become unaccounted for?

**No.** Locked SOL follows a strict accounting chain:

1. **Forge**: `System::transfer(owner → EVO PDA, lock_amount)` — SOL moves from
   the buyer into the PDA. `verify_reserve_invariant()` runs after the transfer
   to confirm `evo.lamports >= rent_minimum + locked_lamports`.

2. **Feed**: `System::transfer(feeder → EVO PDA, additional_lamports)` — same
   pattern. `locked_lamports` is incremented by the exact amount transferred.
   `verify_reserve_invariant()` runs again.

3. **Buy**: Locked SOL **does not move**. The buyer pays `list_price` to the
   seller (minus royalty). `locked_lamports` is unchanged. The EVO PDA's
   lamports are untouched.

4. **Transfer**: Locked SOL **does not move**. Only a 0.009 SOL fee moves from
   the current owner to treasury. `locked_lamports` is unchanged.

5. **Shatter**: The EVO PDA is closed (`close = owner`). Before closure:
   - Shatter fee is moved out via `transfer_lamports()` (direct lamport
     manipulation, required because System Program transfer doesn't work on
     program-owned accounts).
   - `is_shattered = true` and `locked_lamports = 0` are set **before** any
     lamport movement (reentrancy guard).
   - Anchor's `close` directive sends all remaining lamports (locked - fee +
     rent) to the owner.
   - `verify_reserve_invariant()` runs **before** any mutation.

**Invariant**: At every point in an EVO's lifecycle, `evo.lamports >=
rent_minimum + locked_lamports`. This is checked after forge, after feed, and
before shatter. The only way lamports leave the PDA is through shatter (which
zeroes `locked_lamports`) or through the `close` directive (which also zeroes
the account).

**Edge case**: If someone sends extra lamports to the EVO PDA directly (via
System Program transfer to the PDA address), those lamports are "trapped" —
they increase the PDA's balance but `locked_lamports` isn't updated. On
shatter, the owner receives `all_lamports - fee`, so the surplus is recovered.
This is safe: the surplus goes to the owner, not to an attacker.

---

## 3. Is every PDA derivation collision-resistant?

**Yes.** The three PDA seeds:

| PDA | Seeds | Collision risk |
|---|---|---|
| Protocol | `["protocol"]` | Single instance. Fixed seed, fixed program. No collision possible. |
| Collection | `["collection", name.as_bytes()]` | Name is a String (max 32 bytes). Two collections with the same name derive the same PDA → `init` fails with `AccountAlreadyInitialized`. Anchor's `init` constraint prevents overwriting. |
| EVO | `["evo", collection_pda.as_ref(), evo_id.to_le_bytes()]` | `evo_id` is a `u32` (4 bytes LE). The `collection_pda` is itself a PDA (32 bytes). The full seed is `["evo", 32_bytes, 4_bytes]` — 37 bytes of entropy plus the prefix. Collision requires the same collection PDA AND the same `evo_id`, which is exactly the intended uniqueness condition. |

**Cross-collection collision**: An EVO PDA for collection A with ID 0 and an
EVO PDA for collection B with ID 0 will have different seeds because
`collection_pda` differs. No collision.

**Same-collection same-ID**: `init` constraint prevents double-forge. The PDA
already exists → `AccountAlreadyInitialized` error.

**Seed prefix collisions**: `"evo"`, `"collection"`, and `"protocol"` are
distinct byte arrays. No prefix overlap.

---

## 4. Can collection rules be bypassed through CPI?

**No.** The EVO program does not expose any CPI entry points. It only calls
**outward** to the System Program (for transfers). No other program can call
**into** EVO in a way that bypasses Anchor's account validation.

**Why this matters**:

- Anchor's `#[derive(Accounts)]` constraints run on **every** instruction call,
  whether direct or via CPI. There's no "privileged" path.
- The program has no `invoked_program` or `cpi_caller` checks because it
  doesn't need them — it never accepts CPI from arbitrary programs.
- If a malicious program tries to forge an EVO via CPI, it must provide the
  same accounts and signers as a direct call. The `owner: Signer` constraint
  in forge means the forge caller must sign — CPI can't forge this signature
  unless the owner explicitly signs the transaction.

**One subtle point**: `transfer` accepts a `new_owner: Pubkey` that isn't an
account in the struct — it's just a function argument. This is fine because no
account validation is needed for the new owner (they don't need to sign, and
they receive no SOL). The transfer only changes the `evo.owner` field.

---

## 5. What are the economic attack vectors?

### 5a. Royalty bypass via off-platform transfer → **Mitigated**
Before the fix, a seller could transfer an EVO for free (off-platform deal)
instead of using `buy`, bypassing the trade royalty. The flat 0.009 SOL
transfer fee makes every transfer non-free. While this doesn't fully prevent
off-platform deals, it creates a fixed cost that makes micro-value bypass
uneconomical.

### 5b. Shatter griefing → **Not possible**
Only the EVO owner can shatter. An attacker cannot shatter someone else's EVO.

### 5c. Feed inflation attack → **Limited**
An owner can feed their own EVO to increase `locked_lamports` (and thus the
floor). This is by design — it's the "evolve" mechanic. The cost is 1:1 (you
feed 1 SOL, locked increases by 1 SOL). No inflation or value extraction.

### 5d. Supply cap manipulation → **Not possible**
`supply_cap` is set at collection creation and is immutable. `current_supply`
is incremented in forge and decremented in shatter. The `require!` check
prevents over-minting.

### 5e. Free-riding on evolution → **By design**
Evolve is permissionless. Anyone can trigger evolution for any EVO that meets
thresholds. This is intentional — it means the owner doesn't need to be online.
The caller gains nothing (no reward for calling evolve).

### 5f. Reveal entropy manipulation → **Mitigated (commit-reveal)**
For CommitReveal collections, the creator must commit `keccak256(secret)`
**before** any minting. The secret is revealed after minting. The program
verifies `keccak256(secret) == reveal_commitment`. The creator cannot change
the secret after seeing who minted which index.

**Remaining concern**: For plain Reveal collections (no commit), the reveal
authority can choose the entropy freely. This is documented — creators who
want provably-fair reveal should use CommitReveal or RevealAndEvolve.

### 5g. Dust lock attack → **Not exploitable**
An attacker could forge an EVO with `lock_amount = 1 lamport` (if the
collection allows it). But `lock_amount_lamports` is set by the **collection
creator**, not the forger. The forger pays whatever the creator configured.
Minimum is `require!(lock_amount_lamports > 0)`.

---

## 6. Can manifests create inconsistent protocol state?

**The protocol stores `artwork_manifest_hash` on the collection and
`manifest_verified` on each EVO.** These are metadata fields — they do not
affect protocol logic (no instruction branches on `manifest_verified`).

**Consistency guarantee**: `verify_merkle_proof` is permissionless. Anyone can
verify an EVO's metadata against the collection's `manifest_root`. If the
proof is valid, `manifest_verified = true`. This is a one-way flag — once
verified, it stays verified.

**No inconsistency path**: The manifest hash is set at collection creation and
is immutable (no update instruction touches it). The `manifest_root` (Merkle
root) is also immutable. An EVO's `manifest_verified` can only go from `false`
to `true`, never back. There's no way to create a state where the manifest
hash doesn't match the actual manifest — the verifier checks the proof against
the on-chain root.

**Marketplace integration**: Marketplaces should check `manifest_verified`
before displaying art. If it's `false`, the art hasn't been verified against
the on-chain root. This is a soft check (off-chain), not a protocol enforcement.

---

## 7. Are lifecycle transitions formally enforced?

**Yes.** Each lifecycle type has explicit enforcement:

| Lifecycle | Transitions | Enforcement |
|---|---|---|
| **Static** | None | `require!(lifecycle_type != Static)` in evolve and reveal_collection |
| **Reveal** | Unrevealed → Revealed | `reveal_collection` sets `is_revealed = true`. Double-reveal rejected. |
| **CommitReveal** | Uncommitted → Committed → Revealed | `commit_reveal` sets commitment. `reveal_collection` verifies hash. Both are one-way. |
| **RevealAndEvolve** | Unrevealed → Revealed → Stage 0 → 1 → ... → max-1 | Reveal required before evolve. `evolve` checks `is_revealed` + all thresholds. `current_state < max_states - 1` guard. |
| **Custom** | Stage 0 → any valid stage | `set_visual_stage` (authority-only, no threshold checks). Also supports `evolve` with thresholds. |

**Transition rules that cannot be violated:**

1. **No skipping stages** (except Custom's `set_visual_stage`): evolve advances
   by exactly 1. `current_state + 1`.
2. **No going backwards**: there's no "devolve" instruction. `current_state`
   only increases.
3. **No exceeding max**: `require!(evo.current_state < max_states - 1)`.
4. **Reveal is permanent**: `is_revealed` can only go false → true. No "un-reveal."
5. **Commitment is permanent**: `reveal_commitment` is set once. No overwrite.
6. **Shattered is permanent**: `is_shattered` can only go false → true. All
   mutating instructions check `!evo.is_shattered`.

**One gap**: The `transition_policy_hash` field on CollectionConfig is stored
but not enforced on-chain. It's a reference hash for off-chain transition
policy documents. This is documented — the actual transition logic is enforced
by the `evolve` instruction's threshold checks.

---

## 8. Can marketplaces safely integrate without introducing edge cases?

**Yes, with the following integration guide:**

### Safe patterns:
1. **List → Buy flow**: Marketplace calls `list` (seller signs) then `buy`
   (buyer signs). The program handles royalty splitting. No edge cases.
2. **Read-only queries**: Marketplaces can safely read `evo.owner`,
   `evo.is_listed`, `evo.list_price_lamports`, `evo.current_state`,
   `evo.is_shattered`, `evo.locked_lamports` to display floor price and status.
3. **Shatter**: Marketplace can offer a "shatter" button. The owner signs,
   receives locked SOL minus fee. Clean exit.

### Edge cases to handle:
1. **Listed but transferred**: If an EVO is listed and then transferred (via
   `transfer`), the listing is cleared (`is_listed = false`,
   `list_price_lamports = 0`). The marketplace should refresh state after any
   transaction, not cache listing data.
2. **Shattered EVOs**: A shattered EVO has `is_shattered = true` and its PDA
   is closed. The account won't exist. Marketplaces should handle
   "account not found" gracefully (display "Shattered" state).
3. **Self-trade prevention**: `buy` rejects `buyer == seller`. Marketplace UI
   should prevent the seller from buying their own listing.
4. **Transfer fee**: Off-platform transfers cost 0.009 SOL. Marketplaces
   should inform users about this fee if they offer a "transfer" button
   separate from "sell."
5. **Evolution during listing**: An EVO can evolve while listed (evolve is
   permissionless and doesn't check `is_listed`). The marketplace should
   re-read `current_state` after each transaction, as the visual may have
   changed.
6. **Manifest verification**: Marketplaces should check `manifest_verified`
   before displaying art. Unverified EVOs may have tampered metadata.

### Unsafe patterns to avoid:
- **Do not** cache EVO state between transactions. Always re-fetch.
- **Do not** assume `is_listed` persists across blocks.
- **Do not** allow buying without checking `evo.owner == seller` (the program
  enforces this, but the UI should too, to avoid wasted transactions).
- **Do not** display `locked_lamports` as "withdrawable" — it's only
  withdrawable via shatter (which destroys the EVO).

---

## Summary

| Question | Answer | Residual risk |
|---|---|---|
| Invariant violations via ordering | No | None — Anchor constraints are per-instruction |
| Locked SOL unaccounted | No | None — reserve invariant enforced after forge/feed, before shatter |
| PDA collision resistance | Yes | None — seeds include collection PDA + u32 ID |
| CPI bypass | No | None — no CPI entry points, all paths go through Anchor validation |
| Economic attacks | Mitigated | Plain Reveal (no commit) allows authority to choose entropy — documented |
| Manifest inconsistency | No | None — hash is immutable, verification is one-way |
| Lifecycle enforcement | Yes | `transition_policy_hash` is stored but not enforced on-chain (off-chain reference) |
| Marketplace integration | Yes | Must handle: stale listings, closed accounts, evolution during listing |