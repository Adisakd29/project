/* Detailed editors for every report section (from the first version of the site, kept so nothing is lost).
   Fields bind with data-k="<path>"; app.js handles input events, saving and sync. */
"use strict";
function rInfo(){return head("ข้อมูลโครงงาน","ข้อมูลส่วนนี้ใช้ซ้ำทั้งปก บทคัดย่อ แบบ คพ. ทุกแบบ และประวัติผู้วิจัย กรอกครั้งเดียวพอ","สัปดาห์ 2 · คพ.01")+
 sec("ชื่อโครงงาน",fText("info.titleTh","ชื่อโครงงาน (ภาษาไทย)",{hint:"ไม่ควรเกิน 1 บรรทัด และระบุผลลัพธ์ เช่น การพัฒนาระบบเช็คชื่อด้วย QR Code สำหรับนักเรียนระดับ ปวช."})+(S.info.titleTh.length>70?`<div class="warnbox">ชื่อยาว ${S.info.titleTh.length} ตัวอักษร อาจเกิน 1 บรรทัด ลองตัดคำที่ไม่จำเป็นออก</div>`:"")+
  fText("info.titleEn","ชื่อโครงงาน (ภาษาอังกฤษ)")+`<div class="row">${fText("info.innov","ชื่อนวัตกรรม (ใช้แทนคำว่า “ชื่อนวัตกรรม” ทั้งเล่ม)",{ph:"เช่น เครื่องให้อาหารปลาอัตโนมัติ"})}${fText("info.innovEn","ชื่อนวัตกรรมภาษาอังกฤษ (ใช้ใน Abstract)",{ph:"e.g. the automatic fish feeder"})}</div>`+
  fSelect("info.verb","ลักษณะงาน",[["สร้าง","สร้างขึ้นใหม่ (การสร้าง…)"],["พัฒนา","พัฒนาจากของเดิม (การพัฒนา…)"]]))+
 sec("ประเภทของโครงงาน (คพ.01 ข้อ 2)",`<div style="display:grid;gap:6px">${PROJECT_TYPES.map(([k,l])=>`<label class="chk"><input type="checkbox" data-type="${k}"${S.info.types.includes(k)?" checked":""}> ${esc(l)}</label>`).join("")}</div>`)+
 sec("ระดับชั้นและสาขา",`<div class="row">${`<div class="f"><label>ระดับ</label><div class="ro">${S.info.level}. (ตามห้องเรียน · ปก${S.info.level==="ปวส"?"สีน้ำเงิน":"สีแดง"})</div></div>`}${fText("info.year","ชั้นปีที่")}${fText("info.group","กลุ่ม")}${fText("info.room","ห้อง",{ph:"เช่น ชอ.3/1"})}</div>
  <div class="row">${fText("info.dept","แผนกวิชา")}${fText("info.major","สาขาวิชา")}${fText("info.track","สาขางาน")}${fText("info.majorEn","สาขาวิชา (ภาษาอังกฤษ)",{ph:"Electronics"})}</div>
  <div class="row">${fText("info.term","ภาคเรียนที่")}${fText("info.acadYear","ปีการศึกษา")}${fText("info.finishYear","ปี พ.ศ. ที่ทำเสร็จ")}</div>`)+
 sec("คณะผู้จัดทำ",fList("members","สมาชิก (คนแรก = หัวหน้าโครงงาน)",(p)=>`<div class="row">${fSelect(p+".prefix","คำนำหน้า",["นาย","นางสาว","นาง"])}${fText(p+".first","ชื่อ")}${fText(p+".last","นามสกุล")}${fText(p+".sid","รหัสนักศึกษา")}</div>${fText(p+".nameEn","ชื่อ-สกุลภาษาอังกฤษ",{ph:"Mr. Firstname Lastname"})}`,{add:"เพิ่มสมาชิก",newKey:"member",itemLabel:"คนที่"})+
  (S.members.length>(P.limit||3)?`<div class="warnbox">คู่มือหน้า 4 กำหนด ${S.info.level}. ไม่เกิน ${P.limit||3} คนต่อโครงงาน</div>`:""))+
 sec("ครูที่ปรึกษา",`<div class="row">${fText("advisors.main","ครูที่ปรึกษาหลัก",{ph:"นาย/นางสาว..."})}${fText("advisors.mainEn","ชื่อภาษาอังกฤษ")}</div><div class="row">${fText("advisors.co","ครูที่ปรึกษาร่วม (ถ้ามี)")}${fText("advisors.coEn","ชื่อภาษาอังกฤษ")}</div>${fText("advisors.teacher","ครูผู้สอนรายวิชาโครงงาน")}`)+
 sec("สถานศึกษา",`<div class="row">${fText("info.college","วิทยาลัย")}${fText("info.inst","สถาบัน")}</div>`)}

