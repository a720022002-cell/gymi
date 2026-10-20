"""Builds the Adro website (public/site) as plain HTML pages, in English and Arabic.

The privacy policy and terms are read from src/app/legal.tsx and their Arabic from src/i18n/ar.ts, so the website
always says the same as the app. Run after changing either:  python3 scripts/build_site.py
"""
import html
import json
import math
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'public' / 'site'
SUPPORT_EMAIL = 'support@adro.sa'
APP_URL = '/welcome'

# ---------- shared pieces ----------
wm = (ROOT / 'src/components/wordmark.ts').read_text()
VB = re.search(r"viewBox: '([^']+)'", wm).group(1)
LETTERS = re.search(r"letters: '([^']+)'", wm).group(1)
CX, CY, R, SW = [float(x) for x in re.search(r'ring: \{ cx: ([\d.]+), cy: (-?[\d.]+), r: ([\d.]+), stroke: ([\d.]+)', wm).groups()]
C = 2 * math.pi * R


def logo(h=26, cls='logo'):
    return (f'<svg class="{cls}" style="height:{h}px" viewBox="{VB}" role="img" aria-label="adro"><path d="{LETTERS}" fill="currentColor"/>'
            f'<circle cx="{CX}" cy="{CY}" r="{R}" fill="none" stroke="var(--blue)" stroke-width="{SW}" stroke-linecap="round" '
            f'stroke-dasharray="{C * 0.8:.1f} {C:.1f}" transform="rotate(-90 {CX} {CY})"/></svg>')


def ring(size=24, color='var(--blue)', sw=22):
    r = (100 - sw) / 2
    c = 2 * math.pi * r
    return (f'<svg width="{size}" height="{size}" viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="{r}" fill="none" stroke="{color}" '
            f'stroke-width="{sw}" stroke-linecap="round" stroke-dasharray="{c * 0.8:.1f} {c:.1f}" transform="rotate(-90 50 50)"/></svg>')


def t(en, ar):
    """A piece of text in both languages; the page shows one of them."""
    return f'<span lang="en">{en}</span><span lang="ar">{ar}</span>'


