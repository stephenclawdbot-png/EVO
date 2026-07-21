/**
 * Server-side image proxy. Fetches EVO artwork images from Irys/Arweave
 * gateways server-side, bypassing browser DNS/CORS issues caused by Irys
 * gateway redirects to CDN URLs that may not resolve in all client locations.
 *
 * GET /api/img?uri=<gateway-url>
 *
 * The URI must be an allowlisted gateway (Irys, Arweave, IPFS) to prevent SSRF.
 * Returns the image bytes with permissive CORS headers and correct content-type.
 */

const ALLOWED_HOSTS = new Set([
  'gateway.irys.xyz',
  'arweave.net',
  'dweb.link',
  'nftstorage.link',
  'cloudflare-ipfs.com',
  'ipfs.io',
]);

const MAX_RESPONSE_BYTES = 10 * 1024 * 1024; // 10 MB for images

export async function GET(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const uri = url.searchParams.get('uri');
  if (!uri) {
    return new Response('Missing uri parameter', { status: 400 });
  }

  let parsed: URL;
  try {
    parsed = new URL(uri);
  } catch {
    return new Response('Invalid URI', { status: 400 });
  }

  if (parsed.protocol !== 'https:') {
    return new Response('Only HTTPS URIs allowed', { status: 400 });
  }

  if (!ALLOWED_HOSTS.has(parsed.host)) {
    return new Response('Gateway not allowed', { status: 403 });
  }

  try {
    const upstreamRes = await fetch(uri, {
      cache: 'no-store',
      redirect: 'follow',
    });
    if (!upstreamRes.ok) {
      return new Response(`Upstream returned ${upstreamRes.status}`, { status: 502 });
    }

    const contentType = upstreamRes.headers.get('content-type') || 'image/png';
    const buf = await upstreamRes.arrayBuffer();
    if (buf.byteLength > MAX_RESPONSE_BYTES) {
      return new Response('Image too large', { status: 413 });
    }

    return new Response(buf, {
      status: 200,
      headers: {
        'content-type': contentType,
        'access-control-allow-origin': '*',
        'cache-control': 'public, max-age=86400, immutable',
      },
    });
  } catch {
    return new Response('Upstream fetch failed', { status: 502 });
  }
}