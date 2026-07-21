import type { WalletContextState } from '@solana/wallet-adapter-react';
import { Buffer } from 'buffer';
import BigNumber from 'bignumber.js';

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

const IRYS_GATEWAY = 'https://gateway.irys.xyz/';

// Solana RPC endpoints for Irys to verify funding transactions
// Using Helius private fast endpoint (no API key needed in URL)
const SOLANA_MAINNET_RPC = 'https://kelli-s07i72-fast-mainnet.helius-rpc.com';
const SOLANA_DEVNET_RPC = 'https://api.devnet.solana.com';

let irysInstance: any = null;
let irysDevnetInstance: any = null;

/** Clear cached Irys instances (call when upload fails to force fresh init on retry) */
export function clearIrysCache() {
  irysInstance = null;
  irysDevnetInstance = null;
}

/**
 * Create an Irys uploader instance using the new @irys/upload + @irys/upload-solana SDK.
 * Uses the browser's Solana wallet adapter as the signing provider.
 */
export async function getIrys(wallet: WalletContextState, useDevnet = false) {
  const cached = useDevnet ? irysDevnetInstance : irysInstance;
  if (cached) return cached;

  const uploadMod = await import('@irys/web-upload');
  const solanaMod = await import('@irys/web-upload-solana');

  const Uploader = uploadMod.WebUploader ?? uploadMod.default;
  const WebSolana = solanaMod.WebSolana ?? solanaMod.default;

  if (!wallet.publicKey) throw new Error('Wallet not connected');

  // Pass the real wallet adapter directly. The Irys Solana token reads
  // `wallet.signMessage` (via HexInjectedSolanaSigner) and
  // `wallet.sendTransaction` from the provider. Earlier code built a plain
  // object that detached `wallet.sendTransaction`, losing the adapter's
  // `this` binding and causing silent "Network Error" failures on the
  // funding transaction. Passing `wallet` preserves that binding.
  let builder = Uploader(WebSolana).withProvider(wallet as any);

  if (useDevnet) {
    // Irys devnet requires a Solana devnet RPC for funding verification
    builder = builder.devnet().withRpc(SOLANA_DEVNET_RPC);
  } else {
    builder = builder.mainnet().withRpc(SOLANA_MAINNET_RPC);
  }

  const instance = await builder;

  if (useDevnet) irysDevnetInstance = instance;
  else irysInstance = instance;

  return instance;
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
    // Convert from atomic units
    if (irys.utils?.unitConverter) {
      return parseFloat(irys.utils.unitConverter(atomicCost).toString());
    }
    if (irys.utils?.fromAtomic) {
      return parseFloat(irys.utils.fromAtomic(atomicCost).toString());
    }
    return parseFloat(atomicCost.toString()) / 1e9;
  } catch {
    return (totalBytes / 1_000_000) * 0.0001;
  }
}

/**
 * Pre-fund the Irys account with SOL so uploads don't fail with 402.
 * Returns the funded amount in SOL.
 */
export async function fundIrys(
  solAmount: number,
  wallet: WalletContextState,
  useDevnet = false,
): Promise<number> {
  const irys = await getIrys(wallet, useDevnet);
  const atomicAmount = BigInt(Math.floor(solAmount * 1e9));
  const receipt = await irys.fund(atomicAmount);
  return solAmount;
}

/**
 * Check the Irys account balance (funded amount, not wallet SOL).
 */
export async function getIrysBalance(wallet: WalletContextState, useDevnet = false): Promise<number> {
  try {
    const irys = await getIrys(wallet, useDevnet);
    const balance = await irys.getLoadedBalance();
    if (irys.utils?.unitConverter) {
      return parseFloat(irys.utils.unitConverter(balance).toString());
    }
    return parseFloat(balance.toString()) / 1e9;
  } catch {
    return 0;
  }
}

export async function uploadFile(
  file: File | Uint8Array,
  wallet: WalletContextState,
  tags: { name: string; value: string }[] = [],
  useDevnet = false,
): Promise<UploadResult> {
  const irys = await getIrys(wallet, useDevnet);

  let data: Buffer;
  let size: number;
  let fileName: string;

  if (file instanceof File) {
    data = Buffer.from(await file.arrayBuffer());
    size = file.size;
    fileName = file.name;
  } else {
    data = Buffer.from(file);
    size = file.length;
    fileName = 'data';
  }

  const receipt = await irys.upload(data, {
    tags: [
      { name: 'Content-Type', value: 'application/octet-stream' },
      ...tags,
    ],
  });

  const txId = receipt.id;
  return {
    txId,
    uri: `${IRYS_GATEWAY}${txId}`,
    size,
    fileName,
  };
}

/**
 * Upload all files for a state as a SINGLE bundle transaction using irys.uploadFolder().
 * This creates a temporary signing key for individual data items and bundles them
 * into one transaction — the user's wallet only signs once per state.
 * Returns the manifest ID and per-file tx IDs.
 */
