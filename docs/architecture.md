# Trigger-Map Architecture And Runtime Guide

This document is the source of truth for how Trigger-Map currently works in code.

## 1. Product Scope

Trigger-Map is an Android-first health logging app focused on pain, stress, medicine, and food entries.

- Primary UX goal: fast local entry with no online dependency
- Data model goal: local-first SQLite + queued sync to Supabase
- Sync UX goal: seamless background behavior with no sync-status UI by default
- Current dashboard status: [app/(tabs)/index.tsx](../app/(tabs)/index.tsx) remains a placeholder

## 2. Runtime Stack

- Expo SDK 55 (`expo` 55.x)
- React Native 0.83.4
- React 19.2
- Expo Router for file-based navigation
- TypeScript
- React Native Paper (MD3) with custom primitives
- Local DB: `expo-sqlite`
- Backend: Supabase Auth + Postgres tables
- Background execution: `expo-background-task` + `expo-task-manager`
- Network detection: `@react-native-community/netinfo`
- Package/tooling: Bun

## 3. Startup Lifecycle

Startup is orchestrated in [app/_layout.tsx](../app/_layout.tsx):

1. Load fonts (Sora + Manrope)
2. Initialize local DB (`initLocalDB()`)
3. Register network listener (`setupNetworkListener()`)
4. Register periodic background sync (`registerBackgroundSync()`)
5. Render provider tree:
     - `SafeAreaProvider`
     - `GestureHandlerRootView`
     - `ThemeProvider`
     - `AuthProvider`
     - `RootLayoutNav`
6. Root layout exports an Expo Router `ErrorBoundary` fallback for crash-safe recovery (`Try Again` action)

Auth route protection is centralized in `RootLayoutNav`:

- no session outside `(auth)` -> redirect to `/(auth)/sign-in`
- session inside `(auth)` -> redirect to `/(tabs)`

## 4. Routing And Navigation

### 4.1 Route Groups

- [app/(auth)/_layout.tsx](../app/(auth)/_layout.tsx)
- [app/(auth)/sign-in.tsx](../app/(auth)/sign-in.tsx)
- [app/(auth)/sign-up.tsx](../app/(auth)/sign-up.tsx)
- [app/(tabs)/_layout.tsx](../app/(tabs)/_layout.tsx)
- [app/(tabs)/index.tsx](../app/(tabs)/index.tsx)
- [app/(tabs)/logs.tsx](../app/(tabs)/logs.tsx)
- [app/(tabs)/add-log.tsx](../app/(tabs)/add-log.tsx)
- [app/(tabs)/settings.tsx](../app/(tabs)/settings.tsx)

### 4.2 Bottom Navigation

[components/ui/BottomNavBar.tsx](../components/ui/BottomNavBar.tsx) is a custom floating dock:

- tabs: Home, Logs, Settings
- dedicated center FAB for Add Log
- adaptive Android bottom inset handling

[app/(tabs)/add-log.tsx](../app/(tabs)/add-log.tsx) is hidden from tab list with `href: null` and opened by FAB navigation.

## 5. Auth And Session Model

- Supabase client lives in [lib/supabase.ts](../lib/supabase.ts)
- Session persistence uses SecureStore adapter
- Auth state is managed by [providers/AuthProvider.tsx](../providers/AuthProvider.tsx):
    - `getSession()` on boot
    - `onAuthStateChange()` subscription for live updates

## 6. Theme System And UI Primitives

Theme resolution is in [providers/ThemeProvider.tsx](../providers/ThemeProvider.tsx):

- preference persisted as `auto | light | dark`
- resolved color tokens from [constants/theme.ts](../constants/theme.ts)

Core primitives used across features:

- `ScreenWrapper`
- `AppCard`
- `CustomButton`
- `CustomTextInput`
- `AppSnackbar`
- `ProfileInitialAvatar`

Rules:

- avoid hardcoded hex/RGB in feature files
- use `Spacing` and `Radius` tokens
- prefer `useAppColors()` and `useThemePreference()`

## 7. Local Data Architecture (SQLite)

Local DB is in [lib/localDb.ts](../lib/localDb.ts).

### 7.1 Domain Tables

- `user_medicines`
- `user_foods`
- `user_body_parts`
- `pain_logs`
- `stress_logs`
- `medicine_logs`
- `food_logs`

### 7.2 Sync/System Tables

- `sync_queue`
- `sync_meta`
- `user_settings`

### 7.3 Queue Contract

All domain mutations are local-first:

1. write to SQLite
2. queue mutation (`addToSyncQueue(...)`)
3. trigger silent sync (`runSync()`)

Queue payload conventions:

- `INSERT`: full row payload
- `UPDATE`: `{ id, data: { ...changedFields } }`
- `DELETE`: `{ id }`
- `auth_profile`: special queue channel handled via Supabase Auth API

Queue rows are explicitly user-scoped with `sync_queue.user_id`.

### 7.4 Startup Migration/Repair Pipeline

`initLocalDB()` runs migration/repair logic before feature use. Notable safeguards include:

- invalid UUID repair for local logs and queued payload IDs
- backfill missing queue `user_id`
- stress level normalization (`none` and `mid` legacy handling)
- master item required field backfill (`name`, `quantity`, `unit`)
- queued master item payload normalization for required fields
- backfill of medicine/food log snapshot columns
- backfill saved body parts from historical pain logs

### 7.5 Data Invariants

- IDs for syncable rows are UUIDs from `createUuid()`
- both timestamps are required on inserts:
    - `logged_at`: ISO timestamp
    - `log_date`: day key used for grouping
