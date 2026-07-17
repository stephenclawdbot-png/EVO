'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import { useConnection } from '@solana/wallet-adapter-react';
import { useParams } from 'next/navigation';
import { EvoCard } from '@/components/EvoCard';
import { EvoDetail } from '@/components/EvoDetail';
import { Nav } from '@/components/Nav';
import { EVOData, CollectionData, evoAccountToData, collectionConfigToData } from '@/lib/evo-data';
import {
  readCollectionConfig,
  readAllEVOs,
  getCollectionPDA,
} from '@/lib/evo-program';
import Link from 'next/link';
import { IconSearch, IconArrowRight, IconHammer } from '@/components/Icons';

type SortKey = 'newest' | 'oldest' | 'most-sol' | 'most-facets' | 'most-trades' | 'price-low' | 'price-high';

export default function CollectionPage() {
  const params = useParams<{ name: string }>();
  const collectionName = decodeURIComponent(params.name);
  const { connection } = useConnection();
  const [selectedEvo, setSelectedEvo] = useState<EVOData | null>(null);
  const [filterListed, setFilterListed] = useState(false);
  const [sortBy, setSortBy] = useState<SortKey>('newest');
  const [searchQuery, setSearchQuery] = useState('');

  const [evos, setEvos] = useState<EVOData[]>([]);
  const [collection, setCollection] = useState<CollectionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setNotFound(false);
    try {
      const cfg = await readCollectionConfig(connection, collectionName);
      if (!cfg) { setNotFound(true); setEvos([]); setCollection(null); return; }
      setCollection(collectionConfigToData(cfg));
      const [collectionPda] = getCollectionPDA(collectionName);
      const onChainEvos = await readAllEVOs(connection, collectionPda, cfg.supplyCap);
      const display: EVOData[] = [];
      for (const evo of onChainEvos) {
        const d = evoAccountToData(evo, collectionName);
        if (d) display.push(d);
      }
      setEvos(display);
    } catch (err) {
      console.error('Failed to fetch EVOs:', err);
    } finally {
      setLoading(false);
    }
  }, [connection, collectionName]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const filteredEvos = useMemo(() => {
    let list = evos.filter(evo => !evo.isShattered);
    if (filterListed) list = list.filter(evo => evo.isListed);
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter(evo =>
        evo.name.toLowerCase().includes(q) ||
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
  }, [evos, filterListed, sortBy, searchQuery]);

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
    return <EvoDetail evo={selectedEvo} onBack={() => setSelectedEvo(null)} onRefresh={fetchData} />;
  }

  if (notFound && !loading) {
    return (
      <div className="min-h-screen bg-bg text-text">
        <Nav onRefresh={fetchData} />
        <div className="mx-auto max-w-lg px-3 py-20 text-center">
          <h2 className="text-lg font-bold text-text-strong">Collection not found</h2>
          <p className="mt-2 text-sm text-muted">No collection named &quot;{collectionName}&quot; exists on-chain.</p>
          <Link href="/" className="mt-5 inline-flex items-center gap-2 rounded border border-border-strong px-5 py-2 text-sm font-semibold text-text transition-colors hover:bg-surface-2">
            All collections <IconArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    );
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

      {/* Back link */}
      <div className="border-b border-border">
        <Link href="/" className="mx-auto flex max-w-7xl items-center gap-1.5 px-3 py-2 text-xs text-muted transition-colors hover:text-text lg:px-4">
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round"><path d="m12 19-7-7 7-7" /><path d="M19 12H5" /></svg>
          All collections
        </Link>
      </div>

      {/* Collection header + filters */}
      <section className="border-b border-border">
        <div className="mx-auto max-w-7xl px-3 py-2.5 lg:px-4">
          <div className="flex flex-wrap items-center gap-2">
            <div className="mr-auto">
              <h2 className="text-sm font-bold tracking-tight text-text-strong">{collectionName} Collection</h2>
              <p className="text-[11px] text-dim">{collection ? `${collection.supplyCap} supply cap` : ''}</p>
            </div>

            <Link href={`/c/${collectionName}/forge`} className="inline-flex items-center gap-1.5 rounded border border-accent bg-accent px-3 py-1 text-xs font-semibold text-white transition-colors hover:bg-accent-hover">
              <IconHammer className="h-3.5 w-3.5" /> Forge
            </Link>

            <Link href={`/admin?collection=${encodeURIComponent(collectionName)}`} className="inline-flex items-center gap-1.5 rounded border border-border-strong bg-surface px-3 py-1 text-xs font-semibold text-text transition-colors hover:border-accent hover:text-text-strong">
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>
              Manage
            </Link>

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
            <h3 className="text-sm font-semibold">No EVOs forged yet</h3>
            <p className="mt-1 text-xs text-muted">Be the first to forge in this collection.</p>
            <Link href={`/c/${collectionName}/forge`} className="mt-5 inline-flex items-center gap-2 rounded border border-accent bg-accent px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-accent-hover">
              Forge <IconArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7">
              {filteredEvos.map(evo => (
                <EvoCard key={evo.id} evo={evo} onClick={() => setSelectedEvo(evo)} isFloor={evo.id === floorEvoId} metadataUri={collection?.metadataUri} isRevealed={collection?.isRevealed} />
              ))}
            </div>
            {filteredEvos.length === 0 && (
              <div className="py-16 text-center text-xs text-muted">No EVOs matching filters</div>
            )}
          </>
        )}
      </section>
    </div>
  );
}