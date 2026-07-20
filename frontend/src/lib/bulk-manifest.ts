export interface ManifestItem {
  index: number;
  name: string;
  traits: Record<string, string>;
  states: string[];
}

export interface BulkCollectionManifest {
  name: string;
  description: string;
  image: string;
  lifecycle: {
    maxStates: number;
    stateNames: string[];
  };
  items: ManifestItem[];
}

export function buildBulkManifest(
  name: string,
  description: string,
  stateNames: string[],
  items: { traits: Record<string, string>; stateUris: string[] }[],
): BulkCollectionManifest {
  const manifestItems: ManifestItem[] = items.map((item, i) => ({
    index: i,
    name: `${name} #${String(i + 1).padStart(4, '0')}`,
    traits: item.traits,
    states: item.stateUris,
  }));

  return {
    name,
    description,
    image: manifestItems[0]?.states[0] ?? '',
    lifecycle: {
      maxStates: stateNames.length,
      stateNames,
    },
    items: manifestItems,
  };
}

export async function computeBulkMerkleRoot(items: ManifestItem[]): Promise<string> {
  const leaves: Uint8Array[] = items.map((item) => {
    const stateStr = item.states.join('');
    return new TextEncoder().encode(stateStr);
  });

  if (leaves.length === 0) {
    const ab = new ArrayBuffer(32);
    const hash = await crypto.subtle.digest('SHA-256', ab);
    return Array.from(new Uint8Array(hash))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }

  const sha = async (data: Uint8Array): Promise<string> => {
    const ab = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer;
    const hash = await crypto.subtle.digest('SHA-256', ab);
    return Array.from(new Uint8Array(hash))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  };

  let current = await Promise.all(leaves.map(sha));
  while (current.length > 1) {
    const next: string[] = [];
    for (let i = 0; i < current.length; i += 2) {
      if (i + 1 < current.length) {
        const combined = new TextEncoder().encode(current[i] + current[i + 1]);
        next.push(await sha(combined));
      } else {
        const combined = new TextEncoder().encode(current[i] + current[i]);
        next.push(await sha(combined));
      }
    }
    current = next;
  }
  return current[0];
}

const TYPE_MAP: Record<string, string> = {
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg',
  gif: 'image/gif', webp: 'image/webp', json: 'application/json',
};

export interface ExtractedFiles {
  images: File[];
  jsons: File[];
  imagePaths: string[];
  jsonPaths: string[];
}

/**
 * Extract ZIP in chunks to reduce peak memory usage.
 * Processes entries in batches and yields results progressively.
 */
export async function* unzipFilesStream(zipFile: File, chunkSize = 100): AsyncGenerator<File[]> {
  const { unzipSync } = await import('fflate');
  const buf = new Uint8Array(await zipFile.arrayBuffer());
  const entries = unzipSync(buf);
  const paths = Object.keys(entries).filter(p => !p.startsWith('__MACOSX/') && !p.endsWith('/')).sort();

  for (let i = 0; i < paths.length; i += chunkSize) {
    const batch: File[] = [];
    for (let j = i; j < Math.min(i + chunkSize, paths.length); j++) {
      const path = paths[j];
      const name = path.split('/').pop() || path;
      const ext = name.toLowerCase().split('.').pop() || '';
      const type = TYPE_MAP[ext] || 'application/octet-stream';
      const file = new File([entries[path]], name, { type });
      // Store the full ZIP path as a plain property for state folder matching
      (file as any)._zipPath = path;
      batch.push(file);
      delete entries[path];
    }
    yield batch;
  }
}

export async function unzipFiles(zipFile: File): Promise<File[]> {
  const all: File[] = [];
  for await (const batch of unzipFilesStream(zipFile)) {
    all.push(...batch);
  }
  return all;
}

export function groupFilesByState(
  files: File[],
  stateNames: string[],
): { images: File[][]; jsons: File[] } {
  const imageGroups: File[][] = stateNames.map(() => []);
  const jsons: File[] = [];

  for (const file of files) {
    if (file.type === 'application/json') {
      jsons.push(file);
      continue;
    }
    if (!file.type.startsWith('image/')) continue;

    // Use the full relative path (from ZIP extraction or drag-drop folder) for state matching
    const relativePath = (file as any)._zipPath || file.webkitRelativePath || file.name;
    const lower = relativePath.toLowerCase();
    let placed = false;
    for (let i = 0; i < stateNames.length; i++) {
      const stateLower = stateNames[i].toLowerCase().replace(/[^a-z0-9]/g, '');
      // Match folder names like "state1/", "state 1/", "state-1/"
      const statePatterns = [
        `state${i + 1}`,
        `state-${i + 1}`,
        `state_${i + 1}`,
        `state ${i + 1}`,
        stateLower,
      ];
      if (statePatterns.some(p => lower.includes(p))) {
        imageGroups[i].push(file);
        placed = true;
        break;
      }
    }
    if (!placed) {
      imageGroups[0].push(file);
    }
  }

  // Sort each state's images by filename (natural/numeric order)
  for (let i = 0; i < imageGroups.length; i++) {
    imageGroups[i].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
  }

  return { images: imageGroups, jsons };
}

/**
 * Parse traits from JSON files.
 * Supports:
 *  - Single metadata.json/_metadata.json with array of objects
 *  - Per-token JSON files (0.json, 1.json, or token0.json, etc.)
 *  - Metaplex format: { attributes: [{trait_type, value}] }
 *  - Simple format: { trait: value, ... }
 */
export async function parseTraitsFromJsons(
  jsons: File[],
  count: number,
): Promise<Record<string, string>[]> {
  const traits: Record<string, string>[] = Array.from({ length: count }, () => ({}));

  if (jsons.length === 0) return traits;

  // Try single-file metadata first
  const metaFile = jsons.find(f => {
    const n = f.name.toLowerCase();
    return n === 'metadata.json' || n === '_metadata.json' || n === 'collection.json';
  });

  if (metaFile) {
    try {
      const text = await metaFile.text();
      const data = JSON.parse(text);

      if (Array.isArray(data)) {
        for (let i = 0; i < Math.min(data.length, count); i++) {
          traits[i] = extractTraits(data[i]);
        }
      } else if (data.items && Array.isArray(data.items)) {
        for (let i = 0; i < Math.min(data.items.length, count); i++) {
          traits[i] = extractTraits(data.items[i]);
        }
      }
      return traits;
    } catch { /* fall through to per-token */ }
  }

  // Per-token JSON files
  const tokenJsons = jsons.filter(f => {
    const n = f.name.toLowerCase();
    return n !== 'metadata.json' && n !== '_metadata.json' && n !== 'collection.json';
  }).sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));

  for (let i = 0; i < Math.min(tokenJsons.length, count); i++) {
    try {
      const text = await tokenJsons[i].text();
      const data = JSON.parse(text);
      traits[i] = extractTraits(data);
    } catch { /* leave empty traits */ }
  }

  return traits;
}

function extractTraits(obj: any): Record<string, string> {
  const result: Record<string, string> = {};

  if (obj.attributes && Array.isArray(obj.attributes)) {
    for (const attr of obj.attributes) {
      if (attr.trait_type && attr.value !== undefined) {
        result[attr.trait_type] = String(attr.value);
      }
    }
  } else {
    for (const [key, val] of Object.entries(obj)) {
      if (['name', 'image', 'description', 'external_url', 'properties', 'collection'].includes(key)) continue;
      if (typeof val === 'string' || typeof val === 'number') {
        result[key] = String(val);
      }
    }
  }

  return result;
}