// Sends the app's numbers to the home screen widgets and keeps the workout Live Activity (Lock Screen and Dynamic
// Island) up to date. Widgets are only reloaded when what they show changes, so iOS doesn't run out of updates.
import { addUserInteractionListener, type LiveActivity } from 'expo-widgets';

import TodayWidget, { type TodayProps } from '@/widgets/TodayWidget';
import TrainWidget, { type TrainProps } from '@/widgets/TrainWidget';
import WorkoutActivity, { type WorkoutAction, type WorkoutActivityProps } from '@/widgets/WorkoutActivity';

const sent: Record<string, string> = {};
const changed = (key: string, p: unknown) => {
  const s = JSON.stringify(p);
  if (sent[key] === s) return false;
  sent[key] = s;
  return true;
};

export function syncTodayWidget(p: TodayProps) {
  try {
    if (changed('today', p)) TodayWidget.updateSnapshot(p);
  } catch {}
}

export function syncTrainWidget(p: TrainProps) {
  try {
    if (changed('train', p)) TrainWidget.updateSnapshot(p);
  } catch {}
}

let live: LiveActivity<WorkoutActivityProps> | null = null;

/** Start, update or (with null) end the workout on the Lock Screen and in the Dynamic Island. */
export function syncWorkoutActivity(p: WorkoutActivityProps | null) {
  try {
    // One that outlived the app (it was closed mid-workout) is picked up again.
    if (!live) live = WorkoutActivity.getInstances()[0] ?? null;
    if (!p) {
      delete sent.workout;
      for (const a of WorkoutActivity.getInstances()) a.end('immediate').catch(() => {});
      live = null;
      return;
    }
    if (!changed('workout', p)) return;
    if (live) live.update(p).catch(() => {});
    else live = WorkoutActivity.start(p, 'adro://active');
  } catch {
    // Live Activities turned off in Settings, or an older iPhone: the workout screen works the same.
  }
}

const ACTIONS: string[] = ['w-', 'w+', 'r-', 'r+', 'done', 'skip', 'water'];

/** A button on the workout Live Activity was tapped (iOS 17 and later). Returns a function that stops listening. */
export function onWorkoutAction(fn: (a: WorkoutAction) => void) {
  try {
    const sub = addUserInteractionListener((e) => {
      if (ACTIONS.includes(e.target)) fn(e.target as WorkoutAction);
    });
    return () => sub.remove();
  } catch {
    return () => {};
  }
}
