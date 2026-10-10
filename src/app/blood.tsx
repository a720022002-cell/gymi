import { useState } from 'react';
import { View } from 'react-native';

import { Thinking } from '@/components/food/Thinking';
import { Icon } from '@/components/Icon';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { useToast } from '@/components/Toast';
import { Button, Card, Chip, ErrorText, Row } from '@/components/ui';
import { useT } from '@/i18n';
import { type AiError, aiErrorText, askAI } from '@/lib/ai';
import { useFood } from '@/lib/food';
import { type BloodTest, type BloodValue, useHealth } from '@/lib/health';
import { takePhoto } from '@/lib/photo';
import { shortDate } from '@/lib/progress';
import { useSettings } from '@/theme/settings';

type Read = { title?: string; day?: string; values: { name: string; value: number; unit: string; low?: number | null; high?: number | null; flag?: number }[] };

/** Blood tests: photo of a lab report, the AI reads the values, flags what's outside the range (design: blood). */
export default function BloodScreen() {
  const { t, lang } = useT();
  const { colors: c } = useSettings();
  const toast = useToast();
  const food = useFood();
  const h = useHealth();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<AiError | 'none' | null>(null);
  const [pick, setPick] = useState<string | null>(null);
  const shown = h.blood.find((b) => b.id === pick) ?? h.blood[0] ?? null;

  const upload = async (camera: boolean) => {
    const p = await takePhoto(camera);
    if (!p) return;
    setBusy(true);
    setErr(null);
    const { result, error } = await askAI<Read>('blood', { lang, image: p.base64, mime: p.mime });
    if (error || !result) {
      setBusy(false);
      return setErr(error ?? 'failed');
    }
    const values: BloodValue[] = (result.values ?? [])
      .filter((v) => v && v.name && v.value != null)
      .slice(0, 60)
      .map((v) => {
        const low = typeof v.low === 'number' ? v.low : null;
        const high = typeof v.high === 'number' ? v.high : null;
        const n = Number(v.value);
        // Check the range ourselves; fall back to the report's own flag.
        const flag = (low != null && n < low ? -1 : high != null && n > high ? 1 : low != null || high != null ? 0 : Math.sign(Number(v.flag) || 0)) as -1 | 0 | 1;
        return { name: String(v.name).slice(0, 60), value: n, unit: String(v.unit ?? '').slice(0, 20), low, high, flag };
      });
    if (!values.length) {
      setBusy(false);
      return setErr('none');
    }
    const day = /^\d{4}-\d{2}-\d{2}$/.test(result.day ?? '') && (result.day as string) <= food.today ? (result.day as string) : food.today;
    const saved = await h.addBlood({ day, title: (result.title || t('Lab report')).slice(0, 120), values });
    setBusy(false);
    if (!saved) return toast(t('Couldn’t save. Please try again.'), { icon: 'warn' });
    setPick(saved.id);
    toast(t('Report read. {n} values saved.', { n: values.length }), { ai: true });
  };

  return (
    <Screen title={t('Blood tests')} back>
      {busy ? (
        <Card>
          <Thinking message={t('Reading your report')} />
        </Card>
      ) : !shown ? (
        <Card style={{ alignItems: 'center', paddingVertical: 26 }}>
          <Icon name="upload" size={36} color={c.cobalt} />
          <Text variant="h2" style={{ marginTop: 12 }}>
            {t('Add a lab report')}
          </Text>
          <Text color="sec" center style={{ marginTop: 4 }}>
            {t('Take a clear photo of your results. I’ll pull out the values into a clean list you can track over time.')}
          </Text>
          <Button icon="camera" title={t('Take a photo')} style={{ marginTop: 16, alignSelf: 'stretch' }} onPress={() => upload(true)} />
          <Button kind="glass" icon="image" title={t('Choose a photo')} style={{ marginTop: 8, alignSelf: 'stretch' }} onPress={() => upload(false)} />
          <Text variant="xs" color="sec" style={{ marginTop: 12 }}>
            {t('Your results stay private.')}
          </Text>
        </Card>
      ) : (
        <Report b={shown} />
      )}
      {err ? <ErrorText>{err === 'none' ? t('I couldn’t find any test values. Try a clearer photo of the results page.') : t(aiErrorText(err))}</ErrorText> : null}
      {shown && !busy ? (
        <>
          {h.blood.length > 1 ? (
            <Row gap={6} style={{ flexWrap: 'wrap', marginTop: 4 }}>
              {h.blood.map((b) => (
                <Chip key={b.id} title={shortDate(b.day, lang)} on={b.id === shown.id} onPress={() => setPick(b.id)} />
              ))}
            </Row>
          ) : null}
          <Button kind="glass" icon="upload" title={t('Add another report')} style={{ marginTop: 12 }} onPress={() => upload(true)} />
          <Button
            kind="ghost"
            icon="trash"
            title={t('Delete this report')}
            style={{ marginTop: 4 }}
            onPress={() => {
              h.deleteBlood(shown.id);
              setPick(null);
              toast(t('Report deleted'), { icon: 'trash' });
            }}
          />
        </>
      ) : null}
    </Screen>
  );
}

