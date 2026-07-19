import { Nav } from '@/components/Nav';
import Link from 'next/link';
import {
  IconLock, IconHammer, IconShatter, IconTrendingUp,
  IconEvolve, IconSparkle, IconArrowRight, IconCheck, IconX,
} from '@/components/Icons';

const principles = [
  {
    icon: IconLock,
    title: 'SOL-backed floor',
    body: 'Every Meld locks real SOL inside a PDA. You always own that value. It cannot go to zero.',
  },
  {
    icon: IconEvolve,
    title: 'It evolves',
    body: 'On-chain feeds trigger state changes over time. The asset is alive, not a static dice roll.',
  },
  {
    icon: IconTrendingUp,
    title: 'Trade it',
    body: 'List, buy, flip. Markets create price discovery above the floor. You set the price.',
  },
  {
    icon: IconShatter,
    title: 'Shatter for value',
    body: 'Don\'t want to sell? Shatter it and reclaim the locked SOL. The exit is built in.',
  },
  {
    icon: IconSparkle,
    title: 'Fully on-chain',
    body: 'Every lock, evolution, transfer, and shatter is a Solana transaction. Verify it yourself.',
  },
  {
    icon: IconHammer,
    title: 'Not zero-sum',
    body: 'The floor is guaranteed by code. Speculation adds upside. You are never left with nothing.',
  },
];

const comparison: { label: string; gamble: string; evo: string }[] = [
  { label: 'Where does the money go?', gamble: 'House pocket', evo: 'Locked in a PDA' },
  { label: 'Do you own anything?', gamble: 'No', evo: 'An evolving on-chain asset' },
  { label: 'Worst case?', gamble: 'Total loss', evo: 'Reclaim locked SOL' },
  { label: 'Transparent?', gamble: 'No', evo: 'Every transaction on-chain' },
  { label: 'Exit liquidity?', gamble: 'Hope you cashed out', evo: 'Shatter or sell anytime' },
  { label: 'House edge?', gamble: 'Built in, always against you', evo: 'No house. Flat fee on transfers.' },
];

const steps = [
  { icon: IconLock, title: 'Lock SOL', desc: 'Send SOL into the Meld program. It is locked inside a PDA — a smart contract wallet nobody can raid.' },
  { icon: IconHammer, title: 'Get a Meld', desc: 'You receive a unique evolving on-chain asset. It has a floor value equal to the locked SOL.' },
  { icon: IconEvolve, title: 'It evolves', desc: 'On-chain feeds trigger evolution. The asset changes. The story writes itself on-chain.' },
  { icon: IconShatter, title: 'Trade or shatter', desc: 'List it for sale at any price above floor. Or shatter it to reclaim the locked SOL. Your call.' },
];

