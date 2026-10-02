/* Home-page celebrations popup — shown once per browser session */
(function () {
  'use strict';
  var KEY = 'riwayat_promo_seen';
  try { if (sessionStorage.getItem(KEY)) return; } catch (e) { /* storage blocked: show anyway */ }
  var prev = null;
  var el = document.createElement('div');
  el.className = 'promo'; el.hidden = true;
  el.innerHTML = '<div class="promo-box" role="dialog" aria-modal="true" aria-labelledby="promoT">' +
    '<button class="promo-x" aria-label="Close offer">×</button>' +
    '<p class="eyebrow" lang="ur" dir="rtl">خصوصی پیشکش</p><h2 id="promoT">Celebrate with Riwayat</h2><p class="sub">Your special day, with décor on us.</p>' +
    '<div class="promo-offers">' +
    '<div class="promo-offer"><span class="ic" aria-hidden="true">🎂</span><h3>Birthday Party</h3><p class="free">Free décor</p><p>Choose from 4 themes</p></div>' +
    '<div class="promo-offer"><span class="ic" aria-hidden="true">💍</span><h3>Engagement Ceremony</h3><p class="free">Free décor</p><p>Choose from 4 themes</p></div></div>' +
    '<p class="sub" style="margin:-4px 0 16px">Minimum guests vary by theme.</p>' +
    '<div class="promo-actions"><a class="btn btn-gold" href="tel:+923060005226">Call 0306-0005226</a><a class="btn btn-ghost" href="#celebrations" data-close>See the themes</a></div>' +
    '<button class="promo-skip" data-close>Maybe later</button></div>';
  document.body.appendChild(el);
  function close() {
    el.hidden = true; document.removeEventListener('keydown', onKey);
    try { sessionStorage.setItem(KEY, '1'); } catch (e) {}
    if (prev && prev.focus) prev.focus();
  }
  function onKey(e) {
    if (e.key === 'Escape') { close(); return; }
    if (e.key !== 'Tab') return;
    var f = el.querySelectorAll('button, a[href]'), first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }
  el.addEventListener('click', function (e) { if (e.target === el || e.target.closest('.promo-x') || e.target.closest('[data-close]')) close(); });
  setTimeout(function () {
    prev = document.activeElement; el.hidden = false; document.addEventListener('keydown', onKey);
    el.querySelector('.promo-x').focus();
  }, 1200);
})();
