import { useEffect } from 'react';
import { Platform } from 'react-native';

import { useWidgetData } from '@/lib/widgetData';
import { syncTodayWidget, syncTrainWidget } from '@/lib/widgetSync';

/** Keeps the iPhone home screen widgets in step with today's numbers. Renders nothing. */
export function WidgetSync() {
  if (Platform.OS !== 'ios') return null;
  return <Sync />;
}

function Sync() {
  const { today, train } = useWidgetData();

  // The keys hold everything the widgets show.
  const todayKey = JSON.stringify(today);
  useEffect(() => {
    if (today) syncTodayWidget(today);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [todayKey]);

  const trainKey = JSON.stringify(train);
  useEffect(() => {
    if (train) syncTrainWidget(train);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trainKey]);

  return null;
}
