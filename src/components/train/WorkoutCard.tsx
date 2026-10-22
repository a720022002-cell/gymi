import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { useT } from '@/i18n';
import { CY_PLAN } from '@/lib/cycle';
import { useCycleToday } from '@/lib/cyclePhase';
import { addDays, fmt, localDay } from '@/lib/nutrition';
import { useTrain } from '@/lib/train';
import { applyShift, buildWorkout, DAYS_LONG, effectiveWeek, exInfo, missedDays, shiftPlan, weekdayOf, weekStart, workoutTitle } from '@/lib/training';
import { useWeight } from '@/lib/units';
import { useSettings } from '@/theme/settings';

import { OkChip } from '../food/Chips';
import { Icon, type IconName, Mark } from '../Icon';
import { Sheet } from '../Sheet';
import { Text } from '../Text';
import { useToast } from '../Toast';
import { Button, Card, Chip, Option, Row, Springy } from '../ui';
import { CutLine } from './ExNotes';
import { useRecovery } from './RecoveryCard';

/** Today's workout: home mode and short version apply. */
export function useToday() {
  const train = useTrain();
  const p = train.plan;
  const home = !!p && (p.homeMode || p.homeDay === train.today);
  const short = !!p && p.short === train.today;
  const light = !!p && p.light === train.today;
  const deload = !!p && p.deload === weekStart(train.today);
  const name = train.todayName;
  const wo = p && name ? buildWorkout(p, name, { home, short, light, deload, preg: train.preg, last: train.last, top: train.top }) : null;
  // Done when today's planned workout was saved today; another workout (like Train together) doesn't count for it.
  // On a rest day, any workout today shows as done.
  const log = name ? (train.logs.find((l) => l.day === train.today && (l.name === name.slice(0, 40) || (home && l.name === 'Home'))) ?? null) : train.todayLog;
  return { name, home, short, light, deload, wo, skipped: !!p?.skipped[train.today], done: !!log, log };
}

const HOUR = 3_600_000;

/** A workout left open (Finish never tapped): started more than 12 hours ago, or on an earlier day and over 4 hours ago
 * (so a workout that runs past midnight isn't cut off). It must be saved or thrown away before today's workout. */
export function useStaleSession() {
  const train = useTrain();
  const s = train.session;
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);
  if (!s) return false;
  const age = now - s.start;
  return age > 12 * HOUR || (localDay(new Date(s.start)) < train.today && age > 4 * HOUR);
}

/** The choice for a workout left open: save it (only if it has working sets) or discard it. */
export function StaleSessionChoice({ onDone }: { onDone?: () => void }) {
  const { t } = useT();
  const { colors: c } = useSettings();
  const toast = useToast();
  const train = useTrain();
  const [saving, setSaving] = useState(false);
  const s = train.session;
  if (!s) return null;
  const started = localDay(new Date(s.start));
  const yesterday = started === addDays(train.today, -1);
  const work = s.ex.reduce((a, x) => a + x.sets.filter((y) => y.done && !y.warm).length, 0);
  const title = s.home ? t('Home workout') : s.name === 'Together' ? t('Train together') : t('{w} workout', { w: t(s.name) });

  const save = async () => {
    setSaving(true);
    const log = await train.finishWorkout(Object.fromEntries(s.ex.map((x) => [x.id, exInfo(x, 'en').name])));
    setSaving(false);
    if (!log) return toast(t('Couldn’t save. Please try again.'), { icon: 'warn' });
    toast(t('Saved. You can start today’s workout now.'), { icon: 'check' });
    onDone?.();
  };
  const discard = () => {
    train.setSession(null);
    toast(t('Workout discarded'), { icon: 'trash', undo: () => train.setSession(s) });
    onDone?.();
  };

  return (
    <View>
      <Text variant="small" weight={700} color="sec">
        {title}
      </Text>
      <Text variant="h2" style={{ marginTop: 4 }}>
        {t(yesterday ? 'You didn’t finish yesterday’s workout' : 'You didn’t finish your last workout')}
      </Text>
      <Text variant="small" color="sec" style={{ marginTop: 4 }}>
        {work ? t('Save it or discard it, then start today’s workout.') : t('No working sets were logged, so there’s nothing to save. Discard it to start today’s workout.')}
      </Text>
      {work ? (
        <Button icon="check" title={t(saving ? 'Saving…' : yesterday ? 'Finish yesterday’s workout' : 'Finish that workout')} disabled={saving} style={{ marginTop: 16 }} onPress={save} />
      ) : null}
      <Button kind={work ? 'ghost' : 'soft'} icon="trash" title={t('Discard it')} color={c.down} disabled={saving} style={{ marginTop: work ? 8 : 16 }} onPress={discard} />
    </View>
  );
}

