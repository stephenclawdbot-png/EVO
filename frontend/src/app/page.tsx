'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import { useConnection } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { ZCard } from '@/components/ZCard';
import { ZDetail } from '@/components/ZDetail';
import { EVOData, CollectionData, CREATURES } from '@/lib/evo-data';
import { Rarity, RARITY_COLORS } from '@/lib/creatures';
import {
  readCollectionConfig,
  readAllEVOs,
  getCollectionPDA,
} from '@/lib/evo-program';
import { evoAccountToData, collectionConfigToData } from '@/lib/evo-data';
import Link from 'next/link';

const COLLECTION_NAME = 'Z';
const SUPPLY_CAP = 108;

type SortKey = 'newest' | 'oldest' | 'most-sol' | 'most-facets' | 'most-trades' | 'price-low' | 'price-high';

export default function Home() {
  const { connection } = useConnection();
  const [selectedEvo, setSelectedEvo] = useState<EVOData | null>(null);
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
      if (cfg) setCollection(collectionConfigToData(cfg));
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
    if (filterRarity !== 'all') list = list.filter(evo => evo.creature.rarity === filterRarity);
    if (filterListed) list = list.filter(evo => evo.isListed);
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter(evo =>
        evo.creature.displayName.toLowerCase().includes(q) ||
        String(evo.id) === q.trim()
      );
    }

    switch (sortBy) {
      case 'newest': list.sort((a, b) => b.forgedAt - a.forgedAt); break;
      case 'oldest': list.sort((a, b) => a.forgedAt - b.forgedAt); break;
      case 'most-sol': list.sort((a, b) => b.lockedLamports - a.lockedLamports); break;
      case 'most-facets': list.sort((a, b) => b.facetCount - a.facetCount); break;
      case 'most-trades': list.sort((a, b) => b.tradeCount - a.tradeCount); break;
      case 'price-low': list = list.filter(e => e.isListed).sort((a, b) => (a.listPrice || 0) - (b.listPrice || 0)); break;
      case 'price-high': list = list.filter(e => e.isListed).sort((a, b) => (b.listPrice || 0) - (a.listPrice || 0)); break;
    }
    return list;
  }, [evos, filterRarity, filterListed, sortBy, searchQuery]);

  const stats = useMemo(() => {
    const active = evos.filter(e => !e.isShattered);
    const totalLocked = active.reduce((sum, e) => sum + e.lockedLamports, 0);
    const listed = active.filter(e => e.isListed);
    const floorPrice = listed.length > 0 ? Math.min(...listed.map(e => e.listPrice || Infinity)) : 0;
    return {
      total: active.length,
      totalLocked: totalLocked.toFixed(2),
      listedCount: listed.length,
      floorPrice: floorPrice > 0 ? floorPrice.toFixed(2) : '—',
      shattered: evos.filter(e => e.isShattered).length,
    };
  }, [evos]);

  if (selectedEvo) {
    return <ZDetail evo={selectedEvo} onBack={() => setSelectedEvo(null)} onRefresh={fetchData} />;
  }

  return (
    <div className="min-h-screen bg-[#0a0a0b] text-white">
      {/* Nav */}
      <nav className="sticky top-0 z-50 border-b border-[#1a1a1e] bg-[#0a0a0b]/80 backdrop-blur-xl">
        <div className="mx-auto max-w-7xl px-4 lg:px-6">
          <div className="flex h-16 items-center justify-between">
            <Link href="/" className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 text-lg font-bold">Z</div>
              <div className="hidden sm:block">
                <p className="text-sm font-bold leading-tight">EVO</p>
                <p className="text-xs text-gray-500 leading-tight">Stateful Capital</p>
              </div>
            </Link>
            <div className="flex items-center gap-3">
              <Link href="/forge" className="rounded-lg bg-gradient-to-r from-indigo-500 to-purple-600 px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90">
                Forge
              </Link>
              <button onClick={fetchData} className="rounded-lg border border-[#232328] px-3 py-2 text-sm text-gray-400 transition-colors hover:text-white" title="Refresh">↻</button>
              <WalletMultiButton />
            </div>
          </div>
        </div>
      </nav>

      {/* Hero — only when empty */}
      {evos.length === 0 && !loading && (
        <section className="relative overflow-hidden border-b border-[#1a1a1e]">
          <div className="absolute inset-0">
            <div className="absolute left-1/2 top-0 h-[400px] w-[600px] -translate-x-1/2 rounded-full bg-indigo-600/10 blur-[100px]" />
            <div className="absolute right-1/4 top-20 h-[200px] w-[300px] rounded-full bg-purple-600/10 blur-[80px]" />
          </div>
          <div className="relative mx-auto max-w-7xl px-4 py-20 lg:px-6 lg:py-28">
            <div className="mx-auto max-w-3xl text-center">
              <p className="mb-3 text-sm font-medium text-indigo-400">EVO Protocol · Solana</p>
              <h1 className="text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
                Stateful Capital.<br />
                <span className="bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">SOL that remembers.</span>
              </h1>
              <p className="mx-auto mt-6 max-w-xl text-lg text-gray-400">
                Every collectible has real value inside it. Trade stories. Keep your floor.
              </p>
              <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
                <Link href="/forge" className="rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 px-8 py-3.5 text-base font-semibold text-white transition-opacity hover:opacity-90">
                  ⚒️ Forge Your Z
                </Link>
                <a href="https://github.com/stephenclawdbot-png/EVO" target="_blank" rel="noopener noreferrer" className="rounded-xl border border-[#2a2a30] px-8 py-3.5 text-base font-semibold text-gray-300 transition-colors hover:border-[#3a3a40] hover:text-white">
                  Learn More
                </a>
              </div>
              <div className="mt-16 grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="rounded-xl border border-[#1a1a1e] bg-[#131316]/50 p-5">
                  <div className="mb-2 text-2xl">🔒</div>
                  <h3 className="text-sm font-bold text-white">Floor Guarantee</h3>
                  <p className="mt-1 text-xs text-gray-500">Every Z has SOL locked inside. Shatter to recover your principal.</p>
                </div>
                <div className="rounded-xl border border-[#1a1a1e] bg-[#131316]/50 p-5">
                  <div className="mb-2 text-2xl">🎨</div>
                  <h3 className="text-sm font-bold text-white">Generative Art</h3>
                  <p className="mt-1 text-xs text-gray-500">108 unique creatures across 7 elements and 5 rarities.</p>
                </div>
                <div className="rounded-xl border border-[#1a1a1e] bg-[#131316]/50 p-5">
                  <div className="mb-2 text-2xl">📈</div>
                  <h3 className="text-sm font-bold text-white">Grows Over Time</h3>
                  <p className="mt-1 text-xs text-gray-500">Feed SOL to evolve. Each trade adds fracture lines and history.</p>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Stats Bar */}
      <section className="border-b border-[#1a1a1e]">
        <div className="mx-auto max-w-7xl px-4 lg:px-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6">
            <StatItem label="Items" value={loading ? '—' : String(stats.total)} />
            <StatItem label="Floor" value={loading ? '—' : `${stats.floorPrice}◎`} />
            <StatItem label="Locked SOL" value={loading ? '—' : `${stats.totalLocked}◎`} accent="text-yellow-400" />
            <StatItem label="Listed" value={loading ? '—' : String(stats.listedCount)} accent="text-green-400" />
            {collection && (
              <>
                <StatItem label="Supply" value={`${collection.currentSupply}/${collection.supplyCap}`} />
                <StatItem label="Mint" value={`${collection.mintPriceSol}◎`} accent="text-indigo-400" />
              </>
            )}
          </div>
        </div>
      </section>

      {/* Collection header */}
      <section className="mx-auto max-w-7xl px-4 pt-8 lg:px-6">
        <div className="flex items-end justify-between">
          <div>
            <h2 className="text-2xl font-bold">Z Collection</h2>
            <p className="mt-1 text-sm text-gray-500">The first EVO on Solana · 108 supply</p>
          </div>
          {collection && (
            <div className="hidden gap-4 text-xs text-gray-500 sm:flex">
              <span>Shatter fee: <span className="text-white font-medium">{collection.shatterFeeBps / 100}%</span></span>
              <span>Royalty: <span className="text-white font-medium">{collection.tradeRoyaltyBps / 100}%</span></span>
            </div>
          )}
        </div>
      </section>

      {/* Filter bar */}
      <section className="sticky top-16 z-40 border-b border-[#1a1a1e] bg-[#0a0a0b]/90 backdrop-blur-xl">
        <div className="mx-auto max-w-7xl px-4 py-3 lg:px-6">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <svg className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z" />
              </svg>
              <input type="text" placeholder="Search Z..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                className="w-40 rounded-lg border border-[#232328] bg-[#131316] py-1.5 pl-9 pr-3 text-sm text-white placeholder-gray-600 focus:border-indigo-500 focus:outline-none" />
            </div>

            <div className="h-6 w-px bg-[#232328]" />

            <select value={filterRarity} onChange={(e) => setFilterRarity(e.target.value as Rarity | 'all')}
              className="rounded-lg border border-[#232328] bg-[#131316] px-3 py-1.5 text-xs text-white focus:outline-none">
              <option value="all">All Rarities</option>
              {(Object.keys(RARITY_COLORS) as Rarity[]).map(r => <option key={r} value={r}>{r}</option>)}
            </select>

            <button onClick={() => setFilterListed(!filterListed)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                filterListed ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 'text-gray-400 hover:text-white border border-transparent'
              }`}>
              Listed
            </button>

            <select value={sortBy} onChange={(e) => setSortBy(e.target.value as SortKey)}
              className="ml-auto rounded-lg border border-[#232328] bg-[#131316] px-3 py-1.5 text-xs text-white focus:outline-none">
              <option value="newest">Newest</option>
              <option value="oldest">Oldest</option>
              <option value="most-sol">Most SOL</option>
              <option value="most-facets">Most Facets</option>
              <option value="most-trades">Most Trades</option>
              <option value="price-low">Price: Low to High</option>
              <option value="price-high">Price: High to Low</option>
            </select>
          </div>
        </div>
      </section>

      {/* Gallery */}
      <section className="mx-auto max-w-7xl px-4 py-8 lg:px-6">
        {loading ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
            {Array.from({ length: 12 }).map((_, i) => <div key={i} className="aspect-[3/4] animate-pulse rounded-xl bg-[#131316]" />)}
          </div>
        ) : evos.length === 0 ? (
          <div className="py-16 text-center">
            <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500/10 to-purple-500/10 text-4xl">⚒️</div>
            <h3 className="text-lg font-semibold text-white">No Z forged yet</h3>
            <p className="mt-1 text-sm text-gray-500">Be the first to forge a Z and start trading.</p>
            <Link href="/forge" className="mt-6 inline-block rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 px-6 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90">
              Forge Your Z →
            </Link>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
              {filteredEvos.map(evo => <ZCard key={evo.id} evo={evo} onClick={() => setSelectedEvo(evo)} />)}
            </div>
            {filteredEvos.length === 0 && <div className="py-16 text-center text-sm text-gray-500">No Z found matching your filters</div>}
          </>
        )}
      </section>

      {/* Footer */}
      <footer className="border-t border-[#1a1a1e] py-10">
        <div className="mx-auto max-w-7xl px-4 lg:px-6">
          <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 text-sm font-bold">Z</div>
              <div>
                <p className="text-sm font-bold">EVO Protocol</p>
                <p className="text-xs text-gray-500">Stateful Capital. SOL that remembers.</p>
              </div>
            </div>
            <div className="flex items-center gap-6 text-xs text-gray-500">
              <a href="https://github.com/stephenclawdbot-png/EVO" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">GitHub</a>
              <a href="https://solscan.io/account/2AUfmSABAwfSAzMWuDfWXzm6TVVvVapWgtrAEBU4FHeR" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">Program</a>
              <span>Powered by Solana</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

function StatItem({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="px-4 py-4 lg:px-6">
      <p className="text-xs text-gray-500">{label}</p>
      <p className={`mt-1 text-lg font-bold ${accent || 'text-white'}`}>{value}</p>
    </div>
  );
}