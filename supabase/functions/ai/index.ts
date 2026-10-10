// Gymi AI: the only place that talks to an AI model. The app sends a task; keys never leave the server.
//
// Secrets (Supabase > Edge Functions > Secrets):
//   GEMINI_API_KEY      required for Gemini (the default)
//   OPENROUTER_API_KEY  optional backup when Gemini is busy, over its limit or refuses the key
// Model switch (optional secrets):
//   AI_PROVIDER         'gemini' (default) or 'openrouter'
//   AI_MODEL            default 'gemini-flash-latest'
//   AI_MODEL_LITE       for simple tasks, default 'gemini-3.5-flash-lite'
//   OPENROUTER_MODEL    up to 3, comma separated, tried in order. Default: free Gemma 4 31B, Gemma 4 26B, Nemotron Nano Omni.
//                       Qwen (needs credits): 'qwen/qwen3-vl-30b-a3b-instruct'
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
let lastDetail = '';
let lastModel = '';
const openrouterKey = () => env('OPENROUTER_API_KEY') || env('OpenRouter') || env('OPENROUTER');

type Part = { text: string } | { image: string; mime: string };
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
        parts: m.parts.map((p) => ('text' in p ? { text: p.text } : { inline_data: { mime_type: p.mime, data: p.image } })),
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
  const text = data?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? '').join('') ?? '';
  return text;
}

async function openrouter(system: string, msgs: Msg[], schema?: object, retry = true): Promise<string> {
  const key = openrouterKey();
  if (!key) throw new Error('ai_off');
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      // First choice, then free backups when it's busy (OpenRouter tries them in order).
      models: env('OPENROUTER_MODEL', 'google/gemma-4-31b-it:free,google/gemma-4-26b-a4b-it:free,nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free')
        .split(',')
        .map((x) => x.trim())
        .filter(Boolean)
        .slice(0, 3),
      // Some free models don't take a separate system message, so the instructions go first in the chat.
      messages: msgs.map((m, i) => ({
        role: m.role === 'ai' ? 'assistant' : 'user',
        content: [
          ...(i === 0 ? [{ type: 'text', text: `${system}\nAnswer with one JSON object only, no other text.${schema ? `\nIt must follow this JSON schema: ${JSON.stringify(schema)}` : ''}\n\n` }] : []),
          ...m.parts.map((p) => ('text' in p ? { type: 'text', text: p.text } : { type: 'image_url', image_url: { url: `data:${p.mime};base64,${p.image}` } })),
        ],
      })),
    }),
  });
  if (!res.ok) lastDetail = `openrouter ${res.status}: ${(await res.text()).slice(0, 200)}`;
  if (res.status === 401 || res.status === 403) throw new Error('ai_off');
  if (res.status === 429 && retry) {
    await new Promise((r) => setTimeout(r, 1500));
    return openrouter(system, msgs, schema, false);
  }
  if (!res.ok) throw new Error(res.status === 429 ? 'busy' : lastDetail);
  const data = await res.json();
  lastModel = data?.model ?? '';
  const content = data?.choices?.[0]?.message?.content ?? '';
  // An empty answer happens on busy free models: try once more.
  if (!String(content).trim() && retry) return openrouter(system, msgs, schema, false);
  if (!String(content).trim()) throw new Error('busy');
  return content;
}

