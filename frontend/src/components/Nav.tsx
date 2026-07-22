'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { ThemeToggle } from './ThemeToggle';
import { readAllCollections, readAllEVOsByOwner } from '@/lib/evo-program';
import { IconEvoMark, IconHammer, IconCollection, IconPortfolio, IconHelp } from './Icons';
import { useFlash } from '@/lib/useFlash';

interface TickerStat { label: string; value: string; tone?: 'pos' | 'neg' | 'neutral' }

function TickerItem({ s }: { s: TickerStat }) {
  const flash = useFlash(s.value);
  return (
    <div className="flex items-center gap-1.5 border-r border-border px-3 last:border-r-0">
      <span className="text-[10px] uppercase tracking-wide text-dim">{s.label}</span>
      <span key={flash.key} className={`font-mono tabular-nums text-xs font-medium rounded px-0.5 ${flash.className} ${s.tone === 'pos' ? 'text-positive' : s.tone === 'neg' ? 'text-negative' : 'text-text-strong'}`}>
        {s.value}
      </span>
    </div>
  );
}

interface NavProps {
  onRefresh?: () => void;
  ticker?: TickerStat[];
}

export function Nav({ onRefresh, ticker = [] }: NavProps) {
  const { connection } = useConnection();
  const wallet = useWallet();
  const pathname = usePathname();
  const [hasCollections, setHasCollections] = useState(false);
  const [ownedCount, setOwnedCount] = useState<number | null>(null);

  const checkCollections = useCallback(async () => {
    if (!wallet.publicKey) { setHasCollections(false); return; }
    try {
      const all = await readAllCollections(connection);
      setHasCollections(all.some(d => d.config.creator.equals(wallet.publicKey!)));
    } catch {
      setHasCollections(false);
    }
  }, [connection, wallet.publicKey]);

  // Fetch owned EVO count (cached in sessionStorage 60s, fire-and-forget)
  const checkOwnedCount = useCallback(async () => {
    if (!wallet.publicKey) { setOwnedCount(null); return; }
    const cacheKey = `evo_owned_count_${wallet.publicKey.toBase58()}`;
    try {
      const cached = sessionStorage.getItem(cacheKey);
      if (cached) {
        const { count, ts } = JSON.parse(cached);
        if (Date.now() - ts < 60_000) { setOwnedCount(count); return; }
      }
    } catch { /* ignore */ }
    try {
      const evos = await readAllEVOsByOwner(connection, wallet.publicKey);
      const count = evos.length;
      setOwnedCount(count);
      try { sessionStorage.setItem(cacheKey, JSON.stringify({ count, ts: Date.now() })); } catch { /* quota */ }
    } catch { /* ignore */ }
  }, [connection, wallet.publicKey]);

  useEffect(() => { checkCollections(); checkOwnedCount(); }, [checkCollections, checkOwnedCount]);

  // Re-check owned count when route changes (e.g. after buying/evolving)
  useEffect(() => { checkOwnedCount(); }, [pathname, checkOwnedCount]);

  // Auto-refetch every 30s, paused when tab hidden
  useEffect(() => {
    if (!onRefresh) return;
    const tick = () => { if (document.visibilityState === 'visible') onRefresh(); };
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, [onRefresh]);

  const connected = wallet.connected && !!wallet.publicKey;

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-bg">
      {/* Main bar */}
      <div className="flex h-11 items-center justify-between px-3">
        <div className="flex items-center gap-4">
          <Link href="/" className="flex items-center gap-2">
            <img src="/meld-dark.png" alt="Meld" className="h-6 w-6 dark:hidden" />
            <img src="/meld-light.png" alt="Meld" className="hidden h-6 w-6 dark:block" />
            <span className="text-sm font-semibold tracking-tight text-text-strong">Meld</span>
            <span className="hidden text-[10px] uppercase tracking-[0.15em] text-dim md:inline">Terminal</span>
          </Link>
          {connected && (
            <Link
              href="/portfolio"
              className="hidden h-7 items-center gap-1.5 rounded border border-border-strong bg-surface px-3 text-xs font-semibold text-text transition-colors hover:border-accent hover:text-text-strong sm:inline-flex"
            >
              <IconPortfolio className="h-3.5 w-3.5" />
              Portfolio{ownedCount !== null && ownedCount > 0 && ` (${ownedCount})`}
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
            className="inline-flex h-7 items-center gap-1.5 rounded border border-accent bg-accent px-3 text-xs font-bold text-black transition-colors hover:bg-accent-hover"
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
          <span className="flex shrink-0 items-center gap-1 border-r border-border px-3 text-[9px] font-bold uppercase tracking-wider text-positive">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-positive opacity-60" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-positive" />
            </span>
            Live
          </span>
          {ticker.map((s, i) => <TickerItem key={i} s={s} />)}
        </div>
      )}

      {/* Mobile bottom tab bar — visible only below sm */}
      <nav className="fixed inset-x-0 bottom-0 z-50 flex border-t border-border bg-bg pb-[env(safe-area-inset-bottom)] sm:hidden">
        <MobileTab href="/" active={pathname === '/'} icon={<IconCollection className="h-5 w-5" />} label="Home" />
        {connected ? (
          <MobileTab href="/portfolio" active={pathname === '/portfolio'} icon={<IconPortfolio className="h-5 w-5" />} label={`Portfolio${ownedCount !== null && ownedCount > 0 ? ` (${ownedCount})` : ''}`} />
        ) : (
          <MobileTab href="/portfolio" active={pathname === '/portfolio'} icon={<IconPortfolio className="h-5 w-5" />} label="Portfolio" />
        )}
        {connected && hasCollections && (
          <MobileTab href="/my" active={pathname === '/my'} icon={<IconCollection className="h-5 w-5" />} label="My Col" />
        )}
        <MobileTab href="/create" active={pathname === '/create'} icon={<IconHammer className="h-5 w-5" />} label="Create" />
      </nav>
    </header>
  );
}

function MobileTab({ href, active, icon, label }: { href: string; active: boolean; icon: React.ReactNode; label: string }) {
  return (
    <Link
      href={href}
      className={`flex min-h-[3.25rem] flex-1 flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-colors ${
        active ? 'text-accent' : 'text-dim hover:text-text'
      }`}
    >
      {icon}
      <span className="truncate max-w-full px-1">{label}</span>
    </Link>
  );
}
