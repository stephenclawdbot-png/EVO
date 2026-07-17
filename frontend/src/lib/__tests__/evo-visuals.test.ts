import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  resolveActiveStage,
  resolveActiveImage,
  fetchVisualManifest,
  invalidateManifestCache,
  EvoVisualManifest,
} from '../evo-visuals';

// ─── Fixtures ───────────────────────────────────────────────
const staticManifest: EvoVisualManifest = {
  schema: 'evo-visual-manifest-v1',
  name: 'Static Collection',
  lifecycle: 'static',
  fallback_image: '/fallback.png',
  stages: [
    { id: 0, name: 'Static', image: '/static.png' },
  ],
};

const revealManifest: EvoVisualManifest = {
  schema: 'evo-visual-manifest-v1',
  name: 'Reveal Collection',
  lifecycle: 'reveal',
  fallback_image: '/fallback.png',
  stages: [
    { id: 0, name: 'Pre-Reveal', image: '/hidden.png' },
    { id: 1, name: 'Revealed', image: '/revealed.png' },
  ],
  state: { current_stage: 0 },
};

const revealEvolveManifest: EvoVisualManifest = {
  schema: 'evo-visual-manifest-v1',
  name: 'Reveal & Evolve Collection',
  lifecycle: 'reveal_and_evolve',
  fallback_image: '/fallback.png',
  stages: [
    { id: 0, name: 'Pre-Reveal', image: '/hidden.png' },
    { id: 1, name: 'Revealed', image: '/revealed.png' },
    { id: 2, name: 'Evolved', image: '/evolved.png' },
  ],
  state: { current_stage: 0 },
};

// ─── Tests ───────────────────────────────────────────────────

beforeEach(() => {
  invalidateManifestCache();
});

describe('resolveActiveStage — Static', () => {
  it('always returns stage 0 for static lifecycle', () => {
    const stage = resolveActiveStage(staticManifest);
    expect(stage.id).toBe(0);
    expect(stage.name).toBe('Static');
    expect(stage.image).toBe('/static.png');
  });
});

describe('resolveActiveStage — Reveal', () => {
  it('displays hidden art at stage 0', () => {
    const m = { ...revealManifest, state: { current_stage: 0 } };
    const stage = resolveActiveStage(m);
    expect(stage.id).toBe(0);
    expect(stage.name).toBe('Pre-Reveal');
    expect(stage.image).toBe('/hidden.png');
  });

  it('displays revealed art at stage 1', () => {
    const m = { ...revealManifest, state: { current_stage: 1 } };
    const stage = resolveActiveStage(m);
    expect(stage.id).toBe(1);
    expect(stage.name).toBe('Revealed');
    expect(stage.image).toBe('/revealed.png');
  });
});

describe('resolveActiveStage — Reveal & Evolve', () => {
  it('resolves stage 0 correctly', () => {
    const m = { ...revealEvolveManifest, state: { current_stage: 0 } };
    const stage = resolveActiveStage(m);
    expect(stage.id).toBe(0);
    expect(stage.name).toBe('Pre-Reveal');
    expect(stage.image).toBe('/hidden.png');
  });

  it('resolves stage 1 correctly', () => {
    const m = { ...revealEvolveManifest, state: { current_stage: 1 } };
    const stage = resolveActiveStage(m);
    expect(stage.id).toBe(1);
    expect(stage.name).toBe('Revealed');
    expect(stage.image).toBe('/revealed.png');
  });

  it('resolves stage 2 correctly', () => {
    const m = { ...revealEvolveManifest, state: { current_stage: 2 } };
    const stage = resolveActiveStage(m);
    expect(stage.id).toBe(2);
    expect(stage.name).toBe('Evolved');
    expect(stage.image).toBe('/evolved.png');
  });

  it('clamps to last stage if current_stage exceeds bounds', () => {
    const m = { ...revealEvolveManifest, state: { current_stage: 99 } };
    const stage = resolveActiveStage(m);
    expect(stage.id).toBe(2);
    expect(stage.name).toBe('Evolved');
  });
});

describe('resolveActiveImage — fallback', () => {
  it('uses fallback_image when stage image is missing', () => {
    const m: EvoVisualManifest = {
      ...staticManifest,
      stages: [{ id: 0, name: 'Broken', image: '' }],
      fallback_image: '/fallback.png',
    };
    const img = resolveActiveImage(m);
    expect(img).toBe('/fallback.png');
  });

  it('uses fallback when manifest has no valid stages', () => {
    const m: EvoVisualManifest = {
      schema: 'evo-visual-manifest-v1',
      name: 'Empty',
      lifecycle: 'static',
      fallback_image: '/fallback.png',
      stages: [{ id: 0, name: 'Valid', image: '/valid.png' }],
    };
    const img = resolveActiveImage(m);
    expect(img).toBe('/valid.png');
  });
});

