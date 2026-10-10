import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { TextInput, View } from 'react-native';

import { LineChart } from '@/components/Charts';
import { Stepper } from '@/components/food/Stepper';
import { Thinking } from '@/components/food/Thinking';
import { Icon } from '@/components/Icon';
import { Screen } from '@/components/Screen';
import { Sheet } from '@/components/Sheet';
import { Avatar } from '@/components/social/Avatar';
import { Text } from '@/components/Text';
import { useToast } from '@/components/Toast';
import { Button, Card, Row } from '@/components/ui';
import { useT } from '@/i18n';
import { useAuth } from '@/lib/auth';
import { ageOf, type ClientLink, clientSummary, type ClientSummary, coachList, endCoaching, getNote, saveNote, setTargets } from '@/lib/coaching';
import { fmt, GOALS } from '@/lib/nutrition';
import { fx, shortDate } from '@/lib/progress';
import { useSettings } from '@/theme/settings';

type Data = { link: string; s: ClientSummary | null; l: ClientLink | null; note: string };

/** Coach: one client's progress, targets, private notes and messages (design: client). */
export default function ClientScreen() {
  const { t, lang } = useT();
  const { colors: c } = useSettings();
  const toast = useToast();
  const { session } = useAuth();
  const { link, id } = useLocalSearchParams<{ link: string; id: string }>();
  const [d, setD] = useState<Data | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [tg, setTg] = useState<{ k: number; p: number } | null>(null);

  const load = useCallback(async () => {
    const [s, all, n] = await Promise.all([clientSummary(id), coachList(), getNote(id)]);
    setD({ link, s, l: all.find((x) => x.id === link) ?? null, note: n });
  }, [id, link]);

  useEffect(() => {
    let alive = true;
    (async () => {
      if (alive) await load();
    })();
    return () => {
      alive = false;
    };
  }, [load]);

  const data = d?.link === link ? d : null;
  if (!data)
    return (
      <Screen title="" back>
        <Thinking message={t('Loading')} />
      </Screen>
    );
  const s = data.s;
  if (!s || !data.l)
    return (
      <Screen title={t('Client')} back>
        <Card style={{ alignItems: 'center' }}>
          <Text color="sec">{t('This person isn’t your client anymore.')}</Text>
        </Card>
      </Screen>
    );
  const l = data.l;
  const name = s.name || s.username;
  const age = ageOf(s.dob);
  const w = s.weights.map((x) => ({ ...x, value: Number(x.value) }));
  const dw = w.length > 1 ? w.at(-1)!.value - w[0].value : null;
  const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
  const kAvg = avg(s.food.map((f) => f.kcal));
  const pAvg = avg(s.food.map((f) => f.protein));
  const sleep = avg(s.checkins.filter((x) => x.sleep_h != null).map((x) => Number(x.sleep_h)));
  const water = avg(s.water.map((x) => x.ml));
  const week = s.workouts.filter((x) => new Date(`${x.day}T12:00:00`) >= new Date(new Date().setDate(new Date().getDate() - 7))).length;
  const lastScore = s.checkins.find((x) => x.score != null)?.score;
  const noteVal = note ?? data.note;

  const stat = (label: string, value: string, sub?: string) => (
    <View key={label} style={{ width: '48.5%', backgroundColor: c.card, borderRadius: 20, padding: 14, marginBottom: 10 }}>
      <Text variant="xs" weight={700} color="sec">
        {label}
      </Text>
      <Text num size={20} style={{ marginTop: 4 }}>
        {value}
      </Text>
      {sub ? (
        <Text variant="xs" weight={700} color="sec">
          {sub}
        </Text>
      ) : null}
    </View>
  );

  return (
    <Screen title={name} back>
      <View style={{ alignItems: 'center' }}>
        <Avatar id={id} name={name} size={72} />
        <Text variant="h2" style={{ marginTop: 10 }}>
          {name}
        </Text>
        <Text variant="small" color="sec">
          {[age != null ? t('{n} years', { n: age }) : null, s.plan.goal != null ? t(GOALS[s.plan.goal]) : null, s.streak ? t('{n}-day streak', { n: s.streak }) : null].filter(Boolean).join(' · ')}
        </Text>
      </View>
      <Row gap={10} style={{ marginTop: 16, marginBottom: 12 }}>
        <Button icon="send" title={t('Message')} style={{ flex: 1 }} onPress={() => router.push({ pathname: '/thread', params: { link, name } })} />
        <Button kind="glass" icon="flame" title={t('Set targets')} style={{ flex: 1 }} onPress={() => setTg({ k: l.kcal ?? 2000, p: l.protein ?? 140 })} />
      </Row>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' }}>
        {stat(t('Targets'), l.kcal ? `${fmt(l.kcal)} kcal` : t('Their plan'), l.protein ? t('{n} g protein', { n: l.protein }) : undefined)}
        {stat(t('Workouts'), t('{n} this week', { n: week }), t('{n} in 4 weeks', { n: s.workouts.length }))}
        {stat(t('Calories'), kAvg != null ? fmt(kAvg) : '–', t('Average, last 14 days'))}
        {stat(t('Protein'), pAvg != null ? `${fmt(pAvg)} ${t('g')}` : '–', t('Average, last 14 days'))}
        {stat(t('Sleep'), sleep != null ? `${fx(sleep)} ${t('h')}` : '–', lastScore != null ? t('Recovery {n}%', { n: lastScore }) : undefined)}
        {stat(t('Water'), water != null ? `${fx(water / 1000)} L` : '–', t('Average, last 7 days'))}
      </View>
      {w.length > 1 ? (
        <Card>
          <Row style={{ justifyContent: 'space-between' }}>
            <Text weight={700}>{t('Weight')}</Text>
            <Text variant="small" weight={700} color="sec">{`${fx(w.at(-1)!.value)} ${t('kg')}${dw != null ? ` (${dw > 0 ? '+' : ''}${fx(dw)})` : ''}`}</Text>
          </Row>
          <View style={{ marginTop: 8 }}>
            <LineChart values={w.map((x) => x.value)} labels={w.map((x, i) => (i === 0 || i === w.length - 1 ? shortDate(x.day, lang) : ''))} height={120} />
          </View>
        </Card>
      ) : null}
      <Card>
        <Text weight={700}>{t('Today’s food')}</Text>
        {s.today.length ? (
          s.today.map((f, i) => (
            <Row key={`${f.name}${i}`} style={{ marginTop: 8 }}>
              <Text variant="small" style={{ flex: 1 }} numberOfLines={1}>
                {f.name}
              </Text>
              <Text variant="small" color="sec" num>{`${fmt(f.kcal)} kcal · ${fmt(Number(f.protein))} ${t('g')}`}</Text>
            </Row>
          ))
        ) : (
          <Text variant="small" color="sec" style={{ marginTop: 4 }}>
            {t('Nothing logged today yet.')}
          </Text>
        )}
      </Card>
      <Card>
        <Text weight={700}>{t('Recent workouts')}</Text>
        {s.workouts.length ? (
          s.workouts.slice(0, 6).map((x, i) => (
            <Row key={`${x.day}${i}`} style={{ marginTop: 8 }}>
              <Icon name="train" size={16} color={c.cobalt} />
              <Text variant="small" weight={700} style={{ flex: 1 }}>
                {t(x.name)}
                {x.prs?.length ? ` 🏆` : ''}
              </Text>
              <Text variant="small" color="sec">{`${shortDate(x.day, lang)} · ${x.minutes} ${t('min')}`}</Text>
            </Row>
          ))
        ) : (
          <Text variant="small" color="sec" style={{ marginTop: 4 }}>
            {t('No workouts in the last 4 weeks.')}
          </Text>
        )}
      </Card>
      <Card>
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
      <Button
        kind="ghost"
        title={t('End coaching')}
        color={c.down}
        onPress={async () => {
          await endCoaching(link);
          toast(t('Coaching ended'), { icon: 'check' });
          router.back();
        }}
      />
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
