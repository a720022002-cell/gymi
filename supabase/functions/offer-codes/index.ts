// Adro+ free codes (Apple Offer Codes), for admins only: list them, make a named code or a batch of one-time codes
// with the free time you pick, download a batch, or turn a named code off. Everything is made at Apple through the
// App Store Connect API, so redeeming a code is an ordinary App Store subscription (RevenueCat and our webhook see it
// like any purchase; after the free time it renews at the normal price unless cancelled).
//
// Secrets (Supabase > Edge Functions > Secrets):
//   ASC_KEY_ID        App Store Connect API key id (Users and Access > Integrations > App Store Connect API, role Admin)
//   ASC_ISSUER_ID     the issuer id shown on that page
//   ASC_PRIVATE_KEY   the .p8 file's text (-----BEGIN PRIVATE KEY----- ...)
//   ASC_APP_ID        Adro's Apple ID in App Store Connect (default 6826500429)
import { createClient } from 'npm:@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
const env = (k: string, d = '') => Deno.env.get(k) ?? d;
const admin = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false } });

/** Our two plans in App Store Connect. */
const PRODUCTS = { monthly: 'adro_monthly', yearly: 'adro_yearly' } as const;
const DURATIONS = ['THREE_DAYS', 'ONE_WEEK', 'TWO_WEEKS', 'ONE_MONTH', 'TWO_MONTHS', 'THREE_MONTHS', 'SIX_MONTHS', 'ONE_YEAR'];
const WHO = ['NEW', 'EXISTING', 'EXPIRED'];

// --- App Store Connect API ------------------------------------------------------------------------------------------

