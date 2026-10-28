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

## Launch steps (Claude, when the owner says so)

1. Apply the migration (needs "طبّق").
2. Deploy `revenuecat` (no JWT check) and `ai`; send a test event from RevenueCat and check `subscription_events`.
3. Merge `payments` into main, typecheck, lint, then the new build ("صدر النسخة").
4. Test with an App Store sandbox account: buy monthly, check `subscriptions`, cancel, restore.
5. On launch day: set `PAYWALL=on` in Supabase secrets. The trial and the limits start for everyone then.
