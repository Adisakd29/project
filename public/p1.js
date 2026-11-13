/* ProjectElec P1: submit-for-review, teacher comments, KP.03/05/07 online forms, committee,
   phone-friendly data recorders (rating chips, experiment rounds, evidence photos) and photo cropping.
   Loaded after app.js and uses its helpers. Nothing here writes results on the student's behalf. */
"use strict";

/* ---------------- constants ---------------- */
// Review stages follow the 18-week calendar (คู่มือ หน้า ค–ง).
const STAGES = [
  { id: "kp01", label: "คพ.01 แบบเสนอโครงงาน", wk: [2, 3], when: "สัปดาห์ 2–3 ก่อนสอบหัวข้อ", review: "kp03", doc: "kp01" },
  { id: "kp02", label: "คพ.02 คำร้องขอสอบหัวข้อ", wk: [3, 3], when: "สัปดาห์ 3", doc: "kp02", form: true },
  { id: "kp04_1", label: "คพ.04 คำร้องขอสอบความก้าวหน้า ครั้งที่ 1", wk: [7, 7], when: "สัปดาห์ 7", doc: "kp04_1", form: true },
  { id: "p50", label: "รายงานความก้าวหน้า 50% · บทที่ 1–3", wk: [7, 7], when: "สัปดาห์ 7 นำเสนอครั้งที่ 1", review: "kp05_1", doc: "report" },
  { id: "kp04_2", label: "คพ.04 คำร้องขอสอบความก้าวหน้า ครั้งที่ 2", wk: [11, 11], when: "สัปดาห์ 11", doc: "kp04_2", form: true },
  { id: "p70", label: "รายงานความก้าวหน้า 70% · บทที่ 4–5", wk: [11, 12], when: "สัปดาห์ 11–12 นำเสนอครั้งที่ 2", review: "kp05_2", doc: "report" },
  { id: "kp06", label: "คพ.06 คำร้องขอรับการประเมินผล", wk: [13, 13], when: "สัปดาห์ 13", doc: "kp06", form: true },
  { id: "p90", label: "เล่มรายงาน 90% (ยังไม่เข้าเล่ม)", wk: [13, 13], when: "สัปดาห์ 13 ก่อนสอบโครงงาน", review: "kp07", doc: "report" },
  { id: "kp08", label: "คพ.08 แบบอนุญาตให้เข้าเล่ม", wk: [15, 15], when: "สัปดาห์ 15", doc: "kp08", form: true },
  { id: "final", label: "รายงานฉบับแก้ไขสมบูรณ์", wk: [15, 15], when: "สัปดาห์ 15 ก่อนเข้าเล่ม", doc: "report" },
];
const SEC_LABEL = { general: "ทั่วไป", kp01: "คพ.01", info: "ข้อมูลโครงงาน", ch1: "บทที่ 1", ch2: "บทที่ 2", ch3: "บทที่ 3", data: "บทที่ 4", ch5: "บทที่ 5", front: "บทคัดย่อ/ภาคผนวก", plan: "คำร้อง คพ." };
const REVIEW_FORMS = {
  kp03: { label: "คพ.03 ผลการสอบหัวข้อ", sub: "ครูผู้สอนสรุปผลการสอบหัวข้อ สัปดาห์ที่ 4 (คู่มือ หน้า 21–22)", resLabel: "ผลการสอบ", who: "ความเห็นของกรรมการ" },
  kp05_1: { label: "คพ.05 ความก้าวหน้า ครั้งที่ 1", sub: "บทที่ 1–3 สัปดาห์ที่ 8 พร้อมเอกสารแนบประเมิน (คู่มือ หน้า 25–27)", resLabel: "ผลการประเมิน", who: "ความเห็นของครูผู้สอน", round: 1 },
  kp05_2: { label: "คพ.05 ความก้าวหน้า ครั้งที่ 2", sub: "บทที่ 4–5 สัปดาห์ที่ 12 พร้อมเอกสารแนบประเมิน (คู่มือ หน้า 25–26, 28)", resLabel: "ผลการประเมิน", who: "ความเห็นของครูผู้สอน", round: 2 },
  kp07: { label: "คพ.07 ผลการประเมินโดยคณะกรรมการ", sub: "สอบโครงงาน สัปดาห์ที่ 14 (คู่มือ หน้า 31–32)", resLabel: "ผลการประเมิน", who: "ความเห็นของกรรมการ" },
};
const RESULT = { pass: "ผ่าน", fix: "ผ่านโดยให้แก้ไข", fail: "ไม่ผ่าน" };
const SUB_STATUS = { submitted: ["รอครูตรวจ", "warn"], returned: ["ส่งกลับให้แก้ไข", "warn"], approved: ["ครูรับรองแล้ว", "ok"] };
const fmtDT = (d) => (d ? new Date(d).toLocaleString("th-TH", { dateStyle: "medium", timeStyle: "short" }) : "");
const pill = (t, k) => `<span class="pill ${k || ""}">${esc(t)}</span>`;
window.P1_FORMS = {};

/* ---------------- project meta (reviews, submissions, comments) ---------------- */
async function refreshMeta() {
  if (!P || !navigator.onLine) return;
  try {
    const r = await api("GET", `/api/projects/${P.id}`);
    Object.assign(P, { reviews: r.reviews || [], submissions: r.submissions || [], comments: r.comments || [], committee: r.committee || [], members: r.members });
    const c = store.get(`pe-proj-${P.id}`);
    if (c) store.set(`pe-proj-${P.id}`, Object.assign(c, { reviews: r.reviews, submissions: r.submissions, comments: r.comments, committee: r.committee }));
  } catch (e) { /* stay with what we have */ }
}
const openTeacherComments = (sec) => (P && P.comments ? P.comments.filter((c) => !c.resolved && c.role !== "student" && (!sec || c.section === sec)) : []);
const lastSub = (subs, stage) => subs.filter((s) => s.stage === stage).sort((a, b) => new Date(b.submitted_at) - new Date(a.submitted_at))[0];

function commentItem(c, canResolve) {
  return `<li class="cmt${c.resolved ? " done" : ""}"><div class="cm-h"><b>${esc(c.display_name || "")}</b> ${c.role === "student" ? "" : pill("ครู")} ${pill(SEC_LABEL[c.section] || c.section)} <span class="hint">${fmtDT(c.created_at)}</span></div>
    <p>${esc(c.body).replace(/\n/g, "<br>")}</p>
    ${canResolve ? `<button class="btn sm${c.resolved ? " ghost" : ""}" type="button" data-x="resolve:${c.id}:${c.resolved ? 0 : 1}">${c.resolved ? "เปิดอีกครั้ง" : "✓ แก้แล้ว"}</button>` : c.resolved ? `<span class="hint">✓ นักเรียนแจ้งว่าแก้แล้ว</span>` : ""}</li>`;
}
function commentForm(sections, def, hint) {
  return `<form class="card" data-form="p1-comment"><h3>${hint || "เขียนความเห็น"}</h3>
    <div class="f"><label for="cm_s">ส่วนของเอกสาร</label><select id="cm_s" name="section">${sections.map((k) => `<option value="${k}"${k === def ? " selected" : ""}>${SEC_LABEL[k]}</option>`).join("")}</select></div>
    <div class="f"><label for="cm_b">ข้อความ</label><textarea id="cm_b" name="body" rows="3" required></textarea></div>
    <button class="btn pri" type="submit">ส่งความเห็น</button></form>`;
}
P1_FORMS["p1-comment"] = async (f) => {
  const fd = Object.fromEntries(new FormData(f)); const pid = route.name === "tproject" ? route.args[0] : P.id;
  const btn = f.querySelector("[type=submit]"); btn.disabled = true;
  try { await api("POST", `/api/projects/${pid}/comments`, fd); toast("ส่งความเห็นแล้ว"); if (P && route.name !== "tproject") await refreshMeta(); render(); }
  catch (e) { toast(e.error); btn.disabled = false; }
};

/* ---------------- student: banner of teacher comments on each screen ---------------- */
function commentBanner(sec) {
  const list = openTeacherComments(sec); if (!list.length) return "";
  return `<div class="note cbanner"><b>ครูให้ความเห็น ${list.length} เรื่อง</b><ul>${list.slice(0, 3).map((c) => `<li>${esc(c.body.length > 140 ? c.body.slice(0, 140) + "…" : c.body)}</li>`).join("")}</ul><a href="#/feedback">ดูทั้งหมดและแจ้งว่าแก้แล้ว ›</a></div>`;
}
const _edit = ROUTES.edit;
ROUTES.edit = async (view, id) => { await _edit(view, id); if (route.name === "edit" && P) view.insertAdjacentHTML("afterbegin", commentBanner(id)); };
const _kp01 = ROUTES.kp01;
ROUTES.kp01 = async (view, i) => { await _kp01(view, i); if (route.name === "kp01" && P) view.insertAdjacentHTML("afterbegin", commentBanner("kp01")); };

/* ---------------- student: home additions ---------------- */
const _home = ROUTES.home;
ROUTES.home = async (view) => {
  await _home(view);
  if (route.name !== "home" && route.name !== "" || !P) return;
  const wk = weekNo((ME.class && ME.class.semester_start) || S.startDate);
  const now = STAGES.find((s) => wk >= s.wk[0] - 1 && wk <= s.wk[1]) || STAGES.find((s) => !lastSub(P.submissions, s.id) || lastSub(P.submissions, s.id).status !== "approved");
  const ls = now && lastSub(P.submissions, now.id); const n = openTeacherComments().length;
  const html = `<a class="row-link" href="#/submit${now && (wk >= now.wk[0] - 1 && wk <= now.wk[1]) ? "/" + now.id : ""}"><div><b>ส่งงานให้ครูตรวจ</b> ${ls ? pill(SUB_STATUS[ls.status][0], SUB_STATUS[ls.status][1]) : ""}</div><small>${now ? `${esc(now.label)} · ${esc(now.when)}` : "ดูสถานะทุกขั้นตอน"}</small></a>
    <a class="row-link" href="#/feedback"><div><b>ความเห็นและผลประเมินจากครู</b> ${n ? pill(`ยังไม่แก้ ${n}`, "warn") : ""} ${allTeacherFiles().length ? pill(`ไฟล์จากครู ${allTeacherFiles().length}`, "ok") : ""}</div><small>${P.reviews.length ? `มีผลประเมิน ${P.reviews.length} ฉบับ` : "ยังไม่มีผลประเมิน"}</small></a>`;
  const hero = view.querySelector(".hero"); if (hero) hero.insertAdjacentHTML("afterend", html);
  const nf = allTeacherFiles().length;
  refreshMeta().then(() => { if (route.name === "home" && (openTeacherComments().length !== n || allTeacherFiles().length !== nf)) render(); });
};

