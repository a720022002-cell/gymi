import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { TextInput, View } from 'react-native';

import { useT } from '@/i18n';
import { useAuth } from '@/lib/auth';
import { goalOf } from '@/lib/cardioCoach';
import { ageOf } from '@/lib/coaching';
import { useFood } from '@/lib/food';
import { MEAS, MEAS_INFO, type MeasKind, useHealth } from '@/lib/health';
import { addDays, targetFits } from '@/lib/nutrition';
import { takePhoto } from '@/lib/photo';
import { useTrain } from '@/lib/train';
import { armGap, hasOneArm, oneArmPlan, twoArmCount } from '@/lib/training';
import { fx, shortDate, weekAvg } from '@/lib/progress';
import { useWeight } from '@/lib/units';
import { useSettings } from '@/theme/settings';

import { Icon, Mark } from '../Icon';
import { afterSheet, Sheet } from '../Sheet';
import { Text } from '../Text';
import { useToast } from '../Toast';
import { Button, Card, Chip, Label, Row, Springy } from '../ui';
import { WeightWheel } from '../health/bits';
import { ReadingInsight } from '../health/ReadingInsight';
import { SecHead } from './bits';
import { WeightChart } from './WeightChart';

/** Weight, measurements and progress photos (design: progWeightBody). */
export function Body() {
  const { t } = useT();
  return (
    <View>
      <Text variant="h2" style={{ marginHorizontal: 4, marginBottom: 12 }}>
        {t('Weight')}
      </Text>
      <Weight />
      <MeasHead />
      <Measurements />
      <Photos />
    </View>
  );
}

const longDate = (d: string, lang: 'en' | 'ar') =>
  new Intl.DateTimeFormat(lang === 'ar' ? 'ar-u-nu-latn' : 'en-US', { weekday: 'short', month: 'short', day: 'numeric', year: d.slice(0, 4) === String(new Date().getFullYear()) ? undefined : 'numeric' }).format(new Date(`${d}T12:00:00`));

