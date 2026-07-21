'use client';

import { EVOData } from '@/lib/evo-data';
import { useState, useEffect } from 'react';
import { resolveImage } from '@/lib/evo-visuals';
import { fmtSolValue, fmtPctValue } from '@/lib/format';
import Link from 'next/link';

interface EvoCardProps {
  evo: EVOData;
  onClick?: () => void;
  isFloor?: boolean;
  metadataUri?: string;
  isRevealed?: boolean;
  href?: string;
  /** Locked SOL for this EVO (for floor-coverage display) */
  lockedSol?: number;
  /** Evolution thresholds for progress display */
  evolveFeedThreshold?: number;
  evolveLockedThreshold?: number;
  evolveHoldSeconds?: number;
}

// Stage-based color themes for generative effects
const STAGE_COLORS = [
  { glow: '#818cf8', accent: '#6366f1', bg: '#818cf814' },     // State 0 — indigo
  { glow: '#a78bfa', accent: '#8b5cf6', bg: '#a78bfa14' },     // State 1 — violet
  { glow: '#f472b6', accent: '#ec4899', bg: '#f472b614' },     // State 2 — pink
  { glow: '#fb923c', accent: '#f97316', bg: '#fb923c14' },     // State 3 — orange
  { glow: '#fbbf24', accent: '#f59e0b', bg: '#fbbf2414' },     // State 4 — amber
  { glow: '#34d399', accent: '#10b981', bg: '#34d39914' },     // State 5 — emerald
  { glow: '#22d3ee', accent: '#06b6d4', bg: '#22d3ee14' },     // State 6 — cyan
  { glow: '#f87171', accent: '#ef4444', bg: '#f8717114' },     // State 7+ — red
];

