/* Loads scripts in order. The special entry "@live" fetches the latest menu,
   celebrations and settings saved by the admin (falls back to the built-in data
   if the online database cannot be reached). */
(function () {
  'use strict';
  var me = document.currentScript, list = (me.getAttribute('data-scripts') || '').split(',').map(function (s) { return s.trim(); }).filter(Boolean);
  var CACHE = 'riwayat_live_cache';

  function load(src) {
    return new Promise(function (res) {
      var s = document.createElement('script'); s.src = src; s.async = false;
      s.onload = res; s.onerror = function () { console.warn('Could not load', src); res(); };
      document.body.appendChild(s);
    });
  }
  function parse(doc, key) { try { return doc && doc[key] ? JSON.parse(doc[key]) : null; } catch (e) { return null; } }
  function withTimeout(p, ms) { return Promise.race([p, new Promise(function (_, rej) { setTimeout(function () { rej(new Error('timeout')); }, ms); })]); }

  function live() {
    if (!window.RiwayatFS) return Promise.resolve();
    var cache = null; try { cache = JSON.parse(localStorage.getItem(CACHE) || 'null'); } catch (e) { /* ignore */ }
    return withTimeout(Promise.all([RiwayatFS.get('site/menu'), RiwayatFS.get('site/celebrations'), RiwayatFS.get('site/settings')]), 3500).then(function (d) {
      var c = { menu: parse(d[0], 'json'), celebrations: parse(d[1], 'json'), settings: parse(d[2], 'json') };
      try { localStorage.setItem(CACHE, JSON.stringify(c)); } catch (e) { /* ignore */ }
      return c;
    }).catch(function () { return cache; }).then(function (c) {
      if (!c) return;
      if (c.menu && c.menu.categories && c.menu.categories.length) window.RIWAYAT_MENU = c.menu;
      if (c.celebrations && c.celebrations.birthday) window.RIWAYAT_PARTIES = c.celebrations;
      if (c.settings && window.RIWAYAT_UTIL) window.RIWAYAT_SETTINGS = RIWAYAT_UTIL.merge(window.RIWAYAT_DEFAULT_SETTINGS, c.settings);
    });
  }

  list.reduce(function (p, src) { return p.then(function () { return src === '@live' ? live() : load(src); }); }, Promise.resolve());
})();
