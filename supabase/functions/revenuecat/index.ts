// RevenueCat → Adro: keeps public.subscriptions right when someone subscribes, renews, cancels, gets a refund or
// moves their purchase to another account. RevenueCat calls this on every subscription event (webhook).
//
// The event only says "something changed for this person": the real state is then read from RevenueCat itself
// (the "adro_plus" entitlement), so renewals, refunds, transfers and events arriving twice or out of order can't
// leave someone with the wrong access.
//
// Secrets (Supabase > Edge Functions > Secrets):
//   REVENUECAT_WEBHOOK_SECRET  the Authorization value set on the webhook in RevenueCat (any long random text)
//   REVENUECAT_API_KEY         RevenueCat secret API key (Project settings > API keys > Secret), never in the app
// Deploy without JWT check (RevenueCat isn't a signed-in user); the secret header guards it.
import { createClient } from 'npm:@supabase/supabase-js@2';

const ENTITLEMENT = 'adro_plus';
const env = (k: string) => Deno.env.get(k) ?? '';
const admin = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false } });
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Constant-time compare, so the secret can't be guessed from timing. */
function same(a: string, b: string) {
  if (!a || !b || a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

/** Reads one person's subscription from RevenueCat and saves it. Our app user id is the Supabase user id. */
async function refresh(userId: string, eventType: string) {
  const r = await fetch(`https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(userId)}`, {
    headers: { Authorization: `Bearer ${env('REVENUECAT_API_KEY')}` },
  });
  if (!r.ok) throw new Error(`revenuecat ${r.status}`);
  const sub = (await r.json())?.subscriber ?? {};
  const ent = sub.entitlements?.[ENTITLEMENT];
  const expires = ent?.expires_date ? new Date(ent.expires_date) : null;
  const active = !!ent && (!expires || expires.getTime() > Date.now());
  const product: string | null = ent?.product_identifier ?? null;
  const s = product ? sub.subscriptions?.[product] : null;
  const row = {
    user_id: userId,
    active,
    product,
    period: product ? (/year|annual/i.test(product) ? 'yearly' : 'monthly') : null,
    expires_at: expires ? expires.toISOString() : null,
    will_renew: !!s && !s.unsubscribe_detected_at && !s.billing_issues_detected_at,
    store: s?.store ?? null,
    last_event: eventType,
    updated_at: new Date().toISOString(),
  };
  const { error } = await admin.from('subscriptions').upsert(row);
  // Someone whose account was deleted: nothing to keep.
  if (error && !/foreign key/i.test(error.message)) throw new Error(error.message);
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('method', { status: 405 });
  const auth = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (!same(auth, env('REVENUECAT_WEBHOOK_SECRET'))) return new Response('auth', { status: 401 });

  const body = await req.json().catch(() => null);
  const ev = body?.event;
  if (!ev?.type) return new Response('no event', { status: 400 });
  if (ev.type === 'TEST') return new Response('ok');

  // Every account this event touches (a transfer moves the purchase from some accounts to others).
  const ids = new Set<string>(
    [ev.app_user_id, ev.original_app_user_id, ...(ev.aliases ?? []), ...(ev.transferred_from ?? []), ...(ev.transferred_to ?? [])]
      .filter((x): x is string => typeof x === 'string' && UUID.test(x)),
  );
  // RevenueCat may send the same event twice: the second time is only acknowledged.
  if (ev.id) {
    const { error } = await admin.from('subscription_events').insert({ id: String(ev.id), user_id: [...ids][0] ?? null, type: String(ev.type), body: ev });
    if (error?.code === '23505') return new Response('ok');
  }
  try {
    for (const id of ids) await refresh(id, String(ev.type));
  } catch (e) {
    console.error('revenuecat', (e as Error).message);
    // A failure makes RevenueCat try again later.
    if (ev.id) await admin.from('subscription_events').delete().eq('id', String(ev.id));
    return new Response('retry', { status: 500 });
  }
  return new Response('ok');
});
