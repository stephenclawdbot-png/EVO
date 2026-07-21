'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import { useConnection } from '@solana/wallet-adapter-react';
import { useParams, useRouter } from 'next/navigation';
import { EvoCard } from '@/components/EvoCard';
import { Nav } from '@/components/Nav';
import { Footer } from '@/components/Footer';
import { TradeChart } from '@/components/TradeChart';
import { TradingViewWidget } from '@/components/TradingViewWidget';
import { EVOData, CollectionData, evoAccountToData, collectionConfigToData, mergeListingData } from '@/lib/evo-data';
import {
  readCollectionConfig,
  readAllEVOs,
  getCollectionPDA,
} from '@/lib/evo-program';
import { readCollectionTradeHistory, TradeEvent } from '@/lib/evo-chart';
import Link from 'next/link';
import { IconSearch, IconArrowRight, IconHammer } from '@/components/Icons';

type SortKey = 'newest' | 'oldest' | 'most-sol' | 'most-facets' | 'most-trades' | 'price-low' | 'price-high';

function safeExternalUrl(raw: string | null | undefined): string | undefined {
  if (!raw) return undefined;
  try {
    const u = new URL(raw);
    if (u.protocol === 'http:' || u.protocol === 'https:') return u.href;
    return undefined;
  } catch {
    return undefined;
  }
}

function parseSocialLinks(uri: string): { website?: string; twitter?: string; telegram?: string; discord?: string; logo?: string } {
  try {
    const url = new URL(uri);
    return {
      website: safeExternalUrl(url.searchParams.get('website')),
      twitter: safeExternalUrl(url.searchParams.get('twitter')),
      telegram: safeExternalUrl(url.searchParams.get('telegram')),
      discord: safeExternalUrl(url.searchParams.get('discord')),
      logo: safeExternalUrl(url.searchParams.get('logo')),
    };
  } catch {
    return {};
  }
}

function SocialIcons({ links }: { links: { website?: string; twitter?: string; telegram?: string; discord?: string; logo?: string } }) {
  const icons = [];
  if (links.website) icons.push({ href: links.website, label: 'Website', path: 'M12 20h9 1.5V3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z' });
  // Actually let me use simpler approach
  return (
    <div className="flex items-center gap-1.5">
      {links.website && (
        <a href={links.website} target="_blank" rel="noreferrer" title="Website"
          className="flex h-7 w-7 items-center justify-center rounded border border-border-strong bg-surface text-muted transition-colors hover:border-accent hover:text-accent">
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" /><path d="M2 12h20" /><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
          </svg>
        </a>
      )}
      {links.twitter && (
        <a href={links.twitter} target="_blank" rel="noreferrer" title="X / Twitter"
          className="flex h-7 w-7 items-center justify-center rounded border border-border-strong bg-surface text-muted transition-colors hover:border-accent hover:text-accent">
          <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
          </svg>
        </a>
      )}
      {links.telegram && (
        <a href={links.telegram} target="_blank" rel="noreferrer" title="Telegram"
          className="flex h-7 w-7 items-center justify-center rounded border border-border-strong bg-surface text-muted transition-colors hover:border-accent hover:text-accent">
          <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .17.338c.016.084.039.276-.02.434-.06.156-.378.94-.51 1.162-.13.218-.24.42-.43.625-.19.207-.318.348-.536.547-.218.198-.437.41-.708.41-.27 0-.34-.177-.605-.177-.266 0-.427.18-.66.388-.234.207-.36.41-.69.41-.331 0-.587-.29-.83-.54-.243-.25-.49-.49-.49-.76 0-.27.246-.49.49-.74.244-.25.49-.49.49-.76 0-.27-.246-.49-.49-.74-.244-.25-.49-.49-.49-.76 0-.27.246-.49.49-.74.244-.25.49-.49.49-.76 0-.27-.246-.49-.49-.74-.244-.25-.49-.49-.49-.76 0-.27.246-.49.49-.74.244-.25.49-.49.49-.76 0-.27-.246-.49-.49-.74-.244-.25-.49-.49-.49-.76 0-.27.246-.49.49-.74.244-.25.49-.49.49-.76z" />
          </svg>
        </a>
      )}
      {links.discord && (
        <a href={links.discord} target="_blank" rel="noreferrer" title="Discord"
          className="flex h-7 w-7 items-center justify-center rounded border border-border-strong bg-surface text-muted transition-colors hover:border-accent hover:text-accent">
          <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.872-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128c.126-.094.252-.192.372-.291a.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.009c.12.099.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
          </svg>
        </a>
      )}
    </div>
  );
}

