/* Refits the warped outline into smooth Bezier curves for display and export. */
"use strict";

/* ---------- подгонка кривых (алгоритм Шнайдера) ---------- */
function vsub(a,b){return [a[0]-b[0], a[1]-b[1]];}
function vdot(a,b){return a[0]*b[0]+a[1]*b[1];}
function vunit(a){var l=Math.hypot(a[0],a[1]); return l<1e-12?[0,0]:[a[0]/l,a[1]/l];}
function bezAt(b,t){
  var m=1-t;
  return [m*m*m*b[0][0]+3*m*m*t*b[1][0]+3*m*t*t*b[2][0]+t*t*t*b[3][0],
          m*m*m*b[0][1]+3*m*m*t*b[1][1]+3*m*t*t*b[2][1]+t*t*t*b[3][1]];
}
function chordParams(pts){
  var u=[0];
  for(var i=1;i<pts.length;i++) u.push(u[i-1]+Math.hypot(pts[i][0]-pts[i-1][0], pts[i][1]-pts[i-1][1]));
  var tot=u[u.length-1]||1;
  return u.map(function(v){return v/tot;});
}
function genBezier(pts,u,t1,t2){
  var n=pts.length, p0=pts[0], p3=pts[n-1];
  var C=[[0,0],[0,0]], X=[0,0];
  for(var i=0;i<n;i++){
    var t=u[i], m=1-t;
    var b0=m*m*m, b1=3*m*m*t, b2=3*m*t*t, b3=t*t*t;
    var a1=[t1[0]*b1, t1[1]*b1], a2=[t2[0]*b2, t2[1]*b2];
    C[0][0]+=vdot(a1,a1); C[0][1]+=vdot(a1,a2); C[1][0]=C[0][1]; C[1][1]+=vdot(a2,a2);
    var tmp=[pts[i][0]-(p0[0]*(b0+b1)+p3[0]*(b2+b3)), pts[i][1]-(p0[1]*(b0+b1)+p3[1]*(b2+b3))];
    X[0]+=vdot(a1,tmp); X[1]+=vdot(a2,tmp);
  }
  var det=C[0][0]*C[1][1]-C[1][0]*C[0][1];
  var al1=0, al2=0;
  if(Math.abs(det)>1e-12){
    al1=(X[0]*C[1][1]-X[1]*C[0][1])/det;
    al2=(C[0][0]*X[1]-C[1][0]*X[0])/det;
  }
  var seg=Math.hypot(p3[0]-p0[0], p3[1]-p0[1]);
  /* вырожденное или разбегающееся решение — откат на треть хорды */
  if(!(al1>1e-6) || !(al2>1e-6) || al1>seg*3 || al2>seg*3){ al1=al2=seg/3; }
  return [p0, [p0[0]+t1[0]*al1, p0[1]+t1[1]*al1], [p3[0]+t2[0]*al2, p3[1]+t2[1]*al2], p3];
}
function maxErr(pts,u,b){
  var d=0, idx=Math.floor(pts.length/2);
  for(var i=1;i<pts.length-1;i++){
    var q=bezAt(b,u[i]), e=(q[0]-pts[i][0])*(q[0]-pts[i][0])+(q[1]-pts[i][1])*(q[1]-pts[i][1]);
    if(e>d){ d=e; idx=i; }
  }
  return {d:Math.sqrt(d), i:idx};
}
function reparam(pts,u,b){
  var b1=[vsub(b[1],b[0]).map(function(v){return v*3;}),
          vsub(b[2],b[1]).map(function(v){return v*3;}),
          vsub(b[3],b[2]).map(function(v){return v*3;})];
  var b2=[vsub(b1[1],b1[0]).map(function(v){return v*2;}),
          vsub(b1[2],b1[1]).map(function(v){return v*2;})];
  return u.map(function(t,i){
    var m=1-t;
    var d=[m*m*b1[0][0]+2*m*t*b1[1][0]+t*t*b1[2][0], m*m*b1[0][1]+2*m*t*b1[1][1]+t*t*b1[2][1]];
    var dd=[m*b2[0][0]+t*b2[1][0], m*b2[0][1]+t*b2[1][1]];
    var q=vsub(bezAt(b,t), pts[i]);
    var den=vdot(d,d)+vdot(q,dd);
    if(Math.abs(den)<1e-12) return t;
    var nt = t - vdot(q,d)/den;
    if(!isFinite(nt)) return t;
    return nt<0 ? 0 : (nt>1 ? 1 : nt);
  });
}
/* касательная по трём точкам: на редкой выборке хорда даёт заметную ошибку угла */
function endTangent(pts, atStart){
  var n=pts.length;
  if(atStart){
    if(n>=3) return vunit([-3*pts[0][0]+4*pts[1][0]-pts[2][0], -3*pts[0][1]+4*pts[1][1]-pts[2][1]]);
    return vunit(vsub(pts[1],pts[0]));
  }
  if(n>=3) return vunit([-(3*pts[n-1][0]-4*pts[n-2][0]+pts[n-3][0]), -(3*pts[n-1][1]-4*pts[n-2][1]+pts[n-3][1])]);
  return vunit(vsub(pts[n-2],pts[n-1]));
}
function fitSeg(pts, tol, depth, out){
  var n=pts.length;
  if(n<2) return;
  if(n===2){ out.push(['L', pts[1]]); return; }
  var t1=endTangent(pts,true), t2=endTangent(pts,false);
  var u=chordParams(pts), b=genBezier(pts,u,t1,t2), e=maxErr(pts,u,b);
  var best=b, bestE=e.d;                       /* уточнение может ухудшить — держим лучшее */
  for(var it=0; it<4 && bestE>tol; it++){
    u=reparam(pts,u,b); b=genBezier(pts,u,t1,t2); e=maxErr(pts,u,b);
    if(e.d<bestE){ bestE=e.d; best=b; }
  }
  b=best;
  if(bestE<=tol || depth>=5){ out.push(['C', b[1], b[2], b[3]]); return; }
  e=maxErr(pts, chordParams(pts), b);
  var i=e.i; if(i<1) i=1; if(i>n-2) i=n-2;
  fitSeg(pts.slice(0,i+1), tol, depth+1, out);
  fitSeg(pts.slice(i), tol, depth+1, out);
}
function isStraight(pts, tol){
  var a=pts[0], b=pts[pts.length-1], dx=b[0]-a[0], dy=b[1]-a[1];
  var l=Math.hypot(dx,dy); if(l<1e-9) return false;
  for(var i=1;i<pts.length-1;i++){
    if(Math.abs((pts[i][0]-a[0])*dy - (pts[i][1]-a[1])*dx)/l > tol) return false;
  }
  return true;
}
/* исходная структура узлов сохраняется: подгоняем каждый сегмент шрифта отдельно */
function curvePathData(q){
  if(!geo.bb || !font) return '';
  var bb = geo.bb, tol = Math.max(bb.h*0.0012, 0.005), d='';
  var subs = flatten(buildPath(), q);
  subs.forEach(function(sp){
    var w = sp.pts.map(function(pt){
      var t = warpUV((pt[0]-bb.x)/bb.w, (pt[1]-bb.y)/bb.h);
      return [bb.x + t[0]*bb.w, bb.y + t[1]*bb.h];
    });
    d += 'M'+w[0][0].toFixed(2)+' '+w[0][1].toFixed(2);
    sp.segs.forEach(function(sg){
      var pts = w.slice(sg.a, sg.b+1);
      if(pts.length<2) return;
      if(sg.line && isStraight(pts, tol)){
        var p=pts[pts.length-1];
        d += 'L'+p[0].toFixed(2)+' '+p[1].toFixed(2);
        return;
      }
      var out=[];
      fitSeg(pts, tol, 0, out);
      out.forEach(function(c){
        if(c[0]==='L') d += 'L'+c[1][0].toFixed(2)+' '+c[1][1].toFixed(2);
        else d += 'C'+c[1][0].toFixed(2)+' '+c[1][1].toFixed(2)+' '+
                     c[2][0].toFixed(2)+' '+c[2][1].toFixed(2)+' '+
                     c[3][0].toFixed(2)+' '+c[3][1].toFixed(2);
      });
    });
    d += 'Z';
  });
  return d;
}
