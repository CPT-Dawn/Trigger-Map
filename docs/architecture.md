# Trigger-Map: Architecture & Guidelines

## 1. Project Overview

Trigger-Map is a health tracking app designed to find correlations between food, medicine, weather, and symptom triggers (pain/stress).

- **Primary Target:** Android.
- **Tech Stack:** React Native Expo SDK 55 (Expo Router), Bun, Supabase, React Native Paper.

## 2. Directory Structure & Routing

This project uses **Expo Router** for file-based routing:

- `app/_layout.tsx`: Root layout. Orchestrates the app providers (`PaperProvider`, `BottomSheetModalProvider`, `SafeAreaProvider`, `ThemeProvider`, `AuthProvider`) and handles top-level routing redirects based on auth state using `useSegments()`.
- `app/(auth)/*`: Unauthenticated routes (Sign In, Sign Up).
- `app/(tabs)/*`: Main app flow. Protected by AuthProvider. Uses a custom `BottomNavBar` component for navigation.
- `components/ui/*`: Reusable atomic UI components (`CustomButton`, `CustomTextInput`, `ScreenWrapper`, `AppCard`, `AppSnackbar`).
- `components/forms/*`: Reusable form components like `ItemSelector`.
- `constants/theme.ts`: Contains spacing, typography, radius mappings, and the raw light/dark color definitions.
- `providers/*`: Context providers for app-wide state (`AuthProvider.tsx`, `ThemeProvider.tsx`).
- `lib/supabase.ts`: Supabase client initialization.

## 3. Design System & UI Rules (CRITICAL)

To maintain a modern, beautiful, and consistent Android-inclined aesthetic:

- **Never use raw hex codes, RGB values, or inline fonts.**
- **Theming Hook:** Use the `useAppColors()` and `useThemePreference()` hooks from `providers/ThemeProvider` to get the current applied light/dark theme colors instead of hardcoding values or exclusively using the Paper theme hook.
- **Components:** All base UI elements MUST be imported from `components/ui/` or `react-native-paper`. 
    - Use `ScreenWrapper` to wrap screens for consistent safe-area handling and backgrounds.
    - Use `AppCard` for surface materials.
- **Icons:** Use `@expo/vector-icons` (`MaterialCommunityIcons` primary).
- **Typography:** Rely on Material Design 3 typography scales natively provided by React Native Paper, extended with Google Fonts (Sora and Manrope).

## 4. Authentication

- Email and Password ONLY.
- Handled via Supabase Auth.
- Session tokens are stored securely using `expo-secure-store` handling by Supabase explicitly.
- The `RootLayoutNav` checks auth status and seamlessly redirects user unauthenticated access from `(tabs)` back to `(auth)/sign-in`.

## 5. Database Schema (Supabase)

We use a normalized relational database.

- `user_medicines`: id, user_id, name, quantity, unit, display_name
- `user_foods`: id, user_id, name, quantity, unit, display_name
- `pain_logs`: id, user_id, logged_at, log_date, body_part, pain_level (1-5), swelling
- `stress_logs`: id, user_id, logged_at, log_date, level (none|low|moderate|high)
- `medicine_logs`: id, user_id, medicine_id, logged_at, log_date
- `food_logs`: id, user_id, food_id, logged_at, log_date
- `daily_context`: id, user_id, date, weather_data, day_rating

## 6. Coding Standards for AI

- Write functional components using TypeScript (`.tsx`).
- Keep components small and focused.
- Ensure all database calls to Supabase handle errors gracefully and display user-friendly Toast/Alert messages via `AppSnackbar`.
- Use React hooks (`useState`, `useEffect`, `useCallback`) correctly avoiding stale closures.
- Always cleanly separate UI layout/styling logic from database/submission logic.
