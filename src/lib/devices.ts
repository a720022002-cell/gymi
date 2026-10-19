// Phone health data (Apple Health on iPhone, Health Connect on Android), saved as one summary per day
// in "device_readings" so the web app and the coach can use it too. The phone-only parts live in healthSource.
import { useEffect, useSyncExternalStore } from 'react';

import { connectSource, nativeSource, readRaw } from './healthSource';
import { addDays, localDay } from './nutrition';
import { loadWearableDays, syncWearables, type WearableDay, wearableName, type WearableProvider, wearableStatus } from './wearables';
import { supabase } from './supabase';

export type DeviceSource = 'apple' | 'health_connect';
export type DeviceWorkout = { type: string; minutes: number; kcal: number };
export type DeviceHours = { steps: number[]; hr: (number | null)[] };
export type DeviceDay = {
  day: string;
  /** Where the day came from: the phone's health app, or a wearable linked directly (WHOOP, Oura). */
  source: DeviceSource | WearableProvider;
  steps: number | null;
  active_kcal: number | null;
  hr_avg: number | null;
  hr_rest: number | null;
  hrv: number | null;
  sleep_h: number | null;
  in_bed_h: number | null;
  sleep_eff: number | null;
  weight: number | null;
  vo2: number | null;
  workouts: DeviceWorkout[];
  hours: DeviceHours | null;
  /** WHOOP recovery or Oura readiness (0–100), when a wearable is linked. */
  recovery?: number | null;
  /** WHOOP strain (0–21) or Oura activity score; the wearable's sleep score; blood oxygen; skin temperature vs normal (°C). */
  strain?: number | null;
  sleep_score?: number | null;
  spo2?: number | null;
  temp_dev?: number | null;
  /** The linked wearable whose numbers are in this day. */
  wearable?: WearableProvider;
};
export type DevicePrefs = { source: DeviceSource | null; connected: boolean; card_order: string[]; last_sync: string | null };

/** Raw samples read from the phone, before they're summed into days. */
export type Span = { start: Date; end: Date; v: number };
export type Point = { t: Date; v: number };
export type RawHealth = {
  steps: Span[];
  kcal: Span[];
  hr: Point[];
  rest: Point[];
  hrv: Point[];
  /** kind: 'asleep' or 'bed' (in bed / awake in bed). */
  sleep: { start: Date; end: Date; kind: 'asleep' | 'bed' }[];
  weight: Point[];
  vo2: Point[];
  workouts: { start: Date; end: Date; type: string; kcal: number }[];
};

const COLS = 'day,source,steps,active_kcal,hr_avg,hr_rest,hrv,sleep_h,in_bed_h,sleep_eff,weight,vo2,workouts,hours';
const NUMS = ['steps', 'active_kcal', 'hr_avg', 'hr_rest', 'hrv', 'sleep_h', 'in_bed_h', 'sleep_eff', 'weight', 'vo2'] as const;
const EMPTY_PREFS: DevicePrefs = { source: null, connected: false, card_order: [], last_sync: null };

/** Which phone source this device can connect to (null on the web). */
export const phoneSource: DeviceSource | null = nativeSource;
export const sourceName = (s: DeviceSource | null) => (s === 'health_connect' ? 'Health Connect' : 'Apple Health');

// ---------------------------------------------------------------------------
// Summing samples into days
// ---------------------------------------------------------------------------
const r1 = (n: number) => Math.round(n * 10) / 10;
const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

/** Total length of the union of time spans, in hours. Overlapping watch + phone records count once. */
function unionHours(spans: { start: Date; end: Date }[]) {
  const s = spans.map((x) => [x.start.getTime(), x.end.getTime()] as const).filter(([a, b]) => b > a).sort((a, b) => a[0] - b[0]);
  let total = 0;
  let cur: [number, number] | null = null;
  for (const [a, b] of s) {
    if (!cur || a > cur[1]) {
      if (cur) total += cur[1] - cur[0];
      cur = [a, b];
    } else cur[1] = Math.max(cur[1], b);
  }
  if (cur) total += cur[1] - cur[0];
  return total / 36e5;
}

