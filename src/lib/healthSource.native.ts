// Phones: read health data from Apple Health (iPhone) or Health Connect (Android). Read-only.
import * as HK from '@kingstinct/react-native-healthkit';
import { Platform } from 'react-native';
import * as HC from 'react-native-health-connect';

import type { DeviceSource, Point, RawHealth, Span } from './devices';

export const nativeSource: DeviceSource | null = Platform.OS === 'ios' ? 'apple' : Platform.OS === 'android' ? 'health_connect' : null;

const EMPTY = (): RawHealth => ({ steps: [], kcal: [], hr: [], rest: [], hrv: [], sleep: [], weight: [], vo2: [], workouts: [] });

// ---------------------------------------------------------------------------
// Apple Health
// ---------------------------------------------------------------------------
const HK_READ = [
  'HKQuantityTypeIdentifierStepCount',
  'HKQuantityTypeIdentifierActiveEnergyBurned',
  'HKQuantityTypeIdentifierHeartRate',
  'HKQuantityTypeIdentifierRestingHeartRate',
  'HKQuantityTypeIdentifierHeartRateVariabilitySDNN',
  'HKQuantityTypeIdentifierBodyMass',
  'HKQuantityTypeIdentifierVO2Max',
  'HKCategoryTypeIdentifierSleepAnalysis',
  'HKWorkoutTypeIdentifier',
] as const;

const HK_WORKOUT: Record<number, string> = { 37: 'Run', 52: 'Walk', 13: 'Bike', 46: 'Swim', 50: 'Strength', 20: 'Strength', 63: 'HIIT', 57: 'Yoga' };

async function hkConnect(): Promise<'ok' | 'denied' | 'unavailable'> {
  if (!HK.isHealthDataAvailable()) return 'unavailable';
  // Apple never tells apps which read types were refused, so a finished request counts as connected.
  const ok = await HK.requestAuthorization({ toRead: HK_READ as unknown as HK.ObjectTypeIdentifier[] });
  return ok ? 'ok' : 'denied';
}

async function hkRead(from: Date, to: Date): Promise<RawHealth> {
  const out = EMPTY();
  const filter = { date: { startDate: from, endDate: to } };
  const q = async (id: string, unit: string) => {
    try {
      const xs = await HK.queryQuantitySamples(id as 'HKQuantityTypeIdentifierStepCount', { filter, limit: 0, unit: unit as never });
      return xs.map((s) => ({ start: new Date(s.startDate), end: new Date(s.endDate), v: s.quantity }));
    } catch {
      return [];
    }
  };
  const pts = (xs: Span[]): Point[] => xs.map((x) => ({ t: x.start, v: x.v }));
  const [steps, kcal, hr, rest, hrv, weight, vo2] = await Promise.all([
    q('HKQuantityTypeIdentifierStepCount', 'count'),
    q('HKQuantityTypeIdentifierActiveEnergyBurned', 'kcal'),
    q('HKQuantityTypeIdentifierHeartRate', 'count/min'),
    q('HKQuantityTypeIdentifierRestingHeartRate', 'count/min'),
    q('HKQuantityTypeIdentifierHeartRateVariabilitySDNN', 'ms'),
    q('HKQuantityTypeIdentifierBodyMass', 'kg'),
    q('HKQuantityTypeIdentifierVO2Max', 'ml/(kg*min)'),
  ]);
  out.steps = steps;
  out.kcal = kcal;
  out.hr = pts(hr);
  out.rest = pts(rest);
  out.hrv = pts(hrv);
  out.weight = pts(weight);
  out.vo2 = pts(vo2);
  try {
    // Sleep the night before the first day counts on that first day.
    const sl = await HK.queryCategorySamples('HKCategoryTypeIdentifierSleepAnalysis', { filter: { date: { startDate: new Date(from.getTime() - 12 * 36e5), endDate: to } }, limit: 0 });
    // 0 in bed, 2 awake: time in bed. 1, 3, 4, 5: asleep.
    out.sleep = sl.map((s) => ({ start: new Date(s.startDate), end: new Date(s.endDate), kind: Number(s.value) === 0 || Number(s.value) === 2 ? ('bed' as const) : ('asleep' as const) }));
  } catch {}
  try {
    const ws = await HK.queryWorkoutSamples({ filter, limit: 0 });
    out.workouts = ws.map((w) => ({
      start: new Date(w.startDate),
      end: new Date(w.endDate),
      type: HK_WORKOUT[Number(w.workoutActivityType)] ?? 'Workout',
      kcal: w.totalEnergyBurned?.unit === 'kJ' ? w.totalEnergyBurned.quantity / 4.184 : (w.totalEnergyBurned?.quantity ?? 0),
    }));
  } catch {}
  return out;
}