/** The next planned workout after today (days off in a break passed over, each week with its own moves), or null.
 * `i`: days from today, `wd`: its weekday. */
export function nextPlanned(train: Pick<ReturnType<typeof useTrain>, 'plan' | 'week' | 'todayIdx' | 'today'>) {
  const { plan, week, todayIdx, today } = train;
  for (let i = 1; i <= 35; i++) {
    const date = addDays(today, i);
    const wd = (todayIdx + i) % 7;
    const w = plan ? effectiveWeek(plan, weekStart(date))[wd]?.w : week[wd]?.w;
    if (!w || plan?.skipped[date]) continue;
    return { w, i, wd, date };
  }
  return null;
}

/** Next planned workout after today, like "Pull on Thursday". */
export function useNextWorkout() {
  const { t, lang } = useT();
  const n = nextPlanned(useTrain());
  if (!n) return t('none planned');
  // After a week the date is shown too.
  const day = n.i < 7 ? t(DAYS_LONG[n.wd]) : new Intl.DateTimeFormat(lang === 'ar' ? 'ar-u-nu-latn' : 'en-US', { weekday: 'long', month: 'short', day: 'numeric' }).format(new Date(`${n.date}T12:00:00`));
  return t('{w} on {day}', { w: t(n.w), day });
}

/** The last day of a break that started today or earlier (days off in a row), or null when only today is off. */
function breakEnd(skipped: Record<string, true>, today: string) {
  let d = today;
  while (skipped[addDays(d, 1)]) d = addDays(d, 1);
  return d === today ? null : d;
}

