'use client';

import { useState, useEffect } from 'react';
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
        onRefresh={() => setRefreshKey(k => k + 1)}
      />
    </ErrorBoundary>
  );
}