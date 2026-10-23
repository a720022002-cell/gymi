// Web: no GPS tracking during a session (phones use cardioGps.native.ts); the session runs on time and effort.
export type GpsPoint = { lat: number; lon: number; at: number; acc: number | null; speed: number | null };
export type GpsStart = 'ok' | 'denied' | 'off' | 'unavailable';

export const gpsSupported = false;

export async function gpsPermission(): Promise<'ok' | 'denied' | 'off'> {
  return 'denied';
}

export async function startGps(_onPoints: (pts: GpsPoint[]) => void, _notice: { title: string; body: string }): Promise<GpsStart> {
  return 'unavailable';
}

export async function stopGps() {}
