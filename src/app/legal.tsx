import { useLocalSearchParams } from 'expo-router';

import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { Card } from '@/components/ui';
import { useT } from '@/i18n';

const PRIVACY: [string, string][] = [
  ['What we collect', 'Your account (email, phone, username), your profile (age, height, weight, gender), and what you log: food, water, workouts, weight, sleep, check-ins, health notes, cycle data and messages with your coach.'],
  ['How we use it', 'Only to run Gymi for you: calories, plans, progress, reports and the AI coach. We don’t sell your data and we don’t show ads.'],
  ['AI', 'When you use AI features, the text or photo is sent to our AI provider to get an answer. Gymi keeps only your chat history, not the photos.'],
  ['Friends and coaches', 'Friends only see what you turn on in What friends see. A coach you join sees your food, workouts, weight and sleep. Cycle data and blood tests are never shared.'],
  ['Where it’s stored', 'In our secure database with access rules that let only you read your own data. Progress photos are stored privately.'],
  ['Your choices', 'You can download all your data or delete your account any time from You, then Privacy and data. Deleting removes everything.'],
  ['Health', 'Gymi is not a medical service. It never suggests treatment. Check with your doctor about health questions.'],
];
const TERMS: [string, string][] = [
  ['Using Gymi', 'You need to be 16 or older. Keep your password private. Be respectful in Gym Bros and with coaches.'],
  ['Not medical advice', 'Calories, plans and AI answers are estimates for healthy adults. Stop and see a doctor if you feel pain, dizziness or anything unusual.'],
  ['Coaches', 'Coaches are checked by our team before they appear, but they are independent. Payments with a coach are between you and them for now.'],
  ['Subscriptions', 'Gymi Pro renews until you cancel in your App Store or Google Play settings. Free trials turn into paid plans unless cancelled first.'],
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
