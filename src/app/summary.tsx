import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { Icon, Mark } from '@/components/Icon';
import { Ring } from '@/components/Ring';
import { Screen } from '@/components/Screen';
import { ShareWorkoutSheet } from '@/components/social/ShareWorkoutSheet';
import { Text } from '@/components/Text';
import { Button, Card, Row } from '@/components/ui';
import { useT } from '@/i18n';
import { EX, workoutTitle } from '@/lib/training';
import { fmt } from '@/lib/nutrition';
import { useTrain } from '@/lib/train';
import { useWeight } from '@/lib/units';
import { useSettings } from '@/theme/settings';

/** Workout done: time, volume, records (design: summary). */
export default function Summary() {
  const { t, lang } = useT();
  const W = useWeight();
  const { colors: c } = useSettings();
  const train = useTrain();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const [share, setShare] = useState(false);
  const s = train.logs.find((l) => l.id === id) ?? train.logs[0];
  if (!s)
    return (
      <Screen title={t('Workout done')} back>
        <Text color="sec">{t('No workout yet.')}</Text>
      </Screen>
    );
  const inten = s.volume > 9000 ? 'Hard' : s.volume > 4000 ? 'Moderate' : 'Light';
  const exName = (exId: string, n: string) => (lang === 'ar' && EX[exId] ? EX[exId].ar : n);

  return (
    <Screen title={t('Workout done')} back onBack={() => router.replace('/train')}>
      <View style={{ alignItems: 'center', paddingTop: 10, paddingBottom: 6 }}>
        <Ring value={1} max={1} size={120} stroke={12}>
          <Icon name="check" size={40} color={c.cobalt} strokeWidth={2.6} />
        </Ring>
        <Text variant="h1" center style={{ marginTop: 16 }}>
          {t('{w}, done', { w: workoutTitle(s.name, t) })}
        </Text>
        <Text color="sec" center style={{ marginTop: 4 }}>
          {t('Great work. It’s saved and will show in grey next time.')}
        </Text>
      </View>
      <Card style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, marginTop: 16, marginBottom: 10 }}>
        <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(245,158,11,0.16)', alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="flame" size={24} color="#F59E0B" strokeWidth={2} />
        </View>
        <View>
          <Text num size={26}>
            {`${fmt(s.kcal)} ${t('kcal')}`}
          </Text>
          <Text variant="xs" weight={700} color="sec">
            {t('Calories burned')}
          </Text>
        </View>
      </Card>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        {(
          [
            ['Time', t('{n} min', { n: s.minutes })],
            ['Volume', `${fmt(W.num(s.volume))} ${W.label}`],
            ['Sets', String(s.sets_done)],
            ['Intensity', t(inten)],
            // From the watch, once it has sent the heart rate for this workout.
            ...(s.avg_hr ? ([['Heart rate', t('{a} avg · {m} max', { a: s.avg_hr, m: s.max_hr ?? s.avg_hr })]] as const) : []),
          ] as const
        ).map(([a, b]) => (
          <Card key={a} style={{ width: '47%', flexGrow: 1, alignItems: 'center', marginBottom: 0 }}>
            <Text num size={22}>
              {b}
            </Text>
            <Text variant="xs" weight={700} color="sec">
              {t(a)}
            </Text>
          </Card>
        ))}
      </View>

      <Text variant="small" weight={700} color="sec" style={{ marginTop: 20, marginBottom: 8, marginHorizontal: 4 }}>
        {t('Personal records')}
      </Text>
      {s.prs.length ? (
        <View style={{ backgroundColor: c.card, borderRadius: 22, overflow: 'hidden', marginBottom: 12 }}>
          {s.prs.map((p, i) => (
            <Row key={p.id} gap={12} style={{ minHeight: 60, paddingHorizontal: 16, borderTopWidth: i ? 1 : 0, borderTopColor: c.line }}>
              <Icon name="trophy" size={20} color={c.cobalt} />
              <View style={{ flex: 1 }}>
                <Text weight={700}>{exName(p.id, p.n)}</Text>
                <Text variant="small" color="sec">
                  {t('New best weight')}
                </Text>
              </View>
              <Text num color="up">{`${W.show(p.w)} ${W.label}`}</Text>
            </Row>
          ))}
        </View>
      ) : (
        <Card>
          <Text variant="small" color="sec">
            {t('No new records today. Consistency is what builds them.')}
          </Text>
        </Card>
      )}

      <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Icon name="flame" size={20} color={c.cobalt} />
        <View style={{ flex: 1 }}>
          <Text weight={700}>{train.streak === 1 ? t('First workout in a row. Keep it going.') : t('{n} workouts in a row', { n: train.streak })}</Text>
          <Text variant="small" color="sec">
            {t('Best: {n}', { n: Math.max(train.bestStreak, train.streak) })}
          </Text>
        </View>
      </Card>
      {s.ups || s.downs ? (
        <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Icon name="up" size={20} color={c.up} strokeWidth={2.6} />
          <Text style={{ flex: 1 }}>{t('{n} exercises went up', { n: s.ups })}</Text>
          <Icon name="down" size={20} color={c.down} strokeWidth={2.6} />
          <Text>{t('{n} went down', { n: s.downs })}</Text>
        </Card>
      ) : null}
      <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Mark size={24} color={c.cobalt} stroke={5} />
        <Text variant="small" weight={700} style={{ flex: 1 }}>
          {t('Have your post-workout meal within 2 hours.')}
        </Text>
      </Card>
      <Button icon="camera" title={t('Share on a photo')} style={{ marginTop: 8 }} onPress={() => router.push({ pathname: '/share-photo', params: { id: s.id } })} />
      <Button kind="glass" icon="share" title={t('Share your workout')} style={{ marginTop: 8 }} onPress={() => setShare(true)} />
      <Button title={t('Done')} style={{ marginTop: 8 }} onPress={() => router.replace('/home')} />
      <ShareWorkoutSheet log={s} open={share} onClose={() => setShare(false)} />
    </Screen>
  );
}