/* ---------------- student: submit for review ---------------- */
ROUTES.submit = async (view, one) => {
  if (!(await needProject())) return;
  const S1 = STAGES.find((x) => x.id === one);
  chrome({ title: S1 ? S1.label : "ส่งงานให้ครูตรวจ", sub: S.info.titleTh, back: S1 ? "#/submit" : "#/home", tabs: STUDENT_TABS });
  await refreshMeta();
  const wk = weekNo((ME.class && ME.class.semester_start) || S.startDate);
  const isNow = (s) => wk >= s.wk[0] - 1 && wk <= s.wk[1];
  if (!S1) {
    const row = (s) => {
      const last = lastSub(P.submissions, s.id); const st = last && SUB_STATUS[last.status];
      const tf = last ? (last.files || []).filter((f) => f.by_teacher).length : 0;
      return `<li><a class="row-link${isNow(s) ? " now" : ""}" href="#/submit/${s.id}"><div><b>${esc(s.label)}</b> ${st ? pill(st[0], st[1]) : pill("ยังไม่ส่ง", "")} ${tf ? pill(`ไฟล์จากครู ${tf}`, "ok") : ""}</div><small>${esc(s.when)}${isNow(s) ? " · ถึงกำหนดช่วงนี้" : ""}</small></a></li>`;
    };
    view.innerHTML = `<p class="lead">แต่ละแบบฟอร์ม คพ. และรายงานแต่ละช่วง ส่งแยกกันได้ แตะรายการเพื่อดูเอกสาร แนบไฟล์ และกดส่ง</p>
      <div class="note">การส่งในระบบช่วยให้ครูตรวจจากมือถือได้ แต่แบบคำร้องที่ต้องลงชื่อ (คพ.02 / 04 / 06 / 08) ยังต้องยื่นฉบับลงชื่อจริงตามคู่มือ</div>
      <p class="sectitle">แบบฟอร์ม คพ.</p><ul class="list">${STAGES.filter((s) => s.form || s.id === "kp01").map(row).join("")}</ul>
      <p class="sectitle">รายงาน 5 บท</p><ul class="list">${STAGES.filter((s) => !s.form && s.id !== "kp01").map(row).join("")}</ul>`;
    return;
  }
  const s = S1;
  const subs = P.submissions.filter((x) => x.stage === s.id); const last = subs[0]; const st = last && SUB_STATUS[last.status];
  const canSend = P.canWrite && (!last || last.status !== "submitted");
  view.innerHTML = `<div class="card${isNow(s) ? " now" : ""}"><h3>${esc(s.label)} ${st ? pill(st[0], st[1]) : pill("ยังไม่ส่ง", "")}</h3><p class="hint">${esc(s.when)}</p>
      ${s.form ? `<p class="hint">ตรวจข้อมูลในแบบฟอร์มให้ถูกต้องก่อนส่ง ถ้าพิมพ์และลงชื่อแล้ว ถ่ายรูปหรือสแกนแนบมาด้วยได้</p>` : ""}
      ${last ? `<p class="hint">ส่งล่าสุด ${fmtDT(last.submitted_at)} โดย ${esc(last.by_name || "")}${last.note ? ` · “${esc(last.note)}”` : ""}</p>${fileList(mine(last), last.status === "submitted" && P.canWrite)}${teacherFiles(last)}
        ${last.status === "submitted" && P.canWrite && mine(last).length < 3 ? `<form data-form="p1-addfiles" data-sid="${last.id}" class="subform">${filePicker("a" + last.id)}<button class="btn sm" type="submit">อัปโหลดไฟล์เพิ่ม</button></form>` : ""}` : ""}
      ${last && last.reply ? `<div class="${last.status === "approved" ? "okbox" : "warnbox"}"><b>${esc(last.reviewer_name || "ครู")}:</b> ${esc(last.reply)}</div>` : ""}
      <div class="btnrow"><a class="btn ghost sm" href="#/view/${s.doc}">ดู${s.doc === "report" ? "รายงาน" : "แบบฟอร์ม"}ที่จะส่ง</a>${s.doc !== "report" ? `<button class="btn ghost sm" type="button" data-dl="${s.doc}:pdf">ดาวน์โหลด PDF</button>` : ""}</div>
      ${canSend ? `<form data-form="p1-submit" class="subform"><input type="hidden" name="stage" value="${s.id}"><div class="f"><label for="sn_${s.id}">ข้อความถึงครู (ถ้ามี)</label><textarea id="sn_${s.id}" name="note" rows="2" placeholder="${last && last.status === "returned" ? "เช่น แก้ตามความเห็นข้อ 1–3 แล้ว" : ""}"></textarea></div>${filePicker(s.id)}
        <button class="btn pri" type="submit">${last && last.status === "returned" ? "ส่งฉบับแก้ไข" : last && last.status === "approved" ? "ส่งอีกครั้ง" : `ส่ง ${esc(s.label.startsWith("คพ") ? s.label.split(" ")[0] : "รายงาน")} ให้ครูตรวจ`}</button></form>` : last && last.status === "submitted" ? `<p class="hint">ส่งแล้ว รอครูตรวจ</p>` : ""}
      ${subs.length > 1 ? `<details><summary class="hint">ประวัติการส่ง ${subs.length} ครั้ง</summary><ul class="list">${subs.map((x) => `<li class="hint">${fmtDT(x.submitted_at)} · ${SUB_STATUS[x.status][0]}${x.reply ? ` · ${esc(x.reply)}` : ""}${teacherFiles(x)}</li>`).join("")}</ul></details>` : ""}</div>
    <a class="btn ghost" href="#/submit">ดูรายการส่งทั้งหมด</a>`;
};
P1_FORMS["p1-submit"] = async (f) => {
  const fd = Object.fromEntries(new FormData(f)); const btn = f.querySelector("[type=submit]"); btn.disabled = true;
  try {
    await syncNow();
    if (SYNC.dirty.size) throw { error: "ยังบันทึกงานล่าสุดขึ้นระบบไม่ได้ ต่ออินเทอร์เน็ตแล้วลองใหม่" };
    const files = [...(f.querySelector("input[type=file]") || { files: [] }).files];
    const bad = checkFiles(files); if (bad) throw { error: bad };
    const sub = await api("POST", `/api/projects/${P.id}/submissions`, { stage: fd.stage, note: fd.note });
    if (files.length) {
      try { await uploadFiles(sub.id, files, (i, x) => { btn.textContent = `กำลังอัปโหลด ${i + 1}/${files.length}: ${x.name}`; }); }
      catch (e) { toast(`ส่งงานแล้ว แต่อัปโหลดไฟล์ไม่สำเร็จ (${e.error || "เครือข่าย"}) แนบเพิ่มได้ในหน้านี้`, 7000); render(); return; }
    }
    toast(files.length ? `ส่งให้ครูตรวจแล้ว พร้อมไฟล์ ${files.length} ไฟล์` : "ส่งให้ครูตรวจแล้ว"); render();
  } catch (e) { toast(e.error); btn.disabled = false; btn.textContent = "ส่งให้ครูตรวจ"; }
};
P1_FORMS["p1-addfiles"] = async (f) => {
  const files = [...f.querySelector("input[type=file]").files]; const btn = f.querySelector("[type=submit]");
  const bad = files.length ? checkFiles(files) : "เลือกไฟล์ก่อน"; if (bad) { toast(bad); return; }
  btn.disabled = true;
  try { await uploadFiles(f.dataset.sid, files, (i, x) => { btn.textContent = `กำลังอัปโหลด ${i + 1}/${files.length}`; }); toast("อัปโหลดแล้ว"); }
  catch (e) { toast(e.error || "อัปโหลดไม่สำเร็จ"); }
  render();
};

