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
Edit the .env file - update ADMIN values.
```bash
npm run seed
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
| GET | `/health` | — | Liveness check (`{ "status": "ok" }`) |
| POST | `/auth/signup` | — | Customer self sign-up (`name`, `email`, `password`; optional `phone`, `role`). Returns `{ user, token }` |
| POST | `/auth/login` | — | Login with `email` and `password`. Returns `{ user, token }` |
| POST | `/auth/set-password` | — | Set password using an invite `token` and new `password` |
| GET | `/members` | admin | List members. Optional query: `userRole` (`admin` / `instructor` / `customer`) |
| POST | `/members` | admin | Front-desk add member (`name`, `email`, `phone`). Returns `{ user, token }` where `token` is a one-day invite |

All authenticated routes expect `Authorization: Bearer <token>`. Login and signup return a JWT
(expires in `JWT_EXPIRES_IN`, default 7 days). `/members` requires an admin JWT.

Invite flow: `POST /members` creates the user with a random unusable password and an invite
token (valid 1 day). The member then calls `POST /auth/set-password` with that token.

