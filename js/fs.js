/* Tiny Firestore + Auth client over plain REST (no SDK needed).
   Public pages use it without a token (read site content, create orders).
   The admin panel signs in and uses the same calls with a token. */
(function () {
  'use strict';
  var C = window.RIWAYAT_FIREBASE || {};
  var DOCS = 'https://firestore.googleapis.com/v1/projects/' + C.projectId + '/databases/(default)/documents';
  var AUTH_KEY = 'riwayat_admin_auth';
  var auth = null; // { idToken, refreshToken, expiresAt, email }

  /* ---- typed values ---- */
  function enc(v) {
    if (v === null || v === undefined) return { nullValue: null };
    if (typeof v === 'boolean') return { booleanValue: v };
    if (typeof v === 'number') return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
    if (typeof v === 'string') return { stringValue: v };
    if (Array.isArray(v)) return { arrayValue: { values: v.map(enc) } };
    var f = {}; Object.keys(v).forEach(function (k) { f[k] = enc(v[k]); }); return { mapValue: { fields: f } };
  }
  function dec(x) {
    if ('stringValue' in x) return x.stringValue;
    if ('integerValue' in x) return Number(x.integerValue);
    if ('doubleValue' in x) return x.doubleValue;
    if ('booleanValue' in x) return x.booleanValue;
    if ('nullValue' in x) return null;
    if ('arrayValue' in x) return (x.arrayValue.values || []).map(dec);
    if ('mapValue' in x) return decFields(x.mapValue.fields || {});
    if ('timestampValue' in x) return x.timestampValue;
    return null;
  }
  function decFields(f) { var o = {}; Object.keys(f || {}).forEach(function (k) { o[k] = dec(f[k]); }); return o; }
  function fromDoc(d) { var o = decFields(d.fields || {}); o._id = String(d.name || '').split('/').pop(); return o; }
  function toFields(obj) { var f = {}; Object.keys(obj).forEach(function (k) { if (k !== '_id') f[k] = enc(obj[k]); }); return f; }

  /* ---- http ---- */
  function http(method, url, body, opts) {
    opts = opts || {};
    var ctl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var timer = ctl ? setTimeout(function () { ctl.abort(); }, opts.timeout || 12000) : null;
    var headers = {};
    if (body && !opts.form) headers['Content-Type'] = 'application/json';
    if (opts.form) headers['Content-Type'] = 'application/x-www-form-urlencoded';
    if (opts.token) headers['Authorization'] = 'Bearer ' + opts.token;
    return fetch(url, { method: method, headers: headers, body: body ? (opts.form ? body : JSON.stringify(body)) : undefined, signal: ctl ? ctl.signal : undefined })
      .then(function (r) {
        if (timer) clearTimeout(timer);
        return r.text().then(function (t) {
          var j = null; try { j = t ? JSON.parse(t) : null; } catch (e) { /* not json */ }
          if (!r.ok) { var err = new Error((j && j.error && j.error.message) || ('HTTP ' + r.status)); err.status = r.status; err.code = j && j.error && j.error.status; throw err; }
          return j;
        });
      }, function (e) { if (timer) clearTimeout(timer); throw e; });
  }

  /* ---- auth ---- */
  function saveAuth() { try { if (auth) localStorage.setItem(AUTH_KEY, JSON.stringify(auth)); else localStorage.removeItem(AUTH_KEY); } catch (e) { /* ignore */ } }
  function loadAuth() { try { auth = JSON.parse(localStorage.getItem(AUTH_KEY) || 'null'); } catch (e) { auth = null; } return auth; }
  function signIn(email, password) {
    return http('POST', 'https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=' + C.apiKey,
      { email: email, password: password, returnSecureToken: true }).then(function (r) {
      auth = { idToken: r.idToken, refreshToken: r.refreshToken, expiresAt: Date.now() + (Number(r.expiresIn) || 3600) * 1000, email: r.email || email };
      saveAuth(); return auth;
    });
  }
  function signOut() { auth = null; saveAuth(); }
  function token() {
    if (!auth) return Promise.reject(new Error('Not signed in'));
    if (auth.expiresAt - Date.now() > 60000) return Promise.resolve(auth.idToken);
    return http('POST', 'https://securetoken.googleapis.com/v1/token?key=' + C.apiKey,
      'grant_type=refresh_token&refresh_token=' + encodeURIComponent(auth.refreshToken), { form: true }).then(function (r) {
      auth.idToken = r.id_token; auth.refreshToken = r.refresh_token || auth.refreshToken; auth.expiresAt = Date.now() + (Number(r.expires_in) || 3600) * 1000; saveAuth();
      return auth.idToken;
    }, function (e) { signOut(); throw e; });
  }
  function authed(method, url, body) { return token().then(function (t) { return http(method, url, body, { token: t }); }); }

  /* ---- documents ---- */
  function get(path, opts) { // public (no token) unless opts.auth
    var p = http('GET', DOCS + '/' + path, null, opts);
    return p.then(fromDoc, function (e) { if (e.status === 404) return null; throw e; });
  }
  function create(collection, id, obj) { // public create (used by customers)
    return http('POST', DOCS + '/' + collection + '?documentId=' + encodeURIComponent(id), { fields: toFields(obj) }, { timeout: 15000 });
  }
  function update(path, obj) { // admin: set the given top-level fields, keep the rest
    var mask = Object.keys(obj).filter(function (k) { return k !== '_id'; }).map(function (k) { return 'updateMask.fieldPaths=' + encodeURIComponent(k); }).join('&');
    return authed('PATCH', DOCS + '/' + path + '?' + mask, { fields: toFields(obj) }).then(fromDoc);
  }
  function remove(path) { return authed('DELETE', DOCS + '/' + path); }
  function list(collection, orderBy, limit) { // admin
    var q = { from: [{ collectionId: collection }], limit: limit || 500 };
    if (orderBy) q.orderBy = [{ field: { fieldPath: orderBy }, direction: 'DESCENDING' }];
    return authed('POST', DOCS + ':runQuery', { structuredQuery: q }).then(function (rows) {
      return (rows || []).filter(function (r) { return r.document; }).map(function (r) { return fromDoc(r.document); });
    });
  }

  window.RiwayatFS = { get: get, create: create, update: update, remove: remove, list: list, signIn: signIn, signOut: signOut, loadAuth: loadAuth, enc: enc, dec: dec,
    session: function () { return auth; }, adminEmail: C.adminEmail };
})();
