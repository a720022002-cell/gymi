import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { LineChart } from '@/components/Charts';
import { Thinking } from '@/components/food/Thinking';
import { Logo } from '@/components/Logo';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { useToast } from '@/components/Toast';
import { Button, Toggle } from '@/components/ui';
import { useT } from '@/i18n';
import { useAuth } from '@/lib/auth';
import { useFood } from '@/lib/food';
import { useHealth } from '@/lib/health';
import { addDays, fmt } from '@/lib/nutrition';
import { fx, shortDate } from '@/lib/progress';
import { keepSigns } from '@/lib/rtl';
import { exInfo } from '@/lib/training';
import { escHtml, pdfIsPrint, pdfPage, type ReportStats, sharePdf, useReportData, useReportStats } from '@/lib/report';
import { useWeight } from '@/lib/units';
import { useSettings } from '@/theme/settings';

type Inc = { weight: boolean; food: boolean; train: boolean; sleep: boolean; health: boolean };

/** A clean summary as a PDF for a doctor or coach: share sheet on phones, print window on the web (design: export). */
export default function ExportScreen() {
  const { t, lang } = useT();
  const W = useWeight();
  const { colors: c } = useSettings();
  const toast = useToast();
  const { profile } = useAuth();
  const food = useFood();
  const health = useHealth();
  const p = useLocalSearchParams<{ from?: string; to?: string }>();
  const a = p.from ?? addDays(food.today, -29);
  const b = p.to ?? food.today;
  const data = useReportData(a, b);
  const s = useReportStats(a, b, data);
  const [inc, setInc] = useState<Inc>({ weight: true, food: true, train: true, sleep: true, health: false });
  const [making, setMaking] = useState(false);
  const label = `${shortDate(a, lang)} – ${shortDate(b, lang)}, ${b.slice(0, 4)}`;
  const name = profile?.name || profile?.username || '';

  // Before → after, pointing the way the text reads.
  const arrow = lang === 'ar' ? '←' : '→';
  const rows = (x: ReportStats) => {
    const out: [string, string][] = [];
    if (inc.weight && x.weight) out.push([t('Weight'), keepSigns(`${W.show(x.weight.first)} ${arrow} ${W.text(x.weight.last)} (${x.weight.change > 0 ? '+' : ''}${W.show(x.weight.change)})`)]);
    if (inc.weight && x.waistChange != null) out.push([t('Waist change'), keepSigns(`${x.waistChange > 0 ? '+' : ''}${fx(x.waistChange)} ${t('cm')}`)]);
    if (inc.food) {
      if (x.caloriesAvg != null) out.push([t('Average calories'), `${t('{n} kcal', { n: fmt(x.caloriesAvg) })}${x.calorieGoal ? ` (${t('goal')} ${fmt(x.calorieGoal)})` : ''}`]);
      if (x.proteinDays[1]) out.push([t('Protein goal met'), `${Math.round((x.proteinDays[0] / x.proteinDays[1]) * 100)}%`]);
    }
    if (inc.train) {
      out.push([t('Workouts'), x.workouts.planned ? t('{a} of {b}', { a: x.workouts.asPlanned, b: x.workouts.planned }) : String(x.workouts.done)]);
      x.liftUps.forEach((l) => out.push([exInfo({ id: l.id, n: l.name }, lang).name, `${W.show(l.from)} ${arrow} ${W.show(l.to)} ${W.label}`]));
    }
    if (inc.sleep && x.sleepAvg != null) out.push([t('Average sleep'), `${fx(x.sleepAvg)} ${t('h')}`]);
    if (inc.health) {
      health.supplements.filter((v) => v.active).forEach((v) => out.push([v.name, `${v.dose} ${v.unit}, ${t(v.freq).toLowerCase()}`]));
      const bt = health.blood[0];
      bt?.values.filter((v) => v.flag !== 0).forEach((v) => out.push([v.name, `${v.value} ${v.unit} (${t(v.flag < 0 ? 'Low' : 'High')})`]));
    }
    return out;
  };

  const makePdf = async () => {
    if (!s) return;
    setMaking(true);
    const w = s.weight?.series ?? [];
    let svg = '';
    if (inc.weight && w.length > 1) {
      const lo = Math.min(...w) - 0.5;
      const hi = Math.max(...w) + 0.5;
      const pts = w.map((v, i) => `${(i / (w.length - 1)) * 500},${80 - ((v - lo) / (hi - lo)) * 76}`).join(' ');
      svg = `<div class="lbl">${escHtml(W.words(t('Weight (kg)')))}</div><svg viewBox="0 0 500 84" width="100%" height="84"><polyline points="${pts}" fill="none" stroke="#3355FF" stroke-width="2.5" stroke-linejoin="round"/></svg>`;
    }
    const html = pdfPage({
      lang,
      title: t('{n}, progress report', { n: name }),
      sub: t('{n} days', { n: s.days }),
      range: label,
      body: `${svg}<table>${rows(s)
        .map(([k, v]) => `<tr><td>${escHtml(k)}</td><td>${escHtml(v)}</td></tr>`)
        .join('')}</table>`,
      note: t('Made with Adro. Values are logged by the user. Not medical advice.'),
    });
    const r = await sharePdf(html, `Adro report ${a} to ${b}.pdf`);
    setMaking(false);
    if (r === 'failed') return toast(t('Couldn’t make the PDF. Please try again.'), { icon: 'warn' });
    if (pdfIsPrint) toast(t('Choose “Save as PDF” to keep it or share it.'), { icon: 'doc' });
  };

  const items: [keyof Inc, string][] = [
    ['weight', 'Weight and body'],
    ['food', 'Food and protein'],
    ['train', 'Training'],
    ['sleep', 'Sleep'],
    ['health', 'Vitamins and blood tests'],
  ];

  return (
    <Screen title={t('Export report')} back>
      <Text color="sec" style={{ marginTop: -8 }}>
        {t('A clean summary to show your doctor or coach.')}
      </Text>
      <View style={{ backgroundColor: '#FFFFFF', borderRadius: 18, padding: 16, marginTop: 16, borderWidth: 1, borderColor: c.line }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Logo height={14} color="#0A0A0B" ring="#3355FF" />
          <Text size={11} color="#52525B">
            {label}
          </Text>
        </View>
        <Text weight={700} size={17} color="#0A0A0B" style={{ marginTop: 10 }}>
          {t('{n}, progress report', { n: name })}
        </Text>
        {!s ? (
          <Thinking message={t('Loading your report')} />
        ) : (
          <>
            {inc.weight && s.weight && s.weight.series.length > 1 ? (
              <View style={{ marginTop: 8 }}>
                <LineChart values={s.weight.series} height={70} dots={false} color="#3355FF" />
              </View>
            ) : null}
            {rows(s).map(([k, v]) => (
              <View key={k} style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6, gap: 8 }}>
                <Text size={12} color="#52525B" style={{ flexShrink: 1 }}>
                  {k}
                </Text>
                <Text size={12} weight={700} color="#0A0A0B">
                  {v}
                </Text>
              </View>
            ))}
          </>
        )}
      </View>
      <Text variant="small" weight={700} color="sec" style={{ marginTop: 20, marginBottom: 8, marginHorizontal: 4 }}>
        {t('Include')}
      </Text>
      <View style={{ backgroundColor: c.card, borderRadius: 22, overflow: 'hidden' }}>
        {items.map(([k, n], i) => (
          <View key={k} style={{ flexDirection: 'row', alignItems: 'center', minHeight: 54, paddingHorizontal: 16, borderTopWidth: i ? 1 : 0, borderTopColor: c.line }}>
            <Text weight={700} style={{ flex: 1 }}>
              {t(n)}
            </Text>
            <Toggle value={inc[k]} onChange={(v) => setInc((x) => ({ ...x, [k]: v }))} label={t(n)} />
          </View>
        ))}
      </View>
      <Button icon="doc" title={t('Create PDF')} loading={making} disabled={!s} style={{ marginTop: 16 }} onPress={makePdf} />
    </Screen>
  );
}
