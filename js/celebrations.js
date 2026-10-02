/* Renders the Birthday / Engagement theme cards from data/celebrations-data.js */
(function () {
  'use strict';
  var P = window.RIWAYAT_PARTIES; if (!P) return;
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  function card(kind, t) {
    return '<article class="theme">' +
      '<button class="theme-img" type="button" data-src="' + esc(t.img) + '" data-cap="' + esc(t.name + (kind === 'engagement' ? ' Theme' : '')) + '" aria-label="View ' + esc(t.name) + ' larger"><img src="' + esc(t.img) + '" alt="' + esc(t.name) + ' theme décor" loading="lazy"></button>' +
      '<div class="theme-body"><h4>' + esc(t.name) + '</h4><p class="tag-line">' + esc(t.tagline) + '</p>' +
      (t.desc ? '<p class="desc">' + esc(t.desc) + '</p>' : '') +
      '<ul class="feats">' + t.features.map(function (f) { return '<li>' + esc(f) + '</li>'; }).join('') + '</ul>' +
      (t.min ? '<p class="min">Minimum guests: <b>' + esc(t.min) + '</b></p>' : '') + '</div></article>';
  }
  ['birthday', 'engagement'].forEach(function (k) {
    var el = document.getElementById(k + 'Grid'); if (!el || !P[k]) return;
    el.innerHTML = P[k].themes.map(function (t) { return card(k, t); }).join('');
  });
  var lb = document.getElementById('lightbox'), img = document.getElementById('lbImg'), cap = document.getElementById('lbCap');
  document.getElementById('celebrations').addEventListener('click', function (e) {
    var b = e.target.closest('.theme-img'); if (!b || !lb) return;
    img.src = b.getAttribute('data-src'); img.alt = b.getAttribute('data-cap'); cap.textContent = b.getAttribute('data-cap'); lb.hidden = false;
  });
})();
