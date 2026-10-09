import { ComingSoon } from '@/components/ComingSoon';
import { Screen } from '@/components/Screen';
import { useT } from '@/i18n';

export default function Friends() {
  const { t } = useT();
  return (
    <Screen title={t('Gym Bros')} large tabs>
      <ComingSoon icon="friends" title="Train with friends" text="Add friends, join groups, and start challenges together." />
    </Screen>
  );
}
