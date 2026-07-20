import { Nav } from '@/components/Nav';
import Link from 'next/link';
import {
  IconLock, IconHammer, IconShatter, IconTrendingUp,
  IconEvolve, IconSparkle, IconArrowRight,
} from '@/components/Icons';

/* ──────────────────────────────────────────────
   Docs / Whitepaper page
   Explains EVO (protocol) and Meld (terminal)
   ────────────────────────────────────────────── */

const lifecycleTypes = [
  { name: 'Static', desc: 'Asset stays the same forever. Classic NFT behavior.', color: 'text-dim' },
  { name: 'Reveal', desc: 'Hidden at mint, revealed later by creator or community.', color: 'text-accent' },
  { name: 'Commit-Reveal', desc: 'Creator commits a hash before mint, reveals after. Prevents manipulation.', color: 'text-positive' },
  { name: 'Reveal & Evolve', desc: 'Reveals on trigger, then continues evolving through stages.', color: 'text-warn' },
  { name: 'Custom', desc: 'Authority-driven visual stages. Full manual control.', color: 'text-negative' },
];

const instructions = [
  { name: 'initialize_protocol', desc: 'One-time setup. Sets treasury, authority, and creation fee.' },
  { name: 'create_collection', desc: 'Deploys a new EVO collection with config + metadata.' },
  { name: 'forge', desc: 'Mints a new EVO inside a collection. Locks SOL.' },
  { name: 'feed', desc: 'Permissionless trigger that advances an EVO\'s lifecycle state.' },
  { name: 'evolve', desc: 'Advances visual state when lifecycle conditions are met.' },
  { name: 'reveal_collection', desc: 'Reveals hidden assets using committed secret.' },
  { name: 'commit_reveal', desc: 'Creator commits hash before mint to prove fairness.' },
  { name: 'list', desc: 'Lists an EVO on the built-in marketplace.' },
  { name: 'delist', desc: 'Removes a listing.' },
  { name: 'buy', desc: 'Purchases a listed EVO. SOL flows to seller, fee to treasury.' },
  { name: 'shatter', desc: 'Burns the EVO and reclaims locked SOL. Exit is always available.' },
  { name: 'transfer', desc: 'Sends an EVO to another wallet. Flat fee to treasury.' },
  { name: 'set_visual_stage', desc: 'Authority-only override for Custom lifecycle.' },
  { name: 'update_metadata', desc: 'Updates off-chain metadata URI.' },
  { name: 'update_treasury', desc: 'Rotates treasury address or authority.' },
  { name: 'close_collection', desc: 'Permanently closes a collection.' },
  { name: 'verify_merkle_proof', desc: 'Permissionless on-chain manifest verification.' },
];

const techSpecs = [
  ['Network', 'Solana mainnet'],
  ['Program ID', 'HGLPG19Vkg3nNS1VJfPqY8Wtu2Ets4oKMTxAZRDRe3Ei'],
  ['Framework', 'Anchor 0.31.0'],
  ['Instructions', '17'],
  ['Account types', '4 (Protocol, Collection, EVO, Listing)'],
  ['Lifecycle types', '5'],
  ['Randomness policies', '3 (None, Predetermined, BatchReveal)'],
  ['Max supply per collection', '20,000'],
  ['Collection creation fee', '0.0459 SOL'],
  ['Transfer fee', '0.009 SOL (flat, to treasury)'],
  ['Max shatter fee', '20% (2000 bps)'],
  ['Max royalty', '25% (2500 bps)'],
  ['Metadata URI schemes', 'http, https, ipfs, arweave'],
  ['Source code', 'github.com/stephenclawdbot-png/EVO'],
];

