import { useMemo } from 'react';

import { useFood } from './food';
import { useHealth } from './health';
import { activeDays, badges, bestWorkoutStreak, commitment, overallStreak, type ProgressInput, weeklyCommitment, weeksAbove } from './progress';
import { useTrain } from './train';

/** Everything the progress math needs, from food, training and health. */
export function useProgressInput(): ProgressInput {
  const food = useFood();
  const train = useTrain();
  const health = useHealth();
  return useMemo(
    () => ({
      today: food.today,
      days: health.days,
      logs: train.logs,
      checkins: health.checkins,
      measures: health.measures,
      plan: train.setupDone ? train.plan : null,
      foodSetup: food.setupDone,
      kcal: food.target.k,
      protein: food.target.p,
      water: food.plan.water || 2800,
      goal: food.plan.goal,
    }),
    [food.today, health.days, train.logs, health.checkins, health.measures, train.setupDone, train.plan, food.setupDone, food.target.k, food.target.p, food.plan.water, food.plan.goal],
  );
}

/** Streaks, commitment and badges. */
export function useStreaks() {
  const x = useProgressInput();
  const { streak: workouts } = useTrain();
  return useMemo(() => {
    const active = activeDays(x);
    const o = overallStreak(active, x.today);
    const c7 = commitment(x, 7, active);
    const c30 = commitment(x, 30, active);
    const hist = weeklyCommitment(x, active);
    const above = weeksAbove(hist);
    const bestWorkouts = bestWorkoutStreak(x, workouts);
    return {
      x,
      active,
      overall: o.streak,
      best: o.best,
      workouts,
      bestWorkouts,
      c7,
      c30,
      commitment: c30.pct,
      hist,
      above,
      badges: badges(x, o.best),
    };
  }, [x, workouts]);
}
