import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Platform, View } from 'react-native';

import { LineChart } from '@/components/Charts';
import { Thinking } from '@/components/food/Thinking';
import { Mark } from '@/components/Icon';
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
import { type ReportStats, useReportData, useReportStats } from '@/lib/report';
import { useSettings } from '@/theme/settings';

type Inc = { weight: boolean; food: boolean; train: boolean; sleep: boolean; health: boolean };
const esc = (s: string) => s.replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch] as string);

/** A clean summary to print or save as PDF for a doctor or coach (design: export). */
export default function ExportScreen() {
  const { t, lang } = useT();
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

  const rows = (x: ReportStats) => {
    const out: [string, string][] = [];
    if (inc.weight && x.weight) out.push([t('Weight'), `${fx(x.weight.first)} → ${fx(x.weight.last)} ${t('kg')} (${x.weight.change > 0 ? '+' : ''}${fx(x.weight.change)})`]);
    if (inc.weight && x.waistChange != null) out.push([t('Waist change'), `${x.waistChange > 0 ? '+' : ''}${fx(x.waistChange)} cm`]);
    if (inc.food) {
      if (x.caloriesAvg != null) out.push([t('Average calories'), `${fmt(x.caloriesAvg)} kcal${x.calorieGoal ? ` (${t('goal')} ${fmt(x.calorieGoal)})` : ''}`]);
      if (x.proteinDays[1]) out.push([t('Protein goal met'), `${Math.round((x.proteinDays[0] / x.proteinDays[1]) * 100)}%`]);
    }
    if (inc.train) {
      out.push([t('Workouts'), x.workouts.planned ? t('{a} of {b}', { a: x.workouts.asPlanned, b: x.workouts.planned }) : String(x.workouts.done)]);
      x.liftUps.forEach((l) => out.push([l.name, `${fx(l.from)} → ${fx(l.to)} ${t('kg')}`]));
    }
    if (inc.sleep && x.sleepAvg != null) out.push([t('Average sleep'), `${fx(x.sleepAvg)} ${t('h')}`]);
    if (inc.health) {
      health.supplements.filter((v) => v.active).forEach((v) => out.push([v.name, `${v.dose} ${v.unit}, ${t(v.freq).toLowerCase()}`]));
      const bt = health.blood[0];
      bt?.values.filter((v) => v.flag !== 0).forEach((v) => out.push([v.name, `${v.value} ${v.unit} (${t(v.flag < 0 ? 'Low' : 'High')})`]));
    }
    return out;
  };

  const makePdf = () => {
    if (!s) return;
    if (Platform.OS !== 'web' || typeof document === 'undefined') return toast(t('PDF export comes with the phone app.'), { icon: 'info' });
    setMaking(true);
    const w = s.weight?.series ?? [];
    let svg = '';
    if (inc.weight && w.length > 1) {
      const lo = Math.min(...w) - 0.5;
      const hi = Math.max(...w) + 0.5;
      const pts = w.map((v, i) => `${(i / (w.length - 1)) * 500},${80 - ((v - lo) / (hi - lo)) * 76}`).join(' ');
      svg = `<div class="lbl">${esc(t('Weight (kg)'))}</div><svg viewBox="0 0 500 84" width="100%" height="84"><polyline points="${pts}" fill="none" stroke="#3355FF" stroke-width="2.5" stroke-linejoin="round"/></svg>`;
    }
    const dir = lang === 'ar' ? 'rtl' : 'ltr';
    const html = `<!doctype html><html dir="${dir}"><head><meta charset="utf-8"><title>Gymi report</title><style>
      body{font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#0A0A0B;margin:32px}
      .top{display:flex;justify-content:space-between;align-items:center}.brand{font-weight:700;font-size:20px;color:#3355FF}
      h1{font-size:22px;margin:16px 0 4px}.sub{color:#52525B;font-size:13px}.lbl{color:#52525B;font-size:12px;margin-top:18px}
      table{width:100%;border-collapse:collapse;margin-top:16px;font-size:14px}td{padding:8px 0;border-bottom:1px solid #E4E4E7}td:last-child{text-align:end;font-weight:600}
      .note{color:#52525B;font-size:11px;margin-top:24px}</style></head><body>
      <div class="top"><span class="brand">gymi</span><span class="sub">${esc(label)}</span></div>
      <h1>${esc(t('{n}, progress report', { n: name }))}</h1><div class="sub">${esc(t('{n} days', { n: s.days }))}</div>
      ${svg}<table>${rows(s).map(([k, v]) => `<tr><td>${esc(k)}</td><td>${esc(v)}</td></tr>`).join('')}</table>
      <div class="note">${esc(t('Made with Gymi. Values are logged by the user. Not medical advice.'))}</div></body></html>`;
    const f = document.createElement('iframe');
    f.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0';
    document.body.appendChild(f);
    const d = f.contentWindow?.document;
    d?.open();
    d?.write(html);
    d?.close();
    setTimeout(() => {
      f.contentWindow?.focus();
      f.contentWindow?.print();
      setMaking(false);
      setTimeout(() => f.remove(), 2000);
      toast(t('Choose “Save as PDF” to keep it or share it.'), { icon: 'doc' });
    }, 400);
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
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Mark size={18} color="#3355FF" stroke={3.6} />
            <Text weight={700} color="#0A0A0B">
              gymi
            </Text>
          </View>
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
