/* Saved states and sets of four mirrored variations. */
"use strict";

/* ---------- сохранённые состояния ---------- */
var K_PRESETS='typewarp:presets', PRESETS=[];
var presetList=document.getElementById('presetList');
var presetName=document.getElementById('presetName');

function presetSnapshot(){
  var o=JSON.parse(JSON.stringify(S));
  delete o.remember; delete o.vscaleAll;
  return o;
}
/* зеркальные варианты огибающей: точки меняются местами так,
   чтобы сохранился порядок обхода и роли контрольных точек рёбер */
function mirrorX(h){
  function P(k){ return [1-h[k][0], h[k][1]]; }
  return {c00:P('c10'), t1:P('t2'), t2:P('t1'), c10:P('c00'),
          r1:P('l1'), r2:P('l2'), c11:P('c01'), b2:P('b1'), b1:P('b2'),
          c01:P('c11'), l2:P('r2'), l1:P('r1')};
}
function mirrorY(h){
  function P(k){ return [h[k][0], 1-h[k][1]]; }
  return {c00:P('c01'), t1:P('b1'), t2:P('b2'), c10:P('c11'),
          r1:P('r2'), r2:P('r1'), c11:P('c10'), b2:P('t2'), b1:P('t1'),
          c01:P('c00'), l2:P('l1'), l1:P('l2')};
}
/* иконка: силуэт огибающей, вписанный в рамку превью */
function presetIcon(st, ar){
  var h = st && st.h; if(!h) return '';
  ar = (isFinite(ar) && ar>0.05) ? ar : 4;
  var pts=[];
  function edge(a,b,c,d){
    for(var i=0;i<=12;i++){ var q=bez(h[a],h[b],h[c],h[d],i/12); pts.push([q[0]*ar, q[1]]); }
  }
  edge('c00','t1','t2','c10');
  edge('c10','r1','r2','c11');
  edge('c11','b2','b1','c01');
  edge('c01','l2','l1','c00');
  var nx=1e9,ny=1e9,xx=-1e9,xy=-1e9;
  pts.forEach(function(q){
    if(!isFinite(q[0])||!isFinite(q[1])) return;
    if(q[0]<nx)nx=q[0]; if(q[0]>xx)xx=q[0];
    if(q[1]<ny)ny=q[1]; if(q[1]>xy)xy=q[1];
  });
  var w=Math.max(xx-nx,1e-6), hh=Math.max(xy-ny,1e-6);
  var W=28, H=19, pad=2.5;
  var k=Math.min((W-pad*2)/w, (H-pad*2)/hh);
  var ox=(W-w*k)/2 - nx*k, oy=(H-hh*k)/2 - ny*k;
  var d='';
  pts.forEach(function(q,i){
    d += (i?'L':'M') + (q[0]*k+ox).toFixed(1) + ' ' + (q[1]*k+oy).toFixed(1);
  });
  return '<svg class="picon" viewBox="0 0 '+W+' '+H+'"><path d="'+d+'Z" fill="currentColor"/></svg>';
}
function renderPresets(){
  presetList.innerHTML='';
  if(!PRESETS.length){
    presetList.innerHTML='<div class="hint">Everything is saved except the font file itself.</div>';
    return;
  }
  PRESETS.forEach(function(pr,i){
    presetList.appendChild(pr.items ? setRow(pr,i) : singleRow(pr,i));
  });
}
function removePreset(i){ PRESETS.splice(i,1); persistPresets(); renderPresets(); }
/* поле имени: Enter — сохранить, Escape — вернуть, пустое имя не принимается */
function wireRename(el, pr){
  el.value = pr.name;
  function commit(){
    var v = el.value.trim();
    if(!v){ el.value = pr.name; return; }
    if(v === pr.name) return;
    pr.name = v; persistPresets();
  }
  el.addEventListener('change', commit);
  el.addEventListener('blur', commit);
  el.addEventListener('keydown', function(ev){
    if(ev.key==='Enter'){ ev.preventDefault(); el.blur(); }
    if(ev.key==='Escape'){ el.value = pr.name; el.blur(); }
  });
}
function singleRow(pr,i){
  var r=document.createElement('div');
  r.className='prow';
  r.innerHTML='<button class="papply" title="Apply state">'+presetIcon(pr.state, pr.ar)+'</button>'+
    '<input class="pname" spellcheck="false" title="Rename state">'+
    '<button class="pdel" title="Delete state">×</button>';
  wireRename(r.querySelector('.pname'), pr);
  r.querySelector('.papply').addEventListener('click',function(){ applyPreset(i); });
  r.querySelector('.pdel').addEventListener('click',function(){ removePreset(i); });
  return r;
}
/* набор — одна запись со списком вариантов; плитки применяются по клику */
function setRow(pr,i){
  var box=document.createElement('div');
  box.className='pset';
  var head=document.createElement('div');
  head.className='psethead';
  head.innerHTML='<input class="psetname" spellcheck="false" title="Rename set">'+
    '<span class="psetcount">'+pr.items.length+'</span>'+
    '<button class="pdel" title="Delete set">×</button>';
  wireRename(head.querySelector('.psetname'), pr);
  head.querySelector('.pdel').addEventListener('click',function(){ removePreset(i); });
  box.appendChild(head);
  var grid=document.createElement('div');
  grid.className='psetgrid';
  pr.items.forEach(function(it,j){
    var b=document.createElement('button');
    b.className='pvar';
    b.title=it.label || pr.name;
    b.innerHTML=presetIcon(it.state, it.ar);
    b.addEventListener('click',function(){ applyPreset(i,j); });
    grid.appendChild(b);
  });
  box.appendChild(grid);
  return box;
}
function applyPreset(i, j){
  var pr=PRESETS[i]; if(!pr) return;
  var st=(pr.items && j!==undefined) ? (pr.items[j] && pr.items[j].state) : pr.state;
  if(!st) return;
  CURRENT_PRESET = pr.items ? null : pr;   /* от одиночного состояния наследуется имя набора */
  pushUndo();
  Object.keys(st).forEach(function(k){ if(k in S) S[k]=JSON.parse(JSON.stringify(st[k])); });
  PREV = null; kernSel = null;
  syncUI(); refit();
}
var CURRENT_PRESET = null;   /* состояние, с которым сейчас работаем */
/* одноимённые записи не перетирают друг друга: к имени добавляется номер */
function uniqueName(base){
  var used={};
  PRESETS.forEach(function(p){ used[p.name]=1; });
  if(!used[base]) return base;
  var n=2;
  while(used[base+' '+n]) n++;
  return base+' '+n;
}
function persistPresets(){
  if(!STORE) return;
  STORE.set(K_PRESETS, JSON.stringify(PRESETS), false).catch(function(){
    memSay('Browser storage is full — the last state could not be saved.');
  });
}
document.getElementById('presetSave').addEventListener('click',function(){
  var nm=(presetName.value||'').trim() || ('state '+(PRESETS.length+1));
  var ex=-1;
  PRESETS.forEach(function(p,i){ if(p.name===nm && !p.items) ex=i; });
  var rec={name:nm, state:presetSnapshot(), ar:(geo.bb ? geo.bb.w/geo.bb.h : 4)};
  if(ex>=0) PRESETS[ex]=rec; else PRESETS.push(rec);
  CURRENT_PRESET = rec;
  presetName.value='';
  persistPresets(); renderPresets();
});
document.getElementById('presetMirror').addEventListener('click',function(){
  var typed=(presetName.value||'').trim();
  /* поле имени важнее; иначе берём имя состояния, из которого делаем набор */
  var inherited = (CURRENT_PRESET && PRESETS.indexOf(CURRENT_PRESET)>=0)
                    ? CURRENT_PRESET.name+' set' : '';
  var base = typed || inherited || 'variant';
  var ar=(geo.bb ? geo.bb.w/geo.bb.h : 4);
  var h0=JSON.parse(JSON.stringify(S.h));
  var variants=[
    {label:'Original',         h:h0},
    {label:'Mirrored',         h:mirrorX(h0)},
    {label:'Flipped',          h:mirrorY(h0)},
    {label:'Flipped mirrored', h:mirrorY(mirrorX(h0))}
  ];
  var items=variants.map(function(v){
    var st=presetSnapshot(); st.h=v.h;
    return {label:v.label, state:st, ar:ar};
  });
  PRESETS.push({name:uniqueName(base), items:items});
  presetName.value='';
  persistPresets(); renderPresets();
});
presetName.addEventListener('keydown',function(ev){
  if(ev.key==='Enter'){ ev.preventDefault(); document.getElementById('presetSave').click(); }
});
function loadPresets(){
  if(!STORE){ renderPresets(); return; }
  STORE.get(K_PRESETS,false).then(function(r){
    if(r && r.value){ var a=JSON.parse(r.value); if(Array.isArray(a)) PRESETS=a; }
  }).catch(function(){}).then(function(){ renderPresets(); });
}
