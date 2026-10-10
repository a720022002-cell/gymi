import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Glass } from '@/components/Glass';
import { Icon, Mark } from '@/components/Icon';
import { Bar, Ring } from '@/components/Ring';
import { Screen } from '@/components/Screen';
import { Sheet } from '@/components/Sheet';
import { fontFor, Text } from '@/components/Text';
import { useToast } from '@/components/Toast';
import { Button, Card, Row, Springy } from '@/components/ui';
import { useT } from '@/i18n';
import { restDone } from '@/lib/beep';
import { type Session, type SessionEx, useTrain } from '@/lib/train';
import { exInfo, topReps } from '@/lib/training';
import { useSettings } from '@/theme/settings';

const REST = 90;
const digits = (v: string, dec: boolean) =>
  v
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .replace(/[,٫]/g, '.')
    .replace(dec ? /[^\d.]/g : /\D/g, '')
    .slice(0, 6);

/** Did this exercise go up or down against last time? (design: exArrow) */
function arrow(x: SessionEx): 'up' | 'down' | 'same' | null {
  const done = x.sets.filter((s) => s.done);
  if (!done.length) return null;
  const v = done.reduce((a, s) => a + (+s.w || 0) * (+s.r || 0) + (+s.r || 0) * 0.01, 0);
  const l = done.reduce((a, s) => a + s.lw * s.lr + s.lr * 0.01, 0);
  if (Math.abs(v - l) < 0.001) return 'same';
  return v > l ? 'up' : 'down';
}

