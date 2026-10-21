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

/** True when AI is allowed. Otherwise opens the question (once per app run, unless turned off in settings). */
export async function aiAllowed() {
  await loaded;
  if (state.value === 'yes') return true;
  if (state.value === null && !askedThisRun) {
    askedThisRun = true;
    set({ asking: true });
  }
  return false;
}

export function setAiConsent(on: boolean) {
  set({ value: on ? 'yes' : 'no', asking: false });
  AsyncStorage.setItem(KEY, on ? 'yes' : 'no').catch(() => {});
}

export function closeAiConsent() {
  set({ asking: false });
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
