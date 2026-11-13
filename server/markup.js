/* Teacher mark-up: page images to draw on, and a PDF built from the marked pages. */
const fs = require("fs");
const path = require("path");
const docgen = require("./docgen");
const { run, serial, LO_PROFILE, CACHE } = docgen;
const DPI = 110;

async function hiPages(dir, pdfPath) {
  let have = fs.readdirSync(dir).filter((f) => /^h-\d+\.jpg$/.test(f));
  if (!have.length) {
    await run("pdftoppm", ["-r", String(DPI), "-jpeg", "-jpegopt", "quality=82", pdfPath, path.join(dir, "h")], { timeout: 180000 });
    have = fs.readdirSync(dir).filter((f) => /^h-\d+\.jpg$/.test(f));
  }
  const n = (f) => +f.match(/\d+/)[0];
  return have.sort((a, b) => n(a) - n(b));
}

// A system document (already rendered to doc.pdf in its cache folder)
async function docPages(state, doc, extra) {
  const r = await docgen.render(state, doc, extra);
  const dir = path.join(CACHE, r.key);
  return { key: r.key, pages: await hiPages(dir, path.join(dir, "doc.pdf")) };
}

// A file the student uploaded: PDF directly; Word/PowerPoint/Excel via LibreOffice; images as one page
const OFFICE = /wordprocessingml|msword|presentationml|ms-powerpoint|spreadsheetml|ms-excel|opendocument/;
async function filePages(f) {
  const dir = path.join(CACHE, "f-" + f.id);
  fs.mkdirSync(dir, { recursive: true });
  if (/^image\//.test(f.mime)) return { image: true, pages: [] };
  let pdf = path.join(dir, "src.pdf");
  if (!fs.existsSync(pdf)) {
    if (f.mime === "application/pdf") fs.writeFileSync(pdf, f.bytes);
    else if (OFFICE.test(f.mime)) {
      const ext = (String(f.name || "").match(/\.([a-z0-9]{2,5})$/i) || [, "docx"])[1];
      const src = path.join(dir, "src." + ext);
      fs.writeFileSync(src, f.bytes);
      await serial(() => run("soffice", [`-env:UserInstallation=${LO_PROFILE}`, "--headless", "--norestore", "--convert-to", "pdf", "--outdir", dir, src], { timeout: 180000 }));
      if (!fs.existsSync(pdf)) throw Object.assign(new Error("convert failed"), { status: 422 });
    } else throw Object.assign(new Error("unsupported"), { status: 415 });
  }
  return { dir, pages: await hiPages(dir, pdf) };
}

// Minimal PDF writer: one JPEG per page, page size = A4 width, height from the image ratio
function jpegPdf(pages) {
  const chunks = [], offs = [];
  let len = 0;
  const put = (b) => { const buf = Buffer.isBuffer(b) ? b : Buffer.from(b, "latin1"); chunks.push(buf); len += buf.length; };
  put("%PDF-1.4\n%\xe2\xe3\xcf\xd3\n");
  const N = pages.length, kids = [];
  const obj = (n, body) => { offs[n] = len; put(`${n} 0 obj\n`); body(); put("\nendobj\n"); };
  // 1 catalog, 2 pages, then per page: page, content, image
  pages.forEach((p, i) => kids.push(`${3 + i * 3} 0 R`));
  obj(1, () => put("<< /Type /Catalog /Pages 2 0 R >>"));
  obj(2, () => put(`<< /Type /Pages /Count ${N} /Kids [${kids.join(" ")}] >>`));
  pages.forEach((p, i) => {
    const pn = 3 + i * 3, cn = pn + 1, im = pn + 2;
    const W = 595.28, H = +(W * p.h / p.w).toFixed(2);
    const cs = `q ${W} 0 0 ${H} 0 0 cm /Im0 Do Q`;
    obj(pn, () => put(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /XObject << /Im0 ${im} 0 R >> >> /Contents ${cn} 0 R >>`));
    obj(cn, () => put(`<< /Length ${cs.length} >>\nstream\n${cs}\nendstream`));
    obj(im, () => { put(`<< /Type /XObject /Subtype /Image /Width ${p.w} /Height ${p.h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${p.buf.length} >>\nstream\n`); put(p.buf); put("\nendstream"); });
  });
  const total = 3 + N * 3, xref = len;
  let x = `xref\n0 ${total}\n0000000000 65535 f \n`;
  for (let n = 1; n < total; n++) x += String(offs[n]).padStart(10, "0") + " 00000 n \n";
  put(x + `trailer\n<< /Size ${total} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
  return Buffer.concat(chunks);
}

module.exports = { docPages, filePages, jpegPdf };
