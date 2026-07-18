// @evo/sdk — TypeScript SDK for reading AND writing EVO data on Solana.
// Wallet developers: import { EvoClient } from '@evo/sdk'
// Marketplace devs:  import { createBuyIx, createListIx } from '@evo/sdk'
// Telegram bots:     import { createForgeIx, createShatterIx } from '@evo/sdk'

// ─── Read ────────────────────────────────────
export { EvoClient } from './client';
export {
  deserializeEVOAccount,
  deserializeCollectionConfig,
  EVO_ACCOUNT_DISCRIMINATOR,
  COLLECTION_CONFIG_DISCRIMINATOR,
  PROTOCOL_CONFIG_DISCRIMINATOR,
} from './layout';
export { getCollectionPDA, getEVOPDA, getProtocolConfigPDA } from './derive';
export {
  getStage,
  computeCurrentFacets,
  getAgeString,
  lamportsToSol,
  solToLamports,
  toDisplayData,
} from './display';

// ─── Write (instruction builders) ────────────
export {
  createInitializeProtocolIx,
  createCreateCollectionIx,
  createForgeIx,
  createFeedIx,
  createListIx,
  createDelistIx,
  createBuyIx,
  createShatterIx,
  createTransferIx,
  createUpdateMetadataIx,
  createRevealCollectionIx,
  createEvolveIx,
  createSetVisualStageIx,
  createVerifyMerkleProofIx,
  generateResonanceSeed,
} from './instructions';

// ─── Constants ───────────────────────────────
export {
  EVO_PROGRAM_ID,
  PROTOCOL_PDA,
  SEEDS,
  LAMPORTS_PER_SOL,
  INCINERATOR,
  IX_DISCRIMINATORS,
  ACCOUNT_DISCRIMINATORS,
  FACET_GROWTH_INTERVAL_MS,
  MAX_FACETS,
} from './constants';

// ─── Types ────────────────────────────────────
export type {
  EVOAccount,
  CollectionConfig,
  FractureLine,
  EvoStage,
  EvoDisplayData,
  FeeDestination,
  LifecycleType,
  RandomnessPolicy,
  LifecycleParams,
} from './types';

// ─── Builder API ─────────────────────────────
export { CollectionBuilder } from './builder';