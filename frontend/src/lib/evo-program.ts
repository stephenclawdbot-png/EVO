import { Buffer } from 'buffer';
import { createHash } from 'crypto';
import {
  PublicKey,
  Connection,
  Transaction,
  TransactionInstruction,
  SystemProgram,
  LAMPORTS_PER_SOL,
  AccountInfo,
} from '@solana/web3.js';

// ─── Constants ──────────────────────────────────────────────
export const PROGRAM_ID = new PublicKey('7USTJBsRTmCnjowPgmh6s5igTZeaFPE7X43rZnhmm5sc');
export const PROTOCOL_PDA = (() => {
  const [pda] = PublicKey.findProgramAddressSync([Buffer.from('protocol')], PROGRAM_ID);
  return pda;
})();

// Instruction discriminators (first 8 bytes of sha256("global:<name>"))
const DISC = {
  initializeProtocol: Buffer.from([188, 233, 252, 106, 134, 146, 202, 91]),
  createCollection: Buffer.from([156, 251, 92, 54, 233, 2, 16, 82]),
  forge: Buffer.from([63, 5, 211, 28, 237, 195, 110, 144]),
  feed: Buffer.from([46, 213, 237, 176, 190, 113, 182, 94]),
  list: Buffer.from([54, 174, 193, 67, 17, 41, 132, 38]),
  delist: Buffer.from([55, 136, 205, 107, 107, 173, 4, 31]),
  buy: Buffer.from([102, 6, 61, 18, 1, 218, 235, 234]),
  shatter: Buffer.from([158, 63, 226, 126, 18, 89, 130, 128]),
  transfer: Buffer.from([163, 52, 200, 231, 140, 3, 69, 186]),
  updateMetadata: Buffer.from([170, 182, 43, 239, 97, 78, 225, 186]),
  revealCollection: Buffer.from([181, 252, 135, 115, 216, 100, 60, 200]),
  commitReveal: Buffer.from([30, 139, 34, 56, 94, 246, 114, 243]),
  evolve: Buffer.from([139, 139, 160, 98, 252, 226, 106, 81]),
  setVisualStage: Buffer.from([44, 218, 23, 167, 61, 241, 78, 244]),
};

// Account discriminators (first 8 bytes of sha256("account:<Name>"))
const ACCT_DISC = {
  ProtocolConfig: Buffer.from([207, 91, 250, 28, 152, 179, 215, 209]),
  CollectionConfig: Buffer.from([223, 110, 152, 160, 174, 157, 106, 255]),
  EVOAccount: Buffer.from([172, 52, 230, 55, 100, 187, 196, 167]),
  Listing: Buffer.from([0, 0, 0, 0, 0, 0, 0, 0]), // placeholder, computed below
};
// Compute Listing discriminator: sha256("account:Listing")[0..8]
{
  const h = createHash('sha256').update('account:Listing').digest();
  ACCT_DISC.Listing = Buffer.from(h.subarray(0, 8));
}

// ─── Types ───────────────────────────────────────────────────
export type FeeDestination = 'Treasury' | 'Creator' | 'Burn' | 'Split';
const FEE_DEST_MAP: Record<FeeDestination, number> = {
  Treasury: 0, Creator: 1, Burn: 2, Split: 3,
};

export const INCINERATOR = new PublicKey('1nc1nerator11111111111111111111111111111111');

const LIFECYCLE_FWD: Record<LifecycleType, number> = {
  Static: 0, Reveal: 1, CommitReveal: 2, RevealAndEvolve: 3, Custom: 4,
};

const RANDOMNESS_FWD: Record<RandomnessPolicy, number> = {
  None: 0, Predetermined: 1, BatchReveal: 2,
};

export interface LifecycleParamsInput {
  lifecycleType: LifecycleType;
  maxStates: number;
  revealAuthority: PublicKey;
  randomnessPolicy: RandomnessPolicy;
  manifestRoot: Uint8Array;
  evolveTradeThreshold: number;
  evolveFeedThreshold: number;
  evolveHoldSeconds: number;
  evolveLockedThreshold: number;
  transitionPolicyHash: Uint8Array;
  burnDestination: PublicKey;
  artworkManifestHash: Uint8Array;
}

