# 09 — Security Review & Implementation Plan

## Overview

This document covers:
1. **Program design audit** — edge cases, attack vectors, and design issues
2. **Wallet integration plan** — how users see their Z in Phantom/Solflare
3. **Security hardening** — what to get right before mainnet

---

## Part 1: Program Design Audit

### ✅ What's Solid

| Design Decision | Why It's Good |
|---|---|
| PDA-based ownership (no SPL token) | No token account confusion, no transfer-by-mistake |
| `owner == signer` check on all mutations | Nobody can touch your Z without your signature |
| Shatter closes the PDA | SOL goes to owner, account ceases to exist, can't be reused |
| Hardcoded 2000 supply cap | Enforced in code, not configurable by authority |
| Facets computed from `forged_at` | No "miss a claim" problem — always current |
| Fracture lines are append-only | Trade history can't be rewritten |
| Fee splits coded in program | No off-chain fee collection, no trust needed |

### ⚠️ Edge Cases & Issues Found

#### 1. **Re-entrancy via `buy` → Previous Owner's Account**

**Risk:** When `buy()` transfers SOL to the seller, if the seller's account is a program (PDA), it could trigger another instruction.

**Fix:** Use `**to = seller**` with `system::transfer` (CPI to system program). The system program doesn't execute custom logic. If the seller is a PDA, the transfer fails (PDAs can't receive via system transfer unless they sign). This is actually fine — but we should validate that `seller` is a regular wallet (signer account), not a PDA.

**Status:** Low risk. Anchor's `transfer` handles this safely. Just document that sellers must be normal wallets.

---

#### 2. **`feed()` Has No Minimum Amount**

**Risk:** Someone could feed 1 lamport (0.000000001 SOL) repeatedly to spam the chain.

**Impact:** No economic harm (SOL goes into the PDA), but blockchain bloat and wasted compute.

**Fix:** Add a minimum feed amount:
```rust
require!(amount >= MIN_FEED_LAMPORTS, EVOError::FeedTooSmall);
// MIN_FEED_LAMPORTS = 1_000_000 (0.001 SOL)
```

**Status:** Should fix. Easy.

---

#### 3. **`facet_count` Capped at 100 — But What About Rendering?**

**Risk:** 100 facets with 20 fracture lines = complex render. On low-end devices, this could lag.

**Fix:** This is a rendering concern, not a program concern. The renderer should have LOD (level of detail) — render fewer facets for thumbnails, full detail for the main view. The on-chain cap at 100 is fine.

**Status:** Not a program issue. Renderer handles it.

---

#### 4. **`fracture_lines` Vec Can Grow Unbounded**

**Risk:** A Z traded 1000 times has 1000 fracture lines. Each is ~40 bytes. 1000 × 40 = 40KB. Solana accounts max at 10MB, but rent gets expensive.

**Fix:** Cap fracture lines at a reasonable number (e.g., 50). After 50, either:
- **Option A:** Stop recording new fracture lines (oldest stay)
- **Option B:** Overwrite oldest (ring buffer)
- **Option C:** Only record "significant" trades (above a threshold)

**Recommendation:** Option A — cap at 50. After 50 trades, the Z is "legendary" and fracture lines stop being added. The `trade_count` still increments, so viewers know it traded more than 50 times.

**Status:** Should fix. Add `MAX_FRACTURE_LINES = 50` constant.

---

#### 5. **`list_price` Denomination**

**Risk:** `list_price` is in lamports (u64). Max u64 = 18.4 quintillion lamports = ~18.4 billion SOL. Unlikely to overflow, but should validate.

**Fix:** Add a `MAX_LIST_PRICE` (e.g., 10_000 SOL = 10_000_000_000_000 lamports). Prevents absurd listings.

**Status:** Should fix. Simple validation.

---

#### 6. **`buy()` With `listed` Z — Race Condition**

**Risk:** Owner lists Z for 5 SOL. SOL price pumps. Z is now worth 10 SOL at floor. Someone buys for 5 SOL. Owner wanted to delist but transaction didn't land in time.

**Impact:** This is just market risk — same as any marketplace. Not a bug. The owner chose to list.

**Fix:** None needed. This is expected market behavior. Owners should delist if they want to adjust.

**Status:** Not a bug. Expected behavior.

---

