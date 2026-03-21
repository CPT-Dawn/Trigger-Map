# Trigger-Map Project Guidelines

## Build and Test
- Use Bun commands for all local tasks.
- Install dependencies: `bun install`
- Start dev server: `bun run start`
- Run app targets: `bun run ios`, `bun run android`
- Lint before finishing changes: `bun run lint`
- There is no test runner configured yet; do not add test commands unless requested.

## Architecture
- The app uses Expo Router. Root auth and theme orchestration lives in [app/_layout.tsx](../app/_layout.tsx).
- Tab screens are under [app/(tabs)](../app/(tabs)). Add/edit flows are handled in [app/add-edit.tsx](../app/add-edit.tsx).
- Keep data access in [lib](../lib):
  - Auth/session flows in [lib/auth.ts](../lib/auth.ts) and [lib/supabase.ts](../lib/supabase.ts)
  - Dropdown/domain logic in [lib/dropdowns.ts](../lib/dropdowns.ts)
  - Log entry workflows in [lib/logs.ts](../lib/logs.ts)
- Database schema and constraints are managed through SQL migrations in [supabase/migrations](../supabase/migrations).

## Code Style
- Follow existing TypeScript and React Native patterns in nearby files instead of introducing new abstractions.
- Preserve path alias imports using `@/` for workspace modules.
- Keep UI colors/theme access aligned with [constants/theme.ts](../constants/theme.ts) and [lib/theme.tsx](../lib/theme.tsx).

## Conventions
- Service modules in [lib](../lib) return a Result shape (`{ data, error }`) and avoid throwing for expected failures.
- Convert Supabase and network failures to user-friendly error strings, following patterns in [lib/auth.ts](../lib/auth.ts) and [lib/logs.ts](../lib/logs.ts).
- Dropdown categories are fixed to `'food' | 'pain' | 'stress' | 'medicine'` and behavior differs by category.
  - `pain` and `stress` are fixed-option categories.
  - `food` and `medicine` support user custom options.
- Auth route protection is implemented in [app/_layout.tsx](../app/_layout.tsx); preserve those redirect rules when changing navigation.

## Documentation
- Setup, environment variables, and Supabase bootstrap steps are documented in [README.md](../README.md).
- Prefer linking to existing files instead of duplicating long explanations in instructions.