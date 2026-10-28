import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { Screen } from '@/components/Screen';
import { GymBro } from '@/components/social/GymBro';
import { Text } from '@/components/Text';
import { useToast } from '@/components/Toast';
import { Button, Card, Row, Springy } from '@/components/ui';
import { useT } from '@/i18n';
import { useAuth } from '@/lib/auth';
import { cleanLook, type Look, RING_COLORS } from '@/lib/avatar';
import { BRO_LEVELS, broLevel, cachedLook, loadMyLook, saveMyLook } from '@/lib/bro';
import { useStreaks } from '@/lib/useProgress';
import { useSettings } from '@/theme/settings';

/**
 * Your Gym Bros character: pick the colour of your adro ring (its face). The body isn't chosen: it follows your
 * 30-day commitment, and you can preview the five levels here.
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
  const [look, setLook] = useState<Look>(() => cleanLook(cachedLook(uid)));
  const [preview, setPreview] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!uid || cachedLook(uid)) return;
    let alive = true;
    loadMyLook(uid).then((l) => alive && l && setLook(cleanLook(l)));
    return () => {
      alive = false;
    };
  }, [uid]);

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
        <GymBro pct={pct} female={female} look={look} username={profile?.username ?? ''} height={300} level={shown} />
        <Text variant="small" weight={700} color={c.cobalt} style={{ marginTop: 10 }}>
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

      <Card style={{ marginTop: 12 }}>
        <Text variant="small" weight={700} color="sec">
          {t('Ring color')}
        </Text>
        <Row gap={10} style={{ flexWrap: 'wrap', marginTop: 10 }}>
          {RING_COLORS.map((col, i) => (
            <Springy
              key={col}
              onPress={() => setLook({ color: i })}
              accessibilityRole="button"
              accessibilityState={{ selected: look.color === i }}
              accessibilityLabel={`${t('Ring color')} ${i + 1}`}
              style={{ width: 40, height: 40, borderRadius: 20, borderWidth: look.color === i ? 3 : 1, borderColor: look.color === i ? c.cobalt : c.line, padding: 3 }}>
              <View style={{ flex: 1, borderRadius: 17, backgroundColor: col }} />
            </Springy>
          ))}
        </Row>
      </Card>

      <Button title={t('Save')} icon="check" loading={busy} style={{ marginTop: 16 }} onPress={save} />
    </Screen>
  );
}
