import { useState } from 'react';
import { View } from 'react-native';

import { Icon } from '@/components/Icon';
import { PastSheet } from '@/components/period/LogSheets';
import { ROSE, type State } from '@/components/period/shared';
import { Sheet } from '@/components/Sheet';
import { List, ListRow } from '@/components/social/List';
import { Text } from '@/components/Text';
import { useToast } from '@/components/Toast';
import { Button, Card, Row } from '@/components/ui';
import { useT } from '@/i18n';
import { weekdayLetter } from '@/lib/dates';
import { averages, dayInfo, deletePeriod } from '@/lib/cycle';
import { useFood } from '@/lib/food';
import { shortDate } from '@/lib/progress';
import { useSettings } from '@/theme/settings';

export function CalendarTab({ st, reload }: { st: State; reload: () => void }) {
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
            {/* Sunday first, in reading order (right to left in Arabic). */}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 8 }}>
              {[0, 1, 2, 3, 4, 5, 6].map((j) => weekdayLetter(j, lang)).map((x, i) => (
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
