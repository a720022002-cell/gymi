import { View } from 'react-native';

import { Field } from '@/components/Field';
import { Text } from '@/components/Text';
import { Chip, Row } from '@/components/ui';
import { useT } from '@/i18n';
import { ALLERGENS } from '@/lib/allergies';

/** Pick your food allergies (none, one or several), plus any others in your own words. */
export function AllergyPicker({ keys, note, onChange }: { keys: string[]; note: string; onChange: (keys: string[], note: string) => void }) {
  const { t } = useT();
  return (
    <View>
      <Row gap={8} style={{ flexWrap: 'wrap', marginTop: 12 }}>
        <Chip title={t('No allergies')} on={!keys.length && !note.trim()} onPress={() => onChange([], '')} />
        {ALLERGENS.map((a) => {
          const on = keys.includes(a.key);
          return <Chip key={a.key} title={`${on ? '✓ ' : ''}${t(a.en)}`} on={on} onPress={() => onChange(on ? keys.filter((k) => k !== a.key) : [...keys, a.key], note)} />;
        })}
      </Row>
      <Field label={t('Other allergies')} optional={t('(optional)')} value={note} onChangeText={(v) => onChange(keys, v.slice(0, 200))} placeholder={t('For example: strawberries, kiwi')} maxLength={200} />
      <Text variant="small" color="sec" style={{ marginTop: 8 }}>
        {t('Suggested meals and the AI will leave these out. Always check labels yourself.')}
      </Text>
    </View>
  );
}
