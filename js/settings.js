/* Default restaurant settings. The admin panel can override these (saved online). */
(function () {
  'use strict';
  var DEFAULTS = {
    phone: '0306-0005226', email: 'management@riwayat.com', address: 'MM Alam Road, Gulberg, Lahore',
    hours: {
      week: { label: 'Monday – Friday', open: 720, close: 1380 },
      wknd: { label: 'Saturday & Sunday', open: 480, close: 1440 }
    },
    gstPercent: 16, deliveryFee: 200, vvipCharge: 2500, maxDeliveryMinutes: 60, autoPrepareMinutes: 5,
    booking: { maxPerSlot: 60, maxParty: 20, advanceDays: 60, minNoticeMinutes: 30, closedWeekdays: [], closedDates: [], blockedSlots: [] }
  };
  function merge(a, b) { // b over a, objects merged deeply
    var o = {}; Object.keys(a).forEach(function (k) { o[k] = a[k]; });
    Object.keys(b || {}).forEach(function (k) {
      if (b[k] && typeof b[k] === 'object' && !Array.isArray(b[k]) && a[k] && typeof a[k] === 'object') o[k] = merge(a[k], b[k]); else if (b[k] !== null && b[k] !== undefined && b[k] !== '') o[k] = b[k];
    }); return o;
  }
  function clock(min) { min = Number(min); var h = Math.floor(min / 60) % 24, m = min % 60; return ((h + 11) % 12 + 1) + ':' + (m < 10 ? '0' : '') + m + ' ' + (h >= 12 ? 'pm' : 'am'); }
  function digits(p) { var d = String(p || '').replace(/\D/g, ''); return d.indexOf('0') === 0 ? '+92' + d.slice(1) : (d ? '+' + d : ''); }

  window.RIWAYAT_DEFAULT_SETTINGS = DEFAULTS;
  window.RIWAYAT_SETTINGS = merge(DEFAULTS, window.RIWAYAT_SETTINGS_OVERRIDE || {});
  window.RIWAYAT_UTIL = { merge: merge, clock: clock, digits: digits,
    range: function (h) { return clock(h.open) + ' – ' + (Number(h.close) % 1440 === 0 && Number(h.close) > 0 ? 'midnight' : clock(h.close)); } };
})();
