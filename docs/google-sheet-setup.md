# Collect every order in one Google Sheet / Excel (5 minutes, free)

A website on GitHub Pages has no server, so orders normally stay inside the customer's own browser.
To get **all** orders and reservations from **all** customers in one place:

1. Go to https://sheets.google.com and create a blank sheet named **Riwayat Orders**.
2. Menu **Extensions → Apps Script**. Delete the sample code and paste the script below. Click **Save**.
3. Click **Deploy → New deployment → type: Web app**.
   - Execute as: **Me**
   - Who has access: **Anyone**
   - Click **Deploy**, allow the permissions, and **copy the Web app URL**.
4. Open `js/config.js` in the Riwayat folder and paste the URL between the quotes: `sheetUrl: 'https://script.google.com/macros/s/.../exec'`
5. Commit and push (`git add .`, `git commit -m "Connect sheet"`, `git push`).

From then on every confirmed order and reservation appears as a new row in the sheet.
To get Excel: in Google Sheets choose **File → Download → Microsoft Excel (.xlsx)**.

## Script to paste (Apps Script)

```javascript
var HEAD = {
  Orders: ['Order ID','Placed at','Order type','Customer name','Phone','Delivery address','Pickup option','Estimated time shown','Items','Item count','Subtotal (Rs)','GST 16% (Rs)','Delivery fee (Rs)','Total (Rs)','Customer notes'],
  'Order Items': ['Order ID','Placed at','Customer name','Item','Quantity','Unit price (Rs)','Line total (Rs)'],
  Reservations: ['Reservation ID','Placed at','Booking date','Booking time','Adults','Kids','Kids ages','Total guests','Cuisine','Seating','VVIP extra charge (Rs)']
};
var CUISINE = {desi:'Desi',arabic:'Arabic',continental:'Continental',chinese:'Chinese',buffet:'Buffet',mix:'Mix',undecided:'Not decided yet'};
var SEAT = {vvip:'VVIP Hall',indoor:'Indoor',terrace:'Terrace',lawn:'Lawn',rooftop:'Roof Top'};

function sh(name) {
  var ss = SpreadsheetApp.getActiveSpreadsheet(), s = ss.getSheetByName(name);
  if (!s) { s = ss.insertSheet(name); s.appendRow(HEAD[name]); s.setFrozenRows(1); s.getRange(1,1,1,HEAD[name].length).setFontWeight('bold'); }
  return s;
}
function clock(min) { min = +min; var h = Math.floor(min/60), m = min%60; return ((h+11)%12+1)+':'+(m<10?'0':'')+m+' '+(h>=12?'pm':'am'); }
function stamp(iso) { return Utilities.formatDate(new Date(iso), 'Asia/Karachi', 'yyyy-MM-dd hh:mm a'); }

function doPost(e) {
  var data = JSON.parse(e.postData.contents), r = data.record, lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    if (data.kind === 'order') {
      var d = r.details || {}, t = r.totals || {}, eta = r.eta || {};
      var pick = r.type === 'pickup' ? (d.time === 'asap' ? 'As soon as possible' : 'Scheduled ' + clock(d.time)) : 'Delivery';
      var items = (r.lines || []).map(function (l) { return l.qty + ' x ' + l.name; }).join('; ');
      var count = (r.lines || []).reduce(function (a, l) { return a + l.qty; }, 0);
      sh('Orders').appendRow([r.id, stamp(r.placedAt), r.type === 'delivery' ? 'Takeaway - Delivery' : 'Takeaway - Pickup', d.name||'', "'" + (d.phone||''), r.type === 'delivery' ? (d.address||'') : '', pick, eta.value ? eta.title + ' ' + eta.value : (eta.title||''), items, count, t.sub||0, t.gst||0, t.del||0, t.total||0, d.notes||'']);
      (r.lines || []).forEach(function (l) { sh('Order Items').appendRow([r.id, stamp(r.placedAt), d.name||'', l.name, l.qty, l.price, l.total]); });
    } else if (data.kind === 'reservation') {
      var kids = r.kids || [];
      sh('Reservations').appendRow([r.id, stamp(r.placedAt), r.date, clock(r.time), r.adults, kids.length, kids.map(function (a) { return a === '0' || a === 0 ? 'under 1' : a; }).join(', '), r.guests, CUISINE[r.cuisine] || r.cuisine, SEAT[r.seating] || r.seating, r.seating === 'vvip' ? 2500 : 0]);
    }
  } finally { lock.releaseLock(); }
  return ContentService.createTextOutput('ok');
}
```

Notes
- Only people with the Google account can open the sheet; customers cannot read it.
- If you change the script later, use **Deploy → Manage deployments → Edit → New version**.
- This is a demo: do not collect real customer data unless you also add proper privacy handling.
