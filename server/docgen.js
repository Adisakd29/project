// Server-side document generation: DOCX (docx library) -> PDF (LibreOffice) -> page images (poppler).
// Students only need a phone: the server has the fonts and does the layout, including real page numbers.
"use strict";
const fs = require("fs");
const fsp = fs.promises;
const path = require("path");
const os = require("os");
const crypto = require("crypto");
const { execFile } = require("child_process");
const docx = require("docx");
const { createCanvas, GlobalFonts } = require("@napi-rs/canvas");
const E = require("../public/shared/engine.js");
const { q } = require("./db");

const FONT_DIR = path.join(__dirname, "..", "fonts");
for (const f of fs.existsSync(FONT_DIR) ? fs.readdirSync(FONT_DIR) : []) {
  if (/^Sarabun-.*\.ttf$/i.test(f)) GlobalFonts.registerFromPath(path.join(FONT_DIR, f), "Sarabun");
}

const CACHE = path.join(os.tmpdir(), "pe-cache");
fs.mkdirSync(CACHE, { recursive: true });
const LO_PROFILE = "file://" + path.join(os.tmpdir(), "pe-lo-profile");

const run = (cmd, args, opts = {}) =>
  new Promise((resolve, reject) => {
    execFile(cmd, args, { timeout: opts.timeout || 120000, maxBuffer: 64 * 1024 * 1024 }, (err, stdout, stderr) =>
      err ? reject(Object.assign(err, { stderr: String(stderr) })) : resolve(String(stdout)));
  });

// LibreOffice handles one conversion at a time per profile; queue requests.
let chain = Promise.resolve();
const serial = (fn) => {
  const p = chain.then(fn, fn);
  chain = p.catch(() => {});
  return p;
};

const FILE_RE = /\/api\/files\/([0-9a-f-]{36})/g;
async function loadImages(state) {
  const ids = new Set();
  JSON.stringify(state).replace(FILE_RE, (_m, id) => ids.add(id));
  const map = new Map();
  if (!ids.size) return map;
  const r = await q("SELECT id, bytes FROM files WHERE id = ANY($1::uuid[])", [[...ids]]);
  for (const row of r.rows) map.set(`/api/files/${row.id}`, row.bytes);
  return map;
}

function engineFor(state, images, extra) {
  return E.create(E.normalize(JSON.parse(JSON.stringify(state))), {
    extra,
    docx,
    createCanvas: (w, h) => createCanvas(w, h),
    imageData: (src) => {
      if (images && images.has(src)) return images.get(src);
      if (typeof src === "string" && src.startsWith("data:")) return Buffer.from(src.split(",")[1], "base64");
      return src;
    },
  });
}

const DOCS = {
  report: { name: "report-full", sections: (e) => e.buildReport().sections },
  kp01: { name: "KP01-proposal", sections: (e) => [{ num: "dec", start: 1, form: true, blocks: e.kp01() }] },
  kp02: { name: "KP02-topic-request", sections: (e) => [{ num: "dec", start: 1, form: true, blocks: e.formOf("kp02") }] },
  kp04_1: { name: "KP04-progress-request-1", sections: (e) => [{ num: "dec", start: 1, form: true, blocks: e.formOf("kp04_1") }] },
  kp04_2: { name: "KP04-progress-request-2", sections: (e) => [{ num: "dec", start: 1, form: true, blocks: e.formOf("kp04_2") }] },
  kp06: { name: "KP06-final-request", sections: (e) => [{ num: "dec", start: 1, form: true, blocks: e.formOf("kp06") }] },
  kp08: { name: "KP08-binding-request", sections: (e) => [{ num: "dec", start: 1, form: true, blocks: e.formOf("kp08") }] },
  forms: { name: "KP02-04-06-08-forms", sections: (e) => [{ num: "dec", start: 1, form: true, blocks: e.allForms() }] },
  tools: {
    name: "research-tools",
    sections: (e) => [{ num: "dec", start: 1, form: true, blocks: [...e.questionnaireExpert(), { t: "br" }, ...e.iocForm(), { t: "br" }, ...e.questionnaireUser()] }],
  },
  kp03: { name: "KP03-topic-result", teacher: true, sections: (e) => [{ num: "dec", start: 1, form: true, blocks: e.teacherForms("kp03") }] },
  kp05_1: { name: "KP05-progress-1", teacher: true, sections: (e) => [{ num: "dec", start: 1, form: true, blocks: e.teacherForms("kp05_1") }] },
  kp05_2: { name: "KP05-progress-2", teacher: true, sections: (e) => [{ num: "dec", start: 1, form: true, blocks: e.teacherForms("kp05_2") }] },
  kp07: { name: "KP07-final-result", teacher: true, sections: (e) => [{ num: "dec", start: 1, form: true, blocks: e.teacherForms("kp07") }] },
};

