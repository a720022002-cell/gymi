import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Platform, View } from 'react-native';

import { type ArtKind, DeviceArt } from '@/components/DeviceArt';
import { Icon } from '@/components/Icon';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { useToast } from '@/components/Toast';
import { Button, Card, Row } from '@/components/ui';
import { useT } from '@/i18n';
import { useAuth } from '@/lib/auth';
import { connectDevice, disconnectDevice, phoneSource, reloadDeviceDays, sourceName, syncDevice, useDevices } from '@/lib/devices';
import { linkWearable, syncWearables, unlinkWearable, wearableName, type WearableProvider, wearableStatus, type WearableStatus } from '@/lib/wearables';
import { useSettings } from '@/theme/settings';

/** Connections: link, sync or disconnect what talks straight to Gymi, and what comes in through the phone's health app. */
export default function Connections() {
  const { t, lang } = useT();
  const { colors: c } = useSettings();
  const toast = useToast();
  const { session } = useAuth();
  const dev = useDevices(session?.user.id);
  // Wearables linked directly (WHOOP, Oura): what the server has, and which card is busy.
  const [ws, setWs] = useState<WearableStatus | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
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
    router.replace('/connections');
  }, [back.wearable, back.status, t, toast]);

  const hub = Platform.OS === 'android' ? 'Health Connect' : 'Apple Health';
  const native = phoneSource ? sourceName(phoneSource) : null;
  const phoneLinked = dev.connected && dev.prefs.source === phoneSource;
  const linkOf = (p: WearableProvider) => ws?.links.find((l) => l.provider === p);

  const tapPhone = async () => {
    if (!phoneSource) return toast(t('{n} connects in the phone app. Your steps, sleep and heart rate will then come in by themselves.', { n: hub }), { icon: 'heart' });
    setBusy('phone');
    if (phoneLinked) {
      const x = await syncDevice(7).catch(() => 0);
      setBusy(null);
      return toast(t('Synced {n} days from {s}', { n: x, s: native ?? '' }), { icon: 'check' });
    }
    const res = await connectDevice().catch(() => 'unavailable' as const);
    setBusy(null);
    if (res === 'ok') toast(t('{n} connected', { n: native ?? '' }), { icon: 'check' });
    else if (res === 'denied') toast(t('Gymi wasn’t allowed to read {n}. You can allow it in Settings.', { n: native ?? '' }), { icon: 'warn' });
    else toast(phoneSource === 'health_connect' ? t('Install or update Health Connect from Google Play, then try again.') : t('Apple Health isn’t available on this phone.'), { icon: 'info' });
  };

  const tapWearable = async (p: WearableProvider) => {
    const l = linkOf(p);
    setBusy(p);
    if (l && l.status === 'ok') {
      const r = await syncWearables(p);
      setBusy(null);
      loadWs();
      await reloadDeviceDays();
      const v = r?.[p];
      return toast(typeof v === 'number' ? t('Synced {n} days from {s}', { n: v, s: wearableName(p) }) : t(v === 'expired' ? 'Sign in to {n} again to keep syncing.' : 'Couldn’t sync {n}. Please try again.', { n: wearableName(p) }), { icon: typeof v === 'number' ? 'check' : 'warn' });
    }
    const r = await linkWearable(p);
    setBusy(null);
    if (r === 'not_set_up') toast(t('{n} is almost ready. It opens as soon as Gymi’s {n} account is approved.', { n: wearableName(p) }), { icon: 'watch' });
    else if (r === 'offline') toast(t('You’re offline. Check your connection and try again.'), { icon: 'warn' });
    else if (r === 'failed') toast(t('Couldn’t connect {n}. Please try again.', { n: wearableName(p) }), { icon: 'warn' });
  };

  const wearState = (p: WearableProvider) => {
    const l = linkOf(p);
    return l ? (l.status === 'ok' ? 'Connected' : 'Sign in again') : ws?.configured[p] ? 'Connect' : 'Coming soon';
  };
  const soon = (n: string) => toast(t('{n} is coming soon. Until then, it reaches Gymi through {h}.', { n, h: hub }), { icon: 'watch' });
  const direct: { id: string; name: string; art: ArtKind; state: string; on?: boolean; go: () => void }[] = [
    { id: 'phone', name: native ?? 'Apple Health', art: phoneSource === 'health_connect' ? 'health_connect' : 'health', state: phoneSource ? (phoneLinked ? 'Connected' : 'Connect') : 'Phone app', on: phoneLinked, go: tapPhone },
    { id: 'whoop', name: 'WHOOP', art: 'whoop', state: wearState('whoop'), on: linkOf('whoop')?.status === 'ok', go: () => tapWearable('whoop') },
    { id: 'oura', name: 'Oura Ring', art: 'oura', state: wearState('oura'), on: linkOf('oura')?.status === 'ok', go: () => tapWearable('oura') },
    { id: 'fitbitair', name: 'Google Fitbit Air', art: 'fitbitair', state: 'Coming soon', go: () => soon('Google Fitbit Air') },
    { id: 'polar', name: 'Polar', art: 'polar', state: 'Coming soon', go: () => soon('Polar') },
    { id: 'fitbit', name: 'Fitbit', art: 'fitbit', state: 'Coming soon', go: () => soon('Fitbit') },
  ];

  const section = (title: string, color: string, sub?: string) => (
    <View style={{ marginTop: 22, marginBottom: 10, marginHorizontal: 4 }}>
      <Text variant="xs" weight={700} color={color} style={{ letterSpacing: 1.2, textTransform: 'uppercase' }}>
        {title}
      </Text>
      {sub ? (
        <Text variant="small" color="sec" style={{ marginTop: 4 }}>
          {sub}
        </Text>
      ) : null}
    </View>
  );

  return (
    <Screen title={t('Connections')} back>
      <Text color="sec" style={{ marginTop: -8 }}>
        {t('Some things connect straight to Gymi. Everything else comes in through Apple Health or Health Connect.')}
      </Text>
      {section(t('Connects straight to Gymi'), c.cobalt)}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        {direct.map((d) => (
          <Card key={d.id} onPress={busy ? undefined : d.go} style={{ width: '48%', flexGrow: 1, marginBottom: 0, minHeight: 150, justifyContent: 'space-between' }}>
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: -6, marginEnd: -6 }}>
              <DeviceArt kind={d.art} size={68} />
            </View>
            <View style={{ marginTop: 4 }}>
              <Text weight={700}>{d.name}</Text>
              <Text variant="xs" weight={700} color={d.on ? 'up' : d.state === 'Sign in again' ? c.down : 'sec'} style={{ marginTop: 2 }}>
                {busy === d.id ? t('Syncing…') : d.on ? t('Connected. Tap to sync now.') : t(d.state)}
              </Text>
            </View>
          </Card>
        ))}
      </View>
      {phoneLinked ? (
        <Button
          small
          kind="ghost"
          title={t('Disconnect {n}', { n: native ?? '' })}
          style={{ alignSelf: 'center', marginTop: 8 }}
          onPress={async () => {
            await disconnectDevice();
            toast(Platform.OS === 'ios' ? t('Disconnected. You can also turn off access in the Health app.') : t('Disconnected. You can also turn off access in Health Connect.'), { icon: 'info' });
          }}
        />
      ) : null}
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
      <Text variant="xs" color="sec" style={{ marginTop: 8, marginHorizontal: 4 }}>
        {t('More direct connections are coming soon.')}
      </Text>

      {section(t('Everything else already works'), c.up, t('Most watches, rings, scales and fitness apps reach Gymi through {h}. Yours is almost surely one of them.', { h: hub }))}
      <Card onPress={busy ? undefined : tapPhone}>
        <Row style={{ alignItems: 'center' }}>
          <Icon name="heart" size={26} color={c.down} />
          <View style={{ flex: 1 }}>
            <Text weight={700} size={17}>
              {phoneSource ? hub : 'Apple Health · Health Connect'}
            </Text>
            <Text variant="small" color="sec">
              {t(phoneLinked ? 'Connected. Your readings come in by themselves.' : 'Connect to bring in your health data')}
            </Text>
          </View>
          <Icon name="chev" size={18} color={c.sec} />
        </Row>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6, marginTop: 14 }}>
          {[t('Your device'), t('Its own app'), hub, 'Gymi'].map((s, i, a) => (
            <Row key={s} gap={6} style={{ alignItems: 'center' }}>
              <View style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12, backgroundColor: i === a.length - 1 ? c.cobalt : c.inset }}>
                <Text variant="xs" weight={700} color={i === a.length - 1 ? '#FFFFFF' : c.sec}>
                  {s}
                </Text>
              </View>
              {i < a.length - 1 ? <Icon name={lang === 'ar' ? 'back' : 'chev'} size={12} color={c.sec} /> : null}
            </Row>
          ))}
        </View>
        <Text variant="xs" color="sec" style={{ marginTop: 12 }}>
          {t('Like Garmin, Galaxy Watch, Polar, COROS, Suunto, Huawei, Amazfit, Withings, Strava and many more.')}
        </Text>
      </Card>
    </Screen>
  );
}
