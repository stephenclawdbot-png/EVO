// EvoClient — the main SDK class wallet developers use.
// Connect to a Solana RPC, query EVOs by owner, collection, or address.

import { Connection, PublicKey, GetProgramAccountsConfig, MemcmpFilter } from '@solana/web3.js';
import { deserializeEVOAccount, deserializeCollectionConfig } from './layout';
import { getCollectionPDA, getEVOPDA } from './derive';
import { EVO_PROGRAM_ID } from './constants';
import { EVOAccount, CollectionConfig, EvoDisplayData } from './types';
import { toDisplayData } from './display';

const PROGRAM = new PublicKey(EVO_PROGRAM_ID);
const PUBKEY_LEN = 32;
const OWNER_OFFSET = 8 + PUBKEY_LEN; // discriminator(8) + collection(32)

export class EvoClient {
  constructor(private connection: Connection) {}

  /**
   * Find all EVOs owned by a wallet.
   * This is the primary function wallets call to show a user's EVO portfolio.
   */
  async findByOwner(ownerWallet: string | PublicKey): Promise<EVOAccount[]> {
    const ownerPubkey = typeof ownerWallet === 'string' ? new PublicKey(ownerWallet) : ownerWallet;

    const filter: MemcmpFilter = {
      memcmp: {
        offset: OWNER_OFFSET,
        bytes: ownerPubkey.toBase58(),
        encoding: 'base58',
      },
    };

    const accounts = await this.connection.getProgramAccounts(PROGRAM, {
      filters: [filter],
    });

    return accounts
      .map(({ account, pubkey }) => {
        try {
          return deserializeEVOAccount(account.data, pubkey.toBase58());
        } catch {
          return null;
        }
      })
      .filter((e): e is EVOAccount => e !== null);
  }

  /** Get a single EVO by collection name and EVO ID. */
  async getEvo(collectionName: string, evoId: number): Promise<EVOAccount | null> {
    const [collectionPDA] = getCollectionPDA(collectionName);
    const [evoPDA] = getEVOPDA(collectionPDA, evoId);

    const accountInfo = await this.connection.getAccountInfo(evoPDA);
    if (!accountInfo || !accountInfo.data) return null;

    return deserializeEVOAccount(accountInfo.data, evoPDA.toBase58());
  }

  /** Get a single EVO by its PDA address. */
  async getEvoByAddress(evoAddress: string | PublicKey): Promise<EVOAccount | null> {
    const pubkey = typeof evoAddress === 'string' ? new PublicKey(evoAddress) : evoAddress;
    const accountInfo = await this.connection.getAccountInfo(pubkey);
    if (!accountInfo || !accountInfo.data) return null;

    return deserializeEVOAccount(accountInfo.data, pubkey.toBase58());
  }

  /** Get all EVOs in a collection. */
  async getCollectionEvos(collectionName: string): Promise<EVOAccount[]> {
    const [collectionPDA] = getCollectionPDA(collectionName);

    const filter: MemcmpFilter = {
      memcmp: {
        offset: 8,
        bytes: collectionPDA.toBase58(),
        encoding: 'base58',
      },
    };

    const accounts = await this.connection.getProgramAccounts(PROGRAM, {
      filters: [filter],
    });

    return accounts
      .map(({ account, pubkey }) => {
        try {
          return deserializeEVOAccount(account.data, pubkey.toBase58());
        } catch {
          return null;
        }
      })
      .filter((e): e is EVOAccount => e !== null);
  }

  /** Get a collection's configuration. */
  async getCollectionConfig(collectionName: string): Promise<CollectionConfig | null> {
    const [collectionPDA] = getCollectionPDA(collectionName);
    const accountInfo = await this.connection.getAccountInfo(collectionPDA);
    if (!accountInfo || !accountInfo.data) return null;

    return deserializeCollectionConfig(accountInfo.data, collectionPDA.toBase58());
  }

  /** Get display data (human-readable) for an EVO. */
  async getEvoDisplay(collectionName: string, evoId: number): Promise<EvoDisplayData | null> {
    const account = await this.getEvo(collectionName, evoId);
    if (!account) return null;
    return toDisplayData(account);
  }

  /** Find all EVOs owned by a wallet, with display data pre-computed. */
  async findDisplayByOwner(ownerWallet: string | PublicKey): Promise<EvoDisplayData[]> {
    const accounts = await this.findByOwner(ownerWallet);
    return accounts.map(toDisplayData);
  }
}