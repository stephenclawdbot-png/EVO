'use client';

import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import {
  PhantomWalletAdapter,
  SolflareWalletAdapter,
} from '@solana/wallet-adapter-wallets';
import { clusterApiUrl } from '@solana/web3.js';
import { useMemo, type ReactNode } from 'react';

export function WalletContextProvider({ children }: { children: ReactNode }) {
  // `NEXT_PUBLIC_SOLANA_RPC` is set to `/api/rpc` — a local proxy that hides the
  // paid Helius key server-side. The proxy only works in the browser; during
  // SSR/prerender the Connection constructor rejects non-http URLs, so fall
  // back to the public mainnet endpoint there.
  const endpoint = useMemo(
    () => {
      const v = process.env.NEXT_PUBLIC_SOLANA_RPC;
      if (v && typeof window !== 'undefined') return v;
      return clusterApiUrl('mainnet-beta');
    },
    []
  );
  const wallets = useMemo(
    () => [
      new PhantomWalletAdapter(),
      new SolflareWalletAdapter(),
    ],
    []
  );

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>{children}</WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}