import { useState } from 'react';
import { View } from 'react-native';

import { useT } from '@/i18n';
import { CUSTOM_MUSCLES, type CustomKind, customExercise, type DbExercise } from '@/lib/exercisesDb';
import { muscleLabel } from '@/lib/training';

import { Field } from '../Field';
import { Text } from '../Text';
import { Button, Chip, Row } from '../ui';

const KINDS: [CustomKind, string, string][] = [
  ['weighted', 'With weight', 'Weight and reps'],
  ['bodyweight', 'Bodyweight', 'Reps only'],
  ['timed', 'Timed', 'Held for seconds'],
];

/** Make your own exercise: a name, the muscle it works and its type. No photo needed. */
export function CustomExerciseForm({ name: start = '', submit, onDone, onCancel }: { name?: string; submit: string; onDone: (e: DbExercise) => void; onCancel: () => void }) {
  const { t, lang } = useT();
  const [name, setName] = useState(start);
  const [muscle, setMuscle] = useState<string | null>(null);
  const [kind, setKind] = useState<CustomKind>('weighted');
  const [tried, setTried] = useState(false);
  const ok = !!name.trim() && !!muscle;
  return (
    <View>
      <Field label={t('Exercise name')} value={name} onChangeText={setName} placeholder={t('For example: Seated chest press')} maxLength={40} autoFocus={!start} />
      {tried && !name.trim() ? (
        <Text variant="small" color="down" style={{ marginTop: 6 }}>
          {t('Give it a name.')}
        </Text>
      ) : null}
      <Text variant="small" weight={700} color="sec" style={{ marginTop: 16, marginBottom: 8 }}>
        {t('Main muscle')}
      </Text>
      <Row gap={8} style={{ flexWrap: 'wrap' }}>
        {CUSTOM_MUSCLES.map(([m]) => (
          <Chip key={m} title={muscleLabel(m, lang, t)} on={muscle === m} onPress={() => setMuscle(m)} />
        ))}
      </Row>
      {tried && !muscle ? (
        <Text variant="small" color="down" style={{ marginTop: 6 }}>
          {t('Pick the main muscle.')}
        </Text>
      ) : null}
      <Text variant="small" weight={700} color="sec" style={{ marginTop: 16, marginBottom: 8 }}>
        {t('Type')}
      </Text>
      <Row gap={8} style={{ flexWrap: 'wrap' }}>
        {KINDS.map(([k, label]) => (
          <Chip key={k} title={t(label)} on={kind === k} onPress={() => setKind(k)} />
        ))}
      </Row>
      <Text variant="xs" color="sec" style={{ marginTop: 6 }}>
        {t(KINDS.find((k) => k[0] === kind)![2])}
      </Text>
      <Button
        icon="plus"
        title={submit}
        style={{ marginTop: 16 }}
        onPress={() => {
          setTried(true);
          if (ok) onDone(customExercise({ name, muscle: muscle!, kind, lang }));
        }}
      />
      <Button kind="ghost" title={t('Cancel')} style={{ marginTop: 4 }} onPress={onCancel} />
    </View>
  );
}
