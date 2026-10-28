import { useEffect, useState } from 'react';

import { type GoalRow, loadGoalRows } from './dayGoals';
import { useFood } from './food';
import type { Checkin, DayTotals, Measure } from './health';
import { loadDeviceDays } from './devices';
import { addDays } from './nutrition';
import { commitWindow, dayKcalGoal, goalsFor, type ProgressInput, sleepOn } from './progress';
import { WORDMARK } from '@/components/wordmark';

import { supabase } from './supabase';
import type { WorkoutLog } from './train';
import { useTrain } from './train';

export type ReportData = {
  days: Record<string, DayTotals>;
  logs: WorkoutLog[];
  checkins: Checkin[];
  weights: Measure[];
  waist: Measure[];
  /** Every tape measurement in the period (waist, chest, arms…), oldest first. */
  tape: Measure[];
  /** Cardio sessions in the period. */
  cardio: { day: string; name: string | null; minutes: number; kcal: number }[];
  /** Calories added to each day's goal (moved from other days, burned in cardio). */
  kcalExtra: Record<string, number>;
  /** Sleep from the watch by day, for nights without a check-in. */
  watchSleep: Record<string, number>;
  /** Each day's saved goals (oldest first), so earlier days are judged by the goals they had. */
  goals: GoalRow[];
};

/** Calories added to each day's goal between two days: calories moved to it and burned in cardio (as on the Food tab). */
export async function loadKcalExtras(from: string, to: string): Promise<Record<string, number>> {
  const [m, c] = await Promise.all([
    supabase.from('calorie_moves').select('day,kcal').gte('day', from).lte('day', to).limit(2000),
    supabase.from('cardio_logs').select('day,kcal').gte('day', from).lte('day', to).limit(2000),
  ]);
  const out: Record<string, number> = {};
  for (const r of [...((m.data as { day: string; kcal: number }[] | null) ?? []), ...((c.data as { day: string; kcal: number }[] | null) ?? [])]) out[r.day] = (out[r.day] ?? 0) + Number(r.kcal || 0);
  return out;
}

/** Watch sleep by day between two days. */
export async function loadWatchSleep(from: string, to: string): Promise<Record<string, number>> {
  const days = await loadDeviceDays(from).catch(() => []);
  return Object.fromEntries(days.filter((d) => d.day <= to && d.sleep_h != null && d.sleep_h > 0).map((d) => [d.day, d.sleep_h as number]));
}

/** Load everything between two days straight from the database (any range up to a year). */
/** The adro wordmark as inline SVG for PDFs (the same shapes as the in-app logo). */
function brandSvg() {
  const { cx, cy, r, stroke } = WORDMARK.ring;
  const C = 2 * Math.PI * r;
  return `<svg class="brand" viewBox="${WORDMARK.viewBox}" xmlns="http://www.w3.org/2000/svg"><path d="${WORDMARK.letters}" fill="#0A0A0B"/><circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#3355FF" stroke-width="${stroke}" stroke-linecap="round" stroke-dasharray="${C * 0.8} ${C}" transform="rotate(-90 ${cx} ${cy})"/></svg>`;
}

