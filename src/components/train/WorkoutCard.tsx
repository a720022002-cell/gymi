import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { useT } from '@/i18n';
import { fmt } from '@/lib/nutrition';
import { useTrain } from '@/lib/train';
import { applyShift, buildWorkout, DAYS_LONG, exInfo, shiftPlan } from '@/lib/training';
import { useSettings } from '@/theme/settings';

import { OkChip } from '../food/Chips';
import { Icon, type IconName, Mark } from '../Icon';
import { Sheet } from '../Sheet';
import { Text } from '../Text';
import { useToast } from '../Toast';
import { Button, Card, Chip, Option, Row, Springy } from '../ui';

/** Today's workout: home mode and short version apply. */
export function useToday() {
  const train = useTrain();
  const p = train.plan;
  const home = !!p && (p.homeMode || p.homeDay === train.today);
  const short = !!p && p.short === train.today;
  const name = train.todayName;
  const wo = p && name ? buildWorkout(p, name, { home, short, last: train.last }) : null;
  return { name, home, short, wo, skipped: !!p?.skipped[train.today], done: !!train.todayLog };
}

/** Next planned workout after today, like "Pull on Thursday". */
export function useNextWorkout() {
  const { t } = useT();
  const { week, todayIdx } = useTrain();
  for (let i = 1; i <= 7; i++) {
    const d = (todayIdx + i) % 7;
    if (week[d]?.w) return t('{w} on {day}', { w: t(week[d].w as string), day: t(DAYS_LONG[d]) });
  }
  return t('none planned');
}

/** "You missed Legs on Sunday" with Move it / Skip it (design: missedCard). */
export function MissedCard() {
  const { t } = useT();
  const { colors: c } = useSettings();
  const toast = useToast();
  const train = useTrain();
  const p = train.plan;
  if (!p || !train.setupDone) return null;
  let m: { day: number; w: string; sh: NonNullable<ReturnType<typeof shiftPlan>> } | null = null;
  for (let i = train.todayIdx - 1; i >= 0; i--) {
    const w = train.week[i]?.w;
    const date = dateOf(train.today, i - train.todayIdx);
    if (p.since && date < p.since) break;
    if (w && !train.doneIdx.has(i) && !p.skipped[date] && !p.dismiss[date]) {
      const sh = shiftPlan(train.week, train.doneIdx, i, train.todayIdx);
      if (sh) m = { day: i, w, sh };
      break;
    }
  }
  if (!m) return null;
  const { day, w, sh } = m;
  return (
    <Card style={{ backgroundColor: c.gAi }}>
      <Row gap={10} style={{ alignItems: 'flex-start' }}>
        <Mark size={22} color={c.cobalt} stroke={4.6} />
        <View style={{ flex: 1 }}>
          <Text weight={700}>{t('You missed {w} on {day}', { w: t(w), day: t(DAYS_LONG[day]) })}</Text>
          <Text variant="small" color="sec" style={{ marginTop: 4 }}>
            {t('Do it today and move the rest of the week one workout later?')}
          </Text>
        </View>
      </Row>
      <View style={{ marginTop: 12, backgroundColor: c.inset, borderRadius: 14, paddingVertical: 8, paddingHorizontal: 12 }}>
        {sh.changes.map(([d, x]) => (
          <Row key={d} style={{ justifyContent: 'space-between', paddingVertical: 3 }}>
            <Text variant="small" weight={d === train.todayIdx ? 700 : 400}>
              {t(DAYS_LONG[d])}
              {d === train.todayIdx ? ` (${t('today')})` : ''}
            </Text>
            <Text variant="small" weight={700}>
              {t(x)}
            </Text>
          </Row>
        ))}
        {sh.overflow.length ? (
          <Text variant="xs" color="sec" style={{ marginTop: 4 }}>
            {t('{x} moves to next week', { x: sh.overflow.map((x) => t(x)).join(t(', ')) })}
          </Text>
        ) : null}
      </View>
      <Row gap={8} style={{ marginTop: 12 }}>
        <View style={{ flex: 1 }}>
          <Button
            small
            kind="soft"
            title={t('Skip it')}
            style={{ alignSelf: 'stretch' }}
            onPress={() => {
              train.updatePlan({ dismiss: { ...p.dismiss, [dateOf(train.today, day - train.todayIdx)]: true } });
              toast(t('Okay, {w} is skipped this week', { w: t(w) }), { icon: 'check' });
            }}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Button
            small
            title={t('Move it')}
            style={{ alignSelf: 'stretch' }}
            onPress={() => {
              const before = train.week;
              train.setWeek(applyShift(train.week, sh), true);
              toast(t('Plan moved. {w} is today.', { w: t(w) }), { icon: 'cal', undo: () => train.setWeek(before, true) });
            }}
          />
        </View>
      </Row>
    </Card>
  );
}

