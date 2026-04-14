# Trigger-Map Architecture And Runtime Guide

## 1. Product Scope

Trigger-Map is an Android-first health tracking app that logs pain, stress, medicine, and food entries to discover potential trigger patterns over time.

- Primary target: Android
- Current home/dashboard status: placeholder (`app/(tabs)/index.tsx`)
- Core product direction: offline-first data entry with silent background sync

## 2. Tech Stack

- Runtime: React Native 0.83 + Expo SDK 55
- Router: Expo Router (`app/` file-based)
- Language: TypeScript
- UI framework: React Native Paper (MD3) + custom UI primitives
- UI icons: `@expo/vector-icons` (MaterialCommunityIcons)
- Native input controls: `@react-native-community/datetimepicker` + `@react-native-community/slider`
- Local storage: `expo-sqlite` (`triggermap.db`)
- Remote backend: Supabase (Auth + Postgres tables)
- Background jobs: `expo-background-task` + `expo-task-manager`
- Connectivity detection: `@react-native-community/netinfo`
- Package manager: `bun`

Expo runtime config (`app.json`):

- app scheme: `triggermap`
- orientation: `portrait`
- userInterfaceStyle: `automatic`

## 3. App Entrypoint And Providers

Root entry is `app/_layout.tsx`.

Startup behavior:

1. Load custom fonts (Sora and Manrope).
2. Initialize local database (`initLocalDB()`).
3. Register network reconnect listener (`setupNetworkListener()`).
4. Register periodic background sync (`registerBackgroundSync()`).
5. Render provider stack:
     - `SafeAreaProvider`
     - `GestureHandlerRootView`
     - `ThemeProvider`
     - `AuthProvider`
     - `RootLayoutNav` (Paper theme + BottomSheet provider + Router stack)

Routing guard in `RootLayoutNav`:

- unauthenticated user outside `(auth)` -> redirect to `/(auth)/sign-in`
- authenticated user inside `(auth)` -> redirect to `/(tabs)`

## 4. Routing And Navigation

### 4.1 Route Groups

- `app/(auth)/_layout.tsx`: auth stack (`animation: 'fade'`)
- `app/(auth)/sign-in.tsx`: email/password sign-in
- `app/(auth)/sign-up.tsx`: email/password registration
- `app/(tabs)/_layout.tsx`: main app tabs with custom header and custom bottom bar
- `app/(tabs)/index.tsx`: home placeholder
- `app/(tabs)/logs.tsx`: timeline log list with edit/delete
- `app/(tabs)/add-log.tsx`: create new entries
- `app/(tabs)/settings.tsx`: profile/theme/sign-out

### 4.2 Bottom Navigation

`components/ui/BottomNavBar.tsx` implements a floating dock with:

- tabs: Home, Logs, Settings
- dedicated add action: gradient FAB that opens `/(tabs)/add-log`
- adaptive bottom offset for Android nav-bar inset

`app/(tabs)/add-log.tsx` is registered as a tab route but hidden from the tab list (`href: null`).

## 5. Theme And Design System

### 5.1 Theme Source

- `providers/ThemeProvider.tsx` persists `themePreference` (`auto | light | dark`) via `expo-secure-store`
- `useAppColors()` resolves light/dark token set from `constants/theme.ts`
- `app/_layout.tsx` maps MD3 font slots to Sora/Manrope and merges Paper colors with app tokens

### 5.2 Token Rules

- Do not hardcode hex/RGB values in feature code
- Use `Spacing` and `Radius` from `constants/theme.ts`
- Use `useAppColors()` + `useThemePreference()` instead of direct color constants in screens/components

### 5.3 Core UI Primitives

- `ScreenWrapper`: safe area + layered ambient background
- `AppCard`: surfaced container (`glass | subtle | solid` style behavior)
- `CustomButton`: animated press feedback over Paper Button
- `CustomTextInput`: themed outlined input with optional error text
- `AppSnackbar`: animated snackbar wrapper
- `ProfileInitialAvatar`: initials-based avatar

## 6. Authentication

- Supabase auth only (email/password)
- Session persistence through SecureStore adapter in `lib/supabase.ts`
- Auth state managed in `providers/AuthProvider.tsx` via:
    - `supabase.auth.getSession()` on boot
    - `supabase.auth.onAuthStateChange()` subscription

## 7. Offline-First Data Architecture

### 7.1 Local SQLite Schema (`lib/localDb.ts`)

Domain tables:

- `user_medicines`
- `user_foods`
- `pain_logs`
- `stress_logs`
- `medicine_logs`
- `food_logs`

