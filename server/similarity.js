// Similarity ("copy") check: finds passages that also appear in other groups' work in this system,
// in files they uploaded, or in the system's sample project. Character n-grams + winnowing, so it works
// for Thai (no spaces between words). It reports where text matches; it does not judge intent.
"use strict";
const zlib = require("zlib");
const { execFile } = require("child_process");
const E = require("../public/shared/engine.js");

const K = 15;          // characters per shingle (≈ 3–4 Thai words)
const W = 6;           // winnowing window
const MIN_SPAN = 40;   // ignore matches shorter than this (normalized chars)

/* ---------- text from the project state, grouped by report section ---------- */
const SECS = [
  ["info", "ข้อมูลโครงงาน", ["info", "members", "advisors"]], ["ch1", "บทที่ 1", ["ch1"]], ["ch2", "บทที่ 2", ["ch2", "refs"]],
  ["ch3", "บทที่ 3", ["ch3"]], ["data", "บทที่ 4", ["data"]], ["ch5", "บทที่ 5", ["ch5"]], ["front", "ส่วนต้น/ภาคผนวก", ["front", "manual"]],
  ["plan", "แผน งบ หลักการ", ["plan", "budget", "principle"]],
];
const SKIP = new Set(["src", "w", "h", "size", "sid", "photo", "level", "year", "group", "room", "acadYear", "term", "mode", "pass", "w"]);
function strings(v, out) {
  if (v == null) return out;
  if (typeof v === "string") { if (v.length > 20 && !/^(data:|\/api\/files\/|https?:)/.test(v)) out.push(v); return out; }
  if (Array.isArray(v)) { v.forEach((x) => strings(x, out)); return out; }
  if (typeof v === "object") for (const [k, x] of Object.entries(v)) if (!SKIP.has(k)) strings(x, out);
  return out;
}
function stateBlocks(state) {
  return SECS.map(([id, label, keys]) => ({ id, label, text: keys.flatMap((k) => strings(state && state[k], [])).join("\n") })).filter((b) => b.text.trim());
}

/* ---------- text from uploaded files ---------- */
function unzipEntry(buf, name) {
  // minimal ZIP reader (central directory) — enough for .docx/.pptx/.xlsx
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 66000); i--) if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  if (eocd < 0) return null;
  const n = buf.readUInt16LE(eocd + 10); let p = buf.readUInt32LE(eocd + 16);
  for (let i = 0; i < n; i++) {
    const method = buf.readUInt16LE(p + 10), csize = buf.readUInt32LE(p + 20), flen = buf.readUInt16LE(p + 28), xlen = buf.readUInt16LE(p + 30), clen = buf.readUInt16LE(p + 32), off = buf.readUInt32LE(p + 42);
    const fname = buf.toString("utf8", p + 46, p + 46 + flen);
    if (name instanceof RegExp ? name.test(fname) : fname === name) {
      const lf = off + 30 + buf.readUInt16LE(off + 26) + buf.readUInt16LE(off + 28);
      const data = buf.subarray(lf, lf + csize);
      return method === 0 ? data : zlib.inflateRawSync(data);
    }
    p += 46 + flen + xlen + clen;
  }
  return null;
}
const xmlText = (xml) => xml.replace(/<w:tab\/>/g, " ").replace(/<\/w:p>|<\/a:p>|<w:br\/>/g, "\n").replace(/<[^>]+>/g, "")
  .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&");
function pdfText(buf) {
  return new Promise((resolve) => {
    const child = execFile("pdftotext", ["-layout", "-", "-"], { maxBuffer: 32 * 1024 * 1024, timeout: 60000 }, (err, out) => resolve(err ? "" : String(out)));
    child.stdin.end(buf);
  });
}
async function fileText(mime, bytes) {
  try {
    if (/pdf/.test(mime)) return (await pdfText(bytes)).replace(/[ \t]{2,}/g, " ");
    if (/wordprocessingml/.test(mime)) { const x = unzipEntry(bytes, "word/document.xml"); return x ? xmlText(x.toString("utf8")) : ""; }
    if (/presentationml/.test(mime)) { const parts = []; for (let i = 1; i < 200; i++) { const x = unzipEntry(bytes, `ppt/slides/slide${i}.xml`); if (!x) break; parts.push(xmlText(x.toString("utf8"))); } return parts.join("\n"); }
  } catch (e) { /* unreadable file */ }
  return "";
}

