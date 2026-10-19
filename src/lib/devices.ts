// Phone health data (Apple Health on iPhone, Health Connect on Android), saved as one summary per day
// in "device_readings" so the web app and the coach can use it too. The phone-only parts live in healthSource.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useSyncExternalStore } from 'react';

import { startBackgroundSync, stopBackgroundSync } from './backgroundSync';
import { connectSource, type HealthItem, nativeSource, readHeartRate, readRaw, removeHealth, writeHealth } from './healthSource';
import { addDays, localDay } from './nutrition';
import { loadWearableDays, syncWearables, type WearableDay, wearableName, type WearableProvider, wearableStatus } from './wearables';
import { supabase } from './supabase';

export type DeviceSource = 'apple' | 'health_connect';
export type DeviceWorkout = { type: string; minutes: number; kcal: number; /** Heart rate during it, when the watch measured it. */ avg_hr?: number | null; max_hr?: number | null };
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
  /** Body fat (%), deep and REM sleep (hours), when you fell asleep (minutes from midnight, negative before it). */
  body_fat?: number | null;
  deep_h?: number | null;
  rem_h?: number | null;
  bed_min?: number | null;
  /** Breaths per minute and wrist temperature while asleep (°C). Blood oxygen and skin temperature change are below. */
  resp_rate?: number | null;
  wrist_temp?: number | null;
  /**
   * Period flow logged in the health app (0 unknown … 3 heavy). Only in memory after a sync, never saved on our
   * server: it goes straight into cycle tracking, which may be kept on this phone only.
   */
  period?: number | null;
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
export type DevicePrefs = { source: DeviceSource | null; connected: boolean; card_order: string[]; last_sync: string | null; /** Gymi also writes its workouts, meals, water and weight to the phone's health app. */ write_back?: boolean; /** Whose sleep and heart readings win when two devices send them. */ primary?: DevicePrimary };
export type DevicePrimary = 'auto' | 'phone' | WearableProvider;

/** Raw samples read from the phone, before they're summed into days. */
export type Span = { start: Date; end: Date; v: number };
export type Point = { t: Date; v: number };
export type RawHealth = {
  steps: Span[];
  kcal: Span[];
  hr: Point[];
  rest: Point[];
  hrv: Point[];
  /** kind: 'asleep' or 'bed' (in bed / awake in bed); stage when the watch tells sleep stages apart. */
  sleep: { start: Date; end: Date; kind: 'asleep' | 'bed'; stage?: 'deep' | 'rem' | 'core' }[];
  weight: Point[];
  /** Body fat, %. */
  bodyFat: Point[];
  vo2: Point[];
  /** Breaths per minute (while asleep on a watch). */
  resp: Point[];
  /** Blood oxygen, %. */
  spo2: Point[];
  /** Apple Watch wrist temperature while asleep, °C. */
  wristTemp: Point[];
  /** Health Connect skin temperature: change from your baseline, °C. */
  tempDev: Point[];
  /** Period days logged in the health app: v = flow, 0 spotting/unknown, 1 light, 2 medium, 3 heavy. */
  period: Point[];
  workouts: { start: Date; end: Date; type: string; kcal: number }[];
};

export const EMPTY_RAW = (): RawHealth => ({ steps: [], kcal: [], hr: [], rest: [], hrv: [], sleep: [], weight: [], bodyFat: [], vo2: [], resp: [], spo2: [], wristTemp: [], tempDev: [], period: [], workouts: [] });

