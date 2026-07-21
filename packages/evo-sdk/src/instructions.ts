// EVO instruction builders — construct raw Solana transactions for all
// protocol operations. Used by wallets, marketplaces, and Telegram bots.
//
// All functions return TransactionInstruction. Compose them into a
// Transaction, sign with the user's wallet, and send via connection.

import {
  PublicKey,
  TransactionInstruction,
  SystemProgram,
} from '@solana/web3.js';
import { EVO_PROGRAM_ID, IX_DISCRIMINATORS, INCINERATOR } from './constants';
import {
  getCollectionPDA,
  getEVOPDA,
  getProtocolConfigPDA,
} from './derive';
import {
  FeeDestination,
  LifecycleType,
  RandomnessPolicy,
  LifecycleParams,
} from './types';

const PROGRAM = new PublicKey(EVO_PROGRAM_ID);
const INCINERATOR_PK = new PublicKey(INCINERATOR);

// ─── Encoders ───────────────────────────────────────────────

function writeU8(val: number): Buffer {
  const b = Buffer.alloc(1);
  b.writeUInt8(val);
  return b;
}

function writeU16(val: number): Buffer {
  const b = Buffer.alloc(2);
  b.writeUInt16LE(val);
  return b;
}

function writeU32(val: number): Buffer {
  const b = Buffer.alloc(4);
  b.writeUInt32LE(val);
  return b;
}

function writeU64(val: number): Buffer {
  const b = Buffer.alloc(8);
  b.writeBigUInt64LE(BigInt(val));
  return b;
}

function writeString(str: string): Buffer {
  const buf = Buffer.from(str, 'utf8');
  return Buffer.concat([writeU32(buf.length), buf]);
}

function writePubkey(pk: string | PublicKey): Buffer {
  return new PublicKey(pk).toBuffer();
}

function writeBytes(arr: Uint8Array): Buffer {
  return Buffer.from(arr);
}

function writeOptionPubkey(pk: string | null): Buffer {
  if (!pk) return Buffer.from([0]);
  return Buffer.concat([Buffer.from([1]), writePubkey(pk)]);
}

const FEE_DEST_MAP: Record<FeeDestination, number> = {
  Treasury: 0,
  Creator: 1,
  Burn: 2,
  Split: 3,
};

function writeFeeDest(dest: FeeDestination): Buffer {
  return writeU8(FEE_DEST_MAP[dest]);
}

const LIFECYCLE_MAP: Record<LifecycleType, number> = {
  Static: 0,
  Reveal: 1,
  CommitReveal: 2,
  RevealAndEvolve: 3,
  Custom: 4,
};

const RANDOMNESS_MAP: Record<RandomnessPolicy, number> = {
  None: 0,
  Predetermined: 1,
  BatchReveal: 2,
};

function writeLifecycleParams(lc: LifecycleParams): Buffer {
  return Buffer.concat([
    writeU8(LIFECYCLE_MAP[lc.lifecycleType]),
    writeU32(lc.maxStates),
    writePubkey(lc.revealAuthority),
    writeU8(RANDOMNESS_MAP[lc.randomnessPolicy]),
    writeBytes(lc.manifestRoot),
    writeU32(lc.evolveTradeThreshold),
    writeU32(lc.evolveFeedThreshold),
    writeU64(lc.evolveHoldSeconds),
    writeU64(lc.evolveLockedThresholdLamports),
    writeBytes(lc.transitionPolicyHash),
    writePubkey(lc.burnDestination),
    writeBytes(lc.artworkManifestHash),
  ]);
}

function disc(name: keyof typeof IX_DISCRIMINATORS): Buffer {
  return Buffer.from(IX_DISCRIMINATORS[name]);
}

// ─── Read PDA helpers (re-exported for convenience) ─────────

export { getCollectionPDA, getEVOPDA, getProtocolConfigPDA };

// ─── Instruction builders ───────────────────────────────────

