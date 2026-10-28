import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, View } from 'react-native';

import { Icon } from '@/components/Icon';
import { Screen } from '@/components/Screen';
import { BroArt } from '@/components/social/GymBro';
import { Text } from '@/components/Text';
import { useToast } from '@/components/Toast';
import { Button, Card, Chip, Row, Springy } from '@/components/ui';
import { useT } from '@/i18n';
import { useAuth } from '@/lib/auth';
import {
  BEARDS,
  BOTTOMS_F,
  BOTTOMS_M,
  BROWS,
  buildOf,
  cleanLook,
  CLOTH,
  EYE_COLORS,
  GLASSES,
  HAIR_COLORS,
  HAIR_F,
  HAIR_M,
  HATS_F,
  HATS_M,
  type Look,
  SKIN,
  TOPS_F,
  TOPS_M,
} from '@/lib/avatar';
import { BRO_LEVELS, broLevel, cachedLook, loadMyLook, saveMyLook } from '@/lib/bro';
import { useStreaks } from '@/lib/useProgress';
import { useSettings } from '@/theme/settings';

const PARTS = ['Skin', 'Hair', 'Face', 'Headwear', 'Top', 'Bottom', 'Shoes'] as const;
type Part = (typeof PARTS)[number];

/** Round colour choices. */
function Swatches({ colors, value, onPick, label }: { colors: string[]; value: number; onPick: (i: number) => void; label: string }) {
  const { colors: c } = useSettings();
  return (
    <Row gap={10} style={{ flexWrap: 'wrap', marginTop: 8 }}>
      {colors.map((col, i) => (
        <Springy
          key={col}
          onPress={() => onPick(i)}
          accessibilityRole="button"
          accessibilityState={{ selected: value === i }}
          accessibilityLabel={`${label} ${i + 1}`}
          style={{ width: 38, height: 38, borderRadius: 19, borderWidth: value === i ? 3 : 1, borderColor: value === i ? c.cobalt : c.line, padding: 3 }}>
          <View style={{ flex: 1, borderRadius: 16, backgroundColor: col }} />
        </Springy>
      ))}
    </Row>
  );
}

/**
 * Dress your Gym Bros character (design: Bitmoji-like): skin, hair, face, headwear and clothes. The build isn't
 * chosen: it follows your 30-day commitment (you can preview the levels here).
 */
