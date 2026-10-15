/* Riwayat Assistant — scripted (rule-based) chatbot. No internet or AI service needed. */
(function () {
  'use strict';
  var M = window.RIWAYAT_MENU; if (!M) return;
  var ST = window.RIWAYAT_SETTINGS || window.RIWAYAT_DEFAULT_SETTINGS, U = window.RIWAYAT_UTIL;
  var HOURS = { week: ST.hours.week.label.replace('&', '&amp;') + ': ' + U.clock(ST.hours.week.open) + ' to ' + U.clock(ST.hours.week.close), wknd: ST.hours.wknd.label.replace('&', '&amp;') + ': ' + U.clock(ST.hours.wknd.open) + ' to ' + U.clock(ST.hours.wknd.close) };
  var ADDRESS = ST.address;
  var PHONE = ST.phone, EMAIL = ST.email;
  var GST = ST.gstPercent, DELIVERY = ST.deliveryFee, VVIP = ST.vvipCharge, MAXWAIT = +ST.maxDeliveryMinutes || 60;
  var onOrderPage = !document.getElementById('gallery');
  var menuHref = 'menu.html';
  var galleryHref = onOrderPage ? 'index.html#gallery' : '#gallery';

  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var money = function (n) { return 'Rs ' + Math.round(n).toLocaleString('en-US'); };
  var link = function (href, text) { return '<a href="' + href + '">' + esc(text) + '</a>'; };

  /* ---------- searchable menu index ---------- */
  var INDEX = [];
  M.categories.forEach(function (c) { c.groups.forEach(function (g) { g.items.forEach(function (it) {
    INDEX.push({ name: it.name, desc: it.desc || '', cat: c.name, price: it.price, variants: it.variants, preorder: it.preorder, soldOut: it.soldOut });
  }); }); });
  var STOP = 'what whats is are the a an of in on to for you your do does have has any tell me about price prices cost costs much how many much rs rupees menu please can i we get want like show give there with and or it its my our the options option available'.split(' ');
  var SYN = { veg: ['vegetable', 'paneer', 'daal', 'salad', 'hummus', 'falafel', 'mushroom'], vegetarian: ['vegetable', 'paneer', 'daal', 'salad', 'hummus', 'falafel', 'mushroom'], chai: ['chai', 'tea'], tea: ['tea', 'chai'], bbq: ['tikka', 'boti', 'kabab', 'seekh', 'chop'], kebab: ['kabab'], kebabs: ['kabab'], shawarma: ['shawarma'], pizza: ['pizza'], pasta: ['fettuccine', 'penne', 'lasagna', 'pasta'] };
  function tokens(q) {
    var t = q.toLowerCase().replace(/[^a-z0-9\s&]/g, ' ').split(/\s+/).filter(function (w) { return w && STOP.indexOf(w) < 0 && w.length > 1; }), out = [];
    t.forEach(function (w) { (SYN[w] || [w]).forEach(function (x) { if (out.indexOf(x) < 0) out.push(x); }); });
    return out;
  }
  function searchItems(q) {
    var tk = tokens(q); if (!tk.length) return [];
    var scored = INDEX.map(function (it) {
      var n = it.name.toLowerCase(), d = it.desc.toLowerCase(), sc = 0;
      tk.forEach(function (w) { var re = new RegExp('\\b' + w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')); if (re.test(n)) sc += 3; else if (re.test(d)) sc += 1; });
      return { it: it, sc: sc };
    }).filter(function (x) { return x.sc > 0; }).sort(function (a, b) { return b.sc - a.sc; });
    if (!scored.length) return [];
    var best = scored[0].sc; lastBest = best;
    return scored.filter(function (x) { return x.sc >= Math.max(1, best - 1); }).slice(0, 5).map(function (x) { return x.it; });
  }
  var lastBest = 0;
  function itemLine(it) {
    var p = it.variants && it.variants.length > 1 ? it.variants.map(function (v) { return v.label + ' ' + money(v.price); }).join(' / ') : money(it.price);
    return '<li><b>' + esc(it.name) + '</b> — ' + p + (it.soldOut ? ' <i>(sold out today)</i>' : '') + (it.desc ? '<br><small>' + esc(it.desc) + '</small>' : '') + '</li>';
  }

  /* ---------- replies ---------- */
  var CHIPS_MAIN = ['What should I try?', 'Opening hours', 'Book a table', 'Place an order', 'Buffet prices', 'Seating options'];
  function r(html, chips) { return { html: html, chips: chips }; }
  var ACT = {
    book: link('order.html?start=dine', 'Book a table →'),
    take: link('order.html?start=takeaway', 'Start a takeaway order →')
  };

  function buffetReply(q) {
    var sel = M.buffets.filter(function (b) { return new RegExp(b.id.replace('-', '[- ]?') + '|' + b.name.split(' ')[0].toLowerCase(), 'i').test(q) && !/^buffets?$/i.test(b.name.split(' ')[0]); });
    if (/dinner|hi-?tea|breakfast|brunch/i.test(q) && sel.length) {
      var b = sel[0];
      return r('<b>' + esc(b.name) + '</b> · ' + money(b.pricePerPerson) + ' per person<br>' + esc(b.days) + ' · ' + b.times.map(esc).join(' / ') + (b.kidsNote.length ? '<br>' + esc(b.kidsNote.join(' ')) : '') +
        '<br><br>Includes: ' + b.sections.map(function (s) { return '<b>' + esc(s.name) + '</b> (' + s.dishes.slice(0, 4).map(esc).join(', ') + (s.dishes.length > 4 ? '…' : '') + ')'; }).join('; ') + '.<br><br>' + ACT.book, ['Other buffets', 'Book a table']);
    }
    return r('Our buffets (price per person). ' + esc(M.taxNote) + '<ul>' + M.buffets.map(function (b) { return '<li><b>' + esc(b.name) + '</b> — ' + money(b.pricePerPerson) + '<br><small>' + esc(b.days) + ' · ' + b.times.map(esc).join(' / ') + '</small></li>'; }).join('') + '</ul>Ask about any one (e.g. “what’s in the dinner buffet?”).', ['Dinner buffet', 'Hi-Tea buffet', 'Sunday brunch', 'Book a table']);
  }
  function categoryReply(c, q) {
    if (q) { var hits = searchItems(q); if (hits.length && lastBest >= 6) return r('Here is what I found:<ul>' + hits.map(itemLine).join('') + '</ul><small>' + esc(M.taxNote) + '</small>', ['Takeaway & delivery', 'Book a table']); }
    var names = c.groups.map(function (g) { return esc(g.name); }).join(', ');
    var sample = []; c.groups.forEach(function (g) { if (sample.length < 4) sample.push(g.items[0]); });
    return r('<b>' + esc(c.name) + '</b> — ' + esc(c.subtitle) + '.<br>Sections: ' + names + '.<ul>' + sample.map(function (it) { return itemLine({ name: it.name, desc: it.desc, price: it.price, variants: it.variants }); }).join('') + '</ul>' + link(menuHref, 'See the full menu →'), ['Takeaway & delivery', 'Buffet prices']);
  }
  function cat(id) { return M.categories.filter(function (c) { return c.id === id; })[0]; }

  /* ---------- live booking rules, dates and typo help ---------- */
  var BK = ST.booking || {}, MAXP = +BK.maxParty || 20, ADV = +BK.advanceDays || 60, lastHits = [], lastOffer = '';
  var WDN = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'], MON = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
  var p2 = function (n) { return (n < 10 ? '0' : '') + n; };
  function ymd(d) { return d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate()); }
  function pYmd(s) { var a = s.split('-'); return new Date(+a[0], +a[1] - 1, +a[2]); }
  function fmtT(m) { m = +m; var h = Math.floor(m / 60) % 24, mi = m % 60; return ((h + 11) % 12 + 1) + ':' + p2(mi) + ' ' + (h >= 12 ? 'pm' : 'am'); }
  function fmtD(s) { var d = pYmd(s); return WDN[d.getDay()] + ' ' + d.getDate() + ' ' + MON[d.getMonth()].replace(/^./, function (c) { return c.toUpperCase(); }) + ' ' + d.getFullYear(); }
  function closedReason(ds) {
    var wd = pYmd(ds).getDay();
    if ((BK.closedWeekdays || []).indexOf(wd) >= 0) return 'we are not taking bookings on ' + WDN[wd] + 's';
    var hit = (BK.closedDates || []).filter(function (x) { return x.date === ds; })[0];
    return hit ? 'we are not taking bookings on that date' + (hit.note ? ' (' + hit.note + ')' : '') : '';
  }
  function hoursFor(ds) { var wd = pYmd(ds).getDay(); return wd === 0 || wd === 6 ? ST.hours.wknd : ST.hours.week; }
  function slotsFor(ds) {
    var out = [], now = new Date(), isToday = ds === ymd(now), nowMin = now.getHours() * 60 + now.getMinutes() + Math.max(30, +BK.minNoticeMinutes || 0);
    if (closedReason(ds)) return out;
    var h = hoursFor(ds), blocked = (BK.blockedSlots || []).filter(function (b) { return b.date === ds; });
    for (var m = +h.open; m <= +h.close - 30; m += 30) if ((!isToday || m >= nowMin) && !blocked.some(function (b) { return m >= +b.from && m < +b.to; })) out.push(m);
    return out;
  }
  function parseDate(q) {
    var s = q.toLowerCase(), now = new Date(), d = null, m, i;
    now.setHours(0, 0, 0, 0);
    var add = function (n) { var x = new Date(now); x.setDate(x.getDate() + n); return x; };
    if (/day after tomorrow|parso/.test(s)) d = add(2);
    else if (/\btomorrow\b|\bkal\b/.test(s)) d = add(1);
    else if (/\btoday\b|\baaj\b|\btonight\b/.test(s)) d = add(0);
    else if ((m = s.match(/(\d{4})-(\d{1,2})-(\d{1,2})/))) d = new Date(+m[1], +m[2] - 1, +m[3]);
    else if ((m = s.match(/(\d{1,2})(?:st|nd|rd|th)?\s*(?:of\s+)?(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*/)) || (m = s.match(/(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s*(\d{1,2})(?:st|nd|rd|th)?\b/))) {
      var dd = isNaN(+m[1]) ? +m[2] : +m[1], mo = MON.indexOf(isNaN(+m[1]) ? m[1] : m[2]);
      d = new Date(now.getFullYear(), mo, dd); if (d < now) d = new Date(now.getFullYear() + 1, mo, dd);
    } else if ((m = s.match(/\b(\d{1,2})[\/.](\d{1,2})\b/)) && +m[1] <= 31 && +m[2] <= 12) {
      d = new Date(now.getFullYear(), +m[2] - 1, +m[1]); if (d < now) d = new Date(now.getFullYear() + 1, +m[2] - 1, +m[1]);
    } else {
      var names = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
      for (i = 0; i < 7; i++) if (new RegExp('\\b' + names[i] + '(' + WDN[i].slice(3).toLowerCase() + ')?s?\\b|\\b' + names[i] + '\\b').test(s) && !(i === 6 && /\bsat(isfied|e)\b/.test(s))) { d = add((i - now.getDay() + 7) % 7); break; }
    }
    return d && !isNaN(d) ? ymd(d) : null;
  }
  function openOn(ds) {
    var d = ymd(new Date());
    if (ds < d) return r('That date has already passed.', ['Opening hours']);
    var h = hoursFor(ds), cr = closedReason(ds);
    if (cr) return r('Sorry, ' + cr + '. Please pick another day.', ['Book a table', 'Opening hours']);
    return r('On <b>' + fmtD(ds) + '</b> we are open <b>' + fmtT(h.open) + ' to ' + fmtT(h.close) + '</b>.', ['Book a table', 'Buffet prices']);
  }
  function closuresNote() {
    var t = ymd(new Date()), parts = [];
    if ((BK.closedWeekdays || []).length) parts.push('closed on ' + BK.closedWeekdays.map(function (i) { return WDN[i] + 's'; }).join(', '));
    (BK.closedDates || []).filter(function (x) { return x.date >= t; }).sort(function (a, b) { return a.date < b.date ? -1 : 1; }).slice(0, 5).forEach(function (x) { parts.push(fmtD(x.date) + (x.note ? ' (' + x.note + ')' : '')); });
    return parts.length ? '<br><b>Please note:</b> ' + parts.map(esc).join('; ') + '.' : '';
  }

  /* typo help: used only when nothing else matched */
  var KEYS = 'hours timings opening closing location address directions parking booking reservation reserve table tables delivery takeaway buffet buffets dessert desserts birthday engagement vegetarian recommend recommendation price prices seating terrace rooftop lawn indoor children breakfast brunch contact phone whatsapp restaurant celebration'.split(' '), VOCAB = {};
  INDEX.forEach(function (it) { (it.name + ' ' + it.desc).toLowerCase().replace(/[^a-z\s]/g, ' ').split(/\s+/).forEach(function (w) { if (w.length >= 4) VOCAB[w] = 1; }); });
  KEYS.forEach(function (k) { VOCAB[k] = 1; });
  function lev(a, b, max) {
    if (Math.abs(a.length - b.length) > max) return max + 1;
    var prev = [], cur, i, j; for (j = 0; j <= b.length; j++) prev[j] = j;
    for (i = 1; i <= a.length; i++) { cur = [i]; for (j = 1; j <= b.length; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); prev = cur; }
    return prev[b.length];
  }
  function fixWord(w) {
    if (w.length < 5 || VOCAB[w]) return w;
    var lim = w.length >= 8 ? 2 : 1, best = null, bd = 9, tie = false;
    for (var k in VOCAB) { var d = lev(w, k, lim); if (d > lim) continue; if (d < bd) { bd = d; best = k; tie = false; } else if (d === bd) tie = true; }
    return best && !tie ? best : w;
  }
  function fixTypos(q) { return q.toLowerCase().replace(/[a-z]+/g, fixWord); }

  /* ---------- order / booking status ---------- */
  function lastRecord(q) {
    var id = (q.match(/R[WV]-\d{6}-\d{4}/i) || [''])[0].toUpperCase(), all = [];
    ['riwayat_reservations', 'riwayat_orders'].forEach(function (k) { try { all = all.concat(JSON.parse(localStorage.getItem(k) || '[]')); } catch (e) { /* ignore */ } });
    all = all.filter(function (x) { return x && x.token; });
    if (id) return all.filter(function (x) { return x.id === id; })[0] || null;
    var wantOrder = /order/i.test(q), wantRes = /book|reserv|table/i.test(q);
    all = all.filter(function (x) { var isRes = /^RV-/.test(x.id); return wantOrder && !wantRes ? !isRes : wantRes && !wantOrder ? isRes : true; });
    all.sort(function (a, b) { return String(a.placedAt) < String(b.placedAt) ? -1 : 1; });
    return all[all.length - 1] || null;
  }
  function statusReply(q) {
    var rec = lastRecord(q);
    if (!rec) return r('I could not find a booking or order made on this device. If you have a reference like <b>RV-…</b> or <b>RW-…</b>, please call <b>' + PHONE + '</b>.', ['Contact details']);
    if (!window.RiwayatSync || !RiwayatSync.available()) return r('I cannot check the status right now. Please call <b>' + PHONE + '</b>.', ['Contact details']);
    var kind = /^RV-/.test(rec.id) ? 'reservation' : 'order';
    return RiwayatSync.status(kind, rec.token).then(function (st) {
      return r('<b>' + esc(rec.id) + '</b> (' + (kind === 'order' ? 'takeaway order' : 'table booking') + '): <b>' + esc(st ? RiwayatSync.statusText(kind, st) : 'not found') + '</b>.', ['Opening hours', 'Contact details']);
    }, function () { return r('I could not reach the restaurant just now. Please try again in a moment or call <b>' + PHONE + '</b>.', ['Contact details']); });
  }

  /* ---------- booking inside the chat ---------- */
  var F = null, CUISINES = [['desi', 'Desi', /desi|pakistani|bbq/], ['arabic', 'Arabic', /arab/], ['continental', 'Continental', /conti|western|italian/], ['chinese', 'Chinese', /chin/], ['buffet', 'Buffet', /buffet/], ['mix', 'Mix', /mix|everything|all/], ['undecided', 'Not decided yet', /not decided|undecided|don.?t know|dont know|any|not sure|decide/]];
  var SEATS = [['vvip', 'VVIP Hall', /vvip|private/], ['indoor', 'Indoor', /indoor|inside|main|hall|\bac\b/], ['terrace', 'Terrace', /terrace/], ['lawn', 'Lawn', /lawn|garden|courtyard/], ['rooftop', 'Roof Top', /roof/]];
  var NUMW = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12 };
  function numIn(q) { var m = q.match(/\d+/); if (m) return +m[0]; var w = q.toLowerCase().split(/\W+/).filter(function (x) { return NUMW[x]; })[0]; return w ? NUMW[w] : null; }
  function pick(list, q) { q = q.toLowerCase(); return list.filter(function (x) { return x[2].test(q); })[0] || null; }
  function startFlow() {
    O = null; F = { step: 'date', d: { kids: [] } }; lastOffer = '';
    return r('Happy to book a table for you. Which <b>date</b>? You can say “tomorrow”, “Friday” or “25 Oct”. (Type “cancel” any time to stop.)', ['Today', 'Tomorrow']);
  }
  function timeChips(sl) { var out = [], pref = [780, 1140, 1200, 1260]; pref.forEach(function (m) { if (sl.indexOf(m) >= 0) out.push(fmtT(m)); }); if (!out.length) sl.slice(0, 4).forEach(function (m) { out.push(fmtT(m)); }); return out; }
  function parseTime(q, sl) {
    var m = q.toLowerCase().match(/(\d{1,2})(?:[:.](\d{2}))?\s*(a\.?m\.?|p\.?m\.?)?/); if (!m) return null;
    var h = +m[1], mi = +(m[2] || 0), suf = m[3] ? m[3][0] : '', cands = [];
    if (h > 24 || mi > 59) return null;
    if (suf === 'p') cands.push(h % 12 + 12); else if (suf === 'a') cands.push(h % 12); else if (h >= 13) cands.push(h); else cands.push(h % 12 + 12, h % 12);
    for (var i = 0; i < cands.length; i++) { var t = cands[i] * 60 + mi; if (sl.indexOf(t) >= 0) return t; }
    return null;
  }
  function summary(d) {
    var n = d.adults + d.kids.length, c = CUISINES.filter(function (x) { return x[0] === d.cuisine; })[0], s = SEATS.filter(function (x) { return x[0] === d.seating; })[0];
    return '<ul><li><b>' + fmtD(d.date) + '</b> at <b>' + fmtT(d.time) + '</b></li><li>' + n + (n === 1 ? ' guest' : ' guests') + ' (' + d.adults + ' adults' + (d.kids.length ? ', ' + d.kids.length + ' kids aged ' + d.kids.map(function (a) { return a === 0 ? 'under 1' : a; }).join(', ') : '') + ')</li><li>' + c[1] + ' · ' + s[1] + (d.seating === 'vvip' ? ' (' + money(VVIP) + ' additional)' : '') + '</li><li>' + esc(d.name) + ' · ' + esc(d.phone) + '</li></ul>';
  }
  function flowReply(q) {
    var d = F.d, t = q.trim(), x, n;
    if (/\bcancel\b|\bstop\b|never ?mind|rehne do|chor do|\bquit\b/i.test(t)) { F = null; return r('No problem, I have cancelled the booking. Anything else I can help with?', CHIPS_MAIN); }
    switch (F.step) {
      case 'date':
        x = parseDate(t); if (!x) return r('Sorry, I did not get the date. Try “tomorrow”, “Friday” or “25 Oct”.', ['Today', 'Tomorrow']);
        var last = new Date(); last.setDate(last.getDate() + ADV);
        if (x < ymd(new Date())) return r('That date has already passed. Which day would you like?', ['Today', 'Tomorrow']);
        if (x > ymd(last)) return r('We take bookings up to ' + ADV + ' days ahead. Please pick an earlier date.', ['Today', 'Tomorrow']);
        if (closedReason(x)) return r('Sorry, ' + closedReason(x) + '. Please pick another day.', ['Today', 'Tomorrow']);
        F.sl = slotsFor(x); if (!F.sl.length) return r('There are no table times left on ' + fmtD(x) + '. Please pick another day.', ['Tomorrow']);
        d.date = x; F.step = 'time';
        return r('<b>' + fmtD(x) + '</b>. We seat guests from <b>' + fmtT(F.sl[0]) + '</b> to <b>' + fmtT(F.sl[F.sl.length - 1]) + '</b>. What time would you like? (e.g. 8 pm)', timeChips(F.sl));
      case 'time':
        x = parseTime(t, F.sl);
        if (x == null) return r('I could not match that to a table time. Times run every 30 minutes from ' + fmtT(F.sl[0]) + ' to ' + fmtT(F.sl[F.sl.length - 1]) + ' (for example 8:00 pm or 8:30 pm).', timeChips(F.sl));
        d.time = x; F.step = 'adults'; return r('How many <b>adults</b> will be dining? (Online bookings up to ' + MAXP + ' guests.)', ['2', '4', '6']);
      case 'adults':
        n = numIn(t); if (!n || n < 1) return r('Please tell me the number of adults, for example 4.', ['2', '4', '6']);
        if (n > MAXP) return r('Online bookings are limited to ' + MAXP + ' guests. For larger groups please call <b>' + PHONE + '</b>.', ['2', '4', '6']);
        d.adults = n; F.step = 'kids'; return r('Any <b>kids</b> (up to 12 years)? Say “none” or a number.', ['No kids', '1', '2', '3']);
      case 'kids':
        n = /^(no|none|nil|nahi|nahin|koi nahi|zero)/i.test(t) ? 0 : numIn(t);
        if (n == null) return r('Please say “none” or the number of kids.', ['No kids', '1', '2', '3']);
        if (d.adults + n > MAXP) return r('That makes more than ' + MAXP + ' guests. For larger groups please call <b>' + PHONE + '</b>, or give me a smaller number of kids.', ['No kids', '1', '2']);
        if (n > 10) return r('Please call <b>' + PHONE + '</b> for that many children.', ['No kids']);
        if (!n) { d.kids = []; F.step = 'cuisine'; return cuisineQ(); }
        F.nk = n; F.step = 'ages'; return r('Please tell me the age of ' + (n === 1 ? 'the child' : 'each of the ' + n + ' children') + ', for example “4” or “4 and 7”. Use 0 for under 1.');
      case 'ages':
        var nums = t.toLowerCase().replace(/under\s*1|infant|baby/g, '0').match(/\d+/g) || [];
        if (nums.length !== F.nk || nums.some(function (a) { return +a > 12; })) return r('I need exactly ' + F.nk + (F.nk === 1 ? ' age' : ' ages') + ', each from 0 to 12 (for example “4 and 7”).');
        d.kids = nums.map(Number); F.step = 'cuisine'; return cuisineQ();
      case 'cuisine':
        x = pick(CUISINES, t); if (!x) return cuisineQ('Sorry, I did not catch that. ');
        d.cuisine = x[0]; F.step = 'seating'; return r('Where would you like to sit?<ul><li><b>VVIP Hall</b> — private (' + money(VVIP) + ' additional)</li><li><b>Indoor</b>, <b>Terrace</b>, <b>Lawn</b> or <b>Roof Top</b></li></ul>', SEATS.map(function (z) { return z[1]; }));
      case 'seating':
        x = pick(SEATS, t); if (!x) return r('Please choose one: VVIP Hall, Indoor, Terrace, Lawn or Roof Top.', SEATS.map(function (z) { return z[1]; }));
        d.seating = x[0]; F.step = 'name'; return r('Almost done. What <b>name</b> should the booking be under?');
      case 'name':
        x = t.replace(/^(my name is|i am|i'm|mera naam|name is)\s+/i, '').trim();
        if (x.length < 2 || x.length > 60 || /\d{4}/.test(x)) return r('Please type your name, for example “Sara Khan”.');
        d.name = x; F.step = 'phone'; return r('Thank you, ' + esc(x) + '. What is your <b>mobile number</b>, so we can confirm the table? (e.g. 0300 1234567)');
      case 'phone':
        if (!/^(\+?92|0)3\d{9}$/.test(t.replace(/[\s-]/g, ''))) return r('That does not look like a Pakistani mobile number. Please type it like 0300 1234567.');
        d.phone = t.replace(/[\s-]/g, ''); F.step = 'confirm';
        return r('Please check your booking request:' + summary(d) + 'Shall I send it to the restaurant?', ['Yes, confirm', 'Cancel']);
      case 'confirm':
        if (/^(yes|confirm|ok|okay|haan|han|ji|yep|sure|done|send)/i.test(t)) return submitFlow();
        if (/^(no|nahi|nahin)/i.test(t)) { F = null; return r('Okay, I have not sent anything. Anything else I can help with?', CHIPS_MAIN); }
        return r('Please press “Yes, confirm” to send your request, or “Cancel”.', ['Yes, confirm', 'Cancel']);
    }
    F = null; return null;
  }
  function cuisineQ(pre) { return r((pre || '') + 'What kind of <b>cuisine</b> would you like?', CUISINES.map(function (z) { return z[1]; })); }
  function submitFlow() {
    var d = F.d;
    if (!window.RiwayatSync || !RiwayatSync.available()) { F = null; return r('Sorry, I cannot send bookings from here right now. Please use the booking page: ' + ACT.book, ['Contact details']); }
    var rec = { kind: 'reservation', type: 'reservation', name: d.name, phone: d.phone, date: d.date, time: d.time, adults: d.adults, kids: d.kids.slice(), guests: d.adults + d.kids.length, cuisine: d.cuisine, seating: d.seating };
    rec.id = 'RV-' + ymd(new Date()).replace(/-/g, '').slice(2) + '-' + Math.floor(1000 + Math.random() * 9000); rec.placedAt = new Date().toISOString();
    return RiwayatSync.submit('reservation', rec).then(function (tok) {
      rec.token = tok; rec.status = 'new'; F = null;
      try { var all = JSON.parse(localStorage.getItem('riwayat_reservations') || '[]'); all.push(rec); localStorage.setItem('riwayat_reservations', JSON.stringify(all)); } catch (e) { /* ignore */ }
      return r('Your table request has been sent. Reference: <b>' + esc(rec.id) + '</b>.<br>Status: <b>Awaiting confirmation</b>. The team will confirm it, and you can ask me “check my booking status” any time.', ['Check my booking status', 'Opening hours']);
    }, function () { return r('I could not reach the restaurant just now, so nothing was sent. Please press “Yes, confirm” to try again.', ['Yes, confirm', 'Cancel']); });
  }

  /* ---------- placing a takeaway order inside the chat ---------- */
  var O = null, GSTR = (+GST || 0) / 100, OI = {};
  M.categories.forEach(function (c) { c.groups.forEach(function (g) { g.items.forEach(function (it) {
    var base = { id: it.id, base: it.name, desc: it.desc || '', preorder: !!it.preorder, soldOut: !!it.soldOut };
    if (it.variants && it.variants.length > 1) it.variants.forEach(function (v) { OI[it.id + '|' + v.label] = { key: it.id + '|' + v.label, name: it.name + ' (' + v.label + ')', base: it.name, price: v.price, preorder: base.preorder, soldOut: base.soldOut, desc: base.desc }; });
    else OI[it.id] = { key: it.id, name: it.name, base: it.name, price: it.price, preorder: base.preorder, soldOut: base.soldOut, desc: base.desc };
  }); }); });
  var CMD = /\b(place|an|the|order|orders|i|want|wanna|to|would|like|please|takeaway|take|away|delivery|pickup|food|can|could|get|me|a|my|start|make|new|for|some|add|give|chahiye|chahiye|karna|karni|hai|mujhe|kar|do|dena|karen|karein|ek)\b/g;
  function oname(k) { return OI[k].name; }
  function cartLines() { return Object.keys(O.cart).filter(function (k) { return OI[k] && O.cart[k] > 0; }).map(function (k) { var i = OI[k]; return { key: k, name: i.name, price: i.price, kind: 'item', preorder: i.preorder, qty: O.cart[k], total: i.price * O.cart[k] }; }); }
  function cartTotals() {
    var ls = cartLines(), sub = ls.reduce(function (a, l) { return a + l.total; }, 0), gst = Math.round(sub * GSTR), del = O.type === 'delivery' && sub > 0 ? DELIVERY : 0;
    return { sub: sub, gst: gst, del: del, total: sub + gst + del };
  }
  function cartHtml(withBill) {
    var ls = cartLines(), t = cartTotals();
    if (!ls.length) return 'Your cart is empty.';
    var h = '<ul>' + ls.map(function (l) { return '<li>' + l.qty + ' × ' + esc(l.name) + ' — ' + money(l.total) + (l.preorder ? ' <small>(pre-order)</small>' : '') + '</li>'; }).join('') + '</ul>';
    if (!withBill) return h + 'Subtotal: <b>' + money(t.sub) + '</b> (+' + GST + '% GST)';
    return h + 'Subtotal ' + money(t.sub) + '<br>GST (' + GST + '%) ' + money(t.gst) + (t.del ? '<br>Delivery fee ' + money(t.del) : '') + '<br><b>Total ' + money(t.total) + '</b>';
  }
  function findItems(text) {
    var tk = tokens(text); if (!tk.length) return [];
    var res = Object.keys(OI).map(function (k) {
      var it = OI[k], n = it.name.toLowerCase(), d = it.desc.toLowerCase(), sc = 0, hit = 0;
      tk.forEach(function (w) { var re = new RegExp('\\b' + w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')); if (re.test(n)) { sc += 3; hit++; } else if (re.test(d)) sc += 0.5; });
      return { it: it, sc: sc, hit: hit };
    }).filter(function (x) { return x.hit > 0; });
    if (!res.length) return [];
    var best = Math.max.apply(null, res.map(function (x) { return x.sc; }));
    var top = res.filter(function (x) { return x.sc === best; }).map(function (x) { return x.it; });
    // prefer dishes whose whole name is covered by the words typed
    var exact = top.filter(function (i) { return i.base.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter(function (w) { return w.length > 1; }).every(function (w) { return tk.indexOf(w) >= 0 || text.toLowerCase().indexOf(w) >= 0; }); });
    return exact.length ? exact : top;
  }
  function addFromText(text) { // returns {added:[], msg: html, chips}
    var parts = text.split(/\band\b|,|&|\+|\baur\b|\n/i), added = [], notes = [], pend = null;
    parts.forEach(function (p, pi) {
      if (pend) return;
      p = p.trim(); if (!p) return;
      var qty = 1, m = p.match(/(\d+)\s*(?:x|×)?\s*/) , w;
      if (m) { qty = +m[1]; p = p.replace(m[0], ' '); } else { w = p.toLowerCase().split(/\W+/).filter(function (z) { return NUMW[z]; })[0]; if (w) { qty = NUMW[w]; p = p.replace(new RegExp('\\b' + w + '\\b', 'i'), ' '); } }
      if (qty < 1 || qty > 20) { notes.push('Please order between 1 and 20 of each dish.'); return; }
      p = p.replace(CMD, ' ').replace(/\s+/g, ' ').trim(); if (p.length < 2) return;
      var f = findItems(p); if (!f.length) { var fx = fixTypos(p); if (fx !== p.toLowerCase()) f = findItems(fx); }
      if (!f.length) { notes.push('I could not find “' + esc(p) + '” on the menu.'); return; }
      if (f.length > 1) {
        var live = f.filter(function (i) { return !i.soldOut; });
        if (live.length > 1) { pend = { qty: qty, opts: live.slice(0, 5).map(function (i) { return i.key; }), rest: parts.slice(pi + 1).join(' and ') }; return; }
        f = live.length ? live : f;
      }
      var it = f[0];
      if (it.soldOut) { notes.push('Sorry, <b>' + esc(it.name) + '</b> is sold out today.'); return; }
      O.cart[it.key] = Math.min(20, (O.cart[it.key] || 0) + qty); added.push(qty + ' × ' + esc(it.name) + (it.preorder ? ' (pre-order, needs 24 hours notice)' : ''));
    });
    return { added: added, notes: notes, pend: pend };
  }
  function cartChips() { return cartLines().length ? ['Done, checkout', 'Show cart', 'Clear cart'] : ['View menu']; }
  function startOrder(q) {
    F = null; lastOffer = ''; O = { step: 'cart', cart: {}, type: null, d: { time: 'asap', notes: '' } };
    var rest = (q || '').replace(CMD, ' ').replace(/\s+/g, ' ').trim();
    if (rest.length > 2 && !/^(takeaway|delivery|pickup)$/i.test(rest)) { var res = addFromText(q); if (res.added.length || res.pend) return orderAddReply(res); }
    return r('Happy to take your order. Tell me the dishes and quantities, for example <b>“2 chicken karahi and 4 garlic naan”</b>. Say <b>done</b> when you have finished. (Type “cancel” any time to stop.)', ['What should I try?', 'View menu']);
  }
  function orderAddReply(res) {
    if (res.pend) {
      O.pend = res.pend;
      return r((res.added.length ? 'Added ' + res.added.join(', ') + '.<br>' : '') + 'Which one would you like' + (res.pend.qty > 1 ? ' (' + res.pend.qty + ' of them)' : '') + '?<ul>' + res.pend.opts.map(function (k, i) { return '<li>' + (i + 1) + '. ' + esc(oname(k)) + ' — ' + money(OI[k].price) + '</li>'; }).join('') + '</ul>', res.pend.opts.map(oname));
    }
    var msg = (res.added.length ? 'Added ' + res.added.join(', ') + '. ' : '') + res.notes.join(' ');
    return r((msg ? msg + '<br>' : '') + cartHtml(false) + '<br>Anything else? Or say <b>done</b> to checkout.', cartChips());
  }
  function pickupSlots() {
    var now = new Date(), nm = now.getHours() * 60 + now.getMinutes() + 30, h = hoursFor(ymd(now)), out = [];
    for (var m = +h.open; m <= +h.close - 30; m += 30) if (m >= nm) out.push(m);
    return out;
  }
  function etaForOrder(o, placed) {
    var n = o.lines.reduce(function (a, l) { return a + l.qty; }, 0), add = function (m) { return new Date(placed.getTime() + m * 60000); }, clk = function (d) { return fmtT(d.getHours() * 60 + d.getMinutes()); };
    if (o.lines.some(function (l) { return l.preorder; })) return { kind: 'preorder', title: 'We will confirm your time', text: 'Your order contains a pre-order item (24 hours notice). Our team will call you to confirm the exact time.' };
    if (o.type === 'delivery') { var lo = Math.min(MAXWAIT - 10, 40 + n); return { kind: 'delivery', title: 'Estimated delivery', value: 'By ' + clk(add(MAXWAIT)), text: 'About ' + lo + '–' + MAXWAIT + ' minutes from now (' + clk(add(lo)) + ' to ' + clk(add(MAXWAIT)) + '). Delivery never takes longer than ' + MAXWAIT + ' minutes.', minMinutes: lo, maxMinutes: MAXWAIT }; }
    if (o.details.time && o.details.time !== 'asap') return { kind: 'scheduled', title: 'Pickup time', value: fmtT(+o.details.time), text: 'Your order will be ready at your chosen time.', minMinutes: null, maxMinutes: null };
    var m = Math.min(45, 20 + 2 * n);
    return { kind: 'pickup', title: 'Ready for pickup at', value: clk(add(m)), text: 'About ' + m + ' minutes from now. Your order will be ready within ' + MAXWAIT + ' minutes at the latest.', minMinutes: m, maxMinutes: MAXWAIT };
  }
  function orderReply(q) {
    var d = O.d, t = q.trim(), x, i;
    if (/\bcancel\b|\bstop\b|never ?mind|rehne do|chor do|\bquit\b/i.test(t)) { O = null; return r('No problem, I have cancelled the order. Anything else I can help with?', CHIPS_MAIN); }
    if (O.step === 'cart') {
      if (O.pend) {
        var pend = O.pend, low = t.toLowerCase(), pick = null; O.pend = null;
        var num = /^\d$/.test(t) ? +t - 1 : -1; if (num >= 0 && pend.opts[num]) pick = pend.opts[num];
        if (!pick) pick = pend.opts.filter(function (k) { return low === oname(k).toLowerCase(); })[0] || null;
        if (!pick) { var f2 = pend.opts.filter(function (k) { var lab = (oname(k).match(/\(([^)]*)\)$/) || [, ''])[1].toLowerCase(); return lab && new RegExp('\\b' + lab.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b').test(low); }); if (f2.length === 1) pick = f2[0]; }
        if (pick) { O.cart[pick] = Math.min(20, (O.cart[pick] || 0) + pend.qty); var first = { added: [pend.qty + ' × ' + esc(oname(pick))], notes: [] }; if (pend.rest && pend.rest.trim()) { var more = addFromText(pend.rest); first.added = first.added.concat(more.added); first.notes = more.notes; first.pend = more.pend; } return orderAddReply(first); }
      }
      if (/^(clear|empty|reset)\b/i.test(t)) { O.cart = {}; return r('I have emptied your cart. What would you like to order?', ['View menu']); }
      if (/^(show|view|see|what'?s in)?\s*(my |the )?(cart|basket|order)\b/i.test(t) || /^show cart/i.test(t)) return r('Your cart:<br>' + cartHtml(false), cartChips());
      if (/^(remove|delete|minus|hata|hatao)\b/i.test(t)) {
        var tx = t.replace(/^(remove|delete|minus|hata|hatao)\s*/i, ''), tk = tokens(tx), ls = cartLines().filter(function (l) { return tk.some(function (w) { return l.name.toLowerCase().indexOf(w) >= 0; }); });
        if (!ls.length) return r('I could not find that in your cart.<br>' + cartHtml(false), cartChips());
        ls.forEach(function (l) { delete O.cart[l.key]; }); return r('Removed ' + ls.map(function (l) { return esc(l.name); }).join(', ') + '.<br>' + cartHtml(false), cartChips());
      }
      if (/^(done|checkout|check out|finish|finished|that'?s? (all|it)|thats all|nothing else|no more|no|nope|bas|bas itna|proceed|continue|next|confirm|place( the| my)? order|done, checkout)(?![a-z])/i.test(t)) {
        if (!cartLines().length) return r('Your cart is empty. Tell me what you would like, for example “2 chicken karahi”.', ['What should I try?', 'View menu']);
        O.step = 'type'; return r('Here is your cart:<br>' + cartHtml(false) + '<br><br>Would you like <b>pickup</b> or <b>delivery</b>? (Delivery fee ' + money(DELIVERY) + ')', ['Pickup', 'Delivery']);
      }
      var res = addFromText(t);
      if (res.added.length || res.pend) return orderAddReply(res);
      return r((res.notes.length ? res.notes.join(' ') + ' ' : 'I did not understand that. ') + 'Try a dish name with a quantity, for example “2 chicken biryani”, or say <b>done</b> to checkout.', cartChips());
    }
    switch (O.step) {
      case 'type':
        if (/deliver/i.test(t)) { O.type = 'delivery'; O.step = 'address'; return r('Delivery it is. Please type your full <b>delivery address</b> (house / flat, street, area, city).'); }
        if (/pick|collect|takeaway|take away|khud|aunga|aaunga/i.test(t)) {
          O.type = 'pickup'; O.step = 'time'; var sl = pickupSlots(); O.sl = sl;
          return r('Pickup it is. When should it be ready? Say <b>as soon as possible</b>' + (sl.length ? ' or a time today (e.g. ' + fmtT(sl[Math.min(2, sl.length - 1)]) + ')' : '') + '.', ['As soon as possible'].concat(sl.slice(0, 3).map(fmtT)));
        }
        return r('Please choose <b>Pickup</b> or <b>Delivery</b>.', ['Pickup', 'Delivery']);
      case 'address':
        if (t.length < 10) return r('Please type the full address (at least 10 characters), including house number, street and area.');
        d.address = t; O.step = 'name'; return r('Thank you. What is your <b>name</b>?');
      case 'time':
        if (/asap|as soon|now|jaldi|abhi|earliest/i.test(t)) { d.time = 'asap'; }
        else { x = parseTime(t, O.sl || []); if (x == null) return r('I could not match that time. ' + (O.sl && O.sl.length ? 'Pickup times today start at ' + fmtT(O.sl[0]) + ', every 30 minutes. ' : '') + 'Say “as soon as possible” or pick a time.', ['As soon as possible'].concat((O.sl || []).slice(0, 3).map(fmtT))); d.time = x; }
        O.step = 'name'; return r('What is your <b>name</b>?');
      case 'name':
        x = t.replace(/^(my name is|i am|i'm|mera naam|name is)\s+/i, '').trim();
        if (x.length < 2 || x.length > 60 || /\d{4}/.test(x)) return r('Please type your name, for example “Ali Raza”.');
        d.name = x; O.step = 'phone'; return r('Thank you, ' + esc(x) + '. What is your <b>mobile number</b>? (e.g. 0300 1234567)');
      case 'phone':
        if (!/^(\+?92|0)3\d{9}$/.test(t.replace(/[\s-]/g, ''))) return r('That does not look like a Pakistani mobile number. Please type it like 0300 1234567.');
        d.phone = t.replace(/[\s-]/g, ''); O.step = 'notes'; return r('Any <b>notes</b> for the kitchen (spice level, allergies, etc.)? Say “none” to skip.', ['None']);
      case 'notes':
        d.notes = /^(none|no|nope|skip|nahi|nahin|nil|nothing)\b/i.test(t) ? '' : t.slice(0, 300); O.step = 'confirm';
        var tt = cartTotals();
        return r('Please check your order:' + cartHtml(true) + '<br><br>' + (O.type === 'delivery' ? '<b>Delivery</b> to ' + esc(d.address) : '<b>Pickup</b> ' + (d.time === 'asap' ? 'as soon as possible' : 'at ' + fmtT(d.time))) + '<br>' + esc(d.name) + ' · ' + esc(d.phone) + (d.notes ? '<br>Notes: ' + esc(d.notes) : '') + '<br><br>Shall I place this order? (' + esc(M.taxNote || '') + ')', ['Yes, place order', 'Cancel']);
      case 'confirm':
        if (/^(yes|confirm|ok|okay|haan|han|ji|yep|sure|done|send|place)/i.test(t)) return submitOrder();
        if (/^(no|nahi|nahin)/i.test(t)) { O = null; return r('Okay, I have not sent anything. Anything else I can help with?', CHIPS_MAIN); }
        return r('Please press “Yes, place order” to send it, or “Cancel”.', ['Yes, place order', 'Cancel']);
    }
    O = null; return null;
  }
  function submitOrder() {
    if (!window.RiwayatSync || !RiwayatSync.available()) { O = null; return r('Sorry, I cannot send orders from here right now. Please use the order page: ' + ACT.take, ['Contact details']); }
    var d = O.d, now = new Date(), o = { type: O.type, details: { name: d.name, phone: d.phone, address: O.type === 'delivery' ? d.address : '', time: O.type === 'delivery' ? 'asap' : d.time, notes: d.notes }, lines: cartLines(), totals: cartTotals() };
    o.id = 'RW-' + ymd(now).replace(/-/g, '').slice(2) + '-' + Math.floor(1000 + Math.random() * 9000); o.placedAt = now.toISOString(); o.eta = etaForOrder(o, now);
    return RiwayatSync.submit('order', o).then(function (tok) {
      o.token = tok; o.status = 'new'; O = null;
      try { var all = JSON.parse(localStorage.getItem('riwayat_orders') || '[]'); all.push(o); localStorage.setItem('riwayat_orders', JSON.stringify(all)); } catch (e) { /* ignore */ }
      return r('Thank you, ' + esc(d.name.split(/\s+/)[0]) + '! 🎉 Your order <b>' + esc(o.id) + '</b> has been received and the kitchen has been notified.<br>' + esc(o.eta.title) + (o.eta.value ? ': <b>' + esc(o.eta.value) + '</b>' : '') + '.<br>Total: <b>' + money(o.totals.total) + '</b>. Thank you for choosing Riwayat!<br><small>Ask me “check my order status” any time.</small>', ['Check my order status', 'Opening hours']);
    }, function () { return r('I could not reach the restaurant just now, so nothing was sent. Please press “Yes, place order” to try again.', ['Yes, place order', 'Cancel']); });
  }

  var RULES = [
    { t: /sold ?out|finished today|khatam|not available today|unavailable/i, f: function () { var so = INDEX.filter(function (i) { return i.soldOut; }); return r(so.length ? 'Currently <b>sold out</b>:<ul>' + so.map(function (i) { return '<li>' + esc(i.name) + '</li>'; }).join('') + '</ul>Everything else on the menu is available.' : 'Nothing is marked sold out right now.', ['View menu']); } },
    { t: /status|track|where is my|check my (order|booking|reservation|table)|RW-\d|RV-\d/i, f: function (q) { return statusReply(q); } },
    { t: /^(and |what about |also )?(the )?(price|cost|rate|kitna|kitne ka|qeemat|how much)( of (it|that|them))?\??$/i, f: function () { return lastHits.length ? r('<ul>' + lastHits.map(itemLine).join('') + '</ul>', ['Takeaway & delivery']) : null; } },
    { t: /^(yes|yeah|yep|haan|han|ji|ji haan|ok|okay|sure|please)\b/i, f: function () { return lastOffer === 'book' ? startFlow() : null; } },
    { t: /^(hi|hello|hey|salam|assalam|aoa|good (morning|evening|afternoon))(?![-\w])|السلام/i, f: function () { return r('Assalam-o-Alaikum! Welcome to <b>Riwayat</b>. I can help with the menu, buffets, table bookings and takeaway orders. What would you like to know?', CHIPS_MAIN); } },
    { t: /thank|shukriya|jazak|شکریہ/i, f: function () { return r('You are most welcome! Anything else I can help with?', ['Opening hours', 'Book a table']); } },
    { t: /^(bye|goodbye|allah hafiz|khuda hafiz)/i, f: function () { return r('Allah Hafiz! We look forward to welcoming you at Riwayat.'); } },
    { t: /\bhelp\b|what can you do/i, f: function () { return r('I can answer questions about <b>opening hours</b>, <b>location</b>, <b>menu items and prices</b>, <b>buffets</b>, <b>seating</b>, <b>kids</b>, <b>table booking</b> and <b>takeaway / delivery</b>. Try “price of chicken karahi”.', CHIPS_MAIN); } },
    { t: /hour|open|clos|timing|what time|kitne baje|khul|وقت|کھل/i, f: function (q) { var dq = /buffet|brunch|tea\b|dinner|lunch/i.test(q) ? null : parseDate(q); if (dq) return openOn(dq); return r('We are open:<br>• ' + HOURS.week + '<br>• ' + HOURS.wknd + '<br><br>Buffet timings:<ul>' + M.buffets.map(function (b) { return '<li><b>' + esc(b.name) + '</b> (' + esc(b.days.toLowerCase()) + '): ' + b.times.map(esc).join(' and ') + '</li>'; }).join('') + '</ul>' + closuresNote(), ['Book a table', 'Buffet prices']); } },
    { t: /where|location|address|direction|map|find you|kahan|کہاں|پتہ|road/i, f: function () { return r('We are on <b>' + ADDRESS + '</b>, Pakistan. See the exterior in our ' + link(galleryHref, 'gallery') + '.', ['Opening hours', 'Contact details']); } },
    { t: /phone|call|contact|number|email|whatsapp|reach|رابطہ/i, f: function () { return r('You can reach us at <b>' + PHONE + '</b> or <b>' + EMAIL + '</b>.', ['Book a table']); } },
    { t: /./, f: function (q) { return themeReply(q); } },
    { t: /birthday|engagement|celebrat|decor|themes?\b|\b(party|parties|events?)\b(?! of)|mangni/i, f: function (q) {
        var P = window.RIWAYAT_PARTIES, names = function (k) { return P && P[k] ? P[k].themes.map(function (t) { return esc(t.name); }).join(', ') : ''; };
        return r('We host <b>Birthday Parties</b> and <b>Engagement Ceremonies</b> with <b>free décor</b> — choose from <b>4 themes</b> each.' + (P ? '<ul><li><b>Birthday:</b> ' + names('birthday') + '</li><li><b>Engagement:</b> ' + names('engagement') + '</li></ul>' : '<br>') + 'Minimum guests vary by theme. Call <b>' + PHONE + '</b> or email <b>' + EMAIL + '</b> to plan yours. ' + link(onOrderPage ? 'index.html#celebrations' : '#celebrations', 'See the themes →'), ['Birthday themes', 'Engagement themes', 'Contact details']); } },
    { t: /seat|sitting|table type|indoor|terrace|lawn|roof|vvip|private|outdoor|bethna/i, f: function () { return r('You can choose where to sit when you book:<ul><li><b>VVIP Hall</b> — private, exclusive dining (<i>' + money(VVIP) + ' additional</i>)</li><li><b>Indoor</b> — main dining hall</li><li><b>Terrace</b> — open-air arched terrace</li><li><b>Lawn</b> — courtyard lawn with fountains</li><li><b>Roof Top</b> — city views and lantern light</li></ul>' + ACT.book, ['Book a table', 'Opening hours']); } },
    { t: /kid|child|children|bachch|baby|toddler/i, f: function () { var k = M.buffets.filter(function (b) { return b.kidsNote.length; }); return r('When booking a table you tell us how many <b>adults</b> and <b>kids</b> are coming and each child’s age (up to 12 years).' + (k.length ? '<br><br>Buffet kids pricing:<ul>' + k.map(function (b) { return '<li><b>' + esc(b.name) + '</b>: ' + esc(b.kidsNote.join(' ')) + '</li>'; }).join('') + '</ul>' : '') + ACT.book, ['Book a table', 'Buffet prices']); } },
    { t: /book|reserv|table for|dine[- ]?in|booking|ٹیبل|table chahiye|table chahye/i, f: function (q) {
        if (/\bhow\b|process|steps|kaise|policy|rules?\b|limit|advance|notice|information|info\b/i.test(q)) return r('Table requests are checked by our team, so each one is <b>awaiting confirmation</b> until we confirm it.<ul><li>Bookable up to <b>' + ADV + ' days</b> ahead</li><li>Online parties up to <b>' + MAXP + ' guests</b> (call <b>' + PHONE + '</b> for larger groups)</li>' + (+BK.minNoticeMinutes > 30 ? '<li>At least <b>' + BK.minNoticeMinutes + ' minutes</b> notice</li>' : '') + '</ul>I can take your booking right here, or you can use the full page: ' + ACT.book, ['Book a table', 'Seating options']);
        return startFlow(); } },
    { t: /weather|rain|raining|hot today|cold today|temperature|garmi|sardi|barish|بارش|موسم/i, f: function () { return r('I cannot check the weather, but Riwayat has a seat for every mood: <b>Indoor</b> seating, <b>Terrace</b>, <b>Lawn</b> and <b>Roof Top</b> for open-air evenings, and the <b>VVIP Hall</b> for private dining. Choose your seating when you ' + ACT.book, ['Seating options', 'Opening hours', 'Book a table']); } },
    { t: /recommend|suggest|popular|signature|best (dish|food|item)|must.?try|special(ty|ity)?\b|what should (i|we) (eat|order|try|have)|kya (khayen|order)|confused what/i, f: function () {
      var pick = ['Chicken Karahi', 'Mutton Chops, 6 pcs', 'Chicken Biryani', 'Garlic Naan', 'Kunafa Nabulsia', 'Family Feast Gold'].map(function (n) { return INDEX.filter(function (i) { return i.name === n; })[0]; }).filter(Boolean);
      return r('Guest favourites to start with:<ul>' + pick.map(itemLine).join('') + '</ul>Going as a group? The <b>buffets</b> let you try a bit of everything.<br><small>' + esc(M.taxNote) + '</small>', ['Buffet prices', 'Takeaway & delivery', 'Book a table']); } },
    { t: /vegetarian|\bveg\b|spic(y|ier)|mild|halal|allerg|gluten|nut free|vegan|jain|ingredient|calorie|diet/i, f: function (q) {
      var hits = /vegetarian|vegan|\bveg\b/i.test(q) ? searchItems('vegetarian').filter(function (i) { return !/chicken|beef|mutton|lamb|fish|prawn|shrimp|meat|keema|kabab|seekh|boti|tikka/i.test(i.name + ' ' + i.desc); }) : [];
      return hits.length ? r('Some vegetarian-friendly dishes:<ul>' + hits.map(itemLine).join('') + '</ul>For allergies, spice level or special diets please call <b>' + PHONE + '</b> so the kitchen can confirm.', ['Contact details']) :
        r('For <b>allergies, spice level, ingredients or special diets</b> I do not want to guess, as the kitchen has the final word. Please call <b>' + PHONE + '</b> or email <b>' + EMAIL + '</b> and the team will confirm for you.', ['Contact details', 'View menu']); } },
    { t: /parking|valet|wifi|wi-?fi|dress ?code|prayer|namaz|smok|wheelchair|accessib|live music|music|ac\b|air.?condition|toilet|washroom|high ?chair/i, f: function () { return r('I do not have confirmed details on that yet. Please call <b>' + PHONE + '</b> or email <b>' + EMAIL + '</b> and the team will happily help.', ['Contact details', 'Opening hours']); } },
    { t: /who are you|your name|are you (a )?(bot|human|real|ai)|what can you do/i, f: function () { return r('I am the <b>Riwayat Assistant</b>. I can help with the <b>menu and prices</b>, <b>buffets</b>, <b>hours</b>, <b>seating</b>, <b>celebration themes</b>, <b>table bookings</b> and <b>takeaway</b>.', CHIPS_MAIN); } },
    { t: /how are you|kya haal|kaise ho|what'?s up|sup\b/i, f: function () { return r('Doing well, thank you, and ready to talk food! Would you like a recommendation, the buffet prices, or to book a table?', ['What should I try?', 'Buffet prices', 'Book a table']); } },
    { t: /joke|funny|mazahiya|لطیفہ/i, f: function () { return r('Why did the biryani get invited to every party? Because it always brings the whole <i>dum</i> crowd together. 😄 Now, shall I suggest something tasty?', ['What should I try?', 'Buffet prices']); } },
    { t: /gst|tax|delivery (fee|charge)|charges|service charge/i, f: function () { return r('Menu prices <b>exclude GST</b>. At the bill we add <b>' + GST + '% GST</b>, plus a <b>' + money(DELIVERY) + '</b> delivery fee for delivery orders.', ['Takeaway & delivery']); } },
    { t: /deliver|takeaway|take away|pick ?up|order|parcel|home delivery|ghar par/i, f: function (q) {
        if (/^takeaway & delivery$/i.test(q) || /\bhow\b|process|steps|kaise|do you|does|can you|areas?\b|available|hoti|policy/i.test(q)) return r('You can order for <b>pickup</b> or <b>delivery</b> (delivery fee ' + money(DELIVERY) + ', plus ' + GST + '% GST). I can take your order right here in the chat, or you can use the full page: ' + ACT.take + '<br>Your order goes straight to the restaurant when you confirm. No online payment is taken on the website.', ['Place an order', 'GST & delivery fee', 'View menu']);
        return startOrder(q); } },
    { t: /pay|card|cash|jazzcash|easypaisa|checkout/i, f: function () { return r('No online payment is taken on this website. Please call <b>' + PHONE + '</b> to ask about payment methods.', ['Takeaway & delivery', 'Book a table']); } },
    { t: /pdf|download|printable/i, f: function () { return r('Use the <b>Download Menu (PDF)</b> button on the ' + link(menuHref, 'Menu page') + ' to save or print the full menu.'); } },
    { t: /gallery|photo|picture|image|pics/i, f: function () { return r('Take a look at our ' + link(galleryHref, 'photo gallery') + ' — the main dining hall, courtyard, rooftop, live kitchens and more.'); } },
    { t: /buffet|dinner|hi-?tea|brunch|breakfast|eat as much/i, f: function (q) { return buffetReply(q); } },
    { t: /feast|platter|combo|mandi|sharing|banquet|whole lamb/i, f: function (q) { return categoryReply(cat('feasts'), q); } },
    { t: /starter|soup|appetizer|mezze|wings/i, f: function (q) { return categoryReply(cat('starters'), q); } },
    { t: /dessert|mithai|sweet|kheer|kunafa|cake|ice cream|meetha|میٹھ/i, f: function (q) { return categoryReply(cat('dessert'), q); } },
    { t: /drink|beverage|juice|lassi|coffee|shake|مشروب/i, f: function (q) { return categoryReply(cat('drinks'), q); } },
    { t: /naan|roti|bread|kulcha|paratha/i, f: function (q) { return categoryReply(cat('naan'), q); } },
    { t: /chinese|chowmein|manchurian|noodle/i, f: function (q) { return categoryReply(cat('chinese'), q); } },
    { t: /continental|burger|sandwich|steak|pizza|pasta|lasagna/i, f: function (q) { return categoryReply(cat('conti'), q); } },
    { t: /arabic|shawarma|hummus|falafel/i, f: function (q) { return categoryReply(cat('arabic'), q); } },
    { t: /desi|karahi|handi|biryani|bbq|tikka|nihari|haleem|sajji/i, f: function (q) { var hits = searchItems(q); return hits.length && /karahi|handi|biryani|tikka|nihari|haleem|sajji|boti|kabab/i.test(q) ? null : categoryReply(cat('desi'), q); } },
    { t: /\bmenu\b|what do you (have|serve)|categories|dishes|serve|cuisine/i, f: function () { return r('Our menu has <b>' + INDEX.length + ' dishes</b> across: ' + M.categories.map(function (c) { return esc(c.name); }).join(', ') + ' — plus <b>4 buffets</b>.<br>' + link(menuHref, 'Open the menu →') + '<br>Ask me about any dish or price!', ['Buffet prices', 'Desi dishes', 'Desserts', 'Takeaway & delivery']); } }
  ];

  function reply(q, noFix) {
    if (F) return flowReply(q);
    if (O) return orderReply(q);
    for (var i = 0; i < RULES.length; i++) {
      if (RULES[i].t.test(q)) { var out = RULES[i].f(q); if (out) return out; }
    }
    var hits = searchItems(q);
    if (hits.length) lastHits = hits.slice(0, 3);
    else if (!noFix) { var fq = fixTypos(q); if (fq !== q.toLowerCase()) return reply(fq, true); }
    if (hits.length) return r('Here is what I found:<ul>' + hits.map(itemLine).join('') + '</ul><small>' + esc(M.taxNote) + '</small>', ['Takeaway & delivery', 'View menu']);
    return r('Sorry, I am not sure about that. I can help with <b>menu & prices</b>, <b>buffets</b>, <b>opening hours</b>, <b>location</b>, <b>seating</b>, <b>booking</b> and <b>takeaway / delivery</b>. For anything else, call <b>' + PHONE + '</b>.', CHIPS_MAIN);
  }
  function themeReply(q) {
    var P = window.RIWAYAT_PARTIES; if (!P) return null;
    var all = [], l = q.toLowerCase();
    ['birthday', 'engagement'].forEach(function (k) { P[k].themes.forEach(function (t) { all.push({ k: k, t: t }); }); });
    if (/^(birthday|engagement) themes?$/.test(l)) {
      var k = l.split(' ')[0];
      return r('<b>' + esc(P[k].title) + '</b> — free décor, 4 themes:<ul>' + P[k].themes.map(function (t) { return '<li><b>' + esc(t.name) + '</b> — ' + esc(t.tagline) + (t.min ? ' (min. ' + esc(t.min) + ' guests)' : '') + '</li>'; }).join('') + '</ul>' + link(onOrderPage ? 'index.html#celebrations' : '#celebrations', 'See photos →'), ['Contact details']);
    }
    var hit = all.filter(function (x) { return l.indexOf(x.t.name.toLowerCase()) >= 0; })[0];
    if (!hit) return null;
    return r('<b>' + esc(hit.t.name) + '</b> (' + (hit.k === 'birthday' ? 'Birthday' : 'Engagement') + ' theme) — <i>' + esc(hit.t.tagline) + '</i><br>' + (hit.t.desc ? esc(hit.t.desc) + '<br>' : '') + 'Includes: ' + hit.t.features.map(esc).join(', ') + '.' + (hit.t.min ? '<br>Minimum guests: <b>' + esc(hit.t.min) + '</b>.' : '<br>Call <b>' + PHONE + '</b> for the minimum guest count.') + '<br>' + link(onOrderPage ? 'index.html#celebrations' : '#celebrations', 'See photos →'), ['Contact details']);
  }
  var CHIP_MAP = { 'Place an order': 'place an order', 'Birthday themes': 'birthday themes', 'Engagement themes': 'engagement themes', 'Download menu': 'download pdf menu', 'View menu': 'menu', 'Other buffets': 'buffets', 'Dinner buffet': 'dinner buffet', 'Hi-Tea buffet': 'hi-tea buffet', 'Sunday brunch': 'sunday brunch buffet', 'Desi dishes': 'desi', 'Contact details': 'contact phone', 'What should I try?': 'recommend something' };

  /* ---------- UI ---------- */
  var root = document.createElement('div'); root.className = 'chat-root';
  root.innerHTML = '<button class="chat-fab" id="chatFab" aria-label="Open Riwayat Assistant" aria-expanded="false"><svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true"><path fill="currentColor" d="M4 3h16a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H9l-5 4v-4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"/></svg><span class="chat-fab-t">Ask Riwayat</span></button>' +
    '<section class="chat-panel" id="chatPanel" role="dialog" aria-label="Riwayat Assistant" hidden>' +
    '<header class="chat-head"><div><b>Riwayat Assistant</b><small>روایت · Online assistant</small></div><button class="chat-x" id="chatX" aria-label="Close chat">×</button></header>' +
    '<div class="chat-log" id="chatLog" role="log" aria-live="polite"></div><div class="chat-chips" id="chatChips"></div>' +
    '<form class="chat-form" id="chatForm" autocomplete="off"><input id="chatIn" type="text" placeholder="Ask about menu, prices, booking…" aria-label="Your message" maxlength="200"><button type="submit" aria-label="Send">➤</button></form></section>';
  document.body.appendChild(root);

  var fab = document.getElementById('chatFab'), panel = document.getElementById('chatPanel'), log = document.getElementById('chatLog'),
      chips = document.getElementById('chatChips'), form = document.getElementById('chatForm'), input = document.getElementById('chatIn'), started = false;

  function add(who, html, isHtml) {
    var d = document.createElement('div'); d.className = 'msg ' + who;
    if (isHtml) d.innerHTML = html; else d.textContent = html;
    log.appendChild(d); log.scrollTop = log.scrollHeight; return d;
  }
  function setChips(list) {
    chips.innerHTML = ''; (list || []).forEach(function (c) { var b = document.createElement('button'); b.type = 'button'; b.textContent = c; b.addEventListener('click', function () { send(c); }); chips.appendChild(b); });
  }
  function send(text) {
    text = text.trim(); if (!text) return;
    add('user', text, false); setChips([]);
    var typing = add('bot typing', '<span></span><span></span><span></span>', true);
    setTimeout(function () {
      typing.remove();
      var res = reply(CHIP_MAP[text] || text), show = function (x) { x = x || r('Sorry, something went wrong. Please call ' + PHONE + '.', CHIPS_MAIN); add('bot', x.html, true); setChips(x.chips); lastOffer = (x.chips || []).indexOf('Book a table') >= 0 ? 'book' : ''; };
      if (res && typeof res.then === 'function') res.then(show); else show(res);
    }, 450);
  }
  function open() {
    panel.hidden = false; fab.setAttribute('aria-expanded', 'true'); root.classList.add('open');
    if (!started) { started = true; var g = reply('hello'); add('bot', g.html, true); setChips(g.chips); }
    setTimeout(function () { input.focus(); }, 50);
  }
  function close() { panel.hidden = true; fab.setAttribute('aria-expanded', 'false'); root.classList.remove('open'); fab.focus(); }
  /* thank-you message after an order or booking is confirmed on the order page */
  window.addEventListener('riwayat:placed', function (e) {
    var o = e.detail || {}, isRes = o.kind === 'reservation' || /^RV-/.test(o.id || ''), det = o.details || {}, nm = String(isRes ? o.name : det.name).trim().split(/\s+/)[0] || '', html;
    if (isRes) html = 'Thank you' + (nm ? ', ' + esc(nm) : '') + '! 🎉 Your table request <b>' + esc(o.id) + '</b> for <b>' + esc(fmtD(o.date)) + '</b> at <b>' + fmtT(o.time) + '</b> has reached us. Our team will confirm it shortly. We look forward to welcoming you at Riwayat.';
    else html = 'Thank you' + (nm ? ', ' + esc(nm) : '') + '! 🎉 Your order <b>' + esc(o.id) + '</b> has been received and the kitchen has been notified.' + (o.eta && o.eta.value ? '<br>' + esc(o.eta.title || 'Estimated time') + ': <b>' + esc(o.eta.value) + '</b>.' : '') + '<br>Thank you for choosing Riwayat!';
    if (!started) { started = true; }
    add('bot', html + '<br><small>Ask me “check my ' + (isRes ? 'booking' : 'order') + ' status” any time.</small>', true);
    setChips([isRes ? 'Check my booking status' : 'Check my order status', 'Opening hours']);
    if (panel.hidden) { if (window.innerWidth >= 700) open(); else fab.classList.add('has-new'); }
  });
  fab.addEventListener('click', function () { fab.classList.remove('has-new'); panel.hidden ? open() : close(); });
  document.getElementById('chatX').addEventListener('click', close);
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !panel.hidden) close(); });
  form.addEventListener('submit', function (e) { e.preventDefault(); var v = input.value; input.value = ''; send(v); });
  log.addEventListener('click', function (e) { if (e.target.closest('a')) { if (window.innerWidth < 700) close(); } });
})();
