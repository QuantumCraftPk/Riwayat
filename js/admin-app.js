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
    docs: { menu: null, cel: null, set: null }, dirty: { menu: false, cel: false, set: false }, bulk: { pct: 5, scope: 'all', round: 10, buffets: true } };
  var timer = null;

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
      if (a.email.toLowerCase() !== String(FS.adminEmail).toLowerCase()) { FS.signOut(); throw new Error('NOT_ADMIN'); }
      $('#lPass').value = ''; start();
    }).catch(function (e) { showLogin(e.message === 'NOT_ADMIN' ? 'This account is not the administrator.' : friendly(e)); }).then(function () { b.disabled = false; b.textContent = 'Sign in'; });
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
    });
  }
  function loadRecords() {
    return Promise.all([FS.list('orders', 'placedAt', 500), FS.list('reservations', 'placedAt', 500)]).then(function (r) {
      var f = function (kind) { return function (d) { var rec = parse(d.json) || {}; rec._doc = d._id; rec._status = d.status || 'new'; rec._placed = d.placedAt || rec.placedAt; return rec; }; };
      S.orders = r[0].map(f('order')); S.res = r[1].map(f('reservation'));
    });
  }
  function start() {
    var a = FS.session(); $('#login').hidden = true; $('#app').hidden = false; $('#btnOut').hidden = false; $('#who').textContent = a.email;
    $('#view').innerHTML = '<p class="mute">Loading…</p>';
    Promise.all([loadSite(), loadRecords()]).then(function () {
      S.loaded = true; drawTabs(); draw();
      clearInterval(timer); timer = setInterval(function () { if (S.tab === 'orders' || S.tab === 'res') refresh(true); }, 20000);
    }).catch(function (e) {
      if (e && e.status === 401) { FS.signOut(); showLogin('Your session expired. Please sign in again.'); return; }
      $('#view').innerHTML = '<div class="adm-err">' + esc(errMsg(e)) + '</div><p><button class="btn btn-ghost" id="retry">Try again</button></p>';
      $('#retry').onclick = start;
    });
  }
  function refresh(quiet) {
    return loadRecords().then(function () { drawTabs(); if (S.tab === 'orders' || S.tab === 'res') { var y = window.scrollY; draw(); window.scrollTo(0, y); } if (!quiet) toast('Updated'); }, function (e) { if (!quiet) toast(errMsg(e), true); });
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
  var TABS = [['orders', 'Orders'], ['res', 'Reservations'], ['menu', 'Menu'], ['prices', 'Prices & Sold out'], ['cel', 'Celebrations'], ['set', 'Settings'], ['export', 'Excel']];
  function drawTabs() {
    var n1 = S.orders.filter(function (o) { return o._status === 'new'; }).length, n2 = S.res.filter(function (o) { return o._status === 'new'; }).length;
    $('#tabs').innerHTML = TABS.map(function (t) {
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
          '<div class="row" style="margin:8px 0 0"><button class="btn btn-ghost btn-sm fit" data-del="orders" data-doc="' + esc(o._doc) + '">Delete</button></div></div>';
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
          '<div class="row" style="margin:8px 0 0"><button class="btn btn-ghost btn-sm fit" data-del="reservations" data-doc="' + esc(r._doc) + '">Delete</button></div></div>';
      }).join('') || '<p class="mute">No reservations to show.</p>');
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

  /* ---------- go ---------- */
  var a = FS.loadAuth();
  if (a && a.email) start(); else showLogin();
})();
