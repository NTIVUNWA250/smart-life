# Architecture

SMART LIFE is a three-tier system: **mobile + web clients → REST API → PostgreSQL**,
with external integrations isolated behind a provider/adapter layer.

```
┌─────────────┐     ┌─────────────┐
│  Mobile     │     │  Web        │
│  (Flutter)  │     │  (Next.js)  │
└──────┬──────┘     └──────┬──────┘
       │  HTTPS / JSON (JWT)│
       └─────────┬──────────┘
                 ▼
        ┌──────────────────┐
        │  Backend API     │   Express + TypeScript
        │  ┌────────────┐  │
        │  │ services   │  │   auth, transactions, goals,
        │  │            │  │   limits, approvals, screentime, analytics
        │  ├────────────┤  │
        │  │ providers  │──┼──▶ MTN MoMo / Airtel / Bank  (payment block)
        │  │ (adapters) │──┼──▶ OS screen-time policies
        │  │            │──┼──▶ Google Calendar
        │  └────────────┘  │
        └────────┬─────────┘
                 ▼
        ┌──────────────────┐
        │   PostgreSQL     │   (Prisma)
        └──────────────────┘
```

## Principles

- **Server-authoritative limits.** Spending limits and block decisions are computed
  and enforced on the backend so they can't be bypassed by tampering with a client.
- **Adapters isolate the unknown.** Every third-party API is behind an interface with
  a sandbox implementation, so the app is fully runnable and testable without
  commercial credentials.
- **Mobile-first enforcement.** Money lockdown and screen-time blocking require
  OS/mobile-money access and therefore happen via the mobile app; web is for
  analytics, approvals, and admin (SRS §3.2).

## Request flow (example: payment over limit)

1. User attempts a payment; mobile reports intent to the backend.
2. `limits` service compares projected spend vs. the user's computed limit.
3. If over limit → `payment` provider issues a **block**; an `approval` request is
   created and routed to the user's peer/parent.
4. Approver accepts/denies (web or mobile) → backend unblocks or holds.
5. Dashboard reflects the event.
