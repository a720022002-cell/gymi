import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { TimeField } from '@/components/food/TimeField';
import { Field } from '@/components/Field';
import { ConfirmBody } from '@/components/health/Confirm';
import { Icon } from '@/components/Icon';
import { Screen } from '@/components/Screen';
import { Sheet } from '@/components/Sheet';
import { Text } from '@/components/Text';
import { useToast } from '@/components/Toast';
import { Button, Card, Chip, Label, NavButton, Row, Springy, Toggle } from '@/components/ui';
import { useT } from '@/i18n';
import { useAuth } from '@/lib/auth';
import { type Supplement, useHealth } from '@/lib/health';
import { addDays, fmtTime, localDay } from '@/lib/nutrition';
import { last7, streakOf, useSupplementLogs } from '@/lib/supplementLogs';
import { previewNotification } from '@/lib/previewNotify';
import { onVitDays, type VitDay, vitaminDays, vitDayDefault } from '@/lib/reminders';
import { firstWeekday } from '@/components/DayNav';
import { freqOf, isDaily, REPEAT_LABEL, REPEATS, type Repeat, scheduleOf, scheduleText, type VitSchedule } from '@/lib/vitSchedule';
import { useSettings } from '@/theme/settings';

type Draft = Omit<Supplement, 'id'> & { id?: string };
const EMPTY = (): Draft => ({ name: '', dose: '', unit: 'mg', freq: 'Daily', active: true, remind: false, time: '09:00', schedule: { repeat: 'daily', date: localDay() } });

