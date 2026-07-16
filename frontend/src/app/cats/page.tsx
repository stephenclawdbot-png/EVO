'use client';

import { useState, useMemo } from 'react';
import {
  generateCatEVOs,
  CatEVO,
  CatElement,
  CAT_ELEMENT_COLORS,
  CAT_STAGE_NAMES,
  getCatStage,
  getCatAgeString,
} from '@/lib/cat-data';

const ALL_CATS = generateCatEVOs();

type SortKey = 'newest' | 'oldest' | 'most-sol' | 'most-facets' | 'most-trades';

export default function CatCollection() {
  const [filterElement, setFilterElement] = useState<CatElement | 'all'>('all');
  const [filterListed, setFilterListed] = useState(false);
  const [sortBy, setSortBy] = useState<SortKey>('newest');
  const [selectedCat, setSelectedCat] = useState<CatEVO | null>(null);

  const filteredCats = useMemo(() => {
    let cats = ALL_CATS.filter(c => !c.isShattered);

    if (filterElement !== 'all') cats = cats.filter(c => c.element === filterElement);
    if (filterListed) cats = cats.filter(c => c.isListed);

    switch (sortBy) {
      case 'newest': cats.sort((a, b) => b.forgedAt - a.forgedAt); break;
      case 'oldest': cats.sort((a, b) => a.forgedAt - b.forgedAt); break;
      case 'most-sol': cats.sort((a, b) => b.lockedSol - a.lockedSol); break;
      case 'most-facets': cats.sort((a, b) => b.facetCount - a.facetCount); break;
      case 'most-trades': cats.sort((a, b) => b.tradeCount - a.tradeCount); break;
    }
    return cats;
  }, [filterElement, filterListed, sortBy]);

  const totalLocked = ALL_CATS.filter(c => !c.isShattered).reduce((s, c) => s + c.lockedSol, 0);
  const listedCount = ALL_CATS.filter(c => c.isListed).length;
  const activeCount = ALL_CATS.filter(c => !c.isShattered).length;
  const avgSol = activeCount > 0 ? (totalLocked / activeCount).toFixed(2) : '0';

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      {/* Header */}
      <div className="border-b border-white/10 bg-gradient-to-b from-purple-950/30 to-transparent">
        <div className="mx-auto max-w-7xl px-4 py-8">
          <div className="flex items-center gap-4">
            <img
              src="/cats/cat.png"
              alt="Cat Collection"
              className="h-16 w-16 rounded-xl border border-white/20 pixelated"
              style={{ imageRendering: 'pixelated' }}
            />
            <div>
              <h1 className="text-3xl font-bold">Cats</h1>
              <p className="text-sm text-gray-400">50 evolving felines · Powered by EVO Protocol</p>
            </div>
          </div>
          <div className="mt-6 flex flex-wrap gap-6 text-sm">
            <div><span className="text-gray-500">Supply</span><p className="font-bold text-white">{ALL_CATS.length} / 50</p></div>
            <div><span className="text-gray-500">Total Locked</span><p className="font-bold text-yellow-400">{totalLocked.toFixed(2)}◎</p></div>
            <div><span className="text-gray-500">Avg Lock</span><p className="font-bold text-blue-400">{avgSol}◎</p></div>
            <div><span className="text-gray-500">Listed</span><p className="font-bold text-green-400">{listedCount}</p></div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="sticky top-0 z-20 border-b border-white/10 bg-[#0a0a0a]/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-4 py-3">
          <select value={filterElement} onChange={(e) => setFilterElement(e.target.value as CatElement | 'all')} className="rounded-lg border border-white/10 bg-gray-900 px-3 py-1.5 text-sm text-white">
            <option value="all">All Elements</option>
            {Object.keys(CAT_ELEMENT_COLORS).map(el => <option key={el} value={el}>{el}</option>)}
          </select>
          <button onClick={() => setFilterListed(!filterListed)} className={`rounded-lg border px-3 py-1.5 text-sm ${filterListed ? 'border-green-500 bg-green-500/20 text-green-400' : 'border-white/10 bg-gray-900 text-gray-400'}`}>Listed Only</button>
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value as SortKey)} className="rounded-lg border border-white/10 bg-gray-900 px-3 py-1.5 text-sm text-white">
            <option value="newest">Newest</option>
            <option value="oldest">Oldest</option>
            <option value="most-sol">Most SOL</option>
            <option value="most-facets">Most Facets</option>
            <option value="most-trades">Most Trades</option>
          </select>
          <span className="ml-auto text-sm text-gray-500">{filteredCats.length} cats</span>
        </div>
      </div>

      {/* Grid */}
      <div className="mx-auto max-w-7xl px-4 py-6">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {filteredCats.map((cat) => <CatCard key={cat.id} cat={cat} onClick={() => setSelectedCat(cat)} />)}
        </div>
      </div>

      {selectedCat && <CatDetail cat={selectedCat} onClose={() => setSelectedCat(null)} />}
    </div>
  );
}