#### 7. **`shatter()` While Listed**

**Risk:** Z is listed for sale. Owner shatters it. Buyer tries to buy a now-nonexistent Z.

**Fix:** `shatter()` must check `is_listed == false` OR automatically delist on shatter. Since shatter closes the account, the buyer's `buy()` would fail because the PDA no longer exists (Anchor's account validation catches this). But we should explicitly require `!is_listed` in `shatter()` for clarity.

**Status:** Should fix. Add `require!(!z.is_listed, EVOError::StillListed)`.

---

#### 8. **`resonance_seed` Generation**

**Current design:** `hash(forge_tx_signature)`

**Risk:** Transaction signatures are unpredictable but deterministic. However, there's a subtle issue — if someone can front-run a forge transaction, they could potentially see the signature before it's confirmed. But the signature is only known AFTER the transaction is finalized, so this is not exploitable.

**Better approach:** Use `Sysvar::recent_blockhashes` or a combination:
```rust
let seed = keccak256(&[
    &tx_signature[..],
    &payer.key().to_bytes(),
    &Clock::get()?.unix_timestamp.to_le_bytes(),
    &z_index.to_le_bytes(),
]);
```

**Fix:** Mix multiple sources. Makes it truly unpredictable.

**Status:** Should improve. Security hardening.

---

#### 9. **Protocol Authority — Single Key Risk**

**Risk:** If protocol authority is a single key and it's compromised, attacker could:
- Change fee parameters (set to 100%)
- Pause collections
- But CANNOT steal SOL (SOL is in Z PDAs, only owners can shatter)
- CANNOT change art (art is client-side)

**Fix:** Protocol authority should be a **multisig** (Squads on Solana). 2-of-3 or 3-of-5. Additionally:
- Fee changes should have a **timelock** (48-hour delay before taking effect)
- Max fee cap hardcoded (e.g., protocol_trade_fee_bps can never exceed 500 = 5%)
- Fee changes emit an event so the community is notified

**Status:** Critical for mainnet. Must implement multisig + timelock + fee cap.

---

#### 10. **Collection Authority — Pause Power**

**Risk:** Collection authority can pause minting. If compromised, they can't steal SOL but can prevent new mints.

**Fix:** Collection authority should also be a multisig. Pausing should require a cooldown before unpausing (prevent rapid pause/unpause griefing).

**Status:** Medium priority. Multisig recommended.

---

#### 11. **Rent Exemption on `feed()`**

**Risk:** When feeding SOL, the SOL goes into the Z PDA's lamport balance. But the PDA also needs to maintain rent-exempt minimum. If someone feeds exactly the rent minimum, the accounting gets confusing.

**Fix:** Clearly separate `locked_lamports` (what the user fed) from the PDA's total lamports (which includes rent). The PDA's total lamports = rent_exempt_minimum + locked_lamports. On shatter, return locked_lamports (minus fee) and close the account (reclaiming rent).

**Status:** Must implement correctly. Architecture decision.

---

#### 12. **Integer Overflow in Fee Calculations**

**Risk:** `price * fee_bps / 10000` could overflow if price is very large.

**Fix:** Use `u128` for intermediate calculations:
```rust
let fee = (price as u128 * fee_bps as u128 / 10000) as u64;
```

**Status:** Must fix. Standard Solana practice.

---

#### 13. **`create_collection()` — Name Collision**

**Risk:** Two collections with the same name. PDA seeds include name bytes, so this would collide.

**Fix:** Anchor's PDA derivation will fail if the collection already exists (account already initialized). This is handled automatically by `init` constraint. But we should also validate name length and charset.

**Status:** Handled by Anchor. Add name validation (max 32 bytes, ASCII only).

---

#### 14. **Front-Running on `buy()`**

**Risk:** Someone sees a `list` transaction in mempool, front-runs with a `buy` at the same price.

**Impact:** The buyer gets the Z — but at the listed price, which is what the seller asked for. This is just normal market behavior. Not a security issue.

**Fix:** None needed. This is how all on-chain marketplaces work.

**Status:** Not a bug.

---

#### 15. **`shatter()` Fee Going to Protocol — Not Collection**

**Current design:** 1% shatter fee goes 100% to protocol treasury.

**Issue:** The collection that hosted this Z gets nothing on shatter. This is by design (protocol provides the trustless shatter mechanism), but competitors might want a cut.

