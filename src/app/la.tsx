import { Redirect, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';

import { deliverLiveAction } from '@/lib/widgetSync';

/**
 * A button on the workout or cardio Live Activity opened the app (adro://la?a=done): do that, then show the workout
 * or the cardio session.
 */
export default function LiveAction() {
  const { a } = useLocalSearchParams<{ a?: string }>();
  useEffect(() => {
    if (a) deliverLiveAction(a);
  }, [a]);
  return <Redirect href={a?.startsWith('c-') ? '/cardio-live' : '/active'} />;
}
