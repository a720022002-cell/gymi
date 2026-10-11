import type { SessionMember } from './social';
import { supabase } from './supabase';
import { type Level, scheme } from './together';

/** One exercise in a group workout. n: a name for exercises outside the common list. */
export type GroupEx = { id: string; type: number; n?: string };
export type GroupSet = { w: number | null; r: number | null; done: boolean };
/** Your sets for one exercise. reps is your target (you can change it). */
export type MySets = { reps: number; sets: GroupSet[] };
export type BoardMember = SessionMember & { pos: number; sets: Record<string, MySets> };
export type Person = { id: string; name: string | null; username: string; joined: boolean };
export type GroupSessionRow = { id: string; host: string; host_name: string | null; status: 'open' | 'live' | 'done'; created_at: string; members: number; joined: boolean; scheduled_at: string | null; people: Person[] };

/** A group workout with its planned time. */
export type GroupSessionFull = { id: string; host: string; workout: GroupEx[]; status: 'open' | 'live' | 'done'; started_at: string | null; scheduled_at: string | null };

/** Start a group workout now, or plan one for later (friends get an invite). */
export async function startGroupWorkout(workout: GroupEx[], members: string[], levels: string[], myLevel: string, scheduled?: Date | null) {
  const { data, error } = await supabase.rpc('start_group_session', { p_workout: workout, p_members: members, p_levels: levels, p_my_level: myLevel, p_scheduled: scheduled ? scheduled.toISOString() : null });
  return error ? null : (data as string);
}

export async function groupSessions(): Promise<GroupSessionRow[]> {
  const { data } = await supabase.rpc('my_group_sessions');
  return ((data as GroupSessionRow[] | null) ?? []).map((x) => ({ ...x, people: x.people ?? [] }));
}

export async function getGroupWorkout(id: string) {
  const { data } = await supabase.from('group_sessions').select('id,host,workout,status,started_at,scheduled_at').eq('id', id).maybeSingle();
  return (data as GroupSessionFull) ?? null;
}

export async function groupBoard(id: string): Promise<BoardMember[]> {
  const { data } = await supabase.rpc('group_session_board', { p_id: id });
  return ((data as BoardMember[] | null) ?? []).map((m) => ({ ...m, sets: m.sets ?? {}, done: m.done ?? {} }));
}

/** Tap Start. Returns the workout's status: it goes live by itself once everyone is in. */
export async function joinGroupWorkout(id: string) {
  const { data } = await supabase.rpc('join_group_session', { p_id: id });
  return (data as string | null) ?? null;
}

/** Host: cancels it for everyone. Others: leave it. */
export async function leaveGroupWorkout(id: string) {
  const { data } = await supabase.rpc('leave_group_session', { p_id: id });
  return !!data;
}

/** Host: replace one exercise for the whole group. */
export async function swapGroupExercise(id: string, index: number, ex: GroupEx) {
  const { data } = await supabase.rpc('swap_group_exercise', { p_id: id, p_index: index, p_ex: ex });
  return !!data;
}

/** Save your sets (and the old per-exercise count, which older screens read). */
export async function saveMySets(id: string, uid: string, sets: Record<string, MySets>) {
  const done = Object.fromEntries(Object.entries(sets).map(([k, v]) => [k, v.sets.filter((s) => s.done).length]));
  const { error } = await supabase.from('group_session_members').update({ sets, done, updated_at: new Date().toISOString() }).eq('session_id', id).eq('user_id', uid);
  return !error;
}

/** Friends' training level (what they picked, or a guess from their history). Missing = unknown. */
export async function friendLevels(ids: string[]): Promise<Record<string, Level>> {
  if (!ids.length) return {};
  const { data } = await supabase.rpc('friend_levels', { p_ids: ids });
  return Object.fromEntries(((data as { id: string; level: Level | null }[] | null) ?? []).filter((x) => x.level).map((x) => [x.id, x.level as Level]));
}

/** Someone's sets for an exercise: what they saved, or the plan for their level. */
export function setsOf(m: Pick<BoardMember, 'level' | 'sets'>, ex: GroupEx): MySets {
  const saved = m.sets?.[ex.id];
  if (saved?.sets?.length) return saved;
  const sc = scheme(m.level, ex.type);
  return { reps: sc.reps, sets: Array.from({ length: sc.sets }, () => ({ w: null, r: null, done: false })) };
}

const allDone = (s: MySets) => s.sets.every((x) => x.done);

/**
 * Where the group is: the first exercise someone still has sets on, and whose turn it is
 * (the person with the fewest sets done on it; ties go in turn order).
 */
export function groupTurn(workout: GroupEx[], board: BoardMember[]) {
  const ppl = board.filter((m) => m.joined).sort((a, b) => a.pos - b.pos);
  let cur = workout.findIndex((ex) => ppl.some((m) => !allDone(setsOf(m, ex))));
  const finished = cur < 0;
  if (finished) cur = Math.max(0, workout.length - 1);
  const ex = workout[cur];
  let turn: BoardMember | null = null;
  if (!finished && ex)
    for (const m of ppl) {
      const s = setsOf(m, ex);
      if (allDone(s)) continue;
      if (!turn || s.sets.filter((x) => x.done).length < setsOf(turn, ex).sets.filter((x) => x.done).length) turn = m;
    }
  return { cur, turn, finished };
}

/** Other exercises for the same spot when a machine is busy (design: TOG_ALT). */
export const GROUP_ALT: Record<string, string[]> = {
  bench: ['dbpress', 'chestpress'],
  dbpress: ['bench', 'chestpress'],
  chestpress: ['bench', 'dbpress'],
  pulldown: ['pullup', 'dbrow'],
  pullup: ['pulldown', 'dbrow'],
  squat: ['legpress', 'goblet'],
  legpress: ['squat', 'goblet'],
  goblet: ['squat', 'legpress'],
  shoulder: ['dbshoulder', 'arnold'],
  dbshoulder: ['shoulder', 'arnold'],
  arnold: ['shoulder', 'dbshoulder'],
  cablerow: ['dbrow', 'tbar'],
  dbrow: ['cablerow', 'tbar'],
  tbar: ['cablerow', 'dbrow'],
  plank: ['sideplank', 'mountain'],
  sideplank: ['plank', 'mountain'],
  mountain: ['plank', 'sideplank'],
};

/** "Today", "Tomorrow" or the weekday for a planned workout, plus the time. */
export function whenLabel(iso: string, t: (s: string, v?: Record<string, string | number>) => string, lang: 'en' | 'ar', today: Date = new Date()) {
  const d = new Date(iso);
  const day0 = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const diff = Math.round((new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() - day0) / 864e5);
  const loc = lang === 'ar' ? 'ar-u-nu-latn' : 'en-US';
  const day = diff === 0 ? t('Today') : diff === 1 ? t('Tomorrow') : new Intl.DateTimeFormat(loc, { weekday: 'long' }).format(d);
  return { day, time: new Intl.DateTimeFormat(loc, { hour: 'numeric', minute: '2-digit' }).format(d) };
}
