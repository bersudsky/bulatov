/* Font metrics (cap height, x-height, ascender, descender) and the Vertical trim frame. */
"use strict";

/* ---------- метрики шрифта ---------- */
var METRICS = null;
function glyphBox(chars){
  for(var i=0;i<chars.length;i++){
    var idx = font.charToGlyphIndex(chars[i]);
    if(!idx) continue;
    try{
      var bb = font.glyphs.get(idx).getBoundingBox();
      if(bb && isFinite(bb.y1) && isFinite(bb.y2) && (bb.y2-bb.y1)>0) return bb;
    }catch(e){}
  }
  return null;
}
function computeMetrics(){
  if(!font){ METRICS=null; return; }
  var os2 = (font.tables && font.tables.os2) || {};
  var flatCap = glyphBox(['Н','H','Е','E','П','I','B','Т']);
  var flatX   = glyphBox(['н','x','и','z','п','v']);
  var tallAsc = glyphBox(['б','l','h','k','b','d','f']);
  var deep    = glyphBox(['у','р','p','y','g','q','ц','щ','j']);
  /* измерение по плоским глифам надёжнее OS/2 — её часто заполняют небрежно */
  var cap = (flatCap ? flatCap.y2 : 0) || (os2.sCapHeight>0 ? os2.sCapHeight : 0) || font.ascender*0.7;
  var xh  = (flatX ? flatX.y2 : 0)  || (os2.sxHeight>0 ? os2.sxHeight : 0)  || cap*0.72;
  var asc = tallAsc ? Math.max(tallAsc.y2, cap) : font.ascender;
  /* та же проверка для верха: если «строчные» или «выносные» практически совпали
     с прописными, значит их не измерить — лишние линии только путают классификацию */
  if(asc < cap + 0.02*font.unitsPerEm) asc = cap;
  if(xh > cap - 0.02*font.unitsPerEm) xh = cap;
  var descRaw = deep ? Math.min(deep.y1, 0) : font.descender;
  /* у титульных гарнитур в слотах строчных часто лежат прописные: измеренная
     «глубина» тогда равна овершуту, а не выносному элементу. Настоящий выносной
     уходит на 150–250‰ em, овершут — на 10–30‰, поэтому отсекаем по 60‰. */
  var desc = descRaw < -0.06*font.unitsPerEm ? descRaw : 0;
  METRICS = {cap:cap, xh:xh, asc:asc, desc:desc, upm:font.unitsPerEm};
}
/* Вертикальные границы — от линии прописных до базовой, а не по крайним точкам. */
function metricExtents(){
  if(!METRICS || !font) return null;
  var LL = lineLayout();
  var minY=1e9, maxY=-1e9, used=false;

  if(S.capBox){
    /* только прописные: рамка от линии прописных до базовой, выносные и овершуты
       снаружи — высота не зависит от того, какие буквы набраны */
    LL.forEach(function(ln){
      var hasGlyph = false;
      Array.from(ln.text).forEach(function(ch){
        if(!ch.trim()) return;
        if(font.charToGlyphIndex(ch)) hasGlyph = true;
      });
      if(!hasGlyph) return;
      used = true;
      var k = ln.size/METRICS.upm*ln.vs;
      var ty = ln.y - METRICS.cap*k;
      if(ty < minY) minY = ty;
      if(ln.y > maxY) maxY = ln.y;
    });
    return used ? {top:minY, bottom:maxY} : null;
  }

  /* по всем опорным линиям: каждый глиф относится к своей линии, рамка
     захватывает выносные, но овершуты и подрезки остаются снаружи */
  var topRefs=[];
  function addRef(v){
    for(var i=0;i<topRefs.length;i++) if(Math.abs(topRefs[i]-v)<=1) return;
    topRefs.push(v);
  }
  addRef(METRICS.cap); addRef(METRICS.xh); addRef(METRICS.asc);
  function nearestRef(v){
    var bv=topRefs[0], bd=Infinity;
    for(var i=0;i<topRefs.length;i++){ var d=Math.abs(topRefs[i]-v); if(d<bd){ bd=d; bv=topRefs[i]; } }
    return bv;
  }
  var hasDesc = METRICS.desc < -1;
  LL.forEach(function(ln){
    var k = ln.size/METRICS.upm*ln.vs, base = ln.y;
    Array.from(ln.text).forEach(function(ch){
      if(!ch.trim()) return;
      var idx = font.charToGlyphIndex(ch); if(!idx) return;
      var bb; try{ bb = font.glyphs.get(idx).getBoundingBox(); }catch(e){ return; }
      if(!bb || !isFinite(bb.y1) || !isFinite(bb.y2) || (bb.y2-bb.y1)<=0) return;
      used = true;
      /* на линию выносных глиф уходит только если опустился заметно ниже
         половины пути до неё — иначе это овершут круглой, место ему на базовой */
      var deepGlyph = hasDesc && bb.y1 < 0.45*METRICS.desc;
      var ty = base - nearestRef(bb.y2)*k;
      var by = base - (deepGlyph ? METRICS.desc : 0)*k;
      if(ty < minY) minY = ty;
      if(by > maxY) maxY = by;
    });
  });
  return used ? {top:minY, bottom:maxY} : null;
}