export default function DegensPage() {
  return (
    <div className="min-h-screen bg-bg text-text">
      <Nav />

      {/* Hero */}
      <section className="relative overflow-hidden border-b border-border">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute left-1/2 top-1/3 h-[500px] w-[500px] -translate-x-1/2 -translate-y-1/2 rounded-full blur-3xl"
            style={{ background: 'radial-gradient(circle, #818cf810, transparent 65%)' }} />
        </div>
        <div className="relative mx-auto flex max-w-3xl flex-col items-center px-4 py-24 text-center lg:py-32">
          <span className="mb-6 inline-flex items-center gap-1.5 rounded-full border border-border-strong bg-surface px-3 py-1 text-[11px] text-muted">
            <IconSparkle className="h-3 w-3 text-accent" />
            Not a casino
          </span>
          <h1 className="text-4xl font-bold leading-[1.05] tracking-tight text-text-strong sm:text-5xl lg:text-6xl">
            Meld for degens
          </h1>
          <p className="mt-6 max-w-lg text-sm text-muted sm:text-base">
            You lock SOL. You get an evolving on-chain asset. You own it.
            Not a bet. Not a spin. A backed primitive with a floor and an exit.
          </p>
          <div className="mt-10 flex flex-col items-center gap-3 sm:flex-row">
            <Link href="/"
              className="inline-flex items-center gap-2 rounded bg-accent px-6 py-2.5 text-sm font-semibold text-[#0a0a0c] transition-colors hover:bg-accent-hover">
              Explore Melds <IconArrowRight className="h-4 w-4" />
            </Link>
            <Link href="/create"
              className="inline-flex items-center gap-2 rounded border border-border-strong px-6 py-2.5 text-sm font-semibold text-text transition-colors hover:bg-surface-2">
              Forge one
            </Link>
          </div>
        </div>
      </section>

      {/* Why gambling is worse */}
      <section className="border-b border-border bg-surface">
        <div className="mx-auto max-w-3xl px-4 py-16 lg:py-20">
          <p className="text-[11px] uppercase tracking-[0.2em] text-dim">The problem</p>
          <h2 className="mt-2 text-xl font-semibold tracking-tight text-text-strong sm:text-2xl">
            Pure gambling is negative EV by design.
          </h2>
          <p className="mt-3 text-sm text-muted">
            You lose, the money is gone. The house always wins. There is no asset, no
            transparency, no exit. You are trusting a black box with your SOL.
          </p>
        </div>
      </section>

      {/* Why Meld is different */}
      <section className="border-b border-border">
        <div className="mx-auto max-w-5xl px-4 py-16 lg:py-20">
          <div className="mb-12 text-center">
            <p className="text-[11px] uppercase tracking-[0.2em] text-dim">The difference</p>
            <h2 className="mt-2 text-xl font-semibold tracking-tight text-text-strong sm:text-2xl">
              Meld is not a bet. It is a backed asset.
            </h2>
          </div>
          <div className="grid grid-cols-1 gap-px overflow-hidden rounded border border-border bg-border sm:grid-cols-2 lg:grid-cols-3">
            {principles.map((p, i) => (
              <div key={i} className="bg-bg p-6">
                <p.icon className="h-5 w-5 text-accent" />
                <h3 className="mt-3 text-sm font-semibold text-text-strong">{p.title}</h3>
                <p className="mt-1.5 text-xs leading-relaxed text-muted">{p.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Comparison table */}
      <section className="border-b border-border bg-surface">
        <div className="mx-auto max-w-3xl px-4 py-16 lg:py-20">
          <div className="mb-10 text-center">
            <p className="text-[11px] uppercase tracking-[0.2em] text-dim">Head to head</p>
            <h2 className="mt-2 text-xl font-semibold tracking-tight text-text-strong sm:text-2xl">
              Gambling vs Meld
            </h2>
          </div>
          <div className="overflow-hidden rounded border border-border">
            <div className="grid grid-cols-3 gap-px bg-border">
              <div className="bg-surface p-3" />
              <div className="bg-surface p-3 text-center text-[11px] font-semibold uppercase tracking-wide text-dim">
                Gambling
              </div>
              <div className="bg-surface p-3 text-center text-[11px] font-semibold uppercase tracking-wide text-accent">
                Meld
              </div>
            </div>
            {comparison.map((row, i) => (
              <div key={i} className="grid grid-cols-3 gap-px bg-border">
                <div className="bg-bg p-3 text-xs font-medium text-muted">{row.label}</div>
                <div className="bg-bg p-3 text-center">
                  <span className="inline-flex items-center gap-1.5 text-xs text-dim">
                    <IconX className="h-3.5 w-3.5 shrink-0" />
                    {row.gamble}
                  </span>
                </div>
                <div className="bg-bg p-3 text-center">
                  <span className="inline-flex items-center gap-1.5 text-xs text-text">
                    <IconCheck className="h-3.5 w-3.5 shrink-0 text-accent" />
                    {row.evo}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="border-b border-border">
        <div className="mx-auto max-w-3xl px-4 py-16 lg:py-20">
          <div className="mb-10 text-center">
            <p className="text-[11px] uppercase tracking-[0.2em] text-dim">How it works</p>
            <h2 className="mt-2 text-xl font-semibold tracking-tight text-text-strong sm:text-2xl">
              Four steps. One asset.
            </h2>
          </div>
          <div className="grid grid-cols-1 gap-px overflow-hidden rounded border border-border bg-border sm:grid-cols-2">
            {steps.map((step, i) => (
              <div key={i} className="bg-bg p-6">
                <div className="flex items-center gap-3">
                  <step.icon className="h-5 w-5 text-accent" />
                  <h3 className="text-sm font-semibold text-text-strong">
                    <span className="mr-1.5 font-mono text-dim">{String(i + 1).padStart(2, '0')}</span>
                    {step.title}
                  </h3>
                </div>
                <p className="mt-2 text-xs leading-relaxed text-muted">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Bottom line */}
      <section className="border-b border-border bg-surface">
        <div className="mx-auto max-w-3xl px-4 py-20 text-center lg:py-28">
          <p className="text-[11px] uppercase tracking-[0.2em] text-dim">The bottom line</p>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight text-text-strong sm:text-3xl">
            Gambling gives you a dice roll.
            <br />
            Meld gives you a backed asset you control.
          </h2>
          <p className="mx-auto mt-4 max-w-md text-sm text-muted">
            One takes your money. The other locks it into something you own.
            That is the entire difference.
          </p>
          <Link href="/"
            className="mt-10 inline-flex items-center gap-2 rounded bg-accent px-8 py-3 text-sm font-semibold text-[#0a0a0c] transition-colors hover:bg-accent-hover">
            Get started <IconArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2 px-3 py-3 text-[11px] text-dim lg:px-4">
          <span>Meld Protocol — Not financial advice, just better than a slot machine.</span>
          <div className="flex items-center gap-4">
            <Link href="/" className="transition-colors hover:text-text">Back to app</Link>
            <a href="https://github.com/stephenclawdbot-png/EVO" target="_blank" rel="noopener noreferrer" className="transition-colors hover:text-text">GitHub</a>
          </div>
        </div>
      </footer>
    </div>
  );
}