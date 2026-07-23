'use client';

import { useState, useCallback, useEffect } from 'react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { Nav } from '@/components/Nav';
import { Footer } from '@/components/Footer';
import { sendAndConfirmTx } from '@/lib/tx';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { humanizeError } from '@/lib/errors';
import { fmtSolValue } from '@/lib/format';
import {
  readCollectionConfig,
  getCollectionPDA,
  createForgeIx,
  generateResonanceSeed,
} from '@/lib/evo-program';
import { CollectionData, collectionConfigToData, invalidateCollectionsCache } from '@/lib/evo-data';
import { resolveImage } from '@/lib/evo-visuals';
import { IconCheck, IconAlertTriangle, IconExternalLink, IconArrowRight } from '@/components/Icons';

export default function CollectionForgePage() {
  const params = useParams<{ name: string }>();
  const collectionName = decodeURIComponent(params.name);
  const { connection } = useConnection();
  const wallet = useWallet();
  const [collection, setCollection] = useState<CollectionData | null>(null);
  const [currentSupply, setCurrentSupply] = useState(0);
  // The id of the next EVO to forge. MUST be total_minted (monotonic), NOT
  // current_supply — after a shatter, current_supply < total_minted, and a
  // current_supply-derived id collides with an existing EVO PDA, breaking mint.
  const [nextId, setNextId] = useState(0);
  const [loading, setLoading] = useState(true);
  const [forging, setForging] = useState(false);
  const [txSig, setTxSig] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [resolvedImage, setResolvedImage] = useState<string | null>(null);
  const [mintedId, setMintedId] = useState<number | null>(null);
  const [mintedImage, setMintedImage] = useState<string | null>(null);

  const remaining = collection ? collection.supplyCap - currentSupply : 0;

  const fetchCollection = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const cfg = await readCollectionConfig(connection, collectionName);
      if (cfg) {
        setCollection(collectionConfigToData(cfg));
        setCurrentSupply(cfg.currentSupply);
        setNextId(cfg.totalMinted);
      }
    } catch (err) {
      console.error('Failed to fetch collection:', err);
    } finally {
      if (!silent) setLoading(false);
    }
  }, [connection, collectionName]);

  useEffect(() => { fetchCollection(); }, [fetchCollection]);

  useEffect(() => {
    if (!collection?.metadataUri) { setResolvedImage(null); return; }
    let active = true;
    const evoId = nextId;
    resolveImage(collection.metadataUri, '/placeholder.png', 0, collection.isRevealed, evoId).then(img => {
      if (active) setResolvedImage(img);
    });
    return () => { active = false; };
  }, [collection?.metadataUri, collection?.isRevealed, nextId]);

  const handleForge = async () => {
    if (!wallet.connected || !wallet.publicKey || !collection) { setError('Connect your wallet first'); return; }
    setForging(true); setError(null); setTxSig(null);
    try {
      const cfg = await readCollectionConfig(connection, collectionName);
      if (!cfg) throw new Error('Collection not found');
      if (cfg.currentSupply >= cfg.supplyCap) throw new Error('Collection is full');
      const [collectionPda] = getCollectionPDA(collectionName);
      // Forge at total_minted (monotonic slot) so the id is gap-free and never
      // collides with a still-live EVO PDA after shatters. See nextId above.
      const evoId = cfg.totalMinted;
      const resonanceSeed = generateResonanceSeed();
      const ix = createForgeIx(wallet.publicKey, collectionPda, cfg.creator, evoId, resonanceSeed);
      const sig = await sendAndConfirmTx(connection, wallet.signTransaction as any, wallet.publicKey, ix);
      setTxSig(sig);
      setMintedId(evoId);
      // Capture image for the minted EVO before refetch advances nextId
      const img = await resolveImage(collection.metadataUri, '/placeholder.png', 0, collection.isRevealed, evoId);
      setMintedImage(img);
      // A mint happened — the home page's cached stats are stale now.
      invalidateCollectionsCache();
      await fetchCollection(true); // silent: don't replace success card with spinner
    } catch (err: any) { setError(humanizeError(err.message || 'Forge failed')); } finally { setForging(false); }
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
        <Link href={`/c/${collectionName}`} className="mx-auto flex max-w-2xl items-center gap-1.5 px-3 py-2 text-xs text-muted transition-colors hover:text-text">
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round"><path d="m12 19-7-7 7-7" /><path d="M19 12H5" /></svg>
          {collectionName} Gallery
        </Link>
      </div>

      <div className="mx-auto max-w-lg px-3 py-6 lg:px-4">
        <h1 className="text-xl font-bold tracking-tight text-text-strong">Forge a {collectionName}</h1>
        <p className="mt-1 text-xs text-muted">Mint a new EVO with SOL locked inside.</p>

        {loading ? (
          <div className="mt-10 flex justify-center">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-border border-t-accent" />
          </div>
        ) : collection ? (
          <>
            {txSig && mintedId !== null ? (
              /* ── FORGE SUCCESS CARD ── */
              <div className="mt-5">
                <div className="flex flex-col items-center rounded border border-positive/40 bg-positive-soft px-5 py-6 text-center">
                  <div className="mb-3 flex items-center gap-2">
                    <IconCheck className="h-6 w-6 text-positive" />
                    <h2 className="text-lg font-bold text-positive">FORGED</h2>
                  </div>

                  {/* Large minted EVO image */}
                  <div className="relative flex h-40 w-40 items-center justify-center overflow-hidden rounded border border-positive/20 bg-bg">
                    <div className="absolute inset-0" style={{ background: `radial-gradient(circle at 50% 45%, rgba(52,211,153,0.12), transparent 65%)` }} />
                    {mintedImage ? (
                      <img src={mintedImage} alt={`${collectionName} #${mintedId}`} className="relative z-[1] pixelated" style={{ transform: 'scale(2)' }} />
                    ) : (
                      <span className="relative z-[1] font-mono text-2xl font-bold text-positive">#{mintedId}</span>
                    )}
                  </div>

                  <p className="mt-3 text-sm font-semibold text-text-strong">
                    {collectionName} #{mintedId} is yours
                  </p>
                  <p className="mt-1 font-mono text-[11px] text-dim">
                    Locked inside: {fmtSolValue(collection.lockAmountSol)} SOL (your floor, recover anytime via shatter)
                  </p>

                  {/* Three action buttons */}
                  <div className="mt-5 flex w-full flex-col gap-2">
                    <Link href={`/c/${encodeURIComponent(collectionName)}/${mintedId}`}
                      className="w-full rounded bg-accent py-2.5 text-sm font-bold text-white transition-colors duration-100 hover:bg-accent-hover active:scale-[0.98] dark:text-[#0a0a0b]">
                      View my EVO
                    </Link>
                    <Link href="/portfolio"
                      className="w-full rounded border border-border-strong bg-surface py-2.5 text-sm font-medium text-text transition-colors duration-100 hover:bg-surface-2 active:scale-[0.98]">
                      View in portfolio
                    </Link>
                    <a href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(`Just forged ${collectionName} #${mintedId} on @meldterminal. SOL locked inside, floor guaranteed`)}&url=${encodeURIComponent(`https://meldterminal.io/c/${encodeURIComponent(collectionName)}/${mintedId}`)}`}
                      target="_blank" rel="noopener noreferrer"
                      className="w-full rounded border border-border-strong bg-surface py-2.5 text-sm font-medium text-text transition-colors duration-100 hover:bg-surface-2 active:scale-[0.98]">
                      Share on X
                    </a>
                    <button onClick={() => { setTxSig(null); setMintedId(null); setMintedImage(null); setError(null); fetchCollection(); }}
                      className="w-full rounded border border-border-strong bg-surface py-2.5 text-sm font-medium text-text transition-colors duration-100 hover:bg-surface-2 active:scale-[0.98]">
                      Forge another
                    </button>
                  </div>
                </div>

                {/* Solscan link row */}
                <div className="mt-3 flex items-center gap-2 rounded border border-border bg-surface px-3 py-2 text-xs">
                  <span className="text-dim">Transaction</span>
                  <a href={`https://solscan.io/tx/${txSig}`} target="_blank" rel="noopener noreferrer" className="ml-auto inline-flex items-center gap-1 text-accent hover:underline">
                    Solscan <IconExternalLink className="h-3 w-3" />
                  </a>
                </div>
              </div>
            ) : (
              <>
                {/* Preview — generic, uses manifest-resolved image */}
                <div className="mt-5 flex flex-col items-center">
                  <div className="relative flex h-40 w-40 items-center justify-center overflow-hidden rounded border border-border bg-surface">
                    <div className="absolute inset-0" style={{ background: `radial-gradient(circle at 50% 45%, rgba(129,140,248,0.12), transparent 65%)` }} />
                    {resolvedImage ? (
                      <img src={resolvedImage} alt={`${collectionName} #${nextId}`} className="relative z-[1] pixelated" style={{ transform: 'scale(2)' }} />
                    ) : (
                      <span className="relative z-[1] font-mono text-2xl font-bold text-accent">#{nextId}</span>
                    )}
                  </div>
                  <p className="mt-3 text-sm font-semibold">{collectionName} #{nextId}</p>
                  <p className="font-mono text-[11px] text-dim">Next to forge</p>
                </div>

                {/* Cost breakdown */}
                <div className="mt-5 overflow-hidden rounded border border-border">
                  <Row label="Mint price (to creator)" value={`${collection.mintPriceSol} SOL`} />
                  <div className="border-t border-border" />
                  <Row label="Locked value (your floor)" value={`${collection.lockAmountSol} SOL`} tone="pos" />
                  <div className="border-t border-border-strong bg-surface-2">
                    <Row label="Total to forge" value={`${fmtSolValue(totalCost)} SOL`} strong />
                  </div>
                </div>

                {/* Fee schedule */}
                <div className="mt-3 grid grid-cols-3 gap-px overflow-hidden rounded border border-border bg-border">
                  <Fee label="Shatter fee" value={`${collection.shatterFeeBps / 100}%`} />
                  <Fee label="Royalty" value={`${collection.tradeRoyaltyBps / 100}%`} />
                  <Fee label="Recoverable" value={fmtSolValue(shatterRecover)} />
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
                  className="mt-5 w-full rounded bg-accent py-3 text-sm font-semibold text-white transition-colors duration-100 hover:bg-accent-hover active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 disabled:active:scale-100 dark:text-[#0a0a0b]">
                  {forging ? 'Forging...' : remaining === 0 ? 'Collection full' : `Forge ${collectionName} #${nextId}`}
                </button>
                {forging && (
                  <p className="mt-2 text-center text-xs text-dim">Confirming on Solana… ~5s</p>
                )}
                {!wallet.connected && (
                  <div className="mt-3 flex justify-center"><WalletMultiButton /></div>
                )}

                {error && (
                  <div className="mt-4 flex items-center gap-2 rounded border border-negative/30 bg-negative-soft px-3 py-2.5 text-xs text-negative">
                    <IconAlertTriangle className="h-4 w-4 shrink-0" /> {error}
                  </div>
                )}
              </>
            )}
          </>
        ) : (
          <div className="mt-10 text-center">
            <p className="text-xs text-dim">Collection &quot;{collectionName}&quot; not found.</p>
            <Link href="/" className="mt-4 inline-flex items-center gap-2 text-xs text-accent hover:underline">
              All collections <IconArrowRight className="h-3 w-3" />
            </Link>
          </div>
        )}
      </div>
      <Footer />
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