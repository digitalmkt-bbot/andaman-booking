# ระบบจองรถและห้องประชุม · Vehicle & Meeting Room Booking System

ระบบจองวันและช่วงเวลาการใช้งานทรัพยากรภายในองค์กร (รถ 5 คัน + ห้องประชุม 1 ห้อง) ยืนยันการจองทันทีโดยไม่ต้องอนุมัติ พร้อมการตรวจสอบเวลาทับซ้อนแบบปลอดภัยต่อการแข่งขัน (transaction-safe).

A full-stack booking system for corporate resources (5 vehicles + 1 meeting room) with instant confirmation (no approval step) and transaction-safe overlap checking.

---

## Tech stack

| Layer | Technology |
|---|---|
| Backend | Node.js + Express, Prisma ORM, PostgreSQL, JWT auth, node-cron |
| Frontend | React + Vite, Tailwind CSS, React Router, TanStack Query, FullCalendar, Recharts, i18next (TH/EN) |
| Export | Excel (xlsx), PDF (jsPDF), CSV, Print |

---

## Quick start

Requires **Node.js 18+** (Node 20/22 recommended) and **PostgreSQL**.

```bash
# 1. Start a local PostgreSQL (or point DATABASE_URL at your own)
docker compose up -d

# 2. Install all dependencies (root + server + client workspaces)
npm install

# 3. Configure the backend environment
cp server/.env.example server/.env
#    edit server/.env — set JWT_SECRET (DATABASE_URL already points at the docker DB)

# 4. Set up the database: generate client, push schema, seed data
npm run setup

# 5. Run backend + frontend together (dev)
npm run dev
```

- Frontend (dev): http://localhost:5173
- Backend API: http://localhost:4000

**Deploying to Railway / GitHub?** See [DEPLOY.md](./DEPLOY.md).

### Production / single-server mode

Build the client once and the API server will serve it on one port:

```bash
npm run build     # builds client/dist
npm start         # serves API + UI at http://localhost:4000
```

### Demo accounts

| Role | Email | Password |
|---|---|---|
| Admin (ผู้ดูแลระบบ) | `admin@loveandaman.com` | `admin123` |
| User (ผู้ใช้งานทั่วไป) | `user@loveandaman.com` | `user123` |

Seeded resources: **Kia, BYD, Fortuner, Vios, Mirage** (vehicles) + **1 main meeting room**.

---

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Run backend + frontend concurrently |
| `npm run dev:server` | Backend only (`node --watch`) |
| `npm run dev:client` | Frontend only (Vite) |
| `npm run setup` | Prisma generate + migrate + seed |
| `npm run build` | Production build of the frontend |
| `npm start` | Run the backend in production mode |

---

## Features (mapped to the specification)

