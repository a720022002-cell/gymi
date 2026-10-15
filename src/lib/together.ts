/** Train together: one workout built from everyone's plan, and the right sets and reps for each level. */
import { askAI } from './ai';
import { supabase } from './supabase';
import { DAYS_LONG, EX, type PlanEx, type TrainPlan, effectiveWeek, exInfo, setWeekMoves, weekStart } from './training';

export type Level = 'Beginner' | 'Intermediate' | 'Advanced';
export type Person = { name: string; level: Level; me?: boolean; id?: string };
export const LEVELS: Level[] = ['Beginner', 'Intermediate', 'Advanced'];
export const COLORS = ['#3355FF', '#15803D', '#B45309', '#7C3AED', '#DB2777'];

/** One full-body workout for the group (design: together). 1 = main lift, 0 = extra, 2 = timed. */
export const TOG: [string, number][] = [
  ['bench', 1],
  ['pulldown', 1],
  ['squat', 1],
  ['shoulder', 0],
  ['cablerow', 0],
  ['plank', 2],
];
export function scheme(level: Level, type: number): { sets: number; reps: number; timed: boolean } {
  if (type === 2) return { sets: 3, reps: level === 'Beginner' ? 30 : level === 'Advanced' ? 60 : 45, timed: true };
  if (type === 1) return { Beginner: { sets: 3, reps: 10 }, Intermediate: { sets: 4, reps: 8 }, Advanced: { sets: 4, reps: 6 } }[level] as { sets: number; reps: number } & { timed: false };
  return { sets: 3, reps: level === 'Advanced' ? 10 : 12, timed: false };
}


/** What joining does to someone's plan: counts as their planned workout, moves it to their next rest day, or is an extra session. */
export type TogetherAction = 'replace' | 'move' | 'extra';
export type TogetherNote = { action: TogetherAction; text: string; text_ar?: string };
export type TogetherPlan = { title: string; ex: [string, number][]; notes: Record<string, TogetherNote>; ai: boolean };

/** What someone's own plan says for a day (from their plan, or from a friend's via friend_training). */
export type DayInfo = { key: string; name: string; level: Level; planned: string | null; plannedEx: PlanEx[]; injuries: string[]; recent: { day: string; name: string }[] };

export function myDayInfo(plan: TrainPlan | null, day: string, name: string, level: Level, logs: { day: string; name: string }[]): DayInfo {
  const w = plan ? effectiveWeek(plan, weekStart(day))[new Date(`${day}T12:00:00`).getDay()]?.w ?? null : null;
  return { key: 'me', name, level, planned: w, plannedEx: (w && plan?.workouts[w]?.ex) || [], injuries: plan?.injuries ?? [], recent: logs.filter((l) => l.day > addDay(day, -7) && l.day <= day).slice(0, 5) };
}

const addDay = (day: string, n: number) => {
  const d = new Date(`${day}T12:00:00`);
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/** Friends' plans for a day (friends only, from the server). */
export async function friendsDay(ids: string[], day: string): Promise<DayInfo[]> {
  if (!ids.length) return [];
  const { data } = await supabase.rpc('friend_training', { p_ids: ids, p_day: day });
  return ((data as { id: string; name: string | null; level: Level; planned: string | null; planned_ex: PlanEx[] | null; injuries: string[] | null; recent: { day: string; name: string }[] | null }[] | null) ?? []).map((r) => ({
    key: r.id,
    name: r.name ?? '',
    level: r.level,
    planned: r.planned,
    plannedEx: r.planned_ex ?? [],
    injuries: r.injuries ?? [],
    recent: r.recent ?? [],
  }));
}

/** The default when the AI can't help: the full-body workout. */
export const fallbackPlan = (people: { key: string }[]): TogetherPlan => ({ title: 'Full body', ex: TOG, notes: Object.fromEntries(people.map((p) => [p.key, { action: 'extra' as const, text: '' }])), ai: false });

/** Ask the AI for one workout that fits everyone's plan that day, and what joining means for each person. */
export async function buildTogether(people: DayInfo[], day: string, lang: 'en' | 'ar'): Promise<TogetherPlan> {
  const exercises = Object.values(EX).map((e) => ({ id: e.id, name: e.en, muscle: e.m, equipment: e.t, stress: e.stress ?? [] }));
  const { result } = await askAI<{ title: string; exercises: { id: string; type: number }[]; people: { key: string; action: string; text: string; text_ar?: string }[] }>('together', {
    lang,
    day: DAYS_LONG[new Date(`${day}T12:00:00`).getDay()],
    exercises,
    people: people.map((p) => ({ key: p.key, name: p.name, level: p.level, planned: p.planned ?? 'rest day', plannedExercises: p.plannedEx.map((x) => exInfo(x, 'en').name), injuries: p.injuries, recent: p.recent })),
  });
  // Never an exercise that strains someone's injury: use its safer alternative, or drop it.
  const hurt = new Set(people.flatMap((p) => p.injuries));
  const safe = (id: string) => (EX[id]?.stress?.some((x) => hurt.has(x)) ? (EX[id].alt && !EX[EX[id].alt]?.stress?.some((x) => hurt.has(x)) ? EX[id].alt : null) : id);
  const ex = [...new Map((result?.exercises ?? []).filter((x) => EX[x.id]).map((x) => [safe(x.id), [0, 1, 2].includes(x.type) ? x.type : 0] as const)).entries()]
    .filter((x): x is [string, number] => !!x[0])
    .slice(0, 7);
  if (!result || ex.length < 3) return fallbackPlan(people);
  const notes: Record<string, TogetherNote> = {};
  for (const p of people) {
    const n = result.people?.find((x) => x.key === p.key);
    const action = (['replace', 'move', 'extra'].includes(n?.action ?? '') ? n?.action : p.planned ? 'replace' : 'extra') as TogetherAction;
    notes[p.key] = { action, text: String(n?.text ?? '').slice(0, 200), text_ar: String(n?.text_ar ?? '').slice(0, 200) };
  }
  return { title: String(result.title || 'Full body').slice(0, 40), ex, notes, ai: true };
}

/** Accepting an invite: "move" puts that day's planned workout on the next rest day of that week (this week only). */
export function applyTogether(plan: TrainPlan, sid: string, action: TogetherAction | undefined, day: string): TrainPlan {
  if (plan.togetherDone?.[sid]) return plan;
  const done = { ...(plan.togetherDone ?? {}), [sid]: true as const };
  if (action !== 'move') return { ...plan, togetherDone: done };
  const start = weekStart(day);
  const week = effectiveWeek(plan, start).map((d) => ({ ...d }));
  const i = new Date(`${day}T12:00:00`).getDay();
  const w = week[i]?.w;
  const free = week.findIndex((d, j) => j > i && !d.w);
  if (!w || free < 0) return { ...plan, togetherDone: done };
  week[free].w = w;
  week[i].w = null;
  return { ...plan, ...setWeekMoves(plan, start, week), togetherDone: done };
}

/** A note in the reader's language. */
export const noteText = (n: { text?: string; text_ar?: string } | undefined, lang: 'en' | 'ar') => (lang === 'ar' && n?.text_ar) || n?.text || '';
