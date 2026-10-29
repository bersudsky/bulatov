/* Envelope math: Bezier edges, Coons patch, homography (Converging mode). */
"use strict";

/* ---------- геометрия ---------- */
function bez(p0,p1,p2,p3,t){
  var m=1-t, a=m*m*m, b=3*m*m*t, c=3*m*t*t, d=t*t*t;
  return [a*p0[0]+b*p1[0]+c*p2[0]+d*p3[0], a*p0[1]+b*p1[1]+c*p2[1]+d*p3[1]];
}
/* билинейный патч Кунса по 12 точкам */
function coons(u,v,h){
  var T=bez(h.c00,h.t1,h.t2,h.c10,u), B=bez(h.c01,h.b1,h.b2,h.c11,u);
  var L=bez(h.c00,h.l1,h.l2,h.c01,v), R=bez(h.c10,h.r1,h.r2,h.c11,v);
  var iu=1-u, iv=1-v;
  return [
    iv*T[0]+v*B[0] + iu*L[0]+u*R[0] - (iu*iv*h.c00[0]+u*iv*h.c10[0]+iu*v*h.c01[0]+u*v*h.c11[0]),
    iv*T[1]+v*B[1] + iu*L[1]+u*R[1] - (iu*iv*h.c00[1]+u*iv*h.c10[1]+iu*v*h.c01[1]+u*v*h.c11[1])
  ];
}
/* билинейная интерполяция только по углам */
function bilin(h,u,v){
  var iu=1-u, iv=1-v;
  return [iu*iv*h.c00[0]+u*iv*h.c10[0]+u*v*h.c11[0]+iu*v*h.c01[0],
          iu*iv*h.c00[1]+u*iv*h.c10[1]+u*v*h.c11[1]+iu*v*h.c01[1]];
}
/* гомография единичного квадрата в четырёхугольник — как Free Distort */
function computeH(h){
  var p0=h.c00, p1=h.c10, p2=h.c11, p3=h.c01;
  var sx=p0[0]-p1[0]+p2[0]-p3[0], sy=p0[1]-p1[1]+p2[1]-p3[1];
  if(Math.abs(sx)<1e-9 && Math.abs(sy)<1e-9){
    return {a:p1[0]-p0[0], b:p3[0]-p0[0], c:p0[0],
            d:p1[1]-p0[1], e:p3[1]-p0[1], f:p0[1], g:0, k:0};
  }
  var dx1=p1[0]-p2[0], dx2=p3[0]-p2[0], dy1=p1[1]-p2[1], dy2=p3[1]-p2[1];
  var den=dx1*dy2-dy1*dx2;
  if(Math.abs(den)<1e-12) return null;
  var g=(sx*dy2-sy*dx2)/den, k=(dx1*sy-dy1*sx)/den;
  return {a:p1[0]-p0[0]+g*p1[0], b:p3[0]-p0[0]+k*p3[0], c:p0[0],
          d:p1[1]-p0[1]+g*p1[1], e:p3[1]-p0[1]+k*p3[1], f:p0[1], g:g, k:k};
}
function applyH(M,u,v){
  var w=M.g*u+M.k*v+1;
  if(Math.abs(w)<1e-6) w = w<0 ? -1e-6 : 1e-6;
  return [(M.a*u+M.b*v+M.c)/w, (M.d*u+M.e*v+M.f)/w];
}
/* гомография корректна только на выпуклом четырёхугольнике */
function isConvex(h){
  var p=[h.c00,h.c10,h.c11,h.c01], s=0;
  for(var i=0;i<4;i++){
    var a=p[i], b=p[(i+1)%4], c=p[(i+2)%4];
    var cr=(b[0]-a[0])*(c[1]-b[1])-(b[1]-a[1])*(c[0]-b[0]);
    if(Math.abs(cr)<1e-12) continue;
    var sg = cr>0 ? 1 : -1;
    if(s===0) s=sg; else if(sg!==s) return false;
  }
  return true;
}
var HMAT=null;
function updateMatrix(){
  HMAT = (S.mode==='persp' && isConvex(S.h)) ? computeH(S.h) : null;
}
/* перспектива по углам + отклонение рёбер от хорды из патча Кунса */
function mapUV(u,v){
  var C = coons(u,v,S.h);
  if(!HMAT) return C;
  var B = bilin(S.h,u,v), P = applyH(HMAT,u,v);
  return [P[0]+C[0]-B[0], P[1]+C[1]-B[1]];
}
function warpUV(u,v){ return mapUV(u,v); }
