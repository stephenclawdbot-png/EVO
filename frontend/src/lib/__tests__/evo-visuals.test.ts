import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  resolveActiveStage,
  resolveActiveStageNumber,
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

// Per-EVO image template manifest (3,000 unique EVOs example)
const templateManifest: EvoVisualManifest = {
  schema: 'evo-visual-manifest-v1',
  name: '3000 Unique Collection',
  lifecycle: 'static',
  fallback_image: '/fallback.png',
  image_template: 'https://arweave.net/{id}.png',
  stages: [],
};

// Per-EVO + per-stage image template manifest
const templateStageManifest: EvoVisualManifest = {
  schema: 'evo-visual-manifest-v1',
  name: 'Multi-Stage Unique Collection',
  lifecycle: 'reveal_and_evolve',
  fallback_image: '/fallback.png',
  image_template: 'https://arweave.net/{id}/stage{stage}.png',
  stages: [
    { id: 0, name: 'Baby', image: '/default-baby.png' },
    { id: 1, name: 'Juvenile', image: '/default-juvenile.png' },
    { id: 2, name: 'Adult', image: '/default-adult.png' },
  ],
};

// ─── Tests ───────────────────────────────────────────────────

beforeEach(() => {
  invalidateManifestCache();
});

describe('resolveActiveStage — Static', () => {
  it('always returns stage 0 for static lifecycle', () => {
    const stage = resolveActiveStage(staticManifest);
    expect(stage).not.toBeNull();
    expect(stage!.id).toBe(0);
    expect(stage!.name).toBe('Static');
    expect(stage!.image).toBe('/static.png');
  });
});

describe('resolveActiveStage — Reveal', () => {
  it('displays hidden art at stage 0', () => {
    const m = { ...revealManifest, state: { current_stage: 0 } };
    const stage = resolveActiveStage(m);
    expect(stage).not.toBeNull();
    expect(stage!.id).toBe(0);
    expect(stage!.name).toBe('Pre-Reveal');
    expect(stage!.image).toBe('/hidden.png');
  });

  it('displays revealed art at stage 1', () => {
    const m = { ...revealManifest, state: { current_stage: 1 } };
    const stage = resolveActiveStage(m);
    expect(stage).not.toBeNull();
    expect(stage!.id).toBe(1);
    expect(stage!.name).toBe('Revealed');
    expect(stage!.image).toBe('/revealed.png');
  });
});

describe('resolveActiveStage — Reveal & Evolve', () => {
  it('resolves stage 0 correctly', () => {
    const m = { ...revealEvolveManifest, state: { current_stage: 0 } };
    const stage = resolveActiveStage(m);
    expect(stage).not.toBeNull();
    expect(stage!.id).toBe(0);
    expect(stage!.name).toBe('Pre-Reveal');
    expect(stage!.image).toBe('/hidden.png');
  });

  it('resolves stage 1 correctly', () => {
    const m = { ...revealEvolveManifest, state: { current_stage: 1 } };
    const stage = resolveActiveStage(m);
    expect(stage).not.toBeNull();
    expect(stage!.id).toBe(1);
    expect(stage!.name).toBe('Revealed');
    expect(stage!.image).toBe('/revealed.png');
  });

  it('resolves stage 2 correctly', () => {
    const m = { ...revealEvolveManifest, state: { current_stage: 2 } };
    const stage = resolveActiveStage(m);
    expect(stage).not.toBeNull();
    expect(stage!.id).toBe(2);
    expect(stage!.name).toBe('Evolved');
    expect(stage!.image).toBe('/evolved.png');
  });

  it('clamps to last stage if current_stage exceeds bounds', () => {
    const m = { ...revealEvolveManifest, state: { current_stage: 99 } };
    const stage = resolveActiveStage(m);
    expect(stage).not.toBeNull();
    expect(stage!.id).toBe(2);
    expect(stage!.name).toBe('Evolved');
  });
});