Sync/system tables:

- `sync_queue`: queued mutations (`INSERT | UPDATE | DELETE` + JSON payload)
- `sync_meta`: sync diagnostics (`last_sync_at`, `last_sync_error`)
- `user_settings`: local profile cache (`display_name`)

Migration/safety:

- UUID helper `createUuid()` with crypto fallback
- local ID repair for legacy malformed IDs
- queue payload ID repair and stale invalid queue cleanup

### 7.2 Remote Supabase Schema

- `user_medicines`
- `user_foods`
- `pain_logs`
- `stress_logs`
- `medicine_logs`
- `food_logs`
- `daily_context` (defined remotely, not currently used in app flows)

### 7.3 Queue Model

All data mutations are local-first:

1. Write to SQLite immediately.
2. Append mutation to `sync_queue`.
3. Trigger `runSync()` opportunistically (silent).

Queue payload conventions:

- `INSERT`: full row payload
- `UPDATE`: payload includes `id` and changed fields under `data`
- `DELETE`: payload includes `id`
- special non-table channel: `auth_profile` for profile metadata update via Supabase Auth API

### 7.4 Sync Engine (`lib/syncEngine.ts`)

Primary functions:

- `pushLocalChanges()`: flush queue to Supabase
- `pullRemoteChanges()`: refresh local master items and recent logs (last 7 days)
- `runSync()`: serialized orchestrator (push then pull)

Background and connectivity:

- `registerBackgroundSync()`: periodic background task (`minimumInterval: 15`)
- `setupNetworkListener()`: triggers sync when transitioning offline -> online

Profile sync behavior:

- queued `auth_profile` operations call `supabase.auth.updateUser({ data: { display_name } })`
- remote profile value is pulled into `user_settings` only when no pending `auth_profile` queue item exists

Visibility model:

- sync diagnostics are maintained in memory + `sync_meta`
- UI intentionally keeps sync seamless and automatic (no sync banner/manual controls)

## 8. Feature Behavior Map

### 8.1 Sign In / Sign Up

- files: `app/(auth)/sign-in.tsx`, `app/(auth)/sign-up.tsx`
- uses `CustomTextInput`, `CustomButton`, `AppCard`, `ScreenWrapper`
- direct Supabase auth calls

### 8.2 Add Log

- file: `app/(tabs)/add-log.tsx`
- sections:
    - Date and time picker
    - Food selection
    - Pain entries (body part + level + swelling)
    - Medicine selection
    - Stress level
- save behavior:
    - validate at least one entry category
    - single local transaction for all selected entries
    - queue each inserted row
    - trigger background sync (`runSync()`)

### 8.3 Logs

- file: `app/(tabs)/logs.tsx`
- reads timeline from SQLite only
- groups by `log_date` into section headers
- supports filter chips (all/pain/stress/medicine/food)
- supports tap-to-expand action drawer (edit/delete) and undo delete snackbar
- edit flow opens a type-aware modal (pain/stress/medicine/food specific controls)
- every edit/delete writes locally, queues mutation, then silently syncs
- pull-to-refresh triggers `runSync()` and reloads local data

### 8.4 Settings

- file: `app/(tabs)/settings.tsx`
- profile display name:
    - reads from local `user_settings` cache first
    - saves locally + queues `auth_profile` update
    - triggers silent sync
- theme preference stored in secure store via `ThemeProvider`
- sign-out uses `supabase.auth.signOut()`

### 8.5 Item Selector

- file: `components/forms/ItemSelector.tsx`
- reused for both food and medicine master data
- supports create/edit/delete of master items via local DB + queue
- deleting a master item removes it from future selection only; historical logs are preserved

## 9. Implementation Rules For Contributors And Agents

1. Preserve offline-first semantics: local write first, queue second, sync third.
2. Use transactions for multi-row domain operations.
3. Use UUIDs from `createUuid()` for all local entity IDs that sync remotely.
4. Keep `logged_at` and `log_date` both populated on inserts.
5. Normalize stress level values to backend-safe set (`low | moderate | high`).
6. Keep sync UX seamless and silent unless a task explicitly requests visible sync diagnostics.
7. Use existing UI primitives before creating one-off components.
8. Validate changes with `bunx tsc --noEmit` after meaningful edits.
9. Keep dependency surface lean: remove unused runtime packages and clear dead declarations during cleanup passes.

## 10. Current Known Gaps

- Home tab is still a placeholder (`TBD`).
- `daily_context` remote schema is not yet integrated into app flows.
- Sync status tracking is kept internal to `syncEngine`, and no user-facing sync UI is exposed by design.
