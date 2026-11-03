# boxel store

The e-commerce website for **boxel — Smart. Safe. Simple.**

| Part | Stack |
|---|---|
| Storefront and admin | React 19 + Vite, Tailwind CSS 4, React Router 7, Framer Motion, Lucide icons |
| API | Node.js + Express 5 |
| Database | MySQL / MariaDB (XAMPP) through `mysql2` with parameterised queries |
| Sign-in | Server-side sessions stored in MySQL, HTTP-only `SameSite=Lax` cookie, bcrypt password hashes, CSRF tokens |
| Email | Nodemailer over SMTP, every send logged and retryable |

```
furniture-boxel/            ← project root ("boxel-store")
├─ client/                  React app (Vite)
│  ├─ public/images/        logo + product photos
│  └─ src/
│     ├─ admin/             admin app (/admin/*), lazy-loaded
│     ├─ components/        shared UI, product, cart, home sections
│     ├─ context/           site settings, auth, cart, toasts
│     ├─ hooks/  layouts/  pages/  services/  styles/  utils/
├─ server/                  Express API
│  ├─ config/ controllers/ middleware/ routes/ services/ utils/
│  ├─ scripts/              create-admin, setup-test-db
│  ├─ tests/                API tests (node:test + supertest)
│  ├─ uploads/              admin-uploaded images
│  ├─ app.js  server.js  .env.example
├─ database/
│  ├─ schema.sql            tables, keys, constraints
│  └─ seed.sql              categories, the Parcel Drop Box, FAQs, settings
└─ README.md
```

---

## 1. Set up on Windows with XAMPP

### 1.1 Install the tools
1. Install **Node.js 20 LTS or newer** from <https://nodejs.org> (tested with Node 22). Check it in a new terminal with `node -v`.
2. Install **XAMPP** (includes MySQL/MariaDB and phpMyAdmin).

### 1.2 Install the project dependencies
In a terminal at the project folder (`C:\xampp\htdocs\furniture-boxel`):

```bash
npm install --prefix server
npm install --prefix client
```

(or `npm run install:all`)

### 1.3 Start MySQL
Open the **XAMPP Control Panel**. Start **Apache** (only needed for phpMyAdmin) and **MySQL**.

### 1.4 Create the database
1. Open <http://localhost/phpmyadmin>.
2. Click **New**, enter the name `boxel_store`, choose collation **utf8mb4_unicode_ci**, then click **Create**.

### 1.5 Import the schema, then the seed
1. Select the `boxel_store` database, open **Import**, choose `database/schema.sql` and click **Import**.
2. Repeat with `database/seed.sql`.

Using the command line instead:

```bash
C:\xampp\mysql\bin\mysql.exe -u root boxel_store < database\schema.sql
C:\xampp\mysql\bin\mysql.exe -u root boxel_store < database\seed.sql
```

> Import `seed.sql` **once**. It contains no customers, orders, reviews or admin accounts.

### 1.6 Configure `server/.env`
```bash
copy server\.env.example server\.env
```
Then edit `server/.env`:
- **`SESSION_SECRET`**: required. Paste the output of `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`.
- **`DB_*`**: the defaults match a fresh XAMPP install (user `root`, empty password).
- **`CLIENT_URL`**: the address customers use (development: `http://localhost:5173`).

### 1.7 Configure SMTP (email)
Fill these in `server/.env`, then restart the server:

| Variable | Example (Gmail with an App Password) |
|---|---|
| `SMTP_HOST` | `smtp.gmail.com` |
| `SMTP_PORT` | `587` (or `465` with `SMTP_SECURE=true`) |
| `SMTP_SECURE` | `false` for 587, `true` for 465 |
| `SMTP_USER` | your mailbox login |
| `SMTP_PASSWORD` | an app password, not your normal password |
| `SMTP_FROM_EMAIL` | the address emails come from |
| `ADMIN_EMAIL` | the inbox that receives new-order and enquiry alerts |

If SMTP is empty, the store still works: emails are recorded in the email log as **skipped** and can be retried later.

### 1.8 Create the first administrator
```bash
npm run create-admin --prefix server
```
The script asks for a name, email and password. The password input is hidden; it needs at least 10 characters with letters and numbers. The password is stored as a bcrypt hash. The script **refuses to change an existing account** unless you type `yes`. There is no public admin sign-up route; more admins are added from **Admin → Admin users**.

