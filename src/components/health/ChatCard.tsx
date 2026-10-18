import { type ReactNode, useState } from 'react';
import { View } from 'react-native';

import { useT } from '@/i18n';
import type { ChatCard as Card } from '@/lib/coach';
import { useFood, useLogFood } from '@/lib/food';
import { useHealth } from '@/lib/health';
import { addDays, fmt } from '@/lib/nutrition';
import { fx } from '@/lib/progress';
import { useSettings } from '@/theme/settings';

import { BarChart, LineChart } from '../Charts';
import { Icon } from '../Icon';
import { Text } from '../Text';
import { useToast } from '../Toast';
import { Button, Row } from '../ui';

/** A meal the coach suggested: save it to your meals, or log it once you've eaten it. */
function MealCard({ card }: { card: Extract<Card, { type: 'meal' }> }) {
  const { t } = useT();
  const toast = useToast();
  const food = useFood();
  const logFood = useLogFood();
  const [saved, setSaved] = useState(() => food.saved.some((m) => m.name === card.name && Math.round(+m.kcal) === card.kcal));
  const [logged, setLogged] = useState(false);
  const macros = [card.protein ? t('P {n} g', { n: card.protein }) : null, card.carbs ? t('C {n} g', { n: card.carbs }) : null, card.fat ? t('F {n} g', { n: card.fat }) : null].filter(Boolean);
  const item = { name: card.name, kcal: card.kcal, protein: card.protein, carbs: card.carbs ?? 0, fat: card.fat ?? 0 };
  return (
    <>
      <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <Text variant="small" weight={700} style={{ flex: 1 }}>
          {card.name}
        </Text>
        <Text variant="small" weight={700} num>{`${fmt(card.kcal)} ${t('kcal')}`}</Text>
      </Row>
      {macros.length ? (
        <Text variant="xs" color="sec">
          {macros.join(t(', '))}
        </Text>
      ) : null}
      <Row gap={8} style={{ marginTop: 10 }}>
        <View style={{ flex: 1 }}>
          <Button
            small
            kind="soft"
            icon={saved ? 'check' : 'bookmark'}
            title={t(saved ? 'Saved' : 'Save meal')}
            disabled={saved}
            style={{ alignSelf: 'stretch' }}
            onPress={async () => {
              const row = await food.saveMeal({ ...item, items: null, ingredients: null });
              if (!row) return toast(t('Couldn’t save. Please try again.'), { icon: 'warn' });
              setSaved(true);
              toast(t('Saved to your meals. Log it from Saved meals any time.'), { icon: 'bookmark' });
            }}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Button
            small
            icon={logged ? 'check' : 'plus'}
            title={t(logged ? 'Logged' : 'I ate it')}
            disabled={logged}
            style={{ alignSelf: 'stretch' }}
            onPress={async () => {
              if (await logFood(item, toast, t)) setLogged(true);
            }}
          />
        </View>
      </Row>
    </>
  );
}

/** A small chart or card under a coach reply, drawn from your real data (design: chat miniCard). */
export function ChatCard({ card }: { card: Card }) {
  const { t, lang } = useT();
  const { colors: c } = useSettings();
  const health = useHealth();
  const food = useFood();
  const box = (children: ReactNode) => <View style={{ backgroundColor: c.bg, borderRadius: 14, paddingVertical: 10, paddingHorizontal: 12, marginTop: 10, minWidth: 220 }}>{children}</View>;
  const week = Array.from({ length: 7 }, (_, i) => addDays(food.today, i - 6));
  const letters = week.map((d) => new Intl.DateTimeFormat(lang === 'ar' ? 'ar-u-nu-latn' : 'en-US', { weekday: 'narrow' }).format(new Date(`${d}T12:00:00`)));

  if (card.type === 'meal') return box(<MealCard card={card} />);

  if (card.type === 'weight') {
    const from = addDays(food.today, -13);
    const w = health.weights.filter((x) => x.day >= from);
    const series = (w.length > 1 ? w : health.weights.slice(-8)).map((x) => x.value);
    if (series.length < 2) return null;
    const d = series.at(-1)! - series[0];
    return box(
      <>
        <Row style={{ justifyContent: 'space-between' }}>
          <Text variant="xs" weight={700} color="sec">
            {t(w.length > 1 ? 'Weight, 2 weeks' : 'Weight, recent')}
          </Text>
          <Row gap={2}>
            <Icon name={d <= 0 ? 'down' : 'up'} size={12} strokeWidth={2.6} color={c.cobalt} />
            <Text variant="xs" weight={700} color={c.cobalt}>{`${fx(Math.abs(d))} ${t('kg')}`}</Text>
          </Row>
        </Row>
        <LineChart values={series} height={70} dots={false} />
      </>,
    );
  }

  if (card.type === 'sleep') {
    const by = new Map(health.checkins.map((x) => [x.day, x.sleep_h]));
    const nights = week.map((d) => by.get(d) ?? null);
    if (!nights.some((x) => x != null)) return null;
    return box(
      <>
        <Text variant="xs" weight={700} color="sec">
          {t('Sleep, last 7 nights')}
        </Text>
        <BarChart values={nights} labels={letters} height={80} max={10} goal={7.5} highlight={6} />
      </>,
    );
  }

  const kc = week.map((d) => (health.days[d]?.k ? Math.round(health.days[d].k) : null));
  if (!kc.some((x) => x != null)) return null;
  return box(
    <>
      <Text variant="xs" weight={700} color="sec">
        {t('Calories, last 7 days')}
      </Text>
      <BarChart values={kc} labels={letters} height={80} goal={food.setupDone ? Math.round(food.target.k) : undefined} highlight={6} />
    </>,
  );
}
