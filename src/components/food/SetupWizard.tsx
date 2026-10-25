import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { TextInput, View } from 'react-native';

import { useT } from '@/i18n';
import { useFood } from '@/lib/food';
import { ACTIVITY, addDays, bodyFatList, calcPlan, defaultTarget, flooredRate, type FoodPlan, GOAL_DESC, GOAL_ORDER, GOALS, isMinor, lowestTarget, targetFits, weeksToTarget } from '@/lib/nutrition';
import { useWeight } from '@/lib/units';
import { cleanNumber } from '@/lib/validation';
import { useSettings } from '@/theme/settings';

import { Icon, Mark } from '../Icon';
import { Screen } from '../Screen';
import { fontFor, Text } from '../Text';
import { useToast } from '../Toast';
import { Button, Card, ErrorText, Label, Option, ProgDots, Row, Springy, Toggle } from '../ui';
import { AllergyPicker } from './AllergyPicker';
import { BodyFigure } from './BodyFigure';
import { Stepper } from './Stepper';
import { Thinking } from './Thinking';
import { TimeField } from './TimeField';

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** First time in Food: weight and activity, goal, body fat, work day, allergies, notes. */
export function SetupWizard({ inTab }: { inTab?: boolean }) {
  const { t, lang } = useT();
  const { colors: c } = useSettings();
  const toast = useToast();
  const food = useFood();
  const wu = useWeight();
  const minor = isMinor(food.person);
  // The weight field is in your unit (kg or lb); the plan always saves kg.
  const [lo, hi] = wu.unit === 'lb' ? [66, 550] : [30, 250];
  const [step, setStep] = useState(0);
  const [thinking, setThinking] = useState<string | null>(null);
  const f = food.draft ?? food.plan;
  const set = (patch: Partial<FoodPlan>) => food.setDraft({ ...f, ...patch });
  const [wText, setWText] = useState(String(wu.num(f.weight)));
  const [wErr, setWErr] = useState<string | null>(null);

  useEffect(() => {
    if (!food.draft) food.setDraft({ ...food.plan, ...(minor ? { goal: 2 } : {}) });
    // Start the draft once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const next = () => setStep((s) => s + 1);
  const run = async () => {
    for (const m of ['Reading your answers', 'Working out your calories', 'Timing your meals around work']) {
      setThinking(m);
      await wait(750);
    }
    food.setDraft(calcPlan(f, food.person));
    setThinking(null);
    setStep(0);
    router.push({ pathname: '/food-results', params: { fresh: '1' } });
  };

  const stepWeight = (d: number) => {
    const v = Math.round(Math.min(hi, Math.max(lo, wu.num(f.weight) + d)) * 10) / 10;
    set({ weight: Math.round(wu.toKg(v) * 10) / 10 });
    setWText(String(v));
  };

  // The weight you're aiming for (a cut or bulk): half a kilo (or a pound) a tap, on the goal's side of your weight,
  // and never under a healthy weight for your height.
  const target = targetFits(f.goal, f.weight, f.targetWeight) ? (f.targetWeight as number) : defaultTarget(f.goal, f.weight);
  const tMin = f.goal >= 3 ? lowestTarget(f.weight, food.person) : f.weight + 0.5;
  const tMax = f.goal >= 3 ? f.weight - 0.5 : Math.round(f.weight * 1.5);
  const stepTarget = (d: number) => {
    if (target == null) return;
    const v = Math.round(Math.min(tMax, Math.max(tMin, wu.toKg(wu.num(target) + d))) * 10) / 10;
    set({ targetWeight: v });
  };
  const weeks = target != null ? weeksToTarget({ ...f, targetWeight: target }, food.person) : null;
  const byDate = weeks ? new Intl.DateTimeFormat(lang === 'ar' ? 'ar-u-nu-latn' : 'en-US', { month: 'long', year: 'numeric' }).format(new Date(`${addDays(food.today, weeks * 7)}T12:00:00`)) : '';

  const title = t(inTab ? 'Set up your calories' : 'Calorie setup');
  const back = step > 0 ? () => setStep(step - 1) : inTab ? undefined : () => router.back();

  if (thinking)
    return (
      <Screen title={title} tabs={inTab}>
        <View style={{ paddingTop: 100 }}>
          <Thinking message={t(thinking)} />
        </View>
      </Screen>
    );

  const header = (
    <View>
      <ProgDots step={step} total={6} />
      <Text variant="small" weight={700} color="sec">
        {t('Step {n} of {total}', { n: step + 1, total: 6 })}
      </Text>
    </View>
  );

  return (
    <Screen title={title} back={!!back} onBack={back} tabs={inTab}>
      {header}
      {step === 0 ? (
        <View>
          <Text variant="h1" style={{ marginTop: 4 }}>
            {t('Weight and activity')}
          </Text>
          <Card style={{ marginTop: 16 }}>
            <Stepper onMinus={() => stepWeight(wu.unit === 'lb' ? -0.5 : -0.1)} onPlus={() => stepWeight(wu.unit === 'lb' ? 0.5 : 0.1)} labels={[t('Decrease'), t('Increase')]}>
              <TextInput
                value={wText}
                onChangeText={(v) => {
                  const s = cleanNumber(v, true);
                  setWText(s);
                  const n = parseFloat(s);
                  const ok = n >= lo && n <= hi;
                  setWErr(s && !ok && s.replace('.', '').length >= 2 ? t('Enter a weight between {a} and {b} {unit}', { a: lo, b: hi, unit: wu.label }) : null);
                  if (ok) set({ weight: Math.round(wu.toKg(n) * 10) / 10 });
                }}
                onBlur={() => {
                  setWText(String(wu.num(f.weight)));
                  setWErr(null);
                }}
                inputMode="decimal"
                keyboardType="decimal-pad"
                accessibilityLabel={wu.words(t('Weight in kg'))}
                style={{ fontFamily: fontFor('sora', 600), fontSize: 44, letterSpacing: -1.7, color: c.text, textAlign: 'center', width: '100%', maxWidth: 180, borderBottomWidth: 2, borderStyle: 'dashed', borderColor: c.line, outlineStyle: 'none', direction: 'ltr' } as object}
              />
            </Stepper>
            <ErrorText>{wErr}</ErrorText>
            <Text variant="small" weight={700} color="sec" center style={{ marginTop: 4 }}>
              {wu.label}
            </Text>
          </Card>
          <Label>{t('How active is your day?')}</Label>
          {ACTIVITY.map(([a, b], i) => (
            <Option key={a} title={t(a)} subtitle={t(b)} selected={f.activity === i} onPress={() => set({ activity: i })} />
          ))}
          <Button title={t('Next')} style={{ marginTop: 24 }} onPress={next} />
        </View>
      ) : null}

      {step === 1 ? (
        <View>
          <Text variant="h1" style={{ marginTop: 4 }}>
            {t('What’s your goal?')}
          </Text>
          <Text color="sec" style={{ marginTop: 4, marginBottom: 16 }}>
            {t('You can change this any time.')}
          </Text>
          {minor ? (
            <Card style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
              <Icon name="info" size={20} color={c.cobalt} />
              <Text variant="small" style={{ flex: 1 }}>
                {t('Under 18: we keep you at maintenance so you have energy to grow.')}
              </Text>
            </Card>
          ) : null}
          {GOAL_ORDER.map((i) => {
            // A cut the calorie floor holds back: the rate you'd really get, not the usual range.
            const rate = flooredRate({ ...f, goal: i }, food.person);
            return (
              <Option
                key={i}
                icon={i < 2 ? 'up' : i === 2 ? 'minus' : 'down'}
                title={t(GOALS[i])}
                subtitle={rate != null ? (rate < 0 ? t('About −{x} kg a week for you (your calorie floor)', { x: Math.abs(rate).toFixed(2) }) : t('Close to maintenance for you (your calorie floor)')) : t(GOAL_DESC[i])}
                selected={(minor ? 2 : f.goal) === i}
                disabled={minor && i !== 2}
                onPress={() => {
                  const g = minor ? 2 : i;
                  // A target on the other side of your weight (you switched from a cut to a bulk) starts over.
                  set({ goal: g, targetWeight: targetFits(g, f.weight, f.targetWeight) ? f.targetWeight : defaultTarget(g, f.weight) });
                }}
              />
            );
          })}
          {!minor && target != null ? (
            <Card style={{ marginTop: 8 }}>
              <Text variant="small" weight={700} color="sec">
                {t('Target weight')}
              </Text>
              <View style={{ marginTop: 8 }}>
                <Stepper onMinus={() => stepTarget(wu.unit === 'lb' ? -1 : -0.5)} onPlus={() => stepTarget(wu.unit === 'lb' ? 1 : 0.5)} minusDisabled={target <= tMin} labels={[t('Decrease'), t('Increase')]}>
                  <Text num size={36} style={{ letterSpacing: -1.2, lineHeight: 42 }}>
                    {wu.show(target)}
                    <Text num size={16} weight={500} color="sec">{` ${wu.label}`}</Text>
                  </Text>
                </Stepper>
              </View>
              <Text variant="small" color="sec" center style={{ marginTop: 8 }}>
                {weeks
                  ? t('About {n} weeks at this pace, around {date}.', { n: weeks, date: byDate })
                  : t('Your calories can’t go low enough to reach it by eating alone. Moving more helps.')}
              </Text>
              {f.goal >= 3 && target <= tMin ? (
                <Text variant="xs" color="sec" center style={{ marginTop: 4 }}>
                  {t('That’s the lowest healthy weight for your height.')}
                </Text>
              ) : null}
            </Card>
          ) : null}
          <Button
            title={t('Next')}
            style={{ marginTop: 24 }}
            onPress={() => {
              // The target shown is the one saved (also when you didn't change it).
              if (!minor && target != null && f.targetWeight !== target) set({ targetWeight: target });
              next();
            }}
          />
        </View>
      ) : null}

      {step === 2 ? (
        <View>
          <Text variant="h1" style={{ marginTop: 4 }}>
            {t('Which body looks closest to yours?')}
          </Text>
          <Text color="sec" style={{ marginTop: 4, marginBottom: 16 }}>
            {t('The number under each body is its body fat percentage. Pick the closest one; it only needs to be roughly right.')}
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
            {bodyFatList(food.person.gender).map((b, i) => {
              const on = f.bf === i;
              return (
                <Springy
                  key={b}
                  onPress={() => set({ bf: i })}
                  scaleTo={0.97}
                  accessibilityLabel={t('About {n}% body fat', { n: b })}
                  accessibilityState={{ selected: on }}
                  style={{ width: '31%', flexGrow: 1, alignItems: 'center', backgroundColor: c.card, borderRadius: 22, padding: 6, paddingBottom: 10, borderWidth: 2, borderColor: on ? c.cobalt : 'transparent' }}>
                  <BodyFigure bf={b} female={food.person.gender === 'female'} selected={on} />
                  <Text num color={on ? c.cobalt : c.text} style={{ marginTop: 6 }}>{`${b}%`}</Text>
                  <Text variant="xs" weight={600} color={on ? c.cobalt : 'sec'}>
                    {t('body fat')}
                  </Text>
                </Springy>
              );
            })}
          </View>
          <Button title={t('Next')} style={{ marginTop: 24 }} onPress={next} />
        </View>
      ) : null}

      {step === 3 ? (
        <View>
          <Text variant="h1" style={{ marginTop: 4 }}>
            {t('Your work day')}
          </Text>
          <Text color="sec" style={{ marginTop: 4 }}>
            {t('We time your meals and workout around it.')}
          </Text>
          {f.work.map((w, i) => (
            <Card key={i} style={{ marginTop: 12, paddingVertical: 14, paddingHorizontal: 16, marginBottom: 0 }}>
              <Row style={{ justifyContent: 'space-between' }}>
                <Text weight={700}>{f.work.length > 1 ? t('Work time {n}', { n: i + 1 }) : t('Work hours')}</Text>
                {i > 0 ? (
                  <Springy
                    onPress={() => {
                      const work = f.work.filter((_, j) => j !== i);
                      set({ work, rotate: work.length > 1 ? f.rotate : false });
                      toast(t('Work time removed'), { icon: 'trash' });
                    }}
                    accessibilityLabel={t('Remove work time {n}', { n: i + 1 })}>
                    <Icon name="trash" size={17} color={c.down} />
                  </Springy>
                ) : null}
              </Row>
              <Row style={{ marginTop: 8 }} gap={10}>
                {(['s', 'e'] as const).map((k) => (
                  <View key={k} style={{ flex: 1 }}>
                    <Text variant="xs" weight={700} color="sec">
                      {t(k === 's' ? 'Start' : 'End')}
                    </Text>
                    <View style={{ marginTop: 4 }}>
                      <TimeField
                        value={w[k]}
                        label={t(k === 's' ? 'Start' : 'End')}
                        onChange={(v) => set({ work: f.work.map((x, j) => (j === i ? { ...x, [k]: v } : x)) })}
                      />
                    </View>
                  </View>
                ))}
              </Row>
            </Card>
          ))}
          {f.work.length < 4 ? (
            <Button
              small
              kind="soft"
              icon="plus"
              title={t('Add another work time')}
              style={{ marginTop: 12, alignSelf: 'stretch' }}
              onPress={() => {
                const [h] = f.work[f.work.length - 1].e.split(':').map(Number);
                const p = (n: number) => `${String(Math.min(23, n)).padStart(2, '0')}:00`;
                set({ work: [...f.work, { s: p(h + 2), e: p(h + 5) }] });
              }}
            />
          ) : null}
          {f.work.length > 1 ? (
            <Card style={{ marginTop: 12, flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 0 }}>
              <View style={{ flex: 1 }}>
                <Text weight={700}>{t('Changes every week')}</Text>
                <Text variant="small" color="sec">
                  {t('Your hours switch from one week to the next')}
                </Text>
              </View>
              <Toggle value={!!f.rotate} onChange={(v) => set({ rotate: v })} label={t('Changes every week')} />
            </Card>
          ) : null}
          <Card style={{ marginTop: 12, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Icon name="sun" color={c.cobalt} />
            <Text weight={700} style={{ flex: 1 }}>
              {t('I work in the sun')}
            </Text>
            <Toggle value={f.sun} onChange={(v) => set({ sun: v })} label={t('I work in the sun')} />
          </Card>
          <Button
            title={t('Next')}
            style={{ marginTop: 12 }}
            onPress={() => {
              set({ noWork: false });
              next();
            }}
          />
          <Springy
            onPress={() => {
              set({ noWork: true, sun: false });
              next();
              toast(t('No problem. Meals are timed around a normal day.'), { icon: 'clock' });
            }}
            style={{ alignSelf: 'center', marginTop: 14, padding: 6 }}>
            <Text variant="small" weight={700} color="sec">
              {t('Skip, I don’t work')}
            </Text>
          </Springy>
        </View>
      ) : null}

      {step === 4 ? (
        <View>
          <Text variant="h1" style={{ marginTop: 4 }}>
            {t('Any food allergies?')}
          </Text>
          <Text color="sec" style={{ marginTop: 6 }}>
            {t('Pick all that apply. Your meal plan and the AI will leave them out.')}
          </Text>
          <AllergyPicker keys={f.allergies ?? []} note={f.allergyNote ?? ''} onChange={(allergies, allergyNote) => set({ allergies, allergyNote })} />
          <Button
            title={t('Next')}
            style={{ marginTop: 24 }}
            onPress={() => {
              // Answered (even "none"), so it isn't asked again.
              if (!f.allergies) set({ allergies: [] });
              next();
            }}
          />
        </View>
      ) : null}

      {step === 5 ? (
        <View>
          <Text variant="h1" style={{ marginTop: 4 }}>
            {t('Anything else about your day?')}
          </Text>
          <Card style={{ marginTop: 16, flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
            <Mark size={22} color={c.cobalt} stroke={4.5} />
            <Text variant="small" weight={700} style={{ flex: 1 }}>
              {t('The more details you add about your day and work, the more accurately the AI can help you.')}
            </Text>
          </Card>
          <TextInput
            value={f.notes}
            onChangeText={(v) => set({ notes: v.slice(0, 600) })}
            multiline
            numberOfLines={5}
            placeholder={t('For example: I work in the sun, carry heavy loads, and walk long distances.')}
            placeholderTextColor={c.sec}
            style={{ backgroundColor: c.card, borderRadius: 16, minHeight: 120, padding: 14, fontSize: 16, color: c.text, fontFamily: fontFor('manrope', 500), textAlignVertical: 'top', outlineStyle: 'none' } as object}
          />
          <Text variant="small" color="sec" style={{ marginTop: 8 }}>
            {t('Optional')}
          </Text>
          <Button title={t('Calculate my plan')} style={{ marginTop: 24 }} onPress={run} />
        </View>
      ) : null}
    </Screen>
  );
}
