import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';

import { Stepper } from '@/components/food/Stepper';
import { Thinking } from '@/components/food/Thinking';
import { DateField } from '@/components/health/DateField';
import { Icon, type IconName } from '@/components/Icon';
import { Ring } from '@/components/Ring';
import { Screen } from '@/components/Screen';
import { Sheet } from '@/components/Sheet';
import { BarChart } from '@/components/Charts';
import { FriendPicker } from '@/components/social/FriendPicker';
import { List, ListRow } from '@/components/social/List';
import { Text } from '@/components/Text';
import { useToast } from '@/components/Toast';
import { Button, Card, Chip, Label, NavButton, Option, Row, Segmented, Toggle } from '@/components/ui';
import { useT } from '@/i18n';
import { useAuth } from '@/lib/auth';
import {
  addPastPeriod,
  averages,
  CY_LOG,
  CY_MODES,
  CY_PLAN,
  type CycleLog,
  type CycleMode,
  cycleNow,
  type CycleSettings,
  dayInfo,
  DEFAULT_CYCLE,
  deleteAllCycle,
  deletePeriod,
  getPartner,
  type Partner,
  partnerSummary,
  phaseOn,
  savePartner,
  setAnon as setAnonMode,
  endPeriod,
  loadCycle,
  type Period,
  saveLog,
  saveSettings,
  SINGLE,
  startPeriod,
} from '@/lib/cycle';
import { lockSupported, unlock } from '@/lib/biolock';
import { useFood } from '@/lib/food';
import { useHealth } from '@/lib/health';
import { useTrain } from '@/lib/train';
import { addDays } from '@/lib/nutrition';
import { shortDate } from '@/lib/progress';
import { useSettings } from '@/theme/settings';

const ROSE = '#E11D48';
type Tab = 'today' | 'calendar' | 'insights' | 'learn';
type State = { settings: CycleSettings; periods: Period[]; logs: Record<string, CycleLog>; anon: boolean };

/** Cycle tracking: phase, predictions, log, calendar and learn (design: period). Private to you. */
export default function PeriodScreen() {
  const { t } = useT();
  const { colors: c } = useSettings();
  const { session, profile } = useAuth();
  const uid = session?.user.id;
  const [st, setSt] = useState<State | null>(null);
  const [tab, setTab] = useState<Tab>('today');
  const [modeOpen, setModeOpen] = useState(false);
  const [setOpen, setSetOpen] = useState(false);
  const [unlocked, setUnlocked] = useState(false);
  const { today } = useFood();

  const load = useCallback(async () => {
    if (!uid) return;
    const v = await loadCycle(uid);
    setSt(v);
    // Keep what your partner sees up to date (only what you chose to share).
    if (!v.anon) {
      const pt = await getPartner();
      if (pt) await savePartner(uid, pt, partnerSummary(cycleNow(v.periods, v.settings, today), pt.share, v.settings.mode));
    }
  }, [uid, today]);
  useEffect(() => {
    let alive = true;
    (async () => {
      if (alive) await load();
    })();
    return () => {
      alive = false;
    };
  }, [load]);

  if (profile && profile.gender !== 'female')
    return (
      <Screen title={t('Cycle')} back>
        <Card style={{ alignItems: 'center' }}>
          <Text variant="small" color="sec" center>
            {t('Cycle tracking is only for accounts set to female.')}
          </Text>
        </Card>
      </Screen>
    );
  if (!st)
    return (
      <Screen title={t('Cycle')} back>
        <Thinking message={t('Loading')} />
      </Screen>
    );
  if (st.settings.lock && lockSupported && !unlocked)
    return (
      <Screen title={t('Cycle')} back>
        <Card style={{ alignItems: 'center', paddingVertical: 28 }}>
          <Icon name="lock" size={34} color={c.cobalt} />
          <Text variant="h3" style={{ marginTop: 8 }}>
            {t('Cycle tracking is locked')}
          </Text>
          <Button title={t('Unlock')} style={{ marginTop: 12, alignSelf: 'stretch' }} onPress={async () => setUnlocked(await unlock(t('Unlock cycle tracking')))} />
        </Card>
      </Screen>
    );
  const m = CY_MODES[st.settings.mode];
  const pregLike = st.settings.mode === 'preg' || st.settings.mode === 'post';
  const tabs: { value: Tab; label: string }[] = pregLike
    ? [
        { value: 'today', label: t('Today') },
        { value: 'learn', label: t('Learn') },
      ]
    : [
        { value: 'today', label: t('Today') },
        { value: 'calendar', label: t('Calendar') },
        { value: 'insights', label: t('Insights') },
        { value: 'learn', label: t('Learn') },
      ];
  const cur = tabs.some((x) => x.value === tab) ? tab : 'today';
  return (
    <Screen title={t('Cycle')} back right={<NavButton icon="gear" label={t('Cycle settings')} onPress={() => setSetOpen(true)} />}>
      <Card onPress={() => setModeOpen(true)} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 }}>
        <View style={{ width: 34, height: 34, borderRadius: 11, backgroundColor: c.cobalt, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name={m[2] as IconName} size={17} color="#FFFFFF" />
        </View>
        <View style={{ flex: 1 }}>
          <Text variant="xs" weight={700} color="sec">
            {t('Mode')}
          </Text>
          <Text weight={700}>{t(m[0])}</Text>
        </View>
        <Icon name="chevd" size={18} color={c.sec} />
      </Card>
      <Segmented<Tab> value={cur} options={tabs} onChange={setTab} />
      <View style={{ height: 14 }} />
      {st.anon ? (
        <Row gap={6} style={{ marginHorizontal: 4, marginBottom: 10 }}>
          <Icon name="lock" size={14} color={c.sec} />
          <Text variant="small" color="sec">
            {t('Anonymous mode is on. Cycle data stays on this phone.')}
          </Text>
        </Row>
      ) : null}
      {cur === 'today' ? <TodayTab st={st} reload={load} uid={uid ?? ''} /> : cur === 'calendar' ? <CalendarTab st={st} reload={load} /> : cur === 'insights' ? <InsightsTab st={st} /> : <LearnTab />}
      <Text variant="xs" color="sec" center style={{ marginTop: 16 }}>
        {t('Predictions are estimates and can’t be used as birth control. Not medical advice. Cycle data is never shared with friends or coaches.')}
      </Text>
      <Sheet open={modeOpen} onClose={() => setModeOpen(false)}>
        <Text variant="h2">{t('What are you tracking?')}</Text>
        <View style={{ marginTop: 12 }}>
          {(Object.keys(CY_MODES) as CycleMode[]).map((k) => (
            <Option
              key={k}
              icon={CY_MODES[k][2] as IconName}
              title={t(CY_MODES[k][0])}
              subtitle={t(CY_MODES[k][1])}
              selected={st.settings.mode === k}
              onPress={async () => {
                const next = { ...st.settings, mode: k, preg_week: k === 'preg' ? (st.settings.preg_week ?? 12) : st.settings.preg_week, post_week: k === 'post' ? (st.settings.post_week ?? 2) : st.settings.post_week };
                setSt({ ...st, settings: next });
                setModeOpen(false);
                if (uid) await saveSettings(uid, next);
              }}
            />
          ))}
        </View>
      </Sheet>
      <Sheet open={setOpen} onClose={() => setSetOpen(false)}>
        {setOpen ? <SettingsSheet st={st} uid={uid ?? ''} onDone={() => (setSetOpen(false), load())} /> : null}
      </Sheet>
    </Screen>
  );
}