function rCh1(){const n=N();return head("บทที่ 1 บทนำ","หลักง่าย ๆ: ปัญหา → วิธีแก้ → วัตถุประสงค์ → ประโยชน์ ผู้อ่านต้องเข้าใจว่าทำไมจึงต้องทำวิจัยเรื่องนี้","สัปดาห์ 5 · บทที่ 1–2")+
 sec("1.1 ความเป็นมาและความสำคัญของปัญหา",`<p class="hint" style="margin:0">เขียน 4 ย่อหน้า รวมไม่เกิน 1 หน้าโดยประมาณ อ้างอิงแหล่งข้อมูลที่เชื่อถือได้ เช่น (กรมประมง, 2566)</p>`+
  ["ย่อหน้าที่ 1 — ปัจจุบัน… เล่าสภาพทั่วไปที่เกี่ยวข้องกับโครงงาน","ย่อหน้าที่ 2 — ปัญหาที่เกิดจากสภาพในย่อหน้าแรก พร้อมอ้างอิง","ย่อหน้าที่ 3 — แนวทางแก้ปัญหาที่มีผู้ทำมาแล้ว แต่ยังมีข้อบกพร่อง","ย่อหน้าที่ 4 — แนวทางที่ผู้วิจัยเสนอ (สิ่งที่โครงงานนี้จะทำ)"].map((l,i)=>fArea(`ch1.bg.${i}`,l,{rows:4})).join("")+
  `<p class="hint" style="margin:0">ประมาณ ${S.ch1.bg.join("").length.toLocaleString()} ตัวอักษร (1 หน้า ≈ 1,400 ตัวอักษร)</p>`)+
 sec("1.2 วัตถุประสงค์ และ 1.3 สมมติฐาน",`<div class="ro"><b>วัตถุประสงค์ (ตามโครงสร้างคู่มือ — เปลี่ยนชื่อนวัตกรรมได้ที่ขั้น "ข้อมูลโครงงาน")</b><ol>${objectives().map(o=>`<li>${esc(o)}</li>`).join("")}</ol></div>
  <label class="chk"><input type="checkbox" data-bool="ch1.hypo"${S.ch1.hypo?" checked":""}> ใส่หัวข้อสมมติฐานการวิจัย</label>${S.ch1.hypo?`<div class="ro"><ol>${hypotheses().map(o=>`<li>${esc(o)}</li>`).join("")}</ol></div>`:""}`)+
 sec("1.4 ขอบเขตการวิจัย",fArea("ch1.spec",`ขอบเขตด้านเนื้อหา: คุณสมบัติ/สเปคของ${n}`,{rows:3,hint:"ขนาด วัสดุ อุปกรณ์หลัก ความสามารถ — ใช้ซ้ำในบทที่ 3, 4 และ คพ.01"})+
  `<div class="row">${fText("ch1.expertsN","จำนวนผู้เชี่ยวชาญ (คน)",{type:"number"})}${fSelect("ch3.expertSampling","วิธีได้มาซึ่งผู้เชี่ยวชาญ",["เลือกแบบเจาะจง","สุ่มอย่างง่าย"])}</div>`+
  fArea("ch1.testSteps","ขอบเขตการทดสอบประสิทธิภาพ: อธิบายขั้นตอนการทดสอบ",{rows:3})+
  `<div class="row">${fText("ch1.popUser","ประชากร (ผู้ใช้งาน)",{ph:"เช่น นักเรียน ปวช.2 แผนกคอมพิวเตอร์ธุรกิจ 40 คน"})}${fText("ch1.sampleUser","กลุ่มตัวอย่าง",{ph:"เช่น นักเรียน ปวช.2/1"})}</div>
  <div class="row">${fText("ch1.sampleN","จำนวนกลุ่มตัวอย่าง (คน)",{type:"number"})}${fSelect("ch1.sampling","วิธีสุ่ม",["สุ่มแบบเจาะจง","สุ่มอย่างง่าย","สุ่มแบบบังเอิญ","สุ่มแบบแบ่งชั้น"])}</div>
  <div class="row">${fText("ch1.from","ช่วงเวลา: ตั้งแต่เดือน",{ph:"พฤศจิกายน 2569"})}${fText("ch1.to","ถึงเดือน",{ph:"กุมภาพันธ์ 2570"})}</div>`)+
 sec("1.6 นิยามศัพท์เฉพาะ",fList("ch1.terms","คำที่เกี่ยวข้องกับนวัตกรรม เช่น ชื่อนวัตกรรม คุณภาพ ประสิทธิภาพ ความพึงพอใจ",(p)=>`<div class="row">${fText(p+".t","คำศัพท์")}</div>${fArea(p+".d","หมายถึง",{rows:2})}`,{add:"เพิ่มคำศัพท์",newKey:"term",itemLabel:"คำที่"})+
  `<div><button class="btn sm" type="button" data-act="termdefaults">เติมคำศัพท์พื้นฐาน 4 คำ</button></div>`)+
 sec("1.7 ประโยชน์ที่คาดว่าจะได้รับ",fList("ch1.benefits","ต้องสอดคล้องกับปัญหาในข้อ 1.1",null,{add:"เพิ่มข้อ",ph:`${n}สามารถช่วยให้…`}))}

