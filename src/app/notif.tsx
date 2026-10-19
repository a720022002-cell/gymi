import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';

import { TimeField } from '@/components/food/TimeField';
import { Icon } from '@/components/Icon';
import { showBanner } from '@/components/NotifyBanner';
import { Screen } from '@/components/Screen';
import { List, ListRow } from '@/components/social/List';
import { Text } from '@/components/Text';
import { Button, Card, Chip, Label, Row, Toggle } from '@/components/ui';
import { useT } from '@/i18n';
import { getSoundPrefs, previewSound, setSoundPrefs, SOUNDS, type SoundPrefs } from '@/lib/beep';
import { FREQ, NCAT_INFO, NCATS, type NCat, NSOUNDS, type Prefs, SOUND_NAMES, type WaterFreq } from '@/lib/reminders';
import { useAuth } from '@/lib/auth';
import { sleepDetail, useDevices } from '@/lib/devices';
import { catSummary, useReminderPrefs } from '@/lib/remindersPrefs';
import { playTone } from '@/lib/sound';
import { useSettings } from '@/theme/settings';

const REPORT_DAYS = ['Thu', 'Fri', 'Sat', 'Sun', 'Mon', 'Tue'];

/** One reminder type: when, how often and which sound (design: notif). Open with /notif?type=water. */
export default function NotifDetail() {
  const { t, lang } = useT();
  const { colors: c } = useSettings();
  const { type } = useLocalSearchParams<{ type?: string }>();
  const k: NCat = NCATS.includes(type as NCat) ? (type as NCat) : 'water';
  const { prefs: p, save } = useReminderPrefs();
  const [sp, setSp] = useState<SoundPrefs | null>(null);
  useEffect(() => {
    if (k !== 'workout') return;
    let alive = true;
    getSoundPrefs().then((v) => alive && setSp(v));
    return () => {
      alive = false;
    };
  }, [k]);

  // Your usual bedtime from the watch (last 2 weeks), to the nearest 5 minutes, as a time for the bedtime reminder.
  const { session } = useAuth();
  const dev = useDevices(session?.user.id);
  const usualBed = k === 'sleep' ? sleepDetail(dev.days)?.bedUsual : null;
  const watchBed =
    usualBed == null
      ? null
      : (() => {
          const m = (((Math.round(usualBed / 5) * 5) % 1440) + 1440) % 1440;
          return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
        })();

  const cat = p[k];
  const set = <K extends NCat>(key: K, patch: Partial<Prefs[K]>) => save({ ...p, [key]: { ...p[key], ...patch } });
  const info = NCAT_INFO[k];

  const radio = <V extends string | number>(value: V, opts: [V, string, string?][], onPick: (v: V) => void) => (
    <List>
      {opts.map(([v, l, sub], i) => (
        <ListRow key={String(v)} first={!i} onPress={() => onPick(v)}>
          <View style={{ flex: 1 }} accessibilityRole="radio" accessibilityState={{ checked: value === v }}>
            <Text weight={700}>{l}</Text>
            {sub ? (
              <Text variant="small" color="sec">
                {sub}
              </Text>
            ) : null}
          </View>
          <View style={{ width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: value === v ? c.cobalt : 'transparent', borderWidth: value === v ? 0 : 2, borderColor: c.line }}>
            {value === v ? <Icon name="check" size={13} color="#FFFFFF" strokeWidth={3} /> : null}
          </View>
        </ListRow>
      ))}
    </List>
  );
  const timeRow = (label: string, value: string, onChange: (v: string) => void, first?: boolean) => (
    <ListRow first={first}>
      <Text weight={700} style={{ flex: 1 }}>
        {label}
      </Text>
      <TimeField value={value} onChange={onChange} label={label} />
    </ListRow>
  );
  const toggleRow = (label: string, sub: string | null, value: boolean, onChange: (v: boolean) => void, first?: boolean) => (
    <ListRow first={first}>
      <View style={{ flex: 1 }}>
        <Text weight={700}>{label}</Text>
        {sub ? (
          <Text variant="small" color="sec">
            {sub}
          </Text>
        ) : null}
      </View>
      <Toggle value={value} onChange={onChange} label={label} />
    </ListRow>
  );

  // Workouts use the workout sound list (the same one the rest timer plays).
  const sounds = k === 'workout' ? SOUNDS.map((s) => s.id) : NSOUNDS[k];
  const soundName = (id: string) => (k === 'workout' ? (SOUNDS.find((s) => s.id === id)?.name ?? id) : (SOUND_NAMES[id] ?? id));
  const curSound = k === 'workout' && sp ? sp.sound : cat.sound;
  const pickSound = (id: string) => {
    (k === 'workout' ? previewSound : playTone)(id);
    set(k, { sound: id } as Partial<Prefs[NCat]>);
    if (k === 'workout' && sp) {
      const next = { ...sp, sound: id };
      setSp(next);
      setSoundPrefs(next);
    }
  };

  return (
    <Screen title={t(info.name)} back>
      <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View style={{ width: 36, height: 36, borderRadius: 11, backgroundColor: c.cobalt, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name={info.icon} size={20} color="#FFFFFF" />
        </View>
        <View style={{ flex: 1 }}>
          <Text weight={700}>{t('{x} reminders', { x: t(info.name) })}</Text>
          <Text variant="small" color="sec">
            {cat.on ? catSummary(k, p, t, lang) : t('Off')}
          </Text>
        </View>
        <Toggle value={cat.on} onChange={(v) => save({ ...p, [k]: { ...cat, on: v }, ...(v ? { on: true } : {}) }, v)} label={t(info.name)} />
      </Card>

      <View style={{ opacity: cat.on ? 1 : 0.5 }}>
        {k === 'water' ? (
          <>
            <Label>{t('How often')}</Label>
            {radio<WaterFreq>(
              p.water.freq,
              (Object.keys(FREQ) as WaterFreq[]).map((v) => [v, t(FREQ[v]), v === 'behind' ? t('Checks every 2 hours and only reminds you if you’re behind') : undefined]),
              (v) => set('water', { freq: v }),
            )}
            <List>
              {timeRow(p.water.freq === 'day' ? t('At') : t('From'), p.water.from, (v) => set('water', { from: v }), true)}
              {p.water.freq === 'day' ? null : timeRow(t('Until'), p.water.to, (v) => set('water', { to: v }))}
            </List>
            <Text variant="xs" color="sec" style={{ marginHorizontal: 4 }}>
              {t('No reminders outside these hours.')}
            </Text>
          </>
        ) : null}

        {k === 'food' ? (
          <>
            <Label>{t('When')}</Label>
            {radio(
              p.food.mode,
              [
                ['before', t('Before each meal'), t('A heads-up with what’s on your plan')],
                ['after', t('After each meal'), t('A nudge to log what you ate')],
                ['day', t('Once a day'), t('One reminder in the evening')],
              ],
              (v) => set('food', { mode: v }),
            )}
            {p.food.mode === 'before' ? (
              <Row gap={8} style={{ flexWrap: 'wrap', marginBottom: 12 }}>
                {[15, 30, 60].map((v) => (
                  <Chip key={v} title={v === 60 ? t('1 hour before') : t('{n} min before', { n: v })} on={p.food.before === v} onPress={() => set('food', { before: v })} />
                ))}
              </Row>
            ) : null}
            <List>
              {toggleRow(t('Daily summary'), t('Calories and protein left, in the evening'), p.food.summary, (v) => set('food', { summary: v }), true)}
              {p.food.summary || p.food.mode === 'day' ? timeRow(t('Summary time'), p.food.sumTime, (v) => set('food', { sumTime: v })) : null}
            </List>
          </>
        ) : null}

        {k === 'workout' ? (
          <>
            <Label>{t('Remind me')}</Label>
            {radio(
              p.workout.before,
              [
                [0, t('At workout time')],
                [30, t('30 min before')],
                [60, t('1 hour before')],
              ],
              (v) => set('workout', { before: v }),
            )}
            <List>
              {toggleRow(
                t('Sound when rest ends'),
                t('Plays your workout sound when the rest timer is done'),
                sp?.rest ?? true,
                (v) => {
                  const next = { sound: sp?.sound ?? p.workout.sound, rest: v };
                  setSp(next);
                  setSoundPrefs(next);
                },
                true,
              )}
            </List>
          </>
        ) : null}

        {k === 'checkin' ? (
          <>
            <Label>{t('When')}</Label>
            <List>{timeRow(t('Every day at'), p.checkin.time, (v) => set('checkin', { time: v }), true)}</List>
            <Text variant="xs" color="sec" style={{ marginHorizontal: 4 }}>
              {t('Pick a time right after you usually wake up.')}
            </Text>
          </>
        ) : null}

        {k === 'sleep' ? (
          <>
            <Label>{t('When')}</Label>
            <List>
              {timeRow(t('Bedtime'), p.sleep.time, (v) => set('sleep', { time: v }), true)}
              {toggleRow(t('Wind-down reminder'), t('30 minutes before bedtime'), p.sleep.wind, (v) => set('sleep', { wind: v }))}
            </List>
            {watchBed && watchBed !== p.sleep.time ? (
              <Card style={{ marginTop: 10 }}>
                <Text variant="small">{t('Your watch says you usually fall asleep around {c}.', { c: watchBed })}</Text>
                <Button small kind="soft" title={t('Use {c}', { c: watchBed })} style={{ marginTop: 10, alignSelf: 'flex-start' }} onPress={() => set('sleep', { time: watchBed, on: true })} />
              </Card>
            ) : null}
          </>
        ) : null}

        {k === 'vitamins' ? (
          <>
            <Label>{t('When')}</Label>
            <Card>
              <Text variant="small">{t('Each vitamin reminds you at its own time.')}</Text>
            </Card>
            <Button kind="glass" icon="pill" title={t('Set times for each vitamin')} onPress={() => router.push('/vitamins')} />
          </>
        ) : null}

        {k === 'report' ? (
          <>
            <Label>{t('When')}</Label>
            <Row gap={8} style={{ flexWrap: 'wrap', marginBottom: 12 }}>
              {REPORT_DAYS.map((d) => (
                <Chip key={d} title={t(d)} on={p.report.day === d} onPress={() => set('report', { day: d })} />
              ))}
            </Row>
            <List>{timeRow(t('Time'), p.report.time, (v) => set('report', { time: v }), true)}</List>
          </>
        ) : null}

        {k === 'friends' ? (
          <>
            <Label>{t('Tell me when')}</Label>
            <List>
              {toggleRow(t('A friend hits a PR'), null, p.friends.prs, (v) => set('friends', { prs: v }), true)}
              {toggleRow(t('Challenge updates'), t('When someone passes you on the leaderboard'), p.friends.challenges, (v) => set('friends', { challenges: v }))}
              {toggleRow(t('Someone cheers you on'), null, p.friends.cheers, (v) => set('friends', { cheers: v }))}
            </List>
            <Text variant="xs" color="sec" style={{ marginHorizontal: 4 }}>
              {t('These show while Gymi is open.')}
            </Text>
          </>
        ) : null}

        <Label>{t('Sound')}</Label>
        <List>
          {sounds.map((id, i) => (
            <ListRow key={id} first={!i}>
              <Pressable onPress={() => pickSound(id)} accessibilityRole="radio" accessibilityState={{ checked: curSound === id }} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <View style={{ width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: curSound === id ? c.cobalt : 'transparent', borderWidth: curSound === id ? 0 : 2, borderColor: c.line }}>
                  {curSound === id ? <Icon name="check" size={13} color="#FFFFFF" strokeWidth={3} /> : null}
                </View>
                <Text weight={700} style={{ flex: 1 }}>
                  {t(soundName(id))}
                </Text>
              </Pressable>
              {id !== 'none' ? (
                <Pressable
                  onPress={() => (k === 'workout' ? previewSound : playTone)(id)}
                  accessibilityLabel={t('Play {x}', { x: t(soundName(id)) })}
                  style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: c.inset, alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name="play" size={16} />
                </Pressable>
              ) : null}
            </ListRow>
          ))}
        </List>
        <Text variant="xs" color="sec" style={{ marginHorizontal: 4 }}>
          {t('Tap a sound to hear it. Turn off silent mode on your phone to hear previews.')}
        </Text>
        <Button
          kind="glass"
          icon="bell"
          title={t('Preview a reminder')}
          style={{ marginTop: 12 }}
          onPress={() => {
            (k === 'workout' ? previewSound : playTone)(curSound);
            showBanner({ title: 'Gymi', body: t(info.sample), icon: info.icon, route: `/notif?type=${k}` });
          }}
        />
      </View>
    </Screen>
  );
}