function TodayTab({ st, reload, uid }: { st: State; reload: () => void; uid: string }) {
  const { t, lang } = useT();
  const { colors: c } = useSettings();
  const toast = useToast();
  const { today } = useFood();
  const [logOpen, setLogOpen] = useState(false);
  const [pastOpen, setPastOpen] = useState(false);
  const s = st.settings;
  if (s.mode === 'preg') return <Pregnancy week={s.preg_week ?? 12} set={async (w) => (await saveSettings(uid, { ...s, preg_week: w }), reload())} />;
  if (s.mode === 'post') return <AfterBirth week={s.post_week ?? 2} set={async (w) => (await saveSettings(uid, { ...s, post_week: w }), reload())} />;
  const now = cycleNow(st.periods, s, today);
  const lg = st.logs[today] ?? {};
  const logged = Object.values(lg).flat();
  const ttc = s.mode === 'ttc';

  const start = async () => {
    const p = await startPeriod(today);
    if (!p) return toast(t('Couldn’t save. Please try again.'), { icon: 'warn' });
    toast(t('Period start logged. Predictions updated.'), { icon: 'drop', undo: async () => (await deletePeriod(p.id), reload()) });
    reload();
  };

  return (
    <View>
      {s.mode === 'peri' ? (
        <Card style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
          <Icon name="moon" size={20} color={c.cobalt} />
          <Text variant="small" style={{ flex: 1 }}>
            {t('In perimenopause cycles can get shorter, longer or skip. Predictions are less exact, so keep logging. Strength training and enough protein matter more now for bones and muscle.')}
          </Text>
        </Card>
      ) : null}
      {now ? (
        <Card style={{ alignItems: 'center', paddingVertical: 22 }}>
          <Ring value={Math.min(now.day, now.cycle)} max={now.cycle} size={170} stroke={15} color={now.phase === 'Period' ? ROSE : c.cobalt}>
            <Text variant="small" weight={700} color="sec">
              {t('Day')}
            </Text>
            <Text num size={40}>
              {now.day}
            </Text>
            <Text variant="small" weight={700} color="sec">
              {t('{p} phase', { p: t(now.phase) })}
            </Text>
          </Ring>
          <Text variant="h3" style={{ marginTop: 16 }}>
            {now.phase === 'Period' ? t('Period day {n}', { n: now.day }) : now.late ? t('Your period is {n} days late', { n: now.day - now.cycle }) : t('Next period in {n} days', { n: Math.max(0, now.untilNext) })}
          </Text>
          <Text variant="small" color="sec">
            {t('Expected {d}', { d: shortDate(now.next, lang) })}
          </Text>
          {ttc ? (
            <Row gap={10} style={{ marginTop: 16, alignSelf: 'stretch' }}>
              <View style={{ flex: 1, backgroundColor: c.inset, borderRadius: 14, padding: 10 }}>
                <Text variant="xs" weight={700} color="sec">
                  {t('Chance to get pregnant today')}
                </Text>
                <Text weight={700} color={today >= now.fertileFrom && today <= now.fertileTo ? c.cobalt : 'text'}>
                  {t(today === now.ovDay ? 'Highest' : today >= now.fertileFrom && today <= now.fertileTo ? 'High' : 'Low')}
                </Text>
              </View>
              <View style={{ flex: 1, backgroundColor: c.inset, borderRadius: 14, padding: 10 }}>
                <Text variant="xs" weight={700} color="sec">
                  {t('Fertile window')}
                </Text>
                <Text weight={700}>{`${shortDate(now.fertileFrom, lang)} – ${shortDate(now.fertileTo, lang)}`}</Text>
                <Text variant="xs" color="sec">
                  {t('Ovulation about {d}', { d: shortDate(now.ovDay, lang) })}
                </Text>
              </View>
            </Row>
          ) : null}
          <Row gap={8} style={{ marginTop: 16, flexWrap: 'wrap', justifyContent: 'center' }}>
            {now.phase === 'Period' && now.open ? (
              <Button
                small
                kind="soft"
                title={t('My period ended')}
                onPress={async () => {
                  await endPeriod(now.last.id, today);
                  toast(t('Period length saved: {n} days', { n: now.day }), { icon: 'check' });
                  reload();
                }}
              />
            ) : now.phase !== 'Period' ? (
              <Button small kind="danger" icon="drop" title={t('Period started today')} onPress={start} />
            ) : null}
            <Button small kind="glass" icon="plus" title={t('Log today')} onPress={() => setLogOpen(true)} />
          </Row>
        </Card>
      ) : (
        <Card style={{ alignItems: 'center', paddingVertical: 24 }}>
          <Icon name="drop" size={34} color={ROSE} />
          <Text variant="h3" style={{ marginTop: 8 }}>
            {t('When did your last period start?')}
          </Text>
          <Text variant="small" color="sec" center style={{ marginTop: 4 }}>
            {t('Add it to see your phase and when the next one is due.')}
          </Text>
          <Row gap={8} style={{ marginTop: 12 }}>
            <Button small icon="drop" title={t('It started today')} onPress={start} />
            <Button small kind="glass" title={t('Add a past period')} onPress={() => setPastOpen(true)} />
          </Row>
        </Card>
      )}
      {logged.length ? (
        <Card>
          <Row style={{ justifyContent: 'space-between' }}>
            <Text variant="small" weight={700}>
              {t('Logged today')}
            </Text>
            <Button small kind="ghost" title={t('Edit')} onPress={() => setLogOpen(true)} />
          </Row>
          <Row gap={6} style={{ flexWrap: 'wrap', marginTop: 4 }}>
            {logged.map((x) => (
              <Chip key={x} title={t(x)} on />
            ))}
          </Row>
        </Card>
      ) : null}
      {now ? (
        <>
          <Text variant="small" weight={700} color="sec" style={{ marginTop: 8, marginBottom: 8, marginHorizontal: 4 }}>
            {t('Your plan this phase')}
          </Text>
          <Card>
            {(
              [
                ['train', 'Training', CY_PLAN[now.phase].t],
                ['food', 'Food', CY_PLAN[now.phase].f],
                ['pulse', 'Recovery', CY_PLAN[now.phase].r],
              ] as const
            ).map(([i, n, x]) => (
              <Row key={n} gap={12} style={{ alignItems: 'flex-start', marginTop: 8 }}>
                <View style={{ width: 34, height: 34, borderRadius: 11, backgroundColor: c.cobalt, alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name={i} size={17} color="#FFFFFF" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text variant="small" weight={700}>
                    {t(n)}
                  </Text>
                  <Text variant="small" color="sec">
                    {t(x)}
                  </Text>
                </View>
              </Row>
            ))}
          </Card>
          {now.phase === 'Luteal' ? (
            <Card style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
              <Icon name="scale" size={20} color={c.cobalt} />
              <Text variant="small" style={{ flex: 1 }}>
                {t('If the scale goes up this week, it’s likely water. Your coach won’t cut calories because of it.')}
              </Text>
            </Card>
          ) : null}
          <Text variant="small" weight={700} color="sec" style={{ marginTop: 8, marginBottom: 8, marginHorizontal: 4 }}>
            {t('Ask the coach')}
          </Text>
          <Row gap={8} style={{ flexWrap: 'wrap' }}>
            {(ttc ? ['When should I train hard while trying?', 'What should I eat to support fertility?'] : s.mode === 'peri' ? ['Why is my sleep worse?', 'How should I train in perimenopause?'] : ['Why am I hungrier this week?', 'Can I train hard on my period?', 'Why did my weight go up?']).map((q) => (
              <Chip key={q} title={t(q)} onPress={() => router.push({ pathname: '/coach', params: { ask: t(q) } })} />
            ))}
          </Row>
        </>
      ) : null}
      <Sheet open={logOpen} onClose={() => setLogOpen(false)}>
        {logOpen ? <LogSheet day={today} init={lg} onDone={() => (setLogOpen(false), reload())} /> : null}
      </Sheet>
      <Sheet open={pastOpen} onClose={() => setPastOpen(false)}>
        {pastOpen ? <PastSheet onDone={() => (setPastOpen(false), reload())} /> : null}
      </Sheet>
    </View>
  );
}

function LogSheet({ day, init, onDone }: { day: string; init: CycleLog; onDone: () => void }) {
  const { t, lang } = useT();
  const toast = useToast();
  const [lg, setLg] = useState<CycleLog>(init);
  const tog = (cat: string, o: string) => {
    const a = lg[cat] ?? [];
    const next = a.includes(o) ? a.filter((x) => x !== o) : SINGLE.includes(cat) ? [o] : [...a, o];
    setLg({ ...lg, [cat]: next });
  };
  return (
    <View>
      <Text variant="h2">{t('Today, {d}', { d: shortDate(day, lang) })}</Text>
      <Text variant="small" color="sec" style={{ marginTop: 4 }}>
        {t('Tap what applies. It helps find your patterns.')}
      </Text>
      {Object.entries(CY_LOG).map(([cat, opts]) => (
        <View key={cat}>
          <Label>{t(cat)}</Label>
          <Row gap={8} style={{ flexWrap: 'wrap' }}>
            {opts.map((o) => (
              <Chip key={o} title={t(o)} on={(lg[cat] ?? []).includes(o)} onPress={() => tog(cat, o)} />
            ))}
          </Row>
        </View>
      ))}
      <Button
        title={t('Save')}
        style={{ marginTop: 16 }}
        onPress={async () => {
          const clean = Object.fromEntries(Object.entries(lg).filter(([, v]) => v.length));
          const ok = await saveLog(day, clean);
          toast(ok ? t('Saved for today') : t('Couldn’t save. Please try again.'), { icon: ok ? 'check' : 'warn' });
          onDone();
        }}
      />
    </View>
  );
}

function PastSheet({ onDone }: { onDone: () => void }) {
  const { t } = useT();
  const toast = useToast();
  const { today } = useFood();
  const [d, setD] = useState(addDays(today, -28));
  const [b, setB] = useState(5);
  return (
    <View>
      <Text variant="h2">{t('Add a past period')}</Text>
      <Row style={{ justifyContent: 'space-between', marginTop: 16 }}>
        <Text weight={700}>{t('Period started on')}</Text>
        <DateField value={d} onChange={setD} label={t('Period started on')} max={today} />
      </Row>
      <Text weight={700} style={{ marginTop: 16 }}>
        {t('Period days')}
      </Text>
      <Card style={{ marginTop: 8 }}>
        <Stepper onMinus={() => setB(Math.max(1, b - 1))} onPlus={() => setB(Math.min(10, b + 1))} labels={[t('Less'), t('More')]}>
          <Text num size={26}>
            {b}
          </Text>
        </Stepper>
      </Card>
      <Button
        title={t('Add')}
        onPress={async () => {
          const ok = await addPastPeriod(d, b);
          toast(ok ? t('Past period added') : t('Couldn’t save. Please try again.'), { icon: ok ? 'check' : 'warn' });
          onDone();
        }}
      />
    </View>
  );
}

function CalendarTab({ st, reload }: { st: State; reload: () => void }) {
  const { t, lang } = useT();
  const { colors: c } = useSettings();
  const toast = useToast();
  const { today } = useFood();
  const [pastOpen, setPastOpen] = useState(false);
  const av = averages(st.periods, st.settings);
  const [y, mo] = today.split('-').map(Number);
  const months = [new Date(y, mo - 2, 1), new Date(y, mo - 1, 1), new Date(y, mo, 1)];
  const pad = (n: number) => String(n).padStart(2, '0');
  const sorted = [...st.periods].sort((a, b) => b.start_day.localeCompare(a.start_day));
  return (
    <View>
      {months.map((first) => {
        const days = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
        const off = first.getDay();
        const cells: (string | null)[] = [...Array(off).fill(null), ...Array.from({ length: days }, (_, i) => `${first.getFullYear()}-${pad(first.getMonth() + 1)}-${pad(i + 1)}`)];
        return (
          <Card key={first.toISOString()}>
            <Text weight={700}>{new Intl.DateTimeFormat(lang === 'ar' ? 'ar-u-nu-latn' : 'en-US', { month: 'long', year: 'numeric' }).format(first)}</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 8, direction: 'ltr' } as object}>
              {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((x, i) => (
                <View key={`h${i}`} style={{ width: `${100 / 7}%`, alignItems: 'center', paddingVertical: 4 }}>
                  <Text variant="xs" weight={700} color="sec">
                    {x}
                  </Text>
                </View>
              ))}
              {cells.map((d, i) => {
                if (!d) return <View key={`e${i}`} style={{ width: `${100 / 7}%`, aspectRatio: 1 }} />;
                const inf = dayInfo(d, st.periods, st.settings, today);
                const look = inf.period
                  ? { backgroundColor: ROSE }
                  : inf.expected
                    ? { borderWidth: 2, borderColor: ROSE, borderStyle: 'dashed' as const }
                    : inf.ov
                      ? { borderWidth: 2, borderColor: c.cobalt }
                      : inf.fertile
                        ? { backgroundColor: 'rgba(51,85,255,0.14)' }
                        : {};
                return (
                  <View key={d} style={{ width: `${100 / 7}%`, aspectRatio: 1, padding: 2 }}>
                    <View style={[{ flex: 1, borderRadius: 100, alignItems: 'center', justifyContent: 'center' }, look, d === today ? { borderWidth: 2, borderColor: c.text } : null]}>
                      <Text size={13} weight={600} color={inf.period ? '#FFFFFF' : inf.expected ? ROSE : inf.ov || inf.fertile ? c.cobalt : 'text'}>
                        {Number(d.slice(8))}
                      </Text>
                      {st.logs[d] ? <View style={{ position: 'absolute', bottom: 3, width: 4, height: 4, borderRadius: 2, backgroundColor: inf.period ? '#FFFFFF' : c.sec }} /> : null}
                    </View>
                  </View>
                );
              })}
            </View>
          </Card>
        );
      })}
      <Row gap={12} style={{ flexWrap: 'wrap', marginHorizontal: 4, marginBottom: 12 }}>
        {(
          [
            [{ backgroundColor: ROSE }, 'Period'],
            [{ borderWidth: 2, borderColor: ROSE, borderStyle: 'dashed' }, 'Expected'],
            [{ backgroundColor: 'rgba(51,85,255,0.2)' }, 'Fertile'],
            [{ borderWidth: 2, borderColor: c.cobalt }, 'Ovulation'],
          ] as const
        ).map(([st2, l]) => (
          <Row key={l} gap={5}>
            <View style={[{ width: 12, height: 12, borderRadius: 6 }, st2]} />
            <Text variant="xs" weight={700} color="sec">
              {t(l)}
            </Text>
          </Row>
        ))}
      </Row>
      <Row gap={8}>
        {[
          [t('{n} days', { n: av.cycle }), t('Average cycle')],
          [t('{n} days', { n: av.bleed }), t('Average period')],
          [av.varies == null ? '–' : t(av.varies <= 3 ? 'Regular' : 'Irregular'), av.varies == null ? t('Needs 3 cycles') : t('Varies by {n} days', { n: av.varies })],
        ].map(([a, b]) => (
          <View key={b} style={{ flex: 1, backgroundColor: c.card, borderRadius: 18, padding: 12, alignItems: 'center' }}>
            <Text num size={16}>
              {a}
            </Text>
            <Text variant="xs" weight={700} color="sec" center>
              {b}
            </Text>
          </View>
        ))}
      </Row>
      <Row style={{ justifyContent: 'space-between', marginTop: 20, marginBottom: 8, marginHorizontal: 4 }}>
        <Text variant="h3">{t('Past periods')}</Text>
        <Button small kind="ghost" icon="plus" title={t('Add')} onPress={() => setPastOpen(true)} />
      </Row>
      {sorted.length ? (
        <List>
          {sorted.map((p, i) => (
            <ListRow key={p.id} first={!i}>
              <Icon name="drop" size={18} color={ROSE} />
              <View style={{ flex: 1 }}>
                <Text weight={700}>{t('Started {d}', { d: shortDate(p.start_day, lang) })}</Text>
                <Text variant="small" color="sec">
                  {p.end_day ? t('Period {n} days', { n: Math.round((new Date(`${p.end_day}T12:00:00`).getTime() - new Date(`${p.start_day}T12:00:00`).getTime()) / 864e5) + 1 }) : t('Still on')}
                </Text>
              </View>
              <Button
                small
                kind="ghost"
                icon="trash"
                title=""
                onPress={async () => {
                  await deletePeriod(p.id);
                  toast(t('Deleted'), { icon: 'trash' });
                  reload();
                }}
              />
            </ListRow>
          ))}
        </List>
      ) : null}
      <Text variant="xs" color="sec" style={{ marginHorizontal: 4 }}>
        {t('Adding at least 3 past periods makes predictions more accurate.')}
      </Text>
      <Sheet open={pastOpen} onClose={() => setPastOpen(false)}>
        {pastOpen ? <PastSheet onDone={() => (setPastOpen(false), reload())} /> : null}
      </Sheet>
    </View>
  );
}

