# EVO-EVM — collectibles with real assets sealed inside (DRAFT)

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
