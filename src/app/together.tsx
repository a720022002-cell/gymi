import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, View } from 'react-native';

import { Field } from '@/components/Field';
import { Thinking } from '@/components/food/Thinking';
import { TimeField } from '@/components/food/TimeField';
import { Icon } from '@/components/Icon';
import { Screen } from '@/components/Screen';
import { Sheet } from '@/components/Sheet';
import { Avatar } from '@/components/social/Avatar';
import { Text } from '@/components/Text';
import { useToast } from '@/components/Toast';
import { ExercisePicker } from '@/components/train/ExercisePicker';
import { StaleSessionChoice, useStaleSession } from '@/components/train/WorkoutCard';
import { Button, Card, Chip, Row, Springy } from '@/components/ui';
import { useT } from '@/i18n';
import { useAuth } from '@/lib/auth';
import { toPlanEx } from '@/lib/exercisesDb';
import { cardioEx, cardioSportOf, friendLevels, type GroupEx, groupExName, isCardio, setGroupSessionInfo, startGroupWorkout } from '@/lib/groupWorkout';
import { SPORTS, type SportId, sportInfo } from '@/lib/sports';
import { addDays, fmtTime } from '@/lib/nutrition';
import { displayName, type FriendRow, myFriends } from '@/lib/social';
import { applyTogether, buildTogether, COLORS, type DayInfo, fallbackPlan, FOCUS, type Focus, friendsDay, LEVELS, type Level, myDayInfo, noteText, type Person, scheme, type TogetherNote } from '@/lib/together';
import { useTrain } from '@/lib/train';
import { DAYS, DAYS_LONG, exInfo, exMuscle, muscleLabel, type PlanEx } from '@/lib/training';
import { useSettings } from '@/theme/settings';

/** How the workout is made: the AI from everyone's plans, picked by you, or cardio side by side. */
type Mode = 'ai' | 'own' | 'cardio';
/** The workout being put together: you can still change it before sending. */
type Draft = { key: string; title: string; ex: GroupEx[]; notes: Record<string, TogetherNote> };
const CARDIO_SPORTS = SPORTS.filter((x) => x.group === 'Cardio').map((x) => x.id);
const MINUTES = [15, 20, 30, 45, 60];

/** A person in the group. known: their level comes from their own plan or history. */
type P = Person & { known?: boolean; username?: string };