function rCh2(){const R=allRefs();const tchars=S.ch2.topics.reduce((a,t)=>a+(t.body||"").length,0)+S.ch2.related.length*450;
 return head("บทที่ 2 แนวคิด ทฤษฎี เอกสารและงานวิจัยที่เกี่ยวข้อง","ความรู้ที่ใช้สร้างงานวิจัย เรียงจากเรื่องกว้างไปเฉพาะ อ้างอิงทุกครั้ง และสรุปด้วยภาษาของตนเอง คู่มือแนะนำ 15–20 หน้า","สัปดาห์ 5 · บทที่ 1–2")+
 `<div class="${tchars/1400>=15?"okbox":"warnbox"}">ตอนนี้บทที่ 2 ยาวประมาณ ${(tchars/1400).toFixed(1)} หน้า จากเป้าหมาย 15–20 หน้า</div>`+
 sec("หัวข้อแนวคิดและทฤษฎี",fList("ch2.topics","หัวข้อสำคัญ 2.1, 2.2, …",(p,it,i)=>fText(p+".title",`หัวข้อ 2.${i+1}`)+fArea(p+".body","เนื้อหา",{rows:7,hint:`ขึ้นบรรทัดใหม่ = ย่อหน้าใหม่ บรรทัดที่ขึ้นต้นด้วย 2.${i+1}.1 หรือ 1) จะย่อหน้าลึกขึ้นให้อัตโนมัติ`})+fPhoto(p+".img","ภาพประกอบ (ถ้ามี)",{max:900})+(it.img?fText(p+".imgCap","คำบรรยายภาพ"):""),{add:"เพิ่มหัวข้อ",newKey:"topic",itemLabel:"หัวข้อ"}))+
 sec("งานวิจัยที่เกี่ยวข้อง",`<p class="hint" style="margin:0">กรอกเป็นช่อง ระบบจะเรียงเป็นประโยค “…ได้ศึกษาวิจัยเรื่อง… มีวัตถุประสงค์… ดำเนินการโดย… ผลการวิจัยพบว่า…” และเพิ่มลงบรรณานุกรมให้</p>`+
  fList("ch2.related","",(p)=>`<div class="row">${fText(p+".author","ชื่อผู้วิจัย")}${fText(p+".year","ปี พ.ศ.")}</div>${fText(p+".title","ชื่อเรื่อง")}${fText(p+".source","สถานศึกษา/แหล่งที่เผยแพร่")}${fArea(p+".obj","มีวัตถุประสงค์เพื่อ",{rows:2})}${fArea(p+".method","ดำเนินการโดย",{rows:2})}${fArea(p+".result","ผลการวิจัยพบว่า",{rows:2})}${fArea(p+".suggest","ข้อเสนอแนะ (ถ้ามี)",{rows:2})}`,{add:"เพิ่มงานวิจัย",newKey:"related",itemLabel:"งานวิจัย"})+
  (S.ch2.related.length<5?`<div class="warnbox">มี ${S.ch2.related.length} เรื่อง ตัวอย่างในคู่มือใช้อย่างน้อย 5 เรื่อง</div>`:""))+
 sec("บรรณานุกรม (APA 6th)",`<p class="hint" style="margin:0">รายการภาษาไทยและภาษาต่างประเทศจะแยกและเรียงตามตัวอักษรให้อัตโนมัติ ตอนนี้มี ${R.th.length} รายการภาษาไทย และ ${R.en.length} รายการภาษาต่างประเทศ</p>`+
  fList("refs","",(p,it)=>`<div class="row">${fSelect(p+".type","ประเภท",[["book","หนังสือ"],["web","เว็บไซต์"],["article","บทความวารสาร"],["research","งานวิจัย/รายงาน"]])}${fText(p+".author","ผู้แต่ง/หน่วยงาน")}${fText(p+".year","ปีที่พิมพ์")}</div>${fText(p+".title","ชื่อเรื่อง")}`+
   (it.type==="web"?`<div class="row">${fText(p+".url","URL")}${fText(p+".accessed","วันที่สืบค้น",{type:"date"})}</div>`:it.type==="article"?`<div class="row">${fText(p+".journal","ชื่อวารสาร")}${fText(p+".vol","ปีที่(ฉบับที่)")}${fText(p+".pages","หน้า")}</div>`:`<div class="row">${fText(p+".place","สถานที่พิมพ์")}${fText(p+".publisher",it.type==="research"?"หน่วยงาน":"สำนักพิมพ์")}${it.type==="book"?fText(p+".edition","พิมพ์ครั้งที่"):""}</div>`)+
   `<p class="hint" style="margin:0">${refRuns(it).map(r=>r.b?`<b>${esc(r.text)}</b>`:r.i?`<i>${esc(r.text)}</i>`:esc(r.text)).join("")}</p>`,{add:"เพิ่มรายการอ้างอิง",newKey:"ref",itemLabel:"รายการ"}))}

