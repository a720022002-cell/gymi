import { Redirect, router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Platform, Pressable, View } from 'react-native';

import { Field } from '@/components/Field';

import { Glass } from '@/components/Glass';
import { Icon, type IconName, Mark } from '@/components/Icon';
import { Ring } from '@/components/Ring';
import { FreeMonthAlert } from '@/components/FreeMonthAlert';
import { InviteCodeSheet } from '@/components/InviteCodeSheet';
import { hoursText } from '@/components/coach/GymHours';
import { Screen } from '@/components/Screen';
import { Sheet } from '@/components/Sheet';
import { Avatar } from '@/components/social/Avatar';
import { useRecovery } from '@/components/train/RecoveryCard';
import { Text } from '@/components/Text';
import { useToast } from '@/components/Toast';
import { MacroBars } from '@/components/food/MacroBars';
import { MissedCard, WorkoutCard } from '@/components/train/WorkoutCard';
import { Button, Card, Row, Springy } from '@/components/ui';
import { useT } from '@/i18n';
import { useAuth } from '@/lib/auth';
import { useFood } from '@/lib/food';
import { useHealth } from '@/lib/health';
import { useCoachMode } from '@/lib/coachMode';
import { type Application, type MyCoach, myApplication, myCoach, myCoachPlans } from '@/lib/coaching';
import { RING_INFO, RING_NAMES, RINGS, type RingKey, useHomeLayout } from '@/lib/homeLayout';
import { fastTimes } from '@/lib/prayer';
import { recLabel } from '@/lib/recovery';
import { useTrain } from '@/lib/train';
import { fx } from '@/lib/progress';
import { useStreaks } from '@/lib/useProgress';
import { fmt, fmtTime } from '@/lib/nutrition';
import { useSettings } from '@/theme/settings';

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
}

