# EVO Protocol: Business Document

> Problem, solution, and the business model around stateful capital on Solana.

---

## 1. The Problem

### 1.1 NFTs Have No Floor

The NFT market is broken in a specific way: assets have no intrinsic value. An NFT is a token that points at metadata. The metadata points at an image. The image is stored on IPFS or Arweave. None of this has any guaranteed monetary value.

When you buy an NFT, you are buying a pointer. The price is 100% sentiment. If the market decides your NFT is worthless tomorrow, it is worthless. There is no floor. There is no redemption mechanism. There is no way to get your money back.

This has real consequences:
- Buyers get wrecked when sentiment flips
- Creators cannot offer downside protection
- Marketplaces rely on social enforcement (royalties are optional)
- The entire market is pure speculation with no safety net

### 1.2 Tokens Have No Story

SPL tokens are the opposite problem. A token has a balance. The balance is a number. There is no provenance, no history, no visual identity, no evolution. A token is fungible. One SOL is one SOL. There is no "this is the first SOL ever traded on this platform" or "this SOL was held by the founder."

Tokens are good for money. They are bad for collectibles, community assets, and things that should have identity.

### 1.3 The Gap

There is no asset primitive on Solana that combines:
- Guaranteed monetary floor (like a token)
- Unique identity and provenance (like an NFT)
- Progressive value accumulation (neither tokens nor NFTs have this)
- Built-in marketplace (no external dependency)
- Visual evolution over time

This is the gap EVO fills.

---

## 2. The Solution

### 2.1 What EVO Is

EVO (Evolving Value Object) is a Solana program where each asset is a PDA account holding locked SOL. The SOL is the floor. The account is the asset. The owner can feed it more SOL (raising the floor), trade it on the built-in marketplace, evolve it visually, or shatter it to reclaim the SOL.

The floor is not a number on a dashboard. It is actual SOL in an actual account. You can shatter and take it. Anytime. No lockup, no permission, no authority can stop you.

### 2.2 Why This Works

**For buyers:** You always know the worst case. If an EVO has 1 SOL locked and a 10% shatter fee, the worst case is you lose 0.1 SOL. The floor is 0.9 SOL. You never face "my NFT went to zero" because it cannot go below floor. This changes the risk profile entirely.

**For creators:** You can offer real downside protection. "Buy my EVO, if you don't like it, shatter it and get 90% of your SOL back." This is a sales pitch no NFT project can make. It also means creators can charge a premium for the safety net.

**For the market:** The floor creates an arbitrage mechanism. If an EVO is listed below floor, someone buys and shatters. This self-corrects mispriced listings. The market stays efficient.

**For supply:** Shattering reduces supply. As people shatter, the remaining EVOs become more scarce. This is organic supply burn, not a manual burn mechanism. The market self-regulates.

### 2.3 The Visual Layer

EVOs are not just value. They are visual. The art is computed from on-chain data. More SOL means bigger art. More trades mean fracture lines. Older EVOs are more intricate. The visual state evolves through lifecycle stages.

This means an EVO is both a financial asset and a collectible. You can trade it for the floor. You can trade it for the premium. You can hold it for the art. You can feed it to flex. It serves multiple audiences simultaneously.

---

## 3. The Business Model

### 3.1 Revenue Streams

| Stream | Who Pays | Amount | Frequency |
|---|---|---|---|
| Collection creation fee | Collection creators | 0.06789 SOL | One-time per collection |
| Protocol treasury (from fee destinations) | Configured at collection creation | Variable | Ongoing |
| MELD terminal fees | Terminal users | TBD | Ongoing |

The protocol itself earns from the collection creation fee. This is a fixed, small amount designed for spam prevention, not primary revenue.

The primary business is the MELD terminal (the consumer-facing platform). MELD is where users discover, mint, trade, and manage EVOs. The terminal can monetize through:
- Featured placement for collections
- Premium analytics and tooling
- Trading interface fees (on top of protocol royalties)
- Creator services (art design, collection strategy, launch support)

### 3.2 The Flywheel

```
More collections created
  -> more EVOs minted
  -> more SOL locked in the protocol
  -> more trading activity
  -> more royalties collected (creator revenue)
  -> more shatter fees collected (creator + protocol revenue)
  -> more supply burn (survivors get scarce)
  -> premiums rise
  -> more attention
  -> more collections created
```

The flywheel is driven by the floor mechanism. Because EVOs have real floors, they attract risk-averse buyers who would never touch a regular NFT. These buyers bring liquidity. Liquidity attracts creators. Creators bring collections. Collections bring more buyers.

### 3.3 Market Sizing

The Solana NFT market has processed billions in volume. The floor problem is well-known. Every NFT project tries to create floors through community, lockups, and staking. None of these are enforced. EVO enforces the floor at the protocol level.

Total addressable market: anyone who currently buys NFTs but wants downside protection, plus anyone who avoids NFTs because of the no-floor problem. The latter is a much larger market.

### 3.4 Competitive Moat

1. **Protocol-level floor.** No competitor offers this. NFT standards (Metaplex, cNFT) are pointers. Token standards (SPL) are fungible. EVO is the only primitive where the floor is enforced by the program.

2. **Built-in marketplace.** No external marketplace dependency. Listings, trades, and royalties are in the program. This eliminates the marketplace enforcement problem (where marketplaces can choose to ignore royalties).