function rCh3(){const n=N();return head("บทที่ 3 วิธีดำเนินการวิจัย","ระบบเขียนเนื้อหามาตรฐานตามคู่มือ วาดแผนภาพ 3.1–3.8 และใส่สูตรสถิติให้ กรอกเฉพาะส่วนที่เป็นของโครงงานนี้","สัปดาห์ 6 · บทที่ 3")+
 sec(`3.1 การ${V()}${n}`,fList("ch3.steps","ขั้นตอนสำหรับภาพที่ 3.1 (แผนผังการสร้าง/พัฒนา)",null,{add:"เพิ่มขั้นตอน",ph:"เช่น ออกแบบโครงสร้าง"})+fArea("ch3.process","คำอธิบายภาพที่ 3.1",{rows:4,draft:"process"})+
  fPhoto("ch3.photo",`ภาพ${n} (ใช้ในภาพที่ 3.x, 4.x และคู่มือ)`,{max:1200}))+
 sec("แบบสอบถามความคิดเห็นของผู้เชี่ยวชาญ",fList("ch3.expertItems","รายการประเมิน (ตอนที่ 2 — มาตราส่วน 5 ระดับ)",null,{add:"เพิ่มข้อ",ph:"เช่น ความเหมาะสมของขนาด"}))+
 sec(`3.2 การทดสอบประสิทธิภาพของ${n}`,fList("ch3.perf","ด้านที่ทดสอบ",(p)=>`${fText(p+".name","ชื่อด้าน",{ph:"เช่น ความตรงเวลาของการจ่ายอาหาร"})}${fText(p+".nameEn","ชื่อด้านภาษาอังกฤษ (ใช้ใน Abstract)",{ph:"timing accuracy"})}${fArea(p+".method","วิธีทดสอบและเกณฑ์ผ่าน",{rows:2})}`,{add:"เพิ่มด้าน",newKey:"perf",itemLabel:"ด้าน"}))+
 sec(`3.3 แบบสอบถามความพึงพอใจของผู้ใช้งาน`,fList("ch3.sat","ด้านของแบบสอบถาม และข้อคำถามในแต่ละด้าน",(p)=>`${fText(p+".name","ชื่อด้าน",{ph:"เช่น ด้านการใช้งาน"})}${fList(p+".items","ข้อคำถาม",null,{add:"เพิ่มข้อ"})}`,{add:"เพิ่มด้าน",newKey:"sat",itemLabel:"ด้าน"})+
  `<div class="row">${fText("ch3.tryout","กลุ่มทดลองใช้แบบสอบถาม (ไม่ใช่กลุ่มตัวอย่าง)")}${fText("ch3.tryoutN","จำนวน (คน)",{type:"number"})}</div>`)}

function liveExpert(){const L=likert(S.data.expertScores,S.ch3.expertItems);if(!L.n)return `<p class="hint">ยังไม่มีข้อมูล</p>`;
 return `${L.mismatch?`<div class="warnbox">มี ${L.mismatch} แถวที่จำนวนคะแนนไม่เท่ากับ ${S.ch3.expertItems.length} ข้อ ตรวจลำดับคอลัมน์อีกครั้ง</div>`:""}<div class="tbl"><table><tr><th>ข้อ</th><th>x̄</th><th>S.D.</th><th>ระดับ</th></tr>${L.items.map((x,i)=>`<tr><td>${i+1}. ${esc(x.name)}</td><td class="n">${f2(x.mean)}</td><td class="n">${f2(x.sd)}</td><td>${LV_SHORT[lvIdx(x.mean)]}</td></tr>`).join("")}<tr><th>รวม (${L.n} คน)</th><th class="n">${f2(L.total.mean)}</th><th class="n">${f2(L.total.sd)}</th><th>${LV_SHORT[lvIdx(L.total.mean)]}</th></tr></table></div>`}
function liveUser(){const T=satStats();if(!T.n)return `<p class="hint">ยังไม่มีข้อมูล</p>`;
 return `${T.mismatch?`<div class="warnbox">มี ${T.mismatch} แถวที่จำนวนคะแนนไม่เท่ากับ ${T.k} ข้อ</div>`:""}<div class="tbl"><table><tr><th>ด้าน / ข้อ</th><th>x̄</th><th>S.D.</th><th>ระดับ</th></tr>${T.aspects.map(a=>`<tr><th>${esc(a.name)}</th><th class="n">${f2(a.mean)}</th><th class="n">${f2(a.sd)}</th><th>${LV_SHORT[lvIdx(a.mean)]}</th></tr>${a.items.map(x=>`<tr><td>${esc(x.name)}</td><td class="n">${f2(x.mean)}</td><td class="n">${f2(x.sd)}</td><td>${LV_SHORT[lvIdx(x.mean)]}</td></tr>`).join("")}`).join("")}<tr><th>รวม (${T.n} คน)</th><th class="n">${f2(T.total.mean)}</th><th class="n">${f2(T.total.sd)}</th><th>${LV_SHORT[lvIdx(T.total.mean)]}</th></tr></table></div>`}
