/* ProjectElec shared document engine: runs in the browser and in Node.
   Builds the report / KP forms as a block model, renders it to HTML (preview) and DOCX. */
(function(root,factory){if(typeof module==="object"&&module.exports)module.exports=factory();else root.PEEngine=factory();})(typeof self!=="undefined"?self:this,function(){
"use strict";
const esc=s=>String(s??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const clone=o=>JSON.parse(JSON.stringify(o));
const f2=x=>(isFinite(x)?x:0).toFixed(2);
const MONTHS=["มกราคม","กุมภาพันธ์","มีนาคม","เมษายน","พฤษภาคม","มิถุนายน","กรกฎาคม","สิงหาคม","กันยายน","ตุลาคม","พฤศจิกายน","ธันวาคม"];
const thaiDate=iso=>{if(!iso)return "....... เดือน ................. พ.ศ. .........";const d=new Date(iso+"T00:00");return `${d.getDate()} ${MONTHS[d.getMonth()]} พ.ศ. ${d.getFullYear()+543}`};
const isThai=s=>/[฀-๿]/.test(s||"");
const DOTS="..............................";
const ph=(v,label)=>v&&String(v).trim()?String(v).trim():`(${label})`;
function getPath(o,p){return p.split(".").reduce((a,k)=>a==null?a:a[k],o)}
function setPath(o,p,v){const ks=p.split(".");let a=o;for(let i=0;i<ks.length-1;i++){if(a[ks[i]]==null)a[ks[i]]=/^\d+$/.test(ks[i+1])?[]:{};a=a[ks[i]]}a[ks[ks.length-1]]=v}
const seg=typeof Intl!=="undefined"&&Intl.Segmenter?new Intl.Segmenter("th",{granularity:"word"}):null;
function words(t){return seg?[...seg.segment(t)].map(x=>x.segment):t.split(/(\s+)/)}
const PROJECT_TYPES=[
 ["r_basic","2.1 ประเภทงานวิจัย — การวิจัยพื้นฐาน (basic research)"],
 ["r_applied","2.1 ประเภทงานวิจัย — การวิจัยประยุกต์ (applied research)"],
 ["r_rd","2.1 ประเภทงานวิจัย — การวิจัยและพัฒนา (research and development)"],
 ["i1","สิ่งประดิษฐ์ฯ ประเภทที่ 1 นวัตกรรมและเทคโนโลยีการเกษตร อุตสาหกรรมสมัยใหม่"],
 ["i2","สิ่งประดิษฐ์ฯ ประเภทที่ 2 นวัตกรรมและเทคโนโลยีดิจิทัล ปัญญาประดิษฐ์"],
 ["i3","สิ่งประดิษฐ์ฯ ประเภทที่ 3 นวัตกรรมและเทคโนโลยีพลังงาน สิ่งแวดล้อม"],
 ["i4","สิ่งประดิษฐ์ฯ ประเภทที่ 4 นวัตกรรมและเทคโนโลยีอาหาร"],
 ["i5","สิ่งประดิษฐ์ฯ ประเภทที่ 5 นวัตกรรมและเทคโนโลยีเพื่อสุขภาพ (HEALTH CARE)"],
 ["i6","สิ่งประดิษฐ์ฯ ประเภทที่ 6 นวัตกรรมและเทคโนโลยี ผลิตภัณฑ์เชิงพาณิชย์"],
 ["sdg","โครงงานวิทยาศาสตร์ — วิจัยทดลองและวิจัยพัฒนาที่ยั่งยืน (SDGs)"],
 ["g_exp","โครงงานทั่วไป — ประเภทโครงงานทดลอง"],
 ["g_inv","โครงงานทั่วไป — ประเภทสิ่งประดิษฐ์ / นวัตกรรม"],
 ["g_sys","โครงงานทั่วไป — ประเภทโครงงานพัฒนาระบบหรือบริการ"],
 ["g_media","โครงงานทั่วไป — ประเภทสื่อการเรียนการสอน"],
 ["g_proj","โครงงานวิจัยโครงการ"]];
const CALENDAR=[
 [1,"ปฐมนิเทศรายวิชา รับฟังหลักเกณฑ์การเรียนวิชาโครงงาน",[]],
 [2,"วิเคราะห์ความสนใจ/ปัญหา ระดมสมองหัวข้อ เขียนแบบเสนอโครงร่าง",["คพ.01"]],
 [3,"ยื่นคำร้องขอสอบหัวข้อ และสอบหัวข้อต่อครูผู้สอนและคณะกรรมการ",["คพ.02"]],
 [4,"สอบหัวข้อ (ต่อ) ครูสรุปผลการสอบหัวข้อ",["คพ.03"]],
 [5,"ศึกษาเอกสาร งานวิจัย วางกรอบดำเนินงาน (บทที่ 1–2)",[]],
 [6,"ออกแบบวิธีดำเนินงาน เครื่องมือ แบบประเมิน (บทที่ 3)",[]],
 [7,"ยื่นคำร้องขอสอบความก้าวหน้า ครั้งที่ 1 นำเสนอ 50% (บทที่ 1–3)",["คพ.04"]],
 [8,"ครูสรุปผลความก้าวหน้า ครั้งที่ 1 / เริ่มสร้างชิ้นงาน ทดลอง เก็บข้อมูล",["คพ.05"]],
 [9,"ปรับปรุงแก้ไขตามข้อเสนอแนะ",[]],
 [10,"ทดลอง/สร้างผลงานต่อ",[]],
 [11,"วิเคราะห์ผล สรุปข้อมูล (บทที่ 4–5) ยื่นคำร้องสอบความก้าวหน้า ครั้งที่ 2",["คพ.04"]],
 [12,"นำเสนอความก้าวหน้า ครั้งที่ 2 (70%)",["คพ.05"]],
 [13,"ตรวจรูปเล่มและชิ้นงาน (90%) ยื่นคำร้องขอรับการประเมินผล ส่งเล่ม (ยังไม่เข้าเล่ม)",["คพ.06"]],
 [14,"สอบโครงงาน",["คพ.07"]],
 [15,"ปรับปรุงรายงานและชิ้นงาน ยื่นแบบอนุญาตให้เข้าเล่ม",["คพ.08"]],
 [16,"ติดตามกลุ่มที่ล่าช้า",[]],
 [17,"จัดแสดงผลงานและประกวด ณ หอประชุมวิทยาลัย",[]],
 [18,"ติดตามกลุ่มที่ล่าช้า",[]]];
/* เอกสารแนบ คพ.05 (คู่มือ หน้า 27–28): ประเด็นพิจารณาแต่ละครั้ง */
const KP05_ITEMS={
 1:[["บทที่ 1 บทนำ",[["1.1","ความสำคัญของปัญหา (ชัดเจน/ได้ใจความ/ครอบคลุม สอดคล้องกับชื่อเรื่อง)"],["1.2","วัตถุประสงค์ (กระชับ/ชัดเจน)"],["1.3","สมมติฐานการวิจัย (สอดคล้องกับวัตถุประสงค์)"],["1.4","ขอบเขตการวิจัย (ข้อตกลง/คำจำกัดความ สอดคล้องกับชื่อเรื่อง)"],["1.5","ประโยชน์ที่คาดว่าจะได้รับ (สอดคล้องกับวัตถุประสงค์)"]]],
   ["บทที่ 2 แนวคิด ทฤษฏี เอกสารและงานวิจัยที่เกี่ยวข้อง",[["2.1","เอกสารงานวิจัยที่เกี่ยวข้อง (อ้างอิงทฤษฏี/หลักการ สอดคล้องกับชื่อเรื่อง)"],["2.2","งานวิจัยที่อ้างอิง (เนื้อหาสอดคล้องกับชื่อเรื่อง อย่างน้อย 3-5 เล่ม)"]]],
   ["บทที่ 3 วิธีดำเนินการ",[["3.1","วิธีดำเนินการวิจัย กลุ่มตัวอย่างที่ศึกษา (ชัดเจน/เหมาะสม)"],["3.2","เครื่องมือวิจัย (ชัดเจน/เหมาะสม สอดคล้องกับชื่อเรื่อง)"],["3.3","วิธีการเก็บรวมรวมข้อมูล (ระบุขั้นตอน/อธิบายชัดเจน)"],["3.4","สถิติที่ใช้วิเคราะห์ข้อมูล (ระบุชัดเจน/สอดคล้องกับข้อมูล)"]]]],
 2:[["บทที่ 4 ผลการวิจัย",[["4.1","ผลการวิจัย (ความละเอียด/ชัดเจน อภิปรายผลจากตาราง)"],["4.2","ผลการวิเคราะห์ข้อมูล (ชัดเจน เข้าใจง่าย)"],["4.3","ผลการวิเคราะห์ข้อมูล (อธิบายสอดคล้องกับวัตถุประสงค์)"]]],
   ["บทที่ 5 สรุปผลการวิจัย อภิปรายผล และข้อเสนอแนะ",[["5.1","สรุปผลการวิจัย (สรุปผลได้ครบตามวัตถุประสงค์)"],["5.2","อภิปรายผล (อธิบายความสอดคล้องของผลการวิจัยกับเอกสารอ้างอิง)"],["5.3","ข้อเสนอแนะ (ให้ข้อเสนอแนะในการทำการวิจัยครั้งต่อไป)"]]]]};
const ADMINS_DEFAULT={deputy:"นางสาวอรทัย เลิศขุนทด",director:"นายสุรินทร์ บุญสนอง"}; // คู่มือ หน้า 22, 26, 32
const LV_AGREE=["เห็นด้วย อยู่ในระดับน้อยที่สุด","เห็นด้วย อยู่ในระดับน้อย","เห็นด้วย อยู่ในระดับปานกลาง","เห็นด้วย อยู่ในระดับมาก","เห็นด้วย อยู่ในระดับมากที่สุด"];
const LV_SAT=["มีความพึงพอใจ อยู่ในระดับน้อยที่สุด","มีความพึงพอใจ อยู่ในระดับน้อย","มีความพึงพอใจ อยู่ในระดับปานกลาง","มีความพึงพอใจ อยู่ในระดับมาก","มีความพึงพอใจ อยู่ในระดับมากที่สุด"];
const LV_SHORT=["น้อยที่สุด","น้อย","ปานกลาง","มาก","มากที่สุด"];
const LV_EN=["lowest","low","moderate","high","highest"];
const lvIdx=m=>{const r=Math.round(m*100)/100;return r>=4.51?4:r>=3.51?3:r>=2.51?2:r>=1.51?1:0};
const KEY="kp-project-helper-v1";
function blank(){return {
 v:1, example:false, step:"overview", startDate:"2026-11-02",
 info:{titleTh:"",titleEn:"",innov:"",innovEn:"",verb:"สร้าง",level:"ปวช",year:"3",group:"1",room:"",dept:"",major:"",track:"",term:"2",acadYear:"2569",
   college:"วิทยาลัยเทคนิคสมุทรปราการ",inst:"สถาบันการอาชีวศึกษาภาคกลาง 3",types:[],kwTh:"",kwEn:"",finishYear:"2569"},
 members:[{prefix:"นาย",first:"",last:"",nameEn:"",sid:"",phone:"",email:"",address:"",photo:null}],
 advisors:{main:"",mainEn:"",co:"",coEn:"",teacher:""},
 ch1:{bg:["","","",""],hypo:true,spec:"",expertsN:5,testSteps:"",popUser:"",sampleUser:"",sampleN:"",sampling:"สุ่มแบบเจาะจง",from:"",to:"",terms:[],benefits:["","",""]},
 ch2:{topics:[{title:"",body:"",img:null,imgCap:""}],related:[]},
 refs:[],
 ch3:{steps:["ศึกษาเอกสารและงานวิจัยที่เกี่ยวข้อง","ออกแบบและร่าง","ผู้เชี่ยวชาญประเมินความเหมาะสม","ปรับปรุงแก้ไข","สร้างฉบับสมบูรณ์"],process:"",expertSampling:"เลือกแบบเจาะจง",
   expertItems:[],perf:[],sat:[],tryout:"",tryoutN:"",photo:null},
 data:{evidence:[],experts:[],expertDemo:[{q:"ตำแหน่ง",text:""}],expertScores:"",ioc:"",expertComments:{total:"",text:""},
   userDemo:[{q:"เพศ",text:""}],userScores:"",userComments:{total:"",text:""}},
 ch5:{whyExpert:"",whyPerf:"",whyUser:"",refExpert:"",refPerf:"",refUser:"",use:[],next:[]},
 front:{absTh:"",absEn:"",ack:"",ackDate:""},
 manual:{spec:[],steps:[],caution:[]},
 photos:[],
 plan:{months:"ตุลาคม, พฤศจิกายน, ธันวาคม, มกราคม, กุมภาพันธ์",steps:[
   {name:"ศึกษาข้อมูล",w:[0,1,2,3]},{name:"ออกแบบ",w:[3,4,5]},{name:"สร้างนวัตกรรม",w:[5,6,7,8,9,10]},{name:"ทดลองใช้",w:[10,11,12]},
   {name:"เก็บข้อมูล",w:[12,13,14]},{name:"สรุปผล",w:[14,15]},{name:"ทำวิจัย 5 บท",w:[4,5,6,7,8,9,10,11,12,13,14,15,16,17]}]},
 budget:[],principle:"",
 forms:{kp02:"",kp04a:{date:"",time:"",room:""},kp04b:{date:"",time:"",room:""},kp06:{date:"",time:"",room:"",bldg:""}}
}}
function seeded(seed){let s=seed;return()=>{s=(s*16807)%2147483647;return s/2147483647}}
function example(){
 const S=blank(); S.example=true;
 Object.assign(S.info,{titleTh:"การพัฒนาเครื่องให้อาหารปลาอัตโนมัติควบคุมผ่านสมาร์ตโฟน",titleEn:"Development of an Automatic Fish Feeder Controlled via Smartphone",
  innov:"เครื่องให้อาหารปลาอัตโนมัติ",innovEn:"the automatic fish feeder",majorEn:"Electronics",verb:"พัฒนา",level:"ปวช",year:"3",group:"1",room:"ชอ.3/1",dept:"ช่างอิเล็กทรอนิกส์",major:"อิเล็กทรอนิกส์",track:"อิเล็กทรอนิกส์",
  types:["r_rd","i1"],kwTh:"เครื่องให้อาหารปลา, ระบบอัตโนมัติ, ไมโครคอนโทรลเลอร์",kwEn:"Fish Feeder, Automation, Microcontroller"});
 S.members=[{prefix:"นาย",first:"ธนกร",last:"ใจดี",nameEn:"Mr. Thanakorn Jaidee",sid:"66201010001",phone:"08x-xxx-xxxx",email:"",address:"สมุทรปราการ",photo:null},
            {prefix:"นางสาว",first:"พิมพ์ชนก",last:"สุขสวัสดิ์",nameEn:"Ms. Pimchanok Suksawat",sid:"66201010002",phone:"",email:"",address:"",photo:null}];
 S.advisors={main:"นายสมศักดิ์ รักงาน",mainEn:"Mr. Somsak Rakngan",co:"",coEn:"",teacher:"นายสมศักดิ์ รักงาน"};
 S.ch1.bg=["ปัจจุบันการเลี้ยงปลาเป็นอาชีพเสริมที่ได้รับความนิยมในชุมชนจังหวัดสมุทรปราการ ผู้เลี้ยงต้องให้อาหารปลาวันละ 2–3 ครั้งตามเวลาที่เหมาะสม ซึ่งมีผลโดยตรงต่อการเจริญเติบโตและอัตราการรอดของปลา",
  "ผู้เลี้ยงจำนวนมากมีงานประจำทำให้ไม่สามารถให้อาหารได้ตรงเวลา บางครั้งให้อาหารมากเกินไปจนน้ำเน่าเสีย หรือน้อยเกินไปจนปลาเติบโตช้า (กรมประมง, 2566)",
  "มีผู้พัฒนาเครื่องให้อาหารปลาแบบตั้งเวลามาแล้วหลายแบบ แต่ส่วนใหญ่ต้องตั้งค่าที่ตัวเครื่อง ไม่สามารถสั่งงานหรือตรวจสอบปริมาณอาหารจากระยะไกลได้",
  "คณะผู้จัดทำจึงมีแนวคิดพัฒนาเครื่องให้อาหารปลาอัตโนมัติที่ตั้งเวลาและสั่งงานผ่านสมาร์ตโฟนได้ เพื่อช่วยให้ผู้เลี้ยงให้อาหารได้ตรงเวลาและปริมาณที่เหมาะสม"];
 S.ch1.spec="ขนาด 30 × 30 × 45 เซนติเมตร ใช้ไมโครคอนโทรลเลอร์ ESP32 ถังบรรจุอาหารความจุ 2 กิโลกรัม ตั้งเวลาให้อาหารได้ 4 ช่วงต่อวัน และสั่งงานผ่านแอปพลิเคชันบนสมาร์ตโฟน";
 S.ch1.testSteps="ทดสอบความตรงเวลาของการจ่ายอาหาร ทดสอบความคลาดเคลื่อนของปริมาณอาหาร และทดสอบการสั่งงานผ่านสมาร์ตโฟน ด้านละ 10 ครั้ง";
 Object.assign(S.ch1,{popUser:"ผู้เลี้ยงปลาในชุมชนบางปู",sampleUser:"ผู้เลี้ยงปลาในชุมชนบางปู",sampleN:"20",sampling:"สุ่มแบบเจาะจง",from:"พฤศจิกายน 2569",to:"กุมภาพันธ์ 2570"});
 S.ch1.terms=[{t:"เครื่องให้อาหารปลาอัตโนมัติ",d:"อุปกรณ์ที่คณะผู้จัดทำออกแบบและสร้างขึ้นเพื่อจ่ายอาหารปลาในเวลาที่กำหนดโดยอัตโนมัติ และสั่งงานผ่านสมาร์ตโฟนได้"},
  {t:"คุณภาพ",d:"ระดับความคิดเห็นของผู้เชี่ยวชาญที่มีต่อความเหมาะสมของเครื่องให้อาหารปลาอัตโนมัติ"},
  {t:"ประสิทธิภาพ",d:"ความสามารถของเครื่องในการจ่ายอาหารได้ตรงตามเวลาและปริมาณที่กำหนด วัดจากร้อยละความถูกต้องของการทำงาน"},
  {t:"ความพึงพอใจ",d:"ระดับความคิดเห็นของผู้ใช้งานที่มีต่อเครื่องให้อาหารปลาอัตโนมัติ วัดด้วยแบบสอบถามมาตราส่วนประมาณค่า 5 ระดับ"}];
 S.ch1.benefits=["เครื่องให้อาหารปลาอัตโนมัติช่วยให้ผู้เลี้ยงปลาให้อาหารได้ตรงเวลาแม้ไม่อยู่ที่บ่อ","ช่วยลดปัญหาการให้อาหารมากเกินไปจนน้ำเน่าเสีย","เป็นต้นแบบสำหรับนักเรียนนักศึกษาในการพัฒนาต่อยอดสู่เชิงพาณิชย์"];
 S.ch2.topics=[{title:"การเลี้ยงปลาและการให้อาหารปลา",body:"การให้อาหารปลาที่เหมาะสมต้องคำนึงถึงชนิดของปลา ขนาด และอุณหภูมิของน้ำ (กรมประมง, 2566)\n2.1.1 ปริมาณอาหารที่เหมาะสม\nโดยทั่วไปควรให้อาหารร้อยละ 3–5 ของน้ำหนักตัวปลาต่อวัน",img:null,imgCap:""},
  {title:"ไมโครคอนโทรลเลอร์ ESP32",body:"ESP32 เป็นไมโครคอนโทรลเลอร์ที่มี Wi-Fi และ Bluetooth ในตัว เหมาะกับงาน IoT (Espressif Systems, 2023)",img:null,imgCap:""},
  {title:"มอเตอร์และกลไกจ่ายอาหาร",body:"",img:null,imgCap:""}];
 S.ch2.related=[{author:"สมชาย ใจดี",year:"2568",title:"เครื่องให้อาหารไก่อัตโนมัติ",obj:"สร้างและหาประสิทธิภาพของเครื่องให้อาหารไก่อัตโนมัติ",method:"ออกแบบเครื่องโดยใช้ Arduino และทดสอบการจ่ายอาหาร 30 ครั้ง",result:"เครื่องจ่ายอาหารได้ตรงเวลาร้อยละ 96.67",suggest:"ควรเพิ่มระบบแจ้งเตือนเมื่ออาหารหมด",source:"วิทยาลัยเทคนิคชลบุรี"}];
 S.refs=[{type:"book",author:"กรมประมง",year:"2566",title:"คู่มือการเลี้ยงปลาน้ำจืด",edition:"",place:"กรุงเทพฯ",publisher:"กรมประมง",url:"",accessed:"",journal:"",vol:"",pages:""},
  {type:"web",author:"Espressif Systems",year:"2023",title:"ESP32 Series Datasheet",edition:"",place:"",publisher:"",url:"https://www.espressif.com",accessed:"2026-11-03",journal:"",vol:"",pages:""}];
 S.ch3.expertItems=["ขนาดของเครื่องมีความเหมาะสม","วัสดุที่ใช้มีความแข็งแรงทนทาน","ความสะดวกในการเติมอาหาร","ความปลอดภัยในการใช้งาน","ความเหมาะสมของระบบควบคุม","ความสวยงามของชิ้นงาน","ความเป็นไปได้ในการนำไปใช้งานจริง"];
 S.ch3.perf=[{name:"ความตรงเวลาของการจ่ายอาหาร",nameEn:"feeding-time accuracy",method:"ตั้งเวลาจ่ายอาหารและจับเวลาจริง ยอมรับความคลาดเคลื่อนไม่เกิน 1 นาที",rows:[]},
   {name:"การสั่งงานผ่านสมาร์ตโฟน",nameEn:"smartphone control",method:"สั่งจ่ายอาหารจากแอปพลิเคชันในระยะต่าง ๆ",rows:[]}];
 const r1=[];for(let i=1;i<=10;i++)r1.push({item:`ตั้งเวลา ${String(6+i).padStart(2,"0")}:00 น.`,exp:"จ่ายภายใน 1 นาที",act:i===7?"ล่าช้า 2 นาที":"ตรงเวลา",pass:i!==7});
 const r2=[];for(let i=1;i<=10;i++)r2.push({item:`สั่งงานที่ระยะ ${i*5} เมตร`,exp:"เครื่องทำงาน",act:"ทำงาน",pass:true});
 S.ch3.perf[0].rows=r1;S.ch3.perf[1].rows=r2;
 S.ch3.sat=[{name:"ด้านการออกแบบ",items:["รูปลักษณ์ภายนอกสวยงาม","ขนาดเหมาะสมกับการใช้งาน","วัสดุแข็งแรง"]},
   {name:"ด้านการใช้งาน",items:["ใช้งานง่าย ไม่ซับซ้อน","แอปพลิเคชันเข้าใจง่าย","เติมอาหารสะดวก"]},
   {name:"ด้านประโยชน์",items:["ช่วยประหยัดเวลา","ช่วยให้ให้อาหารตรงเวลา","คุ้มค่ากับราคา"]}];
 S.ch3.tryout="ผู้เลี้ยงปลาชุมชนบางปะกง";S.ch3.tryoutN="10";
 S.data.experts=[{name:"นายวิชัย มั่นคง",pos:"ครูชำนาญการพิเศษ",org:"แผนกวิชาช่างอิเล็กทรอนิกส์"},{name:"นางสาวอรทัย ดีงาม",pos:"ครู",org:"แผนกวิชาช่างไฟฟ้ากำลัง"},
   {name:"นายประเสริฐ ทองดี",pos:"เจ้าของฟาร์มปลา",org:"ชุมชนบางปู"},{name:"นายสุเมธ แก้วใส",pos:"ครู",org:"แผนกวิชาเมคคาทรอนิกส์"},{name:"นางมาลี ศรีสุข",pos:"เกษตรอำเภอ",org:"สำนักงานเกษตรอำเภอ"}];
 S.data.expertDemo=[{q:"ตำแหน่ง",text:"ครูผู้สอน = 3\nผู้ประกอบการ = 1\nเจ้าหน้าที่รัฐ = 1"}];
 const rnd=seeded(42);const row=(n,b)=>Array.from({length:n},()=>rnd()<b?5:(rnd()<.85?4:3));
 S.data.expertScores=Array.from({length:5},()=>row(7,.7).join("\t")).join("\n");
 S.data.ioc=Array.from({length:9},(_,i)=>[1,1,1,i===4?0:1,1].join("\t")).join("\n");
 S.data.expertComments={total:"2",text:"ควรเพิ่มระบบแจ้งเตือนเมื่ออาหารใกล้หมด = 2"};
 S.data.userDemo=[{q:"เพศ",text:"ชาย = 12\nหญิง = 8"},{q:"อายุ",text:"ต่ำกว่า 30 ปี = 5\n30–50 ปี = 10\nมากกว่า 50 ปี = 5"}];
 S.data.userScores=Array.from({length:20},()=>row(9,.6).join("\t")).join("\n");
 S.data.userComments={total:"4",text:"อยากให้มีหลายขนาด = 3\nควรกันน้ำได้ดีขึ้น = 1"};
 S.ch5.whyExpert="คณะผู้จัดทำได้ศึกษาเอกสารและออกแบบตามข้อเสนอแนะของผู้เชี่ยวชาญก่อนสร้างจริง";
 S.ch5.refExpert="0";S.ch5.refPerf="0";
 S.manual={spec:["ใช้ไฟฟ้ากระแสสลับ 220V 50Hz ผ่านอะแดปเตอร์ 5V 2A","ถังบรรจุอาหารความจุ 2 กิโลกรัม"],steps:["เสียบปลั๊กและรอไฟสถานะสีเขียว","เปิดแอปพลิเคชันและเชื่อมต่อ Wi-Fi","ตั้งเวลาให้อาหารและกดบันทึก"],caution:["ห้ามให้ตัวเครื่องสัมผัสน้ำโดยตรง"]};
 S.budget=[{item:"บอร์ด ESP32",qty:"1",price:"250",note:""},{item:"เซอร์โวมอเตอร์",qty:"1",price:"180",note:""},{item:"แผ่นอะคริลิกและอุปกรณ์ยึด",qty:"1",price:"450",note:""}];
 S.principle="ผู้ใช้ตั้งเวลาผ่านแอปพลิเคชัน ESP32 รับคำสั่งผ่าน Wi-Fi และสั่งเซอร์โวมอเตอร์หมุนเปิดช่องจ่ายอาหารตามเวลาที่ตั้งไว้ จากนั้นปิดช่องเมื่อครบปริมาณที่กำหนด";
 return S;
}

/* create(S, env): bind the builders to one project state.
   env.docx = the docx library; env.createCanvas(w,h) = a canvas; env.imageData(src) = bytes for a stored image */
function normalize(st){const b=blank();const fill=(t,d)=>{for(const k of Object.keys(d)){if(t[k]===undefined)t[k]=clone(d[k]);else if(d[k]&&typeof d[k]==="object"&&!Array.isArray(d[k])&&t[k]&&typeof t[k]==="object"&&!Array.isArray(t[k]))fill(t[k],d[k])}return t};
 st=fill(st&&typeof st==="object"?st:{},b);if(!Array.isArray(st.data.evidence))st.data.evidence=[];return st}
function create(S, env){
env=env||{};
/* ============ derived text ============ */
const N=()=>ph(S.info.innov,"ชื่อนวัตกรรม");
const V=()=>S.info.verb||"สร้าง";
const objectives=()=>[`เพื่อ${V()}${N()}`,`เพื่อทดสอบประสิทธิภาพของ${N()}`,`เพื่อศึกษาความพึงพอใจของผู้ใช้งานที่มีต่อ${N()}`];
const hypotheses=()=>[`ผู้เชี่ยวชาญเห็นด้วยกับคุณภาพของ${N()}ที่${V()}ขึ้น`,`ผลการทดสอบประสิทธิภาพของ${N()}อยู่ในระดับดีขึ้นไป`,`ความพึงพอใจของผู้ใช้งานที่มีต่อ${N()}อยู่ในระดับดีขึ้นไป`];
const memberName=m=>`${m.prefix||""}${m.first||""} ${m.last||""}`.trim();
const members=()=>S.members.filter(m=>m.first||m.last);
const perfNames=()=>S.ch3.perf.map(p=>p.name).filter(Boolean);
const satNames=()=>S.ch3.sat.map(p=>p.name).filter(Boolean);
const joinTh=a=>a.length<=1?(a[0]||""):a.slice(0,-1).join(" ")+" และ"+a[a.length-1];
const levelLabel=()=>S.info.level==="ปวส"?"ประกาศนียบัตรวิชาชีพชั้นสูง (ปวส.)":"ประกาศนียบัตรวิชาชีพ (ปวช.)";
const classLabel=()=>`${S.info.level}. ${S.info.year?"ชั้นปีที่ "+S.info.year:""}`.trim();
const period=()=>`ดำเนินการระหว่างเดือน${ph(S.ch1.from,"เดือน ปี")} ถึงเดือน${ph(S.ch1.to,"เดือน ปี")}`;

/* ============ statistics ============ */
function parseMatrix(text,{allowNeg=false}={}){
 const ok=x=>isFinite(x)&&(allowNeg?(x>=-1&&x<=1):(x>=1&&x<=5));
 const rows=[];for(const line of String(text||"").split(/\r?\n/)){
  if(line.includes("\t")){/* tab rows keep column positions (blank = not answered); leading non-number columns such as a timestamp are skipped */
   let cells=line.split("\t").map(t=>t.trim());const first=cells.findIndex(t=>t!==""&&ok(Number(t)));if(first<0)continue;
   const lead=cells.slice(0,first);if(lead.every(t=>t===""))cells=cells;else cells=cells.slice(first);
   rows.push(cells.map(t=>t!==""&&ok(Number(t))?Number(t):null));continue}
  const nums=line.split(/[,; ]+/).map(t=>t.trim()).filter(t=>t!=="").map(Number).filter(x=>isFinite(x)&&(allowNeg?(x>=-1&&x<=1):(x>=1&&x<=5)));if(nums.length)rows.push(nums)}return rows}
function meanSD(arr){const n=arr.length;if(!n)return{mean:0,sd:0,n:0};const m=arr.reduce((a,b)=>a+b,0)/n;const v=n>1?arr.reduce((a,b)=>a+(b-m)**2,0)/(n-1):0;return{mean:m,sd:Math.sqrt(v),n}}
function likert(text,items){
 const rows=parseMatrix(text);const k=items.length;
 const res=items.map((name,i)=>{const col=rows.map(r=>r[i]).filter(x=>x!=null&&isFinite(x));return Object.assign({name},meanSD(col))});
 const all=[];rows.forEach(r=>r.slice(0,k).forEach(x=>{if(x!=null)all.push(x)}));
 const mismatch=rows.filter(r=>r.length!==k).length;
 return{n:rows.length,items:res,total:meanSD(all),mismatch}}
function satStats(){
 const flat=[];S.ch3.sat.forEach((a,ai)=>a.items.forEach(it=>flat.push({name:it,ai})));
 const L=likert(S.data.userScores,flat.map(f=>f.name));const rows=parseMatrix(S.data.userScores);
 const aspects=S.ch3.sat.map((a,ai)=>{const idx=flat.map((f,i)=>f.ai===ai?i:-1).filter(i=>i>=0);const pool=[];rows.forEach(r=>idx.forEach(i=>{if(r[i]!=null)pool.push(r[i])}));
   return Object.assign({name:a.name,items:idx.map(i=>L.items[i])},meanSD(pool))});
 return{n:L.n,flat:L.items,aspects,total:L.total,mismatch:L.mismatch,k:flat.length}}
function iocStats(){const rows=parseMatrix(S.data.ioc,{allowNeg:true});return rows.map(r=>{const v=r.filter(x=>x!=null);const s=v.reduce((a,b)=>a+b,0);return{r,sum:s,ioc:v.length?s/v.length:0}})}
function parseCounts(text){return String(text||"").split(/\r?\n/).map(l=>{const m=l.match(/^(.*?)[=:]\s*(\d+)\s*$/);return m?{label:m[1].trim(),n:+m[2]}:null}).filter(Boolean)}
function perfStats(p){
 if(p.mode==="num"){const rows=(p.rows||[]).filter(r=>r.value!==""&&r.value!=null&&isFinite(+r.value));const v=rows.map(r=>+r.value);const ms=meanSD(v);
  const hasT=p.target!==""&&p.target!=null&&isFinite(+p.target),hasTol=hasT&&p.tol!==""&&p.tol!=null&&isFinite(+p.tol);
  const okRows=hasTol?rows.filter(r=>Math.abs(+r.value-(+p.target))<=+p.tol+1e-9):[];
  const mae=hasT&&v.length?v.reduce((a,x)=>a+Math.abs(x-(+p.target)),0)/v.length:null;
  return{num:true,n:rows.length,rows,mean:ms.mean,sd:ms.sd,min:v.length?Math.min(...v):0,max:v.length?Math.max(...v):0,target:hasT?+p.target:null,tol:hasTol?+p.tol:null,ok:okRows.length,pct:hasTol&&rows.length?okRows.length*100/rows.length:null,mae}}
 const rows=(p.rows||[]).filter(r=>r.item||r.act);const ok=rows.filter(r=>r.pass).length;return{n:rows.length,ok,pct:rows.length?ok*100/rows.length:0}}
const fmtN=x=>{if(x==null||!isFinite(x))return"-";const a=Math.abs(x);return a>=100?x.toFixed(1):a>=10?x.toFixed(2):x.toFixed(2)};
/* one phrase per test aspect, used by the summary, discussion and abstract (no interpretation beyond the numbers) */
function perfPhrase(p,s){if(!s.num)return `ด้าน${p.name} ทำงานได้ถูกต้องร้อยละ ${f2(s.pct)}`;const u=p.unit?" "+p.unit:"";
 return `ด้าน${p.name} ได้ค่าเฉลี่ย ${fmtN(s.mean)}${u} (S.D. = ${f2(s.sd)})${s.pct!=null?` อยู่ในเกณฑ์ ±${s.tol}${u} ร้อยละ ${f2(s.pct)}`:""}`}
const topBy=(arr,k=3)=>[...arr].filter(x=>x.n).sort((a,b)=>b.mean-a.mean).slice(0,k);
const lowBy=arr=>[...arr].filter(x=>x.n).sort((a,b)=>a.mean-b.mean)[0];
const msd=x=>`(x̄ = ${f2(x.mean)}, S.D. = ${f2(x.sd)})`;

/* ============ generated drafts ============ */
const G={
 process:()=>`จากภาพที่ 3.1 การดำเนินการเริ่มจาก${joinTh(S.ch3.steps.filter(Boolean))} เพื่อให้ได้${N()}ที่มีคุณภาพเหมาะสมกับการใช้งาน`,
 expertResult(){const L=likert(S.data.expertScores,S.ch3.expertItems);if(!L.n)return `(กรอกคะแนนของผู้เชี่ยวชาญในขั้นตอน "ผลการเก็บข้อมูล" แล้วระบบจะเขียนย่อหน้านี้ให้)`;
  const t=topBy(L.items),lo=lowBy(L.items);return `พบว่า ผู้เชี่ยวชาญมีความคิดเห็นต่อ${N()}ในภาพรวม${LV_AGREE[lvIdx(L.total.mean)]} ${msd(L.total)} เมื่อพิจารณารายข้อ พบว่า ข้อที่มีค่าเฉลี่ยสูงสุด ได้แก่ ${t.map(x=>`${x.name} ${msd(x)}`).join(" ")} ตามลำดับ ส่วนข้อที่มีค่าเฉลี่ยต่ำสุด คือ ${lo.name} ${msd(lo)}`},
 userResult(){const T=satStats();if(!T.n)return `(กรอกคะแนนความพึงพอใจในขั้นตอน "ผลการเก็บข้อมูล" แล้วระบบจะเขียนย่อหน้านี้ให้)`;
  const asp=topBy(T.aspects);const lo=lowBy(T.flat);return `พบว่า ผู้ใช้งานมีความพึงพอใจต่อ${N()}ในภาพรวมอยู่ในระดับ${LV_SHORT[lvIdx(T.total.mean)]} ${msd(T.total)} เมื่อพิจารณารายด้าน พบว่า ${asp.map(x=>`${x.name} ${msd(x)}`).join(" ")} ตามลำดับ ส่วนข้อที่มีค่าเฉลี่ยต่ำสุด คือ ${lo?lo.name+" "+msd(lo):"-"}`},
 perfResult(p){const s=perfStats(p);if(!s.n)return `(กรอกผลการทดสอบในขั้นตอน "ผลการเก็บข้อมูล")`;
  if(s.num){const u=p.unit?" "+p.unit:"";return `พบว่า ${N()}ด้าน${p.name} จากการทดสอบ ${s.n} ครั้ง ได้ค่าเฉลี่ย ${fmtN(s.mean)}${u} (S.D. = ${f2(s.sd)}) ค่าต่ำสุด ${fmtN(s.min)}${u} และค่าสูงสุด ${fmtN(s.max)}${u}`+
   (s.target!=null?` เมื่อเทียบกับค่าเป้าหมาย ${s.target}${u} มีค่าคลาดเคลื่อนเฉลี่ย ${fmtN(s.mae)}${u}`:"")+(s.pct!=null?` และอยู่ในเกณฑ์ที่กำหนด (±${s.tol}${u}) ${s.ok} ครั้ง จาก ${s.n} ครั้ง คิดเป็นร้อยละ ${f2(s.pct)}`:"")}
  return `พบว่า ${N()}ด้าน${p.name} ทำงานได้ถูกต้อง ${s.ok} ครั้ง จากการทดสอบทั้งหมด ${s.n} ครั้ง คิดเป็นร้อยละ ${f2(s.pct)}`},
 summary(){const L=likert(S.data.expertScores,S.ch3.expertItems),T=satStats();
  const perf=S.ch3.perf.map(p=>{const s=perfStats(p);return s.n?perfPhrase(p,s):null}).filter(Boolean);
  return `ผลจากการวิจัยพบว่า ความคิดเห็นของผู้เชี่ยวชาญที่มีต่อ${N()} ในภาพรวมอยู่ในระดับ${L.n?LV_SHORT[lvIdx(L.total.mean)]+" (x̄ = "+f2(L.total.mean)+")":"..."} จากการทดสอบประสิทธิภาพ พบว่า ${perf.length?joinTh(perf):"..."} ส่วนผลการสอบถามความพึงพอใจของผู้ใช้งานที่มีต่อ${N()} พบว่า โดยเฉลี่ยมีความพึงพอใจในระดับ${T.n?LV_SHORT[lvIdx(T.total.mean)]+" (x̄ = "+f2(T.total.mean)+")":"..."}${T.n?" โดยพึงพอใจมากที่สุด"+topBy(T.aspects).map(a=>a.name).join(" ")+" ตามลำดับ":""}`},
 discuss(){const L=likert(S.data.expertScores,S.ch3.expertItems),T=satStats();const rel=i=>{const r=S.ch2.related[+i];return (i!==""&&r)?` สอดคล้องกับงานวิจัยของ${r.author} (${r.year}) ที่พบว่า ${r.result}`:""};
  const out=[];
  out.push(`ผลจากการวิจัยที่พบว่า ความคิดเห็นของผู้เชี่ยวชาญที่มีต่อ${N()} ในภาพรวมอยู่ในระดับ${L.n?LV_SHORT[lvIdx(L.total.mean)]:"..."}${L.n?` แต่เมื่อพิจารณารายข้อ พบว่า ข้อ${topBy(L.items,1)[0].name} ผู้เชี่ยวชาญเห็นด้วยในระดับ${LV_SHORT[lvIdx(topBy(L.items,1)[0].mean)]}`:""} ทั้งนี้เพราะ${ph(S.ch5.whyExpert,"อธิบายเหตุผล")}${rel(S.ch5.refExpert)}`);
  const perf=S.ch3.perf.map(p=>({p,s:perfStats(p)})).filter(x=>x.s.n);
  out.push(`ส่วนผลการทดสอบประสิทธิภาพการทำงานของ${N()} พบว่า ${perf.length?joinTh(perf.map(x=>perfPhrase(x.p,x.s))):"..."} ทั้งนี้เพราะ${ph(S.ch5.whyPerf,"อธิบายเหตุผล")}${rel(S.ch5.refPerf)}`);
  out.push(`และผลการสอบถามความพึงพอใจของผู้ใช้งานที่มีต่อ${N()} พบว่า ผู้ใช้งานมีความพึงพอใจเฉลี่ยในระดับ${T.n?LV_SHORT[lvIdx(T.total.mean)]:"..."}${T.n&&lowBy(T.flat)?` แต่เมื่อพิจารณารายข้อพบว่า ข้อ${lowBy(T.flat).name} มีค่าเฉลี่ยต่ำที่สุด (x̄ = ${f2(lowBy(T.flat).mean)})`:""} ทั้งนี้เพราะ${ph(S.ch5.whyUser,"อธิบายเหตุผล")}${rel(S.ch5.refUser)}`);
  return out},
 useDraft(){const L=likert(S.data.expertScores,S.ch3.expertItems),T=satStats();const a=[];
  if(L.n){const lo=lowBy(L.items);a.push(`จากผลการวิจัยที่พบว่า ความคิดเห็นของผู้เชี่ยวชาญที่มีต่อ${N()} ในข้อ${lo.name} มีค่าเฉลี่ยต่ำที่สุด จึงควรจัดเตรียม/ปรับปรุง...ก่อนนำไปใช้งาน`)}
  if(T.n){const lo=lowBy(T.flat);a.push(`จากผลการสอบถามความพึงพอใจของผู้ใช้งานที่มีต่อ${N()} พบว่า ข้อ${lo.name} มีค่าเฉลี่ยต่ำที่สุด จึงควรจัดเตรียม/จัดหา...`)}
  a.push(`ควรศึกษาคู่มือการใช้งาน${N()}ก่อนใช้งานจริง`);return a},
 nextDraft(){const T=satStats();const a=[`ควรพัฒนา${N()}ให้มี...เพิ่มเติม ตามข้อเสนอแนะของผู้เชี่ยวชาญ`];if(T.n){a.push(`จากผลการสอบถามความพึงพอใจ ข้อ${lowBy(T.flat).name} มีค่าเฉลี่ยต่ำที่สุด จึงควรทำการศึกษาวิจัยเกี่ยวกับ...`)}return a},
 absTh(){const L=likert(S.data.expertScores,S.ch3.expertItems),T=satStats();const perf=S.ch3.perf.map(p=>{const s=perfStats(p);return s.n?perfPhrase(p,s):null}).filter(Boolean);
  return `การวิจัยครั้งนี้ มีวัตถุประสงค์เพื่อ (1) ${V()}${N()} (2) ทดสอบประสิทธิภาพการทำงานของ${N()} และ (3) ศึกษาความพึงพอใจของผู้ใช้งานที่มีต่อ${N()} การดำเนินงานเริ่มจากการศึกษาเอกสารและงานวิจัยที่เกี่ยวข้องเพื่อร่างเป็น${N()} นำเสนอผู้เชี่ยวชาญจำนวน ${S.ch1.expertsN||5} คน เพื่อประเมินความเหมาะสม นำข้อเสนอแนะมาปรับปรุงแก้ไขและ${V()}เป็น${N()} ทำการทดสอบเพื่อหาประสิทธิภาพ และสอบถามความพึงพอใจของผู้ใช้งานจำนวน ${ph(S.ch1.sampleN,"จำนวน")} คน เครื่องมือที่ใช้ในการวิจัย ประกอบด้วย แบบประเมินความคิดเห็นของผู้เชี่ยวชาญ แบบบันทึกการทดสอบหาประสิทธิภาพ และแบบสอบถามความพึงพอใจ สถิติที่ใช้ในการวิจัย ได้แก่ ค่าร้อยละ ค่าเฉลี่ย และค่าเบี่ยงเบนมาตรฐาน\n`+
  `ผลการวิจัยพบว่า ความคิดเห็นของผู้เชี่ยวชาญที่มีต่อ${N()} ในภาพรวมเห็นด้วยในระดับ${L.n?LV_SHORT[lvIdx(L.total.mean)]+" "+msd(L.total):"..."}${L.n?" โดยเห็นด้วยมากที่สุดในรายการ"+topBy(L.items).map(x=>x.name).join(" ")+" ตามลำดับ":""} ผลการทดสอบประสิทธิภาพ พบว่า ${perf.length?joinTh(perf):"..."} ส่วนความพึงพอใจของผู้ใช้งานที่มีต่อ${N()} ในภาพรวมอยู่ในระดับ${T.n?LV_SHORT[lvIdx(T.total.mean)]+" "+msd(T.total):"..."}${T.n?" โดยพึงพอใจมากที่สุด"+topBy(T.aspects).map(x=>x.name).join(" ")+" ตามลำดับ":""}`},
 absEn(){const L=likert(S.data.expertScores,S.ch3.expertItems),T=satStats();const n=S.info.innovEn||"(innovation name)";const verb=V()==="พัฒนา"?"develop":"build";
  const perf=S.ch3.perf.map(p=>{const s=perfStats(p);const nm=p.nameEn||"(test aspect "+(S.ch3.perf.indexOf(p)+1)+")";return !s.n?null:s.num?`a mean of ${fmtN(s.mean)}${p.unit?" "+p.unit:""} (S.D. = ${f2(s.sd)}) in ${nm}${s.pct!=null?` with ${f2(s.pct)}% within tolerance`:""}`:`${f2(s.pct)}% in ${nm}`}).filter(Boolean);
  return `The objectives of this research were (1) to ${verb} ${n}, (2) to test the efficiency of ${n}, and (3) to study user satisfaction with ${n}. The research began with a review of related documents and studies to draft ${n}, which was then evaluated by ${S.ch1.expertsN||5} experts. Their suggestions were used to improve ${n} before efficiency testing and a satisfaction survey of ${S.ch1.sampleN||"..."} users. The research instruments were an expert opinion form, an efficiency test record, and a satisfaction questionnaire. The statistics used were percentage, mean, and standard deviation.\n`+
  `The results showed that the experts' overall opinion of ${n} was at the ${L.n?LV_EN[lvIdx(L.total.mean)]+" level (x̄ = "+f2(L.total.mean)+", S.D. = "+f2(L.total.sd)+")":"... level"}. The efficiency test showed ${perf.length?perf.join(", "):"..."}. Overall user satisfaction was at the ${T.n?LV_EN[lvIdx(T.total.mean)]+" level (x̄ = "+f2(T.total.mean)+", S.D. = "+f2(T.total.sd)+")":"... level"}.`},
 ack:()=>`การ${V()}${N()} และจัดทำรายงานการวิจัยฉบับนี้ สำเร็จลุล่วงไปได้ด้วยความกรุณาและการให้คำแนะนำเกี่ยวกับการทำวิจัยเป็นอย่างดียิ่ง จากผู้อำนวยการและคณะครู${S.info.college} ${S.info.inst} โดยเฉพาะ${ph(S.advisors.main,"ชื่อครูที่ปรึกษา")} ครูที่ปรึกษาโครงงาน จึงขอขอบคุณมา ณ โอกาสนี้\nขอขอบคุณบิดา มารดา ตลอดจนครอบครัวของคณะผู้จัดทำ และผู้มีพระคุณทุกท่านที่ได้ให้การสนับสนุนและให้กำลังใจคณะผู้จัดทำด้วยดีเสมอมา\nคณะผู้จัดทำขอขอบคุณผู้เชี่ยวชาญ คณะครู ${S.info.college} ที่ให้ความอนุเคราะห์ตรวจสอบคุณภาพ และให้คำแนะนำที่เป็นประโยชน์ในการ${V()}${N()} และจัดทำรายงานการวิจัยฉบับนี้`,
 related:r=>`${ph(r.author,"ชื่อผู้วิจัย")} (${ph(r.year,"ปี พ.ศ.")}) ได้ศึกษาวิจัยเรื่อง ${ph(r.title,"ชื่อเรื่อง")} มีวัตถุประสงค์เพื่อ${ph(r.obj,"วัตถุประสงค์")} ดำเนินการโดย${ph(r.method,"วิธีดำเนินการ")} ผลการวิจัยพบว่า ${ph(r.result,"ผลการวิจัย")}${r.suggest?` โดยมีข้อเสนอแนะว่า ${r.suggest}`:""}`
};

/* ============ bibliography (APA 6) ============ */
function refRuns(r){const th=isThai(r.author+r.title);const T=t=>({text:t}),Ti=t=>(th?{text:t,b:true}:{text:t,i:true});const a=ph(r.author,th?"ผู้แต่ง":"Author"),y=ph(r.year,th?"ปี":"Year");
 if(r.type==="web"){const acc=r.accessed?new Date(r.accessed+"T00:00"):null;const accTh=acc?`${acc.getDate()} ${MONTHS[acc.getMonth()]} ${acc.getFullYear()+543}`:"วัน เดือน ปี";
  const accEn=acc?acc.toLocaleDateString("en-US",{month:"long",day:"numeric",year:"numeric"}):"Month Day, Year";
  return [T(`${a}. (${y}). `),Ti(ph(r.title,"ชื่อเรื่อง")),T(th?`. สืบค้นเมื่อ ${accTh}, จาก ${r.url||"URL"}`:`. Retrieved ${accEn}, from ${r.url||"URL"}`)]}
 if(r.type==="article")return [T(`${a}. (${y}). ${ph(r.title,"ชื่อบทความ")}. `),Ti(ph(r.journal,th?"ชื่อวารสาร":"Journal")),T(`${r.vol?", "+r.vol:""}${r.pages?", "+r.pages:""}.`)];
 if(r.type==="research")return [T(`${a}. (${y}). `),Ti(ph(r.title,"ชื่อเรื่อง")),T(`. ${th?"(รายงานการวิจัย)":"(Research report)"}. ${r.place?r.place+": ":""}${ph(r.publisher,th?"หน่วยงาน":"Institution")}.`)];
 return [T(`${a}. (${y}). `),Ti(ph(r.title,"ชื่อหนังสือ")),T(`${r.edition?` (${th?"พิมพ์ครั้งที่ ":""}${r.edition}${th?"":" ed."})`:""}. ${r.place?r.place+": ":""}${ph(r.publisher,th?"สำนักพิมพ์":"Publisher")}.`)]}
function allRefs(){const list=S.refs.slice();S.ch2.related.filter(r=>r.author&&r.title).forEach(r=>{if(!list.some(x=>x.title===r.title))list.push({type:"research",author:r.author,year:r.year,title:r.title,publisher:r.source||"",place:""})});
 const key=r=>(r.author||"")+(r.title||"");const th=list.filter(r=>isThai(r.author+r.title)).sort((a,b)=>key(a).localeCompare(key(b),"th"));
 const en=list.filter(r=>!isThai(r.author+r.title)).sort((a,b)=>key(a).localeCompare(key(b),"en"));return{th,en}}

/* ============ canvas images (charts, flow diagrams) ============ */
const imgCache=new Map();
function canvasURL(key,w,h,draw){if(imgCache.has(key))return imgCache.get(key);if(!env.createCanvas)return null;const c=env.createCanvas(w,h);const x=c.getContext("2d");
 x.fillStyle="#fff";x.fillRect(0,0,w,h);x.fillStyle="#111";x.strokeStyle="#111";draw(x);const out={src:c.toDataURL("image/png"),w,h};imgCache.set(key,out);if(imgCache.size>60)imgCache.delete(imgCache.keys().next().value);return out}
function wrap(x,text,maxW){const out=[];let line="";for(const w of words(String(text))){const t=line+w;if(x.measureText(t).width>maxW&&line){out.push(line.trim());line=w.trimStart()}else line=t}if(line.trim())out.push(line.trim());return out.length?out:[""]}
function barChart(labels,vals,title){const rowH=58,top=70,left=560,w=1400;const h=top+labels.length*rowH+70;
 return canvasURL("bar|"+title+"|"+labels.join("|")+vals.map(f2).join(","),w,h,x=>{x.font="600 30px Sarabun";x.textAlign="center";x.fillText(title,w/2,42);
  const pw=w-left-90;x.font="24px Sarabun";x.strokeStyle="#ccc";x.lineWidth=1;
  for(let t=0;t<=5;t++){const X=left+pw*t/5;x.beginPath();x.moveTo(X,top-6);x.lineTo(X,top+labels.length*rowH);x.stroke();x.fillStyle="#555";x.textAlign="center";x.fillText(t.toFixed(2),X,top+labels.length*rowH+32)}
  labels.forEach((lb,i)=>{const y=top+i*rowH;x.fillStyle="#111";x.textAlign="right";x.font="24px Sarabun";const ls=wrap(x,lb,left-30).slice(0,2);ls.forEach((l,j)=>x.fillText(l,left-16,y+rowH/2+8-(ls.length-1)*13+j*26));
   const bw=pw*Math.max(0,vals[i])/5;x.fillStyle=i===labels.length-1&&title.includes("รวม")?"#555":"#3d5a99";x.fillRect(left,y+12,bw,rowH-24);x.fillStyle="#111";x.textAlign="left";x.font="600 24px Sarabun";x.fillText(f2(vals[i]),left+bw+10,y+rowH/2+8)})})}
function lineChart(vals,target,tol,unit,title){if(!vals.length)return null;const w=1400,h=620,L=150,R=60,T=70,B=90;const lo0=Math.min(...vals,target!=null?target-(tol||0):Infinity),hi0=Math.max(...vals,target!=null?target+(tol||0):-Infinity);
 const pad=(hi0-lo0)*0.15||Math.abs(hi0)*0.1||1,lo=lo0-pad,hi=hi0+pad;const X=i=>L+(vals.length===1?(w-L-R)/2:i*(w-L-R)/(vals.length-1)),Y=v=>T+(hi-v)*(h-T-B)/(hi-lo);
 return canvasURL("line|"+title+vals.join(",")+target+tol,w,h,x=>{x.font="600 30px Sarabun";x.textAlign="center";x.fillStyle="#111";x.fillText(title,w/2,42);x.font="22px Sarabun";x.lineWidth=1;
  for(let k=0;k<=5;k++){const v=lo+(hi-lo)*k/5,y=Y(v);x.strokeStyle="#ddd";x.beginPath();x.moveTo(L,y);x.lineTo(w-R,y);x.stroke();x.fillStyle="#555";x.textAlign="right";x.fillText(fmtN(v),L-12,y+7)}
  if(target!=null){if(tol!=null){x.fillStyle="rgba(60,140,90,.12)";x.fillRect(L,Y(target+tol),w-L-R,Y(target-tol)-Y(target+tol))}x.strokeStyle="#3c8c5a";x.setLineDash([10,8]);x.lineWidth=2;x.beginPath();x.moveTo(L,Y(target));x.lineTo(w-R,Y(target));x.stroke();x.setLineDash([]);x.fillStyle="#3c8c5a";x.textAlign="left";x.fillText(`เป้าหมาย ${target}${unit?" "+unit:""}`,L+8,Y(target)-8)}
  x.strokeStyle="#3d5a99";x.lineWidth=3;x.beginPath();vals.forEach((v,i)=>i?x.lineTo(X(i),Y(v)):x.moveTo(X(i),Y(v)));x.stroke();
  vals.forEach((v,i)=>{x.fillStyle="#3d5a99";x.beginPath();x.arc(X(i),Y(v),7,0,7);x.fill();x.fillStyle="#555";x.textAlign="center";x.fillText(String(i+1),X(i),h-B+32)});
  x.fillStyle="#111";x.textAlign="center";x.fillText("ครั้งที่ทดสอบ",(L+w-R)/2,h-20);x.save();x.translate(40,(T+h-B)/2);x.rotate(-Math.PI/2);x.fillText(unit?`ค่าที่วัดได้ (${unit})`:"ค่าที่วัดได้",0,0);x.restore()})}
function flowChart(steps,key){steps=steps.filter(Boolean);if(!steps.length)steps=["(ขั้นตอน)"];const per=Math.min(4,steps.length),rows=Math.ceil(steps.length/per);const bw=270,bh=150,gx=70,gy=70,w=per*bw+(per-1)*gx+60,h=rows*bh+(rows-1)*gy+40;
 return canvasURL("flow|"+key+steps.join("|"),w,h,x=>{x.lineWidth=3;const pos=steps.map((s,i)=>{const r=Math.floor(i/per),c0=i%per,c=r%2?per-1-c0:c0;return{x:30+c*(bw+gx),y:20+r*(bh+gy),s}});
  pos.forEach((p,i)=>{x.strokeStyle="#111";x.fillStyle="#f2f4f8";x.beginPath();x.roundRect?x.roundRect(p.x,p.y,bw,bh,14):x.rect(p.x,p.y,bw,bh);x.fill();x.stroke();x.fillStyle="#111";x.font="26px Sarabun";x.textAlign="center";
   const ls=wrap(x,p.s,bw-30).slice(0,4);ls.forEach((l,j)=>x.fillText(l,p.x+bw/2,p.y+bh/2+9-(ls.length-1)*16+j*32));
   if(i<pos.length-1){const q=pos[i+1];let ax,ay,bx,by;if(q.y===p.y){if(q.x>p.x){ax=p.x+bw;bx=q.x}else{ax=p.x;bx=q.x+bw}ay=by=p.y+bh/2}else{ax=bx=p.x+bw/2;ay=p.y+bh;by=q.y}
    x.beginPath();x.moveTo(ax,ay);x.lineTo(bx,by);x.stroke();const ang=Math.atan2(by-ay,bx-ax);x.beginPath();x.moveTo(bx,by);x.lineTo(bx-16*Math.cos(ang-.45),by-16*Math.sin(ang-.45));x.lineTo(bx-16*Math.cos(ang+.45),by-16*Math.sin(ang+.45));x.closePath();x.fillStyle="#111";x.fill()}})})}
function ipoChart(input,process,output,key){const cols=[["Input",input],["Process",process],["Output",output]];const bw=360,gx=90,bh=110,gap=22;const maxN=Math.max(...cols.map(c=>c[1].length));const w=3*bw+2*gx+60,h=80+maxN*(bh+gap);
 return canvasURL("ipo|"+key+JSON.stringify(cols),w,h,x=>{x.lineWidth=3;cols.forEach((c,ci)=>{const X=30+ci*(bw+gx);x.font="600 28px Sarabun";x.textAlign="center";x.fillStyle="#111";x.fillText(c[0],X+bw/2,40);
  const tot=c[1].length*(bh+gap)-gap,y0=60+(maxN*(bh+gap)-gap-tot)/2;c[1].forEach((t,i)=>{const y=y0+i*(bh+gap);x.fillStyle="#f2f4f8";x.strokeStyle="#111";x.beginPath();x.roundRect?x.roundRect(X,y,bw,bh,12):x.rect(X,y,bw,bh);x.fill();x.stroke();
   x.fillStyle="#111";x.font="25px Sarabun";const ls=wrap(x,t,bw-30).slice(0,3);ls.forEach((l,j)=>x.fillText(l,X+bw/2,y+bh/2+9-(ls.length-1)*15+j*30))});
  if(ci<2){const ax=X+bw+10,bx=X+bw+gx-10,ay=60+(maxN*(bh+gap)-gap)/2;x.beginPath();x.moveTo(ax,ay);x.lineTo(bx,ay);x.stroke();x.beginPath();x.moveTo(bx,ay);x.lineTo(bx-18,ay-11);x.lineTo(bx-18,ay+11);x.closePath();x.fill()}})})}

/* ============ document model ============
 blocks: {t:'p',text|runs,ind,left,hang,align,before,after,b,size,keep}
         {t:'h',text,lvl,bm}  {t:'h1c',lines,bm}  {t:'table',w:[..],rows:[[cell]],head:n,nb,size}
         {t:'cap',kind:'tab'|'fig',no,text,bm}  {t:'img',src,w,h,width}  {t:'br'}  {t:'blank',n}  {t:'toc',items}
*/
function Ctx(){return{toc:[],tabs:[],figs:[],tc:{},fc:{},
 tab(ch,text){this.tc[ch]=(this.tc[ch]||0)+1;const no=`${ch}.${this.tc[ch]}`,bm=`tab${ch}_${this.tc[ch]}`;this.tabs.push({no,text,bm});return{t:"cap",kind:"tab",no,text,bm}},
 fig(ch,text){this.fc[ch]=(this.fc[ch]||0)+1;const no=`${ch}.${this.fc[ch]}`,bm=`fig${ch}_${this.fc[ch]}`;this.figs.push({no,text,bm});return{t:"cap",kind:"fig",no,text,bm}},
 h(text,lvl=0,bmId){const bm=bmId||("h"+(this.toc.length+1));this.toc.push({text,lvl,bm});return{t:"h",text,lvl,bm}}}}
const P=(text,o={})=>Object.assign({t:"p",text,ind:720},o);
const sub=(text,lvl)=>({t:"p",text,ind:720*lvl});
const paras=(text,o={})=>String(text||"").split(/\n+/).map(s=>s.trim()).filter(Boolean).map(s=>{const m=s.match(/^(\d+(?:\.\d+)+|\d+\))\s/);const lvl=m?(m[1].includes(")")?3:m[1].split(".").length-1):1;return P(s,Object.assign({ind:720*Math.min(lvl,4)},o))});
const IMG_W={s:260,m:380,l:520};const img=(o,width=520)=>{if(!o||!o.src)return null;let w=o.size&&IMG_W[o.size]?IMG_W[o.size]:width;if(o.w&&o.h)w=Math.min(w,Math.round(640*o.w/o.h));return{t:"img",src:o.src,w:o.w,h:o.h,width:w}};
const likertCriteria=(kind)=>{const L=kind==="sat"?LV_SAT:LV_AGREE;return[
 {t:"table",w:[2200,5000],rows:[[{text:"ระดับคะแนน",b:1,al:"c"},{text:"ความหมาย",b:1,al:"c"}],...[5,4,3,2,1].map(s=>[{text:String(s),al:"c"},L[s-1]])],head:1,nb:true,center:true},
 P("เกณฑ์ในการแปลความหมายของคะแนนตามแนวคิดของบุญชม ศรีสะอาด (2556) กำหนดเป็นช่วงคะแนน ดังนี้",{ind:1440}),
 {t:"table",w:[2200,5000],rows:[[{text:"ค่าเฉลี่ย",b:1,al:"c"},{text:"หมายถึง",b:1,al:"c"}],["4.51–5.00",L[4]],["3.51–4.50",L[3]],["2.51–3.50",L[2]],["1.51–2.50",L[1]],["1.00–1.50",L[0]]].map((r,i)=>i?[{text:r[0],al:"c"},r[1]]:r),head:1,nb:true,center:true}]};
const formulas=()=>[
 P("ตอนที่ 1 ข้อมูลทั่วไปของผู้ตอบแบบสอบถาม วิเคราะห์โดยการหาค่าร้อยละ (บุญชม ศรีสะอาด, 2553) จากสูตร P = (F / N) × 100 เมื่อ P คือ ร้อยละ F คือ ความถี่ที่ต้องการแปลงเป็นค่าร้อยละ และ N คือ จำนวนความถี่ทั้งหมด",{ind:1440}),
 P("ตอนที่ 2 ความคิดเห็นแบบมาตราส่วนประมาณค่า 5 ระดับ วิเคราะห์โดยหาค่าเฉลี่ยและค่าเบี่ยงเบนมาตรฐาน เสนอผลในรูปตาราง แผนภูมิ และการบรรยาย",{ind:1440}),
 P("ค่าเฉลี่ย (Mean) จากสูตร  x̄ = Σx / n  เมื่อ x̄ แทน ค่าเฉลี่ย Σx แทน ผลรวมของข้อมูลทั้งหมด และ n แทน จำนวนข้อมูล (บุญชม ศรีสะอาด, 2553)",{ind:1440}),
 P("ค่าเบี่ยงเบนมาตรฐาน (Standard deviation) จากสูตร  S.D. = √[ Σ(x − x̄)² / (n − 1) ]  เมื่อ S.D. แทน ค่าเบี่ยงเบนมาตรฐาน x แทน ข้อมูลแต่ละจำนวน x̄ แทน ค่าเฉลี่ย และ n แทน จำนวนข้อมูล (บุญชม ศรีสะอาด, 2553)",{ind:1440}),
 P("ค่าความตรงเชิงเนื้อหาจากผู้เชี่ยวชาญ (IOC) จากสูตร  IOC = ΣR / n  เมื่อ ΣR แทน ผลรวมของคะแนนความคิดเห็นของผู้เชี่ยวชาญทั้งหมด และ n แทน จำนวนผู้เชี่ยวชาญทั้งหมด (สมนึก ภัททิยธนี, 2546)",{ind:1440}),
 P("ตอนที่ 3 ความคิดเห็นและข้อเสนอแนะอื่น ๆ ใช้วิธีจัดหมวดหมู่ความสัมพันธ์ของเนื้อหาและนำเสนอเป็นร้อยละ",{ind:1440})];
function demoTable(ctx,ch,groups,who){const g=groups.map(x=>({q:x.q,c:parseCounts(x.text)})).filter(x=>x.c.length);if(!g.length)return[P(`(กรอกข้อมูลทั่วไปของ${who}ในขั้นตอน "ผลการเก็บข้อมูล")`)];
 const rows=[[{text:"ข้อมูลทั่วไป",b:1,al:"c"},{text:"จำนวน (คน)",b:1,al:"c"},{text:"ร้อยละ",b:1,al:"c"}]];g.forEach(x=>{const tot=x.c.reduce((a,b)=>a+b.n,0);rows.push([{text:x.q,b:1,span:3}]);x.c.forEach(o=>rows.push([{text:"   "+o.label},{text:String(o.n),al:"c"},{text:f2(o.n*100/tot),al:"c"}]));rows.push([{text:"รวม",al:"r",b:1},{text:String(tot),al:"c",b:1},{text:"100.00",al:"c",b:1}])});
 const cap=ctx.tab(ch,`ข้อมูลทั่วไปของ${who}`);const first=g[0].c.slice().sort((a,b)=>b.n-a.n)[0],tot0=g[0].c.reduce((a,b)=>a+b.n,0);
 return[cap,{t:"table",w:[4800,1750,1750],rows,head:1},P(`จากตารางที่ ${cap.no} พบว่า ${who}ส่วนใหญ่มี${g[0].q} ${first.label} จำนวน ${first.n} คน คิดเป็นร้อยละ ${f2(first.n*100/tot0)}`,{before:120})]}
function scoreTable(items,total,kind,groups){const L=kind==="sat"?LV_SHORT:LV_SHORT;const rows=[[{text:"รายการประเมิน",b:1,al:"c"},{text:"x̄",b:1,al:"c"},{text:"S.D.",b:1,al:"c"},{text:"ระดับ",b:1,al:"c"}]];
 if(groups){groups.forEach((g,gi)=>{rows.push([{text:g.name||`ด้านที่ ${gi+1}`,b:1},{text:f2(g.mean),al:"c",b:1},{text:f2(g.sd),al:"c",b:1},{text:L[lvIdx(g.mean)],al:"c",b:1}]);g.items.forEach((it,i)=>rows.push([{text:`   ${it.name}`},{text:f2(it.mean),al:"c"},{text:f2(it.sd),al:"c"},{text:L[lvIdx(it.mean)],al:"c"}]))})}
 else items.forEach((it,i)=>rows.push([{text:`${i+1}. ${it.name}`},{text:f2(it.mean),al:"c"},{text:f2(it.sd),al:"c"},{text:L[lvIdx(it.mean)],al:"c"}]));
 rows.push([{text:"รวม",b:1,al:"c"},{text:f2(total.mean),al:"c",b:1},{text:f2(total.sd),al:"c",b:1},{text:L[lvIdx(total.mean)],al:"c",b:1}]);
 return{t:"table",w:[4700,1150,1150,1300],rows,head:1}}
function commentBlocks(c,who,base){const list=parseCounts(c.text);const tot=+c.total||list.reduce((a,b)=>a+b.n,0);const all=base||0;const out=[];
 if(!list.length){out.push(sub(`${base?"":""}ไม่มี${who}แสดงความคิดเห็นและข้อเสนอแนะเพิ่มเติม`,2));return out}
 out.push(sub(`มีผู้แสดงความคิดเห็นและเสนอแนะเพิ่มเติมทั้งหมด รวม ${tot} คน จากผู้ตอบแบบสอบถาม ${all||"..."} คน คิดเป็นร้อยละ ${all?f2(tot*100/all):"..."}`,2));
 list.forEach(o=>out.push(sub(`มีผู้แสดงความคิดเห็นและเสนอแนะเพิ่มเติม เกี่ยวกับ${o.label} จำนวน ${o.n} คน จากผู้แสดงความคิดเห็นทั้งหมด ${tot} คน คิดเป็นร้อยละ ${f2(o.n*100/(tot||1))}`,2)));return out}

function buildChapters(ctx){
 const ch={};const n=N(),obj=objectives();
 /* ---- chapter 1 ---- */
 const c1=[{t:"h1c",lines:["บทที่ 1","บทนำ"],bm:"ch1"}];ctx.toc.push({text:"บทที่ 1 บทนำ",lvl:0,bm:"ch1"});
 c1.push(ctx.h("1.1 ความเป็นมาและความสำคัญของปัญหา",1));S.ch1.bg.forEach((p,i)=>c1.push(P(ph(p,["ย่อหน้าที่ 1: เล่าสภาพทั่วไปที่เกี่ยวข้อง","ย่อหน้าที่ 2: ปัญหาที่เกิดขึ้น พร้อมอ้างอิง","ย่อหน้าที่ 3: แนวทางแก้ปัญหาที่มีผู้ทำมาแล้วและข้อบกพร่อง","ย่อหน้าที่ 4: แนวทางที่ผู้วิจัยเสนอ"][i]))));
 c1.push(ctx.h("1.2 วัตถุประสงค์ของการวิจัย",1));obj.forEach((o,i)=>c1.push(sub(`1.2.${i+1} ${o}`,1)));
 let k=3;if(S.ch1.hypo){c1.push(ctx.h(`1.${k} สมมติฐานการวิจัย`,1));hypotheses().forEach((o,i)=>c1.push(sub(`1.${k}.${i+1} ${o}`,1)));k++}
 c1.push(ctx.h(`1.${k} ขอบเขตการวิจัย`,1));const E=S.ch1.expertsN||5;
 c1.push(sub(`1.${k}.1 ขอบเขตของการวิจัยตามวัตถุประสงค์ข้อที่ 1 การ${V()}${n} ประกอบด้วย`,1),
  sub(`1.${k}.1.1 ขอบเขตด้านเนื้อหา ${n} มีคุณลักษณะดังนี้ ${ph(S.ch1.spec,"ระบุคุณสมบัติ/สเปคของนวัตกรรม")}`,2),
  sub(`1.${k}.1.2 ขอบเขตด้านประชากรและกลุ่มตัวอย่าง`,2),sub(`1) ประชากร เป็นผู้เชี่ยวชาญด้าน${n}`,3),sub(`2) กลุ่มตัวอย่าง เป็นตัวแทนผู้เชี่ยวชาญด้าน${n} ที่ทำการ${S.ch3.expertSampling||"เลือกแบบเจาะจง"} จำนวน ${E} คน`,3),
  sub(`1.${k}.1.3 ขอบเขตด้านตัวแปร`,2),sub(`1) ตัวแปรต้น คือ ${n}`,3),sub(`2) ตัวแปรตาม คือ ความคิดเห็นของผู้เชี่ยวชาญที่มีต่อ${n}`,3),
  sub(`1.${k}.1.4 ขอบเขตด้านเวลา ${period()}`,2),
  sub(`1.${k}.2 ขอบเขตของการวิจัยตามวัตถุประสงค์ข้อที่ 2 การทดสอบประสิทธิภาพของ${n} ประกอบด้วย`,1),
  sub(`1.${k}.2.1 ขอบเขตด้านเนื้อหา ${ph(S.ch1.testSteps,"อธิบายขั้นตอนการทดสอบประสิทธิภาพ")}`,2),
  sub(`1.${k}.2.2 ขอบเขตด้านตัวแปร`,2),sub(`1) ตัวแปรต้น คือ ขั้นตอนการทดสอบประสิทธิภาพการทำงานของ${n}`,3),sub(`2) ตัวแปรตาม คือ ผลการทดสอบประสิทธิภาพการทำงานของ${n}${perfNames().length?" ด้าน"+joinTh(perfNames()):""}`,3),
  sub(`1.${k}.2.3 ขอบเขตด้านเวลา ${period()}`,2),
  sub(`1.${k}.3 ขอบเขตของการวิจัยตามวัตถุประสงค์ข้อที่ 3 การศึกษาความพึงพอใจของผู้ใช้งานที่มีต่อ${n} ประกอบด้วย`,1),
  sub(`1.${k}.3.1 ขอบเขตด้านเนื้อหา เป็นขั้นตอนการสอบถามความพึงพอใจของผู้ใช้งานที่มีต่อ${n}${satNames().length?" ใน"+joinTh(satNames()):""}`,2),
  sub(`1.${k}.3.2 ขอบเขตด้านประชากรและกลุ่มตัวอย่าง`,2),sub(`1) ประชากร ได้แก่ ${ph(S.ch1.popUser,"ผู้ใช้งาน")}`,3),sub(`2) กลุ่มตัวอย่าง ได้แก่ ${ph(S.ch1.sampleUser,"ตัวแทนผู้ใช้งาน")} ที่ทำการ${S.ch1.sampling||"สุ่ม"} จำนวน ${ph(S.ch1.sampleN,"จำนวน")} คน`,3),
  sub(`1.${k}.3.3 ขอบเขตด้านตัวแปร`,2),sub(`1) ตัวแปรต้น คือ การใช้งาน${n}`,3),sub(`2) ตัวแปรตาม คือ ความพึงพอใจของผู้ใช้งานที่มีต่อ${n}`,3),
  sub(`1.${k}.3.4 ขอบเขตด้านเวลา ${period()}`,2));k++;
 c1.push(ctx.h(`1.${k} กรอบแนวคิดการวิจัย`,1));
 c1.push({t:"table",w:[4150,4150],rows:[[{text:"ตัวแปรต้น",b:1,al:"c"},{text:"ตัวแปรตาม",b:1,al:"c"}],
   [{text:`${n}${S.ch1.spec?" ("+S.ch1.spec.slice(0,140)+(S.ch1.spec.length>140?"…":"")+")":""}`},{text:`1. ความคิดเห็นของผู้เชี่ยวชาญที่มีต่อ${n}\n2. ประสิทธิภาพการทำงานของ${n}${perfNames().length?" ด้าน"+joinTh(perfNames()):""}\n3. ความพึงพอใจของผู้ใช้งานที่มีต่อ${n}`}]],head:1});
 const fcap=ctx.fig(1,"กรอบแนวคิดการวิจัย");c1.push(fcap);k++;
 c1.push(ctx.h(`1.${k} นิยามศัพท์เฉพาะ`,1));(S.ch1.terms.length?S.ch1.terms:[{t:n,d:""}]).forEach((t,i)=>c1.push(sub(`1.${k}.${i+1} ${ph(t.t,"คำศัพท์")} หมายถึง ${ph(t.d,"ความหมาย")}`,1)));k++;
 c1.push(ctx.h(`1.${k} ประโยชน์ที่คาดว่าจะได้รับ`,1));S.ch1.benefits.filter(Boolean).forEach((b,i)=>c1.push(sub(`1.${k}.${i+1} ${b}`,1)));
 ch.c1=c1;
 /* ---- chapter 2 ---- */
 const c2=[{t:"h1c",lines:["บทที่ 2","แนวคิด ทฤษฎี เอกสารและงานวิจัยที่เกี่ยวข้อง"],bm:"ch2"}];ctx.toc.push({text:"บทที่ 2 แนวคิด ทฤษฎี เอกสารและงานวิจัยที่เกี่ยวข้อง",lvl:0,bm:"ch2"});
 const tops=S.ch2.topics.filter(t=>t.title);
 c2.push(P(`การศึกษาวิจัยครั้งนี้ มีวัตถุประสงค์เพื่อ 1) ${V()}${n} 2) ทดสอบประสิทธิภาพของ${n} และ 3) ศึกษาความพึงพอใจของผู้ใช้งานที่มีต่อ${n} ผู้วิจัยได้ศึกษาแนวคิด ทฤษฎี เอกสารและงานวิจัยที่เกี่ยวข้อง ดังนี้`));
 tops.forEach((t,i)=>c2.push(sub(`2.${i+1} ${t.title}`,1)));c2.push(sub(`2.${tops.length+1} งานวิจัยที่เกี่ยวข้อง`,1));
 tops.forEach((t,i)=>{c2.push(ctx.h(`2.${i+1} ${t.title}`,1));c2.push(...paras(t.body||"(เขียนเนื้อหา อ้างอิงแหล่งที่มาทุกครั้ง และสรุปด้วยภาษาของตนเอง)"));if(t.img){c2.push(img(t.img,400),ctx.fig(2,t.imgCap||t.title))}});
 c2.push(ctx.h(`2.${tops.length+1} งานวิจัยที่เกี่ยวข้อง`,1));(S.ch2.related.length?S.ch2.related:[{}]).forEach(r=>c2.push(P(G.related(r))));
 ch.c2=c2;
 /* ---- chapter 3 ---- */
 const c3=[{t:"h1c",lines:["บทที่ 3","วิธีดำเนินการวิจัย"],bm:"ch3"}];ctx.toc.push({text:"บทที่ 3 วิธีดำเนินการวิจัย",lvl:0,bm:"ch3"});
 c3.push(P(`การศึกษาวิจัยครั้งนี้ มีวัตถุประสงค์เพื่อ${V()}${n} ทดสอบประสิทธิภาพของ${n} และศึกษาความพึงพอใจของผู้ใช้งานที่มีต่อ${n} ผู้วิจัยได้ดำเนินการวิจัย ดังนี้`),
  sub(`3.1 การ${V()}${n}`,1),sub(`3.2 การทดสอบประสิทธิภาพของ${n}`,1),sub(`3.3 การศึกษาความพึงพอใจของผู้ใช้งานที่มีต่อ${n}`,1));
 c3.push(ctx.h(`3.1 การ${V()}${n}`,1),P(`การดำเนินการวิจัยขั้นตอนการ${V()}${n} เป็นการประเมินความคิดเห็นของผู้เชี่ยวชาญที่มีต่อร่าง${n} แสดงขั้นตอนการดำเนินการดังภาพที่ 3.1`));
 let f=ctx.fig(3,`แผนผังการ${V()}${n}`);c3.push(img(flowChart(S.ch3.steps,"s31")),f,P(S.ch3.process||G.process()));
 c3.push(sub(`3.1.1 การกำหนดประชากรและกลุ่มตัวอย่าง`,1),sub(`ประชากร เป็นผู้เชี่ยวชาญด้าน${n}`,2),sub(`กลุ่มตัวอย่าง เป็นตัวแทนผู้เชี่ยวชาญด้าน${n} จำนวน ${E} คน ทำการ${S.ch3.expertSampling}`,2),
  sub(`3.1.2 การสร้างและหาคุณภาพเครื่องมือที่ใช้ในการเก็บรวบรวมข้อมูล`,1),
  P(`เครื่องมือที่ใช้ในการเก็บรวบรวมข้อมูล เป็นแบบสอบถามความคิดเห็นของผู้เชี่ยวชาญที่มีต่อ${n} มีลักษณะเป็นแบบมาตราส่วนประมาณค่า 5 ระดับ จำนวน ${S.ch3.expertItems.length||"..."} ข้อ มี 3 ตอน ประกอบด้วย`,{ind:1440}),
  P("ตอนที่ 1 ข้อมูลทั่วไปของผู้ตอบแบบสอบถาม เป็นรายการคำถามเกี่ยวกับสถานภาพของผู้ตอบแบบสอบถาม มีลักษณะเป็นแบบกำหนดคำตอบให้เลือกตอบ",{ind:1440}),
  P(`ตอนที่ 2 รายการคำถามเกี่ยวกับความคิดเห็นของผู้เชี่ยวชาญที่มีต่อ${n} มีลักษณะเป็นแบบมาตราส่วนประมาณค่า 5 ระดับ ตามแบบของลิเคิร์ท โดยกำหนดเป็น มากที่สุด มาก ปานกลาง น้อย และน้อยที่สุด ซึ่งมีเกณฑ์การให้คะแนน ดังนี้`,{ind:1440}),
  ...likertCriteria("agree"),P("ตอนที่ 3 ความคิดเห็นและข้อเสนอแนะอื่น ๆ เป็นคำถามปลายเปิด ให้ผู้ตอบแสดงความคิดเห็นเพิ่มเติม",{ind:1440}),
  P(`การสร้างและหาคุณภาพแบบสอบถามความคิดเห็นของผู้เชี่ยวชาญที่มีต่อ${n} แสดงดังภาพที่ 3.2`,{ind:1440}));
 const qSteps=["ศึกษาหลักการสร้างแบบสอบถาม",`ศึกษาคุณสมบัติของ${n}`,"วิเคราะห์และร่างแบบสอบถาม","ตรวจสอบความถูกต้อง","แบบสอบถามฉบับร่าง","สร้างแบบสอบถามฉบับสมบูรณ์"];
 f=ctx.fig(3,`ขั้นตอนการสร้างและหาคุณภาพแบบสอบถามความคิดเห็นของผู้เชี่ยวชาญที่มีต่อ${n}`);c3.push(img(flowChart(qSteps,"s32")),f,
  P(`จากภาพที่ 3.2 การดำเนินการเริ่มจากการศึกษาหลักการสร้างแบบสอบถามความคิดเห็น ศึกษาคุณสมบัติ โครงสร้าง และการใช้งานของ${n} เพื่อวิเคราะห์และร่างเป็นแบบสอบถาม ตรวจสอบความถูกต้องด้วยตนเอง สร้างเป็นแบบสอบถามฉบับร่าง และสร้างเป็นแบบสอบถามความคิดเห็นของผู้เชี่ยวชาญที่มีต่อ${n} ฉบับสมบูรณ์ เพื่อใช้ในการเก็บรวบรวมข้อมูล (แสดงในภาคผนวก ค)`));
 c3.push(sub("3.1.3 การเก็บรวบรวมข้อมูล",1),P(`การเก็บรวบรวมข้อมูลขั้นตอนการ${V()}${n} แสดงดังภาพที่ 3.3`));
 f=ctx.fig(3,`ขั้นตอนการเก็บรวบรวมข้อมูลขั้นตอนการ${V()}${n}`);c3.push(img(ipoChart([n,"ผู้เชี่ยวชาญด้านนวัตกรรม","เครื่องมือที่ใช้ในการเก็บรวบรวมข้อมูล"],["ชี้แจงและนำเสนอแก่ผู้เชี่ยวชาญ","ตอบข้อซักถามและข้อสงสัยต่าง ๆ","ประเมินนวัตกรรมโดยผู้เชี่ยวชาญ"],["ผลการประเมินคุณภาพนวัตกรรม"],"s33")),f,
  P(`จากภาพที่ 3.3 การดำเนินการเริ่มจากการเตรียม${n} ติดต่อผู้เชี่ยวชาญ เตรียมแบบสอบถามความคิดเห็นของผู้เชี่ยวชาญ จากนั้นชี้แจงและนำเสนอ${n}แก่ผู้เชี่ยวชาญ ตอบข้อซักถามและข้อสงสัย ให้ผู้เชี่ยวชาญประเมิน และรวบรวมผลการประเมินคุณภาพ`));
 c3.push(sub("3.1.4 การวิเคราะห์ข้อมูลและสรุปผล",1),...formulas());
 c3.push(sub(`3.1.5 การนำผลสรุปมาสร้างเป็น${n}`,1),P(`นำผลสรุปที่ได้จากการสอบถามความคิดเห็นของผู้เชี่ยวชาญมาปรับปรุงแก้ไขเพื่อ${V()}เป็น${n} แสดงดังภาพที่ 3.${ctx.fc[3]+1}`));
 if(S.ch3.photo){c3.push(img(S.ch3.photo,360));}else c3.push(P("(อัปโหลดภาพนวัตกรรมในขั้นตอน \"บทที่ 3\")",{align:"c",ind:0}));
 f=ctx.fig(3,n);c3.push(f,P(`จากภาพที่ ${f.no} ${n} มีลักษณะดังนี้ ${ph(S.ch1.spec,"ระบุสเปคให้ตรงกับขอบเขตในบทที่ 1")}`));
 const pn=perfNames();c3.push(ctx.h(`3.2 การทดสอบประสิทธิภาพของ${n}`,1),P(`เป็นการทดสอบประสิทธิภาพของ${n}${pn.length?" ด้าน"+joinTh(pn):""} แสดงขั้นตอนดังภาพที่ 3.${ctx.fc[3]+1}`));
 f=ctx.fig(3,`การทดสอบประสิทธิภาพของ${n}`);c3.push(img(ipoChart([`เตรียม${n}และอุปกรณ์ประกอบ`],pn.length?pn.map(p=>"ทดสอบด้าน"+p):["ทดสอบประสิทธิภาพ"],pn.length?pn.map(p=>"ผลการทดสอบด้าน"+p):["ผลการทดสอบ"],"s35")),f,
  P(`จากภาพที่ ${f.no} แสดงการทดสอบประสิทธิภาพของ${n} โดยเตรียม${n}และอุปกรณ์ประกอบ แล้วทดสอบ${pn.length?"ด้าน"+joinTh(pn):"..."} บันทึกผลลงในแบบบันทึกผลการทดสอบ`));
 S.ch3.perf.forEach((p,i)=>{const s=perfStats(p);const u=p.unit?" "+p.unit:"";c3.push(sub(`3.2.${i+1} การทดสอบด้าน${ph(p.name,"ชื่อด้าน")} ${p.method||""}${s.n?` จำนวน ${s.n} ครั้ง`:""}${p.mode==="num"?` บันทึกค่าที่วัดได้${p.unit?"เป็นหน่วย "+p.unit:""}${s.target!=null?` เทียบกับค่าเป้าหมาย ${s.target}${u}`:""}${s.tol!=null?` โดยถือว่าผ่านเมื่อค่าที่วัดได้ต่างจากค่าเป้าหมายไม่เกิน ±${s.tol}${u}`:""} วิเคราะห์ด้วยค่าเฉลี่ย ค่าเบี่ยงเบนมาตรฐาน ค่าต่ำสุด และค่าสูงสุด${s.tol!=null?" และร้อยละของจำนวนครั้งที่อยู่ในเกณฑ์":""}`:""}`,1))});
 const sn=satNames();c3.push(ctx.h(`3.3 การศึกษาความพึงพอใจของผู้ใช้งานที่มีต่อ${n}`,1),P(`เป็นการศึกษาความพึงพอใจของผู้ใช้งานที่มีต่อ${n}${sn.length?" "+joinTh(sn):""} แสดงขั้นตอนดังภาพที่ 3.${ctx.fc[3]+1}`));
 f=ctx.fig(3,`การศึกษาความพึงพอใจของผู้ใช้งานที่มีต่อ${n}`);c3.push(img(flowChart(["กำหนดประชากรและกลุ่มตัวอย่าง",`เตรียมทดสอบการใช้งาน${n}`,"สร้างและหาคุณภาพแบบสอบถาม","เก็บรวบรวมข้อมูลจากกลุ่มตัวอย่าง","วิเคราะห์ข้อมูลและสรุปผล"],"s36")),f,
  P(`จากภาพที่ ${f.no} การดำเนินการเริ่มจากการกำหนดประชากรและกลุ่มตัวอย่าง เตรียมทดสอบการใช้งาน${n} สร้างและหาคุณภาพแบบสอบถามโดยผู้เชี่ยวชาญด้านวิจัย เก็บรวบรวมข้อมูลจากกลุ่มตัวอย่าง แล้ววิเคราะห์ข้อมูลและสรุปผล`));
 c3.push(sub(`3.3.1 การเตรียมการทดสอบเพื่อใช้งาน${n}`,1),sub("3.3.2 การกำหนดประชากรและกลุ่มตัวอย่าง",1),sub(`ประชากร เป็น${ph(S.ch1.popUser,"ผู้ใช้งาน")}`,2),sub(`กลุ่มตัวอย่าง เป็น${ph(S.ch1.sampleUser,"ตัวแทนผู้ใช้งาน")} จำนวน ${ph(S.ch1.sampleN,"จำนวน")} คน ทำการ${S.ch1.sampling}`,2),
  sub("3.3.3 การสร้างและหาคุณภาพเครื่องมือที่ใช้ในการเก็บรวบรวมข้อมูล",1),
  P(`เครื่องมือที่ใช้ในการเก็บรวบรวมข้อมูล เป็นแบบสอบถามความพึงพอใจของผู้ใช้งานที่มีต่อ${n} มีลักษณะเป็นแบบมาตราส่วนประมาณค่า 5 ระดับ มี 3 ตอน ประกอบด้วย ตอนที่ 1 ข้อมูลทั่วไปของผู้ตอบแบบสอบถาม ตอนที่ 2 รายการคำถามเกี่ยวกับความพึงพอใจ${sn.length?" "+sn.length+" ด้าน ได้แก่ "+joinTh(sn):""} และตอนที่ 3 ความคิดเห็นและข้อเสนอแนะอื่น ๆ โดยมีเกณฑ์การให้คะแนน ดังนี้`,{ind:1440}),
  ...likertCriteria("sat"),P(`การสร้างและหาคุณภาพแบบสอบถามความพึงพอใจของผู้ใช้งานที่มีต่อ${n} ดำเนินการดังภาพที่ 3.${ctx.fc[3]+1}`,{ind:1440}));
 f=ctx.fig(3,`ขั้นตอนการสร้างและหาคุณภาพแบบสอบถามความพึงพอใจของผู้ใช้งานที่มีต่อ${n}`);c3.push(img(flowChart(["ศึกษาหลักการสร้างแบบสอบถาม","วิเคราะห์และร่างแบบสอบถาม","ผู้เชี่ยวชาญตรวจสอบ IOC","ปรับปรุงแก้ไข","ทดลองใช้ (Try out)","แบบสอบถามฉบับสมบูรณ์"],"s37")),f,
  P(`จากภาพที่ ${f.no} การดำเนินการเริ่มจากการศึกษาเอกสารที่เกี่ยวข้องและพิจารณาโครงสร้างการใช้งานของ${n} เพื่อวิเคราะห์และร่างเป็นแบบสอบถาม นำไปให้ผู้เชี่ยวชาญตรวจสอบเพื่อหาค่าดัชนีความสอดคล้อง (IOC) ปรับปรุงแก้ไขจุดบกพร่อง นำไปทดลองใช้กับ${ph(S.ch3.tryout,"ผู้ใช้งานที่มิใช่กลุ่มตัวอย่าง")}${S.ch3.tryoutN?" จำนวน "+S.ch3.tryoutN+" คน":""} เพื่อหาข้อบกพร่องและปรับปรุงแก้ไขอีกครั้ง แล้วจัดทำเป็นแบบสอบถามฉบับสมบูรณ์ (แสดงในภาคผนวก ค)`));
 c3.push(sub("3.3.4 การเก็บรวบรวมข้อมูล",1),P(`การเก็บรวบรวมข้อมูลขั้นตอนการสอบถามความพึงพอใจของผู้ใช้งานที่มีต่อ${n} แสดงดังภาพที่ 3.${ctx.fc[3]+1}`));
 f=ctx.fig(3,"ขั้นตอนการเก็บรวบรวมข้อมูล");c3.push(img(ipoChart([n,`ผู้ใช้งาน${n}`,"เครื่องมือที่ใช้ในการเก็บรวบรวมข้อมูล"],[`ชี้แจงและสาธิตการใช้งาน${n}`,"ตอบข้อซักถามและข้อสงสัยต่าง ๆ","สอบถามความพึงพอใจของผู้ใช้งาน"],["ผลการสอบถามความพึงพอใจของผู้ใช้งาน"],"s38")),f,
  P(`จากภาพที่ ${f.no} การดำเนินการเริ่มจากการเตรียม${n} ติดต่อผู้ใช้งาน เตรียมแบบสอบถามความพึงพอใจ จากนั้นชี้แจงและสาธิตการใช้งาน ตอบข้อซักถาม และให้ผู้ใช้งานตอบแบบสอบถาม`));
 c3.push(sub("3.3.5 การวิเคราะห์ข้อมูลและสรุปผล",1),P("วิเคราะห์ข้อมูลด้วยค่าร้อยละ ค่าเฉลี่ย และค่าเบี่ยงเบนมาตรฐาน แปลความหมายตามเกณฑ์ข้างต้น โดยใช้สูตรเดียวกับข้อ 3.1.4",{ind:1440}));
 ch.c3=c3;
 /* ---- chapter 4 ---- */
 const c4=[{t:"h1c",lines:["บทที่ 4","ผลการวิจัย"],bm:"ch4"}];ctx.toc.push({text:"บทที่ 4 ผลการวิจัย",lvl:0,bm:"ch4"});
 c4.push(P(`การศึกษาวิจัยครั้งนี้ มีวัตถุประสงค์เพื่อ${V()}${n} ทดสอบประสิทธิภาพของ${n} และศึกษาความพึงพอใจของผู้ใช้งานที่มีต่อ${n} มีผลการวิจัย ดังนี้`),
   sub(`4.1 ผลการ${V()}${n}`,1),sub(`4.2 ผลการทดสอบประสิทธิภาพของ${n}`,1),sub(`4.3 ผลการศึกษาความพึงพอใจของผู้ใช้งานที่มีต่อ${n}`,1));
 c4.push(ctx.h(`4.1 ผลการ${V()}${n}`,1),sub("4.1.1 ข้อมูลทั่วไปของผู้ตอบแบบสอบถาม (ผู้เชี่ยวชาญ)",1),...demoTable(ctx,4,S.data.expertDemo,"ผู้เชี่ยวชาญ"));
 const L=likert(S.data.expertScores,S.ch3.expertItems);c4.push(sub(`4.1.2 ความคิดเห็นของผู้เชี่ยวชาญที่มีต่อ${n}`,1));
 if(L.n){const cap=ctx.tab(4,`ความคิดเห็นของผู้เชี่ยวชาญที่มีต่อ${n} (n = ${L.n})`);c4.push(cap,scoreTable(L.items,L.total,"agree"));
  c4.push(img(barChart([...L.items.map((x,i)=>`${i+1}. ${x.name}`),"รวม"],[...L.items.map(x=>x.mean),L.total.mean],"ค่าเฉลี่ยความคิดเห็นของผู้เชี่ยวชาญ (รวม)")));const fc=ctx.fig(4,`ความคิดเห็นของผู้เชี่ยวชาญที่มีต่อ${n}`);c4.push(fc);
  c4.push(P(`จากตารางที่ ${cap.no} และภาพที่ ${fc.no} ${G.expertResult()}`))}else c4.push(P(G.expertResult()));
 c4.push(sub("4.1.3 ความคิดเห็นและข้อเสนอแนะอื่น ๆ สรุปได้ดังนี้",1),...commentBlocks(S.data.expertComments,"ผู้เชี่ยวชาญ",L.n));
 c4.push(sub(`4.1.4 นำผลสรุปที่ได้จากการสอบถามความคิดเห็นของผู้เชี่ยวชาญและข้อเสนอแนะเพิ่มเติมมาปรับปรุงแก้ไขเพื่อ${V()}เป็น${n} แสดงดังภาพที่ 4.${ctx.fc[4]+1}`,1));
 if(S.ch3.photo)c4.push(img(S.ch3.photo,360));f=ctx.fig(4,n);c4.push(f,P(`จากภาพที่ ${f.no} ${n} มีลักษณะดังนี้ ${ph(S.ch1.spec,"ระบุสเปค")}`));
 c4.push(ctx.h(`4.2 ผลการทดสอบประสิทธิภาพของ${n}`,1),P(`เป็นการทดสอบประสิทธิภาพของ${n}${pn.length?" ด้าน"+joinTh(pn):""} ดังนี้`));
 S.ch3.perf.forEach((p,i)=>{const s=perfStats(p);c4.push(sub(`4.2.${i+1} ผลการทดสอบประสิทธิภาพการทำงานของ${n} ด้าน${ph(p.name,"ชื่อด้าน")}`,1));
  if(s.n&&s.num){const u=p.unit?` (${p.unit})`:"";const cap=ctx.tab(4,`ผลการทดสอบประสิทธิภาพการทำงานของ${n} ด้าน${p.name}`);
   const hd=[{text:"ครั้งที่",b:1,al:"c"},{text:"รายการ/สภาวะที่ทดสอบ",b:1,al:"c"},{text:"ค่าที่วัดได้"+u,b:1,al:"c"}];if(s.target!=null)hd.push({text:"ผลต่างจากเป้าหมาย"+u,b:1,al:"c"});if(s.tol!=null)hd.push({text:"ผล",b:1,al:"c"});
   const rows=[hd];s.rows.forEach((r,j)=>{const row=[{text:String(j+1),al:"c"},r.item||"",{text:String(r.value),al:"c"}];if(s.target!=null)row.push({text:fmtN(+r.value-s.target),al:"c"});if(s.tol!=null)row.push({text:Math.abs(+r.value-s.target)<=s.tol+1e-9?"ผ่าน":"ไม่ผ่าน",al:"c"});rows.push(row)});
   const W=hd.length,sp=W-2;rows.push([{text:"ค่าเฉลี่ย (x̄)",b:1,al:"r",span:2},{text:fmtN(s.mean),b:1,al:"c",span:sp}]);rows.push([{text:"ค่าเบี่ยงเบนมาตรฐาน (S.D.)",b:1,al:"r",span:2},{text:f2(s.sd),b:1,al:"c",span:sp}]);
   if(s.pct!=null)rows.push([{text:`อยู่ในเกณฑ์ ${s.ok} ครั้ง จาก ${s.n} ครั้ง คิดเป็นร้อยละ ${f2(s.pct)}`,b:1,al:"c",span:W}]);
   const widths=W===5?[900,2900,1600,1700,1206]:W===4?[900,3400,2000,2006]:[900,4400,3006];
   c4.push(cap,{t:"table",w:widths,rows,head:1});const ch=lineChart(s.rows.map(r=>+r.value),s.target,s.tol,p.unit,`ค่าที่วัดได้ ด้าน${p.name}`);if(ch){c4.push(img(ch));const fc=ctx.fig(4,`ค่าที่วัดได้จากการทดสอบด้าน${p.name}`);c4.push(fc)}
   c4.push(P(`จากตารางที่ ${cap.no} ${G.perfResult(p)}`,{before:120}))}
  else if(s.n){const cap=ctx.tab(4,`ผลการทดสอบประสิทธิภาพการทำงานของ${n} ด้าน${p.name}`);const rows=[[{text:"ครั้งที่",b:1,al:"c"},{text:"รายการทดสอบ",b:1,al:"c"},{text:"ผลที่คาดหวัง",b:1,al:"c"},{text:"ผลที่ได้",b:1,al:"c"},{text:"ผล",b:1,al:"c"}]];
   p.rows.filter(r=>r.item||r.act).forEach((r,j)=>rows.push([{text:String(j+1),al:"c"},r.item||"",r.exp||"",r.act||"",{text:r.pass?"ผ่าน":"ไม่ผ่าน",al:"c"}]));
   rows.push([{text:`ผ่าน ${s.ok} ครั้ง จาก ${s.n} ครั้ง คิดเป็นร้อยละ ${f2(s.pct)}`,b:1,al:"c",span:5}]);c4.push(cap,{t:"table",w:[900,2700,1800,1800,1100],rows,head:1},P(`จากตารางที่ ${cap.no} ${G.perfResult(p)}`,{before:120}))}
  else c4.push(P(G.perfResult(p)))});
 const ev=(S.data.evidence||[]).filter(x=>x&&x.src);if(ev.length){c4.push(sub(`4.2.${S.ch3.perf.length+1} ภาพหลักฐานการทดสอบ`,1));ev.forEach(x=>{c4.push(img(x,380),ctx.fig(4,x.cap||`การทดสอบ${n}`))})}
 const T=satStats();c4.push(ctx.h(`4.3 ผลการศึกษาความพึงพอใจของผู้ใช้งานที่มีต่อ${n}`,1),sub("4.3.1 ข้อมูลทั่วไปของผู้ตอบแบบสอบถาม",1),...demoTable(ctx,4,S.data.userDemo,"ผู้ตอบแบบสอบถาม"));
 c4.push(sub(`4.3.2 ความพึงพอใจของผู้ใช้งานที่มีต่อ${n}`,1));
 if(T.n){const cap=ctx.tab(4,`ความพึงพอใจของผู้ใช้งานที่มีต่อ${n} (n = ${T.n})`);c4.push(cap,scoreTable(null,T.total,"sat",T.aspects));
  c4.push(img(barChart([...T.aspects.map(a=>a.name),"รวม"],[...T.aspects.map(a=>a.mean),T.total.mean],"ค่าเฉลี่ยความพึงพอใจรายด้าน (รวม)")));const fc=ctx.fig(4,`ความพึงพอใจของผู้ใช้งานที่มีต่อ${n}`);c4.push(fc,P(`จากตารางที่ ${cap.no} และภาพที่ ${fc.no} ${G.userResult()}`))}
 else c4.push(P(G.userResult()));
 c4.push(sub(`4.3.3 ความคิดเห็นและข้อเสนอแนะอื่น ๆ ของผู้ใช้งานที่มีต่อ${n} สรุปได้ดังนี้`,1),...commentBlocks(S.data.userComments,"ผู้ใช้งาน",T.n));
 ch.c4=c4;
 /* ---- chapter 5 ---- */
 const c5=[{t:"h1c",lines:["บทที่ 5","สรุปผลการวิจัย อภิปรายผล และข้อเสนอแนะ"],bm:"ch5"}];ctx.toc.push({text:"บทที่ 5 สรุปผลการวิจัย อภิปรายผล และข้อเสนอแนะ",lvl:0,bm:"ch5"});
 c5.push(P(`การศึกษาวิจัยครั้งนี้ มีวัตถุประสงค์เพื่อ${V()}${n} ทดสอบประสิทธิภาพของ${n} และศึกษาความพึงพอใจของผู้ใช้งานที่มีต่อ${n} สามารถสรุปผลการวิจัย อภิปรายผล และข้อเสนอแนะ ดังนี้`),sub("5.1 สรุปผลการวิจัย",1),sub("5.2 อภิปรายผล",1),sub("5.3 ข้อเสนอแนะ",1));
 c5.push(ctx.h("5.1 สรุปผลการวิจัย",1),P(G.summary()),ctx.h("5.2 อภิปรายผล",1),...G.discuss().map(t=>P(t)),ctx.h("5.3 ข้อเสนอแนะ",1),
  sub("5.3.1 ข้อเสนอแนะในการนำผลการวิจัยไปใช้",1),...(S.ch5.use.filter(Boolean).length?S.ch5.use.filter(Boolean):G.useDraft()).map((t,i)=>sub(`5.3.1.${i+1} ${t}`,2)),
  sub("5.3.2 ข้อเสนอแนะเพื่อการวิจัยครั้งต่อไป",1),...(S.ch5.next.filter(Boolean).length?S.ch5.next.filter(Boolean):G.nextDraft()).map((t,i)=>sub(`5.3.2.${i+1} ${t}`,2)));
 ch.c5=c5;
 return ch}

function buildBack(ctx){
 const n=N();const bib=[{t:"p",text:"บรรณานุกรม",align:"c",b:1,size:36,ind:0,bm:"bib",after:240}];ctx.toc.push({text:"บรรณานุกรม",lvl:0,bm:"bib"});
 const R=allRefs();if(R.th.length){bib.push({t:"p",text:"บรรณานุกรมภาษาไทย",b:1,ind:0});R.th.forEach(r=>bib.push({t:"p",runs:refRuns(r),hang:720,ind:0}))}
 if(R.en.length){bib.push({t:"p",text:"บรรณานุกรมภาษาต่างประเทศ",b:1,ind:0,before:200});R.en.forEach(r=>bib.push({t:"p",runs:refRuns(r),hang:720,ind:0}))}
 if(!R.th.length&&!R.en.length)bib.push(P("(เพิ่มรายการอ้างอิงในขั้นตอน \"บทที่ 2\")"));
 const divider=(title,bm,lines)=>{ctx.toc.push({text:title,lvl:1,bm});return[{t:"blank",n:8},{t:"p",text:title,align:"c",b:1,size:40,ind:0,bm},...lines.map(l=>({t:"p",text:"- "+l,align:"c",ind:0}))]};
 const app=[{t:"blank",n:12},{t:"p",text:"ภาคผนวก",align:"c",b:1,size:40,ind:0,bm:"app"}];ctx.toc.push({text:"ภาคผนวก",lvl:0,bm:"app"});
 const A=[...divider("ภาคผนวก ก","appA",["แบบเสนอโครงงานและคำร้อง คพ.01 – คพ.08"]),{t:"br"},{t:"p",text:"(แทรกสำเนาแบบ คพ.01 – คพ.08 ที่ลงนามเรียบร้อยแล้วในหน้านี้)",align:"c",ind:0,ph:1}];
 const man=S.manual;const B=[...divider("ภาคผนวก ข","appB",[`คู่มือการใช้งาน${n}`]),{t:"br"},{t:"p",text:"คู่มือการใช้งาน",align:"c",b:1,size:36,ind:0},{t:"p",text:n,align:"c",b:1,size:36,ind:0,after:200}];
 if(S.ch3.photo)B.push(img(S.ch3.photo,320));
 B.push({t:"p",text:"คุณลักษณะเฉพาะ",b:1,ind:0},...(man.spec.length?man.spec:["(ระบุคุณลักษณะเฉพาะ)"]).map((s,i)=>sub(`${i+1}. ${s}`,1)),{t:"p",text:"วิธีการใช้งาน",b:1,ind:0,before:120},...(man.steps.length?man.steps:["(ระบุขั้นตอนการใช้งาน)"]).map((s,i)=>sub(`${i+1}. ${s}`,1)),{t:"p",text:"ข้อควรระวัง",b:1,ind:0,before:120},...(man.caution.length?man.caution:["(ระบุข้อควรระวัง)"]).map((s,i)=>sub(`${i+1}. ${s}`,1)));
 const C=[...divider("ภาคผนวก ค","appC",["รายชื่อผู้เชี่ยวชาญ","แบบสอบถามความคิดเห็นของผู้เชี่ยวชาญ","ผลการหาค่าดัชนีความสอดคล้อง (IOC)","แบบสอบถามความพึงพอใจของผู้ใช้งาน"]),{t:"br"},{t:"p",text:"รายชื่อผู้เชี่ยวชาญตรวจสอบคุณภาพของเครื่องมือวิจัย",align:"c",b:1,size:36,ind:0,after:200}];
 (S.data.experts.length?S.data.experts:[{}]).forEach((e,i)=>C.push(sub(`${i+1}. ${ph(e.name,"ชื่อ-สกุล")}`,1),sub(`ตำแหน่ง ${ph(e.pos,"ตำแหน่ง")} ${e.org||""}`,2)));
 C.push({t:"br"},...questionnaireExpert(),{t:"br"},...iocTable(),{t:"br"},...questionnaireUser());
 const D=[...divider("ภาคผนวก ง","appD",["ภาพกิจกรรมการดำเนินการ"]),{t:"br"}];
 if(S.photos.length)S.photos.forEach(p=>D.push(img(p,380),{t:"p",text:p.cap||"",align:"c",ind:0,after:200}));else D.push({t:"p",text:"(อัปโหลดภาพกิจกรรมในขั้นตอน \"ส่วนหน้าและภาคผนวก\")",align:"c",ind:0,ph:1});
 const bio=[];ctx.toc.push({text:"ประวัติผู้วิจัย",lvl:0,bm:"bio"});
 (members().length?members():[S.members[0]]).forEach((m,i)=>{if(i)bio.push({t:"br"});bio.push({t:"p",text:"ประวัติผู้วิจัย",align:"c",b:1,size:36,ind:0,bm:i?undefined:"bio",after:200});
  if(m.photo)bio.push(img(m.photo,110));else bio.push({t:"p",text:"(ภาพถ่าย 1.5 นิ้ว)",align:"c",ind:0,ph:1});
  bio.push({t:"table",nb:true,w:[3000,5300],rows:[["ชื่อ - นามสกุล (ภาษาไทย)",ph(memberName(m),"ชื่อ-สกุล")],["Name – Surname (ภาษาอังกฤษ)",ph(m.nameEn,"ชื่อภาษาอังกฤษ")],
   ["ระดับการศึกษา",`${S.info.level}. ชั้นปีที่ ${S.info.year||"..."}`],["สาขาวิชา",`${ph(S.info.major,"สาขาวิชา")} สาขางาน ${ph(S.info.track,"สาขางาน")}`],["ที่อยู่ที่ติดต่อได้สะดวก",ph(m.address,"ที่อยู่")],["โทรศัพท์",ph(m.phone,"เบอร์โทร")],["E-mail",ph(m.email,"อีเมล")]]})});
 return{bib,app,A,B,C,D,bio}}

function questionnaireExpert(){const n=N();const out=[{t:"p",text:`แบบสอบถามความคิดเห็นของผู้เชี่ยวชาญที่มีต่อ${n}`,align:"c",b:1,size:36,ind:0,after:120},
 P(`คำชี้แจง แบบสอบถามฉบับนี้จัดทำขึ้นเพื่อสอบถามความคิดเห็นของผู้เชี่ยวชาญที่มีต่อ${n} แบ่งออกเป็น 3 ตอน ได้แก่ ตอนที่ 1 ข้อมูลทั่วไป ตอนที่ 2 ความคิดเห็นต่อ${n} และตอนที่ 3 ความคิดเห็นและข้อเสนอแนะอื่น ๆ`),
 {t:"p",text:"ตอนที่ 1 ข้อมูลทั่วไปของผู้ตอบแบบสอบถาม",b:1,ind:0,before:120}];
 S.data.expertDemo.forEach((g,i)=>out.push(sub(`${i+1}. ${g.q}   ${parseCounts(g.text).map(o=>"☐ "+o.label).join("   ")||"☐ ..........   ☐ .........."}`,1)));
 out.push({t:"p",text:`ตอนที่ 2 ความคิดเห็นของผู้เชี่ยวชาญที่มีต่อ${n}`,b:1,ind:0,before:120},P("โปรดทำเครื่องหมาย ✓ ลงในช่องที่ตรงกับความคิดเห็นของท่าน (5 = มากที่สุด, 4 = มาก, 3 = ปานกลาง, 2 = น้อย, 1 = น้อยที่สุด)"));
 out.push(likertForm(S.ch3.expertItems.map((t,i)=>`${i+1}. ${t}`)));
 out.push({t:"p",text:"ตอนที่ 3 ความคิดเห็นและข้อเสนอแนะอื่น ๆ",b:1,ind:0,before:120},...[1,2,3].map(()=>({t:"p",text:"..................................................................................................................................",ind:0})),
  {t:"p",text:"ลงชื่อ.......................................................ผู้เชี่ยวชาญ",align:"r",ind:0,before:300},{t:"p",text:"(.......................................................)",align:"r",ind:0});return out}
function likertForm(lines,groups){const rows=[[{text:"รายการประเมิน",b:1,al:"c",rowSpan:2},{text:"ระดับความคิดเห็น",b:1,al:"c",span:5}],[5,4,3,2,1].map(x=>({text:String(x),b:1,al:"c"}))];
 if(groups)groups.forEach(g=>{rows.push([{text:g.name,b:1,span:6}]);g.items.forEach(t=>rows.push([t,"","","","",""]))});else lines.forEach(t=>rows.push([t,"","","","",""]));
 return{t:"table",w:[5300,600,600,600,600,600],rows,head:2}}
function questionnaireUser(){const n=N();const out=[{t:"p",text:`แบบสอบถามความพึงพอใจของผู้ใช้งานที่มีต่อ${n}`,align:"c",b:1,size:36,ind:0,after:120},
 P(`คำชี้แจง แบบสอบถามฉบับนี้จัดทำขึ้นเพื่อศึกษาความพึงพอใจของผู้ใช้งานที่มีต่อ${n} ข้อมูลที่ได้จะนำไปใช้ในการพัฒนาผลงานเท่านั้น`),{t:"p",text:"ตอนที่ 1 ข้อมูลทั่วไปของผู้ตอบแบบสอบถาม",b:1,ind:0,before:120}];
 S.data.userDemo.forEach((g,i)=>out.push(sub(`${i+1}. ${g.q}   ${parseCounts(g.text).map(o=>"☐ "+o.label).join("   ")||"☐ ..........   ☐ .........."}`,1)));
 out.push({t:"p",text:`ตอนที่ 2 ความพึงพอใจของผู้ใช้งานที่มีต่อ${n}`,b:1,ind:0,before:120},P("โปรดทำเครื่องหมาย ✓ ลงในช่องที่ตรงกับความพึงพอใจของท่าน (5 = มากที่สุด, 4 = มาก, 3 = ปานกลาง, 2 = น้อย, 1 = น้อยที่สุด)"));
 let c=0;out.push(likertForm(null,S.ch3.sat.map(a=>({name:a.name,items:a.items.map(t=>`${++c}. ${t}`)}))));
 out.push({t:"p",text:"ตอนที่ 3 ความคิดเห็นและข้อเสนอแนะอื่น ๆ",b:1,ind:0,before:120},...[1,2,3].map(()=>({t:"p",text:"..................................................................................................................................",ind:0})));return out}
function iocItems(){const out=[];S.ch3.sat.forEach(a=>a.items.forEach(t=>out.push(t)));return out}
function iocForm(){const n=N();const rows=[[{text:"ข้อ",b:1,al:"c",rowSpan:2},{text:"รายการคำถาม",b:1,al:"c",rowSpan:2},{text:"ความคิดเห็น",b:1,al:"c",span:3},{text:"ข้อเสนอแนะ",b:1,al:"c",rowSpan:2}],[{text:"+1",b:1,al:"c"},{text:"0",b:1,al:"c"},{text:"-1",b:1,al:"c"}]];
 iocItems().forEach((t,i)=>rows.push([{text:String(i+1),al:"c"},t,"","","",""]));
 return[{t:"p",text:"แบบประเมินความสอดคล้องของแบบสอบถามเพื่อใช้ในงานวิจัย (สำหรับผู้เชี่ยวชาญ)",align:"c",b:1,size:36,ind:0},{t:"p",text:`เรื่อง แบบสอบถามความพึงพอใจของผู้ใช้งานที่มีต่อ${n}`,align:"c",ind:0,after:120},
  P("คำชี้แจง โปรดพิจารณาความสอดคล้องของข้อคำถามกับวัตถุประสงค์ แล้วทำเครื่องหมาย ✓ ในช่อง +1 = สอดคล้อง  0 = ไม่แน่ใจ  -1 = ไม่สอดคล้อง"),{t:"table",w:[600,4300,600,600,600,1600],rows,head:2},
  {t:"p",text:"ลงชื่อ.......................................................ผู้เชี่ยวชาญ",align:"r",ind:0,before:300},{t:"p",text:"(.......................................................)",align:"r",ind:0}]}
function iocTable(){const R=iocStats(),items=iocItems();const ne=Math.max(1,...R.map(r=>r.r.length));const n=N();
 const head1=[{text:"ข้อ",b:1,al:"c",rowSpan:2},{text:"รายการคำถาม",b:1,al:"c",rowSpan:2},{text:"ผู้เชี่ยวชาญคนที่",b:1,al:"c",span:ne},{text:"ΣR",b:1,al:"c",rowSpan:2},{text:"IOC",b:1,al:"c",rowSpan:2},{text:"แปลผล",b:1,al:"c",rowSpan:2}];
 const head2=Array.from({length:ne},(_,i)=>({text:String(i+1),b:1,al:"c"}));const rows=[head1,head2];
 if(!R.length)rows.push([{text:"(กรอกคะแนน IOC ในขั้นตอน \"ผลการเก็บข้อมูล\")",span:ne+5}]);
 R.forEach((r,i)=>rows.push([{text:String(i+1),al:"c"},items[i]||"",...Array.from({length:ne},(_,j)=>({text:r.r[j]==null?"":(r.r[j]>0?"+1":String(r.r[j])),al:"c"})),{text:String(r.sum),al:"c"},{text:f2(r.ioc),al:"c"},{text:r.ioc>=0.5?"ใช้ได้":"ปรับปรุง",al:"c"}]));
 const fixed=600+900+900+1100;const rest=8306-fixed-ne*500;
 return[{t:"p",text:`ผลการหาค่าดัชนีความสอดคล้อง (IOC) ของแบบสอบถามความพึงพอใจของผู้ใช้งานที่มีต่อ${n}`,align:"c",b:1,ind:0,after:120},{t:"table",w:[600,rest,...Array(ne).fill(500),900,900,1100],rows,head:2,size:28},
  P("เกณฑ์ ข้อคำถามที่มีค่า IOC ตั้งแต่ 0.50 ขึ้นไป ถือว่าใช้ได้ ข้อที่มีค่าต่ำกว่า 0.50 ต้องปรับปรุงแก้ไข",{before:120})]}

function buildFront(ctx){
 const n=N(),ms=members();const lines=ms.length?ms:[{prefix:"",first:"(ชื่อ-สกุล)",last:"",sid:""}];
 const advisors=[S.advisors.main,S.advisors.co].filter(Boolean);
 const cover=(inner)=>[{t:"p",text:"รายงานผลการวิจัย",align:"c",b:1,size:40,ind:0,before:720,after:320},{t:"p",text:ph(S.info.titleTh,"ชื่องานวิจัยภาษาไทย"),align:"c",b:1,size:40,ind:0},{t:"p",text:ph(S.info.titleEn,"ชื่องานวิจัยภาษาอังกฤษ"),align:"c",b:1,size:40,ind:0,after:inner?700:900},
  ...lines.map(m=>({t:"p",text:`${memberName(m)}   รหัสนักศึกษา ${m.sid||"..........."}`,align:"c",b:1,size:40,ind:0})),
  {t:"p",text:`ระดับชั้น ${classLabel()}`,align:"c",b:1,size:40,ind:0,before:inner?600:700},{t:"p",text:`สาขาวิชา${ph(S.info.major,"สาขาวิชา")} สาขางาน${ph(S.info.track,"สาขางาน")}${S.info.room?" ห้อง "+S.info.room:""}`,align:"c",b:1,size:40,ind:0},
  {t:"p",text:"ครูที่ปรึกษา",align:"c",b:1,size:40,ind:0,before:320},...(advisors.length?advisors:["(ชื่อครูที่ปรึกษา)"]).map(a=>({t:"p",text:a,align:"c",b:1,size:40,ind:0})),
  ];
 const coverFoot=[{t:"p",text:`${S.info.college} ${S.info.inst}`,align:"c",b:1,size:36,ind:0},{t:"p",text:"สำนักงานคณะกรรมการการอาชีวศึกษา กระทรวงศึกษาธิการ",align:"c",b:1,size:36,ind:0},{t:"p",text:`ปีการศึกษา ${S.info.acadYear}`,align:"c",b:1,size:36,ind:0}];
 const kv=(rows)=>({t:"table",nb:true,w:[2200,6100],rows:rows.map(r=>[{text:r[0],b:1},r[1]])});
 const absTh=[kv([["หัวข้อวิจัย",ph(S.info.titleTh,"ชื่อเรื่อง")],["ผู้จัดทำ",lines.map(memberName).join("\n")],["ครูที่ปรึกษา",ph(S.advisors.main,"ชื่อครูที่ปรึกษา")],...(S.advisors.co?[["ครูที่ปรึกษาร่วม",S.advisors.co]]:[]),["หน่วยงาน",`สาขาวิชา${ph(S.info.major,"สาขาวิชา")} ${S.info.college}`],["ปี พ.ศ.",S.info.finishYear||S.info.acadYear]]),
  {t:"blank",n:1},{t:"p",text:"บทคัดย่อ",align:"c",b:1,size:36,ind:0,bm:"abth",after:240},...paras(S.front.absTh||G.absTh()).map(p=>Object.assign(p,{ind:720})),{t:"p",text:`คำสำคัญ : ${ph(S.info.kwTh,"คำสำคัญ 3–5 คำ")}`,ind:0,before:240}];
 const absEn=[kv([["Research Title",ph(S.info.titleEn,"English title")],["Researcher",lines.map(m=>m.nameEn||"(English name)").join("\n")],["Research Consultants",[S.advisors.mainEn,S.advisors.coEn].filter(Boolean).join("\n")||"(Advisor name)"],["Organization",`Major Field of ${ph(S.info.majorEn,"Major")}, Samutprakarn Technical College`],["Year",String((+S.info.finishYear||2569)-543)]]),
  {t:"blank",n:1},{t:"p",text:"Abstract",align:"c",b:1,size:36,ind:0,bm:"aben",after:240},...paras(S.front.absEn||G.absEn()).map(p=>Object.assign(p,{ind:720})),{t:"p",text:`Keywords: ${ph(S.info.kwEn,"keywords")}`,ind:0,before:240}];
 const ack=[{t:"p",text:"กิตติกรรมประกาศ",align:"c",b:1,size:36,ind:0,bm:"ack",after:240},...paras(S.front.ack||G.ack()).map(p=>Object.assign(p,{ind:720})),{t:"p",text:"คณะผู้จัดทำ",align:"r",ind:0,before:360},{t:"p",text:S.front.ackDate?thaiDate(S.front.ackDate):"วันที่ ...........................",align:"r",ind:0}];
 const front=[{text:"บทคัดย่อภาษาไทย",lvl:0,bm:"abth"},{text:"บทคัดย่อภาษาอังกฤษ",lvl:0,bm:"aben"},{text:"กิตติกรรมประกาศ",lvl:0,bm:"ack"},{text:"สารบัญ",lvl:0,bm:"toc"},{text:"สารบัญตาราง",lvl:0,bm:"lot"},{text:"สารบัญภาพ",lvl:0,bm:"lof"}];
 const toc=[{t:"p",text:"สารบัญ",align:"c",b:1,size:36,ind:0,bm:"toc",after:240},{t:"toc",head:"หน้า",items:[...front,...ctx.toc]}];
 const lot=[{t:"p",text:"สารบัญตาราง",align:"c",b:1,size:36,ind:0,bm:"lot",after:240},{t:"toc",head:"ตารางที่                                                                                       หน้า",items:ctx.tabs.map(x=>({text:`${x.no}   ${x.text}`,lvl:0,bm:x.bm}))}];
 const lof=[{t:"p",text:"สารบัญภาพ",align:"c",b:1,size:36,ind:0,bm:"lof",after:240},{t:"toc",head:"ภาพที่                                                                                          หน้า",items:ctx.figs.map(x=>({text:`${x.no}   ${x.text}`,lvl:0,bm:x.bm}))}];
 return{cover:[...cover(false),{t:"blank",n:2},...coverFoot.map(b=>Object.assign({pvonly:1},b))],inner:[...cover(true),{t:"blank",n:2},...coverFoot.map(b=>Object.assign({pvonly:1},b))],coverFoot,absTh,absEn,ack,toc,lot,lof}}

function buildReport(){const ctx=Ctx();const ch=buildChapters(ctx);const back=buildBack(ctx);const fr=buildFront(ctx);
 return{ch,back,fr,ctx,sections:[
  {num:"none",foot:fr.coverFoot,blocks:fr.cover},{num:"none",blocks:[{t:"blank",n:1}]},
  {num:"thai",start:1,hideFirst:true,firstFoot:fr.coverFoot,blocks:[...fr.inner,{t:"br"},...fr.absTh,{t:"br"},...fr.absEn,{t:"br"},...fr.ack,{t:"br"},...fr.toc,{t:"br"},...fr.lot,{t:"br"},...fr.lof]},
  {num:"dec",start:1,hideFirst:true,blocks:ch.c1},{num:"dec",hideFirst:true,blocks:ch.c2},{num:"dec",hideFirst:true,blocks:ch.c3},{num:"dec",hideFirst:true,blocks:ch.c4},{num:"dec",hideFirst:true,blocks:ch.c5},
  {num:"dec",hideFirst:true,blocks:back.bib},{num:"dec",hideFirst:true,blocks:[...back.app,{t:"br"},...back.A,{t:"br"},...back.B,{t:"br"},...back.C,{t:"br"},...back.D]},{num:"dec",hideFirst:true,blocks:back.bio}]}}

/* ============ forms คพ. (layout follows the handbook's sample forms) ============ */
const LOGO={src:"data:image/jpeg;base64,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",w:115,h:115};
const box=c=>c?"☑":"❑";
const dots=n=>".".repeat(n);
const fv=(x,n=30)=>x&&String(x).trim()?String(x).trim():dots(n);
const L=(text,left=0,o={})=>Object.assign({t:"p",text,ind:left,left:0,after:20,align:"l",keep:/^\d+\.\d+(\.\d+)?\s/.test(String(text))&&String(text).length<34?1:0},o);
const LR=(runs,left=0,o={})=>Object.assign({t:"p",runs,ind:0,left,after:20,align:"l"},o);
const HB=(no,title,rest)=>LR([{text:`${no}. ${title}`,b:1},...(rest?[{text:"  "+rest}]:[])],0,{before:240,keep:1});
function dateLine(iso){if(!iso)return `วันที่ ${dots(8)} เดือน ${dots(22)} พ.ศ. ${dots(10)}`;const d=new Date(iso+"T00:00");return `วันที่ ${d.getDate()} เดือน ${MONTHS[d.getMonth()]} พ.ศ. ${d.getFullYear()+543}`}
const leader=()=>{const ms=members();return ms[+S.info.rep||0]||ms[0]||S.members[0]};
const teacherName=()=>S.advisors.teacher||S.advisors.main;
function formTop(code,who,titleLines){return[
 {t:"table",nb:true,align:"r",w:[2900],rows:[[{text:`แบบ ${code}`,b:1,al:"c"}],[{text:`(สำหรับ${who})`,al:"c",size:24}]]},
 /* one row (logo | title lines): no merged cells, so Word draws every border of the box */
 {t:"table",w:[1300,7000],rows:[[{img:{...LOGO,width:64},vc:1},{text:titleLines.join("\n"),b:1,al:"c",size:36,vc:1}]],rowH:1500,after:60}]}
const deptLine=()=>`แผนกวิชา ${fv(S.info.dept,28)}  สาขาวิชา ${fv(S.info.major,28)}`;
const classLine2=()=>`ระดับชั้น ${fv(S.info.level?S.info.level+".":"",16)}  ปีที่ ${fv(S.info.year,8)}  กลุ่ม ${fv(S.info.group,16)}`;
const memberList=()=>{const m=members();return m.length?m:[{},{},{}]};
const memberLine=(m,label)=>`${label} ${fv(memberName(m),36)} รหัส ${fv(m.sid,16)} สาขาวิชา${fv(S.info.major,22)}`;
function commentBox(o={}){const blank=`${dots(48)}\n${dots(48)}`;const sig=`\nลงนาม ${dots(38)}\n(${dots(38)})\n......../......../........`;
 if(o.wide){const bl=`${dots(68)}\n${dots(68)}`,sg=`\nลงนาม ${dots(42)}\n(${dots(42)})\n.........../............./.................`;
  return{t:"table",w:[4150,4150],rows:[[{text:"ความเห็นครูผู้สอนวิชาโครงงาน",b:1},{runs:[{text:"ความเห็นหัวหน้าแผนกวิชา"},{text:"\u00a0"+(S.info.dept||"\u00a0".repeat(30))+"",ud:1}],text:"ความเห็นหัวหน้าแผนกวิชา"+(S.info.dept||dots(24)),b:1}],[{text:bl+sg,al:"c"},{text:bl+sg,al:"c"}]],before:160,keep:1}}
 return{t:"table",w:[4150,4150],rows:[[{text:"ความเห็นครูผู้สอนรายวิชาโครงงาน",b:1},{text:"ความเห็นหัวหน้าแผนกวิชา"+(S.info.dept?S.info.dept:dots(24)),b:1}],[{text:blank+sig,al:"c"},{text:blank+sig,al:"c"}]],before:100,keep:1}}
/* Signature lines: "ลงชื่อ | dotted line | role". The name and the date sit centred under the dotted line. */
/* Signature lines as in the handbook: "ลงชื่อ.......role" as one run of text; the name and the date are centred under the dotted part. */
function signGrid(name,role,o={}){const X=o.X??3820,lw=480,n=o.n??47,dw=Math.round(2630*n/47);const right=Math.max(0,9026-X-lw-dw); /* form text width (9026 twips) */
 const under=(text)=>({t:"p",text,left:X+lw,right,ind:0,align:"c",after:0,keep:1});
 const out=[L(`ลงชื่อ${dots(n)}${role}`,X,{before:o.before??60,after:0,keep:1}),under(`(${name||dots(n-3)})`)];
 if(o.date)out.push(under(o.date===true?"........../.................../............":o.date));
 return out}
function signLeader(o={}){return signGrid(memberName(leader()),"หัวหน้าโครงงานวิจัย",o)}
function addrBlock(){return[L(`แผนกวิชา ${fv(S.info.dept,30)}`,4320),L(`สาขาวิชา ${fv(S.info.major,30)}`,4320),L(S.info.college,4320),L(dateLine(""),2880,{before:40,after:80})]}

function kp01(){const n=N();const T=S.info.types;const b=formTop("คพ.01","นักเรียน นักศึกษา",[`แบบเสนอโครงงานวิจัย รายวิชาโครงงาน ประจำปีการศึกษา ${S.info.acadYear}`,deptLine(),classLine2()]);
 {const th=String(S.info.titleTh||"").trim(),en=String(S.info.titleEn||"").trim();
  /* English name in brackets right after the Thai name (unless the student already typed it there) */
  b.push(HB(1,"ชื่อโครงงาน",th?(en&&!th.includes(en)?`${th} (${en})`:th):fv("",80)+(en?` (${en})`:"")))}
 b.push(HB(2,"ประเภทของโครงงาน","(ให้ทำเครื่องหมาย ✓ ลงในประเภทโครงงานวิชาชีพให้ถูกต้อง)"));
 const C=(k,l,left,bold)=>LR([{text:`${box(k===true||T.includes(k))}  ${l}`,b:bold?1:0}],left);
 b.push(C(T.some(x=>x.startsWith("r_")),"2.1 ประเภทงานวิจัย",720,1),C("r_basic","การวิจัยพื้นฐาน (basic research)",1080),C("r_applied","การวิจัยประยุกต์ (applied research)",1080),C("r_rd","การวิจัยและพัฒนา (research and development)",1080),
  C(T.some(x=>/^i\d|sdg/.test(x)),"2.2 ประเภทสิ่งประดิษฐ์ตอบสนองนโยบายสำนักงานคณะกรรมการการอาชีวศึกษา",720,1),LR([{text:"2.2.1 โครงงานประเภทสิ่งประดิษฐ์ของคนรุ่นใหม่",b:1}],1080),
  ...[["i1","ประเภทที่ 1  สิ่งประดิษฐ์ด้านนวัตกรรมและเทคโนโลยีการเกษตร อุตสาหกรรมสมัยใหม่"],["i2","ประเภทที่ 2  สิ่งประดิษฐ์ด้านนวัตกรรมและเทคโนโลยีดิจิทัล ปัญญาประดิษฐ์"],["i3","ประเภทที่ 3  สิ่งประดิษฐ์ด้านนวัตกรรมและเทคโนโลยีพลังงาน สิ่งแวดล้อม"],
   ["i4","ประเภทที่ 4  สิ่งประดิษฐ์ด้านนวัตกรรมและเทคโนโลยีอาหาร"],["i5","ประเภทที่ 5  สิ่งประดิษฐ์ด้านนวัตกรรมและเทคโนโลยีเพื่อสุขภาพ (HEALTH CARE)"],["i6","ประเภทที่ 6  สิ่งประดิษฐ์ด้านนวัตกรรมและเทคโนโลยี ผลิตภัณฑ์เชิงพาณิชย์"]].map(([k,l])=>C(k,l,1080)),
  LR([{text:"2.2.2 โครงงานประเภทโครงงานวิทยาศาสตร์",b:1}],1080),C("sdg","โครงงานวิจัยทดลองและวิจัยพัฒนาที่ยั่งยืน (SDGs)",1080),
  C(T.some(x=>x.startsWith("g_")),"2.3 โครงงานทั่วไป",720,1),C("g_exp","ประเภทโครงงานทดลอง",1080),C("g_inv","ประเภทสิ่งประดิษฐ์ / นวัตกรรม",1080),C("g_sys","ประเภทโครงงานพัฒนาระบบหรือบริการ",1080),C("g_media","ประเภทสื่อการเรียนการสอน",1080),C("g_proj","โครงงานวิจัยโครงการ",1080));
 const ml=memberList();
 b.push(HB(3,"คณะผู้จัดทำ"),...ml.map((m,i)=>{const nm=memberName(m)||"",sid=(m&&m.sid)||"",mj=S.info.major||"";
  return{t:"p",ind:0,left:720,after:20,align:"l",keep:i<ml.length-1?1:0,stops:[4470,6665,8900],
   segs:[{text:`3.${i+1} ${nm}`,tab:1},{text:`รหัส${sid?" "+sid:""}`,tab:1},{text:`สาขาวิชา${mj?" "+mj:""}`,tab:1}],
   text:`3.${i+1} ${fv(nm,36)} รหัส ${fv(sid,16)} สาขาวิชา${fv(mj,22)}`}}));
 b.push(HB(4,"ชื่อครูที่ปรึกษาโครงงาน"),L(`4.1 ครูที่ปรึกษาหลัก ${fv(S.advisors.main,50)}`,720,{keep:1}),L(`4.2 ครูที่ปรึกษาร่วม ${fv(S.advisors.co,50)}`,720));
 b.push(HB(5,"ความเป็นมาและความสำคัญของปัญหา"),...S.ch1.bg.map((p,i)=>P(fv(p,140),{after:40})));
 b.push(HB(6,"วัตถุประสงค์โครงงานพัฒนาทักษะวิชาชีพ"),...objectives().map((o,i)=>L(`6.${i+1} ${o}`,720)));
 b.push(HB(7,"สมมติฐานในการพัฒนาทักษะวิชาชีพ",S.ch1.hypo?"":"(ไม่มี)"),...(S.ch1.hypo?hypotheses().map((o,i)=>L(`7.${i+1} ${o}`,720)):[]));
 b.push(HB(8,"ขอบเขตของการพัฒนาทักษะวิชาชีพ"),P(`8.1 ขอบเขตด้านเนื้อหา ${fv(S.ch1.spec,100)}`,{ind:720,after:40}),L("8.2 ขอบเขตด้านประชากรและกลุ่มตัวอย่าง",720),
  P(`ประชากร ที่ใช้ในการทำโครงงานในครั้งนี้ ได้แก่ ${fv(S.ch1.popUser,40)}`,{ind:1080,after:40}),P(`กลุ่มตัวอย่าง ที่ใช้ในการทำโครงงานในครั้งนี้ ได้แก่ ${fv(S.ch1.sampleUser,30)} จำนวน ${fv(S.ch1.sampleN,6)} คน โดยการ${S.ch1.sampling}`,{ind:1080,after:40}),
  L("8.3 ขอบเขตด้านตัวแปร ประกอบด้วย",720),L(`ตัวแปรต้น ${n}`,1440),L(`ตัวแปรตาม ความคิดเห็นของผู้เชี่ยวชาญ ประสิทธิภาพ และความพึงพอใจของผู้ใช้งานที่มีต่อ${n}`,1440),
  L("8.4 ขอบเขตด้านเวลา",720),L(`ดำเนินการโครงงานพัฒนาทักษะวิชาชีพ ภาคเรียนที่ ${fv(S.info.term,4)} ปีการศึกษา ${S.info.acadYear}`,1440));
 b.push(HB(9,"นิยามศัพท์"),...(S.ch1.terms.length?S.ch1.terms:[{},{},{}]).map((t,i)=>P(`9.${i+1} ${fv(t.t,24)} หมายถึง ${fv(t.d,60)}`,{ind:720,after:40})));
 b.push(HB(10,"วิธีดำเนินการพัฒนาทักษะวิชาชีพ"),
  L(`10.1 การ${V()}นวัตกรรม`,720),P(S.ch3.process||`ดำเนินการ${joinTh(S.ch3.steps.filter(Boolean))}`,{ind:1080,after:40}),
  L("10.2 การกำหนดประชากรและกลุ่มตัวอย่าง",720),P(`ผู้เชี่ยวชาญจำนวน ${S.ch1.expertsN||5} คน ${S.ch3.expertSampling} และ${fv(S.ch1.sampleUser,20)} จำนวน ${fv(S.ch1.sampleN,4)} คน โดยการ${S.ch1.sampling}`,{ind:1080,after:40}),
  L("10.3 การสร้างและหาคุณภาพเครื่องมือที่ใช้ในการวิจัย",720),P("เครื่องมือที่ใช้ ได้แก่ แบบสอบถามความคิดเห็นของผู้เชี่ยวชาญ แบบบันทึกผลการทดสอบประสิทธิภาพ และแบบสอบถามความพึงพอใจ ตรวจสอบคุณภาพด้วยค่าดัชนีความสอดคล้อง (IOC)",{ind:1080,after:40}),
  L("10.4 การเก็บรวบรวมข้อมูล",720),P(`นำ${n}ไปให้ผู้เชี่ยวชาญประเมิน ทดสอบประสิทธิภาพ${perfNames().length?" ด้าน"+joinTh(perfNames()):""} และให้กลุ่มตัวอย่างทดลองใช้แล้วตอบแบบสอบถาม`,{ind:1080,after:40}),
  L("10.5 การวิเคราะห์ข้อมูลและสรุปผล",720),P("วิเคราะห์ข้อมูลด้วยค่าร้อยละ ค่าเฉลี่ย และค่าเบี่ยงเบนมาตรฐาน แปลความหมายตามเกณฑ์ของบุญชม ศรีสะอาด (2556)",{ind:1080,after:40}));
 const ben=S.ch1.benefits.filter(Boolean);b.push(HB(11,"ประโยชน์ที่คาดว่าจะได้รับ"),...(ben.length?ben:["",""]).map((x,i)=>L(`11.${i+1} ${fv(x,70)}`,720)));
 b.push(HB(12,"แผนการดำเนินงาน"),ganttTable(),HB(13,"งบประมาณที่ใช้ในการดำเนินงาน"),budgetTable());
 b.push(HB(14,"หลักวิธีการหรือขั้นตอนการทำงานสิ่งประดิษฐ์"),P(fv(S.principle,200),{after:40}));
 b.push(HB(16,"เอกสารอ้างอิง"));const R=allRefs();[...R.th,...R.en].forEach(r=>b.push({t:"p",runs:refRuns(r),hang:720,ind:0,after:40}));
 const DT="........../.................../............";
 b.push(HB(17,"ผู้เสนอโครงงาน"),...signLeader({before:440,date:DT}));
 b.push(Object.assign(HB(18,"คำรับรองของครูผู้สอนโครงงาน"),{before:880}),P(`ขอรับรองว่าโครงงาน เรื่อง ${fv(S.info.titleTh,60)} เป็นผลงานของนักเรียน นักศึกษาในครั้งนี้ อยู่ในการควบคุมดูแลของข้าพเจ้า`,{after:40,keep:1}),
  ...signGrid(teacherName(),"ครูผู้สอนโครงงาน",{before:640,date:DT}));
 return b}
/* arrow image for the schedule: px = width in Word pixels (1/96"); drawn at 4x for sharp printing */
function arrowImg(px){const W=px*4,H=44,y=H/2,hl=26,hw=14;const src=canvasURL("arrow|"+W,W,H,x=>{x.fillStyle="#fff";x.fillRect(0,0,W,H);x.strokeStyle="#000";x.fillStyle="#000";x.lineWidth=5;
  x.beginPath();x.moveTo(hl-2,y);x.lineTo(W-hl+2,y);x.stroke();
  x.beginPath();x.moveTo(2,y);x.lineTo(hl+2,y-hw);x.lineTo(hl+2,y+hw);x.closePath();x.fill();
  x.beginPath();x.moveTo(W-2,y);x.lineTo(W-hl-2,y-hw);x.lineTo(W-hl-2,y+hw);x.closePath();x.fill()});
 return src?{src:src.src,w:W,h:H,width:px}:null}
function ganttTable(){const months=S.plan.months.split(/[,،]/).map(s=>s.trim()).filter(Boolean);const W=months.length*4;const ww=Math.floor(7260/W);
 const rows=[[{text:"ขั้นตอน\nการดำเนินงาน",b:1,al:"c",rowSpan:2,vc:1},...months.map(m=>({text:m,b:1,al:"c",span:4}))],Array.from({length:W},(_,i)=>({text:String(i%4+1),al:"c",b:1}))];
 /* each run of consecutive weeks is one merged cell with a double-headed arrow across it */
 S.plan.steps.forEach((s,i)=>{const on=new Set((s.w||[]).filter(j=>j>=0&&j<W));const row=[`${i+1}. ${s.name}`];
  for(let j=0;j<W;){if(!on.has(j)){row.push({text:""});j++;continue}let k=j;while(on.has(k))k++;const span=k-j;
   const a=arrowImg(Math.max(8,Math.round((span*ww-170)/15)));row.push(a?{img:a,span,vc:1,arrow:1}:{text:"",span,fill:true});j=k}
  rows.push(row)});
 return{t:"table",w:[2080,...Array(W).fill(ww)],fixed:1,indent:-180,rowH:[420,420,570],rows,head:2,size:32,before:80,keep:1}}
const baht=x=>(+x||0).toLocaleString("th-TH",{minimumFractionDigits:2,maximumFractionDigits:2});
function budgetTable(){const rows=[["ลำดับ","รายการ","จำนวนหน่วย","ราคาต่อหน่วย","จำนวนเงิน","รวมเงิน","หมายเหตุ"].map(t=>({text:t,b:1,al:"c"}))];let tot=0;
 S.budget.forEach((r,i)=>{const s=(+r.qty||0)*(+r.price||0);tot+=s;rows.push([{text:String(i+1),al:"c"},r.item||"",{text:r.qty||"",al:"c"},{text:r.price?baht(r.price):"",al:"r"},{text:baht(s),al:"r"},{text:baht(tot),al:"r"},r.note||""])});
 for(let i=S.budget.length;i<12;i++)rows.push(["","","","","","",""]);
 rows.push([{text:"รวมเงิน",al:"c",span:5,size:36},{text:baht(tot),b:1,al:"r"},""]);
 rows[0].forEach(c=>{c.b=0;c.size=28});return{t:"table",w:[640,2680,1240,1300,1060,880,1560],fixed:1,indent:-180,rowH:[380,480],rows,head:1,size:28,before:80}}
function kpRequest(code,titleLines,subject,bodyPre,body,attach,addr){const m=leader();const others=members().slice(1);
 const b=[...formTop(code,"นักเรียน นักศึกษา",titleLines)];
 if(addr)b.push(...addrBlock());else b.push(L(dateLine(""),2880,{after:200}));
 b.push(LR([{text:"เรื่อง  "},{text:subject}],0),LR([{text:"เรียน  "},{text:"หัวหน้าแผนกวิชา"+(S.info.dept||dots(30))}],0,{after:100}));
 b.push(P(bodyPre,{after:40}),...(others.length?others:[{},{}]).map((x,i)=>L(memberLine(x,`${i+1}.`),720)),...body,P("จึงเรียนมาเพื่อโปรดพิจารณา",{before:60}),...signLeader(),commentBox());
 if(attach)b.push(LR([{text:"หมายเหตุ",b:1,u:1},{text:"  "+attach}],0,{before:80}));return b}
/* คพ.02 laid out as the handbook form (คู่มือ หน้า 20): every answer sits on a dotted line that runs to a fixed column,
   "เรียน" before "เรื่อง", three co-researcher rows, the full closing sentence and the comment box with full-width dotted lines. */
const FW=9026; /* form text width (twips) */
const DL=(segs,left,stops,o={})=>Object.assign({t:"p",ind:left,left:0,after:20,align:"l",stops,segs,
  text:segs.map(g=>g.text+(g.tab?" "+dots(14):"")).join(" ")},o);
function kp02Form(){const lead=leader();const nm=m=>m&&(m.first||m.last)?memberName(m):"";const F=S.forms||{};const ms=members();const others=ms.filter(m=>m!==lead);
 const rows=others.length>=3?others:[...others,...Array.from({length:3-others.length},()=>({}))];
 const lv=S.info.level||"",mark=x=>lv===x?"..✓..":".....";
 const d=F.kp02?new Date(F.kp02+"T00:00"):null;
 /* the answer is written on the dotted line (dotted underline), and the line runs on to the next column */
 const NB="\u00a0",pad=(v,n)=>{v=String(v||"").trim();const k=Math.max(1,Math.round((n-v.length)/2));return NB.repeat(k)+v+NB.repeat(k)};
 const fld=(lab,val)=>({runs:[{text:lab},{text:val?NB+String(val).trim()+NB:NB,ud:1}],tab:1,ud:1});
 const txt=(t)=>({runs:[{text:t}]});
 const UL=(segs,left,stops,o={})=>Object.assign({t:"p",ind:left,left:0,after:20,align:"l",ul:1,stops,segs,
   text:segs.map(g=>g.runs.map(r=>r.text).join("")+(g.tab?dots(12):"")).join(" ")},o);
 const ttl2=[{text:"ระดับชั้น"},{text:pad(lv?lv+".":"",22),ud:1},{text:"ปีที่"},{text:pad(S.info.year,12),ud:1},{text:"กลุ่ม"},{text:pad(S.info.group,20),ud:1}];
 const b=[{t:"table",nb:true,align:"r",w:[2900],rows:[[{text:"แบบ คพ.02",b:1,al:"c"}],[{text:"(สำหรับนักเรียน นักศึกษา)",al:"c",size:24}]]},
  {t:"table",w:[1300,7000],rows:[[{img:{...LOGO,width:64},vc:1},{runs:[{text:"แบบคำร้องขอสอบหัวข้อโครงงานวิจัย  ในรายวิชาโครงงาน\n"},...ttl2],text:"แบบคำร้องขอสอบหัวข้อโครงงานวิจัย ในรายวิชาโครงงาน\n"+classLine2(),b:1,al:"c",size:36,vc:1}]],rowH:1500,after:60}];
 b.push(UL([fld("แผนกวิชา",S.info.dept)],4320,[8300],{before:120}),UL([fld("สาขาวิชา",S.info.major)],4320,[8300]),
  L(S.info.college,4320),
  UL([fld("วันที่",""),fld("เดือน",""),fld("พ.ศ.","")],3780,[4700,7000,8300],{before:120,after:100}),
  UL([fld("เรียน  หัวหน้าแผนกวิชา",S.info.dept)],0,[5200]),
  L("เรื่อง  ขอสอบหัวข้อโครงงานพัฒนาทักษะวิชาชีพ",0,{after:160}),
  UL([fld("ข้าพเจ้า",nm(lead)),txt("หัวหน้าโครงงานวิจัย  พร้อมด้วยผู้ร่วม")],720,[5520]),
  UL([fld("วิจัย  จำนวน",others.length||""),txt("คน  ดังนี้")],0,[2000]),
  ...rows.map((m,i)=>UL([fld(`${i+1}.${NB}${NB}`,nm(m)),fld("รหัส",m.sid),fld("สาขาวิชา",nm(m)?S.info.major:"")],1080,[4700,6700,FW-60])),
  UL([fld("ระดับชั้น",lv?lv+".":""),fld("ปีที่",S.info.year),fld("กลุ่ม",S.info.group),{runs:[{text:"ปีการศึกษา"},{text:pad(S.info.acadYear,12),ud:1}]}],720,[3050,4750,6250]),
  P("มีความประสงค์ขอสอบหัวข้อโครงงานวิจัย    เพื่อเป็นส่วนหนึ่งของการศึกษาในรายวิชา โครงงาน",{before:120,after:20}),
  UL([fld(`ระดับ (${mark("ปวช")}) ปวช. (${mark("ปวส")}) ปวส.  ในวันที่`,d?d.getDate():""),fld("เดือน",d?MONTHS[d.getMonth()]:""),fld("พ.ศ.",d?d.getFullYear()+543:"")],0,[4700,7300,FW-60]),
  UL([fld("ชื่อโครงงานวิจัย  (ภาษาไทย)",S.info.titleTh)],0,[FW-60]),
  UL([fld("(ภาษาอังกฤษ)",S.info.titleEn)],0,[FW-60],{left:1440}),
  UL([fld("ชื่อครูผู้สอนรายวิชาโครงงานพัฒนาทักษะวิชาชีพ",teacherName())],0,[FW-60]),
  UL([fld("ชื่อครูที่ปรึกษาร่วม (ถ้ามี)",S.advisors&&S.advisors.co)],0,[FW-60]),
  P("จึงเรียนมาเพื่อโปรดพิจารณา  ดังรายละเอียดโครงงานวิจัยพัฒนาทักษะวิชาชีพที่แนบมาด้วย",{before:120,after:20}),
  LR([{text:"ลงชื่อ"},{text:NB.repeat(52),ud:1},{text:" (หัวหน้าโครงงานวิจัย)"}],3060,{before:160,after:0,keep:1}),
  {t:"p",runs:[{text:"("},{text:pad(nm(lead),30),ud:1},{text:")"}],ind:0,left:3400,right:1500,align:"c",after:0,keep:1},
  commentBox({wide:true}),
  LR([{text:"หมายเหตุ",b:1,u:1},{text:"  พร้อมนี้ได้แนบโครงงานวิจัย  ตามแบบ คพ.01  ที่ผ่านการอนุมัติแล้ว มาด้วย  จำนวน 1 ชุด"}],0,{before:160}));
 return b}
/* one request form on its own (each คพ. is a separate file) */
const FORM_PART={kp02:0,kp04_1:1,kp04_2:2,kp06:3,kp08:4};
function formOf(k){const parts=[[]];allForms().forEach(x=>x&&x.t==="br"?parts.push([]):parts[parts.length-1].push(x));return parts[FORM_PART[k]]||[]}
function allForms(){const t=fv(S.info.titleTh,70);const F=S.forms;const lead=leader();const tName=fv(teacherName(),40);const out=[];
 out.push(...kp02Form());
 [["kp04a","1"],["kp04b","2"]].forEach(([k,no])=>{out.push({t:"br"},...kpRequest("คพ.04",[`คำร้องขอสอบความก้าวหน้าโครงงานวิจัย ครั้งที่ ${no}`,classLine2()],"ขอสอบรายงานความก้าวหน้าโครงงานวิจัย",
  `ข้าพเจ้า ${fv(memberName(lead),30)} รหัส ${fv(lead.sid,14)} สาขาวิชา ${fv(S.info.major,20)} หัวหน้าผู้จัดทำโครงงาน พร้อมด้วย`,[
  L(`ได้จัดทำโครงงานในภาคเรียนที่ ${fv(S.info.term,4)} ปีการศึกษา ${S.info.acadYear}`,0),L(`ชื่อโครงงาน ${t}`,0),
  P(`มีความประสงค์ขอสอบประเมินความก้าวหน้าในการวิจัย ใน${dateLine(F[k].date)} เวลา ${fv(F[k].time,10)} น. ห้อง ${fv(F[k].room,14)}`,{after:40}),L(`โดยมีครูผู้สอนรายวิชาโครงงาน คือ ${tName}`,0)],null,true))});
 out.push({t:"br"},...kpRequest("คพ.06",["คำร้องขอรับการประเมินผลโครงงานวิจัย",deptLine(),classLine2()],"ขอประเมินผลการวิจัยโดยครูผู้สอน",
  `ข้าพเจ้า ${fv(memberName(lead),40)} หัวหน้าผู้จัดทำโครงงานพร้อมด้วย`,[
  L(`ได้จัดทำโครงงานในภาคเรียนที่ ${fv(S.info.term,4)} ปีการศึกษา ${S.info.acadYear}`,720,{before:80}),L(`ชื่อโครงงาน ${t}`,0),
  P(`บัดนี้ ข้าพเจ้าและคณะได้จัดทำโครงงานเสร็จสิ้นแล้ว จึงขอรับการประเมินผลโครงงานวิจัยดังกล่าว ใน${dateLine(F.kp06.date)} เวลา ${fv(F.kp06.time,10)} น. ณ ห้อง ${fv(F.kp06.room,12)} อาคาร ${fv(F.kp06.bldg,16)}`,{before:120,after:40}),
  L(`โดยมีครูผู้สอนรายวิชาโครงงาน คือ ${tName}`,0),L("พร้อมนี้ได้แนบรายงานผลการวิจัยฉบับสมบูรณ์ (ยังไม่ต้องเข้าเล่ม) จำนวน 1 ชุด",0)],null,false));
 out.push({t:"br"},...formTop("คพ.08","นักเรียน นักศึกษา",["แบบอนุญาตให้เข้าเล่มโครงงาน",deptLine(),classLine2()]),LR([{text:"ชื่อโครงงาน",b:1},{text:"  "+t}],0),
  LR([{text:"รายชื่อนักเรียนที่จัดทำโครงงาน",b:1}],0,{before:120}),...memberList().map((m,i)=>L(memberLine(m,`${i+1}.`),720)),
  P(`ได้จัดทำโครงงานในภาคเรียนที่ ${fv(S.info.term,4)} ปีการศึกษา ${S.info.acadYear} คณะกรรมการประเมินผลโครงงานวิจัยได้ทำการตรวจสอบการปรับปรุง/แก้ไขรายงานผลโครงงานตามที่คณะกรรมการประเมินผลโครงงานแนะนำเรียบร้อยแล้ว และอนุญาตให้นำไปเข้าเล่ม เพื่อจัดทำเล่มรายงานผลโครงงานฉบับสมบูรณ์ได้`,{after:40}),
  L(`ลงชื่อ ${dots(40)} ประธานกรรมการสอบ`,2160,{before:480,align:"c"}),L(`(${dots(40)})`,2160,{align:"c"}),L(`วันที่ ${dots(6)} เดือน ${dots(16)} พ.ศ. ${dots(8)}`,2160,{align:"c",after:480}),
  {t:"table",nb:true,w:[4150,4150],rows:[[{text:`ลงชื่อ ${dots(24)} กรรมการ\n(${dots(24)})\nวันที่ ${dots(5)} เดือน ${dots(12)} พ.ศ. ${dots(6)}`,al:"c"},{text:`ลงชื่อ ${dots(20)} กรรมการ/ครูผู้สอน\n(${dots(24)})\nวันที่ ${dots(5)} เดือน ${dots(12)} พ.ศ. ${dots(6)}`,al:"c"}]]});
 return out}

/* ============ teacher / committee forms คพ.03 05 07 (คู่มือ หน้า 21–22, 25–28, 31–32) ============ */
function TX(){return env.extra||{}}
function rv(kind){return(TX().reviews||{})[kind]||{}}
const resultBoxes=(r,lbl="ผลการสอบ")=>LR([{text:lbl+"   ",b:1},{text:`${box(r==="pass")} ผ่าน     ${box(r==="fix")} ผ่านโดยให้แก้ไข     ${box(r==="fail")} ไม่ผ่าน`}],0,{before:120});
const committee=()=>{const c=TX().committee||[];return[c[0]||"",c[1]||"",c[2]||""]};
function studentList(){return memberList().map((m,i)=>L(`${i+1}. ${fv(memberName(m),36)} รหัส ${fv(m.sid,16)} สาขาวิชา${fv(S.info.major,22)}`,720))}
const commentLines=(text,n=3)=>{const t=String(text||"").trim();return t?[P(t,{after:40})]:Array.from({length:n},()=>L(dots(130),0))};
const sigBlock=(name,role,left=2600)=>[L(`ลงชื่อ ${dots(34)} ${role}`,left,{before:240,align:"c"}),L(`(${name||dots(34)})`,left,{align:"c"}),L(`วันที่ ${dots(6)} เดือน ${dots(16)} พ.ศ. ${dots(8)}`,left,{align:"c"})];
function approvalsBack(code,head){const A=Object.assign({},ADMINS_DEFAULT,TX().admins||{});const ok=head||"เห็นสมควรอนุมัติ";return[{t:"br"},
 LR([{text:"ความเห็นหัวหน้าแผนกวิชา",b:1}],0,{before:120}),L(`☐ ${ok}`,720),L(`☐ อื่น ๆ ${dots(90)}`,720),...sigBlock("",(code==="คพ.07"?"หัวหน้าแผนกวิชา":""),3000),
 LR([{text:"ความเห็นรองผู้อำนวยการฝ่ายยุทธศาสตร์และแผนงาน",b:1}],0,{before:200}),L("เสนอผู้อำนวยการ",720),L(`☐ ${ok}`,720),L(`☐ อื่น ๆ ${dots(90)}`,720),...sigBlock(A.deputy,"",3000),
 LR([{text:"ความเห็นผู้อำนวยการ",b:1}],0,{before:200}),L("☐ อนุมัติ",720),L(`☐ อื่น ๆ ${dots(90)}`,720),...sigBlock(A.director,"",3000),L(`ผู้อำนวยการ${S.info.college}`,3000,{align:"c"})]}
function headerInfo(){return[L(`ชื่อโครงงานวิจัย (ภาษาไทย) ${fv(S.info.titleTh,60)}`,0),L(`ชื่อโครงงานวิจัย (ภาษาอังกฤษ) ${fv(S.info.titleEn,56)}`,0),L("ชื่อนักศึกษา",0),...studentList(),
 L(`ภาคเรียนที่ ${S.info.term||2}/${S.info.acadYear} หลักสูตร ${S.info.level==="ปวส"?"ประกาศนียบัตรวิชาชีพชั้นสูง (ปวส.)":"ประกาศนียบัตรวิชาชีพ (ปวช.)"}`,0)]}
function kp03(){const r=rv("kp03");const c=committee();return[...formTop("คพ.03","ครูผู้สอน",[`แบบสรุปผลการสอบหัวข้อโครงงานวิจัย ครั้งที่ ${r.round||1}`,deptLine(),classLine2()]),...headerInfo(),
 L(`ชื่อครูผู้สอนวิชาโครงงานพัฒนาทักษะวิชาชีพ ${fv(teacherName(),40)}`,0),resultBoxes(r.result),LR([{text:"ความเห็นของกรรมการ",b:1}],0,{before:80}),...commentLines(r.comment),
 LR([{text:"หมายเหตุ",b:1,u:1},{text:" กรณีผลการสอบของนักศึกษา “ผ่านโดยให้แก้ไข” ให้กรรมการแจ้งเหตุผลหรือส่วนที่ต้องแก้ไขไว้ด้วย และให้นักศึกษาส่งแบบเสนอโครงงานวิจัยฉบับสมบูรณ์ที่กรรมการรับรองแล้ว ภายใน 7 วัน นับตั้งแต่วันสอบ จึงถือว่าผลการสอบครั้งนี้สมบูรณ์"}],0,{before:80}),
 ...sigBlock(c[0],"ประธานกรรมการสอบ",2160),{t:"table",nb:true,w:[4150,4150],rows:[[{text:`ลงชื่อ ${dots(24)} กรรมการ\n(${c[1]||dots(24)})\nวันที่ ${dots(16)}`,al:"c"},{text:`ลงชื่อ ${dots(20)} กรรมการ/ครูผู้สอน\n(${c[2]||dots(24)})\nวันที่ ${dots(16)}`,al:"c"}]],before:200},
 ...approvalsBack("คพ.03","เห็นควรอนุมัติ"),LR([{text:"หมายเหตุ",b:1}],0,{before:200}),L("1. ครูผู้สอนส่งเอกสารฉบับนี้ของนักศึกษาทุกกลุ่ม พร้อมแนบ",720),L("1.1 แบบเสนอโครงงานวิจัยของนักศึกษา (แบบ คพ.01)",1080),L("1.2 แบบคำร้องขอสอบหัวข้อโครงงานวิจัย (แบบ คพ.02)",1080),L("2. ครูผู้สอนส่งเอกสารชุดนี้พร้อมเอกสารที่แนบตามข้อ 1 ในสัปดาห์ที่ 4",720)]}
function kp05(round){const r=rv("kp05_"+round);return[...formTop("คพ.05","ครูผู้สอน",[`แบบสรุปผลการประเมินความก้าวหน้าการวิจัย ครั้งที่ ${round}`,deptLine(),classLine2()]),...headerInfo().map(b=>b.text&&b.text.startsWith("ชื่อโครงงานวิจัย")?Object.assign(b,{text:b.text.replace("ชื่อโครงงานวิจัย","ชื่อโครงงาน")}):b),
 L(`ชื่อครูผู้สอนวิชาโครงงาน ${fv(teacherName(),40)}`,0),resultBoxes(r.result,"ผลการประเมิน"),LR([{text:"ความเห็นของครูผู้สอน",b:1}],0,{before:80}),...commentLines(r.comment),
 LR([{text:"หมายเหตุ",b:1,u:1},{text:" กรณีผลการประเมินของนักเรียน “ผ่านโดยให้แก้ไข” ให้ครูผู้สอนแจ้งเหตุผลหรือส่วนที่ต้องแก้ไขไว้ด้วย"}],0,{before:80}),
 ...sigBlock(teacherName(),"",3000),L("ครูผู้สอนวิชาโครงงาน",3000,{align:"c"}),L("(โปรดพลิกด้านหลัง)",0,{align:"r",before:120}),...approvalsBack("คพ.05")]}
function kp05att(round){const r=rv("kp05_"+round);const it=r.items||{},sg=r.sugg||{};const rows=[[{text:"หัวข้อ",b:1,al:"c",rowSpan:2},{text:"ประเด็นพิจารณา",b:1,al:"c",rowSpan:2},{text:"ผลการพิจารณา",b:1,al:"c",span:2},{text:"ข้อเสนอแนะ",b:1,al:"c",rowSpan:2}],[{text:"ผ่าน",b:1,al:"c"},{text:"ปรับปรุง",b:1,al:"c"}]];
 KP05_ITEMS[round].forEach(([ch,items])=>{rows.push([{text:ch,b:1,span:5}]);items.forEach(([no,t])=>rows.push([{text:no,al:"c"},t,{text:it[no]==="pass"?"✓":"",al:"c"},{text:it[no]==="fix"?"✓":"",al:"c"},sg[no]||""]))});
 return[{t:"p",text:"เอกสารแนบ คพ.05",align:"r",b:1,ind:0},{t:"p",text:"แบบประเมินความก้าวหน้าโครงงานวิจัย",align:"c",b:1,size:36,ind:0},{t:"p",text:`ครั้งที่ ${round} (${round===1?"บทที่ 1 – 3":"บทที่ 4 – 5"})`,align:"c",b:1,ind:0,after:120},
  L(`ระดับชั้น ${box(S.info.level==="ปวช")} ปวช.  ${box(S.info.level==="ปวส")} ปวส.   สาขาวิชา ${fv(S.info.major,30)}`,0),L(`โครงงานวิจัย เรื่อง ${fv(S.info.titleTh,60)}`,0),L("โปรดทำเครื่องหมาย ✓ ตามผลการพิจารณาและให้ข้อเสนอแนะ",0,{after:80}),
  {t:"table",w:[700,3900,700,800,2206],rows,head:2,size:28},...(round===2?[LR([{text:"ข้อเสนอแนะอื่น ๆ",b:1}],0,{before:120}),...commentLines(r.other,2)]:[]),...sigBlock(teacherName(),"ผู้สอน",3000)]}
function kp07(){const r=rv("kp07");const c=committee();return[...formTop("คพ.07","คณะกรรมการ",["แบบสรุปผลการประเมินผลโครงงาน (โดยคณะกรรมการ)",deptLine(),classLine2()]),
 L(`ชื่อโครงงาน (ภาษาไทย) ${fv(S.info.titleTh,60)}`,0),L(`ชื่อโครงงาน (ภาษาอังกฤษ) ${fv(S.info.titleEn,56)}`,0),L("ชื่อนักศึกษา",0),...studentList(),
 L(`สาขาวิชา ${fv(S.info.major,24)} สาขางาน ${fv(S.info.track,24)} ภาคเรียนที่ ${S.info.term||2}/${S.info.acadYear}`,0),L(`หลักสูตร ${S.info.level==="ปวส"?"ประกาศนียบัตรวิชาชีพชั้นสูง (ปวส.)":"ประกาศนียบัตรวิชาชีพ (ปวช.)"}`,0),
 L(`ชื่อครูผู้สอนวิชาโครงงาน ${fv(teacherName(),40)}`,0),resultBoxes(r.result,"ผลการประเมิน"),LR([{text:"ความเห็นของกรรมการ",b:1}],0,{before:80}),...commentLines(r.comment),
 LR([{text:"หมายเหตุ",b:1,u:1},{text:" กรณีผลการสอบของนักเรียน “ผ่านโดยให้แก้ไข” ให้กรรมการแจ้งเหตุผลหรือส่วนที่ต้องแก้ไขไว้ด้วย และให้นักเรียนแก้ไขแล้วเสร็จและให้กรรมการรับรอง ภายใน 7 วัน นับตั้งแต่วันสอบ จึงถือว่าผลการสอบครั้งนี้สมบูรณ์"}],0,{before:80}),
 ...sigBlock(c[0],"ประธานกรรมการสอบ",2160),{t:"table",nb:true,w:[4150,4150],rows:[[{text:`ลงชื่อ ${dots(24)} กรรมการสอบ\n(${c[1]||dots(24)})\nวันที่ ${dots(16)}`,al:"c"},{text:`ลงชื่อ ${dots(20)} กรรมการ/ครูผู้สอน\n(${c[2]||dots(24)})\nวันที่ ${dots(16)}`,al:"c"}]],before:200},L("(โปรดพลิกด้านหลัง)",0,{align:"r",before:120}),...approvalsBack("คพ.07")]}
function teacherForms(kind){if(kind==="kp03")return kp03();if(kind==="kp05_1")return[...kp05(1),{t:"br"},...kp05att(1)];if(kind==="kp05_2")return[...kp05(2),{t:"br"},...kp05att(2)];if(kind==="kp07")return kp07();return[]}

/* ============ HTML preview renderer ============ */
function runsHTML(b){if(b.runs)return b.runs.map(r=>{let t=esc(r.text);if(r.b)t=`<b>${t}</b>`;if(r.i)t=`<i>${t}</i>`;if(r.u)t=`<u>${t}</u>`;return t}).join("");return esc(b.text).replace(/\n/g,"<br>").replace(/\(([^()]{2,60})\)/g,(m,x)=>/^(ชื่อ|ระบุ|ย่อหน้า|กรอก|อัปโหลด|เขียน|อธิบาย|เดือน|จำนวน|ผู้ใช้งาน|ตัวแทน|คำ|ความหมาย|ภาพ|English|Advisor|keywords|เพิ่ม|แทรก|ผู้แต่ง|ปี|สาขา|เบอร์|อีเมล|ที่อยู่|กรอบ|ประชากร|กลุ่มตัวอย่าง|วัตถุประสงค์|วิธี|ผลการ|innovation|Major|Year|Author)/.test(x)?`<span class="ph">${m}</span>`:m)}
function cellHTML(c){const o=typeof c==="string"?{text:c}:c;const st=[];if(o.size)st.push(`font-size:${o.size/32}em`);if(o.img&&o.arrow)return `<td colspan="${o.span||1}" style="vertical-align:middle;padding:0 2px"><img src="${o.img.src}" alt="ช่วงเวลา" style="width:100%;height:auto;display:block"></td>`;if(o.img)return `<td${o.rowSpan?` rowspan="${o.rowSpan}"`:""} style="width:15%;text-align:center;vertical-align:middle"><img src="${o.img.src}" alt="ตราสัญลักษณ์" style="width:56px;margin:2px auto"></td>`;if(o.al==="c")st.push("text-align:center");if(o.al==="r")st.push("text-align:right");
 return `<td${o.span?` colspan="${o.span}"`:""}${o.rowSpan?` rowspan="${o.rowSpan}"`:""} class="${o.fill?"fill":""}" style="${st.join(";")}">${o.b?"<b>":""}${esc(o.text||"").replace(/\n/g,"<br>")}${o.b?"</b>":""}</td>`}
function blocksHTML(blocks){return blocks.filter(Boolean).map(b=>{switch(b.t){
 case"h1c":return `<div class="h1c">${b.lines.map(esc).join("<br>")}</div><div class="gap"></div>`;
 case"h":return `<p class="h" style="margin-top:6px">${esc(b.text)}</p>`;
 case"p":{const st=[];if(b.left)st.push(`padding-left:${b.left/720*2.6}em`);if(b.ind)st.push(`text-indent:${b.ind/720*2.6}em`);if(b.hang)st.push(`padding-left:2.6em;text-indent:-2.6em`);if(b.before)st.push(`margin-top:${b.before/40}px`);if(b.after)st.push(`margin-bottom:${b.after/40}px`);if(b.size)st.push(`font-size:${b.size/32*1}em`);
  return `<p class="${b.align||""}${b.b?" h":""}${b.ph?" ph":""}" style="${st.join(";")}">${runsHTML(b)}</p>`}
 case"table":return `<table class="${b.nb?"nb":""}${b.inner==="none"?" ni":""}" style="${b.align==="r"?"width:auto;margin-left:auto;":""}${b.before?"margin-top:10px;":""}${b.after?"margin-bottom:10px;":""}">${b.rows.map(r=>`<tr>${r.map(cellHTML).join("")}</tr>`).join("")}</table>`;
 case"cap":return b.kind==="tab"?`<p class="capT" style="margin-top:6px"><b>ตารางที่ ${b.no}</b> ${esc(b.text)}</p>`:`<p class="cap" style="margin-bottom:6px"><b>ภาพที่ ${b.no}</b> ${esc(b.text)}</p>`;
 case"img":return `<img src="${b.src}" alt="" style="width:${Math.min(100,b.width/5.4)}%">`;
 case"br":return `<hr class="pb">`;
 case"blank":return `<div style="height:${b.n*10}px"></div>`;
 case"toc":return `<p class="r"><b>${esc(b.head)}</b></p>`+b.items.map(i=>`<div class="toc" style="padding-left:${i.lvl*2}em"><span>${esc(i.text)}</span><span></span><span>…</span></div>`).join("");
 default:return""}}).join("")}

/* ============ DOCX renderer ============ */
function imgData(src){return env.imageData?env.imageData(src):src}
function dx(){return env.docx}
function runsDocx(b,base={}){const D=dx();const mk=(text,o)=>{const parts=[];String(text).split("\n").forEach((line,li)=>line.split(/([☐☑✓❑])/).forEach((t,k)=>{const sym=/^[☐☑✓❑]$/.test(t);/* Latin words in a Thai line get their own run so they are not broken mid-word */const seg=sym||!isThai(t)?[t]:t.split(/([A-Za-z][A-Za-z0-9'’\-]*(?:[ ,.:;\/]+[A-Za-z0-9][A-Za-z0-9'’\-]*)*)/);seg.forEach((x,m)=>{if(x!==""||(k===0&&m===0))parts.push({t:x,br:li>0&&k===0&&m===0,sym})})}));return parts.map(({t,br,sym})=>new D.TextRun(Object.assign({text:t,break:br?1:undefined,font:sym?"Segoe UI Symbol":"TH SarabunPSK",size:base.size||32,bold:!!(o.b||base.b),italics:!!o.i,underline:o.u?{}:o.ud?{type:D.UnderlineType.DOTTED}:undefined,language:isThai(t)?{value:"th-TH",bidirectional:"th-TH"}:{value:"en-US"}})))};
 if(b.runs)return b.runs.flatMap(r=>mk(r.text,r));return mk(b.text??"",{})}
function paraDocx(b){const D=dx();const AL={c:D.AlignmentType.CENTER,r:D.AlignmentType.RIGHT,l:D.AlignmentType.LEFT};
 /* segs: text pieces separated by dotted-leader tabs (form lines such as "3.1 name.....รหัส.....สาขาวิชา.....") */
 let kids=b.segs?b.segs.flatMap(g=>[...runsDocx(g.runs?{runs:g.runs}:{text:g.text},{b:b.b,size:b.size}),...(g.tab?[new D.TextRun({children:[new D.Tab()],font:"TH SarabunPSK",size:b.size||32,underline:g.ud?{type:D.UnderlineType.DOTTED}:undefined})]:[])]):runsDocx(b,{b:b.b,size:b.size});
 if(b.bm)kids=[new D.Bookmark({id:b.bm,children:kids})];
 return new D.Paragraph({children:kids,alignment:AL[b.align]||D.AlignmentType.JUSTIFIED /* Word "Thai distributed" spreads letters apart on short lines, so plain justify is used for Thai too */,indent:b.hang?{left:b.hangLeft!=null?b.hangLeft:b.hang,hanging:b.hang}:{firstLine:b.ind||0,left:b.left||0,right:b.right||0},spacing:{before:b.before||0,after:b.after||0},keepNext:!!b.keep,
  tabStops:b.stops?b.stops.map(x=>({type:D.TabStopType.LEFT,position:x,leader:b.ul?D.LeaderType.NONE:D.LeaderType.DOT})):undefined})}
/* Lines a student typed as a list ("1. …", "* …", "- …") become hanging-indent items:
   numbers under the heading text, bullets (•) one level deeper, wrapped lines aligned with the item text. */
const LI_NUM=/^(\d{1,2}[.)])(?!\d)\s*(.*)$/,LI_BUL=/^[*•\-–]\s*(.*)$/;
function listParas(b,lines){
 lines=lines.map(t=>t.replace(/\s+$/,""));
 const isItem=t=>LI_NUM.test(t.trim())||LI_BUL.test(t.trim());
 if(!lines.slice(1).some(isItem))return lines.map((t,i)=>Object.assign({},b,{text:t,ind:i?0:b.ind,before:i?0:b.before,after:i<lines.length-1?0:b.after,keep:i<lines.length-1?1:b.keep}));
 const base=(b.left||0)+Math.max(0,b.ind||0),numAt=base+360,bulAt=numAt+400;
 // "8.1 ขอบเขตด้านเนื้อหา 1. ขนาด…" → heading on its own line, the list below it
 const m=lines[0].match(/^(.*?\S)\s+((?:\d{1,2}[.)]|[*•])\s.*)$/);
 const out=[];let head=lines[0],rest=lines.slice(1);
 if(m&&!isItem(lines[0])){head=m[1];rest=[m[2],...rest]}
 if(head.trim())out.push(Object.assign({},b,{text:head,after:0,keep:1}));
 let lastTxt=numAt;
 rest.forEach(t=>{const x=t.trim();if(!x)return;let n,u;
  if((n=x.match(LI_NUM))){lastTxt=numAt;out.push({t:"p",align:b.align,size:b.size,ind:numAt,left:0,text:`${n[1]} ${n[2]}`,after:0,keep:1})}
  else if((u=x.match(LI_BUL))){lastTxt=bulAt;out.push({t:"p",align:b.align,size:b.size,ind:bulAt,left:0,text:`• ${u[1]}`,after:0,keep:1})}
  else out.push({t:"p",align:b.align,size:b.size,ind:lastTxt,left:0,text:x,after:0,keep:1})});
 const last=out[out.length-1];last.after=b.after;last.keep=b.keep;out[0].before=b.before;
 return out}
