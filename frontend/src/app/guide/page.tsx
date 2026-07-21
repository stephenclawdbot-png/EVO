import type { Metadata } from "next";
import Link from "next/link";
import { IconHammer, IconTrendingUp, IconFeed, IconEvolve, IconShatter, IconPalette, IconSearch, IconLock, IconRefresh, IconCheck, IconX, IconSparkle, IconLink, IconSettings, IconUpload, IconUser, IconCoins, IconHelp, IconRocket, IconLayers } from "@/components/Icons";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Guide — How Creators & Collectors Use Meld",
  description: "Step-by-step visual guide: how creators upload collections and how collectors forge, trade, evolve, and shatter EVOs on Meld.",
};

export default function GuidePage() {
  return (
    <div className="min-h-screen bg-bg text-text">
      {/* Nav */}
      <header className="sticky top-0 z-50 border-b border-border bg-bg">
        <div className="flex h-11 items-center justify-between px-3">
          <Link href="/" className="flex items-center gap-2">
            <img src="/meld-dark.png" alt="Meld" className="h-6 w-6 dark:hidden" />
            <img src="/meld-light.png" alt="Meld" className="hidden h-6 w-6 dark:block" />
            <span className="text-sm font-semibold tracking-tight text-text-strong">Meld</span>
          </Link>
          <Link
            href="/"
            className="inline-flex h-7 items-center gap-1.5 rounded border border-border-strong bg-surface px-3 text-xs font-semibold text-text transition-colors hover:border-accent hover:text-text-strong"
          >
            ← Back
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-8 sm:py-12">
        {/* Hero */}
        <div className="mb-8 text-center sm:mb-12">
          <p className="text-[11px] uppercase tracking-[0.2em] text-dim">Guide</p>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-text-strong sm:text-3xl">
            How Meld Works
          </h1>
          <p className="mx-auto mt-3 max-w-lg text-sm text-muted">
            Creators launch collections. Collectors forge, trade, evolve, and shatter EVOs.
            Everything is on-chain. No admin keys. The SOL lives in the PDA.
          </p>
        </div>

        {/* What is an EVO? — visual anatomy for non-devs */}
        <div className="mb-8 rounded border border-border bg-surface p-4 sm:p-6">
          <h2 className="mb-1 text-center text-sm font-bold text-text-strong sm:text-base">What is an EVO?</h2>
          <p className="mb-4 text-center text-xs text-muted">Think of it as a trading card with SOL locked inside it.</p>
          <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center sm:gap-6">
            {/* EVO card visual */}
            <div className="relative w-32 rounded-lg border-2 border-accent/40 bg-surface-2 p-3">
              <div className="mb-2 flex h-20 items-center justify-center rounded bg-gradient-to-br from-accent/20 to-accent/5"><IconPalette className="h-8 w-8 text-accent" /></div>
              <div className="text-center">
                <div className="text-[10px] font-bold text-text-strong">EVO #001</div>
                <div className="mt-1 flex items-center justify-center gap-1 text-[9px] text-positive"><IconCoins className="h-3 w-3" /> 0.5 SOL locked</div>
                <div className="mt-0.5 text-[9px] text-dim">Owned by you</div>
              </div>
            </div>
            {/* Labels */}
            <div className="space-y-1.5 text-left text-xs sm:text-sm">
              <div className="flex items-center gap-2"><IconPalette className="h-4 w-4 flex-shrink-0 text-accent" /> <span className="text-muted"><strong className="text-text">Art</strong> — your image, stored permanently</span></div>
              <div className="flex items-center gap-2"><IconCoins className="h-4 w-4 flex-shrink-0 text-positive" /> <span className="text-muted"><strong className="text-text">Locked SOL</strong> — real money inside, always withdrawable</span></div>
              <div className="flex items-center gap-2"><IconUser className="h-4 w-4 flex-shrink-0 text-dim" /> <span className="text-muted"><strong className="text-text">Owner</strong> — whoever holds the EVO</span></div>
            </div>
          </div>
        </div>

        {/* Quick reference */}
        <div className="mb-8 grid grid-cols-2 gap-2 sm:grid-cols-5 sm:gap-3">
          <Pill icon={<IconHammer className="h-5 w-5" />} label="Forge" />
          <Pill icon={<IconTrendingUp className="h-5 w-5" />} label="Trade" />
          <Pill icon={<IconFeed className="h-5 w-5" />} label="Feed" />
          <Pill icon={<IconEvolve className="h-5 w-5" />} label="Evolve" />
          <Pill icon={<IconShatter className="h-5 w-5" />} label="Shatter" />
        </div>

        {/* ===== CREATORS ===== */}
        <Section title="For Creators" subtitle="Launch a collection with evolving on-chain art." icon={<IconPalette className="h-5 w-5 text-accent" />}>

          {/* Flow diagram */}
        <div className="mb-5 rounded border border-border bg-surface p-4 sm:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:gap-2">
            <FlowStep num="1" title="Connect" desc="Solana wallet" icon={<IconLink className="h-7 w-7" />} />
            <Arrow />
            <FlowStep num="2" title="Configure" desc="Name, supply, lifecycle" icon={<IconSettings className="h-7 w-7" />} />
            <Arrow />
            <FlowStep num="3" title="Upload Art" desc="Bulk images to Arweave" icon={<IconUpload className="h-7 w-7" />} />
            <Arrow />
            <FlowStep num="4" title="Deploy" desc="On-chain collection" icon={<IconRocket className="h-7 w-7" />} />
          </div>
        </div>

        <div className="space-y-3">
          <Step num="1" title="Connect Your Solana Wallet">
            Click the wallet button in the top right. Meld supports Phantom, Solflare, Backpack,
            and any Solana wallet adapter. You&apos;ll need a small amount of SOL for transaction fees.
          </Step>
          <Step num="2" title="Click &quot;Create Collection&quot;">
            Hit the Create button in the nav bar. You&apos;ll configure your collection:
            <ul className="mt-2 space-y-1 pl-4 text-muted">
              <li>• <strong className="text-text">Name</strong> — your collection name (e.g. &quot;Cosmic Kitties&quot;)</li>
              <li>• <strong className="text-text">Supply cap</strong> — max number of EVOs (e.g. 900)</li>
              <li>• <strong className="text-text">Lock amount</strong> — SOL locked per EVO (the floor value)</li>
              <li>• <strong className="text-text">Lifecycle type</strong> — how art changes over time (see below)</li>
              <li>• <strong className="text-text">Fee config</strong> — where royalties go (creator, treasury, burn, or split)</li>
            </ul>
          </Step>
          <Step num="3" title="Choose How Your Art Behaves">
            Pick a lifecycle type — this decides if and how your art changes over time:
            <div className="mt-2 space-y-1.5">
              <LifecycleRow name="Static" desc="Art stays the same forever. Easiest — just upload one image per EVO." />
              <LifecycleRow name="Reveal" desc="Art starts hidden (mystery), then you reveal it when ready." />
              <LifecycleRow name="Commit-Reveal" desc="Mystery reveal, but provably fair — nobody can peek or change the art." />
              <LifecycleRow name="Reveal & Evolve" desc="Art reveals, then evolves through stages as collectors feed it SOL." />
              <LifecycleRow name="Custom" desc="Full creative control — evolve + manually switch art stages anytime." />
            </div>
            <div className="mt-2 rounded bg-surface-2 px-3 py-2 text-[11px] text-dim">
              Not sure? Start with <strong className="text-text">Static</strong> — you can always make an evolving collection next time.
            </div>
          </Step>
          <Step num="4" title="Upload Your Artwork">
            Drag and drop all your images into the bulk uploader. They&apos;re stored permanently on
            Arweave (a decentralized hard drive that never deletes). Each image becomes one EVO.
            For evolving collections, upload art for each stage.
            <div className="mt-2 rounded bg-surface-2 px-3 py-2 text-[11px] text-dim">
              <strong className="text-text">Tip:</strong> Name your files in order (001.png, 002.png, …) to keep them organized.
            </div>
          </Step>
          <Step num="5" title="Deploy — Pay the Transaction Fee">
            Confirm the transaction in your wallet. Your collection goes live on Solana instantly.
            No admin keys, no central server — the protocol owns it, and it appears on the homepage
            right away.
            <div className="mt-2 rounded border border-accent/30 bg-accent-soft px-3 py-2 text-xs text-accent">
              <strong>Cost:</strong> ~0.02 SOL for transaction fees + Arweave storage (~0.005 SOL per image)
            </div>
          </Step>
        </div>
        </Section>

        {/* ===== COLLECTORS ===== */}
        <Section title="For Collectors" subtitle="Forge, trade, evolve, and shatter EVOs." icon={<IconHammer className="h-5 w-5 text-accent" />}>

        {/* Flow diagram */}
        <div className="mb-5 rounded border border-border bg-surface p-4 sm:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:gap-2">
            <FlowStep num="1" title="Browse" desc="Explore collections" icon={<IconSearch className="h-7 w-7" />} />
            <Arrow />
            <FlowStep num="2" title="Forge" desc="Lock SOL, mint EVO" icon={<IconHammer className="h-7 w-7" />} />
            <Arrow />
            <FlowStep num="3" title="Evolve" desc="Art changes over time" icon={<IconEvolve className="h-7 w-7" />} />
            <Arrow />
            <FlowStep num="4" title="Shatter" desc="Recover locked SOL" icon={<IconShatter className="h-7 w-7" />} />
          </div>
        </div>

        {/* Five operations */}
        <div className="mb-4 grid grid-cols-1 gap-px overflow-hidden rounded border border-border bg-border sm:grid-cols-5">
          <OpRow icon={<IconHammer className="h-6 w-6" />} name="Forge" desc="Lock SOL → mint EVO" />
          <OpRow icon={<IconTrendingUp className="h-6 w-6" />} name="Trade" desc="Buy/sell on-chain" />
          <OpRow icon={<IconFeed className="h-6 w-6" />} name="Feed" desc="Add SOL to the lock" />
          <OpRow icon={<IconEvolve className="h-6 w-6" />} name="Evolve" desc="Art changes at thresholds" />
          <OpRow icon={<IconShatter className="h-6 w-6" />} name="Shatter" desc="Destroy → recover SOL" />
        </div>

        {/* SOL lifecycle — where does your money go? */}
        <div className="mb-5 rounded border border-border bg-surface p-4 sm:p-6">
          <h3 className="mb-1 text-center text-sm font-bold text-text-strong">Where does your SOL go?</h3>
          <p className="mb-4 text-center text-xs text-muted">Your money is never locked away forever — you can always get it back.</p>
          <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:justify-center sm:gap-1">
            <SolFlow icon={<IconCoins className="h-6 w-6" />} label="You pay SOL" sublabel="at Forge" />
            <SolArrow />
            <SolFlow icon={<IconLock className="h-6 w-6" />} label="SOL locked inside" sublabel="the EVO" highlight />
            <SolArrow />
            <SolFlow icon={<IconRefresh className="h-6 w-6" />} label="SOL travels" sublabel="with trades" />
            <SolArrow />
            <SolFlow icon={<IconShatter className="h-6 w-6" />} label="Shatter →" sublabel="get SOL back" />
          </div>
          <div className="mt-3 rounded bg-surface-2 px-3 py-2 text-center text-[11px] text-dim">
            The SOL locked inside an EVO is its <strong className="text-text">floor value</strong> — the minimum it&apos;s always worth.
          </div>
        </div>

        {/* Evolution timeline — visual */}
        <div className="mb-5 rounded border border-border bg-surface p-4 sm:p-6">
          <h3 className="mb-1 text-center text-sm font-bold text-text-strong">How art evolves</h3>
          <p className="mb-4 text-center text-xs text-muted">Some collections change their art over time. Here&apos;s what that looks like:</p>
          <div className="flex items-end justify-center gap-2 sm:gap-4">
            <EvoStage num="1" icon={<IconSparkle className="h-7 w-7" />} label="Stage 1" sub="Fresh forge" color="from-zinc-600/20 to-zinc-600/5" />
            <div className="pb-8 text-accent">→</div>
            <EvoStage num="2" icon={<IconFeed className="h-7 w-7" />} label="Stage 2" sub="After feeding" color="from-blue-600/20 to-blue-600/5" />
            <div className="pb-8 text-accent">→</div>
            <EvoStage num="3" icon={<IconEvolve className="h-7 w-7" />} label="Stage 3" sub="Fully evolved" color="from-purple-600/20 to-purple-600/5" />
          </div>
          <div className="mt-3 rounded bg-surface-2 px-3 py-2 text-center text-[11px] text-dim">
            Not all collections evolve — <strong className="text-text">Static</strong> collections keep the same art forever.
          </div>
        </div>

        <div className="space-y-3">
          <Step num="1" title="Browse Collections">
            The homepage shows all collections sorted by locked SOL. Click any collection to see
            its EVOs, floor price, trading history, and charts. Search by name to find specific
            collections.
          </Step>
          <Step num="2" title="Forge an EVO">
            On a collection page, click &quot;Forge&quot; to mint a new EVO. You lock SOL inside it —
            this becomes its floor value (the minimum it&apos;s always worth). The art is assigned
            to your EVO (randomly or deterministically, depending on the collection).
            <div className="mt-2 rounded border border-accent/30 bg-accent-soft px-3 py-2 text-xs text-accent">
              <strong>Good to know:</strong> The locked SOL is yours. You can recover it anytime by shattering.
            </div>
          </Step>
          <Step num="3" title="Trade on-chain">
            List your EVO for sale at any price. Other collectors can buy it instantly — royalties
            are enforced automatically by the protocol, so you always get your cut. The locked SOL
            (floor value) travels with the EVO to the new owner.
          </Step>
          <Step num="4" title="Feed SOL to Evolve It">
            Add more SOL to your EVO&apos;s lock. This raises its floor value and can trigger
            evolution in evolving collections. Feeding is optional — your EVO works fine without it.
          </Step>
          <Step num="5" title="Evolve">
            For evolving collections, the art changes when certain thresholds are met (enough SOL
            locked, enough trades, etc.). Each stage is a new visual — watch your EVO transform
            over time.
          </Step>
          <Step num="6" title="Shatter to Recover SOL">
            Done with your EVO? Shatter it. The EVO is destroyed and you get back the locked SOL,
            minus a small fee. This is the key difference from regular NFTs — you always have a
            floor value you can cash out into.
          </Step>
        </div>
        </Section>

        {/* ===== KEY DIFFERENCES ===== */}
        <Section title="EVO vs Regular NFT" subtitle="What makes Meld different." icon={<IconRefresh className="h-5 w-5 text-accent" />}>
        <div className="overflow-hidden rounded border border-border">
          <table className="w-full text-xs sm:text-sm">
            <thead>
              <tr className="border-b border-border bg-surface">
                <th className="px-3 py-2.5 text-left font-semibold text-text">Feature</th>
                <th className="px-3 py-2.5 text-left font-semibold text-muted">Regular NFT</th>
                <th className="px-3 py-2.5 text-left font-semibold text-accent">Meld EVO</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              <CompareRow feature="Floor value" nft={<span className="flex items-center gap-1.5"><IconX className="h-4 w-4 text-negative" /> None</span>} evo={<span className="flex items-center gap-1.5"><IconCheck className="h-4 w-4" /> Locked SOL</span>} />
              <CompareRow feature="Art changes" nft={<span className="flex items-center gap-1.5"><IconX className="h-4 w-4 text-negative" /> Static</span>} evo={<span className="flex items-center gap-1.5"><IconCheck className="h-4 w-4" /> Evolves</span>} />
              <CompareRow feature="Exit mechanism" nft="Sell on marketplace" evo="Shatter for SOL" />
              <CompareRow feature="Royalties" nft="Optional, bypassable" evo="Enforced on-chain" />
              <CompareRow feature="Admin keys" nft="Often yes" evo={<span className="flex items-center gap-1.5"><IconX className="h-4 w-4 text-negative" /> None</span>} />
              <CompareRow feature="Storage" nft="Centralized/IPFS" evo="Arweave (permanent)" />
            </tbody>
          </table>
        </div>
        </Section>

        {/* ===== FAQ ===== */}
        <Section title="FAQ" subtitle="" icon={<IconHelp className="h-5 w-5 text-accent" />}>
        <div className="space-y-2">
          <Faq q="How much does it cost to create a collection?" a="About 0.02 SOL for the transaction + roughly 0.005 SOL per image for permanent storage. A 100-image collection costs around 0.5 SOL total." />
          <Faq q="Can I change the art after deploying?" a="It depends on the lifecycle type you chose. Static collections can't be changed. Commit-Reveal is locked forever (provably fair). Custom lifecycle lets you switch art stages manually." />
          <Faq q="What happens when I shatter an EVO?" a="The EVO is permanently destroyed and you get back the SOL that was locked inside it, minus a small fee. The art is gone — shattering is permanent." />
          <Faq q="Are royalties enforced?" a="Yes — the protocol enforces royalties on every trade automatically. No marketplace can bypass them. You set where the fees go when you create the collection." />
          <Faq q="What wallets are supported?" a="Phantom, Solflare, Backpack, and any Solana-compatible wallet." />
          <Faq q="Do I need to know how to code?" a="No! If you can upload images and click buttons, you can create a collection. The entire process is visual — no coding required." />
        </div>
        </Section>

        {/* CTA */}
        <div className="mt-10 text-center">
          <Link
            href="/create"
            className="inline-flex items-center gap-2 rounded border border-accent bg-accent px-6 py-2.5 text-sm font-bold text-black transition-colors hover:bg-accent-hover"
          >
            Create Collection →
          </Link>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2 px-3 py-3 text-[11px] text-dim lg:px-4">
          <span>Meld — EVO Protocol — Assets that don&apos;t stay the same.</span>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <Link href="/guide" className="transition-colors hover:text-text">Guide</Link>
            <Link href="/docs" className="transition-colors hover:text-text">Docs</Link>
            <Link href="/degens" className="transition-colors hover:text-text">Degen Guide</Link>
            <Link href="/" className="transition-colors hover:text-text">Home</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

/* ─── Components ─── */

function Section({ title, subtitle, icon, children }: { title: string; subtitle: string; icon: ReactNode; children: React.ReactNode }) {
  return (
    <section className="mb-10 sm:mb-14">
      <h2 className="mb-1 flex items-center gap-2 text-lg font-bold tracking-tight text-text-strong sm:text-xl">
        <span>{icon}</span> {title}
      </h2>
      {subtitle && <p className="mb-5 text-xs text-muted sm:text-sm">{subtitle}</p>}
      {children}
    </section>
  );
}

function Pill({ icon, label }: { icon: ReactNode; label: string }) {
  return (
    <div className="flex items-center justify-center gap-1.5 rounded border border-border bg-surface px-2 py-2 text-xs font-semibold text-text sm:flex-col sm:gap-0.5">
      <span className="text-base">{icon}</span>
      <span>{label}</span>
    </div>
  );
}

function FlowStep({ num, title, desc, icon }: { num: string; title: string; desc: string; icon: ReactNode }) {
  return (
    <div className="flex-1 rounded border border-border bg-surface-2 p-3 text-center sm:p-4">
      <div className="mb-1.5 text-2xl">{icon}</div>
      <div className="mb-0.5 flex items-center justify-center gap-1.5">
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-accent text-[10px] font-bold text-black">{num}</span>
        <span className="text-xs font-bold sm:text-sm">{title}</span>
      </div>
      <div className="text-[10px] text-dim sm:text-[11px]">{desc}</div>
    </div>
  );
}

function Arrow() {
  return (
    <div className="flex items-center justify-center">
      <svg className="rotate-90 text-accent sm:rotate-0" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M5 12h14" /><path d="m12 5 7 7-7 7" />
      </svg>
    </div>
  );
}

function Step({ num, title, children }: { num: string; title: string; children: React.ReactNode }) {
  return (
    <div className="rounded border border-border bg-surface p-4 transition-colors hover:border-border-strong">
      <div className="flex gap-3">
        <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded bg-accent-soft text-sm font-bold text-accent">
          {num}
        </div>
        <div className="min-w-0">
          <h3 className="mb-1 text-sm font-bold">{title}</h3>
          <div className="text-xs leading-relaxed text-muted sm:text-sm">{children}</div>
        </div>
      </div>
    </div>
  );
}

function LifecycleRow({ name, desc }: { name: string; desc: string }) {
  return (
    <div className="flex items-start gap-2 rounded border border-border bg-surface-2 px-3 py-2">
      <span className="flex-shrink-0 text-xs font-bold text-accent">{name}</span>
      <span className="text-xs text-muted">{desc}</span>
    </div>
  );
}

function OpRow({ icon, name, desc }: { icon: ReactNode; name: string; desc: string }) {
  return (
    <div className="bg-surface p-3 text-center">
      <div className="mb-1 text-xl">{icon}</div>
      <div className="text-xs font-bold text-text-strong">{name}</div>
      <div className="text-[10px] text-dim">{desc}</div>
    </div>
  );
}

function CompareRow({ feature, nft, evo }: { feature: string; nft: ReactNode; evo: ReactNode }) {
  return (
    <tr className="transition-colors hover:bg-surface-2">
      <td className="px-3 py-2 font-semibold text-text">{feature}</td>
      <td className="px-3 py-2 text-muted">{nft}</td>
      <td className="px-3 py-2 font-medium text-positive">{evo}</td>
    </tr>
  );
}

function Faq({ q, a }: { q: string; a: string }) {
  return (
    <details className="group overflow-hidden rounded border border-border bg-surface">
      <summary className="flex cursor-pointer items-center justify-between gap-2 p-3 text-xs font-semibold text-text transition-colors hover:bg-surface-2 sm:text-sm list-none">
        {q}
        <svg className="flex-shrink-0 text-dim transition-transform group-open:rotate-180" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <path d="m6 9 6 6 6-6" />
        </svg>
      </summary>
      <div className="px-3 pb-3 text-xs leading-relaxed text-muted sm:text-sm">{a}</div>
    </details>
  );
}

function SolFlow({ icon, label, sublabel, highlight }: { icon: ReactNode; label: string; sublabel: string; highlight?: boolean }) {
  return (
    <div className={`flex flex-1 flex-col items-center rounded border p-3 text-center ${highlight ? 'border-accent/40 bg-accent-soft' : 'border-border bg-surface-2'}`}>
      <div className="mb-1 text-2xl">{icon}</div>
      <div className="text-xs font-bold text-text-strong">{label}</div>
      <div className="text-[10px] text-dim">{sublabel}</div>
    </div>
  );
}

function SolArrow() {
  return (
    <div className="flex items-center justify-center">
      <svg className="rotate-90 text-accent sm:rotate-0" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M5 12h14" /><path d="m12 5 7 7-7 7" />
      </svg>
    </div>
  );
}

function EvoStage({ num, icon, label, sub, color }: { num: string; icon: ReactNode; label: string; sub: string; color: string }) {
  return (
    <div className="flex flex-col items-center">
      <div className={`mb-1.5 flex h-16 w-16 items-center justify-center rounded-lg border border-border bg-gradient-to-br ${color} text-3xl sm:h-20 sm:w-20`}>
        {icon}
      </div>
      <div className="flex items-center gap-1">
        <span className="flex h-4 w-4 items-center justify-center rounded-full bg-accent text-[9px] font-bold text-black">{num}</span>
        <span className="text-[10px] font-bold text-text-strong sm:text-xs">{label}</span>
      </div>
      <div className="text-[9px] text-dim sm:text-[10px]">{sub}</div>
    </div>
  );
}