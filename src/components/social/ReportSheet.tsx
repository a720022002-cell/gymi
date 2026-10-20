import { useState } from 'react';
import { View } from 'react-native';

import { Field } from '@/components/Field';
import { Sheet } from '@/components/Sheet';
import { Text } from '@/components/Text';
import { useToast } from '@/components/Toast';
import { Button, Chip, Row, Toggle } from '@/components/ui';
import { useT } from '@/i18n';
import { blockUser, REPORT_REASONS, type ReportReason, sendReport } from '@/lib/social';

/**
 * Report a person, a coach page, a group or a challenge to the Adro team (they never learn who reported them).
 * For a person you can block them in the same step. `onBlocked` runs after a block.
 */
export function ReportSheet({
  open,
  onClose,
  user,
  name,
  kind = 'user',
  refId,
  onBlocked,
}: {
  open: boolean;
  onClose: () => void;
  user: string | null;
  name: string;
  kind?: 'user' | 'coach' | 'group' | 'challenge';
  refId?: string;
  onBlocked?: () => void;
}) {
  const { t } = useT();
  const toast = useToast();
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [note, setNote] = useState('');
  const [block, setBlock] = useState(kind === 'user');
  const [busy, setBusy] = useState(false);

  const send = async () => {
    if (!reason) return;
    setBusy(true);
    const ok = await sendReport({ reported: user, kind, ref: refId, reason, note });
    const blocked = ok && block && user ? await blockUser(user) : false;
    setBusy(false);
    if (!ok) return toast(t('Couldn’t send. Please try again.'), { icon: 'warn' });
    setReason(null);
    setNote('');
    onClose();
    toast(t(blocked ? 'Thanks. We’ll look at it, and {n} is blocked.' : 'Thanks. We’ll look at it.', { n: name }), { icon: 'check' });
    if (blocked) onBlocked?.();
  };

  return (
    <Sheet open={open} onClose={onClose}>
      <Text variant="h2" center>
        {t('Report {n}', { n: name })}
      </Text>
      <Text color="sec" center style={{ marginTop: 4 }}>
        {t('Only the Adro team sees this. {n} won’t know who reported.', { n: name })}
      </Text>
      <Row gap={8} style={{ flexWrap: 'wrap', marginTop: 16 }}>
        {REPORT_REASONS.map(([k, l]) => (
          <Chip key={k} title={t(l)} on={reason === k} onPress={() => setReason(k)} />
        ))}
      </Row>
      <View style={{ marginTop: 12 }}>
        <Field value={note} onChangeText={setNote} placeholder={t('What happened? (optional)')} maxLength={500} multiline />
      </View>
      {kind === 'user' && user ? (
        <Row gap={12} style={{ marginTop: 12 }}>
          <View style={{ flex: 1 }}>
            <Text weight={700}>{t('Also block {n}', { n: name })}</Text>
            <Text variant="small" color="sec">
              {t('You won’t see each other or be able to add each other.')}
            </Text>
          </View>
          <Toggle value={block} label={t('Also block {n}', { n: name })} onChange={setBlock} />
        </Row>
      ) : null}
      <Button kind="danger" title={t('Send report')} disabled={!reason} loading={busy} style={{ marginTop: 16 }} onPress={send} />
      <Button kind="ghost" title={t('Cancel')} style={{ marginTop: 8 }} onPress={onClose} />
    </Sheet>
  );
}
