/* ProjectElec mobile app: login, project home, guided KP.01, detailed editors, A4 preview, export, teacher views.
   Data lives on the server; every change is kept on the phone first and synced when online. */
"use strict";
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const { esc, clone, f2, getPath, setPath, thaiDate, PROJECT_TYPES, CALENDAR, LV_SHORT, lvIdx } = PEEngine;

/* ---------------- engine binding (shared with the server) ---------------- */
let ME = null;      // {user, class?, projects?, classes?}
let P = null;       // project meta {id, version, canWrite, members, limit, joinCode, level}
let S = null;       // project state (same shape as the first version of the site)
let E = null;       // engine bound to S
const env = { createCanvas: (w, h) => { const c = document.createElement("canvas"); c.width = w; c.height = h; return c; } };
function bindEngine() { E = PEEngine.create(S, env); document.body.dataset.level = S.info.level; }
const G = new Proxy({}, { get: (_t, k) => E.G[k] });
const N = () => E.N(), V = () => E.V(), objectives = () => E.objectives(), hypotheses = () => E.hypotheses();
const members = () => E.members(), memberName = (m) => E.memberName(m);
const likert = (a, b) => E.likert(a, b), satStats = () => E.satStats(), iocStats = () => E.iocStats(), perfStats = (p) => E.perfStats(p);
const parseCounts = (t) => E.parseCounts(t), allRefs = () => E.allRefs(), refRuns = (r) => E.refRuns(r), iocItems = () => E.iocItems(), baht = (x) => E.baht(x);
const buildReport = () => E.buildReport(), buildChapters = (c) => E.buildChapters(c), buildBack = (c) => E.buildBack(c), buildFront = (c) => E.buildFront(c), Ctx = () => E.Ctx();
const kp01 = () => E.kp01(), allForms = () => E.allForms(), blocksHTML = (b) => E.blocksHTML(b);

/* ---------------- small helpers ---------------- */
function toast(msg, ms = 3800) {
  $$(".toast").forEach((t) => t.remove());
  const t = document.createElement("div"); t.className = "toast"; t.setAttribute("role", "status"); t.textContent = msg;
  document.body.appendChild(t); setTimeout(() => t.remove(), ms);
}
async function api(method, url, body, raw) {
  let res;
  try {
    res = await fetch(url, {
      method, credentials: "same-origin",
      headers: raw ? raw.headers : body ? { "content-type": "application/json" } : {},
      body: raw ? raw.body : body ? JSON.stringify(body) : undefined,
    });
  } catch (e) { throw { status: 0, error: "ไม่มีอินเทอร์เน็ต" }; }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign({ status: res.status, error: data.error || `ผิดพลาด (${res.status})` }, data);
  return data;
}
const store = {
  get(k) { try { return JSON.parse(localStorage.getItem(k) || "null"); } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } },
  del(k) { try { localStorage.removeItem(k); } catch (e) { /* ignore */ } },
};
const weekNo = (start) => { if (!start) return 0; const d = new Date(start + "T00:00"); return Math.floor((Date.now() - d) / (7 * 864e5)) + 1; };
const pct = (a) => (a.length ? Math.round((a.filter(Boolean).length / a.length) * 100) : 0);
const meter = (p) => `<span class="meter" style="--p:${p}" aria-label="${p}%"><span>${p}%</span></span>`;

/* ---------------- sync: phone first, server when online ---------------- */
const SYNC = { dirty: new Set(), inflight: false, timer: null, retry: null, status: "saved", at: null };
const draftKey = () => `pe-draft-${P.id}`;
let localT = null;
function saveLocal(now) {
  clearTimeout(localT);
  const go = () => { if (P && S) { const base = {}; if (P.base) SYNC.dirty.forEach((p) => { base[p] = getPath(P.base, p); }); store.set(draftKey(), { v: P.version, state: S, dirty: [...SYNC.dirty], base, at: Date.now() }); } };
  now ? go() : (localT = setTimeout(go, 250));
}
function markDirty(path) {
  if (!P || !P.canWrite) return;
  SYNC.dirty.add(path);
  saveLocal();
  setSync(navigator.onLine ? "pending" : "offline");
  clearTimeout(SYNC.timer); SYNC.timer = setTimeout(syncNow, 1500);
}
function setSync(st, msg) {
  SYNC.status = st;
  const el = $("#sync"); if (!el) return;
  el.hidden = !P || !P.canWrite;
  el.className = "sync " + (st === "pending" ? "saving" : st);
  const txt = { saved: "บันทึกแล้ว", pending: "รอส่ง…", saving: "กำลังบันทึก…", offline: "เก็บในเครื่อง", error: "ส่งไม่สำเร็จ" }[st] || st;
  el.querySelector("span").textContent = txt;
  el.title = msg || "";
  $("#offline").hidden = navigator.onLine;
}
// Photos taken offline sit in the state as data: URLs; upload them before saving the text.
function pendingImages(obj, base = "", out = []) {
  if (!obj || typeof obj !== "object") return out;
  if (typeof obj.src === "string" && obj.src.startsWith("data:")) out.push(base);
  for (const k of Object.keys(obj)) if (obj[k] && typeof obj[k] === "object") pendingImages(obj[k], base ? `${base}.${k}` : k, out);
  return out;
}
async function uploadPending() {
  for (const path of pendingImages(S)) {
    const o = getPath(S, path);
    const blob = await (await fetch(o.src)).blob();
    const r = await api("POST", `/api/projects/${P.id}/files`, null, { headers: { "content-type": blob.type || "image/jpeg", "x-width": o.w, "x-height": o.h }, body: blob });
    o.src = r.src;
    SYNC.dirty.add(path);
  }
}
/* Writing provenance: count characters typed vs pasted per field (numbers only, never the text or keystrokes).
   Kept with the draft so it survives offline, sent with the next save. Students are told about it on screen. */
const WLOG = {
  m: (() => { try { return JSON.parse(localStorage.getItem("pe-wlog") || "{}"); } catch (e) { return {}; } })(),
  add(p, k, n) { if (!P || !p || !n) return; const key = P.id + "|" + p; const r = this.m[key] || (this.m[key] = { pid: P.id, p, typed: 0, pasted: 0, pastes: 0, maxPaste: 0 });
    if (k === "paste") { r.pasted += n; r.pastes += 1; r.maxPaste = Math.max(r.maxPaste, n); } else r.typed += n; this.save(); },
  save() { try { localStorage.setItem("pe-wlog", JSON.stringify(this.m)); } catch (e) { /* storage full */ } },
  take(pid) { const out = []; for (const k in this.m) if (this.m[k].pid === pid) { out.push(this.m[k]); delete this.m[k]; } this.save(); return out; },
  back(list) { list.forEach((r) => { const key = r.pid + "|" + r.p; const c = this.m[key]; if (c) { c.typed += r.typed; c.pasted += r.pasted; c.pastes += r.pastes; c.maxPaste = Math.max(c.maxPaste, r.maxPaste); } else this.m[key] = r; }); this.save(); },
};
document.addEventListener("paste", (e) => { const el = e.target; if (!el.dataset || !el.dataset.k || !S) return; const t = (e.clipboardData && e.clipboardData.getData("text")) || ""; if (t.trim().length) WLOG.add(el.dataset.k, "paste", t.length); });
document.addEventListener("beforeinput", (e) => { const el = e.target; if (!el.dataset || !el.dataset.k || !S) return;
  if (/^insert(Text|CompositionText|ReplacementText|LineBreak|Paragraph)$/.test(e.inputType)) WLOG.add(el.dataset.k, "type", e.inputType === "insertCompositionText" ? 1 : (e.data || "").length || 1); });
async function syncNow() {
  clearTimeout(SYNC.timer);
  if (!P || !P.canWrite || SYNC.inflight || !SYNC.dirty.size) { if (P && !SYNC.dirty.size && !SYNC.inflight) setSync("saved"); return; }
  if (!navigator.onLine) return setSync("offline");
  SYNC.inflight = true; setSync("saving");
  let sent = [], wl = [];
  try {
    await uploadPending();
    sent = [...SYNC.dirty]; SYNC.dirty.clear();
    const baseVals = {}; if (P.base) sent.forEach((p) => { baseVals[p] = getPath(P.base, p); });
    const snap = clone(S);
    wl = WLOG.take(P.id);
    const r = await api("PUT", `/api/projects/${P.id}`, { baseVersion: P.version, state: S, changed: sent, baseVals, wlog: wl.map(({ pid, ...x }) => x) });
    P.version = r.version; P.base = r.merged && r.state ? clone(r.state) : snap;
    if (r.conflicts && r.conflicts.length) toast(`มีเพื่อนแก้ช่องเดียวกันพร้อมกัน ${r.conflicts.length} ช่อง ระบบใช้ข้อความของคุณ และเก็บฉบับของเพื่อนไว้ใน “ประวัติการแก้ไข”`, 9000);
    if (r.merged && r.state) {
      const local = S; S = PEEngine.normalize(r.state);
      for (const p of SYNC.dirty) setPath(S, p, getPath(local, p));
      bindEngine();
      if (!isTyping()) render();
      toast("รวมการแก้ไขของเพื่อนในกลุ่มแล้ว");
    }
    SYNC.at = new Date();
    setSync(SYNC.dirty.size ? "pending" : "saved");
  } catch (e) {
    sent.forEach((p) => SYNC.dirty.add(p)); WLOG.back(wl);
    setSync(e.status === 0 ? "offline" : "error", e.error);
    if (e.status === 401) { toast("หมดเวลาเข้าสู่ระบบ กรุณาเข้าสู่ระบบใหม่ งานที่พิมพ์ยังอยู่ในเครื่อง"); }
    clearTimeout(SYNC.retry); SYNC.retry = setTimeout(syncNow, 15000);
  } finally {
    SYNC.inflight = false; saveLocal(true);
    if (SYNC.dirty.size && navigator.onLine && SYNC.status !== "error") { clearTimeout(SYNC.timer); SYNC.timer = setTimeout(syncNow, 1500); }
  }
}
const isTyping = () => { const a = document.activeElement; return a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName); };
window.addEventListener("online", () => { setSync(SYNC.dirty.size ? "pending" : "saved"); syncNow(); });
window.addEventListener("offline", () => setSync("offline"));
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") { saveLocal(true); syncNow(); } });
window.addEventListener("pagehide", () => saveLocal(true));

async function openProject(id) {
  let r;
  try { r = await api("GET", `/api/projects/${id}`); store.set(`pe-proj-${id}`, r); }
  catch (e) {
    if (e.status === 404 || e.status === 403) {
      // the teacher deleted this group (or the student was removed): forget it on this phone and start over
      store.del ? store.del(`pe-proj-${id}`) : localStorage.removeItem(`pe-proj-${id}`);
      ME.projects = (ME.projects || []).filter((x) => x.id !== id); store.set("pe-me", ME);
      P = null; S = null; toast("กลุ่มนี้ถูกครูลบแล้ว สร้างกลุ่มใหม่หรือเข้าร่วมกลุ่มอื่นได้");
      throw Object.assign(new Error("deleted"), { redirect: "#/start" });
    }
    if (e.status !== 0) throw e;
    r = store.get(`pe-proj-${id}`); if (!r) throw e;
    toast("ออฟไลน์: เปิดจากข้อมูลในเครื่อง");
  }
  P = { id: r.id, version: r.version, canWrite: r.canWrite, members: r.members, limit: r.limit, joinCode: r.joinCode, level: r.level, reviews: r.reviews || [], submissions: r.submissions || [], comments: r.comments || [], committee: r.committee || [] };
  S = PEEngine.normalize(r.state); P.base = clone(r.state);
  SYNC.dirty.clear();
  const d = store.get(`pe-draft-${id}`);
  if (d && P.canWrite) {
    if (d.dirty && d.dirty.length) {
      for (const p of d.dirty) { setPath(S, p, getPath(d.state, p)); SYNC.dirty.add(p); if (d.base && p in d.base) setPath(P.base, p, d.base[p]); }
      // send against the version this work was based on, so the server can spot a friend's edit to the same field
      if (d.v && d.v < P.version) P.version = d.v;
      toast(`กู้คืนงานที่ยังไม่ได้ส่งขึ้นระบบ ${d.dirty.length} รายการ`);
    } else if (d.v > r.version) { S = PEEngine.normalize(d.state); }
  }
  bindEngine();
  setSync(SYNC.dirty.size ? "pending" : "saved");
  if (SYNC.dirty.size) syncNow();
}

