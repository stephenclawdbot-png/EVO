# 08 — Roadmap

## The Strategy

> **Ship the primitive and the art together. Value + visual expression, side by side.**

EVO is stateful capital — but it's also a collectible. Degens trade stories, and stories need expression. The art IS the story made visible. Build them together.

---

## Phase 1 — Primitive + Art + First Collection (Current)

**Goal:** Launch "speculation with a floor" with full visual expression on mainnet.

### Program (DONE — live on mainnet, NOT yet upgraded with lifecycle)
- [x] Deploy EVO program to mainnet
- [x] 15 instructions working (forge, feed, list, buy, shatter, transfer, reveal, evolve, etc.)
- [x] Mint price + lock amount economic model
- [x] Fee destinations (Treasury/Creator/Burn/Split)
- [x] Protocol-native visual lifecycle (Static, Reveal, CommitReveal, RevealAndEvolve, Custom)
- [x] Per-asset current_stage on-chain (program is source of truth)
- [x] Commit-reveal for provably fair reveal (keccak256 commitment before minting)
- [x] Configurable burn destination for test verification
- [x] Permissionless evolution with modular triggers (trade, feed, hold, locked value)
- [x] set_visual_stage instruction (Custom lifecycle authority override)
- [x] artwork_manifest_hash for manifest integrity verification
- [x] ~41 tests passing (forge, feed, transfer, buy, shatter, evolution, commit-reveal, burn, visual lifecycle)

### Security Hardening (DONE — internally hardened, pending independent audit)
- [x] Direct lamport manipulation for shatter (correct program-owned account pattern)
- [x] Reserve invariant enforced (account balance backs locked_lamports + rent)
- [x] Checked math throughout (MathOverflow error)
- [x] Evolve boundary fixed (off-by-one: current_state < max_states - 1)
- [x] 18 protocol invariants documented (value, lifecycle, authority, commit-reveal, balance consistency)
- [x] Formal proof of invariant 18 (locked_lamports vs PDA balance) in WHITEPAPER.md
- [x] Adversarial test suite (substituted accounts, wrong PDA seeds, stale listings, malformed params, boundary inputs)
- [x] Shatter-while-listed guard (`require!(!evo.is_listed)`) — marketplace semantics
- [x] Threat model document (docs/threat-model.md) — 16 threats + mitigations, 6 remaining risks

### Frontend (In Progress)
- [x] Wallet adapter (Phantom, Solflare, Backpack)
- [x] Visual lifecycle resolver (evo-visuals.ts, 25 vitest tests)
- [x] Account parsers with lifecycle fields (evo-program.ts)
- [x] Admin page with on-chain reveal/evolve/set_visual_stage buttons
- [ ] Wire frontend to real on-chain PDAs (mainnet)
- [ ] Forge page — mint an EVO with real SOL + see art
- [ ] EVO detail page — live art render, stats, floor, feed
- [ ] Marketplace page — browse, filter, buy (with art)
- [ ] Shatter interface — reclaim SOL
- [ ] Feed interface — add SOL to EVO, watch it grow

### Art System
- [ ] Define art parameter mapping (on-chain data → visual properties)
- [ ] Engage artist for visual identity
- [ ] Implement renderer (WebGL/SVG, deterministic from on-chain data)
- [ ] Upload visual manifests to Arweave (production)

### Testing & Audit
- [x] 18 consecutive green CI runs on localnet (automated via GitHub Actions)
- [x] Devnet 41/41 tests passed (real devnet cluster)
- [x] Devnet CI workflow configured (`.github/workflows/devnet-test.yml`)
- [x] Independent security audit — **deferred to post-beta** (see Beta Launch below)

### Beta Launch (Unaudited — Informed Consent)
> EVO launches as a public beta. Users interact with real SOL at their own risk.
> Upgrade authority is KEPT so bugs can be patched. Audit happens when funds allow.

