import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Platform, ScrollView, View } from 'react-native';

import { Field } from '@/components/Field';
import { Icon, type IconName } from '@/components/Icon';
import { Screen } from '@/components/Screen';
import { Sheet } from '@/components/Sheet';
import { Text } from '@/components/Text';
import { useToast } from '@/components/Toast';
import { Button, Card, Chip, Row, Segmented } from '@/components/ui';
import { useT } from '@/i18n';
import { useAuth } from '@/lib/auth';
import { CATALOG, type CatalogDevice, CATS, type DeviceCat, searchCatalog } from '@/lib/connections';
import { phoneSource, useDevices } from '@/lib/devices';
import { useHealth } from '@/lib/health';
import { shortDate } from '@/lib/progress';
import { useWeight } from '@/lib/units';
import { type WearableProvider, wearableStatus, type WearableStatus } from '@/lib/wearables';
import { useSettings } from '@/theme/settings';

type Phone = 'ios' | 'android';
const HUB: Record<Phone, string> = { ios: 'Apple Health', android: 'Health Connect' };

/** Connections: what links straight to Gymi, what comes in through the phone's health app, and how to set up each device. */
export default function Connections() {
  const { t, lang } = useT();
  const { colors: c } = useSettings();
  const toast = useToast();
  const { session } = useAuth();
  const dev = useDevices(session?.user.id);
  const health = useHealth();
  const W = useWeight();
  const [ws, setWs] = useState<WearableStatus | null>(null);
  const [q, setQ] = useState('');
  const [cat, setCat] = useState<DeviceCat | 'all'>('all');
  const [open, setOpen] = useState<CatalogDevice | null>(null);
  const [phone, setPhone] = useState<Phone>(Platform.OS === 'android' ? 'android' : 'ios');
  useEffect(() => {
    wearableStatus().then(setWs);
  }, []);

  const hub = Platform.OS === 'android' ? 'Health Connect' : 'Apple Health';
  const catName = (k: DeviceCat) => t(CATS.find(([x]) => x === k)?.[1] ?? k);
  const found = useMemo(() => searchCatalog(q, (k) => t(CATS.find(([x]) => x === k)?.[1] ?? k)), [q, t]);
  const shown = q.trim() ? found : CATALOG.filter((d) => cat === 'all' || d.cat === cat);

  const linked = (p: WearableProvider) => ws?.links.find((l) => l.provider === p);
  const wearState = (p: WearableProvider) => {
    const l = linked(p);
    return l ? (l.status === 'ok' ? 'Connected' : 'Sign in again') : ws?.configured[p] ? 'Connect' : 'Coming soon';
  };
  const direct: { name: string; icon: IconName; state: string; on?: boolean; go?: () => void }[] = [
    {
      name: phoneSource ? hub : 'Apple Health',
      icon: 'heart',
      state: phoneSource ? (dev.connected ? 'Connected' : 'Connect') : 'Phone app',
      on: dev.connected,
      go: () => router.push('/devices'),
    },
    { name: 'WHOOP', icon: 'pulse', state: wearState('whoop'), on: linked('whoop')?.status === 'ok', go: () => router.push('/devices') },
    { name: 'Oura Ring', icon: 'watch', state: wearState('oura'), on: linked('oura')?.status === 'ok', go: () => router.push('/devices') },
    { name: 'Garmin', icon: 'watch', state: 'Coming soon' },
    { name: 'Polar', icon: 'watch', state: 'Coming soon' },
    { name: 'Fitbit', icon: 'watch', state: 'Coming soon' },
  ];

  const lastWeight = health.weights.at(-1);
  const lastBody = [...health.measures].filter((m) => m.kind !== 'weight').at(-1);
  const lastBlood = health.blood[0];
  const bring: { title: string; icon: IconName; value: string | null; go: () => void }[] = [
    { title: 'Blood tests', icon: 'doc', value: lastBlood ? shortDate(lastBlood.day, lang) : null, go: () => router.push('/blood') },
    { title: 'Weight', icon: 'scale', value: lastWeight ? W.text(lastWeight.value) : null, go: () => router.push('/(tabs)/progress') },
    { title: 'Body measurements', icon: 'ruler', value: lastBody ? shortDate(lastBody.day, lang) : null, go: () => router.push('/(tabs)/progress') },
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
        {t('Some things connect straight to Gymi. Everything else comes in through Apple Health or Health Connect. Here is both, and how to set each one up.')}
      </Text>
      <Field value={q} onChangeText={setQ} placeholder={t('Search connections')} prefix="⌕" style={{ marginTop: 14 }} autoCorrect={false} />

      {q.trim() ? null : (
        <>
          {section(t('Connects straight to Gymi'), c.cobalt)}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
            {direct.map((d) => (
              <Card key={d.name} onPress={d.go ?? (() => toast(t('{n} is coming soon. Until then, it reaches Gymi through {h}.', { n: d.name, h: hub }), { icon: 'watch' }))} style={{ width: '48%', flexGrow: 1, marginBottom: 0, minHeight: 112, justifyContent: 'space-between' }}>
                <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: c.inset, alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name={d.icon} size={20} color={c.cobalt} />
                </View>
                <View style={{ marginTop: 12 }}>
                  <Text weight={700}>{d.name}</Text>
                  <Text variant="xs" weight={700} color={d.on ? 'up' : 'sec'} style={{ marginTop: 2 }}>
                    {t(d.state)}
                  </Text>
                </View>
              </Card>
            ))}
          </View>
          <Text variant="xs" color="sec" style={{ marginTop: 8, marginHorizontal: 4 }}>
            {t('More direct connections are coming soon.')}
          </Text>

          {section(t('Everything else already works'), c.up, t('Most watches, rings, scales and fitness apps reach Gymi through {h}. Yours is almost surely one of them.', { h: hub }))}
          <Card onPress={() => router.push('/devices')}>
            <Row style={{ alignItems: 'center' }}>
              <Icon name="heart" size={26} color={c.down} />
              <View style={{ flex: 1 }}>
                <Text weight={700} size={17}>
                  {phoneSource ? hub : 'Apple Health · Health Connect'}
                </Text>
                <Text variant="small" color="sec">
                  {t(dev.connected ? 'Connected. Your readings come in by themselves.' : 'Connect to bring in your health data')}
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
            <Row gap={6} style={{ marginTop: 12, alignItems: 'center' }}>
              {CATALOG.slice(1, 6).map((d) => (
                <Initial key={d.id} name={d.name} size={30} />
              ))}
              <Text variant="xs" weight={700} color="sec" style={{ marginStart: 4 }}>
                {t('+{n} more', { n: CATALOG.length - 6 })}
              </Text>
            </Row>
          </Card>

          {section(t('You bring these in'), '#A855F7', t('Numbers from a lab report or a check-up, not a wearable. Add or log them yourself; nothing to set up.'))}
          <View style={{ flexDirection: 'row', gap: 10 }}>
            {bring.map((b) => (
              <Card key={b.title} onPress={b.go} style={{ flex: 1, marginBottom: 0, padding: 14 }}>
                <View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: c.inset, alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name={b.icon} size={18} color="#A855F7" />
                </View>
                <Text weight={700} style={{ marginTop: 10 }}>
                  {t(b.title)}
                </Text>
                <Text variant="xs" color="sec" style={{ marginTop: 2 }}>
                  {b.value ?? t('No readings yet')}
                </Text>
              </Card>
            ))}
          </View>
        </>
      )}

      {section(t('Find your device'), c.sec, q.trim() ? undefined : t('Pick yours and we’ll show you exactly where to tap inside its app.'))}
      {q.trim() ? null : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 12 }}>
          <Chip title={t('All')} on={cat === 'all'} onPress={() => setCat('all')} />
          {CATS.map(([k, n]) => (
            <Chip key={k} title={t(n)} on={cat === k} onPress={() => setCat(k)} />
          ))}
        </ScrollView>
      )}
      {!shown.length ? (
        <Card style={{ alignItems: 'center', paddingVertical: 24 }}>
          <Text color="sec" style={{ textAlign: 'center' }}>
            {t('Not in the list? Look for “Apple Health” or “Health Connect” in its app’s settings. Almost every device has it.')}
          </Text>
        </Card>
      ) : (
        (cat === 'all' && !q.trim() ? CATS.map(([k]) => k) : [null]).map((k) => {
          const items = k ? shown.filter((d) => d.cat === k) : shown;
          if (!items.length) return null;
          return (
            <View key={k ?? 'list'}>
              {k ? (
                <Text variant="xs" weight={700} color="sec" style={{ letterSpacing: 1, textTransform: 'uppercase', marginTop: 6, marginBottom: 8, marginHorizontal: 4 }}>
                  {catName(k)}
                </Text>
              ) : null}
              {Array.from({ length: Math.ceil(items.length / 3) }, (_, r) => items.slice(r * 3, r * 3 + 3)).map((row) => (
                <View key={row[0].id} style={{ flexDirection: 'row', gap: 10, marginBottom: 10 }}>
                  {[0, 1, 2].map((i) =>
                    row[i] ? (
                      <View key={row[i].id} style={{ flex: 1 }}>
                        <Card onPress={() => setOpen(row[i])} style={{ marginBottom: 0, padding: 12, minHeight: 104 }}>
                          <View style={{ alignItems: 'center' }}>
                            <Initial name={row[i].name} size={40} />
                            <Text variant="small" weight={700} numberOfLines={2} style={{ marginTop: 8, textAlign: 'center' }}>
                              {row[i].name}
                            </Text>
                          </View>
                        </Card>
                      </View>
                    ) : (
                      <View key={i} style={{ flex: 1 }} />
                    ),
                  )}
                </View>
              ))}
            </View>
          );
        })
      )}

      <Sheet open={!!open} onClose={() => setOpen(null)}>
        {open ? <Steps d={open} phone={phone} setPhone={setPhone} close={() => setOpen(null)} /> : null}
      </Sheet>
    </Screen>
  );
}