const COLS = 'day,source,steps,active_kcal,hr_avg,hr_rest,hrv,sleep_h,in_bed_h,sleep_eff,weight,vo2,workouts,hours,body_fat,deep_h,rem_h,bed_min,resp_rate,spo2,wrist_temp,temp_dev';
const NUMS = ['steps', 'active_kcal', 'hr_avg', 'hr_rest', 'hrv', 'sleep_h', 'in_bed_h', 'sleep_eff', 'weight', 'vo2', 'body_fat', 'deep_h', 'rem_h', 'bed_min', 'resp_rate', 'spo2', 'wrist_temp', 'temp_dev'] as const;
const EMPTY_PREFS: DevicePrefs = { source: null, connected: false, card_order: [], last_sync: null, write_back: false };

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
      .map((w) => {
        // Heart rate during the workout, from the watch's samples in that window.
        const bpm = raw.hr.filter((x) => x.t >= w.start && x.t <= w.end).map((x) => x.v);
        const hrOk = bpm.length >= 5;
        return { type: w.type, minutes: Math.round((w.end.getTime() - w.start.getTime()) / 6e4), kcal: Math.round(w.kcal), ...(hrOk ? { avg_hr: Math.round(avg(bpm) as number), max_hr: Math.round(Math.max(...bpm)) } : {}) };
      })
      .filter((w) => w.minutes > 0);
    const hourSteps = Array.from({ length: 24 }, () => 0);
    steps.forEach((x) => (hourSteps[x.start.getHours()] += x.v));
    const hourHr = Array.from({ length: 24 }, (_, h) => {
      const v = avg(hr.filter((x) => x.t.getHours() === h).map((x) => x.v));
      return v == null ? null : Math.round(v);
    });
    const hasHours = steps.length > 0 || hr.length > 0;
    const hrAvg = avg(hr.map((x) => x.v));
    // Sleep stages and when you fell asleep (the night that ended this morning).
    const staged = (st: 'deep' | 'rem') => asleep.filter((x) => x.stage === st);
    const deep = staged('deep');
    const rem = staged('rem');
    const fellAsleep = asleep.length ? new Date(Math.min(...asleep.map((x) => x.start.getTime()))) : null;
    const bedMin = fellAsleep ? (() => {
      const m = fellAsleep.getHours() * 60 + fellAsleep.getMinutes();
      return m > 720 ? m - 1440 : m;
    })() : null;
    const mean = (ps: Point[], dec = 1) => {
      const v = avg(ps.filter((x) => on(x.t)).map((x) => x.v));
      return v == null ? null : Math.round(v * 10 ** dec) / 10 ** dec;
    };
    const flow = raw.period.filter((x) => on(x.t)).map((x) => x.v);
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
      body_fat: last(raw.bodyFat) == null ? null : r1(last(raw.bodyFat) as number),
      deep_h: deep.length ? Math.round(unionHours(deep) * 100) / 100 : null,
      rem_h: rem.length ? Math.round(unionHours(rem) * 100) / 100 : null,
      bed_min: bedMin,
      resp_rate: mean(raw.resp),
      spo2: mean(raw.spo2),
      wrist_temp: mean(raw.wristTemp, 2),
      temp_dev: mean(raw.tempDev, 2),
      period: flow.length ? Math.max(...flow) : null,
    };
  });
}

const hasData = (d: DeviceDay) => NUMS.some((k) => d[k] != null) || d.workouts.length > 0 || d.period != null;

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

export async function loadDeviceDays(from: string, primary: DevicePrimary = state.prefs.primary ?? 'auto'): Promise<DeviceDay[]> {
  const [{ data }, wear] = await Promise.all([supabase.from('device_readings').select(COLS).gte('day', from).order('day'), loadWearableDays(from).catch(() => [] as WearableDay[])]);
  return mergeWearables(clean(data as Record<string, unknown>[] | null), wear, primary);
}

/**
 * Days from a wearable linked directly go into the same days: its sleep, HRV and resting heart rate win (a ring or
 * band worn all night measures them better than a phone), and it fills steps, calories and workouts the phone
 * didn't have. A day only the wearable has becomes a day of its own.
 */
