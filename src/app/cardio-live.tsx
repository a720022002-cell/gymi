import { useKeepAwake } from 'expo-keep-awake';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Platform, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { sessionGuide } from '@/components/CardioLive';
import { Icon, type IconName } from '@/components/Icon';
import { Screen } from '@/components/Screen';
import { Sheet } from '@/components/Sheet';
import { Text } from '@/components/Text';
import { useToast } from '@/components/Toast';
import { useRecovery } from '@/components/train/RecoveryCard';
import { Button, Card, Option, Row, Segmented, Springy, Toggle } from '@/components/ui';
import { useT } from '@/i18n';
import { useAuth } from '@/lib/auth';
import { type CardioKind, goalOf, maxZone, recommend, ZONE_COLORS, ZONE_NAMES, zoneBpm, zoneRpe } from '@/lib/cardioCoach';
import { gpsPermission, gpsSupported } from '@/lib/cardioGps';
import {
  avgHr,
  cardioLoaded,
  type CardioSessionState,
  clearCardio,
  clockText,
  addScore,
  endRound,
  finishCardio,
  kmText,
  movingMs,
  paceText,
  pauseCardio,
  resumeCardio,
  scoreText,
  sessionKcal,
  setRpe,
  setSaved,
  setSpeak,
  speedNow,
  startCardio,
  startRound,
  useCardioSession,
} from '@/lib/cardioSession';
import { hush } from '@/lib/cardioVoice';
import { useFood } from '@/lib/food';
import { appleWatchSupported, bleSupported, type HrSource, type SavedSensor, savedSensor, saveSensor, scanSensors } from '@/lib/liveHr';
import { useTrain } from '@/lib/train';
import { SPORT_GROUPS, type SportGroup, SPORTS, type SportId, sportFrom, sportInfo } from '@/lib/sports';
import { useSettings } from '@/theme/settings';

const icon = (s: SportId): IconName => sportInfo(s).icon ?? 'flame';
/** Each group's color on the sport picker, and its short name on the filter chips. */
const GROUP_COLORS: Record<SportGroup, string> = { Cardio: '#3355FF', 'Racket sports': '#F59E0B', 'Team sports': '#22C55E', Combat: '#EF4444', 'Mind and body': '#A855F7', Other: '#94A3B8' };
const GROUP_SHORT: Record<SportGroup, string> = { Cardio: 'Cardio', 'Racket sports': 'Racket', 'Team sports': 'Team', Combat: 'Combat', 'Mind and body': 'Mind & body', Other: 'Other' };
/** Numbers inside a sentence stay left to right in Arabic. */
const ltr = (s: string | number) => `⁦${s}⁩`;
const clampZone = (z: number) => Math.max(1, Math.min(5, Math.round(z)));

/**
 * Live cardio session (route contract, also used by the weekly cardio plan):
 * /cardio-live?sport=Run&min=30&zone=2&kind=steady&planId=…  — every param optional.
 * Before: pick the sport, the coach's target for your goal, minutes and where heart rate comes from. During: timer,
 * heart rate and zone, distance and pace, effort guidance and coach tips. After: summary, saved as today's cardio.
 */
export default function CardioLiveScreen() {
  const s = useCardioSession();
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let on = true;
    cardioLoaded.then(() => on && setReady(true));
    return () => {
      on = false;
    };
  }, []);
  if (!ready && !s) return <Screen back />;
  if (s && !s.endedAt) return <LiveView s={s} />;
  if (s) return <Summary s={s} />;
  return <PreStart />;
}

