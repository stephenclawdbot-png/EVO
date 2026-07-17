# EVO Packages

Open-source SDK and renderer for wallet integration.

## Packages

| Package | Path | Purpose |
|---|---|---|
| `@evo/sdk` | [`evo-sdk/`](./evo-sdk/) | TypeScript SDK — read EVO accounts from Solana |
| `@evo/renderer` | [`evo-renderer/`](./evo-renderer/) | Canvas-based generative art renderer |

## For Wallet Developers

See [`docs/10-wallet-integration.md`](../docs/10-wallet-integration.md) for a 30-minute integration guide.

```bash
npm install @evo/sdk @evo/renderer
```

## For z.fun

The z.fun frontend uses these same packages internally. When the Solana program is deployed, the placeholder program ID in `evo-sdk/src/constants.ts` gets replaced with the real one, and everything connects.

## Status

- [x] SDK types and account layout
- [x] Binary deserialization
- [x] PDA derivation
- [x] EvoClient (findByOwner, getEvo, getCollectionEvos, getCollectionConfig)
- [x] Display helpers (stage, age, SOL conversion)
- [x] Canvas renderer (facets, glow, fracture lines, shattered state)
- [x] Real program ID (devnet: 7USTJBsRTmCnjowPgmh6s5igTZeaFPE7X43rZnhmm5sc)
- [x] Real account discriminators (EVOAccount, CollectionConfig, ProtocolConfig)
- [x] Real instruction discriminators (all 15 instructions)
- [x] Write instruction builders (forge, feed, list, delist, buy, shatter, transfer, evolve, etc.)
- [x] Wallet integration docs (Phantom, Solflare, Backpack)
- [x] Marketplace integration docs (OpenSea, Magic Eden)
- [x] Telegram bot integration docs (gmgn, fomo, bloom)
- [ ] npm publish (after mainnet launch)
- [ ] Mainnet program ID (after mainnet deployment)