/* ---------------- files attached to a submission ---------------- */
const ACCEPT = ".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.zip,.jpg,.jpeg,.png";
const EXT_MIME = { pdf: "application/pdf", doc: "application/msword", docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation", xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  zip: "application/zip", jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png" };
const fsize = (n) => (n >= 1048576 ? (n / 1048576).toFixed(1) + " MB" : Math.max(1, Math.round(n / 1024)) + " KB");
const fileIcon = (m) => (/pdf/.test(m) ? "PDF" : /word/.test(m) ? "DOC" : /presentation/.test(m) ? "PPT" : /sheet/.test(m) ? "XLS" : /zip/.test(m) ? "ZIP" : "IMG");
const IS_STANDALONE = window.matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
const IN_APP = /FBAN|FBAV|FB_IAB|FBIOS|Messenger|Instagram|\bLine\/|MicroMessenger|; wv\)/i.test(navigator.userAgent);
function fileList(files, canDelete) {
  if (!files || !files.length) return "";
  const tgt = IN_APP ? "" : ' target="_blank"';
  // Added to the Home Screen (iPad/iPhone app mode) there is no browser bar, so a file opened directly leaves no way back:
  // open it in the app's own viewer instead (pages, back button, Save/Share, write comments).
  if (IS_STANDALONE) return `<ul class="flist">${files.map((f) => `<li><span class="ftype">${fileIcon(f.mime)}</span><div class="fname"><a href="#/fview/${f.id}">${esc(f.name)}</a>${f.stageLabel ? `<div class="hint">${esc(f.stageLabel)} · ${fmtDT(f.created_at)}</div>` : ""}</div><span class="hint">${fsize(f.size)}</span><a class="btn ghost sm" href="#/fview/${f.id}">เปิดดู</a>${canDelete ? `<button class="btn ghost sm" type="button" data-x="fdel:${f.id}" aria-label="ลบไฟล์ ${esc(f.name)}">ลบ</button>` : ""}</li>`).join("")}</ul>`;
  return `<ul class="flist">${files.map((f) => `<li><span class="ftype">${fileIcon(f.mime)}</span><div class="fname"><a href="${f.dl || `/api/files/${f.id}?dl=1`}" download="${esc(f.name)}">${esc(f.name)}</a>${f.stageLabel ? `<div class="hint">${esc(f.stageLabel)} · ${fmtDT(f.created_at)}</div>` : ""}</div><span class="hint">${fsize(f.size)}</span>${/pdf|image/.test(f.mime) ? `<a class="btn ghost sm" href="${f.open || `/api/files/${f.id}`}"${tgt} rel="noopener">เปิดดู</a>` : ""}${canDelete ? `<button class="btn ghost sm" type="button" data-x="fdel:${f.id}" aria-label="ลบไฟล์ ${esc(f.name)}">ลบ</button>` : ""}</li>`).join("")}</ul>`;
}
function allTeacherFiles() {
  if (!P || !P.submissions) return [];
  return P.submissions.flatMap((s) => (s.files || []).filter((f) => f.by_teacher).map((f) => ({ ...f, stageLabel: (STAGES.find((x) => x.id === s.stage) || {}).label || "" })))
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
}
const mine = (sub) => (sub.files || []).filter((f) => !f.by_teacher);
function teacherFiles(sub, canDelete) {
  const t = (sub.files || []).filter((f) => f.by_teacher); if (!t.length) return "";
  return `<p class="sectitle" style="margin:8px 0 0">ไฟล์ข้อแก้ไขจากครู</p>${fileList(t, !!canDelete)}`;
}
function filePicker(id) {
  return `<div class="f"><label for="sf_${id}">แนบไฟล์ (ถ้าทำงานบนคอมพิวเตอร์)</label>
    <input id="sf_${id}" name="files" type="file" multiple accept="${ACCEPT}" data-fpick="${id}">
    <p class="hint">PDF, Word, PowerPoint, Excel, ZIP หรือรูปภาพ · ไม่เกิน 3 ไฟล์ ไฟล์ละ 15 MB · ครูเปิดดูได้พร้อมงานในระบบ</p><div class="fsel" id="fsel_${id}"></div></div>`;
}
async function uploadFiles(sid, files, onStep) {
  const done = [];
  for (const [i, f] of files.entries()) {
    const ext = (f.name.split(".").pop() || "").toLowerCase();
    const mime = EXT_MIME[ext] || f.type;
    onStep && onStep(i, f);
    const r = await api("POST", `/api/submissions/${sid}/files`, null, { headers: { "content-type": mime, "x-filename": encodeURIComponent(f.name) }, body: f });
    done.push(r);
  }
  return done;
}
function checkFiles(list) {
  const files = [...list];
  if (files.length > 3) return "แนบได้ไม่เกิน 3 ไฟล์";
  for (const f of files) {
    const ext = (f.name.split(".").pop() || "").toLowerCase();
    if (!EXT_MIME[ext]) return `ไฟล์ ${f.name} ไม่รองรับ (ใช้ PDF, Word, PowerPoint, Excel, ZIP หรือรูปภาพ)`;
    if (f.size > 15 * 1048576) return `ไฟล์ ${f.name} ใหญ่เกิน 15 MB`;
  }
  return "";
}
document.addEventListener("change", (e) => {
  const el = e.target; if (!el.dataset || !el.dataset.fpick) return;
  const box = $(`#fsel_${el.dataset.fpick}`); const err = checkFiles(el.files);
  box.innerHTML = err ? `<div class="errbox">${esc(err)}</div>` : [...el.files].map((f) => `<div class="hint">📎 ${esc(f.name)} · ${fsize(f.size)}</div>`).join("");
});

/* ---------------- student: feedback (comments + review results) ---------------- */
function reviewSummary(kind, data) {
  const F = REVIEW_FORMS[kind]; if (!F || !data) return "";
  const res = data.result ? pill(RESULT[data.result], data.result === "pass" ? "ok" : "warn") : pill("ยังไม่สรุปผล");
  let items = "";
  if (F.round) {
    const it = data.items || {}, sg = data.sugg || {};
    const fixes = PEEngine.KP05_ITEMS[F.round].flatMap(([, list]) => list).filter(([no]) => it[no] === "fix" || sg[no]);
    if (fixes.length) items = `<ul class="list">${fixes.map(([no, t]) => `<li><b>${no}</b> ${esc(t)} ${it[no] === "fix" ? pill("ปรับปรุง", "warn") : it[no] === "pass" ? pill("ผ่าน", "ok") : ""}${sg[no] ? `<div class="hint">${esc(sg[no])}</div>` : ""}</li>`).join("")}</ul>`;
    if (data.other) items += `<p class="hint">ข้อเสนอแนะอื่น ๆ: ${esc(data.other)}</p>`;
  }
  return `<div class="card"><h3>${esc(F.label)}${kind === "kp03" && data.round > 1 ? ` ครั้งที่ ${data.round}` : ""}</h3><div>${F.resLabel} ${res}</div>${data.comment ? `<p>${esc(data.comment).replace(/\n/g, "<br>")}</p>` : ""}${items}</div>`;
}
ROUTES.feedback = async (view) => {
  if (!(await needProject())) return;
  chrome({ title: "ความเห็นจากครู", sub: S.info.titleTh, back: "#/home", tabs: STUDENT_TABS });
  await refreshMeta();
  const open = P.comments.filter((c) => !c.resolved), done = P.comments.filter((c) => c.resolved);
  const tf = allTeacherFiles();
  view.innerHTML = `${tf.length ? `<p class="sectitle">ไฟล์ข้อแก้ไขจากครู (${tf.length})</p><div class="card">${fileList(tf)}<p class="hint">แตะชื่อไฟล์เพื่อดาวน์โหลด หรือ “เปิดดู” เพื่อเปิดอ่านทันที</p></div>` : ""}${P.reviews.length ? `<p class="sectitle">ผลประเมินตามแบบฟอร์ม</p>${P.reviews.map((r) => reviewSummary(r.kind, r.data)).join("")}` : ""}
    <p class="sectitle">ความเห็นที่ยังไม่แก้ (${open.length})</p>
    ${open.length ? `<ul class="list">${open.map((c) => commentItem(c, P.canWrite)).join("")}</ul>` : `<p class="hint">ไม่มี</p>`}
    ${P.canWrite ? commentForm(Object.keys(SEC_LABEL), "general", "ถามหรือตอบครู") : ""}
    ${done.length ? `<details><summary class="sectitle">แก้แล้ว (${done.length})</summary><ul class="list">${done.map((c) => commentItem(c, P.canWrite)).join("")}</ul></details>` : ""}`;
};

