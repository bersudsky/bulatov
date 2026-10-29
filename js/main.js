/* Startup. Loaded last. */
"use strict";

if(typeof opentype==='undefined'){
  document.getElementById('empty').innerHTML='<b>LIBRARY FAILED TO LOAD</b><p>opentype.js did not load from CDN — check your connection and reload.</p>';
}
buildLineRows();
scrubAll();
renderPresets();
initFills();
render();
restore();
loadPresets();
