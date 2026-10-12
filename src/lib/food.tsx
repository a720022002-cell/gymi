import { createContext, type PropsWithChildren, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { caffeineCheck, caffeineOf, caffeineToday, showCaffeineAlert } from './caffeine';
import { useAuth } from './auth';
import type { MealPlan } from './coaching';
import { addDays, ageFromIso, defaultPlan, type FoodPlan, hhmmOf, localDay, type Macros, mealAt, type Person, planMeals, RAMADAN_SWITCH, targets } from './nutrition';
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
  /** Shareable code like MEAL-K7Q2. */
  code: string;
  /** The code this meal was copied from (added by code). */
  from_code: string | null;
  /** Recipes: cooking steps, how many servings the whole recipe makes (kcal and macros are for one), and the video it came from. */
  steps?: string[] | null;
  servings?: number | null;
  source?: string | null;
};

export type NewSavedMeal = Omit<SavedMeal, 'id' | 'code' | 'from_code'> & { code?: string; from_code?: string | null };

export type Move = { id: string; day: string; kcal: number };

export type WaterLog = { id: string; ml: number; kind: string; created_at: string };

export type Cardio = { id: string; kind: 'Walk' | 'Run' | 'Bike' | 'Swim' | 'Other'; name?: string | null; minutes: number; intensity: number; kcal: number; created_at: string };

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
  setupDone: boolean;
  plan: FoodPlan;
  person: Person;
  /** Unsaved plan while going through setup or editing targets. */
  draft: FoodPlan | null;
  setDraft: (p: FoodPlan | null) => void;
  savePlan: (p: FoodPlan, setupDone?: boolean) => Promise<boolean>;
  updatePlan: (patch: Partial<FoodPlan>) => void;
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
  deleteMeal: (id: string) => Promise<void>;
  /** Copy someone's meal into your saved meals by its code. */
  addMealByCode: (code: string) => Promise<{ status: 'ok' | 'not_found' | 'exists' | 'failed'; meal?: SavedMeal }>;
  moves: Move[];
  addMoves: (m: { day: string; kcal: number }[]) => Promise<Move[]>;
  removeMoves: (ids: string[]) => Promise<void>;
  water: number;
  waterLogs: WaterLog[];
  deleteWater: (id: string) => Promise<WaterLog | null>;
  /** Cardio logged today. Its calories are added to today's budget. */
  cardio: Cardio[];
  burned: number;
  addCardio: (c: Omit<Cardio, 'id' | 'created_at'>, on?: string) => Promise<Cardio | null>;
  deleteCardio: (id: string) => Promise<void>;
  /** Steps today (typed in, plus about 110 per minute of walking). */
  steps: number;
  setSteps: (n: number) => Promise<void>;
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

