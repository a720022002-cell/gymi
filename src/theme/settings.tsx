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
import { I18nManager, Platform, useColorScheme } from 'react-native';

import { type ColorTokens, dark, light } from './tokens';

export type ThemePref = 'system' | 'light' | 'dark';
export type Lang = 'en' | 'ar';
/** Unit for gym weights. Everything is saved in kg; lb is only for showing and typing. */
export type WeightUnit = 'kg' | 'lb';

type Stored = {
  theme: ThemePref;
  lang: Lang | null; // null = not chosen yet, follow the device
  reduce: boolean;
  unit: WeightUnit;
  /** Reduce transparency was switched off once for everyone (it's off by default now). */
  reduceReset?: boolean;
};

type Settings = {
  ready: boolean;
  theme: ThemePref;
  isDark: boolean;
  colors: ColorTokens;
  lang: Lang;
  langChosen: boolean;
  isRTL: boolean;
  /** Solid instead of glass: only the in-app switch (off by default). */
  reduceTransparency: boolean;
  reduceSetting: boolean;
  setTheme: (t: ThemePref) => void;
  setLang: (l: Lang) => void;
  setReduce: (r: boolean) => void;
  unit: WeightUnit;
  setUnit: (u: WeightUnit) => void;
};

const KEY = 'gymi.settings.v1';
const DEFAULTS: Stored = { theme: 'system', lang: null, reduce: false, unit: 'kg', reduceReset: true };

const Ctx = createContext<Settings | null>(null);

function deviceLang(): Lang {
  try {
    return getLocales()[0]?.languageCode === 'ar' ? 'ar' : 'en';
  } catch {
    return 'en';
  }
}

export function SettingsProvider({ children }: PropsWithChildren) {
  const [stored, setStored] = useState<Stored>(DEFAULTS);
  const [ready, setReady] = useState(false);
  const scheme = useColorScheme();

  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then((raw) => {
        if (!raw) return;
        const old = JSON.parse(raw) as Partial<Stored>;
        const saved = { ...DEFAULTS, ...old } as Stored;
        // Once: glass on for everyone, including people who turned the switch on before. They can turn it back on.
        if (!old.reduceReset) {
          saved.reduce = false;
          saved.reduceReset = true;
          AsyncStorage.setItem(KEY, JSON.stringify(saved)).catch(() => {});
        }
        setStored(saved);
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
      reduceTransparency: stored.reduce,
      reduceSetting: stored.reduce,
      setTheme: (theme) => save({ theme }),
      setLang: (l) => save({ lang: l }),
      setReduce: (reduce) => save({ reduce }),
      unit: stored.unit === 'lb' ? 'lb' : 'kg',
      setUnit: (unit) => save({ unit }),
    }),
    [ready, stored, isDark, lang, isRTL, save],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSettings() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useSettings must be used inside SettingsProvider');
  return v;
}

export const useColors = () => useSettings().colors;