const dateOf = (today: string, offset: number) => {
  const [y, m, d] = today.split('-').map(Number);
  const x = new Date(y, m - 1, d + offset);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
};

/** Today's workout card for Home and Train (design: workoutCard). */
export function WorkoutCard() {
  const { t, lang } = useT();
  const { colors: c } = useSettings();
  const train = useTrain();
  const today = useToday();
  const next = useNextWorkout();
  const [skipOpen, setSkipOpen] = useState(false);

  if (!train.setupDone)
    return (
      <Card>
        <Text variant="h3">{t('Build your training plan')}</Text>
        <Text variant="small" color="sec" style={{ marginTop: 4, marginBottom: 12 }}>
          {t('Answer 3 quick questions and get a plan that fits your week.')}
        </Text>
        <Button title={t('Set up training')} onPress={() => router.push('/train')} />
      </Card>
    );

  if (today.done && train.todayLog)
    return (
      <Card>
        <Row style={{ justifyContent: 'space-between' }}>
          <Text variant="small" weight={700} color="sec">
            {train.todayLog.name === 'Home' ? t('Home workout') : t('{w} day', { w: t(train.todayLog.name) })}
          </Text>
          <OkChip label={t('Done')} />
        </Row>
        <Text variant="h2" style={{ marginTop: 4 }}>
          {t('{m} min, {v} kg lifted', { m: train.todayLog.minutes, v: fmt(train.todayLog.volume) })}
        </Text>
        <Button title={t('See summary')} style={{ marginTop: 16 }} onPress={() => router.push({ pathname: '/summary', params: { id: train.todayLog!.id } })} />
      </Card>
    );

  if (!today.name || !today.wo)
    return (
      <Card>
        <Text variant="small" weight={700} color="sec">
          {t('Rest day')}
        </Text>
        <Text variant="h2" style={{ marginTop: 4 }}>
          {t('Recover and walk')}
        </Text>
        <Text variant="small" color="sec" style={{ marginTop: 4 }}>
          {t('A walk or light stretching is a good idea. Next: {x}.', { x: next })}
        </Text>
      </Card>
    );

  if (today.skipped)
    return (
      <Card>
        <Text variant="small" weight={700} color="sec">
          {t('{w} day', { w: t(today.name) })}
        </Text>
        <Text variant="h2" style={{ marginTop: 4 }}>
          {t('Skipped today')}
        </Text>
        <Text variant="small" color="sec" style={{ marginTop: 4 }}>
          {t('Rest up. Next: {x}.', { x: next })}
        </Text>
        <Springy
          onPress={() => {
            const s = { ...train.plan!.skipped };
            delete s[train.today];
            train.updatePlan({ skipped: s });
          }}
          style={{ marginTop: 8, alignSelf: 'flex-start' }}>
          <Text variant="small" weight={700} color="link">
            {t('Undo, I’ll train')}
          </Text>
        </Springy>
      </Card>
    );

  const wo = today.wo;
  const first = wo.ex[0];
  return (
    <Card>
      <Row style={{ justifyContent: 'space-between' }}>
        <Text variant="small" weight={700} color="sec">
          {today.home ? t('Home workout') : t('{w} day', { w: t(today.name) })}
        </Text>
        {today.short ? <OkChip label={t('Short version')} /> : null}
      </Row>
      <Text variant="h2" style={{ marginTop: 4 }}>
        {t('{n} exercises, {m} min', { n: wo.ex.length, m: wo.min })}
      </Text>
      {first ? (
        <Row style={{ justifyContent: 'space-between', marginTop: 12 }}>
          <Text style={{ flex: 1 }} numberOfLines={1}>
            {exInfo(first, lang).name}
          </Text>
          {first.target ? (
            <Row gap={2}>
              <Icon name="up" size={15} color={c.up} strokeWidth={2.4} />
              <Text num weight={700} color="up" size={15}>{`${first.target} ${t('kg')}`}</Text>
            </Row>
          ) : (
            <Text variant="small" color="sec">
              {t('Pick your weight')}
            </Text>
          )}
        </Row>
      ) : (
        <Springy onPress={() => router.push({ pathname: '/day-edit', params: { d: String(train.todayIdx) } })} style={{ marginTop: 12 }}>
          <Text variant="small" weight={700} color="link">
            {t('Add exercises to this workout')}
          </Text>
        </Springy>
      )}
      {wo.ex.length ? (
        <Button
          title={t(train.session ? 'Continue workout' : 'Start workout')}
          style={{ marginTop: 16 }}
          onPress={() => router.push(train.session ? '/active' : { pathname: '/workout', params: { w: today.name! } })}
        />
      ) : null}
      {!train.session ? (
        <Springy onPress={() => setSkipOpen(true)} style={{ alignSelf: 'center', marginTop: 12 }}>
          <Text variant="small" weight={700} color="link">
            {t('Can’t train today?')}
          </Text>
        </Springy>
      ) : null}
      <SkipDaySheet open={skipOpen} onClose={() => setSkipOpen(false)} />
    </Card>
  );
}

