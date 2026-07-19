'use client';

import { useState, useCallback, useEffect, Suspense } from 'react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { Nav } from '@/components/Nav';
import { Transaction } from '@solana/web3.js';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  readCollectionConfig,
  getCollectionPDA,
  getEvoPDA,
  createRevealCollectionIx,
  createEvolveIx,
  createSetVisualStageIx,
} from '@/lib/evo-program';
import { CollectionData, collectionConfigToData } from '@/lib/evo-data';
import { IconCheck, IconAlertTriangle, IconExternalLink } from '@/components/Icons';

export default function AdminPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-bg" />}>
      <AdminContent />
    </Suspense>
  );
}

function AdminContent() {
  const searchParams = useSearchParams();
  const COLLECTION_NAME = searchParams.get('collection') || '';
  const { connection } = useConnection();
  const wallet = useWallet();
  const [collection, setCollection] = useState<CollectionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [action, setAction] = useState<string | null>(null);
  const [txResult, setTxResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [revealSecret, setRevealSecret] = useState('');
  const [evolveEvoId, setEvolveEvoId] = useState('');
  const [customStage, setCustomStage] = useState('');
  const [customEvoId, setCustomEvoId] = useState('');

  const fetchCollection = useCallback(async () => {
    if (!COLLECTION_NAME) { setLoading(false); return; }
    setLoading(true);
    try {
      const cfg = await readCollectionConfig(connection, COLLECTION_NAME);
      if (cfg) setCollection(collectionConfigToData(cfg));
    } catch (err) {
      console.error('Failed to fetch collection:', err);
    } finally {
      setLoading(false);
    }
  }, [connection, COLLECTION_NAME]);

  useEffect(() => { fetchCollection(); }, [fetchCollection]);

  const isCreator = wallet.connected && wallet.publicKey && collection?.creator === wallet.publicKey.toBase58();

  const sendTx = async (ix: any) => {
    if (!wallet.connected || !wallet.publicKey) { setError('Connect wallet first'); return null; }
    const tx = new Transaction().add(ix);
    tx.feePayer = wallet.publicKey;
    const { blockhash } = await connection.getLatestBlockhash();
    tx.recentBlockhash = blockhash;
    const signed = await wallet.signTransaction?.(tx);
    if (!signed) throw new Error('Transaction signing failed');
    const sig = await connection.sendRawTransaction(signed.serialize());
    await connection.confirmTransaction(sig, 'confirmed');
    return sig;
  };

  const handleReveal = async () => {
    if (!wallet.connected || !wallet.publicKey || !collection) { setError('Connect wallet first'); return; }
    setAction('reveal'); setError(null); setTxResult(null);
    try {
      const [collectionPda] = getCollectionPDA(COLLECTION_NAME);
      let secret: Uint8Array;
      if (revealSecret) {
        const hex = revealSecret.startsWith('0x') ? revealSecret.slice(2) : revealSecret;
        secret = new Uint8Array(Buffer.from(hex, 'hex'));
        if (secret.length !== 32) throw new Error('Secret must be 32 bytes (64 hex chars)');
      } else {
        secret = new Uint8Array(32);
      }
      const sig = await sendTx(createRevealCollectionIx(collectionPda, wallet.publicKey, secret));
      if (sig) {
        setTxResult(sig);
        await fetchCollection();
      }
    } catch (err: any) { setError(err.message || 'Reveal failed'); } finally { setAction(null); }
  };

  const handleEvolve = async () => {
    if (!wallet.connected || !wallet.publicKey || !collection) { setError('Connect wallet first'); return; }
    setAction('evolve'); setError(null); setTxResult(null);
    try {
      const evoId = parseInt(evolveEvoId, 10);
      if (isNaN(evoId)) throw new Error('Enter a valid Meld ID');
      const [collectionPda] = getCollectionPDA(COLLECTION_NAME);
      const [evoPda] = getEvoPDA(collectionPda, evoId);
      const sig = await sendTx(createEvolveIx(evoPda, collectionPda, evoId));
      if (sig) {
        setTxResult(sig);
        setEvolveEvoId('');
      }
    } catch (err: any) { setError(err.message || 'Evolve failed'); } finally { setAction(null); }
  };

  const handleSetStage = async () => {
    if (!wallet.connected || !wallet.publicKey || !collection) { setError('Connect wallet first'); return; }
    setAction('set-stage'); setError(null); setTxResult(null);
    try {
      const evoId = parseInt(customEvoId, 10);
      const stage = parseInt(customStage, 10);
      if (isNaN(evoId)) throw new Error('Enter a valid Meld ID');
      if (isNaN(stage)) throw new Error('Enter a valid stage number');
      const [collectionPda] = getCollectionPDA(COLLECTION_NAME);
      const [evoPda] = getEvoPDA(collectionPda, evoId);
      const sig = await sendTx(createSetVisualStageIx(evoPda, collectionPda, wallet.publicKey, evoId, stage));
      if (sig) {
        setTxResult(sig);
        setCustomEvoId('');
        setCustomStage('');
      }
    } catch (err: any) { setError(err.message || 'Set stage failed'); } finally { setAction(null); }
  };

  const lifecycleLabel = (lt: string) => {
    switch (lt) {
      case 'static': return 'Static';
      case 'reveal': return 'Reveal';
      case 'commit_reveal': return 'Commit-Reveal';
      case 'reveal_and_evolve': return 'Reveal + Evolve';
      case 'custom': return 'Custom';
      default: return lt;
    }
  };

  const ticker = collection ? [
    { label: 'Collection', value: collection.name },
    { label: 'Supply', value: `${collection.currentSupply}/${collection.supplyCap}` },
    { label: 'Lifecycle', value: lifecycleLabel(collection.lifecycleType) },
    { label: 'Revealed', value: collection.isRevealed ? 'Yes' : 'No' },
  ] : [];

  return (
    <div className="min-h-screen bg-bg text-text">
      <Nav ticker={ticker} />

      <div className="border-b border-border">
        <Link href="/my" className="mx-auto flex max-w-2xl items-center gap-1.5 px-3 py-2 text-xs text-muted transition-colors hover:text-text">
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round"><path d="m12 19-7-7 7-7" /><path d="M19 12H5" /></svg>
          My Collections
        </Link>
      </div>

      <div className="mx-auto max-w-2xl px-3 py-6 lg:px-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-text-strong">Manage Collection</h1>
            <p className="mt-1 text-xs text-muted">On-chain settings & lifecycle for <span className="text-text">{COLLECTION_NAME}</span>.</p>
          </div>
          <Link href={`/c/${encodeURIComponent(COLLECTION_NAME)}`}
            className="inline-flex shrink-0 items-center gap-1.5 rounded border border-border-strong bg-surface px-3 py-1.5 text-xs font-semibold text-text transition-colors hover:border-accent hover:text-text-strong">
            View <IconExternalLink className="h-3 w-3" />
          </Link>
        </div>

        {!COLLECTION_NAME ? (
          <div className="mt-10 text-center">
            <p className="text-xs text-muted">No collection selected. Open one from <Link href="/my" className="text-accent hover:underline">My Collections</Link>.</p>
            <Link href="/my" className="mt-4 inline-flex items-center gap-2 text-xs text-accent hover:underline">
              My Collections
            </Link>
          </div>
        ) : loading ? (
          <div className="mt-10 flex justify-center">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-border border-t-accent" />
          </div>
        ) : !wallet.connected ? (
          <div className="mt-10 text-center">
            <p className="text-xs text-muted">Connect wallet to manage collection.</p>
            <div className="mt-4 flex justify-center"><WalletMultiButton /></div>
          </div>
        ) : !isCreator ? (
          <div className="mt-10 text-center">
            <p className="text-xs text-negative">Only the collection creator can manage lifecycle.</p>
            <p className="mt-1 text-[11px] text-dim">Connected: {wallet.publicKey?.toBase58().slice(0, 8)}...</p>
            <p className="text-[11px] text-dim">Creator: {collection?.creator.slice(0, 8)}...</p>
          </div>
        ) : (
          <>
            {/* Collection overview */}
            <div className="mt-5 rounded-lg border border-border bg-surface p-4">
              <p className="text-[10px] uppercase tracking-wide text-dim">Collection Overview</p>
              <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2.5 sm:grid-cols-3">
                <Overview label="Supply" value={`${collection.currentSupply}/${collection.supplyCap}`} />
                <Overview label="Mint Price" value={`${collection.mintPriceSol} SOL`} />
                <Overview label="Locked / Meld" value={`${collection.lockAmountSol} SOL`} />
                <Overview label="Shatter Fee" value={`${collection.shatterFeeBps / 100}% → ${collection.shatterFeeDestination}`} />
                <Overview label="Trade Royalty" value={`${collection.tradeRoyaltyBps / 100}% → ${collection.royaltyDestination}`} />
                <Overview label="Creator" value={`${collection.creator.slice(0, 6)}…${collection.creator.slice(-4)}`} />
              </div>
              {collection.metadataUri && (
                <div className="mt-3 border-t border-border pt-2.5 text-[11px] text-dim break-all">
                  <span className="font-semibold text-muted">Metadata URI:</span>{' '}
                  <a href={collection.metadataUri} target="_blank" rel="noreferrer" className="text-accent hover:underline"
                     onClick={e => { try { if (!['http:','https:'].includes(new URL(collection.metadataUri).protocol)) { e.preventDefault(); } } catch { e.preventDefault(); } }}>
                    {collection.metadataUri}
                  </a>
                </div>
              )}
              {collection.artworkManifestHash && collection.artworkManifestHash.some(b => b !== 0) && (
                <div className="mt-1.5 text-[11px] text-dim break-all">
                  <span className="font-semibold text-muted">Artwork Manifest:</span>{' '}
                  <span className="font-mono">{Buffer.from(collection.artworkManifestHash).toString('hex').slice(0, 16)}…</span>
                </div>
              )}
            </div>

            <div className="mt-5 rounded border border-border bg-surface p-4">
              <p className="text-[10px] uppercase tracking-wide text-dim">On-Chain Lifecycle</p>
              <div className="mt-2 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="rounded bg-accent-soft px-2 py-0.5 text-xs font-semibold text-accent">
                    {lifecycleLabel(collection.lifecycleType)}
                  </span>
                  <span className={`rounded px-2 py-0.5 text-xs font-semibold ${
                    collection.isRevealed ? 'bg-positive-soft text-positive' : 'bg-surface-2 text-muted'
                  }`}>
                    {collection.isRevealed ? 'Revealed' : 'Hidden'}
                  </span>
                  <span className="text-xs text-muted">Max stages: {collection.maxStates}</span>
                </div>
                <div className="text-[11px] text-dim">
                  Protocol state is the source of truth. Marketplace reads
                  <code className="mx-1 rounded bg-bg px-1 text-accent">current_state</code>
                  and
                  <code className="mx-1 rounded bg-bg px-1 text-accent">is_revealed</code>
                  directly from on-chain accounts.
                </div>
                {collection.metadataUri && (
                  <div className="text-[11px] text-dim break-all">URI: {collection.metadataUri}</div>
                )}
              </div>
            </div>

            {(collection.lifecycleType === 'reveal' || collection.lifecycleType === 'commit_reveal' || collection.lifecycleType === 'reveal_and_evolve') && !collection.isRevealed && (
              <div className="mt-5">
                <p className="text-[10px] uppercase tracking-wide text-dim">Reveal Collection</p>
                <p className="mt-1 text-[11px] text-dim">
                  Calls the on-chain <code className="text-accent">reveal_collection</code> instruction.
                  {collection.lifecycleType === 'commit_reveal' && ' Provide the secret that matches the committed hash.'}
                </p>
                {collection.lifecycleType === 'commit_reveal' && (
                  <input type="text" placeholder="Reveal secret (64 hex chars)" value={revealSecret}
                    onChange={(e) => setRevealSecret(e.target.value)}
                    className="t-input mt-2 w-full px-3 py-2 font-mono text-xs" />
                )}
                <button onClick={handleReveal} disabled={action !== null}
                  className="mt-2 w-full rounded bg-accent py-2.5 text-sm font-semibold text-white transition-colors hover:bg-accent-hover disabled:opacity-40">
                  {action === 'reveal' ? 'Revealing...' : 'Reveal Collection'}
                </button>
              </div>
            )}

            {(collection.lifecycleType === 'reveal_and_evolve' || collection.lifecycleType === 'custom') && (
              <div className="mt-5">
                <p className="text-[10px] uppercase tracking-wide text-dim">Evolve Meld (Permissionless)</p>
                <p className="mt-1 text-[11px] text-dim">
                  Calls <code className="text-accent">evolve</code> — anyone can call it, but the Meld only
                  advances if all threshold conditions are met.
                  {collection.lifecycleType === 'reveal_and_evolve' && ' Collection must be revealed first.'}
                </p>
                <input type="number" placeholder="Meld ID (e.g. 0)" value={evolveEvoId}
                  onChange={(e) => setEvolveEvoId(e.target.value)}
                  className="t-input mt-2 w-full px-3 py-2 text-xs" />
                <button onClick={handleEvolve} disabled={action !== null}
                  className="mt-2 w-full rounded border border-border-strong bg-surface py-2.5 text-sm font-semibold text-text transition-colors hover:border-accent disabled:opacity-40">
                  {action === 'evolve' ? 'Evolving...' : 'Evolve Meld'}
                </button>
              </div>
            )}

            {collection.lifecycleType === 'custom' && (
              <div className="mt-5">
                <p className="text-[10px] uppercase tracking-wide text-dim">Set Visual Stage (Authority Only)</p>
                <p className="mt-1 text-[11px] text-dim">
                  Calls <code className="text-accent">set_visual_stage</code> — override a Meld&apos;s stage
                  without threshold checks. Only works on Custom lifecycle collections.
                </p>
                <div className="mt-2 flex gap-2">
                  <input type="number" placeholder="Meld ID" value={customEvoId}
                    onChange={(e) => setCustomEvoId(e.target.value)}
                    className="t-input flex-1 px-3 py-2 text-xs" />
                  <input type="number" placeholder="Stage" value={customStage}
                    onChange={(e) => setCustomStage(e.target.value)}
                    className="t-input w-24 px-3 py-2 text-xs" />
                </div>
                <button onClick={handleSetStage} disabled={action !== null}
                  className="mt-2 w-full rounded border border-border-strong bg-surface py-2.5 text-sm font-semibold text-text transition-colors hover:border-accent disabled:opacity-40">
                  {action === 'set-stage' ? 'Setting...' : 'Set Stage'}
                </button>
              </div>
            )}

            {collection.lifecycleType === 'static' && (
              <div className="mt-5 rounded border border-border bg-surface p-3 text-center text-xs text-dim">
                Static lifecycle — no stage transitions allowed.
              </div>
            )}

            {txResult && (
              <div className="mt-4 flex items-center gap-2 rounded border border-positive/30 bg-positive-soft px-3 py-2.5 text-xs">
                <IconCheck className="h-4 w-4 text-positive" />
                <span className="text-positive font-medium">Transaction confirmed</span>
                <a href={`https://solscan.io/tx/${txResult}`} target="_blank" rel="noopener noreferrer" className="ml-auto inline-flex items-center gap-1 text-accent hover:underline">
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
        )}
      </div>
    </div>
  );
}

function Overview({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wide text-dim">{label}</p>
      <p className="mt-0.5 font-mono text-xs font-medium text-text">{value}</p>
    </div>
  );
}
