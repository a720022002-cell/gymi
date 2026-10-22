import { router } from 'expo-router';
import { useState } from 'react';

import { Field } from '@/components/Field';
import { Screen } from '@/components/Screen';
import { FriendPicker } from '@/components/social/FriendPicker';
import { useToast } from '@/components/Toast';
import { Button, Label } from '@/components/ui';
import { useT } from '@/i18n';
import { createGroup } from '@/lib/social';

/** New group with friends (design: SH.newgroup). Friends get an invite and join when they accept. */
export default function NewGroup() {
  const { t } = useT();
  const toast = useToast();
  const [name, setName] = useState('');
  const [m, setM] = useState<string[]>([]);
  const [err, setErr] = useState(false);
  const [busy, setBusy] = useState(false);
  return (
    <Screen title={t('New group')} back>
      <Field label={t('Group name')} value={name} onChangeText={(v) => (setName(v), setErr(false))} placeholder={t('Morning crew, Office team…')} maxLength={30} error={err ? t('Enter a name') : undefined} />
      <Label>{t('Add friends')}</Label>
      <FriendPicker value={m} onChange={setM} />
      <Button
        title={m.length ? t(m.length > 1 ? 'Create group and invite {n} friends' : 'Create group and invite 1 friend', { n: m.length }) : t('Pick at least one friend')}
        disabled={!m.length}
        loading={busy}
        style={{ marginTop: 8 }}
        onPress={async () => {
          if (!name.trim()) return setErr(true);
          setBusy(true);
          const id = await createGroup(name.trim(), m);
          setBusy(false);
          if (!id) return toast(t('Couldn’t save. Please try again.'), { icon: 'warn' });
          toast(t('Group “{n}” created. Friends join when they accept your invite.', { n: name.trim() }), { icon: 'users' });
          router.replace({ pathname: '/group', params: { id } });
        }}
      />
    </Screen>
  );
}
