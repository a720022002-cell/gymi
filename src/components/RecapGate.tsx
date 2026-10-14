import { router } from 'expo-router';
import { useEffect } from 'react';

import { useAuth } from '@/lib/auth';
import { useFood } from '@/lib/food';
import { recapRow, recapWeek } from '@/lib/recap';
import { supabase } from '@/lib/supabase';
import { useTrain } from '@/lib/train';

let checked = '';

/** First open of a new week: show last week's recap, once (on any phone), for people who were here all week and logged something. */
export function RecapGate({ paused }: { paused?: boolean }) {
  const { session } = useAuth();
  const food = useFood();
  const train = useTrain();
  const uid = session?.user.id;
  const { start, end } = recapWeek(food.today);
  const ready = !!uid && food.ready && train.ready && !paused;
  useEffect(() => {
    if (!ready || checked === `${uid}:${start}`) return;
    checked = `${uid}:${start}`;
    const joined = (session?.user.created_at ?? '').slice(0, 10);
    if (!joined || joined > start) return;
    (async () => {
      if (await recapRow(start).catch(() => ({}))) return;
      const [w, f] = await Promise.all([
        supabase.from('workout_logs').select('id', { count: 'exact', head: true }).gte('day', start).lte('day', end),
        supabase.rpc('my_day_totals').gte('day', start).lte('day', end).limit(1),
      ]);
      if ((w.count ?? 0) > 0 || ((f.data as unknown[] | null) ?? []).length > 0) router.push('/recap');
    })().catch(() => {});
  }, [ready, uid, start, end, session?.user.created_at]);
  return null;
}
