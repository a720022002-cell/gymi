import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, type PropsWithChildren, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { useAuth } from './auth';
import { addDays, localDay } from './nutrition';
import { shareWorkout } from './social';
import { supabase } from './supabase';
import { buildWorkout, type Day, effectiveWeek, type LastSets, type PlanEx, topReps, type TrainPlan, weekdayOf, weekStart, workoutKcal } from './training';

export type LoggedEx = { id: string; n: string; sets: { w: number; r: number }[] };
export type WorkoutLog = {
  id: string;
  day: string;
  name: string;
  started_at: string;
  minutes: number;
  volume: number;
  sets_done: number;
  kcal: number;
  exercises: LoggedEx[];
  prs: { id: string; n: string; w: number }[];
  ups: number;
  downs: number;
};

export type SessionSet = { w: string; r: string; done: boolean; lw: number; lr: number };
export type SessionEx = Omit<PlanEx, 'sets'> & { tip: boolean; sets: SessionSet[] };
/** The workout in progress. Saved on the device so a reload doesn't lose it. */
export type Session = { name: string; start: number; home: boolean; ex: SessionEx[] };

type Train = {
  ready: boolean;
  setupDone: boolean;
  plan: TrainPlan | null;
  savePlan: (p: TrainPlan, setupDone?: boolean) => Promise<boolean>;
  updatePlan: (patch: Partial<TrainPlan>) => void;
  today: string;
  todayIdx: number;
  /** This week, Sunday to Saturday, with moves for this week only. */
  week: Day[];
  setWeek: (week: Day[], thisWeekOnly: boolean) => void;
  /** Weekdays (0 = Sunday) this week with a finished workout. */
  doneIdx: Set<number>;
  todayName: string | null;
  todayLog: WorkoutLog | null;
  logs: WorkoutLog[];
  last: LastSets;
  best: Record<string, number>;
  session: Session | null;
  startWorkout: (name: string, home: boolean, short: boolean, opts?: { light?: boolean; deload?: boolean; ex?: PlanEx[] }) => void;
  setSession: (s: Session | null) => void;
  finishWorkout: (names: Record<string, string>) => Promise<WorkoutLog | null>;
  /** Workouts finished in a row without missing a planned one (last 8 weeks). */
  streak: number;
};

const Ctx = createContext<Train | null>(null);
const SESSION_KEY = 'gymi.session.v1';

