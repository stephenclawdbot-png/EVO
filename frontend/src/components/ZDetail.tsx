'use client';

import { EVOData, getStage, getAgeString } from '@/lib/evo-data';
import { ELEMENT_COLORS, RARITY_COLORS, STAGE_NAMES, Stage } from '@/lib/creatures';
import { useState, useEffect } from 'react';
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
import { resolveImage } from '@/lib/evo-visuals';
import { IconCheck, IconAlertTriangle, IconExternalLink } from './Icons';

interface ZDetailProps {
  evo: EVOData;
  onBack: () => void;
  onRefresh?: () => void;
}

export function ZDetail({ evo, onBack, onRefresh }: ZDetailProps) {
  const { connection } = useConnection();
  const wallet = useWallet();
  const collectionName = evo.collectionName || 'Z';
  const [imgError, setImgError] = useState(false);
  const [resolvedImage, setResolvedImage] = useState<string | null>(null);
  const [action, setAction] = useState<string | null>(null);
  const [txResult, setTxResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [listPrice, setListPrice] = useState('');
  const [feedAmount, setFeedAmount] = useState('');
  const [transferAddress, setTransferAddress] = useState('');
  const [tab, setTab] = useState<'overview' | 'activity' | 'holders'>('overview');
  const [creator, setCreator] = useState<string | null>(null);
  const [metadataUri, setMetadataUri] = useState<string | null>(null);
  const [isRevealed, setIsRevealed] = useState<boolean | undefined>(undefined);

  useEffect(() => {
    readCollectionConfig(connection, collectionName).then(cfg => {
      if (cfg) {
        setCreator(cfg.creator.toBase58());
        setMetadataUri(cfg.metadataUri);
        setIsRevealed(cfg.isRevealed);
      }
    }).catch(() => {});
  }, [connection]);

  const stage = getStage(evo);
  const fallbackSprite = evo.creature.stages[stage];

  useEffect(() => {
    if (!metadataUri) { setResolvedImage(null); return; }
    let active = true;
    resolveImage(metadataUri, fallbackSprite, evo.currentState, isRevealed).then(img => {
      if (active) setResolvedImage(img);
    });
    return () => { active = false; };
  }, [metadataUri, fallbackSprite, evo.currentState, isRevealed]);

  const displayImage = resolvedImage || fallbackSprite;
  const elementColor = ELEMENT_COLORS[evo.creature.element];
  const rarityColor = RARITY_COLORS[evo.creature.rarity];
  const scale = 0.6 + Math.min(1, evo.lockedLamports / 50) * 0.4;
  const stages: Stage[] = ['baby', 'juvenile', 'adult', 'elder'];
  const currentStageIndex = stages.indexOf(stage);
  const isOwner = wallet.connected && wallet.publicKey && evo.owner === wallet.publicKey.toBase58();

  // --- Tx handlers (unchanged) ---
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
      const sig = await sendTx(createFeedIx(new PublicKey(evo.evoPda!), wallet.publicKey!, lamports));
      if (sig) { setTxResult(sig); setFeedAmount(''); onRefresh?.(); }
    } catch (err: any) { setError(err.message || 'Feed failed'); } finally { setAction(null); }
  };

  const handleList = async () => {
    setAction('list'); setError(null); setTxResult(null);
    try {
      const lamports = Math.floor(parseFloat(listPrice) * LAMPORTS_PER_SOL);
      if (!lamports || lamports <= 0) throw new Error('Enter a valid price');
      const sig = await sendTx(createListIx(new PublicKey(evo.evoPda!), wallet.publicKey!, lamports));
      if (sig) { setTxResult(sig); setListPrice(''); onRefresh?.(); }
    } catch (err: any) { setError(err.message || 'List failed'); } finally { setAction(null); }
  };

  const handleDelist = async () => {
    setAction('delist'); setError(null); setTxResult(null);
    try {
      const sig = await sendTx(createDelistIx(new PublicKey(evo.evoPda!), wallet.publicKey!));
      if (sig) { setTxResult(sig); onRefresh?.(); }
    } catch (err: any) { setError(err.message || 'Delist failed'); } finally { setAction(null); }
  };

  const handleBuy = async () => {
    setAction('buy'); setError(null); setTxResult(null);
    try {
      const [collectionPda] = getCollectionPDA(collectionName);
      const cfg = await readCollectionConfig(connection, collectionName);
      if (!cfg) throw new Error('Collection not found');
      const proto = await readProtocolConfig(connection);
      if (!proto) throw new Error('Protocol not found');
      const sig = await sendTx(createBuyIx(
        new PublicKey(evo.evoPda!), collectionPda,
        new PublicKey(evo.owner), cfg.creator, wallet.publicKey!, proto.treasury,
      ));
      if (sig) { setTxResult(sig); onRefresh?.(); }
    } catch (err: any) { setError(err.message || 'Buy failed'); } finally { setAction(null); }
  };

  const handleShatter = async () => {
    if (!confirm(`Shatter this Z and recover ${(evo.lockedLamports * 0.95).toFixed(4)} SOL (after 5% fee)? This cannot be undone.`)) return;
    setAction('shatter'); setError(null); setTxResult(null);
    try {
      const [collectionPda] = getCollectionPDA(collectionName);
      const cfg = await readCollectionConfig(connection, collectionName);
      if (!cfg) throw new Error('Collection not found');
      const proto = await readProtocolConfig(connection);
      if (!proto) throw new Error('Protocol not found');
      const sig = await sendTx(createShatterIx(
        new PublicKey(evo.evoPda!), collectionPda, wallet.publicKey!, cfg.creator, proto.treasury, evo.id,
      ));
      if (sig) { setTxResult(sig); onRefresh?.(); }
    } catch (err: any) { setError(err.message || 'Shatter failed'); } finally { setAction(null); }
  };

  const handleTransfer = async () => {
    setAction('transfer'); setError(null); setTxResult(null);
    try {
      const sig = await sendTx(createTransferIx(
        new PublicKey(evo.evoPda!), wallet.publicKey!, new PublicKey(transferAddress),
      ));
      if (sig) { setTxResult(sig); setTransferAddress(''); onRefresh?.(); }
    } catch (err: any) { setError(err.message || 'Transfer failed'); } finally { setAction(null); }
  };

  // --- Derived data ---
  const premium = evo.isListed && evo.listPrice ? ((evo.listPrice - evo.lockedLamports) / evo.lockedLamports * 100) : 0;
  const holderHistory = [
    { address: evo.owner, current: true, trade: null as number | null },
    ...evo.fractureLines.slice().reverse().map(fl => ({ address: fl.previousOwner, current: false, trade: fl.tradeNumber })),
  ];
  const uniqueHolders = new Set(holderHistory.map(h => h.address)).size;

  // Sparkline from fracture line intensities
  const sparkPoints = evo.fractureLines.length > 0
    ? evo.fractureLines.map(fl => fl.intensity)
    : [0, 100];

  const ticker = [
    { label: collectionName, value: `#${evo.id}` },
    { label: 'Locked', value: `${evo.lockedLamports} SOL`, tone: 'pos' as const },
    { label: 'Trades', value: String(evo.tradeCount) },
    { label: 'Facets', value: `${evo.facetCount}/100` },
  ];

  return (
    <div className="min-h-screen bg-bg text-text">
      <Nav ticker={ticker} />

      {/* Back */}
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
          <div>
            {/* Large preview */}
            <div className="relative flex aspect-square items-center justify-center overflow-hidden rounded border border-border bg-surface lg:aspect-[4/3]"
              style={{ boxShadow: evo.isListed ? `0 0 0 1px ${elementColor}40` : 'none' }}>
              <div className="absolute inset-0" style={{ background: `radial-gradient(circle at 50% 45%, ${elementColor}18, transparent 70%)` }} />

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
                <img src={displayImage} alt={evo.creature.displayName} className="relative z-[1]"
                  style={{ transform: `scale(${scale * 1.5})`, imageRendering: 'pixelated',
                    filter: evo.isListed ? `drop-shadow(0 0 14px ${elementColor})` : `drop-shadow(0 0 6px ${elementColor}70)` }}
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

            {/* Evolution stages */}
            <div className="mt-3 grid grid-cols-4 gap-2">
              {stages.map((s, i) => (
                <div key={s} className={`relative flex aspect-square items-center justify-center overflow-hidden rounded border ${
                  i === currentStageIndex ? 'border-accent bg-accent-soft' : i < currentStageIndex ? 'border-border opacity-40' : 'border-border opacity-20'}`}>
                  <img src={evo.creature.stages[s]} alt={s} className="h-10 w-10 pixelated" />
                  <span className="absolute bottom-0 left-0 right-0 bg-bg/70 py-0.5 text-center text-[10px] text-muted">{STAGE_NAMES[s]}</span>
                  {i < currentStageIndex && (
                    <span className="absolute right-0.5 top-0.5 text-positive">
                      <IconCheck className="h-3 w-3" />
                    </span>
                  )}
                </div>
              ))}
            </div>

            {/* Tabs */}
            <div className="mt-4 flex border-b border-border">
              <TabBtn active={tab === 'overview'} onClick={() => setTab('overview')}>Overview</TabBtn>
              <TabBtn active={tab === 'activity'} onClick={() => setTab('activity')}>
                Activity {evo.fractureLines.length > 0 && `(${evo.fractureLines.length})`}
              </TabBtn>
              <TabBtn active={tab === 'holders'} onClick={() => setTab('holders')}>
                Holders {uniqueHolders > 0 && `(${uniqueHolders})`}
              </TabBtn>
            </div>

            {/* Tab content */}
            <div className="mt-3">
              {tab === 'overview' && (
                <div className="space-y-3">
                  {/* Description */}
                  <div className="rounded border border-border bg-surface px-3 py-2.5">
                    <p className="text-[10px] uppercase tracking-wide text-dim">Description</p>
                    <p className="mt-1 text-xs text-muted leading-relaxed">
                      {evo.creature.displayName} is a {evo.creature.rarity.toLowerCase()} {evo.creature.element.toLowerCase()}-aligned Zenko from the Z collection.
                      Forged {getAgeString(evo.forgedAt).toLowerCase()} with {evo.lockedLamports} SOL locked inside.
                      {' '}It has evolved to {STAGE_NAMES[stage].toLowerCase()} stage with {evo.facetCount}/100 facets
                      {evo.tradeCount > 0 && <> and survived {evo.tradeCount} trade{evo.tradeCount > 1 ? 's' : ''}</>}.
                    </p>
                  </div>

                  {/* Properties */}
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    <Prop label="Element" value={evo.creature.element} color={elementColor} />
                    <Prop label="Rarity" value={evo.creature.rarity} color={rarityColor} />
                    <Prop label="Stage" value={STAGE_NAMES[stage]} />
                    <Prop label="Creature" value={evo.creatureId} />
                  </div>

                  {/* Program capabilities */}
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

                  {/* Resonance seed */}
                  <div className="rounded border border-border bg-surface px-3 py-2">
                    <p className="text-[10px] uppercase tracking-wide text-dim">Resonance Seed</p>
                    <p className="mt-1 break-all font-mono text-[11px] text-muted">{evo.resonanceSeed}</p>
                  </div>
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

          {/* Right: Market sidebar */}
          <div className="space-y-3">
            {/* Title */}
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold tracking-tight text-text-strong">{evo.creature.displayName}</h1>
                <span className="rounded px-1.5 py-0.5 text-[10px] font-bold" style={{ color: rarityColor, backgroundColor: `${rarityColor}1a` }}>{evo.creature.rarity}</span>
              </div>
              <div className="mt-1 flex items-center gap-2 text-[11px] text-muted">
                <span style={{ color: elementColor }}>{evo.creature.element}</span>
                <span className="text-dim">|</span>
                <span>{STAGE_NAMES[stage]}</span>
                <span className="text-dim">|</span>
                <span className="font-mono">Z #{evo.id}</span>
              </div>
              <p className="mt-1 font-mono text-[10px] text-dim">Owner {evo.owner.slice(0, 8)}...{evo.owner.slice(-4)}</p>
            </div>

            {/* Market data */}
            <div className="rounded border border-border bg-surface">
              <div className="grid grid-cols-2 gap-px bg-border">
                <MktCell label="Locked value" value={`${evo.lockedLamports}`} unit="SOL" tone="pos" />
                <MktCell label="Premium" value={evo.isListed ? `${premium > 0 ? '+' : ''}${premium.toFixed(0)}` : '--'} unit="%" />
                <MktCell label="Trades" value={String(evo.tradeCount)} />
                <MktCell label="Holders" value={String(uniqueHolders)} />
              </div>
              {/* Sparkline */}
              <div className="border-t border-border px-3 py-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase tracking-wide text-dim">Fracture intensity</span>
                  <span className="font-mono text-[10px] text-muted">{evo.fractureLines.length} trades</span>
                </div>
                <Sparkline points={sparkPoints} color={elementColor} />
              </div>
            </div>

            {/* Buy box */}
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

            {/* Owner: list/delist */}
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

            {/* Bid/Ask */}
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

            {/* Creator */}
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

            {/* Tx result / error */}
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

            {/* Owner actions */}
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
                  {action === 'shatter' ? 'Shattering...' : `Shatter - recover ${(evo.lockedLamports * 0.95).toFixed(4)} SOL`}
                </button>
              </div>
            )}

            {!isOwner && !evo.isListed && !evo.isShattered && (
              <div className="rounded border border-border bg-surface px-3 py-3 text-center text-xs text-muted">Not listed for sale</div>
            )}
            {evo.isShattered && (
              <div className="rounded border border-negative/20 bg-negative-soft px-3 py-3 text-center text-xs text-negative">This Z has been shattered</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
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
  const path = coords.map((c, i) => `${i === 0 ? 'M' : 'L'}${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(' ');
  const areaPath = `${path} L${coords[coords.length - 1].x.toFixed(1)},${h - pad} L${coords[0].x.toFixed(1)},${h - pad} Z`;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="mt-1.5 w-full" preserveAspectRatio="none" style={{ height: 40 }}>
      <path d={areaPath} fill={color} opacity={0.12} />
      <path d={path} fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
      {coords.map((c, i) => (
        <circle key={i} cx={c.x} cy={c.y} r={1.5} fill={color} opacity={0.6} />
      ))}
    </svg>
  );
}

function Prop({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="rounded border border-border bg-surface px-2.5 py-2">
      <p className="text-[10px] uppercase tracking-wide text-dim">{label}</p>
      <p className="mt-0.5 text-xs font-semibold capitalize" style={color ? { color } : undefined}>{value}</p>
    </div>
  );
}

function Cap({ label, desc }: { label: string; desc: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="h-1 w-1 rounded-full bg-accent" />
      <span className="text-xs font-medium text-text">{label}</span>
      <span className="text-[10px] text-dim">{desc}</span>
    </div>
  );
}
