import { useCallback, useEffect, useState } from 'react';
import { TextInput, View } from 'react-native';

import { Thinking } from '@/components/food/Thinking';
import { Sheet } from '@/components/Sheet';
import { Avatar } from '@/components/social/Avatar';
import { Text } from '@/components/Text';
import { useToast } from '@/components/Toast';
import { Button, Card, Chip, Row } from '@/components/ui';
import { useT } from '@/i18n';
import { hideContent, type ModItem, type ModUser, modUser, type ResetField, resetProfile, suspendUser } from '@/lib/admin';
import { localDay } from '@/lib/nutrition';
import { shortDate } from '@/lib/progress';
import { useSettings } from '@/theme/settings';

const RESET: [ResetField, string][] = [
  ['name', 'Name'],
  ['username', 'Username'],
  ['bio', 'Bio'],
  ['photo', 'Photo'],
  ['coach', 'Coach page'],
];

const ACTIONS: Record<string, string> = {
  suspend: 'Suspended',
  unsuspend: 'Suspension lifted',
  reset_profile: 'Profile reset',
  hide_post: 'Post hidden',
  show_post: 'Post shown again',
  hide_message: 'Message hidden',
  show_message: 'Message shown again',
  report_done: 'Report resolved',
  report_dismissed: 'Report dismissed',
  report_open: 'Report opened again',
  report_reopen: 'Report opened again',
};

/**
 * The team's tools for one person: suspend, reset profile text, hide posts and messages. Every action is logged.
 * suspend: open straight at the suspend step (from a report's Suspend button).
 */
export function ModerateSheet({ user, suspend, onClose, onChanged }: { user: string | null; suspend?: boolean; onClose: () => void; onChanged?: () => void }) {
  return (
    <Sheet open={!!user} onClose={onClose}>
      {user ? <Body key={`${user}${suspend ? '+' : ''}`} user={user} ask={!!suspend} onChanged={onChanged} /> : null}
    </Sheet>
  );
}