// ---------------------------------------------------------------------------------------------------------------------
// Before you start
// ---------------------------------------------------------------------------------------------------------------------
function PreStart() {
  const { t } = useT();
  const { colors: c } = useSettings();
  const toast = useToast();
  const p = useLocalSearchParams<{ sport?: string; min?: string; zone?: string; kind?: string; planId?: string }>();
  const food = useFood();
  const train = useTrain();
  const { profile } = useAuth();
  const { input, r } = useRecovery();

  const [now] = useState(() => Date.now());
  const age = profile?.date_of_birth ? Math.max(14, Math.floor((now - new Date(profile.date_of_birth).getTime()) / 3.15576e10)) : 30;
  const female = profile?.gender === 'female';
  const weight = Number(food.plan.weight || profile?.weight_kg || 75);
  const goal = goalOf(food.setupDone ? food.plan.goal : null);
  const injuries = train.plan?.injuries ?? [];
  // Recovery only counts when there's something behind it (a check-in or the watch's night).
  const readiness = r.checked || !!input.body ? r.score : null;

  const paramSport = sportFrom(p.sport);
  const [sport, setSport] = useState<SportId | null>(paramSport);
  const ctx = { goal, preg: food.preg, nursing: food.nursing, readiness, age, injuries, sport: sport ?? 'Run' };
  const rec = recommend(ctx);
  const cap = maxZone(ctx);
  const paramZone = p.zone && +p.zone >= 1 ? clampZone(+p.zone) : null;
  const paramMin = p.min && +p.min > 0 ? Math.min(300, Math.round(+p.min)) : null;
  const paramKind: CardioKind | null = p.kind === 'intervals' || p.kind === 'steady' ? p.kind : null;
  const [zoneSel, setZone] = useState<number | null>(null);
  const [minSel, setMin] = useState<number | null | undefined>(undefined);
  const [kindSel, setKind] = useState<CardioKind | null>(null);
  const zone = Math.min(cap, zoneSel ?? paramZone ?? rec.zone);
  const minutes = minSel === undefined ? (paramMin ?? rec.minutes) : minSel;
  // No intervals in pregnancy or after birth.
  const canIntervals = !!sport && sportInfo(sport).intervals && !food.preg && !food.nursing;
  const kind: CardioKind = canIntervals ? (kindSel ?? paramKind ?? rec.kind) : 'steady';

  const [sensor, setSensor] = useState<SavedSensor | null>(null);
  const [sourceSel, setSource] = useState<HrSource | null>(null);
  useEffect(() => {
    savedSensor().then(setSensor);
  }, []);
  const source: HrSource = sourceSel ?? (sensor && bleSupported ? 'ble' : appleWatchSupported ? 'apple' : 'none');
  const outdoor = !!sport && sportInfo(sport).gps && gpsSupported;
  const [gpsSel, setGps] = useState<boolean | null>(null);
  const gps = outdoor && (gpsSel ?? true);
  const [speakSel, setSpeakSel] = useState<boolean | null>(null);
  const speak = speakSel ?? (!!sport && (sportInfo(sport).gps || sportInfo(sport).group === 'Combat'));
  const [scan, setScan] = useState(false);
  const insets = useSafeAreaInsets();

  const [lo, hi] = zoneBpm(zone, age);
  const [rlo, rhi] = zoneRpe(zone);

  const start = async () => {
    if (!sport) return;
    let useGps = gps;
    if (useGps) {
      const perm = await gpsPermission();
      if (perm !== 'ok') {
        useGps = false;
        toast(perm === 'off' ? t('Location is off, so distance won’t be tracked.') : t('No location access, so distance won’t be tracked.'), { icon: 'warn' });
      }
    }
    startCardio({
      sport,
      kind,
      planMin: minutes,
      target: zone,
      cap,
      planId: p.planId ? String(p.planId).slice(0, 80) : null,
      source: source === 'ble' && !sensor ? 'none' : source,
      sensor: source === 'ble' ? sensor : null,
      gps: useGps,
      speak,
      goal,
      preg: food.preg,
      nursing: food.nursing,
      readiness,
      age,
      female,
      weight,
      injuries,
    });
  };

  const [hrOpen, setHrOpen] = useState(false);
  const [filter, setFilter] = useState<SportGroup | null>(null);
  const pickSport = (id: SportId) => {
    setSport(id);
    setSpeakSel(null);
    setKind(null);
    setZone(null);
    setMin(undefined);
  };
  const timeOptions = [...new Set([15, 30, 45, 60, 90, ...(paramMin ? [paramMin] : []), rec.minutes])].sort((a, b) => a - b);
  const onRec = zone === Math.min(cap, rec.zone) && minutes === rec.minutes && (!canIntervals || kind === rec.kind);
  const hrName = source === 'ble' && sensor ? sensor.name : source === 'apple' ? t('Apple Watch') : t('No sensor');
  const hrSub = source === 'ble' && sensor ? t('Bluetooth sensor · live every second') : source === 'apple' ? t('Updates every few seconds') : t('Coaching by time and how hard it feels');
  const zoneText = source === 'none' ? t('{name}: feels {a} to {b} out of 10', { name: t(ZONE_NAMES[zone - 1]), a: ltr(rlo), b: ltr(rhi) }) : t('{name}: {a}–{b} bpm', { name: t(ZONE_NAMES[zone - 1]), a: ltr(lo), b: ltr(hi) });
  const label = (x: string) => (
    <Text variant="xs" weight={700} color="sec" style={{ letterSpacing: 0.6, textTransform: 'uppercase' }}>
      {x}
    </Text>
  );
  const line = <View style={{ height: 1, backgroundColor: c.inset, marginVertical: 16, marginHorizontal: -16 }} />;

  // Step 1: pick a sport (a grid of icons, colored by group). Step 2: set it up, with Start always at the bottom.
  if (!sport)
    return (
      <Screen title={t('Start cardio')} back>
        <Text variant="small" color="sec" style={{ marginHorizontal: 4, marginBottom: 12 }}>
          {t('What are you doing today?')}
        </Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 14 }}>
          {[null, ...SPORT_GROUPS].map((g) => (
            <Springy
              key={g ?? 'all'}
              onPress={() => setFilter(g)}
              accessibilityState={{ selected: filter === g }}
              style={{ height: 36, paddingHorizontal: 14, borderRadius: 18, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: filter === g ? c.text : c.card }}>
              {g ? <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: GROUP_COLORS[g] }} /> : null}
              <Text weight={700} size={13} color={filter === g ? c.bg : c.text}>
                {t(g ? GROUP_SHORT[g] : 'All')}
              </Text>
            </Springy>
          ))}
        </ScrollView>
        {SPORT_GROUPS.filter((g) => !filter || filter === g).map((grp) => (
          <View key={grp} style={{ marginBottom: 8 }}>
            <Row gap={8} style={{ marginHorizontal: 4, marginBottom: 10 }}>
              <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: GROUP_COLORS[grp] }} />
              {label(t(grp))}
            </Row>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', rowGap: 12 }}>
              {SPORTS.filter((x) => x.group === grp).map(({ id, name }) => (
                <Springy key={id} onPress={() => pickSport(id)} scaleTo={0.94} accessibilityLabel={t(name)} style={{ width: '25%', alignItems: 'center', gap: 7 }}>
                  <View style={{ width: 58, height: 58, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: `${GROUP_COLORS[grp]}22` }}>
                    <Icon name={icon(id)} size={24} color={GROUP_COLORS[grp]} />
                  </View>
                  <Text weight={700} size={12} center numberOfLines={1} style={{ maxWidth: '96%' }}>
                    {t(name)}
                  </Text>
                </Springy>
              ))}
            </View>
          </View>
        ))}
      </Screen>
    );

  const g = sportInfo(sport).group;
  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <Screen title={t('Start cardio')} back onBack={paramSport ? undefined : () => setSport(null)}>
        <Row gap={14} style={{ marginHorizontal: 4, marginBottom: 16 }}>
          <View style={{ width: 56, height: 56, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: `${GROUP_COLORS[g]}26` }}>
            <Icon name={icon(sport)} size={28} color={GROUP_COLORS[g]} />
          </View>
          <View style={{ flex: 1 }}>
            <Text variant="h2">{t(sportInfo(sport).name)}</Text>
            <Text variant="small" color="sec">
              {t(g)}
            </Text>
          </View>
          <Springy onPress={() => setSport(null)} style={{ padding: 6 }}>
            <Text weight={700} color="link">
              {t('Change')}
            </Text>
          </Springy>
        </Row>

        <Card style={{ backgroundColor: c.gAi, borderWidth: 1, borderColor: c.gAiBorder }}>
          <Row gap={8}>
            <Icon name="sparkle" size={18} color={c.cobalt} />
            <Text variant="small" weight={700} color="link">
              {t('Your coach recommends')}
            </Text>
          </Row>
          <Text variant="h3" style={{ marginTop: 8 }}>
            {t('Zone {z} · {n} min · {k}', { z: rec.zone, n: rec.minutes, k: t(rec.kind === 'intervals' ? 'Intervals' : 'Steady') })}
          </Text>
          <Text variant="small" color="sec" style={{ marginTop: 6 }}>
            {t(rec.why.key, rec.why.vars)}
          </Text>
          {rec.extra ? (
            <Text variant="small" color="sec" style={{ marginTop: 6 }}>
              {t(rec.extra.key, rec.extra.vars)}
            </Text>
          ) : null}
          {onRec ? (
            <Row gap={6} style={{ marginTop: 12 }}>
              <Icon name="check" size={16} color={c.up} />
              <Text variant="small" weight={700} color="up">
                {t('Set below. Change anything you like.')}
              </Text>
            </Row>
          ) : (
            <Springy
              onPress={() => {
                setZone(null);
                setMin(undefined);
                setKind(null);
              }}
              style={{ marginTop: 12, alignSelf: 'flex-start' }}>
              <Text variant="small" weight={700} color="link">
                {t('Back to the recommendation')}
              </Text>
            </Springy>
          )}
        </Card>

        <Card>
          <Row style={{ justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
            {label(t('Target zone'))}
            <Text variant="small" weight={700} style={{ color: ZONE_COLORS[zone - 1], flexShrink: 1 }} numberOfLines={1}>
              {zoneText}
            </Text>
          </Row>
          <Row gap={6}>
            {[1, 2, 3, 4, 5].map((z) => (
              <Springy
                key={z}
                disabled={z > cap}
                onPress={() => setZone(z)}
                accessibilityLabel={t('Zone {z}', { z })}
                accessibilityState={{ selected: zone === z, disabled: z > cap }}
                style={{ flex: 1, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: zone === z ? ZONE_COLORS[z - 1] : c.inset, opacity: z > cap ? 0.35 : 1 }}>
                <Text num weight={700} color={zone === z ? '#FFFFFF' : c.text}>
                  {z}
                </Text>
                {zone !== z && z <= cap ? <View style={{ position: 'absolute', bottom: 5, width: 16, height: 3, borderRadius: 2, backgroundColor: ZONE_COLORS[z - 1] }} /> : null}
              </Springy>
            ))}
          </Row>
          {cap < 5 ? (
            <Text variant="xs" color="sec" style={{ marginTop: 8 }}>
              {t('Zones above {z} are off for today.', { z: cap })}
            </Text>
          ) : null}
          {canIntervals ? (
            <>
              {line}
              <View style={{ marginBottom: 10 }}>{label(t('Type'))}</View>
              <Segmented
                value={kind}
                options={[
                  { value: 'steady', label: t('Steady') },
                  { value: 'intervals', label: t('Intervals') },
                ]}
                onChange={(v) => setKind(v as CardioKind)}
              />
            </>
          ) : null}
          {line}
          <Row style={{ justifyContent: 'space-between', marginBottom: 10 }}>
            {label(t('Planned time'))}
            <Text variant="small" weight={700}>
              {minutes == null ? t('No limit') : t('{n} min', { n: minutes })}
            </Text>
          </Row>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {[...timeOptions, null].map((m) => {
              const on = minutes === m;
              return (
                <Springy
                  key={m ?? 'none'}
                  onPress={() => setMin(m)}
                  accessibilityState={{ selected: on }}
                  accessibilityLabel={m == null ? t('No limit') : t('{n} min', { n: m })}
                  style={{ minWidth: 56, height: 40, paddingHorizontal: 12, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, backgroundColor: on ? c.text : c.inset }}>
                  <Text num weight={700} size={14} color={on ? c.bg : c.text}>
                    {m == null ? t('No limit') : t('{n} min', { n: m })}
                  </Text>
                  {m === rec.minutes && !on ? <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: c.link }} /> : null}
                </Springy>
              );
            })}
          </ScrollView>
        </Card>

        <Card>
          <Springy onPress={() => setHrOpen(true)} accessibilityLabel={t('Live heart rate from')} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={{ width: 36, height: 36, borderRadius: 11, backgroundColor: c.inset, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="heart" size={18} color={c.down} />
            </View>
            <View style={{ flex: 1 }}>
              <Text weight={700}>{t('Heart rate')}</Text>
              <Text variant="xs" color="sec" numberOfLines={1}>
                {hrSub}
              </Text>
            </View>
            <Text variant="small" color="sec" numberOfLines={1} style={{ maxWidth: 130 }}>
              {hrName}
            </Text>
            <Icon name="chev" size={16} color={c.sec} />
          </Springy>
          {outdoor ? (
            <>
              {line}
              <Row gap={12}>
                <View style={{ width: 36, height: 36, borderRadius: 11, backgroundColor: c.inset, alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name="globe" size={18} color={c.link} />
                </View>
                <Text weight={700} style={{ flex: 1 }}>
                  {t('Track distance and pace with GPS')}
                </Text>
                <Toggle value={gps} onChange={setGps} label={t('Track distance and pace with GPS')} />
              </Row>
            </>
          ) : null}
          {line}
          <Row gap={12}>
            <View style={{ width: 36, height: 36, borderRadius: 11, backgroundColor: c.inset, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="mic" size={18} color={c.up} />
            </View>
            <Text weight={700} style={{ flex: 1 }}>
              {t('Speak tips')}
            </Text>
            <Toggle value={speak} onChange={setSpeakSel} label={t('Speak tips')} />
          </Row>
        </Card>
        {Platform.OS === 'web' ? (
          <Text variant="xs" color="sec" center style={{ marginTop: 4 }}>
            {t('Live heart rate and GPS work in the phone app.')}
          </Text>
        ) : null}
        <View style={{ height: 110 }} />
      </Screen>

      {/* Start, always in reach, with what you picked. */}
      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 12 + insets.bottom, backgroundColor: c.bg }}>
        <Button title={t('Start {x}', { x: t(sportInfo(sport).name) })} icon="play" onPress={start} />
        <Text variant="xs" color="sec" center style={{ marginTop: 6 }} numberOfLines={1}>
          {`${t('Zone {z}', { z: zone })} · ${minutes == null ? t('No limit') : t('{n} min', { n: minutes })} · ${hrName}`}
        </Text>
      </View>

      <Sheet open={hrOpen} onClose={() => setHrOpen(false)}>
        <Text variant="h2">{t('Live heart rate from')}</Text>
        <View style={{ height: 12 }} />
        {bleSupported ? (
          <Option
            icon="heart"
            title={sensor ? sensor.name : t('Bluetooth heart rate sensor')}
            subtitle={sensor ? t('Bluetooth sensor · live every second') : t('Chest strap, or a watch that broadcasts heart rate')}
            selected={source === 'ble' && !!sensor}
            onPress={() => {
              if (!sensor) return setScan(true);
              setSource('ble');
              setHrOpen(false);
            }}
            right={
              <Springy onPress={() => setScan(true)} accessibilityLabel={t('Find a sensor')} style={{ paddingHorizontal: 8, height: 36, justifyContent: 'center' }}>
                <Text variant="small" weight={700} color="link">
                  {sensor ? t('Change') : t('Find')}
                </Text>
              </Springy>
            }
          />
        ) : null}
        {appleWatchSupported ? (
          <Option
            icon="watch"
            title={t('Apple Watch')}
            subtitle={t('Updates every few seconds. Start a workout on your watch too.')}
            selected={source === 'apple'}
            onPress={() => {
              setSource('apple');
              setHrOpen(false);
            }}
          />
        ) : null}
        <Option
          icon="pulse"
          title={t('No sensor')}
          subtitle={t('Coaching by time and how hard it feels')}
          selected={source === 'none'}
          onPress={() => {
            setSource('none');
            setHrOpen(false);
          }}
        />
      </Sheet>

      <ScanSheet
        open={scan}
        onClose={() => setScan(false)}
        onPick={(x) => {
          setSensor(x);
          saveSensor(x);
          setSource('ble');
          setScan(false);
          setHrOpen(false);
        }}
      />
    </View>
  );
}

/** Find a Bluetooth heart rate sensor nearby; the one you pick is remembered and reconnects by itself next time. */
function ScanSheet({ open, onClose, onPick }: { open: boolean; onClose: () => void; onPick: (s: SavedSensor) => void }) {
  const { t } = useT();
  return (
    <Sheet open={open} onClose={onClose}>
      <Text variant="h3">{t('Find a heart rate sensor')}</Text>
      {/* Mounted only while open, so every opening scans afresh. */}
      {open ? <ScanList onPick={onPick} /> : null}
      <Button title={t('Close')} kind="soft" onPress={onClose} style={{ marginTop: 8 }} />
    </Sheet>
  );
}

function ScanList({ onPick }: { onPick: (s: SavedSensor) => void }) {
  const { t } = useT();
  const { colors: c } = useSettings();
  const [found, setFound] = useState<(SavedSensor & { rssi: number | null })[]>([]);
  const [st, setSt] = useState<'scanning' | 'off' | 'denied' | 'unavailable' | null>(null);
  useEffect(() => {
    const stop = scanSensors(
      (d) => setFound((xs) => [...xs.filter((x) => x.id !== d.id), d].sort((a, b) => (b.rssi ?? -999) - (a.rssi ?? -999))),
      setSt,
    );
    const end = setTimeout(stop, 20_000);
    return () => {
      clearTimeout(end);
      stop();
    };
  }, []);
  return (
    <>
      <Text variant="small" color="sec" style={{ marginTop: 6, marginBottom: 12 }}>
        {st === 'off'
          ? t('Turn on Bluetooth, then try again.')
          : st === 'denied'
            ? t('Allow Bluetooth for Adro in Settings, then try again.')
            : st === 'unavailable'
              ? t('Bluetooth isn’t available on this device.')
              : t('Wear your strap (wet the pads) or turn on heart rate broadcast on your watch.')}
      </Text>
      {found.map((d) => (
        <Springy key={d.id} onPress={() => onPick({ id: d.id, name: d.name })} style={{ minHeight: 56, borderRadius: 16, paddingHorizontal: 14, backgroundColor: c.card, marginBottom: 8, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Icon name="heart" size={18} color={ZONE_COLORS[4]} />
          <Text weight={700} style={{ flex: 1 }} numberOfLines={1}>
            {d.name}
          </Text>
          <Icon name="chev" size={16} color={c.sec} />
        </Springy>
      ))}
      {st === 'scanning' && !found.length ? (
        <Text variant="small" color="sec" center style={{ marginVertical: 16 }}>
          {t('Looking for sensors…')}
        </Text>
      ) : null}
    </>
  );
}

// ---------------------------------------------------------------------------------------------------------------------
// During
// ---------------------------------------------------------------------------------------------------------------------
/** Five zone blocks: the one you're in stands out, the target has a ring, and the time in each is under it. */
function ZoneBar({ zones, current, target }: { zones: number[]; current: number | null; target: number }) {
  const { colors: c } = useSettings();
  const { t } = useT();
  return (
    <Row gap={4} style={{ alignItems: 'flex-start' }}>
      {zones.map((sec, i) => {
        const z = i + 1;
        return (
          <View key={z} style={{ flex: 1, alignItems: 'center' }} accessibilityLabel={t('Zone {z}: {m}', { z, m: clockText(sec * 1000) })}>
            <View
              style={{
                alignSelf: 'stretch',
                height: current === z ? 16 : 10,
                marginTop: current === z ? 0 : 3,
                borderRadius: 8,
                backgroundColor: ZONE_COLORS[i],
                opacity: current == null || current === z ? 1 : 0.35,
                borderWidth: target === z ? 2 : 0,
                borderColor: c.text,
              }}
            />
            <Text num size={11} color="sec" style={{ marginTop: 4 }}>
              {clockText(sec * 1000)}
            </Text>
          </View>
        );
      })}
    </Row>
  );
}

/** Sets (racket sports) or rounds (combat): how many are done, the current one's time, and the rest timer between. */
function RoundCard({ s, now, counter }: { s: CardioSessionState; now: number; counter: NonNullable<ReturnType<typeof sportInfo>['counter']> }) {
  const { t } = useT();
  const { colors: c } = useSettings();
  const resting = s.restUntil != null && s.restUntil > now;
  const round = counter.label === 'Round';
  const left = counter.roundSec && s.roundAt ? Math.max(0, counter.roundSec * 1000 - (now - s.roundAt)) : null;
  return (
    <Card style={resting ? { backgroundColor: c.cobalt } : undefined}>
      <Row style={{ justifyContent: 'space-between' }}>
        <View style={{ flex: 1 }}>
          <Text variant="xs" weight={700} color={resting ? '#FFFFFF' : 'sec'}>
            {resting ? t('Rest') : round ? t('Round {n}', { n: s.rounds + 1 }) : t('Set {n}', { n: s.rounds + 1 })}
          </Text>
          <Text num size={28} color={resting ? '#FFFFFF' : c.text}>
            {resting ? clockText((s.restUntil as number) - now) : left != null ? clockText(left) : s.roundAt ? clockText(now - s.roundAt) : '0:00'}
          </Text>
          <Text variant="xs" color={resting ? '#FFFFFF' : 'sec'}>
            {round ? t(s.rounds === 1 ? '1 round done' : '{n} rounds done', { n: s.rounds }) : t(s.rounds === 1 ? '1 set done' : '{n} sets done', { n: s.rounds })}
          </Text>
        </View>
        {resting ? (
          <Button small kind="glass" color="#FFFFFF" title={t('Skip rest')} onPress={() => startRound()} />
        ) : (
          <Button small title={round ? t('End round') : t('Set done')} onPress={() => endRound(counter.rest)} />
        )}
      </Row>
      {!round ? <ScoreRow s={s} light={resting} /> : null}
    </Card>
  );
}

/** The score, small: tap your side or theirs to add a point (game in padel and tennis), "−" takes the last one back. */
function ScoreRow({ s, light }: { s: CardioSessionState; light: boolean }) {
  const { t } = useT();
  const { colors: c } = useSettings();
  const sc = s.score ?? [0, 0];
  const done = (s.setScores ?? []).map(([a, b]) => `${a}-${b}`).join('  ·  ');
  const fg = light ? '#FFFFFF' : c.text;
  const side = (i: 0 | 1, label: string) => (
    <Row style={{ flex: 1, gap: 6, alignItems: 'center' }}>
      <Springy onPress={() => addScore(i)} accessibilityLabel={t('Add a point: {x}', { x: label })} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, height: 36, borderRadius: 18, backgroundColor: light ? 'rgba(255,255,255,0.18)' : c.inset }}>
        <Text variant="xs" weight={700} color={light ? '#FFFFFF' : 'sec'} numberOfLines={1}>
          {label}
        </Text>
        <Text num weight={700} size={18} color={fg}>
          {sc[i]}
        </Text>
      </Springy>
      <Springy onPress={() => addScore(i, -1)} hitSlop={6} accessibilityLabel={t('Take a point back: {x}', { x: label })} style={{ width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' }}>
        <Text weight={700} color={light ? '#FFFFFF' : 'sec'}>
          −
        </Text>
      </Springy>
    </Row>
  );
  return (
    <View style={{ marginTop: 10 }}>
      <Row style={{ gap: 8 }}>
        {side(0, t('You'))}
        {side(1, t('Them'))}
      </Row>
      {done ? (
        <Text variant="xs" color={light ? '#FFFFFF' : 'sec'} style={{ marginTop: 6, writingDirection: 'ltr' } as object}>
          {t('Sets: {x}', { x: done })}
        </Text>
      ) : null}
    </View>
  );
}

function LiveView({ s }: { s: CardioSessionState }) {
  useKeepAwake('adro-cardio');
  const { t } = useT();
  const { colors: c } = useSettings();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const iv = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(iv);
  }, []);
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const tm = setTimeout(() => setArmed(false), 3000);
    return () => clearTimeout(tm);
  }, [armed]);

  const { ph, want, zone, judged, loose, g } = sessionGuide(s, now);
  const counter = sportInfo(s.sport).counter;
  const fresh = s.hr != null && s.hrAt != null && now - s.hrAt < 15_000;
  const pace = paceText(speedNow(s, now), s.sport);
  const kcal = sessionKcal(s, now);
  const paused = !!s.pausedAt;
  const tipText = s.tip ? (s.tip.text ?? t(s.tip.key, s.tip.vars)) : '';
  const toneColor = g?.tone === 'up' ? c.up : g?.tone === 'down' ? '#F59E0B' : c.text;
  const hrLine =
    s.source === 'none'
      ? null
      : s.hrStatus === 'unavailable'
        ? t('Heart rate isn’t available. Rate how hard it feels instead.')
        : s.hrStatus === 'lost'
          ? t('Sensor lost. Reconnecting…')
          : s.hrStatus === 'connecting'
            ? t('Connecting to {x}…', { x: s.sensor?.name ?? t('your sensor') })
            : !fresh
              ? s.source === 'apple'
                ? t('Waiting for your Apple Watch. Start a workout on it.')
                : t('Waiting for heart rate…')
              : s.source === 'apple'
                ? t('Apple Watch (updates every few seconds)')
                : t('{x} · live', { x: s.sensor?.name ?? t('Sensor') });
  const showRpe = s.source === 'none' || s.hrStatus === 'unavailable';

  return (
    <Screen title={t(sportInfo(s.sport).name)} back>
      <View style={{ alignItems: 'center', marginTop: 4, marginBottom: 12 }}>
        <Text num size={64} weight={700} color={paused ? '#F59E0B' : c.text} accessibilityLabel={t('Time')}>
          {clockText(movingMs(s, now))}
        </Text>
        <Text variant="small" color="sec">
          {paused ? t('Paused') : s.planMin ? t('Goal {n} min · zone {z}', { n: s.planMin, z: s.target }) : t('Target zone {z}', { z: s.target })}
        </Text>
      </View>

      {ph && ph.phase !== 'free' ? (
        <Card style={{ backgroundColor: ph.phase === 'work' ? ZONE_COLORS[3] : c.card, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text weight={700} color={ph.phase === 'work' ? '#FFFFFF' : c.text}>
            {ph.phase === 'work' ? t('Push · round {r}', { r: ph.round }) : ph.phase === 'rest' ? t('Recover') : ph.phase === 'warm' ? t('Warm up') : t('Cool down')}
          </Text>
          <Text num size={24} color={ph.phase === 'work' ? '#FFFFFF' : c.text}>
            {clockText(ph.left * 1000)}
          </Text>
        </Card>
      ) : null}

      {counter ? <RoundCard s={s} now={now} counter={counter} /> : null}

      {s.source !== 'none' || zone != null ? (
        <Card>
          <Row style={{ justifyContent: 'space-between' }}>
            <Row gap={8}>
              <Icon name="heart" size={22} color={zone ? ZONE_COLORS[zone - 1] : c.sec} />
              <Text num size={40} color={fresh ? c.text : c.sec}>
                {s.hr != null && s.source !== 'none' ? String(s.hr) : '--'}
              </Text>
              <Text variant="small" color="sec">
                {t('bpm')}
              </Text>
            </Row>
            {zone ? (
              <View style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: ZONE_COLORS[zone - 1] }}>
                <Text weight={700} size={14} color="#FFFFFF">
                  {t('Zone {z}', { z: zone })}
                </Text>
              </View>
            ) : null}
          </Row>
          {hrLine ? (
            <Text variant="xs" color="sec" style={{ marginTop: 4 }}>
              {hrLine}
            </Text>
          ) : null}
          <View style={{ marginTop: 14 }}>
            <ZoneBar zones={s.zones} current={zone} target={want} />
          </View>
          {loose && judged ? (
            <Text variant="xs" color="sec" style={{ marginTop: 8 }}>
              {t('Whole session so far: zone {z} on average. Short spikes are normal in this sport.', { z: judged })}
            </Text>
          ) : null}
        </Card>
      ) : null}

      {g ? (
        <Text weight={700} size={18} center color={toneColor} style={{ marginBottom: 12 }}>
          {t(g.line.key, g.line.vars)}
        </Text>
      ) : null}

      {showRpe ? (
        <Card>
          <Text variant="small" weight={700} color="sec">
            {t('How hard does it feel? 1–10')}
          </Text>
          <Row gap={6} style={{ marginTop: 10, flexWrap: 'wrap' }}>
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((v) => (
              <Springy
                key={v}
                onPress={() => setRpe(v)}
                accessibilityLabel={String(v)}
                accessibilityState={{ selected: s.rpe === v }}
                style={{ width: '17%', flexGrow: 1, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: s.rpe === v ? c.cobalt : c.inset }}>
                <Text num weight={700} color={s.rpe === v ? '#FFFFFF' : c.text}>
                  {v}
                </Text>
              </Springy>
            ))}
          </Row>
          <Text variant="xs" color="sec" style={{ marginTop: 8 }}>
            {t('Target: {a} to {b} (zone {z})', { a: ltr(zoneRpe(want)[0]), b: ltr(zoneRpe(want)[1]), z: want })}
          </Text>
        </Card>
      ) : null}

      <Row gap={10} style={{ marginBottom: 12 }}>
        {s.gps ? (
          <Card style={{ flex: 1, marginBottom: 0 }}>
            <Text variant="xs" color="sec">
              {t('Distance')}
            </Text>
            <Text num size={24}>
              {kmText(s.dist)}
            </Text>
            <Text variant="xs" color="sec">
              {s.gpsStatus === 'denied' || s.gpsStatus === 'unavailable' ? t('GPS off') : s.gpsStatus === 'waiting' ? t('Finding GPS…') : t('km')}
            </Text>
          </Card>
        ) : null}
        {s.gps ? (
          <Card style={{ flex: 1, marginBottom: 0 }}>
            <Text variant="xs" color="sec">
              {s.sport === 'Bike' ? t('Speed') : t('Pace')}
            </Text>
            <Text num size={24}>
              {pace ? pace.value : '--'}
            </Text>
            <Text variant="xs" color="sec">
              {t(s.sport === 'Bike' ? 'km/h' : '/km')}
            </Text>
          </Card>
        ) : null}
        <Card style={{ flex: 1, marginBottom: 0 }}>
          <Text variant="xs" color="sec">
            {t('Calories')}
          </Text>
          <Text num size={24}>
            {String(kcal)}
          </Text>
          <Text variant="xs" color="sec">
            {t('kcal')}
          </Text>
        </Card>
      </Row>

      {tipText ? (
        <Card>
          <Row gap={8} style={{ alignItems: 'flex-start' }}>
            <Icon name="sparkle" size={18} color={c.cobalt} />
            <View style={{ flex: 1 }}>
              <Text variant="xs" weight={700} color="sec">
                {s.tip?.ai ? t('AI coach') : t('Coach')}
              </Text>
              <Text>{tipText}</Text>
            </View>
          </Row>
        </Card>
      ) : null}

      <Row gap={10} style={{ marginTop: 4 }}>
        <Button title={paused ? t('Resume') : t('Pause')} icon={paused ? 'play' : 'pause'} kind="soft" onPress={() => (paused ? resumeCardio() : pauseCardio())} style={{ flex: 1 }} />
        <Button
          title={armed ? t('Tap again to finish') : t('Finish')}
          kind={armed ? 'danger' : 'primary'}
          onPress={() => {
            if (!armed) return setArmed(true);
            finishCardio();
          }}
          style={{ flex: 1 }}
        />
      </Row>
      <Springy
        onPress={() => {
          if (s.speak) hush();
          setSpeak(!s.speak);
        }}
        style={{ alignSelf: 'center', marginTop: 14, flexDirection: 'row', alignItems: 'center', gap: 6, padding: 8 }}>
        <Icon name="mic" size={16} color={s.speak ? c.cobalt : c.sec} />
        <Text variant="small" weight={700} color={s.speak ? 'link' : 'sec'}>
          {s.speak ? t('Speaking tips: on') : t('Speaking tips: off')}
        </Text>
      </Springy>
    </Screen>
  );
}

