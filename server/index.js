// ProjectElec server: accounts, projects with revision history, image files, and document export.
"use strict";
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const express = require("express");
const { q, tx, migrate } = require("./db");
const A = require("./auth");
const docgen = require("./docgen");
const SIM = require("./similarity");
const E = require("../public/shared/engine.js");

const PORT = Number(process.env.PORT) || 3000;
const PROD = process.env.NODE_ENV === "production" || !!process.env.RAILWAY_ENVIRONMENT;
const app = express();
app.set("trust proxy", 1);
app.disable("x-powered-by");

app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("X-Frame-Options", "SAMEORIGIN");
  next();
});
app.get("/healthz", (_req, res) => res.type("text").send("ok"));
app.use("/api", express.json({ limit: "3mb" }), A.loadUser);

const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const bad = (res, msg, status = 400) => res.status(status).json({ error: msg });
const code6 = () => Array.from(crypto.randomBytes(6), (b) => "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"[b % 32]).join("");
const limitFor = (level, override) => override || (level === "ปวส" ? 2 : 3); // คู่มือ หน้า 4: ปวช. ≤ 3, ปวส. ≤ 2

/* ---------------- auth ---------------- */
app.post("/api/auth/teacher/register", wrap(async (req, res) => {
  const { inviteCode, username, displayName, password } = req.body || {};
  const want = process.env.TEACHER_INVITE_CODE;
  if (!want) return bad(res, "ผู้ดูแลยังไม่ได้ตั้ง TEACHER_INVITE_CODE บนเซิร์ฟเวอร์");
  if (inviteCode !== want) return bad(res, "รหัสเชิญครูไม่ถูกต้อง", 403);
  if (!/^[a-z0-9._-]{3,32}$/i.test(username || "")) return bad(res, "ชื่อผู้ใช้ต้องเป็นอักษรอังกฤษหรือตัวเลข 3–32 ตัว");
  if (String(password || "").length < 8) return bad(res, "รหัสผ่านต้องยาวอย่างน้อย 8 ตัวอักษร");
  const r = await q("INSERT INTO users(role,username,display_name,pass_hash) VALUES ('teacher',lower($1),$2,$3) ON CONFLICT (username) DO NOTHING RETURNING id",
    [username, String(displayName || username).slice(0, 80), A.hashPassword(password)]);
  if (!r.rows[0]) return bad(res, "ชื่อผู้ใช้นี้ถูกใช้แล้ว", 409);
  await A.createSession(res, r.rows[0].id, PROD);
  res.json({ ok: true });
}));

app.post("/api/auth/teacher/login", wrap(async (req, res) => {
  const { username, password } = req.body || {};
  const key = "t:" + String(username).toLowerCase();
  if (A.tooMany(key)) return bad(res, "ลองผิดหลายครั้งเกินไป รอ 10 นาทีแล้วลองใหม่", 429);
  const u = (await q("SELECT id,pass_hash FROM users WHERE role IN ('teacher','admin') AND username=lower($1)", [username])).rows[0];
  if (!u || !A.verifyPassword(password, u.pass_hash)) { A.noteFail(key); return bad(res, "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง", 401); }
  A.clearFail(key);
  await A.createSession(res, u.id, PROD);
  res.json({ ok: true });
}));

async function classByCode(code) {
  return (await q("SELECT * FROM classes WHERE code=upper($1)", [String(code || "").trim()])).rows[0];
}

app.post("/api/auth/student/register", wrap(async (req, res) => {
  const { classCode, studentId, displayName, password } = req.body || {};
  const c = await classByCode(classCode);
  if (!c) return bad(res, "ไม่พบรหัสห้องนี้ ตรวจสอบกับครูผู้สอน", 404);
  const sid = String(studentId || "").replace(/\s/g, "");
  if (!/^[0-9A-Za-z-]{4,20}$/.test(sid)) return bad(res, "รหัสนักศึกษาไม่ถูกต้อง");
  if (String(password || "").length < 6) return bad(res, "รหัสผ่านต้องยาวอย่างน้อย 6 ตัวอักษร");
  if (!String(displayName || "").trim()) return bad(res, "กรุณากรอกชื่อ-นามสกุล");
  const r = await q(`INSERT INTO users(role,class_id,student_id,display_name,pass_hash) VALUES ('student',$1,$2,$3,$4)
                     ON CONFLICT DO NOTHING RETURNING id`, [c.id, sid, String(displayName).trim().slice(0, 80), A.hashPassword(password)]);
  if (!r.rows[0]) return bad(res, "รหัสนักศึกษานี้ลงทะเบียนในห้องนี้แล้ว ใช้เมนูเข้าสู่ระบบ หรือให้ครูรีเซ็ตรหัสผ่าน", 409);
  await A.createSession(res, r.rows[0].id, PROD);
  res.json({ ok: true });
}));

app.post("/api/auth/student/login", wrap(async (req, res) => {
  const { classCode, studentId, password } = req.body || {};
  const key = "s:" + String(classCode).toUpperCase() + ":" + studentId;
  if (A.tooMany(key)) return bad(res, "ลองผิดหลายครั้งเกินไป รอ 10 นาทีแล้วลองใหม่", 429);
  const c = await classByCode(classCode);
  const u = c && (await q("SELECT id,pass_hash FROM users WHERE role='student' AND class_id=$1 AND student_id=$2 AND deleted_at IS NULL", [c.id, String(studentId || "").replace(/\s/g, "")])).rows[0];
  if (!u || !A.verifyPassword(password, u.pass_hash)) { A.noteFail(key); return bad(res, "รหัสห้อง รหัสนักศึกษา หรือรหัสผ่านไม่ถูกต้อง", 401); }
  A.clearFail(key);
  await A.createSession(res, u.id, PROD);
  res.json({ ok: true });
}));

app.post("/api/auth/logout", wrap(async (req, res) => { await A.destroySession(req, res); res.json({ ok: true }); }));

