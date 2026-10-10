import { createContext, type PropsWithChildren, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { useAuth } from './auth';
import { addDays, ageFromIso, defaultPlan, type FoodPlan, localDay, type Macros, type Person, targets } from './nutrition';
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
};

export type Move = { id: string; day: string; kcal: number };

export type WaterLog = { id: string; ml: number; kind: string; created_at: string };

export type Cardio = { id: string; kind: 'Walk' | 'Run' | 'Bike' | 'Swim'; minutes: number; intensity: number; kcal: number; created_at: string };

export type NewLog = {
  name: string;
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
  today: string;
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
  /** Calories and protein set by your coach (they replace your own targets). */
  coachTargets: { kcal: number; protein: number; name: string } | null;
  kcalLeft: number;
  addLog: (l: NewLog) => Promise<FoodLog | null>;
  deleteLog: (id: string) => Promise<FoodLog | null>;
  restoreLog: (l: FoodLog) => Promise<void>;
  saved: SavedMeal[];
  saveMeal: (m: Omit<SavedMeal, 'id'>) => Promise<SavedMeal | null>;
  deleteMeal: (id: string) => Promise<void>;
  moves: Move[];
  addMoves: (m: { day: string; kcal: number }[]) => Promise<Move[]>;
  removeMoves: (ids: string[]) => Promise<void>;
  water: number;
  waterLogs: WaterLog[];
  deleteWater: (id: string) => Promise<WaterLog | null>;
  /** Cardio logged today. Its calories are added to today's budget. */
  cardio: Cardio[];
  burned: number;
  addCardio: (c: Omit<Cardio, 'id' | 'created_at'>) => Promise<Cardio | null>;
  deleteCardio: (id: string) => Promise<void>;
  /** Steps today (typed in, plus about 110 per minute of walking). */
  steps: number;
  setSteps: (n: number) => Promise<void>;
  addWater: (ml: number, kind?: string) => Promise<void>;
  /** Over/under balance sheet (shown above everything). */
  balance: 'over' | 'under' | null;
  openBalance: (k: 'over' | 'under' | null) => void;
  /** Log food sheet. */
  logOpen: boolean;
  setLogOpen: (v: boolean) => void;
};

const Ctx = createContext<Food | null>(null);