function Weight() {
  // Body weight in your unit (kg or lb); saved in kg.
  const W = useWeight();
  const { t, lang } = useT();
  const { colors: c } = useSettings();
  const toast = useToast();
  const { profile } = useAuth();
  const food = useFood();
  const health = useHealth();
  const [open, setOpen] = useState(false);
  // Every weigh-in, newest first; tap one to fix or delete it.
  const [history, setHistory] = useState(false);
  const [editDay, setEditDay] = useState<string | null>(null);
  const [ev, setEv] = useState(0);
  const [busy, setBusy] = useState(false);
  // The weigh-in picked on the chart (its day), shown under it with that day's other readings.
  const [pickDay, setPickDay] = useState<string | null>(null);
  const w = health.weights.slice(-30);
  const cur = w.at(-1);
  const a = weekAvg(health.weights, food.today);
  const b = weekAvg(health.weights, addDays(food.today, -7));
  const goal = food.plan.goal;
  // Your target weight from the calorie plan (a cut or bulk): a dashed line on the chart.
  const target = targetFits(goal, food.plan.weight, food.plan.targetWeight) ? (food.plan.targetWeight as number) : null;
  const [v, setV] = useState(0);
  const openSheet = () => {
    setV(cur?.value ?? Number(profile?.weight_kg ?? 75));
    setOpen(true);
  };
  const sel = pickDay ? w.findIndex((x) => x.day === pickDay) : -1;
  const picked = sel >= 0 ? w[sel] : null;
  const before = sel > 0 ? w[sel - 1] : null;
  // Tape measurements and body fat taken that same day.
  const sameDay = picked ? health.measures.filter((m) => m.day === picked.day && m.kind !== 'weight' && MEAS_INFO[m.kind as keyof typeof MEAS_INFO]) : [];
  // Weekly averages, now against 4 weeks ago (or your first full week when that's newer), so one heavy day doesn't flip it.
  const oldest = health.weights[0]?.day;
  const back = addDays(food.today, -28);
  const thenEnd = oldest && oldest > addDays(back, -6) ? addDays(oldest, 6) : back;
  const then = thenEnd < addDays(food.today, -6) ? weekAvg(health.weights, thenEnd) : null;
  const change = a != null && then != null ? a - then : null;
  let note: string | null = null;
  if (change != null) {
    const vars = { n: `${change > 0 ? '+' : '−'}${W.show(Math.abs(change))}`, d: shortDate(addDays(thenEnd, -6), lang) };
    if (goal === 2)
      note = Math.abs(change) < 1 ? W.words(t('Your weight is steady: {n} kg since the week of {d}. Right where you want it.', vars)) : W.words(t('Your weight moved {n} kg since the week of {d}. If it keeps going that way, I’ll suggest adjusting calories.', vars));
    else
      note = (goal >= 3 ? change < 0 : change > 0)
        ? W.words(t('You’re on track. {n} kg since the week of {d}. If your weight stays flat for two weeks, I’ll suggest adjusting calories.', vars))
        : W.words(t('Your weight is going the other way ({n} kg since the week of {d}, comparing weekly averages). Weigh in a few more mornings.', vars));
  }
  return (
    <View>
      <Card>
        {cur ? (
          <>
            <Row style={{ justifyContent: 'space-between', alignItems: 'flex-end' }}>
              <View>
                <Text variant="small" weight={700} color="sec">
                  {t(cur.day === food.today ? 'Today' : 'Latest')}
                </Text>
                <Text num size={34}>
                  {W.show(cur.value)}
                  <Text num size={18} weight={500} color="sec">{` ${W.label}`}</Text>
                </Text>
              </View>
              {a != null ? (
                <View style={{ alignItems: 'flex-end' }}>
                  <Text variant="small" weight={700} color="sec">
                    {t('Weekly average')}
                  </Text>
                  <Text num size={20}>{W.text(a)}</Text>
                  {b != null ? (
                    <Text variant="small" weight={700} color={(a - b < 0) === goal >= 3 ? 'up' : 'sec'}>
                      {`${a - b < 0 ? '↓' : '↑'} ${W.show(Math.abs(a - b))} ${t('vs last week')}`}
                    </Text>
                  ) : null}
                </View>
              ) : null}
            </Row>
            {w.length > 1 ? (
              <View style={{ marginTop: 16 }}>
                <WeightChart
                  points={w.map((x) => ({ day: x.day, value: W.num(x.value) }))}
                  target={target != null ? W.num(target) : null}
                  labels={{ target: t('Target'), current: t('Now'), num: (n) => `${fx(n)} ${W.label}` }}
                  dateLabel={(d) => shortDate(d, lang)}
                  selected={sel >= 0 ? sel : null}
                  onSelect={(i) => setPickDay(i == null ? null : w[i].day)}
                />
                {picked ? (
                  <View style={{ marginTop: 10, backgroundColor: c.inset, borderRadius: 16, padding: 12 }}>
                    <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <View style={{ flex: 1 }}>
                        <Text variant="small" weight={700} color="sec">
                          {longDate(picked.day, lang)}
                        </Text>
                        <Text num size={22}>
                          {W.text(picked.value)}
                        </Text>
                        {before ? (
                          <Text variant="xs" weight={700} color="sec">
                            {Math.abs(picked.value - before.value) < 0.05 ? t('Same as the weigh-in before') : t('{n} since {d}', { n: `${picked.value > before.value ? '+' : '−'}${W.text(Math.abs(picked.value - before.value))}`, d: shortDate(before.day, lang) })}
                          </Text>
                        ) : null}
                      </View>
                      <Button small kind="soft" icon="edit" title={t('Edit')} onPress={() => (setEv(picked.value), setEditDay(picked.day), setHistory(true))} />
                    </Row>
                    {sameDay.length ? (
                      <View style={{ marginTop: 10, borderTopWidth: 1, borderTopColor: c.line, paddingTop: 8 }}>
                        <Text variant="xs" weight={700} color="sec">
                          {t('Also that day')}
                        </Text>
                        {sameDay.map((m) => {
                          const [n, u] = MEAS_INFO[m.kind as keyof typeof MEAS_INFO];
                          return (
                            <Row key={m.kind} style={{ justifyContent: 'space-between', marginTop: 4 }}>
                              <Text variant="small">{t(n)}</Text>
                              <Text variant="small" weight={700} num>{`${fx(m.value)} ${u}`}</Text>
                            </Row>
                          );
                        })}
                      </View>
                    ) : null}
                  </View>
                ) : (
                  <Text variant="xs" color="sec" center style={{ marginTop: 6 }}>
                    {t('Tap a dot to see that day')}
                  </Text>
                )}
                <Springy onPress={() => (setEditDay(null), setHistory(true))} accessibilityRole="button" style={{ marginTop: 8, alignSelf: 'center', padding: 4 }}>
                  <Text variant="xs" weight={700} color="link">
                    {t('See every weigh-in')}
                  </Text>
                </Springy>
              </View>
            ) : (
              <Text variant="small" color="sec" style={{ marginTop: 8 }}>
                {t('Log your weight again on another day to see the chart.')}
              </Text>
            )}
          </>
        ) : (
          <View style={{ alignItems: 'center', paddingVertical: 12 }}>
            <Icon name="scale" size={30} color={c.sec} />
            <Text variant="h3" style={{ marginTop: 8 }}>
              {t('No weight yet')}
            </Text>
            <Text variant="small" color="sec" center style={{ marginTop: 4 }}>
              {t('Log your morning weight to start your chart.')}
            </Text>
          </View>
        )}
      </Card>
      <Button icon="plus" title={t('Log weight')} onPress={openSheet} />
      {note ? (
        <Card style={{ marginTop: 12, flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
          <Mark size={22} color={c.cobalt} stroke={4.5} />
          <Text variant="small" style={{ flex: 1 }}>
            {note}
          </Text>
        </Card>
      ) : null}
      <Sheet open={history} onClose={() => (setHistory(false), setEditDay(null))}>
        {editDay ? (
          <View>
            <Text variant="h2">{t('Fix this weigh-in')}</Text>
            <Text color="sec" style={{ marginTop: 4 }}>
              {longDate(editDay, lang)}
            </Text>
            <Card style={{ marginTop: 16, paddingVertical: 4 }}>
              <WeightWheel value={ev} onChange={setEv} />
            </Card>
            <Button
              title={t('Save')}
              loading={busy}
              style={{ marginTop: 8 }}
              onPress={async () => {
                setBusy(true);
                const ok = await health.fixWeight(editDay, ev);
                setBusy(false);
                toast(ok ? W.words(t('Weight saved: {n} kg', { n: W.show(ev) })) : t('Couldn’t save. Please try again.'), { icon: ok ? 'scale' : 'warn' });
                if (ok) setEditDay(null);
              }}
            />
            <Button
              kind="ghost"
              icon="trash"
              title={t('Delete this weigh-in')}
              color={c.down}
              style={{ marginTop: 8 }}
              onPress={async () => {
                const day = editDay;
                const old = health.weights.find((x) => x.day === day)?.value;
                const ok = await health.fixWeight(day, null);
                if (!ok) return toast(t('Couldn’t save. Please try again.'), { icon: 'warn' });
                setEditDay(null);
                toast(t('Weigh-in deleted'), { icon: 'trash', undo: old != null ? () => health.fixWeight(day, old) : undefined });
              }}
            />
            <Button kind="ghost" title={t('Back')} style={{ marginTop: 4 }} onPress={() => setEditDay(null)} />
          </View>
        ) : (
          <View>
            <Text variant="h2">{t('Every weigh-in')}</Text>
            <Text variant="small" color="sec" style={{ marginTop: 4 }}>
              {t('Tap one to fix it or delete it.')}
            </Text>
            <View style={{ marginTop: 12, backgroundColor: c.inset, borderRadius: 20, overflow: 'hidden' }}>
              {[...health.weights].reverse().map((x, i, arr) => {
                const prev = arr[i + 1];
                const d = prev ? x.value - prev.value : null;
                return (
                  <Springy
                    key={x.day}
                    onPress={() => (setEv(x.value), setEditDay(x.day))}
                    scaleTo={0.99}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 54, paddingHorizontal: 14, borderTopWidth: i ? 1 : 0, borderTopColor: c.line }}>
                    <Text style={{ flex: 1 }}>{longDate(x.day, lang)}</Text>
                    {d != null && Math.abs(d) >= 0.05 ? (
                      <Text variant="small" weight={700} color={Math.abs(d) >= 3 ? 'down' : 'sec'} num>
                        {`${d > 0 ? '+' : '−'}${W.show(Math.abs(d))}`}
                      </Text>
                    ) : null}
                    <Text num weight={700}>{W.text(x.value)}</Text>
                    <Icon name="edit" size={16} color={c.sec} />
                  </Springy>
                );
              })}
            </View>
            <Text variant="xs" color="sec" style={{ marginTop: 8 }}>
              {t('A jump of 3 kg or more from the day before is shown in red: it may be a typo.')}
            </Text>
          </View>
        )}
      </Sheet>
      <Sheet open={open} onClose={() => setOpen(false)}>
        <Text variant="h2">{t('Log weight')}</Text>
        <Card style={{ marginTop: 16, paddingVertical: 4 }}>{open ? <WeightWheel value={v} onChange={setV} /> : null}</Card>
        <Row gap={8} style={{ alignItems: 'flex-start' }}>
          <Icon name="info" size={18} color={c.sec} />
          <Text variant="small" color="sec" style={{ flex: 1 }}>
            {t('Weigh yourself after using the bathroom, before eating or drinking.')}
          </Text>
        </Row>
        <Button
          title={t('Save')}
          style={{ marginTop: 16 }}
          onPress={async () => {
            setOpen(false);
            const ok = await health.logWeight(v);
            toast(ok ? W.words(t('Weight saved: {n} kg', { n: W.show(v) })) : t('Couldn’t save. Please try again.'), { icon: ok ? 'scale' : 'warn' });
          }}
        />
      </Sheet>
    </View>
  );
}

