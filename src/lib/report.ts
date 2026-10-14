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
      // Food and water come as one short row per day: the database sends at most 1000 rows, and single logs would go over it.
      const [f, l, c, m] = await Promise.all([
        supabase.rpc('my_day_totals').gte('day', from).lte('day', to),
        supabase.from('workout_logs').select('*').gte('day', from).lte('day', to).order('day').limit(500),
        supabase.from('checkins').select('day,sleep_h,sleep_q,bed,wake,energy,sore,score').gte('day', from).lte('day', to).order('day'),
        supabase.from('measurements').select('day,kind,value').in('kind', ['weight', 'waist']).gte('day', from).lte('day', to).order('day'),
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

/** The page around every Gymi PDF: logo, title, date range, and a small note at the end. */
export function pdfPage(o: { lang: 'en' | 'ar'; title: string; sub: string; range: string; body: string; note: string }) {
  const dir = o.lang === 'ar' ? 'rtl' : 'ltr';
  return `<!doctype html><html dir="${dir}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escHtml(o.title)}</title><style>
    body{font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#0A0A0B;margin:32px}
    .top{display:flex;justify-content:space-between;align-items:center}.brand{font-weight:700;font-size:20px;color:#3355FF}
    h1{font-size:22px;margin:16px 0 4px}h2{font-size:15px;margin:22px 0 6px}.sub{color:#52525B;font-size:13px}.lbl{color:#52525B;font-size:12px;margin-top:18px}
    table{width:100%;border-collapse:collapse;margin-top:10px;font-size:14px}td{padding:8px 0;border-bottom:1px solid #E4E4E7;vertical-align:top}td:last-child{text-align:end;font-weight:600}
    .note{color:#52525B;font-size:11px;margin-top:24px}</style></head><body>
    <div class="top"><span class="brand">gymi</span><span class="sub">${escHtml(o.range)}</span></div>
    <h1>${escHtml(o.title)}</h1><div class="sub">${escHtml(o.sub)}</div>
    ${o.body}
    <div class="note">${escHtml(o.note)}</div></body></html>`;
}

const rows = (xs: [string, string][]) => `<table>${xs.map(([k, v]) => `<tr><td>${escHtml(k)}</td><td>${escHtml(v)}</td></tr>`).join('')}</table>`;

type T = (s: string, v?: Record<string, string | number>) => string;
type CyclePeriod = { start_day: string; end_day: string | null };
type CycleInput = {
  t: T;
  lang: 'en' | 'ar';
  name: string;
  today: string;
  /** Your settings: usual cycle and period length. */
  settings: { cycle_len: number; period_len: number };
  periods: CyclePeriod[];
  /** Day → what was logged (Flow, Symptoms, Mood, ...). */
  logs: Record<string, Record<string, string[]>>;
  /** Optional notes to add at the end. */
  notes?: string;
  /** How many months back (default 6). */
  months?: number;
};

/**
 * Cycle health report for a doctor (design: "For your doctor"): cycle lengths, period days, symptoms and notes.
 * Share it with `sharePdf(html, 'Gymi cycle report.pdf')`.
 */
export function cycleReportHtml(x: CycleInput) {
  const { t, lang } = x;
  const from = addDays(x.today, -Math.round((x.months ?? 6) * 30.5));
  const diff = (a: string, b: string) => Math.round((new Date(`${b}T12:00:00`).getTime() - new Date(`${a}T12:00:00`).getTime()) / 864e5);
  const ps = [...x.periods].filter((p) => p.start_day >= addDays(from, -45)).sort((a, b) => a.start_day.localeCompare(b.start_day));
  const lens = ps.slice(1).map((p, i) => diff(ps[i].start_day, p.start_day)).filter((n) => n >= 10 && n <= 90);
  const bleeds = ps.filter((p) => p.end_day).map((p) => diff(p.start_day, p.end_day as string) + 1);
  const mean = (xs: number[]) => (xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : null);
  const avgCycle = mean(lens);
  const avgBleed = mean(bleeds);
  const varies = lens.length > 1 ? Math.max(...lens) - Math.min(...lens) : null;
  const date = (d: string) => new Intl.DateTimeFormat(lang === 'ar' ? 'ar-u-nu-latn' : 'en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(`${d}T12:00:00`));

  const summary = rows([
    [t('Average cycle'), avgCycle != null ? t('{n} days', { n: avgCycle }) : t('{n} days (your setting)', { n: x.settings.cycle_len })],
    [t('Average period'), avgBleed != null ? t('{n} days', { n: avgBleed }) : t('{n} days (your setting)', { n: x.settings.period_len })],
    [t('Cycle length varies by'), varies != null ? t('{n} days', { n: varies }) : '–'],
    [t('Cycles logged'), String(ps.length)],
  ]);
  const cycles = ps.length
    ? `<h2>${escHtml(t('Periods'))}</h2>${rows(
        ps
          .slice()
          .reverse()
          .map((p, i, arr) => {
            const next = arr[i - 1];
            const len = next ? diff(p.start_day, next.start_day) : null;
            const bl = p.end_day ? diff(p.start_day, p.end_day) + 1 : null;
            return [date(p.start_day), [bl != null ? t('Period {n} days', { n: bl }) : t('Period ongoing'), len != null ? t('cycle {n} days', { n: len }) : ''].filter(Boolean).join(', ')] as [string, string];
          }),
      )}`
    : '';
  const counts: Record<string, Record<string, number>> = {};
  Object.entries(x.logs)
    .filter(([d]) => d >= from && d <= x.today)
    .forEach(([, log]) =>
      Object.entries(log).forEach(([cat, vals]) => {
        if (cat === 'Training') return;
        vals.forEach((v) => ((counts[cat] ??= {})[v] = (counts[cat][v] ?? 0) + 1));
      }),
    );
  const symptoms = Object.keys(counts).length
    ? `<h2>${escHtml(t('Symptoms and how you felt'))}</h2>${rows(
        Object.entries(counts).map(([cat, vs]) => [
          t(cat),
          Object.entries(vs)
            .sort((a, b) => b[1] - a[1])
            .map(([v, n]) => `${t(v)} (${n})`)
            .join(', '),
        ]),
      )}`
    : '';
  const notes = x.notes?.trim() ? `<h2>${escHtml(t('Notes'))}</h2><p>${escHtml(x.notes.trim())}</p>` : '';
  return pdfPage({
    lang,
    title: t('{n}, cycle health report', { n: x.name }),
    sub: t('Last {n} months', { n: x.months ?? 6 }),
    range: `${date(from)} – ${date(x.today)}`,
    body: summary + cycles + symptoms + notes,
    note: t('Made with Gymi. Values are logged by the user. Not medical advice.'),
  });
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
