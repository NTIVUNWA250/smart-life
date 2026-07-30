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

| Provider     | Live API                          | Status                                              |
| ------------ | --------------------------------- | --------------------------------------------------- |
| MTN MoMo     | MTN MoMo Open API (Collections)   | **live adapter** — `providers/live/payment.momo.ts` |
| Airtel Money | Airtel Africa API                 | sandbox stub                                        |
| Bank         | Bank-specific API (per partner)   | sandbox stub                                        |

> Real mobile-money APIs do **not** expose a generic "freeze this user's wallet"
> primitive. In `live` mode, blocking is approximated by withholding payment
> authorisation / disabling outbound transfers initiated through SMART LIFE. The exact
> capability depends on each partner agreement — documented per adapter.

### MTN MoMo setup

```bash
# 1. Subscribe to "Collections" at https://momodeveloper.mtn.com, copy the Primary Key
# 2. backend/.env:  MOMO_SUBSCRIPTION_KEY=<primary key>
cd backend && npm run momo:provision   # creates a sandbox API user + key, then verifies both
# 3. Paste the printed MOMO_API_USER / MOMO_API_KEY into .env and set PROVIDER_MODE=live
```

`momo:provision` refuses to run unless `MOMO_TARGET_ENVIRONMENT=sandbox`: the
apiuser/apikey endpoints exist only on the sandbox host, and production credentials
are issued by MTN during onboarding.

**What the adapter actually does.** MTN cannot freeze a wallet, so `block`/`unblock`
remain a SMART LIFE decision held in memory, exactly as in the stub — and, as before,
`limits.checkPayment` is the real enforcement. What MTN *can* answer is whether an
MSISDN is a live account holder, so `authorize` calls
`GET /collection/v1_0/accountholder/msisdn/{msisdn}/active` and refuses payments
aimed at an unknown or inactive wallet. The OAuth token from `POST /collection/token/`
is cached until 60s before expiry and dropped on a 401.

**Failure policy: fail open.** If MTN is unreachable or answers 5xx, `authorize`
allows the payment and logs `payment.momo.unreachable`. The budget rules have already
been applied server-side by then, so failing closed would only mean an MTN outage
stops students recording spending they genuinely made. A 404 is a *verdict*, not a
failure, and does refuse.

**Linking a wallet.** `PATCH /api/v1/auth/me` accepts `momoMsisdn` (digits only, in
international format, e.g. `250788123456`; explicit `null` unlinks). It is stored
AES-GCM encrypted in `User.momoMsisdnEnc` (NFR7) and audited as `auth.momo.linked` /
`auth.momo.unlinked` — without recording the number itself. A user with no linked
wallet is never sent to MTN at all.

**The response shape, verified against the live host.** `/active` answers **200 with
`{"result":true}`** — *not* the bare `true` MTN's documentation examples show. The
adapter parses the envelope, the bare boolean and an empty body, because a 200 it
cannot parse is a worse reason to refuse a payment than trusting the status code.
This was found only by pointing a real key at the sandbox: the unit tests and the
adapter had agreed on the documented shape, so every active account read as inactive
and every linked user's payment would have been refused, with 12 green tests.

**Sandbox caveats.** Confirmed by running against it, rather than assumed:

- The Collections balance is reported in **EUR**, not RWF, and can be negative.
- `/active` returns `true` for **any** well-formed Rwandan MSISDN — the sandbox has
  no notion of an unknown subscriber, so the "unrecognised number is refused" path
  cannot be demonstrated there. It is reachable only via a 404 from the real host.
- A non-Rwandan MSISDN returns **500 `NOT_ALLOWED_TARGET_ENVIRONMENT`**, not a 404,
  and so takes the fail-open path rather than being refused.
- `GET /collection/v1_0/account/balance` returns 503 intermittently. `momo:provision`
  treats it as a warning, never fatal — it is a diagnostic, and the access token
  already proves the credentials work.

So the sandbox proves the integration works; it does not prove any particular Rwandan
number behaves this way.

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
