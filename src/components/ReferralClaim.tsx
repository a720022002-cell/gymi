import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect } from 'react';

import { useT } from '@/i18n';
import { profileComplete, useAuth } from '@/lib/auth';
import { redeemCode } from '@/lib/coaching';
import { claimInvite } from '@/lib/invites';

import { useToast } from './Toast';

export const REF_KEY = 'adro.ref.v1';
/** A coach's code from an invite link opened before signing up. */
export const COACH_REF_KEY = 'adro.coachref.v1';

/**
 * If you opened someone's invite link before signing up, use their code once your account is ready (you become
 * Gym Bros), and connect to the coach whose link you opened.
 */
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
        if (r.status === 'failed' || r.status === 'slow') return; // offline or too many tries: try again next time
        await AsyncStorage.removeItem(REF_KEY);
        if (r.status === 'ok' || r.status === 'friends') toast(t('You and {n} are now Gym Bros', { n: r.name || r.username || '' }), { icon: 'users' });
        else if (r.status === 'requested') toast(t('Friend request sent to {n}. You’ll be Gym Bros once they accept.', { n: r.name || `@${r.username ?? ''}` }), { icon: 'users' });
      })
      .catch(() => {});
    AsyncStorage.getItem(COACH_REF_KEY)
      .then(async (code) => {
        if (!code) return;
        const r = await redeemCode(code);
        if (r === 'failed' || r === 'slow') return;
        await AsyncStorage.removeItem(COACH_REF_KEY);
        if (r === 'ok') toast(t('You’re connected with your coach'), { icon: 'check' });
        else if (r === 'has_coach') toast(t('You already have a coach. End that first.'), { icon: 'info' });
        else if (r === 'full') toast(t('This coach is full right now. Check back soon.'), { icon: 'info' });
        else if (r !== 'self') toast(t('That coach code doesn’t work anymore. Ask your coach for a new one.'), { icon: 'warn' });
      })
      .catch(() => {});
  }, [ready, t, toast]);
  return null;
}
