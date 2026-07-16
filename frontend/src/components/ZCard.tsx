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

  // Size scale based on locked SOL (0.05 to 50 SOL)
  const scale = 0.6 + Math.min(1, evo.lockedLamports / 50) * 0.4;

  return (
    <div
      onClick={onClick}
      className="group relative cursor-pointer overflow-hidden rounded-xl border border-white/10 bg-gradient-to-b from-gray-900 to-gray-950 transition-all hover:border-white/30 hover:scale-[1.02]"
      style={{ boxShadow: evo.isListed ? `0 0 20px ${elementColor}40` : 'none' }}
    >
      {/* Rarity glow border */}
      <div
        className="absolute inset-0 opacity-20"
        style={{ background: `radial-gradient(circle at 50% 30%, ${rarityColor}40, transparent 70%)` }}
      />

      {/* Listed badge */}
      {evo.isListed && (
        <div className="absolute top-2 right-2 z-10 rounded-full bg-green-500/90 px-2 py-0.5 text-xs font-bold text-black">
          LISTED {evo.listPrice}◎
        </div>
      )}

      {/* Shattered overlay */}
      {evo.isShattered && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/80">
          <span className="text-red-500 font-bold text-lg">SHATTERED</span>
        </div>
      )}

      {/* Sprite container with EVO effects */}
      <div className="relative flex h-48 items-center justify-center overflow-hidden">
        {/* Element glow background */}
        <div
          className="absolute inset-0"
          style={{
            background: `radial-gradient(circle at 50% 50%, ${elementColor}15, transparent 60%)`,
          }}
        />

        {/* Fracture lines overlay (SVG) */}
        {evo.fractureLines.length > 0 && (
          <svg className="absolute inset-0 h-full w-full" viewBox="0 0 192 192">
            {evo.fractureLines.slice(0, 10).map((fl, i) => {
              const angle = (fl.position * Math.PI) / 180;
              const cx = 96;
              const cy = 96;
              const len = 30 + (fl.intensity / 100) * 40;
              const x2 = cx + Math.cos(angle) * len;
              const y2 = cy + Math.sin(angle) * len;
              return (
                <line
                  key={i}
                  x1={cx}
                  y1={cy}
                  x2={x2}
                  y2={y2}
                  stroke="rgba(255,255,255,0.3)"
                  strokeWidth={fl.intensity > 50 ? 1.5 : 0.8}
                  strokeLinecap="round"
                />
              );
            })}
          </svg>
        )}

        {/* The creature sprite */}
        {!imgError ? (
          <img
            src={sprite}
            alt={evo.creature.displayName}
            className="relative z-[1] pixelated"
            style={{
              transform: `scale(${scale})`,
              imageRendering: 'pixelated',
              filter: evo.isListed
                ? `drop-shadow(0 0 8px ${elementColor})`
                : `drop-shadow(0 0 4px ${elementColor}80)`,
            }}
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="relative z-[1] flex h-24 w-24 items-center justify-center rounded-lg border-2 border-dashed border-gray-600 text-xs text-gray-500">
            {evo.creature.displayName}
          </div>
        )}

        {/* Facet count indicator (bottom bar) */}
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-gray-800">
          <div
            className="h-full transition-all"
            style={{
              width: `${evo.facetCount}%`,
              background: `linear-gradient(90deg, ${elementColor}, ${rarityColor})`,
            }}
          />
        </div>
      </div>

      {/* Info section */}
      <div className="p-3">
        <div className="flex items-center justify-between">
          <h3 className="truncate text-sm font-bold text-white">
            {evo.creature.displayName}
          </h3>
          <span
            className="rounded px-1.5 py-0.5 text-xs font-bold"
            style={{ color: rarityColor, backgroundColor: `${rarityColor}20` }}
          >
            {evo.creature.rarity}
          </span>
        </div>

        <div className="mt-1 flex items-center gap-2 text-xs text-gray-400">
          <span style={{ color: elementColor }}>● {evo.creature.element}</span>
          <span>·</span>
          <span>{STAGE_NAMES[stage]}</span>
        </div>

        <div className="mt-2 flex items-center justify-between text-xs">
          <div className="flex gap-3">
            <div>
              <span className="text-gray-500">Locked</span>
              <p className="font-bold text-yellow-400">{evo.lockedLamports}◎</p>
            </div>
            <div>
              <span className="text-gray-500">Facets</span>
              <p className="font-bold text-blue-400">{evo.facetCount}</p>
            </div>
            <div>
              <span className="text-gray-500">Trades</span>
              <p className="font-bold text-purple-400">{evo.tradeCount}</p>
            </div>
          </div>
        </div>

        <div className="mt-1 text-xs text-gray-600">
          Forged {getAgeString(evo.forgedAt)}
        </div>
      </div>
    </div>
  );
}