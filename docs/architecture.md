# Trigger-Map: Architecture & Guidelines

## 1. Project Overview
Trigger-Map is a health tracking app designed to find correlations between food, medicine, weather, and symptom triggers (pain/stress). 
- **Primary Target:** Android.
- **Tech Stack:** React Native Expo SDK 55 (Expo Router), Bun, Supabase, React Native Paper.

## 2. Design System & UI Rules (CRITICAL)
To maintain a modern, beautiful, and consistent Android-inclined aesthetic:
- **Never use inline styles for colors/fonts.** Always import from `constants/theme.ts` or use the React Native Paper theme provider.
- **Components:** All base UI elements (Buttons, TextInputs) MUST be imported from `components/ui/` or `react-native-paper`. Do not build one-off buttons.
- **Spacing:** Use consistent multiples of 8 (8, 16, 24, 32) for margins and padding.
- **Typography:** Rely on Material Design 3 typography scales.

## 3. Authentication
- Email and Password ONLY.
- Handled via Supabase Auth.
- Session tokens must be stored securely using `expo-secure-store`.
- The app uses an Auth Context Provider to protect the `(tabs)` routes. Unauthenticated users are redirected to `(auth)/sign-in`.

## 4. Database Schema (Supabase)
We use a normalized relational database.
- `user_medicines`: id, user_id, name, quantity, unit, display_name
- `user_foods`: id, user_id, name, quantity, unit, display_name
- `pain_logs`: id, user_id, logged_at, log_date, level (1-10)
- `stress_logs`: id, user_id, logged_at, log_date, level (1-10)
- `medicine_logs`: id, user_id, medicine_id, logged_at, log_date
- `food_logs`: id, user_id, food_id, logged_at, log_date
- `daily_context`: id, user_id, date, weather_data, day_rating

## 5. Coding Standards for AI
- Write functional components using TypeScript (`.tsx`).
- Keep components small and focused.
- Ensure all database calls to Supabase handle errors gracefully and display user-friendly Toast/Alert messages.