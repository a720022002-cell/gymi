// Wearables linked straight to their makers (WHOOP, Oura, Polar) through their own sign-in. The server
// (functions/wearables) keeps the keys and pulls one summary per day into "wearable_days"; the app only asks it
// to start a sign-in, sync, or disconnect, and reads the days.
import * as Linking from 'expo-linking';
import { Platform } from 'react-native';

import { supabase } from './supabase';

export type WearableProvider = 'whoop' | 'oura' | 'polar';
export type WearableLink = { provider: WearableProvider; status: 'ok' | 'expired' | 'error'; last_sync: string | null };
export type WearableStatus = { configured: Record<WearableProvider, boolean>; links: WearableLink[] };
export type WearableDay = {
  provider: WearableProvider;
  day: string;
  recovery: number | null;
  strain: number | null;
  sleep_score: number | null;
  hrv: number | null;
  hr_rest: number | null;
  hr_avg: number | null;
  sleep_h: number | null;
  in_bed_h: number | null;
  sleep_eff: number | null;
  spo2: number | null;
  temp_dev: number | null;
  steps: number | null;
  active_kcal: number | null;
  workouts: { type: string; minutes: number; kcal: number }[];
};

/** The wearables Adro links to directly: name and what each one brings. */
export const WEARABLES: [WearableProvider, string, string][] = [
  ['whoop', 'WHOOP', 'Recovery, strain, sleep and HRV'],
  ['oura', 'Oura Ring', 'Readiness, sleep, HRV and activity'],
  ['polar', 'Polar', 'Training, sleep, HRV and activity'],
];
export const wearableName = (p: string) => WEARABLES.find(([k]) => k === p)?.[1] ?? p;

async function call<T>(body: Record<string, unknown>): Promise<{ data: T | null; code: string | null }> {
  const { data, error } = await supabase.functions.invoke('wearables', { body });
  if (!error) return { data: data as T, code: null };
  const ctx = (error as { context?: Response }).context;
  const j = ctx ? await ctx.json().catch(() => null) : null;
  return { data: null, code: (j?.error as string) ?? (ctx ? 'failed' : 'offline') };
}

/** Which wearables are set up on the server, and which ones you linked. */
export async function wearableStatus(): Promise<WearableStatus | null> {
  return (await call<WearableStatus>({ action: 'status' })).data;
}

/** Where the wearable's sign-in sends you back: Connections, on the web or in the phone app. */
const returnTo = (path: string) => (Platform.OS === 'web' && typeof window !== 'undefined' ? `${window.location.origin}${path}` : Linking.createURL(path));

/** Open the wearable's own sign-in. Coming back to `path` (Connections) with ?wearable=…&status=finish&state=… is
 * confirmed with finishWearable. */
export async function linkWearable(p: WearableProvider, path = '/connections'): Promise<'opened' | 'not_set_up' | 'offline' | 'failed'> {
  const { data, code } = await call<{ url: string }>({ action: 'start', provider: p, return_to: returnTo(path) });
  if (!data?.url) return code === 'not_set_up' || code === 'offline' ? code : 'failed';
  if (Platform.OS === 'web' && typeof window !== 'undefined') window.location.assign(data.url);
  else await Linking.openURL(data.url);
  return 'opened';
}

/** Back from the wearable's sign-in with ?status=finish&state=…: the server links it only if you're the one who
 * started it. Returns how it went, in the same words the screens already show (linked, expired, error). */
export async function finishWearable(state: string): Promise<'linked' | 'expired' | 'error'> {
  const { data } = await call<{ status: string }>({ action: 'finish', state });
  return data?.status === 'linked' || data?.status === 'expired' ? data.status : 'error';
}

/** Pull the newest days now. Per wearable: days saved, or "expired" (sign in again) / "error". */
export async function syncWearables(p?: WearableProvider) {
  return (await call<{ result: Record<string, number | string> }>({ action: 'sync', ...(p ? { provider: p } : {}) })).data?.result ?? null;
}

/** Disconnect: the wearable is told too, and the days that came from it are deleted. */
export async function unlinkWearable(p: WearableProvider) {
  return (await call<{ ok: boolean }>({ action: 'disconnect', provider: p })).data?.ok === true;
}

export async function loadWearableDays(from: string): Promise<WearableDay[]> {
  const { data } = await supabase.from('wearable_days').select('provider,day,recovery,strain,sleep_score,hrv,hr_rest,hr_avg,sleep_h,in_bed_h,sleep_eff,spo2,temp_dev,steps,active_kcal,workouts').gte('day', from).order('day');
  const n = (v: unknown) => (v == null ? null : Number(v));
  return ((data as WearableDay[] | null) ?? []).map((d) => ({
    ...d,
    recovery: n(d.recovery),
    strain: n(d.strain),
    sleep_score: n(d.sleep_score),
    hrv: n(d.hrv),
    hr_rest: n(d.hr_rest),
    hr_avg: n(d.hr_avg),
    sleep_h: n(d.sleep_h),
    in_bed_h: n(d.in_bed_h),
    sleep_eff: n(d.sleep_eff),
    spo2: n(d.spo2),
    temp_dev: n(d.temp_dev),
    steps: n(d.steps),
    active_kcal: n(d.active_kcal),
    workouts: d.workouts ?? [],
  }));
}
