import { useState } from 'react';
import { TextInput, View } from 'react-native';

import { Stepper } from '@/components/food/Stepper';
import { Icon, type IconName } from '@/components/Icon';
import { Bar, Ring } from '@/components/Ring';
import { DayNav } from '@/components/DayNav';
import { Screen } from '@/components/Screen';
import { fontFor, Text } from '@/components/Text';
import { useToast } from '@/components/Toast';
import { Button, Card, Chip, Row, Segmented, Springy } from '@/components/ui';
import { useT } from '@/i18n';
import { useAuth } from '@/lib/auth';
import { hrZone, useStepGoal } from '@/lib/devices';
import { useFood } from '@/lib/food';
import { fmt } from '@/lib/nutrition';
import { CARDIO, cardioKcal } from '@/lib/training';
import { useSettings } from '@/theme/settings';

const ICON: Record<string, IconName> = { Walk: 'walk', Run: 'run', Bike: 'bike', Swim: 'drop', Other: 'flame' };
const digitsOnly = (v: string, max: number) =>
  v
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .replace(/\D/g, '')
    .slice(0, max);

/** Log cardio; calories burned are added to today's budget (design: cardio). */

/** Steps today (from the watch, or typed in) against your own step goal. */
function StepsCard() {
  const { t } = useT();
  const { colors: c } = useSettings();
  const food = useFood();
  const { session } = useAuth();
  const STEP_GOAL = useStepGoal(session?.user.id);
  const [edit, setEdit] = useState(false);
  const [val, setVal] = useState('');
  return (
    <Card>
      <Row style={{ justifyContent: 'space-between' }}>
        <View>
          <Text variant="small" weight={700} color="sec">
            {t('Steps today')}
          </Text>
          <Text num size={30}>
            {fmt(food.steps)}
          </Text>
        </View>
        <Ring value={food.steps} max={STEP_GOAL} size={64} stroke={7}>
          <Icon name="walk" size={22} color={c.cobalt} />
        </Ring>
      </Row>
      <View style={{ marginTop: 12 }}>
        <Bar value={food.steps} max={STEP_GOAL} color={c.cobalt} />
      </View>
      {edit ? (
        <Row gap={8} style={{ marginTop: 12 }}>
          <TextInput
            value={val}
            onChangeText={(v) => setVal(v.replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))).replace(/\D/g, '').slice(0, 6))}
            autoFocus
            inputMode="numeric"
            keyboardType="number-pad"
            placeholder={String(food.steps)}
            placeholderTextColor={c.sec}
            accessibilityLabel={t('Steps today')}
            style={{ flex: 1, minWidth: 0, height: 44, borderRadius: 12, paddingHorizontal: 12, backgroundColor: c.inset, fontFamily: fontFor('sora', 600), fontSize: 18, color: c.text, outlineStyle: 'none' } as object}
          />
          <Button
            small
            title={t('Save')}
            onPress={() => {
              if (val) food.setSteps(+val);
              setEdit(false);
            }}
          />
        </Row>
      ) : (
        <Row style={{ justifyContent: 'space-between', marginTop: 8 }}>
          <Text variant="small" color="sec">
            {t('Goal {n}', { n: fmt(STEP_GOAL) })}
          </Text>
          <Row gap={16}>
            <Springy
              onPress={() => {
                setVal('');
                setEdit(true);
              }}>
              <Text variant="small" weight={700} color="link">
                {t('Type steps')}
              </Text>
            </Springy>
            <Springy onPress={() => food.setSteps(food.steps + 1000)}>
              <Text variant="small" weight={700} color="link">
                {t('+ 1,000 steps')}
              </Text>
            </Springy>
          </Row>
        </Row>
      )}
    </Card>
  );
}

