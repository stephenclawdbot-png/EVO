'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import {
  uploadStateFolder,
  uploadStateFiles,
  uploadJson,
  estimateUploadCost,
  verifyUploadsSample,
  type UploadResult,
  type FailedUpload,
} from '@/lib/arweave-upload';
import {
  buildBulkManifest,
  computeBulkMerkleRoot,
  unzipFilesStream,
  groupFilesByState,
  parseTraitsFromJsons,
  injectRareEvolutions,
  type BulkCollectionManifest,
} from '@/lib/bulk-manifest';

export interface BulkArtworkResult {
  manifest: BulkCollectionManifest;
  manifestUri: string;
  merkleRoot: string;
  totalImages: number;
}

export interface RareConfig {
  enabled: boolean;
  rate: number;
  seed: number;
}

interface Props {
  collectionName: string;
  stateNames: string[];
  onArtworkReady: (result: BulkArtworkResult | null) => void;
  rareConfig?: RareConfig;
}

const STATE_COLORS = ['#a1a1aa', '#818cf8', '#6366f1', '#a78bfa', '#c084fc', '#f472b6'];
const CONCURRENCY = 5;

interface CompletedUpload {
  fileName: string;
  txId: string;
  stateIndex: number;
}

export function BulkArtworkUploader({ collectionName, stateNames, onArtworkReady, rareConfig }: Props) {
  const wallet = useWallet();
  const [stateFiles, setStateFiles] = useState<File[][]>(stateNames.map(() => []));
  const [jsonFiles, setJsonFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [phase, setPhase] = useState('');
  const [progress, setProgress] = useState({ uploaded: 0, total: 0, failed: 0, currentFile: '' });
  const [failedUploads, setFailedUploads] = useState<FailedUpload[]>([]);
  const [costEstimate, setCostEstimate] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [useDevnet, setUseDevnet] = useState(false);
  const [lastManifestItems, setLastManifestItems] = useState<{ index: number; name?: string; states: string[] }[]>([]);
  const [verifyResults, setVerifyResults] = useState<{ checked: number; failed: string[] } | null>(null);
  const [resumeSession, setResumeSession] = useState<CompletedUpload[] | null>(null);
  const [showWarning, setShowWarning] = useState(false);
  const [rareFiles, setRareFiles] = useState<File[]>([]);
  const rareInputRef = useRef<HTMLInputElement>(null);
  const zipInputRef = useRef<HTMLInputElement>(null);

  // localStorage key for resume
  const storageKey = `evo-bulk-${collectionName || 'unnamed'}-${stateNames.length}`;

  // Sync stateFiles when stateNames length changes (e.g. lifecycle type changed)
  useEffect(() => {
    setStateFiles(prev => {
      const next: File[][] = stateNames.map(() => []);
      stateNames.forEach((_, si) => { if (prev[si]) next[si] = prev[si]; });
      return next;
    });
  }, [stateNames.length]);

  // Check for resume session on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed: CompletedUpload[] = JSON.parse(saved);
        if (parsed.length > 0) {
          setResumeSession(parsed);
        }
      }
    } catch { /* ignore */ }
  }, [storageKey]);

  const saveProgress = useCallback((completed: CompletedUpload[]) => {
    try { localStorage.setItem(storageKey, JSON.stringify(completed)); } catch { /* ignore */ }
  }, [storageKey]);

  const clearProgress = useCallback(() => {
    try { localStorage.removeItem(storageKey); } catch { /* ignore */ }
    setResumeSession(null);
  }, [storageKey]);

  const totalFiles = stateFiles.reduce((sum, s) => sum + (s || []).length, 0);
  const totalBytes = stateFiles.reduce((sum, s) => sum + (s || []).reduce((b, f) => b + f.size, 0), 0);

  // Build skip set from resume session
  const buildSkipSet = useCallback((files: File[], stateIndex: number, completed: CompletedUpload[]): Set<string> => {
    if (!resumeSession) return new Set();
    const names = new Set(
      completed.filter(c => c.stateIndex === stateIndex).map(c => c.fileName)
    );
    return new Set(files.filter(f => names.has(f.name)).map(f => f.name));
  }, [resumeSession]);

  const estimateCost = useCallback(async () => {
    if (totalBytes === 0 || !wallet.connected) return;
    try {
      const cost = await estimateUploadCost(totalBytes, wallet, useDevnet);
      setCostEstimate(cost);
    } catch {
      setCostEstimate(null);
    }
  }, [totalBytes, wallet, useDevnet]);

  const handleStateDrop = useCallback(async (stateIndex: number, files: FileList | File[]) => {
    const fileArray = Array.from(files);
    const zips = fileArray.filter((f) => f.name.toLowerCase().endsWith('.zip'));
    const images = fileArray.filter((f) => f.type.startsWith('image/'));
    const jsons = fileArray.filter((f) => f.type === 'application/json');

    // Per-state ZIP: extract and assign ALL images to THIS state. The user
    // dropped on a specific state's drop zone, so we override the auto-grouping
    // that the combined-ZIP path uses — this is how creators upload each
    // state as its own ZIP (e.g. state1.zip, state2.zip).
    if (zips.length > 0) {
      setUploading(true);
      setPhase(`Extracting ${stateNames[stateIndex] ?? `State ${stateIndex + 1}`} ZIP…`);
      setError(null);
      try {
        const zipImages: File[] = [];
        const zipJsons: File[] = [];
        let count = 0;
        for (const zip of zips) {
          for await (const batch of unzipFilesStream(zip, 100)) {
            for (const f of batch) {
              if (f.type.startsWith('image/')) zipImages.push(f);
              else if (f.type === 'application/json') zipJsons.push(f);
            }
            count += batch.length;
            setPhase(`Extracting… ${count} files`);
          }
        }
        setStateFiles((prev) => {
          const next = [...prev];
          next[stateIndex] = [...next[stateIndex], ...zipImages];
          return next;
        });
        if (zipJsons.length > 0) setJsonFiles((prev) => [...prev, ...zipJsons]);
        setPhase('');
      } catch (err: any) {
        setError(`Failed to extract ZIP for ${stateNames[stateIndex] ?? `State ${stateIndex + 1}`}: ${err?.message || err}`);
        setPhase('');
      } finally {
        setUploading(false);
      }
      return;
    }

    setStateFiles((prev) => {
      const next = [...prev];
      next[stateIndex] = [...next[stateIndex], ...images];
      return next;
    });
    if (jsons.length > 0) {
      setJsonFiles((prev) => [...prev, ...jsons]);
    }
    setError(null);
  }, [stateNames]);

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
      let totalExtracted = 0;

      // When multiple ZIPs are dropped together in the combined dropzone,
      // treat it as "one ZIP per state" (e.g. images.zip + evolved_images.zip
      // assigned to State 1 + State 2, even if the collection is configured
      // for more states than that) and assign each ZIP's contents directly
      // to its positional state — same as the per-state drop zone. Relying
      // on folder-name matching (groupFilesByState) here silently dumps
      // everything into state 0 whenever the ZIP's internal folder isn't
      // literally named "state1"/"state2"/etc, which is the common case for
      // creators who name folders after their own artwork (e.g.
      // "images_256"/"evolved_images_256") — that bug is why bulk uploads
      // with more than one state looked like they only ever populated the
      // first state. This only applies up to the number of configured
      // states; extra ZIPs beyond that fall through to the folder-name
      // grouping below.
      if (zipFiles.length > 1 && zipFiles.length <= stateNames.length) {
        const perStateImages: File[][] = stateNames.map(() => []);
        const allJsons: File[] = [];

        for (let s = 0; s < zipFiles.length; s++) {
          for await (const batch of unzipFilesStream(zipFiles[s], 100)) {
            for (const f of batch) {
              if (f.type.startsWith('image/')) perStateImages[s].push(f);
              else if (f.type === 'application/json') allJsons.push(f);
            }
            totalExtracted += batch.length;
            setPhase(`Extracting… ${totalExtracted} files`);
          }
        }

        for (let s = 0; s < perStateImages.length; s++) {
          perStateImages[s].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
        }

        setStateFiles(perStateImages);
        setJsonFiles(allJsons);
        setPhase('');

        if (perStateImages.reduce((sum, s) => sum + s.length, 0) > 5000) {
          setShowWarning(true);
        }
        return;
      }

      const allImages: File[] = [];
      const allJsons: File[] = [];

      for (const zip of zipFiles) {
        for await (const batch of unzipFilesStream(zip, 100)) {
          for (const f of batch) {
            if (f.type.startsWith('image/')) allImages.push(f);
            else if (f.type === 'application/json') allJsons.push(f);
          }
          totalExtracted += batch.length;
          setPhase(`Extracting… ${totalExtracted} files`);
        }
      }

      const { images, jsons } = groupFilesByState([...allImages, ...allJsons], stateNames);
      setStateFiles(images);
      setJsonFiles(jsons);
      setPhase('');

      if (allImages.length > 5000) {
        setShowWarning(true);
      }
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

  // Generate thumbnail URLs for previews (first 6 per state)
  const [thumbnails, setThumbnails] = useState<string[][]>([]);
  useEffect(() => {
    const maxThumbs = 6;
    const allThumbs: string[][] = stateNames.map((_, si) => []);
    const filesToProcess = stateFiles.map((files, si) => files.slice(0, maxThumbs));

    const urls: string[] = [];
    filesToProcess.forEach((files, si) => {
      files.forEach((f) => {
        const url = URL.createObjectURL(f);
        urls.push(url);
        allThumbs[si].push(url);
      });
    });

    setThumbnails(allThumbs);
    return () => urls.forEach(u => URL.revokeObjectURL(u));
  }, [stateFiles, stateNames.length]);

  const doUpload = useCallback(async (filesToRetry?: FailedUpload[]) => {
    if (!wallet.connected || !wallet.publicKey) {
      setError('Connect your wallet first');
      return;
    }

    const filesPerState = filesToRetry
      ? (() => {
          const grouped = stateNames.map(() => [] as File[]);
          for (const f of filesToRetry) {
            if (grouped[f.stateIndex]) grouped[f.stateIndex].push(f.file);
          }
          return grouped;
        })()
      : stateFiles;

    const total = filesPerState.reduce((s, f) => s + f.length, 0);
    if (total === 0) {
      setError('Add at least one image');
      return;
    }

    setUploading(true);
    setError(null);
    setVerifying(false);
    setVerifyResults(null);
    setProgress({ uploaded: 0, total, failed: 0, currentFile: '' });

    const completed: CompletedUpload[] = resumeSession ? [...resumeSession] : [];
    const allResults: (UploadResult | null)[][] = [];
    let globalFailed: FailedUpload[] = [];

    try {
      for (let s = 0; s < filesPerState.length; s++) {
        const files = filesPerState[s];
        if (files.length === 0) { allResults.push([]); continue; }

        // Skip files already completed in resume session
        const skipNames = buildSkipSet(files, s, completed);
        const filesToUpload = files.filter(f => !skipNames.has(f.name));
        const skippedCount = files.length - filesToUpload.length;

        if (filesToUpload.length === 0) {
          // All files already uploaded — reconstruct from cache
          const cachedResults: (UploadResult | null)[] = files.map(f => {
            const cached = completed.find(c => c.fileName === f.name && c.stateIndex === s);
            return cached ? { txId: cached.txId, uri: `https://gateway.irys.xyz/${cached.txId}`, size: f.size, fileName: f.name } : null;
          });
          allResults.push(cachedResults);
          continue;
        }

        setPhase(`Bundling ${stateNames[s]} (${filesToUpload.length} files${skippedCount > 0 ? `, ${skippedCount} cached` : ''})…`);

        try {
          const { results: folderResults, failed: chunkFailed } = await uploadStateFolder(
            filesToUpload, s, wallet, useDevnet,
            (u, t, fn) => {
              setProgress({ uploaded: u + allResults.reduce((sum, r) => sum + r.length, 0), total, failed: 0, currentFile: fn });
            },
          );

          // Map folder results back to the original file array position
          const stateResults: (UploadResult | null)[] = new Array(files.length).fill(null);
          filesToUpload.forEach((f, fi) => {
            const origIdx = files.indexOf(f);
            const result = folderResults[fi];
            if (result && result.txId) {
              stateResults[origIdx] = result;
              completed.push({ fileName: f.name, txId: result.txId, stateIndex: s });
            }
          });

          // Add per-chunk failures
          globalFailed.push(...chunkFailed);

          // Fill in skipped (cached) files
          files.forEach((f, i) => {
            if (skipNames.has(f.name) && !stateResults[i]) {
              const cached = completed.find(c => c.fileName === f.name && c.stateIndex === s);
              if (cached) {
                stateResults[i] = { txId: cached.txId, uri: `https://gateway.irys.xyz/${cached.txId}`, size: f.size, fileName: f.name };
              }
            }
          });

          allResults.push(stateResults);
        } catch (err: any) {
          // Setup error (getIrys etc.) — mark all files as failed
          const errMsg = err?.response?.data || err?.message || String(err);
          filesToUpload.forEach(f => {
            globalFailed.push({ file: f, stateIndex: s, error: errMsg });
          });
          allResults.push(new Array(files.length).fill(null));
        }
        saveProgress(completed);
      }

      setFailedUploads(globalFailed);

      if (globalFailed.length > 0) {
        setError(`${globalFailed.length} files failed in bundle. You can retry or proceed with gaps.`);
      }

      // Build manifest
      const itemCount = Math.max(...allResults.map((r) => r.length), 0);
      const traits = await parseTraitsFromJsons(jsonFiles, itemCount);

      const items: { traits: Record<string, string>; stateUris: string[] }[] = [];
      for (let i = 0; i < itemCount; i++) {
        const stateUris: string[] = [];
        for (let s = 0; s < allResults.length; s++) {
          if (allResults[s][i]) {
            stateUris.push(`https://gateway.irys.xyz/${allResults[s][i]!.txId}`);
          } else {
            stateUris.push(allResults[0]?.[i] ? `https://gateway.irys.xyz/${allResults[0][i]!.txId}` : '');
          }
        }
        items.push({ traits: traits[i] || {}, stateUris });
      }

      setPhase('Building manifest…');
      const manifest = buildBulkManifest(
        collectionName || 'Unnamed',
        `${collectionName} — evolving EVO collection`,
        stateNames,
        items,
      );

      // Inject rare evolutions if enabled
      if (rareConfig?.enabled && rareFiles.length > 0 && manifest.items.length > 0) {
        setPhase('Uploading rare evolved forms…');
        const rareResults: UploadResult[] = [];
        const { results: rareUploadResults, failed: rareFailed } = await uploadStateFolder(
          rareFiles, 0, wallet, useDevnet,
          (u, _t, fn) => setProgress(p => ({ ...p, currentFile: `rare: ${fn}` })),
        );
        rareUploadResults.forEach(r => { if (r?.txId) rareResults.push(r); });
        globalFailed.push(...rareFailed);

        if (rareResults.length > 0) {
          const rareUris = rareResults.map(r => `https://gateway.irys.xyz/${r.txId}`);
          const assignments = injectRareEvolutions(manifest, rareUris, rareConfig.rate, rareConfig.seed);
          setPhase(`Injected ${assignments.length} rare evolutions (${(assignments.length / manifest.items.length * 100).toFixed(1)}%)…`);
        }
      }

      setPhase('Computing Merkle root…');
      const merkleRoot = await computeBulkMerkleRoot(manifest.items);

      // Verify a sample of uploads
      setVerifying(true);
      setPhase('Verifying uploads…');
      const allTxIds = manifest.items.flatMap(item => item.states.map(s => s.replace('https://gateway.irys.xyz/', '')));
      const failedVerifications = await verifyUploadsSample(allTxIds, 5);
      setVerifyResults({ checked: Math.min(5, allTxIds.length), failed: failedVerifications });
      setVerifying(false);

      if (failedVerifications.length > 0) {
        setError(`Warning: ${failedVerifications.length}/${Math.min(5, allTxIds.length)} sampled uploads couldn't be verified yet. Arweave propagation may still be in progress.`);
      }

      setPhase('Uploading manifest…');
      const manifestResult = await uploadJson(manifest, wallet, useDevnet);

      setLastManifestItems(manifest.items.map(it => ({ index: it.index, name: it.name, states: it.states })));
      onArtworkReady({
        manifest,
        manifestUri: `https://gateway.irys.xyz/${manifestResult.txId}`,
        merkleRoot,
        totalImages: total,
      });

      setPhase('Done!');
      clearProgress();
    } catch (err: any) {
      setError(`Upload failed: ${err?.message || err}`);
    } finally {
      setUploading(false);
      setVerifying(false);
    }
  }, [wallet, stateFiles, stateNames, collectionName, useDevnet, onArtworkReady, jsonFiles, resumeSession, buildSkipSet, saveProgress, clearProgress, rareConfig, rareFiles]);

  const retryFailed = useCallback(() => {
    if (failedUploads.length === 0) return;
    doUpload(failedUploads);
  }, [failedUploads, doUpload]);

  const discardAndStart = useCallback(() => {
    clearProgress();
    setFailedUploads([]);
    doUpload();
  }, [clearProgress, doUpload]);

  const resumeAndContinue = useCallback(() => {
    doUpload();
  }, [doUpload]);

  const pct = progress.total > 0 ? Math.round((progress.uploaded / progress.total) * 100) : 0;

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
        <p className="mt-0.5 text-[11px] text-muted">Auto-sorts by state + parses traits JSON</p>
        <input ref={zipInputRef} type="file" multiple accept=".zip" className="hidden" onChange={(e) => e.target.files && handleZipDrop(e.target.files)} />
      </div>

      {/* Resume prompt */}
      {resumeSession && resumeSession.length > 0 && !uploading && (
        <div className="flex items-center justify-between rounded-lg border border-accent/30 bg-accent/10 p-3">
          <div>
            <p className="text-xs font-semibold text-text">Previous upload found ({resumeSession.length} files completed)</p>
            <p className="text-[11px] text-muted">Resume to skip already-uploaded files, or discard to start fresh.</p>
          </div>
          <div className="flex gap-2">
            <button onClick={resumeAndContinue} className="rounded border border-accent bg-accent px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-accent-hover">Resume</button>
            <button onClick={clearProgress} className="rounded border border-border px-3 py-1.5 text-[11px] font-semibold text-muted hover:text-text">Discard</button>
          </div>
        </div>
      )}

      {/* Large collection warning */}
      {showWarning && totalFiles > 5000 && (
        <div className="flex items-start gap-2 rounded-lg border border-yellow-500/40 bg-yellow-500/10 p-3">
          <svg className="mt-0.5 h-4 w-4 shrink-0 text-yellow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.008v.008H12v-.008Z" />
          </svg>
          <div className="text-[11px] text-yellow-600">
            <p className="font-semibold">Large collection ({totalFiles.toLocaleString()} images)</p>
            <p className="mt-0.5">This may take a while and use significant browser memory. Keep this tab open. If the browser crashes, use Resume on your next visit.</p>
            <button onClick={() => setShowWarning(false)} className="mt-1 text-yellow-700 hover:underline">Dismiss</button>
          </div>
        </div>
      )}

      {/* Devnet warning */}
      {useDevnet && (
        <div className="flex items-start gap-2 rounded border border-yellow-500/30 bg-yellow-500/5 p-2.5">
          <svg className="mt-0.5 h-3.5 w-3.5 shrink-0 text-yellow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
          </svg>
          <p className="text-[10px] text-yellow-600">
            <span className="font-semibold">Devnet:</span> Free but data is temporary — pruned after ~60 days. Use mainnet for permanent storage.
          </p>
        </div>
      )}

      {/* Per-state drop zones with thumbnails */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
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
              <span className="text-[10px] text-muted">{(stateFiles[si] || []).length} files</span>
            </div>

            {/* Per-state ZIP / image file picker — accepts .zip or images */}
            <label className="mt-1.5 inline-flex cursor-pointer text-[10px] text-accent hover:underline">
              + Add ZIP or images
              <input
                type="file"
                accept=".zip,image/*"
                multiple
                className="hidden"
                onChange={(e) => { if (e.target.files) handleStateDrop(si, e.target.files); e.currentTarget.value = ''; }}
              />
            </label>

            {/* Thumbnails */}
            {thumbnails[si] && thumbnails[si].length > 0 && (
              <div className="mt-2 grid grid-cols-6 gap-1">
                {thumbnails[si].map((url, ti) => (
                  <img key={ti} src={url} alt="" className="h-10 w-10 rounded object-cover" />
                ))}
              </div>
            )}

            {(stateFiles[si] || []).length > 6 && (
              <p className="mt-1 text-[10px] text-dim">+{(stateFiles[si] || []).length - 6} more…</p>
            )}

            {(stateFiles[si] || []).length === 0 && (
              <p className="mt-2 text-[10px] text-dim">Drag images or a .zip here</p>
            )}
          </div>
        ))}
      </div>

      {/* Rare evolutions drop zone */}
      {rareConfig?.enabled && (
        <div
          onDrop={(e) => { e.preventDefault(); const imgs = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/')); setRareFiles(prev => [...prev, ...imgs]); }}
          onDragOver={(e) => e.preventDefault()}
          className="rounded-lg border-2 border-dashed border-accent/40 bg-accent/5 p-3"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-accent">RARE evolved forms</span>
            <span className="text-[10px] text-muted">{rareFiles.length} files</span>
          </div>
          <p className="mt-1 text-[10px] leading-relaxed text-muted">
            Drop a few rare images here — they'll be randomly assigned to ~{rareConfig.rate}% of items as their final evolved form. Reused across winners if fewer images than winners.
          </p>
          <label className="mt-1.5 inline-flex cursor-pointer text-[10px] text-accent hover:underline">
            + Add rare images
            <input
              ref={rareInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => { if (e.target.files) { const imgs = Array.from(e.target.files).filter(f => f.type.startsWith('image/')); setRareFiles(prev => [...prev, ...imgs]); } e.currentTarget.value = ''; }}
            />
          </label>
          {rareFiles.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {rareFiles.slice(0, 8).map((f, i) => (
                <div key={i} className="flex items-center gap-1 rounded bg-bg px-1.5 py-0.5 text-[9px] text-muted">
                  <span className="max-w-[80px] truncate">{f.name}</span>
                  <button onClick={() => setRareFiles(prev => prev.filter((_, j) => j !== i))} className="text-negative hover:text-text">x</button>
                </div>
              ))}
              {rareFiles.length > 8 && <span className="text-[9px] text-dim">+{rareFiles.length - 8} more</span>}
            </div>
          )}
        </div>
      )}

      {/* JSON traits indicator */}
      {jsonFiles.length > 0 && (
        <div className="flex items-center gap-2 text-[11px] text-muted">
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 0 0-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-.1-.664m-5.8 0A2.251 2.251 0 0 1 13.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.11-1.1.287M3.61 6.108c-.27.298-.46.622-.544.99" />
          </svg>
          <span>{jsonFiles.length} trait JSON file{jsonFiles.length !== 1 ? 's' : ''} detected — traits will be parsed into manifest</span>
        </div>
      )}

      {/* Summary + cost */}
      {totalFiles > 0 && (
        <div className="rounded-lg border border-border bg-surface p-3 text-xs">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-muted">
              {totalFiles} images · {(totalBytes / 1_000_000).toFixed(1)} MB
              {jsonFiles.length > 0 && ` · ${jsonFiles.length} JSON`}
            </span>
            {costEstimate !== null && (
              <span className="font-mono text-text">
                ~{costEstimate.toFixed(4)} SOL {!useDevnet && <span className="text-dim">(est. range ±10%)</span>}
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
      {(uploading || verifying) && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-[11px]">
            <span className="font-medium text-text">
              {verifying ? 'Verifying uploads…' : phase}
            </span>
            <span className="text-muted">
              {progress.uploaded}/{progress.total}
              {progress.failed > 0 && ` · ${progress.failed} failed`}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-surface-2">
            <div
              className="h-full rounded-full bg-accent transition-all duration-300"
              style={{ width: `${verifying ? 100 : pct}%` }}
            />
          </div>
          {progress.currentFile && !verifying && (
            <p className="truncate text-[10px] text-dim">{progress.currentFile}</p>
          )}
        </div>
      )}

      {/* Verify results */}
      {verifyResults && !uploading && (
        <div className={`flex items-center gap-2 rounded p-2.5 text-[11px] ${verifyResults.failed.length === 0 ? 'border border-positive/40 bg-positive/10 text-positive' : 'border border-yellow-500/40 bg-yellow-500/10 text-yellow-600'}`}>
          {verifyResults.failed.length === 0 ? (
            <><IconCheck /> {verifyResults.checked} uploads verified on Arweave gateway</>
          ) : (
            <>{verifyResults.failed.length}/{verifyResults.checked} uploads pending propagation (may still be processing)</>
          )}
        </div>
      )}

      {/* Failed uploads + retry */}
      {failedUploads.length > 0 && !uploading && (
        <div className="space-y-2">
          <div className="flex items-start gap-2 rounded border border-negative/40 bg-negative/10 p-2.5 text-[11px] text-negative">
            <svg className="mt-0.5 h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
            </svg>
            <span>{failedUploads.length} uploads failed. Retry them, or proceed (gaps will use placeholder).</span>
          </div>
          <details className="text-[10px] text-muted">
            <summary className="cursor-pointer hover:text-text">View error details ({Math.min(5, failedUploads.length)} shown)</summary>
            <ul className="mt-1 space-y-0.5 pl-3">
              {failedUploads.slice(0, 5).map((f, i) => (
                <li key={i} className="truncate">
                  <span className="text-negative">{f.file.name}</span>: {f.error}
                </li>
              ))}
            </ul>
          </details>
          <div className="flex gap-2">
            <button
              onClick={retryFailed}
              className="rounded border border-accent bg-accent px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-accent-hover"
            >
              Retry {failedUploads.length} failed
            </button>
            <button
              onClick={() => setFailedUploads([])}
              className="rounded border border-border px-3 py-1.5 text-[11px] font-semibold text-muted hover:text-text"
            >
              Ignore & proceed
            </button>
          </div>
        </div>
      )}

      {/* Upload button */}
      {totalFiles > 0 && !uploading && failedUploads.length === 0 && (
        <button
          onClick={discardAndStart}
          disabled={!wallet.connected}
          className="inline-flex w-full items-center justify-center gap-2 rounded border border-accent bg-accent px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-accent-hover disabled:opacity-50"
        >
          {wallet.connected ? `Upload ${totalFiles} images to Arweave` : 'Connect wallet to upload'}
        </button>
      )}

      {/* Retry-specific upload button */}
      {totalFiles > 0 && !uploading && failedUploads.length > 0 && (
        <button
          onClick={retryFailed}
          disabled={!wallet.connected}
          className="inline-flex w-full items-center justify-center gap-2 rounded border border-accent bg-accent px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-accent-hover disabled:opacity-50"
        >
          Retry {failedUploads.length} failed uploads
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

      {/* Post-upload gallery preview */}
      {phase === 'Done!' && lastManifestItems.length > 0 && (
        <PostUploadGallery items={lastManifestItems} stateNames={stateNames} />
      )}
    </div>
  );
}

function PostUploadGallery({ items, stateNames }: { items: { index: number; name?: string; states: string[] }[]; stateNames: string[] }) {
  const [selectedState, setSelectedState] = useState(0);
  const [previewCount, setPreviewCount] = useState(12);
  const [imgErrors, setImgErrors] = useState<Set<number>>(new Set());

  const previewItems = items.slice(0, previewCount);

  return (
    <div className="rounded-lg border border-positive/40 bg-positive/5 p-3">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <svg className="h-4 w-4 text-positive" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
          </svg>
          <span className="text-xs font-bold text-positive">Upload Complete — Preview Gallery</span>
        </div>
        <span className="text-[10px] text-dim">{items.length} items total</span>
      </div>

      {/* State selector */}
      <div className="mb-2 flex flex-wrap gap-1.5">
        {stateNames.map((name, i) => (
          <button key={i} onClick={() => setSelectedState(i)}
            className={`rounded px-2 py-1 text-[10px] font-semibold transition-colors ${selectedState === i ? 'bg-accent text-white' : 'border border-border-strong bg-surface text-muted hover:text-text'}`}>
            {name}
          </button>
        ))}
      </div>

      {/* Image grid */}
      <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 md:grid-cols-8">
        {previewItems.map((item) => {
          const uri = item.states[selectedState];
          const idx = item.index;
          const hasError = imgErrors.has(idx);
          return (
            <div key={idx} className="relative aspect-square overflow-hidden rounded border border-border bg-bg">
              {uri && !hasError ? (
                <img src={uri} alt={`#${idx}`} className="h-full w-full pixelated object-cover"
                  style={{ imageRendering: 'pixelated' }}
                  onError={() => setImgErrors(prev => new Set(prev).add(idx))} />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-[10px] text-dim">
                  {hasError ? '⚠' : '…'}
                </div>
              )}
              <span className="absolute bottom-0 left-0 right-0 bg-bg/70 px-1 py-0.5 text-center text-[8px] font-mono text-muted backdrop-blur-sm">
                #{idx}
              </span>
            </div>
          );
        })}
      </div>

      {previewCount < items.length && (
        <button onClick={() => setPreviewCount(Math.min(previewCount + 12, items.length))}
          className="mt-2 w-full rounded border border-border-strong py-1.5 text-[11px] font-semibold text-muted transition-colors hover:text-text">
          Show more ({items.length - previewCount} remaining)
        </button>
      )}
    </div>
  );
}

function IconCheck() {
  return (
    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
    </svg>
  );
}