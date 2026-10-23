import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { useT } from '@/i18n';
import { useAuth } from '@/lib/auth';
import { allowedPlay, allowedSports, type CardioInput, type CardioPlan, type CardioPlay, type CardioSession, type CardioSlot, type CardioSport, cardioWarnings, cardioWeek, cardioWhy, defaultPer, forReadiness, liveParams, makeCardioPlan, PLAY_MIN, playCount, weekSummary, zoneText } from '@/lib/cardioPlan';
import { useFood } from '@/lib/food';
import { SPORTS, sportInfo } from '@/lib/sports';
import { ageFromIso } from '@/lib/nutrition';
import { useTrain } from '@/lib/train';
import { DAYS, DAYS_LONG, weekStart } from '@/lib/training';
import { useCardioWeek } from '@/lib/useCardioWeek';
import { useSettings } from '@/theme/settings';

import { Icon, type IconName } from '../Icon';
import { Sheet } from '../Sheet';
import { Text } from '../Text';
import { useToast } from '../Toast';
import { Button, Card, Chip, Row } from '../ui';
import { goalWord } from './PlanReviewCard';
import { useRecovery } from './RecoveryCard';

/** Names shown for each sport (from the shared sports list). */
export const SPORT_LABEL = Object.fromEntries(SPORTS.map((x) => [x.id, x.name])) as Record<CardioSport, string>;
export const sportIcon = (s: CardioSport): IconName => sportInfo(s).icon;

/** "Bike · 30 min · zone 2", "Run · 25 min · intervals", or "Padel · 75 min" for a sport you play. */
export function sessionText(s: Pick<CardioSlot, 'sport' | 'min' | 'kind'> & { fixed?: boolean }, t: (s: string, v?: Record<string, string | number>) => string) {
  const base = `${t(SPORT_LABEL[s.sport])} · ${t('{n} min', { n: s.min })}`;
  return s.fixed ? base : `${base} · ${t(s.kind === 'intervals' ? 'intervals' : 'zone 2')}`;
}

/** Everything the cardio plan is made from, except the training week and your own choices. */
export function useCardioBase(): Omit<CardioInput, 'week'> {
  const train = useTrain();
  const food = useFood();
  const { profile } = useAuth();
  return { goal: goalWord(food.plan.goal) as CardioInput['goal'], level: train.plan?.level ?? null, age: ageFromIso(profile?.date_of_birth), preg: train.preg, injuries: train.plan?.injuries ?? [] };
}

export type CardioChoice = { sport?: CardioSport; per?: number; days?: number[]; play?: CardioPlay[] };

