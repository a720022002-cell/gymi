// Web: phone health data connects in the phone app only. (Phones use healthSource.native.ts.)
import type { DeviceSource, RawHealth } from './devices';

export const nativeSource: DeviceSource | null = null;

export async function connectSource(): Promise<'ok' | 'denied' | 'unavailable'> {
  return 'unavailable';
}

export async function readRaw(_from: Date, _to: Date): Promise<RawHealth> {
  return { steps: [], kcal: [], hr: [], rest: [], hrv: [], sleep: [], weight: [], vo2: [], workouts: [] };
}
