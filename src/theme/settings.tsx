import AsyncStorage from '@react-native-async-storage/async-storage';
import { getLocales } from 'expo-localization';
import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { AccessibilityInfo, I18nManager, Platform, useColorScheme } from 'react-native';

import { type ColorTokens, dark, light } from './tokens';

export type ThemePref = 'system' | 'light' | 'dark';
export type Lang = 'en' | 'ar';

type Stored = {
  theme: ThemePref;
  lang: Lang | null; // null = not chosen yet, follow the device
  reduce: boolean;
};

type Settings = {
  ready: boolean;
  theme: ThemePref;
  isDark: boolean;
  colors: ColorTokens;
  lang: Lang;
  langChosen: boolean;
  isRTL: boolean;
  /** Effective value: the in-app switch OR the phone's accessibility setting. */
  reduceTransparency: boolean;
  reduceSetting: boolean;
  setTheme: (t: ThemePref) => void;
  setLang: (l: Lang) => void;
  setReduce: (r: boolean) => void;
};

const KEY = 'gymi.settings.v1';
const DEFAULTS: Stored = { theme: 'system', lang: null, reduce: false };

const Ctx = createContext<Settings | null>(null);

function deviceLang(): Lang {
  try {
    return getLocales()[0]?.languageCode === 'ar' ? 'ar' : 'en';
  } catch {
    return 'en';
  }
}

/** Is "Reduce Transparency" turned on at the system level? */
function useSystemReduceTransparency() {
  const [on, setOn] = useState(false);
  useEffect(() => {
    if (Platform.OS === 'web') {
      if (typeof window === 'undefined' || !window.matchMedia) return;
      const mq = window.matchMedia('(prefers-reduced-transparency: reduce)');
      const update = () => setOn(mq.matches);
      update();
      mq.addEventListener?.('change', update);
      return () => mq.removeEventListener?.('change', update);
    }
    AccessibilityInfo.isReduceTransparencyEnabled?.().then(setOn).catch(() => {});
    const sub = AccessibilityInfo.addEventListener?.('reduceTransparencyChanged', setOn);
    return () => sub?.remove();
  }, []);
  return on;
}

export function SettingsProvider({ children }: PropsWithChildren) {
  const [stored, setStored] = useState<Stored>(DEFAULTS);
  const [ready, setReady] = useState(false);
  const scheme = useColorScheme();
  const systemReduce = useSystemReduceTransparency();

  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then((raw) => {
        if (raw) setStored({ ...DEFAULTS, ...JSON.parse(raw) });
      })
      .catch(() => {})
      .finally(() => setReady(true));
  }, []);

  const save = useCallback((patch: Partial<Stored>) => {
    setStored((prev) => {
      const next = { ...prev, ...patch };
      AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  const lang: Lang = stored.lang ?? deviceLang();
  const isRTL = lang === 'ar';
  const isDark = stored.theme === 'dark' || (stored.theme === 'system' && scheme === 'dark');

  // Mirror the whole layout for Arabic. On the web the browser does it from `dir`.
  useEffect(() => {
    if (Platform.OS === 'web') {
      if (typeof document === 'undefined') return;
      document.documentElement.dir = isRTL ? 'rtl' : 'ltr';
      document.documentElement.lang = lang;
    } else if (I18nManager.isRTL !== isRTL) {
      // Native apps need a restart to flip direction. Handled when we ship native builds.
      I18nManager.allowRTL(isRTL);
      I18nManager.forceRTL(isRTL);
    }
  }, [isRTL, lang]);

  // Keep the browser chrome (status bar area) matching the theme.
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    document.body.style.background = isDark ? dark.bg : light.bg;
    document.documentElement.style.colorScheme = isDark ? 'dark' : 'light';
    document.querySelectorAll('meta[name="theme-color"]').forEach((m) => {
      m.setAttribute('content', isDark ? dark.bg : light.bg);
    });
  }, [isDark]);

  const value = useMemo<Settings>(
    () => ({
      ready,
      theme: stored.theme,
      isDark,
      colors: isDark ? dark : light,
      lang,
      langChosen: stored.lang !== null,
      isRTL,
      reduceTransparency: stored.reduce || systemReduce,
      reduceSetting: stored.reduce,
      setTheme: (theme) => save({ theme }),
      setLang: (l) => save({ lang: l }),
      setReduce: (reduce) => save({ reduce }),
    }),
    [ready, stored, isDark, lang, isRTL, systemReduce, save],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSettings() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useSettings must be used inside SettingsProvider');
  return v;
}

export const useColors = () => useSettings().colors;
