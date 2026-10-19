// Gymi wearables: connect WHOOP or Oura with their own sign-in (OAuth), then pull daily summaries into
// wearable_days. Runs on the server only: the keys the wearable gives us are kept in device_links and never
// reach the app. Client ids and secrets are Edge Function secrets (WHOOP_CLIENT_ID, WHOOP_CLIENT_SECRET,
// OURA_CLIENT_ID, OURA_CLIENT_SECRET); without them a wearable shows as "not set up yet".
//
// Redirect URL to register with each wearable: https://<project>.supabase.co/functions/v1/wearables
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';

const env = (k: string) => Deno.env.get(k) ?? '';
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
const SELF = env('WEARABLES_REDIRECT') || `${env('SUPABASE_URL')}/functions/v1/wearables`;

type Provider = 'whoop' | 'oura';
const PROVIDERS: Record<Provider, { auth: string; token: string; api: string; scope: string; id: string; secret: string; stateLen: number; revoke?: (t: string) => Promise<unknown> }> = {
  whoop: {
    auth: 'https://api.prod.whoop.com/oauth/oauth2/auth',
    token: 'https://api.prod.whoop.com/oauth/oauth2/token',
    api: 'https://api.prod.whoop.com/developer',
    // "offline" is what gives a refresh token.
    scope: 'offline read:recovery read:cycles read:sleep read:workout read:profile read:body_measurement',
    id: 'WHOOP_CLIENT_ID',
    secret: 'WHOOP_CLIENT_SECRET',
    // WHOOP wants a state of exactly 8 characters.
    stateLen: 8,
    revoke: (t) => fetch('https://api.prod.whoop.com/developer/v2/user/access', { method: 'DELETE', headers: { Authorization: `Bearer ${t}` } }),
  },
  oura: {
    auth: 'https://cloud.ouraring.com/oauth/authorize',
    token: 'https://api.ouraring.com/oauth/token',
    api: 'https://api.ouraring.com',
    scope: 'personal daily heartrate workout spo2',
    id: 'OURA_CLIENT_ID',
    secret: 'OURA_CLIENT_SECRET',
    stateLen: 32,
    revoke: (t) => fetch(`https://api.ouraring.com/oauth/revoke?access_token=${encodeURIComponent(t)}`),
  },
};
const isProvider = (p: unknown): p is Provider => p === 'whoop' || p === 'oura';
const configured = (p: Provider) => !!env(PROVIDERS[p].id) && !!env(PROVIDERS[p].secret);

// Where the browser may be sent back after signing in: the Gymi website, the phone app, or a local test server.
const RETURN_OK = /^(https:\/\/gymi-inky\.vercel\.app|https:\/\/[a-z0-9-]+\.vercel\.app|gymi:\/\/|exp\+gymi:\/\/|http:\/\/(localhost|127\.0\.0\.1)(:\d+)?)(\/|$)/;

const ABC = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
const randomState = (n: number) => Array.from(crypto.getRandomValues(new Uint8Array(n)), (b) => ABC[b % ABC.length]).join('');

function admin() {
  return createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false } });
}

// ---------------------------------------------------------------------------
// Keys
// ---------------------------------------------------------------------------
type Link = { user_id: string; provider: Provider; access_token: string; refresh_token: string | null; expires_at: string | null; last_sync: string | null };

async function tokenRequest(p: Provider, body: Record<string, string>) {
  const cfg = PROVIDERS[p];
  const res = await fetch(cfg.token, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ ...body, client_id: env(cfg.id), client_secret: env(cfg.secret) }),
    signal: AbortSignal.timeout(20_000),
  });
  const j = await res.json().catch(() => null);
  if (!res.ok || !j?.access_token) throw new Error(`token ${res.status}: ${JSON.stringify(j ?? {}).slice(0, 200)}`);
  return j as { access_token: string; refresh_token?: string; expires_in?: number; scope?: string };
}

const expiry = (s?: number) => (s ? new Date(Date.now() + s * 1000).toISOString() : null);

