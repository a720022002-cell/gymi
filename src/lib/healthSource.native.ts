// Phones: read health data from Apple Health (iPhone) or Health Connect (Android), and, only when the person turns
// it on, write Adro's own workouts, meals, water and weight back. What Adro wrote is skipped when reading, so it's
// never counted twice.
import * as HK from '@kingstinct/react-native-healthkit';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import * as HC from 'react-native-health-connect';

import { type DeviceSource, EMPTY_RAW, type Point, type RawHealth, type Span } from './devices';

export const nativeSource: DeviceSource | null = Platform.OS === 'ios' ? 'apple' : Platform.OS === 'android' ? 'health_connect' : null;

/** Something Adro writes to the phone's health app. The id is Adro's own, so it can be found again to delete. */
export type HealthItem =
  | { type: 'workout'; id: string; start: Date; end: Date; kind: 'Strength' | 'Run' | 'Walk' | 'Bike' | 'Swim' | 'Other'; kcal: number }
  | { type: 'meal'; id: string; at: Date; kcal: number; protein: number; carbs: number; fat: number }
  | { type: 'water'; id: string; at: Date; ml: number }
  | { type: 'weight'; id: string; at: Date; kg: number };

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
  'HKQuantityTypeIdentifierBodyFatPercentage',
  'HKQuantityTypeIdentifierVO2Max',
  'HKQuantityTypeIdentifierRespiratoryRate',
  'HKQuantityTypeIdentifierOxygenSaturation',
  'HKQuantityTypeIdentifierAppleSleepingWristTemperature',
  'HKCategoryTypeIdentifierSleepAnalysis',
  'HKCategoryTypeIdentifierMenstrualFlow',
  'HKWorkoutTypeIdentifier',
] as const;
const HK_WRITE = [
  'HKWorkoutTypeIdentifier',
  'HKQuantityTypeIdentifierActiveEnergyBurned',
  'HKQuantityTypeIdentifierDietaryEnergyConsumed',
  'HKQuantityTypeIdentifierDietaryProtein',
  'HKQuantityTypeIdentifierDietaryCarbohydrates',
  'HKQuantityTypeIdentifierDietaryFatTotal',
  'HKQuantityTypeIdentifierDietaryWater',
  'HKQuantityTypeIdentifierBodyMass',
] as const;

const HK_WORKOUT: Record<number, string> = { 37: 'Run', 52: 'Walk', 13: 'Bike', 46: 'Swim', 50: 'Strength', 20: 'Strength', 63: 'HIIT', 57: 'Yoga' };
const HK_KIND: Record<string, number> = { Strength: 50, Run: 37, Walk: 52, Bike: 13, Swim: 46, Other: 3000 };
// Apple's own key for "the id this record has in the app that wrote it".
const EXT = 'HKExternalUUID';

/** Adro's own app in Apple Health, so what it wrote can be left out when reading. */
const hkSelf = () => {
  try {
    return HK.currentAppSource().bundleIdentifier;
  } catch {
    return Constants.expoConfig?.ios?.bundleIdentifier ?? 'com.adroapp.app';
  }
};
const notMine = (self: string) => (s: { sourceRevision?: { source?: { bundleIdentifier?: string } } }) => s.sourceRevision?.source?.bundleIdentifier !== self;

async function hkConnect(write = false): Promise<'ok' | 'denied' | 'unavailable'> {
  if (!HK.isHealthDataAvailable()) return 'unavailable';
  // Apple never tells apps which read types were refused, so a finished request counts as connected.
  const ok = await HK.requestAuthorization({ toRead: HK_READ as unknown as HK.ObjectTypeIdentifier[], ...(write ? { toShare: HK_WRITE as unknown as HK.SampleTypeIdentifierWriteable[] } : {}) });
  return ok ? 'ok' : 'denied';
}

