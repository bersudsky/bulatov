/* Recompute geometry and draw the canvas: outline, grid, font lines, measurements, handles. */
"use strict";

/* ---------- рендер ---------- */
var geo = {subs:[], bb:null, warped:[], d:'', pts:0};
var PREV = null;

function recompute(){
  updateMatrix();
  if(!font){ geo={subs:[],bb:null,warped:[],d:'',pts:0}; return; }
  var subs = flatten(buildPath());
  var minX=1e9,minY=1e9,maxX=-1e9,maxY=-1e9, pts=0;
  subs.forEach(function(sp){ sp.pts.forEach(function(p){
    pts++;
    if(p[0]<minX)minX=p[0]; if(p[0]>maxX)maxX=p[0];
    if(p[1]<minY)minY=p[1]; if(p[1]>maxY)maxY=p[1];
  });});
  if(pts===0){ geo={subs:[],bb:null,warped:[],d:'',pts:0}; return; }
  if(S.box==='metrics'){
    var M = metricExtents();
    if(M && (M.bottom - M.top) > 1){ minY = M.top; maxY = M.bottom; }
  }
  var bb={x:minX,y:minY,w:Math.max(maxX-minX,1),h:Math.max(maxY-minY,1)};
  /* точки хранятся в долях рамки: при изменении её размеров (число строк,
     высота строк, кегль) тот же сдвиг даёт другой угол. Пересчитываем сдвиги,
     чтобы углы рёбер оставались прежними */
  if(PREV && (Math.abs(PREV.w-bb.w)>0.01 || Math.abs(PREV.h-bb.h)>0.01)){
    var df = defaultHandles();
    var kx = (PREV.w/bb.w)*(bb.h/PREV.h), ky = (PREV.h/bb.h)*(bb.w/PREV.w);
    if(isFinite(kx) && isFinite(ky)) KEYS.forEach(function(key){
      S.h[key] = [ df[key][0] + (S.h[key][0]-df[key][0])*kx,
                   df[key][1] + (S.h[key][1]-df[key][1])*ky ];
    });
    updateMatrix();
  }
  PREV = {w:bb.w, h:bb.h};
  var warped = subs.map(function(sp){
    return sp.pts.map(function(p){
      var q = warpUV((p[0]-bb.x)/bb.w, (p[1]-bb.y)/bb.h);
      return [bb.x + q[0]*bb.w, bb.y + q[1]*bb.h];
    });
  });
  var d='';
  warped.forEach(function(sp){
    d += 'M';
    for(var i=0;i<sp.length;i++){ d += (i?'L':'') + sp[i][0].toFixed(2) + ' ' + sp[i][1].toFixed(2); }
    d += 'Z';
  });
  geo = {subs:subs, bb:bb, warped:warped, d:d, pts:pts};
  if(!(drag&&drag.key) && !(typeof pan!=='undefined' && pan.on)){ var cd = curvePathData(QUALITY*2); if(cd) geo.d = cd; }
  document.getElementById('hudPts').textContent = pts;
  document.getElementById('hudSub').textContent = warped.length;
}

function hPos(k){ var bb=geo.bb; return [bb.x + S.h[k][0]*bb.w, bb.y + S.h[k][1]*bb.h]; }

