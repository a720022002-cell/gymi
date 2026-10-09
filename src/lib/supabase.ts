import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

// Public values only. They are safe inside the app: row level security protects the data.
// The service_role / secret key must NEVER be used here.
const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

export const supabaseConfigured = !!url && !!anonKey;

export const supabase: SupabaseClient = createClient(url ?? 'https://not-configured.supabase.co', anonKey ?? 'missing', {
  auth: {
    storage: Platform.OS === 'web' ? undefined : AsyncStorage, // web uses localStorage
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

/** Turn Supabase errors into short, friendly messages (English keys, translated by callers). */
export function friendlyAuthError(message?: string): string {
  const m = (message ?? '').toLowerCase();
  if (m.includes('invalid login credentials')) return 'That email, username or password is not right.';
  if (m.includes('email not confirmed')) return 'Please verify your email first.';
  if (m.includes('token has expired') || m.includes('otp_expired') || m.includes('invalid otp') || m.includes('expired'))
    return 'That code is wrong or expired. Try again or resend it.';
  if (m.includes('already registered') || m.includes('already been registered')) return 'This email already has an account. Log in instead.';
  if (m.includes('rate limit') || m.includes('too many') || m.includes('security purposes'))
    return 'Too many tries. Wait a minute and try again.';
  if (m.includes('password')) return 'Use at least 8 characters, with a letter and a number.';
  if (m.includes('fetch') || m.includes('network')) return 'You’re offline. Check your connection and try again.';
  return 'Something went wrong. Please try again.';
}
