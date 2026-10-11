import { useEffect, useState } from 'react';

import type { Photo } from './photo';
import { supabase } from './supabase';

// Profile photo URLs by user id or username, fetched in small batches and kept for the session.
const cache = new Map<string, string | null>();
const subs = new Map<string, Set<(v: string | null) => void>>();
let queue = new Set<string>();
let timer: ReturnType<typeof setTimeout> | undefined;

function emit(key: string, v: string | null) {
  cache.set(key, v);
  subs.get(key)?.forEach((f) => f(v));
}

function flush() {
  const keys = [...queue];
  queue = new Set();
  timer = undefined;
  if (!keys.length) return;
  supabase
    .rpc('avatar_urls', { p_keys: keys })
    .then(({ data }) => {
      const got = new Map(((data as { key: string; avatar_url: string | null }[] | null) ?? []).map((r) => [r.key, r.avatar_url]));
      keys.forEach((k) => emit(k, got.get(k) ?? null));
    })
    .then(undefined, () => keys.forEach((k) => cache.set(k, null)));
}

function request(key: string) {
  if (cache.has(key) || queue.has(key)) return;
  queue.add(key);
  if (!timer) timer = setTimeout(flush, 40);
}

/** Tell every Avatar on screen about a new photo (after you change yours). */
export function setAvatarUrl(keys: string[], url: string | null) {
  keys.filter(Boolean).forEach((k) => emit(k, url));
}

/** The photo URL for someone (user id or username), or null while loading / when they have none. */
export function useAvatarUrl(key: string) {
  const [v, setV] = useState<string | null>(cache.get(key) ?? null);
  useEffect(() => {
    if (!key) return;
    let set = subs.get(key);
    if (!set) subs.set(key, (set = new Set()));
    set.add(setV);
    if (cache.has(key)) Promise.resolve().then(() => setV(cache.get(key) ?? null));
    else request(key);
    return () => {
      set.delete(setV);
    };
  }, [key]);
  return v;
}

function b64ToBytes(b64: string) {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** Upload a new profile photo to the public avatars bucket. Returns its URL, or null. */
export async function uploadAvatar(uid: string, p: Photo): Promise<string | null> {
  const path = `${uid}/${Date.now().toString(36)}.jpg`;
  const up = await supabase.storage.from('avatars').upload(path, b64ToBytes(p.base64), { contentType: p.mime, upsert: true });
  if (up.error) return null;
  await removeOldAvatars(uid, path);
  return supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl;
}

/** Delete your old photos (keep: the one just uploaded). */
export async function removeOldAvatars(uid: string, keep?: string) {
  const { data } = await supabase.storage.from('avatars').list(uid, { limit: 50 });
  const old = (data ?? []).map((f) => `${uid}/${f.name}`).filter((x) => x !== keep);
  if (old.length) await supabase.storage.from('avatars').remove(old);
}
