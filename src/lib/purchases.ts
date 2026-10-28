import { Platform } from 'react-native';
import Purchases, { PURCHASES_ERROR_CODE, type PurchasesPackage } from 'react-native-purchases';

/** RevenueCat's public iPhone key (made for apps; set in EAS as EXPO_PUBLIC_REVENUECAT_IOS_KEY, not in the code). */
const KEY = process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY ?? '';
let configured = false;

/** Buying works on this phone: an iPhone app build with the key. */
export const canBuy = () => Platform.OS === 'ios' && !!KEY;

/** Links purchases to the signed-in account (our user id is RevenueCat's app user id), or forgets it on sign-out. */
export async function linkPurchases(userId: string | null) {
  if (!canBuy()) return;
  try {
    if (!configured) {
      if (!userId) return;
      Purchases.configure({ apiKey: KEY, appUserID: userId });
      configured = true;
    } else if (userId) await Purchases.logIn(userId);
    else await Purchases.logOut();
  } catch {}
}

export type Plans = { monthly: PurchasesPackage | null; yearly: PurchasesPackage | null };

/** The monthly and yearly plan with the App Store's own price in the person's currency. */
export async function getPlans(): Promise<Plans | null> {
  if (!canBuy() || !configured) return null;
  try {
    const o = (await Purchases.getOfferings()).current;
    return o ? { monthly: o.monthly, yearly: o.annual } : null;
  } catch {
    return null;
  }
}

/** Buys a plan with Apple. 'cancelled' when the person closed Apple's sheet. */
export async function buy(p: PurchasesPackage): Promise<'done' | 'cancelled' | 'failed'> {
  try {
    await Purchases.purchasePackage(p);
    return 'done';
  } catch (e) {
    const err = e as { code?: string; userCancelled?: boolean | null };
    return err.userCancelled || err.code === PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR ? 'cancelled' : 'failed';
  }
}

/** Brings back a subscription bought before (new phone, reinstalled app). True when one is active. */
export async function restore(): Promise<boolean> {
  if (!canBuy() || !configured) return false;
  try {
    const c = await Purchases.restorePurchases();
    return !!c.entitlements.active.adro_plus;
  } catch {
    return false;
  }
}

/** Apple's own page to change or cancel the subscription. */
export async function manage() {
  if (!canBuy() || !configured) return;
  try {
    await Purchases.showManageSubscriptions();
  } catch {}
}
