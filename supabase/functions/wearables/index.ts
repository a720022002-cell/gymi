// Adro wearables: connect WHOOP, Oura or Polar with their own sign-in (OAuth), then pull daily summaries into
// wearable_days. Runs on the server only: the keys the wearable gives us are kept in device_links and never
// reach the app. Client ids and secrets are Edge Function secrets (WHOOP_CLIENT_ID, WHOOP_CLIENT_SECRET,
// OURA_CLIENT_ID, OURA_CLIENT_SECRET, POLAR_CLIENT_ID, POLAR_CLIENT_SECRET); without them a wearable shows as
// "not set up yet".
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

type Provider = 'whoop' | 'oura' | 'polar';
const PROVIDERS: Record<Provider, { auth: string; token: string; api: string; scope: string; id: string; secret: string; stateLen: number; basic?: boolean; revoke?: (t: string, who: string | null) => Promise<unknown> }> = {
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
  // Polar AccessLink v3: one scope for everything; the key lasts about a year and has no refresh (sign in again then).
  polar: {
    auth: 'https://flow.polar.com/oauth2/authorization',
    token: 'https://polarremote.com/v2/oauth2/token',
    api: 'https://www.polaraccesslink.com',
    scope: 'accesslink.read_all',
    id: 'POLAR_CLIENT_ID',
    secret: 'POLAR_CLIENT_SECRET',
    stateLen: 32,
    // Polar wants the client id and secret in a Basic header, not in the form.
    basic: true,
    // Deleting the user on Polar's side also takes the key back.
    revoke: (t, who) => (who ? fetch(`https://www.polaraccesslink.com/v3/users/${encodeURIComponent(who)}`, { method: 'DELETE', headers: { Authorization: `Bearer ${t}` } }) : Promise.resolve()),
  },
};
const isProvider = (p: unknown): p is Provider => p === 'whoop' || p === 'oura' || p === 'polar';
const configured = (p: Provider) => !!env(PROVIDERS[p].id) && !!env(PROVIDERS[p].secret);

// Where the browser may be sent back after signing in: the Adro website, the phone app, or a local test server.
const RETURN_OK = /^(https:\/\/(gymi-inky\.vercel\.app|adroapp\.com)|adro:\/\/|exp\+adro:\/\/|http:\/\/(localhost|127\.0\.0\.1)(:\d+)?)(\/|$)/;

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
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
      ...(cfg.basic ? { Authorization: `Basic ${btoa(`${env(cfg.id)}:${env(cfg.secret)}`)}` } : {}),
    },
    body: new URLSearchParams(cfg.basic ? body : { ...body, client_id: env(cfg.id), client_secret: env(cfg.secret) }),
    signal: AbortSignal.timeout(20_000),
  });
  const j = await res.json().catch(() => null);
  if (!res.ok || !j?.access_token) throw new Error(`token ${res.status}: ${JSON.stringify(j ?? {}).slice(0, 200)}`);
  return j as { access_token: string; refresh_token?: string; expires_in?: number; scope?: string; x_user_id?: number | string };
}

const expiry = (s?: number) => (s ? new Date(Date.now() + s * 1000).toISOString() : null);

