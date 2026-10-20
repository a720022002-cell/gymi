import { useRecovery } from '@/components/train/RecoveryCard';
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

  // Training widget: today's workout (or rest), the next one, the streak and the recovery score.
  let next = '';
  for (let i = 1; i <= 7 && train.plan; i++) {
    const w = train.week[(train.todayIdx + i) % 7]?.w;
    if (w) {
      next = t('Next: {w} · {d}', { w: workoutTitle(w, t), d: t(DAYS[(train.todayIdx + i) % 7]) });
      break;
    }
  }
  const done = !!train.todayLog;
  const rest = !train.todayName && !done;
  const trainProps: TrainProps | null =
    train.ready && train.plan
      ? {
          workout: done ? workoutTitle(train.todayLog!.name, t) : rest ? t('Rest day') : workoutTitle(train.todayName!, t),
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
