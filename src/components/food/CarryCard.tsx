import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { useT } from '@/i18n';
import { useFood } from '@/lib/food';
import { addDays, fmt } from '@/lib/nutrition';
import { supabase } from '@/lib/supabase';
import { useSettings } from '@/theme/settings';

import { Icon } from '../Icon';
import { Text } from '../Text';
import { useToast } from '../Toast';
import { Button, Card, Row } from '../ui';

/** Most a day goes up by when catching up (a much bigger day is hard to eat). */
const DAY_MAX = 800;

/**
 * Yesterday ended well under your calories while you're gaining (or keeping your weight): add what was left to today,
 * or spread it over the next days. Asked once a day, only when yesterday was logged.
 */
export function CarryCard() {
  const { t } = useT();
  const { colors: c } = useSettings();
  const toast = useToast();
  const food = useFood();
  const today = food.today;
  const yesterday = addDays(today, -1);
  const [left, setLeft] = useState<{ day: string; kcal: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const goal = food.plan.goal;
  const ask = food.ready && food.setupDone && food.isToday && !food.coach && !food.preg && goal <= 2 && food.plan.carryDay !== today;
  const base = food.goalsFor(yesterday).kcal;

  useEffect(() => {
    if (!ask) return;
    let alive = true;
    (async () => {
      const [logs, moves] = await Promise.all([
        supabase.from('food_logs').select('kcal').eq('day', yesterday),
        supabase.from('calorie_moves').select('kcal,kind').eq('day', yesterday),
      ]);
      if (!alive || logs.error || moves.error) return;
      const eaten = (logs.data ?? []).reduce((a, x) => a + Number(x.kcal || 0), 0);
      const mv = (moves.data ?? []) as { kcal: number; kind: string | null }[];
      // Not tracked yesterday, or yesterday's leftover was already moved (a balancing taken off yesterday): nothing to ask.
      if (eaten < 400 || mv.some((m) => m.kind === 'balance' && Number(m.kcal) < 0)) return setLeft({ day: today, kcal: 0 });
      const k = Math.round((base + mv.reduce((a, m) => a + Number(m.kcal || 0), 0) - eaten) / 10) * 10;
      setLeft({ day: today, kcal: k });
    })();
    return () => {
      alive = false;
    };
  }, [ask, today, yesterday, base]);

  const kcal = left?.day === today ? left.kcal : 0;
  if (!ask || kcal < 300) return null;
  const todayAdd = Math.min(kcal, DAY_MAX);
  const spread = Math.min(kcal, DAY_MAX * 3);
  const per = Math.round(spread / 3 / 10) * 10;

  const apply = async (days: string[], each: number) => {
    setBusy(true);
    const total = each * days.length;
    // Yesterday gives up what moves on, so it isn't offered again.
    const added = await food.addMoves([{ day: yesterday, kcal: -total }, ...days.map((day) => ({ day, kcal: each }))], 'balance');
    await food.updatePlan({ carryDay: today });
    setBusy(false);
    if (!added.length) return toast(t('Couldn’t save. Please try again.'), { icon: 'warn' });
    toast(days.length === 1 ? t('+{n} kcal added to today', { n: fmt(each) }) : t('+{n} kcal a day for the next {d} days', { n: fmt(each), d: days.length }), {
      ai: true,
      undo: () => food.removeMoves(added.map((a) => a.id)),
    });
  };

  return (
    <Card>
      <Row gap={10} style={{ alignItems: 'flex-start' }}>
        <Icon name="flame" color={c.cobalt} />
        <View style={{ flex: 1 }}>
          <Text weight={700}>{t('You had {n} kcal left yesterday', { n: fmt(kcal) })}</Text>
          <Text variant="small" color="sec" style={{ marginTop: 2 }}>
            {goal <= 1 ? t('To keep gaining, you can make it up. Add it to today, or spread it over the next days.') : t('If you’re hungry, you can make it up. Add it to today, or spread it over the next days.')}
          </Text>
        </View>
      </Row>
      <Row gap={8} style={{ marginTop: 12, flexWrap: 'wrap' }}>
        <Button small disabled={busy} title={t('Today +{n}', { n: fmt(todayAdd) })} onPress={() => apply([today], todayAdd)} />
        <Button small kind="glass" disabled={busy} title={t('3 days +{n}', { n: fmt(per) })} onPress={() => apply([today, addDays(today, 1), addDays(today, 2)], per)} />
        <Button small kind="ghost" disabled={busy} title={t('Not now')} onPress={() => food.updatePlan({ carryDay: today })} />
      </Row>
    </Card>
  );
}
