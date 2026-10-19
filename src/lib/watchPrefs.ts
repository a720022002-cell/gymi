import { useCallback, useEffect, useState } from 'react';

import { DEFAULT_PREFS, loadPrefs, onPrefs, type Prefs, savePrefs } from './reminders.shared';

/** The watch's own switches (morning note, illness warning), kept with the reminder settings on this phone. */
export function useWatchPrefs(uid: string | undefined) {
  const [p, setP] = useState<{ uid: string; v: Prefs } | null>(null);
  useEffect(() => {
    if (!uid) return;
    let alive = true;
    loadPrefs(uid).then((v) => alive && setP({ uid, v }));
    const off = onPrefs((v) => alive && setP({ uid, v }));
    return () => {
      alive = false;
      off();
    };
  }, [uid]);
  const prefs = p && p.uid === uid ? p.v : DEFAULT_PREFS;
  const set = useCallback(
    (patch: Partial<Prefs['watch']>) => {
      if (!uid) return;
      const next = { ...prefs, watch: { ...prefs.watch, ...patch } };
      setP({ uid, v: next });
      savePrefs(uid, next);
    },
    [uid, prefs],
  );
  return { watch: prefs.watch, set };
}