export default function Home() {
  const { t, lang } = useT();
  const { profile } = useAuth();
  const food = useFood();
  const health = useHealth();
  const [layout] = useHomeLayout();
  const [coachMode] = useCoachMode();
  const { welcome } = useLocalSearchParams<{ welcome?: string }>();
  // Right after sign up: "Got an invite code?", then the morning check-in.
  const [askCode, setAskCode] = useState(welcome === '1');
  const [coach, setCoach] = useState<MyCoach | null>(null);
  const [app, setApp] = useState<Application | null | undefined>(undefined);
  const uid = profile?.id;
  useFocusEffect(
    useCallback(() => {
      if (!uid) return;
      let alive = true;
      myCoach().then((k) => alive && setCoach(k && k.status === 'active' ? k : null));
      myApplication().then((a) => alive && setApp(a));
      return () => {
        alive = false;
      };
    }, [uid]),
  );

  if (coachMode && profile?.account_type === 'coach' && profile.coach_status === 'approved') return <Redirect href="/cclients" />;
  const name = profile?.name || profile?.username || '';
  const date = new Intl.DateTimeFormat(lang === 'ar' ? 'ar-u-nu-latn' : 'en-US', { weekday: 'long', month: 'short', day: 'numeric' }).format(new Date());
  const ramadan = food.plan.ramadan ? fastTimes(food.plan.city, food.today) : null;
  const rings = layout.rings;

  return (
    <Screen
      title={date}
      large
      tabs
      pre={
        <Row style={{ justifyContent: 'space-between', marginTop: 2 }}>
          <Text weight={700} color="sec">
            {t(greeting())}
            {name ? `, ${name}` : ''}
          </Text>
        </Row>
      }
      right={
        <Springy onPress={() => router.push('/you')} scaleTo={1.08} accessibilityLabel={t('Profile and settings')}>
          {profile?.avatar_url ? (
            <Avatar id={uid ?? ''} name={name} size={44} url={profile.avatar_url} />
          ) : (
            <Glass style={{ width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' }}>
              <Text variant="h3" size={16}>
                {(name[0] ?? '?').toUpperCase()}
              </Text>
            </Glass>
          )}
        </Springy>
      }>
      {health.ready && !health.todayCheckin && !askCode ? <CheckinCard onStart={() => health.setCheckinOpen(true)} /> : null}
      <CoachAppCard app={app} />
      {coach ? <CoachCard k={coach} /> : food.coachTargets ? <CoachSetCard name={food.coachTargets.name} /> : null}
      {ramadan ? (
        <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Icon name="moon" size={22} />
          <Text variant="small" style={{ flex: 1 }}>
            <Text variant="small" weight={700}>
              {t('Ramadan mode is on.')}
            </Text>{' '}
            {t('Iftar at {a}, suhoor ends {b}.', { a: fmtTime(ramadan.maghrib, lang), b: fmtTime(ramadan.fajr, lang) })}
          </Text>
        </Card>
      ) : null}
      {layout.order
        .filter((k) => !layout.hidden.includes(k) && !(k === 'water' && rings.length > 1 && rings.includes('water')))
        .map((k) =>
          k === 'calories' ? (
            <MainCard key={k} />
          ) : k === 'water' ? (
            <WaterCard key={k} />
          ) : k === 'workout' ? (
            <View key={k}>
              <MissedCard />
              <WorkoutCard />
            </View>
          ) : k === 'readings' ? (
            <ReadingsCard key={k} />
          ) : k === 'streak' ? (
            <StreaksCard key={k} />
          ) : food.setupDone ? (
            <TipCard key={k} />
          ) : null,
        )}
      <Button title={t('Edit home')} icon="sliders" kind="glass" style={{ marginTop: 8 }} onPress={() => router.push('/customize')} />
      <InviteCodeSheet
        open={askCode}
        onDone={() => {
          setAskCode(false);
          router.setParams({ welcome: undefined });
          setTimeout(() => health.setCheckinOpen(true), 400);
        }}
      />
      {askCode ? null : <FreeMonthAlert />}
    </Screen>
  );
}

/** Coach application status for people who applied (design: coachAppCard). */
function CoachAppCard({ app }: { app: Application | null | undefined }) {
  const { t } = useT();
  const { colors: c } = useSettings();
  const { profile } = useAuth();
  const [, setCoachMode] = useCoachMode();
  if (app === undefined || !profile) return null;
  const st = profile.account_type === 'coach' ? profile.coach_status : app?.status === 'rejected' ? 'rejected' : null;
  if (st === 'approved')
    return (
      <Card style={{ backgroundColor: c.inset }}>
        <Row gap={12}>
          <Icon name="check" size={26} color={c.up} strokeWidth={2.6} />
          <View style={{ flex: 1 }}>
            <Text weight={700}>{t('You’re approved as a coach')}</Text>
            <Text variant="small" color="sec">
              {t('You can add clients and send them plans.')}
            </Text>
          </View>
        </Row>
        <Button title={t('Open coach view')} style={{ marginTop: 12 }} onPress={() => (setCoachMode(true), router.replace('/cclients'))} />
      </Card>
    );
  const card = (icon: IconName, title: string, sub: string, to: '/coachapp' | '/coachapply', blue?: boolean) => (
    <Card onPress={() => router.push(to)} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      <View style={{ width: 36, height: 36, borderRadius: 11, backgroundColor: blue ? c.cobalt : c.inset, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={icon} size={18} color={blue ? '#FFFFFF' : c.text} />
      </View>
      <View style={{ flex: 1 }}>
        <Text weight={700}>{title}</Text>
        <Text variant="small" color="sec">
          {sub}
        </Text>
      </View>
      <Icon name="chev" size={18} color={c.sec} />
    </Card>
  );
  if (st === 'pending')
    // Signed up as a coach but never sent the application: finish it.
    return app ? card('clock', t('Coach application under review'), t('Usually within 2 days. We’ll notify you.'), '/coachapp', true) : card('coach', t('Finish your coach application'), t('Tell us how you coach. It takes 2 minutes.'), '/coachapply', true);
  if (st === 'rejected') return card('info', t('Coach application not approved'), t('See why and apply again'), '/coachapp');
  return null;
}

/** Your coach: message, gym hours with Meet, and their plans (design: coachCardMember). */
function CoachCard({ k }: { k: MyCoach }) {
  const { t, lang } = useT();
  const { colors: c } = useSettings();
  const food = useFood();
  const [plans, setPlans] = useState<{ program: string | null; meals: string | null } | null>(null);
  useEffect(() => {
    let alive = true;
    myCoachPlans().then((p) => alive && setPlans({ program: p?.program?.name ?? null, meals: p?.meals?.name ?? null }));
    return () => {
      alive = false;
    };
  }, [k.id]);
  const name = k.name || k.username;
  const inPerson = k.coach_type !== 'Online' && k.hours?.length;
  return (
    <Card>
      <Row gap={12}>
        <Avatar id={k.coach_id} name={name} size={44} />
        <View style={{ flex: 1 }}>
          <Text variant="xs" weight={700} color="sec">
            {k.coach_type === 'Online' ? t('Your coach, online') : t('Your coach')}
          </Text>
          <Text weight={700}>{name}</Text>
        </View>
        <Button small kind="glass" icon="send" title={t('Message')} onPress={() => router.push({ pathname: '/thread', params: { link: k.id, name } })} />
      </Row>
      {inPerson ? (
        <Row gap={10} style={{ marginTop: 12, backgroundColor: c.inset, borderRadius: 14, paddingVertical: 10, paddingHorizontal: 12 }}>
          <Icon name="clock" size={18} color={c.cobalt} />
          <View style={{ flex: 1 }}>
            <Text variant="small" weight={700}>
              {k.gym ? t('At {g}', { g: k.gym }) : t('At the gym')}
            </Text>
            <Text variant="xs" color="sec">
              {hoursText(k.hours, t, lang)}
            </Text>
          </View>
          <Button small title={t('Meet')} onPress={() => router.push('/mycoach')} />
        </Row>
      ) : null}
      {plans?.program || plans?.meals ? (
        <View style={{ marginTop: 12, backgroundColor: c.inset, borderRadius: 16, overflow: 'hidden' }}>
          {plans.program ? (
            <Pressable onPress={() => router.push('/myprog')} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12 }}>
              <Icon name="train" size={18} />
              <View style={{ flex: 1 }}>
                <Text weight={700}>{plans.program}</Text>
                <Text variant="xs" color="sec">
                  {t('Workout program from your coach')}
                </Text>
              </View>
              <Icon name="chev" size={16} color={c.sec} />
            </Pressable>
          ) : null}
          {plans.meals ? (
            <Pressable onPress={() => router.push('/mymeals')} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12 }}>
              <Icon name="food" size={18} />
              <View style={{ flex: 1 }}>
                <Text weight={700}>{plans.meals}</Text>
                <Text variant="xs" color="sec">
                  {t('Meal plan from your coach')}
                </Text>
              </View>
              <Icon name="chev" size={16} color={c.sec} />
            </Pressable>
          ) : null}
        </View>
      ) : (
        <Text variant="small" color="sec" style={{ marginTop: 8 }}>
          {food.coachTargets ? t('Your calories and protein are set by {n}.', { n: name }) : t('Your coach can see your food, training and health, and can send you plans.')}
        </Text>
      )}
    </Card>
  );
}