// ---------------------------------------------------------------------------------------------------------------------
// After
// ---------------------------------------------------------------------------------------------------------------------
function Summary({ s }: { s: CardioSessionState }) {
  const { t } = useT();
  const { colors: c } = useSettings();
  const food = useFood();
  const toast = useToast();
  const a = avgHr(s);
  const kcal = sessionKcal(s);
  const ms = movingMs(s);
  const total = s.zones.reduce((x, v) => x + v, 0);
  const note = s.note ? (s.note.text ?? t(s.note.key, s.note.vars)) : null;
  const avgPace = useMemo(() => (s.gps && s.dist > 50 ? paceText(s.dist / Math.max(1, ms / 1000), s.sport) : null), [s.gps, s.dist, ms, s.sport]);
  const done = () => {
    clearCardio();
    if (router.canGoBack()) router.back();
    else router.replace('/cardio');
  };

  return (
    <Screen title={t('Cardio done')} onBack={done} back>
      <View style={{ alignItems: 'center', marginBottom: 14 }}>
        <Icon name={icon(s.sport)} size={28} color={c.cobalt} />
        <Text num size={48} weight={700} style={{ marginTop: 6 }}>
          {clockText(ms)}
        </Text>
        <Text variant="small" color="sec">
          {t(sportInfo(s.sport).name)}
        </Text>
      </View>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 12 }}>
        {[
          s.gps ? { k: t('Distance'), v: `${kmText(s.dist)}`, u: t('km') } : null,
          avgPace ? { k: s.sport === 'Bike' ? t('Avg speed') : t('Avg pace'), v: avgPace.value, u: t(avgPace.unit) } : null,
          a ? { k: t('Avg heart rate'), v: String(a), u: t('bpm') } : null,
          s.hrMax >= 30 ? { k: t('Max heart rate'), v: String(s.hrMax), u: t('bpm') } : null,
          { k: t('Calories'), v: String(kcal), u: t('kcal') },
          sportInfo(s.sport).counter && s.rounds ? { k: sportInfo(s.sport).counter?.label === 'Round' ? t('Rounds') : t('Sets'), v: String(s.rounds), u: '' } : null,
          scoreText(s) ? { k: t('Score'), v: (scoreText(s) as string).replace(/, /g, ' · '), u: '' } : null,
        ]
          .filter((x): x is { k: string; v: string; u: string } => !!x)
          .map((x) => (
            <Card key={x.k} style={{ width: '47%', flexGrow: 1, marginBottom: 0 }}>
              <Text variant="xs" color="sec">
                {x.k}
              </Text>
              <Text num size={24}>
                {x.v}
              </Text>
              <Text variant="xs" color="sec">
                {x.u}
              </Text>
            </Card>
          ))}
      </View>

      {total > 30 ? (
        <Card>
          <Text variant="small" weight={700} color="sec" style={{ marginBottom: 10 }}>
            {t('Time in zones')}
          </Text>
          {s.zones.map((sec, i) => (
            <Row key={i} gap={10} style={{ marginBottom: 6 }}>
              <Text num size={13} style={{ width: 18 }}>
                {i + 1}
              </Text>
              <View style={{ flex: 1, height: 10, borderRadius: 5, backgroundColor: c.track, overflow: 'hidden' }}>
                <View style={{ width: `${Math.round((sec / total) * 100)}%`, height: 10, borderRadius: 5, backgroundColor: ZONE_COLORS[i] }} />
              </View>
              <Text num size={13} color="sec" style={{ width: 52, textAlign: 'right' }}>
                {clockText(sec * 1000)}
              </Text>
            </Row>
          ))}
        </Card>
      ) : null}

      <Card>
        <Row gap={8} style={{ alignItems: 'flex-start' }}>
          <Icon name="sparkle" size={18} color={c.cobalt} />
          <View style={{ flex: 1 }}>
            <Text variant="xs" weight={700} color="sec">
              {s.note?.ai ? t('AI coach') : t('Coach')}
            </Text>
            <Text color={note ? 'text' : 'sec'}>{note ?? (s.saveState === 'short' ? t('Too short to save.') : t('Your coach is looking at your session…'))}</Text>
          </View>
        </Row>
      </Card>

      <Text variant="small" color={s.saveState === 'failed' ? 'down' : 'sec'} center style={{ marginBottom: 12 }}>
        {s.saveState === 'saved'
          ? t('Saved to today’s cardio: +{n} kcal to today’s budget.', { n: kcal })
          : s.saveState === 'saving'
            ? t('Saving…')
            : s.saveState === 'failed'
              ? t('Couldn’t save. Please try again.')
              : s.saveState === 'short'
                ? t('Sessions under a minute aren’t saved.')
                : ''}
      </Text>
      {s.saveState === 'failed' ? <Button title={t('Try again')} onPress={() => setSaved({ saveState: 'saving' })} style={{ marginBottom: 10 }} /> : null}
      <Button title={t('Done')} onPress={done} kind={s.saveState === 'failed' ? 'soft' : 'primary'} />
      {s.saveState === 'saved' && s.savedId ? (
        <Button
          title={t('Delete this session')}
          kind="ghost"
          style={{ marginTop: 6 }}
          onPress={async () => {
            await food.deleteCardio(s.savedId as string);
            toast(t('Deleted'), { icon: 'trash' });
            done();
          }}
        />
      ) : null}
    </Screen>
  );
}