/** A working access key: refreshed a minute before it runs out. A refused refresh marks the link "expired". */
async function accessToken(db: SupabaseClient, l: Link) {
  if (!l.expires_at || new Date(l.expires_at).getTime() - 60_000 > Date.now()) return l.access_token;
  // Polar has no refresh: after about a year the person signs in again.
  if (!l.refresh_token) {
    await db.from('device_links').update({ status: 'expired', last_error: 'key ran out' }).eq('user_id', l.user_id).eq('provider', l.provider);
    throw new Error('expired');
  }
  try {
    const t = await tokenRequest(l.provider, { grant_type: 'refresh_token', refresh_token: l.refresh_token, ...(l.provider === 'whoop' ? { scope: 'offline' } : {}) });
    // The old refresh token stops working once a new one is issued, so it's saved right away (only if nobody else
    // refreshed it in the meantime).
    await db.from('device_links').update({ access_token: t.access_token, refresh_token: t.refresh_token ?? l.refresh_token, expires_at: expiry(t.expires_in), status: 'ok', last_error: null }).eq('user_id', l.user_id).eq('provider', l.provider).eq('refresh_token', l.refresh_token);
    l.access_token = t.access_token;
    l.refresh_token = t.refresh_token ?? l.refresh_token;
    return t.access_token;
  } catch (e) {
    // The scheduled sync and the app can refresh at the same moment: if the other one already got a new key, use it.
    const { data: now } = await db.from('device_links').select('access_token,refresh_token,expires_at').eq('user_id', l.user_id).eq('provider', l.provider).maybeSingle();
    if (now && now.refresh_token !== l.refresh_token && now.expires_at && new Date(now.expires_at).getTime() > Date.now()) {
      Object.assign(l, now);
      return now.access_token as string;
    }
    // Only a refused key means signing in again; a timeout or a server error is tried again later.
    const refused = /token (400|401)/.test(String(e));
    await db.from('device_links').update({ status: refused ? 'expired' : 'error', last_error: String(e).slice(0, 300) }).eq('user_id', l.user_id).eq('provider', l.provider);
    throw new Error(refused ? 'expired' : 'failed');
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
  active_kcal?: number | null; workouts?: { type: string; minutes: number; kcal: number; avg_hr?: number | null; max_hr?: number | null }[];
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
    // A cycle starts when you fall asleep: it belongs to the day you wake into (6 hours later lands there).
    const d = at(localDay(new Date(Date.parse(c.start) + 6 * 36e5).toISOString(), c.timezone_offset));
    d.strain = num(c.score.strain) != null ? r1(c.score.strain as number) : null;
    d.hr_avg = num(c.score.average_heart_rate) != null ? Math.round(c.score.average_heart_rate as number) : null;
    if (num(c.step_count) != null) d.steps = Math.round(c.step_count as number);
  }
  for (const w of wos as { start: string; end: string; timezone_offset?: string; sport_name?: string; score?: Record<string, unknown> }[]) {
    const minutes = Math.round((Date.parse(w.end) - Date.parse(w.start)) / 6e4);
    if (!(minutes > 0)) continue;
    const hr = (k: string) => (num(w.score?.[k]) != null ? Math.round(w.score![k] as number) : null);
    at(localDay(w.start, w.timezone_offset)).workouts!.push({ type: String(w.sport_name ?? 'Workout'), minutes, kcal: num(w.score?.kilojoule) != null ? Math.round((w.score!.kilojoule as number) / 4.184) : 0, avg_hr: hr('average_heart_rate'), max_hr: hr('max_heart_rate') });
  }
  return days;
}

async function ouraDays(token: string, from: Date) {
  const start_date = from.toISOString().slice(0, 10);
  // The end day isn't included: tomorrow, so today counts.
  const end_date = new Date(Date.now() + 864e5).toISOString().slice(0, 10);
  const q = { start_date, end_date };
  // A missing list is skipped, but a key that was taken back stops the sync (so the link shows "sign in again").
  const get = (path: string) =>
    all('oura', token, `/v2/usercollection/${path}`, q).catch((e) => {
      if ((e as Error).message === 'unauthorized') throw e;
      return [] as Record<string, unknown>[];
    });
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

/** "PT1H2M3.5S" (ISO 8601) in minutes. */
const isoMinutes = (d: string) => {
  const m = /^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:([\d.]+)S)?$/.exec(d ?? '');
  return m ? Math.round((Number(m[1] ?? 0) * 24 + Number(m[2] ?? 0)) * 60 + Number(m[3] ?? 0) + Number(m[4] ?? 0) / 60) : 0;
};

