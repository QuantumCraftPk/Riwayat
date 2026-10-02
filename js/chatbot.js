/* Riwayat Assistant — scripted (rule-based) chatbot. No internet or AI service needed. */
(function () {
  'use strict';
  var M = window.RIWAYAT_MENU; if (!M) return;
  var HOURS = { week: 'Monday to Friday: 12:00 pm to 11:00 pm', wknd: 'Saturday &amp; Sunday: 8:00 am to 12:00 am' };
  var ADDRESS = 'MM Alam Road, Gulberg, Lahore';
  var PHONE = '0306-0005226', EMAIL = 'management@riwayat.com';
  var GST = 16, DELIVERY = 200;
  var onOrderPage = !document.getElementById('gallery');
  var menuHref = 'menu.html';
  var galleryHref = onOrderPage ? 'index.html#gallery' : '#gallery';

  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var money = function (n) { return 'Rs ' + Math.round(n).toLocaleString('en-US'); };
  var link = function (href, text) { return '<a href="' + href + '">' + esc(text) + '</a>'; };

  /* ---------- searchable menu index ---------- */
  var INDEX = [];
  M.categories.forEach(function (c) { c.groups.forEach(function (g) { g.items.forEach(function (it) {
    INDEX.push({ name: it.name, desc: it.desc || '', cat: c.name, price: it.price, variants: it.variants, preorder: it.preorder });
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
    return '<li><b>' + esc(it.name) + '</b> — ' + p + (it.desc ? '<br><small>' + esc(it.desc) + '</small>' : '') + '</li>';
  }

  /* ---------- replies ---------- */
  var CHIPS_MAIN = ['What should I try?', 'Opening hours', 'Book a table', 'Buffet prices', 'Takeaway & delivery', 'Seating options'];
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

  var RULES = [
    { t: /^(hi|hello|hey|salam|assalam|aoa|good (morning|evening|afternoon))(?![-\w])|السلام/i, f: function () { return r('Assalam-o-Alaikum! Welcome to <b>Riwayat</b>. I can help with the menu, buffets, table bookings and takeaway orders. What would you like to know?', CHIPS_MAIN); } },
    { t: /thank|shukriya|jazak|شکریہ/i, f: function () { return r('You are most welcome! Anything else I can help with?', ['Opening hours', 'Book a table']); } },
    { t: /^(bye|goodbye|allah hafiz|khuda hafiz)/i, f: function () { return r('Allah Hafiz! We look forward to welcoming you at Riwayat.'); } },
    { t: /\bhelp\b|what can you do/i, f: function () { return r('I can answer questions about <b>opening hours</b>, <b>location</b>, <b>menu items and prices</b>, <b>buffets</b>, <b>seating</b>, <b>kids</b>, <b>table booking</b> and <b>takeaway / delivery</b>. Try “price of chicken karahi”.', CHIPS_MAIN); } },
    { t: /hour|open|clos|timing|what time|kitne baje|khul|وقت|کھل/i, f: function () { return r('We are open:<br>• ' + HOURS.week + '<br>• ' + HOURS.wknd + '<br><br>Buffet timings:<ul>' + M.buffets.map(function (b) { return '<li><b>' + esc(b.name) + '</b> (' + esc(b.days.toLowerCase()) + '): ' + b.times.map(esc).join(' and ') + '</li>'; }).join('') + '</ul>', ['Book a table', 'Buffet prices']); } },
    { t: /where|location|address|direction|map|find you|kahan|کہاں|پتہ|road/i, f: function () { return r('We are on <b>' + ADDRESS + '</b>, Pakistan. See the exterior in our ' + link(galleryHref, 'gallery') + '.', ['Opening hours', 'Contact details']); } },
    { t: /phone|call|contact|number|email|whatsapp|reach|رابطہ/i, f: function () { return r('You can reach us at <b>' + PHONE + '</b> or <b>' + EMAIL + '</b>.', ['Book a table']); } },
    { t: /./, f: function (q) { return themeReply(q); } },
    { t: /birthday|engagement|celebrat|decor|themes?\b|\b(party|parties|events?)\b(?! of)|mangni/i, f: function (q) {
        var P = window.RIWAYAT_PARTIES, names = function (k) { return P && P[k] ? P[k].themes.map(function (t) { return esc(t.name); }).join(', ') : ''; };
        return r('We host <b>Birthday Parties</b> and <b>Engagement Ceremonies</b> with <b>free décor</b> — choose from <b>4 themes</b> each.' + (P ? '<ul><li><b>Birthday:</b> ' + names('birthday') + '</li><li><b>Engagement:</b> ' + names('engagement') + '</li></ul>' : '<br>') + 'Minimum guests vary by theme. Call <b>' + PHONE + '</b> or email <b>' + EMAIL + '</b> to plan yours. ' + link(onOrderPage ? 'index.html#celebrations' : '#celebrations', 'See the themes →'), ['Birthday themes', 'Engagement themes', 'Contact details']); } },
    { t: /seat|sitting|table type|indoor|terrace|lawn|roof|vvip|private|outdoor|bethna/i, f: function () { return r('You can choose where to sit when you book:<ul><li><b>VVIP Hall</b> — private, exclusive dining (<i>Rs 2,500 additional</i>)</li><li><b>Indoor</b> — main dining hall</li><li><b>Terrace</b> — open-air arched terrace</li><li><b>Lawn</b> — courtyard lawn with fountains</li><li><b>Roof Top</b> — city views and lantern light</li></ul>' + ACT.book, ['Book a table', 'Opening hours']); } },
    { t: /kid|child|children|bachch|baby|toddler/i, f: function () { var k = M.buffets.filter(function (b) { return b.kidsNote.length; }); return r('When booking a table you tell us how many <b>adults</b> and <b>kids</b> are coming and each child’s age (up to 12 years).' + (k.length ? '<br><br>Buffet kids pricing:<ul>' + k.map(function (b) { return '<li><b>' + esc(b.name) + '</b>: ' + esc(b.kidsNote.join(' ')) + '</li>'; }).join('') + '</ul>' : '') + ACT.book, ['Book a table', 'Buffet prices']); } },
    { t: /book|reserv|table for|dine[- ]?in|booking|ٹیبل/i, f: function () { return r('Booking a table takes a minute:<ol><li>Choose <b>Dine In</b></li><li>Pick the <b>date and time</b></li><li>Enter <b>adults</b>, and <b>kids with their ages</b></li><li>Choose a <b>cuisine</b> (or Mix / Not decided yet)</li><li>Choose your <b>seating</b> and confirm</li></ol>' + ACT.book, ['Seating options', 'Opening hours']); } },
    { t: /weather|rain|raining|hot today|cold today|temperature|garmi|sardi|barish|بارش|موسم/i, f: function () { return r('I cannot check the weather, but Riwayat has a seat for every mood: <b>Indoor</b> seating, <b>Terrace</b>, <b>Lawn</b> and <b>Roof Top</b> for open-air evenings, and the <b>VVIP Hall</b> for private dining. Choose your seating when you ' + ACT.book, ['Seating options', 'Opening hours', 'Book a table']); } },
    { t: /recommend|suggest|popular|signature|best (dish|food|item)|must.?try|special(ty|ity)?\b|what should (i|we) (eat|order|try|have)|kya (khayen|order)|confused what/i, f: function () {
      var pick = ['Chicken Karahi', 'Mutton Chops, 6 pcs', 'Chicken Biryani', 'Garlic Naan', 'Kunafa Nabulsia', 'Family Feast Gold'].map(function (n) { return INDEX.filter(function (i) { return i.name === n; })[0]; }).filter(Boolean);
      return r('Guest favourites to start with:<ul>' + pick.map(itemLine).join('') + '</ul>Going as a group? The <b>buffets</b> let you try a bit of everything.<br><small>' + esc(M.taxNote) + '</small>', ['Buffet prices', 'Takeaway & delivery', 'Book a table']); } },
    { t: /vegetarian|\bveg\b|spic(y|ier)|mild|halal|allerg|gluten|nut free|vegan|jain|ingredient|calorie|diet/i, f: function (q) {
      var hits = /vegetarian|vegan|\bveg\b/i.test(q) ? searchItems('vegetarian').filter(function (i) { return !/chicken|beef|mutton|lamb|fish|prawn|shrimp|meat|keema|kabab|seekh|boti|tikka/i.test(i.name + ' ' + i.desc); }) : [];
      return hits.length ? r('Some vegetarian-friendly dishes:<ul>' + hits.map(itemLine).join('') + '</ul>For allergies, spice level or special diets please call <b>' + PHONE + '</b> so the kitchen can confirm.', ['Contact details']) :
        r('For <b>allergies, spice level, ingredients or special diets</b> I do not want to guess, as the kitchen has the final word. Please call <b>' + PHONE + '</b> or email <b>' + EMAIL + '</b> and the team will confirm for you.', ['Contact details', 'View menu']); } },
    { t: /parking|valet|wifi|wi-?fi|dress ?code|prayer|namaz|smok|wheelchair|accessib|live music|music|ac\b|air.?condition|toilet|washroom|high ?chair/i, f: function () { return r('I do not have confirmed details on that yet. Please call <b>' + PHONE + '</b> or email <b>' + EMAIL + '</b> and the team will happily help.', ['Contact details', 'Opening hours']); } },
    { t: /who are you|your name|are you (a )?(bot|human|real|ai)|what can you do/i, f: function () { return r('I am the <b>Riwayat Assistant</b>, a demo chatbot for this concept website. I can help with the <b>menu and prices</b>, <b>buffets</b>, <b>hours</b>, <b>seating</b>, <b>celebration themes</b>, <b>table bookings</b> and <b>takeaway</b>.', CHIPS_MAIN); } },
    { t: /how are you|kya haal|kaise ho|what'?s up|sup\b/i, f: function () { return r('Doing well, thank you, and ready to talk food! Would you like a recommendation, the buffet prices, or to book a table?', ['What should I try?', 'Buffet prices', 'Book a table']); } },
    { t: /joke|funny|mazahiya|لطیفہ/i, f: function () { return r('Why did the biryani get invited to every party? Because it always brings the whole <i>dum</i> crowd together. 😄 Now, shall I suggest something tasty?', ['What should I try?', 'Buffet prices']); } },
    { t: /gst|tax|delivery (fee|charge)|charges|service charge/i, f: function () { return r('Menu prices <b>exclude GST</b>. At the bill we add <b>' + GST + '% GST</b>, plus a <b>' + money(DELIVERY) + '</b> delivery fee for delivery orders.', ['Takeaway & delivery']); } },
    { t: /deliver|takeaway|take away|pick ?up|order|parcel|home delivery/i, f: function () { return r('You can order for <b>pickup</b> or <b>delivery</b>:<ol><li>Choose <b>Takeaway</b>, then Pickup or Delivery</li><li>Add dishes to your cart</li><li>Review the bill (' + GST + '% GST' + ('; delivery fee ' + money(DELIVERY)) + ')</li><li>Enter your details and press <b>Confirm Order</b></li></ol>This is a demo — no real payment is taken. ' + ACT.take, ['GST & delivery fee', 'View menu']); } },
    { t: /pay|card|cash|jazzcash|easypaisa|checkout/i, f: function () { return r('This website is a <b>conceptual demo</b>, so no real payment is taken and no order is sent to a kitchen. You can still go through the whole flow to see how it would work.', ['Takeaway & delivery', 'Book a table']); } },
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

  function reply(q) {
    for (var i = 0; i < RULES.length; i++) {
      if (RULES[i].t.test(q)) { var out = RULES[i].f(q); if (out) return out; }
    }
    var hits = searchItems(q);
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
  var CHIP_MAP = { 'Birthday themes': 'birthday themes', 'Engagement themes': 'engagement themes', 'Download menu': 'download pdf menu', 'View menu': 'menu', 'Other buffets': 'buffets', 'Dinner buffet': 'dinner buffet', 'Hi-Tea buffet': 'hi-tea buffet', 'Sunday brunch': 'sunday brunch buffet', 'Desi dishes': 'desi', 'Contact details': 'contact phone', 'What should I try?': 'recommend something' };

  /* ---------- UI ---------- */
  var root = document.createElement('div'); root.className = 'chat-root';
  root.innerHTML = '<button class="chat-fab" id="chatFab" aria-label="Open Riwayat Assistant" aria-expanded="false"><svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true"><path fill="currentColor" d="M4 3h16a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H9l-5 4v-4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"/></svg><span class="chat-fab-t">Ask Riwayat</span></button>' +
    '<section class="chat-panel" id="chatPanel" role="dialog" aria-label="Riwayat Assistant" hidden>' +
    '<header class="chat-head"><div><b>Riwayat Assistant</b><small>روایت · Demo assistant</small></div><button class="chat-x" id="chatX" aria-label="Close chat">×</button></header>' +
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
      var res = reply(CHIP_MAP[text] || text);
      add('bot', res.html, true); setChips(res.chips);
    }, 450);
  }
  function open() {
    panel.hidden = false; fab.setAttribute('aria-expanded', 'true'); root.classList.add('open');
    if (!started) { started = true; var g = reply('hello'); add('bot', g.html, true); setChips(g.chips); }
    setTimeout(function () { input.focus(); }, 50);
  }
  function close() { panel.hidden = true; fab.setAttribute('aria-expanded', 'false'); root.classList.remove('open'); fab.focus(); }
  fab.addEventListener('click', function () { panel.hidden ? open() : close(); });
  document.getElementById('chatX').addEventListener('click', close);
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !panel.hidden) close(); });
  form.addEventListener('submit', function (e) { e.preventDefault(); var v = input.value; input.value = ''; send(v); });
  log.addEventListener('click', function (e) { if (e.target.closest('a')) { if (window.innerWidth < 700) close(); } });
})();