CSS = '''
:root{--blue:#3355FF;--ink:#0A0A0B;--sec:#52525B;--card:#F4F4F5;--line:#E4E4E7;--bg:#FFFFFF;--soft:#EEF1FF}
*{box-sizing:border-box}html{scroll-behavior:smooth;-webkit-text-size-adjust:100%}
body{margin:0;background:var(--bg);color:var(--ink);font-family:Manrope,'IBM Plex Sans Arabic',system-ui,sans-serif;line-height:1.55}
html[lang=ar] body{font-family:'IBM Plex Sans Arabic',Manrope,system-ui,sans-serif}
html[lang=en] [lang=ar],html[lang=ar] [lang=en]{display:none!important}
a{color:inherit}img{max-width:100%;display:block}
.wrap{max-width:1120px;margin:0 auto;padding:0 20px}
h1,h2,h3{font-family:Sora,'IBM Plex Sans Arabic',sans-serif;letter-spacing:-.02em;margin:0;line-height:1.15}
html[lang=ar] h1,html[lang=ar] h2,html[lang=ar] h3{font-family:'IBM Plex Sans Arabic',sans-serif;letter-spacing:0;line-height:1.35}
.btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;height:48px;padding:0 22px;border-radius:24px;font-weight:700;font-size:15px;text-decoration:none;border:0;cursor:pointer;white-space:nowrap}
.btn.dark{background:var(--ink);color:#fff}.btn.light{background:#fff;color:var(--ink);border:1px solid var(--line)}.btn.blue{background:var(--blue);color:#fff}
.btn.store{background:var(--ink);color:#fff;height:52px;border-radius:14px;padding:0 18px;flex-direction:column;gap:0;line-height:1.15;align-items:flex-start}
.btn.store small{font-weight:500;font-size:11px;opacity:.7}.btn.store b{font-size:16px}
.btn:focus-visible,.lang:focus-visible,summary:focus-visible{outline:3px solid var(--blue);outline-offset:3px}
/* nav */
nav{position:sticky;top:0;z-index:10;background:rgba(255,255,255,.82);backdrop-filter:saturate(1.8) blur(14px);-webkit-backdrop-filter:saturate(1.8) blur(14px);border-bottom:1px solid transparent;transition:border-color .2s}
nav.scrolled{border-bottom-color:var(--line)}
.nav{display:flex;align-items:center;gap:18px;height:64px}.nav .logo{color:var(--ink)}
.links{display:flex;gap:22px;margin-inline-start:auto;font-size:15px}.links a{text-decoration:none;color:var(--sec)}.links a:hover{color:var(--ink)}
.lang{height:36px;min-width:44px;padding:0 12px;border-radius:18px;border:1px solid var(--line);background:#fff;font:700 14px Manrope,'IBM Plex Sans Arabic';cursor:pointer;color:var(--ink)}
.nav .btn{height:40px;padding:0 16px;font-size:14px}
@media(max-width:820px){.links{display:none}.nav .lang{margin-inline-start:auto}}
@media(max-width:420px){.nav .btn span[lang]{font-size:13px}.nav .btn{padding:0 12px}}
/* hero */
.hero{padding:56px 0 40px;overflow:hidden}
.hero .wrap{display:grid;grid-template-columns:1.1fr .9fr;gap:40px;align-items:center}
.eyebrow{display:inline-flex;align-items:center;gap:8px;font-weight:700;font-size:13px;color:var(--blue);background:var(--soft);padding:6px 12px;border-radius:16px}
.hero h1{font-size:clamp(40px,6.2vw,72px);margin:18px 0 16px}
.hero p.lead{font-size:clamp(17px,2vw,20px);color:var(--sec);max-width:520px;margin:0 0 26px}
.ctas{display:flex;flex-wrap:wrap;gap:10px;align-items:center}
.note{font-size:13px;color:var(--sec);margin-top:12px}
.stage{position:relative;display:flex;justify-content:center}
.glow{position:absolute;inset:8% -10% 0;background:radial-gradient(closest-side,#c9d2ff,transparent);filter:blur(10px);z-index:0}
.phone{position:relative;z-index:1;width:min(300px,78vw);aspect-ratio:585/1266;border-radius:44px;background:#0A0A0B;padding:10px;box-shadow:0 30px 60px -20px rgba(16,24,80,.35),0 0 0 1px #27272A inset}
.phone img{width:100%;height:100%;object-fit:cover;border-radius:35px}
.float{position:absolute;z-index:2;background:#fff;border-radius:18px;box-shadow:0 16px 40px -12px rgba(16,24,80,.3);padding:12px 14px;display:flex;gap:10px;align-items:center;font-size:13px}
.float b{display:block;font-size:14px}.float .muted{color:var(--sec)}
.f1{top:16%;inset-inline-start:-6%}.f2{bottom:14%;inset-inline-end:-8%}
@media(max-width:860px){.hero .wrap{grid-template-columns:1fr;text-align:center}.hero p.lead{margin-inline:auto}.ctas{justify-content:center}.f1{top:44%;inset-inline-start:-2%}.f2{bottom:6%;inset-inline-end:-2%}}
/* sections */
section{padding:72px 0}.sec-title{max-width:640px;margin-bottom:34px}
.sec-title h2{font-size:clamp(30px,4vw,44px);margin:10px 0 12px}.sec-title p{color:var(--sec);font-size:17px;margin:0}
.k{font:700 12px Manrope;letter-spacing:.14em;text-transform:uppercase;color:var(--blue)}
.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:14px}
.card{background:var(--card);border-radius:24px;padding:24px}
.card .ic{width:44px;height:44px;border-radius:14px;background:#fff;display:flex;align-items:center;justify-content:center;margin-bottom:16px}
.card h3{font-size:19px;margin-bottom:8px}.card p{margin:0;color:var(--sec);font-size:15px}
@media(max-width:900px){.grid{grid-template-columns:1fr 1fr}}@media(max-width:600px){.grid{grid-template-columns:1fr}section{padding:56px 0}}
/* showcase */
.show{display:grid;grid-template-columns:1fr 1fr;gap:48px;align-items:center;margin-bottom:72px}
.show:last-child{margin-bottom:0}.show.flip .txt{order:2}
.show h3{font-size:clamp(26px,3.2vw,36px);margin:10px 0 12px}.show p{color:var(--sec);font-size:17px;margin:0 0 16px}
.show ul{margin:0;padding:0;list-style:none;display:grid;gap:10px}.show li{display:flex;gap:10px;align-items:flex-start;font-size:15px}
.show li:before{content:"";flex:none;width:8px;height:8px;border-radius:4px;background:var(--blue);margin-top:8px}
.show .shot{display:flex;justify-content:center;background:linear-gradient(160deg,var(--soft),#fff);border-radius:32px;padding:40px 20px}
.show .phone{width:min(270px,70vw)}
@media(max-width:860px){.show,.show.flip{grid-template-columns:1fr;gap:28px}.show.flip .txt{order:0}}
/* devices */
.chips{display:flex;flex-wrap:wrap;gap:10px}.chip{background:#fff;border:1px solid var(--line);border-radius:22px;padding:10px 16px;font-weight:700;font-size:14px}
.chip.on{border-color:var(--blue);color:var(--blue)}
.band{background:var(--ink);color:#fff;border-radius:32px;padding:44px}.band .sec-title p{color:#A1A1AA}.band .chip{background:#18181B;border-color:#27272A;color:#fff}.band .chip.on{border-color:var(--blue);color:#9DB0FF}
@media(max-width:600px){.band{padding:28px 20px;border-radius:24px}}
/* pricing */
.prices{display:grid;grid-template-columns:1fr 1fr;gap:14px;max-width:820px}
.price{border:1px solid var(--line);border-radius:28px;padding:28px}.price.pro{background:var(--ink);color:#fff;border-color:var(--ink)}
.price h3{font-size:22px}.amount{font:700 40px Sora;margin:14px 0 2px;letter-spacing:-.02em}.amount small{font:500 15px Manrope;color:var(--sec)}
.price.pro .amount small,.price.pro .per{color:#A1A1AA}.per{font-size:14px;color:var(--sec)}
.price ul{list-style:none;padding:0;margin:20px 0 0;display:grid;gap:10px}.price li{display:flex;gap:10px;font-size:15px}
.price li:before{content:"✓";color:var(--blue);font-weight:800}.price.pro li:before{color:#9DB0FF}
@media(max-width:700px){.prices{grid-template-columns:1fr}}
/* faq */
details{border-bottom:1px solid var(--line);padding:18px 0}summary{cursor:pointer;font-weight:700;font-size:17px;list-style:none;display:flex;justify-content:space-between;gap:16px}
summary::-webkit-details-marker{display:none}summary:after{content:"+";font-size:22px;line-height:1;color:var(--blue)}details[open] summary:after{content:"–"}
details p{color:var(--sec);margin:10px 0 0;font-size:15px}
/* cta + footer */
.final{text-align:center;background:linear-gradient(160deg,#3355FF,#2433C9);color:#fff;border-radius:32px;padding:56px 24px}
.final h2{font-size:clamp(30px,4.4vw,48px);margin:16px 0 10px}.final p{opacity:.85;margin:0 0 26px;font-size:17px}.final .ctas{justify-content:center}
.final .btn.store{background:#fff;color:var(--ink)}
footer{padding:40px 0 56px;color:var(--sec);font-size:14px}
.foot{display:flex;flex-wrap:wrap;gap:20px;align-items:center;justify-content:space-between;border-top:1px solid var(--line);padding-top:28px}
.foot nav{position:static;background:none;backdrop-filter:none;border:0;display:flex;gap:18px;flex-wrap:wrap}.foot a{text-decoration:none}.foot a:hover{color:var(--ink)}
/* legal pages */
.doc{max-width:760px;padding:40px 20px 72px;margin:0 auto}.doc h1{font-size:clamp(32px,5vw,44px);margin:8px 0 8px}.doc .sub{color:var(--sec);margin:0 0 28px}
.doc h2{font-size:20px;margin:28px 0 8px}.doc p{color:#3F3F46;margin:0;font-size:16px}
.doc .box{background:var(--card);border-radius:20px;padding:20px 22px;margin-top:22px}
@media (prefers-reduced-motion:reduce){html{scroll-behavior:auto}*{transition:none!important}}
'''

