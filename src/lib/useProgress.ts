import { useEffect, useMemo, useState } from 'react';

import { useAuth } from './auth';
import { type GoalRow, loadGoalRows } from './dayGoals';
import { useWatchSleep } from './devices';
import { useFood } from './food';
import { useHealth } from './health';
import { addDays } from './nutrition';
import { loadKcalExtras } from './report';
import { activeDays, badges, commitment, overallStreak, type ProgressInput, weeklyCommitment, weeksAbove } from './progress';
import { useTrain } from './train';

/** Everything the progress math needs, from food, training and health. */
export function useProgressInput(): ProgressInput {
  const food = useFood();
  const train = useTrain();
  const health = useHealth();
  const { session } = useAuth();
  // Each day's own calorie goal (moves and cardio) for the last 9 weeks; loaded again when today's change.
  const from = addDays(food.today, -63);
  const [extra, setExtra] = useState<{ from: string; v: Record<string, number> } | null>(null);
  const todayKey = `${food.isToday ? food.moves.length : ''}|${food.isToday ? food.burned : ''}`;
  useEffect(() => {
    let alive = true;
    loadKcalExtras(from, food.today)
      .then((v) => alive && setExtra({ from, v }))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [from, food.today, todayKey]);
  const kcalExtra = extra?.from === from ? extra.v : undefined;
  // Each day's saved goals (about the last three years), so earlier days keep the goals they had.
  const [goals, setGoals] = useState<{ today: string; rows: GoalRow[] } | null>(null);
  useEffect(() => {
    let alive = true;
    loadGoalRows(addDays(food.today, -1000), food.today).then((rows) => alive && setGoals({ today: food.today, rows }));
    return () => {
      alive = false;
    };
  }, [food.today]);
  const goalRows = goals?.today === food.today ? goals.rows : null;
  const watchSleep = useWatchSleep(session?.user.id);
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
      life: train.history,
      kcalExtra,
      watchSleep,
      goals: goalRows,
    }),
    [food.today, health.days, train.logs, health.checkins, health.measures, train.setupDone, train.plan, food.setupDone, food.target.k, food.target.p, food.plan.water, food.plan.goal, train.history, kcalExtra, watchSleep, goalRows],
  );
}

/** Streaks, commitment and badges. */
export function useStreaks() {
  const x = useProgressInput();
  // Workouts in a row and the best run: the same rule as Train and the widgets (workoutStreak).
  const { streak: workouts, bestStreak } = useTrain();
  return useMemo(() => {
    const active = activeDays(x);
    const o = overallStreak(active, x.today);
    const c7 = commitment(x, 7, active);
    const c30 = commitment(x, 30, active);
    const hist = weeklyCommitment(x, active);
    const above = weeksAbove(hist);
    const bestWorkouts = Math.max(bestStreak, workouts);
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
  }, [x, workouts, bestStreak]);
}
