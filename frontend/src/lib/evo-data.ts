// Bridge between on-chain EVOAccount data and display format
// Generic for ALL collections — no hardcoded collection-specific data.
// Visual identity (images, stage names, etc.) comes from the collection's
// visual manifest (fetched from metadata_uri), not from this file.

import { EVOAccount, CollectionConfig, lamportsToSol } from './evo-program';
import type { PublicKey } from '@solana/web3.js';

export interface FractureLineDisplay {
  tradeNumber: number;
  previousOwner: string;
  timestamp: number;
  position: number;
  intensity: number;
}

export interface EVOData {
  id: number;
  name: string;
  owner: string;
  lockedLamports: number; // displayed in SOL
  forgedAt: number; // unix timestamp (ms)
  facetCount: number;
  tradeCount: number;
  resonanceSeed: string; // hex
  fractureLines: FractureLineDisplay[];
  isListed: boolean;
  listPrice: number | null; // in SOL
  isShattered: boolean;
  // Lifecycle state from protocol (source of truth for visual stage)
  currentState: number;
  // On-chain references
  evoPda?: string;
  collectionPda?: string;
  collectionName?: string;
}

export interface CollectionData {
  name: string;
  creator: string;
  supplyCap: number;
  currentSupply: number;
  shatterFeeBps: number;
  tradeRoyaltyBps: number;
  mintPriceSol: number;
  lockAmountSol: number;
  bump: number;
  metadataUri: string;
  lifecycleType: string;
  maxStates: number;
  isRevealed: boolean;
  artworkManifestHash: Uint8Array;
}

// Map an on-chain EVOAccount to display EVOData
// collectionName is used to generate a display name when no manifest name is available
export function evoAccountToData(
  evo: EVOAccount,
  collectionName?: string,
): EVOData | null {
  if (evo.evoId === undefined) {
    if (evo.mintIndex !== undefined) evo.evoId = evo.mintIndex;
    else return null;
  }

  const name = `${collectionName || 'EVO'} #${evo.evoId}`;
  const seedHex = Buffer.from(evo.resonanceSeed).toString('hex');

  return {
    id: evo.evoId,
    name,
    owner: evo.owner.toBase58(),
    lockedLamports: lamportsToSol(evo.lockedLamports),
    forgedAt: evo.forgedAt,
    facetCount: evo.facetCount,
    tradeCount: evo.tradeCount,
    resonanceSeed: seedHex,
    fractureLines: evo.fractureLines.map(fl => ({
      tradeNumber: fl.tradeNumber,
      previousOwner: fl.previousOwner.toBase58().slice(0, 8) + '...',
      timestamp: fl.timestamp,
      position: fl.position,
      intensity: fl.intensity,
    })),
    isListed: evo.isListed,
    listPrice: evo.isListed ? lamportsToSol(evo.listPriceLamports) : null,
    isShattered: evo.isShattered,
    currentState: evo.currentState,
    evoPda: evo.pda?.toBase58(),
    collectionPda: evo.collection.toBase58(),
    collectionName: collectionName,
  };
}

export function collectionConfigToData(cfg: CollectionConfig): CollectionData {
  return {
    name: cfg.name,
    creator: cfg.creator.toBase58(),
    supplyCap: cfg.supplyCap,
    currentSupply: cfg.currentSupply,
    shatterFeeBps: cfg.shatterFeeBps,
    tradeRoyaltyBps: cfg.tradeRoyaltyBps,
    mintPriceSol: lamportsToSol(cfg.mintPriceLamports),
    lockAmountSol: lamportsToSol(cfg.lockAmountLamports),
    bump: cfg.bump,
    metadataUri: cfg.metadataUri,
    lifecycleType: cfg.lifecycleType,
    maxStates: cfg.maxStates,
    isRevealed: cfg.isRevealed,
    artworkManifestHash: cfg.artworkManifestHash,
  };
}

export function getAgeString(forgedAt: number): string {
  const now = Date.now();
  const elapsed = now - forgedAt;
  const days = Math.floor(elapsed / (24 * 60 * 60 * 1000));
  if (days < 1) return 'Today';
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${(days / 365).toFixed(1)}y ago`;
}