const FONT_TAG = fs.existsSync(FONT_DIR) ? fs.readdirSync(FONT_DIR).join(",") : "";
// Any change to the layout engine invalidates cached renders.
const ENGINE_TAG = crypto.createHash("sha1").update(fs.readFileSync(require.resolve("../public/shared/engine.js"))).digest("hex").slice(0, 12);
const keyFor = (state, doc, extra) => crypto.createHash("sha1").update(FONT_TAG + "|" + ENGINE_TAG + "|" + doc + "|" + JSON.stringify(state) + "|" + JSON.stringify(extra || {})).digest("hex");

async function buildDocx(state, doc, extra) {
  if (!DOCS[doc]) throw Object.assign(new Error("unknown document"), { status: 400 });
  const images = await loadImages(state);
  const e = engineFor(state, images, extra);
  const d = e.makeDoc(DOCS[doc].sections(e), state.info && state.info.titleTh);
  return docx.Packer.toBuffer(d);
}

// Returns {dir, pdf, docx, pages, chapterPages} with everything cached on disk.
async function render(state, doc, extra) {
  const key = keyFor(state, doc, extra);
  const dir = path.join(CACHE, key);
  const meta = path.join(dir, "meta.json");
  if (fs.existsSync(meta)) return JSON.parse(await fsp.readFile(meta, "utf8"));
  await fsp.mkdir(dir, { recursive: true });
  const buf = await buildDocx(state, doc, extra);
  const docxPath = path.join(dir, "doc.docx");
  await fsp.writeFile(docxPath, buf);
  await serial(() => run("soffice", [`-env:UserInstallation=${LO_PROFILE}`, "--headless", "--norestore", "--convert-to", "pdf", "--outdir", dir, docxPath], { timeout: 180000 }));
  const pdfPath = path.join(dir, "doc.pdf");
  if (!fs.existsSync(pdfPath)) throw new Error("PDF conversion failed");
  await run("pdftoppm", ["-r", "60", "-jpeg", "-jpegopt", "quality=72", pdfPath, path.join(dir, "p")]);
  const pages = (await fsp.readdir(dir)).filter((f) => /^p-\d+\.jpg$/.test(f)).sort((a, b) => parseInt(a.slice(2)) - parseInt(b.slice(2)));
  let chapterPages = null;
  if (doc === "report") chapterPages = await countChapterPages(pdfPath);
  const out = { key, doc, pages, pageCount: pages.length, chapterPages };
  await fsp.writeFile(meta, JSON.stringify(out));
  return out;
}

// Pages from the first page of chapter 1 up to (not including) the bibliography — the handbook asks for at least 30 (p.75).
async function countChapterPages(pdfPath) {
  const text = await run("pdftotext", ["-layout", pdfPath, "-"]);
  const pages = text.split("\f").map((p) => p.split("\n").map((l) => l.trim()).filter(Boolean));
  const ch1 = pages.findIndex((ls) => ls.slice(0, 4).some((l) => /^บทที่\s*1$/.test(l)) && ls.slice(0, 5).some((l) => l === "บทนำ"));
  if (ch1 < 0) return null;
  let bib = -1;
  for (let i = ch1 + 1; i < pages.length; i++) {
    const head = pages[i].filter((l) => !/^\d+$/.test(l)).slice(0, 2);
    if (head[0] === "บรรณานุกรม") { bib = i; break; }
  }
  return bib > ch1 ? bib - ch1 : null;
}

// Remove cached renders older than 6 hours.
setInterval(async () => {
  try {
    for (const d of await fsp.readdir(CACHE)) {
      const st = await fsp.stat(path.join(CACHE, d));
      if (Date.now() - st.mtimeMs > 6 * 3600e3) await fsp.rm(path.join(CACHE, d), { recursive: true, force: true });
    }
  } catch (e) { /* ignore */ }
}, 30 * 60e3).unref();

module.exports = { DOCS, buildDocx, render, CACHE };
