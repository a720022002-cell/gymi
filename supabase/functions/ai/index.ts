// Gymi AI: the only place that talks to an AI model. The app sends a task; keys never leave the server.
//
// Secrets (Supabase > Edge Functions > Secrets):
//   OPENROUTER_API_KEY  (also read as "OpenRouter") the key for OpenRouter, which runs Claude Haiku
// Model switch (optional secrets):
//   AI_PROVIDER         'openrouter' (default) or 'gemini'
//   OPENROUTER_MODEL    default 'anthropic/claude-haiku-5.5'
//   OPENROUTER_FALLBACK used once when the main model fails or is busy, default 'qwen/qwen3-vl-235b-a22b-instruct'
//   GEMINI_API_KEY, AI_MODEL, AI_MODEL_LITE  only used when AI_PROVIDER is 'gemini'
//   AI_DAILY_LIMIT      requests per person per day, default 80
import { createClient } from 'npm:@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
const env = (k: string, d = '') => Deno.env.get(k) ?? d;
/** The OpenRouter key; also accepted under the name "OpenRouter". */
/** The model Gymi uses: Claude Haiku (reads photos and PDFs, good Arabic, follows the JSON shape). */
const HAIKU = 'anthropic/claude-haiku-5.5';
/** Backup when Haiku fails or is busy: Qwen3-VL. */
const QWEN = 'qwen/qwen3-vl-235b-a22b-instruct';
let lastDetail = '';
let lastModel = '';
/** Admins can test another model on any task (for comparing accuracy). */
let modelOverride = '';
/** Reading tasks (photos, labels, lab reports) answer the same way every time; the chat keeps some variety. */
let temperature: number | undefined;
/** Tokens and cost of the last AI call, saved to ai_calls for the admin cost page. */
let lastUsage = { prompt: 0, completion: 0, cost: 0 };
const openrouterKey = () => env('OPENROUTER_API_KEY') || env('OpenRouter') || env('OPENROUTER');

type Part = { text: string } | { image: string; mime: string } | { file: string; mime: string; name: string };
type Msg = { role: 'user' | 'ai'; parts: Part[] };

/** Which model each task uses (the model switch). Photos and plans get the stronger model. */
const LITE_TASKS = new Set(['food_text']);

