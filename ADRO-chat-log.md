# Adro: chat log

A record of this Claude Code session: what you asked for and what was built.
Passwords and keys are left out on purpose.

---

## About the project

- **App:** Adro, an AI fitness coach. It is built with Expo (SDK 57) and runs on the web.
- **Live site:** https://gymi-inky.vercel.app. It updates automatically from the `main` branch.
- **Backend:** Supabase (database, sign-in, file storage, server functions).
- **AI:** Qwen through OpenRouter (`qwen/qwen3-vl-235b-a22b-instruct`).
- **Design sources:** `docs/index.html` (prototype), `docs/Adro-features.md`, `ADRO-development.md`, `Adro-design.md`.
- **Languages:** English and Arabic. The Arabic screens show right to left.

### Working rules you set
- Explain everything in simple words.
- Push to **main**.
- Never ask you to paste keys in the chat. When a key is needed, say the exact variable name and where to add it (Vercel, Supabase or Claude Code).
- The Supabase secret (service_role) key and the Gemini key never go in the app or in Vercel.
- Never commit `.env` files.
- Always delete test users after testing.

---

## What was built, in order

### 1. The main app (phases 1 to 8)
- **Setup:** Expo app, Vercel deploy, design tokens, fonts, glass look, Arabic and right-to-left.
- **Accounts:** Supabase sign-in, profiles, and security rules (RLS).
- **Screens:** onboarding, login, Home, tab bar, AI button, You page.
- **Food:**
  - Calorie setup and food database (USDA plus Saudi dishes).
  - Meal plan, recipes, swaps, shopping list.
  - Food search, barcode scanning, custom meals.
- **Train:**
  - Exercise database and training plan builder.
  - Weekly plan, workout screen, live workout, rest timer, summary.
  - Cardio, exercise library, exercise pictures and how-to.
- **AI:**
  - Coach chat with voice.
  - Meal photo, nutrition label photo, and "type what you ate".
  - AI plan builder, unknown machine photo, voice set logging.
- **Progress:** morning check-in, water, Progress tab, charts, weekly AI reports, PDF, vitamins, blood tests.
- **Social:** Gym Bros, coaches, women's health and cycle tracking, train together.
- **Store prep:** devices, subscriptions, store preparation.
- **Admin and coach tools:** programs, meal plans, client inbox, packages, gym hours, Meet booking.

### 2. Admin account
- An admin account (`adro.admin`) and an Admin page.

### 3. Design check and missing parts
- Checked the full design several times and built every missing screen and detail.

### 4. Accounting, server and AI costs (Admin page)
- **Accounting:** for the 3 partners, Ali, Hamdan and Ahmed.
  - Record each purchase: category, amount, currency (SAR or USD), and date.
  - Record who paid, and whether it was bought or not yet.
  - Split it equally, by set amounts, or to one person.
  - Mark parts as paid back.
  - A "Who owes whom" page with suggested settle-ups and spending by category.
- **Server monitoring:**
  - Whether the site and AI are up, and the last deploy.
  - Database and storage size against the free-plan limits.
  - User counts and AI failures.
- **AI costs:**
  - OpenRouter balance.
  - Spending per day and per feature.
  - Failed requests.

### 5. Apple-style ad video
- `docs/marketing/adro-ad-vertical.mp4` (35 seconds, vertical 1080×1920).

### 6. Your edit requests

| Your request | What was done |
|---|---|
| «لازم نفصل الباي والتراي» | Biceps, Triceps and Forearms are now separate filters. |
| Push 1 and Push 2 should be different and editable | "Make each day different": each Push, Pull or Legs day can have its own exercises. Order is editable, and you can add or remove workouts. |
| «الدائرة فوق thinking تدور ثانيتين بعدين توقف» | The loading circle now keeps spinning, even when the app is busy. |
| Add real pictures (body fat) | Real AI-made body photos, paid with OpenRouter credit. |
| Remove "Apply as a coach" from You | Removed. It only shows during sign-up. |
| Long-press + to enter ml by hand, remove juice | Long-press + opens "Add water" (10 to 3000 ml). Juice is removed. |
| Remove the mode, keep only Advanced | The Beginner/Advanced switch is removed. The app is always Advanced. |

### 7. During a workout: exercise how-to and machine photo
**Request:** "When we start the workout we can click the name of the exercise and see the picture and explanation for the exercise. Also when I didn't know the machine name I can take pictures for it (inside when we start the workout)"

- Each exercise name in the live workout has an ⓘ icon. Tap the name to see the moving picture and step-by-step how-to. Your workout, timer and sets stay as they were when you come back.
- A new **"Don't know a machine?"** card sits at the bottom of the workout.
  - Take or choose a photo, and the AI names the machine.
  - If it can't tell, you name it and pick the muscles yourself.
  - **"Add to this workout"** adds it to the current workout with 3 sets. Your weekly plan is not changed.
- Tested with a temporary user, who was deleted afterwards.

### 8. Small text fix
**Request:** the line under "Name this exercise" said "I'll add it to your plan" even inside a workout.

- Inside a workout it now says **"I'll add it to this workout"** («بضيفه لهذا التمرين»).
- Elsewhere it still says "your plan".

### 9. Audit fixes and food features (October 13–14)
- **All audit issues fixed** (urgent, important and small). See `docs/AUDIT-2026-10.md`.
- **Connections:** Supabase key and OpenRouter key are Network secrets; Vercel is a claude.ai connector; the network allows the database address and the live site.
- **Full nutrition facts** for every food and scanned product (saturated fat, cholesterol, sodium, fiber, sugars, vitamins, minerals, % daily value). Missing facts can be added; only you see them.
- **Saved meals:** scan a barcode while building a meal, and edit saved meals.
- **Food search:** "Recent" foods, and your own name for a scanned product (only you see it).
- **Balance it** opens by itself from 100 kcal over, on a bulk or a cut.
- **Weekly recap (built):** a story about last week on the first open of a new week, with a celebration or "what got in the way", AI tips, and AI changes you pick and apply. Video: `docs/marketing/recap-demo.mp4`.
- **Weight history:** tap the weight chart to see every weigh-in and fix or delete one.
- **Coach:** answers in the language you write in; its suggested meal can be saved or logged.
- **Unknown machine (more accurate):** the AI picks only from the app's own machine list (no made-up machines) and judges by the machine's own parts (where the pads, rollers, handles and foot plate are), so it works on empty machines, which is how most people take the photo. It says how sure it is. When it isn't sure, nothing is pre-picked: you choose from up to 4 look-alikes. Tested on 12 empty-machine photos: 10 right, and the 2 misses (hard angles) said "not sure".
- **Coach can do more:** besides logging and plan tweaks, it can now set a break (no workouts from one day to another), end a break, change which workout is on each weekday, and turn on a reminder at a time. Each comes as a card with Apply and Undo. It never says it can't, and never says something is done before you tap Apply. During a break, the Train page says "On a break until …", the next workout skips the break, and "You missed …" doesn't show.
- **Coach chat:** the voice (mic) button is gone, and Return now adds a new line; the arrow sends.
- **Fixes:** an applied coach card now stays applied after leaving the chat (the save never ran before; Undo on logged items had the same bug). Break days show as "Day off" in the week strip at the top of Train. The weekly recap only appears (and the Progress button only shows) once you've had a whole week in the app; before that it says when your first recap comes.
- **Add an ingredient:** type what you added ("70 g garlic sauce") and tap "Add with AI": only that is worked out and added, the photo isn't looked at again. You can also scan a barcode from the same sheet (meal photo and saved meals).
- **Food allergies:** asked once in the food setup (step 5 of 6; people who set up before see a one-time card on Food). Pick from peanuts, tree nuts, dairy, eggs, wheat/gluten, fish, shellfish, sesame, soy, plus others in your own words. Change them any time in You → Food allergies. The meal plan only picks recipes without them (and no dish twice a day), and shows a warning if no safe recipe exists. The coach, the weekly recap and recipes from your ingredients get them too, and a coach meal card with an allergen is dropped.
- **More recipes, your own:** 25 new built-in Gulf recipes (51 in all, Arabic and English). The AI also writes 4 recipes for each of your meals from cuisines picked at random for you, for your goal and allergies, renewed every 2 weeks or with "New recipe ideas" in the meal plan. The plan mixes yours with the built-in ones and changes dish every day, so two people rarely get the same plan. The shopping list adds up each real day's meals: today, the next 7 days, or the next 30 (new AI recipes show up in it right away, since it's built from the plan). Once you check off the first item of a week's or month's list, meals and the list are locked to those days until the last one ("Unlock" to undo): AI recipes don't renew then (only new allergies, goal or meals change them), and "New recipe ideas" asks first. Broken AI answers (JSON) are retried once and common slips fixed, for every AI task.
- **Audit (15 Oct):** full report in `docs/AUDIT-2026-10-15.md` and `.pdf`. Urgent items A1–A14 fixed: long friend codes (everyone got a new code) with a limit on wrong tries; Arabic allergy words matched as whole words plus many missing allergens; training plan saves can't go back to an old copy and the weekly check keeps your changes; offline start uses a copy kept on the phone (no sign-up or setup screens); AI limit can't be bypassed; cycle data never sent to the AI in private mode; pregnancy shared with a partner only if chosen; injuries hidden from friends when sharing is off; reminders cleared on logout; account deletion stops if a file can't be deleted.
- **Food fixes B1–B13:** meals with allergies borrow similar safe recipes (no daily repeats; Change meal always changes, with full Undo, also from the recipe screen); meals sized to the day's real goal (pregnancy, moved calories); a note when the plan's protein is 15 g+ short; meal times right for night, rotating and split shifts and end minutes; a logged meal keeps its own name and only shows the recipe if it's still that dish; meals have fixed ids (removing one doesn't shift the rest); saving setup or targets keeps AI recipes, and pending small saves can't overwrite newer ones; AI recipes only remade when needed (only new meals get new ones); shopping list in grams, ticks reset per list, clearer lock text; leaving an ingredient out keeps calories when it can, else says the new calories; missing Arabic (left/over, units, Spices).
- **Training fixes C1–C9:** Undo (coach and weekly check) puts back only what the change touched; each week keeps its own moves, so past streaks don't break and a group invite for another week doesn't wipe this week's moves; the missed card ignores days before a schedule change and hides once today is done; a coach's program keeps your injuries and home mode; dragging on the week screen moves the same workout in the usual week; normal sessions stay normal when a lighter day or deload starts later; recovery counts sets (bodyweight too) and barely lowers the score after rest; Finish saves a workout once.
- **AI and coach fixes D1–D6:** a double tap sends a coach message once; your allergies go first in what the coach sees; changing days is checked properly and Undo puts back only what changed; the AI server checks requests, refunds only unbilled failures and stops retrying in time.
- **Progress and health fixes E1–E5:** the weekly recap counts only what you logged; Apply in the recap works once, food saved first; recovery uses sets and load; a coach weight change can be undone; today's calories fixed.
- **Ease-of-use fixes F1–F6:** buttons ignore extra taps while saving; weekday letters right in Arabic and English; small buttons bigger with spoken labels; shopping list faster; Friends shows "You're offline" with Try again instead of an empty list; Save goes home on the web when there's no page to go back to.
- **Small fixes S1–S18 (18 Oct):** water 1.5–6 L; protein counted on part of the weight over 100 kg (max 250 g); no goal under 800 kcal; eggplant isn't egg; "ورق عنب" not cut; meals near midnight match; machine sets 1–6 and injury warning; walk undo; period lateness; first recap date; sleep average from last 7 days; pick which photo to delete; recap in lb; Latin digits; web reminders text; coach and meal codes 8 characters with a try limit; current password checked by the server (change and delete); new tables get RLS automatically.
- **Improvements I1–I13 (18 Oct):** invite code sends a friend request; sharing starts closed for new accounts; allergy warning on products and search; your own allergy words filter recipes; +2.5 kg after a full session; plan save queue with retry; AI fixed JSON shape and length limits; no technical errors sent to the app; faster long lists and chat; error and not-found pages; one date helper; period and home screens split into smaller files and dead code removed; phone app restarts after a language change.
- **Pregnancy workouts and weight unit (18 Oct):** "Adjust my workouts for pregnancy" now changes training (no lying on the back or belly, no jumps or crunches, about 20% lighter, 3 sets at most, no weight jumps); the switch is on the Train page for women and on the pregnancy page. The kg/lb setting is now "Weight unit" and covers body weight too (progress, home, report, coach, entry wheel).
- **Meal steps (18 Oct):** when creating or editing a saved meal you can write the cooking steps (up to 30), shown on the meal and shared with its code. Fixed: saving a new meal failed after meal codes became 8 characters (the database check only took 4).
- **Recap suggestions fix (18 Oct):** after AI answers got a fixed shape (I7), the recap's open "suggest" objects came back empty, so the last slide had nothing to apply. Open shapes now only ask for JSON; this week's empty recaps were cleared so they're written again.
- **Workout screen (18 Oct):** small up/down arrows to reorder exercises mid-workout; a water button (150/250/500/750 ml) logs to today's water; a smarter set coach (lib/setCoach) reads today's sets and your last 6 workouts: works out the right weight from what you just lifted, sees when reps drop from tiredness (rest, keep the weight), suggests a heavier last set when you're strong and steady, says when you've been stuck on one weight for 3+ workouts, and where to start before the first set.