FONTS = ('<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>'
         '<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;600;700&family=Manrope:wght@400;500;600;700;800&family=Sora:wght@600;700&display=swap" rel="stylesheet">')

# Picks Arabic or English: ?lang=, then the visitor's last choice, then the browser language.
LANG_JS = '''<script>
(function(){var q=new URLSearchParams(location.search).get('lang'),s=null;try{s=localStorage.getItem('adro.site.lang')}catch(e){}
var l=q||s||((navigator.language||'').toLowerCase().indexOf('ar')===0?'ar':'en');if(l!=='ar')l='en';
var h=document.documentElement;h.lang=l;h.dir=l==='ar'?'rtl':'ltr';
window.setLang=function(n){h.lang=n;h.dir=n==='ar'?'rtl':'ltr';try{localStorage.setItem('adro.site.lang',n)}catch(e){}
document.querySelectorAll('img[data-en]').forEach(function(i){i.src=i.getAttribute('data-'+n)});
var tt=document.querySelector('title');if(tt&&tt.dataset[n])tt.textContent=tt.dataset[n];};
document.addEventListener('DOMContentLoaded',function(){setLang(h.lang);
var nv=document.querySelector('nav.top');if(nv){var f=function(){nv.classList.toggle('scrolled',scrollY>8)};addEventListener('scroll',f,{passive:true});f();}});
})();
</script>'''


