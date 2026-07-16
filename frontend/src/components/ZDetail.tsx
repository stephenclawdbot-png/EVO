'use client';

import { EVOData, getStage, getAgeString } from '@/lib/evo-data';
import { ELEMENT_COLORS, RARITY_COLORS, STAGE_NAMES, Stage } from '@/lib/creatures';
import { useState } from 'react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
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

  const stage = getStage(evo);
  const elementColor = ELEMENT_COLORS[evo.creature.element];
  const rarityColor = RARITY_COLORS[evo.creature.rarity];
  const scale = 0.6 + Math.min(1, evo.lockedLamports / 50) * 0.4;
  const stages: Stage[] = ['baby', 'juvenile', 'adult', 'elder'];
  const currentStageIndex = stages.indexOf(stage);

  const isOwner = wallet.connected && wallet.publicKey && 
    evo.owner === wallet.publicKey.toBase58();

  const sendTx = async (ix: any) => {
    if (!wallet.connected || !wallet.publicKey) {
      setError('Connect wallet first');
      return null;
    }
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
    setAction('feed');
    setError(null);
    setTxResult(null);
    try {
      const lamports = Math.floor(parseFloat(feedAmount) * LAMPORTS_PER_SOL);
      if (!lamports || lamports <= 0) throw new Error('Enter a valid SOL amount');
      const evoPda = new PublicKey(evo.evoPda!);
      const ix = createFeedIx(evoPda, wallet.publicKey!, lamports);
      const sig = await sendTx(ix);
      if (sig) {
        setTxResult(sig);
        setFeedAmount('');
        onRefresh?.();
      }
    } catch (err: any) {
      setError(err.message || 'Feed failed');
    } finally {
      setAction(null);
    }
  };

  const handleList = async () => {
    setAction('list');
    setError(null);
    setTxResult(null);
    try {
      const lamports = Math.floor(parseFloat(listPrice) * LAMPORTS_PER_SOL);
      if (!lamports || lamports <= 0) throw new Error('Enter a valid price');
      const evoPda = new PublicKey(evo.evoPda!);
      const ix = createListIx(evoPda, wallet.publicKey!, lamports);
      const sig = await sendTx(ix);
      if (sig) {
        setTxResult(sig);
        setListPrice('');
        onRefresh?.();
      }
    } catch (err: any) {
      setError(err.message || 'List failed');
    } finally {
      setAction(null);
    }
  };

  const handleDelist = async () => {
    setAction('delist');
    setError(null);
    setTxResult(null);
    try {
      const evoPda = new PublicKey(evo.evoPda!);
      const ix = createDelistIx(evoPda, wallet.publicKey!);
      const sig = await sendTx(ix);
      if (sig) {
        setTxResult(sig);
        onRefresh?.();
      }
    } catch (err: any) {
      setError(err.message || 'Delist failed');
    } finally {
      setAction(null);
    }
  };

  const handleBuy = async () => {
    setAction('buy');
    setError(null);
    setTxResult(null);
    try {
      const evoPda = new PublicKey(evo.evoPda!);
      const [collectionPda] = getCollectionPDA('Z');
      const cfg = await readCollectionConfig(connection, 'Z');
      if (!cfg) throw new Error('Collection not found');
      const proto = await readProtocolConfig(connection);
      if (!proto) throw new Error('Protocol not found');
      const seller = new PublicKey(evo.owner);
      const creator = cfg.creator;
      const ix = createBuyIx(
        evoPda,
        collectionPda,
        seller,
        creator,
        wallet.publicKey!,
        proto.treasury,
      );
      const sig = await sendTx(ix);
      if (sig) {
        setTxResult(sig);
        onRefresh?.();
      }
    } catch (err: any) {
      setError(err.message || 'Buy failed');
    } finally {
      setAction(null);
    }
  };

  const handleShatter = async () => {
    if (!confirm(`Shatter this Z and recover ${(evo.lockedLamports * 0.95).toFixed(4)} SOL (after 5% fee)? This cannot be undone.`)) return;
    setAction('shatter');
    setError(null);
    setTxResult(null);
    try {
      const evoPda = new PublicKey(evo.evoPda!);
      const [collectionPda] = getCollectionPDA('Z');
      const cfg = await readCollectionConfig(connection, 'Z');
      if (!cfg) throw new Error('Collection not found');
      const proto = await readProtocolConfig(connection);
      if (!proto) throw new Error('Protocol not found');
      const ix = createShatterIx(
        evoPda,
        collectionPda,
        wallet.publicKey!,
        cfg.creator,
        proto.treasury,
        evo.id,
      );
      const sig = await sendTx(ix);
      if (sig) {
        setTxResult(sig);
        onRefresh?.();
      }
    } catch (err: any) {
      setError(err.message || 'Shatter failed');
    } finally {
      setAction(null);
    }
  };

  const handleTransfer = async () => {
    setAction('transfer');
    setError(null);
    setTxResult(null);
    try {
      const newOwner = new PublicKey(transferAddress);
      const evoPda = new PublicKey(evo.evoPda!);
      const ix = createTransferIx(evoPda, wallet.publicKey!, newOwner);
      const sig = await sendTx(ix);
      if (sig) {
        setTxResult(sig);
        setTransferAddress('');
        onRefresh?.();
      }
    } catch (err: any) {
      setError(err.message || 'Transfer failed');
    } finally {
      setAction(null);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-950 to-black p-4 md:p-8">
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
        >
          ← Back to Gallery
        </button>
        <WalletMultiButton className="!bg-gradient-to-r !from-purple-500 !to-blue-500 !rounded-lg !text-sm !font-bold !text-white !border-0 hover:!opacity-90 !h-9 !px-3" />
      </div>

      <div className="grid gap-8 md:grid-cols-2">
        {/* Left: Art display */}
        <div className="relative">
          <div
            className="relative flex aspect-square items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-b from-gray-900 to-gray-950"
            style={{ boxShadow: evo.isListed ? `0 0 40px ${elementColor}40` : 'none' }}
          >
            {/* Element glow */}
            <div
              className="absolute inset-0"
              style={{
                background: `radial-gradient(circle at 50% 50%, ${elementColor}20, transparent 60%)`,
              }}
            />

            {/* Fracture lines */}
            {evo.fractureLines.length > 0 && (
              <svg className="absolute inset-0 h-full w-full" viewBox="0 0 400 400">
                {evo.fractureLines.map((fl, i) => {
                  const angle = (fl.position * Math.PI) / 180;
                  const cx = 200;
                  const cy = 200;
                  const len = 60 + (fl.intensity / 100) * 80;
                  const x2 = cx + Math.cos(angle) * len;
                  const y2 = cy + Math.sin(angle) * len;
                  return (
                    <g key={i}>
                      <line
                        x1={cx}
                        y1={cy}
                        x2={x2}
                        y2={y2}
                        stroke="rgba(255,255,255,0.4)"
                        strokeWidth={fl.intensity > 50 ? 2 : 1}
                        strokeLinecap="round"
                      />
                      <text
                        x={x2 + 5}
                        y={y2}
                        fill="rgba(255,255,255,0.3)"
                        fontSize="8"
                      >
                        #{fl.tradeNumber}
                      </text>
                    </g>
                  );
                })}
              </svg>
            )}

            {/* Sprite */}
            {!imgError ? (
              <img
                src={evo.creature.stages[stage]}
                alt={evo.creature.displayName}
                className="relative z-[1]"
                style={{
                  transform: `scale(${scale * 1.5})`,
                  imageRendering: 'pixelated',
                  filter: evo.isListed
                    ? `drop-shadow(0 0 16px ${elementColor})`
                    : `drop-shadow(0 0 8px ${elementColor}80)`,
                }}
                onError={() => setImgError(true)}
              />
            ) : (
              <div className="text-gray-500">Image not found</div>
            )}

            {/* Listed pulse */}
            {evo.isListed && (
              <div className="absolute top-4 right-4 animate-pulse rounded-full bg-green-500/90 px-3 py-1 text-sm font-bold text-black">
                FOR SALE: {evo.listPrice}◎
              </div>
            )}
          </div>

          {/* Evolution stages preview */}
          <div className="mt-4 grid grid-cols-4 gap-2">
            {stages.map((s, i) => (
              <div
                key={s}
                className={`relative flex aspect-square items-center justify-center rounded-lg border-2 overflow-hidden ${
                  i === currentStageIndex
                    ? 'border-yellow-400 bg-yellow-400/10'
                    : i < currentStageIndex
                    ? 'border-white/20 opacity-50'
                    : 'border-white/5 opacity-20'
                }`}
              >
                <img
                  src={evo.creature.stages[s]}
                  alt={s}
                  className="h-12 w-12"
                  style={{ imageRendering: 'pixelated' }}
                />
                <span className="absolute bottom-0 left-0 right-0 bg-black/60 text-center text-xs">
                  {STAGE_NAMES[s]}
                </span>
                {i < currentStageIndex && (
                  <span className="absolute top-0 right-0 text-xs text-green-400">✓</span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Right: EVO data */}
        <div className="space-y-6">
          {/* Header */}
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold text-white">{evo.creature.displayName}</h1>
              <span
                className="rounded-lg px-3 py-1 text-sm font-bold"
                style={{ color: rarityColor, backgroundColor: `${rarityColor}20` }}
              >
                {evo.creature.rarity}
              </span>
            </div>
            <div className="mt-2 flex items-center gap-3 text-lg">
              <span style={{ color: elementColor }}>● {evo.creature.element}</span>
              <span className="text-gray-600">|</span>
              <span className="text-gray-400">Stage: {STAGE_NAMES[stage]}</span>
            </div>
            <div className="mt-1 text-xs text-gray-500">
              Z #{evo.id} · Owner: {evo.owner.slice(0, 8)}...{evo.owner.slice(-4)}
            </div>
          </div>

          {/* EVO Stats */}
          <div className="grid grid-cols-2 gap-4">
            <StatCard label="Locked SOL" value={`${evo.lockedLamports}◎`} color="#FCD34D" />
            <StatCard label="Facets" value={`${evo.facetCount}/100`} color="#60A5FA" />
            <StatCard label="Trades" value={`${evo.tradeCount}`} color="#A78BFA" />
            <StatCard label="Age" value={getAgeString(evo.forgedAt)} color="#34D399" />
          </div>

          {/* Resonance Seed */}
          <div className="rounded-xl border border-white/10 bg-gray-900/50 p-4">
            <p className="text-xs text-gray-500">Resonance Seed</p>
            <p className="mt-1 font-mono text-sm text-gray-300 break-all">
              {evo.resonanceSeed}
            </p>
          </div>

          {/* Fracture History */}
          {evo.fractureLines.length > 0 && (
            <div className="rounded-xl border border-white/10 bg-gray-900/50 p-4">
              <h3 className="mb-3 text-sm font-bold text-white">Fracture History ({evo.fractureLines.length})</h3>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {evo.fractureLines.map((fl, i) => (
                  <div key={i} className="flex items-center gap-3 text-xs">
                    <span className="font-bold text-purple-400">#{fl.tradeNumber}</span>
                    <span className="font-mono text-gray-500">{fl.previousOwner}</span>
                    <span className="text-gray-600">{getAgeString(fl.timestamp)}</span>
                    <span className="ml-auto text-gray-500">intensity: {fl.intensity}%</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tx result */}
          {txResult && (
            <div className="rounded-xl border border-green-500/30 bg-green-500/10 p-3 text-sm">
              <span className="text-green-400 font-bold">✅ Transaction confirmed </span>
              <a href={`https://solscan.io/tx/${txResult}`} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">
                View on Solscan →
              </a>
            </div>
          )}
          {error && (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400">
              ❌ {error}
            </div>
          )}

          {/* Actions */}
          {!wallet.connected ? (
            <p className="rounded-xl border border-white/10 bg-gray-900/50 p-4 text-center text-sm text-gray-500">
              Connect wallet to interact with this Z
            </p>
          ) : evo.isShattered ? (
            <p className="rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-center text-sm text-red-400">
              This Z has been shattered
            </p>
          ) : isOwner ? (
            <div className="space-y-3">
              {/* Feed */}
              <div className="flex gap-2">
                <input
                  type="number"
                  placeholder="SOL to feed"
                  value={feedAmount}
                  onChange={(e) => setFeedAmount(e.target.value)}
                  className="flex-1 rounded-lg border border-white/10 bg-gray-900 px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-yellow-500 focus:outline-none"
                  step="0.001"
                  min="0.001"
                />
                <button
                  onClick={handleFeed}
                  disabled={action === 'feed'}
                  className="rounded-xl bg-yellow-500/20 border border-yellow-500/40 px-4 py-2 font-bold text-yellow-400 hover:bg-yellow-500/30 transition-colors disabled:opacity-50"
                >
                  {action === 'feed' ? '...' : '🔨 Feed'}
                </button>
              </div>

              {/* List / Delist */}
              {evo.isListed ? (
                <button
                  onClick={handleDelist}
                  disabled={action === 'delist'}
                  className="w-full rounded-xl bg-gray-500/20 border border-gray-500/40 px-4 py-3 font-bold text-gray-300 hover:bg-gray-500/30 transition-colors disabled:opacity-50"
                >
                  {action === 'delist' ? '...' : '✕ Delist'}
                </button>
              ) : (
                <div className="flex gap-2">
                  <input
                    type="number"
                    placeholder="List price (SOL)"
                    value={listPrice}
                    onChange={(e) => setListPrice(e.target.value)}
                    className="flex-1 rounded-lg border border-white/10 bg-gray-900 px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-green-500 focus:outline-none"
                    step="0.01"
                    min="0.01"
                  />
                  <button
                    onClick={handleList}
                    disabled={action === 'list'}
                    className="rounded-xl bg-green-500/20 border border-green-500/40 px-4 py-2 font-bold text-green-400 hover:bg-green-500/30 transition-colors disabled:opacity-50"
                  >
                    {action === 'list' ? '...' : '🏷️ List'}
                  </button>
                </div>
              )}

              {/* Transfer */}
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Recipient address"
                  value={transferAddress}
                  onChange={(e) => setTransferAddress(e.target.value)}
                  className="flex-1 rounded-lg border border-white/10 bg-gray-900 px-3 py-2 text-sm text-white placeholder-gray-600 focus:border-blue-500 focus:outline-none"
                />
                <button
                  onClick={handleTransfer}
                  disabled={action === 'transfer' || !transferAddress}
                  className="rounded-xl bg-blue-500/20 border border-blue-500/40 px-4 py-2 font-bold text-blue-400 hover:bg-blue-500/30 transition-colors disabled:opacity-50"
                >
                  {action === 'transfer' ? '...' : '📤 Transfer'}
                </button>
              </div>

              {/* Shatter */}
              <button
                onClick={handleShatter}
                disabled={action === 'shatter'}
                className="w-full rounded-xl bg-red-500/20 border border-red-500/40 px-4 py-3 font-bold text-red-400 hover:bg-red-500/30 transition-colors disabled:opacity-50"
              >
                {action === 'shatter' ? '...' : `💥 Shatter (recover ~${(evo.lockedLamports * 0.95).toFixed(4)}◎)`}
              </button>
            </div>
          ) : evo.isListed ? (
            <button
              onClick={handleBuy}
              disabled={action === 'buy'}
              className="w-full rounded-xl bg-gradient-to-r from-green-500 to-emerald-500 px-4 py-4 text-lg font-bold text-black transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {action === 'buy' ? 'Buying...' : `🛒 Buy for ${evo.listPrice}◎`}
            </button>
          ) : (
            <p className="rounded-xl border border-white/10 bg-gray-900/50 p-4 text-center text-sm text-gray-500">
              This Z is not listed for sale
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-gray-900/50 p-4">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="mt-1 text-xl font-bold" style={{ color }}>{value}</p>
    </div>
  );
}