export type LifecycleType = 'Static' | 'Reveal' | 'CommitReveal' | 'RevealAndEvolve' | 'Custom';
const LIFECYCLE_MAP: LifecycleType[] = ['Static', 'Reveal', 'CommitReveal', 'RevealAndEvolve', 'Custom'];
const LIFECYCLE_REV: Record<number, LifecycleType> = Object.fromEntries(LIFECYCLE_MAP.map((v, i) => [i, v]));

export type RandomnessPolicy = 'None' | 'Predetermined' | 'BatchReveal';
const RANDOMNESS_MAP: RandomnessPolicy[] = ['None', 'Predetermined', 'BatchReveal'];

export interface ProtocolConfig {
  treasury: PublicKey;
  creationFeeLamports: number;
  initialized: boolean;
  bump: number;
}

export interface CollectionConfig {
  name: string;
  creator: PublicKey;
  supplyCap: number;
  currentSupply: number;
  shatterFeeBps: number;
  shatterFeeDestination: FeeDestination;
  tradeRoyaltyBps: number;
  royaltyDestination: FeeDestination;
  mintPriceLamports: number;
  lockAmountLamports: number;
  bump: number;
  metadataUri: string;
  lifecycleType: LifecycleType;
  maxStates: number;
  revealAuthority: PublicKey;
  isRevealed: boolean;
  burnDestination: PublicKey;
  artworkManifestHash: Uint8Array;
  // Evolution thresholds
  evolveTradeThreshold: number;
  evolveFeedThreshold: number;   // lamports
  evolveHoldSeconds: number;
  evolveLockedThreshold: number; // lamports
}

export interface FractureLine {
  tradeNumber: number;
  previousOwner: PublicKey;
  timestamp: number;
  position: number;
  intensity: number;
}

export interface EVOAccount {
  collection: PublicKey;
  owner: PublicKey;
  lockedLamports: number;
  forgedAt: number;
  facetCount: number;
  tradeCount: number;
  resonanceSeed: Buffer;
  fractureLines: FractureLine[];
  isShattered: boolean;
  bump: number;
  // Lifecycle state
  mintIndex: number;
  currentState: number;
  lastTransitionAt: number;
  feedCount: number;
  totalFedLamports: number;
  // Derived
  evoId?: number;
  pda?: PublicKey;
}

export interface ListingData {
  evo: PublicKey;
  seller: PublicKey;
  priceLamports: number;
  bump: number;
  pda?: PublicKey;
}

// ─── PDA Derivation ──────────────────────────────────────────
export function getCollectionPDA(name: string): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('collection'), Buffer.from(name)],
    PROGRAM_ID
  );
}

export function getEvoPDA(collectionPda: PublicKey, evoId: number): [PublicKey, number] {
  const idBuf = Buffer.alloc(4);
  idBuf.writeUInt32LE(evoId);
  return PublicKey.findProgramAddressSync(
    [Buffer.from('evo'), collectionPda.toBuffer(), idBuf],
    PROGRAM_ID
  );
}

export function getListingPDA(evoPda: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('listing'), evoPda.toBuffer()],
    PROGRAM_ID
  );
}