app.get("/api/me", wrap(async (req, res) => {
  if (!req.user) return res.json({ user: null });
  const u = req.user;
  const out = { user: u };
  if (u.role === "student") {
    out.class = (await q("SELECT id,code,name,level,semester_start FROM classes WHERE id=$1", [u.class_id])).rows[0];
    out.projects = (await q(`SELECT p.id, p.state->'info'->>'titleTh' AS title, p.updated_at FROM projects p JOIN project_members m ON m.project_id=p.id
                             WHERE m.user_id=$1 AND p.deleted_at IS NULL ORDER BY p.updated_at DESC`, [u.id])).rows;
  } else {
    out.classes = (await q(`SELECT c.*, (SELECT count(*) FROM projects p WHERE p.class_id=c.id AND p.deleted_at IS NULL)::int AS projects,
                            (SELECT count(*) FROM users s WHERE s.class_id=c.id AND s.role='student' AND s.deleted_at IS NULL)::int AS students
                            FROM classes c WHERE c.teacher_id=$1 OR $2 ORDER BY c.created_at DESC`, [u.id, u.role === "admin"])).rows;
  }
  res.json(out);
}));

/* ---------------- classes (teacher) ---------------- */
app.post("/api/classes", A.need("teacher", "admin"), wrap(async (req, res) => {
  const { name, level, semesterStart } = req.body || {};
  if (!String(name || "").trim()) return bad(res, "กรุณาตั้งชื่อห้อง");
  if (!["ปวช", "ปวส"].includes(level)) return bad(res, "เลือกระดับ ปวช. หรือ ปวส.");
  for (let i = 0; i < 5; i++) {
    const r = await q("INSERT INTO classes(code,name,level,teacher_id,semester_start) VALUES ($1,$2,$3,$4,$5) ON CONFLICT (code) DO NOTHING RETURNING *",
      [code6(), String(name).trim().slice(0, 80), level, req.user.id, semesterStart || null]);
    if (r.rows[0]) return res.json(r.rows[0]);
  }
  bad(res, "สร้างรหัสห้องไม่สำเร็จ ลองใหม่", 500);
}));

async function teacherClass(req, classId) {
  const c = (await q("SELECT * FROM classes WHERE id=$1", [classId])).rows[0];
  if (!c) return null;
  if (req.user.role === "admin" || c.teacher_id === req.user.id) return c;
  return null;
}

app.get("/api/classes/:id", A.need("teacher", "admin"), wrap(async (req, res) => {
  const c = await teacherClass(req, req.params.id);
  if (!c) return bad(res, "ไม่พบห้องนี้", 404);
  const projects = (await q(`SELECT p.id, p.version, p.updated_at, p.member_limit_override, p.join_code, p.state, p.deleted_at
                             FROM projects p WHERE p.class_id=$1 ORDER BY p.updated_at DESC`, [c.id])).rows;
  const members = (await q(`SELECT m.project_id, u.id, u.display_name, u.student_id FROM project_members m JOIN users u ON u.id=m.user_id
                            JOIN projects p ON p.id=m.project_id WHERE p.class_id=$1`, [c.id])).rows;
  const students = (await q("SELECT id, display_name, student_id, created_at, deleted_at FROM users WHERE role='student' AND class_id=$1 ORDER BY deleted_at NULLS FIRST, student_id", [c.id])).rows;
  const pend = (await q("SELECT s.project_id, s.stage FROM submissions s JOIN projects p ON p.id=s.project_id WHERE p.class_id=$1 AND s.status='submitted'", [c.id])).rows;
  res.json({
    class: c,
    students,
    projects: projects.map((p) => ({
      id: p.id, version: p.version, updated_at: p.updated_at, join_code: p.join_code, deleted_at: p.deleted_at,
      limit: limitFor(c.level, p.member_limit_override),
      title: (p.state.info && p.state.info.titleTh) || "",
      progress: progressOf(p.state),
      members: members.filter((m) => m.project_id === p.id),
      pending: pend.filter((x) => x.project_id === p.id).map((x) => x.stage),
    })),
  });
}));

app.patch("/api/classes/:id", A.need("teacher", "admin"), wrap(async (req, res) => {
  const c = await teacherClass(req, req.params.id);
  if (!c) return bad(res, "ไม่พบห้องนี้", 404);
  const { name, semesterStart } = req.body || {};
  const r = await q("UPDATE classes SET name=COALESCE($2,name), semester_start=COALESCE($3,semester_start) WHERE id=$1 RETURNING *",
    [c.id, name ? String(name).slice(0, 80) : null, semesterStart || null]);
  res.json(r.rows[0]);
}));

app.post("/api/classes/:id/students/:uid/reset-password", A.need("teacher", "admin"), wrap(async (req, res) => {
  const c = await teacherClass(req, req.params.id);
  if (!c) return bad(res, "ไม่พบห้องนี้", 404);
  const pw = String((req.body || {}).password || "");
  if (pw.length < 6) return bad(res, "รหัสผ่านใหม่ต้องยาวอย่างน้อย 6 ตัวอักษร");
  const r = await q("UPDATE users SET pass_hash=$3 WHERE id=$1 AND class_id=$2 AND role='student' RETURNING id", [req.params.uid, c.id, A.hashPassword(pw)]);
  if (!r.rows[0]) return bad(res, "ไม่พบนักเรียน", 404);
  await q("DELETE FROM sessions WHERE user_id=$1", [req.params.uid]);
  res.json({ ok: true });
}));

// Writing provenance for one project: totals per field and member, and a per-day timeline.
// Visible to the class teacher and to the group's own members (students see what the teacher sees).
app.get("/api/projects/:id/provenance", wrap(async (req, res) => {
  const a = await access(req, req.params.id);
  if (!a) return bad(res, "ไม่พบโครงงาน", 404);
  const rows = (await q(`SELECT w.path, w.user_id, u.display_name, sum(w.typed)::int AS typed, sum(w.pasted)::int AS pasted, sum(w.pastes)::int AS pastes,
                                max(w.max_paste)::int AS max_paste, count(DISTINCT w.day)::int AS days, min(w.day) AS first_day, max(w.day) AS last_day
                         FROM write_log w JOIN users u ON u.id=w.user_id WHERE w.project_id=$1 GROUP BY w.path, w.user_id, u.display_name`, [a.p.id])).rows;
  const days = (await q(`SELECT day, sum(typed)::int AS typed, sum(pasted)::int AS pasted FROM write_log WHERE project_id=$1 GROUP BY day ORDER BY day`, [a.p.id])).rows;
  res.json({ rows, days, since: (await q("SELECT min(day) AS d FROM write_log WHERE project_id=$1", [a.p.id])).rows[0].d });
}));

