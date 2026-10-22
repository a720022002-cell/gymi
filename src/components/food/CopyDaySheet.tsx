import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { useT } from '@/i18n';
import { type FoodLog, useFood } from '@/lib/food';
import { addDays, fmt, hhmmOf, mealAt, planMeals } from '@/lib/nutrition';
import { supabase } from '@/lib/supabase';
import { useSettings } from '@/theme/settings';

import { Sheet } from '../Sheet';
import { Text } from '../Text';
import { useToast } from '../Toast';
import { Button, Chip, Row } from '../ui';
import { AllergyWarn, useAllergyCheck } from './AllergyWarn';

/** Copy the day before's food (all of it, or one meal) to the day on screen. Undo removes what was just added. */
export function CopyDaySheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t, lang } = useT();
  const { colors: c } = useSettings();
  const toast = useToast();
  const food = useFood();
  const allergyCheck = useAllergyCheck();
  const to = food.day;
  const from = addDays(to, -1);
  const [src, setSrc] = useState<{ day: string; rows: FoodLog[] } | null>(null);
  const [meal, setMeal] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Each time it opens: all meals, and the day before read fresh.
  const [openedFor, setOpenedFor] = useState<string | null>(null);
  const want = open ? from : null;
  if (want !== openedFor) {
    setOpenedFor(want);
    setMeal(null);
    setSrc(null);
  }

  useEffect(() => {
    if (!open) return;
    let alive = true;
    supabase
      .from('food_logs')
      .select('*')
      .eq('day', from)
      .order('created_at')
      .then(({ data, error }) => alive && setSrc({ day: from, rows: error ? [] : ((data as FoodLog[]) ?? []) }));
    return () => {
      alive = false;
    };
  }, [open, from]);

  const planned = planMeals(food.plan);
  const mealOf = (x: FoodLog) => x.meal || mealAt(planned, hhmmOf(new Date(x.created_at)));
  const rows = src?.day === from ? src.rows : null;
  const meals = [...new Set((rows ?? []).map(mealOf))];
  const sel = (rows ?? []).filter((x) => !meal || mealOf(x) === meal);
  // Already on this day (same meal, name and calories): not copied again. Two coffees the day before and one today copies one.
  const have = new Map<string, number>();
  const keyOf = (x: FoodLog) => `${mealOf(x)}|${x.name}|${Math.round(+x.kcal)}`;
  if (food.loadedDay === to) for (const x of food.logs) have.set(keyOf(x), (have.get(keyOf(x)) ?? 0) + 1);
  const copy: FoodLog[] = [];
  for (const x of sel) {
    const k = keyOf(x);
    const n = have.get(k) ?? 0;
    if (n > 0) have.set(k, n - 1);
    else copy.push(x);
  }
  const skipped = sel.length - copy.length;
  const kcal = copy.reduce((a, x) => a + +x.kcal, 0);
  const allergic = [...new Set(copy.flatMap((x) => allergyCheck(x.name)))];
  const fromText =
    from === addDays(food.today, -1)
      ? t('Yesterday')
      : new Intl.DateTimeFormat(lang === 'ar' ? 'ar-u-nu-latn' : 'en-US', {
          weekday: 'long',
          month: 'short',
          day: 'numeric',
        }).format(new Date(`${from}T12:00:00`));

  const run = async () => {
    if (!copy.length || busy) return;
    setBusy(true);
    const added = await food.copyLogs(copy, to);
    setBusy(false);
    if (!added.length) return toast(t('Couldn’t save. Please try again.'), { icon: 'warn' });
    onClose();
    const k = added.reduce((a, x) => a + +x.kcal, 0);
    toast(t('Copied {n} items, {k} kcal', { n: added.length, k: fmt(k) }), {
      icon: 'copy',
      undo: () => food.removeLogs(added.map((x) => x.id)),
    });
  };

  return (
    <Sheet open={open} onClose={onClose}>
      <Text variant="h2">{t('Copy food from {day}', { day: fromText })}</Text>
      <Text variant="small" color="sec" style={{ marginTop: 4 }}>
        {t('Same foods and amounts, to the same meals.')}
      </Text>
      {!rows ? (
        <ActivityIndicator color={c.cobalt} style={{ marginVertical: 30 }} />
      ) : !rows.length ? (
        <Text color="sec" style={{ marginTop: 16, marginBottom: 8 }}>
          {t('Nothing logged on {day}.', { day: fromText })}
        </Text>
      ) : (
        <View>
          {meals.length > 1 ? (
            <Row gap={8} style={{ marginTop: 14, flexWrap: 'wrap' }}>
              <Chip title={t('All')} on={!meal} onPress={() => setMeal(null)} />
              {meals.map((m) => (
                <Chip key={m} title={t(m)} on={meal === m} onPress={() => setMeal(m)} />
              ))}
            </Row>
          ) : null}
          <View
            style={{
              marginTop: 14,
              backgroundColor: c.inset,
              borderRadius: 18,
              overflow: 'hidden',
            }}>
            {sel.slice(0, 8).map((x, i) => (
              <Row
                key={x.id}
                gap={10}
                style={{
                  minHeight: 44,
                  paddingHorizontal: 14,
                  paddingVertical: 8,
                  borderTopWidth: i ? 1 : 0,
                  borderTopColor: c.line,
                  opacity: copy.includes(x) ? 1 : 0.45,
                }}>
                <Text variant="small" weight={600} numberOfLines={1} style={{ flex: 1 }}>
                  {x.name}
                </Text>
                <Text variant="small" color="sec" num>{`${fmt(+x.kcal)} ${t('kcal')}`}</Text>
              </Row>
            ))}
            {sel.length > 8 ? (
              <Text variant="xs" color="sec" style={{ paddingHorizontal: 14, paddingBottom: 10 }}>
                {t('And {n} more', { n: sel.length - 8 })}
              </Text>
            ) : null}
          </View>
          {skipped ? (
            <Text variant="small" weight={700} color={copy.length ? 'sec' : 'down'} style={{ marginTop: 10, marginHorizontal: 4 }}>
              {copy.length
                ? t('{n} already on this day. They won’t be copied again.', {
                    n: skipped,
                  })
                : t('Already copied. All of these are on this day.')}
            </Text>
          ) : null}
          <AllergyWarn items={allergic} />
          <Button
            title={
              copy.length
                ? t('Copy {n} items, {k} kcal', {
                    n: copy.length,
                    k: fmt(kcal),
                  })
                : t('Nothing new to copy')
            }
            icon="copy"
            disabled={!copy.length}
            loading={busy}
            style={{ marginTop: 16 }}
            onPress={run}
          />
        </View>
      )}
      <Button title={t('Cancel')} kind="ghost" style={{ marginTop: 6 }} onPress={onClose} />
    </Sheet>
  );
}
