# Adro launch checklist

Checked on 3 Nov 2026. ✅ = verified from here. ⬜ = owner. 🔒 = needs access I don't have in this session.

## Verified ✅
- Build 21 (1.0.0) finished on EAS, the one in App Review. Builds 20 and 21 share runtime ebc81514, so OTAs reach both.
- Code on main: typecheck and lint pass.
- EAS production variables present: Supabase URL, Supabase anon key, RevenueCat iOS key.
- Website up: adroapp.com, www, privacy, terms, support (the old /site/*.html links redirect correctly).
- Invite links: apple-app-site-association served as JSON with Team ID 7BS2Z3743C; app has applinks for adroapp.com and www.
- Server functions answer (ai, gate, revenuecat, offer-codes, push).
- Review account exemption is only for a720022002+applereview@gmail.com.

## Before pressing Release ⬜
1. App Store Connect: version set to **Manually release this version**.
2. Agreements, Tax and Banking: Paid Apps agreement, bank and tax all **Active**.
3. Small Business Program (15% instead of 30%).
4. Sandbox purchase test: buy monthly → check `subscriptions` → cancel → restore (with Claude).
5. Upgrades:
   - Supabase Pro (daily backups, no pausing, bigger limits).
   - Gemini paid tier (health data not used for training, higher limits).
   - Resend Pro (free = 100 emails a day; each sign-up sends 2).
   - Expo Starter (free = OTA updates for 1,000 users a month, few builds).
   - Vercel Pro (Hobby is non-commercial only).
6. Supabase → Auth → rate limits: raise emails per hour (now 50) to 200+. Needs "طبق" or the owner.

## Needs access 🔒
A Supabase access token added to this environment (environment settings → Edit, variable `SUPABASE_ACCESS_TOKEN`; never in the chat). Then Claude checks:
- Test data in production (test accounts, fake coaches, demo posts, leaderboards).
- Function secrets present: PAYWALL (off until launch), REVENUECAT_*, ASC_*, RESEND_API_KEY, Gemini key.
- Scheduled jobs (WHOOP/Oura/Polar sync, morning readiness) running.

## Launch day
1. Press **Release** (live within hours, up to 24).
2. "طبق": `PAYWALL=on` (free week and limits start for everyone).
3. Gate week: make FRIENDS30, let in the top N from the waitlist.
4. Store link on adroapp.com and Instagram bio; post the videos.

## After the gate week
- Switch the gate off in Admin → Waitlist.
- Change the App Store promotional text (it says "invite-only for now"); promotional text changes without review.

## First week
- Watch reviews, support email and errors; fix by OTA ("حدثه").
- Keep the App Review account and the APPLEREVIEW code for future versions.
- Tell TestFlight testers to install from the App Store.
