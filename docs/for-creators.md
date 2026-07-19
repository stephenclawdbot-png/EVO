# EVO Protocol: Creator Guide

> For artists, brands, communities, and anyone who wants to launch an EVO collection.

---

## What You Are Building

When you create an EVO collection, you are making a set of assets that each hold real SOL inside them. Not a token that represents value. Not an NFT that points at an image. An actual PDA account on Solana with locked SOL inside, owned by whoever holds it.

The person who mints your EVO pays two things:
1. Your mint price (this goes to you, the creator)
2. The lock amount (this stays inside the EVO as the floor)

The lock amount is the floor price. If the market ever values your EVO below the locked SOL, the owner can shatter it and take the SOL back. This means your EVOs always have a real, enforced price floor. No other NFT standard on Solana does this.

Your EVOs can also evolve visually over time. They can start as one thing and become another. The art can respond to on-chain events: trades, feeds, age. This is built into the protocol. You do not need to build any infrastructure for it.

---

## Why Launch On EVO

**Real floors.** Every EVO has SOL locked inside. The floor is not a number on a dashboard. It is actual SOL that can be reclaimed. Buyers know exactly what the downside is before they mint.

**Built-in marketplace.** Listing, buying, and royalties are all in the program. You do not need to integrate with a marketplace or pay listing fees. Owners can list and trade from day one.

**Evolving art.** Your collection can have visual stages. EVOs can start hidden, reveal, then evolve through multiple stages. Each stage can look different. The program tracks the stage on-chain. Wallets and explorers read it directly.

**Permissionless.** Anyone can create a collection. No application, no approval process, no gatekeeper. You pay a small creation fee (0.06789 SOL) and you are live.

**Immutable terms.** Once the first EVO is forged, your fee structure and supply cap are locked forever. Collectors know you cannot change the rules mid-game. This builds trust.

**Creator revenue.** You set the mint price. Every mint pays you. You set the royalty. Every trade pays you. You set the shatter fee. Every shatter pays you. All on-chain, all automatic, all enforced by the program.

---

## The Collection Parameters You Control

When you call `create_collection`, you set these parameters. They are immutable after the first EVO is forged. Choose carefully.

### Supply Cap (1 to 20,000)

How many EVOs can be minted in this collection. Once you hit the cap, no more can be forged. You cannot increase it. You cannot decrease it. If you set 1,000 and sell out, the collection is complete. If you set 10,000 and sell 50, the remaining slots are unused.

Think about scarcity. A 100-cap collection is naturally scarce. A 10,000-cap collection needs strong demand to feel scarce. Most successful collections probably land between 500 and 5,000.

### Mint Price (0 to whatever)

What you charge per mint. This goes to your wallet. This is your revenue from the mint itself. Set it to 0 for a free mint (you still earn from royalties and shatter fees). Set it higher if you want upfront revenue.

Consider: a high mint price with a low lock amount means buyers are paying you for the concept. A low mint price with a high lock amount means buyers are locking SOL as a commitment. Both models work. They attract different audiences.

### Lock Amount (the floor)

How much SOL is locked inside each EVO. This is the floor price. Higher lock means more downside protection but more expensive to mint. Lower lock means cheaper to mint but less protection.

Good starting range: 0.05 to 1 SOL. Remember: the lock amount is the same for every EVO in the collection. You cannot have different lock amounts for different mints.

### Royalty (0 to 25%)

What percentage of every trade goes to you. Set in basis points. 500 bps = 5%. 1000 bps = 10%. The royalty is taken from the sale price and sent to your chosen destination. It is collected on every trade, automatically, by the program. No reliance on marketplace enforcement.

### Shatter Fee (0 to 20%)

What percentage is taken when an EVO is shattered. If someone shatters their EVO to reclaim the locked SOL, this fee is deducted first and sent to your chosen destination. This is your cut of the redemption.

A 10% shatter fee means: EVO has 1 SOL locked, owner shatters, owner gets 0.9 SOL, you get 0.1 SOL. Set it to 0 if you want shattering to be free. Set it higher if you want to discourage shattering (which preserves supply and scarcity).

### Fee Destinations

For both royalty and shatter fee, you choose where the money goes:
- **Treasury:** the protocol treasury
- **Creator:** your wallet
- **Burn:** permanently destroyed (reduces SOL supply)
- **Split:** divided among multiple destinations

