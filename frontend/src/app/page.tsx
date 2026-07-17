'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import { useConnection } from '@solana/wallet-adapter-react';
import { Nav } from '@/components/Nav';
import { CollectionDiscovery, readAllCollections, readAllEVOs, getCollectionPDA, lamportsToSol } from '@/lib/evo-program';
import { CollectionData, collectionConfigToData } from '@/lib/evo-data';
import Link from 'next/link';
import { IconArrowRight, IconHammer, IconCollection } from '@/components/Icons';

interface CollectionSummary {
  discovery: CollectionDiscovery;
  data: CollectionData;
  evoCount: number;
  totalLockedSol: number;
  floorPriceSol: number | null;
  listedCount: number;
}

export default function Home() {
  const { connection } = useConnection();
  const [collections, setCollections] = useState<CollectionSummary[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const discovered = await readAllCollections(connection);
      const summaries: CollectionSummary[] = [];

      for (const disc of discovered) {
        const data = collectionConfigToData(disc.config);
        const [collectionPda] = getCollectionPDA(disc.config.name);
        const evos = await readAllEVOs(connection, collectionPda, disc.config.supplyCap);
        const active = evos.filter(e => !e.isShattered);
        const listed = active.filter(e => e.isListed);
        const totalLocked = active.reduce((sum, e) => sum + e.lockedLamports, 0);
        const floor = listed.length > 0
          ? Math.min(...listed.map(e => e.listPriceLamports))
          : null;

        summaries.push({
          discovery: disc,
          data,
          evoCount: active.length,
          totalLockedSol: lamportsToSol(totalLocked),
          floorPriceSol: floor !== null ? lamportsToSol(floor) : null,
          listedCount: listed.length,
        });
      }

      // Sort by most locked SOL (capital-first hierarchy)
      summaries.sort((a, b) => b.totalLockedSol - a.totalLockedSol);
      setCollections(summaries);
    } catch (err) {
      console.error('Failed to fetch collections:', err);
    } finally {
      setLoading(false);
    }
  }, [connection]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Keyboard: R to refresh
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 'r' && !e.metaKey && !e.ctrlKey && document.activeElement?.tagName !== 'INPUT') {
        fetchData();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [fetchData]);

  // Global stats
  const globalStats = useMemo(() => {
    const totalEVOs = collections.reduce((s, c) => s + c.evoCount, 0);
    const totalLocked = collections.reduce((s, c) => s + c.totalLockedSol, 0);
    const totalListed = collections.reduce((s, c) => s + c.listedCount, 0);
    return { totalCollections: collections.length, totalEVOs, totalLocked, totalListed };
  }, [collections]);

  const ticker = [
    { label: 'Collections', value: loading ? '--' : String(globalStats.totalCollections) },
    { label: 'EVOs', value: loading ? '--' : String(globalStats.totalEVOs) },
    { label: 'Locked', value: loading ? '--' : `${globalStats.totalLocked.toFixed(2)} SOL`, tone: 'pos' as const },
    { label: 'Listed', value: loading ? '--' : String(globalStats.totalListed) },
  ];

  return (
    <div className="min-h-screen bg-bg text-text">
      <Nav onRefresh={fetchData} ticker={ticker} />

      {/* Hero */}
      <section className="border-b border-border">
        <div className="mx-auto max-w-3xl px-4 py-14 text-center lg:py-20">
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Stateful Capital.
            <br />
            <span className="text-muted">SOL that remembers.</span>
          </h1>
          <p className="mx-auto mt-5 max-w-md text-sm text-muted">
            Permissionless collections with real value locked inside. Trade stories. Keep your floor. Shatter to recover.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <a href="https://github.com/stephenclawdbot-png/EVO" target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded border border-border-strong px-6 py-2.5 text-sm font-semibold text-text transition-colors hover:bg-surface-2">
              Learn the protocol <IconArrowRight className="h-4 w-4" />
            </a>
          </div>
        </div>
      </section>

      {/* Collections grid */}
      <section className="mx-auto max-w-7xl px-3 py-4 lg:px-4">
        <div className="mb-3 flex items-center gap-2">
          <IconCollection className="h-4 w-4 text-accent" />
          <h2 className="text-sm font-bold tracking-tight text-text-strong">Collections</h2>
          {collections.length > 0 && (
            <span className="font-mono text-[11px] text-dim">{collections.length}</span>
          )}
        </div>

        {loading ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-32 animate-pulse rounded border border-border bg-surface" />
            ))}
          </div>
        ) : collections.length === 0 ? (
          /* Empty state — no collections exist yet */
          <div className="py-20 text-center">
            <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded border border-border bg-surface text-accent">
              <IconCollection className="h-6 w-6" />
            </div>
            <h3 className="text-sm font-semibold">No collections yet</h3>
            <p className="mx-auto mt-1 max-w-xs text-xs text-muted">
              EVO is permissionless. Anyone can create a collection by calling <code className="font-mono text-accent">create_collection</code> on-chain.
            </p>
            <a href="https://github.com/stephenclawdbot-png/EVO" target="_blank" rel="noopener noreferrer"
              className="mt-5 inline-flex items-center gap-2 rounded border border-border-strong px-5 py-2 text-sm font-semibold text-text transition-colors hover:bg-surface-2">
              Protocol docs <IconArrowRight className="h-3.5 w-3.5" />
            </a>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {collections.map(c => (
              <CollectionCard key={c.discovery.pda.toBase58()} summary={c} />
            ))}
          </div>
        )}
      </section>

      {/* Footer */}
      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2 px-3 py-3 text-[11px] text-dim lg:px-4">
          <span>EVO Protocol - Stateful Capital. SOL that remembers.</span>
          <div className="flex items-center gap-4">
            <a href="https://github.com/stephenclawdbot-png/EVO" target="_blank" rel="noopener noreferrer" className="transition-colors hover:text-text">GitHub</a>
            <a href="https://solscan.io/account/7USTJBsRTmCnjowPgmh6s5igTZeaFPE7X43rZnhmm5sc" target="_blank" rel="noopener noreferrer" className="transition-colors hover:text-text">Program</a>
            <span>Powered by Solana</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

