/**
 * Server-side manifest proxy. Fetches EVO visual manifests from Irys/Arweave
 * gateways server-side, bypassing browser CORS issues caused by Irys gateway
 * redirects to CDN URLs that don't return CORS headers.
 *
 * GET /api/manifest?uri=<gateway-url>
 *
 * The URI must be an allowlisted gateway (Irys, Arweave, IPFS) to prevent SSRF.
 * Returns the manifest JSON with permissive CORS headers.
 */

const ALLOWED_HOSTS = new Set([
  'gateway.irys.xyz',
  'arweave.net',
  'dweb.link',
  'nftstorage.link',
  'cloudflare-ipfs.com',
  'ipfs.io',
]);

const MAX_RESPONSE_BYTES = 2 * 1024 * 1024; // 2 MB

export async function GET(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const uri = url.searchParams.get('uri');
  if (!uri) {
    return new Response(JSON.stringify({ error: 'Missing uri parameter' }), {
      status: 400,
      headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' },
    });
  }

  // Validate URI is an allowed gateway (SSRF guard)
  let parsed: URL;
  try {
    parsed = new URL(uri);
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid URI' }), {
      status: 400,
      headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' },
    });
  }

  if (parsed.protocol !== 'https:') {
    return new Response(JSON.stringify({ error: 'Only HTTPS URIs allowed' }), {
      status: 400,
      headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' },
    });
  }

  if (!ALLOWED_HOSTS.has(parsed.host)) {
    return new Response(JSON.stringify({ error: 'Gateway not allowed' }), {
      status: 403,
      headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' },
    });
  }

  try {
    const upstreamRes = await fetch(uri, {
      cache: 'no-store',
      redirect: 'follow',
    });
    if (!upstreamRes.ok) {
      return new Response(JSON.stringify({ error: `Upstream returned ${upstreamRes.status}` }), {
        status: 502,
        headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' },
      });
    }

    const text = await upstreamRes.text();
    if (text.length > MAX_RESPONSE_BYTES) {
      return new Response(JSON.stringify({ error: 'Manifest too large' }), {
        status: 413,
        headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' },
      });
    }

    return new Response(text, {
      status: 200,
      headers: {
        'content-type': upstreamRes.headers.get('content-type') || 'application/json',
        'access-control-allow-origin': '*',
        'cache-control': 'no-store',
      },
    });
  } catch {
    return new Response(JSON.stringify({ error: 'Upstream fetch failed' }), {
      status: 502,
      headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' },
    });
  }
}