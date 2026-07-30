# SMART LIFE

**Stop spending, start saving.**

SMART LIFE is a mobile- and web-based application that helps Rwandan students and
youth manage **money and time** in one place. It tracks income and expenses, enforces
savings goals, automatically blocks electronic payments when a user passes their
spending limit, limits social-media / screen time, and uses a **peer & parental
approval** system to unlock those limits. An analytics dashboard tracks progress on
financial and time goals.

This repository is the implementation of the SMART LIFE Software Requirements
Specification (SRS v1.0, Gilbert NTIVUNWA, ALU).

---

## Stack

| Layer              | Tech                                                        |
| ------------------ | ----------------------------------------------------------- |
| Backend / API      | Node.js + Express + TypeScript                              |
| Database           | PostgreSQL (via Prisma ORM) - **no Supabase** (SRS section 2.5)    |
| Auth               | JWT access/refresh tokens, bcrypt password hashing          |
| Website            | Next.js 15 (App Router) + TypeScript + Tailwind             |
| Mobile (iOS/And)   | Flutter (Android v10+ / iOS)                                |
| External providers | MTN MoMo, Airtel Money, Bank, OS screen-time, Google Calendar - behind an **adapter layer** with sandbox/mock implementations |

> **Why mock the external providers?** Mobile-money, bank, and OS screen-time APIs
> require commercial partnerships, signed agreements, and production credentials that
> are not available for a student build. Every external integration sits behind a
> provider interface (`backend/src/providers/`) so the **business logic is real and
> fully testable**, and the sandbox implementations can be swapped for live SDKs once
> credentials exist. See [docs/INTEGRATIONS.md](docs/INTEGRATIONS.md).

---

## Repository layout

```
saving-app/
+-- backend/    Node.js + Express + Prisma API (PostgreSQL)
+-- web/        Next.js website - user + admin dashboards
+-- mobile/     Flutter app (Android + iOS) - primary user experience
+-- docs/       Architecture, data model, API, integrations, SRS traceability
`-- README.md   (this file)
```

Each subdirectory has its own README with setup steps.

---

## Core features (from the SRS)

| # | Feature                       | Where enforced                          |
| - | ----------------------------- | --------------------------------------- |
| 1 | Signup / login                | `backend` auth, `web` + `mobile` UI     |
| 2 | Income & expense tracking     | `backend` transactions module           |
| 3 | Savings goals + deadlines     | `backend` goals module                  |
| 4 | Automatic spending-limit calc | `backend` limits service                |
| 5 | Payment blocking over limit   | `backend` payment-provider adapters     |
| 6 | Screen-time tracking & limits | `mobile` OS APIs + `backend` policies   |
| 7 | Peer / parental approval      | `backend` approvals module              |
| 8 | Analytics dashboard           | `web` + `mobile` dashboards             |

A full mapping of SRS requirement IDs (FR/NFR) to code lives in
[docs/REQUIREMENTS-TRACEABILITY.md](docs/REQUIREMENTS-TRACEABILITY.md).

---

## Quick start

```bash
# 1. Backend (needs a local PostgreSQL - see backend/README.md)
cd backend && npm install && npm run db:migrate && npm run dev   # http://localhost:4000

# 2. Website
cd web && npm install && npm run dev                              # http://localhost:3000

# 3. Mobile
cd mobile && flutter pub get && flutter run
```

See each subdirectory's README for prerequisites and environment variables.

---

## Documentation

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) - system overview & data flow
- [docs/DATA-MODEL.md](docs/DATA-MODEL.md) - database schema
- [docs/API.md](docs/API.md) - REST API reference
- [docs/INTEGRATIONS.md](docs/INTEGRATIONS.md) - external provider adapters
- [docs/REQUIREMENTS-TRACEABILITY.md](docs/REQUIREMENTS-TRACEABILITY.md) - SRS -> code
- [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) - free-tier hosting for web, API and Android

---

## User classes (SRS section 2.3)

- **Students / youth** - primary users; manage their own money and time.
- **Peer approvers** - friends/family who approve override requests; parental control
  for underage users.
- **Admins** - manage the system, user data, and configuration.

## Non-functional targets (SRS section 5)

- **Security:** HTTPS everywhere, JWT auth, encryption of peer/approval requests,
  alignment with ISO/IEC 27001 practices.
- **Performance:** support concurrent active users with sub-second API responses.
- **Usability:** English UI, basic-skill friendly, in-app help + AI Q&A.
- **Currency:** all monetary values in **Rwandan Francs (RWF)**.