function liveIOC(){const R=iocStats(),it=iocItems();if(!R.length)return `<p class="hint">ยังไม่มีข้อมูล</p>`;const bad=R.filter(r=>r.ioc<.5).length;
 return `${R.length!==it.length?`<div class="warnbox">มี ${R.length} แถว แต่แบบสอบถามมี ${it.length} ข้อ</div>`:""}<div class="tbl"><table><tr><th>ข้อ</th><th>ΣR</th><th>IOC</th><th>ผล</th></tr>${R.map((r,i)=>`<tr><td>${i+1}. ${esc(it[i]||"")}</td><td class="n">${r.sum}</td><td class="n">${f2(r.ioc)}</td><td><span class="pill ${r.ioc>=.5?"ok":"warn"}">${r.ioc>=.5?"ใช้ได้":"ปรับปรุง"}</span></td></tr>`).join("")}</table></div>${bad?`<div class="warnbox">${bad} ข้อมีค่า IOC ต่ำกว่า 0.50 ต้องปรับปรุงข้อคำถามก่อนใช้จริง</div>`:""}`}
function rData(){const n=N();const ni=S.ch3.expertItems.length,ns=iocItems().length;
 return head("บทที่ 4 ผลการเก็บข้อมูล","วางคะแนนจากแบบสอบถามหรือ Google Sheets ระบบคำนวณค่าเฉลี่ย ส่วนเบี่ยงเบนมาตรฐาน ร้อยละ และ IOC แล้วเขียนตาราง แผนภูมิ และย่อหน้า “จากตารางที่… พบว่า…” ให้","สัปดาห์ 8–11 · บทที่ 4")+
 `<div class="note"><b>วิธีวางข้อมูล</b> คัดลอกช่วงคะแนนจาก Excel หรือ Google Sheets มาวางได้ทันที 1 แถว = ผู้ตอบ 1 คน แต่ละคอลัมน์ = ข้อคำถามตามลำดับ ใช้เฉพาะตัวเลข 1–5 (คอลัมน์อื่น เช่น เวลา ชื่อ จะถูกข้ามถ้าไม่ใช่ตัวเลข 1–5)</div>`+
 sec("4.1 ผู้เชี่ยวชาญ",fList("data.experts","รายชื่อผู้เชี่ยวชาญ (ภาคผนวก ค)",(p)=>`<div class="row">${fText(p+".name","ชื่อ-สกุล")}${fText(p+".pos","ตำแหน่ง")}${fText(p+".org","หน่วยงาน")}</div>`,{add:"เพิ่มผู้เชี่ยวชาญ",newKey:"expert",itemLabel:"คนที่"})+
  fList("data.expertDemo","ข้อมูลทั่วไป (ตอนที่ 1)",(p)=>`${fText(p+".q","หัวข้อ",{ph:"เช่น ตำแหน่ง"})}${fArea(p+".text","ตัวเลือก = จำนวนคน (บรรทัดละ 1 ตัวเลือก)",{rows:3,mono:true,ph:"ครูผู้สอน = 3\nผู้ประกอบการ = 2"})}`,{add:"เพิ่มหัวข้อ",newKey:"demo",itemLabel:"หัวข้อ"})+
  fArea("data.expertScores",`คะแนนความคิดเห็น (${ni} คอลัมน์ ตามรายการในบทที่ 3)`,{rows:6,mono:true,ph:"5\t4\t5\t4\t5\t5\t4"})+`<div data-live="expert">${liveExpert()}</div>`+
  `<div class="row">${fText("data.expertComments.total","จำนวนผู้ให้ข้อเสนอแนะ (คน)",{type:"number"})}</div>${fArea("data.expertComments.text","ข้อเสนอแนะ = จำนวนคน",{rows:3,mono:true,ph:"ควรเพิ่มระบบแจ้งเตือน = 2"})}`)+
 sec("4.2 ผลการทดสอบประสิทธิภาพ",S.ch3.perf.length?S.ch3.perf.map((p,i)=>{const s=perfStats(p);return `<div class="item"><span class="idx">ด้านที่ ${i+1}</span><b>${esc(p.name||"(ตั้งชื่อด้านในบทที่ 3)")}</b>
  <div class="tbl"><table><tr><th>#</th><th>รายการทดสอบ</th><th>ผลที่คาดหวัง</th><th>ผลที่ได้</th><th>ผ่าน</th><th></th></tr>${(p.rows||[]).map((r,j)=>`<tr><td class="n">${j+1}</td><td><input type="text" data-k="ch3.perf.${i}.rows.${j}.item" value="${esc(r.item)}" aria-label="รายการ"></td><td><input type="text" data-k="ch3.perf.${i}.rows.${j}.exp" value="${esc(r.exp)}" aria-label="ผลที่คาดหวัง"></td><td><input type="text" data-k="ch3.perf.${i}.rows.${j}.act" value="${esc(r.act)}" aria-label="ผลที่ได้"></td><td><input type="checkbox" data-bool="ch3.perf.${i}.rows.${j}.pass"${r.pass?" checked":""} aria-label="ผ่าน"></td><td><button class="btn ghost sm" type="button" data-act="del:ch3.perf.${i}.rows:${j}" aria-label="ลบแถว">✕</button></td></tr>`).join("")}</table></div>
  <div class="draftbar"><button class="btn sm" type="button" data-act="add:ch3.perf.${i}.rows:row">+ เพิ่ม 1 ครั้ง</button><button class="btn sm" type="button" data-act="addn:ch3.perf.${i}.rows:10">+ เพิ่ม 10 ครั้ง</button><span class="hint" data-live="perf${i}">${s.n?`ผ่าน ${s.ok}/${s.n} ครั้ง = ร้อยละ ${f2(s.pct)}`:""}</span></div></div>`}).join(""):`<p class="hint">เพิ่มด้านที่ทดสอบในขั้นตอน "บทที่ 3" ก่อน</p>`)+
 sec("4.3 ความพึงพอใจของผู้ใช้งาน",fList("data.userDemo","ข้อมูลทั่วไปของผู้ตอบ (ตอนที่ 1)",(p)=>`${fText(p+".q","หัวข้อ",{ph:"เช่น เพศ"})}${fArea(p+".text","ตัวเลือก = จำนวนคน",{rows:3,mono:true,ph:"ชาย = 12\nหญิง = 8"})}`,{add:"เพิ่มหัวข้อ",newKey:"demo",itemLabel:"หัวข้อ"})+
  fArea("data.userScores",`คะแนนความพึงพอใจ (${ns} คอลัมน์ เรียงตามข้อในบทที่ 3)`,{rows:8,mono:true})+`<div data-live="user">${liveUser()}</div>`+
  `<div class="row">${fText("data.userComments.total","จำนวนผู้ให้ข้อเสนอแนะ (คน)",{type:"number"})}</div>${fArea("data.userComments.text","ข้อเสนอแนะ = จำนวนคน",{rows:3,mono:true})}`)+
 sec("ค่า IOC ของแบบสอบถามความพึงพอใจ (ภาคผนวก ค)",fArea("data.ioc",`1 แถว = ข้อคำถาม 1 ข้อ (${ns} แถว) แต่ละคอลัมน์ = ผู้เชี่ยวชาญ 1 คน ใส่ 1, 0 หรือ -1`,{rows:6,mono:true,ph:"1\t1\t1\t0\t1"})+`<div data-live="ioc">${liveIOC()}</div>`)}

