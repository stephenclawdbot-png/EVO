# EVO Protocol Whitepaper

> Evolving Value Object: a Solana-native asset primitive with guaranteed floors, progressive value, and visual evolution.

Version 1.0
Authors: naps (@naps000), admiralfinest (@admiralfinest), Benedict A.

---

## 1. Introduction

Solana has NFTs and tokens. NFTs are unique but have no intrinsic value. Tokens have value but are fungible. Nothing on Solana combines uniqueness with a guaranteed monetary floor.

EVO is a new primitive. An EVO (Evolving Value Object) is a program-derived address on Solana that holds locked SOL. The SOL is the floor. The PDA is the asset. The owner can add more SOL, trade on the built-in marketplace, evolve through visual stages, or destroy the asset to reclaim the SOL.

The floor is not a social convention. It is not a number on a dashboard. It is actual lamports in an actual account, enforced by the program. The owner can shatter the EVO at any time and receive the locked SOL minus a fee. No authority, no governance, no upgrade can prevent this.

This is stateful capital. SOL that remembers what it is.

---

## 2. Motivation

The NFT market has a structural flaw: assets have no floor. When sentiment flips, assets go to zero. There is no redemption mechanism. Holders are trapped. Creators cannot offer downside protection. The entire market is pure speculation.

Previous attempts to create floors are social, not technical:
- **Community floors:** "We all agree not to sell below X." Breaks when one person sells below X.
- **Staking lockups:** "Lock your NFT for 30 days to earn tokens." Does not create a floor, creates a lockup.
- **Buyback programs:** "The treasury will buy back at X." Requires treasury funding and trust in the team.
- **Bonding curves:** "The price mathematically cannot go below X." Only works for fungible tokens, not unique assets.

EVO creates a floor at the protocol level. The floor is real SOL in a real account. It cannot be removed by anyone except the owner (via shatter). It does not depend on community consensus, treasury funding, or trust in a team.

---

## 3. The EVO Primitive

### 3.1 Definition

An EVO is a Solana PDA account with the following properties:

- **Owner:** a Solana wallet (the current holder)
- **Locked SOL:** a quantity of lamports held inside the PDA
- **Floor:** the locked SOL minus the shatter fee (the guaranteed redemption value)
- **Visual state:** an integer representing the current visual stage
- **Trade history:** a list of previous owners and trade events (fracture lines)
- **Resonance seed:** a 32-byte value set at forge time (drives generative art)
- **Forged at:** the timestamp of creation

### 3.2 Operations

| Operation | Effect |
|---|---|
| Forge | Create a new EVO by paying mint price (to creator) and lock amount (into PDA) |
| Feed | Add SOL to an existing EVO, raising its floor |
| List | Mark an EVO for sale at a chosen price |
| Delist | Remove a listing |
| Buy | Purchase a listed EVO, pay seller minus royalty |
| Transfer | Send an EVO to another wallet (no payment) |
| Shatter | Destroy the EVO, reclaim locked SOL minus fee |
| Evolve | Advance the visual stage (lifecycle-dependent) |
| Reveal | Reveal a hidden EVO (for Reveal-type collections) |

All operations are program instructions. All value transfers are program-enforced. No external marketplace, no escrow, no off-chain enforcement.

### 3.3 The Floor

```
floor = locked_lamports * (1 - shatter_fee_bps / 10000)
```

The floor is the minimum value of an EVO. If the market price drops below the floor, the owner shatters and reclaims the SOL. No rational seller accepts below floor because they would shatter instead.

The actual account balance is the source of truth:
```
redeemable = min(account.lamports - rent_exempt, locked_lamports) * (1 - shatter_fee)
```

If someone sends extra SOL to the PDA (not via feed), it is ignored. Only locked_lamports (tracked by the program) is redeemable. If a bug reduced the balance, only what is actually there is redeemable. The program is defensive.

### 3.4 The Premium

```
market_price = floor + premium
```

The premium is set by the market. It is a function of scarcity, provenance, age, creator reputation, and community desire. The protocol does not model the premium. The market does.

