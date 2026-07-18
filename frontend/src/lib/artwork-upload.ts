import { CID } from 'multiformats/cid';
import { sha256 } from 'multiformats/hashes/sha2';
import * as raw from 'multiformats/codecs/raw';

export interface UploadedImage {
  fileName: string;
  fileSize: number;
  cid: string;
  ipfsUri: string;
  gatewayUrl: string;
  base64Preview: string;
}

export interface ManifestState {
  index: number;
  name: string;
  image: string;
}

export interface CollectionManifest {
  name: string;
  description: string;
  image: string;
  lifecycle: {
    maxStates: number;
    states: ManifestState[];
  };
  external_url?: string;
}

export const IPFS_GATEWAY = 'https://dweb.link/ipfs/';

export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export async function computeCid(bytes: Uint8Array): Promise<string> {
  const hash = await sha256.digest(bytes);
  const cid = CID.create(1, raw.code, hash);
  return cid.toString();
}

export async function fileToBytes(file: File): Promise<Uint8Array> {
  const buf = await file.arrayBuffer();
  return new Uint8Array(buf);
}

export async function processImageFile(file: File): Promise<UploadedImage> {
  const [bytes, base64Preview] = await Promise.all([
    fileToBytes(file),
    fileToBase64(file),
  ]);
  const cid = await computeCid(bytes);
  return {
    fileName: file.name,
    fileSize: file.size,
    cid,
    ipfsUri: `ipfs://${cid}`,
    gatewayUrl: `${IPFS_GATEWAY}${cid}`,
    base64Preview,
  };
}

export async function buildCollectionManifest(
  name: string,
  description: string,
  images: UploadedImage[],
): Promise<CollectionManifest> {
  const states: ManifestState[] = images.map((img, i) => ({
    index: i,
    name: `State ${i + 1}`,
    image: img.ipfsUri,
  }));

  const manifest: CollectionManifest = {
    name,
    description,
    image: images[0]?.ipfsUri ?? '',
    lifecycle: {
      maxStates: images.length,
      states,
    },
  };

  return manifest;
}

export async function computeManifestCid(manifest: CollectionManifest): Promise<string> {
  const jsonBytes = new TextEncoder().encode(JSON.stringify(manifest, null, 2));
  return computeCid(jsonBytes);
}

async function sha256Hex(data: Uint8Array): Promise<string> {
  const ab = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer;
  const hash = await crypto.subtle.digest('SHA-256', ab);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function computeMerkleRoot(leaves: Uint8Array[]): Promise<string> {
  if (leaves.length === 0) {
    const emptyHash = await sha256Hex(new Uint8Array(32));
    return emptyHash;
  }
  if (leaves.length === 1) {
    return sha256Hex(leaves[0]);
  }
  let current = await Promise.all(leaves.map(sha256Hex));
  while (current.length > 1) {
    const next: string[] = [];
    for (let i = 0; i < current.length; i += 2) {
      if (i + 1 < current.length) {
        const combined = new TextEncoder().encode(current[i] + current[i + 1]);
        next.push(await sha256Hex(combined));
      } else {
        next.push(await sha256Hex(new TextEncoder().encode(current[i] + current[i])));
      }
    }
    current = next;
  }
  return current[0];
}

export async function computeStateMerkleRoot(stateUris: string[]): Promise<string> {
  const leaves = stateUris.map((uri) => new TextEncoder().encode(uri));
  return computeMerkleRoot(leaves);
}

export function isImageFile(file: File): boolean {
  return file.type.startsWith('image/');
}

export function isJsonFile(file: File): boolean {
  return file.type === 'application/json' || file.name.toLowerCase().endsWith('.json');
}