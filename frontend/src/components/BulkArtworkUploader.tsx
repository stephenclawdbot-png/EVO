'use client';

import { useState, useCallback, useRef } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import {
  uploadFilesBatch,
  uploadJson,
  estimateUploadCost,
  type UploadResult,
  type UploadProgress,
} from '@/lib/arweave-upload';
import {
  buildBulkManifest,
  computeBulkMerkleRoot,
  unzipFiles,
  groupFilesByState,
  type BulkCollectionManifest,
} from '@/lib/bulk-manifest';

export interface BulkArtworkResult {
  manifest: BulkCollectionManifest;
  manifestUri: string;
  merkleRoot: string;
  totalImages: number;
}

interface Props {
  collectionName: string;
  stateNames: string[];
  onArtworkReady: (result: BulkArtworkResult | null) => void;
}

const STATE_COLORS = ['#a1a1aa', '#818cf8', '#6366f1'];

export function BulkArtworkUploader({ collectionName, stateNames, onArtworkReady }: Props) {
  const wallet = useWallet();
  const [stateFiles, setStateFiles] = useState<File[][]>(stateNames.map(() => []));
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<UploadProgress | null>(null);
  const [costEstimate, setCostEstimate] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [phase, setPhase] = useState<string>('');
  const [useDevnet, setUseDevnet] = useState(true);
  const zipInputRef = useRef<HTMLInputElement>(null);

  const totalFiles = stateFiles.reduce((sum, s) => sum + s.length, 0);
  const totalBytes = stateFiles.reduce((sum, s) => sum + s.reduce((b, f) => b + f.size, 0), 0);

  const estimateCost = useCallback(async () => {
    if (totalBytes === 0 || !wallet.connected) return;
    try {
      const cost = await estimateUploadCost(totalBytes, wallet, useDevnet);
      setCostEstimate(cost);
    } catch {
      setCostEstimate(null);
    }
  }, [totalBytes, wallet, useDevnet]);

  const handleStateDrop = useCallback((stateIndex: number, files: FileList | File[]) => {
    const fileArray = Array.from(files).filter((f) => f.type.startsWith('image/'));
    setStateFiles((prev) => {
      const next = [...prev];
      next[stateIndex] = [...next[stateIndex], ...fileArray];
      return next;
    });
    setError(null);
  }, []);

  const handleZipDrop = useCallback(async (files: FileList | File[]) => {
    const fileArray = Array.from(files);
    const zipFiles = fileArray.filter((f) => f.name.toLowerCase().endsWith('.zip'));
    if (zipFiles.length === 0) {
      setError('No ZIP files found. Drag .zip files or add images per state below.');
      return;
    }

    setUploading(true);
    setPhase('Extracting ZIPs…');
    setError(null);
    try {
      const allFiles: File[] = [];
      for (const zip of zipFiles) {
        const extracted = await unzipFiles(zip);
        allFiles.push(...extracted.filter((f) => f.type.startsWith('image/')));
      }
      const groups = groupFilesByState(allFiles, stateNames);
      setStateFiles(groups);
      setPhase('');
    } catch (err: any) {
      setError(`Failed to extract ZIP: ${err?.message || err}`);
    } finally {
      setUploading(false);
    }
  }, [stateNames]);

  const removeFile = useCallback((stateIndex: number, fileIndex: number) => {
    setStateFiles((prev) => {
      const next = [...prev];
      next[stateIndex] = next[stateIndex].filter((_, i) => i !== fileIndex);
      return next;
    });
  }, []);

  const startUpload = useCallback(async () => {
    if (!wallet.connected || !wallet.publicKey) {
      setError('Connect your wallet first');
      return;
    }
    if (totalFiles === 0) {
      setError('Add at least one image');
      return;
    }

    setUploading(true);
    setError(null);
    setProgress({ uploaded: 0, total: totalFiles, failed: 0, currentFile: '' });

    try {
      const allResults: UploadResult[][] = [];

      for (let s = 0; s < stateFiles.length; s++) {
        setPhase(`Uploading ${stateNames[s]} images (${stateFiles[s].length} files)…`);
        const results = await uploadFilesBatch(stateFiles[s], wallet, useDevnet, (p) => {
          setProgress({ ...p, uploaded: p.uploaded + allResults.reduce((sum, r) => sum + r.length, 0) });
        });
        allResults.push(results);
      }

      const itemCount = Math.max(...allResults.map((r) => r.length), 0);
      const items: { traits: Record<string, string>; stateUris: string[] }[] = [];

      for (let i = 0; i < itemCount; i++) {
        const stateUris: string[] = [];
        for (let s = 0; s < allResults.length; s++) {
          if (allResults[s][i]) {
            stateUris.push(`arweave://${allResults[s][i].txId}`);
          } else {
            stateUris.push(allResults[0]?.[i]?.uri || '');
          }
        }
        items.push({ traits: {}, stateUris });
      }

      setPhase('Building manifest…');
      const manifest = buildBulkManifest(
        collectionName || 'Unnamed',
        `${collectionName} — evolving EVO collection`,
        stateNames,
        items,
      );

      setPhase('Computing Merkle root…');
      const merkleRoot = await computeBulkMerkleRoot(manifest.items);

      setPhase('Uploading manifest…');
      const manifestResult = await uploadJson(manifest, wallet, useDevnet);

      onArtworkReady({
        manifest,
        manifestUri: `arweave://${manifestResult.txId}`,
        merkleRoot,
        totalImages: totalFiles,
      });

      setPhase('Done!');
    } catch (err: any) {
      setError(`Upload failed: ${err?.message || err}`);
    } finally {
      setUploading(false);
    }
  }, [wallet, totalFiles, stateFiles, stateNames, collectionName, useDevnet, onArtworkReady]);

  const pct = progress ? Math.round((progress.uploaded / progress.total) * 100) : 0;

  return (
    <div className="space-y-4">
      {/* ZIP drop zone */}
      <div
        onDrop={(e) => { e.preventDefault(); handleZipDrop(e.dataTransfer.files); }}
        onDragOver={(e) => e.preventDefault()}
        onClick={() => zipInputRef.current?.click()}
        className="cursor-pointer rounded-lg border-2 border-dashed border-border p-4 text-center transition-colors hover:border-accent/50"
      >
        <svg className="mx-auto h-6 w-6 text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12L12 7.5m0 0L7.5 12M12 7.5v9" />
        </svg>
        <p className="mt-1.5 text-sm font-semibold text-text">Drop ZIP files here</p>
        <p className="mt-0.5 text-[11px] text-muted">Auto-sorts images by state folder name</p>
        <input ref={zipInputRef} type="file" multiple accept=".zip" className="hidden" onChange={(e) => e.target.files && handleZipDrop(e.target.files)} />
      </div>

      {/* Per-state drop zones */}
      <div className="grid gap-3 sm:grid-cols-3">
        {stateNames.map((stateName, si) => (
          <div
            key={si}
            onDrop={(e) => { e.preventDefault(); handleStateDrop(si, e.dataTransfer.files); }}
            onDragOver={(e) => e.preventDefault()}
            className="rounded-lg border border-border bg-surface p-3"
          >
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-xs font-semibold text-text">
                <span className="h-2 w-2 rounded-full" style={{ background: STATE_COLORS[si] || '#a1a1aa' }} />
                {stateName}
              </span>
              <span className="text-[10px] text-muted">{stateFiles[si].length} files</span>
            </div>

            {stateFiles[si].length > 0 && (
              <div className="mt-2 max-h-32 space-y-0.5 overflow-y-auto">
                {stateFiles[si].slice(0, 10).map((file, fi) => (
                  <div key={fi} className="flex items-center justify-between text-[10px] text-muted">
                    <span className="truncate">{file.name}</span>
                    <button onClick={() => removeFile(si, fi)} className="ml-1 shrink-0 text-negative hover:opacity-70">×</button>
                  </div>
                ))}
                {stateFiles[si].length > 10 && (
                  <p className="text-[10px] text-dim">+{stateFiles[si].length - 10} more…</p>
                )}
              </div>
            )}

            {stateFiles[si].length === 0 && (
              <p className="mt-2 text-[10px] text-dim">Drag images here</p>
            )}
          </div>
        ))}
      </div>

      {/* Summary + cost */}
      {totalFiles > 0 && (
        <div className="rounded-lg border border-border bg-surface p-3 text-xs">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-muted">
              {totalFiles} images · {(totalBytes / 1_000_000).toFixed(1)} MB
            </span>
            {costEstimate !== null && (
              <span className="font-mono text-text">
                ~{costEstimate.toFixed(4)} SOL
              </span>
            )}
          </div>

          <div className="mt-2 flex items-center gap-3">
            <button
              onClick={estimateCost}
              disabled={!wallet.connected || uploading}
              className="text-[11px] text-accent hover:underline disabled:opacity-50"
            >
              Estimate cost
            </button>

            <label className="flex items-center gap-1 text-[11px] text-muted">
              <input
                type="checkbox"
                checked={useDevnet}
                onChange={(e) => setUseDevnet(e.target.checked)}
                className="h-3 w-3"
              />
              Devnet (free, temporary)
            </label>
          </div>
        </div>
      )}

      {/* Progress bar */}
      {uploading && progress && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-[11px]">
            <span className="font-medium text-text">{phase}</span>
            <span className="text-muted">{progress.uploaded}/{progress.total} {progress.failed > 0 && `· ${progress.failed} failed`}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-surface-2">
            <div
              className="h-full rounded-full bg-accent transition-all duration-300"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      )}

      {/* Upload button */}
      {totalFiles > 0 && !uploading && (
        <button
          onClick={startUpload}
          disabled={!wallet.connected}
          className="inline-flex w-full items-center justify-center gap-2 rounded border border-accent bg-accent px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-accent-hover disabled:opacity-50"
        >
          {wallet.connected ? `Upload ${totalFiles} images to Arweave` : 'Connect wallet to upload'}
        </button>
      )}

      {error && (
        <div className="flex items-start gap-2 rounded border border-negative/40 bg-negative/10 p-2.5 text-[11px] text-negative">
          <svg className="mt-0.5 h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
          </svg>
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}