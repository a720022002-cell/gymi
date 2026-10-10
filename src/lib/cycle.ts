import { addDays } from './nutrition';
import { supabase } from './supabase';

export type CycleMode = 'track' | 'ttc' | 'preg' | 'post' | 'peri';
export type CycleSettings = { mode: CycleMode; cycle_len: number; period_len: number; preg_week: number | null; post_week: number | null };
export type Period = { id: string; start_day: string; end_day: string | null };
export type CycleLog = Record<string, string[]>;
export type Phase = 'Period' | 'Follicular' | 'Ovulation' | 'Luteal';

export const DEFAULT_CYCLE: CycleSettings = { mode: 'track', cycle_len: 28, period_len: 5, preg_week: null, post_week: null };

export const CY_MODES: Record<CycleMode, [string, string, string]> = {
  track: ['Track my cycle', 'Period, symptoms and how it affects training', 'cal'],
  ttc: ['Trying to get pregnant', 'Fertile window, ovulation and tips', 'heart'],
  preg: ['Pregnant', 'Week by week, with safe training', 'user'],
  post: ['After birth', 'Recovery and a safe return to training', 'body'],
  peri: ['Perimenopause', 'Irregular cycles, symptoms, strength and sleep', 'moon'],
};

export const CY_LOG: Record<string, string[]> = {
  Flow: ['Spotting', 'Light', 'Medium', 'Heavy'],
  Symptoms: ['Cramps', 'Headache', 'Bloating', 'Breast tenderness', 'Back pain', 'Acne', 'Nausea', 'Cravings', 'Fatigue', 'Hot flashes', 'Night sweats', 'Joint pain'],
  Mood: ['Calm', 'Happy', 'Energetic', 'Sensitive', 'Irritable', 'Anxious', 'Sad', 'Low motivation'],
  Energy: ['Low', 'Normal', 'High'],
  Training: ['Felt strong', 'Felt weak', 'Skipped workout', 'Light workout', 'Hit a PR'],
};
export const SINGLE = ['Flow', 'Energy'];

export const CY_PLAN: Record<Phase, { t: string; f: string; r: string }> = {
  Period: { t: 'Train as you feel. Light to normal sessions are fine and can ease cramps.', f: 'Iron-rich food helps: red meat, lentils, spinach with lemon.', r: 'Sleep and warmth help with cramps. Light movement beats full rest.' },
  Follicular: { t: 'Best time to push. Energy and strength are usually highest. Try for PRs.', f: 'Normal calories. Your body handles carbs well now.', r: 'Recovery is usually fastest in this phase.' },
  Ovulation: { t: 'Still strong. Warm up well; some women feel joints are a bit looser.', f: 'Normal calories, keep protein steady.', r: 'Normal recovery.' },
  Luteal: {
    t: 'Keep your weights, but drop a set if you feel tired. Skip PR attempts late in this phase.',
    f: 'Hunger can rise by 100 to 200 kcal. A bigger protein snack helps. Water weight of 0.5 to 2 kg is normal.',
    r: 'Lower energy and a higher resting heart rate are normal now. Sleep a bit more.',
  },
};

const diff = (a: string, b: string) => Math.round((new Date(`${b}T12:00:00`).getTime() - new Date(`${a}T12:00:00`).getTime()) / 864e5);

/** Average cycle and period length from your history (falls back to your settings). */
export function averages(periods: Period[], s: CycleSettings) {
  const starts = periods.map((p) => p.start_day).sort();
  const gaps: number[] = [];
  for (let i = 1; i < starts.length; i++) {
    const g = diff(starts[i - 1], starts[i]);
    if (g >= 18 && g <= 45) gaps.push(g);
  }
  const recent = gaps.slice(-6);
  const cycle = recent.length ? Math.round(recent.reduce((a, b) => a + b, 0) / recent.length) : s.cycle_len;
  const lens = periods.filter((p) => p.end_day).map((p) => diff(p.start_day, p.end_day as string) + 1).filter((n) => n >= 1 && n <= 10);
  const bleed = lens.length ? Math.round(lens.slice(-6).reduce((a, b) => a + b, 0) / Math.min(6, lens.length)) : s.period_len;
  const varies = recent.length > 1 ? Math.max(...recent) - Math.min(...recent) : null;
  return { cycle, bleed, varies, gaps };
}

