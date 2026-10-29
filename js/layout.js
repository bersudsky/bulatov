/* Text layout: fields and wrapped rows, line height, leading, kerning, glyph outlines. */
"use strict";

/* ---------- строки набора ---------- */
/* строка — самостоятельная сущность: свой текст, кегль, отступ, выключка */
function syncLines(){
  if(!S.lines || !S.lines.length) S.lines = [{text:'', scale:100, vscale:100, align:null, gap:100}];
  S.lines.forEach(function(L){ if(L.text===undefined) L.text=''; });
  if(S.main===undefined || S.main<0 || S.main>=S.lines.length) S.main = 0;
  return S.lines.length;
}
/* кегль строки — % от общего; отступ — просвет до предыдущей строки в % от общего кегля.
   Опорная строка стоит на нуле, остальные отсчитываются цепочкой от неё */
function lineLayout(){
  syncLines();
  /* два независимых интервала, оба в % от кегля своего ряда:
       L.gap      — интерлиньяж внутри поля, между рядами Shift+Enter
       S.softLead — зазор между отдельными текстовыми полями */
  var out = [], mainRow = 0;
  var between = (S.softLead===undefined ? 120 : S.softLead);
  S.lines.forEach(function(L, li){
    var vs = Math.max(80, Math.min(120, L.vscale===undefined?100:L.vscale))/100;
    var scaleRel = L.scale/100;
    var parts = String(L.text).split('\n'), off = 0;
    if(li === S.main) mainRow = out.length;
    parts.forEach(function(t, k){
      out.push({text:t, size:S.size*scaleRel, track:S.track,
                align:(L.align||S.align), y:0, vs:vs,
                gap:(k===0 ? between : L.gap), li:li, off:off});
      off += Array.from(t).length + 1;   /* +1 — сам перенос */
    });
  });
  var m = mainRow;
  out[m].y = 0;
  var capK = METRICS ? METRICS.cap/METRICS.upm : 0.7;
  /* интерлиньяж от кегля (как в Фигме), но с поправкой на сжатие букв:
     базовая едет вместе с высотой прописных, поэтому визуальный просвет
     между краями строк не зависит от «Высота всех строк» */
  for(var i=m+1;i<out.length;i++){
    var lead = (out[i].gap/100)*out[i].size;
    var shrink = capK*out[i].size*(1 - out[i].vs);   // насколько ниже стали буквы
    out[i].y = out[i-1].y + lead - shrink;
  }
  for(var j=m-1;j>=0;j--){
    var lead2 = (out[j+1].gap/100)*out[j+1].size;
    var shrink2 = capK*out[j+1].size*(1 - out[j+1].vs);
    out[j].y = out[j+1].y - lead2 + shrink2;
  }
  return out;
}