export default function BroEdit() {
  const { t } = useT();
  const { colors: c } = useSettings();
  const toast = useToast();
  const { session, profile } = useAuth();
  const uid = session?.user.id;
  const female = profile?.gender === 'female';
  const pct = useStreaks().c30.pct;
  const lvl = broLevel(pct) || 1;
  const [look, setLook] = useState<Look>(() => cleanLook(cachedLook(uid), female));
  const [part, setPart] = useState<Part>('Hair');
  const [preview, setPreview] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!uid || cachedLook(uid)) return;
    let alive = true;
    loadMyLook(uid).then((l) => alive && l && setLook(cleanLook(l, female)));
    return () => {
      alive = false;
    };
  }, [uid, female]);

  const set = (patch: Partial<Look>) => setLook((l) => cleanLook({ ...l, ...patch }, l.body === 'f'));
  const f = look.body === 'f';
  const chips = (list: [string, string][], key: keyof Look) => (
    <Row gap={8} style={{ flexWrap: 'wrap', marginTop: 8 }}>
      {list.map(([id, name]) => (
        <Chip key={id} title={t(name)} on={look[key] === id} onPress={() => set({ [key]: id } as Partial<Look>)} />
      ))}
    </Row>
  );
  const head = (s: string) => (
    <Text variant="small" weight={700} color="sec" style={{ marginTop: 14 }}>
      {t(s)}
    </Text>
  );

  const save = async () => {
    if (!uid || busy) return;
    setBusy(true);
    const ok = await saveMyLook(uid, look);
    setBusy(false);
    if (!ok) return toast(t('Couldn’t save. Please try again.'), { icon: 'warn' });
    toast(t('Saved. Your friends see your new look.'), { icon: 'check' });
    router.back();
  };

  const shown = preview ?? lvl;
  return (
    <Screen title={t('Your character')} back>
      <Card style={{ alignItems: 'center', paddingVertical: 16 }}>
        <BroArt look={look} build={buildOf(shown)} height={290} />
        <Text variant="small" weight={700} color={c.cobalt} style={{ marginTop: 6 }}>
          {t('Level {n}: {l}', { n: shown, l: t(BRO_LEVELS[shown - 1]) })}
        </Text>
        <Text variant="xs" color="sec" center style={{ marginTop: 2, paddingHorizontal: 12 }}>
          {preview == null ? t('Your build follows your 30-day commitment. Stay committed and it gets stronger.') : t('A preview. Your real build follows your commitment.')}
        </Text>
        <Row gap={6} style={{ marginTop: 10 }}>
          {[1, 2, 3, 4, 5].map((n) => (
            <Springy
              key={n}
              onPress={() => setPreview(n === lvl ? null : n)}
              accessibilityRole="button"
              accessibilityLabel={t('Level {n}: {l}', { n, l: t(BRO_LEVELS[n - 1]) })}
              style={{ width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: n === shown ? c.cobalt : c.inset }}>
              <Text variant="small" weight={700} color={n === shown ? '#FFFFFF' : 'sec'}>
                {n}
              </Text>
            </Springy>
          ))}
        </Row>
      </Card>

      <Row gap={8} style={{ marginTop: 8 }}>
        <Chip title={t('Man')} on={!f} onPress={() => f && setLook((l) => cleanLook({ ...l, body: 'm' }, false))} />
        <Chip title={t('Woman')} on={f} onPress={() => !f && setLook((l) => cleanLook({ ...l, body: 'f' }, true))} />
      </Row>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 14, marginHorizontal: -16 }} contentContainerStyle={{ gap: 8, paddingHorizontal: 16 }}>
        {PARTS.map((p) => (
          <Chip key={p} title={t(p)} on={part === p} onPress={() => setPart(p)} />
        ))}
      </ScrollView>

      <Card style={{ marginTop: 12 }}>
        {part === 'Skin' ? (
          <>
            {head('Skin tone')}
            <Swatches colors={SKIN} value={look.skin} onPick={(i) => set({ skin: i })} label={t('Skin tone')} />
          </>
        ) : part === 'Hair' ? (
          <>
            {head('Style')}
            {chips(f ? HAIR_F : HAIR_M, 'hair')}
            {head('Hair color')}
            <Swatches colors={HAIR_COLORS} value={look.hairColor} onPick={(i) => set({ hairColor: i })} label={t('Hair color')} />
          </>
        ) : part === 'Face' ? (
          <>
            {head('Eyebrows')}
            {chips(BROWS, 'brows')}
            {head('Eye color')}
            <Swatches colors={EYE_COLORS} value={look.eyes} onPick={(i) => set({ eyes: i })} label={t('Eye color')} />
            {f ? null : head('Beard')}
            {f ? null : chips(BEARDS, 'beard')}
            {head('Glasses')}
            {chips(GLASSES, 'glasses')}
          </>
        ) : part === 'Headwear' ? (
          <>
            {chips(f ? HATS_F : HATS_M, 'hat')}
            {look.hat !== 'none' && look.hat !== 'shemagh' ? (
              <>
                {head('Color')}
                <Swatches colors={CLOTH} value={look.hatColor} onPick={(i) => set({ hatColor: i })} label={t('Color')} />
              </>
            ) : null}
          </>
        ) : part === 'Top' ? (
          <>
            {chips(f ? TOPS_F : TOPS_M, 'top')}
            {look.top !== 'none' ? (
              <>
                {head('Color')}
                <Swatches colors={CLOTH} value={look.topColor} onPick={(i) => set({ topColor: i })} label={t('Color')} />
              </>
            ) : null}
          </>
        ) : part === 'Bottom' ? (
          <>
            {chips(f ? BOTTOMS_F : BOTTOMS_M, 'bottom')}
            {head('Color')}
            <Swatches colors={CLOTH} value={look.bottomColor} onPick={(i) => set({ bottomColor: i })} label={t('Color')} />
          </>
        ) : (
          <>
            {head('Sneakers')}
            <Swatches colors={CLOTH} value={look.shoes} onPick={(i) => set({ shoes: i })} label={t('Color')} />
          </>
        )}
      </Card>

      <Button title={t('Save')} icon="check" loading={busy} style={{ marginTop: 16 }} onPress={save} />
      <Row gap={6} style={{ marginTop: 10, marginHorizontal: 4, alignItems: 'flex-start' }}>
        <Icon name="info" size={14} color={c.sec} />
        <Text variant="xs" color="sec" style={{ flex: 1 }}>
          {t('Friends and group members see your character. Its build shows your commitment only if you share your streak.')}
        </Text>
      </Row>
    </Screen>
  );
}
