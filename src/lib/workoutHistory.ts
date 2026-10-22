// Your past workouts, read straight from the database (the Train store only keeps the last 120 days).
import { supabase } from './supabase';
import type { LoggedEx, WorkoutLog } from './train';
import { EX } from './training';

export const HISTORY_PAGE = 30;

const clean = (rows: WorkoutLog[] | null) => (rows ?? []).map((x) => ({ ...x, volume: +x.volume, exercises: x.exercises ?? [], prs: x.prs ?? [] }));

/** One page of workouts, newest first. `before`: the started_at of the last one already shown. */
export async function loadWorkoutPage(before?: string): Promise<{ rows: WorkoutLog[]; more: boolean } | null> {
  let q = supabase.from('workout_logs').select('*').order('started_at', { ascending: false }).limit(HISTORY_PAGE + 1);
  if (before) q = q.lt('started_at', before);
  const { data, error } = await q;
  if (error) return null;
  const rows = clean(data as WorkoutLog[]);
  return { rows: rows.slice(0, HISTORY_PAGE), more: rows.length > HISTORY_PAGE };
}

export async function loadWorkout(id: string): Promise<WorkoutLog | null> {
  const { data } = await supabase.from('workout_logs').select('*').eq('id', id).maybeSingle();
  return data ? clean([data as WorkoutLog])[0] : null;
}

export type ExerciseSession = { id: string; day: string; workout: string; sets: LoggedEx['sets']; light?: boolean; time?: boolean };

/** The last times you did one exercise: the sets you did each time, newest first. */
export async function loadExerciseHistory(exId: string, limit = 8): Promise<ExerciseSession[] | null> {
  const { data, error } = await supabase
    .from('workout_logs')
    .select('id,day,name,exercises')
    .contains('exercises', JSON.stringify([{ id: exId }]))
    .order('started_at', { ascending: false })
    .limit(limit);
  if (error) return null;
  return ((data as Pick<WorkoutLog, 'id' | 'day' | 'name' | 'exercises'>[]) ?? []).flatMap((w) => {
    const ex = (w.exercises ?? []).find((e) => e.id === exId);
    return ex && ex.sets.length ? [{ id: w.id, day: w.day, workout: w.name, sets: ex.sets, light: ex.light, time: ex.time }] : [];
  });
}

/** An exercise's name in your language (the log keeps the name it had that day, and newer logs its Arabic name too). */
export const loggedExName = (ex: { id: string; n: string; ar?: string }, lang: 'en' | 'ar') => (lang === 'ar' ? (EX[ex.id]?.ar ?? ex.ar ?? ex.n) : ex.n);

/** A past workout was changed (the changed fields) or deleted (null). The history list listens so it shows it. */
type LogChange = (id: string, patch: Partial<WorkoutLog> | null) => void;
const listeners = new Set<LogChange>();
export function onLogChange(fn: LogChange) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
export const emitLogChange = (id: string, patch: Partial<WorkoutLog> | null) => listeners.forEach((fn) => fn(id, patch));

/** Volume (kg moved) and sets of a workout's exercises. */
export function logTotals(exercises: LoggedEx[]) {
  let volume = 0;
  let sets = 0;
  for (const x of exercises)
    for (const s of x.sets) {
      volume += s.w * s.r;
      sets++;
    }
  return { volume: Math.round(volume * 10) / 10, sets_done: sets };
}

const topOf = (x: LoggedEx) => Math.max(0, ...x.sets.map((s) => s.w));

/**
 * Records again after a workout changed or was deleted, for the exercises it had (`ids`): that workout and every later
 * one with them. A record is a weight above your best before it (as when it was saved). `edited`: the changed workout
 * (left out when deleted). Returns the new records of each workout that changed, or null without a connection.
 */
export async function recomputePrs(ids: string[], from: string, edited: WorkoutLog | null): Promise<Record<string, { started_at: string; prs: WorkoutLog['prs'] }> | null> {
  if (!ids.length) return {};
  // Best weight on each exercise before the changed workout.
  const before = await Promise.all(
    ids.map((id) =>
      supabase
        .from('workout_logs')
        .select('exercises')
        .lt('started_at', from)
        .contains('exercises', JSON.stringify([{ id }])),
    ),
  );
  if (before.some((r) => r.error)) return null;
  const best: Record<string, number> = {};
  ids.forEach((id, k) => {
    best[id] = 0;
    for (const row of (before[k].data as Pick<WorkoutLog, 'exercises'>[]) ?? []) for (const x of row.exercises ?? []) if (x.id === id) best[id] = Math.max(best[id], topOf(x));
  });
  // That workout and the later ones, oldest first.
  const { data, error } = await supabase.from('workout_logs').select('id,started_at,exercises,prs').gte('started_at', from).order('started_at').limit(1000);
  if (error) return null;
  const rows = ((data as Pick<WorkoutLog, 'id' | 'started_at' | 'exercises' | 'prs'>[]) ?? []).filter((r) => r.id !== edited?.id);
  if (edited) rows.unshift(edited);
  rows.sort((a, b) => a.started_at.localeCompare(b.started_at));
  const out: Record<string, { started_at: string; prs: WorkoutLog['prs'] }> = {};
  for (const r of rows) {
    const keep = (r.prs ?? []).filter((p) => !ids.includes(p.id));
    const fresh: WorkoutLog['prs'] = [];
    for (const x of r.exercises ?? []) {
      if (!ids.includes(x.id) || fresh.some((p) => p.id === x.id)) continue;
      const top = topOf(x);
      if (top > best[x.id] && best[x.id] > 0) fresh.push({ id: x.id, n: x.n, w: top });
      best[x.id] = Math.max(best[x.id], top);
    }
    const prs = [...keep, ...fresh];
    if (r.id === edited?.id || JSON.stringify(prs) !== JSON.stringify(r.prs ?? [])) out[r.id] = { started_at: r.started_at, prs };
  }
  return out;
}
