// Display helpers — compute human-readable values from raw on-chain data.

import { EVOAccount, EvoDisplayData, EvoStage } from './types';
import { LAMPORTS_PER_SOL, FACET_GROWTH_INTERVAL_MS, MAX_FACETS } from './constants';

/** Determine evolution stage from facet count. */
export function getStage(facetCount: number): EvoStage {
  if (facetCount < 10) return 'baby';
  if (facetCount < 30) return 'juvenile';
  if (facetCount < 60) return 'adult';
  return 'elder';
}

/** Compute current facet count from forgedAt timestamp (view function). */
export function computeCurrentFacets(forgedAt: number): number {
  const now = Date.now();
  const elapsed = now - forgedAt * 1000;
  if (elapsed <= 0) return 0;
  return Math.min(MAX_FACETS, Math.floor(elapsed / FACET_GROWTH_INTERVAL_MS));
}

/** Format age as a human-readable string. */
export function getAgeString(forgedAt: number): string {
  const now = Date.now();
  const elapsed = now - forgedAt * 1000;
  const days = Math.floor(elapsed / (24 * 60 * 60 * 1000));
  if (days < 1) return 'Today';
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${(days / 365).toFixed(1)}y ago`;
}

/** Convert lamports to SOL. */
export function lamportsToSol(lamports: number): number {
  return lamports / LAMPORTS_PER_SOL;
}

/** Convert SOL to lamports. */
export function solToLamports(sol: number): number {
  return Math.round(sol * LAMPORTS_PER_SOL);
}

/** Build display data from a raw EVO account. */
export function toDisplayData(account: EVOAccount): EvoDisplayData {
  return {
    account,
    lockedSol: lamportsToSol(account.lockedLamports),
    stage: getStage(account.facetCount),
    ageString: getAgeString(account.forgedAt),
    totalValueSol: lamportsToSol(account.lockedLamports),
    listPriceSol: account.listPriceLamports ? lamportsToSol(account.listPriceLamports) : null,
  };
}