/* Text width of the section being written. Tables are laid out for the report width (8306 twips) and widened to match form pages. */
let TWNOW=8306;
function tableDocx(b){const D=dx();const none={style:D.BorderStyle.NONE,size:0,color:"FFFFFF"},one={style:D.BorderStyle.SINGLE,size:4,color:"000000"};const bd=b.nb?none:one;const ih=b.inner==="none"?none:bd;
 const sum0=b.w.reduce((a,c)=>a+c,0);if(TWNOW!==8306&&sum0>=7000&&!b.fixed){const k=TWNOW/8306;b=Object.assign({},b,{w:b.w.map(x=>Math.round(x*k))})}
 const total=b.w.reduce((a,c)=>a+c,0);
 const left=Array(b.w.length).fill(0);
 const rows=b.rows.map((r,ri)=>{const occ=left.map(x=>x>0);for(let i=0;i<left.length;i++)if(left[i]>0)left[i]--;let ci=0;const rh=Array.isArray(b.rowH)?b.rowH[Math.min(ri,b.rowH.length-1)]:b.rowH;return new D.TableRow({tableHeader:ri<(b.head||0),cantSplit:true,height:rh?{value:rh,rule:D.HeightRule.ATLEAST}:undefined,children:r.map(c=>{const o=typeof c==="string"?{text:c}:c;while(occ[ci])ci++;const span=o.span||1;const w=b.w.slice(ci,ci+span).reduce((a,x)=>a+x,0);if(o.rowSpan>1)for(let i=ci;i<ci+span;i++)left[i]=o.rowSpan-1;ci+=span;
  const AL={c:D.AlignmentType.CENTER,r:D.AlignmentType.RIGHT};
  const kids=o.img?[new D.Paragraph({alignment:D.AlignmentType.CENTER,children:[new D.ImageRun({data:imgData(o.img.src),transformation:{width:o.img.width,height:Math.round(o.img.width*o.img.h/o.img.w)}})]})]:[new D.Paragraph({keepNext:!!(b.keep&&ri<b.rows.length-1),alignment:AL[o.al]||D.AlignmentType.LEFT,children:runsDocx(o.runs?{runs:o.runs}:{text:o.text||""},{b:o.b,size:o.size||b.size||32})})];
  return new D.TableCell({width:{size:w,type:D.WidthType.DXA},columnSpan:span>1?span:undefined,rowSpan:o.rowSpan,verticalAlign:(o.rowSpan||o.vc)?D.VerticalAlign.CENTER:undefined,
   shading:o.fill?{fill:"7F7F7F",type:D.ShadingType.CLEAR,color:"auto"}:undefined,margins:{left:b.pad??80,right:b.pad??80,top:o.img?60:0,bottom:o.img?60:0},
   children:kids})})})});
 return new D.Table({width:{size:total,type:D.WidthType.DXA},columnWidths:b.w,indent:b.indent?{size:b.indent,type:D.WidthType.DXA}:undefined,alignment:b.indent?D.AlignmentType.LEFT:b.align==="r"?D.AlignmentType.RIGHT:D.AlignmentType.CENTER,borders:{top:bd,bottom:bd,left:bd,right:bd,insideHorizontal:ih,insideVertical:bd},rows})}