/** The workout in progress (design: active). */
export default function Active() {
  const { t, lang } = useT();
  const { colors: c } = useSettings();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const train = useTrain();
  const s = train.session;
  const [now, setNow] = useState(() => Date.now());
  const [rest, setRest] = useState<{ end: number; total: number } | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [saving, setSaving] = useState(false);

  // Tick every quarter second; end the rest when its time is up.
  const restRef = useRef(rest);
  useEffect(() => {
    restRef.current = rest;
  }, [rest]);
  useEffect(() => {
    const id = setInterval(() => {
      const n = Date.now();
      setNow(n);
      const r = restRef.current;
      if (r && n >= r.end) {
        restRef.current = null;
        setRest(null);
        restDone();
        toast(t('Rest done. Next set.'), { icon: 'timer' });
      }
    }, 250);
    return () => clearInterval(id);
  }, [toast, t]);
  const left = rest ? Math.max(0, Math.ceil((rest.end - now) / 1000)) : 0;

  if (!s)
    return (
      <Screen title={t('Workout')} back>
        <Text color="sec">{t('No workout in progress.')}</Text>
        <Button title={t('Back to Train')} style={{ marginTop: 16 }} onPress={() => router.replace('/train')} />
      </Screen>
    );

  const tot = s.ex.reduce((a, x) => a + x.sets.length, 0);
  const dn = s.ex.reduce((a, x) => a + x.sets.filter((y) => y.done).length, 0);
  const secs = Math.floor((now - s.start) / 1000);
  const elapsed = `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`;

  const update = (fn: (x: Session) => Session) => train.setSession(fn(s));
  const setField = (ei: number, si: number, k: 'w' | 'r', v: string) =>
    update((x) => ({ ...x, ex: x.ex.map((e, i) => (i !== ei ? e : { ...e, sets: e.sets.map((st, j) => (j === si ? { ...st, [k]: v } : st)) })) }));

  const markSet = (ei: number, si: number) => {
    const x = s.ex[ei];
    const st = x.sets[si];
    const info = exInfo(x, lang);
    if (st.done) return update((ss) => ({ ...ss, ex: ss.ex.map((e, i) => (i !== ei ? e : { ...e, sets: e.sets.map((y, j) => (j === si ? { ...y, done: false } : y)) })) }));
    const w = st.w === '' ? String(st.lw || 0) : st.w;
    const r = st.r === '' ? String(st.lr) : st.r;
    const easy = +r >= topReps(x.reps) && +w >= st.lw && info.type !== 'Bodyweight' && !info.timed && +w > 0;
    const next: Session = {
      ...s,
      ex: s.ex.map((e, i) => (i !== ei ? e : { ...e, tip: e.tip || easy, sets: e.sets.map((y, j) => (j === si ? { ...y, w, r, done: true } : y)) })),
    };
    train.setSession(next);
    const more = next.ex.some((e) => e.sets.some((z) => !z.done));
    if (more) setRest({ end: Date.now() + REST * 1000, total: REST });
    else toast(t('All sets done. Tap Finish.'), { ai: true });
  };

  const finish = async () => {
    if (!dn) return setConfirm(true);
    setSaving(true);
    const names = Object.fromEntries(s.ex.map((x) => [x.id, exInfo(x, 'en').name]));
    const log = await train.finishWorkout(names);
    setSaving(false);
    if (!log) return toast(t('Couldn’t save. Please try again.'), { icon: 'warn' });
    setRest(null);
    router.replace({ pathname: '/summary', params: { id: log.id } });
  };

  return (
    <View style={{ flex: 1 }}>
      <Screen
        title={s.home ? t('Home workout') : s.name === 'Together' ? t('Train together') : t('{w} workout', { w: t(s.name) })}
        back
        right={
          <Springy onPress={finish} disabled={saving} scaleTo={1.08}>
            <Glass style={{ height: 44, borderRadius: 22, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center' }}>
              <Text weight={700}>{t(saving ? 'Saving…' : 'Finish')}</Text>
            </Glass>
          </Springy>
        }>
        <Row style={{ justifyContent: 'space-between', marginBottom: 8 }}>
          <Text variant="small" weight={700} color="sec">
            {t('{a} of {b} sets', { a: dn, b: tot })}
          </Text>
          <Text variant="small" weight={700} color="sec" num>
            {elapsed}
          </Text>
        </Row>
        <Bar value={dn} max={tot} color={c.cobalt} />
        <View style={{ height: 14 }} />
        {s.ex.map((x, ei) => {
          const info = exInfo(x, lang);
          const a = arrow(x);
          const mach = info.mach[train.plan?.machines[x.id] ?? 0];
          return (
            <Card key={`${x.id}-${ei}`}>
              <Row style={{ justifyContent: 'space-between' }}>
                <Row gap={6} style={{ flex: 1 }}>
                  <Text variant="h3" style={{ flexShrink: 1 }}>
                    {info.name}
                  </Text>
                  {a === 'up' ? <Icon name="up" size={18} color={c.up} strokeWidth={2.6} /> : a === 'down' ? <Icon name="down" size={18} color={c.down} strokeWidth={2.6} /> : a === 'same' ? <Text variant="small" weight={700} color="sec">{t('same')}</Text> : null}
                </Row>
                <Text variant="small" weight={700} color="sec">
                  {info.timed ? `${x.reps} ${t('s')}` : x.reps}
                </Text>
              </Row>
              {mach ? (
                <Text variant="xs" color="sec">
                  {lang === 'ar' ? mach[1] : mach[0]}
                </Text>
              ) : null}
              <View style={{ flexDirection: 'row', marginTop: 12, marginBottom: 4 }}>
                <Text variant="xs" weight={700} color="sec" center style={{ width: 36 }}>
                  {t('Set')}
                </Text>
                <Text variant="xs" weight={700} color="sec" center style={{ flex: 1 }}>
                  {info.timed ? '—' : t('kg')}
                </Text>
                <Text variant="xs" weight={700} color="sec" center style={{ flex: 1 }}>
                  {t(info.timed ? 'seconds' : 'reps')}
                </Text>
                <View style={{ width: 52 }} />
              </View>
              {x.sets.map((st, si) => (
                <View key={si} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6, opacity: st.done ? 0.65 : 1 }}>
                  <Text num center style={{ width: 28 }}>
                    {si + 1}
                  </Text>
                  <TextInput
                    value={st.w}
                    editable={!info.timed && !st.done}
                    onChangeText={(v) => setField(ei, si, 'w', digits(v, true))}
                    placeholder={info.timed ? '—' : st.lw ? String(st.lw) : '—'}
                    placeholderTextColor={c.sec}
                    inputMode="decimal"
                    keyboardType="decimal-pad"
                    accessibilityLabel={t('Weight set {n}', { n: si + 1 })}
                    style={{ flex: 1, flexBasis: 0, minWidth: 0, width: 0, height: 44, borderRadius: 12, backgroundColor: c.inset, textAlign: 'center', fontFamily: fontFor('sora', 600), fontSize: 17, color: c.text, outlineStyle: 'none' } as object}
                  />
                  <TextInput
                    value={st.r}
                    editable={!st.done}
                    onChangeText={(v) => setField(ei, si, 'r', digits(v, false))}
                    placeholder={String(st.lr)}
                    placeholderTextColor={c.sec}
                    inputMode="numeric"
                    keyboardType="number-pad"
                    accessibilityLabel={t('Reps set {n}', { n: si + 1 })}
                    style={{ flex: 1, flexBasis: 0, minWidth: 0, width: 0, height: 44, borderRadius: 12, backgroundColor: c.inset, textAlign: 'center', fontFamily: fontFor('sora', 600), fontSize: 17, color: c.text, outlineStyle: 'none' } as object}
                  />
                  <Springy
                    onPress={() => markSet(ei, si)}
                    scaleTo={0.9}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: st.done }}
                    accessibilityLabel={t('Finish set {n}', { n: si + 1 })}
                    style={{ width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: st.done ? c.cobalt : c.inset }}>
                    <Icon name="check" size={20} color={st.done ? '#FFFFFF' : c.sec} strokeWidth={2.6} />
                  </Springy>
                </View>
              ))}
              {x.tip ? (
                <Row gap={10} style={{ marginTop: 12, backgroundColor: c.inset, borderRadius: 14, padding: 10 }}>
                  <Mark size={20} color={c.cobalt} stroke={4} />
                  <Text variant="small" weight={700} style={{ flex: 1 }}>
                    {t('That was easy. Add 2.5 kg next time.')}
                  </Text>
                </Row>
              ) : null}
            </Card>
          );
        })}
        <View style={{ height: rest ? 300 : 90 }} />
      </Screen>

      <View pointerEvents="box-none" style={{ position: 'absolute', left: 16, right: 16, bottom: 20 + insets.bottom }}>
        {rest ? (
          <Glass style={{ borderRadius: 32, padding: 16 }}>
            <Row style={{ justifyContent: 'space-between' }}>
              <Text weight={700}>{t('Rest')}</Text>
              <Springy onPress={() => setRest(null)} accessibilityLabel={t('Close')} style={{ width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' }}>
                <Icon name="close" size={18} strokeWidth={2.2} />
              </Springy>
            </Row>
            <View style={{ alignItems: 'center', marginTop: 4, marginBottom: 14 }}>
              <Ring value={left} max={rest.total} size={150} stroke={10}>
                <Text num size={44}>{`${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`}</Text>
              </Ring>
            </View>
            <Row gap={10}>
              <View style={{ flex: 1 }}>
                <Button kind="soft" title={t('+30 s')} style={{ alignSelf: 'stretch' }} onPress={() => setRest({ end: rest.end + 30000, total: rest.total + 30 })} />
              </View>
              <View style={{ flex: 1 }}>
                <Button title={t('Skip')} style={{ alignSelf: 'stretch' }} onPress={() => setRest(null)} />
              </View>
            </Row>
          </Glass>
        ) : (
          <Glass style={{ borderRadius: 32, paddingVertical: 8, paddingEnd: 8, paddingStart: 18, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <View style={{ flex: 1 }}>
              <Text variant="small" weight={700}>
                {t('{a} of {b} sets done', { a: dn, b: tot })}
              </Text>
              <Text variant="small" color="sec">
                {t('Tap ✓ after each set')}
              </Text>
            </View>
            <Button small kind="glass" icon="timer" title={t('Rest')} onPress={() => setRest({ end: Date.now() + REST * 1000, total: REST })} />
          </Glass>
        )}
      </View>

      <Sheet open={confirm} onClose={() => setConfirm(false)}>
        <Text variant="h2">{t('Finish without logging?')}</Text>
        <Text color="sec" style={{ marginTop: 4 }}>
          {t('You haven’t finished any sets yet.')}
        </Text>
        <Button title={t('Keep training')} style={{ marginTop: 16 }} onPress={() => setConfirm(false)} />
        <Button
          kind="glass"
          title={t('End workout')}
          style={{ marginTop: 8 }}
          onPress={() => {
            setConfirm(false);
            setRest(null);
            train.setSession(null);
            router.back();
          }}
        />
      </Sheet>
    </View>
  );
}
