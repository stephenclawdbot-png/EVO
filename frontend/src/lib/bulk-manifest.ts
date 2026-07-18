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

export async function unzipFiles(zipFile: File): Promise<File[]> {
  const { unzipSync } = await import('fflate');
  const buf = new Uint8Array(await zipFile.arrayBuffer());
  const entries = unzipSync(buf);
  const files: File[] = [];

  for (const [path, data] of Object.entries(entries)) {
    if (path.startsWith('__MACOSX/') || path.endsWith('/')) continue;
    const name = path.split('/').pop() || path;
    const ext = name.toLowerCase().split('.').pop() || '';
    const typeMap: Record<string, string> = {
      png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg',
      gif: 'image/gif', webp: 'image/webp', json: 'application/json',
    };
    const type = typeMap[ext] || 'application/octet-stream';
    files.push(new File([data], name, { type }));
  }

  files.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
  return files;
}

export function groupFilesByState(
  files: File[],
  stateNames: string[],
): File[][] {
  const groups: File[][] = stateNames.map(() => []);

  for (const file of files) {
    const lower = file.name.toLowerCase();
    for (let i = 0; i < stateNames.length; i++) {
      const stateLower = stateNames[i].toLowerCase().replace(/[^a-z0-9]/g, '');
      if (lower.includes(stateLower) || lower.includes(`state${i}`) || lower.includes(`state${i + 1}`)) {
        groups[i].push(file);
        break;
      }
    }
  }

  if (groups.every((g) => g.length === 0)) {
    const perState = Math.ceil(files.length / stateNames.length);
    for (let i = 0; i < stateNames.length; i++) {
      groups[i] = files.slice(i * perState, (i + 1) * perState);
    }
  }

  return groups;
}