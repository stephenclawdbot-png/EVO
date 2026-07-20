'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import { useConnection } from '@solana/wallet-adapter-react';
import { Nav } from '@/components/Nav';
import { CollectionDiscovery, readAllCollections, readAllEVOs, getCollectionPDA, lamportsToSol } from '@/lib/evo-program';
import { CollectionData, collectionConfigToData, evoAccountToData, mergeListingData, EVOData } from '@/lib/evo-data';
import Link from 'next/link';
import {
  IconArrowRight, IconHammer, IconCollection, IconTrendingUp,
  IconFeed, IconEvolve, IconShatter, IconLock, IconSparkle,
} from '@/components/Icons';

interface CollectionSummary {
  discovery?: CollectionDiscovery;
  data: CollectionData;
  evoCount: number;
  totalLockedSol: number;
  floorPriceSol: number | null;
  listedCount: number;
}

// ── Cache helpers (stale-while-revalidate) ──
const CACHE_KEY = 'evo_collections_v1';
const CACHE_TTL = 60_000; // 60s — fresh data matters for floor prices

interface CachedSummary {
  data: CollectionData;
  evoCount: number;
  totalLockedSol: number;
  floorPriceSol: number | null;
  listedCount: number;
  cachedAt: number;
}

function loadCache(): CachedSummary[] | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const { timestamp, summaries } = JSON.parse(raw);
    if (!timestamp || !summaries) return null;
    return summaries;
  } catch { return null; }
}

function saveCache(summaries: CollectionSummary[]) {
  try {
    const cached: CachedSummary[] = summaries.map(s => ({
      data: s.data, evoCount: s.evoCount, totalLockedSol: s.totalLockedSol,
      floorPriceSol: s.floorPriceSol, listedCount: s.listedCount, cachedAt: Date.now(),
    }));
    localStorage.setItem(CACHE_KEY, JSON.stringify({ timestamp: Date.now(), summaries: cached }));
  } catch { /* quota / private mode */ }
}

const PAGE_SIZE = 8;

