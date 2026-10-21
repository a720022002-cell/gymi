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

export type ExerciseSession = { id: string; day: string; workout: string; sets: LoggedEx['sets']; light?: boolean };

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
    return ex && ex.sets.length ? [{ id: w.id, day: w.day, workout: w.name, sets: ex.sets, light: ex.light }] : [];
  });
}

/** An exercise's name in your language (the log keeps the name it had that day, and newer logs its Arabic name too). */
export const loggedExName = (ex: { id: string; n: string; ar?: string }, lang: 'en' | 'ar') => (lang === 'ar' ? (EX[ex.id]?.ar ?? ex.ar ?? ex.n) : ex.n);