function CheckinCard({ onStart }: { onStart: () => void }) {
  const { t } = useT();
  const { colors: c } = useSettings();
  return (
    <Card style={{ backgroundColor: c.cobalt, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      <Mark size={38} color="#FFFFFF" stroke={7} />
      <View style={{ flex: 1 }}>
        <Text variant="h3" color="#FFFFFF">
          {t('Morning check-in')}
        </Text>
        <Text variant="small" color="rgba(255,255,255,0.85)">
          {t('Weight, sleep and energy. Under 30 seconds.')}
        </Text>
      </View>
      <Springy onPress={onStart} style={{ height: 40, borderRadius: 20, paddingHorizontal: 14, backgroundColor: '#FFFFFF', justifyContent: 'center' }}>
        <Text weight={700} size={14} color="#0A0A0B">
          {t('Start')}
        </Text>
      </Springy>
    </Card>
  );
}

function CoachSetCard({ name }: { name: string }) {
  const { t } = useT();
  const { colors: c } = useSettings();
  return (
    <Card onPress={() => router.push('/mycoach')} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      <Icon name="coach" size={22} color={c.cobalt} />
      <Text variant="small" style={{ flex: 1 }}>
        {t('Your calories and protein are set by {n}.', { n: name })}
      </Text>
      <Icon name="chev" size={18} color={c.sec} />
    </Card>
  );
}

function SetupCard() {
  const { t } = useT();
  const { colors: c } = useSettings();
  return (
    <Card onPress={() => router.push('/food')} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: c.cobalt, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name="flame" size={22} color="#FFFFFF" strokeWidth={2} />
      </View>
      <View style={{ flex: 1 }}>
        <Text variant="h3">{t('Set your calories')}</Text>
        <Text variant="small" color="sec">
          {t('Answer a few questions and get your daily calories and meal plan.')}
        </Text>
      </View>
      <Icon name="chev" size={18} color={c.sec} />
    </Card>
  );
}

type Metric = { v: number; max: number; big: string; txt: string; go: () => void };
const RCOL = (c: { cobalt: string; up: string }) => [c.cobalt, c.up, '#F59E0B'];
const STEP_GOAL = 10000;

/** Every ring's value, goal and the screen it opens (design: metricOf). */
function useMetrics(): Record<RingKey, Metric> {
  const { t } = useT();
  const food = useFood();
  const train = useTrain();
  const s = useStreaks();
  const { r } = useRecovery();
  const e = food.eaten;
  const goal = food.dayGoal(food.today);
  const wGoal = food.plan.water || 2800;
  const planned = train.plan?.days ?? 0;
  const done = train.doneIdx.size;
  const c7 = s.c7.pct ?? 0;
  return {
    calories: { v: e.k, max: goal + food.burned, big: fmt(Math.max(0, food.kcalLeft)), txt: t('{n} kcal left', { n: fmt(Math.max(0, food.kcalLeft)) }), go: () => router.push('/food') },
    protein: { v: e.p, max: food.target.p, big: `${Math.round(e.p)}g`, txt: t('{a} of {b} g', { a: Math.round(e.p), b: food.target.p }), go: () => router.push('/food') },
    water: { v: food.water, max: wGoal, big: `${fx(food.water / 1000)}L`, txt: t('{a} of {b} ml', { a: fmt(food.water), b: fmt(wGoal) }), go: () => router.push('/water') },
    steps: { v: food.steps, max: STEP_GOAL, big: food.steps ? fmt(food.steps) : '--', txt: food.steps ? t('{a} of {b}', { a: fmt(food.steps), b: fmt(STEP_GOAL) }) : t('Connect a watch'), go: () => router.push('/devices') },
    recovery: { v: r.score, max: 100, big: `${r.score}%`, txt: t(recLabel(r.score)[0]), go: () => router.push('/recovery') },
    workouts: { v: done, max: Math.max(1, planned), big: `${done}/${planned}`, txt: t('{a} of {b} this week', { a: done, b: planned }), go: () => router.push('/train') },
    commit: { v: c7, max: 100, big: s.c7.pct == null ? '–' : `${c7}%`, txt: t('This week'), go: () => router.push({ pathname: '/progress', params: { tab: 'streaks' } }) },
  };
}

/** Round button on the main card that opens "Your rings" (design: ringSwitchBtn). */
function RingSwitch({ onPress }: { onPress: () => void }) {
  const { t } = useT();
  const { colors: c } = useSettings();
  return (
    <Pressable
      onPress={onPress}
      accessibilityLabel={t('Change what this ring shows')}
      hitSlop={6}
      style={{ position: 'absolute', top: 12, end: 12, zIndex: 2, width: 36, height: 36, borderRadius: 18, backgroundColor: c.inset, alignItems: 'center', justifyContent: 'center' }}>
      <Icon name="swap" size={16} strokeWidth={2.2} />
    </Pressable>
  );
}

/** The main card: calories, one other ring big, or up to 3 rings inside each other. */
function MainCard() {
  const food = useFood();
  const [layout] = useHomeLayout();
  const [pick, setPick] = useState(false);
  const rs = layout.rings;
  const sw = <RingSwitch onPress={() => setPick(true)} />;
  return (
    <>
      {rs.length > 1 ? <RingsCard sw={sw} /> : rs[0] && rs[0] !== 'calories' ? <HeroCard k={rs[0]} sw={sw} /> : food.setupDone ? <CaloriesCard sw={sw} /> : <SetupCard />}
      <RingPickSheet open={pick} onClose={() => setPick(false)} />
    </>
  );
}

/** Up to 3 rings inside each other, with a row per ring that opens its screen (design: ringsCard). */
function RingsCard({ sw }: { sw: React.ReactNode }) {
  const { t } = useT();
  const { colors: c } = useSettings();
  const [layout] = useHomeLayout();
  const m = useMetrics();
  const cols = RCOL(c);
  const rs = layout.rings;
  const nest = (i: number): React.ReactNode =>
    i >= rs.length ? null : (
      <Ring value={m[rs[i]].v} max={m[rs[i]].max} size={160 - i * 38} stroke={15} color={cols[i]}>
        {nest(i + 1)}
      </Ring>
    );
  return (
    <Card style={{ padding: 20 }}>
      {sw}
      <Row gap={16}>
        {nest(0)}
        <View style={{ flex: 1, minWidth: 0, paddingEnd: 26 }}>
          {rs.map((k, i) => (
            <Pressable key={k} onPress={m[k].go} accessibilityRole="button" style={{ marginTop: i ? 14 : 0 }}>
              <Row gap={6}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: cols[i] }} />
                <Text variant="xs" weight={700} color={cols[i]}>
                  {t(RING_NAMES[k])}
                </Text>
              </Row>
              <Text num size={20} style={{ lineHeight: 24 }}>
                {m[k].big}
              </Text>
              <Text variant="xs" color="sec" numberOfLines={1}>
                {m[k].txt}
              </Text>
            </Pressable>
          ))}
        </View>
      </Row>
    </Card>
  );
}