**Fix:** Consider splitting shatter fee: 0.5% protocol + 0.5% collection. Make it configurable per collection.

**Status:** Design decision. Current design is fine for Z (we are both protocol and collection). Revisit for competitor collections.

---

## Part 2: Wallet Integration Plan

### The Problem

EVOs are PDAs, not Metaplex NFTs. Standard wallets (Phantom, Solflare, Backpack) only display:
- SPL tokens (via token accounts)
- Metaplex NFTs (via Metaplex token standard)
- Metaplex Core assets (via Core plugin system)

EVOs are none of these. So wallets can't show them by default.

### Solution Architecture

```
┌─────────────────────────────────────────────┐
│                User's Browser                │
│                                              │
│  ┌─────────────┐    ┌─────────────────────┐ │
│  │   Phantom    │    │   z.fun (our app)   │ │
│  │   Wallet     │    │                      │ │
│  │              │◄──►│  @solana/wallet-     │ │
│  │  (signing    │    │  adapter (connect)   │ │
│  │   only)      │    │                      │ │
│  └─────────────┘    │  Reads Z PDAs via    │ │
│                      │  @solana/web3.js      │ │
│                      │                      │ │
│                      │  Renders art via     │ │
│                      │  WebGL/SVG engine    │ │
│                      │                      │ │
│                      │  Shows: your Z,      │ │
│                      │  marketplace, forge, │ │ │
│                      │  feed, shatter       │ │
│                      └─────────────────────┘ │
└─────────────────────────────────────────────┘
          │
          ▼
   ┌──────────────┐
   │   Solana     │
   │   RPC        │
   │              │
   │  Z PDAs      │
   │  (on-chain)  │
   └──────────────┘
```

**Key insight:** Phantom is just a signing device. Our app does ALL the reading, rendering, and displaying. We don't need Phantom to "understand" Z. We just need Phantom to sign transactions.

### Approach 1: Custom Frontend (Primary)

This is the main approach. No wallet integration needed — we build our own frontend.

**Stack:**
- **Next.js** (React framework)
- **@solana/web3.js** (read Z PDAs from chain)
- **@solana/wallet-adapter** (connect to Phantom/Solflare/Backpack)
- **WebGL renderer** (display Z art)
- **Tailwind CSS** (UI)

**How it works:**
1. User goes to z.fun (our website)
2. Clicks "Connect Wallet" → Phantom popup
3. Our app reads all Z PDAs owned by that wallet
4. Renders the Z art client-side
5. User can forge, feed, list, buy, shatter — all signed via Phantom

**Pros:**
- Full control over UX
- Can show everything (art, history, marketplace)
- No dependency on wallet developers
- Works with ANY Solana wallet

**Cons:**
- Users must visit our site to see their Z
- Not visible in Phantom's "Collectibles" tab

### Approach 2: Metaplex Core Shadow Asset (Future Enhancement)

Make Z *also* exist as a Metaplex Core asset, so they show up in wallet "Collectibles" tabs.

**How it works:**
1. When a Z is forged, also mint a Metaplex Core asset
2. The Core asset's image URI points to our API: `https://api.z.fun/render/<z_pda>`
3. Our API reads the Z PDA from chain, renders the current art, returns a PNG
4. Wallet fetches the image URI → sees the Z art
5. When Z is shattered, burn the Core asset

**Metaplex Core advantages:**
- Lightweight (cheaper than Token Metadata)
- Plugin system (can add custom data)
- Non-transferable plugin available (soulbound to PDA owner)
- Wallets already support Core assets

**Cons:**
- Adds complexity (two accounts per Z: PDA + Core asset)
- Image API is a centralized dependency (if our API is down, wallets show broken images)
- Costs extra rent for the Core asset account
- Need to keep Core asset in sync with PDA state

**Recommendation:** Start with Approach 1 (custom frontend). Add Approach 2 (Core shadow) as a Phase 2 enhancement once the protocol is live and proven.

### Approach 3: Token-2022 (Not Recommended)

Could use Token-2022 with custom extensions, but:
- Token-2022 is still not fully supported by all wallets
- Doesn't solve the "how to display art" problem
- Adds token standard complexity we don't need
- EVOs aren't tokens — forcing them into a token standard is wrong

