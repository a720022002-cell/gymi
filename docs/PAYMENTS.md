# Adro+ payments (RevenueCat)

Decided 27 Oct 2026: one plan, unlimited, **29 SAR a month or 299 SAR a year**. The first 7 days after sign-up are a free trial
with **3 AI photos and 4 coach messages a day**. After the trial, without a subscription, Adro stays free **with no AI**.
Free months from invites (5 friends = 1 month) add Adro+ time after the trial.

## Where the code is

| Part | Where | Live? |
|---|---|---|
| Database: `subscriptions`, trial counts, `access_of`, `my_access`, `ai_gate` | `supabase/migrations/20261130000000_subscriptions.sql` (main) | Not applied |
| RevenueCat webhook | `supabase/functions/revenuecat/index.ts` (main) | Not deployed |
| AI limits | `supabase/functions/ai/index.ts` (main): only when the secret `PAYWALL=on` | Code deployed with the next ai deploy; off until `PAYWALL=on` |
| App messages for the limits | `src/lib/ai.ts` (main) | Ships with the next update |
| App purchases, subscription page, terms | branch **`payments`** (RevenueCat SDK `react-native-purchases`) | Merged into main right before the next build |

The app part stays on its own branch because the RevenueCat SDK is native code: on main it would change the app's
fingerprint and normal updates ("حدثه") would stop reaching build 17.

## Owner steps (once, before launch)

1. **App Store Connect** → Agreements, Tax and Banking: sign the Paid Apps agreement, add the bank and tax forms.
2. **App Store Connect** → the Small Business Program (15% instead of 30%).
3. **App Store Connect** → Adro → Subscriptions: a group "Adro+" with two auto-renewable subscriptions:
   `adro_monthly` (29 SAR, 1 month) and `adro_yearly` (299 SAR, 1 year).
4. **RevenueCat** (app.revenuecat.com): a project "Adro", connect the App Store app (In-App Purchase key from App Store Connect),
   import both products, an entitlement **`adro_plus`** with both attached, and a default offering with a Monthly and an Annual package.
5. **RevenueCat** → Integrations → Webhooks: URL `https://utvhvzwkwhocdbiutavg.supabase.co/functions/v1/revenuecat`,
   Authorization: a long random text you make.
6. **Supabase** → Edge Functions → Secrets: `REVENUECAT_WEBHOOK_SECRET` (that same text) and `REVENUECAT_API_KEY`
   (RevenueCat secret key). Never in the app or in the chat.
7. **EAS** → Environment variables (production): `EXPO_PUBLIC_REVENUECAT_IOS_KEY` = RevenueCat's public Apple key (starts with `appl_`).

## Free codes (Apple Offer Codes)

- People type a code in the app: subscription page → "Have a code?" (Apple's own code screen, through RevenueCat), or open a
  shared link `https://apps.apple.com/redeem?ctx=offercodes&id=6826500429&code=CODE`. Redeeming is a normal App Store
  subscription that starts with the free time; RevenueCat and our webhook see it like a purchase. After the free time it
  renews at 29 SAR (or 299 a year) unless the person cancels.
- The team makes codes on Admin → Free codes (`/admin-codes`), in the iPhone app or on adroapp.com in the browser:
  a named code (one code for many people, like ADRO2026: limit up to 25,000 uses, optional end date) or a batch of
  one-time codes (500 to 25,000, end date up to 6 months; Apple makes them in a few minutes, then "Download codes").
  Free time: 3 days, 1 week, 2 weeks, 1 month, 2 months, 3 months, 6 months or 1 year. Who: new people, ended
  subscriptions, current subscribers. "Used" counts subscriptions that started with that code (from RevenueCat events).
- Server: `supabase/functions/offer-codes` (admins only) uses the App Store Connect API.
- Owner: App Store Connect → Users and Access → Integrations → App Store Connect API → a key with the Admin role.
  Supabase secrets: `ASC_KEY_ID`, `ASC_ISSUER_ID`, `ASC_PRIVATE_KEY` (the .p8 file's text). Never in the chat.
- Costs nothing extra: making codes is free and Apple takes nothing on the free time.

## Launch steps (Claude, when the owner says so)

1. Apply the migration (needs "طبّق").
2. Deploy `revenuecat` (no JWT check), `offer-codes` and `ai`; send a test event from RevenueCat and check `subscription_events`; make a test batch of sandbox one-time codes on Free codes.
3. Merge `payments` into main, typecheck, lint, then the new build ("صدر النسخة").
4. Test with an App Store sandbox account: buy monthly, check `subscriptions`, cancel, restore.
5. On launch day: set `PAYWALL=on` in Supabase secrets. The trial and the limits start for everyone then.
