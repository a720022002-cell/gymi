import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, type PropsWithChildren, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { useAuth } from './auth';
import { peekCycle, pregnancySafe, setPregAdjust } from './cycle';
import { myCoach, myCoachPlans, type Program } from './coaching';
import { pullHealth, pushHealth, useDevices, workoutHeart } from './devices';
import type { DayTotals } from './health';
import { addDays, localDay } from './nutrition';
import { shareWorkout } from './social';
import { stallUp } from './setCoach';
import { selectAll, supabase } from './supabase';
import { LB } from './units';
import { syncWorkoutActivity } from './widgetSync';
import { emitLogChange, logTotals, recomputePrs } from './workoutHistory';
import { useSettings } from '@/theme/settings';
import { buildWorkout, type Day, effectiveWeek, EX, exInfo, isLightLog, type LastSets, lowReps, nextWeight, orderWeek, type PlanEx, coachVersion, planWithProgram, rangePlan, setWeekMoves, STEP_KG, topReps, type TrainPlan, weekdayOf, weekStart, workoutKcal, workoutStreak, heartKcal } from './training';

/** `light`: done as a lighter day or deload, so its weights don't set next time's numbers. `ar`: its Arabic name
 * (newer logs), for exercises from the full list. `m`: its muscle group (newer logs), so database and your own exercises
 * count toward muscle recovery. `time`: a timed hold (reps are seconds). `preg`: done with pregnancy-safe workouts on. */
export type LoggedEx = { id: string; n: string; ar?: string; light?: boolean; m?: string; time?: boolean; preg?: boolean; sets: { w: number; r: number }[] };
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

/** One set in the workout. Warm-up sets (warm) don't count toward volume, records or next time's numbers.
 * `lw`, `lr`: today's target. `pw`, `pr`: what you did last time (newer workouts; none without history). */
export type SessionSet = { w: string; r: string; done: boolean; lw: number; lr: number; pw?: number; pr?: number; warm?: boolean };
export type SessionEx = Omit<PlanEx, 'sets'> & { tip: boolean; sets: SessionSet[] };
/** The workout in progress. Saved on the device so a reload doesn't lose it.
 * `day` is the day it counts for: the day you pressed Start (or the earlier day you picked), even if you finish after midnight. */
export type Session = { name: string; start: number; home: boolean; ex: SessionEx[]; day?: string; light?: boolean; preg?: boolean; lastAt?: number };
/** The rest between sets: when it ends and how long it was (seconds). */
export type Rest = { end: number; total: number };

/** Last time's numbers for a working set (k: its place among the working sets). Workouts started before `pw` was
 * kept fall back to `last` (last time's sets). Null when there's no history. */
export function lastTime(st: SessionSet, k: number, last?: { w: number; r: number }[] | null): { w: number; r: number } | null {
  if (st.pw != null) return { w: st.pw, r: st.pr ?? 0 };
  return last?.length ? (last[k] ?? last[last.length - 1]) : null;
}

/** Today's working sets against last time's: 'up', 'down', 'same', or null with nothing done or no history. */
export function vsLastTime(x: SessionEx, last?: { w: number; r: number }[] | null): 'up' | 'down' | 'same' | null {
  const work = x.sets.filter((s) => !s.warm);
  const pairs = work.map((s, k) => ({ s, p: lastTime(s, k, last) })).filter((y) => y.s.done);
  if (!pairs.length || !pairs.some((y) => y.p)) return null;
  const v = pairs.reduce((a, { s }) => a + (+s.w || 0) * (+s.r || 0) + (+s.r || 0) * 0.01, 0);
  const l = pairs.reduce((a, { p }) => a + (p ? p.w * p.r + p.r * 0.01 : 0), 0);
  if (Math.abs(v - l) < 0.001) return 'same';
  return v > l ? 'up' : 'down';
}

