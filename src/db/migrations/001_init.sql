-- 001_init.sql
-- Core schema for Legends gym booking app

CREATE EXTENSION IF NOT EXISTS citext;   -- for case-insensitive email columns

-- ---------- People ----------

CREATE TABLE IF NOT EXISTS app_user (
    id              BIGSERIAL PRIMARY KEY,
    name            TEXT NOT NULL,
    email           CITEXT NOT NULL UNIQUE,
    password_hash   TEXT NOT NULL,
    phone           TEXT NOT NULL,
    role            TEXT NOT NULL default 'customer' CHECK(role IN ('admin','instructor','customer')),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);


-- ---------- Auth Tokens ----------
CREATE TABLE auth_token (
    id           BIGSERIAL PRIMARY KEY,
    app_user  BIGINT NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
    token_hash   TEXT NOT NULL UNIQUE,        -- sha256 of the raw token
    purpose      TEXT NOT NULL CHECK (purpose IN ('invite','password_reset')),
    expires_at   TIMESTAMPTZ NOT NULL,
    used_at      TIMESTAMPTZ,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------- Memberships ----------

CREATE TABLE IF NOT EXISTS membership_plan (
    id              BIGSERIAL PRIMARY KEY,
    name            TEXT NOT NULL,
    description     TEXT,
    image           TEXT,
    price           NUMERIC(10,2) NOT NULL CHECK (price >= 0),
    duration_days   INTEGER NOT NULL CHECK (duration_days > 0),
    class_credits   INTEGER, -- NULL = unlimited classes during the period
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ----------- Customer Memberships -------

CREATE TABLE IF NOT EXISTS customer_membership (
    id                  BIGSERIAL PRIMARY KEY,
    app_user            BIGINT NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
    plan_id             BIGINT NOT NULL REFERENCES membership_plan(id) ON DELETE RESTRICT,
    start_date          DATE NOT NULL,
    end_date            DATE NOT NULL,
    status              TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'cancelled')),
    credits_remaining   INTEGER NOT NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (app_user, plan_id, start_date, end_date)
);

CREATE INDEX IF NOT EXISTS idx_customer_membership_customer ON customer_membership(app_user);
CREATE INDEX IF NOT EXISTS idx_customer_membership_plan ON customer_membership(plan_id);

-- ---------- Class Type ---------------

CREATE TABLE IF NOT EXISTS class_type(
    id              BIGSERIAL PRIMARY KEY,
    name            TEXT NOT NULL,
    description     TEXT,
    image           TEXT NOT NULL,
    credit          BOOLEAN NOT NULL DEFAULT FALSE,
    active          BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------- Class ----------

CREATE TABLE IF NOT EXISTS class (
    id                  BIGSERIAL PRIMARY KEY,
    class_type          BIGINT NOT NULL REFERENCES class_type(id),      -- if a class type is not active cancel active classes.
    status              TEXT NOT NULL DEFAULT 'active' CHECK (status in ('active','cancelled','expired')),
    start_time          TIME NOT NULL,
    end_time            TIME NOT NULL,
    class_date          DATE NOT NULL,           
    capacity            INTEGER NOT NULL CHECK (capacity > 0),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (class_type, class_date, start_time)
);

-- ---------- Enrollment ----------

CREATE TABLE IF NOT EXISTS enrollment (
    id                  BIGSERIAL PRIMARY KEY,
    class            BIGINT NOT NULL REFERENCES class(id),
    app_user            BIGINT NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
    status              TEXT NOT NULL DEFAULT 'enrolled' CHECK (status in ('enrolled', 'unenrolled', 'cancelled')),
    enrolled_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    unenrolled_at       TIMESTAMPTZ,
    cancelled_by_admin  BOOLEAN NOT NULL DEFAULT FALSE,
    -- a customer can re-enroll after cancelling, but only one ACTIVE enrollment per class
    UNIQUE (class, app_user)
);

CREATE INDEX IF NOT EXISTS idx_enrollment_class ON enrollment(class);
CREATE INDEX IF NOT EXISTS idx_enrollment_customer ON enrollment(app_user);

-- ------------Notification --------

CREATE TABLE IF NOT EXISTS notification(
    id              BIGSERIAL PRIMARY KEY,
    body            JSON NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ------------- Notification logs --------

CREATE TABLE IF NOT EXISTS notification_log (
    id                      BIGSERIAL PRIMARY KEY ,
    app_user             BIGINT REFERENCES app_user(id) ON DELETE CASCADE,
    notification_id         BIGINT REFERENCES notification(id) ON DELETE CASCADE,
    status                  TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
    error_message           TEXT,
    sent_at                 TIMESTAMPTZ,
    read_at                 TIMESTAMPTZ,
    UNIQUE (app_user, notification_id)
);

CREATE INDEX IF NOT EXISTS idx_notification_log_customer ON notification_log(app_user);

--  ------------ Push Notifications ----------

CREATE TABLE IF NOT EXISTS push_notification(
    id  BIGSERIAL PRIMARY KEY,
    app_user BIGINT REFERENCES app_user(id) ON DELETE CASCADE,
    endpoint TEXT NOT NULL UNIQUE,
    public_key TEXT NOT NULL,
    auth_secret TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (app_user, endpoint)
);