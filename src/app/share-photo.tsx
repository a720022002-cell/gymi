import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Platform, useWindowDimensions, View } from 'react-native';

import { Screen } from '@/components/Screen';
import { StoryOverlay } from '@/components/share/StoryOverlay';
import { Text } from '@/components/Text';
import { useToast } from '@/components/Toast';
import { useRecovery } from '@/components/train/RecoveryCard';
import { Button, Chip, Row } from '@/components/ui';
import { useT } from '@/i18n';
import { useAuth } from '@/lib/auth';
import { useHealth } from '@/lib/health';
import { fmt } from '@/lib/nutrition';
import { drawOverlay, OVERLAY_SIZE, type OverlayData, type OverlayStyle } from '@/lib/overlay';
import { useTrain } from '@/lib/train';
import { EX, workoutTitle } from '@/lib/training';
import { useWeight } from '@/lib/units';
import { captureStory, canShareStory } from '@/lib/storyShot';
import { useSettings } from '@/theme/settings';

const STYLES: [OverlayStyle, string][] = [
  ['stats', 'Numbers'],
  ['rings', 'Rings'],
  ['record', 'Record'],
  ['line', 'Minimal'],
];

/** Your workout on a photo, ready for your story (like Strava and Whoop). Works for any workout you did, not just today's. */
export default function SharePhoto() {
  const { t, lang } = useT();
  const { colors: c } = useSettings();
  const toast = useToast();
  const W = useWeight();
  const train = useTrain();
  const health = useHealth();
  const { r: todayRec } = useRecovery();
  const { profile } = useAuth();
  const username = profile?.username;
  const { id } = useLocalSearchParams<{ id?: string }>();
  const log = train.logs.find((l) => l.id === id) ?? train.logs[0];
  const [style, setStyle] = useState<OverlayStyle>('stats');
  const [photo, setPhoto] = useState<HTMLImageElement | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const web = Platform.OS === 'web' && typeof document !== 'undefined';
  // On a phone: the story is drawn as views, then captured as a picture.
  const [phonePhoto, setPhonePhoto] = useState<string | null>(null);
  const [stickerShot, setStickerShot] = useState(false);
  const storyRef = useRef<View>(null);
  const { width: screenW } = useWindowDimensions();

  const data = useMemo<OverlayData | null>(() => {
    if (!log) return null;
    const rtl = lang === 'ar';
    const title = workoutTitle(log.name, t);
    const date = new Intl.DateTimeFormat(rtl ? 'ar-u-nu-latn' : 'en-US', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(`${log.day}T12:00:00`));
    const ci = health.checkins.find((x) => x.day === log.day);
    const rec = ci?.score ?? (log.day === train.today ? todayRec.score : null);
    const sleep = ci?.sleep_h ?? null;
    const exName = (exId: string, n: string) => (rtl && EX[exId]?.ar ? EX[exId].ar : n);
    const vol = `${fmt(W.num(log.volume))} ${W.label}`;
    const rings = [
      rec != null ? { v: rec / 100, big: `${Math.round(rec)}%`, label: t('Recovery'), color: '#22c55e' } : null,
      sleep != null ? { v: sleep / 8, big: `${Math.floor(sleep)}:${String(Math.round((sleep % 1) * 60)).padStart(2, '0')}`, label: t('Sleep'), color: '#a78bfa' } : null,
      { v: log.kcal / 500, big: fmt(log.kcal), label: t('kcal'), color: '#f59e0b' },
      { v: log.minutes / 60, big: String(log.minutes), label: t('min'), color: '#3355ff' },
      { v: log.sets_done / 20, big: String(log.sets_done), label: t('Sets'), color: '#3355ff' },
    ].filter((x): x is NonNullable<typeof x> => !!x);
    // The new record, or the heaviest set if there's none.
    const pr = log.prs?.[0];
    const sets = log.exercises.flatMap((x) => x.sets.map((s) => ({ id: x.id, n: x.n, ...s })));
    const top = pr ? (sets.find((s) => s.id === pr.id && s.w === pr.w) ?? { id: pr.id, n: pr.n, w: pr.w, r: 0 }) : sets.reduce<(typeof sets)[number] | null>((b, s) => (!b || s.w > b.w ? s : b), null);
    return {
      rtl,
      title: rtl ? title : title.toUpperCase(),
      date,
      handle: username ? `@${username}` : '',
      stats: [
        { label: t('Time'), value: `${log.minutes} ${t('min')}` },
        { label: t('Volume'), value: vol },
        { label: t('Calories'), value: fmt(log.kcal) },
      ],
      rings: rings.slice(0, 3),
      record: {
        kicker: pr ? t('NEW RECORD') : t('TOP SET'),
        name: top ? exName(top.id, top.n) : title,
        big: top ? W.show(top.w) : '–',
        unit: top?.r ? `${W.label} × ${top.r}` : W.label,
        sub: pr ? t('New best weight') : title,
      },
      line: [title, `${log.minutes} ${t('min')}`, vol, `${fmt(log.kcal)} ${t('kcal')}`].join('  ·  '),
    };
  }, [log, lang, t, health.checkins, train.today, todayRec.score, W, username]);

  const canvas = useMemo(() => {
    if (!web) return null;
    const el = document.createElement('canvas');
    el.width = OVERLAY_SIZE.w;
    el.height = OVERLAY_SIZE.h;
    return el;
  }, [web]);

  useEffect(() => {
    if (!canvas || !data) return;
    let alive = true;
    document.fonts.ready.then(() => {
      const ctx = canvas.getContext('2d');
      if (!alive || !ctx) return;
      drawOverlay(ctx, style, data, photo);
      setPreview(canvas.toDataURL('image/jpeg', 0.85));
    });
    return () => {
      alive = false;
    };
  }, [canvas, data, style, photo]);

  const pick = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1 });
    const uri = res.canceled ? null : res.assets?.[0]?.uri;
    if (!uri) return;
    const img = new window.Image();
    img.onload = () => setPhoto(img);
    img.onerror = () => toast(t('Couldn’t open that photo. Try another one.'), { icon: 'warn' });
    img.src = uri;
  };

  // Share sheet where the phone has one (Instagram, Snapchat, save to photos); otherwise a download.
  const share = async (sticker: boolean) => {
    if (!canvas || !data) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    setBusy(true);
    drawOverlay(ctx, style, data, photo, sticker);
    const blob = await new Promise<Blob | null>((ok) => canvas.toBlob(ok, sticker ? 'image/png' : 'image/jpeg', 0.92));
    drawOverlay(ctx, style, data, photo);
    setBusy(false);
    if (!blob) return toast(t('Couldn’t make the picture. Please try again.'), { icon: 'warn' });
    const name = sticker ? 'adro-sticker.png' : 'adro-workout.jpg';
    const file = new File([blob], name, { type: blob.type });
    try {
      if (navigator.canShare?.({ files: [file] })) return await navigator.share({ files: [file] });
    } catch (e) {
      if ((e as Error)?.name === 'AbortError') return;
    }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
    toast(t('Saved to your downloads'), { icon: 'check' });
  };

  if (!log)
    return (
      <Screen title={t('Share on a photo')} back>
        <Text color="sec">{t('No workout yet.')}</Text>
      </Screen>
    );
  if (!web) {
    if (!canShareStory() || !data)
      return (
        <Screen title={t('Share on a photo')} back>
          <Text color="sec">{t('Update Adro from the App Store to share on a photo.')}</Text>
        </Screen>
      );
    const pickPhone = async () => {
      const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1 });
      const uri = res.canceled ? null : res.assets?.[0]?.uri;
      if (uri) setPhonePhoto(uri);
    };
    // Draw it (as a see-through sticker if asked), take the picture, then the phone's share sheet (Instagram, save…).
    const sharePhone = async (sticker: boolean) => {
      setBusy(true);
      setStickerShot(sticker);
      await new Promise((r) => setTimeout(r, 120));
      const uri = await captureStory(storyRef.current, sticker);
      setStickerShot(false);
      setBusy(false);
      if (!uri) return toast(t('Couldn’t make the picture. Please try again.'), { icon: 'warn' });
      if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(uri, { mimeType: sticker ? 'image/png' : 'image/jpeg', UTI: sticker ? 'public.png' : 'public.jpeg' }).catch(() => {});
    };
    const pw = Math.min(300, screenW * 0.72);
    return (
      <Screen title={t('Share on a photo')} back>
        <Text color="sec" style={{ marginTop: -8 }}>
          {t('Add a gym photo and pick a style. Then share it to your story or save it.')}
        </Text>
        <View style={{ alignItems: 'center', marginTop: 14 }}>
          <View style={{ borderRadius: 24, overflow: 'hidden', backgroundColor: stickerShot ? 'transparent' : '#000' }}>
            <StoryOverlay style={style} d={data} photo={phonePhoto} sticker={stickerShot} width={pw} viewRef={storyRef} />
          </View>
        </View>
        <Row gap={8} style={{ marginTop: 16, flexWrap: 'wrap', justifyContent: 'center' }}>
          {STYLES.map(([k, label]) => (
            <Chip key={k} title={t(label)} on={style === k} onPress={() => setStyle(k)} />
          ))}
        </Row>
        <Button kind="soft" icon="camera" color={c.text} title={phonePhoto ? t('Change photo') : t('Choose a photo')} style={{ marginTop: 16 }} onPress={pickPhone} />
        <Button icon="share" title={t('Share picture')} style={{ marginTop: 8 }} loading={busy && !stickerShot} disabled={busy} onPress={() => sharePhone(false)} />
        <Button kind="glass" title={t('Sticker only (see-through)')} style={{ marginTop: 8 }} disabled={busy} onPress={() => sharePhone(true)} />
        <Text variant="xs" color="sec" center style={{ marginTop: 10 }}>
          {t('The sticker has no background, so you can put it on any photo or video in Instagram or Snapchat. Your photo stays on your phone.')}
        </Text>
      </Screen>
    );
  }

  return (
    <Screen title={t('Share on a photo')} back>
      <Text color="sec" style={{ marginTop: -8 }}>
        {t('Add a gym photo and pick a style. Then share it to your story or save it.')}
      </Text>
      <View style={{ alignItems: 'center', marginTop: 14 }}>
        <View style={{ width: '72%', maxWidth: 300, aspectRatio: 9 / 16, borderRadius: 24, overflow: 'hidden', backgroundColor: '#000' }}>
          {preview ? <Image source={{ uri: preview }} style={{ flex: 1 }} contentFit="cover" accessibilityLabel={t('Your workout on the photo')} /> : null}
        </View>
      </View>
      <Row gap={8} style={{ marginTop: 16, flexWrap: 'wrap', justifyContent: 'center' }}>
        {STYLES.map(([k, label]) => (
          <Chip key={k} title={t(label)} on={style === k} onPress={() => setStyle(k)} />
        ))}
      </Row>
      <Button kind="soft" icon="camera" color={c.text} title={photo ? t('Change photo') : t('Choose a photo')} style={{ marginTop: 16 }} onPress={pick} />
      <Button icon="share" title={t('Share picture')} style={{ marginTop: 8 }} disabled={busy} onPress={() => share(false)} />
      <Button kind="glass" title={t('Sticker only (see-through)')} style={{ marginTop: 8 }} disabled={busy} onPress={() => share(true)} />
      <Text variant="xs" color="sec" center style={{ marginTop: 10 }}>
        {t('The sticker has no background, so you can put it on any photo or video in Instagram or Snapchat. Your photo stays on your phone.')}
      </Text>
    </Screen>
  );
}