export function FoodProvider({ children }: PropsWithChildren) {
  const { session, profile } = useAuth();
  const userId = session?.user.id;
  const [today, setToday] = useState(localDay());
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
  const [logOpen, setLogOpen] = useState(false);
  const [coachTargets, setCoachTargets] = useState<Food['coachTargets']>(null);
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
      const [p, l, s, m, w, cd, st, mc] = await Promise.all([
        supabase.from('food_plans').select('*').eq('user_id', userId).maybeSingle(),
        supabase.from('food_logs').select('*').eq('day', today).order('created_at'),
        supabase.from('saved_meals').select('*').order('created_at', { ascending: false }),
        supabase.from('calorie_moves').select('id,day,kcal').gte('day', today).lte('day', weekEnd),
        supabase.from('water_logs').select('id,ml,kind,created_at').eq('day', today).order('created_at'),
        supabase.from('cardio_logs').select('id,kind,minutes,intensity,kcal,created_at').eq('day', today).order('created_at'),
        supabase.from('step_logs').select('steps').eq('day', today).maybeSingle(),
        supabase.rpc('my_coach'),
      ]);
      if (!alive) return;
      const base = defaultPlan(Number(profile?.weight_kg ?? 80));
      setPlan(p.data?.plan ? { ...base, ...(p.data.plan as FoodPlan) } : base);
      setSetupDone(!!p.data?.setup_done);
      setLogs((l.data as FoodLog[]) ?? []);
      setSaved((s.data as SavedMeal[]) ?? []);
      setMoves((m.data as Move[]) ?? []);
      setWaterLogs((w.data as WaterLog[]) ?? []);
      setCardio((cd.data as Cardio[]) ?? []);
      setStepsState((st.data as { steps: number } | null)?.steps ?? 0);
      const coach = ((mc.data as { status: string; kcal: number | null; protein: number | null; name: string | null; username: string }[] | null) ?? [])[0];
      setCoachTargets(coach?.status === 'active' && coach.kcal && coach.protein ? { kcal: coach.kcal, protein: coach.protein, name: coach.name || coach.username } : null);
      setReadyFor(userId);
    })();
    return () => {
      alive = false;
    };
  }, [userId, today, profile?.weight_kg]);

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
  const kcalLeft = dayGoal(today) + burned - eaten.k;

  const addLog = useCallback(
    async (l: NewLog) => {
      const row = {
        day: today,
        meal: l.meal ?? null,
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
      setLogs((xs) => [...xs, data as FoodLog]);
      return data as FoodLog;
    },
    [today],
  );

  const deleteLog = useCallback(async (id: string) => {
    const removed = logsRef.current.find((x) => x.id === id) ?? null;
    setLogs((xs) => xs.filter((x) => x.id !== id));
    await supabase.from('food_logs').delete().eq('id', id);
    return removed;
  }, []);

  const restoreLog = useCallback(async (l: FoodLog) => {
    const { id: _id, created_at: _c, ...rest } = l;
    const { data } = await supabase.from('food_logs').insert(rest).select('*').single();
    if (data) setLogs((xs) => [...xs, data as FoodLog].sort((a, b) => a.created_at.localeCompare(b.created_at)));
  }, []);

  const saveMeal = useCallback(async (m: Omit<SavedMeal, 'id'>) => {
    const { data } = await supabase.from('saved_meals').insert(m).select('*').single();
    if (data) setSaved((xs) => [data as SavedMeal, ...xs]);
    return (data as SavedMeal) ?? null;
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
    async (ml: number, kind = 'Water') => {
      const tmp: WaterLog = { id: `tmp-${Date.now()}`, ml, kind, created_at: new Date().toISOString() };
      setWaterLogs((xs) => [...xs, tmp]);
      const { data, error } = await supabase.from('water_logs').insert({ day: today, ml, kind }).select('id,ml,kind,created_at').single();
      setWaterLogs((xs) => (error || !data ? xs.filter((x) => x.id !== tmp.id) : xs.map((x) => (x.id === tmp.id ? (data as WaterLog) : x))));
    },
    [today],
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
    async (c: Omit<Cardio, 'id' | 'created_at'>) => {
      const { data, error } = await supabase.from('cardio_logs').insert({ ...c, day: today }).select('id,kind,minutes,intensity,kcal,created_at').single();
      if (error || !data) return null;
      setCardio((xs) => [...xs, data as Cardio]);
      return data as Cardio;
    },
    [today],
  );

  const setSteps = useCallback(
    async (n: number) => {
      const v = Math.max(0, Math.min(200000, Math.round(n)));
      setStepsState(v);
      if (userId) await supabase.from('step_logs').upsert({ user_id: userId, day: today, steps: v });
    },
    [userId, today],
  );

  const deleteCardio = useCallback(async (id: string) => {
    setCardio((xs) => xs.filter((x) => x.id !== id));
    await supabase.from('cardio_logs').delete().eq('id', id);
  }, []);

  const value = useMemo<Food>(
    () => ({
      ready,
      today,
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
      kcalLeft,
      addLog,
      deleteLog,
      restoreLog,
      saved,
      saveMeal,
      deleteMeal,
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
    }),
    [balance, logOpen, ready, today, setupDone, plan, person, draft, savePlan, updatePlan, logs, eaten, target, dayGoal, coachTargets, kcalLeft, addLog, deleteLog, restoreLog, saved, saveMeal, deleteMeal, moves, addMoves, removeMoves, water, waterLogs, deleteWater, cardio, burned, addCardio, deleteCardio, steps, setSteps, addWater],
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
      if (!wasOver && food.kcalLeft - item.kcal < 0) setTimeout(() => food.openBalance('over'), 900);
      return row;
    },
    [food],
  );
}