def page(title_en, title_ar, desc, body, path):
    return f'''<!doctype html>
<html lang="en" dir="ltr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title data-en="{html.escape(title_en)}" data-ar="{html.escape(title_ar)}">{html.escape(title_en)}</title>
<meta name="description" content="{html.escape(desc)}">
<meta name="theme-color" content="#FFFFFF">
<meta property="og:title" content="{html.escape(title_en)}">
<meta property="og:description" content="{html.escape(desc)}">
<meta property="og:type" content="website">
<meta property="og:image" content="/site/img/og.png">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" type="image/png" href="/icons/icon-192.png">
<link rel="apple-touch-icon" href="/icons/apple-touch-icon.png">
{FONTS}
<style>{CSS}</style>
{LANG_JS}
</head>
<body>
<nav class="top"><div class="wrap nav">
<a href="/site" aria-label="Adro">{logo(24)}</a>
<div class="links"><a href="/site#features">{t('Features', 'المميزات')}</a><a href="/site#devices">{t('Watches', 'الساعات')}</a><a href="/site#pricing">{t('Pricing', 'الأسعار')}</a><a href="/site#faq">{t('FAQ', 'الأسئلة')}</a></div>
<button class="lang" type="button" onclick="setLang(document.documentElement.lang==='ar'?'en':'ar')" aria-label="Change language">{t('ع', 'EN')}</button>
<a class="btn dark" href="{APP_URL}">{t('Open Adro', 'افتح ادرو')}</a>
</div></nav>
{body}
<footer><div class="wrap foot">
<div style="display:flex;align-items:center;gap:14px">{logo(20)}<span>© 2026 Adro</span></div>
<nav aria-label="Footer"><a href="/site/privacy">{t('Privacy', 'الخصوصية')}</a><a href="/site/terms">{t('Terms', 'الشروط')}</a><a href="/site/support">{t('Support', 'الدعم')}</a><a href="{APP_URL}">{t('Web app', 'نسخة الويب')}</a></nav>
</div></footer>
</body>
</html>
'''


def store_buttons():
    return (f'<span class="btn store" aria-disabled="true"><small>{t("Coming soon on the", "قريباً على")}</small><b>App Store</b></span>'
            f'<span class="btn store" aria-disabled="true"><small>{t("Coming soon on", "قريباً على")}</small><b>Google Play</b></span>')


def phone(name, alt_en, alt_ar, eager=False):
    return (f'<div class="phone"><img src="/site/img/{name}-en.webp" data-en="/site/img/{name}-en.webp" data-ar="/site/img/{name}-ar.webp" '
            f'width="585" height="1266" alt="{html.escape(alt_en)}" {"" if eager else "loading=\"lazy\""}></div>')


ICON = {
    'coach': '<path d="M4 6a3 3 0 0 1 3-3h10a3 3 0 0 1 3 3v8a3 3 0 0 1-3 3h-6l-4 4v-4a3 3 0 0 1-3-3z"/><path d="M9 10h.01M12 10h.01M15 10h.01"/>',
    'plan': '<rect x="3" y="4" width="18" height="17" rx="3"/><path d="M8 2v4M16 2v4M3 10h18M8 14l2 2 4-4"/>',
    'food': '<path d="M5 3v8a2 2 0 0 0 2 2v8M9 3v8M7 3v8M17 21V3c-2 1-3 4-3 8h3"/>',
    'watch': '<rect x="6" y="6" width="12" height="12" rx="3"/><path d="M9 6l1-4h4l1 4M9 18l1 4h4l1-4M12 9v3l2 1"/>',
    'recap': '<path d="M3 3v18h18"/><path d="M7 15l4-4 3 3 5-6"/>',
    'people': '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.5a3.5 3.5 0 0 1 0 7M18 14a6.5 6.5 0 0 1 3.5 6"/>',
}


def icon(k):
    return f'<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--blue)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">{ICON[k]}</svg>'


