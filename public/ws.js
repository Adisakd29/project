/* ProjectElec — Electronics Engineering Workspace (UI layer).
   Adds: theme switch, report navigator with honest section status, contextual writing help (no AI needed),
   phone toolbar + bottom sheets, focus writing mode, keyboard-safe scrolling, dashboard summary, nicer login.
   It only decorates screens rendered by app.js / p1.js / editors.js; data, sync and document export are unchanged. */
"use strict";

/* ---------------- icons ---------------- */
const WI = {
  menu: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><path d="M4 6h16M4 12h16M4 18h10"/></svg>',
  help: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z"/></svg>',
  page: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><path d="M6 3h9l4 4v14H6z"/><path d="M14 3v5h5M9 13h7M9 17h7"/></svg>',
  expand: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M14 4h6v6M10 20H4v-6M20 4l-7 7M4 20l7-7"/></svg>',
  close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  sun: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>',
  moon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/></svg>',
  auto: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><circle cx="12" cy="12" r="8"/><path d="M12 4a8 8 0 0 1 0 16z" fill="currentColor"/></svg>',
  eye: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>',
  eyeoff: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><path d="M3 3l18 18M10.6 5.1A10.6 10.6 0 0 1 12 5c6.4 0 10 7 10 7a17 17 0 0 1-3.2 4.1M6.6 6.6C3.9 8.3 2 12 2 12s3.6 7 10 7c1.8 0 3.4-.5 4.8-1.3M9.9 9.9a3 3 0 0 0 4.2 4.2"/></svg>',
  side: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16"/></svg>',
};

/* ---------------- theme ---------------- */
const THEMES = ["auto", "light", "dark"];
function themeGet() { try { return localStorage.getItem("pe-theme") || "auto"; } catch (e) { return "auto"; } }
function themeApply(t) {
  if (t === "auto") delete document.documentElement.dataset.theme; else document.documentElement.dataset.theme = t;
  try { localStorage.setItem("pe-theme", t); } catch (e) { /* private mode */ }
  const b = $("#themebtn"); if (!b) return;
  const lbl = { auto: "ธีมตามเครื่อง", light: "โหมดสว่าง", dark: "โหมดมืด" }[t];
  b.innerHTML = WI[t === "auto" ? "auto" : t === "dark" ? "moon" : "sun"]; b.title = lbl + " (แตะเพื่อสลับ)"; b.setAttribute("aria-label", lbl + " — แตะเพื่อสลับ");
}
$("#themebtn").addEventListener("click", () => { const t = THEMES[(THEMES.indexOf(themeGet()) + 1) % 3]; themeApply(t); toast({ auto: "ใช้ธีมตามการตั้งค่าเครื่อง", light: "โหมดสว่าง", dark: "โหมดมืด" }[t], 1500); });
themeApply(themeGet());

/* ---------------- writing guide (works offline, no AI) ----------------
   Examples use one fictional electronics project so students see the style, not text to copy. */
