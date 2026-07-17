'use client';

import { useState, useCallback, useEffect } from 'react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { Nav } from '@/components/Nav';
import Link from 'next/link';
import { readAllCollections, getCollectionPDA, readAllEVOs, lamportsToSol } from '@/lib/evo-program';
import { collectionConfigToData } from '@/lib/evo-data';
import { IconCollection, IconHammer, IconArrowRight } from '@/components/Icons';

interface MyCollectionSummary {
  name: string;
  supplyCap: number;
  currentSupply: number;
  totalLockedSol: number;
  evoCount: number;
}

export default function MyCollectionsPage() {
  const { connection } = useConnection();
  const wallet = useWallet();
  const [collections, setCollections] = useState<MyCollectionSummary[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchMine = useCallback(async () => {
    if (!wallet.publicKey) { setLoading(false); return; }
    setLoading(true);
    try {
      const all = await readAllCollections(connection);
      const mine = all.filter(d => d.config.creator.equals(wallet.publicKey!));
      const summaries: MyCollectionSummary[] = [];
      for (const disc of mine) {
        const [pda] = getCollectionPDA(disc.config.name);
        const evos = await readAllEVOs(connection, pda, disc.config.supplyCap);
        const active = evos.filter(e => !e.isShattered);
        summaries.push({
          name: disc.config.name,
          supplyCap: disc.config.supplyCap,
          currentSupply: disc.config.currentSupply,
          totalLockedSol: lamportsToSol(active.reduce((s, e) => s + e.lockedLamports, 0)),
          evoCount: active.length,
        });
      }
      summaries.sort((a, b) => b.totalLockedSol - a.totalLockedSol);
      setCollections(summaries);
    } catch (err) {
      console.error('Failed to fetch collections:', err);
    } finally {
      setLoading(false);
    }
  }, [connection, wallet.publicKey]);

  useEffect(() => { fetchMine(); }, [fetchMine]);

  return (
    <div className="min-h-screen bg-bg text-text">
      <Nav />

      <div className="border-b border-border">
        <Link href="/" className="mx-auto flex max-w-3xl items-center gap-1.5 px-3 py-2 text-xs text-muted transition-colors hover:text-text">
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round"><path d="m12 19-7-7 7-7" /><path d="M19 12H5" /></svg>
          Gallery
        </Link>
      </div>

      <div className="mx-auto max-w-3xl px-3 py-6 lg:px-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-text-strong">My Collections</h1>
            <p className="mt-1 text-xs text-muted">Collections created by your connected wallet.</p>
          </div>
          <Link href="/create"
            className="inline-flex shrink-0 items-center gap-1.5 rounded border border-accent bg-accent px-3 py-2 text-xs font-bold text-white transition-colors hover:bg-accent-hover">
            <IconHammer className="h-3.5 w-3.5" /> Create
          </Link>
        </div>

        {!wallet.connected ? (
          <div className="mt-8 flex flex-col items-center gap-4 rounded-lg border border-border bg-surface p-10 text-center">
            <IconCollection className="h-8 w-8 text-accent" />
            <p className="text-sm font-semibold text-text-strong">Connect wallet to view your collections</p>
            <WalletMultiButton />
          </div>
        ) : loading ? (
          <div className="mt-10 flex justify-center">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-border border-t-accent" />
          </div>
        ) : collections.length === 0 ? (
          <div className="mt-10 rounded-lg border border-border bg-surface p-10 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded border border-border bg-bg text-accent">
              <IconCollection className="h-5 w-5" />
            </div>
            <p className="text-sm font-semibold text-text-strong">No collections yet</p>
            <p className="mx-auto mt-1 max-w-sm text-xs text-muted">Create your first EVO collection. You&apos;ll become its creator and lifecycle authority.</p>
            <Link href="/create"
              className="mt-5 inline-flex items-center gap-2 rounded border border-accent bg-accent px-5 py-2 text-sm font-bold text-white transition-colors hover:bg-accent-hover">
              <IconHammer className="h-4 w-4" /> Create Collection
            </Link>
          </div>
        ) : (
          <div className="mt-5 space-y-2">
            {collections.map(c => (
              <Link
                key={c.name}
                href={`/admin?collection=${encodeURIComponent(c.name)}`}
                className="group flex items-center gap-3 rounded-lg border border-border bg-surface p-3.5 transition-colors hover:border-accent"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded border border-border bg-bg text-accent">
                  <IconCollection className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-text-strong">{c.name}</p>
                  <p className="text-[11px] text-dim">
                    {c.currentSupply}/{c.supplyCap} forged · {c.evoCount} active · {c.totalLockedSol.toFixed(3)} SOL locked
                  </p>
                </div>
                <IconArrowRight className="h-4 w-4 text-muted transition-colors group-hover:text-accent" />
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}