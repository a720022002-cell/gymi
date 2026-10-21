import type { Session } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, type PropsWithChildren, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { resetSignupForm } from '@/components/signup/form';

import { clearAiConsent } from './aiConsent';
import { setAvatarUrl } from './avatars';
import { cancelAllReminders } from './reminders';
import { EMAIL_CODES, siteUrl } from './config';
import { friendlyAuthError, supabase, supabaseConfigured } from './supabase';

/** Your profile, kept on this phone for when there's no connection. */
const PROFILE_KEY = (uid: string) => `adro.profile.v1.${uid}`;

// Opened from a "Reset password" email link? Then the new-password screen doesn't ask for the old one.
// Read before Supabase clears the link from the address.
let fromResetLink = typeof window !== 'undefined' && typeof window.location?.hash === 'string' && /type=recovery/.test(window.location.hash + window.location.search);
/** True when this visit came from a "Reset password" email link. */
export const cameFromResetLink = () => fromResetLink;

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
  avatar_url?: string | null;
  bio?: string | null;
  invite_code?: string | null;
};

/**
 * Step 3 of sign up is done: "A bit about you" for members. Coaches send their coach
 * application there instead (Home links to it if they haven't), so they're always complete.
 */
export const profileComplete = (p: Profile | null) =>
  !!p && (p.account_type === 'coach' || (!!p.gender && !!p.date_of_birth && p.height_cm != null && p.weight_kg != null));

/**
 * Ask for a 6-digit email code when someone logs in on a new phone.
 * Needs the email to show a code: Supabase's "Magic link" template must contain {{ .Token }}
 * (custom email sender). Today the built-in sender only sends links and allows 2 emails an hour,
 * so this follows EMAIL_CODES and stays off until the sender is connected.
 */
export const LOGIN_CODES = EMAIL_CODES;

const TRUST_KEY = 'adro.trusted.v1';
/** Phones where you said "Don't ask for a code on this phone again" (user ids, this device only). */
async function trustedIds(): Promise<string[]> {
  try {
    const v = await AsyncStorage.getItem(TRUST_KEY);
    return v ? (JSON.parse(v) as string[]) : [];
  } catch {
    return [];
  }
}
async function trustDevice(id: string) {
  const ids = await trustedIds();
  if (!ids.includes(id)) await AsyncStorage.setItem(TRUST_KEY, JSON.stringify([...ids, id].slice(-10))).catch(() => {});
}

/** "o•••@gmail.com" */
export const maskEmail = (e: string) => {
  const [a, d] = e.split('@');
  return d ? `${a[0]}${'•'.repeat(Math.max(2, Math.min(5, a.length - 1)))}@${d}` : e;
};

type Result = { error: string | null };

/** updateProfile's error when the new username belongs to someone else. */
export const USERNAME_TAKEN = 'That username is taken. Try another one.';

