import { useState } from 'react';
import { ScrollView, TextInput, View } from 'react-native';

import { LineChart } from '@/components/Charts';
import { Screen } from '@/components/Screen';
import { Sheet } from '@/components/Sheet';
import { Text } from '@/components/Text';
import { useToast } from '@/components/Toast';
import { Button, Card, Chip, Row, Springy } from '@/components/ui';
import { useT } from '@/i18n';
import { MEAS, MEAS_INFO, type Measure, useHealth } from '@/lib/health';
import { fx, shortDate } from '@/lib/progress';
import { useSettings } from '@/theme/settings';

type Kind = (typeof MEAS)[number];

/** Every tape measurement: compare two dates, see each one's history, and fix or delete an entry. */
export default function Measurements() {
  const { t, lang } = useT();
  const { colors: c } = useSettings();
  const toast = useToast();
  const health = useHealth();
  const tape = health.measures.filter((m) => m.kind !== 'weight') as (Measure & { kind: Kind })[];
  const kinds = MEAS.filter((k) => tape.some((m) => m.kind === k));
  const days = [...new Set(tape.map((m) => m.day))].sort();
  const [a, setA] = useState<string | null>(null);
  const [b, setB] = useState<string | null>(null);
  const [edit, setEdit] = useState<{ day: string; kind: Kind; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  // Compare the first and the latest day unless you pick others.
  const from = a && days.includes(a) ? a : days[0];
  const to = b && days.includes(b) ? b : days.at(-1);
  // A measurement not taken that day: its latest one before it.
  const asOf = (k: Kind, d: string | undefined) => (d ? tape.filter((m) => m.kind === k && m.day <= d).at(-1)?.value : undefined);

  const save = async (value: number | null) => {
    if (!edit || busy) return;
    setBusy(true);
    const ok = await health.fixMeasure(edit.day, edit.kind, value);
    setBusy(false);
    if (!ok) return toast(t('Couldn’t save. Please try again.'), { icon: 'warn' });
    toast(t(value == null ? 'Deleted' : 'Saved'), { icon: 'check' });
    setEdit(null);
  };

  if (!kinds.length)
    return (
      <Screen title={t('Measurements')} back>
        <Text color="sec">{t('Track your waist, chest and arms to see changes the scale misses.')}</Text>
      </Screen>
    );

  const dayChips = (sel: string | undefined, set: (d: string) => void) => (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
      {days.map((d) => (
        <Chip key={d} title={shortDate(d, lang)} on={sel === d} onPress={() => set(d)} />
      ))}
    </ScrollView>
  );

  return (
    <Screen title={t('Measurements')} back>
      {days.length > 1 ? (
        <Card>
          <Text variant="h3">{t('Compare')}</Text>
          <Text variant="xs" weight={700} color="sec" style={{ marginTop: 10, marginBottom: 6 }}>
            {t('From')}
          </Text>
          {dayChips(from, setA)}
          <Text variant="xs" weight={700} color="sec" style={{ marginTop: 10, marginBottom: 6 }}>
            {t('To')}
          </Text>
          {dayChips(to, setB)}
          <View style={{ marginTop: 12 }}>
            {kinds.map((k) => {
              const [n, u, less] = MEAS_INFO[k];
              const x = asOf(k, from);
              const y = asOf(k, to);
              const d = x != null && y != null ? y - x : null;
              const good = d != null && d !== 0 && (less ? d < 0 : d > 0);
              return (
                <Row key={k} style={{ paddingVertical: 8, borderTopWidth: 1, borderTopColor: c.line }}>
                  <Text weight={700} style={{ flex: 1 }} numberOfLines={1}>
                    {t(n)}
                  </Text>
                  <Text num size={14} color="sec" style={{ width: 56, textAlign: 'center' }}>
                    {x != null ? fx(x) : '–'}
                  </Text>
                  <Text num size={14} style={{ width: 56, textAlign: 'center' }}>
                    {y != null ? fx(y) : '–'}
                  </Text>
                  <Text variant="small" weight={700} color={d == null || d === 0 ? 'sec' : good ? 'up' : 'down'} style={{ width: 70, textAlign: 'right' }}>
                    {d == null ? '' : d === 0 ? t('same') : `${d > 0 ? '+' : '−'}${fx(Math.abs(d))} ${u}`}
                  </Text>
                </Row>
              );
            })}
          </View>
          <Text variant="xs" color="sec" style={{ marginTop: 6 }}>
            {t('Green: the way your goal wants it. A measurement not taken that day uses the one before it.')}
          </Text>
        </Card>
      ) : null}

      {kinds.map((k) => {
        const [n, u] = MEAS_INFO[k];
        const s = tape.filter((m) => m.kind === k);
        return (
          <Card key={k}>
            <Row style={{ justifyContent: 'space-between' }}>
              <Text variant="h3">{t(n)}</Text>
              <Text variant="small" color="sec">
                {t('{n} entries', { n: s.length })}
              </Text>
            </Row>
            {s.length > 1 ? (
              <View style={{ marginTop: 8 }}>
                <LineChart values={s.map((m) => m.value)} labels={s.map((m) => shortDate(m.day, lang))} height={110} />
              </View>
            ) : null}
            {[...s].reverse().map((m, i, all) => {
              const before = all[i + 1]?.value;
              const d = before != null ? m.value - before : null;
              return (
                <Springy key={m.day} onPress={() => setEdit({ day: m.day, kind: k, text: fx(m.value) })} accessibilityRole="button" accessibilityLabel={t('Edit {x}', { x: `${t(n)} ${shortDate(m.day, lang)}` })}>
                  <Row style={{ paddingVertical: 10, borderTopWidth: i ? 1 : 0, borderTopColor: c.line, marginTop: i ? 0 : 8 }}>
                    <Text style={{ flex: 1 }}>{shortDate(m.day, lang)}</Text>
                    {d != null && d !== 0 ? (
                      <Text variant="xs" weight={700} color="sec" style={{ marginEnd: 10 }}>
                        {`${d > 0 ? '+' : '−'}${fx(Math.abs(d))}`}
                      </Text>
                    ) : null}
                    <Text num size={16}>{`${fx(m.value)} ${u}`}</Text>
                  </Row>
                </Springy>
              );
            })}
          </Card>
        );
      })}
      <Text variant="xs" color="sec" center>
        {t('Tap an entry to change or delete it.')}
      </Text>

      <Sheet open={!!edit} onClose={() => setEdit(null)}>
        {edit ? (
          <View>
            <Text variant="h2">{t(MEAS_INFO[edit.kind][0])}</Text>
            <Text variant="small" color="sec" style={{ marginTop: 2 }}>
              {shortDate(edit.day, lang)}
            </Text>
            <Row gap={8} style={{ marginTop: 14, alignItems: 'center' }}>
              <TextInput
                value={edit.text}
                autoFocus
                inputMode="decimal"
                accessibilityLabel={t(MEAS_INFO[edit.kind][0])}
                onChangeText={(v) => setEdit({ ...edit, text: v.replace(/[٠-٩]/g, (x) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(x))).replace(/[٫,]/g, '.').replace(/[^\d.]/g, '') })}
                style={{ flex: 1, height: 52, borderRadius: 14, backgroundColor: c.inset, textAlign: 'center', fontSize: 22, fontFamily: 'Sora_600SemiBold', color: c.text }}
              />
              <Text weight={700} color="sec">
                {MEAS_INFO[edit.kind][1]}
              </Text>
            </Row>
            <Button title={t(busy ? 'Saving…' : 'Save')} disabled={busy || !(parseFloat(edit.text) > 0 && parseFloat(edit.text) < 1000)} style={{ marginTop: 14 }} onPress={() => save(parseFloat(edit.text))} />
            <Button kind="ghost" icon="trash" title={t('Delete this entry')} color={c.down} style={{ marginTop: 6 }} onPress={() => save(null)} />
          </View>
        ) : null}
      </Sheet>
    </Screen>
  );
}