/* ---------- контуры текста ---------- */
var LAYOUT_X = [];    /* фактические левый и правый край каждой строки */
var GLYPH_HIT = [];   /* боксы букв в координатах текста для клика */
var kernSel = null;   /* {li, j} выбранная буква для кернинга */
/* сжатие глифов по вертикали относительно базовой линии строки */
function squashY(cmds, base, vs){
  return cmds.map(function(c){
    var o={type:c.type};
    if(c.x!==undefined){ o.x=c.x; o.y=base+(c.y-base)*vs; }
    if(c.x1!==undefined){ o.x1=c.x1; o.y1=base+(c.y1-base)*vs; }
    if(c.x2!==undefined){ o.x2=c.x2; o.y2=base+(c.y2-base)*vs; }
    return o;
  });
}
function buildPath(){
  var LL = lineLayout();
  GLYPH_HIT = [];
  var data = LL.map(function(ln){
    var sc = ln.size/font.unitsPerEm, trk = ln.track/100*ln.size;
    var chars = Array.from(ln.text);
    var glyphs = chars.map(function(c){return font.charToGlyph(c);});
    var kern = (S.lines[ln.li] && S.lines[ln.li].kern) || {};
    var adv=[], w=0;
    for(var i=0;i<glyphs.length;i++){
      var a = (glyphs[i].advanceWidth||0)*sc;
      if(S.kern && i<glyphs.length-1){
        try{ a += font.getKerningValue(glyphs[i],glyphs[i+1])*sc; }catch(e){}
      }
      a += trk;
      if(kern[ln.off+i]) a += kern[ln.off+i]/100*ln.size;    // ручной кернинг после буквы i
      adv.push(a); w += a;
    }
    if(adv.length) w -= trk;
    return {chars:chars, adv:adv, w:w, ln:ln, trk:trk};
  });
  function offset(align, total, w){
    return align==='center' ? (total-w)/2 : (align==='right' ? total-w : 0);
  }
  var maxW = Math.max.apply(null, data.map(function(d){return d.w;}).concat([1]));
  var cmds = [];
  LAYOUT_X = [];
  data.forEach(function(d, li){
    var x = offset(d.ln.align, maxW, d.w), x0 = x;
    d.chars.forEach(function(ch,j){
      if(ch !== ' '){
        var cs = font.getPath(ch, x, d.ln.y, d.ln.size, {kerning:false}).commands;
        if(d.ln.vs !== 1) cs = squashY(cs, d.ln.y, d.ln.vs);
        cmds = cmds.concat(cs);
      }
      GLYPH_HIT.push({li:d.ln.li, j:d.ln.off+j, last:(j===d.chars.length-1), x0:x, x1:x+d.adv[j],
                      yTop:d.ln.y-d.ln.size, yBot:d.ln.y+d.ln.size*0.3,
                      gapX:x+d.adv[j]});   // gapX — позиция стыка после буквы j
      x += d.adv[j];
    });
    LAYOUT_X[li] = {x0:x0, x1:x - d.trk};
  });
  return cmds;
}

function flatten(cmds, q){
  var step = 34/(q||QUALITY), subs=[], cur=null, px=0,py=0,sx=0,sy=0;
  function dist(ax,ay,bx,by){return Math.hypot(bx-ax,by-ay);}
  function nSeg(len,mn){ var n=Math.ceil(len/step); return Math.max(mn, Math.min(n,200)); }
  function close(){ if(cur && cur.pts.length>2) subs.push(cur); cur=null; }
  for(var i=0;i<cmds.length;i++){
    var c=cmds[i], a;
    if(c.type==='M'){ close(); cur={pts:[[c.x,c.y]], segs:[]}; px=sx=c.x; py=sy=c.y; }
    else if(!cur){ continue; }
    else if(c.type==='L'){
      a=cur.pts.length-1;
      var n=nSeg(dist(px,py,c.x,c.y),4);
      for(var k=1;k<=n;k++){var t=k/n;cur.pts.push([px+(c.x-px)*t, py+(c.y-py)*t]);}
      cur.segs.push({a:a,b:cur.pts.length-1,line:true});
      px=c.x;py=c.y;
    }
    else if(c.type==='C' || c.type==='Q'){
      a=cur.pts.length-1;
      var c1,c2,len;
      if(c.type==='C'){
        c1=[c.x1,c.y1]; c2=[c.x2,c.y2];
        len=dist(px,py,c.x1,c.y1)+dist(c.x1,c.y1,c.x2,c.y2)+dist(c.x2,c.y2,c.x,c.y);
      } else {
        c1=[px+2/3*(c.x1-px), py+2/3*(c.y1-py)];
        c2=[c.x+2/3*(c.x1-c.x), c.y+2/3*(c.y1-c.y)];
        len=dist(px,py,c.x1,c.y1)+dist(c.x1,c.y1,c.x,c.y);
      }
      var n2=nSeg(len,10);
      for(var k2=1;k2<=n2;k2++){ cur.pts.push(bez([px,py],c1,c2,[c.x,c.y],k2/n2)); }
      cur.segs.push({a:a,b:cur.pts.length-1,line:false});
      px=c.x;py=c.y;
    }
    else if(c.type==='Z'){
      if(cur){
        if(dist(px,py,sx,sy)>1e-6){
          a=cur.pts.length-1;
          var n3=nSeg(dist(px,py,sx,sy),4);
          for(var k3=1;k3<=n3;k3++){var t3=k3/n3;cur.pts.push([px+(sx-px)*t3, py+(sy-py)*t3]);}
          cur.segs.push({a:a,b:cur.pts.length-1,line:true});
        }
        close();
      }
      px=sx;py=sy;
    }
  }
  close();
  return subs;
}