/* ---------------- photos: shrink on the phone before upload ---------------- */
function loadImg(file, max, rotate = 0) {
  return new Promise((res, rej) => {
    const url = URL.createObjectURL(file);
    const im = new Image();
    im.onload = () => {
      const sc = Math.min(1, max / Math.max(im.width, im.height));
      let w = Math.round(im.width * sc), h = Math.round(im.height * sc);
      const c = document.createElement("canvas"); const rot = ((rotate % 360) + 360) % 360;
      c.width = rot % 180 ? h : w; c.height = rot % 180 ? w : h;
      const x = c.getContext("2d"); x.fillStyle = "#fff"; x.fillRect(0, 0, c.width, c.height);
      x.translate(c.width / 2, c.height / 2); x.rotate((rot * Math.PI) / 180); x.drawImage(im, -w / 2, -h / 2, w, h);
      URL.revokeObjectURL(url);
      res({ src: c.toDataURL("image/jpeg", 0.82), w: c.width, h: c.height });
    };
    im.onerror = () => { URL.revokeObjectURL(url); rej(new Error("อ่านไฟล์ภาพไม่ได้")); };
    im.src = url;
  });
}
async function rotateImage(path) {
  const o = getPath(S, path); if (!o) return;
  const blob = await (await fetch(o.src)).blob();
  const r = await loadImg(blob, 1600, 90);
  setPath(S, path, Object.assign({}, o, r)); markDirty(path); render();
}

/* ---------------- form helpers used by the detailed editors (editors.js) ---------------- */
function fText(p, label, o = {}) { const v = getPath(S, p) ?? ""; const id = "f_" + p.replace(/\./g, "_"); return `<div class="f">${label ? `<label for="${id}">${label}</label>` : ""}${o.hint ? `<p class="hint">${o.hint}</p>` : ""}<input type="${o.type || "text"}" id="${id}" data-k="${p}" value="${esc(v)}" placeholder="${esc(o.ph || "")}"${o.type === "number" ? ' inputmode="numeric"' : ""}${o.max ? ` data-count="${o.max}"` : ""}>${o.max ? `<div class="counter" data-counter="${p}"></div>` : ""}</div>`; }
function fArea(p, label, o = {}) { const v = getPath(S, p) ?? ""; const id = "f_" + p.replace(/\./g, "_"); return `<div class="f">${label ? `<label for="${id}">${label}</label>` : ""}${o.hint ? `<p class="hint">${o.hint}</p>` : ""}<textarea id="${id}" data-k="${p}" rows="${o.rows || 4}" class="${o.mono ? "mono" : ""}" placeholder="${esc(o.ph || "")}"${o.max ? ` data-count="${o.max}"` : ""}>${esc(v)}</textarea>${o.max ? `<div class="counter" data-counter="${p}"></div>` : ""}${o.draft ? `<div class="draftbar"><p class="hint">${o.draftHint || "เว้นว่างไว้ ระบบจะใช้ข้อความร่างอัตโนมัติ"}</p><button class="btn sm" type="button" data-act="draft:${p}:${o.draft}">เติมข้อความร่างให้แก้ต่อ</button></div>` : ""}</div>`; }
function fSelect(p, label, opts) { const v = getPath(S, p) ?? ""; const id = "f_" + p.replace(/\./g, "_"); return `<div class="f"><label for="${id}">${label}</label><select id="${id}" data-k="${p}">${opts.map((o) => { const [val, lab] = Array.isArray(o) ? o : [o, o]; return `<option value="${esc(val)}"${String(v) === String(val) ? " selected" : ""}>${esc(lab)}</option>`; }).join("")}</select></div>`; }
function fList(p, label, fields, o = {}) {
  const arr = getPath(S, p) || []; const str = !fields;
  let h = `<div class="f">${label ? `<label>${label}</label>` : ""}${o.hint ? `<p class="hint">${o.hint}</p>` : ""}<div style="display:flex;flex-direction:column;gap:8px">`;
  arr.forEach((it, i) => {
    if (str) h += `<div style="display:flex;gap:6px;align-items:center"><span class="idx" style="font-family:var(--f-mono);font-size:12px;color:var(--muted);min-width:22px">${o.prefix ? o.prefix + (i + 1) : i + 1}</span><input type="text" data-k="${p}.${i}" value="${esc(it)}" placeholder="${esc(o.ph || "")}" aria-label="${esc(label || o.add || "")} ${i + 1}"><button class="btn ghost sm" type="button" data-act="del:${p}:${i}" aria-label="ลบ">✕</button></div>`;
    else h += `<div class="item"><span class="idx">${esc(o.itemLabel || "รายการ")} ${i + 1}</span><button class="btn ghost sm del" type="button" data-act="del:${p}:${i}" aria-label="ลบ">✕ ลบ</button>${fields(`${p}.${i}`, it, i)}</div>`;
  });
  h += `</div><div><button class="btn sm" type="button" data-act="add:${p}:${o.newKey || ""}">+ ${o.add || "เพิ่ม"}</button></div></div>`;
  return h;
}
const NEW = {
  term: { t: "", d: "" }, topic: { title: "", body: "", img: null, imgCap: "" }, related: { author: "", year: "", title: "", obj: "", method: "", result: "", suggest: "", source: "" },
  ref: { type: "book", author: "", year: "", title: "", edition: "", place: "", publisher: "", url: "", accessed: "", journal: "", vol: "", pages: "" }, perf: { name: "", method: "", rows: [] }, sat: { name: "", items: [""] },
  row: { item: "", exp: "", act: "", pass: true }, member: { prefix: "นาย", first: "", last: "", nameEn: "", sid: "", phone: "", email: "", address: "", photo: null }, expert: { name: "", pos: "", org: "" },
  demo: { q: "", text: "" }, budget: { item: "", qty: "1", price: "", note: "" }, step: { name: "", w: [] },
};
function fPhoto(p, label, o = {}) {
  const v = getPath(S, p);
  return `<div class="f"><label>${label}</label>${o.hint ? `<p class="hint">${o.hint}</p>` : ""}<div class="photo">${v && v.src ? `<img src="${v.src}" alt="${esc(label)}">` : ""}
   <label class="btn sm">📷 ${v ? "ถ่าย/เลือกใหม่" : "ถ่ายรูปหรือเลือกรูป"}<input type="file" accept="image/*" data-photo="${p}" data-max="${o.max || 1600}" hidden></label>
   ${v ? `<button class="btn ghost sm" type="button" data-act="rotate:${p}">↻ หมุน</button><a class="btn ghost sm" href="#/crop/${p}">✂ ครอบตัด</a><button class="btn ghost sm" type="button" data-act="clear:${p}">ลบรูป</button>` : ""}</div>
   ${v && !o.noSize ? photoSize(p, v) : ""}</div>`;
}
// Size on the A4 page: small / medium / large (engine clamps to the printable area and to a max height).
function photoSize(p, v) {
  const cur = v.size || "";
  return `<div class="chips" role="group" aria-label="ขนาดภาพในเอกสาร"><span class="hint" style="align-self:center">ขนาดในเล่ม</span>${[["", "อัตโนมัติ"], ["s", "เล็ก"], ["m", "กลาง"], ["l", "ใหญ่"]].map(([k, l]) => `<button type="button" class="chip" data-set="${p}.size:${k}" aria-pressed="${cur === k}">${l}</button>`).join("")}</div>`;
}
const sec = (title, inner, o = {}) => `<fieldset${o.id ? ` id="${o.id}"` : ""}><legend>${title}</legend>${inner}</fieldset>`;
const head = (title, desc, week) => `<header>${week ? `<div class="week">${week}</div>` : ""}<h2>${title}</h2><p>${desc}</p></header>`;
function updateCounters() {
  $$("[data-count]").forEach((el) => {
    const c = document.querySelector(`[data-counter="${el.dataset.k}"]`); if (!c) return;
    const n = el.value.length, max = +el.dataset.count; c.textContent = `${n.toLocaleString()} / ${max.toLocaleString()} ตัวอักษร`; c.classList.toggle("over", n > max);
  });
}

/* ---------------- guided KP.01: one question per screen ----------------
   Questions follow the order and the bracketed instructions of แบบ คพ.01 (คู่มือ หน้า 14–19).
   Examples shown are the handbook's own; nothing is written into the student's answer for them. */
