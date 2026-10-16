# Riwayat (روایت) Restaurant — Conceptual Ordering Website

A conceptual demo restaurant site (MM Alam Road, Lahore) with live takeaway ordering, table reservations, a chatbot and an admin panel. No real payments.

## Live
- GitHub Pages: https://quantumcraftpk.github.io/Riwayat/
- Vercel: https://riwayat-seven.vercel.app/
- Admin: `/admin.html` on either address (not linked from the public site). Both addresses use the same Firebase data.
- Every `git push` to `main` updates both hosts. There is no build step.

## Customer features
- Takeaway: Order Type → Menu → Cart → Bill → Details → Confirm. Pickup or Delivery. Live status tracking.
- Dine In: date and time, guests, kids' ages, cuisine, seating, with booking rules enforced (closed days, blocked times, party size, notice, capacity per time slot).
- Chatbot (English and Roman Urdu): answers questions, looks up order status, books tables and takes takeaway orders inside the chat.
- Menu page, gallery, celebrations, downloadable PDF menu, welcome popup.

## Admin panel
Sign in with the administrator account (Firebase Authentication). Tabs:
- Orders and Reservations: status changes, print slip, delete (admin only), new-order alerts (chime, banner, flashing tab title) while the page is open
- Dashboard, Menu, Prices & Sold out, Celebrations, Settings (contact, hours, GST, delivery, booking rules)
- Excel: spreadsheet of orders, items and reservations (for reporting)
- Backup: download one JSON file with everything; restore with preview, tick boxes and an automatic safety copy
- Staff: staff accounts can see orders and reservations and change their status only
- Access (private preview): a pass-code screen (two codes, no user name) in front of the website and the admin page. Set or change the codes and switch the gate on or off in Admin → Access. Codes are stored hashed in `site/access`. The code is asked again each time the browser is closed.
  - Locked out? In Firebase → Firestore → `site/access`, set the field `json` to `{"on":false}`.
  - When the site goes public: switch the gate off in Admin → Access and delete the `noindex` line near the top of `index.html`, `menu.html` and `order.html`.

## Backend
- Firebase project `riwayat-41034` (Firestore + Authentication) over plain REST (`js/fs.js`). No SDK, no server.
- Content: `site/menu`, `site/celebrations`, `site/settings`. Records: `orders`, `reservations`. Staff list: `config/staff`.
- Public pages read the live content through `js/boot.js` and fall back to the built-in data in `data/` if Firebase cannot be reached.
- Security rules: `docs/firestore.rules` (paste into Firebase Console → Firestore → Rules → Publish). Admin sign-in on a new web address needs that address added under Authentication → Settings → Authorized domains.
- The Firebase web API key in `js/firebase-config.js` is a public identifier, not a secret. Access is controlled by the rules.
- Capacity limits are advisory in the admin panel, because public pages cannot read reservations.

## Structure
- `assets/` images, gallery, team photos, PDF menu · `css/` styles · `data/` built-in menu and celebrations · `docs/` rules
- `js/` scripts: `fs.js` Firestore client, `sync.js` order sync, `order.js` order/booking page, `chatbot.js`, `admin-app.js`, `admin-alerts.js`
- `js/config.js` and `docs/google-sheet-setup.md` belong to an old Google Sheet option and are not used.

## Business details used
- Hours: Mon–Fri 12:00 pm–11:00 pm; Sat & Sun 8:00 am–12:00 am
- Phone 0306-0005226 · management@riwayat.com · MM Alam Road, Gulberg, Lahore
- VVIP Hall: Rs 2,500 additional · Prices exclude GST (16% GST and Rs 200 delivery are demo assumptions)

## Run locally
Open `index.html` in a browser, or run `python -m http.server` in this folder and visit http://localhost:8000.

## Notes
- `assets/Riwayat-Menu.pdf` is a static file made from the menu data (18 pages). It does not update when the menu is edited in admin.
- Before a demo: delete test orders and reservations in admin, then download a fresh Backup.
