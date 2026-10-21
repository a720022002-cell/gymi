import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSyncExternalStore } from 'react';

// Permission to send things to the outside AI service (asked once, before the first AI answer). The App Store asks
// apps to get it before sharing personal data with a third-party AI.

const KEY = 'adro.aiConsent.v1';
type State = { value: 'yes' | 'no' | null; asking: boolean };
let state: State = { value: null, asking: false };
const subs = new Set<() => void>();
const set = (p: Partial<State>) => {
  state = { ...state, ...p };
  subs.forEach((f) => f());
};
const loaded = AsyncStorage.getItem(KEY)
  .then((v) => set({ value: v === 'yes' || v === 'no' ? v : null }))
  .catch(() => {});
// "Not now" only skips the question until the app opens again.
let askedThisRun = false;
// AI actions waiting for your answer: Allow lets them go on, Not now stops them.
let waiting: ((ok: boolean) => void)[] = [];
const answer = (ok: boolean) => {
  const w = waiting;
  waiting = [];
  w.forEach((f) => f(ok));
};

/** True when AI is allowed. Otherwise opens the question (once per app run, unless turned off in settings) and waits for it. */
export async function aiAllowed(): Promise<boolean> {
  await loaded;
  if (state.value === 'yes') return true;
  if (state.value === null && (!askedThisRun || state.asking)) {
    askedThisRun = true;
    set({ asking: true });
    return new Promise<boolean>((res) => waiting.push(res));
  }
  return false;
}

export function setAiConsent(on: boolean) {
  set({ value: on ? 'yes' : 'no', asking: false });
  AsyncStorage.setItem(KEY, on ? 'yes' : 'no').catch(() => {});
  answer(on);
}

export function closeAiConsent() {
  set({ asking: false });
  answer(false);
}

/** Logging out: the next person on this phone is asked for themselves. */
export async function clearAiConsent() {
  askedThisRun = false;
  set({ value: null, asking: false });
  answer(false);
  await AsyncStorage.removeItem(KEY).catch(() => {});
}

export function useAiConsent() {
  return useSyncExternalStore(
    (f) => {
      subs.add(f);
      return () => subs.delete(f);
    },
    () => state,
  );
}