const EXP = "ระบบเปิด–ปิดไฟทางเดินอัตโนมัติด้วยเซนเซอร์แสง LDR และ ESP32";
const has = (x) => x != null && String(x).trim() !== "";
const GUIDE = {
  kp01: {
    what: "แบบเสนอโครงงาน 18 ข้อ ใช้สอบหัวข้อ (สัปดาห์ 3–4) คำตอบส่วนใหญ่จะถูกนำไปเติมบทที่ 1 ให้อัตโนมัติ",
    how: ["ตอบทีละคำถามตามลำดับ ข้ามข้อที่ยังไม่รู้ไปก่อนได้", "ชื่อโครงงานไม่เกิน 1 บรรทัด และบอกผลลัพธ์ของงาน", "ข้อ 5 เขียน 4 ย่อหน้า: สภาพปัจจุบัน → ปัญหา → แนวทางเดิมที่ยังมีข้อบกพร่อง → แนวทางของเรา"],
    ex: `ชื่อโครงงาน: ${EXP}`,
    mistakes: ["ชื่อยาวเกิน 1 บรรทัด หรือบอกแค่อุปกรณ์ ไม่บอกว่าทำอะไรได้", "ความเป็นมาไม่มีแหล่งอ้างอิง", "งบประมาณไม่ตรงกับรายการอุปกรณ์จริง"],
    check: () => [[KP01.every((q) => q.done()), "ตอบครบทุกคำถาม"], [has(S.info.titleTh) && S.info.titleTh.length <= 70, "ชื่อโครงงานไม่เกิน 1 บรรทัด"], [S.ch1.bg.every(has), "ความเป็นมาครบ 4 ย่อหน้า"], [S.budget.some((r) => has(r.item)), "มีรายการงบประมาณ"]],
  },
  info: {
    what: "ข้อมูลหน้าปกและหัวแบบฟอร์มทุกฉบับ: ชื่อโครงงานไทย/อังกฤษ ประเภท สมาชิก ครูที่ปรึกษา",
    how: ["ชื่อภาษาอังกฤษใช้ตัวพิมพ์ใหญ่ขึ้นต้นคำสำคัญ", "ตรวจชื่อ-นามสกุล รหัสนักศึกษาให้ตรงทะเบียน เพราะจะพิมพ์ลงทุกเอกสาร"],
    ex: "Automatic Corridor Lighting System Using an LDR Sensor and ESP32",
    mistakes: ["สะกดชื่อสมาชิกไม่ตรงกันในแต่ละเอกสาร", "ลืมใส่ชื่อครูผู้สอนรายวิชา"],
    check: () => [[has(S.info.titleTh), "มีชื่อภาษาไทย"], [has(S.info.titleEn), "มีชื่อภาษาอังกฤษ"], [members().length > 0 && members().every((m) => has(m.sid)), "สมาชิกมีรหัสนักศึกษาครบ"], [has(S.advisors.main), "มีครูที่ปรึกษา"]],
  },
  ch1: {
    what: "บทนำ: บอกว่าทำไมต้องทำโครงงานนี้ ทำเพื่ออะไร ขอบเขตแค่ไหน และได้ประโยชน์อะไร",
    how: ["เรียงเหตุผล: ปัญหา → วิธีแก้ → วัตถุประสงค์ → ประโยชน์", "วัตถุประสงค์ต้องวัดผลได้ และตรงกับสิ่งที่ทดสอบในบทที่ 4"],
    ex: "ปัจจุบันอาคารเรียนหลายแห่งเปิดไฟทางเดินทิ้งไว้ตลอดคืน ทำให้สิ้นเปลืองพลังงานไฟฟ้า… (ตัวอย่างสมมติ)",
    mistakes: ["วัตถุประสงค์กับสมมติฐานไม่สอดคล้องกัน", "อ้างตัวเลขสถิติโดยไม่บอกแหล่งที่มา"],
    check: () => [[S.ch1.bg.every(has), "ความเป็นมาครบ 4 ย่อหน้า"], [objectives().length >= 2, "วัตถุประสงค์อย่างน้อย 2 ข้อ"], [has(S.ch1.spec), "ระบุขอบเขตด้านเนื้อหา/สเปก"], [S.ch1.terms.length > 0, "มีนิยามศัพท์"], [S.ch1.benefits.filter(has).length >= 2, "ประโยชน์อย่างน้อย 2 ข้อ"]],
    sub: {
      "1.1": { tip: "4 ย่อหน้า ย่อหน้าละ 4–6 บรรทัด อ้างอิงแบบ (ผู้แต่ง, ปี) แล้วเพิ่มแหล่งนั้นในบรรณานุกรม", ex: "…จากรายงานของการไฟฟ้า พบว่าแสงสว่างในอาคารใช้พลังงานร้อยละ 20 ของทั้งหมด (ชื่อหน่วยงาน, 2566)" },
      "1.2": { tip: "ขึ้นต้นด้วยคำกริยา เช่น “เพื่อพัฒนา…” “เพื่อทดสอบประสิทธิภาพ…” “เพื่อศึกษาความพึงพอใจ…”", ex: "1) เพื่อพัฒนาระบบเปิด–ปิดไฟอัตโนมัติด้วยเซนเซอร์ LDR 2) เพื่อทดสอบความถูกต้องในการตรวจจับแสง" },
      "1.4": { tip: "บอกสเปกที่วัดได้ เช่น แรงดัน กระแส ขนาด ระยะทำงาน และกลุ่มตัวอย่างกับระยะเวลา", ex: "ใช้ไฟ 5 V DC, ตรวจจับความสว่างต่ำกว่า 50 lux, ตอบสนองภายใน 2 วินาที" },
      "1.6": { tip: "อธิบายคำเฉพาะที่ผู้อ่านอาจไม่รู้ เช่น ชื่อบอร์ด เซนเซอร์ โปรโตคอล", ex: "LDR หมายถึง ตัวต้านทานที่ค่าความต้านทานเปลี่ยนตามความเข้มแสง" },
      "1.7": { tip: "บอกว่าใครได้ประโยชน์และอย่างไร ไม่ซ้ำกับวัตถุประสงค์", ex: "ช่วยลดค่าไฟฟ้าของทางเดินอาคารในเวลากลางคืน" },
    },
  },
  ch2: {
    what: "แนวคิด ทฤษฎี และงานวิจัยที่เกี่ยวข้อง ยาวประมาณ 15–20 หน้า (คู่มือ) อธิบายหลักการของอุปกรณ์และเทคโนโลยีที่ใช้",
    how: ["เรียงจากภาพรวม → อุปกรณ์หลัก → ซอฟต์แวร์/การสื่อสาร", "ทุกหัวข้อต้องมีแหล่งอ้างอิง และอยู่ในบรรณานุกรม APA 6", "ใส่ภาพ Block diagram หรือขาอุปกรณ์ พร้อมคำบรรยายภาพ"],
    ex: "2.1 ไมโครคอนโทรลเลอร์ ESP32 · 2.2 ตัวต้านทานไวแสง (LDR) · 2.3 รีเลย์และการขับโหลด AC · 2.4 งานวิจัยที่เกี่ยวข้อง",
    mistakes: ["คัดลอกเนื้อหาจากเว็บมาทั้งหน้าโดยไม่เรียบเรียง", "มีหัวข้อทฤษฎีที่ไม่ได้ใช้ในโครงงาน", "งานวิจัยที่เกี่ยวข้องไม่ระบุปีและผลการวิจัย"],
    check: () => [[S.ch2.topics.filter((t) => has(t.title) && has(t.body)).length >= 3, "หัวข้อทฤษฎีที่มีเนื้อหาอย่างน้อย 3 หัวข้อ"], [S.ch2.related.length >= 5, "งานวิจัยที่เกี่ยวข้องอย่างน้อย 5 เรื่อง"], [(() => { const r = allRefs(); return r.th.length + r.en.length >= 5; })(), "บรรณานุกรมอย่างน้อย 5 รายการ"]],
  },
  ch3: {
    what: "วิธีดำเนินการ: ขั้นตอนสร้างชิ้นงาน เครื่องมือวิจัย (แบบสอบถาม แบบบันทึกผลทดสอบ) และการวิเคราะห์ข้อมูล",
    how: ["เขียนขั้นตอนการสร้างตามลำดับจริง พร้อม Block diagram / วงจร / Flowchart", "แต่ละด้านที่ทดสอบต้องบอกวิธีทดสอบ จำนวนครั้ง และเกณฑ์ผ่าน", "แบบสอบถามต้องผ่านการตรวจ IOC ≥ 0.50"],
    ex: "ทดสอบความถูกต้องในการเปิดไฟ 20 ครั้ง ที่ความสว่าง 10–100 lux เกณฑ์: ไฟติดเมื่อแสงต่ำกว่า 50 lux ภายใน 2 วินาที",
    mistakes: ["ไม่บอกเกณฑ์ผ่าน/ไม่ผ่านของการทดสอบ", "ข้อคำถามแบบสอบถามถามเรื่องที่ไม่ได้วัดในวัตถุประสงค์"],
    check: () => [[S.ch3.steps.filter(has).length >= 3, "ขั้นตอนการสร้างอย่างน้อย 3 ขั้น"], [!!S.ch3.photo, "มีภาพชิ้นงาน"], [S.ch3.expertItems.length >= 5, "ข้อคำถามผู้เชี่ยวชาญอย่างน้อย 5 ข้อ"], [S.ch3.perf.length > 0 && S.ch3.perf.every((p) => has(p.name)), "ตั้งชื่อด้านที่ทดสอบครบ"]],
  },
  data: {
    what: "ผลการดำเนินงาน: นำข้อมูลจริงที่เก็บได้มาแสดงเป็นตาราง กราฟ และค่าสถิติ ระบบคำนวณให้จากตัวเลขที่บันทึก",
    how: ["บันทึกผลทดลองทุกครั้ง รวมครั้งที่ไม่ผ่าน", "ใส่หน่วยวัด ค่าเป้าหมาย และค่าคลาดเคลื่อนที่ยอมรับได้", "ถ่ายภาพหลักฐานขณะทดสอบ ใส่คำบรรยายภาพ"],
    ex: "ครั้งที่ 1: 48 lux → ไฟติด 1.2 วินาที (ผ่าน) · ครั้งที่ 2: 55 lux → ไฟไม่ติด (ถูกต้องตามเกณฑ์)",
    mistakes: ["แต่งตัวเลขให้ผ่านทุกครั้ง (ห้ามทำ)", "จำนวนคอลัมน์คะแนนไม่ตรงกับจำนวนข้อคำถาม", "ไม่มีหน่วยวัด"],
    check: () => { const L = likert(S.data.expertScores, S.ch3.expertItems), T = satStats(); return [[L.n >= 3, `คะแนนผู้เชี่ยวชาญอย่างน้อย 3 คน (มี ${L.n})`], [S.ch3.perf.length > 0 && S.ch3.perf.every((p) => (p.rows || []).length), "มีผลทดสอบทุกด้าน"], [T.n > 0, `มีผลความพึงพอใจ (${T.n} คน)`], [!L.mismatch && !T.mismatch, "จำนวนคะแนนตรงกับจำนวนข้อ"]]; },
  },
  ch5: {
    what: "สรุปผล อภิปรายผล และข้อเสนอแนะ โดยอ้างตัวเลขจากบทที่ 4",
    how: ["สรุปตามวัตถุประสงค์ทีละข้อ", "อภิปราย: ทำไมผลจึงเป็นเช่นนั้น เทียบกับทฤษฎีหรืองานวิจัยในบทที่ 2", "ข้อเสนอแนะต้องทำได้จริง เช่น เพิ่มเซนเซอร์ตรวจจับคน"],
    ex: "ผลการทดสอบความถูกต้องร้อยละ 95.00 เนื่องจากค่า LDR เปลี่ยนตามอุณหภูมิเล็กน้อย สอดคล้องกับ… (ตัวอย่างสมมติ)",
    mistakes: ["สรุปตัวเลขไม่ตรงกับบทที่ 4", "อภิปรายโดยไม่มีเหตุผลหรือการอ้างอิง"],
    check: () => [[has(S.ch5.whyExpert), "อภิปรายผลผู้เชี่ยวชาญ"], [has(S.ch5.whyPerf), "อภิปรายผลการทดสอบ"], [has(S.ch5.whyUser), "อภิปรายผลความพึงพอใจ"]],
  },
  front: {
    what: "ส่วนประกอบตอนต้นและภาคผนวก: บทคัดย่อไทย/อังกฤษ กิตติกรรมประกาศ คู่มือการใช้งาน ภาพกิจกรรม ประวัติผู้วิจัย",
    how: ["บทคัดย่อ 1 หน้า: วัตถุประสงค์ วิธีการ ผลการวิจัย (มีตัวเลข)", "คำสำคัญ 3–5 คำ ทั้งไทยและอังกฤษ", "ภาคผนวกใส่ภาพวงจรจริง Wiring และภาพขณะทดสอบ"],
    ex: "คำสำคัญ: ไฟอัตโนมัติ, LDR, ESP32 / Keywords: automatic lighting, LDR, ESP32",
    mistakes: ["บทคัดย่อภาษาอังกฤษแปลด้วยเครื่องโดยไม่ตรวจ", "ลืมคำสำคัญ"],
    check: () => [[has(S.info.kwTh) && has(S.info.kwEn), "มีคำสำคัญและ Keywords"], [S.photos.length > 0, "มีภาพกิจกรรม"]],
  },
  plan: {
    what: "แผนการดำเนินงาน งบประมาณ หลักการทำงาน และวันที่สำหรับคำร้อง คพ.02 / 04 / 06",
    how: ["แผนงานเลือกสัปดาห์ตามปฏิทิน 18 สัปดาห์", "งบประมาณใส่ราคาต่อหน่วยตามใบเสร็จจริง ระบบรวมเงินให้"],
    ex: "ESP32 DevKit 1 ชิ้น 250 บาท · LDR 5 mm 2 ชิ้น 10 บาท · Relay 5V 1 ช่อง 1 ชิ้น 35 บาท",
    mistakes: ["รวมเงินผิด (ระบบคำนวณให้แล้ว)", "แผนงานไม่สอดคล้องกับปฏิทินรายวิชา"],
    check: () => [[S.plan.steps.length > 0 && S.plan.steps.every((s) => (s.w || []).length), "ทุกขั้นตอนมีช่วงเวลา"], [S.budget.some((r) => has(r.item) && +r.price > 0), "มีงบประมาณพร้อมราคา"], [has(S.principle), "มีหลักการทำงาน"]],
  },
};

