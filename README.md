# Gymi

Your AI gym coach. One Expo (React Native) codebase for web, iPhone and Android. The web version deploys on Vercel.

- Design (source of truth): `docs/index.html`
- Features: `docs/Gymi-features.md`
- Design rules and screen map: `docs/Gymi-design.md`
- Tech plan and phases: `docs/GYMI-development.md`

## Stack

- Expo SDK 57, Expo Router, TypeScript
- Supabase for login, database and file storage
- Gemini Flash for AI, only from Supabase Edge Functions (from Phase 4)

## Where things are

| Path | What |
|---|---|
| `src/app/` | Screens (each file is a route) |
| `src/components/` | Shared UI: Glass, Text, buttons, tab bar, fields |
| `src/theme/tokens.ts` | Colors, fonts, sizes from the design |
| `src/theme/settings.tsx` | Theme, language (RTL), Reduce Transparency |
| `src/i18n/` | English/Arabic text (English is the key) |
| `src/lib/` | Supabase client, login state, form rules |
| `supabase/migrations/` | Database setup (tables, row level security) |
| `public/` | Web page template, install manifest, icons |

## Environment variables

Only public values go in the app. Never put the Supabase secret / service_role key or the Gemini key in the app or in Vercel.

| Name | Where | Notes |
|---|---|---|
| `EXPO_PUBLIC_SUPABASE_URL` | Vercel (Production + Preview) | Public |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Vercel (Production + Preview) | Public (publishable key) |
| `GEMINI_API_KEY` | Supabase Edge Function secrets (Phase 4) | Secret |

## Commands

```bash
npm install
npm run web          # local dev server
npm run build:web    # export to dist/ (what Vercel runs)
npm run typecheck
npm run lint
```
