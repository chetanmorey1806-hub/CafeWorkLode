# ☕ Cafe Manager (React)

Cafe management app built with React + Vite. Works on desktop, tablet and mobile.

## Run

```bash
npm install
npm start          # builds the app and runs the café server on http://<this-pc>:4000  ← use this in the café
npm run dev:all    # development: Vite (5173) + server (4000) with hot reload
npm run dev        # frontend only (offline mode, data stays in this browser)
```

Open the app on the café computer, tablets (kitchen screen) and phones using the **Network** address the server prints.
All devices stay in sync live. The default PIN is `1234`; a device with a different PIN shows **Enter PIN** in the top bar.

### QR ordering

1. **Tables → QR Codes → Print all**, then stick one QR on each table.
2. A customer scans it → menu opens in their phone browser (no app download) → they order.
3. The order appears instantly on **Kitchen** and **Orders** with a **QR** badge, a sound and a notification.
4. The customer's phone shows live status: Order placed → Preparing → Ready → Served → Paid.
5. The customer pays at the counter or with UPI (opens GPay/PhonePe with the amount filled in); staff confirm it in **Pay**.

Phones must be on the café Wi-Fi. To accept orders from anywhere, host the server online (any Node host or VPS,
then set **Settings → QR Ordering → Public website address**).

### Architecture

| Part | Tech |
|---|---|
| Frontend (staff app + customer page) | React 18 + Vite, lucide-react icons |
| Backend | Node.js + Express + WebSocket (`ws`) — `server/index.js` |
| Storage | JSON file `server/data/db.json` (atomic writes); easy to swap for MongoDB/PostgreSQL later |
| Shared logic | `src/context/reducer.js` + `src/utils/loyalty.js` run on **both** browser and server |
| Public API | `GET /api/public/menu?table=t1`, `POST /api/public/orders`, `GET /api/public/orders/:id?token=`, WebSocket `/ws?role=track` |

## Modules
| Page | What it does |
|---|---|
| Dashboard | Today's sales, active orders, tables occupied, 7-day chart, top items, low-stock alerts |
| New Order (POS) | Dine-in / Takeaway / Delivery, table select, item notes, send KOT or pay directly |
| Orders | Running / paid / cancelled orders, edit, mark served, pay, view & print bill |
| Kitchen | KOT display: New → Preparing → Ready → Served (orders older than 15 min turn red) |
| Tables | Live table status. Tap a free table to start an order, tap a busy one to open its order |
| Menu | Items, categories, price, veg/non-veg, availability toggle |
| Inventory | Stock in/out, low-stock alerts, auto-add a purchase as an expense |
| Customers | Customer list, visits, total spent, loyalty points, order history |
| Staff | Staff, roles, salary, daily attendance (P/H/A) |
| Expenses | Rent, salary, supplies etc. with filters |
| Reports | Revenue, profit, GST, payment split, category/item sales, busy hours, CSV export |
| Settings | Cafe details, GST %, bill footer, backup/restore, reset, loyalty rules, UPI ID, notifications |
| QR ordering | Per-table QR codes, customer menu with smart upselling, "Order again", split calculator, UPI, live tracking |
| Loyalty | Points, stamp card (buy 5 get 1 free), Silver/Gold/Platinum tier discounts, wallet top-ups, monthly coffee pass |
| Billing | Split bill (any mix of cash/UPI/card/wallet), wallet payment, automatic loyalty perks |
| Inventory | Menu recipes deduct stock on payment, auto "sold out", low-stock alerts (toast + desktop notification) |

Data is saved in the browser's localStorage. Use **Settings → Download Backup** regularly.
