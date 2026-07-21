# Security Policy & Status

> **Read this before locking meaningful SOL in an EVO.** This document is
> deliberately blunt. EVO is a live, open-source protocol that holds real user
> SOL and has **not** had an independent professional audit. Honesty about that
> is the point.

---

## 1. Current status (be honest with holders)

| Item | Status |
|---|---|
| Network | Mainnet-beta — **live**, deployed + initialized |
| Program ID | `Aw4mAC5oUfQCP65a8a6mTwkrL2CoUMsBa45KvWPY3CN2` |
| Upgradeable? | **Yes** — the program can be changed by the upgrade authority |
| Upgrade authority | `G3aWJsdtrRT12HnC9R2BVoyErQbtGXseaM9c2xt1MJUJ` (multisig; signers currently held by the team during active development) |
| Treasury authority | `G3aWJsdtrRT12HnC9R2BVoyErQbtGXseaM9c2xt1MJUJ` |
| Treasury (fee sink) | `8McmuNBz7NHToGG2pBcJEuUpcof5T8HJ7DPG2A1xfkQc` |
| Independent professional audit | **No** — automated / AI-assisted reviews only |

### What this means for you as a holder

1. **The upgrade authority can change program behavior**, including code paths
   that touch the SOL locked inside EVO accounts. Until the authority is either
   (a) held by a multisig with **independent** signers behind a timelock, or
   (b) revoked entirely, you are trusting that key not to act maliciously. This
   is a centralization risk, disclosed openly rather than hidden.
2. **The code has not been professionally audited.** Open source is necessary
   but not sufficient — "many eyes" only helps if many eyes actually look, and
   at this stage they have not. Do not assume it is safe because it is public.
3. **Keep stakes proportional to that risk.** Until the Tier-0 items below are
   complete, treat EVO as experimental and do not lock SOL you cannot afford to
   lose.

---

## 2. What review *has* happened

Being transparent about the ceiling of current assurance:

- Two internal code reviews (AI / `code-review` agents): 5 critical + 6 high
  findings fixed (commit `c233e55`), then a second pass (1 medium, since fixed).
- A devnet end-to-end proof run (create → forge → reveal → feed → evolve →
  list → buy → shatter → manifest-hash tamper detection).
- Reproducible-build check comparing the deployed bytecode to source.
- In-code defensive engineering: reserve invariant on every mutation,
  re-entrancy ordering in `shatter`, checked math throughout, slippage cap on
  `buy`, self-trade guard, treasury/authority separation, burn-destination
  hardening with a canonical-incinerator fallback.

None of the above is a substitute for an independent audit.

---

## 3. The $0 hardening plan

We are capital-constrained and cannot yet fund a professional audit. This is the
free, high-leverage path to audit-grade assurance. Contributions welcome.

### Tier 0 — trust & keys (highest priority)
- [ ] Move the upgrade authority to a multisig with **independent** signers
      (e.g. Squads), and **publish the signer set**.
- [ ] Publish an upgrade **timelock** policy (announce upgrades N hours ahead).
- [ ] Add an on-chain **pause** flag (treasury-authority gated) that can freeze
      `create_collection` / `forge` / `list` / `buy` **but can never block
      `shatter`, `transfer`, `delist`, or `feed`** — so no authority can ever
      trap a holder's floor. Exits must always remain open.
- [ ] After a real audit: **revoke** the upgrade authority (immutability = the
      strongest "can't rug" proof).

### Tier 1 — free assurance you can run this weekend
- [ ] **Fuzz with [Trident](https://github.com/Ackee-Blockchain/trident)**
      (Ackee's Solana/Anchor fuzzer) — the single highest-leverage free tool.
- [ ] Encode the **invariants** below as property tests.
- [ ] Publish a **`solana-verify` reproducible build** hash so anyone can
      confirm the deployed bytecode matches this source.
- [ ] Run free scanners (Sec3 X-Ray free tier, `cargo audit` for deps).

### Tier 2 — funding paths (so a real audit becomes possible)
- [ ] Apply for a **Solana Foundation** grant (open-source public-good infra).
- [ ] **Superteam** bounties/grants; **Colosseum** hackathon (winners sometimes
      get audit credits).
- [ ] Informal, credit/allocation-based bug bounty (see §5).

---

## 4. Invariants that must always hold (test targets)

These are the properties a fuzzer/test suite should try to violate. If any can
be broken, it is a bug — report it (§5).

1. **Reserve invariant:** for every non-shattered EVO,
   `account.lamports >= rent(account_size) + locked_lamports`.
2. **forge conservation:** exactly `lock_amount` enters the EVO PDA and exactly
   `mint_price` reaches the creator — no other lamport path.
3. **feed conservation:** `locked_lamports` and `total_fed_lamports` each rise
   by exactly `additional_lamports`; reserve invariant still holds.
4. **buy conservation:** buyer pays `price`; seller receives `price - royalty`;
   royalty routed to the configured destination; owner flips; `trade_count + 1`;
   `price <= max_price` (slippage); `buyer != seller`.
5. **shatter conservation:** owner receives exactly `locked - fee`; fee lands at
   the configured destination (or the canonical incinerator fallback); account
   closes; `current_supply - 1`; burned SOL is never recoverable via
   `close_collection`.
6. **No non-shatter path** may drop an EVO's balance below its floor.
7. **Access control:** every mutating instruction rejects the wrong signer
   (owner-only: feed/list/delist/transfer/shatter; creator-only: commit_reveal/
   update_metadata/close_collection; authority-only: reveal/set_visual_stage/
   update_treasury/update_creation_fee).
8. **Monotonicity:** `total_minted` never decreases; a mint-and-shatter cycle
   cannot reset the commit-reveal "before minting" guard.

---

## 5. Reporting a vulnerability

**Do not open a public issue for a fund-affecting bug.** Report privately:

- Contact: **naps** — [@naps000](https://x.com/naps000) (X DM) — or open a
  GitHub **security advisory** on `stephenclawdbot-png/EVO`.
- Include: affected instruction/file, a concrete exploit path, and (ideally) a
  failing test or transaction demonstrating it.

**Informal bounty:** we cannot yet fund a cash pool. For a genuine
fund-draining finding in `forge` / `feed` / `buy` / `shatter` / the direct
lamport-manipulation helpers in `utils.rs`, we offer public credit and a
good-faith reward (treasury share / future allocation) negotiated case by case.
Highest-value review surface: `shatter.rs`, `buy.rs`, and `utils.rs`
(`transfer_lamports`, `close_account_raw`, `route_fee`).

---

## 6. Scope

**In scope:** the on-chain program (`programs/evo/`), the SDK
(`packages/evo-sdk/`), and the terminal's transaction-building / on-chain
reading paths (`frontend/src/lib/evo-program.ts`, `evo-visuals.ts`).

**Out of scope:** third-party gateways (Irys/Arweave/IPFS availability),
creator-supplied artwork/IP legitimacy (the chain proves *who committed which
files*, not *who owns the copyright*), and price/market risk (the floor caps
downside at your own deposit minus fees; it is not a guarantee of profit).

---

*This document reflects the protocol's real state. If any statement here drifts
from the deployed reality, the document is the bug — fix it.*