/** Initialize the protocol (one-time, authority-only). */
export function createInitializeProtocolIx(
  authority: PublicKey,
  treasury: PublicKey,
): TransactionInstruction {
  const [protocolPda] = getProtocolConfigPDA();
  return new TransactionInstruction({
    programId: PROGRAM,
    keys: [
      { pubkey: protocolPda, isSigner: false, isWritable: true },
      { pubkey: treasury, isSigner: false, isWritable: true },
      { pubkey: authority, isSigner: true, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data: disc('initializeProtocol'),
  });
}

/** Create a new collection. */
export function createCreateCollectionIx(
  payer: PublicKey,
  treasury: PublicKey,
  name: string,
  supplyCap: number,
  shatterFeeBps: number,
  shatterFeeDest: FeeDestination,
  tradeRoyaltyBps: number,
  royaltyDest: FeeDestination,
  mintPriceLamports: number,
  lockAmountLamports: number,
  metadataUri: string,
  lifecycle: LifecycleParams,
): TransactionInstruction {
  const [collectionPda] = getCollectionPDA(name);
  const [protocolPda] = getProtocolConfigPDA();
  const data = Buffer.concat([
    disc('createCollection'),
    writeString(name),
    writeU32(supplyCap),
    writeU16(shatterFeeBps),
    writeFeeDest(shatterFeeDest),
    writeU16(tradeRoyaltyBps),
    writeFeeDest(royaltyDest),
    writeU64(mintPriceLamports),
    writeU64(lockAmountLamports),
    writeString(metadataUri),
    writeLifecycleParams(lifecycle),
  ]);
  return new TransactionInstruction({
    programId: PROGRAM,
    keys: [
      { pubkey: collectionPda, isSigner: false, isWritable: true },
      { pubkey: protocolPda, isSigner: false, isWritable: false },
      { pubkey: treasury, isSigner: false, isWritable: true },
      { pubkey: payer, isSigner: true, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data,
  });
}

/** Forge (mint) a new EVO with SOL locked inside. */
export function createForgeIx(
  owner: PublicKey,
  collectionPda: PublicKey,
  creator: PublicKey,
  evoId: number,
  resonanceSeed: Buffer,
): TransactionInstruction {
  const [evoPda] = getEVOPDA(collectionPda, evoId);
  const [protocolPda] = getProtocolConfigPDA();
  const data = Buffer.concat([
    disc('forge'),
    writeU32(evoId),
    resonanceSeed,
  ]);
  return new TransactionInstruction({
    programId: PROGRAM,
    keys: [
      { pubkey: evoPda, isSigner: false, isWritable: true },
      { pubkey: collectionPda, isSigner: false, isWritable: true },
      { pubkey: protocolPda, isSigner: false, isWritable: false },
      { pubkey: creator, isSigner: false, isWritable: true },
      { pubkey: owner, isSigner: true, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data,
  });
}

/** Feed SOL to an EVO to increase its locked value (anyone can feed). */
export function createFeedIx(
  evoPda: PublicKey,
  collectionPda: PublicKey,
  feeder: PublicKey,
  evoId: number,
  additionalLamports: number,
): TransactionInstruction {
  const data = Buffer.concat([
    disc('feed'),
    writeU32(evoId),
    writeU64(additionalLamports),
  ]);
  return new TransactionInstruction({
    programId: PROGRAM,
    keys: [
      { pubkey: evoPda, isSigner: false, isWritable: true },
      { pubkey: collectionPda, isSigner: false, isWritable: false },
      { pubkey: feeder, isSigner: true, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data,
  });
}

/** List an EVO for sale at a fixed price. */
export function createListIx(
  evoPda: PublicKey,
  collectionPda: PublicKey,
  seller: PublicKey,
  evoId: number,
  priceLamports: number,
): TransactionInstruction {
  const data = Buffer.concat([
    disc('list'),
    writeU32(evoId),
    writeU64(priceLamports),
  ]);
  return new TransactionInstruction({
    programId: PROGRAM,
    keys: [
      { pubkey: evoPda, isSigner: false, isWritable: true },
      { pubkey: collectionPda, isSigner: false, isWritable: false },
      { pubkey: seller, isSigner: true, isWritable: true },
    ],
    data,
  });
}

/** Delist an EVO (remove from sale). */
export function createDelistIx(
  evoPda: PublicKey,
  collectionPda: PublicKey,
  seller: PublicKey,
  evoId: number,
): TransactionInstruction {
  return new TransactionInstruction({
    programId: PROGRAM,
    keys: [
      { pubkey: evoPda, isSigner: false, isWritable: true },
      { pubkey: collectionPda, isSigner: false, isWritable: false },
      { pubkey: seller, isSigner: true, isWritable: true },
    ],
    data: Buffer.concat([disc('delist'), writeU32(evoId)]),
  });
}

/**
 * Buy a listed EVO. The buyer pays the list price; locked SOL stays in the
 * EVO PDA. Royalties routed per collection config. Self-trade is blocked.
 *
 * Marketplace integration: marketplaces build this ix, add their taker fee
 * ix if desired, then have the buyer sign the combined Transaction.
 */
/**
 * ⚠️ OUT OF SYNC WITH THE DEPLOYED PROGRAM — DO NOT USE AS-IS.
 *
 * This builder is missing accounts and an argument that the on-chain `buy`
 * instruction now requires; transactions built with it will FAIL. It must be
 * regenerated from the Anchor IDL. The authoritative, working reference is
 * `frontend/src/lib/evo-program.ts#createBuyIx`.
 *
 * Correct on-chain `buy` layout (see programs/evo/src/instructions/buy.rs):
 *   data: buy(evo_id: u32, max_price: u64)   // max_price is MISSING here
 *   accounts (in order):
 *     0 evo (w)
 *     1 listing (w)                 // MISSING here — PDA ["listing", evo]
 *     2 collection_config
 *     3 protocol_config
 *     4 seller (w)      = evo.owner
 *     5 creator (w)     = collection.creator
 *     6 treasury (w, optional)      = protocol_config.treasury
 *     7 incinerator (w, optional)
 *     8 incinerator_fallback (w)    // MISSING here — canonical INCINERATOR
 *     9 buyer (signer, w)
 *    10 system_program
 */
export function createBuyIx(
  evoPda: PublicKey,
  collectionPda: PublicKey,
  seller: PublicKey,
  creator: PublicKey,
  buyer: PublicKey,
  treasury: PublicKey,
  royaltyDest: FeeDestination,
  evoId: number,
  burnDestination?: PublicKey,
): TransactionInstruction {
  const [protocolPda] = getProtocolConfigPDA();
  const incinerator = royaltyDest === 'Burn'
    ? (burnDestination && !burnDestination.equals(PublicKey.default) ? burnDestination : INCINERATOR_PK)
    : SystemProgram.programId;

  return new TransactionInstruction({
    programId: PROGRAM,
    keys: [
      { pubkey: evoPda, isSigner: false, isWritable: true },
      { pubkey: collectionPda, isSigner: false, isWritable: false },
      { pubkey: protocolPda, isSigner: false, isWritable: false },
      { pubkey: seller, isSigner: false, isWritable: true },
      { pubkey: creator, isSigner: false, isWritable: true },
      {
        pubkey: royaltyDest === 'Treasury' || royaltyDest === 'Split' ? treasury : SystemProgram.programId,
        isSigner: false,
        isWritable: true,
      },
      { pubkey: incinerator, isSigner: false, isWritable: true },
      { pubkey: buyer, isSigner: true, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data: Buffer.concat([disc('buy'), writeU32(evoId)]),
  });
}

/**
 * Verify a Merkle inclusion proof for an EVO's metadata.
 * Permissionless — anyone can call. Sets `manifest_verified` on the EVO.
 */
export function createVerifyMerkleProofIx(
    evoPda: PublicKey,
    collectionPda: PublicKey,
    evoId: number,
    leafHash: Uint8Array,
    proof: Uint8Array[],
): TransactionInstruction {
    const data = Buffer.concat([
      disc('verifyMerkleProof'),
      writeU32(evoId),
      writeBytes(leafHash),
      writeU32(proof.length),
      ...proof.map((p) => writeBytes(p)),
    ]);
    return new TransactionInstruction({
      programId: PROGRAM,
      keys: [
        { pubkey: evoPda, isSigner: false, isWritable: true },
        { pubkey: collectionPda, isSigner: false, isWritable: false },
      ],
      data,
    });
}

/**
 * Shatter an EVO — destroy it and recover the locked SOL (minus fee).
 * The owner signs. Fee routed per collection config.
 *
 * ⚠️ OUT OF SYNC WITH THE DEPLOYED PROGRAM — DO NOT USE AS-IS.
 * Missing the optional `listing` account and the `incinerator_fallback`
 * account required by the on-chain `shatter`; transactions will FAIL.
 * Regenerate from the Anchor IDL. Reference: `frontend/src/lib/evo-program.ts`.
 *
 * Correct on-chain `shatter` layout (see instructions/shatter.rs):
 *   data: shatter(evo_id: u32)
 *   accounts (in order):
 *     0 evo (w, close=owner)
 *     1 collection_config (w)
 *     2 protocol_config
 *     3 listing (w, optional)       // MISSING — PDA ["listing", evo], closes if listed
 *     4 owner (signer, w)
 *     5 creator (w)
 *     6 treasury (w, optional)
 *     7 incinerator (w)
 *     8 incinerator_fallback (w)    // MISSING — canonical INCINERATOR
 *     9 system_program
 */
export function createShatterIx(
  evoPda: PublicKey,
  collectionPda: PublicKey,
  owner: PublicKey,
  creator: PublicKey,
  treasury: PublicKey | null,
  evoId: number,
  shatterFeeDest: FeeDestination,
  burnDestination?: PublicKey,
): TransactionInstruction {
  const [protocolPda] = getProtocolConfigPDA();
  const incinerator = shatterFeeDest === 'Burn'
    ? (burnDestination && !burnDestination.equals(PublicKey.default) ? burnDestination : INCINERATOR_PK)
    : INCINERATOR_PK;

  const keys = [
    { pubkey: evoPda, isSigner: false, isWritable: true },
    { pubkey: collectionPda, isSigner: false, isWritable: false },
    { pubkey: protocolPda, isSigner: false, isWritable: false },
    { pubkey: owner, isSigner: true, isWritable: true },
    { pubkey: creator, isSigner: false, isWritable: true },
    {
      pubkey: treasury && (shatterFeeDest === 'Treasury' || shatterFeeDest === 'Split') ? treasury : SystemProgram.programId,
      isSigner: false,
      isWritable: true,
    },
    { pubkey: incinerator, isSigner: false, isWritable: true },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
  ];
  const data = Buffer.concat([disc('shatter'), writeU32(evoId)]);
  return new TransactionInstruction({ programId: PROGRAM, keys, data });
}

/** Transfer an EVO to a new owner (no SOL exchange, just ownership). */
export function createTransferIx(
  evoPda: PublicKey,
  collectionPda: PublicKey,
  currentOwner: PublicKey,
  treasury: PublicKey,
  evoId: number,
  newOwner: PublicKey,
): TransactionInstruction {
  const [protocolPda] = getProtocolConfigPDA();
  const data = Buffer.concat([disc('transfer'), writeU32(evoId), writePubkey(newOwner)]);
  return new TransactionInstruction({
    programId: PROGRAM,
    keys: [
      { pubkey: evoPda, isSigner: false, isWritable: true },
      { pubkey: collectionPda, isSigner: false, isWritable: false },
      { pubkey: protocolPda, isSigner: false, isWritable: false },
      { pubkey: treasury, isSigner: false, isWritable: true },
      { pubkey: currentOwner, isSigner: true, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data,
  });
}

/** Update collection metadata URI (creator only). */
export function createUpdateMetadataIx(
  collectionPda: PublicKey,
  creator: PublicKey,
  metadataUri: string,
): TransactionInstruction {
  const data = Buffer.concat([
    disc('updateMetadata'),
    writeString(metadataUri),
  ]);
  return new TransactionInstruction({
    programId: PROGRAM,
    keys: [
      { pubkey: collectionPda, isSigner: false, isWritable: true },
      { pubkey: creator, isSigner: true, isWritable: false },
    ],
    data,
  });
}

/** Reveal a collection (authority only, for Reveal/CommitReveal/RevealAndEvolve). */
export function createRevealCollectionIx(
  collectionPda: PublicKey,
  authority: PublicKey,
  secret: Uint8Array,
): TransactionInstruction {
  const data = Buffer.concat([
    disc('revealCollection'),
    Buffer.from(secret),
  ]);
  return new TransactionInstruction({
    programId: PROGRAM,
    keys: [
      { pubkey: collectionPda, isSigner: false, isWritable: true },
      { pubkey: authority, isSigner: true, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data,
  });
}

/** Evolve an EVO (permissionless — only advances if thresholds are met). */
export function createEvolveIx(
  evoPda: PublicKey,
  collectionPda: PublicKey,
  evoId: number,
): TransactionInstruction {
  return new TransactionInstruction({
    programId: PROGRAM,
    keys: [
      { pubkey: evoPda, isSigner: false, isWritable: true },
      { pubkey: collectionPda, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data: Buffer.concat([disc('evolve'), writeU32(evoId)]),
  });
}

/** Set visual stage (authority only, Custom lifecycle only). */
export function createSetVisualStageIx(
  evoPda: PublicKey,
  collectionPda: PublicKey,
  authority: PublicKey,
  evoId: number,
  stage: number,
): TransactionInstruction {
  const data = Buffer.concat([
    disc('setVisualStage'),
    writeU32(evoId),
    writeU16(stage),
  ]);
  return new TransactionInstruction({
    programId: PROGRAM,
    keys: [
      { pubkey: evoPda, isSigner: false, isWritable: true },
      { pubkey: collectionPda, isSigner: false, isWritable: false },
      { pubkey: authority, isSigner: true, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data,
  });
}

/**
 * Generate a random 32-byte resonance seed for forge.
 * Uses crypto.getRandomValues (browser) or crypto.randomBytes (node).
 */
export function generateResonanceSeed(): Buffer {
  const seed = new Uint8Array(32);
  const g = globalThis as any;
  if (typeof g.crypto !== 'undefined' && g.crypto.getRandomValues) {
    g.crypto.getRandomValues(seed);
  } else {
    // Node fallback
    const nodeCrypto = require('crypto');
    nodeCrypto.randomFillSync(seed);
  }
  return Buffer.from(seed);
}