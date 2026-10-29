/* Shared state: settings object S, defaults, the canvas view. */
"use strict";

var svg = document.getElementById('svg');
var NS = 'http://www.w3.org/2000/svg';
var font = null;

/* ---------- состояние ---------- */
var KEYS = ['c00','t1','t2','c10','r1','r2','c11','b2','b1','c01','l2','l1'];
function defaultHandles(){
  return {c00:[0,0], t1:[1/3,0], t2:[2/3,0], c10:[1,0],
          r1:[1,1/3], r2:[1,2/3], c11:[1,1],
          b2:[2/3,1], b1:[1/3,1], c01:[0,1], l2:[0,2/3], l1:[0,1/3]};
}
var S = {
  size:180, track:0, softLead:120, align:'center', kern:true,
  lines:[{text:'TYPE WARP', scale:100, vscale:100, align:null, gap:100}],
  main:0,
  vscaleAll:100,
  h:defaultHandles(), mode:'persp', box:'metrics', capBox:true, snap:true, vlock:false, kernMode:false, expFrame:true,
  mesh:true, guides:false, inv:false, remember:true
};
var QUALITY = 8;   /* плотность выборки контура */
var DEF = JSON.parse(JSON.stringify(S));
var view = {x:-500,y:-300,w:1000,h:600};
