import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { View } from 'react-native';

import { useT } from '@/i18n';
import { partnerCycles } from '@/lib/cycle';
import { shortDate } from '@/lib/progress';

import { Icon } from '../Icon';
import { Text } from '../Text';
import { Card } from '../ui';

/** Cycles that friends chose to share with you as their partner. */
export function PartnerCycles() {
  const { t, lang } = useT();
  const [rows, setRows] = useState<Awaited<ReturnType<typeof partnerCycles>>>([]);
  useFocusEffect(
    useCallback(() => {
      let alive = true;
      partnerCycles().then((r) => alive && setRows(r));
      return () => {
        alive = false;
      };
    }, []),
  );
  return (
    <>
      {rows.map((r) => {
        const s = r.summary ?? {};
        const parts: string[] = [];
        if (s.mode === 'preg') parts.push(t('Pregnant'));
        else if (s.mode === 'post') parts.push(t('After birth'));
        if (s.phase) parts.push(t('{p} phase, day {n}', { p: t(String(s.phase)), n: Number(s.day) }));
        if (s.onPeriod) parts.push(t('On her period'));
        else if (s.next) parts.push(t('Next period about {d}', { d: shortDate(String(s.next), lang) }));
        if (s.fertileFrom) parts.push(t('Fertile {a} – {b}', { a: shortDate(String(s.fertileFrom), lang), b: shortDate(String(s.fertileTo), lang) }));
        return (
          <Card key={r.user_id} style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
            <Icon name="drop" size={20} color="#E11D48" />
            <View style={{ flex: 1 }}>
              <Text weight={700}>{t('{n} shares her cycle with you', { n: r.name ?? '' })}</Text>
              <Text variant="small" color="sec" style={{ marginTop: 2 }}>
                {parts.length ? parts.join(' · ') : t('Nothing shared right now.')}
              </Text>
            </View>
          </Card>
        );
      })}
    </>
  );
}
