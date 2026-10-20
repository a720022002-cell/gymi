import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';

/** 'cycle' shows for women only. */
export const HOME_CARDS = ['calories', 'water', 'workout', 'cycle', 'readings', 'streak', 'insight'] as const;
export type HomeCard = (typeof HOME_CARDS)[number];
export const HOME_NAMES: Record<HomeCard, string> = { calories: 'Calories', water: 'Water', workout: 'Today’s workout', readings: 'Your readings', streak: 'Streaks', insight: 'Coach tip', cycle: 'Cycle' };
/** What the main ring on Home can show (design: RINGS). */
export const RINGS = ['calories', 'protein', 'water', 'steps', 'recovery', 'workouts', 'commit'] as const;
export type RingKey = (typeof RINGS)[number];
export const RING_NAMES: Record<RingKey, string> = { calories: 'Calories', protein: 'Protein', water: 'Water', steps: 'Steps', recovery: 'Recovery', workouts: 'Workouts this week', commit: 'Commitment' };
export const RING_INFO: Record<RingKey, { icon: 'food' | 'check' | 'drop' | 'walk' | 'pulse' | 'train' | 'flame'; desc: string }> = {
  calories: { icon: 'food', desc: 'Calories left, with protein, carbs and fat' },
  protein: { icon: 'check', desc: 'Grams of protein toward your goal' },
  water: { icon: 'drop', desc: 'Water toward your daily goal' },
  steps: { icon: 'walk', desc: 'Steps from your phone or watch' },
  recovery: { icon: 'pulse', desc: 'How ready your body is today' },
  workouts: { icon: 'train', desc: 'Workouts done vs planned' },
  commit: { icon: 'flame', desc: 'How well you stuck to your plan this week' },
};
export type HomeLayout = { order: HomeCard[]; hidden: HomeCard[]; rings: RingKey[] };
const KEY = 'adro.home.v1';
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
          const order = p.order.filter((k) => HOME_CARDS.includes(k));
          // New cards go where they sit by default (Cycle right after the workout), not at the bottom.
          for (const k of HOME_CARDS) if (!order.includes(k)) order.splice(Math.min(order.length, HOME_CARDS.indexOf(k)), 0, k);
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
