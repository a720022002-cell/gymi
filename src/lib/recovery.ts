import { addDays } from './nutrition';
import type { WorkoutLog } from './train';
import { EX, type Muscle } from './training';

export type RecoveryInput = {
  today: string;
  checkin?: { day: string; sleep: number | null; sore: number | null; energy: number | null } | null;
  logs: WorkoutLog[];
  protein: { eaten: number; target: number } | null;
  water: { ml: number; goal: number };
};

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

/** Training load: this week's volume against the usual week (last 4 weeks). 1.0 = normal. */
function loadRatio(logs: WorkoutLog[], today: string) {
  const sum = (from: string, to: string) => logs.filter((l) => l.day > from && l.day <= to).reduce((a, l) => a + l.volume, 0);
  const acute = sum(addDays(today, -7), today);
  const chronic = sum(addDays(today, -28), today) / 4;
  return chronic > 0 ? acute / chronic : 1;
}

/** Recovery score from 5 to 99 and what went into it (design: recScore, simpler without a watch). */
export function recovery(x: RecoveryInput) {
  const c = x.checkin?.day === x.today ? x.checkin : undefined;
  const sl = c?.sleep ?? null;
  const so = c?.sore ?? null;
  const en = c?.energy ?? null;
  const sleep = sl != null ? clamp(((sl - 5) / 3) * 100, 0, 100) : 75;
  const sore = so != null ? [100, 70, 35][so] : 80;
  const energy = en != null ? [45, 80, 100][en] : 80;
  const acwr = loadRatio(x.logs, x.today);
  const load = clamp(100 - Math.abs(acwr - 1) * 120, 30, 100);
  const fuel = x.protein && x.protein.target ? clamp((x.protein.eaten / x.protein.target) * 100, 40, 100) : 75;
  const score = Math.round(clamp(sleep * 0.3 + sore * 0.2 + energy * 0.15 + load * 0.2 + fuel * 0.15, 5, 99));
  const parts = [
    { key: 'Sleep', icon: 'moon', value: Math.round(sleep), sub: sl != null ? { t: '{n} h last night', n: sl } : null },
    { key: 'Soreness', icon: 'body', value: sore, sub: so != null ? { t: ['None', 'A little', 'Very sore'][so] } : null },
    { key: 'Energy', icon: 'bolt', value: energy, sub: en != null ? { t: ['Tired', 'Normal', 'Great'][en] } : null },
    { key: 'Training load', icon: 'train', value: Math.round(load), sub: { t: '{n}× your usual', n: Math.round(acwr * 10) / 10 } },
    { key: 'Nutrition', icon: 'food', value: Math.round(fuel), sub: x.protein ? { t: '{a} of {b} g protein', a: Math.round(x.protein.eaten), b: Math.round(x.protein.target) } : null },
  ] as const;
  return { score, parts, acwr, checked: sl != null || so != null || en != null, sleepH: sl ?? undefined, sore: so ?? 0 };
}

export const recLabel = (v: number): [string, 'up' | 'cobalt' | 'sec' | 'down'] =>
  v >= 80 ? ['Ready to train hard', 'up'] : v >= 60 ? ['Ready for a normal session', 'cobalt'] : v >= 40 ? ['Take it easier today', 'sec'] : ['Rest or go very light', 'down'];

/** How ready each muscle group is, from the last 3 days of workouts. */
export function muscleReady(logs: WorkoutLog[], today: string): Record<string, number> {
  const out: Record<string, number> = { Chest: 100, Back: 100, Shoulders: 100, Arms: 100, Legs: 100, Core: 100 };
  for (const l of logs) {
    const daysAgo = Math.round((new Date(`${today}T12:00:00`).getTime() - new Date(`${l.day}T12:00:00`).getTime()) / 864e5);
    if (daysAgo > 2 || daysAgo < 0) continue;
    const hit = new Set<Muscle>();
    l.exercises.forEach((e) => {
      const m = EX[e.id]?.m;
      if (m) hit.add(m);
    });
    hit.forEach((m) => (out[m] = Math.min(out[m], [35, 60, 85][daysAgo])));
  }
  return out;
}

type Tip = { icon: string; title: string; body: string; vars?: Record<string, string | number> };

/** Tips to recover faster (design: recTips). */
export function recTips(r: ReturnType<typeof recovery>, x: RecoveryInput): Tip[] {
  const t: Tip[] = [];
  if (!r.checked) t.push({ icon: 'info', title: 'Answer 3 quick questions', body: 'Tell me how you slept and feel today for a more accurate score.' });
  if (r.checked && (r.sleepH ?? 8) < 7) t.push({ icon: 'moon', title: 'Sleep more tonight', body: 'You slept {n} h. Aim for 7.5 to 8 h: lights out a bit earlier and no screens 30 minutes before.', vars: { n: r.sleepH ?? 0 } });
  if (r.sore > 0) t.push({ icon: 'body', title: 'Sore muscles', body: '10 minutes of light stretching and foam rolling on the sore areas helps more than full rest.' });
  if (x.protein && x.protein.eaten < x.protein.target * 0.9)
    t.push({ icon: 'food', title: 'Eat your protein', body: 'You still need {n} g today. Have Greek yogurt or a shake before bed. It helps repair overnight.', vars: { n: Math.round(x.protein.target - x.protein.eaten) } });
  if (x.water.ml < x.water.goal * 0.7) t.push({ icon: 'drop', title: 'Drink more water', body: 'You’re at {a} of {b} ml. Even mild dehydration slows recovery.', vars: { a: x.water.ml, b: x.water.goal } });
  if (r.acwr > 1.3) t.push({ icon: 'train', title: 'Training load jumped', body: 'This week’s load is {n}× your usual. Consider a lighter day or a deload week.', vars: { n: Math.round(r.acwr * 10) / 10 } });
  if (r.score < 50) t.push({ icon: 'bolt', title: 'Make today light', body: 'Swap the workout for a 30-minute walk and mobility. You’ll train better tomorrow.' });
  t.push({ icon: 'walk', title: 'Move on rest days', body: 'A 20 to 30 minute easy walk increases blood flow and speeds up recovery.' });
  return t.slice(0, 5);
}
