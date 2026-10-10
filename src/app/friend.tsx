import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { LineChart } from '@/components/Charts';
import { Thinking } from '@/components/food/Thinking';
import { Icon } from '@/components/Icon';
import { Screen } from '@/components/Screen';
import { Sheet } from '@/components/Sheet';
import { Avatar } from '@/components/social/Avatar';
import { List, ListRow } from '@/components/social/List';
import { Text } from '@/components/Text';
import { useToast } from '@/components/Toast';
import { Button, Card, Row } from '@/components/ui';
import { useT } from '@/i18n';
import { MEAS_INFO } from '@/lib/health';
import { fmt } from '@/lib/nutrition';
import { fx, shortDate } from '@/lib/progress';
import { displayName, type FriendProfile, friendProfile, myFriends, removeFriendship } from '@/lib/social';
import { useSettings } from '@/theme/settings';

/** A friend's profile: only what they chose to share (design: friend). */
export default function FriendScreen() {
  const { t, lang } = useT();
  const { colors: c } = useSettings();
  const toast = useToast();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [p, setP] = useState<{ id: string; v: FriendProfile | null } | null>(null);
  const [confirm, setConfirm] = useState(false);

  useEffect(() => {
    let alive = true;
    friendProfile(id).then((v) => alive && setP({ id, v }));
    return () => {
      alive = false;
    };
  }, [id]);

  const f = p?.id === id ? p.v : undefined;
  if (f === undefined)
    return (
      <Screen title="" back>
        <Thinking message={t('Loading')} />
      </Screen>
    );
  if (!f)
    return (
      <Screen title={t('Gym Bros')} back>
        <Card style={{ alignItems: 'center' }}>
          <Text color="sec">{t('You’re not friends with this person.')}</Text>
        </Card>
      </Screen>
    );
  const name = displayName(f);
  const s = f.share;
  const w = f.weights ?? [];
  return (
    <Screen title={name} back>
      <View style={{ alignItems: 'center' }}>
        <Avatar id={f.id} name={name} size={80} />
        <Text variant="h1" style={{ marginTop: 12 }}>
          {name}
        </Text>
        <Text weight={700} color="sec">{`@${f.username}`}</Text>
        {f.streak ? (
          <Row gap={4} style={{ marginTop: 4 }}>
            <Icon name="flame" size={16} color={c.cobalt} />
            <Text variant="small" color="sec">
              {t('{n}-day streak', { n: f.streak })}
            </Text>
          </Row>
        ) : null}
      </View>
      <Row gap={6} style={{ justifyContent: 'center', marginTop: 16, marginBottom: 8 }}>
        <Icon name="lock" size={14} color={c.sec} />
        <Text variant="small" color="sec">
          {t('Only showing what {n} chose to share', { n: name })}
        </Text>
      </Row>
      {s.workouts ? (
        <>
          <Text variant="small" weight={700} color="sec" style={{ marginTop: 12, marginBottom: 8, marginHorizontal: 4 }}>
            {t('Workouts')}
          </Text>
          <Card>
            <Text weight={700}>{t('{n} workouts in the last 7 days', { n: f.week ?? 0 })}</Text>
            {(f.workouts ?? []).map((x) => (
              <Row key={`${x.day}${x.name}`} style={{ marginTop: 10 }}>
                <Icon name="train" size={18} color={c.cobalt} />
                <Text variant="small" weight={700} style={{ flex: 1 }}>
                  {t(x.name)}
                </Text>
                <Text variant="small" color="sec">{`${shortDate(x.day, lang)} · ${x.minutes} ${t('min')}`}</Text>
              </Row>
            ))}
          </Card>
        </>
      ) : null}
      {s.prs && f.prs?.length ? (
        <>
          <Text variant="small" weight={700} color="sec" style={{ marginTop: 12, marginBottom: 8, marginHorizontal: 4 }}>
            {t('Personal records')}
          </Text>
          <List>
            {f.prs.map((r, i) => (
              <ListRow key={r.n} first={!i}>
                <Icon name="trophy" size={18} color={c.cobalt} />
                <Text weight={700} style={{ flex: 1 }}>
                  {r.n}
                </Text>
                <Text num weight={700}>{`${fx(Number(r.w))} ${t('kg')}`}</Text>
              </ListRow>
            ))}
          </List>
        </>
      ) : null}
      {s.weight && w.length > 1 ? (
        <Card>
          <Row style={{ justifyContent: 'space-between' }}>
            <Text weight={700}>{t('Weight')}</Text>
            <Text variant="small" weight={700} color="sec">{`${fx(Number(w.at(-1)!.value))} ${t('kg')}`}</Text>
          </Row>
          <View style={{ marginTop: 8 }}>
            <LineChart values={w.map((x) => Number(x.value))} height={110} />
          </View>
        </Card>
      ) : null}
      {s.body && f.body && Object.keys(f.body).length ? (
        <Card>
          <Text weight={700}>{t('Measurements')}</Text>
          {Object.entries(f.body).map(([k, v]) => (
            <Row key={k} style={{ justifyContent: 'space-between', marginTop: 8 }}>
              <Text variant="small" color="sec">
                {t(MEAS_INFO[k as keyof typeof MEAS_INFO]?.[0] ?? k)}
              </Text>
              <Text variant="small" weight={700}>{`${fmt(Number(v))} ${MEAS_INFO[k as keyof typeof MEAS_INFO]?.[1] ?? ''}`}</Text>
            </Row>
          ))}
        </Card>
      ) : null}
      {!s.workouts && !s.prs && !s.weight && !s.body ? (
        <Card style={{ alignItems: 'center', paddingVertical: 24 }}>
          <Icon name="lock" size={30} color={c.sec} />
          <Text variant="h3" style={{ marginTop: 8 }}>
            {t('{n} keeps progress private', { n: name })}
          </Text>
          <Text variant="small" color="sec" center style={{ marginTop: 4 }}>
            {t('You can still challenge each other or train together.')}
          </Text>
        </Card>
      ) : null}
      <Row gap={10} style={{ marginTop: 8 }}>
        <Button icon="trophy" title={t('Challenge')} style={{ flex: 1 }} onPress={() => router.push({ pathname: '/newchallenge', params: { f: f.id } })} />
        <Button kind="glass" icon="users" title={t('Train together')} style={{ flex: 1 }} onPress={() => router.push('/together')} />
      </Row>
      <Button kind="ghost" title={t('Remove friend')} color={c.down} style={{ marginTop: 8 }} onPress={() => setConfirm(true)} />
      <Sheet open={confirm} onClose={() => setConfirm(false)}>
        <Text variant="h2" center>
          {t('Remove {n}?', { n: name })}
        </Text>
        <Text color="sec" center style={{ marginTop: 4 }}>
          {t('You’ll stop seeing each other’s activity. You can add them again later.')}
        </Text>
        <Button
          kind="danger"
          title={t('Remove friend')}
          style={{ marginTop: 16 }}
          onPress={async () => {
            const row = (await myFriends()).find((x) => x.id === f.id);
            if (row) await removeFriendship(row.friendship_id);
            setConfirm(false);
            toast(t('{n} removed', { n: name }), { icon: 'users' });
            router.back();
          }}
        />
        <Button kind="ghost" title={t('Cancel')} style={{ marginTop: 8 }} onPress={() => setConfirm(false)} />
      </Sheet>
    </Screen>
  );
}
