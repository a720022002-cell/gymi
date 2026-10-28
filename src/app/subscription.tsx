import { useEffect, useState } from 'react';
import { Linking, View } from 'react-native';

import { Icon } from '@/components/Icon';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { useToast } from '@/components/Toast';
import { Button, Card, Row, Segmented, Springy } from '@/components/ui';
import { useT } from '@/i18n';
import { daysLeft, refreshAccess, TRIAL, useAccess } from '@/lib/access';
import { myInvite } from '@/lib/invites';
import { buy, canBuy, getPlans, manage, type Plans, redeemCode, restore } from '@/lib/purchases';
import { useSettings } from '@/theme/settings';

/** One plan, unlimited. Prices here only show until the App Store's own (in your currency) arrive. */
const PRICE = { m: 29, y: 299 };
const FREE = ['Workout plan, logging and records', 'Calories, macros and water', 'Barcode scan and food search', 'Weight, sleep and streaks', 'Gym Bros friends and cheers', 'Cycle tracking'];
const PLUS = ['AI coach chat, no limits', 'Unlimited meal photos: the AI finds the ingredients', 'Label, machine and blood test photos', 'Recipes from TikTok and Instagram videos', 'Weekly recap and plan check with the AI'];

/** Adro+ (design: subscription): your trial or subscription, and buying it with Apple. */
export default function Subscription() {
  const { t, lang } = useT();
  const { colors: c } = useSettings();
  const toast = useToast();
  const { access } = useAccess();
  const [per, setPer] = useState<'m' | 'y'>('y');
  const [plans, setPlans] = useState<Plans | null>(null);
  const [busy, setBusy] = useState<'buy' | 'restore' | null>(null);
  const [invited, setInvited] = useState(0);
  useEffect(() => {
    let alive = true;
    getPlans().then((p) => alive && setPlans(p));
    myInvite().then((v) => alive && setInvited(v.months));
    return () => {
      alive = false;
    };
  }, []);

  const yr = per === 'y';
  const pkg = yr ? plans?.yearly : plans?.monthly;
  const price = pkg?.product.priceString ?? t('{n} SAR', { n: yr ? PRICE.y : PRICE.m });
  const save = Math.round((1 - PRICE.y / (PRICE.m * 12)) * 100);
  const date = (iso: string) => new Intl.DateTimeFormat(lang === 'ar' ? 'ar-u-nu-latn' : 'en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(iso));
  const subscribed = access?.tier === 'sub' && access.why === 'paid';

  // Apple tells RevenueCat, RevenueCat tells our server: give it a few seconds to arrive.
  const waitForAccess = async () => {
    for (let i = 0; i < 6; i++) {
      const a = await refreshAccess().catch(() => null);
      if (a?.tier === 'sub') return true;
      await new Promise((r) => setTimeout(r, 1500));
    }
    return false;
  };
  const subscribe = async () => {
    if (!pkg || busy) return toast(t('Subscriptions open in the iPhone app.'), { icon: 'star' });
    setBusy('buy');
    const r = await buy(pkg);
    if (r === 'done') {
      await waitForAccess();
      toast(t('Welcome to Adro+. Everything is unlimited.'), { icon: 'check' });
    } else if (r === 'failed') toast(t('The purchase didn’t go through. You weren’t charged. Please try again.'), { icon: 'warn' });
    setBusy(null);
  };
  const bringBack = async () => {
    if (busy) return;
    setBusy('restore');
    const ok = await restore();
    if (ok) await waitForAccess();
    toast(ok ? t('Your subscription is back.') : t('No subscription found for this Apple ID.'), { icon: ok ? 'check' : 'warn' });
    setBusy(null);
  };

  // Apple's code screen closes by itself; the subscription then arrives like a purchase.
  const code = async () => {
    await redeemCode();
    if (await waitForAccess()) toast(t('Your code worked. Enjoy Adro+.'), { icon: 'check' });
  };

  return (
    <Screen title={t('Adro+')} back>
      {/* Where you are now: the free week, subscribed, free months from invites, or free. */}
      {access ? (
        <Card style={{ backgroundColor: c.inset }}>
          {access.tier === 'trial' ? (
            <View>
              <Text weight={700}>{t('Free week: {n} days left', { n: daysLeft(access.until) })}</Text>
              <Text variant="small" color="sec" style={{ marginTop: 2 }}>
                {t('Today: {a} of {b} photos, {c} of {d} coach messages.', { a: access.photos_today, b: TRIAL.photos, c: access.chats_today, d: TRIAL.chats })}
              </Text>
            </View>
          ) : subscribed ? (
            <View>
              <Text weight={700}>{t('You’re on Adro+')}</Text>
              {access.until ? (
                <Text variant="small" color="sec" style={{ marginTop: 2 }}>
                  {t('Paid until {d}.', { d: date(access.until) })}
                </Text>
              ) : null}
              <Button kind="soft" title={t('Change or cancel')} color={c.text} small style={{ marginTop: 10, alignSelf: 'flex-start' }} onPress={() => manage()} />
            </View>
          ) : access.tier === 'sub' && access.why === 'invites' ? (
            <View>
              <Text weight={700}>{t('Free months from inviting friends')}</Text>
              {access.until ? (
                <Text variant="small" color="sec" style={{ marginTop: 2 }}>
                  {t('Adro+ is yours until {d}.', { d: date(access.until) })}
                </Text>
              ) : null}
            </View>
          ) : access.tier === 'free' ? (
            <View>
              <Text weight={700}>{t('Your free week is over')}</Text>
              <Text variant="small" color="sec" style={{ marginTop: 2 }}>
                {t('Adro stays free. The AI coach and food photos need Adro+.')}
              </Text>
            </View>
          ) : (
            <Text weight={700}>{t('You’re on Adro+')}</Text>
          )}
        </Card>
      ) : null}
      {invited && !subscribed ? (
        <Card style={{ marginTop: 12, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Icon name="star" size={20} color={c.cobalt} />
          <Text variant="small" style={{ flex: 1 }}>
            {invited > 1 ? t('You earned {n} free months by inviting friends.', { n: invited }) : t('You earned 1 free month by inviting friends.')}
          </Text>
        </Card>
      ) : null}

      {subscribed ? null : (
        <>
          <View style={{ marginTop: 12 }}>
            <Segmented<'m' | 'y'>
              value={per}
              options={[
                { value: 'm', label: t('Monthly') },
                { value: 'y', label: t('Yearly, save {n}%', { n: save }) },
              ]}
              onChange={setPer}
            />
          </View>
          <Card style={{ marginTop: 12, borderWidth: 2, borderColor: c.cobalt }}>
            <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <View style={{ flex: 1 }}>
                <Text variant="xs" weight={700} color={c.cobalt}>
                  {t('Unlimited')}
                </Text>
                <Text variant="h2" style={{ marginTop: 6 }}>
                  {'Adro+'}
                </Text>
                <Text variant="small" color="sec">
                  {t('Your full AI coach')}
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text num size={26}>
                  {price}
                </Text>
                <Text variant="xs" weight={700} color="sec">
                  {t(yr ? 'a year' : 'a month')}
                </Text>
              </View>
            </Row>
            {PLUS.map((x) => (
              <Row key={x} gap={8} style={{ marginVertical: 4 }}>
                <Icon name="check" size={16} color={c.cobalt} strokeWidth={2.6} />
                <Text variant="small" style={{ flex: 1 }}>
                  {t(x)}
                </Text>
              </Row>
            ))}
            <Button kind="cobalt" title={t(busy === 'buy' ? 'One moment…' : 'Subscribe')} disabled={!!busy || !canBuy()} style={{ marginTop: 12 }} onPress={subscribe} />
            {/* What Apple asks to be said next to the button. */}
            <Text variant="xs" color="sec" center style={{ marginTop: 8 }}>
              {t(yr ? '{p} a year, renews every year until you cancel. Cancel any time in your Apple ID settings, at least 24 hours before it renews.' : '{p} a month, renews every month until you cancel. Cancel any time in your Apple ID settings, at least 24 hours before it renews.', { p: price })}
            </Text>
          </Card>
        </>
      )}

      <Card>
        <Text variant="h3">{t('Always free')}</Text>
        {FREE.map((x) => (
          <Row key={x} gap={8} style={{ marginVertical: 4 }}>
            <Icon name="check" size={16} color={c.up} strokeWidth={2.6} />
            <Text variant="small" style={{ flex: 1 }}>
              {t(x)}
            </Text>
          </Row>
        ))}
      </Card>

      <Row style={{ justifyContent: 'center', flexWrap: 'wrap', columnGap: 18, rowGap: 8, marginTop: 4 }}>
        {canBuy() && !subscribed ? (
          <Springy onPress={code} accessibilityRole="button">
            <Text variant="small" color="link">
              {t('Have a code?')}
            </Text>
          </Springy>
        ) : null}
        {canBuy() ? (
          <Springy onPress={bringBack} accessibilityRole="button">
            <Text variant="small" color="link">
              {t(busy === 'restore' ? 'One moment…' : 'Restore purchases')}
            </Text>
          </Springy>
        ) : null}
        <Springy onPress={() => Linking.openURL('https://adroapp.com/site/terms').catch(() => {})} accessibilityRole="link">
          <Text variant="small" color="link">
            {t('Terms of use')}
          </Text>
        </Springy>
        <Springy onPress={() => Linking.openURL('https://adroapp.com/site/privacy').catch(() => {})} accessibilityRole="link">
          <Text variant="small" color="link">
            {t('Privacy policy')}
          </Text>
        </Springy>
      </Row>
    </Screen>
  );
}