function blocksDocx(blocks){const D=dx();const out=[];const TW=TWNOW;
 blocks.filter(b=>b&&!b.pvonly).forEach((b,bi)=>{switch(b.t){
  case"h1c":out.push(new D.Paragraph({alignment:D.AlignmentType.CENTER,spacing:{before:720},children:[new D.Bookmark({id:b.bm,children:[new D.TextRun({text:b.lines[0],bold:true,size:36,font:"TH SarabunPSK"})]})]}),
   new D.Paragraph({alignment:D.AlignmentType.CENTER,spacing:{after:320},children:[new D.TextRun({text:b.lines[1],bold:true,size:36,font:"TH SarabunPSK"})]}));break;
  case"h":out.push(new D.Paragraph({keepNext:true,spacing:{before:120},children:[new D.Bookmark({id:b.bm,children:runsDocx({text:b.text},{b:true})})]}));break;
  case"p":{/* a typed line break starts a new paragraph, so justified Thai lines are never stretched letter by letter (Word) */
   const parts=!b.segs&&!b.runs&&typeof b.text==="string"&&b.text.includes("\n")&&!b.hang&&b.align!=="c"&&b.align!=="r"?b.text.split("\n"):null;
   let rl=null;if(!b.segs&&b.runs&&b.runs.some(r=>String(r.text||"").includes("\n"))&&!b.hang&&b.align!=="c"&&b.align!=="r"){rl=[[]];b.runs.forEach(r=>String(r.text||"").split("\n").forEach((t,k)=>{if(k)rl.push([]);if(t)rl[rl.length-1].push(Object.assign({},r,{text:t}))}))}
   if(rl)rl.forEach((runs,i)=>out.push(paraDocx(Object.assign({},b,{runs,text:undefined,ind:i?0:b.ind,before:i?0:b.before,after:i<rl.length-1?0:b.after,keep:i<rl.length-1?1:b.keep}))));
   else if(parts)listParas(b,parts).forEach(x=>out.push(paraDocx(x)));
   else out.push(paraDocx(b));break}
  case"table":if(b.before)out.push(new D.Paragraph({keepNext:true,spacing:{before:0,after:0,line:b.before,lineRule:"exact"},children:[]}));out.push(tableDocx(b));if(b.after||(blocks[bi+1]&&blocks[bi+1].t==="table"))out.push(new D.Paragraph({spacing:b.after?{after:b.after}:{},children:[]}));break;
  case"cap":if(b.kind==="tab")out.push(new D.Paragraph({keepNext:true,spacing:{before:120},children:[new D.Bookmark({id:b.bm,children:[new D.TextRun({text:`ตารางที่ ${b.no} `,bold:true,size:32,font:"TH SarabunPSK"})]}),new D.TextRun({text:b.text,size:32,font:"TH SarabunPSK"})]}));
   else out.push(new D.Paragraph({alignment:D.AlignmentType.CENTER,spacing:{after:200},children:[new D.Bookmark({id:b.bm,children:[new D.TextRun({text:`ภาพที่ ${b.no} `,bold:true,size:32,font:"TH SarabunPSK"})]}),new D.TextRun({text:b.text,size:32,font:"TH SarabunPSK"})]}));break;
  case"img":{const w=b.width||520,h=Math.round(w*b.h/b.w);out.push(new D.Paragraph({alignment:D.AlignmentType.CENTER,keepNext:true,spacing:{before:120},children:[new D.ImageRun({data:imgData(b.src),transformation:{width:w,height:h}})]}));break}
  case"br":out.push(new D.Paragraph({pageBreakBefore:true,spacing:{before:0,after:0,line:20,lineRule:"exact"},children:[]}));break;
  case"blank":for(let i=0;i<b.n;i++)out.push(new D.Paragraph({children:[]}));break;
  case"toc":{const lead=b.head==="หน้า"?"":b.head.split(/\s+/)[0];const R=t=>new D.TextRun({text:t,bold:true,size:32,font:"TH SarabunPSK"});
   out.push(new D.Paragraph({tabStops:[{type:D.TabStopType.RIGHT,position:TW}],children:[R(lead),new D.TextRun({children:[new D.Tab()]}),R("หน้า")]}));}
   b.items.forEach(i=>out.push(new D.Paragraph({tabStops:[{type:D.TabStopType.RIGHT,position:TW,leader:D.LeaderType.DOT}],indent:{left:i.lvl*500},children:[new D.TextRun({text:i.text,size:32,font:"TH SarabunPSK"}),new D.TextRun({children:[new D.Tab()],size:32}),new D.PageReference(i.bm)]})));break}});
 return out}
