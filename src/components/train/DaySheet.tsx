import { router } from 'expo-router';
import { View } from 'react-native';

import { useT } from '@/i18n';
import { useTrain } from '@/lib/train';
import { buildWorkout, DAYS_LONG, exInfo } from '@/lib/training';
import { useSettings } from '@/theme/settings';

import { Icon } from '../Icon';
import { Sheet } from '../Sheet';
import { Text } from '../Text';
import { useToast } from '../Toast';
import { Button, Chip, Row } from '../ui';

/** A day in the weekly plan: its exercises, or rest (design: SH.dayplan). */
export function DaySheet({ d, onClose }: { d: number | null; onClose: () => void }) {
  const { t, lang } = useT();
  const { colors: c } = useSettings();
  const toast = useToast();
  const train = useTrain();
  const p = train.plan;
  if (d === null || !p) return <Sheet open={false} onClose={onClose} />;
  const day = train.week[d];
  const w = day?.w;
  const isToday = d === train.todayIdx;
  const label = `${t(DAYS_LONG[d])}${isToday ? t(', today') : ''}`;

  const setDay = (name: string | null) => {
    const next = train.week.map((x, i) => (i === d ? { ...x, w: name } : x));
    train.setWeek(next, false);
  };

  if (!w) {
    const opts = [...new Set(Object.keys(p.workouts))];
    const newWorkout = () => {
      let k = 1;
      let n = '';
      do n = `Workout ${String.fromCharCode(64 + k++)}`;
      while (p.workouts[n]);
      train.updatePlan({ workouts: { ...p.workouts, [n]: { ex: [], focus: '', min: 0 } } });
      setDay(n);
      onClose();
      router.push({ pathname: '/day-edit', params: { d: String(d) } });
    };
    return (
      <Sheet open onClose={onClose}>
        <Text variant="small" weight={700} color="sec">
          {label}
        </Text>
        <Text variant="h2" style={{ marginTop: 4 }}>
          {t('Rest day')}
        </Text>
        <Text variant="small" color="sec" style={{ marginTop: 8 }}>
          {t('Rest is where muscle grows. A walk or light stretching is a good idea.')}
        </Text>
        {!day.lock ? (
          <View>
            <Text variant="small" weight={700} color="sec" style={{ marginTop: 16, marginBottom: 8 }}>
              {t('Train this day instead')}
            </Text>
            <Row gap={8} style={{ flexWrap: 'wrap' }}>
              {opts.map((o) => (
                <Chip
                  key={o}
                  title={t(o)}
                  onPress={() => {
                    setDay(o);
                    onClose();
                    toast(t('{w} added to {day}', { w: t(o), day: t(DAYS_LONG[d]) }), { icon: 'check' });
                  }}
                />
              ))}
              <Chip title={t('+ New workout')} onPress={newWorkout} />
            </Row>
          </View>
        ) : null}
        <Button kind="soft" title={t('Close')} style={{ marginTop: 16 }} onPress={onClose} />
      </Sheet>
    );
  }

  const W = p.workouts[w];
  const b = buildWorkout(p, w, { last: train.last });
  const sets = b.ex.reduce((a, x) => a + x.sets, 0);
  const canStart = isToday && !train.todayLog && b.ex.length > 0;
  return (
    <Sheet open onClose={onClose}>
      <Row gap={4}>
        <Text variant="small" weight={700} color="sec">
          {label}
        </Text>
        {day.lock ? <Icon name="lock" size={12} color={c.sec} /> : null}
      </Row>
      <Row style={{ justifyContent: 'space-between', marginTop: 4 }}>
        <Text variant="h2" style={{ flex: 1 }}>
          {t('{w} day', { w: t(w) })}
        </Text>
        <Button
          small
          kind="glass"
          icon="edit"
          title={t('Edit')}
          onPress={() => {
            onClose();
            router.push({ pathname: '/day-edit', params: { d: String(d) } });
          }}
        />
      </Row>
      <Text variant="small" color="sec">
        {t('{n} exercises, {s} sets, about {m} min.', { n: b.ex.length, s: sets, m: W?.min ?? b.min })}
        {W?.focus ? ` ${t(W.focus)}` : ''}
      </Text>
      {b.ex.length ? (
        <View style={{ marginTop: 12, backgroundColor: 'rgba(127,127,135,0.1)', borderRadius: 22, overflow: 'hidden' }}>
          {b.ex.map((x, i) => {
            const info = exInfo(x, lang);
            const mach = info.mach[p.machines[x.id] ?? 0];
            return (
              <View key={`${x.id}-${i}`} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 12, paddingHorizontal: 14, borderTopWidth: i ? 1 : 0, borderTopColor: c.line }}>
                <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: c.inset, alignItems: 'center', justifyContent: 'center' }}>
                  <Text num size={12}>
                    {i + 1}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text weight={700}>{info.name}</Text>
                  <Row gap={4} style={{ marginTop: 2 }}>
                    <Icon name="train" size={12} color={c.sec} />
                    <Text variant="xs" color="sec">
                      {mach ? (lang === 'ar' ? mach[1] : mach[0]) : t(info.type)}
                    </Text>
                  </Row>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text num>{`${x.sets} × ${x.reps}${info.timed ? ` ${t('s')}` : ''}`}</Text>
                  <Text variant="xs" color="sec">
                    {x.target ? `${x.target} ${t('kg')}` : t('Pick your weight')}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>
      ) : (
        <Text color="sec" center style={{ marginTop: 16 }}>
          {t('No exercises yet.')}
        </Text>
      )}
      <Row gap={10} style={{ marginTop: 12 }}>
        <View style={{ flex: 1 }}>
          <Button kind={canStart ? 'glass' : 'soft'} title={t('Close')} style={{ alignSelf: 'stretch' }} onPress={onClose} />
        </View>
        {canStart ? (
          <View style={{ flex: 1 }}>
            <Button
              title={t('Start')}
              style={{ alignSelf: 'stretch' }}
              onPress={() => {
                onClose();
                router.push({ pathname: '/workout', params: { w } });
              }}
            />
          </View>
        ) : null}
      </Row>
    </Sheet>
  );
}
