import { router } from 'expo-router';
import { Platform, View } from 'react-native';

import { Icon, type IconName } from '@/components/Icon';
import { Screen } from '@/components/Screen';
import { List, ListRow } from '@/components/social/List';
import { Text } from '@/components/Text';
import { useToast } from '@/components/Toast';
import { useRecovery } from '@/components/train/RecoveryCard';
import { Card } from '@/components/ui';
import { useT } from '@/i18n';
import { useFood } from '@/lib/food';
import { useHealth } from '@/lib/health';
import { fmt } from '@/lib/nutrition';
import { fx } from '@/lib/progress';
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


  const w = health.weights.at(-1);
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
  const soon = (n: string) => toast(t('{n} connects in the phone app. Your steps, sleep and heart rate will then come in by themselves.', { n }), { icon: 'heart' });
  const native = Platform.OS === 'ios' ? 'Apple Health' : 'Health Connect';

  return (
    <Screen title={t('Your readings')} back>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' }}>
        {tiles.map(([k, i, n, v, u]) => (
          <Card key={k} onPress={() => router.push({ pathname: '/reading', params: { k } })} style={{ width: '48.5%', marginBottom: 10 }}>
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
    </Screen>
  );
}
