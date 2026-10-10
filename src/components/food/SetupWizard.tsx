import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { TextInput, View } from 'react-native';

import { useT } from '@/i18n';
import { useFood } from '@/lib/food';
import { ACTIVITY, bodyFatList, calcPlan, type FoodPlan, GOAL_DESC, GOAL_ORDER, GOALS } from '@/lib/nutrition';
import { cleanNumber } from '@/lib/validation';
import { useSettings } from '@/theme/settings';

import { Icon, Mark } from '../Icon';
import { Screen } from '../Screen';
import { fontFor, Text } from '../Text';
import { useToast } from '../Toast';
import { Button, Card, ErrorText, Label, Option, ProgDots, Row, Springy, Toggle } from '../ui';
import { BodyFigure } from './BodyFigure';
import { Stepper } from './Stepper';
import { Thinking } from './Thinking';
import { TimeField } from './TimeField';

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** First time in Food: weight and activity, goal, body fat, work day, notes. */
export function SetupWizard({ inTab }: { inTab?: boolean }) {
  const { t } = useT();
  const { colors: c } = useSettings();
  const toast = useToast();
  const food = useFood();
  const [step, setStep] = useState(0);
  const [thinking, setThinking] = useState<string | null>(null);
  const f = food.draft ?? food.plan;
  const set = (patch: Partial<FoodPlan>) => food.setDraft({ ...f, ...patch });
  const [wText, setWText] = useState(String(f.weight));
  const [wErr, setWErr] = useState<string | null>(null);

  useEffect(() => {
    if (!food.draft) food.setDraft({ ...food.plan });
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
    const w = Math.round(Math.min(250, Math.max(30, f.weight + d)) * 10) / 10;
    set({ weight: w });
    setWText(String(w));
  };

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
      <ProgDots step={step} total={5} />
      <Text variant="small" weight={700} color="sec">
        {t('Step {n} of {total}', { n: step + 1, total: 5 })}
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
            <Stepper onMinus={() => stepWeight(-0.1)} onPlus={() => stepWeight(0.1)} labels={[t('Decrease'), t('Increase')]}>
              <TextInput
                value={wText}
                onChangeText={(v) => {
                  const s = cleanNumber(v, true);
                  setWText(s);
                  const n = parseFloat(s);
                  const ok = n >= 30 && n <= 250;
                  setWErr(s && !ok && s.replace('.', '').length >= 2 ? 'Enter a weight between 30 and 250 kg' : null);
                  if (ok) set({ weight: Math.round(n * 10) / 10 });
                }}
                onBlur={() => {
                  setWText(String(f.weight));
                  setWErr(null);
                }}
                inputMode="decimal"
                keyboardType="decimal-pad"
                accessibilityLabel={t('Weight in kg')}
                style={{ fontFamily: fontFor('sora', 600), fontSize: 44, letterSpacing: -1.7, color: c.text, textAlign: 'center', width: '100%', maxWidth: 180, borderBottomWidth: 2, borderStyle: 'dashed', borderColor: c.line, outlineStyle: 'none', direction: 'ltr' } as object}
              />
            </Stepper>
            <ErrorText>{wErr ? t(wErr) : null}</ErrorText>
            <Text variant="small" weight={700} color="sec" center style={{ marginTop: 4 }}>
              {t('kg')}
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
          {GOAL_ORDER.map((i) => (
            <Option key={i} icon={i < 2 ? 'up' : i === 2 ? 'minus' : 'down'} title={t(GOALS[i])} subtitle={t(GOAL_DESC[i])} selected={f.goal === i} onPress={() => set({ goal: i })} />
          ))}
          <Button title={t('Next')} style={{ marginTop: 24 }} onPress={next} />
        </View>
      ) : null}

      {step === 2 ? (
        <View>
          <Text variant="h1" style={{ marginTop: 4 }}>
            {t('Which body looks closest to yours?')}
          </Text>
          <Text color="sec" style={{ marginTop: 4, marginBottom: 16 }}>
            {t('Pick the closest one. It only needs to be roughly right.')}
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
                  style={{ width: '31%', flexGrow: 1, alignItems: 'center', backgroundColor: c.card, borderRadius: 22, paddingVertical: 12, borderWidth: 2, borderColor: on ? c.cobalt : 'transparent' }}>
                  <BodyFigure bf={b} female={food.person.gender === 'female'} selected={on} color={on ? c.cobalt : c.sec} />
                  <Text num color={on ? c.cobalt : c.text} style={{ marginTop: 4 }}>{`${b}%`}</Text>
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
