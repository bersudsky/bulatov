/* Persistence between sessions: artifact storage or localStorage. */
"use strict";

/* ---------- память между сессиями ---------- */
/* Хранилище: в артефакте есть window.storage, на обычном сайте (GitHub Pages)
   его нет — тогда работаем через localStorage с тем же асинхронным интерфейсом.
   Если недоступно и оно (приватный режим), остаёмся без памяти между сессиями. */
var STORE_KIND = 'none';
var STORE = (function(){
  if(typeof window!=='undefined' && window.storage && typeof window.storage.get==='function'){
    STORE_KIND = 'artifact';
    return window.storage;
  }
  try{
    var probe = 'typewarp:probe';
    window.localStorage.setItem(probe, '1');
    window.localStorage.removeItem(probe);
  }catch(e){ return null; }
  STORE_KIND = 'local';
  var LS = window.localStorage;
  return {
    get: function(k){
      var v;
      try{ v = LS.getItem(k); }catch(e){ return Promise.reject(e); }
      return Promise.resolve(v===null ? null : {key:k, value:v, shared:false});
    },
    set: function(k, v){
      try{ LS.setItem(k, v); }catch(e){ return Promise.reject(e); }
      return Promise.resolve({key:k, value:v, shared:false});
    },
    'delete': function(k){
      try{ LS.removeItem(k); }catch(e){ return Promise.reject(e); }
      return Promise.resolve({key:k, deleted:true, shared:false});
    },
    list: function(prefix){
      var keys=[];
      try{
        for(var i=0;i<LS.length;i++){
          var k=LS.key(i);
          if(!prefix || k.indexOf(prefix)===0) keys.push(k);
        }
      }catch(e){ return Promise.reject(e); }
      return Promise.resolve({keys:keys, prefix:prefix, shared:false});
    }
  };
})();
var K_FONT='typewarp:font', K_STATE='typewarp:state';
/* у localStorage запас куда меньше, чем у хранилища артефакта */
var MAX_B64 = (STORE_KIND==='local' ? 2.2*1024*1024 : 4.4*1024*1024);
var lastFontBlob = null;
var memInfo = document.getElementById('memInfo');
var forgetBtn = document.getElementById('forget');

var memTimer=null;
function memSay(t, keep){
  memInfo.innerHTML = t;
  clearTimeout(memTimer);
  if(t && !keep) memTimer = setTimeout(function(){ memInfo.innerHTML=''; }, 5000);
}
function b64FromBuf(buf){
  var bytes=new Uint8Array(buf), chunk=0x8000, parts=[];
  for(var i=0;i<bytes.length;i+=chunk) parts.push(String.fromCharCode.apply(null, bytes.subarray(i,i+chunk)));
  return btoa(parts.join(''));
}
function bufFromB64(s){
  var bin=atob(s), out=new Uint8Array(bin.length);
  for(var i=0;i<bin.length;i++) out[i]=bin.charCodeAt(i);
  return out.buffer;
}
function kb(n){ return n>=1048576 ? (n/1048576).toFixed(1)+' MB' : Math.round(n/1024)+' KB'; }

function saveFont(buf, name){
  if(!STORE || !S.remember) return;
  var b64;
  try{ b64 = b64FromBuf(buf); }catch(e){ return; }
  if(b64.length > MAX_B64){
    memSay('Too large to store ('+kb(buf.byteLength)+') — load it again after a refresh. '+
           'Your states are still saved.');
    return;
  }
  lastFontBlob = {name:name, size:buf.byteLength, b64:b64};
  STORE.set(K_FONT, JSON.stringify(lastFontBlob), false)
    .then(function(){ memSay('Font stored — '+kb(buf.byteLength)+'. Refreshing the page will not clear it.'); })
    .catch(function(){
      lastFontBlob = null;
      memSay(STORE_KIND==='local'
        ? 'Browser storage is full, so the font was not saved — your states are still stored.'
        : 'Could not store the font.');
    });
}
var saveTimer=null, storeReady=false;
function scheduleSave(){
  if(!STORE || !storeReady) return;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(function(){
    var payload = {remember:false};
    if(S.remember){ payload = JSON.parse(JSON.stringify(S)); payload.v = 9; }
    STORE.set(K_STATE, JSON.stringify(payload), false).catch(function(){});
  }, 700);
}
function forgetAll(){
  if(!STORE) return;
  lastFontBlob=null;
  STORE['delete'](K_FONT,false).catch(function(){});
  STORE['delete'](K_STATE,false).catch(function(){});
  memSay('Storage cleared. Saved states were kept.');
}
forgetBtn.addEventListener('click', function(){ forgetAll(); });
document.getElementById('remember').addEventListener('change', function(){
  S.remember = this.checked;
  if(!S.remember){ forgetAll(); memSay('Not storing anything.'); }
  else {
    memSay('');
    if(font && lastFontBlob) STORE && STORE.set(K_FONT, JSON.stringify(lastFontBlob), false).catch(function(){});
    scheduleSave();
  }
});

function restore(){
  if(!STORE){
    S.remember = false;
    forgetBtn.disabled = true;
    document.getElementById('remember').checked = false;
    document.getElementById('remember').disabled = true;
    memSay('Persistent storage is unavailable here — the font lasts until you reload.', true);
    return;
  }
  STORE.get(K_STATE,false).then(function(r){
    if(!r || !r.value) return;
    var saved = JSON.parse(r.value);
    /* состояния старых сборок могли зафиксировать режимы, которых тогда ещё не было —
       их не восстанавливаем, иначе новая логика молча не включится */
    /* в v9 интервалы поменялись ролями: чип строки стал интерлиньяжем внутри поля,
       ползунок — зазором между полями. Переносим прежние значения, а не сбрасываем */
    if(saved.v === 8 && saved.lines && saved.lines.length){
      var oldInside = (saved.softLead===undefined ? 100 : saved.softLead);
      var oldBetween = 120;
      for(var q=1;q<saved.lines.length;q++){
        if(saved.lines[q] && saved.lines[q].gap!==undefined){ oldBetween = saved.lines[q].gap; break; }
      }
      saved.softLead = oldBetween;
      saved.lines.forEach(function(L){ L.gap = oldInside; });
      saved.v = 9;
    }
    if(saved.v !== 9){
      delete saved.box; delete saved.mode; delete saved.guides; delete saved.track;
      /* строки старого формата: текст лежал отдельно, разносим по строкам */
      if(saved.lines && saved.text!==undefined){
        var parts = String(saved.text).split('\n');
        saved.lines = saved.lines.map(function(L,i){
          L.text = parts[i]!==undefined ? parts[i] : '';
          return L;
        });
      } else delete saved.lines;
      if(saved.main===undefined) saved.main = 0;
    }
    Object.keys(saved).forEach(function(k){ if(k in S) S[k]=saved[k]; });
    PREV = null;
    syncUI(); render();
  }).catch(function(){}).then(function(){
    if(!S.remember){ memSay('Not storing anything.'); return; }
    return STORE.get(K_FONT,false).then(function(r){
      if(!r || !r.value) return;
      var f = JSON.parse(r.value);
      lastFontBlob = f;
      loadBuffer(bufFromB64(f.b64), f.name, true);
      memSay('Font restored from storage — '+kb(f.size)+'.');
    }).catch(function(){});
  }).catch(function(){}).then(function(){ storeReady = true; });
}
