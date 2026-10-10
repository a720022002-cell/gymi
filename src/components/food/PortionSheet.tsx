import { useState } from 'react';
import { TextInput, View } from 'react-native';

import { useT } from '@/i18n';
import { useLogFood } from '@/lib/food';
import { type DbFood, foodName, forGrams, type Part, partsTotal, servingLabel } from '@/lib/foodsDb';
import { fmt } from '@/lib/nutrition';
import { useSettings } from '@/theme/settings';

import { Icon } from '../Icon';
import { Sheet } from '../Sheet';
import { fontFor, Text } from '../Text';
import { useToast } from '../Toast';
import { Button, Chip, Row, Springy } from '../ui';
import { WarnChip } from './Chips';

/** Set how much you ate, then log it (design: SH.portion). Dishes show each part's grams. */
export function PortionSheet({ food: f, onClose, onLogged }: { food: DbFood | null; onClose: () => void; onLogged?: () => void }) {
  const { t, lang } = useT();
  const { colors: c } = useSettings();
  const toast = useToast();
  const logFood = useLogFood();
  const [g, setG] = useState(100);
  const [parts, setParts] = useState<Part[] | null>(null);

  // Start from one serving each time a new food opens.
  const [prev, setPrev] = useState<DbFood | null>(null);
  if (f && f !== prev) {
    setPrev(f);
    setG(Math.round(f.serving_g));
    setParts(f.parts ? f.parts.map((x) => ({ ...x })) : null);
  }

  if (!f) return <Sheet open={false} onClose={onClose} />;
  const tot = parts ? partsTotal(parts) : { ...forGrams(f, g), g };
  const partName = (x: Part) => (lang === 'ar' ? x.ar : x.en);

  const setPart = (idx: number, v: number) => {
    v = Math.max(0, Math.min(3000, Math.round(v)));
    if (!parts) return setG(v);
    if (idx < 0) {
      const cur = partsTotal(parts).g || 1;
      setParts(parts.map((x) => ({ ...x, g: (x.g * v) / cur })));
    } else setParts(parts.map((x, i) => (i === idx ? { ...x, g: v } : x)));
  };
  const step = (idx: number, d: number) => {
    const s = idx < 0 ? (parts ? 50 : f.serving_g >= 150 ? 25 : 10) : 25;
    const cur = idx < 0 ? (parts ? partsTotal(parts).g : g) : parts![idx].g;
    setPart(idx, Math.max(0, Math.round((cur + d * s) / s) * s));
  };

  const row = (label: string, sub: string, val: number, idx: number, unit: string) => (
    <View key={`${label}-${idx}`} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 60, paddingHorizontal: 14, borderTopWidth: idx === (parts ? 0 : -1) ? 0 : 1, borderTopColor: c.line }}>
      <View style={{ flex: 1 }}>
        <Text weight={700}>{label}</Text>
        {sub ? (
          <Text variant="xs" color="sec">
            {sub}
          </Text>
        ) : null}
      </View>
      <Springy onPress={() => step(idx, -1)} accessibilityLabel={t('Less')} style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(127,127,135,0.12)', alignItems: 'center', justifyContent: 'center' }}>
        <Icon name="minus" size={18} strokeWidth={2.2} />
      </Springy>
      <TextInput
        value={String(Math.round(val))}
        onChangeText={(v) => setPart(idx, +v.replace(/[^\d]/g, '') || 0)}
        inputMode="numeric"
        keyboardType="number-pad"
        style={{ width: 70, height: 44, borderRadius: 12, backgroundColor: 'rgba(127,127,135,0.12)', textAlign: 'center', fontFamily: fontFor('sora', 600), fontSize: 17, color: c.text, outlineStyle: 'none' } as object}
      />
      <Text variant="small" weight={700} color="sec" style={{ width: 22 }}>
        {t(unit)}
      </Text>
      <Springy onPress={() => step(idx, 1)} accessibilityLabel={t('More')} style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(127,127,135,0.12)', alignItems: 'center', justifyContent: 'center' }}>
        <Icon name="plus" size={18} strokeWidth={2.2} />
      </Springy>
    </View>
  );

  const add = async () => {
    if (tot.g <= 0) return;
    const nm = foodName(f, lang);
    const name = parts
      ? `${nm} (${parts.filter((x) => x.g > 0).map((x) => `${partName(x).toLowerCase()} ${Math.round(x.g)} ${t('g')}`).join(', ')})`
      : `${nm}, ${Math.round(g)} ${t(f.unit)}`;
    onClose();
    const sugarHigh = f.sugar_high || ('sugar' in tot && (tot as { sugar: number }).sugar >= 15);
    await logFood({ name, kcal: tot.k, protein: tot.p, carbs: tot.c, fat: tot.f, sugar_high: sugarHigh, fat_high: f.fat_high, food_id: f.id }, toast, t);
    onLogged?.();
  };

  return (
    <Sheet open={!!f} onClose={onClose}>
      <Text variant="h2">{foodName(f, lang)}</Text>
      <Text variant="small" color="sec">
        {[f.restaurant, t(parts ? 'Set the grams of each part to match your plate' : 'Set how much you ate')].filter(Boolean).join(', ')}
      </Text>
      {f.sugar_high || f.fat_high || f.is_estimate ? (
        <Row gap={4} style={{ marginTop: 8, flexWrap: 'wrap' }}>
          {f.sugar_high ? <WarnChip label={t('High added sugar')} /> : null}
          {f.fat_high ? <WarnChip label={t('High fat')} /> : null}
          {f.is_estimate ? (
            <View style={{ height: 26, paddingHorizontal: 10, borderRadius: 13, backgroundColor: 'rgba(127,127,135,0.12)', justifyContent: 'center' }}>
              <Text variant="xs" weight={700} color="sec">
                {t('Estimate')}
              </Text>
            </View>
          ) : null}
        </Row>
      ) : null}
      <View style={{ marginTop: 16, backgroundColor: 'rgba(127,127,135,0.1)', borderRadius: 22, padding: 18, alignItems: 'center' }}>
        <Text num size={44} style={{ letterSpacing: -1.7, lineHeight: 48 }}>
          {fmt(tot.k)}
        </Text>
        <Text variant="small" weight={700} color="sec">
          {t('kcal')}
        </Text>
        <Row style={{ marginTop: 12, alignSelf: 'stretch', justifyContent: 'space-around' }}>
          {(
            [
              ['Protein', tot.p],
              ['Carbs', tot.c],
              ['Fat', tot.f],
            ] as const
          ).map(([a, v]) => (
            <View key={a} style={{ alignItems: 'center' }}>
              <Text num>{`${Math.round(v)} ${t('g')}`}</Text>
              <Text variant="xs" weight={700} color="sec">
                {t(a)}
              </Text>
            </View>
          ))}
        </Row>
      </View>
      {parts ? (
        <View>
          <Text variant="small" weight={700} color="sec" style={{ marginTop: 12, marginBottom: 8, marginHorizontal: 4 }}>
            {t('What’s in it')}
          </Text>
          <View style={{ backgroundColor: 'rgba(127,127,135,0.1)', borderRadius: 22, overflow: 'hidden' }}>
            {parts.map((x, j) => row(partName(x), t('{k} kcal, {p} g protein', { k: fmt((x.k * x.g) / 100), p: Math.round((x.p * x.g) / 100) }), x.g, j, 'g'))}
            {row(t('Total weight'), t('Change it to scale every part'), tot.g, -1, 'g')}
          </View>
        </View>
      ) : (
        <View>
          <View style={{ marginTop: 12, backgroundColor: 'rgba(127,127,135,0.1)', borderRadius: 22, overflow: 'hidden' }}>{row(t('Amount'), '', g, -1, f.unit)}</View>
          <Row gap={8} style={{ marginTop: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
            {[0.5, 1, 1.5, 2].map((m) => (
              <Chip key={m} title={`${Math.round(f.serving_g * m)} ${t(f.unit)}`} on={Math.round(g) === Math.round(f.serving_g * m)} onPress={() => setG(Math.round(f.serving_g * m))} />
            ))}
          </Row>
        </View>
      )}
      <Row gap={6} style={{ marginTop: 12, alignItems: 'flex-start' }}>
        <Icon name="info" size={16} color={c.sec} />
        <Text variant="small" color="sec" style={{ flex: 1 }}>
          {parts ? t('Tip: weigh the meat and the rice separately, cooked, for the most accurate number.') : t('One serving is {s}.', { s: servingLabel(f, lang) })}
        </Text>
      </Row>
      <Button title={t('Add {n} kcal', { n: fmt(tot.k) })} disabled={tot.g <= 0} style={{ marginTop: 16 }} onPress={add} />
    </Sheet>
  );
}