// Similarity check of the group's own text, or of one uploaded file, against every other group in the system,
// their uploaded files and the sample project. Students see sources anonymised (no other group's name or text).
function simOut(req, a, r) {
  if (a.teacher) return r;
  let n = 0; const alias = new Map();
  r.sources.forEach((s) => { if (s.kind !== "example") alias.set(s.key, `งานของกลุ่มอื่นในระบบ #${++n}`); });
  r.sources = r.sources.map((s) => ({ ...s, label: alias.get(s.key) || s.label, project: undefined, file: undefined }));
  return r;
}
app.get("/api/projects/:id/similarity", wrap(async (req, res) => {
  const a = await access(req, req.params.id);
  if (!a) return bad(res, "ไม่พบโครงงาน", 404);
  const r = await SIM.check(q, SIM.stateBlocks(a.p.state), { excludeProject: a.p.id });
  res.json(simOut(req, a, r));
}));
app.get("/api/files/:id/similarity", wrap(async (req, res) => {
  if (!/^[0-9a-f-]{36}$/.test(req.params.id)) return bad(res, "ไม่พบไฟล์", 404);
  const f = (await q("SELECT id, project_id, name, mime, text, bytes FROM files WHERE id=$1 AND submission_id IS NOT NULL", [req.params.id])).rows[0];
  const a = f && (await access(req, f.project_id));
  if (!a) return bad(res, "ไม่พบไฟล์", 404);
  let text = f.text;
  if (text == null) { text = await SIM.fileText(f.mime, f.bytes); await q("UPDATE files SET text=$2 WHERE id=$1", [f.id, text]); }
  if (!text.trim()) return bad(res, "อ่านข้อความจากไฟล์นี้ไม่ได้ (รองรับ PDF ที่เป็นข้อความ, Word และ PowerPoint — ไฟล์สแกนหรือรูปภาพอ่านไม่ได้)", 422);
  const blocks = text.split(/\n{2,}/).reduce((acc, p) => { const last = acc[acc.length - 1]; if (last && last.text.length < 1500) last.text += "\n\n" + p; else acc.push({ id: "f" + acc.length, label: "", text: p }); return acc; }, []);
  const r = await SIM.check(q, blocks, { excludeProject: f.project_id, excludeFile: f.id });
  r.file = { id: f.id, name: f.name };
  res.json(simOut(req, a, r));
}));

// Delete a student (teacher of the class): blocks login, takes the student out of their group (the group keeps its work)
// and frees the student ID so it can register again. Restorable while that ID has not registered again.
app.delete("/api/classes/:id/students/:uid", A.need("teacher", "admin"), wrap(async (req, res) => {
  const c = await teacherClass(req, req.params.id);
  if (!c) return bad(res, "ไม่พบห้องนี้", 404);
  const out = await tx(async (t) => {
    const u = (await t("UPDATE users SET deleted_at=now() WHERE id=$1 AND class_id=$2 AND role='student' AND deleted_at IS NULL RETURNING id, student_id, display_name", [req.params.uid, c.id])).rows[0];
    if (!u) return null;
    await t("DELETE FROM sessions WHERE user_id=$1", [u.id]);
    const ps = (await t("DELETE FROM project_members WHERE user_id=$1 RETURNING project_id", [u.id])).rows;
    for (const { project_id } of ps) {
      const p = (await t("SELECT state, version FROM projects WHERE id=$1 FOR UPDATE", [project_id])).rows[0];
      const st = p.state; st.members = (st.members || []).filter((m) => !(m.sid && m.sid === u.student_id));
      await t("UPDATE projects SET state=$2, version=version+1, updated_at=now(), updated_by=$3 WHERE id=$1", [project_id, st, req.user.id]);
      await t("INSERT INTO project_revisions(project_id,version,state,user_id,note) VALUES ($1,$2,$3,$4,$5)", [project_id, p.version + 1, st, req.user.id, `ครูลบนักเรียน ${u.display_name} ออกจากกลุ่ม`]);
    }
    return u;
  });
  if (!out) return bad(res, "ไม่พบนักเรียน", 404);
  res.json({ ok: true });
}));
app.post("/api/classes/:id/students/:uid/restore", A.need("teacher", "admin"), wrap(async (req, res) => {
  const c = await teacherClass(req, req.params.id);
  if (!c) return bad(res, "ไม่พบห้องนี้", 404);
  try {
    const r = await q("UPDATE users SET deleted_at=NULL WHERE id=$1 AND class_id=$2 AND role='student' AND deleted_at IS NOT NULL RETURNING id", [req.params.uid, c.id]);
    if (!r.rows[0]) return bad(res, "ไม่พบนักเรียน", 404);
  } catch (e) {
    if (e.code === "23505") return bad(res, "กู้คืนไม่ได้ เพราะรหัสนักศึกษานี้ลงทะเบียนใหม่แล้ว", 409);
    throw e;
  }
  res.json({ ok: true, note: "กู้คืนบัญชีแล้ว นักเรียนต้องสร้างหรือเข้าร่วมกลุ่มใหม่" });
}));

// Delete a group (teacher of the class). Soft delete: the work stays in the database and can be restored.
app.delete("/api/projects/:id", A.need("teacher", "admin"), wrap(async (req, res) => {
  const a = await access(req, req.params.id);
  if (!a || !a.teacher) return bad(res, "ไม่พบโครงงานนี้", 404);
  await q("UPDATE projects SET deleted_at=now(), deleted_by=$2 WHERE id=$1 AND deleted_at IS NULL", [a.p.id, req.user.id]);
  res.json({ ok: true });
}));
app.post("/api/projects/:id/restore", A.need("teacher", "admin"), wrap(async (req, res) => {
  const a = await access(req, req.params.id);
  if (!a || !a.teacher) return bad(res, "ไม่พบโครงงานนี้", 404);
  // A member who has since started or joined another group would end up in two groups.
  const busy = (await q(`SELECT u.display_name FROM project_members m JOIN users u ON u.id=m.user_id
                         JOIN project_members m2 ON m2.user_id=m.user_id JOIN projects x ON x.id=m2.project_id
                         WHERE m.project_id=$1 AND x.id<>$1 AND x.class_id=$2 AND x.deleted_at IS NULL`, [a.p.id, a.p.class_id])).rows;
  if (busy.length) return bad(res, `กู้คืนไม่ได้ เพราะ ${busy.map((b) => b.display_name).join(", ")} อยู่ในกลุ่มใหม่แล้ว`, 409);
  await q("UPDATE projects SET deleted_at=NULL, deleted_by=NULL WHERE id=$1", [a.p.id]);
  res.json({ ok: true });
}));

