import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { TextInput, View } from 'react-native';

import { Icon, Mark } from '@/components/Icon';
import { MacrosSheet } from '@/components/food/MacrosSheet';
import { ProteinSlider } from '@/components/food/ProteinSlider';
import { Stepper } from '@/components/food/Stepper';
import { TimeField } from '@/components/food/TimeField';
import { Screen } from '@/components/Screen';
import { Sheet } from '@/components/Sheet';
import { fontFor, Text } from '@/components/Text';
import { useToast } from '@/components/Toast';
import { Button, Card, Row, Segmented, Springy, Toggle } from '@/components/ui';
import { useT } from '@/i18n';
import { useFood } from '@/lib/food';
import { bmr, type FoodPlan, fmt, fmtTime, GOALS, targets } from '@/lib/nutrition';
import { useSettings } from '@/theme/settings';

const inRange = (v: number) => v >= 1.6 - 1e-9 && v <= 2.2 + 1e-9;

export default function FoodResults() {
  const { t } = useT();
  const { colors: c } = useSettings();
  const toast = useToast();
  const food = useFood();
  const { fresh } = useLocalSearchParams<{ fresh?: string }>();
  const [tab, setTab] = useState<'targets' | 'schedule'>('targets');
  const [macrosOpen, setMacrosOpen] = useState(false);
  const [waterOpen, setWaterOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const f = food.draft ?? food.plan;
  const set = (patch: Partial<FoodPlan>) => food.setDraft({ ...f, ...patch });
  const tg = targets(f);
  const rest = Math.round(bmr(f.weight, food.person) / 10) * 10;
  const low = tg.k < rest;

  useEffect(() => {
    if (!food.draft) food.setDraft({ ...food.plan });
    // Start editing from the saved plan once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const save = async () => {
    setSaving(true);
    const ok = await food.savePlan(f, true);
    setSaving(false);
    if (!ok) return toast(t('Couldn’t save. Please try again.'), { icon: 'warn' });
    food.setDraft(null);
    toast(t(fresh ? 'Plan saved. Your meal plan is ready.' : 'Plan saved'), { ai: true });
    if (router.canGoBack()) router.back();
    else router.replace('/food');
  };

  const setPk = (v: number) => set({ perKg: Math.round(Math.min(3.5, Math.max(1.2, v)) * 10) / 10, carbG: null });
  const adjK = (d: number) => set({ kcal: Math.min(6000, Math.max(800, tg.k + d)), carbG: null, fatG: f.fatG });

  return (
    <Screen
      title={t('Your plan')}
      back
      onBack={() => {
        food.setDraft(null);
        router.back();
      }}>
      <Segmented
        value={tab}
        options={[
          { value: 'targets', label: t('Targets') },
          { value: 'schedule', label: t('Schedule') },
        ]}
        onChange={setTab}
      />

      {tab === 'targets' ? (
        <View>
          <Text weight={600} style={{ marginTop: 16 }}>
            {t('Your calories are {k}, and your protein is set to {p} g per kilo.', { k: fmt(tg.k), p: f.perKg.toFixed(1) })}
          </Text>

          <Card style={{ marginTop: 16 }}>
            <Text variant="small" weight={700} color="sec">
              {t('Daily calories')}
            </Text>
            <View style={{ marginTop: 8 }}>
              <Stepper onMinus={() => adjK(-50)} onPlus={() => adjK(50)} labels={[t('Less'), t('More')]}>
                <Text num size={44} style={{ letterSpacing: -1.7, lineHeight: 50 }}>
                  {fmt(tg.k)}
                </Text>
              </Stepper>
            </View>
            <Text variant="small" weight={700} color="sec" center style={{ marginTop: 4 }}>
              {t('kcal a day, {goal}', { goal: t(GOALS[f.goal]).toLowerCase() })}
            </Text>
            {low ? (
              <View style={{ marginTop: 12, backgroundColor: c.inset, borderRadius: 16, padding: 12, flexDirection: 'row', gap: 8, alignItems: 'flex-start' }}>
                <Icon name="warn" size={20} color={c.down} />
                <Text variant="small" style={{ flex: 1 }}>
                  {t('This is below what your body burns at rest (about {n} kcal). Staying this low can cost muscle and energy. You can still save it.', { n: fmt(rest) })}
                </Text>
              </View>
            ) : null}
          </Card>

          <Card>
            <Row style={{ justifyContent: 'space-between' }}>
              <Text variant="small" weight={700} color="sec">
                {t('Protein')}
              </Text>
              <Text num>{`${tg.p} ${t('g')}`}</Text>
            </Row>
            <View style={{ marginTop: 12, alignItems: 'center' }}>
              <View style={{ width: 220 }}>
                <Stepper onMinus={() => setPk(f.perKg - 0.1)} onPlus={() => setPk(f.perKg + 0.1)} size={40} bg={c.inset} labels={[t('Less protein'), t('More protein')]}>
                  <Text num size={24} color={inRange(f.perKg) ? 'up' : 'text'}>
                    {f.perKg.toFixed(1)}
                  </Text>
                  <Text variant="xs" weight={700} color="sec">
                    {t('g per kg')}
                  </Text>
                </Stepper>
              </View>
            </View>
            <ProteinSlider value={f.perKg} onChange={setPk} />
            <Row style={{ justifyContent: 'space-between', marginTop: 10 }}>
              <Text variant="xs" weight={700} color="sec">
                1.2
              </Text>
              <Text variant="xs" weight={700} color={inRange(f.perKg) ? 'up' : 'sec'}>
                {t(inRange(f.perKg) ? 'In the common range' : f.perKg < 1.6 ? 'Below the common range' : 'Above the common range')}
              </Text>
              <Text variant="xs" weight={700} color="sec">
                3.5
              </Text>
            </Row>
            {f.perKg > 2.5 || f.perKg < 1.6 ? (
              <View style={{ marginTop: 12, backgroundColor: c.inset, borderRadius: 16, padding: 12, flexDirection: 'row', gap: 8, alignItems: 'flex-start' }}>
                <Icon name={f.perKg < 1.6 ? 'warn' : 'info'} size={18} color={f.perKg < 1.6 ? c.down : c.sec} />
                <Text variant="small" style={{ flex: 1 }}>
                  {t(
                    f.perKg < 1.6
                      ? 'Under 1.6 g per kg makes it harder to keep muscle while you train.'
                      : 'Above 2.5 g per kg gives little extra muscle for most people. It’s safe for healthy people, just drink enough water. If you have kidney problems, ask your doctor first.',
                  )}
                </Text>
              </View>
            ) : null}
          </Card>

          <Card>
            <Row style={{ justifyContent: 'space-between' }}>
              <Text weight={700}>{t('Macros')}</Text>
              <Springy onPress={() => setMacrosOpen(true)}>
                <Row gap={4}>
                  <Icon name="edit" size={14} color={c.link} />
                  <Text variant="small" weight={700} color="link">
                    {t('Edit')}
                  </Text>
                </Row>
              </Springy>
            </Row>
            <Row gap={10} style={{ marginTop: 12 }}>
              {(
                [
                  ['Protein', tg.p, 4],
                  ['Carbs', tg.c, 4],
                  ['Fat', tg.f, 9],
                ] as const
              ).map(([a, g, m]) => (
                <Springy key={a} onPress={() => setMacrosOpen(true)} style={{ flex: 1, backgroundColor: c.inset, borderRadius: 16, paddingVertical: 12, alignItems: 'center' }}>
                  <Text variant="xs" weight={700} color="sec">
                    {t(a)}
                  </Text>
                  <Text num size={20} style={{ marginTop: 4 }}>{`${g} ${t('g')}`}</Text>
                  <Text variant="xs" weight={700} color="sec">{`${Math.round((g * m * 100) / (tg.k || 1))}%`}</Text>
                </Springy>
              ))}
            </Row>
            <Text variant="xs" color="sec" style={{ marginTop: 8 }}>
              {t('Protein {p} + carbs {c} + fat {f} = {k} kcal', { p: tg.p * 4, c: tg.c * 4, f: tg.f * 9, k: fmt(tg.k) })}
            </Text>
          </Card>

          <Card onPress={() => setWaterOpen(true)} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={{ width: 36, height: 36, borderRadius: 11, backgroundColor: c.inset, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="drop" size={20} />
            </View>
            <View style={{ flex: 1 }}>
              <Text weight={700}>{t('Water')}</Text>
              <Text variant="small" color="sec">
                {t('A day, more on hot or training days')}
              </Text>
            </View>
            <Text num size={20}>{`${(f.water / 1000).toFixed(1)} ${t('L')}`}</Text>
          </Card>

          <Button kind="glass" title={t('Next: meal times and training')} style={{ marginTop: 16 }} onPress={() => setTab('schedule')} />
        </View>
      ) : (
        <Schedule f={f} set={set} />
      )}

      <Button title={t('Save my plan')} style={{ marginTop: 24 }} onPress={save} loading={saving} />

      <MacrosSheet
        open={macrosOpen}
        onClose={() => setMacrosOpen(false)}
        initial={tg}
        weight={f.weight}
        onSave={(m) => {
          set({ perKg: m.p / f.weight, carbG: m.c, fatG: m.f, kcal: m.p * 4 + m.c * 4 + m.f * 9 });
          setMacrosOpen(false);
          toast(t('Macros saved. Daily calories: {k} kcal', { k: fmt(m.p * 4 + m.c * 4 + m.f * 9) }), { icon: 'check' });
        }}
      />

      <Sheet open={waterOpen} onClose={() => setWaterOpen(false)}>
        <Text variant="h2">{t('Daily water')}</Text>
        <Text variant="small" color="sec" style={{ marginTop: 4 }}>
          {t('About 35 ml per kg, more if you work in the sun or train hard.')}
        </Text>
        <View style={{ marginTop: 20 }}>
          <Stepper onMinus={() => set({ water: Math.max(1000, f.water - 100) })} onPlus={() => set({ water: Math.min(8000, f.water + 100) })}>
            <Text num size={40}>{`${(f.water / 1000).toFixed(1)} ${t('L')}`}</Text>
          </Stepper>
        </View>
        <Button title={t('Done')} style={{ marginTop: 20 }} onPress={() => setWaterOpen(false)} />
      </Sheet>
    </Screen>
  );
}

function Schedule({ f, set }: { f: FoodPlan; set: (p: Partial<FoodPlan>) => void }) {
  const { t, lang } = useT();
  const { colors: c } = useSettings();
  const toast = useToast();
  const sortMeals = (meals: FoodPlan['meals']) => [...meals].sort((a, b) => a.t.localeCompare(b.t));

  const setWorkout = (v: string) => {
    const pre = f.meals.findIndex((m) => (m.type ?? m.n) === 'Pre-workout');
    let meals = f.meals;
    if (pre >= 0) {
      const [h, m] = v.split(':').map(Number);
      const tm = (h * 60 + m - 60 + 1440) % 1440;
      const nt = `${String(Math.floor(tm / 60)).padStart(2, '0')}:${String(tm % 60).padStart(2, '0')}`;
      meals = sortMeals(f.meals.map((x, i) => (i === pre ? { ...x, t: nt } : x)));
    }
    set({ myWorkoutTime: v, meals });
    toast(t('Workout time set'), { icon: 'clock' });
  };

  return (
    <View>
      <Text variant="h3" style={{ marginTop: 22, marginBottom: 10, marginHorizontal: 2 }}>
        {t('Meal times')}
      </Text>
      {f.ramadan ? (
        <Card style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
          <Icon name="moon" color={c.cobalt} />
          <Text variant="small" style={{ flex: 1 }}>
            {t('Ramadan mode is on. Your meals are iftar, a main meal and suhoor.')}
          </Text>
        </Card>
      ) : (
        <View style={{ backgroundColor: c.card, borderRadius: 22, overflow: 'hidden', marginBottom: 8 }}>
          {f.meals.map((m, i) => (
            <View key={`${m.n}-${i}`} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 60, paddingHorizontal: 14, borderTopWidth: i ? 1 : 0, borderTopColor: c.line }}>
              <Icon name="clock" size={18} color={c.sec} />
              <TextInput
                defaultValue={t(m.n)}
                maxLength={24}
                accessibilityLabel={t('Meal name')}
                onEndEditing={(e) => {
                  const n = e.nativeEvent.text.trim();
                  if (n && n !== t(m.n)) set({ meals: f.meals.map((x, j) => (j === i ? { ...x, n, type: x.type ?? x.n } : x)) });
                }}
                onBlur={(e) => {
                  const n = ((e as unknown as { target: { value?: string } }).target?.value ?? '').trim();
                  if (n && n !== t(m.n)) set({ meals: f.meals.map((x, j) => (j === i ? { ...x, n, type: x.type ?? x.n } : x)) });
                }}
                style={{ flex: 1, minWidth: 0, fontFamily: fontFor('manrope', 700), fontSize: 15, color: c.text, paddingVertical: 6, outlineStyle: 'none' } as object}
              />
              <TimeField value={m.t} label={t(m.n)} height={40} onChange={(v) => set({ meals: sortMeals(f.meals.map((x, j) => (j === i ? { ...x, t: v } : x))) })} />
              {f.meals.length > 2 ? (
                <Springy
                  onPress={() => {
                    set({ meals: f.meals.filter((_, j) => j !== i) });
                    toast(t('{meal} removed', { meal: t(m.n) }), { icon: 'trash' });
                  }}
                  accessibilityLabel={t('Remove {meal}', { meal: t(m.n) })}>
                  <Icon name="trash" size={16} color={c.sec} />
                </Springy>
              ) : null}
            </View>
          ))}
        </View>
      )}
      {!f.ramadan ? (
        <Row style={{ justifyContent: 'space-between', paddingHorizontal: 4 }}>
          <Text variant="xs" color="sec" style={{ flex: 1 }}>
            {t(f.meals.length <= 2 ? 'You need at least 2 meals.' : 'Tap a name or time to change it.')}
          </Text>
          <Springy
            onPress={() => {
              const last = (f.meals[f.meals.length - 1]?.t ?? '18:00').split(':').map(Number);
              const n = f.meals.length === 4 ? 'Snack' : `Meal ${f.meals.length + 1}`;
              set({ meals: [...f.meals, { n, t: `${String(Math.min(23, last[0] + 2)).padStart(2, '0')}:00` }] });
            }}>
            <Row gap={4}>
              <Icon name="plus" size={14} color={c.link} strokeWidth={2.4} />
              <Text variant="small" weight={700} color="link">
                {t('Add a meal')}
              </Text>
            </Row>
          </Springy>
        </Row>
      ) : null}

      <Card style={{ marginTop: 12, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Icon name="moon" color={c.cobalt} />
        <View style={{ flex: 1 }}>
          <Text weight={700}>{t('Ramadan mode')}</Text>
          <Text variant="small" color="sec">
            {t('Meals around iftar and suhoor')}
          </Text>
        </View>
        <Toggle value={!!f.ramadan} onChange={(v) => set({ ramadan: v })} label={t('Ramadan mode')} />
      </Card>

      <Text variant="h3" style={{ marginTop: 22, marginBottom: 10, marginHorizontal: 2 }}>
        {t('Training')}
      </Text>
      <Card>
        <Row style={{ justifyContent: 'space-between' }}>
          <View style={{ flex: 1 }}>
            <Text weight={700}>{t('Your workout time')}</Text>
            <Text variant="xs" color="sec">
              {t('When you usually train')}
            </Text>
          </View>
          <TimeField value={f.myWorkoutTime ?? f.workoutTime} label={t('Your workout time')} onChange={setWorkout} />
        </Row>
        <View style={{ marginTop: 12, backgroundColor: c.inset, borderRadius: 16, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Mark size={22} color={c.cobalt} stroke={4.5} />
          <View style={{ flex: 1 }}>
            <Text variant="small" weight={700}>
              {t('Suggested: {time}', { time: fmtTime(f.workoutTime, lang) })}
            </Text>
            <Text variant="xs" color="sec">
              {t('{intensity} intensity, after work with time to eat first', { intensity: t(f.intensity) })}
            </Text>
          </View>
          {f.myWorkoutTime === f.workoutTime ? null : <Button small kind="soft" title={t('Use')} onPress={() => setWorkout(f.workoutTime)} />}
        </View>
      </Card>
    </View>
  );
}
