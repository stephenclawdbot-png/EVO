'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useConnection } from '@solana/wallet-adapter-react';
import { useParams, useRouter } from 'next/navigation';
import { EvoDetail } from '@/components/EvoDetail';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { Nav } from '@/components/Nav';
import { Footer } from '@/components/Footer';
import Link from 'next/link';
import { EVOData, evoAccountToData, mergeListingData } from '@/lib/evo-data';
import {
  readCollectionConfig,
  readEVO,
  getCollectionPDA,
} from '@/lib/evo-program';
import { refetchUntilChanged } from '@/lib/tx';

// Key fields that change after a tx — if any differ, the refetch landed.
function evoSame(a: EVOData, b: EVOData): boolean {
  return a.currentState === b.currentState &&
    a.lockedLamports === b.lockedLamports &&
    a.owner === b.owner &&
    a.isListed === b.isListed &&
    a.isShattered === b.isShattered &&
    a.listPriceLamports === b.listPriceLamports &&
    a.tradeCount === b.tradeCount;
}

export default function EvoDetailPage() {
  const params = useParams<{ name: string; id: string }>();
  const collectionName = decodeURIComponent(params.name);
  const evoId = parseInt(params.id, 10);
  const router = useRouter();
  const { connection } = useConnection();

  const [evo, setEvo] = useState<EVOData | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshTimedOut, setRefreshTimedOut] = useState(false);

  const evoRef = useRef<EVOData | null>(null);
  useEffect(() => { evoRef.current = evo; }, [evo]);

  // Initial load (and manual refresh via refreshKey)
  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      setNotFound(false);
      try {
        const cfg = await readCollectionConfig(connection, collectionName);
        if (!cfg) { if (active) { setNotFound(true); setLoading(false); } return; }

        const [collectionPda] = getCollectionPDA(collectionName);
        const raw = await readEVO(connection, collectionPda, evoId);
        if (!raw) { if (active) { setNotFound(true); setLoading(false); } return; }

        const data = evoAccountToData(raw, collectionName);
        if (!data) { if (active) { setNotFound(true); setLoading(false); } return; }

        await mergeListingData(connection, [data]);
        if (active) { setEvo(data); setLoading(false); }
      } catch (err) {
        console.error('EvoDetailPage: fetch failed:', err);
        if (active) { setNotFound(true); setLoading(false); }
      }
    })();
    return () => { active = false; };
  }, [connection, collectionName, evoId, refreshKey]);

  // Post-tx refresh: retry-until-changed with 12s hard timeout
  const handleTxRefresh = useCallback(async () => {
    const prev = evoRef.current;
    if (!prev) return;
    setRefreshing(true);
    setRefreshTimedOut(false);
    try {
      const fetcher = async (): Promise<EVOData> => {
        const [collectionPda] = getCollectionPDA(collectionName);
        const raw = await readEVO(connection, collectionPda, evoId);
        if (!raw) throw new Error('EVO not found');
        const data = evoAccountToData(raw, collectionName);
        if (!data) throw new Error('EVO data error');
        await mergeListingData(connection, [data]);
        return data;
      };
      const { data, changed, timedOut } = await refetchUntilChanged(
        fetcher, prev, evoSame, { maxRetries: 5, gapMs: 1500, timeoutMs: 12000 }
      );
      if (changed) setEvo(data);
      if (timedOut && !changed) setRefreshTimedOut(true);
    } catch (err) {
      console.error('EvoDetailPage: tx refresh failed:', err);
    } finally {
      setRefreshing(false);
    }
  }, [connection, collectionName, evoId]);

  // Manual refresh from timeout button
  const handleManualRefresh = useCallback(() => {
    setRefreshTimedOut(false);
    setRefreshKey(k => k + 1);
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-bg text-text">
        <Nav />
        <div className="mx-auto max-w-7xl px-3 py-20 lg:px-4">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
            <div className="space-y-3">
              <div className="aspect-square animate-pulse rounded border border-border bg-surface" />
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-16 animate-pulse rounded border border-border bg-surface" />)}
              </div>
            </div>
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-20 animate-pulse rounded border border-border bg-surface" />)}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (notFound || !evo) {
    return (
      <div className="min-h-screen bg-bg text-text">
        <Nav />
        <div className="mx-auto max-w-lg px-3 py-20 text-center">
          <h2 className="text-lg font-bold text-text-strong">EVO not found</h2>
          <p className="mt-2 text-sm text-muted">
            No EVO #{evoId} in &quot;{collectionName}&quot; exists on-chain.
          </p>
          <Link
            href={`/c/${encodeURIComponent(collectionName)}`}
            className="mt-5 inline-flex items-center gap-2 rounded border border-border-strong px-5 py-2 text-sm font-semibold text-text transition-colors hover:bg-surface-2"
          >
            Back to collection
          </Link>
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <EvoDetail
        evo={evo}
        onBack={() => router.push(`/c/${encodeURIComponent(collectionName)}`)}
        onRefresh={handleTxRefresh}
        refreshing={refreshing}
        refreshTimedOut={refreshTimedOut}
        onManualRefresh={handleManualRefresh}
      />
    </ErrorBoundary>
  );
}