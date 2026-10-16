/* Riwayat: private access gate.
   While the gate is switched on (Admin → Access), every page asks for a pass code first.
   Only scrambled (hashed) codes are stored online, never the codes themselves.
   The gate keeps the general public out; it is not a substitute for the admin sign-in. */
(function () {
  'use strict';
  var SKEY = 'riwayat_access', TKEY = 'riwayat_access_try', ITER = 150000, MAX_TRIES = 5, LOCK_MS = 60000;
  var FB = { apiKey: 'AIzaSyCAqNKV2eR3E5rPA-ieRLEB5feGFaG1wO8', projectId: 'riwayat-41034' };
  var root = document.documentElement, cfg = null, gate = null, shown = 0;

  /* ---------- helpers ---------- */
  function hex(buf) { return Array.prototype.map.call(new Uint8Array(buf), function (b) { return ('0' + b.toString(16)).slice(-2); }).join(''); }
  function unhex(s) { var a = new Uint8Array(s.length / 2); for (var i = 0; i < a.length; i++) a[i] = parseInt(s.substr(i * 2, 2), 16); return a; }
  function newSalt() { var a = new Uint8Array(16); crypto.getRandomValues(a); return hex(a); }
  function hash(code, saltHex) {
    var te = new TextEncoder();
    return crypto.subtle.importKey('raw', te.encode(String(code)), 'PBKDF2', false, ['deriveBits']).then(function (k) {
      return crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: unhex(saltHex), iterations: ITER }, k, 256);
    }).then(hex);
  }
  function same(a, b) { if (a.length !== b.length) return false; var d = 0; for (var i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i); return d === 0; }
  function sget(k) { try { return JSON.parse(sessionStorage.getItem(k) || 'null'); } catch (e) { return null; } }
  function sset(k, v) { try { if (v == null) sessionStorage.removeItem(k); else sessionStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* ignore */ } }
  function lget() { try { return JSON.parse(localStorage.getItem(TKEY) || '{}') || {}; } catch (e) { return {}; } }
  function lset(v) { try { localStorage.setItem(TKEY, JSON.stringify(v)); } catch (e) { /* ignore */ } }

  /* ---------- read the gate settings (public document site/access) ---------- */
  function load() {
    var url = 'https://firestore.googleapis.com/v1/projects/' + FB.projectId + '/databases/(default)/documents/site/access?key=' + FB.apiKey + '&_=' + Date.now();
    return fetch(url, { cache: 'no-store' }).then(function (r) {
      if (r.status === 404) return { on: false };
      if (!r.ok) throw new Error('http ' + r.status);
      return r.json().then(function (d) {
        var j = d && d.fields && d.fields.json && d.fields.json.stringValue;
        try { return j ? JSON.parse(j) : { on: false }; } catch (e) { return { on: false }; }
      });
    });
  }
  function isOn(c) { return !!(c && c.on && c.c && c.c.some(function (x) { return x && x.h; })); }

  /* ---------- page lock ---------- */
  var css = 'html.rv-lock body>*:not(#rv-gate){visibility:hidden!important}html.rv-lock{overflow:hidden}' +
    '#rv-gate{position:fixed;inset:0;z-index:2147483000;display:flex;align-items:center;justify-content:center;padding:24px;background:radial-gradient(ellipse at 50% 30%,#2a1c0e 0%,#120c06 60%,#090604 100%);color:#f3ead7;font-family:"Cormorant Garamond",Georgia,serif;overflow:auto}' +
    '#rv-gate .rv-box{width:100%;max-width:380px;text-align:center}' +
    '#rv-gate img{width:150px;max-width:60%;height:auto;margin:0 auto 18px;display:block}' +
    '#rv-gate h1{font-family:Cinzel,Georgia,serif;font-weight:500;font-size:1.35rem;letter-spacing:.18em;text-transform:uppercase;color:#d4a94f;margin:0 0 4px}' +
    '#rv-gate .rv-ur{font-size:1.15rem;color:#c9b88f;margin:0 0 18px}' +
    '#rv-gate p{margin:0 0 16px;color:#cdbf9f;font-size:1.1rem;line-height:1.4}' +
    '#rv-gate .rv-f{display:flex;flex-direction:column;gap:12px}' +
    '#rv-gate .rv-w{position:relative}' +
    '#rv-gate input{width:100%;box-sizing:border-box;padding:14px 46px 14px 14px;background:#1a1109;border:1px solid #5a4421;border-radius:4px;color:#f3ead7;font:inherit;font-size:1.25rem;letter-spacing:.12em;text-align:center}' +
    '#rv-gate input:focus{outline:2px solid #d4a94f;outline-offset:1px}' +
    '#rv-gate .rv-eye{position:absolute;right:6px;top:50%;transform:translateY(-50%);background:none;border:0;color:#c9b88f;font-size:1.1rem;cursor:pointer;padding:8px}' +
    '#rv-gate button.rv-go{padding:14px;background:linear-gradient(#d9b25c,#b88a2e);border:0;border-radius:4px;color:#1a1109;font-family:Cinzel,Georgia,serif;font-size:1rem;letter-spacing:.2em;text-transform:uppercase;font-weight:600;cursor:pointer}' +
    '#rv-gate button.rv-go[disabled]{opacity:.55;cursor:default}' +
    '#rv-gate .rv-msg{min-height:1.4em;margin:0;font-size:1.05rem;color:#e8a08a}' +
    '#rv-gate small{display:block;margin-top:22px;color:#8d7c58;font-size:.95rem}';
  function addCss() { if (document.getElementById('rv-gate-css')) return; var s = document.createElement('style'); s.id = 'rv-gate-css'; s.textContent = css; (document.head || root).appendChild(s); }

  function whenBody(fn) { if (document.body) fn(); else document.addEventListener('DOMContentLoaded', fn, { once: true }); }
  function lock() { root.classList.add('rv-lock'); }
  /* shown = which screen is wanted right now (0 = none); a screen queued before the page body exists is dropped if it is no longer wanted */
  function unlock() { shown = 0; root.classList.remove('rv-lock'); if (gate && gate.parentNode) gate.parentNode.removeChild(gate); gate = null; try { document.dispatchEvent(new Event('riwayat-access-ok')); } catch (e) { /* ignore */ } }
  function mount(inner) {
    var id = ++shown;
    whenBody(function () {
      if (id !== shown) return;
      if (!gate) { gate = document.createElement('div'); gate.id = 'rv-gate'; gate.setAttribute('role', 'dialog'); gate.setAttribute('aria-modal', 'true'); gate.setAttribute('aria-label', 'Private access'); document.body.appendChild(gate); }
      gate.innerHTML = '<div class="rv-box"><img src="assets/img/logo.png" alt="Riwayat">' + inner + '</div>';
    });
  }
  function checking() { mount('<h1>Riwayat</h1><p>One moment…</p>'); }
  function retry() {
    mount('<h1>Private preview</h1><p>We could not check access just now. Please check your internet connection and try again.</p><div class="rv-f"><button class="rv-go" type="button" id="rv-retry">Try again</button></div>');
    whenBody(function () { setTimeout(function () { var b = document.getElementById('rv-retry'); if (b) b.onclick = start; }, 0); });
  }

  function form() {
    mount('<h1>Private preview</h1><div class="rv-ur" lang="ur" dir="rtl">نجی ملاحظہ</div><p>Please enter your access code to continue.</p>' +
      '<form class="rv-f" id="rv-form" autocomplete="off"><div class="rv-w"><input id="rv-code" type="password" aria-label="Access code" placeholder="Access code" autocomplete="off" autocapitalize="off" spellcheck="false" maxlength="64"><button class="rv-eye" type="button" id="rv-eye" aria-label="Show code">👁</button></div>' +
      '<button class="rv-go" type="submit" id="rv-go">Enter</button><p class="rv-msg" id="rv-msg" role="alert"></p></form><small>Access is by invitation only.</small>');
    whenBody(function () { setTimeout(wire, 0); });
  }
  function wire() {
    var f = document.getElementById('rv-form'), inp = document.getElementById('rv-code'), msg = document.getElementById('rv-msg'), go = document.getElementById('rv-go'), eye = document.getElementById('rv-eye'), tm = null;
    if (!f) return;
    try { inp.focus(); } catch (e) { /* ignore */ }
    eye.onclick = function () { var show = inp.type === 'password'; inp.type = show ? 'text' : 'password'; eye.setAttribute('aria-label', show ? 'Hide code' : 'Show code'); };
    function waitLeft() { var t = lget(); return t.until && t.until > Date.now() ? Math.ceil((t.until - Date.now()) / 1000) : 0; }
    function tick() {
      var s = waitLeft();
      if (s > 0) { go.disabled = true; msg.textContent = 'Too many tries. Please wait ' + s + ' seconds.'; tm = setTimeout(tick, 500); }
      else { go.disabled = false; if (tm) { tm = null; msg.textContent = ''; } }
    }
    tick();
    f.onsubmit = function (e) {
      e.preventDefault();
      if (waitLeft() > 0) return tick();
      var code = inp.value.trim(); if (!code) { msg.textContent = 'Please enter the code.'; return; }
      go.disabled = true; msg.textContent = '';
      tryCode(code).then(function (slot) {
        if (slot >= 0) { lset({}); sset(SKEY, { slot: slot, v: cfg.c[slot].v }); unlock(); return; }
        var t = lget(), n = (t.n || 0) + 1;
        if (n >= MAX_TRIES) { lset({ n: 0, until: Date.now() + LOCK_MS }); } else lset({ n: n });
        inp.value = ''; go.disabled = false; msg.textContent = n >= MAX_TRIES ? '' : 'That code is not valid. Please try again.';
        if (n >= MAX_TRIES) tick(); else inp.focus();
      }, function () { go.disabled = false; msg.textContent = 'Something went wrong. Please try again.'; });
    };
  }
  function tryCode(code) {
    var out = -1, p = Promise.resolve();
    (cfg.c || []).forEach(function (x, i) { if (!x || !x.h) return; p = p.then(function () { return hash(code, x.s).then(function (h) { if (out < 0 && same(h, x.h)) out = i; }); }); });
    return p.then(function () { return out; });
  }

  /* ---------- start ---------- */
  function start() {
    var ses = sget(SKEY);
    if (!ses) { lock(); checking(); }
    load().then(function (c) {
      cfg = c;
      if (!isOn(c)) { sset(SKEY, null); if (!ses) unlock(); return; }
      if (ses && c.c[ses.slot] && c.c[ses.slot].h && c.c[ses.slot].v === ses.v) return; /* still valid */
      sset(SKEY, null); lock(); form();
    }, function () { if (!ses) retry(); /* a signed-in visitor keeps working if the check fails */ });
  }

  addCss();
  if (!window.crypto || !crypto.subtle) { /* insecure context: cannot hash, so show a plain notice instead of the site */ lock(); mount('<h1>Private preview</h1><p>Please open this site over a secure (https) address.</p>'); }
  else start();

  window.RiwayatAccess = { hash: hash, newSalt: newSalt, load: load };
})();