function render(recalc){
  if(recalc!==false) recompute(); else updateMatrix();
  var empty = document.getElementById('empty');
  empty.style.display = (font && geo.bb) ? 'none' : 'flex';
  svg.innerHTML = '';
  var stage = document.querySelector('.stage');
  stage.classList.toggle('light', S.inv);
  stage.classList.toggle('kern', S.kernMode);
  updateZoomLabel();
  scheduleSave();
  if(!geo.bb) return;

  var ink = S.inv ? '#16161a' : '#f4f3ef';
  svg.setAttribute('viewBox', view.x+' '+view.y+' '+view.w+' '+view.h);
  var k = view.w / Math.max(svg.clientWidth,1);   // единиц viewBox на пиксель

  var g = document.createElementNS(NS,'g');
  var path = document.createElementNS(NS,'path');
  path.setAttribute('d', geo.d);
  path.setAttribute('fill', ink);
  path.setAttribute('fill-rule','nonzero');
  g.appendChild(path);
  svg.appendChild(g);

  if(S.kernMode && kernSel){
    var gh=null;
    for(var gi=0;gi<GLYPH_HIT.length;gi++){
      if(GLYPH_HIT[gi].li===kernSel.li && GLYPH_HIT[gi].j===kernSel.j){ gh=GLYPH_HIT[gi]; break; }
    }
    if(gh){
      var bb2=geo.bb;
      var q0=warpUV((gh.gapX-bb2.x)/bb2.w,(gh.yTop-bb2.y)/bb2.h);
      var q1=warpUV((gh.gapX-bb2.x)/bb2.w,(gh.yBot-bb2.y)/bb2.h);
      var cur=document.createElementNS(NS,'line');
      cur.setAttribute('x1',(bb2.x+q0[0]*bb2.w).toFixed(1));
      cur.setAttribute('y1',(bb2.y+q0[1]*bb2.h).toFixed(1));
      cur.setAttribute('x2',(bb2.x+q1[0]*bb2.w).toFixed(1));
      cur.setAttribute('y2',(bb2.y+q1[1]*bb2.h).toFixed(1));
      cur.setAttribute('stroke','#2545f5');
      cur.setAttribute('stroke-width', 2.5*(view.w/Math.max(svg.clientWidth,1)));
      svg.appendChild(cur);
      var kv=(S.lines[kernSel.li].kern && S.lines[kernSel.li].kern[kernSel.j])||0;
      document.getElementById('hudDrag').innerHTML =
        'KERNING <b>'+(kv>0?'+':'')+kv.toFixed(1)+'%</b>';
    }
  } else if(S.kernMode){
    document.getElementById('hudDrag').textContent='';
  }

  if(!S.mesh && !S.guides) return;

  var bb=geo.bb, N=8;
  if(S.mesh){
  var meshG = document.createElementNS(NS,'g');
  meshG.setAttribute('fill','none');
  meshG.setAttribute('stroke', S.inv ? 'rgba(37,69,245,.35)' : 'rgba(120,140,255,.32)');
  meshG.setAttribute('stroke-width', 1*k);
  function line(pointsFn){
    var d='', p;
    for(var i=0;i<=40;i++){ p=pointsFn(i/40); d += (i?'L':'M') + (bb.x+p[0]*bb.w).toFixed(2) + ' ' + (bb.y+p[1]*bb.h).toFixed(2); }
    var e=document.createElementNS(NS,'path'); e.setAttribute('d',d); meshG.appendChild(e);
  }
  for(var i=0;i<=N;i++){
    (function(v){ line(function(t){return warpUV(t,v);}); })(i/N);
    (function(u){ line(function(t){return warpUV(u,t);}); })(i/N);
  }
  svg.appendChild(meshG);
  }

  if(S.guides && METRICS){
    var gg = document.createElementNS(NS,'g');
    gg.setAttribute('fill','none');
    gg.setAttribute('stroke', S.inv ? 'rgba(196,110,0,.85)' : 'rgba(255,176,32,.85)');
    gg.setAttribute('stroke-width', 1*k);
    gg.setAttribute('stroke-dasharray', (7*k)+' '+(4*k));
    var nlL = lineLayout(), guides=[];
    nlL.forEach(function(ln){
      var km = ln.size/METRICS.upm*ln.vs, gbase = ln.y;
      guides.push(gbase);
      guides.push(gbase-METRICS.cap*km);
      if(Math.abs(METRICS.xh-METRICS.cap)>1) guides.push(gbase-METRICS.xh*km);
      if(Math.abs(METRICS.asc-METRICS.cap)>1) guides.push(gbase-METRICS.asc*km);
      if(METRICS.desc<-1) guides.push(gbase-METRICS.desc*km);
    });
    guides.forEach(function(gy){
      var v=(gy-bb.y)/bb.h, d='', p;
      for(var i=0;i<=24;i++){
        p = warpUV(i/24, v);
        d += (i?'L':'M') + (bb.x+p[0]*bb.w).toFixed(2) + ' ' + (bb.y+p[1]*bb.h).toFixed(2);
      }
      var e=document.createElementNS(NS,'path'); e.setAttribute('d',d); gg.appendChild(e);
    });
    svg.appendChild(gg);

    /* замер фактической высоты прописных в начале и конце каждой строки */
    var mg = document.createElementNS(NS,'g');
    var mcol = S.inv ? 'rgba(196,110,0,.95)' : 'rgba(255,176,32,.95)';
    nlL.forEach(function(ln, li){
      var lx = LAYOUT_X[li];
      if(!lx || !ln.text.trim() || Math.abs(lx.x1-lx.x0)<1e-6) return;
      var km2 = ln.size/METRICS.upm*ln.vs;
      var vTop = (ln.y - METRICS.cap*km2 - bb.y)/bb.h, vBase = (ln.y - bb.y)/bb.h;
      [lx.x0, lx.x1].forEach(function(px, side){
        var u = (px-bb.x)/bb.w;
        var a = warpUV(u, vTop), b2 = warpUV(u, vBase);
        var ax = bb.x+a[0]*bb.w, ay = bb.y+a[1]*bb.h;
        var bx = bb.x+b2[0]*bb.w, by = bb.y+b2[1]*bb.h;
        var e = document.createElementNS(NS,'line');
        e.setAttribute('x1',ax); e.setAttribute('y1',ay);
        e.setAttribute('x2',bx); e.setAttribute('y2',by);
        e.setAttribute('stroke',mcol); e.setAttribute('stroke-width',1.5*k);
        mg.appendChild(e);
        var t = document.createElementNS(NS,'text');
        t.setAttribute('x', (ax+bx)/2 + (side ? 8*k : -8*k));
        t.setAttribute('y', (ay+by)/2 + 4*k);
        t.setAttribute('text-anchor', side ? 'start' : 'end');
        t.setAttribute('font-size', 12*k);
        t.setAttribute('font-family','ui-monospace,Menlo,monospace');
        t.setAttribute('fill', mcol); t.setAttribute('stroke','none');
        t.textContent = Math.round(Math.hypot(bx-ax, by-ay));
        mg.appendChild(t);
      });

      /* просвет между строками: от базовой линии верхней до прописной нижней */
      if(li>0){
        var pv = nlL[li-1];
        var kmP = pv.size/METRICS.upm*pv.vs;
        var topPrev = pv.y - METRICS.cap*kmP;     // прописная предыдущей
        var yFrom, yTo;
        if(ln.y < pv.y){                          // базовая текущей выше — строка сверху
          yFrom = ln.y;                           // базовая текущей (верхней)
          yTo   = topPrev;                        // прописная предыдущей (нижней)
        } else {
          yFrom = pv.y;                           // базовая предыдущей (верхней)
          yTo   = ln.y - METRICS.cap*km2;         // прописная текущей (нижней)
        }
        var vFrom = (yFrom - bb.y)/bb.h, vTo = (yTo - bb.y)/bb.h;
        [lx.x0, lx.x1].forEach(function(px, side){
          var u = (px-bb.x)/bb.w;
          var a = warpUV(u, vFrom), b2 = warpUV(u, vTo);
          var ax = bb.x+a[0]*bb.w, ay = bb.y+a[1]*bb.h;
          var bx = bb.x+b2[0]*bb.w, by = bb.y+b2[1]*bb.h;
          var e = document.createElementNS(NS,'line');
          e.setAttribute('x1',ax); e.setAttribute('y1',ay);
          e.setAttribute('x2',bx); e.setAttribute('y2',by);
          e.setAttribute('stroke',mcol); e.setAttribute('stroke-width',1*k);
          e.setAttribute('stroke-dasharray',(3*k)+' '+(3*k));
          mg.appendChild(e);
          var t = document.createElementNS(NS,'text');
          t.setAttribute('x', (ax+bx)/2 + (side ? 8*k : -8*k));
          t.setAttribute('y', (ay+by)/2 + 4*k);
          t.setAttribute('text-anchor', side ? 'start' : 'end');
          t.setAttribute('font-size', 11*k);
          t.setAttribute('font-family','ui-monospace,Menlo,monospace');
          t.setAttribute('fill', mcol); t.setAttribute('stroke','none');
          t.setAttribute('opacity','0.85');
          t.textContent = Math.round(Math.hypot(bx-ax, by-ay));
          mg.appendChild(t);
        });
      }
    });
    svg.appendChild(mg);
  }

  if(!S.mesh) return;

  // усы от углов к контрольным точкам рёбер
  var whisk = document.createElementNS(NS,'g');
  whisk.setAttribute('stroke', S.inv?'rgba(25,26,30,.35)':'rgba(255,255,255,.28)');
  whisk.setAttribute('stroke-width', 1*k);
  whisk.setAttribute('stroke-dasharray', (3*k)+' '+(3*k));
  [['c00','t1'],['c10','t2'],['c00','l1'],['c01','l2'],['c10','r1'],['c11','r2'],['c01','b1'],['c11','b2']].forEach(function(pair){
    var a=hPos(pair[0]), b=hPos(pair[1]);
    var e=document.createElementNS(NS,'line');
    e.setAttribute('x1',a[0]);e.setAttribute('y1',a[1]);e.setAttribute('x2',b[0]);e.setAttribute('y2',b[1]);
    whisk.appendChild(e);
  });
  svg.appendChild(whisk);

  // точки
  var hg = document.createElementNS(NS,'g');
  KEYS.forEach(function(key){
    var p=hPos(key), corner = key.charAt(0)==='c';
    var e=document.createElementNS(NS, corner?'rect':'circle');
    if(corner){
      e.setAttribute('x',p[0]-5*k); e.setAttribute('y',p[1]-5*k);
      e.setAttribute('width',10*k); e.setAttribute('height',10*k);
    } else {
      e.setAttribute('cx',p[0]); e.setAttribute('cy',p[1]); e.setAttribute('r',4.5*k);
    }
    e.setAttribute('fill', key===drag.key ? '#ff3b15' : (corner?'#2545f5':(S.inv?'#fff':'#16161a')));
    e.setAttribute('stroke', key===drag.key ? '#ff3b15' : '#2545f5');
    e.setAttribute('stroke-width', 1.5*k);
    e.setAttribute('data-key', key);
    e.style.cursor='grab';
    hg.appendChild(e);
  });
  svg.appendChild(hg);

  if(drag.key && drag.key.charAt(0)==='c'){
    var A = cornerAngles(drag.key), p0 = hPos(drag.key);
    var right = S.h[drag.key][0] > 0.5, below = S.h[drag.key][1] > 0.5;
    var lab = document.createElementNS(NS,'g');
    lab.setAttribute('fill','#ff3b15');
    lab.setAttribute('stroke','none');
    ['horiz '+A.h.toFixed(0)+'°', 'vert '+A.v.toFixed(0)+'°'].forEach(function(t,i){
      var e=document.createElementNS(NS,'text');
      e.setAttribute('x', p0[0] + (right?-14:14)*k);
      e.setAttribute('y', p0[1] + (below ? 20+i*15 : -22+i*15)*k);
      e.setAttribute('text-anchor', right?'end':'start');
      e.setAttribute('font-size', 13*k);
      e.setAttribute('font-family','ui-monospace,Menlo,monospace');
      e.textContent = t;
      lab.appendChild(e);
    });
    svg.appendChild(lab);
  }
}

