'use client';

import { EVOData, getStage, getAgeString } from '@/lib/evo-data';
import { ELEMENT_COLORS, RARITY_COLORS, STAGE_NAMES, Stage } from '@/lib/creatures';
import { useState } from 'react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { Transaction, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import Link from 'next/link';
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

  return (
    <div className="min-h-screen bg-[#0a0a0b] text-white">
      {/* Nav */}
      <nav className="sticky top-0 z-50 border-b border-[#1a1a1e] bg-[#0a0a0b]/80 backdrop-blur-xl">
        <div className="mx-auto max-w-7xl px-4 lg:px-6">
          <div className="flex h-16 items-center justify-between">
            <button onClick={onBack} className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
              Gallery
            </button>
            <Link href="/" className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 text-sm font-bold">Z</div>
            </Link>
            <WalletMultiButton />
          </div>
        </div>
      </nav>

      <div className="mx-auto max-w-6xl px-4 py-8 lg:px-6">
        <div className="grid gap-8 lg:grid-cols-2">
          {/* Left: Art */}
          <div>
            <div
              className="relative flex aspect-square items-center justify-center overflow-hidden rounded-2xl border border-[#1a1a1e] bg-[#131316]"
              style={{ boxShadow: evo.isListed ? `0 0 30px ${elementColor}30` : 'none' }}
            >
              <div className="absolute inset-0" style={{ background: `radial-gradient(circle at 50% 50%, ${elementColor}20, transparent 65%)` }} />

              {evo.fractureLines.length > 0 && (
                <svg className="absolute inset-0 h-full w-full" viewBox="0 0 400 400">
                  {evo.fractureLines.map((fl, i) => {
                    const angle = (fl.position * Math.PI) / 180;
                    const len = 60 + (fl.intensity / 100) * 80;
                    return (
                      <g key={i}>
                        <line x1={200} y1={200} x2={200 + Math.cos(angle) * len} y2={200 + Math.sin(angle) * len}
                          stroke="rgba(255,255,255,0.35)" strokeWidth={fl.intensity > 50 ? 2 : 1} strokeLinecap="round" />
                        <text x={200 + Math.cos(angle) * len + 5} y={200 + Math.sin(angle) * len} fill="rgba(255,255,255,0.25)" fontSize="8">#{fl.tradeNumber}</text>
                      </g>
                    );
                  })}
                </svg>
              )}

              {!imgError ? (
                <img src={evo.creature.stages[stage]} alt={evo.creature.displayName} className="relative z-[1]"
                  style={{ transform: `scale(${scale * 1.5})`, imageRendering: 'pixelated',
                    filter: evo.isListed ? `drop-shadow(0 0 16px ${elementColor})` : `drop-shadow(0 0 8px ${elementColor}80)` }}
                  onError={() => setImgError(true)} />
              ) : (
                <div className="text-gray-500">Image not found</div>
              )}

              {evo.isListed && (
                <div className="absolute top-4 right-4 rounded-lg bg-green-500/90 px-3 py-1 text-sm font-bold text-black">
                  LISTED · {evo.listPrice}◎
                </div>
              )}
            </div>

            {/* Evolution stages */}
            <div className="mt-4 grid grid-cols-4 gap-2">
              {stages.map((s, i) => (
                <div key={s} className={`relative flex aspect-square items-center justify-center rounded-lg border-2 overflow-hidden ${
                  i === currentStageIndex ? 'border-indigo-400 bg-indigo-400/10' : i < currentStageIndex ? 'border-[#2a2a30] opacity-50' : 'border-[#1a1a1e] opacity-20'}`}>
                  <img src={evo.creature.stages[s]} alt={s} className="h-12 w-12" style={{ imageRendering: 'pixelated' }} />
                  <span className="absolute bottom-0 left-0 right-0 bg-black/60 text-center text-xs">{STAGE_NAMES[s]}</span>
                  {i < currentStageIndex && <span className="absolute top-0 right-0 text-xs text-green-400">✓</span>}
                </div>
              ))}
            </div>
          </div>

          {/* Right: Details */}
          <div className="space-y-6">
            {/* Title */}
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-3xl font-bold">{evo.creature.displayName}</h1>
                <span className="rounded-lg px-2.5 py-1 text-sm font-bold" style={{ color: rarityColor, backgroundColor: `${rarityColor}20` }}>{evo.creature.rarity}</span>
              </div>
              <div className="mt-2 flex items-center gap-3 text-sm">
                <span style={{ color: elementColor }}>● {evo.creature.element}</span>
                <span className="text-gray-600">|</span>
                <span className="text-gray-400">Stage: {STAGE_NAMES[stage]}</span>
                <span className="text-gray-600">|</span>
                <span className="font-mono text-gray-500">Z #{evo.id}</span>
              </div>
              <div className="mt-1 text-xs text-gray-500 font-mono">
                Owner: {evo.owner.slice(0, 8)}...{evo.owner.slice(-4)}
              </div>
            </div>

            {/* Price / Buy area */}
            {evo.isListed && !evo.isShattered && !isOwner && (
              <div className="rounded-xl border border-[#1a1a1e] bg-[#131316] p-5">
                <p className="text-xs text-gray-500">Price</p>
                <p className="mt-1 text-3xl font-bold text-green-400 font-mono">{evo.listPrice}◎</p>
                <p className="mt-1 text-xs text-gray-500">Locked floor: {evo.lockedLamports}◎</p>
                {wallet.connected ? (
                  <button onClick={handleBuy} disabled={action === 'buy'}
                    className="mt-4 w-full rounded-xl bg-gradient-to-r from-green-500 to-emerald-500 px-4 py-3.5 text-base font-bold text-black transition-opacity hover:opacity-90 disabled:opacity-50">
                    {action === 'buy' ? 'Buying...' : `Buy Now`}
                  </button>
                ) : (
                  <p className="mt-4 text-center text-sm text-gray-500">Connect wallet to buy</p>
                )}
              </div>
            )}

            {/* Owner: List/Delist */}
            {isOwner && !evo.isShattered && (
              <div className="rounded-xl border border-[#1a1a1e] bg-[#131316] p-5 space-y-4">
                {evo.isListed ? (
                  <>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs text-gray-500">Listed for</p>
                        <p className="text-2xl font-bold text-green-400 font-mono">{evo.listPrice}◎</p>
                      </div>
                      <button onClick={handleDelist} disabled={action === 'delist'}
                        className="rounded-lg border border-[#2a2a30] px-4 py-2 text-sm font-medium text-gray-300 hover:text-white transition-colors disabled:opacity-50">
                        {action === 'delist' ? '...' : 'Delist'}
                      </button>
                    </div>
                  </>
                ) : (
                  <div>
                    <p className="mb-2 text-sm font-medium text-gray-300">List for sale</p>
                    <div className="flex gap-2">
                      <input type="number" placeholder="Price in SOL" value={listPrice} onChange={(e) => setListPrice(e.target.value)}
                        className="flex-1 rounded-lg border border-[#232328] bg-[#0a0a0b] px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:border-green-500 focus:outline-none" step="0.01" min="0.01" />
                      <button onClick={handleList} disabled={action === 'list'}
                        className="rounded-lg bg-green-500/20 border border-green-500/40 px-4 py-2.5 font-medium text-green-400 hover:bg-green-500/30 transition-colors disabled:opacity-50">
                        {action === 'list' ? '...' : 'List'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Stats grid */}
            <div className="grid grid-cols-2 gap-3">
              <StatBox label="Locked SOL" value={`${evo.lockedLamports}◎`} color="#FCD34D" />
              <StatBox label="Facets" value={`${evo.facetCount}/100`} color="#60A5FA" />
              <StatBox label="Trades" value={String(evo.tradeCount)} color="#A78BFA" />
              <StatBox label="Age" value={getAgeString(evo.forgedAt)} color="#34D399" />
            </div>

            {/* Tabs */}
            <div className="flex gap-1 border-b border-[#1a1a1e]">
              <button onClick={() => setTab('info')} className={`px-4 py-2 text-sm font-medium transition-colors ${tab === 'info' ? 'text-white border-b-2 border-indigo-500' : 'text-gray-500 hover:text-gray-300'}`}>Properties</button>
              <button onClick={() => setTab('history')} className={`px-4 py-2 text-sm font-medium transition-colors ${tab === 'history' ? 'text-white border-b-2 border-indigo-500' : 'text-gray-500 hover:text-gray-300'}`}>History {evo.fractureLines.length > 0 && `(${evo.fractureLines.length})`}</button>
            </div>

            {tab === 'info' ? (
              <div className="space-y-3">
                {/* Properties */}
                <div className="grid grid-cols-2 gap-2">
                  <PropItem label="Element" value={evo.creature.element} color={elementColor} />
                  <PropItem label="Rarity" value={evo.creature.rarity} color={rarityColor} />
                  <PropItem label="Stage" value={STAGE_NAMES[stage]} />
                  <PropItem label="Creature ID" value={evo.creatureId} />
                </div>

                {/* Resonance seed */}
                <div className="rounded-lg border border-[#1a1a1e] bg-[#131316] p-3">
                  <p className="text-xs text-gray-500">Resonance Seed</p>
                  <p className="mt-1 font-mono text-xs text-gray-400 break-all">{evo.resonanceSeed}</p>
                </div>
              </div>
            ) : (
              <div>
                {evo.fractureLines.length > 0 ? (
                  <div className="space-y-2">
                    {evo.fractureLines.map((fl, i) => (
                      <div key={i} className="flex items-center gap-3 rounded-lg border border-[#1a1a1e] bg-[#131316] px-3 py-2 text-xs">
                        <span className="font-bold text-indigo-400">Trade #{fl.tradeNumber}</span>
                        <span className="font-mono text-gray-500">{fl.previousOwner}</span>
                        <span className="text-gray-600">{getAgeString(fl.timestamp)}</span>
                        <span className="ml-auto text-gray-500">intensity {fl.intensity}%</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="py-8 text-center text-sm text-gray-500">No trade history yet</p>
                )}
              </div>
            )}

            {/* Tx result */}
            {txResult && (
              <div className="rounded-lg border border-green-500/30 bg-green-500/10 p-3 text-sm">
                <span className="text-green-400 font-bold">✅ Confirmed </span>
                <a href={`https://solscan.io/tx/${txResult}`} target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:underline">View on Solscan →</a>
              </div>
            )}
            {error && <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400">❌ {error}</div>}

            {/* Owner actions */}
            {isOwner && !evo.isShattered && (
              <div className="space-y-3 border-t border-[#1a1a1e] pt-4">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Owner Actions</p>

                {/* Feed */}
                <div className="flex gap-2">
                  <input type="number" placeholder="Feed SOL" value={feedAmount} onChange={(e) => setFeedAmount(e.target.value)}
                    className="flex-1 rounded-lg border border-[#232328] bg-[#0a0a0b] px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-yellow-500 focus:outline-none" step="0.001" min="0.001" />
                  <button onClick={handleFeed} disabled={action === 'feed'}
                    className="rounded-lg bg-yellow-500/20 border border-yellow-500/40 px-4 py-2 text-sm font-medium text-yellow-400 hover:bg-yellow-500/30 transition-colors disabled:opacity-50">
                    {action === 'feed' ? '...' : 'Feed'}
                  </button>
                </div>

                {/* Transfer */}
                <div className="flex gap-2">
                  <input type="text" placeholder="Recipient address" value={transferAddress} onChange={(e) => setTransferAddress(e.target.value)}
                    className="flex-1 rounded-lg border border-[#232328] bg-[#0a0a0b] px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-blue-500 focus:outline-none" />
                  <button onClick={handleTransfer} disabled={action === 'transfer' || !transferAddress}
                    className="rounded-lg bg-blue-500/20 border border-blue-500/40 px-4 py-2 text-sm font-medium text-blue-400 hover:bg-blue-500/30 transition-colors disabled:opacity-50">
                    {action === 'transfer' ? '...' : 'Transfer'}
                  </button>
                </div>

                {/* Shatter */}
                <button onClick={handleShatter} disabled={action === 'shatter'}
                  className="w-full rounded-lg bg-red-500/10 border border-red-500/30 px-4 py-3 text-sm font-medium text-red-400 hover:bg-red-500/20 transition-colors disabled:opacity-50">
                  {action === 'shatter' ? 'Shattering...' : `💥 Shatter — recover ${(evo.lockedLamports * 0.95).toFixed(4)}◎`}
                </button>
              </div>
            )}

            {/* Not owner, not listed */}
            {!isOwner && !evo.isListed && !evo.isShattered && (
              <div className="rounded-lg border border-[#1a1a1e] bg-[#131316] p-4 text-center text-sm text-gray-500">
                This Z is not listed for sale
              </div>
            )}

            {evo.isShattered && (
              <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-4 text-center text-sm text-red-400">
                This Z has been shattered
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatBox({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="rounded-lg border border-[#1a1a1e] bg-[#131316] p-3">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="mt-1 text-lg font-bold font-mono" style={{ color }}>{value}</p>
    </div>
  );
}

function PropItem({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="rounded-lg border border-[#1a1a1e] bg-[#131316] p-3">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="mt-0.5 text-sm font-bold" style={color ? { color } : {}}>{value}</p>
    </div>
  );
}