export function EvoCard({ evo, onClick, isFloor, metadataUri, isRevealed, href, lockedSol, evolveFeedThreshold, evolveLockedThreshold, evolveHoldSeconds }: EvoCardProps) {
  const [imgError, setImgError] = useState(false);
  const [resolvedImage, setResolvedImage] = useState<string | null>(null);

  useEffect(() => {
    if (!metadataUri) { setResolvedImage(null); return; }
    let active = true;
    resolveImage(metadataUri, '/placeholder.png', evo.currentState, isRevealed, evo.id).then(img => {
      if (active) setResolvedImage(img);
    }).catch((e) => {
      console.error('EvoCard: resolveImage failed:', e);
      if (active) setResolvedImage('/placeholder.png');
    });
    return () => { active = false; };
  }, [metadataUri, evo.currentState, isRevealed, evo.id]);

  const sprite = resolvedImage || '/placeholder.png';

  // Un-latch the image error when the source changes — otherwise one failed
  // load (e.g. placeholder before the manifest resolves) hides the real image forever.
  useEffect(() => { setImgError(false); }, [sprite]);
  const stageIdx = Math.min(evo.currentState, STAGE_COLORS.length - 1);
  const theme = STAGE_COLORS[stageIdx];

  // Scale grows with locked SOL — 0.6x at 0 SOL, 1.0x at 50+ SOL
  const scale = 0.6 + Math.min(1, evo.lockedLamports / 50) * 0.4;

  // Glow intensity grows with locked SOL
  const glowIntensity = Math.min(1, evo.lockedLamports / 100);
  const glowSize = 20 + glowIntensity * 40;

  // Trade count influences fracture density
  const fractureOpacity = Math.min(0.4, evo.tradeCount * 0.05);

  // Floor-coverage: backed SOL and percentage of ask
  const backedSol = evo.lockedLamports; // already in SOL
  const askSol = evo.isListed ? (evo.listPrice ?? 0) : 0;
  const backedPct = askSol > 0 ? (backedSol / askSol) * 100 : 0;
  const maxLoss = askSol - backedSol;
  const belowFloor = evo.isListed && askSol > 0 && askSol < backedSol;

  // Evolution progress
  const LAMPORTS_PER_SOL = 1_000_000_000;
  const fedSol = evo.totalFedLamports / LAMPORTS_PER_SOL;
  const feedThresholdSol = evolveFeedThreshold ? evolveFeedThreshold / LAMPORTS_PER_SOL : 0;
  const lockedThresholdSol = evolveLockedThreshold ? evolveLockedThreshold / LAMPORTS_PER_SOL : 0;
  const showEvolveProgress = feedThresholdSol > 0 && !evo.isShattered;
  const feedPct = showEvolveProgress ? Math.min(100, (fedSol / feedThresholdSol) * 100) : 0;
  const lockedMet = lockedThresholdSol > 0 && backedSol >= lockedThresholdSol;
  const readyToEvolve = showEvolveProgress && feedPct >= 100 && lockedMet;

  const cardContent = (
    <>
      <div className="relative flex aspect-square items-center justify-center overflow-hidden bg-bg">
        {/* Stage-colored radial glow background */}
        <div className="absolute inset-0" style={{
          background: `radial-gradient(circle at 50% 45%, ${theme.bg}, transparent 70%)`
        }} />

        {/* Animated outer glow based on locked SOL */}
        {glowIntensity > 0.1 && !evo.isShattered && (
          <div className="absolute inset-0" style={{
            background: `radial-gradient(circle at 50% 50%, ${theme.glow}${Math.round(glowIntensity * 30).toString(16).padStart(2, '0')}, transparent ${glowSize * 1.5}%)`,
            animation: `evo-pulse ${3 - glowIntensity}s ease-in-out infinite alternate`,
          }} />
        )}

        {/* ID badge */}
        <span className="absolute left-1.5 top-1.5 z-10 rounded bg-bg/70 px-1 font-mono text-[10px] text-muted backdrop-blur-sm">
          #{evo.id}
        </span>

        {/* Stage badge */}
        <span className="absolute right-1.5 top-1.5 z-10 rounded px-1 py-0.5 font-mono text-[9px] font-bold backdrop-blur-sm" style={{
          background: `${theme.accent}20`,
          color: theme.glow,
        }}>
          S{evo.currentState}
        </span>

        {/* Below-floor arbitrage badge */}
        {belowFloor && (
          <span className="absolute left-1.5 top-7 z-10 rounded bg-warning px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wide text-[#0a0a0b]">
            Below Floor
          </span>
        )}

        {/* Ready-to-evolve badge */}
        {readyToEvolve && (
          <span className="absolute right-1.5 top-7 z-10 rounded bg-accent px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wide text-white">
            Ready
          </span>
        )}

        {isFloor && evo.isListed && (
          <span className="absolute bottom-1.5 left-1.5 z-10 rounded bg-positive px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-[#0a0a0b]">
            Floor
          </span>
        )}

        {evo.isShattered && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-bg/90">
            <span className="font-mono text-[11px] font-bold uppercase tracking-wider text-negative">Shattered</span>
          </div>
        )}

        {/* Fracture lines — density based on trade count */}
        {evo.fractureLines.length > 0 && !evo.isShattered && (
          <svg className="absolute inset-0 h-full w-full" viewBox="0 0 192 192" style={{ opacity: fractureOpacity + 0.1 }}>
            {evo.fractureLines.slice(0, 8).map((fl, i) => {
              const angle = (fl.position * Math.PI) / 180;
              const cx = 96, cy = 96;
              const len = 25 + (fl.intensity / 100) * 35;
              return (
                <line key={i} x1={cx} y1={cy}
                  x2={cx + Math.cos(angle) * len} y2={cy + Math.sin(angle) * len}
                  stroke={theme.glow} strokeWidth={fl.intensity > 50 ? 1.5 : 0.8} strokeLinecap="round"
                  style={{ opacity: 0.3 + (fl.intensity / 100) * 0.5 }} />
              );
            })}
          </svg>
        )}

        {!imgError ? (
          <img src={sprite} alt={evo.name} className="relative z-[1] pixelated"
            style={{
              transform: `scale(${scale})`,
              imageRendering: 'pixelated',
              filter: glowIntensity > 0.3 ? `drop-shadow(0 0 ${glowSize * 0.3}px ${theme.glow}80)` : 'none',
            }}
            onError={() => setImgError(true)} />
        ) : (
          <div className="relative z-[1] flex h-16 w-16 items-center justify-center rounded border border-dashed border-border-strong text-[10px] text-dim">
            {evo.name}
          </div>
        )}

        {evo.isListed && !evo.isShattered && (
          <div className="absolute inset-x-0 bottom-0 z-20 translate-y-full bg-positive/95 py-1.5 text-center font-mono text-sm font-bold text-[#0a0a0b] transition-transform duration-100 group-hover:translate-y-0">
            {evo.listPrice} SOL
          </div>
        )}
      </div>

      <div className="px-2 py-1.5">
        <div className="flex items-center justify-between gap-1">
          <h3 className="truncate text-xs font-medium text-text">{evo.name}</h3>
          {evo.isListed ? (
            <span className={`shrink-0 font-mono text-xs font-bold ${belowFloor ? 'text-warning' : 'text-positive'}`}>{evo.listPrice}</span>
          ) : (
            <span className="shrink-0 font-mono text-[11px] text-dim">{evo.tradeCount}x</span>
          )}
        </div>
        <div className="mt-0.5 flex items-center justify-between text-[10px] text-dim">
          <span className="font-mono tabular-nums">{fmtSolValue(evo.lockedLamports)} locked</span>
          <span className="font-mono" style={{ color: theme.glow }}>S{evo.currentState}</span>
        </div>

        {/* Floor-coverage line on listed cards */}
        {evo.isListed && !evo.isShattered && askSol > 0 && (
          <div className="mt-0.5 text-[9px] text-dim">
            <span className="font-mono tabular-nums text-positive">backed {fmtSolValue(backedSol)}</span>
            <span className="mx-0.5">·</span>
            <span className="font-mono tabular-nums">{fmtPctValue(backedPct)}%</span>
            <span className="mx-0.5">·</span>
            <span className={`font-mono tabular-nums ${maxLoss < 0 ? 'text-positive' : 'text-negative'}`}>
              {maxLoss < 0 ? `+${Math.abs(maxLoss).toFixed(3)}` : `−${maxLoss.toFixed(3)}`} max
            </span>
          </div>
        )}

        {/* Evolution progress bar */}
        {showEvolveProgress && feedPct < 100 && (
          <div className="mt-1">
            <div className="flex items-center justify-between text-[8px] text-dim">
              <span className="font-mono tabular-nums">{fmtSolValue(fedSol)}/{fmtSolValue(feedThresholdSol)} SOL fed</span>
              <span className="font-mono tabular-nums">{fmtPctValue(feedPct)}%</span>
            </div>
            <div className="mt-0.5 h-1 w-full overflow-hidden rounded-full bg-surface-2">
              <div className="h-full rounded-full transition-all duration-500" style={{
                width: `${feedPct}%`,
                background: theme.glow,
              }} />
            </div>
          </div>
        )}
      </div>
    </>
  );

  const className = "t-row group relative cursor-pointer overflow-hidden rounded border border-border bg-surface";

  if (href) {
    return (
      <Link href={href} onClick={onClick} className={className}>
        {cardContent}
      </Link>
    );
  }

  return (
    <div onClick={onClick} className={className}>
      {cardContent}
    </div>
  );
}