/* ---------- fingerprints ---------- */
// keep letters/digits only (Thai + Latin), remember where each kept char came from
function normalize(text) {
  const chars = [], pos = [];
  const s = String(text).toLowerCase();
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (/[ก-๎0-9a-z]/.test(c) && !/[่-์]/.test(c)) { chars.push(c); pos.push(i); } // tone marks ignored
  }
  return { s: chars.join(""), pos };
}
function hash(str) { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function fingerprints(ns) {
  const hs = []; for (let i = 0; i + K <= ns.length; i++) hs.push(hash(ns.substr(i, K)));
  const out = new Map(); // hash -> first position
  for (let i = 0; i + W <= hs.length; i++) { let m = i; for (let j = i + 1; j < i + W; j++) if (hs[j] <= hs[m]) m = j; if (!out.has(hs[m])) out.set(hs[m], m); }
  if (hs.length && hs.length < W) hs.forEach((h, i) => { if (!out.has(h)) out.set(h, i); });
  return out;
}
const allHashes = (ns) => { const a = []; for (let i = 0; i + K <= ns.length; i++) a.push(hash(ns.substr(i, K))); return a; };

/* ---------- corpus (cached briefly) ---------- */
let CORPUS = null;
async function corpus(q) {
  const stamp = (await q("SELECT count(*)::int AS n, max(updated_at) AS t FROM projects")).rows[0];
  const fstamp = (await q("SELECT count(*)::int AS n FROM files WHERE submission_id IS NOT NULL")).rows[0];
  const key = `${stamp.n}|${stamp.t}|${fstamp.n}`;
  if (CORPUS && CORPUS.key === key && Date.now() - CORPUS.at < 10 * 60e3) return CORPUS;
  const docs = [];
  const ex = E.normalize(E.example());
  docs.push({ key: "example", kind: "example", project: null, label: "โครงงานตัวอย่างในระบบ", text: stateBlocks(ex).map((b) => b.text).join("\n") });
  const ps = (await q(`SELECT p.id, p.state, c.name AS class_name, c.id AS class_id FROM projects p JOIN classes c ON c.id=p.class_id WHERE p.deleted_at IS NULL`)).rows;
  for (const p of ps) docs.push({ key: `p${p.id}`, kind: "project", project: p.id, classId: p.class_id, label: `${(p.state.info && p.state.info.titleTh) || "(ไม่มีชื่อ)"} · ${p.class_name}`, text: stateBlocks(p.state).map((b) => b.text).join("\n") });
  const fs = (await q(`SELECT f.id, f.project_id, f.name, f.mime, f.text, f.bytes IS NOT NULL AS has FROM files f JOIN projects p ON p.id=f.project_id
                       WHERE f.submission_id IS NOT NULL AND p.deleted_at IS NULL AND f.mime NOT LIKE 'image/%'`)).rows;
  for (const f of fs) {
    let text = f.text;
    if (text == null) { const b = (await q("SELECT bytes FROM files WHERE id=$1", [f.id])).rows[0]; text = await fileText(f.mime, b.bytes); await q("UPDATE files SET text=$2 WHERE id=$1", [f.id, text]); }
    const owner = ps.find((p) => p.id === f.project_id);
    docs.push({ key: `f${f.id}`, kind: "file", project: f.project_id, file: f.id, label: `ไฟล์ ${f.name}${owner ? " · " + ((owner.state.info && owner.state.info.titleTh) || "") : ""}`, text });
  }
  // index: hash -> doc keys; drop hashes found in many documents (template phrases, college name…)
  const idx = new Map();
  for (const d of docs) { const n = normalize(d.text).s; for (const h of fingerprints(n).keys()) { let set = idx.get(h); if (!set) idx.set(h, (set = new Set())); set.add(d.key); } }
  // template text every new project starts with is not "copying"; phrases in most projects (college name…) neither
  for (const h of fingerprints(normalize(stateBlocks(E.normalize(E.blank())).map((b) => b.text).join("\n")).s).keys()) idx.delete(h);
  for (const h of allHashes(normalize(stateBlocks(E.normalize(E.blank())).map((b) => b.text).join("\n")).s)) idx.delete(h);
  const common = Math.max(10, Math.ceil(docs.length * 0.6));
  for (const [h, set] of idx) if (set.size >= common) idx.delete(h);
  CORPUS = { key, at: Date.now(), docs: new Map(docs.map((d) => [d.key, d])), idx };
  return CORPUS;
}

/* ---------- check a text against the corpus ---------- */
// blocks: [{id,label,text}] — excludeProject: the group's own work never counts as a source
async function check(q, blocks, { excludeProject, excludeFile } = {}) {
  const C = await corpus(q);
  const ok = (key) => { const d = C.docs.get(key); return d && (excludeProject == null || d.project !== excludeProject) && (excludeFile == null || d.file !== excludeFile); };
  let total = 0, matched = 0; const srcChars = new Map();
  // global vote: when a passage exists in several sources, credit the one that shares the most with this work
  const votes = new Map();
  for (const b of blocks) for (const h of allHashes(normalize(b.text).s)) { const set = C.idx.get(h); if (set) for (const k of set) if (ok(k)) votes.set(k, (votes.get(k) || 0) + 1); }
  const outBlocks = blocks.map((b) => {
    const N = normalize(b.text); const hs = allHashes(N.s); total += N.s.length;
    const owner = new Array(N.s.length).fill(null);
    // vote per position: which source shares this shingle
    hs.forEach((h, i) => {
      const set = C.idx.get(h); if (!set) return;
      let best = null; for (const k of set) if (ok(k) && (!best || votes.get(k) > votes.get(best))) best = k;
      if (best) for (let j = i; j < i + K; j++) if (!owner[j]) owner[j] = best;
    });
    // keep only runs long enough to be meaningful
    for (let i = 0; i < owner.length;) {
      if (!owner[i]) { i++; continue; }
      let j = i; while (j < owner.length && owner[j]) j++;
      if (j - i < MIN_SPAN) for (let t = i; t < j; t++) owner[t] = null;
      i = j;
    }
    // map back to the original text as segments
    const segs = []; let cur = null, start = 0;
    const origOwner = new Array(b.text.length).fill(null);
    N.pos.forEach((p, i) => { origOwner[p] = owner[i]; });
    // fill gaps (spaces/punctuation) inside a matched run
    for (let i = 1; i < origOwner.length - 1; i++) if (!origOwner[i]) { let a = i - 1, z = i + 1; while (z < origOwner.length && !origOwner[z] && z - i < 4) z++; if (origOwner[a] && origOwner[a] === origOwner[z]) origOwner[i] = origOwner[a]; }
    for (let i = 0; i <= b.text.length; i++) {
      const o = i < b.text.length ? origOwner[i] : "__end";
      if (i === 0) { cur = o; continue; }
      if (o !== cur) { segs.push({ t: b.text.slice(start, i), s: cur || null }); start = i; cur = o; }
    }
    owner.forEach((o) => { if (o) { matched++; srcChars.set(o, (srcChars.get(o) || 0) + 1); } });
    return { id: b.id, label: b.label, segs: segs.filter((x) => x.t) };
  });
  const sources = [...srcChars.entries()].sort((a, b) => b[1] - a[1]).map(([k, n]) => { const d = C.docs.get(k); return { key: k, kind: d.kind, label: d.label, project: d.project, file: d.file, pct: total ? (n / total) * 100 : 0 }; });
  return { total, pct: total ? (matched / total) * 100 : 0, sources, blocks: outBlocks };
}

module.exports = { check, stateBlocks, fileText };