/* ---------- вписать ---------- */
/* после правки: сначала пересчитать геометрию, потом вписать — иначе вид отстаёт на шаг */
function refit(){ recompute(); fitView(); render(false); }
function fitView(){
  if(!geo.bb) { recompute(); if(!geo.bb) return; }
  var minX=1e9,minY=1e9,maxX=-1e9,maxY=-1e9;
  geo.warped.forEach(function(sp){sp.forEach(function(p){
    if(p[0]<minX)minX=p[0]; if(p[0]>maxX)maxX=p[0];
    if(p[1]<minY)minY=p[1]; if(p[1]>maxY)maxY=p[1];
  });});
  if(S.mesh) KEYS.forEach(function(key){
    var p=hPos(key);
    if(p[0]<minX)minX=p[0]; if(p[0]>maxX)maxX=p[0];
    if(p[1]<minY)minY=p[1]; if(p[1]>maxY)maxY=p[1];
  });
  var w=Math.max(maxX-minX,1), h=Math.max(maxY-minY,1), pad=Math.max(w,h)*0.09+20;
  var cw=svg.clientWidth||1000, ch=svg.clientHeight||600, ar=cw/ch;
  var vw=w+pad*2, vh=h+pad*2;
  if(vw/vh < ar) vw = vh*ar; else vh = vw/ar;
  view = {x:(minX+maxX)/2 - vw/2, y:(minY+maxY)/2 - vh/2, w:vw, h:vh};
}