// ─── Borsh helpers ───────────────────────────────────────────
function readU16(buf: Buffer, offset: number): [number, number] {
  return [buf.readUInt16LE(offset), offset + 2];
}
function readU32(buf: Buffer, offset: number): [number, number] {
  return [buf.readUInt32LE(offset), offset + 4];
}
function readU64(buf: Buffer, offset: number): [number, number] {
  // Read as BigInt then convert — values can exceed JS safe int but for SOL amounts it's fine
  const lo = buf.readUInt32LE(offset);
  const hi = buf.readUInt32LE(offset + 4);
  return [lo + hi * 0x100000000, offset + 8];
}
function readI64(buf: Buffer, offset: number): [number, number] {
  const lo = buf.readUInt32LE(offset);
  const hi = buf.readInt32LE(offset + 4);
  return [lo + hi * 0x100000000, offset + 8];
}
function readBool(buf: Buffer, offset: number): [boolean, number] {
  return [buf[offset] !== 0, offset + 1];
}
function readPubkey(buf: Buffer, offset: number): [PublicKey, number] {
  return [new PublicKey(buf.subarray(offset, offset + 32)), offset + 32];
}
function readString(buf: Buffer, offset: number): [string, number] {
  const len = buf.readUInt32LE(offset);
  offset += 4;
  return [buf.subarray(offset, offset + len).toString('utf8'), offset + len];
}
function readFeeDest(buf: Buffer, offset: number): [FeeDestination, number] {
  const idx = buf[offset];
  const map: FeeDestination[] = ['Treasury', 'Creator', 'Burn', 'Split'];
  return [map[idx], offset + 1];
}

function readLifecycle(buf: Buffer, offset: number): [LifecycleType, number] {
  const idx = buf[offset];
  return [LIFECYCLE_REV[idx] ?? 'Static', offset + 1];
}

function readBytes32(buf: Buffer, offset: number): [Uint8Array, number] {
  return [new Uint8Array(buf.subarray(offset, offset + 32)), offset + 32];
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
  b.writeUInt32LE(val & 0xffffffff, 0);
  b.writeUInt32LE(Math.floor(val / 0x100000000) & 0xffffffff, 4);
  return b;
}
function writeString(val: string): Buffer {
  const strBuf = Buffer.from(val, 'utf8');
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32LE(strBuf.length);
  return Buffer.concat([lenBuf, strBuf]);
}
function writePubkey(val: PublicKey): Buffer {
  return val.toBuffer();
}
function writeFeeDest(val: FeeDestination): Buffer {
  return Buffer.from([FEE_DEST_MAP[val]]);
}

function writeI64(val: number): Buffer {
  const b = Buffer.alloc(8);
  b.writeInt32LE(val & 0xffffffff, 0);
  b.writeInt32LE(Math.floor(val / 0x100000000) & 0xffffffff, 4);
  return b;
}

function writeBytes32(val: Uint8Array): Buffer {
  return Buffer.from(val);
}

function writeLifecycleParams(val: LifecycleParamsInput): Buffer {
  return Buffer.concat([
    Buffer.from([LIFECYCLE_FWD[val.lifecycleType]]),
    writeU16(val.maxStates),
    writePubkey(val.revealAuthority),
    Buffer.from([RANDOMNESS_FWD[val.randomnessPolicy]]),
    writeBytes32(val.manifestRoot),
    writeU32(val.evolveTradeThreshold),
    writeU64(val.evolveFeedThreshold),
    writeI64(val.evolveHoldSeconds),
    writeU64(val.evolveLockedThreshold),
    writeBytes32(val.transitionPolicyHash),
    writePubkey(val.burnDestination),
    writeBytes32(val.artworkManifestHash),
  ]);
}

// ─── Account Parsers ─────────────────────────────────────────
export function parseProtocolConfig(data: Buffer): ProtocolConfig | null {
  if (data.length < 50) return null;
  if (!data.subarray(0, 8).equals(ACCT_DISC.ProtocolConfig)) return null;
  let off = 8;
  const [treasury, o1] = readPubkey(data, off); off = o1;
  const [creationFeeLamports, o2] = readU64(data, off); off = o2;
  const [initialized, o3] = readBool(data, off); off = o3;
  const [bump, o4] = [data[off], off + 1]; off = o4;
  return { treasury, creationFeeLamports, initialized, bump };
}

