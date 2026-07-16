// Cat Collection — 50 EVOs generated from a single cat pixel art image
// Demonstrates the EVO concept: 1 base image → many unique outputs

export type CatElement = 'Terra' | 'Aqua' | 'Flora' | 'Ignis' | 'Aero' | 'Void' | 'Lux';
export type CatStage = 'baby' | 'juvenile' | 'adult' | 'elder';

export interface CatFractureLine {
  tradeNumber: number;
  previousOwner: string;
  timestamp: number;
  position: number;
  intensity: number;
}

export interface CatEVO {
  id: number;
  name: string;
  owner: string;
  lockedSol: number;
  forgedAt: number;
  facetCount: number;
  tradeCount: number;
  resonanceSeed: string;
  element: CatElement;
  fractureLines: CatFractureLine[];
  isListed: boolean;
  listPrice: number | null;
  isShattered: boolean;
}

export const CAT_ELEMENT_COLORS: Record<CatElement, string> = {
  Terra: '#8b5a2b',
  Aqua: '#40a4df',
  Flora: '#50c878',
  Ignis: '#ff6432',
  Aero: '#b4c8dc',
  Void: '#8a2be2',
  Lux: '#ffd700',
};

export const CAT_STAGE_NAMES: Record<CatStage, string> = {
  baby: 'Kitten',
  juvenile: 'Young',
  adult: 'Adult',
  elder: 'Ancient',
};

const ELEMENTS: CatElement[] = ['Terra', 'Aqua', 'Flora', 'Ignis', 'Aero', 'Void', 'Lux'];

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

const GROWTH_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000;

function computeFacets(forgedAt: number): number {
  const now = Date.now();
  const elapsed = now - forgedAt;
  return Math.min(100, Math.floor(elapsed / GROWTH_INTERVAL_MS));
}

export function getCatStage(facetCount: number): CatStage {
  if (facetCount < 10) return 'baby';
  if (facetCount < 30) return 'juvenile';
  if (facetCount < 60) return 'adult';
  return 'elder';
}

export function getCatAgeString(forgedAt: number): string {
  const now = Date.now();
  const elapsed = now - forgedAt;
  const days = Math.floor(elapsed / (24 * 60 * 60 * 1000));
  if (days < 1) return 'Today';
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${(days / 365).toFixed(1)}y ago`;
}

const CAT_NAMES = [
  'Whiskers', 'Shadow', 'Luna', 'Mochi', 'Pixel', 'Noodle', 'Biscuit', 'Tofu',
  'Mango', 'Cosmo', 'Pickle', 'Salem', 'Boba', 'Ginger', 'Waffle', 'Pepper',
  'Yuki', 'Onigiri', 'Cleo', 'Miso', 'Tiger', 'Pumpkin', 'Sushi', 'Honey',
  'Velvet', 'Ember', 'Frost', 'Jasper', 'Iris', 'Olive', 'Plum', 'Coco',
  'Nimbus', 'Echo', 'Fig', 'Pistachio', 'Marble', 'Sage', 'Coral', 'Dusk',
  'Fable', 'Ghost', 'Hazel', 'Indigo', 'Juno', 'Koi', 'Lotus', 'Moss',
  'Nova', 'Opal',
];

export function generateCatEVOs(): CatEVO[] {
  const now = Date.now();
  const evos: CatEVO[] = [];

  for (let i = 0; i < 50; i++) {
    const seed = `cat-evo-${i}`;
    const rng = seededRandom(seed);

    const ageWeeks = Math.floor(rng() * 104);
    const forgedAt = now - ageWeeks * 7 * 24 * 60 * 60 * 1000;
    const facets = computeFacets(forgedAt);
    const lockedSol = Math.round((0.05 + rng() * 49.95) * 1000) / 1000;
    const tradeCount = Math.floor(rng() * 9);
    const element = ELEMENTS[Math.floor(rng() * ELEMENTS.length)];

    const fractureLines: CatFractureLine[] = [];
    for (let t = 1; t <= tradeCount; t++) {
      fractureLines.push({
        tradeNumber: t,
        previousOwner: `0x${Math.floor(rng() * 0xffffff).toString(16).padStart(6, '0')}`,
        timestamp: forgedAt + Math.floor(rng() * (now - forgedAt)),
        position: Math.floor(rng() * 360),
        intensity: Math.floor(rng() * 100),
      });
    }

    const isListed = rng() < 0.15;
    const listPrice = isListed ? Math.round((lockedSol * (1.2 + rng() * 3)) * 1000) / 1000 : null;
    const isShattered = rng() < 0.04;

    evos.push({
      id: i,
      name: CAT_NAMES[i] || `Cat #${i}`,
      owner: `0x${Math.floor(rng() * 0xffffff).toString(16).padStart(6, '0')}`,
      lockedSol,
      forgedAt,
      facetCount: facets,
      tradeCount,
      resonanceSeed: seed.slice(0, 32).padEnd(32, '0'),
      element,
      fractureLines,
      isListed,
      listPrice,
      isShattered,
    });
  }

  return evos;
}