async function hkRead(from: Date, to: Date): Promise<RawHealth> {
  const out = EMPTY_RAW();
  const self = hkSelf();
  const mine = notMine(self);
  const filter = { date: { startDate: from, endDate: to } };
  const q = async (id: string, unit: string) => {
    try {
      const xs = await HK.queryQuantitySamples(id as 'HKQuantityTypeIdentifierStepCount', { filter, limit: 0, unit: unit as never });
      return xs.filter(mine).map((s) => ({ start: new Date(s.startDate), end: new Date(s.endDate), v: s.quantity }));
    } catch {
      return [];
    }
  };
  /**
   * Steps and active calories as hourly totals worked out by Apple Health itself, so the iPhone and the Apple Watch
   * (or two apps) counting the same walk count once, like in the Health app. What Adro wrote is left out.
   */
  const hourly = async (id: 'HKQuantityTypeIdentifierStepCount' | 'HKQuantityTypeIdentifierActiveEnergyBurned', unit: string): Promise<Span[]> => {
    try {
      let me: ReturnType<typeof HK.currentAppSource>[] = [];
      try {
        me = [HK.currentAppSource()];
      } catch {}
      const rs = await HK.queryStatisticsCollectionForQuantity(id, ['cumulativeSum'], from, { hour: 1 }, { filter: { date: { startDate: from, endDate: to }, ...(me.length ? { NOT: [{ sources: me }] } : {}) }, unit: unit as never });
      return rs.filter((r) => r.startDate && r.endDate && (r.sumQuantity?.quantity ?? 0) > 0).map((r) => ({ start: new Date(r.startDate as Date), end: new Date(r.endDate as Date), v: r.sumQuantity!.quantity }));
    } catch {
      return [];
    }
  };
  const pts = (xs: Span[]): Point[] => xs.map((x) => ({ t: x.start, v: x.v }));
  // Percentages may come as a fraction (0.97): always store them out of 100.
  const pct = (xs: Point[]) => xs.map((x) => ({ ...x, v: x.v <= 1.5 ? x.v * 100 : x.v }));
  const [steps, kcal, hr, rest, hrv, weight, fat, vo2, resp, spo2, wrist] = await Promise.all([
    hourly('HKQuantityTypeIdentifierStepCount', 'count'),
    hourly('HKQuantityTypeIdentifierActiveEnergyBurned', 'kcal'),
    q('HKQuantityTypeIdentifierHeartRate', 'count/min'),
    q('HKQuantityTypeIdentifierRestingHeartRate', 'count/min'),
    q('HKQuantityTypeIdentifierHeartRateVariabilitySDNN', 'ms'),
    q('HKQuantityTypeIdentifierBodyMass', 'kg'),
    q('HKQuantityTypeIdentifierBodyFatPercentage', '%'),
    q('HKQuantityTypeIdentifierVO2Max', 'ml/(kg*min)'),
    q('HKQuantityTypeIdentifierRespiratoryRate', 'count/min'),
    q('HKQuantityTypeIdentifierOxygenSaturation', '%'),
    q('HKQuantityTypeIdentifierAppleSleepingWristTemperature', 'degC'),
  ]);
  out.steps = steps;
  out.kcal = kcal;
  out.hr = pts(hr);
  out.rest = pts(rest);
  out.hrv = pts(hrv);
  out.weight = pts(weight);
  out.bodyFat = pct(pts(fat));
  out.vo2 = pts(vo2);
  out.resp = pts(resp);
  out.spo2 = pct(pts(spo2));
  out.wristTemp = pts(wrist);
  try {
    // Sleep the night before the first day counts on that first day.
    const sl = await HK.queryCategorySamples('HKCategoryTypeIdentifierSleepAnalysis', { filter: { date: { startDate: new Date(from.getTime() - 12 * 36e5), endDate: to } }, limit: 0 });
    // 0 in bed, 2 awake: time in bed. 1 asleep, 3 core, 4 deep, 5 REM.
    out.sleep = sl.map((s) => {
      const v = Number(s.value);
      return { start: new Date(s.startDate), end: new Date(s.endDate), kind: v === 0 || v === 2 ? ('bed' as const) : ('asleep' as const), stage: v === 4 ? ('deep' as const) : v === 5 ? ('rem' as const) : v === 3 ? ('core' as const) : undefined };
    });
  } catch {}
  try {
    // 1 unspecified, 2 light, 3 medium, 4 heavy, 5 none.
    const fl = await HK.queryCategorySamples('HKCategoryTypeIdentifierMenstrualFlow', { filter, limit: 0 });
    out.period = fl.filter((s) => Number(s.value) !== 5).map((s) => ({ t: new Date(s.startDate), v: Math.max(0, Number(s.value) - 1) }));
  } catch {}
  try {
    const ws = await HK.queryWorkoutSamples({ filter, limit: 0 });
    out.workouts = ws.filter(mine).map((w) => ({
      start: new Date(w.startDate),
      end: new Date(w.endDate),
      type: HK_WORKOUT[Number(w.workoutActivityType)] ?? 'Workout',
      kcal: w.totalEnergyBurned?.unit === 'kJ' ? w.totalEnergyBurned.quantity / 4.184 : (w.totalEnergyBurned?.quantity ?? 0),
    }));
  } catch {}
  return out;
}