**Recommendation:** Skip.

### Implementation Plan for Approach 1

```
Phase 1: Read-only display
  - Connect wallet
  - Fetch all Z PDAs for connected wallet
  - Render art for each Z
  - Show Z details (locked SOL, facets, age, fractures)

Phase 2: Full interaction
  - Forge new Z
  - Feed SOL to Z
  - List Z for sale
  - Buy listed Z
  - Shatter Z
  - Marketplace grid (all listed Z)

Phase 3: Enhanced features
  - Activity feed (recent trades, shatters, feeds)
  - Leaderboard (oldest Z, most SOL locked, most traded)
  - Collection stats (total supply, total locked SOL, floor price)
  - User profiles (show someone's Z collection)
```

### Wallet Adapter Setup

```typescript
// wallet-adapter.ts
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base';
import { PhantomWalletAdapter } from '@solana/wallet-adapter-phantom';
import { SolflareWalletAdapter } from '@solana/wallet-adapter-solflare';

const network = WalletAdapterNetwork.Mainnet;
const endpoint = clusterApiUrl(network);

const wallets = [
  new PhantomWalletAdapter(),
  new SolflareWalletAdapter(),
  // Backpack, Glow, etc. auto-detected
];
```

### Reading Z PDAs

```typescript
// read-z.ts
import { Program, Provider } from '@coral-xyz/anchor';
import { PublicKey } from '@solana/web3.js';
import { IDL, EVO } from './evo-idl';

async function getZForOwner(
  connection: Connection,
  owner: PublicKey
): Promise<ZAccount[]> {
  const program = new Program(IDL, provider);
  
  // Z PDAs are derived: ["z", collection_key, z_index]
  // But we don't know z_index ahead of time
  // Solution: use getProgramAccounts with owner filter
  
  const zAccounts = await connection.getProgramAccounts(
    EVO_PROGRAM_ID,
    {
      filters: [
        // Filter by owner field in ZAccount data
        { memcmp: { offset: 8, bytes: owner.toBase58() } }
      ]
    }
  );
  
  return zAccounts.map(({ account, pubkey }) => 
    program.coder.accounts.decode('zAccount', account.data)
  );
}
```

---

## Part 3: Security Hardening Checklist

### Pre-Mainnet Security Checklist

#### Program-Level Security

- [ ] **Multisig for protocol authority** — Use Squads (2-of-3 or 3-of-5)
- [ ] **Multisig for collection authority** — Same
- [ ] **Fee cap hardcoded** — `protocol_trade_fee_bps <= 500` (max 5%)
- [ ] **Timelock on fee changes** — 48-hour delay, emit event
- [ ] **Revoke upgrade authority after deployment** — Makes program immutable
- [ ] **No admin "emergency withdraw"** — No backdoor to drain SOL
- [ ] **All signer checks** — Every mutation requires owner signature
- [ ] **Integer overflow protection** — Use u128 for math
- [ ] **Account size validation** — Check account data length matches expected
- [ ] **Account owner validation** — Verify accounts are owned by our program

#### Economic Security

- [ ] **Minimum feed amount** — 0.001 SOL minimum
- [ ] **Maximum list price** — 10,000 SOL cap
- [ ] **Fracture line cap** — Max 50, then stop recording
- [ ] **Rent accounting** — locked_lamports separate from total account lamports
- [ ] **Fee precision** — Use u128 intermediates, round in favor of protocol

#### Operational Security

- [ ] **Devnet testing** — Full lifecycle test (forge → feed → trade → shatter)
- [ ] **Fuzzing** — Test with random inputs
- [ ] **Third-party audit** — Professional Solana audit (before mainnet)
- [ ] **Bug bounty** — Post-launch bug bounty program
- [ ] **Upgrade authority revoked** — After final deploy, revoke in program
- [ ] **Multisig for treasury** — Treasury wallet is multisig

#### Frontend Security

- [ ] **Transaction preview** — Show users what they're signing before approval
- [ ] **Slippage protection** — For buy(), allow max price tolerance
- [ ] **Simulation** — Pre-simulate transactions before sending
- [ ] **Error handling** — Clear error messages for failed transactions
- [ ] **No private keys in frontend** — All signing via wallet adapter

### Program Immutability

The most important security property of EVO: **after deployment, the program should become immutable.**

