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


def page(title_en, title_ar, desc, body, path, dark=False):
    return f'''<!doctype html>
<html lang="en" dir="ltr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title data-en="{html.escape(title_en)}" data-ar="{html.escape(title_ar)}">{html.escape(title_en)}</title>
<meta name="description" content="{html.escape(desc)}">
<meta name="theme-color" content="{"#000000" if dark else "#FFFFFF"}">
<meta property="og:title" content="{html.escape(title_en)}">
<meta property="og:description" content="{html.escape(desc)}">
<meta property="og:type" content="website">
<meta property="og:image" content="/site/img/og.png">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" type="image/png" href="/icons/icon-192.png">
<link rel="apple-touch-icon" href="/icons/apple-touch-icon.png">
{FONTS}
<style>{CSS}{HOME_CSS if dark else ""}</style>
{LANG_JS}
</head>
<body{' class="dk"' if dark else ''}>
<nav class="top{" dark" if dark else ""}"><div class="wrap nav">
<a href="/site" aria-label="Adro">{logo(24)}</a>
<div class="links"><a href="/site#bento">{t('Features', 'المميزات')}</a><a href="/site#devices">{t('Watches', 'الساعات')}</a><a href="/site#pricing">{t('Pricing', 'الأسعار')}</a><a href="/site#faq">{t('FAQ', 'الأسئلة')}</a></div>
<button class="lang" type="button" onclick="setLang(document.documentElement.lang==='ar'?'en':'ar')" aria-label="Change language">{t('ع', 'EN')}</button>
<a class="btn dark" href="{APP_URL}">{t('Open Adro', 'افتح ادرو')}</a>
</div></nav>
{body}
<footer><div class="wrap foot">
<div style="display:flex;align-items:center;gap:14px">{logo(20)}<span>© 2026 Adro</span></div>
<nav aria-label="Footer"><a href="/site/privacy">{t('Privacy', 'الخصوصية')}</a><a href="/site/terms">{t('Terms', 'الشروط')}</a><a href="/site/support">{t('Support', 'الدعم')}</a><a href="{APP_URL}">{t('Web app', 'نسخة الويب')}</a></nav>
</div></footer>
{HOME_JS if dark else ""}
</body>
</html>
'''


def store_buttons():
    return (f'<span class="btn store" aria-disabled="true"><small>{t("Coming soon on the", "قريباً على")}</small><b>App Store</b></span>'
            f'<span class="btn store" aria-disabled="true"><small>{t("Coming soon on", "قريباً على")}</small><b>Google Play</b></span>')


def phone(name, alt_en, alt_ar, eager=False):
    return (f'<div class="phone"><img src="/site/img/{name}-en.webp" data-en="/site/img/{name}-en.webp" data-ar="/site/img/{name}-ar.webp" '
            f'width="585" height="1266" alt="{html.escape(alt_en)}" {"" if eager else "loading=\"lazy\""}></div>')