/** One ring big, for anything but calories (design: heroCard). */
function HeroCard({ k, sw }: { k: RingKey; sw: React.ReactNode }) {
  const { t } = useT();
  const { colors: c } = useSettings();
  const toast = useToast();
  const food = useFood();
  const train = useTrain();
  const s = useStreaks();
  const { r } = useRecovery();
  const m = useMetrics()[k];
  const wGoal = food.plan.water || 2800;
  let big = m.big;
  let unit = '';
  let color = c.cobalt;
  let stats: [string, string][] = [];
  let action: React.ReactNode = null;
  const addWater = async (ml: number) => {
    await food.addWater(ml);
    toast(t('Added {n} ml water', { n: ml }), { icon: 'drop' });
  };
  if (k === 'protein') {
    big = String(Math.max(0, Math.round(food.target.p - food.eaten.p)));
    unit = t('g protein left');
    stats = [
      [`${Math.round(food.eaten.p)} g`, t('Eaten')],
      [`${food.target.p} g`, t('Goal')],
      [String(food.logs.length), t('Meals logged')],
    ];
    action = <Button small kind="glass" icon="plus" title={t('Log food')} style={{ marginTop: 12, alignSelf: 'center' }} onPress={() => food.setLogOpen(true)} />;
  } else if (k === 'water') {
    big = fmt(food.water);
    unit = t('of {n} ml', { n: fmt(wGoal) });
    stats = [
      [fmt(Math.max(0, wGoal - food.water)), t('ml left')],
      [String(food.waterLogs.length), t('Drinks')],
      [`${Math.round((food.water / wGoal) * 100)}%`, t('Done')],
    ];
    action = (
      <Row gap={8} style={{ marginTop: 12, justifyContent: 'center' }}>
        <Button small kind="glass" title={t('+ {n} ml', { n: 250 })} onPress={() => addWater(250)} />
        <Button small kind="glass" title={t('+ {n} ml', { n: 500 })} onPress={() => addWater(500)} />
      </Row>
    );
  } else if (k === 'steps') {
    unit = t('steps today');
    stats = [
      [fmt(STEP_GOAL), t('Goal')],
      [food.steps ? fmt(Math.max(0, STEP_GOAL - food.steps)) : '--', t('To go')],
      [food.steps ? `${fx(food.steps * 0.00075)} km` : '--', t('Distance')],
    ];
    if (!food.steps) action = <Button small title={t('Connect a watch')} style={{ marginTop: 12, alignSelf: 'center' }} onPress={() => router.push('/devices')} />;
  } else if (k === 'recovery') {
    unit = t('recovered');
    color = r.score >= 60 ? c.cobalt : c.down;
    stats = [
      [r.sleepH != null ? `${fx(r.sleepH)} h` : '–', t('Sleep')],
      [`${fx(r.acwr)}×`, t('Training load')],
      [`${r.parts[4].value}%`, t('Nutrition')],
    ];
    action = (
      <Text variant="small" weight={700} center style={{ marginTop: 12 }}>
        {t(recLabel(r.score)[0])}
      </Text>
    );
  } else if (k === 'workouts') {
    unit = t('workouts this week');
    stats = [
      [String(train.streak), t('In a row')],
      [train.todayName ? t(train.todayName) : t('Rest'), t('Today')],
      [String(Math.max(0, (train.plan?.days ?? 0) - train.doneIdx.size)), t('To go')],
    ];
    if (train.todayName && !train.todayLog) action = <Button small title={t('Start {w} day', { w: t(train.todayName) })} style={{ marginTop: 12, alignSelf: 'center' }} onPress={() => router.push('/train')} />;
  } else if (k === 'commit') {
    unit = t('commitment this week');
    const p = s.c7.parts;
    stats = [
      [`${p.work[0]}/${p.work[1]}`, t('Workouts')],
      [`${p.cal[0]}/${p.cal[1]}`, t('Calories')],
      [`${p.prot[0]}/${p.prot[1]}`, t('Protein')],
    ];
  }
  return (
    <Card onPress={m.go} style={{ alignItems: 'center', padding: 22 }}>
      {sw}
      <Ring value={m.v} max={m.max} size={180} stroke={16} color={color}>
        <View style={{ alignItems: 'center' }}>
          <Text num size={big.length > 5 ? 34 : 44} style={{ letterSpacing: -1.2 }}>
            {big}
          </Text>
          <Text variant="small" weight={700} color="sec">
            {unit}
          </Text>
        </View>
      </Ring>
      <Row style={{ marginTop: 16, alignSelf: 'stretch', justifyContent: 'space-around' }}>
        {stats.map(([a, b]) => (
          <View key={b} style={{ alignItems: 'center', flex: 1 }}>
            <Text num size={17} numberOfLines={1}>
              {a}
            </Text>
            <Text variant="xs" weight={700} color="sec">
              {b}
            </Text>
          </View>
        ))}
      </Row>
      {action}
    </Card>
  );
}

