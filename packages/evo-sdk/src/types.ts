// EVO Account Layout — mirrors the on-chain Rust structs exactly.
// This is the stable interface wallet developers rely on.
// DO NOT change field names or order without a protocol version bump.

/** On-chain CollectionConfig account */
export interface CollectionConfig {
  authority: string;
  name: string;
  maxSupply: number;
  mintPriceLamports: number;
  collectionTreasury: string;
  artSeed: string;
  mintAuthority: string | null;
  tradeFeeBps: number;
  shatterFeeBps: number;
  isPaused: boolean;
  rendererHash: string | null;
  currentSupply: number;
}

/** A fracture line — permanent trade scar in the art */
export interface FractureLine {
  tradeNumber: number;
  previousOwner: string;
  timestamp: number;
  position: number;
  intensity: number;
}

/** On-chain EVO account (the PDA holding locked SOL + data) */
export interface EVOAccount {
  address: string;
  collection: string;
  owner: string;
  lockedLamports: number;
  forgedAt: number;
  facetCount: number;
  tradeCount: number;
  resonanceSeed: string;
  fractureLines: FractureLine[];
  isListed: boolean;
  listPriceLamports: number | null;
  isShattered: boolean;
}

/** Evolution stage derived from facet count */
export type EvoStage = 'baby' | 'juvenile' | 'adult' | 'elder';

/** Derived display data computed from on-chain EVOAccount */
export interface EvoDisplayData {
  account: EVOAccount;
  lockedSol: number;
  stage: EvoStage;
  ageString: string;
  totalValueSol: number;
  listPriceSol: number | null;
}