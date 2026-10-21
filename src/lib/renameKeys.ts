import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

// The app was called Gymi: what it saved on this device was under "gymi." keys. Move them to "adro." once, before
// anything reads them. On the web it's the browser's storage and runs right away; on a phone it's async, and the app
// waits for it (keysReady) behind the splash screen.
const OLD = 'gymi.';
const NEW = 'adro.';

/** Done once the old keys are moved. Nothing reads saved data before this (the root layout waits for it). */
export const keysReady: Promise<void> =
  Platform.OS === 'web'
    ? Promise.resolve()
    : (async () => {
        const keys = (await AsyncStorage.getAllKeys()).filter((k) => k.startsWith(OLD));
        if (!keys.length) return;
        const pairs = await AsyncStorage.multiGet(keys);
        // An "adro." key that's already there is newer: it stays.
        const have = new Set(await AsyncStorage.getAllKeys());
        await AsyncStorage.multiSet(pairs.filter(([k, v]) => v != null && !have.has(NEW + k.slice(OLD.length))).map(([k, v]) => [NEW + k.slice(OLD.length), v as string]));
        await AsyncStorage.multiRemove(keys);
      })().catch(() => {});

if (Platform.OS === 'web' && typeof window !== 'undefined' && window.localStorage) {
  try {
    const ls = window.localStorage;
    const keys = Array.from({ length: ls.length }, (_, i) => ls.key(i)).filter((k): k is string => !!k && k.startsWith(OLD));
    for (const k of keys) {
      const v = ls.getItem(k);
      if (v != null && ls.getItem(NEW + k.slice(OLD.length)) == null) ls.setItem(NEW + k.slice(OLD.length), v);
      ls.removeItem(k);
    }
  } catch {}
}
