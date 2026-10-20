import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, type PropsWithChildren, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { useAuth } from './auth';
import { peekCycle, pregnancySafe, setPregAdjust } from './cycle';
import { myCoach, myCoachPlans } from './coaching';
import { pullHealth, pushHealth, useDevices, workoutHeart } from './devices';
import type { DayTotals } from './health';
import { addDays, localDay } from './nutrition';
import { shareWorkout } from './social';
import { selectAll, supabase } from './supabase';
import { syncWorkoutActivity } from './widgetSync';
import { buildWorkout, type Day, effectiveWeek, EX, isLightLog, type LastSets, lowReps, nextWeight, orderWeek, type PlanEx, planFromProgram, plannedOn, rangePlan, setWeekMoves, topReps, type TrainPlan, weekdayOf, weekStart, workoutKcal, heartKcal } from './training';

/** `light`: done as a lighter day or deload, so its weights don't set next time's numbers. */
export type LoggedEx = { id: string; n: string; light?: boolean; sets: { w: number; r: number }[] };
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
  /** Heart rate the watch measured during it (average and highest). */
  avg_hr?: number | null;
  max_hr?: number | null;
};

/** One set in the workout. Warm-up sets (warm) don't count toward volume, records or next time's numbers. */
export type SessionSet = { w: string; r: string; done: boolean; lw: number; lr: number; warm?: boolean };
export type SessionEx = Omit<PlanEx, 'sets'> & { tip: boolean; sets: SessionSet[] };
/** The workout in progress. Saved on the device so a reload doesn't lose it.
 * `day` is the day it counts for: the day you pressed Start (or the earlier day you picked), even if you finish after midnight. */
export type Session = { name: string; start: number; home: boolean; ex: SessionEx[]; day?: string; light?: boolean };

/** A workout left open: it counts for an earlier day and was started more than 12 hours ago.
 * Finish it (it still counts for its day) or throw it away with discardSession. */
export function isStale(s: Session | null, today = localDay(), now = Date.now()) {
  if (!s) return false;
  return (s.day ?? localDay(new Date(s.start))) !== today && now - s.start > 12 * 3600_000;
}

/** Your whole history, kept small: every workout's day, start and records, food and water per day,
 * check-in days and best weight on each exercise. Badges and best streaks use it. */
export type History = { workouts: Pick<WorkoutLog, 'day' | 'started_at' | 'prs'>[]; days: Record<string, DayTotals>; checkins: string[]; best: Record<string, number> };

type Train = {
  ready: boolean;
  /** The plan couldn't be loaded; `reload` tries again. */
  loadError: boolean;
  reload: () => void;
  setupDone: boolean;
  plan: TrainPlan | null;
  savePlan: (p: TrainPlan, setupDone?: boolean) => Promise<boolean>;
  /** Change the newest plan (for changes worked out over time, like the weekly AI check) and save it. */
  changePlan: (fn: (p: TrainPlan) => TrainPlan) => Promise<boolean>;
  updatePlan: (patch: Partial<TrainPlan>) => void;
  today: string;
  todayIdx: number;
  /** This week, Sunday to Saturday, with moves for this week only. */
  week: Day[];
  setWeek: (week: Day[], thisWeekOnly: boolean) => void;
  /** Change the weekly plan for good. If this week has its own moves, they get the same change and stay. */
  editWeek: (edit: (week: Day[], shown: boolean) => Day[], opts?: { layout?: boolean }) => void;
  /** Weekdays (0 = Sunday) this week with a finished workout. */
  doneIdx: Set<number>;
  todayName: string | null;
  todayLog: WorkoutLog | null;
  logs: WorkoutLog[];
  last: LastSets;
  /** Best weight ever on each exercise. */
  best: Record<string, number>;
  /** Heaviest weight in your last few normal (not lighter or deload) sessions on each exercise. */
  top: Record<string, number>;
  session: Session | null;
  /** True when the open workout was left from an earlier day (see isStale). */
  stale: boolean;
  /** Throw away the open workout without saving it. */
  discardSession: () => void;
  startWorkout: (name: string, home: boolean, short: boolean, opts?: { light?: boolean; deload?: boolean; ex?: PlanEx[]; day?: string }) => void;
  setSession: (s: Session | null) => void;
  finishWorkout: (names: Record<string, string>) => Promise<WorkoutLog | null>;
  /** Workouts finished in a row without missing a planned one. */
  streak: number;
  /** Longest run of workouts in a row in your whole history. */
  bestStreak: number;
  /** Your whole history (null until it loads). */
  history: History | null;
  /** Your coach's program is your plan: their name and your message thread. */
  coach: { name: string; link: string } | null;
  /** Recovery you logged today (stretching, nap…). */
  recTools: string[];
  /** Women only: pregnancy-safe workouts are on (safer exercises, lighter weights, no weight jumps). */
  preg: boolean;
  setPreg: (on: boolean) => Promise<boolean>;
  setRecTools: (tools: string[]) => void;
  /** Save a finished workout made elsewhere (group workouts). */
  addLog: (row: Omit<WorkoutLog, 'id'>) => Promise<WorkoutLog | null>;
};

