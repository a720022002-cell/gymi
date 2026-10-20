import { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';

import { Thinking } from '@/components/food/Thinking';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { useToast } from '@/components/Toast';
import { Button, Card, Chip, Row } from '@/components/ui';
import { useT } from '@/i18n';
import { useIsAdmin } from '@/lib/admin';
import { shortDate } from '@/lib/progress';
import { type AdminReport, adminReports, closeReport, REPORT_REASONS } from '@/lib/social';
import { useSettings } from '@/theme/settings';

/** Reports people sent about other people, coach pages, groups or challenges. The team reads them and closes them. */
export default function AdminReports() {
  const { t, lang } = useT();
  const { colors: c } = useSettings();
  const toast = useToast();
  const admin = useIsAdmin();
  const [list, setList] = useState<AdminReport[] | null | undefined>(undefined);
  const [show, setShow] = useState<'open' | 'done'>('open');

  const load = useCallback(() => {
    adminReports().then(setList);
  }, []);
  useEffect(() => {
    if (admin) load();
  }, [admin, load]);

  if (!admin)
    return (
      <Screen title={t('User reports')} back>
        <Text color="sec">{t('Only the Adro team can open this page.')}</Text>
      </Screen>
    );
  if (list === undefined)
    return (
      <Screen title={t('User reports')} back>
        <Thinking message={t('Loading')} />
      </Screen>
    );
  const shown = (list ?? []).filter((r) => r.status === show);
  const reasonText = (r: AdminReport['reason']) => t(REPORT_REASONS.find(([k]) => k === r)?.[1] ?? r);
  return (
    <Screen title={t('User reports')} back>
      <Text color="sec" style={{ marginTop: -8 }}>
        {t('What people reported. Check the person, then close the report. Many reports about one person is a sign to act.')}
      </Text>
      <Row gap={8} style={{ marginTop: 12, marginBottom: 12 }}>
        <Chip title={`${t('Not handled')} (${(list ?? []).filter((r) => r.status === 'open').length})`} on={show === 'open'} onPress={() => setShow('open')} />
        <Chip title={`${t('Handled')} (${(list ?? []).filter((r) => r.status === 'done').length})`} on={show === 'done'} onPress={() => setShow('done')} />
      </Row>
      {list === null ? (
        <Card>
          <Text color="sec">{t('Couldn’t load. Please try again.')}</Text>
        </Card>
      ) : !shown.length ? (
        <Card style={{ alignItems: 'center', paddingVertical: 24 }}>
          <Text color="sec">{t(show === 'open' ? 'No open reports.' : 'No closed reports.')}</Text>
        </Card>
      ) : (
        shown.map((r) => (
          <Card key={r.id}>
            <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <View style={{ flex: 1 }}>
                <Text weight={700}>{r.reported_name || (r.reported ? `@${r.reported}` : t('A deleted account'))}</Text>
                <Text variant="small" color="sec">{[r.reported ? `@${r.reported}` : null, t(r.kind === 'coach' ? 'Coach page' : r.kind === 'group' ? 'Group' : r.kind === 'challenge' ? 'Challenge' : 'Person')].filter(Boolean).join(' · ')}</Text>
              </View>
              <Text variant="xs" color="sec">
                {shortDate(r.created_at.slice(0, 10), lang)}
              </Text>
            </Row>
            <Text weight={700} color={c.down} style={{ marginTop: 8 }}>
              {reasonText(r.reason)}
            </Text>
            {r.note ? <Text variant="small" style={{ marginTop: 4 }}>{r.note}</Text> : null}
            <Text variant="xs" color="sec" style={{ marginTop: 6 }}>
              {t('From @{u} · {n} reports about this person in all', { u: r.reporter ?? '?', n: r.reports_on_them })}
            </Text>
            <Button
              small
              kind="soft"
              title={t(r.status === 'open' ? 'Close report' : 'Open again')}
              style={{ marginTop: 10, alignSelf: 'flex-start' }}
              onPress={async () => {
                if (!(await closeReport(r.id, r.status !== 'open'))) return toast(t('Couldn’t save. Please try again.'), { icon: 'warn' });
                load();
              }}
            />
          </Card>
        ))
      )}
    </Screen>
  );
}
