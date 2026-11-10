# ☕ Cafe Manager (React)

Cafe management app built with React + Vite. Works on desktop, tablet and mobile.

## Run
```bash
npm install
npm run dev        # http://localhost:5173 (also reachable from your phone on the same Wi-Fi)
npm run build      # production build in dist/
```

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
| Settings | Cafe details, GST %, bill footer, backup/restore, reset |

Data is saved in the browser's localStorage. Use **Settings → Download Backup** regularly.
