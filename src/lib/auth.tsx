import type { Session } from '@supabase/supabase-js';
import { createContext, type PropsWithChildren, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { friendlyAuthError, supabase, supabaseConfigured } from './supabase';

export type Profile = {
  id: string;
  username: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  gender: 'male' | 'female' | null;
  date_of_birth: string | null;
  height_cm: number | null;
  weight_kg: number | null;
  account_type: 'member' | 'coach';
  coach_status: 'pending' | 'approved' | 'rejected' | null;
  language: 'en' | 'ar';
};

/** Step 3 of sign up ("A bit about you") is done. */
export const profileComplete = (p: Profile | null) =>
  !!p && !!p.gender && !!p.date_of_birth && p.height_cm != null && p.weight_kg != null;

type Result = { error: string | null };

type Auth = {
  configured: boolean;
  loading: boolean;
  session: Session | null;
  profile: Profile | null;
  /** True once we've tried to load the profile for the current session. */
  profileReady: boolean;
  refreshProfile: () => Promise<Profile | null>;
  signUp: (a: {
    email: string;
    password: string;
    username: string;
    name: string;
    phone: string;
    accountType: 'member' | 'coach';
    language: 'en' | 'ar';
  }) => Promise<Result>;
  verifySignup: (email: string, code: string) => Promise<Result>;
  resendSignup: (email: string) => Promise<Result>;
  logIn: (identifier: string, password: string) => Promise<Result>;
  sendReset: (email: string) => Promise<Result>;
  resetWithCode: (email: string, code: string, password: string) => Promise<Result>;
  updateProfile: (patch: Partial<Profile>) => Promise<Result>;
  usernameAvailable: (u: string) => Promise<boolean | null>;
  logOut: () => Promise<void>;
};

const Ctx = createContext<Auth | null>(null);

const err = (e: { message?: string } | null | undefined): Result => ({ error: e ? friendlyAuthError(e.message) : null });

export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(supabaseConfigured);
  const [loadedFor, setLoadedFor] = useState<string | null>(null);

  const loadProfile = useCallback(async (userId: string | undefined) => {
    if (!userId) {
      setProfile(null);
      return null;
    }
    const { data } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
    setProfile((data as Profile) ?? null);
    setLoadedFor(userId);
    return (data as Profile) ?? null;
  }, []);

  useEffect(() => {
    if (!supabaseConfigured) return;
    let alive = true;
    supabase.auth
      .getSession()
      .then(async ({ data }) => {
        if (!alive) return;
        setSession(data.session);
        await loadProfile(data.session?.user.id);
      })
      .finally(() => alive && setLoading(false));

    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      // Defer: don't call Supabase inside this callback.
      setTimeout(() => loadProfile(s?.user.id), 0);
    });
    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, [loadProfile]);

  const value = useMemo<Auth>(
    () => ({
      configured: supabaseConfigured,
      loading,
      session,
      profile,
      profileReady: !session || loadedFor === session.user.id,
      refreshProfile: () => loadProfile(session?.user.id),

      async signUp({ email, password, username, name, phone, accountType, language }) {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim().toLowerCase(),
          password,
          options: { data: { username, name: name.trim(), phone, account_type: accountType, language } },
        });
        if (error) return err(error);
        // Supabase hides "email already used" by returning a user with no identities.
        if (data.user && data.user.identities?.length === 0)
          return { error: 'This email already has an account. Log in instead.' };
        return { error: null };
      },

      async verifySignup(email, code) {
        const { data, error } = await supabase.auth.verifyOtp({ email: email.trim().toLowerCase(), token: code, type: 'signup' });
        if (error) return err(error);
        await loadProfile(data.user?.id);
        return { error: null };
      },

      async resendSignup(email) {
        const { error } = await supabase.auth.resend({ type: 'signup', email: email.trim().toLowerCase() });
        return err(error);
      },

      async logIn(identifier, password) {
        let email = identifier.trim().toLowerCase();
        if (!email.includes('@')) {
          const { data, error } = await supabase.rpc('email_for_username_login', {
            p_username: email.replace(/^@/, ''),
            p_password: password,
          });
          if (error) return err(error);
          if (!data) return { error: 'That email, username or password is not right.' };
          email = data as string;
        }
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) return err(error);
        await loadProfile(data.user?.id);
        return { error: null };
      },

      async sendReset(email) {
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase());
        return err(error);
      },

      async resetWithCode(email, code, password) {
        const v = await supabase.auth.verifyOtp({ email: email.trim().toLowerCase(), token: code, type: 'recovery' });
        if (v.error) return err(v.error);
        const { error } = await supabase.auth.updateUser({ password });
        if (error) return err(error);
        await loadProfile(v.data.user?.id);
        return { error: null };
      },

      async updateProfile(patch) {
        if (!session) return { error: 'Please log in again.' };
        const { id: _id, email: _e, account_type: _a, coach_status: _c, ...allowed } = patch;
        const { data, error } = await supabase.from('profiles').update(allowed).eq('id', session.user.id).select('*').single();
        if (error) return { error: 'Couldn’t save. Please try again.' };
        setProfile(data as Profile);
        return { error: null };
      },

      async usernameAvailable(u) {
        const { data, error } = await supabase.rpc('username_available', { p_username: u });
        if (error) return null;
        return data as boolean;
      },

      async logOut() {
        await supabase.auth.signOut();
        setProfile(null);
      },
    }),
    [loading, session, profile, loadedFor, loadProfile],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAuth must be used inside AuthProvider');
  return v;
}