describe('resolveActiveStage — null when no stages', () => {
  it('returns null for template-only manifest (no stages array)', () => {
    const stage = resolveActiveStage(templateManifest);
    expect(stage).toBeNull();
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

  it('uses stage image when manifest has valid stages', () => {
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

describe('resolveActiveImage — image_template (per-EVO)', () => {
  it('resolves {id} to evoId', () => {
    const img = resolveActiveImage(templateManifest, 42);
    expect(img).toBe('https://arweave.net/42.png');
  });

  it('resolves {id} to evoId 0', () => {
    const img = resolveActiveImage(templateManifest, 0);
    expect(img).toBe('https://arweave.net/0.png');
  });

  it('resolves {id} to evoId 2999 (large collection)', () => {
    const img = resolveActiveImage(templateManifest, 2999);
    expect(img).toBe('https://arweave.net/2999.png');
  });

  it('falls back to fallback_image when evoId is undefined and template has {id}', () => {
    const img = resolveActiveImage(templateManifest, undefined);
    // When evoId is undefined, {id} is not replaced — URL still contains {id}
    // This is technically invalid but we don't crash
    expect(img).toBe('https://arweave.net/{id}.png');
  });

  it('image_template takes priority over stages[].image', () => {
    const m: EvoVisualManifest = {
      schema: 'evo-visual-manifest-v1',
      name: 'Mixed',
      lifecycle: 'static',
      fallback_image: '/fallback.png',
      image_template: 'https://arweave.net/{id}.png',
      stages: [{ id: 0, name: 'Default', image: '/default.png' }],
    };
    const img = resolveActiveImage(m, 7);
    expect(img).toBe('https://arweave.net/7.png');
  });
});

describe('resolveActiveImage — image_template with {stage}', () => {
  it('resolves both {id} and {stage}', () => {
    const img = resolveActiveImage(templateStageManifest, 15, 2, true);
    expect(img).toBe('https://arweave.net/15/stage2.png');
  });

  it('resolves {stage} for reveal lifecycle (isRevealed controls stage)', () => {
    const revealStageManifest: EvoVisualManifest = {
      schema: 'evo-visual-manifest-v1',
      name: 'Reveal Stage Collection',
      lifecycle: 'reveal',
      fallback_image: '/fallback.png',
      image_template: 'https://arweave.net/{id}/stage{stage}.png',
      stages: [
        { id: 0, name: 'Hidden', image: '/hidden.png' },
        { id: 1, name: 'Revealed', image: '/revealed.png' },
      ],
    };
    const img = resolveActiveImage(revealStageManifest, 5, undefined, true);
    expect(img).toBe('https://arweave.net/5/stage1.png');
  });

  it('resolves {stage} 0 when not revealed', () => {
    const img = resolveActiveImage(templateStageManifest, 5, undefined, false);
    expect(img).toBe('https://arweave.net/5/stage0.png');
  });

  it('resolves {stage} directly from onChainStage for reveal_and_evolve', () => {
    const img = resolveActiveImage(templateStageManifest, 100, 2, true);
    expect(img).toBe('https://arweave.net/100/stage2.png');
  });
});

describe('resolveActiveStageNumber', () => {
  it('returns 0 for static lifecycle', () => {
    expect(resolveActiveStageNumber(staticManifest, 5, true)).toBe(0);
  });

  it('returns 1 for reveal lifecycle when revealed', () => {
    expect(resolveActiveStageNumber(revealManifest, 0, true)).toBe(1);
  });

  it('returns 0 for reveal lifecycle when not revealed', () => {
    expect(resolveActiveStageNumber(revealManifest, 0, false)).toBe(0);
  });

  it('uses onChainStage directly for reveal_and_evolve', () => {
    expect(resolveActiveStageNumber(revealEvolveManifest, 2, true)).toBe(2);
  });

  it('falls back to manifest state.current_stage when on-chain params undefined', () => {
    const m = { ...revealEvolveManifest, state: { current_stage: 1 } };
    expect(resolveActiveStageNumber(m)).toBe(1);
  });

  it('defaults to 0 when no state and no on-chain params', () => {
    const m = { ...revealEvolveManifest, state: undefined };
    expect(resolveActiveStageNumber(m)).toBe(0);
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

  it('parses a valid manifest with image_template', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(templateManifest),
    } as any);
    const result = await fetchVisualManifest('https://example.com/template.json');
    expect(result).not.toBeNull();
    expect(result?.image_template).toBe('https://arweave.net/{id}.png');
    expect(result?.stages).toEqual([]);
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
    expect(stage).not.toBeNull();
    expect(stage!.id).toBe(0);
  });

  it('resolveActiveImage never throws on valid manifest', () => {
    expect(() => resolveActiveImage(staticManifest)).not.toThrow();
    expect(() => resolveActiveImage(revealManifest)).not.toThrow();
    expect(() => resolveActiveImage(revealEvolveManifest)).not.toThrow();
  });

  it('manifest without image_template uses stages (backward compat)', () => {
    const img = resolveActiveImage(revealEvolveManifest, 42, 2, true);
    expect(img).toBe('/evolved.png');
  });
});

// ─── On-chain protocol state as source of truth ─────────────

describe('resolveActiveStage — on-chain protocol state', () => {
  it('static: onChainStage ignored, always stage 0', () => {
    const stage = resolveActiveStage(staticManifest, 5, true);
    expect(stage).not.toBeNull();
    expect(stage!.id).toBe(0);
    expect(stage!.image).toBe('/static.png');
  });

  it('reveal: shows pre-reveal when isRevealed=false', () => {
    const stage = resolveActiveStage(revealManifest, 0, false);
    expect(stage).not.toBeNull();
    expect(stage!.id).toBe(0);
    expect(stage!.image).toBe('/hidden.png');
  });

  it('reveal: shows revealed when isRevealed=true', () => {
    const stage = resolveActiveStage(revealManifest, 0, true);
    expect(stage).not.toBeNull();
    expect(stage!.id).toBe(1);
    expect(stage!.image).toBe('/revealed.png');
  });

  it('reveal_and_evolve: uses on-chain current_state directly', () => {
    const stage0 = resolveActiveStage(revealEvolveManifest, 0, false);
    expect(stage0).not.toBeNull();
    expect(stage0!.id).toBe(0);
    expect(stage0!.image).toBe('/hidden.png');

    const stage1 = resolveActiveStage(revealEvolveManifest, 1, true);
    expect(stage1).not.toBeNull();
    expect(stage1!.id).toBe(1);
    expect(stage1!.image).toBe('/revealed.png');

    const stage2 = resolveActiveStage(revealEvolveManifest, 2, true);
    expect(stage2).not.toBeNull();
    expect(stage2!.id).toBe(2);
    expect(stage2!.image).toBe('/evolved.png');
  });

  it('on-chain state overrides manifest state.current_stage', () => {
    const m = { ...revealEvolveManifest, state: { current_stage: 0 } };
    const stage = resolveActiveStage(m, 2, true);
    expect(stage).not.toBeNull();
    expect(stage!.id).toBe(2);
    expect(stage!.image).toBe('/evolved.png');
  });

  it('clamps on-chain stage to valid range', () => {
    const stage = resolveActiveStage(revealEvolveManifest, 99, true);
    expect(stage).not.toBeNull();
    expect(stage!.id).toBe(2);
  });

  it('falls back to manifest state when on-chain params not provided', () => {
    const m = { ...revealEvolveManifest, state: { current_stage: 1 } };
    const stage = resolveActiveStage(m);
    expect(stage).not.toBeNull();
    expect(stage!.id).toBe(1);
  });
});