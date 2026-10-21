import { useRecovery } from '@/components/train/RecoveryCard';
import { nextPlanned } from '@/components/train/WorkoutCard';
import { useT } from '@/i18n';
import { useAuth } from '@/lib/auth';
import { useStepGoal } from '@/lib/devices';
import { useFood } from '@/lib/food';
import { fmt } from '@/lib/nutrition';
import { useTrain } from '@/lib/train';
import { DAYS, workoutTitle } from '@/lib/training';
import type { TodayProps } from '@/widgets/TodayWidget';
import type { TrainProps } from '@/widgets/TrainWidget';

/** What the iPhone widgets show right now, already in your language: sent to the widgets (WidgetSync) and drawn
 * on the Widgets page. Null while that part isn't known yet. */
export function useWidgetData(): { today: TodayProps | null; train: TrainProps | null } {
  const { t } = useT();
  const { session } = useAuth();
  const food = useFood();
  const train = useTrain();
  const { r } = useRecovery();
  const stepGoal = useStepGoal(session?.user.id);

  // Today widget: only today's numbers (not a day you're looking back at).
  const goal = food.dayGoal(food.today) + food.burned;
  const left = Math.round(food.kcalLeft);
  const today: TodayProps | null =
    food.day === food.today
      ? {
          left: fmt(Math.abs(left)),
          over: left < 0,
          part: goal > 0 ? food.eaten.k / goal : 0,
          eaten: fmt(Math.round(food.eaten.k)),
          goal: fmt(goal),
          protein: `${Math.round(food.eaten.p)}/${food.target.p} ${t('g')}`,
          proteinPart: food.target.p ? food.eaten.p / food.target.p : 0,
          steps: fmt(food.steps),
          stepsPart: stepGoal ? food.steps / stepGoal : 0,
          L: { left: t('kcal left'), over: t('kcal over'), eaten: t('Eaten'), protein: t('Protein'), steps: t('Steps'), today: t('Today') },
        }
      : null;

  // Training widget: today's workout (or rest), the next one, the streak and the recovery score. Like the Train tab:
  // a day off (a break) is a rest day, and the next workout passes over breaks and uses next week's own moves.
  const n = train.plan ? nextPlanned(train) : null;
  const next = n ? t('Next: {w} · {d}', { w: workoutTitle(n.w, t), d: n.i < 7 ? t(DAYS[n.wd]) : `${t(DAYS[n.wd])} ${Number(n.date.slice(8))}` }) : '';
  const done = !!train.todayLog;
  const off = !!train.plan?.skipped[train.today];
  const rest = (!train.todayName || off) && !done;
  const trainProps: TrainProps | null =
    train.ready && train.plan
      ? {
          workout: done ? workoutTitle(train.todayLog!.name, t) : rest ? t(off ? 'Day off' : 'Rest day') : workoutTitle(train.todayName!, t),
          status: done ? t('Done. Nice work.') : rest ? t('Recover and walk') : t('Ready when you are'),
          done,
          rest,
          next,
          streak: String(train.streak),
          readiness: Number.isFinite(r.score) ? Math.round(r.score) : null,
          L: { today: t('Today'), streak: t('in a row'), ready: t('Recovery') },
        }
      : null;

  return { today, train: trainProps };
}