app.patch("/api/projects/:id/member-limit", A.need("teacher", "admin"), wrap(async (req, res) => {
  const p = (await q("SELECT class_id FROM projects WHERE id=$1", [req.params.id])).rows[0];
  if (!p || !(await teacherClass(req, p.class_id))) return bad(res, "ไม่พบโครงงาน", 404);
  const n = (req.body || {}).override;
  const v = n === null || n === "" ? null : Math.max(1, Math.min(6, Number(n) || 0)) || null;
  await q("UPDATE projects SET member_limit_override=$2 WHERE id=$1", [req.params.id, v]);
  res.json({ ok: true, override: v });
}));

/* ---------------- projects ---------------- */
function progressOf(s) {
  const f = (v) => (Array.isArray(v) ? v.length > 0 : v != null && String(v).trim() !== "");
  const kp01 = [s.info && s.info.titleTh, s.info && s.info.innov, s.info && (s.info.types || []), ...(s.ch1 ? s.ch1.bg : []), s.ch1 && s.ch1.spec,
    s.ch1 && s.ch1.sampleN, s.ch1 && (s.ch1.terms || []).filter((t) => t && f(t.d)), s.ch1 && (s.ch1.benefits || []).filter(f),
    (s.budget || []).filter((r) => r && f(r.item)), s.principle];
  // a new project starts with default rows (budget, terms) — they only count once something is written in them
  const done = kp01.filter(f).length;
  return { kp01: Math.round((done / kp01.length) * 100) };
}

async function access(req, projectId) {
  const p = (await q("SELECT p.*, c.level, c.teacher_id FROM projects p JOIN classes c ON c.id=p.class_id WHERE p.id=$1", [projectId])).rows[0];
  if (!p || !req.user) return null;
  if (req.user.role === "admin" || (req.user.role === "teacher" && p.teacher_id === req.user.id)) return { p, write: false, teacher: true };
  if (req.user.role === "student") {
    if (p.deleted_at) return null;
    const m = (await q("SELECT 1 FROM project_members WHERE project_id=$1 AND user_id=$2", [projectId, req.user.id])).rows[0];
    if (m) return { p, write: true, teacher: false };
  }
  return null;
}

function addMemberToState(state, user) {
  state.members = Array.isArray(state.members) ? state.members : [];
  if (state.members.some((m) => m.sid && m.sid === user.student_id)) return state;
  const empty = state.members.findIndex((m) => !m.first && !m.last && !m.sid);
  const parts = String(user.display_name).trim().split(/\s+/);
  const entry = { prefix: "", first: parts[0] || "", last: parts.slice(1).join(" "), nameEn: "", sid: user.student_id, phone: "", email: "", address: "", photo: null };
  if (empty >= 0) state.members[empty] = Object.assign(state.members[empty], entry);
  else state.members.push(entry);
  return state;
}

app.post("/api/projects", A.need("student"), wrap(async (req, res) => {
  const existing = (await q("SELECT project_id FROM project_members m JOIN projects p ON p.id=m.project_id WHERE m.user_id=$1 AND p.class_id=$2 AND p.deleted_at IS NULL",
    [req.user.id, req.user.class_id])).rows[0];
  if (existing) return res.json({ id: existing.project_id, existing: true });
  const c = (await q("SELECT * FROM classes WHERE id=$1", [req.user.class_id])).rows[0];
  let state = req.body && req.body.state && typeof req.body.state === "object" ? Object.assign(E.blank(), req.body.state) : E.blank();
  state.example = false;
  state.info.level = c.level;
  if (c.semester_start) state.startDate = String(c.semester_start);
  addMemberToState(state, req.user);
  const id = await tx(async (t) => {
    let r;
    for (let i = 0; i < 5 && !r; i++) {
      r = (await t("INSERT INTO projects(class_id,join_code,state,updated_by) VALUES ($1,$2,$3,$4) ON CONFLICT (join_code) DO NOTHING RETURNING id",
        [c.id, code6(), state, req.user.id])).rows[0];
    }
    await t("INSERT INTO project_members(project_id,user_id) VALUES ($1,$2)", [r.id, req.user.id]);
    await t("INSERT INTO project_revisions(project_id,version,state,user_id,note) VALUES ($1,1,$2,$3,'สร้างโครงงาน')", [r.id, state, req.user.id]);
    return r.id;
  });
  res.json({ id });
}));

app.post("/api/projects/join", A.need("student"), wrap(async (req, res) => {
  const code = String((req.body || {}).joinCode || "").trim().toUpperCase();
  const out = await tx(async (t) => {
    const p = (await t("SELECT p.*, c.level FROM projects p JOIN classes c ON c.id=p.class_id WHERE p.join_code=$1 AND p.deleted_at IS NULL FOR UPDATE OF p", [code])).rows[0];
    if (!p) return { err: "ไม่พบรหัสกลุ่มนี้", status: 404 };
    if (p.class_id !== req.user.class_id) return { err: "รหัสกลุ่มนี้อยู่คนละห้องกับคุณ", status: 403 };
    const mine = (await t("SELECT 1 FROM project_members m JOIN projects x ON x.id=m.project_id WHERE m.user_id=$1 AND x.class_id=$2 AND x.deleted_at IS NULL", [req.user.id, p.class_id])).rows[0];
    if (mine) return { err: "คุณอยู่ในกลุ่มโครงงานอื่นของห้องนี้แล้ว", status: 409 };
    const n = (await t("SELECT count(*)::int AS n FROM project_members WHERE project_id=$1", [p.id])).rows[0].n;
    const lim = limitFor(p.level, p.member_limit_override);
    if (n >= lim) return { err: `กลุ่มนี้มีสมาชิกครบ ${lim} คนแล้ว (คู่มือกำหนด ${p.level}. ไม่เกิน ${lim} คน) ถ้าได้รับอนุมัติให้เกิน ให้ครูปรับค่าในระบบ`, status: 409 };
    await t("INSERT INTO project_members(project_id,user_id) VALUES ($1,$2)", [p.id, req.user.id]);
    const state = addMemberToState(p.state, req.user);
    await t("UPDATE projects SET state=$2, version=version+1, updated_at=now(), updated_by=$3 WHERE id=$1", [p.id, state, req.user.id]);
    return { id: p.id };
  });
  if (out.err) return bad(res, out.err, out.status);
  res.json(out);
}));

