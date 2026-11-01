import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { View } from 'react-native';

import { useT } from '@/i18n';
import { myGroupSessions } from '@/lib/social';
import { useTrain } from '@/lib/train';
import { useSettings } from '@/theme/settings';

import { Icon } from '../Icon';
import { Text } from '../Text';
import { Card, Springy } from '../ui';

type Live = Awaited<ReturnType<typeof myGroupSessions>>[number];

/**
 * A group workout you joined that's still going (you left it halfway): one tap takes you back to it. Shown on Home,
 * Train and Gym Bros; gone once it's over or you saved your part.
 */
export function GroupResumeCard() {
  const { t } = useT();
  const { colors: c } = useSettings();
  const train = useTrain();
  const [list, setList] = useState<Live[]>([]);
  useFocusEffect(
    useCallback(() => {
      let alive = true;
      myGroupSessions()
        .then((xs) => alive && setList(xs.filter((x) => x.status === 'live' && x.joined)))
        .catch(() => {});
      return () => {
        alive = false;
      };
    }, []),
  );
  // Already saved your part of it: nothing to go back to.
  const saved = new Set(train.logs.map((l) => (l as { group_session?: string | null }).group_session).filter(Boolean));
  const open = list.filter((x) => !saved.has(x.id));
  if (!open.length) return null;
  return (
    <View>
      {open.map((x) => (
        <Card key={x.id} onPress={() => router.push({ pathname: '/groupactive', params: { id: x.id } })} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: c.gAi }}>
          <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: c.cobalt, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="users" size={20} color="#FFFFFF" />
          </View>
          <View style={{ flex: 1 }}>
            <Text weight={700}>{t('Group workout in progress')}</Text>
            <Text variant="small" color="sec">
              {t('{n} people. Go back and finish it.', { n: x.members })}
            </Text>
          </View>
          <Springy onPress={() => router.push({ pathname: '/groupactive', params: { id: x.id } })} style={{ height: 36, paddingHorizontal: 14, borderRadius: 18, backgroundColor: c.text, alignItems: 'center', justifyContent: 'center' }}>
            <Text variant="small" weight={700} color={c.bg}>
              {t('Continue')}
            </Text>
          </Springy>
        </Card>
      ))}
    </View>
  );
}
