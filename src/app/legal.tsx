import { useLocalSearchParams } from 'expo-router';

import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { Card } from '@/components/ui';
import { useT } from '@/i18n';

const PRIVACY: [string, string][] = [
  ['What we collect', 'Your account (email, phone, username), your profile (age, height, weight, gender), and what you log: food, water, workouts, weight, sleep, check-ins, health notes, cycle data and messages with your coach.'],
  ['How we use it', 'Only to run Adro for you: calories, plans, progress, reports and the AI coach. We don’t sell your data and we don’t show ads.'],
  ['AI', 'AI features only work after you allow them, and you can turn them off any time in Privacy and data. When you use one, what you ask (and any photo or text you add) is sent with the Adro data it needs (your goal, targets, allergies, recent food, workouts and readings) to an outside AI service, OpenRouter and the AI models it uses, only to make the answer. Adro keeps your chat history, not the photos. Cycle data in private mode is never sent.'],
  ['Friends and coaches', 'Friends only see what you turn on in What friends see. A coach you join sees your food, workouts, weight, sleep and check-ins, steps, water, goal and allergies. Cycle data and blood tests are never shared.'],
  ['Where it’s stored', 'In our secure database with access rules that let only you read your own data. Progress photos are stored privately.'],
  ['Your choices', 'You can download all your data or delete your account any time from You, then Privacy and data. Deleting removes everything.'],
  ['Apple Health and Health Connect', 'If you connect them, Adro reads only what you allow (like steps, sleep and sleep stages, heart rate, HRV, breathing, blood oxygen, temperature, weight, body fat, workouts and period days) to show it in the app and adjust your plan. Period days go straight into cycle tracking and follow its privacy setting. If you turn it on, Adro also writes your Adro workouts, meals, water and weight to it. This data is never sold, never used for ads or marketing, and never shared with anyone else, including friends.'],
  ['WHOOP, Oura and Polar', 'If you connect one, you sign in on its own page and our server keeps the access keys (the app never sees them). Adro reads your recovery, sleep, heart rate, HRV, steps, temperature and workouts to show them and adjust your plan. Disconnecting stops this and deletes what Adro got from it.'],
  ['How long we keep it', 'Your data stays while you have an account. When you delete your account, your data, photos and files are deleted from our servers.'],
  ['Health', 'Adro is not a medical service. It never suggests treatment. Check with your doctor about health questions.'],
  ['Updated', 'This policy was last updated on 21 October 2026.'],
];
const TERMS: [string, string][] = [
  ['Using Adro', 'You need to be 16 or older. Keep your password private. Be respectful in Gym Bros and with coaches.'],
  ['No abuse', 'There is zero tolerance for harassment, hate, nudity, spam or other objectionable content or behaviour. You can report or block anyone. Our team reviews reports within 24 hours and removes content and accounts that break these rules.'],
  ['Not medical advice', 'Calories, plans and AI answers are estimates for healthy adults. Stop and see a doctor if you feel pain, dizziness or anything unusual.'],
  ['Coaches', 'Coaches are checked by our team before they appear, but they are independent. Payments with a coach are between you and them for now.'],
  ['Subscriptions', 'Adro+ renews until you cancel in your App Store or Google Play settings. Free trials turn into paid plans unless cancelled first.'],
  ['Changes', 'We may update these terms. We’ll tell you in the app when something important changes.'],
];

/** Privacy policy and terms (needed for the app stores). */
export default function Legal() {
  const { t } = useT();
  const { doc } = useLocalSearchParams<{ doc?: string }>();
  const terms = doc === 'terms';
  return (
    <Screen title={t(terms ? 'Terms of use' : 'Privacy policy')} back>
      {(terms ? TERMS : PRIVACY).map(([h, b]) => (
        <Card key={h}>
          <Text weight={700}>{t(h)}</Text>
          <Text variant="small" color="sec" style={{ marginTop: 4 }}>
            {t(b)}
          </Text>
        </Card>
      ))}
    </Screen>
  );
}
