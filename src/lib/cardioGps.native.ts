// Phones: distance and pace for outdoor cardio from GPS. Location updates run as a background task, so they keep
// coming while the phone is locked during a session (iPhone: the blue location pill; Android: a notification while it
// runs). Started only for outdoor sports, and only after you start a session. Same API as cardioGps.ts (web).
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';

export type GpsPoint = { lat: number; lon: number; at: number; acc: number | null; speed: number | null };
export type GpsStart = 'ok' | 'denied' | 'off' | 'unavailable';

const TASK = 'adro-cardio-gps';
let listener: ((pts: GpsPoint[]) => void) | null = null;
let watch: Location.LocationSubscription | null = null;

const toPoint = (l: Location.LocationObject): GpsPoint => ({ lat: l.coords.latitude, lon: l.coords.longitude, at: l.timestamp, acc: l.coords.accuracy, speed: l.coords.speed });

// Defined when this file loads (imported by the root layout), so it exists when the phone hands over new locations.
try {
  TaskManager.defineTask<{ locations?: Location.LocationObject[] }>(TASK, async ({ data, error }) => {
    if (error || !data?.locations?.length) return;
    listener?.(data.locations.map(toPoint));
  });
} catch {}

export const gpsSupported = true;

/** Asks for location while using the app (that's all a session needs, also while locked). */
export async function gpsPermission(): Promise<'ok' | 'denied' | 'off'> {
  try {
    if (!(await Location.hasServicesEnabledAsync())) return 'off';
    const cur = await Location.getForegroundPermissionsAsync();
    if (cur.granted) return 'ok';
    const r = await Location.requestForegroundPermissionsAsync();
    return r.granted ? 'ok' : 'denied';
  } catch {
    return 'denied';
  }
}

/** Start GPS for a session. Falls back to updates while the app is open when background updates can't start. */
export async function startGps(onPoints: (pts: GpsPoint[]) => void, notice: { title: string; body: string }): Promise<GpsStart> {
  const perm = await gpsPermission();
  if (perm !== 'ok') return perm;
  listener = onPoints;
  try {
    if (await Location.hasStartedLocationUpdatesAsync(TASK).catch(() => false)) await Location.stopLocationUpdatesAsync(TASK).catch(() => {});
    await Location.startLocationUpdatesAsync(TASK, {
      accuracy: Location.Accuracy.BestForNavigation,
      distanceInterval: 5,
      timeInterval: 2000,
      activityType: Location.ActivityType.Fitness,
      pausesUpdatesAutomatically: false,
      showsBackgroundLocationIndicator: true,
      foregroundService: { notificationTitle: notice.title, notificationBody: notice.body, notificationColor: '#3355FF', killServiceOnDestroy: true },
    });
    return 'ok';
  } catch {
    try {
      watch = await Location.watchPositionAsync({ accuracy: Location.Accuracy.BestForNavigation, distanceInterval: 5, timeInterval: 2000 }, (l) => listener?.([toPoint(l)]));
      return 'ok';
    } catch {
      listener = null;
      return 'unavailable';
    }
  }
}

export async function stopGps() {
  listener = null;
  watch?.remove();
  watch = null;
  try {
    if (await Location.hasStartedLocationUpdatesAsync(TASK)) await Location.stopLocationUpdatesAsync(TASK);
  } catch {}
}
