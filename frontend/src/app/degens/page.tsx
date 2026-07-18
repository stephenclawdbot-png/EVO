import { Nav } from '@/components/Nav';
import Link from 'next/link';

const gamblingPoints = [
  { emoji: '🎲', text: 'You lose → money gone. Poof. Nothing to show.' },
  { emoji: '💸', text: 'House always wins. Negative EV by design.' },
  { emoji: '👻', text: 'Zero transparency. Trust me bro.' },
  { emoji: '🕳️', text: 'No exit liquidity. You lose, you leave empty-handed.' },
  { emoji: '🤡', text: 'RNG black box. Was it fair? Who knows.' },
];

const evoPoints = [
  { emoji: '🔒', title: 'SOL-BACKED FLOOR', text: 'Every EVO locks real SOL inside a PDA. You always own the locked value. It can never go to zero.' },
  { emoji: '🧬', title: 'IT EVOLVES', text: 'Your asset changes over time through on-chain feeds. It is alive, not a static dice roll.' },
  { emoji: '💸', title: 'TRADE IT', text: 'List it, buy it, flip it. Markets create price discovery above the floor. You set the price.' },
  { emoji: '🔨', title: 'SHATTER FOR VALUE', text: 'Don\'t want to sell? Shatter it and reclaim the locked SOL. The exit is built in.' },
  { emoji: '📜', title: '100% ON-CHAIN', text: 'Every lock, evolution, transfer, and shatter is a Solana transaction. Verify it yourself.' },
  { emoji: '⚖️', title: 'NOT ZERO-SUM', text: 'The floor is guaranteed by code. Speculation adds upside. You are never left with nothing.' },
];

const comparison = [
  { label: 'Money goes where?', gamble: 'House pocket 💀', evo: 'Locked in PDA 🔒' },
  { label: 'Asset you own?', gamble: 'Nothing 🚫', evo: 'Evolving on-chain asset 🧬' },
  { label: 'Worst case?', gamble: 'Total loss 🔴', evo: 'Reclaim locked SOL 🟢' },
  { label: 'Transparent?', gamble: 'No 🤡', evo: 'Every tx on-chain 📜' },
  { label: 'Exit liquidity?', gamble: 'Hope you cashed out 🙏', evo: 'Shatter or sell anytime 🔨' },
  { label: 'House edge?', gamble: 'Built in, always against you 📉', evo: 'No house. 0.009 fee on transfers only ⚖️' },
];

const steps = [
  { n: '1', title: 'Lock SOL', desc: 'Send SOL into the EVO program. It is locked inside a PDA — a smart contract wallet nobody can raid.', icon: '🔒' },
  { n: '2', title: 'Get an EVO', desc: 'You receive a unique evolving on-chain asset. It has a floor value equal to the locked SOL.', icon: '🧬' },
  { n: '3', title: 'It Evolves', desc: 'On-chain feeds trigger evolution. Your asset changes. The story writes itself on-chain.', icon: '✨' },
  { n: '4', title: 'Trade or Shatter', desc: 'List it for sale at any price above floor. Or shatter it to reclaim the locked SOL. Your call.', icon: '🔨' },
];

