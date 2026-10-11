import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Animated, Easing, View } from 'react-native';

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
import { exMuscle, muscleLabel, workoutMinutes } from '@/lib/training';
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
  // 0 = start position, 1 = end position; the end picture fades in and out like a short clip.
  const [fade] = useState(() => new Animated.Value(0));
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

  // Load both pictures first so the movement never shows a blank frame.
  useEffect(() => {
    if (e?.images.length) Image.prefetch(e.images);
  }, [e]);

  // Plays as soon as the exercise opens: ease into the end position, hold, ease back, hold, again and again.
  useEffect(() => {
    if (!play || !e || e.images.length < 2) return;
    const ease = Easing.inOut(Easing.quad);
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(350),
        Animated.timing(fade, { toValue: 1, duration: 650, easing: ease, useNativeDriver: false }),
        Animated.delay(350),
        Animated.timing(fade, { toValue: 0, duration: 650, easing: ease, useNativeDriver: false }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [play, e, fade]);

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
  // Today's workout, or the next planned one when today is a rest day or already done.
  const nextW = (() => {
    for (let i = 1; i <= 7; i++) {
      const w = train.week[(train.todayIdx + i) % 7]?.w;
      if (w && train.plan?.workouts[w]) return w;
    }
    return Object.keys(train.plan?.workouts ?? {})[0] ?? null;
  })();
  const isToday = !!train.todayName && !train.todayLog && !!train.plan?.workouts[train.todayName];
  const todayW = isToday ? train.todayName : nextW;
  const inToday = !!todayW && !!train.plan?.workouts[todayW]?.ex.some((x) => x.id === e.id);

  const addToToday = () => {
    const p = train.plan;
    if (!p || !todayW) return;
    const W = p.workouts[todayW] ?? { ex: [], focus: '', min: 0 };
    const ex = [...W.ex, toPlanEx(e)];
    train.updatePlan({ workouts: { ...p.workouts, [todayW]: { ...W, ex, min: workoutMinutes(ex) } } });
    toast(isToday ? t('{x} added to {w}', { x: dbExName(e, lang), w: t(todayW) }) : t('Added {x} to {w} day', { x: dbExName(e, lang), w: t(todayW) }), { icon: 'check' });
  };

  return (
    <Screen title={dbExName(e, lang)} back>
      <Springy onPress={() => setPlay(!play)} scaleTo={0.99} accessibilityLabel={t(play ? 'Pause' : 'Play')} style={{ aspectRatio: 16 / 11, borderRadius: 22, overflow: 'hidden', backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' }}>
        {e.images.length ? (
          <>
            <Image source={{ uri: e.images[0] }} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} contentFit="contain" />
            {e.images[1] ? (
              <Animated.View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: fade }}>
                <Image source={{ uri: e.images[1] }} style={{ flex: 1, backgroundColor: '#FFFFFF' }} contentFit="contain" />
              </Animated.View>
            ) : null}
          </>
        ) : (
          <Icon name="train" size={48} color={c.sec} />
        )}
        {e.images.length > 1 ? (
          <View style={{ position: 'absolute', bottom: 10, end: 10 }}>
            <Glass style={{ width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name={play ? 'pause' : 'play'} size={18} strokeWidth={2.6} />
            </Glass>
          </View>
        ) : null}
      </Springy>
      <Row gap={8} style={{ marginTop: 14, flexWrap: 'wrap' }}>
        <Tag label={muscleLabel(exMuscle(e.id, e.muscle, e.muscles), lang, t)} />
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

      {todayW && !train.coach ? (
        <Button
          title={!inToday ? t('Add to today’s workout') : isToday ? t('Already in today’s workout') : t('Already in {w}', { w: t(todayW) })}
          disabled={inToday}
          style={{ marginTop: 24 }}
          onPress={addToToday}
        />
      ) : null}
      <Button kind="ghost" title={t('Back')} style={{ marginTop: 8 }} onPress={() => router.back()} />
      <Text variant="xs" color="sec" center style={{ marginTop: 8 }}>
        {t('Pictures and steps: Free Exercise DB (public domain).')}
      </Text>
    </Screen>
  );
}
