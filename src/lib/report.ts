import { useEffect, useState } from 'react';

import { useFood } from './food';
import type { Checkin, DayTotals, Measure } from './health';
import { addDays } from './nutrition';
import { commitWindow, type ProgressInput } from './progress';
import { supabase } from './supabase';
import type { WorkoutLog } from './train';
import { useTrain } from './train';

export type ReportData = { days: Record<string, DayTotals>; logs: WorkoutLog[]; checkins: Checkin[]; weights: Measure[]; waist: Measure[] };

/** Load everything between two days straight from the database (any range up to a year). */
export function useReportData(from: string, to: string) {
  const key = `${from}|${to}`;
  const [state, setState] = useState<{ key: string; data: ReportData } | null>(null);
  useEffect(() => {
    if (from > to) return;
    let alive = true;
    (async () => {
      const [f, w, l, c, m] = await Promise.all([
        supabase.from('food_logs').select('day,kcal,protein').gte('day', from).lte('day', to).limit(10000),
        supabase.from('water_logs').select('day,ml').gte('day', from).lte('day', to).limit(10000),
        supabase.from('workout_logs').select('*').gte('day', from).lte('day', to).order('day').limit(500),
        supabase.from('checkins').select('day,sleep_h,sleep_q,bed,wake,energy,sore,score').gte('day', from).lte('day', to).order('day'),
        supabase.from('measurements').select('day,kind,value').in('kind', ['weight', 'waist']).gte('day', from).lte('day', to).order('day'),
      ]);
      if (!alive) return;
      const days: Record<string, DayTotals> = {};
      for (const r of (f.data as { day: string; kcal: number; protein: number }[]) ?? []) {
        const x = (days[r.day] ??= { k: 0, p: 0, w: 0 });
        x.k += Number(r.kcal);
        x.p += Number(r.protein);
      }
      for (const r of (w.data as { day: string; ml: number }[]) ?? []) (days[r.day] ??= { k: 0, p: 0, w: 0 }).w += r.ml;
      const ms = ((m.data as Measure[]) ?? []).map((x) => ({ ...x, value: Number(x.value) }));
      setState({
        key: `${from}|${to}`,
        data: {
          days,
          logs: ((l.data as WorkoutLog[]) ?? []).map((x) => ({ ...x, volume: Number(x.volume) })),
          checkins: ((c.data as Checkin[]) ?? []).map((x) => ({ ...x, sleep_h: x.sleep_h == null ? null : Number(x.sleep_h) })),
          weights: ms.filter((x) => x.kind === 'weight'),
          waist: ms.filter((x) => x.kind === 'waist'),
        },
      });
    })();
    return () => {
      alive = false;
    };
  }, [from, to]);
  return state?.key === key ? state.data : null;
}

export const daysBetween = (a: string, b: string) => Math.round((new Date(`${b}T12:00:00`).getTime() - new Date(`${a}T12:00:00`).getTime()) / 864e5) + 1;

/** The numbers a report shows (and sends to the AI). */
export function useReportStats(from: string, to: string, data: ReportData | null) {
  const food = useFood();
  const train = useTrain();
  if (!data) return null;
  const x: ProgressInput = {
    today: food.today,
    days: data.days,
    logs: data.logs,
    checkins: data.checkins,
    measures: data.weights,
    plan: train.setupDone ? train.plan : null,
    foodSetup: food.setupDone,
    kcal: food.target.k,
    protein: food.target.p,
    water: food.plan.water || 2800,
    goal: food.plan.goal,
  };
  const first = [...Object.keys(data.days), ...data.logs.map((l) => l.day), ...data.checkins.map((c) => c.day), ...data.weights.map((w) => w.day)].sort()[0] ?? null;
  const cw = commitWindow(x, from, to, first);
  const n = daysBetween(from, to);
  const foodDays = Object.values(data.days).filter((d) => d.k > 0);
  const sleeps = data.checkins.filter((c) => c.sleep_h != null).map((c) => c.sleep_h as number);
  const w = data.weights;
  const prs = data.logs.flatMap((l) => l.prs ?? []);
  const lifts: Record<string, { n: string; a: number; b: number }> = {};
  for (const l of data.logs)
    for (const e of l.exercises) {
      const top = Math.max(0, ...e.sets.map((s) => s.w));
      if (!top) continue;
      const cur = (lifts[e.id] ??= { n: e.n, a: top, b: top });
      cur.b = top;
    }
  const liftUps = Object.values(lifts)
    .filter((v) => v.b > v.a)
    .sort((p, q) => q.b - q.a - (p.b - p.a))
    .slice(0, 3)
    .map((v) => ({ name: v.n, from: v.a, to: v.b }));
  return {
    days: n,
    workouts: { done: data.logs.length, planned: cw.parts.work[1], asPlanned: cw.parts.work[0] },
    volume: Math.round(data.logs.reduce((a, l) => a + l.volume, 0)),
    weight: w.length ? { first: w[0].value, last: w.at(-1)!.value, change: Math.round((w.at(-1)!.value - w[0].value) * 10) / 10, series: w.map((m) => m.value) } : null,
    waistChange: data.waist.length > 1 ? Math.round((data.waist.at(-1)!.value - data.waist[0].value) * 10) / 10 : null,
    caloriesAvg: foodDays.length ? Math.round(foodDays.reduce((a, d) => a + d.k, 0) / foodDays.length) : null,
    calorieGoal: food.setupDone ? Math.round(food.target.k) : null,
    proteinDays: cw.parts.prot,
    proteinGoal: food.setupDone ? Math.round(food.target.p) : null,
    waterDays: cw.parts.water,
    calDays: cw.parts.cal,
    sleepAvg: sleeps.length ? Math.round((sleeps.reduce((a, b) => a + b, 0) / sleeps.length) * 10) / 10 : null,
    shortNights: sleeps.filter((h) => h < 6.5).length,
    prs: prs.length,
    liftUps,
    commitment: cw.pct,
    goal: ['fast bulk', 'moderate bulk', 'maintain', 'fast cut', 'moderate cut'][food.plan.goal] ?? 'maintain',
  };
}

export type ReportStats = NonNullable<ReturnType<typeof useReportStats>>;

/** Range for week, month or custom. */
export function reportRange(mode: 'week' | 'month' | 'custom', today: string, from: string, to: string) {
  if (mode === 'week') return { a: addDays(today, -6), b: today };
  if (mode === 'month') return { a: addDays(today, -29), b: today };
  return { a: from, b: to };
}
