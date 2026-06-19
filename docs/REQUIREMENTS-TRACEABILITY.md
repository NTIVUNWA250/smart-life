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
| FR5   | Track & limit time on apps/sites              | `backend modules/screentime` + clients (native OS = stub) | ◑ |
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

> NFR IDs are normalised here; the SRS table had gaps/example rows that should be
> replaced with these in the final SRS document.

## Constraints (SRS §2.5)

- PostgreSQL only, **no Supabase** → enforced by `backend` Prisma + provider choice.
- API dependencies (MoMo/Airtel/Bank/OS) → abstracted in `backend/providers`.
