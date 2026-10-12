import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { View } from 'react-native';

import { useT } from '@/i18n';
import { useAuth } from '@/lib/auth';
import { groupSessionInfo, groupSessions, type GroupSessionRow, joinGroupWorkout, leaveGroupWorkout, whenLabel } from '@/lib/groupWorkout';
import { applyTogether, noteText, type TogetherAction } from '@/lib/together';
import { useTrain } from '@/lib/train';
import { useSettings } from '@/theme/settings';

import { Icon } from '../Icon';
import { Avatar } from '../social/Avatar';
import { Text } from '../Text';
import { useToast } from '../Toast';
import { Button, Card, Row, Springy } from '../ui';

/**
 * Planned group workouts (design: groupCard): who's coming, day and time, Start and cancel.
 * Shows nothing when there are none (or the empty text, when given). Used on Train, Gym Bros and a group's page
 * (there only workouts with someone from the group).
 */
export function GroupWorkoutsCard({ title = true, members, empty }: { title?: boolean; members?: string[]; empty?: string }) {
  const { t, lang } = useT();
  const { colors: c } = useSettings();
  const toast = useToast();
  const { session } = useAuth();
  const me = session?.user.id ?? '';
  const train = useTrain();
  const [list, setList] = useState<GroupSessionRow[]>([]);
  const [info, setInfo] = useState<Awaited<ReturnType<typeof groupSessionInfo>>>({});

  const load = useCallback(async () => {
    const all = await groupSessions();
    const shown = all.filter((g) => g.scheduled_at && g.status === 'open' && (!members || g.people.some((p) => p.id !== me && members.includes(p.id))));
    setList(shown);
    setInfo(await groupSessionInfo(shown.map((g) => g.id)));
  }, [members, me]);

  /** Accepting applies your part to your plan (for example your Pull day moves to your next rest day). */
  const accept = (id: string) => {
    const n = info[id]?.notes?.[me];
    if (!train.plan || !n) return;
    train.updatePlan(applyTogether(train.plan, id, n.action as TogetherAction, n.day));
  };
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  if (!list.length && !empty) return null;
  return (
    <View>
      {!list.length && empty ? (
        <Card style={{ alignItems: 'center' }}>
          <Text variant="small" color="sec" center>
            {empty}
          </Text>
        </Card>
      ) : null}
      {title && list.length ? (
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
              <Text weight={700}>{t('{w} with {names}', { w: t(info[g.id]?.title || 'Full body'), names: joined || t('friends') })}</Text>
              <Text variant="small" color="sec">
                {`${w.day}, ${w.time}. ${g.host === me ? t('Waiting for replies.') : t('{n} invited you.', { n: g.host_name ?? '' })}`}
              </Text>
              {noteText(info[g.id]?.notes?.[me], lang) ? (
                <View style={{ marginTop: 8, backgroundColor: c.inset, borderRadius: 12, paddingVertical: 8, paddingHorizontal: 10 }}>
                  <Text variant="xs" weight={700} color="sec">
                    {t(train.plan?.togetherDone?.[g.id] ? 'For you' : 'If you join')}
                  </Text>
                  <Text variant="small">{noteText(info[g.id].notes[me], lang)}</Text>
                </View>
              ) : null}
              <Row gap={8} style={{ marginTop: 8 }}>
                {g.host !== me && info[g.id]?.notes?.[me] && !train.plan?.togetherDone?.[g.id] ? (
                  <Button
                    small
                    icon="check"
                    title={t('Accept')}
                    onPress={() => {
                      accept(g.id);
                      toast(t('You’re in. Your plan is updated.'), { icon: 'check' });
                    }}
                  />
                ) : null}
                <Button
                  small
                  kind={g.host !== me && !train.plan?.togetherDone?.[g.id] ? 'glass' : 'primary'}
                  icon="play"
                  title={t('Start')}
                  onPress={async () => {
                    accept(g.id);
                    await joinGroupWorkout(g.id);
                    router.push({ pathname: '/groupactive', params: { id: g.id } });
                  }}
                />
              </Row>
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