const memberFields = (p) => `<div class="row">${fSelect(p + ".prefix", "คำนำหน้า", ["นาย", "นางสาว", "นาง"])}${fText(p + ".sid", "รหัสนักศึกษา", { type: "text" })}</div><div class="row">${fText(p + ".first", "ชื่อ")}${fText(p + ".last", "นามสกุล")}</div>`;
function typeChecks() {
  const T = S.info.types;
  const group = (title, keys) => `<div class="f"><label>${title}</label>${keys.map(([k, l]) => `<label class="chk"><input type="checkbox" data-type="${k}"${T.includes(k) ? " checked" : ""}> ${esc(l)}</label>`).join("")}</div>`;
  return group("2.1 ประเภทงานวิจัย", [["r_basic", "การวิจัยพื้นฐาน (basic research)"], ["r_applied", "การวิจัยประยุกต์ (applied research)"], ["r_rd", "การวิจัยและพัฒนา (research and development)"]]) +
    group("2.2.1 สิ่งประดิษฐ์ของคนรุ่นใหม่", PROJECT_TYPES.filter((p) => /^i\d/.test(p[0])).map(([k, l]) => [k, l.replace("สิ่งประดิษฐ์ฯ ", "")])) +
    group("2.2.2 โครงงานวิทยาศาสตร์", [["sdg", "โครงงานวิจัยทดลองและวิจัยพัฒนาที่ยั่งยืน (SDGs)"]]) +
    group("2.3 โครงงานทั่วไป", PROJECT_TYPES.filter((p) => /^g_/.test(p[0])).map(([k, l]) => [k, l.replace("โครงงานทั่วไป — ", "")]));
}
function ganttMobile() {
  const months = S.plan.months.split(/[,،]/).map((s) => s.trim()).filter(Boolean);
  return fText("plan.months", "เดือน (คั่นด้วยจุลภาค)") + S.plan.steps.map((s, i) => `<div class="item"><button class="btn ghost sm del" type="button" data-act="del:plan.steps:${i}" aria-label="ลบขั้นตอน">✕</button>
    ${fText(`plan.steps.${i}.name`, `ขั้นตอนที่ ${i + 1}`)}
    ${months.map((m, mi) => `<div><div class="hint">${esc(m)}</div><div class="chips">${[0, 1, 2, 3].map((w) => { const j = mi * 4 + w; const on = (s.w || []).includes(j);
      return `<label class="chip" aria-pressed="${on}" style="min-width:44px;text-align:center"><input type="checkbox" data-week="${i}:${j}"${on ? " checked" : ""} hidden>ส.${w + 1}</label>`; }).join("")}</div></div>`).join("")}</div>`).join("") +
    `<button class="btn sm" type="button" data-act="add:plan.steps:step">+ เพิ่มขั้นตอน</button>`;
}
function refsEditor() {
  return fList("refs", "", (p, it) => `<div class="row">${fSelect(p + ".type", "ประเภท", [["book", "หนังสือ"], ["web", "เว็บไซต์"], ["article", "บทความวารสาร"], ["research", "งานวิจัย/รายงาน"]])}${fText(p + ".year", "ปีที่พิมพ์")}</div>${fText(p + ".author", "ผู้แต่ง/หน่วยงาน")}${fText(p + ".title", "ชื่อเรื่อง")}` +
    (it.type === "web" ? `<div class="row">${fText(p + ".url", "URL")}${fText(p + ".accessed", "วันที่สืบค้น", { type: "date" })}</div>` : it.type === "article" ? `<div class="row">${fText(p + ".journal", "ชื่อวารสาร")}${fText(p + ".vol", "ปีที่(ฉบับที่)")}${fText(p + ".pages", "หน้า")}</div>` : `<div class="row">${fText(p + ".place", "สถานที่พิมพ์")}${fText(p + ".publisher", it.type === "research" ? "หน่วยงาน" : "สำนักพิมพ์")}</div>`) +
    `<p class="hint">${refRuns(it).map((r) => (r.b ? `<b>${esc(r.text)}</b>` : r.i ? `<i>${esc(r.text)}</i>` : esc(r.text))).join("")}</p>`, { add: "เพิ่มแหล่งอ้างอิง", newKey: "ref", itemLabel: "รายการ" });
}
const filled = (v) => (Array.isArray(v) ? v.filter((x) => (typeof x === "string" ? x.trim() : x)).length > 0 : v != null && String(v).trim() !== "");
const KP01 = [
  { id: "title", no: "ข้อ 1", ask: "โครงงานของเราชื่ออะไร", hint: "ชื่อโครงงานวิจัยไม่ควรเกิน 1 บรรทัด และระบุผลลัพธ์", pg: 14,
    ex: "การพัฒนาระบบเช็คชื่อด้วย QR Code สำหรับนักเรียนระดับ ปวช.",
    body: () => fText("info.titleTh", "ชื่อภาษาไทย", { max: 70 }) + fText("info.titleEn", "ชื่อภาษาอังกฤษ (ใช้ในบทคัดย่อภาษาอังกฤษและคำร้อง)"), done: () => filled(S.info.titleTh) },
  { id: "innov", no: "ข้อ 1", ask: "สิ่งที่จะสร้างหรือพัฒนา เรียกสั้น ๆ ว่าอะไร", hint: "ชื่อนี้ใช้แทนคำว่า “(ชื่อนวัตกรรม)” ในวัตถุประสงค์ สมมติฐาน ขอบเขต และรายงานทั้งเล่ม", pg: 16,
    ex: "เครื่องให้อาหารปลาอัตโนมัติ (ตัวอย่างในคู่มือ หน้า 46)",
    body: () => fText("info.innov", "ชื่อนวัตกรรม") + `<div class="f"><label>เป็นงานสร้างใหม่หรือพัฒนาจากของเดิม</label><div class="chips">${["สร้าง", "พัฒนา"].map((v) => `<button type="button" class="chip" data-set="info.verb:${v}" aria-pressed="${S.info.verb === v}">${v}</button>`).join("")}</div></div>` + fText("info.innovEn", "ชื่อภาษาอังกฤษ (ถ้ามี)"),
    done: () => filled(S.info.innov) },
  { id: "types", no: "ข้อ 2", ask: "โครงงานนี้เป็นประเภทใด", hint: "ทำเครื่องหมายในประเภทโครงงานวิชาชีพให้ถูกต้อง เลือกได้มากกว่า 1 ข้อ", pg: 14, body: typeChecks, done: () => S.info.types.length > 0 },
  { id: "class", no: "หัวแบบฟอร์ม", ask: "เรียนอยู่แผนก สาขา ชั้นไหน", hint: "ข้อมูลนี้อยู่หัวแบบฟอร์ม คพ. ทุกฉบับ และบนปกรายงาน", pg: 14,
    body: () => `<div class="ro">ระดับ ${S.info.level}. (ตามห้องเรียนที่ครูสร้าง)</div>` + fText("info.dept", "แผนกวิชา") + fText("info.major", "สาขาวิชา") + fText("info.track", "สาขางาน") +
      `<div class="row">${fText("info.year", "ชั้นปีที่", { type: "number" })}${fText("info.group", "กลุ่ม")}${fText("info.room", "ห้อง")}</div>`, done: () => filled(S.info.dept) && filled(S.info.major) },
  { id: "members", no: "ข้อ 3", ask: "ใครอยู่ในคณะผู้จัดทำบ้าง", pg: 4,
    hint: () => `${S.info.level}. สมาชิกไม่เกิน ${P.limit} คนต่อ 1 โครงงาน เลือกตัวแทนกลุ่มที่จะลงชื่อเป็นผู้เสนอโครงงาน (หัวหน้าโครงงานวิจัย) ด้านล่าง`,
    body: () => (P.joinCode ? `<div class="note">ชวนเพื่อนเข้ากลุ่ม: ให้เพื่อนเลือก “เข้าร่วมกลุ่ม” แล้วกรอกรหัส <b class="code" style="font-size:20px">${P.joinCode}</b></div>` : "") +
      fList("members", "", memberFields, { add: "เพิ่มสมาชิก", newKey: "member", itemLabel: "คนที่" }) + (S.members.length > P.limit ? `<div class="warnbox">เกิน ${P.limit} คนตามคู่มือหน้า 4 ต้องให้ครูอนุมัติก่อน</div>` : "") + repPicker(),
    done: () => members().length > 0 && members().every((m) => m.sid) },
  { id: "advisor", no: "ข้อ 4", ask: "ครูที่ปรึกษาโครงงานคือใคร", hint: "แต่ละโครงงานมีครูที่ปรึกษาและครูที่ปรึกษาร่วม", pg: 4,
    body: () => fText("advisors.main", "4.1 ครูที่ปรึกษาหลัก", { ph: "นาย/นาง/นางสาว…" }) + fText("advisors.co", "4.2 ครูที่ปรึกษาร่วม") + fText("advisors.teacher", "ครูผู้สอนรายวิชาโครงงาน (ใช้ในคำร้อง คพ.02–06)"),
    done: () => filled(S.advisors.main) },
  { id: "bg1", no: "ข้อ 5 · ย่อหน้าที่ 1 จาก 4", ask: "ปัจจุบันมีสภาพหรือสถานการณ์อย่างไร", pg: 15,
    hint: "เล่าสภาพทั่วไปที่เกี่ยวข้องกับโครงงานที่จะทำ ขึ้นต้นด้วยคำว่า “ปัจจุบัน…”", body: () => fArea("ch1.bg.0", "", { rows: 7, max: 500 }), done: () => filled(S.ch1.bg[0]) },
  { id: "bg2", no: "ข้อ 5 · ย่อหน้าที่ 2 จาก 4", ask: "จากสภาพนั้น นักเรียนพบปัญหาอะไร", pg: 15,
    hint: "บอกปัญหาที่เกิดจากสภาพในย่อหน้าแรก และอ้างอิงแหล่งข้อมูลที่เชื่อถือได้ เช่น (ชื่อผู้แต่ง, ปี) แล้วเพิ่มแหล่งนั้นในข้อ 16", body: () => fArea("ch1.bg.1", "", { rows: 7, max: 500 }), done: () => filled(S.ch1.bg[1]) },
  { id: "bg3", no: "ข้อ 5 · ย่อหน้าที่ 3 จาก 4", ask: "ที่ผ่านมามีวิธีแก้ปัญหานี้อย่างไร และยังมีข้อบกพร่องอะไร", pg: 15,
    hint: "บอกแนวทางแก้ปัญหาที่มีผู้ดำเนินการมาแล้วหลายแนวทาง แต่ยังมีข้อบกพร่อง และสามารถพัฒนาต่อได้", body: () => fArea("ch1.bg.2", "", { rows: 7, max: 500 }), done: () => filled(S.ch1.bg[2]) },
  { id: "bg4", no: "ข้อ 5 · ย่อหน้าที่ 4 จาก 4", ask: "นักเรียนจะนำเทคโนโลยีหรือวิธีอะไรมาแก้ปัญหานี้", pg: 15,
    hint: "นำเสนอแนวทางแก้ปัญหาที่คาดว่ายังพัฒนาต่อได้ ทั้ง 4 ย่อหน้ารวมกันไม่ควรเกิน 1 หน้ากระดาษโดยประมาณ",
    body: () => fArea("ch1.bg.3", "", { rows: 7, max: 500 }) + `<p class="hint">รวม 4 ย่อหน้า ${S.ch1.bg.join("").length.toLocaleString()} ตัวอักษร (1 หน้า ≈ 1,400 ตัวอักษร)</p>`, done: () => filled(S.ch1.bg[3]) },
  { id: "obj", no: "ข้อ 6–7", ask: "ตรวจวัตถุประสงค์และสมมติฐาน", pg: 16,
    hint: "คู่มือกำหนดวัตถุประสงค์เชิงพฤติกรรม 3 ข้อที่วัดผลได้ ระบบเติมชื่อนวัตกรรมให้ ถ้าชื่อผิด แก้ที่คำถามก่อนหน้า",
    body: () => `<div class="ro"><b>6. วัตถุประสงค์</b><ol>${objectives().map((o) => `<li>${esc(o)}</li>`).join("")}</ol></div>
      <label class="chk"><input type="checkbox" data-bool="ch1.hypo"${S.ch1.hypo ? " checked" : ""}> ใส่ข้อ 7 สมมติฐาน (ถ้ามี)</label>${S.ch1.hypo ? `<div class="ro"><b>7. สมมติฐาน</b><ol>${hypotheses().map((o) => `<li>${esc(o)}</li>`).join("")}</ol></div>` : ""}`,
    done: () => filled(S.info.innov) },
  { id: "spec", no: "ข้อ 8.1", ask: "สิ่งที่จะสร้างมีคุณสมบัติหรือสเปคอะไร", pg: 16,
    hint: "ระบุกรอบที่จะสร้าง/พัฒนานวัตกรรมครั้งนี้ เช่น ขนาด วัสดุ อุปกรณ์หลัก และความสามารถ", body: () => fArea("ch1.spec", "", { rows: 6 }), done: () => filled(S.ch1.spec) },
  { id: "pop", no: "ข้อ 8.2", ask: "ใครคือประชากรและกลุ่มตัวอย่าง", pg: 16,
    hint: "ระบุประชากรและกลุ่มตัวอย่างที่ใช้ และวิธีการที่ได้มาให้ชัดเจน",
    ex: "ประชากร ได้แก่ นักเรียน ระดับชั้น ปวช.2 แผนกวิชาคอมพิวเตอร์ธุรกิจ จำนวน 40 คน · กลุ่มตัวอย่าง ได้แก่ นักเรียน ระดับชั้น ปวช.2/1 แผนกวิชาคอมพิวเตอร์ธุรกิจ จำนวน 20 คน โดยการเลือกแบบเจาะจง",
    body: () => fText("ch1.popUser", "ประชากร (ผู้ใช้งาน)") + fText("ch1.sampleUser", "กลุ่มตัวอย่าง") + `<div class="row">${fText("ch1.sampleN", "จำนวนกลุ่มตัวอย่าง (คน)", { type: "number" })}${fSelect("ch1.sampling", "วิธีได้มา", ["สุ่มแบบเจาะจง", "สุ่มอย่างง่าย", "สุ่มแบบบังเอิญ", "สุ่มแบบแบ่งชั้น"])}</div>` +
      `<div class="row">${fText("ch1.expertsN", "จำนวนผู้เชี่ยวชาญ (คน)", { type: "number" })}${fSelect("ch3.expertSampling", "วิธีเลือกผู้เชี่ยวชาญ", ["เลือกแบบเจาะจง", "สุ่มอย่างง่าย"])}</div>`,
    done: () => filled(S.ch1.popUser) && filled(S.ch1.sampleN) },
  { id: "time", no: "ข้อ 8.4", ask: "จะดำเนินโครงงานช่วงเดือนไหน", pg: 16, hint: "ใช้ในขอบเขตด้านเวลาของ คพ.01 และบทที่ 1",
    body: () => fText("info.term", "ภาคเรียนที่") + fText("ch1.from", "ตั้งแต่เดือน", { ph: "พฤศจิกายน 2569" }) + fText("ch1.to", "ถึงเดือน", { ph: "กุมภาพันธ์ 2570" }), done: () => filled(S.ch1.from) && filled(S.ch1.to) },
  { id: "tests", no: "ข้อ 8 และ 10", ask: "จะทดสอบประสิทธิภาพอย่างไร", pg: 45,
    hint: "อธิบายขั้นตอนการทดสอบประสิทธิภาพการทำงานของนวัตกรรม แล้วตั้งชื่อด้านที่จะทดสอบ ผลจริงค่อยบันทึกตอนทดลอง",
    body: () => fArea("ch1.testSteps", "ขั้นตอนการทดสอบ", { rows: 4 }) + fList("ch3.perf", "ด้านที่ทดสอบ", (p) => fText(p + ".name", "ชื่อด้าน", { ph: "เช่น ความแม่นยำของการวัด" }), { add: "เพิ่มด้าน", newKey: "perf", itemLabel: "ด้าน" }),
    done: () => filled(S.ch1.testSteps) && S.ch3.perf.length > 0 },
  { id: "terms", no: "ข้อ 9", ask: "คำสำคัญในโครงงานนี้หมายถึงอะไร", pg: 16,
    hint: "อธิบายความหมายเฉพาะคำที่สำคัญ ใช้เฉพาะในโครงงานนี้เท่านั้น เช่น ชื่อนวัตกรรม คุณภาพ ประสิทธิภาพ ความพึงพอใจ",
    ex: "เครื่องให้อาหารปลาอัตโนมัติ หมายถึง อุปกรณ์ที่ผู้วิจัยออกแบบและสร้างขึ้นเพื่อจ่ายอาหารปลาในเวลาที่กำหนดโดยอัตโนมัติ (ตัวอย่างในคู่มือ หน้า 46)",
    body: () => `<button class="btn sm" type="button" data-act="termdefaults">ใส่หัวข้อคำศัพท์พื้นฐาน 4 คำ</button>` + fList("ch1.terms", "", (p) => fText(p + ".t", "คำศัพท์") + fArea(p + ".d", "หมายถึง", { rows: 3 }), { add: "เพิ่มคำศัพท์", newKey: "term", itemLabel: "คำที่" }),
    done: () => S.ch1.terms.some((t) => t.t && t.d) },
  { id: "method", no: "ข้อ 10", ask: "จะสร้างหรือพัฒนานวัตกรรมเป็นขั้นตอนอย่างไร", pg: 17,
    hint: "เขียนวิธีดำเนินการให้ผู้อ่านเข้าใจพอสังเขป ข้อ 10.2–10.5 ระบบเรียบเรียงจากคำตอบข้ออื่น (ประชากร เครื่องมือ การเก็บข้อมูล สถิติ)",
    body: () => fList("ch3.steps", "ขั้นตอน (ใช้วาดแผนผังภาพที่ 3.1 ด้วย)", null, { add: "เพิ่มขั้นตอน", ph: "เช่น ออกแบบวงจร" }) + fArea("ch3.process", "คำอธิบายเพิ่มเติม (ถ้ามี)", { rows: 4 }),
    done: () => S.ch3.steps.filter(Boolean).length >= 3 },
  { id: "benefit", no: "ข้อ 11", ask: "โครงงานนี้จะเกิดประโยชน์อะไร", pg: 17,
    hint: "ระบุประโยชน์ทั้งทางตรงและทางอ้อม เป็นรายข้อตามลำดับความสำคัญ เช่น ต่อผู้ใช้ ต่อสถานศึกษา ต่อการนำไปต่อยอด และต้องสอดคล้องกับปัญหาในข้อ 5",
    body: () => fList("ch1.benefits", "", null, { add: "เพิ่มข้อ" }), done: () => S.ch1.benefits.filter(Boolean).length >= 2 },
  { id: "plan", no: "ข้อ 12", ask: "วางแผนการดำเนินงานแต่ละเดือน", pg: 18, hint: "แตะสัปดาห์ (ส.1–ส.4) ที่จะทำแต่ละขั้นตอน ช่องที่เลือกจะถูกระบายในตาราง", body: ganttMobile,
    done: () => S.plan.steps.some((s) => (s.w || []).length) },
  { id: "budget", no: "ข้อ 13", ask: "ใช้งบประมาณเท่าไร", pg: 18, hint: "ใส่รายการ จำนวน และราคาต่อหน่วย ระบบรวมเงินให้",
    body: () => fList("budget", "", (p) => fText(p + ".item", "รายการ") + `<div class="row">${fText(p + ".qty", "จำนวนหน่วย", { type: "number" })}${fText(p + ".price", "ราคาต่อหน่วย (บาท)", { type: "number" })}</div>${fText(p + ".note", "หมายเหตุ")}`, { add: "เพิ่มรายการ", newKey: "budget", itemLabel: "รายการ" }) +
      `<div class="ro">รวมเงิน <b data-live="budget">${baht(S.budget.reduce((t, r) => t + (+r.qty || 0) * (+r.price || 0), 0))}</b> บาท</div>`,
    done: () => S.budget.length > 0 },
  { id: "principle", no: "ข้อ 14", ask: "สิ่งประดิษฐ์ทำงานอย่างไร", pg: 19, hint: "ในกรณีเป็นสิ่งประดิษฐ์ ให้เขียนหลักการทำงานของสิ่งประดิษฐ์อย่างย่อ ๆ",
    body: () => fArea("principle", "", { rows: 7 }), done: () => filled(S.principle) },
  { id: "refs", no: "ข้อ 16", ask: "อ้างอิงข้อมูลจากที่ไหนบ้าง", pg: 76, hint: "เพิ่มแหล่งที่อ้างถึงในข้อ 5 ระบบเรียงตามรูปแบบ APA 6th ภาษาไทยก่อนภาษาต่างประเทศ",
    body: refsEditor, done: () => S.refs.length > 0 },
];
const kp01Pct = () => pct(KP01.map((q) => q.done()));

