// Phones: live heart rate from (1) a Bluetooth heart rate sensor (the standard Heart Rate Service 0x180D: chest straps,
// Polar, Garmin / WHOOP / Coros "broadcast heart rate", many watches) and (2) the Apple Watch, through Apple Health,
// while a workout runs on the watch (its readings reach the phone every few seconds). Same API as hrSensors.ts (web).
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as HK from '@kingstinct/react-native-healthkit';
import { PermissionsAndroid, Platform } from 'react-native';
import { BleManager, type Device, type Subscription } from 'react-native-ble-plx';

import type { HrStatus, SavedSensor } from './hrTypes';

const HR_SERVICE = '0000180d-0000-1000-8000-00805f9b34fb';
const HR_MEASUREMENT = '00002a37-0000-1000-8000-00805f9b34fb';
const SAVED_KEY = 'adro.hrSensor.v1';

let manager: BleManager | null = null;
const ble = () => {
  if (!manager) manager = new BleManager();
  return manager;
};

export const bleSupported = true;
export const appleWatchSupported = Platform.OS === 'ios';

export async function savedSensor(): Promise<SavedSensor | null> {
  try {
    const v = await AsyncStorage.getItem(SAVED_KEY);
    return v ? (JSON.parse(v) as SavedSensor) : null;
  } catch {
    return null;
  }
}
export async function saveSensor(s: SavedSensor | null) {
  try {
    if (s) await AsyncStorage.setItem(SAVED_KEY, JSON.stringify(s));
    else await AsyncStorage.removeItem(SAVED_KEY);
  } catch {}
}

/** Android 12+ asks for "Nearby devices" (scan and connect); older Android asks for location to scan. iPhone asks by itself. */
async function blePermission(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;
  try {
    if (Number(Platform.Version) >= 31) {
      const r = await PermissionsAndroid.requestMultiple([PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN, PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT]);
      return Object.values(r).every((v) => v === PermissionsAndroid.RESULTS.GRANTED);
    }
    const r = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION);
    return r === PermissionsAndroid.RESULTS.GRANTED;
  } catch {
    return false;
  }
}

/** Waits until Bluetooth is on (a few seconds at most). 'off' when it stays off, 'denied' without permission. */
async function bleReady(): Promise<'ok' | 'off' | 'denied' | 'unavailable'> {
  if (!(await blePermission())) return 'denied';
  try {
    const m = ble();
    const now = await m.state();
    if (now === 'PoweredOn') return 'ok';
    if (now === 'Unsupported') return 'unavailable';
    if (now === 'Unauthorized') return 'denied';
    return await new Promise((res) => {
      const t = setTimeout(() => {
        sub.remove();
        res('off');
      }, 4000);
      const sub = m.onStateChange((st) => {
        if (st === 'PoweredOn') {
          clearTimeout(t);
          sub.remove();
          res('ok');
        } else if (st === 'Unauthorized') {
          clearTimeout(t);
          sub.remove();
          res('denied');
        }
      }, true);
    });
  } catch {
    return 'unavailable';
  }
}

/** Look for heart rate sensors nearby. Calls `onFound` for each (again when its signal changes). Returns stop. */
export function scanSensors(onFound: (s: SavedSensor & { rssi: number | null }) => void, onState: (s: 'scanning' | 'off' | 'denied' | 'unavailable') => void): () => void {
  let stopped = false;
  bleReady().then((r) => {
    if (stopped) return;
    if (r !== 'ok') return onState(r);
    onState('scanning');
    ble()
      .startDeviceScan([HR_SERVICE], { allowDuplicates: false }, (err, d) => {
        if (err || !d || stopped) return;
        onFound({ id: d.id, name: d.name || d.localName || 'Heart rate sensor', rssi: d.rssi ?? null });
      })
      .catch(() => onState('unavailable'));
  });
  return () => {
    stopped = true;
    ble()
      .stopDeviceScan()
      .catch(() => {});
  };
}

/** Heart Rate Measurement (0x2A37): flags, then the rate as 1 byte, or 2 bytes (little endian) when bit 0 is set. */
function parseHr(b64: string): number | null {
  const bytes = fromBase64(b64);
  if (bytes.length < 2) return null;
  const v = bytes[0] & 1 ? bytes[1] | (bytes[2] << 8) : bytes[1];
  return v >= 25 && v <= 250 ? v : null;
}
const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
function fromBase64(s: string): number[] {
  const out: number[] = [];
  let buf = 0;
  let bits = 0;
  for (const ch of s.replace(/=+$/, '')) {
    const v = B64.indexOf(ch);
    if (v < 0) continue;
    buf = (buf << 6) | v;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out.push((buf >> bits) & 0xff);
    }
  }
  return out;
}