export default function CollectionPage() {
  const params = useParams<{ name: string }>();
  const collectionName = decodeURIComponent(params.name);
  const router = useRouter();
  const { connection } = useConnection();
  const [filterListed, setFilterListed] = useState(false);
  const [sortBy, setSortBy] = useState<SortKey>('newest');
  const [searchQuery, setSearchQuery] = useState('');
  const [mintPillOpen, setMintPillOpen] = useState(false);

  const [evos, setEvos] = useState<EVOData[]>([]);
  const [collection, setCollection] = useState<CollectionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [trades, setTrades] = useState<TradeEvent[]>([]);
  const [tradesLoading, setTradesLoading] = useState(false);
  const [dbLogo, setDbLogo] = useState('');
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Fetch logo from database (fallback when not in on-chain metadata)
  useEffect(() => {
    let active = true;
    fetch(`/api/collection-logo?name=${encodeURIComponent(collectionName)}`)
      .then(r => r.json())
      .then(d => { if (active && d.logo) setDbLogo(d.logo); })
      .catch(() => {});
    return () => { active = false; };
  }, [collectionName]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setNotFound(false);
    setFetchError(null);
    try {
      const cfg = await readCollectionConfig(connection, collectionName);
      if (!cfg) { setNotFound(true); setEvos([]); setCollection(null); return; }
      const colData = collectionConfigToData(cfg);
      setCollection(colData);
      const [collectionPda] = getCollectionPDA(collectionName);
      const onChainEvos = await readAllEVOs(connection, collectionPda, cfg.supplyCap);
      const display: EVOData[] = [];
      for (const evo of onChainEvos) {
        const d = evoAccountToData(evo, collectionName);
        if (d) display.push(d);
      }
      await mergeListingData(connection, display);
      setEvos(display);

      // trade history for the chart (non-blocking)
      setTradesLoading(true);
      readCollectionTradeHistory(connection, collectionName, Math.round(colData.mintPriceSol * 1e9))
        .then(setTrades)
        .catch(() => setTrades([]))
        .finally(() => setTradesLoading(false));
    } catch (err) {
      console.error('Failed to fetch EVOs:', err);
      setFetchError(err instanceof Error ? err.message : String(err));
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
              <div className="flex items-center gap-2">
                {collection?.metadataUri && parseSocialLinks(collection.metadataUri).logo ? (
                  <img src={parseSocialLinks(collection.metadataUri).logo!} alt="" className="h-6 w-6 rounded-full border border-border object-cover" />
                ) : dbLogo ? (
                  <img src={dbLogo} alt="" className="h-6 w-6 rounded-full border border-border object-cover" />
                ) : null}
                <h2 className="text-sm font-bold tracking-tight text-text-strong">{collectionName} Collection</h2>
                {collection?.metadataUri && <SocialIcons links={parseSocialLinks(collection.metadataUri)} />}
              </div>
              <p className="text-[11px] text-dim">{collection ? `${collection.supplyCap} supply cap` : ''}</p>
            </div>

            <Link href={`/c/${collectionName}/forge`} className="inline-flex items-center gap-1.5 rounded border border-accent bg-accent px-3 py-1 text-xs font-semibold text-white transition-colors hover:bg-accent-hover">
              <IconHammer className="h-3.5 w-3.5" /> Forge
            </Link>

            {/* Mint availability dropdown pill */}
            {collection && !loading && (() => {
              const minted = collection.currentSupply;
              const cap = collection.supplyCap;
              const remaining = Math.max(0, cap - minted);
              const pct = cap > 0 ? Math.min(100, (minted / cap) * 100) : 0;
              const soldOut = remaining === 0;
              const filling = pct >= 75 && !soldOut;
              const statusLabel = soldOut ? 'Sold out' : filling ? 'Almost gone' : pct >= 40 ? 'Filling up' : 'Available';
              const statusColor = soldOut ? 'text-dim' : filling ? 'text-warning' : 'text-positive';
              const dotColor = soldOut ? 'bg-dim' : filling ? 'bg-warning' : 'bg-positive';
              const barColor = soldOut ? 'bg-dim' : filling ? 'bg-warning' : 'bg-positive';
              return (
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setMintPillOpen((v) => !v)}
                    onBlur={() => setTimeout(() => setMintPillOpen(false), 150)}
                    className={`inline-flex items-center gap-1.5 rounded border border-border-strong bg-surface px-2.5 py-1 text-[11px] font-semibold transition-colors hover:border-accent ${mintPillOpen ? 'border-accent' : ''}`}
                    aria-expanded={mintPillOpen}
                  >
                    <span className={`h-1.5 w-1.5 rounded-full ${dotColor}`} />
                    <span className="tabular-nums text-text-strong">{remaining}</span>
                    <span className="text-dim">left</span>
                    <svg className={`h-3 w-3 text-dim transition-transform ${mintPillOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
                  </button>
                  {mintPillOpen && (
                    <div className="absolute right-0 z-30 mt-1 w-60 rounded-lg border border-border bg-surface px-3 py-2.5 shadow-lg">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-medium uppercase tracking-wider text-dim">Mint remaining</span>
                        <span className={`flex items-center gap-1 text-[10px] font-semibold ${statusColor}`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${dotColor}`} />
                          {statusLabel}
                        </span>
                      </div>
                      <div className="mt-1.5 flex items-baseline gap-2">
                        <span className="text-2xl font-bold tabular-nums text-text-strong">{remaining}</span>
                        <span className="text-[11px] text-dim">/ {cap}</span>
                      </div>
                      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
                        <div className={`h-full rounded-full transition-all duration-500 ${barColor}`} style={{ width: `${pct}%` }} />
                      </div>
                      <div className="mt-1 flex items-center justify-between text-[10px] text-dim">
                        <span>{minted} minted</span>
                        <span>{pct.toFixed(0)}% claimed</span>
                      </div>
                      <Link
                        href={`/c/${collectionName}/forge`}
                        className="mt-2.5 flex items-center justify-center gap-1.5 rounded border border-accent bg-accent px-3 py-1.5 text-[11px] font-semibold text-white transition-colors hover:bg-accent-hover"
                      >
                        <IconHammer className="h-3.5 w-3.5" /> {soldOut ? 'View forge' : 'Forge now'}
                      </Link>
                    </div>
                  )}
                </div>
              );
            })()}

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

      {/* Trade chart — TradingView + internal on-chain data */}
      <section className="mx-auto max-w-7xl px-3 pt-3 lg:px-4">
        <TradingViewWidget events={trades} loading={tradesLoading} currentFloorSol={parseFloat(stats.floorPrice)} collectionName={collectionName} />
      </section>

      {/* Error banner */}
      {fetchError && (
        <div className="mx-auto max-w-7xl px-3 pt-3 lg:px-4">
          <div className="flex items-center gap-2 rounded border border-negative/30 bg-negative-soft px-3 py-2 text-xs text-negative">
            <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path d="M12 9v4M12 17h.01M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /></svg>
            <span>Failed to load EVOs: {fetchError}</span>
            <button onClick={() => fetchData()} className="ml-auto rounded border border-negative/30 px-2 py-0.5 text-[10px] hover:bg-negative/10">Retry</button>
          </div>
        </div>
      )}

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
                <EvoCard
                  key={evo.id}
                  evo={evo}
                  href={`/c/${encodeURIComponent(collectionName)}/${evo.id}`}
                  onClick={() => router.push(`/c/${encodeURIComponent(collectionName)}/${evo.id}`)}
                  isFloor={evo.id === floorEvoId}
                  metadataUri={collection?.metadataUri}
                  isRevealed={collection?.isRevealed}
                  evolveFeedThreshold={collection?.evolveFeedThreshold}
                  evolveLockedThreshold={collection?.evolveLockedThreshold}
                  evolveHoldSeconds={collection?.evolveHoldSeconds}
                />
              ))}
            </div>
            {filteredEvos.length === 0 && (
              <div className="py-16 text-center text-xs text-muted">No EVOs matching filters</div>
            )}
          </>
        )}
      </section>
            <Footer />
          </div>
        );
      }