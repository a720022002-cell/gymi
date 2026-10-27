# Adro reel (Higgsfield) — plan

Reference: https://www.instagram.com/p/DdcNtn3MhOY/ (21 s: real lifestyle footage, glassy app cards floating over it, an AI coach chat typing, logo + store badge at the end).

Format: 9:16 (1080 × 1920), about 20 s, English text, no music (added in Instagram/TikTok).

## How it's made

1. **Higgsfield** makes the real-looking footage (5 clips, 3–4 s each). No phone screens with text in them: AI video can't draw our app correctly.
2. **Our real app cards** go on top afterwards (rendered from the app's own screens, glass style, cobalt `#2F5BFF`), animated in.
3. The end card is ours: the Adro logo, "Coming soon", and "Download on the App Store" (Apple's official badge).

## Shots

| # | Time | Higgsfield clip (prompt) | Card on top | Text |
|---|---|---|---|---|
| 1 | 0–4 s | Early morning, Riyadh skyline in soft golden light, a Saudi man in his late 20s in black training clothes tying his running shoes on a balcony, shallow depth of field, slow push-in, cinematic, 9:16 | Recovery ring "85% recovered" | Better days start with better recovery |
| 2 | 4–8 s | Modern gym, warm light, a man doing dumbbell Romanian deadlifts, slow motion, side angle, dust in the light, cinematic, 9:16 | Today's set: "84 kg × 12 → next set 84 kg" | Your coach knows your next set |
| 3 | 8–12 s | Close-up from above of a healthy plate (grilled chicken, rice, salad) on a wooden table, a hand holding a phone over it as if taking a photo, the phone screen not visible, soft daylight, 9:16 | Meal photo result "Chicken & rice, 620 kcal, 48 g protein" | Snap your meal. Done. |
| 4 | 12–16 s | A woman in modest sportswear running on a palm-lined path at sunset, tracking shot, warm tones, cinematic, 9:16 | AI coach chat typing: "Light run today, your sleep was short." | Ask your coach anything |
| 5 | 16–18 s | Night, the same man on a sofa, relaxed, phone in hand (screen not visible), city lights through the window, slow dolly, 9:16 | Day streak "12 days" | — |
| 6 | 18–21 s | (ours, no footage) black → Adro logo | — | **Adro** · Coming soon · App Store badge |

## Made (27 Oct 2026)

Higgsfield video models need a paid plan, so the 5 shots are Soul 2.0 photos (0.12 credits each) with a slow camera move added in the page, plus the real-looking app cards and the end card. Video: `docs/marketing/Adro-reel-coming-soon.mp4` (1080 × 1920, 21.5 s, no music). Source: `docs/marketing/higgsfield-reel/` (reel.html, render.js: `node render.js <dir> out.mp4 21.5`; fonts from node_modules/@expo-google-fonts copied to `<dir>/fonts`).

## Was waiting on

- Higgsfield connected (claude.ai → Connectors), then a new session.
- OK on the shots above, or changes.