/* ---------------- teacher: 18-week calendar with dates, the teacher's own tasks and work waiting ---------------- */
const TEACHER_TASKS = {
  1: "ชี้แจงหลักเกณฑ์ ให้รหัสห้องนักเรียนลงทะเบียน", 3: "รับคำร้อง คพ.02 · ตรวจ คพ.01 · จัดสอบหัวข้อ", 4: "กรอก คพ.03 สรุปผลการสอบหัวข้อ",
  7: "รับคำร้อง คพ.04 ครั้งที่ 1 · ฟังนำเสนอ 50%", 8: "กรอก คพ.05 ครั้งที่ 1 พร้อมเอกสารแนบประเมิน", 11: "รับคำร้อง คพ.04 ครั้งที่ 2",
  12: "ฟังนำเสนอ 70% · กรอก คพ.05 ครั้งที่ 2", 13: "รับ คพ.06 · ตรวจเล่ม 90% และชิ้นงาน", 14: "จัดสอบโครงงาน · กรรมการกรอก คพ.07",
  15: "ตรวจเล่มฉบับแก้ไข · ลงนาม คพ.08 อนุญาตเข้าเล่ม", 16: "ติดตามกลุ่มที่ล่าช้า", 17: "จัดแสดงผลงาน", 18: "ติดตามกลุ่มที่ล่าช้า",
};
ROUTES.tcal = async (view, cid) => {
  if (ME.user.role === "student") return go("#/home");
  const cls = ME.classes || [];
  chrome({ title: "ปฏิทินรายวิชา", sub: "ภาคเรียนที่ 2/2569 (คู่มือ หน้า ค–ง)", tabs: TEACHER_TABS });
  if (!cls.length) { view.innerHTML = `<div class="card"><p>ยังไม่มีห้องเรียน สร้างห้องก่อนที่แท็บ “ห้องเรียน”</p></div>`; return; }
  const c0 = cls.find((c) => String(c.id) === String(cid)) || cls[0];
  view.innerHTML = `<div class="spinner"></div>`;
  let r; try { r = await api("GET", `/api/classes/${c0.id}`); } catch (e) { r = { class: c0, projects: [] }; }
  const start = r.class.semester_start ? String(r.class.semester_start).slice(0, 10) : "";
  const wk = weekNo(start);
  const projects = (r.projects || []).filter((p) => !p.deleted_at);
  const dayMs = 864e5, s0 = start ? new Date(start + "T00:00") : null;
  const fmt = (d) => d.toLocaleDateString("th-TH", { day: "numeric", month: "short" });
  const range = (n) => {
    if (!s0) return "";
    const a = new Date(+s0 + (n - 1) * 7 * dayMs), b = new Date(+s0 + ((n - 1) * 7 + 6) * dayMs);
    return a.getMonth() === b.getMonth() ? `${a.getDate()}–${fmt(b)}` : `${fmt(a)} – ${fmt(b)}`;
  };
  const waiting = (n) => STAGES.filter((st) => n >= st.wk[0] && n <= st.wk[1] + 1).map((st) => {
    const k = projects.filter((p) => (p.pending || []).includes(st.id)).length;
    return k ? `<a class="pill warn" href="#/class/${r.class.id}">${esc(st.label)}: รอตรวจ ${k} กลุ่ม</a>` : "";
  }).join(" ");
  const cur = CALENDAR.find((x) => x[0] === wk);
  const pendAll = projects.filter((p) => (p.pending || []).length).length;
  view.innerHTML = `${cls.length > 1 ? `<div class="chips">${cls.map((c) => `<a class="chip" href="#/tcal/${c.id}" aria-pressed="${c.id === c0.id}" style="text-decoration:none;color:inherit">${esc(c.name)}</a>`).join("")}</div>` : ""}
    <div class="card hero"><div class="hwk">${esc(r.class.name)} · ${cur ? `สัปดาห์ที่ ${wk} จาก 18 · ${range(wk)}` : !start ? "ยังไม่ได้ตั้งวันเริ่มภาคเรียน" : wk > 18 ? "หลังสัปดาห์ที่ 18" : `เปิดภาคเรียน ${fmt(s0)}`}</div>
      <h2>${cur ? esc(cur[1]) : !start ? "ตั้งวันเริ่มสัปดาห์ที่ 1 ที่หน้าห้องเรียน เพื่อให้ปฏิทินแสดงวันที่" : "ปฏิทิน 18 สัปดาห์"}</h2>
      ${cur && TEACHER_TASKS[wk] ? `<p><b>งานของครูสัปดาห์นี้:</b> ${esc(TEACHER_TASKS[wk])}</p>` : ""}
      ${pendAll ? `<p><a href="#/class/${r.class.id}">มีงานรอตรวจ ${pendAll} กลุ่ม →</a></p>` : ""}
      ${!start ? `<a class="btn sm" href="#/class/${r.class.id}">ไปตั้งวันเริ่มภาคเรียน</a>` : ""}</div>
    <div class="weeks tw">${CALENDAR.map(([n, t, d]) => `<div class="wk${n === wk ? " now" : ""}${start && n < wk ? " past" : ""}"><span class="wn">ส.${n}${start ? `<small class="wdate">${range(n)}</small>` : ""}</span><span>${esc(t)}</span>
      ${d.length ? `<span class="docs">${d.map((x) => `<span class="kp">${x}</span>`).join("")}</span>` : ""}
      ${TEACHER_TASKS[n] ? `<span class="ttask">ครู: ${esc(TEACHER_TASKS[n])}</span>` : ""}
      ${(() => { const w = waiting(n); return w ? `<span class="docs">${w}</span>` : ""; })()}</div>`).join("")}</div>`;
};

/* ---------------- teacher: class page with pending work and form settings ---------------- */
ROUTES.class = async (view, id) => {
  const r = await api("GET", `/api/classes/${id}`);
  chrome({ title: r.class.name, sub: `รหัสห้อง ${r.class.code} · ${r.class.level}.`, back: "#/teacher", tabs: TEACHER_TABS });
  const wk = weekNo(r.class.semester_start); const set = r.class.settings || {}; const cm = set.committee || []; const ad = set.admins || {};
  const gone = r.projects.filter((p) => p.deleted_at); r.projects = r.projects.filter((p) => !p.deleted_at);
  const pend = r.projects.filter((p) => p.pending.length);
  const stageLabel = (s) => (STAGES.find((x) => x.id === s) || {}).label || s;
  view.innerHTML = `<div class="card"><p class="hint">ให้นักเรียนลงทะเบียนด้วยรหัสห้อง</p><div class="code">${r.class.code}</div><p class="hint">${wk >= 1 && wk <= 18 ? `ตอนนี้สัปดาห์ที่ ${wk}: ${esc((CALENDAR.find((c) => c[0] === wk) || [, ""])[1])}` : "ตั้งวันเริ่มภาคเรียนเพื่อดูสัปดาห์ปัจจุบัน"}</p></div>
    ${pend.length ? `<div class="warnbox"><b>รอตรวจ ${pend.length} กลุ่ม</b><ul>${pend.map((p) => `<li><a href="#/tproject/${p.id}/sub">${esc(p.title || "(ยังไม่ตั้งชื่อ)")}</a> · ${p.pending.map(stageLabel).map(esc).join(", ")}</li>`).join("")}</ul></div>` : ""}
    <p class="sectitle">โครงงาน ${r.projects.length} กลุ่ม</p>
    <ul class="list">${r.projects.map((p) => `<li><a class="row-link" href="#/tproject/${p.id}"><div><b>${esc(p.title || "(ยังไม่ตั้งชื่อ)")}</b> ${p.pending.length ? pill("รอตรวจ", "warn") : ""}</div><small>${p.members.map((m) => esc(m.display_name)).join(", ")} · ${p.members.length}/${p.limit} คน · แก้ล่าสุด ${new Date(p.updated_at).toLocaleDateString("th-TH")}</small><span class="kpm" title="ความคืบหน้าของแบบเสนอโครงงาน คพ.01 (13 ส่วนหลัก)">${meter(p.progress.kp01)}<small>คพ.01</small></span></a></li>`).join("") || `<li class="hint">ยังไม่มีกลุ่ม</li>`}</ul>
    ${gone.length ? `<details><summary class="sectitle">กลุ่มที่ลบแล้ว (${gone.length})</summary><ul class="list">${gone.map((p) => `<li class="item"><div><b>${esc(p.title || "(ยังไม่ตั้งชื่อ)")}</b><div class="hint">${p.members.map((m) => esc(m.display_name)).join(", ")} · ลบเมื่อ ${fmtDT(p.deleted_at)}</div></div><button class="btn sm" type="button" data-x="prestore:${p.id}">กู้คืน</button></li>`).join("")}</ul></details>` : ""}
    ${(() => { const live = r.students.filter((x) => !x.deleted_at), del = r.students.filter((x) => x.deleted_at);
      return `<p class="sectitle">นักเรียน ${live.length} คน</p>
    <div class="tbl"><table><tr><th>รหัส</th><th>ชื่อ</th><th></th></tr>${live.map((s) => `<tr><td class="n">${esc(s.student_id)}</td><td>${esc(s.display_name)}</td><td><div class="btnrow" style="margin:0;flex-wrap:nowrap"><button class="btn sm" type="button" data-reset="${r.class.id}:${s.id}:${esc(s.display_name)}" aria-label="รีเซ็ตรหัสผ่าน ${esc(s.display_name)}">รีเซ็ตรหัส</button><button class="btn ghost sm" type="button" data-x="sdel:${r.class.id}:${s.id}" aria-label="ลบ ${esc(s.display_name)}">ลบ</button></div></td></tr>`).join("")}</table></div>
    <p class="hint">ลบนักเรียน: เข้าสู่ระบบไม่ได้อีก และถูกนำออกจากกลุ่ม (งานของกลุ่มยังอยู่) รหัสนักศึกษานั้นลงทะเบียนใหม่ได้ กู้คืนได้ถ้ายังไม่ลงทะเบียนใหม่</p>
    ${del.length ? `<details><summary class="sectitle">นักเรียนที่ลบแล้ว (${del.length})</summary><ul class="list">${del.map((s) => `<li class="item"><div><b>${esc(s.display_name)}</b> <span class="hint">${esc(s.student_id)} · ลบเมื่อ ${fmtDT(s.deleted_at)}</span></div><button class="btn sm" type="button" data-x="srestore:${r.class.id}:${s.id}">กู้คืน</button></li>`).join("")}</ul></details>` : ""}`; })()}
    <form class="card" data-form="p1-classset" data-cid="${r.class.id}"><h3>ชื่อในแบบฟอร์ม คพ.03 / 05 / 07</h3>
      <p class="hint">คณะกรรมการ 3 คนชุดเดียวกันทั้งสอบหัวข้อและสอบโครงงาน (คู่มือ หน้า 3, 5) ใช้เป็นค่าเริ่มต้นของทุกกลุ่ม ปรับรายกลุ่มได้ในหน้ากลุ่ม ช่องว่างจะพิมพ์เป็นเส้นจุดให้เขียนด้วยมือ</p>
      ${["ประธานกรรมการ", "กรรมการ", "กรรมการ/ครูผู้สอน"].map((l, i) => `<div class="f"><label for="cs_${i}">${l}</label><input id="cs_${i}" name="c${i}" type="text" value="${esc(cm[i] || "")}"></div>`).join("")}
      <div class="f"><label for="cs_d">รองผู้อำนวยการฝ่ายยุทธศาสตร์และแผนงาน</label><input id="cs_d" name="deputy" type="text" value="${esc(ad.deputy || "")}" placeholder="${esc(PEEngine.ADMINS_DEFAULT.deputy)} (ตามคู่มือ)"></div>
      <div class="f"><label for="cs_r">ผู้อำนวยการ</label><input id="cs_r" name="director" type="text" value="${esc(ad.director || "")}" placeholder="${esc(PEEngine.ADMINS_DEFAULT.director)} (ตามคู่มือ)"></div>
      <button class="btn" type="submit">บันทึก</button></form>`;
};
P1_FORMS["p1-classset"] = async (f) => {
  const fd = Object.fromEntries(new FormData(f));
  try { await api("PUT", `/api/classes/${f.dataset.cid}/settings`, { committee: [fd.c0, fd.c1, fd.c2], admins: { deputy: fd.deputy, director: fd.director } }); toast("บันทึกแล้ว"); }
  catch (e) { toast(e.error); }
};

