import { router } from 'expo-router';
import { useState } from 'react';
import { Platform, View } from 'react-native';

import { DEVICE_FIELD, DEVICE_ONLY, INFO, orderedKeys, type ReadingKey } from '@/components/health/readings';
import { Icon, type IconName } from '@/components/Icon';
import { Screen } from '@/components/Screen';
import { List, ListRow } from '@/components/social/List';
import { Text } from '@/components/Text';
import { useToast } from '@/components/Toast';
import { useRecovery } from '@/components/train/RecoveryCard';
import { Button, Card, NavButton, Row, Springy } from '@/components/ui';
import { useT } from '@/i18n';
import { useAuth } from '@/lib/auth';
import { connectDevice, disconnectDevice, phoneSource, saveCardOrder, sourceName, syncDevice, useDevices } from '@/lib/devices';
import { useFood } from '@/lib/food';
import { useHealth } from '@/lib/health';
import { fmt } from '@/lib/nutrition';
import { fx } from '@/lib/progress';
import { useTrain } from '@/lib/train';
import { useSettings } from '@/theme/settings';

/** Your readings: what Gymi knows today, in your own order, and devices to connect (design: devices). */
export default function Devices() {
  const { t } = useT();
  const { colors: c } = useSettings();
  const toast = useToast();
  const { session } = useAuth();
  const food = useFood();
  const train = useTrain();
  const health = useHealth();
  const { r } = useRecovery();
  const dev = useDevices(session?.user.id);
  const [editing, setEditing] = useState<ReadingKey[] | null>(null);
  const [busy, setBusy] = useState(false);

  // Newest value a device sent for a field (within the last week).
  const devLast = (k: keyof (typeof dev.days)[number]) => [...dev.days].reverse().find((d) => d[k] != null && (!Array.isArray(d[k]) || (d[k] as unknown[]).length))?.[k] as number | undefined;
  const w = health.weights.at(-1);
  const lastSleep = [...health.checkins].reverse().find((x) => x.sleep_h != null);
  const workoutKcal = train.logs.filter((l) => l.day === food.today).reduce((a, l) => a + l.kcal, 0);
  const devToday = dev.days.find((d) => d.day === food.today);
  const steps = Math.max(food.steps, devToday?.steps ?? 0);
  const value = (k: ReadingKey): [string, string] => {
    const info = INFO[k];
    const show = (v: number | undefined | null) => (v == null ? '–' : info.dec ? fx(v) : fmt(v));
    if (k === 'steps') return [fmt(steps), ''];
    if (k === 'burned') return [fmt(food.burned + workoutKcal), 'kcal'];
    if (k === 'weight') return w ? [fx(w.value), 'kg'] : ['–', ''];
    if (k === 'sleep') {
      const v = lastSleep?.sleep_h ?? devLast('sleep_h');
      return v != null ? [fx(v), 'h'] : ['–', ''];
    }
    if (k === 'recovery') return [String(r.score), '%'];
    if (k === 'workouts') return [String(train.doneIdx.size), ''];
    const v = devLast(DEVICE_FIELD[k] as keyof (typeof dev.days)[number]);
    return [show(v), v == null ? '' : info.unit];
  };
  // Watch-only cards show up once a device has sent them.
  const visible = (k: ReadingKey) => !DEVICE_ONLY.includes(k) || devLast(DEVICE_FIELD[k] as keyof (typeof dev.days)[number]) != null;
  const keys = (editing ?? orderedKeys(dev.prefs.card_order)).filter(visible);
  const label = (k: ReadingKey) => (k === 'workouts' ? 'Workouts this week' : INFO[k].name);

  const move = (k: ReadingKey, d: -1 | 1) => {
    if (!editing) return;
    const all = [...editing];
    const shown = all.filter(visible);
    const j = shown.indexOf(k) + d;
    if (j < 0 || j >= shown.length) return;
    const a = all.indexOf(k);
    const b = all.indexOf(shown[j]);
    [all[a], all[b]] = [all[b], all[a]];
    setEditing(all);
  };

  const connect = async () => {
    if (!phoneSource) return toast(t('{n} connects in the phone app. Your steps, sleep and heart rate will then come in by themselves.', { n: 'Apple Health' }), { icon: 'heart' });
    setBusy(true);
    const res = await connectDevice().catch(() => 'unavailable' as const);
    setBusy(false);
    if (res === 'ok') toast(t('{n} connected', { n: sourceName(phoneSource) }), { icon: 'check' });
    else if (res === 'denied') toast(t('Gymi wasn’t allowed to read {n}. You can allow it in Settings.', { n: sourceName(phoneSource) }), { icon: 'warn' });
    else toast(phoneSource === 'health_connect' ? t('Install or update Health Connect from Google Play, then try again.') : t('Apple Health isn’t available on this phone.'), { icon: 'info' });
  };

  const linked = dev.connected && dev.prefs.source === phoneSource;
  const native = phoneSource ? sourceName(phoneSource) : null;
  const soon = (n: string) => toast(t('{n} is coming soon. Until then, connect it to Apple Health or Health Connect and Gymi reads it from there.', { n }), { icon: 'watch' });

  return (
    <Screen
      title={t('Your readings')}
      back
      right={
        editing ? (
          <Springy
            onPress={() => {
              saveCardOrder(editing);
              setEditing(null);
              toast(t('Order saved'), { icon: 'check' });
            }}
            style={{ height: 44, paddingHorizontal: 16, borderRadius: 22, backgroundColor: c.card, alignItems: 'center', justifyContent: 'center' }}>
            <Text weight={700}>{t('Save')}</Text>
          </Springy>
        ) : (
          <NavButton icon="grip" label={t('Edit')} onPress={() => setEditing(orderedKeys(dev.prefs.card_order))} />
        )
      }>
      {dev.connected ? (
        <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Icon name="check" size={20} color={c.up} strokeWidth={2.6} />
          <Text variant="small" style={{ flex: 1 }}>
            <Text variant="small" weight={700}>
              {t('{n} connected.', { n: sourceName(dev.prefs.source) })}
            </Text>{' '}
            {t('Low recovery makes your workout lighter automatically.')}
          </Text>
        </Card>
      ) : (
        <Card>
          <Text weight={700}>{t('Connect a device to see your readings')}</Text>
          <Text variant="small" color="sec" style={{ marginTop: 4, marginBottom: 12 }}>
            {t('Steps, heart rate, sleep and recovery come in automatically, and your coach uses them.')}
          </Text>
          <Button title={native ? t('Connect {n}', { n: native }) : t('Connect Apple Health or WHOOP')} loading={busy} onPress={connect} />
        </Card>
      )}
      {editing ? (
        <Text variant="small" color="sec" style={{ marginBottom: 8, marginHorizontal: 4 }}>
          {t('Move cards into any order, then tap Save.')}
        </Text>
      ) : null}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' }}>
        {keys.map((k, i) => {
          const [v, u] = value(k);
          const info = INFO[k];
          return (
            <Card key={k} onPress={editing ? undefined : () => router.push({ pathname: '/reading', params: { k } })} style={{ width: '48.5%', marginBottom: 10 }}>
              <Row style={{ justifyContent: 'space-between' }}>
                <Icon name={info.icon} size={20} color={c.cobalt} />
                {editing ? (
                  <Row gap={4}>
                    <Springy onPress={() => move(k, -1)} disabled={i === 0} accessibilityLabel={t('Move up')} style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: c.inset, alignItems: 'center', justifyContent: 'center', opacity: i === 0 ? 0.35 : 1 }}>
                      <Icon name="back" size={15} />
                    </Springy>
                    <Springy onPress={() => move(k, 1)} disabled={i === keys.length - 1} accessibilityLabel={t('Move down')} style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: c.inset, alignItems: 'center', justifyContent: 'center', opacity: i === keys.length - 1 ? 0.35 : 1 }}>
                      <Icon name="chev" size={15} />
                    </Springy>
                  </Row>
                ) : (
                  <Icon name="chev" size={16} color={c.sec} />
                )}
              </Row>
              <Text variant="small" weight={700} style={{ marginTop: 8 }} numberOfLines={2}>
                {t(label(k))}
              </Text>
              <Text num size={22} style={{ marginTop: 4 }}>
                {v}
                {u ? <Text num size={12} weight={500} color="sec">{` ${t(u)}`}</Text> : null}
              </Text>
            </Card>
          );
        })}
      </View>
      <Text variant="small" weight={700} color="sec" style={{ marginTop: 8, marginBottom: 8, marginHorizontal: 4 }}>
        {t('Connect a device')}
      </Text>
      <List>
        {(
          [
            ...(native ? [[native, 'heart', 'Steps, sleep, heart rate and workouts', 'phone']] : [
              ['Apple Health', 'heart', 'Steps, sleep, heart rate and workouts', 'web'],
              ['Health Connect', 'heart', 'For Android phones and watches', 'web'],
            ]),
            ['WHOOP', 'pulse', 'Recovery, strain and sleep', 'soon'],
            ['Garmin', 'watch', 'Steps, heart rate and training', 'soon'],
            ['Smart scale', 'scale', 'Weight and body fat each morning', 'soon'],
          ] as [string, IconName, string, 'phone' | 'web' | 'soon'][]
        ).map(([n, i, d, kind], idx) => (
          <ListRow
            key={n}
            first={!idx}
            onPress={() =>
              kind === 'soon'
                ? soon(n)
                : kind === 'web'
                  ? toast(t('{n} connects in the phone app. Your steps, sleep and heart rate will then come in by themselves.', { n }), { icon: 'heart' })
                  : linked
                    ? syncDevice(7).then((x) => toast(t('Synced {n} days from {s}', { n: x, s: n }), { icon: 'check' }))
                    : connect()
            }>
            <Icon name={i} size={20} color={c.cobalt} />
            <View style={{ flex: 1 }}>
              <Text weight={700}>{t(n)}</Text>
              <Text variant="small" color="sec">
                {kind === 'phone' && linked && dev.prefs.last_sync ? t('Connected. Tap to sync now.') : t(d)}
              </Text>
            </View>
            <Text variant="xs" weight={700} color={kind === 'phone' && linked ? 'up' : 'sec'}>
              {kind === 'soon' ? t('Coming soon') : kind === 'web' ? t('Phone app') : linked ? t(dev.syncing ? 'Syncing…' : 'Connected') : t('Connect')}
            </Text>
          </ListRow>
        ))}
      </List>
      {linked ? (
        <Button
          small
          kind="ghost"
          title={t('Disconnect {n}', { n: native ?? '' })}
          style={{ alignSelf: 'center' }}
          onPress={async () => {
            await disconnectDevice();
            toast(Platform.OS === 'ios' ? t('Disconnected. You can also turn off access in the Health app.') : t('Disconnected. You can also turn off access in Health Connect.'), { icon: 'info' });
          }}
        />
      ) : null}
      <Text variant="xs" color="sec" style={{ marginHorizontal: 4 }}>
        {dev.connected ? t('Your past readings stay saved, so you can see them on the web too.') : t('Until then, Gymi uses what you log: steps, weight, sleep and your check-in.')}
      </Text>
    </Screen>
  );
}