function rCh5(){const opts=[["","— ไม่อ้างอิง —"],...S.ch2.related.map((r,i)=>[String(i),`${r.author||"?"} (${r.year||"?"}) ${r.title||""}`])];
 return head("บทที่ 5 สรุปผล อภิปรายผล และข้อเสนอแนะ","สรุปผล = ได้อะไร · อภิปรายผล = ทำไมจึงได้ผลเช่นนั้น และสอดคล้องกับงานวิจัยของใคร · ข้อเสนอแนะ = ควรใช้อย่างไรและทำอะไรต่อ","สัปดาห์ 11–13 · บทที่ 5")+
 sec("5.1 สรุปผลการวิจัย (สร้างจากผลในบทที่ 4)",`<div class="ro">${esc(G.summary())}</div>`)+
 sec("5.2 อภิปรายผล",`<p class="hint" style="margin:0">ระบบเขียนโครงประโยคให้ นักเรียนต้องอธิบายเหตุผลเอง แล้วเลือกงานวิจัยในบทที่ 2 ที่ให้ผลสอดคล้อง</p>`+
  fArea("ch5.whyExpert","ผลความคิดเห็นของผู้เชี่ยวชาญเป็นเช่นนั้น ทั้งนี้เพราะ…",{rows:3})+fSelect("ch5.refExpert","สอดคล้องกับงานวิจัยของ",opts)+
  fArea("ch5.whyPerf","ผลการทดสอบประสิทธิภาพเป็นเช่นนั้น ทั้งนี้เพราะ…",{rows:3})+fSelect("ch5.refPerf","สอดคล้องกับงานวิจัยของ",opts)+
  fArea("ch5.whyUser","ผลความพึงพอใจเป็นเช่นนั้น ทั้งนี้เพราะ…",{rows:3})+fSelect("ch5.refUser","สอดคล้องกับงานวิจัยของ",opts))+
 sec("5.3 ข้อเสนอแนะ",fList("ch5.use","5.3.1 ข้อเสนอแนะในการนำผลการวิจัยไปใช้ (ควรใช้ที่ไหน อย่างไร ข้อควรระวัง)",null,{add:"เพิ่มข้อ"})+`<div><button class="btn sm" type="button" data-act="fill:ch5.use:useDraft">เติมร่างจากข้อที่คะแนนต่ำสุด</button></div>`+
  fList("ch5.next","5.3.2 ข้อเสนอแนะเพื่อการวิจัยครั้งต่อไป (ควรพัฒนาอะไรเพิ่ม)",null,{add:"เพิ่มข้อ"})+`<div><button class="btn sm" type="button" data-act="fill:ch5.next:nextDraft">เติมร่าง</button></div>`)}