async function gemini(model: string, system: string, msgs: Msg[], schema?: object) {
  const key = env('GEMINI_API_KEY');
  if (!key) throw new Error('ai_off');
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: msgs.map((m) => ({
        role: m.role === 'ai' ? 'model' : 'user',
        parts: m.parts.map((p) => ('text' in p ? { text: p.text } : { inline_data: { mime_type: p.mime, data: 'image' in p ? p.image : p.file } })),
      })),
      generationConfig: { temperature: 0.4, responseMimeType: 'application/json', ...(schema ? { responseSchema: schema } : {}) },
    }),
  });
  if (res.status === 429 || res.status >= 500) throw new Error('busy');
  // Key refused (wrong key, or Google blocked the project): treat like "not set up" so the backup is tried.
  if (res.status === 401 || res.status === 403) {
    console.error(`gemini ${res.status}: ${(await res.text()).slice(0, 300)}`);
    throw new Error('ai_off');
  }
  if (!res.ok) throw new Error(`gemini ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data = await res.json();
  lastModel = model;
  lastUsage = { prompt: data?.usageMetadata?.promptTokenCount ?? 0, completion: data?.usageMetadata?.candidatesTokenCount ?? 0, cost: 0 };
  const text = data?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? '').join('') ?? '';
  return text;
}

async function openrouter(system: string, msgs: Msg[], schema?: object): Promise<string> {
  const main = modelOverride || env('OPENROUTER_MODEL', HAIKU);
  try {
    return await openrouterCall(main, system, msgs, schema);
  } catch (e) {
    const backup = env('OPENROUTER_FALLBACK', QWEN);
    // A bad key won't work on any model; an admin testing a model wants that model's error.
    if ((e as Error).message === 'ai_off' || modelOverride || backup === main) throw e;
    return openrouterCall(backup, system, msgs, schema);
  }
}

async function openrouterCall(model: string, system: string, msgs: Msg[], schema?: object, retry = true): Promise<string> {
  const key = openrouterKey();
  if (!key) throw new Error('ai_off');
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model,
      ...(temperature != null ? { temperature } : {}),
      // Ask OpenRouter to return tokens and the real cost of this call.
      usage: { include: true },
      // PDFs (lab reports) are turned into text by OpenRouter's free PDF reader.
      ...(msgs.some((m) => m.parts.some((p) => 'file' in p)) ? { plugins: [{ id: 'file-parser', pdf: { engine: 'pdf-text' } }] } : {}),
      // Some free models don't take a separate system message, so the instructions go first in the chat.
      messages: msgs.map((m, i) => ({
        role: m.role === 'ai' ? 'assistant' : 'user',
        content: [
          ...(i === 0 ? [{ type: 'text', text: `${system}\nAnswer with one JSON object only, no other text.${schema ? `\nIt must follow this JSON schema: ${JSON.stringify(schema)}` : ''}\n\n` }] : []),
          ...m.parts.map((p) =>
            'text' in p
              ? { type: 'text', text: p.text }
              : 'file' in p
                ? { type: 'file', file: { filename: p.name, file_data: `data:${p.mime};base64,${p.file}` } }
                : { type: 'image_url', image_url: { url: `data:${p.mime};base64,${p.image}` } },
          ),
        ],
      })),
    }),
  });
  if (!res.ok) lastDetail = `openrouter ${res.status}: ${(await res.text()).slice(0, 200)}`;
  if (res.status === 401 || res.status === 403) throw new Error('ai_off');
  if (res.status === 429 && retry) {
    await new Promise((r) => setTimeout(r, 1500));
    return openrouterCall(model, system, msgs, schema, false);
  }
  if (!res.ok) throw new Error(res.status === 429 ? 'busy' : lastDetail);
  const data = await res.json();
  lastModel = data?.model ?? '';
  lastUsage = { prompt: data?.usage?.prompt_tokens ?? 0, completion: data?.usage?.completion_tokens ?? 0, cost: Number(data?.usage?.cost ?? 0) || 0 };
  const content = data?.choices?.[0]?.message?.content ?? '';
  // An empty answer happens on busy free models: try once more.
  if (!String(content).trim() && retry) return openrouterCall(model, system, msgs, schema, false);
  if (!String(content).trim()) throw new Error('busy');
  return content;
}

async function ask(task: string, system: string, msgs: Msg[], schema?: object) {
  const provider = env('AI_PROVIDER', 'openrouter');
  const model = LITE_TASKS.has(task) ? env('AI_MODEL_LITE', 'gemini-3.5-flash-lite') : env('AI_MODEL', 'gemini-flash-latest');
  const text = provider === 'gemini' ? await gemini(model, system, msgs, schema) : await openrouter(system, msgs, schema);
  // Take the JSON object out of the answer (some models add words or ``` around it).
  const t = text.trim();
  const a = t.indexOf('{');
  const b = t.lastIndexOf('}');
  return JSON.parse(a >= 0 && b > a ? t.slice(a, b + 1) : t);
}