/* ---------------- views ---------------- */
const ICON = {
  home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/></svg>',
  write: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M14 6l4 4"/></svg>',
  view: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M6 3h9l4 4v14H6z"/><path d="M14 3v5h5M9 13h7M9 17h7"/></svg>',
  export: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 3v12M7 10l5 5 5-5M5 21h14"/></svg>',
  cls: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 7h18v12H3zM8 7V4h8v3"/></svg>',
};
let route = { name: "", args: [] };
function go(hash) { if (location.hash === hash) render(); else location.hash = hash; }
window.addEventListener("hashchange", () => { syncNow(); render(); window.scrollTo(0, 0); });

function chrome({ title, sub, back, tabs, guided }) {
  $("#appbar").hidden = false;
  $("#ttl").textContent = title || "ProjectElec";
  $("#sub").textContent = sub || "";
  const b = $("#back"); b.hidden = !back; b.onclick = () => go(back);
  const tb = $("#tabbar");
  document.body.classList.toggle("no-tabs", !!guided || !tabs);
  if (!tabs || guided) { tb.hidden = true; tb.innerHTML = ""; }
  else {
    tb.hidden = false;
    tb.style.gridTemplateColumns = `repeat(${tabs.length},1fr)`;
    tb.innerHTML = tabs.map(([h, ic, label]) => `<a href="${h}" aria-current="${location.hash.startsWith(h) || (h === "#/home" && location.hash === "") ? "page" : "false"}">${ICON[ic]}<span>${label}</span></a>`).join("");
  }
  setSync(SYNC.status);
}
const STUDENT_TABS = [["#/home", "home", "หน้าหลัก"], ["#/write", "write", "เขียน"], ["#/view", "view", "ดูเล่ม"], ["#/export", "export", "ดาวน์โหลด"]];
const TEACHER_TABS = [["#/teacher", "cls", "ห้องเรียน"]];
function setTitle() { const t = $("#ttl"); if (t && S) t.textContent = S.info.titleTh || "โครงงานของฉัน"; }

const ROUTES = {};
async function render() {
  const [, name = "", ...args] = (location.hash || "#/").split("/");
  route = { name, args };
  const view = $("#view");
  try {
    if (!ME) await loadMe();
    if (!ME || !ME.user) { if (name !== "login") return go("#/login"); return ROUTES.login(view); }
    const fn = ROUTES[name] || (ME.user.role === "student" ? ROUTES.home : ROUTES.teacher);
    await fn(view, ...args);
    updateCounters();
  } catch (e) {
    console.error(e);
    view.innerHTML = `<div class="errbox">${esc(e.error || e.message || "เกิดข้อผิดพลาด")}</div><div class="btnrow"><button class="btn" type="button" onclick="location.reload()">โหลดใหม่</button><a class="btn" href="#/">กลับหน้าหลัก</a></div>`;
  }
}
async function loadMe() {
  try { ME = await api("GET", "/api/me"); store.set("pe-me", ME); }
  catch (e) { if (e.status === 0) { ME = store.get("pe-me"); toast("ออฟไลน์: ใช้ข้อมูลที่เก็บไว้ในเครื่อง"); } else throw e; }
}
async function needProject() {
  if (P && S && ME.user.role === "student") return true;
  const id = ME.projects && ME.projects[0] && ME.projects[0].id;
  if (!id) { go("#/start"); return false; }
  try { await openProject(id); } catch (e) { if (e.redirect) { go(e.redirect); return false; } throw e; }
  return true;
}

