// Adro welcome email: sent once, right after someone confirms their email. The database calls this function (trigger
// on auth.users, see migrations/20261128000000_welcome_email.sql) with a shared secret kept in the vault
// ("welcome_hook") and as the Edge Function secret WELCOME_HOOK_SECRET. It writes in the account's language and lists
// the account's details (never the password). Sent through Resend (RESEND_API_KEY).
// Deploy without JWT checks:  supabase functions deploy welcome --no-verify-jwt
import { createClient } from 'npm:@supabase/supabase-js@2';

const env = (k: string) => (Deno.env.get(k) ?? '').trim();
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { 'Content-Type': 'application/json' } });
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

type Who = { name: string; username: string; email: string; phone: string; coach: boolean; joined: string };

const TEXT = {
  ar: {
    subject: (n: string) => `أهلاً ${n} في Adro 👋`,
    hi: (n: string) => `أهلاً ${n} 👋`,
    intro: 'حسابك في Adro جاهز. Adro يجمع أكلك وتمارينك ونومك في مكان واحد، ومعك مدرب ذكي يعرف خطتك وأرقامك.',
    details: 'بيانات حسابك',
    rows: { name: 'الاسم', username: 'اسم المستخدم', email: 'الإيميل', phone: 'الجوال', type: 'نوع الحساب', joined: 'تاريخ التسجيل' },
    member: 'متدرب',
    coach: 'مدرب (قيد المراجعة)',
    pass: 'كلمة المرور ما نرسلها بالإيميل أبداً. لو نسيتها، غيّرها من شاشة الدخول.',
    start: 'ابدأ بهالخطوات',
    steps: ['جهّز سعراتك: وزنك وهدفك، ونحسب لك السعرات والبروتين.', 'خطة تمارينك: أيام تمرينك والأجهزة اللي عندك.', 'اربط Apple Health أو ساعتك، وتوصل خطواتك ونومك ونبضك لحالها.'],
    open: 'افتح Adro',
    help: 'عندك سؤال؟ رد على هذا الإيميل وبنساعدك.',
    why: 'وصلك هذا الإيميل لأنك سجّلت حساب في Adro بهذا الإيميل.',
  },
  en: {
    subject: (n: string) => `Welcome to Adro, ${n} 👋`,
    hi: (n: string) => `Welcome, ${n} 👋`,
    intro: 'Your Adro account is ready. Adro brings your food, training and sleep together, with an AI coach that knows your plan and your numbers.',
    details: 'Your account',
    rows: { name: 'Name', username: 'Username', email: 'Email', phone: 'Phone', type: 'Account type', joined: 'Joined' },
    member: 'Member',
    coach: 'Coach (under review)',
    pass: 'We never send your password by email. Forgot it? Reset it from the sign-in screen.',
    start: 'Get started',
    steps: ['Set up your calories: your weight and goal, and we work out your calories and protein.', 'Your training plan: the days you train and the equipment you have.', 'Connect Apple Health or your watch, and your steps, sleep and heart rate come in by themselves.'],
    open: 'Open Adro',
    help: 'Questions? Reply to this email and we’ll help.',
    why: 'You got this email because you signed up for Adro with this address.',
  },
};

