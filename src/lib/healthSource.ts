// Web: phone health data connects in the phone app only. (Phones use healthSource.native.ts.)
import { type DeviceSource, EMPTY_RAW, type RawHealth } from './devices';

export const nativeSource: DeviceSource | null = null;

/** Something Gymi writes to the phone's health app (phones only). */
export type HealthItem =
  | { type: 'workout'; id: string; start: Date; end: Date; kind: 'Strength' | 'Run' | 'Walk' | 'Bike' | 'Swim' | 'Other'; kcal: number }
  | { type: 'meal'; id: string; at: Date; kcal: number; protein: number; carbs: number; fat: number }
  | { type: 'water'; id: string; at: Date; ml: number }
  | { type: 'weight'; id: string; at: Date; kg: number };

export async function connectSource(_write = false): Promise<'ok' | 'denied' | 'unavailable'> {
  return 'unavailable';
}

export async function readRaw(_from: Date, _to: Date): Promise<RawHealth> {
  return EMPTY_RAW();
}

export async function readHeartRate(_from: Date, _to: Date): Promise<number[]> {
  return [];
}

export async function writeHealth(_x: HealthItem): Promise<void> {}

export async function removeHealth(_type: HealthItem['type'], _id: string): Promise<void> {}