function CatCard({ cat, onClick }: { cat: CatEVO; onClick: () => void }) {
  const stage = getCatStage(cat.facetCount);
  const elementColor = CAT_ELEMENT_COLORS[cat.element];
  const scale = 0.5 + Math.min(1, cat.lockedSol / 50) * 0.5;

  return (
    <div onClick={onClick} className="group relative cursor-pointer overflow-hidden rounded-xl border border-white/10 bg-gradient-to-b from-gray-900 to-gray-950 transition-all hover:border-white/30 hover:scale-[1.02]" style={{ boxShadow: cat.isListed ? `0 0 20px ${elementColor}40` : 'none' }}>
      {cat.isListed && <div className="absolute top-2 right-2 z-10 rounded-full bg-green-500/90 px-2 py-0.5 text-xs font-bold text-black">LISTED {cat.listPrice}◎</div>}
      <div className="relative flex h-48 items-center justify-center overflow-hidden">
        <div className="absolute inset-0" style={{ background: `radial-gradient(circle at 50% 50%, ${elementColor}15, transparent 60%)` }} />
        {cat.fractureLines.length > 0 && (
          <svg className="absolute inset-0 h-full w-full" viewBox="0 0 192 192">
            {cat.fractureLines.slice(0, 10).map((fl, i) => {
              const angle = (fl.position * Math.PI) / 180;
              const len = 30 + (fl.intensity / 100) * 40;
              return <line key={i} x1={96} y1={96} x2={96 + Math.cos(angle) * len} y2={96 + Math.sin(angle) * len} stroke="rgba(255,255,255,0.3)" strokeWidth={fl.intensity > 50 ? 1.5 : 0.8} strokeLinecap="round" />;
            })}
          </svg>
        )}
        <img src="/cats/cat.png" alt={cat.name} className="relative z-[1] pixelated" style={{ transform: `scale(${scale})`, imageRendering: 'pixelated', filter: `drop-shadow(0 0 8px ${elementColor}) hue-rotate(${(cat.id * 7) % 360}deg) saturate(${0.8 + (cat.facetCount / 100) * 0.8})` }} />
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-gray-800">
          <div className="h-full transition-all" style={{ width: `${cat.facetCount}%`, background: `linear-gradient(90deg, ${elementColor}, #fff)` }} />
        </div>
      </div>
      <div className="p-3">
        <div className="flex items-center justify-between">
          <h3 className="truncate text-sm font-bold text-white">{cat.name}</h3>
          <span className="text-xs text-gray-500">#{cat.id.toString().padStart(3, '0')}</span>
        </div>
        <div className="mt-1 flex items-center gap-2 text-xs text-gray-400">
          <span style={{ color: elementColor }}>● {cat.element}</span><span>·</span><span>{CAT_STAGE_NAMES[stage]}</span>
        </div>
        <div className="mt-2 flex gap-3 text-xs">
          <div><span className="text-gray-500">Locked</span><p className="font-bold text-yellow-400">{cat.lockedSol}◎</p></div>
          <div><span className="text-gray-500">Facets</span><p className="font-bold text-blue-400">{cat.facetCount}</p></div>
          <div><span className="text-gray-500">Trades</span><p className="font-bold text-purple-400">{cat.tradeCount}</p></div>
        </div>
        <div className="mt-1 text-xs text-gray-600">Forged {getCatAgeString(cat.forgedAt)}</div>
      </div>
    </div>
  );
}

