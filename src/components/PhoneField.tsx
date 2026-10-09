import { useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';

import { useT } from '@/i18n';
import { COUNTRIES } from '@/lib/countries';
import { country, formatLocalPhone, phoneDigits, phoneMessage } from '@/lib/validation';
import { useSettings } from '@/theme/settings';
import { radius } from '@/theme/tokens';

import { Field } from './Field';
import { Icon } from './Icon';
import { Sheet } from './Sheet';
import { fontFor, Text } from './Text';
import { Label } from './ui';

const flag = (iso: string) => String.fromCodePoint(...[...iso].map((ch) => 0x1f1e6 + ch.charCodeAt(0) - 65));

/** Country code button + number, checked while typing (design: phoneInputs). */
export function PhoneField({
  iso,
  digits,
  onChange,
  forceCheck,
}: {
  iso: string;
  digits: string;
  onChange: (iso: string, digits: string) => void;
  /** Show problems now (after pressing Next), not only after leaving the field. */
  forceCheck?: boolean;
}) {
  const { colors: c, isRTL } = useSettings();
  const { t, lang } = useT();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [blurred, setBlurred] = useState(false);
  const ct = country(iso);
  const [kind, msg, vars] = phoneMessage(iso, digits, blurred || !!forceCheck);
  const bad = kind === 'bad';

  const onType = (raw: string) => {
    let v = raw.replace(/[^\d+٠-٩]/g, '');
    let nextIso = iso;
    // Typed or pasted with the country code (+966 / 00966): pick the country and strip it.
    const m = v.match(/^(?:\+|00)(\d+)/);
    if (m) {
      const hit = [...COUNTRIES].sort((a, b) => b.code.length - a.code.length).find((x) => m[1].startsWith(x.code));
      if (hit && m[1].length > hit.code.length) {
        nextIso = hit.code === ct.code ? iso : hit.iso;
        v = m[1].slice(hit.code.length);
      }
    }
    onChange(nextIso, phoneDigits(v));
  };

  const list = COUNTRIES.filter((x) => {
    const s = q.trim().toLowerCase().replace(/^\+/, '');
    return !s || x.en.toLowerCase().includes(s) || x.ar.includes(s) || x.code.startsWith(s) || x.iso.toLowerCase() === s;
  });

  return (
    <View>
      <Label>{t('Phone number')}</Label>
      <View style={{ flexDirection: 'row', gap: 8, direction: 'ltr' } as object}>
        <Pressable
          onPress={() => setOpen(true)}
          accessibilityLabel={`${t('Country code')}, ${lang === 'ar' ? ct.ar : ct.en}`}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            height: 52,
            paddingStart: 12,
            paddingEnd: 10,
            borderRadius: radius.field,
            backgroundColor: c.card,
            borderWidth: 1.5,
            borderColor: bad ? c.down : 'transparent',
          }}>
          <Text size={22} style={{ lineHeight: 26 }}>
            {flag(ct.iso)}
          </Text>
          <Text num weight={600}>{`+${ct.code}`}</Text>
          <Icon name="chevd" size={16} color={c.sec} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <TextInput
            value={formatLocalPhone(iso, digits)}
            onChangeText={onType}
            onBlur={() => setBlurred(true)}
            onFocus={() => setBlurred(false)}
            placeholder={ct.mask}
            placeholderTextColor={c.sec}
            keyboardType="phone-pad"
            inputMode="tel"
            autoComplete="tel"
            textContentType="telephoneNumber"
            style={{
              height: 52,
              borderRadius: radius.field,
              backgroundColor: c.card,
              paddingHorizontal: 16,
              fontSize: 16,
              color: c.text,
              fontFamily: fontFor('manrope', 500),
              borderWidth: 1.5,
              borderColor: bad ? c.down : 'transparent',
              outlineStyle: 'none',
              textAlign: isRTL ? 'right' : 'left',
            } as object}
          />
        </View>
      </View>
      <View style={{ marginTop: 6, marginHorizontal: 4, minHeight: 18, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
        {kind === 'ok' ? <Icon name="check" size={15} color={c.up} strokeWidth={2.6} /> : null}
        <Text variant="small" weight={700} color={kind === 'ok' ? 'up' : bad ? 'down' : 'sec'}>
          {kind === 'ok' ? msg : t(msg, vars ? { ...vars, country: lang === 'ar' ? ct.ar : ct.en } : undefined)}
        </Text>
      </View>

      <Sheet open={open} onClose={() => setOpen(false)}>
        <Text variant="h2">{t('Country code')}</Text>
        <View style={{ marginTop: 12 }}>
          <Field value={q} onChangeText={setQ} placeholder={t('Search a country or code')} autoCorrect={false} />
        </View>
        <View style={{ marginTop: 12, backgroundColor: c.card, borderRadius: 22, overflow: 'hidden' }}>
          {list.length === 0 ? (
            <Text color="sec" center style={{ padding: 16 }}>
              {t('No country matches')}
            </Text>
          ) : (
            list.map((x, i) => (
              <Pressable
                key={x.iso}
                onPress={() => {
                  onChange(x.iso, digits);
                  setOpen(false);
                  setQ('');
                }}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 12,
                  minHeight: 56,
                  paddingHorizontal: 16,
                  borderTopWidth: i ? 1 : 0,
                  borderTopColor: c.line,
                }}>
                <Text size={26} style={{ width: 36, textAlign: 'center', lineHeight: 32 }}>
                  {flag(x.iso)}
                </Text>
                <View style={{ flex: 1 }}>
                  <Text weight={700}>{lang === 'ar' ? x.ar : x.en}</Text>
                  <Text variant="small" color="sec">
                    {lang === 'ar' ? x.en : x.ar}
                  </Text>
                </View>
                <Text num weight={600}>{`+${x.code}`}</Text>
                {x.iso === iso ? <Icon name="check" size={18} color={c.cobalt} strokeWidth={2.6} /> : null}
              </Pressable>
            ))
          )}
        </View>
      </Sheet>
    </View>
  );
}