async function polarDays(token: string, from: Date) {
  const get = async (path: string, q: Record<string, string> = {}) => {
    const u = new URL(PROVIDERS.polar.api + path);
    for (const [k, v] of Object.entries(q)) u.searchParams.set(k, v);
    const res = await fetch(u, { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' }, signal: AbortSignal.timeout(20_000) });
    if (res.status === 401) throw new Error('unauthorized');
    if (res.status === 204 || res.status === 404) return null;
    if (!res.ok) throw new Error(`${path} ${res.status}`);
    return res.json();
  };
  // Polar keeps 28 days for these.
  const start = new Date(Math.max(from.getTime(), Date.now() - 27 * 864e5)).toISOString().slice(0, 10);
  const end = new Date().toISOString().slice(0, 10);
  const soft = (p: Promise<unknown>) => p.catch((e) => ((e as Error).message === 'unauthorized' ? Promise.reject(e) : null));
  const [acts, sleep, recharge, ex, skin] = (await Promise.all([
    soft(get('/v3/users/activities', { from: start, to: end })),
    soft(get('/v3/users/sleep')),
    soft(get('/v3/users/nightly-recharge')),
    soft(get('/v3/exercises')),
    soft(get('/v3/users/biosensing/skintemperature', { from: start, to: end })),
  ])) as [unknown, { nights?: Record<string, unknown>[] } | null, { recharges?: Record<string, unknown>[] } | null, unknown, unknown];
  const list = (v: unknown, key?: string) => (Array.isArray(v) ? v : key && v && Array.isArray((v as Record<string, unknown>)[key]) ? ((v as Record<string, unknown>)[key] as unknown[]) : []) as Record<string, unknown>[];
  const days = new Map<string, Day>();
  const at = (d: string) => days.get(d) ?? (days.set(d, { workouts: [] }), days.get(d)!);
  const inRange = (d: string) => d >= start;
  // Times come in the watch's local time, so the first 10 characters are the local day.
  for (const a of list(acts, 'activities')) {
    const day = String(a.start_time ?? a.date ?? '').slice(0, 10);
    if (!inRange(day)) continue;
    Object.assign(at(day), { steps: num(a.steps), active_kcal: num(a.active_calories) });
  }
  for (const n of sleep?.nights ?? []) {
    const end = String(n.sleep_end_time ?? '');
    const day = end ? end.slice(0, 10) : String(n.date ?? '');
    if (!inRange(day)) continue;
    const secs = (num(n.light_sleep) ?? 0) + (num(n.deep_sleep) ?? 0) + (num(n.rem_sleep) ?? 0);
    const bed = n.sleep_start_time && end ? (Date.parse(end) - Date.parse(String(n.sleep_start_time))) / 3.6e6 : null;
    Object.assign(at(day), {
      sleep_h: secs ? r1(secs / 3600) : null,
      in_bed_h: bed != null && bed > 0 ? r1(bed) : null,
      sleep_eff: secs && bed ? Math.min(100, Math.round((secs / 3600 / bed) * 100)) : null,
      sleep_score: num(n.sleep_score) != null ? Math.round(n.sleep_score as number) : null,
    });
  }
  // Nightly Recharge: HRV and heart rate while asleep (Polar has no daily resting heart rate; this is the closest).
  for (const r of recharge?.recharges ?? []) {
    const day = String(r.date ?? '');
    if (!inRange(day)) continue;
    Object.assign(at(day), { hrv: num(r.heart_rate_variability_avg) != null ? r1(r.heart_rate_variability_avg as number) : null, hr_rest: num(r.heart_rate_avg) != null ? Math.round(r.heart_rate_avg as number) : null });
  }
  for (const e of list(ex)) {
    const day = String(e.start_time ?? '').slice(0, 10);
    const minutes = isoMinutes(String(e.duration ?? ''));
    if (!inRange(day) || !(minutes > 0)) continue;
    const hr = (e.heart_rate ?? {}) as Record<string, unknown>;
    at(day).workouts!.push({ type: String(e.detailed_sport_info ?? e.sport ?? 'Workout').toLowerCase(), minutes, kcal: Math.round(num(e.calories) ?? 0), avg_hr: num(hr.average) != null ? Math.round(hr.average as number) : null, max_hr: num(hr.maximum) != null ? Math.round(hr.maximum as number) : null });
  }
  for (const t of list(skin)) {
    const day = String(t.sleep_date ?? '');
    const dev = num(t.deviation_from_baseline_celsius);
    if (inRange(day) && dev != null) at(day).temp_dev = r1(dev);
  }
  return days;
}

/** Pull the last `n` days from one wearable and save them. Returns how many days were saved. */
async function syncLink(db: SupabaseClient, l: Link, n: number) {
  const token = await accessToken(db, l);
  const from = new Date(Date.now() - n * 864e5);
  let days: Map<string, Day>;
  try {
    days = l.provider === 'whoop' ? await whoopDays(token, from) : l.provider === 'oura' ? await ouraDays(token, from) : await polarDays(token, from);
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
  const { data: st } = await db.from('oauth_states').select('user_id,provider,return_to,created_at,pending').eq('state', state).is('pending', null).maybeSingle();
  const back = (to: string, q: Record<string, string>) => {
    const u = new URL(to);
    for (const [k, v] of Object.entries(q)) u.searchParams.set(k, v);
    return new Response(null, { status: 302, headers: { Location: u.toString() } });
  };
  if (!st || !isProvider(st.provider)) return new Response('This sign-in link has expired. Go back to Adro and try again.', { status: 400 });
  const drop = () => db.from('oauth_states').delete().eq('state', state);
  if (Date.now() - new Date(st.created_at).getTime() > 10 * 60_000) return (await drop(), back(st.return_to, { wearable: st.provider, status: 'expired' }));
  const code = url.searchParams.get('code');
  if (!code) return (await drop(), back(st.return_to, { wearable: st.provider, status: url.searchParams.get('error') === 'access_denied' ? 'denied' : 'error' }));
  try {
    const t = await tokenRequest(st.provider, { grant_type: 'authorization_code', code, redirect_uri: SELF });
    // Who this is on the wearable's side (to spot the same band linked twice later).
    let who: string | null = t.x_user_id != null ? String(t.x_user_id) : null;
    if (st.provider === 'polar') {
      // Polar needs the person registered with Adro's app before any data comes (409: already registered).
      const r = await fetch(`${PROVIDERS.polar.api}/v3/users`, { method: 'POST', headers: { Authorization: `Bearer ${t.access_token}`, 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify({ 'member-id': st.user_id }) });
      if (!r.ok && r.status !== 409) throw new Error(`polar register ${r.status}`);
    } else {
      try {
        const r = await fetch(st.provider === 'whoop' ? `${PROVIDERS.whoop.api}/v2/user/profile/basic` : `${PROVIDERS.oura.api}/v2/usercollection/personal_info`, { headers: { Authorization: `Bearer ${t.access_token}` } });
        const j = await r.json();
        who = String(j.user_id ?? j.id ?? '') || null;
      } catch {}
    }
    // The keys wait here until the app that started this, signed in as the same person, confirms it ("finish").
    // A sign-in link sent to someone else can't put their band on the sender's account.
    const pending = { provider_user: who, access_token: t.access_token, refresh_token: t.refresh_token ?? null, expires_at: expiry(t.expires_in), scopes: t.scope ?? PROVIDERS[st.provider].scope };
    const { error } = await db.from('oauth_states').update({ pending }).eq('state', state);
    if (error) throw new Error(error.message);
    return back(st.return_to, { wearable: st.provider, status: 'finish', state });
  } catch (e) {
    console.error('callback', String(e));
    await drop();
    return back(st.return_to, { wearable: st.provider, status: 'error' });
  }
}

/** The app confirms a sign-in it started: only the same signed-in person gets the link. */
async function finish(db: SupabaseClient, uid: string, state: string) {
  const { data: st } = await db.from('oauth_states').delete().eq('state', state).not('pending', 'is', null).select('user_id,provider,created_at,pending').maybeSingle();
  if (!st || !isProvider(st.provider)) return 'expired';
  if (st.user_id !== uid) return 'error';
  if (Date.now() - new Date(st.created_at).getTime() > 30 * 60_000) return 'expired';
  const link = { user_id: uid, provider: st.provider, ...(st.pending as Record<string, unknown>), status: 'ok', last_error: null };
  const { error } = await db.from('device_links').upsert(link, { onConflict: 'user_id,provider' });
  if (error) throw new Error(error.message);
  // The last month right away, so there's something to see.
  await syncLink(db, { ...link, last_sync: null } as unknown as Link, 30).catch((e) => console.error('first sync', String(e)));
  return 'linked';
}

// ---------------------------------------------------------------------------
// Scheduled sync
// ---------------------------------------------------------------------------
/** Links not synced for 3 hours, oldest first: the last 3 days each, for at most 100 seconds per run. */
async function cronSync(db: SupabaseClient) {
  const since = new Date(Date.now() - 3 * 36e5).toISOString();
  // Links that failed for a passing reason (a timeout, the maker's server down) are tried again when their last good
  // sync is over 6 hours old.
  const errSince = new Date(Date.now() - 6 * 36e5).toISOString();
  const { data } = await db.from('device_links').select('user_id,provider,access_token,refresh_token,expires_at,last_sync').or(`and(status.eq.ok,or(last_sync.is.null,last_sync.lt.${since})),and(status.eq.error,or(last_sync.is.null,last_sync.lt.${errSince}))`).order('last_sync', { ascending: true, nullsFirst: true }).limit(60);
  const stop = Date.now() + 100_000;
  let ok = 0;
  let failed = 0;
  for (const l of (data ?? []) as Link[]) {
    if (Date.now() > stop) break;
    if (!isProvider(l.provider) || !configured(l.provider)) continue;
    try {
      await syncLink(db, l, 3);
      ok++;
    } catch {
      failed++;
    }
  }
  return { ok, failed, waiting: Math.max(0, (data?.length ?? 0) - ok - failed) };
}

// ---------------------------------------------------------------------------
// The app's requests
// ---------------------------------------------------------------------------
// Tests import this file to check the mapping (WEARABLES_TEST=1), without starting the server.
export { isoMinutes, localDay, ouraDays, polarDays, whoopDays };
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
    // The database's scheduler (every 3 hours): bring every linked wearable up to date, so the coach and the morning
    // note have last night's data even if the app wasn't opened. Only with the scheduler's own secret.
    const cronSecret = env('WEARABLES_CRON_SECRET');
    if (cronSecret && req.headers.get('x-cron-secret') === cronSecret) return json(await cronSync(db));
    const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
    const { data: u, error: ue } = await db.auth.getUser(token);
    if (ue || !u.user) return json({ error: 'auth' }, 401);
    const uid = u.user.id;
    const body = await req.json().catch(() => ({}));

    if (body.action === 'status') {
      const { data } = await db.from('device_links').select('provider,status,last_sync,created_at').eq('user_id', uid);
      return json({ configured: { whoop: configured('whoop'), oura: configured('oura'), polar: configured('polar') }, links: data ?? [] });
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

    if (body.action === 'finish') {
      return json({ status: await finish(db, uid, String(body.state ?? '')) });
    }

    if (body.action === 'sync') {
      const { data: links } = await db.from('device_links').select('user_id,provider,access_token,refresh_token,expires_at,last_sync').eq('user_id', uid);
      const out: Record<string, number | string> = {};
      for (const l of (links ?? []) as Link[]) {
        if (isProvider(body.provider) && l.provider !== body.provider) continue;
        if (!configured(l.provider)) continue;
        // Not again within a minute (each sync is many calls to the maker, shared by everyone).
        if (l.last_sync && Date.now() - new Date(l.last_sync).getTime() < 60_000) {
          out[l.provider] = 0;
          continue;
        }
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
      const { data: l } = await db.from('device_links').select('access_token,provider_user').eq('user_id', uid).eq('provider', body.provider).maybeSingle();
      // Tell the wearable too (best effort), then forget the keys and the data that came from it.
      if (l?.access_token) await PROVIDERS[body.provider as Provider].revoke?.(l.access_token, l.provider_user ?? null).catch(() => {});
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
