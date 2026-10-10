import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { View } from 'react-native';

import { hoursText } from '@/components/coach/GymHours';
import { Thinking } from '@/components/food/Thinking';
import { Icon } from '@/components/Icon';
import { Screen } from '@/components/Screen';
import { Sheet } from '@/components/Sheet';
import { Avatar } from '@/components/social/Avatar';
import { Text } from '@/components/Text';
import { useToast } from '@/components/Toast';
import { Button, Card, Chip, Label, Row } from '@/components/ui';
import { useT } from '@/i18n';
import { endCoaching, hourSlots, myCoach, type MyCoach, sendMessage } from '@/lib/coaching';
import { fmt, fmtTime } from '@/lib/nutrition';
import { DAYS } from '@/lib/training';
import { useSettings } from '@/theme/settings';

/** Your coach: targets they set, messages, and ending coaching (design: mycoachpage). */
export default function MyCoachScreen() {
  const { t, lang } = useT();
  const { colors: c } = useSettings();
  const toast = useToast();
  const [k, setK] = useState<MyCoach | null | undefined>(undefined);
  const [confirm, setConfirm] = useState(false);
  const [meet, setMeet] = useState(false);

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
          {k.coach_type !== 'Online' && k.hours?.length ? (
            <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Icon name="clock" size={18} color={c.cobalt} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text variant="small" weight={700}>
                  {k.gym ? t('At {g}', { g: k.gym }) : t('At the gym')}
                </Text>
                <Text variant="xs" color="sec">
                  {hoursText(k.hours, t, lang)}
                </Text>
              </View>
              <Button small title={t('Meet')} onPress={() => setMeet(true)} />
            </Card>
          ) : null}
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
      <Sheet open={meet} onClose={() => setMeet(false)}>
        {meet ? <MeetSheet k={k} name={name} onDone={() => setMeet(false)} /> : null}
      </Sheet>
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

/** Ask your coach to meet at the gym in one of their hours (design: book). */
function MeetSheet({ k, name, onDone }: { k: MyCoach; name: string; onDone: () => void }) {
  const { t, lang } = useT();
  const toast = useToast();
  const days = [...new Set(k.hours.flatMap((h) => h.days))].sort((a, b) => a - b);
  const [day, setDay] = useState(days[0] ?? 0);
  const [time, setTime] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const slots = hourSlots(k.hours, day);
  const send = async () => {
    if (!time) return;
    setBusy(true);
    const m = await sendMessage(k.id, t('Can we meet at the gym on {d} at {t}?', { d: t(DAYS[day]), t: fmtTime(time, lang) }));
    setBusy(false);
    if (!m) return toast(t('Couldn’t send. Please try again.'), { icon: 'warn' });
    toast(t('Request sent to your coach'), { icon: 'cal' });
    onDone();
  };
  return (
    <View>
      <Text variant="h2">{t('Meet {n}', { n: name })}</Text>
      <Text variant="small" color="sec" style={{ marginTop: 4 }}>
        {k.gym ? t('At {g}. Pick a time and your coach confirms it.', { g: k.gym }) : t('Pick a time and your coach confirms it.')}
      </Text>
      <Label>{t('Day')}</Label>
      <Row gap={8} style={{ flexWrap: 'wrap' }}>
        {days.map((d) => (
          <Chip key={d} title={t(DAYS[d])} on={day === d} onPress={() => (setDay(d), setTime(null))} />
        ))}
      </Row>
      <Label>{t('Time')}</Label>
      {slots.length ? (
        <Row gap={8} style={{ flexWrap: 'wrap' }}>
          {slots.map((x) => (
            <Chip key={x} title={fmtTime(x, lang)} on={time === x} onPress={() => setTime(x)} />
          ))}
        </Row>
      ) : (
        <Text variant="small" color="sec">
          {t('No times this day')}
        </Text>
      )}
      <Button title={t('Send request')} disabled={!time} loading={busy} style={{ marginTop: 16 }} onPress={send} />
    </View>
  );
}
