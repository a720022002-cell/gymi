import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
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
import { connectDevice, disconnectDevice, phoneSource, reloadDeviceDays, saveCardOrder, sourceName, syncDevice, useDevices } from '@/lib/devices';
import { linkWearable, syncWearables, unlinkWearable, wearableName, WEARABLES, type WearableProvider, wearableStatus, type WearableStatus } from '@/lib/wearables';
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
  // Wearables linked directly (WHOOP, Oura): what the server has, and which one is busy.
  const [ws, setWs] = useState<WearableStatus | null>(null);
  const [wBusy, setWBusy] = useState<WearableProvider | null>(null);
  const loadWs = useCallback(() => {
    wearableStatus().then(setWs);
  }, []);
  useEffect(() => {
    loadWs();
  }, [loadWs]);
  // Back from a wearable's sign-in: say how it went once, then clear the link.
  const back = useLocalSearchParams<{ wearable?: string; status?: string }>();
  useEffect(() => {
    if (!back.wearable || !back.status) return;
    const n = wearableName(back.wearable);
    const msg: Record<string, string> = { linked: '{n} connected. Your last month is in.', denied: '{n} wasn’t connected: access was not allowed.', expired: 'That took too long. Tap {n} to try again.', error: 'Couldn’t connect {n}. Please try again.' };
    toast(t(msg[back.status] ?? msg.error, { n }), { icon: back.status === 'linked' ? 'check' : 'warn' });
    if (back.status === 'linked') reloadDeviceDays();
    router.replace('/devices');
  }, [back.wearable, back.status, t, toast]);
  const linkOf = (p: WearableProvider) => ws?.links.find((l) => l.provider === p);
  const tapWearable = async (p: WearableProvider) => {
    const l = linkOf(p);
    setWBusy(p);
    if (l && l.status === 'ok') {
      const r = await syncWearables(p);
      setWBusy(null);
      loadWs();
      await reloadDeviceDays();
      const v = r?.[p];
      return toast(typeof v === 'number' ? t('Synced {n} days from {s}', { n: v, s: wearableName(p) }) : t(v === 'expired' ? 'Sign in to {n} again to keep syncing.' : 'Couldn’t sync {n}. Please try again.', { n: wearableName(p) }), { icon: typeof v === 'number' ? 'check' : 'warn' });
    }
    const r = await linkWearable(p);
    setWBusy(null);
    if (r === 'not_set_up') toast(t('{n} is almost ready. It opens as soon as Gymi’s {n} account is approved.', { n: wearableName(p) }), { icon: 'watch' });
    else if (r === 'offline') toast(t('You’re offline. Check your connection and try again.'), { icon: 'warn' });
    else if (r === 'failed') toast(t('Couldn’t connect {n}. Please try again.', { n: wearableName(p) }), { icon: 'warn' });
  };

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
        {t('Rings and bands')}
      </Text>
      <List>
        {WEARABLES.map(([p, n, d], idx) => {
          const l = linkOf(p);
          const ready = !!ws?.configured[p];
          const state = l ? (l.status === 'ok' ? 'on' : 'again') : ready ? 'off' : 'soon';
          const when = l?.last_sync ? new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit', day: 'numeric', month: 'short' }).format(new Date(l.last_sync)) : null;
          return (
            <ListRow key={p} first={!idx} onPress={() => (wBusy ? undefined : tapWearable(p))}>
              <Icon name={p === 'oura' ? 'watch' : 'pulse'} size={20} color={c.cobalt} />
              <View style={{ flex: 1 }}>
                <Text weight={700}>{n}</Text>
                <Text variant="small" color="sec">
                  {state === 'on' ? (when ? t('Connected. Synced {t}. Tap to sync now.', { t: when }) : t('Connected. Tap to sync now.')) : state === 'again' ? t('Sign in again to keep syncing.') : t(d)}
                </Text>
              </View>
              <Text variant="xs" weight={700} color={state === 'on' ? 'up' : state === 'again' ? c.down : 'sec'}>
                {wBusy === p ? t('Syncing…') : t(state === 'on' ? 'Connected' : state === 'again' ? 'Sign in' : state === 'off' ? 'Connect' : 'Coming soon')}
              </Text>
            </ListRow>
          );
        })}
      </List>
      {(ws?.links ?? []).map((l) => (
        <Button
          key={l.provider}
          small
          kind="ghost"
          title={t('Disconnect {n}', { n: wearableName(l.provider) })}
          style={{ alignSelf: 'center' }}
          onPress={async () => {
            if (!(await unlinkWearable(l.provider))) return toast(t('Couldn’t save. Please try again.'), { icon: 'warn' });
            loadWs();
            await reloadDeviceDays();
            toast(t('{n} disconnected. Its data was deleted from Gymi.', { n: wearableName(l.provider) }), { icon: 'info' });
          }}
        />
      ))}
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
            ['Garmin', 'watch', 'Steps, heart rate and training', 'soon'],
            ['Polar', 'watch', 'Heart rate, training and sleep', 'soon'],
            ['Fitbit', 'watch', 'Steps, sleep and heart rate', 'soon'],
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
