import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { TextInput, View } from 'react-native';

import { BarChart, LineChart } from '@/components/Charts';
import { CommitBars, commitTone } from '@/components/coach/Commit';
import { InviteCode, InvitePlans } from '@/components/coach/Invite';
import { TodoCard } from '@/components/coach/TodoCard';
import { Stepper } from '@/components/food/Stepper';
import { Thinking } from '@/components/food/Thinking';
import { Icon, type IconName } from '@/components/Icon';
import { Bar, Ring } from '@/components/Ring';
import { Screen } from '@/components/Screen';
import { Sheet } from '@/components/Sheet';
import { Avatar } from '@/components/social/Avatar';
import { Text } from '@/components/Text';
import { useToast } from '@/components/Toast';
import { Button, Card, Chip, NavButton, Row, Segmented } from '@/components/ui';
import { useT } from '@/i18n';
import { weekdayLetter } from '@/lib/dates';
import { useAuth } from '@/lib/auth';
import {
  ageOf,
  assign,
  type ClientLink,
  clientSummary,
  type ClientSummary,
  coachList,
  coachRanking,
  endCoaching,
  getNote,
  isNewClient,
  listMealPlans,
  listPrograms,
  type MealPlan,
  mealPlanTotals,
  type Program,
  rankClients,
  type RankRow,
  saveNote,
  sendMessage,
  setTargets,
} from '@/lib/coaching';
import { fmt, fmtTime, GOALS } from '@/lib/nutrition';
import { fx, shortDate } from '@/lib/progress';
import { exInfo } from '@/lib/training';
import { useSettings } from '@/theme/settings';
import { goBack } from '@/lib/nav';

type Tab = 'o' | 'f' | 't' | 'h';
type Data = { link: string; s: ClientSummary | null; l: ClientLink | null; note: string; progs: Program[]; meals: MealPlan[]; rank: RankRow[]; now: number };

