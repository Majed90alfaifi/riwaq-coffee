# ☕ RIWAQ Coffee — رِواق

A bilingual (Arabic / English) specialty-coffee storefront with a full admin panel, built on **Vinext (Next.js on Vite)**, **Cloudflare Workers** and **D1 (SQLite)**.

### 🔗 Live demo: **[riwaq-coffee.mj99.workers.dev](https://riwaq-coffee.mj99.workers.dev)**
### 📱 Live QR menu: **[riwaq-coffee.mj99.workers.dev/menu/bait-alhail](https://riwaq-coffee.mj99.workers.dev/menu/bait-alhail)**

Try the full journey: browse → add to bag → delivery details (use **تعبئة بيانات تجريبية**) → sandbox payment → confirmation. The admin panel is disabled on the public link; run locally to demo it.

> ⚠️ **Demo / sandbox only.** Payments, shipping, invoicing and email are simulated. No real provider integrations are enabled — do not use this to take real orders.

---

## ✨ Features

**Storefront**
- Full Arabic (RTL) and English (LTR) UI with a language toggle
- Product catalog with variants (weight × grind), live stock and pricing
- Cart and server-side quote calculation (integer halala math — no floating-point rounding errors)
- Guest checkout in four clear steps: bag → delivery details → **sandbox payment** → confirmation
- Simulated payment gateway (success or failure), clearly labelled; no card data collected
- "My orders" page listing orders placed from this browser (private receipt tokens, no account needed)
- Traditional Sadu-pattern artwork and Arabic typography (IBM Plex Sans Arabic, Reem Kufi)

**Admin panel** (`/#/admin`)
- Create, edit and hide products; manage inventory
- Optimistic concurrency — stale edits are rejected with `409 Conflict`
- View orders and stock reservations
- Simulated payment events (paid / failed / cancelled / expired / refunded)
- Audit log of every admin action
- One-click consistent JSON backup snapshot

**Backend & safety**
- Stock reservations with exactly-once release on failure/cancel/expiry
- Idempotent order creation (request keys)
- Same-origin checks on mutations, bounded JSON bodies, rate limiting
- Server-side admin authorization (the UI hiding controls is never the only guard)
- Security response headers set in the Worker

---

## 🧱 Tech stack

