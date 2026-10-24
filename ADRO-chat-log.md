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