export function useReportData(from: string, to: string) {
  const key = `${from}|${to}`;
  const [state, setState] = useState<{ key: string; data: ReportData } | null>(null);
  useEffect(() => {
    if (from > to) return;
    let alive = true;
    (async () => {
      // Food and water come as one short row per day: the database sends at most 1000 rows, and single logs would go over it.
      const [f, l, c, m, cd, kcalExtra, watchSleep, goals] = await Promise.all([
        supabase.rpc('my_day_totals').gte('day', from).lte('day', to),
        supabase.from('workout_logs').select('*').gte('day', from).lte('day', to).order('day').limit(500),
        supabase.from('checkins').select('day,sleep_h,sleep_q,bed,wake,energy,sore,score').gte('day', from).lte('day', to).order('day'),
        supabase.from('measurements').select('day,kind,value').gte('day', from).lte('day', to).order('day').limit(2000),
        supabase.from('cardio_logs').select('day,name,minutes,kcal').gte('day', from).lte('day', to).order('day').limit(1000),
        loadKcalExtras(from, to).catch(() => ({})),
        loadWatchSleep(from, to),
        loadGoalRows(from, to),
      ]);
      if (!alive) return;
      const days: Record<string, DayTotals> = {};
      for (const r of (f.data as { day: string; kcal: number; protein: number; ml: number }[] | null) ?? []) days[r.day] = { k: Number(r.kcal), p: Number(r.protein), w: Number(r.ml) };
      const ms = ((m.data as Measure[]) ?? []).map((x) => ({ ...x, value: Number(x.value) }));
      setState({
        key: `${from}|${to}`,
        data: {
          days,
          logs: ((l.data as WorkoutLog[]) ?? []).map((x) => ({ ...x, volume: Number(x.volume) })),
          checkins: ((c.data as Checkin[]) ?? []).map((x) => ({ ...x, sleep_h: x.sleep_h == null ? null : Number(x.sleep_h) })),
          weights: ms.filter((x) => x.kind === 'weight'),
          waist: ms.filter((x) => x.kind === 'waist'),
          tape: ms.filter((x) => x.kind !== 'weight'),
          cardio: ((cd.data as ReportData['cardio'] | null) ?? []).map((x) => ({ ...x, minutes: Number(x.minutes || 0), kcal: Number(x.kcal || 0) })),
          kcalExtra,
          watchSleep,
          goals,
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
    kcalExtra: data.kcalExtra,
    watchSleep: data.watchSleep,
    goals: data.goals,
  };
  const first = [...Object.keys(data.days), ...data.logs.map((l) => l.day), ...data.checkins.map((c) => c.day), ...data.weights.map((w) => w.day)].sort()[0] ?? null;
  const cw = commitWindow(x, from, to, first);
  const n = daysBetween(from, to);
  const foodDays = Object.values(data.days).filter((d) => d.k > 0);
  // Goals counted over the days you logged that thing (a day you didn't log food isn't a missed calorie goal).
  // Today counts only once it's met (the day isn't over).
  const logged = { cal: [0, 0] as [number, number], prot: [0, 0] as [number, number], water: [0, 0] as [number, number] };
  const count = (k: keyof typeof logged, met: boolean, d: string) => {
    if (d === food.today && !met) return;
    logged[k][1]++;
    if (met) logged[k][0]++;
  };
  for (let d = from; d <= to; d = addDays(d, 1)) {
    const v = data.days[d];
    if (v && v.k > 0 && food.setupDone) {
      // That day's own goal (the goals it had, plus calories moved to or from it and burned in cardio).
      const goal = dayKcalGoal(x, d);
      count('cal', Math.abs(v.k - goal) <= goal * 0.1, d);
      count('prot', v.p >= goalsFor(x, d).protein * 0.9, d);
    }
    if (v && v.w > 0) count('water', v.w >= goalsFor(x, d).water, d);
  }
  // Nights you logged, or else what your watch measured.
  const sleeps: number[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) {
    const h = sleepOn(x, d);
    if (h != null) sleeps.push(h);
  }
  // The goals shown for the period: the ones its last day had.
  const endGoals = goalsFor(x, to);
  const w = data.weights;
  const prs = data.logs.flatMap((l) => l.prs ?? []);
  const lifts: Record<string, { id: string; n: string; a: number; b: number }> = {};
  for (const l of data.logs)
    for (const e of l.exercises) {
      const top = Math.max(0, ...e.sets.map((s) => s.w));
      if (!top) continue;
      const cur = (lifts[e.id] ??= { id: e.id, n: e.n, a: top, b: top });
      cur.b = top;
    }
  const liftUps = Object.values(lifts)
    .filter((v) => v.b > v.a)
    .sort((p, q) => q.b - q.a - (p.b - p.a))
    .slice(0, 3)
    .map((v) => ({ id: v.id, name: v.n, from: v.a, to: v.b }));
  // Every lift that went up, biggest jump first (the top 3 are liftUps).
  const allUps = Object.values(lifts)
    .filter((v) => v.b > v.a)
    .sort((p, q) => q.b - q.a - (p.b - p.a))
    .map((v) => ({ id: v.id, name: v.n, from: v.a, to: v.b }));
  const avg = (v: number[]) => (v.length ? Math.round((v.reduce((a, b) => a + b, 0) / v.length) * 10) / 10 : null);
  const ws = w.map((m) => m.value);
  const weeks = Math.max(1, daysBetween(w[0]?.day ?? from, w.at(-1)?.day ?? to) / 7);
  // Each measurement's first and last value in the period.
  const tape = [...new Set(data.tape.map((m) => m.kind))].map((k) => {
    const s = data.tape.filter((m) => m.kind === k);
    return { kind: k, first: s[0].value, last: s.at(-1)!.value, change: Math.round((s.at(-1)!.value - s[0].value) * 10) / 10, entries: s.length };
  });
  const feel = (k: 'energy' | 'sore') => [0, 1, 2].map((v) => data.checkins.filter((c) => c[k] === v).length) as [number, number, number];
  const scores = data.checkins.map((c) => c.score).filter((v): v is number => v != null && v > 0).map(Number);
  // Week by week (7 days each, from the first day).
  const weekRows: { from: string; to: string; kcal: number | null; protein: number | null; workouts: number; sleep: number | null; weight: number | null }[] = [];
  for (let d = from; d <= to; d = addDays(d, 7)) {
    const e = addDays(d, 6) < to ? addDays(d, 6) : to;
    const fd = Object.entries(data.days).filter(([k, v]) => k >= d && k <= e && v.k > 0).map(([, v]) => v);
    const sl: number[] = [];
    for (let i = d; i <= e; i = addDays(i, 1)) {
      const h = sleepOn(x, i);
      if (h != null) sl.push(h);
    }
    weekRows.push({
      from: d,
      to: e,
      kcal: fd.length ? Math.round(avg(fd.map((v) => v.k))!) : null,
      protein: fd.length ? Math.round(avg(fd.map((v) => v.p))!) : null,
      workouts: data.logs.filter((l) => l.day >= d && l.day <= e).length,
      sleep: avg(sl),
      weight: w.filter((m) => m.day >= d && m.day <= e).at(-1)?.value ?? null,
    });
  }
  const detail = {
    food: {
      daysLogged: foodDays.length,
      proteinAvg: foodDays.length ? Math.round(avg(foodDays.map((d) => d.p))!) : null,
      waterAvg: Object.values(data.days).filter((d) => d.w > 0).length ? Math.round(avg(Object.values(data.days).filter((d) => d.w > 0).map((d) => d.w))!) : null,
      waterGoal: Math.round(endGoals.water),
      lowest: foodDays.length ? Math.min(...foodDays.map((d) => d.k)) : null,
      highest: foodDays.length ? Math.max(...foodDays.map((d) => d.k)) : null,
    },
    train: {
      minutes: data.logs.reduce((a, l) => a + (l.minutes || 0), 0),
      sets: data.logs.reduce((a, l) => a + (l.sets_done || 0), 0),
      kcal: Math.round(data.logs.reduce((a, l) => a + Number(l.kcal || 0), 0)),
      list: data.logs.map((l) => ({ day: l.day, name: l.name, minutes: l.minutes, sets: l.sets_done, volume: Math.round(l.volume), prs: (l.prs ?? []).length })),
      prList: prs.map((p) => ({ id: p.id, name: p.n, w: p.w })),
      ups: allUps,
      cardio: { sessions: data.cardio.length, minutes: data.cardio.reduce((a, c) => a + c.minutes, 0), kcal: Math.round(data.cardio.reduce((a, c) => a + c.kcal, 0)) },
    },
    sleep: { min: sleeps.length ? Math.min(...sleeps) : null, max: sleeps.length ? Math.max(...sleeps) : null, energy: feel('energy'), sore: feel('sore'), recoveryAvg: scores.length ? Math.round(avg(scores)!) : null },
    body: { min: ws.length ? Math.min(...ws) : null, max: ws.length ? Math.max(...ws) : null, perWeek: ws.length > 1 ? Math.round(((ws.at(-1)! - ws[0]) / weeks) * 100) / 100 : null, entries: ws.length, tape },
    weeks: weekRows,
    commitParts: cw.parts,
  };
  return {
    detail,
    days: n,
    workouts: { done: data.logs.length, planned: cw.parts.work[1], asPlanned: cw.parts.work[0] },
    volume: Math.round(data.logs.reduce((a, l) => a + l.volume, 0)),
    weight: w.length ? { first: w[0].value, last: w.at(-1)!.value, change: Math.round((w.at(-1)!.value - w[0].value) * 10) / 10, series: w.map((m) => m.value) } : null,
    waistChange: data.waist.length > 1 ? Math.round((data.waist.at(-1)!.value - data.waist[0].value) * 10) / 10 : null,
    caloriesAvg: foodDays.length ? Math.round(foodDays.reduce((a, d) => a + d.k, 0) / foodDays.length) : null,
    calorieGoal: food.setupDone ? Math.round(endGoals.kcal) : null,
    proteinDays: cw.parts.prot,
    proteinGoal: food.setupDone ? Math.round(endGoals.protein) : null,
    waterDays: cw.parts.water,
    calDays: cw.parts.cal,
    logged,
    sleepAvg: sleeps.length ? Math.round((sleeps.reduce((a, b) => a + b, 0) / sleeps.length) * 10) / 10 : null,
    shortNights: sleeps.filter((h) => h < 6.5).length,
    sleepNights: sleeps.length,
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

// ---------------------------------------------------------------------------
// PDF reports
// ---------------------------------------------------------------------------
export { pdfIsPrint, sharePdf } from './pdf';

export const escHtml = (s: string) => s.replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch] as string);

/** The page around every Adro PDF: logo, title, date range, and a small note at the end. */
export function pdfPage(o: { lang: 'en' | 'ar'; title: string; sub: string; range: string; body: string; note: string }) {
  const dir = o.lang === 'ar' ? 'rtl' : 'ltr';
  return `<!doctype html><html dir="${dir}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escHtml(o.title)}</title><style>
    body{font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#0A0A0B;margin:32px}
    .top{display:flex;justify-content:space-between;align-items:center}.brand{height:22px;width:auto;display:block}
    h1{font-size:22px;margin:16px 0 4px}h2{font-size:15px;margin:22px 0 6px}.sub{color:#52525B;font-size:13px}.lbl{color:#52525B;font-size:12px;margin-top:18px}
    table{width:100%;border-collapse:collapse;margin-top:10px;font-size:14px}td{padding:8px 0;border-bottom:1px solid #E4E4E7;vertical-align:top}td:last-child{text-align:end;font-weight:600}
    h2{border-bottom:2px solid #0A0A0B;padding-bottom:4px;page-break-after:avoid}tr{page-break-inside:avoid}
    table.grid{font-size:12px}table.grid th{text-align:start;color:#52525B;font-weight:600;padding:6px 4px;border-bottom:1px solid #A1A1AA}table.grid td{padding:6px 4px;text-align:start;font-weight:400}table.grid td:first-child{white-space:nowrap}
    .ai{background:#F4F6FF;border-radius:12px;padding:4px 16px 12px;margin-top:18px}.ai h2{color:#3355FF;border:0}.ai ul{margin:6px 0;padding-inline-start:18px;font-size:13px}.ai li{margin:4px 0}.ai p{font-size:13px;margin:6px 0}
    .note{color:#52525B;font-size:11px;margin-top:24px}</style></head><body>
    <div class="top">${brandSvg()}<span class="sub">${escHtml(o.range)}</span></div>
    <h1>${escHtml(o.title)}</h1><div class="sub">${escHtml(o.sub)}</div>
    ${o.body}
    <div class="note">${escHtml(o.note)}</div></body></html>`;
}

// ---------------------------------------------------------------------------
// Saved coach summaries (so a report is written by the AI only once per period)
// ---------------------------------------------------------------------------
export type CoachSummary = { well: string[]; improve: string[]; focus: string };

export async function loadSavedReport(from: string, to: string, lang: 'en' | 'ar'): Promise<CoachSummary | null> {
  const { data } = await supabase.from('ai_reports').select('data').eq('from_day', from).eq('to_day', to).eq('lang', lang).maybeSingle();
  return (data as { data: CoachSummary } | null)?.data ?? null;
}

export async function saveReport(uid: string, from: string, to: string, lang: 'en' | 'ar', v: CoachSummary) {
  await supabase.from('ai_reports').upsert({ user_id: uid, from_day: from, to_day: to, lang, data: v, created_at: new Date().toISOString() });
}
