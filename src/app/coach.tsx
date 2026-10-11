import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Platform, ScrollView, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Thinking } from '@/components/food/Thinking';
import { ChatCard } from '@/components/health/ChatCard';
import { Glass } from '@/components/Glass';
import { Icon, type IconName, Mark } from '@/components/Icon';
import { Screen } from '@/components/Screen';
import { fontFor, Text } from '@/components/Text';
import { useToast } from '@/components/Toast';
import { Row, Springy } from '@/components/ui';
import { useT } from '@/i18n';
import { aiErrorText, askAI } from '@/lib/ai';
import { useAuth } from '@/lib/auth';
import { useRecovery } from '@/components/train/RecoveryCard';
import { type ChatAction, type ChatMsg, cleanCard, groupChats, guessCard, loadChats, loadMemory, newId, saveMemory, saveMsg, updateActions } from '@/lib/coach';
import { useCycleToday } from '@/lib/cyclePhase';
import { useDevices } from '@/lib/devices';
import { useFood } from '@/lib/food';
import { useHealth } from '@/lib/health';
import { addDays, fmt, GOALS } from '@/lib/nutrition';
import { fx, weekAvg } from '@/lib/progress';
import { canListen, listen, stopListening } from '@/lib/speech';
import { supabase } from '@/lib/supabase';
import { useTrain } from '@/lib/train';
import { useStreaks } from '@/lib/useProgress';
import { CARDIO, cardioKcal } from '@/lib/training';
import { useSettings } from '@/theme/settings';

const PROMPTS = ['I ate chicken and rice', 'I slept 7 hours', 'How’s my progress?', 'What should I eat for dinner?', 'I drank 500 ml of water', 'I walked 30 minutes'];
const r1 = (n: number) => Math.round(n * 10) / 10;

