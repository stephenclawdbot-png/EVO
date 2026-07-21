'use client';

import { useEffect, useRef, useState } from 'react';
import { IconHammer, IconTrendingUp, IconFeed, IconEvolve, IconShatter } from './Icons';
import { fmtSolValue } from '@/lib/format';

/**
 * LivingEvo — a scroll-driven narrative of a single EVO object.
 * A sticky visual on one side evolves as the reader scrolls past each stage:
 *   forged → traded → fed → evolved → shattered.
 * The locked SOL is the hero number throughout.
 */

type StageId = 'forged' | 'traded' | 'fed' | 'evolved' | 'shattered';

interface Stage {
  id: StageId;
  icon: typeof IconHammer;
  title: string;
  body: string;
  lockedSol: number;   // locked SOL at this stage
  note: string;        // small caption under the hero number
}

const STAGES: Stage[] = [
  {
    id: 'forged',
    icon: IconHammer,
    title: 'Forged',
    body: 'A new EVO is born. 0.10 SOL is locked inside a PDA — not held by anyone, not controlled by any team. The art is dormant, waiting.',
    lockedSol: 0.10,
    note: 'locked forever',
  },
  {
    id: 'traded',
    icon: IconTrendingUp,
    title: 'Traded',
    body: 'Sold for 2.50 SOL. The locked value travels with the object — the buyer inherits the floor. Royalties route on-chain. No one can skip them.',
    lockedSol: 0.10,
    note: 'travels with it',
  },
  {
    id: 'fed',
    icon: IconFeed,
    title: 'Fed',
    body: '0.05 SOL added. The EVO grows. Its locked value rises, its form brightens. Feeding is how an owner invests in the object itself.',
    lockedSol: 0.15,
    note: 'it grows',
  },
  {
    id: 'evolved',
    icon: IconEvolve,
    title: 'Evolved',
    body: 'Thresholds met. The object changes form — a new visual stage, written on-chain. Evolution is permissionless; the state machine is the art.',
    lockedSol: 0.15,
    note: 'the art changes',
  },
  {
    id: 'shattered',
    icon: IconShatter,
    title: 'Shattered',
    body: 'The owner destroys the EVO and recovers the locked SOL, minus a fee. The object is gone. The value is not. That is the guarantee.',
    lockedSol: 0.15,
    note: 'recoverable forever',
  },
];

