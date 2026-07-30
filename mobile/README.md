# SMART LIFE - Mobile

Flutter app for Android (v10+) and iOS - the **primary** SMART LIFE experience.
The mobile app is the only place that can perform money lockdowns and screen-time
enforcement, because those depend on OS-level and mobile-money APIs (SRS section 3.2).

---

## Requirements

- **Flutter** SDK (stable channel), Dart 3+
- Android SDK (Android Studio) for Android builds; Xcode + CocoaPods for iOS
- A running backend API (see [../backend/README.md](../backend/README.md))

Verify your toolchain:

```bash
flutter doctor
```

---

## Setup

```bash
flutter pub get
flutter run                # pick a device/emulator
```

Set the backend URL in `lib/config.dart` (or via `--dart-define=API_URL=...`).

---

## What lives here

- **Auth** - signup / login.
- **Money** - log income & expenses (RWF), set savings goals + deadlines, see live
  spending limit.
- **Lockdown** - request/trigger blocking of mobile-money & bank payments when over
  limit (via backend payment providers).
- **Screen time** - track time on apps/sites and block over the daily limit using
  **OS screen-time APIs**; request peer/parental unlock.
- **Approvals** - send override requests to peers/parents; receive decisions.
- **Dashboard** - savings, goals, and time-usage analytics.

---

## Structure

```
lib/
+-- main.dart
+-- config.dart          API base URL, build flags
+-- api/                 HTTP client + models
+-- features/
|   +-- auth/
|   +-- transactions/
|   +-- goals/
|   +-- limits/
|   +-- screentime/      OS API integration (platform channels)
|   +-- approvals/
|   `-- dashboard/
`-- shared/              widgets, theming, RWF formatting
```

---

## Platform integrations

- **OS screen-time:** Android `UsageStatsManager` + accessibility/app-blocking; iOS
  `FamilyControls` / `ScreenTime` - accessed through Flutter **platform channels**.
- **Mobile money / bank blocking:** performed server-side via the backend provider
  adapters; the app only initiates and displays status.

Footprint target (SRS section 3.2): roughly **0.2 GB** on device.
