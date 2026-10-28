import { router } from 'expo-router';

import { useRecovery } from '@/components/train/RecoveryCard';
import { useT } from '@/i18n';
import { useAuth } from '@/lib/auth';
import { useStepGoal } from '@/lib/devices';
import { useFood } from '@/lib/food';
import { type RingKey, useHomeLayout } from '@/lib/homeLayout';
import { recLabel } from '@/lib/recovery';
import { useTrain } from '@/lib/train';
import { missedDays } from '@/lib/training';
import { commitWindow, firstDay, fx } from '@/lib/progress';
import { useStreaks } from '@/lib/useProgress';
import { addDays, fmt } from '@/lib/nutrition';

type Metric = { v: number; max: number; big: string; txt: string; go: () => void };
export const RCOL = (c: { cobalt: string; up: string }) => [c.cobalt, c.up, '#F59E0B'];

/** Your rings: the same on every day (an earlier day shows that day's values). */
export function useDayRings(): RingKey[] {
  const [layout] = useHomeLayout();
  return layout.rings;
}

/** Commitment for the day on screen: this week today; on an earlier day, the 7 days up to that day. */
export function useDayCommit() {
  const food = useFood();
  const s = useStreaks();
  return food.isToday ? s.c7 : commitWindow(s.x, addDays(food.day, -6), food.day, firstDay(s.active));
}

/** Every ring's value, goal and the screen it opens (design: metricOf). */
export function useMetrics(): Record<RingKey, Metric> {
  const { t } = useT();
  const food = useFood();
  const { session } = useAuth();
  const STEP_GOAL = useStepGoal(session?.user.id);
  const train = useTrain();
  const { r } = useRecovery(food.day);
  const cm = useDayCommit();
  const e = food.eaten;
  const goal = food.dayGoal(food.day);
  const wGoal = food.waterGoal;
  const planned = train.plan?.days ?? 0;
  const done = train.doneIdx.size;
  // An earlier day: that day's workout (planned only when it really was: breaks and skipped days don't count).
  const dayDone = train.logs.some((l) => l.day === food.day);
  const dayPlanned = !!train.plan && missedDays(train.plan, new Set(train.logs.map((l) => l.day)), food.day, food.day).has(food.day);
  const c7 = cm.pct ?? 0;
  return {
    calories: { v: e.k, max: goal + food.burned, big: fmt(Math.max(0, food.kcalLeft)), txt: t('{n} kcal left', { n: fmt(Math.max(0, food.kcalLeft)) }), go: () => router.push('/food') },
    protein: { v: e.p, max: food.dayTarget.p, big: `${Math.round(e.p)}g`, txt: t('{a} of {b} g', { a: Math.round(e.p), b: food.dayTarget.p }), go: () => router.push('/food') },
    water: { v: food.water, max: wGoal, big: `${fx(food.water / 1000)}L`, txt: t('{a} of {b} ml', { a: fmt(food.water), b: fmt(wGoal) }), go: () => router.push('/water') },
    steps: { v: food.steps, max: STEP_GOAL, big: food.steps ? fmt(food.steps) : '--', txt: food.steps ? t('{a} of {b}', { a: fmt(food.steps), b: fmt(STEP_GOAL) }) : t('Connect a watch'), go: () => router.push('/devices') },
    recovery: { v: r.score, max: 100, big: `${r.score}%`, txt: t(recLabel(r.score)[0]), go: () => router.push('/recovery') },
    workouts: food.isToday
      ? { v: done, max: Math.max(1, planned), big: `${done}/${planned}`, txt: t('{a} of {b} this week', { a: done, b: planned }), go: () => router.push('/train') }
      : { v: dayDone ? 1 : 0, max: 1, big: dayDone ? '1' : '0', txt: t(dayDone ? 'Workout done' : dayPlanned ? 'Missed' : 'Rest day'), go: () => router.push('/train') },
    commit: { v: c7, max: 100, big: cm.pct == null ? '–' : `${c7}%`, txt: t(food.isToday ? 'This week' : 'Last 7 days'), go: () => router.push({ pathname: '/progress', params: { tab: 'streaks', sub: '0' } }) },
  };
}
