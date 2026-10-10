import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { Choices } from '@/components/health/bits';
import { Screen } from '@/components/Screen';
import { FriendPicker } from '@/components/social/FriendPicker';
import { Text } from '@/components/Text';
import { useToast } from '@/components/Toast';
import { Button, Label } from '@/components/ui';
import { useT } from '@/i18n';
import { type Challenge, createChallenge } from '@/lib/social';

const KINDS: Challenge['kind'][] = ['steps', 'workouts', 'volume'];
const DESC: Record<Challenge['kind'], string> = {
  steps: 'Who walks the most steps.',
  workouts: 'Who finishes the most workouts.',
  volume: 'Who lifts the most total weight.',
};
const DAYS = [7, 14, 30];

/** Start a challenge with friends (design: newchallenge). */
export default function NewChallenge() {
  const { t } = useT();
  const toast = useToast();
  const p = useLocalSearchParams<{ f?: string; group?: string }>();
  const [kind, setKind] = useState(0);
  const [dur, setDur] = useState(0);
  const [fr, setFr] = useState<string[]>(() => (p.group ? p.group.split(',').filter(Boolean) : p.f ? [p.f] : []));
  const [busy, setBusy] = useState(false);
  return (
    <Screen title={t('New challenge')} back>
      <Label>{t('Type')}</Label>
      <Choices options={['Steps', 'Workouts', 'Volume']} value={kind} onChange={setKind} icons={['walk', 'train', 'trophy']} />
      <Text variant="small" color="sec" style={{ marginTop: 8, marginHorizontal: 4 }}>
        {t(DESC[KINDS[kind]])}
      </Text>
      <Label>{t('Duration')}</Label>
      <Choices options={['1 week', '2 weeks', '30 days']} value={dur} onChange={setDur} />
      <Label>{t('Friends')}</Label>
      <FriendPicker value={fr} onChange={setFr} />
      <Button
        icon="trophy"
        title={t('Start challenge')}
        disabled={!fr.length}
        loading={busy}
        onPress={async () => {
          setBusy(true);
          const id = await createChallenge(KINDS[kind], DAYS[dur], fr);
          setBusy(false);
          if (!id) return toast(t('Couldn’t save. Please try again.'), { icon: 'warn' });
          toast(t('Challenge sent to your friends'), { icon: 'trophy' });
          router.replace({ pathname: '/challenge', params: { id } });
        }}
      />
    </Screen>
  );
}