// Group representative: signs KP.01 item 17 and the KP requests as หัวหน้าโครงงานวิจัย.
function repPicker() {
  const ms = members(); if (ms.length < 2) return "";
  const cur = Math.min(+S.info.rep || 0, ms.length - 1);
  return `<div class="f"><label>ตัวแทนกลุ่ม (ผู้เสนอโครงงาน)</label><div class="chips">${ms.map((m, i) => `<button type="button" class="chip" data-set="info.rep:${i}" aria-pressed="${i === cur}">${esc(memberName(m) || "คนที่ " + (i + 1))}</button>`).join("")}</div></div>`;
}
/* ----- login / register ----- */
let authMode = "student-login";
ROUTES.login = (view) => {
  $("#appbar").hidden = true; $("#tabbar").hidden = true; document.body.classList.add("no-tabs");
  const cc = store.get("pe-last-class") || "";
  const forms = {
    "student-login": `<form class="card" data-form="student-login"><h2>นักเรียนเข้าสู่ระบบ</h2>
      <div class="f"><label for="l_cc">รหัสห้อง (ได้จากครู)</label><input id="l_cc" name="classCode" type="text" autocapitalize="characters" autocomplete="off" value="${esc(cc)}" required></div>
      <div class="f"><label for="l_sid">รหัสนักศึกษา</label><input id="l_sid" name="studentId" type="text" inputmode="numeric" autocomplete="username" required></div>
      <div class="f"><label for="l_pw">รหัสผ่าน</label><input id="l_pw" name="password" type="password" autocomplete="current-password" required></div>
      <button class="btn pri block" type="submit">เข้าสู่ระบบ</button>
      <button class="btn ghost block" type="button" data-auth="student-register">ยังไม่มีบัญชี? ลงทะเบียนครั้งแรก</button>
      <p class="hint">ลืมรหัสผ่าน ให้ครูผู้สอนรีเซ็ตให้</p></form>`,
    "student-register": `<form class="card" data-form="student-register"><h2>ลงทะเบียนนักเรียน</h2>
      <div class="f"><label for="r_cc">รหัสห้อง (ได้จากครู)</label><input id="r_cc" name="classCode" type="text" autocapitalize="characters" autocomplete="off" value="${esc(cc)}" required></div>
      <div class="f"><label for="r_sid">รหัสนักศึกษา</label><input id="r_sid" name="studentId" type="text" inputmode="numeric" required></div>
      <div class="f"><label for="r_name">ชื่อ-นามสกุล</label><input id="r_name" name="displayName" type="text" autocomplete="name" required></div>
      <div class="f"><label for="r_pw">ตั้งรหัสผ่าน (อย่างน้อย 6 ตัว)</label><input id="r_pw" name="password" type="password" autocomplete="new-password" minlength="6" required></div>
      <div class="f"><label for="r_pw2">พิมพ์รหัสผ่านอีกครั้ง</label><input id="r_pw2" name="password2" type="password" autocomplete="new-password" required></div>
      <button class="btn pri block" type="submit">ลงทะเบียน</button>
      <button class="btn ghost block" type="button" data-auth="student-login">มีบัญชีแล้ว? เข้าสู่ระบบ</button></form>`,
    "teacher-login": `<form class="card" data-form="teacher-login"><h2>ครูเข้าสู่ระบบ</h2>
      <div class="f"><label for="t_u">ชื่อผู้ใช้</label><input id="t_u" name="username" type="text" autocapitalize="none" autocomplete="username" required></div>
      <div class="f"><label for="t_pw">รหัสผ่าน</label><input id="t_pw" name="password" type="password" autocomplete="current-password" required></div>
      <button class="btn pri block" type="submit">เข้าสู่ระบบ</button>
      <button class="btn ghost block" type="button" data-auth="teacher-register">สร้างบัญชีครู (ต้องมีรหัสเชิญ)</button></form>`,
    "teacher-register": `<form class="card" data-form="teacher-register"><h2>สร้างบัญชีครู</h2>
      <div class="f"><label for="tr_i">รหัสเชิญครู</label><input id="tr_i" name="inviteCode" type="text" autocomplete="off" required></div>
      <div class="f"><label for="tr_u">ชื่อผู้ใช้ (อังกฤษ/ตัวเลข)</label><input id="tr_u" name="username" type="text" autocapitalize="none" required></div>
      <div class="f"><label for="tr_n">ชื่อที่แสดง</label><input id="tr_n" name="displayName" type="text" required></div>
      <div class="f"><label for="tr_pw">รหัสผ่าน (อย่างน้อย 8 ตัว)</label><input id="tr_pw" name="password" type="password" autocomplete="new-password" minlength="8" required></div>
      <button class="btn pri block" type="submit">สร้างบัญชี</button>
      <button class="btn ghost block" type="button" data-auth="teacher-login">มีบัญชีแล้ว? เข้าสู่ระบบ</button></form>`,
  };
  const isT = authMode.startsWith("teacher");
  view.innerHTML = `<div class="auth" style="display:flex;flex-direction:column;gap:16px;padding-top:12px">
    <div class="brandmark"><div class="bk">คพ.</div><div><h1 style="font-size:22px">ProjectElec</h1><p class="lead">ทำเอกสารรายวิชาโครงงานได้ครบจากมือถือ ตามคู่มือวิทยาลัยเทคนิคสมุทรปราการ</p></div></div>
    <div class="seg" role="group" aria-label="บทบาท"><button type="button" data-auth="student-login" aria-pressed="${!isT}">นักเรียน</button><button type="button" data-auth="teacher-login" aria-pressed="${isT}">ครู</button></div>
    ${forms[authMode]}<div id="autherr" class="errbox" hidden></div></div>`;
};
async function submitAuth(form) {
  const kind = form.dataset.form; const fd = Object.fromEntries(new FormData(form));
  const err = $("#autherr"); err.hidden = true;
  if (kind === "student-register" && fd.password !== fd.password2) { err.textContent = "รหัสผ่านสองช่องไม่ตรงกัน"; err.hidden = false; return; }
  const url = { "student-login": "/api/auth/student/login", "student-register": "/api/auth/student/register", "teacher-login": "/api/auth/teacher/login", "teacher-register": "/api/auth/teacher/register" }[kind];
  const btn = form.querySelector("[type=submit]"); btn.disabled = true;
  try {
    await api("POST", url, fd);
    if (fd.classCode) store.set("pe-last-class", fd.classCode.toUpperCase());
    ME = null; P = null; S = null; await loadMe();
    go(ME.user.role === "student" ? "#/home" : "#/teacher");
  } catch (e) { err.textContent = e.error; err.hidden = false; }
  finally { btn.disabled = false; }
}

/* ----- student: start (no project yet) ----- */
ROUTES.start = async (view) => {
  if (ME.user.role !== "student") return go("#/teacher");
  if (!ME.class) { ME = null; await loadMe(); }
  if (!ME.class) { chrome({ title: "เริ่มโครงงาน", tabs: null }); view.innerHTML = `<div class="errbox">ไม่พบห้องเรียนของบัญชีนี้ ให้ครูตรวจสอบรหัสห้อง หรือออกจากระบบแล้วลงทะเบียนใหม่ด้วยรหัสห้องที่ถูกต้อง</div><button class="btn" type="button" data-act="logout">ออกจากระบบ</button>`; return; }
  if (ME.projects && ME.projects.length) return go("#/home");
  chrome({ title: "เริ่มโครงงาน", sub: ME.class ? `ห้อง ${ME.class.name} · ${ME.class.level}.` : "", tabs: null });
  const old = store.get(PEEngine.KEY);
  view.innerHTML = `<h2>สวัสดี ${esc(ME.user.display_name)}</h2><p class="lead">เริ่มจากสร้างโครงงาน หรือเข้าร่วมกลุ่มที่เพื่อนสร้างไว้แล้ว</p>
   <div class="card"><h3>ฉันเป็นหัวหน้ากลุ่ม</h3><p class="hint">สร้างโครงงานใหม่ แล้วส่งรหัสกลุ่มให้เพื่อน (${ME.class.level}. ไม่เกิน ${ME.class.level === "ปวส" ? 2 : 3} คน)</p>
     <button class="btn pri" type="button" data-act="newproject">สร้างโครงงานใหม่</button>
     ${old && old.info && !old.example ? `<button class="btn" type="button" data-act="newproject:import">สร้างจากข้อมูลเดิมในเครื่องนี้ (${esc(old.info.titleTh || "ไม่มีชื่อ")})</button>` : ""}
     <button class="btn ghost" type="button" data-act="import">สร้างจากไฟล์สำรอง .json</button></div>
   <form class="card" data-form="join"><h3>เข้าร่วมกลุ่มของเพื่อน</h3><div class="f"><label for="j_c">รหัสกลุ่ม 6 ตัว</label><input id="j_c" name="joinCode" type="text" autocapitalize="characters" autocomplete="off" required></div>
     <button class="btn" type="submit">เข้าร่วมกลุ่ม</button><div id="joinerr" class="errbox" hidden></div></form>
   <button class="btn ghost" type="button" data-act="logout">ออกจากระบบ</button>`;
};
async function createProject(state) {
  const r = await api("POST", "/api/projects", state ? { state } : {});
  ME = null; await loadMe(); P = null; await openProject(r.id);
  if (pendingImages(S).length) { markDirty("photos"); }
  go("#/home");
}

/* ----- student: home ----- */
const SECTIONS = [
  { id: "kp01", label: "แบบเสนอโครงงาน คพ.01", sub: "ตอบทีละคำถาม 22 ข้อ", href: "#/kp01/0", p: () => kp01Pct() },
  { id: "info", label: "ข้อมูลโครงงานและสมาชิก", sub: "ปก ชื่อภาษาอังกฤษ ประวัติผู้วิจัย", p: () => pct([S.info.titleTh, S.info.titleEn, S.info.innov, S.info.major, members().length, S.advisors.main]) },
  { id: "ch1", label: "บทที่ 1 บทนำ", sub: "ส่วนใหญ่มาจาก คพ.01", p: () => pct([...S.ch1.bg, S.ch1.spec, S.ch1.testSteps, S.ch1.sampleN, S.ch1.from, S.ch1.terms.length, S.ch1.benefits.filter(Boolean).length]) },
  { id: "ch2", label: "บทที่ 2 แนวคิด ทฤษฎี", sub: "หัวข้อทฤษฎี งานวิจัย บรรณานุกรม", p: () => pct([S.ch2.topics.filter((t) => t.title && t.body).length >= 3, S.ch2.related.length >= 3, S.refs.length >= 3]) },
  { id: "ch3", label: "บทที่ 3 วิธีดำเนินการ", sub: "ภาพชิ้นงาน แบบสอบถาม ด้านทดสอบ", p: () => pct([S.ch3.steps.filter(Boolean).length, S.ch3.expertItems.length >= 5, S.ch3.perf.length, S.ch3.sat.length, S.ch3.photo]) },
  { id: "data", label: "บทที่ 4 ผลการเก็บข้อมูล", sub: "คะแนนผู้เชี่ยวชาญ ผลทดลอง ความพึงพอใจ", p: () => pct([likert(S.data.expertScores, S.ch3.expertItems).n, satStats().n, S.ch3.perf.some((p) => p.rows.length), iocStats().length]) },
  { id: "ch5", label: "บทที่ 5 สรุปผล", sub: "อภิปรายผลและข้อเสนอแนะ", p: () => pct([S.ch5.whyExpert, S.ch5.whyPerf, S.ch5.whyUser]) },
  { id: "front", label: "บทคัดย่อและภาคผนวก", sub: "บทคัดย่อ 2 ภาษา คู่มือ ภาพกิจกรรม", p: () => pct([S.info.kwTh, S.info.kwEn, S.front.absEn || S.info.innovEn, S.photos.length, S.manual.steps.length]) },
  { id: "plan", label: "คำร้อง คพ.02 / 04 / 06", sub: "วันสอบ เวลา ห้อง", p: () => pct([S.forms.kp02, S.forms.kp04a.date, S.forms.kp04b.date, S.forms.kp06.date]) },
];
ROUTES.home = async (view) => {
  if (!(await needProject())) return;
  chrome({ title: S.info.titleTh || "โครงงานของฉัน", sub: ME.class ? `ห้อง ${ME.class.name} · ${S.info.level}.` : "", tabs: STUDENT_TABS });
  const start = (ME.class && ME.class.semester_start) || S.startDate; const wk = weekNo(start);
  const cal = CALENDAR.find((c) => c[0] === wk);
  view.innerHTML = `<div class="card hero"><div class="hwk">${cal ? `สัปดาห์ที่ ${wk} จาก 18` : wk > 18 ? "หลังสัปดาห์ที่ 18" : "ก่อนเปิดภาคเรียน"}</div>
      <h2>${cal ? esc(cal[1]) : "ดูปฏิทิน 18 สัปดาห์ด้านล่าง"}</h2>${cal && cal[2].length ? `<div>${cal[2].map((d) => `<span class="kp">${d}</span>`).join(" ")}</div>` : ""}</div>
    <a class="row-link" href="#/kp01/${firstOpenQ()}"><div><b>ทำ คพ.01 ต่อ</b></div><small>${KP01.filter((q) => q.done()).length} จาก ${KP01.length} คำถาม</small>${meter(kp01Pct())}</a>
    <div class="card"><h3>กลุ่มของเรา (${P.members.length}/${P.limit} คน)</h3>
      <ul class="list">${P.members.map((m) => `<li>${esc(m.display_name)} <span class="hint">${esc(m.student_id)}</span></li>`).join("")}</ul>
      ${P.joinCode && P.members.length < P.limit ? `<p class="hint">ให้เพื่อนเข้าร่วมด้วยรหัสกลุ่ม</p><div class="code">${P.joinCode}</div>` : ""}</div>
    <p class="sectitle">ปฏิทินรายวิชา ภาคเรียนที่ 2/2569 (คู่มือ หน้า ค–ง)</p>
    <div class="weeks">${CALENDAR.map(([n, t, d]) => `<div class="wk${n === wk ? " now" : ""}"><span class="wn">ส.${n}</span><span>${esc(t)}</span>${d.length ? `<span class="docs">${d.map((x) => `<span class="kp">${x}</span>`).join("")}</span>` : ""}</div>`).join("")}</div>
    <div class="btnrow"><a class="btn" href="#/history">ประวัติการแก้ไข</a><button class="btn ghost" type="button" data-act="logout">ออกจากระบบ</button></div>`;
};
const firstOpenQ = () => Math.max(0, KP01.findIndex((q) => !q.done()));

