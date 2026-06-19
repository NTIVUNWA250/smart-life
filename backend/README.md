# SMART LIFE — Backend API

Node.js + Express + TypeScript REST API backed by **PostgreSQL** (via Prisma).
This is the single source of truth for users, transactions, goals, spending limits,
approvals, and the external-provider adapters that block payments and screen time.

> Database constraint (SRS §2.5): **PostgreSQL only — no Supabase.**

---

## Requirements

- **Node.js** 20 LTS+ and npm
- **PostgreSQL** 15+ running locally (or a connection string to a remote instance)

Verify:

```bash
node --version
psql --version
```

---

## Setup

```bash
npm install
cp .env.example .env        # then edit values (see below)
npm run db:migrate          # apply Prisma migrations
npm run db:seed             # optional: demo users + data
npm run dev                 # http://localhost:4000
```

### Environment variables (`.env`)

| Variable                | Purpose                                            |
| ----------------------- | -------------------------------------------------- |
| `DATABASE_URL`          | PostgreSQL connection string                       |
| `JWT_ACCESS_SECRET`     | Signing secret for short-lived access tokens       |
| `JWT_REFRESH_SECRET`    | Signing secret for refresh tokens                  |
| `PORT`                  | API port (default `4000`)                          |
| `PROVIDER_MODE`         | `sandbox` (default) or `live` — selects adapters   |
| `MOMO_*`, `AIRTEL_*`    | Mobile-money credentials (only needed in `live`)   |

---

## Architecture

```
src/
├── index.ts            App entry / Express bootstrap
├── routes/             HTTP routes (thin)
├── controllers/        Request handling + validation
├── services/           Business logic (limits, goals, approvals)
├── providers/          External-API adapters (sandbox + live)
│   ├── payment/        MTN MoMo, Airtel Money, Bank — block/unblock
│   ├── screentime/     OS-level screen-time policies
│   └── calendar/       Google Calendar scheduling
├── middleware/         Auth (JWT), error handling, rate limiting
├── prisma/             schema.prisma + migrations
└── lib/                shared utils (crypto, logging, money/RWF)
```

**Provider adapter pattern:** every external integration implements a TypeScript
interface (e.g. `PaymentProvider.block(userId)`). `PROVIDER_MODE=sandbox` wires up
in-memory fakes so the whole app runs and is testable with **no external accounts**;
`live` swaps in the real SDK implementations. See
[../docs/INTEGRATIONS.md](../docs/INTEGRATIONS.md).

---

## Key modules

- **auth** — signup/login, JWT issue/refresh, password reset, role (`student`,
  `approver`, `admin`).
- **transactions** — income/expense entry, categorisation, balances.
- **goals** — savings goals with target amount + deadline, progress tracking.
- **limits** — computes spending limits from income/goals; triggers payment blocking.
- **approvals** — peer/parental requests to unlock a spending or screen-time limit.
- **screentime** — daily app/website limits and block policies (synced from mobile).
- **analytics** — aggregates for the dashboards.

---

## Scripts

| Command              | Description                          |
| -------------------- | ------------------------------------ |
| `npm run dev`        | Start with hot reload                |
| `npm run build`      | Compile TypeScript                   |
| `npm start`          | Run compiled build                   |
| `npm run db:migrate` | Apply Prisma migrations              |
| `npm run db:seed`    | Seed demo data                       |
| `npm test`           | Run test suite                       |
| `npm run lint`       | Lint                                 |

---

## Security (SRS §5.3)

- All traffic over **HTTPS** in deployment.
- **JWT** access + refresh tokens; passwords hashed with bcrypt.
- Approval/peer requests encrypted at rest.
- Input validation on every endpoint; rate limiting on auth routes.
- Aligns with **ISO/IEC 27001** data-security practices.