- **Auth & roles** — JWT login; `USER` and `ADMIN` roles.
- **Dashboard** (§3.1) — today's bookings, available/booked/in-use/disabled vehicles, room status, upcoming & current bookings.
- **Calendar** (§3.2) — month / week / day / resource-timeline views, filter by resource type; resource blocks shown in red.
- **Vehicle booking** (§5) — pick date/time range, see which of the 5 vehicles are free, choose one, add purpose, instant confirm.
- **Meeting-room booking** (§7) — single room auto-assigned; date + time window.
- **Recurring bookings** (§7.3) — daily / weekly / monthly with an end date. Validates **every** occurrence first; if any date conflicts, nothing is saved and the conflicting dates are returned.
- **Overlap checking** (§8) — half-open intervals: an existing `09:00–11:00` blocks `08:30–09:30`, `10:00–12:00`, etc., but allows `07:00–09:00` and `11:00–12:00`. Checked twice: on selection, then again inside a **serialized DB transaction** before insert (prevents double-booking under concurrency).
- **Booking statuses** (§9–10) — `CONFIRMED → ACTIVE → COMPLETED`, plus `CANCELLED` / `EXPIRED`. A `node-cron` job transitions statuses every minute and fires reminders. No check-in/check-out.
- **Edit / cancel** (§11–12) — owner before start time, admin anytime; cancel requires a reason; a cancelled slot is immediately re-bookable.
- **Resource blocks** (§13) — admin blocks a resource for a period (maintenance, cleaning, internal, etc.); affected booking owners are notified; blocked periods appear in the calendar and can't be booked.
- **Notifications** (§14) — in-app (always) + adapters for Email, LINE, Google Calendar, Outlook (enable via `.env`).
- **Reports** (§21) — per-vehicle counts/hours, most/least booked, by user/department/purpose, busiest hour for the room, cancellations. Export to Excel / PDF / CSV / Print.
- **Audit log** (§16) — every create/edit/cancel/admin action recorded with old/new values and IP.
- **Booking numbers** (§18) — `VEH-YYYYMM-0001`, `ROOM-YYYYMM-0001`, running per month, generated inside the transaction.
- **Bilingual UI** — Thai (default) + English, toggle in the top bar. Times shown in Asia/Bangkok.
- **Modern dashboard UI** — framed layout with a dark sidebar (icon nav, mini-calendar, today's bookings), stat cards, bar chart, utilization gauge, and a **light / dark mode** toggle.
- **Responsive** — works on desktop, tablet, and mobile.

---

## Booking rules enforced (§22)

No backdating · end must be after start · no overlapping the same resource · disabled/blocked resources can't be booked · users edit only their own · admin edits any · resource/date/time change re-checks availability · cancellation reason required · every change audited · concurrency-safe · cancelled slots freed immediately.

---

## External integrations

All optional and off by default. Set the relevant flags in `server/.env`:

| Channel | Enable flag | Extra install |
|---|---|---|
| Email (SMTP) | `EMAIL_ENABLED=true` | `npm i nodemailer -w server` |
| LINE Messaging API | `LINE_ENABLED=true` | — (uses fetch) |
| Google Calendar | `GOOGLE_CALENDAR_ENABLED=true` | `npm i googleapis -w server` |
| Microsoft Outlook | `OUTLOOK_ENABLED=true` | — (uses fetch / Graph) |

When a channel is disabled or its package isn't installed, the system logs a note and continues — in-app notifications always work.

---

## Switching to PostgreSQL

1. In `server/prisma/schema.prisma`, set `datasource db { provider = "postgresql" }`.
2. Set `DATABASE_URL` in `server/.env` to your Postgres connection string.
3. Run `npm run setup` again.

The overlap check runs inside a transaction. On Postgres, for very high concurrency consider a `SELECT ... FOR UPDATE` on the resource row or a `pg_advisory_xact_lock(resourceId)` at the start of the transaction (noted in `server/src/services/bookings.js`).

---

## Project structure

```
andaman-booking/
├── server/                     # Express + Prisma API
│   ├── prisma/
│   │   ├── schema.prisma        # 10 tables (§17)
│   │   ├── migrations/
│   │   └── seed.js              # 5 vehicles + 1 room + 2 users
│   └── src/
│       ├── index.js             # app entry
│       ├── config.js
│       ├── db.js                # prisma client + write serialization
│       ├── middleware/          # auth, audit, error
│       ├── utils/               # overlap, bookingNumber, recurrence
│       ├── services/            # bookings, scheduler, notifications/*
│       └── routes/              # auth, bookings, resources, blocks, users,
│                                #  departments, reports, notifications, audit, dashboard
└── client/                     # React + Vite SPA
    └── src/
        ├── pages/               # user + admin/* screens
        ├── components/          # Layout, BookingForm, ui
        ├── locales/             # th.js, en.js
        └── lib/                 # format, export
```

---

## API overview

`POST /api/auth/login` · `GET /api/dashboard` · `POST /api/bookings/availability` · `GET/POST /api/bookings` · `POST /api/bookings/recurring` · `PATCH /api/bookings/:id` · `POST /api/bookings/:id/cancel` · `GET /api/bookings/calendar` · `GET/POST/PATCH /api/resources...` · `GET/POST /api/blocks` · `GET/POST/PATCH /api/users` · `GET/POST/PATCH /api/departments` · `GET /api/reports/{vehicles,rooms,cancellations}` · `GET /api/notifications` · `GET /api/audit`
