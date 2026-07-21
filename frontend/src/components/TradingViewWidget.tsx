'use client';

import { useMemo, useState, useEffect, useRef } from 'react';
import { TradeEvent } from '@/lib/evo-chart';
import { fmtSolValue } from '@/lib/format';

interface TradingViewWidgetProps {
  events: TradeEvent[];
  loading?: boolean;
  currentFloorSol?: number | null;
  collectionName?: string;
}

type Range = '1h' | '24h' | '7d' | 'all';

const RANGE_MS: Record<Range, number> = {
  '1h': 3600_000,
  '24h': 86400_000,
  '7d': 604800_000,
  'all': Infinity,
};

/**
 * Enhanced trade chart with candlestick-style visualization and timezone support.
 * Replaces the TradingView external widget with a custom on-chain data viz
 * that doesn't require an external ticker symbol (EVOs trade inside the protocol).
 */
export function TradingViewWidget({ events, loading, currentFloorSol, collectionName }: TradingViewWidgetProps) {
  const [range, setRange] = useState<Range>('24h');
  const [chartType, setChartType] = useState<'line' | 'candles'>('candles');
  const containerRef = useRef<HTMLDivElement>(null);

  // Visitor timezone for axis labels
  const tz = useMemo(() => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
    } catch { return 'UTC'; }
  }, []);

  const view = useMemo(() => {
    const now = Date.now();
    const cutoff = range === 'all' ? 0 : now - RANGE_MS[range];
    const priced = events.filter(e => e.priceSol > 0 && e.timestamp >= cutoff);

    if (priced.length === 0) return { points: [], candles: [], volPoints: [], min: 0, max: 0, volMax: 0 };

    const sorted = [...priced].sort((a, b) => a.timestamp - b.timestamp);
    const minPrice = Math.min(...sorted.map(e => e.priceSol));
    const maxPrice = Math.max(...sorted.map(e => e.priceSol));

    // Build candle buckets
    const bucketMs = range === '1h' ? 5 * 60_000 : range === '24h' ? 30 * 60_000 : range === '7d' ? 4 * 3600_000 : 12 * 3600_000;
    const buckets = new Map<number, { open: number; high: number; low: number; close: number; vol: number; time: number }>();

    for (const e of sorted) {
      const bucket = Math.floor(e.timestamp / bucketMs) * bucketMs;
      const existing = buckets.get(bucket);
      if (existing) {
        existing.high = Math.max(existing.high, e.priceSol);
        existing.low = Math.min(existing.low, e.priceSol);
        existing.close = e.priceSol;
        existing.vol += 1;
      } else {
        buckets.set(bucket, { open: e.priceSol, high: e.priceSol, low: e.priceSol, close: e.priceSol, vol: 1, time: bucket });
      }
    }

    const candles = [...buckets.values()].sort((a, b) => a.time - b.time);
    const volMax = Math.max(...candles.map(c => c.vol), 1);

    return { candles, volPoints: candles, min: minPrice, max: maxPrice, volMax };
  }, [events, range]);

  // Chart dimensions
  const W = 1000;
  const H = 320;
  const PAD = { top: 16, right: 60, bottom: 28, left: 0 };
  const chartW = W - PAD.left - PAD.right;
  const chartH = H - PAD.top - PAD.bottom;
  const volH = 50;

  const priceRange = view.max - view.min || 1;
  const yPrice = (p: number) => PAD.top + chartH - ((p - view.min) / priceRange) * (chartH - volH);
  const xTime = (t: number, allCandles: { time: number }[]) => {
    if (allCandles.length === 0) return 0;
    const first = allCandles[0].time;
    const last = allCandles[allCandles.length - 1].time;
    const span = last - first || 1;
    return PAD.left + ((t - first) / span) * chartW;
  };

  const candleWidth = view.candles.length > 0 ? Math.max(2, chartW / view.candles.length * 0.7) : 0;

  // Time axis labels in visitor timezone
  const timeLabels = useMemo(() => {
    if (view.candles.length === 0) return [];
    const count = 6;
    const first = view.candles[0].time;
    const last = view.candles[view.candles.length - 1].time;
    return Array.from({ length: count }, (_, i) => {
      const t = first + (last - first) * (i / (count - 1));
      const d = new Date(t);
      const label = range === '1h' || range === '24h'
        ? d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', timeZone: tz })
        : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: tz });
      return { x: xTime(t, view.candles), label };
    });
  }, [view.candles, range, tz]);

  // Price axis labels
  const priceLabels = useMemo(() => {
    const count = 5;
    return Array.from({ length: count }, (_, i) => {
      const p = view.min + priceRange * (i / (count - 1));
      return { y: yPrice(p), label: fmtSolValue(p) };
    });
  }, [view.min, view.max, priceRange]);

  const KIND_COLOR: Record<string, string> = {
    forge: 'var(--accent)',
    buy: 'var(--positive)',
    feed: 'var(--accent-hover)',
    shatter: 'var(--negative)',
  };

  const RANGE_LABELS: { key: Range; label: string }[] = [
    { key: '1h', label: '1H' },
    { key: '24h', label: '24H' },
    { key: '7d', label: '7D' },
    { key: 'all', label: 'ALL' },
  ];

  return (
    <div className="rounded-lg border border-border bg-surface">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-3 py-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-text-strong">{collectionName || 'EVO'} Chart</span>
          {currentFloorSol != null && currentFloorSol > 0 && (
            <span className="font-mono tabular-nums text-xs text-positive">◎ {fmtSolValue(currentFloorSol)}</span>
          )}
          <span className="hidden text-[10px] text-dim sm:inline">{view.candles.length} candles</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setChartType(chartType === 'candles' ? 'line' : 'candles')}
            className="rounded border border-border-strong px-2 py-0.5 text-[10px] text-muted transition-colors hover:text-text"
          >
            {chartType === 'candles' ? 'Candles' : 'Line'}
          </button>
          <div className="flex rounded border border-border p-0.5">
            {RANGE_LABELS.map(r => (
              <button key={r.key} onClick={() => setRange(r.key)}
                className={`rounded px-2 py-0.5 text-[10px] font-semibold transition-colors ${range === r.key ? 'bg-accent text-white' : 'text-muted hover:text-text'}`}>
                {r.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Chart body */}
      <div ref={containerRef} className="relative px-2 py-1">
        {loading ? (
          <div className="flex h-[360px] items-center justify-center">
            <div className="text-xs text-dim">Loading chart…</div>
          </div>
        ) : view.candles.length === 0 ? (
          <div className="flex h-[360px] items-center justify-center">
            <div className="text-center">
              <div className="text-xs text-dim">No trade data yet</div>
              <div className="mt-1 text-[10px] text-dim">Trades will appear here after the first buys</div>
            </div>
          </div>
        ) : (
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 360 }}>
            {/* Grid lines */}
            {priceLabels.map((pl, i) => (
              <g key={i}>
                <line x1={PAD.left} y1={pl.y} x2={W - PAD.right} y2={pl.y} stroke="var(--border)" strokeWidth={0.5} opacity={0.3} />
                <text x={W - PAD.right + 4} y={pl.y + 3} fill="var(--dim)" fontSize={9} fontFamily="monospace">{pl.label}</text>
              </g>
            ))}

            {/* Volume bars */}
            {view.candles.map((c, i) => {
              const x = xTime(c.time, view.candles);
              const vh = (c.vol / view.volMax) * volH;
              return (
                <rect key={`v${i}`} x={x - candleWidth / 2} y={PAD.top + chartH - vh} width={candleWidth}
                  height={vh} fill="var(--border-strong)" opacity={0.2} rx={1} />
              );
            })}

            {/* Candles or line */}
            {chartType === 'candles' ? (
              view.candles.map((c, i) => {
                const x = xTime(c.time, view.candles);
                const isUp = c.close >= c.open;
                const color = isUp ? 'var(--positive)' : 'var(--negative)';
                const yHigh = yPrice(c.high);
                const yLow = yPrice(c.low);
                const yOpen = yPrice(c.open);
                const yClose = yPrice(c.close);
                const bodyTop = Math.min(yOpen, yClose);
                const bodyH = Math.max(1, Math.abs(yClose - yOpen));
                return (
                  <g key={`c${i}`}>
                    <line x1={x} y1={yHigh} x2={x} y2={yLow} stroke={color} strokeWidth={0.8} />
                    <rect x={x - candleWidth / 2} y={bodyTop} width={candleWidth} height={bodyH} fill={color} opacity={0.8} rx={1} />
                  </g>
                );
              })
            ) : (
              <polyline
                points={view.candles.map(c => `${xTime(c.time, view.candles)},${yPrice(c.close)}`).join(' ')}
                fill="none" stroke="var(--accent)" strokeWidth={1.5} strokeLinejoin="round" />
            )}

            {/* Time axis labels */}
            {timeLabels.map((tl, i) => (
              <text key={i} x={tl.x} y={H - 6} fill="var(--dim)" fontSize={9} textAnchor="middle">{tl.label}</text>
            ))}
          </svg>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between border-t border-border px-3 py-1.5">
        <div className="flex items-center gap-3 text-[10px] text-dim">
          {Object.entries(KIND_COLOR).map(([k, c]) => (
            <span key={k} className="flex items-center gap-1">
              <span className="inline-block h-2 w-2 rounded-full" style={{ background: c }} /> {k}
            </span>
          ))}
        </div>
        <span className="text-[10px] text-dim">Times in {tz}</span>
      </div>
    </div>
  );
}