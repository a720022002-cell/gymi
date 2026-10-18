import { useEffect, useState } from 'react';

import { useAuth } from '@/lib/auth';
import { cycleNow, type CycleMode, cycleVersion, peekCycle, type Phase, pregnancySafe } from '@/lib/cycle';
import { localDay } from '@/lib/nutrition';

export type CycleToday = { phase: Phase; day: number; mode: CycleMode; next: string; late: boolean };

// One read per minute is plenty; saving cycle data (cycleVersion) clears it.
const cache = new Map<string, { at: number; day: string; ver: number; v: CycleToday | null; preg: boolean }>();
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
  const out = { at: Date.now(), day, ver, v, preg: pregnancySafe(c.settings) };
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
