/* Riwayat admin: new order / reservation alerts (sound, banner, tab title, optional desktop notification).
   Works only while the admin page is open. Uses no server and no extra accounts. */
(function () {
  'use strict';
  var KEY = 'riwayat_alerts_on';
  var A = { on: true, seen: null, pend: { o: [], r: [] }, ctx: null, flashT: null, base: document.title, opts: null, notified: 0 };
  try { if (localStorage.getItem(KEY) === '0') A.on = false; } catch (e) {}

  function ctx() {
    try {
      if (!A.ctx) { var C = window.AudioContext || window.webkitAudioContext; if (C) A.ctx = new C(); }
      if (A.ctx && A.ctx.state === 'suspended') A.ctx.resume();
    } catch (e) {}
    return A.ctx;
  }
  function tone(c, t, f, d) {
    var o = c.createOscillator(), g = c.createGain();
    o.type = 'sine'; o.frequency.value = f;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.4, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    o.connect(g); g.connect(c.destination); o.start(t); o.stop(t + d + 0.05);
  }
  function chime() {
    var c = ctx(); if (!c || c.state !== 'running') return false;
    var t = c.currentTime;
    [0, 1.0, 2.0].forEach(function (s) { tone(c, t + s, 880, 0.35); tone(c, t + s + 0.22, 1175, 0.55); });
    return true;
  }
  function soundReady() { return !!(A.ctx && A.ctx.state === 'running'); }

  /* ---------- header button ---------- */
  function btn() {
    var b = document.getElementById('btnAlerts');
    if (b) return b;
    var out = document.getElementById('btnOut'); if (!out) return null;
    b = document.createElement('button'); b.id = 'btnAlerts'; b.className = 'btn btn-ghost btn-sm'; b.type = 'button'; b.hidden = true;
    out.parentNode.insertBefore(b, out);
    b.addEventListener('click', function () {
      A.on = !A.on;
      try { localStorage.setItem(KEY, A.on ? '1' : '0'); } catch (e) {}
      if (A.on) {
        ctx(); chime();
        try { if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission(); } catch (e) {}
      }
      label();
    });
    return b;
  }
  function label() {
    var b = btn(); if (!b) return;
    b.hidden = false;
    b.textContent = !A.on ? '🔕 Alerts off' : (soundReady() ? '🔔 Alerts on' : '🔔 Tap for sound');
    b.title = !A.on ? 'Click to turn new-order alerts on' : (soundReady() ? 'Click to turn alerts off' : 'Your browser needs one click on this page before it will play sound');
  }
  function unlock() { ctx(); label(); }
  document.addEventListener('click', unlock, { once: true, capture: true });
  document.addEventListener('keydown', unlock, { once: true, capture: true });

  /* ---------- banner ---------- */
  function bar() {
    var b = document.getElementById('alertbar');
    if (b) return b;
    var app = document.getElementById('app'); if (!app) return null;
    b = document.createElement('div'); b.id = 'alertbar'; b.className = 'alertbar'; b.setAttribute('role', 'status'); b.setAttribute('aria-live', 'polite'); b.hidden = true;
    app.parentNode.insertBefore(b, app);
    b.addEventListener('click', function (e) {
      var a = e.target.closest('[data-al]'); if (!a) return;
      var k = a.getAttribute('data-al');
      if (k === 'view') { var tab = A.pend.o.length ? 'orders' : 'res'; clearPending(); if (A.opts && A.opts.goto) A.opts.goto(tab); }
      else if (k === 'view-r') { clearPending(); if (A.opts && A.opts.goto) A.opts.goto('res'); }
      else if (k === 'dismiss') clearPending();
    });
    return b;
  }
  function plural(n, w) { return n + ' ' + w + (n === 1 ? '' : 's'); }
  function draw() {
    var b = bar(); if (!b) return;
    var no = A.pend.o.length, nr = A.pend.r.length;
    if (!no && !nr) { b.hidden = true; b.innerHTML = ''; stopFlash(); return; }
    var parts = []; if (no) parts.push(plural(no, 'new order')); if (nr) parts.push(plural(nr, 'new reservation'));
    var last = A.pend.o.concat(A.pend.r).sort(function (x, y) { return y.at - x.at; })[0];
    var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
    b.innerHTML = '<span class="al-t">🔔 <b>' + esc(parts.join(' and ')) + '</b> waiting' + (last && last.text ? ' · latest: ' + esc(last.text) : '') + '</span>' +
      '<span class="al-b"><button class="btn btn-gold btn-sm" data-al="view">View</button>' + (no && nr ? '<button class="btn btn-ghost btn-sm" data-al="view-r">Reservations</button>' : '') + '<button class="btn btn-ghost btn-sm" data-al="dismiss">Dismiss</button></span>';
    b.hidden = false;
    startFlash(no + nr);
  }
  function clearPending() { A.pend = { o: [], r: [] }; draw(); }

  /* ---------- tab title flash ---------- */
  var flashOn = false;
  function startFlash(n) {
    if (!A.on) { stopFlash(); return; }
    var msg = '(' + n + ') 🔔 New ' + (A.pend.o.length ? 'order' : 'reservation') + '!';
    if (A.flashT) { A.flashMsg = msg; return; }
    A.flashMsg = msg;
    A.flashT = setInterval(function () { flashOn = !flashOn; document.title = flashOn ? A.flashMsg : A.base; }, 1000);
  }
  function stopFlash() { if (A.flashT) { clearInterval(A.flashT); A.flashT = null; } flashOn = false; document.title = A.base; }

  /* ---------- desktop notification ---------- */
  function notify(text) {
    try {
      if (!A.on || !('Notification' in window) || Notification.permission !== 'granted' || !document.hidden) return;
      var n = new Notification('Riwayat: new order or booking', { body: text, tag: 'riwayat-new' });
      n.onclick = function () { window.focus(); n.close(); };
    } catch (e) {}
  }

  /* ---------- public API ---------- */
  /* S: admin state ({orders, res}); opts: {goto(tab), describe(kind, rec)} */
  function check(S, opts) {
    A.opts = opts || A.opts || {};
    btn(); label();
    var desc = function (k, r) { try { return A.opts.describe ? A.opts.describe(k, r) : (r.id || ''); } catch (e) { return r.id || ''; } };
    var cur = { o: {}, r: {} }, fresh = [];
    S.orders.forEach(function (o) { cur.o[o._doc] = o; });
    S.res.forEach(function (r) { cur.r[r._doc] = r; });
    if (A.seen === null) {
      /* first load after sign-in: show what is already waiting, silently */
      A.seen = { o: {}, r: {} };
      Object.keys(cur.o).forEach(function (k) { A.seen.o[k] = 1; if (cur.o[k]._status === 'new') A.pend.o.push({ id: k, at: +new Date(cur.o[k]._placed) || 0, text: desc('order', cur.o[k]) }); });
      Object.keys(cur.r).forEach(function (k) { A.seen.r[k] = 1; if (cur.r[k]._status === 'new') A.pend.r.push({ id: k, at: +new Date(cur.r[k]._placed) || 0, text: desc('reservation', cur.r[k]) }); });
      draw(); return;
    }
    Object.keys(cur.o).forEach(function (k) { if (!A.seen.o[k]) { A.seen.o[k] = 1; if (cur.o[k]._status === 'new') { var it = { id: k, at: +new Date(cur.o[k]._placed) || Date.now(), text: desc('order', cur.o[k]) }; A.pend.o.push(it); fresh.push(it); } } });
    Object.keys(cur.r).forEach(function (k) { if (!A.seen.r[k]) { A.seen.r[k] = 1; if (cur.r[k]._status === 'new') { var it = { id: k, at: +new Date(cur.r[k]._placed) || Date.now(), text: desc('reservation', cur.r[k]) }; A.pend.r.push(it); fresh.push(it); } } });
    /* drop anything that has since been handled (or deleted) */
    A.pend.o = A.pend.o.filter(function (p) { return cur.o[p.id] && cur.o[p.id]._status === 'new'; });
    A.pend.r = A.pend.r.filter(function (p) { return cur.r[p.id] && cur.r[p.id]._status === 'new'; });
    draw();
    if (fresh.length && A.on) {
      chime();
      notify(fresh.map(function (f) { return f.text; }).join('\n'));
    }
  }
  function reset() { A.seen = null; A.pend = { o: [], r: [] }; draw(); var b = document.getElementById('btnAlerts'); if (b) b.hidden = true; }

  window.RiwayatAlerts = { check: check, reset: reset, _state: A, _chime: chime };
})();
