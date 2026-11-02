// Ad teaser phone screens (based on store-shot.js): real app screens with sample data (no real accounts; every server call is answered here),
// then each framed with a headline at Apple's 6.9" size (1320 x 2868). Usage: node store-shot.js en|ar
const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, 'app');
const OUT = path.join(__dirname, 'teaser', 'screens');
fs.mkdirSync(OUT, { recursive: true });
const lang = process.argv[2] === 'ar' ? 'ar' : 'en';
const ME = '11111111-1111-4111-8111-111111111111';
const ALI = '22222222-2222-4222-8222-222222222222';
const SARA = '33333333-3333-4333-8333-333333333333';
const now = Date.now();
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const jwt = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: ME, exp: Math.floor(now / 1000) + 3600, role: 'authenticated' })}.sig`;
const user = { id: ME, email: 'demo@example.com', aud: 'authenticated', role: 'authenticated', created_at: new Date(now - 60 * 864e5).toISOString() };
const session = { access_token: jwt, refresh_token: 'r', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(now / 1000) + 3600, user };
const ds = (n) => { const d = new Date(now - n * 864e5); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const at = (h, m = 0) => { const d = new Date(); d.setHours(h, m, 0, 0); return d.toISOString(); };
const today = ds(0);
const AR = lang === 'ar';

const profile = { id: ME, username: 'ahmed', name: AR ? 'أحمد' : 'Ahmed', gender: 'male', date_of_birth: '1998-04-01', height_cm: 178, weight_kg: 82, language: lang, account_type: 'member' };
const plan = { goal: 1, kcal: 2450, protein: 165, weight: 82, height: 178, water: 3000 };
let MODE = 'none';
const breakfast = [{ id: 'b0', user_id: ME, day: ds(0), meal: 'Breakfast', name: AR ? 'بيض ولبنة وخبز' : 'Eggs, labneh and bread', kcal: 520, protein: 38, carbs: 34, fat: 24, sugar_high: false, fat_high: false, food_id: null, plan_key: null, created_at: new Date().toISOString() }];
const foodAll = [
  ['Breakfast', AR ? 'بيض وتوست أسمر' : 'Eggs and brown toast', 420, 26, 32, 18, at(8, 10)],
  ['Lunch', AR ? 'كبسة دجاج' : 'Chicken kabsa', 690, 48, 78, 16, at(13, 30)],
  ['Snack', AR ? 'بروتين شيك مع موز' : 'Protein shake with banana', 260, 32, 28, 3, at(16, 40)],
].map(([meal, name, kcal, protein, carbs, fat, created_at], i) => ({ id: `f${i}`, user_id: ME, day: today, meal, name, kcal, protein, carbs, fat, sugar_high: false, fat_high: false, food_id: null, plan_key: null, created_at }));
const weights = Array.from({ length: 30 }, (_, i) => ({ day: ds(29 - i), kind: 'weight', value: Math.round((83.4 - i * 0.062 + Math.sin(i * 1.7) * 0.18) * 10) / 10 })).map((w, i, a) => (i === a.length - 1 ? { ...w, value: 81.6 } : w));
const water = [500, 500, 330, 500].map((ml, i) => ({ id: `w${i}`, ml, kind: 'Water', created_at: at(9 + i * 2) }));

const ex = (id, sets, reps) => ({ id, sets, reps: String(reps) });
const workouts = {
  Push: { ex: [ex('chestpress', 4, 8), ex('shoulder', 3, 10), ex('pecdeck', 3, 12), ex('lateral', 3, 15), ex('pushdown', 3, 12)], focus: 'Push', min: 60 },
  Pull: { ex: [ex('pulldown', 4, 10), ex('cablerow', 3, 10), ex('facepull', 3, 15), ex('curl', 3, 12)], focus: 'Pull', min: 55 },
  Legs: { ex: [ex('squat', 4, 8), ex('legpress', 3, 10), ex('legcurl', 3, 12), ex('calf', 4, 15)], focus: 'Legs', min: 60 },
};
const order = ['Push', 'Pull', 'Legs', 'Rest', 'Push', 'Pull', 'Legs'];
const todayIdx = new Date().getDay();
const week = Array.from({ length: 7 }, (_, i) => ({ w: order[(i - todayIdx + 7) % 7], lock: false }));
const tplan = { level: 'Intermediate', days: 6, injuries: [], split: 'ppl', week, workouts, machines: {}, homeMode: false, skipped: {}, dismiss: {}, since: ds(60), weekSince: ds(60), lightAsked: today };
const logs = [1, 2, 3, 5, 6, 7, 8, 9, 10].map((n, i) => {
  const name = order[(todayIdx - n + 70) % 7] === 'Rest' ? 'Legs' : order[(todayIdx - n + 70) % 7];
  return { id: `L${i}`, user_id: ME, day: ds(n), name, started_at: new Date(now - n * 864e5).toISOString(), minutes: 58, volume: 7200 + i * 140, sets_done: 17, kcal: 420, exercises: [{ id: 'chestpress', n: 'Chest press', sets: [{ w: 70 + i, r: 8 }, { w: 75, r: 8 }] }], prs: i === 0 ? [{ id: 'chestpress', n: 'Chest press', w: 80 }] : [], ups: 0, downs: 0 };
});
const chat = [
  ['user', AR ? 'تعبان اليوم ونمت 5 ساعات بس، أتمرن ولا لا؟' : 'I only slept 5 hours and feel tired. Should I still train today?'],
  ['ai', AR ? 'تمرن بس خففها: نفس تمارين الدفع، جولتين بدل ثلاث، وأوزانك أقل 10%. نومك القليل يرفع النبض ويقلل قوتك، فالهدف اليوم تحافظ على الاستمرار مو أرقام جديدة.\n\nوبكرة لو نمت 7 ساعات نرجع للخطة كاملة.' : 'Train, but lighter: same Push workout, 2 sets instead of 3, and 10% less weight. Short sleep raises your heart rate and lowers your strength, so today is about keeping the streak, not new records.\n\nIf you sleep 7 hours tonight, we go back to the full plan tomorrow.'],
  ['user', AR ? 'وكم بروتين باقي لي اليوم؟' : 'How much protein do I have left today?'],
  ['ai', AR ? 'أكلت 106 جرام من 165، باقي لك 59 جرام. عشاء مثل 200 جرام سلمون مع رز يغطيها تقريباً كلها.' : 'You’ve had 106 g of 165 g, so 59 g left. A dinner like 200 g of salmon with rice covers almost all of it.'],
].map(([role, text], i) => ({ id: `c${i}`, chat_id: 'chat1', role, text, actions: null, card: null, created_at: new Date(now - (10 - i) * 60000).toISOString() }));

const done = (w, r) => ({ w, r, done: true });
const open = { w: null, r: null, done: false };
const gw = [{ id: 'chestpress', type: 0 }, { id: 'shoulder', type: 0 }, { id: 'pecdeck', type: 1 }, { id: 'lateral', type: 1 }, { id: 'pushdown', type: 1 }];
const board = [
  { user_id: ME, name: profile.name, username: 'ahmed', level: 'Intermediate', joined: true, done: {}, updated_at: new Date().toISOString(), pos: 0, sets: { chestpress: { reps: 8, sets: [done(70, 8), done(75, 8), open, open] } } },
  { user_id: ALI, name: AR ? 'علي' : 'Ali', username: 'ali', level: 'Intermediate', joined: true, done: {}, updated_at: new Date().toISOString(), pos: 1, sets: { chestpress: { reps: 8, sets: [done(65, 8), done(70, 8), open, open] } } },
  { user_id: SARA, name: AR ? 'فهد' : 'Fahad', username: 'fahad', level: 'Beginner', joined: true, done: {}, updated_at: new Date().toISOString(), pos: 2, sets: { chestpress: { reps: 10, sets: [done(40, 10), open, open] } } },
];
const group = { id: 'g1', host: ME, workout: gw, status: 'live', started_at: new Date(now - 18 * 60000).toISOString(), scheduled_at: null, title: 'Push' };

const pk = (price, inc) => [{ id: 'm1', name: 'Monthly', months: 1, weeks: 4, on: true, price, desc: '', inc, absorb: 0 }, { id: 'm3', name: '3 months', months: 3, weeks: 12, on: true, price: price * 2.6, desc: '', inc, absorb: 50 }];
const coachRow = (id, name, type, gym, city, years, clients, spots, sp, price) => ({ id, name, username: name.toLowerCase().replace(/\s/g, ''), bio: '', specialties: sp, city, gym, price_month: price, years, clients, coach_type: type, packages: pk(price, ['Custom workout plan', 'Custom meal plan', 'Chat with your coach', 'Weekly check-in']), spots, socials: {}, hours: [], listed: true });
const coaches = AR
  ? [coachRow('k1', 'سلطان', 'Both', 'Iron Club', 'الرياض', 8, 14, 20, ['Fat loss', 'Muscle'], 450), coachRow('k2', 'نورة', 'Online', '', 'جدة', 5, 9, 15, ['Women', 'Nutrition'], 350), coachRow('k3', 'خالد', 'Personal', 'Pulse Gym', 'الدمام', 11, 18, 20, ['Strength', 'Rehab'], 600)]
  : [coachRow('k1', 'Sultan', 'Both', 'Iron Club', 'Riyadh', 8, 14, 20, ['Fat loss', 'Muscle'], 450), coachRow('k2', 'Noura', 'Online', '', 'Jeddah', 5, 9, 15, ['Women', 'Nutrition'], 350), coachRow('k3', 'Khalid', 'Personal', 'Pulse Gym', 'Dammam', 11, 18, 20, ['Strength', 'Rehab'], 600)];

function answer(url, accept) {
  const u = new URL(url);
  const p = u.pathname;
  const one = (accept || '').includes('vnd.pgrst.object');
  const day = u.searchParams.get('day');
  if (p.startsWith('/auth/v1/user')) return user;
  if (p.startsWith('/auth/v1/')) return session;
  if (p === '/rest/v1/profiles') return one ? profile : [profile];
  if (p === '/rest/v1/food_plans') { const fp = { user_id: ME, setup_done: true, plan }; return one ? fp : [fp]; }
  if (p === '/rest/v1/food_logs') return MODE === 'breakfast' && (!day || day === `eq.${today}`) ? breakfast : [];
  if (p === '/rest/v1/water_logs') return [];
  if (p === '/rest/v1/measurements') return weights;
  if (p === '/rest/v1/train_plans') { const r = { user_id: ME, plan: tplan, setup_done: true }; return one ? r : [r]; }
  if (p === '/rest/v1/workout_logs') return one ? logs[0] : logs;
  if (p === '/rest/v1/chat_messages') return one ? chat[chat.length - 1] : [...chat].reverse();
  if (p === '/rest/v1/group_sessions') return one ? group : [group];
  if (p === '/rest/v1/rpc/group_session_board') return board;
  if (p === '/rest/v1/rpc/gate_on') return false;
  if (p === '/rest/v1/rpc/list_coaches') return coaches;
  if (p.startsWith('/rest/v1/rpc/')) return null;
  return one ? null : [];
}

const SHOTS = [['home', '/home', 'none'], ['progress', '/progress', 'none'], ['food', '/food', 'breakfast']];

(async () => {
  const srv = http
    .createServer((req, res) => {
      let f = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
      if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) {
        const html = f.endsWith('/') ? null : `${f}.html`;
        f = html && fs.existsSync(html) ? html : path.join(ROOT, 'index.html');
      }
      res.setHeader('Content-Type', { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.png': 'image/png', '.ttf': 'font/ttf', '.json': 'application/json' }[path.extname(f)] || 'application/octet-stream');
      fs.createReadStream(f).pipe(res);
    })
    .listen(8099);
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, colorScheme: 'dark' });
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  await p.route('https://utvhvzwkwhocdbiutavg.supabase.co/**', (route) => {
    const r = route.request();
    if (r.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } });
    return route.fulfill({ status: 200, headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' }, body: JSON.stringify(answer(r.url(), r.headers()['accept'])) });
  });
  await p.addInitScript(([s, l]) => {
    localStorage.setItem('sb-utvhvzwkwhocdbiutavg-auth-token', s);
    localStorage.setItem('adro.trusted.v1', JSON.stringify([JSON.parse(s).user.id]));
    localStorage.setItem('adro.tour.v1', '{"home":1,"food":1,"train":1,"progress":1,"friends":1}');
    localStorage.setItem('tour:off', '1');
    localStorage.setItem('adro.ai.ok', '1');
    localStorage.setItem('adro.lang', l);
    localStorage.setItem('adro.lang.chosen', '1');
  }, [JSON.stringify(session), lang]);
  for (const [key, route, mode] of SHOTS) {
    MODE = mode;
    await p.goto(`http://127.0.0.1:8099${route}`);
    await p.waitForTimeout(8000);
    for (const x of ['Not now', 'Later', 'Close', 'Keep it up', 'لاحقاً', 'مو الحين']) {
      const k = p.getByText(x, { exact: true });
      if (await k.count()) await k.first().click().catch(() => {});
    }
    await p.waitForTimeout(800);
    await p.screenshot({ path: path.join(OUT, `${lang}-${key}.png`) });
  }
  console.log('errors', errs.slice(0, 3));
  await b.close();
  srv.close();
})();
