import { createContext, type PropsWithChildren, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { caffeineCheck, caffeineOf, caffeineToday, setCaffeinePregnant, showCaffeineAlert } from './caffeine';
import { useAuth } from './auth';
import { newId } from './coach';
import type { MealPlan } from './coaching';
import { cycleVersion, peekCycle, weekNow } from './cycle';
import {
  addDays,
  ageFromIso,
  bfOf,
  bmr,
  defaultPlan,
  type FoodPlan,
  hhmmOf,
  isMinor,
  isRamadan,
  RAMADAN_LIVE,
  kcalFloor,
  localDay,
  type Macros,
  maintenance,
  mealAt,
  type Person,
  planMeals,
  pregExtra,
  recalcTargets,
  targets,
  untouchedKcal,
  withPregnancy,
} from './nutrition';
import { plannedOn, type TrainPlan } from './training';
import { extraMoveKcal, pullHealth, pushHealth, useDevices, watchCardio } from './devices';
import { supabase } from './supabase';

export type FoodLog = {
  id: string;
  day: string;
  meal: string | null;
  name: string;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  sugar_high: boolean;
  fat_high: boolean;
  food_id: string | null;
  plan_key: string | null;
  barcode?: string | null;
  created_at: string;
};

export type SavedMeal = {
  id: string;
  name: string;
  items: string | null;
  ingredients: { id?: string; n: string; g: number; k: number; p: number; c: number; f: number }[] | null;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  /** Shareable code like MEAL-K7Q2RX9P (older ones have 4 characters). */
  code: string;
  /** The code this meal was copied from (added by code). */
  from_code: string | null;
  /** Recipes: cooking steps, how many servings the whole recipe makes (kcal and macros are for one), and the video it came from. */
  steps?: string[] | null;
  servings?: number | null;
  source?: string | null;
};

export type NewSavedMeal = Omit<SavedMeal, 'id' | 'code' | 'from_code'> & { code?: string; from_code?: string | null };

/** `grp`: the balancing it came from (all its days share it; older moves have none). `kind`: 'balance' when it came from the balance sheet. */
export type Move = { id: string; day: string; kcal: number; grp?: string | null; kind?: string | null };

export type WaterLog = { id: string; ml: number; kind: string; created_at: string };

export type Cardio = { id: string; kind: 'Walk' | 'Run' | 'Bike' | 'Swim' | 'Other'; name?: string | null; minutes: number; intensity: number; kcal: number; created_at: string; /** Recorded by the watch (not saved in Adro, can't be deleted here), with its heart rate when measured. */ watch?: boolean; avg_hr?: number | null; max_hr?: number | null };

export type NewLog = {
  name: string;
  /** What's in it (a meal of several items), for the caffeine check. Not saved. */
  parts?: string[];
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  meal?: string | null;
  sugar_high?: boolean;
  fat_high?: boolean;
  food_id?: string | null;
  plan_key?: string | null;
  barcode?: string | null;
};

type Food = {
  ready: boolean;
  /** The real date today. */
  today: string;
  /** The day you're looking at (today unless you went back with the arrows or the calendar). Logs, water, cardio and steps are for this day, and new logs go to it. */
  day: string;
  setDay: (d: string) => void;
  isToday: boolean;
  /** The day the loaded logs and water belong to (for a moment after changing day, still the old one). */
  loadedDay: string | null;
  setupDone: boolean;
  /** Something didn't load (no connection): what's on screen is from before, or nothing yet. `reload` tries again. */
  loadError: boolean;
  reload: () => void;
  plan: FoodPlan;
  person: Person;
  /** Unsaved plan while going through setup or editing targets. */
  draft: FoodPlan | null;
  setDraft: (p: FoodPlan | null) => void;
  savePlan: (p: FoodPlan, setupDone?: boolean) => Promise<boolean>;
  /** A new weigh-in (or weekly average): when it's 2 kg or more away from the plan's weight, calories, protein and water follow it. */
  applyWeight: (kg: number, latest?: number) => Promise<boolean>;
  /** Set after targets were updated for a new weight (Food shows a toast, then clears it). */
  weightNote: number | null;
  clearWeightNote: () => void;
  /** Pregnancy mode is on (cycle tracking): no calorie deficit, the trimester's extra calories, caffeine up to 200 mg. */
  preg: boolean;
  /** After birth (cycle tracking): breastfeeding, +400 kcal and more water. */
  nursing: boolean;
  /** Extra calories a day shown for pregnancy (by trimester) or breastfeeding. Never saved in the plan. */
  pregKcal: number;
  /** The day's water goal: your plan's, plus a training day, cardio, pregnancy or breastfeeding. */
  waterGoal: number;
  /** Extra water in today's goal (ml), from training, cardio, pregnancy or breastfeeding. */
  waterExtra: number;
  /** A patch, or a function that makes one from the newest plan (for undo after other changes). */
  updatePlan: (patch: Partial<FoodPlan> | ((cur: FoodPlan) => Partial<FoodPlan>)) => void;
  logs: FoodLog[];
  eaten: Macros;
  target: Macros;
  /** Today's calorie goal including calories moved from or to other days. */
  dayGoal: (day: string) => number;
  /** Calories and protein set by your coach, or the totals of the coach's meal plan (they replace your own targets). */
  coachTargets: { kcal: number; protein: number; name: string } | null;
  /** Your active coach (they manage your food plan). */
  coach: { name: string; link: string } | null;
  /** The meal plan your coach sent, if any. */
  coachMeals: MealPlan | null;
  kcalLeft: number;
  addLog: (l: NewLog, on?: string) => Promise<FoodLog | null>;
  deleteLog: (id: string) => Promise<FoodLog | null>;
  /** Move a logged food to another meal. */
  setLogMeal: (id: string, meal: string) => Promise<void>;
  /** Change a logged food's name or numbers. */
  updateLog: (id: string, patch: Partial<Pick<FoodLog, 'name' | 'kcal' | 'protein' | 'carbs' | 'fat'>>) => Promise<boolean>;
  restoreLog: (l: FoodLog) => Promise<void>;
  saved: SavedMeal[];
  saveMeal: (m: NewSavedMeal) => Promise<SavedMeal | null>;
  /** Change a saved meal (name, ingredients, totals). Its code stays the same. */
  updateMeal: (id: string, patch: Partial<NewSavedMeal>) => Promise<SavedMeal | null>;
  deleteMeal: (id: string) => Promise<void>;
  /** Copy someone's meal into your saved meals by its code. */
  addMealByCode: (code: string) => Promise<{ status: 'ok' | 'not_found' | 'exists' | 'slow' | 'failed'; meal?: SavedMeal }>;
  moves: Move[];
  /** One balancing: all rows share a new id (grp). */
  addMoves: (m: { day: string; kcal: number }[], kind?: string) => Promise<Move[]>;
  /** Remove moves by id, and whole balancings by their grp (also their days that aren't loaded). */
  removeMoves: (ids: string[], grps?: string[]) => Promise<void>;
  water: number;
  waterLogs: WaterLog[];
  deleteWater: (id: string) => Promise<WaterLog | null>;
  /** Cardio today: what you logged plus the cardio your watch recorded. Its calories are added to today's budget. */
  cardio: Cardio[];
  /** Calories added to today's budget: cardio (only what's beyond your resting burn for those minutes, since your goal
   * already counts that), plus the watch's extra movement (moveKcal). */
  burned: number;
  /** From the watch: active calories beyond your usual day that no cardio explains. */
  moveKcal: number;
  addCardio: (c: Omit<Cardio, 'id' | 'created_at'>, on?: string) => Promise<Cardio | null>;
  deleteCardio: (id: string) => Promise<void>;
  /** Steps today: your watch's count, or what you typed in (plus about 110 per minute of walking) when that's higher. */
  steps: number;
  setSteps: (n: number) => Promise<void>;
  /** Add (or take off) steps from today's latest count, not an older copy. */
  addSteps: (d: number) => Promise<void>;
  addWater: (ml: number, kind?: string, on?: string) => Promise<void>;
  /** Over/under balance sheet (shown above everything). */
  balance: 'over' | 'under' | null;
  openBalance: (k: 'over' | 'under' | null) => void;
  /** Log food sheet. */
  logOpen: boolean;
  setLogOpen: (v: boolean) => void;
  /** Text to open "Type what you ate" with (null = open the menu). */
  typeSeed: string | null;
  openTyping: (text: string) => void;
};

const Ctx = createContext<Food | null>(null);

/** When something was eaten or drunk, for the phone's health app: when it was logged, or midday for an earlier day. */
const loggedAt = (day: string, created: string) => (localDay(new Date(created)) === day ? new Date(created) : new Date(`${day}T12:00:00`));
const mealCopy = (l: FoodLog) => ({ type: 'meal' as const, id: l.id, at: loggedAt(l.day, l.created_at), kcal: +l.kcal, protein: +l.protein, carbs: +l.carbs, fat: +l.fat });

export function FoodProvider({ children }: PropsWithChildren) {
  const { session, profile, updateProfile } = useAuth();
  const userId = session?.user.id;
  const [today, setToday] = useState(localDay());
  const [picked, setPicked] = useState<string | null>(null);
  // Never a day in the future; once the picked day is today again, follow the real date.
  const day = picked && picked < today ? picked : today;
  const isToday = day === today;
  const setDay = useCallback((d: string) => setPicked(d >= localDay() ? null : d), []);
  const [readyFor, setReadyFor] = useState<string | null>(null);
  const ready = !!userId && readyFor === userId;
  const [setupDone, setSetupDone] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [loadNo, setLoadNo] = useState(0);
  const reload = useCallback(() => {
    setLoadError(false);
    setLoadNo((n) => n + 1);
  }, []);
  const [plan, setPlan] = useState<FoodPlan>(defaultPlan(80));
  const [draft, setDraft] = useState<FoodPlan | null>(null);
  const [logs, setLogs] = useState<FoodLog[]>([]);
  const [loadedDay, setLoadedDay] = useState<string | null>(null);
  const [saved, setSaved] = useState<SavedMeal[]>([]);
  const [moves, setMoves] = useState<Move[]>([]);
  const [waterLogs, setWaterLogs] = useState<WaterLog[]>([]);
  const [loggedCardio, setCardio] = useState<Cardio[]>([]);
  const [loggedSteps, setStepsState] = useState(0);
  const stepsNow = useRef(0);
  const [balance, openBalance] = useState<'over' | 'under' | null>(null);
  const [logOpen, setLogOpenState] = useState(false);
  const [typeSeed, setTypeSeed] = useState<string | null>(null);
  // What the coach set: typed numbers, else the meal plan's totals (either may be missing).
  const [coachSet, setCoachSet] = useState<{ kcal: number | null; protein: number | null; name: string } | null>(null);
  const [trained, setTrained] = useState<{ day: string; on: boolean } | null>(null);
  const [coach, setCoach] = useState<Food['coach']>(null);
  const [coachMeals, setCoachMeals] = useState<MealPlan | null>(null);
  const [weightNote, setWeightNote] = useState<number | null>(null);
  const clearWeightNote = useCallback(() => setWeightNote(null), []);
  // Pregnancy mode lives with the cycle data; re-read when it changes (checked every minute and when the app comes back).
  const [cycleVer, setCycleVer] = useState(cycleVersion());
  const [cyc, setCyc] = useState<{ uid: string; mode: string; pregWeek: number | null } | null>(null);
  const female = profile?.gender === 'female';
  const preg = female && !!cyc && cyc.uid === userId && cyc.mode === 'preg';
  const nursing = female && !!cyc && cyc.uid === userId && cyc.mode === 'post';
  const pregKcal = pregExtra(preg ? 'preg' : nursing ? 'post' : null, cyc?.pregWeek);
  const setLogOpen = useCallback((v: boolean) => {
    setLogOpenState(v);
    if (!v) setTypeSeed(null);
  }, []);
  const openTyping = useCallback((text: string) => {
    setTypeSeed(text);
    setLogOpenState(true);
  }, []);
  const person: Person = useMemo(
    () => ({ gender: profile?.gender ?? null, age: ageFromIso(profile?.date_of_birth), height: Number(profile?.height_cm ?? 175) }),
    [profile?.gender, profile?.date_of_birth, profile?.height_cm],
  );
  const planRef = useRef(plan);
  const logsRef = useRef(logs);
  const personRef = useRef(person);
  useEffect(() => {
    planRef.current = plan;
    logsRef.current = logs;
    personRef.current = person;
  }, [plan, logs, person]);
  const saveTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  // A small change is waiting to be saved (the plan on screen is newer than the server's).
  const savePending = useRef(false);
  // Plan saves still on their way to the server, and how many were ever started (a load that began before one keeps
  // the plan on screen).
  const saving = useRef(0);
  const saveSeq = useRef(0);
  const upsertPlan = useCallback((row: { user_id: string; plan: FoodPlan; setup_done?: boolean }) => {
    saving.current++;
    saveSeq.current++;
    return Promise.resolve(supabase.from('food_plans').upsert(row)).finally(() => saving.current--);
  }, []);
  // The last weigh-in applyWeight already looked at (so loading doesn't redo it with a single day's weight).
  const weighedRef = useRef<number | null>(null);

  useEffect(() => {
    if (!userId || !female) return;
    let alive = true;
    peekCycle(userId)
      .then((c) => {
        if (!alive) return;
        const st = c.settings;
        setCyc({ uid: userId, mode: st?.mode ?? 'track', pregWeek: st?.mode === 'preg' ? weekNow(st, 'preg', today) : null });
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [userId, female, cycleVer, today]);

  // Caffeine checks anywhere in the app use 200 mg a day in pregnancy.
  useEffect(() => {
    setCaffeinePregnant(preg);
  }, [preg]);

  // A new day starts when the app comes back after midnight.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') {
        setToday(localDay());
        setCycleVer(cycleVersion());
      }
    });
    const id = setInterval(() => {
      setToday(localDay());
      setCycleVer(cycleVersion());
    }, 60_000);
    return () => {
      sub.remove();
      clearInterval(id);
    };
  }, []);

  useEffect(() => {
    if (!userId) return;
    let alive = true;
    (async () => {
      const weekEnd = addDays(today, 7);
      const from = day < today ? day : today;
      const seq = saveSeq.current;
      const [p, l, s, m, w, cd, st, mc, mp, wl, tp] = await Promise.all([
        supabase.from('food_plans').select('*').eq('user_id', userId).maybeSingle(),
        supabase.from('food_logs').select('*').eq('day', day).order('created_at'),
        supabase.from('saved_meals').select('*').order('created_at', { ascending: false }),
        // From the day you're looking at (a past day's own moves count for its goal) to a week ahead.
        supabase.from('calorie_moves').select('id,day,kcal,grp,kind').gte('day', from).lte('day', weekEnd),
        supabase.from('water_logs').select('id,ml,kind,created_at').eq('day', day).order('created_at'),
        supabase.from('cardio_logs').select('id,kind,name,minutes,intensity,kcal,created_at').eq('day', day).order('created_at'),
        supabase.from('step_logs').select('steps').eq('day', day).maybeSingle(),
        supabase.rpc('my_coach'),
        supabase.rpc('my_coach_plans'),
        // A training day (a workout logged or planned) needs more water.
        supabase.from('workout_logs').select('id').eq('day', day).limit(1),
        supabase.from('train_plans').select('plan').eq('user_id', userId).maybeSingle(),
      ]);
      if (!alive) return;
      // Anything that didn't load keeps what's on screen (never an empty day, and never the setup screen for a plan
      // that's there but didn't arrive); Food shows "try again".
      const failed = [p, l, s, m, w, cd, st, mc, mp].some((x) => x.error);
      setLoadError(failed);
      const pw = Number(profile?.weight_kg ?? 0);
      const base = defaultPlan(pw || 80);
      let loaded = p.data?.plan ? { ...base, ...(p.data.plan as FoodPlan) } : base;
      // Your profile weight is the one that counts: 2 kg or more away from the plan's weight updates the targets.
      // Plans made before the calorie floor that are still under it (and untouched) are lifted to it.
      // A change waiting to be saved, or saved since this load began, is newer than what the server sent: keep it.
      const newer = savePending.current || saving.current > 0 || saveSeq.current !== seq;
      if (!p.error && p.data?.setup_done && !newer) {
        const who = personRef.current;
        const stale = pw > 0 && pw !== weighedRef.current && Math.abs(pw - loaded.weight) >= 2;
        const unsafe = loaded.carbG == null && loaded.kcal < kcalFloor(loaded.weight, who, loaded.bf) && untouchedKcal(loaded, who);
        // Under 18 never cuts or bulks.
        const minor = isMinor(who) && loaded.goal !== 2;
        if (stale || unsafe || minor) {
          loaded = recalcTargets(loaded, who, { weight: stale ? pw : loaded.weight });
          upsertPlan({ user_id: userId, plan: loaded }).catch(() => {});
          if (stale) setWeightNote(loaded.weight);
        }
      }
      // Ramadan mode only counts during Ramadan (from the phone's Islamic calendar); outside it, it's off (you turn it
      // on again next Ramadan).
      if (!p.error) {
        if (newer) loaded = planRef.current;
        setPlan(RAMADAN_LIVE && isRamadan(today) ? loaded : { ...loaded, ramadan: false });
        if (!newer) setSetupDone(!!p.data?.setup_done);
      }
      if (!l.error) {
        setLogs((l.data as FoodLog[]) ?? []);
        setLoadedDay(day);
      }
      if (!s.error) setSaved((s.data as SavedMeal[]) ?? []);
      if (!m.error) setMoves((m.data as Move[]) ?? []);
      if (!w.error) setWaterLogs((w.data as WaterLog[]) ?? []);
      if (!cd.error) setCardio((cd.data as Cardio[]) ?? []);
      if (!st.error) setStepsState((st.data as { steps: number } | null)?.steps ?? 0);
      let planned = false;
      try {
        const tplan = (tp.data as { plan: TrainPlan | null } | null)?.plan;
        planned = !!tplan && plannedOn({ ...tplan, skipped: tplan.skipped ?? {} }, day);
      } catch {}
      setTrained({ day, on: !!wl.data?.length || planned });
      if (!mc.error && !mp.error) {
        const co = ((mc.data as { id: string; status: string; kcal: number | null; protein: number | null; name: string | null; username: string }[] | null) ?? [])[0];
        const active = co?.status === 'active';
        const plan = active ? ((mp.data as { meals: MealPlan | null } | null)?.meals ?? null) : null;
        const planK = plan ? plan.meals.reduce((a, x) => a + (+x.k || 0), 0) : 0;
        const planP = plan ? plan.meals.reduce((a, x) => a + (+x.p || 0), 0) : 0;
        setCoach(active ? { name: co.name || co.username, link: co.id } : null);
        setCoachMeals(plan && plan.meals.length ? plan : null);
        // Same rule as the server (coach_client_targets): the numbers the coach typed first, then the meal plan's
        // totals. Calories or protein alone is enough; the other one stays yours.
        const kcal = co?.kcal && co.kcal > 0 ? co.kcal : planK > 0 ? Math.round(planK) : null;
        const protein = co?.protein && co.protein > 0 ? co.protein : planP > 0 ? Math.round(planP) : null;
        setCoachSet(active && (kcal || protein) ? { kcal, protein, name: co.name || co.username } : null);
      }
      setReadyFor(userId);
    })();
    return () => {
      alive = false;
    };
  }, [userId, today, day, profile?.weight_kg, upsertPlan, loadNo]);

  const savePlan = useCallback(
    async (p: FoodPlan, done?: boolean) => {
      if (!userId) return false;
      // A small change waiting to be saved would write an older plan over this one.
      clearTimeout(saveTimer.current);
      savePending.current = false;
      // Plans saved from a screen started from a copy (setup, My targets): recipes the AI made meanwhile stay.
      const cur = planRef.current;
      // Recipes added for a new meal keep the old date, so a longer list on the same date is newer too.
      const pa = p.aiRecipes;
      const ca = cur?.aiRecipes;
      if (ca && (!pa || pa.at < ca.at || (pa.at === ca.at && pa.list.length < ca.list.length))) p = { ...p, aiRecipes: ca };
      setPlan(p);
      planRef.current = p;
      if (done !== undefined) setSetupDone(done);
      const { error } = await upsertPlan({ user_id: userId, plan: p, ...(done !== undefined ? { setup_done: done } : {}) });
      // Saving from setup or the plan screen: the weight typed there becomes your profile weight too.
      if (!error && done && Math.abs(p.weight - Number(profile?.weight_kg ?? 0)) >= 0.1) updateProfile({ weight_kg: Math.round(p.weight * 10) / 10 }).catch(() => {});
      return !error;
    },
    [userId, profile?.weight_kg, updateProfile, upsertPlan],
  );

  const applyWeight = useCallback(
    async (kg: number, latest?: number) => {
      weighedRef.current = Math.round((latest ?? kg) * 10) / 10;
      const cur = planRef.current;
      if (!setupDone || !(kg > 0) || Math.abs(kg - cur.weight) < 2) return false;
      const ok = await savePlan(recalcTargets(cur, personRef.current, { weight: kg }));
      if (ok) setWeightNote(Math.round(kg * 10) / 10);
      return ok;
    },
    [setupDone, savePlan],
  );

  // Small changes (meal swaps, shopping ticks) save quietly after a moment.
  const updatePlan = useCallback(
    (patch: Partial<FoodPlan> | ((cur: FoodPlan) => Partial<FoodPlan>)) => {
      const next = { ...planRef.current, ...(typeof patch === 'function' ? patch(planRef.current) : patch) };
      planRef.current = next;
      setPlan(next);
      clearTimeout(saveTimer.current);
      savePending.current = true;
      // Changes in a row go out once, a moment later, always the newest plan.
      saveTimer.current = setTimeout(() => {
        savePending.current = false;
        if (userId) upsertPlan({ user_id: userId, plan: planRef.current }).catch(() => {});
      }, 600);
    },
    [userId, upsertPlan],
  );

  // Your targets with pregnancy's or breastfeeding's extra on top (only shown; the plan keeps its own numbers).
  const own = useMemo(() => targets(preg ? withPregnancy(plan, person, pregKcal) : nursing ? withPregnancy(plan, person, pregKcal, false) : plan), [plan, preg, nursing, pregKcal, person]);
  const coachTargets = useMemo<Food['coachTargets']>(() => {
    if (!coachSet) return null;
    // Pregnant: never under maintenance, even when the coach set fewer calories.
    const floor = preg ? Math.round(maintenance(plan, person) / 10) * 10 : 0;
    return { kcal: Math.max(coachSet.kcal ?? own.k, floor), protein: coachSet.protein ?? own.p, name: coachSet.name };
  }, [coachSet, own, preg, plan, person]);
  const target = useMemo(() => {
    if (!coachTargets) return own;
    // Calories from the coach: fat is a quarter of them (as in our own targets), carbs the rest.
    const f = Math.round((coachTargets.kcal * 0.257) / 9);
    return { k: coachTargets.kcal, p: coachTargets.protein, f, c: Math.max(0, Math.round((coachTargets.kcal - coachTargets.protein * 4 - f * 9) / 4)) };
  }, [own, coachTargets]);
  const eaten = useMemo(
    () => logs.reduce((a, x) => ({ k: a.k + +x.kcal, p: a.p + +x.protein, c: a.c + +x.carbs, f: a.f + +x.fat }), { k: 0, p: 0, c: 0, f: 0 }),
    [logs],
  );
  const dayGoal = useCallback((day: string) => target.k + moves.filter((m) => m.day === day).reduce((a, m) => a + m.kcal, 0), [target.k, moves]);
  const water = useMemo(() => waterLogs.reduce((a, x) => a + x.ml, 0), [waterLogs]);
  // The watch fills in what you didn't log: its steps when higher, its cardio workouts, and calories you moved off
  // beyond your usual day (your goal already covers a normal day's activity).
  const dev = useDevices(userId);
  const devDay = dev.days.find((d) => d.day === day);
  const steps = Math.max(loggedSteps, devDay?.steps ?? 0);
  const cardio = useMemo<Cardio[]>(
    () => [...loggedCardio, ...watchCardio(devDay, loggedCardio).map((w, i) => ({ id: `watch:${day}:${i}`, ...w, intensity: 1, created_at: `${day}T12:00:00`, watch: true }))],
    [loggedCardio, devDay, day],
  );
  const cardioKcal = cardio.reduce((a, x) => a + x.kcal, 0);
  const moveKcal = extraMoveKcal(dev.days, day, cardioKcal);
  // Your goal already counts what you burn at rest (and your usual activity), so cardio adds only what it burns beyond
  // resting for those minutes.
  const restPerMin = bmr(plan.weight, person, bfOf(plan, person)) / 1440;
  const netCardio = Math.round(cardio.reduce((a, x) => a + Math.max(0, x.kcal - restPerMin * (+x.minutes || 0)), 0));
  const burned = netCardio + moveKcal;
  const cardioMin = cardio.reduce((a, x) => a + (+x.minutes || 0), 0);
  const waterExtra = (trained?.day === day && trained.on ? 500 : 0) + Math.round(cardioMin * 10) + (preg ? 300 : nursing ? 700 : 0);
  const waterGoal = (plan.water || 2800) + waterExtra;
  const kcalLeft = dayGoal(day) + burned - eaten.k;
  useEffect(() => {
    stepsNow.current = steps;
  }, [steps]);

  const addLog = useCallback(
    async (l: NewLog, on?: string) => {
      const row = {
        day: on ?? day,
        // No meal picked: the one for this time of day (from your meal plan), or a snack.
        // An earlier day: the clock now says nothing about when it was eaten, so a snack.
        meal: l.meal ?? ((on ?? day) < today ? 'Snack' : mealAt(planMeals(planRef.current), hhmmOf())),
        name: l.name.slice(0, 200),
        kcal: Math.round(l.kcal),
        protein: Math.round(l.protein * 10) / 10,
        carbs: Math.round(l.carbs * 10) / 10,
        fat: Math.round(l.fat * 10) / 10,
        sugar_high: !!l.sugar_high,
        fat_high: !!l.fat_high,
        food_id: l.food_id ?? null,
        plan_key: l.plan_key ?? null,
        barcode: l.barcode ?? null,
      };
      const { data, error } = await supabase.from('food_logs').insert(row).select('*').single();
      if (error || !data) return null;
      if (row.day === day) setLogs((xs) => [...xs, data as FoodLog]);
      pushHealth(mealCopy(data as FoodLog));
      return data as FoodLog;
    },
    [day, today],
  );

  const deleteLog = useCallback(async (id: string) => {
    const removed = logsRef.current.find((x) => x.id === id) ?? null;
    setLogs((xs) => xs.filter((x) => x.id !== id));
    await supabase.from('food_logs').delete().eq('id', id);
    pullHealth('meal', id);
    return removed;
  }, []);

  const setLogMeal = useCallback(async (id: string, meal: string) => {
    setLogs((xs) => xs.map((x) => (x.id === id ? { ...x, meal } : x)));
    await supabase.from('food_logs').update({ meal }).eq('id', id);
  }, []);

  const updateLog = useCallback(async (id: string, patch: Partial<Pick<FoodLog, 'name' | 'kcal' | 'protein' | 'carbs' | 'fat'>>) => {
    const { data, error } = await supabase.from('food_logs').update(patch).eq('id', id).select('*').single();
    if (error || !data) return false;
    setLogs((xs) => xs.map((x) => (x.id === id ? (data as FoodLog) : x)));
    // The health app's copy is replaced with the new amounts.
    pullHealth('meal', id);
    pushHealth(mealCopy(data as FoodLog));
    return true;
  }, []);

  const restoreLog = useCallback(
    async (l: FoodLog) => {
      const { id: _id, created_at: _c, ...rest } = l;
      const { data } = await supabase.from('food_logs').insert(rest).select('*').single();
      if (data) {
        // Only into the list when it's the day on screen (you may have moved to another day since).
        if ((data as FoodLog).day === day) setLogs((xs) => [...xs, data as FoodLog].sort((a, b) => a.created_at.localeCompare(b.created_at)));
        pushHealth(mealCopy(data as FoodLog));
      }
    },
    [day],
  );

  const saveMeal = useCallback(async (m: NewSavedMeal) => {
    const { data } = await supabase.from('saved_meals').insert(m).select('*').single();
    if (data) setSaved((xs) => [data as SavedMeal, ...xs.filter((x) => x.id !== (data as SavedMeal).id)]);
    return (data as SavedMeal) ?? null;
  }, []);

  const addMealByCode = useCallback(async (code: string): Promise<{ status: 'ok' | 'not_found' | 'exists' | 'slow' | 'failed'; meal?: SavedMeal }> => {
    const { data, error } = await supabase.rpc('add_meal_by_code', { p_code: code });
    const r = data as { status: string; meal?: SavedMeal } | null;
    if (error || !r) return { status: 'failed' as const };
    if (r.status === 'ok' && r.meal) {
      const meal = { ...r.meal, kcal: +r.meal.kcal, protein: +r.meal.protein, carbs: +r.meal.carbs, fat: +r.meal.fat };
      setSaved((xs) => [meal, ...xs]);
      return { status: 'ok' as const, meal };
    }
    return { status: r.status === 'not_found' || r.status === 'exists' || r.status === 'slow' ? r.status : 'failed' };
  }, []);

  const updateMeal = useCallback(async (id: string, patch: Partial<NewSavedMeal>) => {
    const { id: _id, code: _c, from_code: _f, ...allowed } = patch as Partial<SavedMeal>;
    const { data } = await supabase.from('saved_meals').update(allowed).eq('id', id).select('*').single();
    if (data) setSaved((xs) => xs.map((x) => (x.id === id ? (data as SavedMeal) : x)));
    return (data as SavedMeal) ?? null;
  }, []);

  const deleteMeal = useCallback(async (id: string) => {
    setSaved((xs) => xs.filter((x) => x.id !== id));
    await supabase.from('saved_meals').delete().eq('id', id);
  }, []);

  const addMoves = useCallback(async (ms: { day: string; kcal: number }[], kind?: string) => {
    const grp = newId();
    const { data } = await supabase
      .from('calorie_moves')
      .insert(ms.map((x) => ({ ...x, grp, kind: kind ?? null })))
      .select('id,day,kcal,grp,kind');
    if (data) setMoves((xs) => [...xs, ...(data as Move[])]);
    return (data as Move[]) ?? [];
  }, []);

  const removeMoves = useCallback(async (ids: string[], grps: string[] = []) => {
    setMoves((xs) => xs.filter((x) => !ids.includes(x.id) && !(x.grp && grps.includes(x.grp))));
    await Promise.all([
      ids.length ? supabase.from('calorie_moves').delete().in('id', ids) : null,
      grps.length ? supabase.from('calorie_moves').delete().in('grp', grps) : null,
    ]);
  }, []);

  const addWater = useCallback(
    async (ml: number, kind = 'Water', on?: string) => {
      const d = on ?? day;
      if (d !== day) {
        const { data } = await supabase.from('water_logs').insert({ day: d, ml, kind }).select('id,ml,kind,created_at').single();
        if (data) pushHealth({ type: 'water', id: (data as WaterLog).id, at: loggedAt(d, (data as WaterLog).created_at), ml });
        return;
      }
      const tmp: WaterLog = { id: `tmp-${Date.now()}`, ml, kind, created_at: new Date().toISOString() };
      setWaterLogs((xs) => [...xs, tmp]);
      const { data, error } = await supabase.from('water_logs').insert({ day: d, ml, kind }).select('id,ml,kind,created_at').single();
      setWaterLogs((xs) => (error || !data ? xs.filter((x) => x.id !== tmp.id) : xs.map((x) => (x.id === tmp.id ? (data as WaterLog) : x))));
      if (data) pushHealth({ type: 'water', id: (data as WaterLog).id, at: new Date((data as WaterLog).created_at), ml });
    },
    [day],
  );

  const deleteWater = useCallback(async (id: string) => {
    let removed: WaterLog | null = null;
    setWaterLogs((xs) => {
      removed = xs.find((x) => x.id === id) ?? null;
      return xs.filter((x) => x.id !== id);
    });
    if (!id.startsWith('tmp-')) {
      await supabase.from('water_logs').delete().eq('id', id);
      pullHealth('water', id);
    }
    return removed;
  }, []);

  const addCardio = useCallback(
    async (c: Omit<Cardio, 'id' | 'created_at'>, on?: string) => {
      const d = on ?? day;
      const { data, error } = await supabase.from('cardio_logs').insert({ ...c, day: d }).select('id,kind,name,minutes,intensity,kcal,created_at').single();
      if (error || !data) return null;
      if (d === day) setCardio((xs) => [...xs, data as Cardio]);
      // Cardio typed into Adro goes to the health app as a workout that ended when it was logged.
      const end = loggedAt(d, (data as Cardio).created_at);
      pushHealth({ type: 'workout', id: (data as Cardio).id, start: new Date(end.getTime() - c.minutes * 6e4), end, kind: c.kind, kcal: c.kcal });
      return data as Cardio;
    },
    [day],
  );

  const setSteps = useCallback(
    async (n: number) => {
      const v = Math.max(0, Math.min(200000, Math.round(n)));
      stepsNow.current = v;
      setStepsState(v);
      if (userId) await supabase.from('step_logs').upsert({ user_id: userId, day, steps: v });
    },
    [userId, day],
  );
  const addSteps = useCallback((d: number) => setSteps(stepsNow.current + d), [setSteps]);

  const deleteCardio = useCallback(async (id: string) => {
    if (id.startsWith('watch:')) return;
    setCardio((xs) => xs.filter((x) => x.id !== id));
    await supabase.from('cardio_logs').delete().eq('id', id);
    pullHealth('workout', id);
  }, []);

  const value = useMemo<Food>(
    () => ({
      ready,
      today,
      day,
      setDay,
      isToday,
      loadedDay,
      setupDone,
      loadError,
      reload,
      plan,
      person,
      draft,
      setDraft,
      savePlan,
      applyWeight,
      weightNote,
      clearWeightNote,
      preg,
      nursing,
      pregKcal,
      waterGoal,
      waterExtra,
      updatePlan,
      logs,
      eaten,
      target,
      dayGoal,
      coachTargets,
      coach,
      coachMeals,
      kcalLeft,
      addLog,
      deleteLog,
      setLogMeal,
      updateLog,
      restoreLog,
      saved,
      saveMeal,
      updateMeal,
      deleteMeal,
      addMealByCode,
      moves,
      addMoves,
      removeMoves,
      water,
      waterLogs,
      deleteWater,
      cardio,
      burned,
      moveKcal,
      addCardio,
      deleteCardio,
      steps,
      setSteps,
      addSteps,
      addWater,
      balance,
      openBalance,
      logOpen,
      setLogOpen,
      typeSeed,
      openTyping,
    }),
    [loadError, reload, nursing, pregKcal, waterGoal, waterExtra, day, setDay, isToday, loadedDay, balance, logOpen, setLogOpen, typeSeed, openTyping, coach, coachMeals, addMealByCode, ready, today, setupDone, plan, person, draft, savePlan, applyWeight, weightNote, clearWeightNote, preg, updatePlan, logs, eaten, target, dayGoal, coachTargets, kcalLeft, addLog, deleteLog, setLogMeal, updateLog, restoreLog, saved, saveMeal, updateMeal, deleteMeal, moves, addMoves, removeMoves, water, waterLogs, deleteWater, cardio, burned, moveKcal, addCardio, deleteCardio, steps, setSteps, addSteps, addWater],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useFood() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useFood must be used inside FoodProvider');
  return v;
}

