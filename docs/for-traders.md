# EVO Protocol: Trader Guide

> For people who buy, sell, hold, and trade EVOs. No engineering degree required.

---

## What An EVO Is (In Plain Terms)

An EVO is a digital asset on Solana that has SOL locked inside it. Real SOL. Not a promise, not a token, not a derivative. Actual lamports sitting in an account that the EVO controls.

When you buy an EVO, you own that account. The SOL inside is yours. You can get it back any time by shattering the EVO (destroying it and taking the SOL, minus a small fee).

The floor price of an EVO is the locked SOL. That is the minimum it is worth, because you can always shatter and get the SOL. No NFT has this. No token has this. It is a new thing.

Above the floor, the price can go up based on scarcity, provenance, creator reputation, and demand. That is where the trading happens.

---

## The Four Things You Can Do

### Buy (or Mint)

You can mint a new EVO from a collection (if supply has not run out) or buy an existing EVO from someone who listed it for sale.

When you mint, you pay the mint price (goes to the creator) plus the lock amount (goes into the EVO). The lock amount becomes your floor.

When you buy from the marketplace, you pay the asking price. The seller gets the price minus the royalty. The royalty goes to the creator. The locked SOL stays inside the EVO and now belongs to you.

### Feed

You can add more SOL to an EVO you own. This raises the floor. Why would you do this?

- To increase your downside protection
- To make the EVO bigger and more visible (locked SOL affects art size)
- To flex (a well-fed EVO is a status symbol)
- To make it more expensive for someone to shatter if you plan to sell

Feeding is optional. You never have to feed. But every SOL you feed is still yours (minus the shatter fee if you ever shatter).

### Trade

You can list your EVO for sale at any price. The marketplace is built into the protocol. No external marketplace needed. You set the price, someone pays it, the EVO transfers to them.

The royalty is collected automatically. You do not need to trust the buyer to pay it. The program enforces it.

You can also transfer an EVO for free (no payment, just send it to a wallet). Useful for gifting or rewards.

### Shatter

You can destroy your EVO and take the locked SOL back, minus the shatter fee. This is always available. No lockup, no waiting, no permission needed.

When you shatter:
- You get: locked SOL minus shatter fee
- The shatter fee goes to: the creator (or wherever they configured it)
- The EVO is gone. Destroyed. No longer exists. Supply decreases by one.

This is the floor mechanism. If the market price ever drops below the locked SOL, you shatter instead of selling. You never have to sell below floor.

---

## The Value Model

```
Market price = Floor + Premium

Floor = locked SOL minus shatter fee
Premium = whatever the market will pay above floor
```

The floor is guaranteed by the protocol. The premium is set by the market.

### What Drives The Premium

| Factor | Why It Matters |
|---|---|
| Creator reputation | EVOs from known artists are worth more |
| Scarcity | Fewer EVOs in a collection = more valuable |
| Age | Old EVOs cannot be faked. Time is scarce. |
| Trade history | EVOs that have been traded many times have provenance. The art shows fracture lines from trades. |
| Clean history | EVOs that have never been traded are pristine. Some people prefer that. |
| Size (fed SOL) | EVOs with lots of locked SOL are visible flexes |
| Collection demand | If the collection is hot, all EVOs in it trade up |
| Supply burn | As people shatter, supply decreases. Survivors get more scarce. |

---

## How To Evaluate An EVO Before Buying

