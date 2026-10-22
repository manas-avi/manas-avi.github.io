/* ---------- settings ---------- */
const CFG = window.LUMEN_CONFIG || {};
const TEAM_EMAIL = CFG.teamEmail || "";
const SUBMIT_URL = CFG.submitUrl || "";
const STEP_NAMES = ["About LUMEN","Your details","Questions","Letter of intent","Send"];

/* ---------- content ---------- */
const TYPES = ["Specialist lighting-design practice","Architecture firm with in-house lighting expertise","Engineering firm with in-house lighting expertise","Other"];
const SIZES = ["Just me","2 to 5 people","6 to 20 people","21 to 100 people","More than 100 people"];
const FREQ  = ["Rarely","A few times a year","About monthly","Weekly or more"];
const TRIGGERS = ["A specified product is discontinued or unavailable","The budget changes","A power or energy limit changes","The client changes the brief","Placement is restricted (structure, services, existing fixtures)","Standards or requirements are updated"];
const TOOLS = ["DIALux","Relux","Manufacturer tools (for example bestFIT)","CAD or BIM software","Spreadsheets or manual calculation"];
const TIME  = ["Under 30 minutes","30 minutes to 2 hours","2 hours to half a day","More than half a day","It varies too much to say"];
const PROJECTS = ["Mostly new builds","Mostly renovations of existing houses","A mix of new builds and renovations","Mostly other indoor projects (offices, retail, hospitality)"];
const BRIEF_SRC = ["A written brief or client questionnaire","Conversations and meetings","Mood boards or reference images","The architect’s drawings and room schedule","An existing lighting plan or site survey (renovations)","Informal messages, refined as we go"];
const BRIEF_HANDLE = ["I translate it into technical targets (illuminance, colour temperature, glare limits) before choosing luminaires","I start from products and layouts I know and adjust them to the brief","I start from atmosphere sketches or visuals, then calculate","It varies too much by project to say"];
const KEEP_FIXED = ["Existing luminaires I am asked to reuse","Existing ceiling openings or fixture positions","Existing wiring or circuits","Products the client has already chosen or bought","Nothing usually has to stay"];
const LIKERT_LABELS = ["Strongly disagree","Disagree","Neutral","Agree","Strongly agree"];
const LIKERT = [
  "Re-entering parameters, repositioning fixtures and re-running calculations takes up a large share of my revision work.",
  "Generating first alternatives directly from a brief would save me real effort on new designs.",
  "I would want to review and approve LUMEN’s technical interpretation of a brief before any alternatives are generated.",
  "Fixing certain products or positions and letting the system explore only the rest would save me real effort.",
  "Alternatives shown with calculated performance and estimated installation cost would help me discuss trade-offs with clients.",
  "I would only trust generated schemes if they use real luminaires with manufacturer photometric data.",
  "Atmosphere and visual emphasis should stay a matter of professional judgement, supported but not replaced by the tool.",
  "A room-scale, indoor-only first prototype would be enough for us to evaluate."
];
const BARRIERS = ["Preparing project data (geometry, product catalogue)","Trusting the calculated results","Fitting into DIALux, Relux or BIM workflows","Subscription cost","Training time","Responsibility for final design sign-off","Client data confidentiality","Nothing major"];
const BUYERS = ["I would decide","Practice owner or director","Technical director","Software or IT budget holder","A shared decision","Not sure"];
const HELP_MOST = ["First designs, starting from a brief","Revisions to an existing scheme","Both about equally","Neither"];
const PILOTS = ["Not interested","I would want to see prototype results first","I would discuss a paid pilot after seeing results and terms","Not sure"];
const GATES = {
  yes:"Yes, I’d like to continue to the letter of intent",
  feedback:"Not yet. I’ll send my answers as feedback only",
  no:"No, this isn’t relevant to my practice"
};
const INVOLVE = [
  "Provide feedback on revision tasks, requirements and proposed workflows.",
  "Evaluate a future prototype on an agreed task and provide professional feedback.",
  "Discuss a representative project example, subject to client approval and data permissions.",
  "Discuss a possible paid pilot after reviewing prototype results and commercial terms."
];

/* ---------- state ---------- */
const pad2 = n => String(n).padStart(2,"0");
const todayISO = (()=>{const d=new Date();return d.getFullYear()+"-"+pad2(d.getMonth()+1)+"-"+pad2(d.getDate());})();
const S = {
  practice:"",name:"",role:"",email:"",type:"",size:"",
  projects:"",briefSrc:[],briefHandle:"",timeFirst:"",keepFixed:[],freq:"",triggers:[],tools:[],toolsOther:"",timePer:"",
  lk:{},barriers:[],barriersOther:"",buyer:"",helpMost:"",pilot:"",problem:"",feedback:"",gate:"",
  meetingDate:"",meetingPlace:"",involve:[false,false,false,false],
  sigMode:"draw",sigTyped:"",strokes:[],padW:0,sigData:"",sigW:0,sigH:0,sigDate:todayISO,confirm:false
};
let cur = 0;