export function TrainProvider({ children }: PropsWithChildren) {
  const { session: auth, profile } = useAuth();
  const userId = auth?.user.id;
  const [today, setToday] = useState(localDay());
  const [readyFor, setReadyFor] = useState<string | null>(null);
  const ready = !!userId && readyFor === userId;
  const [setupDone, setSetupDone] = useState(false);
  const [plan, setPlan] = useState<TrainPlan | null>(null);
  const [logs, setLogs] = useState<WorkoutLog[]>([]);
  const [session, setSessionState] = useState<Session | null>(null);
  const planRef = useRef(plan);
  useEffect(() => {
    planRef.current = plan;
  }, [plan]);
  const saveTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') setToday(localDay());
    });
    const id = setInterval(() => setToday(localDay()), 60_000);
    return () => {
      sub.remove();
      clearInterval(id);
    };
  }, []);

  useEffect(() => {
    if (!userId) return;
    let alive = true;
    (async () => {
      const [p, l, s] = await Promise.all([
        supabase.from('train_plans').select('*').eq('user_id', userId).maybeSingle(),
        supabase.from('workout_logs').select('*').gte('day', addDays(localDay(), -120)).order('started_at', { ascending: false }).limit(150),
        AsyncStorage.getItem(`${SESSION_KEY}.${userId}`).catch(() => null),
      ]);
      if (!alive) return;
      const raw = p.data?.plan as TrainPlan | undefined;
      setPlan(raw?.week ? { ...raw, skipped: raw.skipped ?? {}, dismiss: raw.dismiss ?? {}, machines: raw.machines ?? {} } : null);
      setSetupDone(!!p.data?.setup_done && !!raw?.week);
      setLogs(((l.data as WorkoutLog[]) ?? []).map((x) => ({ ...x, volume: +x.volume })));
      try {
        setSessionState(s ? (JSON.parse(s) as Session) : null);
      } catch {
        setSessionState(null);
      }
      setReadyFor(userId);
    })();
    return () => {
      alive = false;
    };
  }, [userId]);

  const savePlan = useCallback(
    async (p: TrainPlan, done?: boolean) => {
      if (!userId) return false;
      setPlan(p);
      planRef.current = p;
      if (done !== undefined) setSetupDone(done);
      const { error } = await supabase.from('train_plans').upsert({ user_id: userId, plan: p, ...(done !== undefined ? { setup_done: done } : {}) });
      return !error;
    },
    [userId],
  );

  const updatePlan = useCallback(
    (patch: Partial<TrainPlan>) => {
      if (!planRef.current) return;
      const next = { ...planRef.current, ...patch };
      planRef.current = next;
      setPlan(next);
      clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        if (userId) supabase.from('train_plans').upsert({ user_id: userId, plan: next }).then(() => {});
      }, 500);
    },
    [userId],
  );

  const start = weekStart(today);
  const todayIdx = weekdayOf(today);
  const week = useMemo(() => (plan ? effectiveWeek(plan, start) : []), [plan, start]);

  const setWeek = useCallback(
    (w: Day[], thisWeekOnly: boolean) => {
      if (!planRef.current) return;
      if (thisWeekOnly) updatePlan({ override: { start, week: w } });
      else updatePlan({ week: w, override: undefined });
    },
    [start, updatePlan],
  );

  const doneIdx = useMemo(() => new Set(logs.filter((l) => l.day >= start && l.day <= addDays(start, 6)).map((l) => weekdayOf(l.day))), [logs, start]);
  const todayLog = logs.find((l) => l.day === today) ?? null;
  const todayName = week[todayIdx]?.w ?? null;

  // Last time's sets and best weight for each exercise.
  const { last, best } = useMemo(() => {
    const last: LastSets = {};
    const best: Record<string, number> = {};
    for (const l of logs)
      for (const x of l.exercises ?? []) {
        if (!last[x.id] && x.sets.length) last[x.id] = x.sets;
        best[x.id] = Math.max(best[x.id] ?? 0, ...x.sets.map((s) => s.w));
      }
    return { last, best };
  }, [logs]);

  // Workouts in a row: count back from today until a planned workout was missed (not done, not skipped).
  const streak = useMemo(() => {
    if (!plan) return 0;
    const days = new Set(logs.map((l) => l.day));
    let n = days.has(today) ? 1 : 0;
    for (let i = 1; i <= 56; i++) {
      const d = addDays(today, -i);
      if (plan.since && d < plan.since) break;
      if (days.has(d)) n++;
      else if (plan.week[weekdayOf(d)]?.w && !plan.skipped[d]) break;
    }
    return n;
  }, [logs, plan, today]);

  const setSession = useCallback(
    (s: Session | null) => {
      setSessionState(s);
      if (!userId) return;
      if (s) AsyncStorage.setItem(`${SESSION_KEY}.${userId}`, JSON.stringify(s)).catch(() => {});
      else AsyncStorage.removeItem(`${SESSION_KEY}.${userId}`).catch(() => {});
    },
    [userId],
  );

  const startWorkout = useCallback(
    (name: string, home: boolean, short: boolean, opts?: { light?: boolean; deload?: boolean; ex?: PlanEx[] }) => {
      const p = planRef.current;
      if (!p) return;
      // A one-off list (Train together) uses the same building rules as a planned workout.
      const src = opts?.ex ? { ...p, workouts: { ...p.workouts, [name]: { ex: opts.ex, focus: '', min: 0 } } } : p;
      const wo = buildWorkout(src, name, { home, short, light: opts?.light, deload: opts?.deload, last });
      const lighter = !!(opts?.light || opts?.deload);
      setSession({
        name,
        start: Date.now(),
        home,
        ex: wo.ex.map(({ swapped: _s, target, last: ls, sets, ...x }) => ({
          ...x,
          tip: false,
          sets: Array.from({ length: sets }, (_, i) => {
            const l = ls[i] ?? ls[ls.length - 1];
            return { w: '', r: '', done: false, lw: lighter ? target : (l?.w ?? 0), lr: l?.r ?? topReps(x.reps) };
          }),
        })),
      });
    },
    [last, setSession],
  );

  const finishWorkout = useCallback(
    async (names: Record<string, string>) => {
      const s = session;
      if (!s || !userId) return null;
      const minutes = Math.max(1, Math.round((Date.now() - s.start) / 60000));
      let volume = 0;
      let setsDone = 0;
      let ups = 0;
      let downs = 0;
      const prs: WorkoutLog['prs'] = [];
      const exercises: LoggedEx[] = [];
      for (const x of s.ex) {
        const d = x.sets.filter((y) => y.done).map((y) => ({ w: +y.w || 0, r: +y.r || 0 }));
        if (!d.length) continue;
        setsDone += d.length;
        d.forEach((y) => (volume += y.w * y.r));
        const top = Math.max(...d.map((y) => y.w));
        const prev = best[x.id] ?? 0;
        if (top > prev && prev > 0) prs.push({ id: x.id, n: names[x.id] ?? x.id, w: top });
        const v = d.reduce((a, y) => a + y.w * y.r + y.r * 0.01, 0);
        const done = x.sets.filter((y) => y.done);
        const lv = done.reduce((a, y) => a + y.lw * y.lr + y.lr * 0.01, 0);
        if (last[x.id]) {
          if (v > lv + 0.001) ups++;
          else if (v < lv - 0.001) downs++;
        }
        exercises.push({ id: x.id, n: names[x.id] ?? x.id, sets: d });
      }
      const row = {
        day: today,
        name: s.home ? 'Home' : s.name.slice(0, 40),
        started_at: new Date(s.start).toISOString(),
        minutes: Math.min(600, minutes),
        volume: Math.round(volume * 10) / 10,
        sets_done: setsDone,
        kcal: workoutKcal(minutes, Number(profile?.weight_kg ?? 80)),
        exercises,
        prs,
        ups,
        downs,
      };
      const { data, error } = await supabase.from('workout_logs').insert(row).select('*').single();
      if (error || !data) return null;
      const log = { ...(data as WorkoutLog), volume: +data.volume };
      setLogs((xs) => [log, ...xs]);
      setSession(null);
      // Friends see it in Gym Bros, if you share workouts.
      if (userId) shareWorkout(userId, { name: log.name, minutes: log.minutes, volume: log.volume, prs: log.prs ?? [] }).catch(() => {});
      return log;
    },
    [session, userId, today, best, last, profile?.weight_kg, setSession],
  );

  const value = useMemo<Train>(
    () => ({ ready, setupDone, plan, savePlan, updatePlan, today, todayIdx, week, setWeek, doneIdx, todayName, todayLog, logs, last, best, session, startWorkout, setSession, finishWorkout, streak }),
    [ready, setupDone, plan, savePlan, updatePlan, today, todayIdx, week, setWeek, doneIdx, todayName, todayLog, logs, last, best, session, startWorkout, setSession, finishWorkout, streak],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useTrain() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useTrain must be used inside TrainProvider');
  return v;
}
