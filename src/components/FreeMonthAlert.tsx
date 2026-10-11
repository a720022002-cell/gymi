import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { useT } from '@/i18n';
import { useAuth } from '@/lib/auth';
import { myInvite, newFreeMonths, REF_GOAL } from '@/lib/invites';
import { useSettings } from '@/theme/settings';

import { Icon } from './Icon';
import { Sheet } from './Sheet';
import { Text } from './Text';
import { Button } from './ui';

/** "You earned a free month!" once, when the 5th (10th, …) friend joins with your code (design: refJoin). */
export function FreeMonthAlert({ months }: { months?: number }) {
  const { t } = useT();
  const { colors: c } = useSettings();
  const { session } = useAuth();
  const uid = session?.user.id;
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!uid) return;
    let alive = true;
    (months == null ? myInvite().then((x) => x.months) : Promise.resolve(months))
      .then((m) => newFreeMonths(uid, m))
      .then((fresh) => alive && fresh && setOpen(true))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [uid, months]);

  return (
    <Sheet open={open} onClose={() => setOpen(false)}>
      <View style={{ alignItems: 'center' }}>
        <Icon name="star" size={30} color={c.cobalt} />
        <Text variant="h2" center style={{ marginTop: 8 }}>
          {t('You earned a free month!')}
        </Text>
        <Text color="sec" center style={{ marginTop: 6 }}>
          {t('{n} friends joined with your code. 1 month of Gymi Premium is added to your account.', { n: REF_GOAL })}
        </Text>
      </View>
      <Button title={t('Nice')} style={{ marginTop: 16 }} onPress={() => setOpen(false)} />
    </Sheet>
  );
}
