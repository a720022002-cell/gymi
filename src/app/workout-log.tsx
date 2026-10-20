import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { Screen } from '@/components/Screen';
import { ShareWorkoutSheet } from '@/components/social/ShareWorkoutSheet';
import { Text } from '@/components/Text';
import { LoggedExercises } from '@/components/train/LoggedExercises';
import { Button, Card } from '@/components/ui';
import { useT } from '@/i18n';
import { fmt } from '@/lib/nutrition';
import { type WorkoutLog, useTrain } from '@/lib/train';
import { workoutTitle } from '@/lib/training';
import { useWeight } from '@/lib/units';
import { loadWorkout } from '@/lib/workoutHistory';
import { useSettings } from '@/theme/settings';

/** One past workout: when, how long, how much, and every exercise with its sets in the order you did them. */
export default function WorkoutLogScreen() {
  const { t, lang } = useT();
  const W = useWeight();
  const { colors: c } = useSettings();
  const train = useTrain();
  const { id } = useLocalSearchParams<{ id: string }>();
  // The last 120 days are already on the phone; older ones are read from your account.
  const known = train.logs.find((l) => l.id === id) ?? null;
  const [fetched, setFetched] = useState<{ id: string; log: WorkoutLog | null } | null>(null);
  const [share, setShare] = useState(false);

  useEffect(() => {
    if (known || !id) return;
    let live = true;
    loadWorkout(id).then((log) => live && setFetched({ id, log }));
    return () => {
      live = false;
    };
  }, [id, known]);

  const log = known ?? (fetched?.id === id ? fetched.log : undefined);
  if (log === undefined)
    return (
      <Screen title={t('Workout')} back>
        <ActivityIndicator color={c.cobalt} style={{ marginTop: 40 }} />
      </Screen>
    );
  if (!log)
    return (
      <Screen title={t('Workout')} back>
        <Text color="sec">{t('This workout isn’t available.')}</Text>
      </Screen>
    );

  const locale = lang === 'ar' ? 'ar-u-nu-latn' : 'en-US';
  const when = new Intl.DateTimeFormat(locale, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }).format(new Date(`${log.day}T12:00:00`));
  const time = log.started_at ? new Intl.DateTimeFormat(locale, { hour: 'numeric', minute: '2-digit' }).format(new Date(log.started_at)) : '';
  const stats: [string, string][] = [
    ['Time', t('{n} min', { n: log.minutes })],
    ['Volume', `${fmt(W.num(log.volume))} ${W.label}`],
    ['Sets', String(log.sets_done)],
    ['Calories burned', `${fmt(log.kcal)} ${t('kcal')}`],
    ...(log.avg_hr ? ([['Heart rate', t('{a} avg · {m} max', { a: log.avg_hr, m: log.max_hr ?? log.avg_hr })]] as [string, string][]) : []),
  ];

  return (
    <Screen title={workoutTitle(log.name, t)} back>
      <Text color="sec" style={{ marginTop: -6, marginHorizontal: 4 }}>
        {time ? `${when} · ${time}` : when}
      </Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 14 }}>
        {stats.map(([a, b]) => (
          <Card key={a} style={{ width: '47%', flexGrow: 1, alignItems: 'center', marginBottom: 0 }}>
            <Text num size={20}>
              {b}
            </Text>
            <Text variant="xs" weight={700} color="sec">
              {t(a)}
            </Text>
          </Card>
        ))}
      </View>
      <Text variant="small" weight={700} color="sec" style={{ marginTop: 22, marginBottom: 8, marginHorizontal: 4 }}>
        {t('Exercises, in the order you did them')}
      </Text>
      <LoggedExercises log={log} />
      <Button kind="glass" icon="share" title={t('Share your workout')} style={{ marginTop: 16 }} onPress={() => setShare(true)} />
      <ShareWorkoutSheet log={log} open={share} onClose={() => setShare(false)} />
    </Screen>
  );
}