app.get("/api/projects/:id", wrap(async (req, res) => {
  const a = await access(req, req.params.id);
  if (!a) return bad(res, "ไม่พบโครงงาน หรือคุณไม่ได้อยู่ในกลุ่มนี้", 404);
  const members = (await q("SELECT u.id,u.display_name,u.student_id FROM project_members m JOIN users u ON u.id=m.user_id WHERE m.project_id=$1 ORDER BY m.joined_at", [a.p.id])).rows;
  const reviews = (await q("SELECT kind, data, updated_at FROM reviews WHERE project_id=$1", [a.p.id])).rows;
  const submissions = (await q(`SELECT s.*, u.display_name AS by_name, r.display_name AS reviewer_name FROM submissions s LEFT JOIN users u ON u.id=s.submitted_by
                                LEFT JOIN users r ON r.id=s.reviewed_by WHERE s.project_id=$1 ORDER BY s.submitted_at DESC LIMIT 50`, [a.p.id])).rows;
  const att = (await q(`SELECT f.id, f.submission_id, f.name, f.mime, octet_length(f.bytes)::int AS size, f.created_at, (u.role <> 'student') AS by_teacher
                         FROM files f LEFT JOIN users u ON u.id=f.user_id WHERE f.project_id=$1 AND f.submission_id IS NOT NULL ORDER BY f.created_at`, [a.p.id])).rows;
  for (const s of submissions) s.files = att.filter((f) => f.submission_id === s.id).map(({ submission_id, ...f }) => f);
  const comments = (await q(`SELECT c.id, c.section, c.body, c.resolved, c.created_at, u.display_name, u.role FROM comments c LEFT JOIN users u ON u.id=c.user_id
                             WHERE c.project_id=$1 ORDER BY c.created_at DESC LIMIT 300`, [a.p.id])).rows;
  res.json({ id: a.p.id, version: a.p.version, state: a.p.state, joinCode: a.write ? a.p.join_code : undefined, members, committee: a.p.committee,
    reviews, submissions, comments, teacherView: a.teacher, deletedAt: a.p.deleted_at, class_id: a.p.class_id,
    limit: limitFor(a.p.level, a.p.member_limit_override), level: a.p.level, canWrite: a.write, updatedAt: a.p.updated_at });
}));

// Save with optimistic versioning. On a version clash the server applies only the paths this client changed
// onto the newest copy (field-level merge), so two members editing different questions never overwrite each other.
app.put("/api/projects/:id", A.need("student"), wrap(async (req, res) => {
  const a = await access(req, req.params.id);
  if (!a || !a.write) return bad(res, "ไม่มีสิทธิ์แก้ไขโครงงานนี้", 403);
  const { baseVersion, state, changed, baseVals, wlog } = req.body || {};
  if (!state || typeof state !== "object") return bad(res, "ข้อมูลไม่ครบ");
  const out = await tx(async (t) => {
    const cur = (await t("SELECT version, state, updated_at FROM projects WHERE id=$1 FOR UPDATE", [a.p.id])).rows[0];
    let next = state, merged = false; const conflicts = [];
    if (Number(baseVersion) !== cur.version) {
      if (!Array.isArray(changed)) return { conflict: true, version: cur.version, state: cur.state };
      next = JSON.parse(JSON.stringify(cur.state));
      const same = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
      for (const p of changed.slice(0, 2000)) {
        if (typeof p !== "string" || /__proto__|constructor|prototype/.test(p)) continue;
        // someone else changed this same field since our base: keep their text in the revision history, never drop it silently
        if (baseVals && Object.prototype.hasOwnProperty.call(baseVals, p)) {
          const theirs = E.getPath(cur.state, p);
          if (!same(theirs, baseVals[p]) && !same(theirs, E.getPath(state, p))) conflicts.push(p);
        }
        E.setPath(next, p, E.getPath(state, p));
      }
      merged = true;
      if (conflicts.length) await t("INSERT INTO project_revisions(project_id,version,state,user_id,note) VALUES ($1,$2,$3,$4,$5)",
        [a.p.id, cur.version, cur.state, req.user.id, `ฉบับก่อนรวม: มีการแก้ช่องเดียวกันพร้อมกัน ${conflicts.length} ช่อง`]);
    }
    const v = cur.version + 1;
    await t("UPDATE projects SET state=$2, version=$3, updated_at=now(), updated_by=$4 WHERE id=$1", [a.p.id, next, v, req.user.id]);
    const last = (await t("SELECT created_at FROM project_revisions WHERE project_id=$1 ORDER BY created_at DESC LIMIT 1", [a.p.id])).rows[0];
    if (!last || Date.now() - new Date(last.created_at).getTime() > 10 * 60e3 || merged) {
      await t("INSERT INTO project_revisions(project_id,version,state,user_id,note) VALUES ($1,$2,$3,$4,$5)",
        [a.p.id, v, next, req.user.id, merged ? "รวมการแก้ไขจากสมาชิกหลายคน" : null]);
    }
    // writing provenance counters (typed / pasted characters per field), sent alongside the save
    if (Array.isArray(wlog)) for (const w of wlog.slice(0, 300)) {
      if (!w || typeof w.p !== "string" || w.p.length > 120 || /__proto__|constructor|prototype/.test(w.p)) continue;
      const n = (x) => Math.max(0, Math.min(1e6, Math.round(Number(x) || 0)));
      if (!n(w.typed) && !n(w.pasted)) continue;
      await t(`INSERT INTO write_log(project_id,user_id,path,day,typed,pasted,pastes,max_paste) VALUES ($1,$2,$3,(now() AT TIME ZONE 'Asia/Bangkok')::date,$4,$5,$6,$7)
               ON CONFLICT (project_id,user_id,path,day) DO UPDATE SET typed=write_log.typed+EXCLUDED.typed, pasted=write_log.pasted+EXCLUDED.pasted,
               pastes=write_log.pastes+EXCLUDED.pastes, max_paste=GREATEST(write_log.max_paste,EXCLUDED.max_paste)`,
        [a.p.id, req.user.id, w.p, n(w.typed), n(w.pasted), n(w.pastes), n(w.maxPaste)]);
    }
    return { version: v, merged, conflicts, state: merged ? next : undefined };
  });
  if (out.conflict) return res.status(409).json(out);
  res.json(out);
}));

