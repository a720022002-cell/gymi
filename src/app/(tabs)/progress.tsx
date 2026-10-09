import { ComingSoon } from '@/components/ComingSoon';
import { Screen } from '@/components/Screen';
import { useT } from '@/i18n';

export default function Progress() {
  const { t } = useT();
  return (
    <Screen title={t('Progress')} large tabs>
      <ComingSoon icon="progress" title="Your progress" text="Weight, body, recovery, sleep and streaks, all in one place." />
    </Screen>
  );
}
