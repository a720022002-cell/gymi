import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Animated, PanResponder, Platform, View } from 'react-native';

import { Icon } from '@/components/Icon';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { useToast } from '@/components/Toast';
import { CoachBanner } from '@/components/train/CoachBanner';
import { DaySheet } from '@/components/train/DaySheet';
import { Button, Card, Row, Segmented, Springy } from '@/components/ui';
import { useT } from '@/i18n';
import { useTrain } from '@/lib/train';
import { DAYS, DAYS_LONG, type Day, onceNote, orderNext, weekOrder } from '@/lib/training';
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
  const plan = train.plan;
  const seq = week.filter((d) => d.w).map((d) => d.w as string);

  // Your coach's program: a read-only list.
  if (train.coach)
    return (
      <Screen title={t('Weekly plan')} back>
        <CoachBanner />
        <Text variant="small" color="sec" style={{ marginHorizontal: 4, marginBottom: 12 }}>
          {t('Tap a day to see its exercises.')}
        </Text>
        <View style={{ backgroundColor: c.card, borderRadius: 22, overflow: 'hidden' }}>
          {week.map((d, i) => (
            <Springy key={i} onPress={() => setOpen(i)} scaleTo={0.99} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56, paddingHorizontal: 16, borderTopWidth: i ? 1 : 0, borderTopColor: c.line }}>
              <Text weight={700} style={{ width: 46 }}>
                {t(DAYS[i])}
              </Text>
              <Text weight={d.w ? 700 : 400} color={d.w ? 'text' : 'sec'} style={{ flex: 1 }} numberOfLines={1}>
                {d.w ? t(d.w) : t('Rest')}
                {i === train.todayIdx ? <Text variant="xs" weight={700} color="cobalt">{`  ${t('Today')}`}</Text> : null}
              </Text>
              {d.w ? (
                <Text variant="xs" weight={700} color="sec">
                  {t('{n} min', { n: plan.workouts[d.w]?.min ?? 0 })}
                </Text>
              ) : null}
              <Icon name="chev" size={16} color={c.sec} />
            </Springy>
          ))}
        </View>
        <DaySheet d={open} onClose={() => setOpen(null)} />
      </Screen>
    );

  const type = plan.type ?? 'fixed';
  const setType = (v: 'fixed' | 'order') => {
    if (v === type) return;
    train.updatePlan(v === 'order' ? { type: v, queue: plan.queue?.length ? plan.queue : weekOrder(plan.week) } : { type: v });
  };
  const ord = orderNext(plan, train.logs, train.today);
  const earliestIdx = Math.round((new Date(`${ord.earliest}T12:00:00`).getTime() - new Date(`${train.today}T12:00:00`).getTime()) / 864e5);
  const earliest = earliestIdx <= 0 ? t('today') : earliestIdx === 1 ? t('tomorrow') : t(DAYS_LONG[(train.todayIdx + earliestIdx) % 7]);
  const moveQ = (i: number) => {
    const q = [...ord.queue];
    [q[i - 1], q[i]] = [q[i], q[i - 1]];
    train.updatePlan({ queue: q });
  };

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
      <Segmented
        value={type}
        onChange={setType}
        options={[
          { value: 'fixed', label: t('Fixed days') },
          { value: 'order', label: t('In order') },
        ]}
      />
      <Text variant="small" color="sec" style={{ marginTop: 10 }}>
        {type === 'fixed'
          ? t('Same days every week. Tap a day to see its exercises. Drag a workout to another day. Locked days never move, and we won’t suggest moving them.')
          : t('The day doesn’t matter. You get the next workout in order, with at least one rest day between workouts.')}
      </Text>
      {onceNote(seq) ? (
        <Card style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start', marginTop: 12 }}>
          <Icon name="info" size={20} color={c.cobalt} />
          <Text variant="small" style={{ flex: 1 }}>
            {t('Each muscle is trained once a week in this plan. Twice is better for growth, but once still works.')}
          </Text>
        </Card>
      ) : null}
      {type === 'order' ? (
        <View>
          <Card style={{ marginTop: 12 }}>
            <Text variant="small" weight={700} color="sec">
              {t('Up next')}
            </Text>
            <Text variant="h2" style={{ marginTop: 4 }}>
              {ord.next ? t(ord.next) : t('No workouts yet')}
            </Text>
            <Text variant="small" color="sec" style={{ marginTop: 4 }}>
              {train.todayLog ? t('Done today. You need one rest day after each workout.') : t('Earliest: {d}. You need one rest day after each workout.', { d: earliest })}
            </Text>
          </Card>
          <Text variant="small" weight={700} color="sec" style={{ marginTop: 18, marginBottom: 8, marginHorizontal: 4 }}>
            {t('Order')}
          </Text>
          <View style={{ backgroundColor: c.card, borderRadius: 22, overflow: 'hidden' }}>
            {ord.queue.map((w, i) => (
              <Row key={w} gap={12} style={{ minHeight: 56, paddingHorizontal: 14, borderTopWidth: i ? 1 : 0, borderTopColor: c.line }}>
                <View style={{ width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: w === ord.next ? c.cobalt : c.inset }}>
                  <Text num size={13} color={w === ord.next ? '#FFFFFF' : c.text}>
                    {i + 1}
                  </Text>
                </View>
                <Springy onPress={() => router.push({ pathname: '/day-edit', params: { w } })} style={{ flex: 1 }}>
                  <Text weight={700}>{t(w)}</Text>
                  <Text variant="xs" color="sec" numberOfLines={1}>
                    {plan.workouts[w]?.focus ? t(plan.workouts[w].focus) : plan.workouts[w]?.ex.length ? t('{n} min', { n: plan.workouts[w].min }) : t('Add exercises')}
                  </Text>
                </Springy>
                <Springy disabled={!i} onPress={() => moveQ(i)} accessibilityLabel={t('Move up')} style={{ width: 36, height: 36, alignItems: 'center', justifyContent: 'center', opacity: i ? 1 : 0.3 }}>
                  <Icon name="up" size={14} strokeWidth={2.2} />
                </Springy>
              </Row>
            ))}
          </View>
          {ord.next && ord.queue.length > 1 ? (
            <Text variant="small" color="sec" style={{ marginTop: 8, marginHorizontal: 4 }}>
              {t('When you finish {a}, {b} moves to the top.', { a: t(ord.next), b: t(ord.queue[(ord.idx + 1) % ord.queue.length]) })}
            </Text>
          ) : null}
        </View>
      ) : (
      <View>
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
      </View>
      )}
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