HOME_CSS = '''
/* ---------- home: Apple-style ---------- */
body.dk{background:#000}body.dk footer{color:#86868B}body.dk .foot{border-top-color:#27272A}body.dk .foot a:hover{color:#fff}body.dk footer .logo{color:#F5F5F7}
body.dk main section:not(.blk):not(.gry){background:#fff}
nav.top.dark{background:rgba(0,0,0,.72);color:#fff}nav.top.dark .logo{color:#fff}nav.top.dark .links a{color:#A1A1AA}nav.top.dark .links a:hover{color:#fff}
nav.top.dark .lang{background:transparent;color:#fff;border-color:#3F3F46}nav.top.dark .btn.dark{background:#fff;color:var(--ink)}nav.top.dark.scrolled{border-bottom-color:#27272A}
.blk{background:#000;color:#F5F5F7}.blk .sub2{color:#86868B}.gry{background:#F5F5F7}
.center{text-align:center}.sub2{color:#6E6E73;font-size:clamp(18px,2.2vw,24px);line-height:1.45;max-width:720px;margin:18px auto 0;font-weight:500}
html[lang=ar] .sub2{font-weight:400}
.mega{font-size:clamp(44px,8.4vw,104px);letter-spacing:-.035em;line-height:1.02}
html[lang=ar] .mega{letter-spacing:0;line-height:1.2}
.big{font-size:clamp(36px,5.6vw,72px);letter-spacing:-.03em;line-height:1.05}
html[lang=ar] .big{letter-spacing:0;line-height:1.25}
.grad{background:linear-gradient(90deg,#7D93FF,#3355FF 55%,#9FB1FF);-webkit-background-clip:text;background-clip:text;color:transparent}
/* hero */
.h-hero{padding:120px 0 0;overflow:hidden;position:relative}
.h-hero .ctas{justify-content:center;margin-top:30px}
.h-hero .btn.store{background:#1D1D1F;color:#fff}.h-hero .note{color:#86868B;text-align:center}
.h-stage{position:relative;height:clamp(420px,62vw,700px);margin-top:56px;display:flex;justify-content:center}
.h-stage:before{content:"";position:absolute;width:min(900px,120vw);height:600px;top:12%;left:50%;transform:translateX(-50%);background:radial-gradient(closest-side,rgba(51,85,255,.55),transparent);filter:blur(30px)}
.h-stage .phone{width:clamp(250px,30vw,360px);position:absolute;top:0;transform-origin:50% 0;will-change:transform}
.h-stage .phone.side{width:clamp(200px,23vw,280px);top:18%;opacity:.9}
.h-stage .phone.l{transform:translateX(-78%) rotate(-6deg)}.h-stage .phone.r{transform:translateX(78%) rotate(6deg)}
@media(max-width:700px){.h-stage .phone.side{display:none}}
/* readiness */
.ready{padding:130px 0}.ring-big{width:min(340px,70vw);margin:56px auto 0;position:relative}
.ring-big svg{width:100%;height:auto;display:block}.ring-big .val{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center}
.ring-big .num{font:700 clamp(64px,11vw,104px) Sora;letter-spacing:-.04em;line-height:1}.ring-big .lbl{color:#6E6E73;font-weight:600;margin-top:6px}
.ring-big circle.fill{transition:stroke-dashoffset 1.8s cubic-bezier(.2,.7,.2,1)}
.pills{display:flex;flex-wrap:wrap;gap:10px;justify-content:center;margin-top:40px}
.pill{background:#fff;border:1px solid var(--line);border-radius:22px;padding:10px 18px;font-weight:600;font-size:15px}
/* bento */
.bento{display:grid;grid-template-columns:repeat(6,1fr);grid-auto-rows:minmax(220px,auto);gap:16px;margin-top:56px}
.tile{background:#fff;border-radius:30px;padding:30px;position:relative;overflow:hidden;display:flex;flex-direction:column}
.tile.dk{background:#000;color:#F5F5F7}.tile.bl{background:var(--blue);color:#fff}
.tile .t-k{font-weight:700;font-size:15px;color:#6E6E73}.tile.dk .t-k,.tile.bl .t-k{color:rgba(255,255,255,.7)}
.tile .t-n{font:700 clamp(48px,6vw,76px) Sora;letter-spacing:-.04em;line-height:1;margin:8px 0}
.tile .t-n{direction:ltr}html[dir=rtl] .tile .t-n{text-align:right}
.tile .t-h{font-size:clamp(22px,2.4vw,28px);font-weight:700;line-height:1.2;margin-top:auto}
.tile p{margin:8px 0 0;color:#6E6E73;font-size:16px}.tile.dk p{color:#A1A1AA}.tile.bl p{color:rgba(255,255,255,.85)}
.s2{grid-column:span 2}.s3{grid-column:span 3}.s4{grid-column:span 4}.r2{grid-row:span 2}
.tile .peek{position:absolute;inset-inline-end:-30px;bottom:-140px;width:58%;border-radius:30px;box-shadow:0 20px 50px rgba(0,0,0,.18)}
.chat{display:flex;flex-direction:column;gap:8px;margin-top:18px}.bub{max-width:85%;padding:10px 14px;border-radius:18px;font-size:15px;line-height:1.4}
.bub.me{align-self:flex-end;background:var(--blue);color:#fff;border-end-end-radius:6px}.bub.ai{align-self:flex-start;background:#1D1D1F;color:#F5F5F7;border-end-start-radius:6px}
html[dir=rtl] .bub.me{align-self:flex-start}html[dir=rtl] .bub.ai{align-self:flex-end}
@media(max-width:900px){.bento{grid-template-columns:repeat(2,1fr)}.s2,.s3,.s4{grid-column:span 2}.r2{grid-row:span 1}.tile.half{grid-column:span 1}}
@media(max-width:520px){.tile{padding:24px;border-radius:24px}.tile.half{grid-column:span 2}}
/* sticky story */
.story{display:grid;grid-template-columns:1fr 1fr;gap:60px;margin-top:40px}
.story .stick{position:sticky;top:90px;height:calc(100vh - 120px);display:flex;align-items:center;justify-content:center}
.story .phone{width:min(300px,30vw,calc((100vh - 160px) * .462))}.story .phone img{transition:opacity .35s}
.step{min-height:78vh;display:flex;flex-direction:column;justify-content:center;opacity:.25;transition:opacity .4s}
.step.on{opacity:1}.step .k{margin-bottom:10px}.step h3{font-size:clamp(34px,4.4vw,56px);letter-spacing:-.03em}
html[lang=ar] .step h3{letter-spacing:0}.step p{font-size:clamp(18px,1.8vw,21px);color:#6E6E73;margin:16px 0 0;max-width:440px}
.step .inl{display:none}
@media(max-width:860px){.story{grid-template-columns:1fr;gap:0}.story .stick{display:none}.step{min-height:auto;opacity:1;padding:40px 0;text-align:center;align-items:center}.step p{margin-inline:auto}.step .inl{display:block;margin-top:32px}.step .inl .phone{width:min(270px,72vw)}}
/* devices */
.devs{display:flex;flex-wrap:wrap;justify-content:center;gap:6px 28px;margin-top:48px;font:700 clamp(26px,4vw,48px) Sora;letter-spacing:-.02em}
.devs span{color:#3A3A3C}.devs span.on{color:#fff}.devs span.on:after{content:"";display:inline-block;width:.32em;height:.32em;border-radius:50%;background:var(--blue);margin-inline-start:.18em;vertical-align:.5em}
/* pricing */
.plans{display:grid;grid-template-columns:1fr 1fr;gap:16px;max-width:900px;margin:56px auto 0}
.plan{background:#fff;border-radius:30px;padding:36px;text-align:start}.plan.pro{background:#000;color:#F5F5F7}
.plan .amount{font:700 56px Sora;letter-spacing:-.03em;margin:16px 0 0}.plan .amount small{font:600 17px Manrope;color:#6E6E73}
.plan.pro .amount small,.plan.pro .per{color:#86868B}.plan .per{color:#6E6E73;font-size:15px}
.plan ul{list-style:none;padding:0;margin:26px 0 0;display:grid;gap:12px}.plan li{display:flex;gap:10px;font-size:16px}
.plan li:before{content:"✓";color:var(--blue);font-weight:800}.plan.pro li:before{color:#8FA3FF}
@media(max-width:700px){.plans{grid-template-columns:1fr}}
/* end */
.end{padding:140px 0}.end .ctas{justify-content:center;margin-top:34px}.end .btn.store{background:#1D1D1F;color:#fff}
/* reveal */
.rv{opacity:0;transform:translateY(36px);transition:opacity .9s ease,transform .9s cubic-bezier(.2,.7,.2,1)}.rv.in{opacity:1;transform:none}
.rv.d1{transition-delay:.08s}.rv.d2{transition-delay:.16s}.rv.d3{transition-delay:.24s}
@media (prefers-reduced-motion:reduce){.rv{opacity:1;transform:none}.ring-big circle.fill{transition:none}}
'''