describe('fetchVisualManifest — invalid data', () => {
  it('returns null for empty URI', async () => {
    const result = await fetchVisualManifest('');
    expect(result).toBeNull();
  });

  it('returns null for fetch failure', async () => {
    const result = await fetchVisualManifest('https://nonexistent.invalid/manifest.json');
    expect(result).toBeNull();
  });

  it('returns null for invalid JSON', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ not_a_manifest: true }),
    } as any);
    const result = await fetchVisualManifest('https://example.com/bad.json');
    expect(result).toBeNull();
    vi.restoreAllMocks();
  });

  it('returns null for wrong schema', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ schema: 'something-else', stages: [] }),
    } as any);
    const result = await fetchVisualManifest('https://example.com/wrong.json');
    expect(result).toBeNull();
    vi.restoreAllMocks();
  });
});

describe('fetchVisualManifest — valid data', () => {
  it('parses a valid manifest', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(staticManifest),
    } as any);
    const result = await fetchVisualManifest('https://example.com/valid.json');
    expect(result).not.toBeNull();
    expect(result?.lifecycle).toBe('static');
    expect(result?.stages.length).toBe(1);
    vi.restoreAllMocks();
  });

  it('caches manifest results', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(staticManifest),
    } as any);

    await fetchVisualManifest('https://example.com/cached.json');
    await fetchVisualManifest('https://example.com/cached.json');

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    vi.restoreAllMocks();
  });

  it('invalidates cache on demand', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(staticManifest),
    } as any);

    await fetchVisualManifest('https://example.com/invalidate.json');
    invalidateManifestCache('https://example.com/invalidate.json');
    await fetchVisualManifest('https://example.com/invalidate.json');

    expect(fetchSpy).toHaveBeenCalledTimes(2);
    vi.restoreAllMocks();
  });
});

describe('Existing collections (backward compatibility)', () => {
  it('manifest with no state defaults to stage 0', () => {
    const m: EvoVisualManifest = {
      ...revealManifest,
      state: undefined,
    };
    const stage = resolveActiveStage(m);
    expect(stage.id).toBe(0);
  });

  it('resolveActiveImage never throws on valid manifest', () => {
    expect(() => resolveActiveImage(staticManifest)).not.toThrow();
    expect(() => resolveActiveImage(revealManifest)).not.toThrow();
    expect(() => resolveActiveImage(revealEvolveManifest)).not.toThrow();
  });
});

// ─── On-chain protocol state as source of truth ─────────────

describe('resolveActiveStage — on-chain protocol state', () => {
  it('static: onChainStage ignored, always stage 0', () => {
    const stage = resolveActiveStage(staticManifest, 5, true);
    expect(stage.id).toBe(0);
    expect(stage.image).toBe('/static.png');
  });

  it('reveal: shows pre-reveal when isRevealed=false', () => {
    const stage = resolveActiveStage(revealManifest, 0, false);
    expect(stage.id).toBe(0);
    expect(stage.image).toBe('/hidden.png');
  });

  it('reveal: shows revealed when isRevealed=true', () => {
    const stage = resolveActiveStage(revealManifest, 0, true);
    expect(stage.id).toBe(1);
    expect(stage.image).toBe('/revealed.png');
  });

  it('reveal_and_evolve: uses on-chain current_state directly', () => {
    const stage0 = resolveActiveStage(revealEvolveManifest, 0, false);
    expect(stage0.id).toBe(0);
    expect(stage0.image).toBe('/hidden.png');

    const stage1 = resolveActiveStage(revealEvolveManifest, 1, true);
    expect(stage1.id).toBe(1);
    expect(stage1.image).toBe('/revealed.png');

    const stage2 = resolveActiveStage(revealEvolveManifest, 2, true);
    expect(stage2.id).toBe(2);
    expect(stage2.image).toBe('/evolved.png');
  });

  it('on-chain state overrides manifest state.current_stage', () => {
    // Manifest says stage 0, but on-chain says stage 2
    const m = { ...revealEvolveManifest, state: { current_stage: 0 } };
    const stage = resolveActiveStage(m, 2, true);
    expect(stage.id).toBe(2);
    expect(stage.image).toBe('/evolved.png');
  });

  it('clamps on-chain stage to valid range', () => {
    const stage = resolveActiveStage(revealEvolveManifest, 99, true);
    expect(stage.id).toBe(2);
  });

  it('falls back to manifest state when on-chain params not provided', () => {
    const m = { ...revealEvolveManifest, state: { current_stage: 1 } };
    const stage = resolveActiveStage(m);
    expect(stage.id).toBe(1);
  });
});