/** "Can't train today?": reason, then move, short, home or skip (design: SH.skipday). */
export function SkipDaySheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useT();
  const { colors: c } = useSettings();
  const toast = useToast();
  const train = useTrain();
  const [reason, setReason] = useState<string | null>(null);
  const p = train.plan;
  const w = train.todayName;
  if (!p || !w) return <Sheet open={false} onClose={onClose} />;
  const sh = train.todayIdx < 6 ? shiftPlan(train.week, train.doneIdx, train.todayIdx, train.todayIdx + 1) : null;
  const opts: [IconName, string, string, () => void][] = [];
  if (sh)
    opts.push([
      'cal',
      'Move to tomorrow',
      t('{w} moves to {day}, the rest of the week shifts one workout later', { w: t(w), day: t(DAYS_LONG[train.todayIdx + 1]) }),
      () => {
        const before = train.week;
        train.setWeek(applyShift(train.week, sh), true);
        toast(t('{w} moved to {day}.', { w: t(w), day: t(DAYS_LONG[train.todayIdx + 1]) }) + (sh.overflow.length ? ` ${t('{x} moves to next week', { x: sh.overflow.map((x) => t(x)).join(t(', ')) })}` : ''), {
          icon: 'cal',
          undo: () => train.setWeek(before, true),
        });
      },
    ]);
  opts.push(['timer', 'Short version', t('About 25 minutes, main lifts only'), () => (train.updatePlan({ short: train.today }), toast(t('Short version ready, about 25 minutes'), { icon: 'timer' }))]);
  opts.push(['home', 'Home workout', t('No equipment, bodyweight only'), () => (train.updatePlan({ homeDay: train.today }), toast(t('Switched to a home workout'), { icon: 'home' }))]);
  opts.push([
    'close',
    'Just skip it',
    t('Your plan stays the same'),
    () => {
      train.updatePlan({ skipped: { ...p.skipped, [train.today]: true } });
      toast(t('{w} skipped today', { w: t(w) }), {
        icon: 'check',
        undo: () => {
          const s = { ...(train.plan?.skipped ?? {}) };
          delete s[train.today];
          train.updatePlan({ skipped: s });
        },
      });
    },
  ]);

  return (
    <Sheet open={open} onClose={onClose}>
      <Text variant="h2">{t('Can’t train today?')}</Text>
      <Text variant="small" color="sec" style={{ marginTop: 4 }}>
        {t('No problem. What’s going on?')}
      </Text>
      <Row gap={8} style={{ flexWrap: 'wrap', marginTop: 12 }}>
        {['Tired', 'Busy', 'Sore', 'Sick or hurt', 'Traveling'].map((x) => (
          <Chip key={x} title={t(x)} on={reason === x} onPress={() => setReason(x)} />
        ))}
      </Row>
      {reason === 'Sick or hurt' || reason === 'Tired' ? (
        <Card style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start', marginTop: 12, backgroundColor: c.inset }}>
          <Icon name="info" size={18} color={c.cobalt} />
          <Text variant="small" style={{ flex: 1 }}>
            {t(reason === 'Tired' ? 'A short version still keeps your streak and does most of the work.' : 'Rest is the right call. Don’t train while sick or in pain. If it’s an injury, see a doctor or physio.')}
          </Text>
        </Card>
      ) : null}
      {!sh && train.todayIdx < 6 ? (
        <Row gap={6} style={{ marginTop: 12 }}>
          <Icon name="lock" size={13} color={c.sec} />
          <Text variant="xs" color="sec">
            {t('Moving isn’t offered because a day this week is locked.')}
          </Text>
        </Row>
      ) : null}
      <View style={{ marginTop: 12 }}>
        {opts.map(([icon, title, sub, fn]) => (
          <Option
            key={title}
            icon={icon}
            title={t(title)}
            subtitle={sub}
            right={<Icon name="chev" size={16} color={c.sec} />}
            onPress={() => {
              onClose();
              fn();
            }}
          />
        ))}
      </View>
    </Sheet>
  );
}
