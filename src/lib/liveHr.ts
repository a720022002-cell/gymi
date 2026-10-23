// Live heart rate for any screen (the live cardio session now; the strength workout can use it later): from a
// Bluetooth heart rate sensor or the Apple Watch, with how fresh it is. On the web it's always unavailable.
import { useEffect, useState } from 'react';

import { streamAppleWatch, streamBle } from './hrSensors';
import type { HrSource, HrStatus, SavedSensor } from './hrTypes';

export type { HrSource, HrStatus, SavedSensor } from './hrTypes';
export { appleWatchSupported, bleSupported, savedSensor, saveSensor, scanSensors } from './hrSensors';

/**
 * Start streaming heart rate from a source; returns stop. `since`: for the Apple Watch, readings before this time are
 * skipped (the start of the session).
 */
export function streamHeartRate(source: HrSource, opts: { sensor?: SavedSensor | null; since?: number }, onHr: (bpm: number, at: number) => void, onStatus: (s: HrStatus) => void): () => void {
  if (source === 'ble' && opts.sensor) return streamBle(opts.sensor, onHr, onStatus);
  if (source === 'apple') return streamAppleWatch(opts.since ?? Date.now(), onHr, onStatus);
  onStatus('off');
  return () => {};
}

/**
 * The latest heart rate while the screen is open. A reading older than 15 seconds counts as stale (bpm stays, `fresh`
 * turns false), so a screen can show it greyed out.
 */
export function useLiveHeartRate(source: HrSource, opts?: { sensor?: SavedSensor | null; since?: number; enabled?: boolean }) {
  const [state, setState] = useState<{ bpm: number | null; at: number | null; status: HrStatus }>({ bpm: null, at: null, status: 'off' });
  const [now, setNow] = useState(() => Date.now());
  const enabled = opts?.enabled ?? true;
  const sensorId = opts?.sensor?.id;
  const sensorName = opts?.sensor?.name;
  const since = opts?.since;
  useEffect(() => {
    if (!enabled || source === 'none') return;
    const stop = streamHeartRate(
      source,
      { sensor: sensorId ? { id: sensorId, name: sensorName ?? '' } : null, since },
      (bpm, at) => setState((s) => ({ ...s, bpm, at })),
      (status) => setState((s) => ({ ...s, status })),
    );
    const tick = setInterval(() => setNow(Date.now()), 5000);
    return () => {
      stop();
      clearInterval(tick);
      setState({ bpm: null, at: null, status: 'off' });
    };
  }, [source, sensorId, sensorName, since, enabled]);
  return { ...state, fresh: state.at != null && now - state.at < 15_000 };
}
