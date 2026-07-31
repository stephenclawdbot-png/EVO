# EVO-EVM — collectibles with real assets sealed inside (DRAFT)

> ## ⚑ DIRECTION (creator decision — binding)
> **EVO-EVM will NOT be an ERC-721.** EVO is a third asset model, not an NFT,
> on every chain. The chosen path is authoring a NEW standard — **ERC-EVO**
> (Evolving Value Objects): own interface (`forge/feed/reserveOf/evolve/
> shatter`), intrinsic reserve, native lifecycle, ungateable redemption, plus
> primitives NFTs cannot express — **meld** (merge two EVOs: reserves combine,
> histories join) and **split**. MELD remains the exclusive terminal — that is
> the moat, not a limitation. The ERC-721 draft below is retained ONLY as a
> compatibility reference; do not build it as the product.


Port of the EVO primitive to EVM chains (Base first; BSC for degen flavor).
**Status: architecture + draft contract only. NOT compiled, NOT audited,
NOT deployed. Do not use with real funds.**

## The pitch
An ERC-721 where every token seals a redeemable reserve inside:
- native ETH/BNB, or **any ERC-20** — stablecoins ("always worth ≥ $50"),
  PAXG (gold), yield-bearing stables (the floor GROWS by itself).
- Feed to raise the floor. Evolve when thresholds are met (dynamic tokenURI —
  wallets/marketplaces show stages automatically, no custom resolver needed).
- Shatter to burn and reclaim the reserve. Same EVO lifecycle, new asset rails.

## Why EVM makes parts of EVO easier
| Solana pain | EVM |
|---|---|
| Wallets can't display PDAs | `tokenURI()` — OpenSea/MetaMask native |
| VRF stub | Chainlink VRF, mature |
| Per-asset accounts | one contract, `mapping(tokenId => reserve)` |

## Regulatory ladder (do not skip)
1. **Stablecoins** (USDC/USDT) — ship first, legible, low risk
2. **PAXG** (tokenized gold) — fine, transferable
3. **Yield-bearing stables** (e.g. USDY-class) — check transfer restrictions
4. **Tokenized securities (OUSG/BUIDL-class)** — usually KYC-gated transfer
   restrictions; wrapping them in a free-trading NFT breaks or creates a
   securities problem. Lawyer first. Never market "backed by X fund" casually.

## Files
- `contracts/EvoCollection.sol` — draft implementation
- `SPLIT-TO-REPO.md` — how to extract this folder into its own repository

## Build plan (when picked up)
Foundry: `forge init`, OpenZeppelin (ERC721, ERC2981, ReentrancyGuard,
SafeERC20), tests mirroring the Solana invariants (SECURITY.md §4 of the main
repo), Chainlink VRF for rare evolutions, deploy Base Sepolia → Base.

## Reserve classes (creator decision — ERC-EVO holds ANY of these, per collection)
Same architecture on every chain: the contract is the custodian (PDA-equivalent
= contract storage records); the asset never leaves the machine.
1. **Native ETH/BNB** — direct port of the Solana model
2. **LSTs (stETH/rETH)** — DEFAULT FLAGSHIP: the floor yields ~3-4%/yr natively,
   zero extra machinery. "A pet whose floor grows while you sleep."
3. **Stables / tokenized stocks / PAXG** — dollar-legible or RWA floors
   (regulatory ladder above applies; check transfer restrictions first)
4. **NFTs as reserves** — an EVO wrapping an ERC-721: a living vault around a
   static asset. Gives the existing NFT world feed/evolve/meld/history —
   upgrade layer, not competitor. Genuinely novel; no prior art known.
5. Mixed baskets — later.

## BSC (BNB Chain) deployment — same contract, different continent
ERC-EVO is chain-agnostic EVM bytecode: ONE codebase deploys to Base and BSC
unchanged. Only the reserve menu, positioning, and go-to-market localize.

### Reserve classes localized for BSC
1. **Native BNB** — the direct model; BNB's burn schedule adds a mildly
   deflationary floor narrative.
2. **BNB LSTs — slisBNB (Lista), BNBx (Stader), ankrBNB** — self-growing floor
   (~2–3%/yr BNB staking). Same flagship logic as stETH on Base.
3. **Stables: USDT (dominant on BSC), FDUSD, USD1** — dollar-legible floors for
   a massive retail audience.
4. **Meme-token reserves** — a kitty stuffed with $FLOKI/$DOGE. On Base this is
   a gimmick; on BSC it IS the culture. The degen flagship: speculative reserve
   + guaranteed redemption of whatever it's worth = "the memecoin you can't
   fully lose" wrapper.
5. **NFT-wrapping** — as on Base.

### Positioning per chain (one protocol, two personalities)
- **Base** = the credible flagship: LST floors, RWA ladder, serious-money story.
- **BSC** = the degen edition: meme reserves, cheap mints (~$0.03–0.10 gas,
  sub-second blocks), enormous retail reach via Binance Wallet / Trust Wallet /
  PancakeSwap ecosystem. Do NOT lead with RWA on BSC — lead with fun + floor.
- opBNB (BNB's L2) exists if fees must approach zero for micro-lock collections.

### Funding path (relevant — builder is capital-constrained)
BNB Chain actively funds builders: **MVB (Most Valuable Builder) accelerator
with YZi Labs/Binance, BNB Chain grants, gas grants, TVL incentive programs.**
A live multi-chain protocol with a novel standard + working Solana traction is
a strong MVB application. This is a real audit-money path.

### Cautions
- BSC's scam-heavy reputation cuts both ways: ship the same honest SECURITY
  posture (verified source on BscScan day one, no anon-deploy vibes).
- Custom standard = no native wallet display on BSC either (Trust/Binance
  Wallet show tokens, not our records) — MELD is the terminal there too; the
  moat holds on every chain.
- Validator set is small/centralized vs ETH — fine for collectibles, worth one
  honest line in any BSC whitepaper.
