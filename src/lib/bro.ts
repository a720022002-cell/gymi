import type { Look } from './avatar';
import { supabase } from './supabase';

/** A Gym Bros cartoon: you, a friend or a group member, with their 30-day commitment (null when they don't share it). */
export type Bro = { user_id: string; username: string; name: string | null; gender: string | null; pct: number | null; look?: unknown };

/** The cartoon's level (1–7) from the 30-day commitment: under 30, 30–41, 42–54, 55–67, 68–79, 80–89, 90 and up. */
export const broLevel = (pct: number | null | undefined) => (pct == null ? 0 : pct >= 90 ? 7 : pct >= 80 ? 6 : pct >= 68 ? 5 : pct >= 55 ? 4 : pct >= 42 ? 3 : pct >= 30 ? 2 : 1);
export const BRO_LEVELS = ['Starter', 'Warming up', 'Getting there', 'Solid', 'Strong', 'Very strong', 'Beast'];

/** You and your friends. Null when it couldn't load (offline, or the database doesn't have it yet). */
export async function myCrew(): Promise<Bro[] | null> {
  const { data, error } = await supabase.rpc('my_crew');
  return error ? null : ((data as Bro[] | null) ?? []);
}

/** A group's members (only for its members). */
export async function groupBros(group: string): Promise<Bro[] | null> {
  const { data, error } = await supabase.rpc('group_bros', { p_group: group });
  return error ? null : ((data as Bro[] | null) ?? []);
}

/** Average commitment of the members who share it. */
export const groupPct = (xs: Bro[]) => {
  const v = xs.map((x) => x.pct).filter((p): p is number => p != null);
  return v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length) : null;
};

// The last commitment saved this session, so it's only sent when it changes.
let sent: string | null = null;
/** Save your 30-day commitment, so friends see your cartoon at the right level. */
export async function saveMyBro(uid: string, pct: number | null) {
  const key = `${uid}|${pct}`;
  if (sent === key) return;
  const { error } = await supabase.from('bro_levels').upsert({ user_id: uid, pct, updated_at: new Date().toISOString() });
  if (!error) sent = key;
}

/** Your character's look, saved (shown to friends and groups) and kept for this session. */
let myLook: { uid: string; look: unknown } | null = null;
export const cachedLook = (uid: string | undefined) => (uid && myLook?.uid === uid ? myLook.look : undefined);
export function rememberLook(uid: string, look: unknown) {
  if (look) myLook = { uid, look };
}
export async function loadMyLook(uid: string): Promise<unknown> {
  const { data } = await supabase.from('bro_levels').select('look').eq('user_id', uid).maybeSingle();
  const look = (data as { look?: unknown } | null)?.look ?? null;
  rememberLook(uid, look);
  return look;
}
export async function saveMyLook(uid: string, look: Look) {
  const { error } = await supabase.from('bro_levels').upsert({ user_id: uid, look, updated_at: new Date().toISOString() });
  if (!error) rememberLook(uid, look);
  return !error;
}
