# Requirements Traceability (SRS → code)

Maps SMART LIFE SRS requirements to where they are (or will be) implemented.
Status: ☐ planned · ◑ in progress · ☑ done.

## Functional Requirements

| ID    | Requirement                                   | Implemented in                          | Status |
| ----- | --------------------------------------------- | --------------------------------------- | ------ |
| FR1   | Signup / login for users                      | `backend modules/auth` + web + mobile   | ☑      |
| FR2   | Input income, expenses, set goals             | `backend transactions/goals` + web + mobile | ☑  |
| FR3   | Calculate spending limits automatically       | `backend modules/limits`                | ☑      |
| FR4   | Lock expenses via provider APIs               | `backend modules/limits` + `providers/payment` | ☑ |
| FR5   | Track & limit time on apps/sites              | `backend modules/screentime` (daily reset) + mobile `MethodChannel` boundary. Android app-picker native bridge done; usage/enforcement native OS modules (Android `UsageStatsManager` + accessibility service, iOS `FamilyControls`/`ManagedSettings`) pending | ◑ |
| FR6   | Peer approval to unblock limits               | `backend approvals/peers` + web + mobile | ☑     |
| FR7   | Analytics dashboard (time + finances)         | `backend modules/analytics` + web + mobile | ☑   |

## Non-Functional Requirements

| ID    | Type            | Requirement                                  | Where                         | Status |
| ----- | --------------- | -------------------------------------------- | ----------------------------- | ------ |
| NFR1  | Security        | Authenticate users (JWT)                     | `backend/middleware/auth`     | ☑      |
| NFR2  | Performance     | Handle concurrent active users               | API + DB indexing (Prisma `@@index`) | ☑ |
| NFR3  | Usability       | English UI, basic-skill friendly             | web + mobile                  | ☑      |
| NFR4  | Auditability    | Auditable, report generation                 | `lib/audit` writes + admin filter/summary + CSV export | ☑ |
| NFR5  | Cross-browser   | Chrome + Edge                                | `web` (standard modern web)   | ☑      |
| NFR6  | Technology      | Web (PC) + Android/iOS                        | `web` + Flutter `mobile`      | ☑      |
| NFR7  | Data security   | ISO/IEC 27001 alignment, encryption          | `backend/lib/crypto` (AES-GCM)| ☑      |
| NFR8  | Currency        | All amounts in RWF                            | `backend/lib/money` + clients | ☑      |

> **NFR IDs are normalised.** The SRS draft had gaps and example rows; the canonical
> set is NFR1–NFR8 above. Mapping from the old SRS numbering to the normalised IDs:
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

## Constraints (SRS §2.5)

- PostgreSQL only, **no Supabase** → enforced by `backend` Prisma + provider choice.
- API dependencies (MoMo/Airtel/Bank/OS) → abstracted in `backend/providers`.

## Verification (automated tests)

Backend logic is covered by the Vitest suite (`cd backend && npm test`) — 16 test
files / 89 tests, all passing:

- **Domain/finance:** `finance.budget`, `finance.daily`, `screentime.targets`,
  `timetable.schedule`
- **Libraries:** `money`, `period` (+ goal helpers), `crypto` (AES-GCM), `audit`,
  `http-error`
- **Providers (FR4/FR5 boundary):** sandbox `payment`, `screentime`, `calendar`,
  and the `providers` block-all/unblock-all fan-out
- **Auth/validation:** `auth.schemas` (zod) and `app` integration (routing, JWT
  guard, 400/401/404 envelopes) — these run without a live PostgreSQL.

## Diagrams (docs/diagrams)

`flowchart`, `component-diagram`, `use-case-diagram`, `class-diagram`,
`sequence-diagram` (over-limit block → peer-approved override, FR3/FR4/FR6), and
`deployment-diagram` (physical topology: clients → web/API hosts → managed
PostgreSQL → external provider APIs). All are draw.io (`.drawio`) with legends.
