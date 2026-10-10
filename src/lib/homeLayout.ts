import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';

export const HOME_CARDS = ['calories', 'water', 'workout', 'readings', 'streak', 'insight'] as const;
export type HomeCard = (typeof HOME_CARDS)[number];
export const HOME_NAMES: Record<HomeCard, string> = { calories: 'Calories', water: 'Water', workout: 'Today’s workout', readings: 'Your readings', streak: 'Streaks', insight: 'Coach tip' };
export const RINGS = ['calories', 'protein', 'water', 'steps', 'workouts'] as const;
export type RingKey = (typeof RINGS)[number];
export const RING_NAMES: Record<RingKey, string> = { calories: 'Calories', protein: 'Protein', water: 'Water', steps: 'Steps', workouts: 'Workouts' };
export type HomeLayout = { order: HomeCard[]; hidden: HomeCard[]; rings: RingKey[] };
const KEY = 'gymi.home.v1';
const DEFAULT: HomeLayout = { order: [...HOME_CARDS], hidden: [], rings: ['calories'] };

let cache: HomeLayout | null = null;
const subs = new Set<(l: HomeLayout) => void>();

/** Which Home cards show and in what order (saved on this device). */
export function useHomeLayout() {
  const [l, setL] = useState<HomeLayout>(cache ?? DEFAULT);
  useEffect(() => {
    subs.add(setL);
    if (!cache)
      AsyncStorage.getItem(KEY)
        .then((v) => {
          const p = v ? (JSON.parse(v) as HomeLayout) : DEFAULT;
          const order = [...p.order.filter((k) => HOME_CARDS.includes(k)), ...HOME_CARDS.filter((k) => !p.order.includes(k))];
          const rings = (p.rings ?? ['calories']).filter((k) => RINGS.includes(k)).slice(0, 3);
          cache = { order, hidden: p.hidden.filter((k) => HOME_CARDS.includes(k)), rings: rings.length ? rings : ['calories'] };
          subs.forEach((f) => f(cache as HomeLayout));
        })
        .catch(() => {});
    return () => {
      subs.delete(setL);
    };
  }, []);
  const save = useCallback((next: HomeLayout) => {
    cache = next;
    subs.forEach((f) => f(next));
    AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => {});
  }, []);
  return [l, save] as const;
}