HOME_JS = '''<script>
(function(){
var red=matchMedia('(prefers-reduced-motion: reduce)').matches;
function lang(){return document.documentElement.lang}
// fade sections in as they arrive
var io=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){e.target.classList.add('in');io.unobserve(e.target)}})},{threshold:.15});
document.querySelectorAll('.rv').forEach(function(el){red?el.classList.add('in'):io.observe(el)});
// the readiness ring fills and counts up once
var rg=document.querySelector('.ring-big');if(rg){var f=rg.querySelector('circle.fill'),n=rg.querySelector('.num'),L=+f.dataset.len,to=+rg.dataset.to;
 var go=function(){f.style.strokeDashoffset=L*(1-to/100);if(red){n.textContent=to;return}var s=performance.now();(function tick(t){var k=Math.min(1,(t-s)/1800);k=1-Math.pow(1-k,3);n.textContent=Math.round(to*k);if(k<1)requestAnimationFrame(tick)})(s)};
 var o2=new IntersectionObserver(function(es){if(es[0].isIntersecting){go();o2.disconnect()}},{threshold:.5});o2.observe(rg)}
// numbers in the tiles count up
document.querySelectorAll('[data-count]').forEach(function(el){var to=+el.dataset.count,suf=el.dataset.suf||'';
 var o3=new IntersectionObserver(function(es){if(!es[0].isIntersecting)return;o3.disconnect();if(red){el.textContent=to+suf;return}var s=performance.now(),d=1200;
 (function tick(t){var k=Math.min(1,(t-s)/d);k=1-Math.pow(1-k,3);var v=to*k;el.textContent=(to%1?v.toFixed(1):Math.round(v))+suf;if(k<1)requestAnimationFrame(tick)})(s)},{threshold:.6});o3.observe(el)});
// hero phones rise and settle while scrolling
var hp=document.querySelector('.h-stage .phone.c');var sides=document.querySelectorAll('.h-stage .phone.side');
if(hp&&!red){var raf=0;addEventListener('scroll',function(){if(raf)return;raf=requestAnimationFrame(function(){raf=0;var y=Math.min(1,scrollY/600);
 hp.style.transform='translateY('+(-y*40)+'px) scale('+(1+y*.06)+')';sides.forEach(function(s){var l=s.classList.contains('l');s.style.transform='translateX('+(l?-1:1)*(78+y*14)+'%) rotate('+(l?-1:1)*(6+y*4)+'deg)'})})},{passive:true})}
// sticky story: the phone shows the step you are reading
var steps=document.querySelectorAll('.step'),img=document.querySelector('.story .stick img');
if(steps.length&&img){var cur='';var o4=new IntersectionObserver(function(es){es.forEach(function(e){if(!e.isIntersecting)return;steps.forEach(function(s){s.classList.toggle('on',s===e.target)});
 var nm=e.target.dataset.shot;if(nm===cur)return;cur=nm;img.style.opacity=0;setTimeout(function(){var l=lang();img.setAttribute('data-en','/site/img/'+nm+'-en.webp');img.setAttribute('data-ar','/site/img/'+nm+'-ar.webp');img.src='/site/img/'+nm+'-'+l+'.webp';img.onload=function(){img.style.opacity=1}},red?0:200)})},{rootMargin:'-45% 0px -45% 0px'});steps.forEach(function(s){o4.observe(s)})}
})();
</script>'''


