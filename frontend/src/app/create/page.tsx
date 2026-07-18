'use client';

import { useState, useCallback, useEffect } from 'react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { Nav } from '@/components/Nav';
import { Transaction, PublicKey } from '@solana/web3.js';
import Link from 'next/link';
import {
  readProtocolConfig,
  createInitializeProtocolIx,
  createCreateCollectionIx,
  INCINERATOR,
  type FeeDestination,
  type LifecycleType,
  type RandomnessPolicy,
  type ProtocolConfig,
} from '@/lib/evo-program';
import { IconCheck, IconAlertTriangle, IconExternalLink, IconHammer, IconSparkle } from '@/components/Icons';
import { ArtworkDropzone, type ArtworkResult } from '@/components/ArtworkDropzone';
import { BulkArtworkUploader, type BulkArtworkResult } from '@/components/BulkArtworkUploader';

const FEE_DESTINATIONS: FeeDestination[] = ['Treasury', 'Creator', 'Burn', 'Split'];
const FEE_DEST_LABELS: Record<FeeDestination, string> = {
  Treasury: 'Protocol Treasury (EVO)',
  Creator: 'Creator',
  Burn: 'Burn (Incinerator)',
  Split: 'Split (Creator + Treasury)',
};
const LIFECYCLE_TYPES: LifecycleType[] = ['Static', 'Reveal', 'CommitReveal', 'RevealAndEvolve', 'Custom'];

const LIFECYCLE_INFO: Record<LifecycleType, { label: string; desc: string }> = {
  Static: {
    label: 'Static',
    desc: 'The art never changes. No reveal, no evolution. Simplest option — like a standard NFT with a SOL floor.',
  },
  Reveal: {
    label: 'Reveal',
    desc: 'Art starts hidden. A reveal authority (you by default) triggers the reveal, showing the final art to everyone at once. No evolution after that.',
  },
  CommitReveal: {
    label: 'Commit-Reveal (provably fair)',
    desc: 'Same as Reveal, but you commit a cryptographic hash of the reveal secret before minting. Guarantees you can\'t change the art after seeing who minted what. Best for fair drops.',
  },
  RevealAndEvolve: {
    label: 'Reveal & Evolve',
    desc: 'After reveal, the EVO evolves through multiple visual stages. Each stage is triggered when ALL thresholds below are met. The art literally changes over time.',
  },
  Custom: {
    label: 'Custom',
    desc: 'Full control. Supports evolution with thresholds (like Reveal & Evolve), plus a reveal authority can manually set the visual stage at any time. Most flexible.',
  },
};
const RANDOMNESS_POLICIES: RandomnessPolicy[] = ['None', 'Predetermined', 'BatchReveal'];

function parseHex32(hex: string): Uint8Array {
  const clean = hex.trim().replace(/^0x/, '');
  if (!clean) return new Uint8Array(32);
  const buf = Buffer.from(clean, 'hex');
  if (buf.length !== 32) throw new Error('Hash must be 32 bytes (64 hex chars)');
  return new Uint8Array(buf);
}