/** Vitamins and supplements you take, with optional reminder times (design: vitamins). */
export default function VitaminsScreen() {
  const { t, lang } = useT();
  const { colors: c } = useSettings();
  const toast = useToast();
  const h = useHealth();
  const { session } = useAuth();
  const uid = session?.user.id;
  const [draft, setDraft] = useState<Draft | null>(null);
  const act = h.supplements.filter((v) => v.active).length;
  const today = localDay();
  const logs = useSupplementLogs(today);
  const taken = async (v: Supplement) => {
    const on = await logs.toggle(v.id);
    if (on == null) return toast(t('Couldn’t save. Please try again.'), { icon: 'warn' });
    if (on) toast(t('{n} taken today', { n: v.name }), { icon: 'pill' });
  };
  // The day weekly and monthly reminders go off (kept on this phone; a new one gets today).
  const [days, setDays] = useState<{ uid: string; v: Record<string, VitDay> } | null>(null);
  const timed = JSON.stringify(h.supplements.filter((v) => v.freq !== 'Daily').map((v) => ({ id: v.id, name: v.name, time: v.time, freq: v.freq })));
  useEffect(() => {
    if (!uid) return;
    let alive = true;
    const load = () => vitaminDays(uid, JSON.parse(timed)).then((v) => alive && setDays({ uid, v }));
    load();
    const off = onVitDays(load);
    return () => {
      alive = false;
      off();
    };
  }, [uid, timed]);
  const dayOf = (v: Supplement): VitDay => ({ ...vitDayDefault(), ...(days && days.uid === uid ? days.v[v.id] : null) });
  // When it's taken and reminded: its own schedule, or one made from how it was set before.
  const sched = (v: Supplement) => scheduleOf(v, dayOf(v));

  const preview = async () => {
    const v = h.supplements.find((x) => x.active && x.remind) ?? h.supplements.find((x) => x.active);
    const title = t('Time for your vitamins');
    const body = v ? t('{n}, {d}', { n: v.name, d: v.dose ? `${v.dose} ${v.unit}` : scheduleText(sched(v), t, lang) }) : t('Vitamin D, 50,000 IU');
    const r = await previewNotification(title, body).catch(() => 'unsupported' as const);
    if (r === 'ok') toast(t('A sample reminder is on its way.'), { icon: 'bell' });
    else if (r === 'denied') toast(t('Allow notifications for Adro to get reminders.'), { icon: 'bell' });
    else toast(`${title}: ${body}`, { icon: 'bell' });
  };

  const quick = async (v: Supplement, patch: Partial<Supplement>) => {
    const ok = await h.saveSupplement({ ...v, ...patch });
    if (!ok) return toast(t('Couldn’t save. Please try again.'), { icon: 'warn' });
    if ('active' in patch) toast(patch.active ? t('{n} is active', { n: v.name }) : t('{n} paused', { n: v.name }), { icon: 'pill' });
    if (patch.remind) toast(t('Reminder on at {t}', { t: fmtTime(v.time, lang) }), { icon: 'bell' });
  };

  return (
    <Screen title={t('Vitamins')} back right={<NavButton icon="plus" label={t('Add a vitamin')} onPress={() => setDraft(EMPTY())} />}>
      <Text color="sec" style={{ marginTop: -8 }}>
        {t('The switch shows what you’re taking now. Reminders are separate and optional.')}
      </Text>
      {h.supplements.length ? (
        <>
          <Text variant="small" weight={700} color="sec" style={{ marginTop: 14, marginBottom: 8, marginHorizontal: 4 }}>
            {t('{a} active, {p} paused', { a: act, p: h.supplements.length - act })}
          </Text>
          {h.supplements.map((v) => (
            <Card key={v.id} style={{ opacity: v.active ? 1 : 0.72 }}>

              <Row>
                <View style={{ width: 36, height: 36, borderRadius: 11, backgroundColor: c.inset, alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name="pill" size={20} color={c.cobalt} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text weight={700}>{v.name}</Text>
                  <Text variant="small" color="sec">{`${v.dose ? `${v.dose} ${v.unit}, ` : ''}${scheduleText(sched(v), t, lang)}`}</Text>
                </View>
                <Springy onPress={() => setDraft({ ...v, schedule: sched(v) })} accessibilityLabel={t('Edit {n}', { n: v.name })} style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: c.inset, alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name="edit" size={16} />
                </Springy>
                <Toggle value={v.active} onChange={(x) => quick(v, { active: x })} label={t('I’m taking this now')} />
              </Row>
              {v.active ? (
                <TakenRow on={(logs.logs[v.id] ?? []).includes(today)} days={logs.logs[v.id]} today={today} daily={isDaily(sched(v))} name={v.name} onPress={() => taken(v)} />
              ) : null}
              {v.active ? (
                <View style={{ backgroundColor: c.inset, borderRadius: 14, marginTop: 12, paddingHorizontal: 12 }}>
                  <Row style={{ minHeight: 44 }}>
                    <Icon name="bell" size={18} color={v.remind ? c.cobalt : c.sec} />
                    <Text variant="small" weight={700} style={{ flex: 1 }}>
                      {t('Reminder')}
                    </Text>
                    <Toggle value={v.remind} onChange={(x) => quick(v, { remind: x })} label={t('Reminder')} />
                  </Row>
                  {v.remind ? (
                    <Row style={{ minHeight: 52, borderTopWidth: 1, borderTopColor: c.line, justifyContent: 'space-between' }}>
                      <Springy onPress={() => setDraft({ ...v, schedule: sched(v) })} style={{ flex: 1 }}>
                        <Text variant="small" weight={700}>
                          {scheduleText(sched(v), t, lang)}
                        </Text>
                        <Text variant="xs" color="link" weight={700}>
                          {t('Change')}
                        </Text>
                      </Springy>
                      <TimeField value={v.time} onChange={(x) => quick(v, { time: x })} label={t('Remind me at')} bg={c.card} />
                    </Row>
                  ) : null}
                </View>
              ) : (
                <Text variant="small" color="sec" style={{ marginTop: 8 }}>
                  {t('Paused. Turn it on when you start taking it again.')}
                </Text>
              )}
            </Card>
          ))}
        </>
      ) : (
        <Card style={{ alignItems: 'center', paddingVertical: 24, marginTop: 16 }}>
          <Icon name="pill" size={30} color={c.sec} />
          <Text variant="h3" style={{ marginTop: 8 }}>
            {t('No vitamins yet')}
          </Text>
          <Text variant="small" color="sec" style={{ marginTop: 4 }}>
            {t('Add what you take to keep track of it.')}
          </Text>
          <Button small title={t('Add a vitamin')} style={{ marginTop: 12, alignSelf: 'center' }} onPress={() => setDraft(EMPTY())} />
        </Card>
      )}
      <Row gap={8} style={{ alignItems: 'flex-start', marginTop: 8, paddingHorizontal: 4 }}>
        <Icon name="info" size={18} color={c.sec} />
        <Text variant="small" color="sec" style={{ flex: 1 }}>
          {t('Adro logs what you take. It doesn’t recommend doses. Ask your doctor before starting anything new.')}
        </Text>
      </Row>
      <Button kind="glass" icon="bell" title={t('Preview a reminder')} style={{ marginTop: 16 }} onPress={preview} />
      <Sheet open={!!draft} onClose={() => setDraft(null)}>
        {draft ? <VitSheet draft={draft} setDraft={setDraft} /> : null}
      </Sheet>
    </Screen>
  );
}

/** Tap to mark today's dose taken, with the last 7 days as dots (and the streak for daily ones). */
function TakenRow({ on, days, today, daily, name, onPress }: { on: boolean; days: string[] | undefined; today: string; daily: boolean; name: string; onPress: () => void }) {
  const { t } = useT();
  const { colors: c } = useSettings();
  const streak = daily ? streakOf(days, today) : 0;
  return (
    <Row gap={10} style={{ marginTop: 12 }}>
      <Springy
        onPress={onPress}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: on }}
        accessibilityLabel={t('{n} taken today', { n: name })}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 6, height: 36, borderRadius: 18, paddingHorizontal: 14, backgroundColor: on ? c.cobalt : c.inset }}>
        <Icon name="check" size={15} color={on ? '#FFFFFF' : c.sec} strokeWidth={2.6} />
        <Text variant="small" weight={700} color={on ? '#FFFFFF' : 'text'}>
          {t(on ? 'Taken' : 'Mark taken')}
        </Text>
      </Springy>
      <View style={{ flex: 1, alignItems: 'flex-end', gap: 4 }}>
        <View accessible accessibilityLabel={t('{n} of the last 7 days', { n: last7(days, today).filter((d) => d.on).length })} style={{ flexDirection: 'row', gap: 4 }}>
          {last7(days, today).map((d) => (
            <View key={d.day} style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: d.on ? c.cobalt : c.line }} />
          ))}
        </View>
        {streak > 1 ? (
          <Text variant="xs" weight={700} color="sec">
            {t('{n} days in a row', { n: streak })}
          </Text>
        ) : null}
      </View>
    </Row>
  );
}

