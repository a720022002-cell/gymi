import type { SessionMember } from './social';
import { type SportId, sportInfo } from './sports';
import { supabase } from './supabase';
import { type Level, scheme } from './together';
import { exInfo } from './training';

/**
 * One exercise in a group workout. n: a name for exercises outside the common list (ar: its Arabic name).
 * type 3 is cardio done side by side (id "cardio:<sport>", min: the minutes); 0–2 as in together.ts.
 */
export type GroupEx = { id: string; type: number; n?: string; ar?: string | null; m?: string; min?: number };

export const isCardio = (x: Pick<GroupEx, 'type' | 'id'>) => x.type === 3 || x.id.startsWith('cardio:');
export const cardioSportOf = (x: Pick<GroupEx, 'id'>) => x.id.slice('cardio:'.length) as SportId;
/** A cardio item for a group workout. */
export const cardioEx = (sport: SportId, min: number): GroupEx => ({ id: `cardio:${sport}`, type: 3, n: sportInfo(sport).name, min });
/** An exercise's name in the reader's language (cardio by its sport). */
export function groupExName(x: GroupEx, lang: 'en' | 'ar', t: (s: string) => string) {
  if (isCardio(x)) return t(sportInfo(cardioSportOf(x)).name);
  return exInfo({ id: x.id, n: x.n, ar: x.ar }, lang).name;
}
export type GroupSet = { w: number | null; r: number | null; done: boolean };
/** Your sets for one exercise. reps is your target (you can change it). alt: the exercise you do in its place. */
export type MySets = { reps: number; sets: GroupSet[]; alt?: GroupEx };
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

/** Host: the workout's title and, for each person, what joining changes in their plan. */
export async function setGroupSessionInfo(id: string, title: string, notes: Record<string, { action: string; text: string; text_ar?: string; day: string }>) {
  const { data } = await supabase.rpc('set_group_session_info', { p_id: id, p_title: title, p_notes: notes });
  return !!data;
}

/** Titles and notes of group workouts (members can read their sessions). */
export async function groupSessionInfo(ids: string[]): Promise<Record<string, { title: string | null; notes: Record<string, { action: string; text: string; text_ar?: string; day: string }> }>> {
  if (!ids.length) return {};
  const { data } = await supabase.from('group_sessions').select('id,title,notes').in('id', ids);
  return Object.fromEntries(((data as { id: string; title: string | null; notes: Record<string, { action: string; text: string; text_ar?: string; day: string }> | null }[] | null) ?? []).map((x) => [x.id, { title: x.title, notes: x.notes ?? {} }]));
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
  if (isCardio(ex)) return { reps: ex.min ?? 20, sets: [{ w: null, r: null, done: false }] };
  const sc = scheme(m.level, ex.type);
  return { reps: sc.reps, sets: Array.from({ length: sc.sets }, () => ({ w: null, r: null, done: false })) };
}

/** The exercise someone actually does for a spot in the workout (their own swap, or the group's). */
export const exOf = (m: Pick<BoardMember, 'level' | 'sets'>, ex: GroupEx): GroupEx => setsOf(m, ex).alt ?? ex;

/** A change a friend made during the workout, for the others to copy or not. alt null: back to the group's exercise. */
export type GroupChange = { key: string; who: string; exId: string; kind: 'add' | 'del' | 'swap'; alt?: GroupEx | null };

/** What friends changed between two looks at the board: a set added or removed, or an exercise swapped. */
export function groupChanges(workout: GroupEx[], before: BoardMember[], after: BoardMember[], me: string): GroupChange[] {
  const out: GroupChange[] = [];
  for (const m of after) {
    const p = before.find((x) => x.user_id === m.user_id);
    if (m.user_id === me || !m.joined || !p?.joined) continue;
    const who = m.name || m.username;
    for (const ex of workout) {
      if (isCardio(ex)) continue;
      const a = setsOf(p, ex);
      const b = setsOf(m, ex);
      const stamp = `${m.user_id}:${ex.id}:${m.updated_at}`;
      if (b.sets.length > a.sets.length) out.push({ key: `${stamp}:add`, who, exId: ex.id, kind: 'add' });
      else if (b.sets.length < a.sets.length) out.push({ key: `${stamp}:del`, who, exId: ex.id, kind: 'del' });
      if ((a.alt?.id ?? '') !== (b.alt?.id ?? '')) out.push({ key: `${stamp}:swap`, who, exId: ex.id, kind: 'swap', alt: b.alt ?? null });
    }
  }
  return out;
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
  if (!finished && ex && !isCardio(ex))
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

/** "I'm here, starting without you": a notification to everyone who hasn't joined. 'ok', 'wait' (just sent) or 'none'. */
export async function pingGroup(id: string) {
  const { data, error } = await supabase.rpc('group_ping', { p_id: id });
  return error ? 'none' : ((data as string | null) ?? 'none');
}

/**
 * The friendly push in a group workout: how you compare with your friends on this exercise (top weight, then reps),
 * or on the whole workout so far. Only friends who logged a set count. null when there's nothing to compare.
 */
export function groupNudge(ex: GroupEx, me: BoardMember | undefined, others: BoardMember[]) {
  if (!me || isCardio(ex) || ex.type === 2) return null;
  // Only friends doing the same exercise as you.
  const mineId = exOf(me, ex).id;
  others = others.filter((m) => exOf(m, ex).id === mineId);
  const top = (m: BoardMember) => {
    const done = setsOf(m, ex).sets.filter((s) => s.done && (s.w ?? 0) > 0);
    if (!done.length) return null;
    const w = Math.max(...done.map((s) => s.w ?? 0));
    return { w, r: Math.max(...done.filter((s) => s.w === w).map((s) => s.r ?? 0)) };
  };
  const mine = top(me);
  const theirs = others.filter((m) => m.joined).map((m) => ({ m, x: top(m) })).filter((y): y is { m: BoardMember; x: { w: number; r: number } } => !!y.x);
  if (mine && theirs.length) {
    const best = theirs.sort((a, b) => b.x.w - a.x.w || b.x.r - a.x.r)[0];
    if (best.x.w > mine.w) return { kind: 'behind' as const, who: best.m, kg: best.x.w, diff: Math.round((best.x.w - mine.w) * 10) / 10 };
    if (best.x.w === mine.w && best.x.r > mine.r) return { kind: 'reps' as const, who: best.m, reps: best.x.r - mine.r };
    const second = theirs[0];
    if (mine.w > second.x.w) return { kind: 'ahead' as const, who: second.m, diff: Math.round((mine.w - second.x.w) * 10) / 10 };
    return null;
  }
  return null;
}

/** A saved group workout: its title and who you trained with (not you). Kept once loaded. */
export type TogetherInfo = { title: string | null; people: string[] };
const togetherCache = new Map<string, TogetherInfo | null>();
export async function togetherOf(logId: string, me: string): Promise<TogetherInfo | null> {
  if (togetherCache.has(logId)) return togetherCache.get(logId) ?? null;
  const { data } = await supabase.from('workout_logs').select('group_session').eq('id', logId).maybeSingle();
  const sid = (data as { group_session: string | null } | null)?.group_session;
  if (!sid) {
    togetherCache.set(logId, null);
    return null;
  }
  const [info, board] = await Promise.all([groupSessionInfo([sid]), groupBoard(sid)]);
  const x = { title: info[sid]?.title ?? null, people: board.filter((m) => m.user_id !== me && m.joined).map((m) => m.name || m.username) };
  togetherCache.set(logId, x);
  return x;
}