/* ---------------- teacher: one project (documents · submissions · forms · comments) ---------------- */
let TP = null; // teacher's copy of the project response
let RV = null; // the review form being edited {kind, data, dirty}
const TTABS = [["docs", "เอกสาร"], ["sub", "การส่งงาน"], ["eval", "แบบประเมิน"], ["notes", "ความเห็น"], ["src", "ที่มา/AI"]];
ROUTES.tproject = async (view, id, tab = "docs", sub) => {
  if (ME.user.role === "student") return go("#/home");
  TP = await api("GET", `/api/projects/${id}`);
  const st = PEEngine.normalize(TP.state);
  document.body.dataset.level = TP.level;
  const pendN = TP.submissions.filter((s) => s.status === "submitted").length;
  const openN = TP.comments.filter((c) => !c.resolved && c.role !== "student").length;
  chrome({ title: st.info.titleTh || "(ยังไม่ตั้งชื่อ)", sub: TP.members.map((m) => m.display_name).join(", "), back: "#/teacher", tabs: TEACHER_TABS });
  const tabs = `<div class="seg" role="tablist">${TTABS.map(([k, l]) => `<a role="tab" href="#/tproject/${id}/${k}" aria-pressed="${k === tab}">${l}${k === "sub" && pendN ? ` (${pendN})` : k === "notes" && openN ? ` (${openN})` : ""}</a>`).join("")}</div>`;
  if (tab === "docs") {
    const doc = sub || "kp01";
    view.innerHTML = tabs + `<div class="card"><h3>สมาชิก ${TP.members.length}/${TP.limit} คน</h3><p class="hint">คู่มือหน้า 4 กำหนด ${TP.level}. ไม่เกิน ${TP.level === "ปวส" ? 2 : 3} คน ถ้าอนุมัติให้เกิน ปรับจำนวนได้ที่นี่</p>
      <div class="row"><div class="f"><label for="lim">จำนวนสมาชิกสูงสุดของกลุ่มนี้</label><input id="lim" type="number" min="1" max="6" value="${TP.limit}"></div><div class="f" style="justify-content:flex-end"><button class="btn sm" type="button" data-limit="${id}">บันทึก</button></div></div></div>
      <div class="chips">${DOCS.map(([d, l]) => `<a class="chip" href="#/tproject/${id}/docs/${d}" aria-pressed="${d === doc}" style="text-decoration:none;color:inherit">${l}</a>`).join("")}</div>
      <div id="pages"><div class="spinner"></div></div>
      <div class="card danger"><h3>ลบกลุ่มนี้</h3><p class="hint">สมาชิกจะออกจากกลุ่มและสร้างกลุ่มใหม่หรือเข้าร่วมกลุ่มอื่นได้ งานที่เขียนไว้ยังเก็บอยู่ในระบบ กู้คืนได้จากหน้าห้องในหัวข้อ “กลุ่มที่ลบแล้ว” (ถ้าสมาชิกยังไม่ได้เข้ากลุ่มใหม่)</p>
        <button class="btn" type="button" data-x="pdelete:${id}">ลบกลุ่ม</button></div>`;
    await renderPages($("#pages"), doc, id);
    return;
  }
  if (tab === "sub") {
    view.innerHTML = tabs + (TP.submissions.length ? TP.submissions.map((s) => {
      const S0 = STAGES.find((x) => x.id === s.stage) || { label: s.stage, doc: "report" }; const stt = SUB_STATUS[s.status];
      return `<div class="card"><h3>${esc(S0.label)} ${pill(stt[0], stt[1])}</h3><p class="hint">ส่ง ${fmtDT(s.submitted_at)} โดย ${esc(s.by_name || "")} · ฉบับที่ ${s.version}${s.version !== TP.version ? ` (ตอนนี้ฉบับที่ ${TP.version})` : ""}</p>
        ${s.note ? `<p>“${esc(s.note)}”</p>` : ""}${mine(s).length ? `<p class="sectitle" style="margin:6px 0 0">ไฟล์ที่นักเรียนแนบ</p>${fileList(mine(s), false)}` : ""}${teacherFiles(s, true)}
        <details class="tfile"><summary class="btn ghost sm">แนบไฟล์ข้อแก้ไขให้นักเรียน</summary><form data-form="p1-addfiles" data-sid="${s.id}" class="subform">${filePicker("t" + s.id).replace("แนบไฟล์ (ถ้าทำงานบนคอมพิวเตอร์)", "ไฟล์ที่เขียนข้อแก้ไขแล้ว เช่น PDF ที่ใช้มาร์กอัปบน iPad")}<button class="btn sm" type="submit">อัปโหลดให้นักเรียน</button></form></details>${s.reply ? `<div class="hint">ตอบแล้ว ${fmtDT(s.reviewed_at)}: ${esc(s.reply)}</div>` : ""}
        <div class="mkbox"><a class="btn pri sm" href="#/mark/${id}/${s.id}/doc/${S0.doc}">✏️ เขียนคอมเมนต์บน${S0.doc === "report" ? "รายงาน" : "แบบฟอร์ม"}ในระบบ</a>${mine(s).filter((f) => /pdf|image|word|presentation|msword|powerpoint|opendocument/.test(f.mime)).map((f) => `<a class="btn ghost sm" href="#/mark/${id}/${s.id}/file/${f.id}">✏️ เขียนบนไฟล์ ${esc(f.name.length > 28 ? f.name.slice(0, 26) + "…" : f.name)}</a>`).join("")}</div>
        <div class="btnrow"><a class="btn ghost sm" href="#/tproject/${id}/docs/${S0.doc}">เปิดเอกสาร</a>${S0.review ? `<a class="btn ghost sm" href="#/tproject/${id}/eval/${S0.review}">กรอก ${esc(REVIEW_FORMS[S0.review].label.split(" ")[0])}</a>` : ""}</div>
        ${s.status === "submitted" ? `<div class="f"><label for="rp_${s.id}">ข้อความถึงนักเรียน</label><textarea id="rp_${s.id}" rows="3" placeholder="บอกสิ่งที่ต้องแก้ หรือคำชม"></textarea></div>
          <div class="btnrow"><button class="btn pri" type="button" data-x="subrev:${s.id}:approved">รับรอง</button><button class="btn" type="button" data-x="subrev:${s.id}:returned">ส่งกลับให้แก้ไข</button></div>` : ""}</div>`;
    }).join("") : `<p class="hint">กลุ่มนี้ยังไม่ได้ส่งงานผ่านระบบ</p>`);
    return;
  }
  if (tab === "src") {
    const prov = await api("GET", `/api/projects/${id}/provenance`);
    view.innerHTML = tabs + simLinks(id, TP.submissions, true) + provenanceHTML(st, prov, TP.members, true);
    return;
  }
  if (tab === "notes") {
    view.innerHTML = tabs + commentForm(Object.keys(SEC_LABEL), "general", "ความเห็นถึงกลุ่มนี้") +
      `<ul class="list">${TP.comments.map((c) => commentItem(c, false)).join("") || `<li class="hint">ยังไม่มีความเห็น</li>`}</ul>`;
    return;
  }
  // eval: KP.03 / KP.05 (1, 2) / KP.07
  const kind = REVIEW_FORMS[sub] ? sub : "kp03"; const F = REVIEW_FORMS[kind];
  if (!RV || RV.kind !== kind || RV.pid !== id) {
    const saved = TP.reviews.find((r) => r.kind === kind);
    RV = { kind, pid: id, data: saved ? clone(saved.data) : {}, at: saved && saved.updated_at, dirty: false };
  }
  const d = RV.data; const chip = (path, val, label) => `<button type="button" class="chip" data-rvset="${path}:${val}" aria-pressed="${String(rvGet(d, path) ?? "") === String(val)}">${label}</button>`;
  const cm = TP.committee && TP.committee.some(Boolean) ? TP.committee : [];
  let body = `<div class="chips">${Object.entries(REVIEW_FORMS).map(([k, f]) => `<a class="chip" href="#/tproject/${id}/eval/${k}" aria-pressed="${k === kind}" style="text-decoration:none;color:inherit">${esc(f.label.split(" ").slice(0, k.startsWith("kp05") ? 3 : 1).join(" "))}</a>`).join("")}</div>
    <div class="card"><h3>${esc(F.label)}</h3><p class="hint">${esc(F.sub)} · ช่องลงชื่อและความเห็นผู้บริหารคงไว้ให้ลงนามด้วยมือ</p>${RV.at ? `<p class="hint">บันทึกล่าสุด ${fmtDT(RV.at)}</p>` : ""}</div>`;
  if (kind === "kp03") body += `<div class="f"><label>ครั้งที่สอบ</label><div class="chips">${chip("round", 1, "ครั้งที่ 1")}${chip("round", 2, "ครั้งที่ 2")}</div></div>`;
  body += `<div class="f"><label>${F.resLabel}</label><div class="chips">${Object.entries(RESULT).map(([k, l]) => chip("result", k, l)).join("")}</div></div>
    <div class="f"><label for="rv_c">${F.who}</label><textarea id="rv_c" data-rv="comment" rows="4">${esc(d.comment || "")}</textarea>${d.result === "fix" ? `<p class="hint">กรณี “ผ่านโดยให้แก้ไข” ให้แจ้งเหตุผลหรือส่วนที่ต้องแก้ไขไว้ด้วย (หมายเหตุในแบบฟอร์ม)</p>` : ""}</div>`;
  if (F.round) {
    body += `<p class="sectitle">เอกสารแนบ คพ.05 แบบประเมินความก้าวหน้า ครั้งที่ ${F.round}</p>` + PEEngine.KP05_ITEMS[F.round].map(([ch, items]) => `<fieldset><legend>${esc(ch)}</legend>${items.map(([no, t]) => `<div class="item"><span class="idx">${no}</span><p style="margin:0">${esc(t)}</p>
      <div class="chips">${chip(`items/${no}`, "pass", "ผ่าน")}${chip(`items/${no}`, "fix", "ปรับปรุง")}</div>
      <input type="text" data-rv="sugg/${no}" value="${esc((d.sugg || {})[no] || "")}" placeholder="ข้อเสนอแนะ (ถ้ามี)" aria-label="ข้อเสนอแนะ ${no}"></div>`).join("")}</fieldset>`).join("");
    if (F.round === 2) body += `<div class="f"><label for="rv_o">ข้อเสนอแนะอื่น ๆ</label><textarea id="rv_o" data-rv="other" rows="3">${esc(d.other || "")}</textarea></div>`;
  }
  if (kind === "kp03" || kind === "kp07") {
    body += `<form class="card" data-form="p1-committee"><h3>คณะกรรมการของกลุ่มนี้</h3><p class="hint">ชุดเดียวกันทั้งสอบหัวข้อและสอบโครงงาน (คู่มือ หน้า 5) ว่างไว้จะใช้ค่าของห้อง</p>
      ${["ประธานกรรมการสอบ", "กรรมการ", "กรรมการ/ครูผู้สอน"].map((l, i) => `<div class="f"><label for="pc_${i}">${l}</label><input id="pc_${i}" name="c${i}" type="text" value="${esc(cm[i] || "")}"></div>`).join("")}
      <button class="btn sm" type="submit">บันทึกชื่อกรรมการ</button></form>`;
  }
  body += `<div class="btnrow sticky"><button class="btn pri" type="button" data-x="rvsave">บันทึกแบบประเมิน</button><button class="btn" type="button" data-x="rvdl:pdf">PDF</button><button class="btn" type="button" data-x="rvdl:docx">Word</button></div>`;
  view.innerHTML = tabs + `<div class="form">${body}</div>`;
};
// KP.05 item numbers contain a dot ("1.1"), so they are addressed as "items/1.1" instead of a dotted path.
function rvGet(d, p) { if (p.includes("/")) { const [o, k] = p.split("/"); return (d[o] || {})[k]; } return getPath(d, p); }
function rvSet(d, p, v) { if (p.includes("/")) { const [o, k] = p.split("/"); if (!d[o] || typeof d[o] !== "object" || Array.isArray(d[o])) d[o] = {}; d[o][k] = v; return; } setPath(d, p, v); }
async function saveReview(quiet) {
  if (!RV) return;
  await api("PUT", `/api/projects/${RV.pid}/reviews/${RV.kind}`, { data: RV.data });
  RV.dirty = false; RV.at = new Date().toISOString();
  if (!quiet) toast("บันทึกแบบประเมินแล้ว");
}
P1_FORMS["p1-committee"] = async (f) => {
  const fd = Object.fromEntries(new FormData(f));
  try { await api("PUT", `/api/projects/${route.args[0]}/committee`, { committee: [fd.c0, fd.c1, fd.c2] }); toast("บันทึกชื่อกรรมการแล้ว"); }
  catch (e) { toast(e.error); }
};

