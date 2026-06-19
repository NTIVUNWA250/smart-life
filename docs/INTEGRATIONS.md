# External Integrations

Every third-party dependency sits behind a TypeScript interface in
`backend/src/providers/`. The active implementation is chosen by `PROVIDER_MODE`:

- `sandbox` (default) — in-memory fakes. The app runs end-to-end with **no external
  accounts**, and tests are deterministic.
- `live` — real SDK/HTTP implementations, configured by provider credentials in `.env`.

This keeps the SMART LIFE business logic real and testable today, while leaving a clean
seam to plug in production APIs once partnerships/credentials exist.

## Payment providers (block / unblock spending)

Interface: `PaymentProvider { block(userId), unblock(userId), status(userId) }`

| Provider     | Live API                          | Status            |
| ------------ | --------------------------------- | ----------------- |
| MTN MoMo     | MTN MoMo Open API                 | sandbox stub      |
| Airtel Money | Airtel Africa API                 | sandbox stub      |
| Bank         | Bank-specific API (per partner)   | sandbox stub      |

> Real mobile-money APIs do **not** expose a generic "freeze this user's wallet"
> primitive. In `live` mode, blocking is approximated by withholding payment
> authorisation / disabling outbound transfers initiated through SMART LIFE. The exact
> capability depends on each partner agreement — documented per adapter.

## Screen-time provider

Interface: `ScreenTimeProvider { getUsage(userId), enforceBlock(policy) }`

- **Android:** `UsageStatsManager` for usage; app-blocking via an accessibility
  service / device admin.
- **iOS:** `FamilyControls` + `ManagedSettings` (Screen Time API).
- Enforcement runs on the **mobile device**; the backend stores policies and usage
  reported by the app.

## Calendar provider

Interface: `CalendarProvider { createEvent(...), listEvents(...) }`
- **Google Calendar API** for schedule planning (SRS §3.3). Sandbox returns an
  in-memory calendar.

## Adding a live provider

1. Implement the interface under `providers/<domain>/live/`.
2. Register it in the provider factory keyed by `PROVIDER_MODE=live`.
3. Add credentials to `.env.example` and the README env table.
4. Keep the sandbox version — it stays the default for tests and local dev.