/** Log food with an Undo toast; opens the balance sheet if this goes over today's calories. */
/** This much over the day's calories opens the balance sheet (unless 10% over comes first). */
export const OVER_KCAL = 100;

export function useLogFood() {
  const food = useFood();
  return useCallback(
    async (item: NewLog, toast: (m: string, o?: { ai?: boolean; undo?: () => void; icon?: 'warn' }) => void, t: (s: string, v?: Record<string, string | number>) => string) => {
      const wasOver = food.kcalLeft < 0;
      const row = await food.addLog(item);
      if (!row) {
        toast(t('Couldn’t save. Please try again.'), { icon: 'warn' });
        return null;
      }
      toast(t('Logged to Food: {n} kcal', { n: Math.round(item.kcal) }), { ai: true, undo: () => food.deleteLog(row.id) });
      // A big coffee, energy drink or pre-workout: warn about the caffeine first.
      const caf = food.isToday ? caffeineCheck(caffeineOf(item.parts?.length ? item.parts.join(', ') : item.name), caffeineToday(food.logs.map((l) => l.name), food.waterLogs), new Date().getHours() >= 15) : null;
      if (caf) {
        setTimeout(() => showCaffeineAlert(caf), 900);
        return row;
      }
      // A little over still counts as closing the ring (celebrated instead); from 100 kcal over (or 10%), offer to balance it.
      const max = food.dayGoal(food.day) + food.burned;
      const wayOver = food.eaten.k + item.kcal >= Math.min(max * 1.1, max + OVER_KCAL);
      if (food.isToday && !wasOver && wayOver && food.kcalLeft - item.kcal < 0) setTimeout(() => food.openBalance('over'), 900);
      return row;
    },
    [food],
  );
}
