import { ComingSoon } from '@/components/ComingSoon';
import { Screen } from '@/components/Screen';
import { useT } from '@/i18n';

export default function Food() {
  const { t } = useT();
  return (
    <Screen title={t('Food')} large tabs>
      <ComingSoon icon="food" title="Calories, meals and logging" text="Set your calories, get a meal plan, and log food by typing, photo or barcode." />
    </Screen>
  );
}
