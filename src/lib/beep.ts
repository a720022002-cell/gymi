import AsyncStorage from '@react-native-async-storage/async-storage';
import { Vibration } from 'react-native';

import { playTone } from './sound';

// ---------------------------------------------------------------------------
// Workout sound settings (owned by the Train area; the notifications screen uses this API).
// ---------------------------------------------------------------------------
/** rest: play the sound when the rest timer ends. sound: which one. */
export type SoundPrefs = { rest: boolean; sound: string };
/** Workout sounds (design: NSOUNDS.workout). */
export const SOUNDS: { id: string; name: string }[] = [
  { id: 'lightweight', name: '“Light weight!” voice' },
  { id: 'yeahbuddy', name: '“Yeah buddy!” voice' },
  { id: 'gymbell', name: 'Gym bell' },
  { id: 'horn', name: 'Air horn' },
  { id: 'default', name: 'Adro ding' },
  { id: 'none', name: 'None (silent)' },
];

const KEY = 'adro.sounds.v1';
const DEFAULT: SoundPrefs = { rest: true, sound: 'lightweight' };
let prefs: SoundPrefs | null = null;

export async function getSoundPrefs(): Promise<SoundPrefs> {
  if (prefs) return prefs;
  try {
    const v = await AsyncStorage.getItem(KEY);
    const p = v ? (JSON.parse(v) as Partial<SoundPrefs>) : {};
    prefs = { rest: typeof p.rest === 'boolean' ? p.rest : DEFAULT.rest, sound: SOUNDS.some((s) => s.id === p.sound) ? (p.sound as string) : DEFAULT.sound };
  } catch {
    prefs = DEFAULT;
  }
  return prefs;
}

export async function setSoundPrefs(p: SoundPrefs) {
  prefs = p;
  await AsyncStorage.setItem(KEY, JSON.stringify(p)).catch(() => {});
}

/** Play a sound now, e.g. when picking one in settings. */
export function previewSound(id: string) {
  playTone(id);
}

/** Rest is over: a buzz, and your chosen sound if rest sounds are on. */
export function restDone() {
  try {
    Vibration.vibrate([0, 200, 100, 200]);
  } catch {}
  getSoundPrefs()
    .then((p) => {
      if (p.rest) playTone(p.sound);
    })
    .catch(() => {});
}