/* ---------------- section status ----------------
   0 ยังไม่เริ่ม · 1 กำลังเขียน · 2 ครบถ้วน (fields filled AND every checklist rule passes) · 3 ส่งตรวจแล้ว · 4 ต้องแก้ไข (teacher comment open)
   A section never shows 100% unless its checklist passes. */
const STATUS = [["ยังไม่เริ่ม", "s0"], ["กำลังเขียน", "s1"], ["ครบถ้วน", "s2"], ["ส่งตรวจแล้ว", "s3"], ["ต้องแก้ไข", "s4"]];
const STAGE_OF = { kp01: "kp01", info: "p50", ch1: "p50", ch2: "p50", ch3: "p50", data: "p70", ch5: "p70", front: "p90" };
const SHORT = { kp01: "คพ.01", info: "ข้อมูลโครงงาน", ch1: "บทที่ 1", ch2: "บทที่ 2", ch3: "บทที่ 3", data: "บทที่ 4", ch5: "บทที่ 5", front: "ส่วนต้น/ผนวก", plan: "แผน/งบ/คำร้อง" };
const SEC_NO = { kp01: "01", info: "i", ch1: "1", ch2: "2", ch3: "3", data: "4", ch5: "5", front: "ก", plan: "คพ" };
function secCheck(id) { const g = GUIDE[id]; try { return g && g.check ? g.check() : []; } catch (e) { return []; } }
function secStatus(s) {
  let p = 0; try { p = Math.max(0, Math.min(100, Math.round(s.p()))); } catch (e) { /* ignore */ }
  const ck = secCheck(s.id); const pass = ck.every(([ok]) => ok);
  const shown = pass ? p : Math.min(p, 95);
  let code = p === 0 ? 0 : p >= 100 && pass ? 2 : 1;
  const st = STAGE_OF[s.id]; const sub = st && P && P.submissions ? lastSub(P.submissions, st) : null;
  if (sub && (sub.status === "submitted" || sub.status === "approved")) code = 3;
  if (P && openTeacherComments(s.id).length) code = 4;
  return { code, label: sub && sub.status === "approved" && code === 3 ? "ครูรับรองแล้ว" : STATUS[code][0], cls: STATUS[code][1], pct: shown, ck };
}
const stBadge = (st) => `<span class="st ${st.cls}">${st.label}</span>`;

/* ---------------- which section is on screen ---------------- */
const WS_ROUTES = ["write", "edit", "kp01", "kp01list", "rec", "perf", "evidence"];
function currentSec() {
  const n = route.name, a = route.args || [];
  if (n === "edit") return a[0];
  if (n === "kp01" || n === "kp01list") return "kp01";
  if (n === "rec" || n === "perf" || n === "evidence") return "data";
  return null;
}
const secLabel = (id) => (SECTIONS.find((s) => s.id === id) || {}).label || "ภาพรวมรายงาน";

/* ---------------- navigator (sidebar on desktop, bottom sheet on phone) ---------------- */
function navHTML(withHead) {
  const cur = currentSec();
  const legends = $$("#view fieldset > legend").map((lg, i) => { const fs = lg.parentElement; fs.id = fs.id || `sub-${i}`; return [fs.id, lg.textContent.trim()]; });
  const dataSub = [["#/rec/expert/0", "คะแนนผู้เชี่ยวชาญ (แตะทีละคน)"], ["#/perf/0", "ผลการทดลองรายครั้ง"], ["#/evidence", "ภาพหลักฐานการทดสอบ"], ["#/rec/user/0", "แบบสอบถามความพึงพอใจ"], ["#/rec/ioc/0", "ค่า IOC"]];
  const groups = [["เอกสารเสนอโครงงาน", ["kp01", "plan"]], ["รายงานฉบับสมบูรณ์", ["info", "front", "ch1", "ch2", "ch3", "data", "ch5"]]];
  const item = (s) => {
    const st = secStatus(s); const on = s.id === cur;
    const href = s.href || "#/edit/" + s.id;
    let sub = "";
    if (on && route.name === "edit" && legends.length) sub = `<ul class="wnav-sub">${legends.map(([id, t]) => `<li><a href="#${id}" data-jump="${id}">${esc(t)}</a></li>`).join("")}</ul>`;
    if (s.id === "data" && on) sub += `<ul class="wnav-sub">${dataSub.map(([h, t]) => `<li><a href="${h}">${t}</a></li>`).join("")}</ul>`;
    if (s.id === "ch2" && on && route.name !== "edit") sub += "";
    return `<li><a href="${href}" ${on ? 'aria-current="page"' : ""}><span class="no">${SEC_NO[s.id] || ""}</span><span class="lb">${esc(s.label)}</span>${stBadge(st)}</a>${sub}</li>`;
  };
  return `${withHead ? `<div class="wnav-head"><b>โครงสร้างรายงาน</b><button class="btn ghost sm" type="button" data-ws="navcollapse" title="ยุบแถบ" aria-label="ยุบแถบโครงสร้างรายงาน">${WI.side}</button></div>` : ""}
    <a class="btn block ${cur ? "ghost" : ""}" href="#/write" style="justify-content:flex-start;margin-bottom:8px">ภาพรวมทุกบท</a>
    ${groups.map(([g, ids]) => `<p class="sectitle" style="margin:12px 8px 4px">${g}</p><ul class="wnav-list">${ids.map((id) => SECTIONS.find((s) => s.id === id)).filter(Boolean).map(item).join("")}</ul>`).join("")}
    <div class="wnav-tools"><a href="#/view/${cur === "kp01" ? "kp01" : cur === "plan" ? "kp02" : "report"}">ดูตัวอย่างเอกสาร A4</a><a href="#/export">ดาวน์โหลด PDF / Word</a><a href="#/history">ประวัติการแก้ไข</a><a href="#/feedback">ความเห็นจากครู</a><a href="#/provenance">ที่มาของงานเขียน / การใช้ AI</a></div>`;
}

