// CollectionBuilder — fluent API for constructing EVO collection creation
// transactions. Chainable methods let you configure a collection step-by-step
// and produce a ready-to-sign TransactionInstruction.
//
// Usage:
//   const ix = new CollectionBuilder(payer, treasury)
//     .name('Genesis')
//     .supplyCap(10_000)
//     .fees({ shatterFeeBps: 100, tradeRoyaltyBps: 250 })
//     .lifecycle({ lifecycleType: 'CommitReveal', maxStates: 4, ... })
//     .metadata('https://gateway.irys.xyz/tx/...')
//     .build();

import { PublicKey, TransactionInstruction } from '@solana/web3.js';
import { createCreateCollectionIx } from './instructions';
import { FeeDestination, LifecycleParams } from './types';

export interface FeesConfig {
  shatterFeeBps: number;
  shatterFeeDestination: FeeDestination;
  tradeRoyaltyBps: number;
  royaltyDestination: FeeDestination;
}

export interface EconomicConfig {
  mintPriceLamports: number;
  lockAmountLamports: number;
}

export class CollectionBuilder {
  private _name: string = '';
  private _supplyCap: number = 0;
  private _fees: FeesConfig = {
    shatterFeeBps: 0,
    shatterFeeDestination: 'Burn',
    tradeRoyaltyBps: 0,
    royaltyDestination: 'Creator',
  };
  private _economics: EconomicConfig = {
    mintPriceLamports: 0,
    lockAmountLamports: 1_000_000_000, // 1 SOL default lock
  };
  private _metadataUri: string = '';
  private _lifecycle: LifecycleParams | null = null;

  constructor(
    private readonly payer: PublicKey,
    private readonly treasury: PublicKey,
  ) {}

  /** Set the collection name (used in PDA derivation, must be unique). */
  name(name: string): this {
    this._name = name;
    return this;
  }

  /** Set the maximum supply of EVOs that can be forged. */
  supplyCap(cap: number): this {
    this._supplyCap = cap;
    return this;
  }

  /** Configure shatter fee and trade royalty percentages and destinations. */
  fees(fees: Partial<FeesConfig>): this {
    this._fees = { ...this._fees, ...fees };
    return this;
  }

  /** Set mint price and lock amount (both in lamports). */
  economics(econ: Partial<EconomicConfig>): this {
    this._economics = { ...this._economics, ...econ };
    return this;
  }

  /** Set lifecycle parameters (reveal, evolution, manifest root, etc.). */
  lifecycle(lc: LifecycleParams): this {
    this._lifecycle = lc;
    return this;
  }

  /** Set the off-chain metadata URI (Irys/Arweave URL to collection JSON). */
  metadata(uri: string): this {
    this._metadataUri = uri;
    return this;
  }

  /** Build the createCollection TransactionInstruction. */
  build(): TransactionInstruction {
    if (!this._name) throw new Error('CollectionBuilder: name() is required');
    if (this._supplyCap < 1) throw new Error('CollectionBuilder: supplyCap() must be >= 1');
    if (!this._metadataUri) throw new Error('CollectionBuilder: metadata() is required');
    if (!this._lifecycle) throw new Error('CollectionBuilder: lifecycle() is required');

    return createCreateCollectionIx(
      this.payer,
      this.treasury,
      this._name,
      this._supplyCap,
      this._fees.shatterFeeBps,
      this._fees.shatterFeeDestination,
      this._fees.tradeRoyaltyBps,
      this._fees.royaltyDestination,
      this._economics.mintPriceLamports,
      this._economics.lockAmountLamports,
      this._metadataUri,
      this._lifecycle,
    );
  }
}