/* ----- student: write (all sections) ----- */
ROUTES.write = async (view) => {
  if (!(await needProject())) return;
  chrome({ title: "เขียนเอกสาร", sub: S.info.titleTh, tabs: STUDENT_TABS });
  view.innerHTML = `<p class="lead">เริ่มจาก คพ.01 ก่อน เนื้อหาบทที่ 1 ส่วนใหญ่จะเติมให้จากคำตอบใน คพ.01</p>
    <ul class="list">${SECTIONS.map((s) => { const p = s.p(); return `<li><a class="row-link" href="${s.href || "#/edit/" + s.id}"><div><b>${s.label}</b></div><small>${s.sub}</small>${meter(p)}</a></li>`; }).join("")}</ul>`;
};

/* ----- student: guided KP.01 ----- */
ROUTES.kp01 = async (view, i = "0") => {
  if (!(await needProject())) return;
  const idx = Math.max(0, Math.min(KP01.length, +i || 0));
  chrome({ title: "แบบเสนอโครงงาน คพ.01", sub: S.info.titleTh, back: "#/write", guided: true });
  if (idx === KP01.length) return kp01Review(view);
  const q = KP01[idx];
  const hint = typeof q.hint === "function" ? q.hint() : q.hint;
  view.innerHTML = `<div class="qcard">
    <div class="qhead"><span>${esc(q.no)}</span><a href="#/kp01list">ข้อ ${idx + 1}/${KP01.length} ▾</a></div>
    <div class="qbar"><i style="width:${Math.round((idx / KP01.length) * 100)}%"></i></div>
    <h2 class="qask">${esc(q.ask)}</h2>
    ${hint ? `<div class="qhint"><b>คู่มือบอกว่า</b> ${esc(hint)}${q.pg ? ` <span class="hint">(หน้า ${q.pg})</span>` : ""}</div>` : ""}
    ${q.ex ? `<details class="qex"><summary>ดูตัวอย่างจากคู่มือ</summary><p style="margin:8px 0 0">${esc(q.ex)}</p><p class="hint">ตัวอย่างนี้ใช้ดูรูปแบบเท่านั้น ให้เขียนข้อมูลจริงของโครงงานตัวเอง</p></details>` : ""}
    <div class="form" ${P.canWrite ? "" : "inert"}>${q.body()}</div></div>
    <nav class="qnav"><a class="btn" href="#/kp01/${Math.max(0, idx - 1)}" ${idx === 0 ? 'aria-disabled="true" style="visibility:hidden"' : ""}>‹ ก่อนหน้า</a>
      <span class="mid">${q.done() ? "✓ ตอบแล้ว" : "ยังไม่ครบ ข้ามไปก่อนได้"}</span>
      <a class="btn pri" href="#/kp01/${idx + 1}">${idx === KP01.length - 1 ? "ตรวจทั้งหมด" : "ถัดไป ›"}</a></nav>`;
  const first = view.querySelector(".form textarea, .form input[type=text]");
  if (first && !first.value && window.innerWidth > 700) first.focus();
};
ROUTES.kp01list = async (view) => {
  if (!(await needProject())) return;
  chrome({ title: "คำถามทั้งหมดใน คพ.01", back: "#/kp01/0", guided: true });
  view.innerHTML = `<ul class="list qlist">${KP01.map((q, i) => `<li><a href="#/kp01/${i}"><i class="d ${q.done() ? "on" : ""}"></i><span><b>${esc(q.no)}</b> ${esc(q.ask)}</span></a></li>`).join("")}</ul>
    <a class="btn pri block" href="#/kp01/${KP01.length}">ตรวจและดาวน์โหลด คพ.01</a>`;
};
function kp01Review(view) {
  const missing = KP01.map((q, i) => [q, i]).filter(([q]) => !q.done());
  view.innerHTML = `<h2 class="qask">ตรวจแบบเสนอโครงงานก่อนส่ง</h2>
    ${missing.length ? `<div class="warnbox">ยังไม่ครบ ${missing.length} ข้อ</div><ul class="list qlist">${missing.map(([q, i]) => `<li><a href="#/kp01/${i}"><i class="d"></i><span><b>${esc(q.no)}</b> ${esc(q.ask)}</span></a></li>`).join("")}</ul>` : `<div class="okbox">ตอบครบทุกข้อแล้ว</div>`}
    <div class="btnrow"><a class="btn pri" href="#/view/kp01">ดูตัวอย่าง A4</a><button class="btn" type="button" data-dl="kp01:pdf">ดาวน์โหลด PDF</button><button class="btn" type="button" data-dl="kp01:docx">Word</button></div>
    <p class="hint">พิมพ์แล้วลงชื่อด้วยมือในช่อง “ผู้เสนอโครงงาน” และให้ครูลงชื่อรับรองตามคู่มือ</p>
    <nav class="qnav"><a class="btn" href="#/kp01/${KP01.length - 1}">‹ ก่อนหน้า</a><span class="mid"></span><a class="btn" href="#/write">เสร็จ</a></nav>`;
}

/* ----- student: detailed editors ----- */
const EDITORS = { info: () => rInfo(), ch1: () => rCh1(), ch2: () => rCh2(), ch3: () => rCh3(), data: () => rData(), ch5: () => rCh5(), front: () => rFront(), plan: () => rPlan() };
ROUTES.edit = async (view, id) => {
  if (!(await needProject())) return;
  const s = SECTIONS.find((x) => x.id === id); if (!EDITORS[id]) return go("#/write");
  chrome({ title: s.label, sub: S.info.titleTh, back: "#/write", tabs: STUDENT_TABS });
  view.innerHTML = `<div class="form" ${P.canWrite ? "" : "inert"}>${EDITORS[id]()}</div>
    <a class="btn block" href="#/view/${id === "plan" ? "kp02" : id === "kp01" ? "kp01" : "report"}">ดูตัวอย่าง A4</a>`;
};

/* ----- A4 preview: real pages rendered by the server ----- */
const DOCS = [["kp01", "คพ.01"], ["kp02", "คพ.02"], ["kp03", "คพ.03"], ["kp04_1", "คพ.04 (1)"], ["kp04_2", "คพ.04 (2)"], ["kp05_1", "คพ.05 (1)"], ["kp05_2", "คพ.05 (2)"], ["kp06", "คพ.06"], ["kp07", "คพ.07"], ["kp08", "คพ.08"], ["report", "รายงาน 5 บท"], ["tools", "แบบสอบถาม"]];
let pagesReq = 0;
ROUTES.view = async (view, doc = "kp01") => {
  if (!(await needProject())) return;
  chrome({ title: "ดูเอกสาร A4", sub: S.info.titleTh, tabs: STUDENT_TABS });
  view.innerHTML = `<div class="chips" role="tablist">${DOCS.map(([d, l]) => `<a class="chip" role="tab" href="#/view/${d}" aria-pressed="${d === doc}" style="text-decoration:none;color:inherit">${l}</a>`).join("")}</div>
    <div id="pages"><div class="spinner"></div><p class="hint" style="text-align:center">กำลังจัดหน้าบนเซิร์ฟเวอร์ (ครั้งแรกอาจใช้ 10–30 วินาที)</p></div>`;
  await renderPages($("#pages"), doc, P.id);
};
async function renderPages(box, doc, pid) {
  const my = ++pagesReq;
  if (P && P.canWrite) await syncNow();
  try {
    const r = await api("GET", `/api/projects/${pid}/pages?doc=${doc}`);
    if (my !== pagesReq) return;
    box.innerHTML = (doc === "report" && r.chapterPages != null ? `<div class="${r.chapterPages >= 30 ? "okbox" : "warnbox"}">เนื้อหาบทที่ 1–5 ยาว ${r.chapterPages} หน้า (คู่มือหน้า 75 กำหนดไม่น้อยกว่า 30 หน้า)</div>` : "") +
      `<p class="hint">${r.pageCount} หน้า · จัดหน้าด้วยฟอนต์ TH SarabunPSK แบบเดียวกับไฟล์ PDF</p><div class="pages">${r.pages.map((u, i) => `<div class="pagebox"><img src="${u}" alt="หน้า ${i + 1}" loading="lazy"><span class="pn">${i + 1}</span></div>`).join("")}</div>
      <div class="btnrow"><button class="btn pri" type="button" data-dl="${doc}:pdf">ดาวน์โหลด PDF</button><button class="btn" type="button" data-dl="${doc}:docx">Word</button></div>`;
  } catch (e) {
    if (my !== pagesReq) return;
    if (e.status === 0 && S) {
      const blocks = doc === "kp01" ? kp01() : doc === "forms" ? allForms() : /^kp0[2468]/.test(doc) ? E.formOf(doc) : /^kp0[357]/.test(doc) ? E.teacherForms(doc) : doc === "tools" ? [...E.questionnaireExpert(), { t: "br" }, ...E.iocForm(), { t: "br" }, ...E.questionnaireUser()] : buildReport().sections.flatMap((s) => [...s.blocks, { t: "br" }]);
      box.innerHTML = `<div class="warnbox">ออฟไลน์: แสดงตัวอย่างอย่างย่อ ตัวแบ่งหน้าจริงจะเห็นเมื่อกลับมาออนไลน์</div><div class="sheet">${blocksHTML(blocks)}</div>`;
    } else box.innerHTML = `<div class="errbox">${esc(e.error)}</div>`;
  }
}