function CatDetail({ cat, onClose }: { cat: CatEVO; onClose: () => void }) {
  const stage = getCatStage(cat.facetCount);
  const elementColor = CAT_ELEMENT_COLORS[cat.element];
  const scale = 0.7 + Math.min(1, cat.lockedSol / 50) * 0.3;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" onClick={onClose}>
      <div className="relative max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-white/10 bg-gradient-to-b from-gray-900 to-gray-950 p-6" onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-500 hover:text-white">✕</button>
        <div className="flex gap-6">
          <div className="relative flex h-64 w-64 flex-shrink-0 items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-black/50">
            <div className="absolute inset-0" style={{ background: `radial-gradient(circle at 50% 50%, ${elementColor}20, transparent 70%)` }} />
            <img src="/cats/cat.png" alt={cat.name} className="relative z-[1] pixelated" style={{ transform: `scale(${scale})`, imageRendering: 'pixelated', filter: `drop-shadow(0 0 12px ${elementColor}) hue-rotate(${(cat.id * 7) % 360}deg) saturate(${0.8 + (cat.facetCount / 100) * 0.8})` }} />
            {cat.fractureLines.length > 0 && (
              <svg className="absolute inset-0 h-full w-full" viewBox="0 0 256 256">
                {cat.fractureLines.map((fl, i) => {
                  const angle = (fl.position * Math.PI) / 180;
                  const len = 40 + (fl.intensity / 100) * 50;
                  const x2 = 128 + Math.cos(angle) * len;
                  const y2 = 128 + Math.sin(angle) * len;
                  return (
                    <g key={i}>
                      <line x1={128} y1={128} x2={x2} y2={y2} stroke="rgba(255,255,255,0.4)" strokeWidth={1.5} strokeLinecap="round" />
                      <text x={x2 + Math.cos(angle) * 12} y={y2 + Math.sin(angle) * 12} fill="rgba(255,255,255,0.6)" fontSize="8" fontFamily="monospace">#{fl.tradeNumber}</text>
                    </g>
                  );
                })}
              </svg>
            )}
          </div>
          <div className="flex-1">
            <h2 className="text-2xl font-bold text-white">{cat.name}</h2>
            <p className="text-sm text-gray-500">Cat #{cat.id.toString().padStart(3, '0')}</p>
            <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-lg border border-white/10 bg-white/5 p-3"><span className="text-gray-500">Locked SOL</span><p className="text-lg font-bold text-yellow-400">{cat.lockedSol}◎</p></div>
              <div className="rounded-lg border border-white/10 bg-white/5 p-3"><span className="text-gray-500">Stage</span><p className="text-lg font-bold" style={{ color: elementColor }}>{CAT_STAGE_NAMES[stage]}</p></div>
              <div className="rounded-lg border border-white/10 bg-white/5 p-3"><span className="text-gray-500">Facets</span><p className="text-lg font-bold text-blue-400">{cat.facetCount} / 100</p></div>
              <div className="rounded-lg border border-white/10 bg-white/5 p-3"><span className="text-gray-500">Trades</span><p className="text-lg font-bold text-purple-400">{cat.tradeCount}</p></div>
              <div className="rounded-lg border border-white/10 bg-white/5 p-3"><span className="text-gray-500">Element</span><p className="text-lg font-bold" style={{ color: elementColor }}>{cat.element}</p></div>
              <div className="rounded-lg border border-white/10 bg-white/5 p-3"><span className="text-gray-500">Age</span><p className="text-lg font-bold text-white">{getCatAgeString(cat.forgedAt)}</p></div>
            </div>
            {cat.isListed && <div className="mt-4 rounded-lg border border-green-500/30 bg-green-500/10 p-3"><p className="text-sm text-green-400">Listed for <span className="font-bold">{cat.listPrice} SOL</span></p></div>}
          </div>
        </div>
        {cat.fractureLines.length > 0 && (
          <div className="mt-6">
            <h3 className="mb-3 text-sm font-bold text-white">Fracture History (Trade Scars)</h3>
            <div className="space-y-2">
              {cat.fractureLines.map((fl, i) => (
                <div key={i} className="flex items-center gap-3 rounded-lg border border-white/5 bg-white/5 p-2 text-xs">
                  <span className="font-bold text-white">#{fl.tradeNumber}</span>
                  <span className="text-gray-500">from {fl.previousOwner}</span>
                  <span className="text-gray-600">{getCatAgeString(fl.timestamp)}</span>
                  <span className="ml-auto text-gray-500">intensity {fl.intensity}%</span>
                </div>
              ))}
            </div>
          </div>
        )}
        <div className="mt-6 flex gap-3">
          <button className="flex-1 rounded-lg bg-purple-600 px-4 py-2 text-sm font-bold text-white hover:bg-purple-500">Feed SOL</button>
          <button className="flex-1 rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm font-bold text-white hover:bg-white/10">List for Sale</button>
          <button className="flex-1 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm font-bold text-red-400 hover:bg-red-500/20">Shatter</button>
        </div>
      </div>
    </div>
  );
}