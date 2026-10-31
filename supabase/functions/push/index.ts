// Adro push: sends a phone notification when a coach or client gets a new message, or when someone in a group
// workout says "I'm here, starting without you" (group_ping in 20261206000000_group_ping.sql).
//
// Called only by the database (trigger coach_messages_push in 20261124000002_social_decisions.sql) with a shared
// secret in the x-push-secret header. The same secret is kept in the vault ("push_hook") and as the Edge Function
// secret PUSH_HOOK_SECRET. Deploy with:  supabase functions deploy push --no-verify-jwt
// Optional: EXPO_ACCESS_TOKEN, when "Enhanced security for push notifications" is on for the Expo project.
//
// Nothing is sent when: coaching between the two has ended (or the coach lost approval), either one blocked the
// other, notifications or message alerts are off (a coach's own notification settings; a client's phone settings).
// During quiet hours the notification still arrives, without a sound.
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';

const env = (k: string) => Deno.env.get(k) ?? '';
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { 'Content-Type': 'application/json' } });
const EXPO_PUSH = 'https://exp.host/--/api/v2/push/send';

type Quiet = { on?: boolean; from?: string; to?: string } | null;
type TokenRow = { token: string; messages: boolean; quiet: Quiet; tz: string | null };

/** Same-length compare, so the secret can't be guessed a character at a time. */
function sameSecret(a: string, b: string) {
  if (!a || a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

/** Minutes since midnight in a time zone (the phone's), or UTC when unknown. */
function nowMinutes(tz: string | null) {
  try {
    const parts = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: tz || 'UTC' }).formatToParts(new Date());
    const h = Number(parts.find((p) => p.type === 'hour')?.value ?? 0);
    const m = Number(parts.find((p) => p.type === 'minute')?.value ?? 0);
    return h * 60 + m;
  } catch {
    const d = new Date();
    return d.getUTCHours() * 60 + d.getUTCMinutes();
  }
}
const mins = (t?: string) => {
  const [h, m] = String(t ?? '').split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
};
function inQuiet(q: Quiet, tz: string | null) {
  if (!q?.on || !q.from || !q.to) return false;
  const x = nowMinutes(tz);
  const a = mins(q.from);
  const b = mins(q.to);
  return a <= b ? x >= a && x < b : x >= a || x < b;
}

const preview = (s: string) => {
  const one = s.replace(/\s+/g, ' ').trim();
  return one.length > 140 ? `${one.slice(0, 139)}…` : one;
};

async function blocked(db: SupabaseClient, a: string, b: string) {
  const { data } = await db.from('user_blocks').select('blocker').or(`and(blocker.eq.${a},blocked.eq.${b}),and(blocker.eq.${b},blocked.eq.${a})`).limit(1);
  return !!data?.length;
}

async function coachMessage(db: SupabaseClient, id: string) {
  const { data: msg } = await db.from('coach_messages').select('id,link_id,sender,text,kind').eq('id', id).maybeSingle();
  if (!msg) return { sent: 0, why: 'no_message' };
  const { data: link } = await db.from('coach_clients').select('id,coach_id,client_id,status').eq('id', msg.link_id).maybeSingle();
  if (!link || link.status !== 'active' || !link.client_id) return { sent: 0, why: 'not_active' };
  if (msg.sender !== link.coach_id && msg.sender !== link.client_id) return { sent: 0, why: 'not_member' };
  const { data: coach } = await db.from('profiles').select('account_type,coach_status').eq('id', link.coach_id).maybeSingle();
  if (coach?.account_type !== 'coach' || coach?.coach_status !== 'approved') return { sent: 0, why: 'not_approved' };

  const toCoach = msg.sender === link.client_id;
  const to: string = toCoach ? link.coach_id : link.client_id;
  if (await blocked(db, msg.sender, to)) return { sent: 0, why: 'blocked' };
  // A suspended account (either side) gets and sends no message alerts; their messages can't be read anyway.
  const { data: sus } = await db.from('profiles').select('id').in('id', [msg.sender, to]).not('suspended_at', 'is', null).limit(1);
  if (sus?.length) return { sent: 0, why: 'suspended' };

  // The coach's own notification settings (saved to the account); a client's come with each phone's token.
  let coachQuiet: Quiet = null;
  if (toCoach) {
    const { data: s } = await db.from('coach_settings').select('notif').eq('user_id', to).maybeSingle();
    const n = (s?.notif ?? {}) as { on?: boolean; msgs?: boolean; meet?: boolean; quiet?: Quiet };
    if (n.on === false || n.msgs === false || (msg.kind === 'meet' && n.meet === false)) return { sent: 0, why: 'off' };
    coachQuiet = n.quiet ?? null;
  }

  const { data: toks } = await db.from('push_tokens').select('token,messages,quiet,tz').eq('user_id', to);
  const tokens = ((toks ?? []) as TokenRow[]).filter((t) => toCoach || t.messages);
  if (!tokens.length) return { sent: 0, why: 'no_tokens' };

  const { data: from } = await db.from('profiles').select('name,username').eq('id', msg.sender).maybeSingle();
  const title = (from?.name || from?.username || 'Adro').slice(0, 60);
  const params = new URLSearchParams({ link: link.id, name: title });
  if (toCoach) params.set('client', link.client_id);
  const route = `/thread?${params.toString()}`;

  const out = tokens.map((t) => {
    const quiet = inQuiet(toCoach ? coachQuiet : t.quiet, t.tz);
    return {
      to: t.token,
      title,
      body: preview(String(msg.text ?? '')),
      data: { route, link: link.id, type: 'coach_message' },
      sound: quiet ? null : 'default',
      priority: quiet ? 'normal' : 'high',
      channelId: 'messages',
      // Messages in one thread replace each other on Android instead of piling up.
      collapseId: `thread-${link.id}`,
    };
  });

  const headers: Record<string, string> = { 'Content-Type': 'application/json', Accept: 'application/json' };
  if (env('EXPO_ACCESS_TOKEN')) headers.Authorization = `Bearer ${env('EXPO_ACCESS_TOKEN')}`;
  const res = await fetch(EXPO_PUSH, { method: 'POST', headers, body: JSON.stringify(out) });
  const body = (await res.json().catch(() => null)) as { data?: { status: string; details?: { error?: string } }[] } | null;
  // Phones that uninstalled Adro or turned it off: forget their token.
  const gone = (body?.data ?? []).map((r, i) => (r.status === 'error' && r.details?.error === 'DeviceNotRegistered' ? out[i]?.to : null)).filter((x): x is string => !!x);
  if (gone.length) await db.from('push_tokens').delete().in('token', gone);
  return { sent: res.ok ? out.length - gone.length : 0, status: res.status };
}