// ---------------------------------------------------------------------------
// Health Connect
// ---------------------------------------------------------------------------
const HC_TYPES = ['Steps', 'ActiveCaloriesBurned', 'HeartRate', 'RestingHeartRate', 'HeartRateVariabilityRmssd', 'SleepSession', 'Weight', 'Vo2Max', 'ExerciseSession'] as const;
const HC_WORKOUT: Record<number, string> = { 56: 'Run', 79: 'Walk', 8: 'Bike', 74: 'Swim', 73: 'Swim', 70: 'Strength', 81: 'Strength', 36: 'HIIT', 83: 'Yoga' };

async function hcReady() {
  const status = await HC.getSdkStatus();
  if (status !== HC.SdkAvailabilityStatus.SDK_AVAILABLE) return false;
  return HC.initialize();
}

async function hcConnect(): Promise<'ok' | 'denied' | 'unavailable'> {
  try {
    if (!(await hcReady())) return 'unavailable';
    const granted = await HC.requestPermission(HC_TYPES.map((recordType) => ({ accessType: 'read' as const, recordType })));
    return granted.length ? 'ok' : 'denied';
  } catch {
    return 'unavailable';
  }
}

async function hcAll<T extends (typeof HC_TYPES)[number]>(type: T, from: Date, to: Date) {
  const out: HC.RecordResult<T>[] = [];
  let pageToken: string | undefined;
  try {
    for (let i = 0; i < 20; i++) {
      const r = await HC.readRecords(type, { timeRangeFilter: { operator: 'between', startTime: from.toISOString(), endTime: to.toISOString() }, pageSize: 5000, pageToken });
      out.push(...r.records);
      pageToken = r.pageToken;
      if (!pageToken) break;
    }
  } catch {}
  return out;
}

async function hcRead(from: Date, to: Date): Promise<RawHealth> {
  const out = EMPTY();
  if (!(await hcReady().catch(() => false))) return out;
  const [steps, kcal, hr, rest, hrv, sleep, weight, vo2, ex] = await Promise.all([
    hcAll('Steps', from, to),
    hcAll('ActiveCaloriesBurned', from, to),
    hcAll('HeartRate', from, to),
    hcAll('RestingHeartRate', from, to),
    hcAll('HeartRateVariabilityRmssd', from, to),
    hcAll('SleepSession', new Date(from.getTime() - 12 * 36e5), to),
    hcAll('Weight', from, to),
    hcAll('Vo2Max', from, to),
    hcAll('ExerciseSession', from, to),
  ]);
  out.steps = steps.map((r) => ({ start: new Date(r.startTime), end: new Date(r.endTime), v: r.count }));
  out.kcal = kcal.map((r) => ({ start: new Date(r.startTime), end: new Date(r.endTime), v: r.energy.inKilocalories }));
  out.hr = hr.flatMap((r) => r.samples.map((s) => ({ t: new Date(s.time), v: s.beatsPerMinute })));
  out.rest = rest.map((r) => ({ t: new Date(r.time), v: r.beatsPerMinute }));
  out.hrv = hrv.map((r) => ({ t: new Date(r.time), v: r.heartRateVariabilityMillis }));
  out.weight = weight.map((r) => ({ t: new Date(r.time), v: r.weight.inKilograms }));
  out.vo2 = vo2.map((r) => ({ t: new Date(r.time), v: r.vo2MillilitersPerMinuteKilogram }));
  // Whole session = time in bed; sleeping stages (or the whole session when there are none) = asleep.
  out.sleep = sleep.flatMap((r) => {
    const bed = { start: new Date(r.startTime), end: new Date(r.endTime), kind: 'bed' as const };
    const st = (r.stages ?? []).filter((s) => [2, 4, 5, 6].includes(s.stage));
    return [bed, ...(st.length ? st.map((s) => ({ start: new Date(s.startTime), end: new Date(s.endTime), kind: 'asleep' as const })) : [{ ...bed, kind: 'asleep' as const }])];
  });
  out.workouts = ex.map((r) => {
    const s = new Date(r.startTime);
    const e = new Date(r.endTime);
    const k = out.kcal.filter((x) => x.start >= s && x.start < e).reduce((a, x) => a + x.v, 0);
    return { start: s, end: e, type: HC_WORKOUT[r.exerciseType] ?? 'Workout', kcal: k };
  });
  return out;
}

export async function connectSource(): Promise<'ok' | 'denied' | 'unavailable'> {
  try {
    return nativeSource === 'apple' ? await hkConnect() : nativeSource === 'health_connect' ? await hcConnect() : 'unavailable';
  } catch {
    return 'unavailable';
  }
}

export async function readRaw(from: Date, to: Date): Promise<RawHealth> {
  return nativeSource === 'apple' ? hkRead(from, to) : nativeSource === 'health_connect' ? hcRead(from, to) : EMPTY();
}
