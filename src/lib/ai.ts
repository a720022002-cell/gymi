import { supabase } from './supabase';

export type AiError = 'ai_off' | 'limit' | 'busy' | 'auth' | 'too_big' | 'failed' | 'offline';

/** Ask the Gymi AI (Supabase Edge Function "ai"). The AI key lives only on the server. */
export async function askAI<T>(task: string, body: Record<string, unknown>): Promise<{ result?: T; error?: AiError }> {
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
    ai_off: 'The AI isn’t set up yet. It works as soon as the Gemini key is added.',
    limit: 'You reached today’s AI limit. It resets tomorrow.',
    busy: 'The AI is busy right now. Try again in a minute.',
    auth: 'Please log in again.',
    too_big: 'That photo is too big. Try another one.',
    failed: 'Something went wrong. Please try again.',
    offline: 'No internet connection. Please try again.',
  }[e];
}