/** "Measurements" with "See all" (every entry: edit, delete, compare two dates) once there is one. */
function MeasHead() {
  const { t } = useT();
  const health = useHealth();
  const any = health.measures.some((m) => m.kind !== 'weight');
  return (
    <Row style={{ justifyContent: 'space-between', alignItems: 'center', marginHorizontal: 4, marginTop: 28, marginBottom: 12 }}>
      <Text variant="h2">{t('Measurements')}</Text>
      {any ? (
        <Springy onPress={() => router.push('/measurements')} accessibilityRole="link">
          <Text variant="small" weight={700} color="link">
            {t('See all')}
          </Text>
        </Springy>
      ) : null}
    </Row>
  );
}

function Measurements() {
  const { t } = useT();
  const { colors: c } = useSettings();
  const toast = useToast();
  const health = useHealth();
  const [open, setOpen] = useState(false);
  const [keys, setKeys] = useState<(typeof MEAS)[number][]>([]);
  const [vals, setVals] = useState<Partial<Record<MeasKind, number>>>({});
  const [text, setText] = useState<Partial<Record<MeasKind, string>>>({});
  const series = (k: MeasKind) => health.measures.filter((m) => m.kind === k);
  const have = MEAS.filter((k) => series(k).length);
  const food = useFood();
  const { profile } = useAuth();
  const train = useTrain();
  // One arm clearly smaller after saving: offer one-arm exercises (asked again on every save while the gap is there).
  const [armAsk, setArmAsk] = useState<{ weak: 'right' | 'left'; cm: number } | null>(null);
  const weakArm = (w: 'right' | 'left') => t(w === 'right' ? 'right arm' : 'left arm');

  const openSheet = () => {
    const ks = have.length ? [...have] : (['waist', 'chest', 'arm_r', 'arm_l'] as (typeof MEAS)[number][]);
    const v: Partial<Record<MeasKind, number>> = {};
    ks.forEach((k) => (v[k] = series(k).at(-1)?.value ?? MEAS_INFO[k][3]));
    setKeys(ks);
    setVals(v);
    setText(Object.fromEntries(Object.entries(v).map(([k, x]) => [k, fx(x as number)])));
    setOpen(true);
  };
  const setOne = (k: MeasKind, n: number) => {
    const x = Math.max(1, Math.round(n * 10) / 10);
    setVals((s) => ({ ...s, [k]: x }));
    setText((s) => ({ ...s, [k]: fx(x) }));
  };

  return (
    <View>
      {have.length ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {have.map((k) => {
            const s = series(k);
            const [n, u, less] = MEAS_INFO[k];
            const d = s.at(-1)!.value - s[0].value;
            const good = less ? d < 0 : d > 0;
            return (
              <View key={k} style={{ width: '31.8%', backgroundColor: c.card, borderRadius: 18, padding: 12 }}>
                <Text variant="xs" weight={700} color="sec" numberOfLines={1}>
                  {t(n)}
                </Text>
                <Text num size={20}>
                  {fx(s.at(-1)!.value)}
                  <Text num size={12} weight={500} color="sec">{` ${u}`}</Text>
                </Text>
                <Text variant="xs" weight={700} color={s.length > 1 && d !== 0 ? (good ? 'up' : 'down') : 'sec'}>
                  {s.length > 1 ? `${d < 0 ? '↓' : d > 0 ? '↑' : ''} ${fx(Math.abs(d))} ${u}` : t('First entry')}
                </Text>
              </View>
            );
          })}
        </View>
      ) : (
        <Card>
          <Text color="sec">{t('Track your waist, chest and arms to see changes the scale misses.')}</Text>
        </Card>
      )}
      {have.length ? (
        <Text variant="xs" color="sec" style={{ marginTop: 8, marginHorizontal: 4 }}>
          {t('Change since your first entry')}
        </Text>
      ) : null}
      {/* The coach reads every measurement (and the weight beside it); asked again only when a number changes. */}
      {have.length ? (
        <View style={{ marginTop: 12 }}>
          <ReadingInsight
            id="measurements"
            day={food.today}
            task="measure_insight"
            ready={health.ready}
            data={{
              items: have.map((k) => ({ kind: k, name: MEAS_INFO[k][0], unit: MEAS_INFO[k][1], less: MEAS_INFO[k][2], points: series(k).map(({ day, value }) => ({ day, value })) })),
              weight: health.weights.map(({ day, value }) => ({ day, value })).slice(-60),
              goalType: goalOf(food.plan?.goal),
              age: ageOf(profile?.date_of_birth ?? null),
              sex: profile?.gender ?? null,
              female: profile?.gender === 'female',
            }}
          />
        </View>
      ) : null}
      <Button icon="plus" title={t('Add measurements')} style={{ marginTop: 12 }} onPress={openSheet} />

      <Sheet open={open} onClose={() => setOpen(false)}>
        <Text variant="h2">{t('Add measurements')}</Text>
        <Text variant="small" color="sec" style={{ marginTop: 4 }}>
          {t('Measure in the morning, tape snug but not tight. Tap a number to type it.')}
        </Text>
        {keys.map((k) => {
          const [n, u] = MEAS_INFO[k];
          return (
            <Card key={k} style={{ marginTop: 10, marginBottom: 0, flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 10 }}>
              <Text weight={700} style={{ flex: 1 }} numberOfLines={1}>
                {t(n)}
              </Text>
              <Springy onPress={() => setOne(k, (vals[k] ?? 0) - 0.5)} accessibilityLabel={t('Less')} style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: c.inset, alignItems: 'center', justifyContent: 'center' }}>
                <Icon name="minus" size={16} strokeWidth={2.2} />
              </Springy>
              <TextInput
                value={text[k] ?? ''}
                inputMode="decimal"
                accessibilityLabel={`${t(n)} (${u})`}
                onChangeText={(s) => {
                  const clean = s.replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))).replace(/[٫,]/g, '.').replace(/[^\d.]/g, '');
                  setText((x) => ({ ...x, [k]: clean }));
                  const v = parseFloat(clean);
                  if (v > 0) setVals((x) => ({ ...x, [k]: v }));
                }}
                style={{ width: 62, height: 36, borderRadius: 10, backgroundColor: c.inset, textAlign: 'center', fontSize: 16, fontFamily: 'Sora_600SemiBold', color: c.text }}
              />
              <Text variant="xs" weight={700} color="sec" style={{ width: 18 }}>
                {u}
              </Text>
              <Springy onPress={() => setOne(k, (vals[k] ?? 0) + 0.5)} accessibilityLabel={t('More')} style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: c.inset, alignItems: 'center', justifyContent: 'center' }}>
                <Icon name="plus" size={16} strokeWidth={2.2} />
              </Springy>
              {/* Any row can go (keep at least one), so you never save a number you didn't measure. */}
              {keys.length > 1 ? (
                <Springy onPress={() => setKeys((x) => x.filter((y) => y !== k))} accessibilityLabel={t('Remove')} style={{ width: 28, alignItems: 'center' }}>
                  <Icon name="close" size={14} color={c.sec} />
                </Springy>
              ) : null}
            </Card>
          );
        })}
        {MEAS.some((k) => !keys.includes(k) && (k !== 'arm' || series(k).length)) ? (
          <>
            <Label>{t('Add more')}</Label>
            <Row gap={8} style={{ flexWrap: 'wrap' }}>
              {/* One arm only for the numbers saved before right and left: new ones are right or left. */}
              {MEAS.filter((k) => !keys.includes(k) && (k !== 'arm' || series(k).length)).map((k) => (
                <Chip
                  key={k}
                  title={`+ ${t(MEAS_INFO[k][0])}`}
                  onPress={() => {
                    setKeys((x) => [...x, k]);
                    setOne(k, series(k).at(-1)?.value ?? MEAS_INFO[k][3]);
                  }}
                />
              ))}
            </Row>
          </>
        ) : null}
        <Button
          title={t('Save')}
          style={{ marginTop: 16 }}
          onPress={async () => {
            const out: Partial<Record<MeasKind, number>> = {};
            keys.forEach((k) => (out[k] = vals[k]));
            setOpen(false);
            const ok = await health.saveMeasures(out);
            toast(ok ? t('Saved {n} measurements', { n: keys.length }) : t('Couldn’t save. Please try again.'), { icon: ok ? 'check' : 'warn' });
            if (!ok || (out.arm_r == null && out.arm_l == null)) return;
            const gap = armGap([...health.measures, ...Object.entries(out).map(([kind, value]) => ({ kind, day: '9999', value: value as number }))]);
            const plan = train.plan;
            if (!gap || !plan) return;
            if (twoArmCount(plan)) afterSheet(() => setArmAsk(gap));
            else if (hasOneArm(plan)) setTimeout(() => toast(t('Your {a} is {n} cm smaller. On one-arm exercises, start with it.', { a: weakArm(gap.weak), n: fx(gap.cm) }), { icon: 'info' }), 2200);
          }}
        />
      </Sheet>

      <Sheet open={!!armAsk} onClose={() => setArmAsk(null)}>
        <Text variant="h2">{t('One arm is smaller')}</Text>
        <Text color="sec" style={{ marginTop: 6 }}>
          {armAsk ? t('Your {a} is {n} cm smaller than the other. Update your plan so arm exercises are done one arm at a time? The smaller arm can then catch up.', { a: weakArm(armAsk.weak), n: fx(armAsk.cm) }) : ''}
        </Text>
        <Button
          title={t('Yes, update my plan')}
          style={{ marginTop: 16 }}
          onPress={async () => {
            const gap = armAsk;
            setArmAsk(null);
            const ok = await train.changePlan((p) => oneArmPlan(p));
            toast(ok && gap ? t('Plan updated. Start each one-arm exercise with your {a}.', { a: weakArm(gap.weak) }) : t('Couldn’t save. Please try again.'), { icon: ok ? 'check' : 'warn' });
          }}
        />
        <Button kind="ghost" title={t('No thanks')} style={{ marginTop: 8 }} onPress={() => setArmAsk(null)} />
      </Sheet>
    </View>
  );
}

