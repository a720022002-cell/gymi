import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Animated, PanResponder, Platform, View } from 'react-native';

import { Icon } from '@/components/Icon';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { useToast } from '@/components/Toast';
import { DaySheet } from '@/components/train/DaySheet';
import { Button, Card, Row, Springy } from '@/components/ui';
import { useT } from '@/i18n';
import { useTrain } from '@/lib/train';
import { DAYS, DAYS_LONG, type Day, onceNote } from '@/lib/training';
import { useSettings } from '@/theme/settings';

const ROW = 64;
const GAP = 8;

export default function WeekPlan() {
  const { t } = useT();
  const { colors: c } = useSettings();
  const toast = useToast();
  const train = useTrain();
  const { fresh } = useLocalSearchParams<{ fresh?: string }>();
  const [open, setOpen] = useState<number | null>(null);
  const [over, setOver] = useState<number | null>(null);
  const [dragging, setDragging] = useState<number | null>(null);
  const week = train.week;
  if (!train.plan) return <Screen title={t('Weekly plan')} back />;
  const seq = week.filter((d) => d.w).map((d) => d.w as string);

  const save = (next: Day[]) => train.setWeek(next, false);
  const drop = (from: number, to: number) => {
    if (to === from) return;
    if (week[to].lock) return toast(t('{day} is locked', { day: t(DAYS_LONG[to]) }), { icon: 'lock' });
    const next = week.map((d) => ({ ...d }));
    const tmp = next[to].w;
    next[to].w = next[from].w;
    next[from].w = tmp;
    save(next);
    toast(t('{w} moved to {day}', { w: t(next[to].w ?? 'Rest'), day: t(DAYS_LONG[to]) }), { icon: 'cal' });
  };

  return (
    <Screen title={t('Weekly plan')} back>
      <Text variant="small" color="sec" style={{ marginTop: -4 }}>
        {t('Same days every week. Tap a day to see its exercises. Drag a workout to another day. Locked days never move, and we won’t suggest moving them.')}
      </Text>
      {onceNote(seq) ? (
        <Card style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start', marginTop: 12 }}>
          <Icon name="info" size={20} color={c.cobalt} />
          <Text variant="small" style={{ flex: 1 }}>
            {t('Each muscle is trained once a week in this plan. Twice is better for growth, but once still works.')}
          </Text>
        </Card>
      ) : null}
      <View style={{ marginTop: 12, gap: GAP }}>
        {week.map((d, i) => (
          <View
            key={i}
            style={{
              height: ROW,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 10,
              paddingHorizontal: 12,
              borderRadius: 18,
              backgroundColor: over === i && dragging !== i ? c.gAi : c.card,
              borderWidth: 2,
              borderColor: over === i && dragging !== i ? c.cobalt : 'transparent',
              zIndex: dragging === i ? 10 : 0,
            }}>
            <View style={{ width: 48 }}>
              <Text weight={700}>{t(DAYS[i])}</Text>
              {i === train.todayIdx ? (
                <Text variant="xs" weight={700} color="cobalt">
                  {t('Today')}
                </Text>
              ) : null}
            </View>
            <View style={{ flex: 1 }}>
              <DragChip
                day={d}
                index={i}
                onTap={() => setOpen(i)}
                onLockedDrag={() => toast(t('{day} is locked', { day: t(DAYS_LONG[i]) }), { icon: 'lock' })}
                onMove={(o) => setOver(o)}
                onStart={() => setDragging(i)}
                onEnd={(o) => {
                  setOver(null);
                  setDragging(null);
                  if (o !== null) drop(i, o);
                }}
                minutes={d.w ? (train.plan!.workouts[d.w]?.min ?? 0) : 0}
              />
            </View>
            <Springy
              onPress={() => save(week.map((x, j) => (j === i ? { ...x, lock: !x.lock } : x)))}
              accessibilityLabel={t(d.lock ? 'Unlock {day}' : 'Lock {day}', { day: t(DAYS_LONG[i]) })}
              style={{ width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name={d.lock ? 'lock' : 'unlock'} size={20} color={d.lock ? c.cobalt : c.sec} />
            </Springy>
          </View>
        ))}
      </View>
      <Row gap={8} style={{ marginTop: 10 }}>
        <Button small kind="soft" icon="lock" title={t('Lock all')} onPress={() => save(week.map((x) => ({ ...x, lock: true })))} />
        <Button small kind="soft" icon="unlock" title={t('Unlock all')} onPress={() => save(week.map((x) => ({ ...x, lock: false })))} />
      </Row>
      <Button title={t('Save plan')} style={{ marginTop: 20 }} onPress={() => (fresh ? router.replace('/train') : router.back())} />
      <DaySheet d={open} onClose={() => setOpen(null)} />
    </Screen>
  );
}

/** A workout you can drag up or down to another day. */
function DragChip({
  day,
  index,
  minutes,
  onTap,
  onLockedDrag,
  onMove,
  onStart,
  onEnd,
}: {
  day: Day;
  index: number;
  minutes: number;
  onTap: () => void;
  onLockedDrag: () => void;
  onMove: (over: number | null) => void;
  onStart: () => void;
  onEnd: (over: number | null) => void;
}) {
  const { t } = useT();
  const { colors: c } = useSettings();
  const pos = useState(() => new Animated.ValueXY())[0];
  const scale = useState(() => new Animated.Value(1))[0];
  // Latest values for the gesture handlers (they are created once).
  const live = useRef({ day, index, onTap, onLockedDrag, onMove, onStart, onEnd, moved: false, over: null as number | null });
  useEffect(() => {
    live.current = { ...live.current, day, index, onTap, onLockedDrag, onMove, onStart, onEnd };
  });

  // The handlers only read the ref while dragging, never during render.
  // eslint-disable-next-line react-hooks/refs
  const pan = useState(() =>
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => {
        live.current.moved = false;
        live.current.over = null;
      },
      onPanResponderMove: (_, g) => {
        const L = live.current;
        if (!L.moved && Math.hypot(g.dx, g.dy) < 8) return;
        if (L.day.lock) return;
        if (!L.moved) {
          L.moved = true;
          L.onStart();
          Animated.spring(scale, { toValue: 1.04, useNativeDriver: false }).start();
        }
        pos.setValue({ x: g.dx * 0.3, y: g.dy });
        const o = Math.max(0, Math.min(6, Math.round(L.index + g.dy / (ROW + GAP))));
        if (o !== L.over) {
          L.over = o;
          L.onMove(o);
        }
      },
      onPanResponderRelease: (_, g) => {
        const L = live.current;
        Animated.spring(pos, { toValue: { x: 0, y: 0 }, useNativeDriver: false }).start();
        Animated.spring(scale, { toValue: 1, useNativeDriver: false }).start();
        if (!L.moved) {
          if (L.day.lock && Math.hypot(g.dx, g.dy) >= 8) L.onLockedDrag();
          else L.onTap();
          return L.onEnd(null);
        }
        L.onEnd(L.over);
      },
      onPanResponderTerminate: () => {
        Animated.spring(pos, { toValue: { x: 0, y: 0 }, useNativeDriver: false }).start();
        Animated.spring(scale, { toValue: 1, useNativeDriver: false }).start();
        live.current.onEnd(null);
      },
    }),
  )[0];

  const rest = !day.w;
  return (
    <Animated.View
      {...pan.panHandlers}
      accessibilityRole="button"
      accessibilityLabel={rest ? t('Rest') : t(day.w as string)}
      style={[
        {
          height: 44,
          borderRadius: 14,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          paddingHorizontal: 12,
          backgroundColor: rest ? 'transparent' : c.inset,
          borderWidth: rest ? 1.5 : 0,
          borderStyle: 'dashed',
          borderColor: c.line,
          transform: [{ translateX: pos.x }, { translateY: pos.y }, { scale }],
        },
        Platform.OS === 'web' ? ({ touchAction: 'none', cursor: 'grab', userSelect: 'none' } as object) : null,
      ]}>
      {rest ? (
        <Text color="sec">{t('Rest')}</Text>
      ) : (
        <>
          <Icon name="grip" size={16} color={c.sec} />
          <Text weight={700} style={{ flex: 1 }} numberOfLines={1}>
            {t(day.w as string)}
          </Text>
          <Text variant="xs" color="sec">
            {minutes ? t('{n} min', { n: minutes }) : t('Add exercises')}
          </Text>
        </>
      )}
    </Animated.View>
  );
}
