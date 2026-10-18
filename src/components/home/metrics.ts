import { router } from 'expo-router';

import { useRecovery } from '@/components/train/RecoveryCard';
import { useT } from '@/i18n';
import { useFood } from '@/lib/food';
import { type RingKey } from '@/lib/homeLayout';
import { recLabel } from '@/lib/recovery';
import { useTrain } from '@/lib/train';
import { fx } from '@/lib/progress';
import { useStreaks } from '@/lib/useProgress';
import { fmt } from '@/lib/nutrition';

type Metric = { v: number; max: number; big: string; txt: string; go: () => void };
export const RCOL = (c: { cobalt: string; up: string }) => [c.cobalt, c.up, '#F59E0B'];
export const STEP_GOAL = 10000;

/** Every ring's value, goal and the screen it opens (design: metricOf). */
export function useMetrics(): Record<RingKey, Metric> {
  const { t } = useT();
  const food = useFood();
  const train = useTrain();
  const s = useStreaks();
  const { r } = useRecovery();
  const e = food.eaten;
  const goal = food.dayGoal(food.day);
  const wGoal = food.plan.water || 2800;
  const planned = train.plan?.days ?? 0;
  const done = train.doneIdx.size;
  const c7 = s.c7.pct ?? 0;
  return {
    calories: { v: e.k, max: goal + food.burned, big: fmt(Math.max(0, food.kcalLeft)), txt: t('{n} kcal left', { n: fmt(Math.max(0, food.kcalLeft)) }), go: () => router.push('/food') },
    protein: { v: e.p, max: food.target.p, big: `${Math.round(e.p)}g`, txt: t('{a} of {b} g', { a: Math.round(e.p), b: food.target.p }), go: () => router.push('/food') },
    water: { v: food.water, max: wGoal, big: `${fx(food.water / 1000)}L`, txt: t('{a} of {b} ml', { a: fmt(food.water), b: fmt(wGoal) }), go: () => router.push('/water') },
    steps: { v: food.steps, max: STEP_GOAL, big: food.steps ? fmt(food.steps) : '--', txt: food.steps ? t('{a} of {b}', { a: fmt(food.steps), b: fmt(STEP_GOAL) }) : t('Connect a watch'), go: () => router.push('/devices') },
    recovery: { v: r.score, max: 100, big: `${r.score}%`, txt: t(recLabel(r.score)[0]), go: () => router.push('/recovery') },
    workouts: { v: done, max: Math.max(1, planned), big: `${done}/${planned}`, txt: t('{a} of {b} this week', { a: done, b: planned }), go: () => router.push('/train') },
    commit: { v: c7, max: 100, big: s.c7.pct == null ? '–' : `${c7}%`, txt: t('This week'), go: () => router.push({ pathname: '/progress', params: { tab: 'streaks' } }) },
  };
}
