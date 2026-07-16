# @evo/renderer

Canvas-based generative art renderer for EVOs. Wallets use this to display EVO art from on-chain data — no images stored, art computed client-side.

## Install

```bash
npm install @evo/renderer @evo/sdk
```

## Quick Start

```typescript
import { renderEvo } from '@evo/renderer';
import { EvoClient, Connection } from '@evo/sdk';

const client = new EvoClient(connection);
const evo = await client.getEvo('Z', 42);

if (evo) {
  const canvas = document.getElementById('evo-canvas') as HTMLCanvasElement;
  renderEvo(canvas, evo, { width: 256, height: 256 });
}
```

## API

### `renderEvo(canvas, evo, options?)`

Renders an EVO onto a canvas element.

| Option | Default | Description |
|---|---|---|
| `width` | 256 | Canvas width |
| `height` | 256 | Canvas height |
| `lod` | 1 | Level of detail (0.3 for thumbnails) |
| `showFractureLabels` | false | Show #1, #2 labels on fracture lines |
| `background` | null | Background color (null = transparent) |

### `renderEvoDataURL(evo, options?)`

Returns a base64 PNG data URL. Useful for notification previews.

### `renderEvoThumbnail(evo, size?)`

Returns a small thumbnail data URL (default 64x64).

## How It Works

The renderer computes art entirely from on-chain data:

- **resonanceSeed** → determines color palette and element type
- **lockedLamports** → gem size (more SOL = bigger)
- **facetCount** → number of crystalline facets (evolution stage)
- **fractureLines** → permanent trade scars rendered as cracks
- **isListed** → green badge indicator
- **isShattered** → shattered visual state

No images are fetched. Everything is drawn with canvas primitives.

## License

MIT