function html(lang: 'ar' | 'en', w: Who) {
  const T = TEXT[lang];
  const rtl = lang === 'ar';
  const al = rtl ? 'right' : 'left';
  const lh = rtl ? '1.8' : '1.6';
  const date = new Intl.DateTimeFormat(rtl ? 'ar-u-nu-latn' : 'en-US', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Riyadh' }).format(new Date(w.joined));
  const rows: [string, string, boolean?][] = [
    [T.rows.name, w.name],
    [T.rows.username, `@${w.username}`, true],
    [T.rows.email, w.email, true],
    ...(w.phone ? ([[T.rows.phone, w.phone, true]] as [string, string, boolean][]) : []),
    [T.rows.type, w.coach ? T.coach : T.member],
    [T.rows.joined, date],
  ];
  const row = ([k, v, ltr]: [string, string, boolean?]) =>
    `<tr><td style="padding:9px 0;color:#71717A;font-size:14px;text-align:${al};border-bottom:1px solid #F0F0F2">${esc(k)}</td><td style="padding:9px 0;font-size:14px;font-weight:600;text-align:${rtl ? 'left' : 'right'};border-bottom:1px solid #F0F0F2"${ltr ? ' dir="ltr"' : ''}>${esc(v)}</td></tr>`;
  return `<!doctype html>
<html lang="${lang}" dir="${rtl ? 'rtl' : 'ltr'}"><body style="margin:0;padding:0;background:#F4F5F7">
<div style="max-width:520px;margin:0 auto;padding:28px 16px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Tahoma,Arial,sans-serif;color:#0A0A0B">
  <div style="text-align:center;margin-bottom:16px"><img src="https://adroapp.com/icons/icon-192.png" width="56" height="56" alt="Adro" style="display:inline-block;border:0;border-radius:14px" /><div style="font-size:20px;font-weight:800;color:#3355FF;letter-spacing:-0.5px;margin-top:6px">Adro</div></div>
  <div style="background:#FFFFFF;border-radius:24px;padding:26px 24px" dir="${rtl ? 'rtl' : 'ltr'}">
    <h2 style="margin:0 0 8px;font-size:22px;text-align:${al}">${esc(T.hi(w.name))}</h2>
    <p style="margin:0;font-size:15px;line-height:${lh};color:#3F3F46;text-align:${al}">${esc(T.intro)}</p>
    <h3 style="margin:22px 0 4px;font-size:15px;text-align:${al}">${esc(T.details)}</h3>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse">${rows.map(row).join('')}</table>
    <p style="margin:12px 0 0;font-size:13px;line-height:${lh};color:#71717A;text-align:${al}">🔒 ${esc(T.pass)}</p>
    <h3 style="margin:22px 0 8px;font-size:15px;text-align:${al}">${esc(T.start)}</h3>
    ${T.steps
      .map(
        (s, i) =>
          `<table role="presentation" cellspacing="0" cellpadding="0" style="margin:0 0 10px;width:100%"><tr><td style="width:30px;vertical-align:top"><div style="width:24px;height:24px;border-radius:12px;background:#F1F3FF;color:#3355FF;font-weight:800;font-size:13px;line-height:24px;text-align:center">${i + 1}</div></td><td style="font-size:14px;line-height:${lh};color:#3F3F46;text-align:${al}">${esc(s)}</td></tr></table>`,
      )
      .join('')}
    <p style="margin:18px 0 0;text-align:center"><a href="https://adroapp.com" style="display:inline-block;background:#3355FF;color:#FFFFFF;text-decoration:none;font-weight:700;border-radius:999px;padding:12px 28px;font-size:15px">${esc(T.open)}</a></p>
    <p style="margin:18px 0 0;font-size:13px;line-height:${lh};color:#71717A;text-align:${al}">${esc(T.help)}</p>
  </div>
  <p style="text-align:center;font-size:12px;color:#A1A1AA;margin-top:18px;line-height:1.6">${esc(T.why)}<br/>Adro · adroapp.com</p>
</div></body></html>`;
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'method' }, 405);
  const secret = env('WELCOME_HOOK_SECRET');
  if (!secret || req.headers.get('x-hook-secret') !== secret) return json({ error: 'auth' }, 401);
  const key = env('RESEND_API_KEY');
  if (!key) return json({ error: 'no_resend' }, 503);
  const body = await req.json().catch(() => ({}));
  const id = typeof body.user_id === 'string' ? body.user_id : '';
  if (!/^[0-9a-f-]{36}$/i.test(id)) return json({ error: 'user' }, 400);

  const admin = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false } });
  const { data: u } = await admin.auth.admin.getUserById(id);
  const user = u?.user;
  if (!user?.email || !user.email_confirmed_at) return json({ skipped: 'not_confirmed' });
  // Test accounts (.invalid addresses) never get mail.
  if (/\.invalid$/i.test(user.email)) return json({ skipped: 'test' });
  // Once per account, even if this is called again.
  const { data: first } = await admin.from('welcome_emails').insert({ user_id: id }).select('user_id').maybeSingle();
  if (!first) return json({ skipped: 'sent_before' });

  const { data: p } = await admin.from('profiles').select('name, username, phone, account_type, language, created_at').eq('id', id).maybeSingle();
  const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
  const lang: 'ar' | 'en' = (p?.language ?? meta.language) === 'ar' ? 'ar' : 'en';
  const who: Who = {
    name: String(p?.name || meta.name || p?.username || '').slice(0, 60) || (lang === 'ar' ? 'صديقنا' : 'there'),
    username: String(p?.username ?? meta.username ?? ''),
    email: user.email,
    phone: String(p?.phone ?? ''),
    coach: p?.account_type === 'coach',
    joined: String(p?.created_at ?? user.created_at),
  };
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: 'Adro <hello@adroapp.com>', to: [user.email], reply_to: 'hello@adroapp.com', subject: TEXT[lang].subject(who.name), html: html(lang, who) }),
  });
  if (!r.ok) {
    // Not sent: free the slot so a later call can try again.
    await admin.from('welcome_emails').delete().eq('user_id', id);
    return json({ error: 'send', status: r.status, detail: (await r.text()).slice(0, 200) }, 502);
  }
  await admin.from('welcome_emails').update({ sent_at: new Date().toISOString() }).eq('user_id', id);
  return json({ sent: true, lang });
});