/* ---------------- contextual help ---------------- */
let HELP_CTX = "";
function helpHTML() {
  const id = currentSec();
  if (!id) return `<div class="help"><h3>เริ่มเขียนรายงาน</h3><p>เริ่มจาก คพ.01 ก่อน คำตอบจะถูกเติมลงบทที่ 1 ให้อัตโนมัติ จากนั้นเขียนบทที่ 2–5 ตามลำดับ</p>
    <h4>สถานะแต่ละบท</h4><ul class="ck">${STATUS.map(([t, c]) => `<li><span class="st ${c}" style="padding:0 6px"></span><span>${t}</span></li>`).join("")}</ul>
    <p class="hint" style="margin-top:10px">“ครบถ้วน” = กรอกครบและผ่านรายการตรวจของบทนั้นตามคู่มือ ไม่ได้นับจากจำนวนช่องอย่างเดียว</p></div>`;
  const g = GUIDE[id]; if (!g) return "";
  const subKey = HELP_CTX && (HELP_CTX.match(/^(\d\.\d)/) || [])[1];
  const sub = g.sub && subKey && g.sub[subKey];
  const ck = secCheck(id);
  return `<div class="help">${HELP_CTX ? `<p class="ctx">กำลังเขียน: ${esc(HELP_CTX)}</p>` : ""}
    <h3>${esc(secLabel(id))}</h3><p>${esc(g.what)}</p>
    ${sub ? `<h4>หัวข้อนี้ควรเขียน</h4><p>${esc(sub.tip)}</p><div class="ex">${esc(sub.ex)}<small>ตัวอย่างจากโครงงานสมมติ “${esc(EXP)}” ใช้ดูรูปแบบเท่านั้น</small></div>` : ""}
    <h4>แนวทางการเรียบเรียง</h4><ul>${g.how.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>
    ${!sub ? `<h4>ตัวอย่างจากโครงงานสมมติ</h4><div class="ex">${esc(g.ex)}<small>ใช้ดูรูปแบบการเขียน ห้ามคัดลอกเป็นข้อมูลของโครงงานจริง</small></div>` : ""}
    <h4>ข้อผิดพลาดที่พบบ่อย</h4><ul class="mist">${g.mistakes.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>
    ${ck.length ? `<h4>Checklist ของบทนี้</h4><ul class="ck">${ck.map(([ok, t]) => `<li><span class="${ok ? "y" : "n"}">${ok ? "✓" : "○"}</span><span>${esc(t)}</span></li>`).join("")}</ul>` : ""}</div>`;
}

/* ---------------- bottom sheet ---------------- */
function sheetOpen(title, html) {
  const bs = $("#bsheet"), bd = $("#backdrop");
  bs.innerHTML = `<div class="grab"></div><div class="bs-head"><b id="bs-title">${esc(title)}</b><button class="btn ghost sm" type="button" data-ws="sheetclose" aria-label="ปิด">${WI.close}</button></div>${html}`;
  bs.hidden = false; requestAnimationFrame(() => { bs.classList.add("on"); bd.classList.add("on"); });
  bs.dataset.prev = document.activeElement && document.activeElement.id || "";
  setTimeout(() => { const f = bs.querySelector("[data-ws=sheetclose]"); if (f) f.focus(); }, 50);
}
function sheetClose() {
  const bs = $("#bsheet"), bd = $("#backdrop"); if (bs.hidden) return;
  bs.classList.remove("on"); bd.classList.remove("on"); setTimeout(() => { bs.hidden = true; bs.innerHTML = ""; }, 260);
}
$("#backdrop").addEventListener("click", sheetClose);
document.addEventListener("keydown", (e) => { if (e.key === "Escape") { if ($(".focusw")) focusClose(); else sheetClose(); } });

/* ---------------- layout state ---------------- */
const prefs = (() => { try { return JSON.parse(localStorage.getItem("pe-ws") || "{}"); } catch (e) { return {}; } })();
const savePrefs = () => { try { localStorage.setItem("pe-ws", JSON.stringify(prefs)); } catch (e) { /* ignore */ } };
const wide = () => window.matchMedia("(min-width:1100px)").matches;
function applyLayout() {
  document.body.classList.toggle("help-open", prefs.help !== false);
  document.body.classList.toggle("nav-collapsed", !!prefs.navCollapsed);
}

/* ---------------- decorate a workspace screen ---------------- */
function wsDecorate() {
  const isWS = !!(S && ME && ME.user && ME.user.role === "student" && WS_ROUTES.includes(route.name));
  document.body.classList.toggle("ws", isWS);
  const bar = $("#wsbar");
  if (!isWS) { bar.innerHTML = ""; $("#wnav").innerHTML = ""; $("#whelp").innerHTML = ""; ["#helpbtn", "#navbtn"].forEach((x) => $(x) && $(x).remove()); return; }
  applyLayout();
  const id = currentSec();
  const docFor = id === "kp01" ? "kp01" : id === "plan" ? "kp02" : "report";
  // phone toolbar
  bar.innerHTML = `<button class="btn" type="button" data-ws="nav">${WI.menu}<span>${id ? esc(SHORT[id] || "หัวข้อ") : "หัวข้อ"}</span></button>
    <button class="btn" type="button" data-ws="help">${WI.help}<span>คำแนะนำ</span></button>
    <a class="btn" href="#/view/${docFor}">${WI.page}<span>ดูตัวอย่าง</span></a>`;
  // desktop panels
  $("#wnav").innerHTML = navHTML(true);
  HELP_CTX = ""; $("#whelp").innerHTML = helpHTML() + `<p class="hint" style="margin-top:18px"><button class="btn ghost sm" type="button" data-ws="helphide">ซ่อนคำแนะนำ</button></p>`;
  if (!$("#navbtn")) { const b = document.createElement("button"); b.id = "navbtn"; b.className = "iconbtn"; b.type = "button"; b.innerHTML = WI.side; b.title = "แสดง/ซ่อนโครงสร้างรายงาน"; b.setAttribute("aria-label", "แสดงหรือซ่อนโครงสร้างรายงาน"); b.dataset.ws = "navtoggle"; $("#themebtn").before(b); }
  if (!$("#helpbtn")) { const b = document.createElement("button"); b.id = "helpbtn"; b.className = "iconbtn"; b.type = "button"; b.innerHTML = WI.help; b.title = "คำแนะนำการเขียน"; b.setAttribute("aria-label", "เปิด/ปิดคำแนะนำการเขียน"); b.dataset.ws = "help"; $("#themebtn").before(b); }
  // in-page: jump chips + previous / next section
  const view = $("#view");
  if (route.name === "edit") {
    const legends = $$("fieldset > legend", view);
    if (legends.length > 2 && !wide()) view.insertAdjacentHTML("afterbegin", `<nav class="subnav" aria-label="หัวข้อในบทนี้">${legends.map((lg, i) => { const fs = lg.parentElement; fs.id = fs.id || `sub-${i}`; return `<a href="#${fs.id}" data-jump="${fs.id}">${esc(lg.textContent.trim().replace(/\s*\(.*\)$/, ""))}</a>`; }).join("")}</nav>`);
    const order = SECTIONS.map((s) => s.id); const i = order.indexOf(id);
    const prev = SECTIONS[i - 1], next = SECTIONS[i + 1];
    const link = (s, cls, dir) => (s ? `<a class="${cls}" href="${s.href || "#/edit/" + s.id}"><small>${dir}</small><b>${esc(s.label)}</b></a>` : "");
    if (PROV_SECS[id] && id !== "info") view.insertAdjacentHTML("beforeend", aiDeclareHTML(id));
    view.insertAdjacentHTML("beforeend", `<nav class="secnav" aria-label="บทก่อนหน้าและถัดไป">${link(prev, "pv", "‹ ก่อนหน้า")}${link(next, "nx", "ถัดไป ›")}</nav>`);
  }
  // long text: expand to focus mode
  $$("textarea", view).forEach((ta) => {
    if (ta.closest(".fx") || !ta.dataset.k || ta.classList.contains("mono")) return;
    const w = document.createElement("div"); w.className = "fx"; ta.parentNode.insertBefore(w, ta); w.appendChild(ta);
    w.insertAdjacentHTML("beforeend", `<button class="expand" type="button" data-ws="focus" title="เขียนแบบเต็มจอ" aria-label="เขียนแบบเต็มจอ">${WI.expand}</button>`);
  });
}