export default function DocsPage() {
  return (
    <div className="min-h-screen bg-bg text-text">
      <Nav />

      {/* ─── Hero ─── */}
      <section className="border-b border-border bg-surface">
        <div className="mx-auto max-w-4xl px-4 py-20 lg:py-28">
          <p className="text-[11px] uppercase tracking-[0.2em] text-dim">Documentation</p>
          <h1 className="mt-3 text-4xl font-bold tracking-tight text-text-strong sm:text-5xl">
            EVO Protocol
          </h1>
          <p className="mt-4 max-w-2xl text-lg text-muted">
            The on-chain primitive that turns SOL into assets that don&apos;t stay the same.
            Meld is the terminal where you use it.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a href="#what-is-evo" className="rounded border border-border-strong px-4 py-2 text-xs font-medium text-text transition-colors hover:bg-surface-2">What is EVO?</a>
            <a href="#what-is-meld" className="rounded border border-border-strong px-4 py-2 text-xs font-medium text-text transition-colors hover:bg-surface-2">What is Meld?</a>
            <a href="#how-it-works" className="rounded border border-border-strong px-4 py-2 text-xs font-medium text-text transition-colors hover:bg-surface-2">How it works</a>
            <a href="#architecture" className="rounded border border-border-strong px-4 py-2 text-xs font-medium text-text transition-colors hover:bg-surface-2">Architecture</a>
            <a href="#lifecycles" className="rounded border border-border-strong px-4 py-2 text-xs font-medium text-text transition-colors hover:bg-surface-2">Lifecycles</a>
            <a href="#instructions" className="rounded border border-border-strong px-4 py-2 text-xs font-medium text-text transition-colors hover:bg-surface-2">Instructions</a>
          </div>
        </div>
      </section>

      {/* ─── What is EVO ─── */}
      <section id="what-is-evo" className="border-b border-border">
        <div className="mx-auto max-w-4xl px-4 py-16">
          <h2 className="text-2xl font-semibold tracking-tight text-text-strong">What is EVO?</h2>
          <div className="mt-6 space-y-4 text-sm leading-relaxed text-muted">
            <p>
              EVO is an <span className="text-text-strong">on-chain asset primitive</span> on Solana.
              It is not an NFT in the traditional sense. Every EVO locks real SOL inside a
              program-derived address (PDA). That locked SOL gives each asset a provable floor value
              that cannot go to zero.
            </p>
            <p>
              Unlike a static NFT — which is a frozen image with a market price — an EVO is
              <span className="text-text-strong"> alive</span>. It has lifecycle states. It can
              reveal, evolve, and change over time based on on-chain triggers. The protocol itself
              is the source of truth for what the asset looks like at any given moment.
            </p>
            <p>
              You can trade EVOs on the built-in marketplace. You can shatter them to reclaim the
              locked SOL. You can feed them to advance their state. The exit is always built in.
            </p>
          </div>

          {/* ── Visual: NFT vs EVO comparison ── */}
          <div className="mt-10 grid gap-4 sm:grid-cols-2">
            <div className="rounded-lg border border-border bg-surface p-6">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-dim">Traditional NFT</h3>
              <div className="mt-4 flex flex-col items-center gap-2">
                <div className="flex h-28 w-28 items-center justify-center rounded-lg border-2 border-dashed border-border-strong bg-surface-2">
                  <span className="text-xs font-mono text-dim">IMG</span>
                </div>
                <div className="text-center text-xs text-muted">
                  <p className="font-mono text-text-strong">image file</p>
                  <p className="mt-1">stored on IPFS</p>
                  <p className="mt-1">price = whatever someone pays</p>
                  <p className="mt-1 text-negative">floor = 0 (can go to nothing)</p>
                </div>
              </div>
            </div>
            <div className="rounded-lg border border-accent/30 bg-accent-soft p-6">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-accent">EVO Asset</h3>
              <div className="mt-4 flex flex-col items-center gap-2">
                <div className="flex h-28 w-28 items-center justify-center rounded-lg border-2 border-accent bg-surface">
                  <div className="flex flex-col items-center">
                    <IconLock className="h-8 w-8 text-accent" />
                    <span className="mt-1 text-[10px] font-mono text-accent">SOL locked</span>
                  </div>
                </div>
                <div className="text-center text-xs text-muted">
                  <p className="font-mono text-text-strong">SOL inside PDA</p>
                  <p className="mt-1">visual state on-chain</p>
                  <p className="mt-1">price = market + floor</p>
                  <p className="mt-1 text-positive">floor = locked SOL (can&apos;t go to zero)</p>
                </div>
              </div>
            </div>
          </div>

          {/* ── Gambling vs EVO ── */}
          <div className="mt-10 rounded-lg border border-border bg-surface p-6">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-dim">
              Gambling vs EVO
            </h3>
            <p className="mt-2 text-xs text-muted">
              Both involve risk and SOL. The difference is what you walk away with.
            </p>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[480px] text-left text-xs">
                <thead>
                  <tr className="border-b border-border text-dim">
                    <th className="py-2 pr-4 font-semibold">Aspect</th>
                    <th className="py-2 pr-4 font-semibold text-negative">Gambling</th>
                    <th className="py-2 pr-4 font-semibold text-accent">EVO</th>
                  </tr>
                </thead>
                <tbody className="text-muted">
                  <tr className="border-b border-border/50">
                    <td className="py-2 pr-4 font-mono text-text-strong">Your SOL</td>
                    <td className="py-2 pr-4">Gone the moment you bet. Win or lose, the house keeps it.</td>
                    <td className="py-2 pr-4">Locked in a PDA you control. Shatter to reclaim it.</td>
                  </tr>
                  <tr className="border-b border-border/50">
                    <td className="py-2 pr-4 font-mono text-text-strong">Floor value</td>
                    <td className="py-2 pr-4 text-negative">Zero. You can lose everything.</td>
                    <td className="py-2 pr-4 text-positive">Locked SOL minus max 20% shatter fee.</td>
                  </tr>
                  <tr className="border-b border-border/50">
                    <td className="py-2 pr-4 font-mono text-text-strong">Exit</td>
                    <td className="py-2 pr-4">Only if you win. Loser gets nothing.</td>
                    <td className="py-2 pr-4 text-positive">Always available via shatter.</td>
                  </tr>
                  <tr className="border-b border-border/50">
                    <td className="py-2 pr-4 font-mono text-text-strong">House edge</td>
                    <td className="py-2 pr-4">Built into the odds. You lose long-term.</td>
                    <td className="py-2 pr-4">No house. Fee is a protocol surcharge, not an odds advantage.</td>
                  </tr>
                  <tr className="border-b border-border/50">
                    <td className="py-2 pr-4 font-mono text-text-strong">Ownership</td>
                    <td className="py-2 pr-4">Nothing. You bet, you watch, you leave.</td>
                    <td className="py-2 pr-4">You hold a tradeable, evolving on-chain asset.</td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-4 font-mono text-text-strong">Upside</td>
                    <td className="py-2 pr-4">Fixed payout if you win. Nothing if you lose.</td>
                    <td className="py-2 pr-4">Market price + locked floor. Asset can appreciate and you still keep the floor.</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="mt-4 text-xs leading-relaxed text-muted">
              <span className="text-text-strong">The key insight:</span> gambling is a binary bet
              with a house that always wins. EVO is an asset you own with a guaranteed exit.
              The locked SOL is your money, not a wager. The market premium is upside, not a jackpot.
              You can lose the premium, but you never lose the floor.
            </p>
          </div>

          {/* ── NFT vs Meme Tokens ── */}
          <div className="mt-6 rounded-lg border border-border bg-surface p-6">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-dim">
              NFT vs Meme Tokens vs EVO
            </h3>
            <p className="mt-2 text-xs text-muted">
              Where EVO sits between the two most common Solana asset types.
            </p>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[560px] text-left text-xs">
                <thead>
                  <tr className="border-b border-border text-dim">
                    <th className="py-2 pr-4 font-semibold">Property</th>
                    <th className="py-2 pr-4 font-semibold text-warn">NFT</th>
                    <th className="py-2 pr-4 font-semibold text-negative">Meme Token</th>
                    <th className="py-2 pr-4 font-semibold text-accent">EVO</th>
                  </tr>
                </thead>
                <tbody className="text-muted">
                  <tr className="border-b border-border/50">
                    <td className="py-2 pr-4 font-mono text-text-strong">Backed by</td>
                    <td className="py-2 pr-4">JPEG on IPFS (no SOL)</td>
                    <td className="py-2 pr-4">Liquidity pool (can drain)</td>
                    <td className="py-2 pr-4 text-accent">SOL locked in PDA</td>
                  </tr>
                  <tr className="border-b border-border/50">
                    <td className="py-2 pr-4 font-mono text-text-strong">Floor price</td>
                    <td className="py-2 pr-4 text-negative">Can go to zero</td>
                    <td className="py-2 pr-4 text-negative">Can go to zero</td>
                    <td className="py-2 pr-4 text-positive">Locked SOL (never zero)</td>
                  </tr>
                  <tr className="border-b border-border/50">
                    <td className="py-2 pr-4 font-mono text-text-strong">Fungibility</td>
                    <td className="py-2 pr-4">Non-fungible (1 of 1 or set)</td>
                    <td className="py-2 pr-4">Fully fungible (1 token = 1 token)</td>
                    <td className="py-2 pr-4">Non-fungible, but shatters into SOL</td>
                  </tr>
                  <tr className="border-b border-border/50">
                    <td className="py-2 pr-4 font-mono text-text-strong">State</td>
                    <td className="py-2 pr-4">Static (image never changes)</td>
                    <td className="py-2 pr-4">Static (token has no visual)</td>
                    <td className="py-2 pr-4 text-accent">Evolving (visual state on-chain)</td>
                  </tr>
                  <tr className="border-b border-border/50">
                    <td className="py-2 pr-4 font-mono text-text-strong">Exit</td>
                    <td className="py-2 pr-4">Sell on marketplace (if buyer exists)</td>
                    <td className="py-2 pr-4">Sell into LP (if liquidity exists)</td>
                    <td className="py-2 pr-4 text-positive">Shatter (always works, reclaim SOL)</td>
                  </tr>
                  <tr className="border-b border-border/50">
                    <td className="py-2 pr-4 font-mono text-text-strong">Rug risk</td>
                    <td className="py-2 pr-4 text-negative">Creator can abandon, floor crashes</td>
                    <td className="py-2 pr-4 text-negative">Devs can pull LP, token dies</td>
                    <td className="py-2 pr-4 text-positive">No rug. SOL is in the PDA, not the creator&apos;s wallet</td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-4 font-mono text-text-strong">Speculation</td>
                    <td className="py-2 pr-4">Hype + scarcity driven</td>
                    <td className="py-2 pr-4">Viral + LP depth driven</td>
                    <td className="py-2 pr-4 text-accent">Market premium + locked floor. Speculate on top, not against the floor.</td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-4 font-mono text-text-strong">Strength</td>
                    <td className="py-2 pr-4 text-positive">Deep marketplaces, strong culture</td>
                    <td className="py-2 pr-4 text-positive">Instant liquidity, viral reach</td>
                    <td className="py-2 pr-4 text-positive">Guaranteed floor, evolving state</td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-4 font-mono text-text-strong">Weakness</td>
                    <td className="py-2 pr-4 text-negative">Floor can go to zero</td>
                    <td className="py-2 pr-4 text-negative">LP can be pulled</td>
                    <td className="py-2 pr-4 text-dim">Max 20% shatter fee, newer ecosystem</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="mt-4 text-xs leading-relaxed text-muted">
              <span className="text-text-strong">NFTs</span> built culture and community on art and
              scarcity — they proved people will pay for digital ownership. <span className="text-text-strong">
              Meme tokens</span> proved liquidity and virality can move real money at speed. Both have
              real value drivers and real risks. <span className="text-text-strong">EVO</span> takes the
              non-fungible ownership of NFTs, the liquidity option of tokens, and adds a guaranteed
              floor backed by locked SOL. It is not better at everything — NFTs have deeper marketplaces
              and meme tokens have stronger liquidity. EVO is a different tradeoff: you give up some
              ecosystem maturity for a floor that cannot go to zero.
            </p>
          </div>
        </div>
      </section>

      {/* ─── What is Meld ─── */}
      <section id="what-is-meld" className="border-b border-border bg-surface">
        <div className="mx-auto max-w-4xl px-4 py-16">
          <h2 className="text-2xl font-semibold tracking-tight text-text-strong">What is Meld?</h2>
          <div className="mt-6 space-y-4 text-sm leading-relaxed text-muted">
            <p>
              Meld is the <span className="text-text-strong">terminal</span> — the consumer-facing
              product built on top of EVO. Think of it like Magic Eden is to NFTs, or Pump.fun is to
              memecoins. Meld is where you create collections, forge assets, browse the marketplace,
              and manage your portfolio.
            </p>
            <p>
              <span className="text-text-strong">EVO</span> is the protocol — the on-chain rules,
              account structures, and instructions that define what an asset is and how it behaves.
              <span className="text-text-strong"> Meld</span> is the interface — the website, the
              wallet connection, the UX that makes it usable.
            </p>
          </div>

          {/* ── Visual: EVO <-> Meld relationship ── */}
          <div className="mt-10 rounded-lg border border-border bg-bg p-8">
            <div className="flex flex-col items-center gap-6 sm:flex-row sm:justify-center sm:gap-10">
              <div className="flex flex-col items-center">
                <div className="flex h-24 w-24 items-center justify-center rounded-xl border border-accent bg-accent-soft">
                  <span className="text-2xl font-bold text-accent">M</span>
                </div>
                <p className="mt-2 text-xs font-semibold text-text-strong">Meld</p>
                <p className="text-[10px] text-dim">the terminal / product</p>
              </div>

              <div className="flex flex-col items-center">
                <div className="flex flex-col items-center text-dim">
                  <div className="h-px w-12 bg-border-strong sm:w-20" />
                  <span className="my-1 text-[10px] uppercase tracking-wider">talks to</span>
                  <div className="h-px w-12 bg-border-strong sm:w-20" />
                </div>
              </div>

              <div className="flex flex-col items-center">
                <div className="flex h-24 w-24 items-center justify-center rounded-xl border border-border-strong bg-surface-2">
                  <span className="text-2xl font-bold text-text-strong">E</span>
                </div>
                <p className="mt-2 text-xs font-semibold text-text-strong">EVO</p>
                <p className="text-[10px] text-dim">the protocol / primitive</p>
              </div>
            </div>

            <div className="mt-6 grid gap-3 text-xs sm:grid-cols-2">
              <div className="rounded border border-border p-3">
                <p className="font-semibold text-accent">Meld handles</p>
                <ul className="mt-2 space-y-1 text-muted">
                  <li>- Wallet connection (Phantom, Solflare)</li>
                  <li>- Create / forge / trade UI</li>
                  <li>- Collection browsing &amp; search</li>
                  <li>- Portfolio &amp; admin views</li>
                  <li>- Visual rendering of on-chain state</li>
                </ul>
              </div>
              <div className="rounded border border-border p-3">
                <p className="font-semibold text-text-strong">EVO handles</p>
                <ul className="mt-2 space-y-1 text-muted">
                  <li>- SOL locking &amp; floor value</li>
                  <li>- Lifecycle state machine</li>
                  <li>- Marketplace escrow &amp; settlement</li>
                  <li>- Shatter (burn, reclaim SOL)</li>
                  <li>- Manifest verification (Merkle)</li>
                </ul>
              </div>
            </div>
          </div>

          <p className="mt-6 text-sm leading-relaxed text-muted">
            The tagline says it all: <span className="text-text-strong">&ldquo;Assets that
            don&apos;t stay the same.&rdquo;</span> That is the promise of EVO, delivered through
            Meld.
          </p>
        </div>
      </section>

      {/* ─── How it works ─── */}
      <section id="how-it-works" className="border-b border-border">
        <div className="mx-auto max-w-4xl px-4 py-16">
          <h2 className="text-2xl font-semibold tracking-tight text-text-strong">How it works</h2>
          <p className="mt-3 text-sm text-muted">
            From zero to a living asset in six steps.
          </p>
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            {[
              {
                icon: IconHammer,
                title: '1. Create a collection',
                body: 'A creator calls create_collection, paying the protocol fee. This defines the lifecycle type, randomness policy, metadata, and supply ceiling.',
              },
              {
                icon: IconLock,
                title: '2. Forge an EVO',
                body: 'Users forge (mint) EVOs from the collection. Each forge locks SOL inside a PDA. That SOL is the floor value — it belongs to whoever holds the EVO.',
              },
              {
                icon: IconEvolve,
                title: '3. It evolves',
                body: 'Depending on the lifecycle type, the EVO can reveal, evolve through stages, or change visually. Triggers are on-chain and permissionless where possible.',
              },
              {
                icon: IconTrendingUp,
                title: '4. Trade it',
                body: 'List on the built-in marketplace. Buyers pay the listing price. The protocol handles escrow, fees, and ownership transfer atomically.',
              },
              {
                icon: IconShatter,
                title: '5. Shatter for value',
                body: 'Don\'t want to sell? Shatter the EVO. It gets burned and the locked SOL is returned to you. The exit is always one transaction away.',
              },
              {
                icon: IconSparkle,
                title: '6. Verify everything',
                body: 'Manifests are Merkle-verified on-chain. Metadata URIs are stored on IPFS/Arweave. The protocol is the source of truth — not a centralized server.',
              },
            ].map((step) => (
              <div key={step.title} className="rounded-lg border border-border bg-surface p-5">
                <div className="flex items-center gap-3">
                  <step.icon className="h-5 w-5 text-accent" />
                  <h3 className="text-sm font-semibold text-text-strong">{step.title}</h3>
                </div>
                <p className="mt-2 text-xs leading-relaxed text-muted">{step.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Architecture diagram ─── */}
      <section id="architecture" className="border-b border-border bg-surface">
        <div className="mx-auto max-w-4xl px-4 py-16">
          <h2 className="text-2xl font-semibold tracking-tight text-text-strong">Architecture</h2>
          <p className="mt-3 text-sm text-muted">
            How the pieces fit together — from your browser to the Solana blockchain.
          </p>

          {/* ── Flow diagram ── */}
          <div className="mt-10 rounded-lg border border-border bg-bg p-6 sm:p-10">
            {/* Layer 1: User */}
            <div className="flex flex-col items-center">
              <div className="rounded-lg border border-border-strong bg-surface-2 px-6 py-4 text-center">
                <p className="text-xs font-semibold text-text-strong">You (browser + wallet)</p>
                <p className="mt-1 text-[10px] text-dim">Phantom / Solflare signs transactions</p>
              </div>
              <div className="my-2 flex flex-col items-center text-dim">
                <div className="h-6 w-px bg-border-strong" />
                <span className="text-[10px]">/\</span>
                <div className="h-6 w-px bg-border-strong" />
              </div>
            </div>

            {/* Layer 2: Meld frontend */}
            <div className="flex flex-col items-center">
              <div className="rounded-lg border border-accent/40 bg-accent-soft px-6 py-4 text-center">
                <p className="text-xs font-semibold text-accent">Meld Terminal (frontend)</p>
                <p className="mt-1 text-[10px] text-dim">Next.js | wallet adapter | RPC calls</p>
                <p className="text-[10px] text-dim">meldterminal.io</p>
              </div>
              <div className="my-2 flex flex-col items-center text-dim">
                <div className="h-6 w-px bg-border-strong" />
                <span className="text-[10px]">sends tx via</span>
                <div className="h-6 w-px bg-border-strong" />
              </div>
            </div>

            {/* Layer 3: Solana RPC */}
            <div className="flex flex-col items-center">
              <div className="rounded-lg border border-border-strong bg-surface-2 px-6 py-4 text-center">
                <p className="text-xs font-semibold text-text-strong">Solana RPC (Helius)</p>
                <p className="mt-1 text-[10px] text-dim">routes transactions to validators</p>
              </div>
              <div className="my-2 flex flex-col items-center text-dim">
                <div className="h-6 w-px bg-border-strong" />
                <span className="text-[10px]">executes on</span>
                <div className="h-6 w-px bg-border-strong" />
              </div>
            </div>

            {/* Layer 4: EVO Program */}
            <div className="flex flex-col items-center">
              <div className="rounded-lg border-2 border-text-strong bg-surface px-8 py-5 text-center">
                <p className="text-sm font-bold text-text-strong">EVO Program</p>
                <p className="mt-1 text-[10px] text-dim font-mono">HGLPG19Vkg3nNS1VJfPqY8Wtu2Ets4oKMTxAZRDRe3Ei</p>
                <p className="mt-1 text-[10px] text-dim">17 instructions | Anchor framework</p>
              </div>
              <div className="my-2 flex flex-col items-center text-dim">
                <div className="h-6 w-px bg-border-strong" />
                <span className="text-[10px]">manages</span>
                <div className="h-6 w-px bg-border-strong" />
              </div>
            </div>

            {/* Layer 5: On-chain accounts */}
            <div className="grid gap-3 sm:grid-cols-4">
              {[
                { name: 'Protocol Config', desc: 'treasury / fee / authority', icon: 'CFG' },
                { name: 'Collection', desc: 'config / lifecycle / supply', icon: 'COL' },
                { name: 'EVO Account', desc: 'owner / locked SOL / state', icon: 'EVO' },
                { name: 'Listing', desc: 'seller / price / EVO ref', icon: 'LST' },
              ].map((acct) => (
                <div key={acct.name} className="rounded border border-border bg-surface-2 p-3 text-center">
                  <div className="text-lg">{acct.icon}</div>
                  <p className="mt-1 text-[10px] font-semibold text-text-strong">{acct.name}</p>
                  <p className="text-[9px] text-dim">{acct.desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* ── SOL flow diagram ── */}
          <div className="mt-10">
            <h3 className="text-sm font-semibold text-text-strong">Where the SOL goes</h3>
            <p className="mt-2 text-xs text-muted">Every action that moves SOL, and where it ends up.</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <div className="rounded-lg border border-border bg-bg p-4">
                <p className="text-xs font-semibold text-text-strong">Forge (mint)</p>
                <div className="mt-3 space-y-1 text-[10px] text-muted">
                  <p>{'->'} SOL locked in <span className="font-mono text-accent">EVO PDA</span></p>
                  <p className="text-dim">This is the floor value. Belongs to holder.</p>
                </div>
              </div>
              <div className="rounded-lg border border-border bg-bg p-4">
                <p className="text-xs font-semibold text-text-strong">Buy (marketplace)</p>
                <div className="mt-3 space-y-1 text-[10px] text-muted">
                  <p>{'->'} SOL to <span className="font-mono text-positive">seller</span></p>
                  <p>{'->'} Royalty to <span className="font-mono text-warn">creator</span></p>
                  <p>{'->'} Locked SOL stays in <span className="font-mono text-accent">PDA</span></p>
                </div>
              </div>
              <div className="rounded-lg border border-border bg-bg p-4">
                <p className="text-xs font-semibold text-text-strong">Shatter (exit)</p>
                <div className="mt-3 space-y-1 text-[10px] text-muted">
                  <p>{'->'} Locked SOL to <span className="font-mono text-positive">holder</span></p>
                  <p>{'->'} Shatter fee to <span className="font-mono text-warn">collection</span></p>
                  <p>{'->'} EVO burned. Account closed.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Lifecycle types ─── */}
      <section id="lifecycles" className="border-b border-border">
        <div className="mx-auto max-w-4xl px-4 py-16">
          <h2 className="text-2xl font-semibold tracking-tight text-text-strong">Lifecycle types</h2>
          <p className="mt-3 text-sm text-muted">
            Every collection declares a lifecycle type at creation. This determines how assets
            change over time.
          </p>

          {/* ── Visual: lifecycle timeline ── */}
          <div className="mt-8 rounded-lg border border-border bg-surface p-6">
            <p className="text-[10px] uppercase tracking-wider text-dim">Visual state over time</p>
            <div className="mt-4 flex items-center gap-1 overflow-x-auto pb-2">
              {['Stage 0', 'Stage 1', 'Stage 2', 'Stage 3'].map((stage, i) => (
                <div key={stage} className="flex items-center gap-1">
                  <div className="flex flex-col items-center">
                    <div className={`flex h-10 w-10 items-center justify-center rounded-full border-2 ${i === 0 ? 'border-dim bg-surface-2' : 'border-accent bg-accent-soft'}`}>
                      <span className={`text-[10px] font-mono ${i === 0 ? 'text-dim' : 'text-accent'}`}>{i}</span>
                    </div>
                    <span className="mt-1 text-[9px] text-dim">{stage}</span>
                  </div>
                  {i < 3 && <div className={`h-px w-6 ${i < 2 ? 'bg-accent' : 'bg-border-strong'}`} />}
                </div>
              ))}
              <div className="ml-3 flex items-center gap-2">
                <span className="text-[10px] text-muted">=</span>
                <div className="flex flex-col items-center">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-negative bg-negative-soft">
                    <IconShatter className="h-4 w-4 text-negative" />
                  </div>
                  <span className="mt-1 text-[9px] text-dim">Shatter</span>
                </div>
              </div>
            </div>
            <p className="mt-3 text-[10px] text-muted">
              Each stage transition is an on-chain instruction. The protocol records the current
              state — no off-chain server can override it.
            </p>
          </div>

          <div className="mt-6 overflow-hidden rounded-lg border border-border">
            <table className="w-full text-xs">
              <thead className="bg-surface-2 text-dim">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">Type</th>
                  <th className="px-4 py-3 text-left font-medium">Behavior</th>
                </tr>
              </thead>
              <tbody>
                {lifecycleTypes.map((lt) => (
                  <tr key={lt.name} className="border-t border-border">
                    <td className={`px-4 py-3 font-mono font-semibold ${lt.color}`}>{lt.name}</td>
                    <td className="px-4 py-3 text-muted">{lt.desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ─── Instructions ─── */}
      <section id="instructions" className="border-b border-border bg-surface">
        <div className="mx-auto max-w-4xl px-4 py-16">
          <h2 className="text-2xl font-semibold tracking-tight text-text-strong">Protocol instructions</h2>
          <p className="mt-3 text-sm text-muted">
            The EVO program exposes 17 instructions. All are on-chain, composable, and verifiable.
          </p>
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            {instructions.map((inst) => (
              <div key={inst.name} className="rounded-lg border border-border bg-bg p-4">
                <h3 className="font-mono text-xs font-semibold text-accent">{inst.name}</h3>
                <p className="mt-1.5 text-xs leading-relaxed text-muted">{inst.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Key properties ─── */}
      <section className="border-b border-border">
        <div className="mx-auto max-w-4xl px-4 py-16">
          <h2 className="text-2xl font-semibold tracking-tight text-text-strong">Key properties</h2>
          <div className="mt-6 space-y-4">
            {[
              { title: 'SOL-backed floor', body: 'Every EVO locks SOL in a PDA. The floor is not a market opinion — it is a provable on-chain balance.' },
              { title: 'Permissionless triggers', body: 'Feed, reveal, and verify instructions can be called by anyone. No centralized oracle or admin key needed.' },
              { title: 'Commit-reveal fairness', body: 'Creators commit a hash before minting. The secret is revealed after. This prevents supply manipulation.' },
              { title: 'Built-in exit', body: 'Shatter burns the EVO and returns locked SOL. You are never trapped holding something you cannot exit.' },
              { title: 'On-chain source of truth', body: 'The protocol tracks visual state, lifecycle stage, and manifest verification. No off-chain server can override it.' },
              { title: 'Open source', body: 'The entire program is public on GitHub. Security reviews, test coverage, and documentation are all open.' },
            ].map((prop) => (
              <div key={prop.title} className="flex gap-3">
                <div className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                <div>
                  <h3 className="text-sm font-semibold text-text-strong">{prop.title}</h3>
                  <p className="mt-1 text-xs leading-relaxed text-muted">{prop.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Technical details ─── */}
      <section className="border-b border-border bg-surface">
        <div className="mx-auto max-w-4xl px-4 py-16">
          <h2 className="text-2xl font-semibold tracking-tight text-text-strong">Technical details</h2>
          <div className="mt-6 overflow-hidden rounded-lg border border-border">
            <table className="w-full text-xs">
              <tbody>
                {techSpecs.map(([key, val], i) => (
                  <tr key={key} className={i > 0 ? 'border-t border-border' : ''}>
                    <td className="px-4 py-3 font-medium text-text-strong">{key}</td>
                    <td className="px-4 py-3 font-mono text-muted">{val}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ─── CTA ─── */}
      <section className="border-b border-border bg-surface">
        <div className="mx-auto max-w-3xl px-4 py-20 text-center lg:py-28">
          <p className="text-[11px] uppercase tracking-[0.2em] text-dim">Ready?</p>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight text-text-strong sm:text-3xl">
            Start creating assets that don&apos;t stay the same.
          </h2>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
            <Link href="/create"
              className="inline-flex items-center gap-2 rounded bg-accent px-8 py-3 text-sm font-semibold text-[#0a0a0c] transition-colors hover:bg-accent-hover">
              Create a collection <IconArrowRight className="h-4 w-4" />
            </Link>
            <Link href="/degens"
              className="inline-flex items-center gap-2 rounded border border-border-strong px-8 py-3 text-sm font-semibold text-text transition-colors hover:bg-surface-2">
              Degen guide
            </Link>
          </div>
        </div>
      </section>

      {/* ─── Footer ─── */}
      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2 px-3 py-3 text-[11px] text-dim lg:px-4">
          <span>Meld — EVO Protocol — Assets that don&apos;t stay the same.</span>
          <div className="flex items-center gap-4">
            <Link href="/" className="transition-colors hover:text-text">Back to app</Link>
            <Link href="/degens" className="transition-colors hover:text-text">Degen Guide</Link>
            <a href="https://github.com/stephenclawdbot-png/EVO" target="_blank" rel="noopener noreferrer" className="transition-colors hover:text-text">GitHub</a>
            <a href="https://solscan.io/account/HGLPG19Vkg3nNS1VJfPqY8Wtu2Ets4oKMTxAZRDRe3Ei" target="_blank" rel="noopener noreferrer" className="transition-colors hover:text-text">Program</a>
            <span>Powered by <a href="https://www.helius.dev/" target="_blank" rel="noopener noreferrer" className="transition-colors hover:text-text">Helius</a> | <a href="https://supabase.com/" target="_blank" rel="noopener noreferrer" className="transition-colors hover:text-text">Supabase</a> | <a href="https://solana.com/" target="_blank" rel="noopener noreferrer" className="transition-colors hover:text-text">Solana</a></span>
          </div>
        </div>
      </footer>
    </div>
  );
}