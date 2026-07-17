'use client';

import { EVOData } from '@/lib/evo-data';
import { useState, useEffect } from 'react';
import { resolveImage } from '@/lib/evo-visuals';

interface EvoCardProps {
  evo: EVOData;
  onClick?: () => void;
  isFloor?: boolean;
  metadataUri?: string;
  isRevealed?: boolean;
}

export function EvoCard({ evo, onClick, isFloor, metadataUri, isRevealed }: EvoCardProps) {
  const [imgError, setImgError] = useState(false);
  const [resolvedImage, setResolvedImage] = useState<string | null>(null);

  useEffect(() => {
    if (!metadataUri) { setResolvedImage(null); return; }
    let active = true;
    resolveImage(metadataUri, '/placeholder.png', evo.currentState, isRevealed, evo.id).then(img => {
      if (active) setResolvedImage(img);
    });
    return () => { active = false; };
  }, [metadataUri, evo.currentState, isRevealed, evo.id]);

  const sprite = resolvedImage || '/placeholder.png';
  const scale = 0.6 + Math.min(1, evo.lockedLamports / 50) * 0.4;

  return (
    <div
      onClick={onClick}
      className="t-row group relative cursor-pointer overflow-hidden rounded border border-border bg-surface"
    >
      <div className="relative flex aspect-square items-center justify-center overflow-hidden bg-bg">
        <div className="absolute inset-0" style={{ background: `radial-gradient(circle at 50% 45%, #818cf814, transparent 70%)` }} />

        <span className="absolute left-1.5 top-1.5 z-10 rounded bg-bg/70 px-1 font-mono text-[10px] text-muted backdrop-blur-sm">
          #{evo.id}
        </span>

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

        {evo.fractureLines.length > 0 && !evo.isShattered && (
          <svg className="absolute inset-0 h-full w-full" viewBox="0 0 192 192">
            {evo.fractureLines.slice(0, 8).map((fl, i) => {
              const angle = (fl.position * Math.PI) / 180;
              const cx = 96, cy = 96;
              const len = 25 + (fl.intensity / 100) * 35;
              return (
                <line key={i} x1={cx} y1={cy}
                  x2={cx + Math.cos(angle) * len} y2={cy + Math.sin(angle) * len}
                  stroke="rgba(255,255,255,0.18)" strokeWidth={fl.intensity > 50 ? 1.5 : 0.8} strokeLinecap="round" />
              );
            })}
          </svg>
        )}

        {!imgError ? (
          <img src={sprite} alt={evo.name} className="relative z-[1] pixelated"
            style={{ transform: `scale(${scale})`, imageRendering: 'pixelated' }}
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
            <span className="shrink-0 font-mono text-xs font-bold text-positive">{evo.listPrice}</span>
          ) : (
            <span className="shrink-0 font-mono text-[11px] text-dim">{evo.tradeCount}x</span>
          )}
        </div>
        <div className="mt-0.5 flex items-center justify-between text-[10px] text-dim">
          <span className="font-mono">{evo.lockedLamports} locked</span>
          <span className="font-mono">S{evo.currentState}</span>
        </div>
      </div>
    </div>
  );
}