Most creators will choose "Creator" for both. Some might burn shatter fees to make shattering more expensive and preserve supply. Up to you.

### Lifecycle Type

How your EVOs change visually over time:

| Type | What It Does | Good For |
|---|---|---|
| Static | Art never changes | Simple collections, straightforward drops |
| Reveal | Hidden at mint, revealed later | Mystery drops, "what did I get?" excitement |
| CommitReveal | Same as Reveal but provably fair | When trust matters, high-value collections |
| RevealAndEvolve | Reveal then continue evolving | Collections that grow over time |
| Custom | You control stage changes manually | Full creative control, complex narratives |

### Randomness Policy

For reveal-based collections, how the reveal randomness works:
- **None:** no randomness, stages are deterministic
- **Predetermined:** creator sets the secret upfront
- **BatchReveal:** reveal happens in batches for gas efficiency

For CommitReveal, the creator commits a keccak256 hash of the secret before minting. After minting, the secret is revealed and verified. This proves the creator did not cherry-pick who got what.

---

## The Art System

EVO art is hybrid. There are three layers:

### Layer 1: Your Base Design (Static)

You design the base visual identity. The shape language, the color palettes, the facet geometry, the fracture line style. This is your brand. This is what makes your collection recognizable.

### Layer 2: Algorithmic Generation (Dynamic)

The protocol generates per-EVO variations from on-chain data. More locked SOL makes the EVO bigger. Older EVOs get more intricate. Traded EVOs get fracture lines. The resonance seed (set at forge) drives color and shape tendencies. No two EVOs look exactly the same.

### Layer 3: Real-Time Effects (Client-Side)

Listed EVOs pulse. Recently fed EVOs flash. Facets shimmer. Inner glow breathes. These are cosmetic and do not affect on-chain data. They make the collection feel alive.

You do not need to build any of this. The rendering happens client-side from on-chain state. Your job is to provide the base design and the palette mappings. The protocol and frontend handle the rest.

### The Manifest Hash

When you create a collection, you can store an `artwork_manifest_hash`. This is a 32-byte hash of your artwork manifest (a document describing your art system, palettes, templates, and rules). It is stored on-chain and is immutable.

This proves that the art system was defined at creation and was not changed later. Collectors can verify that what they see matches what was committed. The `verify_merkle_proof` instruction lets anyone verify that a specific EVO's art matches the manifest.

---

## Step By Step: Launching A Collection

### 1. Design Your Art

Before you touch the protocol, design your visual system. Decide on:
- Base shapes and style
- Color palettes (mapped to resonance seed ranges)
- How many visual stages (if using evolution)
- What each stage looks like
- Fracture line style (what trades look like on the art)

### 2. Choose Your Parameters

Decide on supply cap, mint price, lock amount, royalty, shatter fee, lifecycle type, and randomness policy. Write them down. They are permanent after the first mint.

### 3. Create The Collection

Call `create_collection` with your parameters. Pay the 0.06789 SOL creation fee. Your collection is now live and forgeable.

### 4. If Using CommitReveal

Generate a random secret. Hash it with keccak256. Call `commit_reveal` with the hash. Keep the secret safe. You will need it for the reveal.

### 5. Open Minting

Users call `forge` to mint EVOs. Each pays your mint price (to you) plus the lock amount (into the EVO). The mint price goes to your wallet immediately. The lock amount stays in the EVO forever (until shatter).

### 6. Reveal (If Applicable)

After minting completes, call `reveal_collection` with your secret. The program verifies it matches the committed hash. All EVOs advance from hidden stage to revealed stage.

### 7. Let The Market Work

Owners can now feed, list, trade, evolve, and shatter. You earn royalties on every trade. You earn shatter fees on every shatter. The collection lives on without your intervention.

---

## Revenue Model For Creators

| Event | You Receive |
|---|---|
| Collection creation | You pay 0.06789 SOL (protocol fee) |
| Each mint | mint_price (set by you) |
| Each trade | royalty_bps of sale price (set by you) |
| Each shatter | shatter_fee_bps of locked SOL (set by you) |
| Each feed | Nothing (but it raises the floor, which is good for the collection) |