def home():
    rr = 42
    rc = 2 * math.pi * rr
    ring_big = (f'<div class="ring-big rv" data-to="78"><svg viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="{rr}" fill="none" stroke="#E8E8ED" stroke-width="10"/>'
                f'<circle class="fill" data-len="{rc:.1f}" cx="50" cy="50" r="{rr}" fill="none" stroke="var(--blue)" stroke-width="10" stroke-linecap="round" '
                f'stroke-dasharray="{rc:.1f}" stroke-dashoffset="{rc:.1f}" transform="rotate(-90 50 50)"/></svg>'
                f'<div class="val"><div class="num">0</div><div class="lbl">{t("% ready today", "٪ جاهزيتك اليوم")}</div></div></div>')

    def step(shot, k_en, k_ar, h_en, h_ar, p_en, p_ar):
        return (f'<div class="step" data-shot="{shot}"><div class="k">{t(k_en, k_ar)}</div><h3>{t(h_en, h_ar)}</h3><p>{t(p_en, p_ar)}</p>'
                f'<div class="inl">{phone(shot, h_en, h_ar)}</div></div>')

    steps = ''.join([
        step('train', 'Plan', 'خطّط', 'Your week. Planned.', 'أسبوعك. مخطط.',
             'Pick your goal, days and equipment once. Every set comes with the right weight, and a missed day moves with one tap.',
             'اختر هدفك وأيامك وأدواتك مرة وحدة. كل مجموعة معها الوزن المناسب، واليوم اللي يفوتك ينتقل بضغطة.'),
        step('food', 'Log', 'سجّل', 'Snap. Scan. Say it.', 'صوّر. امسح. قول.',
             'A photo of your plate, a barcode, or one sentence. It knows kabsa, mandi, karak and the food you actually eat.',
             'صورة صحنك، أو باركود، أو جملة وحدة. يعرف الكبسة والمندي والكرك والأكل اللي فعلاً تاكله.'),
        step('recovery', 'Recover', 'استشفِ', 'Push. Or rest.', 'اضغط. أو ارتاح.',
             'One score every morning from your sleep, soreness, energy, training load and watch. And a clear plan for today.',
             'درجة وحدة كل صباح من نومك وتعبك وطاقتك وحمل التمرين وساعتك. وخطة واضحة لليوم.'),
        step('progress', 'Progress', 'تقدّم', 'See it working.', 'شوف النتيجة.',
             'Weight, strength, sleep and streaks, with a weekly recap that tells you the next step.',
             'الوزن والقوة والنوم والاستمرارية، مع ملخص أسبوعي يقولك الخطوة الجاية.'),
    ])
    devices = [('Apple Health', 1), ('Apple Watch', 0), ('Health Connect', 1), ('WHOOP', 1), ('Oura', 1), ('Polar', 1), ('Galaxy Watch', 0), ('Garmin', 0), ('Fitbit', 0), ('Withings', 0)]
    devs = ''.join(f'<span class="{"on" if on else ""}">{d}</span>' for d, on in devices)
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
<header class="h-hero blk center"><div class="wrap">
<div class="k rv" style="color:#8FA3FF">{t('Introducing Adro', 'نقدّم لك ادرو')}</div>
<h1 class="mega rv d1" style="margin-top:14px">{t('Your AI<br><span class="grad">gym coach.</span>', 'مدربك <span class="grad">الذكي</span><br>في الجم.')}</h1>
<p class="sub2 rv d2">{t('Training, food and recovery in one app. Built for the Gulf, in Arabic and English.', 'التمرين والأكل والاستشفاء في تطبيق واحد. مصمم للخليج، بالعربي والإنجليزي.')}</p>
<div class="ctas rv d3"><a class="btn blue" href="{APP_URL}">{t('Start free', 'ابدأ مجاناً')}</a>{store_buttons()}</div>
<div class="h-stage">
<div class="phone side l"><img src="/site/img/food-en.webp" data-en="/site/img/food-en.webp" data-ar="/site/img/food-ar.webp" width="585" height="1266" alt=""></div>
<div class="phone side r"><img src="/site/img/recovery-en.webp" data-en="/site/img/recovery-en.webp" data-ar="/site/img/recovery-ar.webp" width="585" height="1266" alt=""></div>
<div class="phone c"><img src="/site/img/home-en.webp" data-en="/site/img/home-en.webp" data-ar="/site/img/home-ar.webp" width="585" height="1266" alt="{t('Adro home screen', 'الشاشة الرئيسية في ادرو')}"></div>
</div>
</div></header>

