import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';

const KEY = 'gymi.coachMode.v1';
let cache: boolean | null = null;
const subs = new Set<(v: boolean) => void>();

/** Coaches can switch between the coach view (Clients, Programs, Messages, Me) and their own training. */
export function useCoachMode() {
  const [v, setV] = useState(cache ?? false);
  useEffect(() => {
    subs.add(setV);
    if (cache === null)
      AsyncStorage.getItem(KEY)
        .then((x) => {
          cache = x === '1';
          subs.forEach((f) => f(cache as boolean));
        })
        .catch(() => {});
    return () => {
      subs.delete(setV);
    };
  }, []);
  const set = useCallback((next: boolean) => {
    cache = next;
    subs.forEach((f) => f(next));
    AsyncStorage.setItem(KEY, next ? '1' : '0').catch(() => {});
  }, []);
  return [v, set] as const;
}