EVOs that have been traded many times have provenance (fracture lines visible on the art). EVOs from known creators have reputation. Old EVOs have age (time cannot be faked). EVOs in low-supply collections have scarcity. Each of these can drive the premium above floor.

---

## 4. Collections

A collection is a group of EVOs with shared parameters. Anyone can create a collection by paying a protocol fee (0.06789 SOL). The collection creator sets:

- **Supply cap:** 1 to 20,000 (immutable after first forge)
- **Mint price:** paid to creator per forge (immutable)
- **Lock amount:** SOL locked inside each EVO (immutable)
- **Royalty:** 0 to 25% of each trade (immutable)
- **Shatter fee:** 0 to 20% of locked SOL on shatter (immutable)
- **Lifecycle type:** Static, Reveal, CommitReveal, RevealAndEvolve, Custom (immutable)
- **Randomness policy:** None, Predetermined, BatchReveal (immutable)

All parameters are immutable after the first EVO is forged. The creator cannot change the rules after collectors have committed. This is a trust property.

---

## 5. Lifecycle System

EVOs can change visually over time. The lifecycle type controls how.

### 5.1 Types

| Type | Behavior |
|---|---|
| Static | No visual changes. The EVO looks the same forever. |
| Reveal | Hidden at mint (stage 0). Creator reveals to stage 1. |
| CommitReveal | Same as Reveal but with a committed hash for provable fairness. |
| RevealAndEvolve | Reveal then continue evolving through multiple stages. |
| Custom | Authority manually sets visual stages. |

### 5.2 Commit-Reveal

For CommitReveal collections, the creator commits `keccak256(secret)` before minting starts. After minting, the creator reveals the secret. The program verifies `keccak256(submitted_secret) == committed_hash`.

This prevents the creator from seeing mints and then choosing a favorable secret. The commitment is on-chain before any mint. The secret must match. This is provably fair.

### 5.3 Evolution

For RevealAndEvolve collections, the owner can call `evolve()` when conditions are met. Conditions can include: trade count, feed amount, hold time, locked value. The evolution advances `current_state` by 1. The maximum state is set at collection creation. Once at max, no further evolution.

---

## 6. Visual System

EVO uses a hybrid art model. The on-chain protocol state (current_state, is_revealed) is the source of truth for the visual stage. The collection's metadata_uri (which can use http://, https://, ipfs://, or arweave:// schemes) points to a visual manifest JSON that maps stages to actual images.

### Two Art Modes

1. **Bulk upload (Arweave via Irys):** Creators upload per-EVO images directly through the MELD terminal. Images are stored permanently on Arweave via Irys. The manifest auto-generates with per-EVO image templates using {id} and {stage} URL patterns.

2. **Generative / external URI:** Creators point to an existing metadata manifest URI. No upload needed. For creators who already host their art on IPFS, Arweave, or their own servers.

### Manifest Schema (evo-visual-manifest-v1)

The manifest supports:
- **Per-stage images:** one image per stage, shared by all EVOs
- **Per-EVO image templates:** URL pattern with {id} (mint index) and {stage} (lifecycle stage)
  - e.g. `arweave.net/{id}.png` for per-EVO static art
  - e.g. `arweave.net/{id}/stage{stage}.png` for per-EVO multi-stage art
- **Provenance verification:** per-EVO SHA-256 image hashes or a Merkle root of all hashes
- **Fallback image:** shown if the stage image fails to load

### On-Chain Parameters

| Parameter | Source | Visual Effect |
|---|---|---|
| locked_lamports | SOL inside | Drives generative art size |
| forged_at | Timestamp | Age, intricacy |
| trade_count | Trade history | Fracture lines |
| resonance_seed | Set at forge | Color palette, shape |
| current_state | Lifecycle stage | Maps to stage image in manifest |
| is_revealed | Reveal status | Hidden vs revealed stage |
| is_listed | Listing status | Glow (listed EVOs pulse) |

The art system is hybrid: on-chain state drives the stage, the manifest (stored on IPFS or Arweave) maps stages to images, and the client renders real-time effects (pulse, shimmer, glow).

---

## 7. Fee Model

