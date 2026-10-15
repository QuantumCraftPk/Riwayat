/* Riwayat admin panel. Talks to Firebase through js/fs.js (REST). */
(function () {
  'use strict';
  var FS = window.RiwayatFS, U = window.RIWAYAT_UTIL, DEF = window.RIWAYAT_DEFAULT_SETTINGS;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var pad = function (n) { return (n < 10 ? '0' : '') + n; };
  var money = function (n) { return 'Rs ' + Math.round(+n || 0).toLocaleString('en-US'); };
  var clone = function (o) { return JSON.parse(JSON.stringify(o)); };
  var CUISINE = { desi: 'Desi', arabic: 'Arabic', continental: 'Continental', chinese: 'Chinese', buffet: 'Buffet', mix: 'Mix', undecided: 'Not decided yet' };
  var SEAT = { vvip: 'VVIP Hall', indoor: 'Indoor', terrace: 'Terrace', lawn: 'Lawn', roof: 'Roof Top', rooftop: 'Roof Top' };
  var TYPE = { pickup: 'Takeaway - Pickup', delivery: 'Takeaway - Delivery' };
  var OST = ['new', 'preparing', 'ready', 'completed', 'cancelled'], RST = ['new', 'confirmed', 'declined'];
  var LBL = { 'new': 'New', preparing: 'Preparing', ready: 'Ready', completed: 'Completed', cancelled: 'Cancelled', confirmed: 'Confirmed', declined: 'Declined' };

  var S = { tab: 'orders', orders: [], res: [], ofilter: 'all', rfilter: 'all', cat: 0, q: '', loaded: false,
    docs: { menu: null, cel: null, set: null }, dirty: { menu: false, cel: false, set: false }, dash: '7', bulk: { pct: 5, scope: 'all', round: 10, buffets: true } };
  var timer = null, ROLE = 'admin';
  function isAdminRole() { return ROLE === 'admin'; }

  /* ---------- small helpers ---------- */
  function toast(msg, bad) { var t = document.createElement('div'); t.className = 'toast' + (bad ? ' bad' : ''); t.textContent = msg; document.body.appendChild(t); setTimeout(function () { t.remove(); }, 3200); }
  function fmtTime(min) { min = +min; var h = Math.floor(min / 60) % 24, m = min % 60; return ((h + 11) % 12 + 1) + ':' + pad(m) + ' ' + (h >= 12 ? 'pm' : 'am'); }
  function stamp(iso) { var d = new Date(iso); return isNaN(d) ? '' : d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + ' ' + fmtTime(d.getHours() * 60 + d.getMinutes()); }
  function slug(s) { return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'item'; }
  function parse(s) { try { return JSON.parse(s); } catch (e) { return null; } }
  function isDirty() { return S.dirty.menu || S.dirty.cel || S.dirty.set; }
  function mark(k) { S.dirty[k] = true; showBar(); }
  function showBar() { $('#savebar').hidden = !isDirty(); }
  function statusLabel(k, st) { return LBL[st] || st; }
  function errMsg(e) { return e && e.status === 403 ? 'Not allowed. Check that you are signed in as the administrator and the Firestore rules are published.' : (e && e.message) || 'Something went wrong.'; }

  /* ---------- login ---------- */
  function showLogin(msg) {
    clearInterval(timer); $('#login').hidden = false; $('#app').hidden = true; $('#btnOut').hidden = true; $('#who').textContent = '';
    var e = $('#lErr'); e.hidden = !msg; e.textContent = msg || '';
  }
  function friendly(e) {
    var m = String(e && e.message || '');
    if (/INVALID_LOGIN|INVALID_PASSWORD|EMAIL_NOT_FOUND|INVALID_EMAIL/.test(m)) return 'Email or password is incorrect.';
    if (/TOO_MANY/.test(m)) return 'Too many attempts. Please wait a few minutes and try again.';
    if (e && e.name === 'TypeError') return 'Could not reach the server. Check your internet connection.';
    return 'Sign in failed (' + m + ').';
  }
  $('#loginForm').addEventListener('submit', function (ev) {
    ev.preventDefault(); var b = $('#lBtn'); b.disabled = true; b.textContent = 'Signing in…';
    FS.signIn($('#lEmail').value.trim(), $('#lPass').value).then(function (a) {
      $('#lPass').value = ''; start();
    }).catch(function (e) { showLogin(friendly(e)); }).then(function () { b.disabled = false; b.textContent = 'Sign in'; });
  });
  $('#btnOut').addEventListener('click', function () { if (isDirty() && !confirm('You have unsaved changes. Sign out anyway?')) return; FS.signOut(); S.loaded = false; showLogin(); });
  window.addEventListener('beforeunload', function (e) { if (isDirty()) { e.preventDefault(); e.returnValue = ''; } });

  /* ---------- data ---------- */
  function loadSite() {
    return Promise.all([FS.get('site/menu'), FS.get('site/celebrations'), FS.get('site/settings')]).then(function (d) {
      var m = d[0] && parse(d[0].json), c = d[1] && parse(d[1].json), s = d[2] && parse(d[2].json);
      S.docs.menu = m && m.categories ? m : clone(window.RIWAYAT_MENU);
      S.docs.cel = c && c.birthday ? c : clone(window.RIWAYAT_PARTIES);
      S.docs.set = U.merge(DEF, s || {});
      S.first = { menu: !(m && m.categories), cel: !(c && c.birthday), set: !s };
      if (!isAdminRole()) return;
      return FS.getAuth('config/staff').then(function (d) { S.staff = d && Array.isArray(d.emails) ? d.emails.slice() : []; S.staffErr = false; }, function () { S.staff = []; S.staffErr = true; });
    });
  }
  function loadRecords() {
    return Promise.all([FS.list('orders', 'placedAt', 500), FS.list('reservations', 'placedAt', 500)]).then(function (r) {
      var f = function (kind) { return function (d) { var rec = parse(d.json) || {}; rec._doc = d._id; rec._status = d.status || 'new'; rec._placed = d.placedAt || rec.placedAt; return rec; }; };
      S.orders = r[0].map(f('order')); S.res = r[1].map(f('reservation'));
    });
  }
  function start() {
    var a = FS.session(); ROLE = a.email.toLowerCase() === String(FS.adminEmail).toLowerCase() ? 'admin' : 'staff'; S.tab = isAdminRole() ? S.tab : (S.tab === 'res' ? 'res' : 'orders'); $('#login').hidden = true; $('#app').hidden = false; $('#btnOut').hidden = false; $('#who').textContent = a.email + (isAdminRole() ? '' : ' (staff)');
    $('#view').innerHTML = '<p class="mute">Loading…</p>';
    Promise.all([loadSite(), loadRecords()]).then(function () {
      S.loaded = true; drawTabs(); draw();
      clearInterval(timer); timer = setInterval(function () { if (S.tab === 'orders' || S.tab === 'res' || S.tab === 'dash') refresh(true); }, 20000);
    }).catch(function (e) {
      if (!isAdminRole() && e && e.status === 403) { FS.signOut(); showLogin('This account has not been given access. Ask the administrator to add your email under Staff.'); return; }
      if (e && e.status === 401) { FS.signOut(); showLogin('Your session expired. Please sign in again.'); return; }
      $('#view').innerHTML = '<div class="adm-err">' + esc(errMsg(e)) + '</div><p><button class="btn btn-ghost" id="retry">Try again</button></p>';
      $('#retry').onclick = start;
    });
  }
  function refresh(quiet) {
    return loadRecords().then(function () { drawTabs(); if (S.tab === 'orders' || S.tab === 'res' || S.tab === 'dash') { var y = window.scrollY; draw(); window.scrollTo(0, y); } if (!quiet) toast('Updated'); }, function (e) { if (!quiet) toast(errMsg(e), true); });
  }

  /* ---------- save ---------- */
  var DOCMAP = { menu: ['site/menu', 'menu'], cel: ['site/celebrations', 'cel'], set: ['site/settings', 'set'] };
  $('#btnSave').addEventListener('click', function () {
    var keys = Object.keys(S.dirty).filter(function (k) { return S.dirty[k]; }), b = $('#btnSave'); b.disabled = true; b.textContent = 'Saving…';
    keys.reduce(function (p, k) {
      return p.then(function () { return FS.update(DOCMAP[k][0], { json: JSON.stringify(S.docs[DOCMAP[k][1]]) }).then(function () { S.dirty[k] = false; }); });
    }, Promise.resolve()).then(function () { toast('Saved. The website now shows your changes.'); }, function (e) { toast(errMsg(e), true); })
      .then(function () { b.disabled = false; b.textContent = 'Save changes'; showBar(); });
  });
  $('#btnDiscard').addEventListener('click', function () {
    if (!confirm('Discard all unsaved changes?')) return;
    S.dirty = { menu: false, cel: false, set: false }; showBar(); loadSite().then(draw);
  });

  /* ---------- tabs ---------- */
  var TABS = [['orders', 'Orders'], ['res', 'Reservations'], ['dash', 'Dashboard'], ['menu', 'Menu'], ['prices', 'Prices & Sold out'], ['cel', 'Celebrations'], ['set', 'Settings'], ['export', 'Excel'], ['staff', 'Staff']];
  function visibleTabs() { return isAdminRole() ? TABS : TABS.filter(function (t) { return t[0] === 'orders' || t[0] === 'res'; }); }
  function drawTabs() {
    var n1 = S.orders.filter(function (o) { return o._status === 'new'; }).length, n2 = S.res.filter(function (o) { return o._status === 'new'; }).length;
    $('#tabs').innerHTML = visibleTabs().map(function (t) {
      var n = t[0] === 'orders' ? n1 : t[0] === 'res' ? n2 : 0;
      return '<button role="tab" data-tab="' + t[0] + '" aria-selected="' + (S.tab === t[0]) + '">' + t[1] + (n ? '<span class="badge">' + n + '</span>' : '') + '</button>';
    }).join('');
  }
  $('#tabs').addEventListener('click', function (e) { var b = e.target.closest('[data-tab]'); if (!b) return; S.tab = b.getAttribute('data-tab'); drawTabs(); draw(); window.scrollTo(0, 0); });

  /* ---------- views ---------- */
  var V = {};
  function draw() { if (!S.loaded) return; var n = $('#notice'); var f = S.first || {}; n.hidden = !((S.tab === 'menu' || S.tab === 'prices') && f.menu || S.tab === 'cel' && f.cel || S.tab === 'set' && f.set);
    n.textContent = 'Nothing has been saved online for this section yet, so the built-in version is shown. Press “Save changes” after your first edit to publish it.'; $('#view').innerHTML = V[S.tab](); }

  function filterBar(cur, list, attr, count) {
    return '<div class="row"><div><label>Show</label><select data-filter="' + attr + '"><option value="all">All (' + count.all + ')</option>' + list.map(function (s) { return '<option value="' + s + '"' + (cur === s ? ' selected' : '') + '>' + LBL[s] + ' (' + (count[s] || 0) + ')</option>'; }).join('') + '</select></div><div class="fit"><button class="btn btn-ghost btn-sm" data-act="refresh">Refresh</button></div></div>';
  }
  function counts(arr) { var c = { all: arr.length }; arr.forEach(function (o) { c[o._status] = (c[o._status] || 0) + 1; }); return c; }
  function statusSel(kind, o, list) { return '<select data-status="' + kind + '" data-doc="' + esc(o._doc) + '" aria-label="Status">' + list.map(function (s) { return '<option value="' + s + '"' + (o._status === s ? ' selected' : '') + '>' + LBL[s] + '</option>'; }).join('') + '</select>'; }

  V.orders = function () {
    var c = counts(S.orders), rows = S.orders.filter(function (o) { return S.ofilter === 'all' || o._status === S.ofilter; });
    var rev = S.orders.filter(function (o) { return o._status !== 'cancelled'; }).reduce(function (a, o) { return a + ((o.totals || {}).total || 0); }, 0);
    return '<h2>Takeaway orders</h2><div class="stat"><div><b>' + c.all + '</b>Total orders</div><div><b>' + (c['new'] || 0) + '</b>New</div><div><b>' + money(rev) + '</b>Value (not cancelled)</div></div>' + filterBar(S.ofilter, OST, 'ofilter', c) +
      (rows.map(function (o) {
        var d = o.details || {}, t = o.totals || {}, e = o.eta || {};
        return '<div class="rec"><div class="rec-h"><span><b>' + esc(o.id) + '</b> <span class="pill ' + o._status + '">' + LBL[o._status] + '</span></span><span>' + statusSel('order', o, OST) + '</span></div><dl>' +
          '<dt>Placed</dt><dd>' + esc(stamp(o._placed)) + '</dd><dt>Type</dt><dd>' + esc(TYPE[o.type] || o.type) + '</dd><dt>Customer</dt><dd>' + esc(d.name) + ' · <a href="tel:' + esc(d.phone) + '">' + esc(d.phone) + '</a></dd>' +
          (o.type === 'delivery' ? '<dt>Address</dt><dd>' + esc(d.address) + '</dd>' : '<dt>Pickup</dt><dd>' + (d.time === 'asap' ? 'As soon as possible' : 'Today ' + esc(fmtTime(d.time))) + '</dd>') +
          '<dt>Items</dt><dd>' + (o.lines || []).map(function (l) { return esc(l.qty + ' × ' + l.name); }).join('<br>') + '</dd>' + (d.notes ? '<dt>Notes</dt><dd>' + esc(d.notes) + '</dd>' : '') +
          '<dt>Total</dt><dd><b>' + money(t.total) + '</b> (sub ' + money(t.sub) + ', GST ' + money(t.gst) + (t.del ? ', delivery ' + money(t.del) : '') + ')</dd>' + (e.value ? '<dt>Promised</dt><dd>' + esc(e.title + ' ' + e.value) + '</dd>' : '') + '</dl>' +
          '<div class="row" style="margin:8px 0 0"><button class="btn btn-gold btn-sm fit" data-act="print" data-kind="order" data-doc="' + esc(o._doc) + '">🖨 Print slip</button>' + (isAdminRole() ? '<button class="btn btn-ghost btn-sm fit" data-del="orders" data-doc="' + esc(o._doc) + '">Delete</button>' : '') + '</div></div>';
      }).join('') || '<p class="mute">No orders to show.</p>');
  };
  V.res = function () {
    var c = counts(S.res), rows = S.res.filter(function (o) { return S.rfilter === 'all' || o._status === S.rfilter; });
    return '<h2>Dine In reservations</h2><div class="stat"><div><b>' + c.all + '</b>Total</div><div><b>' + (c['new'] || 0) + '</b>Awaiting confirmation</div></div>' + filterBar(S.rfilter, RST, 'rfilter', c) +
      (rows.map(function (r) {
        var ages = (r.kids || []).map(function (a) { return String(a) === '0' ? 'under 1' : a; });
        return '<div class="rec"><div class="rec-h"><span><b>' + esc(r.id) + '</b> <span class="pill ' + r._status + '">' + LBL[r._status] + '</span></span><span>' + statusSel('reservation', r, RST) + '</span></div><dl>' +
          '<dt>Placed</dt><dd>' + esc(stamp(r._placed)) + '</dd><dt>Guest</dt><dd>' + esc(r.name || '(not given)') + (r.phone ? ' · <a href="tel:' + esc(r.phone) + '">' + esc(r.phone) + '</a>' : '') + '</dd>' +
          '<dt>When</dt><dd>' + esc(r.date) + ' at ' + esc(fmtTime(r.time)) + '</dd><dt>Guests</dt><dd>' + (r.guests || (r.adults + (r.kids || []).length)) + ' (' + r.adults + ' adults' + ((r.kids || []).length ? ', ' + r.kids.length + ' kids, ages ' + esc(ages.join(', ')) : '') + ')</dd>' +
          '<dt>Cuisine</dt><dd>' + esc(CUISINE[r.cuisine] || r.cuisine) + '</dd><dt>Seating</dt><dd>' + esc(SEAT[r.seating] || r.seating) + '</dd></dl>' +
          '<div class="row" style="margin:8px 0 0"><button class="btn btn-gold btn-sm fit" data-act="print" data-kind="reservation" data-doc="' + esc(r._doc) + '">🖨 Print slip</button>' + (isAdminRole() ? '<button class="btn btn-ghost btn-sm fit" data-del="reservations" data-doc="' + esc(r._doc) + '">Delete</button>' : '') + '</div></div>';
      }).join('') || '<p class="mute">No reservations to show.</p>');
  };


  /* printable kitchen slip (80 mm receipt width) */
  function slipHtml(kind, o) {
    var line = '<div class="sl-sep"></div>', row = function (k, v) { return v ? '<div class="sl-r"><span>' + esc(k) + '</span><b>' + esc(v) + '</b></div>' : ''; };
    var head = '<div class="sl-h">RIWAYAT</div><div class="sl-t">' + (kind === 'order' ? 'KITCHEN ORDER' : 'TABLE BOOKING') + '</div>' + line;
    var foot = line + '<div class="sl-f">Printed ' + esc(stamp(new Date().toISOString())) + '</div>';
    if (kind === 'order') {
      var d = o.details || {}, e = o.eta || {}, del = o.type === 'delivery';
      return head + '<div class="sl-big">' + (del ? 'DELIVERY' : 'PICKUP') + '</div>' + row('Order', o.id) + row('Placed', stamp(o._placed)) + row(del ? 'Deliver by' : 'Ready at', e.value ? e.value.replace(/^By /, '') : (d.time && d.time !== 'asap' ? fmtTime(d.time) : '')) + line +
        (o.lines || []).map(function (l) { return '<div class="sl-i"><b>' + esc(l.qty) + ' ×</b> ' + esc(l.name) + '</div>'; }).join('') + line +
        (d.notes ? '<div class="sl-n"><b>NOTES:</b> ' + esc(d.notes) + '</div>' + line : '') +
        row('Customer', d.name) + row('Phone', d.phone) + (del ? '<div class="sl-addr"><span>Address</span><b>' + esc(d.address) + '</b></div>' : '') + foot;
    }
    var ages = (o.kids || []).map(function (a) { return String(a) === '0' ? 'under 1' : a; });
    return head + '<div class="sl-big">' + esc(o.date) + ' · ' + esc(fmtTime(o.time)) + '</div>' + row('Booking', o.id) + row('Guest', o.name) + row('Phone', o.phone) + line +
      row('Guests', (o.guests || (o.adults + (o.kids || []).length)) + ' (' + o.adults + ' adults' + ((o.kids || []).length ? ', ' + o.kids.length + ' kids: ' + ages.join(', ') : '') + ')') + row('Seating', SEAT[o.seating] || o.seating) + row('Cuisine', CUISINE[o.cuisine] || o.cuisine) + row('Status', LBL[o._status]) + foot;
  }
  function printSlip(kind, id) {
    var o = (kind === 'order' ? S.orders : S.res).filter(function (x) { return x._doc === id; })[0]; if (!o) return;
    var el = document.getElementById('slip'); if (!el) { el = document.createElement('div'); el.id = 'slip'; document.body.appendChild(el); }
    el.innerHTML = slipHtml(kind, o); window.print();
  }

  /* staff accounts */
  V.staff = function () {
    var list = S.staff || [];
    return '<h2>Staff accounts</h2>' + (S.staffErr ? '<div class="adm-err">The staff list could not be read. Publish the latest rules from docs/firestore.rules in Firebase, then reload this page.</div>' : '') + '<p class="mute">Staff can see orders and reservations and change their status. They cannot see sales, edit the menu or prices, delete anything or download Excel files.</p>' +
      '<div class="ed"><h3 style="margin-top:0">Add a staff member</h3><ol class="mute" style="margin:0 0 10px 18px;padding:0"><li>In Firebase → Authentication → Users, click <b>Add user</b> and create their email and password.</li><li>Type the same email below and click Add.</li><li>Give them the page address and their password. They sign in on this same page.</li></ol>' +
      '<div class="row"><div><label>Staff email</label><input id="stEmail" type="email" placeholder="name@example.com"></div><div class="fit"><button class="btn btn-gold btn-sm" data-act="addstaff">Add</button></div></div></div>' +
      '<div class="ed"><h3 style="margin-top:0">Current staff (' + list.length + ')</h3>' + (list.length ? list.map(function (em, i) { return '<div class="row" style="align-items:center"><div>' + esc(em) + '</div><div class="fit"><button class="btn btn-ghost btn-sm" data-act="rmstaff" data-i="' + i + '">Remove access</button></div></div>'; }).join('') : '<p class="mute" style="margin:0">No staff yet.</p>') + '</div>' +
      '<p class="mute">Removing someone here stops them from seeing orders straight away. To fully delete their login, also delete the user in Firebase → Authentication.</p>';
  };
  function saveStaff(list, msg) {
    return FS.update('config/staff', { emails: list }).then(function () { S.staff = list; toast(msg); draw(); }, function (e) { toast(errMsg(e), true); });
  }

  /* sales dashboard */
  var DASH = [['1', 'Today'], ['7', '7 days'], ['30', '30 days'], ['90', '90 days'], ['all', 'All time']];
  function dkey(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function dlabel(d) { return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }); }
  function kfmt(n) { n = Math.round(n); if (n >= 1e6) return (n / 1e6).toFixed(1).replace(/\.0$/, '') + 'M'; if (n >= 1000) return (n / 1000).toFixed(n >= 10000 ? 0 : 1).replace(/\.0$/, '') + 'k'; return String(n); }
  function hlabel(h) { return ((h + 11) % 12 + 1) + (h >= 12 ? 'p' : 'a'); }
  function tipAttr(v, l) { return ' tabindex="0" data-tipv="' + esc(v) + '" data-tipl="' + esc(l) + '"'; }
  V.dash = function () {
    var now = new Date(), today = new Date(now.getFullYear(), now.getMonth(), now.getDate()), start, capped = false;
    var all = S.orders.filter(function (o) { return !isNaN(new Date(o._placed)); });
    if (S.dash === 'all') { var mn = all.reduce(function (m, o) { return Math.min(m, +new Date(o._placed)); }, +now); start = new Date(mn); start.setHours(0, 0, 0, 0); }
    else start = new Date(today.getFullYear(), today.getMonth(), today.getDate() - (+S.dash - 1));
    var days = Math.round((today - start) / 864e5) + 1;
    if (days > 90) { start = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 89); days = 90; capped = true; }
    var inR = all.filter(function (o) { return new Date(o._placed) >= start; }), live = inR.filter(function (o) { return o._status !== 'cancelled'; });
    var cancelled = inR.length - live.length, tot = function (o) { return (o.totals || {}).total || 0; };
    var sales = live.reduce(function (a, o) { return a + tot(o); }, 0), avg = live.length ? sales / live.length : 0;
    var rs = S.res.filter(function (r) { var d = new Date(r._placed); return !isNaN(d) && d >= start; }), rLive = rs.filter(function (r) { return r._status !== 'declined'; });
    var guests = rLive.reduce(function (a, r) { return a + (r.guests || 0); }, 0), vvip = rLive.filter(function (r) { return r.seating === 'vvip'; }).length;

    var buckets = [], map = {};
    for (var i = 0; i < days; i++) { var d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i), b = { d: d, sales: 0, n: 0 }; buckets.push(b); map[dkey(d)] = b; }
    live.forEach(function (o) { var b = map[dkey(new Date(o._placed))]; if (b) { b.sales += tot(o); b.n++; } });
    var max = buckets.reduce(function (m, b) { return Math.max(m, b.sales); }, 0) || 1;
    var cols = buckets.map(function (b) {
      return '<div class="col"' + tipAttr(money(b.sales), dlabel(b.d) + ' · ' + b.n + (b.n === 1 ? ' order' : ' orders')) + '><i style="height:' + (b.sales ? Math.max(2, b.sales / max * 100) : 0) + '%"></i></div>';
    }).join('');
    var mid = buckets[Math.floor((buckets.length - 1) / 2)].d;
    var daily = '<div class="chartwrap"><div class="yax"><span>' + kfmt(max) + '</span><span>' + kfmt(max / 2) + '</span><span>0</span></div><div class="plot"><div class="gl g1"></div><div class="gl g2"></div><div class="cols">' + cols + '</div></div></div>' +
      '<div class="xax"><span>' + dlabel(buckets[0].d) + '</span><span>' + (buckets.length > 2 ? dlabel(mid) : '') + '</span><span>' + dlabel(buckets[buckets.length - 1].d) + '</span></div>' +
      '<details class="tv"><summary>View as table</summary><div class="tw"><table class="pt"><thead><tr><th>Day</th><th>Orders</th><th>Sales (Rs)</th></tr></thead><tbody>' + buckets.filter(function (b) { return b.n; }).reverse().map(function (b) { return '<tr><td>' + dlabel(b.d) + '</td><td>' + b.n + '</td><td>' + Math.round(b.sales).toLocaleString('en-US') + '</td></tr>'; }).join('') + '</tbody></table></div></details>';

    var dishes = {}; live.forEach(function (o) { (o.lines || []).forEach(function (l) { var x = dishes[l.name] || (dishes[l.name] = { n: 0, rs: 0 }); x.n += l.qty; x.rs += l.total || 0; }); });
    var top = Object.keys(dishes).map(function (k) { return { name: k, n: dishes[k].n, rs: dishes[k].rs }; }).sort(function (a, b) { return b.n - a.n || b.rs - a.rs; }).slice(0, 8), tmax = top.length ? top[0].n : 1;
    var topHtml = top.length ? top.map(function (t) { return '<div class="hrow"' + tipAttr(t.n + ' sold', t.name + ' · ' + money(t.rs)) + '><span class="hn">' + esc(t.name) + '</span><span class="ht"><i style="width:' + Math.max(3, t.n / tmax * 100) + '%"></i></span><span class="hv">' + t.n + '</span></div>'; }).join('') : '<p class="mute">No dishes sold in this period.</p>';

    var pk = live.filter(function (o) { return o.type === 'pickup'; }), dl = live.filter(function (o) { return o.type === 'delivery'; });
    var pkS = pk.reduce(function (a, o) { return a + tot(o); }, 0), dlS = dl.reduce(function (a, o) { return a + tot(o); }, 0), both = pkS + dlS;
    var split = both ? '<div class="split"><i class="s1"' + tipAttr(money(pkS), 'Pickup · ' + pk.length + ' orders') + ' style="flex:' + pkS + '"></i><i class="s2"' + tipAttr(money(dlS), 'Delivery · ' + dl.length + ' orders') + ' style="flex:' + dlS + '"></i></div>' +
      '<div class="lg"><span><i class="sw s1"></i><b>Pickup</b> ' + pk.length + ' orders · ' + money(pkS) + ' (' + Math.round(pkS / both * 100) + '%)</span><span><i class="sw s2"></i><b>Delivery</b> ' + dl.length + ' orders · ' + money(dlS) + ' (' + Math.round(dlS / both * 100) + '%)</span></div>' : '<p class="mute">No orders in this period.</p>';

    var hrs = {}, hmin = 24, hmax = -1; live.forEach(function (o) { var h = new Date(o._placed).getHours(); hrs[h] = (hrs[h] || 0) + 1; hmin = Math.min(hmin, h); hmax = Math.max(hmax, h); });
    var hhtml = '<p class="mute">No orders in this period.</p>';
    if (hmax >= 0) {
      hmin = Math.min(hmin, 10); hmax = Math.max(hmax, 21); var hm = 1, hc = ''; for (var h = hmin; h <= hmax; h++) hm = Math.max(hm, hrs[h] || 0);
      for (var h2 = hmin; h2 <= hmax; h2++) hc += '<div class="col"' + tipAttr((hrs[h2] || 0) + ((hrs[h2] || 0) === 1 ? ' order' : ' orders'), U.clock(h2 * 60) + ' – ' + U.clock((h2 + 1) * 60)) + '><i style="height:' + ((hrs[h2] || 0) ? Math.max(4, hrs[h2] / hm * 100) : 0) + '%"></i><em>' + hlabel(h2) + '</em></div>';
      hhtml = '<div class="plot hours"><div class="cols">' + hc + '</div></div>';
    }
    var filt = '<div class="pills" role="group" aria-label="Period">' + DASH.map(function (x) { return '<button class="pill-b" data-act="dash" data-v="' + x[0] + '" aria-pressed="' + (S.dash === x[0]) + '">' + x[1] + '</button>'; }).join('') + '</div>';
    var tile = function (v, l) { return '<div><b>' + v + '</b>' + l + '</div>'; };
    return '<h2>Sales dashboard</h2>' + filt +
      '<div class="stat">' + tile(money(sales), 'Sales') + tile(live.length, 'Orders') + tile(money(avg), 'Average order') + tile(cancelled, 'Cancelled (not counted)') + '</div>' +
      '<div class="ed"><h3 style="margin-top:0">Sales per day (Rs)</h3>' + daily + '</div>' +
      '<div class="two"><div class="ed"><h3 style="margin-top:0">Top dishes (quantity sold)</h3>' + topHtml + '</div><div class="ed"><h3 style="margin-top:0">Pickup vs delivery (by sales)</h3>' + split + '<h3>Busiest hours (orders placed)</h3>' + hhtml + '</div></div>' +
      '<div class="ed"><h3 style="margin-top:0">Reservations in this period</h3><div class="stat" style="margin:0">' + tile(rLive.length, 'Bookings') + tile(guests, 'Guests expected') + tile(vvip, 'VVIP hall') + tile(rs.filter(function (r) { return r._status === 'new'; }).length, 'Awaiting confirmation') + '</div></div>' +
      '<p class="mute">Sales exclude cancelled orders and are based on the totals customers were shown (GST and delivery fee included). ' + (capped ? 'Showing the last 90 days. ' : '') + (S.orders.length >= 500 ? 'Only the latest 500 orders are loaded. ' : '') + 'Times are in this device’s time zone.</p>';
  };

  /* menu editor */
  function allItems(M) { var out = []; M.categories.forEach(function (c, ci) { c.groups.forEach(function (g, gi) { g.items.forEach(function (it, ii) { out.push({ c: c, g: g, it: it, ci: ci, gi: gi, ii: ii }); }); }); }); return out; }
  function itemEd(it, ci, gi, ii) {
    var at = ' data-m="item" data-ci="' + ci + '" data-gi="' + gi + '" data-ii="' + ii + '"';
    var price = it.variants && it.variants.length > 1 ?
      '<div style="flex:2 1 220px"><label>Sizes and prices</label>' + it.variants.map(function (v, vi) { return '<div class="vr"><input' + at + ' data-vi="' + vi + '" data-f="vlabel" value="' + esc(v.label) + '" aria-label="Size name"><input' + at + ' data-vi="' + vi + '" data-f="vprice" type="number" min="0" value="' + v.price + '" aria-label="Price"></div>'; }).join('') + '</div>' :
      '<div><label>Price (Rs)</label><input' + at + ' data-f="price" type="number" min="0" value="' + (it.price || 0) + '"></div>';
    return '<div class="ed"><div class="row"><div style="flex:2 1 220px"><label>Dish name</label><input' + at + ' data-f="name" value="' + esc(it.name) + '"></div>' + price + '</div>' +
      '<div class="row"><div style="flex:3 1 260px"><label>Description</label><textarea' + at + ' data-f="desc">' + esc(it.desc || '') + '</textarea></div></div>' +
      '<div class="row"><label class="chk"><input type="checkbox"' + at + ' data-f="preorder"' + (it.preorder ? ' checked' : '') + '> Pre-order (24h)</label><label class="chk"><input type="checkbox"' + at + ' data-f="soldOut"' + (it.soldOut ? ' checked' : '') + '> Sold out</label>' +
      '<button class="btn btn-ghost btn-sm fit" data-act="addsize"' + at + '>+ Size</button>' + (it.variants && it.variants.length > 1 ? '<button class="btn btn-ghost btn-sm fit" data-act="delsize"' + at + '>− Last size</button>' : '') +
      '<button class="btn btn-ghost btn-sm fit" data-act="delitem"' + at + '>Delete dish</button></div></div>';
  }
  V.menu = function () {
    var M = S.docs.menu; if (S.cat >= M.categories.length) S.cat = 0; var c = M.categories[S.cat], ci = S.cat, q = S.q.trim().toLowerCase();
    var h = '<h2>Menu</h2><div class="row"><div><label>Category</label><select data-f="cat">' + M.categories.map(function (x, i) { return '<option value="' + i + '"' + (i === ci ? ' selected' : '') + '>' + esc(x.name) + '</option>'; }).join('') + '</select></div>' +
      '<div><label>Search dishes in this category</label><input data-f="q" value="' + esc(S.q) + '" placeholder="Type a dish name"></div>' +
      '<div class="fit"><button class="btn btn-ghost btn-sm" data-act="addcat">+ New category</button></div></div>' +
      '<div class="ed"><div class="row"><div><label>Category name</label><input data-m="cat" data-ci="' + ci + '" data-f="name" value="' + esc(c.name) + '"></div><div><label>Urdu title</label><input data-m="cat" data-ci="' + ci + '" data-f="urdu" dir="rtl" value="' + esc(c.urdu || '') + '"></div><div><label>Subtitle</label><input data-m="cat" data-ci="' + ci + '" data-f="subtitle" value="' + esc(c.subtitle || '') + '"></div>' +
      '<div class="fit"><button class="btn btn-ghost btn-sm" data-act="delcat" data-ci="' + ci + '">Delete category</button></div></div></div>';
    c.groups.forEach(function (g, gi) {
      h += '<h3>' + esc(g.name) + '</h3><div class="ed"><div class="row"><div><label>Group name</label><input data-m="group" data-ci="' + ci + '" data-gi="' + gi + '" data-f="name" value="' + esc(g.name) + '"></div><div><label>Note (optional)</label><input data-m="group" data-ci="' + ci + '" data-gi="' + gi + '" data-f="note" value="' + esc(g.note || '') + '"></div>' +
        '<div class="fit"><button class="btn btn-ghost btn-sm" data-act="delgroup" data-ci="' + ci + '" data-gi="' + gi + '">Delete group</button></div></div></div>';
      g.items.forEach(function (it, ii) { if (!q || it.name.toLowerCase().indexOf(q) >= 0) h += itemEd(it, ci, gi, ii); });
      h += '<p><button class="btn btn-gold btn-sm" data-act="additem" data-ci="' + ci + '" data-gi="' + gi + '">+ Add dish to “' + esc(g.name) + '”</button></p>';
    });
    return h + '<p><button class="btn btn-ghost btn-sm" data-act="addgroup" data-ci="' + ci + '">+ Add group</button></p>';
  };

  /* prices + sold out */
  V.prices = function () {
    var M = S.docs.menu, B = S.bulk;
    var h = '<h2>Prices &amp; Sold out</h2><div class="ed"><h3 style="margin-top:0">Change many prices at once</h3><div class="row">' +
      '<div><label>Change by %</label><input type="number" step="0.5" data-bulk="pct" value="' + B.pct + '"></div>' +
      '<div><label>Apply to</label><select data-bulk="scope"><option value="all">Whole menu</option>' + M.categories.map(function (c, i) { return '<option value="' + i + '"' + (String(B.scope) === String(i) ? ' selected' : '') + '>' + esc(c.name) + '</option>'; }).join('') + '</select></div>' +
      '<div><label>Round to</label><select data-bulk="round">' + [1, 5, 10, 50].map(function (r) { return '<option value="' + r + '"' + (+B.round === r ? ' selected' : '') + '>Nearest Rs ' + r + '</option>'; }).join('') + '</select></div>' +
      '<label class="chk fit"><input type="checkbox" data-bulk="buffets"' + (B.buffets ? ' checked' : '') + '> Include buffets</label><div class="fit"><button class="btn btn-gold btn-sm" data-act="bulk">Apply</button></div></div>' +
      '<p class="mute" style="margin:0">Use a negative number for a discount, e.g. −10. Review the prices below, then press “Save changes”.</p></div>';
    h += '<div class="ed"><h3 style="margin-top:0">Buffets (price per person)</h3>' + M.buffets.map(function (b, i) { return '<div class="row"><div style="flex:2 1 200px"><label>' + esc(b.name) + '</label><div class="g mute">' + esc(b.days) + '</div></div><div><label>Rs per person</label><input type="number" min="0" data-m="buf" data-bi="' + i + '" data-f="pricePerPerson" value="' + b.pricePerPerson + '"></div></div>'; }).join('') + '</div>';
    var q = S.q.trim().toLowerCase();
    h += '<div class="row"><div><label>Search dishes</label><input data-f="q2" value="' + esc(S.q) + '" placeholder="Type a dish name"></div></div><div class="tw"><table class="pt"><thead><tr><th>Dish</th><th>Price (Rs)</th><th>Sold out</th></tr></thead><tbody>';
    M.categories.forEach(function (c, ci) {
      var rows = '';
      c.groups.forEach(function (g, gi) { g.items.forEach(function (it, ii) {
        if (q && it.name.toLowerCase().indexOf(q) < 0) return;
        var at = ' data-m="item" data-ci="' + ci + '" data-gi="' + gi + '" data-ii="' + ii + '"';
        var pr = it.variants && it.variants.length > 1 ? it.variants.map(function (v, vi) { return '<span class="g">' + esc(v.label) + '</span> <input' + at + ' data-vi="' + vi + '" data-f="vprice" type="number" min="0" value="' + v.price + '" aria-label="' + esc(it.name + ' ' + v.label) + ' price">'; }).join(' ') : '<input' + at + ' data-f="price" type="number" min="0" value="' + (it.price || 0) + '" aria-label="' + esc(it.name) + ' price">';
        rows += '<tr><td>' + esc(it.name) + ' <span class="g">· ' + esc(g.name) + '</span></td><td>' + pr + '</td><td><input type="checkbox"' + at + ' data-f="soldOut"' + (it.soldOut ? ' checked' : '') + ' aria-label="' + esc(it.name) + ' sold out"></td></tr>';
      }); });
      if (rows) h += '<tr><th colspan="3" style="color:var(--gold2)">' + esc(c.name) + '</th></tr>' + rows;
    });
    return h + '</tbody></table></div>';
  };

  /* celebrations */
  V.cel = function () {
    var P = S.docs.cel, h = '<h2>Celebrations</h2><p class="mute">Themes shown on the home page. Leave “Minimum guests” empty to hide it. Photo: type the path of a file in the website’s <code>assets/parties</code> folder (e.g. <code>assets/parties/my-photo.jpg</code>) or a full web address.</p>';
    ['birthday', 'engagement'].forEach(function (k) {
      h += '<h3>' + esc(P[k].title) + '</h3>';
      P[k].themes.forEach(function (t, i) {
        var at = ' data-m="th" data-k="' + k + '" data-ti="' + i + '"';
        h += '<div class="ed"><div class="row"><div><label>Theme name</label><input' + at + ' data-f="name" value="' + esc(t.name) + '"></div><div><label>Tagline</label><input' + at + ' data-f="tagline" value="' + esc(t.tagline || '') + '"></div><div style="flex:0 1 150px"><label>Minimum guests</label><input type="number" min="0"' + at + ' data-f="min" value="' + (t.min == null ? '' : t.min) + '"></div></div>' +
          '<div class="row"><div style="flex:3 1 260px"><label>Description (optional)</label><textarea' + at + ' data-f="desc">' + esc(t.desc || '') + '</textarea></div></div>' +
          '<div class="row"><div><label>Includes (comma separated)</label><input' + at + ' data-f="features" value="' + esc((t.features || []).join(', ')) + '"></div><div><label>Photo path</label><input' + at + ' data-f="img" value="' + esc(t.img || '') + '"></div>' +
          '<div class="fit"><button class="btn btn-ghost btn-sm" data-act="delth" data-k="' + k + '" data-ti="' + i + '">Delete theme</button></div></div></div>';
      });
      h += '<p><button class="btn btn-gold btn-sm" data-act="addth" data-k="' + k + '">+ Add theme</button></p>';
    });
    return h;
  };

  /* settings */
  function timeOpts(sel) { var o = '', has = false; for (var m = 0; m <= 1440; m += 30) { if (m === +sel) has = true; o += '<option value="' + m + '"' + (m === +sel ? ' selected' : '') + '>' + U.clock(m) + (m === 1440 ? ' (midnight)' : '') + '</option>'; } if (!has) o += '<option value="' + sel + '" selected>' + U.clock(sel) + '</option>'; return o; }
  V.set = function () {
    var T = S.docs.set, f = function (k, label, type, extra) { return '<div><label>' + label + '</label><input data-m="set" data-f="' + k + '" type="' + (type || 'text') + '" ' + (extra || '') + ' value="' + esc(T[k]) + '"></div>'; };
    var hr = function (w, label) { return '<div class="row"><div><label>' + label + ' — opens</label><select data-m="hrs" data-w="' + w + '" data-f="open">' + timeOpts(T.hours[w].open) + '</select></div><div><label>closes</label><select data-m="hrs" data-w="' + w + '" data-f="close">' + timeOpts(T.hours[w].close) + '</select></div></div>'; };
    return '<h2>Restaurant settings</h2><div class="ed"><h3 style="margin-top:0">Contact</h3><div class="row">' + f('phone', 'Phone') + f('email', 'Email', 'email') + '</div><div class="row">' + f('address', 'Address') + '</div></div>' +
      '<div class="ed"><h3 style="margin-top:0">Opening hours</h3>' + hr('week', T.hours.week.label) + hr('wknd', T.hours.wknd.label) + '<p class="mute" style="margin:0">Booking and pickup time slots follow these hours (the last slot is 30 minutes before closing).</p></div>' +
      '<div class="ed"><h3 style="margin-top:0">Charges and limits</h3><div class="row">' + f('gstPercent', 'GST (%)', 'number', 'min="0" max="40" step="0.5"') + f('deliveryFee', 'Delivery fee (Rs)', 'number', 'min="0"') + f('vvipCharge', 'VVIP hall extra charge (Rs)', 'number', 'min="0"') + f('maxDeliveryMinutes', 'Maximum delivery time (minutes)', 'number', 'min="15" max="180"') + '</div></div>';
  };

  /* excel */
  V.export = function () {
    return '<h2>Excel export</h2><p class="mute">Downloads one Excel file with three sheets: Orders, Order Items and Reservations, including each record’s current status. ' + S.orders.length + ' orders and ' + S.res.length + ' reservations are loaded.</p><p><button class="btn btn-gold" data-act="xlsx">⬇ Download Excel (.xlsx)</button> <button class="btn btn-ghost" data-act="refresh">Refresh data first</button></p>';
  };
  function orderRow(o) {
    var d = o.details || {}, e = o.eta || {}, t = o.totals || {};
    return { 'Order ID': o.id, 'Placed at': stamp(o._placed), 'Status': LBL[o._status] || o._status, 'Order type': TYPE[o.type] || o.type, 'Customer name': d.name || '', 'Phone': d.phone || '', 'Delivery address': o.type === 'delivery' ? (d.address || '') : '',
      'Pickup option': o.type === 'pickup' ? (d.time === 'asap' ? 'As soon as possible' : 'Scheduled ' + fmtTime(d.time)) : 'Delivery', 'Estimated time shown': e.value ? e.title + ' ' + e.value : (e.title || ''),
      'Items': (o.lines || []).map(function (l) { return l.qty + ' x ' + l.name; }).join('; '), 'Item count': (o.lines || []).reduce(function (a, l) { return a + l.qty; }, 0),
      'Subtotal (Rs)': t.sub || 0, 'GST (Rs)': t.gst || 0, 'Delivery fee (Rs)': t.del || 0, 'Total (Rs)': t.total || 0, 'Customer notes': d.notes || '' };
  }
  function resRow(r) {
    var ages = (r.kids || []).map(function (a) { return String(a) === '0' ? 'under 1' : a; });
    return { 'Reservation ID': r.id, 'Placed at': stamp(r._placed), 'Status': LBL[r._status] || r._status, 'Guest name': r.name || '', 'Phone': r.phone || '', 'Booking date': r.date, 'Booking time': fmtTime(r.time),
      'Adults': r.adults, 'Kids': (r.kids || []).length, 'Kids ages': ages.join(', '), 'Total guests': r.guests || (r.adults + (r.kids || []).length), 'Cuisine': CUISINE[r.cuisine] || r.cuisine, 'Seating': SEAT[r.seating] || r.seating, 'VVIP extra charge (Rs)': r.seating === 'vvip' ? S.docs.set.vvipCharge : 0 };
  }
  function sheet(rows, headers, w) { var ws = rows.length ? XLSX.utils.json_to_sheet(rows) : XLSX.utils.aoa_to_sheet([headers]); ws['!cols'] = w.map(function (x) { return { wch: x }; }); return ws; }
  function exportXlsx() {
    var wb = XLSX.utils.book_new(), items = [];
    S.orders.forEach(function (o) { (o.lines || []).forEach(function (l) { items.push({ 'Order ID': o.id, 'Placed at': stamp(o._placed), 'Customer name': (o.details || {}).name || '', 'Item': l.name, 'Quantity': l.qty, 'Unit price (Rs)': l.price, 'Line total (Rs)': l.total }); }); });
    var oh = Object.keys(orderRow({ id: '' })), rh = Object.keys(resRow({ id: '', adults: 0 }));
    XLSX.utils.book_append_sheet(wb, sheet(S.orders.map(orderRow), oh, [18, 18, 12, 18, 20, 15, 34, 20, 26, 60, 10, 13, 12, 14, 12, 30]), 'Orders');
    XLSX.utils.book_append_sheet(wb, sheet(items, ['Order ID', 'Placed at', 'Customer name', 'Item', 'Quantity', 'Unit price (Rs)', 'Line total (Rs)'], [18, 18, 20, 38, 9, 14, 14]), 'Order Items');
    XLSX.utils.book_append_sheet(wb, sheet(S.res.map(resRow), rh, [18, 18, 12, 20, 15, 14, 12, 8, 6, 12, 12, 16, 14, 20]), 'Reservations');
    var d = new Date(); XLSX.writeFile(wb, 'Riwayat-Orders-' + d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate()) + '.xlsx');
  }

  /* ---------- events ---------- */
  function itemAt(el) { var M = S.docs.menu; return M.categories[+el.getAttribute('data-ci')].groups[+el.getAttribute('data-gi')].items[+el.getAttribute('data-ii')]; }
  function numv(v) { var n = parseFloat(v); return isNaN(n) || n < 0 ? 0 : Math.round(n * 100) / 100; }
  function onEdit(e) {
    var el = e.target, m = el.getAttribute('data-m'), f = el.getAttribute('data-f'), v = el.type === 'checkbox' ? el.checked : el.value;
    if (el.getAttribute('data-bulk')) { var bk = el.getAttribute('data-bulk'); S.bulk[bk] = el.type === 'checkbox' ? el.checked : (bk === 'pct' || bk === 'round' ? parseFloat(v) || 0 : v); return; }
    if (el.getAttribute('data-filter')) { S[el.getAttribute('data-filter')] = v; draw(); return; }
    if (el.getAttribute('data-status')) return statusChange(el);
    if (f === 'cat') { S.cat = +v; S.q = ''; draw(); return; }
    if (f === 'q' || f === 'q2') { if (e.type === 'change') return; S.q = v; var pos = el.selectionStart; draw(); var n = document.querySelector('[data-f="' + f + '"]'); if (n) { n.focus(); try { n.setSelectionRange(pos, pos); } catch (x) { /* ignore */ } } return; }
    if (!m) return;
    var M = S.docs.menu;
    if (m === 'item') {
      var it = itemAt(el);
      if (f === 'price') { it.price = numv(v); if (it.variants && it.variants.length === 1) it.variants[0].price = it.price; }
      else if (f === 'vprice') { var vi = +el.getAttribute('data-vi'); it.variants[vi].price = numv(v); it.price = it.variants[0].price; }
      else if (f === 'vlabel') it.variants[+el.getAttribute('data-vi')].label = v;
      else if (f === 'preorder' || f === 'soldOut') { if (v) it[f] = true; else delete it[f]; }
      else it[f] = v;
      mark('menu');
    } else if (m === 'cat') { M.categories[+el.getAttribute('data-ci')][f] = v; mark('menu'); }
    else if (m === 'group') { M.categories[+el.getAttribute('data-ci')].groups[+el.getAttribute('data-gi')][f] = v; mark('menu'); }
    else if (m === 'buf') { M.buffets[+el.getAttribute('data-bi')][f] = numv(v); mark('menu'); }
    else if (m === 'th') {
      var t = S.docs.cel[el.getAttribute('data-k')].themes[+el.getAttribute('data-ti')];
      if (f === 'min') t.min = v === '' ? null : Math.max(0, parseInt(v, 10) || 0);
      else if (f === 'features') t.features = v.split(',').map(function (x) { return x.trim(); }).filter(Boolean);
      else if (f === 'desc') { if (v.trim()) t.desc = v; else delete t.desc; }
      else t[f] = v;
      mark('cel');
    } else if (m === 'set') {
      var T = S.docs.set, num = ['gstPercent', 'deliveryFee', 'vvipCharge', 'maxDeliveryMinutes'].indexOf(f) >= 0; T[f] = num ? numv(v) : v; mark('set');
    } else if (m === 'hrs') { S.docs.set.hours[el.getAttribute('data-w')][f] = +v; mark('set'); }
  }
  document.addEventListener('input', function (e) { if (e.target.closest('#view') && e.target.tagName !== 'SELECT' && e.target.type !== 'checkbox') onEdit(e); });
  document.addEventListener('change', function (e) { if (e.target.closest('#view') && (e.target.tagName === 'SELECT' || e.target.type === 'checkbox')) onEdit(e); });

  function statusChange(el) {
    var kind = el.getAttribute('data-status'), id = el.getAttribute('data-doc'), val = el.value, list = kind === 'order' ? S.orders : S.res;
    el.disabled = true;
    FS.update((kind === 'order' ? 'orders/' : 'reservations/') + id, { status: val }).then(function () {
      list.forEach(function (o) { if (o._doc === id) o._status = val; }); toast('Status updated to ' + LBL[val]); drawTabs(); var y = window.scrollY; draw(); window.scrollTo(0, y);
    }, function (e) { toast(errMsg(e), true); draw(); });
  }
  function roundTo(n, step) { return Math.round(n / step) * step; }
  function bulkApply() {
    var B = S.bulk, f = 1 + (+B.pct || 0) / 100, step = +B.round || 1, M = S.docs.menu, n = 0;
    if (!B.pct) { toast('Enter a percentage first.', true); return; }
    if (f <= 0) { toast('That would make prices zero or negative.', true); return; }
    if (!confirm('Change ' + (B.scope === 'all' ? 'ALL menu' : '“' + M.categories[+B.scope].name + '”') + ' prices by ' + B.pct + '%?')) return;
    M.categories.forEach(function (c, ci) { if (B.scope !== 'all' && +B.scope !== ci) return; c.groups.forEach(function (g) { g.items.forEach(function (it) {
      if (it.variants && it.variants.length) { it.variants.forEach(function (v) { v.price = Math.max(step, roundTo(v.price * f, step)); }); it.price = it.variants[0].price; } else it.price = Math.max(step, roundTo(it.price * f, step));
      n++;
    }); }); });
    if (B.buffets && B.scope === 'all') M.buffets.forEach(function (b) { b.pricePerPerson = Math.max(step, roundTo(b.pricePerPerson * f, step)); });
    mark('menu'); draw(); toast(n + ' dishes updated. Press “Save changes” to publish.');
  }
  document.addEventListener('click', function (e) {
    var el = e.target.closest('[data-act],[data-del]'); if (!el || !el.closest('#app')) return;
    var a = el.getAttribute('data-act'), M = S.docs.menu, P = S.docs.cel, ci = +el.getAttribute('data-ci'), gi = +el.getAttribute('data-gi');
    if (el.getAttribute('data-del')) {
      if (!confirm('Delete this record permanently? Download the Excel first if you need a copy.')) return;
      var coll = el.getAttribute('data-del'), id = el.getAttribute('data-doc');
      FS.remove(coll + '/' + id).then(function () { var arr = coll === 'orders' ? S.orders : S.res; arr.splice(arr.findIndex(function (o) { return o._doc === id; }), 1); drawTabs(); draw(); toast('Deleted'); }, function (er) { toast(errMsg(er), true); });
      return;
    }
    switch (a) {
      case 'dash': S.dash = el.getAttribute('data-v'); draw(); break;
      case 'addstaff': var em = ($('#stEmail').value || '').trim().toLowerCase(), cur = S.staff || [];
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(em)) { toast('Enter a valid email address.', true); break; }
        if (em === String(FS.adminEmail).toLowerCase()) { toast('That is the administrator account already.', true); break; }
        if (cur.indexOf(em) >= 0) { toast('Already in the list.', true); break; }
        saveStaff(cur.concat([em]), 'Added. They can sign in once their login exists in Firebase.'); break;
      case 'rmstaff': var ri = +el.getAttribute('data-i'); if (confirm('Remove access for ' + S.staff[ri] + '?')) saveStaff(S.staff.filter(function (x, j) { return j !== ri; }), 'Access removed.'); break;
      case 'print': printSlip(el.getAttribute('data-kind'), el.getAttribute('data-doc')); break;
      case 'refresh': refresh(false); break;
      case 'xlsx': exportXlsx(); break;
      case 'bulk': bulkApply(); break;
      case 'additem': var g = M.categories[ci].groups[gi]; g.items.push({ id: slug(M.categories[ci].id + '-new-dish') + '-' + Date.now().toString(36), name: 'New dish', desc: '', price: 0 }); mark('menu'); S.q = ''; draw(); break;
      case 'delitem': var it = itemAt(el); if (confirm('Delete “' + it.name + '” from the menu?')) { M.categories[ci].groups[gi].items.splice(+el.getAttribute('data-ii'), 1); mark('menu'); draw(); } break;
      case 'addsize': var t = itemAt(el); if (!t.variants || t.variants.length < 2) t.variants = [{ label: 'Single', price: t.price || 0 }]; t.variants.push({ label: 'New size', price: t.variants[t.variants.length - 1].price }); t.price = t.variants[0].price; mark('menu'); draw(); break;
      case 'delsize': var t2 = itemAt(el); t2.variants.pop(); if (t2.variants.length === 1) { t2.price = t2.variants[0].price; delete t2.variants; } mark('menu'); draw(); break;
      case 'addgroup': M.categories[ci].groups.push({ name: 'New group', items: [] }); mark('menu'); draw(); break;
      case 'delgroup': if (confirm('Delete this whole group and its dishes?')) { M.categories[ci].groups.splice(gi, 1); mark('menu'); draw(); } break;
      case 'addcat': var nm = prompt('Name of the new category:'); if (nm && nm.trim()) { M.categories.push({ id: slug(nm) + '-' + Date.now().toString(36).slice(-3), name: nm.trim(), urdu: '', subtitle: '', groups: [{ name: 'Dishes', items: [] }] }); S.cat = M.categories.length - 1; mark('menu'); draw(); } break;
      case 'delcat': if (M.categories.length > 1 && confirm('Delete the whole category “' + M.categories[ci].name + '” with all its dishes?')) { M.categories.splice(ci, 1); S.cat = 0; mark('menu'); draw(); } break;
      case 'addth': var k = el.getAttribute('data-k'); P[k].themes.push({ id: 'theme-' + Date.now().toString(36), name: 'New theme', tagline: '', features: [], min: null, img: '' }); mark('cel'); draw(); break;
      case 'delth': var k2 = el.getAttribute('data-k'), ti = +el.getAttribute('data-ti'); if (confirm('Delete the theme “' + P[k2].themes[ti].name + '”?')) { P[k2].themes.splice(ti, 1); mark('cel'); draw(); } break;
    }
  });

  /* chart tooltip: shows on hover and on keyboard focus */
  var tip = document.createElement('div'); tip.className = 'tip'; tip.hidden = true; tip.innerHTML = '<b></b><span></span>'; document.body.appendChild(tip);
  function showTip(el, x, y) {
    tip.firstChild.textContent = el.getAttribute('data-tipv'); tip.lastChild.textContent = el.getAttribute('data-tipl'); tip.hidden = false;
    var w = tip.offsetWidth, h = tip.offsetHeight, nx = Math.min(Math.max(8, x - w / 2), window.innerWidth - w - 8), ny = y - h - 12; if (ny < 8) ny = y + 18; tip.style.left = nx + 'px'; tip.style.top = ny + 'px';
  }
  document.addEventListener('pointermove', function (e) { var el = e.target.closest && e.target.closest('[data-tipv]'); if (el && el.closest('#view')) showTip(el, e.clientX, e.clientY); else tip.hidden = true; });
  document.addEventListener('focusin', function (e) { var el = e.target.closest && e.target.closest('[data-tipv]'); if (el) { var r = el.getBoundingClientRect(); showTip(el, r.left + r.width / 2, r.top); } });
  document.addEventListener('focusout', function () { tip.hidden = true; });
  document.addEventListener('scroll', function () { tip.hidden = true; }, true);

  /* ---------- go ---------- */
  var a = FS.loadAuth();
  if (a && a.email) start(); else showLogin();
})();
