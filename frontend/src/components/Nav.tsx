'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { ThemeToggle } from './ThemeToggle';
import { readAllCollections } from '@/lib/evo-program';
import { IconEvoMark, IconHammer, IconCollection, IconPortfolio } from './Icons';

interface TickerStat { label: string; value: string; tone?: 'pos' | 'neg' | 'neutral' }

interface NavProps {
  onRefresh?: () => void;
  ticker?: TickerStat[];
}

export function Nav({ onRefresh, ticker = [] }: NavProps) {
  const { connection } = useConnection();
  const wallet = useWallet();
  const [hasCollections, setHasCollections] = useState(false);

  const checkCollections = useCallback(async () => {
    if (!wallet.publicKey) { setHasCollections(false); return; }
    try {
      const all = await readAllCollections(connection);
      setHasCollections(all.some(d => d.config.creator.equals(wallet.publicKey!)));
    } catch {
      setHasCollections(false);
    }
  }, [connection, wallet.publicKey]);

  useEffect(() => { checkCollections(); }, [checkCollections]);

  const connected = wallet.connected && !!wallet.publicKey;

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-bg">
      {/* Main bar */}
      <div className="flex h-11 items-center justify-between px-3">
        <div className="flex items-center gap-4">
          <Link href="/" className="flex items-center gap-2">
            <IconEvoMark className="h-6 w-6 text-accent" />
            <span className="text-sm font-semibold tracking-tight text-text-strong">EVO</span>
            <span className="hidden text-[10px] uppercase tracking-[0.15em] text-dim md:inline">Terminal</span>
          </Link>
          {connected && (
            <Link
              href="/portfolio"
              className="hidden h-7 items-center gap-1.5 rounded border border-border-strong bg-surface px-3 text-xs font-semibold text-text transition-colors hover:border-accent hover:text-text-strong sm:inline-flex"
            >
              <IconPortfolio className="h-3.5 w-3.5" />
              Portfolio
            </Link>
          )}
          {connected && hasCollections && (
            <Link
              href="/my"
              className="hidden h-7 items-center gap-1.5 rounded border border-border-strong bg-surface px-3 text-xs font-semibold text-text transition-colors hover:border-accent hover:text-text-strong sm:inline-flex"
            >
              <IconCollection className="h-3.5 w-3.5" />
              My Collections
            </Link>
          )}
        </div>

        <div className="flex items-center gap-2">
          {connected && hasCollections && (
            <Link
              href="/my"
              className="inline-flex h-7 items-center gap-1.5 rounded border border-border-strong bg-surface px-3 text-xs font-semibold text-text transition-colors hover:border-accent hover:text-text-strong sm:hidden"
            >
              <IconCollection className="h-3.5 w-3.5" />
            </Link>
          )}
          <Link
            href="/create"
            className="inline-flex h-7 items-center gap-1.5 rounded border border-accent bg-accent px-3 text-xs font-bold text-white transition-colors hover:bg-accent-hover"
          >
            <IconHammer className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Create Collection</span>
            <span className="sm:hidden">Create</span>
          </Link>
          {onRefresh && (
            <button
              onClick={onRefresh}
              title="Refresh (R)"
              className="flex h-7 w-7 items-center justify-center rounded border border-border-strong bg-surface text-muted transition-colors hover:text-text-strong"
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" /><path d="M21 3v5h-5" />
                <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" /><path d="M3 21v-5h5" />
              </svg>
            </button>
          )}
          <ThemeToggle />
          <WalletMultiButton />
        </div>
      </div>

      {/* Ticker strip */}
      {ticker.length > 0 && (
        <div className="flex h-7 items-center gap-0 border-t border-border bg-surface overflow-x-auto">
          {ticker.map((s, i) => (
            <div key={i} className="flex items-center gap-1.5 border-r border-border px-3 last:border-r-0">
              <span className="text-[10px] uppercase tracking-wide text-dim">{s.label}</span>
              <span className={`font-mono text-xs font-medium ${s.tone === 'pos' ? 'text-positive' : s.tone === 'neg' ? 'text-negative' : 'text-text-strong'}`}>
                {s.value}
              </span>
            </div>
          ))}
        </div>
      )}
    </header>
  );
}
