# Creator Quickstart — launch a Kitties-style collection in ~30 minutes

No coding needed. Everything happens at **meldterminal.io/create** with your
wallet. This walks you through a 2-stage evolving collection (like Solana Evo
Kitties). Cost: ~0.05 SOL protocol fee + a few cents of storage + rent.

## 1. Prepare your art (before opening the site)
- One image per item per stage. 2 stages × 100 items = 200 PNGs.
- Two folders (or two ZIPs): `state1/` and `state2/`, files numbered the same
  way in both (`1.png … 100.png`).
- ⚠️ **STAGE ORDER MATTERS:** State 1 = what holders see FIRST at mint.
  State 2 = what it EVOLVES into. (Kitties famously ships adult→kitten — on
  purpose. Decide yours on purpose too.)
- Optional traits: a JSON per item (Metaplex-style attributes are understood).

## 2. Fill the create form
| Field | What it means | Kitties-style example |
|---|---|---|
| Name | Permanent, unique, max 32 chars | `My Evo Cats` |
| Supply cap | Immutable forever, 1–20,000 | `900` |
| Mint price | Goes to YOU per mint | `0.1 SOL` |
| Lock amount | Sealed inside each EVO = holder's floor | `0.05 SOL` |
| Shatter fee | % kept when holder redeems (0 = they get full floor back) | `0%` → Burn |
| Royalty | % of every resale | `4.5%` → Creator |
| Lifecycle | `RevealAndEvolve` for evolving art | RevealAndEvolve, 2 stages |
| Evolution thresholds | ALL non-zero ones must be met (AND) | fed ≥ 0.05 SOL, hold 1h, locked ≥ 0.15 SOL |

Threshold tips: `0` = disabled. They're cumulative per stage. Don't set
locked-threshold ≤ lock-amount (it'd be met at mint = gate does nothing).

## 3. Upload art (bulk uploader on the same page)
Drop each ZIP on its stage zone. The uploader pays Irys storage from your
wallet (it shows the estimate first), retries failures, and builds your
manifest automatically. Add a logo + pre-reveal mystery image if you like.

## 4. Create
Click create, sign once. That's your collection live at
`meldterminal.io/c/YourName` — mint page at `/c/YourName/forge`.
Nothing else to run. Anyone can now forge.

## 5. After launch (admin page: `/admin?collection=YourName`)
- **Reveal** when ready (RevealAndEvolve starts hidden).
- Holders feed/evolve/trade/shatter on their own — the protocol enforces
  everything you set. You never touch it again.
- Economics you CANNOT change later: supply, prices, fees, thresholds.
  Only the metadata URI can be updated (fix art links).

## Manifest example (the uploader makes this for you — shown for reference)
```json
{
  "name": "My Evo Cats",
  "image": "https://gateway.irys.xyz/<cover>",
  "lifecycle": { "maxStates": 2, "stateNames": ["Kitten", "Evolved"] },
  "items": [
    { "index": 0, "name": "My Evo Cats #0001",
      "traits": { "Breed": "Tabby", "Background": "Space" },
      "states": ["https://gateway.irys.xyz/<stage1>", "https://gateway.irys.xyz/<stage2>"] }
  ]
}
```

## FAQ
- **Where does holders' locked SOL live?** Inside each EVO's own on-chain
  account. You never hold it; you can't touch it.
- **What do I earn?** Mint price per forge + royalty per resale, straight to
  your wallet, enforced on-chain.
- **Can holders lose their floor?** Only by choosing to shatter (they receive
  it) — worst case for them is defined on the form you filled.

Questions → @naps000 on X.