function rFront(){return head("บทคัดย่อ กิตติกรรมประกาศ และภาคผนวก","บทคัดย่อร่างจากผลการวิจัยจริง ควรอ่านทวนและเกลาภาษาก่อนส่ง","สัปดาห์ 13")+
 sec("บทคัดย่อภาษาไทย",fArea("front.absTh","บทคัดย่อ",{rows:8,draft:"absTh"})+fText("info.kwTh","คำสำคัญ (คั่นด้วยจุลภาค)"))+
 sec("Abstract",fArea("front.absEn","Abstract",{rows:8,draft:"absEn",draftHint:"ร่างภาษาอังกฤษใช้ชื่อนวัตกรรมภาษาอังกฤษจากขั้นตอนแรก ควรให้ครูภาษาอังกฤษตรวจ"})+fText("info.kwEn","Keywords"))+
 sec("กิตติกรรมประกาศ",fArea("front.ack","ข้อความ",{rows:6,draft:"ack"})+fText("front.ackDate","วันที่ลงท้าย",{type:"date"}))+
 sec("ภาคผนวก ข: คู่มือการใช้งาน",fList("manual.spec","คุณลักษณะเฉพาะ",null,{add:"เพิ่ม"})+fList("manual.steps","วิธีการใช้งาน (ทีละขั้น)",null,{add:"เพิ่มขั้นตอน"})+fList("manual.caution","ข้อควรระวัง",null,{add:"เพิ่ม"}))+
 sec("ภาคผนวก ง: ภาพกิจกรรม",`<div style="display:flex;flex-direction:column;gap:10px">${S.photos.map((p,i)=>`<div class="item"><button class="btn ghost sm del" type="button" data-act="del:photos:${i}">✕ ลบ</button><div class="photo"><img src="${p.src}" alt="ภาพกิจกรรม ${i+1}"></div>${fText(`photos.${i}.cap`,"คำบรรยายภาพ")}</div>`).join("")}</div><label class="btn sm" style="align-self:flex-start">+ เพิ่มภาพกิจกรรม<input type="file" accept="image/*" multiple data-photos="1" hidden></label>`)+
 sec("ประวัติผู้วิจัย",S.members.map((m,i)=>`<div class="item"><span class="idx">${esc(memberName(m)||"สมาชิกคนที่ "+(i+1))}</span>${fPhoto(`members.${i}.photo`,"รูปถ่าย",{max:500,noSize:true})}<div class="row">${fText(`members.${i}.phone`,"โทรศัพท์")}${fText(`members.${i}.email`,"E-mail")}</div>${fText(`members.${i}.address`,"ที่อยู่ที่ติดต่อได้สะดวก")}</div>`).join(""))}

function rPlan(){const months=S.plan.months.split(/[,،]/).map(s=>s.trim()).filter(Boolean);const W=months.length*4;let tot=0;S.budget.forEach(r=>tot+=(+r.qty||0)*(+r.price||0));
 return head("แบบเสนอโครงงาน คพ.01","คพ.01 ดึงข้อมูลจากบทที่ 1 และ 3 มาให้แล้ว ส่วนนี้กรอกเฉพาะที่ไม่มีในรายงาน","สัปดาห์ 2 · คพ.01")+
 sec("12. แผนการดำเนินงาน",fText("plan.months","เดือน (คั่นด้วยจุลภาค)")+`<div class="gantt"><table><tr><th>ขั้นตอน</th>${months.map(m=>`<th colspan="4">${esc(m)}</th>`).join("")}<th></th></tr>
  ${S.plan.steps.map((s,i)=>`<tr><td><input type="text" data-k="plan.steps.${i}.name" value="${esc(s.name)}" aria-label="ขั้นตอน ${i+1}"></td>${Array.from({length:W},(_,j)=>`<td><input type="checkbox" data-week="${i}:${j}"${(s.w||[]).includes(j)?" checked":""} aria-label="${esc(s.name)} ${months[Math.floor(j/4)]} สัปดาห์ ${j%4+1}"></td>`).join("")}<td><button class="btn ghost sm" type="button" data-act="del:plan.steps:${i}" aria-label="ลบ">✕</button></td></tr>`).join("")}</table></div>
  <div><button class="btn sm" type="button" data-act="add:plan.steps:step">+ เพิ่มขั้นตอน</button></div>`)+
 sec("13. งบประมาณ",fList("budget","",(p)=>`<div class="row">${fText(p+".item","รายการ")}${fText(p+".qty","จำนวนหน่วย",{type:"number"})}${fText(p+".price","ราคาต่อหน่วย (บาท)",{type:"number"})}${fText(p+".note","หมายเหตุ")}</div>`,{add:"เพิ่มรายการ",newKey:"budget",itemLabel:"รายการ"})+`<div class="ro">รวมเงิน <b data-live="budget">${baht(tot)}</b> บาท</div>`)+
 sec("14. หลักการหรือขั้นตอนการทำงานของสิ่งประดิษฐ์",fArea("principle","อธิบายอย่างย่อ",{rows:4}))+
 sec("วันที่สำหรับแบบคำร้อง คพ.02 / 04 / 06",`${fText("forms.kp02","วันสอบหัวข้อ (คพ.02)",{type:"date"})}
  <div class="row">${fText("forms.kp04a.date","สอบความก้าวหน้า ครั้งที่ 1",{type:"date"})}${fText("forms.kp04a.time","เวลา",{ph:"13.00"})}${fText("forms.kp04a.room","ห้อง")}</div>
  <div class="row">${fText("forms.kp04b.date","สอบความก้าวหน้า ครั้งที่ 2",{type:"date"})}${fText("forms.kp04b.time","เวลา")}${fText("forms.kp04b.room","ห้อง")}</div>
  <div class="row">${fText("forms.kp06.date","ขอรับการประเมินผล (คพ.06)",{type:"date"})}${fText("forms.kp06.time","เวลา")}${fText("forms.kp06.room","ห้อง")}${fText("forms.kp06.bldg","อาคาร")}</div>`)}