def home():
    feats = [
        ('coach', 'An AI coach that knows you', 'مدرب ذكي يعرفك',
         'Ask anything in Arabic or English. It reads your food, training, sleep and watch, and answers with your real numbers.',
         'اسأله أي شي بالعربي أو الإنجليزي. يقرأ أكلك وتمرينك ونومك وساعتك، ويجاوبك بأرقامك الحقيقية.'),
        ('plan', 'A plan that adapts every week', 'خطة تتعدّل كل أسبوع',
         'Ready-made workouts for your goal and equipment, with the right weight for every set. Slept badly? It goes lighter.',
         'تمارين جاهزة حسب هدفك وأدواتك، مع الوزن المناسب لكل مجموعة. ما نمت زين؟ يخففها عليك.'),
        ('food', 'Log food in seconds', 'سجّل أكلك بثواني',
         'Snap a photo, scan a barcode or just say it. Knows kabsa, mandi, karak and the dishes you actually eat.',
         'صوّر صحنك، أو امسح الباركود، أو قوله بصوتك. يعرف الكبسة والمندي والكرك والأكل اللي فعلاً تاكله.'),
        ('watch', 'Your watch makes it smarter', 'ساعتك تخليه أذكى',
         'Sleep, heart rate, HRV and steps from Apple Health, Health Connect, WHOOP, Oura and Polar shape your day.',
         'النوم والنبض و HRV والخطوات من Apple Health و Health Connect و WHOOP و Oura و Polar تحدد يومك.'),
        ('recap', 'A weekly recap', 'ملخص كل أسبوع',
         'Every week, a short story of what went well, what didn’t, and one tap to apply the next step.',
         'كل أسبوع، قصة قصيرة عن وش مشى زين ووش لا، وضغطة وحدة تطبّق الخطوة الجاية.'),
        ('people', 'Friends and real coaches', 'أصحابك ومدربين حقيقيين',
         'Train together with Gym Bros, join challenges, or find a certified coach who sees your progress.',
         'تمرّن مع أصحابك في Gym Bros، ادخل تحديات، أو لقِ مدرب معتمد يتابع تقدّمك.'),
    ]
    cards = ''.join(f'<div class="card"><div class="ic">{icon(k)}</div><h3>{t(a, b)}</h3><p>{t(c, d)}</p></div>' for k, a, b, c, d in feats)

    def show(name, k_en, k_ar, h_en, h_ar, p_en, p_ar, items, flip=False):
        li = ''.join(f'<li>{t(a, b)}</li>' for a, b in items)
        return (f'<div class="show{" flip" if flip else ""}"><div class="txt"><div class="k">{t(k_en, k_ar)}</div><h3>{t(h_en, h_ar)}</h3><p>{t(p_en, p_ar)}</p><ul>{li}</ul></div>'
                f'<div class="shot">{phone(name, h_en, h_ar)}</div></div>')

    shows = ''.join([
        show('train', 'Train', 'التمرين', 'Your week, planned for you.', 'أسبوعك، مخطط لك.',
             'Pick your goal, days and equipment once. Adro builds the plan and keeps it moving.',
             'اختر هدفك وأيامك وأدواتك مرة وحدة. ادرو يبني الخطة ويمشّيها معك.',
             [('Missed a day? Move it with one tap', 'فوّت يوم؟ انقله بضغطة'), ('Home or travel mode, no equipment', 'وضع البيت أو السفر بدون أدوات'), ('The set coach tells you the next weight', 'مدرب المجموعات يقولك الوزن الجاي')]),
        show('food', 'Food', 'الأكل', 'Calories that fit your day.', 'سعرات تناسب يومك.',
             'Your target follows your goal, and moves with the steps and workouts you actually did.',
             'هدفك يمشي حسب هدفك، ويتحرك مع خطواتك وتمارينك اللي فعلاً سويتها.',
             [('Protein, carbs and fat at a glance', 'البروتين والكارب والدهون بنظرة'), ('Saved meals and meal plans', 'وجبات محفوظة وخطط أكل'), ('Allergy warnings on every product', 'تنبيه الحساسية على كل منتج')], flip=True),
        show('recovery', 'Recovery', 'الاستشفاء', 'Know when to push, and when to rest.', 'اعرف متى تضغط ومتى ترتاح.',
             'A daily score from your sleep, soreness, energy, training load and watch, with a clear plan for today.',
             'درجة يومية من نومك وتعبك وطاقتك وحمل التمرين وساعتك، مع خطة واضحة لليوم.',
             [('A morning note when you wake up', 'ملاحظة كل صباح أول ما تصحى'), ('An early warning when you might be getting sick', 'تنبيه مبكر إذا ممكن تمرض'), ('Sleep stages and bedtime steadiness', 'مراحل النوم وثبات وقت نومك')]),
        show('coach', 'AI coach', 'المدرب الذكي', 'Ask, log, or change your plan in one chat.', 'اسأل، سجّل، أو غيّر خطتك من محادثة وحدة.',
             '“I ate chicken and rice” logs your lunch. “Give me a break this week” offers the change; you tap Apply.',
             '"أكلت دجاج ورز" يسجّل غداك. "أبي راحة هالأسبوع" يقترح التعديل، وأنت تضغط تطبيق.',
             [('Answers in your language', 'يجاوب بلغتك'), ('Uses your real numbers, never made-up ones', 'يستخدم أرقامك الحقيقية، ما يخترع'), ('Health and fitness only, not medical advice', 'صحة ولياقة بس، مو استشارة طبية')], flip=True),
    ])
    devices = ['Apple Health', 'Apple Watch', 'Health Connect', 'WHOOP', 'Oura', 'Polar', 'Galaxy Watch', 'Garmin', 'Fitbit', 'Smart scales']
    direct = {'Apple Health', 'Health Connect', 'WHOOP', 'Oura', 'Polar'}
    chips = ''.join(f'<span class="chip{" on" if d in direct else ""}">{d}</span>' for d in devices)
    faqs = [
        ('Is Adro free?', 'هل ادرو مجاني؟', 'Yes. You can plan workouts, log food and track your progress for free. Adro Pro adds more AI and deeper watch insights.',
         'نعم. تقدر تخطط تمارينك وتسجّل أكلك وتتابع تقدّمك مجاناً. Adro Pro يضيف ذكاء اصطناعي أكثر وتحليل أعمق من ساعتك.'),
        ('Which watches and rings work?', 'أي ساعات وخواتم تشتغل؟', 'Anything that saves to Apple Health or Health Connect, like Apple Watch, Galaxy Watch, Garmin and Fitbit. WHOOP, Oura and Polar also connect directly.',
         'أي جهاز يحفظ في Apple Health أو Health Connect، مثل Apple Watch و Galaxy Watch و Garmin و Fitbit. و WHOOP و Oura و Polar ترتبط مباشرة بعد.'),
        ('Does it work in Arabic?', 'يشتغل بالعربي؟', 'Fully. The whole app, the AI coach and the food list work in Arabic and English.',
         'كامل. التطبيق كله والمدرب الذكي وقائمة الأكل تشتغل بالعربي والإنجليزي.'),
        ('Is my data private?', 'بياناتي خاصة؟', 'Yes. We don’t sell your data and we don’t show ads. Health data is never used for marketing. You can download or delete everything any time.',
         'نعم. ما نبيع بياناتك وما نعرض إعلانات. البيانات الصحية ما تُستخدم للتسويق أبداً. وتقدر تنزّل أو تحذف كل شي متى ما تبي.'),
        ('Is it medical advice?', 'هل هو استشارة طبية؟', 'No. Adro is for healthy adults who want to train and eat better. Ask your doctor about health questions.',
         'لا. ادرو للبالغين الأصحاء اللي يبون يتمرنون وياكلون أفضل. اسأل دكتورك عن الأسئلة الصحية.'),
        ('When is it on the App Store and Google Play?', 'متى ينزل على App Store و Google Play؟', 'Very soon. Until then you can use Adro on the web from any phone.',
         'قريب جداً. لين ذاك الوقت تقدر تستخدم ادرو من الويب على أي جوال.'),
    ]
    faq = ''.join(f'<details><summary>{t(a, b)}</summary><p>{t(c, d)}</p></details>' for a, b, c, d in faqs)
    body = f'''
<main>
<header class="hero"><div class="wrap">
<div>
<span class="eyebrow">{ring(14, 'var(--blue)', 24)} {t('Made for the Gulf', 'مصمم للخليج')}</span>
<h1>{t('Your AI gym coach.', 'مدربك الذكي في الجم.')}</h1>
<p class="lead">{t('Training, food and recovery in one app. Ready-made for beginners, fully editable for pros.', 'التمرين والأكل والاستشفاء في تطبيق واحد. جاهز للمبتدئين، وقابل للتعديل كامل للمحترفين.')}</p>
<div class="ctas"><a class="btn blue" href="{APP_URL}">{t('Start free on the web', 'ابدأ مجاناً من الويب')}</a>{store_buttons()}</div>
<div class="note">{t('Free to start. Arabic and English.', 'مجاني للبداية. بالعربي والإنجليزي.')}</div>
</div>
<div class="stage"><div class="glow"></div>{phone('home', 'Adro home screen', 'الشاشة الرئيسية في ادرو', eager=True)}
<div class="float f1">{ring(30)}<div><b>{t('78% recovered', 'جاهزيتك 78٪')}</b><span class="muted">{t('Ready for a normal session', 'جاهز لتمرين عادي')}</span></div></div>
<div class="float f2"><div><b>{t('Chicken kabsa', 'كبسة دجاج')}</b><span class="muted">{t('810 kcal · logged by photo', '810 سعرة · من صورة')}</span></div></div>
</div>
</div></header>

<section id="features"><div class="wrap">
<div class="sec-title"><div class="k">{t('Everything in one place', 'كل شي في مكان واحد')}</div><h2>{t('One app instead of five.', 'تطبيق واحد بدل خمسة.')}</h2>
<p>{t('Adro joins your workouts, food, sleep and watch, so every answer and every plan fits your real day.', 'ادرو يجمع تمرينك وأكلك ونومك وساعتك، عشان كل جواب وكل خطة تناسب يومك الحقيقي.')}</p></div>
<div class="grid">{cards}</div>
</div></section>

<section style="padding-top:24px"><div class="wrap">{shows}</div></section>

<section id="devices"><div class="wrap"><div class="band">
<div class="sec-title"><div class="k">{t('Works with', 'يشتغل مع')}</div><h2>{t('Bring your watch, ring or scale.', 'جيب ساعتك أو خاتمك أو ميزانك.')}</h2>
<p>{t('Highlighted ones connect straight to Adro. Everything else comes in through Apple Health or Health Connect.', 'المميّزة ترتبط مباشرة مع ادرو. والباقي يوصل عن طريق Apple Health أو Health Connect.')}</p></div>
<div class="chips">{chips}</div>
</div></div></section>

<section id="pricing"><div class="wrap">
<div class="sec-title"><div class="k">{t('Pricing', 'الأسعار')}</div><h2>{t('Start free. Go Pro when you’re ready.', 'ابدأ مجاناً. واشترك في Pro متى ما تبي.')}</h2></div>
<div class="prices">
<div class="price"><h3>{t('Free', 'مجاني')}</h3><div class="amount">0 <small>{t('SAR', 'ريال')}</small></div><div class="per">{t('Forever', 'للأبد')}</div>
<ul><li>{t('Workout plans and the set coach', 'خطط التمارين ومدرب المجموعات')}</li><li>{t('Food log, calories and macros', 'تسجيل الأكل والسعرات والماكروز')}</li><li>{t('Recovery score and progress', 'درجة الاستشفاء والتقدّم')}</li><li>{t('A taste of the AI coach every day', 'تجربة يومية للمدرب الذكي')}</li></ul></div>
<div class="price pro"><h3>Adro Pro</h3><div class="amount">39 <small>{t('SAR / month', 'ريال / شهر')}</small></div><div class="per">{t('or 299 SAR a year', 'أو 299 ريال بالسنة')}</div>
<ul><li>{t('More AI coach and food photos', 'مدرب ذكي وصور أكل أكثر')}</li><li>{t('Morning readiness note from your watch', 'ملاحظة الجاهزية كل صباح من ساعتك')}</li><li>{t('3-month trends and PDF reports', 'رسوم 3 شهور وتقارير PDF')}</li><li>{t('Weekly recap with one-tap changes', 'ملخص أسبوعي وتعديل بضغطة')}</li></ul></div>
</div>
</div></section>

<section id="faq"><div class="wrap" style="max-width:820px">
<div class="sec-title"><div class="k">{t('FAQ', 'الأسئلة')}</div><h2>{t('Questions, answered.', 'أسئلة وأجوبتها.')}</h2></div>
{faq}
</div></section>

<section style="padding-top:24px"><div class="wrap"><div class="final">
{ring(44, '#fff', 20)}
<h2>{t('Your next workout is ready.', 'تمرينك الجاي جاهز.')}</h2>
<p>{t('Start free on the web today. The apps are coming soon.', 'ابدأ مجاناً من الويب اليوم. والتطبيق نازل قريب.')}</p>
<div class="ctas"><a class="btn light" href="{APP_URL}">{t('Start free', 'ابدأ مجاناً')}</a>{store_buttons()}</div>
</div></div></section>
</main>'''
    return page('Adro: your AI gym coach', 'ادرو: مدربك الذكي في الجم',
                'Training, food and recovery in one app, in Arabic and English. Your AI gym coach that reads your watch.', body, '')


