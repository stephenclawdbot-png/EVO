// EVO Program constants
// These will be set to the actual deployed program ID once the Solana program is live.
// For now they are placeholders — wallet developers swap in the real ID at integration time.

/** EVO program ID (replace with mainnet deployment) */
export const EVO_PROGRAM_ID = 'Ev0Evo11111111111111111111111111111111111111';

/** PDA seed prefixes */
export const SEEDS = {
  COLLECTION: 'collection',
  EVO: 'evo',
  PROTOCOL: 'protocol',
} as const;

/** Lamports per SOL */
export const LAMPORTS_PER_SOL = 1_000_000_000;

/** Growth interval: 1 facet per week (in milliseconds) */
export const FACET_GROWTH_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000;

/** Maximum facets an EVO can have */
export const MAX_FACETS = 100;