/* Staff page: lists saved orders/reservations and exports them to Excel. */
(function () {
  'use strict';
  var $ = function (s) { return document.querySelector(s); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var pad = function (n) { return (n < 10 ? '0' : '') + n; };
  var CUISINE = { desi: 'Desi', arabic: 'Arabic', continental: 'Continental', chinese: 'Chinese', buffet: 'Buffet', mix: 'Mix', undecided: 'Not decided yet' };
  var SEAT = { vvip: 'VVIP Hall', indoor: 'Indoor', terrace: 'Terrace', lawn: 'Lawn', roof: 'Roof Top', rooftop: 'Roof Top' };
  var TYPE = { pickup: 'Takeaway - Pickup', delivery: 'Takeaway - Delivery' };

  function load(key) { try { return JSON.parse(localStorage.getItem(key) || '[]'); } catch (e) { return []; } }
  function fmtTime(min) { min = +min; var h = Math.floor(min / 60), m = min % 60; return ((h + 11) % 12 + 1) + ':' + pad(m) + ' ' + (h >= 12 ? 'pm' : 'am'); }
  function stamp(iso) { var d = new Date(iso); return isNaN(d) ? '' : d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + ' ' + fmtTime(d.getHours() * 60 + d.getMinutes()); }
  function seatName(k) { return SEAT[k] || k; }
  function cuisineName(k) { return CUISINE[k] || k; }

  function orderRow(o) {
    var d = o.details || {}, e = o.eta || {}, t = o.totals || {};
    var pick = o.type === 'pickup' ? (d.time === 'asap' ? 'As soon as possible' : 'Scheduled ' + fmtTime(d.time)) : 'Delivery';
    return {
      'Order ID': o.id, 'Placed at': stamp(o.placedAt), 'Order type': TYPE[o.type] || o.type,
      'Customer name': d.name || '', 'Phone': d.phone || '', 'Delivery address': o.type === 'delivery' ? (d.address || '') : '',
      'Pickup option': pick,
      'Estimated time shown': e.value ? (e.title + ' ' + e.value) : (e.title || ''),
      'Items': (o.lines || []).map(function (l) { return l.qty + ' x ' + l.name; }).join('; '),
      'Item count': (o.lines || []).reduce(function (a, l) { return a + l.qty; }, 0),
      'Subtotal (Rs)': t.sub || 0, 'GST 16% (Rs)': t.gst || 0, 'Delivery fee (Rs)': t.del || 0, 'Total (Rs)': t.total || 0,
      'Customer notes': d.notes || ''
    };
  }
  function itemRows(orders) {
    var out = [];
    orders.forEach(function (o) { (o.lines || []).forEach(function (l) {
      out.push({ 'Order ID': o.id, 'Placed at': stamp(o.placedAt), 'Customer name': (o.details || {}).name || '', 'Item': l.name, 'Quantity': l.qty, 'Unit price (Rs)': l.price, 'Line total (Rs)': l.total });
    }); });
    return out;
  }
  function resRow(r) {
    var ages = (r.kids || []).map(function (a) { return a === 0 || a === '0' ? 'under 1' : a; });
    return {
      'Reservation ID': r.id, 'Placed at': stamp(r.placedAt), 'Booking date': r.date, 'Booking time': fmtTime(r.time),
      'Adults': r.adults, 'Kids': (r.kids || []).length, 'Kids ages': ages.join(', '), 'Total guests': r.guests || (r.adults + (r.kids || []).length),
      'Cuisine': cuisineName(r.cuisine), 'Seating': seatName(r.seating), 'VVIP extra charge (Rs)': r.seating === 'vvip' ? 2500 : 0
    };
  }

  function table(rows, cols) {
    if (!rows.length) return '<div class="empty">Nothing here yet.</div>';
    return '<table class="t"><thead><tr>' + cols.map(function (c) { return '<th' + (/Rs|Total|Adults|Kids$/.test(c[0]) ? ' class="r"' : '') + '>' + esc(c[0]) + '</th>'; }).join('') + '</tr></thead><tbody>' +
      rows.map(function (r) { return '<tr>' + cols.map(function (c) { var v = r[c[1]]; return '<td' + (/Rs|Total|Adults|Kids$/.test(c[0]) ? ' class="r"' : '') + '>' + esc(typeof v === 'number' && /Rs/.test(c[1]) ? v.toLocaleString('en-US') : v) + '</td>'; }).join('') + '</tr>'; }).join('') + '</tbody></table>';
  }

  function render() {
    var orders = load('riwayat_orders'), res = load('riwayat_reservations');
    var oRows = orders.map(orderRow).reverse(), rRows = res.map(resRow).reverse();
    var rev = orders.reduce(function (a, o) { return a + ((o.totals || {}).total || 0); }, 0);
    $('#stats').innerHTML = '<div><b>' + orders.length + '</b>Takeaway orders</div><div><b>Rs ' + rev.toLocaleString('en-US') + '</b>Order value</div><div><b>' + res.length + '</b>Reservations</div>';
    $('#ordersWrap').innerHTML = table(oRows, [['Order ID', 'Order ID'], ['Placed at', 'Placed at'], ['Type', 'Order type'], ['Customer', 'Customer name'], ['Phone', 'Phone'], ['Address', 'Delivery address'], ['Estimated time', 'Estimated time shown'], ['Items', 'Items'], ['Total (Rs)', 'Total (Rs)']]);
    $('#resWrap').innerHTML = table(rRows, [['Reservation ID', 'Reservation ID'], ['Placed at', 'Placed at'], ['Date', 'Booking date'], ['Time', 'Booking time'], ['Adults', 'Adults'], ['Kids', 'Kids'], ['Kids ages', 'Kids ages'], ['Cuisine', 'Cuisine'], ['Seating', 'Seating']]);
    var url = (window.RIWAYAT_CONFIG || {}).sheetUrl;
    $('#src').innerHTML = url ?
      '<b>Online collection is ON.</b> Every customer order is also sent to your Google Sheet. The table above shows only orders placed in <b>this browser</b>; open your Google Sheet to see all of them.' :
      '<b>Showing data saved in this browser only.</b> Orders placed on other phones or computers are not visible here. To collect orders from all customers into one Excel/Google Sheet, follow <code>docs/google-sheet-setup.md</code> (5 minutes).';
    return { orders: orders, res: res, oRows: oRows, rRows: rRows };
  }

  function sheet(rows, widths, headers) {
    var ws = rows.length ? XLSX.utils.json_to_sheet(rows) : XLSX.utils.aoa_to_sheet([headers]);
    ws['!cols'] = widths.map(function (w) { return { wch: w }; });
    return ws;
  }
  function exportXlsx() {
    var orders = load('riwayat_orders'), res = load('riwayat_reservations');
    var wb = XLSX.utils.book_new();
    var oh = ['Order ID', 'Placed at', 'Order type', 'Customer name', 'Phone', 'Delivery address', 'Pickup option', 'Estimated time shown', 'Items', 'Item count', 'Subtotal (Rs)', 'GST 16% (Rs)', 'Delivery fee (Rs)', 'Total (Rs)', 'Customer notes'];
    var ih = ['Order ID', 'Placed at', 'Customer name', 'Item', 'Quantity', 'Unit price (Rs)', 'Line total (Rs)'];
    var rh = ['Reservation ID', 'Placed at', 'Booking date', 'Booking time', 'Adults', 'Kids', 'Kids ages', 'Total guests', 'Cuisine', 'Seating', 'VVIP extra charge (Rs)'];
    XLSX.utils.book_append_sheet(wb, sheet(orders.map(orderRow), [18, 18, 18, 20, 15, 34, 20, 26, 60, 10, 13, 13, 14, 12, 30], oh), 'Orders');
    XLSX.utils.book_append_sheet(wb, sheet(itemRows(orders), [18, 18, 20, 38, 9, 14, 14], ih), 'Order Items');
    XLSX.utils.book_append_sheet(wb, sheet(res.map(resRow), [18, 18, 14, 12, 8, 6, 12, 12, 16, 14, 20], rh), 'Reservations');
    var d = new Date(), name = 'Riwayat-Orders-' + d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate()) + '.xlsx';
    XLSX.writeFile(wb, name);
  }

  $('#btnXlsx').addEventListener('click', exportXlsx);
  $('#btnRefresh').addEventListener('click', render);
  $('#btnClear').addEventListener('click', function () {
    if (confirm('Delete all orders and reservations saved in this browser? Download the Excel first.')) { localStorage.removeItem('riwayat_orders'); localStorage.removeItem('riwayat_reservations'); render(); }
  });
  render();
})();