const Ctx = createContext<Train | null>(null);
const SESSION_KEY = 'adro.session.v1';
/** Your plan, kept on this phone for when there's no connection. */
const PLAN_KEY = (uid: string) => `adro.trainplan.v1.${uid}`;
/** A plan change not saved to your account yet (no connection): sent when it can be, even after the app restarts. */
const PENDING_KEY = (uid: string) => `adro.trainplan.pending.v1.${uid}`;

export function TrainProvider({ children }: PropsWithChildren) {
  const { session: auth, profile } = useAuth();
  const userId = auth?.user.id;
  const female = profile?.gender === 'female';
  // Pregnancy-safe workouts: a setting kept with the cycle settings (the pregnancy page and the Train page change it).
  const [pregFor, setPregFor] = useState<{ uid: string; on: boolean } | null>(null);
  const preg = female && !!userId && pregFor?.uid === userId && pregFor.on;
  useEffect(() => {
    if (!userId || !female) return;
    let alive = true;
    const load = () =>
      peekCycle(userId)
        .then((c) => alive && setPregFor({ uid: userId, on: pregnancySafe(c.settings) }))
        .catch(() => {});
    load();
    // Changed on the pregnancy page: picked up when you come back to the app.
    const sub = AppState.addEventListener('change', (st) => st === 'active' && load());
    return () => {
      alive = false;
      sub.remove();
    };
  }, [userId, female]);
  const setPreg = useCallback(
    async (on: boolean) => {
      if (!userId) return false;
      setPregFor({ uid: userId, on });
      const ok = await setPregAdjust(userId, on);
      if (!ok) setPregFor({ uid: userId, on: !on });
      return ok;
    },
    [userId],
  );
  const [today, setToday] = useState(localDay());
  const [readyFor, setReadyFor] = useState<string | null>(null);
  // The plan couldn't load (no connection) and isn't on this phone: the Train tab shows a retry, never setup.
  const [loadError, setLoadError] = useState(false);
  const [loadTry, setLoadTry] = useState(0);
  const ready = !!userId && readyFor === userId;
  const [setupDone, setSetupDone] = useState(false);
  const [plan, setPlan] = useState<TrainPlan | null>(null);
  const [logs, setLogs] = useState<WorkoutLog[]>([]);
  const [session, setSessionState] = useState<Session | null>(null);
  const [coach, setCoach] = useState<{ name: string; link: string } | null>(null);
  const [rec, setRec] = useState<{ day: string; tools: string[] }>({ day: '', tools: [] });
  const [hist, setHist] = useState<(History & { uid: string }) | null>(null);
  const history = hist && hist.uid === userId ? hist : null;
  const planRef = useRef(plan);
  useEffect(() => {
    planRef.current = plan;
  }, [plan]);
  const saveTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  // One save queue for the plan: the newest plan goes out, one save at a time. If it fails (no connection) it's
  // kept on the phone and tried again every 15 seconds, when the app comes back, and after a restart.
  const pending = useRef<{ plan: TrainPlan; done?: boolean } | null>(null);
  const flushing = useRef<Promise<boolean> | null>(null);
  const retryTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const flushRef = useRef<() => Promise<boolean>>(async () => false);
  // Another account on this phone: its unsaved change isn't this one's.
  useEffect(() => {
    pending.current = null;
  }, [userId]);
  const flush = useCallback(async (): Promise<boolean> => {
    if (!userId) return false;
    if (flushing.current) return flushing.current;
    const run = (async () => {
      while (pending.current) {
        const job = pending.current;
        const { error } = await supabase.from('train_plans').upsert({ user_id: userId, plan: job.plan, ...(job.done !== undefined ? { setup_done: job.done } : {}) });
        if (error) {
          clearTimeout(retryTimer.current);
          retryTimer.current = setTimeout(() => void flushRef.current(), 15_000);
          return false;
        }
        // A newer change made while this one was saving goes out next.
        if (pending.current === job) {
          pending.current = null;
          await AsyncStorage.removeItem(PENDING_KEY(userId)).catch(() => {});
        }
      }
      return true;
    })();
    flushing.current = run;
    try {
      return await run;
    } finally {
      flushing.current = null;
    }
  }, [userId]);
  useEffect(() => {
    flushRef.current = flush;
  }, [flush]);
  const queueSave = useCallback(
    (plan: TrainPlan, done?: boolean) => {
      if (!userId) return Promise.resolve(false);
      pending.current = { plan, done: done ?? pending.current?.done };
      AsyncStorage.setItem(PENDING_KEY(userId), JSON.stringify(pending.current)).catch(() => {});
      return flush();
    },
    [userId, flush],
  );
  useEffect(() => {
    const sub = AppState.addEventListener('change', (st) => {
      if (st === 'active' && pending.current) void flushRef.current();
    });
    return () => {
      sub.remove();
      clearTimeout(retryTimer.current);
    };
  }, []);

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
      const [p, l, s, r] = await Promise.all([
        supabase.from('train_plans').select('*').eq('user_id', userId).maybeSingle(),
        supabase.from('workout_logs').select('*').gte('day', addDays(localDay(), -120)).order('started_at', { ascending: false }).limit(150),
        AsyncStorage.getItem(`${SESSION_KEY}.${userId}`).catch(() => null),
        supabase.from('recovery_logs').select('day,tools').eq('day', localDay()).maybeSingle(),
      ]);
      if (!alive) return;
      let row = p.data as { plan?: TrainPlan; setup_done?: boolean } | null;
      if (p.error) {
        const kept = await AsyncStorage.getItem(PLAN_KEY(userId)).catch(() => null);
        if (!alive) return;
        if (!kept) {
          setLoadError(true);
          return setReadyFor(userId);
        }
        row = JSON.parse(kept);
      }
      setLoadError(false);
      // A change that didn't reach your account last time (no connection) wins, and is sent now.
      const unsent = await AsyncStorage.getItem(PENDING_KEY(userId)).catch(() => null);
      if (!alive) return;
      if (unsent) {
        try {
          const u = JSON.parse(unsent) as { plan: TrainPlan; done?: boolean };
          if (u?.plan?.week) {
            row = { plan: u.plan, setup_done: u.done ?? row?.setup_done };
            pending.current = u;
            setTimeout(() => void flushRef.current(), 0);
          }
        } catch {}
      }
      const raw = row?.plan as TrainPlan | undefined;
      // "In order" plans were removed: every plan now uses fixed days.
      const loaded = raw?.week ? { ...rangePlan(raw), type: 'fixed' as const, skipped: raw.skipped ?? {}, dismiss: raw.dismiss ?? {}, machines: raw.machines ?? {} } : null;
      planRef.current = loaded;
      setPlan(loaded);
      setSetupDone(!!row?.setup_done && !!raw?.week);
      setRec({ day: localDay(), tools: (r.data?.tools as string[] | undefined) ?? [] });
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
  }, [userId, loadTry]);

  // No workout running (finished, thrown away, or none): take it off the Lock Screen and the Dynamic Island.
  useEffect(() => {
    if (readyFor && !session) syncWorkoutActivity(null);
  }, [readyFor, session]);

  // Keep the newest plan on this phone too.
  useEffect(() => {
    if (userId && plan && readyFor === userId) AsyncStorage.setItem(PLAN_KEY(userId), JSON.stringify({ plan, setup_done: setupDone })).catch(() => {});
  }, [userId, plan, setupDone, readyFor]);

  // Your whole history, a few small rows. Loads after the screen is ready; until then the last 120 days are used.
  useEffect(() => {
    if (!userId) return;
    let alive = true;
    (async () => {
      const [w, f, c, b] = await Promise.all([
        selectAll((a, z) => supabase.from('workout_logs').select('day,started_at,prs').order('day', { ascending: false }).order('started_at', { ascending: false }).range(a, z)),
        selectAll((a, z) => supabase.rpc('my_day_totals').range(a, z)),
        selectAll((a, z) => supabase.from('checkins').select('day').order('day').range(a, z)),
        supabase.rpc('my_best_lifts'),
      ]);
      if (!alive || w.error) return;
      const days: Record<string, DayTotals> = {};
      for (const r of (f.data as { day: string; kcal: number; protein: number; ml: number }[] | null) ?? []) days[r.day] = { k: Number(r.kcal), p: Number(r.protein), w: Number(r.ml) };
      const best: Record<string, number> = {};
      for (const r of (b.data as { id: string; w: number }[] | null) ?? []) if (r.id) best[r.id] = Number(r.w) || 0;
      setHist({
        uid: userId,
        workouts: (w.data as History['workouts']) ?? [],
        days,
        checkins: ((c.data as { day: string }[] | null) ?? []).map((x) => x.day),
        best,
      });
    })().catch(() => {});
    return () => {
      alive = false;
    };
  }, [userId, loadTry]);

  // Your coach's program is your plan. It updates when the coach changes it.
  const syncCoach = useCallback(async () => {
    if (!userId) return;
    const [plans, link] = await Promise.all([myCoachPlans(), myCoach()]);
    if (!plans) return;
    const prog = plans.program;
    const cur = planRef.current;
    if (!prog || !prog.days?.some((d) => d.ex.length)) {
      setCoach(null);
      // The coach took the program back: keep it as your own plan.
      if (cur?.coach) {
        const next = { ...cur, coach: undefined };
        planRef.current = next;
        setPlan(next);
        queueSave(next);
      }
      return;
    }
    setCoach(link && link.status === 'active' ? { name: link.name || link.username, link: link.id } : { name: '', link: '' });
    if (cur?.coach?.id === prog.id && cur.coach.updated_at === prog.updated_at) return;
    const today = localDay();
    const base = rangePlan(planFromProgram(prog));
    const next: TrainPlan = {
      ...base,
      since: cur?.coach?.id === prog.id ? (cur.since ?? today) : today,
      skipped: cur?.skipped ?? {},
      dismiss: cur?.dismiss ?? {},
      machines: cur?.machines ?? {},
      checkin: cur?.checkin,
      light: cur?.light,
      deload: cur?.deload,
      deloadDismissed: cur?.deloadDismissed,
      level: cur?.level,
      // Your injuries and home mode are yours, not the program's (injured exercises keep being swapped).
      injuries: cur?.injuries ?? [],
      homeMode: cur?.homeMode ?? false,
      coach: { id: prog.id, updated_at: prog.updated_at },
    };
    clearTimeout(saveTimer.current);
    planRef.current = next;
    setPlan(next);
    setSetupDone(true);
    await queueSave(next, true);
  }, [userId, queueSave]);

  useEffect(() => {
    if (!ready) return;
    const run = () => {
      syncCoach().catch(() => {});
    };
    const first = setTimeout(run, 0);
    const sub = AppState.addEventListener('change', (st) => st === 'active' && run());
    return () => {
      clearTimeout(first);
      sub.remove();
    };
  }, [ready, syncCoach]);

  const setRecTools = useCallback(
    (tools: string[]) => {
      if (!userId) return;
      setRec({ day: today, tools });
      supabase.from('recovery_logs').upsert({ user_id: userId, day: today, tools, updated_at: new Date().toISOString() }).then(() => {});
    },
    [userId, today],
  );
  const recTools = useMemo(() => (rec.day === today ? rec.tools : []), [rec, today]);

  const savePlan = useCallback(
    async (plan: TrainPlan, done?: boolean) => {
      if (!userId) return false;
      // A small change waiting to be saved would write an older plan over this one.
      clearTimeout(saveTimer.current);
      // Reps are always a range ("8–10"), whoever made the plan.
      const p = rangePlan(plan);
      setPlan(p);
      planRef.current = p;
      if (done !== undefined) setSetupDone(done);
      return queueSave(p, done);
    },
    [userId, queueSave],
  );

  const changePlan = useCallback(async (fn: (p: TrainPlan) => TrainPlan) => (planRef.current ? savePlan(fn(planRef.current)) : false), [savePlan]);

  const updatePlan = useCallback(
    (patch: Partial<TrainPlan>) => {
      if (!planRef.current) return;
      const next = patch.workouts ? rangePlan({ ...planRef.current, ...patch }) : { ...planRef.current, ...patch };
      planRef.current = next;
      setPlan(next);
      clearTimeout(saveTimer.current);
      // Saved a moment later (changes in a row go out once), always the newest plan.
      saveTimer.current = setTimeout(() => {
        if (planRef.current) queueSave(planRef.current);
      }, 500);
    },
    [queueSave],
  );

  const start = weekStart(today);
  const todayIdx = weekdayOf(today);
  const week = useMemo(() => (plan ? (plan.type === 'order' ? orderWeek(plan, logs, today, start) : effectiveWeek(plan, start)) : []), [plan, start, logs, today]);

  const setWeek = useCallback(
    (w: Day[], thisWeekOnly: boolean) => {
      if (!planRef.current) return;
      if (thisWeekOnly) updatePlan(setWeekMoves(planRef.current, start, w));
      else updatePlan({ week: w, override: undefined });
    },
    [start, updatePlan],
  );

  // A lasting change goes on the plan's own week; this week's moves (if any) get the same change, so they stay for this week only.
  // Moving workouts to other days (layout) means earlier days can't be judged as missed any more.
  const editWeek = useCallback(
    (edit: (w: Day[], shown: boolean) => Day[], opts?: { layout?: boolean }) => {
      const p = planRef.current;
      if (!p) return;
      // `shown`: this is the week you see (this week's own moves); otherwise it's the plan's usual week.
      const has = p.override?.start === start;
      const ov = has ? { ...p.override!, week: edit(p.override!.week, true) } : p.override;
      updatePlan({ week: edit(p.week, !has), override: ov, ...(opts?.layout === false ? {} : { weekSince: today }) });
    },
    [start, today, updatePlan],
  );

  const doneIdx = useMemo(() => new Set(logs.filter((l) => l.day >= start && l.day <= addDays(start, 6)).map((l) => weekdayOf(l.day))), [logs, start]);
  const todayLog = logs.find((l) => l.day === today) ?? null;
  const todayName = week[todayIdx]?.w ?? null;

  // Last time's sets, best weight ever, and the heaviest weight in the last 3 normal sessions for each exercise.
  // Lighter and deload sessions are left out of last time and the last 3, so a lighter week never cuts twice.
  const light = plan?.light;
  const deload = plan?.deload;
  const lifetimeBest = history?.best;
  const { last, best, top } = useMemo(() => {
    const last: LastSets = {};
    const best: Record<string, number> = { ...lifetimeBest };
    const top: Record<string, number> = {};
    const seen: Record<string, number> = {};
    for (const l of logs) {
      const reduced = isLightLog(l, { light, deload });
      for (const x of l.exercises ?? []) {
        const w = Math.max(0, ...x.sets.map((s) => s.w));
        best[x.id] = Math.max(best[x.id] ?? 0, w);
        if (reduced || !x.sets.length) continue;
        if (!last[x.id]) last[x.id] = x.sets;
        if ((seen[x.id] = (seen[x.id] ?? 0) + 1) <= 3) top[x.id] = Math.max(top[x.id] ?? 0, w);
      }
    }
    return { last, best, top };
  }, [logs, light, deload, lifetimeBest]);

  // Workouts in a row: a planned workout missed (not done, not skipped or dismissed) ends the run.
  // Each day is judged by that week's plan, with moves for that week only. Plans in order (no fixed days) end it after 3 days in a row without training.
  const lifeWorkouts = history?.workouts;
  const { streak, bestStreak } = useMemo(() => {
    if (!plan) return { streak: 0, bestStreak: 0 };
    const days = new Set([...logs.map((l) => l.day), ...(lifeWorkouts ?? []).map((l) => l.day)]);
    const first = [...days].sort()[0] ?? today;
    const span = Math.min(3650, Math.max(0, Math.round((new Date(`${today}T12:00:00`).getTime() - new Date(`${first}T12:00:00`).getTime()) / 864e5)));
    let run = 0;
    let best = 0;
    let gap = 0;
    for (let i = span; i >= 0; i--) {
      const d = addDays(today, -i);
      if (days.has(d)) {
        run++;
        gap = 0;
        best = Math.max(best, run);
      } else if (i > 0) {
        gap++;
        const missed = plan.type === 'order' ? gap >= 3 : plannedOn(plan, d);
        if (missed) run = 0;
      }
    }
    return { streak: run, bestStreak: best };
  }, [logs, lifeWorkouts, plan, today]);

  const setSession = useCallback(
    (s: Session | null) => {
      setSessionState(s);
      if (!userId) return;
      if (s) AsyncStorage.setItem(`${SESSION_KEY}.${userId}`, JSON.stringify(s)).catch(() => {});
      else AsyncStorage.removeItem(`${SESSION_KEY}.${userId}`).catch(() => {});
    },
    [userId],
  );
  const discardSession = useCallback(() => setSession(null), [setSession]);
  const stale = isStale(session, today);

  const startWorkout = useCallback(
    (name: string, home: boolean, short: boolean, opts?: { light?: boolean; deload?: boolean; ex?: PlanEx[]; day?: string }) => {
      const p = planRef.current;
      if (!p) return;
      // A one-off list (Train together) uses the same building rules as a planned workout.
      const src = opts?.ex ? { ...p, workouts: { ...p.workouts, [name]: { ex: opts.ex, focus: '', min: 0 } } } : p;
      const wo = buildWorkout(src, name, { home, short, light: opts?.light, deload: opts?.deload, preg, last, top });
      // Pregnant counts as a lighter session: lighter weights, and it doesn't lower next time's numbers.
      const lighter = !!(opts?.light || opts?.deload || preg);
      setSession({
        name,
        start: Date.now(),
        day: opts?.day ?? localDay(),
        home,
        ...(lighter ? { light: true } : {}),
        ex: wo.ex.map(({ swapped: _s, target, last: ls, sets, ...x }) => {
          // Every rep done last time: start a step heavier (not on a lighter day, bodyweight or timed exercises).
          const weighted = !x.time && !EX[x.id]?.time && (x.t ?? EX[x.id]?.t) !== 'Bodyweight';
          const up = !lighter && weighted ? nextWeight(ls, x.reps) : null;
          return {
            ...x,
            tip: false,
            sets: Array.from({ length: sets }, (_, i) => {
              const l = ls[i] ?? ls[ls.length - 1];
              if (up) return { w: '', r: '', done: false, lw: up, lr: lowReps(x.reps) };
              return { w: '', r: '', done: false, lw: lighter ? target : (l?.w ?? 0), lr: l?.r ?? topReps(x.reps) };
            }),
          };
        }),
      });
    },
    [last, top, preg, setSession],
  );

  // A new log goes into the recent list and the whole history.
  const keep = useCallback((log: WorkoutLog) => {
    setLogs((xs) => [log, ...xs]);
    setHist((h) => h && { ...h, workouts: [{ day: log.day, started_at: log.started_at, prs: log.prs }, ...h.workouts] });
  }, []);

  const addLog = useCallback(
    async (row: Omit<WorkoutLog, 'id'>) => {
      const { data, error } = await supabase.from('workout_logs').insert(row).select('*').single();
      if (error || !data) return null;
      const log = { ...(data as WorkoutLog), volume: +data.volume };
      keep(log);
      return log;
    },
    [keep],
  );

  // A workout being saved: a second tap on Finish waits for the same save instead of saving the workout twice.
  const finishing = useRef<Promise<WorkoutLog | null> | null>(null);
  const saveWorkout = useCallback(
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
      // Records compare with your best ever. If your whole history hasn't loaded yet, fetch the bests now.
      let known = best;
      if (!history) {
        const { data: b } = await supabase.rpc('my_best_lifts');
        if (Array.isArray(b)) {
          known = { ...best };
          for (const r of b as { id: string; w: number }[]) if (r.id) known[r.id] = Math.max(known[r.id] ?? 0, Number(r.w) || 0);
        }
      }
      for (const x of s.ex) {
        const d = x.sets.filter((y) => y.done && !y.warm).map((y) => ({ w: +y.w || 0, r: +y.r || 0 }));
        if (!d.length) continue;
        setsDone += d.length;
        d.forEach((y) => (volume += y.w * y.r));
        const top = Math.max(...d.map((y) => y.w));
        const prev = known[x.id] ?? 0;
        if (top > prev && prev > 0) prs.push({ id: x.id, n: names[x.id] ?? x.id, w: top });
        const v = d.reduce((a, y) => a + y.w * y.r + y.r * 0.01, 0);
        const done = x.sets.filter((y) => y.done && !y.warm);
        const lv = done.reduce((a, y) => a + y.lw * y.lr + y.lr * 0.01, 0);
        if (last[x.id]) {
          if (v > lv + 0.001) ups++;
          else if (v < lv - 0.001) downs++;
        }
        exercises.push({ id: x.id, n: names[x.id] ?? x.id, ...(s.light ? { light: true } : {}), sets: d });
      }
      // Calories use realistic minutes: never more than 3 hours, or about 6 minutes a set when the workout was left open.
      const logged = Math.min(600, minutes);
      const kcalMin = Math.min(logged, 180, Math.max(30, setsDone * 6));
      const row = {
        day: s.day ?? localDay(new Date(s.start)),
        name: s.home ? 'Home' : s.name.slice(0, 40),
        started_at: new Date(s.start).toISOString(),
        minutes: logged,
        volume: Math.round(volume * 10) / 10,
        sets_done: setsDone,
        kcal: workoutKcal(kcalMin, Number(profile?.weight_kg ?? 80)),
        exercises,
        prs,
        ups,
        downs,
      };
      const { data, error } = await supabase.from('workout_logs').insert(row).select('*').single();
      if (error || !data) return null;
      const log = { ...(data as WorkoutLog), volume: +data.volume };
      keep(log);
      setSession(null);
      // A copy for the phone's health app (when that's on), so the workout closes your rings there.
      pushHealth({ type: 'workout', id: log.id, start: new Date(log.started_at), end: new Date(new Date(log.started_at).getTime() + log.minutes * 6e4), kind: 'Strength', kcal: log.kcal });
      // Friends see it in Gym Bros, if you share workouts.
      if (userId) shareWorkout(userId, { name: log.name, minutes: log.minutes, volume: log.volume, prs: log.prs ?? [] }).catch(() => {});
      return log;
    },
    [session, userId, best, history, last, profile?.weight_kg, setSession, keep],
  );
  // Heart rate from the watch for workouts of the last 2 days that don't have it yet (watches send it a little late,
  // so this runs again whenever the list or the watch data changes). Calories then come from the heart rate.
  const dev = useDevices(userId);
  const hrTried = useRef(new Set<string>());
  useEffect(() => {
    if (!dev.connected || !logs.length) return;
    const age = profile?.date_of_birth ? Math.max(14, Math.floor((Date.now() - new Date(profile.date_of_birth).getTime()) / 3.15576e10)) : 30;
    const kg = Number(profile?.weight_kg ?? 80);
    const todo = logs.filter((l) => l.avg_hr == null && l.day >= addDays(localDay(), -1) && !hrTried.current.has(`${l.id}:${dev.prefs.last_sync}`));
    todo.forEach(async (l) => {
      hrTried.current.add(`${l.id}:${dev.prefs.last_sync}`);
      const start = new Date(l.started_at);
      const mins = Math.min(l.minutes, 180);
      const hr = await workoutHeart(start, new Date(start.getTime() + mins * 6e4)).catch(() => null);
      if (!hr) return;
      const kcal = heartKcal({ avgHr: hr.avg, minutes: mins, weightKg: kg, age, female, guess: l.kcal });
      const { error } = await supabase.from('workout_logs').update({ avg_hr: hr.avg, max_hr: hr.max, kcal }).eq('id', l.id);
      if (error) return;
      setLogs((xs) => xs.map((x) => (x.id === l.id ? { ...x, avg_hr: hr.avg, max_hr: hr.max, kcal } : x)));
      if (kcal !== l.kcal) {
        pullHealth('workout', l.id);
        pushHealth({ type: 'workout', id: l.id, start, end: new Date(start.getTime() + l.minutes * 6e4), kind: 'Strength', kcal });
      }
    });
  }, [dev.connected, dev.prefs.last_sync, logs, profile?.date_of_birth, profile?.weight_kg, female]);

  const finishWorkout = useCallback(
    (names: Record<string, string>) => {
      if (!finishing.current) finishing.current = saveWorkout(names).finally(() => (finishing.current = null));
      return finishing.current;
    },
    [saveWorkout],
  );

  const value = useMemo<Train>(
    () => ({ ready, loadError, reload: () => setLoadTry((n) => n + 1), setupDone, plan, savePlan, changePlan, updatePlan, today, todayIdx, week, setWeek, editWeek, doneIdx, todayName, todayLog, logs, last, best, top, session, stale, discardSession, startWorkout, setSession, finishWorkout, streak, bestStreak, history, coach, recTools, setRecTools, addLog, preg, setPreg }),
    [ready, loadError, setupDone, plan, savePlan, changePlan, updatePlan, today, todayIdx, week, setWeek, editWeek, doneIdx, todayName, todayLog, logs, last, best, top, session, stale, discardSession, startWorkout, setSession, finishWorkout, streak, bestStreak, history, coach, recTools, setRecTools, addLog, preg, setPreg],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useTrain() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useTrain must be used inside TrainProvider');
  return v;
}