### 1.9 Upgrade an existing database
Run the additive app schema migration after updating the code. It creates missing app tables and fields for order workflows, media uploads, notifications and vendors without inserting sample vendor records:
```bash
npm run migrate:app-schema --prefix server
```

### 1.10 Start the API and the website (two terminals)
```bash
npm run dev --prefix server     # API → http://localhost:5000
npm run dev --prefix client     # Website → http://localhost:5173
```
Vite forwards `/api`, `/uploads`, `/sitemap.xml` and `/robots.txt` to the API, so the browser only talks to `localhost:5173`.

| Service | Address |
|---|---|
| Website | http://localhost:5173 |
| Admin | http://localhost:5173/admin |
| API | http://localhost:5000 (health check: `/api/health`) |
| MySQL | localhost:3306 |

---

## 2. Before you take real orders: business decisions to make in the admin

The seed data deliberately invents nothing. Until you fill these in, the site shows honest placeholders:

| What | Where | Until it is set |
|---|---|---|
| **Parcel Drop Box price** | Admin → Products → boxel Parcel Drop Box → Pricing | Shows "Price coming soon"; add-to-cart and checkout refuse it (also enforced by the server) |
| **Payment method** | Admin → Store settings → Payments | Checkout is closed. Enable **cash on delivery** and/or **pay on confirmation** only if the business offers them. Online card/UPI stays off until a payment provider is integrated. |
| Business email, city, state, address, map | Admin → Business contact | Hidden from the site |
| Store or service area | Admin → Business contact → Location | Shows "Delivering across India" |
| Social profiles | Admin → Social links | The "Follow boxel" section and footer icons stay hidden |
| Warranty duration and terms | Admin → Shipping & policies | The policy says the terms will be published |
| Returns and cancellation terms | Admin → Shipping & policies | The policy asks customers to contact you |
| Privacy policy and terms text | Admin → Store settings → Legal pages | Starter text describing what the site actually does. **Have it reviewed.** |
| Tax (GST) | Admin → Store settings → Tax | No tax lines are shown |
| Product dimensions and other specifications | Admin → Products → Specifications | Only verified attributes are listed |

---

## 3. Test checklist (steps 12–19 of the setup)

1. **Catalogue**: open `/products`. Search, filter by category or availability, and sort. Coming-soon categories show a "coming soon" message and can never be added to the cart.
2. **Price and payment**: in the admin, set a price for the Parcel Drop Box and enable a payment method.
3. **Cart, quantity and colour**: on the product page, pick a colour (variants come from the admin), change the quantity, then add to cart. The cart count updates and the drawer opens. Totals in the cart are **recalculated by the server** from live prices.
4. **Place a test order**: go to checkout. Submit an empty form to see the validation, then fill in an Indian mobile number (`98450 12345`, `+91 98450 12345` and `09845012345` are all accepted) and a PIN code (`560 038` or `560038`). Place the order.
5. **Check that it saved in MySQL**: in phpMyAdmin, look in `orders`, `order_items` (snapshot of name, colour and price), `payments` (status `pending`) and `order_status_history`.
6. **Emails**: see Admin → Email → Email log. With SMTP configured, the customer confirmation and the admin alert show **sent**. Failed emails have a **Retry** button there and on the order page.
7. **Admin**: sign in at `/admin/login`. The dashboard shows live figures. Open the order and move it through Confirmed → In production → Shipped → Delivered. Add tracking and an internal note, record the payment, and print the summary.
8. **Manage content**: add, edit, archive or delete products and categories. Change the homepage hero under **Homepage & banners**. Moderate reviews, answer enquiries, edit FAQs. Then refresh the public site to see the changes.

### Automated API tests
```bash
npm test --prefix server
```
This recreates a **separate database, `boxel_store_test`**, from the SQL files and runs 35 tests. They cover:
- Authentication: sign-up, sign-in and sign-out, generic error messages
- CSRF protection and the HTTP-only cookie
- Product listing and product detail
- Admin access control and roles
- Product administration: validation, duplicate slugs, the activity log
- Overselling prevention
- Archive-not-delete for products that have orders
- Category deletion protection
- Checkout validation
- Server-side totals
- Transactional order creation with snapshots
- Idempotent retries
- Order ownership
- The status transition policy
- Gross order value vs collected revenue
- Enquiry sanitisation and review moderation