/* ---------- helpers ---------- */
const $ = (s,r=document)=>r.querySelector(s);
const esc = s=>String(s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const fmtDate = iso=>{ if(!iso) return ""; const [y,m,d]=iso.split("-").map(Number); return new Date(y,m-1,d).toLocaleDateString("en-GB",{day:"numeric",month:"long",year:"numeric"}); };
const slug = s=>(s||"practice").normalize("NFKD").replace(/[^\w]+/g,"_").replace(/^_+|_+$/g,"").slice(0,40)||"practice";
const activeSteps = ()=> S.gate==="yes" ? [0,1,2,3,4] : (S.gate ? [0,1,2,4] : [0,1,2,3,4]);

const field = (id,label,o={})=>`<div class="field"><label class="l" for="${id}">${label}${o.opt?'<span class="tag">optional</span>':""}</label>${o.hint?`<p class="hint" id="${id}-h">${o.hint}</p>`:""}<input id="${id}" data-k="${id}" type="${o.type||"text"}" value="${esc(S[id]||"")}"${o.ac?` autocomplete="${o.ac}"`:""}${o.hint?` aria-describedby="${id}-h"`:""}></div>`;
const select = (id,label,opts,o={})=>`<div class="field"><label class="l" for="${id}">${label}${o.opt?'<span class="tag">optional</span>':""}</label><select id="${id}" data-k="${id}"><option value="">Choose one</option>${opts.map(x=>`<option${S[id]===x?" selected":""}>${esc(x)}</option>`).join("")}</select></div>`;
const radios = (key,legend,opts,o={})=>`<fieldset class="grp" id="g-${key}" tabindex="-1"><legend>${legend}${o.opt?'<span class="tag">optional</span>':""}</legend><div class="choices${o.two?" two":""}">${opts.map(x=>{const v=Array.isArray(x)?x[0]:x,t=Array.isArray(x)?x[1]:x;return `<label class="choice"><input type="radio" name="${key}" data-k="${key}" value="${esc(v)}"${S[key]===v?" checked":""}><span class="mark r"></span><span>${esc(t)}</span></label>`;}).join("")}</div></fieldset>`;
const checks = (key,legend,opts,o={})=>`<fieldset class="grp" id="g-${key}" tabindex="-1"><legend>${legend}${o.opt?'<span class="tag">optional</span>':""}</legend>${o.hint?`<p class="hint">${o.hint}</p>`:""}<div class="choices${o.two?" two":""}">${opts.map(x=>`<label class="choice"><input type="checkbox" data-m="${key}" value="${esc(x)}"${S[key].includes(x)?" checked":""}><span class="mark c"></span><span>${esc(x)}</span></label>`).join("")}</div></fieldset>`;
const likert = (i,text)=>`<fieldset class="lk"><legend>${esc(text)}</legend><div class="scale">${LIKERT_LABELS.map((l,v)=>`<label><input type="radio" name="lk${i}" data-lk="${i}" value="${v+1}"${S.lk[i]==v+1?" checked":""}><span>${l}</span></label>`).join("")}</div></fieldset>`;
const textarea = (id,label,o={})=>`<div class="field"><label class="l" for="${id}">${label}${o.opt?'<span class="tag">optional</span>':""}</label>${o.hint?`<p class="hint" id="${id}-h">${o.hint}</p>`:""}<textarea id="${id}" data-k="${id}" rows="${o.rows||4}"${o.hint?` aria-describedby="${id}-h"`:""}>${esc(S[id]||"")}</textarea></div>`;
const errBox = `<div id="errs" class="errs" role="alert" tabindex="-1" hidden></div>`;

/* ---------- polar diagram (progress) ---------- */
const R = 92;
function polarInner(){
  let s="";
  [.25,.5,.75,1].forEach(k=>s+=`<circle class="ring" r="${R*k}"/>`);
  for(let a=0;a<180;a+=30){const t=a*Math.PI/180;s+=`<line class="spoke" x1="${(-R*Math.sin(t)).toFixed(1)}" y1="${(-R*Math.cos(t)).toFixed(1)}" x2="${(R*Math.sin(t)).toFixed(1)}" y2="${(R*Math.cos(t)).toFixed(1)}"/>`;}
  s+=`<path class="lobe" d=""/><circle class="src" r="2.6"/>`;
  s+=`<text class="lbl" x="0" y="${R+11}" text-anchor="middle">0°</text><text class="lbl" x="${R+6}" y="3">90°</text><text class="lbl" x="${-R-6}" y="3" text-anchor="end">90°</text><text class="lbl" x="0" y="${-R-5}" text-anchor="middle">180°</text>`;
  return s;
}
function lobePath(p){
  let d="";const n=180;
  for(let i=0;i<=n;i++){
    const f=i/n*2*Math.PI;
    const g=Math.pow(Math.max(0,Math.cos(f)),1.2)*(0.62+0.38*Math.pow(Math.cos(3*f),2));
    const r=R*p*(0.1+0.9*g);
    d+=(i?"L":"M")+(r*Math.sin(f)).toFixed(2)+" "+(r*Math.cos(f)).toFixed(2);
  }
  return d+"Z";
}
let curP=0.12,anim=0;
function drawLobes(){const d=lobePath(curP);document.querySelectorAll(".polar .lobe").forEach(n=>n.setAttribute("d",d));}
function setProgress(target){
  cancelAnimationFrame(anim);
  if(matchMedia("(prefers-reduced-motion: reduce)").matches){curP=target;drawLobes();return;}
  const from=curP;let t0;
  const step=t=>{if(t0===undefined)t0=t;const k=Math.max(0,Math.min(1,(t-t0)/500)),e=1-Math.pow(1-k,3);curP=from+(target-from)*e;drawLobes();if(k<1)anim=requestAnimationFrame(step);};
  anim=requestAnimationFrame(step);
}

/* ---------- steps ---------- */
function stepAbout(){
  return `<section>
  <div class="hero">
    <div>
      <h1 id="h" tabindex="-1">Tell us whether LUMEN fits the way you design and revise lighting schemes</h1>
      <p class="lead">LUMEN is a proposed co-pilot for architects and lighting designers. Starting from a brief, or when products, budgets or requirements change on an existing scheme, it explores luminaires and layouts, keeps the decisions you have fixed, and shows each alternative with its calculated performance and estimated cost.</p>
    </div>
    <figure class="polar-wrap"><svg class="polar" viewBox="-112 -108 224 220" aria-hidden="true">${polarInner()}</svg>
      <figcaption>A luminaire’s light distribution. The small copy in the header fills in as you move through this form.</figcaption></figure>
  </div>
  <details open><summary>How LUMEN would work in practice</summary>
    <ol class="how">
      <li>You supply the brief, room geometry and requirements, including any fixtures or positions that must stay.</li>
      <li>LUMEN proposes technical parameters for the design intentions it supports. You approve them and settle any ambiguities before anything is generated.</li>
      <li>It explores products, quantities, positions and orientations together, using real luminaires with manufacturer photometric data.</li>
      <li>You receive alternatives with layout, calculated performance and estimated installation cost. Creative direction and final judgement stay with you.</li>
    </ol>
  </details>
  <div class="note">
    <p><strong>Where LUMEN stands today</strong></p>
    <p>LUMEN is at concept stage. The first prototype will cover room-scale indoor electric lighting, using supplied geometry and a controlled product catalogue. Open-ended brief interpretation, daylight optimisation, whole-building energy assessment and production-level BIM integration are outside that first scope. Technical performance, workflow benefit and commercial terms are still to be developed and evaluated.</p>
  </div>
  <p><strong>What we’re asking of you.</strong> About five minutes of questions on your work and our approach. If LUMEN looks relevant to your practice, you can then sign a short letter of intent that does not commit you to anything. ${SUBMIT_URL?"At the end you send your response to us directly.":"At the end you save your files and email them to us."}</p>
  <div class="nav"><span></span><button class="btn" id="next">Start</button></div>
  </section>`;
}
function stepYou(){
  return `<section>${errBox}<h2 id="h" tabindex="-1">About you and your practice</h2>
  <p class="muted">We use this to identify your response and to complete the letter of intent.</p>
  ${field("practice","Practice or organisation",{ac:"organization"})}
  ${field("name","Your name",{ac:"name"})}
  ${field("role","Your role",{ac:"organization-title"})}
  ${field("email","Professional email",{type:"email",ac:"email"})}
  ${select("type","Type of practice",TYPES,{opt:true})}
  ${select("size","Size of your team",SIZES,{opt:true})}
  <div class="nav"><button class="btn ghost" id="back">Back</button><button class="btn" id="next">Continue to the questions</button></div></section>`;
}
function stepQuestions(){
  return `<section>${errBox}<h2 id="h" tabindex="-1">Questions about your work and our approach</h2>
  <p class="muted">Answer what you can. There are no wrong answers, and only the final question is required.</p>
  <h3 style="border-top:0;padding-top:0;margin-top:1.8rem">Client briefs and first designs</h3>
  ${radios("projects","What kind of projects do you mostly work on?",PROJECTS,{opt:true})}
  ${checks("briefSrc","How do client briefs usually reach you?",BRIEF_SRC,{opt:true,hint:"Choose all that apply."})}
  ${radios("briefHandle","How do you usually turn a brief into a lighting scheme?",BRIEF_HANDLE,{opt:true})}
  ${radios("timeFirst","For a typical room, how much active working time does the first lighting scheme take?",TIME,{opt:true})}
  ${checks("keepFixed","In a renovation, what usually has to stay fixed?",KEEP_FIXED,{opt:true,hint:"Choose all that apply. Skip this if you rarely renovate."})}
  <h3>Revisions and tools</h3>
  ${radios("freq","How often do you revise an indoor lighting scheme after the first design?",FREQ,{two:true,opt:true})}
  ${checks("triggers","What usually triggers a revision?",TRIGGERS,{opt:true,hint:"Choose all that apply."})}
  ${checks("tools","Which tools do you use for lighting calculation and layout today?",TOOLS,{opt:true,two:true,hint:"Choose all that apply."})}
  ${field("toolsOther","Other tools",{opt:true})}
  ${radios("timePer","For a typical room, how much active working time does one revision take?",TIME,{opt:true})}
  <h3>LUMEN’s proposal</h3>
  <p class="muted">How far do you agree with each statement?</p>
  ${LIKERT.map((t,i)=>likert(i+1,t)).join("")}
  ${radios("helpMost","Where would a tool like LUMEN help you most?",HELP_MOST,{opt:true,two:true})}
  <h3>Adopting a tool like this</h3>
  ${checks("barriers","What would hold your practice back from adopting it?",BARRIERS,{opt:true,two:true,hint:"Choose all that apply."})}
  ${field("barriersOther","Other concerns",{opt:true})}
  ${radios("buyer","Who would decide to buy a tool like this?",BUYERS,{opt:true,two:true})}
  ${radios("pilot","If a prototype worked as described on your tasks, how would you view a paid pilot?",PILOTS,{opt:true})}
  <p class="hint">This is a conversation starter only. It does not commit you to anything.</p>
  <h3>Anything else?</h3>
  ${textarea("feedback","Anything missing or wrong in our approach?",{opt:true,rows:3})}
  <h3>Your overall view</h3>
  ${radios("gate","Having read about LUMEN, do you want to record your interest in a letter of intent?",Object.entries(GATES))}
  <div class="nav"><button class="btn ghost" id="back">Back</button><button class="btn" id="next">${nextQLabel()}</button></div></section>`;
}
const nextQLabel = ()=> S.gate==="yes" ? "Continue to the letter" : (S.gate ? "Continue to save your answers" : "Continue");
function stepLetter(){
  return `<section>${errBox}<h2 id="h" tabindex="-1">Letter of intent</h2>
  <p class="muted">Read the letter, complete the blanks and sign. Your details come from the earlier steps and you can edit them here.</p>
  <article class="sheet" aria-label="Letter of intent for LUMEN">
    <h2>Letter of intent for LUMEN</h2>
    <p class="sub">Interest in prototype evaluation and professional feedback</p>
    <p>To the LUMEN founding team,</p>
    ${field("practice","Practice or organisation")}
    <div class="row">${field("meetingDate","Meeting date",{type:"date"})}${field("meetingPlace","Location or online")}</div>
    <p>Following our discussion of LUMEN, we express interest in its proposed approach to revising indoor lighting schemes when products, budgets or requirements change. The ability to explore replacement luminaires and permitted layout changes while preserving agreed design decisions could be relevant to our practice.</p>
    ${textarea("problem","A revision problem or use case relevant to our work is:",{rows:4})}
    <p>We understand that LUMEN is currently at concept stage. A working prototype and its technical performance, workflow benefits and commercial terms remain to be developed and evaluated.</p>
    <fieldset class="grp" id="g-inv" tabindex="-1"><legend>Our intended involvement (tick only the options that apply):</legend>
      <div class="choices">${INVOLVE.map((t,i)=>`<label class="choice"><input type="checkbox" data-inv="${i}"${S.involve[i]?" checked":""}><span class="mark c"></span><span>${esc(t)}</span></label>`).join("")}</div></fieldset>
    <p>Participation would be subject to our availability and agreement on scope, timing, access and any costs. This letter records present interest and is not intended to create a binding obligation to participate, purchase, pay, provide data or enter an exclusive arrangement. Any pilot, purchase or data sharing would require separate agreement.</p>
    <p>We permit the LUMEN team to include this signed letter in its Preseed funding application and related assessment. It must not be presented as a purchase order or proof of validated performance.</p>
    <div class="row">${field("name","Name")}${field("role","Role")}</div>
    ${field("email","Professional email",{type:"email"})}
    <fieldset class="grp" id="sig" tabindex="-1"><legend>Signature</legend>
      <div class="choices two" style="margin-bottom:.7rem">
        <label class="choice"><input type="radio" name="sigMode" data-k="sigMode" value="draw"${S.sigMode==="draw"?" checked":""}><span class="mark r"></span><span>Draw it</span></label>
        <label class="choice"><input type="radio" name="sigMode" data-k="sigMode" value="type"${S.sigMode==="type"?" checked":""}><span class="mark r"></span><span>Type my name</span></label>
      </div>
      <div id="sigarea"></div>
    </fieldset>
    ${field("sigDate","Date",{type:"date"})}
    <div class="confirm"><label class="choice"><input type="checkbox" id="confirm" data-k="confirm"${S.confirm?" checked":""}><span class="mark c"></span><span>I have read this letter. I understand that it records interest only and does not bind me or my practice.</span></label></div>
  </article>
  <div class="nav"><button class="btn ghost" id="back">Back</button><button class="btn" id="next">Continue to save and send</button></div></section>`;
}
function stepSend(){
  const signed = S.gate==="yes";
  const body = [
    "Hello LUMEN team,","",
    signed ? "Please find attached our signed letter of intent and questionnaire responses." : "Please find attached our questionnaire responses.",
    "","Practice: "+S.practice,"Name: "+S.name+(S.role?", "+S.role:""),"Overall view: "+(GATES[S.gate]||""),"","(Attach the saved PDF file"+(signed?"s":"")+" before sending.)"
  ].join("\n");
  const subject = "LUMEN: "+(signed?"letter of intent and questionnaire":"questionnaire feedback")+" from "+S.practice;
  const mailto = "mailto:"+encodeURIComponent(TEAM_EMAIL).replace("%40","@")+"?subject="+encodeURIComponent(subject)+"&body="+encodeURIComponent(body);
  const to = TEAM_EMAIL ? `<strong>${esc(TEAM_EMAIL)}</strong>` : "the LUMEN team";
  return `<section><h2 id="h" tabindex="-1">${signed?"Save your files and email them to us":"Thank you for your feedback"}</h2>
  <p class="lead">${signed?"":"You chose not to sign the letter, so there is nothing to sign. You can still send us your answers. "}Nothing has been sent yet. Save the file${signed?"s":""} below, then email ${signed?"them":"it"} to ${to}.</p>
  ${SUBMIT_URL?`<div class="mailbox"><button class="btn" id="submit">Send to the LUMEN team</button><p class="hint" style="margin-top:.6rem">Sends your answers${signed?" and the signed letter":""} to us in one step. You can also save the files and email them yourself.</p></div>`:""}
  <ul class="files">
    ${signed?`<li><div><b>Signed letter of intent</b><span>The letter with your details and signature.</span></div><button class="btn sm" id="dl-letter">Save letter (PDF)</button></li>`:""}
    <li><div><b>Questionnaire responses</b><span>Your answers to the questions, in one document.</span></div><button class="btn sm" id="dl-resp">Save responses (PDF)</button></li>
  </ul>
  <p class="status" id="status" role="status"></p>
  <div class="mailbox"><a class="btn ghost" id="mail" href="${mailto}" target="_blank" rel="noopener">Open an email draft</a>
    <p class="hint" style="margin-top:.6rem">The draft is pre-filled but cannot attach files for you.</p></div>
  <details><summary>Copy your answers as text</summary>
    <p class="hint">Useful if saving a PDF does not work in your browser. Paste this into your email instead.</p>
    <textarea class="copybox" id="copybox" readonly>${esc(summaryText())}</textarea>
    <p><button class="btn ghost sm" id="copy">Copy text</button></p></details>
  <div class="nav"><button class="btn ghost" id="back">Back and edit</button><span></span></div></section>`;
}
const RENDER = [stepAbout,stepYou,stepQuestions,stepLetter,stepSend];

/* ---------- signature pad ---------- */
function renderSig(){
  const host=$("#sigarea"); if(!host) return;
  if(S.sigMode==="type"){
    host.innerHTML=`<label class="l" for="sigTyped">Type your full name</label><input id="sigTyped" data-k="sigTyped" type="text" value="${esc(S.sigTyped)}" autocomplete="name"><p class="typed-sig" id="typed" aria-hidden="true">${esc(S.sigTyped)}</p>`;
  } else {
    host.innerHTML=`<div class="sigbox"><canvas id="pad" aria-label="Signature drawing area"></canvas><div class="ph" id="ph">Sign here with a finger, mouse or pen</div></div>
    <div class="sigtools"><span class="small muted">Not happy with it? Clear it and sign again.</span><button class="linkbtn" id="clearpad" type="button">Clear signature</button></div>`;
    initPad();
  }
}
function initPad(){
  const c=$("#pad"); if(!c) return;
  const dpr=window.devicePixelRatio||1,w=c.clientWidth,h=c.clientHeight;
  c.width=w*dpr;c.height=h*dpr;
  const g=c.getContext("2d");g.scale(dpr,dpr);g.lineWidth=2.2;g.lineCap="round";g.lineJoin="round";g.strokeStyle="#1B222A";
  const k=S.padW?w/S.padW:1; S.padW=w;
  S.strokes=S.strokes.map(s=>s.map(p=>[p[0]*k,p[1]*k]));
  const paint=()=>{g.clearRect(0,0,w,h);S.strokes.forEach(s=>{g.beginPath();s.forEach((p,i)=>i?g.lineTo(p[0],p[1]):g.moveTo(p[0],p[1]));if(s.length===1)g.lineTo(s[0][0]+.01,s[0][1]);g.stroke();});$("#ph").hidden=S.strokes.length>0;};
  paint();
  let drawing=false,stroke=null;
  const pt=e=>{const r=c.getBoundingClientRect();return [e.clientX-r.left,e.clientY-r.top];};
  c.addEventListener("pointerdown",e=>{e.preventDefault();c.setPointerCapture(e.pointerId);drawing=true;stroke=[pt(e)];S.strokes.push(stroke);paint();});
  c.addEventListener("pointermove",e=>{if(!drawing)return;const p=pt(e),l=stroke[stroke.length-1];g.beginPath();g.moveTo(l[0],l[1]);g.lineTo(p[0],p[1]);g.stroke();stroke.push(p);});
  const end=()=>{if(!drawing)return;drawing=false;exportSig();};
  c.addEventListener("pointerup",end);c.addEventListener("pointercancel",end);
  $("#clearpad").addEventListener("click",()=>{S.strokes=[];S.sigData="";paint();});
}
function exportSig(){
  const pts=S.strokes.flat(); if(!pts.length){S.sigData="";return;}
  const pad=6,xs=pts.map(p=>p[0]),ys=pts.map(p=>p[1]);
  const x0=Math.min(...xs)-pad,y0=Math.min(...ys)-pad,w=Math.max(...xs)-x0+pad,h=Math.max(...ys)-y0+pad,sc=3;
  const t=document.createElement("canvas");t.width=Math.ceil(w*sc);t.height=Math.ceil(h*sc);
  const g=t.getContext("2d");g.scale(sc,sc);g.translate(-x0,-y0);g.lineWidth=2.2;g.lineCap="round";g.lineJoin="round";g.strokeStyle="#1B222A";
  S.strokes.forEach(s=>{g.beginPath();s.forEach((p,i)=>i?g.lineTo(p[0],p[1]):g.moveTo(p[0],p[1]));if(s.length===1)g.lineTo(s[0][0]+.01,s[0][1]);g.stroke();});
  S.sigData=t.toDataURL("image/png");S.sigW=t.width;S.sigH=t.height;
}

/* ---------- validation ---------- */
const emailOk = v=>/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((v||"").trim());
function validate(step){
  const e=[],need=(ok,id,msg)=>{if(!ok)e.push({id,msg});};
  if(step===1||step===3){
    need(S.practice.trim(),"practice","Enter your practice or organisation.");
    need(S.name.trim(),"name","Enter your name.");
    need(S.role.trim(),"role","Enter your role.");
    need(emailOk(S.email),"email","Enter a valid professional email address.");
  }
  if(step===2){
    need(S.gate,"g-gate","Choose whether you want to continue to the letter of intent.");
  }
  if(step===3){
    need(S.meetingDate,"meetingDate","Enter the date we met.");
    need(S.meetingPlace.trim(),"meetingPlace","Enter where we met, or “Online”.");
    need(S.problem.trim(),"problem","Describe a revision problem or use case.");
    need(S.involve.some(Boolean),"g-inv","Tick at least one way you would like to be involved.");
    need(S.sigMode==="draw"?S.sigData:S.sigTyped.trim(),"sig","Add your signature.");
    need(S.sigDate,"sigDate","Enter the date of signing.");
    need(S.confirm,"confirm","Confirm that you have read the letter.");
  }
  return e;
}
function showErrors(list){
  document.querySelectorAll("[aria-invalid]").forEach(n=>n.removeAttribute("aria-invalid"));
  const box=$("#errs"); if(!box) return;
  if(!list.length){box.hidden=true;box.innerHTML="";return;}
  box.hidden=false;
  box.innerHTML=`<p><strong>${list.length===1?"One thing needs your attention:":"A few things need your attention:"}</strong></p><ul>${list.map(x=>`<li><a href="#${x.id}" data-jump="${x.id}">${x.msg}</a></li>`).join("")}</ul>`;
  list.forEach(x=>{const n=document.getElementById(x.id);if(n)n.setAttribute("aria-invalid","true");});
  box.scrollIntoView({block:"center"});box.focus({preventScroll:true});
}

/* ---------- navigation ---------- */
function go(n){
  cur=n;
  $("#app").innerHTML=RENDER[n]();
  const act=activeSteps(),i=act.indexOf(n);
  $("#stepName").textContent=STEP_NAMES[n];
  $("#stepCount").textContent="Step "+(i+1)+" of "+act.length;
  if(n===3) renderSig();
  setProgress(0.12+0.88*(i/(act.length-1)));
  drawLobes();
  window.scrollTo(0,0);
  const h=$("#h"); if(h) h.focus({preventScroll:true});
}
function next(){
  const errs=validate(cur); showErrors(errs); if(errs.length) return;
  if(cur===2) return go(S.gate==="yes"?3:4);
  go(cur+1);
}
function back(){
  if(cur===4) return go(S.gate==="yes"?3:2);
  go(cur-1);
}

/* ---------- input handling ---------- */
function handle(e){
  const t=e.target,d=t.dataset;
  if(d.k!==undefined){
    if(t.type==="radio"&&!t.checked) return;
    S[d.k]=t.type==="checkbox"?t.checked:t.value;
    if(d.k==="gate"){const b=$("#next");if(b)b.textContent=nextQLabel();}
    if(d.k==="sigMode") renderSig();
    if(d.k==="sigTyped"){const p=$("#typed");if(p)p.textContent=t.value;}
  } else if(d.m){
    const a=S[d.m],i=a.indexOf(t.value);
    if(t.checked&&i<0)a.push(t.value);
    if(!t.checked&&i>=0)a.splice(i,1);
  } else if(d.lk){ S.lk[d.lk]=t.value; }
  else if(d.inv!==undefined){ S.involve[+d.inv]=t.checked; }
}
const app=$("#app");
app.addEventListener("input",handle);
app.addEventListener("change",handle);
app.addEventListener("click",e=>{
  const j=e.target.closest("[data-jump]");
  if(j){e.preventDefault();const n=document.getElementById(j.dataset.jump);if(n){n.scrollIntoView({block:"center"});n.focus({preventScroll:true});}return;}
  const b=e.target.closest("button"); if(!b) return;
  if(b.id==="next") next();
  else if(b.id==="back") back();
  else if(b.id==="dl-letter") savePdf("letter",b);
  else if(b.id==="dl-resp") savePdf("resp",b);
  else if(b.id==="submit") submitToTeam(b);
  else if(b.id==="copy") copyText();
});

/* ---------- answers as data ---------- */
function qaList(){
  const j=a=>a.length?a.join("; "):"";
  const lk=LIKERT.map((q,i)=>({q:q,a:S.lk[i+1]?LIKERT_LABELS[S.lk[i+1]-1]:""}));
  const tools=[...S.tools,S.toolsOther.trim()].filter(Boolean).join("; ");
  const barr=[...S.barriers,S.barriersOther.trim()].filter(Boolean).join("; ");
  return [
    {h:"About the respondent"},
    {q:"Practice or organisation",a:S.practice},{q:"Name",a:S.name},{q:"Role",a:S.role},{q:"Professional email",a:S.email},
    {q:"Type of practice",a:S.type},{q:"Team size",a:S.size},
    {h:"Client briefs and first designs"},
    {q:"Kind of projects mostly worked on",a:S.projects},
    {q:"How client briefs usually arrive",a:j(S.briefSrc)},
    {q:"How a brief is turned into a lighting scheme",a:S.briefHandle},
    {q:"Active working time for the first lighting scheme of a typical room",a:S.timeFirst},
    {q:"What usually has to stay fixed in a renovation",a:j(S.keepFixed)},
    {h:"Revisions and tools"},
    {q:"How often do you revise an indoor lighting scheme after the first design?",a:S.freq},
    {q:"What usually triggers a revision?",a:j(S.triggers)},
    {q:"Tools used for lighting calculation and layout",a:tools},
    {q:"Active working time for one typical room revision",a:S.timePer},
    {h:"LUMEN’s proposal (agreement with each statement)"},
    ...lk,
    {q:"Where a tool like LUMEN would help most",a:S.helpMost},
    {h:"Adopting a tool like this"},
    {q:"What would hold the practice back from adopting it?",a:barr},
    {q:"Who would decide to buy?",a:S.buyer},
    {q:"View of a paid pilot if a prototype worked as described",a:S.pilot},
    {h:"Open answers"},
    ...(S.gate==="yes"?[{q:"A revision problem or use case from your work",a:S.problem}]:[]),
    {q:"Anything missing or wrong in our approach?",a:S.feedback},
    {h:"Overall view"},
    {q:"Interest in a letter of intent",a:GATES[S.gate]||""},
    {q:"Letter of intent signed",a:S.gate==="yes"?"Yes, on "+fmtDate(S.sigDate):"No"}
  ];
}
function summaryText(){
  const out=["LUMEN questionnaire responses","Completed "+fmtDate(todayISO),""];
  qaList().forEach(x=>{ if(x.h){out.push("","== "+x.h+" =="); } else out.push(x.q+"\n  "+(x.a||"(no answer)")); });
  return out.join("\n");
}
async function copyText(){
  const ta=$("#copybox"),st=$("#status");
  try{ await navigator.clipboard.writeText(ta.value); st.textContent="Copied. Paste it into your email."; }
  catch(_){ ta.focus();ta.select(); try{document.execCommand("copy");st.textContent="Copied. Paste it into your email.";}catch(__){st.textContent="Select the text above and copy it manually.";} }
}

/* ---------- PDF ---------- */
function pdfClean(s){
  return String(s==null?"":s).normalize("NFC").replace(/[^\x09\x0A\x20-\x7E\xA0-\xFF\u2018\u2019\u201C\u201D\u2013\u2014\u2026]/g,ch=>{
    const d=ch.normalize("NFKD").replace(/[\u0300-\u036f]/g,"");
    return d&&/^[\x20-\x7E\xA0-\xFF]+$/.test(d)?d:"?";
  });
}
function mkDoc(){
  const {jsPDF}=window.jspdf,doc=new jsPDF({unit:"mm",format:"a4"}),st={y:24},M=22,TW=166;
  const need=h=>{if(st.y+h>277){doc.addPage();st.y=24;}};
  const write=(text,o={})=>{
    const {font="times",style="normal",size=11,gap=3,color=[27,34,42],x=M,w=TW,lh=1.4}=o;
    doc.setFont(font,style);doc.setFontSize(size);doc.setTextColor(...color);
    const lines=doc.splitTextToSize(pdfClean(text),w),lineH=size*0.3528*lh;
    lines.forEach(ln=>{need(lineH);doc.text(ln,x,st.y,{baseline:"top"});st.y+=lineH;});
    st.y+=gap;
  };
  const ruled=(label,val)=>{
    doc.setFont("helvetica","bold");doc.setFontSize(9.5);
    const lw=label?doc.getTextWidth(pdfClean(label))+3:0;
    doc.setFont("times","normal");doc.setFontSize(11.5);
    const lines=doc.splitTextToSize(pdfClean(val)||" ",TW-lw);
    lines.forEach((ln,i)=>{
      need(8);
      if(i===0&&label){doc.setFont("helvetica","bold");doc.setFontSize(9.5);doc.setTextColor(85,99,110);doc.text(pdfClean(label),M,st.y+1,{baseline:"top"});}
      doc.setFont("times","normal");doc.setFontSize(11.5);doc.setTextColor(27,34,42);doc.text(ln,M+lw,st.y,{baseline:"top"});
      doc.setDrawColor(154,165,173);doc.setLineWidth(.2);doc.line(M+lw,st.y+5.8,M+TW,st.y+5.8);
      st.y+=7.6;
    });
    st.y+=1;
  };
  return {doc,st,M,TW,need,write,ruled};
}
function buildLetter(){
  const {doc,st,M,TW,need,write,ruled}=mkDoc();
  write("Letter of intent for LUMEN",{font:"helvetica",style:"bold",size:18,gap:1});
  write("Interest in prototype evaluation and professional feedback",{font:"helvetica",size:10.5,color:[85,99,110],gap:7});
  write("To the LUMEN founding team,",{gap:5});
  ruled("Practice or organisation:",S.practice);
  ruled("Meeting date:",fmtDate(S.meetingDate));
  ruled("Location or online:",S.meetingPlace);
  st.y+=2;
  write("Following our discussion of LUMEN, we express interest in its proposed approach to revising indoor lighting schemes when products, budgets or requirements change. The ability to explore replacement luminaires and permitted layout changes while preserving agreed design decisions could be relevant to our practice.",{gap:4});
  write("A revision problem or use case relevant to our work is:",{gap:1});
  ruled("",S.problem);
  st.y+=2;
  write("We understand that LUMEN is currently at concept stage. A working prototype and its technical performance, workflow benefits and commercial terms remain to be developed and evaluated.",{gap:4});
  write("Our intended involvement (tick only the options that apply):",{font:"helvetica",style:"bold",size:10,gap:2});
  S.involve.forEach((on,i)=>{
    const lines=doc.splitTextToSize(pdfClean(INVOLVE[i]),TW-8);
    need(lines.length*5.6+2);
    const y0=st.y;
    doc.setDrawColor(27,34,42);doc.setLineWidth(.35);doc.rect(M,y0+.7,3.8,3.8);
    if(on){doc.setLineWidth(.6);doc.line(M+.8,y0+2.7,M+1.7,y0+3.8);doc.line(M+1.7,y0+3.8,M+3.2,y0+1.3);}
    doc.setFont("times","normal");doc.setFontSize(11);doc.setTextColor(27,34,42);
    lines.forEach(ln=>{doc.text(ln,M+7,st.y,{baseline:"top"});st.y+=5.6;});
    st.y+=1.2;
  });
  st.y+=2;
  write("Participation would be subject to our availability and agreement on scope, timing, access and any costs. This letter records present interest and is not intended to create a binding obligation to participate, purchase, pay, provide data or enter an exclusive arrangement. Any pilot, purchase or data sharing would require separate agreement.",{gap:4});
  write("We permit the LUMEN team to include this signed letter in its Preseed funding application and related assessment. It must not be presented as a purchase order or proof of validated performance.",{gap:7});
  ruled("Name and role:",S.name+(S.role?", "+S.role:""));
  ruled("Professional email:",S.email);
  need(26);
  doc.setFont("helvetica","bold");doc.setFontSize(9.5);doc.setTextColor(85,99,110);doc.text("Signature:",M,st.y+1,{baseline:"top"});
  const sx=M+22;
  if(S.sigMode==="draw"&&S.sigData){
    const asp=S.sigW/S.sigH;let h=16,w=h*asp;if(w>64){w=64;h=w/asp;}
    doc.addImage(S.sigData,"PNG",sx,st.y-2,w,h);
  } else {
    doc.setFont("times","italic");doc.setFontSize(20);doc.setTextColor(27,34,42);doc.text(pdfClean(S.sigTyped),sx,st.y-1,{baseline:"top"});
  }
  doc.setDrawColor(154,165,173);doc.setLineWidth(.2);doc.line(sx,st.y+15,M+TW,st.y+15);
  st.y+=19;
  ruled("Date:",fmtDate(S.sigDate));
  st.y+=3;
  write("Completed through the LUMEN online form on "+fmtDate(todayISO)+".",{font:"helvetica",size:8.5,color:[85,99,110]});
  return doc;
}
function buildResponses(){
  const {doc,st,write}=mkDoc();
  write("LUMEN questionnaire responses",{font:"helvetica",style:"bold",size:18,gap:1});
  write("Completed "+fmtDate(todayISO)+" through the LUMEN online form",{font:"helvetica",size:10,color:[85,99,110],gap:6});
  qaList().forEach(x=>{
    if(x.h){st.y+=3;write(x.h,{font:"helvetica",style:"bold",size:12,gap:2});}
    else{write(x.q,{font:"helvetica",style:"bold",size:9.5,gap:.5,color:[85,99,110]});write(x.a||"(no answer)",{size:11,gap:3.5});}
  });
  return doc;
}
async function savePdf(kind,btn){
  const st=$("#status");
  if(!window.jspdf){st.textContent="The PDF tool did not load. Use “Copy your answers as text” below instead.";return;}
  const label=btn.textContent;btn.disabled=true;st.textContent="";
  try{
    const doc=kind==="letter"?buildLetter():buildResponses();
    const name=(kind==="letter"?"LUMEN_letter_of_intent_":"LUMEN_questionnaire_")+slug(S.practice)+".pdf";
    const buf=doc.output("arraybuffer");
    const url=URL.createObjectURL(new Blob([buf],{type:"application/pdf"}));
    const a=document.createElement("a");a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),4000);
    st.textContent="Saved “"+name+"”. Attach it to your email.";
    btn.textContent="Saved. Save again";
  }catch(err){
    st.textContent="The file could not be saved here. Use “Copy your answers as text” below instead.";
    btn.textContent=label;
  }
  btn.disabled=false;
}

