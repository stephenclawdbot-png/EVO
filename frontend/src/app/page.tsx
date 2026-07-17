'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import { useConnection } from '@solana/wallet-adapter-react';
import { Nav } from '@/components/Nav';
import { LivingEvo } from '@/components/LivingEvo';
import { CollectionDiscovery, readAllCollections, readAllEVOs, getCollectionPDA, lamportsToSol } from '@/lib/evo-program';
import { CollectionData, collectionConfigToData } from '@/lib/evo-data';
import Link from 'next/link';
import {
  IconArrowRight, IconHammer, IconCollection, IconTrendingUp,
  IconFeed, IconEvolve, IconShatter, IconLock, IconSparkle,
} from '@/components/Icons';

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

      summaries.sort((a, b) => b.totalLockedSol - a.totalLockedSol);
      setCollections(summaries);
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

  const ticker = [
    { label: 'Collections', value: loading ? '--' : String(globalStats.totalCollections) },
    { label: 'EVOs', value: loading ? '--' : String(globalStats.totalEVOs) },
    { label: 'Locked', value: loading ? '--' : `${globalStats.totalLocked.toFixed(2)} SOL`, tone: 'pos' as const },
    { label: 'Listed', value: loading ? '--' : String(globalStats.totalListed) },
  ];

  return (
    <div className="min-h-screen bg-bg text-text">
      <Nav onRefresh={fetchData} ticker={ticker} />

      {/* ─── Hero — intrigue, not explanation ─── */}
      <section className="relative overflow-hidden border-b border-border">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute left-1/2 top-1/3 h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full blur-3xl"
            style={{ background: 'radial-gradient(circle, #818cf814, transparent 65%)' }} />
        </div>
        <div className="relative mx-auto flex max-w-4xl flex-col items-center px-4 py-24 text-center lg:py-36">
          <span className="mb-6 inline-flex items-center gap-1.5 rounded-full border border-border-strong bg-surface px-3 py-1 text-[11px] text-muted">
            <IconSparkle className="h-3 w-3 text-accent" />
            New primitive on Solana
          </span>
          <h1 className="text-4xl font-bold leading-[1.05] tracking-tight text-text-strong sm:text-5xl lg:text-6xl">
            Assets that don't
            <br />
            stay the same.
          </h1>
          <p className="mt-6 max-w-md text-sm text-muted sm:text-base">
            EVOs hold locked SOL, evolve over time, and can be shattered to recover their value.
            Not a token. Not an NFT. A new on-chain primitive.
          </p>
          <div className="mt-10 flex flex-col items-center gap-3 sm:flex-row">
            <a href="#collections"
              className="inline-flex items-center gap-2 rounded bg-accent px-6 py-2.5 text-sm font-semibold text-[#0a0a0c] transition-colors hover:bg-accent-hover">
              Explore collections <IconArrowRight className="h-4 w-4" />
            </a>
            <a href="https://github.com/stephenclawdbot-png/EVO" target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded border border-border-strong px-6 py-2.5 text-sm font-semibold text-text transition-colors hover:bg-surface-2">
              Read the protocol
            </a>
          </div>
        </div>
      </section>

      {/* ─── One living EVO — the story ─── */}
      <LivingEvo />

      {/* ─── How it works — five operations ─── */}
      <section className="border-b border-border bg-surface">
        <div className="mx-auto max-w-6xl px-4 py-16 lg:py-24">
          <div className="mb-12 text-center">
            <p className="text-[11px] uppercase tracking-[0.2em] text-dim">How it works</p>
            <h2 className="mt-2 text-xl font-semibold tracking-tight text-text-strong sm:text-2xl">
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
          <div className="mt-10 flex items-center justify-center gap-2 text-center text-xs text-dim">
            <IconLock className="h-3.5 w-3.5 text-accent" />
            No admin keys. No escrow. The SOL lives in the PDA.
          </div>
        </div>
      </section>

      {/* ─── Collections — delayed, after the story ─── */}
      <section id="collections" className="mx-auto max-w-7xl px-3 py-12 lg:px-4">
        <div className="mb-4 flex items-center gap-2">
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
          <div className="py-20 text-center">
            <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded border border-border bg-surface text-accent">
              <IconCollection className="h-6 w-6" />
            </div>
            <h3 className="text-sm font-semibold">No collections yet</h3>
            <p className="mx-auto mt-1 max-w-xs text-xs text-muted">
              EVO is permissionless. Create the first collection from the website — no SDK required.
            </p>
            <Link href="/create"
              className="mt-5 inline-flex items-center gap-2 rounded border border-accent bg-accent px-5 py-2 text-sm font-bold text-white transition-colors hover:bg-accent-hover">
              <IconHammer className="h-4 w-4" /> Create Collection
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {collections.map(c => (
              <CollectionCard key={c.discovery.pda.toBase58()} summary={c} />
            ))}
          </div>
        )}
      </section>

      {/* ─── Footer ─── */}
      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2 px-3 py-3 text-[11px] text-dim lg:px-4">
          <span>EVO Protocol — Assets that don't stay the same.</span>
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

  return (
    <Link href={`/c/${data.name}`} className="group block overflow-hidden rounded border border-border bg-surface transition-colors hover:border-border-strong">
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
