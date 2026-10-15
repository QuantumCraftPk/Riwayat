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

  /* ---------- language: reply in the customer's language (English or Roman Urdu) ---------- */
  var LANG = 'en';
  function L(en, ru) { return LANG === 'ru' && ru != null ? ru : en; }
  var RU_STRONG = /\b(kya|kia|hai|hain|hoon|mujhe|mujhay|mera|meri|mere|aap|apka|aapka|nahi|nahin|haan|jee|chahiye|chahye|chahiyay|karna|karni|karni|karo|karein|karen|kijiye|kitna|kitne|kitni|kab|kahan|kidhar|kaise|kese|kyun|bhai|bhi|aur|wala|wali|baje|khana|khane|dena|dijiye|bata|batao|batain|btao|shukriya|mehrbani|meherbani|zaroor|bilkul|acha|accha|theek|thik|abhi|jaldi|ghar|naam|raha|rahi|sakta|sakti|sakte|mangwa|mangwana|mangwani|koi|kuch|bohat|bahut|salam|assalam|aoa|aaj|kal|chaiye|lagta|milega|milti|milta|hoga|hogi|karwana|bhejo|bhej|dikhao|dikhayen|dikhaye|pasand|waqt|khulta|khulte|band|bachay|bachon|bache|log|afraad|mehman|ap|ha|kaya|naam|kon|kaun|tumhara|apka)\b/gi;
  var EN_COMMON = /\b(the|is|are|what|how|where|when|you|your|for|and|please|want|would|like|order|book|table|menu|price|open|do|can|have|this|that|with|about)\b/gi;
  function detectLang(t) {
    if (/[؀-ۿ]/.test(t)) return 'ru';
    var s = (t.match(RU_STRONG) || []).length, e = (t.match(EN_COMMON) || []).length;
    if (s >= 1 && s >= e) return 'ru';
    if (e >= 2 && s === 0) return 'en';
    return null;
  }
  var CHIP_RU = {
    'Takeaway order': 'Order karna hai', 'Book a table': 'Table book karni hai', 'Get information': 'Maloomat chahiye',
    'What should I try?': 'Kya try karun?', 'Opening hours': 'Khulne ka waqt', 'Location': 'Pata / location', 'Contact details': 'Rabta number',
    'Buffet prices': 'Buffet ki qeemat', 'Seating options': 'Baithne ki jagah', 'Place an order': 'Order karna hai',
    'Pickup': 'Pickup', 'Delivery': 'Delivery', 'Add more items': 'Aur items shamil karein', 'Checkout': 'Checkout / bill',
    'Yes, place order': 'Haan, order kar dein', 'Yes, confirm': 'Haan, confirm karein', 'Cancel': 'Cancel karein',
    'Today': 'Aaj', 'Tomorrow': 'Kal', 'No kids': 'Koi bacha nahi', 'More dishes': 'Aur dishes', 'Change category': 'Category badlein',
    'Show cart': 'Cart dikhayein', 'Clear cart': 'Cart khali karein', 'View menu': 'Menu dekhein',
    'Check my order status': 'Order ka status', 'Check my booking status': 'Booking ka status', 'None': 'Koi nahi',
    'Other buffets': 'Doosre buffets', 'GST & delivery fee': 'GST aur delivery fee', 'Back': 'Wapis',
    'Birthday themes': 'Birthday themes', 'Engagement themes': 'Engagement themes', 'Buffets': 'Buffets'
  };
  var CHIP_REV = {}; Object.keys(CHIP_RU).forEach(function (k) { CHIP_REV[CHIP_RU[k].toLowerCase()] = k; });
  function canon(t) { return CHIP_REV[t.trim().toLowerCase()] || t; }
  function chipText(c) { return LANG === 'ru' && CHIP_RU[c] ? CHIP_RU[c] : c; }
  var CHIPS_MAIN = ['Takeaway order', 'Book a table', 'Get information'];
  var CHIPS_INFO = ['What should I try?', 'Opening hours', 'Location', 'Contact details', 'Buffet prices', 'Seating options'];

  /* ---------- searchable menu index ---------- */
  var INDEX = [];
  M.categories.forEach(function (c) { c.groups.forEach(function (g) { g.items.forEach(function (it) {
    INDEX.push({ name: it.name, desc: it.desc || '', cat: c.name, price: it.price, variants: it.variants, preorder: it.preorder, soldOut: it.soldOut });
  }); }); });
  var STOP = 'what whats is are the a an of in on to for you your do does have has any tell me about price prices cost costs much how many much rs rupees menu please can i we get want like show give there with and or it its my our the options option available ka ki ke ko se mein mai hai hain ha kya kaya kia ap aap apka aapka name naam kon kaun ho hoon tum tumhara'.split(' ');
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
    return '<li><b>' + esc(it.name) + '</b> — ' + p + (it.soldOut ? ' <i>' + L('(sold out today)', '(aaj sold out)') + '</i>' : '') + (it.desc ? '<br><small>' + esc(it.desc) + '</small>' : '') + '</li>';
  }

  /* ---------- replies ---------- */
  function r(html, chips) { return { html: html, chips: chips }; }
  var ACT = {
    book: link('order.html?start=dine', 'Book a table →'),
    take: link('order.html?start=takeaway', 'Start a takeaway order →')
  };

  function buffetReply(q) {
    var sel = M.buffets.filter(function (b) { return new RegExp(b.id.replace('-', '[- ]?') + '|' + b.name.split(' ')[0].toLowerCase(), 'i').test(q) && !/^buffets?$/i.test(b.name.split(' ')[0]); });
    if (/dinner|hi-?tea|breakfast|brunch/i.test(q) && sel.length) {
      var b = sel[0];
      return r('<b>' + esc(b.name) + '</b> · ' + money(b.pricePerPerson) + L(' per person', ' fi kas') + '<br>' + esc(b.days) + ' · ' + b.times.map(esc).join(' / ') + (b.kidsNote.length ? '<br>' + esc(b.kidsNote.join(' ')) : '') +
        '<br><br>' + L('Includes: ', 'Shamil hai: ') + '' + b.sections.map(function (s) { return '<b>' + esc(s.name) + '</b> (' + s.dishes.slice(0, 4).map(esc).join(', ') + (s.dishes.length > 4 ? '…' : '') + ')'; }).join('; ') + '.<br><br>' + ACT.book, ['Other buffets', 'Book a table']);
    }
    return r(L('Our buffets (price per person). ', 'Hamare buffets (fi kas qeemat). ') + esc(M.taxNote) + '<ul>' + M.buffets.map(function (b) { return '<li><b>' + esc(b.name) + '</b> — ' + money(b.pricePerPerson) + '<br><small>' + esc(b.days) + ' · ' + b.times.map(esc).join(' / ') + '</small></li>'; }).join('') + '</ul>' + L('Ask about any one (e.g. “what’s in the dinner buffet?”).', 'Kisi ek ke baare mein poochhein (misal: “dinner buffet mein kya hai?”).'), ['Dinner buffet', 'Hi-Tea buffet', 'Sunday brunch', 'Book a table']);
  }
  function categoryReply(c, q) {
    if (q) { var hits = searchItems(q); if (hits.length && lastBest >= 6) return r(L('Here is what I found:', 'Ye mila:') + '<ul>' + hits.map(itemLine).join('') + '</ul><small>' + esc(M.taxNote) + '</small>', ['Place an order', 'Book a table']); }
    var names = c.groups.map(function (g) { return esc(g.name); }).join(', ');
    var sample = []; c.groups.forEach(function (g) { if (sample.length < 4) sample.push(g.items[0]); });
    return r('<b>' + esc(c.name) + '</b> — ' + esc(c.subtitle) + '.<br>' + L('Sections: ', 'Hisse: ') + names + '.<ul>' + sample.map(function (it) { return itemLine({ name: it.name, desc: it.desc, price: it.price, variants: it.variants }); }).join('') + '</ul>' + link(menuHref, L('See the full menu →', 'Poora menu dekhein →')), ['Place an order', 'Buffet prices']);
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
    if (ds < d) return r(L('That date has already passed.', 'Ye tareekh guzar chuki hai.'), ['Opening hours']);
    var h = hoursFor(ds), cr = closedReason(ds);
    if (cr) return r(L('Sorry, ' + cr + '. Please pick another day.', 'Maaf kijiye, ' + cr + '. Barae meherbani koi aur din chunein.'), ['Book a table', 'Opening hours']);
    return r(L('On <b>' + fmtD(ds) + '</b> we are open <b>' + fmtT(h.open) + ' to ' + fmtT(h.close) + '</b>.', '<b>' + fmtD(ds) + '</b> ko hum <b>' + fmtT(h.open) + ' se ' + fmtT(h.close) + '</b> tak khule hain.'), ['Book a table', 'Buffet prices']);
  }
  function closuresNote() {
    var t = ymd(new Date()), parts = [];
    if ((BK.closedWeekdays || []).length) parts.push(L('closed on ', 'band: ') + BK.closedWeekdays.map(function (i) { return WDN[i] + 's'; }).join(', '));
    (BK.closedDates || []).filter(function (x) { return x.date >= t; }).sort(function (a, b) { return a.date < b.date ? -1 : 1; }).slice(0, 5).forEach(function (x) { parts.push(fmtD(x.date) + (x.note ? ' (' + x.note + ')' : '')); });
    return parts.length ? '<br><b>' + L('Please note:', 'Barae meherbani note karein:') + '</b> ' + parts.map(esc).join('; ') + '.' : '';
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
  var ST_RU = { 'Received': 'Mausool ho gaya', 'Accepted': 'Qabool ho gaya', 'Being prepared': 'Tayyar ho raha hai', 'Ready': 'Tayyar hai', 'Completed': 'Mukammal', 'Cancelled': 'Cancel', 'Awaiting confirmation': 'Confirmation ka intezar', 'Confirmed': 'Confirm ho gayi', 'Could not be accommodated': 'Maafi, jagah nahi mil saki' };
  function statusReply(q) {
    var rec = lastRecord(q);
    if (!rec) return r(L('I could not find a booking or order made on this device. If you have a reference like <b>RV-…</b> or <b>RW-…</b>, please call <b>' + PHONE + '</b>.', 'Is device par koi booking ya order nahi mila. Agar aap ke paas <b>RV-…</b> ya <b>RW-…</b> reference hai to barae meherbani <b>' + PHONE + '</b> par call karein.'), ['Contact details']);
    if (!window.RiwayatSync || !RiwayatSync.available()) return r(L('I cannot check the status right now. Please call <b>' + PHONE + '</b>.', 'Abhi status check nahi ho sakta. Barae meherbani <b>' + PHONE + '</b> par call karein.'), ['Contact details']);
    var kind = /^RV-/.test(rec.id) ? 'reservation' : 'order';
    return RiwayatSync.status(kind, rec.token).then(function (st) {
      var txt = st ? RiwayatSync.statusText(kind, st) : L('not found', 'nahi mila'); if (LANG === 'ru' && ST_RU[txt]) txt = ST_RU[txt];
      return r('<b>' + esc(rec.id) + '</b> (' + (kind === 'order' ? L('takeaway order', 'takeaway order') : L('table booking', 'table booking')) + '): <b>' + esc(txt) + '</b>.', ['Opening hours', 'Contact details']);
    }, function () { return r(L('I could not reach the restaurant just now. Please try again in a moment or call <b>' + PHONE + '</b>.', 'Abhi restaurant se rabta nahi ho saka. Thori der baad dobara koshish karein ya <b>' + PHONE + '</b> par call karein.'), ['Contact details']); });
  }
  var CANCEL_RE = /\bcancel\b|\bstop\b|never ?mind|rehne do|chor do|chhor do|\bquit\b|band karo|nahi karna/i;

  /* ---------- booking inside the chat ---------- */
  var F = null, CUISINES = [['desi', 'Desi', /desi|pakistani|bbq/], ['arabic', 'Arabic', /arab/], ['continental', 'Continental', /conti|western|italian/], ['chinese', 'Chinese', /chin/], ['buffet', 'Buffet', /buffet/], ['mix', 'Mix', /mix|everything|all|sab/], ['undecided', 'Not decided yet', /not decided|undecided|don.?t know|dont know|any|not sure|decide|pata nahi|abhi nahi/]];
  var SEATS = [['vvip', 'VVIP Hall', /vvip|private/], ['indoor', 'Indoor', /indoor|inside|main|hall|\bac\b|andar/], ['terrace', 'Terrace', /terrace/], ['lawn', 'Lawn', /lawn|garden|courtyard/], ['rooftop', 'Roof Top', /roof|chhat|chat/]];
  var NUMW = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, ek: 1, do: 2, teen: 3, char: 4, chaar: 4, panch: 5, paanch: 5, chhe: 6, che: 6, saat: 7, aath: 8, nau: 9, das: 10 };
  function numIn(q) { var m = q.match(/\d+/); if (m) return +m[0]; var w = q.toLowerCase().split(/\W+/).filter(function (x) { return NUMW[x]; })[0]; return w ? NUMW[w] : null; }
  function pick(list, q) { q = q.toLowerCase(); return list.filter(function (x) { return x[2].test(q); })[0] || null; }
  var YES_RE = /^(yes|confirm|ok|okay|haan|han|ji|jee|yep|sure|done|send|place|theek|thik|bilkul|kar do|kar dein)/i, NO_RE = /^(no|nahi|nahin|nope)/i;
  function startFlow() {
    O = null; F = { step: 'date', d: { kids: [] } }; lastOffer = '';
    return r(L('Happy to book a table for you. Which <b>date</b>? You can say “tomorrow”, “Friday” or “25 Oct”. (Type “cancel” any time to stop.)', 'Zaroor, main aap ke liye table book kar deta hoon. Kis <b>tareekh</b> ke liye? Aap “kal”, “Friday” ya “25 Oct” likh sakte hain. (Rokne ke liye kisi bhi waqt “cancel” likhein.)'), ['Today', 'Tomorrow']);
  }
  function timeChips(sl) { var out = [], pref = [780, 1140, 1200, 1260]; pref.forEach(function (m) { if (sl.indexOf(m) >= 0) out.push(fmtT(m)); }); if (!out.length) sl.slice(0, 4).forEach(function (m) { out.push(fmtT(m)); }); return out; }
  function parseTime(q, sl) {
    var m = q.toLowerCase().match(/(\d{1,2})(?:[:.](\d{2}))?\s*(a\.?m\.?|p\.?m\.?)?/); if (!m) return null;
    var h = +m[1], mi = +(m[2] || 0), suf = m[3] ? m[3][0] : '', cands = [];
    if (/raat|sham|shaam|evening|night/.test(q.toLowerCase()) && !suf) suf = 'p'; else if (/subah|subha|morning/.test(q.toLowerCase()) && !suf) suf = 'a';
    if (h > 24 || mi > 59) return null;
    if (suf === 'p') cands.push(h % 12 + 12); else if (suf === 'a') cands.push(h % 12); else if (h >= 13) cands.push(h); else cands.push(h % 12 + 12, h % 12);
    for (var i = 0; i < cands.length; i++) { var t = cands[i] * 60 + mi; if (sl.indexOf(t) >= 0) return t; }
    return null;
  }
  var CUI_RU = { 'Not decided yet': 'Abhi tay nahi' };
  function summary(d) {
    var n = d.adults + d.kids.length, c = CUISINES.filter(function (x) { return x[0] === d.cuisine; })[0], s = SEATS.filter(function (x) { return x[0] === d.seating; })[0];
    return '<ul><li><b>' + fmtD(d.date) + '</b> ' + L('at', 'ko') + ' <b>' + fmtT(d.time) + '</b></li><li>' + n + L(n === 1 ? ' guest' : ' guests', ' mehman') + ' (' + d.adults + L(' adults', ' balig') + (d.kids.length ? ', ' + d.kids.length + L(' kids aged ', ' bachay, umar ') + d.kids.map(function (a) { return a === 0 ? L('under 1', '1 saal se kam') : a; }).join(', ') : '') + ')</li><li>' + (LANG === 'ru' && CUI_RU[c[1]] ? CUI_RU[c[1]] : c[1]) + ' · ' + s[1] + (d.seating === 'vvip' ? ' (' + money(VVIP) + L(' additional', ' izafi') + ')' : '') + '</li><li>' + esc(d.name) + ' · ' + esc(d.phone) + '</li></ul>';
  }
  function cuisineQ(pre) { return r((pre || '') + L('What kind of <b>cuisine</b> would you like?', 'Aap kis qisam ka <b>khana</b> pasand karenge?'), CUISINES.map(function (z) { return z[1]; })); }
  function flowReply(q) {
    var d = F.d, t = q.trim(), x, n;
    if (CANCEL_RE.test(t)) { F = null; return r(L('No problem, I have cancelled the booking. Anything else I can help with?', 'Koi masla nahi, booking cancel kar di. Kuch aur madad chahiye?'), CHIPS_MAIN); }
    switch (F.step) {
      case 'date':
        x = parseDate(t); if (!x) return r(L('Sorry, I did not get the date. Try “tomorrow”, “Friday” or “25 Oct”.', 'Maaf kijiye, tareekh samajh nahi aayi. “kal”, “Friday” ya “25 Oct” likh kar dekhein.'), ['Today', 'Tomorrow']);
        var last = new Date(); last.setDate(last.getDate() + ADV);
        if (x < ymd(new Date())) return r(L('That date has already passed. Which day would you like?', 'Ye tareekh guzar chuki hai. Kaun sa din chahiye?'), ['Today', 'Tomorrow']);
        if (x > ymd(last)) return r(L('We take bookings up to ' + ADV + ' days ahead. Please pick an earlier date.', 'Hum ' + ADV + ' din tak aage ki booking lete hain. Barae meherbani is se pehle ki tareekh chunein.'), ['Today', 'Tomorrow']);
        if (closedReason(x)) return r(L('Sorry, ' + closedReason(x) + '. Please pick another day.', 'Maaf kijiye, ' + closedReason(x) + '. Barae meherbani koi aur din chunein.'), ['Today', 'Tomorrow']);
        F.sl = slotsFor(x); if (!F.sl.length) return r(L('There are no table times left on ' + fmtD(x) + '. Please pick another day.', fmtD(x) + ' ko koi waqt baqi nahi. Barae meherbani koi aur din chunein.'), ['Tomorrow']);
        d.date = x; F.step = 'time';
        return r('<b>' + fmtD(x) + '</b>. ' + L('We seat guests from <b>' + fmtT(F.sl[0]) + '</b> to <b>' + fmtT(F.sl[F.sl.length - 1]) + '</b>. What time would you like? (e.g. 8 pm)', 'Hum <b>' + fmtT(F.sl[0]) + '</b> se <b>' + fmtT(F.sl[F.sl.length - 1]) + '</b> tak mehman bithate hain. Aap kis waqt aana chahenge? (misal: 8 pm)'), timeChips(F.sl));
      case 'time':
        x = parseTime(t, F.sl);
        if (x == null) return r(L('I could not match that to a table time. Times run every 30 minutes from ' + fmtT(F.sl[0]) + ' to ' + fmtT(F.sl[F.sl.length - 1]) + ' (for example 8:00 pm or 8:30 pm).', 'Ye waqt table ke waqt se match nahi hua. Waqt har 30 minute baad ' + fmtT(F.sl[0]) + ' se ' + fmtT(F.sl[F.sl.length - 1]) + ' tak hain (misal: 8:00 pm ya 8:30 pm).'), timeChips(F.sl));
        d.time = x; F.step = 'adults'; return r(L('How many <b>adults</b> will be dining? (Online bookings up to ' + MAXP + ' guests.)', 'Kitne <b>bade (adults)</b> aayenge? (Online booking ' + MAXP + ' mehmanon tak.)'), ['2', '4', '6']);
      case 'adults':
        n = numIn(t); if (!n || n < 1) return r(L('Please tell me the number of adults, for example 4.', 'Barae meherbani bade afraad ki tadaad likhein, jaise 4.'), ['2', '4', '6']);
        if (n > MAXP) return r(L('Online bookings are limited to ' + MAXP + ' guests. For larger groups please call <b>' + PHONE + '</b>.', 'Online booking sirf ' + MAXP + ' mehmanon tak hai. Bare groups ke liye <b>' + PHONE + '</b> par call karein.'), ['2', '4', '6']);
        d.adults = n; F.step = 'kids'; return r(L('Any <b>kids</b> (up to 12 years)? Say “none” or a number.', 'Koi <b>bachay</b> (12 saal tak)? “koi nahi” ya tadaad likhein.'), ['No kids', '1', '2', '3']);
      case 'kids':
        n = /^(no|none|nil|nahi|nahin|koi nahi|zero|koi bacha nahi)/i.test(t) ? 0 : numIn(t);
        if (n == null) return r(L('Please say “none” or the number of kids.', '“koi nahi” ya bachon ki tadaad likhein.'), ['No kids', '1', '2', '3']);
        if (d.adults + n > MAXP) return r(L('That makes more than ' + MAXP + ' guests. For larger groups please call <b>' + PHONE + '</b>, or give me a smaller number of kids.', 'Is se mehman ' + MAXP + ' se zyada ho jate hain. Bare groups ke liye <b>' + PHONE + '</b> par call karein, ya bachon ki tadaad kam batayein.'), ['No kids', '1', '2']);
        if (n > 10) return r(L('Please call <b>' + PHONE + '</b> for that many children.', 'Itne bachon ke liye <b>' + PHONE + '</b> par call karein.'), ['No kids']);
        if (!n) { d.kids = []; F.step = 'cuisine'; return cuisineQ(); }
        F.nk = n; F.step = 'ages'; return r(L('Please tell me the age of ' + (n === 1 ? 'the child' : 'each of the ' + n + ' children') + ', for example “4” or “4 and 7”. Use 0 for under 1.', (n === 1 ? 'Bachay' : n + ' bachon') + ' ki umar bata dein, jaise “4” ya “4 aur 7”. 1 saal se kam ke liye 0 likhein.'));
      case 'ages':
        var nums = t.toLowerCase().replace(/under\s*1|infant|baby/g, '0').match(/\d+/g) || [];
        if (nums.length !== F.nk || nums.some(function (a) { return +a > 12; })) return r(L('I need exactly ' + F.nk + (F.nk === 1 ? ' age' : ' ages') + ', each from 0 to 12 (for example “4 and 7”).', 'Mujhe bilkul ' + F.nk + ' umar chahiye, har ek 0 se 12 ke darmiyan (misal: “4 aur 7”).'));
        d.kids = nums.map(Number); F.step = 'cuisine'; return cuisineQ();
      case 'cuisine':
        x = pick(CUISINES, t); if (!x) return cuisineQ(L('Sorry, I did not catch that. ', 'Maaf kijiye, samajh nahi aaya. '));
        d.cuisine = x[0]; F.step = 'seating'; return r(L('Where would you like to sit?<ul><li><b>VVIP Hall</b> — private (' + money(VVIP) + ' additional)</li><li><b>Indoor</b>, <b>Terrace</b>, <b>Lawn</b> or <b>Roof Top</b></li></ul>', 'Aap kahan baithna pasand karenge?<ul><li><b>VVIP Hall</b> — private (' + money(VVIP) + ' izafi)</li><li><b>Indoor</b>, <b>Terrace</b>, <b>Lawn</b> ya <b>Roof Top</b></li></ul>'), SEATS.map(function (z) { return z[1]; }));
      case 'seating':
        x = pick(SEATS, t); if (!x) return r(L('Please choose one: VVIP Hall, Indoor, Terrace, Lawn or Roof Top.', 'Barae meherbani chunein: VVIP Hall, Indoor, Terrace, Lawn ya Roof Top.'), SEATS.map(function (z) { return z[1]; }));
        d.seating = x[0]; F.step = 'name'; return r(L('Almost done. What <b>name</b> should the booking be under?', 'Bas ho gaya. Booking kis <b>naam</b> se karni hai?'));
      case 'name':
        x = cleanName(t);
        if (!x) return r(L('Please type your name, for example “Sara Khan”.', 'Barae meherbani apna naam likhein, jaise “Sara Khan”.'));
        d.name = x; F.step = 'phone'; return r(L('Thank you, ' + esc(x) + '. What is your <b>mobile number</b>, so we can confirm the table? (e.g. 0300 1234567)', 'Shukriya, ' + esc(x) + '. Table confirm karne ke liye aap ka <b>mobile number</b> kya hai? (misal: 0300 1234567)'));
      case 'phone':
        if (!phoneOk(t)) return r(L('That does not look like a Pakistani mobile number. Please type it like 0300 1234567.', 'Ye Pakistani mobile number nahi lagta. Barae meherbani 0300 1234567 ki tarah likhein.'));
        d.phone = t.replace(/[\s-]/g, ''); F.step = 'confirm';
        return r(L('Please check your booking request:', 'Barae meherbani apni booking request check kar lein:') + summary(d) + L('Shall I send it to the restaurant?', 'Kya main ye restaurant ko bhej doon?'), ['Yes, confirm', 'Cancel']);
      case 'confirm':
        if (YES_RE.test(t)) return submitFlow();
        if (NO_RE.test(t)) { F = null; return r(L('Okay, I have not sent anything. Anything else I can help with?', 'Theek hai, kuch nahi bheja. Kuch aur madad chahiye?'), CHIPS_MAIN); }
        return r(L('Please press “Yes, confirm” to send your request, or “Cancel”.', 'Request bhejne ke liye “Haan, confirm karein” ya rokne ke liye “Cancel karein” dabayein.'), ['Yes, confirm', 'Cancel']);
    }
    F = null; return null;
  }
  function phoneOk(v) { return /^(\+?92|0)3\d{9}$/.test(String(v).replace(/[\s-]/g, '')); }
  function cleanName(t) { var x = t.replace(/^(my name is|i am|i'm|mera naam|mera name|name is|naam)\s+/i, '').replace(/\s+(hai|hain)$/i, '').trim(); return x.length < 2 || x.length > 60 || /\d{4}/.test(x) ? '' : x; }
  function submitFlow() {
    var d = F.d;
    if (!window.RiwayatSync || !RiwayatSync.available()) { F = null; return r(L('Sorry, I cannot send bookings from here right now. Please use the booking page: ', 'Maaf kijiye, abhi yahan se booking nahi bheji ja sakti. Barae meherbani booking page istemal karein: ') + ACT.book, ['Contact details']); }
    var rec = { kind: 'reservation', type: 'reservation', name: d.name, phone: d.phone, date: d.date, time: d.time, adults: d.adults, kids: d.kids.slice(), guests: d.adults + d.kids.length, cuisine: d.cuisine, seating: d.seating };
    rec.id = 'RV-' + ymd(new Date()).replace(/-/g, '').slice(2) + '-' + Math.floor(1000 + Math.random() * 9000); rec.placedAt = new Date().toISOString();
    return RiwayatSync.submit('reservation', rec).then(function (tok) {
      rec.token = tok; rec.status = 'new'; F = null;
      try { var all = JSON.parse(localStorage.getItem('riwayat_reservations') || '[]'); all.push(rec); localStorage.setItem('riwayat_reservations', JSON.stringify(all)); } catch (e) { /* ignore */ }
      return r(L('Your table request has been sent. Reference: <b>' + esc(rec.id) + '</b>.<br>Status: <b>Awaiting confirmation</b>. The team will confirm it, and you can ask me “check my booking status” any time.', 'Aap ki table request bhej di gayi hai. Reference: <b>' + esc(rec.id) + '</b>.<br>Status: <b>Confirmation ka intezar</b>. Hamari team confirm kar degi, aur aap kisi bhi waqt “booking ka status” poochh sakte hain.'), CHIPS_MAIN);
    }, function () { return r(L('I could not reach the restaurant just now, so nothing was sent. Please press “Yes, confirm” to try again.', 'Abhi restaurant se rabta nahi ho saka, is liye kuch nahi bheja gaya. Dobara koshish ke liye “Haan, confirm karein” dabayein.'), ['Yes, confirm', 'Cancel']); });
  }

  /* ---------- takeaway order inside the chat: type → category → dish → quantity → bill → details ---------- */
  var O = null, GSTR = (+GST || 0) / 100, OI = {}, BASE = [], PAGE = 10;
  var CATRX = { feasts: /feast|platter|banquet|royal|mandi|combo/, starters: /starter|soup|mezze|appetizer|wings/, desi: /desi|dastarkhwan|karahi|biryani|bbq|handi/, naan: /naan|roti|bread|paratha|kulcha/, arabic: /arab|majlis|shawarma/, conti: /conti|salon|pizza|pasta|burger|steak/, chinese: /chin|pavilion|noodle|manchurian/, dessert: /dessert|mithai|sweet|kheer|cake|ice ?cream|meetha/, drinks: /drink|beverage|juice|lassi|coffee|chai|shake/ };
  M.categories.forEach(function (c) { c.groups.forEach(function (g) { g.items.forEach(function (it) {
    var b = { id: it.id, name: it.name, cat: c.id, group: g.name, desc: it.desc || '', price: it.price, variants: it.variants && it.variants.length > 1 ? it.variants : null, preorder: !!it.preorder, soldOut: !!it.soldOut };
    BASE.push(b);
    if (b.variants) it.variants.forEach(function (v) { OI[it.id + '|' + v.label] = { key: it.id + '|' + v.label, name: it.name + ' (' + v.label + ')', price: v.price, preorder: b.preorder, soldOut: b.soldOut }; });
    else OI[it.id] = { key: it.id, name: it.name, price: it.price, preorder: b.preorder, soldOut: b.soldOut };
  }); }); });
  var CMD = /\b(place|an|the|order|orders|i|want|wanna|to|would|like|please|takeaway|take|away|delivery|pickup|food|can|could|get|me|a|my|start|make|new|for|some|add|give|chahiye|chahiye|chaiye|karna|karni|hai|mujhe|mujhay|kar|do|dena|karen|karein|ek|mangwana|mangwani|mangwao)\b/g;
  function priceOf(b) { return b.variants ? b.variants.map(function (v) { return v.label + ' ' + money(v.price); }).join(' / ') : money(b.price); }
  function cartLines() { return Object.keys(O.cart).filter(function (k) { return OI[k] && O.cart[k] > 0; }).map(function (k) { var i = OI[k]; return { key: k, name: i.name, price: i.price, kind: 'item', preorder: i.preorder, qty: O.cart[k], total: i.price * O.cart[k] }; }); }
  function cartTotals() {
    var ls = cartLines(), sub = ls.reduce(function (a, l) { return a + l.total; }, 0), gst = Math.round(sub * GSTR), del = O.type === 'delivery' && sub > 0 ? DELIVERY : 0;
    return { sub: sub, gst: gst, del: del, total: sub + gst + del };
  }
  function cartHtml(full) {
    var ls = cartLines(), t = cartTotals();
    if (!ls.length) return L('Your cart is empty.', 'Aap ka cart khali hai.');
    var h = '<ul>' + ls.map(function (l) { return '<li>' + l.qty + ' × ' + esc(l.name) + ' — ' + money(l.total) + (l.preorder ? ' <small>' + L('(pre-order)', '(pre-order)') + '</small>' : '') + '</li>'; }).join('') + '</ul>';
    if (!full) return h + L('Subtotal', 'Subtotal') + ': <b>' + money(t.sub) + '</b>';
    return h + L('Subtotal', 'Subtotal') + ' ' + money(t.sub) + '<br>GST (' + GST + '%) ' + money(t.gst) + (t.del ? '<br>' + L('Delivery fee', 'Delivery fee') + ' ' + money(t.del) : '') + '<br><b>' + L('Total', 'Kul raqam') + ' ' + money(t.total) + '</b>';
  }
  function catById(id) { return M.categories.filter(function (c) { return c.id === id; })[0]; }
  function catBases(id) { return BASE.filter(function (b) { return b.cat === id; }); }
  function matchCategory(t) {
    var s = t.toLowerCase().trim(), n = /^\d{1,2}$/.test(s) ? +s : 0;
    if (n && M.categories[n - 1]) return M.categories[n - 1];
    var exact = M.categories.filter(function (c) { return c.name.toLowerCase() === s; })[0]; if (exact) return exact;
    var hit = M.categories.filter(function (c) { return CATRX[c.id] && CATRX[c.id].test(s) && s.split(/\s+/).length <= 4; });
    return hit.length === 1 ? hit[0] : null;
  }
  function catPrompt(pre) {
    O.step = 'cat'; O.cat = null; O.grp = null; O.list = null;
    return r((pre || '') + L('Which <b>category</b> would you like to order from? (Tap one, or type a dish name.)', 'Aap kis <b>category</b> se order karna chahenge? (Koi chunein, ya dish ka naam likhein.)') + '<ol>' + M.categories.map(function (c) { return '<li>' + esc(c.name) + '</li>'; }).join('') + '</ol>', M.categories.map(function (c) { return c.name; }));
  }
  function showCategory(c) {
    O.cat = c.id; O.grp = null;
    var items = catBases(c.id);
    if (items.length > 12 && c.groups.length > 1) {
      O.step = 'group';
      return r(L('<b>' + esc(c.name) + '</b> — which section?', '<b>' + esc(c.name) + '</b> — kaun sa hissa?') + '<ol>' + c.groups.map(function (g) { return '<li>' + esc(g.name) + ' <small>(' + g.items.length + ')</small></li>'; }).join('') + '</ol>', c.groups.map(function (g) { return g.name; }).concat(['Change category']));
    }
    return showItems(items, 0, c.name);
  }
  function showItems(list, page, title) {
    O.step = 'item'; O.list = list; O.page = page; O.title = title;
    var pages = Math.ceil(list.length / PAGE), from = page * PAGE, part = list.slice(from, from + PAGE);
    var html = '<b>' + esc(title) + '</b> — ' + L('choose a dish (tap it, or type its number or name):', 'dish chunein (tap karein, ya number / naam likhein):') + '<ol start="' + (from + 1) + '">' + part.map(function (b) { return '<li>' + esc(b.name) + ' — ' + priceOf(b) + (b.soldOut ? ' <i>' + L('(sold out today)', '(aaj sold out)') + '</i>' : '') + (b.preorder ? ' <small>' + L('(pre-order)', '(pre-order)') + '</small>' : '') + '</li>'; }).join('') + '</ol>' + (pages > 1 ? '<small>' + L('Page ' + (page + 1) + ' of ' + pages, 'Safha ' + (page + 1) + ' / ' + pages) + '</small>' : '');
    return r(html, part.filter(function (b) { return !b.soldOut; }).map(function (b) { return b.name; }).concat(pages > 1 ? ['More dishes'] : [], ['Change category']));
  }
  function findBases(text, scope) {
    var tk = tokens(text); if (!tk.length) return [];
    var res = scope.map(function (b) {
      var n = b.name.toLowerCase(), d = b.desc.toLowerCase(), sc = 0, hit = 0;
      tk.forEach(function (w) { var re = new RegExp('\\b' + w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')); if (re.test(n)) { sc += 3; hit++; } else if (re.test(d)) sc += 0.5; });
      return { b: b, sc: sc, hit: hit };
    }).filter(function (x) { return x.hit > 0; });
    if (!res.length) return [];
    var best = Math.max.apply(null, res.map(function (x) { return x.sc; })), top = res.filter(function (x) { return x.sc === best; }).map(function (x) { return x.b; });
    var low = text.toLowerCase();
    var exact = top.filter(function (b) { return b.name.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter(function (w) { return w.length > 1; }).every(function (w) { return low.indexOf(w) >= 0; }); });
    return exact.length ? exact : top;
  }
  function splitQty(text) {
    var qty = 0, p = text, m = p.match(/(\d+)\s*(?:x|×)?\s*/), w;
    if (m && +m[1] <= 99) { qty = +m[1]; p = p.replace(m[0], ' '); }
    else { w = p.toLowerCase().split(/\W+/).filter(function (z) { return NUMW[z] && z !== 'do'; })[0]; if (w) { qty = NUMW[w]; p = p.replace(new RegExp('\\b' + w + '\\b', 'i'), ' '); } }
    return { qty: qty, text: p.replace(CMD, ' ').replace(/\s+/g, ' ').trim() };
  }
  function chooseBase(b, qty) { // after a dish is picked
    if (b.soldOut) return r(L('<b>' + esc(b.name) + '</b> is sold out today. Please choose another dish.', '<b>' + esc(b.name) + '</b> aaj sold out hai. Barae meherbani koi aur dish chunein.'), O.list ? showItems(O.list, O.page || 0, O.title || '').chips : ['Change category']);
    O.sel = { base: b, qty: qty || 0 };
    if (b.variants) { O.step = 'size'; return r(L('<b>' + esc(b.name) + '</b> comes in these sizes. Which one?', '<b>' + esc(b.name) + '</b> in sizes mein milti hai. Kaun si chahiye?') + '<ul>' + b.variants.map(function (v) { return '<li>' + esc(v.label) + ' — ' + money(v.price) + '</li>'; }).join('') + '</ul>', b.variants.map(function (v) { return v.label; })); }
    O.sel.key = b.id; return askQty();
  }
  function askQty() {
    var s = O.sel, nm = OI[s.key].name;
    if (s.qty) return addSelected();
    O.step = 'qty';
    return r(L('How many <b>' + esc(nm) + '</b> would you like?' + (OI[s.key].preorder ? ' <small>(pre-order: needs 24 hours notice)</small>' : ''), '<b>' + esc(nm) + '</b> kitni chahiye?' + (OI[s.key].preorder ? ' <small>(pre-order: 24 ghante pehle batana zaroori)</small>' : '')), ['1', '2', '3', '4', '5']);
  }
  function addSelected() {
    var s = O.sel, k = s.key, q = s.qty; O.cart[k] = Math.min(20, (O.cart[k] || 0) + q); O.step = 'more'; O.sel = null;
    return r(L('Added <b>' + q + ' × ' + esc(OI[k].name) + '</b>.', '<b>' + q + ' × ' + esc(OI[k].name) + '</b> shamil kar diya.') + cartHtml(false) + '<br>' + L('Would you like to add more items, or checkout?', 'Kya aap aur items shamil karna chahenge, ya checkout?'), ['Add more items', 'Checkout']);
  }
  function startOrder(q) {
    F = null; lastOffer = ''; O = { step: 'type', cart: {}, type: null, d: {} };
    var s = (q || '').toLowerCase();
    if (/deliver|ghar/.test(s) && !/pick/.test(s)) { O.type = 'delivery'; } else if (/pick|collect|takeaway|take away/.test(s) && !/deliver/.test(s)) { O.type = 'pickup'; }
    if (O.type) return catPrompt(L('Great, <b>' + (O.type === 'delivery' ? 'delivery' : 'pickup') + '</b>. ', 'Theek hai, <b>' + (O.type === 'delivery' ? 'delivery' : 'pickup') + '</b>. '));
    return r(L('Happy to take your order. Is it for <b>pickup</b> or <b>delivery</b>? (Delivery fee ' + money(DELIVERY) + ', plus ' + GST + '% GST.)', 'Zaroor! Order <b>pickup</b> ke liye hai ya <b>delivery</b> ke liye? (Delivery fee ' + money(DELIVERY) + ', aur ' + GST + '% GST.)'), ['Pickup', 'Delivery']);
  }
  function resolveText(t, scope) { // a typed dish name (with optional quantity) -> reply or null
    var sq = splitQty(t); if (sq.text.length < 2) return null;
    var f = findBases(sq.text, scope); if (!f.length) { var fx = fixTypos(sq.text); if (fx !== sq.text.toLowerCase()) f = findBases(fx, scope); }
    if (!f.length) return null;
    if (f.length === 1) return chooseBase(f[0], sq.qty);
    var live = f.filter(function (b) { return !b.soldOut; }); if (live.length === 1) return chooseBase(live[0], sq.qty);
    O.pendQty = sq.qty; return showItems(f.slice(0, 20), 0, L('Matching dishes', 'Milti julti dishes'));
  }
  function orderReply(q) {
    var d = O.d, t = q.trim(), x;
    if (CANCEL_RE.test(t)) { O = null; return r(L('No problem, I have cancelled the order. Anything else I can help with?', 'Koi masla nahi, order cancel kar diya. Kuch aur madad chahiye?'), CHIPS_MAIN); }
    if (/^(clear|empty|reset)\b|cart (khali|clear)/i.test(t) && O.step !== 'name' && O.step !== 'phone' && O.step !== 'address') { O.cart = {}; return catPrompt(L('I have emptied your cart. ', 'Cart khali kar diya. ')); }
    if (/^(show|view|see)?\s*(my |the )?(cart|basket)\b/i.test(t) && ['name', 'phone', 'address', 'confirm'].indexOf(O.step) < 0) return r(L('Your cart:', 'Aap ka cart:') + cartHtml(false), cartLines().length ? ['Add more items', 'Checkout'] : ['Change category']);
    if (/^(remove|delete|minus|hata|hatao)\b/i.test(t) && ['name', 'phone', 'address', 'confirm'].indexOf(O.step) < 0) {
      var tx = t.replace(/^(remove|delete|minus|hata|hatao)\s*/i, ''), tk = tokens(tx), ls = cartLines().filter(function (l) { return tk.some(function (w) { return l.name.toLowerCase().indexOf(w) >= 0; }); });
      if (!ls.length) return r(L('I could not find that in your cart.', 'Ye aap ke cart mein nahi mila.') + cartHtml(false), ['Add more items', 'Checkout']);
      ls.forEach(function (l) { delete O.cart[l.key]; }); return r(L('Removed ', 'Hata diya: ') + ls.map(function (l) { return esc(l.name); }).join(', ') + '.' + cartHtml(false), cartLines().length ? ['Add more items', 'Checkout'] : ['Change category']);
    }
    switch (O.step) {
      case 'type':
        if (/deliver/i.test(t)) { O.type = 'delivery'; return catPrompt(L('Delivery it is. ', 'Theek hai, delivery. ')); }
        if (/pick|collect|takeaway|take away|khud|aunga|aaunga|le jaunga|lene/i.test(t)) { O.type = 'pickup'; return catPrompt(L('Pickup it is. ', 'Theek hai, pickup. ')); }
        return r(L('Please choose <b>Pickup</b> or <b>Delivery</b>.', 'Barae meherbani <b>Pickup</b> ya <b>Delivery</b> chunein.'), ['Pickup', 'Delivery']);
      case 'cat':
        x = matchCategory(t); if (x) return showCategory(x);
        x = resolveText(t, BASE); if (x) return x;
        return catPrompt(L('I did not find that. ', 'Ye nahi mila. '));
      case 'group':
        if (/change category|category badl/i.test(t)) return catPrompt();
        var c = catById(O.cat), gi = /^\d{1,2}$/.test(t) ? +t - 1 : c.groups.map(function (g) { return g.name.toLowerCase(); }).indexOf(t.toLowerCase());
        if (gi < 0) { var gm = c.groups.map(function (g, i) { return { i: i, hit: tokens(t).some(function (w) { return g.name.toLowerCase().indexOf(w) >= 0; }) }; }).filter(function (z) { return z.hit; }); if (gm.length === 1) gi = gm[0].i; }
        if (gi >= 0 && c.groups[gi]) { O.grp = gi; return showItems(catBases(O.cat).filter(function (b) { return b.group === c.groups[gi].name; }), 0, c.groups[gi].name); }
        x = resolveText(t, catBases(O.cat)); if (x) return x;
        return showCategory(c);
      case 'item':
        if (/change category|category badl/i.test(t)) return catPrompt();
        if (/^more( dishes)?$|aur dishes|next/i.test(t)) { var pages = Math.ceil(O.list.length / PAGE); return showItems(O.list, (O.page + 1) % pages, O.title); }
        if (/^\d{1,3}$/.test(t)) { var b = O.list[+t - 1]; if (b) return chooseBase(b, O.pendQty || 0); return r(L('Please pick a number from the list.', 'Barae meherbani list mein se koi number chunein.'), showItems(O.list, O.page, O.title).chips); }
        var ex = O.list.filter(function (z) { return z.name.toLowerCase() === t.toLowerCase(); })[0]; if (ex) return chooseBase(ex, O.pendQty || 0);
        x = resolveText(t, O.list) || resolveText(t, catBases(O.cat || '').length ? catBases(O.cat) : BASE) || resolveText(t, BASE); if (x) return x;
        return r(L('I could not find that dish. Please tap one from the list, or type its number.', 'Ye dish nahi mili. List mein se koi chunein, ya uska number likhein.'), showItems(O.list, O.page, O.title).chips);
      case 'size':
        var bs = O.sel.base, vi = -1, low = t.toLowerCase();
        bs.variants.forEach(function (v, i) { if (v.label.toLowerCase() === low || (/^\d$/.test(t) && +t - 1 === i)) vi = i; });
        if (vi < 0) bs.variants.forEach(function (v, i) { if (new RegExp('\\b' + v.label.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b').test(low)) vi = i; });
        if (vi < 0) return r(L('Please choose a size: ', 'Barae meherbani size chunein: ') + bs.variants.map(function (v) { return esc(v.label); }).join(', ') + '.', bs.variants.map(function (v) { return v.label; }));
        O.sel.key = bs.id + '|' + bs.variants[vi].label; return askQty();
      case 'qty':
        var n = numIn(t); if (!n || n < 1 || n > 20) return r(L('Please give a quantity between 1 and 20.', 'Barae meherbani 1 se 20 ke darmiyan tadaad likhein.'), ['1', '2', '3', '4', '5']);
        O.sel.qty = n; return addSelected();
      case 'more':
        if (/^(add more|more|aur|add|another|one more|continue)/i.test(t) || /aur items/i.test(t)) return catPrompt();
        if (/^(checkout|check out|done|finish|finished|that'?s? (all|it)|thats all|nothing else|no more|no|nope|bas|bas itna|proceed|bill|confirm|place( the| my)? order|nahi|nahin|checkout \/ bill)(?![a-z])/i.test(t)) {
          if (!cartLines().length) return catPrompt(L('Your cart is empty. ', 'Aap ka cart khali hai. '));
          O.step = 'name'; return r(L('Here is your bill:', 'Ye raha aap ka bill:') + cartHtml(true) + '<br><br>' + L('To place the order, please tell me your <b>name</b>.', 'Order place karne ke liye apna <b>naam</b> bata dein.'));
        }
        x = matchCategory(t); if (x) return showCategory(x);
        x = resolveText(t, BASE); if (x) return x;
        return r(L('Would you like to add more items, or checkout?', 'Kya aap aur items shamil karna chahenge, ya checkout?'), ['Add more items', 'Checkout']);
      case 'name':
        x = cleanName(t); if (!x) return r(L('Please type your name, for example “Ali Raza”.', 'Barae meherbani apna naam likhein, jaise “Ali Raza”.'));
        d.name = x; O.step = 'phone'; return r(L('Thank you, ' + esc(x) + '. What is your <b>mobile number</b>? (e.g. 0300 1234567)', 'Shukriya, ' + esc(x) + '. Aap ka <b>mobile number</b> kya hai? (misal: 0300 1234567)'));
      case 'phone':
        if (!phoneOk(t)) return r(L('That does not look like a Pakistani mobile number. Please type it like 0300 1234567.', 'Ye Pakistani mobile number nahi lagta. Barae meherbani 0300 1234567 ki tarah likhein.'));
        d.phone = t.replace(/[\s-]/g, '');
        if (O.type === 'delivery') { O.step = 'address'; return r(L('Please type your full <b>delivery address</b> (house / flat, street, area, city).', 'Apna mukammal <b>delivery address</b> likhein (ghar / flat number, gali / sarak, ilaqa, shehr).')); }
        return orderSummary();
      case 'address':
        if (t.length < 10) return r(L('Please type the full address (at least 10 characters), including house number, street and area.', 'Barae meherbani poora address likhein (kam az kam 10 harf), jis mein ghar ka number, gali aur ilaqa ho.'));
        d.address = t.slice(0, 250); return orderSummary();
      case 'confirm':
        if (YES_RE.test(t)) return submitOrder();
        if (NO_RE.test(t)) { O = null; return r(L('Okay, I have not sent anything. Anything else I can help with?', 'Theek hai, kuch nahi bheja. Kuch aur madad chahiye?'), CHIPS_MAIN); }
        return r(L('Please press “Yes, place order” to send it, or “Cancel”.', 'Order bhejne ke liye “Haan, order kar dein” ya rokne ke liye “Cancel karein” dabayein.'), ['Yes, place order', 'Cancel']);
    }
    O = null; return null;
  }
  function orderSummary() {
    var d = O.d; O.step = 'confirm';
    return r(L('Please check your order:', 'Barae meherbani apna order check kar lein:') + cartHtml(true) + '<br><br>' + (O.type === 'delivery' ? '<b>' + L('Delivery', 'Delivery') + '</b> — ' + esc(d.address) : '<b>' + L('Pickup', 'Pickup') + '</b> — ' + L('ready in about 20–45 minutes', 'taqriban 20–45 minute mein tayyar')) + '<br>' + esc(d.name) + ' · ' + esc(d.phone) + '<br><br>' + L('Shall I place this order?', 'Kya main ye order place kar doon?') + ' <small>(' + esc(L(M.taxNote || '', 'Qeematon mein GST shamil nahi')) + ')</small>', ['Yes, place order', 'Cancel']);
  }
  function etaForOrder(o, placed) {
    var n = o.lines.reduce(function (a, l) { return a + l.qty; }, 0), add = function (m) { return new Date(placed.getTime() + m * 60000); }, clk = function (d) { return fmtT(d.getHours() * 60 + d.getMinutes()); };
    if (o.lines.some(function (l) { return l.preorder; })) return { kind: 'preorder', title: 'We will confirm your time', text: 'Your order contains a pre-order item (24 hours notice). Our team will call you to confirm the exact time.' };
    if (o.type === 'delivery') { var lo = Math.min(MAXWAIT - 10, 40 + n); return { kind: 'delivery', title: 'Estimated delivery', value: 'By ' + clk(add(MAXWAIT)), text: 'About ' + lo + '–' + MAXWAIT + ' minutes from now (' + clk(add(lo)) + ' to ' + clk(add(MAXWAIT)) + '). Delivery never takes longer than ' + MAXWAIT + ' minutes.', minMinutes: lo, maxMinutes: MAXWAIT }; }
    var m = Math.min(45, 20 + 2 * n);
    return { kind: 'pickup', title: 'Ready for pickup at', value: clk(add(m)), text: 'About ' + m + ' minutes from now. Your order will be ready within ' + MAXWAIT + ' minutes at the latest.', minMinutes: m, maxMinutes: MAXWAIT };
  }
  var ETA_RU = { preorder: 'Hum aap ko waqt confirm karenge', delivery: 'Andaazan delivery', pickup: 'Pickup ke liye tayyar' };
  function submitOrder() {
    if (!window.RiwayatSync || !RiwayatSync.available()) { O = null; return r(L('Sorry, I cannot send orders from here right now. Please use the order page: ', 'Maaf kijiye, abhi yahan se order nahi bheja ja sakta. Barae meherbani order page istemal karein: ') + ACT.take, ['Contact details']); }
    var d = O.d, now = new Date(), o = { type: O.type, details: { name: d.name, phone: d.phone, address: O.type === 'delivery' ? d.address : '', time: 'asap', notes: '' }, lines: cartLines(), totals: cartTotals() };
    o.id = 'RW-' + ymd(now).replace(/-/g, '').slice(2) + '-' + Math.floor(1000 + Math.random() * 9000); o.placedAt = now.toISOString(); o.eta = etaForOrder(o, now);
    return RiwayatSync.submit('order', o).then(function (tok) {
      o.token = tok; o.status = 'new'; O = null;
      try { var all = JSON.parse(localStorage.getItem('riwayat_orders') || '[]'); all.push(o); localStorage.setItem('riwayat_orders', JSON.stringify(all)); } catch (e) { /* ignore */ }
      var nm = esc(d.name.split(/\s+/)[0]);
      return r(L('Thank you, ' + nm + '! 🎉 Your order <b>' + esc(o.id) + '</b> has been received and the kitchen has been notified.<br>' + esc(o.eta.title) + (o.eta.value ? ': <b>' + esc(o.eta.value) + '</b>' : '') + '.<br>Total: <b>' + money(o.totals.total) + '</b>. Thank you for choosing Riwayat!<br><small>Ask me “check my order status” any time.</small>',
        'Shukriya, ' + nm + '! 🎉 Aap ka order <b>' + esc(o.id) + '</b> mil gaya hai aur kitchen ko bata diya gaya hai.<br>' + esc(ETA_RU[o.eta.kind] || o.eta.title) + (o.eta.value ? ': <b>' + esc(o.eta.value) + '</b>' : '') + '.<br>Kul raqam: <b>' + money(o.totals.total) + '</b>. Riwayat ko chunne ka shukriya!<br><small>Kisi bhi waqt “order ka status” poochh sakte hain.</small>'), CHIPS_MAIN);
    }, function () { return r(L('I could not reach the restaurant just now, so nothing was sent. Please press “Yes, place order” to try again.', 'Abhi restaurant se rabta nahi ho saka, is liye kuch nahi bheja gaya. Dobara koshish ke liye “Haan, order kar dein” dabayein.'), ['Yes, place order', 'Cancel']); });
  }

  var INFO_ASK = function () { return r(L('What would you like to know? Tap a topic, or just type your question.', 'Aap kya jaanna chahte hain? Koi topic chunein, ya apna sawal likh dein.'), CHIPS_INFO.concat(['What should I try?'].filter(function () { return false; }))); };
  var RULES = [
    { t: /^(get information|maloomat chahiye|maloomat|information|info)$/i, f: function () { return INFO_ASK(); } },
    { t: /sold ?out|finished today|khatam|not available today|unavailable/i, f: function () { var so = INDEX.filter(function (i) { return i.soldOut; }); return r(so.length ? L('Currently <b>sold out</b>:', 'Is waqt <b>sold out</b> hain:') + '<ul>' + so.map(function (i) { return '<li>' + esc(i.name) + '</li>'; }).join('') + '</ul>' + L('Everything else on the menu is available.', 'Menu ki baaqi sab cheezein maujood hain.') : L('Nothing is marked sold out right now.', 'Abhi koi cheez sold out nahi hai.'), ['View menu']); } },
    { t: /status|track|where is my|check my (order|booking|reservation|table)|RW-\d|RV-\d/i, f: function (q) { return statusReply(q); } },
    { t: /^(and |what about |also )?(the )?(price|cost|rate|kitna|kitne ka|qeemat|how much)( of (it|that|them))?\??$/i, f: function () { return lastHits.length ? r('<ul>' + lastHits.map(itemLine).join('') + '</ul>', ['Place an order']) : null; } },
    { t: /^(yes|yeah|yep|haan|han|ji|jee|ji haan|ok|okay|sure|please)\b/i, f: function () { return lastOffer === 'book' ? startFlow() : null; } },
    { t: /^(hi|hello|hey|salam|assalam|aoa|good (morning|evening|afternoon))(?![-\w])|السلام/i, f: function () { return r(L('Assalam-o-Alaikum! Welcome to <b>Riwayat</b>. How can I help you today?', 'Assalam-o-Alaikum! <b>Riwayat</b> mein khush aamdeed. Main aap ki kya madad kar sakta hoon?'), CHIPS_MAIN); } },
    { t: /thank|shukriya|jazak|mehrbani|meherbani|شکریہ/i, f: function () { return r(L('You are most welcome! Anything else I can help with?', 'Koi baat nahi! Kuch aur madad chahiye?'), CHIPS_MAIN); } },
    { t: /^(bye|goodbye|allah hafiz|khuda hafiz|allah hafez)/i, f: function () { return r(L('Allah Hafiz! We look forward to welcoming you at Riwayat.', 'Allah Hafiz! Hum Riwayat mein aap ka intezar karenge.')); } },
    { t: /\bhelp\b|what can you do|madad/i, f: function () { return r(L('I can take your <b>takeaway or delivery order</b>, book a <b>table</b>, and answer questions about <b>opening hours</b>, <b>location</b>, <b>menu and prices</b>, <b>buffets</b>, <b>seating</b> and <b>kids</b>. What would you like to do?', 'Main aap ka <b>takeaway ya delivery order</b> le sakta hoon, <b>table book</b> kar sakta hoon, aur <b>khulne ke waqt</b>, <b>pata</b>, <b>menu aur qeematon</b>, <b>buffets</b>, <b>baithne ki jagah</b> aur <b>bachon</b> ke baare mein bata sakta hoon. Aap kya karna chahenge?'), CHIPS_MAIN); } },
    { t: /hour|open|clos|timing|what time|kitne baje|khul|\bkab\b|\bwaqt\b|وقت|کھل/i, f: function (q) { var dq = /buffet|brunch|tea\b|dinner|lunch/i.test(q) ? null : parseDate(q); if (dq) return openOn(dq); return r(L('We are open:<br>• ' + HOURS.week + '<br>• ' + HOURS.wknd + '<br><br>Buffet timings:', 'Hum in awqaat mein khule hain:<br>• ' + HOURS.week + '<br>• ' + HOURS.wknd + '<br><br>Buffet ke awqaat:') + '<ul>' + M.buffets.map(function (b) { return '<li><b>' + esc(b.name) + '</b> (' + esc(b.days.toLowerCase()) + '): ' + b.times.map(esc).join(L(' and ', ' aur ')) + '</li>'; }).join('') + '</ul>' + closuresNote(), ['Book a table', 'Buffet prices']); } },
    { t: /where|location|address|direction|map|find you|kahan|\bpata\b|کہاں|پتہ|road/i, f: function () { return r(L('We are on <b>' + ADDRESS + '</b>, Pakistan. See the exterior in our ', 'Hum <b>' + ADDRESS + '</b>, Pakistan par hain. Bahar ka manzar dekhne ke liye hamari ') + link(galleryHref, L('gallery', 'gallery')) + L('.', ' dekhein.'), ['Opening hours', 'Contact details']); } },
    { t: /phone|call|contact|number|email|whatsapp|reach|rabta|رابطہ/i, f: function () { return r(L('You can reach us at <b>' + PHONE + '</b> or <b>' + EMAIL + '</b>.', 'Aap hum se <b>' + PHONE + '</b> ya <b>' + EMAIL + '</b> par rabta kar sakte hain.'), ['Book a table']); } },
    { t: /./, f: function (q) { return themeReply(q); } },
    { t: /birthday|engagement|celebrat|decor|themes?\b|\b(party|parties|events?)\b(?! of)|mangni|salgirah/i, f: function (q) {
        var P = window.RIWAYAT_PARTIES, names = function (k) { return P && P[k] ? P[k].themes.map(function (t) { return esc(t.name); }).join(', ') : ''; };
        return r(L('We host <b>Birthday Parties</b> and <b>Engagement Ceremonies</b> with <b>free décor</b> — choose from <b>4 themes</b> each.', 'Hum <b>Birthday Parties</b> aur <b>Engagement</b> ki taqreebaat <b>muft decor</b> ke saath karte hain — har ek ke <b>4 themes</b> hain.') + (P ? '<ul><li><b>Birthday:</b> ' + names('birthday') + '</li><li><b>Engagement:</b> ' + names('engagement') + '</li></ul>' : '<br>') + L('Minimum guests vary by theme. Call <b>' + PHONE + '</b> or email <b>' + EMAIL + '</b> to plan yours. ', 'Kam az kam mehmanon ki tadaad theme ke mutabiq hai. Plan karne ke liye <b>' + PHONE + '</b> par call karein ya <b>' + EMAIL + '</b> par email karein. ') + link(onOrderPage ? 'index.html#celebrations' : '#celebrations', L('See the themes →', 'Themes dekhein →')), ['Birthday themes', 'Engagement themes', 'Contact details']); } },
    { t: /seat|sitting|table type|indoor|terrace|lawn|roof|vvip|private|outdoor|bethna|baithne|baithna|jagah/i, f: function () { return r(L('You can choose where to sit when you book:<ul><li><b>VVIP Hall</b> — private, exclusive dining (<i>' + money(VVIP) + ' additional</i>)</li><li><b>Indoor</b> — main dining hall</li><li><b>Terrace</b> — open-air arched terrace</li><li><b>Lawn</b> — courtyard lawn with fountains</li><li><b>Roof Top</b> — city views and lantern light</li></ul>', 'Booking ke waqt aap baithne ki jagah chun sakte hain:<ul><li><b>VVIP Hall</b> — private dining (<i>' + money(VVIP) + ' izafi</i>)</li><li><b>Indoor</b> — main dining hall</li><li><b>Terrace</b> — khuli mehraabi terrace</li><li><b>Lawn</b> — fawwaron wala lawn</li><li><b>Roof Top</b> — shehr ka nazara aur lanterns</li></ul>') + ACT.book, ['Book a table', 'Opening hours']); } },
    { t: /kid|child|children|bachch|bachay|bachon|baby|toddler/i, f: function () { var k = M.buffets.filter(function (b) { return b.kidsNote.length; }); return r(L('When booking a table you tell us how many <b>adults</b> and <b>kids</b> are coming and each child’s age (up to 12 years).', 'Table book karte waqt aap batate hain ke kitne <b>bade</b> aur kitne <b>bachay</b> aa rahe hain aur har bachay ki umar (12 saal tak).') + (k.length ? '<br><br>' + L('Buffet kids pricing:', 'Buffet mein bachon ki qeemat:') + '<ul>' + k.map(function (b) { return '<li><b>' + esc(b.name) + '</b>: ' + esc(b.kidsNote.join(' ')) + '</li>'; }).join('') + '</ul>' : '') + ACT.book, ['Book a table', 'Buffet prices']); } },
    { t: /book|reserv|table for|dine[- ]?in|booking|ٹیبل|table chahiye|table chahye|jagah chahiye/i, f: function (q) {
        if (/\bhow\b|process|steps|kaise|policy|rules?\b|limit|advance|notice|information|info\b/i.test(q)) return r(L('Table requests are checked by our team, so each one is <b>awaiting confirmation</b> until we confirm it.<ul><li>Bookable up to <b>' + ADV + ' days</b> ahead</li><li>Online parties up to <b>' + MAXP + ' guests</b> (call <b>' + PHONE + '</b> for larger groups)</li>' + (+BK.minNoticeMinutes > 30 ? '<li>At least <b>' + BK.minNoticeMinutes + ' minutes</b> notice</li>' : '') + '</ul>I can take your booking right here, or you can use the full page: ', 'Table requests hamari team check karti hai, is liye har request confirm hone tak <b>confirmation ka intezar</b> mein rehti hai.<ul><li><b>' + ADV + ' din</b> aage tak booking ho sakti hai</li><li>Online booking <b>' + MAXP + ' mehmanon</b> tak (bare groups ke liye <b>' + PHONE + '</b> par call karein)</li>' + (+BK.minNoticeMinutes > 30 ? '<li>Kam az kam <b>' + BK.minNoticeMinutes + ' minute</b> pehle batana hoga</li>' : '') + '</ul>Main yahin booking le sakta hoon, ya aap poora page istemal kar sakte hain: ') + ACT.book, ['Book a table', 'Seating options']);
        return startFlow(); } },
    { t: /weather|rain|raining|hot today|cold today|temperature|garmi|sardi|barish|بارش|موسم/i, f: function () { return r(L('I cannot check the weather, but Riwayat has a seat for every mood: <b>Indoor</b> seating, <b>Terrace</b>, <b>Lawn</b> and <b>Roof Top</b> for open-air evenings, and the <b>VVIP Hall</b> for private dining.', 'Main mausam check nahi kar sakta, lekin Riwayat mein har mizaaj ke liye jagah hai: <b>Indoor</b>, khuli shaamon ke liye <b>Terrace</b>, <b>Lawn</b> aur <b>Roof Top</b>, aur private dining ke liye <b>VVIP Hall</b>.'), ['Seating options', 'Opening hours', 'Book a table']); } },
    { t: /recommend|suggest|popular|signature|best (dish|food|item)|must.?try|special(ty|ity)?\b|what should (i|we) (eat|order|try|have)|kya (khayen|khayein|order|try)|kuch acha|confused what/i, f: function () {
      var pick = ['Chicken Karahi', 'Mutton Chops, 6 pcs', 'Chicken Biryani', 'Garlic Naan', 'Kunafa Nabulsia', 'Family Feast Gold'].map(function (n) { return INDEX.filter(function (i) { return i.name === n; })[0]; }).filter(Boolean);
      return r(L('Guest favourites to start with:', 'Mehmanon ki pasandeeda dishes:') + '<ul>' + pick.map(itemLine).join('') + '</ul>' + L('Going as a group? The <b>buffets</b> let you try a bit of everything.', 'Group ke saath aa rahe hain? <b>Buffets</b> mein aap sab kuch thora thora chakh sakte hain.') + '<br><small>' + esc(M.taxNote) + '</small>', ['Buffet prices', 'Place an order', 'Book a table']); } },
    { t: /vegetarian|\bveg\b|spic(y|ier)|mild|halal|allerg|gluten|nut free|vegan|jain|ingredient|calorie|diet/i, f: function (q) {
      var hits = /vegetarian|vegan|\bveg\b/i.test(q) ? searchItems('vegetarian').filter(function (i) { return !/chicken|beef|mutton|lamb|fish|prawn|shrimp|meat|keema|kabab|seekh|boti|tikka/i.test(i.name + ' ' + i.desc); }) : [];
      return hits.length ? r(L('Some vegetarian-friendly dishes:', 'Kuch sabzi / vegetarian dishes:') + '<ul>' + hits.map(itemLine).join('') + '</ul>' + L('For allergies, spice level or special diets please call <b>' + PHONE + '</b> so the kitchen can confirm.', 'Allergy, mirch ke level ya khaas parhez ke liye <b>' + PHONE + '</b> par call karein taake kitchen confirm kar sake.'), ['Contact details']) :
        r(L('For <b>allergies, spice level, ingredients or special diets</b> I do not want to guess, as the kitchen has the final word. Please call <b>' + PHONE + '</b> or email <b>' + EMAIL + '</b> and the team will confirm for you.', '<b>Allergy, mirch ke level, ajza ya khaas parhez</b> ke baare mein main andaaza nahi lagana chahta, kyun ke aakhri baat kitchen ki hoti hai. Barae meherbani <b>' + PHONE + '</b> par call karein ya <b>' + EMAIL + '</b> par email karein, team aap ko confirm kar degi.'), ['Contact details', 'View menu']); } },
    { t: /parking|valet|wifi|wi-?fi|dress ?code|prayer|namaz|smok|wheelchair|accessib|live music|music|ac\b|air.?condition|toilet|washroom|high ?chair/i, f: function () { return r(L('I do not have confirmed details on that yet. Please call <b>' + PHONE + '</b> or email <b>' + EMAIL + '</b> and the team will happily help.', 'Is baare mein mere paas abhi confirm maloomat nahi. Barae meherbani <b>' + PHONE + '</b> par call karein ya <b>' + EMAIL + '</b> par email karein, team khushi se madad karegi.'), ['Contact details', 'Opening hours']); } },
    { t: /who are you|your name|are you (a )?(bot|human|real|ai)|aap kaun|tum kaun|\b(ap|aap|apka|aapka|tumhara|tera)\s+(ka\s+)?(name|naam)\b|\b(name|naam)\s+(kya|kaya|kia)\b|\bkaun ho\b|\bkon ho\b|\bkaun hain\b/i, f: function () { return r(L('I am the <b>Riwayat Assistant</b>. I can take <b>takeaway orders</b> and <b>table bookings</b>, and help with the <b>menu and prices</b>, <b>buffets</b>, <b>hours</b>, <b>seating</b> and <b>celebration themes</b>.', 'Main <b>Riwayat Assistant</b> hoon. Main <b>takeaway orders</b> aur <b>table booking</b> le sakta hoon, aur <b>menu aur qeematon</b>, <b>buffets</b>, <b>waqt</b>, <b>baithne ki jagah</b> aur <b>celebration themes</b> mein madad kar sakta hoon.'), CHIPS_MAIN); } },
    { t: /how are you|kya haal|kaise ho|kese ho|what'?s up|sup\b/i, f: function () { return r(L('Doing well, thank you, and ready to talk food! Would you like a recommendation, the buffet prices, or to book a table?', 'Main theek hoon, shukriya, aur khane ki baat ke liye tayyar! Kya aap koi suggestion, buffet ki qeemat, ya table booking chahenge?'), ['What should I try?', 'Buffet prices', 'Book a table']); } },
    { t: /joke|funny|mazahiya|لطیفہ/i, f: function () { return r(L('Why did the biryani get invited to every party? Because it always brings the whole <i>dum</i> crowd together. 😄 Now, shall I suggest something tasty?', 'Biryani har dawat mein kyun bulai jati hai? Kyun ke wo poori mehfil mein <i>dum</i> bhar deti hai. 😄 Ab kya main kuch mazedaar suggest karun?'), ['What should I try?', 'Buffet prices']); } },
    { t: /gst|tax|delivery (fee|charge)|charges|service charge|delivery charges/i, f: function () { return r(L('Menu prices <b>exclude GST</b>. At the bill we add <b>' + GST + '% GST</b>, plus a <b>' + money(DELIVERY) + '</b> delivery fee for delivery orders.', 'Menu ki qeematon mein <b>GST shamil nahi</b>. Bill par <b>' + GST + '% GST</b> lagta hai, aur delivery orders par <b>' + money(DELIVERY) + '</b> delivery fee alag se.'), ['Place an order']); } },
    { t: /deliver|takeaway|take away|pick ?up|order|parcel|home delivery|ghar par|mangwa|mangwana|mangwani/i, f: function (q) {
        if (/^takeaway & delivery$/i.test(q) || /\bhow\b|process|steps|kaise|do you|does|can you|areas?\b|available|hoti|policy/i.test(q)) return r(L('You can order for <b>pickup</b> or <b>delivery</b> (delivery fee ' + money(DELIVERY) + ', plus ' + GST + '% GST). I can take your order right here in the chat, or you can use the full page: ', 'Aap <b>pickup</b> ya <b>delivery</b> ke liye order kar sakte hain (delivery fee ' + money(DELIVERY) + ', aur ' + GST + '% GST). Main yahin chat mein order le sakta hoon, ya aap poora page istemal kar sakte hain: ') + ACT.take + '<br>' + L('Your order goes straight to the restaurant when you confirm. No online payment is taken on the website.', 'Confirm karte hi aap ka order seedha restaurant ko chala jata hai. Website par online payment nahi li jati.'), ['Place an order', 'GST & delivery fee', 'View menu']);
        return startOrder(q); } },
    { t: /pay|card|cash|jazzcash|easypaisa|checkout|paise|payment/i, f: function () { return r(L('No online payment is taken on this website. Please call <b>' + PHONE + '</b> to ask about payment methods.', 'Is website par online payment nahi li jati. Payment ke tareeqon ke liye <b>' + PHONE + '</b> par call karein.'), ['Place an order', 'Book a table']); } },
    { t: /pdf|download|printable/i, f: function () { return r(L('Use the <b>Download Menu (PDF)</b> button on the ', '<b>Download Menu (PDF)</b> button istemal karein, jo ') + link(menuHref, L('Menu page', 'Menu page')) + L(' to save or print the full menu.', ' par hai, poora menu save ya print karne ke liye.')); } },
    { t: /gallery|photo|picture|image|pics|tasveer/i, f: function () { return r(L('Take a look at our ', 'Hamari ') + link(galleryHref, L('photo gallery', 'photo gallery')) + L(' — the main dining hall, courtyard, rooftop, live kitchens and more.', ' dekhein — main dining hall, courtyard, rooftop, live kitchens aur bohat kuch.')); } },
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
    { t: /\bmenu\b|what do you (have|serve)|categories|dishes|serve|cuisine|khane mein|khana kya/i, f: function () { return r(L('Our menu has <b>' + INDEX.length + ' dishes</b> across: ', 'Hamare menu mein <b>' + INDEX.length + ' dishes</b> hain: ') + M.categories.map(function (c) { return esc(c.name); }).join(', ') + L(' — plus <b>4 buffets</b>.<br>', ' — aur <b>4 buffets</b>.<br>') + link(menuHref, L('Open the menu →', 'Menu kholein →')) + '<br>' + L('Ask me about any dish or price!', 'Kisi bhi dish ya qeemat ke baare mein poochhein!'), ['Buffet prices', 'Place an order']); } }
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
    if (hits.length) return r(L('Here is what I found:', 'Ye mila:') + '<ul>' + hits.map(itemLine).join('') + '</ul><small>' + esc(M.taxNote) + '</small>', ['Place an order', 'View menu']);
    return r(L('Sorry, I am not sure about that. I can take <b>orders</b> and <b>table bookings</b>, and help with <b>menu & prices</b>, <b>buffets</b>, <b>opening hours</b>, <b>location</b> and <b>seating</b>. For anything else, call <b>' + PHONE + '</b>.', 'Maaf kijiye, mujhe is baare mein pakka nahi pata. Main <b>order</b> aur <b>table booking</b> le sakta hoon, aur <b>menu aur qeemat</b>, <b>buffets</b>, <b>khulne ka waqt</b>, <b>pata</b> aur <b>baithne ki jagah</b> mein madad kar sakta hoon. Baaqi kisi bhi baat ke liye <b>' + PHONE + '</b> par call karein.'), CHIPS_MAIN);
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
  var CHIP_MAP = { 'Place an order': 'place an order', 'Takeaway order': 'place an order', 'Get information': 'get information', 'Location': 'where is the location', 'Seating options': 'seating options', 'Buffets': 'buffets', 'Birthday themes': 'birthday themes', 'Engagement themes': 'engagement themes', 'Download menu': 'download pdf menu', 'View menu': 'menu', 'Other buffets': 'buffets', 'Dinner buffet': 'dinner buffet', 'Hi-Tea buffet': 'hi-tea buffet', 'Sunday brunch': 'sunday brunch buffet', 'Desi dishes': 'desi', 'Contact details': 'contact phone', 'What should I try?': 'recommend something' };

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
    chips.innerHTML = ''; (list || []).forEach(function (c) { var b = document.createElement('button'); b.type = 'button'; var lab = chipText(c); b.textContent = lab; b.addEventListener('click', function () { send(lab); }); chips.appendChild(b); });
  }
  function send(text) {
    text = text.trim(); if (!text) return;
    if (!CHIP_REV[text.toLowerCase()]) { var dl = detectLang(text); if (dl) LANG = dl; }
    var shown = text; text = canon(text);
    add('user', shown, false); setChips([]);
    var typing = add('bot typing', '<span></span><span></span><span></span>', true);
    setTimeout(function () {
      typing.remove();
      var res = reply(CHIP_MAP[text] || text), show = function (x) { x = x || r('Sorry, something went wrong. Please call ' + PHONE + '.', CHIPS_MAIN); add('bot', x.html, true); setChips(x.chips); lastOffer = (x.chips || []).indexOf('Book a table') >= 0 && x.chips !== CHIPS_MAIN ? 'book' : ''; };
      if (res && typeof res.then === 'function') res.then(show); else show(res);
    }, 450);
  }
  function open() {
    panel.hidden = false; fab.setAttribute('aria-expanded', 'true'); root.classList.add('open');
    if (!started) { started = true; var g = reply('hello'); add('bot', g.html + '<br><small>You can write in English or Roman Urdu · Aap English ya Roman Urdu mein likh sakte hain.</small>', true); setChips(g.chips); }
    setTimeout(function () { input.focus(); }, 50);
  }
  function close() { panel.hidden = true; fab.setAttribute('aria-expanded', 'false'); root.classList.remove('open'); fab.focus(); }
  fab.addEventListener('click', function () { fab.classList.remove('has-new'); panel.hidden ? open() : close(); });
  document.getElementById('chatX').addEventListener('click', close);
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !panel.hidden) close(); });
  form.addEventListener('submit', function (e) { e.preventDefault(); var v = input.value; input.value = ''; send(v); });
  log.addEventListener('click', function (e) { if (e.target.closest('a')) { if (window.innerWidth < 700) close(); } });
})();
