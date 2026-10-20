-- סכמת מסד הנתונים (Neon / Postgres) של "אימון פונקציונלי בבית".
-- בנוי בדומה לפרויקט "אתר חומרים לבגרות": משתמשים + מנויים + הגדרות.
-- אידמפוטנטי: אפשר להריץ שוב ושוב (npm run db:init) בלי לפגוע בנתונים קיימים.
-- כל פקודה מסתיימת ב-; בסוף שורה — הסקריפט מפצל לפיהן. אל תשימו ; בתוך מחרוזות/פונקציות.

-- משתמשים / מנויות
CREATE TABLE IF NOT EXISTS users (
  id                serial PRIMARY KEY,
  email             varchar(255) NOT NULL,
  password_hash     text,                                   -- null = התחברות דרך גוגל בלבד
  name              varchar(120) NOT NULL,
  first_name        varchar(60),
  last_name         varchar(60),
  phone             varchar(20),
  city              varchar(80),
  role              text NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  email_verified    boolean NOT NULL DEFAULT false,
  marketing_consent boolean NOT NULL DEFAULT false,
  terms_accepted_at timestamp,
  suspended         boolean NOT NULL DEFAULT false,
  suspend_reason    text,
  session_version   integer NOT NULL DEFAULT 1,             -- העלאה = ניתוק כל הסשנים
  last_seen_at      timestamp,
  notes             text,
  created_at        timestamp NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS users_email_idx ON users (lower(email));

-- מנויים / רכישות (שורה לכל רכישה; למנוי פעיל: status='active' ו-ends_at בעתיד או ריק)
CREATE TABLE IF NOT EXISTS subscriptions (
  id          serial PRIMARY KEY,
  user_id     integer NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  plan        varchar(30) NOT NULL,                         -- למשל: monthly / yearly — נקבע כשיוחלט על המסלולים
  amount      integer NOT NULL DEFAULT 0,                   -- בשקלים
  status      text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'cancelled', 'refunded', 'expired')),
  starts_at   timestamp NOT NULL DEFAULT now(),
  ends_at     timestamp,
  payment_ref varchar(120),
  notes       text,
  created_at  timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS subscriptions_user_idx ON subscriptions (user_id);
CREATE INDEX IF NOT EXISTS subscriptions_status_idx ON subscriptions (status, ends_at);

-- הגדרות האתר (מחירים וכו') כמפתח/ערך
CREATE TABLE IF NOT EXISTS settings (
  key        varchar(80) PRIMARY KEY,
  value      text NOT NULL,
  updated_at timestamp NOT NULL DEFAULT now()
);
