import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Platform, View } from 'react-native';

import { type ArtKind, DeviceArt } from '@/components/DeviceArt';
import { Icon, type IconName } from '@/components/Icon';
import { Text } from '@/components/Text';
import { useToast } from '@/components/Toast';
import { Button, Card, Row } from '@/components/ui';
import { useT } from '@/i18n';
import { useAuth } from '@/lib/auth';
import { connectDevice, phoneSource, reloadDeviceDays, sourceName, useDevices } from '@/lib/devices';
import { finishWearable, linkWearable, wearableName, type WearableProvider, wearableStatus, type WearableStatus } from '@/lib/wearables';
import { useSettings } from '@/theme/settings';

const hub = Platform.OS === 'android' ? 'Health Connect' : 'Apple Health';

/** Sign-up step 4: let Adro read the phone's health app (Apple Health or Health Connect). Can be skipped. */
export function HealthStep({ onNext }: { onNext: () => void }) {
  const { t } = useT();
  const { colors: c } = useSettings();
  const toast = useToast();
  const { session } = useAuth();
  const dev = useDevices(session?.user.id);
  const [busy, setBusy] = useState(false);
  const name = phoneSource ? sourceName(phoneSource) : hub;
  const linked = dev.connected && dev.prefs.source === phoneSource;

  const connect = async () => {
    if (!phoneSource) {
      toast(t('{n} connects in the phone app. Your steps, sleep and heart rate will then come in by themselves.', { n: hub }), { icon: 'heart' });
      return onNext();
    }
    setBusy(true);
    const res = await connectDevice().catch(() => 'unavailable' as const);
    setBusy(false);
    if (res === 'ok') {
      toast(t('{n} connected', { n: name }), { icon: 'check' });
      return onNext();
    }
    if (res === 'denied') toast(t('Adro wasn’t allowed to read {n}. You can allow it in Settings.', { n: name }), { icon: 'warn' });
    else toast(phoneSource === 'health_connect' ? t('Install or update Health Connect from Google Play, then try again.') : t('Apple Health isn’t available on this phone.'), { icon: 'info' });
  };

  const rows: [IconName, string][] = [
    ['walk', 'Steps and active calories, so your food budget follows your day'],
    ['moon', 'Sleep, so your workouts fit how rested you are'],
    ['heart', 'Heart rate and HRV, for your recovery score'],
    ['scale', 'Weigh-ins from a smart scale'],
  ];
  return (
    <View>
      <View style={{ alignItems: 'center', marginTop: 4 }}>
        <DeviceArt kind={phoneSource === 'health_connect' ? 'health_connect' : 'health'} size={84} />
      </View>
      <Text variant="h1" center style={{ marginTop: 14 }}>
        {t('Connect {n}', { n: name })}
      </Text>
      <Text color="sec" center style={{ marginTop: 4 }}>
        {t('Adro reads your health data to make your plan fit your real day.')}
      </Text>
      <Card style={{ marginTop: 18 }}>
        {rows.map(([icon, line], i) => (
          <Row key={line} gap={12} style={{ marginTop: i ? 14 : 0, alignItems: 'center' }}>
            <View style={{ width: 34, height: 34, borderRadius: 11, backgroundColor: c.inset, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name={icon} size={18} color={c.cobalt} />
            </View>
            <Text style={{ flex: 1 }}>{t(line)}</Text>
          </Row>
        ))}
      </Card>
      <Text variant="xs" color="sec" center style={{ marginTop: 4, marginHorizontal: 8 }}>
        {t('Only you see it. You can turn it off any time in Connections.')}
      </Text>
      <View style={{ marginTop: 22 }}>
        {linked ? <Button title={t('Continue')} onPress={onNext} /> : <Button title={t('Connect {n}', { n: name })} onPress={connect} loading={busy} />}
      </View>
      {linked ? null : <Button title={t('Not now')} kind="ghost" style={{ marginTop: 8 }} onPress={onNext} />}
    </View>
  );
}

/** Sign-up step 5: a band or ring that links straight to Adro (WHOOP, Oura, Polar). Can be skipped. */
export function DeviceStep({ onDone }: { onDone: () => void }) {
  const { t } = useT();
  const toast = useToast();
  const [ws, setWs] = useState<WearableStatus | null>(null);
  const [busy, setBusy] = useState<WearableProvider | null>(null);
  const load = useCallback(() => {
    wearableStatus().then(setWs);
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  // Back from the wearable's own sign-in: say how it went once.
  // A sign-in that worked comes back as "finish": the server links it only for you (the one who started it).
  const back = useLocalSearchParams<{ wearable?: string; status?: string; state?: string }>();
  useEffect(() => {
    if (!back.wearable || !back.status) return;
    const n = wearableName(back.wearable);
    const { status, state } = back;
    // Clear the link first, so the message isn't shown again.
    router.setParams({ wearable: undefined, status: undefined, state: undefined });
    (async () => {
      const how = status === 'finish' && state ? await finishWearable(state) : status;
      const msg: Record<string, string> = { linked: '{n} connected. Your last month is in.', denied: '{n} wasn’t connected: access was not allowed.', expired: 'That took too long. Tap {n} to try again.', error: 'Couldn’t connect {n}. Please try again.' };
      toast(t(msg[how] ?? msg.error, { n }), { icon: how === 'linked' ? 'check' : 'warn' });
      if (how === 'linked') reloadDeviceDays();
      load();
    })();
    // Only when coming back from a sign-in.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [back.wearable, back.status]);

  const on = (p: WearableProvider) => ws?.links.some((l) => l.provider === p && l.status === 'ok');
  const tap = async (p: WearableProvider) => {
    if (on(p)) return;
    setBusy(p);
    const r = await linkWearable(p, '/signup?step=devices');
    setBusy(null);
    const n = wearableName(p);
    if (r === 'linked') {
      toast(t('{n} connected. Your last month is in.', { n }), { icon: 'check' });
      reloadDeviceDays();
    } else if (r === 'cancelled') toast(t('{n} isn’t connected yet. Tap it again and finish signing in on the {n} page.', { n }), { icon: 'warn' });
    else if (r === 'denied') toast(t('{n} wasn’t connected: access was not allowed.', { n }), { icon: 'warn' });
    else if (r === 'expired') toast(t('That took too long. Tap {n} to try again.', { n }), { icon: 'warn' });
    else if (r === 'not_set_up') toast(t('{n} is almost ready. It opens as soon as Adro’s {n} account is approved.', { n }), { icon: 'watch' });
    else if (r === 'offline') toast(t('You’re offline. Check your connection and try again.'), { icon: 'warn' });
    else if (r === 'failed' || r === 'error') toast(t('Couldn’t connect {n}. Please try again.', { n }), { icon: 'warn' });
    load();
  };

  const cards: [WearableProvider, ArtKind, string][] = [
    ['whoop', 'whoop', 'WHOOP'],
    ['oura', 'oura', 'Oura Ring'],
    ['polar', 'polar', 'Polar'],
  ];
  const any = cards.some(([p]) => on(p));
  return (
    <View>
      <Text variant="h1">{t('Do you wear a band or ring?')}</Text>
      <Text color="sec" style={{ marginTop: 4 }}>
        {t('These connect straight to Adro. Sign in once and your sleep, recovery and workouts come in by themselves.')}
      </Text>
      <View style={{ marginTop: 18, gap: 10 }}>
        {cards.map(([p, art, name]) => {
          const state = on(p) ? 'Connected' : ws && !ws.configured[p] ? 'Coming soon' : 'Connect';
          return (
            <Card key={p} onPress={busy || on(p) ? undefined : () => tap(p)} style={{ marginBottom: 0 }}>
              <Row gap={14} style={{ alignItems: 'center' }}>
                <DeviceArt kind={art} size={52} />
                <View style={{ flex: 1 }}>
                  <Text weight={700}>{name}</Text>
                  <Text variant="xs" weight={700} color={on(p) ? 'up' : 'sec'} style={{ marginTop: 2 }}>
                    {busy === p ? t('Opening…') : t(state)}
                  </Text>
                </View>
                {on(p) ? <Icon name="check" size={20} /> : null}
              </Row>
            </Card>
          );
        })}
      </View>
      <Text variant="small" color="sec" style={{ marginTop: 14, marginHorizontal: 4 }}>
        {t('Apple Watch, Galaxy Watch, Garmin, Fitbit and most others come in through {h}. No extra step needed.', { h: hub })}
      </Text>
      <View style={{ marginTop: 22 }}>
        <Button title={t(any ? 'Continue' : 'I don’t have one')} kind={any ? 'primary' : 'glass'} onPress={onDone} />
      </View>
    </View>
  );
}