function Body({ user, ask, onChanged }: { user: string; ask: boolean; onChanged?: () => void }) {
  const { t, lang } = useT();
  const { colors: c } = useSettings();
  const toast = useToast();
  const [u, setU] = useState<ModUser | null | undefined>(undefined);
  const [asking, setAsking] = useState(ask);
  const [reason, setReason] = useState('');
  const [pick, setPick] = useState<ResetField[]>([]);

  const load = useCallback(() => modUser(user).then(setU), [user]);
  useEffect(() => {
    load();
  }, [load]);

  const done = (ok: boolean, msg: string) => {
    toast(ok ? t(msg) : t('Couldn’t save. Please try again.'), { icon: ok ? 'check' : 'warn' });
    if (ok) {
      load();
      onChanged?.();
    }
  };
  const day = (iso: string) => shortDate(localDay(new Date(iso)), lang);

  const items = (list: ModItem[], kind: 'post' | 'message', title: string) =>
    list.length ? (
      <View style={{ marginTop: 14 }}>
        <Text variant="small" weight={700} color="sec" style={{ marginBottom: 6 }}>
          {t(title)}
        </Text>
        {list.map((x) => (
          <Card key={x.id} style={{ padding: 14, marginBottom: 8 }}>
            <Text variant="small" style={x.hidden_at ? { opacity: 0.5 } : null}>
              {x.text}
            </Text>
            <Row style={{ justifyContent: 'space-between', marginTop: 6 }}>
              <Text variant="xs" color="sec" style={{ flex: 1 }} numberOfLines={1}>
                {[x.group_name, day(x.created_at), x.hidden_at ? t('Hidden') : null].filter(Boolean).join(' · ')}
              </Text>
              <Button
                small
                kind="soft"
                title={t(x.hidden_at ? 'Show again' : 'Hide')}
                color={x.hidden_at ? undefined : c.down}
                onPress={async () => done(await hideContent(kind, x.id, !x.hidden_at), x.hidden_at ? 'Shown again.' : 'Hidden. Others can’t see it now.')}
              />
            </Row>
          </Card>
        ))}
      </View>
    ) : null;

  return (
    <>
      {u === undefined ? (
        <Thinking message={t('Loading')} />
      ) : u === null ? (
        <Text color="sec">{t('Couldn’t load. Please try again.')}</Text>
      ) : (
        <View>
          <Row>
            <Avatar id={u.id} name={u.name || u.username} size={48} url={u.avatar_url} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text variant="h2" numberOfLines={1}>
                {u.name || u.username}
              </Text>
              <Text variant="small" color="sec" numberOfLines={1}>
                {[`@${u.username}`, u.email].filter(Boolean).join(' · ')}
              </Text>
            </View>
          </Row>
          {u.suspended_at ? (
            <Card style={{ marginTop: 12, borderWidth: 2, borderColor: c.down }}>
              <Text weight={700} color={c.down}>
                {t('Suspended since {d}', { d: day(u.suspended_at) })}
              </Text>
              {u.suspend_reason ? <Text variant="small" style={{ marginTop: 4 }}>{u.suspend_reason}</Text> : null}
            </Card>
          ) : null}
          <Text variant="small" color="sec" style={{ marginTop: 10 }}>
            {t('{n} reports about this person in all', { n: u.reports })}
          </Text>
          {u.bio || u.coach?.headline || u.coach?.about || u.coach?.bio ? (
            <Card style={{ marginTop: 10 }}>
              {(
                [
                  ['Bio', u.bio],
                  ['Coach headline', u.coach?.headline],
                  ['Coach about', u.coach?.about],
                  ['Coach bio', u.coach?.bio],
                ] as [string, string | null | undefined][]
              )
                .filter(([, v]) => v)
                .map(([k, v]) => (
                  <View key={k} style={{ marginBottom: 6 }}>
                    <Text variant="xs" weight={700} color="sec">
                      {t(k)}
                    </Text>
                    <Text variant="small">{v}</Text>
                  </View>
                ))}
            </Card>
          ) : null}

          {/* Suspend */}
          <View style={{ marginTop: 14 }}>
            {u.is_admin ? (
              <Text variant="small" color="sec">
                {t('This is an admin. Admins can’t be suspended.')}
              </Text>
            ) : u.suspended_at ? (
              <Button kind="soft" icon="unlock" title={t('Lift suspension')} onPress={async () => done(await suspendUser(u.id, false), 'Suspension lifted.')} />
            ) : asking ? (
              <View>
                <Text weight={700}>{t('Suspend this account?')}</Text>
                <Text variant="small" color="sec">
                  {t('They can’t use friends, groups, challenges or coaching, and others won’t see them. You can lift it later.')}
                </Text>
                <TextInput
                  value={reason}
                  onChangeText={setReason}
                  maxLength={300}
                  multiline
                  placeholder={t('Reason (optional, they see it)')}
                  placeholderTextColor={c.sec}
                  style={{ marginTop: 8, minHeight: 64, borderRadius: 14, backgroundColor: c.card, padding: 12, fontSize: 15, color: c.text, textAlignVertical: 'top' }}
                />
                <Row gap={8} style={{ marginTop: 8 }}>
                  <Button kind="soft" title={t('Cancel')} style={{ flex: 1 }} onPress={() => setAsking(false)} />
                  <Button
                    kind="danger"
                    title={t('Suspend')}
                    style={{ flex: 1 }}
                    onPress={async () => {
                      const ok = await suspendUser(u.id, true, reason);
                      setAsking(false);
                      done(ok, 'Account suspended.');
                    }}
                  />
                </Row>
              </View>
            ) : (
              <Button kind="danger" icon="lock" title={t('Suspend account')} onPress={() => setAsking(true)} />
            )}
          </View>

          {/* Reset profile text */}
          <View style={{ marginTop: 16 }}>
            <Text variant="small" weight={700} color="sec">
              {t('Reset offensive profile details')}
            </Text>
            <Row gap={8} style={{ flexWrap: 'wrap', marginTop: 8 }}>
              {RESET.filter(([k]) => k !== 'coach' || u.coach).map(([k, l]) => (
                <Chip key={k} title={t(l)} on={pick.includes(k)} onPress={() => setPick(pick.includes(k) ? pick.filter((x) => x !== k) : [...pick, k])} />
              ))}
            </Row>
            <Text variant="xs" color="sec" style={{ marginTop: 6 }}>
              {t('Name, bio and photo are cleared. The username becomes a plain one. The coach page text is cleared and hidden from Find a coach.')}
            </Text>
            <Button
              small
              kind="soft"
              title={t('Reset selected')}
              disabled={!pick.length}
              style={{ marginTop: 8 }}
              onPress={async () => {
                const ok = await resetProfile(u.id, pick);
                if (ok) setPick([]);
                done(ok, 'Profile reset.');
              }}
            />
          </View>

          {items(u.posts, 'post', 'Group posts')}
          {items(u.messages, 'message', 'Coach messages')}

          {u.actions.length ? (
            <View style={{ marginTop: 14 }}>
              <Text variant="small" weight={700} color="sec" style={{ marginBottom: 6 }}>
                {t('Team actions')}
              </Text>
              {u.actions.map((a, i) => (
                <Text key={i} variant="xs" color="sec" style={{ marginBottom: 4 }}>
                  {[day(a.created_at), t(ACTIONS[a.action] ?? a.action), a.note, a.admin ? `@${a.admin}` : null].filter(Boolean).join(' · ')}
                </Text>
              ))}
            </View>
          ) : null}
        </View>
      )}
    </>
  );
}
