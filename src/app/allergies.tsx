import { router } from 'expo-router';
import { useState } from 'react';

import { AllergyPicker } from '@/components/food/AllergyPicker';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { useToast } from '@/components/Toast';
import { Button } from '@/components/ui';
import { useT } from '@/i18n';
import { useFood } from '@/lib/food';

/** Your food allergies: suggested meals and the AI leave them out. */
export default function Allergies() {
  const { t } = useT();
  const toast = useToast();
  const food = useFood();
  const [keys, setKeys] = useState<string[]>(food.plan.allergies ?? []);
  const [note, setNote] = useState(food.plan.allergyNote ?? '');
  return (
    <Screen title={t('Food allergies')} back>
      <Text color="sec">{t('Pick all that apply. Your meal plan and the AI will leave them out.')}</Text>
      <AllergyPicker
        keys={keys}
        note={note}
        onChange={(k, n) => {
          setKeys(k);
          setNote(n);
        }}
      />
      <Button
        title={t('Save')}
        style={{ marginTop: 24 }}
        onPress={async () => {
          if (!(await food.savePlan({ ...food.plan, allergies: keys, allergyNote: note.trim() }))) return toast(t('Couldn’t save. Please try again.'), { icon: 'warn' });
          toast(t('Saved'), { icon: 'check' });
          router.back();
        }}
      />
    </Screen>
  );
}
