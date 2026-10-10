import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { Thinking } from '@/components/food/Thinking';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { useToast } from '@/components/Toast';
import { Button, Card, Row } from '@/components/ui';
import { useT } from '@/i18n';
import { type MealPlan, myCoachPlans } from '@/lib/coaching';
import { useLogFood } from '@/lib/food';
import { fmt, fmtTime } from '@/lib/nutrition';

/** Client: the meal plan your coach gave you, with one-tap logging (design: mymeals). */
export default function MyMeals() {
  const { t, lang } = useT();
  const toast = useToast();
  const logFood = useLogFood();
  const [m, setM] = useState<MealPlan | null | undefined>(undefined);
  useEffect(() => {
    let alive = true;
    myCoachPlans().then((x) => alive && setM(x?.meals ?? null));
    return () => {
      alive = false;
    };
  }, []);
  if (m === undefined)
    return (
      <Screen title={t('My meals')} back>
        <Thinking message={t('Loading')} />
      </Screen>
    );
  if (!m)
    return (
      <Screen title={t('My meals')} back>
        <Card style={{ alignItems: 'center' }}>
          <Text color="sec" center>
            {t('Your coach hasn’t sent you a meal plan yet.')}
          </Text>
        </Card>
      </Screen>
    );
  const tot = m.meals.reduce((a, x) => a + (+x.k || 0), 0);
  const pt = m.meals.reduce((a, x) => a + (+x.p || 0), 0);
  return (
    <Screen title={m.name} back>
      <Card style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text weight={700}>{t('Each day')}</Text>
        <Text num>{t('{k} kcal, {p} g protein', { k: fmt(tot), p: pt })}</Text>
      </Card>
      {m.meals.map((x, i) => (
        <Card key={i}>
          <Row style={{ justifyContent: 'space-between' }}>
            <Text weight={700}>{x.n}</Text>
            <Text variant="small" weight={700} color="sec">
              {fmtTime(x.t, lang)}
            </Text>
          </Row>
          {x.d ? (
            <Text variant="small" style={{ marginTop: 6 }}>
              {x.d}
            </Text>
          ) : null}
          <Row style={{ justifyContent: 'space-between', marginTop: 10 }}>
            <Text variant="small" color="sec" num>
              {t('{k} kcal · {p} g protein', { k: fmt(x.k), p: x.p })}
            </Text>
            <Button small kind="soft" icon="plus" title={t('Log')} onPress={() => logFood({ name: x.d ? `${x.n}: ${x.d}`.slice(0, 120) : x.n, kcal: x.k, protein: x.p, carbs: x.c ?? 0, fat: x.f ?? 0, meal: x.n }, toast, t)} />
          </Row>
        </Card>
      ))}
      <View style={{ height: 12 }} />
    </Screen>
  );
}
