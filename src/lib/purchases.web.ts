/** On the web app nothing is bought: subscriptions are bought in the iPhone app. */
export const canBuy = () => false;
export async function linkPurchases(_userId: string | null) {}
export type Plans = { monthly: null; yearly: null };
export async function getPlans(): Promise<Plans | null> {
  return null;
}
export async function buy(_p: unknown): Promise<'done' | 'cancelled' | 'failed'> {
  return 'failed';
}
export async function restore() {
  return false;
}
export async function manage() {}
export async function redeemCode() {}
