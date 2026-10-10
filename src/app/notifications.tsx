import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { TimeField } from '@/components/food/TimeField';
import { Icon } from '@/components/Icon';
import { Screen } from '@/components/Screen';
import { List, ListRow } from '@/components/social/List';
import { Text } from '@/components/Text';
import { useToast } from '@/components/Toast';
import { Button, Card, Chip, Row, Toggle } from '@/components/ui';
import { useT } from '@/i18n';
import { useAuth } from '@/lib/auth';
import { useFood } from '@/lib/food';
import { useHealth } from '@/lib/health';
import { buildReminders, DEFAULT_PREFS, loadPrefs, type Prefs, remindersSupported, savePrefs, scheduleReminders } from '@/lib/reminders';
import { useSettings } from '@/theme/settings';

/** Reminders: check-in, water, meals, training and vitamins (design: notifications). */
export default function NotificationsScreen() {
  const { t } = useT();
  const { colors: c } = useSettings();
  const toast = useToast();
  const { session } = useAuth();
  const uid = session?.user.id;
  const food = useFood();
  const health = useHealth();
  const [p, setP] = useState<Prefs | null>(null);

  useEffect(() => {
    if (!uid) return;
    let alive = true;
    loadPrefs(uid).then((v) => alive && setP(v));
    return () => {
      alive = false;
    };
  }, [uid]);

  const v = p ?? DEFAULT_PREFS;
  const save = async (next: Prefs, ask = false) => {
    setP(next);
    if (!uid) return;
    await savePrefs(uid, next);
    if (!remindersSupported) return;
    const r = await scheduleReminders(
      buildReminders(next, { meals: food.setupDone ? food.plan.meals : [], vitamins: health.supplements.filter((x) => x.active && x.remind), workoutToday: null }, t),
      ask,
    );
    if (r === 'denied') toast(t('Turn on notifications for Gymi in your phone settings.'), { icon: 'bell' });
  };

  const row = (title: string, sub: string, on: boolean, flip: (x: boolean) => void, extra?: React.ReactNode, first?: boolean) => (
    <ListRow first={first}>
      <View style={{ flex: 1 }}>
        <Text weight={700}>{title}</Text>
        <Text variant="small" color="sec">
          {sub}
        </Text>
        {on && extra ? <View style={{ marginTop: 8 }}>{extra}</View> : null}
      </View>
      <Toggle value={on} onChange={flip} label={title} />
    </ListRow>
  );

  return (
    <Screen title={t('Notifications')} back>
      {!remindersSupported ? (
        <Card style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
          <Icon name="bell" size={20} color={c.cobalt} />
          <Text variant="small" style={{ flex: 1 }}>
            {t('Reminders arrive on the phone app. Your choices are saved now and start working when you install it.')}
          </Text>
        </Card>
      ) : null}
      <List>
        {row(t('Morning check-in'), t('Every morning'), v.checkin.on, (x) => save({ ...v, checkin: { ...v.checkin, on: x } }, x), <TimeField value={v.checkin.time} onChange={(x) => save({ ...v, checkin: { ...v.checkin, time: x } })} label={t('Time')} />, true)}
        {row(
          t('Water'),
          t('Every {n} hours, {a} to {b}', { n: v.water.every, a: v.water.from, b: v.water.to }),
          v.water.on,
          (x) => save({ ...v, water: { ...v.water, on: x } }, x),
          <View>
            <Row gap={8}>
              <TimeField value={v.water.from} onChange={(x) => save({ ...v, water: { ...v.water, from: x } })} label={t('From')} />
              <TimeField value={v.water.to} onChange={(x) => save({ ...v, water: { ...v.water, to: x } })} label={t('To')} />
            </Row>
            <Row gap={8} style={{ marginTop: 8 }}>
              {[1, 2, 3].map((n) => (
                <Chip key={n} title={t('Every {n} h', { n })} on={v.water.every === n} onPress={() => save({ ...v, water: { ...v.water, every: n } })} />
              ))}
            </Row>
          </View>,
        )}
        {row(t('Meals'), food.setupDone ? t('At your meal times') : t('Set up food first'), v.meals.on, (x) => save({ ...v, meals: { on: x } }, x))}
        {row(t('Training'), t('On your workout days'), v.workout.on, (x) => save({ ...v, workout: { ...v.workout, on: x } }, x), <TimeField value={v.workout.time} onChange={(x) => save({ ...v, workout: { ...v.workout, time: x } })} label={t('Time')} />)}
        {row(t('Vitamins'), t('At the times you set in Vitamins'), v.vitamins.on, (x) => save({ ...v, vitamins: { on: x } }, x))}
      </List>
      {remindersSupported ? <Button kind="glass" icon="bell" title={t('Turn on notifications')} onPress={() => save(v, true)} /> : null}
    </Screen>
  );
}
