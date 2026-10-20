import { type useT } from '@/i18n';
import { type CycleLog, type CycleSettings, type Period } from '@/lib/cycle';

export const ROSE = '#E11D48';
export type State = { settings: CycleSettings; periods: Period[]; logs: Record<string, CycleLog>; anon: boolean };

export const reminderTexts = (t: ReturnType<typeof useT>['t']) => ({
  title: 'Adro',
  period: t('Your period may start in about 2 days.'),
  fertile: t('Your fertile window starts today.'),
  log: t('Take a moment to log how you feel today.'),
  visit: t('Doctor visit tomorrow.'),
});
