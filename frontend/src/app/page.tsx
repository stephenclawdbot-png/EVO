'use client';

import { useState, useMemo } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { ZCard } from '@/components/ZCard';
import { ZDetail } from '@/components/ZDetail';
import { generateDemoEVOs, EVOData } from '@/lib/evo-data';
import { Element, Rarity, ELEMENT_COLORS, RARITY_COLORS } from '@/lib/creatures';

const ALL_EVOS = generateDemoEVOs();

type SortKey = 'newest' | 'oldest' | 'most-sol' | 'most-facets' | 'most-trades';

export default function Home() {
  const [selectedEvo, setSelectedEvo] = useState<EVOData | null>(null);
  const [filterElement, setFilterElement] = useState<Element | 'all'>('all');
  const [filterRarity, setFilterRarity] = useState<Rarity | 'all'>('all');
  const [filterListed, setFilterListed] = useState(false);
  const [sortBy, setSortBy] = useState<SortKey>('newest');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredEvos = useMemo(() => {
    let evos = ALL_EVOS.filter(evo => !evo.isShattered);

    if (filterElement !== 'all') {
      evos = evos.filter(evo => evo.creature.element === filterElement);
    }
    if (filterRarity !== 'all') {
      evos = evos.filter(evo => evo.creature.rarity === filterRarity);
    }
    if (filterListed) {
      evos = evos.filter(evo => evo.isListed);
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      evos = evos.filter(evo => evo.creature.displayName.toLowerCase().includes(q));
    }

    switch (sortBy) {
      case 'newest':
        evos.sort((a, b) => b.forgedAt - a.forgedAt);
        break;
      case 'oldest':
        evos.sort((a, b) => a.forgedAt - b.forgedAt);
        break;
      case 'most-sol':
        evos.sort((a, b) => b.lockedLamports - a.lockedLamports);
        break;
      case 'most-facets':
        evos.sort((a, b) => b.facetCount - a.facetCount);
        break;
      case 'most-trades':
        evos.sort((a, b) => b.tradeCount - a.tradeCount);
        break;
    }

    return evos;
  }, [filterElement, filterRarity, filterListed, sortBy, searchQuery]);

  const stats = useMemo(() => {
    const active = ALL_EVOS.filter(e => !e.isShattered);
    const totalLocked = active.reduce((sum, e) => sum + e.lockedLamports, 0);
    const totalListed = active.filter(e => e.isListed).length;
    const totalShattered = ALL_EVOS.filter(e => e.isShattered).length;
    return {
      total: active.length,
      totalLocked: totalLocked.toFixed(0),
      totalListed,
      totalShattered,
    };
  }, []);

  if (selectedEvo) {
    return <ZDetail evo={selectedEvo} onBack={() => setSelectedEvo(null)} />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-950 via-black to-gray-950">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-white/10 bg-black/80 backdrop-blur-xl">
        <div className="mx-auto max-w-7xl px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-purple-500 to-blue-500 text-xl font-bold text-white">
                Z
              </div>
              <div>
                <h1 className="text-xl font-bold text-white">Z Collection</h1>
                <p className="text-xs text-gray-500">Evolving Value Objects · EVO Protocol</p>
              </div>
            </div>
            <WalletMultiButton className="!bg-gradient-to-r !from-purple-500 !to-blue-500 !rounded-lg !text-sm !font-bold !text-white !border-0 hover:!opacity-90 !transition-opacity !h-10 !px-4" />
          </div>
        </div>
      </header>

      {/* Hero Stats */}
      <section className="mx-auto max-w-7xl px-4 py-8">
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <div className="rounded-xl border border-white/10 bg-gray-900/50 p-4">
            <p className="text-xs text-gray-500">Active Z</p>
            <p className="text-2xl font-bold text-white">{stats.total}</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-gray-900/50 p-4">
            <p className="text-xs text-gray-500">Total SOL Locked</p>
            <p className="text-2xl font-bold text-yellow-400">{stats.totalLocked}◎</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-gray-900/50 p-4">
            <p className="text-xs text-gray-500">Listed for Sale</p>
            <p className="text-2xl font-bold text-green-400">{stats.totalListed}</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-gray-900/50 p-4">
            <p className="text-xs text-gray-500">Shattered</p>
            <p className="text-2xl font-bold text-red-400">{stats.totalShattered}</p>
          </div>
        </div>
      </section>

      {/* Filters */}
      <section className="mx-auto max-w-7xl px-4 pb-6">
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="text"
            placeholder="Search Z..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="rounded-lg border border-white/10 bg-gray-900/50 px-4 py-2 text-sm text-white placeholder-gray-600 focus:border-purple-500 focus:outline-none"
          />

          <div className="flex gap-1">
            <button
              onClick={() => setFilterElement('all')}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                filterElement === 'all' ? 'bg-white text-black' : 'bg-gray-800 text-gray-400 hover:text-white'
              }`}
            >
              All
            </button>
            {(Object.keys(ELEMENT_COLORS) as Element[]).map(el => (
              <button
                key={el}
                onClick={() => setFilterElement(el)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                  filterElement === el ? 'text-black' : 'text-gray-400 hover:text-white'
                }`}
                style={filterElement === el ? { backgroundColor: ELEMENT_COLORS[el] } : { backgroundColor: '#1a1a1a' }}
              >
                {el}
              </button>
            ))}
          </div>

          <select
            value={filterRarity}
            onChange={(e) => setFilterRarity(e.target.value as Rarity | 'all')}
            className="rounded-lg border border-white/10 bg-gray-900 px-3 py-1.5 text-xs text-white"
          >
            <option value="all">All Rarities</option>
            {(Object.keys(RARITY_COLORS) as Rarity[]).map(r => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>

          <button
            onClick={() => setFilterListed(!filterListed)}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              filterListed ? 'bg-green-500 text-black' : 'bg-gray-800 text-gray-400 hover:text-white'
            }`}
          >
            Listed Only
          </button>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortKey)}
            className="rounded-lg border border-white/10 bg-gray-900 px-3 py-1.5 text-xs text-white"
          >
            <option value="newest">Newest</option>
            <option value="oldest">Oldest</option>
            <option value="most-sol">Most SOL</option>
            <option value="most-facets">Most Facets</option>
            <option value="most-trades">Most Trades</option>
          </select>
        </div>
      </section>

      {/* Gallery */}
      <section className="mx-auto max-w-7xl px-4 pb-16">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {filteredEvos.map(evo => (
            <ZCard key={evo.id} evo={evo} onClick={() => setSelectedEvo(evo)} />
          ))}
        </div>
        {filteredEvos.length === 0 && (
          <div className="py-20 text-center text-gray-600">
            No Z found matching your filters
          </div>
        )}
      </section>

      {/* Footer */}
      <footer className="border-t border-white/10 py-8 text-center text-xs text-gray-600">
        <p>Z Collection · The first EVO on Solana</p>
        <p className="mt-1">Not a token. Not an NFT. Evolving Value Objects.</p>
      </footer>
    </div>
  );
}