```
Deployment flow:
1. Deploy to devnet
2. Test full lifecycle
3. Deploy to mainnet (with upgrade authority)
4. Verify everything works
5. REVOKE UPGRADE AUTHORITY ← this step
6. Program is now immutable forever
```

Once upgrade authority is revoked:
- No one can change the program logic
- No one can add new instructions
- No one can modify fee logic
- No one can add a "drain" function
- The program runs exactly as deployed, forever

This is the ultimate trust guarantee. Combined with:
- No admin key for art (art is computed)
- No update authority for metadata (no metadata)
- Multisig for fee parameter changes (with timelock + cap)

...EVO becomes one of the most trustless protocols on Solana.

### Trust Assumptions Summary

| What You Trust | Who Controls It | Risk if Compromised |
|---|---|---|
| Your Z ownership | Your private key | They steal your Z |
| Z art rendering | Open-source renderer | They see wrong art (but on-chain data is correct) |
| Fee parameters | Multisig + timelock | Fees change (capped at 5%, 48h notice) |
| Program logic | Nobody (immutable) | No risk — can't be changed |
| Your locked SOL | Program logic (immutable) | No risk — only you can shatter |
| Solana network | Validators | Network goes down (same as all Solana) |

**What you DON'T trust:**
- ❌ No artist (art is computed)
- ❌ No metadata authority (no metadata)
- ❌ No program upgrader (immutable)
- ❌ No admin key (multisig + timelock + cap)
- ❌ No centralized server (all on-chain)

---

## Part 4: Implementation Roadmap (Updated)

### Phase 0: Foundation (Weeks 1-2)
- [ ] Write Solana program in Anchor (Rust)
- [ ] Instructions: init_protocol, create_collection, forge, feed, list, delist, buy, shatter
- [ ] All security checks from this document
- [ ] Unit tests for each instruction
- [ ] Deploy to devnet

### Phase 1: Frontend MVP (Weeks 3-4)
- [ ] Next.js + wallet adapter
- [ ] Read Z PDAs from chain
- [ ] Render Z art (SVG first, WebGL later)
- [ ] Forge + feed UI
- [ ] Marketplace (list/buy) UI
- [ ] Shatter UI
- [ ] Deploy to Vercel

### Phase 2: Art + Polish (Weeks 5-8)
- [ ] Artist engagement (color palettes, facet geometry, fracture style)
- [ ] WebGL renderer (shaders, glow, refraction)
- [ ] Marketplace grid view
- [ ] Activity feed
- [ ] Leaderboards
- [ ] Mobile responsive

### Phase 3: Mainnet Launch (Weeks 9-10)
- [ ] Third-party security audit
- [ ] Deploy to mainnet
- [ ] Revoke upgrade authority
- [ ] Open mint (public)
- [ ] Marketing launch

### Phase 4: Protocol Expansion (Post-launch)
- [ ] Metaplex Core shadow assets (wallet display)
- [ ] Collection creation UI (for competitors)
- [ ] API for third-party integrations
- [ ] DAO governance
- [ ] More EVO collections on the protocol

---

## Part 5: Cost Breakdown

### Development Costs (Time, Not Money)
- Solana program (Rust/Anchor): ~40 hours
- Frontend (Next.js): ~40 hours
- Art renderer (WebGL/SVG): ~40 hours
- Testing + audit: ~20 hours
- **Total: ~140 hours of development**

### Deployment Costs (Money)
| Item | Cost |
|---|---|
| Program deployment (one-time) | ~1-3 SOL |
| Devnet testing | FREE |
| Domain (z.fun or similar) | ~$20-50/year |
| Vercel hosting (frontend) | FREE (hobby tier) |
| RPC node (Helius/QuickNode) | FREE tier → ~$49/mo at scale |
| Security audit | ~$5,000-15,000 (optional but recommended) |

### Per-User Costs (Paid by Users)
| Action | Cost to User |
|---|---|
| Forge (mint) | 0.05 SOL |
| Feed | 0.001 SOL (min) + ~$0.001 tx fee |
| List | ~$0.001 tx fee |
| Buy | Sale price + ~$0.001 tx fee |
| Shatter | ~$0.001 tx fee (1% of locked SOL goes to protocol) |

---

*Part of the [EVO documentation](../README.md)*