import { TextInput, View } from 'react-native';

import { useT } from '@/i18n';
import { SOCIALS } from '@/lib/coaching';
import { useSettings } from '@/theme/settings';

import { Icon } from '../Icon';
import { Text } from '../Text';
import { Row, Springy } from '../ui';

/** Social links you add one by one: a field per network you picked, "+ Network" chips for the rest (design: socialFields). */
export function SocialFields({ value, onChange }: { value: Record<string, string>; onChange: (v: Record<string, string>) => void }) {
  const { t } = useT();
  const { colors: c } = useSettings();
  const added = Object.keys(value);
  const rest = SOCIALS.filter(([k]) => !added.includes(k));
  return (
    <View>
      {added.length ? (
        <View style={{ backgroundColor: c.card, borderRadius: 20, paddingHorizontal: 12, marginBottom: 8 }}>
          {added.map((k, i) => (
            <Row key={k} gap={8} style={{ paddingVertical: 8, borderTopWidth: i ? 1 : 0, borderTopColor: c.line }}>
              <Text variant="small" weight={700} style={{ width: 82 }}>
                {k}
              </Text>
              <TextInput
                value={value[k]}
                onChangeText={(x) => onChange({ ...value, [k]: x.slice(0, 80) })}
                placeholder={SOCIALS.find((s) => s[0] === k)?.[1] ?? ''}
                placeholderTextColor={c.sec}
                autoCapitalize="none"
                inputMode={k === 'WhatsApp' ? 'tel' : k === 'Website' ? 'url' : 'text'}
                style={{ flex: 1, minWidth: 0, height: 44, borderRadius: 12, backgroundColor: c.inset, paddingHorizontal: 12, fontSize: 15, color: c.text, writingDirection: 'ltr' }}
              />
              <Springy
                accessibilityLabel={t('Remove {n}', { n: k })}
                onPress={() => {
                  const next = { ...value };
                  delete next[k];
                  onChange(next);
                }}
                style={{ width: 32, height: 32, alignItems: 'center', justifyContent: 'center' }}>
                <Icon name="close" size={14} color={c.sec} strokeWidth={2.2} />
              </Springy>
            </Row>
          ))}
        </View>
      ) : null}
      {rest.length ? (
        <Row gap={8} style={{ flexWrap: 'wrap' }}>
          {rest.map(([k]) => (
            <Springy key={k} accessibilityLabel={t('Add {n}', { n: k })} onPress={() => onChange({ ...value, [k]: '' })} style={{ height: 36, borderRadius: 18, paddingHorizontal: 12, borderWidth: 1.5, borderStyle: 'dashed', borderColor: c.line, justifyContent: 'center' }}>
              <Text variant="small" weight={700}>{`+ ${k}`}</Text>
            </Springy>
          ))}
        </Row>
      ) : null}
    </View>
  );
}

/** Only the links that are filled in. */
export const cleanSocials = (o: Record<string, string>) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, v.trim()]).filter(([, v]) => v));

/** Social links as small tags (design: socialRow). */
export function SocialRow({ value, center }: { value: Record<string, string> | null | undefined; center?: boolean }) {
  const { colors: c } = useSettings();
  const e = Object.entries(value ?? {}).filter(([, v]) => v);
  if (!e.length) return null;
  return (
    <Row gap={6} style={{ flexWrap: 'wrap', marginTop: 8, justifyContent: center ? 'center' : 'flex-start' }}>
      {e.map(([k, v]) => (
        <View key={k} style={{ flexDirection: 'row', backgroundColor: c.card, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 4 }}>
          <Text variant="xs" weight={700}>{`${k} `}</Text>
          <Text variant="xs" color="sec">
            {v}
          </Text>
        </View>
      ))}
    </Row>
  );
}