/** "Your rings": pick up to 3, change the order, remove (design: SH.ringpick). */
function RingPickSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useT();
  const { colors: c } = useSettings();
  const toast = useToast();
  const [l, save] = useHomeLayout();
  const sel = l.rings;
  const cols = RCOL(c);
  const rest = RINGS.filter((k) => !sel.includes(k));
  const set = (rings: RingKey[]) => save({ ...l, rings });
  const tog = (k: RingKey) => {
    if (sel.includes(k)) {
      if (sel.length === 1) return toast(t('Keep at least one ring'), { icon: 'info' });
      return set(sel.filter((x) => x !== k));
    }
    if (sel.length >= 3) return toast(t('You can show 3 rings. Remove one first.'), { icon: 'info' });
    set([...sel, k]);
  };
  const up = (i: number) => {
    if (!i) return;
    const a = [...sel];
    [a[i - 1], a[i]] = [a[i], a[i - 1]];
    set(a);
  };
  return (
    <Sheet open={open} onClose={onClose}>
      <Text variant="h2">{t('Your rings')}</Text>
      <Text variant="small" weight={700} style={{ marginTop: 8 }}>
        {t('{n} of 3 picked', { n: sel.length })}
      </Text>
      <Text variant="xs" color="sec" style={{ marginTop: 2, marginBottom: 12 }}>
        {sel.length === 1 ? t('One ring shows big on Home.') : t('They show inside each other. Number 1 is the outside ring.')}
      </Text>
      <View style={{ backgroundColor: c.card, borderRadius: 22, overflow: 'hidden', marginBottom: 12 }}>
        {[0, 1, 2].map((i) => {
          const k = sel[i];
          if (!k)
            return (
              <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 52, paddingHorizontal: 16, opacity: 0.7 }}>
                <View style={{ width: 26, height: 26, borderRadius: 13, borderWidth: 2, borderStyle: 'dashed', borderColor: c.line, alignItems: 'center', justifyContent: 'center' }}>
                  <Text variant="xs" weight={700} color="sec">{`${i + 1}`}</Text>
                </View>
                <Text variant="small" color="sec">
                  {i === sel.length ? t('Empty. Pick one below to add it.') : t('Empty')}
                </Text>
              </View>
            );
          return (
            <View key={k} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 52, paddingHorizontal: 16 }}>
              <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: cols[i], alignItems: 'center', justifyContent: 'center' }}>
                <Text variant="xs" weight={700} color="#FFFFFF">{`${i + 1}`}</Text>
              </View>
              <Icon name={RING_INFO[k].icon} size={16} />
              <Text weight={700} style={{ flex: 1 }}>
                {t(RING_NAMES[k])}
              </Text>
              <Pressable onPress={() => up(i)} disabled={!i} accessibilityLabel={t('Move up')} style={{ width: 32, height: 32, alignItems: 'center', justifyContent: 'center', opacity: i ? 1 : 0.3 }}>
                <Icon name="up" size={14} strokeWidth={2.2} />
              </Pressable>
              <Pressable onPress={() => tog(k)} disabled={sel.length < 2} accessibilityLabel={t('Remove {x}', { x: t(RING_NAMES[k]) })} style={{ width: 32, height: 32, alignItems: 'center', justifyContent: 'center', opacity: sel.length > 1 ? 1 : 0.3 }}>
                <Icon name="close" size={14} color={c.sec} strokeWidth={2.2} />
              </Pressable>
            </View>
          );
        })}
      </View>
      <Text variant="small" weight={700} color="sec" style={{ marginBottom: 8, marginHorizontal: 4 }}>
        {sel.length < 3 ? t('Add a ring') : t('All 3 picked. Remove one to add another.')}
      </Text>
      <View style={{ backgroundColor: c.card, borderRadius: 22, overflow: 'hidden', marginBottom: 12 }}>
        {rest.map((k) => (
          <Pressable key={k} onPress={() => tog(k)} disabled={sel.length >= 3} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56, paddingHorizontal: 16, paddingVertical: 8, opacity: sel.length >= 3 ? 0.45 : 1 }}>
            <Icon name={RING_INFO[k].icon} size={16} />
            <View style={{ flex: 1 }}>
              <Text weight={700}>{t(RING_NAMES[k])}</Text>
              <Text variant="xs" color="sec">
                {t(RING_INFO[k].desc)}
              </Text>
            </View>
            <Icon name="plus" size={18} color={c.cobalt} strokeWidth={2.4} />
          </Pressable>
        ))}
      </View>
      <Button title={t('Done')} onPress={onClose} />
    </Sheet>
  );
}