- **WHOOP and Oura direct (19 Oct):** a new "Rings and bands" list on the devices page. You sign in on WHOOP's or Oura's own page; the server keeps the keys (the app never sees them), pulls your last 30 days, then syncs again when you open the app (every 3 hours at most) or tap to sync. Recovery/readiness, sleep, HRV, resting heart rate, steps and workouts join your readings (the ring or band wins over the phone for sleep and HRV). Disconnect also deletes its data. Shows "Coming soon" until Adro's WHOOP and Oura developer apps are registered and their 4 keys are added in Supabase. Polar and Fitbit added as "Coming soon"; Garmin needs a partner approval.
- **Smarter coach from devices (19 Oct):** the AI coach, weekly recap and weekly plan check now read the watch, ring or band (Apple Health, Health Connect, WHOOP, Oura): your usual numbers over 30 days, last night next to them, 14 days of readings and recorded workouts, and what stands out (HRV under usual, resting heart rate up, low recovery, short sleep or sleep debt, raised skin temperature, steps down). It works out a readiness (low, ok, good) and decides from it: a lighter day when it's low, push when it's good, and it names the device and number ("your WHOOP recovery is 28%").
- **Connections page (19 Oct):** You → App → Connections. What links straight to Adro (Apple Health / Health Connect, WHOOP, Oura with their status; Garmin, Polar, Fitbit coming), how everything else arrives (your device → its app → Apple Health or Health Connect → Adro), what you add yourself (blood tests, weight, body measurements with the latest one), and "Find your device": 26 watches, rings, bands, scales, sleep and fitness apps by type or search, each with where to tap inside its own app on iPhone or Android.
- **Readings locked until connected (19 Oct):** Your readings no longer lists devices to connect. With nothing connected (phone health app, WHOOP or Oura), the readings are blurred and can't be opened, with one button to Connections. Linking, syncing and disconnecting now all happen on Connections (WHOOP and Oura sign-in also comes back there). Connections cards show the makers' own images; Garmin was replaced by Google Fitbit Air, and the device guide sections were removed.
- **Watch data everywhere (19 Oct):** the recovery score now uses the watch's HRV and resting heart rate against your usual, or the WHOOP/Oura score, as "Body signals" (a quarter of the score). Steps come from the watch when higher than what you typed. Cardio the watch recorded (run, walk, bike, swim…) counts as cardio, without doubling one you logged. Calories you moved beyond your usual day (watch active calories over your 30-day average, after cardio) are added to the day's food budget, up to 600. When the watch says your body hasn't recovered, Train asks if you want a lighter workout (it still only asks).
- **More from the watch (19 Oct):** smart-scale weigh-ins and body fat become Adro weigh-ins by themselves (new days only, never over one you typed; the newest updates targets). Optional "Send Adro data to Apple Health / Health Connect" (off by default, in Connections): workouts (they fill Apple Watch rings), meals, water and weight, kept in step when you edit or delete; what Adro wrote is never read back. Sleep stages (deep, REM) and bedtime steadiness on the Sleep page and for the coach. Heart rate during Adro workouts (average and highest on the summary), with calories from heart rate. Period days from the health app fill cycle tracking (women, tracking mode; never stored on our server). Early illness warning on Train and Recovery when two or more signs show up at night (temperature, breathing, resting heart rate, HRV, blood oxygen), offering a lighter day. VO2 max level for your age and sex on its page. Needs a new phone build (new health permissions).
- **Watch round 3 (20 Oct):** fixed steps and active calories counting twice with phone + watch (the health app's own hourly totals; last month re-read once). Background sync (expo-background-task) with one morning note on readiness (needs the check-in reminder on, respects quiet hours). Polar linked directly (AccessLink: activity, sleep, Nightly Recharge HRV, exercises with heart rate, skin temperature). Fitbit not linked directly: its Web API shuts down on 30 Oct 2026 and the new Google Health API needs a Google review past 100 users; Android Fitbit users come in through Health Connect. Watch workouts get average/max heart rate and a zone; cardio counts in recovery's training load (heart-rate load). Personal step goal (usual + 10%, 5,000 to 12,000), the same on Home and Cardio. Bedtime reminder can use your usual bedtime from the watch. When the watch says you haven't recovered and tomorrow is a rest day, Train offers to move today's workout there (asks only). The illness warning now needs a body sign (temperature, breathing or oxygen).
- **Small watch improvements (20 Oct):** WHOOP, Oura and Polar now sync on the server every 3 hours even when the app is closed (pg_cron with a secret header). Separate switches for the morning readiness note and the illness warning (Connections → From your watch). With two or more sources you pick the main device for sleep and heart readings (Automatic, the phone app, or a band/ring); Automatic always keeps the same order so nights don't flip between devices. Readings have a 3-month view (one bar or point per week), and 90 days of device data are loaded.
- **Sign up connects your health (20 Oct):** after "A bit about you", two new pages, each can be skipped: connect Apple Health / Health Connect (what Adro reads and why), then "Do you wear a band or ring?" with WHOOP, Oura and Polar (their sign-in comes back to this page). Other watches are noted as coming in through the phone's health app. Then Home as before.
- **New name: Adro (20 Oct):** the app was called Gymi. Everything now says Adro: all screens in English and Arabic, the logo, app and web title, permission texts, the AI coach and recap, file names, store listing, docs and PDFs. Inside too: saved-data keys on the phone (moved over once by `lib/renameKeys`, nothing lost), notification and background-task names, food IDs in the code and seed, package name, bundle ID `com.adro.app`, link scheme `adro://`, EAS project name `adro` (the old EAS project link was removed; the first build makes a new one). New coach codes start with ADRO-. Not changed yet: the web address gymi-inky.vercel.app, the GitHub repository name, the database data was moved too after your OK (810 foods, 90 food IDs, 2 food logs, 1 invite code; `20261121000001_adro_data.sql`). Still to change on your side: the old ad videos, and login emails like admin@gymi.app.
- **Brand kit (21 Oct):** new logo: "adr" in Sora with the app's open blue ring as the o (sized to Sora's real o); Arabic "ادرو" (plain alef, no hamza) in IBM Plex Sans Arabic, all in the letters' color. `docs/brand/`: 14 SVG logos (English, Arabic, both together, ring, app icon; color, white, one-color and reverse versions), the same as transparent PNGs, and `Adro-brand-guidelines.pdf` (11 pages: idea, logo versions, clear space and minimum size, colors, fonts, app icon, do and don't, voice, examples, files).
- **New logo in the app (21 Oct):** the English wordmark (adr + the blue ring) is now the logo in both Arabic and English: welcome screen, export screen and the PDF reports (drawn from the same shapes, `components/wordmark.ts`). The app icon stays the ring. The Arabic wordmark is only for Arabic ads and print.
- **App icons from the brand ring (21 Oct):** iPhone icon, Android adaptive icon, web and home-screen icons, favicon and splash all redrawn from the brand-kit ring (a bit bigger and bolder than before), sized for each platform's mask. New Android 13+ themed (monochrome) icon wired in `app.json` (it was still Expo's template); the unused template background image was removed. Shows on phones after the next build.
- **Website (21 Oct):** a bilingual site (Arabic and English, with a switch; picks the visitor's language) at `/site`: landing page (hero with the app, 6 features, 4 screens from the real app, watches and rings, pricing Free / Pro 39 SAR a month or 299 a year, FAQ, store buttons marked coming soon, link to the web app), plus `/site/privacy`, `/site/terms` and `/site/support` (taken from the app's own text and Arabic, so they always match; built by `scripts/build_site.py`). Share image for WhatsApp and X. Support email on the site is support@adro.sa, which needs to be set up once the domain is live.
- **Website, Apple style (21 Oct):** the home page rebuilt in an Apple-inspired style with our own brand: black hero with a huge headline and three phones that move as you scroll; "It knows your body." with a readiness ring that fills to 78% and counts up; a bento grid (AI coach chat, 810 kcal from one photo, 5 direct connections, +2.5 kg set coach, one-tap moves, weekly recap) with counting numbers; "How it works" where the phone stays in place and changes screen as you read each step; a black devices section; clean pricing; FAQ; and a big closing call. Sections fade in, motion turns off for people who reduce motion, and it all works right to left in Arabic. Privacy, terms and support pages unchanged.
- **Website, all features (21 Oct):** new "And so much more." section listing all 64 features in 9 groups (training, food, health and recovery, watches and rings, AI coach, women's health, Gym Bros, real coaches, privacy and settings), in Arabic and English. The Features link in the menu goes there.
- **Workout history (21 Oct):** Train → Workout history lists every workout by month (date, length, weight lifted, sets, records), 30 at a time with Show older. Tap one to see its exercises in the order you did them with every set (weight × reps, record marked). Each exercise page now shows Your history: the last times you did it with every set, and your best weight. The Workout done screen also lists the exercises and sets now. Sets show the same way in Arabic and English.
- **iPhone widgets and Live Activity (21 Oct):** two home-screen widgets (expo-widgets): **Adro: Today** (calories left as a ring, eaten/goal, protein and steps; small and medium, plus Lock Screen circle and line) opens Food; **Adro: Training** (today's workout or rest day, the next one, your streak, and the recovery score as a ring on medium) opens Train. They update by themselves when your numbers change in the app. While a workout runs, a Live Activity shows on the Lock Screen and in the Dynamic Island: the workout, the exercise, set number and target, a clock that counts on its own, and during rest a countdown with a bar and the next exercise. It ends when you finish. Needs a new iPhone build (iOS 16.2+ for the Live Activity); not in Expo Go or on the web.
- **Log sets from the Lock Screen (21 Oct):** the workout Live Activity (Lock Screen and Dynamic Island when held open) now has buttons: − and + for the weight (2.5 kg or 5 lb) and reps (5 s for timed moves) of the set you're on, Done to log it and start the rest, and Skip to end the rest. No need to open the app. iOS 17 and later; needs the new iPhone build.
- **Coach tip on the Lock Screen (21 Oct):** the workout Live Activity shows the set coach's tip for the exercise you're on (the same one under it in the app), green to go heavier, amber to rest or hold back, white otherwise. The set number moved to the top line. "+2.5 kg" stays in the right order in Arabic.
- **Water on the Lock Screen (21 Oct):** a blue drop button on the workout Live Activity adds 250 ml to today's water, and today's total shows under the set count.
- **Widgets page (21 Oct):** You → App → Widgets (iPhone and web, hidden on Android): the Today and Training widgets drawn with your own numbers (small and medium, light or dark like the app), the Lock Screen widgets, and the workout card, with steps to add each one (Home Screen and Lock Screen). A switch "Show my workout on the Lock Screen" turns the Live Activity off or on (on by default). Widget numbers now come from one place (`lib/widgetData`). Done and Skip on the Live Activity are now round icon buttons so the row fits the narrowest iPhone.
- **How Adro makes money (21 Oct):** `docs/business/Adro-monetization.pdf` (8 pages, Arabic, made from `monetization.html`): all 14 ideas in 4 groups (users pay us: Pro trial and free limits, scan packs, one-time programs, gift Pro, referrals; partner commissions: meal-prep kitchens, ordering the shopping list, home blood tests, coaches, affiliate and sponsored challenges; businesses pay: gyms, companies, insurers; what to avoid), with how each works, the hard parts, example numbers, and a step-by-step plan.
- **Monetization file, update (21 Oct):** now 11 pages and 17 ideas in 5 groups: added obesity and sleeve-surgery clinics (clinic pays, doctor dashboard) and Adro Pass (one subscription for many gyms, like ClassPass) under "big partnerships", and the golden idea as the last section: Adro as the tool coaches and dietitians run their business on (why it's gold, example numbers, first 30 days). The plan now starts with it.
- **Monetization file, update 2 (21 Oct):** 13 pages, 20 ideas in 6 groups. New group "growth ideas": Adro ambassadors (20% of each subscription every month, only paid for real subscribers), the Adro coach on WhatsApp (photo logging and reminders with no app; WhatsApp fees go into the price), and a companion program for weight-loss injections (Ozempic, Mounjaro: keep muscle, track side effects, come off without regaining; never advises on doses). The golden idea stays last (#20); the plan includes the three.
- **Full audit, speed and App Store readiness (21 Oct):** four reviews of everything changed since the last audit (about 10,000 lines), then fixes for all of them.
  - **Server security:** a WHOOP/Oura/Polar sign-in link sent to someone else could put their band on the sender's account. Now the app that started it, signed in as the same person, has to confirm it. Only Adro's own return addresses are accepted. Two syncs refreshing at once, or a passing error, no longer force signing in again, and failed links are retried. WHOOP strain is on the right day. Syncs are limited to one a minute. Blocking now covers groups, the group feed and the board. Nobody can check whether two other people blocked each other. Old GYMI- invite and coach codes work again. Friend levels respect workout sharing. One open report per person. Deleting an account also disconnects the bands and says "too many tries" instead of "wrong password".
  - **Devices:** sleep is counted per night (it was split at midnight), and band/ring data stays after a phone sync. A failed settings load can't wipe the connection. Scale weigh-ins are only imported on the phone. Turning on private cycle mode stops safely if offline. Band/ring-only users get the morning note and the illness card. Hours in Arabic, the right source name, and no "1 h 60 min". Weight on the readings pages is in your unit.
  - **Food:** shopping ticks are kept per list. The coach's meal card and the Home protein tip respect your own allergy note. Reports use the day's real goal. Meal planning is faster. Plan saves can't be overwritten by a reload. Undo only puts back what changed. "km" is in Arabic.
  - **Training:** the Lock Screen workout card works from any screen and after reopening the app. The rest timer lives in one place. Quick taps aren't lost. Done is always there, with Skip while resting. Weight jumps are 5 lb for pound users. Arrows and "+x on last time" compare with last time, not the target. The workout screen no longer redraws 4 times a second. "80..5" can't be saved as 0. "+2.5" shows right in Arabic. The coach never suggests 0 kg. The last set can't be deleted. Database exercises show in Arabic in history. History months don't repeat.
  - **App Store:** AI asks permission once before sending anything to the outside AI service (OpenRouter), with an on/off switch in Privacy and data (Apple 5.1.2(i)). The Subscription page is hidden until payments work (`PAID_PLANS_LIVE` in `src/lib/plans.ts`), and invite rewards say they start with Premium. The privacy policy now covers AI and WHOOP/Oura/Polar, on the app and the site. The store checklist is updated in `docs/STORE-LISTING.md`.
  - **Checks:** typecheck, lint, and the iPhone and web builds all pass. 17 pages tested on the web in Arabic and English with no errors.
- **App Store package (21 Oct):** `docs/Adro-store-listing.pdf` rebuilt (8 pages) from `docs/STORE-LISTING.md` and `docs/STORE-RELEASE.md`: name, subtitle, keywords, the English and Arabic descriptions (now with watches and rings, widgets, Lock Screen logging and workout history), Apple privacy labels, Google data safety, the review checklist, review notes, and the release steps.
- **App Store screenshots (21 Oct):** 6 screenshots in English and 6 in Arabic at Apple's 6.9-inch size (1320 × 2868), in `docs/store-screenshots/en` and `/ar`: your day in one ring (Home), a coach for every set (workout), Gulf food (Food), the AI coach, recovery, and progress. Taken from the real app with temporary test users (deleted afterwards), with a title on top and the screen in a phone frame.
- **Intro video (21 Oct):** a 21-second portrait video (1080 × 1920) in Arabic and English, inspired by a reference clip but in Adro's own look: black space with the blue Adro ring as a portal; "Wearables", "Devices", "Your food" and "Training" with their icons flying out of the ring past you; everything gathering into the ring ("Everything you do. One coach."); the ring becoming the o in the adro logo, with "Coming soon to the App Store". Original sound made for it (pad, whooshes, a hit and a chime). Files: `docs/marketing/Adro-intro-ar.mp4` and `-en.mp4`; the animation source is in `docs/marketing/intro/`.
- **Second video, "Every beat" (21 Oct):** a 23-second portrait video (1080 × 1920), Arabic and English. One blue line changes shape: heartbeat ("Every beat", with a heartbeat in sync), sleep stages ("Every night"), a week of steps ("Every step"), the day's calorie ring ("Every bite"), lifts going up ("Every rep"). It then curls into the Adro ring ("Adro reads it all"), readiness counts up to 85%, and the coach's message types out ("Today, add 2.5 kg to your bench"). It ends on "Not more data. Better decisions." with the ring becoming the logo. Original sound. Files: `docs/marketing/Adro-every-beat-ar.mp4` and `-en.mp4`; the source is in `docs/marketing/every-beat/`.
- **Apple-style ad (21 Oct):** a 30-second English ad, 16:9 (1920 × 1080), in the style of Apple's product ads. "Meet your new coach." on black; then Train. / Eat. / Recover. / Ask. in huge type on light gray, with a floating 3D iPhone showing the real app screens and a small data chip each (+2.5 kg next set, 1,050 kcal left, 85% recovered, answers in seconds); three phones fanning out ("Everything. In one place."); Smarter. Stronger. Yours. on the beat; the ring drawing itself into the adro logo with "Your AI fitness coach. Coming soon to the App Store." Original 120 bpm music, cut to the beat. File: `docs/marketing/Adro-apple-style-ad.mp4`; the source is in `docs/marketing/apple-style/`.
- **Apple-style ad, vertical (21 Oct):** the same 30-second ad at 1080 × 1920 for Instagram, TikTok and Stories. The big word is on top, the phone is centered under it, the three phones and "Everything. In one place." are stacked, and the logo is in the middle. File: `docs/marketing/Adro-apple-style-ad-vertical.mp4`.
### Final pre-launch audit (21 Oct 2026)
- Checked the whole app (sign-up, food, training, health and AI, friends and coaches) for logic, links and design. About 150 findings; the clear bugs and logic gaps are fixed in the app.
- Food: safe calorie floor, body-fat formula, net cardio, pregnancy by trimester and nursing, Ramadan by date, allergy warnings everywhere, water goal that grows with training and pregnancy (now used on Home, Progress and Recovery too), coach's AI targets no longer add the pregnancy extra twice.
- Training: injuries kept when a coach program syncs, no 0 kg sets, offline finish queue, finish/discard confirm, rest times by exercise, bodyweight and timed progression.
- Health and AI: pregnancy week, check-in card, past-day rings, report caching, AI pregnancy/luteal rules.
- Social: privacy checks only answer about yourself, coach approval required for coach actions, one open coach request, block ends coaching, clearer coach-sharing wording.
- Arabic: 751 exercise names translated, 142 new strings, lift names in the report and recap now in Arabic.
- Database changes (food_fixes, social_fixes, train_fixes): applied after your OK (22 Oct), checked.
- AI function update: deployed (version 75).
- Code pushed to main. The full report with the 20 open decisions: docs/Adro-final-audit-2026-10-21.pdf.

### Owner decisions built (22 Oct 2026)
- Admin moderation (Apple 1.2): suspend/unsuspend accounts (the person sees a "suspended" screen and disappears from friends, search, groups, challenges, coaches and messages), hide group posts and coach messages, reset an offensive profile, report actions (resolve/dismiss/reopen) and an action log.
- Name: Adro+ everywhere (app, site, store notes). Phone number optional. Ramadan mode hidden for now (one switch: RAMADAN_LIVE in src/lib/nutrition.ts).
- Streak: skipping or moving a workout (or making it up the same week) never breaks it; same rule on Home, widgets, Train, Progress and the recap.
- Coach program: the client is asked first ("Use it" / "Not now"), per program version.
- Edit or delete a past workout (records, volume and next weights recalculated). Custom exercise without a photo.
- Group and challenge invites need Accept; owner can remove members and delete; members can leave.
- Push notifications for coach messages (needs one-time setup). Invite links (gymi-inky.vercel.app/i/CODE, ready for adro.sa).
- Home: at most 3 cards plus "More", coach row with unread count. Recap Undo. Blood markers over time, vitamins "Taken today", food tips from low blood markers.
- Database changes (moderation, social_decisions, home_health): applied 22 Oct after your OK.

### Food shortcuts, set notes, deload numbers, past-day goals, live chat cards (22 Oct 2026)
- Food: "Log again" (item screen, past-day rows, recent items in search), "Copy yesterday" (all or one meal, skips what's already there, Undo), and pick the meal (Breakfast/Lunch/Dinner/Snack) when logging, including past days.
- Training: notes on an exercise or a set during a workout, "Last time: …" next time, shown and editable in past workouts. Lighter day and deload week show before → after (80 → 50 kg · 4 → 3 sets).
- Past days keep their own goals (new daily_goals table): rings, kcal left, progress, report and recap judge each day by the goal it had.
- AI coach chat: data cards show the message's own week (dated); target suggestions show what you have now.
- Database change goal_snapshots applied. Push function deployed with its secret set (never shown). AI function deployed. Pushed to main. Walkthrough of 54 pages in Arabic and English: no errors.

### Live cardio and sports with the AI coach + cardio and sports plan (23 Oct 2026)
- Start any activity: classic cardio (run, walk, hike, bike, swim, row, elliptical, stairs, jump rope, HIIT) and sports (padel, tennis, squash, badminton, football, basketball, volleyball, boxing, martial arts, yoga, pilates).
- Live readings: Bluetooth heart-rate sensors (chest straps, Polar/Garmin/WHOOP broadcast) about every second; Apple Watch every few seconds while a workout runs on the watch; phone GPS for distance and pace (run, walk, hike, bike). Without a live source: time plus "how hard does it feel" 1–10.
- Coach tips during the session by goal (cut/maintain/gain), pregnancy, recovery, age and injuries, and by sport (stop-and-go sports judged on a 2.5-minute average). Spoken tips (Arabic voice in Arabic). Set and round counters. Up to 4 AI tips per session, rule tips otherwise. Lock Screen Live Activity with Pause/Finish.
- Training setup now asks "Add cardio and sports?": sports you play (e.g. padel twice a week) count toward the week, and the plan fills the rest by goal, keeping hard sessions away from leg days. Shows on Train, week plan and Home; missing a session never breaks the streak.
- New packages: expo-location, expo-speech, expo-keep-awake, react-native-ble-plx (needs a new phone build). Small Expo patch updates.
- Database change cardio_live applied and AI function deployed (23 Oct, after your OK). Live heart rate, GPS and the Lock Screen need a new phone build.

### Score for racket sports + screenshots of every sport (23 Oct 2026)
- Padel, tennis, squash, badminton and volleyball: a small score row in the set card ("You 3 · Them 2"; tap to add a point, "−" to take it back). "Set done" keeps the set's score; finished sets show small ("Sets: 6-4 · 4-6"). The summary and today's cardio list show the score, and the coach knows it.
- Wording: "1 set done" / "1 round done"; the stop-and-go tip now says "between points, plays and rounds".
- Screenshots (English, simulated Polar H10 strap): docs/screens/adro-all-sports-live-en.jpg (all 22 sports), adro-cardio-sports-en.jpg (plan to summary), adro-workout-features-en.jpg.
- Database change cardio_score applied (23 Oct, after your OK).

### Smarter AI coach for every sport (23 Oct 2026)
- The coach now has a guide for each of the 22 sports (technique, common mistakes, how to improve week to week) and gets your last 5 sessions of the same sport.
- The server works out the comparisons itself (pace per km, minutes, zone 2 minutes, last score) so the coach never gets a number wrong; it only words them.
- It doesn't repeat what it already said this session, and switches topics (effort, technique, breathing, pacing, recovery).
- Start: a cue to start well with a target from last time. Halfway: how it's going and one change. Off target 2+ minutes: how to fix it. End: recap with real numbers vs last time + one target for next time.
- Built-in tips (no AI): 3 more per sport, focused on improving. AI function deployed.
- After reviewing 32 real replies: stop-and-go sports no longer get "ease off" for a spike, sets won/lost are counted on the server, live tips max 15 words (no more cut-offs), sport targets for racket/team/combat (not zone 2 minutes), pregnancy + unsafe sport always gets a safer suggestion, Arabic uses Arabic sport names and feminine forms for women.

### Expo project linked again (23 Oct 2026)
- The link was removed during the Gymi → Adro rename. New Expo project: @ahmed.2002/adro (ID 80a242f0-4c0c-4457-ab37-7097568977c9), with over-the-air updates.
- Database settings (EXPO_PUBLIC_SUPABASE_URL and the public anon key) added for production, preview and development.
- Push notifications can now get a phone token (the project ID was what was missing).

### Home: "Start cardio" card (23 Oct 2026)
- New Home card, on by default and in Edit home (move it or turn it off): today's planned cardio or sport with Start, otherwise "Start a session" plus quick picks (your plan's sports first, then Run, Walk, Bike, Padel). While a session runs it shows the sport and time with Open. It never folds under "More".

### Company domain adroapp.com live (24 Oct 2026)
- adroapp.com is on Vercel with HTTPS; www redirects to it. adroapp.com opens the company site; /privacy, /terms and /support go to the site pages (the URLs for Apple); the web app is at adroapp.com/home.
- Invite links are now adroapp.com/i/CODE; support email support@adroapp.com in the app, site and store notes; Supabase login emails link to adroapp.com.
- Zoho mail: MX records added and mail now arrives. SPF needs fixing (written without spaces) and DKIM is still to add.

### First iPhone build on TestFlight (24 Oct 2026)
- Bundle ID changed to com.adroapp.app (com.adro.app was taken at Apple); widget target com.adroapp.app.ExpoWidgetsTarget.
- Signing certificates and provisioning profiles created (you, on your Mac, once). Team ID 7BS2Z3743C; App Store Connect app ID 6826500429 (in eas.json).
- Build 1 (version 1.0.0) built on EAS and uploaded to App Store Connect / TestFlight. The App Store Connect API key on Expo is now linked to the project, so later builds and uploads run from here without your Mac.

### Build 2 on TestFlight + company site only (24 Oct 2026)
- Build 1 was refused by Apple (missing microphone purpose string: three plugins removed it). Fixed; build 2 (1.0.0) built and uploaded to TestFlight.
- adroapp.com shows the company site at /, /privacy, /terms and /support (edge middleware, no redirect). "Start free", "Open Adro" and "Web app" links removed.
- The web app is no longer public: on adroapp.com and gymi-inky.vercel.app every app page shows the company site, except invite links (/i/…), the sign-up email page (/signup) and password reset (/reset-password), which the phone app needs. Vercel preview deployments keep the full web app for testing.

### Sleep page + AI analysis on every reading (24 Oct)
- Progress → Overall → Sleep tile opens a new Sleep page: last night (your log or the watch), deep/REM stages, week or 30-day chart, Adro's analysis, Log sleep.
- Sleep removed from the Recovery tab (recovery score and history only).
- Every reading page (steps, calories burned, weight, sleep, recovery, workouts, heart rate, resting HR, HRV, sleep efficiency, time in bed, VO2 max) shows "Adro's analysis": a summary, 2–3 insights and one tip, from the last 30 days. Comparisons are worked out on the server; the answer is kept until the numbers change.
- New AI task `reading_insight` (needs the ai function deployed). App part waits for the next update.

### Oura and Polar keys live (24 Oct)
- Oura and Polar secrets added by the owner; both start their sign-in page with no error (WHOOP too).
- The Polar Client ID was saved with a space or line break; the wearables function now trims every provider key (deployed, v18).
- Fitbit Air: no direct link; it reaches Adro through Google Health → Apple Health.

### Fitbit stays on Apple Health (24 Oct)
- Owner decision: no direct Fitbit link for now (Google Health API needs Google verification and a yearly security check).
- Connections: Fitbit and Fitbit Air now say "Through Apple Health" (Health Connect on Android) instead of "Coming soon"; tapping shows how to turn on sharing in the Google Health app. Waits for the next app update.

### Keyboard over sheets, second try (24 Oct)
- Build 5 still showed "Type what you ate" behind the keyboard: the sheet's position sat on the same view as its native-driver slide animation, so the keyboard move was likely ignored.
- Sheet: position and size on a plain outer view, the slide on an inner one. Keyboard height now from the keyboard's top edge, with will/did/change-frame events. Not tested on an iPhone yet; waits for the next update.

### Live Activity buttons did nothing (24 Oct)
- Cause (most likely): a tap wakes the app in the background, the tap's signal was sent and iOS put the app back to sleep before its JavaScript read it.
- Fix: expo-widgets patched (patches/expo-widgets+57.0.27.patch, applied by postinstall): a tap waits in a native list and the app stays awake until it is taken (up to 5 s) plus a moment to update the Live Activity. The app takes waiting taps on the event, when it opens, and when the workout or cardio screen starts listening.
- Native change: needs a new build (build 6); an OTA can't carry it. Not tested on an iPhone yet.

### Live Activity buttons, second try (24 Oct)
- Build 6 test by the owner: taps never reach the app at all (even with the app open), so the in-place buttons' intent never runs.
- Now every button is a link (adro://la?a=done …) that opens Adro, which does the action (app/la.tsx) and shows the workout or cardio screen. Works for sure, but opens the app instead of changing the number on the Lock Screen.
- Pure JavaScript change (the layout is sent at runtime), so an OTA update can carry it to build 6.
- Recovery tab: "What's in your score" and Adro's analysis. Reading analysis answer limit 2500 tokens, above/below the goal decided on the server (ai v95, tested 5/5).

### OTA update sent to build 6 (24 Oct)
- Update group 037852fd (runtime d81e38a…, same as build 6): Lock Screen buttons as links, recovery details and analysis.

### Live Activity buttons, third try (24 Oct)
- Owner doesn't want buttons that open the app: the link version is undone, in-place buttons are back.
- Likely real cause: iOS runs a LiveActivityIntent in the app only when the app target declares it; expo-widgets declares it only in its library, so taps ran in the widget's process and never reached the app.
- Fix: plugins/withLiveActivityIntent.js adds the same intent (LiveActivityUserInteraction) to the app target; it hands the tap to the app through ExpoWidgetsLiveTaps (patch). Checked with a prebuild that the file is in the Adro target. Needs a new build (7); not tested on an iPhone yet.

### App Review account (24 Oct)
- Created appreview@adroapp.com (username appreview, member, profile filled in, email confirmed); login tested. Password given to the owner in a file, not in the repo or chat. Do not delete it with test users.

### App tour for new accounts (24 Oct)
- Like the owner's sample video: the first time each tab opens, short cards point at the real buttons (dimmed screen, ring around the button, step dots "2/5", Next, Skip tutorial). Home starts with "Welcome to Adro" (Start, Skip, Don't show tutorials again).
- Tours: Home (tabs, AI coach, today's card, days, You), Food (+, what's left, reminders, days), Train (week, today's workout, plan, reminder), Progress (four views, reports), Gym Bros (add friends, friends/groups/activity).
- You → Replay app tour. Seen tours are kept on the phone. Arabic and English, checked with screenshots on the web build.
- Waits for build 7 (the Live Activity fix changed native code, so no OTA to build 6).

### Meal photo accuracy + model test (24 Oct)
- Fixes (ai v96): real food is never "decorative"; yellow-fruit look-alikes; measure the portion instead of assuming a full plate; calories and macros from the foods table (USDA + Gulf) by weight when the match is close; calories fit the macros. Admin-only model switch (BENCH_MODELS) for tests.
- Test: 40 lab-weighed dishes from Google Nutrition5k (US cafeteria food). On the 23 every model answered, median calorie error: Haiku before 76%, Haiku after 76% (weight error 61% -> 46%), Sonnet 5.5 39% (weight 23%), Opus 5.5 53% (weight 28%).
- Real cost per photo: Haiku $0.0009, Sonnet $0.012, Opus $0.022.
- OpenRouter balance: $5 total, $3.47 used (~$1.5 left). Needs a top-up.

### Meal photos: Gemini vs Claude (24 Oct)
- Same 40 lab-weighed Nutrition5k dishes. Median calorie error / weight error / protein error / within 20%:
  Haiku before 75% / 58% / 15 g / 8; Haiku after 62% / 45% / 11 g / 6; Gemini 3.5 Flash-Lite 32% / 16% / 5.5 g / 11; Gemini 3.8 Flash 31% / 17% / 3.1 g / 13; Gemini 4 Argon 31% / 21% / 3.4 g / 14.
  On the 23 dishes all answered: Sonnet 5.5 39%, Opus 5.5 53%.
- Cost per photo: Haiku $0.0009, Flash-Lite $0.0017, Flash $0.0059, Argon $0.0099, Sonnet $0.012, Opus $0.022.
- Gemini models no longer lean to overestimating (about half over, half under). Waiting for the owner's choice.

### Builds 7 and 8 failed; Lock Screen buttons, next step (24 Oct)
- Build 7: Xcode refused a plain "import ExpoWidgets" next to "internal import" elsewhere. Build 8: "a static dependency conflicts with LiveActivityUserInteraction", which shows the app already had the intent through expo-widgets: the "app doesn't declare it" theory was wrong. The app-target copy (plugin) is removed.
- Added a check instead of guessing again: every Lock Screen tap records when it ran, the button, the process (app or widget) and whether the app was listening; the app records when it got it. Shown on You → Widgets for admins ("Button check").

### Build 9 + OTA (24 Oct)
- Build 9 on TestFlight. Owner's Button check after tapping +: all dashes, so iOS never runs the button's intent at all (not in the app, not in the widget). Next: the iPhone's Console log to see why.
- OTA b8f86285 to build 9: the tour welcome card's Skip/Start no longer sit under the "Don't show tutorials again" link.

### VoiceOver: not now (25 Oct)
- Checked: 179 spoken labels; about 140 of 223 tappable elements have none; rings and charts on about 29 screens aren't spoken. Plan offered (stage 1 main screens, stage 2 the rest + large text). Owner: not now.

### Lock Screen buttons, after build 10 (25 Oct)
- Build 10's IPA: the app's Metadata.appintents lists LiveActivityUserInteraction (build 9 already did) and includes ExpoWidgets' package, yet iOS still says "There is no metadata for LiveActivityUserInteraction in com.adroapp.app". Apple forum (thread 780568): iOS only finds intents declared in the target's own code, not in a library.
- Fix: native/apple/AdroLiveTap.swift (LiveActivityIntent) is compiled into the app (plugins/withWidgetIntents.js) and into the widget extension (expo-widgets plugin patch); the extension's entry point makes the Live Activity buttons use it (ExpoWidgetsLiveButton.makeIntent). It hands the tap to the app's JavaScript through the same notification and a shared queue. Checked with a trial prebuild: the file is in both targets. Needs build 11.
- Note: .gitignore ignores every folder named "ios", so native Swift files live in native/apple.

### Build 12 on TestFlight (25 Oct)
- Build 11 didn't compile (missing import AppIntents, ButtonRole ambiguous); fixed. Build 12 built and was submitted.
- IPA check: AdroLiveTap is declared in the app's own code (Adro.AdroLiveTap) and in the widget's (ExpoWidgetsTarget.AdroLiveTap). Waiting for the owner's test on the Lock Screen.

### Lock Screen buttons, after build 12 (25 Oct)
- Console: the button now sends AdroLiveTap, but as ExpoWidgetsTarget.AdroLiveTap (mangled 17ExpoWidgetsTarget11AdroLiveTapV); the app registers Adro.AdroLiveTap, so iOS still says "There is no metadata for AdroLiveTap in com.adroapp.app". iOS matches the full type name.
- Fix: the widget extension's Swift module is named Adro (PRODUCT_MODULE_NAME, set where expo-widgets creates the target), so the type is Adro.AdroLiveTap in both. Checked with a trial prebuild. Needs build 13.

### Start cardio redesign (25 Oct 2026)
- Step 1: pick a sport from an icon grid, colored by group, with filter chips.
- Step 2: the setup. Coach recommendation card, one card for zone, steady/intervals and time, a list for heart rate source, GPS and spoken tips. Start stays at the bottom with a summary line.
- All earlier options kept. Ships in build 14 with the Lock Screen button fix (widget module named "Adro").
- Build 13 failed: two targets made the same Adro.swiftmodule. Fixed by turning off SWIFT_INSTALL_MODULE on the widget target. Build 14 built and was sent to TestFlight.

### Start cardio fixes after build 14 (25 Oct 2026)
- Sport list now sits right under the filters (the filter row was stretching down the page).
- Bluetooth "Find" works: the sensor search opens inside the same sheet (iOS shows only one sheet at a time). This also fixes the screen freezing after "No sensor".
- New: today's session from your cardio plan shows at the top of the picker, one tap to set it up.
- "Cardio and sports" (plan editor) now uses the same look: sport tiles with group colors, pill buttons for sessions, days and minutes, sport badges in the week.
- Sent as an OTA update to build 14 (group 661596a3).

### Lock Screen buttons: the real cause (25 Oct 2026)
- Build 14 log: the tap reaches iOS with the right type (4Adro0A7LiveTapV), but iOS says "There is no metadata for AdroLiveTap in com.adroapp.app". The perform() never ran (Button check: "Ran: –").
- The build 14 IPA has AdroLiveTap in the app's Metadata.appintents, but extract.packagedata also includes expo-widgets' package (ExpoWidgetsIntents, added in build 10). expo-widgets is a static library with no framework in the app, so iOS can't find that package and drops the app's whole metadata (same as Apple bug FB13281659).
- Another app's Live Activity buttons work on iOS 27.0.1 with the intent in both targets and no package, so the module name wasn't the cause.
- Fix (build 15): removed the AppIntentsPackage (plugin and patch), made AdroLiveTap public. Module name "Adro" kept (it builds).
- Build 15 built and was sent to TestFlight. Its IPA: no extract.packagedata any more; AdroLiveTap in the app's actions (mangledTypeNameV2 4Adro0A7LiveTapV, the old mangledTypeName field still empty).

### Lock Screen buttons work + weight on every weighted set (25 Oct 2026)
- Buttons work after deleting the app and installing build 15 fresh (iOS kept the old intent metadata on update).
- Live Activity: a weighted exercise always shows its weight ("– kg" when none yet). The first + starts from a usual weight (bar 20 kg, dumbbell 7.5, machine/cable 15), then ±2.5. Until a weight is set, the tip says "Set the weight with + first" (Done doesn't log 0 kg).
- Sent as an OTA update to build 15 (group 109cefc0).

### Arabic layout on the phone (25 Oct 2026)
- In Arabic the phone app runs right to left, and React Native swaps left and right in styles and text alignment by itself. The app picked "right" for Arabic itself (made on the web, which doesn't swap), so on the phone it landed on the left: Arabic text aligned left, the tab bar's highlight on Gym Bros while on Home, the tour ring on Gym Bros instead of the coach button, toggles and the protein slider mirrored.
- Fix: lib/rtl.ts side() gives the style key for a side of the screen (swapped on the phone in Arabic only). Used in Text, Field, PhoneField, Toggle, TabBar, ProteinSlider and the tour ring.
- Weekly recap: the weight arrow points left in Arabic (63.9 ← 64.1), and +/− numbers stay whole ("+0.2", not "0.2+").
- Full Arabic check after that:
  - Every plain text in Arabic keeps signed numbers whole (lib/rtl.ts keepSigns in Text): "+0.2 kg", "+966" in the phone field, "(−1.5)".
  - Report PDF: arrow by language, "cm" translated, signs kept.
  - First open in Arabic (from the phone's language): the app restarts once so the welcome screens aren't half mirrored (once per direction, never loops).
  - Checked and fine: icons that point (back, chevrons) are mirrored; charts are drawn the same in both languages; text set to the end of a row (counters, number columns) moves to the left in Arabic as it should; the protein slider and the plan's drag and drop follow your finger; no missing Arabic text.
- Sent as an OTA update to build 15 (group a812286f).

### Connections: Bluetooth sensor instead of Fitbit (25 Oct 2026)
- The Fitbit card is replaced by "Bluetooth sensor" (blue Bluetooth icon): the same heart rate sensor live cardio uses (chest straps, watches that broadcast heart rate).
- Tap: finds sensors nearby and saves the one you pick (it connects by itself when you start cardio). Once saved, the card shows its name; tap for Start cardio, Use another sensor, or Forget this sensor.
- The sensor search is one shared component now (components/hr/ScanList), used by Connections and Start cardio.
- Checked on the web build in Arabic and English, no errors. Google Fitbit Air stays (through Apple Health).
- Sent as an OTA update to build 15 (group 93410333).
- Then: the "Your device > Its own app > Apple Health > Adro" chevrons pointed the wrong way in Arabic (the back icon, which Arabic already mirrors, was mirrored again). Now the plain chevron, mirrored once. Sent as an OTA update to build 15 (group 6b8edd9d).

### Recipe from a TikTok link failed (25 Oct 2026)
- "Couldn't open that link" for https://vt.tiktok.com/ZSgQVMv3T/. The link redirects fine to the video, but TikTok's preview (oEmbed) no longer gives the caption, author or cover picture, so the AI had nothing to read.
- Fix (ai function): the caption, author and cover are also read from the video page and from its embed page (the longest caption wins). Tested with that link: caption "honey garlic chicken…", by ifoodwithu, and the cover picture.
- Then (owner): read what's written on the video too, without uploading it. The server now downloads the TikTok video itself (the embed page links it, from TikTok's own servers only, up to 20 MB; about 6 MB for this one) and a model that watches video (Gemini 3.5 Flash-Lite, Haiku reads pictures only) reads the amounts on screen and what goes in. If that fails, the caption and cover give the recipe as before.
- Tested here: caption, cover and the 6 MB video all come through for that link. The AI step itself can only be tested after deploying (the AI key lives on the server).
- Then (owner): after the recipe is read from the video, it's checked against the caption ingredient by ingredient; where they differ, the caption wins, and ingredients only the caption lists are added. The note says where they disagreed. (For uploaded videos too.)
- Deployed (ai v98). Tested with the owner's link (Arabic): 7.4 s, Gemini 3.5 Flash-Lite watched the video and gave honey garlic chicken with 10 ingredients and the real steps (marinate 15 minutes, cornstarch, fry, sauce), 3 servings. Cost $0.0031. Test user deleted.

### Recipe: frying oil counts only what the food absorbs (25 Oct 2026)
- The test recipe counted all 100 g of frying oil (884 kcal). Now: about 12 g oil per 100 g of battered/breaded/floured food and 6 g per 100 g of plain food, named "oil absorbed in frying"; oil that stays in the dish (sauté, sauce, dressing) counts in full.
- Deployed (ai v99). Same link again: "oil absorbed in frying" 65 g, 575 kcal (was 100 g, 884 kcal). Test user deleted.

### "Add an exercise" did nothing for one user (akeel) (25 Oct 2026)
- Likely cause: from a day's sheet, "Add an exercise" goes to Edit workout and opens the exercise list right away, while the day's sheet is still closing. The iPhone shows one sheet at a time, so the list never appeared; the screen then thought it was open, and tapping "Add an exercise" changed nothing. Timing differs by phone (the owner's was fast enough).
- Fix: Sheet.tsx afterSheet() waits for a sheet to finish closing. Used before going to another screen from DaySheet (4 places), MealMenu and IngredientsSheet, and before Edit workout opens the list by itself. Each tap on "Add an exercise" (or swap) opens a fresh list, so a list that couldn't show opens on the next tap.
- Sent as an OTA update to build 15 (group 320ed501).

### Calorie setup: target weight, and body fat labels (25 Oct 2026)
- Goal step: with a cut or bulk, a "Target weight" card (half a kilo a tap; starts about 8% lower for a cut, 5% higher for a bulk; a cut never goes under a healthy weight for your height, BMI 18.5). Shows about how many weeks at these calories and the month you'd get there. Saved in the plan (targetWeight); switching between cut and bulk starts the target over.
- Your plan screen: "Target 78 kg: about 22 weeks, around March 2027". Progress → Weight chart: a dashed line at the target.
- Body shape step: the text says the number under each body is its body fat percentage, and each one says "body fat" under the %.
- Checked on the web build in Arabic and English, no errors. Test users deleted.
- Sent as an OTA update to build 15 (group 29915c1d).

### Sign-in emails with the code (25 Oct 2026)
- Today's Supabase emails send a link only (confirm, sign-in, reset), though the app takes the 6-digit code.
- Made branded Arabic + English templates with the code large and clear and the link as a backup, the code also in the subject: sign-up, sign-in, password reset, email change, re-verification (supabase/auth-emails/).
- Supabase refused the change: "Email template modification is not available for free tier projects using the default email provider." Nothing changed. They go live as soon as Resend is set up as the custom SMTP (old settings saved first).
- Owner set up Resend: domain adroapp.com on GoDaddy DNS (DKIM TXT resend._domainkey, CNAME rsend, CNAME send; Zoho mail records untouched), Supabase custom SMTP smtp.resend.com:465 as Adro <hello@adroapp.com>, email rate limit 50 an hour, RESEND_API_KEY in function secrets. Checked all of it from here.
- Templates applied (all five with the code). Test: a sign-up to the owner's Gmail (plus address) was sent through Resend; the test account was deleted right after.

### Sign-in emails in one language (25 Oct 2026)
- Owner: one language per email, not both. Each template (and subject) now picks Arabic or English from the account's language (user_metadata.language, set at sign-up); the app keeps it in step with the app's language (auth.tsx). Applied to Supabase.
- Test: one Arabic and one English sign-up sent to the owner's Gmail (plus addresses); test accounts deleted right after.
- Sent as an OTA update to build 15 (group 29915c1d).

### Welcome email (25 Oct 2026)
- Sent once, right after someone confirms their email, in the account's language: a welcome, the account's details (name, username, email, phone if given, account type, date joined; never the password), the first three steps, an Open Adro button, and "reply for help". From Adro <hello@adroapp.com> through Resend.
- How: a trigger on auth.users (email confirmed) calls the new welcome function with a shared secret (vault "welcome_hook" = function secret WELCOME_HOOK_SECRET); welcome_emails keeps it to once per account (server only). Test addresses (.invalid) are skipped. A failed send can be tried again; it never blocks confirming.
- Files: supabase/functions/welcome, supabase/migrations/20261128000000_welcome_email.sql. Preview checked in Arabic and English.
- Applied: migration, vault secret welcome_hook + function secret WELCOME_HOOK_SECRET (random, never shown), welcome function deployed (v1, no JWT check). Test: an Arabic sign-up to the owner's Gmail (plus address), confirmed from the database: the trigger called the function, it answered {sent: true, lang: ar}. Test account deleted right after.

### Codes in the app (25 Oct 2026)
- Owner got the "Confirm your new email" code but the app had nowhere to type it: the app still waited for links (config EMAIL_CODES = false, made for before Resend). Now EMAIL_CODES = true: sign-up, sign-in, password reset and email change all ask for the 6-digit code.
- Email change: Supabase sends a code to both the new and the current email (secure email change). The app now asks for the new email's code, then the current one's; the change happens when both are in.
- Sent as an OTA update to build 15 (group 483e6015).

### Logo in the emails (25 Oct 2026)
- The code emails and the welcome email show the Adro app icon (https://adroapp.com/icons/icon-192.png) above "Adro". Preview checked.
- The round picture next to the sender in the inbox (the "H") is chosen by the mail app: Gmail and Apple Mail show a brand logo only with BIMI and a paid logo certificate (VMC/CMC). Not done.
- Applied: templates updated, welcome function v2. Test sign-up (Arabic) to the owner's Gmail: code email and welcome email sent; test account deleted.

### Welcome email to existing users (25 Oct 2026)
- Owner asked to send the welcome to everyone. Sent to the 4 real addresses (3 Gmail, 1 Hotmail), all in English (their accounts' language). Skipped: 4 old @gymi.app accounts (that domain has no mail server, the emails would bounce and hurt sending) and the App Review account. welcome_emails marks them, so none gets it twice.
- Small fix (not deployed yet): the welcome email takes the language the app keeps on the account (user_metadata) before the profile's.

## Meal edit: change the amount (25 Oct 2026)

- Ask: on a logged food (e.g. 11 g ketchup), Edit had no way to change how many grams.
- Done: when we know the food's numbers per 100 (food list or scanned product), Edit shows an **Amount** field. Typing grams recalculates calories, protein, carbs and fat, and the "…, 11 g" at the end of the name follows. The ½ / 1.5× / 2× chips also scale the amount.
- File: src/app/logged.tsx. Sent as OTA 98e4803d (build 15 runtime).

## Barcode: blurry up close (25 Oct 2026)

- Ask: up close the camera is blurry, so you had to scan from far away; if it didn't catch it, you had to type the code.
- Cause: our camera view uses only the main lens, which can't focus closer than about 15–20 cm.
- Done: on iPhone the barcode screen now opens Apple's own scanner (VisionKit, the one Live Text uses, already inside expo-camera). It switches to the macro lens up close, has pinch-to-zoom and guidance, and highlights the code. Swipe it down: the screen shows "Open the scanner" and "Enter the code by hand". Phones that can't run it keep the old camera view.
- File: src/app/barcode.tsx (+2 Arabic strings). JS only, same native fingerprint as build 15. Sent as OTA 6579871b.

## Create a meal: one "Add an ingredient" button (25 Oct 2026)

- Ask: keep only "Add an ingredient" and have it open the same look as Log food, so the screens match.
- Done: the "Scan a barcode" button is gone. "Add an ingredient" opens a new sheet built like Log food: search, Meal photo (AI lists the ingredients and adds them all), Scan barcode, Label photo (adds the product per 100 g, one serving), Saved meals (adds another saved meal's ingredients), Choose from photos, and Type what you ate (AI). Everything is added to the meal, not logged. Grams can be changed in the list as before.
- Files: src/components/food/AddIngredientSheet.tsx (new), src/app/saved-meals.tsx, +1 Arabic string. Checked on web: sheet, saved meals, search. JS only. Sent as OTA ddb8b38d (build 15).

## Log food: keep the meal you picked (26 Oct 2026)

- Ask: pick Lunch on the first add, and the next adds stay Lunch; pick Dinner later, and it goes to Dinner.
- Done: the meal you pick yourself (the chips in Log food or search, a meal card, or the meal on a result) is remembered for that day and kept on the phone, so it survives closing the app. Opening Log food again starts on it. A new day starts fresh: the meal for the time of day (today) or the first empty main meal (an earlier day).
- File: src/lib/food.tsx. JS only. Sent as OTA ddb8b38d (build 15).

## Rings on an earlier day: Recovery and Commitment show too (26 Oct 2026)

- Ask: changed the rings while looking at yesterday and they didn't show; then "can't you make them show on yesterday?"
- Found (web test): the rings are one setting and saved fine, but an earlier day hid Recovery and Commitment, so yesterday stayed on Calories alone.
- Done: every ring now shows on an earlier day with that day's value. Recovery uses that day's check-in or watch sleep, training load up to that day, that day's protein and water, and the watch's HRV and resting heart rate (recovery tools count for today only). Commitment is the 7 days up to that day ("Last 7 days"). The "today only" note added earlier was taken back out.
- Also fixed: coming back to today from an earlier day could pop up "Goal hit!" with the earlier day's calories. The celebration now waits until today's own food is loaded.
- Checked on web: Oct 25 showed Commitment 69% (last 7 days) and Recovery 60% (5 h sleep); today showed 77% and 93% (8 h sleep), and no popup. Test user deleted (0 left).
- Files: src/components/train/RecoveryCard.tsx, src/components/home/metrics.ts, src/components/home/MainCard.tsx, src/components/food/RingClosed.tsx, +1 Arabic string. JS only. Sent as OTA ddb8b38d (build 15).

## Barcode: count in pieces (26 Oct 2026)

- Ask: for some products, log by pieces, matching the nutrition facts; and when adding a new product the first time, set it up in pieces.
- Database (approved "طبق", applied): `foods.piece_g` (weight of one piece, g or ml; null = not counted in pieces). `save_user_product` and `fix_product` take an optional `p_piece_g`, so older app versions keep working. Migration 20261129000000_product_pieces.sql.
- New product form: a "pcs" chip under g/ml. On, it asks "Pieces in one serving" (e.g. 2 biscuits in 30 g) and shows "1 piece = 15 g". The label numbers stay per 100, so pieces turn into grams with the same facts.
- How much: a "Pieces" option (first, when the product has pieces) with a stepper; logged as "Name, 3 pcs".
- Scanning it again: it starts on Pieces. Open Food Facts products get pieces too when their serving reads like "2 biscuits (25 g)".
- Checked on web: saved piece_g 15, logged "Test dates, 3 pcs" 225 kcal (3 × 15 g at 500 kcal/100 g), and the rescan opened on Pieces. Test product and user deleted (0 left).
- Files: src/app/product.tsx, src/lib/products.ts, src/lib/foodsDb.ts, +6 Arabic strings. JS only for the app. Sent as OTA ddb8b38d (build 15).

## Barcode: change what one piece weighs (26 Oct 2026)

- Ask: let me set how many grams one piece is.
- New product form: next to "Pieces in one serving" there's now "One piece weighs" (g/ml). Type either; the other follows from the serving size. With the label "per 100", the piece weight alone is enough.
- Product screen: tap "1 piece = 15 g ✎" to change it, or "Count it in pieces" on a product without pieces. It's saved as your own copy of the product (like fixing its numbers), so your next scan uses it.
- Checked on web: typed 12 g a piece (540 kcal/100 g) → 65 kcal a piece; changed it to 20 g on the product screen → saved, rescan showed 108 kcal a piece. Test product and user deleted (0 left).
- File: src/app/product.tsx, +7 Arabic strings. JS only. Sent as OTA ddb8b38d (build 15).

## Label photo: Apple's document scanner (26 Oct 2026)

- Ask: like the barcode (Apple's own scanner), use Apple's way for Label photo and Meal photo if it exists.
- Meal photo already opens the iPhone's own camera (system picker); Apple has no special scanner for food, so it stays.
- Label photo now opens Apple's document scanner (VisionKit, the one in Notes): it finds the label's edges, focuses up close and straightens the picture, then the first page goes to the AI as before. Used in Log food, Add an ingredient and "Read the label from a photo" on a product. "Choose from photos" and phones without it use the normal camera.
- Library: react-native-document-scanner-plugin 2.0.4 (installed with npx expo install, config plugin added). Native code, so it needs a new build: the fingerprint changed (cd9dea8… → 3f4057e…), and OTAs from now on reach the new build, not build 15.
- Files: src/lib/photo.native.ts (takeLabelPhoto), src/lib/photo.ts, LogSheet, AddIngredientSheet, product.tsx, app.json, package.json. Not built yet (waits for "صدر النسخة").

## Meal photo: our own camera screen (26 Oct 2026)

- Ask: when Meal photo opens the camera, make it look like the barcode screen, as part of our app.
- Done: new screen /meal-camera (expo-camera): rounded camera view with a frame, flash, a big shutter button, "Choose from photos", and a tip to fit the whole plate in from a little above. The photo goes to the AI as before.
- Used from Log food (Meal photo), Retake on the meal result, and Add an ingredient (the foods come back to the meal you're making). The web keeps the old file picker.
- Files: src/app/meal-camera.tsx (new), src/lib/photo(.native).ts (photoFromUri), src/lib/pending.ts, LogSheet, AddIngredientSheet, saved-meals.tsx, meal-result.tsx, +2 Arabic strings. Goes with the next build.

## Barcode: Apple's scanner got stuck (26 Oct 2026)

- Report: the barcode screen tries to open the scanner, then hangs and its buttons stop working (camera dot stays on).
- Likely cause: the scanner opened by itself right away, while Log food's sheet was still closing, so it ended up hidden behind the screen and took the taps.
- Fix: it now opens after the screen has finished opening (after interactions + 0.5 s); any half-open scanner is closed before a new one opens; Log food opens the next screen only after its sheet has closed (afterSheet).
- Files: src/app/barcode.tsx, src/components/food/LogSheet.tsx. Not tested on a phone yet.
- Sent to build 15 as OTA efd34ecc, published from commit 981db07 (the last OTA) + only this fix, because main now has the native document scanner (new fingerprint).

## Barcode: Apple's scanner inside our screen (26 Oct 2026)

- Ask: put Apple's own scanner inside our barcode screen (the box with the frame and flash), not opened over the app. (A first try that only changed our camera's lens was stopped by the owner: "I want Apple's own one".)
- Done: a local native module modules/adro-scanner (Swift, Expo Modules): `AdroScannerView` hosts Apple's DataScannerViewController (VisionKit) as a child view controller, so it lives inside the box. EAN-13/8 and UPC-E (UPC-A comes as EAN-13), pinch to zoom, guidance, highlight; events onCode and onUnavailable; torch is best effort.
- Barcode screen: the box shows Apple's scanner; if the phone can't run it (or an older app build), our camera view as before. The pop-over scanner and its "Open the scanner" card are gone.
- Native code, so it needs the new build; the fingerprint changed again (3f4057e… → ab304eb…). The iPhone and web JS bundles build; the Swift is checked by the EAS build.
- Files: modules/adro-scanner/{package.json, expo-module.config.json, index.ts, ios/AdroScanner.podspec, ios/AdroScannerModule.swift}, src/app/barcode.tsx.

## Build 17 (26 Oct 2026)

- Build 16 failed at "Configure expo-updates": `.gitignore` had `ios/`, which also hid modules/adro-scanner/ios, so the Swift never reached EAS (runtime mismatch). Fixed to `/ios/` and `/android/`; the module files are committed.
- Build 17 (f5acf278) finished and was sent to App Store Connect (auto-submit). Runtime 6e1d9a57…, same as the local fingerprint, so OTAs from here reach build 17.
- In it: Apple's scanner inside the barcode screen, Apple's document scanner for label photos, our own meal camera, and everything sent before.

## Label photo on our camera screen; "Choose from photos" link removed (26 Oct 2026)

- Ask: make Label photo like Meal photo (our camera screen, no document scanner), and remove the "Choose from photos" link since each camera screen has its own gallery button.
- Done: the camera screen (/meal-camera) takes `kind` = meal or label: title, tip ("Fit the nutrition facts table in the frame…") and where it goes (/meal-result or /label-result). Used by Log food (both tiles), Add an ingredient (both; the result comes back to the meal), and "Read the label from a photo" in the product form (the numbers fill the form). One hand-back slot for all of them (setPendingCapture).
- The "Choose from photos" link is gone from Log food and Add an ingredient (the web keeps "Take photo / Choose from photos" after a cancelled camera).
- Apple's document scanner is no longer used; its package stays installed so build 17's fingerprint (6e1d9a57…) doesn't change and this goes as an OTA.
- Files: src/app/meal-camera.tsx, src/lib/pending.ts, src/lib/photo(.native).ts, LogSheet, AddIngredientSheet, saved-meals.tsx, product.tsx, +2 Arabic strings. Sent as OTA 0139911f (build 17).

## Day streak page + milestones (26 Oct 2026)

- Ask: a day-streak page like WHOOP's, where every stretch of the streak unlocks a new milestone. Then: "don't copy the picture, make it different and fit our app".
- Done: new screen /day-streak in Adro's own style. A cobalt ring that fills up on the way to the next milestone, with the streak in the middle and "5 days to Two weeks" under it. Three tiles: best streak, when it started, milestones reached (x/16). This week with the same dots as the Streaks tab. "Your journey": milestones down a path (First spark 3, One week 7, Two weeks 14, Habit formed 21, One month 30, 50, 75, The 100 club, 150 … One year 365, 500, Two years 730, Legend 1000): reached ones show the date, the next one a progress bar, the rest are locked; "Show all milestones". Share your streak.
- "New milestone" pop-up: once, the first time your streak reaches a milestone higher than any celebrated before (kept per account on the phone; the first run after the update only remembers where you are, no pop-up for the past). It waits 3 s after the data loads.
- Opened from the Streaks tab (Overall card) and the Overall box in the Home streaks card. The same "streak" as before: any day you log food, a workout, water, a check-in or a measurement.
- Checked on web: a 9-day streak showed 9, "5 days to Two weeks", started Oct 18, 2/16, First spark reached Oct 20, One week Oct 24, and the One week pop-up. Test user deleted (0 left).
- Files: src/app/day-streak.tsx, src/lib/streakMilestones.ts, src/components/streak/MilestoneUnlocked.tsx, _layout.tsx, progress/Streaks.tsx, home/InfoCards.tsx, Arabic strings. JS only (build 17 fingerprint). Sent: OTA 70632b83 (26 Oct).
- ON HOLD (owner wants to review): `STREAK_PAGE = false` in src/lib/config.ts hides the links and the pop-up, so an OTA can go out without it. Preview sent as Adro-day-streak-preview.pdf. To turn it on: set STREAK_PAGE to true.

## Home: Discover more (26 Oct 2026)

- Ask: a "Discover more" section like WHOOP's, on our Home.
- Done: at the bottom of today's Home (above Edit home), four cards with a soft coloured icon tile, a line and a link: Your blood tests (→ /blood), Connect your watch (→ /connections), Bring a friend (→ /invite), Get a coach (→ /findcoach). No shop (no selling). Arabic strings added.
- File: src/components/home/DiscoverMore.tsx (new), src/app/(tabs)/home.tsx. JS only. Sent as OTA 0139911f (build 17).

## Product form: g / ml / pcs in one switch (26 Oct 2026)

- Ask: tidy the "pcs" button (it sat alone under g/ml).
- Done: one three-way switch next to Serving size: g | ml | pcs. pcs = counted in pieces (grams per piece fields show below). File: src/app/product.tsx. JS only. Sent as OTA 0139911f (build 17).

## Cardio: sport pickers as a simple list (26 Oct 2026)

- Ask: rearrange the two cardio screens like WHOOP's "Select activity" list, simple, in our identity.
- Done: new SportList (replaces the grid of tiles): a search box, tabs (All, Cardio, Racket, Team, Combat, Mind & body, Other) with a cobalt underline, "Recent" (your last 3 sports, kept on the phone), then "All A–Z". Each row: the sport's coloured badge, name, and a chevron (or a check when picked). Short lists (8 or fewer) show just the rows.
- Used in Start cardio (step 1) and the cardio plan (Cardio to add, Sports you play). The old SportTiles grid is removed.
- Checked on web: Start cardio showed Recent (Padel, Run) and A–Z; the Racket tab showed 4 sports. Test user deleted (0 left).
- Files: src/components/cardio/SportTiles.tsx (SportList), src/lib/recentSports.ts (new), src/app/cardio-live.tsx, src/components/train/CardioPlan.tsx, +4 Arabic strings. JS only. Sent as OTA 0139911f (build 17).

## Workout: the next set starts at the weight you just lifted (26 Oct 2026)

- First ask: fill the coach's suggested weight on the next set. Changed the same day: the user wants the last weight they typed instead (84 on set 1 → set 2 shows 84), on the screen and the widget.
- Done: when a working set is logged (on the screen or from the Live Activity), its weight is filled in on the next working set, unless you already typed one there. Warm-up, timed and bodyweight sets are left alone. The coach's tip still shows as text. The Live Activity shows the current set's weight, so it shows 84 too.
- Files: src/lib/activeWorkout.ts (logSet), src/app/active.tsx, src/components/WorkoutLive.tsx. JS only. Sent: OTA 70632b83 (26 Oct).

## Approved: exercise picker grid, Day streak on (26 Oct 2026)

- Exercise picker (Replace / Add exercise): two squares a row with the exercise's photo, a cobalt swap (or +) badge, name, muscle and equipment; a red strip when it may strain an injury. Used for "same muscle" and the full search. File: src/components/train/ExercisePicker.tsx.
- Day streak page and its milestone pop-up turned on (STREAK_PAGE = true in src/lib/config.ts).
- JS only. Sent: OTA 70632b83 (26 Oct).

## Workout screen: one exercise a page, tabs on top (26 Oct 2026)

- Approved design: the exercises as tabs under the progress bar (number in a circle, white pill for the one you're on, a green check once all its sets are done); one exercise per page; swipe left/right (reversed in Arabic) or tap a tab; "Next: {exercise}" under the card; page dots (green = done).
- When the last set of an exercise is checked, it moves on to the next exercise with sets to do (0.6 s later). Moving an exercise up/down takes the page with it.
- Checked on web: 3 of 3 sets on Barbell row → page moved to Lat pulldown, first dot green. Test user deleted (0 left).
- File: src/app/active.tsx (+1 Arabic string). JS only. Sent: OTA 70632b83 (26 Oct).

## Barcode: black camera on one iPhone (26 Oct 2026)

- Problem: on Ali's iPhone, Scan barcode turns on the flash and shows Apple's hints ("Slow down", "Find nearby barcodes"), but the camera picture stays black. Meal photo works on the same phone. Two other phones work fine.
- Reading: Apple's scanner is running and getting frames; only its picture is black. It was started while the screen was still sliding in, which can leave the picture black on some phones.
- Done: Apple's scanner now starts after the screen has opened (half a second). Under "Enter the code by hand" there's a small link, "Camera not showing? Use the other camera", that switches to our regular camera (the one Meal photo uses).
- Files: src/app/barcode.tsx, src/i18n/ar.ts. JS only, works with build 17. Sent: OTA 70632b83 (26 Oct).

## Workout: replacing an exercise froze the app (26 Oct 2026)

- Problem: in a plan workout (Legs A), tapping the swap button and picking a new exercise froze the whole app.
- Cause: right after you pick, the "Only this time / Always" sheet opened while the exercise list was still closing. Two sheets opening at once freeze the iPhone app.
- Done: that sheet now opens once the list has closed (afterSheet, the same fix used elsewhere in the app).
- File: src/app/active.tsx. JS only, works with build 17. Sent: OTA 35362d74 (26 Oct).

## Product: the + button was off the screen (26 Oct 2026)

- Problem: on the product screen, under How much? → Servings, the − and the number showed but the + was gone (pushed off the screen).
- Done: the − number + buttons have a fixed width there, and the "1 serving = 55 g" text takes the rest and wraps if it's long. Same for pieces, and on the add-a-product screen.
- File: src/app/product.tsx. JS only, works with build 17. Sent: OTA 35362d74 (26 Oct).

## Exercise picker: opens smoothly (27 Oct 2026)

- Problem (screen recording): replacing an exercise, the list opened small with a spinner, then grew tall at once, and showed big white squares until the photos loaded.
- Done: while it loads, the list shows 6 gray squares where the exercises will be, so the sheet opens at its full height and nothing jumps. The photo boxes are dark (not white) until the photo fades in. Same in the full search.
- File: src/components/train/ExercisePicker.tsx. JS only, works with build 17. Sent: OTA 6c1e064b (27 Oct).

## Workout screen: kg/lb switch per exercise, no move arrows, reps range by "reps" (27 Oct 2026)

- Ask: a kg/lb switch by the weight column, with the coach knowing the unit; remove the move up/down arrows (the tabs replace them); show the reps range next to "reps" instead of up top.
- Changed the same day: the switch first changed the whole app's unit; the user wants it for that exercise only.
- Done: the weight column title is a small kg | lb switch for that exercise. The choice is kept on the phone by exercise id (settings `exUnit`) and used in every workout; exercises you never switched use your usual unit from Settings, and nothing else in the app changes. Sets stay saved in kg. For that exercise, the boxes, the coach's tip under it (5 lb steps in lb), the Live Activity and its +/− buttons use its unit. The AI coach gets `exerciseWeightUnits` next to `weightUnit`. The arrows and move() are gone. The column title reads "reps 4–6" ("seconds 30" for timed ones).
- Files: src/app/active.tsx, src/components/WorkoutLive.tsx, src/lib/units.ts (useExerciseWeight), src/theme/settings.tsx, src/app/coach.tsx. JS only, works with build 17. Sent: OTA 6c1e064b (27 Oct).

## Commitment rate: workouts before the plan changed now count (27 Oct 2026)

- Ask: on Last 30 days, "Workouts as planned" said "0 of 1 workouts"; it should count the workouts of the last 30 days. Also asked why sleep is out of 10 and the rest out of 16.
- Cause: workouts only counted from the day the plan was made or its days last changed (since / weekSince), so workouts done before that change disappeared. It also read only the recent workout logs.
- Done: before the plan (or its days) started, a day you trained counts as a workout done as planned; a day without one isn't judged (we don't know that old plan). It reads your whole workout history. Same for the 7 days, the home card and the reports (all use commitWindow).
- Not changed (on purpose): the days count from your first day in the app (16 days), so days before you joined don't pull you down; sleep counts only the nights you logged or your watch measured (10), so a night without data isn't counted as bad sleep.
- File: src/lib/progress.ts. JS only, works with build 17. Not sent yet.

## AI: Meal photo and Label photo on Gemini 3.5 Flash-Lite (27 Oct 2026)

- Ask: switch to Gemini 3.5 Flash-Lite only for photos.
- Done (code): the ai function uses google/gemini-3.5-flash-lite (PHOTO_MODEL, through OpenRouter, same key) for meal_photo and label_photo. Everything else stays on Claude Haiku 5.5: chat, typed food, recipes, plans, the machine photo and lab reports (PDF). A retry uses the same model. The admin's model comparison still overrides it.
- File: supabase/functions/ai/index.ts. Server only (no app update needed).
- Applied (owner: "طبق"): deployed ai v102. Tested with a test user: meal_photo went to google/gemini-3.5-flash-lite (6.5 s, $0.0019, found chicken, brown rice, salad); food_text stayed on claude-haiku-5.5 ($0.0003). Test user deleted (0 left).

## Pricing file (27 Oct 2026)

- Ask: what the app costs with the services we pay for, the cost of a 1-week free trial (3 photos, 4 messages), and the cost of a monthly subscriber; as a PDF.
- Done: docs/Adro-pricing.pdf (Arabic, 4 pages; source docs/pricing/pricing.html and calc.py). AI costs from the real ai_calls table (1,153 requests, 11 to 27 Oct). Fixed costs about $74 (277 SAR) a month at launch (Apple, Supabase Pro, Expo Starter, Vercel Pro, domain; Resend and Zoho free), about $10 now. Trial user about 0.05 SAR. Subscriber about 1 SAR of AI a month (heavy 2.4, capped at about 12 by the 80-a-day limit). At 39 SAR a month: 28.83 SAR reaches us after 15% VAT and Apple's 15%, about 27.85 profit; 10 subscribers cover the fixed costs.
- Found: on the real data, Meal photo on Gemini 3.5 Flash-Lite costs about twice Haiku ($0.00171 vs $0.00089 a photo).

## Pricing decided: one unlimited plan, 29 SAR a month (27 Oct 2026)

- Decided: one plan (no two tiers), unlimited, 29 SAR a month; yearly kept at 299. Free trial: 1 week (3 photos, 4 messages).
- Done: app subscription page price 29 (src/app/subscription.tsx; still hidden while PAID_PLANS_LIVE is false), "Unlimited meal photos" line (+ Arabic); website price 29 and "Unlimited AI coach and food photos" (scripts/build_site.py, public/site rebuilt).
- Numbers at 29: 21.43 SAR reaches us after VAT and Apple; AI about 1.27 a month (2.26 heavy, 12 at the daily cap) so about 20 SAR profit; about 14 subscribers cover the fixed costs.
- Open: the site and the app still show a "Free forever" plan next to it; the trial isn't built yet.

## Decided: trial and free use (27 Oct 2026)

- Trial: the first 7 days after sign-up, AI limited to 3 photos and 4 coach messages a day.
- After the trial without a subscription: the app stays open (workouts, food by search and barcode, streak, friends), with no AI.
- Subscription: one plan, unlimited, 29 SAR a month (299 a year). To be built before launch.
- Payment way (RevenueCat or Apple StoreKit directly): explained to the owner, waiting for the choice.

## Payments with RevenueCat: built, not live (28 Oct 2026)

- Owner: RevenueCat; start writing it now, but no new build until the owner says the app is finished.
- Server (main, not live): migration 20261130000000_subscriptions.sql (subscriptions, trial counts, access_of, my_access, ai_gate). Tested on a local Postgres: trial 3 photos then trial_photos, 4 messages then trial_chat, other AI allowed in the trial, after the trial paywall, subscriber unlimited up to the 80 cap, expired = paywall, 5 active invites = 30 days of Adro+ after the trial, safe to run twice. revenuecat function (webhook with a secret header; reads the real state from RevenueCat; ignores repeats). ai function: the gate only when the secret PAYWALL=on.
- App on main: messages for trial_photos, trial_chat and paywall (+ Arabic), and a hook to open the subscription page.
- App on branch `payments` (pushed): react-native-purchases 10.16 (npx expo install), src/lib/purchases.ts (+ web stub), src/lib/access.ts, new subscription page (trial days left and today's use, App Store prices, subscribe, restore, change or cancel, Apple's renewal text, terms and privacy links), You shows the status, terms paragraph updated (the free week doesn't turn into a paid plan), site text updated, PAID_PLANS_LIVE true. tsc, lint, iOS and web bundles pass. Kept off main so OTAs keep reaching build 17 (fingerprint checked: unchanged).
- Steps for the owner and for launch: docs/PAYMENTS.md.

## Free codes with Apple Offer Codes (28 Oct 2026)

- Ask: type a code on the subscription page for a free subscription, and a tool to make codes with their length. Explained Apple's rule 3.1.1 (own unlock codes in the app can be rejected); the owner chose Apple Offer Codes (they work with RevenueCat as normal purchases, no conflict, no extra cost).
- Server (main, not deployed): supabase/functions/offer-codes (admins only, App Store Connect API with an ES256 token; the signing was checked locally with a test key): list offers with named codes and one-time batches and how many subscribed with each (RevenueCat's offer_code on purchase events), make a named code or a batch (free time from 3 days to 1 year, monthly or yearly after, who can use it, limit, end date, sandbox batches), download a batch, stop a code.
- App on main: Admin → Free codes (/admin-codes), also on adroapp.com in the browser for admins (+ Arabic). JS only, build 17 fingerprint unchanged.
- App on branch payments: "Have a code?" on the subscription page opens Apple's code screen (RevenueCat presentCodeRedemptionSheet), then checks the subscription. tsc, lint, iOS bundle pass.
- Owner: an App Store Connect API key (Admin role) into Supabase secrets ASC_KEY_ID, ASC_ISSUER_ID, ASC_PRIVATE_KEY. Steps in docs/PAYMENTS.md.

## Morning check-in: sleep first, watch sleep filled in by itself (28 Oct 2026)

- Ask: sleep before weight; with a watch connected, Adro writes the sleep down by itself.
- Done: the steps are now sleep, weight, how you feel. When the watch measured last night (the same night the sleep step already started from), the sleep step isn't shown: the check-in is 2 steps, the weight step says "Sleep from your watch: 7h 20m", and the night is saved from the watch (hours, plus bed and wake times when the watch has them). The steps are fixed once you move on, so a watch night arriving late can't shift them. Progress dots and "Step n of m" follow the number of steps.
- File: src/components/health/CheckinSheet.tsx (+ Arabic). JS only, works with build 17. Not sent yet.

## Measurements: right arm and left arm (28 Oct 2026)

- Ask: add right arm and left arm.
- Done: two new measurements, Right arm and Left arm (shown by default with waist and chest for someone with no measurements yet). The old single "Arm" stays only for people who already saved it (one row in the database), so its history isn't lost; it isn't offered for new entries.
- Database (owner: "طبق"): migration 20261201000000_arm_sides.sql applied; arm_r and arm_l are allowed. Tested with a test user: right 36.5 and left 35.8 saved, an unknown kind still refused. Test user deleted (0 left).
- Files: src/lib/health.tsx, src/components/progress/Body.tsx (+ Arabic). JS only, works with build 17. Not sent yet.

## Measurements: AI analysis and a See all page (28 Oct 2026)

- Ask: an AI analysis under the measurements, and "See all" to see old measurements, change them and compare.
- Done (app): Progress → Body: "See all" next to Measurements, and "Adro's analysis" under the cards (asked again only when a number changes). New page /measurements: Compare (pick From and To dates; each measurement's change, green when it goes the way the goal wants; a measurement not taken that day uses the one before it), then each measurement with a small chart and every entry (date, value, change from the one before); tap one to change or delete it. health.fixMeasure (change or delete any tape measurement of any day).
- Done (server, not deployed yet): ai task measure_insight. The server works out every number (latest, change since the first, per month, since the previous, right minus left arm, weight change) and the model only words them for the goal (cut: a smaller waist is the best sign; gain: chest/arms/thighs up with a steady waist), 2 or 3 points and one tip.
- Checked on the web app with a test user (3 dates, waist/chest/right/left arm, weight): See all, the cards, the analysis card (waiting for the server), the compare table (waist −4, chest +2, right arm +1.1, left arm +0.9), charts, entries and the edit sheet. Test user deleted (0 left). tsc and lint pass.
- Files: src/app/measurements.tsx, src/components/progress/Body.tsx, src/components/health/ReadingInsight.tsx (task prop), src/lib/health.tsx, supabase/functions/ai/index.ts (+ Arabic). App part JS only, works with build 17. Not sent yet; the ai function needs "طبّق" to deploy.

### 28 Oct 2026: Detailed PDF report with optional AI analysis
- Export report now has sections: Summary (commitment, goal, days logged), Weight and body (weight chart, first to last, lowest and highest, change per week, weigh-ins, every tape measurement incl. right and left arm), Food and protein (avg calories, lowest and highest day, calories on target, avg protein, protein and water goals), Training (workouts, time, sets, volume, PRs, cardio, a table of every workout, lifts that went up), Sleep and recovery (avg, shortest and longest night, short nights, energy, soreness, avg recovery), Week by week table, Vitamins and blood tests.
- New "AI analysis" switch: the AI reads the whole report (uses the existing `report` AI task, no server change) and adds "What went well / What to improve / Focus" at the top of the PDF. Asks for AI consent first. A finished period is saved so Reports shows it too.
- Files: `src/app/export.tsx`, `src/lib/report.ts` (loads all measurements and cardio, new `detail` stats, table styles).

### 28 Oct 2026: Recovery tab sub-tabs (Recovery, Sleep, Load, Nutrition)
- Progress, Recovery now has its own row like Streaks: **Recovery** (opens first, the old page), **Sleep**, **Load**, **Nutrition**.
- Sleep: the whole Sleep page (moved into `src/components/sleep/SleepView.tsx`; `/sleep` uses the same component).
- Load (`LoadView.tsx`): this week against your usual (×, with a bar and plain words), training load 14 days, week against week (workouts, sets, volume, minutes), muscle soreness 14 days (colored bars, counts, after-workout vs rest days), muscles ready, AI analysis.
- Nutrition (`NutritionView.tsx`): week/month, average calories, protein, water, days on target, calorie and protein charts (green when met), next-morning recovery after protein/calorie days hit vs missed (hidden until there's data), AI analysis.

### 28 Oct 2026: Streaks tab becomes Commitment (Commitment, Streak, Target weight)
- Progress main tab "Streaks" is now **Commitment**. Its row: **Commitment** (first, the commitment rate), **Streak** (days in a row and workouts in a row together), **Target weight** (new). Badges stay under Commitment and Streak.
- Target weight (`WeightGoal.tsx`): start, now (week average), target, progress bar, kg to go, pace per week (vs 4 weeks ago or your first week, needs 2 weeks) and weeks to target. "What moves your weight": Food (calories on target, average calories vs what you burn, expected kg a week, weeks on target vs off), Training (workouts, per week, weeks with all workouts vs fewer), Cardio (minutes, kcal, note that cardio calories are added to the food goal). Week by week table (last 4 weeks: weight change, on target, workouts, cardio). AI analysis.
- Links: Home's Streaks card opens Streak; Overall's Streak tile opens Streak, its Commitment tile opens Commitment; Home's commitment ring opens Commitment.
- Also put LoadView/NutritionView back to the project's single quotes (an earlier format run changed them).

### 28 Oct 2026: Gym Bro characters on Gym Bros (Friends and Groups)
- Design: AI cartoon (Higgsfield FLUX 3 + Seedream 5.0 Flash edits), 5 levels for men and 5 for women (women: sports top and shorts, ponytail). Pictures in `assets/images/bro/m1-5.png`, `w1-5.png` (420 px tall, about 20-36 KB each).
- `src/components/social/GymBro.tsx`: the picture with the adro ring drawn on the head (filled to the 30-day commitment) and `@username` on the neck. Level: under 40 = 1, 40-59 = 2, 60-74 = 3, 75-89 = 4, 90+ = 5 (`src/lib/bro.ts`). Someone who doesn't share their streak shows level 2 with an empty ring.
- `src/components/social/BroBox.tsx`: above "Gym Bros". Friends and Activity: "Your crew" (you first, then friends by commitment; tap a friend for their page, tap yourself for Commitment). Groups: your character next to a ring for each group, filled with the members' average commitment.
- Database (applied 28 Oct, "طبق"): `supabase/migrations/20261202000000_gym_bro.sql`: table `bro_levels` (own row only), `my_crew()` and `group_bros(group)`; a friend's commitment shows only if they share their streak. Tested on a local Postgres first (twice-apply, crew, group, non-member, RLS).
- The app saves your 30-day commitment to `bro_levels` when Gym Bros opens (only when it changed).

### 28 Oct 2026: Describe the dish before the meal photo
- Meal photo camera (`src/app/meal-camera.tsx`): an optional "Describe the dish" field under the camera (meals only, not labels or "pick" mode), up to 300 characters.
- It goes to `/meal-result` as `desc`, is sent as `note` with the first AI call, and fills the "How was it cooked?" field so it can be changed and asked again (`src/app/meal-result.tsx`).
- No server change: the `meal_photo` task already takes `note` and trusts it over the photo. Checked with the same photo: without a note "Grilled chicken breast with rice", with "Chicken kabsa: 1 cup of rice cooked with ghee, 1 grilled chicken thigh" it answered "Chicken kabsa" with the thigh.

### 28 Oct 2026: Restaurants as a list that opens each menu
- Search food → Restaurants: instead of a row of restaurant chips above the results, the restaurants are listed where the foods go (name, "N items on the menu"). Tapping one opens its whole menu A to Z with "All restaurants" to go back; typing filters inside that menu. Typing with no restaurant open still searches all restaurant dishes. Picking another category closes the menu.
- In a menu the restaurant name isn't repeated under each item (just the serving).
- Files: `src/app/food-search.tsx` (list, menu view, a shared `foodRows`), `src/lib/foodsDb.ts` (`restaurantMenu`).

### 28 Oct 2026: Barcode opens Apple's scanner directly
- iPhone: "Scan barcode" (log sheet) and scanning a product into a meal (`useScanProduct`) now open Apple's own full-screen scanner straight away (expo-camera `CameraView.launchScanner`, VisionKit DataScanner), with no screen of ours around it. First code read: the scanner closes and the product opens (or is added to the meal). Swipe down to cancel.
- New `src/lib/appleScan.ts`. JS only (expo-camera already has it), so it goes out with an update, no new build.
- Falls back to the old `/barcode` screen (our camera, typing the code by hand) on Android, iPhones without Apple's scanner, or without camera permission.
- Not testable on the web; test on an iPhone.

### 28 Oct 2026: Update sent (everything except payments)
- OTA 6f0fd14f (iOS update 01a1807e), runtime 6e1d9a57 = build 17, commit 03f9680: commitment fix, check-in order with watch sleep, right and left arm, measurements page and AI card, detailed PDF report with AI, Recovery sub-tabs, Commitment tab with Target weight, Gym Bro characters, meal description, restaurant menus, Apple's barcode scanner, admin Free codes page, AI trial messages.
- Not sent: payments (subscriptions migration, revenuecat and offer-codes functions, the payments branch).
- ai function deployed after the owner's OK: v103 (measure_insight; the paywall gate stays off without PAYWALL=on). Checked: measure_insight 200 with a real analysis, food_text 200 (no limits). Test user deleted.

### 28 Oct 2026: Payments connected on the server (paywall still off)
- Owner set up App Store Connect (Adro+ group, `adro_monthly` 29 SAR, `adro_yearly` 299 SAR, waiting in draft for the next version), RevenueCat (App Store app `com.adroapp.app`, entitlement `adro_plus`, default offering with Monthly and Annual, webhook), Supabase secrets `REVENUECAT_API_KEY` and `REVENUECAT_WEBHOOK_SECRET`, EAS `EXPO_PUBLIC_REVENUECAT_IOS_KEY`.
- After "طبق": applied `20261130000000_subscriptions.sql` (subscriptions, subscription_events, ai_gate, access_of, my_access), deployed `revenuecat` v1 (no JWT check) and `offer-codes` v1. Webhook answers 401 without or with a wrong secret.
- Payments branch: merged main (ar.ts conflict, both sides kept, no duplicates), typecheck and lint clean, pushed (53eb1d3). `npm prune` after switching back; fingerprint still 6e1d9a57 (build 17).
- Owner added `ASC_KEY_ID`, `ASC_ISSUER_ID`, `ASC_PRIVATE_KEY`. Checked with a temporary admin (deleted): offer-codes `list` answers 200 from Apple (0 offers yet). RevenueCat test event sent: the function answers TEST with 200 and doesn't store it, so `subscription_events` stays empty until a real purchase; owner confirmed RevenueCat shows the delivery succeeded (webhook connected).
- Still to do: merge payments into main and build on "صدر النسخة"; sandbox test; `PAYWALL=on` on launch day.

### 28 Oct 2026: Time fields: Apple's time picker, hold to repeat
- `src/components/food/TimeField.tsx` (used by check-in sleep, Log sleep, meal times, notifications, gym hours, train together): on iPhone the time in the middle is Apple's own compact time picker (SwiftUI `DatePicker` from `@expo/ui`, already in build 17); tap it for the wheel. − and + still move 15 minutes; holding them repeats (after 0.4 s, then faster). Android keeps − and + with the hold.
- JS only, fingerprint unchanged (6e1d9a57). Web keeps its own `TimeField.web.tsx`. Not testable on the web; test on an iPhone.

### 28 Oct 2026: Weight chart redesign (owner's sketch)
- New `src/components/progress/WeightChart.tsx`: axes; dates along the bottom (first, middle, last) placed by real date; on the side the target weight (green dashed line; above the line for a bulk, below for a cut) and the current weight ("Now"); a dot for every weigh-in, the latest bigger.
- Tap near a dot: it's picked (ring and a vertical line). Under the chart (`Body.tsx`): that day's date and weight, the change since the weigh-in before, "Also that day" with body fat and tape measurements logged that day, and Edit (opens the existing fix/delete sheet). "See every weigh-in" opens the full list (the card itself is no longer one big button).
- The tap is read by a clear layer over the chart, measured against the chart's place on screen (works on phone and web). Tested on the web with a cutting test user (target 82 kg): tapping Oct 20 showed 88.6 kg, +0.5 since Oct 16, body fat 21.5% and waist 92 cm. Test user deleted.

### 28 Oct 2026: Gift Adro+ (admin), no Apple and no charge
- Migration `20261203000000_gifts.sql` (applied 28 Oct after "طبق"; live check with temporary users: free → gift 30 days until Nov 27 → ended → free; non-admin 403; users and gift deleted): table `gifts` (no direct access), `access_of` now gives 'sub' with why 'gift' while a gift is on (checked after paid, before the trial), `admin_give_gift(username, days, note)` (a new gift starts when the current one ends), `admin_gifts()`, `admin_end_gift(id)` (ends now; one not started yet is removed). Admins only. When a gift ends the person falls back to the regular version by themselves.
- Tested on a local Postgres: twice-apply, free → gift 30 + 7 stacked = 37 days → end → free, unknown username, non-admin refused, table not readable.
- App: Admin → "Gift Adro+" (`src/app/admin-gifts.tsx`): username, 1 week to 1 year, note, list with End. Admin tiles now two rows of three.

### 28 Oct 2026: Watch readings in the Overall grid
- Progress → Overall: when a watch or phone sends data, the tile grid also has Steps (goal = personal step goal, green when met), Active calories, Resting HR and HRV (each against your usual, the 7 readings before the newest; green when resting HR is at most 3 above usual, HRV at least 90% of usual). Each opens its reading page. "From your watch" below stays as it was.
- File: `src/components/progress/Overall.tsx`. Tested on the web with watch data (8,800 steps, 420 kcal, 58 bpm usual 60, 55 ms usual 51). Test user deleted.

## Arm gap: one-arm exercises (28 Oct 2026)

**Asked:** keep the measurements AI analysis, and add help when one arm is clearly smaller.

**Built:**
- A gap of 1.5 cm or more between right and left arm counts.
- **No plan yet:** setup swaps two-arm arm exercises for one-arm ones, and says to start with the smaller arm.
- **Plan exists:** saving measurements with a gap asks "Update your plan so arm exercises are done one arm at a time?" Yes changes the plan; No closes it, and it asks again on the next save while the gap is there.
- **Plan already has one-arm exercises:** a note says to start with the smaller arm.
- In a workout, one-arm exercises show "Start with your left arm: it's 2.5 cm smaller."
- Swaps come from the exercise library: concentration curl, alternate hammer curl, one-arm cable curl, one-arm preacher curl, one-arm cable and dumbbell triceps extensions. Sets and reps stay the same.

## Admin emails moved to adroapp.com (28 Oct 2026)

- Ali → ali@adroapp.com, Ahmed → ahmed@adroapp.com, Hamdan → hamdan@adroapp.com (sign-in email and identity).
- Same passwords and admin rights; new emails confirmed. admin@gymi.app left as is.

## Gym Bros characters redone, Bitmoji style, with Customize (28 Oct 2026)

**Asked:** the old cartoon pictures weren't liked at all. Make it like Snapchat's Bitmoji, with a Customize button in the box to change clothes, and keep the commitment changing the body.

**Built:**
- New characters drawn in code (no pictures): big head, face, hair, clothes, sneakers.
- **Customize** button in "Your crew" (and under you in the groups box) opens "Your character":
  - Man / Woman
  - Skin tone (8)
  - Hair: 7 styles for men, 6 for women, 9 colors
  - Face: eyebrows, eye color, beard (stubble, short, full, goatee, mustache), glasses (round, square, sunglasses)
  - Headwear: cap, beanie, headband, shemagh with agal (men), hijab (women), with colors
  - Top: T-shirt, tank top, hoodie, long sleeve, compression, no shirt (men) or sports bra (women), 14 colors
  - Bottom: shorts, long shorts, joggers, leggings
  - Sneaker color
- **The build follows the 30-day commitment (levels 1–5):** shoulders, arms, legs and abs grow; level 1 has a small belly. The editor can preview each level.
- The look is saved and friends and group members see it. The commitment only shows if the person shares their streak, as before.
- Database: `bro_levels.look` (JSON, size-limited); `my_crew` and `group_bros` return it (migration 20261204000000_bro_looks.sql).

## Gym Bros characters from the owner's reference, made in Higgsfield (28 Oct 2026)

**Asked:** the drawn characters weren't liked. Use the owner's flexing cartoon as the reference and make it in Higgsfield: a T-shirt only, few options, the adro logo as the face, stages that grow with commitment, and friends lined up side by side like the crew picture.

**Built:**
- 10 pictures made with FLUX 3 from the reference: men and women, levels 1 to 5 (skinny with a little belly up to huge). Black T-shirt, shorts and sneakers, double-biceps pose, no head. Backgrounds cut out; all share one frame.
- The adro logo sits where the head is (measured per picture in `broGeo.ts`), with the username under it. The logo is always the same (owner: only the body grows with commitment).
- **Customize** now only picks your ring color (9 colors). The level preview stays.
- "Your crew" lines everyone up: you in front in the middle, friends beside you by commitment (smaller and a step back), more friends in a row behind.
- The Bitmoji-style drawn version was removed. The `look` column stays (it now holds `{color}`).

## Gym Bros: 7 levels, tighter flex, same height, glowing logo head (29 Oct 2026)

**Asked:** fists closer to the biceps in all of them; all the same height; a character between levels 1–2 and 2–3 (men and women); men's growth in small steps, not over the top; the head lights up our logo and never changes between levels.

**Built:**
- All pictures edited with Seedream 5.0 Flash: forearms folded in, fists by the biceps (like the reference).
- 7 levels each for men and women, with new in-between characters. Men: tried smaller steps first; the owner then asked for bigger differences, so men go from skinny to the big reference build. Legs of levels 6–7 then made a little bigger in small, noticeable steps (a first try with huge legs was too much).
- Every picture scaled to the same height (neck to feet) and standing on one line, so the logo sits in exactly the same place and size at every level.
- The head is the app logo (white ring open at the top left, on the person's colour) with a glow around it. It doesn't change with level.
- Levels from the 30-day commitment: under 30, 30–41, 42–54, 55–67, 68–79, 80–89, 90+ (Starter, Warming up, Getting there, Solid, Strong, Very strong, Beast). Someone who doesn't share it shows level 3.

## Small fixes: week from Sunday, Commitment tabs (29 Oct 2026)

- **Nutrition charts:** the Week view runs Sunday to Saturday (this week), with today highlighted. Month stays the last 30 days.
- **Commitment tab:** the sub-tab "Target weight" is now "Goal". Tapping Commitment in the top bar always opens on its first part (Commitment), unless a link asks for another.
- **Recovery history:** now the same chart as weight: a dot for every day on the line, the 60% ready line and today's score on the side. Tap a day to see its score, and "What's in your score" switches to that day (tap Today to go back).
- **Segmented bars:** a long word ("Commitment") shrinks a little to fit its part instead of being cut off.

## Every chart: tap, slide, go back; weight photos then and now (29 Oct 2026)

- **All bar and line charts** (shared `Charts.tsx`): tap a bar or point to see it in a bubble, slide your finger to move between them, tap again to hide. Line charts show a dot on every point (up to 40) and their highest and lowest values on the left.
- Bubbles show the date and value on the main charts: calories, protein, sleep, training load, readings.
- **Nutrition and Sleep:** arrows above the charts go back to earlier weeks or months and forward again. Weeks run Sunday to Saturday.
- **Weight and Recovery chart:** slide across the dots too. Date labels no longer overlap.
- **Weight:** tapping a weigh-in shows your progress photo from that day (or the closest one) next to your latest photo, with the weight then, your latest weight and the difference.

## Progress photos redone (29 Oct 2026)

- The date chips are gone. All photos sit in a strip of small thumbnails you scroll sideways, each with a short date; the two being compared have a blue border.
- Tap a photo to see it full screen (date at the top, arrows to go to earlier or later photos).
- "Delete a photo" is gone. Each photo has a trash icon in its top-right corner (and in the full view), and it asks before deleting.

## Trial limits reset at the phone's midnight (29 Oct 2026)

**Owner's decision:** the free trial's daily limits (3 food photos, 4 coach messages) start again at midnight on the phone's clock, not UTC.

**Built:**
- `profiles.tz`: the app sends the phone's time zone after sign-in, only when it changed (`set_my_tz`). It must be a real zone and can change at most once every 20 hours, so switching zones can't reset the limits. Users can't write the column directly.
- `local_day(user)`: today in that time zone (UTC when unknown). `my_access` and `ai_gate` count the trial's use on it.
- Migration `20261205000000_trial_local_day.sql` (applied 29 Oct). Tested locally: run twice; 4 chats allowed and the 5th blocked, counted on the local day; second change and fake zones ignored.

## Week start follows the phone's country (29 Oct 2026)

- Charts (nutrition, sleep) and the food day bar start the week on the day the phone's country uses (from the phone's region settings), in Arabic and English. Sunday when the phone doesn't say. Before: always Sunday in Arabic.
- Training plan weeks are unchanged (Sunday to Saturday), since saved plans count weeks that way.

## Group workout looks like the solo workout (31 Oct 2026)

- The live group workout screen now uses the solo workout's design: "x of y sets" with a timer and a progress bar, numbered exercise chips (white when picked, green check when your sets are done), the name with an info icon (opens how-to), a swap icon (host), kg/lb per exercise, "reps N", Add set / Remove set, "Next: …" and page dots.
- Kept from before: "Live with N friends", friends' progress under your sets, the "Your turn / Done set" bar.
- The workout timer moved to `components/train/Elapsed.tsx` (used by both screens).

## 31 Oct 2026: share-on-photo on the phone, see or edit group sets

- Asked: a share button after the group workout with the same photo-story templates as solo workouts; see and edit the group workout's sets later, linked to Train.
- Done: `StoryOverlay` (the four story templates for phones: Numbers, Rings, Record, Minimal), `storyShot` (captures it as a 1080 × 1920 picture with react-native-view-shot), and share-photo now works on phones too. The summary has "See or edit sets", which opens the workout log (also in Train → Workout history), where it can be edited.
- Note: photo sharing on phones needs the new native module, so it comes with build 18. On build 17 the button stays hidden.

## 31 Oct 2026: Train together, step by step

- Asked: pick who to invite first, then choose AI or build it yourself; see and change the workout (add, remove, change the day type such as Legs instead of Push) before sending; the friend sees the workout before accepting; cardio together; a friendly competitive tip in the group workout; join a workout a friend already started; an "I'm here, starting without you" reminder with a notification; no 5-second loading when coming back to a running group workout.
- Done (app): together.tsx has steps: people (Next) → how (AI / I'll build it / Cardio together) → the workout, with Push, Pull, Legs, Upper, Lower and Full body chips, remove on each exercise, Add exercise and Add cardio (sport + minutes). New screen groupplan.tsx: the whole workout and everyone's sets, with Accept, Start or Join now, and Not this time. GroupWorkoutsCard shows workouts a friend started that you haven't joined, and has a "See workout" button. groupactive.tsx: cardio items (everyone at the same time, minutes), a tip comparing your top weight with friends', "I'm here. Start without them" (host), "Tell them I'm here", and a "Remind" button by friends who haven't joined. The last copy is kept in memory and on the phone, so the screen opens straight away.
- Server: migration 20261206000000_group_ping.sql was applied on 31 Oct after "طبق": table group_pings and group_ping(id), at most one every 2 minutes. After the second "طبق" the push function was deployed as v13 (type group_ping; it still returns 401 without the secret) and the ai function as v107 (together follows the chosen "focus").

## 31 Oct 2026: group workout, do the same as your friend?

- Asked: during a group workout, when someone adds or removes a set or changes an exercise, the others get asked whether to do the same.
- Done: groupactive.tsx compares friends' sets every 3 seconds (groupChanges in lib/groupWorkout.ts). When a friend adds or removes a set, or swaps an exercise, a sheet asks "Ali added a set. On Chest press. Add one to yours too?" with "Yes, same for me" and "No, keep mine". Swapping is now for each person, and everyone can do it: the swap button gives the usual alternatives, "Other exercise" (the full search) and "Back to …". Your swap is saved in your own sets (MySets.alt), so your workout log, weights and records use the exercise you actually did. A friend's row shows their exercise when it differs. The competitive tip only compares friends on the same exercise. App only, no database change.

## 31 Oct 2026: group workout counts in Train, and a note the next day

- Asked: after finishing a group workout, Train shows it and counts it as your workout. The next day, if your workout works the same muscles, a note says to make sure you've recovered: "you trained this yesterday with Hamdan".
- Done: useToday (WorkoutCard.tsx) counts a Together log saved today as today's workout. The done card shows "Legs, together with Ali and Hamdan" (title and people come from togetherOf(logId) in lib/groupWorkout.ts, through the log's group_session; loaded once per log). New: useYesterdayOverlap. When today's planned workout works a big muscle group (chest, back, shoulders, legs, arms) that a workout yesterday also worked, the card shows "Make sure you've recovered. Yesterday you trained legs with Ali and Hamdan, and today's workout works them again. Still sore? Go lighter or swap the day." Without a group workout it leaves out the names. App only. Checked in Arabic on the web build with sample data.

## 31 Oct 2026: racket sports without sets or score

- Asked: in cardio, padel and the other racket sports should stop recording sets and points.
- Done: Padel, Tennis, Squash and Badminton no longer have a set counter (sports.ts). The live session shows no "Set done" card, rest timer or score. It keeps time, heart rate and the coach's tips. Later the same day (owner: "remove them too") volleyball's sets and boxing and martial arts rounds were removed as well, so no sport counts sets or rounds now. App only.

## 31 Oct 2026: vitamin reminders like Apple's Reminders

- Asked: make the vitamin reminder like Apple's Reminders (pick the day of the week, the date and so on); it felt messy.
- Done: the vitamin sheet's "How often" chips are gone. One card, like Apple's, has:
  - Starts or Date, with a month calendar.
  - Repeat: Never, Daily, Weekdays, Weekends (they follow the region, so Friday and Saturday in the Gulf), Weekly on the days you pick (more than one), Monthly (on the date's day), Yearly, and Every few days (2–60).
  - Reminder, with its time.
- The list shows "Every Sun, Wed", "Monthly on day 5" and so on, with Change and the time.
- New lib/vitSchedule.ts (scheduleOf, scheduleText, triggersOf, freqOf).
- Phone notifications: weekly ones on each picked weekday, yearly ones as YEARLY triggers, and one-time or "every few days" ones as DATE triggers for the next dates. These are scheduled again whenever the app opens.
- freq is still saved (Daily, Weekly or Monthly) for older versions. Old vitamins without a schedule get one from freq and the day picked before.
- Database: migration 20261207000000_supplement_schedule.sql adds supplements.schedule (jsonb). Applied on 31 Oct after "طبق" (the column is there, and running it twice is fine).

---


> **Rule (24 Oct 2026):** don't ship a new TestFlight build after every fix. Collect fixes together while the owner reports issues, then make one build when the owner says so. Server fixes (AI, database, functions) can still go live right away.

## Still waiting on you

- **Push notifications and invite links on phones:** run EAS init (needs `EXPO_TOKEN`) and set up Apple/Google push keys in EAS; put your Apple Team ID in `public/.well-known/apple-app-site-association` and the Android SHA256 in `public/.well-known/assetlinks.json`; then a new build.

- **Login and email-change codes:** built, but off until you add SMTP in Supabase under **Authentication → Emails → SMTP settings**.
- **Phone-only features** (Apple Health, Health Connect, voice, PDF, sounds): need a phone build with EAS. That needs an `EXPO_TOKEN` secret added to this Claude Code environment.
- **Polar keys:** register an app at admin.polaraccesslink.com with the same redirect URL, then add `POLAR_CLIENT_ID` and `POLAR_CLIENT_SECRET` in Supabase → Edge Functions → Secrets.
- **WHOOP and Oura keys:** register an app at developer.whoop.com and cloud.ouraring.com (redirect `https://utvhvzwkwhocdbiutavg.supabase.co/functions/v1/wearables`), then add `WHOOP_CLIENT_ID`, `WHOOP_CLIENT_SECRET`, `OURA_CLIENT_ID`, `OURA_CLIENT_SECRET` in Supabase → Edge Functions → Secrets.
- **OpenRouter balance:** about $3.9 left. Top up before it runs out.

## Optional ideas offered
- Update `docs/STORE-RELEASE.md`.
- More ad versions: wide 16:9, 15 seconds, or Arabic.