async function hkWrite(x: HealthItem) {
  const meta = { [EXT]: x.id } as never;
  if (x.type === 'workout') {
    const kcal = Math.max(0, Math.round(x.kcal));
    const energy = kcal ? [{ startDate: x.start, endDate: x.end, quantityType: 'HKQuantityTypeIdentifierActiveEnergyBurned' as const, quantity: kcal, unit: 'kcal' }] : [];
    await HK.saveWorkoutSample(HK_KIND[x.kind] as HK.WorkoutActivityType, energy, x.start, x.end, kcal ? { energyBurned: kcal } : undefined, { [EXT]: x.id });
  } else if (x.type === 'meal') {
    const put = (id: Parameters<typeof HK.saveQuantitySample>[0], unit: string, v: number) => (v > 0 ? HK.saveQuantitySample(id, unit as never, Math.round(v * 10) / 10, x.at, x.at, meta) : null);
    await Promise.all([
      put('HKQuantityTypeIdentifierDietaryEnergyConsumed', 'kcal', x.kcal),
      put('HKQuantityTypeIdentifierDietaryProtein', 'g', x.protein),
      put('HKQuantityTypeIdentifierDietaryCarbohydrates', 'g', x.carbs),
      put('HKQuantityTypeIdentifierDietaryFatTotal', 'g', x.fat),
    ]);
  } else if (x.type === 'water') await HK.saveQuantitySample('HKQuantityTypeIdentifierDietaryWater', 'mL' as never, x.ml, x.at, x.at, meta);
  else await HK.saveQuantitySample('HKQuantityTypeIdentifierBodyMass', 'kg' as never, x.kg, x.at, x.at, meta);
}

async function hkRemove(type: HealthItem['type'], id: string) {
  const filter = { metadata: { withMetadataKey: EXT, operatorType: HK.ComparisonPredicateOperator.equalTo, value: id } };
  const ids: HK.SampleTypeIdentifierWriteable[] =
    type === 'workout'
      ? ['HKWorkoutTypeIdentifier', 'HKQuantityTypeIdentifierActiveEnergyBurned']
      : type === 'meal'
        ? ['HKQuantityTypeIdentifierDietaryEnergyConsumed', 'HKQuantityTypeIdentifierDietaryProtein', 'HKQuantityTypeIdentifierDietaryCarbohydrates', 'HKQuantityTypeIdentifierDietaryFatTotal']
        : type === 'water'
          ? ['HKQuantityTypeIdentifierDietaryWater']
          : ['HKQuantityTypeIdentifierBodyMass'];
  await Promise.all(ids.map((i) => HK.deleteObjects(i, filter as never).catch(() => 0)));
}