function CaloriesCard({ sw }: { sw: React.ReactNode }) {
  const { t } = useT();
  const { colors: c } = useSettings();
  const food = useFood();
  const e = food.eaten;
  const goal = food.dayGoal(food.today);
  const left = food.kcalLeft;
  const over = left < 0;
  return (
    <Card onPress={() => router.push('/food')} style={{ paddingTop: 22 }}>
      {sw}
      <View style={{ alignItems: 'center' }}>
        <Ring value={e.k} max={goal + food.burned} size={196} stroke={18} color={over ? c.down : c.cobalt}>
          <View style={{ alignItems: 'center' }}>
            <Text num size={46} style={{ letterSpacing: -1.2, lineHeight: 50 }}>
              {fmt(Math.abs(left))}
            </Text>
            <Text variant="small" weight={700} color="sec" style={{ marginTop: 2 }}>
              {t(over ? 'kcal over' : 'kcal left')}
            </Text>
          </View>
        </Ring>
      </View>
      <Row style={{ justifyContent: 'space-around', marginVertical: 16, paddingHorizontal: 10 }}>
        {(
          [
            ['Eaten', e.k],
            ['Goal', goal],
            ['Burned', food.burned],
          ] as const
        ).map(([label, v]) => (
          <View key={label} style={{ alignItems: 'center' }}>
            <Text num size={17}>
              {fmt(v)}
            </Text>
            <Text variant="xs" weight={700} color="sec">
              {t(label)}
            </Text>
          </View>
        ))}
      </Row>
      <MacroBars />
    </Card>
  );
}

