'use client';

import { useState, useCallback, useRef } from 'react';
import {
  processImageFile,
  buildCollectionManifest,
  computeManifestCid,
  computeStateMerkleRoot,
  isImageFile,
  isJsonFile,
  type UploadedImage,
  type CollectionManifest,
} from '@/lib/artwork-upload';

export interface ArtworkResult {
  images: UploadedImage[];
  manifest: CollectionManifest;
  manifestCid: string;
  manifestUri: string;
  merkleRoot: string;
}

interface Props {
  collectionName: string;
  maxStates: number;
  onArtworkReady: (result: ArtworkResult | null) => void;
}

export function ArtworkDropzone({ collectionName, maxStates, onArtworkReady }: Props) {
  const [images, setImages] = useState<UploadedImage[]>([]);
  const [jsonContent, setJsonContent] = useState<CollectionManifest | null>(null);
  const [dragging, setDragging] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processFiles = useCallback(async (files: FileList | File[]) => {
    const fileArray = Array.from(files);
    if (fileArray.length === 0) return;

    setProcessing(true);
    setError(null);

    try {
      const imageFiles = fileArray.filter(isImageFile);
      const jsonFiles = fileArray.filter(isJsonFile);

      let parsedManifest: CollectionManifest | null = null;
      if (jsonFiles.length > 0) {
        try {
          const text = await jsonFiles[0].text();
          parsedManifest = JSON.parse(text);
          setJsonContent(parsedManifest);
        } catch {
          setError('Could not parse JSON file. Make sure it is valid JSON.');
        }
      }

      if (imageFiles.length === 0 && !parsedManifest) {
        setError('No image or JSON files found. Drag images and/or a manifest.json.');
        setProcessing(false);
        return;
      }

      const desiredCount = parsedManifest?.lifecycle?.maxStates || maxStates || imageFiles.length;
      if (imageFiles.length > desiredCount) {
        setError(`Found ${imageFiles.length} images but max states is ${desiredCount}. Extra images will be ignored.`);
      }

      const toProcess = imageFiles.slice(0, desiredCount);
      const processed = await Promise.all(toProcess.map(processImageFile));

      const newImages = [...images, ...processed].slice(0, desiredCount);
      setImages(newImages);
      await rebuild(newImages, parsedManifest);
    } catch (err: any) {
      setError(err?.message || 'Failed to process files.');
    } finally {
      setProcessing(false);
    }
  }, [images, maxStates, collectionName]);

  const rebuild = useCallback(async (imgs: UploadedImage[], manifestOverride?: CollectionManifest | null) => {
    if (imgs.length === 0) {
      onArtworkReady(null);
      return;
    }
    const manifest = manifestOverride || await buildCollectionManifest(
      collectionName || 'unnamed',
      'EVO collection',
      imgs,
    );
    const manifestCid = await computeManifestCid(manifest);
    const stateUris = manifest.lifecycle.states.map((s) => s.image);
    const merkleRoot = await computeStateMerkleRoot(stateUris);

    onArtworkReady({
      images: imgs,
      manifest,
      manifestCid,
      manifestUri: `ipfs://${manifestCid}`,
      merkleRoot,
    });
  }, [collectionName, onArtworkReady]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    processFiles(e.dataTransfer.files);
  }, [processFiles]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
  }, []);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) processFiles(e.target.files);
    e.target.value = '';
  }, [processFiles]);

  const removeImage = useCallback((index: number) => {
    const next = images.filter((_, i) => i !== index);
    setImages(next);
    rebuild(next, jsonContent);
  }, [images, jsonContent, rebuild]);

  const reorderImage = useCallback((from: number, to: number) => {
    if (from === to) return;
    const next = [...images];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    setImages(next);
    rebuild(next, jsonContent);
  }, [images, jsonContent, rebuild]);

  return (
    <div className="space-y-3">
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => fileInputRef.current?.click()}
        className={`cursor-pointer rounded-lg border-2 border-dashed p-6 text-center transition-colors ${
          dragging ? 'border-accent bg-accent-soft' : 'border-border hover:border-accent/50'
        }`}
      >
        <svg className="mx-auto h-8 w-8 text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12L12 7.5m0 0L7.5 12M12 7.5v9" />
        </svg>
        <p className="mt-2 text-sm font-semibold text-text">
          {processing ? 'Processing…' : 'Drag images + JSON here'}
        </p>
        <p className="mt-1 text-[11px] text-muted">
          Drop {maxStates > 1 ? `${maxStates} state images` : '1 image'} and optional manifest.json.
          {maxStates > 1 && ' One image per visual state.'}
        </p>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*,application/json"
          onChange={handleFileSelect}
          className="hidden"
        />
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded border border-negative/40 bg-negative/10 p-2 text-[11px] text-negative">
          <svg className="mt-0.5 h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
          </svg>
          <span>{error}</span>
        </div>
      )}

      {images.length > 0 && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {images.map((img, i) => (
            <div
              key={img.cid}
              draggable
              onDragStart={() => setDragIndex(i)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                if (dragIndex !== null) reorderImage(dragIndex, i);
                setDragIndex(null);
              }}
              className="group relative overflow-hidden rounded-lg border border-border bg-surface"
            >
              <div className="relative aspect-square">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={img.base64Preview} alt={img.fileName} className="h-full w-full object-cover" />
                <div className="absolute left-1 top-1 rounded bg-black/70 px-1.5 py-0.5 text-[9px] font-bold text-white">
                  State {i + 1}
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    removeImage(i);
                  }}
                  className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded bg-black/70 text-white opacity-0 transition-opacity group-hover:opacity-100"
                  aria-label="Remove image"
                >
                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="p-1.5">
                <p className="truncate text-[10px] font-medium text-text">{img.fileName}</p>
                <p className="truncate text-[9px] text-muted">{img.cid.slice(0, 12)}…{img.cid.slice(-4)}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {images.length > 0 && (
        <div className="rounded border border-border bg-surface p-2.5 text-[10px] text-muted">
          <p className="font-semibold text-text">Generated manifest</p>
          <p className="mt-0.5">IPFS CIDs computed locally. Pin to IPFS before mainnet — gateways will resolve once pinned.</p>
          <p className="mt-1 font-mono text-text">{images.length} state(s) → Merkle root auto-filled below.</p>
        </div>
      )}
    </div>
  );
}