# GYMI development

Gymi's technical plan: tools, AI, cloud, iPhone, app identity, branding, costs, wristband, and how we build it.

> Updated October 2026. Prices and limits may change.

Related files: **Gymi-features** (what the app does) and **Gymi-design** (brand and every screen).

---

## 1. Main decisions

| Topic | Decision |
|---|---|
| Cost | Everything free during development. Paid services at launch. |
| AI at scale | GPU servers once there are many users. |
| First version | Design every feature. Build in stages. |
| Languages | English and Arabic (right-to-left), both in the design. |
| Target users | Everyone: beginners to advanced. |
| Pricing | Free at the start, subscription plans later. |
| Account types | Member and Coach (coaches are approved by the Gymi team). |
| Wristband | Our own branded band (Gymi Band) later, from a white-label maker. |

---

## 2. How we build the app

- **React Native with Expo.**
- One codebase gives us a website, an iPhone app, and an Android app.
- We start with the website, then turn it into an app without rebuilding from scratch.

---

## 3. AI (LLM)

### Gemini Flash (main model during development)
- Free with no credit card. The free models are Gemini 3 Flash and Gemini 3.1 Flash-Lite.
- Limit: about 10 to 15 requests per minute, depending on the model.
- Daily limits change. Google no longer publishes fixed numbers; your real limits show in AI Studio.
- The stronger Pro models are paid only since 2026.
- Understands images, which we need for nutrition labels, gym machines, and blood tests.
- **Warning:** on the free plan, Google may use the data to improve its models. That's fine for testing, but health data must run on a paid plan at launch.
- Moving to paid is easy: add a billing account and the limits go up right away.

### Qwen (backup, and a cheap option after launch)
- Strong and very cheap. The cheapest Flash model starts at about $0.03 per million tokens.
- Most models are open source on Hugging Face, so we can run them on our own servers with no usage fees.
- Newer models understand images.
- **Free access is limited:**
  - New Alibaba Cloud accounts get 1 million free tokens per model for 90 days (a trial, not permanent).
  - The old free access was shut down in April 2026.
  - OpenRouter offers free Qwen versions, limited to 20 requests per minute and 50 per day (1,000 per day after buying at least 10 credits).
- **Warning:** Alibaba's China (Beijing) region is cheaper but stores data in China. For health data, use the Singapore region.

