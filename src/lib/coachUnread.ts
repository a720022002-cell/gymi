// New messages from your coach since you last opened the chat (when you last looked is kept on this phone).
import AsyncStorage from '@react-native-async-storage/async-storage';

import { supabase } from './supabase';

const key = (link: string) => `adro.thread.seen.${link}`;

/** The chat is open: everything in it now counts as read. */
export function markThreadSeen(link: string) {
  AsyncStorage.setItem(key(link), new Date().toISOString()).catch(() => {});
}

/** Messages your coach sent since you last opened the chat (on a new phone: the last 2 days). At most 99. */
export async function coachUnread(link: string, coachId: string) {
  const seen = (await AsyncStorage.getItem(key(link)).catch(() => null)) ?? new Date(Date.now() - 2 * 864e5).toISOString();
  const { count, error } = await supabase.from('coach_messages').select('id', { count: 'exact', head: true }).eq('link_id', link).eq('sender', coachId).gt('created_at', seen);
  return error ? 0 : Math.min(99, count ?? 0);
}
