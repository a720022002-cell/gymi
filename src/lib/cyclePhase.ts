import { useEffect, useState } from 'react';

import { useAuth } from '@/lib/auth';
import { cycleNow, type CycleMode, cycleVersion, peekCycle, type Phase, pregnancySafe, weekNow } from '@/lib/cycle';
import { localDay } from '@/lib/nutrition';

export type CycleToday = { phase: Phase; day: number; mode: CycleMode; next: string; late: boolean };
/** Pregnant or after birth, and which week (moves on by itself). */
export type PregToday = { mode: 'preg' | 'post'; week: number | null };
/** Everything coaching needs about the cycle. `anon`: kept on this phone only, so never sent to the AI. */
export type CycleCoach = { cycle: CycleToday | null; preg: PregToday | null; anon: boolean; lock: boolean };

// One read per minute is plenty; saving cycle data (cycleVersion) clears it.
const cache = new Map<string, { at: number; day: string; ver: number; v: CycleToday | null; preg: boolean; stage: PregToday | null; anon: boolean; lock: boolean }>();
const TTL = 60_000;

async function read(uid: string) {
  const day = localDay();
  const hit = cache.get(uid);
  if (hit && hit.day === day && hit.ver === cycleVersion() && Date.now() - hit.at < TTL) return hit;
  const ver = cycleVersion();
  const c = await peekCycle(uid);
  const mode = c.settings?.mode ?? 'track';
  let v: CycleToday | null = null;
  if (mode === 'track' || mode === 'ttc' || mode === 'peri') {
    const n = cycleNow(c.periods ?? [], c.settings, day);
    // Very old data (no period logged for two cycles) says nothing about today.
    if (n && n.day <= n.cycle * 2) v = { phase: n.phase, day: n.day, mode, next: n.next, late: n.late };
  }
  const stage: PregToday | null = mode === 'preg' || mode === 'post' ? { mode, week: weekNow(c.settings, mode, day) } : null;
  const out = { at: Date.now(), day, ver, v, preg: pregnancySafe(c.settings), stage, anon: !!c.anon, lock: !!c.settings?.lock };
  cache.set(uid, out);
  return out;
}

/** Today's cycle phase for coaching (food, training, recovery, AI). Null when not tracking, pregnant, or no recent period logged. */
export async function loadCycleToday(uid: string): Promise<CycleToday | null> {
  try {
    return (await read(uid)).v;
  } catch {
    return null;
  }
}

/**
 * The luteal phase: weight and hunger rise by themselves, so no weight-plateau call and no lower-calorie suggestion
 * (for the Food tab's plateau card, the coach and the recap).
 */
export const lutealHold = (c: Pick<CycleToday, 'phase'> | null | undefined) => c?.phase === 'Luteal';

/** Phase, pregnancy and whether the data is private (on this phone only). */
export async function loadCycleCoach(uid: string): Promise<CycleCoach> {
  try {
    const r = await read(uid);
    return { cycle: r.v, preg: r.stage, anon: r.anon, lock: r.lock };
  } catch {
    return { cycle: null, preg: null, anon: true, lock: false };
  }
}

/** Hook version of loadCycleCoach: only loads for women (null until loaded). */
export function useCycleCoach() {
  const { session, profile } = useAuth();
  const uid = session?.user.id;
  const female = profile?.gender === 'female';
  const [v, setV] = useState<{ uid: string; c: CycleCoach } | null>(null);
  useEffect(() => {
    if (!uid || !female) return;
    let alive = true;
    loadCycleCoach(uid).then((c) => alive && setV({ uid, c }));
    return () => {
      alive = false;
    };
  }, [uid, female]);
  return female && v && v.uid === uid ? v.c : null;
}

/** Hook version: only loads for women. */
export function useCycleToday() {
  const { session, profile } = useAuth();
  const uid = session?.user.id;
  const female = profile?.gender === 'female';
  const [v, setV] = useState<{ uid: string; c: CycleToday | null } | null>(null);
  useEffect(() => {
    if (!uid || !female) return;
    let alive = true;
    loadCycleToday(uid).then((c) => alive && setV({ uid, c }));
    return () => {
      alive = false;
    };
  }, [uid, female]);
  return female && v && v.uid === uid ? v.c : null;
}
