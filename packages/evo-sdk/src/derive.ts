// PDA derivation utilities — compute EVO and Collection addresses from seeds.

import { PublicKey } from '@solana/web3.js';
import { EVO_PROGRAM_ID, SEEDS } from './constants';

const PROGRAM = new PublicKey(EVO_PROGRAM_ID);

/** Derive a Collection PDA from a collection name. */
export function getCollectionPDA(collectionName: string): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from(SEEDS.COLLECTION), Buffer.from(collectionName)],
    PROGRAM,
  );
}

/** Derive an EVO PDA from its collection and EVO ID. */
export function getEVOPDA(collectionPDA: PublicKey, evoId: number): [PublicKey, number] {
  const idBuffer = Buffer.alloc(4);
  idBuffer.writeUInt32LE(evoId);
  return PublicKey.findProgramAddressSync(
    [Buffer.from(SEEDS.EVO), collectionPDA.toBuffer(), idBuffer],
    PROGRAM,
  );
}

/** Derive the Protocol Config PDA (singleton). */
export function getProtocolConfigPDA(): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from(SEEDS.PROTOCOL)],
    PROGRAM,
  );
}