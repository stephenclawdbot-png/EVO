'use client';

import { EVOData, getStage, getAgeString } from '@/lib/evo-data';
import { ELEMENT_COLORS, RARITY_COLORS, STAGE_NAMES, Stage } from '@/lib/creatures';
import { useState } from 'react';
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
import { IconCheck, IconX, IconAlertTriangle, IconExternalLink } from './Icons';

interface ZDetailProps {
  evo: EVOData;
  onBack: () => void;
  onRefresh?: () => void;
}

export function ZDetail({ evo, onBack, onRefresh }: ZDetailProps) {
  const { connection } = useConnection();
  const wallet = useWallet();
  const [imgError, setImgError] = useState(false);
  const [action, setAction] = useState<string | null>(null);
  const [txResult, setTxResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [listPrice, setListPrice] = useState('');
  const [feedAmount, setFeedAmount] = useState('');
  const [transferAddress, setTransferAddress] = useState('');
  const [tab, setTab] = useState<'info' | 'history'>('info');

  const stage = getStage(evo);
  const elementColor = ELEMENT_COLORS[evo.creature.element];
  const rarityColor = RARITY_COLORS[evo.creature.rarity];
  const scale = 0.6 + Math.min(1, evo.lockedLamports / 50) * 0.4;
  const stages: Stage[] = ['baby', 'juvenile', 'adult', 'elder'];
  const currentStageIndex = stages.indexOf(stage);
  const isOwner = wallet.connected && wallet.publicKey && evo.owner === wallet.publicKey.toBase58();

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
      const [collectionPda] = getCollectionPDA('Z');
      const cfg = await readCollectionConfig(connection, 'Z');
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
      const [collectionPda] = getCollectionPDA('Z');
      const cfg = await readCollectionConfig(connection, 'Z');
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

  const ticker = [
    { label: 'Z', value: `#${evo.id}` },
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
          {/* Left: Art + evolution */}
          <div>
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
                <img src={evo.creature.stages[stage]} alt={evo.creature.displayName} className="relative z-[1]"
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
              <button onClick={() => setTab('info')} className={`px-3 py-2 text-xs font-medium transition-colors ${tab === 'info' ? 'border-b-2 border-accent text-text-strong' : 'text-muted hover:text-text'}`}>Properties</button>
              <button onClick={() => setTab('history')} className={`px-3 py-2 text-xs font-medium transition-colors ${tab === 'history' ? 'border-b-2 border-accent text-text-strong' : 'text-muted hover:text-text'}`}>
                History {evo.fractureLines.length > 0 && `(${evo.fractureLines.length})`}
              </button>
            </div>

            {tab === 'info' ? (
              <div className="mt-3 space-y-2">
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <Prop label="Element" value={evo.creature.element} color={elementColor} />
                  <Prop label="Rarity" value={evo.creature.rarity} color={rarityColor} />
                  <Prop label="Stage" value={STAGE_NAMES[stage]} />
                  <Prop label="Creature" value={evo.creatureId} />
                </div>
                <div className="rounded border border-border bg-surface px-3 py-2">
                  <p className="text-[10px] uppercase tracking-wide text-dim">Resonance Seed</p>
                  <p className="mt-1 break-all font-mono text-[11px] text-muted">{evo.resonanceSeed}</p>
                </div>
              </div>
            ) : (
              <div className="mt-3">
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
                          <tr key={i} className="border-t border-border">
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
                  <p className="py-8 text-center text-xs text-dim">No trade history yet</p>
                )}
              </div>
            )}
          </div>

          {/* Right: Order panel */}
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

            {/* Buy box */}
            {evo.isListed && !evo.isShattered && !isOwner && (
              <div className="rounded border border-border bg-surface p-3">
                <div className="flex items-baseline justify-between">
                  <span className="text-[11px] uppercase tracking-wide text-dim">Price</span>
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

            {/* Stats grid */}
            <div className="grid grid-cols-2 gap-2">
              <Stat label="Locked SOL" value={`${evo.lockedLamports}`} tone="pos" />
              <Stat label="Facets" value={`${evo.facetCount}/100`} />
              <Stat label="Trades" value={String(evo.tradeCount)} />
              <Stat label="Age" value={getAgeString(evo.forgedAt)} />
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

function Stat({ label, value, tone }: { label: string; value: string; tone?: 'pos' }) {
  return (
    <div className="rounded border border-border bg-surface px-2.5 py-2">
      <p className="text-[10px] uppercase tracking-wide text-dim">{label}</p>
      <p className={`mt-0.5 font-mono text-sm font-semibold ${tone === 'pos' ? 'text-positive' : 'text-text-strong'}`}>{value}</p>
    </div>
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