function Photos() {
  const { t, lang } = useT();
  const { colors: c } = useSettings();
  const toast = useToast();
  const health = useHealth();
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [sel, setSel] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [del, setDel] = useState(false);
  const list = health.photos;
  const picked = (sel.length ? sel : list.slice(-2).map((p) => p.id)).map((id) => list.find((p) => p.id === id)).filter(Boolean) as typeof list;
  const need = picked.map((p) => p.path).filter((p) => !urls[p]);
  const needKey = need.join('|');

  useEffect(() => {
    if (!needKey) return;
    let alive = true;
    health.photoUrls(needKey.split('|')).then((u) => alive && setUrls((x) => ({ ...x, ...u })));
    return () => {
      alive = false;
    };
  }, [needKey, health]);

  const add = async () => {
    const p = await takePhoto(true);
    if (!p) return;
    setBusy(true);
    const ok = await health.addPhoto(p);
    setBusy(false);
    setSel([]);
    toast(ok ? t('Photo saved. Only you can see it.') : t('Couldn’t save. Please try again.'), { icon: ok ? 'camera' : 'warn' });
  };

  const pick = (id: string) => {
    const cur = picked.map((p) => p.id);
    if (cur.includes(id)) return;
    const next = [...cur.slice(-1), id].sort((a, b) => list.findIndex((p) => p.id === a) - list.findIndex((p) => p.id === b));
    setSel(next);
  };

  return (
    <View>
      <SecHead title={t('Progress photos')} link={busy ? t('Saving…') : t('Add photo')} onLink={busy ? undefined : add} />
      {list.length ? (
        <>
          <Row gap={10}>
            {picked.map((p) => (
              <View key={p.id} style={{ flex: 1 }}>
                <View style={{ aspectRatio: 3 / 4, borderRadius: 20, overflow: 'hidden', backgroundColor: c.card }}>
                  {urls[p.path] ? <Image source={{ uri: urls[p.path] }} style={{ width: '100%', height: '100%' }} contentFit="cover" /> : null}
                </View>
                <Text variant="small" weight={700} center style={{ marginTop: 8 }}>
                  {shortDate(p.day, lang)}
                </Text>
              </View>
            ))}
            {picked.length === 1 ? <View style={{ flex: 1 }} /> : null}
          </Row>
          {list.length > 2 ? (
            <Row gap={6} style={{ flexWrap: 'wrap', justifyContent: 'center', marginTop: 12 }}>
              {list.map((p) => (
                <Chip key={p.id} title={shortDate(p.day, lang)} on={picked.some((x) => x.id === p.id)} onPress={() => pick(p.id)} />
              ))}
            </Row>
          ) : null}
          <Text variant="xs" color="sec" center style={{ marginTop: 8 }}>
            {t('Tap two dates to compare. Photos stay private.')}
          </Text>
          {picked.length ? (
            <Button
              small
              kind="ghost"
              icon="trash"
              title={t('Delete a photo')}
              style={{ alignSelf: 'center', marginTop: 4 }}
              onPress={() => setDel(true)}
            />
          ) : null}
          {/* You choose which of the photos on screen to delete, by its date, and it asks first. */}
          <Sheet open={del} onClose={() => setDel(false)}>
            <Text variant="h2" center>
              {t('Delete a photo?')}
            </Text>
            <Text color="sec" center style={{ marginTop: 4 }}>
              {t('This can’t be undone.')}
            </Text>
            {picked.map((p) => (
              <Button
                key={p.id}
                kind="danger"
                icon="trash"
                title={t('Delete the photo from {d}', { d: shortDate(p.day, lang) })}
                style={{ marginTop: 12 }}
                onPress={() => {
                  health.deletePhoto(p.id);
                  setSel([]);
                  setDel(false);
                  toast(t('Photo deleted'), { icon: 'trash' });
                }}
              />
            ))}
            <Button kind="ghost" title={t('Cancel')} style={{ marginTop: 8 }} onPress={() => setDel(false)} />
          </Sheet>
        </>
      ) : (
        <Card style={{ alignItems: 'center', paddingVertical: 20 }}>
          <Icon name="camera" size={30} color={c.sec} />
          <Text color="sec" center style={{ marginTop: 8 }}>
            {t('Take a photo every week or two in the same spot and light. Only you can see them.')}
          </Text>
          <Button small icon="camera" title={t('Add photo')} loading={busy} style={{ marginTop: 12, alignSelf: 'center' }} onPress={add} />
        </Card>
      )}
    </View>
  );
}