export function LivingEvo() {
  const [active, setActive] = useState(0);
  const sectionRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        // pick the entry closest to the viewport center that is intersecting
        let best: { index: number; dist: number } | null = null;
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const idx = Number((entry.target as HTMLElement).dataset.index);
          const rect = entry.boundingClientRect;
          const center = rect.top + rect.height / 2;
          const dist = Math.abs(center - window.innerHeight / 2);
          if (best === null || dist < best.dist) best = { index: idx, dist };
        }
        if (best) setActive(best.index);
      },
      { rootMargin: '-30% 0px -30% 0px', threshold: [0, 0.25, 0.5, 0.75, 1] },
    );
    sectionRefs.current.forEach((el) => el && observer.observe(el));
    return () => observer.disconnect();
  }, []);

  const stage = STAGES[active];

  return (
    <section className="relative border-b border-border">
      {/* ─── Mobile: compact tabbed stepper, one stage at a time ─── */}
      <div className="mx-auto max-w-6xl px-4 py-12 lg:hidden">
        <div className="mb-8 text-center">
          <p className="text-[11px] uppercase tracking-[0.2em] text-dim">One object</p>
          <h2 className="mt-2 text-xl font-bold tracking-tight text-text-strong">
            Follow a single EVO through its entire life.
          </h2>
        </div>

        {/* tap stepper */}
        <div className="mb-6 flex items-center justify-center gap-1.5">
          {STAGES.map((s, i) => {
            const Icon = s.icon;
            return (
              <button
                key={s.id}
                onClick={() => setActive(i)}
                aria-label={s.title}
                className={`flex h-9 w-9 items-center justify-center rounded border transition-colors ${
                  i === active
                    ? 'border-accent bg-accent-soft text-accent'
                    : 'border-border-strong bg-surface text-dim'
                }`}
              >
                <Icon className="h-4 w-4" />
              </button>
            );
          })}
        </div>

        {/* active stage visual + copy */}
        <div className="flex flex-col items-center">
          <EvoVisual stage={active} lockedSol={stage.lockedSol} note={stage.note} stageId={stage.id} compact />
          <div className="mt-6 max-w-sm text-center">
            <span className="font-mono text-[11px] uppercase tracking-wider text-dim">
              {String(active + 1).padStart(2, '0')} / 05
            </span>
            <h3 className="mt-2 text-2xl font-bold tracking-tight text-text-strong">{stage.title}</h3>
            <p className="mt-3 text-sm leading-relaxed text-text">{stage.body}</p>
          </div>
        </div>

        {/* progress rail */}
        <div className="mt-8 flex items-center gap-1.5">
          {STAGES.map((s, i) => (
            <div
              key={s.id}
              className={`h-0.5 flex-1 rounded-full transition-colors duration-300 ${i <= active ? 'bg-accent' : 'bg-border-strong'}`}
            />
          ))}
        </div>
      </div>

      {/* ─── Desktop: sticky-scroll narrative ─── */}
      <div className="mx-auto hidden max-w-6xl grid-cols-1 gap-0 lg:grid lg:grid-cols-2">
        {/* Sticky visual — the one EVO */}
        <div className="sticky top-11 h-[calc(100vh-2.75rem)] items-center justify-center border-r border-border bg-bg lg:flex">
          <EvoVisual stage={active} lockedSol={stage.lockedSol} note={stage.note} stageId={stage.id} />
        </div>

        {/* Scroll stages */}
        <div className="px-4 py-8 lg:px-12">
          <div className="mb-10 lg:mb-16">
            <p className="text-[11px] uppercase tracking-[0.2em] text-dim">One object</p>
            <h2 className="mt-2 text-xl font-bold tracking-tight text-text-strong sm:text-2xl">
              Follow a single EVO through its entire life.
            </h2>
          </div>

          <div className="space-y-24 lg:space-y-32">
            {STAGES.map((s, i) => {
              const Icon = s.icon;
              const isActive = i === active;
              return (
                <div
                  key={s.id}
                  data-index={i}
                  ref={(el) => { sectionRefs.current[i] = el; }}
                  className="min-h-[70vh] flex flex-col justify-center"
                >
                  <div className={`flex items-center gap-2.5 transition-opacity duration-300 ${isActive ? 'opacity-100' : 'opacity-40'}`}>
                    <span className="flex h-8 w-8 items-center justify-center rounded border border-border-strong bg-surface text-accent">
                      <Icon className="h-4 w-4" />
                    </span>
                    <span className="font-mono text-[11px] uppercase tracking-wider text-dim">
                      {String(i + 1).padStart(2, '0')} / 05
                    </span>
                  </div>
                  <h3 className={`mt-4 text-2xl font-bold tracking-tight transition-colors duration-300 sm:text-3xl ${isActive ? 'text-text-strong' : 'text-muted'}`}>
                    {s.title}
                  </h3>
                  <p className={`mt-3 max-w-md text-sm leading-relaxed transition-colors duration-300 ${isActive ? 'text-text' : 'text-dim'}`}>
                    {s.body}
                  </p>
                </div>
              );
            })}
          </div>

          {/* progress rail */}
          <div className="mt-12 flex items-center gap-1.5">
            {STAGES.map((s, i) => (
              <div
                key={s.id}
                className={`h-0.5 flex-1 rounded-full transition-colors duration-300 ${i <= active ? 'bg-accent' : 'bg-border-strong'}`}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/** The single EVO visual — a hexagon that changes form per stage. */
function EvoVisual({
  stage, lockedSol, note, stageId, compact,
}: {
  stage: number;
  lockedSol: number;
  note: string;
  stageId: StageId;
  compact?: boolean;
}) {
  // visual properties per stage
  const isShattered = stageId === 'shattered';
  const isEvolved = stageId === 'evolved';
  const isFed = stageId === 'fed';
  const scale = 1 + (stage >= 2 ? 0.08 : 0); // grows after feeding
  const glow = stage === 0 ? 0.35 : isShattered ? 0.1 : 0.55 + stage * 0.05;
  const hexColor = isShattered ? 'var(--negative)' : isEvolved ? 'var(--positive)' : 'var(--accent)';
  const facets = isEvolved ? 6 : 4;

  return (
    <div className="relative flex flex-col items-center">
      <div
        className={`relative ${compact ? 'h-40 w-40' : 'h-72 w-72'}`}
        style={{ transition: 'all 600ms cubic-bezier(0.22,1,0.36,1)' }}
      >
        {/* ambient glow */}
        <div
          className="absolute inset-0 rounded-full blur-2xl"
          style={{ background: `radial-gradient(circle, ${hexColor}${isShattered ? '10' : '22'}, transparent 70%)`, opacity: glow, transition: 'all 600ms ease' }}
        />
        {/* the hexagon */}
        <svg viewBox="0 0 200 200" className="absolute inset-0 h-full w-full" style={{ transform: `scale(${scale})`, transition: 'transform 600ms cubic-bezier(0.22,1,0.36,1)' }}>
          <defs>
            <linearGradient id={`g-${stage}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={hexColor} stopOpacity={isShattered ? 0.25 : 0.45} />
              <stop offset="100%" stopColor={hexColor} stopOpacity={isShattered ? 0.05 : 0.12} />
            </linearGradient>
          </defs>
          {/* hex outline */}
          <path
            d="M100 12 172 54 172 146 100 188 28 146 28 54 100 12Z"
            fill={`url(#g-${stage})`}
            stroke={hexColor}
            strokeWidth={1.5}
            strokeLinejoin="round"
            style={{ transition: 'all 600ms ease', opacity: isShattered ? 0.35 : 1 }}
          />
          {/* inner facets — more after evolve */}
          {Array.from({ length: facets }).map((_, i) => {
            const a = (Math.PI * 2 * i) / facets - Math.PI / 2;
            const r = 46;
            return (
              <line
                key={i}
                x1="100" y1="100"
                x2={100 + Math.cos(a) * r} y2={100 + Math.sin(a) * r}
                stroke={hexColor}
                strokeWidth={1}
                strokeOpacity={isShattered ? 0.2 : 0.5}
                style={{ transition: 'all 600ms ease' }}
              />
            );
          })}
          {/* center mark */}
          <path
            d="M82 84h28l-20 24h20"
            fill="none"
            stroke={hexColor}
            strokeWidth={3}
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ transition: 'all 600ms ease', opacity: isShattered ? 0.3 : 0.9 }}
          />
          {/* shatter cracks */}
          {isShattered && (
            <g stroke="var(--negative)" strokeWidth={1.5} strokeLinecap="round" opacity={0.85}>
              <path d="M100 12 110 70 80 100 105 140 95 188" />
              <path d="M172 54 130 90 100 100" />
              <path d="M28 54 70 90 100 100" />
              <path d="M100 100 70 130 28 146" />
              <path d="M100 100 130 130 172 146" />
            </g>
          )}
        </svg>
      </div>

      {/* hero number — locked SOL */}
      <div className="mt-6 text-center" style={{ transition: 'all 400ms ease' }}>
        <p className="text-[10px] uppercase tracking-[0.2em] text-dim">
          {isShattered ? 'recovered' : 'this EVO contains'}
        </p>
        <p
          className="mt-1 font-mono text-4xl font-bold tracking-tight sm:text-5xl"
          style={{ color: isShattered ? 'var(--positive)' : 'var(--text-strong)', transition: 'color 400ms ease' }}
        >
          {fmtSolValue(lockedSol)} SOL
        </p>
        <p className="mt-1 text-xs text-muted">{note}</p>
      </div>
    </div>
  );
}