// @evo/sdk — TypeScript SDK for reading EVO data from Solana
// Wallet developers: import { EvoClient } from '@evo/sdk'

export { EvoClient } from './client';
export { getCollectionPDA, getEVOPDA, getProtocolConfigPDA } from './derive';
export {
  deserializeEVOAccount,
  deserializeCollectionConfig,
  EVO_ACCOUNT_DISCRIMINATOR,
  COLLECTION_CONFIG_DISCRIMINATOR,
} from './layout';
export {
  getStage,
  computeCurrentFacets,
  getAgeString,
  lamportsToSol,
  solToLamports,
  toDisplayData,
} from './display';
export {
  EVO_PROGRAM_ID,
  SEEDS,
  LAMPORTS_PER_SOL,
  FACET_GROWTH_INTERVAL_MS,
  MAX_FACETS,
} from './constants';

export type {
  EVOAccount,
  CollectionConfig,
  FractureLine,
  EvoStage,
  EvoDisplayData,
} from './types';