/** A workout left open: it counts for an earlier day and was started more than 12 hours ago.
 * Finish it (it still counts for its day) or throw it away with discardSession. */
export function isStale(s: Session | null, today = localDay(), now = Date.now()) {
  if (!s) return false;
  return (s.day ?? localDay(new Date(s.start))) !== today && now - s.start > 12 * 3600_000;
}

/** Your whole history, kept small: every workout's day, start and records, food and water per day,
 * check-in days and best weight on each exercise. Badges and best streaks use it. */
export type History = { workouts: Pick<WorkoutLog, 'day' | 'started_at' | 'prs'>[]; days: Record<string, DayTotals>; checkins: string[]; best: Record<string, number> };

/** A program (or a new version of it) from your coach, waiting for your answer. `update`: your plan is already an
 * older version of the same program. */
export type CoachOffer = { prog: Program; key: string; who: { name: string; link: string }; coachName: string; update: boolean; days: number; workouts: string[]; exercises: number };

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
  /** The rest timer between sets (the workout screen and the Live Activity share it). */
  rest: Rest | null;
  setRest: (r: Rest | null) => void;
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
  /** A program from your coach you haven't answered yet (null once you use it or say "Not now"). */
  coachOffer: CoachOffer | null;
  /** Your coach's newest program, even after "Not now" (My program shows it). */
  coachProgram: CoachOffer | null;
  /** Use your coach's program (the one offered, or the one given) as your plan. */
  acceptCoach: (prog?: Program) => Promise<boolean>;
  /** "Not now": keep your plan and don't ask again about this version. */
  declineCoach: () => void;
  /** Recovery you logged today (stretching, nap…). */
  recTools: string[];
  /** Women only: pregnancy-safe workouts are on (safer exercises, lighter weights, no weight jumps). */
  preg: boolean;
  setPreg: (on: boolean) => Promise<boolean>;
  setRecTools: (tools: string[]) => void;
  /** Change a past workout's sets or exercises (sets with 0 reps and exercises left with none are dropped). Volume and
   * records are worked out again. Null when it couldn't be saved. */
  editLog: (log: WorkoutLog, exercises: LoggedEx[]) => Promise<WorkoutLog | null>;
  /** Delete a past workout for good. */
  deleteLog: (log: WorkoutLog) => Promise<boolean>;
  /** Save a finished workout made elsewhere (group workouts). With `group_session`, a second save of the same group
   * workout is refused and the saved one comes back (`dup`). */
  addLog: (row: Omit<WorkoutLog, 'id'> & { group_session?: string }) => Promise<{ log: WorkoutLog; dup?: boolean } | null>;
};