function InsightsTab({ st }: { st: State }) {
  const { t } = useT();
  const { colors: c } = useSettings();
  const health = useHealth();
  const train = useTrain();
  const PH = ['Period', 'Follicular', 'Ovulation', 'Luteal'] as const;
  const counts: Record<string, Record<string, number>> = { Period: {}, Follicular: {}, Ovulation: {}, Luteal: {} };
  for (const [day, lg] of Object.entries(st.logs)) {
    const ph = phaseOn(day, st.periods, st.settings);
    if (!ph) continue;
    for (const [cat, items] of Object.entries(lg)) if (cat !== 'Flow') for (const it of items) counts[ph][it] = (counts[ph][it] ?? 0) + 1;
  }
  const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
  const byPhase = (vals: { day: string; v: number }[]) => PH.map((ph) => avg(vals.filter((x) => phaseOn(x.day, st.periods, st.settings) === ph).map((x) => x.v)));
  const vol = byPhase(train.logs.filter((l) => l.volume > 0).map((l) => ({ day: l.day, v: l.volume })));
  const wt = byPhase(health.weights.map((w) => ({ day: w.day, v: w.value })));
  const tips: { icon: IconName; title: string; body: string }[] = [];
  for (const ph of PH) {
    const top = Object.entries(counts[ph]).sort((a, b) => b[1] - a[1])[0];
    if (top && top[1] >= 2) tips.push({ icon: 'body', title: t('{x} in your {p} phase', { x: t(top[0]), p: t(ph).toLowerCase() }), body: t('You logged it on {n} days in this phase.', { n: top[1] }) });
  }
  if (wt[3] != null && wt[1] != null && wt[3] - wt[1] >= 0.3) tips.push({ icon: 'scale', title: t('Water weight before your period'), body: t('Your weight is about {n} kg higher in the luteal phase than the follicular phase. It drops again after your period starts.', { n: Math.round((wt[3] - wt[1]) * 10) / 10 }) });
  const best = vol.map((v, i) => [v ?? -1, i] as const).sort((a, b) => b[0] - a[0])[0];
  if (best && best[0] > 0) tips.push({ icon: 'trophy', title: t('Your strongest phase'), body: t('Your training volume is highest in the {p} phase. Plan heavy sessions then.', { p: t(PH[best[1]]).toLowerCase() }) });
  const enough = st.periods.length >= 1 && (Object.keys(st.logs).length >= 3 || train.logs.length >= 3);
  return (
    <View>
      {enough && tips.length ? (
        tips.map((x) => (
          <Card key={x.title} style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
            <View style={{ width: 34, height: 34, borderRadius: 11, backgroundColor: c.cobalt, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name={x.icon} size={18} color="#FFFFFF" />
            </View>
            <View style={{ flex: 1 }}>
              <Text weight={700}>{x.title}</Text>
              <Text variant="small" color="sec" style={{ marginTop: 2 }}>
                {x.body}
              </Text>
            </View>
          </Card>
        ))
      ) : (
        <Card style={{ alignItems: 'center', paddingVertical: 20 }}>
          <Icon name="sparkle" size={28} color={c.cobalt} />
          <Text variant="small" color="sec" center style={{ marginTop: 8 }}>
            {t('Log your periods, symptoms and workouts for a cycle or two. Then the patterns we find show here.')}
          </Text>
        </Card>
      )}
      {vol.some((v) => v != null) ? (
        <Card>
          <Text variant="xs" weight={700} color="sec">
            {t('Average training volume per session (kg)')}
          </Text>
          <View style={{ marginTop: 8 }}>
            <BarChart values={vol.map((v) => (v == null ? null : Math.round(v)))} labels={PH.map((p) => t(p))} highlight={best?.[1] ?? -1} />
          </View>
        </Card>
      ) : null}
    </View>
  );
}

const ARTICLES: [string, string, string][] = [
  ['Cycle basics', 'The 4 phases of your cycle, simply explained', 'Your cycle has 4 phases: your period, the follicular phase (energy rises), ovulation (an egg is released), and the luteal phase (progesterone rises, hunger and water weight can go up). A normal cycle is 21 to 35 days.'],
  ['Training', 'How to train in each phase', 'Follicular phase: push heavier and try PRs. Ovulation: still strong, warm up well. Luteal: keep weights, drop a set if tired. Period: train as you feel; light movement can ease cramps.'],
  ['Nutrition', 'Iron, magnesium and cravings', 'You lose iron during your period, so eat red meat, lentils or spinach with vitamin C. Magnesium (nuts, dark chocolate) can help cramps. Cravings in the luteal phase are normal; plan a protein snack.'],
  ['Fertility', 'How the fertile window works', 'An egg lives about a day after ovulation, and sperm can live up to 5 days. So the fertile window is the 5 days before ovulation and the day of it. Ovulation is usually about 14 days before your next period.'],
  ['Pregnancy', 'Safe exercise when you’re pregnant', 'Most women can keep training at a moderate effort: you should be able to talk. Avoid maximum lifts, holding your breath and contact sports. Always check with your doctor first.'],
  ['After birth', 'Pelvic floor and returning to the gym', 'Start with breathing, pelvic floor work and walks. After your doctor clears you, add light strength and rebuild your core. Running and jumping usually come back from about week 12.'],
  ['When to see a doctor', 'Very painful, heavy or missing periods', 'See a doctor if your periods are very painful, very heavy, last more than 7 days, come less than 21 or more than 35 days apart, or stop for 3 months when you’re not pregnant.'],
];

function LearnTab() {
  const { t } = useT();
  const { colors: c } = useSettings();
  const [open, setOpen] = useState<number | null>(null);
  return (
    <View>
      <List>
        {ARTICLES.map(([cat, title], i) => (
          <ListRow key={title} first={!i} onPress={() => setOpen(i)}>
            <Icon name="book" size={18} color={c.cobalt} />
            <View style={{ flex: 1 }}>
              <Text variant="xs" weight={700} color="sec">
                {t(cat)}
              </Text>
              <Text weight={700}>{t(title)}</Text>
            </View>
            <Icon name="chev" size={16} color={c.sec} />
          </ListRow>
        ))}
      </List>
      <Sheet open={open != null} onClose={() => setOpen(null)}>
        {open != null ? (
          <View>
            <Text variant="xs" weight={700} color="sec">
              {t(ARTICLES[open][0])}
            </Text>
            <Text variant="h2" style={{ marginTop: 4 }}>
              {t(ARTICLES[open][1])}
            </Text>
            <Text style={{ marginTop: 12, lineHeight: 24 }}>{t(ARTICLES[open][2])}</Text>
            <Button kind="soft" title={t('Done')} style={{ marginTop: 16 }} onPress={() => setOpen(null)} />
          </View>
        ) : null}
      </Sheet>
    </View>
  );
}

const SIZES = ['poppy seed', 'sesame seed', 'lentil', 'blueberry', 'raspberry', 'grape', 'kumquat', 'fig', 'lime', 'lemon', 'peach', 'apple', 'avocado', 'onion', 'sweet potato', 'mango', 'banana', 'carrot', 'papaya', 'grapefruit', 'cantaloupe', 'cauliflower', 'lettuce', 'cabbage', 'coconut', 'pineapple', 'squash', 'honeydew', 'watermelon'];

function Pregnancy({ week: w, set }: { week: number; set: (w: number) => void }) {
  const { t } = useT();
  const { colors: c } = useSettings();
  const tri = w < 14 ? 1 : w < 28 ? 2 : 3;
  const size = SIZES[Math.max(0, Math.min(28, Math.floor((w - 4) / 1.2)))];
  const tips = ['Keep effort moderate: you should be able to talk while training.', 'No maximum lifts, no holding your breath, no contact sports.', ...(w >= 20 ? ['Avoid long time lying flat on your back. Use an incline bench instead.'] : []), 'Stop and call your doctor if you feel pain, dizziness or bleeding.'];
  return (
    <View>
      <Card style={{ alignItems: 'center', paddingVertical: 22 }}>
        <Ring value={w} max={40} size={170} stroke={15}>
          <Text variant="small" weight={700} color="sec">
            {t('Week')}
          </Text>
          <Text num size={40}>
            {w}
          </Text>
          <Text variant="small" weight={700} color="sec">
            {t('Trimester {n}', { n: tri })}
          </Text>
        </Ring>
        <Text variant="h3" center style={{ marginTop: 16 }}>
          {t('Your baby is about the size of a {x}', { x: t(size) })}
        </Text>
        <Row gap={8} style={{ marginTop: 12 }}>
          <Button small kind="soft" icon="minus" title="" onPress={() => set(Math.max(4, w - 1))} />
          <Text variant="small" weight={700} color="sec">
            {t('Change week')}
          </Text>
          <Button small kind="soft" icon="plus" title="" onPress={() => set(Math.min(42, w + 1))} />
        </Row>
      </Card>
      <Text variant="small" weight={700} color="sec" style={{ marginBottom: 8, marginHorizontal: 4 }}>
        {t('Your body this week')}
      </Text>
      <Card>
        <Text variant="small">{t(tri === 1 ? 'Tiredness and nausea are common. Small meals every few hours help.' : tri === 2 ? 'Energy often comes back. Your belly starts to show and your balance shifts.' : 'You may feel short of breath and need the bathroom more. Sleep on your side.')}</Text>
      </Card>
      <Text variant="small" weight={700} color="sec" style={{ marginBottom: 8, marginHorizontal: 4 }}>
        {t('Training while pregnant')}
      </Text>
      <Card>
        {tips.map((x) => (
          <Row key={x} gap={10} style={{ alignItems: 'flex-start', marginTop: 6 }}>
            <Icon name="check" size={16} color={c.up} strokeWidth={2.4} />
            <Text variant="small" style={{ flex: 1 }}>
              {t(x)}
            </Text>
          </Row>
        ))}
      </Card>
      <Text variant="xs" color="sec" center>
        {t('Always check with your doctor before starting or changing exercise in pregnancy.')}
      </Text>
    </View>
  );
}

function AfterBirth({ week: w, set }: { week: number; set: (w: number) => void }) {
  const { t } = useT();
  const { colors: c } = useSettings();
  const stage = w < 6 ? 0 : w < 12 ? 1 : 2;
  const steps: [string, string][] = [
    ['Weeks 0 to 6', 'Breathing, pelvic floor and short walks'],
    ['After your doctor clears you', 'Light strength, low impact, core rebuild'],
    ['From about week 12', 'Build back to normal training, slowly add running and jumping'],
  ];
  return (
    <View>
      <Card style={{ alignItems: 'center', paddingVertical: 22 }}>
        <Text variant="small" weight={700} color="sec">
          {t('Since birth')}
        </Text>
        <Text num size={34}>
          {t('{n} weeks', { n: w })}
        </Text>
        <Row gap={8} style={{ marginTop: 12 }}>
          <Button small kind="soft" icon="minus" title="" onPress={() => set(Math.max(0, w - 1))} />
          <Text variant="small" weight={700} color="sec">
            {t('Change')}
          </Text>
          <Button small kind="soft" icon="plus" title="" onPress={() => set(Math.min(104, w + 1))} />
        </Row>
      </Card>
      <Text variant="small" weight={700} color="sec" style={{ marginBottom: 8, marginHorizontal: 4 }}>
        {t('Getting back to training')}
      </Text>
      <List>
        {steps.map(([a, b], i) => (
          <ListRow key={a} first={!i}>
            <View style={{ width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: i < stage ? c.cobalt : 'transparent', borderWidth: i < stage ? 0 : 2, borderColor: i === stage ? c.cobalt : c.line }}>
              {i < stage ? <Icon name="check" size={13} color="#FFFFFF" strokeWidth={3} /> : <Text variant="xs" weight={700} color={i === stage ? c.cobalt : 'sec'}>{`${i + 1}`}</Text>}
            </View>
            <View style={{ flex: 1 }}>
              <Text weight={700}>{t(a)}</Text>
              <Text variant="small" color="sec">
                {t(b)}
              </Text>
            </View>
          </ListRow>
        ))}
      </List>
      <Card style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
        <Icon name="food" size={20} color={c.cobalt} />
        <Text variant="small" style={{ flex: 1 }}>
          {t('If you’re breastfeeding you need about 400 to 500 kcal more a day. Don’t start a big cut.')}
        </Text>
      </Card>
      <Text variant="xs" color="sec" center>
        {t('Your first period can take weeks or months to come back. Start tracking again when it does.')}
      </Text>
    </View>
  );
}

function SettingsSheet({ st, uid, onDone }: { st: State; uid: string; onDone: () => void }) {
  const { t } = useT();
  const toast = useToast();
  const [s, setS] = useState<CycleSettings>(st.settings ?? DEFAULT_CYCLE);
  const [del, setDel] = useState(false);
  const [anon, setAnonState] = useState(st.anon);
  const [anonBusy, setAnonBusy] = useState(false);
  const [partner, setPartner] = useState<Partner | null>(null);
  const [partnerLoaded, setPartnerLoaded] = useState(false);
  const { today } = useFood();
  useEffect(() => {
    let alive = true;
    getPartner().then((p) => {
      if (!alive) return;
      setPartner(p);
      setPartnerLoaded(true);
    });
    return () => {
      alive = false;
    };
  }, []);
  return (
    <View>
      <Text variant="h2">{t('Cycle settings')}</Text>
      <Text variant="small" color="sec" style={{ marginTop: 4 }}>
        {t('Used until you have a few periods logged. Then Gymi uses your real averages.')}
      </Text>
      <Text weight={700} style={{ marginTop: 16 }}>
        {t('Usual cycle length (days)')}
      </Text>
      <Card style={{ marginTop: 8 }}>
        <Stepper onMinus={() => setS({ ...s, cycle_len: Math.max(18, s.cycle_len - 1) })} onPlus={() => setS({ ...s, cycle_len: Math.min(45, s.cycle_len + 1) })} labels={[t('Less'), t('More')]}>
          <Text num size={26}>
            {s.cycle_len}
          </Text>
        </Stepper>
      </Card>
      <Text weight={700}>{t('Usual period length (days)')}</Text>
      <Card style={{ marginTop: 8 }}>
        <Stepper onMinus={() => setS({ ...s, period_len: Math.max(1, s.period_len - 1) })} onPlus={() => setS({ ...s, period_len: Math.min(10, s.period_len + 1) })} labels={[t('Less'), t('More')]}>
          <Text num size={26}>
            {s.period_len}
          </Text>
        </Stepper>
      </Card>
      <Label>{t('Privacy')}</Label>
      <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View style={{ flex: 1 }}>
          <Text weight={700}>{t('Anonymous mode')}</Text>
          <Text variant="xs" color="sec">
            {t('Cycle data is kept only on this phone, not on our server. It won’t move to a new phone and partner sharing turns off.')}
          </Text>
        </View>
        <Toggle
          value={anon}
          onChange={async (v) => {
            setAnonBusy(true);
            await setAnonMode(uid, v);
            setAnonBusy(false);
            setAnonState(v);
            toast(t(v ? 'Anonymous mode on. Cycle data is now only on this phone.' : 'Anonymous mode off. Cycle data is saved to your account again.'), { icon: 'lock' });
          }}
          label={t('Anonymous mode')}
        />
      </Card>
      {anonBusy ? <Thinking message={t('Moving your cycle data')} /> : null}
      {lockSupported ? (
        <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View style={{ flex: 1 }}>
            <Text weight={700}>{t('Lock with Face ID')}</Text>
            <Text variant="xs" color="sec">
              {t('Ask for Face ID or your fingerprint to open cycle tracking')}
            </Text>
          </View>
          <Toggle value={!!s.lock} onChange={(v) => setS({ ...s, lock: v })} label={t('Lock with Face ID')} />
        </Card>
      ) : null}
      <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View style={{ flex: 1 }}>
          <Text weight={700}>{t('Hidden from Gym Bros and coaches')}</Text>
          <Text variant="xs" color="sec">
            {t('Friends, groups and coaches never see cycle data.')}
          </Text>
        </View>
        <Icon name="lock" size={18} color="#15803D" />
      </Card>
      {!anon ? (
        <>
          <Label>{t('Share with my partner')}</Label>
          <Card>
            <Text variant="small" color="sec">
              {t('Pick one friend from Gym Bros. They see only what you choose, never your logs.')}
            </Text>
            <View style={{ marginTop: 10 }}>
              <FriendPicker value={partner ? [partner.partner_id] : []} onChange={(v) => setPartner(v.length ? { partner_id: v[v.length - 1], share: partner?.share ?? { phase: true, period: true, fertile: false } } : null)} />
            </View>
            {partner ? (
              <Row gap={8} style={{ flexWrap: 'wrap' }}>
                {(
                  [
                    ['phase', 'Phase'],
                    ['period', 'Period dates'],
                    ['fertile', 'Fertile window'],
                  ] as const
                ).map(([k, l]) => (
                  <Chip key={k} title={t(l)} on={partner.share[k]} onPress={() => setPartner({ ...partner, share: { ...partner.share, [k]: !partner.share[k] } })} />
                ))}
              </Row>
            ) : null}
          </Card>
        </>
      ) : null}
      <Button
        title={t('Save')}
        onPress={async () => {
          const ok = await saveSettings(uid, s);
          if (!anon && partnerLoaded) await savePartner(uid, partner, partner ? partnerSummary(cycleNow(st.periods, s, today), partner.share, s.mode) : null);
          toast(ok ? t('Saved') : t('Couldn’t save. Please try again.'), { icon: ok ? 'check' : 'warn' });
          onDone();
        }}
      />
      {del ? (
        <Button
          kind="danger"
          title={t('Yes, delete all cycle data')}
          style={{ marginTop: 8 }}
          onPress={async () => {
            await deleteAllCycle(uid);
            toast(t('Cycle data deleted'), { icon: 'trash' });
            onDone();
          }}
        />
      ) : (
        <Button kind="ghost" title={t('Delete cycle data')} color="#DC2626" style={{ marginTop: 8 }} onPress={() => setDel(true)} />
      )}
    </View>
  );
}