export default function Home() {
  const { connection } = useConnection();
  const [collections, setCollections] = useState<CollectionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [isStale, setIsStale] = useState(false); // showing cached data while revalidating

  const fetchData = useCallback(async (opts?: { skipCache?: boolean }) => {
    // Stale-while-revalidate: show cached data instantly, then re-fetch
    if (!opts?.skipCache) {
      const cached = loadCache();
      if (cached) {
        const isExpired = cached[0] && (Date.now() - cached[0].cachedAt > CACHE_TTL);
        // Reconstruct CollectionSummary from cache (discovery not needed for display)
        const cachedSummaries: CollectionSummary[] = cached.map(c => ({
          discovery: undefined, // not used by card UI
          data: c.data, evoCount: c.evoCount, totalLockedSol: c.totalLockedSol,
          floorPriceSol: c.floorPriceSol, listedCount: c.listedCount,
        }));
        setCollections(cachedSummaries);
        setLoading(false);
        if (isExpired) {
          setIsStale(true);
          fetchData({ skipCache: true }); // revalidate in background
        }
        return;
      }
    }

    if (!opts?.skipCache) setLoading(true);
    try {
      const discovered = await readAllCollections(connection);

      // Parallelize EVO fetches in batches of 8 to avoid RPC rate limits
      const batchSize = 8;
      const summaries: CollectionSummary[] = [];

      for (let i = 0; i < discovered.length; i += batchSize) {
        const batch = discovered.slice(i, i + batchSize);
        const results = await Promise.all(
          batch.map(async (disc): Promise<CollectionSummary> => {
            const data = collectionConfigToData(disc.config);
            const [collectionPda] = getCollectionPDA(disc.config.name);
            const evos = await readAllEVOs(connection, collectionPda, disc.config.supplyCap);
            const display: EVOData[] = [];
            for (const evo of evos) {
              const d = evoAccountToData(evo, disc.config.name);
              if (d) display.push(d);
            }
            await mergeListingData(connection, display);
            const active = display.filter(e => !e.isShattered);
            const listed = active.filter(e => e.isListed);
            const totalLocked = active.reduce((sum, e) => sum + e.lockedLamports, 0);
            const floor = listed.length > 0
              ? Math.min(...listed.map(e => e.listPriceLamports || Infinity))
              : null;
            return {
              discovery: disc,
              data,
              evoCount: active.length,
              totalLockedSol: lamportsToSol(totalLocked),
              floorPriceSol: floor !== null ? lamportsToSol(floor) : null,
              listedCount: listed.length,
            };
          })
        );
        summaries.push(...results);
      }

      summaries.sort((a, b) => b.totalLockedSol - a.totalLockedSol);
      setCollections(summaries);
      setVisibleCount(PAGE_SIZE);
      saveCache(summaries);
      setIsStale(false);
    } catch (err) {
      console.error('Failed to fetch collections:', err);
    } finally {
      setLoading(false);
    }
  }, [connection]);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 'r' && !e.metaKey && !e.ctrlKey && document.activeElement?.tagName !== 'INPUT') {
        fetchData();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [fetchData]);

  const globalStats = useMemo(() => {
    const totalEVOs = collections.reduce((s, c) => s + c.evoCount, 0);
    const totalLocked = collections.reduce((s, c) => s + c.totalLockedSol, 0);
    const totalListed = collections.reduce((s, c) => s + c.listedCount, 0);
    return { totalCollections: collections.length, totalEVOs, totalLocked, totalListed };
  }, [collections]);

  // Search results for dropdown
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase();
    return collections
      .filter(c => c.data.name.toLowerCase().includes(q))
      .slice(0, 6);
  }, [searchQuery, collections]);

  const filteredCollections = useMemo(() => {
    if (!searchQuery.trim()) return collections;
    const q = searchQuery.toLowerCase();
    return collections.filter(c => c.data.name.toLowerCase().includes(q));
  }, [searchQuery, collections]);

  const ticker = [
    { label: 'Collections', value: loading ? '--' : String(globalStats.totalCollections) },
    { label: 'EVOs', value: loading ? '--' : String(globalStats.totalEVOs) },
    { label: 'Locked', value: loading ? '--' : `${globalStats.totalLocked.toFixed(2)} SOL`, tone: 'pos' as const },
    { label: 'Listed', value: loading ? '--' : String(globalStats.totalListed) },
  ];

  return (
    <div className="min-h-screen bg-bg text-text">
      <Nav onRefresh={fetchData} ticker={ticker} />

      {/* ─── Hero — compact ─── */}
      <section className="relative overflow-hidden border-b border-border">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute left-1/2 top-1/2 h-[400px] w-[400px] -translate-x-1/2 -translate-y-1/2 rounded-full blur-3xl"
            style={{ background: 'radial-gradient(circle, #818cf814, transparent 65%)' }} />
        </div>
        <div className="relative mx-auto flex max-w-4xl flex-col items-center px-4 py-12 text-center lg:py-16">
          <span className="mb-4 inline-flex items-center gap-1.5 rounded-full border border-border-strong bg-surface px-3 py-1 text-[11px] text-muted">
            <IconSparkle className="h-3 w-3 text-accent" />
            New primitive on Solana
          </span>
          <h1 className="text-3xl font-bold leading-[1.05] tracking-tight text-text-strong sm:text-4xl lg:text-5xl">
            Assets that don't stay the same.
          </h1>
          <p className="mt-4 max-w-md text-sm text-muted">
            EVOs hold locked SOL, evolve over time, and can be shattered to recover their value.
          </p>
          <p className="mt-3 max-w-lg text-[12px] font-mono leading-relaxed text-dim">
            Lock SOL. Mint evolving art. Trade on-chain. No admin keys.
          </p>
        </div>
      </section>

      {/* ─── Collections — primary focus ─── */}
      <section id="collections" className="mx-auto max-w-7xl px-3 py-8 lg:px-4">
        <div className="mb-4 flex items-center gap-2">
          <IconCollection className="h-4 w-4 text-accent" />
          <h2 className="text-sm font-bold tracking-tight text-text-strong">Collections</h2>
          {collections.length > 0 && (
            <span className="font-mono text-[11px] text-dim">{collections.length}</span>
          )}

          {/* Search */}
          {collections.length > 0 && (
            <div className="relative ml-auto">
              <div className="relative">
                <svg className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-dim" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
                </svg>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => { setSearchQuery(e.target.value); setShowDropdown(true); }}
                  onFocus={() => setShowDropdown(true)}
                  onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && searchResults.length > 0) {
                      window.location.href = `/c/${searchResults[0].data.name}`;
                    }
                  }}
                  placeholder="Search collections…"
                  className="w-40 rounded border border-border bg-surface py-1 pl-7 pr-3 text-xs text-text placeholder:text-dim focus:border-accent focus:outline-none sm:w-56"
                />
              </div>

              {/* Dropdown results */}
              {showDropdown && searchResults.length > 0 && (
                <div className="absolute right-0 top-full z-20 mt-1 w-64 overflow-hidden rounded border border-border-strong bg-surface shadow-lg">
                  {searchResults.map(c => {
                    const logoUri = (() => {
                      try { return new URL(c.data.metadataUri).searchParams.get('logo') || ''; }
                      catch { return ''; }
                    })();
                    return (
                      <Link
                        key={c.data.name}
                        href={`/c/${c.data.name}`}
                        className="flex items-center gap-2 px-3 py-2 transition-colors hover:bg-surface-2"
                        onClick={() => { setShowDropdown(false); setSearchQuery(''); }}
                      >
                        {logoUri ? (
                          <img src={logoUri} alt="" className="h-5 w-5 rounded-full border border-border object-cover" />
                        ) : (
                          <span className="flex h-5 w-5 items-center justify-center rounded-full border border-border bg-bg text-[9px] font-bold text-dim">
                            {c.data.name.charAt(0).toUpperCase()}
                          </span>
                        )}
                        <span className="text-xs font-semibold text-text">{c.data.name}</span>
                        <span className="ml-auto font-mono text-[10px] text-dim">{c.evoCount} EVOs</span>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {loading ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-32 animate-pulse rounded border border-border bg-surface" />
            ))}
          </div>
        ) : collections.length === 0 ? (
          <div className="py-20 text-center">
            <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded border border-border bg-surface text-accent">
              <IconCollection className="h-6 w-6" />
            </div>
            <h3 className="text-sm font-semibold">No collections yet</h3>
            <p className="mx-auto mt-1 max-w-xs text-xs text-muted">
              Meld is permissionless. Create the first collection from the website — no SDK required.
            </p>
            <Link href="/create"
              className="mt-5 inline-flex items-center gap-2 rounded border border-accent bg-accent px-5 py-2 text-sm font-bold text-white transition-colors hover:bg-accent-hover">
              <IconHammer className="h-4 w-4" /> Create Collection
            </Link>
          </div>
        ) : filteredCollections.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-xs text-muted">No collections match &quot;{searchQuery}&quot;</p>
          </div>
        ) : (
          <>
            {isStale && (
              <p className="mb-2 text-[10px] text-dim">Updating live data…</p>
            )}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {filteredCollections.slice(0, visibleCount).map(c => (
                <CollectionCard key={c.data.name} summary={c} />
              ))}
            </div>
            {visibleCount < filteredCollections.length && (
              <div className="mt-6 text-center">
                <button
                  onClick={() => setVisibleCount(filteredCollections.length)}
                  className="inline-flex items-center gap-2 rounded border border-border-strong bg-surface px-5 py-2 text-xs font-semibold text-text transition-colors hover:border-accent hover:text-text-strong"
                >
                  Show all {filteredCollections.length} collections
                </button>
              </div>
            )}
          </>
        )}
      </section>

      {/* ─── How it works — five operations ─── */}
      <section className="border-t border-border bg-surface">
        <div className="mx-auto max-w-6xl px-4 py-12 lg:py-16">
          <div className="mb-8 text-center">
            <p className="text-[11px] uppercase tracking-[0.2em] text-dim">How it works</p>
            <h2 className="mt-2 text-lg font-semibold tracking-tight text-text-strong sm:text-xl">
              Five operations. One object.
            </h2>
          </div>
          <div className="grid grid-cols-1 gap-px overflow-hidden rounded border border-border bg-border sm:grid-cols-2 lg:grid-cols-5">
            <OpCard icon={IconHammer} name="Forge" desc="Lock SOL into a PDA. A new EVO is born with a floor value." />
            <OpCard icon={IconTrendingUp} name="Trade" desc="Buy and sell on-chain. Royalties enforced. The floor travels." />
            <OpCard icon={IconFeed} name="Feed" desc="Add SOL to the lock. The object grows in value and form." />
            <OpCard icon={IconEvolve} name="Evolve" desc="Hit a threshold. The art changes. The state machine is the art." />
            <OpCard icon={IconShatter} name="Shatter" desc="Destroy the EVO. Recover the locked SOL, minus a fee." />
          </div>
          <div className="mt-8 flex items-center justify-center gap-2 text-center text-xs text-dim">
            <IconLock className="h-3.5 w-3.5 text-accent" />
            No admin keys. No escrow. The SOL lives in the PDA.
          </div>
        </div>
      </section>

      {/* ─── Footer ─── */}
      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2 px-3 py-3 text-[11px] text-dim lg:px-4">
          <span>Meld — EVO Protocol — Assets that don&apos;t stay the same.</span>
          <div className="flex items-center gap-4">
            <a href="https://github.com/stephenclawdbot-png/EVO" target="_blank" rel="noopener noreferrer" className="transition-colors hover:text-text">GitHub</a>
            <a href="https://solscan.io/account/HGLPG19Vkg3nNS1VJfPqY8Wtu2Ets4oKMTxAZRDRe3Ei" target="_blank" rel="noopener noreferrer" className="transition-colors hover:text-text">Program</a>
            <span>Powered by <a href="https://www.helius.dev/" target="_blank" rel="noopener noreferrer" className="transition-colors hover:text-text">Helius</a> · <a href="https://supabase.com/" target="_blank" rel="noopener noreferrer" className="transition-colors hover:text-text">Supabase</a> · <a href="https://solana.com/" target="_blank" rel="noopener noreferrer" className="transition-colors hover:text-text">Solana</a></span>
          </div>
        </div>
      </footer>
    </div>
  );
}

