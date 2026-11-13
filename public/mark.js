/* Teacher mark-up: write on the student's document (pen, highlighter, text), then send it back as a PDF.
   Route: #/mark/<projectId>/<submissionId>/<doc|file>/<docId|fileId> */
(() => {
  const COLORS = [["#D92D20", "แดง"], ["#1D4ED8", "น้ำเงิน"], ["#15803D", "เขียว"], ["#111827", "ดำ"]];
  let M = null; // current mark-up session

  const draftKey = (m) => `pe-mark:${m.sid}:${m.kind}:${m.ref}`;
  const saveDraft = () => { try { localStorage.setItem(draftKey(M), JSON.stringify(M.items)); } catch (e) { /* storage may be off */ } };
  const loadDraft = (m) => { try { return JSON.parse(localStorage.getItem(draftKey(m)) || "null"); } catch (e) { return null; } };
  const dropDraft = (m) => { try { localStorage.removeItem(draftKey(m)); } catch (e) { /* ignore */ } };

  function drawItem(ctx, it) {
    ctx.save();
    if (it.t === "text") {
      ctx.fillStyle = it.c; ctx.font = `${it.s}px "IBM Plex Sans Thai", "TH Sarabun New", sans-serif`; ctx.textBaseline = "top";
      const maxW = it.w || 600; let y = it.y;
      String(it.text).split("\n").forEach((para) => {
        let line = "";
        for (const ch of Array.from(para)) { // Thai has no spaces between words, so wrap by character
          if (ctx.measureText(line + ch).width > maxW && line) { ctx.fillText(line, it.x, y); y += it.s * 1.35; line = ch; } else line += ch;
        }
        ctx.fillText(line, it.x, y); y += it.s * 1.35;
      });
    } else {
      const p = it.p; if (!p.length) { ctx.restore(); return; }
      ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.strokeStyle = it.c; ctx.lineWidth = it.w;
      if (it.t === "hl") { ctx.globalAlpha = 0.35; ctx.globalCompositeOperation = "multiply"; ctx.lineCap = "butt"; }
      ctx.beginPath(); ctx.moveTo(p[0][0], p[0][1]);
      if (p.length === 1) ctx.lineTo(p[0][0] + 0.1, p[0][1] + 0.1);
      for (let i = 1; i < p.length - 1; i++) { const mx = (p[i][0] + p[i + 1][0]) / 2, my = (p[i][1] + p[i + 1][1]) / 2; ctx.quadraticCurveTo(p[i][0], p[i][1], mx, my); }
      if (p.length > 1) ctx.lineTo(p[p.length - 1][0], p[p.length - 1][1]);
      ctx.stroke();
    }
    ctx.restore();
  }
  function redraw(i) {
    const pg = M.pages[i]; if (!pg || !pg.cv) return;
    const ctx = pg.cv.getContext("2d"); ctx.clearRect(0, 0, pg.cv.width, pg.cv.height);
    M.items.filter((x) => x.pg === i).forEach((x) => drawItem(ctx, x));
  }
  const hits = (it, x, y, r) => it.t === "text" ? (x >= it.x - r && x <= it.x + (it.w || 600) && y >= it.y - r && y <= it.y + it.s * 1.4 * (String(it.text).split("\n").length + 1))
    : it.p.some((q) => Math.hypot(q[0] - x, q[1] - y) < r + it.w / 2);

  function toolbar() {
    const t = M.tool;
    return `<div class="mk-bar" role="toolbar" aria-label="เครื่องมือเขียนคอมเมนต์">
      <button type="button" class="mk-t${t === "pen" ? " on" : ""}" data-mk="tool:pen" aria-pressed="${t === "pen"}" title="ปากกา">✏️<span>ปากกา</span></button>
      <button type="button" class="mk-t${t === "hl" ? " on" : ""}" data-mk="tool:hl" aria-pressed="${t === "hl"}" title="ไฮไลต์">🖍️<span>ไฮไลต์</span></button>
      <button type="button" class="mk-t${t === "text" ? " on" : ""}" data-mk="tool:text" aria-pressed="${t === "text"}" title="พิมพ์ข้อความ">T<span>ข้อความ</span></button>
      <button type="button" class="mk-t${t === "erase" ? " on" : ""}" data-mk="tool:erase" aria-pressed="${t === "erase"}" title="ยางลบ">⌫<span>ลบ</span></button>
      <button type="button" class="mk-t${t === "move" ? " on" : ""}" data-mk="tool:move" aria-pressed="${t === "move"}" title="เลื่อนหน้า">✋<span>เลื่อน</span></button>
      <span class="mk-sep"></span>
      ${COLORS.map(([c, n]) => `<button type="button" class="mk-c${M.color === c ? " on" : ""}" data-mk="color:${c}" aria-label="สี${n}" aria-pressed="${M.color === c}" style="--c:${c}"></button>`).join("")}
      <span class="mk-sep"></span>
      <button type="button" class="mk-t" data-mk="undo" title="ย้อนกลับ" ${M.items.length ? "" : "disabled"}>↶<span>ย้อน</span></button>
    </div>`;
  }
  function paintBar() { const b = document.querySelector(".mk-bar"); if (b) b.outerHTML = toolbar(); setTouch(); }
  function setTouch() {
    // finger scrolls the page in "เลื่อน" mode, or always when an Apple Pencil / stylus has been used
    document.querySelectorAll(".mk-page canvas").forEach((cv) => { cv.style.touchAction = M.tool === "move" || M.penSeen ? "pan-x pan-y pinch-zoom" : "none"; cv.style.cursor = M.tool === "move" ? "grab" : M.tool === "text" ? "text" : "crosshair"; });
  }

  function attach(i) {
    const pg = M.pages[i], cv = pg.cv;
    let cur = null;
    const pos = (e) => { const r = cv.getBoundingClientRect(); return [Math.round((e.clientX - r.left) * cv.width / r.width), Math.round((e.clientY - r.top) * cv.height / r.height)]; };
    const scale = () => cv.width / cv.getBoundingClientRect().width;
    cv.addEventListener("pointerdown", (e) => {
      if (e.pointerType === "pen" && !M.penSeen) { M.penSeen = true; setTouch(); }
      if (M.tool === "move" || (M.penSeen && e.pointerType === "touch")) return;
      if (e.button > 0) return;
      e.preventDefault();
      const [x, y] = pos(e);
      if (M.tool === "text") {
        const text = prompt("พิมพ์ข้อความคอมเมนต์");
        if (text && text.trim()) { M.items.push({ pg: i, t: "text", x, y, text: text.trim(), c: M.color, s: Math.round(26 * scale() / 1.6) || 26, w: Math.max(200, cv.width - x - 20) }); redraw(i); saveDraft(); paintBar(); }
        return;
      }
      if (M.tool === "erase") {
        const r = 14 * scale();
        for (let k = M.items.length - 1; k >= 0; k--) if (M.items[k].pg === i && hits(M.items[k], x, y, r)) { M.items.splice(k, 1); redraw(i); saveDraft(); paintBar(); break; }
        return;
      }
      cv.setPointerCapture(e.pointerId);
      const k = scale();
      cur = { pg: i, t: M.tool, c: M.tool === "hl" ? "#FACC15" : M.color, w: Math.round((M.tool === "hl" ? 18 : 2.6) * k * 1.4), p: [[x, y]] };
      M.items.push(cur);
    });
    cv.addEventListener("pointermove", (e) => {
      if (!cur) return;
      e.preventDefault();
      const evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
      for (const ev of evs) { const q = pos(ev), l = cur.p[cur.p.length - 1]; if (Math.hypot(q[0] - l[0], q[1] - l[1]) > 1.5) cur.p.push(q); }
      redraw(i);
    });
    const end = () => { if (cur) { cur = null; saveDraft(); paintBar(); } };
    cv.addEventListener("pointerup", end); cv.addEventListener("pointercancel", end);
  }

  async function compose(onlyMarked) {
    const out = [];
    for (let i = 0; i < M.pages.length; i++) {
      if (onlyMarked && !M.items.some((x) => x.pg === i)) continue;
      const pg = M.pages[i]; const im = pg.img;
      const c = document.createElement("canvas"); c.width = im.naturalWidth; c.height = im.naturalHeight;
      const ctx = c.getContext("2d"); ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, c.width, c.height); ctx.drawImage(im, 0, 0);
      ctx.drawImage(pg.cv, 0, 0);
      out.push({ data: c.toDataURL("image/jpeg", 0.82), w: c.width, h: c.height });
    }
    return out;
  }

  ROUTES.mark = async (view, pid, sid, kind, ref) => {
    if (ME.user.role === "student") return go("#/home");
    chrome({ title: "เขียนคอมเมนต์บนเอกสาร", sub: "", back: `#/tproject/${pid}/sub`, tabs: TEACHER_TABS });
    view.innerHTML = `<div class="spinner"></div><p class="hint" style="text-align:center">กำลังเตรียมหน้าเอกสาร…</p>`;
    let info, proj;
    try {
      [info, proj] = await Promise.all([api("GET", kind === "file" ? `/api/files/${ref}/markpages` : `/api/projects/${pid}/markpages?doc=${encodeURIComponent(ref)}`), api("GET", `/api/projects/${pid}`)]);
    } catch (e) { view.innerHTML = `<div class="card"><p>${esc(e.error || "เปิดเอกสารไม่ได้")}</p><a class="btn" href="#/tproject/${pid}/sub">กลับ</a></div>`; return; }
    const sub = (proj.submissions || []).find((s) => String(s.id) === String(sid));
    const st = sub && STAGES.find((x) => x.id === sub.stage);
    $("#sub").textContent = `${(proj.state && proj.state.info && proj.state.info.titleTh) || ""}${st ? " · " + st.label : ""}`;
    const dl = kind === "doc" && typeof DOCS !== "undefined" && DOCS.find((d) => d[0] === ref);
    M = { pid, sid, kind, ref, name: dl ? dl[1] : info.name, tool: "pen", color: COLORS[0][0], items: [], pages: info.pages.map((u) => ({ url: u })), penSeen: false };
    const d = loadDraft(M); if (Array.isArray(d) && d.length) M.items = d;
    const many = M.pages.length > 12;
    view.innerHTML = `<div class="mk-wrap">${toolbar()}
      <p class="hint mk-tip">เขียนด้วยนิ้ว ปากกา Apple Pencil หรือเมาส์ · ถ้าใช้ Apple Pencil นิ้วจะเลื่อนหน้าได้เลย · กด “ข้อความ” แล้วแตะตรงที่ต้องการพิมพ์ · งานที่เขียนค้างไว้จะจำไว้ในเครื่องนี้</p>
      ${M.items.length ? `<div class="note">มีคอมเมนต์ที่เขียนค้างไว้ ${M.items.length} รายการ แสดงต่อให้แล้ว</div>` : ""}
      <div class="mk-pages">${M.pages.map((p, i) => `<figure class="mk-page" data-pg="${i}"><img src="${p.url}" alt="หน้า ${i + 1}" draggable="false"><canvas aria-label="พื้นที่เขียนหน้า ${i + 1}"></canvas><figcaption>หน้า ${i + 1} / ${M.pages.length}</figcaption></figure>`).join("")}</div>
      <div class="card mk-send"><h3>ส่งให้นักเรียนแก้ไข</h3>
        <p class="hint">ระบบจะรวมหน้าที่เขียนคอมเมนต์เป็นไฟล์ PDF แนบในงานที่ส่งครั้งนี้ นักเรียนเปิดดูได้ที่หน้า “ความเห็นจากครู”</p>
        <label class="chk"><input type="checkbox" id="mk_only"${many ? " checked" : ""}> ส่งเฉพาะหน้าที่เขียนคอมเมนต์</label>
        ${sub && sub.status === "submitted" ? `<div class="f"><label for="mk_msg">ข้อความถึงนักเรียน (ถ้ามี)</label><textarea id="mk_msg" rows="2" placeholder="เช่น แก้ตามที่เขียนไว้ในไฟล์"></textarea></div>
        <label class="chk"><input type="checkbox" id="mk_ret" checked> ส่งกลับให้แก้ไขพร้อมกัน</label>` : ""}
        <div class="btnrow"><button class="btn pri" type="button" data-mk="send">ส่งไฟล์ให้นักเรียน</button><a class="btn ghost" href="#/tproject/${pid}/sub">ยกเลิก</a></div></div></div>`;
    document.querySelectorAll(".mk-page").forEach((fig) => {
      const i = +fig.dataset.pg, img = fig.querySelector("img"), cv = fig.querySelector("canvas");
      M.pages[i].img = img; M.pages[i].cv = cv;
      const ready = () => { cv.width = img.naturalWidth; cv.height = img.naturalHeight; redraw(i); };
      if (img.complete && img.naturalWidth) ready(); else img.addEventListener("load", ready, { once: true });
      attach(i);
    });
    setTouch();
  };

  document.addEventListener("click", async (e) => {
    const b = e.target.closest("[data-mk]"); if (!b || !M) return;
    const [k, v] = b.dataset.mk.split(/:(.*)/);
    if (k === "tool") { M.tool = v; paintBar(); }
    else if (k === "color") { M.color = v; if (M.tool === "hl" || M.tool === "erase" || M.tool === "move") M.tool = "pen"; paintBar(); }
    else if (k === "undo") { const it = M.items.pop(); if (it) { redraw(it.pg); saveDraft(); } paintBar(); }
    else if (k === "send") {
      if (!M.items.length && !confirm("ยังไม่ได้เขียนคอมเมนต์เลย ส่งไฟล์ไปทั้งอย่างนั้นหรือไม่?")) return;
      if (M.pages.some((p) => !p.img || !p.img.naturalWidth)) return toast("หน้าเอกสารยังโหลดไม่ครบ รอสักครู่แล้วกดอีกครั้ง");
      const only = $("#mk_only") && $("#mk_only").checked && M.items.length;
      b.disabled = true; b.textContent = "กำลังสร้างไฟล์…";
      try {
        const pages = await compose(only);
        await api("POST", `/api/submissions/${M.sid}/annotated`, { name: M.name, pages });
        const msg = $("#mk_msg"), ret = $("#mk_ret");
        if (ret && ret.checked) await api("PATCH", `/api/submissions/${M.sid}`, { status: "returned", reply: (msg && msg.value.trim()) || "แก้ไขตามคอมเมนต์ในไฟล์ที่แนบ" });
        dropDraft(M);
        const pid = M.pid; M = null;
        toast("ส่งไฟล์ที่เขียนคอมเมนต์ให้นักเรียนแล้ว");
        go(`#/tproject/${pid}/sub`);
      } catch (err) { b.disabled = false; b.textContent = "ส่งไฟล์ให้นักเรียน"; toast(err.error || "ส่งไม่สำเร็จ ลองใหม่อีกครั้ง"); }
    }
  });
})();

