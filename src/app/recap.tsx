import { router } from 'expo-router';
import { Children, type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Easing, Pressable, ScrollView, type StyleProp, useWindowDimensions, View, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Defs, RadialGradient, Rect, Stop } from 'react-native-svg';

import { Icon, type IconName } from '@/components/Icon';
import { Text } from '@/components/Text';
import { useToast } from '@/components/Toast';
import { Button, Springy } from '@/components/ui';
import { useT } from '@/i18n';
import { weekdayLetter } from '@/lib/dates';
import { useAuth } from '@/lib/auth';
import { applyPlanChanges, applyTargets, applyUndo, changeLine, undoPatch } from '@/lib/coachPlan';
import { useCycleCoach } from '@/lib/cyclePhase';
import { goalsOn } from '@/lib/dayGoals';
import { useFood } from '@/lib/food';
import { addDays, fmt } from '@/lib/nutrition';
import { fx } from '@/lib/progress';
import { balanceMoves, moveDay, remindersSummary, weekDays, withReminder } from '@/lib/recapApply';
import { firstRecapDay, type Goal, hasRecap, markRecapSeen, REMINDER_NAME, recapDays, recapGoals, type RecapAI, recapRow, type RecapUndo, recapUndo, recapWeek, saveRecap, type Suggestion, writeRecap } from '@/lib/recap';
import { useReportData, useReportStats } from '@/lib/report';
import { loadPrefs, type Prefs, savePrefs } from '@/lib/reminders';
import { useTrain } from '@/lib/train';
import { goBack } from '@/lib/nav';
import { exInfo, type TrainPlan } from '@/lib/training';
import { useWeight } from '@/lib/units';

// The story is always dark, like a story on any phone.
const K = { bg: '#07080D', card2: '#10131D', card: 'rgba(255,255,255,0.08)', line: 'rgba(255,255,255,0.12)', text: '#F5F6FA', sec: '#A3A8B8', cobalt: '#3355FF', up: '#22C55E', down: '#F05252', amber: '#F5B83D' };
const DUR = 6500;
type Slide = { key: string; tint: string; waits?: boolean };