function sectionDocx(sec,first){const D=dx();/* Report pages: top/left 1.5", right/bottom 1" (handbook format). Forms (คพ.): as printed in the handbook, the form starts near the top and the left edge is 1.25". */
 const props={page:{size:{width:11906,height:16838},margin:sec.form?{top:720,left:1800,right:1080,bottom:720,header:360,footer:360}:{top:2160,left:2160,right:1440,bottom:1440,header:1080,footer:720}}};
 TWNOW=11906-props.page.margin.left-props.page.margin.right;
 if(sec.num!=="none"){props.page.pageNumbers={formatType:sec.num==="thai"?D.NumberFormat.THAI_LETTERS:D.NumberFormat.DECIMAL};if(sec.start)props.page.pageNumbers.start=sec.start}
 const hsp=sec.form?{before:0,after:0,line:360,lineRule:D.LineRuleType.EXACT}:undefined;
 const num=new D.Header({children:[new D.Paragraph({alignment:D.AlignmentType.RIGHT,spacing:hsp,children:[new D.TextRun({children:[D.PageNumber.CURRENT],size:32,font:"TH SarabunPSK"})]})]});const empty=new D.Header({children:[new D.Paragraph({spacing:hsp,children:[]})]});
 const o={properties:Object.assign(props,{titlePage:!!sec.hideFirst}),headers:sec.num==="none"?{default:empty}:{default:num,first:empty},children:blocksDocx(sec.blocks)};
 const emptyF=new D.Footer({children:[new D.Paragraph({children:[]})]});
 if(sec.foot)o.footers={default:new D.Footer({children:blocksDocx(sec.foot)})};else if(sec.firstFoot)o.footers={default:emptyF,first:new D.Footer({children:blocksDocx(sec.firstFoot)})};else o.footers={default:emptyF,first:new D.Footer({children:[new D.Paragraph({children:[]})]})};
 if(sec.foot||sec.firstFoot)props.page.margin.footer=1440;return o}
function makeDoc(sections,title){const D=dx();return new D.Document({creator:"ผู้ช่วยเขียนรายงานโครงงาน",title,features:{updateFields:true},compatibility:{doNotExpandShiftReturn:true},
 styles:{default:{document:{run:{font:"TH SarabunPSK",size:32}}}},sections:sections.map(sectionDocx)})}


return {formOf,S,G,N,V,objectives,hypotheses,members,memberName,likert,satStats,iocStats,perfStats,parseCounts,allRefs,refRuns,
 buildReport,buildChapters,buildBack,buildFront,Ctx,kp01,allForms,questionnaireExpert,iocForm,questionnaireUser,
 blocksHTML,makeDoc,iocItems,dx,teacherForms,perfPhrase,fmtN,clearImages:()=>imgCache.clear(),perfNames,satNames,joinTh,lvIdx,baht};
}
return {create,normalize,KP05_ITEMS,ADMINS_DEFAULT,blank,example,KEY,PROJECT_TYPES,CALENDAR,LV_AGREE,LV_SAT,LV_SHORT,LV_EN,lvIdx,esc,clone,f2,MONTHS,thaiDate,isThai,ph,getPath,setPath,words};
});
