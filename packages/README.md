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
- [x] EvoClient (findByOwner, getEvo, getCollectionEvos)
- [x] Display helpers (stage, age, SOL conversion)
- [x] Canvas renderer (facets, glow, fracture lines, shattered state)
- [ ] npm publish (after program deployment)
- [ ] Real discriminators (after program deployment)
- [ ] Real program ID (after mainnet deployment)