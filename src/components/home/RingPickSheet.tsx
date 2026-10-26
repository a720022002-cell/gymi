import { Pressable, View } from 'react-native';

import { DAY_RINGS, RCOL } from '@/components/home/metrics';
import { Icon } from '@/components/Icon';
import { Sheet } from '@/components/Sheet';
import { Text } from '@/components/Text';
import { useToast } from '@/components/Toast';
import { Button } from '@/components/ui';
import { useT } from '@/i18n';
import { useFood } from '@/lib/food';
import { RING_INFO, RING_NAMES, RINGS, type RingKey, useHomeLayout } from '@/lib/homeLayout';
import { useSettings } from '@/theme/settings';

/** "Your rings": pick up to 3, change the order, remove (design: SH.ringpick). */
export function RingPickSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useT();
  const { colors: c } = useSettings();
  const toast = useToast();
  const [l, save] = useHomeLayout();
  // Your rings are the same every day, but an earlier day can't show Recovery or Commitment (they're about today).
  const past = !useFood().isToday;
  const todayOnly = (k: RingKey) => past && !DAY_RINGS.includes(k);
  const sel = l.rings;
  const cols = RCOL(c);
  const rest = RINGS.filter((k) => !sel.includes(k));
  const set = (rings: RingKey[]) => save({ ...l, rings });
  const tog = (k: RingKey) => {
    if (sel.includes(k)) {
      if (sel.length === 1) return toast(t('Keep at least one ring'), { icon: 'info' });
      return set(sel.filter((x) => x !== k));
    }
    if (sel.length >= 3) return toast(t('You can show 3 rings. Remove one first.'), { icon: 'info' });
    set([...sel, k]);
    if (todayOnly(k)) toast(t('Added. It shows on today’s Home.'), { icon: 'check' });
  };
  const up = (i: number) => {
    if (!i) return;
    const a = [...sel];
    [a[i - 1], a[i]] = [a[i], a[i - 1]];
    set(a);
  };
  return (
    <Sheet open={open} onClose={onClose}>
      <Text variant="h2">{t('Your rings')}</Text>
      <Text variant="small" weight={700} style={{ marginTop: 8 }}>
        {t('{n} of 3 picked', { n: sel.length })}
      </Text>
      <Text variant="xs" color="sec" style={{ marginTop: 2, marginBottom: 12 }}>
        {sel.length === 1 ? t('One ring shows big on Home.') : t('They show inside each other. Number 1 is the outside ring.')}
      </Text>
      {past ? (
        <Text variant="xs" color="sec" style={{ marginTop: -6, marginBottom: 12 }}>
          {t('This is an earlier day, so Recovery and Commitment only show on today’s Home.')}
        </Text>
      ) : null}
      <View style={{ backgroundColor: c.card, borderRadius: 22, overflow: 'hidden', marginBottom: 12 }}>
        {[0, 1, 2].map((i) => {
          const k = sel[i];
          if (!k)
            return (
              <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 52, paddingHorizontal: 16, opacity: 0.7 }}>
                <View style={{ width: 26, height: 26, borderRadius: 13, borderWidth: 2, borderStyle: 'dashed', borderColor: c.line, alignItems: 'center', justifyContent: 'center' }}>
                  <Text variant="xs" weight={700} color="sec">{`${i + 1}`}</Text>
                </View>
                <Text variant="small" color="sec">
                  {i === sel.length ? t('Empty. Pick one below to add it.') : t('Empty')}
                </Text>
              </View>
            );
          return (
            <View key={k} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 52, paddingHorizontal: 16 }}>
              <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: cols[i], alignItems: 'center', justifyContent: 'center' }}>
                <Text variant="xs" weight={700} color="#FFFFFF">{`${i + 1}`}</Text>
              </View>
              <Icon name={RING_INFO[k].icon} size={16} />
              <View style={{ flex: 1 }}>
                <Text weight={700}>{t(RING_NAMES[k])}</Text>
                {todayOnly(k) ? (
                  <Text variant="xs" color="sec">
                    {t('Shows on today only')}
                  </Text>
                ) : null}
              </View>
              <Pressable onPress={() => up(i)} disabled={!i} accessibilityLabel={t('Move up')} style={{ width: 32, height: 32, alignItems: 'center', justifyContent: 'center', opacity: i ? 1 : 0.3 }}>
                <Icon name="up" size={14} strokeWidth={2.2} />
              </Pressable>
              <Pressable onPress={() => tog(k)} disabled={sel.length < 2} accessibilityLabel={t('Remove {x}', { x: t(RING_NAMES[k]) })} style={{ width: 32, height: 32, alignItems: 'center', justifyContent: 'center', opacity: sel.length > 1 ? 1 : 0.3 }}>
                <Icon name="close" size={14} color={c.sec} strokeWidth={2.2} />
              </Pressable>
            </View>
          );
        })}
      </View>
      <Text variant="small" weight={700} color="sec" style={{ marginBottom: 8, marginHorizontal: 4 }}>
        {sel.length < 3 ? t('Add a ring') : t('All 3 picked. Remove one to add another.')}
      </Text>
      <View style={{ backgroundColor: c.card, borderRadius: 22, overflow: 'hidden', marginBottom: 12 }}>
        {rest.map((k) => (
          <Pressable key={k} onPress={() => tog(k)} disabled={sel.length >= 3} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56, paddingHorizontal: 16, paddingVertical: 8, opacity: sel.length >= 3 ? 0.45 : 1 }}>
            <Icon name={RING_INFO[k].icon} size={16} />
            <View style={{ flex: 1 }}>
              <Text weight={700}>{t(RING_NAMES[k])}</Text>
              <Text variant="xs" color="sec">
                {todayOnly(k) ? `${t(RING_INFO[k].desc)}. ${t('Shows on today only')}` : t(RING_INFO[k].desc)}
              </Text>
            </View>
            <Icon name="plus" size={18} color={c.cobalt} strokeWidth={2.4} />
          </Pressable>
        ))}
      </View>
      <Button title={t('Done')} onPress={onClose} />
    </Sheet>
  );
}
