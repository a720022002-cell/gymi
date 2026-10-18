import { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';

import { Thinking } from '@/components/food/Thinking';
import { Icon, type IconName } from '@/components/Icon';
import { CalendarTab } from '@/components/period/CalendarTab';
import { InsightsTab } from '@/components/period/InsightsTab';
import { LearnTab } from '@/components/period/LearnTab';
import { SettingsSheet } from '@/components/period/SettingsSheet';
import { reminderTexts, type State } from '@/components/period/shared';
import { TodayTab } from '@/components/period/TodayTab';
import { Screen } from '@/components/Screen';
import { Sheet } from '@/components/Sheet';
import { Text } from '@/components/Text';
import { Button, Card, NavButton, Option, Row, Segmented } from '@/components/ui';
import { useT } from '@/i18n';
import { useAuth } from '@/lib/auth';
import { CY_MODES, type CycleMode, cycleNow, getPartner, partnerSummary, savePartner, loadCycle, saveSettings } from '@/lib/cycle';
import { lockSupported, unlock } from '@/lib/biolock';
import { scheduleCycleReminders } from '@/lib/cycleReminders';
import { useFood } from '@/lib/food';
import { useSettings } from '@/theme/settings';

type Tab = 'today' | 'calendar' | 'insights' | 'learn';

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
    // Reminders follow your latest periods.
    const n = cycleNow(v.periods, v.settings, today);
    const tracking = v.settings.mode !== 'preg' && v.settings.mode !== 'post';
    scheduleCycleReminders(
      tracking ? (v.settings.reminders ?? {}) : {},
      n ? { next: n.next, fertileFrom: n.fertileFrom, cycle: n.cycle } : null,
      reminderTexts(t),
      v.settings.mode === 'preg' && v.settings.checklist?.visitRemind ? v.settings.checklist.visit : null,
    ).catch(() => {});
    // Keep what your partner sees up to date (only what you chose to share).
    if (!v.anon) {
      const pt = await getPartner();
      if (pt) await savePartner(uid, pt, partnerSummary(n, pt.share, v.settings.mode, v.logs[today], today));
    }
  }, [uid, today, t]);
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