| Fee | Who Sets | Range | Destination |
|---|---|---|---|
| Collection creation | Protocol (fixed) | 0.06789 SOL | Protocol treasury |
| Mint price | Creator | 0 to unlimited | Creator wallet |
| Royalty | Creator | 0 to 25% | Creator-chosen |
| Shatter fee | Creator | 0 to 20% | Creator-chosen |

Shatter fee destinations: Treasury, Creator, Burn (incinerator), or Split. All set at collection creation and immutable after first forge.

---

## 8. Security

### 8.1 Invariants

1. **Reserve:** `account.lamports >= rent_exempt + locked_lamports` at all times
2. **Supply:** `current_supply <= supply_cap` always
3. **Immutability:** Collection params unchanged after first forge
4. **Ownership:** Only forge, buy, and transfer change owner
5. **Listed:** Listed EVOs cannot be transferred
6. **Commit-Reveal:** Reveal secret must match committed hash
7. **Self-Trade:** Buyer cannot be seller

### 8.2 Implementation Notes

Shatter uses direct lamport manipulation (not System Program CPI) because the PDA is program-owned. This is the correct Solana pattern and was verified in security review.

The reserve invariant is enforced on every state-changing instruction. Checked math throughout (MathOverflow error on overflow).

### 8.3 Audit Status

Two independent reviews completed. 5 CRITICAL, 6 HIGH, 1 MEDIUM findings identified and fixed. 57 tests (41 happy path, 16 adversarial). Localnet: 17 consecutive green runs. Devnet: 64/64 passing. Build verification byte-for-byte reproducible.

### 8.4 Upgrade Authority

Currently retained. The plan is to renounce after a formal third-party audit by a Solana security firm. Until then, the authority exists but is not used. No upgrades have been performed.

---

## 9. Architecture

```
EVO Program (Solana BPF)
  |
  +-- Protocol (singleton)
  |     - treasury, authority, collection_count
  |
  +-- CollectionConfig (PDA per collection)
  |     - supply_cap, mint_price, lock_amount
  |     - royalty_bps, shatter_fee_bps
  |     - lifecycle_type, randomness_policy
  |     - artwork_manifest_hash
  |
  +-- EVOAccount (PDA per asset)
        - owner, locked_lamports
        - current_state, is_listed, asking_price
        - trade_count, forged_at, resonance_seed
        - fracture_lines, manifest_verified
```

All value flows through the program. No CPI to external programs for core operations. Composable reads (any program can read EVO state), isolated writes (only the EVO program can modify EVO state).

---

## 10. Comparison

| Feature | NFT (Metaplex) | Token (SPL) | EVO |
|---|---|---|---|
| Unique identity | Yes | No | Yes |
| Guaranteed floor | No | No | Yes |
| Progressive value | No | No | Yes (feed) |
| Redemption | No | No | Yes (shatter) |
| Visual evolution | No | No | Yes (5 types) |
| Built-in marketplace | No | No | Yes |
| Royalty enforcement | Marketplace-dependent | N/A | Program-enforced |
| Provably fair reveal | No | N/A | Yes (commit-reveal) |
| Immutable params | No | No | Yes (after first forge) |

EVO is not a replacement for NFTs or tokens. It is a new category. Stateful capital. Assets that hold value inside themselves.

---

## 11. Roadmap

1. Initialize protocol on mainnet
2. Launch first featured collections on MELD
3. Engage formal third-party security audit
4. Renounce upgrade authority
5. Wire VRF adapter to Switchboard
6. Explore lending integration (borrow against EVO floors)
7. Explore partial redemption patterns
8. Build EVO standard alongside NFT and token standards

---

## 12. Conclusion

EVO is a new asset primitive for Solana. It combines the uniqueness of NFTs with the value guarantee of tokens, adds progressive value accumulation and visual evolution, and enforces all of it at the protocol level.

The floor is real. The marketplace is built-in. The art is on-chain. The terms are immutable. The creation is permissionless.

SOL that remembers what it is.

---

## References

- Source code: https://github.com/stephenclawdbot-png/EVO
- Documentation: https://github.com/stephenclawdbot-png/EVO/tree/main/docs
- Terminal: MELD (meldterminal.io)

---

## Authors

naps (@naps000), admiralfinest (@admiralfinest), Benedict A.