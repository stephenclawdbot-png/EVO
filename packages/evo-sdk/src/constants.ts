// EVO Program constants
// Program is deployed on devnet, ready for mainnet initialization.
// Swap EVO_PROGRAM_ID to the mainnet program ID after mainnet deploy.

/** EVO program ID — devnet (ready for mainnet) */
export const EVO_PROGRAM_ID = '7USTJBsRTmCnjowPgmh6s5igTZeaFPE7X43rZnhmm5sc';

/** Protocol Config PDA (singleton, seed: "protocol") */
export const PROTOCOL_PDA = (() => {
  // Lazy import avoidance — compute at module load
  const { PublicKey } = require('@solana/web3.js');
  return PublicKey.findProgramAddressSync(
    [Buffer.from('protocol')],
    new PublicKey(EVO_PROGRAM_ID),
  )[0].toBase58();
})();

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

/** Solana incinerator (for burn-destination fees) */
export const INCINERATOR = '1nc1nerator11111111111111111111111111111111';

// ─── Instruction discriminators (first 8 bytes of sha256("global:<name>")) ───
export const IX_DISCRIMINATORS = {
  initializeProtocol: [188, 233, 252, 106, 134, 146, 202, 91],
  createCollection: [156, 251, 92, 54, 233, 2, 16, 82],
  forge: [63, 5, 211, 28, 237, 195, 110, 144],
  feed: [46, 213, 237, 176, 190, 113, 182, 94],
  list: [54, 174, 193, 67, 17, 41, 132, 38],
  delist: [55, 136, 205, 107, 107, 173, 4, 31],
  buy: [102, 6, 61, 18, 1, 218, 235, 234],
  shatter: [158, 63, 226, 126, 18, 89, 130, 128],
  transfer: [163, 52, 200, 231, 140, 3, 69, 186],
  updateMetadata: [170, 182, 43, 239, 97, 78, 225, 186],
  revealCollection: [181, 252, 135, 115, 216, 100, 60, 200],
  commitReveal: [30, 139, 34, 56, 94, 246, 114, 243],
  evolve: [139, 139, 160, 98, 252, 226, 106, 81],
  setVisualStage: [44, 218, 23, 167, 61, 241, 78, 244],
  verifyMerkleProof: [51, 191, 37, 169, 74, 207, 201, 102],
} as const;

// ─── Account discriminators (first 8 bytes of sha256("account:<Name>")) ───
export const ACCOUNT_DISCRIMINATORS = {
  ProtocolConfig: [207, 91, 250, 28, 152, 179, 215, 209],
  CollectionConfig: [223, 110, 152, 160, 174, 157, 106, 255],
  EVOAccount: [172, 52, 230, 55, 100, 187, 196, 167],
} as const;