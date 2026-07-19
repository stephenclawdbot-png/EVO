'use client';

import { useMemo, useState } from 'react';
import { TradeEvent } from '@/lib/evo-chart';

interface TradeChartProps {
  events: TradeEvent[];
  loading?: boolean;
  currentFloorSol?: number | null;
}

type Range = '1h' | '24h' | '7d' | 'all';

const RANGE_MS: Record<Range, number> = {
  '1h': 3600_000,
  '24h': 86400_000,
  '7d': 604800_000,
  'all': Infinity,
};

const KIND_COLOR: Record<string, string> = {
  forge: 'var(--accent)',
  buy: 'var(--positive)',
  feed: 'var(--accent-hover)',
  shatter: 'var(--negative)',
  list: 'var(--muted)',
  delist: 'var(--dim)',
};

/**
 * Tensor-style internal trade chart.
 * Price-over-time line built from priced events (forge/buy), with event dots
 * colored by kind, plus a volume bar strip below. Sourced from on-chain EVO
 * trade history — no external DEX, because EVOs trade inside the protocol.
 */
export function TradeChart({ events, loading, currentFloorSol }: TradeChartProps) {
  const [range, setRange] = useState<Range>('all');

  const view = useMemo(() => {
    const now = Date.now();
    const cutoff = range === 'all' ? 0 : now - RANGE_MS[range];
    const inRange = events.filter(e => e.timestamp * 1000 >= cutoff && (e.kind === 'buy' || e.kind === 'forge' || e.kind === 'list'));
    const priced = inRange.filter(e => e.priceSol > 0).sort((a, b) => a.timestamp - b.timestamp);

    const allPriced = priced;
    const maxPrice = Math.max(0.0001, ...allPriced.map(e => e.priceSol));
    const minTs = allPriced.length > 0 ? allPriced[0].timestamp : 0;
    const maxTs = allPriced.length > 0 ? allPriced[allPriced.length - 1].timestamp : 1;
    const span = Math.max(1, maxTs - minTs);

    // volume buckets (by hour)
    const buckets = new Map<number, number>();
    for (const e of events) {
      if (e.kind !== 'buy') continue;
      const b = Math.floor(e.timestamp / 3600) * 3600;
      buckets.set(b, (buckets.get(b) ?? 0) + e.priceSol);
    }
    const vol = [...buckets.entries()].sort((a, b) => a[0] - b[0]);
    const maxVol = Math.max(0.0001, ...vol.map(([, v]) => v));

    return { priced: allPriced, maxPrice, minTs, span, vol, maxVol };
  }, [events, range]);

  const W = 720;
  const H = 200;
  const PAD = 28;
  const chartW = W - PAD * 2;
  const chartH = H - PAD - 56; // leave room for volume bars + axis

  const xOf = (ts: number) => {
    if (view.priced.length <= 1) return PAD + chartW / 2;
    return PAD + ((ts - view.minTs) / view.span) * chartW;
  };
  const yOf = (p: number) => PAD + chartH - (p / view.maxPrice) * chartH;

  const linePath = useMemo(() => {
    if (view.priced.length === 0) return '';
    return view.priced
      .map((e, i) => `${i === 0 ? 'M' : 'L'}${xOf(e.timestamp).toFixed(1)},${yOf(e.priceSol).toFixed(1)}`)
      .join(' ');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view]);

  const areaPath = useMemo(() => {
    if (view.priced.length === 0) return '';
    const base = PAD + chartH;
    const first = `M${xOf(view.priced[0].timestamp).toFixed(1)},${base}`;
    const line = view.priced
      .map(e => `L${xOf(e.timestamp).toFixed(1)},${yOf(e.priceSol).toFixed(1)}`)
      .join(' ');
    const last = `L${xOf(view.priced[view.priced.length - 1].timestamp).toFixed(1)},${base} Z`;
    return `${first} ${line} ${last}`;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view]);

  const volMax = view.maxVol;
  const volXOf = (ts: number) => view.priced.length > 1
    ? PAD + ((ts - view.minTs) / view.span) * chartW
    : PAD + chartW / 2;

  const buys = events.filter(e => e.kind === 'buy').length;
  const volume = events.filter(e => e.kind === 'buy').reduce((s, e) => s + e.priceSol, 0);
  const lastPrice = view.priced.length > 0 ? view.priced[view.priced.length - 1].priceSol : 0;

  return (
    <div className="overflow-hidden rounded border border-border bg-surface">
      {/* header */}
      <div className="flex items-center justify-between border-b border-border bg-surface-2 px-3 py-2">
        <div className="flex items-center gap-3">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-dim">Trade Chart</span>
          <span className="font-mono text-xs text-muted">
            Last <span className="text-text-strong">{lastPrice > 0 ? `${lastPrice.toFixed(3)} SOL` : '--'}</span>
          </span>
          <span className="font-mono text-xs text-muted">
            Vol <span className="text-text-strong">{volume.toFixed(2)} SOL</span>
          </span>
          <span className="font-mono text-xs text-muted">
            Sales <span className="text-text-strong">{buys}</span>
          </span>
        </div>
        <div className="flex items-center gap-1">
          {(['1h', '24h', '7d', 'all'] as Range[]).map(r => (
            <button key={r} onClick={() => setRange(r)}
              className={`rounded px-1.5 py-0.5 text-[10px] font-medium transition-colors ${
                range === r ? 'bg-accent text-white' : 'bg-bg text-muted hover:text-text'
              }`}>
              {r === 'all' ? 'ALL' : r.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {/* chart body */}
      <div className="px-2 py-2">
        {loading ? (
          <div className="flex h-[200px] items-center justify-center">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-border border-t-accent" />
          </div>
        ) : view.priced.length === 0 ? (
          <div className="flex h-[200px] flex-col items-center justify-center text-center">
            <p className="text-xs text-muted">No trades yet.</p>
            <p className="mt-1 text-[11px] text-dim">Be the first to forge or buy — chart builds from on-chain trades.</p>
          </div>
        ) : (
          <svg viewBox={`0 0 ${W} ${H}`} className="h-[200px] w-full" preserveAspectRatio="none">
            {/* grid lines */}
            {[0.25, 0.5, 0.75].map(f => (
              <line key={f} x1={PAD} x2={W - PAD}
                y1={PAD + chartH - f * chartH} y2={PAD + chartH - f * chartH}
                stroke="var(--grid-line)" strokeWidth={1} />
            ))}
            {/* area + line */}
            <path d={areaPath} fill="var(--accent)" opacity={0.1} />
            <path d={linePath} fill="none" stroke="var(--accent)" strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />

            {/* volume bars */}
            {view.vol.map(([ts, v]) => {
              const h = (v / volMax) * 28;
              const x = volXOf(ts);
              return <rect key={ts} x={x - 2} y={PAD + chartH + 8} width={4} height={h}
                fill="var(--accent)" opacity={0.45} rx={1} />;
            })}

            {/* event dots */}
            {view.priced.map((e, i) => (
              <circle key={i} cx={xOf(e.timestamp)} cy={yOf(e.priceSol)} r={2.5}
                fill={KIND_COLOR[e.kind] ?? 'var(--accent)'} />
            ))}

            {/* current floor marker */}
            {currentFloorSol != null && currentFloorSol > 0 && (
              <line x1={W - PAD} x2={W - PAD} y1={PAD} y2={PAD + chartH}
                stroke="var(--muted)" strokeWidth={1} strokeDasharray="2 2" />
            )}

            {/* axis labels */}
            <text x={PAD} y={PAD - 6} fontSize={9} fill="var(--dim)" className="font-mono">
              {view.maxPrice.toFixed(3)}
            </text>
            <text x={PAD} y={PAD + chartH + 4} fontSize={9} fill="var(--dim)" className="font-mono">0</text>
          </svg>
        )}
      </div>

      {/* legend */}
      <div className="flex flex-wrap items-center gap-3 border-t border-border px-3 py-1.5 text-[10px] text-dim">
        {[
          ['buy', 'Sale'], ['forge', 'Forge'], ['feed', 'Feed'], ['shatter', 'Shatter'],
        ].map(([k, label]) => (
          <span key={k} className="inline-flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-full" style={{ background: KIND_COLOR[k] }} />
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}