- medicine/food logs persist local snapshot columns:
    - `item_display_name`, `item_name`, `item_quantity`, `item_unit`
- master item deletion does not delete historical logs

## 8. Sync Architecture

Sync logic is in [lib/syncEngine.ts](../lib/syncEngine.ts).

### 8.1 Entry Points

- feature flows call `runSync()` after queueing
- `setupNetworkListener()` triggers on offline -> online transition
- background task runs at minimum interval 15 minutes

### 8.2 Orchestration

`runSync()` is serialized with a module-level in-flight promise and runs:

1. `pushLocalChanges(activeUserId)`
2. `pullRemoteChanges(activeUser)`

On full success it updates `last_sync_at` and clears `last_sync_error`.

### 8.3 Push Phase Details

- only active-user queue rows are read
- queue is sorted by priority:
    - master item upserts first
    - dependent log upserts second
    - dependent deletes third
    - master deletes last
- stress payloads are normalized to backend-safe values
- user item payloads are sanitized and normalized for required remote fields:
    - `name`
    - `quantity`
    - `unit`
    - `user_id` fallback for inserts
- `auth_profile` rows call `supabase.auth.updateUser`

Error handling:

- `23503` on dependent logs: attempt remote parent recovery from local snapshot, then retry
- `22P02`: drop malformed UUID queue row
- all other errors are recorded in `sync_meta.last_sync_error`

### 8.4 Pull Phase Details

Pull fetches per active user:

- `user_medicines`
- `user_foods`
- recent logs (7-day window) for pain, stress, medicine, food

Writes are wrapped in a local transaction and include snapshot backfill for recent logs.

### 8.5 Sync Status Storage

Sync metadata is persisted in `sync_meta`:

- `last_sync_at`
- `last_sync_error`

Status is intentionally not surfaced as persistent sync UI.

## 9. Feature Behavior Map

### 9.1 Add Log

[app/(tabs)/add-log.tsx](../app/(tabs)/add-log.tsx):

- multi-type form (pain, stress, medicine, food)
- validates at least one category before save
- commits all selected entries inside one local transaction
- queues each inserted row with explicit `userId`
- stores medicine/food snapshot data in local log rows
- auto-upserts body-part master entries from pain logs

### 9.2 Logs

[app/(tabs)/logs.tsx](../app/(tabs)/logs.tsx):

- reads timeline from local DB only
- filter chips: all/pain/stress/medicine/food
- tap-to-expand actions, edit modal, delete with undo
- pull-to-refresh triggers sync then reload
- local row mutation + queue write are wrapped together in `runLocalTransaction(...)`

### 9.3 Item Selector

[components/forms/ItemSelector.tsx](../components/forms/ItemSelector.tsx):

- shared master-data manager for food/medicine
- supports search/create/edit/delete
- required form validation before save:
    - name required
    - unit required
    - quantity required numeric > 0
- duplicate name create path updates existing item instead of inserting duplicate
- delete removes item from future selection only, preserves historical logs

### 9.4 Settings

[app/(tabs)/settings.tsx](../app/(tabs)/settings.tsx):

- display name is cached in local `user_settings`
- save flow queues `auth_profile` update in transaction
- triggers silent sync after save
- theme preference persists locally
- sign-out via Supabase Auth
- sign-out now shows a confirmation prompt when unsynced queue entries exist for the active user

### 9.5 Auth Screens

- sign-in and sign-up use direct Supabase auth calls
- route redirection behavior is handled in root layout auth guard

## 10. Remote Supabase Contract

Expected remote domain tables:

- `user_medicines`
- `user_foods`
- `pain_logs`
- `stress_logs`
- `medicine_logs`
- `food_logs`
- `daily_context` (currently not integrated in app flows)

Important contract details:

- `user_medicines` and `user_foods` enforce required `name`, `quantity`, and `unit`
- app sync payload sanitization normalizes these fields before remote writes
- app should not depend on writing `display_name` to remote user item rows

Operational notes:

- FK-supporting indexes were added for log tables as part of launch hardening
- RLS policies were optimized to use `(select auth.uid())` style predicates
- remaining external security advisory may exist in Supabase project settings (for example leaked-password protection)
- Android app config is hardened for launch with `allowBackup: false`, explicit package/versionCode, and secure-store backup configuration

## 11. Contributor Rules (Non-Negotiable)

1. Keep local-first mutation order: SQLite -> queue -> sync
2. Do not write directly to Supabase domain tables from feature screens
3. Use transactions whenever local mutation and queue write must stay atomic
4. Use `createUuid()` for syncable IDs
5. Preserve both `logged_at` and `log_date`
6. Preserve medicine/food snapshot behavior in logs
7. Keep sync silent; do not add manual sync controls or banners unless requested
8. Use theme tokens and existing UI primitives
9. Maintain stress normalization rules (`Mid` maps to `moderate`)
10. Run `bunx tsc --noEmit` after meaningful changes

## 12. Verification Checklist

- Type check passes
- New mutations are local-first and queued
- Local mutation + queue write paths are transactional where required
- Queue rows include correct `user_id`
- No direct Supabase writes added in feature screens
- Master item required field rules remain enforced (`name`, `quantity`, `unit`)
- No sync-status UI added unless explicitly requested
- Auth routing and theme behavior remain intact

## 13. Known Gaps

- Home tab is still placeholder content
- `daily_context` exists remotely but is not wired into app flows
- Sync diagnostics are internal; there is no user-facing sync status surface by default