/** "You missed Legs on Sunday" with Move it / Skip it (design: missedCard). */
export function MissedCard() {
  const { t } = useT();
  const { colors: c } = useSettings();
  const toast = useToast();
  const train = useTrain();
  const p = train.plan;
  // Coach plans and plans in order have no fixed days to miss.
  // Nothing to catch up on during a break either.
  // Today's workout already done: nothing to catch up on today either.
  if (!p || !train.setupDone || train.coach || p.type === 'order' || p.skipped[train.today] || train.todayLog) return null;
  let m: { day: number; w: string; sh: NonNullable<ReturnType<typeof shiftPlan>> } | null = null;
  // A workout done on another day this week (a rest day) counts as moved there: nothing to catch up on.
  const missed = missedDays(p, new Set(train.logs.map((l) => l.day)), dateOf(train.today, -train.todayIdx), dateOf(train.today, -1));
  for (let i = train.todayIdx - 1; i >= 0; i--) {
    const w = train.week[i]?.w;
    const date = dateOf(train.today, i - train.todayIdx);
    // Days before the plan, or before its days last changed, were planned differently: never "missed".
    if ((p.since && date < p.since) || (p.weekSince && date < p.weekSince)) break;
    if (w && missed.has(date)) {
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

const dateOf = addDays;

/** Today's workout card for Home and Train (design: workoutCard). */
export function WorkoutCard() {
  const { t, lang } = useT();
  const W = useWeight();
  const { colors: c } = useSettings();
  const train = useTrain();
  const today = useToday();
  const next = useNextWorkout();
  const stale = useStaleSession();
  const [skipOpen, setSkipOpen] = useState(false);
  const [anotherOpen, setAnotherOpen] = useState(false);
  const cycle = useCycleToday();
  const toast = useToast();
  const { r: rec } = useRecovery();
  // Poor sleep, low recovery, very sore, or the watch says the body is tired: ask about a lighter workout (once a day).
  // It's only offered: the person decides.
  const watchTired = rec.body != null && rec.body < 45;
  const tired = (rec.sleepH != null && rec.sleepH < 6) || rec.score < 50 || rec.sore === 2 || watchTired;
  // When the watch says the body hasn't recovered and tomorrow is a rest day, today's workout can also move there.
  const canPushToTomorrow = watchTired && train.plan?.type !== 'order' && train.todayIdx < 6 && !!train.week[train.todayIdx]?.w && !train.week[train.todayIdx + 1]?.w && !train.todayLog;

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

  // Yesterday's workout is still open: it blocks today's until it's saved or discarded.
  if (stale)
    return (
      <Card>
        <StaleSessionChoice />
      </Card>
    );

  if (today.done && today.log) {
    const log = today.log;
    const others = Object.keys(train.plan?.workouts ?? {}).filter((w) => train.plan?.workouts[w]?.ex.length);
    return (
      <Card>
        <Row style={{ justifyContent: 'space-between' }}>
          <Text variant="small" weight={700} color="sec">
            {workoutTitle(log.name, t)}
          </Text>
          <OkChip label={t('Done')} />
        </Row>
        <Text variant="h2" style={{ marginTop: 4 }}>
          {W.words(t('{m} min, {v} kg lifted', { m: log.minutes, v: fmt(W.num(log.volume)) }))}
        </Text>
        <Button title={t('See summary')} style={{ marginTop: 16 }} onPress={() => router.push({ pathname: '/summary', params: { id: log.id } })} />
        {train.session ? (
          <Button kind="soft" title={t('Continue workout')} style={{ marginTop: 8 }} onPress={() => router.push('/active')} />
        ) : others.length ? (
          <Springy onPress={() => setAnotherOpen(true)} style={{ alignSelf: 'center', marginTop: 12 }}>
            <Text variant="small" weight={700} color="link">
              {t('Start another workout')}
            </Text>
          </Springy>
        ) : null}
        <Sheet open={anotherOpen} onClose={() => setAnotherOpen(false)}>
          <Text variant="h2">{t('Start another workout')}</Text>
          <Row gap={8} style={{ flexWrap: 'wrap', marginTop: 12 }}>
            {others.map((w) => (
              <Chip
                key={w}
                title={t(w)}
                onPress={() => {
                  setAnotherOpen(false);
                  router.push({ pathname: '/workout', params: { w } });
                }}
              />
            ))}
          </Row>
          <Button kind="soft" title={t('Close')} style={{ marginTop: 16 }} onPress={() => setAnotherOpen(false)} />
        </Sheet>
      </Card>
    );
  }

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

  const breakOn = today.skipped ? breakEnd(train.plan!.skipped, train.today) : null;
  if (today.skipped)
    return (
      <Card>
        <Text variant="small" weight={700} color="sec">
          {t('{w} day', { w: t(today.name) })}
        </Text>
        <Text variant="h2" style={{ marginTop: 4 }}>
          {breakOn
            ? t('On a break until {day}', {
                day: breakOn <= addDays(train.today, 6) ? t(DAYS_LONG[weekdayOf(breakOn)]) : new Intl.DateTimeFormat(lang === 'ar' ? 'ar-u-nu-latn' : 'en-US', { month: 'short', day: 'numeric' }).format(new Date(`${breakOn}T12:00:00`)),
              })
            : t('Skipped today')}
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
        {today.short ? <OkChip label={t('Short version')} /> : today.deload ? <OkChip label={t('Deload week')} /> : today.light ? <OkChip label={t('Lighter today')} /> : null}
      </Row>
      <Text variant="h2" style={{ marginTop: 4 }}>
        {t('{n} exercises, {m} min', { n: wo.ex.length, m: wo.min })}
      </Text>
      {!today.light && !today.deload && !today.short && !train.session && train.plan?.lightAsked !== train.today && tired ? (
        <View style={{ marginTop: 12, backgroundColor: 'rgba(51,85,255,0.1)', borderRadius: 14, padding: 12 }}>
          <Row gap={8} style={{ alignItems: 'flex-start' }}>
            <Icon name="moon" size={18} color={c.cobalt} />
            <Text variant="small" style={{ flex: 1 }}>
              <Text variant="small" weight={700}>
                {rec.sleepH != null && rec.sleepH < 6
                  ? t('You slept {n} h last night.', { n: rec.sleepH })
                  : rec.sore === 2
                    ? t('You’re very sore today.')
                    : watchTired
                      ? t('Your watch says your body hasn’t recovered yet.')
                      : t('Your recovery is {n}% today.', { n: rec.score })}
              </Text>{' '}
              {t('Want to make today’s workout lighter? One set less and about 10% less weight.')}
            </Text>
          </Row>
          <Row gap={8} style={{ marginTop: 10, marginStart: 26, flexWrap: 'wrap' }}>
            <Button
              small
              title={t('Yes, lighter')}
              onPress={() => {
                train.updatePlan({ light: train.today, lightAsked: train.today });
                toast(t('Lighter today: one set less and about 10% less weight.'), { ai: true });
              }}
            />
            {canPushToTomorrow ? (
              <Button
                small
                kind="glass"
                title={t('Move to tomorrow')}
                onPress={() => {
                  // Swap with tomorrow's rest day, this week only.
                  const before = train.week;
                  const next = before.map((d) => ({ ...d }));
                  [next[train.todayIdx], next[train.todayIdx + 1]] = [next[train.todayIdx + 1], next[train.todayIdx]];
                  train.setWeek(next, true);
                  train.updatePlan({ lightAsked: train.today });
                  toast(t('Moved to tomorrow. Today is a rest day.'), { icon: 'cal', undo: () => train.setWeek(before, true) });
                }}
              />
            ) : null}
            <Button small kind="glass" title={t('No, keep it')} onPress={() => train.updatePlan({ lightAsked: train.today })} />
          </Row>
        </View>
      ) : null}
      {cycle && (cycle.phase === 'Luteal' || cycle.phase === 'Period') ? (
        <View style={{ marginTop: 12, backgroundColor: c.inset, borderRadius: 14, padding: 10 }}>
          <Row gap={8} style={{ alignItems: 'flex-start' }}>
            <Icon name="drop" size={16} color={c.cobalt} />
            <Text variant="small" style={{ flex: 1 }}>
              <Text variant="small" weight={700}>
                {t(cycle.phase === 'Luteal' ? 'Luteal phase.' : 'Period.')}
              </Text>{' '}
              {t(CY_PLAN[cycle.phase].t)}
            </Text>
          </Row>
          {!today.light && !today.deload && !today.short && !train.session ? (
            <Springy
              onPress={() => {
                train.updatePlan({ light: train.today });
                toast(t('Lighter today: one set less and about 10% less weight.'), { ai: true });
              }}
              style={{ marginTop: 6, marginStart: 24, alignSelf: 'flex-start' }}>
              <Text variant="small" weight={700} color="link">
                {t('Make today lighter')}
              </Text>
            </Springy>
          ) : null}
        </View>
      ) : null}
      {first ? (
        <View style={{ marginTop: 12 }}>
          <Row style={{ justifyContent: 'space-between' }}>
            <Text style={{ flex: 1 }} numberOfLines={1}>
              {exInfo(first, lang).name}
            </Text>
            {first.target ? (
              <Row gap={2}>
                <Icon name="up" size={15} color={c.up} strokeWidth={2.4} />
                <Text num weight={700} color="up" size={15}>{`${W.show(first.target)} ${W.label}`}</Text>
              </Row>
            ) : (
              <Text variant="small" color="sec">
                {t('Pick your weight')}
              </Text>
            )}
          </Row>
          {/* Lighter day or deload week: what changed on the first exercise, before → after. */}
          <CutLine cut={first.cut} deload={today.deload} />
        </View>
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