export function parseCollectionConfig(data: Buffer): CollectionConfig | null {
  if (data.length < 8) return null;
  if (!data.subarray(0, 8).equals(ACCT_DISC.CollectionConfig)) return null;
  let off = 8;
  const [name, o1] = readString(data, off); off = o1;
  const [creator, o2] = readPubkey(data, off); off = o2;
  const [supplyCap, o3] = readU32(data, off); off = o3;
  const [currentSupply, o4] = readU32(data, off); off = o4;
  const [shatterFeeBps, o5] = readU16(data, off); off = o5;
  const [shatterFeeDest, o6] = readFeeDest(data, off); off = o6;
  const [tradeRoyaltyBps, o7] = readU16(data, off); off = o7;
  const [royaltyDest, o8] = readFeeDest(data, off); off = o8;
  const [mintPriceLamports, o9] = readU64(data, off); off = o9;
  const [lockAmountLamports, o10] = readU64(data, off); off = o10;
  const [bump, o11] = [data[off], off + 1]; off = o11;

  let metadataUri = '';
  let lifecycleType: LifecycleType = 'Static';
  let maxStates = 0;
  let revealAuthority = PublicKey.default;
  let isRevealed = false;
  let burnDestination = PublicKey.default;
  let artworkManifestHash: Uint8Array = new Uint8Array(32);

  if (off < data.length) {
    [metadataUri, off] = readString(data, off);
  }
  if (off + 1 <= data.length) {
    [lifecycleType, off] = readLifecycle(data, off);
  }
  if (off + 2 <= data.length) {
    [maxStates, off] = readU16(data, off);
  }
  if (off + 32 <= data.length) {
    [revealAuthority, off] = readPubkey(data, off);
  }
  if (off + 32 <= data.length) {
    off += 32; // skip reveal_entropy
  }
  if (off + 1 <= data.length) {
    [isRevealed, off] = readBool(data, off);
  }

  // Evolve thresholds (u32 + u64 + i64 + u64 = 28 bytes)
  let evolveTradeThreshold = 0;
  let evolveFeedThreshold = 0;
  let evolveHoldSeconds = 0;
  let evolveLockedThreshold = 0;
  if (off + 28 <= data.length) {
    [evolveTradeThreshold, off] = readU32(data, off);
    [evolveFeedThreshold, off] = readU64(data, off);
    [evolveHoldSeconds, off] = readI64(data, off);
    [evolveLockedThreshold, off] = readU64(data, off);
  }

  // Skip transition_policy_hash (32) + randomness_policy (1) + manifest_root (32) + reveal_commitment (32)
  if (off + 32 + 1 + 32 + 32 <= data.length) {
    off += 32 + 1 + 32 + 32;
  }
  if (off + 32 <= data.length) {
    [burnDestination, off] = readPubkey(data, off);
  }
  if (off + 32 <= data.length) {
    [artworkManifestHash, off] = readBytes32(data, off);
  }

  return {
    name, creator, supplyCap, currentSupply,
    shatterFeeBps, shatterFeeDestination: shatterFeeDest,
    tradeRoyaltyBps, royaltyDestination: royaltyDest,
    mintPriceLamports, lockAmountLamports, bump,
    metadataUri, lifecycleType, maxStates, revealAuthority,
    isRevealed, burnDestination, artworkManifestHash,
    evolveTradeThreshold, evolveFeedThreshold, evolveHoldSeconds, evolveLockedThreshold,
  };
}

