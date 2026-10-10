// Gymi account: delete your own account and all your data. Runs on the server only.
// SUPABASE_SERVICE_ROLE_KEY is provided by Supabase to Edge Functions; it never reaches the app.
import { createClient } from 'npm:@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'method' }, 405);
  try {
    const url = Deno.env.get('SUPABASE_URL') ?? '';
    const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '', { auth: { persistSession: false } });
    const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
    const { data: u, error: ue } = await admin.auth.getUser(token);
    if (ue || !u.user) return json({ error: 'auth' }, 401);
    const body = await req.json().catch(() => ({}));
    if (body.action !== 'delete' || body.confirm !== 'DELETE') return json({ error: 'confirm' }, 400);
    const id = u.user.id;
    // Progress photos live in storage under the user's folder.
    const { data: files } = await admin.storage.from('progress').list(id, { limit: 1000 });
    if (files?.length) await admin.storage.from('progress').remove(files.map((f) => `${id}/${f.name}`));
    // Deleting the user removes every row linked to them (on delete cascade).
    const { error } = await admin.auth.admin.deleteUser(id);
    if (error) return json({ error: 'failed', detail: error.message }, 500);
    return json({ ok: true });
  } catch (e) {
    return json({ error: 'failed', detail: String(e).slice(0, 200) }, 500);
  }
});