/** Where you are today and what's next. */
export function cycleNow(periods: Period[], s: CycleSettings, today: string) {
  const sorted = [...periods].sort((a, b) => a.start_day.localeCompare(b.start_day));
  const last = sorted.filter((p) => p.start_day <= today).at(-1);
  const { cycle, bleed, varies } = averages(sorted, s);
  if (!last) return null;
  const day = diff(last.start_day, today) + 1;
  const ov = cycle - 14;
  const onPeriod = last.end_day ? today <= last.end_day : day <= bleed;
  const phase: Phase = onPeriod ? 'Period' : day < ov - 1 ? 'Follicular' : day <= ov + 1 ? 'Ovulation' : 'Luteal';
  const next = addDays(last.start_day, cycle);
  const ovDay = addDays(last.start_day, ov - 1);
  return { last, day, cycle, bleed, varies, phase, next, untilNext: diff(today, next), ovDay, fertileFrom: addDays(ovDay, -5), fertileTo: addDays(ovDay, 1), late: day > cycle + 2, open: !last.end_day };
}

/** What a calendar day looks like: period, expected period, fertile, ovulation. */
export function dayInfo(date: string, periods: Period[], s: CycleSettings, today: string) {
  const { cycle, bleed } = averages(periods, s);
  // A period with no end yet lasts your usual number of days, but never past today.
  const endOf = (p: Period) => {
    if (p.end_day) return p.end_day;
    const usual = addDays(p.start_day, bleed - 1);
    return usual < today ? usual : today;
  };
  const actual = periods.some((p) => date >= p.start_day && date <= endOf(p));
  const sorted = [...periods].sort((a, b) => a.start_day.localeCompare(b.start_day));
  const ref = sorted.filter((p) => p.start_day <= date).at(-1) ?? sorted.at(-1);
  if (!ref || date < sorted[0].start_day) return { period: actual, expected: false, fertile: false, ov: false };
  const d = diff(ref.start_day, date);
  const pos = ((d % cycle) + cycle) % cycle;
  const future = date > today;
  const ovPos = cycle - 15;
  return {
    period: actual,
    expected: future && !actual && pos < bleed && d >= cycle,
    fertile: pos >= ovPos - 5 && pos <= ovPos + 1,
    ov: pos === ovPos,
  };
}

export async function loadCycle(uid: string) {
  const [s, p, l] = await Promise.all([
    supabase.from('cycle_settings').select('mode,cycle_len,period_len,preg_week,post_week').eq('user_id', uid).maybeSingle(),
    supabase.from('cycle_periods').select('id,start_day,end_day').order('start_day'),
    supabase.from('cycle_logs').select('day,data').order('day', { ascending: false }).limit(120),
  ]);
  return {
    settings: (s.data as CycleSettings) ?? DEFAULT_CYCLE,
    periods: (p.data as Period[]) ?? [],
    logs: Object.fromEntries(((l.data as { day: string; data: CycleLog }[]) ?? []).map((x) => [x.day, x.data])) as Record<string, CycleLog>,
  };
}

export async function saveSettings(uid: string, s: CycleSettings) {
  const { error } = await supabase.from('cycle_settings').upsert({ user_id: uid, ...s, updated_at: new Date().toISOString() });
  return !error;
}
export async function startPeriod(day: string) {
  const { data, error } = await supabase.from('cycle_periods').upsert({ start_day: day }, { onConflict: 'user_id,start_day' }).select('id,start_day,end_day').single();
  return error ? null : (data as Period);
}
export async function endPeriod(id: string, day: string) {
  const { error } = await supabase.from('cycle_periods').update({ end_day: day }).eq('id', id);
  return !error;
}
export async function addPastPeriod(start: string, days: number) {
  const { error } = await supabase.from('cycle_periods').upsert({ start_day: start, end_day: addDays(start, Math.max(1, days) - 1) }, { onConflict: 'user_id,start_day' });
  return !error;
}
export async function deletePeriod(id: string) {
  const { error } = await supabase.from('cycle_periods').delete().eq('id', id);
  return !error;
}
export async function saveLog(day: string, data: CycleLog) {
  const empty = !Object.values(data).some((v) => v.length);
  const { error } = empty ? await supabase.from('cycle_logs').delete().eq('day', day) : await supabase.from('cycle_logs').upsert({ day, data }, { onConflict: 'user_id,day' });
  return !error;
}
export async function deleteAllCycle(uid: string) {
  await Promise.all([supabase.from('cycle_periods').delete().eq('user_id', uid), supabase.from('cycle_logs').delete().eq('user_id', uid), supabase.from('cycle_settings').delete().eq('user_id', uid)]);
}
