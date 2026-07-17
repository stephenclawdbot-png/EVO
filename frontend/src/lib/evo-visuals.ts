// EVO Visual Lifecycle Resolver
// Fetches a collection manifest from metadata_uri, resolves the active stage/image.
// The on-chain protocol state (EVOAccount.current_state + CollectionConfig.is_revealed)
// is the source of truth for the current stage. The manifest only maps stage IDs to images.
// Never crashes the marketplace — always falls back to fallback_image or a provided default.

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
  if (!Array.isArray(m.stages) || m.stages.length === 0) return false;
  for (const s of m.stages) {
    if (!s || typeof s !== 'object') return false;
    const st = s as Record<string, unknown>;
    if (typeof st.id !== 'number') return false;
    if (typeof st.name !== 'string') return false;
    if (typeof st.image !== 'string' || !st.image) return false;
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
 * Resolve the active visual stage using protocol state as source of truth.
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
export function resolveActiveStage(
  manifest: EvoVisualManifest,
  onChainStage?: number,
  isRevealed?: boolean,
): EvoVisualStage {
  let currentStage: number;

  if (onChainStage !== undefined) {
    // Protocol is source of truth
    if (manifest.lifecycle === 'reveal') {
      // For Reveal lifecycle: stage 0 = pre-reveal, stage 1 = revealed
      // isRevealed flag determines which stage to show
      currentStage = isRevealed ? 1 : 0;
    } else {
      // For static and reveal_and_evolve: use on-chain current_state directly
      currentStage = onChainStage;
    }
  } else {
    // Fallback to manifest state (backward compat)
    currentStage = manifest.state?.current_stage ?? 0;
  }

  // Clamp to valid range
  const idx = Math.min(currentStage, manifest.stages.length - 1);
  return manifest.stages[Math.max(0, idx)];
}

export function resolveActiveImage(
  manifest: EvoVisualManifest,
  onChainStage?: number,
  isRevealed?: boolean,
): string {
  try {
    const stage = resolveActiveStage(manifest, onChainStage, isRevealed);
    if (stage && stage.image) return stage.image;
  } catch {
    // fall through
  }
  return manifest.fallback_image;
}

// ─── Safe resolve with fallback ─────────────────────────────
/**
 * Resolve the active image for an EVO.
 * Uses on-chain protocol state when available, falls back to manifest state.
 */
export async function resolveImage(
  metadataUri: string,
  fallback: string,
  onChainStage?: number,
  isRevealed?: boolean,
): Promise<string> {
  const manifest = await fetchVisualManifest(metadataUri);
  if (!manifest) return fallback;
  return resolveActiveImage(manifest, onChainStage, isRevealed);
}

// ─── Manifest cache invalidation ─────────────────────────────
export function invalidateManifestCache(metadataUri?: string): void {
  if (metadataUri) {
    manifestCache.delete(metadataUri);
  } else {
    manifestCache.clear();
  }
}