<section class="ready center"><div class="wrap">
<h2 class="big rv">{t('It knows your body.', 'يعرف جسمك.')}</h2>
<p class="sub2 rv d1">{t('Sleep, soreness, energy, training load and your watch become one number every morning. Then Adro tells you to push, or to go easy.', 'نومك وتعبك وطاقتك وحمل التمرين وساعتك يصيرون رقم واحد كل صباح. وبعدها ادرو يقولك اضغط، أو خفّف.')}</p>
{ring_big}
<div class="pills rv">{''.join(f'<span class="pill">{t(a, b)}</span>' for a, b in [('Sleep', 'النوم'), ('HRV', 'HRV'), ('Resting heart rate', 'نبض الراحة'), ('Soreness', 'التعب'), ('Training load', 'حمل التمرين')])}</div>
</div></section>

<section id="bento" class="gry"><div class="wrap">
<div class="center"><h2 class="big rv">{t('Everything. In one place.', 'كل شي. في مكان واحد.')}</h2>
<p class="sub2 rv d1">{t('One app instead of five, so every answer fits your real day.', 'تطبيق واحد بدل خمسة، عشان كل جواب يناسب يومك الحقيقي.')}</p></div>
<div class="bento">
<div class="tile dk s4 r2 rv"><div class="t-k">{t('AI coach', 'المدرب الذكي')}</div><div class="t-h" style="margin-top:6px">{t('Ask in Arabic or English. It answers with your numbers.', 'اسأله بالعربي أو الإنجليزي. يجاوبك بأرقامك.')}</div>
<div class="chat"><div class="bub me">{t('I slept 5 hours. Should I still train legs?', 'نمت 5 ساعات. أتمرن رجل اليوم؟')}</div>
<div class="bub ai">{t('Your HRV is 18% under your usual and you slept 2 hours less. Do legs, but drop one set each and keep it at RPE 7.', 'الـ HRV عندك أقل من عادتك بـ 18٪ ونمت أقل بساعتين. تمرّن رجل، بس نقّص مجموعة من كل تمرين وخلّه متوسط.')}</div>
<div class="bub me">{t('I ate chicken kabsa for lunch', 'تغديت كبسة دجاج')}</div>
<div class="bub ai">{t('Logged: chicken kabsa, 810 kcal, 52 g protein. You have 1,210 kcal left.', 'سجّلتها: كبسة دجاج، 810 سعرة، 52 جم بروتين. باقي لك 1,210 سعرة.')}</div></div></div>
<div class="tile bl s2 rv d1"><div class="t-k">{t('From one photo', 'من صورة وحدة')}</div><div class="t-n" data-count="810">810</div><div class="t-h" style="margin-top:0">{t('kcal, protein, carbs and fat', 'سعرة، وبروتين، وكارب، ودهون')}</div></div>
<div class="tile s2 rv d2"><div class="t-k">{t('Connect directly', 'ربط مباشر')}</div><div class="t-n" data-count="5">5</div><p>{t('Apple Health, Health Connect, WHOOP, Oura and Polar. Plus everything that syncs to them.', 'Apple Health و Health Connect و WHOOP و Oura و Polar. وكل شي يتزامن معهم.')}</p></div>
<div class="tile s2 half rv"><div class="t-k">{t('Set coach', 'مدرب المجموعات')}</div><div class="t-n" data-count="2.5" data-suf=" kg">2.5 kg</div><p>{t('more on the bar, when you’re ready. Not before.', 'زيادة على البار لما تكون جاهز. مو قبل.')}</p></div>
<div class="tile s2 half rv d1"><div class="t-k">{t('Missed a workout?', 'فوّت تمرين؟')}</div><div class="t-n" data-count="1">1</div><p>{t('tap moves it, and the rest of your week follows.', 'ضغطة تنقله، وباقي أسبوعك يمشي معه.')}</p></div>
<div class="tile dk s2 rv d2"><div class="t-k">{t('Every week', 'كل أسبوع')}</div><div class="t-h">{t('A weekly recap, and one tap to apply the next step.', 'ملخص أسبوعي، وضغطة وحدة تطبّق الخطوة الجاية.')}</div></div>
</div>
</div></section>

