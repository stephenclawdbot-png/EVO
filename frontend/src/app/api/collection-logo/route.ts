import { createClient } from '@supabase/supabase-js';

// GET /api/collection-logo?name=<collection-name> → { logo: string | null }
// POST /api/collection-logo { name: string, logo: string } → { ok: true }

const BUCKET = 'logos';
const PREFIX = 'mapping/';

export async function GET(req: Request): Promise<Response> {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
  if (!supabaseUrl || !supabaseKey) {
    return Response.json({ logo: null }, { status: 200 });
  }

  const url = new URL(req.url);
  const name = url.searchParams.get('name');
  if (!name) return Response.json({ logo: null }, { status: 200 });

  try {
    const supabase = createClient(supabaseUrl, supabaseKey);
    const path = `${PREFIX}${name}.json`;
    const { data, error } = await supabase.storage.from(BUCKET).download(path);
    if (error || !data) return Response.json({ logo: null }, { status: 200 });
    const text = await data.text();
    const parsed = JSON.parse(text);
    return Response.json({ logo: parsed.logo || null }, { status: 200 });
  } catch {
    return Response.json({ logo: null }, { status: 200 });
  }
}

export async function POST(req: Request): Promise<Response> {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
  if (!supabaseUrl || !supabaseKey) {
    return Response.json({ error: 'Storage not configured' }, { status: 503 });
  }

  try {
    const { name, logo } = await req.json();
    if (!name || typeof name !== 'string') {
      return Response.json({ error: 'Collection name required' }, { status: 400 });
    }
    if (!logo || typeof logo !== 'string') {
      return Response.json({ error: 'Logo URL required' }, { status: 400 });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    const path = `${PREFIX}${name}.json`;
    const content = JSON.stringify({ logo, updatedAt: new Date().toISOString() });
    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(path, new Blob([content], { type: 'application/json' }), {
        contentType: 'application/json',
        upsert: true,
      });

    if (error) return Response.json({ error: error.message }, { status: 500 });
    return Response.json({ ok: true, logo });
  } catch (err: any) {
    return Response.json({ error: err?.message || 'Failed' }, { status: 500 });
  }
}