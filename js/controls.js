/* Panel controls: scrubbable number fields, sliders, toggles, reset. */
"use strict";

/* ---------- числовые поля с протяжкой ---------- */
function scrubbable(inp){
  if(inp.dataset.scrub) return;
  inp.dataset.scrub = '1';
  var step = parseFloat(inp.step)||1, dec = (String(step).split('.')[1]||'').length;
  var snap = inp.dataset.snap!==undefined ? parseFloat(inp.dataset.snap) : null;
  function magnet(v){ return (snap!==null && Math.abs(v-snap)<=2) ? snap : v; }
  inp.addEventListener('pointerdown', function(ev){
    if(ev.button) return;
    ev.preventDefault();
    var sx=ev.clientX, v0=parseFloat(inp.value)||0, moved=false;
    inp.setPointerCapture(ev.pointerId);
    function clamp(v){
      var mn=parseFloat(inp.min), mx=parseFloat(inp.max);
      if(!isNaN(mn)) v=Math.max(v,mn);
      if(!isNaN(mx)) v=Math.min(v,mx);
      return v;
    }
    function mv(e){
      var d=e.clientX-sx;
      if(!moved && Math.abs(d)<3) return;
      moved = true;
      var unit = e.shiftKey ? step*10 : step;
      inp.value = magnet(clamp(v0 + Math.round(d/2)*unit)).toFixed(dec);
      inp.dispatchEvent(new Event('input',{bubbles:true}));
    }
    function up(){
      inp.releasePointerCapture(ev.pointerId);
      inp.removeEventListener('pointermove',mv);
      inp.removeEventListener('pointerup',up);
      if(moved) inp.dispatchEvent(new Event('change',{bubbles:true}));
      else inp.focus({preventScroll:true});
    }
    inp.addEventListener('pointermove',mv);
    inp.addEventListener('pointerup',up);
  });
  inp.addEventListener('keydown', function(ev){
    if(ev.key!=='ArrowUp' && ev.key!=='ArrowDown') return;
    ev.preventDefault();
    var unit = ev.shiftKey ? step*10 : step;
    var v = (parseFloat(inp.value)||0) + (ev.key==='ArrowUp'?unit:-unit);
    var mn=parseFloat(inp.min), mx=parseFloat(inp.max);
    if(!isNaN(mn)) v=Math.max(v,mn);
    if(!isNaN(mx)) v=Math.min(v,mx);
    inp.value = magnet(v).toFixed(dec);
    inp.dispatchEvent(new Event('input',{bubbles:true}));
    inp.dispatchEvent(new Event('change',{bubbles:true}));
  });
}
function scrubAll(){ document.querySelectorAll('.num').forEach(scrubbable); }

/* ---------- ввод ---------- */
/* прогресс-заливка плашки под слайдером */
function fillFor(r){
  var row=r.closest('.row'); if(!row) return;
  var f=row.querySelector('.fill');
  if(!f){ f=document.createElement('div'); f.className='fill'; row.insertBefore(f, row.firstChild); }
  var min=parseFloat(r.min), max=parseFloat(r.max), v=parseFloat(r.value);
  var pct=(max>min)?(v-min)/(max-min)*100:0;
  f.style.width=Math.max(0,Math.min(100,pct))+'%';
}
function initFills(){
  document.querySelectorAll('.row input[type=range]').forEach(function(r){
    fillFor(r);
    r.addEventListener('input',function(){ fillFor(r); });
  });
}
function pairNum(rangeId,numId,key){
  var r=document.getElementById(rangeId), n=document.getElementById(numId);
  function set(v,fit){
    v=parseFloat(v); if(isNaN(v)) return;
    S[key]=v; r.value=v; n.value=v; fillFor(r); if(fit) refit(); else render();
  }
  r.addEventListener('input',function(){set(r.value,false);});
  r.addEventListener('change',function(){set(r.value,true);});
  n.addEventListener('input',function(){set(n.value,false);});
  n.addEventListener('change',function(){set(n.value,true);});
}

pairNum('track','trackN','track');
pairNum('softLead','softLeadN','softLead');

