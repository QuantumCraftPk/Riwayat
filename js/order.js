/* Riwayat — simulated ordering flow (no backend, no real payment) */
(function () {
  'use strict';
  var M = window.RIWAYAT_MENU;
  var GST_RATE = 0.16, DELIVERY_FEE = 200;
  var STATE_KEY = 'riwayat_order_state', ORDERS_KEY = 'riwayat_orders';
  var STEP_LABEL = { type: 'Order Type', dine: 'Reservation', menu: 'Menu', bill: 'Bill', details: 'Details', confirm: 'Confirm' };

  /* ---------- helpers ---------- */
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var money = function (n) { return 'Rs ' + Math.round(n).toLocaleString('en-US'); };
  var pad = function (n) { return (n < 10 ? '0' : '') + n; };
  function ymd(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function parseYmd(s) { var p = s.split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); }
  function fmtDate(s) { return parseYmd(s).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }); }
  function fmtTime(min) { var h = Math.floor(min / 60), m = min % 60, ap = h >= 12 ? 'pm' : 'am'; return ((h + 11) % 12 + 1) + ':' + pad(m) + ' ' + ap; }
  function store(get, key, val) {
    try { if (get) return JSON.parse(sessionStorage.getItem(key)); sessionStorage.setItem(key, JSON.stringify(val)); } catch (e) { return null; }
  }

  /* ---------- item index ---------- */
  var ITEMS = {};
  M.categories.forEach(function (c) { c.groups.forEach(function (g) { g.items.forEach(function (it) {
    if (it.variants && it.variants.length > 1) it.variants.forEach(function (v) {
      ITEMS[it.id + '|' + v.label] = { key: it.id + '|' + v.label, name: it.name + ' (' + v.label + ')', price: v.price, kind: 'item', preorder: !!it.preorder };
    });
    else ITEMS[it.id] = { key: it.id, name: it.name, price: it.price, kind: 'item', preorder: !!it.preorder };
  }); }); });

  /* ---------- state ---------- */
  var S = store(true, STATE_KEY) || {};
  S.cart = S.cart || {}; S.dine = S.dine || { date: '', time: '', adults: 2, kids: [], cuisine: '', seating: '' };
  S.details = S.details || { name: '', phone: '', address: '', time: 'asap', notes: '' };
  if (S.dine.adults == null) S.dine.adults = 2;
  if (!Array.isArray(S.dine.kids)) S.dine.kids = [];
  S.step = S.step || 'type'; S.type = S.type || null; S.takeaway = !!S.takeaway; S.tab = S.tab || M.categories[0].id;
  S.done = null;
  function save() { store(false, STATE_KEY, { cart: S.cart, dine: S.dine, details: S.details, step: S.step, type: S.type, takeaway: S.takeaway, tab: S.tab }); }

  function steps() {
    if (!S.type) return ['type'];
    return S.type === 'dine' ? ['type', 'dine'] : ['type', 'menu', 'bill', 'details', 'confirm'];
  }
  function lines() {
    return Object.keys(S.cart).filter(function (k) { return ITEMS[k] && S.cart[k] > 0; }).map(function (k) {
      var i = ITEMS[k]; return { key: k, name: i.name, price: i.price, kind: i.kind, days: i.days, preorder: i.preorder, qty: S.cart[k], total: i.price * S.cart[k] };
    });
  }
  function totals() {
    var sub = lines().reduce(function (a, l) { return a + l.total; }, 0);
    var gst = Math.round(sub * GST_RATE);
    var del = (S.type === 'delivery' && sub > 0) ? DELIVERY_FEE : 0;
    return { sub: sub, gst: gst, del: del, total: sub + gst + del };
  }
  /* ---------- time estimate (never more than 60 minutes) ---------- */
  var MAX_WAIT = 60;
  function clock(d) { return fmtTime(d.getHours() * 60 + d.getMinutes()); }
  function etaFor(o, placed) {
    var n = o.lines.reduce(function (a, l) { return a + l.qty; }, 0);
    var pre = o.lines.some(function (l) { return l.preorder; });
    var add = function (m) { return new Date(placed.getTime() + m * 60000); };
    if (pre) return { kind: 'preorder', title: 'We will confirm your time', text: 'Your order contains a pre-order item (24 hours notice). Our team will call you to confirm the exact time.' };
    if (o.type === 'delivery') {
      var lo = Math.min(MAX_WAIT - 10, 40 + n);
      return { kind: 'delivery', title: 'Estimated delivery', value: 'By ' + clock(add(MAX_WAIT)), text: 'About ' + lo + '–' + MAX_WAIT + ' minutes from now (' + clock(add(lo)) + ' to ' + clock(add(MAX_WAIT)) + '). Delivery never takes longer than ' + MAX_WAIT + ' minutes.', minMinutes: lo, maxMinutes: MAX_WAIT };
    }
    if (o.details.time && o.details.time !== 'asap') {
      return { kind: 'scheduled', title: 'Pickup time', value: fmtTime(+o.details.time), text: 'Your order will be ready at your chosen time.', minMinutes: null, maxMinutes: null };
    }
    var m = Math.min(45, 20 + 2 * n);
    return { kind: 'pickup', title: 'Ready for pickup at', value: clock(add(m)), text: 'About ' + m + ' minutes from now. Your order will be ready within ' + MAX_WAIT + ' minutes at the latest.', minMinutes: m, maxMinutes: MAX_WAIT };
  }
  function count() { return lines().reduce(function (a, l) { return a + l.qty; }, 0); }
  var TYPE_NAME = { dine: 'Dine In', pickup: 'Takeaway · Pickup', delivery: 'Takeaway · Delivery' };

  /* ---------- time slots ---------- */
  function slots(dateStr, mode) {
    // Hours: Mon-Fri 12:00 pm - 11:00 pm; Sat & Sun 8:00 am - 12:00 am (last slot 30 min before closing)
    var out = [], now = new Date(), isToday = dateStr === ymd(now), nowMin = now.getHours() * 60 + now.getMinutes() + 30;
    var wd = dateStr ? parseYmd(dateStr).getDay() : now.getDay(), weekend = wd === 0 || wd === 6;
    var first = weekend ? 8 * 60 : 12 * 60, last = weekend ? 23 * 60 + 30 : 22 * 60 + 30;
    for (var m = first; m <= last; m += 30) if (!isToday || m >= nowMin) out.push(m);
    return out;
  }
  function slotOptions(list, sel) {
    return list.map(function (m) { return '<option value="' + m + '"' + (String(sel) === String(m) ? ' selected' : '') + '>' + fmtTime(m) + '</option>'; }).join('');
  }

  /* ---------- cart ops ---------- */
  function setQty(key, q) {
    var max = 99;
    q = Math.max(0, Math.min(max, q));
    if (q) S.cart[key] = q; else delete S.cart[key];
    save(); refreshCtl(key); renderCart();
    if (S.step === 'bill') renderStage();
  }
  function addKey(key) {
    setQty(key, 1);
  }
  function stepperHtml(key, q) {
    return '<span class="stepper"><button data-act="dec" data-key="' + esc(key) + '" aria-label="Remove one">−</button><b aria-live="polite">' + q + '</b><button data-act="inc" data-key="' + esc(key) + '" aria-label="Add one">+</button></span>';
  }
  function ctlHtml(key) {
    var q = S.cart[key] | 0;
    return '<span class="ctl" data-ctl="' + esc(key) + '">' + (q ? stepperHtml(key, q) : '<button class="btn btn-gold btn-sm" data-act="add" data-key="' + esc(key) + '">Add</button>') + '</span>';
  }
  function refreshCtl(key) {
    Array.prototype.forEach.call(document.querySelectorAll('[data-ctl]'), function (el) {
      if (el.getAttribute('data-ctl') === key) el.outerHTML = ctlHtml(key);
    });
  }

  /* ---------- progress + cart panel ---------- */
  function renderProgress() {
    var st = steps(), idx = st.indexOf(S.step);
    $('#progress').innerHTML = S.done ? '' : st.map(function (s, i) {
      return '<li class="' + (i < idx ? 'done' : i === idx ? 'cur' : '') + '"' + (i < idx ? ' data-act="goto" data-step="' + s + '" tabindex="0" role="button"' : '') + '><b>' + (i + 1) + '</b>' + STEP_LABEL[s] + '</li>';
    }).join('');
  }
  function renderCart() {
    var L = lines(), t = totals(), body = $('#cartBody');
    body.innerHTML = !L.length ? '<p class="cart-empty">Your order is empty. Add dishes from the menu.</p>' :
      L.map(function (l) {
        return '<div class="cart-line"><div class="nm">' + esc(l.name) + '</div><div class="lt">' + money(l.total) + '</div><div class="unit">' + money(l.price) + ' each</div><div style="text-align:right">' + stepperHtml(l.key, l.qty) + '</div></div>';
      }).join('') + '<div class="cart-sum"><span>Subtotal</span><span>' + money(t.sub) + '</span></div><p class="cart-note">GST and any delivery fee are added at the bill review.</p><button class="btn btn-gold" data-act="next">Review Bill →</button>';
    var n = count(), bar = $('#cartbar');
    $('#cbCount').textContent = n + (n === 1 ? ' item' : ' items');
    $('#cbTotal').textContent = money(t.sub);
    bar.hidden = !(S.step === 'menu' && n > 0);
  }

  /* ---------- steps ---------- */
  function head(title, lead) { return '<h2 id="stepTitle" tabindex="-1">' + title + '</h2>' + (lead ? '<p class="lead">' + lead + '</p>' : ''); }
  function nav(back, nextLabel, nextAct) {
    return '<div class="actions">' + (back ? '<button class="btn btn-ghost" data-act="back">← Back</button>' : '') + (nextLabel ? '<button class="btn btn-gold" data-act="' + (nextAct || 'next') + '">' + nextLabel + '</button>' : '') + '</div>';
  }
  function field(id, label, input, err) { return '<div class="fld" id="f-' + id + '"><label for="' + id + '">' + label + '</label>' + input + '<div class="err" id="e-' + id + '" role="alert">' + (err || '') + '</div></div>'; }

  var views = {};

  views.type = function () {
    var sub = S.takeaway ? '<div class="sub-choice"><h3>Pickup or Delivery?</h3><div class="choices">' +
      '<button class="choice' + (S.type === 'pickup' ? ' sel' : '') + '" data-act="type" data-v="pickup"><span class="ic">🛍️</span><strong>Pickup</strong><span class="d">Collect from the restaurant</span></button>' +
      '<button class="choice' + (S.type === 'delivery' ? ' sel' : '') + '" data-act="type" data-v="delivery"><span class="ic">🛵</span><strong>Delivery</strong><span class="d">To your address · ' + money(DELIVERY_FEE) + ' fee</span></button></div></div>' : '';
    return head('How would you like to enjoy Riwayat?', 'Choose your order type to begin.') +
      '<div class="choices"><button class="choice' + (S.type === 'dine' ? ' sel' : '') + '" data-act="type" data-v="dine"><span class="ic">🍽️</span><strong>Dine In</strong><span class="d">Reserve a table &amp; order ahead</span></button>' +
      '<button class="choice' + (S.takeaway ? ' sel' : '') + '" data-act="takeaway"><span class="ic">🥡</span><strong>Takeaway</strong><span class="d">Pickup or delivery</span></button></div>' + sub;
  };

  var CUISINES = [['desi', 'Desi'], ['arabic', 'Arabic'], ['continental', 'Continental'], ['chinese', 'Chinese'], ['buffet', 'Buffet'], ['mix', 'Mix'], ['undecided', 'Not decided yet']];
  var SEATING = [
    ['vvip', 'VVIP Hall', 'Private, exclusive dining', 'grand-private-vvip', 'Rs 2,500 additional'],
    ['indoor', 'Indoor', 'Main dining hall', 'main-dining-hall'],
    ['terrace', 'Terrace', 'Open-air arched terrace', 'intimate-alcove'],
    ['lawn', 'Lawn', 'Courtyard lawn with fountains', 'courtyard-dining'],
    ['rooftop', 'Roof Top', 'City views and lantern light', 'rooftop-dining']
  ];
  function lookup(list, id) { return list.filter(function (x) { return x[0] === id; })[0]; }

  function guestCount(d) { return (+d.adults || 0) + d.kids.length; }
  function ageLabel(v) { return v === '0' || v === 0 ? 'under 1' : String(v); }
  function guestsText(d) {
    var t = d.adults + (d.adults === 1 ? ' adult' : ' adults');
    if (d.kids.length) t += ', ' + d.kids.length + (d.kids.length === 1 ? ' child' : ' children') + ' (age' + (d.kids.length === 1 ? ' ' : 's ') + d.kids.map(ageLabel).join(', ') + ')';
    return t;
  }
  function kidAgesHtml() {
    return S.dine.kids.map(function (a, i) {
      var o = '<option value="">Select age</option><option value="0"' + (String(a) === '0' ? ' selected' : '') + '>Under 1 year</option>';
      for (var y = 1; y <= 12; y++) o += '<option value="' + y + '"' + (String(a) === String(y) ? ' selected' : '') + '>' + y + (y === 1 ? ' year' : ' years') + '</option>';
      return '<div class="kidage"><label for="kidAge' + i + '">Child ' + (i + 1) + ' — age</label><select id="kidAge' + i + '" data-kid="' + i + '">' + o + '</select></div>';
    }).join('');
  }
  function guestTotalText() { var n = guestCount(S.dine); return 'Total: ' + n + (n === 1 ? ' guest' : ' guests'); }
  function refreshGuests() {
    $('#adultsN').textContent = S.dine.adults; $('#kidsN').textContent = S.dine.kids.length;
    $('#kidAges').innerHTML = kidAgesHtml(); $('#guestTotal').textContent = guestTotalText(); flag('dGuests', ''); save();
  }

  views.dine = function () {
    var d = S.dine, today = ymd(new Date()), max = new Date(); max.setDate(max.getDate() + 60);
    var sl = d.date ? slotOptions(slots(d.date, 'dine'), d.time) : '';
    var chips = CUISINES.map(function (c) {
      return '<label class="chip"><input type="radio" name="cuisine" value="' + c[0] + '"' + (d.cuisine === c[0] ? ' checked' : '') + '><span>' + c[1] + '</span></label>';
    }).join('');
    var seats = SEATING.map(function (x) {
      return '<label class="seat"><input type="radio" name="seating" value="' + x[0] + '"' + (d.seating === x[0] ? ' checked' : '') + '><span class="seat-box"><img src="assets/gallery/' + x[3] + '.jpg" alt=""><span class="seat-t"><b>' + x[1] + '</b><small>' + x[2] + '</small>' + (x[4] ? '<em>' + x[4] + '</em>' : '') + '</span></span></label>';
    }).join('');
    return head('Reserve Your Table', 'Tell us when you are coming and how you would like to dine.') +
      '<div class="formcard wide">' +
      '<div class="row2">' + field('dDate', 'Date', '<input type="date" id="dDate" min="' + today + '" max="' + ymd(max) + '" value="' + esc(d.date) + '">') +
      field('dTime', 'Time', '<select id="dTime"><option value="">' + (d.date ? 'Select a time' : 'Pick a date first') + '</option>' + sl + '</select>') + '</div>' +
      '<div class="fld" id="f-dGuests"><span class="lbl">Number of persons</span><div class="row2">' +
        '<div class="gcol"><span class="gl">Adults</span><span class="stepper"><button type="button" data-act="adec" aria-label="Fewer adults">−</button><b id="adultsN">' + d.adults + '</b><button type="button" data-act="ainc" aria-label="More adults">+</button></span></div>' +
        '<div class="gcol"><span class="gl">Kids <small>(up to 12 years)</small></span><span class="stepper"><button type="button" data-act="kdec" aria-label="Fewer kids">−</button><b id="kidsN">' + d.kids.length + '</b><button type="button" data-act="kinc" aria-label="More kids">+</button></span></div></div>' +
        '<div class="kidages" id="kidAges">' + kidAgesHtml() + '</div><p class="hint" id="guestTotal">' + guestTotalText() + '</p><div class="err" id="e-dGuests" role="alert"></div></div>' +
      '<div class="fld" id="f-dCuisine"><span class="lbl">Type of cuisine</span><div class="chips" role="radiogroup" aria-label="Type of cuisine">' + chips + '</div><div class="err" id="e-dCuisine" role="alert"></div></div>' +
      '<div class="fld" id="f-dSeat"><span class="lbl">Choice of seating</span><div class="seats" role="radiogroup" aria-label="Choice of seating">' + seats + '</div><div class="err" id="e-dSeat" role="alert"></div></div>' +
      '</div>' + '<div class="actions wide" style="max-width:760px"><button class="btn btn-ghost" data-act="back">← Back</button><button class="btn btn-gold" data-act="confirmres">Confirm Reservation</button></div>';
  };

  function ctxLine() {
    return '<div class="ctx-wrap"><span class="ctx">' + esc(TYPE_NAME[S.type] || '') + '</span> <button class="linkbtn" data-act="goto" data-step="type">Change</button></div>';
  }
  function itemCard(it) {
    var buy;
    if (it.variants && it.variants.length > 1) {
      buy = '<div class="vbox">' + it.variants.map(function (v) {
        var k = it.id + '|' + v.label;
        return '<div class="vrow"><span><span class="vl">' + esc(v.label) + '</span> <span class="pr">' + money(v.price) + '</span></span>' + ctlHtml(k) + '</div>';
      }).join('') + '</div>';
    } else buy = '<div class="buy"><span class="pr">' + money(it.price) + '</span>' + ctlHtml(it.id) + '</div>';
    return '<article class="item o-item"><div><h5>' + esc(it.name) + (it.preorder ? '<span class="tag">Pre-order 24h</span>' : '') + '</h5>' + (it.desc ? '<p>' + esc(it.desc) + '</p>' : '') + '</div>' + buy + '</article>';
  }
  function menuBody() {
    var c = M.categories.filter(function (x) { return x.id === S.tab; })[0] || M.categories[0];
    return '<div class="cat-head"><p class="eyebrow" lang="ur" dir="rtl">' + esc(c.urdu) + '</p><h3>' + esc(c.name) + '</h3><p class="sub">' + esc(c.subtitle) + '</p></div>' +
      c.groups.map(function (g) { return '<div class="group"><h4>' + esc(g.name) + '</h4>' + (g.note ? '<p class="note">' + esc(g.note) + '</p>' : '') + '<div class="items">' + g.items.map(itemCard).join('') + '</div></div>'; }).join('');
  }
  views.menu = function () {
    var tabs = M.categories.map(function (c) { return { id: c.id, label: c.name }; });
    if (!tabs.some(function (t) { return t.id === S.tab; })) S.tab = tabs[0].id;
    return head('Choose Your Dishes', 'Add items to build your order — your cart updates as you go.') + ctxLine() +
      '<div class="tabs-wrap"><div class="tabs" role="tablist">' + tabs.map(function (t) { return '<button class="tab" role="tab" data-act="tab" data-id="' + t.id + '" aria-selected="' + (t.id === S.tab) + '">' + esc(t.label) + '</button>'; }).join('') + '</div></div>' +
      '<div class="menu-view" id="menuBody">' + menuBody() + '</div>' +
      '<div class="actions wide"><button class="btn btn-ghost" data-act="back">← Back</button><button class="btn btn-gold" data-act="next">Review Bill →</button></div>';
  };

  function billProblems() {
    var p = [];
    if (!lines().length) p.push('Your order is empty. Add at least one dish.');
    return p;
  }
  views.bill = function () {
    var L = lines(), t = totals(), probs = billProblems(), notes = '';
    var rows = L.map(function (l) {
      return '<tr><td>' + esc(l.name) + '<br><button class="rm" data-act="remove" data-key="' + esc(l.key) + '">Remove</button></td><td class="r hide-s">' + money(l.price) + '</td><td class="r">' + stepperHtml(l.key, l.qty) + '</td><td class="r">' + money(l.total) + '</td></tr>';
    }).join('');
    return head('Review Your Bill', 'Check your items, quantities and prices.') + ctxLine() +
      probs.map(function (x) { return '<div class="warn" role="alert">' + esc(x) + '</div>'; }).join('') + notes +
      '<div class="bill"><table><thead><tr><th>Item</th><th class="r hide-s">Price</th><th class="r">Qty</th><th class="r">Total</th></tr></thead><tbody>' + (rows || '<tr><td colspan="4">No items yet.</td></tr>') + '</tbody></table>' +
      '<table style="margin-top:10px"><tbody><tr class="tot"><td>Subtotal</td><td class="r">' + money(t.sub) + '</td></tr><tr class="tot"><td>GST (' + Math.round(GST_RATE * 100) + '%)</td><td class="r">' + money(t.gst) + '</td></tr>' +
      (S.type === 'delivery' ? '<tr class="tot"><td>Delivery fee</td><td class="r">' + money(t.del) + '</td></tr>' : '') +
      '<tr class="grand"><td>Total</td><td class="r">' + money(t.total) + '</td></tr></tbody></table></div>' +
      '<div class="actions wide" style="max-width:760px"><button class="btn btn-ghost" data-act="tomenu">← Add more items</button><button class="btn btn-gold" data-act="next">Continue →</button></div>';
  };

  views.details = function () {
    var d = S.details, body;
    {
      var tl = slots(ymd(new Date()), 'pickup');
      body = '<div class="formcard"><div class="row2">' + field('xName', 'Your name', '<input id="xName" autocomplete="name" value="' + esc(d.name) + '">') + field('xPhone', 'Phone', '<input id="xPhone" type="tel" inputmode="tel" autocomplete="tel" placeholder="03XX XXXXXXX" value="' + esc(d.phone) + '">') + '</div>' +
        (S.type === 'delivery' ? field('xAddr', 'Delivery address', '<textarea id="xAddr" autocomplete="street-address" placeholder="House / flat, street, area, city">' + esc(d.address) + '</textarea>') :
          field('xTime', 'Pickup time (today)', '<select id="xTime"><option value="asap">As soon as possible (ready in about 20–45 min)</option>' + slotOptions(tl, d.time) + '</select>')) +
        field('xNotes', 'Notes (optional)', '<textarea id="xNotes" placeholder="Anything we should know?">' + esc(d.notes) + '</textarea>') + '</div>';
    }
    return head(S.type === 'delivery' ? 'Delivery Details' : 'Pickup Details', '') + body + nav(true, 'Continue →');
  };

  function summaryHtml(o) {
    var d = [];
    d.push(['Order type', TYPE_NAME[o.type]]);
    d.push(['Name', o.details.name]); d.push(['Phone', o.details.phone]); if (o.type === 'delivery') d.push(['Address', o.details.address]); else d.push(['Pickup', o.details.time === 'asap' ? 'As soon as possible (ready in about 20–45 min)' : 'Today, ' + fmtTime(+o.details.time)]);
    if (o.details.notes) d.push(['Notes', o.details.notes]);
    var t = o.totals;
    return '<div class="sumbox"><h3>Details</h3><dl>' + d.map(function (r) { return '<dt>' + r[0] + '</dt><dd>' + esc(r[1]) + '</dd>'; }).join('') + '</dl></div>' +
      '<div class="bill"><table><thead><tr><th>Item</th><th class="r">Qty</th><th class="r">Total</th></tr></thead><tbody>' + o.lines.map(function (l) { return '<tr><td>' + esc(l.name) + '</td><td class="r">' + l.qty + ' × ' + money(l.price) + '</td><td class="r">' + money(l.total) + '</td></tr>'; }).join('') + '</tbody></table>' +
      '<table style="margin-top:10px"><tbody><tr class="tot"><td>Subtotal</td><td class="r">' + money(t.sub) + '</td></tr><tr class="tot"><td>GST (16%)</td><td class="r">' + money(t.gst) + '</td></tr>' + (t.del ? '<tr class="tot"><td>Delivery fee</td><td class="r">' + money(t.del) + '</td></tr>' : '') + '<tr class="grand"><td>Total</td><td class="r">' + money(t.total) + '</td></tr></tbody></table></div>';
  }
  function draft() { return { type: S.type, dine: S.dine, details: S.details, lines: lines(), totals: totals() }; }
  views.confirm = function () {
    return head('Confirm Your Order', 'Please review everything. Your order is only placed when you press Confirm Order.') + summaryHtml(draft()) +
      '<div class="actions wide" style="max-width:760px"><button class="btn btn-ghost" data-act="back">← Back</button><button class="btn btn-gold" data-act="confirm">Confirm Order</button></div>';
  };
  function reservationDone(o) {
    var c = lookup(CUISINES, o.cuisine), st = lookup(SEATING, o.seating);
    return '<div class="done-card"><div class="tick" aria-hidden="true">✓</div><h2 id="stepTitle" tabindex="-1">Reservation Confirmed</h2><p class="lead" style="margin-bottom:8px">We look forward to welcoming you.</p><div class="oid">' + esc(o.id) + '</div><p class="note">Simulated reservation — nothing was actually booked.</p></div>' +
      '<div class="sumbox" style="margin-top:22px"><h3>Your reservation</h3><dl><dt>Date</dt><dd>' + esc(fmtDate(o.date)) + '</dd><dt>Time</dt><dd>' + fmtTime(+o.time) + '</dd><dt>Guests</dt><dd>' + esc(guestsText(o)) + '</dd><dt>Cuisine</dt><dd>' + esc(c ? c[1] : o.cuisine) + '</dd><dt>Seating</dt><dd>' + esc(st ? st[1] : o.seating) + (o.seating === 'vvip' ? ' <em style="color:var(--gold2)">(Rs 2,500 additional)</em>' : '') + '</dd></dl></div>' +
      '<div class="actions wide" style="max-width:760px"><button class="btn btn-ghost" data-act="print">Print</button><button class="btn btn-ghost" onclick="location.href=\'index.html\'">Back to website</button><button class="btn btn-gold" data-act="new">Make another booking</button></div>';
  }
  function etaHtml(o) {
    var e = o.eta; if (!e) return '';
    return '<div class="eta"><span class="eta-t">' + esc(e.title) + '</span>' + (e.value ? '<b class="eta-v">' + esc(e.value) + '</b>' : '') + '<small>' + esc(e.text) + '</small></div>';
  }
  views.done = function () {
    var o = S.done;
    if (o.kind === 'reservation') return reservationDone(o);
    return '<div class="done-card"><div class="tick" aria-hidden="true">✓</div><h2 id="stepTitle" tabindex="-1">Order Confirmed</h2><p class="lead" style="margin-bottom:8px">Thank you, ' + esc(o.type === 'dine' ? o.dine.name : o.details.name) + '!</p><div class="oid">' + esc(o.id) + '</div>' + etaHtml(o) + '<p class="lead" style="margin:6px 0 0">Final amount: <b style="color:var(--gold2)">' + money(o.totals.total) + '</b></p><p class="note">Simulated order — no payment was taken and nothing was sent to a kitchen.</p></div><div style="max-width:760px;margin:22px auto 0">' + summaryHtml(o) + '</div>' +
      '<div class="actions wide" style="max-width:760px"><button class="btn btn-ghost" data-act="print">Print</button><button class="btn btn-ghost" onclick="location.href=\'index.html\'">Back to website</button><button class="btn btn-gold" data-act="new">Place another order</button></div>';
  };

  /* ---------- validation ---------- */
  function phoneOk(v) { return /^(\+?92|0)3\d{9}$/.test(String(v).replace(/[\s-]/g, '')); }
  function flag(id, msg) { var f = $('#f-' + id), e = $('#e-' + id); if (!f) return; if (msg) { f.classList.add('bad'); e.textContent = msg; } else { f.classList.remove('bad'); e.textContent = ''; } }
  function finish(errs) {
    var first = null;
    Object.keys(errs).forEach(function (k) { flag(k, errs[k]); if (!first) first = k; });
    if (first) { var el = document.getElementById(first); if (el) el.focus(); return false; }
    return true;
  }
  function validateDine() {
    var d = S.dine, e = { dDate: '', dTime: '', dGuests: '', dCuisine: '', dSeat: '' }, first = null;
    if (!d.date) e.dDate = 'Please choose a date.'; else if (d.date < ymd(new Date())) e.dDate = 'That date has passed.';
    if (!d.time) e.dTime = 'Please choose a time.';
    if (d.adults < 1) e.dGuests = 'At least one adult is needed.';
    else if (d.kids.some(function (a) { return a === '' || a == null; })) e.dGuests = 'Please select the age of each child.';
    if (!d.cuisine) e.dCuisine = 'Please choose a type of cuisine.';
    if (!d.seating) e.dSeat = 'Please choose where you would like to sit.';
    Object.keys(e).forEach(function (k) { flag(k, e[k]); if (e[k] && !first) first = k; });
    if (first) {
      var el = document.getElementById(first) || Array.prototype.filter.call(document.querySelectorAll('#f-' + first + ' select'), function (x) { return !x.value; })[0] || document.querySelector('#f-' + first + ' input, #f-' + first + ' button');
      if (el) { el.focus(); el.scrollIntoView({ block: 'center', behavior: 'smooth' }); }
      return false;
    }
    return true;
  }
  function validateDetails() {
    if (S.type === 'dine') return true;
    var d = S.details, e = {};
    if ((d.name || '').trim().length < 2) e.xName = 'Please enter your name.';
    if (!phoneOk(d.phone)) e.xPhone = 'Enter a valid mobile number, e.g. 0300 1234567.';
    if (S.type === 'delivery' && (d.address || '').trim().length < 10) e.xAddr = 'Please enter a full delivery address (at least 10 characters).';
    ['xName', 'xPhone', 'xAddr'].forEach(function (k) { if ($('#f-' + k)) flag(k, e[k] || ''); });
    return finish(e);
  }

  /* ---------- render ---------- */
  function renderStage() {
    var view = S.done ? 'done' : S.step;
    var y = window.scrollY;
    $('#stage').innerHTML = views[view]();
    $('#layout').classList.toggle('with-cart', view === 'menu');
    renderProgress(); renderCart();
    if (view === 'menu' && y) window.scrollTo(0, y);
  }
  function go(step, focus) {
    S.step = step; save(); renderStage(); closeCart();
    if (focus !== false) { window.scrollTo(0, 0); var h = $('#stepTitle'); if (h) h.focus({ preventScroll: true }); }
  }
  function openCart() { $('#cart').classList.add('open'); $('#scrim').hidden = false; }
  function closeCart() { $('#cart').classList.remove('open'); $('#scrim').hidden = true; }

  function next() {
    var st = steps(), i = st.indexOf(S.step);
    if (S.step === 'dine') { confirmReservation(); return; }
    if (S.step === 'menu' && !lines().length) { openCart(); return; }
    if (S.step === 'bill' && billProblems().length) { renderStage(); window.scrollTo(0, 0); return; }
    if (S.step === 'details' && !validateDetails()) return;
    if (i < st.length - 1) go(st[i + 1]);
  }
  function back() { var st = steps(), i = st.indexOf(S.step); if (i > 0) go(st[i - 1]); }
  function reset() { S.cart = {}; S.type = null; S.takeaway = false; S.step = 'type'; S.done = null; S.dine = { date: '', time: '', adults: 2, kids: [], cuisine: '', seating: '' }; S.details = { name: '', phone: '', address: '', time: 'asap', notes: '' }; save(); renderStage(); window.scrollTo(0, 0); }

  function confirmReservation() {
    if (!validateDine()) return;
    var d = S.dine, r = { kind: 'reservation', date: d.date, time: d.time, adults: d.adults, kids: d.kids.slice(), guests: guestCount(d), cuisine: d.cuisine, seating: d.seating };
    r.id = 'RV-' + ymd(new Date()).replace(/-/g, '').slice(2) + '-' + Math.floor(1000 + Math.random() * 9000);
    r.placedAt = new Date().toISOString();
    try { var all = JSON.parse(localStorage.getItem('riwayat_reservations') || '[]'); all.push(r); localStorage.setItem('riwayat_reservations', JSON.stringify(all)); } catch (e) { /* demo only */ }
    if (window.RiwayatSync) window.RiwayatSync.send('reservation', r);
    S.done = r; try { sessionStorage.removeItem(STATE_KEY); } catch (e) {}
    renderStage(); window.scrollTo(0, 0); var h = $('#stepTitle'); if (h) h.focus({ preventScroll: true });
  }
  function confirmOrder() {
    var o = draft(); // final amount is calculated only now, on explicit approval
    o.id = 'RW-' + ymd(new Date()).replace(/-/g, '').slice(2) + '-' + Math.floor(1000 + Math.random() * 9000);
    var now = new Date(); o.placedAt = now.toISOString(); o.eta = etaFor(o, now);
    try { var all = JSON.parse(localStorage.getItem(ORDERS_KEY) || '[]'); all.push(o); localStorage.setItem(ORDERS_KEY, JSON.stringify(all)); } catch (e) { /* demo only */ }
    if (window.RiwayatSync) window.RiwayatSync.send('order', o);
    S.done = o; S.cart = {}; try { sessionStorage.removeItem(STATE_KEY); } catch (e) {}
    renderStage(); window.scrollTo(0, 0); var h = $('#stepTitle'); if (h) h.focus({ preventScroll: true });
  }

  /* ---------- events ---------- */
  document.addEventListener('click', function (e) {
    var el = e.target.closest('[data-act]'); if (!el) return;
    var a = el.getAttribute('data-act'), key = el.getAttribute('data-key');
    switch (a) {
      case 'takeaway': S.takeaway = true; if (S.type === 'dine') S.type = null; save(); renderStage(); break;
      case 'type':
        S.type = el.getAttribute('data-v'); S.takeaway = S.type !== 'dine';
        save(); go(S.type === 'dine' ? 'dine' : 'menu'); break;
      case 'next': next(); break;
      case 'back': back(); break;
      case 'goto': go(el.getAttribute('data-step')); break;
      case 'tomenu': go('menu'); break;
      case 'tab': S.tab = el.getAttribute('data-id'); save(); Array.prototype.forEach.call(document.querySelectorAll('.tab'), function (b) { b.setAttribute('aria-selected', b === el); }); $('#menuBody').innerHTML = menuBody(); break;
      case 'add': addKey(key); break;
      case 'inc': setQty(key, (S.cart[key] | 0) + 1); break;
      case 'dec': setQty(key, (S.cart[key] | 0) - 1); break;
      case 'remove': setQty(key, 0); break;
      case 'ainc': S.dine.adults = Math.min(20, S.dine.adults + 1); refreshGuests(); break;
      case 'adec': S.dine.adults = Math.max(1, S.dine.adults - 1); refreshGuests(); break;
      case 'kinc': if (S.dine.kids.length < 10) S.dine.kids.push(''); refreshGuests(); break;
      case 'kdec': S.dine.kids.pop(); refreshGuests(); break;
      case 'cartopen': openCart(); break;
      case 'cartclose': closeCart(); break;
      case 'confirm': confirmOrder(); break;
      case 'confirmres': confirmReservation(); break;
      case 'new': reset(); break;
      case 'print': window.print(); break;
    }
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') closeCart();
    if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('li[data-act="goto"]')) { e.preventDefault(); go(e.target.getAttribute('data-step')); }
  });
  document.addEventListener('input', function (e) {
    var id = e.target.id, v = e.target.value;
    var map = { xName: ['details', 'name'], xPhone: ['details', 'phone'], xAddr: ['details', 'address'], xNotes: ['details', 'notes'] };
    if (map[id]) { S[map[id][0]][map[id][1]] = v; save(); flag(id, ''); }
  });
  document.addEventListener('change', function (e) {
    var id = e.target.id, v = e.target.value;
    if (id === 'dDate') {
      S.dine.date = v; var list = slots(v, 'dine'); if (S.dine.time && list.indexOf(+S.dine.time) < 0) S.dine.time = '';
      $('#dTime').innerHTML = '<option value="">Select a time</option>' + slotOptions(list, S.dine.time); flag('dDate', ''); save();
      if (v && !list.length) flag('dTime', 'No more time slots on this date. Please pick another day.');
    } else if (id === 'dTime') { S.dine.time = v; flag('dTime', ''); save(); }
    else if (id === 'xTime') { S.details.time = v; save(); }
    else if (e.target.getAttribute && e.target.getAttribute('data-kid') !== null) { S.dine.kids[+e.target.getAttribute('data-kid')] = v; flag('dGuests', ''); save(); }
    else if (e.target.name === 'cuisine') { S.dine.cuisine = v; flag('dCuisine', ''); save(); }
    else if (e.target.name === 'seating') { S.dine.seating = v; flag('dSeat', ''); save(); }
  });

  /* ---------- boot ---------- */
  try {
    var start = new URLSearchParams(location.search).get('start');
    if (start === 'dine') { S.type = 'dine'; S.takeaway = false; S.step = 'dine'; S.done = null; }
    else if (start === 'takeaway') { S.type = null; S.takeaway = true; S.step = 'type'; S.done = null; }
    if (start) history.replaceState(null, '', location.pathname);
  } catch (e) { /* ignore */ }
  if (steps().indexOf(S.step) < 0) S.step = steps()[0];
  renderStage();
})();
