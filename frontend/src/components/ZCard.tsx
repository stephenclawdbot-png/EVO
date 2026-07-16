'use client';

import { EVOData, getStage, getAgeString } from '@/lib/evo-data';
import { ELEMENT_COLORS, RARITY_COLORS, STAGE_NAMES } from '@/lib/creatures';
import { useState } from 'react';

interface ZCardProps {
  evo: EVOData;
  onClick?: () => void;
}

export function ZCard({ evo, onClick }: ZCardProps) {
  const [imgError, setImgError] = useState(false);
  const stage = getStage(evo);
  const elementColor = ELEMENT_COLORS[evo.creature.element];
  const rarityColor = RARITY_COLORS[evo.creature.rarity];
  const sprite = evo.creature.stages[stage];
  const scale = 0.6 + Math.min(1, evo.lockedLamports / 50) * 0.4;

  return (
    <div
      onClick={onClick}
      className="evo-card group relative cursor-pointer overflow-hidden rounded-xl border border-[#1a1a1e] bg-[#131316]"
    >
      {/* Art area */}
      <div className="relative flex aspect-square items-center justify-center overflow-hidden">
        {/* Element glow */}
        <div
          className="absolute inset-0 opacity-60"
          style={{ background: `radial-gradient(circle at 50% 50%, ${elementColor}15, transparent 65%)` }}
        />

        {/* Listed badge */}
        {evo.isListed && (
          <div className="absolute top-2 right-2 z-10 rounded-md bg-green-500/90 px-2 py-0.5 text-xs font-bold text-black">
            {evo.listPrice}◎
          </div>
        )}

        {/* Rarity dot */}
        <div
          className="absolute top-2 left-2 z-10 h-2.5 w-2.5 rounded-full"
          style={{ backgroundColor: rarityColor, boxShadow: `0 0 8px ${rarityColor}80` }}
        />

        {/* Shattered overlay */}
        {evo.isShattered && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/80">
            <span className="text-red-500 font-bold text-sm">SHATTERED</span>
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
                  stroke="rgba(255,255,255,0.25)" strokeWidth={fl.intensity > 50 ? 1.5 : 0.8} strokeLinecap="round" />
              );
            })}
          </svg>
        )}

        {/* Sprite */}
        {!imgError ? (
          <img
            src={sprite}
            alt={evo.creature.displayName}
            className="relative z-[1] pixelated"
            style={{
              transform: `scale(${scale})`,
              imageRendering: 'pixelated',
              filter: `drop-shadow(0 0 6px ${elementColor}60)`,
            }}
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="relative z-[1] flex h-16 w-16 items-center justify-center rounded-lg border-2 border-dashed border-gray-700 text-xs text-gray-600">
            {evo.creature.displayName}
          </div>
        )}

        {/* Facet bar */}
        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#1a1a1e]">
          <div className="h-full" style={{ width: `${evo.facetCount}%`, background: `linear-gradient(90deg, ${elementColor}, ${rarityColor})` }} />
        </div>
      </div>

      {/* Info */}
      <div className="p-3">
        <div className="flex items-center justify-between gap-2">
          <h3 className="truncate text-sm font-bold text-white">{evo.creature.displayName}</h3>
          <span className="shrink-0 text-xs font-mono text-gray-500">#{evo.id}</span>
        </div>

        <div className="mt-1.5 flex items-center gap-2">
          <span className="text-xs font-medium" style={{ color: elementColor }}>{evo.creature.element}</span>
          <span className="text-xs text-gray-600">·</span>
          <span className="text-xs text-gray-500">{STAGE_NAMES[stage]}</span>
          <span className="text-xs text-gray-600">·</span>
          <span className="text-xs font-medium" style={{ color: rarityColor }}>{evo.creature.rarity}</span>
        </div>

        <div className="mt-2 flex items-center justify-between border-t border-[#1a1a1e] pt-2">
          <div>
            <p className="text-xs text-gray-500">Locked</p>
            <p className="text-sm font-bold text-yellow-400 font-mono">{evo.lockedLamports}◎</p>
          </div>
          {evo.isListed ? (
            <div className="text-right">
              <p className="text-xs text-gray-500">Price</p>
              <p className="text-sm font-bold text-green-400 font-mono">{evo.listPrice}◎</p>
            </div>
          ) : (
            <div className="text-right">
              <p className="text-xs text-gray-500">Trades</p>
              <p className="text-sm font-bold text-gray-400 font-mono">{evo.tradeCount}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}