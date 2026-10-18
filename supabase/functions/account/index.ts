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
    // Your password, checked here on the server: holding an unlocked phone (or the session) isn't enough to delete.
    const email = u.user.email;
    if (!email || typeof body.password !== 'string' || !body.password) return json({ error: 'password' }, 403);
    const anon = createClient(url, Deno.env.get('SUPABASE_ANON_KEY') ?? '', { auth: { persistSession: false } });
    const { error: pe } = await anon.auth.signInWithPassword({ email, password: body.password });
    if (pe) return json({ error: 'password' }, 403);
    const id = u.user.id;
    // Files live in storage under the user's folder in each bucket (photos, health files, certificates, avatar).
    // Every file must be gone before the account is: otherwise health files would stay behind with no owner.
    for (const bucket of ['progress', 'health-files', 'coach-certs', 'avatars']) {
      const paths: string[] = [];
      const walk = async (dir: string, depth: number) => {
        // A page at a time, so folders with more than 1000 files are cleared too.
        for (let offset = 0; ; offset += 1000) {
          const { data, error } = await admin.storage.from(bucket).list(dir, { limit: 1000, offset });
          if (error) throw new Error(`list ${bucket}: ${error.message}`);
          for (const f of data ?? []) {
            // Folders have no id; go one level deeper for them.
            if (f.id) paths.push(`${dir}/${f.name}`);
            else if (depth < 3) await walk(`${dir}/${f.name}`, depth + 1);
          }
          if (!data || data.length < 1000) break;
        }
      };
      await walk(id, 0);
      for (let i = 0; i < paths.length; i += 100) {
        const { error } = await admin.storage.from(bucket).remove(paths.slice(i, i + 100));
        if (error) throw new Error(`remove ${bucket}: ${error.message}`);
      }
    }
    // Deleting the user removes every row linked to them (on delete cascade).
    const { error } = await admin.auth.admin.deleteUser(id);
    if (error) {
      console.error(error.message);
      return json({ error: 'failed' }, 500);
    }
    return json({ ok: true });
  } catch (e) {
    // The account stays (some files may already be gone), so the person can try again.
    console.error(String(e));
    return json({ error: 'failed' }, 500);
  }
});