function WaterCard() {
  const { t } = useT();
  const { colors: c } = useSettings();
  const toast = useToast();
  const food = useFood();
  const goal = food.plan.water || 2800;
  // Long press on + : type your own amount.
  const [custom, setCustom] = useState<string | null>(null);
  const amount = Number((custom ?? '').replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))).replace(/\D/g, '')) || 0;
  const add = async (ml: number) => {
    await food.addWater(ml);
    toast(t('Added {n} ml water', { n: fmt(ml) }), { icon: 'drop' });
  };
  return (
    <>
      <Card onPress={() => router.push('/water')} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Ring value={food.water} max={goal} size={64} stroke={7}>
          <Icon name="drop" size={22} color={c.cobalt} strokeWidth={2} />
        </Ring>
        <View style={{ flex: 1 }}>
          <Text variant="small" weight={700} color="sec">
            {t('Water')}
          </Text>
          <Text num size={22}>
            {fmt(food.water)}
            <Text num size={15} weight={500} color="sec">{` / ${fmt(goal)} ${t('ml')}`}</Text>
          </Text>
        </View>
        <Springy
          onPress={() => add(250)}
          onLongPress={() => setCustom('')}
          delayLongPress={400}
          scaleTo={1.08}
          accessibilityLabel={t('Add 250 ml water')}
          accessibilityHint={t('Press and hold to type an amount')}
          style={Platform.OS === 'web' ? ({ userSelect: 'none', WebkitUserSelect: 'none', WebkitTouchCallout: 'none' } as object) : undefined}>
          <Glass style={{ width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="plus" size={24} strokeWidth={2.2} />
          </Glass>
        </Springy>
      </Card>
      <Sheet open={custom !== null} onClose={() => setCustom(null)}>
        <Text variant="h2">{t('Add water')}</Text>
        <Field label={t('Amount')} value={custom ?? ''} onChangeText={(v) => setCustom(v.replace(/[^\d٠-٩]/g, '').slice(0, 4))} placeholder="330" unit={t('ml')} keyboardType="number-pad" ltr autoFocus />
        <Row gap={8} style={{ marginTop: 10, flexWrap: 'wrap' }}>
          {[150, 330, 500, 750, 1000].map((n) => (
            <Button key={n} small kind="soft" title={t('{n} ml', { n: fmt(n) })} onPress={() => setCustom(String(n))} />
          ))}
        </Row>
        <Button
          title={amount ? t('Add {n} ml', { n: fmt(amount) }) : t('Add')}
          disabled={amount < 10 || amount > 3000}
          style={{ marginTop: 16 }}
          onPress={async () => {
            setCustom(null);
            await add(amount);
          }}
        />
        {amount > 3000 ? (
          <Text variant="xs" color="down" style={{ marginTop: 6 }}>
            {t('That’s a lot at once. Add up to 3,000 ml.')}
          </Text>
        ) : null}
      </Sheet>
    </>
  );
}

function ReadingsCard() {
  const { t } = useT();
  const { colors: c } = useSettings();
  const food = useFood();
  const health = useHealth();
  const w = health.weights.at(-1);
  const sl = [...health.checkins].reverse().find((x) => x.sleep_h != null);
  const items: [IconName, string, string][] = [
    ['walk', fmt(food.steps), t('Steps')],
    ['scale', w ? `${fx(w.value)}` : '–', t('kg')],
    ['moon', sl ? `${fx(sl.sleep_h as number)}` : '–', t('h sleep')],
  ];
  return (
    <Card onPress={() => router.push('/devices')}>
      <Row style={{ justifyContent: 'space-between', marginBottom: 12 }}>
        <Text weight={700}>{t('Your readings')}</Text>
        <Icon name="chev" size={18} color={c.sec} />
      </Row>
      <Row gap={8}>
        {items.map(([i, v, l]) => (
          <View key={l} style={{ flex: 1, backgroundColor: c.inset, borderRadius: 16, padding: 12 }}>
            <Icon name={i} size={18} color={c.cobalt} />
            <Text num size={18} style={{ marginTop: 6 }}>
              {v}
            </Text>
            <Text variant="xs" weight={700} color="sec">
              {l}
            </Text>
          </View>
        ))}
      </Row>
    </Card>
  );
}

function StreaksCard() {
  const { t } = useT();
  const { colors: c } = useSettings();
  const s = useStreaks();
  const box = (key: string, v: number, max: number, icon: IconName, value: string, label: string) => (
    <View key={key} style={{ flex: 1, backgroundColor: c.inset, borderRadius: 16, paddingVertical: 12, paddingHorizontal: 4, alignItems: 'center' }}>
      <Ring value={v} max={max} size={46} stroke={5}>
        <Icon name={icon} size={17} color={c.cobalt} strokeWidth={2} />
      </Ring>
      <Text num size={18} style={{ marginTop: 8 }}>
        {value}
      </Text>
      <Text variant="xs" weight={700} color="sec" center style={{ lineHeight: 15 }}>
        {label}
      </Text>
    </View>
  );
  return (
    <Card onPress={() => router.push({ pathname: '/progress', params: { tab: 'streaks' } })}>
      <Row style={{ justifyContent: 'space-between', marginBottom: 12 }}>
        <Text weight={700}>{t('Streaks')}</Text>
        <Icon name="chev" size={18} color={c.sec} />
      </Row>
      <Row gap={8}>
        {box('o', s.overall, s.best, 'flame', t('{n} days', { n: s.overall }), t('Overall'))}
        {box('w', s.workouts, s.bestWorkouts, 'train', String(s.workouts), t('Workouts in a row'))}
        {box('c', s.commitment ?? 0, 100, 'check', s.commitment == null ? '–' : `${s.commitment}%`, t('Commitment'))}
      </Row>
    </Card>
  );
}

function TipCard() {
  const { t } = useT();
  const { colors: c } = useSettings();
  const { eaten, target, kcalLeft } = useFood();
  const left = Math.round(target.p - eaten.p);
  const tip =
    kcalLeft < 0
      ? t('You went over today. No stress: a walk tonight or a lighter dinner tomorrow evens it out.')
      : left > 25
        ? t('You still need {n} g of protein. A cup of Greek yogurt after training covers most of it.', { n: left })
        : left > 0
          ? t('Only {n} g of protein left. A glass of laban or two eggs will finish it.', { n: left })
          : t('Protein done for today. Nice work.');
  return (
    <Card onPress={() => router.push('/coach')} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
      <Mark size={26} color={c.cobalt} stroke={5} />
      <View style={{ flex: 1 }}>
        <Text variant="small" weight={700} color="sec">
          {t('Coach tip')}
        </Text>
        <Text weight={600} style={{ marginTop: 4 }}>
          {tip}
        </Text>
      </View>
    </Card>
  );
}
