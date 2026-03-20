# Trigger Map

Expo Router app with themed auth flows (email/password, Google OAuth, phone OTP) backed by Supabase.

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
   - Enable `Phone`
   - Enable `Google`
2. `Authentication` -> `URL Configuration`:
   - Add redirect URL: `triggermap://auth/callback`
3. For Phone OTP:
   - Configure SMS provider credentials (Twilio/MessageBird/etc.)
4. For Google OAuth:
   - In Google Cloud, configure OAuth consent + client.
   - Add your Supabase callback URL from the Google provider section.

## 4. Important Notes

- Google OAuth on native works best in a development build/standalone app. Expo Go may not reliably handle custom scheme redirects for all OAuth flows.
- This app expects `scheme: "triggermap"` in `app.json` (already configured).
- Auth routes redirect automatically:
  - Logged-in users are moved to tabs.
  - Logged-out users are routed to login from protected routes.
