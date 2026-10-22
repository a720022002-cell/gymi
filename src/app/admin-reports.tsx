import { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';

import { ModerateSheet } from '@/components/admin/ModerateSheet';
import { Thinking } from '@/components/food/Thinking';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { useToast } from '@/components/Toast';
import { Button, Card, Chip, Row } from '@/components/ui';
import { useT } from '@/i18n';
import { type ModReport, modReports, type ReportStatus, setReportStatus, useIsAdmin } from '@/lib/admin';
import { localDay } from '@/lib/nutrition';
import { shortDate } from '@/lib/progress';
import { REPORT_REASONS } from '@/lib/social';
import { useSettings } from '@/theme/settings';

/** Reports people sent about other people, coach pages, groups or challenges. The team acts on them (suspend, hide, reset) and closes them. */
export default function AdminReports() {
  const { t, lang } = useT();
  const { colors: c } = useSettings();
  const toast = useToast();
  const admin = useIsAdmin();
  const [list, setList] = useState<ModReport[] | null | undefined>(undefined);
  const [show, setShow] = useState<'open' | 'done'>('open');
  const [mod, setMod] = useState<{ id: string; suspend: boolean } | null>(null);

  const load = useCallback(() => {
    modReports().then(setList);
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
  const isOpen = (r: ModReport) => r.status === 'open';
  const status = async (id: string, st: ReportStatus) => {
    if (!(await setReportStatus(id, st))) return toast(t('Couldn’t save. Please try again.'), { icon: 'warn' });
    load();
  };
  const shown = (list ?? []).filter((r) => isOpen(r) === (show === 'open'));
  const reasonText = (r: ModReport['reason']) => t(REPORT_REASONS.find(([k]) => k === r)?.[1] ?? r);
  return (
    <Screen title={t('User reports')} back>
      <Text color="sec" style={{ marginTop: -8 }}>
        {t('What people reported. Check the person, act if needed, then close the report. Act within 24 hours.')}
      </Text>
      <Row gap={8} style={{ marginTop: 12, marginBottom: 12 }}>
        <Chip title={`${t('Not handled')} (${(list ?? []).filter((r) => r.status === 'open').length})`} on={show === 'open'} onPress={() => setShow('open')} />
        <Chip title={`${t('Handled')} (${(list ?? []).filter((r) => !isOpen(r)).length})`} on={show === 'done'} onPress={() => setShow('done')} />
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
                {shortDate(localDay(new Date(r.created_at)), lang)}
              </Text>
            </Row>
            <Text weight={700} color={c.down} style={{ marginTop: 8 }}>
              {reasonText(r.reason)}
            </Text>
            {r.note ? <Text variant="small" style={{ marginTop: 4 }}>{r.note}</Text> : null}
            {r.ref ? (
              <Text variant="xs" color="sec" selectable style={{ marginTop: 4 }}>
                {t('Reference: {r}', { r: r.ref })}
              </Text>
            ) : null}
            <Text variant="xs" color="sec" style={{ marginTop: 6 }}>
              {t('From @{u} · {n} reports about this person in all', { u: r.reporter ?? '?', n: r.reports_on_them })}
            </Text>
            {r.reported_suspended ? (
              <Text variant="xs" weight={700} color={c.down} style={{ marginTop: 6 }}>
                {t('Account suspended')}
              </Text>
            ) : null}
            {r.status !== 'open' ? (
              <Text variant="xs" color="sec" style={{ marginTop: 6 }}>
                {t(r.status === 'dismissed' ? 'Dismissed' : 'Resolved')}
              </Text>
            ) : null}
            <Row gap={8} style={{ marginTop: 10, flexWrap: 'wrap' }}>
              {r.reported_id && !r.reported_suspended ? (
                <Button small kind="soft" icon="lock" color={c.down} title={t('Suspend')} onPress={() => setMod({ id: r.reported_id as string, suspend: true })} />
              ) : null}
              {r.reported_id ? (
                <Button small kind="soft" icon="eyeoff" title={t('Hide content or reset')} onPress={() => setMod({ id: r.reported_id as string, suspend: false })} />
              ) : null}
              {r.status === 'open' ? (
                <>
                  <Button small kind="soft" icon="check" title={t('Resolved')} onPress={() => status(r.id, 'done')} />
                  <Button small kind="soft" title={t('Dismiss')} onPress={() => status(r.id, 'dismissed')} />
                </>
              ) : (
                <Button small kind="soft" title={t('Open again')} onPress={() => status(r.id, 'open')} />
              )}
            </Row>
          </Card>
        ))
      )}
      <ModerateSheet user={mod?.id ?? null} suspend={mod?.suspend} onClose={() => setMod(null)} onChanged={load} />
    </Screen>
  );
}
