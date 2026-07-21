'use client';

import { EVOData, getAgeString } from '@/lib/evo-data';
import { useState, useEffect, Component } from 'react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { Nav } from './Nav';
import { Transaction, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import {
  createFeedIx,
  createListIx,
  createDelistIx,
  createBuyIx,
  createShatterIx,
  createTransferIx,
  readCollectionConfig,
  readProtocolConfig,
  getCollectionPDA,
} from '@/lib/evo-program';
import { resolveImage, fetchVisualManifest, resolveActiveImage, EvoVisualManifest, getManifestVerification, ManifestVerification } from '@/lib/evo-visuals';
import { IconCheck, IconAlertTriangle, IconExternalLink } from './Icons';

interface EvoDetailProps {
  evo: EVOData;
  onBack: () => void;
  onRefresh?: () => void;
}

export function EvoDetail({ evo, onBack, onRefresh }: EvoDetailProps) {
  const { connection } = useConnection();
  const wallet = useWallet();
  const collectionName = evo.collectionName || 'EVO';
  const [imgError, setImgError] = useState(false);
  const [resolvedImage, setResolvedImage] = useState<string | null>(null);
  const [action, setAction] = useState<string | null>(null);
  const [txResult, setTxResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [listPrice, setListPrice] = useState('');
  const [feedAmount, setFeedAmount] = useState('');
  const [transferAddress, setTransferAddress] = useState('');
  const [tab, setTab] = useState<'overview' | 'state' | 'activity' | 'holders'>('overview');
  const [creator, setCreator] = useState<string | null>(null);
  const [metadataUri, setMetadataUri] = useState<string | null>(null);
  const [isRevealed, setIsRevealed] = useState<boolean | undefined>(undefined);
  const [manifest, setManifest] = useState<EvoVisualManifest | null>(null);
  const [stageImages, setStageImages] = useState<{ name: string; image: string }[]>([]);
  const [manifestVerification, setManifestVerification] = useState<ManifestVerification | null>(null);
  const [traits, setTraits] = useState<Record<string, string> | null>(null);
  const [shatterFeeBps, setShatterFeeBps] = useState<number>(500);
  const [evolveThresholds, setEvolveThresholds] = useState<{
    trade: number; feed: number; hold: number; locked: number; maxStates: number; lifecycleType: string;
  } | null>(null);

  useEffect(() => {
    let active = true;
    readCollectionConfig(connection, collectionName).then(cfg => {
      if (!active) return;
      if (cfg) {
        setCreator(cfg.creator.toBase58());
        setMetadataUri(cfg.metadataUri);
        setIsRevealed(cfg.isRevealed);
        setShatterFeeBps(cfg.shatterFeeBps);
        setEvolveThresholds({
          trade: cfg.evolveTradeThreshold,
          feed: Number(cfg.evolveFeedThreshold),
          hold: Number(cfg.evolveHoldSeconds),
          locked: Number(cfg.evolveLockedThreshold),
          maxStates: cfg.maxStates,
          lifecycleType: cfg.lifecycleType,
        });
      }
    }).catch((e) => { console.error('EvoDetail: readCollectionConfig failed:', e); });
    return () => { active = false; };
  }, [connection, collectionName]);

  useEffect(() => {
    if (!metadataUri) { setManifest(null); setStageImages([]); setManifestVerification(null); return; }
    let active = true;
    (async () => {
      try {
        const cfg = await readCollectionConfig(connection, collectionName);
        const expectedHash = cfg?.artworkManifestHash;
        const m = await fetchVisualManifest(metadataUri, expectedHash);
        if (!active) return;
        setManifest(m);
        setManifestVerification(getManifestVerification(metadataUri));
        // Extract per-EVO traits from bulk manifest items
        const rawItems = (m as any)?.items;
        if (Array.isArray(rawItems)) {
          const item = rawItems.find((it: any) => it.index === evo.id);
          setTraits(item?.traits ?? null);
        } else {
          setTraits(null);
        }
        if (m && Array.isArray(m.stages) && m.stages.length > 0) {
          const imgs = m.stages.map(s => ({
            name: s.name,
            image: resolveActiveImage(m, evo.id, s.id, isRevealed),
          }));
          if (active) setStageImages(imgs);
        } else {
          if (active) setStageImages([]);
        }
      } catch (e) {
        console.error('EvoDetail: manifest fetch failed:', e);
        if (active) { setManifest(null); setStageImages([]); }
      }
    })();
    return () => { active = false; };
  }, [metadataUri, isRevealed, evo.id, connection, collectionName]);

  useEffect(() => {
    if (!metadataUri) { setResolvedImage(null); return; }
    let active = true;
    resolveImage(metadataUri, '/placeholder.png', evo.currentState, isRevealed, evo.id).then(img => {
      if (active) setResolvedImage(img);
    }).catch((e) => {
      console.error('EvoDetail: resolveImage failed:', e);
      if (active) setResolvedImage('/placeholder.png');
    });
    return () => { active = false; };
  }, [metadataUri, evo.currentState, isRevealed, evo.id]);

  const displayImage = resolvedImage || '/placeholder.png';
  const scale = 0.6 + Math.min(1, evo.lockedLamports / 50) * 0.4;
  const currentStageName = manifest?.stages?.find(s => s.id === evo.currentState)?.name
    ?? `Stage ${evo.currentState}`;
  const isOwner = wallet.connected && wallet.publicKey && evo.owner === wallet.publicKey.toBase58();

  // --- Tx handlers ---
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

  const handleFeed = async () => {
    setAction('feed'); setError(null); setTxResult(null);
    try {
      const lamports = Math.floor(parseFloat(feedAmount) * LAMPORTS_PER_SOL);
      if (!lamports || lamports <= 0) throw new Error('Enter a valid SOL amount');
      const collectionPda = new PublicKey(evo.collectionPda!);
      const sig = await sendTx(createFeedIx(new PublicKey(evo.evoPda!), collectionPda, wallet.publicKey!, evo.id, lamports));
      if (sig) { setTxResult(sig); setFeedAmount(''); onRefresh?.(); }
    } catch (err: any) { setError(err.message || 'Feed failed'); } finally { setAction(null); }
  };

  const handleList = async () => {
    setAction('list'); setError(null); setTxResult(null);
    try {
      const lamports = Math.floor(parseFloat(listPrice) * LAMPORTS_PER_SOL);
      if (!lamports || lamports <= 0) throw new Error('Enter a valid price');
      const collectionPda = new PublicKey(evo.collectionPda!);
      const sig = await sendTx(createListIx(new PublicKey(evo.evoPda!), collectionPda, wallet.publicKey!, evo.id, lamports));
      if (sig) { setTxResult(sig); setListPrice(''); onRefresh?.(); }
    } catch (err: any) { setError(err.message || 'List failed'); } finally { setAction(null); }
  };

  const handleDelist = async () => {
    setAction('delist'); setError(null); setTxResult(null);
    try {
      const collectionPda = new PublicKey(evo.collectionPda!);
      const sig = await sendTx(createDelistIx(new PublicKey(evo.evoPda!), collectionPda, wallet.publicKey!, evo.id));
      if (sig) { setTxResult(sig); onRefresh?.(); }
    } catch (err: any) { setError(err.message || 'Delist failed'); } finally { setAction(null); }
  };

  const handleBuy = async () => {
    setAction('buy'); setError(null); setTxResult(null);
    try {
      const collectionPda = new PublicKey(evo.collectionPda!);
      const cfg = await readCollectionConfig(connection, collectionName);
      if (!cfg) throw new Error('Collection not found');
      const proto = await readProtocolConfig(connection);
      if (!proto) throw new Error('Protocol not found');
      const sig = await sendTx(createBuyIx(
        new PublicKey(evo.evoPda!), collectionPda,
        new PublicKey(evo.owner), cfg.creator, wallet.publicKey!, proto.treasury,
        cfg.royaltyDestination, cfg.burnDestination, evo.id,
        // Slippage cap: buyer authorizes the exact listed price in lamports.
        // The on-chain `buy` reverts if the seller front-runs with delist+relist
        // at a higher price in the same slot.
        BigInt(evo.listPriceLamports ?? 0),
      ));
      if (sig) { setTxResult(sig); onRefresh?.(); }
    } catch (err: any) { setError(err.message || 'Buy failed'); } finally { setAction(null); }
  };

  const handleShatter = async () => {
    const cfg = await readCollectionConfig(connection, collectionName);
    if (!cfg) throw new Error('Collection not found');
    const feeBps = cfg.shatterFeeBps;
    const refundLamports = Math.floor(evo.lockedLamports * (10000 - feeBps) / 10000);
    if (!confirm(`Shatter this EVO and recover ${refundLamports.toFixed(4)} SOL (after ${(feeBps / 100).toFixed(1)}% fee)? This cannot be undone.`)) return;
    setAction('shatter'); setError(null); setTxResult(null);
    try {
      const collectionPda = new PublicKey(evo.collectionPda!);
      const proto = await readProtocolConfig(connection);
      if (!proto) throw new Error('Protocol not found');
      const sig = await sendTx(createShatterIx(
        new PublicKey(evo.evoPda!), collectionPda, wallet.publicKey!, cfg.creator, proto.treasury, evo.id,
        cfg.shatterFeeDestination, cfg.burnDestination,
      ));
      if (sig) { setTxResult(sig); onRefresh?.(); }
    } catch (err: any) { setError(err.message || 'Shatter failed'); } finally { setAction(null); }
  };

  const handleTransfer = async () => {
    setAction('transfer'); setError(null); setTxResult(null);
    try {
      const collectionPda = new PublicKey(evo.collectionPda!);
      const proto = await readProtocolConfig(connection);
      if (!proto) throw new Error('Protocol not found');
      const sig = await sendTx(createTransferIx(
        new PublicKey(evo.evoPda!), collectionPda, wallet.publicKey!, proto.treasury, evo.id, new PublicKey(transferAddress),
      ));
      if (sig) { setTxResult(sig); setTransferAddress(''); onRefresh?.(); }
    } catch (err: any) { setError(err.message || 'Transfer failed'); } finally { setAction(null); }
  };

  // --- Derived data (defensive: this block runs in EvoDetail's own render, so
  // a throw here would white-screen the whole page — a child <Guard> cannot
  // catch it. Compute with safe defaults inside try/catch so render never dies. ---
  const fractureLines = Array.isArray(evo.fractureLines) ? evo.fractureLines : [];
  let premium = 0;
  let holderHistory: { address: string; current: boolean; trade: number | null }[] = [];
  let uniqueHolders = 0;
  let sparkPoints: number[] = [0, 100];
  try {
    premium = evo.isListed && evo.listPrice ? ((evo.listPrice - evo.lockedLamports) / evo.lockedLamports * 100) : 0;
    holderHistory = [
      { address: evo.owner, current: true, trade: null as number | null },
      ...fractureLines.slice().reverse().map(fl => ({ address: fl.previousOwner, current: false, trade: fl.tradeNumber })),
    ];
    uniqueHolders = new Set(holderHistory.map(h => h.address)).size;
    sparkPoints = fractureLines.length > 0 ? fractureLines.map(fl => fl.intensity) : [0, 100];
  } catch (e) {
    console.error('EvoDetail: derived-data computation failed (rendering with safe defaults):', e);
  }

  const ticker = [
    { label: collectionName, value: `#${evo.id}` },
    { label: 'Locked', value: `${evo.lockedLamports} SOL`, tone: 'pos' as const },
    { label: 'Trades', value: String(evo.tradeCount) },
    { label: 'Facets', value: `${evo.facetCount}/100` },
  ];

  return (
    <div className="min-h-screen bg-bg text-text">
      <Nav ticker={ticker} />

      <div className="border-b border-border">
        <button onClick={onBack} className="mx-auto flex max-w-7xl items-center gap-1.5 px-3 py-2 text-xs text-muted transition-colors hover:text-text lg:px-4">
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
            <path d="m12 19-7-7 7-7" /><path d="M19 12H5" />
          </svg>
          Gallery
        </button>
      </div>

      <div className="mx-auto max-w-7xl px-3 py-4 lg:px-4">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
          {/* Left: Art + tabs */}
          <Guard name="detail-left">
          <div>
            <div className="relative flex aspect-square items-center justify-center overflow-hidden rounded border border-border bg-surface lg:aspect-[4/3]">
              <div className="absolute inset-0" style={{ background: `radial-gradient(circle at 50% 45%, #818cf818, transparent 70%)` }} />

              {evo.fractureLines.length > 0 && (
                <svg className="absolute inset-0 h-full w-full" viewBox="0 0 400 400">
                  {evo.fractureLines.map((fl, i) => {
                    const angle = (fl.position * Math.PI) / 180;
                    const len = 60 + (fl.intensity / 100) * 80;
                    return (
                      <g key={i}>
                        <line x1={200} y1={200} x2={200 + Math.cos(angle) * len} y2={200 + Math.sin(angle) * len}
                          stroke="rgba(255,255,255,0.28)" strokeWidth={fl.intensity > 50 ? 2 : 1} strokeLinecap="round" />
                        <text x={200 + Math.cos(angle) * len + 5} y={200 + Math.sin(angle) * len} fill="rgba(255,255,255,0.22)" fontSize="9" fontFamily="monospace">#{fl.tradeNumber}</text>
                      </g>
                    );
                  })}
                </svg>
              )}

              {!imgError ? (
                <img src={displayImage} alt={evo.name} className="relative z-[1]"
                  style={{ transform: `scale(${scale * 1.5})`, imageRendering: 'pixelated' }}
                  onError={() => setImgError(true)} />
              ) : (
                <div className="text-dim text-sm">Image not found</div>
              )}

              {evo.isListed && (
                <span className="absolute right-2 top-2 rounded bg-positive px-2 py-1 text-xs font-bold text-[#0a0a0b]">
                  LISTED - {evo.listPrice} SOL
                </span>
              )}
            </div>

            {/* Evolution stages — from manifest, dynamic count */}
            {stageImages.length > 0 && (
              <div className="mt-3 flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'thin' }}>
                {stageImages.map((s, i) => (
                  <div key={i} className={`relative flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded border ${
                    i === evo.currentState ? 'border-accent bg-accent-soft' : i < evo.currentState ? 'border-border opacity-40' : 'border-border opacity-20'}`}>
                    <img src={s.image} alt={s.name} className="h-10 w-10 pixelated" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                    <span className="absolute bottom-0 left-0 right-0 bg-bg/70 py-0.5 text-center text-[10px] text-muted">{s.name}</span>
                    {i < evo.currentState && (
                      <span className="absolute right-0.5 top-0.5 text-positive">
                        <IconCheck className="h-3 w-3" />
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Tabs */}
            <div className="mt-4 flex border-b border-border">
              <TabBtn active={tab === 'overview'} onClick={() => setTab('overview')}>Overview</TabBtn>
              <TabBtn active={tab === 'state'} onClick={() => setTab('state')}>State</TabBtn>
              <TabBtn active={tab === 'activity'} onClick={() => setTab('activity')}>
                Activity {evo.fractureLines.length > 0 && `(${evo.fractureLines.length})`}
              </TabBtn>
              <TabBtn active={tab === 'holders'} onClick={() => setTab('holders')}>
                Holders {uniqueHolders > 0 && `(${uniqueHolders})`}
              </TabBtn>
            </div>

            <div className="mt-3">
              {tab === 'overview' && (
                <div className="space-y-3">
                  <div className="rounded border border-border bg-surface px-3 py-2.5">
                    <p className="text-[10px] uppercase tracking-wide text-dim">Description</p>
                    <p className="mt-1 text-xs text-muted leading-relaxed">
                      {evo.name} was forged {getAgeString(evo.forgedAt).toLowerCase()} with {evo.lockedLamports} SOL locked inside.
                      {' '}Current stage: {currentStageName.toLowerCase()} with {evo.facetCount}/100 facets
                      {evo.tradeCount > 0 && <> and survived {evo.tradeCount} trade{evo.tradeCount > 1 ? 's' : ''}</>}.
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    <Prop label="Stage" value={currentStageName} />
                    <Prop label="ID" value={String(evo.id)} />
                    <Prop label="Facets" value={`${evo.facetCount}/100`} />
                    <Prop label="Trades" value={String(evo.tradeCount)} />
                  </div>

                  <div className="rounded border border-border bg-surface px-3 py-2.5">
                    <p className="text-[10px] uppercase tracking-wide text-dim">Program capabilities</p>
                    <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1.5 sm:grid-cols-3">
                      <Cap label="Feed" desc="Add SOL" />
                      <Cap label="List" desc="Sell" />
                      <Cap label="Buy" desc="Acquire" />
                      <Cap label="Transfer" desc="Send" />
                      <Cap label="Shatter" desc="Redeem" />
                      <Cap label="Evolve" desc="Auto" />
                    </div>
                  </div>

                  <div className="rounded border border-border bg-surface px-3 py-2">
                    <p className="text-[10px] uppercase tracking-wide text-dim">Resonance Seed</p>
                    <p className="mt-1 break-all font-mono text-[11px] text-muted">{evo.resonanceSeed}</p>
                  </div>

                  {traits && Object.keys(traits).length > 0 && (
                    <div className="rounded border border-border bg-surface px-3 py-2.5">
                      <p className="text-[10px] uppercase tracking-wide text-dim">Traits</p>
                      <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1.5 sm:grid-cols-3">
                        {Object.entries(traits).map(([key, val]) => (
                          <div key={key} className="rounded bg-bg px-2 py-1">
                            <p className="text-[9px] uppercase tracking-wide text-dim">{key}</p>
                            <p className="text-xs font-medium text-text">{val}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {tab === 'state' && (
                <div className="space-y-3">
                  {/* Lifecycle type */}
                  <div className="rounded border border-border bg-surface px-3 py-2.5">
                    <p className="text-[10px] uppercase tracking-wide text-dim">Lifecycle Type</p>
                    <p className="mt-1 text-sm font-semibold text-text-strong">
                      {evolveThresholds ? lifecycleLabel(evolveThresholds.lifecycleType) : '—'}
                    </p>
                    <p className="mt-0.5 text-[11px] text-muted">
                      {evolveThresholds ? lifecycleDesc(evolveThresholds.lifecycleType) : 'Collection config not loaded.'}
                    </p>
                  </div>

                  {/* Reveal + shatter fee + max states grid */}
                  <div className="grid grid-cols-3 gap-2">
                    <Prop label="Reveal" value={isRevealed === undefined ? '—' : isRevealed ? 'Yes' : 'Hidden'} />
                    <Prop label="Max Stages" value={evolveThresholds ? String(evolveThresholds.maxStates) : '—'} />
                    <Prop label="Shatter Fee" value={`${(shatterFeeBps / 100).toFixed(1)}%`} />
                  </div>

                  {/* Backed SOL */}
                  <div className="rounded border border-accent/30 bg-accent-soft px-3 py-2.5">
                    <p className="text-[10px] uppercase tracking-wide text-accent">Backed SOL (locked)</p>
                    <p className="mt-1 font-mono text-lg font-bold text-text-strong">
                      {evo.lockedLamports} <span className="text-xs text-muted">SOL</span>
                    </p>
                    <p className="mt-0.5 text-[11px] text-dim">
                      Recoverable anytime via shatter (minus fee).
                    </p>
                  </div>

                  {/* Evolution rules */}
                  {evolveThresholds && evolveThresholds.maxStates > 1 && (
                    <div className="rounded border border-border bg-surface px-3 py-2.5">
                      <p className="mb-2 text-[10px] uppercase tracking-wide text-dim">Evolution Rules</p>
                      <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-[11px]">
                        {evolveThresholds.trade > 0 && (
                          <div><span className="text-dim">Trades:</span> <span className="font-mono text-muted">{evolveThresholds.trade} per stage</span></div>
                        )}
                        {evolveThresholds.feed > 0 && (
                          <div><span className="text-dim">Feed:</span> <span className="font-mono text-muted">{(evolveThresholds.feed / 1_000_000_000).toFixed(4)} SOL per stage</span></div>
                        )}
                        {evolveThresholds.hold > 0 && (
                          <div><span className="text-dim">Hold:</span> <span className="font-mono text-muted">{evolveThresholds.hold < 3600 ? `${Math.floor(evolveThresholds.hold / 60)}m` : evolveThresholds.hold < 86400 ? `${(evolveThresholds.hold / 3600).toFixed(1)}h` : `${Math.floor(evolveThresholds.hold / 86400)}d`} per stage</span></div>
                        )}
                        {evolveThresholds.locked > 0 && (
                          <div><span className="text-dim">Locked:</span> <span className="font-mono text-muted">{(evolveThresholds.locked / 1_000_000_000).toFixed(4)} SOL per stage</span></div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Evolution progress */}
                  {evolveThresholds && (evolveThresholds.lifecycleType === 'RevealAndEvolve' || evolveThresholds.lifecycleType === 'Custom')
                    && evolveThresholds.maxStates > 1 && evo.currentState < evolveThresholds.maxStates - 1 && !evo.isShattered && (
                    <div className="rounded border border-border bg-surface p-3">
                      <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-dim">
                        Progress to stage {evo.currentState + 2}
                      </p>
                      <div className="space-y-2">
                        {evolveThresholds.trade > 0 && (
                          <EvoProgress
                            label="Trades"
                            current={evo.tradeCount}
                            required={evolveThresholds.trade * (evo.currentState + 1)}
                          />
                        )}
                        {evolveThresholds.feed > 0 && (
                          <EvoProgress
                            label="Fed"
                            current={evo.totalFedLamports}
                            required={evolveThresholds.feed * (evo.currentState + 1)}
                            format={(lamports) => `${(lamports / 1_000_000_000).toFixed(4)} SOL`}
                          />
                        )}
                        {evolveThresholds.hold > 0 && (
                          <EvoProgress
                            label="Hold time"
                            current={Math.max(0, Math.floor(Date.now() / 1000) - Math.floor(evo.lastTransitionAt / 1000))}
                            required={evolveThresholds.hold * (evo.currentState + 1)}
                            format={(s) => {
                              if (s < 3600) return `${Math.floor(s / 60)}m`;
                              if (s < 86400) return `${(s / 3600).toFixed(1)}h`;
                              return `${Math.floor(s / 86400)}d ${(s % 86400) / 3600 | 0}h`;
                            }}
                          />
                        )}
                        {evolveThresholds.locked > 0 && (
                          <EvoProgress
                            label="Locked"
                            current={Math.round(evo.lockedLamports * 1_000_000_000)}
                            required={evolveThresholds.locked * (evo.currentState + 1)}
                            format={(lamports) => `${(lamports / 1_000_000_000).toFixed(4)} SOL`}
                          />
                        )}
                      </div>
                      <p className="mt-2 text-[10px] text-dim">
                        All conditions must be met. Anyone can trigger evolution.
                      </p>
                    </div>
                  )}

                  {evo.isShattered && (
                    <div className="rounded border border-negative/30 bg-negative-soft px-3 py-2.5">
                      <p className="text-sm font-semibold text-negative">Shattered</p>
                      <p className="mt-0.5 text-[11px] text-muted">This EVO has been shattered. Locked SOL was recovered. The art remains as a permanent record.</p>
                    </div>
                  )}

                  {/* Manifest verification */}
                  {manifestVerification && (
                    <div className="rounded border border-border bg-surface px-3 py-2.5">
                      <p className="text-[10px] uppercase tracking-wide text-dim">Artwork Manifest</p>
                      <div className="mt-1.5 flex items-center gap-2">
                        {manifestVerification.status === 'verified' ? (
                          <><IconCheck className="h-4 w-4 text-positive" /><span className="text-xs text-positive">Hash verified on-chain</span></>
                        ) : manifestVerification.status === 'mismatch' ? (
                          <><IconAlertTriangle className="h-4 w-4 text-negative" /><span className="text-xs text-negative">Hash mismatch — art may be tampered</span></>
                        ) : manifestVerification.status === 'no-hash' ? (
                          <><IconAlertTriangle className="h-4 w-4 text-dim" /><span className="text-xs text-dim">No on-chain hash committed</span></>
                        ) : (
                          <><IconAlertTriangle className="h-4 w-4 text-dim" /><span className="text-xs text-dim">Unchecked</span></>
                        )}
                      </div>
                      {manifestVerification.expectedHash && (
                        <p className="mt-1 break-all font-mono text-[10px] text-dim">{manifestVerification.expectedHash}</p>
                      )}
                    </div>
                  )}
                </div>
              )}

              {tab === 'activity' && (
                <div>
                  {evo.fractureLines.length > 0 ? (
                    <div className="overflow-hidden rounded border border-border">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-surface text-[10px] uppercase tracking-wide text-dim">
                          <tr>
                            <th className="px-2 py-1.5 font-medium">Trade</th>
                            <th className="px-2 py-1.5 font-medium">From</th>
                            <th className="px-2 py-1.5 font-medium">Age</th>
                            <th className="px-2 py-1.5 text-right font-medium">Intensity</th>
                          </tr>
                        </thead>
                        <tbody>
                          {evo.fractureLines.map((fl, i) => (
                            <tr key={i} className="border-t border-border t-row">
                              <td className="px-2 py-1.5 font-mono text-accent">#{fl.tradeNumber}</td>
                              <td className="px-2 py-1.5 font-mono text-muted">{fl.previousOwner.slice(0, 6)}...{fl.previousOwner.slice(-4)}</td>
                              <td className="px-2 py-1.5 text-dim">{getAgeString(fl.timestamp)}</td>
                              <td className="px-2 py-1.5 text-right font-mono text-muted">{fl.intensity}%</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="py-8 text-center text-xs text-dim">No trade activity yet</p>
                  )}
                </div>
              )}

              {tab === 'holders' && (
                <div>
                  {holderHistory.length > 0 ? (
                    <div className="overflow-hidden rounded border border-border">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-surface text-[10px] uppercase tracking-wide text-dim">
                          <tr>
                            <th className="px-2 py-1.5 font-medium">Holder</th>
                            <th className="px-2 py-1.5 font-medium">Status</th>
                            <th className="px-2 py-1.5 text-right font-medium">Trade</th>
                          </tr>
                        </thead>
                        <tbody>
                          {holderHistory.map((h, i) => (
                            <tr key={i} className="border-t border-border t-row">
                              <td className="px-2 py-1.5 font-mono text-muted">{h.address.slice(0, 6)}...{h.address.slice(-4)}</td>
                              <td className="px-2 py-1.5">
                                {h.current ? (
                                  <span className="rounded bg-positive-soft px-1.5 py-0.5 text-[10px] font-medium text-positive">Current</span>
                                ) : (
                                  <span className="text-[10px] text-dim">Previous</span>
                                )}
                              </td>
                              <td className="px-2 py-1.5 text-right font-mono text-dim">{h.trade ? `#${h.trade}` : '--'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="py-8 text-center text-xs text-dim">No holder history</p>
                  )}
                </div>
              )}
            </div>
          </div>
          </Guard>

          {/* Right: Market sidebar */}
          <Guard name="detail-right">
          <div className="space-y-3">
            <div>
              <h1 className="text-lg font-bold tracking-tight text-text-strong">{evo.name}</h1>
              <div className="mt-1 flex items-center gap-2 text-[11px] text-muted">
                <span>{currentStageName}</span>
                <span className="text-dim">|</span>
                <span className="font-mono">{evo.collectionName || 'EVO'} #{evo.id}</span>
              </div>
              <p className="mt-1 font-mono text-[10px] text-dim">Owner {evo.owner.slice(0, 8)}...{evo.owner.slice(-4)}</p>
            </div>

            <div className="rounded border border-border bg-surface">
              <div className="grid grid-cols-2 gap-px bg-border">
                <MktCell label="Locked value" value={`${evo.lockedLamports}`} unit="SOL" tone="pos" />
                <MktCell label="Premium" value={evo.isListed ? `${premium > 0 ? '+' : ''}${premium.toFixed(0)}` : '--'} unit="%" />
                <MktCell label="Trades" value={String(evo.tradeCount)} />
                <MktCell label="Holders" value={String(uniqueHolders)} />
              </div>
              <div className="border-t border-border px-3 py-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase tracking-wide text-dim">Fracture intensity</span>
                  <span className="font-mono text-[10px] text-muted">{evo.fractureLines.length} trades</span>
                </div>
                <Sparkline points={sparkPoints} color="#818cf8" />
              </div>
            </div>

            {evo.isListed && !evo.isShattered && !isOwner && (
              <div className="rounded border border-border bg-surface p-3">
                <div className="flex items-baseline justify-between">
                  <span className="text-[11px] uppercase tracking-wide text-dim">Ask</span>
                  <span className="font-mono text-2xl font-bold text-positive">{evo.listPrice} <span className="text-sm text-muted">SOL</span></span>
                </div>
                <div className="mt-1 text-[11px] text-dim">Locked floor: <span className="font-mono text-muted">{evo.lockedLamports} SOL</span></div>
                {wallet.connected ? (
                  <button onClick={handleBuy} disabled={action === 'buy'}
                    className="mt-3 w-full rounded bg-positive py-2.5 text-sm font-bold text-[#0a0a0b] transition-opacity hover:opacity-90 disabled:opacity-50">
                    {action === 'buy' ? 'Buying...' : 'Buy now'}
                  </button>
                ) : (
                  <div className="mt-3 flex justify-center"><WalletMultiButton /></div>
                )}
              </div>
            )}

            {isOwner && !evo.isShattered && (
              <div className="rounded border border-border bg-surface p-3">
                {evo.isListed ? (
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[11px] uppercase tracking-wide text-dim">Listed</p>
                      <p className="font-mono text-xl font-bold text-positive">{evo.listPrice} SOL</p>
                    </div>
                    <button onClick={handleDelist} disabled={action === 'delist'}
                      className="rounded border border-border-strong px-3 py-1.5 text-xs font-medium text-text transition-colors hover:bg-surface-2 disabled:opacity-50">
                      {action === 'delist' ? '...' : 'Delist'}
                    </button>
                  </div>
                ) : (
                  <>
                    <p className="mb-2 text-xs font-medium text-text">List for sale</p>
                    <div className="flex gap-2">
                      <input type="number" placeholder="Price (SOL)" value={listPrice} onChange={(e) => setListPrice(e.target.value)}
                        className="t-input flex-1 px-2 py-1.5 text-sm" step="0.01" min="0.01" />
                      <button onClick={handleList} disabled={action === 'list'}
                        className="rounded border border-positive/40 bg-positive-soft px-3 py-1.5 text-xs font-medium text-positive transition-colors hover:bg-positive/10 disabled:opacity-50">
                        {action === 'list' ? '...' : 'List'}
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}

            {!evo.isShattered && (
              <div className="rounded border border-border bg-surface p-3">
                <div className="flex items-center justify-between text-[11px]">
                  <div>
                    <p className="uppercase tracking-wide text-dim">Bid</p>
                    <p className="font-mono text-sm text-muted">--</p>
                  </div>
                  <div className="text-right">
                    <p className="uppercase tracking-wide text-dim">Ask</p>
                    <p className="font-mono text-sm text-positive">{evo.isListed ? `${evo.listPrice} SOL` : '--'}</p>
                  </div>
                </div>
                <p className="mt-2 text-[10px] text-dim">On-chain bids coming soon</p>
              </div>
            )}

            <div className="rounded border border-border bg-surface px-3 py-2.5">
              <p className="text-[10px] uppercase tracking-wide text-dim">Creator</p>
              {creator ? (
                <a href={`https://solscan.io/account/${creator}`} target="_blank" rel="noopener noreferrer"
                  className="mt-1 inline-flex items-center gap-1.5 font-mono text-[11px] text-accent hover:underline">
                  {creator.slice(0, 8)}...{creator.slice(-4)}
                  <IconExternalLink className="h-3 w-3" />
                </a>
              ) : (
                <p className="mt-1 font-mono text-[11px] text-dim">Loading...</p>
              )}
            </div>

            <div className="rounded border border-border bg-surface px-3 py-2.5">
              <p className="text-[10px] uppercase tracking-wide text-dim">Artwork Authenticity</p>
              {(() => {
                const v = manifestVerification;
                if (!v) {
                  return <p className="mt-1 text-[11px] text-dim">Checking...</p>;
                }
                if (v.status === 'verified') {
                  return (
                    <div className="mt-1 flex items-center gap-1.5 text-[11px] text-positive">
                      <IconCheck className="h-3.5 w-3.5" />
                      <span>Manifest verified on-chain</span>
                    </div>
                  );
                }
                if (v.status === 'mismatch') {
                  return (
                    <div className="mt-1 space-y-1">
                      <div className="flex items-center gap-1.5 text-[11px] text-negative">
                        <IconAlertTriangle className="h-3.5 w-3.5" />
                        <span>Manifest hash mismatch!</span>
                      </div>
                      <p className="font-mono text-[9px] text-dim break-all">Expected: {v.expectedHash?.slice(0,16)}...</p>
                      <p className="font-mono text-[9px] text-dim break-all">Actual: {v.actualHash?.slice(0,16)}...</p>
                    </div>
                  );
                }
                if (v.status === 'no-hash') {
                  return (
                    <div className="mt-1 space-y-0.5">
                      <div className="flex items-center gap-1.5 text-[11px] text-warn">
                        <IconAlertTriangle className="h-3.5 w-3.5" />
                        <span>No hash committed — art unverified</span>
                      </div>
                      <p className="text-[10px] text-dim">This collection did not commit a manifest hash. Artwork cannot be cryptographically verified.</p>
                    </div>
                  );
                }
                return <p className="mt-1 text-[11px] text-dim">Not checked</p>;
              })()}
              {manifest?.provenance?.items && manifest.provenance.items.length > 0 && (
                <p className="mt-1 text-[10px] text-dim">
                  Per-EVO provenance: {manifest.provenance.items.length} entries
                </p>
              )}
            </div>

            {txResult && (
              <div className="flex items-center gap-2 rounded border border-positive/30 bg-positive-soft px-3 py-2 text-xs">
                <IconCheck className="h-4 w-4 text-positive" />
                <span className="text-positive">Confirmed</span>
                <a href={`https://solscan.io/tx/${txResult}`} target="_blank" rel="noopener noreferrer" className="ml-auto inline-flex items-center gap-1 text-accent hover:underline">
                  Solscan <IconExternalLink className="h-3 w-3" />
                </a>
              </div>
            )}
            {error && (
              <div className="flex items-center gap-2 rounded border border-negative/30 bg-negative-soft px-3 py-2 text-xs text-negative">
                <IconAlertTriangle className="h-4 w-4 shrink-0" /> {error}
              </div>
            )}

            {isOwner && !evo.isShattered && (
              <div className="space-y-2 border-t border-border pt-3">
                <p className="text-[10px] font-medium uppercase tracking-wide text-dim">Owner actions</p>
                <div className="flex gap-2">
                  <input type="number" placeholder="Feed SOL" value={feedAmount} onChange={(e) => setFeedAmount(e.target.value)}
                    className="t-input flex-1 px-2 py-1.5 text-sm" step="0.001" min="0.001" />
                  <button onClick={handleFeed} disabled={action === 'feed'}
                    className="rounded border border-warn/40 bg-warn-soft px-3 py-1.5 text-xs font-medium text-warn transition-colors hover:bg-warn/10 disabled:opacity-50">
                    {action === 'feed' ? '...' : 'Feed'}
                  </button>
                </div>
                <div className="flex gap-2">
                  <input type="text" placeholder="Recipient address" value={transferAddress} onChange={(e) => setTransferAddress(e.target.value)}
                    className="t-input flex-1 px-2 py-1.5 text-sm" />
                  <button onClick={handleTransfer} disabled={action === 'transfer' || !transferAddress}
                    className="rounded border border-border-strong bg-surface px-3 py-1.5 text-xs font-medium text-text transition-colors hover:bg-surface-2 disabled:opacity-50">
                    {action === 'transfer' ? '...' : 'Transfer'}
                  </button>
                </div>
                <button onClick={handleShatter} disabled={action === 'shatter'}
                  className="w-full rounded border border-negative/30 bg-negative-soft py-2.5 text-xs font-medium text-negative transition-colors hover:bg-negative/10 disabled:opacity-50">
                  {action === 'shatter' ? 'Shattering...' : `Shatter - recover ${(evo.lockedLamports * (10000 - shatterFeeBps) / 10000).toFixed(4)} SOL`}
                </button>
              </div>
            )}

            {!isOwner && !evo.isListed && !evo.isShattered && (
              <div className="rounded border border-border bg-surface px-3 py-3 text-center text-xs text-muted">Not listed for sale</div>
            )}
            {evo.isShattered && (
              <div className="rounded border border-negative/20 bg-negative-soft px-3 py-3 text-center text-xs text-negative">This EVO has been shattered</div>
            )}
          </div>
          </Guard>
        </div>
      </div>
    </div>
  );
}

/**
 * Per-section error boundary. Wrapping a subtree in <Guard name="..."> means a
 * render throw inside it degrades to an inline message instead of white-screening
 * the whole detail page — and logs *which* section threw + the component stack,
 * so an otherwise-unreproducible EvoDetail crash names itself in the console.
 * Renders children untouched (no extra DOM) on the success path.
 */
type GuardProps = { name: string; children: React.ReactNode };
class Guard extends Component<GuardProps, { error: Error | null }> {
  state: { error: Error | null } = { error: null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error(`EvoDetail section "${this.props.name}" crashed:`, error, info?.componentStack);
  }
  render() {
    if (this.state.error) {
      return (
        <div className="rounded border border-negative/30 bg-negative-soft px-3 py-2 text-xs text-negative">
          <p className="font-medium">This section couldn&apos;t render ({this.props.name}).</p>
          <p className="mt-1 break-all font-mono text-[10px] opacity-80">{this.state.error.message}</p>
        </div>
      );
    }
    return this.props.children;
  }
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className={`px-3 py-2 text-xs font-medium transition-colors ${active ? 'border-b-2 border-accent text-text-strong' : 'text-muted hover:text-text'}`}>
      {children}
    </button>
  );
}

function MktCell({ label, value, unit, tone }: { label: string; value: string; unit?: string; tone?: 'pos' }) {
  return (
    <div className="bg-surface px-3 py-2">
      <p className="text-[10px] uppercase tracking-wide text-dim">{label}</p>
      <p className={`mt-0.5 font-mono text-sm font-semibold ${tone === 'pos' ? 'text-positive' : 'text-text-strong'}`}>
        {value}{unit && <span className="ml-0.5 text-[10px] text-muted">{unit}</span>}
      </p>
    </div>
  );
}

function Prop({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-border bg-surface px-2.5 py-2">
      <p className="text-[10px] uppercase tracking-wide text-dim">{label}</p>
      <p className="mt-0.5 text-xs font-semibold text-text">{value}</p>
    </div>
  );
}

function Cap({ label, desc }: { label: string; desc: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <IconCheck className="h-3 w-3 text-positive" />
      <span className="text-[11px] text-muted"><span className="text-text">{label}</span> <span className="text-dim">{desc}</span></span>
    </div>
  );
}

function EvoProgress({ label, current, required, format }: {
  label: string; current: number; required: number;
  format?: (n: number) => string;
}) {
  const fmt = format || ((n: number) => String(n));
  const pct = required > 0 ? Math.min(100, (current / required) * 100) : 100;
  return (
    <div>
      <div className="flex items-center justify-between text-[11px]">
        <span className="text-muted">{label}</span>
        <span className="font-mono text-dim">{fmt(current)} / {fmt(required)}</span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded bg-surface-2">
        <div className="h-full rounded bg-accent transition-all" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function lifecycleLabel(type: string): string {
  switch (type) {
    case 'Static': return 'Static';
    case 'Reveal': return 'Reveal';
    case 'CommitReveal': return 'Commit-Reveal';
    case 'RevealAndEvolve': return 'Reveal & Evolve';
    case 'Custom': return 'Custom';
    default: return type;
  }
}

function lifecycleDesc(type: string): string {
  switch (type) {
    case 'Static': return 'Art never changes. Simplest lifecycle.';
    case 'Reveal': return 'Art starts hidden, revealed by the creator.';
    case 'CommitReveal': return 'Provably fair reveal — no one can peek or change the art.';
    case 'RevealAndEvolve': return 'Art reveals, then evolves through stages as collectors feed it SOL.';
    case 'Custom': return 'Full creative control — evolve and manually switch art stages anytime.';
    default: return '';
  }
}

function Sparkline({ points, color }: { points: number[]; color: string }) {
  const w = 280, h = 40, pad = 4;
  const max = Math.max(...points, 1);
  const min = Math.min(...points, 0);
  const range = max - min || 1;
  const stepX = (w - pad * 2) / Math.max(points.length - 1, 1);
  const coords = points.map((p, i) => ({
    x: pad + i * stepX,
    y: pad + (h - pad * 2) * (1 - (p - min) / range),
  }));
  const path = coords.map((c, i) => `${i === 0 ? 'M' : 'L'} ${c.x.toFixed(1)} ${c.y.toFixed(1)}`).join(' ');
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="mt-1 w-full" preserveAspectRatio="none" style={{ height: 40 }}>
      <path d={path} fill="none" stroke={color} strokeWidth={1.5} strokeLinejoin="round" />
    </svg>
  );
}