const nowMs = () => Date.now();
/** "2026-10-10" for a day n days before now. */
const dayKey = (now: number, back: number) => {
  const d = new Date(now - back * 864e5);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/** Coach: one client's commitment, food, training, health, to-dos, notes and plans (design: client). Invites show their code. */
export default function ClientScreen() {
  const { t, lang } = useT();
  const { colors: c } = useSettings();
  const toast = useToast();
  const { session, profile } = useAuth();
  const { link, id } = useLocalSearchParams<{ link: string; id: string }>();
  const [d, setD] = useState<Data | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [tg, setTg] = useState<{ k: number; p: number } | null>(null);
  const [tab, setTab] = useState<Tab>('o');
  const [end, setEnd] = useState(false);

  const load = useCallback(async () => {
    const [s, all, n, progs, meals, rank] = await Promise.all([id ? clientSummary(id) : null, coachList(), id ? getNote(id) : '', listPrograms(), listMealPlans(), id ? coachRanking() : []]);
    setD({ link, s, l: all.find((x) => x.id === link) ?? null, note: n, progs, meals, rank, now: nowMs() });
  }, [id, link]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const data = d?.link === link ? d : null;
  if (!data)
    return (
      <Screen title="" back>
        <Thinking message={t('Loading')} />
      </Screen>
    );
  const l = data.l;

  // An invite nobody used yet: the code, how to send it, and plans to start with.
  if (l?.status === 'invited')
    return (
      <Screen title={l.code ?? t('Invite')} back>
        <View style={{ alignItems: 'center' }}>
          <Icon name="key" size={34} color={c.cobalt} />
          <Text variant="h2" style={{ marginTop: 8 }}>
            {t('Waiting to join')}
          </Text>
          <Text variant="small" color="sec" center>
            {t('Their details show up here after they join with this code.')}
          </Text>
        </View>
        <InviteCode code={l.code ?? ''} coach={profile?.name || profile?.username || ''} />
        <Button
          kind="ghost"
          title={t('Cancel this invite')}
          color={c.down}
          onPress={async () => {
            await endCoaching(l.id);
            toast(t('Invite cancelled'), { icon: 'trash' });
            goBack();
          }}
        />
        <InvitePlans link={l} progs={data.progs} meals={data.meals} onChange={load} />
        <View style={{ height: 20 }} />
      </Screen>
    );

  const s = data.s;
  if (!s || !l)
    return (
      <Screen title={t('Client')} back>
        <Card style={{ alignItems: 'center' }}>
          <Text color="sec">{t('This person isn’t your client anymore.')}</Text>
        </Card>
      </Screen>
    );

  const name = s.name || s.username;
  const now = data.now;
  const age = ageOf(s.dob);
  const ranked = rankClients(data.rank, now);
  const me = ranked.find((x) => x.link_id === link) ?? null;
  const isNew = !me || isNewClient(me, now) || me.commit == null;
  const rankNo = ranked.filter((x) => !isNewClient(x, now) && x.commit != null).findIndex((x) => x.link_id === link) + 1;
  const rankOf = ranked.filter((x) => !isNewClient(x, now) && x.commit != null).length;
  const commit = me?.commit ?? 0;
  const kT = s.targets?.kcal ?? l.kcal ?? 2000;
  const pT = s.targets?.protein ?? l.protein ?? 120;
  const prog = data.progs.find((x) => x.id === l.program_id) ?? null;
  const meal = data.meals.find((x) => x.id === l.meal_plan_id) ?? null;
  const noteVal = note ?? data.note;
  const newProg = (k: 'p' | 'm') => router.push({ pathname: k === 'p' ? '/progedit' : '/mealedit', params: { assign: link } });

  const nudge = async () => {
    const r = await sendMessage(link, t('Check-in reminder: how is it going? Please log your food and check in today.'), 'nudge');
    toast(r ? t('Check-in reminder sent') : t('Couldn’t send. Please try again.'), { icon: r ? 'bell' : 'warn' });
  };

  const plans = (
    <Card>
      <Text weight={700}>{t('Plans for {n}', { n: name })}</Text>
      {l.package ? (
        <Text variant="small" color="sec" style={{ marginTop: 2 }}>
          {t('Package: {p}', { p: t(l.package) })}
        </Text>
      ) : null}
      <Text variant="xs" weight={700} color="sec" style={{ marginTop: 10 }}>
        {t('Workout program')}
      </Text>
      <Row gap={6} style={{ flexWrap: 'wrap', marginTop: 6 }}>
        <Chip title={t('AI plans it')} on={!l.program_id} onPress={async () => (await assign(link, null, l.meal_plan_id), load())} />
        {data.progs.map((x) => (
          <Chip
            key={x.id}
            title={x.name}
            on={l.program_id === x.id}
            onPress={async () => {
              if (await assign(link, x.id, l.meal_plan_id)) toast(t('{p} sent to {n}', { p: x.name, n: name }), { icon: 'check' });
              load();
            }}
          />
        ))}
        <Chip title={`+ ${t('New')}`} onPress={() => newProg('p')} />
      </Row>
      <Text variant="xs" weight={700} color="sec" style={{ marginTop: 10 }}>
        {t('Meal plan')}
      </Text>
      <Row gap={6} style={{ flexWrap: 'wrap', marginTop: 6 }}>
        <Chip title={t('AI plans it')} on={!l.meal_plan_id} onPress={async () => (await assign(link, l.program_id, null), load())} />
        {data.meals.map((x) => (
          <Chip
            key={x.id}
            title={x.name}
            on={l.meal_plan_id === x.id}
            onPress={async () => {
              if (await assign(link, l.program_id, x.id)) toast(t('{p} sent to {n}', { p: x.name, n: name }), { icon: 'check' });
              load();
            }}
          />
        ))}
        <Chip title={`+ ${t('New')}`} onPress={() => newProg('m')} />
      </Row>
      <Button small kind="soft" icon="flame" title={t('Set targets')} style={{ marginTop: 12, alignSelf: 'flex-start' }} onPress={() => setTg({ k: l.kcal ?? kT, p: l.protein ?? pT })} />
    </Card>
  );

  const overview = () => {
    const w = s.weights.map((x) => ({ ...x, value: Number(x.value) }));
    const dw = w.length > 1 ? w.at(-1)!.value - w[0].value : null;
    return (
      <>
        {isNew ? (
          <Card style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
            <Icon name="info" size={20} color={c.cobalt} />
            <Text variant="small" style={{ flex: 1 }}>
              <Text variant="small" weight={700}>
                {t('{n} just joined.', { n: name })}
              </Text>
              {` ${t('Their weight, food, training and commitment show up here as they log. Ranking starts after their first week.')}`}
            </Text>
          </Card>
        ) : null}
        {w.length > 1 ? (
          <Card>
            <Row style={{ justifyContent: 'space-between' }}>
              <Text variant="small" weight={700}>
                {t('Weight')}
              </Text>
              <Text variant="xs" weight={700} color="sec">{`${fx(w.at(-1)!.value)} ${t('kg')}${dw != null ? ` (${dw > 0 ? '+' : ''}${fx(dw)})` : ''}`}</Text>
            </Row>
            <View style={{ marginTop: 8 }}>
              <LineChart values={w.map((x) => x.value)} labels={w.map((x, i) => (i === 0 || i === w.length - 1 ? shortDate(x.day, lang) : ''))} height={110} />
            </View>
          </Card>
        ) : null}
        {me?.parts && !isNew ? (
          <Card>
            <Text variant="small" weight={700}>
              {t('Commitment, last 30 days')}
            </Text>
            <CommitBars p={me.parts} />
          </Card>
        ) : null}
        <TodoCard link={link} name={name} />
        {plans}
        <Row gap={10} style={{ marginTop: 4 }}>
          <Button kind="glass" icon="send" title={t(isNew ? 'Say hi' : 'Message')} style={{ flex: 1 }} onPress={() => router.push({ pathname: '/thread', params: { link, name, client: id } })} />
          <Button kind="soft" icon="bell" title={t('Nudge')} style={{ flex: 1 }} onPress={nudge} />
        </Row>
        <Card style={{ marginTop: 12 }}>
          <Row gap={8}>
            <Icon name="lock" size={16} color={c.sec} />
            <Text weight={700}>{t('Private notes')}</Text>
          </Row>
          <TextInput
            value={noteVal}
            onChangeText={setNote}
            multiline
            maxLength={2000}
            placeholder={t('Only you can see these notes.')}
            placeholderTextColor={c.sec}
            style={{ marginTop: 8, minHeight: 90, borderRadius: 14, backgroundColor: c.inset, padding: 12, fontSize: 15, color: c.text, textAlignVertical: 'top' }}
          />
          {note != null && note !== data.note ? (
            <Button
              small
              title={t('Save notes')}
              style={{ marginTop: 8 }}
              onPress={async () => {
                if (session && (await saveNote(session.user.id, id, note))) {
                  setD({ ...data, note });
                  setNote(null);
                  toast(t('Notes saved'), { icon: 'check' });
                } else toast(t('Couldn’t save. Please try again.'), { icon: 'warn' });
              }}
            />
          ) : null}
        </Card>
        <Button kind="ghost" title={t('End coaching with {n}', { n: name })} color={c.down} onPress={() => setEnd(true)} />
      </>
    );
  };

  const food = () => {
    const k = s.today.reduce((a, x) => a + Number(x.kcal), 0);
    const p = s.today.reduce((a, x) => a + Number(x.protein), 0);
    const byDay = new Map(s.food.map((x) => [x.day, Number(x.kcal)]));
    const days = [6, 5, 4, 3, 2, 1, 0].map((b) => dayKey(now, b));
    const labels = days.map((x, i) => (i === 6 ? t('Today') : weekdayLetter(new Date(`${x}T12:00:00`).getDay(), lang)));
    return (
      <>
        <Card>
          <Row style={{ justifyContent: 'space-between' }}>
            <Text variant="small" weight={700}>
              {t('Today')}
            </Text>
            <Text variant="xs" weight={700} color="sec">
              {t('Goal {k} kcal, {p} g protein', { k: fmt(kT), p: pT })}
            </Text>
          </Row>
          <Row gap={12} style={{ marginTop: 10 }}>
            {(
              [
                [k, kT, `${fmt(k)} kcal`, c.cobalt],
                [p, pT, t('{n} g protein', { n: Math.round(p) }), c.up],
              ] as [number, number, string, string][]
            ).map(([v, m, lab, col]) => (
              <View key={lab} style={{ flex: 1 }}>
                <Text variant="small" weight={700} num>
                  {lab}
                </Text>
                <View style={{ marginTop: 4 }}>
                  <Bar value={v} max={m} color={col} />
                </View>
              </View>
            ))}
          </Row>
        </Card>
        <Text variant="small" weight={700} color="sec" style={{ marginHorizontal: 4, marginBottom: 8 }}>
          {t('What {n} ate today', { n: name })}
        </Text>
        <Card>
          {s.today.length ? (
            s.today.map((f, i) => (
              <Row key={`${f.name}${i}`} style={{ marginTop: i ? 10 : 0 }}>
                <View style={{ flex: 1 }}>
                  <Text variant="small" weight={700} numberOfLines={1}>
                    {f.name}
                  </Text>
                  {f.meal ? (
                    <Text variant="xs" color="sec">
                      {t(f.meal)}
                    </Text>
                  ) : null}
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text variant="small" num weight={700}>
                    {fmt(Number(f.kcal))}
                  </Text>
                  <Text variant="xs" color="sec">
                    {t('{n} g protein', { n: Math.round(Number(f.protein)) })}
                  </Text>
                </View>
              </Row>
            ))
          ) : (
            <Text variant="small" color="sec" center>
              {t('Nothing logged today.')}
            </Text>
          )}
        </Card>
        <Card>
          <Text variant="small" weight={700}>
            {t('Calories, last 7 days')}
          </Text>
          <View style={{ marginTop: 8 }}>
            <BarChart values={days.map((x) => byDay.get(x) ?? 0)} labels={labels} highlight={6} goal={kT} height={130} />
          </View>
        </Card>
        <Text variant="small" weight={700} color="sec" style={{ marginHorizontal: 4, marginBottom: 8 }}>
          {t('Meal plan')}
        </Text>
        {meal ? (
          <Card>
            <Row style={{ justifyContent: 'space-between' }}>
              <Text weight={700}>{meal.name}</Text>
              <Text variant="xs" weight={700} color="sec">
                {t('{k} kcal, {p} g protein', { k: fmt(mealPlanTotals(meal).kcal), p: mealPlanTotals(meal).protein })}
              </Text>
            </Row>
            {meal.meals.map((m, i) => (
              <Row key={i} style={{ marginTop: 10, alignItems: 'flex-start' }}>
                <View style={{ flex: 1 }}>
                  <Text variant="small" weight={700}>{`${m.n}, ${fmtTime(m.t, lang)}`}</Text>
                  {m.d ? (
                    <Text variant="xs" color="sec">
                      {m.d}
                    </Text>
                  ) : null}
                </View>
                <Text variant="small" num weight={700}>
                  {fmt(m.k)}
                </Text>
              </Row>
            ))}
            <Button small kind="glass" icon="edit" title={t('Edit this meal plan')} style={{ marginTop: 12 }} onPress={() => router.push({ pathname: '/mealedit', params: { id: meal.id } })} />
          </Card>
        ) : (
          <Card style={{ alignItems: 'center' }}>
            <Text variant="small" color="sec" center>
              {t('No meal plan from you. The AI suggests meals for {n}.', { n: name })}
            </Text>
          </Card>
        )}
      </>
    );
  };

  const training = () => {
    const weeks = [6, 5, 4, 3, 2, 1, 0].map((wk) => {
      const from = dayKey(now, wk * 7 + 6);
      const to = dayKey(now, wk * 7);
      return s.workouts.filter((x) => x.day >= from && x.day <= to).length;
    });
    return (
      <>
        <Text variant="small" weight={700} color="sec" style={{ marginHorizontal: 4, marginBottom: 8 }}>
          {t('Recent workouts')}
        </Text>
        <Card>
          {s.workouts.length ? (
            s.workouts.slice(0, 8).map((x, i) => (
              <Row key={`${x.day}${i}`} style={{ marginTop: i ? 10 : 0 }}>
                <Icon name="train" size={16} color={c.cobalt} />
                <View style={{ flex: 1 }}>
                  <Text variant="small" weight={700}>
                    {t(x.name)}
                  </Text>
                  <Text variant="xs" color="sec">
                    {`${shortDate(x.day, lang)}, ${x.minutes} ${t('min')}${x.prs?.length ? `, ${t('{n} new records', { n: x.prs.length })}` : ''}`}
                  </Text>
                </View>
              </Row>
            ))
          ) : (
            <Text variant="small" color="sec" center>
              {t('No workouts in the last 7 weeks.')}
            </Text>
          )}
        </Card>
        <Card>
          <Text variant="small" weight={700}>
            {t('Workouts per week')}
          </Text>
          <View style={{ marginTop: 8 }}>
            <BarChart values={weeks} labels={['W1', 'W2', 'W3', 'W4', 'W5', 'W6', t('Now')]} highlight={6} goal={s.targets?.days} height={120} />
          </View>
        </Card>
        <Text variant="small" weight={700} color="sec" style={{ marginHorizontal: 4, marginBottom: 8 }}>
          {t('Program')}
        </Text>
        {prog ? (
          <>
            {prog.days.map((dd, i) => (
              <Card key={i}>
                <Row style={{ justifyContent: 'space-between' }}>
                  <Text weight={700}>{dd.name}</Text>
                  <Text variant="xs" weight={700} color="sec">
                    {t('{n} exercises', { n: dd.ex.length })}
                  </Text>
                </Row>
                {dd.ex.map((x, j) => (
                  <Row key={`${x.id}${j}`} style={{ marginTop: 8, justifyContent: 'space-between' }}>
                    <Text variant="small" style={{ flex: 1 }}>
                      {exInfo(x, lang).name}
                    </Text>
                    <Text variant="small" num weight={700} color="sec">{`${x.sets} × ${x.reps}`}</Text>
                  </Row>
                ))}
              </Card>
            ))}
            <Button small kind="glass" icon="edit" title={t('Edit this program')} onPress={() => router.push({ pathname: '/progedit', params: { id: prog.id } })} />
          </>
        ) : (
          <Card style={{ alignItems: 'center' }}>
            <Text variant="small" color="sec" center>
              {t('No program from you. The AI plans {n}’s workouts.', { n: name })}
            </Text>
          </Card>
        )}
      </>
    );
  };

  const health = () => {
    const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
    const week = dayKey(now, 6);
    const today = dayKey(now, 0);
    const sleep = avg(s.checkins.filter((x) => x.day >= week && x.sleep_h != null).map((x) => Number(x.sleep_h)));
    const rec = s.checkins.find((x) => x.score != null);
    const steps = s.steps?.find((x) => x.day === today)?.steps ?? null;
    const water = s.water.find((x) => x.day === today)?.ml ?? null;
    const energy = avg(s.checkins.filter((x) => x.day >= week && x.energy != null).map((x) => Number(x.energy)));
    const tiles: [IconName, string, string, string, boolean | null][] = [
      ['moon', t('Sleep'), sleep != null ? `${fx(sleep)} ${t('h')}` : '—', t('7-day average'), sleep != null ? sleep >= 7 : null],
      ['pulse', t('Recovery'), rec?.score != null ? `${rec.score}%` : '—', rec ? (rec.day === today ? t('Today') : shortDate(rec.day, lang)) : t('Today'), rec?.score != null ? rec.score >= 60 : null],
      ['walk', t('Steps'), steps != null ? fmt(steps) : '—', t('Today'), steps != null ? steps >= 7000 : null],
      ['drop', t('Water'), water != null ? `${fx(water / 1000)} L` : '—', t('Today'), water != null ? water >= (s.targets?.water ?? 2500) * 0.9 : null],
      ['bolt', t('Energy'), energy != null ? `${fx(energy)} / 5` : '—', t('7-day average'), energy != null ? energy >= 3 : null],
    ];
    return (
      <>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' }}>
          {tiles.map(([ic, n, v, sub, ok]) => (
            <View key={n} style={{ width: '48.5%', backgroundColor: c.card, borderRadius: 20, padding: 14, marginBottom: 10 }}>
              <Row style={{ justifyContent: 'space-between' }}>
                <Text variant="xs" weight={700} color="sec">
                  {n}
                </Text>
                <Icon name={ic} size={15} color={ok == null ? c.sec : ok ? c.up : c.down} />
              </Row>
              <Text num size={20} style={{ marginTop: 4 }}>
                {v}
              </Text>
              <Text variant="xs" color="sec">
                {sub}
              </Text>
            </View>
          ))}
        </View>
        <Text variant="xs" color="sec" style={{ marginHorizontal: 4, marginTop: 4 }}>
          {t('{n} chose to share these with you. Cycle and personal notes are never shared.', { n: name })}
        </Text>
      </>
    );
  };

  return (
    <Screen title={name} back right={<NavButton icon="send" label={t('Message')} onPress={() => router.push({ pathname: '/thread', params: { link, name, client: id } })} />}>
      <Row gap={14}>
        <Avatar id={id} name={name} size={64} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text variant="h2">{name}</Text>
          <Text variant="small" color="sec">
            {[s.plan.goal != null ? t(GOALS[s.plan.goal]) : t('Goal not set yet'), s.gender ? t(s.gender) : null, age != null ? t('{n} years', { n: age }) : null].filter(Boolean).join(', ')}
          </Text>
          <Text variant="xs" weight={700} style={{ marginTop: 4 }}>
            {l.package ? `${t(l.package)} · ` : ''}
            {isNew ? t('New client') : [t('Rank #{a} of {b}', { a: rankNo, b: rankOf }), s.streak ? t('{n}-day streak', { n: s.streak }) : null].filter(Boolean).join(' · ')}
          </Text>
        </View>
        {!isNew ? (
          <Ring value={commit} max={100} size={62} stroke={6} color={commitTone(commit, c)}>
            <Text num size={15}>{`${commit}%`}</Text>
          </Ring>
        ) : null}
      </Row>
      <View style={{ marginTop: 16, marginBottom: 14 }}>
        <Segmented<Tab>
          value={tab}
          options={[
            { value: 'o', label: t('Overview') },
            { value: 'f', label: t('Food') },
            { value: 't', label: t('Training') },
            { value: 'h', label: t('Health') },
          ]}
          onChange={setTab}
        />
      </View>
      {tab === 'o' ? overview() : tab === 'f' ? food() : tab === 't' ? training() : health()}
      <View style={{ height: 16 }} />
      <Sheet open={end} onClose={() => setEnd(false)}>
        <Text variant="h2" center>
          {t('End coaching with {n}?', { n: name })}
        </Text>
        <Text color="sec" center style={{ marginTop: 4 }}>
          {t('They go back to the AI coach. This frees a spot.')}
        </Text>
        <Button
          kind="danger"
          title={t('End coaching')}
          style={{ marginTop: 16 }}
          onPress={async () => {
            await endCoaching(link);
            setEnd(false);
            toast(t('Spot freed'), { icon: 'check' });
            goBack();
          }}
        />
        <Button kind="ghost" title={t('Cancel')} style={{ marginTop: 8 }} onPress={() => setEnd(false)} />
      </Sheet>
      <Sheet open={!!tg} onClose={() => setTg(null)}>
        {tg ? (
          <View>
            <Text variant="h2">{t('Set targets for {n}', { n: name })}</Text>
            <Text variant="small" color="sec" style={{ marginTop: 4 }}>
              {t('These replace their own calorie and protein goals until you change them.')}
            </Text>
            <Text weight={700} style={{ marginTop: 16 }}>
              {t('Calories a day')}
            </Text>
            <Card style={{ marginTop: 8 }}>
              <Stepper onMinus={() => setTg({ ...tg, k: Math.max(800, tg.k - 50) })} onPlus={() => setTg({ ...tg, k: Math.min(6000, tg.k + 50) })} labels={[t('Less'), t('More')]}>
                <Text num size={28}>
                  {fmt(tg.k)}
                </Text>
              </Stepper>
            </Card>
            <Text weight={700}>{t('Protein a day (g)')}</Text>
            <Card style={{ marginTop: 8 }}>
              <Stepper onMinus={() => setTg({ ...tg, p: Math.max(20, tg.p - 5) })} onPlus={() => setTg({ ...tg, p: Math.min(400, tg.p + 5) })} labels={[t('Less'), t('More')]}>
                <Text num size={28}>
                  {tg.p}
                </Text>
              </Stepper>
            </Card>
            <Button
              title={t('Save')}
              onPress={async () => {
                const ok = await setTargets(link, tg.k, tg.p);
                setTg(null);
                toast(ok ? t('Targets sent to {n}', { n: name }) : t('Couldn’t save. Please try again.'), { icon: ok ? 'check' : 'warn' });
                load();
              }}
            />
          </View>
        ) : null}
      </Sheet>
    </Screen>
  );
}
