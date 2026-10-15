/* Sends confirmed orders / reservations to the restaurant's online database
   (Firebase Firestore) and lets the customer follow the status. */
(function () {
  'use strict';
  var STATUS_TEXT = {
    order: { 'new': 'Received', preparing: 'Being prepared', ready: 'Ready', completed: 'Completed', cancelled: 'Cancelled' },
    reservation: { 'new': 'Awaiting confirmation', confirmed: 'Confirmed', declined: 'Could not be accommodated' }
  };
  function token() { // unguessable document id: only the customer who placed it can look it up
    var a = new Uint8Array(14), out = '';
    (window.crypto || window.msCrypto).getRandomValues(a);
    for (var i = 0; i < a.length; i++) out += (a[i] % 36).toString(36);
    return out;
  }
  function available() { return !!(window.RiwayatFS && window.RIWAYAT_FIREBASE && window.RIWAYAT_FIREBASE.projectId); }

  window.RiwayatSync = {
    available: available,
    statusText: function (kind, st) { return (STATUS_TEXT[kind] || {})[st] || st; },
    submit: function (kind, rec) { // returns a Promise of the token
      if (!available()) return Promise.reject(new Error('offline-config'));
      var t = token(), coll = kind === 'order' ? 'orders' : 'reservations', det = rec.details || rec.dine || {};
      var doc = {
        id: rec.id, kind: kind, status: 'new', placedAt: rec.placedAt,
        total: kind === 'order' ? Number(rec.totals.total) : 0,
        name: String(kind === 'order' ? (det.name || '') : (rec.name || '')).slice(0, 80),
        phone: String(kind === 'order' ? (det.phone || '') : (rec.phone || '')).slice(0, 30),
        type: String(rec.type || 'reservation'),
        json: JSON.stringify(rec)
      };
      return RiwayatFS.create(coll, t, doc).then(function () { return t; });
    },
    status: function (kind, tok) {
      return RiwayatFS.get((kind === 'order' ? 'orders/' : 'reservations/') + tok).then(function (d) { return d ? d.status : null; });
    }
  };
})();
