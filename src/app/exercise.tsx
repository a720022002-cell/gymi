import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { Tag } from '@/components/food/Chips';
import { Glass } from '@/components/Glass';
import { Icon } from '@/components/Icon';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { useToast } from '@/components/Toast';
import { Button, Chip, Row, Springy } from '@/components/ui';
import { useT } from '@/i18n';
import { type DbExercise, dbExName, getExercise, toPlanEx } from '@/lib/exercisesDb';
import { useTrain } from '@/lib/train';
import { muscleLabel, workoutMinutes } from '@/lib/training';
import { useSettings } from '@/theme/settings';

const LEVEL: Record<string, string> = { beginner: 'Beginner', intermediate: 'Intermediate', expert: 'Expert' };

/** One exercise: pictures, how to do it, machines (design: exercise). */
export default function ExerciseScreen() {
  const { t, lang } = useT();
  const { colors: c } = useSettings();
  const toast = useToast();
  const train = useTrain();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [e, setE] = useState<DbExercise | null>(null);
  const [loadedId, setLoadedId] = useState<string | null>(null);
  const [frame, setFrame] = useState(0);
  const [play, setPlay] = useState(true);

  useEffect(() => {
    let live = true;
    getExercise(id).then((x) => {
      if (!live) return;
      setE(x);
      setLoadedId(id);
    });
    return () => {
      live = false;
    };
  }, [id]);

  // Flip between the start and end pictures so it looks like the movement.
  useEffect(() => {
    if (!play || !e || e.images.length < 2) return;
    const tm = setInterval(() => setFrame((f) => (f + 1) % e.images.length), 900);
    return () => clearInterval(tm);
  }, [play, e]);

  if (loadedId !== id)
    return (
      <Screen title={t('Exercise')} back>
        <ActivityIndicator color={c.cobalt} style={{ marginTop: 40 }} />
      </Screen>
    );
  if (!e)
    return (
      <Screen title={t('Exercise')} back>
        <Text color="sec">{t('This exercise isn’t available.')}</Text>
      </Screen>
    );

  const steps = lang === 'ar' && e.steps_ar?.length ? e.steps_ar : e.steps_en;
  const todayW = train.todayName && !train.todayLog ? train.todayName : null;
  const inToday = !!todayW && !!train.plan?.workouts[todayW]?.ex.some((x) => x.id === e.id);

  const addToToday = () => {
    const p = train.plan;
    if (!p || !todayW) return;
    const W = p.workouts[todayW] ?? { ex: [], focus: '', min: 0 };
    const ex = [...W.ex, toPlanEx(e)];
    train.updatePlan({ workouts: { ...p.workouts, [todayW]: { ...W, ex, min: workoutMinutes(ex) } } });
    toast(t('{x} added to {w}', { x: dbExName(e, lang), w: t(todayW) }), { icon: 'check' });
  };

  return (
    <Screen title={dbExName(e, lang)} back>
      <Springy onPress={() => setPlay(!play)} scaleTo={0.99} accessibilityLabel={t(play ? 'Pause' : 'Play')} style={{ aspectRatio: 16 / 11, borderRadius: 22, overflow: 'hidden', backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' }}>
        {e.images.length ? (
          e.images.map((u, i) => <Image key={u} source={{ uri: u }} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: i === frame ? 1 : 0 }} contentFit="contain" />)
        ) : (
          <Icon name="train" size={48} color={c.sec} />
        )}
        {e.images.length > 1 ? (
          <View style={{ position: 'absolute', bottom: 10, end: 10 }}>
            <Glass style={{ width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name={play ? 'minus' : 'play'} size={18} strokeWidth={2.2} />
            </Glass>
          </View>
        ) : null}
      </Springy>
      <Row gap={8} style={{ marginTop: 14, flexWrap: 'wrap' }}>
        <Tag label={muscleLabel(e.muscle, lang, t)} />
        <Tag label={t(e.equipment)} />
        {e.level && LEVEL[e.level] ? <Tag label={t(LEVEL[e.level])} /> : null}
      </Row>

      <Text variant="h3" style={{ marginTop: 22, marginBottom: 10, marginHorizontal: 2 }}>
        {t('How to do it')}
      </Text>
      {steps.map((s, i) => (
        <Row key={i} gap={12} style={{ alignItems: 'flex-start', marginBottom: 10 }}>
          <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: c.card, alignItems: 'center', justifyContent: 'center' }}>
            <Text num size={12}>
              {i + 1}
            </Text>
          </View>
          <Text style={{ flex: 1, paddingTop: 2 }}>{s}</Text>
        </Row>
      ))}
      {lang === 'ar' && !e.steps_ar?.length ? (
        <Text variant="xs" color="sec" style={{ marginHorizontal: 2 }}>
          {t('The Arabic steps for this exercise are coming soon.')}
        </Text>
      ) : null}

      {e.machines?.length ? (
        <View>
          <Text variant="h3" style={{ marginTop: 18, marginBottom: 10, marginHorizontal: 2 }}>
            {t('Works with')}
          </Text>
          <Row gap={8} style={{ flexWrap: 'wrap' }}>
            {e.machines.map(([en, ar]) => (
              <Chip key={en} title={lang === 'ar' ? ar : en} />
            ))}
          </Row>
        </View>
      ) : null}

      {todayW ? (
        <Button title={t(inToday ? 'Already in today’s workout' : 'Add to today’s workout')} disabled={inToday} style={{ marginTop: 24 }} onPress={addToToday} />
      ) : null}
      <Button kind="ghost" title={t('Back')} style={{ marginTop: 8 }} onPress={() => router.back()} />
      <Text variant="xs" color="sec" center style={{ marginTop: 8 }}>
        {t('Pictures and steps: Free Exercise DB (public domain).')}
      </Text>
    </Screen>
  );
}
