import { useT } from '@/i18n';
import type { FoodPlan } from '@/lib/nutrition';

import { Text } from '../Text';
import { Card, Segmented } from '../ui';

/** Beginner or Advanced: who sets the numbers. */
export function ModeCard({ mode, onChange }: { mode: FoodPlan['mode']; onChange: (m: 'beginner' | 'advanced') => void }) {
  const { t } = useT();
  return (
    <Card>
      <Text weight={700}>{t('Mode')}</Text>
      <Text variant="small" color="sec" style={{ marginTop: 2, marginBottom: 12 }}>
        {t(mode === 'beginner' ? 'Beginner: everything is set for you.' : 'Advanced: you can edit every number.')}
      </Text>
      <Segmented
        value={mode === 'beginner' ? 'beginner' : 'advanced'}
        options={[
          { value: 'beginner', label: t('Beginner') },
          { value: 'advanced', label: t('Advanced') },
        ]}
        onChange={onChange}
      />
    </Card>
  );
}
