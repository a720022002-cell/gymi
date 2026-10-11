import { useState } from 'react';
import { TextInput, View } from 'react-native';

import { useT } from '@/i18n';
import { fmt } from '@/lib/nutrition';
import { fx } from '@/lib/progress';
import { useSettings } from '@/theme/settings';

import { Icon } from '../Icon';
import { Sheet } from '../Sheet';
import { fontFor, Text } from '../Text';
import { Button, Card, Chip, ErrorText, Row, Springy } from '../ui';

const toNum = (s: string) => Number(s.replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))).replace(/\D/g, '')) || 0;

/** Daily water goal: suggested value, presets, typed input, 1,000 to 6,000 ml (design: SH.watergoal). */
export function WaterGoalSheet({ open, onClose, value, suggested, onSave }: { open: boolean; onClose: () => void; value: number; suggested: number; onSave: (ml: number) => void }) {
  return <Sheet open={open} onClose={onClose}>{open ? <Body value={value} suggested={suggested} onSave={onSave} /> : null}</Sheet>;
}

function Body({ value, suggested, onSave }: { value: number; suggested: number; onSave: (ml: number) => void }) {
  const { t } = useT();
  const { colors: c } = useSettings();
  const [v, setV] = useState(value || suggested);
  const ok = v >= 1000 && v <= 6000;
  const step = (d: number) => setV(Math.min(8000, Math.max(500, Math.round((v + d) / 100) * 100)));
  return (
    <View>
      <Text variant="h2">{t('Daily water goal')}</Text>
      <Text variant="small" color="sec" style={{ marginTop: 4 }}>
        {t('Suggested for you: {n} L, based on your weight and activity.', { n: fx(suggested / 1000) })}
      </Text>
      <Card style={{ marginTop: 12, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <Springy onPress={() => step(-100)} accessibilityLabel={t('Less')} style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: c.inset, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="minus" size={20} strokeWidth={2.2} />
        </Springy>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <TextInput
            value={v ? String(v) : ''}
            onChangeText={(s) => setV(Math.min(99999, toNum(s)))}
            inputMode="numeric"
            keyboardType="number-pad"
            accessibilityLabel={t('Water goal in ml')}
            style={{ width: '100%', maxWidth: 170, textAlign: 'center', fontFamily: fontFor('sora', 600), fontSize: 34, color: c.text, borderBottomWidth: 2, borderBottomColor: c.line, borderStyle: 'dashed', paddingVertical: 2, outlineStyle: 'none' } as object}
          />
          <Text variant="xs" weight={700} color="sec" style={{ marginTop: 4 }}>
            {t('ml a day')}
          </Text>
        </View>
        <Springy onPress={() => step(100)} accessibilityLabel={t('More')} style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: c.inset, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="plus" size={20} strokeWidth={2.2} />
        </Springy>
      </Card>
      <Row gap={8} style={{ flexWrap: 'wrap' }}>
        {[2000, 2500, 3000, 3500, 4000].map((x) => (
          <Chip key={x} title={t('{n} L', { n: fx(x / 1000) })} on={v === x} onPress={() => setV(x)} />
        ))}
      </Row>
      <ErrorText>{ok || !v ? null : t('Pick a goal between 1,000 and 6,000 ml.')}</ErrorText>
      {v !== suggested ? (
        <Springy onPress={() => setV(suggested)} style={{ marginTop: 12, alignSelf: 'flex-start' }}>
          <Text variant="small" weight={700} color="link">
            {t('Use suggested ({n} L)', { n: fx(suggested / 1000) })}
          </Text>
        </Springy>
      ) : null}
      <Button title={ok ? t('Save {n} ml', { n: fmt(v) }) : t('Save')} disabled={!ok} style={{ marginTop: 16 }} onPress={() => onSave(v)} />
    </View>
  );
}
