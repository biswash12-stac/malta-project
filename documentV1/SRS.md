# SRS — Nepali Grocery E-commerce

## 1. Functional Requirements

### Authentication
- FR-1: Visitor can register with username, email, password. Login uses email and password.
- FR-2: User can log in with a password or Google. Sessions use two httpOnly cookies: a 15-minute access token and a 7-day refresh token that is replaced on each use. Tokens never appear in response bodies.
- FR-2a: User can reset a forgotten password through an emailed link that expires in 30 minutes and works once. A reset ends all sessions.
- FR-2b: User can turn on two-factor login by email. Password and Google logins then also need a 6-digit emailed code.
- FR-2c: Google sign-in creates a customer for a new email. Linking to an account whose email was never verified removes its password and sessions.
- FR-3: Admin accounts are created by seed script only. The script refuses an email that belongs to a customer, and requires a password of at least 12 characters.
- FR-4: Passwords are hashed with bcrypt, and must be at least 8 characters and at most 72 bytes (bcrypt ignores anything longer). Common passwords are rejected.

### Catalog
- FR-5: Anyone can view products with category filter, search, pagination.
- FR-6: Product fields: nameEn, nameNp, slug (from nameEn, unchanged on rename), description, price, offerPrice (optional, must be lower than price), priorLowestPrice (set by the server), unit, stock, images, category, shopRating (optional, 1-5, the shop's own rating, never shown as customer reviews), isFeatured, isActive. There is no customer review system in v1.
- FR-6a: Each offer stores the lowest price charged in the previous 30 days as priorLowestPrice, and offerPrice must be below it. The frontend must show priorLowestPrice as the reference for any reduction (EU Omnibus Directive).
- FR-7: Admin can create, read, update, soft-delete products and categories. Admins can also see hidden items.
- FR-7a: Hiding a category hides its products from public endpoints without changing the products. Reactivating the category restores them as they were.

### Cart and Checkout
- FR-8: Cart lives on the client; server re-validates price and stock at checkout.
- FR-8a: Placing an order requires login (401 otherwise). Guests can browse and keep a client-side cart.
- FR-8b: The subtotal must be at least €20.00, or checkout returns 400 `MINIMUM_ORDER_NOT_MET`.
- FR-8c: Delivery costs €5.00 when the subtotal is below €30.00 and is free from €30.00. The server calculates the fee and total (subtotal + delivery fee), and rejects a client that sends them.
- FR-9: Checkout requires delivery name, phone, address, locality; note optional. Delivery covers all of Malta, so any locality is accepted.
- FR-10: Payment method is COD only; order stores paymentMethod = COD, paymentStatus = pending.
- FR-11: Stock is decremented atomically when the order is created.

### Orders and Tracking
- FR-12: Each order has a unique readable number, e.g. NG-20261105-0001.
- FR-13: Status flow: pending → confirmed → packed → out_for_delivery → delivered. Cancelled allowed from pending or confirmed.
- FR-14: Admin sets status and estimatedDeliveryDate; each change is saved in statusHistory with timestamp.
- FR-15: Customer sees own orders and the status timeline. There is no guest tracking, because ordering requires login.
- FR-16: On delivery, admin marks paymentStatus = paid (cash collected).

### Admin Dashboard
- FR-17: Order list with status/date filter and search by order number or phone.
- FR-18: Summary: orders today, pending count, revenue (delivered orders).

## 2. Non-Functional Requirements
- NFR-1 Security: bcrypt, JWT, rate limit on auth, helmet, CORS whitelist, zod validation, no secrets in repo.
- NFR-2 Performance: list endpoints p95 under 500 ms; indexes on slug, category, orderNumber, user.
- NFR-3 Responsive: mobile-first.
- NFR-4 SEO: server-rendered home and product pages.
- NFR-5 Reliability: DB backups, centralized error handling, logging.
- NFR-6 Maintainability: layered backend, typed contracts, README, .env.example.
- NFR-7 Extensibility: payment provider interface for future digital payment.

## 3. Data Model
Money is stored as integer cents (EUR). Orders keep snapshots of product name and price.

**User**: _id, username, email (unique), passwordHash (absent on Google-only accounts), role (customer | admin), tokenVersion, googleId, emailVerified, passwordResetToken, passwordResetExpires, twoFactorEnabled, twoFactorCode, twoFactorExpires, twoFactorAttempts, twoFactorNextCodeAt, createdAt

**RefreshSession**: _id, user (ref), tokenHash (unique), tokenVersion, replacedAt, expiresAt (removed automatically)

**Category**: _id, name, slug (unique), isActive

**Product**: _id, nameEn, nameNp, slug (unique), description, price, offerPrice (nullable), priorLowestPrice (nullable), priceHistory[] {price, from} (private), unit, stock, images[] {url, publicId}, category (ref), shopRating (nullable), isFeatured, isActive, timestamps

**Order**: _id, orderNumber (unique), user (ref, required), items[] {productId, nameSnapshot, unitSnapshot, priceSnapshot, qty}, subtotal, deliveryFee, total, delivery {name, phone, address, locality, note}, paymentMethod (COD | CARD later), paymentStatus (pending | paid | failed | refunded), status, estimatedDeliveryDate, statusHistory[] {status, at, by, note}, timestamps

## 4. API Summary (prefix /api/v1)
| Area | Endpoints |
|---|---|
| Auth | POST /auth/register, POST /auth/login, POST /auth/google, POST /auth/refresh, POST /auth/logout, GET /auth/me, POST /auth/forgot-password, POST /auth/reset-password |
| 2FA | POST /auth/2fa/enable, /verify, /validate, /disable/request, /disable |
| Products | GET /products?q=&category=&featured=true, GET /products/:slug; admin: POST /products, PATCH /products/:id, DELETE /products/:id, GET /admin/products?q=&category=&isActive=, GET /admin/products/:id |
| Categories | GET /categories; admin: POST /categories, PATCH /categories/:id, DELETE /categories/:id, GET /admin/categories (includes hidden) |
| Orders (customer) | POST /orders, GET /orders/mine, GET /orders/:id (register `mine` before `:id`, or `:id` will capture it) |
| Orders (admin) | GET /admin/orders, GET /admin/orders/:id, PATCH /admin/orders/:id/status, PATCH /admin/orders/:id/delivery-date, PATCH /admin/orders/:id/payment |
| Admin | GET /admin/stats |
| Uploads | Admin: POST /admin/uploads/signature. The browser then sends the file straight to Cloudinary |

Lists: `data` is `{ items, pagination: { page, limit, total, totalPages } }`, with `?page=` (default 1) and `?limit=` (default 20, max 50).

Success: `{ success: true, data, message }`
Error: `{ success: false, error: { code, message, details } }`

## 5. Constraints
Low hosting cost; Cloudinary free tier for images. Email is used only for password resets and 2FA codes (Nodemailer with a free SMTP provider); order notifications are not in v1.