/* ---------------- student: write list additions ---------------- */
const _write = ROUTES.write;
ROUTES.write = async (view) => {
  await _write(view);
  if (route.name !== "write" || !P) return;
  const L = likert(S.data.expertScores, S.ch3.expertItems), T = satStats(), I = iocStats();
  const perfN = S.ch3.perf.filter((p) => (p.rows || []).length).length;
  view.insertAdjacentHTML("beforeend", `<p class="sectitle">บันทึกข้อมูลจริงจากมือถือ (บทที่ 4)</p><ul class="list">
    <li><a class="row-link" href="#/rec/expert/0"><div><b>คะแนนผู้เชี่ยวชาญ</b></div><small>แตะคะแนน 1–5 ทีละคน · มีแล้ว ${L.n} คน</small></a></li>
    <li><a class="row-link" href="#/perf/0"><div><b>ผลการทดลองรายครั้ง</b></div><small>ผ่าน/ไม่ผ่าน หรือค่าที่วัดได้พร้อมหน่วย · บันทึกแล้ว ${perfN}/${S.ch3.perf.length} ด้าน</small></a></li>
    <li><a class="row-link" href="#/evidence"><div><b>ภาพหลักฐานการทดสอบ</b></div><small>ถ่ายรูปขณะทดลอง ใส่คำบรรยาย · ${(S.data.evidence || []).length} ภาพ</small></a></li>
    <li><a class="row-link" href="#/rec/user/0"><div><b>แบบสอบถามความพึงพอใจ</b></div><small>บันทึกจากแบบสอบถามกระดาษทีละคน · มีแล้ว ${T.n} คน</small></a></li>
    <li><a class="row-link" href="#/rec/ioc/0"><div><b>ค่า IOC ของแบบสอบถาม</b></div><small>ผู้เชี่ยวชาญให้ +1 / 0 / −1 รายข้อ · ${I.length} ข้อ</small></a></li></ul>`);
};

/* ---------------- matrix recorder: one respondent per screen ---------------- */
// Scores are stored as text (rows = respondents, tab-separated columns = items), the same format as pasting from
// Google Sheets, so the paste box in the detailed editor and this recorder always show the same numbers.
function mxRead(text) {
  const lines = String(text || "").split(/\r?\n/);
  while (lines.length && !lines[lines.length - 1].trim()) lines.pop();
  return lines.map((l) => (l.includes("\t") ? l.split("\t").map((t) => t.trim()) : l.trim() ? l.trim().split(/[,; ]+/) : []));
}
const mxWrite = (rows, k) => rows.map((r) => Array.from({ length: Math.max(k, r.length) }, (_, i) => (r[i] == null ? "" : String(r[i]))).join("\t")).join("\n");
const LIK = { 5: "มากที่สุด", 4: "มาก", 3: "ปานกลาง", 2: "น้อย", 1: "น้อยที่สุด" };
const REC = {
  expert: { path: "data.expertScores", title: "คะแนนผู้เชี่ยวชาญ", who: "ผู้เชี่ยวชาญคนที่", vals: [5, 4, 3, 2, 1], labels: LIK, ch: "บทที่ 3 → แบบสอบถามความคิดเห็นของผู้เชี่ยวชาญ",
    items: () => S.ch3.expertItems.map((t) => ({ t })), name: (r) => (S.data.experts[r] || {}).name, transpose: false },
  user: { path: "data.userScores", title: "ความพึงพอใจของผู้ใช้งาน", who: "ผู้ตอบคนที่", vals: [5, 4, 3, 2, 1], labels: LIK, ch: "บทที่ 3 → แบบสอบถามความพึงพอใจ",
    items: () => S.ch3.sat.flatMap((a) => a.items.map((t, i) => ({ t, head: i === 0 ? a.name : "" }))), name: () => "", transpose: false },
  ioc: { path: "data.ioc", title: "ค่า IOC ของแบบสอบถามความพึงพอใจ", who: "ผู้เชี่ยวชาญคนที่", vals: [1, 0, -1], labels: { 1: "สอดคล้อง", 0: "ไม่แน่ใจ", "-1": "ไม่สอดคล้อง" }, ch: "บทที่ 3 → แบบสอบถามความพึงพอใจ",
    items: () => iocItems().map((t) => ({ t })), name: (r) => (S.data.experts[r] || {}).name, transpose: true },
};
const valid = (kind, v) => v !== "" && v != null && REC[kind].vals.includes(Number(v));
function mxCell(kind, rows, r, i) { return REC[kind].transpose ? (rows[i] || [])[r] : (rows[r] || [])[i]; }
function mxCount(kind, rows, k) { return REC[kind].transpose ? Math.max(0, ...rows.slice(0, k).map((x) => x.length)) : rows.length; }
ROUTES.rec = async (view, kind = "expert", r = "0") => {
  if (!(await needProject())) return;
  const R = REC[kind]; if (!R) return go("#/write");
  const items = R.items(); const k = items.length; const rows = mxRead(getPath(S, R.path));
  const n = mxCount(kind, rows, k); const idx = Math.max(0, Math.min(+r || 0, n));
  chrome({ title: R.title, sub: S.info.titleTh, back: "#/write", guided: true });
  if (!k) { view.innerHTML = `<div class="warnbox">ยังไม่มีข้อคำถาม เพิ่มข้อคำถามที่ ${esc(R.ch)} ก่อน</div><a class="btn" href="#/edit/ch3">ไปบทที่ 3</a>`; return; }
  const foreign = rows.some((row) => row.some((c) => c !== "" && !valid(kind, c)));
  const answered = items.filter((_, i) => valid(kind, mxCell(kind, rows, idx, i))).length;
  const nm = R.name(idx);
  view.innerHTML = `<div class="qcard"><div class="qhead"><span>${R.who} ${idx + 1}${nm ? ` · ${esc(nm)}` : ""}</span><span>${n} คน</span></div>
    <div class="chips">${Array.from({ length: n }, (_, j) => `<a class="chip" href="#/rec/${kind}/${j}" aria-pressed="${j === idx}" style="min-width:44px;text-align:center;text-decoration:none;color:inherit">${j + 1}</a>`).join("")}<a class="chip" href="#/rec/${kind}/${n}" aria-pressed="${idx === n}" style="text-decoration:none;color:inherit">+ คนใหม่</a></div>
    ${foreign ? `<div class="warnbox">ข้อมูลชุดนี้มีค่าที่ไม่ใช่ ${R.vals.join(", ")} (อาจวางมาจากตารางที่มีคอลัมน์เวลา/ชื่อ) ตรวจแก้ในหน้าวางข้อมูลก่อน เพื่อไม่ให้คะแนนเลื่อนคอลัมน์ <a href="#/edit/data">เปิดหน้าวางข้อมูล</a></div>` : ""}
    <p class="hint">บันทึกตามที่ผู้ตอบให้คะแนนจริงในแบบสอบถามเท่านั้น ข้อที่ผู้ตอบเว้นไว้ให้เว้นว่าง · ตอบแล้ว <b data-live="mxn">${answered}</b>/${k} ข้อ</p></div>
    <ol class="mx" ${P.canWrite && !foreign ? "" : "inert"}>${items.map((it, i) => { const cur = mxCell(kind, rows, idx, i);
      return `${it.head ? `<li class="mxh">${esc(it.head)}</li>` : ""}<li><p>${i + 1}. ${esc(it.t || "(ยังไม่ได้พิมพ์ข้อคำถาม)")}</p><div class="chips mxv" role="group" aria-label="ข้อ ${i + 1}">${R.vals.map((v) => `<button type="button" class="chip" data-x="mx:${kind}:${idx}:${i}:${v}" aria-pressed="${cur !== "" && cur != null && Number(cur) === v}"><b>${v > 0 && kind === "ioc" ? "+" + v : v}</b> <small>${esc(R.labels[v])}</small></button>`).join("")}</div></li>`; }).join("")}</ol>
    <nav class="qnav"><a class="btn" href="#/rec/${kind}/${Math.max(0, idx - 1)}" ${idx === 0 ? 'style="visibility:hidden"' : ""}>‹ คนก่อน</a>
      <span class="mid">${idx < n ? `<button class="btn ghost sm" type="button" data-x="mxdel:${kind}:${idx}">ลบคนนี้</button>` : ""}</span>
      <a class="btn pri" href="#/rec/${kind}/${idx + 1}">${idx >= n - 1 ? "+ คนถัดไป" : "คนถัดไป ›"}</a></nav>
    <a class="btn block" href="#/edit/data">ดูผลคำนวณ x̄ / S.D. / IOC</a>`;
};
function mxSet(kind, r, i, v) {
  const R = REC[kind]; const k = R.items().length; const rows = mxRead(getPath(S, R.path));
  if (R.transpose) { while (rows.length < k) rows.push([]); const row = rows[i]; while (row.length <= r) row.push(""); row[r] = row[r] === String(v) ? "" : String(v); const w = Math.max(...rows.map((x) => x.length)); rows.forEach((x) => { while (x.length < w) x.push(""); }); }
  else { while (rows.length <= r) rows.push([]); const row = rows[r]; while (row.length < k) row.push(""); row[i] = row[i] === String(v) ? "" : String(v); }
  setPath(S, R.path, mxWrite(rows, R.transpose ? 0 : k)); markDirty(R.path);
  return R.transpose ? rows[i][r] : rows[r][i];
}
function mxDel(kind, r) {
  const R = REC[kind]; const rows = mxRead(getPath(S, R.path));
  if (R.transpose) rows.forEach((x) => x.splice(r, 1)); else rows.splice(r, 1);
  setPath(S, R.path, mxWrite(rows, R.transpose ? 0 : R.items().length)); markDirty(R.path);
}

