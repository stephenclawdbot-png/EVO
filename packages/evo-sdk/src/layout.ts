// Binary account layout for EVO PDAs.
// Wallets use this to deserialize raw account data from getProgramAccounts.
// Matches the Anchor account struct byte-for-byte.

import { EVOAccount, FractureLine, CollectionConfig } from './types';

const DISCRIMINATOR_LEN = 8;
const PUBKEY_LEN = 32;
const U64_LEN = 8;
const U32_LEN = 4;
const U16_LEN = 2;
const BOOL_LEN = 1;
const I64_LEN = 8;

// EVO account discriminator (first 8 bytes of sha256("account:EVOAccount"))
export const EVO_ACCOUNT_DISCRIMINATOR = Buffer.from([
  172, 52, 230, 55, 100, 187, 196, 167,
]);

export const COLLECTION_CONFIG_DISCRIMINATOR = Buffer.from([
  223, 110, 152, 160, 174, 157, 106, 255,
]);

export const PROTOCOL_CONFIG_DISCRIMINATOR = Buffer.from([
  207, 91, 250, 28, 152, 179, 215, 209,
]);

function readPubkey(buf: Buffer, offset: number): string {
  return buf.subarray(offset, offset + PUBKEY_LEN).toString('base58');
}

function readU64(buf: Buffer, offset: number): number {
  return Number(buf.readBigUInt64LE(offset));
}

function readU32(buf: Buffer, offset: number): number {
  return buf.readUInt32LE(offset);
}

function readU16(buf: Buffer, offset: number): number {
  return buf.readUInt16LE(offset);
}

function readBool(buf: Buffer, offset: number): boolean {
  return buf.readUInt8(offset) === 1;
}

function readI64(buf: Buffer, offset: number): number {
  return Number(buf.readBigInt64LE(offset));
}

function readString(buf: Buffer, offset: number): { value: string; next: number } {
  const len = readU32(buf, offset);
  const value = buf.subarray(offset + U32_LEN, offset + U32_LEN + len).toString('utf8');
  return { value, next: offset + U32_LEN + len };
}

function readOptionPubkey(buf: Buffer, offset: number): { value: string | null; next: number } {
  const isSome = readBool(buf, offset);
  if (!isSome) return { value: null, next: offset + BOOL_LEN };
  return { value: readPubkey(buf, offset + BOOL_LEN), next: offset + BOOL_LEN + PUBKEY_LEN };
}

function readOptionU64(buf: Buffer, offset: number): { value: number | null; next: number } {
  const isSome = readBool(buf, offset);
  if (!isSome) return { value: null, next: offset + BOOL_LEN };
  return { value: readU64(buf, offset + BOOL_LEN), next: offset + BOOL_LEN + U64_LEN };
}

function readOptionString(buf: Buffer, offset: number): { value: string | null; next: number } {
  const isSome = readBool(buf, offset);
  if (!isSome) return { value: null, next: offset + BOOL_LEN };
  const { value, next } = readString(buf, offset + BOOL_LEN);
  return { value, next };
}

function readFractureLines(buf: Buffer, offset: number): { value: FractureLine[]; next: number } {
  const count = readU32(buf, offset);
  let cursor = offset + U32_LEN;
  const lines: FractureLine[] = [];

  for (let i = 0; i < count; i++) {
    lines.push({
      tradeNumber: readU32(buf, cursor),
      previousOwner: readPubkey(buf, cursor + U32_LEN),
      timestamp: readI64(buf, cursor + U32_LEN + PUBKEY_LEN),
      position: readU16(buf, cursor + U32_LEN + PUBKEY_LEN + I64_LEN),
      intensity: readU16(buf, cursor + U32_LEN + PUBKEY_LEN + I64_LEN + U16_LEN),
    });
    cursor += 48; // u32 + pubkey + i64 + u16 + u16 = 4+32+8+2+2
  }

  return { value: lines, next: cursor };
}

/**
 * Deserialize raw EVO account data into a typed object.
 */
export function deserializeEVOAccount(data: Buffer, address: string): EVOAccount {
  let offset = DISCRIMINATOR_LEN;

  const collection = readPubkey(data, offset);
  offset += PUBKEY_LEN;

  const owner = readPubkey(data, offset);
  offset += PUBKEY_LEN;

  const lockedLamports = readU64(data, offset);
  offset += U64_LEN;

  const forgedAt = readI64(data, offset);
  offset += I64_LEN;

  const facetCount = readU32(data, offset);
  offset += U32_LEN;

  const tradeCount = readU32(data, offset);
  offset += U32_LEN;

  const resonanceSeed = data.subarray(offset, offset + 32).toString('hex');
  offset += 32;

  const { value: fractureLines, next: afterFractures } = readFractureLines(data, offset);
  offset = afterFractures;

  const isListed = readBool(data, offset);
  offset += BOOL_LEN;

  const { value: listPriceLamports, next: afterListPrice } = readOptionU64(data, offset);
  offset = afterListPrice;

  const isShattered = readBool(data, offset);
  offset += BOOL_LEN;

  // Skip bump (1) + lifecycle fields (mint_index 4, current_state 2,
  // last_transition_at 8, feed_count 4, total_fed_lamports 8) = 27 bytes
  offset += 1 + U32_LEN + U16_LEN + I64_LEN + U32_LEN + U64_LEN;

  const manifestVerified = readBool(data, offset);

  return {
    address,
    collection,
    owner,
    lockedLamports,
    forgedAt,
    facetCount,
    tradeCount,
    resonanceSeed,
    fractureLines,
    isListed,
    listPriceLamports,
    isShattered,
    manifestVerified,
  };
}

/**
 * Deserialize a CollectionConfig account.
 */
export function deserializeCollectionConfig(data: Buffer, address: string): CollectionConfig {
  let offset = DISCRIMINATOR_LEN;

  const authority = readPubkey(data, offset);
  offset += PUBKEY_LEN;

  const { value: name, next: afterName } = readString(data, offset);
  offset = afterName;

  const maxSupply = readU32(data, offset);
  offset += U32_LEN;

  const mintPriceLamports = readU64(data, offset);
  offset += U64_LEN;

  const collectionTreasury = readPubkey(data, offset);
  offset += PUBKEY_LEN;

  const artSeed = data.subarray(offset, offset + 32).toString('hex');
  offset += 32;

  const { value: mintAuthority, next: afterMintAuth } = readOptionPubkey(data, offset);
  offset = afterMintAuth;

  const tradeFeeBps = readU16(data, offset);
  offset += U16_LEN;

  const shatterFeeBps = readU16(data, offset);
  offset += U16_LEN;

  const isPaused = readBool(data, offset);
  offset += BOOL_LEN;

  const { value: rendererHash, next: afterRenderer } = readOptionString(data, offset);
  offset = afterRenderer;

  const currentSupply = readU32(data, offset);

  return {
    authority,
    name,
    maxSupply,
    mintPriceLamports,
    collectionTreasury,
    artSeed,
    mintAuthority,
    tradeFeeBps,
    shatterFeeBps,
    isPaused,
    rendererHash,
    currentSupply,
  };
}