import type { WalletContextState } from '@solana/wallet-adapter-react';

export interface UploadResult {
  txId: string;
  uri: string;
  size: number;
  fileName?: string;
}

export interface UploadProgress {
  uploaded: number;
  total: number;
  failed: number;
  currentFile: string;
}

export type ProgressCallback = (progress: UploadProgress) => void;

export interface FailedUpload {
  file: File;
  stateIndex: number;
  error: string;
}

const IRYS_NODE = 'https://node1.irys.xyz';
const IRYS_DEVNET = 'https://devnet.irys.xyz';
const ARWEAVE_GATEWAY = 'https://arweave.net/';

let irysInstance: any = null;
let irysDevnetInstance: any = null;

export async function getIrys(wallet: WalletContextState, useDevnet = false) {
  const cached = useDevnet ? irysDevnetInstance : irysInstance;
  if (cached) return cached;

  const Irys = (await import('@irys/sdk')).default;

  const provider = {
    publicKey: wallet.publicKey,
    signMessage: async (message: Uint8Array): Promise<Uint8Array> => {
      if (!wallet.signMessage) throw new Error('Wallet does not support signMessage');
      return wallet.signMessage(message);
    },
  };

  const instance = new Irys({
    url: useDevnet ? IRYS_DEVNET : IRYS_NODE,
    token: 'solana',
    key: undefined as any,
    config: { provider } as any,
  });

  await instance.ready();

  if (useDevnet) irysDevnetInstance = instance;
  else irysInstance = instance;

  return instance;
}

export async function getIrysBalance(wallet: WalletContextState): Promise<number> {
  try {
    const irys = await getIrys(wallet, false);
    const balance = await irys.getLoadedBalance();
    return irys.utils.unitConverter(balance);
  } catch {
    return 0;
  }
}

export async function estimateUploadCost(
  totalBytes: number,
  wallet: WalletContextState,
  useDevnet = false,
): Promise<number> {
  try {
    const irys = await getIrys(wallet, useDevnet);
    const manifestOverhead = totalBytes * 0.01;
    const atomicCost = await irys.getPrice(totalBytes + manifestOverhead);
    return irys.utils.unitConverter(atomicCost);
  } catch {
    return (totalBytes / 1_000_000) * 0.0001;
  }
}

export async function uploadFile(
  file: File | Uint8Array,
  wallet: WalletContextState,
  tags: { name: string; value: string }[] = [],
  useDevnet = false,
): Promise<UploadResult> {
  const irys = await getIrys(wallet, useDevnet);

  let data: Uint8Array;
  let size: number;
  let fileName: string;

  if (file instanceof File) {
    data = new Uint8Array(await file.arrayBuffer());
    size = file.size;
    fileName = file.name;
  } else {
    data = file;
    size = file.length;
    fileName = 'data';
  }

  const tx = irys.createTransaction(data, { tags: [
    { name: 'Content-Type', value: 'application/octet-stream' },
    ...tags,
  ]});
  await tx.sign();
  await tx.upload();

  const txId = tx.id;
  return {
    txId,
    uri: `${ARWEAVE_GATEWAY}${txId}`,
    size,
    fileName,
  };
}

/**
 * Upload files for a specific state with concurrent sliding-window workers.
 */
export async function uploadStateFiles(
  files: File[],
  stateIndex: number,
  wallet: WalletContextState,
  useDevnet = false,
  concurrency = 5,
  onProgress?: (uploaded: number, total: number, failed: number, fileName: string) => void,
  skipNames?: Set<string>,
): Promise<{ results: (UploadResult | null)[]; failed: FailedUpload[] }> {
  const results: (UploadResult | null)[] = new Array(files.length).fill(null);
  const failed: FailedUpload[] = [];
  let index = 0;
  let uploaded = 0;
  let failCount = 0;
  const total = files.length;

  async function worker() {
    while (index < files.length) {
      const current = index++;
      const file = files[current];

      if (skipNames?.has(file.name)) {
        uploaded++;
        onProgress?.(uploaded, total, failCount, file.name + ' (skipped)');
        continue;
      }

      try {
        const result = await uploadFile(file, wallet, [
          { name: 'App-Name', value: 'EVO' },
          { name: 'Content-Type', value: file.type || 'image/png' },
        ], useDevnet);
        results[current] = result;
      } catch (err: any) {
        failCount++;
        failed.push({ file, stateIndex, error: err?.message || String(err) });
      }
      uploaded++;
      onProgress?.(uploaded, total, failCount, file.name);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, files.length) }, () => worker())
  );

  return { results, failed };
}

/**
 * Verify that an Arweave transaction is accessible via the gateway.
 */
export async function verifyUpload(txId: string, timeoutMs = 15000): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(`${ARWEAVE_GATEWAY}${txId}`, {
      method: 'HEAD',
      signal: controller.signal,
    });
    clearTimeout(timeout);
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Verify a sample of uploads. Returns which txIds failed verification.
 */
export async function verifyUploadsSample(
  txIds: string[],
  sampleSize = 5,
): Promise<string[]> {
  if (txIds.length === 0) return [];

  const sample: string[] = [];
  const step = Math.max(1, Math.floor(txIds.length / sampleSize));
  for (let i = 0; i < txIds.length && sample.length < sampleSize; i += step) {
    sample.push(txIds[i]);
  }

  const checks = await Promise.all(
    sample.map(async (txId) => ({ txId, ok: await verifyUpload(txId) }))
  );

  return checks.filter(c => !c.ok).map(c => c.txId);
}

export async function uploadJson(
  data: object,
  wallet: WalletContextState,
  useDevnet = false,
): Promise<UploadResult> {
  const jsonBytes = new TextEncoder().encode(JSON.stringify(data, null, 2));
  const result = await uploadFile(jsonBytes, wallet, [
    { name: 'App-Name', value: 'EVO' },
    { name: 'Content-Type', value: 'application/json' },
  ], useDevnet);
  return result;
}

// Legacy batch upload (kept for backward compat with ArtworkDropzone)
export async function uploadFilesBatch(
  files: File[],
  wallet: WalletContextState,
  useDevnet = false,
  onProgress?: ProgressCallback,
): Promise<UploadResult[]> {
  const { results } = await uploadStateFiles(files, -1, wallet, useDevnet, 5, (u, t, f, fn) => {
    onProgress?.({ uploaded: u, total: t, failed: f, currentFile: fn });
  });
  return results.filter((r): r is UploadResult => r !== null);
}