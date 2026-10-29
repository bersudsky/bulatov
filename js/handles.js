/* Dragging envelope points, snapping to whole degrees, manual kerning, undo. */
"use strict";

/* рёбра, прилегающие к углу: горизонтальное слева направо, вертикальное сверху вниз */
var EDGES = {
  c00:{h:['c00','c10'], v:['c00','c01']},
  c10:{h:['c00','c10'], v:['c10','c11']},
  c11:{h:['c01','c11'], v:['c10','c11']},
  c01:{h:['c01','c11'], v:['c00','c01']}
};
/* прилипание: только целые градусы */
function quantAngle(a){
  return Math.round(a);
}
/* ставим угол так, чтобы оба прилегающих ребра имели целые углы:
   пересечение двух прямых, проведённых от неподвижных концов рёбер */
function snapCorner(key, nu, nv){
  var bb=geo.bb, e=EDGES[key];
  var Px=bb.x+nu*bb.w, Py=bb.y+nv*bb.h;
  var Aw = hPos(e.h[0]===key ? e.h[1] : e.h[0]);   // неподвижный конец гориз. ребра
  var Bw = hPos(e.v[0]===key ? e.v[1] : e.v[0]);   // неподвижный конец верт. ребра
  // текущие углы рёбер от неподвижных концов к точке
  var hAng = -Math.atan2(Py-Aw[1], Px-Aw[0])*180/Math.PI;
  var vAng =  Math.atan2(Px-Bw[0], Py-Bw[1])*180/Math.PI;
  if(e.h[0]===key) hAng = -Math.atan2(Aw[1]-Py, Aw[0]-Px)*180/Math.PI;
  if(e.v[0]===key) vAng =  Math.atan2(Bw[0]-Px, Bw[1]-Py)*180/Math.PI;
  var h = quantAngle(hAng), v = quantAngle(vAng);
  // пересечение двух лучей под целыми углами
  var hr=-h*Math.PI/180, vr=v*Math.PI/180;
  var dh=[Math.cos(hr), Math.sin(hr)], dv=[Math.sin(vr), Math.cos(vr)];
  var den = dv[0]*dh[1] - dh[0]*dv[1];
  if(Math.abs(den) < 1e-6) return [nu,nv];
  var t = (dv[0]*(Bw[1]-Aw[1]) - (Bw[0]-Aw[0])*dv[1]) / den;
  var qx = Aw[0] + t*dh[0], qy = Aw[1] + t*dh[1];
  if(!isFinite(qx) || !isFinite(qy)) return [nu,nv];
  if(Math.hypot(qx-Px, qy-Py) > 0.5*Math.max(bb.w,bb.h)) return [nu,nv];
  return [(qx-bb.x)/bb.w, (qy-bb.y)/bb.h];
}

function cornerAngles(key){
  var e=EDGES[key], a=hPos(e.h[0]), b=hPos(e.h[1]), c=hPos(e.v[0]), d=hPos(e.v[1]);
  return {
    h: -Math.atan2(b[1]-a[1], b[0]-a[0])*180/Math.PI,   // вверх вправо — плюс
    v:  Math.atan2(d[0]-c[0], d[1]-c[1])*180/Math.PI    // завал вправо — плюс
  };
}

/* ---------- отмена ---------- */
var UNDO=[];
/* в снимке — огибающая и ручной кернинг */
function pushUndo(){
  UNDO.push(JSON.stringify({h:S.h, kern:S.lines.map(function(L){ return L.kern || {}; })}));
  if(UNDO.length>60) UNDO.shift();
}
function undo(){
  if(!UNDO.length) return;
  var u = JSON.parse(UNDO.pop());
  S.h = u.h;
  if(u.kern && u.kern.length === S.lines.length) S.lines.forEach(function(L,i){ L.kern = u.kern[i]; });
  render();
}