Your revenue is automatic and on-chain. No invoices, no payment processing, no chasing buyers. The program handles it all.

### Example

You create a collection with:
- Supply cap: 1,000
- Mint price: 0.1 SOL
- Lock amount: 0.5 SOL
- Royalty: 5% (500 bps)
- Shatter fee: 10% (1000 bps)

If all 1,000 mints sell out:
- Mint revenue: 1,000 x 0.1 = 100 SOL
- Total SOL locked in EVOs: 1,000 x 0.5 = 500 SOL
- If average resale is 1 SOL with 5% royalty: 0.05 SOL per trade
- If 100 EVOs shatter at 0.5 SOL each with 10% fee: 0.05 SOL per shatter = 5 SOL

The mint revenue is your upfront income. Royalties and shatter fees are ongoing. The more your collection trades and the longer it lives, the more you earn.

---

## Common Mistakes To Avoid

**Setting the lock amount too high.** If you set 5 SOL lock and 0.1 SOL mint price, buyers pay 5.1 SOL per mint. That is a lot. Most will pass. Start lower. Let feeding raise the floor organically.

**Setting the supply cap too high.** 20,000 is the max. If you set 20,000 and only 200 mint, your collection looks dead. Scarcity is your friend. Start with a lower cap. You cannot increase it later.

**Forgetting the shatter fee.** If you set 0% shatter fee, anyone can shatter for free. This means supply can collapse quickly if the market dumps. A small shatter fee (5-10%) discourages panic shattering and preserves supply.

**Not planning the reveal.** If you use Reveal or CommitReveal, you need to actually reveal. If you forget or lose the secret, EVOs stay hidden forever. Test the reveal flow on devnet first.

**Changing your mind.** Parameters are immutable after the first mint. There is no "oops let me fix that" button. Test on devnet. Get feedback. Then go to mainnet.

---

## Tips For Successful Collections

**Tell a story.** EVOs with narrative trade at a premium. "This was the first EVO ever traded on the platform" is worth more than "EVO #452." The fracture lines (trade history) are visible on the art. Lean into provenance.

**Feed your own EVOs.** As the creator, feeding your EVOs raises their floor. A well-fed creator EVO becomes a status symbol. "The creator put 10 SOL in this one" is a flex.

**Use evolution wisely.** RevealAndEvolve is powerful but complex. EVOs that evolve over weeks or months create ongoing engagement. Owners come back to check on their EVOs. But if you do not have enough visual stages planned, it falls flat.

**Make the base art strong.** The algorithm generates variations, but the base design is yours. If the base is weak, no amount of algorithmic variation will save it. Invest in your visual identity.

**Start small.** A 100-cap collection with a 0.5 SOL lock is a great first collection. It is scarce, it has a real floor, and it is achievable. You can always launch a second collection.

---

## The MELD Terminal

MELD is the terminal where people discover, mint, and trade EVOs. It is the consumer-facing platform. Think of it as the marketplace and gallery for EVO collections. You do not need to do anything special to be on MELD. If your collection is on-chain, it shows up.

MELD renders EVOs using the on-chain visual state. Your art system is interpreted and displayed automatically. No need to upload images to a marketplace. The protocol and the terminal handle it.

---

## Questions Creators Ask

**Can I do a free mint?**
Yes. Set mint price to 0. Buyers still pay the lock amount (which goes into the EVO, not to you). You earn from royalties and shatter fees.

**Can I limit who can mint?**
The protocol itself is permissionless. Anyone can forge. For allowlist mints, you can use the commit-reveal system or build off-chain gating. The Merkle verification instruction supports allowlist proofs.

**Can I have different tiers?**
Not in one collection. Every EVO in a collection has the same lock amount. For tiers, create multiple collections with different parameters.

**Can I update the art after launch?**
You can update the metadata URI. You cannot change the artwork manifest hash (it is immutable). The visual stages are defined by the lifecycle type and cannot be changed after creation.

**What happens if I lose my secret for CommitReveal?**
EVOs stay hidden. There is no recovery. Keep your secret safe. Test on devnet.

---

## Contact

Repo: https://github.com/stephenclawdbot-png/EVO
Terminal: MELD (meldterminal.io)
Authors: naps (@naps000), admiralfinest (@admiralfinest), Benedict A.