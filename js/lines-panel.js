/* Text panel: one block per text field, size/leading/alignment, drag to reorder. */
"use strict";

/* ---------- панель строк ---------- */
var lineHost = document.getElementById('lineRows');
function buildLineRows(){
  var n = syncLines();
  lineHost.innerHTML = '';
  S.lines.forEach(function(L,i){
    var al = L.align || S.align;
    var wrap = document.createElement('div');
    wrap.className = 'lblock';
    wrap.draggable = true;
    wrap.dataset.i = i;
    wrap.innerHTML =
      '<div class="ltextrow">'+
        '<textarea class="ltext" data-f="text" spellcheck="false" rows="1">'+
          String(L.text).replace(/&/g,'&amp;').replace(/</g,'&lt;')+'</textarea>'+
        '<button class="lmain lgrip'+(i===S.main?' on':'')+'" data-act="main" title="Anchor line, drag to reorder">●</button>'+
      '</div>'+
      '<div class="lctl">'+
        '<div class="lchip" title="Cap height, px"><input class="num" data-f="capPx" type="number" step="1" min="1" value="'+lineCapPx(L)+'"></div>'+
        '<div class="lchip" title="Leading — spacing between wrapped lines in this field, % of size">'+
          '<input class="num" data-f="gap" type="number" step="1" value="'+L.gap+'"></div>'+
        '<span class="seg mini align">'+
          '<button data-a="left" title="Align left"'+(al==='left'?' class="on"':'')+'><i class="ico-l"></i></button>'+
          '<button data-a="center" title="Align centre"'+(al==='center'?' class="on"':'')+'><i class="ico-c"></i></button>'+
          '<button data-a="right" title="Align right"'+(al==='right'?' class="on"':'')+'><i class="ico-r"></i></button></span>'+
        (n>1 ? '<button class="ldel" data-act="del" title="Delete line">×</button>' : '')+
      '</div>';
    lineHost.appendChild(wrap);
  });
  scrubAll();
  requestAnimationFrame(function(){
    lineHost.querySelectorAll('.ltext').forEach(function(t){ autoGrow(t); });
  });
}
/* чип показывает высоту прописных в px — с учётом вертикального растяжения,
   как и замер на холсте */
function lineVs(L){ return Math.max(80, Math.min(120, L.vscale===undefined?100:L.vscale))/100; }
function lineCapPx(L){
  var capK = METRICS ? METRICS.cap/METRICS.upm : 0.7;
  return Math.round(S.size*(L.scale/100)*capK*lineVs(L));
}
function capPxToScale(px, L){
  var capK = METRICS ? METRICS.cap/METRICS.upm : 0.7;
  return Math.max(1, px/(S.size*capK*lineVs(L))*100);
}
/* обновить значения чипов без перестройки — фокус и курсор не теряются */
function refreshCapChips(){
  lineHost.querySelectorAll('input[data-f="capPx"]').forEach(function(inp){
    if(inp === document.activeElement) return;
    var i = rowIndex(inp);
    if(S.lines[i]) inp.value = lineCapPx(S.lines[i]);
  });
}
function autoGrow(ta){
  if(!ta) return;
  ta.style.height = '0px';
  ta.style.height = Math.max(ta.scrollHeight, 20) + 'px';
}
/* перенос строки перетаскиванием */
var dragRow = null;
lineHost.addEventListener('keydown', function(ev){
  if(ev.key!=='Enter') return;
  var ta = ev.target;
  if(!ta.classList || !ta.classList.contains('ltext')) return;
  if(ev.shiftKey) return;              /* Shift+Enter — мягкий перенос внутри строки */
  ev.preventDefault();                 /* Enter — новая строка-сущность */
  document.getElementById('lineAdd').click();
});
lineHost.addEventListener('dragstart', function(ev){
  var r = ev.target.closest('.lblock'); if(!r) return;
  if(ev.target.tagName === 'INPUT' || ev.target.tagName === 'TEXTAREA'){ ev.preventDefault(); return; }
  dragRow = +r.dataset.i;
  r.classList.add('drag');
  ev.dataTransfer.effectAllowed = 'move';
  try{ ev.dataTransfer.setData('text/plain', String(dragRow)); }catch(e){}
});
lineHost.addEventListener('dragover', function(ev){
  if(dragRow===null) return;
  ev.preventDefault();
  var r = ev.target.closest('.lblock');
  [].forEach.call(lineHost.children, function(c){ c.classList.remove('over'); });
  if(r) r.classList.add('over');
});
lineHost.addEventListener('drop', function(ev){
  if(dragRow===null) return;
  ev.preventDefault();
  var r = ev.target.closest('.lblock');
  if(r){
    var to = +r.dataset.i;
    if(to !== dragRow) reorderLine(dragRow, to);
  }
  dragRow = null;
});
lineHost.addEventListener('dragend', function(){
  dragRow = null;
  [].forEach.call(lineHost.children, function(c){ c.classList.remove('drag','over'); });
});
/* отступ принадлежит стыку, а не строке: после переноса цепочка сохраняет зазоры */
function reorderLine(from, to){
  var gaps = S.lines.map(function(L){ return L.gap; });
  var mainLine = S.lines[S.main];
  var moved = S.lines.splice(from,1)[0];
  S.lines.splice(to,0,moved);
  S.lines.forEach(function(L,i){ L.gap = gaps[i]; });
  S.main = S.lines.indexOf(mainLine);
  buildLineRows(); refit();
}
function rowIndex(el){ var b=el.closest('.lblock'); return b ? (+b.dataset.i) : -1; }
lineHost.addEventListener('input', function(ev){
  var inp = ev.target;
  if(inp.tagName!=='INPUT' && inp.tagName!=='TEXTAREA') return;
  var i = rowIndex(inp); if(i<0 || !S.lines[i]) return;
  if(inp.dataset.f === 'text'){
    S.lines[i].text = inp.value; autoGrow(inp); refit(); return;
  }
  var v = parseFloat(inp.value);
  if(isNaN(v)) return;
  if(inp.dataset.f === 'capPx'){ S.lines[i].scale = capPxToScale(v, S.lines[i]); refit(); return; }
  S.lines[i][inp.dataset.f] = v;
  render();
});
lineHost.addEventListener('change', function(ev){
  if(ev.target.tagName==='INPUT'){ refit(); }
});
lineHost.addEventListener('click', function(ev){
  var b = ev.target.closest('button'); if(!b) return;
  var i = rowIndex(b); if(i<0 || !S.lines[i]) return;
  var act = b.dataset.act;
  if(act==='del'){
    if(S.lines.length<2) return;
    S.lines.splice(i,1);
    if(S.main>=S.lines.length) S.main=S.lines.length-1;
    else if(S.main>i) S.main--;
    kernSel = null;
    buildLineRows(); refit(); return;
  }
  if(act==='main'){ S.main=i; buildLineRows(); render(); return; }
  if(!b.dataset.a) return;
  S.lines[i].align = b.dataset.a;
  [].forEach.call(b.parentNode.children,function(c){ c.classList.toggle('on', c===b); });
  refit();
});
document.getElementById('lineAdd').addEventListener('click', function(){
  syncLines();
  var last = S.lines[S.lines.length-1];
  S.lines.push({text:'', scale:last.scale, vscale:last.vscale, align:last.align, gap:last.gap||100});
  buildLineRows(); refit();
  var rows = lineHost.querySelectorAll('.ltext');
  if(rows.length) rows[rows.length-1].focus();
});