### Using more than one AI model
| Task | Model |
|---|---|
| Main chat, reading photos, meal plans | Gemini Flash (free during development) |
| Backup when Gemini hits its limit | Qwen via OpenRouter |
| Simple, frequent tasks after launch (like a meal's calories) | Qwen Flash, because it's cheap |

- The code has a **"model switch"** that picks the model for each task.
- Changing or adding a model later takes minutes, with no rebuilding.

---

## 4. Cloud

| Part | Tool | Notes |
|---|---|---|
| Database, login, and file storage | Supabase | Free: 500 MB database, 1 GB files, 50,000 monthly users. Pauses after a full week with no use. Pro plan is $25/month. |
| Website hosting | Vercel | Free plan available. The account is already connected. |
| Barcode data | Open Food Facts | Free, open database. |

---

## 5. iPhone

- **Testing on your own phone: free.** Sign in with a normal Apple ID. The build expires after 7 days, you can have 3 apps at most, and some features like notifications don't work.
- **Publishing on the App Store or TestFlight: paid.** The Apple Developer Program is $99 per year. If it isn't renewed, the app may be removed.
- **Free option during development:** users add the website to their iPhone home screen, and it opens like an app.
- We need a **Mac** when we build the iPhone version. Not needed for the website.

---

## 6. App identity (Bundle ID)

- A fixed ID for the app on the App Store and Google Play. Users don't see it.
- **Suggested:** `com.gymi.app` for both iPhone and Android.
- If the domain is different (like gymiapp.com), it becomes `com.gymiapp.app`.
- **It can never change after publishing.** Changing it makes a new app, and you lose users and reviews.
- It must not already be used by anyone else.
- **Before locking it in:** check that the name Gymi is free on the App Store, Google Play, and as a domain.

---

## 7. Branding

- Brand canvas (edit here): https://claude.ai/artifact/DXEY36gJr7AoVVyhvDHCMp
- Brand guide (easy to view on phone): https://claude.ai/artifact/UrABNb9xUd5RaZZG6evfip
- A PDF copy is saved as `Gymi-brand.pdf`.

### Idea
- **Logo:** a blue ring that's almost closed, like a progress ring close to its goal. Next to it, the word "gymi" in lowercase.
- **Tagline:** "Your AI gym coach."
- **Feeling:** clean, simple, and modern.

### Colors: light theme
| Name | Hex | Use |
|---|---|---|
| Cobalt | `#3355FF` | Brand color, rings, buttons, AI button |
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
| Text | `#FAFAFA` | Main text and main button (white button, dark text) |
| Secondary | `#A1A1AA` | Secondary text |
| Cobalt | `#3355FF` | Brand, rings, AI button |
| Cobalt Light | `#7088FF` | Links and active tab |
| Up | `#22C55E` | Progress going up |
| Down | `#F87171` | Progress going down |

### Fonts
- **Sora (SemiBold):** headings and numbers.
- **Manrope:** regular text.
- **IBM Plex Sans Arabic:** all Arabic text (already in the design).

---

## 8. App icons

Based on the blue ring logo: a white ring on Cobalt blue.

| File | Use | Specs |
|---|---|---|
| `gymi-icon-1024.png` | iPhone and App Store | 1024×1024, full square, no transparency, no rounded corners (Apple rounds them) |
| `gymi-adaptive-foreground-1024.png` | Android icon | 1024×1024, transparent background; set the background color to Cobalt `#3355FF` in Expo |
| `gymi-play-store-512.png` | Google Play listing | 512×512 |

---

## 9. Design

- The design is finished: about 116 screens, light and dark, English and Arabic, Liquid Glass style.
- Interactive design (open on phone): https://claude.ai/artifact/CNzP12h7Q6sVe69tVomBKm
- Earlier prototype on Vercel: https://founders-ei29.vercel.app/
- Full details in **Gymi-design**.

---

## 10. Full plan

### Stage 1: Development (free)
| Part | Tool |
|---|---|
| Website and app | React Native with Expo (TypeScript, Expo Router) |
| Main AI | Gemini Flash, called only from Supabase Edge Functions |
| Backup AI | Qwen via OpenRouter |
| Database, login, files | Supabase |
| Website hosting | Vercel |
| Barcode | Open Food Facts |
| iPhone | Website added to home screen + Expo Go on your phone |
| App identity | Set the Bundle ID in Expo settings |
| Icons | Add them in Expo settings |

### Stage 2: Launch (paid)
| Part | Tool |
|---|---|
| AI | Paid API at first, then GPU servers running Qwen ourselves |
| Database | Supabase Pro |
| iPhone | Apple Developer Program, $99/year |
| Android | Google Play account, $25 one time |
| App identity | Register the Bundle ID with Apple and Google Play |

### About GPU servers
- A GPU server costs money every month, even if nobody uses the app.
- **Few users:** a paid API is cheaper.
- **Many users (around 10,000 active):** GPU servers become cheaper, and health data stays with us.
- Thanks to the "model switch," moving over is easy.

---

## 11. Launch costs (estimates)

### Fixed costs
| Item | Cost |
|---|---|
| Apple Developer Program | $99/year (~370 SAR) |
| Google Play account | $25 one time (~95 SAR) |
| Domain | ~$15/year |
| Supabase Pro | from $25/month |
| Vercel Pro | ~$20/month |

About **$60 to $70 a month** (~250 SAR), plus ~$140 one time at launch.

### Supabase in detail
- Pro is $25/month per organization and includes $10 of compute credit (covers the smallest server).
- Includes 8 GB database, 250 GB data transfer, and 100,000 monthly active users.
- Extra: about $0.125 per GB of database and $0.09 per GB of transfer. Bigger servers cost more.
- Most small and medium apps pay about **$35 to $75 a month**.
- Pro has a spending cap turned on by default, so no surprise bills.
- Team plan ($599/month) adds compliance support (SOC 2, ISO 27001). Not needed at first, but may be needed later for health and cycle data.

### AI costs
- Gemini 3 Flash (paid): about $0.50 per million input tokens and $3 per million output tokens. Flash-Lite: about $0.25 and $1.50.
- Estimate: about **$0.40 to $1.30 per active user per month**, depending on how much we use cheaper models.

### Monthly total by active users
| Active users | Per month (estimate) |
|---|---|
| 100 | $100 to $200 (~375 to 750 SAR) |
| 1,000 | $500 to $1,400 (~1,900 to 5,250 SAR) |
| 10,000 | $4,000 to $13,000 (~15,000 to 49,000 SAR), time to consider GPU servers |

### Costs not in the table
- Development (if hiring), content (exercise videos, Saudi food data), legal (company, privacy policy, data protection), marketing.
- Apple and Google take a cut of subscriptions (usually 15% for small developers).

### Ways to keep costs down
- Limit AI messages on the Free plan; full AI in Pro.
- Use Flash-Lite or Qwen for simple tasks; the stronger model only for photos and plans.
- Save repeated results (e.g. the calories of "chicken kabsa") instead of asking the AI every time.

---

## 12. Wearables and the Gymi Band

### Now: connect existing devices (free)
- Apple Health, WHOOP, and Polar (Polar has a free official SDK for iPhone and Android, with heart rate and HRV data).

### Later: our own Gymi Band
A screenless band with our name on it, made by a white-label factory, with an SDK so only the Gymi app reads it.

| Option | Price per band | Minimum order | Notes |
|---|---|---|---|
| Basic band (e.g. NSQ06) | ~$10 | Flexible | Cheapest; no HRV listed, so weak for recovery |
| Band with HRV | ~$15 | 1,000 | Best value; HRV and stress |
| JCVital V8 (J-Style) | ~$60 to $100 (estimate) | Often 500 | Closest to WHOOP; recovery score can be customized |

- **Recommended:** the ~$15 band with HRV, after testing samples.
- **Questions for every factory:** iPhone and Android SDK? Raw heart data (beat-to-beat)? Does any data go to their servers? Can the Bluetooth name be "Gymi Band"? Battery and water resistance? CE and FCC certificates, and help with Saudi certificates? Warranty and lead time? A custom color or strap so it's not the same as other brands?
- **Rules:** test samples for a week next to an Apple Watch or WHOOP. Never market blood pressure or any medical claim. Check Saudi certification before selling.
- **Business idea:** include the band with the yearly Pro subscription, like WHOOP.

---

## 13. How we build it (with Claude Code)

### Setup
1. Create free accounts: GitHub, Supabase (project "gymi"), Google AI Studio (Gemini key), Expo, Vercel (already have).
2. Install Node.js (LTS), Git, and the Claude desktop app (Code tab). Install Expo Go on your phone.
3. Make a folder `gymi` with a `docs` folder inside. Put in it: `index.html` (design), `Gymi-features.md`, `Gymi-design.md`, and `GYMI development.md`.
4. Open the folder in Claude Code and give it the Phase 1 prompt.

### Rules for Claude Code
- The design file is the source of truth for every screen.
- API keys only in `.env` files, never in the app or on GitHub. AI calls only from Supabase Edge Functions.
- Build one phase at a time. After each phase, test on the phone (Expo Go) and the web before moving on.

### Phases
1. Project setup, design tokens, light/dark, English/Arabic, sign up and log in, Home, tab bar, web deploy.
2. Food: calorie setup, results, meal plan, logging, barcode, search.
3. Train: plan setup, weekly plan, active workout, rest timer, summary.
4. AI coach (Gemini) and the model switch.
5. Progress, water, sleep, health, reports.
6. Gym Bros, coaches, and women's health.
7. Devices, subscriptions, and the App Store and Google Play release.

---

## 14. Next steps

1. Check that the name Gymi is free on the App Store, Google Play, and as a domain.
2. Fix the two small design issues (see Gymi-design).
3. Set up the accounts and the project, then start Phase 1 with Claude Code.
4. Order band samples to test while building.
