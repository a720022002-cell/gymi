import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ScrollView, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Thinking } from '@/components/food/Thinking';
import { ChatCard } from '@/components/health/ChatCard';
import { Glass } from '@/components/Glass';
import { Icon, type IconName, Mark } from '@/components/Icon';
import { Screen } from '@/components/Screen';
import { fontFor, Text } from '@/components/Text';
import { useToast } from '@/components/Toast';
import { Sheet } from '@/components/Sheet';
import { Button, Row, Springy } from '@/components/ui';
import { useT } from '@/i18n';
import { type CaffeineAlert, caffeineCheck, caffeineOf, caffeineToday, showCaffeineAlert } from '@/lib/caffeine';
import { aiErrorText, askAI } from '@/lib/ai';
import { useAuth } from '@/lib/auth';
import { useRecovery } from '@/components/train/RecoveryCard';
import { type ChatAction, type ChatMsg, cleanCard, groupChats, guessCard, loadChats, loadMemory, newId, saveMemory, saveMsg, updateActions } from '@/lib/coach';
import { useCycleCoach } from '@/lib/cyclePhase';
import { deviceBrief, useDevices } from '@/lib/devices';
import { useFood } from '@/lib/food';
import { flaggedMarkers, healthFoodTips } from '@/lib/bloodFood';
import { MEAS, useHealth } from '@/lib/health';
import { last7, useSupplementLogs } from '@/lib/supplementLogs';
import { addDays, fmt, GOALS, localDay } from '@/lib/nutrition';
import { daysBetween } from '@/lib/report';
import { fx, goalsFor, weekAvg } from '@/lib/progress';
import { supabase } from '@/lib/supabase';
import { useTrain } from '@/lib/train';
import { useCardioWeek } from '@/lib/useCardioWeek';
import { useKeyboardHeight } from '@/lib/useKeyboard';
import { sessionLine } from '@/lib/cardioPlan';
import { useWeight } from '@/lib/units';
import { useStreaks } from '@/lib/useProgress';
import { allergensIn, allergiesText, noteHit } from '@/lib/allergies';
import { REMINDER_NAME } from '@/lib/recap';
import { remindersSummary, withReminder } from '@/lib/recapApply';
import { loadPrefs, type Prefs, savePrefs } from '@/lib/reminders';
import { CARDIO, cardioKcal, DAYS_LONG, effectiveWeek, exInfo, type TrainPlan, weekdayOf, weekStart } from '@/lib/training';
import { applyPlanChanges, applyTargets, applyUndo, changeLine, isWholePlan, prepareSuggestions, undoPatch } from '@/lib/coachPlan';
import { useSettings } from '@/theme/settings';

type Suggestion = Extract<ChatAction, { type: 'plan' } | { type: 'targets' } | { type: 'reminder' }>;
const isSuggestion = (a: ChatAction): a is Suggestion => a.type === 'plan' || a.type === 'targets' || a.type === 'reminder';
type Logged = Exclude<ChatAction, Suggestion>;

const PROMPTS = ['I ate chicken and rice', 'I slept 7 hours', 'How’s my progress?', 'What should I eat for dinner?', 'I drank 500 ml of water', 'I walked 30 minutes'];
const r1 = (n: number) => Math.round(n * 10) / 10;

