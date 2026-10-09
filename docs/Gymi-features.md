# Gymi: Features

A smart AI fitness coach. Food, training, and health in one place. It starts as a website, then becomes an iPhone and Android app.

**Goal:** the only app a person needs to track their health and gym progress. For people without a coach, the AI is the coach. For people with a coach, Gymi helps the coach and the client work together.

> This file matches the final design (October 2026). The interactive design is the source of truth for every screen.

---

## 0. Decisions made

| Topic | Decision |
|---|---|
| First version | Design every feature in this file. Build in stages: the basics first, then the rest. |
| Languages | English and Arabic, both fully designed. Arabic switches the layout to right-to-left. |
| Target users | Everyone: beginners to advanced. Ready-made for beginners, fully editable for pros. |
| Account types | Member (training) and Coach. Coaches apply and the Gymi team approves them. |
| Navigation | Floating glass tab bar with 5 tabs: Home, Food, Train, Progress, Gym Bros. Plus a floating AI coach button. |
| Pricing | Free at the start, then subscription plans (Free and Pro). |
| Branding | Done. See "Gymi design". |

---

## 1. Sign up and account

- Welcome screen with "Get started" and "Log in".
- Choose the account type: **"I'm training"** (member) or **"Apply as a coach"**. The other type can be added later.
- Sign up form: email, phone number, name, gender, age, height.
- Verify the email or phone with a code.
- Choose the language: English or Arabic.
- Then go straight to Home. Other questions are asked only when needed (inside Food and Train).
- Log in, change email (with a code), and change password.

---

## 2. Home

### Morning check-in
- Fast, card by card, under 30 seconds, shown as a glass sheet over Home.
- Weight (note: "Weigh yourself after using the bathroom, before eating or drinking").
- Hours slept and sleep quality (3 options).
- Energy level and muscle soreness. If tired, the AI makes today's workout lighter.
- For women who turn on cycle tracking: one optional tap for cycle symptoms.

### Home dashboard
- Greeting and date.
- Big calorie ring (calories left), with eaten, goal, and burned.
- Protein, carbs, and fat bars.
- Water card with a quick "+" button.
- Today's workout card with "Start workout" and "Can't train today?".
- "Your readings" card (from Apple Health or WHOOP when connected).
- Streak and commitment card.
- Coach tip (one short AI tip, e.g. "You still need 18 g of protein. A cup of Greek yogurt covers most of it.").
- For members with a coach: a coach card at the top (coach name, gym, hours, message button, and the program and meal plan from the coach).

### Other
- Customize home: reorder cards by dragging.
- "You" profile hub.
- Empty states for a brand-new user.

---

## 3. Food

### Calorie setup (first time opening Food)
- Weight and daily activity level.
- Goal: fast bulk, moderate bulk, maintain, fast cut, or moderate cut.
- Body fat picker: body illustrations at different body fat levels.
- Work day: start and end time, schedule type (one shift, split shift, or shifts that change every week), and whether they work in the sun.
- Optional notes box, with the line: "The more details you add about your day and work, the more accurately the AI can help you."
- AI loading state.

### Results (editable)
- Daily calories, protein (g per kg), water, suggested meal times, and suggested workout time and intensity.
- Calories: raise or lower.
- Protein: slider from 1.6 to 2.2 g per kg; grams update live.
- Meal times: change or add.
- Number of meals: minimum two.
- A soft warning if a number is set too low for health (does not block).
- Beginner / Advanced: beginners get everything ready-made; advanced users can edit every number.

### Meal plan
- Today's meals with calories and macros for each.
- Tap a meal: "Swap meal" or "Make from my ingredients" (type what you have, get a recipe with the same calories).
- Recipe detail screen.
- Bulking and cutting recipes.
- Shopping list made from the meal plan, with checkboxes.

### Log food
- Type what you ate (the AI works out calories and macros).
- Food search with Saudi and Gulf dishes (kabsa, mandi, shawarma…) and restaurant meals.
- Barcode scanner and product result.
- Meal photo: the AI recognizes the food and its ingredients.
- Nutrition label photo plus grams eaten.
- Create and name a custom meal; it's saved for later.

### Alerts and balancing
- Over the limit: "You ate 350 kcal over today. Take it from another day this week?" with a day picker.
- Under the limit: move the calories to another day, or have a free meal (only if protein is complete and it fits the calories).
- High added sugar or high fat warning.
- If weight doesn't change for two weeks, the AI suggests adjusting calories.

### Ramadan mode
- Meals rearranged around iftar and suhoor.

---

## 4. Water

