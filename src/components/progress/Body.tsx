import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { TextInput, View } from 'react-native';

import { useT } from '@/i18n';
import { useAuth } from '@/lib/auth';
import { useFood } from '@/lib/food';
import { MEAS, MEAS_INFO, type MeasKind, useHealth } from '@/lib/health';
import { addDays } from '@/lib/nutrition';
import { takePhoto } from '@/lib/photo';
import { fx, shortDate, weekAvg } from '@/lib/progress';
import { useSettings } from '@/theme/settings';

import { LineChart } from '../Charts';
import { Icon, Mark } from '../Icon';
import { Sheet } from '../Sheet';
import { Text } from '../Text';
import { useToast } from '../Toast';
import { Button, Card, Chip, Label, Row, Springy } from '../ui';
import { WeightWheel } from '../health/bits';
import { SecHead } from './bits';

/** Weight, measurements and progress photos (design: progWeightBody). */
export function Body() {
  const { t } = useT();
  return (
    <View>
      <Text variant="h2" style={{ marginHorizontal: 4, marginBottom: 12 }}>
        {t('Weight')}
      </Text>
      <Weight />
      <Text variant="h2" style={{ marginHorizontal: 4, marginTop: 28, marginBottom: 12 }}>
        {t('Measurements')}
      </Text>
      <Measurements />
      <Photos />
    </View>
  );
}

function Weight() {
  const { t, lang } = useT();
  const { colors: c } = useSettings();
  const toast = useToast();
  const { profile } = useAuth();
  const food = useFood();
  const health = useHealth();
  const [open, setOpen] = useState(false);
  const w = health.weights.slice(-30);
  const cur = w.at(-1);
  const a = weekAvg(health.weights, food.today);
  const b = weekAvg(health.weights, addDays(food.today, -7));
  const goal = food.plan.goal;
  const [v, setV] = useState(0);
  const openSheet = () => {
    setV(cur?.value ?? Number(profile?.weight_kg ?? 75));
    setOpen(true);
  };
  const labels = w.map((x, i) => ((i % Math.max(1, Math.ceil(w.length / 4)) === 0 && i < w.length - Math.ceil(w.length / 8)) || i === w.length - 1 ? shortDate(x.day, lang) : ''));
  const first = w[0];
  const change = cur && first && w.length > 1 ? cur.value - first.value : null;
  let note: string | null = null;
  if (change != null) {
    const toward = goal >= 3 ? change < 0 : goal <= 1 ? change > 0 : Math.abs(change) < 1;
    note = toward
      ? t('You’re on track. {n} kg since {d}. If your weight stays flat for two weeks, I’ll suggest adjusting calories.', { n: `${change > 0 ? '+' : '−'}${fx(Math.abs(change))}`, d: shortDate(first.day, lang) })
      : t('Your weight is going the other way ({n} kg since {d}). Weigh in a few more mornings; one day doesn’t mean much.', { n: `${change > 0 ? '+' : '−'}${fx(Math.abs(change))}`, d: shortDate(first.day, lang) });
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
                  {fx(cur.value)}
                  <Text num size={18} weight={500} color="sec">{` ${t('kg')}`}</Text>
                </Text>
              </View>
              {a != null ? (
                <View style={{ alignItems: 'flex-end' }}>
                  <Text variant="small" weight={700} color="sec">
                    {t('Weekly average')}
                  </Text>
                  <Text num size={20}>{`${fx(a)} ${t('kg')}`}</Text>
                  {b != null ? (
                    <Text variant="small" weight={700} color={(a - b < 0) === goal >= 3 ? 'up' : 'sec'}>
                      {`${a - b < 0 ? '↓' : '↑'} ${fx(Math.abs(a - b))} ${t('vs last week')}`}
                    </Text>
                  ) : null}
                </View>
              ) : null}
            </Row>
            {w.length > 1 ? (
              <View style={{ marginTop: 16 }}>
                <LineChart values={w.map((x) => x.value)} labels={labels} />
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
            toast(ok ? t('Weight saved: {n} kg', { n: fx(v) }) : t('Couldn’t save. Please try again.'), { icon: ok ? 'scale' : 'warn' });
          }}
        />
      </Sheet>
    </View>
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

  const openSheet = () => {
    const ks = have.length ? [...have] : (['waist', 'chest', 'arm'] as (typeof MEAS)[number][]);
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
              {!['waist', 'chest', 'arm'].includes(k) ? (
                <Springy onPress={() => setKeys((x) => x.filter((y) => y !== k))} accessibilityLabel={t('Remove')} style={{ width: 28, alignItems: 'center' }}>
                  <Icon name="close" size={14} color={c.sec} />
                </Springy>
              ) : null}
            </Card>
          );
        })}
        {MEAS.some((k) => !keys.includes(k)) ? (
          <>
            <Label>{t('Add more')}</Label>
            <Row gap={8} style={{ flexWrap: 'wrap' }}>
              {MEAS.filter((k) => !keys.includes(k)).map((k) => (
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
          }}
        />
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
              title={t('Delete the latest photo')}
              style={{ alignSelf: 'center', marginTop: 4 }}
              onPress={() => {
                const last = picked.at(-1)!;
                health.deletePhoto(last.id);
                setSel([]);
                toast(t('Photo deleted'), { icon: 'trash' });
              }}
            />
          ) : null}
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
