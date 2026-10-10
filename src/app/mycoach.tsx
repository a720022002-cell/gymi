import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { View } from 'react-native';

import { Thinking } from '@/components/food/Thinking';
import { Icon } from '@/components/Icon';
import { Screen } from '@/components/Screen';
import { Sheet } from '@/components/Sheet';
import { Avatar } from '@/components/social/Avatar';
import { Text } from '@/components/Text';
import { useToast } from '@/components/Toast';
import { Button, Card, Row } from '@/components/ui';
import { useT } from '@/i18n';
import { endCoaching, myCoach, type MyCoach } from '@/lib/coaching';
import { fmt } from '@/lib/nutrition';
import { useSettings } from '@/theme/settings';

/** Your coach: targets they set, messages, and ending coaching (design: mycoachpage). */
export default function MyCoachScreen() {
  const { t } = useT();
  const { colors: c } = useSettings();
  const toast = useToast();
  const [k, setK] = useState<MyCoach | null | undefined>(undefined);
  const [confirm, setConfirm] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      myCoach().then((x) => alive && setK(x));
      return () => {
        alive = false;
      };
    }, []),
  );

  if (k === undefined)
    return (
      <Screen title={t('My coach')} back>
        <Thinking message={t('Loading')} />
      </Screen>
    );
  if (!k)
    return (
      <Screen title={t('My coach')} back>
        <Card style={{ alignItems: 'center', paddingVertical: 24 }}>
          <Icon name="coach" size={34} color={c.sec} />
          <Text variant="h3" style={{ marginTop: 8 }}>
            {t('No coach yet')}
          </Text>
          <Text variant="small" color="sec" center style={{ marginTop: 4 }}>
            {t('A coach can set your calories, check your progress and message you.')}
          </Text>
          <Button small title={t('Find a coach')} style={{ marginTop: 12, alignSelf: 'center' }} onPress={() => router.replace('/findcoach')} />
        </Card>
      </Screen>
    );
  const name = k.name || k.username;
  return (
    <Screen title={t('My coach')} back>
      <View style={{ alignItems: 'center' }}>
        <Avatar id={k.coach_id} name={name} size={80} />
        <Text variant="h1" style={{ marginTop: 12 }}>
          {name}
        </Text>
        <Text weight={700} color={k.status === 'active' ? 'up' : 'sec'}>
          {t(k.status === 'active' ? 'Your coach' : 'Request sent, waiting for a reply')}
        </Text>
      </View>
      {k.status === 'active' ? (
        <>
          <Card style={{ marginTop: 16 }}>
            <Text weight={700}>{t('Your targets')}</Text>
            {k.kcal && k.protein ? (
              <Row gap={10} style={{ marginTop: 10 }}>
                {[
                  [fmt(k.kcal), t('kcal a day')],
                  [`${k.protein} ${t('g')}`, t('protein a day')],
                ].map(([a, b]) => (
                  <View key={b} style={{ flex: 1, backgroundColor: c.inset, borderRadius: 16, padding: 12 }}>
                    <Text num size={20}>
                      {a}
                    </Text>
                    <Text variant="xs" weight={700} color="sec">
                      {b}
                    </Text>
                  </View>
                ))}
              </Row>
            ) : (
              <Text variant="small" color="sec" style={{ marginTop: 4 }}>
                {t('Your coach hasn’t set targets yet. Your own plan is used until then.')}
              </Text>
            )}
          </Card>
          <Card onPress={() => router.push('/myprog')} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Icon name="train" size={20} color={c.cobalt} />
            <Text weight={700} style={{ flex: 1 }}>
              {t('My program')}
            </Text>
            <Icon name="chev" size={18} color={c.sec} />
          </Card>
          <Card onPress={() => router.push('/mymeals')} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Icon name="food" size={20} color={c.cobalt} />
            <Text weight={700} style={{ flex: 1 }}>
              {t('My meals')}
            </Text>
            <Icon name="chev" size={18} color={c.sec} />
          </Card>
          <Button icon="send" title={t('Message {n}', { n: name })} onPress={() => router.push({ pathname: '/thread', params: { link: k.id, name } })} />
          <Card style={{ marginTop: 12, flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
            <Icon name="lock" size={18} color={c.sec} />
            <Text variant="small" color="sec" style={{ flex: 1 }}>
              {t('Your coach sees your food, workouts, weight and sleep. Cycle data and health tests stay private.')}
            </Text>
          </Card>
        </>
      ) : null}
      <Button kind="ghost" title={t(k.status === 'active' ? 'End coaching' : 'Cancel request')} color={c.down} style={{ marginTop: 8 }} onPress={() => setConfirm(true)} />
      <Sheet open={confirm} onClose={() => setConfirm(false)}>
        <Text variant="h2" center>
          {t(k.status === 'active' ? 'End coaching with {n}?' : 'Cancel your request?', { n: name })}
        </Text>
        <Text color="sec" center style={{ marginTop: 4 }}>
          {t('They will stop seeing your progress. Your data stays in your account.')}
        </Text>
        <Button
          kind="danger"
          title={t(k.status === 'active' ? 'End coaching' : 'Cancel request')}
          style={{ marginTop: 16 }}
          onPress={async () => {
            await endCoaching(k.id);
            setConfirm(false);
            setK(null);
            toast(t('Done. You can find a new coach any time.'), { icon: 'check' });
          }}
        />
        <Button kind="ghost" title={t('Keep')} style={{ marginTop: 8 }} onPress={() => setConfirm(false)} />
      </Sheet>
    </Screen>
  );
}
