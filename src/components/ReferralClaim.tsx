import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect } from 'react';

import { useT } from '@/i18n';
import { profileComplete, useAuth } from '@/lib/auth';
import { claimInvite } from '@/lib/invites';

import { useToast } from './Toast';

export const REF_KEY = 'gymi.ref.v1';

/** If you opened someone's invite link before signing up, use their code once your account is ready (you become Gym Bros). */
export function ReferralClaim() {
  const { t } = useT();
  const toast = useToast();
  const { session, profile } = useAuth();
  const ready = !!session && profileComplete(profile);
  useEffect(() => {
    if (!ready) return;
    AsyncStorage.getItem(REF_KEY)
      .then(async (ref) => {
        if (!ref) return;
        const r = await claimInvite(ref);
        if (r.status === 'failed') return; // offline: try again next time
        await AsyncStorage.removeItem(REF_KEY);
        if (r.status === 'ok' || r.status === 'friends') toast(t('You and {n} are now Gym Bros', { n: r.name || r.username || '' }), { icon: 'users' });
        else if (r.status === 'requested') toast(t('Friend request sent to @{u}', { u: r.username ?? '' }), { icon: 'users' });
      })
      .catch(() => {});
  }, [ready, t, toast]);
  return null;
}
