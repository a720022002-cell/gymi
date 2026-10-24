// Sends the app's numbers to the home screen widgets and keeps the workout Live Activity (Lock Screen and Dynamic
// Island) up to date. Widgets are only reloaded when what they show changes, so iOS doesn't run out of updates.
import { requireOptionalNativeModule } from 'expo';
import { addUserInteractionListener, type LiveActivity } from 'expo-widgets';
import { AppState } from 'react-native';

import CardioActivity, { type CardioAction, type CardioActivityProps } from '@/widgets/CardioActivity';
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

// Live Activity taps reach the app as an event, and (from build 6) also wait in a native list until the app takes
// them, so a tap made while the app was asleep isn't lost. One listener takes them all and hands each to the
// workout or the cardio session.
const handlers = new Set<(target: string) => void>();
const native = requireOptionalNativeModule<{ takePendingInteractions?: () => { target?: string }[] }>('ExpoWidgets');
const canTake = typeof native?.takePendingInteractions === 'function';
const deliver = (target: string) => handlers.forEach((h) => h(target));
const drain = () => {
  // Nothing listening yet (the workout screen is still loading): leave them for when it is.
  if (!handlers.size) return;
  try {
    for (const e of native?.takePendingInteractions?.() ?? []) if (e.target) deliver(e.target);
  } catch {}
};
let started = false;
function listen(fn: (target: string) => void) {
  handlers.add(fn);
  if (!started) {
    started = true;
    try {
      addUserInteractionListener((e) => (canTake ? drain() : deliver(e.target)));
      AppState.addEventListener('change', (st) => st === 'active' && drain());
    } catch {}
  }
  // Taps made before this was listening (the app was woken up by one).
  drain();
  return () => {
    handlers.delete(fn);
  };
}

/** A button on the workout Live Activity was tapped (iOS 17 and later). Returns a function that stops listening. */
export function onWorkoutAction(fn: (a: WorkoutAction) => void) {
  return listen((t) => ACTIONS.includes(t) && fn(t as WorkoutAction));
}

let cardio: LiveActivity<CardioActivityProps> | null = null;

/** Start, update or (with null) end the live cardio session on the Lock Screen and in the Dynamic Island. */
export function syncCardioActivity(p: CardioActivityProps | null) {
  try {
    if (!cardio) cardio = CardioActivity.getInstances()[0] ?? null;
    if (!p) {
      delete sent.cardio;
      for (const a of CardioActivity.getInstances()) a.end('immediate').catch(() => {});
      cardio = null;
      return;
    }
    if (!changed('cardio', p)) return;
    if (cardio) cardio.update(p).catch(() => {});
    else cardio = CardioActivity.start(p, 'adro://cardio-live');
  } catch {
    // Live Activities off or not supported: the session screen works the same.
  }
}

const CARDIO_ACTIONS: string[] = ['c-pause', 'c-resume', 'c-finish'];

/** A button on the cardio Live Activity was tapped (iOS 17 and later). Returns a function that stops listening. */
export function onCardioAction(fn: (a: CardioAction) => void) {
  return listen((t) => CARDIO_ACTIONS.includes(t) && fn(t as CardioAction));
}