/** One summary per day (local time). Sleep counts on the day you woke up. */
export function buildDays(raw: RawHealth, days: string[], source: DeviceSource, today = localDay()): DeviceDay[] {
  return days.map((day) => {
    const on = (d: Date) => localDay(d) === day;
    const steps = raw.steps.filter((x) => on(x.start));
    const kcal = raw.kcal.filter((x) => on(x.start));
    const hr = raw.hr.filter((x) => on(x.t));
    const last = (ps: Point[]) => ps.filter((x) => on(x.t)).sort((a, b) => a.t.getTime() - b.t.getTime()).at(-1)?.v ?? null;
    const asleep = raw.sleep.filter((x) => x.kind === 'asleep' && on(x.end));
    const bed = raw.sleep.filter((x) => on(x.end));
    const sleepH = asleep.length ? unionHours(asleep) : null;
    const bedH = bed.length ? unionHours(bed) : null;
    const hrvs = raw.hrv.filter((x) => on(x.t)).map((x) => x.v);
    const workouts = raw.workouts
      .filter((w) => on(w.start))
      .map((w) => ({ type: w.type, minutes: Math.round((w.end.getTime() - w.start.getTime()) / 6e4), kcal: Math.round(w.kcal) }))
      .filter((w) => w.minutes > 0);
    const hourSteps = Array.from({ length: 24 }, () => 0);
    steps.forEach((x) => (hourSteps[x.start.getHours()] += x.v));
    const hourHr = Array.from({ length: 24 }, (_, h) => {
      const v = avg(hr.filter((x) => x.t.getHours() === h).map((x) => x.v));
      return v == null ? null : Math.round(v);
    });
    const hasHours = steps.length > 0 || hr.length > 0;
    const hrAvg = avg(hr.map((x) => x.v));
    return {
      day,
      source,
      steps: steps.length ? Math.round(steps.reduce((a, x) => a + x.v, 0)) : null,
      active_kcal: kcal.length ? Math.round(kcal.reduce((a, x) => a + x.v, 0)) : null,
      hr_avg: hrAvg == null ? null : Math.round(hrAvg),
      hr_rest: last(raw.rest) == null ? null : Math.round(last(raw.rest) as number),
      hrv: hrvs.length ? r1(avg(hrvs) as number) : null,
      sleep_h: sleepH == null ? null : Math.round(Math.min(24, sleepH) * 100) / 100,
      in_bed_h: bedH == null ? null : Math.round(Math.min(24, bedH) * 100) / 100,
      sleep_eff: sleepH && bedH ? Math.min(100, Math.round((sleepH / bedH) * 100)) : null,
      weight: last(raw.weight) == null ? null : r1(last(raw.weight) as number),
      vo2: last(raw.vo2) == null ? null : r1(last(raw.vo2) as number),
      workouts,
      hours: hasHours && day >= addDays(today, -6) ? { steps: hourSteps.map(Math.round), hr: hourHr } : null,
    };
  });
}

const hasData = (d: DeviceDay) => NUMS.some((k) => d[k] != null) || d.workouts.length > 0;

// ---------------------------------------------------------------------------
// Database
// ---------------------------------------------------------------------------
function clean(rows: Record<string, unknown>[] | null): DeviceDay[] {
  return (rows ?? []).map((r) => {
    const o = { ...r } as Record<string, unknown>;
    NUMS.forEach((k) => (o[k] = o[k] == null ? null : Number(o[k])));
    return o as DeviceDay;
  });
}

export async function loadDeviceDays(from: string): Promise<DeviceDay[]> {
  const [{ data }, wear] = await Promise.all([supabase.from('device_readings').select(COLS).gte('day', from).order('day'), loadWearableDays(from).catch(() => [] as WearableDay[])]);
  return mergeWearables(clean(data as Record<string, unknown>[] | null), wear);
}

/**
 * Days from a wearable linked directly go into the same days: its sleep, HRV and resting heart rate win (a ring or
 * band worn all night measures them better than a phone), and it fills steps, calories and workouts the phone
 * didn't have. A day only the wearable has becomes a day of its own.
 */