1. **Check the floor.** How much SOL is locked? This is your worst case. If the EVO has 1 SOL locked and a 10% shatter fee, your floor is 0.9 SOL. You will never lose more than 10% (the shatter fee) unless you sell below floor (don't).

2. **Check the creator.** Is this a known artist or a random wallet? Do they have other collections? What is their reputation? The protocol is permissionless so anyone can create. Do your own diligence.

3. **Check the supply.** How many EVOs are in the collection? How many have been minted? How many have been shattered? A collection with 500 minted and 400 shattered has 100 survivors. That is scarce.

4. **Check the trade history.** How many times has this specific EVO been traded? An EVO traded 50 times has provenance. The fracture lines on the art tell the story. Some buyers pay extra for that.

5. **Check the lifecycle.** Is the EVO revealed? Is it evolved? If the collection uses RevealAndEvolve, an evolved EVO might be worth more (or the unevolved one might be rare if most have evolved). Understand the collection's visual system.

6. **Check the fees.** What is the royalty? If you buy and later sell, you pay the royalty on the sale. What is the shatter fee? If you ever shatter, you pay that. Factor these into your math.

---

## Trading Strategies

### The Floor Arbitrage

If an EVO is listed below its floor (locked SOL minus shatter fee), you buy it and shatter it. Free money. This should not happen in efficient markets, but it can happen in new or thin markets. The protocol makes this possible because the floor is real.

Example: EVO has 2 SOL locked, 5% shatter fee (0.1 SOL), listed for 1.5 SOL. You buy for 1.5 SOL, shatter, get 1.9 SOL back. Profit: 0.4 SOL. The market should price this at 2 SOL minimum, but if someone panic-sells, you grab it.

### The Premium Play

You buy EVOs you think will appreciate above floor. This is speculative. You are betting that creator reputation, scarcity, or demand will increase the premium. The floor protects your downside. The premium is your upside.

Good candidates: early EVOs from promising creators, EVOs with interesting trade histories, EVOs in collections that are burning supply (people shattering).

### The Feed And Hold

You buy an EVO and feed it more SOL. The floor goes up. The art gets bigger. If you feed 5 SOL into a 1 SOL EVO, the floor is now 6 SOL. You can sell it for 6+ or hold it. This is a way to increase value without relying on market sentiment.

Why would someone buy a well-fed EVO from you? Because the floor is higher, the art is bigger, and it is a visible flex. The premium for "the most fed EVO in the collection" can be significant.

### The Shatter Play

You buy EVOs that are trading below or near floor and shatter them. You collect the locked SOL. This reduces supply. If you are a creator, shattering your own unsold EVOs reduces supply and supports the price. If you are a trader, you arbitrage mispriced listings.

### The Evolution Play

In RevealAndEvolve collections, EVOs that have evolved to later stages might be worth more (visual rarity). Or EVOs that are stuck at an early stage while others have evolved might be worth more (stagnation rarity). Understand the collection's evolution rules and trade accordingly.

---

## What To Watch Out For

### High Shatter Fees

A 20% shatter fee means you lose 20% of your locked SOL if you shatter. That is a big cut. Check the shatter fee before minting. If it is high, you need more confidence in the premium.

### Low Lock Amounts

If the lock amount is 0.01 SOL, the floor is basically zero. The EVO is trading purely on premium, no protection. That is fine if you know what you are buying, but don't mistake it for a floored asset.

### Unverified Creators

Anyone can create a collection. The protocol does not check if you are a good artist or a reputable project. A collection from a brand new wallet with no history is high risk. The floor protects your SOL, but the premium can go to zero if nobody cares about the collection.

### Supply Inflation

If a collection has 20,000 supply cap and only 100 have minted, there are 19,900 more that could be minted. That is inflationary. If the creator can mint more anytime, supply could flood the market. Check the minted count vs the cap.

### Royalty On Sale

When you sell, the royalty comes out of your sale price. If you buy at 2 SOL and sell at 2 SOL with 10% royalty, you get 1.8 SOL. You lost 0.2 SOL on a flat trade. Factor royalties into your trading math.

---

## Reading An EVO

When you look at an EVO on MELD or any explorer, here is what you are seeing:

- **The art:** generated from on-chain data. Bigger EVOs have more SOL. Older EVOs are more intricate. Traded EVOs have fracture lines. The colors come from the resonance seed. The visual stage comes from the current_state field.
- **The floor:** shown as the locked SOL. This is your redemption value minus shatter fee.
- **The stage:** current visual stage. In RevealAndEvolve collections, this tells you how evolved the EVO is.
- **The trade count:** how many times it has been traded. More trades = more provenance = more fracture lines on the art.
- **The forged date:** when it was created. Older EVOs are naturally more scarce.
- **The listing status:** if it is listed, the asking price. If not, it is not for sale.

---

## The MELD Terminal

MELD is where you discover, mint, buy, and sell EVOs. It is the consumer-facing terminal for the EVO protocol. Think of it as the marketplace and gallery.

On MELD you can:
- Browse collections
- Mint new EVOs
- Buy and sell on the marketplace
- Feed your EVOs
- View trade history and provenance
- See visual stages and evolution progress
- Track your portfolio

The terminal reads all data from the chain. No intermediary, no database to trust. What you see is what is on Solana.

---

## Quick Reference

| Question | Answer |
|---|---|
| What is the floor? | Locked SOL minus shatter fee |
| Can I lose my SOL? | Only the shatter fee percentage. The rest is reclaimable. |
| Can the creator steal my SOL? | No. The SOL is locked in a PDA. Only the owner can shatter. |
| Can the protocol be upgraded to change the floor? | The upgrade authority exists but has not been used. The invariant is enforced in code. After formal audit, authority will be renounced. |
| Is there a lockup period? | No. You can shatter anytime. |
| Do I need to use MELD? | No. You can interact with the program directly. But MELD is the easiest way. |
| What happens when I shatter? | You get locked SOL minus fee. The EVO is destroyed. Gone. |
| Can I partially redeem? | No. All or nothing. |
| Can someone buy a listed EVO from under me? | First transaction to land wins. Standard Solana behavior. |

---

## Risk Disclosure

EVOs are a new primitive. The protocol has been audited and tested but has not seen large-scale market stress. The upgrade authority is currently retained. Market premiums can go to zero. The floor protects your locked SOL but does not protect the premium you paid.

Trade with money you can afford to lose. Do your own research. The protocol is permissionless and anyone can create collections, including bad ones.

---

## Contact

Terminal: MELD (meldterminal.io)
Repo: https://github.com/stephenclawdbot-png/EVO
Authors: naps (@naps000), admiralfinest (@admiralfinest), Benedict A.