/* In-app file viewer (used when the site is added to the Home Screen, where a file opened directly has no way back) */
(() => {
  let PREV = "";
  window.addEventListener("hashchange", (e) => { try { const h = new URL(e.oldURL).hash; if (!/^#\/fview\//.test(h)) PREV = h; } catch (x) { /* ignore */ } });
  let blob = null, meta = null;
  ROUTES.fview = async (view, fid) => {
    const home = ME.user.role === "student" ? "#/feedback" : "#/teacher";
    chrome({ title: "ดูไฟล์", sub: "", back: PREV || home, tabs: ME.user.role === "student" ? STUDENT_TABS : TEACHER_TABS });
    view.innerHTML = `<div class="spinner"></div><p class="hint" style="text-align:center">กำลังเปิดไฟล์…</p>`;
    let info;
    try { info = await api("GET", `/api/files/${fid}/markpages`); }
    catch (e) { view.innerHTML = `<div class="card"><p>${esc(e.error || "เปิดไฟล์ไม่ได้")}</p><a class="btn" href="${PREV || home}">กลับ</a></div>`; return; }
    $("#ttl").textContent = info.file || info.name;
    meta = info; blob = null;
    const teacher = ME.user.role !== "student";
    view.innerHTML = `<div class="mk-wrap"><div class="btnrow fv-bar">
        <a class="btn ghost" href="${PREV || home}">‹ กลับ</a>
        <button class="btn" type="button" id="fv_share" disabled>กำลังเตรียมไฟล์…</button>
        ${teacher && info.sid ? `<a class="btn pri" href="#/mark/${info.pid}/${info.sid}/file/${fid}">✏️ เขียนคอมเมนต์</a>` : ""}</div>
      <p class="hint">ซูมได้ด้วยการถ่างสองนิ้ว · ปุ่ม “บันทึก / แชร์ไฟล์” ใช้บันทึกลงแอปไฟล์ หรือเปิดด้วยแอปอื่น</p>
      <div class="mk-pages">${info.pages.map((u, i) => `<figure class="mk-page"><img src="${u}" alt="หน้า ${i + 1}" loading="lazy"><figcaption>หน้า ${i + 1} / ${info.pages.length}</figcaption></figure>`).join("")}</div></div>`;
    const btn = $("#fv_share");
    try {
      const r = await fetch(info.dl); if (!r.ok) throw new Error();
      blob = new File([await r.blob()], info.file || "file", { type: info.mime });
      btn.disabled = false; btn.textContent = "บันทึก / แชร์ไฟล์";
    } catch (e) { btn.disabled = false; btn.textContent = "เปิดไฟล์ต้นฉบับ"; }
  };
  document.addEventListener("click", async (e) => {
    if (!e.target.closest("#fv_share") || !meta) return;
    // navigator.share must run straight from the tap, so the file was fetched in advance
    if (blob && navigator.canShare && navigator.canShare({ files: [blob] })) {
      try { await navigator.share({ files: [blob], title: meta.file || meta.name }); } catch (x) { /* cancelled */ }
    } else window.open(meta.dl, "_blank");
  });
})();