/** Chat with the AI coach. It can log food, cardio, water, sleep and weight for you, and remembers you between chats (design: chat). */
export default function Coach() {
  const { t, lang } = useT();
  const W = useWeight();
  const { colors: c, exUnits } = useSettings();
  const insets = useSafeAreaInsets();
  const kb = useKeyboardHeight();
  const toast = useToast();
  const { profile, session } = useAuth();
  const food = useFood();
  const train = useTrain();
  const health = useHealth();
  const supLogs = useSupplementLogs(food.today);
  const streaks = useStreaks();
  const { r: rec } = useRecovery();
  const cw = useCardioWeek();
  // Cycle data kept only on this phone (private mode) is never sent to the AI.
  const cyc = useCycleCoach();
  const cycle = cyc && !cyc.anon ? cyc.cycle : null;
  const preg = cyc && !cyc.anon ? cyc.preg : null;
  // A weight from the chat that's far from your last weigh-in is logged only after you say so.
  const [weightAsk, setWeightAsk] = useState<{ kg: number; last: number; done: (ok: boolean) => void } | null>(null);
  const askWeight = (kg: number, last: number) => new Promise<boolean>((done) => setWeightAsk({ kg, last, done }));
  const devices = useDevices(session?.user.id);
  const [memory, setMemory] = useState('');
  const { chat, ask } = useLocalSearchParams<{ chat?: string; ask?: string }>();
  const [all, setAll] = useState<ChatMsg[] | null>(null);
  const [chatId, setChatId] = useState<string>(() => chat ?? newId());
  const [text, setText] = useState(ask ?? '');
  const [thinking, setThinking] = useState(false);
  const [prefs, setPrefs] = useState<Prefs | null>(null);
  const scroll = useRef<ScrollView>(null);
  // The newest message stays in view when the keyboard opens.
  useEffect(() => {
    if (kb) setTimeout(() => scroll.current?.scrollToEnd({ animated: true }), 50);
  }, [kb]);

  useEffect(() => {
    let live = true;
    loadMemory().then((m) => live && setMemory(m));
    if (session) loadPrefs(session.user.id).then((p) => live && setPrefs(p)).catch(() => {});
    loadChats().then((m) => {
      if (!live) return;
      setAll(m);
      // Open the latest chat when it's from today; otherwise start fresh.
      if (!chat && !ask) {
        const g = groupChats(m)[0];
        if (g && localDay(new Date(g.last)) === localDay()) setChatId(g.id);
      }
    });
    return () => {
      live = false;
    };
  }, [chat, ask, session]);

  const msgs = (all ?? []).filter((m) => m.chat_id === chatId);
  // A long chat shows its last 40 messages; older ones on tap (so it opens fast).
  const [olderFor, setOlderFor] = useState<{ chat: typeof chatId; n: number }>({ chat: chatId, n: 0 });
  const older = olderFor.chat === chatId ? olderFor.n : 0;
  const shownCount = 40 + older;
  const earlier = Math.max(0, msgs.length - shownCount);
  const title = msgs.find((m) => m.role === 'user')?.text ?? t('New chat');

  useEffect(() => {
    setTimeout(() => scroll.current?.scrollToEnd({ animated: true }), 50);
  }, [msgs.length, thinking]);

  /**
   * Everything the coach should know: today, the last week, trends, targets, cycle and watch data. The server keeps
   * the first 20,000 characters, so what must never be cut goes first, the watch data last, and it's made to fit here
   * (the watch's 14 days trimmed to the key numbers, then dropped) so the plan, blood tests and supplements stay in.
   */
  const context = () => {
    const c = fullContext();
    const { foodAllergies, coachManagesFood, coachTargets, pregnancy, devices: dv, ...rest } = c;
    const LIMIT = 19000;
    const first = { foodAllergies, coachManagesFood, coachTargets, pregnancy, ...rest };
    const fits = (d: unknown) => JSON.stringify({ ...first, devices: d }).length <= LIMIT;
    const KEY = ['day', 'source', 'sleep_h', 'hrv', 'hr_rest', 'recovery', 'steps', 'workouts'];
    let d: typeof dv | { trimmed: string } | null = dv && { ...dv, last14Days: dv.last14Days.map((x) => Object.fromEntries(Object.entries(x).filter(([k]) => KEY.includes(k)))) };
    if (d && 'last14Days' in d && !fits(d)) d = { ...d, last14Days: [] };
    if (d && !fits(d)) d = { trimmed: 'watch data left out: too much data' };
    if (!fits(d)) {
      // Still too long: older workouts and the 14-day plan list are the first to go.
      first.workoutsLast30Days = first.workoutsLast30Days.slice(0, 8);
      if (first.trainingPlan) first.trainingPlan = { ...first.trainingPlan, next14Days: first.trainingPlan.next14Days.slice(0, 7) };
    }
    return { ...first, devices: d };
  };
  const fullContext = () => {
    const today = food.today;
    // Today's food, even when the Food tab is on another day.
    const td = health.days[today];
    const eatenKcal = food.isToday ? food.eaten.k : (td?.k ?? 0);
    const week = Array.from({ length: 7 }, (_, i) => addDays(today, i - 6));
    const ci = new Map(health.checkins.map((x) => [x.day, x]));
    const weekly = Array.from({ length: 8 }, (_, i) => {
      const end = addDays(today, -7 * (7 - i));
      const v = weekAvg(health.weights, end);
      return v == null ? null : { weekEnding: end, avgKg: r1(v) };
    }).filter(Boolean);
    const part = (k: 'cal' | 'prot' | 'water' | 'work' | 'sleep') => {
      const [a, b] = streaks.c7.parts[k];
      return b ? `${a} of ${b} days` : null;
    };
    return {
      name: profile?.name ?? '',
      gender: profile?.gender ?? null,
      language: lang,
      today,
      todayWeekday: DAYS_LONG[weekdayOf(today)],
      time: new Date().toTimeString().slice(0, 5),
      weightKg: health.weights.at(-1)?.value ?? food.plan.weight,
      // The unit the person sees and types weights in (weights in this data are always kg).
      weightUnit: W.unit,
      // Exercises the person switched to kg or lb on the workout screen (by exercise id): use that unit for their weights.
      exerciseWeightUnits: Object.keys(exUnits).length ? exUnits : undefined,
      pregnancy: preg ? { stage: preg.mode === 'preg' ? 'pregnant' : 'after birth', week: preg.week } : null,
      weightWeeklyAverages: weekly,
      goal: food.setupDone ? GOALS[food.plan.goal] : 'not set up',
      caloriesGoal: food.setupDone ? food.dayGoal(today) : null,
      // Today's numbers (cardio burned today is known only while the Food tab shows today).
      caloriesLeft: food.setupDone ? Math.round(food.dayGoal(today) + (food.isToday ? food.burned : 0) - eatenKcal) : null,
      eatenToday: food.isToday
        ? { kcal: Math.round(food.eaten.k), protein: Math.round(food.eaten.p), carbs: Math.round(food.eaten.c), fat: Math.round(food.eaten.f) }
        : { kcal: Math.round(td?.k ?? 0), protein: Math.round(td?.p ?? 0), carbs: null, fat: null },
      targets: food.setupDone ? food.target : null,
      coachTargets: food.coachTargets ? { kcal: food.coachTargets.kcal, protein: food.coachTargets.protein, coach: food.coachTargets.name } : null,
      foodLoggedToday: food.isToday ? food.logs.map((l) => l.name).slice(-10) : null,
      burnedByCardio: food.isToday ? food.burned : null,
      waterMl: food.isToday ? food.water : Math.round(td?.w ?? 0),
      waterGoalMl: food.plan.water,
      last7Days: week.map((d) => {
        const c = ci.get(d);
        const f = health.days[d];
        // Today's recovery is the same score as "recoveryToday".
        return { day: d, sleepH: c?.sleep_h ?? null, energy: c?.energy == null ? null : ['tired', 'normal', 'great'][c.energy], soreness: c?.sore == null ? null : ['none', 'a little', 'very sore'][c.sore], recovery: d === today ? rec.score : (c?.score ?? null), kcal: f ? Math.round(f.k) : null, protein: f ? Math.round(f.p) : null };
      }),
      recoveryToday: rec.score,
      // Last night's sleep (what you logged, or your watch) and what pulls recovery down.
      sleepLastNightH: rec.sleepH ?? null,
      recoveryParts: Object.fromEntries(rec.parts.map((p) => [p.key, p.value])),
      todayWorkoutLighter: !!train.plan && train.plan.light === today,
      last7DaysAdherence: { caloriesOnTarget: part('cal'), proteinGoal: part('prot'), waterGoal: part('water'), workoutsAsPlanned: part('work'), sleep7hPlus: part('sleep') },
      commitment30DaysPercent: streaks.commitment,
      streakDays: streaks.overall,
      todayWorkout: train.setupDone ? (train.todayName ?? 'rest day') : 'no training plan yet',
      workoutDoneToday: !!train.todayLog,
      workoutsThisWeek: { done: train.doneIdx.size, planned: train.week.filter((d) => d.w).length },
      workoutsLast7Days: train.logs.filter((l) => l.day >= week[0]).map((l) => `${l.name} (${l.day}, ${l.minutes} min)`),
      cycle: cycle ? { day: cycle.day, phase: cycle.phase, nextPeriod: cycle.next, late: cycle.late } : null,
      // Watch, ring or band (Apple Health, Health Connect, WHOOP, Oura): usual numbers, last night, what stands out, 14 days.
      devices: deviceBrief(devices.days, today, { luteal: cycle?.phase === 'Luteal' }),
      stepsToday: food.isToday ? food.steps : null,
      checkinToday: health.todayCheckin
        ? {
            sleepH: health.todayCheckin.sleep_h,
            energy: health.todayCheckin.energy == null ? null : ['tired', 'normal', 'great'][health.todayCheckin.energy],
            soreness: health.todayCheckin.sore == null ? null : ['none', 'a little', 'very sore'][health.todayCheckin.sore],
            recovery: rec.score,
          }
        : null,
      // The whole training plan, so the coach can suggest changes to it (exercise ids are what suggestions use).
      trainingPlan: train.plan
        ? {
            split: train.plan.split,
            daysPerWeek: train.plan.days,
            injuries: train.plan.injuries,
            schedule: train.week.map((d, i) => `${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][i]}: ${d.w ?? 'rest'}`),
            deloadThisWeek: train.plan.deload === weekStart(today),
            // The next 2 weeks day by day, with days off you already set ("break").
            next14Days: Array.from({ length: 14 }, (_, i) => {
              const d = addDays(today, i);
              const w = effectiveWeek(train.plan!, weekStart(d))[weekdayOf(d)]?.w ?? null;
              return `${d} ${DAYS_LONG[weekdayOf(d)]}: ${w ? (train.plan!.skipped[d] ? `break (was ${w})` : w) : 'rest'}`;
            }),
            workouts: Object.fromEntries(
              Object.entries(train.plan.workouts).map(([k, w]) => [k, w.ex.map((x) => ({ id: x.id, name: exInfo(x, 'en').name, sets: x.sets, reps: x.reps, bestKg: train.best[x.id] ?? null }))]),
            ),
            // The weekly cardio plan (null: none yet; they can add one in the Train tab or weekly plan). Missing cardio
            // never breaks the workout streak.
            cardioPlan: cw.plan
              ? {
                  goal: cw.plan.goal,
                  sport: cw.plan.sport,
                  sessionsPerWeek: cw.plan.per,
                  // Sports they play on fixed days (count toward the week; classic cardio fills the rest).
                  sportsTheyPlay: (cw.plan.play ?? []).map((x) => `${x.sport} ${x.days.length}x a week (${x.days.map((d) => DAYS_LONG[d]).join(', ')}), ${x.min} min`),
                  minutesThisWeek: cw.summary.minutes,
                  doneThisWeek: `${cw.doneCount} of ${cw.sessions.length}`,
                  buildingUp: !!cw.plan.ramp,
                  thisWeek: cw.sessions.map((x) => sessionLine(x, cw.status(x))),
                }
              : null,
          }
        : null,
      daysSinceLastWorkout: train.logs[0] ? daysBetween(train.logs[0].day, today) - 1 : null,
      workoutsLast30Days: train.logs
        .filter((l) => l.day >= addDays(today, -30))
        .slice(0, 20)
        .map((l) => ({ day: l.day, name: l.name, minutes: l.minutes, volumeKg: Math.round(l.volume), sets: l.sets_done, records: l.prs?.length ?? 0 })),
      body: Object.fromEntries(
        Object.keys(MEAS).map((k) => {
          const m = health.measures.filter((x) => x.kind === k).at(-1);
          return [k, m ? { value: m.value, day: m.day } : null];
        }).filter(([, v]) => v),
      ),
      // The latest 2 lab reports, at most 20 values each, the high and low ones first.
      bloodTests: health.blood.slice(0, 2).map((b) => ({
        day: b.day,
        title: b.title,
        values: [...b.values]
          .sort((x, y) => Number(!!y.flag) - Number(!!x.flag))
          .slice(0, 20)
          .map((v) => `${v.name}: ${v.value} ${v.unit}${v.flag ? (v.flag > 0 ? ' (high)' : ' (low)') : ''}`),
      })),
      supplements: health.supplements
        .filter((x) => x.active)
        .map((x) => `${x.name} ${x.dose}${x.unit} ${x.freq}${supLogs.ok ? `, taken ${last7(supLogs.logs[x.id], today).filter((d) => d.on).length} of the last 7 days${(supLogs.logs[x.id] ?? []).includes(today) ? ' (taken today)' : ''}` : ''}`),
      // The latest result of each marker that's out of range, and food ideas for the low ones (food only, never doses).
      flaggedBloodMarkers: flaggedMarkers(health.blood).map((m) => `${m.name}: ${m.value} ${m.unit} (${m.flag}, ${m.day})`),
      foodTipsFromLabs: healthFoodTips(health.blood, health.supplements, food.plan.allergies, food.plan.allergyNote).map((x) => x.text),
      coachManagesFood: !!food.coachTargets,
      foodAllergies: allergiesText(food.plan.allergies, food.plan.allergyNote) || 'none',
      reminders: remindersSummary(prefs) ?? null,
    };
  };

  /** Log what the coach found, and keep the new row ids so Undo works. */
  const applyActions = async (acts: ChatAction[]) => {
    const done: Logged[] = [];
    // Today's drinks so far, to warn about a big caffeine dose.
    let cafSoFar = food.isToday ? caffeineToday(food.logs.map((l) => l.name), food.waterLogs) : 0;
    let caf: CaffeineAlert | null = null;
    for (const a of acts) {
      if (a.type === 'food' && +a.kcal > 0) {
        // Sensible limits for one thing eaten, and a name even if the AI left it out.
        const g = (x: unknown, max: number) => Math.min(max, Math.max(0, +(x as number) || 0));
        const item = { name: String(a.name ?? '').trim().slice(0, 120) || t('Food'), kcal: g(a.kcal, 4000), protein: g(a.protein, 300), carbs: g(a.carbs, 600), fat: g(a.fat, 300) };
        const row = await food.addLog(item, food.today);
        if (row) {
          done.push({ ...a, ...item, logId: row.id });
          caf = caf ?? caffeineCheck(caffeineOf(item.name), cafSoFar, new Date().getHours() >= 15);
          cafSoFar += caffeineOf(item.name);
        }
      } else if (a.type === 'cardio' && +a.minutes > 0) {
        const k = Math.max(0, CARDIO.findIndex(([n]) => n === a.kind));
        // At most 5 hours in one go.
        const minutes = Math.min(300, Math.round(+a.minutes));
        const intensity = Math.min(2, Math.max(0, Math.round(+(a.intensity ?? 1)) || 0));
        const kcal = cardioKcal(k, intensity, food.plan.weight || 80, minutes);
        const row = await food.addCardio({ kind: CARDIO[k][0], minutes, intensity, kcal }, food.today);
        if (row) done.push({ ...a, kind: CARDIO[k][0], minutes, intensity, kcal, logId: row.id });
      } else if (a.type === 'water' && a.ml > 0) {
        const ml = Math.min(5000, Math.round(a.ml));
        await food.addWater(ml, 'Water', food.today);
        // Keep the new row's id so Undo can remove exactly this drink.
        const { data } = await supabase.from('water_logs').select('id').eq('day', food.today).eq('ml', ml).order('created_at', { ascending: false }).limit(1).maybeSingle();
        done.push({ type: 'water', ml, logId: (data as { id: string } | null)?.id });
      } else if (a.type === 'sleep' && a.hours > 0 && a.hours <= 16) {
        const hours = r1(a.hours);
        const prev = health.todayCheckin?.sleep_h ?? null;
        if (await health.saveCheckin({ sleep_h: hours, sleep_parts: null })) {
          done.push({ type: 'sleep', hours, prev, day: food.today });
          toast(t('Logged to Sleep: {n} h', { n: fx(hours) }), { ai: true });
        }
      } else if (a.type === 'weight' && a.kg >= 30 && a.kg <= 250) {
        const kg = r1(a.kg);
        const prev = health.weights.find((w) => w.day === food.today)?.value ?? null;
        // More than 10% away from the last weigh-in (a mix-up of kg and lb?): ask first.
        const last = health.weights.at(-1)?.value;
        if (last && Math.abs(kg - last) > last * 0.1 && !(await askWeight(kg, last))) continue;
        if (await health.logWeight(kg)) {
          done.push({ type: 'weight', kg, prev, day: food.today });
          toast(W.words(t('Logged to Progress: {n} kg', { n: W.show(kg) })), { ai: true });
        }
      }
    }
    if (caf) {
      const alert = caf;
      setTimeout(() => showCaffeineAlert(alert), 900);
    }
    return done;
  };

  // Set before anything is awaited, so a double tap (or a prompt chip and Send) sends once.
  const sending = useRef(false);
  const send = async (raw: string) => {
    const q = raw.trim();
    if (!q || thinking || sending.current) return;
    sending.current = true;
    setText('');
    setThinking(true);
    try {
      const mine = await saveMsg({ chat_id: chatId, role: 'user', text: q.slice(0, 2000), actions: null });
      if (mine) setAll((xs) => [...(xs ?? []), mine]);
      // Your question always goes to the AI, even if saving it failed.
      const history = [...msgs.map((m) => ({ role: m.role, text: m.text })), { role: 'user' as const, text: q.slice(0, 2000) }];
      // Answer in the language you wrote in (Arabic letters → Arabic), whatever the app's language is.
      const replyLang = /[\u0600-\u06FF]/.test(q) ? 'ar' : /[A-Za-z]/.test(q) ? 'en' : lang;
      const { result, error } = await askAI<{ reply: string; actions: ChatAction[]; suggest?: unknown; card?: unknown; memory?: string }>('chat', {
        lang: replyLang,
        context: context(),
        memory,
        messages: history,
      });
      if (error || !result) return toast(t(aiErrorText(error ?? 'failed')), { icon: 'warn' });
      const acts = await applyActions(Array.isArray(result.actions) ? result.actions : []);
      // No fewer calories while pregnant, after birth or in the luteal phase.
      const sugg = await prepareSuggestions(result.suggest, train.plan, food.today, { noCut: !!preg || cycle?.phase === 'Luteal', kcal: Math.round(food.target.k) });
      const all2 = [...acts, ...sugg];
      // A suggested meal with one of your allergens is never shown.
      const aiCard = cleanCard(result.card);
      const safeCard = aiCard?.type === 'meal' && (allergensIn([aiCard.name], food.plan.allergies).length || noteHit([aiCard.name], food.plan.allergyNote)) ? null : aiCard;
      const card = safeCard ?? (all2.length ? null : guessCard(q));
      const ai = await saveMsg({ chat_id: chatId, role: 'ai', text: String(result.reply ?? '').slice(0, 4000), actions: all2.length ? all2 : null, card });
      // The coach keeps a short memory of lasting things you told it.
      if (typeof result.memory === 'string' && result.memory.trim() && result.memory.trim() !== memory && session) {
        setMemory(result.memory.trim().slice(0, 1500));
        saveMemory(session.user.id, result.memory);
      }
      if (ai) setAll((xs) => [...(xs ?? []), ai]);
    } catch {
      toast(t(aiErrorText('failed')), { icon: 'warn' });
    } finally {
      // Whatever happened, "Thinking…" never stays stuck.
      sending.current = false;
      setThinking(false);
    }
  };

  const undo = async (m: ChatMsg, i: number) => {
    const a = m.actions?.[i];
    if (!a || isSuggestion(a) || a.undone) return;
    if (a.type === 'food' && a.logId) await food.deleteLog(a.logId);
    if (a.type === 'cardio' && a.logId) await food.deleteCardio(a.logId);
    if (a.type === 'water') {
      if (!a.logId) return toast(t('Remove this drink on the Water screen.'), { icon: 'info' });
      await food.deleteWater(a.logId);
    }
    // Undo the day it was logged on, even if that was yesterday.
    if (a.type === 'sleep') await health.saveCheckin({ sleep_h: a.prev ?? null }, a.day ?? food.today);
    if (a.type === 'weight') {
      // Back to the weight from before (or none), with your profile weight and targets following it.
      if (!(await health.fixWeight(a.day ?? food.today, a.prev ?? null))) return toast(t('Couldn’t save. Please try again.'), { icon: 'warn' });
    }
    const next = (m.actions ?? []).map((x, j) => (j === i ? { ...x, undone: true } : x));
    setAll((xs) => (xs ?? []).map((x) => (x.id === m.id ? { ...x, actions: next } : x)));
    updateActions(m.id, next);
    toast(t('Removed'), { icon: 'check' });
  };

  const setSuggestion = (m: ChatMsg, i: number, a: Suggestion) => {
    const next = (m.actions ?? []).map((x, j) => (j === i ? a : x));
    setAll((xs) => (xs ?? []).map((x) => (x.id === m.id ? { ...x, actions: next } : x)));
    updateActions(m.id, next);
  };

  /** Apply a suggestion (the old plan is kept on it for Undo). */
  const applySuggestion = async (m: ChatMsg, i: number, a: Suggestion) => {
    if (a.type === 'plan') {
      if (!train.plan) return toast(t('Set up your training plan first.'), { icon: 'info' });
      train.updatePlan(applyPlanChanges(train.plan, a.changes, food.today));
      // Undo puts back only what this change touched.
      setSuggestion(m, i, { ...a, state: 'applied', prev: undoPatch(train.plan, a.changes) });
      toast(t('Your plan is updated'), { ai: true });
    } else if (a.type === 'reminder') {
      if (!session) return;
      const prev = await loadPrefs(session.user.id);
      const next = withReminder(prev, a.kind, a.time);
      await savePrefs(session.user.id, next);
      setPrefs(next);
      setSuggestion(m, i, { ...a, state: 'applied', prev });
      toast(t('Reminder on: {x} at {time}', { x: t(REMINDER_NAME[a.kind]), time: a.time }), { icon: 'bell' });
    } else {
      if (food.coachTargets) return toast(t('Your coach sets your targets. Ask them to change it.'), { icon: 'info' });
      const prev = { kcal: food.plan.kcal, perKg: food.plan.perKg, carbG: food.plan.carbG, water: food.plan.water };
      if (!(await food.savePlan(applyTargets(food.plan, a, food.pregKcal)))) return toast(t('Couldn’t save. Please try again.'), { icon: 'warn' });
      setSuggestion(m, i, { ...a, state: 'applied', prev });
      toast(t('Your targets are updated'), { ai: true });
    }
  };

  const undoSuggestion = async (m: ChatMsg, i: number, a: Suggestion) => {
    if (a.type === 'plan' && a.prev && train.plan) train.updatePlan(applyUndo(train.plan, isWholePlan(a.prev) ? undoPatch(a.prev, a.changes) : (a.prev as Partial<TrainPlan>)));
    if (a.type === 'targets' && a.prev) await food.savePlan({ ...food.plan, ...a.prev });
    if (a.type === 'reminder' && a.prev && session) {
      await savePrefs(session.user.id, a.prev);
      setPrefs(a.prev);
    }
    setSuggestion(m, i, { ...a, state: undefined, prev: undefined });
    toast(t('Changed back'), { icon: 'check' });
  };

  // A suggestion keeps what it proposed; next to it, what you have now (until it's applied).
  const nowNote = (cur: string | number | null | undefined, proposed: string | number) => (cur === undefined || String(cur) === String(proposed) ? '' : ` ${cur === null ? t('(now off)') : t('(now {n})', { n: typeof cur === 'number' ? fmt(cur) : cur })}`);
  const reminderNow = (kind: Extract<Suggestion, { type: 'reminder' }>['kind']) => {
    if (!prefs || kind === 'food') return undefined;
    const r = kind === 'water' ? { on: prefs.water.on, time: prefs.water.from } : prefs[kind];
    return prefs.on && r.on ? r.time : null;
  };
  const suggestionCard = (m: ChatMsg, a: Suggestion, i: number) => (
    <View key={i} style={{ marginTop: 10, backgroundColor: c.bg, borderRadius: 16, padding: 12, opacity: a.state === 'dismissed' ? 0.5 : 1 }}>
      <Row gap={8}>
        <Icon name={a.type === 'plan' ? 'train' : a.type === 'reminder' ? 'bell' : 'food'} size={16} color={c.cobalt} />
        <Text variant="small" weight={700} style={{ flex: 1 }}>
          {a.title || t(a.type === 'plan' ? 'Suggested change to your plan' : a.type === 'reminder' ? 'Reminder' : 'Suggested new targets')}
        </Text>
      </Row>
      {(a.type === 'plan'
        ? a.changes.map((ch) => changeLine(ch, isWholePlan(a.prev) ? a.prev : train.plan, lang, t))
        : a.type === 'reminder'
          ? [t('Reminder: {x} at {time}', { x: t(REMINDER_NAME[a.kind]), time: a.time }) + (a.state ? '' : nowNote(reminderNow(a.kind), a.time))]
          : [
              a.kcal ? t('Calories: {n} kcal', { n: fmt(a.kcal) }) + (a.state ? '' : nowNote(food.setupDone ? Math.round(food.target.k) : undefined, a.kcal)) : null,
              a.protein ? t('Protein: {n} g', { n: a.protein }) + (a.state ? '' : nowNote(food.setupDone ? Math.round(food.target.p) : undefined, a.protein)) : null,
              a.water ? t('Water: {n} ml', { n: fmt(a.water) }) + (a.state ? '' : nowNote(food.setupDone ? food.plan.water || 2800 : undefined, a.water)) : null,
            ].filter((x): x is string => !!x)
      ).map((line, j) => (
        <Text key={j} variant="small" color="sec" style={{ marginTop: 6 }}>
          {`• ${line}`}
        </Text>
      ))}
      {a.state === 'applied' ? (
        <Row gap={8} style={{ marginTop: 10 }}>
          <Icon name="check" size={16} color={c.up} strokeWidth={2.4} />
          <Text variant="small" weight={700} style={{ flex: 1, color: c.up }}>
            {t('Applied')}
          </Text>
          <Springy onPress={() => undoSuggestion(m, i, a)}>
            <Text variant="small" weight={700} color="link">
              {t('Undo')}
            </Text>
          </Springy>
        </Row>
      ) : a.state === 'dismissed' ? null : (
        <Row gap={8} style={{ marginTop: 10 }}>
          <Springy onPress={() => applySuggestion(m, i, a)} style={{ flex: 1, height: 38, borderRadius: 19, backgroundColor: c.cobalt, alignItems: 'center', justifyContent: 'center' }}>
            <Text variant="small" weight={700} style={{ color: '#FFFFFF' }}>
              {t('Apply')}
            </Text>
          </Springy>
          <Springy onPress={() => setSuggestion(m, i, { ...a, state: 'dismissed' })} style={{ flex: 1, height: 38, borderRadius: 19, backgroundColor: c.inset, alignItems: 'center', justifyContent: 'center' }}>
            <Text variant="small" weight={700}>
              {t('No thanks')}
            </Text>
          </Springy>
        </Row>
      )}
    </View>
  );

  const actionLine = (a: Logged): [IconName, string] =>
    a.type === 'food'
      ? ['food', t('Logged {name}: {k} kcal, {p} g protein', { name: a.name, k: fmt(a.kcal), p: Math.round(a.protein || 0) })]
      : a.type === 'cardio'
        ? ['walk', t('Added {x}, {m} min: +{k} kcal to today', { x: t(a.kind).toLowerCase(), m: a.minutes, k: a.kcal ?? 0 })]
        : a.type === 'sleep'
          ? ['moon', t('Logged to Sleep: {n} h', { n: fx(a.hours) })]
          : a.type === 'weight'
            ? ['scale', W.words(t('Logged to Progress: {n} kg', { n: W.show(a.kg) }))]
            : ['drop', t('Added {n} ml water', { n: a.ml })];

  return (
    <View style={{ flex: 1 }}>
      <Screen
        title={title.length > 30 ? `${title.slice(0, 28)}…` : title}
        scrollRef={scroll}
        back
        right={
          <Row gap={6}>
            <Springy onPress={() => router.push({ pathname: '/chat-history', params: { open: chatId } })} scaleTo={1.08} accessibilityLabel={t('Chat history')}>
              <Glass style={{ width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' }}>
                <Icon name="clock" size={21} />
              </Glass>
            </Springy>
            <Springy
              onPress={() => {
                if (!msgs.length) return toast(t('This chat is already empty'), { icon: 'info' });
                setChatId(newId());
              }}
              scaleTo={1.08}
              accessibilityLabel={t('New chat')}>
              <Glass style={{ width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' }}>
                <Icon name="edit" size={20} />
              </Glass>
            </Springy>
          </Row>
        }>
        <View style={{ alignItems: 'center', paddingTop: 6, paddingBottom: 18 }}>
          <Mark size={46} color={c.cobalt} stroke={9} />
          <Text variant="h3" style={{ marginTop: 8 }}>
            {t('Your coach')}
          </Text>
          <Text variant="xs" color="sec">
            {t('Health and fitness only. Not medical advice.')}
          </Text>
        </View>
        {!msgs.length && all ? (
          <View style={{ alignSelf: 'flex-start', maxWidth: '86%', backgroundColor: c.card, borderRadius: 22, borderBottomStartRadius: 8, paddingVertical: 11, paddingHorizontal: 15, marginBottom: 8 }}>
            <Text>{profile?.name ? t('Hi {name}. Tell me what you ate, how you trained, or ask me anything.', { name: profile.name }) : t('Hi. Tell me what you ate, how you trained, or ask me anything.')}</Text>
          </View>
        ) : null}
        {earlier > 0 ? (
          <Springy onPress={() => setOlderFor({ chat: chatId, n: older + 40 })} style={{ alignSelf: 'center', marginBottom: 10, paddingVertical: 8, paddingHorizontal: 14, borderRadius: 16, backgroundColor: c.card }}>
            <Text variant="small" weight={700} color="link">
              {t('Show earlier messages ({n})', { n: earlier })}
            </Text>
          </Springy>
        ) : null}
        {msgs.slice(-shownCount).map((m) =>
          m.role === 'user' ? (
            <View key={m.id} style={{ alignSelf: 'flex-end', maxWidth: '82%', backgroundColor: c.text, borderRadius: 22, borderBottomEndRadius: 8, paddingVertical: 11, paddingHorizontal: 15, marginBottom: 8 }}>
              <Text color={c.bg}>{m.text}</Text>
            </View>
          ) : (
            <Row key={m.id} gap={8} style={{ alignItems: 'flex-end', marginBottom: 8 }}>
              <Mark size={24} color={c.cobalt} stroke={5} />
              <View style={{ maxWidth: '82%', backgroundColor: c.card, borderRadius: 22, borderBottomStartRadius: 8, paddingVertical: 11, paddingHorizontal: 15 }}>
                <Text>{m.text}</Text>
                {(m.actions ?? []).map((a, i) => {
                  if (isSuggestion(a)) return suggestionCard(m, a, i);
                  const [icon, line] = actionLine(a);
                  return (
                    <Row key={i} gap={8} style={{ marginTop: 10, backgroundColor: c.bg, borderRadius: 14, paddingVertical: 8, paddingHorizontal: 10, opacity: a.undone ? 0.5 : 1 }}>
                      <Icon name={icon} size={16} color={c.cobalt} />
                      <Text variant="small" weight={600} style={{ flex: 1, textDecorationLine: a.undone ? 'line-through' : 'none' }}>
                        {line}
                      </Text>
                      {!a.undone ? (
                        <Springy onPress={() => undo(m, i)}>
                          <Text variant="small" weight={700} color="link">
                            {t('Undo')}
                          </Text>
                        </Springy>
                      ) : null}
                    </Row>
                  );
                })}
                {m.card ? <ChatCard card={m.card} day={localDay(new Date(m.created_at))} kcalGoal={goalsFor(streaks.x, localDay(new Date(m.created_at))).kcal} /> : null}
              </View>
            </Row>
          ),
        )}
        {thinking ? (
          <View style={{ alignItems: 'flex-start' }}>
            <View style={{ transform: [{ scale: 0.6 }], marginStart: -30, marginTop: -30 }}>
              <Thinking message={t('Thinking…')} />
            </View>
          </View>
        ) : null}
        <View style={{ height: 150 }} />
      </Screen>
      <Sheet
        open={!!weightAsk}
        onClose={() => {
          weightAsk?.done(false);
          setWeightAsk(null);
        }}>
        {weightAsk ? (
          <View>
            <Text variant="h2">{W.words(t('Log {n} kg?', { n: W.show(weightAsk.kg) }))}</Text>
            <Text color="sec" style={{ marginTop: 6 }}>
              {W.words(t('That’s more than 10% away from your last weigh-in ({n} kg). Check the number and the unit.', { n: W.show(weightAsk.last) }))}
            </Text>
            <Button
              title={t('Log it')}
              style={{ marginTop: 16 }}
              onPress={() => {
                weightAsk.done(true);
                setWeightAsk(null);
              }}
            />
            <Button
              kind="glass"
              title={t('Don’t log')}
              style={{ marginTop: 8 }}
              onPress={() => {
                weightAsk.done(false);
                setWeightAsk(null);
              }}
            />
          </View>
        ) : null}
      </Sheet>

      {/* Above the keyboard while it's open (iOS), else above the home bar. */}
      <View pointerEvents="box-none" style={{ position: 'absolute', left: 0, right: 0, bottom: kb ? kb + 8 : 16 + insets.bottom, gap: 8 }}>
        {!msgs.length ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}>
            {PROMPTS.map((p) => (
              <Springy key={p} onPress={() => send(t(p))}>
                <Glass style={{ height: 40, borderRadius: 20, paddingHorizontal: 14, justifyContent: 'center' }}>
                  <Text variant="small" weight={700}>
                    {t(p)}
                  </Text>
                </Glass>
              </Springy>
            ))}
          </ScrollView>
        ) : null}
        <View style={{ paddingHorizontal: 16 }}>
          <Glass ai style={{ borderRadius: 28, padding: 6, flexDirection: 'row', alignItems: 'flex-end', gap: 6 }}>
            {/* Return adds a new line; the arrow sends. The box grows up to about 5 lines. */}
            <TextInput
              value={text}
              onChangeText={setText}
              placeholder={t('Ask or log anything…')}
              placeholderTextColor={c.sec}
              multiline
              maxLength={1000}
              style={{ flex: 1, minWidth: 0, minHeight: 44, maxHeight: 132, paddingHorizontal: 12, paddingTop: 11, paddingBottom: 11, fontSize: 16, lineHeight: 22, color: c.text, fontFamily: fontFor(lang === 'ar' ? 'arabic' : 'manrope', 500), outlineStyle: 'none', textAlign: lang === 'ar' ? 'right' : 'left', textAlignVertical: 'top' } as object}
            />
            <Springy onPress={() => send(text)} disabled={thinking} accessibilityLabel={t('Send')} style={{ width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: c.cobalt }}>
              <Icon name="up" size={20} color="#FFFFFF" strokeWidth={2.4} />
            </Springy>
          </Glass>
        </View>
      </View>
    </View>
  );
}
