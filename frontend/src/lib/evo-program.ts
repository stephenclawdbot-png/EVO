import { Buffer } from 'buffer';
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
export const PROGRAM_ID = new PublicKey('2AUfmSABAwfSAzMWuDfWXzm6TVVvVapWgtrAEBU4FHeR');
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
};

// Account discriminators (first 8 bytes of sha256("account:<Name>"))
const ACCT_DISC = {
  ProtocolConfig: Buffer.from([207, 91, 250, 28, 152, 179, 215, 209]),
  CollectionConfig: Buffer.from([223, 110, 152, 160, 174, 157, 106, 255]),
  EVOAccount: Buffer.from([172, 52, 230, 55, 100, 187, 196, 167]),
};

// ─── Types ───────────────────────────────────────────────────
export type FeeDestination = 'Treasury' | 'Creator' | 'Burn' | 'Split';
const FEE_DEST_MAP: Record<FeeDestination, number> = {
  Treasury: 0, Creator: 1, Burn: 2, Split: 3,
};

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
  isListed: boolean;
  listPriceLamports: number;
  isShattered: boolean;
  bump: number;
  // Derived
  evoId?: number;
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
  return {
    name, creator, supplyCap, currentSupply,
    shatterFeeBps, shatterFeeDestination: shatterFeeDest,
    tradeRoyaltyBps, royaltyDestination: royaltyDest,
    mintPriceLamports, lockAmountLamports, bump,
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
  const [isListed, l1] = readBool(data, off); off = l1;
  const [listPriceLamports, l2] = readU64(data, off); off = l2;
  const [isShattered, l3] = readBool(data, off); off = l3;
  const [bump, l4] = [data[off], off + 1]; off = l4;
  return {
    collection, owner, lockedLamports, forgedAt, facetCount, tradeCount,
    resonanceSeed, fractureLines, isListed, listPriceLamports, isShattered, bump,
  };
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
  feeder: PublicKey,
  additionalLamports: number,
): TransactionInstruction {
  const data = Buffer.concat([
    DISC.feed,
    writeU64(additionalLamports),
  ]);
  return new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: evoPda, isSigner: false, isWritable: true },
      { pubkey: feeder, isSigner: true, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data,
  });
}

export function createListIx(
  evoPda: PublicKey,
  seller: PublicKey,
  priceLamports: number,
): TransactionInstruction {
  const data = Buffer.concat([
    DISC.list,
    writeU64(priceLamports),
  ]);
  return new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: evoPda, isSigner: false, isWritable: true },
      { pubkey: seller, isSigner: true, isWritable: true },
    ],
    data,
  });
}

export function createDelistIx(
  evoPda: PublicKey,
  seller: PublicKey,
): TransactionInstruction {
  const data = DISC.delist;
  return new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: evoPda, isSigner: false, isWritable: true },
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
  treasury?: PublicKey,
): TransactionInstruction {
  const keys = [
    { pubkey: evoPda, isSigner: false, isWritable: true },
    { pubkey: collectionPda, isSigner: false, isWritable: false },
    { pubkey: seller, isSigner: false, isWritable: true },
    { pubkey: creator, isSigner: false, isWritable: true },
  ];
  if (treasury) {
    keys.push({ pubkey: treasury, isSigner: false, isWritable: true });
  }
  keys.push(
    { pubkey: buyer, isSigner: true, isWritable: true },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
  );
  return new TransactionInstruction({
    programId: PROGRAM_ID,
    keys,
    data: DISC.buy,
  });
}

export function createShatterIx(
  evoPda: PublicKey,
  collectionPda: PublicKey,
  owner: PublicKey,
  creator: PublicKey,
  treasury: PublicKey | null,
  evoId: number,
): TransactionInstruction {
  const keys = [
    { pubkey: evoPda, isSigner: false, isWritable: true },
    { pubkey: collectionPda, isSigner: false, isWritable: false },
    { pubkey: owner, isSigner: true, isWritable: true },
    { pubkey: creator, isSigner: false, isWritable: true },
  ];
  if (treasury) {
    keys.push({ pubkey: treasury, isSigner: false, isWritable: true });
  }
  keys.push({ pubkey: SystemProgram.programId, isSigner: false, isWritable: false });
  const data = Buffer.concat([DISC.shatter, writeU32(evoId)]);
  return new TransactionInstruction({
    programId: PROGRAM_ID,
    keys,
    data,
  });
}

export function createTransferIx(
  evoPda: PublicKey,
  currentOwner: PublicKey,
  newOwner: PublicKey,
): TransactionInstruction {
  const data = Buffer.concat([DISC.transfer, writePubkey(newOwner)]);
  return new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: evoPda, isSigner: false, isWritable: true },
      { pubkey: currentOwner, isSigner: true, isWritable: true },
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