import { useEffect, useState } from 'react';

import { useAuth } from './auth';
import { supabase } from './supabase';

export type AdminStats = { users: number; new_week: number; active_today: number; coaches: number; pending: number; workouts_week: number; meals_week: number; ai_today: number };
export type CoachQueueRow = {
  user_id: string; name: string | null; username: string; email: string | null; phone: string | null; coach_status: 'pending' | 'approved' | 'rejected' | null; joined: string;
  app_id: string | null; coach_type: string | null; gym: string | null; city: string | null; years: string | null; specialties: string[] | null; certs: string | null; socials: Record<string, string> | null; bio: string | null; applied: string | null; reason: string | null;
};
export type AdminUser = { id: string; name: string | null; username: string; email: string | null; account_type: string; coach_status: string | null; joined: string; last_day: string | null; is_admin: boolean };

const rpc = async <T>(fn: string, args?: Record<string, unknown>) => {
  const { data, error } = await supabase.rpc(fn, args);
  return error ? null : (data as T);
};

export const adminStats = () => rpc<AdminStats>('admin_stats');
export const coachQueue = async () => (await rpc<CoachQueueRow[]>('admin_coach_queue')) ?? [];
export const decideCoach = async (user: string, approve: boolean, reason?: string) => !!(await rpc<boolean>('admin_decide_coach', { p_user: user, p_approve: approve, p_reason: reason ?? null }));
export const adminUsers = async (q: string) => (await rpc<AdminUser[]>('admin_users', { p_q: q })) ?? [];

/** Is the logged-in person a Gymi admin? (checked on the server) */
export function useIsAdmin() {
  const { session } = useAuth();
  const uid = session?.user.id;
  const [v, setV] = useState<{ uid: string; admin: boolean } | null>(null);
  useEffect(() => {
    if (!uid) return;
    let alive = true;
    supabase.rpc('is_admin').then(({ data }) => alive && setV({ uid, admin: !!data }));
    return () => {
      alive = false;
    };
  }, [uid]);
  return !!uid && v?.uid === uid && v.admin;
}
