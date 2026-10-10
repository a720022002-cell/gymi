import { router, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { type ScrollView, View } from 'react-native';

import { Icon, Mark } from '@/components/Icon';
import { Body } from '@/components/progress/Body';
import { Overall, type PTab } from '@/components/progress/Overall';
import { RecoveryTab } from '@/components/progress/RecoveryTab';
import { SecHead } from '@/components/progress/bits';
import { Streaks } from '@/components/progress/Streaks';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { Card, NavButton, Segmented } from '@/components/ui';
import { useT } from '@/i18n';
import { useSettings } from '@/theme/settings';

const TABS: PTab[] = ['overall', 'body', 'recovery', 'streaks'];

/** Progress: Overall, Body, Recovery and Streaks, then reports (design: progress). */
export default function Progress() {
  const { t } = useT();
  const { colors: c } = useSettings();
  const params = useLocalSearchParams<{ tab?: string }>();
  const [tab, setTab] = useState<PTab>(TABS.includes(params.tab as PTab) ? (params.tab as PTab) : 'overall');
  const [sub, setSub] = useState(0);
  const [seen, setSeen] = useState(params.tab);
  const scrollRef = useRef<ScrollView>(null);
  // Opening Progress from Home's Streaks card picks that tab.
  if (params.tab !== seen) {
    setSeen(params.tab);
    if (TABS.includes(params.tab as PTab)) setTab(params.tab as PTab);
  }

  const go = (to: PTab, s?: number) => {
    setTab(to);
    if (s != null) setSub(s);
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  };

  return (
    <Screen title={t('Progress')} large tabs scrollRef={scrollRef} right={<NavButton icon="share" label={t('Reports')} onPress={() => router.push('/report')} />}>
      <Segmented<PTab>
        value={tab}
        options={[
          { value: 'overall', label: t('Overall') },
          { value: 'body', label: t('Body') },
          { value: 'recovery', label: t('Recovery') },
          { value: 'streaks', label: t('Streaks') },
        ]}
        onChange={(v) => go(v)}
      />
      <View style={{ height: 16 }} />
      {tab === 'overall' ? <Overall go={go} /> : tab === 'body' ? <Body /> : tab === 'recovery' ? <RecoveryTab /> : <Streaks sub={sub} setSub={setSub} />}

      <SecHead title={t('Reports')} />
      <Card onPress={() => router.push('/report')} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Mark size={30} color={c.cobalt} stroke={6} />
        <View style={{ flex: 1 }}>
          <Text weight={700}>{t('Reports')}</Text>
          <Text variant="small" color="sec">
            {t('A week, a month, or any dates you pick')}
          </Text>
        </View>
        <Icon name="chev" size={18} color={c.sec} />
      </Card>
      <Card onPress={() => router.push('/export')} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View style={{ width: 36, height: 36, borderRadius: 11, backgroundColor: c.inset, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="doc" size={20} />
        </View>
        <View style={{ flex: 1 }}>
          <Text weight={700}>{t('Export PDF report')}</Text>
          <Text variant="small" color="sec">
            {t('For your doctor or coach')}
          </Text>
        </View>
        <Icon name="chev" size={18} color={c.sec} />
      </Card>
    </Screen>
  );
}
