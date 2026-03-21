# Trigger Map

Expo Router app with themed email/password auth backed by Supabase.

## 1. Install + Run

```bash
bun install
bun run ios
# or
bun run android
```

## 2. Configure Environment Variables

1. Copy `.env.example` to `.env`
2. Set:

```bash
EXPO_PUBLIC_SUPABASE_URL=...
EXPO_PUBLIC_SUPABASE_ANON_KEY=...
```

3. Restart Expo after any `.env` change.

## 3. Supabase Dashboard Setup

In your Supabase project:

1. `Authentication` -> `Providers`:
   - Enable `Email`
2. `Authentication` -> `URL Configuration`:
   - Optional reset redirect URL: `triggermap://login`
3. `SQL Editor`:
   - Run `supabase/migrations/20260321070000_smart_dropdowns.sql`
   - Then run `supabase/seed/dropdown_defaults.sql`

## 4. Important Notes

- This app expects `scheme: "triggermap"` in `app.json` (already configured).
- Auth routes redirect automatically:
  - Logged-in users are moved to tabs.
  - Logged-out users are routed to login from protected routes.
- Google/Phone buttons in UI are intentionally marked as coming soon.
- Smart dropdown behavior:
  - Defaults are global and seeded from the database.
  - Typed custom options are saved per user only.
  - Custom options are case-insensitive unique per dropdown category.
  - Long-press dropdown options to hide default options or rename/delete custom options.
  - Use `Restore` in each dropdown sheet to bring back hidden default options.
