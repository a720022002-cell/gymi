import type { CoachNotif } from './coaching';

export type CoachAlertTexts = { dailyTitle: string; dailyBody: string; weeklyTitle: string; weeklyBody: string };

/** Web: local notifications aren't available, so coach summaries only arrive on the phone app. */
export async function syncCoachAlerts(_n: CoachNotif, _texts: CoachAlertTexts, _ask = false): Promise<'ok' | 'denied' | 'unsupported'> {
  return 'unsupported';
}
