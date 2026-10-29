/* Loading a font file and the font card. */
"use strict";

/* ---------- загрузка шрифта ---------- */
function loadBuffer(buf, name, fromStore){
  try{
    font = opentype.parse(buf);
  }catch(err){
    document.getElementById('fontinfo').innerHTML='<b style="color:var(--accent)">Can\u2019t read this file.</b> If it\u2019s woff2, re-save it as ttf or otf.';
    return;
  }
  computeMetrics();
  refreshCapChips();
  var fam = (font.names.fullName && (font.names.fullName.ru||font.names.fullName.en)) ||
            (font.names.fontFamily && (font.names.fontFamily.ru||font.names.fontFamily.en)) || name;
  showFontCard(fam);
  refit();
  if(!fromStore) saveFont(buf, name);
}
/* карточка шрифта: имя плюс образец, набранный самим шрифтом */
function hasAll(t){
  for(var i=0;i<t.length;i++){
    if(t[i]===' ') continue;
    if(!font.charToGlyphIndex(t[i])) return false;
  }
  return true;
}
function showFontCard(fam){
  document.getElementById('fontinfo').textContent = '';
  document.getElementById('dropEmpty').hidden = true;
  document.getElementById('dropLoaded').hidden = false;
  var nameEl = document.getElementById('fontName');
  nameEl.textContent = fam;
  nameEl.title = fam;

  var svg = document.getElementById('fontSample');
  svg.innerHTML = '';
  var sample = ['AaBbCc', 'АаБбВв', fam].filter(hasAll)[0];
  if(!sample) return;
  var d;
  try{ d = font.getPath(sample, 0, 0, 100, {kerning:true}); }catch(e){ return; }
  var bb;
  try{ bb = d.getBoundingBox(); }catch(e){ return; }
  if(!bb || !isFinite(bb.x1) || (bb.x2-bb.x1)<=0 || (bb.y2-bb.y1)<=0) return;
  var pad = 4;
  svg.setAttribute('viewBox',
    (bb.x1-pad)+' '+(bb.y1-pad)+' '+((bb.x2-bb.x1)+pad*2)+' '+((bb.y2-bb.y1)+pad*2));
  var el = document.createElementNS('http://www.w3.org/2000/svg','path');
  el.setAttribute('d', d.toPathData(2));
  el.setAttribute('fill','currentColor');
  svg.appendChild(el);
}
function readFile(f){
  if(!f) return;
  var r=new FileReader();
  r.onload=function(){ loadBuffer(r.result, f.name); };
  r.readAsArrayBuffer(f);
}
var drop=document.getElementById('drop'), fileInput=document.getElementById('file');
drop.addEventListener('click',function(){fileInput.click();});
fileInput.addEventListener('change',function(){readFile(this.files[0]);});
['dragenter','dragover'].forEach(function(e){
  drop.addEventListener(e,function(ev){ev.preventDefault();drop.classList.add('over');});
});
['dragleave','drop'].forEach(function(e){
  drop.addEventListener(e,function(ev){ev.preventDefault();drop.classList.remove('over');});
});
window.addEventListener('dragover',function(e){e.preventDefault();});
window.addEventListener('drop',function(e){e.preventDefault(); if(e.dataTransfer.files[0]) readFile(e.dataTransfer.files[0]);});
