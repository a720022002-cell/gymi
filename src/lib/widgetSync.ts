// Home screen widgets and the workout and cardio Live Activities are iPhone only (widgetSync.ios.ts). Elsewhere these do nothing.
import type { CardioAction, CardioActivityProps } from '@/widgets/CardioActivity';
import type { TodayProps } from '@/widgets/TodayWidget';
import type { TrainProps } from '@/widgets/TrainWidget';
import type { WorkoutAction, WorkoutActivityProps } from '@/widgets/WorkoutActivity';

export function syncTodayWidget(_p: TodayProps) {}
export function syncTrainWidget(_p: TrainProps) {}
export function syncWorkoutActivity(_p: WorkoutActivityProps | null) {}
export function onWorkoutAction(_fn: (a: WorkoutAction) => void) {
  return () => {};
}
export function deliverLiveAction(_action: string) {}
export function syncCardioActivity(_p: CardioActivityProps | null) {}
export function onCardioAction(_fn: (a: CardioAction) => void) {
  return () => {};
}