/* ---------------- experiment recorder ---------------- */
const dec = (p, label, v, o = {}) => `<div class="f"><label for="f_${p.replace(/\./g, "_")}">${label}</label><input type="text" inputmode="${o.mode || "decimal"}" id="f_${p.replace(/\./g, "_")}" data-k="${p}" value="${esc(v ?? "")}" placeholder="${esc(o.ph || "")}"></div>`;
function perfLive(i) {
  const p = S.ch3.perf[i]; const s = perfStats(p);
  if (!s.n) return `<p class="hint">ยังไม่มีผลที่บันทึก</p>`;
  if (s.num) return `<div class="tbl"><table><tr><th>n</th><th>x̄</th><th>S.D.</th><th>ต่ำสุด</th><th>สูงสุด</th>${s.pct != null ? "<th>ในเกณฑ์</th>" : ""}</tr><tr><td class="n">${s.n}</td><td class="n">${E.fmtN(s.mean)}</td><td class="n">${f2(s.sd)}</td><td class="n">${E.fmtN(s.min)}</td><td class="n">${E.fmtN(s.max)}</td>${s.pct != null ? `<td class="n">${s.ok}/${s.n} = ${f2(s.pct)}%</td>` : ""}</tr></table></div>
    <p class="hint">ประโยคในบทที่ 4: ${esc(E.perfPhrase(p, s))}</p>${s.pct == null ? `<p class="hint">ใส่ค่าเป้าหมายและค่าคลาดเคลื่อนที่ยอมรับได้ (ตามที่เขียนไว้ในบทที่ 3) ระบบจึงจะคำนวณร้อยละที่อยู่ในเกณฑ์</p>` : ""}`;
  return `<p class="hint">ผ่าน ${s.ok}/${s.n} ครั้ง = ร้อยละ ${f2(s.pct)} · ${esc(E.perfPhrase(p, s))}</p>`;
}
ROUTES.perf = async (view, i = "0") => {
  if (!(await needProject())) return;
  chrome({ title: "ผลการทดลองรายครั้ง", sub: S.info.titleTh, back: "#/write", tabs: STUDENT_TABS });
  if (!S.ch3.perf.length) { view.innerHTML = `<div class="warnbox">ยังไม่มีด้านที่ทดสอบ ตั้งชื่อด้านใน คพ.01 ข้อ 8/10 หรือบทที่ 3 ก่อน</div><a class="btn" href="#/edit/ch3">ไปบทที่ 3</a>`; return; }
  const ix = Math.max(0, Math.min(S.ch3.perf.length - 1, +i || 0)); const p = S.ch3.perf[ix]; const base = `ch3.perf.${ix}`; const num = p.mode === "num";
  const rows = p.rows || [];
  view.innerHTML = `<div class="chips">${S.ch3.perf.map((x, j) => `<a class="chip" href="#/perf/${j}" aria-pressed="${j === ix}" style="text-decoration:none;color:inherit">ด้านที่ ${j + 1}</a>`).join("")}</div>
    <div class="form" ${P.canWrite ? "" : "inert"}>
    <h2>${esc(p.name || "(ยังไม่ตั้งชื่อด้าน)")}</h2>${p.method ? `<p class="hint">วิธีทดสอบ (บทที่ 3): ${esc(p.method)}</p>` : ""}
    <div class="note">บันทึกผลที่ได้จากการทดลองจริงทุกครั้ง รวมครั้งที่ไม่ผ่าน ระบบคำนวณค่าสถิติจากตัวเลขที่บันทึกเท่านั้น</div>
    <div class="f"><label>รูปแบบผลการทดสอบ</label><div class="chips"><button type="button" class="chip" data-set="${base}.mode:pass" aria-pressed="${!num}">ผ่าน / ไม่ผ่าน</button><button type="button" class="chip" data-set="${base}.mode:num" aria-pressed="${num}">ค่าที่วัดได้ (ตัวเลข)</button></div></div>
    ${num ? `<div class="row">${dec(base + ".unit", "หน่วย", p.unit, { mode: "text", ph: "เช่น วินาที, °C, cm" })}${dec(base + ".target", "ค่าเป้าหมาย", p.target)}${dec(base + ".tol", "คลาดเคลื่อนได้ ±", p.tol)}</div>` : ""}
    <ol class="runs">${rows.map((r, j) => `<li class="item"><span class="idx">ครั้งที่ ${j + 1}</span><button class="btn ghost sm del" type="button" data-act="del:${base}.rows:${j}" aria-label="ลบครั้งที่ ${j + 1}">✕</button>
      ${fText(`${base}.rows.${j}.item`, "รายการ/เงื่อนไข", { ph: num ? "เช่น ตั้งเวลา 07:00 น." : "" })}
      ${num ? dec(`${base}.rows.${j}.value`, `ค่าที่วัดได้${p.unit ? ` (${esc(p.unit)})` : ""}`, r.value) :
        `<div class="row">${fText(`${base}.rows.${j}.exp`, "ผลที่คาดหวัง")}${fText(`${base}.rows.${j}.act`, "ผลที่ได้จริง")}</div><div class="chips"><button type="button" class="chip" data-set="${base}.rows.${j}.pass:1" aria-pressed="${!!r.pass}">✓ ผ่าน</button><button type="button" class="chip" data-set="${base}.rows.${j}.pass:" aria-pressed="${!r.pass}">✕ ไม่ผ่าน</button></div>`}</li>`).join("")}</ol>
    <div class="btnrow"><button class="btn" type="button" data-x="perfadd:${ix}:1">+ เพิ่ม 1 ครั้ง</button><button class="btn ghost" type="button" data-x="perfadd:${ix}:10">+ เพิ่ม 10 ครั้ง</button></div>
    <div data-live="perfnum">${perfLive(ix)}</div></div>
    <a class="btn block" href="#/evidence">ถ่ายภาพหลักฐานการทดสอบ</a>`;
};

/* ---------------- evidence photos (chapter 4) ---------------- */
ROUTES.evidence = async (view) => {
  if (!(await needProject())) return;
  chrome({ title: "ภาพหลักฐานการทดสอบ", sub: S.info.titleTh, back: "#/write", tabs: STUDENT_TABS });
  const ev = S.data.evidence;
  view.innerHTML = `<p class="lead">ภาพจะอยู่ในหัวข้อ “ภาพหลักฐานการทดสอบ” ท้ายผลการทดสอบในบทที่ 4 เลขภาพ 4.x เรียงให้อัตโนมัติ</p>
    <div class="form" ${P.canWrite ? "" : "inert"}>${ev.map((p, i) => `<div class="item"><span class="idx">ภาพที่ ${i + 1}</span><button class="btn ghost sm del" type="button" data-act="del:data.evidence:${i}">✕ ลบ</button>
      <div class="photo"><img src="${p.src}" alt="ภาพหลักฐาน ${i + 1}"><button class="btn ghost sm" type="button" data-act="rotate:data.evidence.${i}">↻ หมุน</button><a class="btn ghost sm" href="#/crop/data.evidence.${i}">✂ ครอบตัด</a></div>
      ${photoSize(`data.evidence.${i}`, p)}${fText(`data.evidence.${i}.cap`, "คำบรรยายใต้ภาพ", { ph: "เช่น การทดสอบความตรงเวลา ครั้งที่ 3" })}
      <div class="btnrow">${i > 0 ? `<button class="btn ghost sm" type="button" data-x="evmove:${i}:-1">↑ ย้ายขึ้น</button>` : ""}${i < ev.length - 1 ? `<button class="btn ghost sm" type="button" data-x="evmove:${i}:1">↓ ย้ายลง</button>` : ""}</div></div>`).join("")}
    <label class="btn pri block">📷 ถ่ายรูปหรือเลือกรูป<input type="file" accept="image/*" multiple data-photos="data.evidence" hidden></label></div>`;
};

