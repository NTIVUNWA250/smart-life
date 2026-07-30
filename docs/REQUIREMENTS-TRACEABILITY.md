# Requirements Traceability (SRS -> code)

Maps SMART LIFE SRS requirements to where they are (or will be) implemented.
Status: [ ] planned - [~] in progress - [x] done.

## Functional Requirements

| ID    | Requirement                                   | Implemented in                          | Status |
| ----- | --------------------------------------------- | --------------------------------------- | ------ |
| FR1   | Signup / login for users                      | `backend modules/auth` + web + mobile   | [x]      |
| FR2   | Input income, expenses, set goals             | `backend transactions/goals` + web + mobile | [x]  |
| FR3   | Calculate spending limits automatically       | `backend modules/limits` (monthly) + `finance.daily` (weekly-aware daily limit, weekend flex, heavy-expense lump) | [x] |
| FR4   | Lock expenses via provider APIs               | `backend modules/limits` + `providers/payment`; daily + monthly enforced server-side in `checkPayment`, called from `POST /transactions` so clients cannot bypass it | [x] |
| FR5   | Track & limit time on apps/sites              | `backend modules/screentime` (daily reset) + mobile `MethodChannel`. Android: app picker and `UsageStatsManager` measurement done, incl. the usage-access grant flow. **Blocking is not implemented on any platform** - Android needs an accessibility/overlay service, iOS needs all of `FamilyControls`/`ManagedSettings` | [~] |
| FR6   | Peer approval to unblock limits               | `backend approvals/peers` + web + mobile | [x]     |
| FR7   | Analytics dashboard (time + finances)         | `backend modules/analytics` + web + mobile | [x]   |

## Non-Functional Requirements

| ID    | Type            | Requirement                                  | Where                         | Status |
| ----- | --------------- | -------------------------------------------- | ----------------------------- | ------ |
| NFR1  | Security        | Authenticate users (JWT)                     | `backend/middleware/auth`     | [x]      |
| NFR2  | Performance     | Handle concurrent active users               | API + DB indexing (Prisma `@@index`) | [x] |
| NFR3  | Usability       | English UI, basic-skill friendly             | web + mobile                  | [x]      |
| NFR4  | Auditability    | Auditable, report generation                 | `lib/audit` writes + admin filter/summary + CSV export | [x] |
| NFR5  | Cross-browser   | Chrome + Edge                                | `web` (standard modern web)   | [x]      |
| NFR6  | Technology      | Web (PC) + Android/iOS                        | `web` + Flutter `mobile`      | [x]      |
| NFR7  | Data security   | ISO/IEC 27001 alignment, encryption          | `backend/lib/crypto` (AES-GCM)| [x]      |
| NFR8  | Currency        | All amounts in RWF                            | `backend/lib/money` + clients | [x]      |

> **NFR IDs are normalised.** The SRS draft had gaps and example rows; the canonical
> set is NFR1-NFR8 above. Mapping from the old SRS numbering to the normalised IDs:
>
> | Old SRS ref            | Normalised |
> | ---------------------- | ---------- |
> | Security / auth        | NFR1       |
> | Performance / scale    | NFR2       |
> | Usability              | NFR3       |
> | Auditability / reports | NFR4       |
> | Cross-browser          | NFR5       |
> | Platform coverage      | NFR6       |
> | Data security (ISO)    | NFR7       |
> | Currency (RWF)         | NFR8       |
>
> These IDs are final for the codebase; the SRS document should adopt this table.

## Constraints (SRS section 2.5)

- PostgreSQL only, **no Supabase** -> enforced by `backend` Prisma + provider choice.
- API dependencies (MoMo/Airtel/Bank/OS) -> abstracted in `backend/providers`.

## Verification (automated tests)

Backend logic is covered by the Vitest suite (`cd backend && npm test`) - 17 test
files / 100 tests, all passing:

- **Domain/finance:** `finance.budget`, `finance.daily`, `screentime.targets`,
  `timetable.schedule`
- **Limits (FR3/FR4):** `limits.enforcement` - the daily budget refusing an
  expense the monthly limit would still allow, cumulative same-day spend, and the
  rent-day headroom (persistence mocked, so no PostgreSQL needed)
- **Libraries:** `money`, `period` (+ goal helpers), `crypto` (AES-GCM), `audit`,
  `http-error`
- **Providers (FR4/FR5 boundary):** sandbox `payment`, `screentime`, `calendar`,
  and the `providers` block-all/unblock-all fan-out
- **Auth/validation:** `auth.schemas` (zod) and `app` integration (routing, JWT
  guard, 400/401/404 envelopes) - these run without a live PostgreSQL.

## Diagrams (docs/diagrams)

`flowchart`, `component-diagram`, `use-case-diagram`, `class-diagram`,
`sequence-diagram` (over-limit block -> peer-approved override, FR3/FR4/FR6), and
`deployment-diagram` (physical topology: clients -> web/API hosts -> managed
PostgreSQL -> external provider APIs). All are draw.io (`.drawio`) with legends.
