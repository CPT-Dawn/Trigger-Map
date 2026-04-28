# TriggerMap

TriggerMap is a professional-grade, local-first health logging application designed for Android. It focuses on tracking pain levels, stress, medication, and food intake with a primary goal of providing a seamless, lightning-fast logging experience that works entirely offline while keeping data synchronized in the background.

## 🚀 Key Features

- **Offline-First Architecture**: Immediate data entry with no network dependency using `expo-sqlite`.
- **Seamless Background Sync**: Transparent data synchronization with Supabase using `expo-background-task` and a custom sync engine.
- **Trigger Correlation**: Automatically correlates health logs with environmental data (barometric pressure, temperature, humidity) via Open-Meteo API.
- **Smart Logging**: Multi-type logs (Pain, Stress, Medicine, Food) in a single unified entry flow.
- **Data Visualization**: Interactive 7-day trends and analytics using `react-native-gifted-charts`.
- **Modern UI**: Built with React Native Paper (MD3), custom primitives, and fluid animations powered by `react-native-reanimated`.

## 🛠 Tech Stack

- **Framework**: [Expo SDK 55](https://expo.dev/) (React Native 0.83.4)
- **Navigation**: [Expo Router](https://docs.expo.dev/router/introduction/) (File-based routing)
- **Language**: TypeScript
- **Database**:
  - **Local**: SQLite (`expo-sqlite`)
  - **Remote**: Supabase (PostgreSQL)
- **Authentication**: Supabase Auth
- **Styling**: React Native Paper + Custom Theme System
- **Environment**: Open-Meteo API for weather/pressure data

## 🏗 Architecture Insights

TriggerMap follows a strict **Research -> Strategy -> Execution** lifecycle for data:

1. **Local-First**: All mutations are written to the local SQLite database first.
2. **Sync Queue**: Changes are queued in a specialized `sync_queue` table.
3. **Background Engine**: A background task periodically processes the queue, handling push/pull operations with Supabase while resolving conflicts and maintaining data integrity.
4. **Environment Context**: The app fetches local weather and barometric pressure data to help users identify potential environmental triggers for pain and stress.

## 🏁 Getting Started

### Prerequisites

- [Bun](https://bun.sh/) runtime
- [Expo Go](https://expo.dev/client) or a development build for Android/iOS

### Installation

1. Clone the repository:

   ```bash
   git clone https://github.com/CPT-Dawn/Trigger-Map
   cd TriggerMap
   ```

2. Install dependencies:

   ```bash
   bun install
   ```

3. Configure Environment Variables:
   Create a `.env` file (or use EAS secrets) with your Supabase credentials:

   ```env
   EXPO_PUBLIC_SUPABASE_URL=your_supabase_url
   EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```

4. Start the development server:
   ```bash
   bun start
   ```

## 📁 Project Structure

- `/app`: Expo Router screens and layouts.
- `/components`: Shared UI primitives and complex form components.
- `/lib`: Core business logic (SQLite migrations, Sync Engine, Supabase client).
- `/providers`: Context providers for Auth, Theme, and global state.
- `/constants`: Design tokens and theme configurations.

## ⚖️ License

This project is private and intended for personal health tracking. All rights reserved.
