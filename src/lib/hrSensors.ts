// Web: no Bluetooth heart rate or Apple Watch here (phones use hrSensors.native.ts). A live session on the web runs on
// time and how hard it feels.
import type { HrStatus, SavedSensor } from './hrTypes';

export const bleSupported = false;
export const appleWatchSupported = false;

export async function savedSensor(): Promise<SavedSensor | null> {
  return null;
}
export async function saveSensor(_s: SavedSensor | null) {}

export function scanSensors(_onFound: (s: SavedSensor & { rssi: number | null }) => void, onState: (s: 'scanning' | 'off' | 'denied' | 'unavailable') => void): () => void {
  onState('unavailable');
  return () => {};
}

export function streamBle(_sensor: SavedSensor, _onHr: (bpm: number, at: number) => void, onStatus: (s: HrStatus) => void): () => void {
  onStatus('unavailable');
  return () => {};
}

export function streamAppleWatch(_since: number, _onHr: (bpm: number, at: number) => void, onStatus: (s: HrStatus) => void): () => void {
  onStatus('unavailable');
  return () => {};
}
