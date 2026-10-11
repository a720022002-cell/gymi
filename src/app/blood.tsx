import { useState } from 'react';
import { Linking, Platform, View } from 'react-native';

import { Thinking } from '@/components/food/Thinking';
import { ConfirmSheet } from '@/components/health/Confirm';
import { Icon } from '@/components/Icon';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { useToast } from '@/components/Toast';
import { Button, Card, Chip, ErrorText, Row } from '@/components/ui';
import { useT } from '@/i18n';
import { type AiError, aiErrorText, askAI } from '@/lib/ai';
import { useFood } from '@/lib/food';
import { pickReportFile } from '@/lib/docpick';
import { type BloodTest, type BloodValue, type HealthFile, useHealth } from '@/lib/health';
import { type Photo, takePhoto } from '@/lib/photo';
import { shortDate } from '@/lib/progress';
import { useSettings } from '@/theme/settings';

type Read = { title?: string; day?: string; values: { name: string; value: number; unit: string; low?: number | null; high?: number | null; flag?: number }[] };

/** Blood tests: a PDF or photo of a lab report; the AI reads the values and flags what's outside the range. The file is kept to open later (design: blood). */
export default function BloodScreen() {
  const { t, lang } = useT();
  const { colors: c } = useSettings();
  const toast = useToast();
  const food = useFood();
  const h = useHealth();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<AiError | 'none' | null>(null);
  const [pick, setPick] = useState<string | null>(null);
  const [fileName, setFileName] = useState('');
  const [asking, setAsking] = useState(false);
  const shown = h.blood.find((b) => b.id === pick) ?? h.blood[0] ?? null;

  /** Read a report from a photo (camera or library) or a file (PDF or image). */
  const read = async (src: { photo: Photo } | { file: HealthFile & { size: number } }) => {
    setErr(null);
    const isPdf = 'file' in src && src.file.mime === 'application/pdf';
    const b64 = 'photo' in src ? src.photo.base64 : src.file.base64;
    if (b64.length > (isPdf ? 8_000_000 : 6_000_000)) return setErr('too_big');
    const keep: HealthFile = 'photo' in src ? { base64: src.photo.base64, mime: src.photo.mime, name: t('Lab report photo') } : src.file;
    setFileName(keep.name);
    setBusy(true);
    const { result, error } = await askAI<Read>('blood', isPdf ? { lang, file: b64, name: keep.name } : { lang, image: b64, mime: 'photo' in src ? src.photo.mime : src.file.mime });
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
    // A file is still kept when no values could be read, so you can open it later.
    if (!values.length && 'photo' in src) {
      setBusy(false);
      return setErr('none');
    }
    const day = /^\d{4}-\d{2}-\d{2}$/.test(result.day ?? '') && (result.day as string) <= food.today ? (result.day as string) : food.today;
    const saved = await h.addBlood({ day, title: (result.title || keep.name.replace(/\.[a-z0-9]+$/i, '') || t('Lab report')).slice(0, 120), values }, keep);
    setBusy(false);
    if (!saved) return toast(t('Couldn’t save. Please try again.'), { icon: 'warn' });
    setPick(saved.id);
    toast(values.length ? t('Report read. {n} values saved.', { n: values.length }) : t('File saved. I couldn’t read values from it.'), { ai: true });
  };

  const upload = async (camera: boolean) => {
    const p = await takePhoto(camera);
    if (p) read({ photo: p });
  };

  const chooseFile = async () => {
    const f = await pickReportFile().catch(() => null);
    if (f === 'too_big') return setErr('too_big');
    if (f) read({ file: f });
  };

  return (
    <Screen title={t('Blood tests')} back>
      {busy ? (
        <Card>
          <Thinking message={t('Reading your report')} />
          {fileName ? (
            <Text variant="small" color="sec" center>
              {fileName}
            </Text>
          ) : null}
        </Card>
      ) : !shown ? (
        <Card style={{ alignItems: 'center', paddingVertical: 26 }}>
          <Icon name="upload" size={36} color={c.cobalt} />
          <Text variant="h2" style={{ marginTop: 12 }}>
            {t('Upload a lab report')}
          </Text>
          <Text color="sec" center style={{ marginTop: 4 }}>
            {t('PDF or photo. I’ll pull out the values into a clean list you can track over time.')}
          </Text>
          <Button icon="doc" title={t('Choose file')} style={{ marginTop: 16, alignSelf: 'stretch' }} onPress={chooseFile} />
          {Platform.OS !== 'web' ? <Button kind="glass" icon="camera" title={t('Take a photo')} style={{ marginTop: 8, alignSelf: 'stretch' }} onPress={() => upload(true)} /> : null}
          <Button kind="glass" icon="image" title={t('Choose a photo')} style={{ marginTop: 8, alignSelf: 'stretch' }} onPress={() => upload(false)} />
          <Text variant="xs" color="sec" style={{ marginTop: 12 }}>
            {t('Your results stay private.')}
          </Text>
        </Card>
      ) : (
        <Report b={shown} />
      )}
      {err ? (
        <ErrorText>
          {err === 'none' ? t('I couldn’t find any test values. Try a clearer photo of the results page.') : err === 'too_big' ? t('That file is too big. Use a file under 10 MB, or take a photo of the page.') : t(aiErrorText(err))}
        </ErrorText>
      ) : null}
      {shown && !busy ? (
        <>
          {h.blood.length > 1 ? (
            <Row gap={6} style={{ flexWrap: 'wrap', marginTop: 4 }}>
              {h.blood.map((b) => (
                <Chip key={b.id} title={shortDate(b.day, lang)} on={b.id === shown.id} onPress={() => setPick(b.id)} />
              ))}
            </Row>
          ) : null}
          <Button kind="glass" icon="upload" title={t('Upload another report')} style={{ marginTop: 12 }} onPress={chooseFile} />
          {Platform.OS !== 'web' ? <Button kind="glass" icon="camera" title={t('Take a photo')} style={{ marginTop: 8 }} onPress={() => upload(true)} /> : null}
          <Button kind="ghost" icon="trash" title={t('Delete this report')} style={{ marginTop: 4 }} onPress={() => setAsking(true)} />
          <ConfirmSheet
            open={asking}
            title={t('Delete this report?')}
            body={t('Its values and the file will be removed. This can’t be undone.')}
            action={t('Delete')}
            onClose={() => setAsking(false)}
            onConfirm={() => {
              setAsking(false);
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
  const h = useHealth();
  const toast = useToast();
  const openFile = async () => {
    const url = b.file_path ? await h.bloodFileUrl(b.file_path) : null;
    if (!url) return toast(t('Couldn’t open the file. Please try again.'), { icon: 'warn' });
    if (Platform.OS === 'web') globalThis.open?.(url, '_blank');
    else Linking.openURL(url).catch(() => toast(t('Couldn’t open the file. Please try again.'), { icon: 'warn' }));
  };
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
        {b.file_path ? <Button small kind="glass" title={t('Open')} onPress={openFile} /> : null}
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