// ---------------------------------------------------------------------------
// Tasks
// ---------------------------------------------------------------------------
/** Realistic Saudi portions so estimates aren't too low. */
const PORTIONS = `Use realistic Saudi/Gulf portions. Typical: 1 plate chicken kabsa about 750 kcal (45 g protein), lamb mandi plate about 900 kcal, chicken shawarma wrap about 520 kcal, falafel sandwich about 450 kcal, 1 cup cooked rice about 200 kcal, 1 Arabic bread about 170 kcal, 3 dates about 70 kcal, 1 cup laban about 120 kcal, 1 egg about 75 kcal, Big Mac about 550 kcal.`;
const LANG = (l: string) => (l === 'ar' ? 'Reply in simple Saudi/Gulf Arabic. Write every word in Arabic letters, food and dish names too (لبن, not laban); only brand names may stay in English.' : 'Reply in simple, friendly English.');
const FOOD_ITEM = {
  type: 'object',
  properties: { name: { type: 'string' }, grams: { type: 'number' }, kcal: { type: 'number' }, protein: { type: 'number' }, carbs: { type: 'number' }, fat: { type: 'number' } },
  required: ['name', 'grams', 'kcal', 'protein', 'carbs', 'fat'],
};
/** Meal photo: look first (what, how many, how big), then weigh, then count calories. */
// What the warning chips mean, so the AI doesn't flag the natural sugar in fruit or milk.
const FLAGS = '"sugar_high" is true only for ADDED or free sugar of about 10 g or more in the meal: sweets and desserts, sugary drinks and juices, syrups, sweetened coffee or dairy, honey or jam. Whole fruit, dates, plain milk, laban and plain yogurt are natural sugar: false. "fat_high" is true when the meal has more than about 21 g of fat.';
const MEAL_PHOTO = (lang: string) => `You are a careful dietitian estimating a meal from one photo for a calorie tracker. ${LANG(lang)} Names short.${lang === 'ar' ? ' Write "title", every item "name", "alternatives" and "note" in Arabic (Saudi dish names like كبسة دجاج، مندي، فلافل).' : ''} If the person tells you what the dish is, use that name but still weigh the portions from the photo.
Work in this order and write it in "seen" (one or two short sentences, English is fine):
0. If a kitchen scale display or a weight printed on the package is readable, use that number as the total weight and split it between the parts. Say so.
1. Name the dish exactly. Gulf, Arab, Indian and fast food are common in Saudi Arabia. Check look-alikes before you decide: kabsa vs mandi vs biryani vs machboos vs mathbi; shawarma wrap vs falafel wrap; shakshuka vs eggs in tomato; harees vs jareesh vs oats; saleeg vs rice pudding; mutabbaq vs pizza; luqaimat vs donut holes. Put the 2 next most likely dish names in "alternatives".
2. Count what can be counted: chicken pieces, eggs, falafel, dates, bread, sambousek, nuggets. Say the counts.
3. Size things against what is in the photo: a dinner plate is about 26 cm, a side plate 20 cm, a bowl about 350 ml, a frying pan 26 to 30 cm, a shared Saudi tray (sahan) 45 to 60 cm, a spoon 15 cm, a fork 19 cm, a phone 15 cm. An adult hand: palm about 8.5 cm wide, hand about 19 cm long from wrist to fingertip, a finger about 2 cm wide. Estimate how full the container is and how high the food is piled. For whole fruit or vegetables, estimate each one's length and width in cm.
4. Weigh each part in grams from the size and count. For whole fruit and vegetables, count them and use a typical weight per piece, adjusted only a little for size (do not calculate from length and width): the short Middle Eastern cucumber common in Saudi Arabia (14 to 18 cm) is about 120 g, a long English cucumber 300 g; tomato 120 g; onion 150 g; apple 180 g; orange 150 g; banana 120 g peeled; potato 200 g; carrot 70 g. Do not underestimate cooked food: a full dinner plate of rice is 350 to 500 g cooked; one chicken leg quarter is about 250 g with bone (180 g edible); a whole half chicken is about 450 g; one large egg is 50 g; one falafel ball 17 to 20 g; one Arabic bread 60 to 80 g; one medium date 8 g. If the photo shows a shared tray, estimate the whole tray and say so in "note".
5. Count calories for each part as cooked and served, including the oil or ghee it is cooked in (rice in kabsa or mandi is about 170 to 190 kcal per 100 g; fried foods soak up oil).
${PORTIONS}
"title" is the dish name. Several of the same thing are ONE item with the count in its name (like "Cucumber ×2"), never "left" and "right". Each item is one part of the meal with its grams and the calories and macros for those grams. "confidence" is high, medium or low. ${FLAGS} If it is not food, return items: [] and a note.`;
const MEAL_SCHEMA = {
  type: 'object',
  properties: {
    seen: { type: 'string' },
    title: { type: 'string' },
    alternatives: { type: 'array', items: { type: 'string' } },
    confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
    items: { type: 'array', items: FOOD_ITEM },
    sugar_high: { type: 'boolean' },
    fat_high: { type: 'boolean' },
    note: { type: 'string' },
  },
  required: ['seen', 'title', 'items'],
};
const FOOD = {
  type: 'object',
  properties: { title: { type: 'string' }, items: { type: 'array', items: FOOD_ITEM }, sugar_high: { type: 'boolean' }, fat_high: { type: 'boolean' }, note: { type: 'string' } },
  required: ['title', 'items'],
};


