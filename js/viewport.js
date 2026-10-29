/* Zoom, pan, keyboard shortcuts, window resize. */
"use strict";

/* ---------- масштаб и панорама ---------- */
function unitsPerPx(){ return view.w / Math.max(svg.clientWidth,1); }
function updateZoomLabel(){
  var el=document.getElementById('zoomVal');
  if(el) el.textContent = Math.round(100/unitsPerPx()) + '%';
}
function zoomAt(cx, cy, f){
  var scale = 1/unitsPerPx(), ns = scale*f;
  if(ns < 0.02) ns = 0.02;
  if(ns > 80) ns = 80;
  f = ns/scale;
  if(Math.abs(f-1) < 1e-6) return;
  var nw = view.w/f, nh = view.h/f;
  view.x = cx - (cx-view.x)*(nw/view.w);
  view.y = cy - (cy-view.y)*(nh/view.h);
  view.w = nw; view.h = nh;
}
function zoomCenter(f){ zoomAt(view.x+view.w/2, view.y+view.h/2, f); render(false); }
function zoomTo(scale){
  var f = scale/(1/unitsPerPx());
  zoomAt(view.x+view.w/2, view.y+view.h/2, f); render(false);
}
svg.addEventListener('wheel', function(ev){
  ev.preventDefault();
  var m = (ev.deltaMode===1 ? 16 : (ev.deltaMode===2 ? svg.clientHeight : 1));
  if(ev.ctrlKey || ev.metaKey){
    var p = toSvg(ev);
    zoomAt(p.x, p.y, Math.pow(1.0025, -ev.deltaY*m));
  } else {
    var u = unitsPerPx();
    if(ev.shiftKey && !ev.deltaX) view.x += ev.deltaY*m*u;
    else { view.x += ev.deltaX*m*u; view.y += ev.deltaY*m*u; }
  }
  render(false);
}, {passive:false});
document.getElementById('zoomIn').addEventListener('click',function(){ zoomCenter(1.25); });
document.getElementById('zoomOut').addEventListener('click',function(){ zoomCenter(1/1.25); });
document.getElementById('zoomVal').addEventListener('click',function(){ zoomTo(1); });
document.addEventListener('keydown', function(ev){
  var t=ev.target.tagName;
  if(t==='INPUT'||t==='TEXTAREA') return;   /* в полях — обычная отмена ввода */
  if((ev.metaKey||ev.ctrlKey) && (ev.key==='z'||ev.key==='Z'||ev.key==='я'||ev.key==='Я')){
    ev.preventDefault(); undo(); return;
  }
  if(ev.metaKey||ev.ctrlKey) return;
  if(ev.key==='='||ev.key==='+') { zoomCenter(1.25); }
  else if(ev.key==='-'||ev.key==='_') { zoomCenter(1/1.25); }
  else if(ev.key==='0') { fitView(); render(false); }
  else if(ev.key==='1') { zoomTo(1); }
  else return;
  ev.preventDefault();
});

window.addEventListener('resize',function(){ if(font) refit(); });