| Layer | Tech |
|---|---|
| Frontend | Vanilla JS + CSS (`public/`), shadcn/ui components available |
| Framework | [Vinext](https://www.npmjs.com/package/vinext) (Next.js 16 API on Vite 8), React 19 |
| Runtime | Cloudflare Workers (Wrangler) |
| Database | Cloudflare D1 (SQLite) with [Drizzle ORM](https://orm.drizzle.team/) |
| Tests | Node's built-in test runner + `node:sqlite` |
| Language | TypeScript / ESM JavaScript |

---

## 📁 Project structure

```
app/            Next-style routes (API catch-all, root route, layout)
worker/         Cloudflare Worker entry + security headers
server/         Business logic
  api.mjs         routing, auth, rate limits, request validation
  commerce.mjs    quotes, orders, reservations, payment transitions
  backup.mjs      consistent DB snapshot export
  seed*.mjs       demo catalog data
public/         Storefront & admin UI (app.js, core.js, art.js, style.css, fonts, patterns)
db/             Drizzle schema
drizzle/        SQL migrations
tests/          Regression & acceptance tests
docs/           Runbook, Arabic release report, test results
components/     shadcn/ui component library
scripts/        Build / dev / install helpers
```

### Data model

`products` · `variants` · `inventory` · `customers` · `orders` · `order_lines` · `payment_events` · `audit` · `outbox` · `rate_limits`

---

## 🚀 Getting started

**Requirements:** Node.js ≥ 22.13 (Node 24 for the test suite) and pnpm 11.

```bash
# 1. Install dependencies
pnpm install

# 2. Create local env file
cp .env.example .dev.vars
#   CATALOG_SEED=demo            → seeds a fictional coffee catalog on first request
#   ADMIN_EMAIL=seedy@sites.test → the local mock sign-in account, so /#/admin works locally

# 3. Create the local database (safe to re-run; `pnpm db:reset` wipes it and starts fresh)
pnpm db:setup

# 4. Run in development → http://localhost:5173
pnpm dev
```

> No pnpm? Use `npm i -g pnpm`, or run the scripts directly: `node scripts/setup-local-db.mjs` and `node scripts/run-framework.mjs dev`.

### Demo walkthrough (≈2 minutes)

1. **Home** → pick a coffee, or use **ساعدني أختار** (three-question taste quiz).
2. **Product** → choose weight and grind → **أضف إلى السلة**.
3. **Bag** → change options/quantity; a free-shipping progress bar shows how far you are from 180 SAR.
4. **Delivery details** → click **تعبئة بيانات تجريبية** to fill test data → continue.
5. **Sandbox payment** → pick a method (display only) → **إتمام الدفع التجريبي** for success, or **محاكاة فشل الدفع** to see the failure + retry path. No card data is requested and nothing is charged.
6. **Confirmation** → order number, items and totals; the order also appears under **طلباتي**.
7. **Admin** (footer → دخول الإدارة) → sign in locally, see the order, edit stock/prices, view the audit log.

See [docs/RUNBOOK.md](docs/RUNBOOK.md) for full details.

---

## 📱 QR menu service (منيو QR)

A separate digital-menu product for cafés and restaurants, living alongside the store. It has its own tables, API, pages and per-venue branding, and does not touch the store's products or identity.

| Page | Live | Local |
|---|---|---|
| Service overview + demo venues | [/menu](https://riwaq-coffee.mj99.workers.dev/menu) | http://localhost:5173/menu |
| Public menu (what guests see after scanning) | [/menu/bait-alhail](https://riwaq-coffee.mj99.workers.dev/menu/bait-alhail) | http://localhost:5173/menu/bait-alhail |
| Empty-menu example | [/menu/sunbula](https://riwaq-coffee.mj99.workers.dev/menu/sunbula) | http://localhost:5173/menu/sunbula |
| Owner admin (sign-in required) | disabled on the public link | http://localhost:5173/menu-admin |

- **Guests:** mobile-first menu, Arabic by default with English toggle, sticky section chips, Arabic-aware search, item details sheet, badges, "unavailable now", open/closed status (Saudi time), share link, empty/not-found/error states.
- **Owners:** edit venue info, colour, hours and contacts; add, rename, delete and reorder sections; add, edit, move and delete items (name, description, price, image, badges); one-tap availability toggle; live phone preview; QR tab with copy, SVG/PNG download and printable table card; "restore demo data" for demo venues.
- **Storage:** D1 tables `menu_venues`, `menu_categories`, `menu_items` (migration `drizzle/0001_qr_menu.sql`), with optimistic versions and audit-log entries. Included in the admin JSON backup.
- **Security:** admin APIs reuse the store's server-side `admin()` guard (trusted identity headers + `ADMIN_EMAIL`), same-origin checks, body limits and rate limiting. Admin is disabled on the public Cloudflare build (`PUBLIC_DEMO=1`).
- **QR:** generated in-browser by `public/menu/qr.js` (no dependency; verified by decoding). On localhost the code points to a local URL that other phones cannot open; the UI says so and lets you enter the public URL after deployment.
- **Demo content:** both venues, their prices and texts are fictional; images are bundled illustrations, labelled as such.

---

## ☁️ Public demo on Cloudflare (free plan)

```bash
node node_modules/wrangler/bin/wrangler.js login   # once, opens the browser
node scripts/deploy-cloudflare.mjs                  # every release (pnpm deploy:cloudflare)
```

The script creates the D1 database `riwaq-coffee-db` on first run, applies migrations, builds and deploys to `https://riwaq-coffee.<your-subdomain>.workers.dev` (currently [riwaq-coffee.mj99.workers.dev](https://riwaq-coffee.mj99.workers.dev)). The catalog seeds itself on the first visit.

The public build sets `PUBLIC_DEMO=1`: identity headers are stripped and **the admin panel is disabled**, because there is no trusted sign-in in front of a plain Worker. Use the local version for admin demos.

---

## 🧪 Tests

```bash
pnpm test        # node --test tests/commerce.test.mjs tests/menu.test.mjs
pnpm typecheck   # tsc --noEmit
pnpm lint
```

Latest run: **32 / 32 passing** — see [docs/test-results.txt](docs/test-results.txt).

Covers quote math, overselling prevention, idempotency, reservation expiry, stale-edit rejection, payload limits, unauthorized access, refunds, and backup/restore consistency.

---

## 🔐 Configuration

| Variable | Purpose |
|---|---|
| `ADMIN_EMAIL` | Verified email allowed to use the admin panel |
| `ADMIN_EMAILS` | Optional extra admin emails (comma/space separated) |
| `CATALOG_SEED` | Set to `demo` to seed sample products when the catalog is empty |

Secrets live in `.dev.vars` locally (git-ignored) or in the hosting environment's settings — never in source.

> Admin identity is read from headers set by the trusted hosting ingress. Don't expose the Worker directly to the internet without replacing that auth boundary.

---

## 📚 Documentation

- [Operations, deployment, backup & recovery runbook](docs/RUNBOOK.md)
- [Release & acceptance report (Arabic)](docs/RELEASE_REPORT_AR.md)
- [Automated test output](docs/test-results.txt)

---

## 📄 License & credits

Fonts: IBM Plex Sans Arabic and Reem Kufi, under the SIL Open Font License (see `public/fonts/`).
Vendored shadcn/Tailwind CSS and the Sites Vite plugin keep their own license files.
