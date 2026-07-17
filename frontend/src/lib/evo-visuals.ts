// EVO Visual Lifecycle Resolver
// Fetches a collection manifest from metadata_uri, resolves the active stage/image.
// The on-chain protocol state (EVOAccount.current_state + CollectionConfig.is_revealed)
// is the source of truth for the current stage. The manifest only maps stage IDs to images.
// Never crashes the marketplace — always falls back to fallback_image or a provided default.
//
// Manifest v1 supports two image resolution modes:
//   1. Per-stage:   stages[].image        — one image per stage (all EVOs share it)
//   2. Per-EVO:     image_template        — URL pattern with {id} (and optional {stage})
//      e.g. "https://arweave.net/{id}.png"           → per-EVO static art
//      e.g. "https://arweave.net/{id}/stage{stage}.png" → per-EVO multi-stage art
// When image_template is present it takes priority over stages[].image.

export type EvoLifecycle = 'static' | 'reveal' | 'reveal_and_evolve';

export interface EvoVisualStage {
  id: number;
  name: string;
  image: string;
}

export interface EvoVisualManifest {
  schema: 'evo-visual-manifest-v1';
  name: string;
  description?: string;
  lifecycle: EvoLifecycle;
  fallback_image: string;
  /** Per-EVO image URL template. Supports {id} (mint index) and {stage} (lifecycle stage). */
  image_template?: string;
  stages: EvoVisualStage[];
  state?: {
    current_stage: number;
  };
}

// ─── Cache ───────────────────────────────────────────────────
const manifestCache = new Map<string, { manifest: EvoVisualManifest; ts: number }>();
const CACHE_TTL_MS = 60_000; // 1 minute

// ─── Validation ──────────────────────────────────────────────
function isValidManifest(raw: unknown): raw is EvoVisualManifest {
  if (!raw || typeof raw !== 'object') return false;
  const m = raw as Record<string, unknown>;
  if (m.schema !== 'evo-visual-manifest-v1') return false;
  if (typeof m.name !== 'string') return false;
  if (typeof m.fallback_image !== 'string' || !m.fallback_image) return false;
  if (m.lifecycle !== 'static' && m.lifecycle !== 'reveal' && m.lifecycle !== 'reveal_and_evolve') return false;
  if (m.image_template !== undefined && typeof m.image_template !== 'string') return false;
  // stages is optional when image_template is present, required otherwise
  if (m.image_template === undefined) {
    if (!Array.isArray(m.stages) || m.stages.length === 0) return false;
  } else {
    // When image_template present, stages can be empty or absent
    if (m.stages !== undefined && (!Array.isArray(m.stages))) return false;
  }
  if (Array.isArray(m.stages)) {
    for (const s of m.stages) {
      if (!s || typeof s !== 'object') return false;
      const st = s as Record<string, unknown>;
      if (typeof st.id !== 'number') return false;
      if (typeof st.name !== 'string') return false;
      if (typeof st.image !== 'string' || !st.image) return false;
    }
  }
  if (m.state !== undefined) {
    if (!m.state || typeof m.state !== 'object') return false;
    const st = m.state as Record<string, unknown>;
    if (typeof st.current_stage !== 'number') return false;
  }
  return true;
}

// ─── Fetch ───────────────────────────────────────────────────
export async function fetchVisualManifest(
  metadataUri: string,
): Promise<EvoVisualManifest | null> {
  if (!metadataUri) return null;

  // Check cache
  const cached = manifestCache.get(metadataUri);
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
    return cached.manifest;
  }

  try {
    const res = await fetch(metadataUri, { cache: 'no-store' });
    if (!res.ok) return null;
    const data = await res.json();
    if (!isValidManifest(data)) return null;
    manifestCache.set(metadataUri, { manifest: data, ts: Date.now() });
    return data;
  } catch {
    return null;
  }
}

