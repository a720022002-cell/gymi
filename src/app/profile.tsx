import { Image } from 'expo-image';
import { router, useFocusEffect } from 'expo-router';
import { type ReactNode, useCallback, useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';

import { Icon } from '@/components/Icon';
import { BadgeIcon } from '@/components/progress/Streaks';
import { Screen } from '@/components/Screen';
import { Sheet } from '@/components/Sheet';
import { Field } from '@/components/Field';
import { Glass } from '@/components/Glass';
import { Avatar } from '@/components/social/Avatar';
import { List, ListRow } from '@/components/social/List';
import { Text } from '@/components/Text';
import { useToast } from '@/components/Toast';
import { Button, Card, Row } from '@/components/ui';
import { useT } from '@/i18n';
import { useAuth } from '@/lib/auth';
import { removeOldAvatars, uploadAvatar } from '@/lib/avatars';
import { useHealth } from '@/lib/health';
import { takePhoto } from '@/lib/photo';
import { badgeLevel, fx, shortDate } from '@/lib/progress';
import { DEFAULT_SHARE, type FeedItem, feed, getShare, getShowcase, saveShare, saveShowcase, type Share, type Showcase, timeAgo } from '@/lib/social';
import { useTrain } from '@/lib/train';
import { EX } from '@/lib/training';
import { useStreaks } from '@/lib/useProgress';
import { useSettings } from '@/theme/settings';

const LVN = ['Locked', 'Level 1', 'Level 2', 'Level 3', 'Level 4', 'Level 5'];

type SecKey = 'streak' | 'prs' | 'workouts' | 'weight' | 'photos';

/** Your profile: what friends see, with photo, bio, badges, records and more. Eye buttons hide a section (design: profile). */
export default function Profile() {
  const { t, lang } = useT();
  const { colors: c } = useSettings();
  const toast = useToast();
  const { profile, session, updateProfile } = useAuth();
  const uid = session?.user.id ?? '';
  const train = useTrain();
  const health = useHealth();
  const s = useStreaks();
  const [sc, setSc] = useState<Showcase | null>(null);
  const [share, setShare] = useState<Share | null>(null);
  const [posts, setPosts] = useState<FeedItem[]>([]);
  const [pick, setPick] = useState<'badges' | 'prs' | null>(null);
  const [sel, setSel] = useState<string[]>([]);
  const [preview, setPreview] = useState(false);
  const [photoOpen, setPhotoOpen] = useState(false);
  const [bioOpen, setBioOpen] = useState(false);
  const [bio, setBio] = useState('');
  const [busy, setBusy] = useState(false);
  const [thumbs, setThumbs] = useState<Record<string, string>>({});
  useFocusEffect(
    useCallback(() => {
      if (!uid) return;
      let alive = true;
      getShowcase(uid).then((v) => alive && setSc(v));
      getShare(uid).then((v) => alive && setShare(v));
      feed().then((f) => alive && setPosts(f.filter((x) => x.user_id === uid && x.kind === 'post').slice(0, 3)));
      return () => {
        alive = false;
      };
    }, [uid]),
  );
  // First and latest progress photo.
  const shots = health.photos.length > 1 ? [health.photos[0], health.photos[health.photos.length - 1]] : health.photos.slice(0, 1);
  const shotKey = shots.map((x) => x.path).join('|');
  const { photoUrls } = health;
  useEffect(() => {
    if (!shotKey) return;
    let alive = true;
    photoUrls(shotKey.split('|')).then((u) => alive && setThumbs(u));
    return () => {
      alive = false;
    };
  }, [shotKey, photoUrls]);

  const name = profile?.name || profile?.username || '';
  const exName = (id: string) => (EX[id] ? (lang === 'ar' ? EX[id].ar : EX[id].en) : (train.logs.flatMap((l) => l.exercises).find((x) => x.id === id)?.n ?? id));
  const unlocked = s.badges.filter((b) => badgeLevel(b) > 0);
  const records = Object.entries(train.best).filter(([, w]) => w > 0).sort((a, b) => b[1] - a[1]);
  const cur = sc ?? { badges: [], prs: [] };
  const sh = share ?? DEFAULT_SHARE;
  // Keep pinned badges up to date with your real level.
  const shown = cur.badges.map((b) => s.badges.find((x) => x.id === b.id) ?? null).filter(Boolean) as typeof s.badges;
  const lastWorkout = [...train.logs].sort((a, b) => (a.started_at < b.started_at ? 1 : -1))[0];
  const ws = health.weights;
  const change = ws.length > 1 ? ws[ws.length - 1].value - ws[0].value : null;

  const save = async () => {
    const next: Showcase =
      pick === 'badges'
        ? { ...cur, badges: sel.map((id) => s.badges.find((b) => b.id === id)!).filter(Boolean).map((b) => ({ id: b.id, name: b.name, icon: b.icon, level: badgeLevel(b), tiers: b.tiers, v: b.v, unit: b.unit })) }
        : { ...cur, prs: sel.map((id) => ({ id, n: exName(id), w: train.best[id] })) };
    setSc(next);
    setPick(null);
    toast((await saveShowcase(uid, next)) ? t(pick === 'badges' ? 'Badges updated on your profile' : 'Records updated on your profile') : t('Couldn’t save. Please try again.'), { icon: 'trophy' });
  };

  const flip = async (key: SecKey, title: string) => {
    const next = { ...sh, [key]: !sh[key] };
    setShare(next);
    const ok = await saveShare(uid, next);
    if (!ok) {
      setShare(sh);
      return toast(t('Couldn’t save. Please try again.'), { icon: 'warn' });
    }
    toast(next[key] ? t('{x}: visible to friends', { x: title }) : t('{x}: hidden from friends', { x: title }), { icon: next[key] ? 'check' : 'lock' });
  };

  const photo = async (camera: boolean) => {
    const p = await takePhoto(camera);
    if (!p) return;
    setBusy(true);
    const url = await uploadAvatar(uid, p);
    const r = url ? await updateProfile({ avatar_url: url }) : { error: 'x' };
    setBusy(false);
    setPhotoOpen(false);
    toast(r.error ? t('Couldn’t save. Please try again.') : t('Profile photo updated'), { icon: r.error ? 'warn' : 'check' });
  };
  const removePhoto = async () => {
    setBusy(true);
    await removeOldAvatars(uid);
    await updateProfile({ avatar_url: null });
    setBusy(false);
    setPhotoOpen(false);
    toast(t('Photo removed'), { icon: 'trash' });
  };

  /** One section with its title, an Edit link and the eye button (design: pfSec). */
  const sec = (title: string, key: SecKey, edit: (() => void) | null, inner: ReactNode) => {
    const on = sh[key] !== false;
    if (preview && !on) return null;
    return (
      <View style={{ opacity: on ? 1 : 0.55 }}>
        <Row style={{ justifyContent: 'space-between', marginTop: 22, marginBottom: 10, marginHorizontal: 4 }}>
          <Text variant="h3">{title}</Text>
          {preview ? null : (
            <Row gap={6}>
              {edit ? <Button small kind="ghost" title={t('Edit')} onPress={edit} /> : null}
              <Pressable
                onPress={() => flip(key, title)}
                accessibilityRole="switch"
                accessibilityState={{ checked: on }}
                accessibilityLabel={on ? t('Hide {x} from friends', { x: title }) : t('Show {x} to friends', { x: title })}
                style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: c.inset, alignItems: 'center', justifyContent: 'center' }}>
                <Icon name={on ? 'eye' : 'eyeoff'} size={17} color={on ? c.cobalt : c.sec} />
              </Pressable>
            </Row>
          )}
        </Row>
        {!on ? (
          <Row gap={5} style={{ marginTop: -4, marginBottom: 8, marginHorizontal: 4 }}>
            <Icon name="lock" size={12} color={c.sec} />
            <Text variant="xs" weight={700} color="sec">
              {t('Only you see this')}
            </Text>
          </Row>
        ) : null}
        {inner}
      </View>
    );
  };
  const empty = (msg: string) => (
    <Card style={{ alignItems: 'center' }}>
      <Text variant="small" color="sec" center>
        {msg}
      </Text>
    </Card>
  );

  return (
    <Screen title={t('Profile')} back>
      {preview ? (
        <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, backgroundColor: c.inset }}>
          <Icon name="eye" size={18} color={c.cobalt} />
          <Text variant="small" weight={700} style={{ flex: 1 }}>
            {t('This is what friends see')}
          </Text>
          <Button small kind="ghost" title={t('Back to editing')} onPress={() => setPreview(false)} />
        </Card>
      ) : (
        <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14 }}>
          <Icon name="info" size={18} color={c.sec} />
          <Text variant="small" style={{ flex: 1 }}>
            {t('Tap the eye to show or hide a section from friends.')}
          </Text>
          <Button small kind="ghost" title={t('Preview')} onPress={() => setPreview(true)} />
        </Card>
      )}
      <View style={{ alignItems: 'center' }}>
        {preview ? (
          <Avatar id={uid} name={name} size={84} url={profile?.avatar_url ?? null} />
        ) : (
          <Pressable onPress={() => setPhotoOpen(true)} accessibilityLabel={t('Change profile photo')}>
            <Avatar id={uid} name={name} size={84} url={profile?.avatar_url ?? null} />
            <Glass style={{ position: 'absolute', right: -4, bottom: -4, width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="camera" size={15} />
            </Glass>
          </Pressable>
        )}
        <Text variant="h1" style={{ marginTop: 12 }}>
          {name}
        </Text>
        <Text weight={700} color="sec">{`@${profile?.username ?? ''}`}</Text>
        {s.overall && sh.streak !== false ? (
          <Row gap={4} style={{ marginTop: 4 }}>
            <Icon name="flame" size={16} color={c.cobalt} />
            <Text variant="small" color="sec">
              {t('{n}-day streak', { n: s.overall })}
            </Text>
          </Row>
        ) : null}
        {profile?.bio ? (
          <Text variant="small" center style={{ marginTop: 8, maxWidth: 300 }}>
            {profile.bio}
          </Text>
        ) : null}
        {preview ? null : (
          <Button small kind="ghost" icon="edit" title={profile?.bio ? t('Edit bio') : t('Add a short bio')} style={{ marginTop: 4, alignSelf: 'center' }} onPress={() => (setBio(profile?.bio ?? ''), setBioOpen(true))} />
        )}
      </View>

      {sec(
        t('Badges'),
        'streak',
        () => (setSel(cur.badges.map((b) => b.id)), setPick('badges')),
        shown.length ? (
          <Row gap={16} style={{ justifyContent: 'center' }}>
            {shown.map((b) => (
              <View key={b.id} style={{ width: 80, alignItems: 'center' }}>
                <BadgeIcon b={b} size={56} />
                <Text variant="xs" weight={700} center style={{ marginTop: 8 }}>
                  {t(b.name)}
                </Text>
                <Text variant="xs" color="sec">
                  {t(LVN[badgeLevel(b)])}
                </Text>
              </View>
            ))}
          </Row>
        ) : (
          empty(preview ? t('No badges picked yet.') : t(unlocked.length ? 'Pick up to 3 badges to show your friends.' : 'Unlock badges by training and logging. Then show them here.'))
        ),
      )}
      {sec(
        t('Personal records'),
        'prs',
        () => (setSel(cur.prs.map((p) => p.id)), setPick('prs')),
        cur.prs.length ? (
          <List>
            {cur.prs.map((p, i) => (
              <ListRow key={p.id} first={!i}>
                <Icon name="trophy" size={18} color={c.cobalt} />
                <Text weight={700} style={{ flex: 1 }}>
                  {exName(p.id)}
                </Text>
                <Text num weight={700}>{`${train.best[p.id] ?? p.w} ${t('kg')}`}</Text>
              </ListRow>
            ))}
          </List>
        ) : (
          empty(preview ? t('No records picked yet.') : t(records.length ? 'Pick up to 5 records to show your friends.' : 'Finish a workout to set your first records.'))
        ),
      )}
      {sec(
        t('Latest workout'),
        'workouts',
        null,
        lastWorkout ? (
          <List>
            <ListRow first>
              <Icon name="train" size={18} />
              <View style={{ flex: 1 }}>
                <Text weight={700}>{t(lastWorkout.name)}</Text>
                <Text variant="small" color="sec">
                  {`${shortDate(lastWorkout.day, lang)} · ${t('{n} min', { n: lastWorkout.minutes })}`}
                </Text>
              </View>
            </ListRow>
          </List>
        ) : (
          empty(t('No workouts yet.'))
        ),
      )}
      {sec(
        t('Weight trend'),
        'weight',
        null,
        change != null ? (
          <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Icon name="scale" size={18} color={change < 0 ? c.cobalt : c.text} />
            <View style={{ flex: 1 }}>
              <Text weight={700}>{change <= 0 ? t('Down {n} kg', { n: fx(-change) }) : t('Up {n} kg', { n: fx(change) })}</Text>
              <Text variant="small" color="sec">
                {t('Since {d}', { d: shortDate(ws[0].day, lang) })}
              </Text>
            </View>
          </Card>
        ) : (
          empty(t('Log your weight a few times to see a trend.'))
        ),
      )}
      {sec(
        t('Progress photos'),
        'photos',
        null,
        shots.length ? (
          <Row gap={10}>
            {shots.map((x) => (
              <View key={x.id} style={{ flex: 1, backgroundColor: c.card, borderRadius: 18, overflow: 'hidden', alignItems: 'center', paddingBottom: 8 }}>
                {thumbs[x.path] ? <Image source={{ uri: thumbs[x.path] }} style={{ width: '100%', aspectRatio: 3 / 4 }} contentFit="cover" /> : <View style={{ width: '100%', aspectRatio: 3 / 4, backgroundColor: c.inset }} />}
                <Text variant="xs" weight={700} color="sec" style={{ marginTop: 6 }}>
                  {shortDate(x.day, lang)}
                </Text>
              </View>
            ))}
          </Row>
        ) : (
          empty(t('No progress photos yet.'))
        ),
      )}
      {posts.length ? (
        <>
          <Text variant="h3" style={{ marginTop: 22, marginBottom: 10, marginHorizontal: 4 }}>
            {t('Posts')}
          </Text>
          {posts.map((x) => (
            <Card key={x.id}>
              <Text>{x.text}</Text>
              <Text variant="xs" color="sec" style={{ marginTop: 6 }}>
                {timeAgo(x.created_at, t, lang)}
              </Text>
            </Card>
          ))}
        </>
      ) : null}
      {preview ? null : (
        <>
          <Text variant="xs" color="sec" center style={{ marginTop: 16, marginBottom: 12 }}>
            {t('Food logs, sleep, health and cycle data are never shared.')}
          </Text>
          <List>
            <ListRow first onPress={() => router.push('/account')}>
              <Icon name="lock" size={18} />
              <View style={{ flex: 1 }}>
                <Text weight={700}>{t('Account details')}</Text>
                <Text variant="small" color="sec">
                  {t('Name, username, email, phone, password')}
                </Text>
              </View>
              <Icon name="chev" size={16} color={c.sec} />
            </ListRow>
            <ListRow onPress={() => router.push('/fprivacy')}>
              <Icon name="users" size={18} />
              <Text weight={700} style={{ flex: 1 }}>
                {t('What friends can see')}
              </Text>
              <Icon name="chev" size={16} color={c.sec} />
            </ListRow>
          </List>
        </>
      )}
      <Sheet open={photoOpen} onClose={() => setPhotoOpen(false)}>
        <View style={{ alignItems: 'center' }}>
          <Avatar id={uid} name={name} size={96} url={profile?.avatar_url ?? null} />
          <Text variant="h2" center style={{ marginTop: 12 }}>
            {t('Profile photo')}
          </Text>
          <Text variant="small" color="sec" center style={{ marginTop: 4 }}>
            {profile?.account_type === 'coach' ? t('Your clients see this.') : t('Your Gym Bros friends see this.')}
          </Text>
        </View>
        <View style={{ height: 16 }} />
        <List>
          <ListRow first onPress={() => !busy && photo(false)}>
            <Icon name="image" size={20} />
            <Text weight={700} style={{ flex: 1 }}>
              {t('Choose from photos')}
            </Text>
          </ListRow>
          <ListRow onPress={() => !busy && photo(true)}>
            <Icon name="camera" size={20} />
            <Text weight={700} style={{ flex: 1 }}>
              {t('Take a photo')}
            </Text>
          </ListRow>
          {profile?.avatar_url ? (
            <ListRow onPress={() => !busy && removePhoto()}>
              <Icon name="trash" size={20} color={c.down} />
              <Text weight={700} color="down" style={{ flex: 1 }}>
                {t('Remove photo')}
              </Text>
            </ListRow>
          ) : null}
        </List>
        {busy ? (
          <Text variant="small" color="sec" center>
            {t('Saving…')}
          </Text>
        ) : null}
        <Button kind="ghost" title={t('Cancel')} onPress={() => setPhotoOpen(false)} />
      </Sheet>
      <Sheet open={bioOpen} onClose={() => setBioOpen(false)}>
        <Text variant="h2">{t('Bio')}</Text>
        <Text variant="small" color="sec" style={{ marginTop: 4 }}>
          {t('A line about you. Friends see it on your profile.')}
        </Text>
        <Field value={bio} onChangeText={(v) => setBio(v.slice(0, 120))} placeholder={t('For example: Lifting 4x a week. Chasing a 100 kg bench.')} multiline maxLength={120} style={{ minHeight: 84, paddingTop: 12 }} />
        <Text variant="xs" color="sec" style={{ textAlign: 'right', marginTop: 4 }}>{`${bio.length}/120`}</Text>
        <Button
          title={t('Save')}
          style={{ marginTop: 16 }}
          onPress={async () => {
            const r = await updateProfile({ bio: bio.trim() || null });
            setBioOpen(false);
            toast(r.error ? t(r.error) : t('Saved'), { icon: r.error ? 'warn' : 'check' });
          }}
        />
        <Button kind="ghost" title={t('Cancel')} style={{ marginTop: 8 }} onPress={() => setBioOpen(false)} />
      </Sheet>
      <Sheet open={!!pick} onClose={() => setPick(null)}>
        <Text variant="h2">{t(pick === 'badges' ? 'Badges on your profile' : 'Records on your profile')}</Text>
        <Text variant="small" color="sec" style={{ marginTop: 4 }}>
          {t(pick === 'badges' ? 'Pick up to 3.' : 'Pick up to 5. They show in the order you pick them.')}
        </Text>
        <View style={{ height: 12 }} />
        <List>
          {(pick === 'badges' ? unlocked.map((b) => [b.id, t(b.name), t(LVN[badgeLevel(b)])] as const) : records.map(([id, w]) => [id, exName(id), `${w} ${t('kg')}`] as const)).map(([id, n, sub], i) => {
            const at = sel.indexOf(id);
            const max = pick === 'badges' ? 3 : 5;
            return (
              <ListRow
                key={id}
                first={!i}
                onPress={() => (at >= 0 ? setSel(sel.filter((x) => x !== id)) : sel.length >= max ? toast(t('You can show {n}. Remove one first.', { n: max }), { icon: 'info' }) : setSel([...sel, id]))}>
                <View style={{ width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: at >= 0 ? c.cobalt : 'transparent', borderWidth: at >= 0 ? 0 : 2, borderColor: c.line }}>
                  {at >= 0 ? <Text variant="xs" weight={700} color="#FFFFFF">{`${at + 1}`}</Text> : null}
                </View>
                <Text weight={at >= 0 ? 700 : 500} style={{ flex: 1 }}>
                  {n}
                </Text>
                <Text variant="small" color="sec">
                  {sub}
                </Text>
              </ListRow>
            );
          })}
        </List>
        <Button title={t('Save ({a} of {b})', { a: sel.length, b: pick === 'badges' ? 3 : 5 })} onPress={save} />
      </Sheet>
    </Screen>
  );
}
