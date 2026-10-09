import { useCallback } from 'react';

import { useSettings } from '@/theme/settings';

import { AR } from './ar';

type Vars = Record<string, string | number>;

function fill(s: string, vars?: Vars) {
  if (!vars) return s;
  return s.replace(/\{(\w+)\}/g, (_, k) => (vars[k] ?? `{${k}}`).toString());
}

/**
 * English text is the key (same approach as the design file).
 * Use {name} placeholders for values: t('Hi, {name}', { name }).
 */
export function translate(lang: 'en' | 'ar', en: string, vars?: Vars) {
  const s = lang === 'ar' ? (AR[en] ?? en) : en;
  return fill(s, vars);
}

export function useT() {
  const { lang, isRTL } = useSettings();
  const t = useCallback((en: string, vars?: Vars) => translate(lang, en, vars), [lang]);
  return { t, lang, isRTL };
}