Lint and build the client:
```bash
npm run lint --prefix client
npm run build --prefix client
```

---

## 4. How things work

### Orders
- **Checkout** sends only variant IDs and quantities. The server validates every field, then opens a **MySQL transaction**. Inside it, the server:
  1. locks the variant rows (`SELECT … FOR UPDATE`)
  2. re-checks product, category and variant status, the price and the stock
  3. recalculates subtotal, shipping and tax
  4. decrements tracked stock atomically (`… WHERE stock_quantity >= ?`)
  5. creates the order, item snapshots, a pending payment and the first status-history row
  6. commits
- **Idempotency:** every checkout visit sends a UUID (`orders.idempotency_key` is unique). Retries and double clicks return the same order instead of creating a second one. If the total changed since the customer reviewed it, the order is refused and the customer is asked to review again.
- **Emails** are sent after the commit. A mail failure never fails or loses an order: it is logged in `email_notification_logs` and can be retried.
- **Order numbers** look like `BX-261015-7KQ4M` (date plus a random code, enforced unique).
- **Made to order vs stock:** products have **Track stock** off by default (made to order, no ceiling). Turn it on to enforce per-variant stock. Cancelling an order restores tracked stock.

### Order status policy
`Received (pending) → Confirmed → In production → Shipped → Delivered`. An order can be **cancelled** until it ships. Orders never move backwards, and nothing is marked delivered automatically. Every change records the admin and the time in `order_status_history` and the activity log.

**Payment** status is separate. An order is marked **paid** only when staff record that the money was received (with an optional reference). That is also logged. **Gross order value** on the dashboard counts every order that isn't cancelled. **Collected revenue** counts only recorded payments.

### Roles
| Role | Access |
|---|---|
| Support | Dashboard, orders (status, notes, tracking), customers, enquiries, reviews |
| Admin | Everything above, plus products, categories, content, settings, payments and the activity log |
| Super admin | Everything, plus admin users and email notification settings |

Every admin request is checked on the server. Hiding buttons in the interface is never relied on as protection.

### Security summary
- Parameterised SQL everywhere.
- Every input is validated on the server with zod; HTML is stripped from free text.
- React escapes all output, and admin-entered text is rendered as text, never as HTML.
- bcrypt password hashes (cost 12).
- Accounts lock for 15 minutes after 5 failed sign-ins; sign-in errors are generic.
- Rate limits on sign-in, sign-up, password reset, contact, reviews, newsletter and checkout.
- Sessions are stored in MySQL. The cookie is HTTP-only and SameSite=Lax, and becomes `Secure` automatically when `NODE_ENV=production` and `CLIENT_URL` is `https://`. The session ID rotates on sign-in.
- CSRF: a synchronizer token kept in the session must be sent as `X-CSRF-Token` on every state-changing request.
- Helmet security headers with a Content-Security-Policy; CORS is restricted to `CLIENT_URL`.
- Uploads: JPEG, PNG or WebP only, up to 5 MB. Every image is decoded and re-encoded to WebP with sharp, which strips metadata and rejects non-images.
- Errors never include stack traces in production.
- Secrets live only in `server/.env`, which git ignores.

### SEO
- Every page sets a title, description, canonical URL and Open Graph tags (React 19 metadata).
- **In production, Express also injects these tags into the HTML on the server** (`server/services/seoService.js`), so crawlers and link previews don't need JavaScript.
- Product JSON-LD includes **offers only when there is a real price**, and **ratings only from approved reviews**. Organisation and breadcrumb data are included.
- `/sitemap.xml` and `/robots.txt` are generated from the database.
- Client-side rendering still has limits for search engines; the server-injected tags reduce, but don't remove, that dependency.

