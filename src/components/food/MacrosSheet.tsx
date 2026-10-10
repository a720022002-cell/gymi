import { useState } from 'react';
import { TextInput, View } from 'react-native';

import { useT } from '@/i18n';
import { fmt, type Macros } from '@/lib/nutrition';
import { useSettings } from '@/theme/settings';

import { Icon } from '../Icon';
import { Sheet } from '../Sheet';
import { fontFor, Text } from '../Text';
import { Button, Segmented, Springy } from '../ui';

type M = { p: number; c: number; f: number };
const kcalOf = (m: M) => m.p * 4 + m.c * 4 + m.f * 9;

/** Edit macros in grams (calories follow) or percent (calories stay). Design: SH.macros. */
export function MacrosSheet({ open, onClose, initial, weight, onSave }: { open: boolean; onClose: () => void; initial: Macros; weight: number; onSave: (m: M) => void }) {
  const { t } = useT();
  const { colors: c } = useSettings();
  const [mode, setMode] = useState<'g' | '%'>('g');
  const [m, setM] = useState<M>({ p: initial.p, c: initial.c, f: initial.f });
  const [K, setK] = useState(initial.k);
  const [pc, setPc] = useState<M>({ p: 0, c: 0, f: 0 });

  // Reset to the current targets each time the sheet opens.
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setM({ p: initial.p, c: initial.c, f: initial.f });
      setMode('g');
    }
  }

  const toPct = (x: M, k: number): M => {
    const raw = { p: (x.p * 400) / k, c: (x.c * 400) / k, f: (x.f * 900) / k };
    const out = { p: Math.floor(raw.p), c: Math.floor(raw.c), f: Math.floor(raw.f) };
    let rest = 100 - out.p - out.c - out.f;
    ([...(['p', 'c', 'f'] as const)] as (keyof M)[]).sort((a, b) => raw[b] - Math.floor(raw[b]) - (raw[a] - Math.floor(raw[a]))).forEach((key) => {
      if (rest > 0) {
        out[key]++;
        rest--;
      }
    });
    return out;
  };

  const switchMode = (md: 'g' | '%') => {
    if (md === '%') {
      const k = kcalOf(m) || 1;
      setK(k);
      setPc(toPct(m, k));
    }
    setMode(md);
  };

  const setVal = (key: keyof M, v: number) => {
    v = Math.max(0, Math.round(v));
    if (mode === 'g') setM({ ...m, [key]: v });
    else {
      v = Math.min(100, v);
      const npc = { ...pc, [key]: v };
      setPc(npc);
      setM({ ...m, [key]: Math.round((K * v) / 100 / (key === 'f' ? 9 : 4)) });
    }
  };

  const k = kcalOf(m);
  const shown = mode === 'g' ? toPct(m, k || 1) : pc;
  const tot = pc.p + pc.c + pc.f;
  const warns: string[] = [];
  if (m.f < weight * 0.5) warns.push('Fat under 0.5 g per kg is very low. Some fat is needed for hormones and vitamins.');
  if (m.c < 50) warns.push('Under 50 g of carbs is a low-carb diet. Training may feel harder.');
  if (m.p < weight * 1.2) warns.push('Protein under 1.2 g per kg makes it hard to keep muscle.');
  if (k < 1200) warns.push('These calories are very low. Talk to a doctor before eating this little.');
  const blocked = mode === '%' && tot !== 100;

  const row = (key: keyof M, label: string) => (
    <View key={key} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 60, paddingHorizontal: 14, borderTopWidth: key === 'p' ? 0 : 1, borderTopColor: c.line }}>
      <View style={{ flex: 1 }}>
        <Text weight={700}>{t(label)}</Text>
        <Text variant="xs" color="sec">
          {mode === 'g' ? t('{n}% of calories', { n: shown[key] }) : `${m[key]} ${t('g')}`}
        </Text>
      </View>
      <Springy onPress={() => setVal(key, (mode === 'g' ? m[key] : pc[key]) - (mode === 'g' ? 5 : 1))} accessibilityLabel={t('Less {x}', { x: t(label) })} style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: c.inset, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name="minus" size={16} strokeWidth={2.2} />
      </Springy>
      <TextInput
        value={String(mode === 'g' ? m[key] : pc[key])}
        onChangeText={(v) => setVal(key, +v.replace(/[^\d]/g, '') || 0)}
        inputMode="numeric"
        keyboardType="number-pad"
        style={{ width: 64, height: 44, borderRadius: 12, backgroundColor: c.inset, textAlign: 'center', fontFamily: fontFor('sora', 600), fontSize: 16, color: c.text, outlineStyle: 'none' } as object}
      />
      <Text variant="small" weight={700} color="sec" style={{ width: 16 }}>
        {mode === 'g' ? t('g') : '%'}
      </Text>
      <Springy onPress={() => setVal(key, (mode === 'g' ? m[key] : pc[key]) + (mode === 'g' ? 5 : 1))} accessibilityLabel={t('More {x}', { x: t(label) })} style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: c.inset, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name="plus" size={16} strokeWidth={2.2} />
      </Springy>
    </View>
  );

  return (
    <Sheet open={open} onClose={onClose}>
      <Text variant="h2">{t('Edit macros')}</Text>
      <Text variant="small" color="sec" style={{ marginTop: 4 }}>
        {t(mode === 'g' ? 'Change the grams. Your daily calories update to match.' : 'Change the split. Your calories stay the same and the grams update.')}
      </Text>
      <View style={{ marginTop: 12 }}>
        <Segmented
          value={mode}
          options={[
            { value: 'g', label: t('Grams') },
            { value: '%', label: t('Percent') },
          ]}
          onChange={switchMode}
        />
      </View>
      <View style={{ marginTop: 12, backgroundColor: 'rgba(127,127,135,0.1)', borderRadius: 22, overflow: 'hidden' }}>
        {row('p', 'Protein')}
        {row('c', 'Carbs')}
        {row('f', 'Fat')}
      </View>
      <View style={{ marginTop: 12, backgroundColor: 'rgba(127,127,135,0.1)', borderRadius: 22, padding: 18, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text weight={700}>{t(mode === 'g' ? 'Daily calories' : 'Total')}</Text>
        <Text num size={22}>
          {mode === 'g' ? `${fmt(k)} ${t('kcal')}` : `${tot}%`}
        </Text>
      </View>
      {warns.map((w) => (
        <View key={w} style={{ marginTop: 8, backgroundColor: 'rgba(127,127,135,0.1)', borderRadius: 16, padding: 12, flexDirection: 'row', gap: 8, alignItems: 'flex-start' }}>
          <Icon name="warn" size={16} color={c.down} />
          <Text variant="small" style={{ flex: 1 }}>
            {t(w)}
          </Text>
        </View>
      ))}
      <Button title={blocked ? t('Total must be 100% (now {n}%)', { n: tot }) : t('Save')} disabled={blocked} style={{ marginTop: 12 }} onPress={() => onSave(m)} />
      <Button title={t('Cancel')} kind="ghost" style={{ marginTop: 8 }} onPress={onClose} />
    </Sheet>
  );
}
