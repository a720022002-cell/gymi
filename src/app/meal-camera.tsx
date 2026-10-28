import { CameraView, useCameraPermissions } from 'expo-camera';
import { router, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { ActivityIndicator, Linking, View } from 'react-native';

import { Field } from '@/components/Field';
import { Glass } from '@/components/Glass';
import { Icon } from '@/components/Icon';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { Button, Card, Springy } from '@/components/ui';
import { useT } from '@/i18n';
import { goBack } from '@/lib/nav';
import { setPendingCapture, setPendingPhoto } from '@/lib/pending';
import { type Photo, photoFromUri, takePhoto } from '@/lib/photo';
import { useSettings } from '@/theme/settings';

/** Phone apps: our own camera for a meal photo or a nutrition label (same look as the barcode screen). Then the AI reads it. */
export default function MealCamera() {
  const { t } = useT();
  const { colors: c } = useSettings();
  const [perm, ask] = useCameraPermissions();
  const [torch, setTorch] = useState(false);
  const [busy, setBusy] = useState(false);
  // What the dish is, in your words (optional): the AI trusts it over the photo, so the numbers come out closer.
  const [desc, setDesc] = useState('');
  const cam = useRef<CameraView>(null);
  // `pick`: opened by a screen that wants the photo back ("Add an ingredient", reading a label into a product form)
  // instead of logging it.
  const { pick, kind: kindParam } = useLocalSearchParams<{ pick?: string; kind?: string }>();
  const kind = kindParam === 'label' ? 'label' : 'meal';
  const label = kind === 'label';
  const done = (p: Photo | null) => {
    setBusy(false);
    if (!p) return;
    if (pick) {
      setPendingCapture({ kind, photo: p });
      goBack();
    } else {
      setPendingPhoto(p);
      router.replace(label ? '/label-result' : { pathname: '/meal-result', params: desc.trim() ? { desc: desc.trim() } : {} });
    }
  };
  const shoot = async () => {
    if (busy || !cam.current) return;
    setBusy(true);
    const pic = await cam.current.takePictureAsync({ quality: 0.9 }).catch(() => null);
    done(pic ? await photoFromUri(pic.uri, pic.width, pic.height).catch(() => null) : null);
  };
  const gallery = async () => {
    setBusy(true);
    done(await takePhoto(false));
  };

  return (
    <Screen title={t(label ? 'Label photo' : 'Meal photo')} back>
      {perm?.granted ? (
        <View style={{ height: 460, borderRadius: 28, overflow: 'hidden', backgroundColor: '#000' }}>
          <CameraView ref={cam} style={{ flex: 1 }} facing="back" mode="picture" enableTorch={torch} />
          <View pointerEvents="none" style={{ position: 'absolute', left: 28, right: 28, top: 56, bottom: 104, borderRadius: 24, borderWidth: 3, borderColor: 'rgba(255,255,255,0.9)' }} />
          <Springy
            onPress={() => setTorch(!torch)}
            scaleTo={1.08}
            accessibilityRole="switch"
            accessibilityState={{ checked: torch }}
            accessibilityLabel={t('Flash')}
            style={{ position: 'absolute', top: 14, end: 14 }}>
            <Glass style={{ width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="bolt" size={20} color={torch ? '#FACC15' : '#FFFFFF'} />
            </Glass>
          </Springy>
          {/* Shutter */}
          <Springy
            onPress={shoot}
            disabled={busy}
            scaleTo={0.92}
            accessibilityRole="button"
            accessibilityLabel={t('Take photo')}
            style={{ position: 'absolute', bottom: 20, alignSelf: 'center', width: 72, height: 72, borderRadius: 36, borderWidth: 4, borderColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' }}>
            <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' }}>
              {busy ? <ActivityIndicator color="#000000" /> : null}
            </View>
          </Springy>
        </View>
      ) : (
        <Card style={{ alignItems: 'center', paddingVertical: 24 }}>
          <Icon name="camera" size={34} color={c.cobalt} />
          <Text variant="h3" center style={{ marginTop: 8 }}>
            {t(label ? 'Allow the camera to photograph labels' : 'Allow the camera to take meal photos')}
          </Text>
          {/* Said no before and the phone won't ask again: the button opens the app's settings instead. */}
          <Button title={t(perm && !perm.canAskAgain ? 'Open Settings' : 'Allow camera')} style={{ marginTop: 12, alignSelf: 'stretch' }} onPress={() => (perm && !perm.canAskAgain ? Linking.openSettings().catch(() => {}) : ask())} />
          {perm && !perm.canAskAgain ? (
            <Text variant="small" color="sec" center style={{ marginTop: 8 }}>
              {t('Turn on the camera for Adro in Settings, then come back.')}
            </Text>
          ) : null}
        </Card>
      )}
      {label || pick ? null : (
        <View style={{ marginTop: 12 }}>
          <Field label={t('Describe the dish')} optional={t('(optional)')} value={desc} onChangeText={setDesc} maxLength={300} returnKeyType="done" placeholder={t('For example: chicken kabsa, half a plate of rice, grilled chicken thigh.')} />
        </View>
      )}
      <Text color="sec" center style={{ marginTop: 12 }}>
        {t(label ? 'Fit the nutrition facts table in the frame, flat and sharp. The AI reads the numbers.' : 'Fit the whole plate in the frame, from a little above. The AI finds what’s on it.')}
      </Text>
      <Button kind="glass" icon="image" title={t('Choose from photos')} disabled={busy} style={{ marginTop: 12 }} onPress={gallery} />
    </Screen>
  );
}
