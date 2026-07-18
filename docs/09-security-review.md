# 09 — Security Review

## Program Security Model

### The Core Guarantee

> The holder can always shatter their EVO and receive `min(actual_balance, locked_lamports) - shatter_fee` in SOL. No upgrade, no authority, no governance can prevent this.

### What's Solid

| Design Decision | Why It's Good |
|---|---|
| PDA-based ownership (no SPL token) | No token account confusion, no transfer-by-mistake |
| `owner == signer` on all mutations | Nobody can touch your EVO without your signature |
| Shatter closes the PDA | SOL goes to owner, account ceases to exist |
| Supply cap enforced in code | Cannot mint beyond collection cap |
| Fees locked at collection creation | Creators cannot change fees after first forge |
| Actual balance is source of truth | If stored field and actual diverge, lesser is redeemed |

### Known Issues to Address

#### 1. Seed Uniqueness Not Enforced
**Risk:** Two EVOs in the same collection could have the same resonance_seed.
**Fix:** Add `require!(!evo_exists_with_seed, DuplicateSeed)` in forge.
**Status:** Should fix before public launch.

#### 2. No Minimum Feed Amount
**Risk:** Someone could feed 1 lamport repeatedly to spam.
**Fix:** Add `require!(amount >= MIN_FEED_LAMPORTS, FeedTooSmall)`.
**Status:** Should fix. Easy.

#### 3. Fracture Lines Capped at 20
**Risk:** Trade 21+ → no more fracture lines recorded. History truncated.
**Fix:** Move to separate history PDA (unbounded append-only).
**Status:** Future redesign. Not blocking for MVP.

#### 4. Listing State in Base Account
**Risk:** Couples EVO to our marketplace model. Not marketplace-neutral.
**Fix:** Move to separate listing PDA `["listing", evo_pda]`.
**Status:** Future redesign. Not blocking for MVP.

#### 5. Upgrade Authority Not Locked
**Risk:** Protocol authority could upgrade the program to change redemption rules.
**Fix:** Lock redemption kernel as immutable after audit. Split behavior layer.
**Status:** Critical for trust. Do after audit, before scaling.

#### 6. No Account Version Field
**Risk:** Cannot migrate account structure in the future.
**Fix:** Add `version: u16` field to EVOAccount.
**Status:** Future redesign. Add in next program upgrade.

#### 7. Commit-Reveal Entropy Selected by Creator
**Risk:** For `CommitReveal` lifecycle, the creator commits `keccak256(secret)` before minting and reveals the secret after. While they cannot change the secret after committing, a sophisticated creator could pre-compute many secrets and pick a favorable one before committing.
**Fix:** Mix creator commitment with Switchboard/ORAO VRF randomness: `final_seed = hash(creator_secret + VRF_randomness)`. This closes the gap entirely — neither the creator nor any single party controls the entropy.
**Status:** V2 enhancement. Current commit-reveal is a significant improvement over arbitrary entropy selection. Full VRF closes the remaining gap.

#### 8. Burn Destination Defaults to Incinerator
**Risk:** In production, burn fees go to the Solana Incinerator (`1nc1nerator11111111111111111111111111111111`). This is correct for production, but makes it hard to verify in tests that the burn fee actually arrived.
**Fix:** Burn destination is configurable at collection creation. In tests, a fake burn wallet is used so the test can verify the exact burn fee amount arrives. In production, defaults to the real incinerator.
**Status:** Done — configurable burn destination implemented and tested.

#### 9. Transfer Bypasses Royalties (FIXED)
**Risk:** Direct transfers (off-platform deals) let owners move EVOs without paying any fee, bypassing marketplace royalties entirely. Since EVOs use PDA-ownership (no SPL token), transfers were free — a seller could arrange an off-platform sale and transfer the EVO for nothing.
**Fix:** A flat `TRANSFER_FEE_LAMPORTS` (0.009 SOL) is now charged on every transfer, routed to the protocol treasury via System Program CPI. This makes every ownership change non-free regardless of sale price, closing the royalty-bypass vector. The fee is decoupled from the EVO's value, so it's a small fixed cost rather than a percentage.
**Status:** Done — flat transfer fee implemented and tested.

#### 10. Initialize Protocol Front-Run (FIXED)
**Risk:** `initialize_protocol` had no authority check — anyone could front-run the deployer's first initialize call and set their own treasury permanently. Since there's no update instruction for treasury, this would redirect ALL protocol fees to the attacker.
**Fix:** Added `REQUIRED_DEPLOYER` constant and `constraint = REQUIRED_DEPLOYER == Pubkey::default() || payer.key() == REQUIRED_DEPLOYER` to the `InitializeProtocol` struct. Defaults to `Pubkey::default()` (skip for testing); must be set to the real deployer pubkey before mainnet deployment.
**Status:** Done — deployer authority check implemented.

