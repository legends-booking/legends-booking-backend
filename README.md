# Legends Booking — Backend & Database

Node.js (Express) + PostgreSQL backend for the gym booking app.

## Prerequisites

- Node.js 18+
- Docker (Postgres runs in a container; the API runs on the host)

## 1. Start PostgreSQL

```bash
docker compose up -d
```

Stop with `docker compose down` (add `-v` only if you also want to wipe the data volume).

The `.env.example` values match this service. If the database is missing later, `npm run migrate` will create it.

## 2. Configure environment

```bash
cp .env.example .env
```

Set a real `JWT_SECRET`. The Postgres settings can stay as-is for `docker compose`.

| Variable | Purpose |
|---|---|
| `PORT` | API port (default `4000`) |
| `JWT_SECRET` | Signing key for auth tokens |
| `JWT_EXPIRES_IN` | Token lifetime (default `7d`) |
| `PGHOST` / `PGPORT` / `PGDATABASE` / `PGUSER` / `PGPASSWORD` | Postgres connection |
| `PGADMIN_DATABASE` | Optional; DB used to auto-create `PGDATABASE` (default `postgres`) |

## 3. Install dependencies

```bash
npm install
```

## 4. Run migrations

```bash
npm run migrate
```

This creates the `PGDATABASE` database if it doesn’t exist yet, then applies pending
SQL migrations (tables: `appUsers`, `auth_token`, `membership_plan`, `customer_membership`,
`class_type`, `class`, `enrollment`, `notification`, `notification_log` plus `schema_migrations`).
Re-running is safe — already-applied files are skipped.

To add a new migration later, drop a new numbered file (e.g. `002_add_something.sql`)
into `src/db/migrations/` and run `npm run migrate` again.

## 5. Create your first admin

```bash
ADMIN_EMAIL=you@yourgym.com ADMIN_PASSWORD=pick-something-strong npm run seed
```

## 6. Start the server

```bash
npm run dev    # with nodemon, auto-restarts on file changes
# or
npm start
```

Server runs on `http://localhost:4000` by default. Check it's alive:

```bash
curl http://localhost:4000/health
```

## API overview

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/auth/signup` | — | Customer self sign-up |
| POST | `/auth/login` | — | Customer login |
| POST | `/auth/admin/login` | — | Admin login |
| GET | `/classes` | — | List upcoming classes |
| GET | `/classes/:id` | — | Class detail |
| POST | `/classes` | admin | Create a class |
| PATCH | `/classes/:id` | admin | Edit a class |
| DELETE | `/classes/:id` | admin | Remove a class |
| GET | `/enrollments/me` | customer | My active enrollments |
| POST | `/enrollments/:classId` | customer | Enroll in a class |
| DELETE | `/enrollments/:classId` | customer | Unsubscribe from a class |
| GET | `/memberships/plans` | — | List membership plans |
| POST | `/memberships/plans` | admin | Create a plan |
| PATCH | `/memberships/plans/:id` | admin | Edit a plan |
| POST | `/memberships/customers/:id/assign` | admin | Assign a plan to a member |
| GET | `/admin/members` | admin | List all members |
| POST | `/admin/members` | admin | Add a member directly |

All authenticated routes expect `Authorization: Bearer <token>`, where the token comes
back from a login/signup call.

## Notes on design choices

- **UUID primary keys** (`gen_random_uuid()`) rather than serial ints — easier to merge
  data later and safer to expose in URLs.
- **`citext` for emails** so lookups/uniqueness are case-insensitive automatically.
- **Enrollment capacity check uses `SELECT ... FOR UPDATE`** inside a transaction, so two
  people tapping "enroll" on the last spot at the same instant can't both get in.
- **Cancel-then-re-enroll** is handled with `ON CONFLICT ... DO UPDATE` on the
  `(class_id, customer_id)` unique constraint, rather than allowing duplicate rows.
- **Push notifications aren't wired up yet** — `push_tokens` and `notification_log`
  tables exist so the schema is ready, but the Expo push integration is a separate
  next step once the mobile app registers tokens.

## What's next

- Add a route for customers to register/update their Expo push token.
- Add an Expo push sender (triggered e.g. when a class is about to start, or cancelled).
- Add refresh tokens / token revocation if you want logout-everywhere support.
- Add pagination to `/classes` and `/admin/members` once data volume grows.
