import { useCallback, useMemo } from 'react';

import { useT } from '@/i18n';
import { useSettings, type WeightUnit } from '@/theme/settings';

export const LB = 2.2046226218;

/** kg to the unit you picked, rounded for showing (lb to the nearest 0.5, kg to 0.1). */
export const toUnit = (kg: number, unit: WeightUnit) => (unit === 'lb' ? Math.round(kg * LB * 2) / 2 : Math.round(kg * 10) / 10);
/** A number typed in your unit, back to kg (kept precise so it shows the same again). */
export const fromUnit = (v: number, unit: WeightUnit) => (unit === 'lb' ? Math.round((v / LB) * 10000) / 10000 : v);

/** Weights (gym and body weight) in kg or lb. Saved weights are always kg: `show` turns kg into text in your unit,
 * `toKg` turns what you typed into kg, `step` is one weight jump in kg (2.5 kg, or 5 lb). */
export function useWeight() {
  const { unit } = useSettings();
  const { t } = useT();
  const show = useCallback((kg: number) => String(toUnit(kg, unit)), [unit]);
  const num = useCallback((kg: number) => toUnit(kg, unit), [unit]);
  const toKg = useCallback((v: number) => fromUnit(v, unit), [unit]);
  /** A sentence written with "kg" (or "كجم") in your unit's word. */
  const words = useCallback((s: string) => (unit === 'lb' ? s.replace(/\bkg\b/g, 'lb').replace(/كجم|كغ/g, 'باوند') : s), [unit]);
  /** A weight with its unit, like "80.4 kg" or "177.5 lb". */
  const text = useCallback((kg: number) => `${toUnit(kg, unit)} ${t(unit)}`, [unit, t]);
  return useMemo(() => ({ unit, label: t(unit), show, num, toKg, words, text, step: unit === 'lb' ? 5 / LB : 2.5 }), [unit, t, show, num, toKg, words, text]);
}
