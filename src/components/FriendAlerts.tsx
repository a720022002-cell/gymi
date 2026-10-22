import { useEffect } from 'react';
import { AppState } from 'react-native';

import { useT } from '@/i18n';
import { useAuth } from '@/lib/auth';
import { loadPrefs } from '@/lib/reminders';
import { challengeTitle, displayName, mySocialInvites, recentFriendPRs, recentNudges } from '@/lib/social';
import { useWeight } from '@/lib/units';

import { showBanner } from './NotifyBanner';

const EVERY = 90_000;
const nowIso = () => new Date().toISOString();

/** While the app is open: a banner when you're invited to a group or challenge, a friend hits a PR or nudges you in a challenge (Notifications → Gym Bros). */
export function FriendAlerts() {
  const { t } = useT();
  const W = useWeight();
  const { session } = useAuth();
  const uid = session?.user.id;

  useEffect(() => {
    if (!uid) return;
    let since = nowIso();
    let alive = true;
    const check = async () => {
      if (AppState.currentState !== 'active') return;
      const p = await loadPrefs(uid);
      const from = since;
      since = nowIso();
      if (!alive || !p.on || !p.friends.on) return;
      const inv = (await mySocialInvites().catch(() => [])).find((x) => new Date(x.created_at).getTime() > new Date(from).getTime());
      if (inv && alive) {
        const name = inv.kind === 'group' ? (inv.title ?? '') : challengeTitle({ kind: inv.challenge_kind ?? 'workouts', exercise_name: inv.exercise_name }, t);
        showBanner({ title: inv.from_name ?? t('Gym Bros'), body: inv.kind === 'group' ? t('invited you to the group {g}', { g: name }) : t('invited you to a challenge: {g}', { g: name }), icon: inv.kind === 'group' ? 'users' : 'trophy', route: '/friends' });
        return;
      }
      if (p.friends.prs) {
        const prs = await recentFriendPRs(from, uid).catch(() => []);
        const a = prs[0];
        if (a && alive) {
          const w = typeof a.data?.w === 'number' ? ` ${W.show(a.data.w)} ${W.label}` : '';
          showBanner({ title: displayName(a), body: t('hit a new PR: {x}', { x: `${a.text}${w}` }), icon: 'trophy', route: '/friends' });
          return;
        }
      }
      if (p.friends.challenges) {
        const n = (await recentNudges(from).catch(() => []))[0];
        if (n && alive) showBanner({ title: n.from_name, body: t('nudged you in {c}', { c: challengeTitle(n, t) }), icon: 'users', route: `/challenge?id=${n.challenge_id}` });
      }
    };
    const id = setInterval(check, EVERY);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [uid, t, W]);
  return null;
}