async function ask(task: string, system: string, msgs: Msg[], schema?: object) {
  const provider = env('AI_PROVIDER', env('GEMINI_API_KEY') ? 'gemini' : 'openrouter');
  const model = LITE_TASKS.has(task) ? env('AI_MODEL_LITE', 'gemini-3.5-flash-lite') : env('AI_MODEL', 'gemini-flash-latest');
  let text: string;
  try {
    text = provider === 'openrouter' ? await openrouter(system, msgs, schema) : await gemini(model, system, msgs, schema);
  } catch (e) {
    // Backup: if the main model is busy or not set up, try the other one when its key exists.
    const msg = (e as Error).message;
    if ((msg === 'busy' || msg === 'ai_off') && provider === 'gemini' && openrouterKey()) text = await openrouter(system, msgs, schema);
    else if ((msg === 'busy' || msg === 'ai_off') && provider === 'openrouter' && env('GEMINI_API_KEY')) text = await gemini(model, system, msgs, schema);
    else throw e;
  }
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
const LANG = (l: string) => (l === 'ar' ? 'Reply in simple Saudi/Gulf Arabic.' : 'Reply in simple, friendly English.');
const FOOD_ITEM = {
  type: 'object',
  properties: { name: { type: 'string' }, grams: { type: 'number' }, kcal: { type: 'number' }, protein: { type: 'number' }, carbs: { type: 'number' }, fat: { type: 'number' } },
  required: ['name', 'grams', 'kcal', 'protein', 'carbs', 'fat'],
};
const FOOD = {
  type: 'object',
  properties: { title: { type: 'string' }, items: { type: 'array', items: FOOD_ITEM }, sugar_high: { type: 'boolean' }, fat_high: { type: 'boolean' }, note: { type: 'string' } },
  required: ['title', 'items'],
};

async function run(task: string, b: Record<string, unknown>) {
  const lang = String(b.lang ?? 'en');
  const img = (k = 'image'): Part => ({ image: String(b[k]), mime: String(b.mime ?? 'image/jpeg') });
  switch (task) {
    case 'chat': {
      const ctx = JSON.stringify(b.context ?? {});
      const system = `You are Gymi, a friendly AI fitness coach for people in Saudi Arabia and the Gulf. ${LANG(lang)}
Keep answers short (2 to 5 sentences), practical and kind. Use local foods when helpful (kabsa, mandi, laban, dates, shawarma).
You are not a doctor: for pain, injury or medical questions, suggest seeing a doctor.
The user's data today (JSON): ${ctx}
If the user says they ate, drank, walked/ran/cycled/swam, add actions so the app can log it:
- food: {"type":"food","name":"...","kcal":n,"protein":n,"carbs":n,"fat":n} (estimate a normal portion if no amount is given). ${PORTIONS}
- cardio: {"type":"cardio","kind":"Walk|Run|Bike|Swim","minutes":n,"intensity":0|1|2}
- water: {"type":"water","ml":n}
Only add actions for things they already did, not plans. Otherwise "actions" is [].
Return JSON: {"reply":"...","actions":[...]}`;
      const msgs = ((b.messages as { role: 'user' | 'ai'; text: string }[]) ?? []).slice(-12).map((m) => ({ role: m.role, parts: [{ text: m.text.slice(0, 2000) }] }));
      return ask(task, system, msgs);
    }
    case 'meal_photo':
      return ask(task, `You estimate food from a photo for a calorie tracker. ${LANG(lang)} Names short. List each food you see with grams and its calories and macros for that amount. Gulf dishes are common. ${PORTIONS} If it is not food, return items: [] and a note.`, [
        { role: 'user', parts: [img(), { text: `What is on this plate? Estimate each part.${b.note ? ` How it was cooked: ${String(b.note).slice(0, 300)}` : ''}` }] },
      ], FOOD);
    case 'food_text':
      return ask(task, `You turn a description of food into calories for a tracker. ${LANG(lang)} Names short. Estimate normal portions when no amount is given. ${PORTIONS}`, [
        { role: 'user', parts: [{ text: String(b.text ?? '').slice(0, 500) }] },
      ], FOOD);
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
      const system = `You are a strength coach. Build a weekly gym plan as JSON. Use ONLY exercise ids from the list given. 4 to 7 exercises per workout, big lifts first. Respect injuries: avoid exercises that stress them. Short English workout names like "Push", "Pull", "Legs", "Upper", "Lower", "Full body". Spread workouts with rest days where possible (weekday 0 = Sunday).`;
      return ask(task, system, [{ role: 'user', parts: [{ text: JSON.stringify({ days: b.days, injuries: b.injuries, level: b.level, exercises: b.exercises }) }] }], {
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
    if (!env('GEMINI_API_KEY') && !openrouterKey()) return json({ error: 'ai_off' }, 503);

    const admin = createClient(url, env('SUPABASE_SERVICE_ROLE_KEY'));
    const { data: ok } = await admin.rpc('ai_take', { p_user: u.user.id, p_limit: Number(env('AI_DAILY_LIMIT', '80')) });
    if (ok === false) return json({ error: 'limit' }, 429);

    lastModel = '';
    lastDetail = '';
    const result = await run(task, body);
    return json({ result, model: lastModel || undefined });
  } catch (e) {
    const msg = (e as Error).message;
    console.error(msg);
    if (msg === 'ai_off') return json({ error: 'ai_off', detail: lastDetail }, 503);
    if (msg === 'busy') return json({ error: 'busy', detail: lastDetail }, 503);
    return json({ error: 'failed', detail: msg.slice(0, 200) }, 500);
  }
});