/**
 * Connect to a sensor and stream its heart rate. Reconnects by itself (every few seconds) when the signal drops, until
 * stop is called. Status: connecting → live, lost while reconnecting.
 */
export function streamBle(sensor: SavedSensor, onHr: (bpm: number, at: number) => void, onStatus: (s: HrStatus) => void): () => void {
  let stopped = false;
  let mon: Subscription | null = null;
  let disc: Subscription | null = null;
  let retry: ReturnType<typeof setTimeout> | null = null;
  const m = ble();

  const again = () => {
    if (stopped) return;
    onStatus('lost');
    if (retry) clearTimeout(retry);
    retry = setTimeout(go, 3000);
  };
  const go = async () => {
    if (stopped) return;
    const ready = await bleReady();
    if (stopped) return;
    if (ready === 'denied' || ready === 'unavailable') return onStatus('unavailable');
    if (ready === 'off') return again();
    try {
      let d: Device;
      d = (await m.isDeviceConnected(sensor.id).catch(() => false)) ? (await m.devices([sensor.id]))[0] : await m.connectToDevice(sensor.id, { timeout: 10000 });
      if (stopped) return void m.cancelDeviceConnection(sensor.id).catch(() => {});
      d = await d.discoverAllServicesAndCharacteristics();
      disc?.remove();
      disc = m.onDeviceDisconnected(sensor.id, () => {
        mon?.remove();
        mon = null;
        again();
      });
      mon?.remove();
      mon = m.monitorCharacteristicForDevice(d.id, HR_SERVICE, HR_MEASUREMENT, (err, c) => {
        if (err || !c?.value) return;
        const v = parseHr(c.value);
        if (v != null) {
          onStatus('live');
          onHr(v, Date.now());
        }
      });
      onStatus('waiting');
    } catch {
      again();
    }
  };
  onStatus('connecting');
  go();
  return () => {
    stopped = true;
    if (retry) clearTimeout(retry);
    mon?.remove();
    disc?.remove();
    m.cancelDeviceConnection(sensor.id).catch(() => {});
  };
}

/**
 * Apple Watch heart rate through Apple Health: new readings since `since` as they arrive (Apple tells the app when
 * there are new samples; also checked every 5 s in case a notice is missed). Only while a workout runs on the watch
 * does it measure every few seconds; otherwise it's every few minutes.
 */
export function streamAppleWatch(since: number, onHr: (bpm: number, at: number) => void, onStatus: (s: HrStatus) => void): () => void {
  if (Platform.OS !== 'ios') {
    onStatus('unavailable');
    return () => {};
  }
  let stopped = false;
  let anchor: string | undefined;
  let last = since;
  let busy = false;
  let sub: { remove: () => boolean } | null = null;
  let timer: ReturnType<typeof setInterval> | null = null;

  const pull = async () => {
    if (stopped || busy) return;
    busy = true;
    try {
      const r = await HK.queryQuantitySamplesWithAnchor('HKQuantityTypeIdentifierHeartRate', {
        anchor,
        limit: 0,
        unit: 'count/min',
        filter: { date: { startDate: new Date(since - 60_000), endDate: new Date(Date.now() + 60_000) } },
      });
      anchor = r.newAnchor;
      const xs = [...r.samples].map((s) => ({ at: new Date(s.endDate).getTime(), v: s.quantity })).filter((s) => s.at > last && s.v >= 25 && s.v <= 250).sort((a, b) => a.at - b.at);
      for (const s of xs) {
        last = s.at;
        onHr(Math.round(s.v), s.at);
      }
      if (xs.length) onStatus('live');
    } catch {}
    busy = false;
  };

  (async () => {
    try {
      if (!HK.isHealthDataAvailable()) return onStatus('unavailable');
      // Already asked when Apple Health was connected; asking again for heart rate only shows nothing new then.
      await HK.requestAuthorization({ toRead: ['HKQuantityTypeIdentifierHeartRate'] }).catch(() => false);
      if (stopped) return;
      onStatus('waiting');
      sub = HK.subscribeToChanges('HKQuantityTypeIdentifierHeartRate', () => {
        pull();
      });
      timer = setInterval(pull, 5000);
      pull();
    } catch {
      onStatus('unavailable');
    }
  })();
  return () => {
    stopped = true;
    sub?.remove();
    if (timer) clearInterval(timer);
  };
}
