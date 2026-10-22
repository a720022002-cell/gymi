// Vitamins "taken today": one row per supplement and day you tapped Taken (table supplement_logs).
import { useCallback, useEffect, useState } from 'react';

import { addDays, localDay } from './nutrition';
import { supabase } from './supabase';

/** How far back the logs are loaded (enough for a streak and the 7-day dots). */
const BACK = 60;

/** Each supplement's days taken, as "YYYY-MM-DD" strings. */
export type SupLogs = Record<string, string[]>;

export async function loadSupLogs(from: string): Promise<SupLogs | null> {
  const { data, error } = await supabase.from('supplement_logs').select('supplement_id,day').gte('day', from).order('day').limit(2000);
  if (error) return null;
  const out: SupLogs = {};
  for (const r of (data as { supplement_id: string; day: string }[]) ?? []) (out[r.supplement_id] ??= []).push(r.day);
  return out;
}

export async function setTaken(id: string, day: string, on: boolean) {
  const { error } = on
    ? await supabase.from('supplement_logs').upsert({ supplement_id: id, day }, { onConflict: 'user_id,supplement_id,day', ignoreDuplicates: true })
    : await supabase.from('supplement_logs').delete().eq('supplement_id', id).eq('day', day);
  return !error;
}

/** Days in a row up to today (or up to yesterday while today isn't marked yet). */
export function streakOf(days: string[] | undefined, today: string) {
  const set = new Set(days ?? []);
  let d = set.has(today) ? today : addDays(today, -1);
  let n = 0;
  while (set.has(d)) {
    n++;
    d = addDays(d, -1);
  }
  return n;
}

/** The last 7 days, oldest first: taken or not. */
export const last7 = (days: string[] | undefined, today: string) => {
  const set = new Set(days ?? []);
  return Array.from({ length: 7 }, (_, i) => {
    const d = addDays(today, i - 6);
    return { day: d, on: set.has(d) };
  });
};

/** Your supplement logs, with a Taken toggle for today (shown at once, saved in the background). */
export function useSupplementLogs(today = localDay()) {
  const [logs, setLogs] = useState<SupLogs>({});
  const [ok, setOk] = useState(true);
  useEffect(() => {
    let alive = true;
    loadSupLogs(addDays(today, -BACK)).then((l) => {
      if (!alive) return;
      if (l) setLogs(l);
      setOk(!!l);
    });
    return () => {
      alive = false;
    };
  }, [today]);
  const toggle = useCallback(
    async (id: string, day = today) => {
      const on = !(logs[id] ?? []).includes(day);
      const put = (v: boolean) => setLogs((x) => ({ ...x, [id]: v ? [...(x[id] ?? []).filter((d) => d !== day), day].sort() : (x[id] ?? []).filter((d) => d !== day) }));
      put(on);
      const saved = await setTaken(id, day, on);
      if (!saved) put(!on);
      return saved ? on : null;
    },
    [logs, today],
  );
  return { logs, ok, toggle };
}