/* ---------------- crop ---------------- */
let CROP = null;
ROUTES.crop = async (view, path) => {
  if (!(await needProject())) return;
  const o = getPath(S, path || "");
  chrome({ title: "ครอบตัดภาพ", back: null, guided: true });
  if (!o || !o.src) { view.innerHTML = `<div class="errbox">ไม่พบภาพ</div><button class="btn" type="button" onclick="history.back()">กลับ</button>`; return; }
  CROP = { path, l: 0, r: 0, t: 0, b: 0, im: null };
  view.innerHTML = `<div class="cropbox"><canvas id="cropc" aria-label="ภาพตัวอย่างหลังครอบตัด"></canvas></div>
    ${[["l", "ตัดซ้าย"], ["r", "ตัดขวา"], ["t", "ตัดบน"], ["b", "ตัดล่าง"]].map(([k, l]) => `<div class="f"><label for="cr_${k}">${l} <span class="hint" id="crv_${k}">0%</span></label><input id="cr_${k}" type="range" min="0" max="45" value="0" data-crop="${k}"></div>`).join("")}
    <nav class="qnav"><button class="btn" type="button" onclick="history.back()">ยกเลิก</button><span class="mid"></span><button class="btn pri" type="button" data-x="cropok">ใช้ภาพนี้</button></nav>`;
  const im = new Image(); im.onload = () => { CROP.im = im; drawCrop(); }; im.onerror = () => toast("เปิดภาพไม่ได้"); im.src = o.src;
};
function cropRect() { const { im, l, r, t, b } = CROP; const W = im.naturalWidth, H = im.naturalHeight; const x = Math.round((W * l) / 100), y = Math.round((H * t) / 100); return { x, y, w: Math.max(8, Math.round(W * (1 - (l + r) / 100))), h: Math.max(8, Math.round(H * (1 - (t + b) / 100))) }; }
function drawCrop() {
  const c = $("#cropc"); if (!c || !CROP.im) return; const R = cropRect(); const sc = Math.min(1, 640 / Math.max(R.w, R.h));
  c.width = Math.round(R.w * sc); c.height = Math.round(R.h * sc); c.getContext("2d").drawImage(CROP.im, R.x, R.y, R.w, R.h, 0, 0, c.width, c.height);
}
function applyCrop() {
  if (!CROP || !CROP.im) return; const R = cropRect(); const sc = Math.min(1, 1600 / Math.max(R.w, R.h));
  const c = document.createElement("canvas"); c.width = Math.round(R.w * sc); c.height = Math.round(R.h * sc);
  const x = c.getContext("2d"); x.fillStyle = "#fff"; x.fillRect(0, 0, c.width, c.height); x.drawImage(CROP.im, R.x, R.y, R.w, R.h, 0, 0, c.width, c.height);
  const o = getPath(S, CROP.path);
  setPath(S, CROP.path, Object.assign({}, o, { src: c.toDataURL("image/jpeg", 0.85), w: c.width, h: c.height })); markDirty(CROP.path);
  CROP = null; toast("ครอบตัดแล้ว"); history.back();
}

/* ---------------- events ---------------- */
document.addEventListener("input", (e) => {
  const el = e.target;
  if (el.dataset.rv && RV) { rvSet(RV.data, el.dataset.rv, el.value); RV.dirty = true; return; }
  if (el.dataset.crop && CROP) { CROP[el.dataset.crop] = +el.value; const v = $(`#crv_${el.dataset.crop}`); if (v) v.textContent = el.value + "%"; drawCrop(); return; }
  if (el.dataset.k && S) { const m = el.dataset.k.match(/^ch3\.perf\.(\d+)\./); if (m) { const box = $('[data-live="perfnum"]'); if (box) box.innerHTML = perfLive(+m[1]); } }
});
document.addEventListener("click", async (e) => {
  const rvs = e.target.closest("[data-rvset]");
  if (rvs && RV) {
    const [p, v] = rvs.dataset.rvset.split(":"); const cur = String(rvGet(RV.data, p) ?? "");
    rvSet(RV.data, p, cur === v ? "" : p === "round" ? +v : v); RV.dirty = true;
    const grp = rvs.parentElement; $$("[data-rvset]", grp).forEach((b) => b.setAttribute("aria-pressed", b === rvs && cur !== v));
    if (p === "result") render();
    return;
  }
  const b = e.target.closest("[data-x]"); if (!b) return;
  const [act, a1, a2, a3, a4] = b.dataset.x.split(":");
  try {
    if (act === "resolve") { await api("PATCH", `/api/comments/${a1}`, { resolved: a2 === "1" }); await refreshMeta(); render(); return; }
    if (act === "subrev") {
      const reply = ($(`#rp_${a1}`) || {}).value || "";
      if (a2 === "returned" && !reply.trim()) { toast("บอกนักเรียนว่าต้องแก้ส่วนไหนก่อนส่งกลับ"); return; }
      await api("PATCH", `/api/submissions/${a1}`, { status: a2, reply }); toast(a2 === "approved" ? "รับรองแล้ว" : "ส่งกลับให้นักเรียนแก้ไขแล้ว"); render(); return;
    }
    if (act === "pdelete") {
      if (!b.dataset.armed) { b.dataset.armed = "1"; b.textContent = "แตะอีกครั้งเพื่อยืนยันการลบกลุ่ม"; b.classList.add("pri"); return; }
      b.disabled = true; await api("DELETE", `/api/projects/${a1}`); toast("ลบกลุ่มแล้ว กู้คืนได้จากหน้าห้อง");
      go(TP.class_id ? `#/class/${TP.class_id}` : "#/teacher"); return;
    }
    if (act === "fdel") {
      if (!b.dataset.armed) { b.dataset.armed = "1"; b.textContent = "ยืนยันลบ"; return; }
      await api("DELETE", `/api/files/${a1}`); toast("ลบไฟล์แล้ว"); render(); return;
    }
    if (act === "sdel") {
      if (!b.dataset.armed) { b.dataset.armed = "1"; b.textContent = "ยืนยันลบ"; b.classList.add("pri"); setTimeout(() => { if (b.isConnected && !b.disabled) { delete b.dataset.armed; b.textContent = "ลบ"; b.classList.remove("pri"); } }, 5000); return; }
      b.disabled = true; await api("DELETE", `/api/classes/${a1}/students/${a2}`); toast("ลบนักเรียนแล้ว"); render(); return;
    }
    if (act === "srestore") { b.disabled = true; const r = await api("POST", `/api/classes/${a1}/students/${a2}/restore`); toast(r.note || "กู้คืนแล้ว"); render(); return; }
    if (act === "prestore") { b.disabled = true; await api("POST", `/api/projects/${a1}/restore`); toast("กู้คืนกลุ่มแล้ว"); render(); return; }
    if (act === "rvsave") { b.disabled = true; await saveReview(); b.disabled = false; render(); return; }
    if (act === "rvdl") { if (RV.dirty) await saveReview(true); download(RV.kind, a1, RV.pid); return; }
    if (act === "mx") {
      const val = mxSet(a1, +a2, +a3, Number(a4));
      const grp = b.parentElement; $$("[data-x]", grp).forEach((x) => x.setAttribute("aria-pressed", x === b && val !== ""));
      const items = REC[a1].items(); const rows = mxRead(getPath(S, REC[a1].path));
      const n = $('[data-live="mxn"]'); if (n) n.textContent = items.filter((_, i) => valid(a1, mxCell(a1, rows, +a2, i))).length;
      if (+a2 >= mxCount(a1, rows, items.length) - 1 && !$(`a[href="#/rec/${a1}/${+a2 + 1}"].chip`)) render();
      return;
    }
    if (act === "mxdel") {
      if (!b.dataset.armed) { b.dataset.armed = "1"; b.textContent = "แตะอีกครั้งเพื่อลบ"; return; }
      mxDel(a1, +a2); go(`#/rec/${a1}/${Math.max(0, +a2 - 1)}`); return;
    }
    if (act === "perfadd") {
      const p = S.ch3.perf[+a1]; p.rows = p.rows || []; const start = p.rows.length;
      for (let i = 0; i < +a2; i++) p.rows.push(p.mode === "num" ? { item: `ครั้งที่ ${start + i + 1}`, value: "" } : { item: "", exp: "", act: "", pass: true });
      markDirty(`ch3.perf.${a1}.rows`); render(); return;
    }
    if (act === "evmove") { const ev = S.data.evidence; const i = +a1, j = i + +a2; [ev[i], ev[j]] = [ev[j], ev[i]]; markDirty("data.evidence"); render(); return; }
    if (act === "cropok") { applyCrop(); return; }
  } catch (x) { toast(x.error || x.message); b.disabled = false; }
});
// Leaving a teacher form saves it, so nothing typed on the phone is lost.
window.addEventListener("hashchange", () => { if (RV && RV.dirty) saveReview(true).catch(() => toast("บันทึกแบบประเมินไม่สำเร็จ")); });
window.addEventListener("beforeunload", (e) => { if (RV && RV.dirty) { e.preventDefault(); e.returnValue = ""; } });

// first render() is called at the end of ws.js