# ---------- privacy and terms, from the app ----------
legal = (ROOT / 'src/app/legal.tsx').read_text()
ar_src = (ROOT / 'src/i18n/ar.ts').read_text()
AR = {}
for m in re.finditer(r'^\s+("(?:[^"\\]|\\.)*"):\s*("(?:[^"\\]|\\.)*"),?\s*$', ar_src, re.M):
    AR[json.loads(m.group(1))] = json.loads(m.group(2))


def pairs(name):
    block = re.search(rf'const {name}: \[string, string\]\[\] = \[(.*?)\n\];', legal, re.S).group(1)
    return re.findall(r"\['((?:[^'\\]|\\.)*)', '((?:[^'\\]|\\.)*)'\]", block)


def ar(s):
    return AR.get(s, s)


def legal_page(name, title_en, title_ar):
    items = pairs(name)
    rows = ''.join(f'<h2>{t(html.escape(a), html.escape(ar(a)))}</h2><p>{t(html.escape(b), html.escape(ar(b)))}</p>' for a, b in items)
    body = f'''<main class="doc"><div class="k">Adro</div><h1>{t(title_en, title_ar)}</h1>
<p class="sub">{t('The same text you’ll find in the app under You, then Privacy and data.', 'نفس النص الموجود في التطبيق: أنت، ثم الخصوصية والبيانات.')}</p>
{rows}
<div class="box"><p>{t(f'Questions? Write to us at <a href="mailto:{SUPPORT_EMAIL}">{SUPPORT_EMAIL}</a>.', f'عندك سؤال؟ راسلنا على <a href="mailto:{SUPPORT_EMAIL}">{SUPPORT_EMAIL}</a>.')}</p></div>
</main>'''
    return page(f'{title_en} · Adro', f'{title_ar} · ادرو', f'Adro {title_en.lower()}.', body, name.lower())


