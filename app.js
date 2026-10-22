"use strict";
const SCORED = ["ENG","URD","PHY","CHEM","BIO","MATH"];
const GRADED = ["HPE","EVS"];
const PASS_MARK = 35;
const THRESH = {distinction:75, first:60, pass:35}; // configurable

const $ = s => document.querySelector(s);
const esc = s => String(s).replace(/[&<>"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));

// ---------- derived data ----------
function official(s){
  const r = s.remarks.find(x => ["PASS","PROMOTED","FAIL"].includes(x));
  return r || "PENDING";
}
function classOf(p){
  if (p == null) return "Not given";
  if (p >= THRESH.distinction) return "Distinction";
  if (p >= THRESH.first) return "First Class";
  if (p >= THRESH.pass) return "Pass Class";
  return "Below 35%";
}
STUDENTS.forEach(s => {
  s.result = official(s);
  s.cls = classOf(s.percent);
  s.low = SCORED.filter(c => s.subjects[c] && s.subjects[c].score < PASS_MARK);
});

const median = a => { const b=[...a].sort((x,y)=>x-y), m=b.length>>1; return b.length%2?b[m]:(b[m-1]+b[m])/2; };
const pct = (n,d) => d ? (100*n/d).toFixed(1)+"%" : "–";

// ---------- header ----------
$("#meta").textContent = `${REGISTER_META.course} · ${REGISTER_META.year} · ${REGISTER_META.source} · ${STUDENTS.length} students`;

// ---------- tabs ----------
document.querySelectorAll("#tabs button").forEach(b => b.onclick = () => {
  document.querySelectorAll("#tabs button").forEach(x => x.classList.toggle("on", x===b));
  document.querySelectorAll(".panel").forEach(p => p.classList.toggle("on", p.id===b.dataset.tab));
});

// ---------- dashboard ----------
function bars(el, rows){
  el.innerHTML = rows.map(r => `<div class="bar"><span>${esc(r.label)}</span><div class="track"><div class="fill" style="width:${r.w}%;background:${r.color}"></div></div><span>${esc(r.val)}</span></div>`).join("");
}
function dashboard(){
  const N = STUDENTS.length;
  const c = k => STUDENTS.filter(s => s.result===k).length;
  const passed=c("PASS"), prom=c("PROMOTED"), fail=c("FAIL");
  const dist = STUDENTS.filter(s => s.cls==="Distinction").length;
  $("#cards").innerHTML = [
    ["Total students",N,""],["Passed",passed,"ok"],["Promoted",prom,"warn"],["Failed",fail,"bad"],
    ["Pass %",pct(passed,N),"ok"],["Pass + Promoted %",pct(passed+prom,N),""],["Distinction",dist,"dist"]
  ].map(([l,n,k]) => `<div class="card ${k}"><div class="n">${n}</div><div class="l">${l}</div></div>`).join("");

  bars($("#chartStatus"), [
    {label:"Passed",w:100*passed/N,val:`${passed} (${pct(passed,N)})`,color:"var(--ok)"},
    {label:"Promoted",w:100*prom/N,val:`${prom} (${pct(prom,N)})`,color:"var(--warn)"},
    {label:"Failed",w:100*fail/N,val:`${fail} (${pct(fail,N)})`,color:"var(--bad)"}]);

  const withPct = STUDENTS.filter(s => s.percent != null);
  const cl = ["Distinction","First Class","Pass Class","Below 35%"];
  const colors = ["var(--dist)","var(--brand)","var(--ok)","var(--bad)"];
  bars($("#chartClass"), cl.map((k,i) => {
    const n = withPct.filter(s => s.cls===k).length;
    return {label:k,w:100*n/withPct.length,val:`${n} (${pct(n,withPct.length)})`,color:colors[i]};
  }));

  bars($("#chartSubj"), SCORED.map(code => {
    const st = subjStats(code);
    return {label:st.name,w:100*st.pass/st.n,val:`${st.pass}/${st.n} (${pct(st.pass,st.n)})`,color:"var(--brand)"};
  }));
  $("#denomNote").textContent =
    `Denominators: status percentages use all ${N} students in the pages loaded; class distribution uses the ${withPct.length} students with a printed percentage (PROMOTED students have none); subject pass % uses students with a score in that subject.`;
}

// ---------- subjects ----------
function subjStats(code){
  const rows = STUDENTS.filter(s => s.subjects[code]);
  const sc = rows.map(s => s.subjects[code].score);
  const absent = rows.filter(s => ["unit1","term1","unit2","oralPrac","term2"].some(k => s.subjects[code][k]===null)).length;
  return {code,name:rows[0]?rows[0].subjects[code].name:code,n:sc.length,
    pass:sc.filter(x => x>=PASS_MARK).length, below:sc.filter(x => x<PASS_MARK).length,
    hi:Math.max(...sc),lo:Math.min(...sc),avg:sc.reduce((a,b)=>a+b,0)/sc.length,med:median(sc),absent,sc,rows};
}
function subjects(){
  const rows = SCORED.map(subjStats);
  $("#subjTable").innerHTML = `<tr><th>Subject</th><th class="num">Students</th><th class="num">Passed</th><th class="num">Below 35</th><th class="num">Pass %</th><th class="num">Highest</th><th class="num">Lowest</th><th class="num">Average</th><th class="num">Median</th><th class="num">Absent in a part</th></tr>` +
    rows.map(r => `<tr><td>${esc(r.name)}</td><td class="num">${r.n}</td><td class="num">${r.pass}</td><td class="num ${r.below?"low":""}">${r.below}</td><td class="num">${pct(r.pass,r.n)}</td><td class="num">${r.hi}</td><td class="num">${r.lo}</td><td class="num">${r.avg.toFixed(1)}</td><td class="num">${r.med}</td><td class="num">${r.absent}</td></tr>`).join("");
  const pick = $("#subjPick");
  pick.innerHTML = [...SCORED,...GRADED].map(c => `<option value="${c}">${esc(STUDENTS[0].subjects[c].name)}</option>`).join("");
  pick.onchange = () => subjDetail(pick.value);
  subjDetail(pick.value);
}
function subjDetail(code){
  const box = $("#subjDetail");
  if (GRADED.includes(code)){
    const g = {};
    STUDENTS.forEach(s => { const x=s.subjects[code]; g[x.grade]=(g[x.grade]||0)+1; });
    box.innerHTML = `<p class="note">Grade-only subject: not part of the 600 total.</p>` +
      bars2(Object.keys(g).sort().map(k => ({label:"Grade "+k,w:100*g[k]/STUDENTS.length,val:g[k],color:"var(--brand)"})));
    return;
  }
  const st = subjStats(code);
  const buckets = [[0,34,"Below 35"],[35,49,"35–49"],[50,59,"50–59"],[60,74,"60–74"],[75,100,"75–100"]];
  const dist = buckets.map(([a,b,l]) => ({label:l,n:st.sc.filter(x => x>=a && x<=b).length}));
  const bar = dist.map(d => ({label:d.label,w:100*d.n/st.n,val:d.n,color:d.label==="Below 35"?"var(--bad)":"var(--brand)"}));
  const below = st.rows.filter(s => s.subjects[code].score<PASS_MARK);
  const top = [...st.rows].sort((a,b)=>b.subjects[code].score-a.subjects[code].score).slice(0,5);
  box.innerHTML = bars2(bar) +
    `<h3>Below pass mark (${below.length})</h3>` + (below.length ? list(below,code) : "<p class='note'>None.</p>") +
    `<h3>Top 5</h3>` + list(top,code);
}
function bars2(rows){ const d=document.createElement("div"); bars(d,rows); return d.innerHTML; }
function list(arr,code){
  return `<div class="scroll"><table><tr><th>Roll</th><th>Name</th><th class="num">Score /100</th><th>Official result</th></tr>` +
    arr.map(s => `<tr class="click" data-roll="${s.roll}"><td>${s.roll}</td><td>${esc(s.name)}</td><td class="num">${s.subjects[code].score}</td><td><span class="tag t-${s.result}">${s.result}</span></td></tr>`).join("") + `</table></div>`;
}

// ---------- merit ----------
function merit(){
  const sel = $("#meritSubj");
  if (!sel.options.length) sel.innerHTML = `<option value="TOTAL">Overall (total /600)</option>` + SCORED.map(c => `<option value="${c}">${esc(STUDENTS[0].subjects[c].name)}</option>`).join("");
  const code = sel.value, only = $("#meritOnlyPass").checked;
  let rows = STUDENTS.filter(s => !only || s.result==="PASS")
    .map(s => ({s,v: code==="TOTAL" ? s.total : s.subjects[code].score}));
  rows.sort((a,b) => b.v-a.v);
  let rank=0, prev=null;
  rows.forEach((r,i) => { if (r.v!==prev){rank=i+1;prev=r.v;} r.rank=rank; });
  const max = code==="TOTAL" ? 600 : 100;
  $("#meritTable").innerHTML = `<tr><th>Rank</th><th>Roll</th><th>Name</th><th class="num">Marks</th><th class="num">Out of</th><th class="num">%</th><th>Result</th></tr>` +
    rows.slice(0,20).map(r => `<tr class="click" data-roll="${r.s.roll}"><td>${r.rank}</td><td>${r.s.roll}</td><td>${esc(r.s.name)}</td><td class="num">${r.v}</td><td class="num">${max}</td><td class="num">${(100*r.v/max).toFixed(2)}</td><td><span class="tag t-${r.s.result}">${r.s.result}</span></td></tr>`).join("");
}
$("#meritSubj").onchange = merit; $("#meritOnlyPass").onchange = merit;

// ---------- students ----------
let sortKey="roll", sortDir=1, current=[];
function students(){
  const q = $("#q").value.trim().toLowerCase(), fs=$("#fStatus").value, fc=$("#fClass").value, fj=$("#fSubj").value;
  current = STUDENTS.filter(s =>
    (!q || s.name.toLowerCase().includes(q) || String(s.roll)===q) &&
    (!fs || s.result===fs) && (!fc || s.cls===fc) && (!fj || s.low.includes(fj)));
  const val = s => ({roll:s.roll,name:s.name,total:s.total,percent:s.percent??-1,cls:s.cls,result:s.result,low:s.low.length})[sortKey];
  current.sort((a,b) => (val(a)>val(b)?1:val(a)<val(b)?-1:0)*sortDir);
  const H = [["roll","Roll"],["name","Name"],["total","Total /600"],["percent","%"],["cls","Class"],["result","Result"],["low","Subjects < 35"]];
  $("#stuTable").innerHTML = `<tr>${H.map(([k,l]) => `<th data-k="${k}" class="${["total","percent","low"].includes(k)?"num":""}">${l}${sortKey===k?(sortDir>0?" ▲":" ▼"):""}</th>`).join("")}</tr>` +
    current.map(s => `<tr class="click" data-roll="${s.roll}"><td>${s.roll}</td><td>${esc(s.name)}</td><td class="num">${s.total}</td><td class="num">${s.percent==null?"–":s.percent.toFixed(2)}</td><td>${s.cls}</td><td><span class="tag t-${s.result}">${s.result}</span></td><td class="num ${s.low.length?"low":""}">${s.low.length?s.low.join(", "):"0"}</td></tr>`).join("");
  $("#stuCount").textContent = `Showing ${current.length} of ${STUDENTS.length} students.`;
  $("#stuTable").querySelectorAll("th").forEach(th => th.onclick = () => { sortDir = sortKey===th.dataset.k ? -sortDir : 1; sortKey = th.dataset.k; students(); });
}
["#q","#fStatus","#fClass","#fSubj"].forEach(id => $(id).oninput = students);
$("#fClass").innerHTML += ["Distinction","First Class","Pass Class","Below 35%","Not given"].map(c => `<option>${c}</option>`).join("");
$("#fSubj").innerHTML += SCORED.map(c => `<option value="${c}">${c}</option>`).join("");

// ---------- detail modal ----------
const cell = v => v===null ? `<span class="low">AB</span>` : v;
function openStudent(roll){
  const s = STUDENTS.find(x => x.roll==roll); if(!s) return;
  const rows = SCORED.map(c => { const x=s.subjects[c]; return `<tr><td>${esc(x.name)}</td><td class="num">${cell(x.unit1)}</td><td class="num">${cell(x.term1)}</td><td class="num">${cell(x.unit2)}</td><td class="num">${cell(x.oralPrac)}</td><td class="num">${cell(x.term2)}</td><td class="num">${x.total}</td><td class="num">${x.grace||""}</td><td class="num ${x.score<PASS_MARK?"low":""}">${x.score}</td></tr>`; }).join("");
  const g = GRADED.map(c => { const x=s.subjects[c]; return `<tr><td>${esc(x.name)}</td><td>${cell(x.marks)}</td><td>Grade ${x.grade}</td></tr>`; }).join("");
  $("#mBody").innerHTML = `<h2 style="margin:0">${esc(s.name)}</h2>
  <div class="kv"><span>Roll <b>${s.roll}</b></span><span>Division <b>${s.division}</b></span><span>Student ID <b>${s.studentId}</b></span><span>GR No <b>${s.grNo}</b></span><span>DOB <b>${s.dob}</b></span><span>Gender <b>${s.gender}</b></span></div>
  <p><span class="tag t-${s.result}">${s.result}</span> &nbsp; Total <b>${s.total}/600</b> &nbsp; ${s.percent==null?"No percentage printed":"<b>"+s.percent.toFixed(2)+"%</b>"} &nbsp; Class: <b>${s.cls}</b> ${s.remarks.filter(r=>r!==s.result).length?"(register: "+esc(s.remarks.filter(r=>r!==s.result).join(", "))+")":""}</p>
  ${s.low.length?`<p class="low">Below 35 in: ${s.low.join(", ")}${s.result==="PROMOTED"?" (promoted with grace marks)":""}</p>`:""}
  <div class="scroll"><table><tr><th>Subject</th><th class="num">1st Unit</th><th class="num">1st Terminal</th><th class="num">2nd Unit</th><th class="num">Oral / Practical</th><th class="num">2nd Terminal</th><th class="num">Total /200</th><th class="num">Grace</th><th class="num">Avg /100</th></tr>${rows}</table></div>
  <h3>Grade subjects</h3><table><tr><th>Subject</th><th>Marks</th><th>Grade</th></tr>${g}</table>
  <p class="note">Component maximums are not printed in the register, so none are assumed here.</p>`;
  $("#modal").hidden = false;
}
$("#mClose").onclick = () => $("#modal").hidden = true;
$("#modal").onclick = e => { if (e.target.id==="modal") $("#modal").hidden = true; };
document.addEventListener("click", e => { const tr=e.target.closest("tr.click"); if (tr) openStudent(tr.dataset.roll); });

// ---------- export ----------
$("#btnCsv").onclick = () => {
  const head = ["Roll","Student ID","Name","Division","Total/600","Percent","Class","Official result","Subjects below 35",...SCORED.map(c=>c+" /100"),"HPE grade","EVS grade"];
  const rows = (current.length?current:STUDENTS).map(s => [s.roll,s.studentId,s.name,s.division,s.total,s.percent??"",s.cls,s.result,s.low.join(" "),...SCORED.map(c=>s.subjects[c].score),s.subjects.HPE.grade,s.subjects.EVS.grade]);
  const csv = [head,...rows].map(r => r.map(v => `"${String(v).replace(/"/g,'""')}"`).join(",")).join("\r\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob(["\ufeff"+csv],{type:"text/csv"}));
  a.download = "xi-science-result-register.csv"; a.click();
};
$("#btnPrint").onclick = () => window.print();

dashboard(); subjects(); merit(); students();
