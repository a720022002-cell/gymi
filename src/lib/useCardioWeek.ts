import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { useAuth } from './auth';
import { type CardioLogRef, type CardioSession, cardioDone, cardioStatus, cardioWeek, weekSummary } from './cardioPlan';
import { useFood } from './food';
import { addDays } from './nutrition';
import { supabase } from './supabase';
import { useTrain } from './train';
import { weekStart } from './training';

/**
 * This week's planned cardio (from the training plan) and which sessions are done: a cardio_logs row tied to the
 * session (plan_ref, read only when the column exists) or any cardio logged that day, and cardio the watch recorded today.
 * Fetched again when today's cardio changes and when the screen comes back into view.
 */
export function useCardioWeek() {
  const train = useTrain();
  const food = useFood();
  const { session } = useAuth();
  const uid = session?.user.id;
  const start = weekStart(train.today);
  const cardio = train.plan?.cardio;
  const sessions = useMemo(() => cardioWeek(cardio, train.week, start), [cardio, train.week, start]);
  const [rows, setRows] = useState<{ key: string; xs: CardioLogRef[] } | null>(null);
  const [tick, setTick] = useState(0);
  useFocusEffect(useCallback(() => setTick((n) => n + 1), []));
  const todayCount = food.isToday ? food.cardio.length : -1;
  const any = sessions.length > 0;
  const key = `${uid}:${start}`;
  useEffect(() => {
    if (!uid || !any) return;
    let alive = true;
    supabase
      .from('cardio_logs')
      // Every column, so plan_ref is read when it's there (and nothing breaks when it isn't).
      .select('*')
      .gte('day', start)
      .lte('day', addDays(start, 6))
      .limit(200)
      .then(({ data, error }) => {
        if (!alive || error) return;
        const xs = ((data as { day: string; plan_ref?: string | null }[] | null) ?? []).map((r) => ({ day: r.day, plan_ref: typeof r.plan_ref === 'string' ? r.plan_ref : null }));
        setRows({ key: `${uid}:${start}`, xs });
      });
    return () => {
      alive = false;
    };
  }, [uid, start, any, todayCount, tick]);
  const logs = useMemo(() => {
    const xs = rows && rows.key === key ? rows.xs : [];
    // Cardio the watch recorded today counts too (it isn't saved in cardio_logs).
    return food.isToday && food.cardio.some((x) => x.watch) ? [...xs, { day: train.today }] : xs;
  }, [rows, key, food.isToday, food.cardio, train.today]);
  const done = useMemo(() => cardioDone(sessions, logs), [sessions, logs]);
  const today = sessions.find((s) => s.date === train.today) ?? null;
  const next = sessions.find((s) => s.date > train.today && !done.has(s.id)) ?? null;
  return {
    plan: cardio ?? null,
    sessions,
    done,
    status: (s: CardioSession) => cardioStatus(s, done, train.today),
    today,
    todayDone: !!today && done.has(today.id),
    next,
    summary: weekSummary(sessions),
    doneCount: sessions.filter((s) => done.has(s.id)).length,
  };
}
