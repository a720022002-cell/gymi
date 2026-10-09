# Gymi design

The final app design: brand, style, navigation, and every screen.

- **Interactive design (open on phone):** https://claude.ai/artifact/CNzP12h7Q6sVe69tVomBKm
- **Design file:** `index.html` (one self-contained file, the source of truth for every screen)
- **Brand guide:** https://claude.ai/artifact/UrABNb9xUd5RaZZG6evfip

> Final design, October 2026. About 116 screens, in light and dark, English and Arabic.

---

## 1. Brand

- **Logo:** a thick ring about 80% closed with rounded ends, like a progress ring close to its goal. Next to it, "gymi" in lowercase. The ring alone is the app icon and the AI coach avatar.
- **Tagline:** "Your AI gym coach."
- **Feeling:** clean, simple, modern, calm but motivating.

### Colors: light theme
| Name | Hex | Use |
|---|---|---|
| Cobalt | `#3355FF` | Brand, progress rings, active states, AI |
| Ink | `#0A0A0B` | Main text and main button |
| White | `#FFFFFF` | Background |
| Mist | `#F4F4F5` | Cards and sections |
| Gray | `#52525B` | Secondary text |
| Up | `#15803D` | Progress going up |
| Down | `#DC2626` | Progress going down |

### Colors: dark theme
| Name | Hex | Use |
|---|---|---|
| Background | `#0A0A0B` | App background |
| Surface | `#18181B` | Cards and sections |
| Line | `#27272A` | Borders and empty bars |
| Text | `#FAFAFA` | Main text; main button is white with dark text |
| Secondary | `#A1A1AA` | Secondary text |
| Cobalt | `#3355FF` | Brand, rings, AI button |
| Cobalt Light | `#7088FF` | Links and active tab |
| Up | `#22C55E` | Progress going up |
| Down | `#F87171` | Progress going down |

### Fonts
- **Sora (SemiBold):** headings and big numbers, tight letter spacing.
- **Manrope:** body text, labels, and buttons.
- **IBM Plex Sans Arabic:** all Arabic text.
- Numbers line up (tabular figures).

### App icon
- White ring on Cobalt. Files: `gymi-icon-1024.png` (iPhone, App Store), `gymi-adaptive-foreground-1024.png` (Android, background `#3355FF`), `gymi-play-store-512.png` (Google Play).

---

## 2. Style: Apple Liquid Glass

- **Glass is for controls that float on top:** tab bar, AI button, top bars, bottom sheets, segmented controls, toolbars, alerts, menus, the rest timer, and toasts.
- **Content stays solid:** rings, cards, meals, workouts, and charts sit on solid Mist or Surface, so numbers stay sharp.
- Glass look: translucent blur, thin light edge, soft shadow, pill shapes. AI-related glass has a slight Cobalt tint. Darker, smoky glass in dark mode.
- Never glass on glass. Text on glass must pass contrast checks.
- **Reduce Transparency** setting turns all glass solid.
- Other rules: big numbers as the hero, rings and thin bars as the main visuals, rounded cards (20 to 24 px), capsule buttons (52 px), line icons in the SF Symbols style, no emoji, springy motion, touch targets at least 44 px.

---

## 3. Navigation

- **Member app:** floating glass tab bar with 5 tabs: **Home, Food, Train, Progress, Gym Bros**, plus a floating AI coach button.
- **Coach app:** tabs **Clients, Programs, Messages, Me**. A coach can switch to their own training.
- **Arabic:** the whole layout mirrors right-to-left, including the tab bar.

---

## 4. Preview controls (in the design file)

- Screen map: open any screen with one tap.
- Theme (light, dark, system), Reduce Transparency, Ramadan mode, Advanced mode, and Offline switches.
- Every screen reads from one shared state: logging food updates the ring, the coach chat logs data, sets update progress, and so on.

---

## 5. Screen map

**A. Sign up**

- Welcome
- Sign up form
- Verify code
- Sign up, step 3
- Language
- Log in

**B. Home**

- Morning check-in
- Home dashboard
- Customize home
- You (profile hub)
- New user (empty states)
- Restore sample data

**C. Food**

- Food, first time (setup)
- Calorie setup
- Body fat picker
- Work day step
- Results (editable)
- Food and meal plan
- Meal menu (swap, ingredients)
- Recipe detail
- Make from my ingredients
- Shopping list
- Log food sheet
- Type what you ate
- Barcode scanner
- Product result
- Meal photo (camera)
- Meal photo (ingredients)
- Nutrition label photo
- Label result
- Create custom meal
- Food search
- Over-limit alert
- Under-limit alert
- High sugar warning
- Ramadan mode

**D. Water**

- Water tracker
- Add a drink
- Reminder notification
- Ramadan water

**E. Train**

- Train, first time (setup)
- Plan setup
- Injuries
- Split options
- Train home
- Weekly plan editor
- Workout detail
- Active workout
- Rest timer
- Workout summary
- Cardio and steps
- Exercise library
- Exercise detail
- Unknown machine
- Recovery
- Home mode and deload

**F. Progress**

- Overall
- Weight and body
- Sleep
- Reports
- Reports, custom dates
- Export PDF

**G. Health**

- Vitamins
- Add vitamin + reminder
- Blood test upload
- Blood test results

**H. AI coach**

- AI chat
- Chat history

**I. Motivation**

- Streaks and achievements
- Workout streak
- Commitment rate

**J. Friends**

- Friends list
- Friend profile
- Create a challenge
- Challenge leaderboard
- PR notification
- Train together
- Group workout (live)
- Groups
- Share a workout
- Friends privacy
- Add friend by username

**N. Coach**

- Account type
- Coach application (pending)
- Gymi team: review coaches
- Coach: clients ranking
- Coach: client detail
- Coach: client food
- Coach: add client + code
- Coach: programs
- Coach: messages
- Coach: notifications
- Missed workout suggestion
- Can’t train today
- Invite friends
- Coach: listing and packages
- Member: find a coach
- Member: coach page
- Member with a coach

**K. Devices**

- Readings (not connected)
- Readings (connected)
- Reading detail
- Readings on Home
- Cycle tracking (women only)

**L. Settings**

- Profile
- Change email with code
- Change password
- Settings
- Notifications
- Water reminder settings
- Workout sounds
- Privacy and data
- Delete account
- Subscription
- Offline banner

**Design system**

- Components

---

## 6. Small fixes before building

- Arabic tab bar: the "الرئيسية" (Home) label is a little cramped. Use a slightly smaller font or a shorter word.
- The "Coach view" message sometimes stays on screen after switching screens.
