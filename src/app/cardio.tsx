import { useState } from 'react';
import { TextInput, View } from 'react-native';

import { Stepper } from '@/components/food/Stepper';
import { Icon, type IconName } from '@/components/Icon';
import { Screen } from '@/components/Screen';
import { fontFor, Text } from '@/components/Text';
import { useToast } from '@/components/Toast';
import { Button, Card, Chip, Row, Segmented, Springy } from '@/components/ui';
import { useT } from '@/i18n';
import { useAuth } from '@/lib/auth';
import { useFood } from '@/lib/food';
import { fmt } from '@/lib/nutrition';
import { CARDIO, cardioKcal } from '@/lib/training';
import { useSettings } from '@/theme/settings';

const ICON: Record<string, IconName> = { Walk: 'walk', Run: 'run', Bike: 'bike', Swim: 'drop' };

/** Log cardio; calories burned are added to today's budget (design: cardio). */
export default function CardioScreen() {
  const { t } = useT();
  const { colors: c } = useSettings();
  const toast = useToast();
  const food = useFood();
  const { profile } = useAuth();
  const [kind, setKind] = useState(0);
  const [mins, setMins] = useState(30);
  const [text, setText] = useState('30');
  const [inten, setInten] = useState(1);
  const weight = Number(food.plan.weight || profile?.weight_kg || 80);
  const kcal = cardioKcal(kind, inten, weight, mins);

  const setM = (m: number) => {
    const v = Math.max(1, Math.min(600, m));
    setMins(v);
    setText(String(v));
  };

  return (
    <Screen title={t('Cardio')} back>
      <Text variant="small" weight={700} color="sec" style={{ marginBottom: 8, marginHorizontal: 4 }}>
        {t('Log cardio')}
      </Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        {CARDIO.map(([k], i) => (
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
      <Text variant="small" color="sec" style={{ marginHorizontal: 4 }}>
        {t('This is added to today’s budget, so you can eat a little more.')}
      </Text>
      <Button
        title={t('Add {x}', { x: t(CARDIO[kind][0]).toLowerCase() })}
        style={{ marginTop: 16 }}
        onPress={async () => {
          const row = await food.addCardio({ kind: CARDIO[kind][0], minutes: mins, intensity: inten, kcal });
          if (!row) return toast(t('Couldn’t save. Please try again.'), { icon: 'warn' });
          toast(t('Added {x}: +{n} kcal to today', { x: t(row.kind).toLowerCase(), n: row.kcal }), { icon: 'flame', undo: () => food.deleteCardio(row.id) });
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
                  <Text weight={700}>{t(x.kind)}</Text>
                  <Text variant="small" color="sec">
                    {t('{n} min', { n: x.minutes })}
                  </Text>
                </View>
                <Text num>{`${x.kcal} ${t('kcal')}`}</Text>
                <Springy onPress={() => food.deleteCardio(x.id)} accessibilityLabel={t('Delete')} style={{ width: 36, height: 36, alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name="trash" size={16} color={c.sec} />
                </Springy>
              </Row>
            ))}
          </View>
        </View>
      ) : null}
    </Screen>
  );
}