/** A working access key: refreshed a minute before it runs out. A refused refresh marks the link "expired". */
async function accessToken(db: SupabaseClient, l: Link) {
  if (!l.expires_at || new Date(l.expires_at).getTime() - 60_000 > Date.now()) return l.access_token;
  if (!l.refresh_token) throw new Error('expired');
  try {
    const t = await tokenRequest(l.provider, { grant_type: 'refresh_token', refresh_token: l.refresh_token, ...(l.provider === 'whoop' ? { scope: 'offline' } : {}) });
    // The old refresh token stops working once a new one is issued, so it's saved right away.
    await db.from('device_links').update({ access_token: t.access_token, refresh_token: t.refresh_token ?? l.refresh_token, expires_at: expiry(t.expires_in), status: 'ok', last_error: null }).eq('user_id', l.user_id).eq('provider', l.provider);
    l.access_token = t.access_token;
    l.refresh_token = t.refresh_token ?? l.refresh_token;
    return t.access_token;
  } catch (e) {
    await db.from('device_links').update({ status: 'expired', last_error: String(e).slice(0, 300) }).eq('user_id', l.user_id).eq('provider', l.provider);
    throw new Error('expired');
  }
}

/** Every page of a list. WHOOP uses "records" and "nextToken", Oura "data" and "next_token". */
async function all(p: Provider, token: string, path: string, q: Record<string, string>) {
  const out: Record<string, unknown>[] = [];
  let next: string | null = null;
  for (let page = 0; page < 20; page++) {
    const u = new URL(PROVIDERS[p].api + path);
    for (const [k, v] of Object.entries(q)) u.searchParams.set(k, v);
    if (next) u.searchParams.set(p === 'whoop' ? 'nextToken' : 'next_token', next);
    const res = await fetch(u, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(20_000) });
    if (res.status === 401) throw new Error('unauthorized');
    if (!res.ok) throw new Error(`${path} ${res.status}`);
    const j = await res.json();
    out.push(...((p === 'whoop' ? j.records : j.data) ?? []));
    next = j.next_token ?? null;
    if (!next) break;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Days
// ---------------------------------------------------------------------------
type Day = {
  recovery?: number | null; strain?: number | null; sleep_score?: number | null; hrv?: number | null; hr_rest?: number | null; hr_avg?: number | null;
  sleep_h?: number | null; in_bed_h?: number | null; sleep_eff?: number | null; spo2?: number | null; temp_dev?: number | null; steps?: number | null;
  active_kcal?: number | null; workouts?: { type: string; minutes: number; kcal: number }[];
};
const r1 = (n: number) => Math.round(n * 10) / 10;
const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
/** A value inside its allowed range, or nothing (the table refuses anything outside). */
const within = (v: number | null | undefined, lo: number, hi: number) => (v != null && v >= lo && v <= hi ? v : null);
/** The local calendar day of a time, using the offset the wearable gives ("+03:00"). */
function localDay(iso: string, offset?: string | null) {
  const m = /^([+-])(\d{2}):?(\d{2})$/.exec(offset ?? '');
  const mins = m ? (m[1] === '-' ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3])) : 0;
  return new Date(Date.parse(iso) + mins * 60_000).toISOString().slice(0, 10);
}

