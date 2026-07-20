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
    body: 'Every EVO locks real SOL inside a PDA. You always own that value. It cannot go to zero.',
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
  { label: 'Upside?', gamble: 'Fixed payout at best', evo: 'Floor + market premium + evolution' },
  { label: 'Can it rug?', gamble: 'Yes, server-side', evo: 'No, program is on-chain' },
];

const steps = [
  { icon: IconLock, title: 'Lock SOL', desc: 'Send SOL into the EVO program. It is locked inside a PDA -- a smart contract wallet nobody can raid.' },
  { icon: IconHammer, title: 'Get an EVO', desc: 'You receive a unique evolving on-chain asset. It has a floor value equal to the locked SOL.' },
  { icon: IconEvolve, title: 'It evolves', desc: 'On-chain feeds trigger evolution. The asset changes. The story writes itself on-chain.' },
  { icon: IconShatter, title: 'Trade or shatter', desc: 'List it for sale at any price above floor. Or shatter it to reclaim the locked SOL. Your call.' },
];

const strategies = [
  {
    name: 'Floor sniping',
    risk: 'Low',
    desc: 'Buy EVOs trading close to their locked SOL value. The floor protects your downside. If market sentiment improves, you capture the premium. If it doesn\'t, shatter and walk away with your SOL minus the fee.',
  },
  {
    name: 'Evolution flipping',
    risk: 'Medium',
    desc: 'Buy EVOs before a lifecycle trigger (feed, reveal, evolve). The visual state change can drive demand. Sell into the hype after the transition. Watch the lifecycle type -- not all EVOs evolve the same way.',
  },
  {
    name: 'Collection arbitrage',
    risk: 'Medium',
    desc: 'Some collections have higher locked SOL than others. Buy from a low-floor collection, shatter for profit if the market price drops below the lock. Or buy undervalued collections before broader market discovery.',
  },
  {
    name: 'Forge and flip',
    risk: 'High',
    desc: 'Forge new EVOs from fresh collections. If the collection gains traction, early forged assets carry premium value. If it doesn\'t, shatter for the floor. Risk is the creation fee plus time value of locked SOL.',
  },
];

const fees = [
  { action: 'Create collection', cost: '0.0459 SOL', goes: 'Protocol treasury' },
  { action: 'Forge (mint)', cost: 'Locked SOL amount', goes: 'Locked in EVO PDA (reclaimable)' },
  { action: 'Buy (marketplace)', cost: 'Listing price + royalty', goes: 'Seller + creator royalty' },
  { action: 'Transfer', cost: '0.009 SOL (flat)', goes: 'Protocol treasury' },
  { action: 'Shatter', cost: 'Up to 20% of locked SOL', goes: 'Collection fee account' },
  { action: 'List / delist', cost: 'Free', goes: '-' },
];

