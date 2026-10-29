/* SVG and PNG export. */
"use strict";

/* ---------- экспорт ---------- */
/* габариты искажённой рамки: границы огибающей, без учёта чернил */
function frameBounds(){
  if(!geo.bb) return null;
  var bb=geo.bb, nx=1e9, ny=1e9, xx=-1e9, xy=-1e9;
  function add(u,v){
    var q=warpUV(u,v), px=bb.x+q[0]*bb.w, py=bb.y+q[1]*bb.h;
    if(px<nx)nx=px; if(px>xx)xx=px; if(py<ny)ny=py; if(py>xy)xy=py;
  }
  for(var i=0;i<=32;i++){ var t=i/32; add(t,0); add(t,1); add(0,t); add(1,t); }
  return {x:nx, y:ny, w:Math.max(xx-nx,1), h:Math.max(xy-ny,1)};
}
function svgString(scale){
  scale = scale||1;
  var x,y,w,h;
  var fb = S.expFrame ? frameBounds() : null;
  if(fb){ x=fb.x; y=fb.y; w=fb.w; h=fb.h; }
  else {
    var minX=1e9,minY=1e9,maxX=-1e9,maxY=-1e9;
    geo.warped.forEach(function(sp){sp.forEach(function(p){
      if(p[0]<minX)minX=p[0]; if(p[0]>maxX)maxX=p[0];
      if(p[1]<minY)minY=p[1]; if(p[1]>maxY)maxY=p[1];
    });});
    var pad = 2;
    x=minX-pad; y=minY-pad; w=(maxX-minX)+pad*2; h=(maxY-minY)+pad*2;
  }
  var ink = S.inv ? '#16161a' : '#ffffff';
  var fill = 'fill="'+ink+'" fill-rule="nonzero"';
  return '<svg xmlns="http://www.w3.org/2000/svg" overflow="visible" width="'+(w*scale).toFixed(0)+'" height="'+(h*scale).toFixed(0)+
         '" viewBox="'+x.toFixed(2)+' '+y.toFixed(2)+' '+w.toFixed(2)+' '+h.toFixed(2)+'">\n  <path d="'+curvePathData(40)+'" '+fill+'/>\n</svg>';
}
function download(blob, name){
  var url=URL.createObjectURL(blob), a=document.createElement('a');
  a.href=url; a.download=name; document.body.appendChild(a); a.click();
  setTimeout(function(){URL.revokeObjectURL(url); a.remove();},400);
}
function baseName(){
  return ((S.lines&&S.lines[0]&&S.lines[0].text)||'text').slice(0,24).replace(/[^\wА-Яа-яЁё-]+/g,'_') || 'warp';
}

document.getElementById('exSvg').addEventListener('click',function(){
  if(!geo.bb) return;
  download(new Blob([svgString()],{type:'image/svg+xml'}), baseName()+'.svg');
});
function showCode(s){
  document.getElementById('dlgTxt').value=s;
  document.getElementById('dlg').showModal();
}
document.getElementById('dlgClose').addEventListener('click',function(){document.getElementById('dlg').close();});

document.getElementById('exPng').addEventListener('click',function(){
  if(!geo.bb) return;
  var s=svgString(2), img=new Image();
  img.onload=function(){
    var c=document.createElement('canvas');
    c.width=img.width||1000; c.height=img.height||600;
    var ctx=c.getContext('2d');
    ctx.fillStyle = S.inv ? '#f2f1ec' : '#16161a';
    ctx.fillRect(0,0,c.width,c.height);
    ctx.drawImage(img,0,0,c.width,c.height);
    c.toBlob(function(b){ download(b, baseName()+'@2x.png'); });
  };
  img.onerror=function(){ showCode(svgString()); };
  img.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(s);
});
