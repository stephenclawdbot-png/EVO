'use client';

import { useState, useCallback, useEffect } from 'react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { Nav } from '@/components/Nav';
import { Transaction } from '@solana/web3.js';
import Link from 'next/link';
import {
  readCollectionConfig,
  getCollectionPDA,
  createForgeIx,
  generateResonanceSeed,
} from '@/lib/evo-program';
import { CollectionData, CREATURES, collectionConfigToData } from '@/lib/evo-data';
import { resolveImage } from '@/lib/evo-visuals';
import { IconCheck, IconAlertTriangle, IconExternalLink, IconArrowRight } from '@/components/Icons';

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
  const [resolvedImage, setResolvedImage] = useState<string | null>(null);

  const remaining = collection ? collection.supplyCap - currentSupply : 0;
  const creature = collection ? CREATURES[currentSupply % CREATURES.length] : null;

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

  useEffect(() => { fetchCollection(); }, [fetchCollection]);

  useEffect(() => {
    const fallback = creature?.stages.baby || '/zenkos/abyssling_baby.png';
    if (!collection?.metadataUri) { setResolvedImage(null); return; }
    let active = true;
    resolveImage(collection.metadataUri, fallback, 0, collection.isRevealed).then(img => {
      if (active) setResolvedImage(img);
    });
    return () => { active = false; };
  }, [collection?.metadataUri, creature?.stages.baby, collection?.isRevealed]);

  const handleForge = async () => {
    if (!wallet.connected || !wallet.publicKey || !collection) { setError('Connect your wallet first'); return; }
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
    } catch (err: any) { setError(err.message || 'Forge failed'); } finally { setForging(false); }
  };

  const totalCost = collection ? collection.mintPriceSol + collection.lockAmountSol : 0;
  const shatterRecover = collection ? collection.lockAmountSol * (1 - collection.shatterFeeBps / 10000) : 0;

  const ticker = collection ? [
    { label: 'Supply', value: `${currentSupply}/${collection.supplyCap}` },
    { label: 'Mint', value: `${collection.mintPriceSol} SOL` },
    { label: 'Lock', value: `${collection.lockAmountSol} SOL`, tone: 'pos' as const },
    { label: 'Remaining', value: String(remaining) },
  ] : [];

  return (
    <div className="min-h-screen bg-bg text-text">
      <Nav ticker={ticker} />

      <div className="border-b border-border">
        <Link href="/" className="mx-auto flex max-w-2xl items-center gap-1.5 px-3 py-2 text-xs text-muted transition-colors hover:text-text">
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round"><path d="m12 19-7-7 7-7" /><path d="M19 12H5" /></svg>
          Gallery
        </Link>
      </div>

      <div className="mx-auto max-w-lg px-3 py-6 lg:px-4">
        <h1 className="text-xl font-bold tracking-tight text-text-strong">Forge a Z</h1>
        <p className="mt-1 text-xs text-muted">Mint a new EVO with SOL locked inside.</p>

        {loading ? (
          <div className="mt-10 flex justify-center">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-border border-t-accent" />
          </div>
        ) : collection ? (
          <>
            {/* Preview */}
            {creature && (
              <div className="mt-5 flex flex-col items-center">
                <div className="relative flex h-40 w-40 items-center justify-center overflow-hidden rounded border border-border bg-surface">
                  <div className="absolute inset-0" style={{ background: `radial-gradient(circle at 50% 45%, rgba(129,140,248,0.12), transparent 65%)` }} />
                  <img src={resolvedImage || creature.stages.baby} alt={creature.displayName} className="relative z-[1] pixelated" style={{ transform: 'scale(2)' }} />
                </div>
                <p className="mt-3 text-sm font-semibold">{creature.displayName}</p>
                <p className="font-mono text-[11px] text-dim">Z #{currentSupply} - {creature.element} - {creature.rarity}</p>
              </div>
            )}

            {/* Cost breakdown */}
            <div className="mt-5 overflow-hidden rounded border border-border">
              <Row label="Mint price (to creator)" value={`${collection.mintPriceSol} SOL`} />
              <div className="border-t border-border" />
              <Row label="Locked value (your floor)" value={`${collection.lockAmountSol} SOL`} tone="pos" />
              <div className="border-t border-border-strong bg-surface-2">
                <Row label="Total to forge" value={`${totalCost.toFixed(3)} SOL`} strong />
              </div>
            </div>

            {/* Fee schedule */}
            <div className="mt-3 grid grid-cols-3 gap-px overflow-hidden rounded border border-border bg-border">
              <Fee label="Shatter fee" value={`${collection.shatterFeeBps / 100}%`} />
              <Fee label="Royalty" value={`${collection.tradeRoyaltyBps / 100}%`} />
              <Fee label="Recoverable" value={`${shatterRecover.toFixed(3)}`} />
            </div>

            {/* Supply bar */}
            <div className="mt-3 rounded border border-border bg-surface p-2.5">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-dim">Supply</span>
                <span className="font-mono text-text-strong">{currentSupply} / {collection.supplyCap}</span>
              </div>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-bg">
                <div className="h-full bg-accent transition-all" style={{ width: `${(currentSupply / collection.supplyCap) * 100}%` }} />
              </div>
            </div>

            {/* Forge */}
            <button onClick={handleForge} disabled={!wallet.connected || forging || remaining === 0}
              className="mt-5 w-full rounded bg-accent py-3 text-sm font-semibold text-white transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-40 dark:text-[#0a0a0b]">
              {forging ? 'Forging...' : remaining === 0 ? 'Collection full' : `Forge Z #${currentSupply}`}
            </button>
            {!wallet.connected && (
              <div className="mt-3 flex justify-center"><WalletMultiButton /></div>
            )}

            {txSig && (
              <div className="mt-4 flex items-center gap-2 rounded border border-positive/30 bg-positive-soft px-3 py-2.5 text-xs">
                <IconCheck className="h-4 w-4 text-positive" />
                <span className="text-positive font-medium">Z forged</span>
                <a href={`https://solscan.io/tx/${txSig}`} target="_blank" rel="noopener noreferrer" className="ml-auto inline-flex items-center gap-1 text-accent hover:underline">
                  Solscan <IconExternalLink className="h-3 w-3" />
                </a>
              </div>
            )}
            {error && (
              <div className="mt-4 flex items-center gap-2 rounded border border-negative/30 bg-negative-soft px-3 py-2.5 text-xs text-negative">
                <IconAlertTriangle className="h-4 w-4 shrink-0" /> {error}
              </div>
            )}
          </>
        ) : (
          <div className="mt-10 text-center text-xs text-dim">Collection not found</div>
        )}
      </div>
    </div>
  );
}

function Row({ label, value, tone, strong }: { label: string; value: string; tone?: 'pos'; strong?: boolean }) {
  return (
    <div className={`flex items-center justify-between px-3 py-2.5 ${strong ? 'bg-surface-2' : ''}`}>
      <span className={`text-xs ${strong ? 'font-medium text-text' : 'text-muted'}`}>{label}</span>
      <span className={`font-mono ${strong ? 'text-sm font-bold text-text-strong' : 'text-sm font-medium'} ${tone === 'pos' ? 'text-positive' : ''}`}>{value}</span>
    </div>
  );
}

function Fee({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-bg px-3 py-2 text-center">
      <p className="text-[10px] uppercase tracking-wide text-dim">{label}</p>
      <p className="mt-0.5 font-mono text-xs font-semibold text-text">{value}</p>
    </div>
  );
}