- Daily water goal with a ring.
- Add a drink: enter the amount (e.g. 300 ml), then choose the drink (water, coffee, juice).
- Reminder notifications, with their own settings.
- Ramadan mode: water spread between iftar and suhoor.

---

## 5. Train

### Plan setup (first time opening Train)
- First question: how many days a week.
- Injuries or pain.
- Only the splits that fit the chosen days. Examples:
  - 2 days: upper/lower, or full body/full body.
  - 3 days: push/pull/legs, upper/lower/full body, or full body × 3.
- Or "Let the AI build it".

### Train home and weekly plan
- The week at a glance (each day's workout or rest).
- Weekly plan editor: drag a workout to any day; lock a day to keep it fixed.
- Fixed plan (same every week) or flexible plan (next workout in order, with at least one rest day between).
- Training each muscle twice a week is preferred, not required. With fewer days, a note explains it.

### Recovery
- A recovery score (e.g. "80: Ready to train hard") with tips to recover faster.
- Uses sleep, check-in answers, training load, and wearable data when connected.

### Missed and skipped workouts
- **"Can't train today?"**: pick a reason (tired, busy, sore, sick or hurt, traveling), then choose:
  - Move to tomorrow (the rest of the week shifts one workout later).
  - Short version (about 25 minutes, main lifts only).
  - Home workout (no equipment).
  - Just skip it (the plan stays the same).
- **Missed workout suggestion:** "You missed Legs on Sunday. Do it today and move the rest of the week one workout later?" with Skip or Move.

### Workout
- Workout detail: warm-up, exercises (sets, reps, machine name), and stretching. Change the machine to what the gym has.
- Active workout: enter weight and reps for each set. Last session's numbers show in grey.
- Green or red arrows show progress against last time.
- Rest timer between sets.
- Voice logging (e.g. "Bench 80 kilos, 10 reps").
- AI tip to add weight when all reps were easy.
- Workout summary: time, volume, and PRs.
- Share a workout with friends, a group, or the community.
- Workout sounds settings.

### More
- Cardio and steps logging (walk, run, bike; calories burned are added to the day).
- Exercise library: filter by equipment (free weight, dumbbell, barbell) and by muscle. Exercise detail with a video.
- Unknown machine: take a photo, the AI recognizes it and adds it to the plan.
- Home or travel mode: no equipment, bodyweight only.
- Deload week: suggested when performance drops (e.g. "Your squat and bench dropped two sessions in a row").

---

## 6. Progress

Tabs: **Overall, Body, Recovery, Streaks**.

- **Overall:** "Your month at a glance" with a short AI summary, weight, waist, sleep, recovery, streak, commitment, calories and water today, and strength (training volume over 8 weeks, best lifts).
- **Body:** weight (weekly average with an up or down arrow, chart), body measurements (waist, chest, arm), and progress photos side by side.
- **Recovery:** recovery score over time and sleep (bedtime, wake time, quality, weekly chart).
- **Streaks:** workout streak, best streak, commitment rate (last 30 days), and achievements.
- **Reports:** weekly AI report (what went well, what to improve), reports for custom dates, and PDF export for a doctor or coach.

---

## 7. Health

- Vitamins and supplements: add with a dose (e.g. vitamin D 50,000). Optional reminder with a time picker.
- Blood test: upload a file, the AI reads the values and shows them in a list.
- If a value looks abnormal: "This value is outside the normal range. Please check with your doctor." The app never suggests treatment or doses.

---

## 8. AI coach

- Floating AI button on every main screen opens the chat.
- Logs things straight from the chat: "I ate chicken and rice" goes to Food; "I slept 7 hours" goes to Sleep. A confirmation shows with Undo.
- Answers questions and gives insights, sometimes with a small chart.
- Voice input.
- Chat history.

---

## 9. Motivation

- Streaks (e.g. 12 days in a row), best streak.
- Commitment rate.
- Achievements (ring-shaped badges, unlocked and locked).

---

## 10. Gym Bros (friends and community)

The 5th tab. Tabs inside: **Friends, Groups, Activity**.

- **Friends:** add by username, friend list with their last workout, friend profile (only what they chose to share), invite friends.
- **Privacy:** each person chooses what friends can see.
- **Challenges:** create a challenge (exercise, weight, steps, or progress; duration; friends) with a leaderboard.
- **PR notifications:** e.g. "Ahmed hit a new PR: Bench 100 kg."
- **Train together:** the app builds one workout with the right weights and reps for each person.
- **Group workout (live):** each person taps Start on their own phone; the workout begins when everyone is in.
- **Groups:** e.g. "Morning crew". Group goal (e.g. 7 of 9 workouts this week), training volume ranking, and a group feed.
- **Community:** share to groups, your gym, your area, or the whole country.

---

## 11. Coaches

### Becoming a coach
- Choose "Apply as a coach" when signing up.
- Send an application. The Gymi team reviews it, usually within 2 days.
- Gymi team screen to review and approve coaches.
- Coach profile: photo, bio, gym, specialties (e.g. fat loss, strength), Instagram, and hours at the gym.
- Future idea: a "Licensed coach" badge for coaches who upload a valid license.

### Coach app
The coach has their own tabs: **Clients, Programs, Messages, Me**.

- **Clients:** active clients, average commitment, and how many need attention. Clients ranked by commitment over the last 30 days (workouts, calories, protein, water, and sleep), with up and down changes. A "Need attention" tab and an "Invited" tab.
- **AI alerts:** e.g. "Reem and Majed are under 60% this month. A quick message helps."
- **Client detail:** the client's progress, training, and food.
- **Add a client:** create an invite code; the client joins with the code.
- **Programs:** workout programs and meal plans that can be given to several clients.
- **Messages:** chat with clients.
- **Notifications** for the coach.
- **Listing and packages:** set the maximum number of clients (spots), show or hide in "Find a coach", and show again when a spot opens.
- A coach can also switch to their own training and use Gymi as a member.

### Member side
- **Find a coach:** browse listed coaches.
- **Coach page:** profile, packages, and how to join.
- **Member with a coach:** the coach card on Home, and the program and meal plan come from the coach.

---

## 12. Devices and readings

- Connect Apple Health or WHOOP (and later Polar and the Gymi Band).
- Readings: calories burned, average heart rate, steps, VO2 max, stress, strain and recovery, day strain, sleep efficiency, weight, and time in bed.
- Before connecting: grey cards with "Connect Apple Health or WHOOP".
- After connecting: drag cards into any order, open a reading for its chart, and show readings on Home.
- The AI uses the readings (e.g. low recovery makes today's workout lighter).

---

## 13. Women's health (cycle tracking)

Shown only to women who turn it on. More than a period calendar: the cycle becomes part of the coaching.

### In the design
- Modes, starting with "Track my cycle".
- Tabs: Today, Calendar, Insights, Learn.
- Today: cycle day and phase on a ring (e.g. "Day 19, Luteal phase"), next period prediction, "Period started today" and "Log today".
- "Your plan this phase": training, food, and water advice for the current phase.

### Full feature list
- **Cycle tracking:** start and end dates, predictions for the next period, cycle and bleeding length, history, patterns over time. At setup, add the last 3 cycles (or up to 12 months).
- **Symptoms:** cramps, headache, bloating, breast pain, mood, energy, sleep, appetite, skin, discharge, and more. Patterns linked to the cycle.
- **How it changes coaching (our edge):**
  - Training intensity follows the phase and symptoms.
  - Explains normal water weight changes so she doesn't panic or cut calories by mistake.
  - Calories and food suggestions adjust before the period if appetite rises.
  - Water and sleep targets adapt.
- **Fertility mode:** fertile window and ovulation predictions, tips. Clear note: not for birth control.
- **Pregnancy mode:** week by week, appointments, tips, checklists. Training switches to pregnancy-safe exercises after the doctor's OK.
- **After birth:** support and a gradual return to training after the doctor's OK.
- **Perimenopause:** symptoms, strength and bone focus, sleep support.
- **AI assistant:** answers questions from her own data. Never diagnoses; advises seeing a doctor when needed.
- **Health content** reviewed by doctors.
- **Doctor report** (PDF).
- **Community** (later): private, moderated groups.
- **Partner sharing:** optional; she chooses exactly what is shared.
- **Reminders:** optional; she chooses which ones and when.
- **Privacy:** anonymous mode, never shared with friends or coaches unless she turns it on, Face ID lock, delete all cycle data with one tap.
- **Free:** tracking, predictions, symptoms. **Pro:** cycle-based training and food, deeper insights, pregnancy and after-birth programs, reports.

---

## 14. Settings and privacy

- Profile, change email (with a code), change password.
- Theme: light, dark, or system.
- Language: English or Arabic.
- Notifications and water reminder settings.
- Workout sounds.
- Ramadan mode, Beginner / Advanced mode, Reduce Transparency.
- Privacy and data: download all my data.
- Delete account, with a clear confirm step.
- Subscription: Free and Pro.
- Offline banner: "You're offline. Your workout is saved and will sync later."

---

## 15. Still to decide

- What's in Free and what's in Pro, and the prices.
- Coach plans and how coaches get paid.
- Which features are built first, and which come later.