async function submitToTeam(btn){
  const st=$("#status");
  if(!window.jspdf){st.textContent="The PDF tool did not load. Use “Copy your answers as text” below and email us instead.";return;}
  btn.disabled=true;st.textContent="Sending…";
  try{
    const fd=new FormData();
    fd.append("practice",S.practice);fd.append("name",S.name);fd.append("role",S.role);fd.append("email",S.email);
    fd.append("interest",GATES[S.gate]||"");
    fd.append("answers",JSON.stringify(qaList().filter(x=>!x.h)));
    fd.append("summary",summaryText());
    fd.append("responses_pdf",new Blob([buildResponses().output("arraybuffer")],{type:"application/pdf"}),"LUMEN_questionnaire_"+slug(S.practice)+".pdf");
    if(S.gate==="yes") fd.append("letter_pdf",new Blob([buildLetter().output("arraybuffer")],{type:"application/pdf"}),"LUMEN_letter_of_intent_"+slug(S.practice)+".pdf");
    const r=await fetch(SUBMIT_URL,{method:"POST",body:fd,headers:{Accept:"application/json"}});
    if(!r.ok) throw new Error("HTTP "+r.status);
    st.textContent="Sent. Thank you, we will be in touch.";btn.textContent="Sent";
  }catch(err){
    st.textContent="We could not send your response. Please save the files below and email them to us instead.";btn.disabled=false;
  }
}
const shareBtn=$("#share");
if(shareBtn) shareBtn.addEventListener("click",async()=>{
  const url=location.href.split("#")[0],n=$("#shareNote");
  try{ if(navigator.share){await navigator.share({title:document.title,url});return;} }catch(_){ return; }
  try{ await navigator.clipboard.writeText(url); n.textContent="Link copied."; }catch(_){ n.textContent=url; }
});

document.querySelector(".top .polar").innerHTML=polarInner();
go(0);