export function parseEVOAccount(data: Buffer): EVOAccount | null {
  if (data.length < 8) return null;
  if (!data.subarray(0, 8).equals(ACCT_DISC.EVOAccount)) return null;
  let off = 8;
  const [collection, o1] = readPubkey(data, off); off = o1;
  const [owner, o2] = readPubkey(data, off); off = o2;
  const [lockedLamports, o3] = readU64(data, off); off = o3;
  const [forgedAt, o4] = readI64(data, off); off = o4;
  const [facetCount, o5] = readU32(data, off); off = o5;
  const [tradeCount, o6] = readU32(data, off); off = o6;
  const resonanceSeed = Buffer.from(data.subarray(off, off + 32)); off += 32;
  const fracLen = data.readUInt32LE(off); off += 4;
  const fractureLines: FractureLine[] = [];
  for (let i = 0; i < fracLen; i++) {
    const [tradeNumber, f1] = readU32(data, off); off = f1;
    const [previousOwner, f2] = readPubkey(data, off); off = f2;
    const [timestamp, f3] = readI64(data, off); off = f3;
    const [position, f4] = readU16(data, off); off = f4;
    const [intensity, f5] = [data[off], off + 1]; off = f5;
    fractureLines.push({ tradeNumber, previousOwner, timestamp, position, intensity });
  }
  const [isShattered, l3] = readBool(data, off); off = l3;
  const [bump, l4] = [data[off], off + 1]; off = l4;

  // Lifecycle state
  let mintIndex = 0;
  let currentState = 0;
  let lastTransitionAt = 0;
  let feedCount = 0;
  let totalFedLamports = 0;

  if (off + 4 <= data.length) {
    [mintIndex, off] = readU32(data, off);
  }
  if (off + 2 <= data.length) {
    [currentState, off] = readU16(data, off);
  }
  if (off + 8 <= data.length) {
    [lastTransitionAt, off] = readI64(data, off);
  }
  if (off + 4 <= data.length) {
    [feedCount, off] = readU32(data, off);
  }
  if (off + 8 <= data.length) {
    [totalFedLamports, off] = readU64(data, off);
  }

  return {
    collection, owner, lockedLamports, forgedAt, facetCount, tradeCount,
    resonanceSeed, fractureLines, isShattered, bump,
    mintIndex, currentState, lastTransitionAt, feedCount, totalFedLamports,
  };
}

export function parseListingAccount(data: Buffer): ListingData | null {
  if (data.length < 8) return null;
  if (!data.subarray(0, 8).equals(ACCT_DISC.Listing)) return null;
  let off = 8;
  const [evo, o1] = readPubkey(data, off); off = o1;
  const [seller, o2] = readPubkey(data, off); off = o2;
  const [priceLamports, o3] = readU64(data, off); off = o3;
  const bump = data[off];
  return { evo, seller, priceLamports, bump };
}

// ─── Instruction Builders ────────────────────────────────────
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
  lifecycle: LifecycleParamsInput,
): TransactionInstruction {
  const [collectionPda] = getCollectionPDA(name);
  const data = Buffer.concat([
    DISC.createCollection,
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
    programId: PROGRAM_ID,
    keys: [
      { pubkey: collectionPda, isSigner: false, isWritable: true },
      { pubkey: PROTOCOL_PDA, isSigner: false, isWritable: false },
      { pubkey: treasury, isSigner: false, isWritable: true },
      { pubkey: payer, isSigner: true, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data,
  });
}

export function createForgeIx(
  owner: PublicKey,
  collectionPda: PublicKey,
  creator: PublicKey,
  evoId: number,
  resonanceSeed: Buffer,
): TransactionInstruction {
  const [evoPda] = getEvoPDA(collectionPda, evoId);
  const data = Buffer.concat([
    DISC.forge,
    writeU32(evoId),
    resonanceSeed,
  ]);
  return new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: evoPda, isSigner: false, isWritable: true },
      { pubkey: collectionPda, isSigner: false, isWritable: true },
      { pubkey: PROTOCOL_PDA, isSigner: false, isWritable: false },
      { pubkey: creator, isSigner: false, isWritable: true },
      { pubkey: owner, isSigner: true, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data,
  });
}

export function createFeedIx(
  evoPda: PublicKey,
  collectionPda: PublicKey,
  feeder: PublicKey,
  evoId: number,
  additionalLamports: number,
): TransactionInstruction {
  const data = Buffer.concat([
    DISC.feed,
    writeU32(evoId),
    writeU64(additionalLamports),
  ]);
  return new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: evoPda, isSigner: false, isWritable: true },
      { pubkey: collectionPda, isSigner: false, isWritable: false },
      { pubkey: feeder, isSigner: true, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data,
  });
}

