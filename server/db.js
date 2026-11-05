// PostgreSQL access and schema migrations.
"use strict";
const { Pool, types } = require("pg");
types.setTypeParser(1082, (v) => v); // DATE stays "YYYY-MM-DD" (no timezone shift)

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set. Add a PostgreSQL service in Railway and reference its DATABASE_URL.");
}
const pool = new Pool({
  connectionString: url,
  max: Number(process.env.PG_POOL_MAX || 10),
  ssl: /sslmode=require/.test(url || "") ? { rejectUnauthorized: false } : undefined,
});

const q = (text, params) => pool.query(text, params);

async function tx(fn) {
  const c = await pool.connect();
  try {
    await c.query("BEGIN");
    const r = await fn((t, p) => c.query(t, p));
    await c.query("COMMIT");
    return r;
  } catch (e) {
    await c.query("ROLLBACK").catch(() => {});
    throw e;
  } finally {
    c.release();
  }
}

// Each migration runs once, in order. Never edit a shipped migration; append a new one.
const MIGRATIONS = [
  `CREATE TABLE IF NOT EXISTS users (
     id SERIAL PRIMARY KEY,
     role TEXT NOT NULL CHECK (role IN ('student','teacher','admin')),
     username TEXT UNIQUE,
     class_id INT,
     student_id TEXT,
     display_name TEXT NOT NULL DEFAULT '',
     pass_hash TEXT NOT NULL,
     created_at TIMESTAMPTZ NOT NULL DEFAULT now()
   );
   CREATE TABLE IF NOT EXISTS classes (
     id SERIAL PRIMARY KEY,
     code TEXT UNIQUE NOT NULL,
     name TEXT NOT NULL,
     level TEXT NOT NULL CHECK (level IN ('ปวช','ปวส')),
     teacher_id INT NOT NULL REFERENCES users(id),
     semester_start DATE,
     created_at TIMESTAMPTZ NOT NULL DEFAULT now()
   );
   CREATE UNIQUE INDEX IF NOT EXISTS users_class_student ON users(class_id, student_id) WHERE role='student';
   CREATE TABLE IF NOT EXISTS sessions (
     token TEXT PRIMARY KEY,
     user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
     expires_at TIMESTAMPTZ NOT NULL
   );
   CREATE TABLE IF NOT EXISTS projects (
     id SERIAL PRIMARY KEY,
     class_id INT NOT NULL REFERENCES classes(id),
     join_code TEXT UNIQUE NOT NULL,
     state JSONB NOT NULL,
     version INT NOT NULL DEFAULT 1,
     member_limit_override INT,
     updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
     updated_by INT REFERENCES users(id),
     created_at TIMESTAMPTZ NOT NULL DEFAULT now()
   );
   CREATE TABLE IF NOT EXISTS project_members (
     project_id INT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
     user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
     joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
     PRIMARY KEY (project_id, user_id)
   );
   CREATE TABLE IF NOT EXISTS project_revisions (
     id SERIAL PRIMARY KEY,
     project_id INT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
     version INT NOT NULL,
     state JSONB NOT NULL,
     user_id INT REFERENCES users(id),
     note TEXT,
     created_at TIMESTAMPTZ NOT NULL DEFAULT now()
   );
   CREATE INDEX IF NOT EXISTS project_revisions_p ON project_revisions(project_id, created_at DESC);
   CREATE TABLE IF NOT EXISTS files (
     id UUID PRIMARY KEY,
     project_id INT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
     user_id INT REFERENCES users(id),
     mime TEXT NOT NULL,
     width INT, height INT,
     bytes BYTEA NOT NULL,
     created_at TIMESTAMPTZ NOT NULL DEFAULT now()
   );`,
  // P1: teacher review workflow, KP.03/05/07 data, committee, comments
  `ALTER TABLE classes ADD COLUMN IF NOT EXISTS settings JSONB NOT NULL DEFAULT '{}'::jsonb;
   ALTER TABLE projects ADD COLUMN IF NOT EXISTS committee JSONB NOT NULL DEFAULT '[]'::jsonb;
   CREATE TABLE IF NOT EXISTS reviews (
     project_id INT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
     kind TEXT NOT NULL,
     data JSONB NOT NULL DEFAULT '{}'::jsonb,
     reviewer_id INT REFERENCES users(id),
     updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
     PRIMARY KEY (project_id, kind)
   );
   CREATE TABLE IF NOT EXISTS submissions (
     id SERIAL PRIMARY KEY,
     project_id INT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
     stage TEXT NOT NULL,
     status TEXT NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted','returned','approved')),
     note TEXT, reply TEXT,
     version INT,
     submitted_by INT REFERENCES users(id), submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
     reviewed_by INT REFERENCES users(id), reviewed_at TIMESTAMPTZ
   );
   CREATE INDEX IF NOT EXISTS submissions_p ON submissions(project_id, submitted_at DESC);
   CREATE TABLE IF NOT EXISTS comments (
     id SERIAL PRIMARY KEY,
     project_id INT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
     section TEXT NOT NULL,
     user_id INT REFERENCES users(id),
     body TEXT NOT NULL,
     resolved BOOLEAN NOT NULL DEFAULT false,
     created_at TIMESTAMPTZ NOT NULL DEFAULT now()
   );
   CREATE INDEX IF NOT EXISTS comments_p ON comments(project_id, created_at DESC);`,
  // Teacher can delete a group. It is kept (soft delete) so it can be restored; members become free to start or join another group.
  `ALTER TABLE projects ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
   ALTER TABLE projects ADD COLUMN IF NOT EXISTS deleted_by INT REFERENCES users(id);`,
  // Teacher can delete a student account (soft delete: login is blocked, the student ID can register again, the teacher can restore).
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
   DROP INDEX IF EXISTS users_class_student;
   CREATE UNIQUE INDEX IF NOT EXISTS users_class_student_live ON users(class_id, student_id) WHERE role='student' AND deleted_at IS NULL;`,
  // Files attached to a submission (students who write on a computer upload their own Word/PDF).
  `ALTER TABLE files ADD COLUMN IF NOT EXISTS submission_id INT REFERENCES submissions(id) ON DELETE CASCADE;
   ALTER TABLE files ADD COLUMN IF NOT EXISTS name TEXT;
   CREATE INDEX IF NOT EXISTS files_submission ON files(submission_id) WHERE submission_id IS NOT NULL;`,
  // Writing provenance: how much of each field was typed vs pasted, per student per day (no keystrokes or text are stored).
  `CREATE TABLE IF NOT EXISTS write_log (
     project_id INT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
     user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
     path TEXT NOT NULL,
     day DATE NOT NULL,
     typed INT NOT NULL DEFAULT 0,
     pasted INT NOT NULL DEFAULT 0,
     pastes INT NOT NULL DEFAULT 0,
     max_paste INT NOT NULL DEFAULT 0,
     PRIMARY KEY (project_id, user_id, path, day)
   );`,
  // cached plain text of uploaded documents, for the similarity check
  `ALTER TABLE files ADD COLUMN IF NOT EXISTS text TEXT;`,
];

async function migrate() {
  await q(`CREATE TABLE IF NOT EXISTS schema_migrations (n INT PRIMARY KEY, at TIMESTAMPTZ NOT NULL DEFAULT now())`);
  const done = new Set((await q("SELECT n FROM schema_migrations")).rows.map((r) => r.n));
  for (let i = 0; i < MIGRATIONS.length; i++) {
    if (done.has(i)) continue;
    await tx(async (t) => {
      await t(MIGRATIONS[i]);
      await t("INSERT INTO schema_migrations(n) VALUES ($1)", [i]);
    });
    console.log(`migration ${i} applied`);
  }
}

module.exports = { pool, q, tx, migrate };
