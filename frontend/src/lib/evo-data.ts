// Bridge between on-chain EVOAccount data and display format
// Also provides the EVOData interface used by UI components

import { CREATURES, Creature, getStageFromFacets, Stage } from './creatures';
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
  creatureId: string;
  creature: Creature;
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
  // Lifecycle state from protocol
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
}

const GROWTH_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days per facet

export function computeFacets(forgedAt: number): number {
  const now = Date.now();
  const elapsed = now - forgedAt;
  return Math.min(100, Math.floor(elapsed / GROWTH_INTERVAL_MS));
}

function genericCreature(evoId: number, collectionName: string): Creature {
  const id = `${collectionName}-${evoId}`;
  return {
    id,
    name: id,
    displayName: `${collectionName} #${evoId}`,
    element: 'Void',
    rarity: 'Common',
    stages: { baby: '', juvenile: '', adult: '', elder: '' },
    baseSprite: '',
  };
}

// Map an on-chain EVOAccount to display EVOData
// creatures and collectionName are optional — generic display used when not provided
export function evoAccountToData(
  evo: EVOAccount,
  creatures?: Creature[],
  collectionName?: string,
): EVOData | null {
  // Use mintIndex as evoId fallback (needed for getProgramAccounts reads)
  if (evo.evoId === undefined) {
    if (evo.mintIndex !== undefined) evo.evoId = evo.mintIndex;
    else return null;
  }

  const creature = creatures && creatures.length > 0
    ? creatures[evo.evoId % creatures.length]
    : genericCreature(evo.evoId, collectionName || 'EVO');

  const seedHex = Buffer.from(evo.resonanceSeed).toString('hex');

  return {
    id: evo.evoId,
    creatureId: creature.id,
    creature,
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
  };
}

export function getStage(evo: EVOData): Stage {
  return getStageFromFacets(evo.facetCount);
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

export { CREATURES };