import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { TextInput, View } from 'react-native';

import { Icon } from '@/components/Icon';
import { Screen } from '@/components/Screen';
import { fontFor, Text } from '@/components/Text';
import { useToast } from '@/components/Toast';
import { ExercisePicker } from '@/components/train/ExercisePicker';
import { Button, Card, Row, Springy } from '@/components/ui';
import { useT } from '@/i18n';
import { toPlanEx } from '@/lib/exercisesDb';
import { useTrain } from '@/lib/train';
import { DAYS_LONG, exInfo, type PlanEx, type TrainPlan, workoutMinutes } from '@/lib/training';
import { useSettings } from '@/theme/settings';

/** Edit a workout: name, exercises, sets and reps (design: dayedit). */
export default function DayEdit() {
  const { t, lang } = useT();
  const { colors: c } = useSettings();
  const toast = useToast();
  const train = useTrain();
  const { d: dParam } = useLocalSearchParams<{ d: string }>();
  const d = Number(dParam ?? 0);
  const p = train.plan;
  const w = train.week[d]?.w ?? null;
  const [name, setName] = useState(w ?? '');
  const [pick, setPick] = useState<number | null>(null); // -1 = add, i = replace
  if (!p || !w)
    return (
      <Screen title={t('Edit workout')} back>
        <Text color="sec">{t('This day is a rest day.')}</Text>
      </Screen>
    );
  const W = p.workouts[w] ?? { ex: [], focus: '', min: 0 };
  const days = train.week.filter((x) => x.w === w).length;

  const setEx = (ex: PlanEx[]) => train.updatePlan({ workouts: { ...p.workouts, [w]: { ...W, ex, min: workoutMinutes(ex) } } });

  const rename = () => {
    const n = name.trim().slice(0, 20);
    if (!n || n === w) return setName(w);
    if (p.workouts[n]) {
      setName(w);
      return toast(t('A workout with that name already exists'), { icon: 'info' });
    }
    const workouts = { ...p.workouts, [n]: W };
    delete workouts[w];
    const fix = (wk: TrainPlan['week']) => wk.map((x) => (x.w === w ? { ...x, w: n } : x));
    train.updatePlan({ workouts, week: fix(p.week), override: p.override ? { ...p.override, week: fix(p.override.week) } : undefined });
  };

  const del = (i: number) => {
    const it = W.ex[i];
    setEx(W.ex.filter((_, j) => j !== i));
    toast(t('Removed {name}', { name: exInfo(it, lang).name }), { icon: 'trash', undo: () => setEx(W.ex) });
  };

  return (
    <Screen title={t('Edit workout')} back>
      <Text variant="small" weight={700} color="sec">
        {t(DAYS_LONG[d])}
        {days > 1 ? ` ${t('and {n} more', { n: days - 1 })}` : ''}
      </Text>
      <TextInput
        value={name === w ? t(w) : name}
        onChangeText={setName}
        onBlur={rename}
        onSubmitEditing={rename}
        maxLength={20}
        accessibilityLabel={t('Workout name')}
        style={{ marginTop: 4, fontFamily: fontFor('sora', 600), fontSize: 24, color: c.text, borderBottomWidth: 2, borderStyle: 'dashed', borderColor: c.line, paddingVertical: 4, outlineStyle: 'none', textAlign: lang === 'ar' ? 'right' : 'left' } as object}
      />
      <Text variant="xs" color="sec" style={{ marginTop: 4 }}>
        {t('Changes apply every day this workout is planned.')}
      </Text>

      <View style={{ marginTop: 12 }}>
        {W.ex.length ? (
          W.ex.map((x, i) => {
            const info = exInfo(x, lang);
            return (
              <Card key={`${x.id}-${i}`} style={{ paddingVertical: 10, paddingHorizontal: 12, marginBottom: 8 }}>
                <Row gap={8}>
                  <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: c.inset, alignItems: 'center', justifyContent: 'center' }}>
                    <Text num size={11}>
                      {i + 1}
                    </Text>
                  </View>
                  <Springy onPress={() => setPick(i)} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6, minWidth: 0 }}>
                    <Text weight={700} numberOfLines={1} style={{ flexShrink: 1 }}>
                      {info.name}
                    </Text>
                    <Icon name="swap" size={14} color={c.cobalt} />
                  </Springy>
                  <Springy
                    disabled={!i}
                    onPress={() => {
                      const ex = [...W.ex];
                      [ex[i - 1], ex[i]] = [ex[i], ex[i - 1]];
                      setEx(ex);
                    }}
                    accessibilityLabel={t('Move up')}
                    style={{ width: 32, height: 32, alignItems: 'center', justifyContent: 'center', opacity: i ? 1 : 0.3 }}>
                    <Icon name="up" size={14} strokeWidth={2.2} />
                  </Springy>
                  <Springy onPress={() => del(i)} accessibilityLabel={t('Remove {name}', { name: info.name })} style={{ width: 32, height: 32, alignItems: 'center', justifyContent: 'center' }}>
                    <Icon name="trash" size={15} color={c.down} />
                  </Springy>
                </Row>
                <Row gap={10} style={{ marginTop: 8, paddingStart: 32 }}>
                  <Text variant="xs" weight={700} color="sec">
                    {t('Sets')}
                  </Text>
                  <Row gap={4}>
                    <Springy onPress={() => setEx(W.ex.map((y, j) => (j === i ? { ...y, sets: Math.max(1, y.sets - 1) } : y)))} accessibilityLabel={t('Less')} style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: c.inset, alignItems: 'center', justifyContent: 'center' }}>
                      <Icon name="minus" size={13} strokeWidth={2.4} />
                    </Springy>
                    <Text num style={{ width: 20, textAlign: 'center' }}>
                      {x.sets}
                    </Text>
                    <Springy onPress={() => setEx(W.ex.map((y, j) => (j === i ? { ...y, sets: Math.min(8, y.sets + 1) } : y)))} accessibilityLabel={t('More')} style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: c.inset, alignItems: 'center', justifyContent: 'center' }}>
                      <Icon name="plus" size={13} strokeWidth={2.4} />
                    </Springy>
                  </Row>
                  <Text variant="xs" weight={700} color="sec" style={{ marginStart: 6 }}>
                    {t(info.timed ? 'Seconds' : 'Reps')}
                  </Text>
                  <TextInput
                    value={x.reps}
                    maxLength={7}
                    onChangeText={(v) => setEx(W.ex.map((y, j) => (j === i ? { ...y, reps: v } : y)))}
                    onBlur={() => !x.reps.trim() && setEx(W.ex.map((y, j) => (j === i ? { ...y, reps: '10' } : y)))}
                    accessibilityLabel={t('Reps')}
                    style={{ width: 64, height: 36, borderRadius: 8, backgroundColor: c.inset, textAlign: 'center', fontFamily: fontFor('sora', 600), color: c.text, outlineStyle: 'none' } as object}
                  />
                </Row>
              </Card>
            );
          })
        ) : (
          <Card style={{ alignItems: 'center' }}>
            <Text variant="small" color="sec">
              {t('No exercises yet.')}
            </Text>
          </Card>
        )}
      </View>
      <Button small kind="soft" icon="plus" title={t('Add an exercise')} style={{ alignSelf: 'stretch' }} onPress={() => setPick(-1)} />
      <Button
        title={t('Done')}
        style={{ marginTop: 12 }}
        onPress={() => {
          router.back();
          toast(t('{w} saved', { w: t(w) }), { icon: 'check' });
        }}
      />

      <ExercisePicker
        open={pick !== null}
        replacing={pick !== null && pick >= 0}
        title={pick !== null && pick >= 0 && W.ex[pick] ? t('Replace {x}', { x: exInfo(W.ex[pick], lang).name }) : t('Add an exercise')}
        exclude={pick === -1 ? W.ex.map((x) => x.id) : undefined}
        onClose={() => setPick(null)}
        onPick={(e) => {
          const pe = toPlanEx(e);
          if (pick !== null && pick >= 0) setEx(W.ex.map((y, j) => (j === pick ? { ...pe, sets: y.sets, reps: y.reps } : y)));
          else setEx([...W.ex, pe]);
          setPick(null);
          toast(t(pick !== null && pick >= 0 ? '{x} swapped in' : '{x} added', { x: e.name_ar && lang === 'ar' ? e.name_ar : e.name_en }), { icon: 'check' });
        }}
      />
    </Screen>
  );
}
