import { Screen } from '@/components/Screen';
import { SleepView } from '@/components/sleep/SleepView';
import { useT } from '@/i18n';

/** Everything about your sleep (also the Sleep part of Progress, Recovery). */
export default function SleepScreen() {
  const { t } = useT();
  return (
    <Screen title={t('Sleep')} back>
      <SleepView />
    </Screen>
  );
}
