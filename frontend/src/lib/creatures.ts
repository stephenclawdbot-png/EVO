// EVO Creature Data — 108 Zenkos as Z collection art base
// Each creature has 4 evolution stages: baby → juvenile → adult → elder
// Elements and rarities are assigned deterministically from name hash

export type Element = 'Terra' | 'Aqua' | 'Flora' | 'Ignis' | 'Aero' | 'Void' | 'Lux';
export type Rarity = 'Common' | 'Uncommon' | 'Epic' | 'Legendary' | 'Mythical';
export type Stage = 'baby' | 'juvenile' | 'adult' | 'elder';

export interface Creature {
  id: string;
  name: string;
  displayName: string;
  element: Element;
  rarity: Rarity;
  stages: Record<Stage, string>;
  baseSprite: string;
}

const ELEMENTS: Element[] = ['Terra', 'Aqua', 'Flora', 'Ignis', 'Aero', 'Void', 'Lux'];
const RARITIES: Rarity[] = ['Common', 'Uncommon', 'Epic', 'Legendary', 'Mythical'];

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function toDisplayName(name: string): string {
  return name
    .split('_')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

const creatureNames: string[] = [
  'abyssling', 'aquarine', 'aurelia', 'blazecub', 'bloomara',
  'boulderon', 'brambark', 'breezekit', 'chronovex', 'cindermane',
  'cindle', 'clovy', 'cobble', 'coralbite', 'coralisk',
  'cosmium', 'craggle', 'cragroot', 'crystara', 'cyclonix',
  'darkspecter', 'deltarcha', 'dimble', 'divinium', 'dualuxe',
  'duskee', 'eclipsyn', 'elderbark', 'emberle', 'emberwing',
  'flicky', 'florix', 'fortaran', 'fuzzrock', 'gaialith',
  'gaiamir', 'galestrike', 'geargrove', 'geowarden', 'gleamguard',
  'glimra', 'gloopy', 'gustaria', 'gusty', 'hurricana',
  'infernohound', 'leviath', 'lotuseer', 'lucentia', 'lumen',
  'luminara', 'magmarok', 'marlance', 'marshling', 'megalith',
  'mistweaver', 'nightstrider', 'nihilarch', 'nimbu', 'noctilume',
  'novaburst', 'petalbud', 'petrabloom', 'poseidax', 'prismark',
  'pyrewing', 'pyrexis', 'pyroglide', 'quartzpup', 'quarzon',
  'scorchstorm', 'seedlup', 'skydrift', 'smoldra', 'solarknight',
  'solivanna', 'solphoenix', 'splisho', 'stormray', 'stratoguard',
  'stratosking', 'swampire', 'sylvorn', 'tectodon', 'tempestus',
  'terragod', 'terraquill', 'terravine', 'thornhelm', 'thornmaw',
  'tidalord', 'tidalserp', 'tiddles', 'twilara', 'umbraluxis',
  'umbrance', 'umbraxis', 'umbrite', 'vanguard', 'verdania',
  'verdantia', 'voidlord', 'wishling', 'witch_dog', 'yggdrasoul',
  'zephyrion', 'zephyron',
];

export const CREATURES: Creature[] = creatureNames.map((name) => {
  const hash = hashString(name);
  return {
    id: name,
    name,
    displayName: toDisplayName(name),
    element: ELEMENTS[hash % ELEMENTS.length],
    rarity: RARITIES[hash % RARITIES.length],
    stages: {
      baby: `/zenkos/${name}_baby.png`,
      juvenile: `/zenkos/${name}_juvenile.png`,
      adult: `/zenkos/${name}_adult.png`,
      elder: `/zenkos/${name}_elder.png`,
    },
    baseSprite: `/zenkos/${name}.png`,
  };
});

export const ELEMENT_COLORS: Record<Element, string> = {
  Terra: '#8B6F47',
  Aqua: '#3B82F6',
  Flora: '#22C55E',
  Ignis: '#EF4444',
  Aero: '#06B6D4',
  Void: '#7C3AED',
  Lux: '#F59E0B',
};

export const RARITY_COLORS: Record<Rarity, string> = {
  Common: '#9CA3AF',
  Uncommon: '#22C55E',
  Epic: '#8B5CF6',
  Legendary: '#F59E0B',
  Mythical: '#EF4444',
};

export const STAGE_NAMES: Record<Stage, string> = {
  baby: 'Newborn',
  juvenile: 'Juvenile',
  adult: 'Adult',
  elder: 'Elder',
};

export function getStageFromFacets(facets: number): Stage {
  if (facets < 10) return 'baby';
  if (facets < 30) return 'juvenile';
  if (facets < 60) return 'adult';
  return 'elder';
}

export function getStageIndex(stage: Stage): number {
  return { baby: 0, juvenile: 1, adult: 2, elder: 3 }[stage];
}