async function whoopDays(token: string, from: Date) {
  const q = { start: from.toISOString(), limit: '25' };
  const [sleeps, recs, cycles, wos] = await Promise.all([
    all('whoop', token, '/v2/activity/sleep', q),
    all('whoop', token, '/v2/recovery', q),
    all('whoop', token, '/v2/cycle', q),
    all('whoop', token, '/v2/activity/workout', q),
  ]);
  const days = new Map<string, Day>();
  const at = (d: string) => days.get(d) ?? (days.set(d, { workouts: [] }), days.get(d)!);
  // The main sleep of the night counts on the day you woke up (naps don't).
  const sleepDay = new Map<string, string>();
  const longest = new Map<string, number>();
  for (const s of sleeps as { id: string; end: string; timezone_offset?: string; nap?: boolean; score_state?: string; score?: Record<string, unknown> }[]) {
    if (s.nap || s.score_state !== 'SCORED' || !s.score) continue;
    const day = localDay(s.end, s.timezone_offset);
    sleepDay.set(s.id, day);
    const st = (s.score.stage_summary ?? {}) as Record<string, number>;
    const asleep = (st.total_light_sleep_time_milli ?? 0) + (st.total_slow_wave_sleep_time_milli ?? 0) + (st.total_rem_sleep_time_milli ?? 0);
    if (asleep <= (longest.get(day) ?? 0)) continue;
    longest.set(day, asleep);
    Object.assign(at(day), {
      sleep_h: r1(asleep / 3.6e6),
      in_bed_h: st.total_in_bed_time_milli ? r1(st.total_in_bed_time_milli / 3.6e6) : null,
      sleep_eff: num(s.score.sleep_efficiency_percentage) != null ? Math.round(s.score.sleep_efficiency_percentage as number) : null,
      sleep_score: num(s.score.sleep_performance_percentage) != null ? Math.round(s.score.sleep_performance_percentage as number) : null,
    });
  }
  for (const r of recs as { sleep_id?: string; created_at: string; score_state?: string; score?: Record<string, unknown> }[]) {
    if (r.score_state !== 'SCORED' || !r.score) continue;
    const day = (r.sleep_id && sleepDay.get(r.sleep_id)) || localDay(r.created_at);
    Object.assign(at(day), {
      recovery: num(r.score.recovery_score) != null ? Math.round(r.score.recovery_score as number) : null,
      hr_rest: num(r.score.resting_heart_rate) != null ? Math.round(r.score.resting_heart_rate as number) : null,
      hrv: num(r.score.hrv_rmssd_milli) != null ? r1(r.score.hrv_rmssd_milli as number) : null,
      spo2: num(r.score.spo2_percentage) != null ? r1(r.score.spo2_percentage as number) : null,
    });
  }
  for (const c of cycles as { start: string; timezone_offset?: string; score_state?: string; score?: Record<string, unknown>; step_count?: number }[]) {
    if (c.score_state !== 'SCORED' || !c.score) continue;
    const d = at(localDay(c.start, c.timezone_offset));
    d.strain = num(c.score.strain) != null ? r1(c.score.strain as number) : null;
    d.hr_avg = num(c.score.average_heart_rate) != null ? Math.round(c.score.average_heart_rate as number) : null;
    if (num(c.step_count) != null) d.steps = Math.round(c.step_count as number);
  }
  for (const w of wos as { start: string; end: string; timezone_offset?: string; sport_name?: string; score?: Record<string, unknown> }[]) {
    const minutes = Math.round((Date.parse(w.end) - Date.parse(w.start)) / 6e4);
    if (!(minutes > 0)) continue;
    at(localDay(w.start, w.timezone_offset)).workouts!.push({ type: String(w.sport_name ?? 'Workout'), minutes, kcal: num(w.score?.kilojoule) != null ? Math.round((w.score!.kilojoule as number) / 4.184) : 0 });
  }
  return days;
}

async function ouraDays(token: string, from: Date) {
  const start_date = from.toISOString().slice(0, 10);
  // The end day isn't included: tomorrow, so today counts.
  const end_date = new Date(Date.now() + 864e5).toISOString().slice(0, 10);
  const q = { start_date, end_date };
  const get = (path: string) => all('oura', token, `/v2/usercollection/${path}`, q).catch(() => [] as Record<string, unknown>[]);
  const [readiness, dsleep, sleep, activity, spo2, wos] = await Promise.all([get('daily_readiness'), get('daily_sleep'), get('sleep'), get('daily_activity'), get('daily_spo2'), get('workout')]);
  const days = new Map<string, Day>();
  const at = (d: string) => days.get(d) ?? (days.set(d, { workouts: [] }), days.get(d)!);
  for (const r of readiness as { day: string; score?: number; temperature_deviation?: number }[]) Object.assign(at(r.day), { recovery: num(r.score), temp_dev: num(r.temperature_deviation) != null ? r1(r.temperature_deviation!) : null });
  for (const s of dsleep as { day: string; score?: number }[]) at(s.day).sleep_score = num(s.score);
  // The main sleep of the day (the longest "long_sleep").
  const longest = new Map<string, number>();
  for (const s of sleep as { day: string; type?: string; total_sleep_duration?: number; time_in_bed?: number; efficiency?: number; average_hrv?: number; lowest_heart_rate?: number; average_heart_rate?: number }[]) {
    if (s.type !== 'long_sleep' && s.type !== 'sleep') continue;
    const secs = s.total_sleep_duration ?? 0;
    if (secs <= (longest.get(s.day) ?? 0)) continue;
    longest.set(s.day, secs);
    Object.assign(at(s.day), {
      sleep_h: r1(secs / 3600),
      in_bed_h: s.time_in_bed ? r1(s.time_in_bed / 3600) : null,
      sleep_eff: num(s.efficiency),
      hrv: num(s.average_hrv),
      hr_rest: num(s.lowest_heart_rate),
      hr_avg: num(s.average_heart_rate) != null ? Math.round(s.average_heart_rate!) : null,
    });
  }
  for (const a of activity as { day: string; steps?: number; active_calories?: number; score?: number }[]) Object.assign(at(a.day), { steps: num(a.steps), active_kcal: num(a.active_calories), strain: num(a.score) });
  for (const s of spo2 as { day: string; spo2_percentage?: { average?: number } | null }[]) {
    const v = num(s.spo2_percentage?.average);
    if (v != null) at(s.day).spo2 = r1(v);
  }
  for (const w of wos as { day: string; activity?: string; start_datetime: string; end_datetime: string; calories?: number }[]) {
    const minutes = Math.round((Date.parse(w.end_datetime) - Date.parse(w.start_datetime)) / 6e4);
    if (minutes > 0) at(w.day).workouts!.push({ type: String(w.activity ?? 'Workout'), minutes, kcal: Math.round(num(w.calories) ?? 0) });
  }
  return days;
}

