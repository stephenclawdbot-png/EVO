'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { useRouter } from 'next/navigation';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { Nav } from '@/components/Nav';
import { Footer } from '@/components/Footer';
import Link from 'next/link';
import {
  readAllEVOsByOwner,
  readCollectionConfig,
  getCollectionPDA,
  EVOAccount,
} from '@/lib/evo-program';
import { evoAccountToData, EVOData, collectionConfigToData, CollectionData, mergeListingData } from '@/lib/evo-data';
import { EvoCard } from '@/components/EvoCard';
import { IconArrowRight, IconPortfolio } from '@/components/Icons';

interface CollectionGroup {
  name: string;
  data: CollectionData | null;
  evos: EVOData[];
}

export default function PortfolioPage() {
  const { connection } = useConnection();
  const wallet = useWallet();
  const router = useRouter();
  const [groups, setGroups] = useState<CollectionGroup[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchData = useCallback(async () => {
    if (!wallet.publicKey) { setGroups([]); return; }
    setLoading(true);
    try {
      // 1. Fetch ALL EVOs owned by this wallet (across all collections) in one RPC call
      const allEvos = await readAllEVOsByOwner(connection, wallet.publicKey);

      // 2. Group by collection PDA
      const byCollection = new Map<string, EVOAccount[]>();
      for (const evo of allEvos) {
        const key = evo.collection.toBase58();
        if (!byCollection.has(key)) byCollection.set(key, []);
        byCollection.get(key)!.push(evo);
      }

      // 3. Resolve each collection's name + metadata
      const collectionGroups: CollectionGroup[] = [];
      for (const [collectionPdaStr, evos] of byCollection) {
        // Try to read the collection config by trying known names or scanning discovered collections
        // Since we have the collection PDA, we need to find its name.
        // We'll use readAllCollections to find it.
        let collectionName = 'Unknown';
        let collectionData: CollectionData | null = null;

        // Fetch all collections to find the one matching this PDA
        const { readAllCollections } = await import('@/lib/evo-program');
        const discovered = await readAllCollections(connection);
        const match = discovered.find(d => d.pda.toBase58() === collectionPdaStr);
        if (match) {
          collectionName = match.config.name;
          collectionData = collectionConfigToData(match.config);
        }

        // Resolve EVO display data (generic, no per-collection creature data)
        const display: EVOData[] = [];
        for (const evo of evos) {
          const d = evoAccountToData(evo, collectionName);
          if (d) display.push(d);
        }
        await mergeListingData(connection, display);
        display.sort((a, b) => a.id - b.id);
        collectionGroups.push({ name: collectionName, data: collectionData, evos: display });
      }

      collectionGroups.sort((a, b) => {
        const aLocked = a.evos.reduce((s, e) => s + e.lockedLamports, 0);
        const bLocked = b.evos.reduce((s, e) => s + e.lockedLamports, 0);
        return bLocked - aLocked;
      });

      setGroups(collectionGroups);
    } catch (err) {
      console.error('Failed to fetch portfolio:', err);
    } finally {
      setLoading(false);
    }
  }, [connection, wallet.publicKey]);

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

  // Portfolio summary
  const summary = useMemo(() => {
    const allEvos = groups.flatMap(g => g.evos);
    const active = allEvos.filter(e => !e.isShattered);
    const shattered = allEvos.filter(e => e.isShattered);
    const totalLocked = active.reduce((s, e) => s + e.lockedLamports, 0);
    const totalListed = active.filter(e => e.isListed).length;
    const totalListValue = active.filter(e => e.isListed).reduce((s, e) => s + (e.listPrice || 0), 0);
    const totalFed = active.reduce((s, e) => s + e.facetCount, 0);
    const totalTrades = active.reduce((s, e) => s + e.tradeCount, 0);

    // Recoverable SOL = locked SOL minus shatter fee (estimate using first collection's fee)
    const shatterFeeBps = groups[0]?.data?.shatterFeeBps || 0;
    const recoverableSol = active.reduce((s, e) => s + e.lockedLamports * 10000, 0) / 10000 * (1 - shatterFeeBps / 10000);

    return {
      total: allEvos.length,
      active: active.length,
      shattered: shattered.length,
      totalLockedSol: totalLocked,
      totalListValueSol: totalListValue,
      totalListed,
      totalFed,
      totalTrades,
      recoverableSol,
      collections: groups.length,
    };
  }, [groups]);

  const ticker = wallet.publicKey ? [
    { label: 'EVOs', value: loading ? '--' : String(summary.total) },
    { label: 'Locked', value: loading ? '--' : `${summary.totalLockedSol.toFixed(2)} SOL`, tone: 'pos' as const },
    { label: 'Listed', value: loading ? '--' : String(summary.totalListed) },
    { label: 'Collections', value: loading ? '--' : String(summary.collections) },
  ] : [];

  return (
    <div className="min-h-screen bg-bg text-text">
      <Nav onRefresh={fetchData} ticker={ticker} />

      <div className="mx-auto max-w-5xl px-3 py-4 lg:px-4">
        <div className="flex items-center gap-2">
          <IconPortfolio className="h-5 w-5 text-accent" />
          <h1 className="text-lg font-bold tracking-tight text-text-strong">Portfolio</h1>
        </div>

        {!wallet.connected ? (
          <div className="py-20 text-center">
            <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded border border-border bg-surface text-accent">
              <IconPortfolio className="h-6 w-6" />
            </div>
            <h3 className="text-sm font-semibold">Connect your wallet</h3>
            <p className="mt-1 text-xs text-muted">View your EVOs across all collections.</p>
            <div className="mt-5 flex justify-center"><WalletMultiButton /></div>
          </div>
        ) : loading ? (
          <div className="mt-10 flex justify-center">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-border border-t-accent" />
          </div>
        ) : groups.length === 0 ? (
          <div className="py-20 text-center">
            <h3 className="text-sm font-semibold">No EVOs yet</h3>
            <p className="mt-1 text-xs text-muted">You don&apos;t own any EVOs. Forge one to get started.</p>
            <Link href="/" className="mt-5 inline-flex items-center gap-2 rounded border border-accent bg-accent px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-accent-hover">
              Browse collections <IconArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        ) : (
          <>
            {/* Portfolio summary — Bloomberg terminal style */}
            <div className="mt-4 overflow-hidden rounded border border-border">
              <div className="border-b border-border bg-surface-2 px-3 py-2">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-dim">Portfolio Summary</span>
              </div>
              <div className="grid grid-cols-2 gap-px bg-border sm:grid-cols-4">
                <SummaryCell label="Total EVOs" value={String(summary.total)} />
                <SummaryCell label="Locked SOL" value={summary.totalLockedSol.toFixed(3)} tone="pos" />
                <SummaryCell label="Recoverable" value={summary.recoverableSol.toFixed(3)} />
                <SummaryCell label="List Value" value={summary.totalListValueSol > 0 ? `${summary.totalListValueSol.toFixed(3)}` : '--'} tone={summary.totalListValueSol > 0 ? 'pos' : undefined} />
                <SummaryCell label="Active" value={String(summary.active)} />
                <SummaryCell label="Shattered" value={String(summary.shattered)} tone={summary.shattered > 0 ? 'neg' : undefined} />
                <SummaryCell label="Total Trades" value={String(summary.totalTrades)} />
                <SummaryCell label="Collections" value={String(summary.collections)} />
              </div>
            </div>

            {/* EVOs grouped by collection */}
            {groups.map(group => (
              <div key={group.name} className="mt-6">
                <div className="mb-2 flex items-center justify-between border-b border-border pb-2">
                  <div>
                    <Link href={`/c/${group.name}`} className="text-sm font-bold tracking-tight text-text-strong hover:text-accent">
                      {group.name}
                    </Link>
                    <span className="ml-2 font-mono text-[11px] text-dim">
                      {group.evos.length} EVO{group.evos.length !== 1 ? 's' : ''} ·
                      {' '}{group.evos.reduce((s, e) => s + e.lockedLamports, 0).toFixed(2)} SOL locked
                    </span>
                  </div>
                  {group.data && (
                    <Link href={`/c/${group.name}/forge`} className="text-[11px] text-accent hover:underline">
                      Forge more →
                    </Link>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
                  {group.evos.map(evo => (
                    <EvoCard
                      key={`${group.name}-${evo.id}`}
                      evo={evo}
                      href={`/c/${encodeURIComponent(group.name)}/${evo.id}`}
                      onClick={() => router.push(`/c/${encodeURIComponent(group.name)}/${evo.id}`)}
                      metadataUri={group.data?.metadataUri}
                      isRevealed={group.data?.isRevealed}
                      evolveFeedThreshold={group.data?.evolveFeedThreshold}
                      evolveLockedThreshold={group.data?.evolveLockedThreshold}
                      evolveHoldSeconds={group.data?.evolveHoldSeconds}
                    />
                  ))}
                </div>
              </div>
            ))}
          </>
        )}
      </div>
      <Footer />
    </div>
  );
}

function SummaryCell({ label, value, tone }: { label: string; value: string; tone?: 'pos' | 'neg' }) {
  return (
    <div className="bg-bg px-3 py-2.5">
      <p className="text-[10px] uppercase tracking-wide text-dim">{label}</p>
      <p className={`mt-0.5 font-mono text-sm font-semibold ${
        tone === 'pos' ? 'text-positive' : tone === 'neg' ? 'text-negative' : 'text-text-strong'
      }`}>{value}</p>
    </div>
  );
}