export function mergeWearables(days: DeviceDay[], wear: WearableDay[], primary: DevicePrimary = 'auto'): DeviceDay[] {
  if (!wear.length) return days;
  const byDay = new Map(days.map((d) => [d.day, { ...d }]));
  // The main wearable you picked goes first, so its numbers win. Otherwise the same order every day (made for
  // all-night wear first), so one night isn't from one device and the next from another.
  const rank = (p: string) => (p === primary ? -1 : ['whoop', 'oura', 'polar'].indexOf(p));
  const ordered = [...wear].sort((x, y) => rank(x.provider) - rank(y.provider));
  for (const w of ordered) {
    const d: DeviceDay = byDay.get(w.day) ?? { day: w.day, source: w.provider, steps: null, active_kcal: null, hr_avg: null, hr_rest: null, hrv: null, sleep_h: null, in_bed_h: null, sleep_eff: null, weight: null, vo2: null, workouts: [], hours: null };
    // Two wearables on one day: the first one (in the order above) keeps its numbers. With the phone as your main
    // device, a wearable only fills in what the phone didn't send.
    const firstWear = !d.wearable;
    const first = firstWear && primary !== 'phone';
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
    if (firstWear) d.wearable = w.provider;
    byDay.set(w.day, d);
  }
  return [...byDay.values()].sort((a, b) => a.day.localeCompare(b.day));
}

export type WatchCardio = { kind: 'Walk' | 'Run' | 'Bike' | 'Swim' | 'Other'; name: string | null; minutes: number; kcal: number; avg_hr?: number | null; max_hr?: number | null };

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
    out.push({ kind, name: kind === 'Other' ? w.type : null, minutes: Math.round(w.minutes), kcal: Math.round(w.kcal || 0), avg_hr: w.avg_hr ?? null, max_hr: w.max_hr ?? null });
  }
  return out;
}

/** Your highest heart rate, estimated from age (Tanaka: 208 − 0.7 × age). */
export const maxHeartRate = (age: number) => Math.round(208 - 0.7 * age);

/** Heart rate zone 1–5 for an average heart rate (share of your highest: under 60%, 60–70, 70–80, 80–90, over 90). */
export function hrZone(avgHr: number, age: number) {
  const pct = avgHr / maxHeartRate(age);
  return pct < 0.6 ? 1 : pct < 0.7 ? 2 : pct < 0.8 ? 3 : pct < 0.9 ? 4 : 5;
}

/**
 * How hard a cardio session was on the body (Banister TRIMP): minutes, weighted by how high the heart rate was
 * between resting and highest. About 50 for 45 minutes in zone 2, about 140 for an hour hard.
 */
