import { useState } from 'react';
import { View } from 'react-native';

import { BarChart } from '@/components/Charts';
import { Icon, type IconName } from '@/components/Icon';
import { type State } from '@/components/period/shared';
import { Text } from '@/components/Text';
import { useToast } from '@/components/Toast';
import { Button, Card } from '@/components/ui';
import { useT } from '@/i18n';
import { useAuth } from '@/lib/auth';
import { averages, phaseOn } from '@/lib/cycle';
import { shareCyclePdf } from '@/lib/cyclePdf';
import { useFood } from '@/lib/food';
import { useHealth } from '@/lib/health';
import { useTrain } from '@/lib/train';
import { addDays } from '@/lib/nutrition';
import { useWeight } from '@/lib/units';
import { useSettings } from '@/theme/settings';

export function InsightsTab({ st }: { st: State }) {
  const { t, lang } = useT();
  const W = useWeight();
  const { colors: c } = useSettings();
  const toast = useToast();
  const { profile } = useAuth();
  const { today } = useFood();
  const [making, setMaking] = useState(false);
  const health = useHealth();
  const train = useTrain();
  const PH = ['Period', 'Follicular', 'Ovulation', 'Luteal'] as const;
  const counts: Record<string, Record<string, number>> = { Period: {}, Follicular: {}, Ovulation: {}, Luteal: {} };
  for (const [day, lg] of Object.entries(st.logs)) {
    const ph = phaseOn(day, st.periods, st.settings);
    if (!ph) continue;
    for (const [cat, items] of Object.entries(lg)) if (cat !== 'Flow') for (const it of items) counts[ph][it] = (counts[ph][it] ?? 0) + 1;
  }
  const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
  const byPhase = (vals: { day: string; v: number }[]) => PH.map((ph) => avg(vals.filter((x) => phaseOn(x.day, st.periods, st.settings) === ph).map((x) => x.v)));
  const vol = byPhase(train.logs.filter((l) => l.volume > 0).map((l) => ({ day: l.day, v: l.volume })));
  const wt = byPhase(health.weights.map((w) => ({ day: w.day, v: w.value })));
  const tips: { icon: IconName; title: string; body: string }[] = [];
  for (const ph of PH) {
    const top = Object.entries(counts[ph]).sort((a, b) => b[1] - a[1])[0];
    if (top && top[1] >= 2) tips.push({ icon: 'body', title: t('{x} in your {p} phase', { x: t(top[0]), p: t(ph).toLowerCase() }), body: t('You logged it on {n} days in this phase.', { n: top[1] }) });
  }
  if (wt[3] != null && wt[1] != null && wt[3] - wt[1] >= 0.3) tips.push({ icon: 'scale', title: t('Water weight before your period'), body: t('Your weight is about {n} kg higher in the luteal phase than the follicular phase. It drops again after your period starts.', { n: Math.round((wt[3] - wt[1]) * 10) / 10 }) });
  const best = vol.map((v, i) => [v ?? -1, i] as const).sort((a, b) => b[0] - a[0])[0];
  if (best && best[0] > 0) tips.push({ icon: 'trophy', title: t('Your strongest phase'), body: t('Your training volume is highest in the {p} phase. Plan heavy sessions then.', { p: t(PH[best[1]]).toLowerCase() }) });
  const enough = st.periods.length >= 1 && (Object.keys(st.logs).length >= 3 || train.logs.length >= 3);
  return (
    <View>
      {enough && tips.length ? (
        tips.map((x) => (
          <Card key={x.title} style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
            <View style={{ width: 34, height: 34, borderRadius: 11, backgroundColor: c.cobalt, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name={x.icon} size={18} color="#FFFFFF" />
            </View>
            <View style={{ flex: 1 }}>
              <Text weight={700}>{x.title}</Text>
              <Text variant="small" color="sec" style={{ marginTop: 2 }}>
                {x.body}
              </Text>
            </View>
          </Card>
        ))
      ) : (
        <Card style={{ alignItems: 'center', paddingVertical: 20 }}>
          <Icon name="sparkle" size={28} color={c.cobalt} />
          <Text variant="small" color="sec" center style={{ marginTop: 8 }}>
            {t('Log your periods, symptoms and workouts for a cycle or two. Then the patterns we find show here.')}
          </Text>
        </Card>
      )}
      {vol.some((v) => v != null) ? (
        <Card>
          <Text variant="xs" weight={700} color="sec">
            {W.words(t('Average training volume per session (kg)'))}
          </Text>
          <View style={{ marginTop: 8 }}>
            <BarChart values={vol.map((v) => (v == null ? null : Math.round(W.num(v))))} labels={PH.map((p) => t(p))} highlight={best?.[1] ?? -1} />
          </View>
        </Card>
      ) : null}
      <Text variant="small" weight={700} color="sec" style={{ marginTop: 8, marginBottom: 8, marginHorizontal: 4 }}>
        {t('For your doctor')}
      </Text>
      <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Icon name="doc" size={20} />
        <View style={{ flex: 1 }}>
          <Text weight={700}>{t('Cycle health report')}</Text>
          <Text variant="small" color="sec">
            {t('Cycle lengths, period days, symptoms and notes as a PDF')}
          </Text>
        </View>
        <Button
          small
          title={t('Create')}
          loading={making}
          disabled={!st.periods.length}
          onPress={async () => {
            setMaking(true);
            const ok = await shareCyclePdf(cycleReport(st, today, t, lang, profile?.name ?? ''), `adro-cycle-report-${today}.pdf`);
            setMaking(false);
            toast(ok ? t('Report ready to share') : t('Couldn’t create the report. Please try again.'), { icon: ok ? 'doc' : 'warn' });
          }}
        />
      </Card>
    </View>
  );
}

const esc = (x: string) => x.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Cycle health report for a doctor, as printable HTML (made into a PDF on the phone). */
function cycleReport(st: State, today: string, t: ReturnType<typeof useT>['t'], lang: 'en' | 'ar', name: string) {
  const av = averages(st.periods, st.settings);
  const sorted = [...st.periods].sort((a, b) => a.start_day.localeCompare(b.start_day));
  const days = (a: string, b: string) => Math.round((new Date(`${b}T12:00:00`).getTime() - new Date(`${a}T12:00:00`).getTime()) / 864e5);
  const date = (d: string) => new Intl.DateTimeFormat(lang === 'ar' ? 'ar-u-nu-latn' : 'en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(`${d}T12:00:00`));
  const rows = sorted
    .slice(-12)
    .map((p) => {
      const i = sorted.indexOf(p);
      const next = sorted[i + 1];
      return `<tr><td>${date(p.start_day)}</td><td>${p.end_day ? days(p.start_day, p.end_day) + 1 : '–'}</td><td>${next ? days(p.start_day, next.start_day) : '–'}</td></tr>`;
    })
    .reverse()
    .join('');
  const from = addDays(today, -180);
  const counts: Record<string, number> = {};
  const logs = Object.entries(st.logs)
    .filter(([d]) => d >= from)
    .sort((a, b) => b[0].localeCompare(a[0]));
  for (const [, lg] of logs) for (const [cat, xs] of Object.entries(lg)) if (cat === 'Symptoms' || cat === 'Mood') for (const x of xs) counts[x] = (counts[x] ?? 0) + 1;
  const top = Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
    .map(([k, n]) => `<li>${esc(t(k))}: ${t('{n} days', { n })}</li>`)
    .join('');
  const logRows = logs
    .slice(0, 60)
    .map(([d, lg]) => `<tr><td>${date(d)}</td><td>${esc((lg.Flow ?? []).map((x) => t(x)).join(', '))}</td><td>${esc((lg.Symptoms ?? []).map((x) => t(x)).join(', '))}</td><td>${esc((lg.Mood ?? []).map((x) => t(x)).join(', '))}</td></tr>`)
    .join('');
  return `<!doctype html><html dir="${lang === 'ar' ? 'rtl' : 'ltr'}"><head><meta charset="utf-8"><title></title><style>
body{font-family:-apple-system,Helvetica,Arial,sans-serif;color:#111;margin:32px;font-size:13px}h1{font-size:22px;margin:0}h2{font-size:15px;margin:22px 0 8px}
.sec{color:#666}table{width:100%;border-collapse:collapse}td,th{border-bottom:1px solid #ddd;padding:6px;text-align:start;vertical-align:top}th{font-size:12px;color:#666}
.grid{display:flex;gap:12px}.box{flex:1;border:1px solid #ddd;border-radius:10px;padding:10px}.big{font-size:18px;font-weight:700}</style></head><body>
<h1>${esc(t('Cycle health report'))}</h1><div class="sec">${esc(name)}${name ? ' · ' : ''}${esc(t('Made with Adro on {d}', { d: date(today) }))}</div>
<h2>${esc(t('Summary'))}</h2><div class="grid">
<div class="box"><div class="big">${t('{n} days', { n: av.cycle })}</div><div class="sec">${esc(t('Average cycle'))}</div></div>
<div class="box"><div class="big">${t('{n} days', { n: av.bleed })}</div><div class="sec">${esc(t('Average period'))}</div></div>
<div class="box"><div class="big">${av.varies == null ? '–' : t('{n} days', { n: av.varies })}</div><div class="sec">${esc(t('Cycle length varies by'))}</div></div></div>
<h2>${esc(t('Periods'))}</h2><table><tr><th>${esc(t('Started'))}</th><th>${esc(t('Period days'))}</th><th>${esc(t('Cycle length (days)'))}</th></tr>${rows}</table>
${top ? `<h2>${esc(t('Most logged symptoms and moods (last 6 months)'))}</h2><ul>${top}</ul>` : ''}
${logRows ? `<h2>${esc(t('Daily logs'))}</h2><table><tr><th>${esc(t('Date'))}</th><th>${esc(t('Flow'))}</th><th>${esc(t('Symptoms'))}</th><th>${esc(t('Mood'))}</th></tr>${logRows}</table>` : ''}
<p class="sec" style="margin-top:24px">${esc(t('Logged by the user in Adro. Predictions are estimates. This is not a diagnosis.'))}</p></body></html>`;
}