app.get("/api/projects/:id/revisions", wrap(async (req, res) => {
  const a = await access(req, req.params.id);
  if (!a) return bad(res, "ไม่พบโครงงาน", 404);
  const r = await q(`SELECT r.id, r.version, r.note, r.created_at, u.display_name FROM project_revisions r LEFT JOIN users u ON u.id=r.user_id
                     WHERE r.project_id=$1 ORDER BY r.created_at DESC LIMIT 100`, [a.p.id]);
  res.json(r.rows);
}));

app.post("/api/projects/:id/revisions/:rid/restore", A.need("student"), wrap(async (req, res) => {
  const a = await access(req, req.params.id);
  if (!a || !a.write) return bad(res, "ไม่มีสิทธิ์", 403);
  const r = (await q("SELECT state, version FROM project_revisions WHERE id=$1 AND project_id=$2", [req.params.rid, a.p.id])).rows[0];
  if (!r) return bad(res, "ไม่พบฉบับนี้", 404);
  const out = await tx(async (t) => {
    const cur = (await t("SELECT version, state FROM projects WHERE id=$1 FOR UPDATE", [a.p.id])).rows[0];
    await t("INSERT INTO project_revisions(project_id,version,state,user_id,note) VALUES ($1,$2,$3,$4,'ก่อนย้อนกลับ')", [a.p.id, cur.version, cur.state, req.user.id]);
    const v = cur.version + 1;
    await t("UPDATE projects SET state=$2, version=$3, updated_at=now(), updated_by=$4 WHERE id=$1", [a.p.id, r.state, v, req.user.id]);
    await t("INSERT INTO project_revisions(project_id,version,state,user_id,note) VALUES ($1,$2,$3,$4,$5)", [a.p.id, v, r.state, req.user.id, `ย้อนกลับไปฉบับ ${r.version}`]);
    return { version: v, state: r.state };
  });
  res.json(out);
}));

/* ---------------- review workflow ---------------- */
const STAGES = ["kp01", "p50", "p70", "p90", "final"];
app.post("/api/projects/:id/submissions", A.need("student"), wrap(async (req, res) => {
  const a = await access(req, req.params.id);
  if (!a || !a.write) return bad(res, "ไม่มีสิทธิ์", 403);
  const { stage, note } = req.body || {};
  if (!STAGES.includes(stage)) return bad(res, "ไม่รู้จักขั้นตอนนี้");
  const open = (await q("SELECT id FROM submissions WHERE project_id=$1 AND stage=$2 AND status='submitted'", [a.p.id, stage])).rows[0];
  if (open) return bad(res, "ส่งขั้นตอนนี้ไปแล้ว รอครูตรวจ", 409);
  const r = await q("INSERT INTO submissions(project_id,stage,note,version,submitted_by) VALUES ($1,$2,$3,$4,$5) RETURNING *",
    [a.p.id, stage, String(note || "").slice(0, 1000), a.p.version, req.user.id]);
  res.json(r.rows[0]);
}));
app.patch("/api/submissions/:sid", A.need("teacher", "admin"), wrap(async (req, res) => {
  const s0 = (await q("SELECT s.*, p.class_id FROM submissions s JOIN projects p ON p.id=s.project_id WHERE s.id=$1", [req.params.sid])).rows[0];
  if (!s0 || !(await teacherClass(req, s0.class_id))) return bad(res, "ไม่พบ", 404);
  const { status, reply } = req.body || {};
  if (!["returned", "approved"].includes(status)) return bad(res, "สถานะไม่ถูกต้อง");
  const r = await q("UPDATE submissions SET status=$2, reply=$3, reviewed_by=$4, reviewed_at=now() WHERE id=$1 RETURNING *", [s0.id, status, String(reply || "").slice(0, 2000), req.user.id]);
  res.json(r.rows[0]);
}));
app.post("/api/projects/:id/comments", wrap(async (req, res) => {
  const a = await access(req, req.params.id);
  if (!a) return bad(res, "ไม่พบโครงงาน", 404);
  const { section, body } = req.body || {};
  if (!String(body || "").trim()) return bad(res, "พิมพ์ความเห็นก่อน");
  const r = await q("INSERT INTO comments(project_id,section,user_id,body) VALUES ($1,$2,$3,$4) RETURNING id", [a.p.id, String(section || "general").slice(0, 40), req.user.id, String(body).slice(0, 3000)]);
  res.json(r.rows[0]);
}));
app.patch("/api/comments/:cid", wrap(async (req, res) => {
  const c = (await q("SELECT project_id FROM comments WHERE id=$1", [req.params.cid])).rows[0];
  if (!c || !(await access(req, c.project_id))) return bad(res, "ไม่พบ", 404);
  await q("UPDATE comments SET resolved=$2 WHERE id=$1", [req.params.cid, !!(req.body || {}).resolved]);
  res.json({ ok: true });
}));
const REVIEW_KINDS = ["kp03", "kp05_1", "kp05_2", "kp07"];
app.put("/api/projects/:id/reviews/:kind", A.need("teacher", "admin"), wrap(async (req, res) => {
  const a = await access(req, req.params.id);
  if (!a || !a.teacher) return bad(res, "ไม่มีสิทธิ์", 403);
  if (!REVIEW_KINDS.includes(req.params.kind)) return bad(res, "ไม่รู้จักแบบฟอร์มนี้");
  const data = (req.body || {}).data || {};
  await q(`INSERT INTO reviews(project_id,kind,data,reviewer_id,updated_at) VALUES ($1,$2,$3,$4,now())
           ON CONFLICT (project_id,kind) DO UPDATE SET data=EXCLUDED.data, reviewer_id=EXCLUDED.reviewer_id, updated_at=now()`, [a.p.id, req.params.kind, data, req.user.id]);
  res.json({ ok: true });
}));
app.put("/api/projects/:id/committee", A.need("teacher", "admin"), wrap(async (req, res) => {
  const a = await access(req, req.params.id);
  if (!a || !a.teacher) return bad(res, "ไม่มีสิทธิ์", 403);
  const c = ((req.body || {}).committee || []).slice(0, 3).map((x) => String(x || "").slice(0, 80));
  await q("UPDATE projects SET committee=$2 WHERE id=$1", [a.p.id, JSON.stringify(c)]);
  res.json({ ok: true });
}));
app.put("/api/classes/:id/settings", A.need("teacher", "admin"), wrap(async (req, res) => {
  const c = await teacherClass(req, req.params.id);
  if (!c) return bad(res, "ไม่พบห้องนี้", 404);
  const b = req.body || {};
  const settings = { committee: (b.committee || []).slice(0, 3).map((x) => String(x || "").slice(0, 80)), admins: { deputy: String((b.admins || {}).deputy || "").slice(0, 80), director: String((b.admins || {}).director || "").slice(0, 80) } };
  await q("UPDATE classes SET settings=$2 WHERE id=$1", [c.id, settings]);
  res.json(settings);
}));