function setAllVscale(v, fit){
  S.vscaleAll = v;
  syncLines();
  S.lines.forEach(function(L){ L.vscale = v; });
  refreshCapChips();
  if(fit) refit(); else render();
}
/* сторона рамки, которая ближе к горизонтали — от неё и растём */
function flatEdge(){
  if(!geo.bb) return null;
  var t0=hPos('c00'), t1=hPos('c10'), b0=hPos('c01'), b1=hPos('c11');
  var topTilt=Math.abs(t1[1]-t0[1]), botTilt=Math.abs(b1[1]-b0[1]);
  var top = topTilt<=botTilt;
  return { y:(top ? (t0[1]+t1[1]) : (b0[1]+b1[1]))/2, top:top };
}
(function(){
  var r=document.getElementById('vsAll'), n=document.getElementById('vsAllN');
  function set(v, fit){
    v=parseFloat(v); if(isNaN(v)) return;
    if(Math.abs(v-100)<=2) v=100;
    v=Math.max(80,Math.min(120,v));
    var e0=flatEdge();
    r.value=v; n.value=v; fillFor(r); setAllVscale(v, fit);
    var e1=flatEdge();
    if(e0 && e1){ view.y += (e1.y-e0.y); render(false); }
  }
  r.addEventListener('input',function(){set(r.value,false);});
  r.addEventListener('change',function(){set(r.value,false);});
  n.addEventListener('input',function(){set(n.value,false);});
  n.addEventListener('change',function(){set(n.value,false);});
})();


document.getElementById('mode').addEventListener('click',function(ev){
  var b=ev.target.closest('button'); if(!b) return;
  S.mode=b.dataset.m;
  [].forEach.call(this.children,function(c){c.classList.toggle('on', c===b);});
  refit();
});
document.getElementById('boxMetrics').addEventListener('change',function(){
  S.box = this.checked ? 'metrics' : 'ink';
  syncBoxUI(); refit();
});
document.getElementById('capBox').addEventListener('change',function(){
  S.capBox = this.checked;
  refit();
});
/* вторая галочка имеет смысл только в режиме метрик */
function syncBoxUI(){
  var on = (S.box === 'metrics'), row = document.getElementById('capBoxRow');
  document.getElementById('capBox').disabled = !on;
  row.style.opacity = on ? '' : '.45';
  row.style.pointerEvents = on ? '' : 'none';
}
document.getElementById('resetHandles').addEventListener('click',function(){
  pushUndo(); S.h = defaultHandles(); refit();
});
document.getElementById('kernReset').addEventListener('click',function(){
  pushUndo();
  S.lines.forEach(function(L){ L.kern = {}; });
  kernSel = null; render();
});
['kern','kernMode','snap','vlock','expFrame','mesh','guides','inv'].forEach(function(id){
  document.getElementById(id).addEventListener('change',function(){
    S[id]=this.checked;
    if(id==='kernMode' && !this.checked) kernSel=null;
    render();
  });
});
document.getElementById('fit').addEventListener('click',function(){ refit(); });

/* ---------- сброс ---------- */
function syncUI(){
  document.getElementById('track').value=S.track;
  document.getElementById('trackN').value=S.track;
  document.getElementById('softLead').value=S.softLead;
  document.getElementById('softLeadN').value=S.softLead;
  document.getElementById('vsAll').value=S.vscaleAll;
  document.getElementById('vsAllN').value=S.vscaleAll;
  document.querySelectorAll('.row input[type=range]').forEach(fillFor);
  ['kern','kernMode','snap','vlock','expFrame','mesh','guides','inv','remember'].forEach(function(id){ document.getElementById(id).checked=S[id]; });
  buildLineRows();
  [].forEach.call(document.getElementById('mode').children,function(c){
    c.classList.toggle('on', c.dataset.m===S.mode);
  });
  document.getElementById('boxMetrics').checked = (S.box==='metrics');
  document.getElementById('capBox').checked = !!S.capBox;
  syncBoxUI();
}
var resetBtn=document.getElementById('resetAll'), armed=null;
resetBtn.addEventListener('click',function(){
  if(!armed){
    armed=setTimeout(function(){ armed=null; resetBtn.classList.remove('armed'); resetBtn.textContent='Reset all settings'; },3000);
    resetBtn.classList.add('armed'); resetBtn.textContent='Tap again to confirm';
    return;
  }
  clearTimeout(armed); armed=null;
  resetBtn.classList.remove('armed'); resetBtn.textContent='Reset all settings';
  var keepLines=JSON.parse(JSON.stringify(S.lines)), keepMain=S.main, keepMem=S.remember;
  S = JSON.parse(JSON.stringify(DEF));
  S.lines = keepLines; S.main = keepMain;
  S.remember = keepMem;
  drag={key:null,start:null,axis:null};
  syncUI(); refit();
});