export function mergeWearables(days: DeviceDay[], wear: WearableDay[]): DeviceDay[] {
  if (!wear.length) return days;
  const byDay = new Map(days.map((d) => [d.day, { ...d }]));
  for (const w of wear) {
    const d: DeviceDay = byDay.get(w.day) ?? { day: w.day, source: w.provider, steps: null, active_kcal: null, hr_avg: null, hr_rest: null, hrv: null, sleep_h: null, in_bed_h: null, sleep_eff: null, weight: null, vo2: null, workouts: [], hours: null };
    // Two wearables on one day: the first one (in the order they come) keeps its numbers.
    const first = !d.wearable;
    const win = <K extends 'hrv' | 'hr_rest' | 'sleep_h' | 'in_bed_h' | 'sleep_eff'>(k: K, v: number | null) => {
      if (v != null && (first || d[k] == null)) d[k] = v;
    };
    win('hrv', w.hrv);
    win('hr_rest', w.hr_rest);
    win('sleep_h', w.sleep_h);
    win('in_bed_h', w.in_bed_h);
    win('sleep_eff', w.sleep_eff);
    if (d.steps == null && w.steps != null) d.steps = w.steps;
    if (d.active_kcal == null && w.active_kcal != null) d.active_kcal = w.active_kcal;
    if (d.hr_avg == null && w.hr_avg != null) d.hr_avg = w.hr_avg;
    if (!d.workouts.length && w.workouts.length) d.workouts = w.workouts;
    for (const k of ['recovery', 'strain', 'sleep_score', 'spo2', 'temp_dev'] as const) if (w[k] != null && (first || d[k] == null)) d[k] = w[k];
    if (first) d.wearable = w.provider;
    byDay.set(w.day, d);
  }
  return [...byDay.values()].sort((a, b) => a.day.localeCompare(b.day));
}

export type WatchCardio = { kind: 'Walk' | 'Run' | 'Bike' | 'Swim' | 'Other'; name: string | null; minutes: number; kcal: number };

/** What kind of cardio a workout from the watch is. Null: strength or an unnamed workout (those are logged in Gymi). */
export function cardioKind(type: string): WatchCardio['kind'] | 'skip' {
  const s = type.toLowerCase();
  if (/strength|weight|lift|functional|crossfit|powerlift|^workout$/.test(s)) return 'skip';
  if (/run|jog/.test(s)) return 'Run';
  if (/walk|hik/.test(s)) return 'Walk';
  if (/cycl|bik|spin/.test(s)) return 'Bike';
  if (/swim/.test(s)) return 'Swim';
  return 'Other';
}

/**
 * Cardio the watch recorded on a day, as cardio entries. One you also logged yourself (same kind, about the same
 * length) is left out, so it isn't counted twice.
 */
export function watchCardio(d: DeviceDay | undefined, logged: { kind: string; minutes: number }[]): WatchCardio[] {
  if (!d) return [];
  const left = [...logged];
  const out: WatchCardio[] = [];
  for (const w of d.workouts) {
    const kind = cardioKind(w.type);
    if (kind === 'skip' || w.minutes < 5) continue;
    const i = left.findIndex((l) => l.kind === kind && Math.abs(l.minutes - w.minutes) <= Math.max(10, w.minutes * 0.35));
    if (i >= 0) {
      left.splice(i, 1);
      continue;
    }
    out.push({ kind, name: kind === 'Other' ? w.type : null, minutes: Math.round(w.minutes), kcal: Math.round(w.kcal || 0) });
  }
  return out;
}

/**
 * Calories you moved off on a day beyond your usual (the watch's active calories over your 30-day average), less the
 * cardio already counted. Your calorie goal already includes a normal day's activity, so only the extra is added.
 * 0 until the watch has 7 days to know your usual; at most 600 a day.
 */
export function extraMoveKcal(days: DeviceDay[], day: string, cardioKcal: number): number {
  const today = days.find((d) => d.day === day)?.active_kcal;
  if (today == null) return 0;
  const before = days.filter((d) => d.day < day && d.day >= addDays(day, -30) && d.active_kcal != null).map((d) => d.active_kcal as number);
  if (before.length < 7) return 0;
  const usual = avg(before) as number;
  return Math.max(0, Math.min(600, Math.round(today - usual - cardioKcal)));
}

