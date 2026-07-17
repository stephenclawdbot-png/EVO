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

/** Per-EVO artwork provenance entry — binds EVO #id to an exact image file hash. */
export interface EvoProvenanceEntry {
  id: number;
  hash: string; // SHA-256 hex of the image file
}

/** Optional provenance section in the manifest for per-EVO image verification. */
export interface EvoProvenance {
  /** Per-EVO image hashes (for collections with unique art per item). */
  items?: EvoProvenanceEntry[];
  /** Merkle root of all image hashes (compact alternative to items[]). */
  merkle_root?: string;
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
  /** Optional provenance for per-EVO image hash verification. */
  provenance?: EvoProvenance;
}

// ─── Manifest Verification ──────────────────────────────────
export type VerificationStatus = 'verified' | 'mismatch' | 'no-hash' | 'unchecked';

export interface ManifestVerification {
  status: VerificationStatus;
  /** On-chain expected hash (hex), if committed. */
  expectedHash?: string;
  /** Actual hash of the fetched manifest (hex). */
  actualHash?: string;
}

export interface ImageVerification {
  status: VerificationStatus;
  /** Expected hash from manifest provenance (hex). */
  expectedHash?: string;
  /** Actual hash of the fetched image (hex). */
  actualHash?: string;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

function isZeroHash(bytes: Uint8Array): boolean {
  return bytes.every(b => b === 0);
}

async function sha256Hex(data: string | Uint8Array): Promise<string> {
  const input = typeof data === 'string' ? new TextEncoder().encode(data) : data;
  const buf = input.buffer.slice(input.byteOffset, input.byteOffset + input.byteLength) as ArrayBuffer;
  const digest = await crypto.subtle.digest('SHA-256', buf);
  return bytesToHex(new Uint8Array(digest));
}

// ─── Cache ───────────────────────────────────────────────────
const manifestCache = new Map<string, { manifest: EvoVisualManifest; ts: number }>();
const verificationCache = new Map<string, ManifestVerification>();
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
  if (m.provenance !== undefined) {
    if (!m.provenance || typeof m.provenance !== 'object') return false;
    const p = m.provenance as Record<string, unknown>;
    if (p.items !== undefined) {
      if (!Array.isArray(p.items)) return false;
      for (const item of p.items) {
        if (!item || typeof item !== 'object') return false;
        const it = item as Record<string, unknown>;
        if (typeof it.id !== 'number') return false;
        if (typeof it.hash !== 'string' || !it.hash) return false;
      }
    }
    if (p.merkle_root !== undefined && typeof p.merkle_root !== 'string') return false;
  }
  return true;
}

// ─── Fetch ───────────────────────────────────────────────────
/**
 * Fetch a collection manifest from metadata_uri.
 *
 * @param metadataUri - The collection's on-chain metadata_uri
 * @param expectedHash - Optional on-chain artwork_manifest_hash (32 bytes).
 *   If provided and non-zero, the fetched manifest is SHA-256 hashed and
 *   compared. The result is stored and retrievable via getManifestVerification().
 *   A zero hash (all zeros) means the creator didn't commit one → status 'no-hash'.
 */
export async function fetchVisualManifest(
  metadataUri: string,
  expectedHash?: Uint8Array,
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
    const rawText = await res.text();
    const data = JSON.parse(rawText);
    if (!isValidManifest(data)) return null;

    // Hash the raw response text and verify against on-chain hash
    const actualHash = await sha256Hex(rawText);
    let verification: ManifestVerification;

    if (expectedHash && !isZeroHash(expectedHash)) {
      const expectedHex = bytesToHex(expectedHash);
      verification = {
        status: actualHash === expectedHex ? 'verified' : 'mismatch',
        expectedHash: expectedHex,
        actualHash,
      };
    } else {
      verification = {
        status: expectedHash ? 'no-hash' : 'unchecked',
        actualHash,
      };
    }

    manifestCache.set(metadataUri, { manifest: data, ts: Date.now() });
    verificationCache.set(metadataUri, verification);
    return data;
  } catch {
    return null;
  }
}

/**
 * Get the verification result from the last fetchVisualManifest call.
 * Returns null if the manifest hasn't been fetched yet.
 */
export function getManifestVerification(metadataUri: string): ManifestVerification | null {
  return verificationCache.get(metadataUri) ?? null;
}

/**
 * Verify an individual EVO's image against the manifest's provenance section.
 * Fetches the image, hashes it, and compares to provenance.items[evoId].hash.
 *
 * @param imageUrl - The resolved image URL to verify
 * @param evoId - The EVO's mint index
 * @param manifest - The visual manifest (must contain provenance.items)
 */
export async function verifyEvoImageHash(
  imageUrl: string,
  evoId: number,
  manifest: EvoVisualManifest,
): Promise<ImageVerification> {
  const items = manifest.provenance?.items;
  if (!items || items.length === 0) {
    return { status: 'no-hash' };
  }

  const entry = items.find(it => it.id === evoId);
  if (!entry) {
    return { status: 'no-hash' };
  }

  try {
    const res = await fetch(imageUrl, { cache: 'no-store' });
    if (!res.ok) return { status: 'unchecked', expectedHash: entry.hash };
    const buf = new Uint8Array(await res.arrayBuffer());
    const actualHash = await sha256Hex(buf);
    return {
      status: actualHash === entry.hash ? 'verified' : 'mismatch',
      expectedHash: entry.hash,
      actualHash,
    };
  } catch {
    return { status: 'unchecked', expectedHash: entry.hash };
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
    verificationCache.delete(metadataUri);
  } else {
    manifestCache.clear();
    verificationCache.clear();
  }
}