/** Last week as a story: training, food, body, the result, tips from the AI, and changes you can apply (design: docs/recap-sample.html). */
export default function Recap() {
  const { t, lang } = useT();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const { profile, session } = useAuth();
  const uid = session?.user.id;
  const food = useFood();
  const train = useTrain();
  const { start, end } = recapWeek(food.today);
  const data = useReportData(start, end);
  const stats = useReportStats(start, end, data);
  const beforeData = useReportData(addDays(start, -7), addDays(start, -1));
  const before = useReportStats(addDays(start, -7), addDays(start, -1), beforeData);
  const plan = train.setupDone ? train.plan : null;
  const goals = useMemo(() => (stats ? recapGoals(stats, food.plan.goal, !!plan) : []), [stats, food.plan.goal, plan]);
  const allHit = goals.length > 0 && goals.every((g) => g.ok);
  const days = data ? recapDays(plan, data.logs, start) : null;

  // The AI part: written once per week (and language), then kept.
  const [ai, setAi] = useState<RecapAI | null>(null);
  const [aiState, setAiState] = useState<'loading' | 'ready' | 'failed'>('loading');
  const [applied, setApplied] = useState<number[] | null>(null);
  // What Undo puts back (kept with this week's recap, so it works until the next one).
  const [undo, setUndo] = useState<RecapUndo | null>(null);
  const applying = useRef(false);
  const asked = useRef(false);
  // Joined during or after that week: no recap yet (it would be all zeros).
  const tooNew = !!session && !hasRecap(session.user.created_at, start);
  // Women: wait for the cycle data (pregnancy keeps the AI's suggestions safe).
  const cycRaw = useCycleCoach();
  const cyc = profile?.gender === 'female' ? cycRaw : null;
  const cycWait = profile?.gender === 'female' && !cycRaw;
  useEffect(() => {
    // Waits for the week before too, so the comparison is always there.
    if (!stats || !before || cycWait || asked.current || tooNew) return;
    asked.current = true;
    (async () => {
      const row = await recapRow(start).catch(() => null);
      if (!row) markRecapSeen(start, lang).catch(() => {});
      if (row?.applied) {
        setApplied(row.applied);
        recapUndo(start).then((u) => u && setUndo(u)).catch(() => {});
      }
      // Same language, or you already applied some of it (then it stays as you saw it).
      if (row?.ai && (row.lang === lang || row.applied)) {
        setAi(row.ai);
        return setAiState('ready');
      }
      const out = await writeRecap({
        stats,
        before,
        goals,
        plan,
        goal: stats.goal,
        targets: food.setupDone ? { kcal: Math.round(food.target.k), protein: Math.round(food.target.p), water: food.plan.water } : null,
        coachFood: !!food.coachTargets,
        lang,
        // Each day with its own calorie goal, and watch sleep on nights without a check-in.
        days: data ? weekDays(start, data, days).map((d) => ({ ...d, sleepH: d.sleepH ?? (data.watchSleep[d.day] != null ? Math.round(data.watchSleep[d.day] * 10) / 10 : null), kcalGoal: food.setupDone ? Math.round((goalsOn(data.goals, d.day)?.kcal ?? food.target.k) + (data.kcalExtra[d.day] ?? 0)) : null })) : [],
        reminders: uid ? remindersSummary(await loadPrefs(uid).catch(() => null)) : undefined,
        savedMeals: food.saved.map((m) => m.name).slice(0, 30),
        allergies: food.plan.allergies,
        allergyNote: food.plan.allergyNote,
        // Pregnancy and the cycle phase, never from cycle data kept only on this phone.
        ...(cyc && !cyc.anon ? { pregnancy: cyc.preg, phase: cyc.cycle?.phase ?? null } : {}),
      }).catch(() => null);
      if (!out) return setAiState('failed');
      setAi(out);
      setAiState('ready');
      saveRecap(start, { ai: out, lang }).catch(() => {});
    })();
  }, [stats, tooNew, before, goals, plan, food, lang, start, data, days, uid, cyc, cycWait]);

  const slides: Slide[] = useMemo(() => {
    if (!stats) return [];
    const s: Slide[] = [{ key: 'intro', tint: allHit ? '#1b2a8a' : '#2b2140' }];
    if (plan || stats.workouts.done) s.push({ key: 'train', tint: allHit ? '#123a2a' : '#2a1d3a' });
    if (food.setupDone && stats.logged.cal[1]) s.push({ key: 'food', tint: '#2a1f5c' });
    if (stats.weight || stats.sleepAvg != null) s.push({ key: 'body', tint: '#16304d' });
    s.push(allHit ? { key: 'party', tint: '#3a2a08' } : { key: 'why', tint: '#3a2a1a' });
    s.push({ key: 'tips', tint: '#1b2a8a' });
    s.push({ key: 'apply', tint: '#101a55', waits: true });
    return s;
  }, [stats, allHit, plan, food.setupDone]);

  const [i, setI] = useState(0);
  const [progress] = useState(() => new Animated.Value(0));
  // Where the bar is, so a pause can resume from there.
  const pos = useRef(0);
  useEffect(() => {
    const id = progress.addListener(({ value }) => (pos.current = value));
    return () => progress.removeListener(id);
  }, [progress]);
  const held = useRef(false);
  const cur = slides[i];
  const waiting = !!cur && (cur.waits || ((cur.key === 'why' || cur.key === 'tips') && aiState === 'loading'));
  const close = () => (router.canGoBack() ? router.back() : router.replace('/(tabs)/home'));
  const go = (d: number) => {
    const n = i + d;
    if (n < 0) return setI(0);
    if (n >= slides.length) return close();
    setI(n);
  };

  // Each slide moves on by itself; the last one and the AI ones while they load wait for you.
  const run = (from: number) => {
    if (waiting || held.current) return;
    Animated.timing(progress, { toValue: 1, duration: DUR * (1 - from), easing: Easing.linear, useNativeDriver: false }).start(({ finished }) => finished && go(1));
  };
  useEffect(() => {
    progress.stopAnimation();
    progress.setValue(waiting ? 1 : 0);
    run(0);
    return () => progress.stopAnimation();
    // Restart for each slide, and when the AI part arrives.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i, waiting, slides.length]);
  const hold = () => {
    held.current = true;
    progress.stopAnimation();
  };
  const release = () => {
    held.current = false;
    run(pos.current);
  };

  const name = (profile?.name ?? '').split(' ')[0];
  if (tooNew && session) {
    const first = new Intl.DateTimeFormat(lang === 'ar' ? 'ar-u-nu-latn' : 'en-US', { weekday: 'long', month: 'short', day: 'numeric' }).format(new Date(`${firstRecapDay(session.user.created_at)}T12:00:00`));
    return (
      <View style={{ flex: 1, backgroundColor: K.bg, alignItems: 'center', justifyContent: 'center', padding: 32 }}>
        <Text variant="h2" center style={{ color: K.text }}>
          {t('Your first recap comes on {day}', { day: first })}
        </Text>
        <Text center style={{ color: K.sec, marginTop: 8 }}>
          {t('It covers a whole week in Adro, so keep logging this week.')}
        </Text>
        <Button title={t('Close')} style={{ marginTop: 24, alignSelf: 'stretch' }} onPress={() => (goBack())} />
      </View>
    );
  }
  if (!stats || !cur)
    return (
      <View style={{ flex: 1, backgroundColor: K.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={K.text} />
      </View>
    );

  return (
    <View style={{ flex: 1, backgroundColor: K.bg, paddingTop: insets.top + 8, paddingBottom: insets.bottom + 12 }}>
      <View style={{ flex: 1, marginHorizontal: 10, borderRadius: 28, overflow: 'hidden', backgroundColor: K.card2, borderWidth: 1, borderColor: K.line }}>
        <Glow tint={cur.tint} />
        {/* Progress, one bar per slide. */}
        <View style={{ flexDirection: 'row', gap: 4, paddingHorizontal: 12, paddingTop: 12 }}>
          {slides.map((s, j) => (
            <View key={s.key} style={{ flex: 1, height: 3, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.25)', overflow: 'hidden' }}>
              <Animated.View style={{ height: 3, backgroundColor: K.text, width: j < i ? '100%' : j > i ? '0%' : progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) }} />
            </View>
          ))}
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingTop: 12 }}>
          <View style={{ width: 28, height: 28, borderRadius: 9, backgroundColor: K.cobalt, alignItems: 'center', justifyContent: 'center' }}>
            <Text num weight={700} color="#FFFFFF" size={14}>
              G
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text variant="small" weight={700} color={K.text}>
              {t('Your week')}
            </Text>
            <Text variant="xs" color={K.sec}>
              {rangeLabel(start, end, lang)}
            </Text>
          </View>
          <Springy onPress={close} accessibilityLabel={t('Close')} style={{ width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: K.card }}>
            <Icon name="close" size={18} color={K.text} />
          </Springy>
        </View>

        {/* Tap the sides to move; press and hold to pause. The slide's buttons sit above the tap zones. */}
        <View style={{ flex: 1 }}>
          <ScrollView key={cur.key} style={{ flex: 1 }} contentContainerStyle={{ padding: 22, paddingTop: 20, gap: 14, flexGrow: 1 }}>
            <SlideBody
              k={cur.key}
              t={t}
              lang={lang}
              name={name}
              allHit={allHit}
              goals={goals}
              stats={stats}
              before={before}
              days={days}
              ai={ai}
              aiState={aiState}
              targets={{ k: stats.calorieGoal ?? food.target.k, p: stats.proteinGoal ?? food.target.p, w: food.plan.water || 2800 }}
              applied={applied}
              plan={plan}
              onApply={async (picked) => {
                // Once only: a second tap waits, and applied suggestions are never applied again.
                if (applying.current || applied) return;
                applying.current = true;
                try {
                  const sug = ai?.suggest ?? [];
                  let planNext = plan;
                  let foodNext = food.plan;
                  const moves: { day: string; kcal: number }[] = [];
                  const changes: Extract<Suggestion, { type: 'plan' }>['changes'] = [];
                  let moved = false;
                  for (const j of picked) {
                    const s = sug[j];
                    if (s?.type === 'plan' && planNext) {
                      planNext = applyPlanChanges(planNext, s.changes, food.today);
                      changes.push(...s.changes);
                    }
                    if (s?.type === 'move' && planNext) moved = true;
                    if (s?.type === 'targets' && !food.coachTargets) foodNext = applyTargets(foodNext, s, food.pregKcal);
                    if (s?.type === 'move' && planNext) planNext = moveDay(planNext, s.from, s.to, food.today);
                    if (s?.type === 'balance') moves.push(...balanceMoves(s, food.today));
                  }
                  // The food targets first: if they can't be saved, nothing else is applied (so trying again is safe).
                  if (foodNext !== food.plan && !(await food.savePlan(foodNext))) return toast(t('Couldn’t save. Please try again.'), { icon: 'warn' });
                  setApplied(picked);
                  saveRecap(start, { applied: picked }).catch(() => {});
                  // For Undo: only what these suggestions touch, taken from before.
                  const u: RecapUndo = { at: new Date().toISOString() };
                  if (foodNext !== food.plan) u.food = { kcal: food.plan.kcal, perKg: food.plan.perKg, carbG: food.plan.carbG, water: food.plan.water };
                  // The plan just got its weekly check, so the automatic one waits a week.
                  if (plan && planNext && planNext !== plan) {
                    const patch: Partial<TrainPlan> = { ...undoPatch(plan, changes), reviewedAt: plan.reviewedAt };
                    if (moved) Object.assign(patch, { week: plan.week, override: plan.override, overrides: plan.overrides, weekSince: plan.weekSince, days: plan.days, queue: plan.queue });
                    u.train = patch;
                    train.updatePlan({ ...planNext, reviewedAt: food.today });
                  }
                  if (moves.length) {
                    const added = await food.addMoves(moves);
                    u.moveGrps = [...new Set(added.map((m) => m.grp).filter((g): g is string => !!g))];
                  }
                  for (const j of picked) {
                    const s = sug[j];
                    if (s?.type === 'meal') {
                      const m = await food.saveMeal({ name: s.name, items: null, ingredients: null, kcal: s.kcal, protein: s.protein, carbs: s.carbs, fat: s.fat });
                      if (m) u.meals = [...(u.meals ?? []), m.id];
                    }
                    if (s?.type === 'reminder' && uid) {
                      const prefs = await loadPrefs(uid);
                      u.prefs ??= prefs;
                      await savePrefs(uid, withReminder(prefs, s.kind, s.time));
                    }
                  }
                  setUndo(u);
                  // On its own: an older database without the column still keeps what was applied.
                  saveRecap(start, { undo: u }).catch(() => {});
                  toast(t(picked.length ? 'Your plan is updated' : 'Nothing changed'), { ai: true });
                } finally {
                  applying.current = false;
                }
              }}
              onUndo={
                applied?.length && undo
                  ? async () => {
                      if (applying.current) return;
                      applying.current = true;
                      try {
                        if (undo.food && !(await food.savePlan({ ...food.plan, ...undo.food }))) return toast(t('Couldn’t save. Please try again.'), { icon: 'warn' });
                        if (undo.train && train.plan) train.updatePlan(applyUndo(train.plan, undo.train));
                        if (undo.moveGrps?.length) await food.removeMoves([], undo.moveGrps);
                        for (const id of undo.meals ?? []) await food.deleteMeal(id);
                        if (undo.prefs && uid) await savePrefs(uid, undo.prefs as Prefs);
                        setUndo(null);
                        setApplied(null);
                        saveRecap(start, { applied: null }).catch(() => {});
                        saveRecap(start, { undo: null }).catch(() => {});
                        toast(t('Changed back'), { icon: 'check' });
                      } finally {
                        applying.current = false;
                      }
                    }
                  : undefined
              }
              onDone={close}
            />
          </ScrollView>
          {/* Tap the sides to move; press and hold to pause. The last slide has its own buttons instead. */}
          {cur.waits ? null : (
            <View style={{ position: 'absolute', inset: 0, flexDirection: 'row' }}>
              <Pressable style={{ flex: 1 }} onPress={() => go(-1)} onPressIn={hold} onPressOut={release} accessibilityLabel={t('Back')} />
              <Pressable style={{ flex: 2 }} onPress={() => go(1)} onPressIn={hold} onPressOut={release} accessibilityLabel={t('Next')} />
            </View>
          )}
        </View>
      </View>
    </View>
  );
}

const rangeLabel = (a: string, b: string, lang: 'en' | 'ar') => {
  const f = new Intl.DateTimeFormat(lang === 'ar' ? 'ar-u-nu-latn' : 'en-US', { month: 'short', day: 'numeric' });
  return `${f.format(new Date(`${a}T12:00:00`))} – ${f.format(new Date(`${b}T12:00:00`))}`;
};

type T = (s: string, v?: Record<string, string | number>) => string;
type BodyProps = {
  k: string;
  t: T;
  lang: 'en' | 'ar';
  name: string;
  allHit: boolean;
  goals: Goal[];
  stats: NonNullable<ReturnType<typeof useReportStats>>;
  before: ReturnType<typeof useReportStats>;
  days: ('ok' | 'miss' | 'rest')[] | null;
  ai: RecapAI | null;
  aiState: 'loading' | 'ready' | 'failed';
  targets: { k: number; p: number; w: number };
  applied: number[] | null;
  plan: ReturnType<typeof useTrain>['plan'] | null;
  onApply: (picked: number[]) => Promise<unknown>;
  /** Put back what applying changed (while this is the latest recap). */
  onUndo?: () => Promise<unknown>;
  onDone: () => void;
};

function Eyebrow({ children }: { children: string }) {
  return (
    <Text variant="xs" weight={700} color={K.sec} style={{ letterSpacing: 0.6, textTransform: 'uppercase' }}>
      {children}
    </Text>
  );
}
function H({ children, big }: { children: string; big?: boolean }) {
  return (
    <Text weight={700} color={K.text} size={big ? 32 : 25}>
      {children}
    </Text>
  );
}
function Card({ children }: { children: React.ReactNode }) {
  return <View style={{ backgroundColor: K.card, borderWidth: 1, borderColor: K.line, borderRadius: 20, padding: 14, gap: 10 }}>{children}</View>;
}
function Pill({ tone, children }: { tone: 'up' | 'down' | 'amber'; children: string }) {
  const c = K[tone];
  return (
    <View style={{ paddingVertical: 5, paddingHorizontal: 10, borderRadius: 999, backgroundColor: `${c}29` }}>
      <Text variant="xs" weight={700} color={c}>
        {children}
      </Text>
    </View>
  );
}
function RowKV({ k, v, tone, tag }: { k: string; v: string; tone?: 'up' | 'down' | 'amber'; tag?: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text variant="small" color={K.sec}>
          {k}
        </Text>
        <Text weight={700} color={K.text}>
          {v}
        </Text>
      </View>
      {tone && tag ? <Pill tone={tone}>{tag}</Pill> : null}
    </View>
  );
}
function Meter({ label, value, pct }: { label: string; value: string; pct: number }) {
  const color = pct > 110 ? K.down : pct < 80 ? K.amber : K.up;
  return (
    <View style={{ gap: 6 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text variant="small" color={K.sec}>
          {label}
        </Text>
        <Text variant="small" weight={700} color={K.text}>
          {value}
        </Text>
      </View>
      <View style={{ height: 8, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.1)', overflow: 'hidden' }}>
        <View style={{ height: 8, borderRadius: 8, width: `${Math.max(3, Math.min(100, pct))}%`, backgroundColor: color }} />
      </View>
    </View>
  );
}
function Note({ icon, title, detail }: { icon: IconName; title: string; detail?: string }) {
  return (
    <View style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start', backgroundColor: K.card, borderWidth: 1, borderColor: K.line, borderRadius: 18, padding: 12 }}>
      <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: 'rgba(51,85,255,0.22)', alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={icon} size={17} color="#B9C4FF" />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text weight={700} color={K.text}>
          {title}
        </Text>
        {detail ? (
          <Text variant="small" color={K.sec}>
            {detail}
          </Text>
        ) : null}
      </View>
    </View>
  );
}
function AiTag({ t, label }: { t: T; label: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <Icon name="sparkle" size={14} color="#B9C4FF" />
      <Text variant="xs" weight={700} color="#B9C4FF">
        {t(label)}
      </Text>
    </View>
  );
}
function Thinking({ t, failed }: { t: T; failed: boolean }) {
  return (
    <View style={{ alignItems: 'center', gap: 10, paddingVertical: 30 }}>
      {failed ? <Icon name="warn" size={24} color={K.sec} /> : <ActivityIndicator color={K.text} />}
      <Text variant="small" color={K.sec} center>
        {t(failed ? 'Adro AI couldn’t read your week right now. Your numbers are above.' : 'Adro AI is reading your week…')}
      </Text>
    </View>
  );
}
function StoryButton({ title, onPress, kind = 'primary', loading }: { title: string; onPress: () => void; kind?: 'primary' | 'ghost' | 'done'; loading?: boolean }) {
  const bg = kind === 'primary' ? K.text : kind === 'done' ? K.up : 'transparent';
  const fg = kind === 'primary' ? K.bg : kind === 'done' ? '#04210F' : K.sec;
  return (
    <Springy onPress={onPress} style={{ height: 52, borderRadius: 26, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}>
      {loading ? <ActivityIndicator color={fg} /> : <Text weight={700} color={fg}>{title}</Text>}
    </Springy>
  );
}

/** Sunday-first weekday letters (S M T… or ح ن ث…). */
const dayLetter = weekdayLetter;

function SlideBody(p: BodyProps) {
  // Weights in your unit (kg or lb); saved numbers are always kg.
  const W = useWeight();
  const { lang } = useT();
  const { t, stats: s, ai } = p;
  const pctChange = (a: number, b: number | undefined | null) => (b ? Math.round(((a - b) / b) * 100) : null);
  if (p.k === 'intro')
    return (
      <Stack style={{ gap: 14 }} pointerEvents="none">
        <Eyebrow>{t('Your weekly recap')}</Eyebrow>
        <H big>{ai?.headline || t(p.allHit ? 'A strong week, {n} 💪' : 'Let’s look at your week, {n}', { n: p.name || t('champ') })}</H>
        <Text color={K.sec}>{t(p.allHit ? 'Here’s what you did last week.' : 'Here’s what happened last week, and what to change so next week goes better.')}</Text>
      </Stack>
    );
  if (p.k === 'train') {
    const w = s.workouts;
    const vol = pctChange(s.volume, p.before?.volume);
    const missed = (p.days ?? []).filter((d) => d === 'miss').length;
    return (
      <Stack style={{ gap: 14 }} pointerEvents="none">
        <Eyebrow>{t('Training')}</Eyebrow>
        <H>{w.planned ? (w.asPlanned >= w.planned ? t('You didn’t miss a single workout') : t('You trained {a} times out of {b}', { a: w.asPlanned, b: w.planned })) : t('{n} workouts this week', { n: w.done })}</H>
        <Text num size={64} weight={700} color={K.text} style={{ letterSpacing: -1.5 }}>
          {String(w.planned ? w.asPlanned : w.done)}
          {w.planned ? (
            <Text size={22} weight={600} color={K.sec}>
              {`  ${t('of {n}', { n: w.planned })}`}
            </Text>
          ) : null}
        </Text>
        {p.days ? (
          <Card>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              {p.days.map((d, j) => (
                <View key={j} style={{ alignItems: 'center', gap: 5 }}>
                  <View style={{ width: 32, height: 32, borderRadius: 16, borderWidth: 2, borderStyle: d === 'rest' ? 'dashed' : 'solid', borderColor: d === 'ok' ? K.up : d === 'miss' ? K.down : K.line, alignItems: 'center', justifyContent: 'center' }}>
                    <Text variant="small" weight={700} color={d === 'miss' ? K.down : d === 'ok' ? K.text : K.sec}>
                      {d === 'ok' ? '✓' : d === 'miss' ? '✕' : '–'}
                    </Text>
                  </View>
                  <Text variant="xs" color={K.sec}>
                    {dayLetter(j, p.lang)}
                  </Text>
                </View>
              ))}
            </View>
          </Card>
        ) : null}
        <Card>
          <RowKV k={t('Training volume')} v={`${fmt(W.num(s.volume))} ${W.label}`} tone={vol == null ? undefined : vol >= 0 ? 'up' : 'down'} tag={vol == null ? undefined : `${vol >= 0 ? '↑' : '↓'} ${Math.abs(vol)}%`} />
          {s.liftUps[0] ? <RowKV k={t('Best lift up')} v={`${exInfo({ id: s.liftUps[0].id, n: s.liftUps[0].name }, lang).name} ${W.show(s.liftUps[0].to)} ${W.label}`} tone="up" tag={`+${W.show(s.liftUps[0].to - s.liftUps[0].from)} ${W.label}`} /> : null}
          {missed ? <RowKV k={t('Missed')} v={(p.days ?? []).map((d, j) => (d === 'miss' ? t(['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][j]) : null)).filter(Boolean).join(t(', '))} tone="down" tag={t('{n} missed', { n: missed })} /> : null}
        </Card>
      </Stack>
    );
  }
  if (p.k === 'food') {
    // Out of the days you logged food (and water).
    const [hit, n] = s.logged.cal;
    const [ph, pn] = s.logged.prot;
    const [wh, wn] = s.logged.water;
    return (
      <Stack style={{ gap: 14 }} pointerEvents="none">
        <Eyebrow>{t('Food')}</Eyebrow>
        <H>{t('On target {a} days out of {b}', { a: hit, b: n })}</H>
        <Card>
          {s.caloriesAvg != null ? <Meter label={t('Calories, daily average')} value={`${fmt(s.caloriesAvg)} / ${fmt(p.targets.k)}`} pct={(s.caloriesAvg / p.targets.k) * 100} /> : null}
          {pn ? <Meter label={t('Protein goal')} value={t('{a} of {b} days', { a: ph, b: pn })} pct={(ph / pn) * 100} /> : null}
          {wn ? <Meter label={t('Water goal')} value={t('{a} of {b} days', { a: wh, b: wn })} pct={(wh / wn) * 100} /> : null}
        </Card>
      </Stack>
    );
  }
  if (p.k === 'body') {
    const g = p.goals.find((x) => x.key === 'weight');
    return (
      <Stack style={{ gap: 14 }} pointerEvents="none">
        <Eyebrow>{t('Body and sleep')}</Eyebrow>
        <H>{s.weight ? (s.weight.change === 0 ? t('Your weight held steady') : W.words(t(s.weight.change > 0 ? 'Up {n} kg this week' : 'Down {n} kg this week', { n: W.show(Math.abs(s.weight.change)) }))) : t('Your sleep this week')}</H>
        <Card>
          {s.weight ? <RowKV k={t('Weight')} v={`${W.show(s.weight.first)} → ${W.show(s.weight.last)} ${W.label}`} tone={g ? (g.ok ? 'up' : 'down') : undefined} tag={g ? t(g.ok ? 'On plan' : 'Off plan') : undefined} /> : null}
          {s.sleepAvg != null ? <RowKV k={t('Average sleep')} v={`${fx(s.sleepAvg)} ${t('h')}`} tone={s.sleepAvg >= 7 ? 'up' : s.sleepAvg >= 6 ? 'amber' : 'down'} tag={t(s.sleepAvg >= 7 ? 'Great' : s.sleepAvg >= 6 ? 'Fair' : 'Low')} /> : null}
          {s.waistChange != null ? <RowKV k={t('Waist')} v={`${s.waistChange > 0 ? '+' : ''}${fx(s.waistChange)} ${t('cm')}`} /> : null}
        </Card>
      </Stack>
    );
  }
  if (p.k === 'party')
    return (
      <Stack style={{ gap: 14 }} pointerEvents="none">
        <Confetti />
        <Eyebrow>{t('The result')}</Eyebrow>
        <H big>{t('You hit {a} of {b} goals 🎉', { a: p.goals.length, b: p.goals.length })}</H>
        <GoalRing hit={p.goals.filter((g) => g.ok).length} of={p.goals.length} />
        {(ai?.wins ?? []).map((w, j) => (
          <Note key={j} icon="check" title={w} />
        ))}
      </Stack>
    );
  if (p.k === 'why')
    return (
      <Stack style={{ gap: 14 }} pointerEvents="none">
        <Eyebrow>{t('What got in the way')}</Eyebrow>
        <AiTag t={t} label="Adro AI reading" />
        <H>{p.goals.length ? t('You hit {a} of {b} goals', { a: p.goals.filter((g) => g.ok).length, b: p.goals.length }) : t('Not enough was logged last week to score your goals')}</H>
        <Goals t={t} goals={p.goals} />
        {p.aiState !== 'ready' ? <Thinking t={t} failed={p.aiState === 'failed'} /> : (ai?.problems ?? []).map((n, j) => <Note key={j} icon={(['cal', 'food', 'moon'] as const)[j % 3]} title={n.title} detail={n.detail} />)}
      </Stack>
    );
  if (p.k === 'tips')
    return (
      <Stack style={{ gap: 14 }} pointerEvents="none">
        <Eyebrow>{t(p.allHit ? 'Keep it going' : 'How to get there')}</Eyebrow>
        <AiTag t={t} label="Adro AI suggestions" />
        <H>{t(p.allHit ? 'What could get you even better results' : 'What will help next week')}</H>
        {p.aiState !== 'ready' ? <Thinking t={t} failed={p.aiState === 'failed'} /> : (ai?.tips ?? []).map((n, j) => <Note key={j} icon={(['train', 'food', 'up'] as const)[j % 3]} title={n.title} detail={n.detail} />)}
      </Stack>
    );
  return <ApplySlide {...p} />;
}

function Goals({ t, goals }: { t: T; goals: Goal[] }) {
  const W = useWeight();
  const label = { train: 'Workouts as planned', food: 'Calories on target', protein: 'Protein goal', water: 'Water goal', sleep: 'Sleep, 7 h or more', weight: 'Weight on plan' } as const;
  const value = (g: Goal) => (g.key === 'weight' ? `${Number(g.done) > 0 ? '+' : ''}${W.show(Number(g.done))} ${W.label}` : g.key === 'sleep' ? `${g.done} ${t('h')}` : g.key === 'train' ? `${g.done}/${g.target}` : t('{a} of {b} days', { a: g.done, b: g.target }));
  if (!goals.length) return null;
  return (
    <Card>
      {goals.map((g) => (
        <RowKV key={g.key} k={t(label[g.key])} v={value(g)} tone={g.ok ? 'up' : 'down'} tag={g.ok ? '✓' : '✕'} />
      ))}
    </Card>
  );
}

function ApplySlide(p: BodyProps) {
  const { t, ai } = p;
  const sug: Suggestion[] = ai?.suggest ?? [];
  const [picked, setPicked] = useState<number[]>(() => sug.map((_, j) => j));
  const [busy, setBusy] = useState(false);
  const done = p.applied != null;
  const day = (d: number) => new Intl.DateTimeFormat(p.lang === 'ar' ? 'ar-u-nu-latn' : 'en-US', { weekday: 'long' }).format(new Date(2026, 9, 4 + d, 12));
  const lines = (s: Suggestion): string[] => {
    if (s.type === 'plan') return s.changes.map((c) => changeLine(c, p.plan ?? null, p.lang, t));
    if (s.type === 'targets') return [s.kcal ? t('Calories: {n} kcal', { n: fmt(s.kcal) }) : null, s.protein ? t('Protein: {n} g', { n: s.protein }) : null, s.water ? t('Water: {n} ml', { n: fmt(s.water) }) : null].filter((x): x is string => !!x);
    if (s.type === 'move') return [t('{w}: {a} → {b}', { w: t(s.workout ?? p.plan?.week[s.from]?.w ?? ''), a: day(s.from), b: day(s.to) })];
    if (s.type === 'reminder') return [t('Reminder: {x} at {time}', { x: t(REMINDER_NAME[s.kind]), time: s.time })];
    if (s.type === 'meal') return [s.name, t('{k} kcal · {p} g protein', { k: fmt(s.kcal), p: s.protein })];
    return [t('{n} kcal less on {a}, more on {b}', { n: s.kcal, a: s.from.map(day).join(t(', ')), b: s.to.map(day).join(t(', ')) })];
  };
  const KIND_TITLE = { plan: 'Training plan', targets: 'Food targets', move: 'Move a workout', reminder: 'Reminder', meal: 'Save a meal', balance: 'Balance your week' } as const;
  // Suggestions that arrive after this slide opened start ticked too.
  const [seenCount, setSeenCount] = useState(sug.length);
  if (sug.length !== seenCount) {
    setSeenCount(sug.length);
    setPicked(sug.map((_, j) => j));
  }
  return (
    <View style={{ gap: 14, flex: 1 }}>
      <Eyebrow>{t(sug.length ? 'Want me to apply them?' : 'See you next week')}</Eyebrow>
      {sug.length ? <AiTag t={t} label="Adro AI suggestions" /> : null}
      <H>{p.aiState === 'loading' ? t('Adro AI is reading your week…') : sug.length ? t('Pick what to apply to your plan') : t(p.allHit ? 'Keep doing what you’re doing' : 'Small steps, every day')}</H>
      {p.aiState === 'loading' ? <Thinking t={t} failed={false} /> : null}
      {sug.map((s, j) => {
        const on = done ? (p.applied ?? []).includes(j) : picked.includes(j);
        return (
          <Springy
            key={j}
            disabled={done}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: on }}
            onPress={() => setPicked(on ? picked.filter((x) => x !== j) : [...picked, j])}
            style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start', borderRadius: 18, padding: 12, borderWidth: 1, borderColor: on ? K.cobalt : K.line, backgroundColor: on ? 'rgba(51,85,255,0.18)' : K.card }}>
            <View style={{ width: 22, height: 22, borderRadius: 7, marginTop: 2, borderWidth: 2, borderColor: on ? K.cobalt : K.sec, backgroundColor: on ? K.cobalt : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
              {on ? <Icon name="check" size={13} color="#FFFFFF" strokeWidth={3} /> : null}
            </View>
            <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
              <Text weight={700} color={K.text}>
                {s.title || t(KIND_TITLE[s.type])}
              </Text>
              {lines(s).map((l, k) => (
                <Text key={k} variant="small" color={K.sec}>
                  {l}
                </Text>
              ))}
            </View>
          </Springy>
        );
      })}
      <View style={{ flex: 1 }} />
      {sug.length ? (
        done ? (
          <>
            <StoryButton kind="done" title={t('Applied ✓ Your plan is updated')} onPress={p.onDone} />
            {p.onUndo ? (
              <StoryButton
                kind="ghost"
                title={t('Undo')}
                loading={busy}
                onPress={async () => {
                  setBusy(true);
                  await p.onUndo?.();
                  setBusy(false);
                }}
              />
            ) : null}
          </>
        ) : (
          <>
            <StoryButton
              title={t('Apply what I picked')}
              loading={busy}
              onPress={async () => {
                setBusy(true);
                await p.onApply(picked);
                setBusy(false);
              }}
            />
            <StoryButton kind="ghost" title={t('Not now')} onPress={p.onDone} />
          </>
        )
      ) : (
        <StoryButton title={t('Done')} onPress={p.onDone} />
      )}
    </View>
  );
}

const COLORS = ['#3355FF', '#22C55E', '#F5B83D', '#F05252', '#FFFFFF', '#A78BFA'];
/** A burst of confetti for a week that hit every goal. */
function Confetti() {
  const { width, height } = useWindowDimensions();
  const [fall] = useState(() => new Animated.Value(0));
  const [bits] = useState(() =>
    Array.from({ length: 40 }, (_, i) => ({ x: Math.random(), drift: (Math.random() - 0.5) * 140, spin: (Math.random() - 0.5) * 1200, delay: Math.random() * 0.3, w: 6 + Math.random() * 5, h: 9 + Math.random() * 7, color: COLORS[i % COLORS.length] })),
  );
  useEffect(() => {
    Animated.timing(fall, { toValue: 1, duration: 2600, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
  }, [fall]);
  return (
    <View pointerEvents="none" style={{ position: 'absolute', top: -60, left: -22, width, height }}>
      {bits.map((b, j) => (
        <Animated.View
          key={j}
          style={{
            position: 'absolute',
            left: b.x * width,
            width: b.w,
            height: b.h,
            borderRadius: 2,
            backgroundColor: b.color,
            opacity: fall.interpolate({ inputRange: [0, 0.85, 1], outputRange: [1, 1, 0] }),
            transform: [
              { translateY: fall.interpolate({ inputRange: [0, b.delay, 1], outputRange: [0, 0, height * (0.7 + b.x * 0.3)] }) },
              { translateX: fall.interpolate({ inputRange: [0, 1], outputRange: [0, b.drift] }) },
              { rotate: fall.interpolate({ inputRange: [0, 1], outputRange: ['0deg', `${b.spin}deg`] }) },
            ],
          }}
        />
      ))}
    </View>
  );
}

/** The slide's colour glowing down from the top (design: radial gradient, 120% wide and 70% tall, centred at the top). */
function Glow({ tint }: { tint: string }) {
  const [size, setSize] = useState({ w: 0, h: 0 });
  const { w, h } = size;
  return (
    <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} onLayout={(e) => setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}>
      {w && h ? (
        <Svg width={w} height={h}>
          <Defs>
            {/* A circle of radius 70% of the height, stretched sideways to 120% of the width. */}
            <RadialGradient id="glow" gradientUnits="userSpaceOnUse" cx={w / 2} cy={0} r={0.7 * h} fx={w / 2} fy={0} gradientTransform={`translate(${w / 2} 0) scale(${(1.2 * w) / (0.7 * h)} 1) translate(${-w / 2} 0)`}>
              <Stop offset="0" stopColor={tint} stopOpacity={1} />
              <Stop offset="0.72" stopColor={K.card2} stopOpacity={1} />
              <Stop offset="1" stopColor={K.card2} stopOpacity={1} />
            </RadialGradient>
          </Defs>
          <Rect x={0} y={0} width={w} height={h} fill="url(#glow)" />
        </Svg>
      ) : null}
    </View>
  );
}

/** Goals hit as a ring (3/3 closes it). */
function GoalRing({ hit, of }: { hit: number; of: number }) {
  const r = 52;
  const len = 2 * Math.PI * r;
  return (
    <View style={{ width: 150, height: 150, alignSelf: 'center', alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={150} height={150} viewBox="0 0 120 120" style={{ position: 'absolute', transform: [{ rotate: '-90deg' }] }}>
        <Circle cx={60} cy={60} r={r} stroke="rgba(255,255,255,0.12)" strokeWidth={12} fill="none" />
        <Circle cx={60} cy={60} r={r} stroke={K.up} strokeWidth={12} fill="none" strokeLinecap="round" strokeDasharray={`${len}`} strokeDashoffset={len * (1 - (of ? hit / of : 0))} />
      </Svg>
      <Text num size={52} weight={700} color={K.text}>
        {String(hit)}
        <Text num size={20} weight={600} color={K.sec}>{`/${of}`}</Text>
      </Text>
    </View>
  );
}

/** A slide's lines, rising in one after another (design: .slide.in > *). */
function Stack({ style, pointerEvents, children }: { style?: StyleProp<ViewStyle>; pointerEvents?: 'none' | 'auto'; children: ReactNode }) {
  const items = Children.toArray(children);
  const [anims] = useState(() => items.map(() => new Animated.Value(0)));
  useEffect(() => {
    Animated.stagger(80, anims.map((a) => Animated.timing(a, { toValue: 1, duration: 550, easing: Easing.bezier(0.2, 0.8, 0.2, 1), useNativeDriver: true }))).start();
  }, [anims]);
  return (
    <View style={style} pointerEvents={pointerEvents}>
      {items.map((c, j) => {
        const a = anims[j] ?? anims[anims.length - 1];
        return (
          <Animated.View key={j} style={a ? { opacity: a, transform: [{ translateY: a.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }] } : undefined}>
            {c}
          </Animated.View>
        );
      })}
    </View>
  );
}
