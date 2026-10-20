// Home screen widgets and the workout Live Activity are iPhone only (widgetSync.ios.ts). Elsewhere these do nothing.
import type { TodayProps } from '@/widgets/TodayWidget';
import type { TrainProps } from '@/widgets/TrainWidget';
import type { WorkoutAction, WorkoutActivityProps } from '@/widgets/WorkoutActivity';

export function syncTodayWidget(_p: TodayProps) {}
export function syncTrainWidget(_p: TrainProps) {}
export function syncWorkoutActivity(_p: WorkoutActivityProps | null) {}
export function onWorkoutAction(_fn: (a: WorkoutAction) => void) {
  return () => {};
}