/* ----- export ----- */
async function download(doc, format, pid = P && P.id) {
  if (P && P.canWrite && P.id === pid) { toast("กำลังบันทึกงานล่าสุด…", 1500); await syncNow(); if (SYNC.dirty.size) return toast("ยังส่งงานขึ้นระบบไม่ได้ ตรวจอินเทอร์เน็ตแล้วลองใหม่"); }
  const url = `/api/projects/${pid}/export?doc=${doc}&format=${format}`;
  const ua = navigator.userAgent;
  const ios = /iP(ad|hone|od)/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const android = /Android/i.test(ua);
  const inApp = /FBAN|FBAV|FB_IAB|FBIOS|Messenger|Instagram|\bLine\/|MicroMessenger|; wv\)/i.test(ua);
  const standalone = window.matchMedia("(display-mode: standalone)").matches || navigator.standalone;
  if (!(ios || android || inApp || standalone)) {
    toast(format === "pdf" ? "กำลังสร้าง PDF…" : "กำลังสร้างไฟล์ Word…", 6000);
    const a = document.createElement("a"); a.href = url; a.rel = "noopener";
    document.body.appendChild(a); a.click(); a.remove();
    return;
  }
  // Phones and tablets: build the file first, then give a short-lived link that works even when the phone
  // hands the download to another app (download manager, Drive PDF viewer, the browser inside Messenger/LINE),
  // which fetches the link again without the login cookie.
  toast(format === "pdf" ? "กำลังสร้าง PDF…" : "กำลังเตรียมไฟล์ Word…", 60000);
  let link;
  try { link = (await api("POST", `/api/projects/${pid}/dlink`, { doc, format, inline: ios && format === "pdf" })).url; }
  catch (e) { $$(".toast").forEach((t) => t.remove()); return toast(e.error || "สร้างไฟล์ไม่สำเร็จ ลองใหม่อีกครั้ง"); }
  $$(".toast").forEach((t) => t.remove());
  const full = location.origin + link;
  const tip = ios
    ? (format === "pdf" ? "บน iPad/iPhone: เมื่อไฟล์เปิดขึ้น แตะปุ่มแชร์ (สี่เหลี่ยมมีลูกศรขึ้น) แล้วเลือก “บันทึกไปยังไฟล์” หรือเลือก “มาร์กอัป” เพื่อเขียนข้อแก้ไขลงบนเอกสาร" : "บน iPad/iPhone: ไฟล์ Word จะเปิดเป็นตัวอย่าง แตะปุ่มแชร์แล้วเลือก “บันทึกไปยังไฟล์” หรือเปิดด้วยแอป Word")
    : "บน Android: ไฟล์จะอยู่ในโฟลเดอร์ “ดาวน์โหลด” (Downloads) เปิดได้จากแถบแจ้งเตือนหรือแอป Files";
  const html = `<p>ไฟล์${format === "pdf" ? " PDF" : " Word"} พร้อมแล้ว</p>
    <a class="btn pri block" href="${link}"${ios ? ' target="_blank"' : ""} rel="noopener" data-ws="sheetclose">${ios ? "เปิดไฟล์" : "ดาวน์โหลดไฟล์"}</a>
    <p class="hint" style="margin-top:12px">${tip}</p>
    ${inApp ? `<div class="warnbox" style="margin-top:12px">กำลังเปิดเว็บจากในแอปแชต (เช่น Messenger, LINE) ซึ่งมักดาวน์โหลดไฟล์ไม่ได้ ถ้ากดแล้วไม่มีอะไรเกิดขึ้น ให้กดเมนู ⋮ มุมขวาบนแล้วเลือก “เปิดใน Chrome” (หรือ Safari) หรือคัดลอกลิงก์ไปวางในเบราว์เซอร์</div>` : ""}
    <button class="btn ghost sm" type="button" id="dlcopy" style="margin-top:8px">คัดลอกลิงก์ไฟล์ (ใช้ได้ 30 นาที)</button>`;
  if (typeof sheetOpen === "function") {
    sheetOpen("ดาวน์โหลดเอกสาร", html);
    const c = document.getElementById("dlcopy");
    if (c) c.onclick = async () => { try { await navigator.clipboard.writeText(full); toast("คัดลอกลิงก์แล้ว"); } catch { prompt("คัดลอกลิงก์นี้", full); } };
  } else location.href = link;
}
ROUTES.export = async (view) => {
  if (!(await needProject())) return;
  chrome({ title: "ดาวน์โหลดเอกสาร", sub: S.info.titleTh, tabs: STUDENT_TABS });
  const C = checks(); const ok = C.list.filter((x) => x[0]).length;
  const card = (doc, t, d) => `<div class="card"><h3>${t}</h3><p class="hint">${d}</p><div class="btnrow"><button class="btn pri" type="button" data-dl="${doc}:pdf">PDF</button><button class="btn" type="button" data-dl="${doc}:docx">Word</button><a class="btn ghost" href="#/view/${doc}">ดู A4</a></div></div>`;
  view.innerHTML = card("kp01", "แบบเสนอโครงงาน คพ.01", "ข้อ 1–18 พร้อมแผนการดำเนินงานและงบประมาณ") +
    `<p class="sectitle">แบบฟอร์ม คพ. ตามลำดับ</p><p class="hint">คำร้องของนักเรียนกรอกข้อมูลให้แล้ว เหลือลงนาม · แบบของครูและกรรมการ (คพ.03 05 07) ถ้าครูบันทึกผลในระบบแล้วจะพิมพ์ผลให้ ถ้ายังไม่บันทึกจะเป็นแบบเปล่าให้กรอกด้วยมือ</p>` +
    card("kp02", "คพ.02 คำร้องขอสอบหัวข้อโครงงาน", "นักเรียนยื่น · สัปดาห์ที่ 3 พร้อม คพ.01") +
    card("kp03", "คพ.03 แบบสรุปผลการสอบหัวข้อโครงงาน", "ครูผู้สอนสรุปผล · สัปดาห์ที่ 4") +
    card("kp04_1", "คพ.04 คำร้องขอสอบความก้าวหน้า ครั้งที่ 1", "นักเรียนยื่น · บทที่ 1–3 · สัปดาห์ที่ 7") +
    card("kp04_2", "คพ.04 คำร้องขอสอบความก้าวหน้า ครั้งที่ 2", "นักเรียนยื่น · บทที่ 4–5 · สัปดาห์ที่ 11") +
    card("kp05_1", "คพ.05 ผลประเมินความก้าวหน้า ครั้งที่ 1", "ครูผู้สอนประเมิน พร้อมเอกสารแนบบทที่ 1–3 · สัปดาห์ที่ 8") +
    card("kp05_2", "คพ.05 ผลประเมินความก้าวหน้า ครั้งที่ 2", "ครูผู้สอนประเมิน พร้อมเอกสารแนบบทที่ 4–5 · สัปดาห์ที่ 12") +
    card("kp06", "คพ.06 คำร้องขอรับการประเมินผลโครงงาน", "นักเรียนยื่น พร้อมรายงานฉบับสมบูรณ์ (ยังไม่เข้าเล่ม) · สัปดาห์ที่ 13") +
    card("kp07", "คพ.07 แบบสรุปผลการประเมินโดยคณะกรรมการ", "คณะกรรมการประเมิน · สัปดาห์ที่ 14") +
    card("kp08", "คพ.08 แบบอนุญาตให้เข้าเล่มโครงงาน", "นักเรียนยื่นหลังแก้ไขตามกรรมการ · สัปดาห์ที่ 15") +
    `<p class="sectitle">รายงานและเครื่องมือ</p>` +
    card("report", "รายงานฉบับสมบูรณ์", "ปก บทคัดย่อ สารบัญ บทที่ 1–5 บรรณานุกรม ภาคผนวก ประวัติผู้วิจัย") +
    card("tools", "เครื่องมือวิจัย 3 ชุด", "แบบสอบถามผู้เชี่ยวชาญ แบบประเมิน IOC แบบสอบถามความพึงพอใจ") +
    `<div class="note">PDF สร้างบนเซิร์ฟเวอร์ด้วยฟอนต์ TH SarabunPSK เปิดบนมือถือได้ทันที ส่วนไฟล์ Word ถ้าเปิดบนคอมพิวเตอร์ ให้ตอบ “ใช่” เมื่อถามเรื่องอัปเดตฟิลด์ เพื่อให้สารบัญแสดงเลขหน้า</div>` +
    sec(`ตรวจความครบถ้วน (${ok}/${C.list.length})`, `<ul class="checks">${C.list.map(([g, t]) => `<li class="${g ? "ok" : "no"}"><span class="i">${g ? "✓" : "!"}</span><span>${esc(t)}</span></li>`).join("")}</ul><p class="hint">จำนวนหน้าจริงดูได้ที่ “ดูเล่ม” → รายงาน 5 บท</p>`) +
    sec("สำรองข้อมูล", `<p class="hint">ข้อมูลอยู่บนเซิร์ฟเวอร์แล้ว ไฟล์ .json ใช้เก็บสำรองเพิ่มเติม</p><div class="btnrow"><button class="btn" type="button" data-act="backup">บันทึกไฟล์ .json</button></div>`);
};

/* ----- history ----- */
ROUTES.history = async (view) => {
  if (!(await needProject())) return;
  chrome({ title: "ประวัติการแก้ไข", back: "#/home", tabs: STUDENT_TABS });
  const rows = await api("GET", `/api/projects/${P.id}/revisions`);
  view.innerHTML = `<p class="lead">ระบบเก็บฉบับย้อนหลังทุก 10 นาทีที่มีการแก้ไข ย้อนกลับได้ และฉบับปัจจุบันจะถูกเก็บไว้ก่อนเสมอ</p>
    <ul class="list">${rows.map((r) => `<li class="card" style="flex-direction:row;justify-content:space-between;align-items:center"><div><b>${new Date(r.created_at).toLocaleString("th-TH")}</b><div class="hint">${esc(r.display_name || "")} ${r.note ? "· " + esc(r.note) : ""}</div></div>
      ${P.canWrite ? `<button class="btn sm" type="button" data-restore="${r.id}">ย้อนกลับ</button>` : ""}</li>`).join("")}</ul>`;
};

