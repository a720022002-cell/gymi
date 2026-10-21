import { BlurView } from 'expo-blur';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Platform, StyleSheet, View, type ViewStyle } from 'react-native';

import { DEVICE_FIELD, DEVICE_ONLY, INFO, orderedKeys, type ReadingKey } from '@/components/health/readings';
import { Icon } from '@/components/Icon';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { useToast } from '@/components/Toast';
import { useRecovery } from '@/components/train/RecoveryCard';
import { Button, Card, NavButton, Row, Springy } from '@/components/ui';
import { useT } from '@/i18n';
import { useAuth } from '@/lib/auth';
import { saveCardOrder, sourceName, useDevices } from '@/lib/devices';
import { wearableName, wearableStatus, type WearableStatus } from '@/lib/wearables';
import { useFood } from '@/lib/food';
import { useHealth } from '@/lib/health';
import { addDays, fmt } from '@/lib/nutrition';
import { fx } from '@/lib/progress';
import { useTrain } from '@/lib/train';
import { useWeight } from '@/lib/units';
import { useSettings } from '@/theme/settings';

/** Your readings: what Adro knows today, in your own order. Closed and blurred until a device is connected in Connections. */
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
  // Wearables linked straight to Adro (WHOOP, Oura) also unlock the page.
  const [ws, setWs] = useState<WearableStatus | null>(null);
  useEffect(() => {
    wearableStatus().then(setWs);
  }, []);
  const wearOn = (ws?.links ?? []).filter((l) => l.status === 'ok').map((l) => wearableName(l.provider));
  const sources = [...(dev.connected ? [sourceName(dev.prefs.source)] : []), ...wearOn];
  // Nothing connected: the readings stay blurred and closed, with one way out (Connections).
  const locked = !sources.length;

  // Newest value a device sent for a field (within the last week).
  const devLast = (k: keyof (typeof dev.days)[number], from = addDays(food.today, -6)) => [...dev.days].reverse().find((d) => d.day >= from && d[k] != null && (!Array.isArray(d[k]) || (d[k] as unknown[]).length))?.[k] as number | undefined;
  const w = health.weights.at(-1);
  const W = useWeight();
  const lastSleep = [...health.checkins].reverse().find((x) => x.sleep_h != null);
  const workoutKcal = train.logs.filter((l) => l.day === food.today).reduce((a, l) => a + l.kcal, 0);
  const devToday = dev.days.find((d) => d.day === food.today);
  const steps = Math.max(food.steps, devToday?.steps ?? 0);
  const value = (k: ReadingKey): [string, string] => {
    const info = INFO[k];
    const show = (v: number | undefined | null) => (v == null ? '–' : info.dec ? fx(v) : fmt(v));
    if (k === 'steps') return [fmt(steps), ''];
    if (k === 'burned') return [fmt(food.burned + workoutKcal), 'kcal'];
    if (k === 'weight') return w ? [W.show(w.value), W.unit] : ['–', ''];
    if (k === 'sleep') {
      const v = lastSleep?.sleep_h ?? devLast('sleep_h');
      return v != null ? [fx(v), 'h'] : ['–', ''];
    }
    if (k === 'recovery') return [String(r.score), '%'];
    if (k === 'workouts') return [String(train.doneIdx.size), ''];
    const v = devLast(DEVICE_FIELD[k] as keyof (typeof dev.days)[number]);
    return [show(v), v == null ? '' : info.unit];
  };
  // Watch-only cards show up once a device has sent them (at any time).
  const visible = (k: ReadingKey) => !DEVICE_ONLY.includes(k) || devLast(DEVICE_FIELD[k] as keyof (typeof dev.days)[number], '') != null;
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

  return (
    <Screen
      title={t('Your readings')}
      back
      right={
        locked ? undefined : editing ? (
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
      {locked ? null : (
        <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Icon name="check" size={20} color={c.up} strokeWidth={2.6} />
          <Text variant="small" style={{ flex: 1 }}>
            <Text variant="small" weight={700}>
              {t('{n} connected.', { n: sources.join(' · ') })}
            </Text>{' '}
            {t('When your readings say you’re tired, Adro asks if you want a lighter workout.')}
          </Text>
        </Card>
      )}
      {editing ? (
        <Text variant="small" color="sec" style={{ marginBottom: 8, marginHorizontal: 4 }}>
          {t('Move cards into any order, then tap Save.')}
        </Text>
      ) : null}
      {/* The readings; blurred and closed when nothing is connected. */}
      <View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' }} pointerEvents={locked ? 'none' : 'auto'} aria-hidden={locked}>
          {keys.map((k, i) => {
            const [v, u] = value(k);
            const info = INFO[k];
            return (
              <Card key={k} onPress={editing || locked ? undefined : () => router.push({ pathname: '/reading', params: { k } })} style={{ width: '48.5%', marginBottom: 10 }}>
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
        {locked ? <Locked /> : null}
      </View>
      {locked ? null : (
        <Button small kind="ghost" title={t('Manage connections')} style={{ alignSelf: 'center', marginTop: 4 }} onPress={() => router.push('/connections')} />
      )}
    </Screen>
  );
}

/** Over the blurred readings: why they're closed, and the way to Connections. */
function Locked() {
  const { t } = useT();
  const { colors: c, isDark, reduceTransparency } = useSettings();
  const veil = isDark ? 'rgba(10,10,11,0.55)' : 'rgba(255,255,255,0.55)';
  const blur: ViewStyle | null = Platform.OS === 'web' ? ({ backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)' } as ViewStyle) : null;
  return (
    <View style={[StyleSheet.absoluteFill, { borderRadius: 22, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }]}>
      {Platform.OS !== 'web' && !reduceTransparency ? <BlurView intensity={28} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} /> : null}
      <View style={[StyleSheet.absoluteFill, { backgroundColor: reduceTransparency ? c.bg : veil }, blur]} />
      <View style={{ alignItems: 'center', paddingHorizontal: 28, maxWidth: 360 }}>
        <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: c.card, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="lock" size={24} color={c.cobalt} />
        </View>
        <Text weight={800} size={18} style={{ marginTop: 14, textAlign: 'center' }}>
          {t('Connect a device to see your readings')}
        </Text>
        <Text variant="small" color="sec" style={{ marginTop: 6, textAlign: 'center' }}>
          {t('Steps, heart rate, sleep and recovery come in automatically, and your coach uses them.')}
        </Text>
        <Button title={t('Connect a device')} style={{ marginTop: 16, alignSelf: 'stretch' }} onPress={() => router.push('/connections')} />
      </View>
    </View>
  );
}