export default function DegensPage() {
  return (
    <div className="min-h-screen bg-black text-white overflow-x-hidden">
      <Nav />

      {/* Hero */}
      <section className="relative flex flex-col items-center justify-center text-center px-4 pt-24 pb-16">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_rgba(168,85,247,0.15),_transparent_70%)] pointer-events-none" />
        <div className="relative z-10 max-w-3xl">
          <span className="inline-block mb-4 px-4 py-1.5 rounded-full bg-purple-500/20 border border-purple-500/40 text-purple-300 text-sm font-bold tracking-wider uppercase">
            Not a Casino
          </span>
          <h1 className="text-5xl sm:text-7xl font-black leading-tight bg-gradient-to-r from-purple-400 via-pink-400 to-yellow-400 bg-clip-text text-transparent">
            EVO FOR DEGENS
          </h1>
          <p className="mt-6 text-xl sm:text-2xl text-gray-300 font-bold">
            You lock SOL. You get an evolving on-chain asset. You own it.
          </p>
          <p className="mt-3 text-lg text-gray-400">
            Not a bet. Not a spin. A <span className="text-pink-400 font-bold">backed primitive</span> with a floor and an exit.
          </p>
          <div className="mt-8 flex gap-4 justify-center flex-wrap">
            <Link
              href="/"
              className="px-8 py-3 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold text-lg hover:scale-105 transition-transform shadow-lg shadow-purple-500/30"
            >
              🔥 Explore EVOs
            </Link>
            <Link
              href="/create"
              className="px-8 py-3 rounded-xl border-2 border-purple-500/50 text-purple-300 font-bold text-lg hover:bg-purple-500/10 transition-colors"
            >
              ⚒️ Forge One
            </Link>
          </div>
        </div>
      </section>

      {/* The Problem: Gambling */}
      <section className="px-4 py-16 max-w-4xl mx-auto">
        <h2 className="text-3xl sm:text-4xl font-black text-center mb-2 text-red-400">
          💀 Pure Gambling Sucks
        </h2>
        <p className="text-center text-gray-400 mb-10">Here is what happens when you roll the dice:</p>
        <div className="grid sm:grid-cols-2 gap-4">
          {gamblingPoints.map((p, i) => (
            <div key={i} className="flex items-start gap-3 p-4 rounded-xl bg-red-950/30 border border-red-900/40">
              <span className="text-2xl shrink-0">{p.emoji}</span>
              <span className="text-gray-300 font-medium">{p.text}</span>
            </div>
          ))}
        </div>
      </section>

      {/* The Solution: EVO */}
      <section className="px-4 py-16 max-w-5xl mx-auto">
        <h2 className="text-3xl sm:text-4xl font-black text-center mb-2 bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
          🧬 EVO Is Different
        </h2>
        <p className="text-center text-gray-400 mb-10">You are not betting. You are minting a backed asset:</p>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {evoPoints.map((p, i) => (
            <div key={i} className="p-5 rounded-2xl bg-gradient-to-b from-purple-950/40 to-black border border-purple-800/30 hover:border-purple-600/50 transition-colors">
              <span className="text-3xl block mb-2">{p.emoji}</span>
              <h3 className="font-black text-purple-300 text-sm tracking-wider mb-1">{p.title}</h3>
              <p className="text-gray-400 text-sm leading-relaxed">{p.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Comparison Table */}
      <section className="px-4 py-16 max-w-3xl mx-auto">
        <h2 className="text-3xl sm:text-4xl font-black text-center mb-10 text-white">⚡ Head-to-Head</h2>
        <div className="overflow-hidden rounded-2xl border border-gray-800">
          <div className="grid grid-cols-3 gap-px bg-gray-800">
            <div className="bg-black p-4 font-black text-gray-500 text-sm">&nbsp;</div>
            <div className="bg-red-950/40 p-4 font-black text-red-400 text-sm text-center">🎰 GAMBLING</div>
            <div className="bg-purple-950/40 p-4 font-black text-purple-300 text-sm text-center">🧬 EVO</div>
          </div>
          {comparison.map((row, i) => (
            <div key={i} className="grid grid-cols-3 gap-px bg-gray-800">
              <div className="bg-black p-3 text-gray-400 text-xs font-bold uppercase tracking-wide">{row.label}</div>
              <div className="bg-black p-3 text-red-300/70 text-sm text-center">{row.gamble}</div>
              <div className="bg-black p-3 text-purple-200 text-sm text-center font-medium">{row.evo}</div>
            </div>
          ))}
        </div>
      </section>

      {/* How It Works */}
      <section className="px-4 py-16 max-w-3xl mx-auto">
        <h2 className="text-3xl sm:text-4xl font-black text-center mb-10 text-white">🔥 How It Works</h2>
        <div className="space-y-4">
          {steps.map((step) => (
            <div key={step.n} className="flex items-start gap-4 p-5 rounded-2xl bg-gradient-to-r from-purple-950/30 to-transparent border border-purple-900/30">
              <div className="shrink-0 w-12 h-12 rounded-full bg-purple-600/20 border border-purple-500/40 flex items-center justify-center text-2xl">
                {step.icon}
              </div>
              <div>
                <h3 className="font-black text-lg text-purple-300">
                  <span className="text-purple-500 mr-2">{step.n}.</span>{step.title}
                </h3>
                <p className="text-gray-400 text-sm mt-1 leading-relaxed">{step.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Bottom Line */}
      <section className="px-4 py-20 max-w-3xl mx-auto text-center">
        <div className="p-8 rounded-3xl bg-gradient-to-br from-purple-900/30 to-pink-900/20 border border-purple-700/30">
          <h2 className="text-3xl sm:text-4xl font-black mb-4">
            <span className="text-gray-500">Gambling: </span>
            <span className="text-red-400">lose everything</span>
            <span className="text-gray-600"> → </span>
            <span className="text-gray-500">EVO: </span>
            <span className="bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">own something</span>
          </h2>
          <p className="text-gray-400 text-lg">
            One gives you a dice roll. The other gives you a backed asset you control.
            <br />
            <span className="text-purple-300 font-bold">That is the difference.</span>
          </p>
          <Link
            href="/"
            className="inline-block mt-8 px-10 py-4 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 text-white font-black text-xl hover:scale-105 transition-transform shadow-lg shadow-purple-500/30"
          >
            🚀 GET STARTED
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="px-4 py-8 text-center text-gray-600 text-sm border-t border-gray-900">
        <p>EVO Protocol — SOL locked. Assets evolved. Not financial advice, just better than a slot machine.</p>
        <p className="mt-2">
          <Link href="/" className="text-purple-400 hover:text-purple-300">← Back to app</Link>
          {' · '}
          <a href="https://github.com/stephenclawdbot-png/EVO" target="_blank" rel="noreferrer" className="text-purple-400 hover:text-purple-300">GitHub</a>
        </p>
      </footer>
    </div>
  );
}