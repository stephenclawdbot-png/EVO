// @evo/renderer — Canvas-based generative art renderer for EVOs
// Wallets import this to render EVO art from on-chain data.
// import { renderEvo } from '@evo/renderer'

import { EVOAccount, EvoStage } from '@evo/sdk';

export interface RenderOptions {
  /** Canvas width in pixels (default 256) */
  width?: number;
  /** Canvas height in pixels (default 256) */
  height?: number;
  /** Level of detail: fewer facets for thumbnails (default 1 = full) */
  lod?: number;
  /** Whether to show fracture line labels (#1, #2, etc.) */
  showFractureLabels?: boolean;
  /** Background color (default transparent) */
  background?: string | null;
}

/** Element colors derived from resonance seed */
const ELEMENT_PALETTE: Record<string, [number, number, number]> = {
  Terra: [139, 90, 43],
  Aqua: [64, 164, 223],
  Flora: [80, 200, 120],
  Ignis: [255, 100, 50],
  Aero: [180, 200, 220],
  Void: [138, 43, 226],
  Lux: [255, 215, 0],
};

/** Deterministic hash from a hex string */
function seedHash(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = ((h << 5) - h) + seed.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

/** Seeded PRNG (mulberry32) */
function mulberry32(seed: number): () => number {
  return () => {
    seed |= 0;
    seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Derive an element type from the resonance seed */
function deriveElement(seed: string): string {
  const elements = Object.keys(ELEMENT_PALETTE);
  return elements[seedHash(seed) % elements.length];
}

/** Derive a color from the resonance seed + element */
function deriveColor(seed: string, facetCount: number): [number, number, number] {
  const element = deriveElement(seed);
  const base = ELEMENT_PALETTE[element];
  const rng = mulberry32(seedHash(seed));

  // Shift hue based on facet count (more facets = more vibrant)
  const vibrancy = 0.3 + (facetCount / 100) * 0.7;
  return [
    Math.min(255, Math.round(base[0] * vibrancy + rng() * 30)),
    Math.min(255, Math.round(base[1] * vibrancy + rng() * 30)),
    Math.min(255, Math.round(base[2] * vibrancy + rng() * 30)),
  ];
}

/**
 * Render an EVO to a canvas element.
 * This is the core function wallets call to display EVO art.
 *
 * @param canvas - An HTMLCanvasElement to render onto
 * @param evo - The EVO account data from @evo/sdk
 * @param options - Render options
 */
export function renderEvo(
  canvas: HTMLCanvasElement,
  evo: EVOAccount,
  options: RenderOptions = {},
): void {
  const {
    width = 256,
    height = 256,
    lod = 1,
    showFractureLabels = false,
    background = null,
  } = options;

  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  ctx.clearRect(0, 0, width, height);

  if (background) {
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, width, height);
  }

  if (evo.isShattered) {
    renderShattered(ctx, width, height);
    return;
  }

  const cx = width / 2;
  const cy = height / 2;
  const baseRadius = Math.min(width, height) * 0.35;

  // Scale by locked SOL (more SOL = bigger gem)
  const solScale = 0.6 + Math.min(1.4, Math.log10(evo.lockedLamports / 1e9 + 1) * 0.3);
  const radius = baseRadius * solScale;

  const color = deriveColor(evo.resonanceSeed, evo.facetCount);
  const rng = mulberry32(seedHash(evo.resonanceSeed));

  // Render facets as a crystalline polygon
  const facetCount = Math.max(3, Math.floor(evo.facetCount * lod));
  const vertices: [number, number][] = [];

  for (let i = 0; i < facetCount; i++) {
    const angle = (i / facetCount) * Math.PI * 2;
    const r = radius * (0.8 + rng() * 0.4);
    vertices.push([cx + Math.cos(angle) * r, cy + Math.sin(angle) * r]);
  }

  // Fill gem body with gradient
  const gradient = ctx.createRadialGradient(cx - radius * 0.3, cy - radius * 0.3, 0, cx, cy, radius);
  gradient.addColorStop(0, `rgba(${color[0] + 60}, ${color[1] + 60}, ${color[2] + 60}, 0.9)`);
  gradient.addColorStop(0.6, `rgba(${color[0]}, ${color[1]}, ${color[2]}, 0.85)`);
  gradient.addColorStop(1, `rgba(${Math.max(0, color[0] - 40)}, ${Math.max(0, color[1] - 40)}, ${Math.max(0, color[2] - 40)}, 0.8)`);

  ctx.beginPath();
  vertices.forEach(([x, y], i) => {
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.closePath();
  ctx.fillStyle = gradient;
  ctx.fill();

  // Facet lines (internal crystalline structure)
  ctx.strokeStyle = `rgba(255, 255, 255, 0.15)`;
  ctx.lineWidth = 1;
  for (let i = 0; i < vertices.length; i++) {
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(vertices[i][0], vertices[i][1]);
    ctx.stroke();
  }

  // Outer outline
  ctx.strokeStyle = `rgba(255, 255, 255, 0.4)`;
  ctx.lineWidth = 2;
  ctx.beginPath();
  vertices.forEach(([x, y], i) => {
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.closePath();
  ctx.stroke();

  // Glow effect proportional to locked SOL
  const glowRadius = radius * (1.2 + solScale * 0.3);
  const glowGradient = ctx.createRadialGradient(cx, cy, radius, cx, cy, glowRadius);
  glowGradient.addColorStop(0, `rgba(${color[0]}, ${color[1]}, ${color[2]}, 0.3)`);
  glowGradient.addColorStop(1, `rgba(${color[0]}, ${color[1]}, ${color[2]}, 0)`);
  ctx.beginPath();
  ctx.arc(cx, cy, glowRadius, 0, Math.PI * 2);
  ctx.fillStyle = glowGradient;
  ctx.fill();

  // Fracture lines (trade scars)
  if (evo.fractureLines.length > 0) {
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.lineWidth = 1.5;
    for (const fl of evo.fractureLines) {
      const angle = (fl.position / 360) * Math.PI * 2;
      const intensity = fl.intensity / 100;
      const startX = cx + Math.cos(angle) * radius * 0.2;
      const startY = cy + Math.sin(angle) * radius * 0.2;
      const endX = cx + Math.cos(angle) * radius * (0.8 + intensity * 0.2);
      const endY = cy + Math.sin(angle) * radius * (0.8 + intensity * 0.2);

      ctx.beginPath();
      ctx.moveTo(startX, startY);
      ctx.lineTo(endX, endY);
      ctx.stroke();

      if (showFractureLabels) {
        const labelX = cx + Math.cos(angle) * radius * 1.15;
        const labelY = cy + Math.sin(angle) * radius * 1.15;
        ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
        ctx.font = '10px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(`#${fl.tradeNumber}`, labelX, labelY);
      }
    }
  }

  // Listed badge
  if (evo.isListed) {
    ctx.fillStyle = 'rgba(80, 200, 120, 0.9)';
    ctx.beginPath();
    ctx.arc(width - 20, 20, 8, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** Render a shattered (destroyed) EVO */
function renderShattered(ctx: CanvasRenderingContext2D, width: number, height: number): void {
  const cx = width / 2;
  const cy = height / 2;
  const rng = mulberry32(42);

  ctx.strokeStyle = 'rgba(120, 120, 120, 0.3)';
  ctx.lineWidth = 1;
  for (let i = 0; i < 8; i++) {
    const angle = rng() * Math.PI * 2;
    const r1 = 10 + rng() * 30;
    const r2 = r1 + 20 + rng() * 40;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(angle) * r1, cy + Math.sin(angle) * r1);
    ctx.lineTo(cx + Math.cos(angle) * r2, cy + Math.sin(angle) * r2);
    ctx.stroke();
  }

  ctx.fillStyle = 'rgba(150, 150, 150, 0.5)';
  ctx.font = '12px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('SHATTERED', cx, cy);
}

/**
 * Render an EVO to a data URL (base64 PNG).
 * Useful for wallets that can't use canvas directly (e.g. notification previews).
 */
export function renderEvoDataURL(evo: EVOAccount, options: RenderOptions = {}): string {
  const canvas = document.createElement('canvas');
  renderEvo(canvas, evo, options);
  return canvas.toDataURL('image/png');
}

/**
 * Render a small thumbnail (64x64) for list views.
 */
export function renderEvoThumbnail(evo: EVOAccount, size = 64): string {
  return renderEvoDataURL(evo, { width: size, height: size, lod: 0.3, showFractureLabels: false });
}