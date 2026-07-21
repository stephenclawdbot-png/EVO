import { createClient } from '@supabase/supabase-js';

const MAX_FILE_SIZE = 2 * 1024 * 1024;

const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/svg+xml'];

export async function POST(req: Request): Promise<Response> {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return Response.json({ error: 'Storage not configured' }, { status: 503 });
  }

  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const wallet = (formData.get('wallet') as string | null) || 'anon';

    if (!file) {
      return Response.json({ error: 'No file provided' }, { status: 400 });
    }
    if (file.size > MAX_FILE_SIZE) {
      return Response.json({ error: 'File too large (max 2MB)' }, { status: 413 });
    }
    if (!ALLOWED_TYPES.includes(file.type)) {
      return Response.json({ error: 'Invalid file type' }, { status: 415 });
    }

    const ext = file.name.split('.').pop()?.toLowerCase() || 'png';
    const filename = `${wallet}_${Date.now()}.${ext}`;

    const supabase = createClient(supabaseUrl, supabaseKey);

    const { error: uploadError } = await supabase.storage
      .from('logos')
      .upload(filename, file, { contentType: file.type, upsert: false });

    if (uploadError) {
      return Response.json({ error: uploadError.message }, { status: 500 });
    }

    const { data: urlData } = supabase.storage.from('logos').getPublicUrl(filename);

    return Response.json({ url: urlData.publicUrl });
  } catch (err: any) {
    return Response.json({ error: err?.message || 'Upload failed' }, { status: 500 });
  }
}