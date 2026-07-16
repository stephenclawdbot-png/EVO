'use client';

import { useState, useCallback, useEffect } from 'react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { Transaction, LAMPORTS_PER_SOL } from '@solana/web3.js';
import Link from 'next/link';
import {
  readCollectionConfig,
  getCollectionPDA,
  getEvoPDA,
  createForgeIx,
  generateResonanceSeed,
} from '@/lib/evo-program';
import { CollectionData, CREATURES, collectionConfigToData } from '@/lib/evo-data';

const COLLECTION_NAME = 'Z';

export default function ForgePage() {
  const { connection } = useConnection();
  const wallet = useWallet();
  const [collection, setCollection] = useState<CollectionData | null>(null);
  const [currentSupply, setCurrentSupply] = useState(0);
  const [loading, setLoading] = useState(true);
  const [forging, setForging] = useState(false);
  const [txSig, setTxSig] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchCollection = useCallback(async () => {
    setLoading(true);
    try {
      const cfg = await readCollectionConfig(connection, COLLECTION_NAME);
      if (cfg) {
        setCollection(collectionConfigToData(cfg));
        setCurrentSupply(cfg.currentSupply);
      }
    } catch (err) {
      console.error('Failed to fetch collection:', err);
    } finally {
      setLoading(false);
    }
  }, [connection]);

  useEffect(() => {
    fetchCollection();
  }, [fetchCollection]);

  const handleForge = async () => {
    if (!wallet.connected || !wallet.publicKey || !collection) {
      setError('Connect your wallet first');
      return;
    }

    setForging(true);
    setError(null);
    setTxSig(null);

    try {
      const cfg = await readCollectionConfig(connection, COLLECTION_NAME);
      if (!cfg) throw new Error('Collection not found');
      if (cfg.currentSupply >= cfg.supplyCap) throw new Error('Collection is full');

      const [collectionPda] = getCollectionPDA(COLLECTION_NAME);
      const evoId = cfg.currentSupply;
      const resonanceSeed = generateResonanceSeed();

      const ix = createForgeIx(
        wallet.publicKey,
        collectionPda,
        cfg.creator,
        evoId,
        resonanceSeed,
      );

      const tx = new Transaction().add(ix);
      tx.feePayer = wallet.publicKey;
      const { blockhash } = await connection.getLatestBlockhash();
      tx.recentBlockhash = blockhash;

      const signed = await wallet.signTransaction?.(tx);
      if (!signed) throw new Error('Transaction signing failed');
      const sig = await connection.sendRawTransaction(signed.serialize());
      await connection.confirmTransaction(sig, 'confirmed');

      setTxSig(sig);
      await fetchCollection();
    } catch (err: any) {
      setError(err.message || 'Forge failed');
    } finally {
      setForging(false);
    }
  };

  const remaining = collection ? collection.supplyCap - currentSupply : 0;
  const creature = collection ? CREATURES[currentSupply % CREATURES.length] : null;

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-950 via-black to-gray-950">
      <header className="sticky top-0 z-50 border-b border-white/10 bg-black/80 backdrop-blur-xl">
        <div className="mx-auto max-w-7xl px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link href="/" className="text-gray-400 hover:text-white transition-colors">
                ← Gallery
              </Link>
            </div>
            <WalletMultiButton className="!bg-gradient-to-r !from-purple-500 !to-blue-500 !rounded-lg !text-sm !font-bold !text-white !border-0 hover:!opacity-90 !h-10 !px-4" />
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-4xl px-4 py-12">
        <h1 className="text-4xl font-bold text-white text-center">Forge a Z</h1>
        <p className="mt-2 text-center text-gray-500">
          Mint a new Evolving Value Object with SOL locked inside
        </p>

        {loading ? (
          <div className="mt-12 text-center text-gray-600">Loading collection data...</div>
        ) : collection ? (
          <>
            {/* Next creature preview */}
            {creature && (
              <div className="mt-8 flex flex-col items-center">
                <div className="relative flex h-64 w-64 items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-b from-gray-900 to-gray-950">
                  <div
                    className="absolute inset-0"
                    style={{
                      background: `radial-gradient(circle at 50% 50%, rgba(168,85,247,0.15), transparent 60%)`,
                    }}
                  />
                  <img
                    src={creature.stages.baby}
                    alt={creature.displayName}
                    className="relative z-[1]"
                    style={{ imageRendering: 'pixelated', transform: 'scale(2)' }}
                  />
                </div>
                <p className="mt-4 text-lg font-bold text-white">{creature.displayName}</p>
                <p className="text-sm text-gray-500">
                  Next Z #{currentSupply} · {creature.element} · {creature.rarity}
                </p>
              </div>
            )}

            {/* Pricing */}
            <div className="mt-8 grid grid-cols-3 gap-4">
              <div className="rounded-xl border border-white/10 bg-gray-900/50 p-4 text-center">
                <p className="text-xs text-gray-500">Mint Price (→ Creator)</p>
                <p className="mt-1 text-2xl font-bold text-yellow-400">{collection.mintPriceSol}◎</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-gray-900/50 p-4 text-center">
                <p className="text-xs text-gray-500">Locked Value (Floor)</p>
                <p className="mt-1 text-2xl font-bold text-green-400">{collection.lockAmountSol}◎</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-gray-900/50 p-4 text-center">
                <p className="text-xs text-gray-500">Total to Forge</p>
                <p className="mt-1 text-2xl font-bold text-white">
                  {(collection.mintPriceSol + collection.lockAmountSol).toFixed(3)}◎
                </p>
              </div>
            </div>

            {/* Supply bar */}
            <div className="mt-6 rounded-xl border border-white/10 bg-gray-900/50 p-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-400">Supply</span>
                <span className="text-white font-bold">{currentSupply} / {collection.supplyCap}</span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-gray-800">
                <div
                  className="h-full bg-gradient-to-r from-purple-500 to-blue-500 transition-all"
                  style={{ width: `${(currentSupply / collection.supplyCap) * 100}%` }}
                />
              </div>
              <p className="mt-2 text-xs text-gray-500">{remaining} remaining</p>
            </div>

            {/* Shatter info */}
            <div className="mt-4 rounded-xl border border-white/10 bg-gray-900/30 p-4 text-xs text-gray-400">
              <p>
                💥 Shatter fee: <span className="text-white font-bold">{collection.shatterFeeBps / 100}%</span> ·
                Royalty: <span className="text-white font-bold">{collection.tradeRoyaltyBps / 100}%</span> on trades
              </p>
              <p className="mt-1">
                Your Z contains {collection.lockAmountSol} SOL. You can always shatter it to recover
                {' '}{(collection.lockAmountSol * (1 - collection.shatterFeeBps / 10000)).toFixed(4)}◎ (after fee).
              </p>
            </div>

            {/* Forge button */}
            <div className="mt-8 flex flex-col items-center">
              <button
                onClick={handleForge}
                disabled={!wallet.connected || forging || remaining === 0}
                className="rounded-xl bg-gradient-to-r from-yellow-500 to-orange-500 px-12 py-4 text-lg font-bold text-black transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {forging ? 'Forging...' : remaining === 0 ? 'Collection Full' : `⚒️ Forge Z #${currentSupply}`}
              </button>
              {!wallet.connected && (
                <p className="mt-2 text-xs text-gray-600">Connect wallet to forge</p>
              )}
            </div>

            {/* Transaction result */}
            {txSig && (
              <div className="mt-6 rounded-xl border border-green-500/30 bg-green-500/10 p-4 text-center">
                <p className="text-green-400 font-bold">✅ Z Forged Successfully!</p>
                <a
                  href={`https://solscan.io/tx/${txSig}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-block text-sm text-blue-400 hover:underline"
                >
                  View on Solscan →
                </a>
              </div>
            )}

            {error && (
              <div className="mt-6 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-center">
                <p className="text-red-400 font-bold">❌ {error}</p>
              </div>
            )}
          </>
        ) : (
          <div className="mt-12 text-center text-gray-600">Collection not found</div>
        )}
      </div>
    </div>
  );
}