type Num = 'steps' | 'active_kcal' | 'hr_rest' | 'hrv' | 'sleep_h' | 'sleep_eff' | 'recovery' | 'strain' | 'sleep_score' | 'spo2' | 'temp_dev';
export type DeviceBrief = {
  sources: string[];
  /** Your normal: the average of the 30 days before today (needs 3 days or more). */
  usual30d: Partial<Record<Num, number>>;
  /** The newest day with night readings (sleep, HRV, resting heart rate, recovery). */
  latest: ({ day: string; source: string } & Partial<Record<Num, number>>) | null;
  /** Worked out from the readings: low = take it easy today, good = fine to push. */
  readiness: 'low' | 'ok' | 'good' | null;
  /** What stands out, in plain words, so the coach uses it instead of doing the maths. */
  signals: string[];
  last14Days: Record<string, unknown>[];
};

/**
 * What the coach needs from the watch, ring or band: where it comes from, your usual numbers, the newest night next
 * to them, the last 14 days, and what stands out. Null when nothing came from a device.
 */
export function deviceBrief(days: DeviceDay[], today = localDay()): DeviceBrief | null {
  const all = days.filter((d) => d.day <= today);
  if (!all.length) return null;
  const src = (d: DeviceDay) => (d.wearable ? wearableName(d.wearable) : d.source === 'apple' || d.source === 'health_connect' ? sourceName(d.source) : wearableName(d.source));
  const vals = (k: Num, xs: DeviceDay[]) => xs.map((d) => d[k]).filter((v): v is number => v != null);
  const base = all.filter((d) => d.day < today && d.day >= addDays(today, -30));
  const usual: Partial<Record<Num, number>> = {};
  for (const k of ['steps', 'active_kcal', 'hr_rest', 'hrv', 'sleep_h', 'sleep_eff', 'recovery', 'strain', 'sleep_score'] as Num[]) {
    const xs = vals(k, base);
    if (xs.length >= 3) usual[k] = k === 'steps' || k === 'active_kcal' ? Math.round(avg(xs) as number) : r1(avg(xs) as number);
  }
  const night = [...all].reverse().find((d) => d.day >= addDays(today, -1) && (d.hrv != null || d.hr_rest != null || d.sleep_h != null || d.recovery != null));
  const pick = (d: DeviceDay) => Object.fromEntries((['recovery', 'sleep_h', 'sleep_eff', 'sleep_score', 'hrv', 'hr_rest', 'spo2', 'temp_dev', 'strain', 'steps', 'active_kcal'] as Num[]).filter((k) => d[k] != null).map((k) => [k, d[k] as number]));
  const latest = night ? { day: night.day, source: src(night), ...pick(night) } : null;

  const signals: string[] = [];
  let low = 0;
  let good = 0;
  const pct = (v: number, u: number) => Math.round(((v - u) / u) * 100);
  if (night?.recovery != null) {
    const v = night.recovery;
    const whoop = night.wearable === 'whoop' || night.source === 'whoop';
    const zone = whoop ? (v >= 67 ? 'green' : v >= 34 ? 'yellow' : 'red') : v >= 85 ? 'optimal' : v >= 70 ? 'good' : 'pay attention';
    signals.push(`${src(night)} ${whoop ? 'recovery' : 'readiness'} ${v}% (${zone})${usual.recovery != null ? `, usual ${usual.recovery}%` : ''}`);
    if (whoop ? v < 34 : v < 70) low++;
    else if (whoop ? v >= 67 : v >= 85) good++;
  }
  if (night?.hrv != null && usual.hrv) {
    const p = pct(night.hrv, usual.hrv);
    if (p <= -15) {
      signals.push(`HRV ${night.hrv} ms is ${-p}% below usual (${usual.hrv} ms): the body is under strain (hard training, short sleep, illness, stress or a late heavy meal)`);
      low++;
    } else if (p >= 10) {
      signals.push(`HRV ${night.hrv} ms is ${p}% above usual (${usual.hrv} ms): well recovered`);
      good++;
    }
  }
  if (night?.hr_rest != null && usual.hr_rest) {
    const diff = Math.round(night.hr_rest - usual.hr_rest);
    if (diff >= 5) {
      signals.push(`Resting heart rate ${night.hr_rest} bpm is ${diff} above usual (${usual.hr_rest}): tired, getting sick, low on water or stressed`);
      low++;
    } else if (diff <= -3) good++;
  }
  if (night?.sleep_h != null) {
    if (night.sleep_h < 6) {
      signals.push(`Short sleep last night: ${r1(night.sleep_h)} h`);
      low++;
    } else if (night.sleep_h >= 7.5) good++;
  }
  const week = all.filter((d) => d.day >= addDays(today, -6));
  const short = week.filter((d) => d.sleep_h != null && d.sleep_h < 6).length;
  const wSleep = avg(vals('sleep_h', week));
  if (short >= 3) signals.push(`Slept under 6 h on ${short} of the last 7 nights (sleep debt)`);
  else if (wSleep != null && wSleep < 6.5) signals.push(`Sleep average this week ${r1(wSleep)} h`);
  if (night?.sleep_eff != null && night.sleep_eff < 80) signals.push(`Restless night: ${night.sleep_eff}% of time in bed asleep`);
  if (night?.spo2 != null && night.spo2 < 94) signals.push(`Blood oxygen at night ${night.spo2}% (low; if it keeps happening, see a doctor)`);
  if (night?.temp_dev != null && night.temp_dev >= 0.5) {
    signals.push(`Skin temperature +${r1(night.temp_dev)} °C above normal: could be getting sick (or the cycle phase)`);
    low++;
  }
  const yest = all.find((d) => d.day === addDays(today, -1));
  if (yest?.strain != null && (yest.wearable ?? yest.source) === 'whoop' && yest.strain >= 16) signals.push(`High strain yesterday: ${yest.strain} of 21`);
  const wSteps = avg(vals('steps', week.filter((d) => d.day < today)));
  if (wSteps != null && usual.steps) {
    const p = pct(wSteps, usual.steps);
    if (Math.abs(p) >= 25) signals.push(`Steps this week ${Math.round(wSteps)} a day, ${Math.abs(p)}% ${p < 0 ? 'less' : 'more'} than usual (${usual.steps})`);
  }
  const hasNight = !!night && (night.hrv != null || night.hr_rest != null || night.recovery != null || night.sleep_h != null);
  const readiness = !hasNight ? null : low >= 2 || (night?.recovery != null && low >= 1 && (night.wearable === 'whoop' ? night.recovery < 34 : night.recovery < 60)) ? 'low' : low === 0 && good >= 2 ? 'good' : 'ok';

  const last14Days = all
    .filter((d) => d.day >= addDays(today, -13))
    .map((d) => ({ day: d.day, source: src(d), ...pick(d), ...(d.workouts.length ? { workouts: d.workouts.map((w) => `${w.type} ${w.minutes} min${w.kcal ? `, ${w.kcal} kcal` : ''}`) } : {}) }));
  return { sources: [...new Set(all.slice(-30).map(src))], usual30d: usual, latest, readiness, signals, last14Days };
}