export function FoodProvider({ children }: PropsWithChildren) {
  const { session, profile } = useAuth();
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
  const [plan, setPlan] = useState<FoodPlan>(defaultPlan(80));
  const [draft, setDraft] = useState<FoodPlan | null>(null);
  const [logs, setLogs] = useState<FoodLog[]>([]);
  const [saved, setSaved] = useState<SavedMeal[]>([]);
  const [moves, setMoves] = useState<Move[]>([]);
  const [waterLogs, setWaterLogs] = useState<WaterLog[]>([]);
  const [cardio, setCardio] = useState<Cardio[]>([]);
  const [steps, setStepsState] = useState(0);
  const [balance, openBalance] = useState<'over' | 'under' | null>(null);
  const [logOpen, setLogOpenState] = useState(false);
  const [typeSeed, setTypeSeed] = useState<string | null>(null);
  const [coachTargets, setCoachTargets] = useState<Food['coachTargets']>(null);
  const [coach, setCoach] = useState<Food['coach']>(null);
  const [coachMeals, setCoachMeals] = useState<MealPlan | null>(null);
  const setLogOpen = useCallback((v: boolean) => {
    setLogOpenState(v);
    if (!v) setTypeSeed(null);
  }, []);
  const openTyping = useCallback((text: string) => {
    setTypeSeed(text);
    setLogOpenState(true);
  }, []);
  const planRef = useRef(plan);
  const logsRef = useRef(logs);
  useEffect(() => {
    planRef.current = plan;
    logsRef.current = logs;
  }, [plan, logs]);
  const saveTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const person: Person = useMemo(
    () => ({ gender: profile?.gender ?? null, age: ageFromIso(profile?.date_of_birth), height: Number(profile?.height_cm ?? 175) }),
    [profile?.gender, profile?.date_of_birth, profile?.height_cm],
  );

  // A new day starts when the app comes back after midnight.
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
      const weekEnd = addDays(today, 7);
      const from = day < today ? day : today;
      const [p, l, s, m, w, cd, st, mc, mp] = await Promise.all([
        supabase.from('food_plans').select('*').eq('user_id', userId).maybeSingle(),
        supabase.from('food_logs').select('*').eq('day', day).order('created_at'),
        supabase.from('saved_meals').select('*').order('created_at', { ascending: false }),
        supabase.from('calorie_moves').select('id,day,kcal').gte('day', from).lte('day', weekEnd),
        supabase.from('water_logs').select('id,ml,kind,created_at').eq('day', day).order('created_at'),
        supabase.from('cardio_logs').select('id,kind,name,minutes,intensity,kcal,created_at').eq('day', day).order('created_at'),
        supabase.from('step_logs').select('steps').eq('day', day).maybeSingle(),
        supabase.rpc('my_coach'),
        supabase.rpc('my_coach_plans'),
      ]);
      if (!alive) return;
      const base = defaultPlan(Number(profile?.weight_kg ?? 80));
      const loaded = p.data?.plan ? { ...base, ...(p.data.plan as FoodPlan) } : base;
      setPlan(RAMADAN_SWITCH ? loaded : { ...loaded, ramadan: false });
      setSetupDone(!!p.data?.setup_done);
      setLogs((l.data as FoodLog[]) ?? []);
      setSaved((s.data as SavedMeal[]) ?? []);
      setMoves((m.data as Move[]) ?? []);
      setWaterLogs((w.data as WaterLog[]) ?? []);
      setCardio((cd.data as Cardio[]) ?? []);
      setStepsState((st.data as { steps: number } | null)?.steps ?? 0);
      const co = ((mc.data as { id: string; status: string; kcal: number | null; protein: number | null; name: string | null; username: string }[] | null) ?? [])[0];
      const active = co?.status === 'active';
      const plan = active ? ((mp.data as { meals: MealPlan | null } | null)?.meals ?? null) : null;
      const planK = plan ? plan.meals.reduce((a, x) => a + (+x.k || 0), 0) : 0;
      const planP = plan ? plan.meals.reduce((a, x) => a + (+x.p || 0), 0) : 0;
      setCoach(active ? { name: co.name || co.username, link: co.id } : null);
      setCoachMeals(plan && plan.meals.length ? plan : null);
      // The coach's meal plan sets the day's calories and protein; otherwise the numbers the coach typed in.
      setCoachTargets(
        active && planK > 0 && planP > 0
          ? { kcal: Math.round(planK), protein: Math.round(planP), name: co.name || co.username }
          : active && co.kcal && co.protein
            ? { kcal: co.kcal, protein: co.protein, name: co.name || co.username }
            : null,
      );
      setReadyFor(userId);
    })();
    return () => {
      alive = false;
    };
  }, [userId, today, day, profile?.weight_kg]);

  const savePlan = useCallback(
    async (p: FoodPlan, done?: boolean) => {
      if (!userId) return false;
      setPlan(p);
      planRef.current = p;
      if (done !== undefined) setSetupDone(done);
      const { error } = await supabase
        .from('food_plans')
        .upsert({ user_id: userId, plan: p, ...(done !== undefined ? { setup_done: done } : {}) });
      return !error;
    },
    [userId],
  );

  // Small changes (meal swaps, shopping ticks) save quietly after a moment.
  const updatePlan = useCallback(
    (patch: Partial<FoodPlan>) => {
      const next = { ...planRef.current, ...patch };
      planRef.current = next;
      setPlan(next);
      clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        if (userId) supabase.from('food_plans').upsert({ user_id: userId, plan: next }).then(() => {});
      }, 600);
    },
    [userId],
  );

  const target = useMemo(() => {
    const base = targets(plan);
    if (!coachTargets) return base;
    return { k: coachTargets.kcal, p: coachTargets.protein, f: base.f, c: Math.max(0, Math.round((coachTargets.kcal - coachTargets.protein * 4 - base.f * 9) / 4)) };
  }, [plan, coachTargets]);
  const eaten = useMemo(
    () => logs.reduce((a, x) => ({ k: a.k + +x.kcal, p: a.p + +x.protein, c: a.c + +x.carbs, f: a.f + +x.fat }), { k: 0, p: 0, c: 0, f: 0 }),
    [logs],
  );
  const dayGoal = useCallback((day: string) => target.k + moves.filter((m) => m.day === day).reduce((a, m) => a + m.kcal, 0), [target.k, moves]);
  const water = useMemo(() => waterLogs.reduce((a, x) => a + x.ml, 0), [waterLogs]);
  const burned = cardio.reduce((a, x) => a + x.kcal, 0);
  const kcalLeft = dayGoal(day) + burned - eaten.k;

  const addLog = useCallback(
    async (l: NewLog, on?: string) => {
      const row = {
        day: on ?? day,
        // No meal picked: the one for this time of day (from your meal plan), or a snack.
        meal: l.meal ?? mealAt(planMeals(planRef.current), hhmmOf()),
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
      return data as FoodLog;
    },
    [day],
  );

  const deleteLog = useCallback(async (id: string) => {
    const removed = logsRef.current.find((x) => x.id === id) ?? null;
    setLogs((xs) => xs.filter((x) => x.id !== id));
    await supabase.from('food_logs').delete().eq('id', id);
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
    return true;
  }, []);

  const restoreLog = useCallback(async (l: FoodLog) => {
    const { id: _id, created_at: _c, ...rest } = l;
    const { data } = await supabase.from('food_logs').insert(rest).select('*').single();
    if (data) setLogs((xs) => [...xs, data as FoodLog].sort((a, b) => a.created_at.localeCompare(b.created_at)));
  }, []);

  const saveMeal = useCallback(async (m: NewSavedMeal) => {
    const { data } = await supabase.from('saved_meals').insert(m).select('*').single();
    if (data) setSaved((xs) => [data as SavedMeal, ...xs.filter((x) => x.id !== (data as SavedMeal).id)]);
    return (data as SavedMeal) ?? null;
  }, []);

  const addMealByCode = useCallback(async (code: string): Promise<{ status: 'ok' | 'not_found' | 'exists' | 'failed'; meal?: SavedMeal }> => {
    const { data, error } = await supabase.rpc('add_meal_by_code', { p_code: code });
    const r = data as { status: string; meal?: SavedMeal } | null;
    if (error || !r) return { status: 'failed' as const };
    if (r.status === 'ok' && r.meal) {
      const meal = { ...r.meal, kcal: +r.meal.kcal, protein: +r.meal.protein, carbs: +r.meal.carbs, fat: +r.meal.fat };
      setSaved((xs) => [meal, ...xs]);
      return { status: 'ok' as const, meal };
    }
    return { status: r.status === 'not_found' || r.status === 'exists' ? r.status : 'failed' };
  }, []);

  const deleteMeal = useCallback(async (id: string) => {
    setSaved((xs) => xs.filter((x) => x.id !== id));
    await supabase.from('saved_meals').delete().eq('id', id);
  }, []);

  const addMoves = useCallback(async (ms: { day: string; kcal: number }[]) => {
    const { data } = await supabase.from('calorie_moves').insert(ms).select('id,day,kcal');
    if (data) setMoves((xs) => [...xs, ...(data as Move[])]);
    return (data as Move[]) ?? [];
  }, []);

  const removeMoves = useCallback(async (ids: string[]) => {
    setMoves((xs) => xs.filter((x) => !ids.includes(x.id)));
    if (ids.length) await supabase.from('calorie_moves').delete().in('id', ids);
  }, []);

  const addWater = useCallback(
    async (ml: number, kind = 'Water', on?: string) => {
      const d = on ?? day;
      if (d !== day) {
        await supabase.from('water_logs').insert({ day: d, ml, kind });
        return;
      }
      const tmp: WaterLog = { id: `tmp-${Date.now()}`, ml, kind, created_at: new Date().toISOString() };
      setWaterLogs((xs) => [...xs, tmp]);
      const { data, error } = await supabase.from('water_logs').insert({ day: d, ml, kind }).select('id,ml,kind,created_at').single();
      setWaterLogs((xs) => (error || !data ? xs.filter((x) => x.id !== tmp.id) : xs.map((x) => (x.id === tmp.id ? (data as WaterLog) : x))));
    },
    [day],
  );

  const deleteWater = useCallback(async (id: string) => {
    let removed: WaterLog | null = null;
    setWaterLogs((xs) => {
      removed = xs.find((x) => x.id === id) ?? null;
      return xs.filter((x) => x.id !== id);
    });
    if (!id.startsWith('tmp-')) await supabase.from('water_logs').delete().eq('id', id);
    return removed;
  }, []);

  const addCardio = useCallback(
    async (c: Omit<Cardio, 'id' | 'created_at'>, on?: string) => {
      const d = on ?? day;
      const { data, error } = await supabase.from('cardio_logs').insert({ ...c, day: d }).select('id,kind,name,minutes,intensity,kcal,created_at').single();
      if (error || !data) return null;
      if (d === day) setCardio((xs) => [...xs, data as Cardio]);
      return data as Cardio;
    },
    [day],
  );

  const setSteps = useCallback(
    async (n: number) => {
      const v = Math.max(0, Math.min(200000, Math.round(n)));
      setStepsState(v);
      if (userId) await supabase.from('step_logs').upsert({ user_id: userId, day, steps: v });
    },
    [userId, day],
  );

  const deleteCardio = useCallback(async (id: string) => {
    setCardio((xs) => xs.filter((x) => x.id !== id));
    await supabase.from('cardio_logs').delete().eq('id', id);
  }, []);

  const value = useMemo<Food>(
    () => ({
      ready,
      today,
      day,
      setDay,
      isToday,
      setupDone,
      plan,
      person,
      draft,
      setDraft,
      savePlan,
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
      addCardio,
      deleteCardio,
      steps,
      setSteps,
      addWater,
      balance,
      openBalance,
      logOpen,
      setLogOpen,
      typeSeed,
      openTyping,
    }),
    [day, setDay, isToday, balance, logOpen, setLogOpen, typeSeed, openTyping, coach, coachMeals, addMealByCode, ready, today, setupDone, plan, person, draft, savePlan, updatePlan, logs, eaten, target, dayGoal, coachTargets, kcalLeft, addLog, deleteLog, setLogMeal, updateLog, restoreLog, saved, saveMeal, deleteMeal, moves, addMoves, removeMoves, water, waterLogs, deleteWater, cardio, burned, addCardio, deleteCardio, steps, setSteps, addWater],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useFood() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useFood must be used inside FoodProvider');
  return v;
}

/** Log food with an Undo toast; opens the balance sheet if this goes over today's calories. */
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
      // Landing up to 10% over still counts as closing the ring (celebrated instead), so the balance sheet waits until it's more.
      const max = food.dayGoal(food.day) + food.burned;
      const wayOver = food.eaten.k + item.kcal > max * 1.1;
      if (food.isToday && !wasOver && wayOver && food.kcalLeft - item.kcal < 0) setTimeout(() => food.openBalance('over'), 900);
      return row;
    },
    [food],
  );
}
