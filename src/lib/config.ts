/**
 * How emails verify people.
 * - false: the email has a "Confirm" link that brings you back into Adro (works with
 *   Supabase's free built-in email, which can't show codes).
 * - true: the email shows a 6-digit code (needs a custom email sender in Supabase, plus
 *   the code email templates). On since 25 Oct 2026: Resend sends Adro's emails (supabase/auth-emails).
 */
export const EMAIL_CODES = true;

/** Where email links send people back to (this website). */
export const siteUrl = () => (typeof window !== 'undefined' && window.location ? window.location.origin : 'https://adroapp.com');