/* ---------- перетаскивание точек ---------- */
var drag = {key:null};
var LINK = {
  c00:[['t1',2/3],['t2',1/3],['l1',2/3],['l2',1/3]],
  c10:[['t2',2/3],['t1',1/3],['r1',2/3],['r2',1/3]],
  c11:[['b2',2/3],['b1',1/3],['r2',2/3],['r1',1/3]],
  c01:[['b1',2/3],['b2',1/3],['l2',2/3],['l1',1/3]]
};
function toSvg(ev){
  var pt = svg.createSVGPoint(); pt.x=ev.clientX; pt.y=ev.clientY;
  return pt.matrixTransform(svg.getScreenCTM().inverse());
}
var pan = {on:false, x:0, y:0, vx:0, vy:0};
svg.addEventListener('pointerdown', function(ev){
  var key = ev.target.getAttribute && ev.target.getAttribute('data-key');
  if(S.kernMode && !key){
    var hit = glyphAt(toSvg(ev));
    if(hit){
      pushUndo();
      kernSel = {li:hit.li, j:hit.j};
      kernDrag = {startX:ev.clientX,
                  base:(S.lines[hit.li].kern && S.lines[hit.li].kern[hit.j]) || 0};
      svg.setPointerCapture(ev.pointerId);
      render();
      return;
    }
    if(kernSel){ kernSel = null; render(); }   /* мимо стыка — снять выбор и двигать холст */
  }
  if(!key){
    pan.on=true; pan.x=ev.clientX; pan.y=ev.clientY; pan.vx=view.x; pan.vy=view.y;
    svg.setPointerCapture(ev.pointerId);
    document.querySelector('.stage').classList.add('panning');
    return;
  }
  pushUndo();
  drag.key=key; drag.start=[S.h[key][0], S.h[key][1]]; drag.axis=null;
  svg.setPointerCapture(ev.pointerId);
  document.getElementById('hudDrag').innerHTML = 'POINT <b>'+key.toUpperCase()+'</b>';
  render();
});
var kernDrag = null;
/* ближайший стык между буквами под точкой холста */
function glyphAt(p){
  if(!geo.bb) return null;
  var bb=geo.bb, best=null;
  for(var i=0;i<GLYPH_HIT.length;i++){
    var g=GLYPH_HIT[i];
    if(g.last) continue;   // нет стыка после последней буквы ряда
    var cy=(g.yTop+g.yBot)/2;
    var q=warpUV((g.gapX-bb.x)/bb.w,(cy-bb.y)/bb.h);
    var wx=bb.x+q[0]*bb.w, wy=bb.y+q[1]*bb.h;
    var d=Math.hypot(p.x-wx, p.y-wy);
    if(best===null || d<best.d) best={d:d, g:g};
  }
  if(best && best.d < geo.bb.h*0.6) return best.g;
  return null;
}
svg.addEventListener('pointermove', function(ev){
  if(kernDrag && kernSel){
    var ln = S.lines[kernSel.li];
    if(!ln.kern) ln.kern = {};
    var dpx = (ev.clientX - kernDrag.startX) * unitsPerPx();
    var size = S.size*(ln.scale/100);
    var val = kernDrag.base + dpx/size*100;      // сдвиг в % от кегля строки
    ln.kern[kernSel.j] = Math.round(val*10)/10;
    render();
    return;
  }
  if(pan.on){
    var u = unitsPerPx();
    view.x = pan.vx - (ev.clientX-pan.x)*u;
    view.y = pan.vy - (ev.clientY-pan.y)*u;
    render(false);
    return;
  }
  if(!drag.key || !geo.bb) return;
  var p = toSvg(ev), bb=geo.bb;
  var nu = (p.x-bb.x)/bb.w, nv=(p.y-bb.y)/bb.h, axis='';
  if(S.vlock && drag.start){
    nu = drag.start[0]; axis='VERTICAL';       // vertical lock
  } else if(ev.shiftKey && drag.start){
    /* ось выбирается один раз за перетаскивание и дальше не переключается */
    var mx = Math.abs(nu-drag.start[0])*bb.w, my = Math.abs(nv-drag.start[1])*bb.h;
    if(!drag.axis && Math.max(mx,my) > 3*unitsPerPx()) drag.axis = mx>=my ? 'h' : 'v';
    if(drag.axis==='h'){ nv=drag.start[1]; axis='HORIZONTAL'; }
    else if(drag.axis==='v'){ nu=drag.start[0]; axis='VERTICAL'; }
  } else {
    drag.axis = null;
  }
  if(S.snap && drag.key.charAt(0)==='c'){ var q=snapCorner(drag.key, nu, nv); nu=q[0]; nv=q[1]; }
  document.getElementById('hudDrag').innerHTML =
    'POINT <b>'+drag.key.toUpperCase()+'</b>' + (axis ? '&nbsp;&nbsp; AXIS <b>'+axis+'</b>' : '') +
    (drag.key.charAt(0)==='c' && geo.bb ?
      '&nbsp;&nbsp; H <b>'+cornerAngles(drag.key).h.toFixed(0)+'°</b>&nbsp;&nbsp; V <b>'+cornerAngles(drag.key).v.toFixed(0)+'°</b>' : '');
  var old = S.h[drag.key], dx=nu-old[0], dy=nv-old[1];
  S.h[drag.key]=[nu,nv];
  if(LINK[drag.key]) LINK[drag.key].forEach(function(pair){
    var t=S.h[pair[0]]; S.h[pair[0]]=[t[0]+dx*pair[1], t[1]+dy*pair[1]];
  });
  render();
});
function endDrag(ev){
  if(kernDrag){ kernDrag=null; }
  if(pan.on){ pan.on=false; document.querySelector('.stage').classList.remove('panning'); }
  if(!drag.key) return;
  drag.key=null; drag.start=null; drag.axis=null; document.getElementById('hudDrag').textContent='';
  render();
}
svg.addEventListener('pointerup', endDrag);
svg.addEventListener('pointercancel', endDrag);
svg.addEventListener('dblclick', function(ev){
  var key = ev.target.getAttribute && ev.target.getAttribute('data-key');
  if(!key){ fitView(); render(false); return; }
  pushUndo(); S.h[key] = defaultHandles()[key]; render();
});
