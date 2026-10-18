import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { OkChip } from '@/components/food/Chips';
import { Glass } from '@/components/Glass';
import { Icon } from '@/components/Icon';
import { Screen } from '@/components/Screen';
import { Sheet } from '@/components/Sheet';
import { Text } from '@/components/Text';
import { useToast } from '@/components/Toast';
import { StaleSessionChoice, useStaleSession, useToday } from '@/components/train/WorkoutCard';
import { Button, Card, Row, Springy } from '@/components/ui';
import { useT } from '@/i18n';
import { useTrain } from '@/lib/train';
import { buildWorkout, exInfo } from '@/lib/training';
import { useWeight } from '@/lib/units';
import { useSettings } from '@/theme/settings';

const WARMUP = ['2 min easy bike or brisk walk', '10 arm circles each way', '10 band pull-aparts', '1 light set of the first exercise'];
const STRETCH = ['Chest doorway stretch, 30 s each side', 'Overhead triceps stretch, 30 s each side', 'Child’s pose, 60 s'];

/** Workout detail before you start (design: workout). */
export default function WorkoutScreen() {
  const { t, lang } = useT();
  const W = useWeight();
  const { colors: c } = useSettings();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const train = useTrain();
  const today = useToday();
  // `day`: train for an earlier day (yesterday, from Home), so a workout after midnight still counts for the day before.
  const { w, day } = useLocalSearchParams<{ w: string; day?: string }>();
  const [machineFor, setMachineFor] = useState<string | null>(null);
  // A workout left open from an earlier day: save or discard it before starting this one.
  const stale = useStaleSession();
  const [staleOpen, setStaleOpen] = useState(false);
  const p = train.plan;
  if (!p || !w) return <Screen title={t('Workout')} back />;
  const past = !!day && day < train.today;
  const isToday = !past && w === today.name;
  const home = isToday && today.home;
  const light = isToday && today.light;
  const deload = isToday && today.deload;
  const wo = buildWorkout(p, w, { home, short: isToday && today.short, light, deload, preg: train.preg, last: train.last, top: train.top });

  const start = () => {
    if (stale) return setStaleOpen(true);
    if (train.session) return router.replace('/active');
    train.startWorkout(w, home, isToday && today.short, { light, deload, day: past ? day : undefined });
    router.replace('/active');
  };

  const list = (items: string[]) => (
    <Card>
      {items.map((x) => (
        <Row key={x} gap={8} style={{ marginVertical: 3 }}>
          <Icon name="check" size={16} color={c.cobalt} strokeWidth={2.4} />
          <Text variant="small" style={{ flex: 1 }}>
            {t(x)}
          </Text>
        </Row>
      ))}
    </Card>
  );
  const head = (s: string) => (
    <Text variant="small" weight={700} color="sec" style={{ marginTop: 18, marginBottom: 8, marginHorizontal: 4 }}>
      {s}
    </Text>
  );

  const mEx = machineFor ? wo.ex.find((x) => x.id === machineFor) : null;
  const mInfo = mEx ? exInfo(mEx, lang) : null;

  return (
    <View style={{ flex: 1 }}>
      <Screen title={home ? t('Home workout') : t('{w} day', { w: t(w) })} back>
        <Text color="sec" style={{ marginTop: -8 }}>
          {home ? t('No equipment') : wo.focus ? t(wo.focus) : ''}
          {home || wo.focus ? '. ' : ''}
          {t('{n} exercises, about {m} min.', { n: wo.ex.length, m: wo.min })}
        </Text>
        {past ? (
          <Card style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start', marginTop: 12 }}>
            <Icon name="cal" size={20} color={c.cobalt} />
            <Text variant="small" style={{ flex: 1 }}>
              {t('This workout counts for {d}.', { d: new Intl.DateTimeFormat(lang === 'ar' ? 'ar-u-nu-latn' : 'en-US', { weekday: 'long', month: 'long', day: 'numeric' }).format(new Date(`${day}T12:00:00`)) })}
            </Text>
          </Card>
        ) : null}
        {light || deload ? (
          <Card style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start', marginTop: 12 }}>
            <Icon name="bolt" size={20} color={c.cobalt} />
            <Text variant="small" style={{ flex: 1 }}>
              {t(deload ? 'Deload week: weights are about 60% and one set less. Next week you go back to normal.' : 'Lighter today: one set less and about 10% less weight.')}
            </Text>
          </Card>
        ) : null}
        {head(t('Warm-up, 5 min'))}
        {list(WARMUP)}
        {head(t('Exercises'))}
        {wo.ex.map((x, i) => {
          const info = exInfo(x, lang);
          const mi = p.machines[x.id] ?? 0;
          const mach = info.mach[mi];
          const l = x.last[0];
          return (
            <Card key={`${x.id}-${i}`}>
              <Row style={{ alignItems: 'flex-start' }}>
                <Springy disabled={x.id.startsWith('custom:')} onPress={() => router.push({ pathname: '/exercise', params: { id: x.id } })} style={{ flex: 1 }}>
                  <Text variant="h3">{info.name}</Text>
                  <Text variant="small" color="sec">
                    {mach ? (lang === 'ar' ? mach[1] : mach[0]) : t(info.type)}
                  </Text>
                  {x.swapped ? (
                    <View style={{ marginTop: 4, alignSelf: 'flex-start' }}>
                      <OkChip label={t('Swapped for your injury')} />
                    </View>
                  ) : null}
                </Springy>
                <Text num>{`${x.sets} × ${x.reps}${info.timed ? ` ${t('s')}` : ''}`}</Text>
              </Row>
              <Row style={{ justifyContent: 'space-between', marginTop: 12 }}>
                <Text variant="small" color="sec">
                  {l ? (info.timed ? t('Last time: {r} s', { r: l.r }) : l.w ? W.words(t('Last time: {w} kg × {r}', { w: W.show(l.w), r: l.r })) : t('Last time: {r} reps', { r: l.r })) : t('New exercise')}
                </Text>
                {info.mach.length > 1 ? (
                  <Springy onPress={() => setMachineFor(x.id)}>
                    <Text variant="small" weight={700} color="link">
                      {t('Change machine')}
                    </Text>
                  </Springy>
                ) : null}
              </Row>
            </Card>
          );
        })}
        {head(t('Stretch, 5 min'))}
        {list(STRETCH)}
        <View style={{ height: 90 }} />
      </Screen>

      <View pointerEvents="box-none" style={{ position: 'absolute', left: 16, right: 16, bottom: 20 + insets.bottom }}>
        <Glass style={{ borderRadius: 32, padding: 8, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <View style={{ flex: 1, paddingStart: 12 }}>
            <Text weight={700}>{t('{n} exercises', { n: wo.ex.length })}</Text>
            <Text variant="small" color="sec">
              {t('About {m} min', { m: wo.min })}
            </Text>
          </View>
          <Button icon="play" title={t(train.session && !stale ? 'Continue workout' : 'Start workout')} disabled={!wo.ex.length} onPress={start} style={{ paddingHorizontal: 22 }} />
        </Glass>
      </View>

      <Sheet open={staleOpen && stale} onClose={() => setStaleOpen(false)}>
        <StaleSessionChoice onDone={() => setStaleOpen(false)} />
      </Sheet>

      <Sheet open={!!machineFor} onClose={() => setMachineFor(null)}>
        {mInfo && mEx ? (
          <View>
            <Text variant="h2">{t('Change machine')}</Text>
            <Text variant="small" color="sec" style={{ marginTop: 4, marginBottom: 12 }}>
              {t('What does your gym have for {x}?', { x: mInfo.name })}
            </Text>
            {mInfo.mach.map(([en, ar], i) => {
              const on = (p.machines[mEx.id] ?? 0) === i;
              return (
                <Button
                  key={en}
                  kind={on ? 'primary' : 'glass'}
                  icon={on ? 'check' : undefined}
                  title={lang === 'ar' ? ar : en}
                  style={{ marginBottom: 8 }}
                  onPress={() => {
                    train.updatePlan({ machines: { ...p.machines, [mEx.id]: i } });
                    setMachineFor(null);
                    toast(t('Switched to {x}', { x: lang === 'ar' ? ar : en }), { icon: 'check' });
                  }}
                />
              );
            })}
            <Button kind="soft" title={t('Cancel')} onPress={() => setMachineFor(null)} />
          </View>
        ) : null}
      </Sheet>
    </View>
  );
}
