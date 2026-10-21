import { useCallback } from 'react';
import { View } from 'react-native';

import { useT } from '@/i18n';
import { productAllergies } from '@/lib/allergies';
import { useFood } from '@/lib/food';
import { useSettings } from '@/theme/settings';

import { Icon } from '../Icon';
import { Text } from '../Text';
import { Row } from '../ui';

/** Your allergies in a food: from its name, its ingredients (or a meal's items) and a label's allergen tags. Names to show. */
export function useAllergyCheck() {
  const food = useFood();
  const { allergies, allergyNote } = food.plan;
  return useCallback(
    (name: string, ingredients?: (string | null | undefined)[], tags?: string[]) =>
      productAllergies({ name, ingredients: (ingredients ?? []).filter(Boolean).join(', '), tags }, allergies, allergyNote),
    [allergies, allergyNote],
  );
}

/** "Careful: this may contain …" (red), or, when a product's ingredients aren't known, that its allergens are unknown. */
export function AllergyWarn({ items, unknown }: { items: string[]; unknown?: boolean }) {
  const { t } = useT();
  const { colors: c } = useSettings();
  const food = useFood();
  if (items.length)
    return (
      <Row gap={8} style={{ marginTop: 10, padding: 12, borderRadius: 16, backgroundColor: 'rgba(220,38,38,0.1)', alignItems: 'flex-start' }}>
        <Icon name="warn" size={18} color={c.down} />
        <Text variant="small" weight={700} style={{ flex: 1 }}>
          {t('Careful: this may contain {x}, which you’re allergic to.', { x: items.map((a) => t(a)).join(t(', ')) })}
        </Text>
      </Row>
    );
  // Only worth saying to someone with allergies.
  if (!unknown || !(food.plan.allergies?.length || food.plan.allergyNote?.trim())) return null;
  return (
    <View style={{ flexDirection: 'row', gap: 8, marginTop: 10, padding: 12, borderRadius: 16, backgroundColor: c.inset, alignItems: 'flex-start' }}>
      <Icon name="info" size={18} color={c.sec} />
      <Text variant="small" style={{ flex: 1 }}>
        {t('Allergens unknown: we don’t have this product’s ingredients. Check the label before you eat it.')}
      </Text>
    </View>
  );
}