export async function uploadStateFolder(
  files: File[],
  stateIndex: number,
  wallet: WalletContextState,
  useDevnet = false,
  onProgress?: (uploaded: number, total: number, fileName: string) => void,
  chunkSize = 50,
): Promise<{ results: (UploadResult | null)[]; failed: FailedUpload[] }> {
  let irys = await getIrys(wallet, useDevnet);

  // Auto-fund the Irys balance if needed. We estimate the cost for the total
  // payload and top up with a 20% buffer (min 0.005 SOL) when the current
  // loaded balance is below that.
  const totalBytes = files.reduce((sum, f) => sum + f.size, 0);
  try {
    const [loadedBalanceBn, atomicCostBn] = await Promise.all([
      irys.getLoadedBalance(),
      irys.getPrice(Math.ceil(totalBytes * 1.05)),
    ]);
    // getLoadedBalance/getPrice return bignumber.js BigNumber instances, not
    // native bigint — mixing them into `*`/`<` with bigint literals throws
    // "Cannot mix BigInt and other types" and gets swallowed by the catch
    // below, silently skipping funding on every upload. Round to a whole
    // atomic-unit string first, then convert to native bigint.
    const loadedBalance = BigInt(loadedBalanceBn.integerValue(BigNumber.ROUND_DOWN).toFixed(0));
    const atomicCost = BigInt(atomicCostBn.integerValue(BigNumber.ROUND_CEIL).toFixed(0));
    const needed = (atomicCost * 12n) / 10n; // +20% buffer
    if (loadedBalance < needed) {
      // Fund the gap, floored at a small minimum so tiny uploads aren't
      // rejected for being below Irys's funding granularity.
      const topUp = (() => {
        const minFund = 5_000_000n; // 0.005 SOL in lamports
        const gap = needed - loadedBalance;
        return gap > minFund ? gap : minFund;
      })();
      onProgress?.(0, files.length, `Funding Irys (${Number(topUp) / 1e9} SOL)…`);
      await irys.fund(topUp);
    }
  } catch (err) {
    console.warn('Irys pre-fund skipped:', err);
  }

  const results: (UploadResult | null)[] = new Array(files.length).fill(null);
  const failed: FailedUpload[] = [];
  let completedCount = 0;
  const MAX_RETRIES = 2;

  // Upload in chunks so a single bundle failure doesn't nuke all files.
  // Each chunk is a separate Irys transaction (manifest + data items).
  for (let i = 0; i < files.length; i += chunkSize) {
    const chunk = files.slice(i, i + chunkSize);
    const chunkEnd = Math.min(i + chunkSize, files.length);

    let chunkDone = false;
    for (let attempt = 0; attempt < MAX_RETRIES && !chunkDone; attempt++) {
      const label = attempt > 0
        ? `Retry ${attempt}/${MAX_RETRIES - 1}: ${completedCount + 1}-${chunkEnd}/${files.length}`
        : `Bundling ${completedCount + 1}-${chunkEnd}/${files.length}`;
      onProgress?.(completedCount, files.length, label);

      try {
        const response = await irys.uploadFolder(chunk, {
          manifestTags: [
            { name: 'App-Name', value: 'EVO' },
            { name: 'State-Index', value: String(stateIndex) },
            { name: 'Content-Type', value: 'application/x.irys-manifest+json' },
          ],
        });

        const manifest = response.manifest;
        chunk.forEach((f, j) => {
          const origIdx = i + j;
          const pathEntry = manifest?.paths?.[f.name];
          const txId = pathEntry?.id || '';
          if (txId) {
            results[origIdx] = {
              txId,
              uri: `${IRYS_GATEWAY}${txId}`,
              size: f.size,
              fileName: f.name,
            };
          }
        });
        chunkDone = true;
      } catch (err: any) {
        if (attempt < MAX_RETRIES - 1) {
          clearIrysCache();
          await new Promise(r => setTimeout(r, 2000 * (attempt + 1)));
          irys = await getIrys(wallet, useDevnet);
        } else {
          const errMsg = err?.response?.data || err?.message || String(err);
          chunk.forEach((f, j) => {
            failed.push({ file: f, stateIndex, error: errMsg });
          });
        }
      }
    }

    completedCount = chunkEnd;
    onProgress?.(completedCount, files.length, `${completedCount}/${files.length} done`);
  }

  return { results, failed };
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
  let cacheCleared = false;

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
        const errMsg = err?.response?.data || err?.message || err?.toString?.() || String(err);
        failed.push({ file, stateIndex, error: errMsg });

        // Clear Irys cache on first failure so retries get a fresh instance
        if (!cacheCleared) {
          cacheCleared = true;
          clearIrysCache();
        }
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
 * Verify that an Arweave/Irys transaction is accessible via the gateway.
 */
export async function verifyUpload(txId: string, timeoutMs = 15000): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(`${IRYS_GATEWAY}${txId}`, {
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
  const jsonStr = JSON.stringify(data, null, 2);
  const result = await uploadFile(Buffer.from(jsonStr, 'utf-8'), wallet, [
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