function VitSheet({ draft: p, setDraft }: { draft: Draft; setDraft: (d: Draft | null) => void }) {
  const { t, lang } = useT();
  const toast = useToast();
  const h = useHealth();
  const [err, setErr] = useState(false);
  const [asking, setAsking] = useState(false);
  const set = (patch: Partial<Draft>) => setDraft({ ...p, ...patch });
  const save = async () => {
    if (!p.name.trim()) return setErr(true);
    const schedule = p.schedule ?? scheduleOf(p);
    const ok = await h.saveSupplement({ ...p, schedule, freq: freqOf(schedule), name: p.name.trim().slice(0, 60), dose: p.dose.trim().slice(0, 30), remind: p.active && p.remind });
    if (!ok) return toast(t('Couldn’t save. Please try again.'), { icon: 'warn' });
    setDraft(null);
    toast(p.id ? t('{n} saved', { n: p.name.trim() }) : p.remind ? t('{n} added, reminder at {t}', { n: p.name.trim(), t: fmtTime(p.time, lang) }) : t('{n} added', { n: p.name.trim() }), { icon: 'pill' });
  };
  const remove = async () => {
    const gone = await h.deleteSupplement(p.id as string);
    setDraft(null);
    if (gone) toast(t('{n} deleted', { n: gone.name }), { icon: 'trash', undo: () => h.restoreSupplement(gone) });
  };
  if (asking)
    return <ConfirmBody title={t('Delete {n}?', { n: p.name })} body={t('It will be removed from your list and its reminders stop.')} action={t('Delete')} onConfirm={remove} onClose={() => setAsking(false)} />;
  return (
    <View>
      <Text variant="h2">{t(p.id ? 'Edit vitamin' : 'Add a vitamin or supplement')}</Text>
      <Field label={t('Name')} value={p.name} onChangeText={(v) => (set({ name: v }), setErr(false))} placeholder={t('Vitamin D')} maxLength={60} error={err ? t('Enter a name') : undefined} />
      {!p.id ? (
        <Row gap={8} style={{ flexWrap: 'wrap', marginTop: 8 }}>
          {['Vitamin D', 'Creatine', 'Magnesium', 'Iron', 'Omega-3', 'Zinc'].map((x) => (
            <Chip key={x} title={t(x)} on={p.name === t(x)} onPress={() => set({ name: t(x) })} />
          ))}
        </Row>
      ) : null}
      <Field label={t('Dose')} value={p.dose} onChangeText={(v) => set({ dose: v })} placeholder="50,000" keyboardType="decimal-pad" maxLength={30} />
      <Label>{t('Unit')}</Label>
      <Row gap={8}>
        {['IU', 'mg', 'mcg', 'g'].map((u) => (
          <Chip key={u} title={u} on={p.unit === u} onPress={() => set({ unit: u })} />
        ))}
      </Row>
      <Card style={{ marginTop: 16, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View style={{ flex: 1 }}>
          <Text weight={700}>{t('I’m taking this now')}</Text>
          <Text variant="xs" color="sec">
            {t('Turn off to pause it without deleting')}
          </Text>
        </View>
        <Toggle value={p.active} onChange={(v) => set({ active: v })} label={t('I’m taking this now')} />
      </Card>
      {p.active ? <WhenCard p={p} set={set} /> : null}
      <Button title={t(p.id ? 'Save' : 'Add')} style={{ marginTop: 8 }} onPress={save} />
      {p.id ? (
        <Button
          kind="soft"
          icon="trash"
          color="#DC2626"
          title={t('Delete vitamin')}
          style={{ marginTop: 8 }}
          onPress={() => setAsking(true)}
        />
      ) : null}
    </View>
  );
}

/** When you take it, like Apple's Reminders: the date, how it repeats, and a reminder at a time. */
function WhenCard({ p, set }: { p: Draft; set: (patch: Partial<Draft>) => void }) {
  const { t, lang } = useT();
  const { colors: c } = useSettings();
  const [open, setOpen] = useState<'date' | 'repeat' | null>(null);
  const s: VitSchedule = p.schedule ?? scheduleOf(p);
  const setS = (patch: Partial<VitSchedule>) => set({ schedule: { ...s, ...patch } });
  const today = localDay();
  const loc = lang === 'ar' ? 'ar-u-nu-latn' : 'en-US';
  const dateText = s.date === today ? t('Today') : s.date === addDays(today, 1) ? t('Tomorrow') : new Intl.DateTimeFormat(loc, { weekday: 'short', month: 'short', day: 'numeric' }).format(new Date(`${s.date}T12:00:00`));
  const row = (icon: 'cal' | 'swap' | 'bell', color: string, label: string, right: React.ReactNode, onPress?: () => void, first = false) => (
    <Springy disabled={!onPress} onPress={onPress} scaleTo={0.99} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 54, borderTopWidth: first ? 0 : 1, borderTopColor: c.line }}>
      <View style={{ width: 30, height: 30, borderRadius: 8, backgroundColor: color, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={icon} size={16} color="#FFFFFF" />
      </View>
      <Text weight={700} style={{ flex: 1 }}>
        {label}
      </Text>
      {right}
    </Springy>
  );
  const value = (x: string, on: boolean) => (
    <Row gap={6}>
      <Text variant="small" weight={700} color={on ? c.cobalt : 'sec'}>
        {x}
      </Text>
      <Icon name={on ? 'chevup' : 'chevd'} size={14} color={c.sec} />
    </Row>
  );
  return (
    <Card style={{ paddingVertical: 4 }}>
      {row('cal', '#DC2626', t(s.repeat === 'never' ? 'Date' : 'Starts'), value(dateText, open === 'date'), () => setOpen(open === 'date' ? null : 'date'), true)}
      {open === 'date' ? <MonthPicker value={s.date} min={today} onChange={(d) => setS({ date: d })} /> : null}
      {row('swap', '#6B7280', t('Repeat'), value(scheduleText(s, t, lang), open === 'repeat'), () => setOpen(open === 'repeat' ? null : 'repeat'))}
      {open === 'repeat' ? (
        <View style={{ paddingBottom: 8 }}>
          {REPEATS.map((r: Repeat) => (
            <Springy key={r} onPress={() => setS({ repeat: r, ...(r === 'every' && !s.every ? { every: 2 } : {}), ...(r === 'weekly' && !s.days?.length ? { days: [new Date(`${s.date}T12:00:00`).getDay()] } : {}) })} style={{ flexDirection: 'row', alignItems: 'center', minHeight: 42, paddingStart: 42 }}>
              <Text style={{ flex: 1 }}>{t(REPEAT_LABEL[r])}</Text>
              {s.repeat === r ? <Icon name="check" size={16} color={c.cobalt} strokeWidth={2.6} /> : null}
            </Springy>
          ))}
          {s.repeat === 'weekly' ? (
            <View style={{ paddingStart: 42, marginTop: 6 }}>
              <Text variant="xs" weight={700} color="sec">
                {t('On these days')}
              </Text>
              <Row gap={6} style={{ marginTop: 6, flexWrap: 'wrap' }}>
                {[0, 1, 2, 3, 4, 5, 6].map((i) => (i + firstWeekday()) % 7).map((d) => {
                  const days = s.days?.length ? s.days : [new Date(`${s.date}T12:00:00`).getDay()];
                  const on = days.includes(d);
                  return (
                    <Springy
                      key={d}
                      onPress={() => {
                        const next = on ? days.filter((x) => x !== d) : [...days, d];
                        if (next.length) setS({ days: next });
                      }}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: on }}
                      style={{ width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? c.cobalt : c.inset }}>
                      <Text variant="xs" weight={700} color={on ? '#FFFFFF' : 'text'}>
                        {t(['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d])}
                      </Text>
                    </Springy>
                  );
                })}
              </Row>
            </View>
          ) : null}
          {s.repeat === 'every' ? (
            <Row gap={10} style={{ paddingStart: 42, marginTop: 6 }}>
              <Text variant="small" weight={700} style={{ flex: 1 }}>
                {t('Every {n} days', { n: s.every ?? 2 })}
              </Text>
              {(
                [
                  ['minus', -1],
                  ['plus', 1],
                ] as const
              ).map(([ic, step]) => (
                <Springy key={ic} onPress={() => setS({ every: Math.min(60, Math.max(2, (s.every ?? 2) + step)) })} style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: c.inset, alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name={ic} size={16} />
                </Springy>
              ))}
            </Row>
          ) : null}
        </View>
      ) : null}
      {row(
        'bell',
        c.cobalt,
        t('Reminder'),
        <Row gap={8}>
          {p.remind ? <TimeField value={p.time} onChange={(v) => set({ time: v })} label={t('Time')} /> : null}
          <Toggle value={p.remind} onChange={(v) => set({ remind: v })} label={t('Reminder')} />
        </Row>,
      )}
    </Card>
  );
}

/** A month to pick a day from (days before `min` can't be picked). */
function MonthPicker({ value, min, onChange }: { value: string; min: string; onChange: (d: string) => void }) {
  const { t, lang } = useT();
  const { colors: c } = useSettings();
  const [month, setMonth] = useState(value.slice(0, 7));
  const [y, m] = month.split('-').map(Number);
  const first = new Date(y, m - 1, 1);
  const fw = firstWeekday();
  const lead = (first.getDay() - fw + 7) % 7;
  const count = new Date(y, m, 0).getDate();
  const cells: (string | null)[] = [...Array(lead).fill(null), ...Array.from({ length: count }, (_, i) => `${month}-${String(i + 1).padStart(2, '0')}`)];
  const shift = (n: number) => {
    const d = new Date(y, m - 1 + n, 1);
    setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  };
  const loc = lang === 'ar' ? 'ar-u-nu-latn' : 'en-US';
  return (
    <View style={{ paddingBottom: 10 }}>
      <Row style={{ justifyContent: 'space-between', marginBottom: 6 }}>
        <Text weight={700}>{new Intl.DateTimeFormat(loc, { month: 'long', year: 'numeric' }).format(first)}</Text>
        <Row gap={4}>
          <Springy disabled={month <= min.slice(0, 7)} onPress={() => shift(-1)} accessibilityLabel={t('Earlier')} style={{ width: 36, height: 36, alignItems: 'center', justifyContent: 'center', opacity: month <= min.slice(0, 7) ? 0.3 : 1 }}>
            <Icon name="back" size={16} color={c.cobalt} />
          </Springy>
          <Springy onPress={() => shift(1)} accessibilityLabel={t('Later')} style={{ width: 36, height: 36, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="chev" size={16} color={c.cobalt} />
          </Springy>
        </Row>
      </Row>
      <View style={{ flexDirection: 'row' }}>
        {[0, 1, 2, 3, 4, 5, 6].map((i) => (
          <Text key={i} variant="xs" weight={700} color="sec" center style={{ flex: 1 }}>
            {t(['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][(i + fw) % 7])}
          </Text>
        ))}
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 4 }}>
        {cells.map((d, i) => {
          const on = d === value;
          const off = !d || d < min;
          return (
            <View key={i} style={{ width: `${100 / 7}%`, alignItems: 'center', paddingVertical: 2 }}>
              {d ? (
                <Springy disabled={off} onPress={() => onChange(d)} style={{ width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? c.cobalt : 'transparent', opacity: off ? 0.3 : 1 }}>
                  <Text num size={15} weight={on ? 700 : 500} color={on ? '#FFFFFF' : d === min ? c.cobalt : 'text'}>
                    {Number(d.slice(8))}
                  </Text>
                </Springy>
              ) : null}
            </View>
          );
        })}
      </View>
    </View>
  );
}
