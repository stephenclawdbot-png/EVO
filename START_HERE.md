# EVO — Session Handoff (START HERE)

**Last updated:** Session 5f076f54 — Devnet CI workflow + documentation update

## Current State

### Program
- **Program ID:** `7USTJBsRTmCnjowPgmh6s5igTZeaFPE7X43rZnhmm5sc`
- **Status:** Deployed on mainnet, NOT yet initialized
- **Upgrade authority:** KEPT (program still upgradeable during development)
- **GitHub:** https://github.com/stephenclawdbot-png/EVO

### CI Status
- **Localnet:** 11 consecutive green runs (#36-#46) — 41 tests each, all passing
- **Devnet:** Workflow configured (`.github/workflows/devnet-test.yml`), BLOCKED on SOL
  - Devnet faucet rate-limited (2 SOL / 8h / IP)
  - Solution: fund a keypair, add as `DEVNET_FUNDED_KEYPAIR` GitHub secret
  - See README Testing section for instructions

### What's Done
1. Shatter bugs fixed (direct lamport manipulation, burn to incinerator, split requires treasury)
2. Reserve invariant enforced (account balance backs locked_lamports + rent)
3. Checked math throughout (MathOverflow error)
4. Program ID synchronized (lib.rs, Anchor.toml, README all match `7UST...`)
5. Protocol-native visual lifecycle (Static, Reveal, CommitReveal, RevealAndEvolve, Custom)
6. Configurable randomness (None, Predetermined, BatchReveal)
7. Permissionless evolution with modular triggers (trade, feed, hold, locked value)
8. reveal_collection instruction (rejects Static, commit-reveal verified)
9. evolve instruction (permissionless, checks all enabled thresholds with AND logic)
10. set_visual_stage instruction (authority-only, Custom lifecycle)
11. artwork_manifest_hash on CollectionConfig (manifest integrity verification)
12. Per-asset current_state on EVOAccount (program is source of truth)
13. Commit-reveal for provably fair reveal (keccak256 commitment before minting)
14. Configurable burn destination for test verification
15. Frontend visual lifecycle resolver (evo-visuals.ts, 25 vitest tests)
16. White paper, README, wallet integration docs updated

### Build Status
- `anchor build` succeeds (CI verified)
- Frontend `tsc --noEmit` clean
- Frontend `vitest` 25/25 passing

### Instructions (15 total)
1. initialize_protocol
2. create_collection (accepts LifecycleParams with artwork_manifest_hash)
3. forge (sets mint_index, current_state, last_transition_at, feed_count, total_fed_lamports)
4. feed (increments feed_count, total_fed_lamports with checked math)
5. list / 6. delist / 7. buy / 8. shatter / 9. transfer
10. close_collection / 11. update_metadata
12. reveal_collection / 13. evolve / 14. commit_reveal
15. set_visual_stage (NEW: authority-only stage override for Custom lifecycle)

### Tests (~41 total)
- forge, feed, transfer, list, buy, shatter (happy + rejection paths)
- commit_reveal, reveal_collection, evolve (with thresholds)
- burn fee destination (configurable burn wallet)
- Reveal lifecycle, Custom + set_visual_stage, Static rejection
- 25 frontend vitest tests (visual lifecycle resolution)

### Protocol-Level Decisions
- Creation fee: 0.05 SOL (50,000,000 lamports) — runtime parameter
- Upgrade authority: keep during development, revoke after audit
- All fees enforced on-chain

## Next Steps (Priority Order)

### 1. Devnet testing — fund a keypair and add as DEVNET_FUNDED_KEYPAIR GitHub secret
   - `solana-keygen new -o ~/evo-devnet.json --force`
   - `solana airdrop 2 --url devnet -k ~/evo-devnet.json` (repeat after 8h, need ~5 SOL)
   - `base64 ~/evo-devnet.json | gh secret set DEVNET_FUNDED_KEYPAIR`
   - Push to main — workflow will deploy and test on devnet
### 2. Independent security audit
### 3. VRF integration (Switchboard/ORAO adapter)
### 4. Builder SDK (CollectionBuilder pattern)
### 5. Frontend updates (meowdot.fun, Vercel deploy)
### 6. Mainnet upgrade — only after audit passes

## Key Files
- `programs/evo/src/lib.rs` — 15 instructions, declare_id
- `programs/evo/src/state/mod.rs` — LifecycleType (Static, Reveal, CommitReveal, RevealAndEvolve, Custom), LifecycleParams
- `programs/evo/src/state/collection.rs` — CollectionConfig with lifecycle + randomness + artwork_manifest_hash
- `programs/evo/src/state/evo.rs` — EVOAccount with lifecycle state (current_state)
- `programs/evo/src/instructions/set_visual_stage.rs` — NEW: authority-only stage override
- `programs/evo/src/instructions/reveal_collection.rs` — reveal entropy injection, rejects Static
- `programs/evo/src/instructions/evolve.rs` — permissionless evolution
- `programs/evo/src/instructions/shatter.rs` — direct lamport manipulation, reserve invariant
- `programs/evo/src/utils.rs` — transfer_lamports, verify_reserve_invariant, route_fee
- `frontend/src/lib/evo-visuals.ts` — visual lifecycle resolver (on-chain source of truth)
- `frontend/src/lib/evo-program.ts` — account parsers + instruction builders
- `WHITEPAPER.md` — full white paper (sections 5.5, 5.6 for visual lifecycle + wallet guide)
- `README.md` — project overview
- `docs/10-wallet-integration.md` — wallet SDK guide with visual resolution flow