function OpCard({ icon: Icon, name, desc }: { icon: typeof IconHammer; name: string; desc: string }) {
  return (
    <div className="bg-surface p-5 transition-colors hover:bg-surface-2">
      <Icon className="h-4 w-4 text-muted" />
      <h3 className="mt-3 text-sm font-semibold text-text-strong">{name}</h3>
      <p className="mt-1.5 text-xs leading-relaxed text-muted">{desc}</p>
    </div>
  );
}

// Capital-first collection card — locked SOL is the hero, art is context
function CollectionCard({ summary }: { summary: CollectionSummary }) {
  const { data, evoCount, totalLockedSol, floorPriceSol, listedCount } = summary;
  const supplyPct = data.supplyCap > 0 ? (data.currentSupply / data.supplyCap) * 100 : 0;

  // Parse logo URI from metadata_uri query params
  const logoUri = (() => {
    try { return new URL(data.metadataUri).searchParams.get('logo') || ''; }
    catch { return ''; }
  })();

  return (
    <Link href={`/c/${data.name}`} className="group block overflow-hidden rounded border border-border bg-surface transition-colors hover:border-border-strong">
      <div className="border-b border-border px-3 py-3">
        <div className="flex items-baseline justify-between">
          <div className="flex items-center gap-2">
            {logoUri ? (
              <img src={logoUri} alt="" className="h-6 w-6 rounded-full border border-border object-cover" />
            ) : (
              <span className="flex h-6 w-6 items-center justify-center rounded-full border border-border bg-bg text-[10px] font-bold text-dim">
                {data.name.charAt(0).toUpperCase()}
              </span>
            )}
            <h3 className="text-sm font-bold tracking-tight text-text-strong">{data.name}</h3>
          </div>
          <span className="font-mono text-[10px] text-dim">{data.creator.slice(0, 4)}...{data.creator.slice(-4)}</span>
        </div>
        <div className="mt-2 flex items-baseline gap-1">
          <span className="font-mono text-lg font-bold text-positive">{totalLockedSol.toFixed(2)}</span>
          <span className="text-[11px] text-dim">SOL locked</span>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-px bg-border">
        <Stat label="EVOs" value={String(evoCount)} />
        <Stat label="Listed" value={String(listedCount)} />
        <Stat label="Floor" value={floorPriceSol !== null ? `${floorPriceSol.toFixed(2)}` : '--'} />
      </div>

      <div className="px-3 py-2">
        <div className="flex items-center justify-between text-[10px] text-dim">
          <span>Supply</span>
          <span className="font-mono">{data.currentSupply}/{data.supplyCap}</span>
        </div>
        <div className="mt-1 h-1 overflow-hidden rounded-full bg-bg">
          <div className="h-full bg-accent transition-all" style={{ width: `${supplyPct}%` }} />
        </div>
      </div>

      <div className="flex items-center justify-between border-t border-border px-3 py-2 text-[11px]">
        <span className="text-dim">Mint {data.mintPriceSol} SOL · Lock {data.lockAmountSol} SOL</span>
        <span className="flex items-center gap-1 text-accent transition-transform group-hover:translate-x-0.5">
          <IconHammer className="h-3 w-3" /> Forge
        </span>
      </div>
    </Link>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-surface px-2 py-1.5 text-center">
      <p className="text-[9px] uppercase tracking-wide text-dim">{label}</p>
      <p className="mt-0.5 font-mono text-xs font-semibold text-text">{value}</p>
    </div>
  );
}
