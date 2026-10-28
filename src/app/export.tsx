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
import { type AiError, aiErrorText, askAI } from '@/lib/ai';
import { useAuth } from '@/lib/auth';
import { useFood } from '@/lib/food';
import { MEAS_INFO, useHealth } from '@/lib/health';
import { addDays, fmt } from '@/lib/nutrition';
import { fx, shortDate } from '@/lib/progress';
import { keepSigns } from '@/lib/rtl';
import { exInfo } from '@/lib/training';
import { type CoachSummary, escHtml, pdfIsPrint, pdfPage, type ReportStats, saveReport, sharePdf, useReportData, useReportStats } from '@/lib/report';
import { useWeight } from '@/lib/units';
import { useSettings } from '@/theme/settings';

type Inc = { weight: boolean; food: boolean; train: boolean; sleep: boolean; health: boolean; ai: boolean };
type Table = { title?: string; head: string[]; rows: string[][] };
type Section = { title: string; rows: [string, string][]; chart?: number[]; tables?: Table[] };

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
  const [inc, setInc] = useState<Inc>({ weight: true, food: true, train: true, sleep: true, health: false, ai: false });
  const [making, setMaking] = useState(false);
  const [ai, setAi] = useState<{ key: string; v: CoachSummary } | null>(null);
  const [aiBusy, setAiBusy] = useState(false);
  const label = `${shortDate(a, lang)} – ${shortDate(b, lang)}, ${b.slice(0, 4)}`;
  const name = profile?.name || profile?.username || '';

  // Before → after, pointing the way the text reads.
  const arrow = lang === 'ar' ? '←' : '→';
  const sign = (v: number) => (v > 0 ? '+' : v < 0 ? '−' : '');
  const pct = ([hit, of]: [number, number]) => (of ? `${Math.round((hit / of) * 100)}% (${t('{a} of {b} days', { a: hit, b: of })})` : '–');
  const day = (d: string) => shortDate(d, lang);
  const sections = (x: ReportStats): Section[] => {
    const out: Section[] = [];
    const d = x.detail;
    out.push({
      title: t('Summary'),
      rows: [
        [t('Commitment'), x.commitment != null ? `${x.commitment}%` : '–'],
        [t('Goal'), t(x.goal.replace(/^./, (ch) => ch.toUpperCase()))],
        [t('Days logged'), t('{a} of {b} days', { a: d.food.daysLogged, b: x.days })],
      ],
    });
    if (inc.weight && (x.weight || d.body.tape.length)) {
      const rows: [string, string][] = [];
      if (x.weight) {
        rows.push([t('Weight'), keepSigns(`${W.show(x.weight.first)} ${arrow} ${W.text(x.weight.last)} (${sign(x.weight.change)}${W.show(Math.abs(x.weight.change))})`)]);
        if (d.body.min != null && d.body.max != null && d.body.entries > 1) rows.push([t('Lowest and highest'), `${W.show(d.body.min)} – ${W.text(d.body.max)}`]);
        if (d.body.perWeek != null) rows.push([t('Change per week'), keepSigns(`${sign(d.body.perWeek)}${W.text(Math.abs(d.body.perWeek))}`)]);
        rows.push([t('Weigh-ins'), String(d.body.entries)]);
      }
      d.body.tape.forEach((m) => {
        const info = MEAS_INFO[m.kind as keyof typeof MEAS_INFO];
        if (!info) return;
        rows.push([t(info[0]), keepSigns(m.entries > 1 ? `${fx(m.first)} ${arrow} ${fx(m.last)} ${info[1]} (${sign(m.change)}${fx(Math.abs(m.change))})` : `${fx(m.last)} ${info[1]}`)]);
      });
      out.push({ title: t('Weight and body'), rows, chart: inc.weight && x.weight && x.weight.series.length > 1 ? x.weight.series : undefined });
    }
    if (inc.food) {
      const rows: [string, string][] = [];
      if (x.caloriesAvg != null) rows.push([t('Average calories'), `${t('{n} kcal', { n: fmt(x.caloriesAvg) })}${x.calorieGoal ? ` (${t('goal')} ${fmt(x.calorieGoal)})` : ''}`]);
      if (d.food.lowest != null && d.food.highest != null) rows.push([t('Lowest and highest day'), `${fmt(d.food.lowest)} – ${t('{n} kcal', { n: fmt(d.food.highest) })}`]);
      if (x.calDays[1]) rows.push([t('Calories on target'), pct(x.calDays)]);
      if (d.food.proteinAvg != null) rows.push([t('Average protein'), `${d.food.proteinAvg} ${t('g')}${x.proteinGoal ? ` (${t('goal')} ${x.proteinGoal})` : ''}`]);
      if (x.proteinDays[1]) rows.push([t('Protein goal met'), pct(x.proteinDays)]);
      if (d.food.waterAvg != null) rows.push([t('Average water'), `${fx(d.food.waterAvg / 1000)} ${t('L')} (${t('goal')} ${fx(d.food.waterGoal / 1000)})`]);
      if (x.waterDays[1]) rows.push([t('Water goal met'), pct(x.waterDays)]);
      if (rows.length) out.push({ title: t('Food and protein'), rows });
    }
    if (inc.train) {
      const rows: [string, string][] = [[t('Workouts'), x.workouts.planned ? t('{a} of {b}', { a: x.workouts.asPlanned, b: x.workouts.planned }) : String(x.workouts.done)]];
      if (x.workouts.done) {
        rows.push([t('Training time'), `${fmt(d.train.minutes)} ${t('min')}`]);
        rows.push([t('Sets done'), fmt(d.train.sets)]);
        rows.push([t('Total volume'), `${fmt(Math.round(W.num(x.volume)))} ${W.label}`]);
        rows.push([t('New personal records'), String(x.prs)]);
      }
      if (d.train.cardio.sessions) rows.push([t('Cardio'), `${t('{n} sessions', { n: d.train.cardio.sessions })}, ${d.train.cardio.minutes} ${t('min')}, ${t('{n} kcal', { n: fmt(d.train.cardio.kcal) })}`]);
      out.push({
        title: t('Training'),
        rows,
        tables: [
          d.train.list.length
            ? ({ title: t('Workouts'), head: [t('Date'), t('Workout'), t('min'), t('Sets'), `${t('Volume')} (${W.label})`], rows: d.train.list.map((l) => [day(l.day), l.name + (l.prs ? ` ★${l.prs}` : ''), String(l.minutes), String(l.sets), fmt(Math.round(W.num(l.volume)))]) } as Table)
            : null,
          d.train.ups.length
            ? ({ title: t('Lifts that went up'), head: [t('Exercise'), `${t('Top set')} (${W.label})`], rows: d.train.ups.slice(0, 12).map((l) => [exInfo({ id: l.id, n: l.name }, lang).name, keepSigns(`${W.show(l.from)} ${arrow} ${W.show(l.to)}`)]) } as Table)
            : null,
        ].filter((v): v is Table => !!v),
      });
    }
    if (inc.sleep && x.sleepAvg != null) {
      const [tired, normal, great] = d.sleep.energy;
      const [none, little, very] = d.sleep.sore;
      const rows: [string, string][] = [
        [t('Average sleep'), `${fx(x.sleepAvg)} ${t('h')}`],
        [t('Shortest and longest night'), `${fx(d.sleep.min!)} – ${fx(d.sleep.max!)} ${t('h')}`],
        [t('Nights under 6.5 h'), t('{a} of {b}', { a: x.shortNights, b: x.sleepNights })],
      ];
      if (tired + normal + great) rows.push([t('Energy'), `${t('Great')} ${great} · ${t('Normal')} ${normal} · ${t('Tired')} ${tired}`]);
      if (none + little + very) rows.push([t('Muscle soreness'), `${t('None')} ${none} · ${t('A little')} ${little} · ${t('Very sore')} ${very}`]);
      if (d.sleep.recoveryAvg != null) rows.push([t('Average recovery'), `${d.sleep.recoveryAvg}%`]);
      out.push({ title: t('Sleep and recovery'), rows });
    }
    if (d.weeks.length > 1)
      out.push({
        title: t('Week by week'),
        rows: [],
        tables: [
          {
            head: [t('Week'), t('kcal'), t('Protein'), t('Workouts'), t('Sleep'), t('Weight')],
            rows: d.weeks.map((v) => [`${day(v.from)} – ${day(v.to)}`, v.kcal != null ? fmt(v.kcal) : '–', v.protein != null ? `${v.protein} ${t('g')}` : '–', String(v.workouts), v.sleep != null ? `${fx(v.sleep)} ${t('h')}` : '–', v.weight != null ? W.show(v.weight) : '–']),
          },
        ],
      });
    if (inc.health) {
      const rows: [string, string][] = [];
      health.supplements.filter((v) => v.active).forEach((v) => rows.push([v.name, `${v.dose} ${v.unit}, ${t(v.freq).toLowerCase()}`]));
      const bt = health.blood[0];
      bt?.values.filter((v) => v.flag !== 0).forEach((v) => rows.push([v.name, `${v.value} ${v.unit} (${t(v.flag < 0 ? 'Low' : 'High')})`]));
      if (rows.length) out.push({ title: t('Vitamins and blood tests'), rows });
    }
    return out;
  };

  // The AI reads the whole report (in the units you use), once per period and language.
  const analyse = async (x: ReportStats) => {
    const d = x.detail;
    const pair = ([hit, of]: [number, number]) => (of ? { daysHit: hit, outOf: of } : null);
    const stats = {
      period: `${a} to ${b} (${x.days} days)`,
      goal: x.goal,
      commitmentPercent: x.commitment,
      daysWithFoodLogged: d.food.daysLogged,
      weight: x.weight ? { unit: W.unit, start: W.num(x.weight.first), end: W.num(x.weight.last), lowest: W.num(d.body.min!), highest: W.num(d.body.max!), changePerWeek: d.body.perWeek != null ? W.num(d.body.perWeek) : null } : null,
      measurementsCm: d.body.tape.map((m) => ({ name: MEAS_INFO[m.kind as keyof typeof MEAS_INFO]?.[0] ?? m.kind, start: m.first, end: m.last })),
      food: { averageCalories: x.caloriesAvg, calorieGoal: x.calorieGoal, caloriesWithin10Percent: pair(x.calDays), averageProteinGrams: d.food.proteinAvg, proteinGoalGrams: x.proteinGoal, proteinGoalHit: pair(x.proteinDays), averageWaterMl: d.food.waterAvg, waterGoalMl: d.food.waterGoal, waterGoalHit: pair(x.waterDays) },
      training: { ...(x.workouts.planned ? { doneAsPlanned: x.workouts.asPlanned, planned: x.workouts.planned } : { done: x.workouts.done }), minutes: d.train.minutes, sets: d.train.sets, newPersonalRecords: x.prs, cardio: d.train.cardio, liftsThatWentUp: d.train.ups.slice(0, 6).map((l) => ({ name: l.name, from: W.num(l.from), to: W.num(l.to), unit: W.unit })) },
      sleep: { averageHours: x.sleepAvg, shortest: d.sleep.min, longest: d.sleep.max, nightsUnder6_5h: x.shortNights, nights: x.sleepNights, energyTiredNormalGreat: d.sleep.energy, sorenessNoneLittleVery: d.sleep.sore, averageRecoveryPercent: d.sleep.recoveryAvg },
      weeks: d.weeks.map((v) => ({ from: v.from, kcal: v.kcal, protein: v.protein, workouts: v.workouts, sleep: v.sleep, weight: v.weight != null ? W.num(v.weight) : null })),
    };
    // The AI reads up to 4000 characters: drop the oldest weeks first.
    while (JSON.stringify(stats).length > 3900 && stats.weeks.length > 2) stats.weeks.shift();
    const { result, error } = await askAI<CoachSummary>('report', { lang, stats });
    if (error || !result) return { error: error ?? ('failed' as AiError) };
    const v = { well: (result.well ?? []).slice(0, 3), improve: (result.improve ?? []).slice(0, 3), focus: result.focus ?? '' };
    // A period that's over is kept, so the Reports page shows it too.
    if (b < food.today && profile?.id) saveReport(profile.id, a, b, lang, v).catch(() => {});
    return { v };
  };

  const aiKey = `${a}|${b}|${lang}`;
  const aiNow = ai?.key === aiKey ? ai.v : null;
  const turnAi = async (on: boolean) => {
    setInc((x) => ({ ...x, ai: on }));
    if (!on || aiNow || !s) return;
    setAiBusy(true);
    const r = await analyse(s);
    setAiBusy(false);
    if (r.v) return setAi({ key: aiKey, v: r.v });
    setInc((x) => ({ ...x, ai: false }));
    toast(t(aiErrorText(r.error)), { icon: 'warn' });
  };

  const tableHtml = (tb: Table) =>
    `${tb.title ? `<div class="lbl">${escHtml(tb.title)}</div>` : ''}<table class="grid"><tr>${tb.head.map((h) => `<th>${escHtml(h)}</th>`).join('')}</tr>${tb.rows.map((r) => `<tr>${r.map((v) => `<td>${escHtml(v)}</td>`).join('')}</tr>`).join('')}</table>`;
  const chartHtml = (w: number[]) => {
    const lo = Math.min(...w) - 0.5;
    const hi = Math.max(...w) + 0.5;
    const pts = w.map((v, i) => `${(i / (w.length - 1)) * 500},${80 - ((v - lo) / (hi - lo)) * 76}`).join(' ');
    return `<div class="lbl">${escHtml(W.words(t('Weight (kg)')))}</div><svg viewBox="0 0 500 84" width="100%" height="84"><polyline points="${pts}" fill="none" stroke="#3355FF" stroke-width="2.5" stroke-linejoin="round"/></svg>`;
  };
  const aiHtml = (v: CoachSummary) =>
    `<div class="ai"><h2>${escHtml(t('Adro’s analysis'))}</h2><div class="lbl">${escHtml(t('What went well'))}</div><ul>${v.well.map((x) => `<li>${escHtml(x)}</li>`).join('')}</ul><div class="lbl">${escHtml(t('What to improve'))}</div><ul>${v.improve.map((x) => `<li>${escHtml(x)}</li>`).join('')}</ul><div class="lbl">${escHtml(t('Focus for next time'))}</div><p><b>${escHtml(v.focus)}</b></p></div>`;

  const makePdf = async () => {
    if (!s) return;
    setMaking(true);
    const body = sections(s)
      .map((x) => `<h2>${escHtml(x.title)}</h2>${x.chart ? chartHtml(x.chart) : ''}${x.rows.length ? `<table>${x.rows.map(([k, v]) => `<tr><td>${escHtml(k)}</td><td>${escHtml(v)}</td></tr>`).join('')}</table>` : ''}${(x.tables ?? []).map(tableHtml).join('')}`)
      .join('');
    const html = pdfPage({
      lang,
      title: t('{n}, progress report', { n: name }),
      sub: t('{n} days', { n: s.days }),
      range: label,
      body: (inc.ai && aiNow ? aiHtml(aiNow) : '') + body,
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
    ['sleep', 'Sleep and recovery'],
    ['health', 'Vitamins and blood tests'],
  ];
  const ink = { text: '#0A0A0B', sec: '#52525B', line: '#E4E4E7' };
  const small = (k: string, v: string, i: number) => (
    <View key={`${k}${i}`} style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6, gap: 8 }}>
      <Text size={12} color={ink.sec} style={{ flexShrink: 1 }}>
        {k}
      </Text>
      <Text size={12} weight={700} color={ink.text} style={{ flexShrink: 1, textAlign: 'right' }}>
        {v}
      </Text>
    </View>
  );

  return (
    <Screen title={t('Export report')} back>
      <Text color="sec" style={{ marginTop: -8 }}>
        {t('A detailed report to show your doctor or coach.')}
      </Text>
      <View style={{ backgroundColor: '#FFFFFF', borderRadius: 18, padding: 16, marginTop: 16, borderWidth: 1, borderColor: c.line }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Logo height={14} color={ink.text} ring="#3355FF" />
          <Text size={11} color={ink.sec}>
            {label}
          </Text>
        </View>
        <Text weight={700} size={17} color={ink.text} style={{ marginTop: 10 }}>
          {t('{n}, progress report', { n: name })}
        </Text>
        {!s ? (
          <Thinking message={t('Loading your report')} />
        ) : (
          <>
            {inc.ai && aiBusy ? <Thinking message={t('Reading your whole report…')} /> : null}
            {inc.ai && aiNow ? (
              <View style={{ marginTop: 12, backgroundColor: '#F4F6FF', borderRadius: 12, padding: 12 }}>
                <Text size={13} weight={700} color="#3355FF">
                  {t('Adro’s analysis')}
                </Text>
                {[
                  ['What went well', aiNow.well],
                  ['What to improve', aiNow.improve],
                ].map(([h, list]) => (
                  <View key={h as string} style={{ marginTop: 8 }}>
                    <Text size={11} weight={700} color={ink.sec}>
                      {t(h as string)}
                    </Text>
                    {(list as string[]).map((x) => (
                      <Text key={x} size={12} color={ink.text} style={{ marginTop: 3 }}>
                        {`• ${x}`}
                      </Text>
                    ))}
                  </View>
                ))}
                <Text size={11} weight={700} color={ink.sec} style={{ marginTop: 8 }}>
                  {t('Focus for next time')}
                </Text>
                <Text size={12} weight={700} color={ink.text} style={{ marginTop: 3 }}>
                  {aiNow.focus}
                </Text>
              </View>
            ) : null}
            {sections(s).map((x) => (
              <View key={x.title} style={{ marginTop: 14 }}>
                <Text size={13} weight={700} color={ink.text}>
                  {x.title}
                </Text>
                {x.chart ? (
                  <View style={{ marginTop: 6 }}>
                    <LineChart values={x.chart} height={70} dots={false} color="#3355FF" />
                  </View>
                ) : null}
                {x.rows.map(([k, v], i) => small(k, v, i))}
                {(x.tables ?? []).map((tb, ti) => (
                  <View key={ti} style={{ marginTop: 8 }}>
                    {tb.title ? (
                      <Text size={11} weight={700} color={ink.sec}>
                        {tb.title}
                      </Text>
                    ) : null}
                    {tb.rows.slice(0, 4).map((r, i) => small(r[0], r.slice(1).join(' · '), i))}
                    {tb.rows.length > 4 ? (
                      <Text size={11} color={ink.sec} style={{ marginTop: 4 }}>
                        {t('+{n} more in the PDF', { n: tb.rows.length - 4 })}
                      </Text>
                    ) : null}
                  </View>
                ))}
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
        <View style={{ flexDirection: 'row', alignItems: 'center', minHeight: 64, paddingHorizontal: 16, paddingVertical: 10, borderTopWidth: 1, borderTopColor: c.line, gap: 10 }}>
          <View style={{ flex: 1 }}>
            <Text weight={700}>{t('AI analysis')}</Text>
            <Text variant="xs" color="sec" style={{ marginTop: 2 }}>
              {t('Adro reads the whole report: what went well, what to improve and your next focus.')}
            </Text>
          </View>
          <Toggle value={inc.ai} onChange={turnAi} label={t('AI analysis')} />
        </View>
      </View>
      <Button icon="doc" title={t('Create PDF')} loading={making} disabled={!s || aiBusy} style={{ marginTop: 16 }} onPress={makePdf} />
    </Screen>
  );
}
