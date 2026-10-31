import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { useT } from '@/i18n';
import { DAYS } from '@/lib/training';
import { useFood } from '@/lib/food';
import { addDays, fmt } from '@/lib/nutrition';
import { supabase } from '@/lib/supabase';
import { useSettings } from '@/theme/settings';

import { Icon } from '../Icon';
import { Sheet } from '../Sheet';
import { Text } from '../Text';
import { useToast } from '../Toast';
import { Button, Card, Chip, Row } from '../ui';

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
  // Choosing the days to spread it over (a popup with the next 7 days).
  const [pickOpen, setPickOpen] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);
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
  const week = Array.from({ length: 7 }, (_, i) => addDays(today, i));
  // Spread evenly over the picked days, at most DAY_MAX on each.
  const per = picked.length ? Math.round(Math.min(kcal, DAY_MAX * picked.length) / picked.length / 10) * 10 : 0;
  const dayLabel = (d: string) => (d === today ? t('Today') : d === addDays(today, 1) ? t('Tomorrow') : t(DAYS[new Date(`${d}T12:00:00`).getDay()]));

  const apply = async (days: string[], each: number) => {
    setBusy(true);
    const total = each * days.length;
    // Yesterday gives up what moves on, so it isn't offered again.
    const added = await food.addMoves([{ day: yesterday, kcal: -total }, ...days.map((day) => ({ day, kcal: each }))], 'balance');
    await food.updatePlan({ carryDay: today });
    setBusy(false);
    if (!added.length) return toast(t('Couldn’t save. Please try again.'), { icon: 'warn' });
    toast(days.length === 1 && days[0] === today ? t('+{n} kcal added to today', { n: fmt(each) }) : t('+{n} kcal on each of {d} days', { n: fmt(each), d: days.length }), {
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
        <Button
          small
          kind="glass"
          icon="cal"
          disabled={busy}
          title={t('Choose days')}
          onPress={() => {
            setPicked([today, addDays(today, 1), addDays(today, 2)]);
            setPickOpen(true);
          }}
        />
        <Button small kind="ghost" disabled={busy} title={t('Not now')} onPress={() => food.updatePlan({ carryDay: today })} />
      </Row>
      <Sheet open={pickOpen} onClose={() => setPickOpen(false)}>
        <Text variant="h2">{t('Spread {n} kcal', { n: fmt(kcal) })}</Text>
        <Text variant="small" color="sec" style={{ marginTop: 4 }}>
          {t('Pick the days. It’s shared evenly between them, at most {m} kcal on one day.', { m: fmt(DAY_MAX) })}
        </Text>
        <Row gap={8} style={{ flexWrap: 'wrap', marginTop: 14 }}>
          {week.map((d) => (
            <Chip key={d} title={dayLabel(d)} on={picked.includes(d)} onPress={() => setPicked((p) => (p.includes(d) ? p.filter((x) => x !== d) : [...p, d].sort()))} />
          ))}
        </Row>
        <Text weight={700} style={{ marginTop: 16 }}>
          {picked.length ? t('+{n} kcal on each of {d} days', { n: fmt(per), d: picked.length }) : t('Pick at least one day')}
        </Text>
        <Button
          title={t('Add')}
          disabled={!picked.length || busy}
          style={{ marginTop: 14 }}
          onPress={async () => {
            setPickOpen(false);
            await apply(picked, per);
          }}
        />
        <Button kind="ghost" title={t('Cancel')} style={{ marginTop: 6 }} onPress={() => setPickOpen(false)} />
      </Sheet>
    </Card>
  );
}
