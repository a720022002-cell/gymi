import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { View } from 'react-native';

import { useT } from '@/i18n';
import { useAuth } from '@/lib/auth';
import { groupSessions, type GroupSessionRow, joinGroupWorkout, leaveGroupWorkout, whenLabel } from '@/lib/groupWorkout';
import { useSettings } from '@/theme/settings';

import { Icon } from '../Icon';
import { Avatar } from '../social/Avatar';
import { Text } from '../Text';
import { useToast } from '../Toast';
import { Button, Card, Row, Springy } from '../ui';

/**
 * Planned group workouts (design: groupCard): who's coming, day and time, Start and cancel.
 * Shows nothing when there are none. Used on Train and on Gym Bros.
 */
export function GroupWorkoutsCard({ title = true }: { title?: boolean }) {
  const { t, lang } = useT();
  const { colors: c } = useSettings();
  const toast = useToast();
  const { session } = useAuth();
  const me = session?.user.id ?? '';
  const [list, setList] = useState<GroupSessionRow[]>([]);

  const load = useCallback(async () => {
    const all = await groupSessions();
    setList(all.filter((g) => g.scheduled_at && g.status === 'open'));
  }, []);
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  if (!list.length) return null;
  return (
    <View>
      {title ? (
        <Text variant="small" weight={700} color="sec" style={{ marginTop: 18, marginBottom: 8, marginHorizontal: 4 }}>
          {t('Group workouts')}
        </Text>
      ) : null}
      {list.map((g) => {
        const others = g.people.filter((p) => p.id !== me);
        const names = others.map((p) => p.name || p.username);
        const joined = names.length === 1 ? names[0] : `${names.slice(0, -1).join(t(', '))} ${t('and')} ${names[names.length - 1]}`;
        const w = whenLabel(g.scheduled_at as string, t, lang);
        return (
          <Card key={g.id} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
            <Row gap={0}>
              {g.people.slice(0, 4).map((p, i) => (
                <View key={p.id} style={{ marginStart: i ? -10 : 0, borderWidth: 2, borderColor: c.card, borderRadius: 17 }}>
                  <Avatar id={p.id} name={p.name || p.username} size={30} />
                </View>
              ))}
            </Row>
            <View style={{ flex: 1 }}>
              <Text weight={700}>{t('Full body with {names}', { names: joined || t('friends') })}</Text>
              <Text variant="small" color="sec">
                {`${w.day}, ${w.time}. ${g.host === me ? t('Waiting for replies.') : t('{n} invited you.', { n: g.host_name ?? '' })}`}
              </Text>
              <Button
                small
                icon="play"
                title={t('Start')}
                style={{ marginTop: 8, alignSelf: 'flex-start' }}
                onPress={async () => {
                  await joinGroupWorkout(g.id);
                  router.push({ pathname: '/groupactive', params: { id: g.id } });
                }}
              />
            </View>
            <Springy
              accessibilityLabel={t('Cancel group workout')}
              onPress={async () => {
                const ok = await leaveGroupWorkout(g.id);
                if (!ok) return toast(t('Couldn’t save. Please try again.'), { icon: 'warn' });
                setList((xs) => xs.filter((x) => x.id !== g.id));
                toast(t('Group workout cancelled'), { icon: 'trash' });
              }}
              style={{ width: 36, height: 36, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="close" size={16} color={c.sec} strokeWidth={2.2} />
            </Springy>
          </Card>
        );
      })}
    </View>
  );
}