/** Chat with the AI coach. It can log food, cardio, water, sleep and weight for you, and remembers you between chats (design: chat). */
export default function Coach() {
  const { t, lang } = useT();
  const { colors: c } = useSettings();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const { profile, session } = useAuth();
  const food = useFood();
  const train = useTrain();
  const health = useHealth();
  const streaks = useStreaks();
  const { r: rec } = useRecovery();
  const cycle = useCycleToday();
  const devices = useDevices(session?.user.id);
  const [memory, setMemory] = useState('');
  const { chat, ask } = useLocalSearchParams<{ chat?: string; ask?: string }>();
  const [all, setAll] = useState<ChatMsg[] | null>(null);
  const [chatId, setChatId] = useState<string>(() => chat ?? newId());
  const [text, setText] = useState(ask ?? '');
  const [thinking, setThinking] = useState(false);
  const [listening, setListening] = useState(false);
  const scroll = useRef<ScrollView>(null);

  useEffect(() => {
    let live = true;
    loadMemory().then((m) => live && setMemory(m));
    loadChats().then((m) => {
      if (!live) return;
      setAll(m);
      // Open the latest chat when it's from today; otherwise start fresh.
      if (!chat && !ask) {
        const g = groupChats(m)[0];
        if (g && g.last.slice(0, 10) === new Date().toISOString().slice(0, 10)) setChatId(g.id);
      }
    });
    return () => {
      live = false;
    };
  }, [chat, ask]);

  const msgs = (all ?? []).filter((m) => m.chat_id === chatId);
  const title = msgs.find((m) => m.role === 'user')?.text ?? t('New chat');

  useEffect(() => {
    setTimeout(() => scroll.current?.scrollToEnd({ animated: true }), 50);
  }, [msgs.length, thinking]);

  /** Everything the coach should know: today, the last week, trends, targets, cycle and watch data. */
  const context = () => {
    const today = food.today;
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
    const dev = devices.days.filter((d) => d.day >= week[0]);
    return {
      name: profile?.name ?? '',
      gender: profile?.gender ?? null,
      language: lang,
      today,
      time: new Date().toTimeString().slice(0, 5),
      weightKg: health.weights.at(-1)?.value ?? food.plan.weight,
      weightWeeklyAverages: weekly,
      goal: food.setupDone ? GOALS[food.plan.goal] : 'not set up',
      caloriesGoal: food.setupDone ? food.dayGoal(today) : null,
      // The food numbers below are for this day (the person may be looking back at an earlier day).
      foodDay: food.isToday ? 'today' : food.day,
      caloriesLeft: food.setupDone ? food.kcalLeft : null,
      eatenToday: { kcal: Math.round(food.eaten.k), protein: Math.round(food.eaten.p), carbs: Math.round(food.eaten.c), fat: Math.round(food.eaten.f) },
      targets: food.setupDone ? food.target : null,
      coachTargets: food.coachTargets ? { kcal: food.coachTargets.kcal, protein: food.coachTargets.protein, coach: food.coachTargets.name } : null,
      foodLoggedToday: food.logs.map((l) => l.name).slice(-10),
      burnedByCardio: food.burned,
      waterMl: food.water,
      waterGoalMl: food.plan.water,
      last7Days: week.map((d) => {
        const c = ci.get(d);
        const f = health.days[d];
        return { day: d, sleepH: c?.sleep_h ?? null, energy: c?.energy == null ? null : ['tired', 'normal', 'great'][c.energy], soreness: c?.sore == null ? null : ['none', 'a little', 'very sore'][c.sore], recovery: c?.score ?? null, kcal: f ? Math.round(f.k) : null, protein: f ? Math.round(f.p) : null };
      }),
      recoveryToday: rec.score,
      last7DaysAdherence: { caloriesOnTarget: part('cal'), proteinGoal: part('prot'), waterGoal: part('water'), workoutsAsPlanned: part('work'), sleep7hPlus: part('sleep') },
      commitment30DaysPercent: streaks.commitment,
      streakDays: streaks.overall,
      todayWorkout: train.setupDone ? (train.todayName ?? 'rest day') : 'no training plan yet',
      workoutDoneToday: !!train.todayLog,
      workoutsThisWeek: { done: train.doneIdx.size, planned: train.week.filter((d) => d.w).length },
      workoutsLast7Days: train.logs.filter((l) => l.day >= week[0]).map((l) => `${l.name} (${l.day}, ${l.minutes} min)`),
      cycle: cycle ? { day: cycle.day, phase: cycle.phase, nextPeriod: cycle.next, late: cycle.late } : null,
      watch: dev.length ? dev.map((d) => ({ day: d.day, steps: d.steps, restingHr: d.hr_rest, hrvMs: d.hrv, sleepH: d.sleep_h, activeKcal: d.active_kcal })) : null,
    };
  };

  /** Log what the coach found, and keep the new row ids so Undo works. */
  const applyActions = async (acts: ChatAction[]) => {
    const done: ChatAction[] = [];
    for (const a of acts) {
      if (a.type === 'food' && a.kcal > 0) {
        const row = await food.addLog({ name: a.name, kcal: a.kcal, protein: a.protein || 0, carbs: a.carbs || 0, fat: a.fat || 0 }, food.today);
        if (row) done.push({ ...a, logId: row.id });
      } else if (a.type === 'cardio' && a.minutes > 0) {
        const k = Math.max(0, CARDIO.findIndex(([n]) => n === a.kind));
        const kcal = cardioKcal(k, Math.min(2, Math.max(0, a.intensity ?? 1)), food.plan.weight || 80, a.minutes);
        const row = await food.addCardio({ kind: CARDIO[k][0], minutes: Math.round(a.minutes), intensity: a.intensity ?? 1, kcal }, food.today);
        if (row) done.push({ ...a, kind: CARDIO[k][0], kcal, logId: row.id });
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
          done.push({ type: 'sleep', hours, prev });
          toast(t('Logged to Sleep: {n} h', { n: fx(hours) }), { ai: true });
        }
      } else if (a.type === 'weight' && a.kg >= 30 && a.kg <= 250) {
        const kg = r1(a.kg);
        const prev = health.weights.find((w) => w.day === food.today)?.value ?? null;
        if (await health.logWeight(kg)) {
          done.push({ type: 'weight', kg, prev });
          toast(t('Logged to Progress: {n} kg', { n: fx(kg) }), { ai: true });
        }
      }
    }
    return done;
  };

  const send = async (raw: string) => {
    const q = raw.trim();
    if (!q || thinking) return;
    setText('');
    const mine = await saveMsg({ chat_id: chatId, role: 'user', text: q.slice(0, 2000), actions: null });
    const history = [...msgs, ...(mine ? [mine] : [])];
    if (mine) setAll((xs) => [...(xs ?? []), mine]);
    setThinking(true);
    const { result, error } = await askAI<{ reply: string; actions: ChatAction[]; card?: unknown; memory?: string }>('chat', {
      lang,
      context: context(),
      memory,
      messages: history.map((m) => ({ role: m.role, text: m.text })),
    });
    if (error || !result) {
      setThinking(false);
      return toast(t(aiErrorText(error ?? 'failed')), { icon: 'warn' });
    }
    const acts = await applyActions(Array.isArray(result.actions) ? result.actions : []);
    const card = cleanCard(result.card) ?? (acts.length ? null : guessCard(q));
    const ai = await saveMsg({ chat_id: chatId, role: 'ai', text: String(result.reply ?? '').slice(0, 4000), actions: acts.length ? acts : null, card });
    // The coach keeps a short memory of lasting things you told it.
    if (typeof result.memory === 'string' && result.memory.trim() && result.memory.trim() !== memory && session) {
      setMemory(result.memory.trim().slice(0, 1500));
      saveMemory(session.user.id, result.memory);
    }
    setThinking(false);
    if (ai) setAll((xs) => [...(xs ?? []), ai]);
  };

  const undo = async (m: ChatMsg, i: number) => {
    const a = m.actions?.[i];
    if (!a || a.undone) return;
    if (a.type === 'food' && a.logId) await food.deleteLog(a.logId);
    if (a.type === 'cardio' && a.logId) await food.deleteCardio(a.logId);
    if (a.type === 'water') {
      if (!a.logId) return toast(t('Remove this drink on the Water screen.'), { icon: 'info' });
      await food.deleteWater(a.logId);
    }
    if (a.type === 'sleep') await health.saveCheckin({ sleep_h: a.prev ?? null });
    if (a.type === 'weight') {
      if (a.prev != null) await health.logWeight(a.prev);
      else await health.deleteWeight(food.today);
    }
    const next = (m.actions ?? []).map((x, j) => (j === i ? { ...x, undone: true } : x));
    setAll((xs) => (xs ?? []).map((x) => (x.id === m.id ? { ...x, actions: next } : x)));
    updateActions(m.id, next);
    toast(t('Removed'), { icon: 'check' });
  };

  const mic = async () => {
    if (listening) return stopListening();
    if (!canListen()) return toast(Platform.OS === 'web' ? t('Voice isn’t available in this browser. Try Chrome or Safari.') : t('Voice isn’t available on this phone.'), { icon: 'info' });
    setListening(true);
    const said = await listen(lang);
    setListening(false);
    if (said) send(said);
    else if (Platform.OS !== 'web') toast(t('I didn’t catch that. Check that Gymi can use the microphone.'), { icon: 'mic' });
  };

  const actionLine = (a: ChatAction): [IconName, string] =>
    a.type === 'food'
      ? ['food', t('Logged {name}: {k} kcal, {p} g protein', { name: a.name, k: fmt(a.kcal), p: Math.round(a.protein || 0) })]
      : a.type === 'cardio'
        ? ['walk', t('Added {x}, {m} min: +{k} kcal to today', { x: t(a.kind).toLowerCase(), m: a.minutes, k: a.kcal ?? 0 })]
        : a.type === 'sleep'
          ? ['moon', t('Logged to Sleep: {n} h', { n: fx(a.hours) })]
          : a.type === 'weight'
            ? ['scale', t('Logged to Progress: {n} kg', { n: fx(a.kg) })]
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
            <Text>{t('Hi {name}. Tell me what you ate, how you trained, or ask me anything.', { name: profile?.name || '' })}</Text>
          </View>
        ) : null}
        {msgs.map((m) =>
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
                {m.card ? <ChatCard card={m.card} /> : null}
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

      <View pointerEvents="box-none" style={{ position: 'absolute', left: 0, right: 0, bottom: 16 + insets.bottom, gap: 8 }}>
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
          <Glass ai style={{ borderRadius: 32, padding: 6, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <TextInput
              value={text}
              onChangeText={setText}
              onSubmitEditing={() => send(text)}
              placeholder={t(listening ? 'Listening…' : 'Ask or log anything…')}
              placeholderTextColor={c.sec}
              returnKeyType="send"
              maxLength={1000}
              style={{ flex: 1, minWidth: 0, height: 44, paddingHorizontal: 12, fontSize: 16, color: c.text, fontFamily: fontFor(lang === 'ar' ? 'arabic' : 'manrope', 500), outlineStyle: 'none', textAlign: lang === 'ar' ? 'right' : 'left' } as object}
            />
            <Springy onPress={mic} accessibilityLabel={t('Talk')} style={{ width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: listening ? c.down : 'rgba(51,85,255,0.14)' }}>
              <Icon name="mic" size={20} color={listening ? '#FFFFFF' : c.cobalt} />
            </Springy>
            <Springy onPress={() => send(text)} disabled={thinking} accessibilityLabel={t('Send')} style={{ width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: c.cobalt }}>
              <Icon name="up" size={20} color="#FFFFFF" strokeWidth={2.4} />
            </Springy>
          </Glass>
        </View>
      </View>
    </View>
  );
}