// ---------------------------------------------------------------------------
// Health Connect
// ---------------------------------------------------------------------------
const HC_TYPES = [
  'Steps',
  'ActiveCaloriesBurned',
  'HeartRate',
  'RestingHeartRate',
  'HeartRateVariabilityRmssd',
  'SleepSession',
  'Weight',
  'BodyFat',
  'Vo2Max',
  'RespiratoryRate',
  'OxygenSaturation',
  'SkinTemperature',
  'MenstruationFlow',
  'ExerciseSession',
] as const;
const HC_WRITE = ['ExerciseSession', 'ActiveCaloriesBurned', 'Nutrition', 'Hydration', 'Weight'] as const;
const HC_WORKOUT: Record<number, string> = { 56: 'Run', 79: 'Walk', 8: 'Bike', 74: 'Swim', 73: 'Swim', 70: 'Strength', 81: 'Strength', 36: 'HIIT', 83: 'Yoga' };
const HC_KIND: Record<string, number> = { Strength: 70, Run: 56, Walk: 79, Bike: 8, Swim: 74, Other: 0 };
const HC_SELF = Constants.expoConfig?.android?.package ?? 'com.adroapp.app';

async function hcReady() {
  const status = await HC.getSdkStatus();
  if (status !== HC.SdkAvailabilityStatus.SDK_AVAILABLE) return false;
  return HC.initialize();
}