export function createListIx(
  evoPda: PublicKey,
  collectionPda: PublicKey,
  seller: PublicKey,
  evoId: number,
  priceLamports: number,
): TransactionInstruction {
  const [listingPda] = getListingPDA(evoPda);
  const data = Buffer.concat([
    DISC.list,
    writeU32(evoId),
    writeU64(priceLamports),
  ]);
  return new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: evoPda, isSigner: false, isWritable: false },
      { pubkey: collectionPda, isSigner: false, isWritable: false },
      { pubkey: listingPda, isSigner: false, isWritable: true },
      { pubkey: seller, isSigner: true, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data,
  });
}

export function createDelistIx(
  evoPda: PublicKey,
  collectionPda: PublicKey,
  seller: PublicKey,
  evoId: number,
): TransactionInstruction {
  const [listingPda] = getListingPDA(evoPda);
  const data = Buffer.concat([DISC.delist, writeU32(evoId)]);
  return new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: evoPda, isSigner: false, isWritable: false },
      { pubkey: collectionPda, isSigner: false, isWritable: false },
      { pubkey: listingPda, isSigner: false, isWritable: true },
      { pubkey: seller, isSigner: true, isWritable: true },
    ],
    data,
  });
}

export function createBuyIx(
  evoPda: PublicKey,
  collectionPda: PublicKey,
  seller: PublicKey,
  creator: PublicKey,
  buyer: PublicKey,
  treasury: PublicKey,
  royaltyDest: FeeDestination,
  burnDestination: PublicKey,
  evoId: number,
): TransactionInstruction {
  const incinerator = (royaltyDest === 'Burn')
    ? (burnDestination.equals(PublicKey.default) ? INCINERATOR : burnDestination)
    : SystemProgram.programId;

  const [listingPda] = getListingPDA(evoPda);

  const keys = [
    { pubkey: evoPda, isSigner: false, isWritable: true },
    { pubkey: listingPda, isSigner: false, isWritable: true },
    { pubkey: collectionPda, isSigner: false, isWritable: false },
    { pubkey: PROTOCOL_PDA, isSigner: false, isWritable: false },
    { pubkey: seller, isSigner: false, isWritable: true },
    { pubkey: creator, isSigner: false, isWritable: true },
    { pubkey: (royaltyDest === 'Treasury' || royaltyDest === 'Split') ? treasury : SystemProgram.programId, isSigner: false, isWritable: true },
    { pubkey: incinerator, isSigner: false, isWritable: true },
    { pubkey: buyer, isSigner: true, isWritable: true },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
  ];
  return new TransactionInstruction({
    programId: PROGRAM_ID,
    keys,
    data: Buffer.concat([DISC.buy, writeU32(evoId)]),
  });
}

export function createShatterIx(
  evoPda: PublicKey,
  collectionPda: PublicKey,
  owner: PublicKey,
  creator: PublicKey,
  treasury: PublicKey | null,
  evoId: number,
  shatterFeeDest: FeeDestination,
  burnDestination: PublicKey,
): TransactionInstruction {
  const incinerator = (shatterFeeDest === 'Burn')
    ? (burnDestination.equals(PublicKey.default) ? INCINERATOR : burnDestination)
    : INCINERATOR;

  const keys = [
    { pubkey: evoPda, isSigner: false, isWritable: true },
    { pubkey: collectionPda, isSigner: false, isWritable: false },
    { pubkey: PROTOCOL_PDA, isSigner: false, isWritable: false },
    { pubkey: owner, isSigner: true, isWritable: true },
    { pubkey: creator, isSigner: false, isWritable: true },
    { pubkey: (treasury && (shatterFeeDest === 'Treasury' || shatterFeeDest === 'Split')) ? treasury : SystemProgram.programId, isSigner: false, isWritable: true },
    { pubkey: incinerator, isSigner: false, isWritable: true },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
  ];
  const data = Buffer.concat([DISC.shatter, writeU32(evoId)]);
  return new TransactionInstruction({
    programId: PROGRAM_ID,
    keys,
    data,
  });
}

