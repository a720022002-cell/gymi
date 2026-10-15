# Gymi: chat log

A record of this Claude Code session: what you asked for and what was built.
Passwords and keys are left out on purpose.

---

## About the project

- **App:** Gymi, an AI fitness coach. It is built with Expo (SDK 57) and runs on the web.
- **Live site:** https://gymi-inky.vercel.app. It updates automatically from the `main` branch.
- **Backend:** Supabase (database, sign-in, file storage, server functions).
- **AI:** Qwen through OpenRouter (`qwen/qwen3-vl-235b-a22b-instruct`).
- **Design sources:** `docs/index.html` (prototype), `docs/Gymi-features.md`, `GYMI-development.md`, `Gymi-design.md`.
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
- An admin account (`gymi.admin`) and an Admin page.

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
- `docs/marketing/gymi-ad-vertical.mp4` (35 seconds, vertical 1080×1920).

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

---

## Still waiting on you

- **Login and email-change codes:** built, but off until you add SMTP in Supabase under **Authentication → Emails → SMTP settings**.
- **Phone-only features** (Apple Health, Health Connect, voice, PDF, sounds): need a phone build with EAS. That needs an `EXPO_TOKEN` secret added to this Claude Code environment.
- **OpenRouter balance:** about $3.9 left. Top up before it runs out.

## Optional ideas offered
- Update `docs/STORE-RELEASE.md`.
- More ad versions: wide 16:9, 15 seconds, or Arabic.