const b64url = (b: ArrayBuffer | Uint8Array | string) => {
  const bytes = typeof b === 'string' ? new TextEncoder().encode(b) : new Uint8Array(b);
  let s = '';
  bytes.forEach((x) => (s += String.fromCharCode(x)));
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};
let token: { jwt: string; exp: number } | null = null;
/** A short-lived token signed with the .p8 key (ES256), as Apple asks. */
async function ascToken() {
  const now = Math.floor(Date.now() / 1000);
  if (token && token.exp - 60 > now) return token.jwt;
  const pem = env('ASC_PRIVATE_KEY').replace(/\\n/g, '\n').replace(/-----[^-]+-----/g, '').replace(/\s+/g, '');
  const der = Uint8Array.from(atob(pem), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey('pkcs8', der, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const exp = now + 15 * 60;
  const head = b64url(JSON.stringify({ alg: 'ES256', kid: env('ASC_KEY_ID'), typ: 'JWT' }));
  const body = b64url(JSON.stringify({ iss: env('ASC_ISSUER_ID'), iat: now, exp, aud: 'appstoreconnect-v1' }));
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, new TextEncoder().encode(`${head}.${body}`));
  token = { jwt: `${head}.${body}.${b64url(sig)}`, exp };
  return token.jwt;
}

async function asc(path: string, init: { method?: string; body?: unknown; raw?: boolean } = {}) {
  const r = await fetch(`https://api.appstoreconnect.apple.com${path}`, {
    method: init.method ?? 'GET',
    headers: { Authorization: `Bearer ${await ascToken()}`, 'Content-Type': 'application/json' },
    body: init.body ? JSON.stringify(init.body) : undefined,
  });
  if (init.raw && r.ok) return r.text();
  const data = r.status === 204 ? null : await r.json().catch(() => null);
  if (!r.ok) {
    const e = data?.errors?.[0];
    throw new Error(e ? `${e.title}: ${e.detail ?? ''}`.slice(0, 300) : `apple ${r.status}`);
  }
  return data;
}

/** Our two subscriptions' Apple ids, by product id. */
async function subscriptions(): Promise<Record<string, string>> {
  const groups = await asc(`/v1/apps/${env('ASC_APP_ID', '6826500429')}/subscriptionGroups?include=subscriptions&limit=50`);
  const out: Record<string, string> = {};
  for (const s of groups?.included ?? []) if (s.type === 'subscriptions') out[s.attributes?.productId] = s.id;
  return out;
}

/** Every country the plan is sold in (a free offer needs the same list, with no price). */
async function territories(subId: string): Promise<string[]> {
  const ids = new Set<string>();
  let next: string | null = `/v1/subscriptions/${subId}/prices?include=territory&limit=200`;
  while (next) {
    const page = await asc(next);
    for (const p of page?.data ?? []) {
      const t = p.relationships?.territory?.data?.id;
      if (t) ids.add(t);
    }
    const n: string | undefined = page?.links?.next;
    next = n ? n.replace('https://api.appstoreconnect.apple.com', '') : null;
  }
  return [...ids];
}

// --- Actions --------------------------------------------------------------------------------------------------------

/** All offers with their named codes and one-time batches, and how many people subscribed with each code. */
async function list() {
  const subs = await subscriptions();
  const used = new Map<string, number>();
  const { data: ev } = await admin.from('subscription_events').select('body').eq('type', 'INITIAL_PURCHASE').not('body->>offer_code', 'is', null).limit(5000);
  for (const e of ev ?? []) {
    const c = String((e.body as { offer_code?: string })?.offer_code ?? '').toUpperCase();
    if (c) used.set(c, (used.get(c) ?? 0) + 1);
  }
  const offers = [];
  for (const [plan, product] of Object.entries(PRODUCTS)) {
    const id = subs[product];
    if (!id) continue;
    const page = await asc(`/v1/subscriptions/${id}/offerCodes?limit=200`);
    for (const o of page?.data ?? []) {
      const [custom, batches] = await Promise.all([asc(`/v1/subscriptionOfferCodes/${o.id}/customCodes?limit=200`), asc(`/v1/subscriptionOfferCodes/${o.id}/oneTimeUseCodes?limit=200`)]);
      offers.push({
        id: o.id,
        plan,
        name: o.attributes?.name,
        duration: o.attributes?.duration,
        who: o.attributes?.customerEligibilities ?? [],
        custom: (custom?.data ?? []).map((c: { id: string; attributes: Record<string, unknown> }) => ({
          id: c.id,
          code: c.attributes.customCode,
          limit: c.attributes.numberOfCodes,
          expires: c.attributes.expirationDate ?? null,
          active: c.attributes.active,
          created: c.attributes.createdDate,
          used: used.get(String(c.attributes.customCode ?? '').toUpperCase()) ?? 0,
        })),
        batches: (batches?.data ?? []).map((b: { id: string; attributes: Record<string, unknown> }) => ({
          id: b.id,
          count: b.attributes.numberOfCodes,
          expires: b.attributes.expirationDate ?? null,
          active: b.attributes.active,
          env: b.attributes.environment ?? 'PRODUCTION',
          created: b.attributes.createdDate,
        })),
      });
    }
  }
  return { offers, ready: !!subs[PRODUCTS.monthly] || !!subs[PRODUCTS.yearly] };
}

type Create = { kind: 'custom' | 'onetime'; plan: 'monthly' | 'yearly'; duration: string; code?: string; count: number; expires?: string | null; who?: string[]; sandbox?: boolean };

/** A free offer (the free time you picked) on a plan, then its named code or its batch of one-time codes. */
async function create(b: Create) {
  if (!DURATIONS.includes(b.duration)) throw new Error('duration');
  const who = (b.who?.length ? b.who : ['NEW', 'EXPIRED']).filter((w) => WHO.includes(w));
  const count = Math.round(Number(b.count));
  const code = String(b.code ?? '').toUpperCase().trim();
  if (b.kind === 'custom' && !/^[A-Z0-9]{3,64}$/.test(code)) throw new Error('code');
  if (b.kind === 'custom' ? !(count >= 1 && count <= 25000) : !(count >= 500 && count <= 25000)) throw new Error('count');
  const expires = b.expires && /^\d{4}-\d{2}-\d{2}$/.test(b.expires) ? b.expires : null;
  if (b.kind === 'onetime' && !expires) throw new Error('expires');

  const subs = await subscriptions();
  const subId = subs[PRODUCTS[b.plan] ?? ''];
  if (!subId) throw new Error('no_plan');
  const lands = await territories(subId);
  const offer = await asc('/v1/subscriptionOfferCodes', {
    method: 'POST',
    body: {
      data: {
        type: 'subscriptionOfferCodes',
        attributes: {
          name: (b.kind === 'custom' ? code : `Batch ${new Date().toISOString().slice(0, 10)}`).slice(0, 64),
          customerEligibilities: who,
          offerEligibility: 'STACK_WITH_INTRO_OFFERS',
          duration: b.duration,
          offerMode: 'FREE_TRIAL',
          numberOfPeriods: 1,
        },
        relationships: {
          subscription: { data: { type: 'subscriptions', id: subId } },
          prices: { data: lands.map((_, i) => ({ type: 'subscriptionOfferCodePrices', id: `\${p${i}}` })) },
        },
      },
      included: lands.map((t, i) => ({ type: 'subscriptionOfferCodePrices', id: `\${p${i}}`, relationships: { territory: { data: { type: 'territories', id: t } } } })),
    },
  });
  const offerId = offer?.data?.id;
  if (b.kind === 'custom') {
    const c = await asc('/v1/subscriptionOfferCodeCustomCodes', {
      method: 'POST',
      body: { data: { type: 'subscriptionOfferCodeCustomCodes', attributes: { customCode: code, numberOfCodes: count, ...(expires ? { expirationDate: expires } : {}) }, relationships: { offerCode: { data: { type: 'subscriptionOfferCodes', id: offerId } } } } },
    });
    return { offer: offerId, code, id: c?.data?.id };
  }
  const batch = await asc('/v1/subscriptionOfferCodeOneTimeUseCodes', {
    method: 'POST',
    body: { data: { type: 'subscriptionOfferCodeOneTimeUseCodes', attributes: { numberOfCodes: count, expirationDate: expires, environment: b.sandbox ? 'SANDBOX' : 'PRODUCTION' }, relationships: { offerCode: { data: { type: 'subscriptionOfferCodes', id: offerId } } } } },
  });
  return { offer: offerId, batch: batch?.data?.id };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const auth = req.headers.get('Authorization') ?? '';
    const { data: u } = await admin.auth.getUser(auth.replace(/^Bearer\s+/i, ''));
    if (!u?.user) return json({ error: 'auth' }, 401);
    const { data: isAdmin } = await admin.from('admins').select('user_id').eq('user_id', u.user.id).maybeSingle();
    if (!isAdmin) return json({ error: 'auth' }, 403);
    if (!env('ASC_KEY_ID') || !env('ASC_ISSUER_ID') || !env('ASC_PRIVATE_KEY')) return json({ error: 'not_set_up' }, 503);

    const b = await req.json().catch(() => ({}));
    if (b.action === 'list') return json(await list());
    if (b.action === 'create') return json(await create(b as Create));
    // A batch of one-time codes as a CSV file (Apple makes them a few minutes after the request).
    if (b.action === 'values' && typeof b.id === 'string') return json({ csv: await asc(`/v1/subscriptionOfferCodeOneTimeUseCodes/${encodeURIComponent(b.id)}/values`, { raw: true }) });
    if (b.action === 'stop' && typeof b.id === 'string') {
      const kind = b.batch ? 'subscriptionOfferCodeOneTimeUseCodes' : 'subscriptionOfferCodeCustomCodes';
      await asc(`/v1/${kind}/${encodeURIComponent(b.id)}`, { method: 'PATCH', body: { data: { type: kind, id: b.id, attributes: { active: false } } } });
      return json({ ok: true });
    }
    return json({ error: 'action' }, 400);
  } catch (e) {
    const m = (e as Error).message;
    console.error('offer-codes', m);
    return json({ error: ['duration', 'code', 'count', 'expires', 'no_plan'].includes(m) ? m : 'apple', detail: m.slice(0, 300) }, 400);
  }
});
