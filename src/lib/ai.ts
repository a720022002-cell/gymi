import { aiAllowed } from './aiConsent';
import { supabase } from './supabase';

export type AiError = 'ai_off' | 'limit' | 'busy' | 'auth' | 'too_big' | 'failed' | 'offline' | 'consent' | 'trial_photos' | 'trial_chat' | 'paywall';

/** Errors that a subscription takes away: the free trial's daily photos or messages are used, or the trial is over. */
export const NEEDS_SUB: AiError[] = ['trial_photos', 'trial_chat', 'paywall'];
let onNeedsSub: ((e: AiError) => void) | null = null;
/** The app shows the subscription page when the AI needs one (set once, by the root layout). */
export function whenAiNeedsSubscription(fn: ((e: AiError) => void) | null) {
  onNeedsSub = fn;
}

/** Ask the Adro AI (Supabase Edge Function "ai"). The AI key lives only on the server. */
export async function askAI<T>(task: string, body: Record<string, unknown>): Promise<{ result?: T; error?: AiError }> {
  // Nothing goes to the AI before you allow it (asked once).
  if (!(await aiAllowed())) return { error: 'consent' };
  try {
    const { data, error } = await supabase.functions.invoke('ai', { body: { task, ...body } });
    if (error) {
      const ctx = (error as { context?: Response }).context;
      let code: AiError = 'failed';
      try {
        const j = ctx ? await ctx.json() : null;
        if (j?.error) code = j.error;
      } catch {}
      if (!ctx) code = 'offline';
      if (NEEDS_SUB.includes(code)) onNeedsSub?.(code);
      return { error: code };
    }
    return { result: (data as { result: T }).result };
  } catch {
    return { error: 'offline' };
  }
}

/** A friendly message for an AI error. */
export function aiErrorText(e: AiError) {
  return {
    ai_off: 'The AI isn’t set up yet. It works as soon as the AI key is added.',
    limit: 'You reached today’s AI limit. It resets tomorrow.',
    busy: 'The AI is busy right now. Try again in a minute.',
    auth: 'Please log in again.',
    too_big: 'That photo is too big. Try another one.',
    failed: 'Something went wrong. Please try again.',
    offline: 'No internet connection. Please try again.',
    consent: 'AI features are off. Turn them on in You, then Privacy and data.',
    trial_photos: 'You used today’s 3 free photos. Subscribe for unlimited photos, or try again tomorrow.',
    trial_chat: 'You used today’s 4 free messages. Subscribe to talk to your coach without limits, or try again tomorrow.',
    paywall: 'Your free week is over. Subscribe to keep using the AI coach and food photos.',
  }[e] ?? 'Something went wrong. Please try again.';
}