def support():
    qa = [
        ('Delete your account', 'حذف حسابك', 'In the app: You, then Privacy and data, then Delete account. It removes all your data, photos and files.',
         'من التطبيق: أنت، ثم الخصوصية والبيانات، ثم حذف الحساب. يحذف كل بياناتك وصورك وملفاتك.'),
        ('Download your data', 'تنزيل بياناتك', 'You, then Privacy and data, then Download my data.', 'أنت، ثم الخصوصية والبيانات، ثم تنزيل بياناتي.'),
        ('Connect a watch or ring', 'ربط ساعة أو خاتم', 'You, then Connections. Apple Health, Health Connect, WHOOP, Oura and Polar are there.',
         'أنت، ثم Connections. فيها Apple Health و Health Connect و WHOOP و Oura و Polar.'),
        ('Cancel Adro Pro', 'إلغاء Adro Pro', 'Subscriptions are managed by the store: iPhone Settings, then your name, then Subscriptions. On Android: Google Play, then Payments and subscriptions.',
         'الاشتراك يُدار من المتجر: في الآيفون الإعدادات، ثم اسمك، ثم الاشتراكات. وفي أندرويد: Google Play، ثم الدفعات والاشتراكات.'),
        ('Report someone', 'الإبلاغ عن شخص', 'Tap their name, then Report or Block. Our team reviews reports within 24 hours.',
         'اضغط على اسمه، ثم إبلاغ أو حظر. فريقنا يراجع البلاغات خلال 24 ساعة.'),
    ]
    rows = ''.join(f'<h2>{t(a, b)}</h2><p>{t(c, d)}</p>' for a, b, c, d in qa)
    body = f'''<main class="doc"><div class="k">Adro</div><h1>{t('Support', 'الدعم')}</h1>
<p class="sub">{t('We’re here to help. Most answers are a few taps away in the app.', 'إحنا هنا نساعدك. أغلب الأجوبة على بعد ضغطات في التطبيق.')}</p>
<div class="box"><h2 style="margin-top:0">{t('Contact us', 'تواصل معنا')}</h2>
<p>{t(f'Email <a href="mailto:{SUPPORT_EMAIL}">{SUPPORT_EMAIL}</a>. We usually reply within one business day, in Arabic or English.', f'راسلنا على <a href="mailto:{SUPPORT_EMAIL}">{SUPPORT_EMAIL}</a>. نرد عادة خلال يوم عمل، بالعربي أو الإنجليزي.')}</p></div>
{rows}
</main>'''
    return page('Support · Adro', 'الدعم · ادرو', 'Get help with Adro.', body, 'support')


if __name__ == '__main__':
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / 'index.html').write_text(home())
    (OUT / 'privacy.html').write_text(legal_page('PRIVACY', 'Privacy policy', 'سياسة الخصوصية'))
    (OUT / 'terms.html').write_text(legal_page('TERMS', 'Terms of use', 'شروط الاستخدام'))
    (OUT / 'support.html').write_text(support())
    missing = [a for n in ('PRIVACY', 'TERMS') for p in pairs(n) for a in p if a not in AR]
    print('built', sorted(p.name for p in OUT.glob('*.html')), 'missing Arabic:', missing)