/** Pick the sport, sessions a week and days, with the week's preview and why it helps. */
export function CardioEditor({ input, value, onChange, today, inCard }: { input: CardioInput; value: CardioChoice; onChange: (v: CardioChoice) => void; today: string; inCard?: boolean }) {
  const { t } = useT();
  const { colors: c } = useSettings();
  const plan = makeCardioPlan({ ...input, ...value }, today);
  const start = weekStart(today);
  const week = cardioWeek(plan, input.week, start);
  const full = weekSummary(cardioWeek(plan, input.week, '9999-12-31'));
  const sum = weekSummary(week);
  const ok = allowedSports(input);
  const off = inCard ? c.inset : undefined;
  const auto = !value.days?.length;
  return (
    <View>
      {cardioWhy(input).map((w) => (
        <Text key={w} variant="small" color="sec" style={{ marginBottom: 6 }}>
          {t(w)}
        </Text>
      ))}

      <PlayPicker input={input} value={value} onChange={onChange} off={off} />
      {cardioWarnings({ ...input, play: value.play }).map((w) => (
        <Row key={w.text + JSON.stringify(w.vars)} gap={8} style={{ marginTop: 8, alignItems: 'flex-start' }}>
          <Icon name="warn" size={16} color={c.down} />
          <Text variant="xs" style={{ flex: 1 }}>
            {t(w.text, w.vars ? Object.fromEntries(Object.entries(w.vars).map(([k, v]) => [k, t(k === 'sport' ? SPORT_LABEL[v as CardioSport] : v)])) : undefined)}
          </Text>
        </Row>
      ))}

      <Text variant="small" weight={700} color="sec" style={{ marginTop: 14, marginBottom: 8 }}>
        {t('Cardio to add')}
      </Text>
      <Row gap={8} style={{ flexWrap: 'wrap' }}>
        {ok.map((s) => (
          <Chip key={s} title={t(SPORT_LABEL[s])} on={plan.sport === s} offColor={off} onPress={() => onChange({ ...value, sport: s })} />
        ))}
      </Row>

      <Text variant="small" weight={700} color="sec" style={{ marginTop: 14, marginBottom: 8 }}>
        {t('Sessions a week (your sports count)')}
      </Text>
      <Row gap={8} style={{ flexWrap: 'wrap' }}>
        {[1, 2, 3, 4, 5, 6].filter((n) => n >= Math.min(6, playCount(plan.play).n)).map((n) => (
          <Chip key={n} title={n === defaultPer(input) ? t('{n} (best)', { n }) : String(n)} on={plan.per === n} offColor={off} onPress={() => onChange({ ...value, per: n, days: undefined })} />
        ))}
      </Row>

      <Text variant="small" weight={700} color="sec" style={{ marginTop: 14, marginBottom: 8 }}>
        {t('Cardio days')}
      </Text>
      <Row gap={6} style={{ flexWrap: 'wrap' }}>
        <Chip title={t('Auto')} on={auto} offColor={off} onPress={() => onChange({ ...value, days: undefined })} />
        {DAYS.map((d, i) => {
          const on = auto ? week.some((s) => s.day === i && !s.fixed) : !!value.days?.includes(i);
          return (
            <Chip
              key={d}
              title={t(d)}
              on={!auto && on}
              offColor={auto && on ? c.gAi : off}
              onPress={() => {
                // Your own days: the number of days you pick is the number of sessions.
                const cur = auto ? week.filter((s) => !s.fixed).map((s) => s.day) : (value.days ?? []);
                const next = cur.includes(i) ? cur.filter((x) => x !== i) : [...cur, i].sort((a, b) => a - b);
                if (!next.length || next.length > 6) return;
                onChange({ ...value, days: next, per: undefined });
              }}
            />
          );
        })}
      </Row>
      <Text variant="xs" color="sec" style={{ marginTop: 6 }}>
        {t(auto ? 'Auto: on rest days first, never hard cardio before leg day.' : 'Your days. Hard cardio never goes on a leg day or the day before.')}
      </Text>

      <View style={{ marginTop: 14, borderRadius: 18, backgroundColor: inCard ? c.inset : c.card, overflow: 'hidden' }}>
        {week.map((s, i) => (
          <Row key={s.id} gap={10} style={{ paddingHorizontal: 14, paddingVertical: 10, borderTopWidth: i ? 1 : 0, borderTopColor: c.line }}>
            <Text weight={700} style={{ width: 44 }}>
              {t(DAYS[s.day])}
            </Text>
            <Icon name={sportIcon(s.sport)} size={18} color={s.kind === 'intervals' ? c.down : c.cobalt} />
            <View style={{ flex: 1 }}>
              <Text weight={600} numberOfLines={1}>
                {sessionText(s, t)}
              </Text>
              <Text variant="xs" color="sec" numberOfLines={2}>
                {s.fixed ? t('Your sport') : t(zoneText(s.zone))}
              </Text>
            </View>
          </Row>
        ))}
      </View>
      <Text variant="small" weight={700} style={{ marginTop: 10 }}>
        {t('{n} sessions · {m} min a week', { n: sum.sessions, m: sum.minutes })}
      </Text>
      {plan.ramp && full.minutes > sum.minutes ? (
        <Text variant="xs" color="sec" style={{ marginTop: 2 }}>
          {t('Building up to {m} min a week by week 4.', { m: full.minutes })}
        </Text>
      ) : null}
    </View>
  );
}

/** Add, change or remove your cardio plan. */
export function CardioPlanSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  return <Sheet open={open} onClose={onClose}>{open ? <CardioSheetBody onClose={onClose} /> : null}</Sheet>;
}

function CardioSheetBody({ onClose }: { onClose: () => void }) {
  const { t } = useT();
  const toast = useToast();
  const train = useTrain();
  const base = useCardioBase();
  const cur = train.plan?.cardio;
  const [value, setValue] = useState<CardioChoice>(() => (cur ? { sport: cur.sport, per: cur.per, days: cur.days, play: cur.play } : {}));
  if (!train.plan) return null;
  const input: CardioInput = { ...base, week: train.week.map((d) => d.w) };
  const save = () => {
    const made = makeCardioPlan({ ...input, ...value }, train.today);
    // A beginner keeps building up from when the plan first started.
    const next: CardioPlan = cur ? { ...made, start: cur.start } : made;
    train.updatePlan({ cardio: next });
    toast(t(cur ? 'Cardio and sports updated' : 'Cardio and sports added'), { icon: 'check' });
    onClose();
  };
  const remove = () => {
    const before = cur;
    train.updatePlan({ cardio: undefined });
    toast(t('Cardio and sports removed'), { icon: 'trash', undo: () => train.updatePlan({ cardio: before }) });
    onClose();
  };
  return (
    <View>
      <Text variant="h2">{t(cur ? 'Your cardio and sports' : 'Add cardio and sports?')}</Text>
      <View style={{ marginTop: 8 }}>
        <CardioEditor input={input} value={value} onChange={setValue} today={train.today} />
      </View>
      <Button title={t(cur ? 'Save' : 'Yes, add it')} style={{ marginTop: 16 }} onPress={save} />
      {cur ? <Button kind="ghost" title={t('Remove cardio and sports')} style={{ marginTop: 6 }} onPress={remove} /> : <Button kind="glass" title={t('Not now')} style={{ marginTop: 8 }} onPress={onClose} />}
    </View>
  );
}