/**
 * Resolve the active stage number using protocol state as source of truth.
 *
 * @param manifest - The visual manifest from metadata_uri
 * @param onChainStage - The EVO's current_state from the on-chain EVOAccount (protocol source of truth)
 * @param isRevealed - The collection's is_revealed flag from on-chain CollectionConfig
 *
 * For `static`: always stage 0.
 * For `reveal`: stage 0 if not revealed, stage 1 if revealed.
 * For `reveal_and_evolve`: onChainStage directly (already includes reveal offset).
 * Falls back to manifest.state.current_stage if on-chain params not provided.
 */
export function resolveActiveStageNumber(
  manifest: EvoVisualManifest,
  onChainStage?: number,
  isRevealed?: boolean,
): number {
  if (manifest.lifecycle === 'reveal' && isRevealed !== undefined) {
    return isRevealed ? 1 : 0;
  }
  if (onChainStage !== undefined) {
    if (manifest.lifecycle === 'static') return 0;
    return onChainStage;
  }
  return manifest.state?.current_stage ?? 0;
}

/**
 * Resolve the active visual stage using protocol state as source of truth.
 */
export function resolveActiveStage(
  manifest: EvoVisualManifest,
  onChainStage?: number,
  isRevealed?: boolean,
): EvoVisualStage | null {
  const currentStage = resolveActiveStageNumber(manifest, onChainStage, isRevealed);

  if (!manifest.stages || manifest.stages.length === 0) return null;

  const idx = Math.min(currentStage, manifest.stages.length - 1);
  return manifest.stages[Math.max(0, idx)];
}

/**
 * Resolve the active image for a specific EVO.
 *
 * Priority:
 *   1. image_template with {id} and/or {stage} resolved → per-EVO image
 *   2. stages[activeStage].image → per-stage image
 *   3. fallback_image
 *
 * @param manifest - The visual manifest from metadata_uri
 * @param evoId - The EVO's mint index (0-based, used for {id} resolution)
 * @param onChainStage - The EVO's current_state from chain (protocol source of truth)
 * @param isRevealed - The collection's is_revealed flag
 */
export function resolveActiveImage(
  manifest: EvoVisualManifest,
  evoId?: number,
  onChainStage?: number,
  isRevealed?: boolean,
): string {
  const stageNum = resolveActiveStageNumber(manifest, onChainStage, isRevealed);

  // 1. Per-EVO template — highest priority
  if (manifest.image_template) {
    let url = manifest.image_template;
    if (evoId !== undefined) {
      url = url.replace(/\{id\}/g, String(evoId));
    }
    url = url.replace(/\{stage\}/g, String(stageNum));
    return url;
  }

  // 2. Per-stage image
  try {
    const stage = resolveActiveStage(manifest, onChainStage, isRevealed);
    if (stage && stage.image) return stage.image;
  } catch {
    // fall through
  }

  // 3. Fallback
  return manifest.fallback_image;
}

// ─── Safe resolve with fallback ─────────────────────────────
/**
 * Resolve the active image for an EVO.
 * Uses on-chain protocol state when available, falls back to manifest state.
 *
 * @param metadataUri - The collection's on-chain metadata_uri
 * @param fallback - Fallback image if manifest can't be fetched or is invalid
 * @param onChainStage - The EVO's current_state from chain
 * @param isRevealed - The collection's is_revealed flag
 * @param evoId - The EVO's mint index (for per-EVO image_template resolution)
 */
export async function resolveImage(
  metadataUri: string,
  fallback: string,
  onChainStage?: number,
  isRevealed?: boolean,
  evoId?: number,
): Promise<string> {
  const manifest = await fetchVisualManifest(metadataUri);
  if (!manifest) return fallback;
  return resolveActiveImage(manifest, evoId, onChainStage, isRevealed);
}

// ─── Manifest cache invalidation ─────────────────────────────
export function invalidateManifestCache(metadataUri?: string): void {
  if (metadataUri) {
    manifestCache.delete(metadataUri);
  } else {
    manifestCache.clear();
  }
}