export function createTransferIx(
  evoPda: PublicKey,
  collectionPda: PublicKey,
  currentOwner: PublicKey,
  treasury: PublicKey,
  evoId: number,
  newOwner: PublicKey,
): TransactionInstruction {
  const data = Buffer.concat([DISC.transfer, writeU32(evoId), writePubkey(newOwner)]);
  return new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: evoPda, isSigner: false, isWritable: true },
      { pubkey: collectionPda, isSigner: false, isWritable: false },
      { pubkey: PROTOCOL_PDA, isSigner: false, isWritable: false },
      { pubkey: treasury, isSigner: false, isWritable: true },
      { pubkey: currentOwner, isSigner: true, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data,
  });
}

export function createUpdateMetadataIx(
  collectionPda: PublicKey,
  creator: PublicKey,
  metadataUri: string,
): TransactionInstruction {
  const data = Buffer.concat([
    DISC.updateMetadata,
    writeString(metadataUri),
  ]);
  return new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: collectionPda, isSigner: false, isWritable: true },
      { pubkey: creator, isSigner: true, isWritable: false },
    ],
    data,
  });
}

export function createRevealCollectionIx(
  collectionPda: PublicKey,
  authority: PublicKey,
  secret: Uint8Array,
): TransactionInstruction {
  const data = Buffer.concat([
    DISC.revealCollection,
    Buffer.from(secret),
  ]);
  return new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: collectionPda, isSigner: false, isWritable: true },
      { pubkey: authority, isSigner: true, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data,
  });
}

export function createEvolveIx(
  evoPda: PublicKey,
  collectionPda: PublicKey,
  evoId: number,
): TransactionInstruction {
  return new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: evoPda, isSigner: false, isWritable: true },
      { pubkey: collectionPda, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data: Buffer.concat([DISC.evolve, writeU32(evoId)]),
  });
}

export function createSetVisualStageIx(
  evoPda: PublicKey,
  collectionPda: PublicKey,
  authority: PublicKey,
  evoId: number,
  stage: number,
): TransactionInstruction {
  const data = Buffer.concat([
    DISC.setVisualStage,
    writeU32(evoId),
    Buffer.from(new Uint16Array([stage]).buffer),
  ]);
  return new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: evoPda, isSigner: false, isWritable: true },
      { pubkey: collectionPda, isSigner: false, isWritable: false },
      { pubkey: authority, isSigner: true, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data,
  });
}

// ─── Read helpers ────────────────────────────────────────────
export async function readProtocolConfig(conn: Connection): Promise<ProtocolConfig | null> {
  const acc = await conn.getAccountInfo(PROTOCOL_PDA);
  if (!acc || !acc.data) return null;
  return parseProtocolConfig(acc.data);
}

export function createInitializeProtocolIx(
  payer: PublicKey,
  treasury: PublicKey,
  creationFeeLamports: number,
): TransactionInstruction {
  const data = Buffer.concat([
    DISC.initializeProtocol,
    writePubkey(treasury),
    writeU64(creationFeeLamports),
  ]);
  return new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: PROTOCOL_PDA, isSigner: false, isWritable: true },
      { pubkey: payer, isSigner: true, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data,
  });
}

export async function readCollectionConfig(conn: Connection, name: string): Promise<CollectionConfig | null> {
  const [pda] = getCollectionPDA(name);
  const acc = await conn.getAccountInfo(pda);
  if (!acc || !acc.data) return null;
  return parseCollectionConfig(acc.data);
}

export async function readEVO(conn: Connection, collectionPda: PublicKey, evoId: number): Promise<EVOAccount | null> {
  const [pda] = getEvoPDA(collectionPda, evoId);
  const acc = await conn.getAccountInfo(pda);
  if (!acc || !acc.data) return null;
  const evo = parseEVOAccount(acc.data);
  if (evo) {
    evo.evoId = evoId;
    evo.pda = pda;
  }
  return evo;
}

export async function readListing(conn: Connection, evoPda: PublicKey): Promise<ListingData | null> {
  const [pda] = getListingPDA(evoPda);
  const acc = await conn.getAccountInfo(pda);
  if (!acc || !acc.data) return null;
  const listing = parseListingAccount(acc.data);
  if (listing) listing.pda = pda;
  return listing;
}