/** Start a planned session on the live cardio screen. */
export const startCardio = (s: Pick<CardioSession, 'sport' | 'min' | 'zone' | 'kind' | 'id'>) => router.push({ pathname: '/cardio-live', params: liveParams(s) });

/** Train tab: today's cardio (eased when recovery is low), or the next one, or an offer to add a plan. */
export function CardioTodayCard({ onEdit }: { onEdit: () => void }) {
  const { t } = useT();
  const { colors: c } = useSettings();
  const train = useTrain();
  const cw = useCardioWeek();
  const { r } = useRecovery();
  if (!train.plan?.cardio) return null;
  const s = cw.today;
  if (!s) {
    if (!cw.next) return null;
    return (
      <Card onPress={onEdit} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View style={{ width: 36, height: 36, borderRadius: 11, backgroundColor: c.inset, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name={sportIcon(cw.next.sport)} size={20} />
        </View>
        <View style={{ flex: 1 }}>
          <Text weight={700}>{t('Next session: {day}', { day: t(DAYS_LONG[cw.next.day]) })}</Text>
          <Text variant="small" color="sec" numberOfLines={1}>
            {sessionText(cw.next, t)}
          </Text>
        </View>
        <Text variant="xs" weight={700} color="sec">
          {t('{d} of {n} done', { d: cw.doneCount, n: cw.sessions.length })}
        </Text>
      </Card>
    );
  }
  const today = forReadiness(s, cw.todayDone ? null : r.score);
  return (
    <Card>
      <Row gap={12}>
        <View style={{ width: 36, height: 36, borderRadius: 11, backgroundColor: cw.todayDone ? c.cobalt : c.inset, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name={cw.todayDone ? 'check' : sportIcon(today.sport)} size={20} color={cw.todayDone ? '#FFFFFF' : undefined} />
        </View>
        <View style={{ flex: 1 }}>
          <Text variant="xs" weight={700} color="sec">
            {t(s.fixed ? 'Sport today' : 'Cardio today')}
          </Text>
          <Text weight={700} numberOfLines={1}>
            {sessionText(today, t)}
          </Text>
          <Text variant="xs" color="sec" numberOfLines={2}>
            {cw.todayDone ? t('Done. Nice work.') : s.fixed ? t('Log it when you’re done, or start it to track it live.') : t(zoneText(today.zone))}
          </Text>
        </View>
        {cw.todayDone ? null : <Button small title={t('Start')} onPress={() => startCardio({ ...today, id: s.id })} />}
      </Row>
      {today.eased ? (
        <Text variant="xs" color="sec" style={{ marginTop: 10 }}>
          {t('Easier today because your recovery is {n}.', { n: r.score })}
        </Text>
      ) : null}
      <Row gap={8} style={{ marginTop: 10, justifyContent: 'space-between' }}>
        <Text variant="xs" weight={700} color="sec">
          {t('{d} of {n} done this week', { d: cw.doneCount, n: cw.sessions.length })}
        </Text>
        <Text variant="xs" weight={700} color="cobalt" onPress={onEdit} accessibilityRole="button">
          {t('Edit cardio and sports')}
        </Text>
      </Row>
    </Card>
  );
}

/** Weekly plan: the week's cardio with done ticks, and add / edit. */
export function CardioWeekCard({ onEdit }: { onEdit: () => void }) {
  const { t } = useT();
  const { colors: c } = useSettings();
  const cw = useCardioWeek();
  if (!cw.plan)
    return (
      <Card style={{ marginTop: 20 }}>
        <Row gap={10} style={{ alignItems: 'flex-start' }}>
          <Icon name="run" size={20} color={c.cobalt} />
          <View style={{ flex: 1 }}>
            <Text weight={700}>{t('Add cardio and sports?')}</Text>
            <Text variant="small" color="sec" style={{ marginTop: 2 }}>
              {t('Cardio and sports that fit your goal get you there faster.')}
            </Text>
          </View>
        </Row>
        <Button small kind="soft" icon="plus" title={t('Add cardio and sports')} style={{ marginTop: 10, alignSelf: 'stretch' }} onPress={onEdit} />
      </Card>
    );
  return (
    <Card style={{ marginTop: 20 }}>
      <Row gap={10}>
        <Text weight={700} style={{ flex: 1 }}>
          {t('Cardio and sports this week')}
        </Text>
        <Text variant="xs" weight={700} color="sec">
          {t('{d} of {n} done', { d: cw.doneCount, n: cw.sessions.length })}
        </Text>
      </Row>
      <View style={{ marginTop: 8 }}>
        {cw.sessions.map((s, i) => {
          const st = cw.status(s);
          return (
            <Row key={s.id} gap={10} style={{ paddingVertical: 8, borderTopWidth: i ? 1 : 0, borderTopColor: c.line }}>
              <Text weight={700} style={{ width: 44 }}>
                {t(DAYS[s.day])}
              </Text>
              <Icon name={sportIcon(s.sport)} size={18} color={s.kind === 'intervals' ? c.down : c.cobalt} />
              <Text weight={600} style={{ flex: 1 }} numberOfLines={1}>
                {sessionText(s, t)}
              </Text>
              {st === 'done' ? (
                <Icon name="check" size={18} color={c.cobalt} strokeWidth={2.6} />
              ) : st === 'today' ? (
                <Button small title={t('Start')} onPress={() => startCardio(s)} />
              ) : st === 'missed' ? (
                <Text variant="xs" weight={700} color="sec">
                  {t('Missed')}
                </Text>
              ) : null}
            </Row>
          );
        })}
      </View>
      <Text variant="xs" color="sec" style={{ marginTop: 6 }}>
        {t('{m} min a week. Missing cardio never breaks your workout streak.', { m: cw.summary.minutes })}
      </Text>
      <Button small kind="soft" icon="edit" title={t('Edit cardio and sports')} style={{ marginTop: 10, alignSelf: 'stretch' }} onPress={onEdit} />
    </Card>
  );
}

/** "Sports you play": pick sports, then the days you play each one (the number of days is times a week). */
function PlayPicker({ input, value, onChange, off }: { input: CardioInput; value: CardioChoice; onChange: (v: CardioChoice) => void; off?: string }) {
  const { t } = useT();
  const { colors: c } = useSettings();
  const play = value.play ?? [];
  const ok = allowedPlay(input);
  const set = (next: CardioPlay[]) => onChange({ ...value, play: next.length ? next : undefined });
  const toggle = (sport: CardioSport) => {
    if (play.some((p) => p.sport === sport)) return set(play.filter((p) => p.sport !== sport));
    // First day: a rest day nobody's using yet (Friday first: the weekend), else Friday.
    const taken = new Set(play.flatMap((p) => p.days));
    const day = [5, 6, 4, 0, 1, 2, 3].find((d) => !input.week[d] && !taken.has(d)) ?? 5;
    set([...play, { sport, days: [day], min: PLAY_MIN[sport] ?? 60 }]);
  };
  const setDays = (sport: CardioSport, d: number) =>
    set(
      play.map((p) => {
        if (p.sport !== sport) return p;
        const days = p.days.includes(d) ? p.days.filter((x) => x !== d) : [...p.days, d].sort((a, b) => a - b);
        return days.length ? { ...p, days } : p;
      }),
    );
  const setMin = (sport: CardioSport, min: number) => set(play.map((p) => (p.sport === sport ? { ...p, min } : p)));
  return (
    <View>
      <Text variant="small" weight={700} color="sec" style={{ marginTop: 12, marginBottom: 8 }}>
        {t('Sports you play')}
      </Text>
      <Row gap={8} style={{ flexWrap: 'wrap' }}>
        {[...new Set([...ok, ...play.map((p) => p.sport)])].map((s) => (
          <Chip key={s} title={t(SPORT_LABEL[s])} on={play.some((p) => p.sport === s)} offColor={off} onPress={() => toggle(s)} />
        ))}
      </Row>
      {play.map((p) => (
        <View key={p.sport} style={{ marginTop: 10, padding: 12, borderRadius: 16, backgroundColor: off ?? c.card }}>
          <Row gap={8}>
            <Icon name={sportIcon(p.sport)} size={18} color={c.cobalt} />
            <Text weight={700} style={{ flex: 1 }} numberOfLines={1}>
              {`${t(SPORT_LABEL[p.sport])} ×${p.days.length}`}
            </Text>
            {[...new Set([p.min, 45, 60, 90])].sort((a, b) => a - b).map((m) => (
              <Text key={m} variant="xs" weight={700} color={p.min === m ? 'cobalt' : 'sec'} onPress={() => setMin(p.sport, m)} accessibilityRole="button" style={{ paddingHorizontal: 4, paddingVertical: 6 }}>
                {t('{n} min', { n: m })}
              </Text>
            ))}
          </Row>
          <Row gap={4} style={{ marginTop: 8, flexWrap: 'wrap' }}>
            {DAYS.map((d, i) => (
              <Chip key={d} title={t(d)} on={p.days.includes(i)} offColor={off ? c.card : c.inset} onPress={() => setDays(p.sport, i)} />
            ))}
          </Row>
        </View>
      ))}
    </View>
  );
}