/** The same, read fresh (for the weekly recap and the weekly plan check). */
export async function loadDeviceBrief(): Promise<DeviceBrief | null> {
  return loadDeviceDays(addDays(localDay(), -44))
    .then((d) => deviceBrief(d))
    .catch(() => null);
}

export async function loadDevicePrefs(): Promise<DevicePrefs> {
  const { data } = await supabase.from('device_prefs').select('source,connected,card_order,last_sync').maybeSingle();
  return (data as DevicePrefs | null) ?? EMPTY_PREFS;
}

/**
 * The newest phone readings, for the recovery score and the coach: the last 7 days (newest last)
 * and the latest value of each reading. Empty when no device is connected.
 */
export async function latestDeviceReadings(): Promise<{ days: DeviceDay[]; today: DeviceDay | null; hrRestUsual: number | null; hrvUsual: number | null }> {
  const days = await loadDeviceDays(addDays(localDay(), -29));
  const week = days.filter((d) => d.day >= addDays(localDay(), -6));
  const usual = (k: 'hr_rest' | 'hrv') => {
    const xs = days.filter((d) => d.day < localDay() && d[k] != null).map((d) => d[k] as number);
    return xs.length >= 3 ? r1(avg(xs) as number) : null;
  };
  return { days: week, today: days.find((d) => d.day === localDay()) ?? null, hrRestUsual: usual('hr_rest'), hrvUsual: usual('hrv') };
}

