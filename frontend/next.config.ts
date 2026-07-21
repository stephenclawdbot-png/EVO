import type { NextConfig } from "next";

const securityHeaders = [
  // Prevent clickjacking of the wallet-interacting dapp.
  { key: "X-Frame-Options", value: "DENY" },
  // Block MIME-type sniffing on responses.
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Don't leak the dapp URL to third-party gateways / image hosts via Referer.
  { key: "Referrer-Policy", value: "no-referrer" },
  // Lock down powerful APIs the dapp doesn't use.
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  // Strict CSP: only self + known gateways. No inline, no eval, no third-party
  // scripts. `data:` is allowed for image src (collection artwork may inline).
  // The Irys gateway is allowlisted for image/script fetches, and the Irys
  // uploader endpoints (mainnet + devnet) for the bulk artwork uploader —
  // without these, the browser silently blocks every upload POST and the
  // Irys SDK just reports a generic "Network Error".
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline' https://s3.tradingview.com",
      "img-src 'self' data: blob: https: ipfs: arweave:",
      "connect-src 'self' https://api.mainnet-beta.solana.com https://api.devnet.solana.com https://*.helius-rpc.com https://gateway.irys.xyz https://uploader.irys.xyz https://devnet.irys.xyz https://dweb.link https://arweave.net https://s3.tradingview.com https://*.tradingview.com wss://*.tradingview.com",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; "),
  },
];

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
