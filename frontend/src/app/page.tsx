'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { ZCard } from '@/components/ZCard';
import { ZDetail } from '@/components/ZDetail';
import { EVOData, CollectionData, CREATURES } from '@/lib/evo-data';
import { Element, Rarity, ELEMENT_COLORS, RARITY_COLORS } from '@/lib/creatures';
import {
  readCollectionConfig,
  readAllEVOs,
  getCollectionPDA,
} from '@/lib/evo-program';
import { evoAccountToData, collectionConfigToData } from '@/lib/evo-data';
import Link from 'next/link';

const COLLECTION_NAME = 'Z';
const SUPPLY_CAP = 108;

type SortKey = 'newest' | 'oldest' | 'most-sol' | 'most-facets' | 'most-trades';

export default function Home() {
  const { connection } = useConnection();
  const [selectedEvo, setSelectedEvo] = useState<EVOData | null>(null);
  const [filterElement, setFilterElement] = useState<Element | 'all'>('all');
  const [filterRarity, setFilterRarity] = useState<Rarity | 'all'>('all');
  const [filterListed, setFilterListed] = useState(false);
  const [sortBy, setSortBy] = useState<SortKey>('newest');
  const [searchQuery, setSearchQuery] = useState('');

  const [evos, setEvos] = useState<EVOData[]>([]);
  const [collection, setCollection] = useState<CollectionData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [collectionPda] = getCollectionPDA(COLLECTION_NAME);
      const cfg = await readCollectionConfig(connection, COLLECTION_NAME);
      if (cfg) {
        setCollection(collectionConfigToData(cfg));
      }
      const onChainEvos = await readAllEVOs(connection, collectionPda, SUPPLY_CAP);
      const display: EVOData[] = [];
      for (const evo of onChainEvos) {
        const d = evoAccountToData(evo, CREATURES);
        if (d) display.push(d);
      }
      setEvos(display);
    } catch (err) {
      console.error('Failed to fetch EVOs:', err);
    } finally {
      setLoading(false);
    }
  }, [connection]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filteredEvos = useMemo(() => {
    let list = evos.filter(evo => !evo.isShattered);

    if (filterElement !== 'all') {
      list = list.filter(evo => evo.creature.element === filterElement);
    }
    if (filterRarity !== 'all') {
      list = list.filter(evo => evo.creature.rarity === filterRarity);
    }
    if (filterListed) {
      list = list.filter(evo => evo.isListed);
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter(evo => evo.creature.displayName.toLowerCase().includes(q));
    }

    switch (sortBy) {
      case 'newest':
        list.sort((a, b) => b.forgedAt - a.forgedAt);
        break;
      case 'oldest':
        list.sort((a, b) => a.forgedAt - b.forgedAt);
        break;
      case 'most-sol':
        list.sort((a, b) => b.lockedLamports - a.lockedLamports);
        break;
      case 'most-facets':
        list.sort((a, b) => b.facetCount - a.facetCount);
        break;
      case 'most-trades':
        list.sort((a, b) => b.tradeCount - a.tradeCount);
        break;
    }

    return list;
  }, [evos, filterElement, filterRarity, filterListed, sortBy, searchQuery]);

  const stats = useMemo(() => {
    const active = evos.filter(e => !e.isShattered);
    const totalLocked = active.reduce((sum, e) => sum + e.lockedLamports, 0);
    const totalListed = active.filter(e => e.isListed).length;
    const totalShattered = evos.filter(e => e.isShattered).length;
    return {
      total: active.length,
      totalLocked: totalLocked.toFixed(2),
      totalListed,
      totalShattered,
    };
  }, [evos]);

  if (selectedEvo) {
    return <ZDetail evo={selectedEvo} onBack={() => setSelectedEvo(null)} onRefresh={fetchData} />;
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
            <div className="flex items-center gap-3">
              <Link
                href="/forge"
                className="rounded-lg bg-gradient-to-r from-yellow-500 to-orange-500 px-4 py-2 text-sm font-bold text-black transition-opacity hover:opacity-90"
              >
                ⚒️ Forge Z
              </Link>
              <button
                onClick={fetchData}
                className="rounded-lg bg-gray-800 px-3 py-2 text-sm text-gray-300 transition-colors hover:bg-gray-700"
                title="Refresh"
              >
                ↻
              </button>
              <WalletMultiButton className="!bg-gradient-to-r !from-purple-500 !to-blue-500 !rounded-lg !text-sm !font-bold !text-white !border-0 hover:!opacity-90 !transition-opacity !h-10 !px-4" />
            </div>
          </div>
        </div>
      </header>

      {/* Hero Stats */}
      <section className="mx-auto max-w-7xl px-4 py-8">
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <div className="rounded-xl border border-white/10 bg-gray-900/50 p-4">
            <p className="text-xs text-gray-500">Active Z</p>
            <p className="text-2xl font-bold text-white">{loading ? '...' : stats.total}</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-gray-900/50 p-4">
            <p className="text-xs text-gray-500">Total SOL Locked</p>
            <p className="text-2xl font-bold text-yellow-400">{loading ? '...' : stats.totalLocked}◎</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-gray-900/50 p-4">
            <p className="text-xs text-gray-500">Listed for Sale</p>
            <p className="text-2xl font-bold text-green-400">{loading ? '...' : stats.totalListed}</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-gray-900/50 p-4">
            <p className="text-xs text-gray-500">Shattered</p>
            <p className="text-2xl font-bold text-red-400">{loading ? '...' : stats.totalShattered}</p>
          </div>
        </div>

        {/* Collection info bar */}
        {collection && (
          <div className="mt-4 flex flex-wrap gap-4 rounded-xl border border-white/10 bg-gray-900/30 p-4 text-xs text-gray-400">
            <span>Supply: <span className="text-white font-bold">{collection.currentSupply}/{collection.supplyCap}</span></span>
            <span>Mint: <span className="text-yellow-400 font-bold">{collection.mintPriceSol}◎</span></span>
            <span>Floor: <span className="text-yellow-400 font-bold">{collection.lockAmountSol}◎</span></span>
            <span>Shatter Fee: <span className="text-white font-bold">{collection.shatterFeeBps / 100}%</span></span>
            <span>Royalty: <span className="text-white font-bold">{collection.tradeRoyaltyBps / 100}%</span></span>
          </div>
        )}
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
        {loading ? (
          <div className="py-20 text-center text-gray-600">
            Loading Z from Solana...
          </div>
        ) : evos.length === 0 ? (
          <div className="py-20 text-center">
            <p className="text-gray-400 text-lg">No Z forged yet</p>
            <p className="text-gray-600 text-sm mt-2">Be the first to forge a Z!</p>
            <Link
              href="/forge"
              className="mt-4 inline-block rounded-lg bg-gradient-to-r from-yellow-500 to-orange-500 px-6 py-3 text-sm font-bold text-black transition-opacity hover:opacity-90"
            >
              ⚒️ Forge Your Z
            </Link>
          </div>
        ) : (
          <>
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
          </>
        )}
      </section>

      {/* Footer */}
      <footer className="border-t border-white/10 py-8 text-center text-xs text-gray-600">
        <p>Z Collection · The first EVO on Solana</p>
        <p className="mt-1">Stateful Capital. SOL that remembers.</p>
      </footer>
    </div>
  );
}