// Capital-first collection card — locked SOL is the hero, art is context
function CollectionCard({ summary }: { summary: CollectionSummary }) {
  const { data, evoCount, totalLockedSol, floorPriceSol, listedCount } = summary;
  const supplyPct = data.supplyCap > 0 ? (data.currentSupply / data.supplyCap) * 100 : 0;

  return (
    <Link href={`/c/${data.name}`} className="group block overflow-hidden rounded border border-border bg-surface transition-colors hover:border-border-strong">
      {/* Capital metrics — hero */}
      <div className="border-b border-border px-3 py-3">
        <div className="flex items-baseline justify-between">
          <h3 className="text-sm font-bold tracking-tight text-text-strong">{data.name}</h3>
          <span className="font-mono text-[10px] text-dim">{data.creator.slice(0, 4)}...{data.creator.slice(-4)}</span>
        </div>
        <div className="mt-2 flex items-baseline gap-1">
          <span className="font-mono text-lg font-bold text-positive">{totalLockedSol.toFixed(2)}</span>
          <span className="text-[11px] text-dim">SOL locked</span>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-3 gap-px bg-border">
        <Stat label="EVOs" value={String(evoCount)} />
        <Stat label="Listed" value={String(listedCount)} />
        <Stat label="Floor" value={floorPriceSol !== null ? `${floorPriceSol.toFixed(2)}` : '--'} />
      </div>

      {/* Supply bar */}
      <div className="px-3 py-2">
        <div className="flex items-center justify-between text-[10px] text-dim">
          <span>Supply</span>
          <span className="font-mono">{data.currentSupply}/{data.supplyCap}</span>
        </div>
        <div className="mt-1 h-1 overflow-hidden rounded-full bg-bg">
          <div className="h-full bg-accent transition-all" style={{ width: `${supplyPct}%` }} />
        </div>
      </div>

      {/* Footer */}
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