export default function CreateCollectionPage() {
  const { connection } = useConnection();
  const wallet = useWallet();

  const [protocol, setProtocol] = useState<ProtocolConfig | null>(null);
  const [loadingProto, setLoadingProto] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [initSubmitting, setInitSubmitting] = useState(false);
  const [txSig, setTxSig] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Basics
  const [name, setName] = useState('');
  const [supplyCap, setSupplyCap] = useState('100');
  const [metadataUri, setMetadataUri] = useState('');

  // Socials
  const [website, setWebsite] = useState('');
  const [twitter, setTwitter] = useState('');
  const [telegram, setTelegram] = useState('');

  // Economics
  const [mintPriceSol, setMintPriceSol] = useState('0.1');
  const [lockAmountSol, setLockAmountSol] = useState('0.05');
  const [shatterFeeBps, setShatterFeeBps] = useState('500');
  const [shatterFeeDest, setShatterFeeDest] = useState<FeeDestination>('Burn');
  const [tradeRoyaltyBps, setTradeRoyaltyBps] = useState('250');
  const [royaltyDest, setRoyaltyDest] = useState<FeeDestination>('Creator');

  // Lifecycle
  const [lifecycleType, setLifecycleType] = useState<LifecycleType>('Static');
  const [maxStates, setMaxStates] = useState('4');
  const [revealAuthority, setRevealAuthority] = useState('');
  const [randomnessPolicy, setRandomnessPolicy] = useState<RandomnessPolicy>('None');
  const [evolveTradeThreshold, setEvolveTradeThreshold] = useState('3');
  const [evolveFeedThreshold, setEvolveFeedThreshold] = useState('10000000');
  const [evolveHoldSeconds, setEvolveHoldSeconds] = useState('86400');
  const [evolveLockedThreshold, setEvolveLockedThreshold] = useState('10000000');
  const [manifestRoot, setManifestRoot] = useState('');
  const [transitionPolicyHash, setTransitionPolicyHash] = useState('');
  const [artworkManifestHash, setArtworkManifestHash] = useState('');

  // Art mode
  const [artMode, setArtMode] = useState<'generative' | 'upload' | 'bulk'>('upload');
  const [artwork, setArtwork] = useState<ArtworkResult | null>(null);
  const [bulkArtwork, setBulkArtwork] = useState<BulkArtworkResult | null>(null);

  const fetchProtocol = useCallback(async () => {
    setLoadingProto(true);
    try {
      const cfg = await readProtocolConfig(connection);
      setProtocol(cfg);
    } catch (err) {
      console.error('Failed to read protocol config:', err);
    } finally {
      setLoadingProto(false);
    }
  }, [connection]);

  useEffect(() => { fetchProtocol(); }, [fetchProtocol]);

  const needsLifecycle = lifecycleType !== 'Static';

  const sendTx = async (ix: any) => {
    if (!wallet.connected || !wallet.publicKey) { setError('Connect wallet first'); return null; }
    const tx = new Transaction().add(ix);
    tx.feePayer = wallet.publicKey;
    const { blockhash } = await connection.getLatestBlockhash();
    tx.recentBlockhash = blockhash;
    const signed = await wallet.signTransaction?.(tx);
    if (!signed) throw new Error('Transaction signing failed');
    const sig = await connection.sendRawTransaction(signed.serialize());
    await connection.confirmTransaction(sig, 'confirmed');
    return sig;
  };

  const handleInitializeProtocol = async () => {
    if (!wallet.connected || !wallet.publicKey) { setError('Connect wallet first'); return; }
    setInitSubmitting(true); setError(null); setTxSig(null);
    try {
      const ix = createInitializeProtocolIx(wallet.publicKey, wallet.publicKey, 0);
      const sig = await sendTx(ix);
      if (sig) {
        setTxSig(sig);
        await fetchProtocol();
      }
    } catch (err: any) {
      setError(err?.message || String(err));
    } finally {
      setInitSubmitting(false);
    }
  };

  const handleSubmit = async () => {
    if (!wallet.connected || !wallet.publicKey) { setError('Connect wallet first'); return; }
    if (!protocol?.initialized) { setError('Protocol not initialized yet. Initialize it first.'); return; }
    if (!name.trim()) { setError('Collection name is required'); return; }
    const effectiveMetadataUri =
      (artMode === 'upload' && artwork ? artwork.manifestUri :
       artMode === 'bulk' && bulkArtwork ? bulkArtwork.manifestUri :
       metadataUri.trim()) || '';

    if (!effectiveMetadataUri) {
      setError(artMode === 'upload' || artMode === 'bulk' ? 'Upload at least one image' : 'Metadata URI is required');
      return;
    }

    // Append social links as query params so the collection page can display them
    const socialParams = new URLSearchParams();
    if (website.trim()) socialParams.set('website', website.trim());
    if (twitter.trim()) socialParams.set('twitter', twitter.trim());
    if (telegram.trim()) socialParams.set('telegram', telegram.trim());
    const finalMetadataUri = socialParams.toString()
      ? `${effectiveMetadataUri}${effectiveMetadataUri.includes('?') ? '&' : '?'}${socialParams.toString()}`
      : effectiveMetadataUri;
    setSubmitting(true); setError(null); setTxSig(null);
    try {
      const lamportsPerSol = 1_000_000_000;
      const effectiveManifestRoot =
        artMode === 'upload' && artwork ? artwork.merkleRoot :
        artMode === 'bulk' && bulkArtwork ? bulkArtwork.merkleRoot :
        manifestRoot;
      const lifecycle = {
        lifecycleType,
        maxStates: parseInt(maxStates) || 1,
        revealAuthority: revealAuthority.trim() ? new PublicKey(revealAuthority.trim()) : wallet.publicKey!,
        randomnessPolicy,
        manifestRoot: parseHex32(effectiveManifestRoot),
        evolveTradeThreshold: parseInt(evolveTradeThreshold) || 0,
        evolveFeedThreshold: parseInt(evolveFeedThreshold) || 0,
        evolveHoldSeconds: parseInt(evolveHoldSeconds) || 0,
        evolveLockedThreshold: parseInt(evolveLockedThreshold) || 0,
        transitionPolicyHash: parseHex32(transitionPolicyHash),
        burnDestination: INCINERATOR,
        artworkManifestHash: parseHex32(artworkManifestHash),
      };
      const ix = createCreateCollectionIx(
        wallet.publicKey,
        protocol.treasury,
        name.trim(),
        parseInt(supplyCap) || 1,
        parseInt(shatterFeeBps) || 0,
        shatterFeeDest,
        parseInt(tradeRoyaltyBps) || 0,
        royaltyDest,
        Math.floor(parseFloat(mintPriceSol) * lamportsPerSol),
        Math.floor(parseFloat(lifecycleType === 'Static' ? '0.001' : lockAmountSol) * lamportsPerSol),
        finalMetadataUri,
        lifecycle,
      );
      const sig = await sendTx(ix);
      if (sig) setTxSig(sig);
    } catch (err: any) {
      setError(err?.message || String(err));
    } finally {
      setSubmitting(false);
    }
  };

  const labelCls = 'block text-[11px] font-semibold uppercase tracking-wide text-dim mb-1';
  const inputCls = 't-input w-full px-3 py-2 text-sm';
  const sectionCls = 'border border-border bg-surface rounded-lg p-4';
  const sectionTitleCls = 'text-sm font-bold text-text-strong mb-3 flex items-center gap-2';

  return (
    <div className="min-h-screen bg-bg text-text">
      <Nav />

      <div className="border-b border-border">
        <Link href="/" className="mx-auto flex max-w-2xl items-center gap-1.5 px-3 py-2 text-xs text-muted transition-colors hover:text-text">
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round"><path d="m12 19-7-7 7-7" /><path d="M19 12H5" /></svg>
          Gallery
        </Link>
      </div>

      <div className="mx-auto max-w-2xl px-3 py-6 lg:px-4">
        <div className="flex items-center gap-2">
          <IconHammer className="h-5 w-5 text-accent" />
          <h1 className="text-xl font-bold tracking-tight text-text-strong">Create Collection</h1>
        </div>
        <p className="mt-1 text-xs text-muted">
          Deploy a new EVO collection on-chain. You become the collection creator and gain lifecycle management authority.
        </p>

        {/* Wallet gate — connect first, then the form */}
        {!wallet.connected ? (
          <div className="mt-8 flex flex-col items-center gap-4 rounded-lg border border-border bg-surface p-10 text-center">
            <IconSparkle className="h-8 w-8 text-accent" />
            <p className="text-sm font-semibold text-text-strong">Connect a wallet to create a collection</p>
            <p className="max-w-sm text-xs text-muted">Creation requires a signed on-chain transaction. Connect your Solana wallet to continue.</p>
            <WalletMultiButton />
          </div>
        ) : loadingProto ? (
          <div className="mt-8 text-center text-xs text-muted">Reading protocol config…</div>
        ) : !protocol?.initialized ? (
          <div className="mt-8 rounded-lg border border-border bg-surface p-6">
            <div className="flex items-center gap-2">
              <IconAlertTriangle className="h-5 w-5 text-negative" />
              <h2 className="text-sm font-bold text-text-strong">Protocol not initialized</h2>
            </div>
            <p className="mt-2 text-xs text-muted">
              The EVO protocol must be initialized once before any collection can be created. This sets the protocol treasury
              and creation fee. On devnet/testnet you can initialize it yourself using your connected wallet as the treasury.
            </p>
            <button
              onClick={handleInitializeProtocol}
              disabled={initSubmitting}
              className="mt-4 inline-flex items-center gap-2 rounded border border-accent bg-accent px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-accent-hover disabled:opacity-50"
            >
              {initSubmitting ? 'Initializing…' : 'Initialize Protocol'}
            </button>
            {txSig && (
              <a href={`https://solscan.io/tx/${txSig}`} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1 text-xs text-accent hover:underline">
                <IconExternalLink className="h-3 w-3" /> View on Solscan
              </a>
            )}
          </div>
        ) : (
          <div className="mt-6 space-y-4">
            {/* Basics */}
            <div className={sectionCls}>
              <h2 className={sectionTitleCls}><IconSparkle className="h-4 w-4 text-accent" /> Basics</h2>
              <div className="space-y-3">
                <div>
                  <label className={labelCls}>Collection Name</label>
                  <input className={inputCls} value={name} onChange={e => setName(e.target.value)} placeholder="genesis" />
                  <p className="mt-1 text-[10px] text-dim">Unique on-chain identifier. Lowercase recommended.</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>Supply Cap</label>
                    <input type="number" className={inputCls} value={supplyCap} onChange={e => setSupplyCap(e.target.value)} />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className={labelCls}>Website</label>
                    <input className={inputCls} value={website} onChange={e => setWebsite(e.target.value)} placeholder="https://…" />
                  </div>
                  <div>
                    <label className={labelCls}>X (Twitter)</label>
                    <input className={inputCls} value={twitter} onChange={e => setTwitter(e.target.value)} placeholder="https://x.com/…" />
                  </div>
                  <div>
                    <label className={labelCls}>Telegram</label>
                    <input className={inputCls} value={telegram} onChange={e => setTelegram(e.target.value)} placeholder="https://t.me/…" />
                  </div>
                </div>
              </div>

              {/* Art mode toggle */}
              <div className="mt-3">
                <label className={labelCls}>Art Mode</label>
                <div className="flex rounded-lg border border-border p-0.5">
                  <button
                    onClick={() => setArtMode('upload')}
                    className={`flex-1 rounded px-3 py-1.5 text-xs font-semibold transition-colors ${artMode === 'upload' ? 'bg-accent text-white' : 'text-muted hover:text-text'}`}
                  >
                    Upload
                  </button>
                  <button
                    onClick={() => setArtMode('bulk')}
                    className={`flex-1 rounded px-3 py-1.5 text-xs font-semibold transition-colors ${artMode === 'bulk' ? 'bg-accent text-white' : 'text-muted hover:text-text'}`}
                  >
                    Bulk (10k+)
                  </button>
                  <button
                    onClick={() => setArtMode('generative')}
                    className={`flex-1 rounded px-3 py-1.5 text-xs font-semibold transition-colors ${artMode === 'generative' ? 'bg-accent text-white' : 'text-muted hover:text-text'}`}
                  >
                    Generative
                  </button>
                </div>
              </div>

              {artMode === 'upload' ? (
                <div className="mt-3">
                  <label className={labelCls}>Artwork (drag &amp; drop)</label>
                  <ArtworkDropzone
                    collectionName={name}
                    maxStates={parseInt(maxStates) || 1}
                    onArtworkReady={setArtwork}
                  />
                </div>
              ) : artMode === 'bulk' ? (
                <div className="mt-3">
                  <label className={labelCls}>Bulk Artwork (ZIP or per-state)</label>
                  <BulkArtworkUploader
                    collectionName={name}
                    stateNames={Array.from({ length: parseInt(maxStates) || 1 }, (_, i) => `State ${i + 1}`)}
                    onArtworkReady={setBulkArtwork}
                  />
                </div>
              ) : (
                <div className="mt-3">
                  <label className={labelCls}>Metadata URI</label>
                  <input className={inputCls} value={metadataUri} onChange={e => setMetadataUri(e.target.value)} placeholder="https://…/manifest.json" />
                </div>
              )}
            </div>

            {/* Economics */}
            <div className={sectionCls}>
              <h2 className={sectionTitleCls}>Economics</h2>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>Mint Price (SOL)</label>
                    <input type="number" step="0.001" className={inputCls} value={mintPriceSol} onChange={e => setMintPriceSol(e.target.value)} />
                  </div>
                  <div>
                    <label className={labelCls}>Locked SOL per EVO{lifecycleType === 'Static' ? ' (auto)' : ''}</label>
                    <input
                      type="number"
                      step="0.001"
                      className={inputCls}
                      value={lifecycleType === 'Static' ? '0.001' : lockAmountSol}
                      onChange={e => setLockAmountSol(e.target.value)}
                      readOnly={lifecycleType === 'Static'}
                    />
                    {lifecycleType === 'Static' && <p className="mt-1 text-[10px] text-dim">Minimal lock for Static — no evolution needed.</p>}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>Shatter Fee (bps)</label>
                    <input type="number" className={inputCls} value={shatterFeeBps} onChange={e => setShatterFeeBps(e.target.value)} />
                    <p className="mt-1 text-[10px] text-dim">500 = 5%</p>
                  </div>
                  <div>
                    <label className={labelCls}>Shatter Fee →</label>
                    <select className={inputCls} value={shatterFeeDest} onChange={e => setShatterFeeDest(e.target.value as FeeDestination)}>
                      {FEE_DESTINATIONS.map(d => <option key={d} value={d}>{FEE_DEST_LABELS[d]}</option>)}
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>Trade Royalty (bps)</label>
                    <input type="number" className={inputCls} value={tradeRoyaltyBps} onChange={e => setTradeRoyaltyBps(e.target.value)} />
                    <p className="mt-1 text-[10px] text-dim">250 = 2.5%</p>
                  </div>
                  <div>
                    <label className={labelCls}>Royalty →</label>
                    <select className={inputCls} value={royaltyDest} onChange={e => setRoyaltyDest(e.target.value as FeeDestination)}>
                      {FEE_DESTINATIONS.map(d => <option key={d} value={d}>{FEE_DEST_LABELS[d]}</option>)}
                    </select>
                  </div>
                </div>
              </div>
            </div>

            {/* Lifecycle */}
            <div className={sectionCls}>
              <h2 className={sectionTitleCls}>Visual Lifecycle</h2>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>Lifecycle Type</label>
                    <select className={inputCls} value={lifecycleType} onChange={e => setLifecycleType(e.target.value as LifecycleType)}>
                      {LIFECYCLE_TYPES.map(t => <option key={t} value={t}>{LIFECYCLE_INFO[t].label}</option>)}
                    </select>
                    <p className="mt-1 text-[10px] leading-relaxed text-dim">{LIFECYCLE_INFO[lifecycleType].desc}</p>
                  </div>
                  <div>
                    <label className={labelCls}>Max States</label>
                    <input type="number" className={inputCls} value={maxStates} onChange={e => setMaxStates(e.target.value)} />
                    <p className="mt-1 text-[10px] text-dim">Number of visual stages (1 = no evolution).</p>
                  </div>
                </div>

                {needsLifecycle && (
                  <>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className={labelCls}>Randomness Policy</label>
                        <select className={inputCls} value={randomnessPolicy} onChange={e => setRandomnessPolicy(e.target.value as RandomnessPolicy)}>
                          {RANDOMNESS_POLICIES.map(p => <option key={p} value={p}>{p}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className={labelCls}>Reveal Authority</label>
                        <input className={inputCls} value={revealAuthority} onChange={e => setRevealAuthority(e.target.value)} placeholder="(defaults to you)" />
                      </div>
                    </div>

                    {(lifecycleType === 'RevealAndEvolve' || lifecycleType === 'Custom') && (
                      <div className="rounded border border-border bg-bg p-3">
                        <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-dim">Evolve Triggers</p>
                        <p className="mb-3 text-[10px] leading-relaxed text-muted">
                          The EVO advances to the next stage when <span className="text-text">all</span> enabled triggers below are met.
                          Thresholds are cumulative — stage 2 needs 2× the threshold, stage 3 needs 3×, etc.
                          Evolution is permissionless: anyone can trigger it, but it only fires if conditions are met.
                          Set a field to 0 to disable that trigger.
                        </p>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className={labelCls}>Trades to evolve</label>
                            <input type="number" className={inputCls} value={evolveTradeThreshold} onChange={e => setEvolveTradeThreshold(e.target.value)} />
                            <p className="mt-1 text-[10px] text-dim">How many times the EVO must be bought before evolving. 3 = need 3 trades for stage 1, 6 for stage 2…</p>
                          </div>
                          <div>
                            <label className={labelCls}>Feed SOL to evolve</label>
                            <input type="number" step="0.001" className={inputCls}
                              value={evolveFeedThreshold ? (parseInt(evolveFeedThreshold) / 1_000_000_000).toString() : ''}
                              onChange={e => setEvolveFeedThreshold(e.target.value ? Math.floor(parseFloat(e.target.value) * 1_000_000_000).toString() : '0')}
                              placeholder="0.01"
                            />
                            <p className="mt-1 text-[10px] text-dim">Total SOL fed into the EVO. 0.01 = need 0.01 SOL fed for stage 1, 0.02 for stage 2…</p>
                          </div>
                          <div>
                            <label className={labelCls}>Hold time (hours)</label>
                            <input type="number" step="0.1" className={inputCls}
                              value={evolveHoldSeconds ? (parseInt(evolveHoldSeconds) / 3600).toString() : ''}
                              onChange={e => setEvolveHoldSeconds(e.target.value ? Math.floor(parseFloat(e.target.value) * 3600).toString() : '0')}
                              placeholder="24"
                            />
                            <p className="mt-1 text-[10px] text-dim">Time held since last evolution. 24h = need 24h for stage 1, 48h for stage 2…</p>
                          </div>
                          <div>
                            <label className={labelCls}>Locked SOL to evolve</label>
                            <input type="number" step="0.001" className={inputCls}
                              value={evolveLockedThreshold ? (parseInt(evolveLockedThreshold) / 1_000_000_000).toString() : ''}
                              onChange={e => setEvolveLockedThreshold(e.target.value ? Math.floor(parseFloat(e.target.value) * 1_000_000_000).toString() : '0')}
                              placeholder="0.01"
                            />
                            <p className="mt-1 text-[10px] text-dim">Minimum SOL locked in the PDA. 0.01 = need 0.01 SOL locked for stage 1, 0.02 for stage 2…</p>
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="space-y-3">
                      <div>
                        <label className={labelCls}>Artwork Manifest Hash (hex)</label>
                        <input
                          className={inputCls}
                          value={
                            artMode === 'bulk' && bulkArtwork ? bulkArtwork.merkleRoot :
                            artworkManifestHash
                          }
                          onChange={e => setArtworkManifestHash(e.target.value)}
                          placeholder="64 hex chars (optional)"
                          readOnly={artMode === 'bulk' && !!bulkArtwork}
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className={labelCls}>Manifest Root (hex)</label>
                        <input
                          className={inputCls}
                          value={
                            artMode === 'upload' && artwork ? artwork.merkleRoot :
                            artMode === 'bulk' && bulkArtwork ? bulkArtwork.merkleRoot :
                            manifestRoot
                          }
                          onChange={e => setManifestRoot(e.target.value)}
                          placeholder="64 hex chars (auto-filled from upload)"
                          readOnly={(artMode === 'upload' && !!artwork) || (artMode === 'bulk' && !!bulkArtwork)}
                        />
                      </div>
                      <div>
                        <label className={labelCls}>Transition Policy Hash (hex)</label>
                        <input className={inputCls} value={transitionPolicyHash} onChange={e => setTransitionPolicyHash(e.target.value)} placeholder="64 hex chars (optional)" />
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Protocol info */}
            <div className="rounded-lg border border-border bg-bg p-3 text-[11px] text-muted">
              <div className="flex flex-wrap justify-between gap-2">
                <span>Protocol treasury: <span className="font-mono text-text">{protocol.treasury.toBase58().slice(0, 8)}…</span></span>
                <span>Creation fee: <span className="font-mono text-text">{protocol.creationFeeLamports / 1_000_000_000} SOL</span></span>
              </div>
            </div>

            {/* Submit */}
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="inline-flex w-full items-center justify-center gap-2 rounded border border-accent bg-accent px-4 py-3 text-sm font-bold text-white transition-colors hover:bg-accent-hover disabled:opacity-50"
            >
              {submitting ? 'Creating…' : <><IconHammer className="h-4 w-4" /> Create Collection</>}
            </button>

            {error && (
              <div className="flex items-start gap-2 rounded border border-negative/40 bg-negative/10 p-3 text-xs text-negative">
                <IconAlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <span className="break-all">{error}</span>
              </div>
            )}
            {txSig && !error && (
              <div className="flex items-start gap-2 rounded border border-positive/40 bg-positive/10 p-3 text-xs text-positive">
                <IconCheck className="mt-0.5 h-4 w-4 shrink-0" />
                <div>
                  <p className="font-semibold">Collection created.</p>
                  <a href={`https://solscan.io/tx/${txSig}`} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 hover:underline">
                    <IconExternalLink className="h-3 w-3" /> View on Solscan
                  </a>
                  <Link href={`/c/${encodeURIComponent(name.trim())}`} className="mt-1 ml-3 inline-flex items-center gap-1 hover:underline">
                    Open collection →
                  </Link>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}