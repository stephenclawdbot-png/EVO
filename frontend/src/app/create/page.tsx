'use client';

import { useState, useCallback, useEffect } from 'react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { Nav } from '@/components/Nav';
import { Footer } from '@/components/Footer';
import { Transaction, PublicKey } from '@solana/web3.js';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { humanizeError } from '@/lib/errors';
import {
  readProtocolConfig,
  readAllCollections,
  createInitializeProtocolIx,
  createCreateCollectionIx,
  INCINERATOR,
  type FeeDestination,
  type LifecycleType,
  type RandomnessPolicy,
  type ProtocolConfig,
  type CollectionDiscovery,
} from '@/lib/evo-program';
import { IconCheck, IconAlertTriangle, IconExternalLink, IconHammer, IconSparkle } from '@/components/Icons';
import { BulkArtworkUploader, type BulkArtworkResult } from '@/components/BulkArtworkUploader';

const CREATE_DRAFT_KEY = 'evo_create_draft_v1';

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
  const [existingCollection, setExistingCollection] = useState<CollectionDiscovery | null>(null);
  const [checkingExisting, setCheckingExisting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [initSubmitting, setInitSubmitting] = useState(false);
  const [txSig, setTxSig] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [metadataWarning, setMetadataWarning] = useState<string | null>(null);

  // Basics
  const [name, setName] = useState('');
  const [supplyCap, setSupplyCap] = useState('100');
  const [metadataUri, setMetadataUri] = useState('');

  // Socials
  const [website, setWebsite] = useState('');
  const [twitter, setTwitter] = useState('');
  const [telegram, setTelegram] = useState('');
  const [discord, setDiscord] = useState('');

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
  // Human-readable evolution thresholds. Stored as raw strings so the user
  // can type decimals (e.g. "0.0", "0.05") without the value snapping back on
  // every keystroke. Converted to lamports/seconds only at submit time.
  const [evolveFeedSol, setEvolveFeedSol] = useState('0.01');
  const [evolveHoldHours, setEvolveHoldHours] = useState('24');
  const [evolveLockedSol, setEvolveLockedSol] = useState('0.01');
  const [manifestRoot, setManifestRoot] = useState('');
  const [transitionPolicyHash, setTransitionPolicyHash] = useState('');
  const [artworkManifestHash, setArtworkManifestHash] = useState('');

  // Art mode
  const [artMode, setArtMode] = useState<'generative' | 'bulk'>('bulk');
  // bulkArtwork/logoUri survive a refresh via localStorage — the Arweave upload itself
  // already succeeded and shouldn't be lost just because the on-chain submit hasn't happened yet.
  const [bulkArtwork, setBulkArtwork] = useState<BulkArtworkResult | null>(() => {
    if (typeof window === 'undefined') return null;
    try {
      const raw = localStorage.getItem(CREATE_DRAFT_KEY);
      return raw ? JSON.parse(raw).bulkArtwork ?? null : null;
    } catch { return null; }
  });

  // Collection logo
  const [logoUri, setLogoUri] = useState(() => {
    if (typeof window === 'undefined') return '';
    try {
      const raw = localStorage.getItem(CREATE_DRAFT_KEY);
      return raw ? JSON.parse(raw).logoUri ?? '' : '';
    } catch { return ''; }
  });
  const [logoUploading, setLogoUploading] = useState(false);

  // Pre-reveal mystery image (optional, for reveal-type collections)
  const [preRevealUri, setPreRevealUri] = useState('');
  const [preRevealUploading, setPreRevealUploading] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(CREATE_DRAFT_KEY, JSON.stringify({ bulkArtwork, logoUri }));
    } catch { /* quota / private mode */ }
  }, [bulkArtwork, logoUri]);

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

  // Off-chain enforcement: one wallet = one collection.
  // When the wallet connects, scan all collections and block the form
  // if this wallet already created one. (On-chain still allows multiple;
  // this gate prevents it through the marketplace UI.)
  useEffect(() => {
    if (!wallet.connected || !wallet.publicKey) {
      setExistingCollection(null);
      return;
    }
    let cancelled = false;
    setCheckingExisting(true);
    readAllCollections(connection)
      .then((cols) => {
        if (cancelled) return;
        const found = cols.find((c) => c.config.creator.equals(wallet.publicKey!));
        setExistingCollection(found ?? null);
      })
      .catch((err) => {
        console.error('Failed to check existing collections:', err);
      })
      .finally(() => {
        if (!cancelled) setCheckingExisting(false);
      });
    return () => { cancelled = true; };
  }, [wallet.connected, wallet.publicKey, connection]);

  const needsLifecycle = lifecycleType !== 'Static';

  // Upload collection logo to Supabase Storage
  const handleLogoUpload = async (file: File) => {
    if (file.size > 2_000_000) { setError('Logo must be under 2MB'); return; }
    setLogoUploading(true); setError(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('wallet', wallet.publicKey?.toString() || 'anon');
      const res = await fetch('/api/logo', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Logo upload failed');
      setLogoUri(data.url);
    } catch (err: any) {
      setError(humanizeError(err?.message || 'Logo upload failed'));
    } finally {
      setLogoUploading(false);
    }
  };

  // Upload pre-reveal image to Supabase Storage
  const handlePreRevealUpload = async (file: File) => {
    if (file.size > 2_000_000) { setError('Pre-reveal image must be under 2MB'); return; }
    setPreRevealUploading(true); setError(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('wallet', wallet.publicKey?.toString() || 'anon');
      const res = await fetch('/api/logo', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload failed');
      setPreRevealUri(data.url);
    } catch (err: any) {
      setError(humanizeError(err?.message || 'Upload failed'));
    } finally {
      setPreRevealUploading(false);
    }
  };

  const sendTx = async (ix: any) => {
    if (!wallet.connected || !wallet.publicKey) { setError('Connect wallet first'); return null; }
    const tx = new Transaction().add(ix);
    tx.feePayer = wallet.publicKey;
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
    tx.recentBlockhash = blockhash;
    const signed = await wallet.signTransaction?.(tx);
    if (!signed) throw new Error('Transaction signing failed');
    const sig = await connection.sendRawTransaction(signed.serialize());
    const conf = await connection.confirmTransaction({ signature: sig, blockhash, lastValidBlockHeight }, 'confirmed');
    if (conf.value.err) throw new Error(`Transaction failed on-chain: ${JSON.stringify(conf.value.err)}`);
    return sig;
  };

  const handleInitializeProtocol = async () => {
    if (!wallet.connected || !wallet.publicKey) { setError('Connect wallet first'); return; }
    setInitSubmitting(true); setError(null); setTxSig(null);
    try {
      const ix = createInitializeProtocolIx(wallet.publicKey, wallet.publicKey, wallet.publicKey, 0);
      const sig = await sendTx(ix);
      if (sig) {
        setTxSig(sig);
        await fetchProtocol();
      }
    } catch (err: any) {
      setError(humanizeError(err?.message || String(err)));
    } finally {
      setInitSubmitting(false);
    }
  };

  const handleSubmit = async () => {
    if (!wallet.connected || !wallet.publicKey) { setError('Connect wallet first'); return; }
    if (!protocol?.initialized) { setError('Protocol not initialized yet. Initialize it first.'); return; }
    if (!name.trim()) { setError('Collection name is required'); return; }
    const effectiveMetadataUri =
      (artMode === 'bulk' && bulkArtwork ? bulkArtwork.manifestUri :
       metadataUri.trim()) || '';

    if (!effectiveMetadataUri) {
      setError(artMode === 'bulk' ? 'Upload at least one image' : 'Metadata URI is required');
      return;
    }

    // Append social links as query params so the collection page can display them.
    // The on-chain program caps metadata_uri at MAX_METADATA_URI_LEN (200 chars —
    // see programs/evo/src/constants.rs). A manifest URI plus several social links
    // and a logo URL can easily exceed that, which used to revert on-chain with a
    // cryptic MetadataUriTooLong error after the user had already signed and paid
    // for the transaction. Drop the lowest-priority fields (logo first — it's the
    // longest single value and least essential on-chain) until it fits, and tell
    // the user what got dropped instead of failing the whole submission.
    const ON_CHAIN_METADATA_URI_MAX_LEN = 200;
    const socialFields: { key: string; value: string }[] = [
      { key: 'website', value: website.trim() },
      { key: 'twitter', value: twitter.trim() },
      { key: 'telegram', value: telegram.trim() },
      { key: 'discord', value: discord.trim() },
      { key: 'logo', value: logoUri },
      { key: 'preReveal', value: preRevealUri },
    ].filter(f => f.value);

    const buildUri = (fields: typeof socialFields) => {
      const params = new URLSearchParams();
      for (const f of fields) params.set(f.key, f.value);
      const qs = params.toString();
      return qs ? `${effectiveMetadataUri}${effectiveMetadataUri.includes('?') ? '&' : '?'}${qs}` : effectiveMetadataUri;
    };

    let includedFields = [...socialFields];
    const droppedFields: string[] = [];
    let finalMetadataUri = buildUri(includedFields);
    // Drop order: preReveal and logo first (longest, least essential), then discord,
    // telegram, twitter — website survives longest since it's the link people actually click.
    for (const key of ['preReveal', 'logo', 'discord', 'telegram', 'twitter', 'website']) {
      if (finalMetadataUri.length <= ON_CHAIN_METADATA_URI_MAX_LEN) break;
      const idx = includedFields.findIndex(f => f.key === key);
      if (idx === -1) continue;
      includedFields.splice(idx, 1);
      droppedFields.push(key);
      finalMetadataUri = buildUri(includedFields);
    }

    setMetadataWarning(
      droppedFields.length > 0
        ? `Some links didn't fit the on-chain metadata size limit and were left out: ${droppedFields.join(', ')}.`
        : null
    );
    setSubmitting(true); setError(null); setTxSig(null);
    try {
      const lamportsPerSol = 1_000_000_000;
      const effectiveManifestRoot =
        artMode === 'bulk' && bulkArtwork ? bulkArtwork.merkleRoot :
        manifestRoot;
      const lifecycle = {
        lifecycleType,
        maxStates: lifecycleType === 'Static' ? 1 : (parseInt(maxStates) || 1),
        revealAuthority: revealAuthority.trim() ? new PublicKey(revealAuthority.trim()) : wallet.publicKey!,
        randomnessPolicy,
        manifestRoot: parseHex32(effectiveManifestRoot),
        evolveTradeThreshold: parseInt(evolveTradeThreshold) || 0,
        evolveFeedThreshold: BigInt(Math.floor(parseFloat(evolveFeedSol || '0') * 1_000_000_000)),
        evolveHoldSeconds: BigInt(Math.floor(parseFloat(evolveHoldHours || '0') * 3600)),
        evolveLockedThreshold: BigInt(Math.floor(parseFloat(evolveLockedSol || '0') * 1_000_000_000)),
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
      if (sig) {
        setTxSig(sig);
        if (typeof window !== 'undefined') {
          try { localStorage.removeItem(CREATE_DRAFT_KEY); } catch { /* private mode */ }
        }
      }
    } catch (err: any) {
      setError(humanizeError(err?.message || String(err)));
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
        ) : checkingExisting ? (
          <div className="mt-8 text-center text-xs text-muted">Checking existing collections…</div>
        ) : existingCollection ? (
          <div className="mt-8 rounded-lg border border-border bg-surface p-6">
            <div className="flex items-center gap-2">
              <IconAlertTriangle className="h-5 w-5 text-negative" />
              <h2 className="text-sm font-bold text-text-strong">One collection per wallet</h2>
            </div>
            <p className="mt-2 text-xs text-muted">
              This wallet already created the collection <span className="font-semibold text-text-strong">{existingCollection.config.name}</span>.
              The marketplace allows one collection per wallet to prevent spam and keep the gallery clean.
            </p>
            <Link href={`/c/${existingCollection.config.name}`} className="mt-4 inline-flex items-center gap-2 rounded border border-accent bg-accent px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-accent-hover">
              <IconExternalLink className="h-3 w-3" /> View your collection
            </Link>
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
                <div>
                  <label className={labelCls}>Collection Logo</label>
                  <div className="flex items-center gap-3">
                    {logoUri ? (
                      <img src={logoUri} alt="Logo" className="h-12 w-12 rounded-lg border border-border object-cover" />
                    ) : (
                      <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-border bg-surface text-dim">
                        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="9" cy="9" r="2" /><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" /></svg>
                      </div>
                    )}
                    <div className="flex-1">
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/gif,image/webp,image/svg+xml"
                        onChange={e => { const f = e.target.files?.[0]; if (f) handleLogoUpload(f); }}
                        className="block w-full text-[10px] text-dim file:mr-2 file:rounded file:border file:border-border file:bg-surface file:px-2 file:py-1 file:text-[10px] file:font-semibold file:text-text hover:file:border-accent"
                        disabled={logoUploading}
                      />
                      <p className="mt-1 text-[10px] text-dim">
                        {logoUploading ? 'Uploading to Arweave…' : 'PNG/JPG/SVG. Shown on gallery cards. Stored on Arweave.'}
                      </p>
                    </div>
                  </div>
                </div>
                {needsLifecycle && (
                  <div>
                    <label className={labelCls}>Pre-Reveal Mystery Image <span className="text-dim">(optional)</span></label>
                    <div className="flex items-center gap-3">
                      {preRevealUri ? (
                        <img src={preRevealUri} alt="Pre-reveal" className="h-12 w-12 rounded-lg border border-border object-cover" />
                      ) : (
                        <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-border bg-surface text-dim">
                          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm0 5v.01M12 12v.01" /></svg>
                        </div>
                      )}
                      <div className="flex-1">
                        <input
                          type="file"
                          accept="image/png,image/jpeg,image/gif,image/webp,image/svg+xml"
                          onChange={e => { const f = e.target.files?.[0]; if (f) handlePreRevealUpload(f); }}
                          className="block w-full text-[10px] text-dim file:mr-2 file:rounded file:border file:border-border file:bg-surface file:px-2 file:py-1 file:text-[10px] file:font-semibold file:text-text hover:file:border-accent"
                          disabled={preRevealUploading}
                        />
                        <p className="mt-1 text-[10px] text-dim">
                          {preRevealUploading ? 'Uploading…' : 'Shown before reveal instead of the actual art. Keeps the reveal a surprise.'}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>Supply Cap</label>
                    <input type="number" className={inputCls} value={supplyCap} onChange={e => setSupplyCap(e.target.value)} />
                  </div>
                  <div>
                    <label className={labelCls}>Visual Lifecycle</label>
                    <select className={inputCls} value={lifecycleType} onChange={e => setLifecycleType(e.target.value as LifecycleType)}>
                      {LIFECYCLE_TYPES.map(t => <option key={t} value={t}>{LIFECYCLE_INFO[t].label}</option>)}
                    </select>
                    <p className="mt-1 text-[10px] leading-relaxed text-dim">{LIFECYCLE_INFO[lifecycleType].desc}</p>
                  </div>
                </div>
                {lifecycleType !== 'Static' && (
                  <div>
                    <label className={labelCls}>Max States</label>
                    <input type="number" className={inputCls} value={maxStates} onChange={e => setMaxStates(e.target.value)} />
                    <p className="mt-1 text-[10px] text-dim">Number of visual stages. Each stage needs its own set of images.</p>
                  </div>
                )}
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
                  <div>
                    <label className={labelCls}>Discord</label>
                    <input className={inputCls} value={discord} onChange={e => setDiscord(e.target.value)} placeholder="https://discord.gg/…" />
                  </div>
                </div>
              </div>

              {/* Art mode toggle */}
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

            {/* Lifecycle — advanced settings (type & max states are in Basics) */}
            {needsLifecycle && (
            <div className={sectionCls}>
              <h2 className={sectionTitleCls}>Lifecycle Settings</h2>
              <div className="space-y-3">
                <div className="rounded border border-border bg-surface p-2 text-[10px] leading-relaxed text-muted">
                  <span className="font-semibold text-text">{LIFECYCLE_INFO[lifecycleType].label}</span> — {LIFECYCLE_INFO[lifecycleType].desc}
                </div>
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
                        <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-dim">Evolution Rules</p>
                        <p className="mb-3 text-[10px] leading-relaxed text-muted">
                          Choose what makes an EVO reach its next form. Evolution fires automatically once all enabled conditions are met.
                          Leave a field at 0 to ignore that condition. Each stage becomes progressively harder — stage 2 needs 2× the threshold, stage 3 needs 3×, etc.
                          Evolution is permissionless: anyone can trigger it, but it only fires if conditions are met.
                        </p>
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                          <div>
                            <label className={labelCls}>Trades to evolve</label>
                            <input type="number" className={inputCls} value={evolveTradeThreshold} onChange={e => setEvolveTradeThreshold(e.target.value)} />
                            <p className="mt-1 text-[10px] leading-relaxed text-dim">
                              How many secondary-market trades before evolving. 3 = 3 trades for stage 1, 6 for stage 2, 9 for stage 3…
                              <br /><span className="text-text">0</span> = trading does not affect evolution (encourages diamond handing).
                              <br />Keep this low (1-3). High values encourage wash trading between wallets, which creates fake volume and hurts credibility.
                            </p>
                          </div>
                          <div>
                            <label className={labelCls}>Feed SOL to evolve</label>
                            <input type="number" step="0.001" className={inputCls}
                              value={evolveFeedSol}
                              onChange={e => setEvolveFeedSol(e.target.value)}
                              placeholder="0.01"
                            />
                            <p className="mt-1 text-[10px] leading-relaxed text-dim">
                              Total SOL deposited into the EVO. Rewards owners for investing. 0.01 = 0.01 SOL for stage 1, 0.02 for stage 2…
                            </p>
                          </div>
                          <div>
                            <label className={labelCls}>Hold time (hours)</label>
                            <input type="number" step="0.1" className={inputCls}
                              value={evolveHoldHours}
                              onChange={e => setEvolveHoldHours(e.target.value)}
                              placeholder="24"
                            />
                            <p className="mt-1 text-[10px] leading-relaxed text-dim">
                              How long the current owner must hold before evolving. 24h = 24h for stage 1, 48h for stage 2… Rewards long-term conviction.
                            </p>
                          </div>
                          <div>
                            <label className={labelCls}>Locked SOL to evolve</label>
                            <input type="number" step="0.001" className={inputCls}
                              value={evolveLockedSol}
                              onChange={e => setEvolveLockedSol(e.target.value)}
                              placeholder="0.01"
                            />
                            <p className="mt-1 text-[10px] leading-relaxed text-dim">
                              Minimum SOL permanently locked in the PDA. 0.01 = 0.01 SOL for stage 1, 0.02 for stage 2… Encourages stronger backing.
                            </p>
                          </div>
                        </div>
                        <div className="mt-3 rounded border border-border bg-surface p-2">
                          <p className="text-[10px] leading-relaxed text-muted">
                            <span className="font-semibold text-text">Tip:</span> For diamond-hand collections, set Trades to 0 and use Hold Time + Feed SOL instead.
                            This rewards holders and investors rather than speculators. Use Trades only for collections designed to be highly tradable.
                          </p>
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
                            artMode === 'bulk' && bulkArtwork ? bulkArtwork.merkleRoot :
                            manifestRoot
                          }
                          onChange={e => setManifestRoot(e.target.value)}
                          placeholder="64 hex chars (auto-filled from upload)"
                          readOnly={artMode === 'bulk' && !!bulkArtwork}
                        />
                      </div>
                      <div>
                        <label className={labelCls}>Transition Policy Hash (hex)</label>
                        <input className={inputCls} value={transitionPolicyHash} onChange={e => setTransitionPolicyHash(e.target.value)} placeholder="64 hex chars (optional)" />
                      </div>
                    </div>
              </div>
            </div>
            )}

            {/* Artwork */}
            <div className={sectionCls}>
              <h2 className={sectionTitleCls}><IconSparkle className="h-4 w-4 text-accent" /> Artwork</h2>
              <div className="space-y-3">
                <div>
                  <label className={labelCls}>Art Mode</label>
                  <div className="flex rounded-lg border border-border p-0.5">
                    <button
                      onClick={() => setArtMode('bulk')}
                      className={`flex-1 rounded px-3 py-1.5 text-xs font-semibold transition-colors ${artMode === 'bulk' ? 'bg-accent text-white' : 'text-muted hover:text-text'}`}
                    >
                      Upload (Arweave)
                    </button>
                    <button
                      onClick={() => setArtMode('generative')}
                      className={`flex-1 rounded px-3 py-1.5 text-xs font-semibold transition-colors ${artMode === 'generative' ? 'bg-accent text-white' : 'text-muted hover:text-text'}`}
                    >
                      External URI
                    </button>
                  </div>
                  <p className="mt-1 text-[10px] leading-relaxed text-dim">
                    {artMode === 'bulk' && 'Uploads to Arweave via Irys. Permanent storage, costs SOL. Mainnet-ready. Supports ZIP and 10k+ images.'}
                    {artMode === 'generative' && 'Point to an existing metadata manifest URI. No upload needed. For creators who already host their art elsewhere.'}
                  </p>
                </div>

                {artMode === 'bulk' ? (
                  <div>
                    <label className={labelCls}>Artwork (ZIP or per-state)</label>
                    <details className="mb-3 rounded-lg border border-border bg-surface p-3 text-[11px] leading-relaxed text-muted">
                      <summary className="cursor-pointer font-semibold text-text">How to upload artwork (click to expand)</summary>
                      <div className="mt-3 space-y-3">
                        <div>
                          <p className="font-semibold text-text">Two ways to upload:</p>
                          <ul className="mt-1 ml-4 list-disc space-y-1">
                            <li><span className="font-semibold text-text">ZIP files</span> — Drag one or more .zip files into the drop zone. The uploader extracts them and auto-sorts images into states based on folder names (e.g. <code className="rounded bg-bg px-1">state1/</code>, <code className="rounded bg-bg px-1">state2/</code>).</li>
                            <li><span className="font-semibold text-text">Per-state drop zones</span> — Drag image files directly into each state box below. Useful for small collections or when adding a few files manually.</li>
                          </ul>
                        </div>
                        <div>
                          <p className="font-semibold text-text">Image files:</p>
                          <ul className="mt-1 ml-4 list-disc space-y-1">
                            <li>PNG, JPG, GIF, or WebP — all supported.</li>
                            <li>File naming: <code className="rounded bg-bg px-1">0.png</code>, <code className="rounded bg-bg px-1">1.png</code>, <code className="rounded bg-bg px-1">2.png</code>… (zero-indexed, matching the mint order).</li>
                            <li>Each state must have the same number of images. If State 1 has 100 images, State 2 also needs 100.</li>
                            <li>Image #0 in State 1 corresponds to Image #0 in State 2 — they represent the same NFT at different lifecycle stages.</li>
                          </ul>
                        </div>
                        <div>
                          <p className="font-semibold text-text">JSON trait files (optional but recommended):</p>
                          <ul className="mt-1 ml-4 list-disc space-y-1">
                            <li>Drop <code className="rounded bg-bg px-1">.json</code> files alongside your images (in the ZIP or per-state zone).</li>
                            <li>Each JSON file should be named to match its image: <code className="rounded bg-bg px-1">0.json</code> for <code className="rounded bg-bg px-1">0.png</code>, <code className="rounded bg-bg px-1">1.json</code> for <code className="rounded bg-bg px-1">1.png</code>, etc.</li>
                            <li>Format: <code className="rounded bg-bg px-1">{'{"traits": {"Rarity": "Rare", "Color": "Blue"}}'}</code> — a simple object with a <code className="rounded bg-bg px-1">traits</code> key mapping trait names to values.</li>
                            <li>Only one set of JSON files is needed (not per-state). Traits apply to the NFT itself, not per-stage.</li>
                            <li>If no JSON files are provided, traits will be empty in the manifest. You can always add them later via the metadata API.</li>
                          </ul>
                        </div>
                        <div>
                          <p className="font-semibold text-text">Mixed upload example (ZIP structure):</p>
                          <pre className="mt-1 overflow-x-auto rounded bg-bg p-2 text-[10px] text-text"><code>{`my-collection.zip
├── state1/
│   ├── 0.png
│   ├── 1.png
│   ├── 0.json
│   └── 1.json
└── state2/
    ├── 0.png
    └── 1.png`}</code></pre>
                          <p className="mt-1">JSON files can live in any state folder — the uploader collects them all and matches by filename index.</p>
                        </div>
                        <div>
                          <p className="font-semibold text-text">Costs:</p>
                          <ul className="mt-1 ml-4 list-disc space-y-1">
                            <li>Uploads go to Arweave via Irys — permanent, censorship-resistant storage.</li>
                            <li>Cost is paid in SOL from your connected wallet. Use "Estimate cost" after adding files to preview the fee.</li>
                            <li>Devnet option is free but temporary (data pruned after ~60 days). Use mainnet for production collections.</li>
                          </ul>
                        </div>
                      </div>
                    </details>
                    <BulkArtworkUploader
                      collectionName={name}
                      stateNames={Array.from({ length: lifecycleType === 'Static' ? 1 : (parseInt(maxStates) || 1) }, (_, i) => `State ${i + 1}`)}
                      onArtworkReady={setBulkArtwork}
                    />
                  </div>
                ) : (
                  <div>
                    <label className={labelCls}>Metadata URI</label>
                    <input className={inputCls} value={metadataUri} onChange={e => setMetadataUri(e.target.value)} placeholder="https://…/manifest.json" />
                  </div>
                )}
              </div>
            </div>

            {/* Protocol info */}
            <div className="rounded-lg border border-border bg-bg p-3 text-[11px] text-muted">
              <div className="flex flex-wrap justify-between gap-2">
                <span>Protocol treasury: <span className="font-mono text-text">{protocol.treasury.toBase58().slice(0, 8)}…</span></span>
                <span>Creation fee: <span className="font-mono text-text">{Number(protocol.creationFeeLamports) / 1_000_000_000} SOL</span></span>
              </div>
            </div>

            {/* File review toggle */}
            {artMode === 'bulk' && bulkArtwork && (
              <details className="rounded-lg border border-border bg-surface p-3" open>
                <summary className="cursor-pointer text-xs font-semibold text-text">
                  Review uploaded files ({bulkArtwork.totalImages} images · {bulkArtwork.manifest.items.length} items · {bulkArtwork.manifest.lifecycle.stateNames.length} states)
                </summary>
                <div className="mt-3 space-y-2 text-[11px] text-muted">
                  <div className="flex flex-wrap gap-2">
                    <span className="rounded border border-border bg-bg px-2 py-0.5">Manifest URI: <span className="font-mono text-text">{bulkArtwork.manifestUri.slice(0, 40)}…</span></span>
                    <span className="rounded border border-border bg-bg px-2 py-0.5">Merkle root: <span className="font-mono text-text">{bulkArtwork.merkleRoot.slice(0, 20)}…</span></span>
                  </div>
                  <div className="rounded border border-border bg-bg p-2">
                    <p className="mb-1 font-semibold text-text">States preview (first image per state):</p>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6">
                      {bulkArtwork.manifest.items.slice(0, 6).map((item, i) => (
                        <div key={i} className="rounded border border-border p-1">
                          <img src={item.states[0]} alt="" className="h-16 w-16 rounded object-cover" />
                          <p className="mt-1 text-[9px] text-dim">#{item.index}</p>
                        </div>
                      ))}
                    </div>
                    {bulkArtwork.manifest.items.length > 6 && (
                      <p className="mt-1 text-[10px] text-dim">+ {bulkArtwork.manifest.items.length - 6} more items…</p>
                    )}
                  </div>
                  <p className="text-[10px] text-dim">If this looks correct, proceed to create collection below. The manifest and Merkle root will be recorded on-chain.</p>
                </div>
              </details>
            )}

            {/* Submit */}
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="inline-flex w-full items-center justify-center gap-2 rounded border border-accent bg-accent px-4 py-3 text-sm font-bold text-white transition-colors hover:bg-accent-hover disabled:opacity-50"
            >
              {submitting ? 'Creating…' : <><IconHammer className="h-4 w-4" /> Create Collection</>}
            </button>

            {metadataWarning && !error && (
              <div className="flex items-start gap-2 rounded border border-yellow-500/40 bg-yellow-500/10 p-3 text-xs text-yellow-600">
                <IconAlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{metadataWarning}</span>
              </div>
            )}
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
      <Footer />
    </div>
  );
}