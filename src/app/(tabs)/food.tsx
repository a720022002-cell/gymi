import { router } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { View } from 'react-native';

import { Glass } from '@/components/Glass';
import { Icon, type IconName } from '@/components/Icon';
import { OkChip, Tag, WarnChip } from '@/components/food/Chips';
import { makeRecipes, needsRecipes, recipesKey, shoppingLock } from '@/lib/aiRecipes';
import { ALLERGENS } from '@/lib/allergies';
import { MacroBars } from '@/components/food/MacroBars';
import { MealMenu } from '@/components/food/MealMenu';
import { ReminderBell } from '@/components/food/ReminderBell';
import { SetupWizard } from '@/components/food/SetupWizard';
import { Thinking } from '@/components/food/Thinking';
import { Ring } from '@/components/Ring';
import { DayNav } from '@/components/DayNav';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { useToast } from '@/components/Toast';
import { Button, Card, Row, Segmented, Springy } from '@/components/ui';
import { useT } from '@/i18n';
import { lutealHold, useCycleToday } from '@/lib/cyclePhase';
import { useFood, useLogFood } from '@/lib/food';
import { type Measure, useHealth } from '@/lib/health';
import { addDays, fmt, fmtTime, hhmmOf, kcalFloor, mealAt, type PlannedMeal, planMeals, ramadanOn, targets } from '@/lib/nutrition';
import { cityOf, fastTimes } from '@/lib/prayer';
import { weekAvg } from '@/lib/progress';
import { useSettings } from '@/theme/settings';

/** Weight hasn't moved (weekly averages within 0.3 kg) for 2 weeks. Needs weigh-ins in each of the 3 weeks. */
function plateau(weights: Measure[], today: string) {
  const a = weekAvg(weights, today);
  const b = weekAvg(weights, addDays(today, -7));
  const c = weekAvg(weights, addDays(today, -14));
  if (a == null || b == null || c == null) return false;
  return Math.max(a, b, c) - Math.min(a, b, c) <= 0.3;
}

/** What AI recipes were last tried for while the app is open (so a failure doesn't repeat). */
let recipesTried = '';

