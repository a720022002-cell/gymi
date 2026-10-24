import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Fragment, useCallback, useEffect, useState } from 'react';
import { Platform, View } from 'react-native';

import { type ArtKind, DeviceArt } from '@/components/DeviceArt';
import { Icon } from '@/components/Icon';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { useToast } from '@/components/Toast';
import { Button, Card, Chip, Row, Toggle } from '@/components/ui';
import { useT } from '@/i18n';
import { useAuth } from '@/lib/auth';
import { connectDevice, type DevicePrimary, disconnectDevice, phoneSource, reloadDeviceDays, setPrimaryDevice, setWriteBack, sourceName, syncDevice, useDevices } from '@/lib/devices';
import { finishWearable, linkWearable, syncWearables, unlinkWearable, wearableName, type WearableProvider, wearableStatus, type WearableStatus } from '@/lib/wearables';
import { useWatchPrefs } from '@/lib/watchPrefs';
import { useSettings } from '@/theme/settings';

/** Connections: link, sync or disconnect what talks straight to Adro, and what comes in through the phone's health app. */
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
  // Every time the screen shows (also after coming back from a maker's page), what's linked now.
  useFocusEffect(loadWs);

  // Back from a wearable's sign-in: say how it went once, then clear the link.
  // A sign-in that worked comes back as "finish": the server links it only for you (the one who started it).
  const back = useLocalSearchParams<{ wearable?: string; status?: string; state?: string }>();
  useEffect(() => {
    if (!back.wearable || !back.status) return;
    const n = wearableName(back.wearable);
    const { status, state } = back;
    router.replace('/connections');
    (async () => {
      const how = status === 'finish' && state ? await finishWearable(state) : status;
      const msg: Record<string, string> = { linked: '{n} connected. Your last month is in.', denied: '{n} wasn’t connected: access was not allowed.', expired: 'That took too long. Tap {n} to try again.', error: 'Couldn’t connect {n}. Please try again.' };
      toast(t(msg[how] ?? msg.error, { n }), { icon: how === 'linked' ? 'check' : 'warn' });
      if (how === 'linked') {
        reloadDeviceDays();
        loadWs();
      }
    })();
    // Only when coming back from a sign-in.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [back.wearable, back.status]);

  const hub = Platform.OS === 'android' ? 'Health Connect' : 'Apple Health';
  // The four steps need about 325 points at 11 pt text; narrower cards get slightly smaller text.
  const [flowW, setFlowW] = useState(325);
  const flowFont = Math.max(8, Math.min(11, Math.floor((11 * flowW) / 330 * 2) / 2));
  const native = phoneSource ? sourceName(phoneSource) : null;
  const phoneLinked = dev.connected && dev.prefs.source === phoneSource;
  const linkOf = (p: WearableProvider) => ws?.links.find((l) => l.provider === p);
  const anyLinked = phoneLinked || (ws?.links ?? []).some((l) => l.status === 'ok');
  const { watch, set: setWatch } = useWatchPrefs(session?.user.id);
  // With two or more sources, you pick whose sleep and heart readings count.
  const okWear = (ws?.links ?? []).filter((l) => l.status === 'ok').map((l) => l.provider);
  const mains: [DevicePrimary, string][] = [['auto', t('Automatic')], ...(phoneLinked ? [['phone', native ?? hub] as [DevicePrimary, string]] : []), ...okWear.map((p) => [p, wearableName(p)] as [DevicePrimary, string])];
  const primary = dev.prefs.primary ?? 'auto';

  const tapPhone = async () => {
    if (!phoneSource) return toast(t('{n} connects in the phone app. Your steps, sleep and heart rate will then come in by themselves.', { n: hub }), { icon: 'heart' });
    setBusy('phone');
    if (phoneLinked) {
      const x = await syncDevice(7).catch(() => 0);
      setBusy(null);
      // Null: a sync was already going (it brings the days in by itself).
      if (x == null) return;
      return toast(t('Synced {n} days from {s}', { n: x, s: native ?? '' }), { icon: 'check' });
    }
    const res = await connectDevice().catch(() => 'unavailable' as const);
    setBusy(null);
    if (res === 'ok') toast(t('{n} connected', { n: native ?? '' }), { icon: 'check' });
    else if (res === 'denied') toast(t('Adro wasn’t allowed to read {n}. You can allow it in Settings.', { n: native ?? '' }), { icon: 'warn' });
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
    loadWs();
  };

  const wearState = (p: WearableProvider) => {
    const l = linkOf(p);
    return l ? (l.status === 'ok' ? 'Connected' : 'Sign in again') : ws?.configured[p] ? 'Connect' : 'Coming soon';
  };
  const soon = (n: string) => toast(t('{n} is coming soon. Until then, it reaches Adro through {h}.', { n, h: hub }), { icon: 'watch' });
  const direct: { id: string; name: string; art: ArtKind; state: string; on?: boolean; go: () => void }[] = [
    { id: 'phone', name: native ?? 'Apple Health', art: phoneSource === 'health_connect' ? 'health_connect' : 'health', state: phoneSource ? (phoneLinked ? 'Connected' : 'Connect') : 'Phone app', on: phoneLinked, go: tapPhone },
    { id: 'whoop', name: 'WHOOP', art: 'whoop', state: wearState('whoop'), on: linkOf('whoop')?.status === 'ok', go: () => tapWearable('whoop') },
    { id: 'oura', name: 'Oura Ring', art: 'oura', state: wearState('oura'), on: linkOf('oura')?.status === 'ok', go: () => tapWearable('oura') },
    { id: 'fitbitair', name: 'Google Fitbit Air', art: 'fitbitair', state: 'Coming soon', go: () => soon('Google Fitbit Air') },
    { id: 'polar', name: 'Polar', art: 'polar', state: wearState('polar'), on: linkOf('polar')?.status === 'ok', go: () => tapWearable('polar') },
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
        {t('Some things connect straight to Adro. Everything else comes in through Apple Health or Health Connect.')}
      </Text>
      {section(t('Connects straight to Adro'), c.cobalt)}
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
        <Card style={{ marginTop: 10, marginBottom: 0 }}>
          <Row style={{ alignItems: 'center' }}>
            <View style={{ flex: 1 }}>
              <Text weight={700}>{t('Send Adro data to {n}', { n: native ?? '' })}</Text>
              <Text variant="small" color="sec" style={{ marginTop: 2 }}>
                {t(phoneSource === 'apple' ? 'Your workouts, meals, water and weight. Adro workouts then count toward your Apple Watch rings.' : 'Your workouts, meals, water and weight, so your other health apps see them too.')}
              </Text>
            </View>
            <Toggle
              value={!!dev.prefs.write_back}
              onChange={async (on) => {
                const r = await setWriteBack(on);
                if (on && r === 'ok') toast(t('From now on, Adro saves a copy in {n}.', { n: native ?? '' }), { icon: 'check' });
                else if (on && r === 'denied') toast(t('Adro wasn’t allowed to write to {n}. You can allow it in Settings.', { n: native ?? '' }), { icon: 'warn' });
                else if (on) toast(t('Couldn’t save. Please try again.'), { icon: 'warn' });
              }}
            />
          </Row>
        </Card>
      ) : null}
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
            toast(t('{n} disconnected. Its data was deleted from Adro.', { n: wearableName(l.provider) }), { icon: 'info' });
          }}
        />
      ))}
      <Text variant="xs" color="sec" style={{ marginTop: 8, marginHorizontal: 4 }}>
        {t('More direct connections are coming soon.')}
      </Text>

      {anyLinked ? (
        <>
          {section(t('From your watch'), c.cobalt)}
          <Card>
            {(
              [
                ['morning', 'Morning readiness note', 'After you wake up: how ready you are today, from last night.'],
                ['illness', 'Illness warning', 'When your temperature, breathing or oxygen and your heart show signs of getting sick.'],
              ] as const
            ).map(([k, title, sub], i) => (
              <Row key={k} style={{ alignItems: 'center', marginTop: i ? 14 : 0 }}>
                <View style={{ flex: 1 }}>
                  <Text weight={700}>{t(title)}</Text>
                  <Text variant="small" color="sec" style={{ marginTop: 2 }}>
                    {t(sub)}
                  </Text>
                </View>
                <Toggle value={watch[k]} onChange={(v) => setWatch({ [k]: v })} />
              </Row>
            ))}
            {mains.length > 2 ? (
              <View style={{ marginTop: 14 }}>
                <Text weight={700}>{t('Main device for sleep and heart')}</Text>
                <Text variant="small" color="sec" style={{ marginTop: 2 }}>
                  {t('When two devices send the same reading, this one counts. Automatic: a band or ring worn all night wins.')}
                </Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
                  {mains.map(([k, name]) => (
                    <Chip
                      key={k}
                      title={name}
                      on={primary === k}
                      onPress={async () => {
                        if (k === primary) return;
                        await setPrimaryDevice(k);
                        toast(k === 'auto' ? t('Adro picks the best reading again.') : t('Sleep and heart readings now come from {n}.', { n: name }), { icon: 'check' });
                      }}
                    />
                  ))}
                </View>
              </View>
            ) : null}
          </Card>
        </>
      ) : null}

      {section(t('Everything else already works'), c.up, t('Most watches, rings, scales and fitness apps reach Adro through {h}. Yours is almost surely one of them.', { h: hub }))}
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
        {/* The way data travels, on one line: the text is sized to the card's width so all four steps fit. */}
        <View onLayout={(e) => setFlowW(e.nativeEvent.layout.width)} style={{ flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 14 }}>
          {[t('Your device'), t('Its own app'), hub, 'Adro'].map((s, i, a) => (
            <Fragment key={s}>
              <View style={{ flexShrink: 1, paddingHorizontal: 5, paddingVertical: 6, borderRadius: 11, backgroundColor: i === a.length - 1 ? c.cobalt : c.inset }}>
                <Text size={flowFont} weight={700} color={i === a.length - 1 ? '#FFFFFF' : c.sec} numberOfLines={1}>
                  {s}
                </Text>
              </View>
              {i < a.length - 1 ? <Icon name={lang === 'ar' ? 'back' : 'chev'} size={9} color={c.sec} /> : null}
            </Fragment>
          ))}
        </View>
        <Text variant="xs" color="sec" style={{ marginTop: 12 }}>
          {t('Like Garmin, Galaxy Watch, Polar, COROS, Suunto, Huawei, Amazfit, Withings, Strava and many more.')}
        </Text>
      </Card>
    </Screen>
  );
}