/* ---------------- focus writing mode ---------------- */
let FOCUS = null;
function focusOpen(ta) {
  const f = ta.closest(".f"); const lbl = (f && f.querySelector("label") && f.querySelector("label").textContent) || (ta.closest("fieldset") && ta.closest("fieldset").querySelector("legend").textContent) || "เขียนข้อความ";
  FOCUS = { src: ta, y: window.scrollY };
  const d = document.createElement("div"); d.className = "focusw"; d.setAttribute("role", "dialog"); d.setAttribute("aria-label", "โหมดเขียนเต็มจอ");
  d.innerHTML = `<header><b>${esc(lbl.trim())}</b><button class="btn pri sm" type="button" data-ws="focusclose">เสร็จ</button></header>
    <textarea data-k="${esc(ta.dataset.k)}" ${ta.dataset.count ? `data-count="1"` : ""} aria-label="${esc(lbl.trim())}" spellcheck="true" lang="th">${esc(ta.value)}</textarea>
    <div class="fbar"><span data-fw-count>${ta.value.length} ตัวอักษร</span><span id="fw-sync">${$("#sync span") ? $("#sync span").textContent : ""}</span></div>`;
  document.body.appendChild(d); document.body.style.overflow = "hidden";
  const t = d.querySelector("textarea"); t.focus(); t.setSelectionRange(t.value.length, t.value.length);
  t.addEventListener("input", () => { d.querySelector("[data-fw-count]").textContent = `${t.value.length} ตัวอักษร`; FOCUS.src.value = t.value; });
}
function focusClose() {
  const d = $(".focusw"); if (!d || !FOCUS) return;
  FOCUS.src.value = d.querySelector("textarea").value; d.remove(); document.body.style.overflow = "";
  window.scrollTo(0, FOCUS.y); FOCUS.src.focus({ preventScroll: true }); FOCUS = null; updateCounters();
}
// keep the focus editor above the on-screen keyboard
if (window.visualViewport) {
  const vv = () => document.documentElement.style.setProperty("--vvh", window.visualViewport.height + "px");
  window.visualViewport.addEventListener("resize", vv); vv();
}

/* ---------------- events ---------------- */
document.addEventListener("click", (e) => {
  const j = e.target.closest("[data-jump]");
  if (j) { e.preventDefault(); const el = document.getElementById(j.dataset.jump); sheetClose(); if (el) { el.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion:reduce)").matches ? "auto" : "smooth", block: "start" }); const f = el.querySelector("input,textarea,select"); if (f && wide()) f.focus({ preventScroll: true }); } return; }
  const b = e.target.closest("[data-ws]"); if (!b) { if (e.target.closest("#bsheet a[href^='#/']")) sheetClose(); return; }
  const a = b.dataset.ws;
  if (a === "nav") sheetOpen("โครงสร้างรายงาน", navHTML(false));
  else if (a === "help") { if (wide()) { prefs.help = !document.body.classList.contains("help-open"); savePrefs(); applyLayout(); } else sheetOpen("คำแนะนำการเขียน", helpHTML()); }
  else if (a === "helphide") { prefs.help = false; savePrefs(); applyLayout(); }
  else if (a === "navcollapse") { prefs.navCollapsed = true; savePrefs(); applyLayout(); toast("ซ่อนแถบแล้ว เปิดอีกครั้งด้วยปุ่มแถบด้านข้างที่มุมขวาบน", 2500); }
  else if (a === "navtoggle") { prefs.navCollapsed = !prefs.navCollapsed; savePrefs(); applyLayout(); }
  else if (a === "sheetclose") sheetClose();
  else if (a === "focus") { const ta = b.parentElement.querySelector("textarea"); if (ta) focusOpen(ta); }
  else if (a === "focusclose") focusClose();
});
// help follows the field being edited
document.addEventListener("focusin", (e) => {
  if (!document.body.classList.contains("ws")) return;
  const fs = e.target.closest && e.target.closest("#view fieldset");
  const ctx = fs && fs.querySelector("legend") ? fs.querySelector("legend").textContent.trim() : "";
  if (ctx !== HELP_CTX) { HELP_CTX = ctx; if (wide() && document.body.classList.contains("help-open")) $("#whelp").innerHTML = helpHTML() + `<p class="hint" style="margin-top:18px"><button class="btn ghost sm" type="button" data-ws="helphide">ซ่อนคำแนะนำ</button></p>`; }
  // phone keyboard: keep the field visible above the keyboard
  if (!wide() && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName) && !e.target.closest(".focusw")) {
    setTimeout(() => { const vv = window.visualViewport; if (vv && vv.height < window.innerHeight * 0.85) { const r = e.target.getBoundingClientRect(); if (r.bottom > vv.height - 16 || r.top < 120) e.target.scrollIntoView({ block: "center" }); } }, 320);
  }
});
// refresh statuses after edits (cheap: only badges in the open navigator)
let navTimer = null;
document.addEventListener("input", (e) => {
  if (!document.body.classList.contains("ws") || !e.target.dataset || !e.target.dataset.k) return;
  clearTimeout(navTimer); navTimer = setTimeout(() => { if (wide()) { const sc = $("#wnav").scrollTop; $("#wnav").innerHTML = navHTML(true); $("#wnav").scrollTop = sc; } const fw = $("#fw-sync"); if (fw) fw.textContent = $("#sync span").textContent; }, 1200);
});
// unsent work: the browser asks before leaving (it is also kept on the phone)
window.addEventListener("beforeunload", (e) => { if (typeof SYNC !== "undefined" && SYNC.dirty && SYNC.dirty.size) { saveLocal(true); e.preventDefault(); e.returnValue = ""; } });

/* ---------------- dashboard summary (student home) ---------------- */
function traceSVG(list) {
  const n = list.length, W = 600, y = 28, x0 = 24, dx = (W - 48) / (n - 1);
  const pts = list.map((s, i) => [x0 + i * dx, y]);
  return `<svg viewBox="0 0 ${W} 56" role="img" aria-label="ความคืบหน้ารายงาน ครบถ้วน ${list.filter((s) => s.st.code >= 2).length} จาก ${n} ส่วน">
    <path class="tr-line" d="M${x0} ${y}H${W - 24}"/>${pts.slice(1).map(([x], i) => (list[i].st.code >= 2 && list[i + 1].st.code >= 2 ? `<path class="tr-on" d="M${pts[i][0]} ${y}H${x}"/>` : "")).join("")}
    ${pts.map(([x], i) => { const c = list[i].st.code; return `<circle class="pad ${c >= 2 ? "on" : c === 1 || c === 4 ? "part" : ""}" cx="${x}" cy="${y}" r="9"><title>${esc(list[i].label)}: ${list[i].st.label}</title></circle><text class="lbl" x="${x}" y="54">${SEC_NO[list[i].id]}</text>`; }).join("")}</svg>`;
}
function dashboardHTML() {
  const ids = ["kp01", "ch1", "ch2", "ch3", "data", "ch5", "front"];
  const list = ids.map((id) => { const s = SECTIONS.find((x) => x.id === id); return { id, label: s.label, s, st: secStatus(s) }; });
  const done = list.filter((x) => x.st.code >= 2).length;
  const next = list.find((x) => x.st.code === 4) || list.find((x) => x.st.code < 2) || list[list.length - 1];
  const fixes = list.filter((x) => x.st.code === 4);
  const adv = S.advisors.main || "";
  return `<section class="card dash" aria-labelledby="dash-h">
    <div><p class="sectitle" style="margin:0 0 4px">โครงงานของฉัน</p><h2 id="dash-h" style="font-size:20px">${esc(S.info.titleTh || "ยังไม่ได้ตั้งชื่อโครงงาน")}</h2>${S.info.titleEn ? `<p class="hint" lang="en">${esc(S.info.titleEn)}</p>` : ""}</div>
    <dl class="kv"><dt>สมาชิก</dt><dd>${P.members.map((m) => esc(m.display_name)).join(", ")}</dd>${adv ? `<dt>ครูที่ปรึกษา</dt><dd>${esc(adv)}</dd>` : ""}<dt>กำลังทำ</dt><dd>${esc(next.label)} ${stBadge(next.st)}</dd></dl>
    <div class="trace">${traceSVG(list)}<div class="legend"><span>ครบถ้วน ${done}/${list.length} ส่วน</span><span>● ครบถ้วน</span><span>◐ กำลังเขียน</span><span>○ ยังไม่เริ่ม</span></div></div>
    ${fixes.length ? `<div class="warnbox"><b>ต้องแก้ไขตามความเห็นครู:</b> ${fixes.map((x) => `<a href="${x.s.href || "#/edit/" + x.id}">${esc(x.label)}</a>`).join(", ")}</div>` : ""}
    <a class="btn pri block" href="${next.s.href || "#/edit/" + next.id}">เขียนรายงานต่อ: ${esc(next.label)}</a></section>`;
}
const _homeWS = ROUTES.home;
ROUTES.home = async (view) => {
  await _homeWS(view);
  if ((route.name === "home" || route.name === "") && S && P && !view.querySelector(".dash")) view.insertAdjacentHTML("afterbegin", dashboardHTML());
};


