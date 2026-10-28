/* Hero light-distribution diagram. Same drawing as polarInner()/lobePath() in ../lumen-form/app.js, shown full size. */
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
