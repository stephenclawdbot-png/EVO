// Bridge between on-chain EVOAccount data and display format
// Generic for ALL collections — no hardcoded collection-specific data.
// Visual identity (images, stage names, etc.) comes from the collection's
// visual manifest (fetched from metadata_uri), not from this file.

import { EVOAccount, CollectionConfig, lamportsToSol, getEvoPDA, getListingPDA, parseListingAccount, readListing } from './evo-program';
import { Connection, PublicKey } from '@solana/web3.js';

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
  listPrice: number | null; // in SOL (from Listing PDA, null if not listed)
  listPriceLamports: number | null; // raw lamports from Listing PDA
  isShattered: boolean;
  // Lifecycle state from protocol (source of truth for visual stage)
  currentState: number;
  totalFedLamports: number; // for evolution progress display
  lastTransitionAt: number; // unix timestamp (ms)
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
  shatterFeeDestination: string;
  royaltyDestination: string;
  // Evolution thresholds
  evolveTradeThreshold: number;
  evolveFeedThreshold: number;   // lamports
  evolveHoldSeconds: number;
  evolveLockedThreshold: number; // lamports
}

// Map an on-chain EVOAccount to display EVOData
// collectionName is used to generate a display name when no manifest name is available
export function evoAccountToData(
  evo: EVOAccount,
  collectionName?: string,
): EVOData | null {
  if (evo.evoId === undefined) {
    if (evo.mintIndex !== undefined) {
      // Try mintIndex first (fast path), then verify against PDA
      if (evo.pda && evo.collection) {
        const [testPda] = getEvoPDA(evo.collection, evo.mintIndex);
        if (testPda.equals(evo.pda)) {
          evo.evoId = evo.mintIndex;
        } else {
          return null; // Cannot determine evoId without PDA match
        }
      } else {
        evo.evoId = evo.mintIndex;
      }
    } else {
      return null;
    }
  }

  const name = `${collectionName || 'EVO'} #${evo.evoId}`;
  const seedHex = Buffer.from(evo.resonanceSeed).toString('hex');

  return {
    id: evo.evoId,
    name,
    owner: evo.owner.toBase58(),
    lockedLamports: lamportsToSol(evo.lockedLamports),
    forgedAt: Number(evo.forgedAt) * 1000,
    facetCount: evo.facetCount,
    tradeCount: evo.tradeCount,
    resonanceSeed: seedHex,
    fractureLines: evo.fractureLines.map(fl => ({
      tradeNumber: fl.tradeNumber,
      previousOwner: fl.previousOwner.toBase58().slice(0, 8) + '...',
      // Fracture-line timestamps are on-chain unix SECONDS; getAgeString (and
      // forgedAt/lastTransitionAt) work in MILLISECONDS — convert so the
      // Activity tab shows correct ages instead of "56y ago".
      timestamp: Number(fl.timestamp) * 1000,
      position: fl.position,
      intensity: fl.intensity,
    })),
    isListed: false, // populated by mergeListingData
    listPrice: null,
    listPriceLamports: null,
    isShattered: evo.isShattered,
    currentState: evo.currentState,
    totalFedLamports: Number(evo.totalFedLamports),
    lastTransitionAt: Number(evo.lastTransitionAt) * 1000,
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
    shatterFeeDestination: cfg.shatterFeeDestination,
    royaltyDestination: cfg.royaltyDestination,
    evolveTradeThreshold: cfg.evolveTradeThreshold,
    evolveFeedThreshold: Number(cfg.evolveFeedThreshold),
    evolveHoldSeconds: Number(cfg.evolveHoldSeconds),
    evolveLockedThreshold: Number(cfg.evolveLockedThreshold),
  };
}

/**
 * Invalidate the home page's localStorage collections cache (any version).
 * Call after ANY successful state-changing transaction (forge, feed, buy,
 * shatter, list, delist, transfer) so the home page's stats (minted count,
 * locked SOL, floor) refresh instead of serving up-to-60s-stale data.
 * Safe to call anywhere — no-ops outside the browser.
 */
export function invalidateCollectionsCache(): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    const stale: string[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (key && key.startsWith('evo_collections')) stale.push(key);
    }
    stale.forEach(k => window.localStorage.removeItem(k));
  } catch { /* storage unavailable (private mode etc.) — ignore */ }
}

export function isReadyToEvolve(
  evo: EVOData,
  t: { trade: number; feed: number; hold: number; locked: number;
       maxStates: number; lifecycleType: string },
  isRevealed: boolean,
): boolean {
  const next = evo.currentState + 1;
  return isRevealed &&
    (t.lifecycleType === 'RevealAndEvolve' || t.lifecycleType === 'Custom') &&
    evo.currentState < t.maxStates - 1 && !evo.isShattered &&
    (t.trade === 0 || evo.tradeCount >= t.trade * next) &&
    (t.feed === 0 || evo.totalFedLamports >= t.feed * next) &&
    (t.hold === 0 || (Date.now() - evo.lastTransitionAt) / 1000 >= t.hold * next) &&
    (t.locked === 0 || evo.lockedLamports * 1e9 >= t.locked * next);
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

/**
 * Fetch listing data for a list of EVOs and merge isListed/listPrice into EvoData.
 * Uses getMultipleAccountsInfo for batch efficiency.
 */
export async function mergeListingData(
  conn: Connection,
  evos: EVOData[],
): Promise<EVOData[]> {
  if (evos.length === 0) return evos;
  const listingPdas: PublicKey[] = [];
  const evoPdaMap = new Map<string, number>();

  for (let i = 0; i < evos.length; i++) {
    const evo = evos[i];
    if (!evo.evoPda) continue;
    const evoPk = new PublicKey(evo.evoPda);
    const [listingPda] = getListingPDA(evoPk);
    listingPdas.push(listingPda);
    evoPdaMap.set(listingPda.toBase58(), i);
  }

  if (listingPdas.length === 0) return evos;

  const accounts = await conn.getMultipleAccountsInfo(listingPdas);
  for (let j = 0; j < accounts.length; j++) {
    const acc = accounts[j];
    if (!acc || !acc.data) continue;
    const listing = parseListingAccount(acc.data);
    if (!listing) continue;
    const idx = evoPdaMap.get(listingPdas[j].toBase58());
    if (idx === undefined) continue;
    evos[idx].isListed = true;
    evos[idx].listPrice = lamportsToSol(listing.priceLamports);
    evos[idx].listPriceLamports = Number(listing.priceLamports);
  }
  return evos;
}

/** Fetch a single EVO's listing data and merge into EvoData */
export async function mergeSingleListing(
  conn: Connection,
  evo: EVOData,
): Promise<EVOData> {
  if (!evo.evoPda) return evo;
  const evoPk = new PublicKey(evo.evoPda);
  const listing = await readListing(conn, evoPk);
  if (listing) {
    evo.isListed = true;
    evo.listPrice = lamportsToSol(listing.priceLamports);
    evo.listPriceLamports = Number(listing.priceLamports);
  }
  return evo;
}