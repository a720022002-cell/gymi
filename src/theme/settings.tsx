import AsyncStorage from '@react-native-async-storage/async-storage';
import { reloadAppAsync } from 'expo';
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
/** Unit for gym weights. Everything is saved in kg; lb is only for showing and typing. */
export type WeightUnit = 'kg' | 'lb';

type Stored = {
  theme: ThemePref;
  lang: Lang | null; // null = not chosen yet, follow the device
  reduce: boolean;
  unit: WeightUnit;
  /** Reduce transparency was switched off once for everyone (it's off by default now). */
  reduceReset?: boolean;
  /** Show the workout on the Lock Screen and in the Dynamic Island (iPhone). On unless turned off. */
  liveActivity?: boolean;
};

type Settings = {
  ready: boolean;
  theme: ThemePref;
  isDark: boolean;
  colors: ColorTokens;
  lang: Lang;
  langChosen: boolean;
  isRTL: boolean;
  /** Effective value: the in-app switch (off by default) OR the phone's accessibility setting. */
  reduceTransparency: boolean;
  reduceSetting: boolean;
  setTheme: (t: ThemePref) => void;
  /** resume: a screen to open again after the restart Arabic needs on phones (e.g. during sign-up). */
  setLang: (l: Lang, resume?: string) => void;
  setReduce: (r: boolean) => void;
  unit: WeightUnit;
  setUnit: (u: WeightUnit) => void;
  liveActivity: boolean;
  setLiveActivity: (on: boolean) => void;
};

const KEY = 'adro.settings.v1';
/** The screen to reopen after a language restart (read once by the root layout). */
export const RESUME_KEY = 'adro.resume.v1';
/** The layout direction the app last restarted for (see the direction effect below). */
const DIR_KEY = 'adro.dir.v1';
const DEFAULTS: Stored = { theme: 'system', lang: null, reduce: false, unit: 'kg', reduceReset: true };

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
    } else if (ready && I18nManager.isRTL !== isRTL) {
      // Phone apps flip direction on the next start (choosing a language in the app restarts it right away). The first
      // time the app opens in Arabic (from the phone's language) it restarts once now, so the welcome screens aren't
      // half mirrored; only once per direction, so it can never keep restarting.
      I18nManager.allowRTL(isRTL);
      I18nManager.forceRTL(isRTL);
      const want = isRTL ? 'rtl' : 'ltr';
      AsyncStorage.getItem(DIR_KEY)
        .then((tried) => {
          if (tried === want) return;
          return AsyncStorage.setItem(DIR_KEY, want).then(() => reloadAppAsync('Layout direction'));
        })
        .catch(() => {});
    }
  }, [isRTL, lang, ready]);

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
      setLang: (l, resume) => {
        save({ lang: l });
        // The phone app only flips left and right after a restart: save the choice first, then restart on the new side.
        const rtl = l === 'ar';
        if (Platform.OS !== 'web' && I18nManager.isRTL !== rtl) {
          I18nManager.allowRTL(rtl);
          I18nManager.forceRTL(rtl);
          AsyncStorage.setItem(KEY, JSON.stringify({ ...stored, lang: l }))
            .then(() => (resume ? AsyncStorage.setItem(RESUME_KEY, resume) : undefined))
            .then(() => reloadAppAsync('Language changed'))
            .catch(() => {});
        }
      },
      setReduce: (reduce) => save({ reduce }),
      unit: stored.unit === 'lb' ? 'lb' : 'kg',
      setUnit: (unit) => save({ unit }),
      liveActivity: stored.liveActivity !== false,
      setLiveActivity: (liveActivity) => save({ liveActivity }),
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