const faqs = [
  {
    q: 'What happens to my SOL when I forge?',
    a: 'It gets locked inside the EVO\'s PDA. Nobody can take it -- not the creator, not the treasury, not anyone. The only ways out are selling the EVO to another buyer or shattering it to reclaim the locked SOL.',
  },
  {
    q: 'Can the creator steal my SOL?',
    a: 'No. The locked SOL sits in a program-derived address controlled by the EVO program, not the creator. The program code only allows the current holder to shatter and reclaim. The creator cannot touch it.',
  },
  {
    q: 'What is the shatter fee?',
    a: 'Each collection sets a shatter fee up to a maximum of 20% of the locked SOL. This fee goes to the collection\'s fee account, not to a house. The remaining 80%+ goes straight to your wallet.',
  },
  {
    q: 'Can I lose money?',
    a: 'Yes. If you buy above floor and the market price drops, you can lose the premium. But you can always shatter to recover the locked SOL minus the shatter fee. Your downside is capped at the premium you paid plus the fee.',
  },
  {
    q: 'How do I know an EVO is real?',
    a: 'Every EVO is an on-chain account. Check the program address (HGLPG19Vkg3nNS1VJfPqY8Wtu2Ets4oKMTxAZRDRe3Ei) on Solscan. The account stores the locked SOL amount, current lifecycle state, and owner. No off-chain server can fake this.',
  },
  {
    q: 'What makes one EVO worth more than another?',
    a: 'Three things: (1) locked SOL amount -- higher lock means higher floor, (2) lifecycle stage -- evolved or revealed states can carry premium, (3) collection demand -- market sentiment drives price above floor.',
  },
  {
    q: 'Is this gambling?',
    a: 'No. Gambling is negative EV by design -- the house edge guarantees you lose over time. EVO is a backed asset -- you lock SOL, get a provably-owned on-chain asset, and can exit at any time. The floor is your safety net.',
  },
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
              Explore EVOs <IconArrowRight className="h-4 w-4" />
            </Link>
            <Link href="/create"
              className="inline-flex items-center gap-2 rounded border border-border-strong px-6 py-2.5 text-sm font-semibold text-text transition-colors hover:bg-surface-2">
              Forge one
            </Link>
          </div>
        </div>
      </section>

      {/* Quick nav */}
      <div className="border-b border-border bg-surface">
        <div className="mx-auto flex max-w-3xl flex-wrap gap-2 px-4 py-3 text-[11px]">
          {[
            ['#problem', 'The problem'],
            ['#difference', 'The difference'],
            ['#comparison', 'Head to head'],
            ['#how', 'How it works'],
            ['#strategies', 'Strategies'],
            ['#fees', 'Fees'],
            ['#faq', 'FAQ'],
          ].map(([href, label]) => (
            <a key={href} href={href} className="rounded border border-border-strong px-3 py-1 text-dim transition-colors hover:text-text">
              {label}
            </a>
          ))}
        </div>
      </div>

      {/* Why gambling is worse */}
      <section id="problem" className="border-b border-border bg-surface">
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
      <section id="difference" className="border-b border-border">
        <div className="mx-auto max-w-5xl px-4 py-16 lg:py-20">
          <div className="mb-12 text-center">
            <p className="text-[11px] uppercase tracking-[0.2em] text-dim">The difference</p>
            <h2 className="mt-2 text-xl font-semibold tracking-tight text-text-strong sm:text-2xl">
              EVO is not a bet. It is a backed asset.
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
      <section id="comparison" className="border-b border-border bg-surface">
        <div className="mx-auto max-w-3xl px-4 py-16 lg:py-20">
          <div className="mb-10 text-center">
            <p className="text-[11px] uppercase tracking-[0.2em] text-dim">Head to head</p>
            <h2 className="mt-2 text-xl font-semibold tracking-tight text-text-strong sm:text-2xl">
              Gambling vs EVO
            </h2>
          </div>
          <div className="overflow-x-auto rounded border border-border">
            <div className="grid min-w-[420px] grid-cols-3 gap-px bg-border">
              <div className="bg-surface p-3" />
              <div className="bg-surface p-3 text-center text-[11px] font-semibold uppercase tracking-wide text-dim">
                Gambling
              </div>
              <div className="bg-surface p-3 text-center text-[11px] font-semibold uppercase tracking-wide text-accent">
                EVO
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
      <section id="how" className="border-b border-border">
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

      {/* Strategies */}
      <section id="strategies" className="border-b border-border bg-surface">
        <div className="mx-auto max-w-3xl px-4 py-16 lg:py-20">
          <div className="mb-10 text-center">
            <p className="text-[11px] uppercase tracking-[0.2em] text-dim">Playbook</p>
            <h2 className="mt-2 text-xl font-semibold tracking-tight text-text-strong sm:text-2xl">
              Degen strategies
            </h2>
            <p className="mt-3 text-sm text-muted">
              Not financial advice. Just how the mechanics work.
            </p>
          </div>
          <div className="space-y-4">
            {strategies.map((s, i) => (
              <div key={i} className="rounded-lg border border-border bg-bg p-5">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-sm font-semibold text-text-strong">{s.name}</h3>
                  <span className={`rounded px-2 py-0.5 text-[10px] font-medium ${
                    s.risk === 'Low' ? 'bg-positive-soft text-positive' :
                    s.risk === 'Medium' ? 'bg-warn-soft text-warn' :
                    'bg-negative-soft text-negative'
                  }`}>
                    {s.risk} risk
                  </span>
                </div>
                <p className="mt-2 text-xs leading-relaxed text-muted">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Fees */}
      <section id="fees" className="border-b border-border">
        <div className="mx-auto max-w-3xl px-4 py-16 lg:py-20">
          <div className="mb-10 text-center">
            <p className="text-[11px] uppercase tracking-[0.2em] text-dim">Costs</p>
            <h2 className="mt-2 text-xl font-semibold tracking-tight text-text-strong sm:text-2xl">
              Fee breakdown
            </h2>
            <p className="mt-3 text-sm text-muted">
              Know what you pay before you click.
            </p>
          </div>
          <div className="overflow-x-auto rounded border border-border">
            <div className="grid min-w-[480px] grid-cols-3 gap-px bg-border">
              <div className="bg-surface-2 p-3 text-[11px] font-semibold uppercase tracking-wide text-dim">Action</div>
              <div className="bg-surface-2 p-3 text-[11px] font-semibold uppercase tracking-wide text-dim">Cost</div>
              <div className="bg-surface-2 p-3 text-[11px] font-semibold uppercase tracking-wide text-dim">Where it goes</div>
            </div>
            {fees.map((f, i) => (
              <div key={i} className="grid grid-cols-3 gap-px bg-border">
                <div className="bg-bg p-3 text-xs font-medium text-text-strong">{f.action}</div>
                <div className="bg-bg p-3 text-xs font-mono text-muted">{f.cost}</div>
                <div className="bg-bg p-3 text-xs text-muted">{f.goes}</div>
              </div>
            ))}
          </div>
          <p className="mt-4 text-[11px] text-dim">
            All fees are set on-chain at the protocol level. Creators cannot charge more than the
            maximums defined in the program. Check the collection config before forging.
          </p>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="border-b border-border bg-surface">
        <div className="mx-auto max-w-3xl px-4 py-16 lg:py-20">
          <div className="mb-10 text-center">
            <p className="text-[11px] uppercase tracking-[0.2em] text-dim">Questions</p>
            <h2 className="mt-2 text-xl font-semibold tracking-tight text-text-strong sm:text-2xl">
              FAQ
            </h2>
          </div>
          <div className="space-y-3">
            {faqs.map((faq, i) => (
              <details key={i} className="group rounded-lg border border-border bg-bg p-4">
                <summary className="cursor-pointer list-none text-sm font-semibold text-text-strong transition-colors group-hover:text-accent">
                  <span className="mr-2 font-mono text-dim">Q.</span>
                  {faq.q}
                </summary>
                <p className="mt-3 pl-6 text-xs leading-relaxed text-muted">{faq.a}</p>
              </details>
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
            EVO gives you a backed asset you control.
          </h2>
          <p className="mx-auto mt-4 max-w-md text-sm text-muted">
            One takes your money. The other locks it into something you own.
            That is the entire difference.
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link href="/"
              className="inline-flex items-center gap-2 rounded bg-accent px-8 py-3 text-sm font-semibold text-[#0a0a0c] transition-colors hover:bg-accent-hover">
              Get started <IconArrowRight className="h-4 w-4" />
            </Link>
            <Link href="/docs"
              className="inline-flex items-center gap-2 rounded border border-border-strong px-8 py-3 text-sm font-semibold text-text transition-colors hover:bg-surface-2">
              Read the docs
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2 px-3 py-3 text-[11px] text-dim lg:px-4">
          <span>Meld -- EVO Protocol -- Not financial advice, just better than a slot machine.</span>
          <div className="flex items-center gap-4">
            <Link href="/" className="transition-colors hover:text-text">Back to app</Link>
            <Link href="/docs" className="transition-colors hover:text-text">Docs</Link>
            <a href="https://github.com/stephenclawdbot-png/EVO" target="_blank" rel="noopener noreferrer" className="transition-colors hover:text-text">GitHub</a>
            <span>Powered by <a href="https://www.helius.dev/" target="_blank" rel="noopener noreferrer" className="transition-colors hover:text-text">Helius</a> / <a href="https://supabase.com/" target="_blank" rel="noopener noreferrer" className="transition-colors hover:text-text">Supabase</a> / <a href="https://solana.com/" target="_blank" rel="noopener noreferrer" className="transition-colors hover:text-text">Solana</a></span>
          </div>
        </div>
      </footer>
    </div>
  );
}