export default function Food() {
  const { t } = useT();
  const food = useFood();

  if (!food.ready)
    return (
      <Screen title={t('Food')} tabs>
        <Thinking message={t('Loading your food')} />
      </Screen>
    );
  // The plan didn't load: try again, never the setup (finishing it would replace the plan you have).
  if (food.loadError && !food.setupDone)
    return (
      <Screen title={t('Food')} tabs>
        <Card style={{ alignItems: 'center', paddingVertical: 26 }}>
          <Icon name="warn" size={28} />
          <Text center style={{ marginTop: 8 }}>
            {t('Couldn’t load your food. Check your connection and try again.')}
          </Text>
          <Button small kind="soft" title={t('Try again')} style={{ marginTop: 12, alignSelf: 'center' }} onPress={food.reload} />
        </Card>
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
  const health = useHealth();
  const cycle = useCycleToday();
  const logFood = useLogFood();
  const [tab, setTab] = useState<'logged' | 'plan'>('logged');
  const [menuFor, setMenuFor] = useState<PlannedMeal | null>(null);
  const coach = food.coach;
  const fast = ramadanOn(food.plan, food.today) ? fastTimes(food.plan.city, food.today) : null;
  // The phone's clock isn't on the chosen city's time zone: you're likely somewhere else, so say whose times these are.
  const otherZone = !!fast && -new Date().getTimezoneOffset() !== cityOf(food.plan.city).tz * 60;
  // Cut or bulk, weight flat for 2 weeks, not dismissed in the last 2 weeks, and the coach isn't in charge. Not in the
  // luteal phase (water weight can hide a real loss then).
  const cutting = food.plan.goal >= 3;
  const bulking = food.plan.goal <= 1;
  const showPlateau = !coach && !food.preg && (cutting || bulking) && (!food.plan.plateauDay || food.plan.plateauDay <= addDays(food.today, -14)) && plateau(health.weights, food.today) && !lutealHold(cycle);
  const adjust = cutting ? -150 : 150;
  // Targets were updated for a new weigh-in (see applyWeight): say so once.
  const weightNote = food.weightNote;
  const clearWeightNote = food.clearWeightNote;
  useEffect(() => {
    if (weightNote == null) return;
    toast(t('Your targets were updated for your new weight.'), { icon: 'scale' });
    clearWeightNote();
  }, [weightNote, clearWeightNote, toast, t]);
  // Your own AI recipes: made in the background when missing or 2 weeks old (once per open of the app), or on demand.
  const [making, setMaking] = useState(false);
  const busy = useRef(false);
  const plan = food.plan;
  const ready = food.setupDone && !coach;
  const freshRecipes = async (manual: boolean, sure = false) => {
    if (busy.current) return;
    // You're buying a list for these meals: say what new recipes would do first.
    const lock = shoppingLock(plan, food.today);
    if (manual && lock && !sure)
      return toast(t('You’re shopping for your meals until {day}. New recipes change your meals and your shopping list.', { day: new Intl.DateTimeFormat(lang === 'ar' ? 'ar-u-nu-latn' : 'en-US', { month: 'short', day: 'numeric' }).format(new Date(`${lock.to}T12:00:00`)) }), {
        icon: 'info',
        action: { label: t('Make anyway'), fn: () => freshRecipes(true, true) },
      });
    busy.current = true;
    setMaking(true);
    const r = await makeRecipes(plan, lang, food.today).catch(() => null);
    busy.current = false;
    setMaking(false);
    if (r) {
      food.updatePlan({ aiRecipes: r });
      if (manual) toast(t('{n} new recipes made for you', { n: r.list.length }), { ai: true });
    } else if (manual) toast(t('Couldn’t make new recipes. Please try again.'), { icon: 'warn' });
  };
  // Tried once for each goal, allergies, meals and language (so new allergies get new recipes right away).
  const wantKey = `${recipesKey(plan)}|${lang}|${plan.meals.map((m) => m.type ?? m.n).join('+')}`;
  useEffect(() => {
    // While recipes are being made, wait: this runs again when that's done (so a change made meanwhile isn't missed).
    if (!ready || making || recipesTried === wantKey || !needsRecipes(plan, lang, food.today)) return;
    recipesTried = wantKey;
    setTimeout(() => freshRecipes(false), 0);
    // Runs when what the recipes are made for changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, wantKey, making]);
  const coachLogged = (n: string) => food.logs.some((l) => l.name.startsWith(`${n} (`) && l.meal === n);
  const left = food.kcalLeft;
  const goal = food.dayGoal(food.day);
  const meals = useMemo(() => planMeals(food.plan, food.day, goal), [food.plan, food.day, goal]);
  const loggedKeys = new Set(food.logs.map((l) => l.plan_key).filter(Boolean));

  const upcoming = [1, 2, 3, 4, 5, 6, 7].map((n) => addDays(food.today, n)).filter((d) => food.moves.some((m) => m.day === d));
  // Under your goal: offered in the evening (after 8 pm), or for a day that's over.
  const over = left < 0;
  const underOk = !food.isToday || new Date().getHours() >= 20;
  const offBy = Math.round(Math.abs(left));
  const dayName = (d: string) => {
    const [y, m, dd] = d.split('-').map(Number);
    return new Intl.DateTimeFormat(lang === 'ar' ? 'ar-u-nu-latn' : 'en-US', { weekday: 'short' }).format(new Date(y, m - 1, dd));
  };
  // Logged food grouped by meal; food logged without a meal goes by the time it was logged.
  const planned = meals;
  const mealOf = (x: (typeof food.logs)[number]) => x.meal || mealAt(planned, hhmmOf(new Date(x.created_at)));
  // Meals in the order you ate them (logs come oldest first).
  const order = [...new Set(food.logs.map(mealOf))];
  const byMeal = order.map((m) => [m, food.logs.filter((x) => mealOf(x) === m)] as const);
  const timeOf = (iso: string) => new Intl.DateTimeFormat(lang === 'ar' ? 'ar-u-nu-latn' : 'en-US', { hour: 'numeric', minute: '2-digit' }).format(new Date(iso));

  return (
    <Screen
      title={t('Food')}
      large
      tabs
      right={
        <Row gap={6}>
          <ReminderBell kind="meals" />
          <Springy onPress={() => food.setLogOpen(true)} scaleTo={1.08} accessibilityLabel={t('Log food')}>
            <Glass style={{ width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="plus" size={24} strokeWidth={2.2} />
            </Glass>
          </Springy>
        </Row>
      }>
      <DayNav />
      {food.loadError ? (
        <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Icon name="warn" size={18} color={c.down} />
          <Text variant="small" style={{ flex: 1 }}>
            {t('Some of your food didn’t load. What you see may be out of date.')}
          </Text>
          <Springy onPress={food.reload}>
            <Text variant="small" weight={700} color="link">
              {t('Try again')}
            </Text>
          </Springy>
        </Card>
      ) : null}
      {coach ? (
        <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 14 }}>
          <Icon name="lock" size={18} color={c.cobalt} />
          <Text variant="small" style={{ flex: 1 }}>
            {t('{coach} manages your food plan', { coach: coach.name })}
          </Text>
          <Springy onPress={() => router.push({ pathname: '/thread', params: { link: coach.link, name: coach.name } })}>
            <Text variant="small" weight={700} color="link">
              {t('Ask')}
            </Text>
          </Springy>
        </Card>
      ) : null}
      {fast && !coach ? (
        <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Icon name="moon" color={c.cobalt} />
          <View style={{ flex: 1 }}>
            <Text variant="small" weight={700}>
              {t('Ramadan mode')}
            </Text>
            <Text variant="small" color="sec">
              {t('Meals are arranged around iftar ({a}) and suhoor (ends {b}).', { a: fmtTime(fast.maghrib, lang), b: fmtTime(fast.fajr, lang) })}
            </Text>
            <Text variant="small" color={otherZone ? 'text' : 'sec'} weight={otherZone ? 700 : undefined} style={{ marginTop: 2 }}>
              {otherZone
                ? t('These times are for {city}. If you live somewhere else, check your local iftar and suhoor times.', { city: t(fast.city) })
                : t('Times for {city}.', { city: t(fast.city) })}
            </Text>
          </View>
        </Card>
      ) : null}
      {food.preg && !coach ? (
        <Card style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
          <Icon name="heart" color={c.cobalt} />
          <View style={{ flex: 1 }}>
            <Text variant="small" weight={700}>
              {t('Pregnancy mode')}
            </Text>
            <Text variant="small" color="sec">
              {food.pregKcal > 0
                ? t('No calorie deficit while you’re pregnant. Your goal includes about {n} kcal extra, and caffeine is kept to 200 mg a day.', { n: food.pregKcal })
                : t('No calorie deficit while you’re pregnant. In the first trimester you don’t need extra calories yet. Caffeine is kept to 200 mg a day.')}
            </Text>
          </View>
        </Card>
      ) : null}
      {food.nursing && !coach ? (
        <Card style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
          <Icon name="heart" color={c.cobalt} />
          <View style={{ flex: 1 }}>
            <Text variant="small" weight={700}>
              {t('Breastfeeding')}
            </Text>
            <Text variant="small" color="sec">
              {t('Your goal includes about {n} kcal extra, and your water goal 700 ml more.', { n: food.pregKcal })}
            </Text>
          </View>
        </Card>
      ) : null}
      {cycle?.phase === 'Luteal' ? (
        <Card style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
          <Icon name="drop" color={c.cobalt} />
          <View style={{ flex: 1 }}>
            <Text variant="small" weight={700}>
              {t('Luteal phase, day {n}', { n: cycle.day })}
            </Text>
            <Text variant="small" color="sec">
              {t('Hunger can rise by 100 to 200 kcal. A bigger protein snack helps, and about 150 kcal extra is fine this week. Drink a bit more water. Water weight of 0.5 to 2 kg is normal.')}
            </Text>
          </View>
        </Card>
      ) : null}
      {showPlateau ? (
        <Card>
          <Row gap={10} style={{ alignItems: 'flex-start' }}>
            <Icon name="scale" color={c.cobalt} />
            <View style={{ flex: 1 }}>
              <Text weight={700}>{t('Your weight hasn’t changed in 2 weeks')}</Text>
              <Text variant="small" color="sec" style={{ marginTop: 2 }}>
                {cutting ? t('To keep losing, try eating {n} kcal less a day.', { n: Math.abs(adjust) }) : t('To keep gaining, try eating {n} kcal more a day.', { n: adjust })}
              </Text>
            </View>
          </Row>
          <Row gap={10} style={{ marginTop: 12 }}>
            <Button
              small
              title={t('Apply {n} kcal', { n: `${adjust > 0 ? '+' : '−'}${Math.abs(adjust)}` })}
              onPress={async () => {
                const before = food.plan;
                // From the plan's own calories (not today's shown goal, which may include breastfeeding's extra).
                const k = Math.min(6000, Math.max(kcalFloor(food.plan.weight, food.person, food.plan.bf), targets(food.plan).k + adjust));
                await food.savePlan({ ...food.plan, kcal: k, carbG: null, plateauDay: food.today });
                toast(t('Daily calories set to {k} kcal', { k: fmt(k) }), { ai: true, undo: () => food.savePlan(before) });
              }}
            />
            <Button small kind="ghost" title={t('Not now')} onPress={() => food.updatePlan({ plateauDay: food.today })} />
          </Row>
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
            {over || underOk ? (
              <Springy
                onPress={() =>
                  food.eaten.k === 0 && !over
                    ? toast(t('Log some food first'), { icon: 'info' })
                    : offBy === 0
                      ? toast(t('You’re right on your goal.'), { icon: 'check' })
                      : food.openBalance(over ? 'over' : 'under')
                }
                style={{ marginTop: 6 }}>
                <Text variant="small" weight={700} color="link">
                  {t('Over or under? Balance it')}
                </Text>
              </Springy>
            ) : null}
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
                // Each balancing goes as a whole (its offset on the day it came from too), so no day is left half-moved.
                // Older moves without a balancing id: the coming days and today, as before.
                const grps = [...new Set(food.moves.filter((m) => m.grp && upcoming.includes(m.day)).map((m) => m.grp as string))];
                const ids = food.moves.filter((m) => !m.grp && (upcoming.includes(m.day) || m.day === food.today)).map((m) => m.id);
                food.removeMoves(ids, grps);
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
            { value: 'logged', label: t(food.isToday ? 'Logged today' : 'Logged') },
            { value: 'plan', label: coach ? t('Coach’s plan') : t('Meal plan') },
          ]}
          onChange={setTab}
        />
      </View>

      {/* Asked once (set up before allergies were asked): the answer, even "none", keeps it from coming back. */}
      {food.setupDone && !coach && food.plan.allergies === undefined ? (
        <Card style={{ marginTop: 16 }}>
          <Text weight={700}>{t('Any food allergies?')}</Text>
          <Text variant="small" color="sec" style={{ marginTop: 4 }}>
            {t('Pick all that apply. Your meal plan and the AI will leave them out.')}
          </Text>
          <Row gap={8} style={{ marginTop: 12 }}>
            <View style={{ flex: 1 }}>
              <Button small title={t('Add allergies')} style={{ alignSelf: 'stretch' }} onPress={() => router.push('/allergies')} />
            </View>
            <View style={{ flex: 1 }}>
              <Button small kind="soft" title={t('No allergies')} style={{ alignSelf: 'stretch' }} onPress={() => food.updatePlan({ allergies: [] })} />
            </View>
          </Row>
        </Card>
      ) : null}
      {tab === 'logged' ? (
        <View>
          <Text variant="small" weight={700} color="sec" style={{ marginTop: 16, marginBottom: 10, marginHorizontal: 4 }}>
            {food.logs.length ? t('{n} items, {k} kcal', { n: food.logs.length, k: fmt(food.eaten.k) }) : t(food.isToday ? 'What you ate today' : 'Nothing logged this day.')}
          </Text>
          {food.logs.length ? (
            // One card per meal (breakfast, lunch, dinner, snacks), in the order you ate them.
            byMeal.map(([meal, items]) => (
              <View key={meal}>
                <Row style={{ justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 4, marginBottom: 8, marginHorizontal: 4 }}>
                  <Text weight={700}>{t(meal)}</Text>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text variant="small" weight={700} color="sec" num>
                      {`${fmt(items.reduce((a, x) => a + +x.kcal, 0))} ${t('kcal')}`}
                    </Text>
                    <Macros p={items.reduce((a, x) => a + +x.protein, 0)} c={items.reduce((a, x) => a + +x.carbs, 0)} f={items.reduce((a, x) => a + +x.fat, 0)} />
                  </View>
                </Row>
                <View style={{ backgroundColor: c.card, borderRadius: 22, overflow: 'hidden', marginBottom: 14 }}>
                  {items.map((x, i) => (
                    <Springy
                      key={x.id}
                      onPress={() => router.push({ pathname: '/logged', params: { id: x.id } })}
                      scaleTo={0.99}
                      style={{ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 60, paddingVertical: 10, paddingHorizontal: 16, borderTopWidth: i ? 1 : 0, borderTopColor: c.line }}>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text weight={700} numberOfLines={2}>
                          {x.name}
                        </Text>
                        <Text variant="small" color="sec">
                          {timeOf(x.created_at)}
                        </Text>
                        <Macros p={+x.protein} c={+x.carbs} f={+x.fat} />
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
                    </Springy>
                  ))}
                </View>
              </View>
            ))
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
      ) : coach ? (
        food.coachMeals ? (
          <View>
            <Row gap={6} style={{ marginTop: 14, marginBottom: 10, marginHorizontal: 4 }}>
              <Icon name="user" size={14} color={c.sec} />
              <Text variant="small" color="sec">
                {t('{plan}, from {coach}', { plan: food.coachMeals.name, coach: coach.name })}
              </Text>
            </Row>
            {food.coachMeals.meals.map((m, i) => {
              const done = coachLogged(m.n);
              return (
                <Card key={`${m.n}-${i}`}>
                  <Row style={{ justifyContent: 'space-between' }}>
                    <Text weight={700} style={{ flex: 1 }}>{`${m.n}, ${fmtTime(m.t, lang)}`}</Text>
                    {done ? <OkChip label={t('Logged')} /> : <Text num weight={700}>{`${fmt(m.k)} ${t('kcal')}`}</Text>}
                  </Row>
                  <Text variant="small" color="sec" style={{ marginTop: 4 }}>
                    {m.d || t('Details coming from your coach')}
                  </Text>
                  <Row style={{ justifyContent: 'space-between', marginTop: 8 }}>
                    <Text variant="xs" weight={700} color="sec">
                      {t('{n} g protein', { n: m.p })}
                    </Text>
                    {done ? null : (
                      <Button
                        small
                        title={t('Log it')}
                        onPress={() => {
                          // Carbs and fat the coach didn't give share what protein leaves of the calories.
                          const k = +m.k || 0;
                          const rest = Math.max(0, k - (+m.p || 0) * 4);
                          const fat = m.f ?? (m.c != null ? Math.max(0, Math.round((rest - m.c * 4) / 9)) : Math.round(Math.min(rest, k * 0.257) / 9));
                          const carbs = m.c ?? Math.max(0, Math.round((rest - fat * 9) / 4));
                          logFood({ name: `${m.n} (${t('coach plan')})`, kcal: k, protein: +m.p || 0, carbs, fat, meal: m.n }, toast, t);
                        }}
                      />
                    )}
                  </Row>
                </Card>
              );
            })}
          </View>
        ) : (
          <Card style={{ marginTop: 12, alignItems: 'center' }}>
            <Text variant="small" color="sec" center>
              {t('Your coach hasn’t sent a meal plan yet. You can still log what you eat.')}
            </Text>
          </Card>
        )
      ) : (
        <View>
          <Row style={{ justifyContent: 'space-between', marginTop: 16, marginBottom: 10, marginHorizontal: 4 }}>
            <Text variant="small" weight={700} color="sec" style={{ flex: 1 }}>
              {t(ramadanOn(food.plan, food.day) ? 'Suggested for Ramadan' : 'Suggested for today. Tap a meal to log it or change it.')}
            </Text>
            <Springy onPress={() => router.push('/shopping')}>
              <Text variant="small" weight={700} color="link">
                {t('Shopping list')}
              </Text>
            </Springy>
          </Row>
          <Button
            small
            kind="soft"
            icon="sparkle"
            loading={making}
            title={t(making ? 'Making recipes for you…' : 'New recipe ideas')}
            style={{ marginBottom: 10 }}
            color={c.text}
            onPress={() => freshRecipes(true)}
          />
          {/* The suggested meals' protein, when it's well short of the day's target (recipes have their own mix). */}
          {meals.length && food.target.p - meals.reduce((a, m) => a + m.p, 0) >= 15 ? (
            <Card style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
              <Icon name="info" size={18} color={c.cobalt} />
              <Text variant="small" style={{ flex: 1 }}>
                {t('These meals give about {a} g protein of your {b} g. Add {n} g more: a protein snack, or a bigger portion of chicken, meat or fish.', {
                  a: Math.round(meals.reduce((x, m) => x + m.p, 0)),
                  b: Math.round(food.target.p),
                  n: Math.round(food.target.p - meals.reduce((x, m) => x + m.p, 0)),
                })}
              </Text>
            </Card>
          ) : null}
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
                {m.contains ? (
                  <View style={{ marginTop: 6, alignSelf: 'flex-start' }}>
                    <WarnChip label={t('Contains {x}. Change this meal.', { x: m.contains.map((k) => t(ALLERGENS.find((a) => a.key === k)?.en ?? k)).join(t(', ')) })} />
                  </View>
                ) : null}
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
            ['bookmark', 'Saved meals', coach ? t('Your meals and meal codes') : t('{n} saved', { n: food.saved.length }), () => router.push('/saved-meals')],
            ['drop', 'Water', t('{a} of {b} ml', { a: fmt(food.water), b: fmt(food.waterGoal) }), () => router.push('/water')],
            ['pill', 'Vitamins and supplements', health.supplements.some((x) => x.active) ? t('{n} you take', { n: health.supplements.filter((x) => x.active).length }) : t('Add what you take, with reminders'), () => router.push('/vitamins')],
            ...(coach
              ? []
              : ([
                  ['sliders', 'My targets', t('Calories, protein, meal times'), () => router.push('/food-results')],
                ] as [IconName, string, string, () => void][])),
          ] as [IconName, string, string, () => void][]
        ).map(([icon, title, sub, fn], i) => (
          <Springy
            key={title}
            onPress={fn}
            scaleTo={0.99}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 60, paddingHorizontal: 16, paddingVertical: 10, borderTopWidth: i ? 1 : 0, borderTopColor: c.line }}>
            <View style={{ width: 36, height: 36, borderRadius: 11, backgroundColor: c.inset, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name={icon} size={20} />
            </View>
            <View style={{ flex: 1 }}>
              <Text weight={700}>{t(title)}</Text>
              <Text variant="small" color="sec">
                {sub}
              </Text>
            </View>
            <Icon name="chev" size={16} color={c.sec} />
          </Springy>
        ))}
      </View>
      <Text variant="xs" color="sec" center style={{ marginTop: 16 }}>
        {t('Food data: USDA FoodData Central and Open Food Facts. Saudi dishes are Adro estimates.')}
      </Text>

      <MealMenu meal={menuFor} logged={!!menuFor && loggedKeys.has(menuFor.key)} onClose={() => setMenuFor(null)} />
    </Screen>
  );
}

/** Protein, carbs and fat in grams, with the macro colours from the bars above. */
function Macros({ p, c: carbs, f }: { p: number; c: number; f: number }) {
  const { t } = useT();
  const { colors: c } = useSettings();
  return (
    <Row gap={10} style={{ marginTop: 3, flexWrap: 'wrap' }}>
      {(
        [
          ['Protein', p, c.cobalt],
          ['Carbs', carbs, c.macroC],
          ['Fat', f, c.macroF],
        ] as const
      ).map(([label, v, color]) => (
        <Row key={label} gap={4}>
          <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: color }} />
          <Text variant="xs" color="sec">
            {`${t(label)} ${Math.round(v)}${t('g')}`}
          </Text>
        </Row>
      ))}
    </Row>
  );
}
