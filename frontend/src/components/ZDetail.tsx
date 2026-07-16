'use client';

import { EVOData, getStage, getAgeString } from '@/lib/evo-data';
import { ELEMENT_COLORS, RARITY_COLORS, STAGE_NAMES, Stage } from '@/lib/creatures';
import { useState } from 'react';

interface ZDetailProps {
  evo: EVOData;
  onBack: () => void;
}

export function ZDetail({ evo, onBack }: ZDetailProps) {
  const [imgError, setImgError] = useState(false);
  const stage = getStage(evo);
  const elementColor = ELEMENT_COLORS[evo.creature.element];
  const rarityColor = RARITY_COLORS[evo.creature.rarity];
  const scale = 0.6 + Math.min(1, evo.lockedLamports / 50) * 0.4;

  const stages: Stage[] = ['baby', 'juvenile', 'adult', 'elder'];
  const currentStageIndex = stages.indexOf(stage);

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-950 to-black p-4 md:p-8">
      <button
        onClick={onBack}
        className="mb-6 flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
      >
        ← Back to Gallery
      </button>

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

          {/* Actions (demo) */}
          <div className="grid grid-cols-2 gap-3">
            <button className="rounded-xl bg-yellow-500/20 border border-yellow-500/40 px-4 py-3 font-bold text-yellow-400 hover:bg-yellow-500/30 transition-colors">
              🔨 Feed SOL
            </button>
            <button className="rounded-xl bg-green-500/20 border border-green-500/40 px-4 py-3 font-bold text-green-400 hover:bg-green-500/30 transition-colors">
              🏷️ List for Sale
            </button>
            <button className="rounded-xl bg-blue-500/20 border border-blue-500/40 px-4 py-3 font-bold text-blue-400 hover:bg-blue-500/30 transition-colors">
              📤 Transfer
            </button>
            <button className="rounded-xl bg-red-500/20 border border-red-500/40 px-4 py-3 font-bold text-red-400 hover:bg-red-500/30 transition-colors">
              💥 Shatter
            </button>
          </div>

          <p className="text-center text-xs text-gray-600">
            Demo mode — connect wallet to interact with on-chain EVOs
          </p>
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