/* ---------------- files ---------------- */
app.post("/api/projects/:id/files", express.raw({ type: ["image/jpeg", "image/png", "image/webp"], limit: "5mb" }), wrap(async (req, res) => {
  const a = await access(req, req.params.id);
  if (!a || !a.write) return bad(res, "ไม่มีสิทธิ์", 403);
  if (!Buffer.isBuffer(req.body) || !req.body.length) return bad(res, "ไม่พบไฟล์ภาพ");
  const id = crypto.randomUUID();
  const w = Number(req.headers["x-width"]) || null, h = Number(req.headers["x-height"]) || null;
  await q("INSERT INTO files(id,project_id,user_id,mime,width,height,bytes) VALUES ($1,$2,$3,$4,$5,$6,$7)",
    [id, a.p.id, req.user.id, req.headers["content-type"], w, h, req.body]);
  res.json({ src: `/api/files/${id}`, w, h });
}));

// Documents a student made on a computer, attached when submitting for review (max 3 files × 15 MB).
const DOC_TYPES = {
  "application/pdf": "pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/msword": "doc",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": "pptx",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
  "application/zip": "zip", "application/x-zip-compressed": "zip",
  "image/jpeg": "jpg", "image/png": "png",
};
app.post("/api/submissions/:sid/files", express.raw({ type: () => true, limit: "15mb" }), wrap(async (req, res) => {
  const s0 = (await q("SELECT * FROM submissions WHERE id=$1", [req.params.sid])).rows[0];
  if (!s0) return bad(res, "ไม่พบการส่งงาน", 404);
  const a = await access(req, s0.project_id);
  // the student who submitted attaches their work; the teacher attaches marked-up copies (any time)
  if (!a || (!a.teacher && (!a.write || s0.submitted_by !== req.user.id))) return bad(res, "ไม่มีสิทธิ์", 403);
  if (!a.teacher && s0.status !== "submitted") return bad(res, "ครูตรวจการส่งครั้งนี้แล้ว แนบไฟล์เพิ่มไม่ได้", 409);
  const mime = String(req.headers["content-type"] || "").split(";")[0].trim();
  if (!DOC_TYPES[mime]) return bad(res, "รองรับเฉพาะ PDF, Word, PowerPoint, Excel, ZIP และรูปภาพ", 415);
  if (!Buffer.isBuffer(req.body) || !req.body.length) return bad(res, "ไม่พบไฟล์");
  const n = (await q("SELECT count(*)::int AS n FROM files WHERE submission_id=$1 AND user_id IN (SELECT id FROM users WHERE ($2 AND role<>'student') OR (NOT $2 AND role='student'))", [s0.id, !!a.teacher])).rows[0].n;
  if (n >= 3) return bad(res, "แนบได้ไม่เกิน 3 ไฟล์ต่อการส่ง 1 ครั้ง", 409);
  let name = ""; try { name = decodeURIComponent(String(req.headers["x-filename"] || "")); } catch (e) { /* keep empty */ }
  name = name.replace(/[\\/\r\n"]/g, "_").slice(0, 120) || `file.${DOC_TYPES[mime]}`;
  const id = crypto.randomUUID();
  await q("INSERT INTO files(id,project_id,user_id,mime,bytes,submission_id,name) VALUES ($1,$2,$3,$4,$5,$6,$7)", [id, a.p.id, req.user.id, mime, req.body, s0.id, name]);
  res.json({ id, name, mime, size: req.body.length });
}));
app.delete("/api/files/:id", wrap(async (req, res) => {
  if (!/^[0-9a-f-]{36}$/.test(req.params.id)) return bad(res, "ไม่พบไฟล์", 404);
  const f = (await q("SELECT f.project_id, f.user_id, s.status FROM files f JOIN submissions s ON s.id=f.submission_id WHERE f.id=$1", [req.params.id])).rows[0];
  const isTeacher = req.user && req.user.role !== "student";
  if (!f || f.user_id !== req.user.id || (!isTeacher && f.status !== "submitted")) return bad(res, "ลบไฟล์นี้ไม่ได้", 403);
  await q("DELETE FROM files WHERE id=$1", [req.params.id]);
  res.json({ ok: true });
}));

app.get("/api/files/:id", wrap(async (req, res) => {
  if (!/^[0-9a-f-]{36}$/.test(req.params.id)) return bad(res, "ไม่พบไฟล์", 404);
  const f = (await q("SELECT project_id, mime, bytes, name FROM files WHERE id=$1", [req.params.id])).rows[0];
  if (!f || !(await access(req, f.project_id))) return bad(res, "ไม่พบไฟล์", 404);
  res.setHeader("Cache-Control", "private, max-age=31536000, immutable");
  if (f.name) {
    const ascii = f.name.replace(/[^\x20-\x7e]/g, "_");
    res.setHeader("Content-Disposition", `${req.query.dl ? "attachment" : "inline"}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(f.name)}`);
    res.setHeader("X-Content-Type-Options", "nosniff");
  }
  res.type(f.mime).send(f.bytes);
}));

/* ---------------- documents ---------------- */
async function docExtra(p) {
  const reviews = {};
  for (const r of (await q("SELECT kind, data FROM reviews WHERE project_id=$1", [p.id])).rows) reviews[r.kind] = r.data;
  const c = (await q("SELECT settings FROM classes WHERE id=$1", [p.class_id])).rows[0];
  const set = (c && c.settings) || {};
  const committee = Array.isArray(p.committee) && p.committee.some(Boolean) ? p.committee : set.committee || [];
  return { reviews, committee, admins: set.admins || {} };
}
const asciiName = (s) => s.replace(/[^\x20-\x7e]/g, "").replace(/["\\]/g, "");
async function sendExport(res, p, doc, format, inline) {
  const sid = ((p.state.members || []).find((m) => m.sid) || {}).sid || `P${p.id}`;
  const base = `${sid}-${docgen.DOCS[doc].name}`;
  if (format === "docx") {
    const buf = await docgen.buildDocx(p.state, doc, await docExtra(p));
    res.setHeader("Content-Disposition", `attachment; filename="${asciiName(base)}.docx"`);
    return res.type("application/vnd.openxmlformats-officedocument.wordprocessingml.document").send(buf);
  }
  const r = await docgen.render(p.state, doc, await docExtra(p));
  res.setHeader("Content-Disposition", `${inline ? "inline" : "attachment"}; filename="${asciiName(base)}.pdf"`);
  res.type("application/pdf").sendFile(path.join(docgen.CACHE, r.key, "doc.pdf"));
}
app.get("/api/projects/:id/export", wrap(async (req, res) => {
  const a = await access(req, req.params.id);
  if (!a) return bad(res, "ไม่พบโครงงาน", 404);
  const doc = String(req.query.doc || "report"), format = String(req.query.format || "pdf");
  if (!docgen.DOCS[doc]) return bad(res, "ไม่รู้จักเอกสารนี้");
  await sendExport(res, a.p, doc, format, !!req.query.inline);
}));

/* Download links that work without the login cookie. Phones often hand a download to another app
   (Android download manager, Google Drive PDF viewer, the browser inside Messenger/LINE) which fetches
   the link again without cookies and fails. A short-lived signed link avoids that. */
const DL_KEY = crypto.createHash("sha256").update("dl:" + (process.env.DL_SECRET || process.env.DATABASE_URL || crypto.randomBytes(16).toString("hex"))).digest();
const dlSig = (pid, doc, fmt, exp) => crypto.createHmac("sha256", DL_KEY).update(`${pid}|${doc}|${fmt}|${exp}`).digest("base64url").slice(0, 32);
app.post("/api/projects/:id/dlink", wrap(async (req, res) => {
  const a = await access(req, req.params.id);
  if (!a) return bad(res, "ไม่พบโครงงาน", 404);
  const doc = String(req.body.doc || "report"), format = req.body.format === "docx" ? "docx" : "pdf";
  if (!docgen.DOCS[doc]) return bad(res, "ไม่รู้จักเอกสารนี้");
  if (format === "pdf") await docgen.render(a.p.state, doc, await docExtra(a.p)); // build now so the link opens at once
  const exp = Math.floor(Date.now() / 1000) + 30 * 60;
  const sid = ((a.p.state.members || []).find((m) => m.sid) || {}).sid || `P${a.p.id}`;
  const name = (asciiName(`${sid}-${docgen.DOCS[doc].name}`).replace(/[^\w.-]+/g, "-") || "document") + "." + format;
  const inl = req.body.inline ? "i" : "a";
  res.json({ url: `/dl/${a.p.id}/${doc}/${format}/${exp}/${inl}/${dlSig(a.p.id, doc, format, exp)}/${name}` });
}));
app.get("/dl/:pid/:doc/:fmt/:exp/:inl/:sig/:name", wrap(async (req, res) => {
  const { pid, doc, fmt, exp, inl, sig } = req.params;
  const good = /^\d+$/.test(pid) && docgen.DOCS[doc] && (fmt === "pdf" || fmt === "docx") && +exp > Date.now() / 1000;
  const want = good ? dlSig(+pid, doc, fmt, exp) : "";
  if (!good || sig.length !== want.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(want)))
    return res.status(410).type("text/html; charset=utf-8").send(`<meta name="viewport" content="width=device-width"><p style="font:18px sans-serif;padding:24px">ลิงก์ดาวน์โหลดหมดอายุแล้ว กลับไปที่ระบบแล้วกดดาวน์โหลดใหม่อีกครั้ง</p>`);
  const p = (await q("SELECT p.*, c.level, c.teacher_id FROM projects p JOIN classes c ON c.id=p.class_id WHERE p.id=$1", [+pid])).rows[0];
  if (!p) return res.status(404).send("not found");
  res.setHeader("Cache-Control", "private, no-store");
  await sendExport(res, p, doc, fmt, inl === "i");
}));

app.get("/api/projects/:id/pages", wrap(async (req, res) => {
  const a = await access(req, req.params.id);
  if (!a) return bad(res, "ไม่พบโครงงาน", 404);
  const doc = String(req.query.doc || "report");
  if (!docgen.DOCS[doc]) return bad(res, "ไม่รู้จักเอกสารนี้");
  const r = await docgen.render(a.p.state, doc, await docExtra(a.p));
  res.json({ pageCount: r.pageCount, chapterPages: r.chapterPages, pages: r.pages.map((f) => `/api/render/${r.key}/${f}`) });
}));

app.get("/api/render/:key/:file", A.need(), (req, res) => {
  if (!/^[0-9a-f]{40}$/.test(req.params.key) || !/^p-\d+\.jpg$/.test(req.params.file)) return bad(res, "ไม่พบ", 404);
  const f = path.join(docgen.CACHE, req.params.key, req.params.file);
  if (!fs.existsSync(f)) return bad(res, "ไม่พบ (หมดอายุ ให้กดดูใหม่)", 404);
  res.setHeader("Cache-Control", "private, max-age=86400");
  res.sendFile(f);
});

/* ---------------- static app ---------------- */
const PUB = path.join(__dirname, "..", "public");
app.use(express.static(PUB, {
  setHeaders: (res, p) => res.setHeader("Cache-Control", p.includes(`${path.sep}vendor${path.sep}`) ? "public, max-age=31536000, immutable" : "no-cache"),
}));
app.get(/^\/(?!api\/).*/, (_req, res) => { res.setHeader("Cache-Control", "no-cache"); res.sendFile(path.join(PUB, "index.html")); });

app.use((err, _req, res, _next) => {
  console.error(err);
  if (err.type === "entity.too.large") return bad(res, "ไฟล์หรือข้อมูลใหญ่เกินไป", 413);
  bad(res, err.status ? err.message : "เกิดข้อผิดพลาดที่เซิร์ฟเวอร์ ลองใหม่อีกครั้ง", err.status || 500);
});

migrate()
  .then(() => app.listen(PORT, "0.0.0.0", () => console.log(`ProjectElec listening on ${PORT}`)))
  .catch((e) => { console.error("startup failed", e); process.exit(1); });
