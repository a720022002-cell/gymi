// Phone health data (Apple Health on iPhone, Health Connect on Android), saved as one summary per day
// in "device_readings" so the web app and the coach can use it too. The phone-only parts live in healthSource.
import { useEffect, useSyncExternalStore } from 'react';

import { connectSource, nativeSource, readRaw } from './healthSource';
import { addDays, localDay } from './nutrition';
import { supabase } from './supabase';

export type DeviceSource = 'apple' | 'health_connect';
export type DeviceWorkout = { type: string; minutes: number; kcal: number };
export type DeviceHours = { steps: number[]; hr: (number | null)[] };
export type DeviceDay = {
  day: string;
  source: DeviceSource;
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
  const { data } = await supabase.from('device_readings').select(COLS).gte('day', from).order('day');
  return clean(data as Record<string, unknown>[] | null);
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
