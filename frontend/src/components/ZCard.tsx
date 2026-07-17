'use client';

import { EVOData, getStage } from '@/lib/evo-data';
import { ELEMENT_COLORS, RARITY_COLORS } from '@/lib/creatures';
import { useState, useEffect } from 'react';
import { resolveImage } from '@/lib/evo-visuals';

interface ZCardProps {
  evo: EVOData;
  onClick?: () => void;
  isFloor?: boolean;
  metadataUri?: string;
  isRevealed?: boolean;
}

export function ZCard({ evo, onClick, isFloor, metadataUri, isRevealed }: ZCardProps) {
  const [imgError, setImgError] = useState(false);
  const [resolvedImage, setResolvedImage] = useState<string | null>(null);
  const stage = getStage(evo);
  const elementColor = ELEMENT_COLORS[evo.creature.element];
  const rarityColor = RARITY_COLORS[evo.creature.rarity];
  const fallbackSprite = evo.creature.stages[stage];
  const sprite = resolvedImage || fallbackSprite;
  const scale = 0.6 + Math.min(1, evo.lockedLamports / 50) * 0.4;

  useEffect(() => {
    if (!metadataUri) { setResolvedImage(null); return; }
    let active = true;
    resolveImage(metadataUri, fallbackSprite, evo.currentState, isRevealed).then(img => {
      if (active) setResolvedImage(img);
    });
    return () => { active = false; };
  }, [metadataUri, fallbackSprite, evo.currentState, isRevealed]);

  return (
    <div
      onClick={onClick}
      className="t-row group relative cursor-pointer overflow-hidden rounded border border-border bg-surface"
    >
      {/* Art — prominent */}
      <div className="relative flex aspect-square items-center justify-center overflow-hidden bg-bg">
        <div className="absolute inset-0" style={{ background: `radial-gradient(circle at 50% 45%, ${elementColor}14, transparent 70%)` }} />

        {/* Z# top-left */}
        <span className="absolute left-1.5 top-1.5 z-10 rounded bg-bg/70 px-1 font-mono text-[10px] text-muted backdrop-blur-sm">
          #{evo.id}
        </span>

        {/* Rarity bar top-right */}
        <div className="absolute right-1.5 top-1.5 z-10 flex items-center gap-1 rounded bg-bg/70 px-1.5 py-0.5 backdrop-blur-sm">
          <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: rarityColor }} />
          <span className="text-[10px] text-muted">{evo.creature.rarity}</span>
        </div>

        {/* Floor tag */}
        {isFloor && evo.isListed && (
          <span className="absolute bottom-1.5 left-1.5 z-10 rounded bg-positive px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-[#0a0a0b]">
            Floor
          </span>
        )}

        {/* Shattered overlay */}
        {evo.isShattered && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-bg/90">
            <span className="font-mono text-[11px] font-bold uppercase tracking-wider text-negative">Shattered</span>
          </div>
        )}

        {/* Fracture lines */}
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

        {/* Sprite */}
        {!imgError ? (
          <img src={sprite} alt={evo.creature.displayName} className="relative z-[1] pixelated"
            style={{ transform: `scale(${scale})`, imageRendering: 'pixelated', filter: `drop-shadow(0 0 5px ${elementColor}50)` }}
            onError={() => setImgError(true)} />
        ) : (
          <div className="relative z-[1] flex h-16 w-16 items-center justify-center rounded border border-dashed border-border-strong text-[10px] text-dim">
            {evo.creature.displayName}
          </div>
        )}

        {/* Listed price overlay on hover */}
        {evo.isListed && !evo.isShattered && (
          <div className="absolute inset-x-0 bottom-0 z-20 translate-y-full bg-positive/95 py-1.5 text-center font-mono text-sm font-bold text-[#0a0a0b] transition-transform duration-100 group-hover:translate-y-0">
            {evo.listPrice} SOL
          </div>
        )}
      </div>

      {/* Info bar — minimal, art-forward */}
      <div className="px-2 py-1.5">
        <div className="flex items-center justify-between gap-1">
          <h3 className="truncate text-xs font-medium text-text">{evo.creature.displayName}</h3>
          {evo.isListed ? (
            <span className="shrink-0 font-mono text-xs font-bold text-positive">{evo.listPrice}</span>
          ) : (
            <span className="shrink-0 font-mono text-[11px] text-dim">{evo.tradeCount}x</span>
          )}
        </div>
        <div className="mt-0.5 flex items-center justify-between text-[10px] text-dim">
          <span className="font-mono">{evo.lockedLamports} locked</span>
          <span className="capitalize" style={{ color: elementColor }}>{evo.creature.element}</span>
        </div>
      </div>
    </div>
  );
}