/* ---------------- write overview: status badges instead of raw percentages ---------------- */
const _writeWS = ROUTES.write;
ROUTES.write = async (view) => {
  await _writeWS(view);
  if (route.name !== "write" || !S) return;
  $$(".list .row-link", view).forEach((a) => {
    const s = SECTIONS.find((x) => (x.href || "#/edit/" + x.id) === a.getAttribute("href")); if (!s) return;
    const st = secStatus(s); const m = a.querySelector(".meter");
    if (m) { m.style.setProperty("--p", st.pct); const sp = m.querySelector("span"); if (sp) sp.textContent = st.pct + "%"; m.setAttribute("aria-label", `${st.pct}%`); }
    const b = a.querySelector("b"); if (b && !a.querySelector(".st")) b.insertAdjacentHTML("afterend", " " + stBadge(st));
  });
};

/* ---------------- login: brand, password reveal, helper text, loading ---------------- */
const _loginWS = ROUTES.login;
ROUTES.login = (view) => {
  _loginWS(view);
  const bm = $(".brandmark", view);
  if (bm) bm.outerHTML = `<div class="auth-hero"><div class="brandmark"><svg viewBox="0 0 32 32" aria-hidden="true"><use href="#pe-logo"/></svg><div><h1>ProjectElec</h1><p class="tagline">Build your project · Engineer your future</p></div></div>
    <p class="lead" style="margin-top:10px">ทำเอกสารรายวิชาโครงงานอิเล็กทรอนิกส์ได้ครบจากมือถือ ตามคู่มือวิทยาลัยเทคนิคสมุทรปราการ</p></div>`;
  $$("form", view).forEach((f) => { f.noValidate = true; });
  $$("input[type=password]", view).forEach((inp) => {
    const w = document.createElement("div"); w.className = "pw"; inp.parentNode.insertBefore(w, inp); w.appendChild(inp);
    w.insertAdjacentHTML("beforeend", `<button class="eye" type="button" data-eye aria-label="แสดงรหัสผ่าน" aria-pressed="false">${WI.eye}</button>`);
  });
  $$("input[name=classCode]", view).forEach((inp) => { inp.insertAdjacentHTML("afterend", `<p class="hint" id="${inp.id}-h">รหัส 6 ตัวที่ครูผู้สอนแจกให้ เช่น K7MPQ2 (ตัวพิมพ์ใหญ่หรือเล็กก็ได้)</p>`); inp.setAttribute("aria-describedby", inp.id + "-h"); inp.setAttribute("maxlength", "6"); });
  $$("input[name=studentId]", view).forEach((inp) => inp.insertAdjacentHTML("afterend", `<p class="hint">รหัสนักศึกษาตามทะเบียนของวิทยาลัย</p>`));
  const tb = $("#themebtn"); if (tb) { tb.style.position = "fixed"; tb.style.top = "8px"; tb.style.right = "8px"; tb.style.zIndex = "30"; tb.hidden = false; document.body.appendChild(tb); }
};
document.addEventListener("click", (e) => {
  const eye = e.target.closest("[data-eye]"); if (!eye) return;
  const inp = eye.parentElement.querySelector("input"); const show = inp.type === "password";
  inp.type = show ? "text" : "password"; eye.innerHTML = show ? WI.eyeoff : WI.eye; eye.setAttribute("aria-pressed", String(show)); eye.setAttribute("aria-label", show ? "ซ่อนรหัสผ่าน" : "แสดงรหัสผ่าน");
});
const _submitAuth = submitAuth;
window.submitAuth = async (form) => {
  // field-level feedback before calling the server
  $$(".field-err", form).forEach((x) => x.remove()); $$(".f.invalid", form).forEach((x) => x.classList.remove("invalid"));
  let bad = null;
  $$("input[required]", form).forEach((inp) => { if (!inp.value.trim()) { const f = inp.closest(".f"); f.classList.add("invalid"); f.insertAdjacentHTML("beforeend", `<p class="field-err">กรุณากรอก${esc((f.querySelector("label") || {}).textContent || "ช่องนี้")}</p>`); bad = bad || inp; } });
  const cc = form.querySelector("input[name=classCode]"); if (cc && cc.value.trim() && !/^[A-Za-z0-9]{6}$/.test(cc.value.trim())) { const f = cc.closest(".f"); f.classList.add("invalid"); f.insertAdjacentHTML("beforeend", `<p class="field-err">รหัสห้องมี 6 ตัว (ตัวอักษรและตัวเลข)</p>`); bad = bad || cc; }
  if (bad) { bad.focus(); return; }
  const btn = form.querySelector("[type=submit]"); const html = btn.innerHTML; btn.innerHTML = `<span class="spin" aria-hidden="true"></span> กำลังเข้าสู่ระบบ…`; btn.setAttribute("aria-busy", "true");
  try { await _submitAuth(form); } finally { if (btn.isConnected) { btn.innerHTML = html; btn.removeAttribute("aria-busy"); } }
};

/* ---------------- sync wording: kept on this phone vs synced to the server ---------------- */
const _setSync = setSync;
window.setSync = (st, msg) => {
  _setSync(st, msg);
  const el = $("#sync"); if (!el) return;
  const t = { saved: "ซิงก์แล้ว", pending: "เก็บในเครื่อง · รอซิงก์", saving: "กำลังซิงก์…", offline: "ออฟไลน์ · เก็บในเครื่อง", error: "ซิงก์ไม่สำเร็จ" }[st];
  if (t) el.querySelector("span").textContent = t;
  el.title = st === "saved" && SYNC.at ? `บันทึกบนเซิร์ฟเวอร์เมื่อ ${SYNC.at.toLocaleTimeString("th-TH")}` : msg || t || "";
  const fw = $("#fw-sync"); if (fw) fw.textContent = t || "";
};

/* ---------------- loading skeleton + render hook ---------------- */
const _renderWS = render;
window.render = async () => {
  const name = ((location.hash || "#/").split("/")[1]) || "";
  const v = $("#view");
  if (v && !v.querySelector(".skel") && name !== "login") { const keep = v.innerHTML; v.dataset.prev = ""; if (!keep.trim() || keep.includes("spinner")) v.innerHTML = `<div class="skel" aria-label="กำลังโหลด"><i style="width:40%"></i><i class="b"></i><i></i><i style="width:70%"></i></div>`; }
  if (!$(".focusw")) sheetClose();
  await _renderWS();
  try { wsDecorate(); } catch (e) { console.error(e); }
  const tb = $("#themebtn"); if (tb && name !== "login" && tb.parentElement === document.body) { tb.removeAttribute("style"); $("#appbar").appendChild(tb); }
};
render();

/* ===================== AI-use transparency & writing provenance =====================
   No tool can reliably tell whether text was written by AI, so the system never labels a student.
   It shows (1) what the student declared, (2) how much of each part was typed vs pasted, by whom and when,
   (3) traces that chat tools often leave in pasted text. Teachers use this to start a conversation. */