function Report({ b }: { b: BloodTest }) {
  const { t, lang } = useT();
  const { colors: c } = useSettings();
  const bad = b.values.filter((v) => v.flag !== 0);
  const range = (v: BloodValue) => (v.low != null && v.high != null ? `${v.low}–${v.high}` : v.low != null ? `> ${v.low}` : v.high != null ? `< ${v.high}` : null);
  return (
    <View>
      <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View style={{ width: 36, height: 36, borderRadius: 11, backgroundColor: c.inset, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="doc" size={20} color={c.cobalt} />
        </View>
        <View style={{ flex: 1 }}>
          <Text weight={700} numberOfLines={1}>
            {b.title}
          </Text>
          <Text variant="small" color="sec">
            {t('{d}. {n} values found', { d: shortDate(b.day, lang), n: b.values.length })}
          </Text>
        </View>
      </Card>
      {bad.length ? (
        <Card style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
          <Icon name="info" size={20} color={c.sec} />
          <Text variant="small" style={{ flex: 1 }}>
            {t('{n} values are outside the normal range. Please check with your doctor.', { n: bad.length })}
          </Text>
        </Card>
      ) : null}
      <View style={{ backgroundColor: c.card, borderRadius: 22, overflow: 'hidden', marginBottom: 12 }}>
        {b.values.map((v, i) => (
          <View key={`${v.name}${i}`} style={{ paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: i ? 1 : 0, borderTopColor: c.line }}>
            <Row style={{ alignItems: 'flex-start' }}>
              <View style={{ flex: 1 }}>
                <Text weight={700}>{v.name}</Text>
                {range(v) ? (
                  <Text variant="xs" color="sec">
                    {t('Normal: {r} {u}', { r: range(v) as string, u: v.unit })}
                  </Text>
                ) : null}
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text num>
                  {String(v.value)}{' '}
                  <Text variant="small" color="sec">
                    {v.unit}
                  </Text>
                </Text>
                <Text variant="xs" weight={700} color={v.flag ? 'down' : range(v) ? 'up' : 'sec'}>
                  {t(v.flag < 0 ? 'Low' : v.flag > 0 ? 'High' : range(v) ? 'Normal' : 'No range')}
                </Text>
              </View>
            </Row>
            {v.flag ? (
              <View style={{ backgroundColor: c.inset, borderRadius: 12, padding: 10, marginTop: 8 }}>
                <Text variant="small">{t('This value is outside the normal range. Please check with your doctor.')}</Text>
              </View>
            ) : null}
          </View>
        ))}
      </View>
      <Text variant="xs" color="sec">
        {t('Gymi reads values only. It never suggests treatment or doses. Check the numbers against your report.')}
      </Text>
    </View>
  );
}
