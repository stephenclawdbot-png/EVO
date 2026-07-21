'use client';

import { useState, useEffect } from 'react';
import { fmtSolValue, fmtPctValue } from '@/lib/format';

const KITTEN_IMG = '/api/img?uri=' + encodeURIComponent('https://gateway.irys.xyz/9RppwtruTqYZQa1L7XvdGpJ1Di1WFzS8ez3XiwLnzmFD');
const CAT_IMG = '/api/img?uri=' + encodeURIComponent('https://gateway.irys.xyz/GnGeGEkbzQF4Uh9uXuBCJdNpAXj1h6SWXHXqwTnrffnq');

const FEED_THRESHOLD = 0.15; // SOL needed to evolve
const LOCKED_SOL = 0.05; // SOL inside the demo EVO

type Phase = 'adult' | 'evolved' | 'shattered';

export function DemoEvo() {
  const [phase, setPhase] = useState<Phase>('adult');
  const [fed, setFed] = useState(0);
  const [feeding, setFeeding] = useState(false);
  const [shattering, setShattering] = useState(false);
  const [imgError, setImgError] = useState(false);

  // Reset error latch when image changes
  useEffect(() => { setImgError(false); }, [phase]);

  const feedPct = Math.min(100, (fed / FEED_THRESHOLD) * 100);
  const totalValue = LOCKED_SOL + fed;

  const handleFeed = () => {
    if (phase === 'shattered' || feeding) return;
    setFeeding(true);
    const addAmount = 0.03;
    setTimeout(() => {
      setFed(prev => {
        const next = prev + addAmount;
        if (next >= FEED_THRESHOLD) {
          setTimeout(() => setPhase('evolved'), 300);
        }
        return next;
      });
      setFeeding(false);
    }, 400);
  };

  const handleShatter = () => {
    if (phase === 'shattered' || shattering) return;
    setShattering(true);
    setTimeout(() => {
      setPhase('shattered');
      setShattering(false);
    }, 600);
  };

  const handleReset = () => {
    setPhase('adult');
    setFed(0);
  };

  const img = phase === 'evolved' ? KITTEN_IMG : CAT_IMG;

  return (
    <div className="mx-auto w-full max-w-sm">
      <div className="relative overflow-hidden rounded-xl border border-border-strong bg-surface">
        {/* Sprite area */}
        <div className="relative flex aspect-[4/3] items-center justify-center overflow-hidden bg-bg">
          <div className="absolute inset-0" style={{
            background: phase === 'shattered'
              ? 'radial-gradient(circle at 50% 50%, #ef44441a, transparent 70%)'
              : 'radial-gradient(circle at 50% 45%, #818cf814, transparent 70%)'
          }} />

          {/* Glow */}
          {phase !== 'shattered' && (
            <div className="absolute inset-0" style={{
              background: `radial-gradient(circle at 50% 50%, #818cf820, transparent 60%)`,
              animation: 'evo-pulse 4s ease-in-out infinite alternate',
            }} />
          )}

          {phase === 'shattered' ? (
            <div className="relative z-10 flex flex-col items-center gap-2">
              <svg className="h-12 w-12 text-negative" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path d="M12 2 2 22h20L12 2z" /><path d="M12 9v4M12 17h.01" />
              </svg>
              <span className="font-mono text-xs font-bold uppercase tracking-wider text-negative">Shattered</span>
              <span className="font-mono tabular-nums text-[10px] text-positive">+{fmtSolValue(totalValue)} recovered</span>
            </div>
          ) : !imgError ? (
            <img src={img} alt={phase === 'evolved' ? 'Evolved kitten' : 'Adult cat'}
              className="relative z-[1] pixelated transition-all duration-500"
              style={{
                transform: `scale(${phase === 'evolved' ? 1.1 : 0.9})`,
                imageRendering: 'pixelated',
                filter: 'drop-shadow(0 0 8px #818cf880)',
              }}
              onError={() => setImgError(true)} />
          ) : (
            <div className="relative z-[1] flex h-20 w-20 items-center justify-center rounded border border-dashed border-border-strong text-[10px] text-dim">
              {phase === 'evolved' ? 'Kitten' : 'Cat'}
            </div>
          )}

          {/* Stage badge */}
          {phase !== 'shattered' && (
            <span className="absolute right-2 top-2 z-10 rounded px-1.5 py-0.5 font-mono text-[9px] font-bold backdrop-blur-sm" style={{
              background: phase === 'evolved' ? '#8b5cf620' : '#6366f120',
              color: phase === 'evolved' ? '#a78bfa' : '#818cf8',
            }}>
              {phase === 'evolved' ? 'S1 · Kitten' : 'S0 · Adult'}
            </span>
          )}

          {/* Locked SOL badge */}
          {phase !== 'shattered' && (
            <span className="absolute left-2 top-2 z-10 rounded bg-bg/70 px-1.5 py-0.5 font-mono text-[9px] text-positive backdrop-blur-sm">
              {fmtSolValue(LOCKED_SOL)} locked
            </span>
          )}
        </div>

        {/* Stats + controls */}
        <div className="space-y-3 p-4">
          {phase !== 'shattered' && (
            <>
              {/* Value */}
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-dim">Total value</span>
                <span className="font-mono tabular-nums text-sm font-bold text-positive">{fmtSolValue(totalValue)} SOL</span>
              </div>

              {/* Feed progress */}
              <div>
                <div className="flex items-center justify-between text-[10px] text-dim">
                  <span>Fed {fmtSolValue(fed)}/{fmtSolValue(FEED_THRESHOLD)} SOL</span>
                  <span>{fmtPctValue(feedPct)}%</span>
                </div>
                <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
                  <div className="h-full rounded-full bg-accent transition-all duration-500" style={{ width: `${feedPct}%` }} />
                </div>
              </div>

              {/* Buttons */}
              <div className="flex gap-2">
                <button
                  onClick={handleFeed}
                  disabled={feeding || phase === 'evolved'}
                  className="flex-1 rounded border border-accent bg-accent px-3 py-1.5 text-xs font-bold text-white transition-all hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {phase === 'evolved' ? 'Evolved ✓' : feeding ? 'Feeding…' : `Feed +0.03 SOL`}
                </button>
                <button
                  onClick={handleShatter}
                  disabled={shattering}
                  className="flex-1 rounded border border-negative/40 bg-negative-soft px-3 py-1.5 text-xs font-bold text-negative transition-all hover:bg-negative/10 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {shattering ? 'Smashing…' : '💔 Shatter'}
                </button>
              </div>

              {phase === 'evolved' && (
                <p className="text-center text-[10px] text-accent">
                  Your EVO transformed! Shatter to recover {fmtSolValue(totalValue)}.
                </p>
              )}
            </>
          )}

          {phase === 'shattered' && (
            <button
              onClick={handleReset}
              className="w-full rounded border border-border-strong bg-surface px-3 py-1.5 text-xs font-bold text-text transition-all hover:border-accent"
            >
              ↻ Forge a new demo EVO
            </button>
          )}

          <p className="text-center text-[9px] text-dim">
            Demo only — no wallet or real SOL needed
          </p>
        </div>
      </div>
    </div>
  );
}