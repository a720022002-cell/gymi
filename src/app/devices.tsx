import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Platform, View } from 'react-native';

import { BarChart, LineChart } from '@/components/Charts';
import { Icon, type IconName } from '@/components/Icon';
import { Screen } from '@/components/Screen';
import { Sheet } from '@/components/Sheet';
import { List, ListRow } from '@/components/social/List';
import { Text } from '@/components/Text';
import { useToast } from '@/components/Toast';
import { useRecovery } from '@/components/train/RecoveryCard';
import { Button, Card } from '@/components/ui';
import { useT } from '@/i18n';
import { useFood } from '@/lib/food';
import { useHealth } from '@/lib/health';
import { addDays, fmt } from '@/lib/nutrition';
import { fx } from '@/lib/progress';
import { supabase } from '@/lib/supabase';
import { useTrain } from '@/lib/train';
import { useSettings } from '@/theme/settings';

type Key = 'steps' | 'burned' | 'weight' | 'sleep' | 'recovery' | 'workouts';

/** Your readings: what Gymi knows today, and devices to connect (design: devices). */
export default function Devices() {
  const { t } = useT();
  const { colors: c } = useSettings();
  const toast = useToast();
  const food = useFood();
  const train = useTrain();
  const health = useHealth();
  const { r } = useRecovery();
  const [steps7, setSteps7] = useState<number[]>([]);
  const [open, setOpen] = useState<Key | null>(null);
  const week = Array.from({ length: 7 }, (_, i) => addDays(food.today, i - 6));

  useEffect(() => {
    let alive = true;
    supabase
      .from('step_logs')
      .select('day,steps')
      .gte('day', addDays(food.today, -6))
      .then(({ data }) => {
        if (!alive) return;
        const m = new Map(((data as { day: string; steps: number }[]) ?? []).map((x) => [x.day, x.steps]));
        setSteps7(Array.from({ length: 7 }, (_, i) => m.get(addDays(food.today, i - 6)) ?? 0));
      });
    return () => {
      alive = false;
    };
  }, [food.today]);

  const w = health.weights.at(-1);
  const sleepBy = new Map(health.checkins.map((x) => [x.day, x.sleep_h]));
  const lastSleep = [...health.checkins].reverse().find((x) => x.sleep_h != null);
  const workoutKcal = train.logs.filter((l) => l.day === food.today).reduce((a, l) => a + l.kcal, 0);
  const tiles: [Key, IconName, string, string, string][] = [
    ['steps', 'walk', 'Steps', fmt(food.steps), ''],
    ['burned', 'flame', 'Calories burned in exercise', fmt(food.burned + workoutKcal), 'kcal'],
    ['weight', 'scale', 'Weight', w ? fx(w.value) : '–', w ? 'kg' : ''],
    ['sleep', 'moon', 'Sleep', lastSleep ? fx(lastSleep.sleep_h as number) : '–', lastSleep ? 'h' : ''],
    ['recovery', 'bolt', 'Recovery', String(r.score), '%'],
    ['workouts', 'train', 'Workouts this week', String(train.doneIdx.size), ''],
  ];
  const dayLabel = (d: string) => new Intl.DateTimeFormat('en-US', { weekday: 'narrow' }).format(new Date(`${d}T12:00:00`));
  const detail = (k: Key) => {
    if (k === 'steps') return <BarChart values={steps7} labels={week.map(dayLabel)} highlight={6} goal={8000} />;
    if (k === 'sleep') return <BarChart values={week.map((d) => sleepBy.get(d) ?? null)} labels={week.map(dayLabel)} highlight={6} max={10} goal={7.5} />;
    if (k === 'weight') {
      const ws = health.weights.slice(-14);
      return ws.length > 1 ? <LineChart values={ws.map((x) => x.value)} /> : <Text color="sec">{t('Log your weight on a few days to see a chart.')}</Text>;
    }
    if (k === 'recovery') {
      const h = health.checkins.filter((x) => x.score != null).slice(-14);
      return h.length > 1 ? <LineChart values={h.map((x) => x.score as number)} goal={60} /> : <Text color="sec">{t('Do your morning check-in to see your recovery over time.')}</Text>;
    }
    return <Text color="sec">{t('Today’s number. A watch will add more detail.')}</Text>;
  };
  const go: Partial<Record<Key, () => void>> = {
    steps: () => router.push('/cardio'),
    burned: () => router.push('/cardio'),
    weight: () => router.push({ pathname: '/progress', params: { tab: 'body' } }),
    sleep: () => router.push({ pathname: '/progress', params: { tab: 'recovery' } }),
    recovery: () => router.push('/recovery'),
    workouts: () => router.push('/train'),
  };
  const soon = (n: string) => toast(t('{n} connects in the phone app. Your steps, sleep and heart rate will then come in by themselves.', { n }), { icon: 'heart' });
  const native = Platform.OS === 'ios' ? 'Apple Health' : 'Health Connect';

  return (
    <Screen title={t('Your readings')} back>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' }}>
        {tiles.map(([k, i, n, v, u]) => (
          <Card key={k} onPress={() => setOpen(k)} style={{ width: '48.5%', marginBottom: 10 }}>
            <Icon name={i} size={20} color={c.cobalt} />
            <Text variant="small" weight={700} style={{ marginTop: 8 }} numberOfLines={2}>
              {t(n)}
            </Text>
            <Text num size={22} style={{ marginTop: 4 }}>
              {v}
              {u ? <Text num size={12} weight={500} color="sec">{` ${t(u)}`}</Text> : null}
            </Text>
          </Card>
        ))}
      </View>
      <Text variant="small" weight={700} color="sec" style={{ marginTop: 8, marginBottom: 8, marginHorizontal: 4 }}>
        {t('Connect a device')}
      </Text>
      <List>
        {([
          [Platform.OS === 'web' ? 'Apple Health' : native, 'heart', 'Steps, sleep, heart rate and workouts'],
          ...(Platform.OS === 'web' ? [['Health Connect', 'heart', 'For Android phones and watches']] : []),
          ['WHOOP', 'pulse', 'Recovery, strain and sleep'],
          ['Garmin', 'watch', 'Steps, heart rate and training'],
          ['Smart scale', 'scale', 'Weight and body fat each morning'],
        ] as [string, IconName, string][]).map(([n, i, d], idx) => (
          <ListRow key={n} first={!idx} onPress={() => soon(n)}>
            <Icon name={i} size={20} color={c.cobalt} />
            <View style={{ flex: 1 }}>
              <Text weight={700}>{n}</Text>
              <Text variant="small" color="sec">
                {t(d)}
              </Text>
            </View>
            <Text variant="xs" weight={700} color="sec">
              {t('Phone app')}
            </Text>
          </ListRow>
        ))}
      </List>
      <Text variant="xs" color="sec" style={{ marginHorizontal: 4 }}>
        {t('Until then, Gymi uses what you log: steps, weight, sleep and your check-in.')}
      </Text>
      <Sheet open={!!open} onClose={() => setOpen(null)}>
        {open ? (
          <View>
            <Text variant="h2">{t(tiles.find((x) => x[0] === open)![2])}</Text>
            <Text variant="small" color="sec" style={{ marginBottom: 12 }}>
              {t('Last 7 days')}
            </Text>
            {detail(open)}
            {go[open] ? <Button kind="glass" title={t('Open')} style={{ marginTop: 16 }} onPress={() => (setOpen(null), go[open]!())} /> : null}
          </View>
        ) : null}
      </Sheet>
    </Screen>
  );
}
