'use client';

import { useState, useCallback, useEffect } from 'react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { Transaction, LAMPORTS_PER_SOL } from '@solana/web3.js';
import Link from 'next/link';
import {
  readCollectionConfig,
  getCollectionPDA,
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
    setForging(true); setError(null); setTxSig(null);
    try {
      const cfg = await readCollectionConfig(connection, COLLECTION_NAME);
      if (!cfg) throw new Error('Collection not found');
      if (cfg.currentSupply >= cfg.supplyCap) throw new Error('Collection is full');

      const [collectionPda] = getCollectionPDA(COLLECTION_NAME);
      const evoId = cfg.currentSupply;
      const resonanceSeed = generateResonanceSeed();
      const ix = createForgeIx(wallet.publicKey, collectionPda, cfg.creator, evoId, resonanceSeed);

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
  const totalCost = collection ? collection.mintPriceSol + collection.lockAmountSol : 0;
  const shatterRecover = collection ? collection.lockAmountSol * (1 - collection.shatterFeeBps / 10000) : 0;

  return (
    <div className="min-h-screen bg-[#0a0a0b] text-white">
      {/* Nav */}
      <nav className="sticky top-0 z-50 border-b border-[#1a1a1e] bg-[#0a0a0b]/80 backdrop-blur-xl">
        <div className="mx-auto max-w-7xl px-4 lg:px-6">
          <div className="flex h-16 items-center justify-between">
            <Link href="/" className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
              Gallery
            </Link>
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 text-sm font-bold">Z</div>
            </div>
            <WalletMultiButton />
          </div>
        </div>
      </nav>

      <div className="mx-auto max-w-2xl px-4 py-12 lg:px-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold">Forge a Z</h1>
          <p className="mt-2 text-sm text-gray-500">Mint a new EVO with SOL locked inside</p>
        </div>

        {loading ? (
          <div className="mt-12 flex justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#232328] border-t-indigo-500" />
          </div>
        ) : collection ? (
          <>
            {/* Creature preview */}
            {creature && (
              <div className="mt-8 flex flex-col items-center">
                <div className="relative flex h-56 w-56 items-center justify-center overflow-hidden rounded-2xl border border-[#1a1a1e] bg-[#131316]">
                  <div className="absolute inset-0" style={{ background: `radial-gradient(circle at 50% 50%, rgba(99,102,241,0.15), transparent 60%)` }} />
                  <img src={creature.stages.baby} alt={creature.displayName} className="relative z-[1]"
                    style={{ imageRendering: 'pixelated', transform: 'scale(2)' }} />
                </div>
                <div className="mt-4 text-center">
                  <p className="text-lg font-bold">{creature.displayName}</p>
                  <p className="text-sm text-gray-500">Z #{currentSupply} · {creature.element} · {creature.rarity}</p>
                </div>
              </div>
            )}

            {/* Pricing */}
            <div className="mt-8 space-y-2">
              <PriceRow label="Mint Price (→ Creator)" value={`${collection.mintPriceSol}◎`} color="text-yellow-400" />
              <PriceRow label="Locked Value (Your Floor)" value={`${collection.lockAmountSol}◎`} color="text-green-400" />
              <div className="my-3 border-t border-[#1a1a1e]" />
              <PriceRow label="Total to Forge" value={`${totalCost.toFixed(3)}◎`} color="text-white" bold />
            </div>

            {/* Supply bar */}
            <div className="mt-6 rounded-xl border border-[#1a1a1e] bg-[#131316] p-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-400">Supply</span>
                <span className="font-mono font-bold">{currentSupply} / {collection.supplyCap}</span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#0a0a0b]">
                <div className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all" style={{ width: `${(currentSupply / collection.supplyCap) * 100}%` }} />
              </div>
              <p className="mt-2 text-xs text-gray-500">{remaining} remaining</p>
            </div>

            {/* Shatter info */}
            <div className="mt-4 rounded-xl border border-[#1a1a1e] bg-[#131316]/50 p-4 text-xs text-gray-400">
              <div className="flex justify-between">
                <span>Shatter fee</span>
                <span className="text-white font-medium">{collection.shatterFeeBps / 100}%</span>
              </div>
              <div className="mt-1 flex justify-between">
                <span>Trade royalty</span>
                <span className="text-white font-medium">{collection.tradeRoyaltyBps / 100}%</span>
              </div>
              <div className="mt-3 border-t border-[#1a1a1e] pt-2 flex justify-between">
                <span>Recoverable on shatter</span>
                <span className="text-green-400 font-medium">{shatterRecover.toFixed(4)}◎</span>
              </div>
            </div>

            {/* Forge button */}
            <div className="mt-8 flex flex-col items-center">
              <button onClick={handleForge} disabled={!wallet.connected || forging || remaining === 0}
                className="w-full rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 px-8 py-4 text-base font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50">
                {forging ? 'Forging...' : remaining === 0 ? 'Collection Full' : `Forge Z #${currentSupply}`}
              </button>
              {!wallet.connected && <p className="mt-3 text-xs text-gray-600">Connect wallet to forge</p>}
            </div>

            {/* Result */}
            {txSig && (
              <div className="mt-6 rounded-xl border border-green-500/30 bg-green-500/10 p-4 text-center">
                <p className="font-bold text-green-400">✅ Z Forged Successfully!</p>
                <a href={`https://solscan.io/tx/${txSig}`} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block text-sm text-indigo-400 hover:underline">
                  View on Solscan →
                </a>
              </div>
            )}
            {error && (
              <div className="mt-6 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-center">
                <p className="font-bold text-red-400">❌ {error}</p>
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

function PriceRow({ label, value, color, bold }: { label: string; value: string; color: string; bold?: boolean }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-[#1a1a1e] bg-[#131316] px-4 py-3">
      <span className="text-sm text-gray-400">{label}</span>
      <span className={`font-mono ${bold ? 'text-lg font-bold' : 'text-base font-medium'} ${color}`}>{value}</span>
    </div>
  );
}