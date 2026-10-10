import { router } from 'expo-router';
import { createElement, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Glass } from '@/components/Glass';
import { Icon } from '@/components/Icon';
import { ManualCode } from '@/components/food/ManualCode';
import { Text } from '@/components/Text';
import { Button, Springy } from '@/components/ui';
import { useT } from '@/i18n';
import { reader, readBarcode, readBarcodeFile } from '@/lib/readBarcode';

const NOT_READ = 'Couldn’t read the barcode. Get closer, keep it sharp and well lit, then try again.';

/** Take a photo of a barcode (web: camera + ZXing). The live camera also reads it on its own. */
export default function Barcode() {
  const { t } = useT();
  const insets = useSafeAreaInsets();
  const video = useRef<HTMLVideoElement | null>(null);
  const takeInput = useRef<HTMLInputElement | null>(null);
  const pickInput = useRef<HTMLInputElement | null>(null);
  const noCamera = typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia;
  const [live, setLive] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [manual, setManual] = useState(false);
  const done = useRef(false);

  const found = (code: string) => {
    if (done.current) return;
    done.current = true;
    try {
      navigator.vibrate?.(30);
    } catch {}
    router.replace({ pathname: '/product', params: { code } });
  };

  useEffect(() => {
    let controls: { stop: () => void } | null = null;
    let stopped = false;
    if (noCamera) return;
    reader
      .decodeFromConstraints({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false }, video.current ?? undefined, (result) => {
        if (result) found(result.getText());
      })
      .then((c) => {
        controls = c;
        if (stopped) c.stop();
        else setLive(true);
      })
      .catch(() => {});
    return () => {
      stopped = true;
      controls?.stop();
    };
    // Start the camera once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Shutter: read the barcode from what the camera sees now, or open the phone's camera. */
  const shoot = async () => {
    const v = video.current;
    if (!live || !v || !v.videoWidth) return takeInput.current?.click();
    setBusy(true);
    setMsg(null);
    const code = await readBarcode(v, v.videoWidth, v.videoHeight);
    setBusy(false);
    if (code) found(code);
    else setMsg(NOT_READ);
  };

  const onFile = async (e: { target: HTMLInputElement }) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setBusy(true);
    setMsg(null);
    const code = await readBarcodeFile(file);
    setBusy(false);
    if (code) found(code);
    else setMsg(NOT_READ);
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#0d0d10' }}>
      {createElement('video', {
        ref: video,
        playsInline: true,
        muted: true,
        autoPlay: true,
        style: { position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' },
      })}
      {createElement('input', { ref: takeInput, type: 'file', accept: 'image/*', capture: 'environment', onChange: onFile, style: { display: 'none' } })}
      {createElement('input', { ref: pickInput, type: 'file', accept: 'image/*', onChange: onFile, style: { display: 'none' } })}

      {/* Darken around the scan window. */}
      <View pointerEvents="none" style={{ position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center', paddingBottom: 120 } as object}>
        <View style={{ width: 280, height: 180, borderRadius: 24, borderWidth: 3, borderColor: 'rgba(255,255,255,0.9)', boxShadow: '0px 0px 0px 2000px rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center' }}>
          {live ? null : <Icon name="barcode" size={64} color="rgba(255,255,255,0.7)" strokeWidth={1.4} />}
        </View>
      </View>

      <View style={{ position: 'absolute', top: Math.max(10, insets.top) + 4, left: 14, right: 14, flexDirection: 'row', justifyContent: 'space-between' }}>
        <Springy onPress={() => router.back()} scaleTo={1.08} accessibilityLabel={t('Close')}>
          <Glass style={{ width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="close" size={20} color="#FFFFFF" strokeWidth={2.2} />
          </Glass>
        </Springy>
      </View>

      <View style={{ position: 'absolute', left: 20, right: 20, bottom: 28 + insets.bottom, alignItems: 'center', gap: 14 }}>
        <Glass style={{ borderRadius: 22, paddingVertical: 10, paddingHorizontal: 18 }}>
          <Text weight={600} color="#FFFFFF" center>
            {busy ? t('Reading the barcode…') : msg ? t(msg) : t('Put the barcode in the box and take a photo')}
          </Text>
        </Glass>
        <Springy
          onPress={shoot}
          disabled={busy}
          scaleTo={0.92}
          accessibilityRole="button"
          accessibilityLabel={t('Take a photo')}
          style={{ width: 78, height: 78, borderRadius: 39, borderWidth: 4, borderColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' }}>
          <View style={{ width: 62, height: 62, borderRadius: 31, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' }}>
            {busy ? <ActivityIndicator color="#0A0A0B" /> : <Icon name="camera" size={28} color="#0A0A0B" />}
          </View>
        </Springy>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Button small kind="glass" color="#FFFFFF" icon="doc" title={t('Choose a photo')} onPress={() => pickInput.current?.click()} />
          <Button small kind="glass" color="#FFFFFF" title={t('Type the code')} onPress={() => setManual(true)} />
        </View>
      </View>

      <ManualCode
        open={manual}
        onClose={() => setManual(false)}
        onCode={(code) => {
          setManual(false);
          found(code);
        }}
      />
    </View>
  );
}
