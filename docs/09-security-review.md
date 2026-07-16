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
- [ ] Upgrade authority locked (post-audit)
- [ ] SDK published
- [ ] Security audit (professional, pre-scale)

---

*Part of the [EVO documentation](../README.md)*
