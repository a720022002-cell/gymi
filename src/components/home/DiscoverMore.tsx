import { router } from 'expo-router';
import { View } from 'react-native';

import { useT } from '@/i18n';
import { useSettings } from '@/theme/settings';

import { Icon, type IconName } from '../Icon';
import { Text } from '../Text';
import { Card, Row } from '../ui';

type Item = { icon: IconName; color: string; title: string; body: string; link: string; go: () => void };

/** "Discover more" at the bottom of Home: parts of Adro people may not have found yet (design: discover cards). */
export function DiscoverMore() {
  const { t } = useT();
  const { colors: c } = useSettings();
  const items: Item[] = [
    { icon: 'drop', color: '#EF4444', title: 'Your blood tests', body: 'Upload a lab report and see what it means for your food and training.', link: 'Add a blood test', go: () => router.push('/blood') },
    { icon: 'watch', color: c.cobalt, title: 'Connect your watch', body: 'Apple Health, WHOOP, Oura, Polar or a heart-rate sensor. Your sleep, steps and heart rate come in by themselves.', link: 'Connect a device', go: () => router.push('/connections') },
    { icon: 'users', color: '#22C55E', title: 'Bring a friend', body: 'Invite friends with your code, then follow each other’s workouts and streaks in Gym Bros.', link: 'Invite a friend', go: () => router.push('/invite') },
    { icon: 'coach', color: '#F59E0B', title: 'Get a coach', body: 'A real coach who plans your training and food and chats with you.', link: 'Find a coach', go: () => router.push('/findcoach') },
  ];
  return (
    <View style={{ marginTop: 16 }}>
      <Text variant="h2" style={{ marginBottom: 10, marginHorizontal: 4 }}>
        {t('Discover more')}
      </Text>
      {items.map((x) => (
        <Card key={x.title} onPress={x.go} style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          {/* A soft tile in the feature's colour, its icon big in the middle. */}
          <View style={{ width: 76, height: 76, borderRadius: 20, backgroundColor: `${x.color}22`, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
            <View style={{ position: 'absolute', width: 60, height: 60, borderRadius: 30, backgroundColor: `${x.color}26`, top: -14, end: -14 }} />
            <View style={{ position: 'absolute', width: 40, height: 40, borderRadius: 20, backgroundColor: `${x.color}1F`, bottom: -10, start: -8 }} />
            <Icon name={x.icon} size={32} color={x.color} strokeWidth={2} />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text weight={700}>{t(x.title)}</Text>
            <Text variant="small" color="sec" style={{ marginTop: 2 }}>
              {t(x.body)}
            </Text>
            <Row gap={6} style={{ marginTop: 8 }}>
              <Text variant="small" weight={800} color="link">
                {t(x.link)}
              </Text>
              <Icon name="chev" size={14} color={c.link} strokeWidth={2.4} />
            </Row>
          </View>
        </Card>
      ))}
    </View>
  );
}
