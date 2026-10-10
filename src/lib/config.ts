/**
 * How emails verify people.
 * - false: the email has a "Confirm" link that brings you back into Gymi (works with
 *   Supabase's free built-in email, which can't show codes).
 * - true: the email shows a 6-digit code (needs a custom email sender in Supabase, plus
 *   the code email templates). Flip this once the sender is connected.
 */
export const EMAIL_CODES = false;

/** Where email links send people back to (this website). */
export const siteUrl = () => (typeof window !== 'undefined' && window.location ? window.location.origin : 'https://gymi-inky.vercel.app');