#### 11. Burn Destination Set to Program PDA (FIXED)
**Risk:** A collection creator could set `burn_destination` to the collection PDA itself. When users shatter, "burn" fees would accumulate in the collection PDA. Later, `close_collection` drains ALL lamports from the collection PDA to the creator — effectively recovering "burned" fees.
**Fix:** Three-layer defense: (1) `create_collection` rejects `burn_destination` equal to the collection or protocol PDA, (2) `shatter.rs` runtime check that incinerator account is not owned by the EVO program, (3) `route_fee` in `utils.rs` same runtime check for the buy path.
**Status:** Done — burn destination PDA check implemented.

#### 12. Listed EVO Transfer Bypass (FIXED)
**Risk:** `transfer.rs` had no `!evo.is_listed` constraint. A listed EVO could be transferred while listed, bypassing marketplace royalty. The flat 0.009 SOL transfer fee mitigated but didn't prevent the bypass — the buyer could get the EVO without paying the list price.
**Fix:** Added `constraint = !evo.is_listed @ EvoError::EvoIsListedForTransfer` to the `Transfer` struct. Listed EVOs must be delisted before transfer.
**Status:** Done — listed EVO transfer rejection implemented and tested.

#### 13. close_collection Panic on Malformed Data (FIXED)
**Risk:** `close_collection.rs` used `.unwrap()` on manual data parsing (`try_into()` calls). While not exploitable (data format is guaranteed by `create_collection`), it's bad practice — a panic on malformed data could theoretically be triggered by account confusion.
**Fix:** Replaced all `.unwrap()` calls with `.map_err(|_| error!(EvoError::CollectionMismatch))?` for graceful error handling.
**Status:** Done — panic-free data parsing.

#### 14. buy.rs Seller Type Restriction (FIXED)
**Risk:** `buy.rs` used `seller: SystemAccount<'info>` which requires the seller's account to be owned by the System Program. If an EVO was transferred to a PDA owner (via `transfer.rs` which accepts any `Pubkey` as `new_owner`), it could never be sold on the marketplace — the `SystemAccount` check would fail.
**Fix:** Changed `seller` from `SystemAccount` to `UncheckedAccount` with `address = evo.owner` constraint. The address check still enforces that the seller matches the EVO owner, but no longer requires system ownership.
**Status:** Done — seller type relaxed to UncheckedAccount.

---

## Upgrade Policy

| Layer | Upgradable? | When |
|-------|------------|------|
| Redemption (forge/shatter/transfer) | NO (immutable after audit) | Lock post-audit |
| Value (feed) | Yes (governed) | Multisig + timelock |
| Market (list/buy) | Yes (governed) | Multisig + timelock |
| Collection config | Yes (governed) | Multisig + timelock |

**Users locking 100 SOL need to know:** redemption is immutable. Behaviors may upgrade but cannot affect shatter.

---

## Economic Security

### Floor Integrity
```
redeemable = min(account.lamports() - rent_exempt, locked_lamports) - shatter_fee
```

- If someone sends extra SOL to the PDA → they lose it (only locked_lamports tracked)
- If a bug reduces the balance → only what's actually there is redeemable
- The stored field is a *record*, not a *guarantee*
- The real lamports in the account are the guarantee

### Fee Integrity
- All fees set at collection creation — **immutable**
- Fee destinations locked — Treasury/Creator/Burn/Split
- Cannot be changed after first EVO is forged
- Creator cannot rug fees or redirect after value is locked

### Supply Integrity
- Supply cap enforced in `create_collection`
- `current_supply` increments on forge, checked against `supply_cap`
- Shatter decrements effective supply (EVO destroyed)
- Cannot mint beyond cap

---

## Attack Vectors

### Front-Running
**Risk:** Someone sees a forge tx in mempool and front-runs it.
**Impact:** Low — EVO IDs are sequential, front-running just takes a different ID.
**Mitigation:** Not critical for MVP.

### Re-Entrancy via Buy
**Risk:** Seller's account is a program that triggers re-entrant call.
**Mitigation:** Anchor's CPI to system program for transfers is safe. Solana's runtime prevents re-entrancy by default.
**Status:** Low risk.

### Fake EVOs
**Risk:** Someone deploys a program and calls its accounts "EVOs."
**Mitigation:**
1. Account discriminator verifies EVO version
2. `account.owner == EVO_PROGRAM_ID` check
3. Collection PDA references verified creator
4. Any program can verify via standard parsing

**Status:** Mitigated by design. Document verification in SDK.

---

## Pre-Mainnet Checklist

- [x] Program deployed and tested on mainnet
- [x] Protocol initialized
- [ ] Seed uniqueness check in forge
- [ ] Minimum feed amount
- [ ] First collection created
- [ ] Full cycle tested (forge → trade → shatter)
- [ ] Visual lifecycle tested on localnet (reveal, evolve, set_visual_stage)
- [x] Devnet testing — full transaction suite with real RPC
- [ ] Upgrade authority locked (post-audit)
- [ ] SDK published
- [x] Security audit (line-by-line manual + agent review, 6 findings fixed)
- [ ] VRF integration for commit-reveal (Switchboard/ORAO)
- [x] Deployer authority check on initialize_protocol
- [x] Burn destination PDA validation
- [x] Listed EVO transfer rejection
- [x] Panic-free close_collection data parsing
- [x] buy.rs seller type fix (UncheckedAccount)

---

*Part of the [EVO documentation](../README.md)*