const Ctx = createContext<Train | null>(null);
const SESSION_KEY = 'adro.session.v1';
/** Your plan, kept on this phone for when there's no connection. */
const PLAN_KEY = (uid: string) => `adro.trainplan.v1.${uid}`;
/** A plan change not saved to your account yet (no connection): sent when it can be, even after the app restarts. */
const PENDING_KEY = (uid: string) => `adro.trainplan.pending.v1.${uid}`;
/** Workouts finished without a connection: kept on this phone and saved when the connection is back. */
const LOG_PENDING_KEY = (uid: string) => `adro.workoutlogs.pending.v1.${uid}`;
/** Coach program versions you said "Not now" to before you had a plan (kept on this phone). */
const COACH_NO_KEY = (uid: string) => `adro.coachno.v1.${uid}`;
type PendingLog = { local: string; row: Omit<WorkoutLog, 'id'> };
const readPendingLogs = async (uid: string): Promise<PendingLog[]> => {
  try {
    const x = JSON.parse((await AsyncStorage.getItem(LOG_PENDING_KEY(uid))) ?? '[]');
    return Array.isArray(x) ? x : [];
  } catch {
    return [];
  }
};
/** How long after the last set a workout ends (cool-down, putting weights away), and the longest one can be. */
const END_BUFFER_MS = 5 * 60_000;
const MAX_MINUTES = 240;

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
  const [rest, setRest] = useState<Rest | null>(null);
  // Plate jumps in your unit (2.5 kg or 5 lb), kept in kg.
  const { unit } = useSettings();
  const step = unit === 'lb' ? 5 / LB : STEP_KG;
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
  // The same for workouts finished offline (flushLogs, below).
  const flushLogsRef = useRef<() => Promise<void>>(async () => {});
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
      // Workouts finished offline show until they're saved.
      const queued = (await readPendingLogs(userId)).map((q) => ({ ...q.row, id: q.local }) as WorkoutLog);
      if (!alive) return;
      setLogs([...queued, ...((l.data as WorkoutLog[]) ?? []).map((x) => ({ ...x, volume: +x.volume }))]);
      if (queued.length) setTimeout(() => void flushLogsRef.current(), 0);
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

  // Your coach's program: you're asked first ("Use it" / "Not now"), for a new program and for each new version of it.
  // "Not now" is kept per version (on the plan, and on this phone when there's no plan yet), so the same one isn't
  // asked again; My program still has it.
  const [offer, setOffer] = useState<CoachOffer | null>(null);
  const [localNo, setLocalNo] = useState<{ uid: string; keys: string[] } | null>(null);
  useEffect(() => {
    if (!userId) return;
    let alive = true;
    AsyncStorage.getItem(COACH_NO_KEY(userId))
      .then((x) => {
        const keys = JSON.parse(x ?? '[]');
        if (alive) setLocalNo({ uid: userId, keys: Array.isArray(keys) ? keys : [] });
      })
      .catch(() => alive && setLocalNo({ uid: userId, keys: [] }));
    return () => {
      alive = false;
    };
  }, [userId]);
  const syncCoach = useCallback(async () => {
    if (!userId) return;
    const [plans, link] = await Promise.all([myCoachPlans(), myCoach()]);
    if (!plans) return;
    const prog = plans.program;
    const cur = planRef.current;
    if (!prog || !prog.days?.some((d) => d.ex.length)) {
      setCoach(null);
      setOffer(null);
      // The coach took the program back: keep it as your own plan.
      if (cur?.coach) {
        const next = { ...cur, coach: undefined };
        planRef.current = next;
        setPlan(next);
        queueSave(next);
      }
      return;
    }
    const who = link && link.status === 'active' ? { name: link.name || link.username, link: link.id } : { name: '', link: '' };
    // Your plan is your coach's program (an older version of it, or one they gave you before) until you change it.
    setCoach(cur?.coach ? who : null);
    if (cur?.coach?.id === prog.id && cur.coach.updated_at === prog.updated_at) return setOffer(null);
    const days = prog.days.filter((d) => d.ex.length);
    setOffer({
      prog,
      key: coachVersion(prog),
      who,
      coachName: who.name || plans.coach || '',
      update: cur?.coach?.id === prog.id,
      days: days.length,
      workouts: days.map((d) => d.name),
      exercises: days.reduce((n, d) => n + d.ex.length, 0),
    });
  }, [userId, queueSave]);

  /** Your coach's program becomes your plan; your injuries, skipped days, machines, level and home mode stay. */
  const acceptCoach = useCallback(
    async (prog?: Program) => {
      const o = offer;
      const p = prog ?? o?.prog;
      if (!p) return false;
      const next = planWithProgram(planRef.current, p, localDay());
      clearTimeout(saveTimer.current);
      planRef.current = next;
      setPlan(next);
      setSetupDone(true);
      setOffer(null);
      setCoach(o?.who ?? { name: '', link: '' });
      const ok = await queueSave(next, true);
      // Saved later when there's no connection: the plan is already yours on this phone.
      return ok || !!pending.current;
    },
    [offer, queueSave],
  );

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

  const declined = useMemo(() => new Set([...(plan?.coachNo ?? []), ...(localNo && localNo.uid === userId ? localNo.keys : [])]), [plan?.coachNo, localNo, userId]);
  const declineCoach = useCallback(() => {
    const o = offer;
    if (!o || !userId) return;
    const keys = [...(localNo && localNo.uid === userId ? localNo.keys : []).filter((k) => k !== o.key), o.key].slice(-10);
    setLocalNo({ uid: userId, keys });
    AsyncStorage.setItem(COACH_NO_KEY(userId), JSON.stringify(keys)).catch(() => {});
    const cur = planRef.current;
    if (cur) updatePlan({ coachNo: [...(cur.coachNo ?? []).filter((k) => k !== o.key), o.key].slice(-10) });
  }, [offer, userId, localNo, updatePlan]);
  // Asked once this phone's answers have loaded, so a "Not now" never shows the card again for a moment.
  const coachOffer = offer && localNo?.uid === userId && !declined.has(offer.key) ? offer : null;

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
  // Pregnancy-safe sessions set last time's numbers (pregLast) but not the normal top weight a cut is taken from.
  const { last, best, top, pregLast } = useMemo(() => {
    const last: LastSets = {};
    const best: Record<string, number> = { ...lifetimeBest };
    const top: Record<string, number> = {};
    const pregLast: Record<string, boolean> = {};
    const seen: Record<string, number> = {};
    for (const l of logs) {
      const reduced = isLightLog(l, { light, deload });
      for (const x of l.exercises ?? []) {
        const w = Math.max(0, ...x.sets.map((s) => s.w));
        best[x.id] = Math.max(best[x.id] ?? 0, w);
        if (reduced || !x.sets.length) continue;
        if (!last[x.id]) {
          last[x.id] = x.sets;
          if (x.preg) pregLast[x.id] = true;
        }
        if (x.preg) continue;
        if ((seen[x.id] = (seen[x.id] ?? 0) + 1) <= 3) top[x.id] = Math.max(top[x.id] ?? 0, w);
      }
    }
    return { last, best, top, pregLast };
  }, [logs, light, deload, lifetimeBest]);

  // Workouts in a row: one rule for every screen and the widgets (workoutStreak). Rest days, skipped days and moved
  // workouts never break it; a planned workout missed does. Each day is judged by that week's plan.
  const lifeWorkouts = history?.workouts;
  const { streak, best: bestStreak } = useMemo(
    () => workoutStreak(plan, new Set([...logs.map((l) => l.day), ...(lifeWorkouts ?? []).map((l) => l.day)]), today),
    [logs, lifeWorkouts, plan, today],
  );

  const setSession = useCallback(
    (s: Session | null) => {
      setSessionState(s);
      // No workout, no rest.
      if (!s) setRest(null);
      if (!userId) return;
      if (s) AsyncStorage.setItem(`${SESSION_KEY}.${userId}`, JSON.stringify(s)).catch(() => {});
      else AsyncStorage.removeItem(`${SESSION_KEY}.${userId}`).catch(() => {});
    },
    [userId],
  );
  const discardSession = useCallback(() => setSession(null), [setSession]);
  const stale = isStale(session, today);

  // Your last normal workouts with an exercise (newest first, working sets only), like the coach under it reads.
  const histFor = useCallback(
    (id: string) =>
      logs
        .filter((l) => !isLightLog(l, { light, deload }))
        .map((l) => (l.exercises ?? []).find((e) => e.id === id)?.sets ?? [])
        .filter((sets) => sets.length)
        .slice(0, 6),
    [logs, light, deload],
  );

  const startWorkout = useCallback(
    (name: string, home: boolean, short: boolean, opts?: { light?: boolean; deload?: boolean; ex?: PlanEx[]; day?: string }) => {
      const p = planRef.current;
      if (!p) return;
      // A one-off list (Train together) uses the same building rules as a planned workout.
      const src = opts?.ex ? { ...p, workouts: { ...p.workouts, [name]: { ex: opts.ex, focus: '', min: 0 } } } : p;
      const wo = buildWorkout(src, name, { home, short, light: opts?.light, deload: opts?.deload, preg, last, top });
      // Lighter day or deload: lighter weights, and it doesn't set next time's numbers.
      const lighter = !!(opts?.light || opts?.deload);
      // Pregnant: lighter weights and never a jump up, but it does set next time's numbers (kept from then on).
      const easy = lighter || preg;
      setSession({
        name,
        start: Date.now(),
        day: opts?.day ?? localDay(),
        home,
        ...(lighter ? { light: true } : {}),
        ...(preg && !lighter ? { preg: true } : {}),
        ex: wo.ex.map(({ swapped: _s, target, last: ls, sets, ...x }) => {
          const timed = !!(x.time || EX[x.id]?.time);
          const weighted = !timed && (x.t ?? EX[x.id]?.t) !== 'Bodyweight';
          // Every rep done last time, or the same weight for 3 workouts in a row (the coach's "time to go up"): start a
          // step heavier (not on a lighter or pregnancy-safe day).
          const up = !easy && weighted ? (nextWeight(ls, x.reps, step) ?? stallUp(histFor(x.id), lowReps(x.reps), step)) : null;
          // Bodyweight and timed: one more rep (or 5 more seconds) once every set reached the top of the range.
          const more = !easy && !weighted && ls.length && ls.every((y) => y.r >= topReps(x.reps)) ? (timed ? 5 : 1) : 0;
          // Pregnant: the same as last time when last time was pregnancy-safe too; otherwise the lighter target.
          const keepLast = preg && !lighter && pregLast[x.id];
          return {
            ...x,
            tip: false,
            sets: Array.from({ length: sets }, (_, i) => {
              const l = ls[i] ?? ls[ls.length - 1];
              // Last time's numbers, kept apart from the target for the up and down arrows.
              const prev = l ? { pw: l.w, pr: l.r } : {};
              if (up) return { w: '', r: '', done: false, lw: up, lr: lowReps(x.reps), ...prev };
              return { w: '', r: '', done: false, lw: easy && !keepLast ? target : (l?.w ?? 0), lr: l ? l.r + more : topReps(x.reps), ...prev };
            }),
          };
        }),
      });
    },
    [last, top, pregLast, preg, step, setSession, histFor],
  );

  // A new log goes into the recent list and the whole history.
  const keep = useCallback((log: WorkoutLog) => {
    setLogs((xs) => [log, ...xs]);
    setHist((h) => h && { ...h, workouts: [{ day: log.day, started_at: log.started_at, prs: log.prs }, ...h.workouts] });
  }, []);

  // After a workout is saved to your account: a copy for the phone's health app (when that's on), so it closes your
  // rings there, and friends see it in Gym Bros if you share workouts (and records).
  const afterSave = useCallback(
    (log: WorkoutLog) => {
      pushHealth({ type: 'workout', id: log.id, start: new Date(log.started_at), end: new Date(new Date(log.started_at).getTime() + log.minutes * 6e4), kind: 'Strength', kcal: log.kcal });
      if (userId) shareWorkout(userId, { name: log.name, minutes: log.minutes, volume: log.volume, prs: log.prs ?? [] }).catch(() => {});
    },
    [userId],
  );

  const addLog = useCallback(
    async (row: Omit<WorkoutLog, 'id'> & { group_session?: string }) => {
      // A group workout is saved once: a second save gets the one already saved.
      const saved = async () => {
        if (!row.group_session) return null;
        const { data } = await supabase.from('workout_logs').select('*').eq('group_session', row.group_session).limit(1).maybeSingle();
        return data ? { log: { ...(data as WorkoutLog), volume: +data.volume }, dup: true } : null;
      };
      const before = await saved();
      if (before) return before;
      let { data, error } = await supabase.from('workout_logs').insert(row).select('*').single();
      // The database doesn't have the group workout column yet: saved without it (the check on this phone still holds).
      if (error?.code === 'PGRST204' && row.group_session) {
        const { group_session: _g, ...plain } = row;
        ({ data, error } = await supabase.from('workout_logs').insert(plain).select('*').single());
      }
      if (error || !data) return error?.code === '23505' ? saved() : null;
      const log = { ...(data as WorkoutLog), volume: +data.volume };
      keep(log);
      afterSave(log);
      return { log };
    },
    [keep, afterSave],
  );

  // Workouts finished offline: saved one by one when there's a connection (on start, when the app comes back, and every
  // 15 seconds while some are waiting). A workout already saved (the answer was lost) isn't saved twice.
  const logFlushing = useRef(false);
  const logRetry = useRef<ReturnType<typeof setTimeout>>(undefined);
  const flushLogs = useCallback(async () => {
    if (!userId || logFlushing.current) return;
    logFlushing.current = true;
    try {
      for (const q of await readPendingLogs(userId)) {
        const found = await supabase.from('workout_logs').select('*').eq('started_at', q.row.started_at).limit(1).maybeSingle();
        let data = found.data as WorkoutLog | null;
        let failed = !!found.error;
        if (!failed && !data) {
          const ins = await supabase.from('workout_logs').insert(q.row).select('*').single();
          data = ins.data as WorkoutLog | null;
          failed = !!ins.error;
          // Refused by the database (not the connection): it would never save, so it stops waiting.
          if (ins.error?.code) failed = false;
        }
        if (failed) {
          clearTimeout(logRetry.current);
          logRetry.current = setTimeout(() => void flushLogsRef.current(), 15_000);
          return;
        }
        const rest = (await readPendingLogs(userId)).filter((x) => x.local !== q.local);
        await AsyncStorage.setItem(LOG_PENDING_KEY(userId), JSON.stringify(rest)).catch(() => {});
        if (!data) {
          setLogs((xs) => xs.filter((x) => x.id !== q.local));
          continue;
        }
        const log = { ...data, volume: +data.volume };
        setLogs((xs) => xs.map((x) => (x.id === q.local ? log : x)));
        // Health app and friends' feed weren't done when it was finished offline.
        afterSave(log);
      }
    } finally {
      logFlushing.current = false;
    }
  }, [userId, afterSave]);
  useEffect(() => {
    flushLogsRef.current = flushLogs;
  }, [flushLogs]);
  useEffect(() => {
    const sub = AppState.addEventListener('change', (st) => st === 'active' && void flushLogsRef.current());
    return () => {
      sub.remove();
      clearTimeout(logRetry.current);
    };
  }, []);

  // A workout being saved: a second tap on Finish waits for the same save instead of saving the workout twice.
  const finishing = useRef<Promise<WorkoutLog | null> | null>(null);
  const saveWorkout = useCallback(
    async (names: Record<string, string>) => {
      const s = session;
      if (!s || !userId) return null;
      // The workout ends a few minutes after the last set (not when Finish was tapped, which can be hours later).
      const end = Math.min(Date.now(), s.lastAt ? s.lastAt + END_BUFFER_MS : Date.now());
      const minutes = Math.min(MAX_MINUTES, Math.max(1, Math.round((end - s.start) / 60000)));
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
        const vs = vsLastTime(x, last[x.id]);
        if (vs === 'up') ups++;
        else if (vs === 'down') downs++;
        // The Arabic name too (exercises from the full list), so the history shows it in Arabic. The muscle group and
        // whether it's timed are kept too (muscle recovery, and holds shown in seconds).
        const n = names[x.id] ?? x.id;
        const info = exInfo(x, 'en');
        const ar = EX[x.id] ? '' : exInfo(x, 'ar').name;
        const m = EX[x.id] ? '' : info.muscle;
        exercises.push({
          id: x.id,
          n,
          ...(ar && ar !== n ? { ar } : {}),
          ...(m && m !== 'Other' ? { m } : {}),
          ...(info.timed ? { time: true } : {}),
          ...(s.light ? { light: true } : {}),
          ...(s.preg ? { preg: true } : {}),
          sets: d,
        });
      }
      // Calories use realistic minutes: never more than 3 hours, or about 6 minutes a set when the workout was left open.
      const kcalMin = Math.min(minutes, 180, Math.max(30, setsDone * 6));
      const row = {
        day: s.day ?? localDay(new Date(s.start)),
        name: s.home ? 'Home' : s.name.slice(0, 40),
        started_at: new Date(s.start).toISOString(),
        minutes,
        volume: Math.round(volume * 10) / 10,
        sets_done: setsDone,
        kcal: workoutKcal(kcalMin, Number(profile?.weight_kg ?? 80)),
        exercises,
        prs,
        ups,
        downs,
      };
      const { data, error } = await supabase.from('workout_logs').insert(row).select('*').single();
      if (error?.code || (!error && !data)) return null;
      if (error || !data) {
        // No connection: kept on this phone and saved when it's back. You still see your summary now.
        const local = `local-${s.start}`;
        const queue = (await readPendingLogs(userId)).filter((q) => q.local !== local);
        await AsyncStorage.setItem(LOG_PENDING_KEY(userId), JSON.stringify([...queue, { local, row }])).catch(() => {});
        const log = { ...row, id: local } as WorkoutLog;
        keep(log);
        setSession(null);
        clearTimeout(logRetry.current);
        logRetry.current = setTimeout(() => void flushLogsRef.current(), 15_000);
        return log;
      }
      const log = { ...(data as WorkoutLog), volume: +data.volume };
      keep(log);
      setSession(null);
      afterSave(log);
      return log;
    },
    [session, userId, best, history, last, profile?.weight_kg, setSession, keep, afterSave],
  );
  // Heart rate from the watch for workouts of the last 2 days that don't have it yet (watches send it a little late,
  // so this runs again whenever the list or the watch data changes). Calories then come from the heart rate.
  const dev = useDevices(userId);
  const hrTried = useRef(new Set<string>());
  useEffect(() => {
    if (!dev.connected || !logs.length) return;
    const age = profile?.date_of_birth ? Math.max(14, Math.floor((Date.now() - new Date(profile.date_of_birth).getTime()) / 3.15576e10)) : 30;
    const kg = Number(profile?.weight_kg ?? 80);
    const todo = logs.filter((l) => !l.id.startsWith('local-') && l.avg_hr == null && l.day >= addDays(localDay(), -1) && !hrTried.current.has(`${l.id}:${dev.prefs.last_sync}`));
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

  // A past workout changed or was deleted: the recent list, your whole history and your best lifts follow, so streaks,
  // progress, recovery and next time's weights all come from what's saved. Records are worked out again for it and
  // every later workout with the same exercises.
  const refreshBest = useCallback(async () => {
    const { data } = await supabase.rpc('my_best_lifts');
    if (!Array.isArray(data)) return;
    const b: Record<string, number> = {};
    for (const r of data as { id: string; w: number }[]) if (r.id) b[r.id] = Number(r.w) || 0;
    setHist((h) => h && { ...h, best: b });
  }, []);
  const saveLaterPrs = useCallback(async (prs: Record<string, { started_at: string; prs: WorkoutLog['prs'] }>, skip: string) => {
    const later = Object.entries(prs).filter(([id]) => id !== skip);
    await Promise.all(later.map(([id, x]) => supabase.from('workout_logs').update({ prs: x.prs }).eq('id', id)));
    const byStart = new Map(Object.values(prs).map((x) => [x.started_at, x.prs]));
    setLogs((xs) => xs.map((x) => (prs[x.id] && x.id !== skip ? { ...x, prs: prs[x.id].prs } : x)));
    setHist((h) => h && { ...h, workouts: h.workouts.map((w) => (byStart.has(w.started_at) ? { ...w, prs: byStart.get(w.started_at)! } : w)) });
    later.forEach(([id, x]) => emitLogChange(id, { prs: x.prs }));
  }, []);

  const editLog = useCallback(
    async (log: WorkoutLog, exercises: LoggedEx[]): Promise<WorkoutLog | null> => {
      // Not saved to your account yet (finished offline).
      if (log.id.startsWith('local-')) return null;
      const kept = exercises.map((x) => ({ ...x, sets: x.sets.filter((y) => y.r > 0) })).filter((x) => x.sets.length);
      if (!kept.length) return null;
      const draft: WorkoutLog = { ...log, ...logTotals(kept), exercises: kept };
      const ids = [...new Set([...log.exercises.map((x) => x.id), ...kept.map((x) => x.id)])];
      const prs = await recomputePrs(ids, log.started_at, draft);
      if (!prs) return null;
      const next: WorkoutLog = { ...draft, prs: prs[log.id]?.prs ?? log.prs };
      const { error } = await supabase.from('workout_logs').update({ exercises: next.exercises, volume: next.volume, sets_done: next.sets_done, prs: next.prs }).eq('id', log.id);
      if (error) return null;
      setLogs((xs) => xs.map((x) => (x.id === log.id ? next : x)));
      emitLogChange(log.id, next);
      await saveLaterPrs(prs, log.id).catch(() => {});
      refreshBest().catch(() => {});
      return next;
    },
    [saveLaterPrs, refreshBest],
  );

  const deleteLog = useCallback(
    async (log: WorkoutLog) => {
      if (log.id.startsWith('local-')) return false;
      const { error } = await supabase.from('workout_logs').delete().eq('id', log.id);
      if (error) return false;
      setLogs((xs) => xs.filter((x) => x.id !== log.id));
      setHist((h) => h && { ...h, workouts: h.workouts.filter((w) => w.started_at !== log.started_at) });
      emitLogChange(log.id, null);
      // Off the phone's health app too.
      pullHealth('workout', log.id);
      const prs = await recomputePrs([...new Set(log.exercises.map((x) => x.id))], log.started_at, null).catch(() => null);
      if (prs) await saveLaterPrs(prs, log.id).catch(() => {});
      refreshBest().catch(() => {});
      return true;
    },
    [saveLaterPrs, refreshBest],
  );

  const finishWorkout = useCallback(
    (names: Record<string, string>) => {
      if (!finishing.current) finishing.current = saveWorkout(names).finally(() => (finishing.current = null));
      return finishing.current;
    },
    [saveWorkout],
  );

  const value = useMemo<Train>(
    () => ({ ready, loadError, reload: () => setLoadTry((n) => n + 1), setupDone, plan, savePlan, changePlan, updatePlan, today, todayIdx, week, setWeek, editWeek, doneIdx, todayName, todayLog, logs, last, best, top, session, rest, setRest, stale, discardSession, startWorkout, setSession, finishWorkout, streak, bestStreak, history, coach, coachOffer, coachProgram: offer, acceptCoach, declineCoach, recTools, setRecTools, addLog, editLog, deleteLog, preg, setPreg }),
    [ready, loadError, setupDone, plan, savePlan, changePlan, updatePlan, today, todayIdx, week, setWeek, editWeek, doneIdx, todayName, todayLog, logs, last, best, top, session, rest, setRest, stale, discardSession, startWorkout, setSession, finishWorkout, streak, bestStreak, history, coach, coachOffer, offer, acceptCoach, declineCoach, recTools, setRecTools, addLog, editLog, deleteLog, preg, setPreg],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useTrain() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useTrain must be used inside TrainProvider');
  return v;
}
