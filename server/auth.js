// Password hashing (scrypt) and cookie sessions. No third-party auth: students need no Google account.
"use strict";
const crypto = require("crypto");
const { q } = require("./db");

const COOKIE = "pe_sid";
const SESSION_DAYS = 30;

function hashPassword(pw) {
  const salt = crypto.randomBytes(16);
  const key = crypto.scryptSync(String(pw), salt, 32, { N: 16384, r: 8, p: 1 });
  return `scrypt$${salt.toString("base64")}$${key.toString("base64")}`;
}
function verifyPassword(pw, stored) {
  const [alg, s, k] = String(stored || "").split("$");
  if (alg !== "scrypt" || !s || !k) return false;
  const key = crypto.scryptSync(String(pw), Buffer.from(s, "base64"), 32, { N: 16384, r: 8, p: 1 });
  const want = Buffer.from(k, "base64");
  return want.length === key.length && crypto.timingSafeEqual(want, key);
}

function parseCookies(req) {
  const out = {};
  for (const part of String(req.headers.cookie || "").split(";")) {
    const i = part.indexOf("=");
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

async function createSession(res, userId, secure) {
  const token = crypto.randomBytes(32).toString("base64url");
  const exp = new Date(Date.now() + SESSION_DAYS * 864e5);
  await q("INSERT INTO sessions(token,user_id,expires_at) VALUES ($1,$2,$3)", [token, userId, exp]);
  res.setHeader("Set-Cookie", `${COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_DAYS * 86400}${secure ? "; Secure" : ""}`);
}
async function destroySession(req, res) {
  const t = parseCookies(req)[COOKIE];
  if (t) await q("DELETE FROM sessions WHERE token=$1", [t]);
  res.setHeader("Set-Cookie", `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
}

// Attaches req.user (or null).
async function loadUser(req, _res, next) {
  req.user = null;
  const t = parseCookies(req)[COOKIE];
  if (!t) return next();
  try {
    const r = await q(
      `SELECT u.id,u.role,u.username,u.class_id,u.student_id,u.display_name FROM sessions s JOIN users u ON u.id=s.user_id
       WHERE s.token=$1 AND s.expires_at>now() AND u.deleted_at IS NULL`, [t]);
    req.user = r.rows[0] || null;
  } catch (e) { console.error(e); }
  next();
}
const need = (...roles) => (req, res, next) => {
  if (!req.user) return res.status(401).json({ error: "กรุณาเข้าสู่ระบบ" });
  if (roles.length && !roles.includes(req.user.role)) return res.status(403).json({ error: "ไม่มีสิทธิ์ใช้งานส่วนนี้" });
  next();
};

// Simple in-memory brake on password guessing: 10 failures per key per 10 minutes.
const fails = new Map();
function tooMany(key) {
  const f = fails.get(key);
  return f && f.n >= 10 && Date.now() - f.t < 10 * 60e3;
}
function noteFail(key) {
  const f = fails.get(key);
  if (!f || Date.now() - f.t > 10 * 60e3) fails.set(key, { n: 1, t: Date.now() });
  else f.n++;
}
const clearFail = (key) => fails.delete(key);

module.exports = { hashPassword, verifyPassword, createSession, destroySession, loadUser, need, tooMany, noteFail, clearFail };
