# Deploy — GitHub + Railway

This project is production-ready for [Railway](https://railway.app). The Express
server serves both the REST API and the built React client on a single port, and
uses **PostgreSQL** (provided by Railway).

---

## 1. Push to GitHub

From the project root:

```bash
git init
git add .
git commit -m "Andaman booking system"
git branch -M main

# Create an empty repo on github.com first (no README), then:
git remote add origin https://github.com/<your-username>/andaman-booking.git
git push -u origin main
```

(If you have the GitHub CLI: `gh repo create andaman-booking --private --source=. --push`.)

---

## 2. Deploy on Railway

1. Go to **railway.app → New Project → Deploy from GitHub repo** and pick the repo.
2. In the project, click **New → Database → Add PostgreSQL**. Railway creates a
   `DATABASE_URL` for it.
3. Open your **app service → Variables** and add:

   | Variable | Value |
   |---|---|
   | `DATABASE_URL` | `${{ Postgres.DATABASE_URL }}` (reference the Postgres service) |
   | `JWT_SECRET` | a long random string |
   | `TZ` | `Asia/Bangkok` |

   (Railway sets `PORT` automatically — the app reads it.)
4. Railway reads `railway.json`:
   - **Build:** `npm run build` (generates Prisma client + builds the React app)
   - **Start:** `npm run start:prod` (pushes the DB schema, seeds base data, starts the server)
5. First deploy will create the tables and seed the admin/user accounts and the
   5 vehicles + 1 meeting room. Open the generated URL and log in.

### Demo accounts (created by the seed)

| Role | Email | Password |
|---|---|---|
| Admin | `admin@loveandaman.com` | `admin123` |
| User | `user@loveandaman.com` | `user123` |

> Change these after first login (Profile → Change password), or edit
> `server/prisma/seed.js` before deploying.

---

## 3. Local development (with Docker Postgres)

```bash
docker compose up -d          # starts PostgreSQL on localhost:5432
cp server/.env.example server/.env
npm install
npm run setup                 # prisma generate + db push + seed
npm run dev                   # client :5173  ·  api :4000
```

No Docker? Point `DATABASE_URL` in `server/.env` at any PostgreSQL instance and
run `npm run setup`.

---

## Notes

- **Single service**: the server serves `client/dist`, so Railway needs only one
  web service + one Postgres database.
- **Schema sync**: deploys use `prisma db push` (no migration files to manage).
  For a stricter migration workflow, switch to `prisma migrate deploy` and commit
  a `prisma/migrations` folder generated against PostgreSQL.
- **Seed on boot** is idempotent (upserts) — safe to re-run on every deploy. To
  load richer demo bookings locally, run `node server/prisma/demo.js`.
- **Integrations** (Email/LINE/Google/Outlook) stay disabled until you set their
  env flags — see `server/.env.example`.