/** Pull the last `n` days from one wearable and save them. Returns how many days were saved. */
async function syncLink(db: SupabaseClient, l: Link, n: number) {
  const token = await accessToken(db, l);
  const from = new Date(Date.now() - n * 864e5);
  let days: Map<string, Day>;
  try {
    days = l.provider === 'whoop' ? await whoopDays(token, from) : await ouraDays(token, from);
  } catch (e) {
    // Access taken back on the wearable's side: the person has to connect again.
    const expired = (e as Error).message === 'unauthorized';
    await db.from('device_links').update({ status: expired ? 'expired' : 'error', last_error: String(e).slice(0, 300) }).eq('user_id', l.user_id).eq('provider', l.provider);
    throw e;
  }
  const rows = [...days.entries()].map(([day, d]) => ({
    user_id: l.user_id,
    provider: l.provider,
    day,
    recovery: within(d.recovery, 0, 100),
    strain: within(d.strain, 0, 100),
    sleep_score: within(d.sleep_score, 0, 100),
    hrv: within(d.hrv, 0, 500),
    hr_rest: within(d.hr_rest, 20, 250),
    hr_avg: within(d.hr_avg, 20, 250),
    sleep_h: within(d.sleep_h, 0, 24),
    in_bed_h: within(d.in_bed_h, 0, 24),
    sleep_eff: within(d.sleep_eff, 0, 100),
    spo2: within(d.spo2, 50, 100),
    temp_dev: within(d.temp_dev, -10, 10),
    steps: within(d.steps, 0, 200000),
    active_kcal: within(d.active_kcal, 0, 20000),
    workouts: (d.workouts ?? []).slice(0, 20),
    updated_at: new Date().toISOString(),
  }));
  if (rows.length) {
    const { error } = await db.from('wearable_days').upsert(rows, { onConflict: 'user_id,provider,day' });
    if (error) throw new Error(`save: ${error.message}`);
  }
  await db.from('device_links').update({ last_sync: new Date().toISOString(), status: 'ok', last_error: null }).eq('user_id', l.user_id).eq('provider', l.provider);
  return rows.length;
}

// ---------------------------------------------------------------------------
// Sign-in comes back here (a browser GET from the wearable)
// ---------------------------------------------------------------------------
async function callback(url: URL) {
  const db = admin();
  const state = url.searchParams.get('state') ?? '';
  const { data: st } = await db.from('oauth_states').delete().eq('state', state).select('user_id,provider,return_to,created_at').maybeSingle();
  const back = (to: string, q: Record<string, string>) => {
    const u = new URL(to);
    for (const [k, v] of Object.entries(q)) u.searchParams.set(k, v);
    return new Response(null, { status: 302, headers: { Location: u.toString() } });
  };
  if (!st || !isProvider(st.provider)) return new Response('This sign-in link has expired. Go back to Gymi and try again.', { status: 400 });
  if (Date.now() - new Date(st.created_at).getTime() > 10 * 60_000) return back(st.return_to, { wearable: st.provider, status: 'expired' });
  const code = url.searchParams.get('code');
  if (!code) return back(st.return_to, { wearable: st.provider, status: url.searchParams.get('error') === 'access_denied' ? 'denied' : 'error' });
  try {
    const t = await tokenRequest(st.provider, { grant_type: 'authorization_code', code, redirect_uri: SELF });
    // Who this is on the wearable's side (to spot the same band linked twice later).
    let who: string | null = null;
    try {
      const r = await fetch(st.provider === 'whoop' ? `${PROVIDERS.whoop.api}/v2/user/profile/basic` : `${PROVIDERS.oura.api}/v2/usercollection/personal_info`, { headers: { Authorization: `Bearer ${t.access_token}` } });
      const j = await r.json();
      who = String(j.user_id ?? j.id ?? '') || null;
    } catch {}
    const link = { user_id: st.user_id, provider: st.provider, provider_user: who, access_token: t.access_token, refresh_token: t.refresh_token ?? null, expires_at: expiry(t.expires_in), scopes: t.scope ?? PROVIDERS[st.provider].scope, status: 'ok', last_error: null };
    const { error } = await db.from('device_links').upsert(link, { onConflict: 'user_id,provider' });
    if (error) throw new Error(error.message);
    // The last month right away, so there's something to see.
    await syncLink(db, { ...link, last_sync: null } as Link, 30).catch((e) => console.error('first sync', String(e)));
    return back(st.return_to, { wearable: st.provider, status: 'linked' });
  } catch (e) {
    console.error('callback', String(e));
    return back(st.return_to, { wearable: st.provider, status: 'error' });
  }
}