const AI_LEVELS = [["none", "ไม่ได้ใช้ AI"], ["idea", "ใช้หาไอเดีย/ค้นคว้า"], ["edit", "ใช้ช่วยเกลาภาษา"], ["draft", "ใช้ร่างเนื้อหาแล้วแก้เอง"]];
const PROV_SECS = { info: ["info", "members", "advisors"], ch1: ["ch1"], ch2: ["ch2", "refs"], ch3: ["ch3"], data: ["data"], ch5: ["ch5"], front: ["front", "manual", "photos"], plan: ["plan", "budget", "principle", "forms"] };
const secOfPath = (p) => { const top = String(p).split(".")[0]; return Object.keys(PROV_SECS).find((k) => PROV_SECS[k].includes(top)) || "info"; };
function textOf(v) { if (v == null) return ""; if (typeof v === "string") return /^(data:|\/api\/files\/)/.test(v) ? "" : v; if (typeof v === "number") return ""; if (Array.isArray(v)) return v.map(textOf).join("\n"); if (typeof v === "object") return Object.entries(v).filter(([k]) => !["src", "w", "h", "size"].includes(k)).map(([, x]) => textOf(x)).join("\n"); return ""; }
const AI_TRACES = [
  [/\*\*[^*\n]{2,}\*\*/, "มีเครื่องหมาย ** รอบข้อความ (ตัวหนาแบบ Markdown) ซึ่งมักติดมาเมื่อคัดลอกจากแชต AI"],
  [/^\s*#{1,4}\s+\S/m, "มีเครื่องหมาย # นำหน้าหัวข้อ (หัวข้อแบบ Markdown)"],
  [/(ในฐานะ(ปัญญาประดิษฐ์|AI|โมเดลภาษา)|as an ai|language model)/i, "มีข้อความที่ AI ใช้พูดถึงตัวเอง"],
  [/(แน่นอน(ครับ|ค่ะ)?\s*[!！]|ยินดีช่วย|หวังว่า(ข้อมูล|คำตอบ)นี้|ต่อไปนี้คือ(ตัวอย่าง|แนวทาง)|certainly!|sure!|here is (a|an|the)|here's (a|an|the))/i, "มีประโยคทักทายหรือตอบกลับแบบแชตบอต"],
  [/\[(ใส่|ชื่อ|ระบุ|เติม|insert|your)[^\]\n]{0,40}\]/i, "มีวงเล็บให้เติมข้อมูล เช่น [ใส่ชื่อ…] ที่ยังไม่ได้แก้"],
  [/\b(chatgpt|gemini|copilot|claude|bard)\b/i, "มีชื่อเครื่องมือ AI อยู่ในเนื้อหา"],
];
function aiTraces(text) { return AI_TRACES.filter(([re]) => re.test(text)).map(([, t]) => t); }

function aiDeclareHTML(sec) {
  const cur = (S.aiUse && S.aiUse[sec]) || {};
  return `<section class="card aiuse" aria-labelledby="ai-h-${sec}"><h3 id="ai-h-${sec}">การใช้ AI ในส่วนนี้</h3>
    <p class="hint">แจ้งตามจริง ครูจะแนะนำได้ตรงจุด การใช้ AI ช่วยคิดหรือเกลาภาษาไม่ใช่เรื่องผิดถ้าบอกไว้ และเนื้อหาต้องเป็นข้อมูลจริงของโครงงานที่คุณเข้าใจ (ทำตามข้อตกลงของครูผู้สอน)</p>
    <div class="chips" role="group" aria-label="ระดับการใช้ AI">${AI_LEVELS.map(([k, l]) => `<button type="button" class="chip" data-set="aiUse.${sec}.level:${k}" aria-pressed="${cur.level === k}">${l}</button>`).join("")}</div>
    ${cur.level && cur.level !== "none" ? `<div class="f"><label for="ai_n_${sec}">ใช้อย่างไร (เครื่องมือ และส่วนที่ใช้)</label><input type="text" id="ai_n_${sec}" data-k="aiUse.${sec}.note" value="${esc(cur.note || "")}" placeholder="เช่น ใช้ ChatGPT สรุปหลักการทำงานของ LDR แล้วเขียนใหม่เอง"></div>` : ""}
    <p class="hint" style="margin-top:8px">ระบบนับจำนวนตัวอักษรที่พิมพ์และที่วางในแต่ละช่อง (ไม่เก็บข้อความที่คัดลอก) ครูและสมาชิกในกลุ่มดูได้ที่ <a href="#/provenance">ที่มาของงานเขียน</a></p></section>`;
}

function provenanceHTML(state, prov, members, forTeacher) {
  const by = {}; (prov.rows || []).forEach((r) => { const s = secOfPath(r.path); const o = by[s] || (by[s] = { typed: 0, pasted: 0, pastes: 0, max: 0, who: {}, days: new Set() }); o.typed += r.typed; o.pasted += r.pasted; o.pastes += r.pastes; o.max = Math.max(o.max, r.max_paste);
    const w = o.who[r.display_name] || (o.who[r.display_name] = { typed: 0, pasted: 0 }); w.typed += r.typed; w.pasted += r.pasted; });
  const decl = state.aiUse || {}; const lvl = (k) => (AI_LEVELS.find((x) => x[0] === k) || [, "ยังไม่ได้แจ้ง"])[1];
  const rows = Object.keys(PROV_SECS).map((sec) => {
    const txt = PROV_SECS[sec].map((k) => textOf(state[k])).join("\n"); const now = txt.replace(/\s+/g, "").length;
    const o = by[sec] || { typed: 0, pasted: 0, pastes: 0, max: 0, who: {} }; const tot = o.typed + o.pasted; const pp = tot ? Math.round((o.pasted / tot) * 100) : 0;
    const tr = aiTraces(txt); const d = decl[sec] || {};
    const notes = [];
    if (tot && pp >= 60) notes.push(`ข้อความส่วนใหญ่ (${pp}%) ถูกวาง อาจคัดลอกจากไฟล์ที่เขียนเองในคอมพิวเตอร์ แหล่งข้อมูล หรือเครื่องมืออื่น`);
    if (o.max >= 800) notes.push(`มีการวางครั้งเดียวยาว ${o.max.toLocaleString()} ตัวอักษร`);
    if (now > 200 && !tot) notes.push("เนื้อหาส่วนนี้เขียนก่อนเริ่มบันทึกที่มา จึงไม่มีข้อมูล");
    return { sec, now, o, tot, pp, tr, d, notes };
  });
  const label = (sec) => ({ info: "ข้อมูลโครงงาน", ch1: "บทที่ 1", ch2: "บทที่ 2 + บรรณานุกรม", ch3: "บทที่ 3", data: "บทที่ 4 (ข้อมูล)", ch5: "บทที่ 5", front: "ส่วนต้น/ภาคผนวก", plan: "แผน งบ คำร้อง" })[sec];
  const days = prov.days || []; const dmax = Math.max(1, ...days.map((d) => d.typed + d.pasted));
  return `<div class="note"><b>อ่านข้อมูลนี้อย่างไร</b><br>${forTeacher ? "ไม่มีเครื่องมือใดบอกได้แน่นอนว่าข้อความเขียนด้วย AI หรือไม่ ระบบจึงไม่ตัดสิน แต่แสดง" : "ข้อมูลชุดเดียวกับที่ครูเห็น ได้แก่"} (1) สิ่งที่นักเรียนแจ้งเรื่องการใช้ AI (2) สัดส่วนข้อความที่พิมพ์กับที่วาง ใครเขียนและเมื่อไร (3) ร่องรอยที่มักติดมาจากแชต AI${forTeacher ? " — ใช้เป็นจุดเริ่มคุยกับนักเรียน เช่น ให้อธิบายเนื้อหาด้วยคำของตัวเอง ไม่ใช่หลักฐานลงโทษ" : ""}</div>
    ${prov.since ? `<p class="hint">เริ่มบันทึกที่มาตั้งแต่ ${new Date(prov.since).toLocaleDateString("th-TH", { dateStyle: "medium" })}</p>` : `<p class="hint">ยังไม่มีข้อมูลการพิมพ์/วาง (เริ่มนับเมื่อนักเรียนเขียนหลังเปิดฟังก์ชันนี้)</p>`}
    ${rows.map((r) => `<div class="card prov"><div class="prov-h"><h3>${label(r.sec)}</h3><span class="hint">${r.now.toLocaleString()} ตัวอักษรในงานตอนนี้</span></div>
      <div class="prov-ai">แจ้งการใช้ AI: <b>${esc(lvl(r.d.level))}</b>${r.d.note ? ` · ${esc(r.d.note)}` : ""}</div>
      ${r.tot ? `<div class="pbar" role="img" aria-label="พิมพ์ ${100 - r.pp}% วาง ${r.pp}%"><i class="ty" style="width:${100 - r.pp}%"></i><i class="pa" style="width:${r.pp}%"></i></div>
      <div class="hint">พิมพ์ ${r.o.typed.toLocaleString()} · วาง ${r.o.pasted.toLocaleString()} ตัวอักษร (${r.o.pastes} ครั้ง)${Object.keys(r.o.who).length ? " · " + Object.entries(r.o.who).map(([n, w]) => `${esc(n)} ${Math.round(((w.typed + w.pasted) / r.tot) * 100)}%`).join(", ") : ""}</div>` : ""}
      ${r.notes.length || r.tr.length ? `<ul class="prov-notes">${r.notes.map((x) => `<li>${esc(x)}</li>`).join("")}${r.tr.map((x) => `<li class="tr">${esc(x)}</li>`).join("")}</ul>` : ""}</div>`).join("")}
    ${days.length ? `<p class="sectitle">ช่วงเวลาที่เขียน</p><div class="tl">${days.map((d) => `<div class="tl-d" title="${new Date(d.day).toLocaleDateString("th-TH")}: พิมพ์ ${d.typed} วาง ${d.pasted}"><span class="tl-b"><i class="ty" style="height:${(d.typed / dmax) * 100}%"></i><i class="pa" style="height:${(d.pasted / dmax) * 100}%"></i></span><small>${new Date(d.day).toLocaleDateString("th-TH", { day: "numeric", month: "short" })}</small></div>`).join("")}</div>
      <p class="hint"><span class="sw ty"></span> พิมพ์ <span class="sw pa"></span> วาง</p>` : ""}`;
}
ROUTES.provenance = async (view) => {
  if (!(await needProject())) return;
  chrome({ title: "ที่มาของงานเขียน", sub: S.info.titleTh, back: "#/write", tabs: STUDENT_TABS });
  await syncNow();
  const prov = await api("GET", `/api/projects/${P.id}/provenance`);
  view.innerHTML = simLinks(P.id, P.submissions, false) + provenanceHTML(S, prov, P.members, false);
};
function simLinks(pid, subs, teacher) {
  const files = (subs || []).flatMap((x) => (x.files || []).filter((f) => !f.by_teacher && !/^image/.test(f.mime)).map((f) => ({ ...f, stage: x.stage, at: x.submitted_at })));
  return `<div class="card"><h3 style="margin-top:0">ตรวจความซ้ำ (การคัดลอก)</h3><p class="hint" style="margin-top:0">เทียบกับงานทุกกลุ่มในระบบ ไฟล์ที่อัปโหลด และโครงงานตัวอย่าง แสดงเป็น % พร้อมไฮไลต์สีตามแหล่งที่มา</p>
    <div class="btnrow"><a class="btn pri" href="#/sim/project/${pid}">ตรวจงานที่เขียนในระบบ</a></div>
    ${files.length ? `<p class="sectitle" style="margin:12px 0 4px">ไฟล์ที่${teacher ? "นักเรียน" : ""}อัปโหลด</p><ul class="flist">${files.map((f) => `<li><span class="ftype">${fileIcon(f.mime)}</span><span style="min-width:0;overflow-wrap:anywhere">${esc(f.name)}</span><a class="btn sm" href="#/sim/file/${f.id}/${pid}">ตรวจไฟล์นี้</a></li>`).join("")}</ul>` : ""}</div>`;
}

/* ===================== similarity (copy) check with coloured sources ===================== */
const SIM_COLORS = ["#FDE68A", "#BFDBFE", "#FBCFE8", "#BBF7D0", "#DDD6FE", "#FED7AA", "#A5F3FC", "#FECACA"];
const pctTxt = (x) => (x < 1 && x > 0 ? "<1" : Math.round(x)) + "%";
function simHTML(r, forTeacher) {
  const color = new Map(r.sources.map((s, i) => [s.key, SIM_COLORS[i % SIM_COLORS.length]]));
  const text = r.blocks.map((b) => b.segs.map((x) => x.t).join("")).join("\n");
  const tr = aiTraces(text);
  return `<div class="card simhead"><div class="simtop"><span class="meter big" style="--p:${Math.min(100, r.pct)}" aria-label="ข้อความที่ตรงกับแหล่งอื่น ${pctTxt(r.pct)}"><span>${pctTxt(r.pct)}</span></span>
      <div><h3 style="margin:0">ข้อความที่ตรงกับแหล่งอื่น ${pctTxt(r.pct)}</h3><p class="hint" style="margin:2px 0 0">จาก ${r.total.toLocaleString()} ตัวอักษร${r.file ? ` ในไฟล์ ${esc(r.file.name)}` : " ในงานที่เขียนในระบบ"} · เทียบกับงานทุกกลุ่มในระบบ ไฟล์ที่อัปโหลด และโครงงานตัวอย่าง</p></div></div>
    ${r.sources.length ? `<ul class="simsrc">${r.sources.map((s) => `<li><button type="button" class="simbtn" data-simsrc="${s.key}" aria-pressed="true"><span class="sw" style="background:${color.get(s.key)}"></span><span class="nm">${esc(s.label)}</span><b>${pctTxt(s.pct)}</b></button>${forTeacher && s.project ? `<a class="hint" href="#/tproject/${s.project}${s.file ? "/sub" : "/docs/report"}">เปิด</a>` : ""}</li>`).join("")}</ul>
      <p class="hint">แตะชื่อแหล่งเพื่อซ่อน/แสดงสีของแหล่งนั้น · ข้อความสั้นกว่าประมาณ 1 บรรทัด และวลีที่ใช้กันทั่วไป (เช่น ชื่อวิทยาลัย หัวข้อแบบฟอร์ม) ไม่นับ</p>` : `<p class="hint">ไม่พบข้อความยาวที่ตรงกับงานอื่นในระบบ</p>`}</div>
    <div class="card"><h3 style="margin-top:0">การใช้ AI</h3><p class="hint" style="margin-top:0">ระบบไม่แสดงเป็นเปอร์เซ็นต์ เพราะยังไม่มีเครื่องมือใดวัดได้แม่นพอ เครื่องมือตรวจ AI ทั่วไปตัดสินผิดบ่อย โดยเฉพาะภาษาไทยและงานเขียนเชิงเทคนิค การใช้ตัวเลขที่ไม่แม่นอาจกล่าวหานักเรียนผิดคน จึงแสดงสิ่งที่ตรวจได้จริงแทน</p>
      ${tr.length ? `<ul class="prov-notes">${tr.map((x) => `<li class="tr">${esc(x)}</li>`).join("")}</ul>` : `<p>ไม่พบร่องรอยที่มักติดมาจากแชต AI</p>`}
      <p class="hint">ดูเพิ่มเติม: การแจ้งใช้ AI และสัดส่วนข้อความที่พิมพ์/วาง ในหน้า${forTeacher ? "แท็บ “ที่มา/AI”" : " <a href=\"#/provenance\">ที่มาของงานเขียน</a>"}</p></div>
    <div class="simtext" id="simtext">${r.blocks.map((b) => `<section class="card">${b.label ? `<h3 style="margin-top:0">${esc(b.label)}</h3>` : ""}<div class="simbody">${b.segs.map((x) => (x.s ? `<mark data-src="${x.s}" style="background:${color.get(x.s)}">${esc(x.t)}</mark>` : esc(x.t))).join("")}</div></section>`).join("")}</div>`;
}
ROUTES.sim = async (view, kind = "project", id, pid) => {
  const teacher = ME.user.role !== "student";
  if (!teacher && !(await needProject())) return;
  const back = teacher ? `#/tproject/${kind === "file" ? pid : id}/src` : "#/provenance";
  chrome({ title: kind === "file" ? "ตรวจความซ้ำของไฟล์" : "ตรวจความซ้ำของงาน", sub: teacher ? "" : S.info.titleTh, back, tabs: teacher ? TEACHER_TABS : STUDENT_TABS });
  view.innerHTML = `<div class="skel" aria-label="กำลังตรวจ"><i style="width:50%"></i><i class="b"></i><i></i></div><p class="hint">กำลังเทียบกับงานทุกกลุ่มในระบบ…</p>`;
  if (!teacher) await syncNow();
  try {
    const r = await api("GET", kind === "file" ? `/api/files/${id}/similarity` : `/api/projects/${teacher ? id : P.id}/similarity`);
    view.innerHTML = simHTML(r, teacher);
  } catch (e) { view.innerHTML = `<div class="errbox">${esc(e.error || "ตรวจไม่สำเร็จ")}</div><a class="btn" href="${back}">กลับ</a>`; }
};
document.addEventListener("click", (e) => {
  const b = e.target.closest("[data-simsrc]"); if (!b) return;
  const on = b.getAttribute("aria-pressed") !== "true"; b.setAttribute("aria-pressed", String(on));
  $$(`#simtext mark[data-src="${b.dataset.simsrc}"]`).forEach((m) => m.classList.toggle("off", !on));
});