export function trimp(minutes: number, avgHr: number, restHr: number, maxHr: number, female: boolean) {
  const r = Math.max(0, Math.min(1, (avgHr - restHr) / Math.max(20, maxHr - restHr)));
  return minutes * r * (female ? 0.86 * Math.exp(1.67 * r) : 0.64 * Math.exp(1.92 * r));
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

type Num = 'steps' | 'active_kcal' | 'hr_rest' | 'hrv' | 'sleep_h' | 'sleep_eff' | 'recovery' | 'strain' | 'sleep_score' | 'spo2' | 'temp_dev' | 'deep_h' | 'rem_h' | 'bed_min' | 'resp_rate' | 'wrist_temp' | 'vo2' | 'body_fat' | 'weight';
/** Last night's deep and REM sleep, and your usual bedtime with how much it moves (14 nights). */
export function sleepDetail(days: DeviceDay[], today = localDay()) {
  const last = [...days].reverse().find((d) => d.day <= today && d.day >= addDays(today, -1) && (d.deep_h != null || d.rem_h != null || d.bed_min != null));
  const two = days.filter((d) => d.day <= today && d.day > addDays(today, -14));
  const beds = two.map((d) => d.bed_min).filter((v): v is number => v != null);
  const mean = beds.length ? beds.reduce((a, v) => a + v, 0) / beds.length : null;
  const spread = beds.length >= 5 && mean != null ? Math.sqrt(beds.reduce((a, v) => a + (v - mean) ** 2, 0) / beds.length) : null;
  const week = (k: 'deep_h' | 'rem_h') => avg(two.filter((d) => d.day > addDays(today, -7) && d[k] != null).map((d) => d[k] as number));
  if (!last && mean == null) return null;
  return { deep: last?.deep_h ?? null, rem: last?.rem_h ?? null, deepWeek: week('deep_h'), remWeek: week('rem_h'), bedUsual: mean == null ? null : Math.round(mean), bedSpread: spread == null ? null : Math.round(spread) };
}

/**
 * Early signs of getting sick, from last night against your usual: temperature up, breathing faster, resting heart
 * rate up, HRV down, low blood oxygen. Two or more together, one of them temperature, breathing or oxygen (or very
 * low oxygen alone), is worth a warning. Null otherwise.
 */
export function illnessCheck(days: DeviceDay[], today = localDay()): { reasons: string[]; keys: string[] } | null {
  const night = days.find((d) => d.day === today);
  if (!night) return null;
  const before = days.filter((d) => d.day < today && d.day >= addDays(today, -30));
  const usual = (k: 'wrist_temp' | 'resp_rate' | 'hr_rest' | 'hrv') => {
    const xs = before.map((d) => d[k]).filter((v): v is number => v != null);
    return xs.length >= 5 ? (avg(xs) as number) : null;
  };
  const keys: string[] = [];
  const reasons: string[] = [];
  const add = (key: string, why: string) => {
    keys.push(key);
    reasons.push(why);
  };
  const tUsual = usual('wrist_temp');
  const tUp = night.temp_dev != null ? night.temp_dev : night.wrist_temp != null && tUsual != null ? night.wrist_temp - tUsual : null;
  if (tUp != null && tUp >= 0.5) add('temp', `temperature +${r1(tUp)} °C`);
  const rUsual = usual('resp_rate');
  if (night.resp_rate != null && rUsual != null && night.resp_rate - rUsual >= 2) add('resp', `breathing ${r1(night.resp_rate)} a minute (usual ${r1(rUsual)})`);
  const hUsual = usual('hr_rest');
  if (night.hr_rest != null && hUsual != null && night.hr_rest - hUsual >= 5) add('rhr', `resting heart rate +${Math.round(night.hr_rest - hUsual)}`);
  const vUsual = usual('hrv');
  if (night.hrv != null && vUsual && night.hrv / vUsual <= 0.85) add('hrv', `HRV ${Math.round((1 - night.hrv / vUsual) * 100)}% under usual`);
  if (night.spo2 != null && night.spo2 < 94) add('spo2', `blood oxygen ${r1(night.spo2)}%`);
  const veryLow = night.spo2 != null && night.spo2 < 90;
  // Resting heart rate up and HRV down alone are as likely from hard training or a short night (that's readiness);
  // getting sick needs a body sign too: temperature, breathing or oxygen.
  const bodySign = keys.some((k) => k === 'temp' || k === 'resp' || k === 'spo2');
  return (keys.length >= 2 && bodySign) || veryLow ? { reasons, keys } : null;
}

/** Your VO2 max against people your age and sex (about; from common fitness norms). */
export function vo2Level(vo2: number, age: number, female: boolean): 'Low' | 'Fair' | 'Good' | 'Excellent' | 'Superior' {
  const men = [[36, 41, 45, 52], [34, 39, 43, 49], [32, 36, 41, 46], [29, 33, 38, 43], [26, 30, 35, 40]];
  const women = [[30, 34, 39, 45], [28, 32, 37, 42], [26, 30, 35, 40], [24, 27, 32, 37], [21, 24, 29, 34]];
  const cut = (female ? women : men)[Math.max(0, Math.min(4, Math.floor((age - 20) / 10)))];
  return vo2 >= cut[3] ? 'Superior' : vo2 >= cut[2] ? 'Excellent' : vo2 >= cut[1] ? 'Good' : vo2 >= cut[0] ? 'Fair' : 'Low';
}

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
  for (const k of ['steps', 'active_kcal', 'hr_rest', 'hrv', 'sleep_h', 'sleep_eff', 'recovery', 'strain', 'sleep_score', 'deep_h', 'rem_h', 'resp_rate', 'wrist_temp'] as Num[]) {
    const xs = vals(k, base);
    if (xs.length >= 3) usual[k] = k === 'steps' || k === 'active_kcal' ? Math.round(avg(xs) as number) : r1(avg(xs) as number);
  }
  const night = [...all].reverse().find((d) => d.day >= addDays(today, -1) && (d.hrv != null || d.hr_rest != null || d.sleep_h != null || d.recovery != null));
  const pick = (d: DeviceDay) => Object.fromEntries((['recovery', 'sleep_h', 'deep_h', 'rem_h', 'bed_min', 'sleep_eff', 'sleep_score', 'hrv', 'hr_rest', 'resp_rate', 'spo2', 'temp_dev', 'wrist_temp', 'strain', 'steps', 'active_kcal', 'weight', 'body_fat', 'vo2'] as Num[]).filter((k) => d[k] != null).map((k) => [k, d[k] as number]));
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
  // Sleep quality, getting sick, and heart fitness (worked out the same way the app shows them).
  const sd = sleepDetail(all, today);
  if (sd?.deep != null && sd.deep < 0.75) signals.push(`Little deep sleep last night: ${Math.round(sd.deep * 60)} min (most adults get 1 to 2 h)`);
  if (sd?.bedSpread != null && sd.bedSpread >= 60) signals.push(`Bedtime changes a lot: about ${Math.round(sd.bedSpread)} min from night to night (a steady bedtime sleeps better)`);
  const ill = illnessCheck(all, today);
  if (ill) {
    signals.push(`Possible illness: ${ill.reasons.join(', ')}. Suggest rest, fluids and a doctor if they feel unwell; never diagnose`);
    low++;
  }
  const v2 = all.filter((d) => d.vo2 != null);
  if (v2.length) {
    const first = v2[0].vo2 as number;
    const lastV = v2.at(-1)!.vo2 as number;
    signals.push(`VO2 max ${lastV} ml/kg/min${v2.length > 1 && Math.abs(lastV - first) >= 1 ? `, ${lastV > first ? 'up' : 'down'} ${r1(Math.abs(lastV - first))} since ${v2[0].day}` : ''}`);
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
  const { data } = await supabase.from('device_prefs').select('source,connected,card_order,last_sync,write_back,primary').maybeSingle();
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
const STEPS_FIX = 'gymi.stepsDedupe.v1';
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
  const prefs = await loadDevicePrefs();
  const days = await loadDeviceDays(addDays(localDay(), -90), prefs.primary ?? 'auto');
  set({ uid, ready: true, prefs, days });
  // Phones refresh by themselves at most every 30 minutes. Once after the steps fix (they used to count twice when the
  // phone and the watch both recorded a walk), the whole last month is read again.
  if (phoneSource && prefs.connected && prefs.source === phoneSource) {
    startBackgroundSync();
    const fixed = await AsyncStorage.getItem(STEPS_FIX).catch(() => '1');
    if (!fixed) syncDevice(30).then(() => AsyncStorage.setItem(STEPS_FIX, '1').catch(() => {}), () => {});
    else if (!prefs.last_sync || Date.now() - new Date(prefs.last_sync).getTime() > 30 * 6e4) syncDevice().catch(() => {});
  }
  // Linked wearables (WHOOP, Oura) refresh at most every 3 hours, then the days load again.
  wearableStatus()
    .then(async (s) => {
      const due = (s?.links ?? []).some((l) => l.status === 'ok' && (!l.last_sync || Date.now() - new Date(l.last_sync).getTime() > 3 * 36e5));
      if (!due) return;
      await syncWearables();
      if (state.uid === uid) set({ days: await loadDeviceDays(addDays(localDay(), -90)) });
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
    if (out.length) await supabase.from('device_readings').upsert(out.map(({ period: _p, ...d }) => ({ user_id: state.uid, ...d, updated_at: new Date().toISOString() })));
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
  await savePrefs({ connected: false, write_back: false });
  await stopBackgroundSync();
}

/**
 * For the background task: load (when the app was closed), read the newest from the phone, and hand back the days.
 * Null when no phone health app is connected.
 */
export async function syncInBackground(uid: string): Promise<DeviceDay[] | null> {
  if (!phoneSource) return null;
  if (state.uid !== uid) await load(uid);
  if (!state.prefs.connected || state.prefs.source !== phoneSource) return null;
  // Loading may have started a sync already: wait for it (up to 20 seconds), then read the last 2 days.
  for (let i = 0; i < 40 && state.syncing; i++) await new Promise((r) => setTimeout(r, 500));
  await syncDevice(2).catch(() => 0);
  return state.days;
}

/**
 * Turn on or off writing Gymi's own workouts, meals, water and weight to the phone's health app. Turning it on asks
 * the phone for permission to write first.
 */
export async function setWriteBack(on: boolean): Promise<'ok' | 'denied' | 'unavailable'> {
  if (!on) {
    await savePrefs({ write_back: false });
    return 'ok';
  }
  if (!phoneSource) return 'unavailable';
  const r = await connectSource(true);
  if (r === 'ok') await savePrefs({ write_back: true });
  return r;
}

const writing = () => !!phoneSource && state.prefs.connected && state.prefs.source === phoneSource && !!state.prefs.write_back;

/** A copy of something logged in Gymi, for the phone's health app (only when the person turned it on). */
export function pushHealth(x: HealthItem) {
  if (writing()) writeHealth(x).catch(() => {});
}

/** Take back a copy after it was deleted in Gymi. */
export function pullHealth(type: HealthItem['type'], id: string) {
  if (writing()) removeHealth(type, id).catch(() => {});
}

/**
 * Heart rate during a workout, from the watch: average and highest, or null without readings. Watches send heart
 * rate to the phone a little later, so this is tried again on the next open.
 */
export async function workoutHeart(start: Date, end: Date): Promise<{ avg: number; max: number } | null> {
  if (!phoneSource || !state.prefs.connected) return null;
  const xs = (await readHeartRate(start, end)).filter((v) => v >= 30 && v <= 250);
  if (xs.length < 5) return null;
  return { avg: Math.round(xs.reduce((a, v) => a + v, 0) / xs.length), max: Math.round(Math.max(...xs)) };
}

/** Load the days again (after linking, syncing or disconnecting a wearable). */
export async function reloadDeviceDays() {
  if (!state.uid) return;
  const uid = state.uid;
  const days = await loadDeviceDays(addDays(localDay(), -90));
  if (state.uid === uid) set({ days });
}

export const saveCardOrder = (order: string[]) => savePrefs({ card_order: order });

/** Pick whose sleep and heart readings win, then load the days again with that choice. */
export async function setPrimaryDevice(primary: DevicePrimary) {
  await savePrefs({ primary });
  await reloadDeviceDays();
}

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

/**
 * Your daily step goal: a little above what you usually walk (your 30-day average + 10%, rounded to 500, between
 * 5,000 and 12,000), so it's reachable and still a push. 8,000 until the watch has a week of steps.
 */
export function stepGoal(days: DeviceDay[], today = localDay()) {
  const xs = days.filter((d) => d.day < today && d.day >= addDays(today, -30) && d.steps != null && d.steps > 0).map((d) => d.steps as number);
  if (xs.length < 7) return 8000;
  const usual = avg(xs) as number;
  return Math.max(5000, Math.min(12000, Math.round((usual * 1.1) / 500) * 500));
}

/** The step goal for the signed-in person (see stepGoal). */
export function useStepGoal(uid: string | undefined) {
  const dev = useDevices(uid);
  return stepGoal(dev.days);
}