<section><div class="wrap">
<div class="center"><h2 class="big rv">{t('How it works.', 'كيف يشتغل.')}</h2></div>
<div class="story"><div class="steps">{steps}</div>
<div class="stick"><div class="phone"><img src="/site/img/train-en.webp" data-en="/site/img/train-en.webp" data-ar="/site/img/train-ar.webp" width="585" height="1266" alt=""></div></div></div>
</div></section>

<section id="devices" class="blk center" style="padding:130px 0"><div class="wrap">
<h2 class="big rv">{t('Your watch.<br>Your ring. Your scale.', 'ساعتك.<br>خاتمك. ميزانك.')}</h2>
<p class="sub2 rv d1">{t('The blue ones connect straight to Adro. The rest come in through Apple Health or Health Connect.', 'اللي عليها نقطة زرقاء ترتبط مباشرة مع ادرو. والباقي يوصل عن طريق Apple Health أو Health Connect.')}</p>
<div class="devs rv d2">{devs}</div>
</div></section>

<section id="pricing" class="gry center" style="padding:120px 0"><div class="wrap">
<h2 class="big rv">{t('Start free.', 'ابدأ مجاناً.')}</h2>
<p class="sub2 rv d1">{t('Go Pro when you want more.', 'واشترك في Pro لما تبي أكثر.')}</p>
<div class="plans">
<div class="plan rv"><h3>{t('Free', 'مجاني')}</h3><div class="amount">0 <small>{t('SAR', 'ريال')}</small></div><div class="per">{t('Forever', 'للأبد')}</div>
<ul><li>{t('Workout plans and the set coach', 'خطط التمارين ومدرب المجموعات')}</li><li>{t('Food log, calories and macros', 'تسجيل الأكل والسعرات والماكروز')}</li><li>{t('Recovery score and progress', 'درجة الاستشفاء والتقدّم')}</li><li>{t('A taste of the AI coach every day', 'تجربة يومية للمدرب الذكي')}</li></ul></div>
<div class="plan pro rv d1"><h3>Adro Pro</h3><div class="amount">39 <small>{t('SAR / month', 'ريال / شهر')}</small></div><div class="per">{t('or 299 SAR a year', 'أو 299 ريال بالسنة')}</div>
<ul><li>{t('More AI coach and food photos', 'مدرب ذكي وصور أكل أكثر')}</li><li>{t('Morning readiness note from your watch', 'ملاحظة الجاهزية كل صباح من ساعتك')}</li><li>{t('3-month trends and PDF reports', 'رسوم 3 شهور وتقارير PDF')}</li><li>{t('Weekly recap with one-tap changes', 'ملخص أسبوعي وتعديل بضغطة')}</li></ul></div>
</div>
</div></section>

<section id="faq"><div class="wrap" style="max-width:820px">
<h2 class="big rv" style="margin-bottom:30px">{t('Questions.', 'أسئلة.')}</h2>
{faq}
</div></section>

<section class="end blk center"><div class="wrap">
{ring(64, 'var(--blue)', 20)}
<h2 class="mega rv" style="margin-top:26px">{t('Your next workout<br>is ready.', 'تمرينك الجاي<br>جاهز.')}</h2>
<div class="ctas rv d1"><a class="btn blue" href="{APP_URL}">{t('Start free', 'ابدأ مجاناً')}</a>{store_buttons()}</div>
</div></section>
</main>'''
    return page('Adro: your AI gym coach', 'ادرو: مدربك الذكي في الجم',
                'Training, food and recovery in one app, in Arabic and English. Your AI gym coach that reads your watch.', body, '', dark=True)


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