// Recipe from a video link: the caption and cover picture that TikTok, YouTube and Instagram share publicly.
// Only these sites are fetched (never any other address).
const LINK_HOSTS = /(^|\.)(tiktok\.com|instagram\.com|youtube\.com|youtu\.be)$/i;
const toB64 = (buf: ArrayBuffer) => {
  const u = new Uint8Array(buf);
  let s = '';
  for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000));
  return btoa(s);
};
const unHtml = (x: string) => x.replace(/&quot;/g, '"').replace(/&#39;|&#x27;/g, "'").replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)));
async function getUrl(u: string, init?: RequestInit) {
  const r = await fetch(u, { ...init, signal: AbortSignal.timeout(8000), redirect: 'follow' });
  return r.ok ? r : null;
}
async function picture(u?: string) {
  if (!u || !/^https:\/\//.test(u)) return null;
  const r = await getUrl(u).catch(() => null);
  const buf = r ? await r.arrayBuffer() : null;
  return buf && buf.byteLength < 3_000_000 ? toB64(buf) : null;
}
async function linkInfo(raw: string): Promise<{ site: string; text: string; image: string | null } | null> {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' || !LINK_HOSTS.test(url.hostname)) return null;
  const host = url.hostname.toLowerCase();
  if (host.endsWith('tiktok.com')) {
    const r = await getUrl(`https://www.tiktok.com/oembed?url=${encodeURIComponent(url.toString())}`).catch(() => null);
    const j = r ? await r.json().catch(() => null) : null;
    if (!j) return { site: 'tiktok', text: '', image: null };
    return { site: 'tiktok', text: [j.title, j.author_name ? `by ${j.author_name}` : ''].filter(Boolean).join('\n'), image: await picture(j.thumbnail_url) };
  }
  if (host.endsWith('youtube.com') || host.endsWith('youtu.be')) {
    const r = await getUrl(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(url.toString())}`).catch(() => null);
    const j = r ? await r.json().catch(() => null) : null;
    return { site: 'youtube', text: j?.title ?? '', image: await picture(j?.thumbnail_url) };
  }
  // Instagram shows the caption to link previews when the post is public.
  const r = await getUrl(url.toString(), { headers: { 'User-Agent': 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)' } }).catch(() => null);
  const html = r ? (await r.text()).slice(0, 400_000) : '';
  const meta = (k: string) => unHtml(html.match(new RegExp(`<meta[^>]+(?:property|name)="${k}"[^>]+content="([^"]*)"`, 'i'))?.[1] ?? '');
  return { site: 'instagram', text: [meta('og:title'), meta('og:description')].filter(Boolean).join('\n'), image: await picture(meta('og:image') || undefined) };
}

const RECIPE = (lang: string) => `You turn a short cooking video (TikTok, Instagram Reels, YouTube Shorts or a clip) into a recipe for a calorie tracker. You get the caption and frames from the video in order; read any text written on screen. ${LANG(lang)}${lang === 'ar' ? ' Write "title", ingredient names and steps in Arabic.' : ''}
List every ingredient with its amount in grams (convert cups and spoons: 1 cup uncooked rice 185 g, 1 cup flour 125 g, 1 tbsp oil 14 g, 1 tbsp butter 14 g, 1 tbsp sugar 12 g, 1 egg 50 g, 1 cup milk 245 g) and the calories, protein, carbs and fat for that amount, using raw values. If no amount is shown, use a normal amount for that dish.
"servings" is how many portions the whole recipe makes (from the caption, or a sensible guess). "steps" are short cooking steps in order. "note" says briefly what you had to guess. If this is not a recipe, set found=false and say why in "note".`;
const RECIPE_SCHEMA = {
  type: 'object',
  properties: {
    found: { type: 'boolean' },
    title: { type: 'string' },
    servings: { type: 'number' },
    ingredients: { type: 'array', items: { type: 'object', properties: { name: { type: 'string' }, grams: { type: 'number' }, kcal: { type: 'number' }, protein: { type: 'number' }, carbs: { type: 'number' }, fat: { type: 'number' } }, required: ['name', 'grams', 'kcal', 'protein', 'carbs', 'fat'] } },
    steps: { type: 'array', items: { type: 'string' } },
    note: { type: 'string' },
  },
  required: ['found', 'title', 'servings', 'ingredients', 'steps'],
};

async function run(task: string, b: Record<string, unknown>) {
  const lang = String(b.lang ?? 'en');
  const img = (k = 'image'): Part => ({ image: String(b[k]), mime: String(b.mime ?? 'image/jpeg') });
  switch (task) {
    case 'chat': {
      const ctx = JSON.stringify(b.context ?? {}).slice(0, 20000);
      const memory = String(b.memory ?? '').slice(0, 1500);
      const system = `You are Gymi, a friendly AI fitness coach for people in Saudi Arabia and the Gulf. ${LANG(lang)}
Keep answers short (2 to 5 sentences), practical and kind. Use local foods when helpful (kabsa, mandi, laban, dates, shawarma).
Use the user's real numbers below (weight trend, sleep, recovery, calories, protein, workouts, commitment, coach targets, cycle phase, watch data) and say them plainly. Never invent numbers that are not in the data.
If a human coach set calorie or protein targets ("coachTargets"), follow those targets. If "cycle" is present, take the phase into account (hunger, water weight, energy) without being dramatic.
You are not a doctor: for pain, injury or medical questions, suggest seeing a doctor.
What you remember about this user from earlier chats: ${memory || 'nothing yet'}
The user's data (JSON): ${ctx}
If the user says they ate, drank, walked/ran/cycled/swam, slept, or weighed themselves, add actions so the app can log it:
- food: {"type":"food","name":"...","kcal":n,"protein":n,"carbs":n,"fat":n} (estimate a normal portion if no amount is given). ${PORTIONS}
- cardio: {"type":"cardio","kind":"Walk|Run|Bike|Swim","minutes":n,"intensity":0|1|2}
- water: {"type":"water","ml":n}
- sleep: {"type":"sleep","hours":n} (last night's total sleep in hours, like 7 or 6.5)
- weight: {"type":"weight","kg":n} (today's body weight in kg)
Only add actions for things they already did, not plans. Otherwise "actions" is [].
You can see all the person's data above: food, water, sleep, check-ins, recovery, weight and body measurements, blood tests, supplements, workouts, the full training plan and watch data when connected. Base every answer on those real numbers and say which ones you used (for example "you haven't trained for 12 days and slept 6 h"). If something you need is missing, say what to log.
When a change would help (they are coming back after a break, feel tired or sore, stopped progressing, have an injury, a new goal, or ask you to change something), add up to 2 "suggest" items. Nothing changes until the person taps Apply, so explain the change in your reply and ask if they want it.
- training plan: {"type":"plan","title":"short reason, in the reply language","changes":[...]} with changes from:
  {"op":"deload"} (this week lighter), {"op":"light"} (today lighter), {"op":"sets","workout":"<workout name or all>","delta":-1|-2|1|2}, {"op":"reps","workout":"<name or all>","reps":"12–15"},
  {"op":"swap","workout":"<name>","from":"<exercise id from trainingPlan>","to":"<English exercise name to search>"},
  {"op":"remove","workout":"<name>","ex":"<exercise id>"}, {"op":"add","workout":"<name>","search":"<English exercise name>","sets":3,"reps":"10–12"}.
  {"op":"light"} makes only today's workout lighter (one set less, about 10% less weight).
  Use the exact workout names and exercise ids from "trainingPlan".
  Recovery rule: if there is a workout today that isn't done and isn't already lighter ("todayWorkoutLighter"), and last night's sleep ("sleepLastNightH") is under 6 h, or "recoveryToday" is under 50, or soreness is "very sore", say it plainly (e.g. "you slept 5 h, your recovery is 48") and ask if they want today's workout lighter, with a {"op":"light"} suggestion. Do this even if they didn't ask about training. Example: back after 2+ weeks off: deload plus one set less on all workouts for the first week or two.
- food targets: {"type":"targets","title":"short reason","kcal":n,"protein":n,"water":ml} (only the ones that change; never when "coachManagesFood" is true).
Otherwise "suggest" is [].
You may add one small "card" under your reply when it helps: {"type":"weight"} for weight or progress questions, {"type":"calories"} for calorie or eating questions, {"type":"sleep"} for sleep or recovery questions, or {"type":"meal","name":"...","kcal":n,"protein":n} when you suggest one meal. Otherwise leave "card" out.
If the user told you something new and lasting about themselves (goals, injuries, foods they like or avoid, schedule, preferences), add "memory": the full updated memory as short notes in English, max 600 characters, keeping what still matters from the old memory. Otherwise leave "memory" out.
Return JSON: {"reply":"...","actions":[...],"suggest":[...],"card":{...},"memory":"..."}`;
      const msgs = ((b.messages as { role: 'user' | 'ai'; text: string }[]) ?? []).slice(-12).map((m) => ({ role: m.role, parts: [{ text: m.text.slice(0, 2000) }] }));
      return ask(task, system, msgs);
    }
    case 'meal_photo':
      return ask(task, MEAL_PHOTO(lang), [
        { role: 'user', parts: [img(), { text: `What is on this plate? Estimate each part.${b.note ? ` The person says: ${String(b.note).slice(0, 300)}. Trust this over what you see.` : ''}` }] },
      ], MEAL_SCHEMA);
    case 'food_text':
      return ask(task, `You turn a description of food into calories for a tracker. ${LANG(lang)} Names short. Estimate normal portions when no amount is given. ${PORTIONS} ${FLAGS}`, [
        { role: 'user', parts: [{ text: String(b.text ?? '').slice(0, 500) }] },
      ], FOOD);
    case 'recipe': {
      const parts: Part[] = [];
      let caption = String(b.caption ?? '').slice(0, 3000);
      let site = '';
      if (b.url) {
        const info = await linkInfo(String(b.url)).catch(() => null);
        if (info) {
          site = info.site;
          caption = [info.text, caption].filter(Boolean).join('\n').slice(0, 4000);
          if (info.image) parts.push({ image: info.image, mime: 'image/jpeg' });
        }
      }
      for (const f of ((Array.isArray(b.frames) ? b.frames : []) as string[]).slice(0, 8)) parts.push({ image: String(f), mime: 'image/jpeg' });
      // Nothing to read (a private post, or the site hid the caption).
      if (!caption.trim() && !parts.length) return { found: false, title: '', servings: 1, ingredients: [], steps: [], note: 'no_content', site };
      parts.push({ text: `Caption or description of the video:\n${caption || '(none)'}\nThe pictures are frames from the video, in order.` });
      const out = (await ask(task, RECIPE(lang), [{ role: 'user', parts }], RECIPE_SCHEMA)) as Record<string, unknown>;
      return { ...out, site };
    }
    case 'label_photo':
      return ask(task, `You read nutrition labels. ${LANG(lang)} Read the per 100 g (or 100 ml) column. If only per serving is shown, convert to per 100 g using the serving size.`, [
        { role: 'user', parts: [img(), { text: 'Read this nutrition label.' }] },
      ], {
        type: 'object',
        properties: {
          name: { type: 'string' }, unit: { type: 'string', enum: ['g', 'ml'] }, serving: { type: 'number' },
          kcal_100: { type: 'number' }, protein_100: { type: 'number' }, carbs_100: { type: 'number' }, fat_100: { type: 'number' }, sugar_100: { type: 'number' }, readable: { type: 'boolean' },
        },
        required: ['kcal_100', 'protein_100', 'carbs_100', 'fat_100', 'readable'],
      });
    case 'together': {
      // One workout for a group, built from everyone's own plan for that day.
      const system = `You plan one gym workout that a group of friends does together.
You get each person's level, the workout their own plan has on that day (or rest), injuries, and their workouts in the last 7 days.
1. Pick the focus that fits the most people's plans that day (for example most have Push, so Push). Avoid muscles that someone trained in the last 2 days or that hurt an injury when you can.
2. Choose 5 to 7 exercises ONLY from the "exercises" list (use their exact ids). Start with 1 or 2 main compound lifts (type 1), then accessories (type 0); a timed core move at the end is type 2. No exercise that hurts anyone's injury.
3. "title" is the workout name in English, 1 to 3 words: use "Push", "Pull", "Legs", "Upper", "Lower" or "Full body" when it fits.
4. For every person give "action", "text" (English) and "text_ar" (the same in simple Saudi Arabic): one short sentence to that person saying exactly what happens to their plan if they join:
   - "replace": they had a similar workout that day, so this counts as it (e.g. "This counts as your Push day.").
   - "move": they had a different workout that day; it moves to their next rest day this week (e.g. "Your Pull day moves to your next rest day.").
   - "extra": it was their rest day or they have no plan; their plan stays the same (mention if they trained the same muscles very recently).`;
      return ask(task, system, [{ role: 'user', parts: [{ text: JSON.stringify({ day: b.day, people: b.people, exercises: b.exercises }).slice(0, 14000) }] }], {
        type: 'object',
        properties: {
          title: { type: 'string' },
          exercises: { type: 'array', items: { type: 'object', properties: { id: { type: 'string' }, type: { type: 'number' } }, required: ['id', 'type'] } },
          people: { type: 'array', items: { type: 'object', properties: { key: { type: 'string' }, action: { type: 'string' }, text: { type: 'string' }, text_ar: { type: 'string' } }, required: ['key', 'action', 'text', 'text_ar'] } },
        },
        required: ['title', 'exercises', 'people'],
      });
    }
    case 'machine':
      return ask(task, `You recognize gym machines and equipment from a photo. "name" is the common English gym name; "name_ar" is the same name in Arabic as Saudi gym-goers say it; "works" lists the main muscles in English and "works_ar" in Arabic. Suggest "sets" (3 or 4) and "reps" (like "10–12") for a normal gym-goer. "search" is 1 to 3 English words to find it in an exercise list. If it is not gym equipment, set known=false.`, [
        { role: 'user', parts: [img(), { text: 'What gym machine or exercise is this?' }] },
      ], {
        type: 'object',
        properties: {
          known: { type: 'boolean' }, name: { type: 'string' }, name_ar: { type: 'string' },
          group: { type: 'string', enum: ['Chest', 'Back', 'Shoulders', 'Arms', 'Legs', 'Core'] },
          works: { type: 'string' }, works_ar: { type: 'string' }, equipment: { type: 'string', enum: ['Machine', 'Cable', 'Barbell', 'Dumbbell', 'Bodyweight', 'Free weight'] },
          sets: { type: 'number' }, reps: { type: 'string' }, search: { type: 'string' },
        },
        required: ['known', 'name', 'group', 'equipment'],
      });
    case 'plan': {
      const system = `You are a strength coach. Build a weekly gym plan as JSON. Use ONLY exercise ids from the list given. 4 to 7 exercises per workout, big lifts first. Respect injuries: avoid exercises that stress them. Short English workout names like "Push", "Pull", "Legs", "Upper", "Lower", "Full body". Spread workouts with rest days where possible (weekday 0 = Sunday). Match the level: Beginner = machines and dumbbells, 4 to 5 exercises, 3 sets of 10–12; Intermediate = 5 to 6 exercises, 3 to 4 sets; Advanced = 6 to 7 exercises, free-weight compound lifts first with 4 to 5 sets.`;
      return ask(task, `${system} Use exactly ${Number(b.days) || 3} training days a week, no more and no less.`, [{ role: 'user', parts: [{ text: JSON.stringify({ days: b.days, injuries: b.injuries, level: b.level, exercises: b.exercises }) }] }], {
        type: 'object',
        properties: {
          split: { type: 'string' },
          week: { type: 'array', items: { type: 'object', properties: { day: { type: 'number' }, workout: { type: 'string' } }, required: ['day', 'workout'] } },
          workouts: {
            type: 'array',
            items: {
              type: 'object',
              properties: { name: { type: 'string' }, focus: { type: 'string' }, ex: { type: 'array', items: { type: 'object', properties: { id: { type: 'string' }, sets: { type: 'number' }, reps: { type: 'string' } }, required: ['id', 'sets', 'reps'] } } },
              required: ['name', 'ex'],
            },
          },
        },
        required: ['split', 'week', 'workouts'],
      });
    }
    case 'report':
      return ask(task, `You are a friendly fitness coach writing a short progress report. ${LANG(lang)} Use simple words and the real numbers given. Each point is one short sentence. Never give medical advice. "well": 2 or 3 things that went well. "improve": 2 or 3 things to improve, each with one small action. "focus": one clear goal for the next period.`, [
        { role: 'user', parts: [{ text: JSON.stringify(b.stats ?? {}).slice(0, 4000) }] },
      ], {
        type: 'object',
        properties: { well: { type: 'array', items: { type: 'string' } }, improve: { type: 'array', items: { type: 'string' } }, focus: { type: 'string' } },
        required: ['well', 'improve', 'focus'],
      });
    case 'blood':
      return ask(task, `You read lab reports (blood tests). ${LANG(lang)} for "title" only; keep test names in English as printed. Take only the result of each test and its unit from the report. IGNORE every reference or normal range printed on the report: labs often print wrong or mismatched ranges. Instead, "low" and "high" are the standard adult reference range from medical guidelines for this person (${b.sex ? `sex: ${String(b.sex).slice(0, 10)}` : 'sex unknown'}${b.age ? `, age ${Number(b.age)}` : ''}), in the same unit as the result (null if there is no standard range). "flag" is -1 if the result is below that range, 1 if above, 0 if inside or unknown. "day" is the report date as YYYY-MM-DD if printed, else empty. Never add advice, causes or treatment. If it is not a lab report, return values: [].`, [
        { role: 'user', parts: [b.file ? { file: String(b.file), mime: 'application/pdf', name: String(b.name ?? 'report.pdf').slice(0, 100) } : img(), { text: 'Read the values in this lab report.' }] },
      ], {
        type: 'object',
        properties: {
          title: { type: 'string' }, day: { type: 'string' },
          values: { type: 'array', items: { type: 'object', properties: { name: { type: 'string' }, value: { type: 'number' }, unit: { type: 'string' }, low: { type: 'number' }, high: { type: 'number' }, flag: { type: 'number' } }, required: ['name', 'value', 'unit', 'flag'] } },
        },
        required: ['values'],
      });
    default:
      throw new Error('unknown_task');
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'method' }, 405);
  try {
    const auth = req.headers.get('Authorization') ?? '';
    const url = env('SUPABASE_URL');
    const userClient = createClient(url, env('SUPABASE_ANON_KEY'), { global: { headers: { Authorization: auth } } });
    const { data: u } = await userClient.auth.getUser(auth.replace(/^Bearer /i, ''));
    if (!u?.user) return json({ error: 'auth' }, 401);

    const body = await req.json();
    const task = String(body.task ?? '');
    if (typeof body.image === 'string' && body.image.length > 6_000_000) return json({ error: 'too_big' }, 413);
    if (typeof body.file === 'string' && body.file.length > 8_000_000) return json({ error: 'too_big' }, 413);
    if (Array.isArray(body.frames) && JSON.stringify(body.frames).length > 8_000_000) return json({ error: 'too_big' }, 413);
    if (!env('GEMINI_API_KEY') && !openrouterKey()) return json({ error: 'ai_off' }, 503);

    const admin = createClient(url, env('SUPABASE_SERVICE_ROLE_KEY'));
    // Admin cost page: OpenRouter balance and total spend (doesn't count toward the daily limit).
    if (task === 'admin_credits') {
      const { data: isAdmin } = await admin.from('admins').select('user_id').eq('user_id', u.user.id).maybeSingle();
      if (!isAdmin) return json({ error: 'auth' }, 403);
      const key = openrouterKey();
      if (!key) return json({ result: { connected: false } });
      const [c, k] = await Promise.all([
        fetch('https://openrouter.ai/api/v1/credits', { headers: { Authorization: `Bearer ${key}` } }).then((r) => (r.ok ? r.json() : null)).catch(() => null),
        fetch('https://openrouter.ai/api/v1/key', { headers: { Authorization: `Bearer ${key}` } }).then((r) => (r.ok ? r.json() : null)).catch(() => null),
      ]);
      return json({ result: { connected: true, credits: c?.data?.total_credits ?? null, used: c?.data?.total_usage ?? null, key_usage: k?.data?.usage ?? null, key_limit: k?.data?.limit ?? null, model: env('OPENROUTER_MODEL', HAIKU) } });
    }
    // Admin only: make an image (used to create app artwork). Logged with its cost like other AI calls.
    if (task === 'admin_image') {
      const { data: isAdmin } = await admin.from('admins').select('user_id').eq('user_id', u.user.id).maybeSingle();
      if (!isAdmin) return json({ error: 'auth' }, 403);
      const key = openrouterKey();
      if (!key) return json({ error: 'ai_off' }, 503);
      const content: unknown[] = [{ type: 'text', text: String(body.prompt ?? '').slice(0, 2000) }];
      if (typeof body.ref === 'string' && body.ref.length < 6_000_000) content.push({ type: 'image_url', image_url: { url: `data:image/jpeg;base64,${body.ref}` } });
      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
        body: JSON.stringify({ model: String(body.model ?? 'google/gemini-3.1-flash-image'), modalities: ['image', 'text'], usage: { include: true }, messages: [{ role: 'user', content }] }),
      });
      const data = await res.json().catch(() => null);
      const url = data?.choices?.[0]?.message?.images?.[0]?.image_url?.url ?? null;
      await admin.from('ai_calls').insert({ user_id: u.user.id, task, model: data?.model ?? '', prompt_tokens: data?.usage?.prompt_tokens ?? 0, completion_tokens: data?.usage?.completion_tokens ?? 0, cost_usd: Number(data?.usage?.cost ?? 0) || 0, ok: !!url, error: url ? null : JSON.stringify(data?.error ?? data)?.slice(0, 300) });
      if (!url) return json({ error: 'failed', detail: JSON.stringify(data?.error ?? data?.choices?.[0]?.message?.content ?? '').slice(0, 300) }, 500);
      return json({ result: { image: url, cost: data?.usage?.cost ?? null } });
    }
    const log = (ok: boolean, error?: string) =>
      admin.from('ai_calls').insert({ user_id: u.user.id, task, model: lastModel, prompt_tokens: lastUsage.prompt, completion_tokens: lastUsage.completion, cost_usd: lastUsage.cost, ok, error: error?.slice(0, 300) ?? null }).then(() => {}, () => {});
    const { data: ok } = await admin.rpc('ai_take', { p_user: u.user.id, p_limit: Number(env('AI_DAILY_LIMIT', '80')) });
    if (ok === false) return json({ error: 'limit' }, 429);

    lastModel = '';
    lastDetail = '';
    modelOverride = '';
    temperature = ['meal_photo', 'food_text', 'label_photo', 'blood', 'machine'].includes(task) ? 0 : undefined;
    if (typeof body.model === 'string' && body.model) {
      const { data: isAdmin } = await admin.from('admins').select('user_id').eq('user_id', u.user.id).maybeSingle();
      if (isAdmin) modelOverride = body.model.slice(0, 100);
    }
    lastUsage = { prompt: 0, completion: 0, cost: 0 };
    let result;
    try {
      result = await run(task, body);
    } catch (e) {
      await log(false, (e as Error).message === 'busy' || (e as Error).message === 'ai_off' ? `${(e as Error).message}: ${lastDetail}` : (e as Error).message);
      throw e;
    }
    await log(true);
    return json({ result, model: lastModel || undefined });
  } catch (e) {
    const msg = (e as Error).message;
    console.error(msg);
    if (msg === 'ai_off') return json({ error: 'ai_off', detail: lastDetail }, 503);
    if (msg === 'busy') return json({ error: 'busy', detail: lastDetail }, 503);
    return json({ error: 'failed', detail: msg.slice(0, 200) }, 500);
  }
});