### Design notes
- Palette: Canvas `#FFFFFF`, Stone `#F7F7F5`, warm **Sand `#F1EDE6`** for alternating sections, **Charcoal `#121211`** for the cinematic product showcase, contact section and footer, Ink `#171717`, Graphite `#707070`, Hairline `#E8E8E5`, and **Signal orange `#F17E00`, sampled from the supplied logo**. On white, orange is used only for marks, icons and focus rings; on charcoal it becomes the button colour (ink text on orange, 6.9:1 contrast). A soft orange glow is the only gradient.
- Premium sections: the hero has a frosted spec card; the product showcase has numbered markers on the open-box photo (verified attributes only); "From order to your door" is a timeline whose orange line draws as you scroll; the dark footer uses `boxel-logo-white.png` (the same logo with a white wordmark).
- Type: **Albert Sans** (self-hosted). Display sizes use weight 300 to echo the logo's thin strokes.
- The motif is the logo's **skewed tile**. The homepage hero assembles three tiles over a grey "studio" panel that matches the product photography's own backdrop.
- Animation: Framer Motion with `MotionConfig reducedMotion="user"` plus a CSS reduced-motion fallback. Scroll reveals run once (`viewport: { once: true }`); scroll-linked movement is bounded and uses transforms only.
- Images: the supplied `boxel-logo.jpeg` is kept unchanged. `boxel-logo-trimmed.png` is the same logo with its whitespace padding removed and a transparent background, at the same proportions, used in the interface. `server/assets/boxel-logo-email.png` is used in emails.

---

## 5. Production build
```bash
npm run build --prefix client      # creates client/dist
set NODE_ENV=production            # PowerShell: $env:NODE_ENV="production"
npm start --prefix server
```
When `client/dist` exists, Express serves the website and a **fallback for every route**, so `/products/parcel-drop-box`, `/account/orders` and other deep links work on refresh. It injects SEO tags per page and caches hashed assets for a year.

On a real server:
- Put it behind HTTPS (nginx or a hosting platform) with `CLIENT_URL=https://your-domain`.
- Leave `TRUST_PROXY=1` (the default in production).
- Use a dedicated MySQL user instead of `root`.

If you host the site under Apache instead, rewrite unknown paths to `index.html` and proxy `/api`, `/uploads`, `/sitemap.xml` and `/robots.txt` to Node.

---

## 6. Troubleshooting

| Problem | Fix |
|---|---|
| `[db] Cannot connect to MySQL` | Start MySQL in XAMPP. Check `DB_HOST`, `DB_PORT`, `DB_USER` and `DB_PASSWORD`. Make sure `boxel_store` exists and `schema.sql` has been imported. |
| `ER_NO_SUCH_TABLE` | Import `database/schema.sql` into the database named in `DB_NAME`. |
| MySQL won't start in XAMPP (port 3306 busy) | Another MySQL service is running. Stop it in **services.msc**, or change the port in XAMPP and in `DB_PORT`. |
| `Port 5000 is already in use` | Stop the other process (`netstat -ano \| findstr :5000`, then `taskkill /PID <pid> /F`) or change `PORT` (and `VITE_API_PROXY` for Vite). |
| Website loads but the API fails, or CORS errors | Open the site through Vite (`localhost:5173`), not the API port. If you use another address, add it to `CLIENT_URL` / `CORS_ORIGINS`. |
| "Your session expired. Refresh the page" | The CSRF token changed (for example after restarting with a new secret). Refresh the page. |
| Sign-in doesn't stick in production | Over HTTPS, cookies are `Secure`. Make sure the proxy forwards `X-Forwarded-Proto` and `TRUST_PROXY=1`. |
| Emails are "skipped" | SMTP isn't configured. Fill in the `SMTP_*` settings and restart. |
| Emails are "failed" | Read the error in Admin → Email. Common causes: wrong port/secure combination (587 → `false`, 465 → `true`), Gmail without an app password, or the from address not allowed by your provider. Use **Send test email**, then **Retry**. |
| Uploads fail | Images only (JPEG, PNG or WebP), up to 5 MB. `server/uploads` must be writable. |
| Checkout says no payment method | Enable one in Admin → Store settings → Payments. |
| "Price coming soon" everywhere | Set the product price in Admin → Products. |

---

## 7. API overview
Public: `GET /api/site`, `/api/categories`, `/api/products`, `/api/products/:slug`, `/api/products/:slug/reviews`, `/api/faqs` · `POST /api/cart/quote` · `POST /api/orders` · `GET /api/orders/confirmation/:orderNumber` · `POST /api/enquiries`, `/api/newsletter` · `/api/auth/*` · `/api/account/*`.

Admin (session plus role checked on every request): `/api/admin/{dashboard, notifications, search, products, categories, orders, customers, reviews, enquiries, newsletter, faqs, banners, social-links, settings/:group, email/*, users, activity-logs, uploads}`.