// ---------------------------------------------------------------------------
// A small shared store so every screen sees the same data
// ---------------------------------------------------------------------------
type State = { uid: string | null; ready: boolean; prefs: DevicePrefs; days: DeviceDay[]; syncing: boolean };
let state: State = { uid: null, ready: false, prefs: EMPTY_PREFS, days: [], syncing: false };
const subs = new Set<() => void>();
const set = (patch: Partial<State>) => {
  state = { ...state, ...patch };
  subs.forEach((f) => f());
};
let loading: string | null = null;

async function load(uid: string) {
  if (loading === uid) return;
  loading = uid;
  const [prefs, days] = await Promise.all([loadDevicePrefs(), loadDeviceDays(addDays(localDay(), -59))]);
  set({ uid, ready: true, prefs, days });
  // Phones refresh by themselves at most every 30 minutes.
  if (phoneSource && prefs.connected && prefs.source === phoneSource && (!prefs.last_sync || Date.now() - new Date(prefs.last_sync).getTime() > 30 * 6e4)) syncDevice().catch(() => {});
  // Linked wearables (WHOOP, Oura) refresh at most every 3 hours, then the days load again.
  wearableStatus()
    .then(async (s) => {
      const due = (s?.links ?? []).some((l) => l.status === 'ok' && (!l.last_sync || Date.now() - new Date(l.last_sync).getTime() > 3 * 36e5));
      if (!due) return;
      await syncWearables();
      if (state.uid === uid) set({ days: await loadDeviceDays(addDays(localDay(), -59)) });
    })
    .catch(() => {});
}

async function savePrefs(patch: Partial<DevicePrefs>) {
  const prefs = { ...state.prefs, ...patch };
  set({ prefs });
  await supabase.from('device_prefs').upsert({ user_id: state.uid, ...prefs, updated_at: new Date().toISOString() });
}

/** Read the phone's health data for the last `n` days and save it. Returns how many days had data. */
export async function syncDevice(n = 7): Promise<number> {
  if (!phoneSource || !state.uid || state.syncing) return 0;
  set({ syncing: true });
  try {
    const today = localDay();
    const days = Array.from({ length: n }, (_, i) => addDays(today, i - (n - 1)));
    const raw = await readRaw(new Date(`${days[0]}T00:00:00`), new Date());
    const out = buildDays(raw, days, phoneSource, today).filter(hasData);
    if (out.length) await supabase.from('device_readings').upsert(out.map((d) => ({ user_id: state.uid, ...d, updated_at: new Date().toISOString() })));
    const keep = state.days.filter((d) => !out.some((o) => o.day === d.day));
    set({ days: [...keep, ...out].sort((a, b) => a.day.localeCompare(b.day)) });
    await savePrefs({ last_sync: new Date().toISOString() });
    return out.length;
  } finally {
    set({ syncing: false });
  }
}

/** Ask the phone for permission, then read the last month. */
export async function connectDevice(): Promise<'ok' | 'denied' | 'unavailable'> {
  if (!phoneSource) return 'unavailable';
  const r = await connectSource();
  if (r !== 'ok') return r;
  await savePrefs({ source: phoneSource, connected: true });
  await syncDevice(30).catch(() => 0);
  return 'ok';
}

export async function disconnectDevice() {
  await savePrefs({ connected: false });
}

/** Load the days again (after linking, syncing or disconnecting a wearable). */
export async function reloadDeviceDays() {
  if (!state.uid) return;
  const uid = state.uid;
  const days = await loadDeviceDays(addDays(localDay(), -59));
  if (state.uid === uid) set({ days });
}

export const saveCardOrder = (order: string[]) => savePrefs({ card_order: order });

/** Phone health data for the signed-in person: prefs, daily summaries, and actions. */
export function useDevices(uid: string | undefined) {
  const s = useSyncExternalStore(
    (f) => {
      subs.add(f);
      return () => subs.delete(f);
    },
    () => state,
    () => state,
  );
  useEffect(() => {
    if (uid && state.uid !== uid) load(uid).catch(() => {});
  }, [uid]);
  const mine = s.uid === uid;
  const days = mine ? s.days : [];
  const connected = mine && s.prefs.connected;
  return {
    ready: mine && s.ready,
    prefs: mine ? s.prefs : EMPTY_PREFS,
    connected,
    syncing: s.syncing,
    days,
    /** Data from a device exists (connected now or before). */
    hasData: days.length > 0,
    latest: days.at(-1) ?? null,
  };
}