async function hcConnect(write = false): Promise<'ok' | 'denied' | 'unavailable'> {
  try {
    if (!(await hcReady())) return 'unavailable';
    const asks = [...HC_TYPES.map((recordType) => ({ accessType: 'read' as const, recordType })), ...(write ? HC_WRITE.map((recordType) => ({ accessType: 'write' as const, recordType })) : [])];
    const granted = await HC.requestPermission(asks);
    if (write) return granted.some((g) => 'accessType' in g && g.accessType === 'write') ? 'ok' : 'denied';
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
  // What Adro wrote itself is left out.
  return out.filter((r) => (r as { metadata?: { dataOrigin?: string } }).metadata?.dataOrigin !== HC_SELF);
}

async function hcRead(from: Date, to: Date): Promise<RawHealth> {
  const out = EMPTY_RAW();
  if (!(await hcReady().catch(() => false))) return out;
  const [steps, kcal, hr, rest, hrv, sleep, weight, fat, vo2, resp, spo2, skin, flow, ex] = await Promise.all([
    hcAll('Steps', from, to),
    hcAll('ActiveCaloriesBurned', from, to),
    hcAll('HeartRate', from, to),
    hcAll('RestingHeartRate', from, to),
    hcAll('HeartRateVariabilityRmssd', from, to),
    hcAll('SleepSession', new Date(from.getTime() - 12 * 36e5), to),
    hcAll('Weight', from, to),
    hcAll('BodyFat', from, to),
    hcAll('Vo2Max', from, to),
    hcAll('RespiratoryRate', from, to),
    hcAll('OxygenSaturation', from, to),
    hcAll('SkinTemperature', new Date(from.getTime() - 12 * 36e5), to),
    hcAll('MenstruationFlow', from, to),
    hcAll('ExerciseSession', from, to),
  ]);
  // Daily totals: hourly sums worked out by Health Connect, which counts a walk once even when the phone and a watch
  // (or two apps) both recorded it. Adro's own calories (written when you turned that on) are taken back out.
  const range = { operator: 'between' as const, startTime: from.toISOString(), endTime: to.toISOString() };
  const slicer = { duration: 'HOURS' as const, length: 1 };
  const [aSteps, aKcal, mine] = await Promise.all([
    HC.aggregateGroupByDuration({ recordType: 'Steps', timeRangeFilter: range, timeRangeSlicer: slicer }).catch(() => null),
    HC.aggregateGroupByDuration({ recordType: 'ActiveCaloriesBurned', timeRangeFilter: range, timeRangeSlicer: slicer }).catch(() => null),
    HC.aggregateGroupByDuration({ recordType: 'ActiveCaloriesBurned', timeRangeFilter: range, timeRangeSlicer: slicer, dataOriginFilter: [HC_SELF] }).catch(() => null),
  ]);
  const own = new Map((mine ?? []).map((g) => [g.startTime, g.result.ACTIVE_CALORIES_TOTAL?.inKilocalories ?? 0]));
  out.steps = aSteps
    ? aSteps.filter((g) => (g.result.COUNT_TOTAL ?? 0) > 0).map((g) => ({ start: new Date(g.startTime), end: new Date(g.endTime), v: g.result.COUNT_TOTAL }))
    : steps.map((r) => ({ start: new Date(r.startTime), end: new Date(r.endTime), v: r.count }));
  out.kcal = aKcal
    ? aKcal.map((g) => ({ start: new Date(g.startTime), end: new Date(g.endTime), v: Math.max(0, (g.result.ACTIVE_CALORIES_TOTAL?.inKilocalories ?? 0) - (own.get(g.startTime) ?? 0)) })).filter((x) => x.v > 0)
    : kcal.map((r) => ({ start: new Date(r.startTime), end: new Date(r.endTime), v: r.energy.inKilocalories }));
  // Calories inside a workout come from the records themselves (Adro's own already left out).
  const kcalRecs = kcal.map((r) => ({ start: new Date(r.startTime), v: r.energy.inKilocalories }));
  out.hr = hr.flatMap((r) => r.samples.map((s) => ({ t: new Date(s.time), v: s.beatsPerMinute })));
  out.rest = rest.map((r) => ({ t: new Date(r.time), v: r.beatsPerMinute }));
  out.hrv = hrv.map((r) => ({ t: new Date(r.time), v: r.heartRateVariabilityMillis }));
  out.weight = weight.map((r) => ({ t: new Date(r.time), v: r.weight.inKilograms }));
  out.bodyFat = fat.map((r) => ({ t: new Date(r.time), v: r.percentage }));
  out.vo2 = vo2.map((r) => ({ t: new Date(r.time), v: r.vo2MillilitersPerMinuteKilogram }));
  out.resp = resp.map((r) => ({ t: new Date(r.time), v: r.rate }));
  out.spo2 = spo2.map((r) => ({ t: new Date(r.time), v: r.percentage }));
  // Skin temperature is already a change from your baseline; it counts on the morning the night ended.
  out.tempDev = skin.flatMap((r) => r.deltas.map((d) => ({ t: new Date(r.endTime), v: d.delta.inCelsius })));
  // Flow: 0 unknown, 1 light, 2 medium, 3 heavy.
  out.period = flow.map((r) => ({ t: new Date(r.time), v: Math.max(0, Math.min(3, r.flow ?? 0)) }));
  // Whole session = time in bed; sleeping stages (or the whole session when there are none) = asleep.
  // Stages: 2 sleeping, 4 light, 5 deep, 6 REM.
  out.sleep = sleep.flatMap((r) => {
    const bed = { start: new Date(r.startTime), end: new Date(r.endTime), kind: 'bed' as const };
    const st = (r.stages ?? []).filter((s) => [2, 4, 5, 6].includes(s.stage));
    return [
      bed,
      ...(st.length
        ? st.map((s) => ({ start: new Date(s.startTime), end: new Date(s.endTime), kind: 'asleep' as const, stage: s.stage === 5 ? ('deep' as const) : s.stage === 6 ? ('rem' as const) : s.stage === 4 ? ('core' as const) : undefined }))
        : [{ ...bed, kind: 'asleep' as const }]),
    ];
  });
  out.workouts = ex.map((r) => {
    const s = new Date(r.startTime);
    const e = new Date(r.endTime);
    const k = kcalRecs.filter((x) => x.start >= s && x.start < e).reduce((a, x) => a + x.v, 0);
    return { start: s, end: e, type: HC_WORKOUT[r.exerciseType] ?? 'Workout', kcal: k };
  });
  return out;
}

async function hcWrite(x: HealthItem) {
  if (!(await hcReady().catch(() => false))) return;
  const meta = (id: string) => ({ clientRecordId: id });
  const iso = (d: Date) => d.toISOString();
  const after = (d: Date) => new Date(d.getTime() + 60e3);
  if (x.type === 'workout') {
    const kcal = Math.max(0, Math.round(x.kcal));
    await HC.insertRecords([
      { recordType: 'ExerciseSession', exerciseType: HC_KIND[x.kind] ?? 0, title: 'Adro', startTime: iso(x.start), endTime: iso(x.end), metadata: meta(x.id) },
      ...(kcal ? [{ recordType: 'ActiveCaloriesBurned' as const, energy: { value: kcal, unit: 'kilocalories' as const }, startTime: iso(x.start), endTime: iso(x.end), metadata: meta(`${x.id}:kcal`) }] : []),
    ]);
  } else if (x.type === 'meal')
    await HC.insertRecords([
      {
        recordType: 'Nutrition',
        mealType: 0,
        startTime: iso(x.at),
        endTime: iso(after(x.at)),
        energy: { value: Math.round(x.kcal), unit: 'kilocalories' },
        protein: { value: Math.round(x.protein * 10) / 10, unit: 'grams' },
        totalCarbohydrate: { value: Math.round(x.carbs * 10) / 10, unit: 'grams' },
        totalFat: { value: Math.round(x.fat * 10) / 10, unit: 'grams' },
        metadata: meta(x.id),
      },
    ]);
  else if (x.type === 'water') await HC.insertRecords([{ recordType: 'Hydration', volume: { value: x.ml, unit: 'milliliters' }, startTime: iso(x.at), endTime: iso(after(x.at)), metadata: meta(x.id) }]);
  else await HC.insertRecords([{ recordType: 'Weight', weight: { value: x.kg, unit: 'kilograms' }, time: iso(x.at), metadata: meta(x.id) }]);
}

async function hcRemove(type: HealthItem['type'], id: string) {
  if (!(await hcReady().catch(() => false))) return;
  if (type === 'workout') {
    await HC.deleteRecordsByUuids('ExerciseSession', [], [id]).catch(() => {});
    await HC.deleteRecordsByUuids('ActiveCaloriesBurned', [], [`${id}:kcal`]).catch(() => {});
  } else await HC.deleteRecordsByUuids(type === 'meal' ? 'Nutrition' : type === 'water' ? 'Hydration' : 'Weight', [], [id]).catch(() => {});
}

// ---------------------------------------------------------------------------
// Both
// ---------------------------------------------------------------------------
export async function connectSource(write = false): Promise<'ok' | 'denied' | 'unavailable'> {
  try {
    return nativeSource === 'apple' ? await hkConnect(write) : nativeSource === 'health_connect' ? await hcConnect(write) : 'unavailable';
  } catch {
    return 'unavailable';
  }
}

export async function readRaw(from: Date, to: Date): Promise<RawHealth> {
  return nativeSource === 'apple' ? hkRead(from, to) : nativeSource === 'health_connect' ? hcRead(from, to) : EMPTY_RAW();
}

/** Heart rate the watch measured between two moments (beats per minute, oldest first). */
export async function readHeartRate(from: Date, to: Date): Promise<number[]> {
  try {
    if (nativeSource === 'apple') {
      const xs = await HK.queryQuantitySamples('HKQuantityTypeIdentifierHeartRate', { filter: { date: { startDate: from, endDate: to } }, limit: 0, unit: 'count/min' as never });
      return xs.map((s) => s.quantity);
    }
    if (nativeSource === 'health_connect') {
      if (!(await hcReady().catch(() => false))) return [];
      const rs = await hcAll('HeartRate', from, to);
      return rs.flatMap((r) => r.samples.filter((s) => new Date(s.time) >= from && new Date(s.time) <= to).map((s) => s.beatsPerMinute));
    }
  } catch {}
  return [];
}

/** Write one of Adro's own records to the health app. Errors are swallowed: it's a copy, Adro keeps the original. */
export async function writeHealth(x: HealthItem): Promise<void> {
  try {
    if (nativeSource === 'apple') await hkWrite(x);
    else if (nativeSource === 'health_connect') await hcWrite(x);
  } catch {}
}

/** Remove a record Adro wrote earlier (after it was deleted in Adro). */
export async function removeHealth(type: HealthItem['type'], id: string): Promise<void> {
  try {
    if (nativeSource === 'apple') await hkRemove(type, id);
    else if (nativeSource === 'health_connect') await hcRemove(type, id);
  } catch {}
}