/** A round badge with the device's first letter, in a color made from its name (no brand logos). */
function Initial({ name, size }: { name: string; size: number }) {
  const hue = [...name].reduce((a, ch) => (a * 31 + ch.charCodeAt(0)) % 360, 7);
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: `hsl(${hue}, 55%, 45%)`, alignItems: 'center', justifyContent: 'center' }}>
      <Text weight={800} size={size * 0.42} color="#FFFFFF">
        {name[0]}
      </Text>
    </View>
  );
}

/** Where to tap inside the device's own app, for iPhone or Android. */
function Steps({ d, phone, setPhone, close }: { d: CatalogDevice; phone: Phone; setPhone: (p: Phone) => void; close: () => void }) {
  const { t } = useT();
  const { colors: c } = useSettings();
  const path = d[phone];
  const hub = HUB[phone];
  const steps =
    path === 'auto'
      ? [t('{n} sends to {h} by itself. Nothing to set up there.', { n: d.name, h: hub }), t('In Gymi, connect {h} in Your readings. New data then comes in by itself.', { h: hub })]
      : path
        ? [
            t('Open the {a} app on your phone.', { a: d.app }),
            t('Tap: {p}', { p: [...path, hub].join(' › ') }),
            t('Turn on sharing and allow everything it asks (steps, sleep, heart rate, workouts, weight).'),
            t('In Gymi, connect {h} in Your readings. New data then comes in by itself.', { h: hub }),
          ]
        : null;
  return (
    <View>
      <Row style={{ alignItems: 'center', marginBottom: 14 }}>
        <Initial name={d.name} size={44} />
        <View style={{ flex: 1 }}>
          <Text weight={800} size={20}>
            {d.name}
          </Text>
          <Text variant="small" color="sec">
            {t('Through the {a} app', { a: d.app })}
          </Text>
        </View>
      </Row>
      {d.direct ? (
        <Card style={{ backgroundColor: c.inset, padding: 14 }}>
          <Text weight={700}>{t('Connects straight to Gymi too')}</Text>
          <Text variant="small" color="sec" style={{ marginTop: 2 }}>
            {t('Sign in to {n} from Your readings for more (like recovery and readiness). No phone app needed.', { n: d.name })}
          </Text>
          <Button small title={t('Open Your readings')} style={{ marginTop: 10, alignSelf: 'flex-start' }} onPress={() => (close(), router.push('/devices'))} />
        </Card>
      ) : null}
      <Segmented<Phone>
        value={phone}
        options={[
          { value: 'ios', label: 'iPhone' },
          { value: 'android', label: 'Android' },
        ]}
        onChange={setPhone}
      />
      {steps ? (
        <View style={{ marginTop: 14, gap: 12 }}>
          {steps.map((s, i) => (
            <Row key={i} style={{ alignItems: 'flex-start' }}>
              <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: c.cobalt, alignItems: 'center', justifyContent: 'center' }}>
                <Text num weight={800} size={13} color="#FFFFFF">
                  {i + 1}
                </Text>
              </View>
              <Text style={{ flex: 1, marginTop: 2 }}>{s}</Text>
            </Row>
          ))}
          <Text variant="xs" color="sec">
            {t('Menu names can change a little with app updates. If you can’t find it, look for “{h}” in its settings.', { h: hub })}
          </Text>
        </View>
      ) : (
        <Card style={{ marginTop: 14, backgroundColor: c.inset }}>
          <Text weight={700}>{t('{n} can’t send to {h}.', { n: d.name, h: hub })}</Text>
          {d.note ? (
            <Text variant="small" color="sec" style={{ marginTop: 4 }}>
              {t(d.note)}
            </Text>
          ) : null}
        </Card>
      )}
      <Button kind="ghost" title={t('Done')} style={{ marginTop: 16 }} onPress={close} />
    </View>
  );
}
