# SMART LIFE — Web

Next.js 15 (App Router) + TypeScript + Tailwind website for SMART LIFE.

The web app provides the **analytics dashboard, admin functions, and notifications**.
Per SRS §3.2, the desktop/web experience is **limited for money lockdowns** — those
actions push the user to the mobile app — but **peer approvers and admins have full
privileges** on the web.

---

## Requirements

- **Node.js** 20 LTS+ and npm
- A running backend API (see [../backend/README.md](../backend/README.md))

---

## Setup

```bash
npm install
cp .env.local.example .env.local      # set NEXT_PUBLIC_API_URL
npm run dev                           # http://localhost:3000
```

### Environment variables

| Variable               | Purpose                          |
| ---------------------- | -------------------------------- |
| `NEXT_PUBLIC_API_URL`  | Base URL of the backend API      |

---

## What lives here

- **Auth pages** — signup / login.
- **User dashboard** — savings & goal progress, spending vs. limits, time usage charts.
- **Approver views** — review and approve/deny override requests (full privileges).
- **Admin console** — manage users, data, and system settings (SRS §2.3 admin class).
- **AI Q&A / help** — in-app help and FAQ surface.

---

## Structure

```
app/             Next.js App Router routes
  (auth)/        login, signup
  dashboard/     user analytics
  approvals/     approver workflow
  admin/         admin console
components/      shared UI
lib/             API client, auth context, formatting (RWF)
```

---

## Cross-browser support (SRS §5, NFR)

Targets modern Chromium browsers — **Google Chrome** and **Microsoft Edge** — as the
primary supported browsers.