/** Group workout: tell everyone who hasn't joined yet that a friend is at the gym and starting. */
async function groupPing(db: SupabaseClient, id: string, from: string) {
  // The database recorded this ping just now; anything older isn't sent.
  const { data: ping } = await db.from('group_pings').select('at').eq('session_id', id).eq('user_id', from).maybeSingle();
  if (!ping || Date.now() - new Date(ping.at).getTime() > 60_000) return { sent: 0, why: 'no_ping' };
  const { data: s } = await db.from('group_sessions').select('status').eq('id', id).maybeSingle();
  if (!s || s.status === 'done') return { sent: 0, why: 'done' };
  const { data: members } = await db.from('group_session_members').select('user_id,joined').eq('session_id', id);
  const to = ((members ?? []) as { user_id: string; joined: boolean }[]).filter((m) => !m.joined && m.user_id !== from).map((m) => m.user_id);
  if (!to.length) return { sent: 0, why: 'everyone_in' };
  const { data: sender } = await db.from('profiles').select('name,username').eq('id', from).maybeSingle();
  const name = (sender?.name || sender?.username || 'Adro').slice(0, 60);
  const out: Record<string, unknown>[] = [];
  for (const u of to) {
    if (await blocked(db, from, u)) continue;
    const { data: p } = await db.from('profiles').select('language,suspended_at').eq('id', u).maybeSingle();
    if (p?.suspended_at) continue;
    const ar = p?.language === 'ar';
    const { data: toks } = await db.from('push_tokens').select('token,messages,quiet,tz').eq('user_id', u);
    for (const t of (toks ?? []) as TokenRow[]) {
      if (!t.messages) continue;
      const quiet = inQuiet(t.quiet, t.tz);
      out.push({
        to: t.token,
        title: name,
        body: ar ? `${name} وصل النادي وبيبدأ بدونك. ادخل وتمرن معه الحين.` : `${name} is at the gym and starting without you. Join in now.`,
        data: { route: `/groupactive?id=${id}`, type: 'group_ping' },
        sound: quiet ? null : 'default',
        priority: quiet ? 'normal' : 'high',
        channelId: 'messages',
        collapseId: `group-${id}`,
      });
    }
  }
  if (!out.length) return { sent: 0, why: 'no_tokens' };
  const headers: Record<string, string> = { 'Content-Type': 'application/json', Accept: 'application/json' };
  if (env('EXPO_ACCESS_TOKEN')) headers.Authorization = `Bearer ${env('EXPO_ACCESS_TOKEN')}`;
  const res = await fetch(EXPO_PUSH, { method: 'POST', headers, body: JSON.stringify(out) });
  const body = (await res.json().catch(() => null)) as { data?: { status: string; details?: { error?: string } }[] } | null;
  const gone = (body?.data ?? []).map((r, i) => (r.status === 'error' && r.details?.error === 'DeviceNotRegistered' ? (out[i]?.to as string) : null)).filter((x): x is string => !!x);
  if (gone.length) await db.from('push_tokens').delete().in('token', gone);
  return { sent: res.ok ? out.length - gone.length : 0, status: res.status };
}

const UUID = /^[0-9a-f-]{36}$/i;

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'method' }, 405);
  const secret = env('PUSH_HOOK_SECRET');
  if (!secret || !sameSecret(req.headers.get('x-push-secret') ?? '', secret)) return json({ error: 'auth' }, 401);
  try {
    const body = (await req.json().catch(() => ({}))) as { type?: string; id?: string; from?: string };
    if (typeof body.id !== 'string' || !UUID.test(body.id)) return json({ error: 'bad_request' }, 400);
    const db = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false } });
    if (body.type === 'coach_message') return json(await coachMessage(db, body.id));
    if (body.type === 'group_ping' && typeof body.from === 'string' && UUID.test(body.from)) return json(await groupPing(db, body.id, body.from));
    return json({ error: 'bad_request' }, 400);
  } catch (e) {
    return json({ error: String(e).slice(0, 200) }, 500);
  }
});