export default function CardioScreen() {
  const { t } = useT();
  const { colors: c } = useSettings();
  const toast = useToast();
  const food = useFood();
  const { profile } = useAuth();
  // Heart rate zones use your age (30 when it isn't set).
  const [now] = useState(() => Date.now());
  const age = profile?.date_of_birth ? Math.max(14, Math.floor((now - new Date(profile.date_of_birth).getTime()) / 3.15576e10)) : 30;
  const [kind, setKind] = useState(0);
  const [mins, setMins] = useState(30);
  const [text, setText] = useState('30');
  const [inten, setInten] = useState(1);
  // "Other" (after the 4 types): you name it and type the calories yourself.
  const other = kind === CARDIO.length;
  const [otherName, setOtherName] = useState('');
  const [otherKcal, setOtherKcal] = useState('');
  const weight = Number(food.plan.weight || profile?.weight_kg || 80);
  const kcal = other ? Math.min(5000, +otherKcal || 0) : cardioKcal(kind, inten, weight, mins);

  const setM = (m: number) => {
    const v = Math.max(1, Math.min(600, m));
    setMins(v);
    setText(String(v));
  };

  return (
    <Screen title={t('Cardio and steps')} back>
      <DayNav />
      <StepsCard />
      <Text variant="small" weight={700} color="sec" style={{ marginTop: 8, marginBottom: 8, marginHorizontal: 4 }}>
        {t('Log cardio')}
      </Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        {[...CARDIO.map(([k]) => k), 'Other'].map((k, i) => (
          <Springy
            key={k}
            onPress={() => setKind(i)}
            scaleTo={0.97}
            accessibilityState={{ selected: kind === i }}
            style={{ width: '47%', flexGrow: 1, height: 56, borderRadius: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: kind === i ? c.text : c.card }}>
            <Icon name={ICON[k]} size={22} color={kind === i ? c.bg : c.text} />
            <Text weight={700} color={kind === i ? c.bg : c.text}>
              {t(k)}
            </Text>
          </Springy>
        ))}
      </View>
      <Card style={{ marginTop: 12 }}>
        <Text variant="small" weight={700} color="sec">
          {t('Minutes')}
        </Text>
        <View style={{ marginTop: 8 }}>
          <Stepper onMinus={() => setM(mins - 5)} onPlus={() => setM(mins + 5)} bg={c.inset} labels={[t('Less'), t('More')]}>
            <TextInput
              value={text}
              onChangeText={(v) => {
                const s = v.replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))).replace(/\D/g, '').slice(0, 3);
                setText(s);
                if (+s > 0) setMins(Math.min(600, +s));
              }}
              onBlur={() => setText(String(mins))}
              inputMode="numeric"
              keyboardType="number-pad"
              accessibilityLabel={t('Minutes')}
              style={{ width: 120, textAlign: 'center', fontFamily: fontFor('sora', 600), fontSize: 40, color: c.text, outlineStyle: 'none' } as object}
            />
          </Stepper>
        </View>
        <Row gap={8} style={{ marginTop: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
          {[15, 30, 45, 60].map((m) => (
            <Chip key={m} title={t('{n} min', { n: m })} on={mins === m} onPress={() => setM(m)} />
          ))}
        </Row>
      </Card>
      {other ? (
        <Card style={{ marginTop: 12 }}>
          <Text variant="small" weight={700} color="sec">
            {t('What did you do?')}
          </Text>
          <TextInput
            value={otherName}
            onChangeText={(v) => setOtherName(v.slice(0, 40))}
            placeholder={t('For example: football, padel, boxing')}
            placeholderTextColor={c.sec}
            accessibilityLabel={t('What did you do?')}
            style={{ marginTop: 8, height: 48, borderRadius: 14, paddingHorizontal: 14, backgroundColor: c.inset, fontSize: 16, color: c.text, outlineStyle: 'none' } as object}
          />
          <Text variant="small" weight={700} color="sec" style={{ marginTop: 14 }}>
            {t('Calories burned')}
          </Text>
          <Row gap={10} style={{ marginTop: 8 }}>
            <TextInput
              value={otherKcal}
              onChangeText={(v) => setOtherKcal(digitsOnly(v, 4))}
              inputMode="numeric"
              keyboardType="number-pad"
              placeholder="0"
              placeholderTextColor={c.sec}
              accessibilityLabel={t('Calories burned')}
              style={{ flex: 1, minWidth: 0, height: 56, borderRadius: 14, paddingHorizontal: 14, backgroundColor: c.inset, fontFamily: fontFor('sora', 600), fontSize: 28, color: c.text, textAlign: 'center', outlineStyle: 'none' } as object}
            />
            <Text weight={700} color="sec">
              {t('kcal')}
            </Text>
          </Row>
          <Text variant="xs" color="sec" style={{ marginTop: 8 }}>
            {t('Use the number from your watch or the machine.')}
          </Text>
        </Card>
      ) : (
        <>
          <Segmented
            value={String(inten)}
            options={[
              { value: '0', label: t('Easy') },
              { value: '1', label: t('Moderate') },
              { value: '2', label: t('Hard') },
            ]}
            onChange={(v) => setInten(+v)}
          />
          <Card style={{ marginTop: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text weight={700}>{t('Calories burned')}</Text>
            <Text num size={24} color="cobalt">{`${fmt(kcal)} ${t('kcal')}`}</Text>
          </Card>
        </>
      )}
      <Text variant="small" color="sec" style={{ marginHorizontal: 4 }}>
        {t('This is added to today’s budget, so you can eat a little more.')}
      </Text>
      <Button
        title={other ? t('Add activity') : t('Add {x}', { x: t(CARDIO[kind][0]).toLowerCase() })}
        disabled={other && !(kcal > 0)}
        style={{ marginTop: 16 }}
        onPress={async () => {
          const row = await food.addCardio(other ? { kind: 'Other', name: otherName.trim() || null, minutes: mins, intensity: 1, kcal } : { kind: CARDIO[kind][0], minutes: mins, intensity: inten, kcal });
          if (!row) return toast(t('Couldn’t save. Please try again.'), { icon: 'warn' });
          const walked = row.kind === 'Walk' ? row.minutes * 110 : 0;
          if (walked) food.addSteps(walked);
          toast(t('Added {x}: +{n} kcal to today', { x: row.name || t(row.kind).toLowerCase(), n: row.kcal }), {
            icon: 'flame',
            undo: () => {
              food.deleteCardio(row.id);
              if (walked) food.addSteps(-walked);
            },
          });
        }}
      />

      {food.cardio.length ? (
        <View>
          <Text variant="small" weight={700} color="sec" style={{ marginTop: 20, marginBottom: 8, marginHorizontal: 4 }}>
            {t('Today')}
          </Text>
          <View style={{ backgroundColor: c.card, borderRadius: 22, overflow: 'hidden' }}>
            {food.cardio.map((x, i) => (
              <Row key={x.id} gap={12} style={{ minHeight: 56, paddingHorizontal: 16, borderTopWidth: i ? 1 : 0, borderTopColor: c.line }}>
                <Icon name={ICON[x.kind]} size={18} />
                <View style={{ flex: 1 }}>
                  <Text weight={700}>{x.name || t(x.kind)}</Text>
                  <Text variant="small" color="sec">
                    {x.watch ? t('{n} min · from your watch', { n: x.minutes }) : t('{n} min', { n: x.minutes })}
                    {x.avg_hr ? ` · ${t('Zone {z} · {h} bpm', { z: hrZone(x.avg_hr, age), h: x.avg_hr })}` : ''}
                  </Text>
                </View>
                <Text num>{`${x.kcal} ${t('kcal')}`}</Text>
                {x.watch ? (
                  <View style={{ width: 36, height: 36, alignItems: 'center', justifyContent: 'center' }}>
                    <Icon name="watch" size={16} color={c.sec} />
                  </View>
                ) : (
                  <Springy onPress={() => food.deleteCardio(x.id)} accessibilityLabel={t('Delete')} style={{ width: 36, height: 36, alignItems: 'center', justifyContent: 'center' }}>
                    <Icon name="trash" size={16} color={c.sec} />
                  </Springy>
                )}
              </Row>
            ))}
          </View>
        </View>
      ) : null}
      {food.moveKcal > 0 ? (
        <Text variant="small" color="sec" style={{ marginTop: 10, marginHorizontal: 4 }}>
          {t('Your watch shows you moved more than usual today: +{n} kcal added to today’s calories.', { n: food.moveKcal })}
        </Text>
      ) : null}
    </Screen>
  );
}
