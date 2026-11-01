// Adro gate: emails people the team lets in from the waitlist, each with their personal code. Called from the admin
// page with the admin's own sign-in (checked here with is_admin), after admin_waitlist_invite gave them their codes.
// Sent through Resend (RESEND_API_KEY), like the welcome email. Deploy:  supabase functions deploy gate
import { createClient } from 'npm:@supabase/supabase-js@2';

const env = (k: string) => (Deno.env.get(k) ?? '').trim();
const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, content-type, apikey, x-client-info', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
const UUID = /^[0-9a-f-]{36}$/i;
/** Where to get the app. */
const STORE = 'https://apps.apple.com/app/id6826500429';

const TEXT = {
  ar: {
    subject: 'دورك جا: Adro جاهز لك 🎉',
    hi: 'دورك جا 🎉',
    intro: 'سجلت في قائمة انتظار Adro، والحين جا دورك. حمّل التطبيق، وأول ما ينفتح اكتب رمزك:',
    code: 'رمزك',
    open: 'حمّل Adro',
    note: 'الرمز لك أنت. Adro يجمع أكلك وتمارينك ونومك في مكان واحد، ومعك مدرب ذكي يعرف خطتك.',
    why: 'وصلك هذا الإيميل لأنك سجلت في قائمة انتظار Adro.',
  },
  en: {
    subject: 'You’re in: Adro is ready for you 🎉',
    hi: 'You’re in 🎉',
    intro: 'You joined the Adro waitlist, and now it’s your turn. Get the app, and when it opens, type your code:',
    code: 'Your code',
    open: 'Get Adro',
    note: 'This code is just for you. Adro brings your food, training and sleep together, with an AI coach that knows your plan.',
    why: 'You got this email because you joined the Adro waitlist.',
  },
};

function html(lang: 'ar' | 'en', code: string) {
  const T = TEXT[lang];
  const rtl = lang === 'ar';
  const al = rtl ? 'right' : 'left';
  return `<!doctype html><html dir="${rtl ? 'rtl' : 'ltr'}" lang="${lang}"><body style="margin:0;background:#0a0a0b;font-family:-apple-system,Segoe UI,Tahoma,Arial,sans-serif;color:#fafafa">
<div style="max-width:480px;margin:0 auto;padding:32px 20px;text-align:${al}">
  <div style="font-size:26px;font-weight:800;margin-bottom:8px">${T.hi}</div>
  <p style="font-size:16px;line-height:1.7;color:#d4d4d8">${T.intro}</p>
  <div style="background:#18181b;border-radius:18px;padding:20px;text-align:center;margin:20px 0">
    <div style="font-size:13px;color:#9a9aa3;font-weight:700">${T.code}</div>
    <div style="font-size:34px;font-weight:800;letter-spacing:6px;margin-top:6px;direction:ltr">${code}</div>
  </div>
  <a href="${STORE}" style="display:block;background:#3355ff;color:#fff;text-decoration:none;text-align:center;font-weight:800;font-size:17px;padding:16px;border-radius:28px">${T.open}</a>
  <p style="font-size:14px;line-height:1.7;color:#9a9aa3;margin-top:20px">${T.note}</p>
  <p style="font-size:12px;color:#6b6b73;margin-top:24px">${T.why}</p>
</div></body></html>`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'method' }, 405);
  const auth = req.headers.get('Authorization') ?? '';
  if (!auth.startsWith('Bearer ')) return json({ error: 'auth' }, 401);
  // Only the team: checked with the caller's own sign-in.
  const asUser = createClient(env('SUPABASE_URL'), env('SUPABASE_ANON_KEY'), { global: { headers: { Authorization: auth } } });
  const { data: ok } = await asUser.rpc('is_admin');
  if (ok !== true) return json({ error: 'not_allowed' }, 403);
  const body = (await req.json().catch(() => ({}))) as { ids?: unknown };
  const ids = (Array.isArray(body.ids) ? body.ids : []).filter((x): x is string => typeof x === 'string' && UUID.test(x)).slice(0, 200);
  if (!ids.length) return json({ sent: 0 });
  const key = env('RESEND_API_KEY');
  if (!key) return json({ error: 'no_email' }, 500);
  const db = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'));
  const { data: rows } = await db.from('waitlist').select('id,email,lang,invite').in('id', ids).not('invite', 'is', null);
  let sent = 0;
  for (const r of (rows ?? []) as { id: string; email: string; lang: string; invite: string }[]) {
    const lang = r.lang === 'ar' ? 'ar' : 'en';
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: 'Adro <hello@adroapp.com>', to: [r.email], reply_to: 'hello@adroapp.com', subject: TEXT[lang].subject, html: html(lang, r.invite) }),
    });
    if (res.ok) {
      sent++;
      await db.from('waitlist').update({ emailed_at: new Date().toISOString() }).eq('id', r.id);
    }
  }
  return json({ sent });
});
