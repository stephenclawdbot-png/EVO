/**
 * Server-side RPC proxy. Hides the paid Helius API key from the client bundle by
 * reading `SOLANA_RPC` from server env (not `NEXT_PUBLIC_*`) and forwarding
 * JSON-RPC requests. The client points `NEXT_PUBLIC_SOLANA_RPC` at `/api/rpc`.
 *
 * Supports POST (JSON-RPC body). Limits body size to 1 MiB to blunt accidental abuse.
 */
const MAX_BODY_BYTES = 1 * 1024 * 1024;

export async function POST(req: Request): Promise<Response> {
  const upstream = process.env.SOLANA_RPC;
  if (!upstream) {
    return new Response(JSON.stringify({ jsonrpc: '2.0', error: { code: -32603, message: 'RPC upstream not configured' }, id: null }), {
      status: 503,
      headers: { 'content-type': 'application/json' },
    });
  }

  const contentLength = req.headers.get('content-length');
  if (contentLength && Number(contentLength) > MAX_BODY_BYTES) {
    return new Response(JSON.stringify({ jsonrpc: '2.0', error: { code: -32600, message: 'payload too large' }, id: null }), {
      status: 413,
      headers: { 'content-type': 'application/json' },
    });
  }

  let body: string;
  try {
    body = await req.text();
  } catch {
    return new Response(JSON.stringify({ jsonrpc: '2.0', error: { code: -32700, message: 'parse error' }, id: null }), {
      status: 400,
      headers: { 'content-type': 'application/json' },
    });
  }
  if (body.length > MAX_BODY_BYTES) {
    return new Response(JSON.stringify({ jsonrpc: '2.0', error: { code: -32600, message: 'payload too large' }, id: null }), {
      status: 413,
      headers: { 'content-type': 'application/json' },
    });
  }

  try {
    const upstreamRes = await fetch(upstream, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body,
      cache: 'no-store',
    });
    const text = await upstreamRes.text();
    return new Response(text, {
      status: upstreamRes.status,
      headers: { 'content-type': upstreamRes.headers.get('content-type') || 'application/json' },
    });
  } catch {
    return new Response(JSON.stringify({ jsonrpc: '2.0', error: { code: -32603, message: 'upstream fetch failed' }, id: null }), {
      status: 502,
      headers: { 'content-type': 'application/json' },
    });
  }
}

export async function GET(): Promise<Response> {
  return new Response(JSON.stringify({ ok: true }), { headers: { 'content-type': 'application/json' } });
}