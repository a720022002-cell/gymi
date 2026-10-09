import { ComingSoon } from '@/components/ComingSoon';
import { Screen } from '@/components/Screen';
import { useT } from '@/i18n';

export default function Train() {
  const { t } = useT();
  return (
    <Screen title={t('Train')} large tabs>
      <ComingSoon icon="train" title="Your training plan" text="Tell us how many days you can train. We build the rest." />
    </Screen>
  );
}