/** Train together: one workout for up to 5 people, the right sets and reps for each level. */
export default function Together() {
  const { t, lang } = useT();
  const { colors: c } = useSettings();
  const toast = useToast();
  const { profile, session } = useAuth();
  const train = useTrain();
  // A workout left open from an earlier day: save or discard it first.
  const stale = useStaleSession();
  const [staleOpen, setStaleOpen] = useState(false);
  const params = useLocalSearchParams<{ friend?: string; members?: string }>();
  // Your level is the one in your training plan; without one, it comes from how much you trained in the last 6 months.
  const recent = train.logs.length;
  const myLevel: Level = train.plan?.level ?? (recent >= 60 ? 'Advanced' : recent >= 12 ? 'Intermediate' : 'Beginner');
  const [people, setPeople] = useState<P[]>([]);
  const [name, setName] = useState('');
  const [level, setLevel] = useState<Level>('Intermediate');
  // The steps: who's coming, how to make the workout, then the workout itself (to change before sending).
  const [step, setStep] = useState<'people' | 'how' | 'plan'>('people');
  const [mode, setMode] = useState<Mode>('ai');
  const [focus, setFocus] = useState<Focus | null>(null);
  const [pick, setPick] = useState(false);
  const [cardioPick, setCardioPick] = useState(false);
  const [friends, setFriends] = useState<FriendRow[]>([]);
  const [levels, setLevels] = useState<Record<string, Level>>({});
  const [day, setDay] = useState(0);
  const [time, setTime] = useState('18:30');
  const [busy, setBusy] = useState(false);
  // The workout for the chosen day (and what joining means for each person), with your changes.
  const [draft, setDraft] = useState<Draft | null>(null);

  // Friends and their levels; friends passed in (from a friend's page or a group) are picked already.
  useEffect(() => {
    let alive = true;
    (async () => {
      const f = (await myFriends()).filter((x) => x.status === 'accepted');
      const lv = await friendLevels(f.map((x) => x.id));
      if (!alive) return;
      setFriends(f);
      setLevels(lv);
      const want = [params.friend, ...(params.members ?? '').split(',')].filter((x): x is string => !!x && x !== session?.user.id);
      const pre = f.filter((x) => want.includes(x.id)).slice(0, 4);
      // Picked already, but you still check who's coming before going on.
      if (pre.length) setPeople(pre.map((x) => ({ name: displayName(x), username: x.username, id: x.id, level: lv[x.id] ?? 'Beginner', known: true })));
    })();
    return () => {
      alive = false;
    };
  }, [params.friend, params.members, session?.user.id]);

  const all: P[] = [{ name: t('You'), level: myLevel, me: true }, ...people];
  const appFriends = people.filter((p) => p.id);
  const date = addDays(train.today, day);
  // Who's in, as keys: "me", a friend's id, or "local-<n>" for a friend who isn't on Adro.
  const keyOf = (p: P, i: number) => (p.me ? 'me' : (p.id ?? `local-${i}`));
  const buildKey = `${date}|${all.map(keyOf).join(',')}|${mode}|${focus ?? ''}`;
  useEffect(() => {
    if (step !== 'plan') return;
    let alive = true;
    (async () => {
      const friendsInfo = await friendsDay(appFriends.map((p) => p.id as string), date);
      const info: DayInfo[] = all.map((p, i) => {
        if (p.me) return myDayInfo(train.plan, date, profile?.name || t('You'), myLevel, train.logs);
        const f = friendsInfo.find((x) => x.key === p.id);
        return f ?? { key: keyOf(p, i), name: p.name, level: p.level, planned: null, plannedEx: [], injuries: [], recent: [] };
      });
      let d: Omit<Draft, 'key'>;
      if (mode === 'cardio') {
        // Cardio side by side: everyone's own plan stays the same.
        d = { title: 'Cardio', ex: [cardioEx('Run', 30)], notes: Object.fromEntries(info.map((p) => [p.key, { action: 'extra' as const, text: '' }])) };
      } else {
        const plan = mode === 'ai' ? await buildTogether(info, date, lang, focus ?? undefined).catch(() => fallbackPlan(info, focus ?? undefined)) : fallbackPlan(info, focus ?? 'Full body');
        d = { title: plan.title, ex: plan.ex.map(([id, type]) => ({ id, type })), notes: plan.notes };
      }
      if (alive) setDraft({ key: buildKey, ...d });
    })();
    return () => {
      alive = false;
    };
    // buildKey covers the people, the day, the way it's made and the type.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, buildKey]);
  const plan = draft?.key === buildKey ? draft : null;
  const TOG = plan?.ex ?? [];
  const title = plan ? t(plan.title) : '';
  const setEx = (ex: GroupEx[]) => plan && setDraft({ ...plan, ex });
  /** Save the title and each person's note on the invite, and apply your own part to your plan. */
  const saveInfo = async (sid: string, when: string) => {
    if (!plan) return;
    const notes = Object.fromEntries(
      all.flatMap((p, i) => {
        const k = keyOf(p, i);
        const id = p.me ? session?.user.id : p.id;
        return id && plan.notes[k] ? [[id, { ...plan.notes[k], day: when }]] : [];
      }),
    );
    await setGroupSessionInfo(sid, plan.title, notes);
    if (train.plan && when === date) train.updatePlan(applyTogether(train.plan, sid, plan.notes.me?.action, when));
  };

  const addPerson = () => {
    const n = name.trim().slice(0, 20);
    if (!n) return;
    if (people.length >= 4) return toast(t('Up to 4 friends at a time'), { icon: 'info' });
    setPeople([...people, { name: n, level }]);
    setName('');
  };
  const togglePick = (f: FriendRow) => {
    if (people.some((p) => p.id === f.id)) return setPeople(people.filter((p) => p.id !== f.id));
    if (people.length >= 4) return toast(t('Up to 4 friends at a time'), { icon: 'info' });
    setPeople([...people, { name: displayName(f), username: f.username, id: f.id, level: levels[f.id] ?? 'Beginner', known: true }]);
  };

  const workout = TOG;
  const startLocal = () => {
    if (stale) return setStaleOpen(true);
    if (train.session) return router.replace('/active');
    const ex: PlanEx[] = TOG.map((x) => {
      // Cardio on your phone: one timed round of its minutes.
      if (isCardio(x)) return { id: x.id, n: sportInfo(cardioSportOf(x)).name, sets: 1, reps: String((x.min ?? 20) * 60), time: true, m: 'Other' };
      const s = scheme(myLevel, x.type);
      return { id: x.id, sets: s.sets, reps: String(s.reps), ...(x.n ? { n: x.n, ar: x.ar, m: x.m } : {}) };
    });
    train.startWorkout('Together', false, false, { ex });
    router.replace('/active');
  };
  const startLive = async () => {
    setBusy(true);
    const sid = await startGroupWorkout(workout, appFriends.map((p) => p.id as string), appFriends.map((p) => p.level), myLevel);
    if (sid) await saveInfo(sid, train.today);
    setBusy(false);
    if (!sid) return toast(t('Couldn’t start. Please try again.'), { icon: 'warn' });
    toast(t('Invite sent. Friends join from Gym Bros.'), { icon: 'users' });
    router.replace({ pathname: '/groupactive', params: { id: sid } });
  };

  // When: today, tomorrow, then the next days of the week.
  const dayLabel = (i: number) => (i === 0 ? t('Today') : i === 1 ? t('Tomorrow') : t(DAYS[(train.todayIdx + i) % 7]));
  const whenText = (i: number) => {
    const d = i === 0 ? t('today') : i === 1 ? t('tomorrow') : t(DAYS_LONG[(train.todayIdx + i) % 7]);
    return t('{d} at {t}', { d, t: fmtTime(time, lang) });
  };
  const names = people.length === 1 ? people[0]?.name : `${people.slice(0, -1).map((p) => p.name).join(t(', '))} ${t('and')} ${people[people.length - 1]?.name}`;
  const sendInvite = async () => {
    const [h, m] = time.split(':').map(Number);
    const [y, mo, d] = addDays(train.today, day).split('-').map(Number);
    const at = new Date(y, mo - 1, d, h, m);
    if (at.getTime() < Date.now()) return toast(t('That time has passed. Pick a later time.'), { icon: 'clock' });
    setBusy(true);
    const sid = await startGroupWorkout(workout, appFriends.map((p) => p.id as string), appFriends.map((p) => p.level), myLevel, at);
    if (sid) await saveInfo(sid, date);
    setBusy(false);
    if (!sid) return toast(t('Couldn’t save. Please try again.'), { icon: 'warn' });
    toast(t('Invite sent to {names} for {when}', { names: appFriends.map((p) => p.name).join(t(', ')), when: whenText(day) }), { icon: 'users', action: { label: t('View'), fn: () => router.replace('/train') } });
  };

  const avatar = (p: P, i: number, size = 36) =>
    p.id ? (
      <View style={{ borderWidth: 2, borderColor: c.bg, borderRadius: size / 2 + 2 }}>
        <Avatar id={p.id} name={p.name} size={size} />
      </View>
    ) : p.me && session ? (
      <View style={{ borderWidth: 2, borderColor: c.bg, borderRadius: size / 2 + 2 }}>
        <Avatar id={session.user.id} name={profile?.name || p.name} size={size} />
      </View>
    ) : (
      <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: COLORS[i % COLORS.length], alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: c.bg }}>
        <Text weight={700} size={size * 0.4} color="#FFFFFF">
          {p.name.slice(0, 1).toUpperCase()}
        </Text>
      </View>
    );

  if (step === 'people')
    return (
      <Screen title={t('Train together')} back>
        <Text color="sec">{t('Pick up to 4 friends. I’ll build one workout for the whole group, with the right sets and reps for each person’s level.')}</Text>
        <Text variant="small" color="sec" style={{ marginTop: 12 }}>
          {t('Your level: {l}. Everyone’s level comes from their training plan.', { l: t(myLevel) })}
        </Text>
        {friends.length ? (
          <View style={{ marginTop: 16, backgroundColor: c.card, borderRadius: 22, overflow: 'hidden' }}>
            {friends.map((f, i) => {
              const on = people.some((p) => p.id === f.id);
              return (
                <View key={f.id} style={{ borderTopWidth: i ? 1 : 0, borderTopColor: c.line, paddingHorizontal: 14, paddingVertical: 10 }}>
                  <Springy onPress={() => togglePick(f)} scaleTo={0.99} accessibilityRole="checkbox" accessibilityState={{ checked: on }} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                    <Avatar id={f.id} name={displayName(f)} size={40} />
                    <View style={{ flex: 1 }}>
                      <Text weight={700} numberOfLines={1}>
                        {displayName(f)} <Text variant="small" color="sec">{`@${f.username}`}</Text>
                      </Text>
                      <Text variant="small" color="sec">
                        {t(levels[f.id] ?? 'Beginner')}
                      </Text>
                    </View>
                    <View style={{ width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? c.cobalt : 'transparent', borderWidth: on ? 0 : 2, borderColor: c.line }}>
                      {on ? <Icon name="check" size={14} color="#FFFFFF" strokeWidth={3} /> : null}
                    </View>
                  </Springy>
                </View>
              );
            })}
          </View>
        ) : null}
        {people.filter((p) => !p.id).length ? (
          <View style={{ marginTop: 16, backgroundColor: c.card, borderRadius: 22, overflow: 'hidden' }}>
            {people
              .filter((p) => !p.id)
              .map((p, i) => (
                <Row key={`${p.name}-${i}`} gap={12} style={{ minHeight: 56, paddingHorizontal: 14, borderTopWidth: i ? 1 : 0, borderTopColor: c.line }}>
                  {avatar(p, i + 1)}
                  <View style={{ flex: 1 }}>
                    <Text weight={700}>{p.name}</Text>
                    <Text variant="small" color="sec">
                      {t(p.level)}
                    </Text>
                  </View>
                  <Springy onPress={() => setPeople(people.filter((x) => x !== p))} accessibilityLabel={t('Remove {name}', { name: p.name })} style={{ width: 36, height: 36, alignItems: 'center', justifyContent: 'center' }}>
                    <Icon name="close" size={16} color={c.sec} strokeWidth={2.2} />
                  </Springy>
                </Row>
              ))}
          </View>
        ) : null}
        <Card style={{ marginTop: 16 }}>
          <Field label={t('Friend not on Adro?')} value={name} onChangeText={setName} onSubmitEditing={addPerson} placeholder={t('Ahmed')} maxLength={20} />
          <Row gap={8} style={{ flexWrap: 'wrap', marginTop: 10 }}>
            {LEVELS.map((l) => (
              <Chip key={l} title={t(l)} on={level === l} onPress={() => setLevel(l)} />
            ))}
          </Row>
          <Button small kind="soft" icon="plus" title={t('Add friend')} disabled={!name.trim()} style={{ marginTop: 12, alignSelf: 'stretch' }} onPress={addPerson} />
        </Card>
        <Text variant="small" weight={700} color="sec" center style={{ marginTop: 8 }}>
          {people.length ? t('{n} people, including you', { n: people.length + 1 }) : t('Choose at least one friend')}
        </Text>
        <Button title={t('Next')} disabled={!people.length} style={{ marginTop: 16 }} onPress={() => setStep('how')} />
      </Screen>
    );

  // How to make the workout.
  if (step === 'how') {
    const option = (m: Mode, icon: 'sparkle' | 'edit' | 'run', head: string, sub: string) => (
      <Card
        key={m}
        onPress={() => {
          setMode(m);
          setFocus(null);
          setStep('plan');
        }}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: m === 'ai' ? c.gAi : c.inset, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name={icon} size={20} color={c.cobalt} />
        </View>
        <View style={{ flex: 1 }}>
          <Text weight={700}>{head}</Text>
          <Text variant="small" color="sec">
            {sub}
          </Text>
        </View>
        <Icon name="chev" size={16} color={c.sec} />
      </Card>
    );
    return (
      <Screen title={t('Train together')} back onBack={() => setStep('people')}>
        <Text variant="h2">{t('How do you want to build it?')}</Text>
        <Text variant="small" color="sec" style={{ marginTop: 4, marginBottom: 12 }}>
          {t('You can change everything before you send it.')}
        </Text>
        {option('ai', 'sparkle', t('Build it with AI'), t('One workout from everyone’s plans, with the right sets for each level.'))}
        {option('own', 'edit', t('I’ll build it'), t('Pick Push, Pull, Legs or another day, then add or remove exercises.'))}
        {option('cardio', 'run', t('Cardio together'), t('Run, bike, row or another cardio, side by side.'))}
      </Screen>
    );
  }

  if (!plan)
    return (
      <Screen title={t('Train together')} back onBack={() => setStep('how')}>
        <Thinking message={t(mode === 'ai' ? 'Matching everyone’s plans…' : 'Loading')} />
      </Screen>
    );

  return (
    <Screen title={t('Train together')} back onBack={() => setStep('how')}>
      <Row gap={0} style={{ justifyContent: 'center' }}>
        {all.map((p, i) => (
          <View key={i} style={{ marginStart: i ? -12 : 0 }}>
            {avatar(p, i, 48)}
          </View>
        ))}
      </Row>
      <Text variant="h2" center style={{ marginTop: 12 }}>
        {t('{w} with {names}', { w: title, names })}
      </Text>
      <Text variant="small" color="sec" center style={{ marginTop: 4 }}>
        {mode === 'cardio'
          ? t('Side by side, about {m} min.', { m: TOG.reduce((a, x) => a + (x.min ?? 0), 0) })
          : t('{n} exercises, about {m} min. Take turns: while one person lifts, the others rest.', { n: TOG.length, m: 45 + all.length * 8 })}
      </Text>
      {mode !== 'cardio' ? (
        // Change the type of day: the AI (or the ready workout) builds it again.
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, marginHorizontal: -20, marginTop: 14 }} contentContainerStyle={{ gap: 8, paddingHorizontal: 20 }}>
          {FOCUS.map((f) => (
            <Chip key={f} title={t(f)} on={(focus ?? plan.title) === f} onPress={() => setFocus(f)} />
          ))}
        </ScrollView>
      ) : null}
      <Card style={{ marginTop: 16 }}>
        <Text variant="xs" weight={700} color="sec">
          {t('Turn order each set')}
        </Text>
        <Row gap={6} style={{ marginTop: 8, flexWrap: 'wrap' }}>
          {all.map((p, i) => (
            <Row key={i} gap={6}>
              {i ? <Icon name="chev" size={14} color={c.sec} /> : null}
              <View style={{ backgroundColor: c.inset, borderRadius: 12, paddingHorizontal: 10, height: 26, justifyContent: 'center' }}>
                <Text variant="xs" weight={700}>
                  {p.name}
                </Text>
              </View>
            </Row>
          ))}
        </Row>
      </Card>
      {all.some((p, i) => noteText(plan.notes[keyOf(p, i)], lang)) ? (
        <Card>
          <Text variant="xs" weight={700} color="sec">
            {t('What joining changes for each person')}
          </Text>
          {all.map((p, i) => {
            const n = plan.notes[keyOf(p, i)];
            if (!noteText(n, lang)) return null;
            return (
              <Row key={i} gap={10} style={{ alignItems: 'flex-start', marginTop: 10 }}>
                {avatar(p, i, 28)}
                <View style={{ flex: 1 }}>
                  <Text variant="small" weight={700}>
                    {p.name}
                  </Text>
                  <Text variant="small" color="sec">
                    {noteText(n, lang)}
                  </Text>
                </View>
              </Row>
            );
          })}
        </Card>
      ) : null}
      {TOG.map((x, i) => {
        const cardio = isCardio(x);
        const info = exInfo({ id: x.id, n: x.n, ar: x.ar, m: x.m }, lang);
        return (
          <Card key={`${x.id}-${i}`}>
            <Row gap={8} style={{ alignItems: 'flex-start' }}>
              <View style={{ flex: 1 }}>
                <Text variant="xs" weight={700} color="sec">{`${i + 1}. ${cardio ? t('Cardio') : muscleLabel(exMuscle(x.id, info.muscle), lang, t)}`}</Text>
                <Text variant="h3">{groupExName(x, lang, t)}</Text>
              </View>
              <Springy
                disabled={TOG.length <= 1}
                onPress={() => setEx(TOG.filter((_, j) => j !== i))}
                accessibilityLabel={t('Remove {name}', { name: groupExName(x, lang, t) })}
                style={{ width: 36, height: 36, alignItems: 'center', justifyContent: 'center', opacity: TOG.length <= 1 ? 0.3 : 1 }}>
                <Icon name="close" size={16} color={c.sec} strokeWidth={2.2} />
              </Springy>
            </Row>
            {cardio ? (
              <Row gap={8} style={{ flexWrap: 'wrap', marginTop: 10 }}>
                {MINUTES.map((m) => (
                  <Chip key={m} title={t('{n} min', { n: m })} on={x.min === m} onPress={() => setEx(TOG.map((y, j) => (j === i ? { ...y, min: m } : y)))} />
                ))}
              </Row>
            ) : (
              <View style={{ marginTop: 8 }}>
                {all.map((p, j) => {
                  const s = scheme(p.level, x.type);
                  return (
                    <Row key={j} gap={10} style={{ paddingVertical: 7, borderTopWidth: 1, borderTopColor: c.line }}>
                      {avatar(p, j, 28)}
                      <Text variant="small" weight={700} style={{ flex: 1 }}>
                        {p.name}
                      </Text>
                      <Text variant="small" num>
                        {s.timed ? t('{a} rounds × {b} s', { a: s.sets, b: s.reps }) : t('{a} sets × {b} reps', { a: s.sets, b: s.reps })}
                      </Text>
                    </Row>
                  );
                })}
              </View>
            )}
          </Card>
        );
      })}
      <Row gap={8} style={{ marginBottom: 12 }}>
        {mode !== 'cardio' ? <Button small kind="soft" icon="plus" title={t('Add exercise')} disabled={TOG.length >= 12} style={{ flex: 1 }} onPress={() => setPick(true)} /> : null}
        <Button small kind="soft" icon="plus" title={t('Add cardio')} disabled={TOG.length >= 12} style={{ flex: 1 }} onPress={() => setCardioPick(true)} />
      </Row>
      <Row gap={8} style={{ alignItems: 'flex-start', paddingHorizontal: 4 }}>
        <Icon name="info" size={16} color={c.sec} />
        <Text variant="small" color="sec" style={{ flex: 1 }}>
          {t('Everyone picks their own weight. When you start, your last weights show in grey like always.')}
        </Text>
      </Row>
      {appFriends.length ? (
        <View>
          <Text variant="small" weight={700} color="sec" style={{ marginTop: 20, marginBottom: 8, marginHorizontal: 4 }}>
            {t('When')}
          </Text>
          <Row gap={8} style={{ flexWrap: 'wrap' }}>
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <Chip key={i} title={dayLabel(i)} on={day === i} onPress={() => setDay(i)} />
            ))}
          </Row>
          <Card style={{ marginTop: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text weight={700}>{t('Start time')}</Text>
            <TimeField value={time} onChange={setTime} label={t('Start time')} />
          </Card>
          <Button title={t('Send invite for {when}', { when: whenText(day) })} loading={busy} style={{ marginTop: 8 }} onPress={sendInvite} />
          <Button kind="cobalt" icon="play" title={t('Start together now')} disabled={busy} style={{ marginTop: 8 }} onPress={startLive} />
          <Button kind="glass" title={t('Start on my phone only')} style={{ marginTop: 8 }} onPress={startLocal} />
        </View>
      ) : (
        <Button icon="play" title={t('Start together now')} style={{ marginTop: 16 }} onPress={startLocal} />
      )}
      <Button kind="glass" title={t('Change people')} style={{ marginTop: 8 }} onPress={() => setStep('people')} />
      <ExercisePicker
        open={pick}
        title={t('Add an exercise')}
        exclude={TOG.map((x) => x.id)}
        injuries={train.plan?.injuries}
        onClose={() => setPick(false)}
        onPick={(e) => {
          setPick(false);
          const pe = toPlanEx(e);
          setEx([...TOG, { id: pe.id, type: pe.time ? 2 : 0, ...(pe.n ? { n: pe.n, ar: pe.ar, m: pe.m } : {}) }]);
        }}
      />
      <Sheet open={cardioPick} onClose={() => setCardioPick(false)}>
        <Text variant="h2">{t('Add cardio')}</Text>
        <Text variant="small" color="sec" style={{ marginTop: 4 }}>
          {t('Everyone does it at the same time.')}
        </Text>
        <Row gap={8} style={{ flexWrap: 'wrap', marginTop: 12 }}>
          {CARDIO_SPORTS.map((sp: SportId) => (
            <Chip
              key={sp}
              title={t(sportInfo(sp).name)}
              onPress={() => {
                setCardioPick(false);
                setEx([...TOG, cardioEx(sp, Math.min(60, sportInfo(sp).minutes))]);
              }}
            />
          ))}
        </Row>
      </Sheet>
      <Sheet open={staleOpen && stale} onClose={() => setStaleOpen(false)}>
        <StaleSessionChoice onDone={() => setStaleOpen(false)} />
      </Sheet>
    </Screen>
  );
}
