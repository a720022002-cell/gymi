import { useEffect, useState } from 'react';
import { View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { useT } from '@/i18n';
import { useAuth } from '@/lib/auth';
import { addDays } from '@/lib/nutrition';
import { type Badge, badgeLevel, badgeProgress, COMMIT_LABEL, type CommitKey } from '@/lib/progress';
import { getShowcase, saveShowcase, type Showcase } from '@/lib/social';
import { useTrain } from '@/lib/train';
import { DAYS, DAYS_LONG, missedDays, weekStart } from '@/lib/training';
import { useStreaks } from '@/lib/useProgress';
import { useSettings } from '@/theme/settings';

import { BarChart } from '../Charts';
import { Icon, type IconName, Mark } from '../Icon';
import { Bar, Ring } from '../Ring';
import { Sheet } from '../Sheet';
import { Text } from '../Text';
import { useToast } from '../Toast';
import { Button, Card, Row, Segmented, Springy, Toggle } from '../ui';
import { SecHead } from './bits';

const LVN = ['Locked', 'Level 1', 'Level 2', 'Level 3', 'Level 4', 'Level 5'];

/** Streaks, workouts in a row, commitment rate and badges (design: achievements). */
export function Streaks({ sub, setSub }: { sub: number; setSub: (n: number) => void }) {
  const { t } = useT();
  const { colors: c } = useSettings();
  const s = useStreaks();
  const toast = useToast();
  const { session } = useAuth();
  const uid = session?.user.id;
  const [badge, setBadge] = useState<Badge | null>(null);
  const [show, setShow] = useState<Showcase | null>(null);
  useEffect(() => {
    if (!uid) return;
    let alive = true;
    getShowcase(uid)
      .then((x) => alive && setShow(x))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [uid]);
  const pinned = (show?.badges ?? []).map((b) => b.id);
  // Up to 3 badges on your profile (friends see them).
  const togglePin = async (b: Badge) => {
    if (!uid || !show) return;
    const on = pinned.includes(b.id);
    if (!on && pinned.length >= 3) return toast(t('You can show 3 badges. Remove one first.'), { icon: 'info' });
    const next: Showcase = { ...show, badges: on ? show.badges.filter((x) => x.id !== b.id) : [...show.badges, { id: b.id, name: b.name, icon: b.icon, level: badgeLevel(b), tiers: b.tiers, v: b.v, unit: b.unit }] };
    setShow(next);
    const ok = await saveShowcase(uid, next);
    if (!ok) {
      setShow(show);
      toast(t('Couldn’t save. Please try again.'), { icon: 'warn' });
    }
  };
  return (
    <View>
      <Segmented<string>
        value={String(sub)}
        options={[
          { value: '0', label: t('Overall') },
          { value: '1', label: t('Workouts') },
          { value: '2', label: t('Commitment') },
        ]}
        onChange={(v) => setSub(Number(v))}
      />
      <View style={{ height: 12 }} />
      {sub === 0 ? <OverallStreak /> : sub === 1 ? <WorkoutStreak /> : <Commitment />}
      <SecHead title={t('Badges')} />
      <Text variant="small" color="sec" style={{ marginHorizontal: 4, marginTop: -4, marginBottom: 12 }}>
        {t('Each badge has levels. Tap one to see what’s next or show it on your profile.')}
      </Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {s.badges.map((b) => {
          const L = badgeLevel(b);
          return (
            <Springy key={b.id} onPress={() => setBadge(b)} style={{ width: '31.8%' }}>
              <View style={{ alignItems: 'center', gap: 6, paddingVertical: 14, paddingHorizontal: 4, borderRadius: 20, backgroundColor: undefined }}>
                {pinned.includes(b.id) ? (
                  <View style={{ position: 'absolute', top: 8, right: 8 }}>
                    <Icon name="bookmark" size={13} color={c.cobalt} strokeWidth={2.4} />
                  </View>
                ) : null}
                <BadgeIcon b={b} size={58} />
                <Text variant="xs" weight={700} center numberOfLines={1}>
                  {t(b.name)}
                </Text>
                <Text variant="xs" color="sec" style={{ marginTop: -4 }}>
                  {t(LVN[L])}
                </Text>
              </View>
            </Springy>
          );
        })}
      </View>
      <Sheet open={!!badge} onClose={() => setBadge(null)}>
        {badge ? <BadgeDetail b={badge} pinned={pinned.includes(badge.id)} count={pinned.length} canPin={!!show} onPin={() => togglePin(badge)} onClose={() => setBadge(null)} /> : null}
      </Sheet>
    </View>
  );
}

export function BadgeIcon({ b, size }: { b: Badge; size: number }) {
  const { colors: c } = useSettings();
  const L = badgeLevel(b);
  const max = b.tiers.length;
  const sw = size * 0.13;
  const r = (size - sw) / 2;
  const C = 2 * Math.PI * r;
  const pr = badgeProgress(b);
  if (!L)
    return (
      <Ring value={pr} max={1} size={size} stroke={sw} color={c.sec}>
        <Icon name="lock" size={size * 0.27} color={c.sec} />
      </Ring>
    );
  const full = L >= max;
  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size}>
        <Circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={c.track} strokeWidth={sw} />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={c.cobalt}
          strokeWidth={sw}
          strokeLinecap="round"
          strokeDasharray={`${C * (full ? 1 : Math.max(0.04, pr))} ${C}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
        <Circle cx={size / 2} cy={size / 2} r={r - sw * 0.9} fill={full ? '#F59E0B' : c.cobalt} />
      </Svg>
      <View style={{ position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center' } as object}>
        <Icon name={b.icon as IconName} size={size * 0.3} color="#FFFFFF" strokeWidth={2.2} />
      </View>
      <View
        style={{
          position: 'absolute',
          right: -4,
          bottom: -4,
          minWidth: size * 0.36,
          height: size * 0.36,
          borderRadius: size * 0.18,
          backgroundColor: c.text,
          alignItems: 'center',
          justifyContent: 'center',
          borderWidth: 2,
          borderColor: c.card,
        }}>
        <Text num size={size * 0.2} color={c.bg}>
          {L}
        </Text>
      </View>
    </View>
  );
}

function BadgeDetail({ b, pinned, count, canPin, onPin, onClose }: { b: Badge; pinned: boolean; count: number; canPin: boolean; onPin: () => void; onClose: () => void }) {
  const { t } = useT();
  const { colors: c } = useSettings();
  const L = badgeLevel(b);
  const max = b.tiers.length;
  const next = b.tiers[L];
  const lo = L ? b.tiers[L - 1] : 0;
  return (
    <View>
      <View style={{ alignItems: 'center' }}>
        <BadgeIcon b={b} size={96} />
        <Text variant="h2" style={{ marginTop: 12 }}>
          {t(b.name)}
        </Text>
        <Text variant="small" weight={700} color="sec">
          {L ? t('{l} of {m}', { l: t(LVN[L]), m: max }) : t('Not unlocked yet')}
        </Text>
      </View>
      {L < max ? (
        <Card style={{ marginTop: 16 }}>
          <Row style={{ justifyContent: 'space-between' }}>
            <Text variant="small" weight={700}>{`${b.v} ${t(b.unit)}`}</Text>
            <Text variant="small" weight={700} color="sec">
              {t('Next: {n}', { n: next })}
            </Text>
          </Row>
          <View style={{ marginTop: 8 }}>
            <Bar value={b.v - lo} max={next - lo} thick />
          </View>
          <Text variant="xs" color="sec" style={{ marginTop: 8 }}>
            {t('{n} more to reach {l}.', { n: Math.round((next - b.v) * 10) / 10, l: t(LVN[L + 1]) })}
          </Text>
        </Card>
      ) : (
        <Card style={{ marginTop: 16, alignItems: 'center' }}>
          <Text variant="small" weight={700}>
            {t('Max level reached. Respect.')}
          </Text>
        </Card>
      )}
      <View style={{ backgroundColor: c.card, borderRadius: 22, overflow: 'hidden' }}>
        {b.tiers.map((tier, i) => (
          <Row key={tier} style={{ minHeight: 48, paddingHorizontal: 16, borderTopWidth: i ? 1 : 0, borderTopColor: c.line }}>
            <View style={{ width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: i < L ? c.cobalt : 'transparent', borderWidth: i < L ? 0 : 2, borderColor: c.line }}>
              {i < L ? <Icon name="check" size={13} color="#FFFFFF" strokeWidth={3} /> : <Text variant="xs" weight={700} color="sec">{`${i + 1}`}</Text>}
            </View>
            <Text weight={i < L ? 700 : 500} style={{ flex: 1 }}>
              {t(LVN[i + 1])}
            </Text>
            <Text variant="small" weight={700} color="sec">{`${tier} ${t(b.unit)}`}</Text>
          </Row>
        ))}
      </View>
      {L ? (
        <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View style={{ flex: 1 }}>
            <Text weight={700}>{t('Show on my profile')}</Text>
            <Text variant="xs" color="sec">
              {t('Up to 3 badges. Friends see them. ({n}/3)', { n: count })}
            </Text>
          </View>
          <Toggle value={pinned} onChange={() => canPin && onPin()} label={t('Show on my profile')} />
        </Card>
      ) : (
        <Text variant="small" color="sec" center style={{ marginTop: 4 }}>
          {t('Unlock it to show it on your profile.')}
        </Text>
      )}
      <Button kind="ghost" title={t('Done')} style={{ marginTop: 8 }} onPress={onClose} />
    </View>
  );
}

type DotState = 'done' | 'today' | 'planned' | 'upcoming' | 'rest' | 'missed';

/** The week as dots (a tick when done, a ring for today, a moon for rest), with one short line under it instead of a legend. */
function WeekDots({ cells, caption }: { cells: { st: DotState; letter?: string }[]; caption: string }) {
  const { t, lang } = useT();
  const { colors: c } = useSettings();
  const { todayIdx } = useTrain();
  const look = (st: DotState) =>
    ({
      done: { backgroundColor: c.cobalt },
      today: { borderWidth: 2.5, borderColor: c.cobalt },
      planned: { borderWidth: 2, borderColor: c.cobalt, borderStyle: 'dashed' as const, opacity: 0.8 },
      upcoming: { borderWidth: 2, borderColor: c.line, borderStyle: 'dashed' as const },
      rest: { backgroundColor: c.inset },
      missed: { backgroundColor: 'rgba(220,38,38,0.12)' },
    })[st];
  return (
    <View>
      <Row gap={4} style={{ justifyContent: 'center', marginTop: 16 }}>
        {cells.map((x, i) => (
          <View key={i} style={{ width: 38, alignItems: 'center' }}>
            <View style={[{ width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' }, look(x.st)]}>
              {x.st === 'done' ? (
                <Icon name="check" size={16} color="#FFFFFF" strokeWidth={2.6} />
              ) : x.st === 'rest' ? (
                <Icon name="moon" size={15} color={c.sec} />
              ) : x.st === 'missed' ? (
                <Icon name="close" size={14} color={c.down} strokeWidth={2.6} />
              ) : (
                <Text num size={12} color={x.st === 'upcoming' ? 'sec' : c.cobalt}>
                  {x.letter ?? ''}
                </Text>
              )}
            </View>
            <Text variant="xs" weight={700} color={i === todayIdx ? c.cobalt : 'sec'} style={{ marginTop: 4 }}>
              {lang === 'ar' ? 'حنثرخجس'[i] : t(DAYS[i]).slice(0, 1)}
            </Text>
          </View>
        ))}
      </Row>
      <Text variant="xs" weight={700} color="sec" center style={{ marginTop: 12 }}>
        {caption}
      </Text>
    </View>
  );
}

function OverallStreak() {
  const { t } = useT();
  const { colors: c } = useSettings();
  const s = useStreaks();
  const ws = weekStart(s.x.today);
  const cells = DAYS.map((_, i) => {
    const d = addDays(ws, i);
    if (s.active.has(d)) return { st: 'done' as const };
    if (d === s.x.today) return { st: 'today' as const };
    // Any day you log counts, so there are no rest days here.
    if (d > s.x.today) return { st: 'upcoming' as const };
    return { st: 'missed' as const };
  });
  const logged = cells.filter((x) => x.st === 'done').length;
  return (
    <Card style={{ alignItems: 'center', paddingVertical: 24 }}>
      <Ring value={s.overall} max={Math.max(s.best, 1)} size={150} stroke={14}>
        <Icon name="flame" size={28} color={c.cobalt} strokeWidth={2} />
        <Text num size={36}>
          {s.overall}
        </Text>
      </Ring>
      <Text variant="h2" style={{ marginTop: 12 }}>
        {t('{n} days in a row', { n: s.overall })}
      </Text>
      <Text variant="small" color="sec" center style={{ marginTop: 4 }}>
        {t('Any day you log something counts: food, a workout, water, or your check-in. Best: {n} days.', { n: s.best })}
      </Text>
      <WeekDots cells={cells} caption={t('This week: {n} of 7 days logged', { n: logged })} />
    </Card>
  );
}

function WorkoutStreak() {
  const { t } = useT();
  const { colors: c } = useSettings();
  const s = useStreaks();
  const train = useTrain();
  const ws = weekStart(train.today);
  // Skipped, dismissed and moved days, days made up on another day this week, and days before the plan or its days
  // last changed aren't missed (the same rule as the streak).
  const missed = train.plan ? missedDays(train.plan, new Set(train.logs.map((l) => l.day)), ws, addDays(train.today, -1)) : new Set<string>();
  const cells = DAYS.map((_, i) => {
    const d = addDays(ws, i);
    const w = train.week[i]?.w;
    if (train.doneIdx.has(i)) return { st: 'done' as const };
    if (!w) return { st: 'rest' as const };
    if (d < train.today) return { st: missed.has(d) ? ('missed' as const) : ('rest' as const) };
    return { st: d === train.today ? ('today' as const) : ('planned' as const), letter: t(w).slice(0, 1) };
  });
  const recent = train.logs.slice(0, 10).reverse();
  // The next planned workout: today if it's still to do, else the next day with one.
  const next = (() => {
    if (!train.setupDone) return null;
    if (train.todayName && !train.todayLog) return t('{w} today', { w: t(train.todayName) });
    for (let i = 1; i <= 7; i++) {
      const j = (train.todayIdx + i) % 7;
      const w = train.week[j]?.w;
      if (w) return i === 1 ? t('{w} tomorrow', { w: t(w) }) : t('{w} on {d}', { w: t(w), d: t(DAYS_LONG[j]) });
    }
    return null;
  })();
  return (
    <Card style={{ alignItems: 'center', paddingVertical: 24 }}>
      <Ring value={s.workouts} max={Math.max(s.bestWorkouts, 1)} size={150} stroke={14}>
        <Icon name="train" size={28} color={c.cobalt} strokeWidth={2} />
        <Text num size={36}>
          {s.workouts}
        </Text>
      </Ring>
      <Text variant="h2" style={{ marginTop: 12 }}>
        {t('{n} workouts in a row', { n: s.workouts })}
      </Text>
      <Text variant="small" color="sec" center style={{ marginTop: 4 }}>
        {t('Every workout you finish adds one. Rest days, skipped days and moved workouts don’t break it. Only a missed workout does. Best: {n}.', { n: s.bestWorkouts })}
      </Text>
      {train.setupDone ? (
        <WeekDots cells={cells} caption={t('This week: {d} of {p} workouts done', { d: cells.filter((x) => x.st === 'done').length, p: train.week.filter((x) => x?.w).length })} />
      ) : null}
      {recent.length ? (
        <>
          <Text variant="xs" weight={700} color="sec" style={{ marginTop: 16 }}>
            {t('Last {n} workouts', { n: recent.length })}
          </Text>
          <Row gap={5} style={{ flexWrap: 'wrap', justifyContent: 'center', marginTop: 8 }}>
            {recent.map((l) => (
              <View key={l.id} style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: c.cobalt, alignItems: 'center', justifyContent: 'center' }}>
                <Text num size={12} color="#FFFFFF">
                  {t(l.name).slice(0, 1)}
                </Text>
              </View>
            ))}
            <View style={{ width: 30, height: 30, borderRadius: 15, borderWidth: 2, borderStyle: 'dashed', borderColor: c.line, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="plus" size={14} color={c.sec} strokeWidth={2.4} />
            </View>
          </Row>
        </>
      ) : null}
      {next ? (
        <Text variant="xs" color="sec" style={{ marginTop: 8 }}>
          {t('Next: {w}', { w: next })}
        </Text>
      ) : null}
    </Card>
  );
}

function Commitment() {
  const { t } = useT();
  const { colors: c } = useSettings();
  const s = useStreaks();
  const [range, setRange] = useState<'7' | '30'>('30');
  const cm = range === '7' ? s.c7 : s.c30;
  const pc = cm.pct;
  const lvl = pc == null ? '' : pc >= 90 ? 'Excellent' : pc >= 80 ? 'Strong' : pc >= 65 ? 'Good' : 'Building up';
  const keys = (Object.keys(COMMIT_LABEL) as CommitKey[]).filter((k) => cm.parts[k][1] > 0);
  const weakest = keys.map((k) => [k, cm.parts[k][0] / cm.parts[k][1]] as const).sort((a, b) => a[1] - b[1])[0]?.[0];
  const win: Record<CommitKey, string> = {
    sleep: 'get to bed 30 minutes earlier on work nights.',
    water: 'keep a bottle with you and sip every hour.',
    prot: 'hit your protein at lunch, so dinner is easier.',
    cal: 'log your meals as you eat them, not at night.',
    work: 'put your workouts in your calendar like meetings.',
  };
  return (
    <View>
      <Card style={{ alignItems: 'center', paddingVertical: 24 }}>
        <Ring value={pc ?? 0} max={100} size={150} stroke={14}>
          <Text num size={34}>
            {pc == null ? '–' : `${pc}%`}
          </Text>
          <Text variant="xs" weight={700} color="sec">
            {t(lvl)}
          </Text>
        </Ring>
        <Text variant="h2" style={{ marginTop: 12 }}>
          {t('Commitment rate')}
        </Text>
        <Text variant="small" color="sec" center style={{ marginTop: 4 }}>
          {t('How well you stuck to your plan: workouts, calories, protein, water and sleep.')}
        </Text>
        <View style={{ alignSelf: 'stretch', marginTop: 12 }}>
          <Segmented<'7' | '30'>
            value={range}
            options={[
              { value: '7', label: t('Last 7 days') },
              { value: '30', label: t('Last 30 days') },
            ]}
            onChange={setRange}
          />
        </View>
      </Card>
      {s.above.weeks > 0 ? (
        <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View style={{ width: 36, height: 36, borderRadius: 11, backgroundColor: c.cobalt, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="flame" size={20} color="#FFFFFF" />
          </View>
          <View style={{ flex: 1 }}>
            <Text weight={700}>{t('{n} weeks in a row above 80%', { n: s.above.weeks })}</Text>
            <Text variant="small" color="sec">
              {t('Best: {n} weeks. Keep this week above 80% to make it {m}.', { n: s.above.best, m: s.above.weeks + 1 })}
            </Text>
          </View>
        </Card>
      ) : null}
      <Card>
        <Text weight={700}>{t('What counts')}</Text>
        {keys.length ? (
          keys.map((k) => {
            const [a, b] = cm.parts[k];
            const p = Math.round((a / b) * 100);
            const [n, icon, u] = COMMIT_LABEL[k];
            return (
              <View key={k} style={{ marginTop: 12 }}>
                <Row style={{ justifyContent: 'space-between' }}>
                  <Row gap={8}>
                    <Icon name={icon as IconName} size={16} color={c.cobalt} />
                    <Text variant="small" weight={700}>
                      {t(n)}
                    </Text>
                  </Row>
                  <Text variant="small" weight={700} num>{`${p}%`}</Text>
                </Row>
                <View style={{ marginTop: 4 }}>
                  <Bar value={a} max={b} color={p >= 80 ? c.up : p >= 60 ? c.cobalt : c.down} />
                </View>
                <Text variant="xs" color="sec" style={{ marginTop: 4 }}>
                  {t(u, { a, b })}
                </Text>
              </View>
            );
          })
        ) : (
          <Text variant="small" color="sec" style={{ marginTop: 6 }}>
            {t('Set up food and training, then log for a few days to see your rate.')}
          </Text>
        )}
      </Card>
      {s.hist.some((x) => x != null) ? (
        <Card>
          <Text weight={700}>{t('Weekly trend')}</Text>
          <View style={{ marginTop: 8 }}>
            <BarChart values={s.hist} labels={s.hist.map((_, i) => (i === s.hist.length - 1 ? t('Now') : `W${i + 1}`))} highlight={s.hist.length - 1} max={100} goal={80} />
          </View>
          <Text variant="xs" color="sec">
            {t('Dashed line: 80% goal')}
          </Text>
        </Card>
      ) : null}
      {pc != null && pc < 90 && weakest ? (
        <Card style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
          <Mark size={22} color={c.cobalt} stroke={4.5} />
          <Text variant="small" style={{ flex: 1 }}>
            <Text variant="small" weight={700}>
              {t('Easiest win:')}
            </Text>{' '}
            {t(win[weakest])}
          </Text>
        </Card>
      ) : null}
    </View>
  );
}
