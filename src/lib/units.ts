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
  return useMemo(() => weightIn(unit, t), [unit, t]);
}

/** The same helpers for one exercise: in the unit you switched it to on the workout screen, else your usual unit. */
export function useExerciseWeight() {
  const { unit, exUnits } = useSettings();
  const { t } = useT();
  const kg = useMemo(() => weightIn('kg', t), [t]);
  const lb = useMemo(() => weightIn('lb', t), [t]);
  return useCallback((id?: string) => ((id && exUnits[id]) || unit) === 'lb' ? lb : kg, [exUnits, unit, kg, lb]);
}

function weightIn(unit: WeightUnit, t: (s: string) => string) {
  return {
    unit,
    label: t(unit),
    show: (kg: number) => String(toUnit(kg, unit)),
    num: (kg: number) => toUnit(kg, unit),
    toKg: (v: number) => fromUnit(v, unit),
    /** A sentence written with "kg" (or "كجم") in your unit's word. */
    words: (s: string) => (unit === 'lb' ? s.replace(/\bkg\b/g, 'lb').replace(/كجم|كغ/g, 'باوند') : s),
    /** A weight with its unit, like "80.4 kg" or "177.5 lb". */
    text: (kg: number) => `${toUnit(kg, unit)} ${t(unit)}`,
    step: unit === 'lb' ? 5 / LB : 2.5,
  };
}
