import { Redirect, router } from 'expo-router';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle } from 'react-native-svg';

import { Logo } from '@/components/Logo';
import { Text } from '@/components/Text';
import { Button } from '@/components/ui';
import { useT } from '@/i18n';
import { useAuth } from '@/lib/auth';
import { useSignupDraft } from '@/lib/signupDraft';
import { useSettings } from '@/theme/settings';

export default function Welcome() {
  const { t } = useT();
  const { colors: c } = useSettings();
  const insets = useSafeAreaInsets();
  const { session } = useAuth();
  const { accountType, setAccountType } = useSignupDraft();

  if (session) return <Redirect href="/" />;

  return (
    <View style={{ flex: 1, backgroundColor: c.bg, overflow: 'hidden' }}>
      {/* Soft blurred brand rings behind everything. */}
      <View pointerEvents="none" style={{ position: 'absolute', left: -60, bottom: -150, opacity: 0.75, filter: 'blur(38px)' } as object}>
        <Svg width={560} height={560} viewBox="0 0 560 560">
          <Circle cx={280} cy={280} r={190} fill="none" stroke="#3355FF" strokeWidth={90} strokeLinecap="round" strokeDasharray="955 1194" transform="rotate(-90 280 280)" />
        </Svg>
      </View>
      <View pointerEvents="none" style={{ position: 'absolute', right: -70, top: 120, opacity: 0.35, filter: 'blur(30px)' } as object}>
        <Svg width={260} height={260} viewBox="0 0 260 260">
          <Circle cx={130} cy={130} r={80} fill="none" stroke="#7088FF" strokeWidth={44} />
        </Svg>
      </View>

      <View style={{ flex: 1, paddingTop: Math.max(10, insets.top) + 40, paddingHorizontal: 24, paddingBottom: 40 + insets.bottom }}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: 40 }}>
          <Logo height={46} />
          <Text size={18} weight={500} color="sec" style={{ marginTop: 16 }}>
            {t('Your AI gym coach.')}
          </Text>
        </View>
        <Text center weight={600} style={{ marginHorizontal: 12, marginBottom: 22 }}>
          {t('Food, training and health in one place.')}
          {'\n'}
          {t('Ready-made for beginners, fully editable for pros.')}
        </Text>
        <Button
          title={t('Get started')}
          onPress={() => {
            if (!accountType) setAccountType('member');
            router.push({ pathname: '/language', params: { pre: '1' } });
          }}
        />
        <Button title={t('Log in')} kind="glass" style={{ marginTop: 8 }} onPress={() => router.push('/login')} />
      </View>
    </View>
  );
}