export async function readAllEVOs(conn: Connection, collectionPda: PublicKey, supplyCap: number): Promise<EVOAccount[]> {
  // Derive all possible EVO PDAs and fetch in batches
  const evos: EVOAccount[] = [];
  const BATCH = 100;
  for (let i = 0; i < supplyCap; i += BATCH) {
    const end = Math.min(i + BATCH, supplyCap);
    const pdaPromises: Promise<[PublicKey, number]>[] = [];
    const pdas: PublicKey[] = [];
    for (let j = i; j < end; j++) {
      const [pda] = getEvoPDA(collectionPda, j);
      pdas.push(pda);
    }
    const accounts = await conn.getMultipleAccountsInfo(pdas);
    for (let k = 0; k < accounts.length; k++) {
      const acc = accounts[k];
      if (acc && acc.data) {
        const evo = parseEVOAccount(acc.data);
        if (evo) {
          evo.evoId = i + k;
          evo.pda = pdas[k];
          evos.push(evo);
        }
      }
    }
  }
  return evos;
}

// ─── Collection & Portfolio Discovery ────────────────────────

// Account sizes (from on-chain SPACE constants)
export const COLLECTION_CONFIG_SPACE = 568;
export const EVO_ACCOUNT_SPACE = 1101;
export const LISTING_ACCOUNT_SPACE = 81;

export interface CollectionDiscovery {
  config: CollectionConfig;
  pda: PublicKey;
}

// Read ALL collections on the protocol via getProgramAccounts
// Uses dataSize filter to find CollectionConfig accounts, then validates discriminator
export async function readAllCollections(conn: Connection): Promise<CollectionDiscovery[]> {
  const accounts = await conn.getProgramAccounts(PROGRAM_ID, {
    filters: [{ dataSize: COLLECTION_CONFIG_SPACE }],
  });
  const collections: CollectionDiscovery[] = [];
  for (const { pubkey, account } of accounts) {
    const config = parseCollectionConfig(account.data);
    if (config) {
      collections.push({ config, pda: pubkey });
    }
  }
  return collections;
}

// Read ALL EVOs owned by a specific wallet (across ALL collections)
// Uses dataSize + memcmp filters for efficient scanning
export async function readAllEVOsByOwner(conn: Connection, owner: PublicKey): Promise<EVOAccount[]> {
  const accounts = await conn.getProgramAccounts(PROGRAM_ID, {
    filters: [
      { dataSize: EVO_ACCOUNT_SPACE },
      { memcmp: { offset: 40, bytes: owner.toBase58() } },
    ],
  });
  const evos: EVOAccount[] = [];
  for (const { pubkey, account } of accounts) {
    const evo = parseEVOAccount(account.data);
    if (evo) {
      evo.pda = pubkey;
      // Derive evoId from PDA, not mintIndex (they may differ for non-sequential forges)
      const [testPda] = getEvoPDA(evo.collection, evo.mintIndex);
      if (testPda.equals(pubkey)) {
        evo.evoId = evo.mintIndex;
      } else {
        // Non-sequential evo_id — search for the matching PDA seed
        let found = false;
        for (let i = 0; i < 100000 && !found; i++) {
          const [p] = getEvoPDA(evo.collection, i);
          if (p.equals(pubkey)) { evo.evoId = i; found = true; }
        }
        if (!found) evo.evoId = evo.mintIndex;
      }
      evos.push(evo);
    }
  }
  return evos;
}

// ─── Utility ─────────────────────────────────────────────────
export function lamportsToSol(lamports: number): number {
  return lamports / LAMPORTS_PER_SOL;
}

export function solToLamports(sol: number): number {
  return Math.floor(sol * LAMPORTS_PER_SOL);
}

export function generateResonanceSeed(): Buffer {
  return Buffer.from(crypto.getRandomValues(new Uint8Array(32)));
}