- [ ] Clearly label all UI as "BETA — UNAUDITED, USE AT YOUR OWN RISK"
- [ ] Keep upgrade authority (do NOT revoke — bugs must be fixable)
- [ ] Start with conservative parameters (low mint price, low lock amounts)
- [ ] Monitor all shatter/forge/buy transactions closely
- [ ] Set up alerting for failed invariant checks
- [ ] Create first collection on mainnet
- [ ] Public mint opens (beta)
- [ ] First trades happen
- [ ] First shatter happens (proves the floor works)
- [ ] Gather feedback from early users

### Post-Beta: Audit & Full Launch
- [ ] Engage independent security firm (Sec3, Zellic, OtterSec, Neodyme)
- [ ] Fix audit findings
- [ ] Rerun localnet + devnet test suites after fixes
- [ ] Upgrade mainnet program with audited binary
- [ ] Remove "BETA" label
- [ ] Observe for several months
- [ ] Second review if necessary
- [ ] Revoke upgrade authority (much later, only when stable)

### Success Criteria
> A user can: forge an EVO with real SOL, see its art (pre-reveal → reveal → evolve), see their floor, list it for sale, sell it to someone else, and the buyer can shatter it to reclaim SOL. The full cycle works with visuals and lifecycle transitions.

---

## Phase 2 — Standard & Composability

**Goal:** Make EVO a primitive other developers can build on.

### EVO Standard Interface (ESI)
- [ ] Publish ESI spec
- [ ] Public SDK (read owner, value, floor, behavior type)
- [ ] CPI examples for other programs
- [ ] Documentation for developers

### Protocol Improvements
- [ ] Split listing state to separate PDA (marketplace-neutral)
- [ ] Split history to separate append-only PDA
- [ ] Reduce base EVO account to ~170 bytes
- [ ] Add behavior_type + behavior_params fields
- [ ] Add AuthorityState (owner + delegate minimum)

### Composability Demos
- [ ] Lending protocol integration (EVO as collateral)
- [ ] Independent marketplace integration
- [ ] One demo app built by someone else

---

## Phase 3 — Behaviors & Community

**Goal:** Let others build apps on the EVO interface.

### Behavior Apps (built by others)
- [ ] Vault — time-locked SOL (gift that unlocks on a date)
- [ ] Legacy — directed redemption (shatter routes to multiple wallets)
- [ ] Patron — creator gets a cut of feed, principal preserved
- [ ] Community-built behaviors we haven't thought of

### Ecosystem
- [ ] Multi-collection marketplace
- [ ] Collection analytics
- [ ] EVO explorer (browse all collections)
- [ ] Developer grants

### Governance
- [ ] Lock redemption kernel (immutable)
- [ ] Multisig for behavior layer upgrades
- [ ] Community proposals

---

## What We Explicitly DON'T Build Yet

| Thing | Why |
|------|-----|
| Behavior templates (Vault/Legacy/Patron) | These are apps, not protocol. Let others build them. |
| Custom DSL for behaviors | Too complex, too early. Config + templates first. |
| Cross-chain | Premature. Nail Solana first. |
| DAO governance | Earn the right to govern first. |

---

## Timeline (Estimates)

| Phase | Duration | Depends On |
|---|---|---|
| Phase 1 | 4-8 weeks | Artist engagement, frontend wiring |
| Phase 2 | 4-8 weeks | Phase 1 complete |
| Phase 3 | Ongoing | Ecosystem demand |

---

## Immediate Next Steps

1. **Engage an artist** — Define the visual identity (palettes, shapes, facet styles)
2. **Create first collection on mainnet** — test the full cycle with real SOL
3. **Wire frontend to real on-chain PDAs** — make buttons actually work
4. **Build the art renderer** — WebGL + SVG, deterministic from on-chain data
5. **Test forge → trade → shatter cycle** — prove the floor works
6. **Open public mint** — let people speculate with a floor

---

*Part of the [EVO documentation](../README.md)*