type Auth = {
  configured: boolean;
  loading: boolean;
  session: Session | null;
  profile: Profile | null;
  /** True once we've tried to load the profile for the current session. */
  profileReady: boolean;
  /** The profile couldn't be loaded (no connection) and there's no copy on this phone: show a retry. */
  profileError: boolean;
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
  /** Has the email link been tapped? Tries to log in with the password from step 1. */
  checkConfirmed: (email: string, password: string) => Promise<Result>;
  /**
   * Log in with the password. If this phone isn't trusted (and LOGIN_CODES is on) it sends a
   * 6-digit code and answers { code: email } without logging in; finish with verifyLoginCode.
   * If the code can't be sent you're logged in anyway (codeFailed), so nobody gets locked out.
   */
  /** email: the account's email (also when logging in by username), so "confirm your email first" can offer Resend. */
  logIn: (identifier: string, password: string) => Promise<Result & { code?: string; codeFailed?: boolean; email?: string }>;
  sendLoginCode: (email: string) => Promise<Result>;
  verifyLoginCode: (email: string, code: string, trust: boolean) => Promise<Result>;
  /** Check the current password (before changing it). */
  checkPassword: (password: string) => Promise<boolean>;
  setNewPassword: (password: string) => Promise<Result>;
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
  const [profileError, setProfileError] = useState(false);

  const loadProfile = useCallback(async (userId: string | undefined) => {
    if (!userId) {
      setProfile(null);
      return null;
    }
    const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
    if (error) {
      // No connection: use the copy kept on this phone, so you aren't sent to sign up again.
      const kept = await AsyncStorage.getItem(PROFILE_KEY(userId)).catch(() => null);
      const p = kept ? (JSON.parse(kept) as Profile) : null;
      if (!p) {
        setProfileError(true);
        return null;
      }
      setProfile(p);
      setLoadedFor(userId);
      return p;
    }
    setProfileError(false);
    if (data) {
      setAvatarUrl([userId, (data as Profile).username], (data as Profile).avatar_url ?? null);
      AsyncStorage.setItem(PROFILE_KEY(userId), JSON.stringify(data)).catch(() => {});
    }
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

    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      if (event === 'PASSWORD_RECOVERY') fromResetLink = true;
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
      profileError,
      refreshProfile: () => loadProfile(session?.user.id),

      async signUp({ email, password, username, name, phone, accountType, language }) {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim().toLowerCase(),
          password,
          options: {
            data: { username, name: name.trim(), phone, account_type: accountType, language },
            emailRedirectTo: `${siteUrl()}/signup?step=about`,
          },
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
        const { error } = await supabase.auth.resend({
          type: 'signup',
          email: email.trim().toLowerCase(),
          options: { emailRedirectTo: `${siteUrl()}/signup?step=about` },
        });
        return err(error);
      },

      async checkConfirmed(email, password) {
        const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
        if (error) return err(error);
        await loadProfile(data.user?.id);
        return { error: null };
      },

      async setNewPassword(password) {
        const { error } = await supabase.auth.updateUser({ password });
        if (error) return err(error);
        return { error: null };
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
        if (error) return { ...err(error), email };
        const uid = data.user?.id ?? '';
        if (LOGIN_CODES && uid && !(await trustedIds()).includes(uid)) {
          // Password is right. Now prove it's you with a code from your email.
          await supabase.auth.signOut({ scope: 'local' });
          const sent = await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: false } });
          if (!sent.error) return { error: null, code: email };
          // Couldn't send the code: don't lock you out.
          const again = await supabase.auth.signInWithPassword({ email, password });
          if (again.error) return err(again.error);
          await loadProfile(again.data.user?.id);
          return { error: null, codeFailed: true };
        }
        await loadProfile(uid);
        return { error: null };
      },

      async sendLoginCode(email) {
        const { error } = await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: false } });
        return err(error);
      },

      async verifyLoginCode(email, code, trust) {
        const { data, error } = await supabase.auth.verifyOtp({ email, token: code, type: 'email' });
        if (error) return err(error);
        if (trust && data.user) await trustDevice(data.user.id);
        await loadProfile(data.user?.id);
        return { error: null };
      },

      async checkPassword(password) {
        const email = session?.user.email;
        if (!email) return false;
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        return !error;
      },

      async sendReset(email) {
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
          redirectTo: `${siteUrl()}/reset-password`,
        });
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
        const { id: _id, email: _e, account_type: _a, coach_status: _c, invite_code: _i, ...allowed } = patch;
        const { data, error } = await supabase.from('profiles').update(allowed).eq('id', session.user.id).select('*').single();
        // 23505: someone already has that username.
        if (error) return { error: error.code === '23505' ? USERNAME_TAKEN : 'Couldn’t save. Please try again.' };
        setAvatarUrl([session.user.id, (data as Profile).username], (data as Profile).avatar_url ?? null);
        // Keep the offline copy up to date too.
        AsyncStorage.setItem(PROFILE_KEY(session.user.id), JSON.stringify(data)).catch(() => {});
        setProfile(data as Profile);
        return { error: null };
      },

      async usernameAvailable(u) {
        const { data, error } = await supabase.rpc('username_available', { p_username: u });
        if (error) return null;
        return data as boolean;
      },

      async logOut() {
        // Your reminders and the copies kept for offline use stay with you, not on this phone.
        const uid = session?.user.id;
        await cancelAllReminders();
        if (uid) await AsyncStorage.multiRemove([PROFILE_KEY(uid), `adro.trainplan.v1.${uid}`]).catch(() => {});
        await clearAiConsent();
        resetSignupForm();
        await supabase.auth.signOut();
        setProfile(null);
      },
    }),
    [loading, session, profile, loadedFor, profileError, loadProfile],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAuth must be used inside AuthProvider');
  return v;
}
