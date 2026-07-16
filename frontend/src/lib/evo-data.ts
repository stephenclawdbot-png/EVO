// Simulated EVO on-chain data for demo purposes
// In production, this would be read from Solana PDAs via @solana/web3.js

import { CREATURES, Creature, getStageFromFacets, Stage } from './creatures';

export interface FractureLine {
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
  lockedLamports: number; // in SOL (not lamports for demo)
  forgedAt: number; // timestamp
  facetCount: number;
  tradeCount: number;
  resonanceSeed: string; // hex
  fractureLines: FractureLine[];
  isListed: boolean;
  listPrice: number | null;
  isShattered: boolean;
}

// Deterministic pseudo-random from seed
function seededRandom(seed: string): () => number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = ((h << 5) - h) + seed.charCodeAt(i);
    h |= 0;
  }
  return () => {
    h = (h * 1103515245 + 12345) & 0x7fffffff;
    return h / 0x7fffffff;
  };
}

const GROWTH_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

function computeFacets(forgedAt: number): number {
  const now = Date.now();
  const elapsed = now - forgedAt;
  return Math.min(100, Math.floor(elapsed / GROWTH_INTERVAL_MS));
}

// Generate demo EVOs — one per creature, with varied states
export function generateDemoEVOs(): EVOData[] {
  const now = Date.now();
  const evos: EVOData[] = [];

  CREATURES.forEach((creature, index) => {
    const seed = `${creature.id}-evo-${index}`;
    const rng = seededRandom(seed);

    // Vary the forged time: some ancient, some new
    const ageWeeks = Math.floor(rng() * 104); // 0-104 weeks (2 years)
    const forgedAt = now - ageWeeks * 7 * 24 * 60 * 60 * 1000;
    const facets = computeFacets(forgedAt);

    // Vary locked SOL: 0.05 to 50
    const lockedSol = Math.round((0.05 + rng() * 49.95) * 1000) / 1000;

    // Vary trade count: 0 to 8
    const tradeCount = Math.floor(rng() * 9);

    // Generate fracture lines from trades
    const fractureLines: FractureLine[] = [];
    for (let t = 1; t <= tradeCount; t++) {
      fractureLines.push({
        tradeNumber: t,
        previousOwner: `0x${Math.floor(rng() * 0xffffff).toString(16).padStart(6, '0')}`,
        timestamp: forgedAt + Math.floor(rng() * (now - forgedAt)),
        position: Math.floor(rng() * 360),
        intensity: Math.floor(rng() * 100),
      });
    }

    // Some are listed
    const isListed = rng() < 0.15;
    const listPrice = isListed ? Math.round((lockedSol * (1.2 + rng() * 3)) * 1000) / 1000 : null;

    // Some are shattered (5%)
    const isShattered = rng() < 0.05;

    evos.push({
      id: index,
      creatureId: creature.id,
      creature,
      owner: `0x${Math.floor(rng() * 0xffffff).toString(16).padStart(6, '0')}`,
      lockedLamports: lockedSol,
      forgedAt,
      facetCount: facets,
      tradeCount,
      resonanceSeed: seed.slice(0, 32).padEnd(32, '0'),
      fractureLines,
      isListed,
      listPrice,
      isShattered,
    });
  });

  return evos;
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