// ---------------------------------------------------------------------------
// The app's requests
// ---------------------------------------------------------------------------
// Tests import this file to check the mapping (WEARABLES_TEST=1), without starting the server.
export { localDay, ouraDays, whoopDays };
if (!Deno.env.get('WEARABLES_TEST')) Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const url = new URL(req.url);
  if (req.method === 'GET') {
    if (url.searchParams.has('state')) return callback(url);
    return new Response('ok');
  }
  if (req.method !== 'POST') return json({ error: 'method' }, 405);
  try {
    const db = admin();
    const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
    const { data: u, error: ue } = await db.auth.getUser(token);
    if (ue || !u.user) return json({ error: 'auth' }, 401);
    const uid = u.user.id;
    const body = await req.json().catch(() => ({}));

    if (body.action === 'status') {
      const { data } = await db.from('device_links').select('provider,status,last_sync,created_at').eq('user_id', uid);
      return json({ configured: { whoop: configured('whoop'), oura: configured('oura') }, links: data ?? [] });
    }

    if (body.action === 'start') {
      if (!isProvider(body.provider)) return json({ error: 'provider' }, 400);
      if (!configured(body.provider)) return json({ error: 'not_set_up' }, 503);
      const returnTo = String(body.return_to ?? '');
      if (!RETURN_OK.test(returnTo)) return json({ error: 'return_to' }, 400);
      const cfg = PROVIDERS[body.provider as Provider];
      const state = randomState(cfg.stateLen);
      await db.rpc('clean_oauth_states');
      const { error } = await db.from('oauth_states').insert({ state, user_id: uid, provider: body.provider, return_to: returnTo });
      if (error) return json({ error: 'failed' }, 500);
      const a = new URL(cfg.auth);
      a.search = new URLSearchParams({ response_type: 'code', client_id: env(cfg.id), redirect_uri: SELF, scope: cfg.scope, state }).toString();
      return json({ url: a.toString() });
    }

    if (body.action === 'sync') {
      const { data: links } = await db.from('device_links').select('user_id,provider,access_token,refresh_token,expires_at,last_sync').eq('user_id', uid);
      const out: Record<string, number | string> = {};
      for (const l of (links ?? []) as Link[]) {
        if (isProvider(body.provider) && l.provider !== body.provider) continue;
        if (!configured(l.provider)) continue;
        // A week back (a month the first time), so late-scored nights are filled in too.
        const n = Math.min(60, Math.max(2, Number(body.days) || (l.last_sync ? 7 : 30)));
        try {
          out[l.provider] = await syncLink(db, l, n);
        } catch (e) {
          out[l.provider] = (e as Error).message === 'expired' || (e as Error).message === 'unauthorized' ? 'expired' : 'error';
        }
      }
      return json({ result: out });
    }

    if (body.action === 'disconnect') {
      if (!isProvider(body.provider)) return json({ error: 'provider' }, 400);
      const { data: l } = await db.from('device_links').select('access_token').eq('user_id', uid).eq('provider', body.provider).maybeSingle();
      // Tell the wearable too (best effort), then forget the keys and the data that came from it.
      if (l?.access_token) await PROVIDERS[body.provider as Provider].revoke?.(l.access_token).catch(() => {});
      await db.from('device_links').delete().eq('user_id', uid).eq('provider', body.provider);
      await db.from('wearable_days').delete().eq('user_id', uid).eq('provider', body.provider);
      return json({ ok: true });
    }

    return json({ error: 'action' }, 400);
  } catch (e) {
    console.error(String(e));
    return json({ error: 'failed' }, 500);
  }
});