/* ----- teacher ----- */
ROUTES.teacher = async (view) => {
  if (ME.user.role === "student") return go("#/home");
  chrome({ title: "ห้องเรียนของฉัน", sub: ME.user.display_name, tabs: TEACHER_TABS });
  view.innerHTML = `<form class="card" data-form="newclass"><h3>สร้างห้องใหม่</h3>
      ${`<div class="f"><label for="c_n">ชื่อห้อง</label><input id="c_n" name="name" type="text" placeholder="เช่น ชอ.3/1 โครงงาน 2/2569" required></div>`}
      <div class="row"><div class="f"><label for="c_l">ระดับ</label><select id="c_l" name="level"><option value="ปวช">ปวช. (กลุ่มละไม่เกิน 3 คน)</option><option value="ปวส">ปวส. (กลุ่มละไม่เกิน 2 คน)</option></select></div>
      <div class="f"><label for="c_s">วันเริ่มสัปดาห์ที่ 1</label><input id="c_s" name="semesterStart" type="date"></div></div>
      <button class="btn pri" type="submit">สร้างห้องและรับรหัสห้อง</button></form>
    <ul class="list">${(ME.classes || []).map((c) => `<li><a class="row-link" href="#/class/${c.id}"><div><b>${esc(c.name)}</b> <span class="kp">${c.code}</span></div><small>${c.level}. · นักเรียน ${c.students} คน · โครงงาน ${c.projects} กลุ่ม</small></a></li>`).join("") || `<li class="hint">ยังไม่มีห้อง สร้างห้องแล้วส่งรหัสห้องให้นักเรียนใช้ลงทะเบียน</li>`}</ul>
    <button class="btn ghost" type="button" data-act="logout">ออกจากระบบ</button>`;
};
ROUTES.class = async (view, id) => {
  const r = await api("GET", `/api/classes/${id}`);
  chrome({ title: r.class.name, sub: `รหัสห้อง ${r.class.code} · ${r.class.level}.`, back: "#/teacher", tabs: TEACHER_TABS });
  const wk = weekNo(r.class.semester_start);
  view.innerHTML = `<div class="card"><p class="hint">ให้นักเรียนลงทะเบียนด้วยรหัสห้อง</p><div class="code">${r.class.code}</div><p class="hint">${wk >= 1 && wk <= 18 ? `ตอนนี้สัปดาห์ที่ ${wk}` : "ตั้งวันเริ่มภาคเรียนเพื่อดูสัปดาห์ปัจจุบัน"}</p></div>
    <p class="sectitle">โครงงาน ${r.projects.length} กลุ่ม</p>
    <ul class="list">${r.projects.map((p) => `<li><a class="row-link" href="#/tproject/${p.id}"><div><b>${esc(p.title || "(ยังไม่ตั้งชื่อ)")}</b></div><small>${p.members.map((m) => esc(m.display_name)).join(", ")} · ${p.members.length}/${p.limit} คน · แก้ล่าสุด ${new Date(p.updated_at).toLocaleDateString("th-TH")}</small>${meter(p.progress.kp01)}</a></li>`).join("") || `<li class="hint">ยังไม่มีกลุ่ม</li>`}</ul>
    <p class="sectitle">นักเรียน ${r.students.length} คน</p>
    <div class="tbl"><table><tr><th>รหัส</th><th>ชื่อ</th><th></th></tr>${r.students.map((s) => `<tr><td class="n">${esc(s.student_id)}</td><td>${esc(s.display_name)}</td><td><button class="btn sm" type="button" data-reset="${r.class.id}:${s.id}:${esc(s.display_name)}">รีเซ็ตรหัสผ่าน</button></td></tr>`).join("")}</table></div>`;
};
ROUTES.tproject = async (view, id, doc = "kp01") => {
  const r = await api("GET", `/api/projects/${id}`);
  const st = PEEngine.normalize(r.state);
  chrome({ title: st.info.titleTh || "(ยังไม่ตั้งชื่อ)", sub: r.members.map((m) => m.display_name).join(", "), back: "#/teacher", tabs: TEACHER_TABS });
  view.innerHTML = `<div class="card"><h3>สมาชิก ${r.members.length}/${r.limit} คน</h3><p class="hint">คู่มือหน้า 4 กำหนด ${r.level}. ไม่เกิน ${r.level === "ปวส" ? 2 : 3} คน ถ้าอนุมัติให้เกิน ปรับจำนวนได้ที่นี่</p>
      <div class="row"><div class="f"><label for="lim">จำนวนสมาชิกสูงสุดของกลุ่มนี้</label><input id="lim" type="number" min="1" max="6" value="${r.limit}"></div><div class="f" style="justify-content:flex-end"><button class="btn sm" type="button" data-limit="${id}">บันทึก</button></div></div></div>
    <div class="chips">${DOCS.map(([d, l]) => `<a class="chip" href="#/tproject/${id}/${d}" aria-pressed="${d === doc}" style="text-decoration:none;color:inherit">${l}</a>`).join("")}</div>
    <div id="pages"><div class="spinner"></div></div>`;
  await renderPages($("#pages"), doc, id);
};

/* ---------------- events ---------------- */
function liveUpdateSafe(k) { try { liveUpdate(k); } catch (e) { /* editors not on screen */ } }
document.addEventListener("input", (e) => {
  const el = e.target;
  if (el.dataset.k && S) { setPath(S, el.dataset.k, el.value); markDirty(el.dataset.k); liveUpdateSafe(el.dataset.k); if (el.dataset.count) updateCounters(); }
});
document.addEventListener("change", async (e) => {
  const el = e.target;
  if (!S && !el.matches("#importfile")) return;
  if (el.dataset.k && (el.tagName === "SELECT" || el.type === "date")) {
    setPath(S, el.dataset.k, el.value); markDirty(el.dataset.k);
    if (/\.type$/.test(el.dataset.k) || ["info.verb", "ch3.expertSampling"].includes(el.dataset.k)) render();
    return;
  }
  if (el.dataset.bool) { setPath(S, el.dataset.bool, el.checked); markDirty(el.dataset.bool); if (el.dataset.bool === "ch1.hypo") render(); return; }
  if (el.dataset.type) { const t = new Set(S.info.types); el.checked ? t.add(el.dataset.type) : t.delete(el.dataset.type); S.info.types = [...t]; markDirty("info.types"); return; }
  if (el.dataset.week) {
    const [i, j] = el.dataset.week.split(":").map(Number); const s = S.plan.steps[i]; s.w = s.w || [];
    if (el.checked) { if (!s.w.includes(j)) s.w.push(j); } else s.w = s.w.filter((x) => x !== j);
    markDirty(`plan.steps.${i}.w`); const chip = el.closest(".chip"); if (chip) chip.setAttribute("aria-pressed", el.checked); return;
  }
  if (el.dataset.photo && el.files[0]) {
    try { const o = await loadImg(el.files[0], +el.dataset.max || 1600); setPath(S, el.dataset.photo, o); markDirty(el.dataset.photo); render(); }
    catch (err) { toast(err.message); }
    return;
  }
  if (el.dataset.photos) {
    const lp = el.dataset.photos === "1" ? "photos" : el.dataset.photos; const arr = getPath(S, lp) || []; setPath(S, lp, arr);
    for (const f of el.files) { try { const o = await loadImg(f, 1400); o.cap = ""; arr.push(o); } catch (err) { toast(err.message); } }
    markDirty(lp); render(); return;
  }
  if (el.id === "importfile" && el.files[0]) {
    try { const j = JSON.parse(await el.files[0].text()); if (!j || !j.info) throw new Error("ไม่ใช่ไฟล์ของระบบนี้"); await createProject(j); }
    catch (err) { toast("เปิดไฟล์ไม่ได้: " + (err.message || err.error)); }
    el.value = "";
  }
});
document.addEventListener("submit", (e) => {
  const f = e.target.closest("form[data-form]"); if (!f) return; e.preventDefault();
  const kind = f.dataset.form;
  if (window.P1_FORMS && P1_FORMS[kind]) { P1_FORMS[kind](f); return; }
  if (kind === "join") {
    const err = $("#joinerr"); err.hidden = true;
    api("POST", "/api/projects/join", Object.fromEntries(new FormData(f))).then(async (r) => { ME = null; await loadMe(); P = null; await openProject(r.id); go("#/home"); })
      .catch((x) => { err.textContent = x.error; err.hidden = false; });
    return;
  }
  if (kind === "newclass") {
    api("POST", "/api/classes", Object.fromEntries(new FormData(f))).then(async (c) => { ME = null; await loadMe(); go(`#/class/${c.id}`); }).catch((x) => toast(x.error));
    return;
  }
  submitAuth(f);
});
document.addEventListener("click", async (e) => {
  const auth = e.target.closest("[data-auth]"); if (auth) { authMode = auth.dataset.auth; ROUTES.login($("#view")); return; }
  const dl = e.target.closest("[data-dl]"); if (dl) { const [doc, fmt] = dl.dataset.dl.split(":"); download(doc, fmt, route.name === "tproject" ? route.args[0] : undefined); return; }
  const setb = e.target.closest("[data-set]"); if (setb) { const [p, v] = setb.dataset.set.split(":"); setPath(S, p, v); markDirty(p); bindEngine(); render(); return; }
  const rs = e.target.closest("[data-restore]");
  if (rs) {
    if (!rs.dataset.armed) { rs.dataset.armed = "1"; rs.textContent = "แตะอีกครั้งเพื่อยืนยัน"; return; }
    const r = await api("POST", `/api/projects/${P.id}/revisions/${rs.dataset.restore}/restore`).catch((x) => toast(x.error));
    if (r) { P.version = r.version; S = PEEngine.normalize(r.state); SYNC.dirty.clear(); bindEngine(); saveLocal(true); toast("ย้อนกลับแล้ว"); go("#/home"); }
    return;
  }
  const reset = e.target.closest("[data-reset]");
  if (reset) {
    const [cid, uid, name] = reset.dataset.reset.split(":");
    const pw = Array.from(crypto.getRandomValues(new Uint8Array(4)), (b) => "23456789"[b % 8]).join("") + "pe";
    if (!reset.dataset.armed) { reset.dataset.armed = "1"; reset.textContent = "แตะอีกครั้งเพื่อรีเซ็ต"; return; }
    api("POST", `/api/classes/${cid}/students/${uid}/reset-password`, { password: pw }).then(() => { reset.outerHTML = `<span>รหัสใหม่ของ ${esc(name)}: <b class="code" style="font-size:18px">${pw}</b></span>`; }).catch((x) => toast(x.error));
    return;
  }
  const lim = e.target.closest("[data-limit]");
  if (lim) { api("PATCH", `/api/projects/${lim.dataset.limit}/member-limit`, { override: $("#lim").value }).then(() => toast("บันทึกแล้ว")).catch((x) => toast(x.error)); return; }
  const b = e.target.closest("[data-act]"); if (!b) return;
  const [act, a1, a2] = b.dataset.act.split(":");
  if (act === "logout") { await syncNow(); await api("POST", "/api/auth/logout").catch(() => {}); ME = null; P = null; S = null; store.del("pe-me"); go("#/login"); return; }
  if (act === "newproject") { b.disabled = true; try { await createProject(a1 === "import" ? store.get(PEEngine.KEY) : null); } catch (x) { toast(x.error); b.disabled = false; } return; }
  if (act === "import") { $("#importfile").click(); return; }
  if (!S) return;
  if (act === "add") { const arr = getPath(S, a1) || []; arr.push(a2 && NEW[a2] ? clone(NEW[a2]) : ""); setPath(S, a1, arr); markDirty(a1); render(); return; }
  if (act === "addn") { const arr = getPath(S, a1) || []; for (let i = 0; i < +a2; i++) arr.push(clone(NEW.row)); setPath(S, a1, arr); markDirty(a1); render(); return; }
  if (act === "del") { const arr = getPath(S, a1); arr.splice(+a2, 1); markDirty(a1); render(); return; }
  if (act === "clear") { setPath(S, a1, null); markDirty(a1); render(); return; }
  if (act === "rotate") { rotateImage(a1); return; }
  if (act === "draft" || act === "fill") { setPath(S, a1, G[a2]()); markDirty(a1); render(); return; }
  if (act === "termdefaults") {
    const n = S.info.innov || "(ชื่อนวัตกรรม)"; const have = new Set(S.ch1.terms.map((t) => t.t));
    [n, "คุณภาพ", "ประสิทธิภาพ", "ความพึงพอใจ"].forEach((t) => { if (!have.has(t)) S.ch1.terms.push({ t, d: "" }); });
    markDirty("ch1.terms"); render(); toast("ใส่หัวข้อแล้ว เขียนความหมายของแต่ละคำเอง"); return;
  }
  if (act === "backup") {
    const blob = new Blob([JSON.stringify(S)], { type: "application/json" }); const u = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = u; a.download = `project-${P.id}-${new Date().toISOString().slice(0, 10)}.json`; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 4000);
  }
});
$("#sync").addEventListener("click", () => { syncNow(); toast(SYNC.status === "saved" ? `บันทึกบนเซิร์ฟเวอร์แล้ว${SYNC.at ? " เวลา " + SYNC.at.toLocaleTimeString("th-TH") : ""}` : SYNC.status === "offline" ? "ออฟไลน์: งานเก็บในเครื่อง จะส่งเมื่อมีอินเทอร์เน็ต" : "กำลังส่งงานขึ้นระบบ"); });

if ("serviceWorker" in navigator) window.addEventListener("load", () => navigator.serviceWorker.register("/sw.js").catch(() => {}));
// first render() is called at the end of p1.js, after every route is registered
