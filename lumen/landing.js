/* LUMEN narrative page: light-distribution diagram, scroll reveals, pinned step story, option viewer. */
document.documentElement.classList.remove("no-js");

/* Light-distribution diagram. Same drawing as polarInner()/lobePath() in ../lumen-form/app.js. */
(function(){
  const R = 92, svg = document.getElementById("polar");
  if(!svg) return;
  let s="";
  [.25,.5,.75,1].forEach(k=>s+=`<circle class="ring" r="${R*k}"/>`);
  for(let a=0;a<180;a+=30){const t=a*Math.PI/180;s+=`<line class="spoke" x1="${(-R*Math.sin(t)).toFixed(1)}" y1="${(-R*Math.cos(t)).toFixed(1)}" x2="${(R*Math.sin(t)).toFixed(1)}" y2="${(R*Math.cos(t)).toFixed(1)}"/>`;}
  let d="";const n=180;
  for(let i=0;i<=n;i++){
    const f=i/n*2*Math.PI;
    const g=Math.pow(Math.max(0,Math.cos(f)),1.2)*(0.62+0.38*Math.pow(Math.cos(3*f),2));
    const r=R*(0.1+0.9*g);
    d+=(i?"L":"M")+(r*Math.sin(f)).toFixed(2)+" "+(r*Math.cos(f)).toFixed(2);
  }
  s+=`<path class="lobe" d="${d}Z"/><circle class="src" r="2.6"/>`;
  s+=`<text class="lbl" x="0" y="${R+11}" text-anchor="middle">0°</text><text class="lbl" x="${R+6}" y="3">90°</text><text class="lbl" x="${-R-6}" y="3" text-anchor="end">90°</text><text class="lbl" x="0" y="${-R-5}" text-anchor="middle">180°</text>`;
  svg.innerHTML=s;
})();

/* Fade sections in as they scroll into view. Without IntersectionObserver, show everything. */
(function(){
  const els=document.querySelectorAll(".reveal");
  if(!("IntersectionObserver" in window)){els.forEach(e=>e.classList.add("in"));return;}
  const io=new IntersectionObserver(entries=>{
    entries.forEach(e=>{if(e.isIntersecting){e.target.classList.add("in");io.unobserve(e.target);}});
  },{rootMargin:"0px 0px -10% 0px",threshold:.12});
  els.forEach(e=>io.observe(e));
})();

/* Option viewer: three options x three views. Values match the demo run on the classroom brief. */
(function(){
  const img=document.getElementById("opt-img");
  if(!img) return;
  const OPT={
    a:{tag:"Brightest",ok:true,what:"30 × pendant, 636 lm",prod:"Cooper Halo RL706830 · hung at 1.9 m",avg:"471 lx",uni:"0.55",pow:"414 W",en:"1035 kWh/yr"},
    b:{tag:"Lowest power",ok:false,what:"16 × pendant, 1120 lm",prod:"Cooper Halo FMNL1112 · hung at 2.4 m",avg:"321 lx",uni:"0.52",pow:"200 W",en:"500 kWh/yr"},
    c:{tag:"Balanced",ok:false,what:"20 × pendant, 1120 lm",prod:"Cooper Halo FMNL1112 · hung at 2.4 m",avg:"399 lx",uni:"0.52",pow:"250 W",en:"625 kWh/yr"}
  };
  const VIEW={front:"front view",back:"back view",plan:"view from above"};
  let opt="a",view="front";
  const $=id=>document.getElementById(id);
  const reduce=window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  // Warm the cache so switching is instant, but only once the viewer is about to be
  // seen: preloading at page load would fetch ~1.2 MB a visitor may never scroll to,
  // ahead of the hero, and undo the images' loading="lazy".
  const warm=()=>Object.keys(OPT).forEach(o=>Object.keys(VIEW).forEach(v=>{const i=new Image();i.src=`img/option-${o}-${v}.jpg`;}));
  if("IntersectionObserver" in window){
    const wio=new IntersectionObserver(es=>{if(es.some(e=>e.isIntersecting)){wio.disconnect();warm();}},{rootMargin:"600px 0px"});
    wio.observe(img);
  }

  let swapTimer=0;
  function render(){
    const o=OPT[opt];
    const src=`img/option-${opt}-${view}.jpg`, alt=`Option ${opt.toUpperCase()}, ${VIEW[view]} of the rendered classroom.`;
    if(reduce){img.src=src;img.alt=alt;}
    else{
      // Only the latest click may swap the image: cancel a pending swap so quick
      // clicks (B then C) never flash the earlier option.
      clearTimeout(swapTimer);
      img.classList.add("swap");
      swapTimer=setTimeout(()=>{img.src=src;img.alt=alt;img.classList.remove("swap");},180);
    }
    $("opt-tag").textContent=o.tag;
    const st=$("opt-status");st.textContent=o.ok?"Meets the brief":"Needs review";st.className="status "+(o.ok?"ok":"review");
    $("opt-what").textContent=o.what;$("opt-prod").textContent=o.prod;
    $("opt-avg").textContent=o.avg;$("opt-pow").textContent=o.pow;$("opt-en").textContent=o.en;
    $("opt-uni").innerHTML=o.uni+(o.ok?"":'<span class="flag">REVIEW</span>');
  }
  function bind(attr,set){
    document.querySelectorAll(`[data-${attr}]`).forEach(b=>b.addEventListener("click",()=>{
      set(b.dataset[attr]);
      document.querySelectorAll(`[data-${attr}]`).forEach(x=>x.setAttribute("aria-pressed",String(x===b)));
      render();
    }));
  }
  bind("opt",v=>opt=v);
  bind("view",v=>view=v);
})();

/* Pinned "how it works" story: the beat nearest the middle of the screen picks the stage layer. */
(function(){
  const beats=[...document.querySelectorAll(".beat")], layers=[...document.querySelectorAll(".stage .layer")];
  if(!beats.length) return;
  function show(step){
    beats.forEach(b=>b.classList.toggle("is-on",b.dataset.step===step));
    layers.forEach(l=>l.classList.toggle("is-on",l.dataset.step===step));
  }
  show("1");
  if(!("IntersectionObserver" in window)) return;
  const io=new IntersectionObserver(entries=>{
    entries.forEach(e=>{if(e.isIntersecting) show(e.target.dataset.step);});
  },{rootMargin:"-45% 0px -45% 0px"});
  beats.forEach(b=>io.observe(b));
})();
