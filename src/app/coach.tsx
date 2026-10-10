import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ScrollView, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Thinking } from '@/components/food/Thinking';
import { Glass } from '@/components/Glass';
import { Icon, type IconName, Mark } from '@/components/Icon';
import { Screen } from '@/components/Screen';
import { fontFor, Text } from '@/components/Text';
import { useToast } from '@/components/Toast';
import { Row, Springy } from '@/components/ui';
import { useT } from '@/i18n';
import { aiErrorText, askAI } from '@/lib/ai';
import { useAuth } from '@/lib/auth';
import { type ChatAction, type ChatMsg, groupChats, loadChats, newId, saveMsg, updateActions } from '@/lib/coach';
import { useFood } from '@/lib/food';
import { fmt, GOALS } from '@/lib/nutrition';
import { canListen, listen, stopListening } from '@/lib/speech';
import { useTrain } from '@/lib/train';
import { CARDIO, cardioKcal } from '@/lib/training';
import { useSettings } from '@/theme/settings';

const PROMPTS = ['I ate chicken and rice', 'What should I eat for dinner?', 'How’s my progress?', 'I drank 500 ml of water', 'I walked 30 minutes'];

/** Chat with the AI coach. It can log food, cardio and water for you (design: chat). */
export default function Coach() {
  const { t, lang } = useT();
  const { colors: c } = useSettings();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const { profile } = useAuth();
  const food = useFood();
  const train = useTrain();
  const { chat, ask } = useLocalSearchParams<{ chat?: string; ask?: string }>();
  const [all, setAll] = useState<ChatMsg[] | null>(null);
  const [chatId, setChatId] = useState<string>(() => chat ?? newId());
  const [text, setText] = useState(ask ?? '');
  const [thinking, setThinking] = useState(false);
  const [listening, setListening] = useState(false);
  const scroll = useRef<ScrollView>(null);

  useEffect(() => {
    let live = true;
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

  const context = () => ({
    name: profile?.name ?? '',
    language: lang,
    time: new Date().toTimeString().slice(0, 5),
    weightKg: food.plan.weight,
    goal: food.setupDone ? GOALS[food.plan.goal] : 'not set up',
    caloriesGoal: food.setupDone ? food.dayGoal(food.today) : null,
    caloriesLeft: food.setupDone ? food.kcalLeft : null,
    eatenToday: { kcal: Math.round(food.eaten.k), protein: Math.round(food.eaten.p), carbs: Math.round(food.eaten.c), fat: Math.round(food.eaten.f) },
    targets: food.setupDone ? food.target : null,
    foodLoggedToday: food.logs.map((l) => l.name).slice(-10),
    burnedByCardio: food.burned,
    waterMl: food.water,
    waterGoalMl: food.plan.water,
    todayWorkout: train.setupDone ? (train.todayName ?? 'rest day') : 'no training plan yet',
    workoutDoneToday: !!train.todayLog,
    workoutsLast7Days: train.logs.filter((l) => l.day >= new Date(Date.now() - 7 * 864e5).toISOString().slice(0, 10)).map((l) => `${l.name} (${l.day})`),
  });

  /** Log what the coach found, and keep the new row ids so Undo works. */
  const applyActions = async (acts: ChatAction[]) => {
    const done: ChatAction[] = [];
    for (const a of acts) {
      if (a.type === 'food' && a.kcal > 0) {
        const row = await food.addLog({ name: a.name, kcal: a.kcal, protein: a.protein || 0, carbs: a.carbs || 0, fat: a.fat || 0 });
        if (row) done.push({ ...a, logId: row.id });
      } else if (a.type === 'cardio' && a.minutes > 0) {
        const k = Math.max(0, CARDIO.findIndex(([n]) => n === a.kind));
        const kcal = cardioKcal(k, Math.min(2, Math.max(0, a.intensity ?? 1)), food.plan.weight || 80, a.minutes);
        const row = await food.addCardio({ kind: CARDIO[k][0], minutes: Math.round(a.minutes), intensity: a.intensity ?? 1, kcal });
        if (row) done.push({ ...a, kind: CARDIO[k][0], kcal, logId: row.id });
      } else if (a.type === 'water' && a.ml > 0) {
        await food.addWater(Math.min(5000, Math.round(a.ml)));
        done.push(a);
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
    const { result, error } = await askAI<{ reply: string; actions: ChatAction[] }>('chat', {
      lang,
      context: context(),
      messages: history.map((m) => ({ role: m.role, text: m.text })),
    });
    if (error || !result) {
      setThinking(false);
      return toast(t(aiErrorText(error ?? 'failed')), { icon: 'warn' });
    }
    const acts = await applyActions(Array.isArray(result.actions) ? result.actions : []);
    const ai = await saveMsg({ chat_id: chatId, role: 'ai', text: String(result.reply ?? '').slice(0, 4000), actions: acts.length ? acts : null });
    setThinking(false);
    if (ai) setAll((xs) => [...(xs ?? []), ai]);
  };

  const undo = async (m: ChatMsg, i: number) => {
    const a = m.actions?.[i];
    if (!a || a.undone) return;
    if (a.type === 'food' && a.logId) await food.deleteLog(a.logId);
    if (a.type === 'cardio' && a.logId) await food.deleteCardio(a.logId);
    if (a.type === 'water') return toast(t('Water can’t be undone here yet.'), { icon: 'info' });
    const next = (m.actions ?? []).map((x, j) => (j === i ? { ...x, undone: true } : x));
    setAll((xs) => (xs ?? []).map((x) => (x.id === m.id ? { ...x, actions: next } : x)));
    updateActions(m.id, next);
    toast(t('Removed'), { icon: 'check' });
  };

  const mic = async () => {
    if (listening) return stopListening();
    if (!canListen()) return toast(t('Voice isn’t available in this browser. Try Chrome or Safari.'), { icon: 'info' });
    setListening(true);
    const said = await listen(lang);
    setListening(false);
    if (said) send(said);
  };

  const actionLine = (a: ChatAction): [IconName, string] =>
    a.type === 'food'
      ? ['food', t('Logged {name}: {k} kcal, {p} g protein', { name: a.name, k: fmt(a.kcal), p: Math.round(a.protein || 0) })]
      : a.type === 'cardio'
        ? ['walk', t('Added {x}, {m} min: +{k} kcal to today', { x: t(a.kind).toLowerCase(), m: a.minutes, k: a.kcal ?? 0 })]
        : ['drop', t('Added {n} ml water', { n: a.ml })];

  return (
    <View style={{ flex: 1 }}>
      <Screen
        title={title.length > 30 ? `${title.slice(0, 28)}…` : title}
        scrollRef={scroll}
        back
        right={
          <Row gap={6}>
            <Springy onPress={() => router.push('/chat-history')} scaleTo={1.08} accessibilityLabel={t('Chat history')}>
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
                      {a.type !== 'water' && !a.undone ? (
                        <Springy onPress={() => undo(m, i)}>
                          <Text variant="small" weight={700} color="link">
                            {t('Undo')}
                          </Text>
                        </Springy>
                      ) : null}
                    </Row>
                  );
                })}
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
