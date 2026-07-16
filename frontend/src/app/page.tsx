'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import { useConnection } from '@solana/wallet-adapter-react';
import { ZCard } from '@/components/ZCard';
import { ZDetail } from '@/components/ZDetail';
import { Nav } from '@/components/Nav';
import { EVOData, CollectionData, CREATURES } from '@/lib/evo-data';
import { Rarity, RARITY_COLORS } from '@/lib/creatures';
import {
  readCollectionConfig,
  readAllEVOs,
  getCollectionPDA,
} from '@/lib/evo-program';
import { evoAccountToData, collectionConfigToData } from '@/lib/evo-data';
import Link from 'next/link';
import { IconSearch, IconArrowRight, IconHammer } from '@/components/Icons';

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
      floorPrice: floorPrice > 0 ? floorPrice.toFixed(2) : '--',
      shattered: evos.filter(e => e.isShattered).length,
    };
  }, [evos]);

  const floorEvoId = useMemo(() => {
    const listed = evos.filter(e => e.isListed && !e.isShattered);
    if (listed.length === 0) return null;
    return listed.reduce((min, e) => (e.listPrice! < min.listPrice! ? e : min)).id;
  }, [evos]);

  // Keyboard: R to refresh, / to focus search
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 'r' && !e.metaKey && !e.ctrlKey && document.activeElement?.tagName !== 'INPUT') {
        fetchData();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [fetchData]);

  if (selectedEvo) {
    return <ZDetail evo={selectedEvo} onBack={() => setSelectedEvo(null)} onRefresh={fetchData} />;
  }

  const ticker = [
    { label: 'Items', value: loading ? '--' : String(stats.total) },
    { label: 'Floor', value: loading ? '--' : `${stats.floorPrice}`, tone: 'neutral' as const },
    { label: 'Locked', value: loading ? '--' : `${stats.totalLocked} SOL`, tone: 'pos' as const },
    { label: 'Listed', value: loading ? '--' : String(stats.listedCount) },
    ...(collection ? [
      { label: 'Supply', value: `${collection.currentSupply}/${collection.supplyCap}` },
      { label: 'Mint', value: `${collection.mintPriceSol} SOL` },
    ] : []),
  ];

  return (
    <div className="min-h-screen bg-bg text-text">
      <Nav onRefresh={fetchData} ticker={ticker} />

      {/* Hero — only when empty */}
      {evos.length === 0 && !loading && (
        <section className="border-b border-border">
          <div className="mx-auto max-w-3xl px-4 py-16 text-center lg:py-24">
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Stateful Capital.
              <br />
              <span className="text-muted">SOL that remembers.</span>
            </h1>
            <p className="mx-auto mt-5 max-w-md text-sm text-muted">
              Every collectible has real value inside it. Trade stories. Keep your floor.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link href="/forge" className="inline-flex items-center gap-2 rounded border border-accent bg-accent px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-accent-hover">
                <IconHammer className="h-4 w-4" /> Forge your Z
              </Link>
              <a href="https://github.com/stephenclawdbot-png/EVO" target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded border border-border-strong px-6 py-2.5 text-sm font-semibold text-text transition-colors hover:bg-surface-2">
                Learn more <IconArrowRight className="h-4 w-4" />
              </a>
            </div>

            {/* Fee schedule */}
            {collection && (
              <div className="mx-auto mt-12 grid max-w-md grid-cols-3 gap-px overflow-hidden rounded border border-border bg-border">
                <FeeCell label="Mint" value={`${collection.mintPriceSol}`} />
                <FeeCell label="Lock" value={`${collection.lockAmountSol}`} />
                <FeeCell label="Shatter fee" value={`${collection.shatterFeeBps / 100}%`} />
              </div>
            )}
          </div>
        </section>
      )}

      {/* Collection header + filters */}
      <section className="border-b border-border">
        <div className="mx-auto max-w-7xl px-3 py-2.5 lg:px-4">
          <div className="flex flex-wrap items-center gap-2">
            <div className="mr-auto">
              <h2 className="text-sm font-bold tracking-tight text-text-strong">Z Collection</h2>
              <p className="text-[11px] text-dim">108 supply - The first EVO on Solana</p>
            </div>

            <div className="relative">
              <IconSearch className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-dim" />
              <input
                type="text"
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="t-input w-32 py-1 pl-7 pr-2 text-xs"
              />
            </div>

            <select value={filterRarity} onChange={(e) => setFilterRarity(e.target.value as Rarity | 'all')}
              className="rounded border border-border-strong bg-surface px-2 py-1 text-[11px] text-text focus:border-accent focus:outline-none">
              <option value="all">All rarities</option>
              {(Object.keys(RARITY_COLORS) as Rarity[]).map(r => <option key={r} value={r}>{r}</option>)}
            </select>

            <button onClick={() => setFilterListed(!filterListed)}
              className={`rounded border px-2 py-1 text-[11px] font-medium transition-colors ${
                filterListed ? 'border-positive/40 bg-positive-soft text-positive' : 'border-border-strong bg-surface text-muted hover:text-text'
              }`}>
              Listed
            </button>

            <select value={sortBy} onChange={(e) => setSortBy(e.target.value as SortKey)}
              className="rounded border border-border-strong bg-surface px-2 py-1 text-[11px] text-text focus:border-accent focus:outline-none">
              <option value="newest">Newest</option>
              <option value="oldest">Oldest</option>
              <option value="price-low">Price: low-high</option>
              <option value="price-high">Price: high-low</option>
              <option value="most-sol">Most SOL</option>
              <option value="most-trades">Most trades</option>
            </select>
          </div>
        </div>
      </section>

      {/* Gallery */}
      <section className="mx-auto max-w-7xl px-3 py-3 lg:px-4">
        {loading ? (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7">
            {Array.from({ length: 18 }).map((_, i) => <div key={i} className="aspect-square animate-pulse rounded border border-border bg-surface" />)}
          </div>
        ) : evos.length === 0 ? (
          <div className="py-20 text-center">
            <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded border border-border bg-surface text-accent">
              <IconHammer className="h-6 w-6" />
            </div>
            <h3 className="text-sm font-semibold">No Z forged yet</h3>
            <p className="mt-1 text-xs text-muted">Be the first to forge and start trading.</p>
            <Link href="/forge" className="mt-5 inline-flex items-center gap-2 rounded border border-accent bg-accent px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-accent-hover">
              Forge your Z <IconArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7">
              {filteredEvos.map(evo => (
                <ZCard key={evo.id} evo={evo} onClick={() => setSelectedEvo(evo)} isFloor={evo.id === floorEvoId} />
              ))}
            </div>
            {filteredEvos.length === 0 && (
              <div className="py-16 text-center text-xs text-muted">No Z matching filters</div>
            )}
          </>
        )}
      </section>

      {/* Footer */}
      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2 px-3 py-3 text-[11px] text-dim lg:px-4">
          <span>EVO Protocol - Stateful Capital. SOL that remembers.</span>
          <div className="flex items-center gap-4">
            <a href="https://github.com/stephenclawdbot-png/EVO" target="_blank" rel="noopener noreferrer" className="transition-colors hover:text-text">GitHub</a>
            <a href="https://solscan.io/account/2AUfmSABAwfSAzMWuDfWXzm6TVVvVapWgtrAEBU4FHeR" target="_blank" rel="noopener noreferrer" className="transition-colors hover:text-text">Program</a>
            <span>Powered by Solana</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

function FeeCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-bg px-3 py-2 text-center">
      <p className="text-[10px] uppercase tracking-wide text-dim">{label}</p>
      <p className="mt-0.5 font-mono text-sm font-semibold text-text-strong">{value}</p>
    </div>
  );
}
