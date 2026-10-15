/* Fills contact details and opening hours on the page from the settings. */
(function () {
  'use strict';
  var S = window.RIWAYAT_SETTINGS, U = window.RIWAYAT_UTIL; if (!S) return;
  function all(sel, fn) { Array.prototype.forEach.call(document.querySelectorAll(sel), fn); }
  all('[data-bind="phone"]', function (e) { e.textContent = S.phone; });
  all('[data-bind="phone-call"]', function (e) { e.textContent = 'Call ' + S.phone; });
  all('a[data-bind-href="tel"]', function (e) { e.setAttribute('href', 'tel:' + U.digits(S.phone)); });
  all('[data-bind="email"]', function (e) { e.textContent = S.email; });
  all('a[data-bind-href="mail"]', function (e) { e.setAttribute('href', 'mailto:' + S.email); });
  all('[data-bind="address"]', function (e) { e.innerHTML = String(S.address).split(',').map(function (x) { return x.trim(); }).join('<br>') ; });
  all('[data-bind="hours-week-label"]', function (e) { e.textContent = S.hours.week.label; });
  all('[data-bind="hours-week"]', function (e) { e.textContent = U.range(S.hours.week); });
  all('[data-bind="hours-wknd-label"]', function (e) { e.textContent = S.hours.wknd.label; });
  all('[data-bind="hours-wknd"]', function (e) { e.textContent = U.range(S.hours.wknd); });
})();
