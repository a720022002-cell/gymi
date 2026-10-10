import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { View } from 'react-native';

import { useT } from '@/i18n';
import { type ClientLink, coachList, listMealPlans, listPrograms, type MealPlan, type Program } from '@/lib/coaching';
import { fmt } from '@/lib/nutrition';
import { useSettings } from '@/theme/settings';

import { Thinking } from '../food/Thinking';
import { Icon } from '../Icon';
import { Screen } from '../Screen';
import { Text } from '../Text';
import { Button, Card, NavButton, Row, Segmented } from '../ui';

/** Coach: workout programs and meal plans to give clients (design: cprog). */
export function ProgramsView() {
  const { t } = useT();
  const { colors: c } = useSettings();
  const [tab, setTab] = useState<'w' | 'm'>('w');
  const [d, setD] = useState<{ p: Program[]; m: MealPlan[]; l: ClientLink[] } | null>(null);
  useFocusEffect(
    useCallback(() => {
      let alive = true;
      Promise.all([listPrograms(), listMealPlans(), coachList()]).then(([p, m, l]) => alive && setD({ p, m, l }));
      return () => {
        alive = false;
      };
    }, []),
  );
  const add = () => router.push(tab === 'w' ? '/progedit' : '/mealedit');
  const used = (k: 'program_id' | 'meal_plan_id', id: string) => d?.l.filter((x) => x[k] === id).length ?? 0;
  return (
    <Screen title={t('Programs')} large tabs right={<NavButton icon="plus" label={t('New')} onPress={add} />}>
      <Segmented<'w' | 'm'>
        value={tab}
        options={[
          { value: 'w', label: t('Workouts') },
          { value: 'm', label: t('Meal plans') },
        ]}
        onChange={setTab}
      />
      <View style={{ height: 14 }} />
      {!d ? (
        <Thinking message={t('Loading')} />
      ) : tab === 'w' ? (
        d.p.length ? (
          d.p.map((x) => (
            <Card key={x.id} onPress={() => router.push({ pathname: '/progedit', params: { id: x.id } })}>
              <Row style={{ justifyContent: 'space-between' }}>
                <Text weight={700}>{x.name}</Text>
                <Icon name="chev" size={18} color={c.sec} />
              </Row>
              <Text variant="small" color="sec" style={{ marginTop: 4 }}>
                {x.days.map((dd) => dd.name).join(' · ')}
              </Text>
              <Text variant="xs" weight={700} color={c.cobalt} style={{ marginTop: 8 }}>
                {t('{n} clients', { n: used('program_id', x.id) })}
              </Text>
            </Card>
          ))
        ) : (
          <Card style={{ alignItems: 'center' }}>
            <Text color="sec" center>
              {t('No programs yet. Make one and give it to your clients.')}
            </Text>
          </Card>
        )
      ) : d.m.length ? (
        d.m.map((x) => (
          <Card key={x.id} onPress={() => router.push({ pathname: '/mealedit', params: { id: x.id } })}>
            <Row style={{ justifyContent: 'space-between' }}>
              <Text weight={700}>{x.name}</Text>
              <Icon name="chev" size={18} color={c.sec} />
            </Row>
            <Text variant="small" color="sec" style={{ marginTop: 4 }}>
              {t('{n} meals, {k} kcal, {p} g protein', { n: x.meals.length, k: fmt(x.meals.reduce((a, m) => a + (+m.k || 0), 0)), p: x.meals.reduce((a, m) => a + (+m.p || 0), 0) })}
            </Text>
            <Text variant="xs" weight={700} color={c.cobalt} style={{ marginTop: 8 }}>
              {t('{n} clients', { n: used('meal_plan_id', x.id) })}
            </Text>
          </Card>
        ))
      ) : (
        <Card style={{ alignItems: 'center' }}>
          <Text color="sec" center>
            {t('No meal plans yet. Make one and give it to your clients.')}
          </Text>
        </Card>
      )}
      <Button kind="glass" icon="plus" title={t(tab === 'w' ? 'New workout program' : 'New meal plan')} onPress={add} />
    </Screen>
  );
}