3. **Immutable terms.** Creators cannot change the rules after launch. This is a trust property that builds collector confidence. Competitive platforms allow mutable metadata and mutable fees.

4. **Visual evolution.** The lifecycle system is protocol-native. No external indexing needed. Wallets and explorers read the visual stage directly from on-chain state. No competitor has this.

5. **Two-sided permissionlessness.** Anyone can create collections AND anyone can mint. No gatekeeping on either side. This maximizes surface area for adoption.

---

## 4. Go-To-Market

### Phase 1: Launch (Now)

- Protocol deployed on mainnet (not yet initialized)
- Frontend live at MELD terminal
- Documentation complete (this document and others)
- Security reviews complete, all findings fixed
- Engage with first creator partners for launch collections

### Phase 2: Adoption

- Initialize protocol on mainnet
- Launch first featured collections
- Marketing push to Solana NFT communities
- Highlight the floor mechanism as the key differentiator
- Onboard creators from existing NFT platforms

### Phase 3: Scale

- Point meldterminal.io domain to terminal
- Add advanced trading features to terminal (analytics, portfolio tracking)
- Explore integrations with Solana lending protocols (borrow against EVO floors)
- Explore batch operations and composability features
- Engage formal third-party security audit
- Renounce upgrade authority

### Phase 4: Ecosystem

- Open the SDK for third-party terminals and marketplaces
- Support cross-platform EVO rendering (wallets, explorers)
- Explore VRF integration with Switchboard for production randomness
- Explore partial redemption patterns
- Build the EVO standard as a Solana primitive alongside NFTs and tokens

---

## 5. The MELD Terminal

MELD is the consumer-facing platform for EVO. It is to EVO what OpenSea is to NFTs, what Pump.fun is to memecoins. The terminal where you discover, mint, buy, sell, and manage EVOs.

### Why A Terminal?

The EVO protocol is permissionless. Anyone can build a frontend. But most users will not interact with a Solana program directly. They need a UI. MELD provides that UI.

The terminal adds value on top of the protocol:
- Discovery (browse collections, find new drops)
- Trading interface (list, buy, feed, shatter)
- Portfolio management (track your EVOs, their floors, their stages)
- Visual rendering (interpret on-chain visual state into actual art)
- Community features (creator pages, collection statistics)

### Revenue From The Terminal

The terminal monetizes separately from the protocol:
- Featured collection placement
- Premium analytics
- Creator services
- Potential trading interface fees (separate from protocol royalties)

The protocol and the terminal are separate businesses. The protocol is infrastructure. The terminal is the product. The protocol succeeds if anyone builds on it. The terminal succeeds if users use MELD specifically.

---

## 6. Risk Analysis

### Technical Risk

- **Upgrade authority is retained.** Until renounced, the program can be upgraded. Mitigation: commit to no changes, renounce after formal audit.
- **No formal third-party audit yet.** Two internal reviews done, but no external firm. Mitigation: engage a Solana security firm.
- **No production VRF.** Commit-reveal is active and tested, but production randomness may need Switchboard. Mitigation: VRF adapter framework exists, ready to wire.

### Market Risk

- **Adoption uncertainty.** EVO is a new primitive. Users need education. Mitigation: clear documentation, simple first collections, the floor mechanism as the key selling point.
- **Competition from existing standards.** Metaplex is entrenched. Mitigation: EVO does not compete with NFTs. It offers something NFTs cannot (real floors). Position as complementary, not replacement.
- **Regulatory uncertainty.** Digital assets with monetary floors may attract regulatory attention. Mitigation: EVOs are not securities, they are collectibles with redemption. Legal review recommended.

### Business Risk

- **Terminal competition.** Anyone can build a MELD competitor. Mitigation: first-mover advantage, brand, and the protocol itself benefits from any terminal.
- **Creator adoption.** Creators are comfortable with existing NFT standards. Mitigation: the floor mechanism is a better product for creators too. They can offer downside protection to buyers.

---

## 7. Key Metrics

| Metric | Target (Year 1) |
|---|---|
| Collections created | 500+ |
| EVOs minted | 50,000+ |
| SOL locked in protocol | 25,000+ SOL |
| Monthly active traders | 10,000+ |
| Monthly trade volume | 100,000+ SOL |
| Terminal monthly active users | 25,000+ |

---

## 8. Summary

EVO is a new asset primitive on Solana. It solves the floor problem that has plagued NFTs since their inception. Each EVO holds locked SOL as a guaranteed floor, with built-in marketplace, visual evolution, and provably fair reveals. The protocol is permissionless, tested, and audited.

MELD is the terminal that makes EVO accessible. Together, they create a two-sided marketplace where creators can launch floored assets and buyers can trade with real downside protection.

The business model is simple: the protocol charges a creation fee, the terminal charges for services. The flywheel is clear: floors attract buyers, buyers attract creators, creators attract more floors.

The moat is the protocol-level floor. No one else has this. It is the thing that makes EVO different from every other asset standard on Solana.

---

## Contact

Terminal: MELD (meldterminal.io)
Repo: https://github.com/stephenclawdbot-png/EVO
Authors: naps (@naps000), admiralfinest (@admiralfinest), Benedict A.