function checks(){const L=likert(S.data.expertScores,S.ch3.expertItems),T=satStats(),R=allRefs();const r=buildReport();
 const chars=["c1","c2","c3","c4","c5"].reduce((a,k)=>a+r.ch[k].reduce((s,b)=>s+(b.text?b.text.length:0),0),0)+r.ctx.figs.length*500+r.ctx.tabs.length*600;
 const pages=chars/1400;
 return{pages,list:[
  [!!S.info.titleTh&&S.info.titleTh.length<=70,"ชื่อโครงงานภาษาไทยไม่เกิน 1 บรรทัด"],[!!S.info.titleEn,"มีชื่อภาษาอังกฤษ"],[!!S.info.innov,"ตั้งชื่อนวัตกรรมแล้ว"],[members().length>=1&&members().every(m=>m.sid),"สมาชิกทุกคนมีรหัสนักศึกษา"],[!!S.advisors.main,"มีครูที่ปรึกษา"],
  [S.ch1.bg.every(Boolean),"ความเป็นมาครบ 4 ย่อหน้า"],[!!S.ch1.spec,"ระบุสเปคของนวัตกรรม"],[S.ch2.related.length>=5,`งานวิจัยที่เกี่ยวข้องอย่างน้อย 5 เรื่อง (มี ${S.ch2.related.length})`],[R.th.length+R.en.length>=5,`บรรณานุกรมอย่างน้อย 5 รายการ (มี ${R.th.length+R.en.length})`],
  [!!S.ch3.photo,"มีภาพนวัตกรรม"],[L.n>=3,`มีคะแนนผู้เชี่ยวชาญ (${L.n} คน)`],[!L.mismatch&&!T.mismatch,"จำนวนคอลัมน์คะแนนตรงกับจำนวนข้อ"],[T.n>=1&&(!S.ch1.sampleN||T.n==+S.ch1.sampleN),`จำนวนผู้ตอบตรงกับกลุ่มตัวอย่าง (${T.n}/${S.ch1.sampleN||"?"})`],
  [S.ch3.perf.length&&S.ch3.perf.every(p=>p.rows.length),"มีผลการทดสอบทุกด้าน"],[iocStats().length&&iocStats().every(x=>x.ioc>=.5),"IOC ทุกข้อ ≥ 0.50"],[!!(S.ch5.whyExpert&&S.ch5.whyPerf&&S.ch5.whyUser),"อภิปรายผลครบ 3 ประเด็น"],
  [!!S.info.kwTh&&!!S.info.kwEn,"มีคำสำคัญ / Keywords"],[pages>=30,`เนื้อหาบทที่ 1–5 ประมาณ ${Math.round(pages)} หน้า (คู่มือกำหนดไม่น้อยกว่า 30 หน้า)`]]}}
function liveUpdate(k){if(k.startsWith("data.expertScores")){const el=$('[data-live="expert"]');if(el)el.innerHTML=liveExpert()}
 if(k.startsWith("data.userScores")){const el=$('[data-live="user"]');if(el)el.innerHTML=liveUser()}if(k.startsWith("data.ioc")){const el=$('[data-live="ioc"]');if(el)el.innerHTML=liveIOC()}
 const m=k.match(/^ch3\.perf\.(\d+)\.rows/);if(m){const el=$(`[data-live="perf${m[1]}"]`);if(el){const s=perfStats(S.ch3.perf[+m[1]]);el.textContent=s.n?`ผ่าน ${s.ok}/${s.n} ครั้ง = ร้อยละ ${f2(s.pct)}`:""}}
 if(k.startsWith("budget")){const el=$('[data-live="budget"]');if(el){let t=0;S.budget.forEach(r=>t+=(+r.qty||0)*(+r.price||0));el.textContent=baht(t)}}
 if(k==="info.titleTh")setTitle()}

