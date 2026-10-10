import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { Glass } from '@/components/Glass';
import { Icon, type IconName } from '@/components/Icon';
import { OkChip, Tag, WarnChip } from '@/components/food/Chips';
import { MacroBars } from '@/components/food/MacroBars';
import { MealMenu } from '@/components/food/MealMenu';
import { SetupWizard } from '@/components/food/SetupWizard';
import { Thinking } from '@/components/food/Thinking';
import { Ring } from '@/components/Ring';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { useToast } from '@/components/Toast';
import { Button, Card, Row, Segmented, Springy } from '@/components/ui';
import { useT } from '@/i18n';
import { useFood } from '@/lib/food';
import { addDays, fmt, fmtTime, type PlannedMeal, planMeals } from '@/lib/nutrition';
import { useSettings } from '@/theme/settings';

export default function Food() {
  const { t } = useT();
  const food = useFood();

  if (!food.ready)
    return (
      <Screen title={t('Food')} tabs>
        <Thinking message={t('Loading your food')} />
      </Screen>
    );
  if (!food.setupDone) return <SetupWizard inTab />;
  return <FoodHome />;
}

function FoodHome() {
  const { t, lang } = useT();
  const { colors: c } = useSettings();
  const toast = useToast();
  const food = useFood();
  const [tab, setTab] = useState<'logged' | 'plan'>('logged');
  const [menuFor, setMenuFor] = useState<PlannedMeal | null>(null);
  const left = food.kcalLeft;
  const goal = food.dayGoal(food.today);
  const meals = planMeals(food.plan);
  const loggedKeys = new Set(food.logs.map((l) => l.plan_key).filter(Boolean));

  const upcoming = [1, 2, 3, 4].map((n) => addDays(food.today, n)).filter((d) => food.moves.some((m) => m.day === d));
  const dayName = (d: string) => {
    const [y, m, dd] = d.split('-').map(Number);
    return new Intl.DateTimeFormat(lang === 'ar' ? 'ar' : 'en-US', { weekday: 'short' }).format(new Date(y, m - 1, dd));
  };
  const timeOf = (iso: string) => new Intl.DateTimeFormat(lang === 'ar' ? 'ar-u-nu-latn' : 'en-US', { hour: 'numeric', minute: '2-digit' }).format(new Date(iso));

  return (
    <Screen
      title={t('Food')}
      large
      tabs
      right={
        <Springy onPress={() => food.setLogOpen(true)} scaleTo={1.08} accessibilityLabel={t('Log food')}>
          <Glass style={{ width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="plus" size={24} strokeWidth={2.2} />
          </Glass>
        </Springy>
      }>
      {food.plan.ramadan ? (
        <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Icon name="moon" color={c.cobalt} />
          <View style={{ flex: 1 }}>
            <Text variant="small" weight={700}>
              {t('Ramadan mode')}
            </Text>
            <Text variant="small" color="sec">
              {t('Meals are arranged around iftar and suhoor.')}
            </Text>
          </View>
        </Card>
      ) : null}

      <Card>
        <Row gap={14}>
          <Ring value={food.eaten.k} max={goal + food.burned} size={118} stroke={12} color={left < 0 ? c.down : c.cobalt}>
            <Text num size={26}>
              {fmt(Math.abs(left))}
            </Text>
            <Text variant="xs" weight={700} color="sec">
              {t(left < 0 ? 'over' : 'left')}
            </Text>
          </Ring>
          <View style={{ flex: 1, gap: 4 }}>
            {(
              [
                ['Eaten', food.eaten.k],
                ['Goal', goal],
                ['Burned', food.burned],
              ] as const
            ).map(([label, v]) => (
              <Row key={label} style={{ justifyContent: 'space-between' }}>
                <Text variant="small" weight={700} color="sec">
                  {t(label)}
                </Text>
                <Text variant="small" num>{`${fmt(v)} ${t('kcal')}`}</Text>
              </Row>
            ))}
            <Springy onPress={() => (food.eaten.k === 0 && left >= 0 ? toast(t('Log some food first'), { icon: 'info' }) : food.openBalance(left < 0 ? 'over' : 'under'))} style={{ marginTop: 6 }}>
              <Text variant="small" weight={700} color="link">
                {t('Over or under? Balance it')}
              </Text>
            </Springy>
          </View>
        </Row>
        <View style={{ marginTop: 16 }}>
          <MacroBars />
        </View>
      </Card>

      <Button title={t('Log food')} icon="plus" onPress={() => food.setLogOpen(true)} />

      {upcoming.length ? (
        <Card style={{ marginTop: 12 }}>
          <Row style={{ justifyContent: 'space-between' }}>
            <Text weight={700}>{t('Adjusted goals this week')}</Text>
            <Springy
              onPress={() => {
                const ids = food.moves.filter((m) => upcoming.includes(m.day)).map((m) => m.id);
                food.removeMoves(ids);
                toast(t('Goals reset'), { icon: 'cal' });
              }}>
              <Text variant="small" weight={700} color="link">
                {t('Reset')}
              </Text>
            </Springy>
          </Row>
          <Row gap={8} style={{ marginTop: 12, flexWrap: 'wrap' }}>
            {upcoming.map((d) => {
              const diff = food.dayGoal(d) - food.target.k;
              return (
                <View key={d} style={{ backgroundColor: c.inset, borderRadius: 16, paddingVertical: 10, paddingHorizontal: 12, minWidth: 84 }}>
                  <Text variant="xs" weight={700} color="sec">
                    {dayName(d)}
                  </Text>
                  <Text num>{fmt(food.dayGoal(d))}</Text>
                  <Text variant="xs" weight={700} color={diff > 0 ? 'cobalt' : 'sec'}>{`${diff > 0 ? '+' : '−'}${fmt(Math.abs(diff))}`}</Text>
                </View>
              );
            })}
          </Row>
        </Card>
      ) : null}

      <View style={{ marginTop: 16 }}>
        <Segmented
          value={tab}
          options={[
            { value: 'logged', label: t('Logged today') },
            { value: 'plan', label: t('Meal plan') },
          ]}
          onChange={setTab}
        />
      </View>

      {tab === 'logged' ? (
        <View>
          <Text variant="small" weight={700} color="sec" style={{ marginTop: 16, marginBottom: 10, marginHorizontal: 4 }}>
            {food.logs.length ? t('{n} items, {k} kcal', { n: food.logs.length, k: fmt(food.eaten.k) }) : t('What you ate today')}
          </Text>
          {food.logs.length ? (
            <View style={{ backgroundColor: c.card, borderRadius: 22, overflow: 'hidden', marginBottom: 12 }}>
              {food.logs.map((x, i) => (
                <View key={x.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 60, paddingVertical: 10, paddingHorizontal: 16, borderTopWidth: i ? 1 : 0, borderTopColor: c.line }}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text weight={700} numberOfLines={2}>
                      {x.name}
                    </Text>
                    <Text variant="small" color="sec">
                      {[x.meal ? t(x.meal) : null, timeOf(x.created_at)].filter(Boolean).join(', ')}
                    </Text>
                    {x.sugar_high || x.fat_high ? (
                      <Row gap={4} style={{ marginTop: 4, flexWrap: 'wrap' }}>
                        {x.sugar_high ? <WarnChip label={t('High added sugar')} /> : null}
                        {x.fat_high ? <WarnChip label={t('High fat')} /> : null}
                      </Row>
                    ) : null}
                  </View>
                  <Text num>{fmt(x.kcal)}</Text>
                  <Springy
                    onPress={async () => {
                      const removed = await food.deleteLog(x.id);
                      if (removed) toast(t('Removed {name}', { name: removed.name }), { icon: 'trash', undo: () => food.restoreLog(removed) });
                    }}
                    accessibilityLabel={t('Delete {name}', { name: x.name })}
                    style={{ width: 36, height: 36, alignItems: 'center', justifyContent: 'center' }}>
                    <Icon name="trash" size={18} color={c.sec} />
                  </Springy>
                </View>
              ))}
            </View>
          ) : (
            <Card style={{ alignItems: 'center', paddingVertical: 26 }}>
              <Icon name="food" size={30} color={c.sec} />
              <Text variant="h3" center style={{ marginTop: 8 }}>
                {t('Nothing logged yet')}
              </Text>
              <Text variant="small" color="sec" center style={{ marginTop: 4, marginBottom: 12 }}>
                {t('Log your first meal. Search it, scan it, or pick from the plan.')}
              </Text>
              <Button small kind="soft" title={t('See today’s meal plan')} style={{ alignSelf: 'center' }} color={c.text} onPress={() => setTab('plan')} />
            </Card>
          )}
        </View>
      ) : (
        <View>
          <Row style={{ justifyContent: 'space-between', marginTop: 16, marginBottom: 10, marginHorizontal: 4 }}>
            <Text variant="small" weight={700} color="sec" style={{ flex: 1 }}>
              {t(food.plan.ramadan ? 'Suggested for Ramadan' : 'Suggested for today. Tap a meal to log it or change it.')}
            </Text>
            <Springy onPress={() => router.push('/shopping')}>
              <Text variant="small" weight={700} color="link">
                {t('Shopping list')}
              </Text>
            </Springy>
          </Row>
          {meals.map((m) => {
            const logged = loggedKeys.has(m.key);
            return (
              <Card key={m.key} onPress={() => setMenuFor(m)}>
                <Row style={{ justifyContent: 'space-between' }}>
                  <Text variant="small" weight={700} color="sec">
                    {`${t(m.n)}, ${fmtTime(m.t, lang)}`}
                  </Text>
                  {logged ? <OkChip label={t('Logged')} /> : <Tag label={t(m.r.tag === 'Cut' ? 'Cutting' : 'Bulking')} />}
                </Row>
                <Text variant="h3" style={{ marginTop: 8 }}>
                  {t(m.r.n)}
                </Text>
                <Row gap={14} style={{ marginTop: 8 }}>
                  <Text variant="small" num>{`${fmt(m.k)} ${t('kcal')}`}</Text>
                  <Text variant="small" color="sec" num>{`${t('P')} ${m.p}${t('g')}`}</Text>
                  <Text variant="small" color="sec" num>{`${t('C')} ${m.c}${t('g')}`}</Text>
                  <Text variant="small" color="sec" num>{`${t('F')} ${m.f}${t('g')}`}</Text>
                  <View style={{ flex: 1 }} />
                  <Icon name="more" size={20} color={c.sec} />
                </Row>
              </Card>
            );
          })}
        </View>
      )}

      <Text variant="h3" style={{ marginTop: 22, marginBottom: 10, marginHorizontal: 2 }}>
        {t('More')}
      </Text>
      <View style={{ backgroundColor: c.card, borderRadius: 22, overflow: 'hidden' }}>
        {(
          [
            ['bookmark', 'Saved meals', t('{n} saved', { n: food.saved.length }), () => router.push('/saved-meals')],
            ['drop', 'Water', t('{a} of {b} ml', { a: fmt(food.water), b: fmt(food.plan.water) }), () => food.addWater(250).then(() => toast(t('Added {n} ml water', { n: 250 }), { icon: 'drop' }))],
            ['sliders', 'My targets', t('Calories, protein, meal times'), () => router.push('/food-results')],
          ] as [IconName, string, string, () => void][]
        ).map(([icon, title, sub, fn], i) => (
          <Springy key={title} onPress={fn} scaleTo={0.99} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 60, paddingHorizontal: 16, paddingVertical: 10, borderTopWidth: i ? 1 : 0, borderTopColor: c.line }}>
            <View style={{ width: 36, height: 36, borderRadius: 11, backgroundColor: c.inset, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name={icon} size={20} />
            </View>
            <View style={{ flex: 1 }}>
              <Text weight={700}>{t(title)}</Text>
              <Text variant="small" color="sec">
                {sub}
              </Text>
            </View>
            {icon === 'drop' ? <Icon name="plus" size={18} color={c.cobalt} strokeWidth={2.4} /> : <Icon name="chev" size={16} color={c.sec} />}
          </Springy>
        ))}
      </View>
      <Text variant="xs" color="sec" center style={{ marginTop: 16 }}>
        {t('Food data: USDA FoodData Central and Open Food Facts. Saudi dishes are Gymi estimates.')}
      </Text>

      <MealMenu meal={menuFor} logged={!!menuFor && loggedKeys.has(menuFor.key)} onClose={() => setMenuFor(null)} />
    </Screen>
  );
}
