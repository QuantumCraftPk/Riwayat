/* Sends each confirmed order / reservation to a Google Sheet (if configured). */
(function () {
  'use strict';
  window.RiwayatSync = {
    send: function (kind, record) {
      var url = (window.RIWAYAT_CONFIG || {}).sheetUrl;
      if (!url) return;
      try {
        fetch(url, { method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ kind: kind, record: record }) })
          .catch(function () { /* demo: ignore network errors */ });
      } catch (e) { /* ignore */ }
    }
  };
})();
