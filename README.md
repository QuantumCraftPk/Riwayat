# Riwayat (روایت) Restaurant — Conceptual Ordering Website

A conceptual demo: restaurant site with a simulated online-ordering flow. No real payments or backend.

## Planned flow
Takeaway: Order Type → Menu → Cart → Bill Review → Customer Details → Confirm Order
Dine In: Order Type → Reservation (date & time, persons, cuisine, seating) → Reservation Confirmed

## Features
- Responsive (mobile + desktop)
- Gallery, downloadable PDF menu, chatbot assistant

## Structure
- `assets/img` logo + hero · `assets/gallery` photos
- `css/` styles · `js/` scripts · `data/` menu data

## Status
Complete (concept / demo). Takeaway order flow and Dine In reservation are simulated: no payments, no backend. Orders and reservations are stored in the browser only.

## Business details used
- Hours: Mon–Fri 12:00 pm–11:00 pm; Sat & Sun 8:00 am–12:00 am
- Phone 0306-0005226 · management@riwayat.com · MM Alam Road, Gulberg, Lahore
- VVIP Hall: Rs 2,500 additional · Prices exclude GST (16% GST and Rs 200 delivery are demo assumptions)

## Run locally
Open `index.html` in a browser, or run `python -m http.server` in this folder and visit http://localhost:8000.

## Menu PDF
`assets/Riwayat-Menu.pdf` is generated from the menu data (18 pages, A4).


## Admin panel (Firebase)

- Open `admin.html` (not linked from the public site). Sign in with the administrator account created in Firebase Authentication.
- Tabs: Orders, Reservations (status tracking), Menu (dishes, descriptions, categories), Prices & Sold out (bulk % change), Celebrations (themes, minimum guests, photo path), Settings (contact, hours, GST, delivery fee, VVIP charge, max delivery time), Excel export.
- Content is stored in Firestore (`site/menu`, `site/celebrations`, `site/settings`, `orders`, `reservations`). The public pages read it through `js/boot.js` and fall back to the built-in data in `data/` if the database cannot be reached.
- Security rules are in `docs/firestore.rules` and must be pasted into Firebase Console > Firestore > Rules > Publish.
- `assets/Riwayat-Menu.pdf` is a static file and does not update when the menu is edited.
- `js/config.js` and `docs/google-sheet-setup.md` belong to the old Google Sheet option and are no longer used.
