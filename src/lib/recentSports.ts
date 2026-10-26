import AsyncStorage from '@react-native-async-storage/async-storage';

import type { SportId } from './sports';

const KEY = 'adro.recentSports.v1';

/** Your last sports (newest first), kept on this phone, for "Recent" on top of the sport list. */
export async function recentSports(): Promise<SportId[]> {
  try {
    const v = await AsyncStorage.getItem(KEY);
    return v ? (JSON.parse(v) as SportId[]) : [];
  } catch {
    return [];
  }
}

export async function addRecentSport(id: SportId) {
  const xs = await recentSports();
  await AsyncStorage.setItem(KEY, JSON.stringify([id, ...xs.filter((x) => x !== id)].slice(0, 5))).catch(() => {});
}
