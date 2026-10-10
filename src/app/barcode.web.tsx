import { BrowserMultiFormatReader } from '@zxing/browser';
import { router } from 'expo-router';
import { createElement, useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Glass } from '@/components/Glass';
import { Icon } from '@/components/Icon';
import { ManualCode } from '@/components/food/ManualCode';
import { Text } from '@/components/Text';
import { Button, Springy } from '@/components/ui';
import { useT } from '@/i18n';

/** Point the camera at a barcode (web: camera + ZXing). */
export default function Barcode() {
  const { t } = useT();
  const insets = useSafeAreaInsets();
  const video = useRef<HTMLVideoElement | null>(null);
  const noCamera = typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia;
  const [error, setError] = useState<string | null>(noCamera ? 'This browser can’t use the camera. Enter the code instead.' : null);
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
    const reader = new BrowserMultiFormatReader();
    if (noCamera) return;
    reader
      .decodeFromConstraints({ video: { facingMode: { ideal: 'environment' } }, audio: false }, video.current ?? undefined, (result) => {
        if (result) found(result.getText());
      })
      .then((c) => (controls = c))
      .catch(() => setError('Camera access is off. Allow the camera for this site, or enter the code instead.'));
    return () => controls?.stop();
    // Start the camera once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: '#0d0d10' }}>
      {createElement('video', {
        ref: video,
        playsInline: true,
        muted: true,
        autoPlay: true,
        style: { position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' },
      })}
      {/* Darken around the scan window. */}
      <View pointerEvents="none" style={{ position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center' } as object}>
        <View style={{ width: 280, height: 180, borderRadius: 24, borderWidth: 3, borderColor: 'rgba(255,255,255,0.9)', boxShadow: '0px 0px 0px 2000px rgba(0,0,0,0.45)' }}>
          <View style={{ position: 'absolute', left: 16, right: 16, top: '50%', height: 2, backgroundColor: '#7088FF', boxShadow: '0px 0px 12px #3355FF' }} />
        </View>
      </View>

      <View style={{ position: 'absolute', top: Math.max(10, insets.top) + 4, left: 14, right: 14, flexDirection: 'row', justifyContent: 'space-between' }}>
        <Springy onPress={() => router.back()} scaleTo={1.08} accessibilityLabel={t('Close')}>
          <Glass style={{ width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="close" size={20} color="#FFFFFF" strokeWidth={2.2} />
          </Glass>
        </Springy>
      </View>

      <View style={{ position: 'absolute', left: 20, right: 20, bottom: 40 + insets.bottom, alignItems: 'center', gap: 12 }}>
        <Glass style={{ borderRadius: 22, paddingVertical: 10, paddingHorizontal: 18 }}>
          <Text weight={600} color="#FFFFFF" center>
            {error ? t(error) : t('Point at a barcode')}
          </Text>
        </Glass>
        <Button small kind="glass" color="#FFFFFF" title={t('Enter the code by hand')} style={{ alignSelf: 'center' }} onPress={() => setManual(true)} />
      </View>

      <ManualCode open={manual} onClose={() => setManual(false)} onCode={(code) => { setManual(false); found(code); }} />
    </View>
  );
}
