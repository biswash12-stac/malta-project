# API Contract

Verified against the source on branch `feature/lifecycle-and-seed` (base `main` at `76455f4`), 2026-11-13. This is the reference for frontend integration. `backend/PROGRESS.md` keeps the short route list.

## Basics

- **Base URL:** `http://localhost:4000/api/v1` in development (`src/app.ts`, `src/routes.ts`).
- **Bodies:** JSON only (`Content-Type: application/json`), 32 KB at most. Other content types aren't read.
- **CORS:** one origin, `CLIENT_URL`, with credentials. Send every request with `credentials: "include"`.
- **Money:** integer euro cents (`2000` = €20.00). The server works out every price, fee and total. Sending a price on checkout returns a 400.
- **IDs:** MongoDB ObjectIds as 24-character hex strings. Products are looked up publicly by `slug`.
- **Pagination:** `?page=` (1 to 10,000, default 1) and `?limit=` (1 to 50, default 20). Responses include `pagination: { page, limit, total, totalPages }`.
- **Unknown fields:** query parameters and strict bodies reject unknown fields with a 400. That includes operator-style keys such as `price[$ne]`.
- **Headers on every response:** `X-API-Version: 1.0.0`, `Cache-Control: no-store` (nothing may be cached, since responses can hold personal or admin data), plus helmet's security headers.
- **Origin check on writes:**
  - `POST`, `PUT`, `PATCH` and `DELETE` requests that send an `Origin` header must come from exactly `CLIENT_URL`'s origin (same scheme, host and port). Any other origin, including `null`, gets 403 `FORBIDDEN` before anything runs.
  - Requests without `Origin` are allowed: browsers always send one, so those come from curl, Postman or a server, which can't carry a user's cookies.
  - Reads are never checked.
- **Logging:** request logs record only the method, the path without its query string, and the status. They never include headers, cookies, query strings or bodies.

### Response format

```json
{ "success": true, "data": { ... }, "message": "optional" }
{ "success": false, "error": { "code": "VALIDATION_ERROR", "message": "Invalid input", "details": { "field": ["reason"] } } }
```

Validation errors put field messages in `details`. Errors about the input as a whole go under `details._form`.

| Code | Status | When |
|---|---|---|
| `VALIDATION_ERROR` | 400 | invalid body, query or params |
| `BAD_REQUEST` | 400 / 413 | broken JSON, or a body over 32 KB |
| `MINIMUM_ORDER_NOT_MET` | 400 | subtotal below €20.00; `details: { minimum, subtotal }` |
| `UNAUTHENTICATED` | 401 | no valid login cookie, or a wrong email or password |
| `FORBIDDEN` | 403 | logged in, but not an admin |
| `NOT_FOUND` | 404 | missing resource or route |
| `CONFLICT` | 409 | duplicate (e.g. email, category name, product English name), or a product edit made from a stale copy after someone else changed its images (reload and retry) |
| `ITEMS_UNAVAILABLE` | 409 | checkout stock problem; `details.items: [{ productId, available }]` |
| `INVALID_STATUS_TRANSITION` | 409 | an order status change outside the allowed path |
| `IDEMPOTENCY_KEY_REUSED` | 422 | the same `Idempotency-Key` sent with a different cart |
| `UPLOAD_EXPIRED` | 409 | a product save uses an image the cleanup job currently holds for deletion: while it deletes the file, and for up to 10 minutes after a failed delete (the delete may still complete). Rarely, also when another edit queues that image's removal at the same moment; retrying the save then works. Upload the image again; if the image should still exist, retrying after about 10 minutes also works |
| `RATE_LIMITED` | 429 | see rate limits below |
| `UPLOADS_NOT_CONFIGURED`, `GOOGLE_NOT_CONFIGURED`, `EMAIL_FAILED`, `IMAGE_CHECK_UNAVAILABLE`, `DATABASE_UNAVAILABLE` | 503 | a dependency is missing or down |
| `INTERNAL` | 500 | unexpected error; no details are leaked |

### Sessions (httpOnly cookies, never in response bodies)

| Cookie | Lifetime | Scope |
|---|---|---|
| `access_token` | 15 minutes | `SameSite=Lax`, path `/` |
| `refresh_token` | 7 days, rotated on every refresh | `SameSite=Strict`, path `/api/v1/auth`. Stored only as a hash. A MongoDB TTL index removes expired rows |
| pending 2FA cookie | 10 minutes | `SameSite=Strict`. Only lets the browser finish login with a 2FA code |

- **Production:** all three cookies are `Secure`.
- **After a 401:** call `POST /auth/refresh` once, then retry.
- **Reuse protection:** reusing a replaced refresh token more than 10 seconds after it was replaced ends all of that user's sessions.

### Rate limits

| Limit | Window | Applies to |
|---|---|---|
| 300 requests per IP | 1 minute | the whole API, except `/health` and `/health/ready` |
| 20 attempts per IP | 15 minutes | register, login, Google login, password reset (`POST /auth/reset-password`) and the five 2FA routes (`/2fa/enable`, `/2fa/verify`, `/2fa/disable/request`, `/2fa/disable`, `/2fa/validate`). They share one counter per IP, not one per route |
| 10 failed logins per account | 15 minutes | login |
| 60 per IP | 15 minutes | `POST /auth/refresh` |
| 5 per IP, and 5 per email | 1 hour | `POST /auth/forgot-password` |
| 10 placed orders per IP | 15 minutes | `POST /orders`; rejected attempts don't count |
| 60 per IP | 15 minutes | `POST /admin/uploads/signature` |

## Health

| Method and path | Auth | Response |
|---|---|---|
| `GET /health` | none | `{ status: "ok" }`. No uptime, which would reveal when the in-memory rate limits last reset |
| `GET /health/ready` | none | `{ status: "ready" }`, or 503 `DATABASE_UNAVAILABLE` |

## Auth (`/auth`)

| Method and path | Auth | Body | Success `data` |
|---|---|---|---|
| `POST /auth/register` | none | `{ username (1–100), email, password (8–72 bytes; common passwords rejected) }`. Extra fields such as `role` are ignored | 201 `{ user }`, sets cookies |
| `POST /auth/login` | none | `{ email, password }` | `{ user }` + cookies, or `{ requires2FA: true }` + pending cookie |
| `POST /auth/google` | none | `{ credential }` (Google ID token) | same as login |
| `POST /auth/2fa/validate` | pending cookie | `{ code: "123456" }` | `{ user }` + cookies |
| `POST /auth/refresh` | refresh cookie | none | `{ user }` + new cookies |
| `POST /auth/logout` | optional | none | `null`. Clears cookies and ends sessions on every device |
| `GET /auth/me` | login | none | `{ user }` |
| `POST /auth/forgot-password` | none | `{ email }` | `null`, always 200, emails a 30-minute link |
| `POST /auth/reset-password` | none | `{ token (64 hex), password }` | `null`. Ends all sessions |
| `POST /auth/2fa/enable` | login | none | `null`, emails a code |
| `POST /auth/2fa/verify` | login | `{ code }` | `{ twoFactorEnabled: true }` |
| `POST /auth/2fa/disable/request` | login | none | `null`, emails a code |
| `POST /auth/2fa/disable` | login | `{ code }` | `{ twoFactorEnabled: false }` |

`user` is `{ id, username, email, role: "customer" | "admin", twoFactorEnabled }`. 2FA codes last 10 minutes. Guesses are limited per account, not per code: at most 5 in a fixed 15-minute window, and asking for a new code doesn't reset them. The 5th wrong guess cancels the code and holds back new codes for 15 minutes. A correct code starts the count again. While codes are held back, login still answers `{ requires2FA: true }`, and the enable and disable requests still answer `null`, but no email is sent.

## Categories

| Method and path | Auth | Input | Success `data` |
|---|---|---|---|
| `GET /categories` | none | pagination | `{ items: [{ _id, name, slug }], pagination }`; active categories only, sorted by name |
| `GET /admin/categories` | admin | pagination | `{ items: [{ _id, name, slug, isActive }], pagination }` |
| `POST /categories` | admin | `{ name (1–100) }` | 201 `{ category }`. The slug follows the name; a duplicate name is a 409 |
| `PATCH /categories/:id` | admin | `{ name?, isActive? }` (at least one) | `{ category }` |
| `DELETE /categories/:id` | admin | none | `null`. A soft delete: the category and its products are hidden publicly, and reactivating restores them |

## Products

| Method and path | Auth | Input | Success `data` |
|---|---|---|---|
| `GET /products` | none | pagination, `q` (search in English and Nepali names and the description), `category` (a category **slug**), `featured=true` | `{ items, pagination }`. Newest first, or by relevance when `q` is set |
| `GET /products/:slug` | none | none | `{ product }`, with `description` and `category: { name, slug }` |
| `GET /admin/products` | admin | pagination, `q`, `category` (an **ObjectId**), `isActive=true\|false` | `{ items, pagination }`, including hidden products |
| `GET /admin/products/:id` | admin | none | `{ product }` |
| `POST /products` | admin | see the fields below | 201 `{ product }` |
| `PATCH /products/:id` | admin | any of the fields below | `{ product }` |
| `DELETE /products/:id` | admin | none | `null` (soft delete) |

- **Public product fields:** `_id, nameEn, nameNp, slug, price, offerPrice, priorLowestPrice, unit, stock, category, shopRating, isFeatured, images[{url}]`.
- **Fields an admin can write:** `nameEn` (1–150), `nameNp` (1–150), `price` (cents > 0), `offerPrice` (cents or `null`), `unit` (1–50), `stock` (≥ 0), `category` (ObjectId), `description` (≤ 5000), `images` (≤ 10 × `{ url, publicId }`), `shopRating` (1–5 or `null`), `isFeatured`, `isActive`.
- **Rules:**
  - The slug is set from `nameEn` when the product is created, and never changes.
  - `offerPrice` must be below the lowest price of the last 30 days (`priorLowestPrice`, EU Omnibus rule).
  - `shopRating` is set by the admin; there are no customer reviews.
- **Images:** `publicId` must be `products/` plus one name of 1 to 240 letters, digits, `_` or `-`, with no dots, extra slashes or `..`. `url` must be exactly `https://res.cloudinary.com/<cloud>/image/upload/[v<digits>/]<publicId>.<jpg|jpeg|png|webp>`, with no query, fragment, port or credentials. Each new image is checked with Cloudinary when the product is saved: at most `UPLOAD_MAX_BYTES` (default 5 MB), stored as JPG, PNG or WebP.
  - A rejected image returns a 400 with `details.images`, and the file is queued for deletion (the cleanup deletes it after the 15-minute grace period).
  - If Cloudinary can't be reached, the save returns a 503 `IMAGE_CHECK_UNAVAILABLE`.
  - Images an edit removes are **queued** for deletion, never deleted straight away. The cleanup job deletes each one after a 15-minute grace period, unless a product uses it by then, with the same claim and retry rules as abandoned uploads.

## Image uploads (admin)

`POST /admin/uploads/signature`, admin only, no body. It returns:

```json
{ "uploadUrl": "https://api.cloudinary.com/v1_1/<cloud>/image/upload", "apiKey": "...", "timestamp": 1794590000,
  "publicId": "products/<uuid>", "overwrite": false, "allowedFormats": "jpg,jpeg,png,webp",
  "allowedMimeTypes": ["image/jpeg", "image/png", "image/webp"], "maxFileBytes": 5242880, "signature": "<sha1>" }
```

**How to upload one file:**
1. Request a signature.
2. In the browser, check `file.size` against `maxFileBytes` and `file.type` against `allowedMimeTypes`.
3. POST `FormData { file, api_key, timestamp, public_id, overwrite: "false", allowed_formats, signature }` to `uploadUrl`. `overwrite=false` is signed, so a signature can never replace an image that was already checked.
4. Save `{ url: secure_url, publicId: public_id }` in the product's `images`.

**Notes:**
- **One signature covers exactly one file,** at the server-chosen `publicId`, and Cloudinary rejects it after about an hour.
- **Tickets:** each signature records an upload ticket. Saving a product with that image only claims the ticket, and the cleanup job settles it later (see Data lifecycle).
- **Cleanup:** a file left unattached for over 24 hours is deleted by the cleanup job (see Data lifecycle).
- **Changed on 2026-11-13:** the response used to return `folder` and signed `folder`. It now returns `publicId` and signs `public_id`.

## Orders (customer, login required)

| Method and path | Input | Success `data` |
|---|---|---|
| `POST /orders` | body `{ items: [{ productId, qty (1–99) }] (1–50 items), delivery: { name (1–100), phone, address (1–300), locality (1–100), note? (≤500) } }`. Strict: no prices or fees. Optional header `Idempotency-Key` (1–255 printable characters, no spaces) | 201 `{ order }` |
| `GET /orders/mine` | pagination | `{ items: [{ _id, orderNumber, total, status, paymentStatus, estimatedDeliveryDate, createdAt }], pagination }`, newest first |
| `GET /orders/:id` | own orders only (another user's order is a 404) | `{ order }`, with `items[{ productId, nameSnapshot, unitSnapshot, priceSnapshot, qty }]` and `statusHistory[{ status, at }]` |

**Checkout rules** (`src/modules/orders/order.service.ts`):
- **Phone:** stored without `+356`, and must be 7 to 15 digits.
- **Prices:** the offer price is charged when there is one, and each item keeps a copy of its name, unit and price.
- **Minimum and delivery:** subtotal at least €20.00 (2000). Delivery is €5.00 (500) below €30.00 (3000), and free from €30.00.
- **Atomic:** stock is checked and taken, and the order saved, in one MongoDB transaction, or nothing happens. Problems return `ITEMS_UNAVAILABLE` with the stock that's left.
- **Payment:** cash on delivery. The order starts `pending`, with payment `pending`.
- **Order numbers:** look like `NG-YYYYMMDD-0001`, using Malta's date.
- **`Idempotency-Key`:**
  - repeats with the same key return the first order, even when sent at the same moment
  - keys are per user, and a different cart with the same key returns a 422
  - keys expire after 24 hours.

## Admin orders and stats

| Method and path | Input | Success `data` |
|---|---|---|
| `GET /admin/orders` | pagination, `status`, `from`/`to` (ISO date-time with an offset), `q` (an exact order number or phone) | `{ items, pagination }` with delivery name, phone and locality |
| `GET /admin/orders/:id` | none | `{ order }` with `user: { username, email }` and the full `statusHistory` (`by`, `note`) |
| `PATCH /admin/orders/:id/status` | `{ status, note? }` | `{ order }` |
| `PATCH /admin/orders/:id/delivery-date` | `{ estimatedDeliveryDate: "YYYY-MM-DD" \| null }` | `{ order }` |
| `PATCH /admin/orders/:id/payment` | `{ paymentStatus: "paid" }` | `{ order }`. Only once the order is `delivered`, and only once |
| `GET /admin/stats` | none (any query param returns a 400) | `{ totalRevenue (cents; orders delivered or paid), ordersToday (Malta day), pendingOrders }` |

- **Status path:** `pending → confirmed → packed → out_for_delivery → delivered`. `cancelled` is allowed from `pending` or `confirmed`, and returns the stock once.
- **Logging:** every status, delivery date and payment change is recorded with who made it.

## Data lifecycle

| Data | Lifetime | How |
|---|---|---|
| Refresh sessions | 7 days | MongoDB TTL index on `expiresAt`. Expiry is also checked in code |
| Password reset links, 2FA codes | 30 minutes / 10 minutes | expiry fields checked in code at use |
| Idempotency keys | 24 hours | MongoDB TTL index on `createdAt` |
| Upload tickets (`reason: "upload"`) | about 24 hours after the signature, whether or not a product saved the image | the hourly cleanup job: it removes the ticket, and deletes the file only if no product uses it. **No TTL index**, so a ticket is never lost before its file is deleted |
| Removal tickets (`reason: "removed"`) | at least 15 minutes after an edit removes the image (longer if a retry back-off is already set) | the hourly cleanup job. If a product uses the image by then, only the ticket is removed |
| Orders, order counters, products, categories, users | permanent | no TTL and no cleanup. A test checks that only refresh sessions and idempotency keys have TTL indexes |
| Guest cart (browser) | proposed 30 days | frontend only; not implemented yet (see `FRONTEND_PROGRESS.md`) |

**Upload cleanup** (`src/modules/uploads/upload-cleanup.ts`):
- **When:** runs in the API process one minute after start, then hourly, and only when Cloudinary is configured. `npm run cleanup:uploads` runs it once.
- **Overlap:** a MongoDB lease lock (`joblocks`, 10 minutes) stops overlapping runs, even across instances. A crashed run's lock expires.
- **What it deletes:** only ticketed files, 200 per run. An image a product uses is never deleted; its ticket is just removed.
- **Failures:** a failed delete keeps its ticket, is retried after its back-off (see **Retries**), and is reported as `partial` (the CLI exits with code 1).
- **Result:** `{ status, checked, deleted, inUse, failed }`, logged.
- **Claims:**
  - A product save first claims its images' tickets for 15 minutes, and the cleanup never touches a claimed ticket.
  - The cleanup claims one due ticket at a time, atomically, for 10 minutes. A save that meets a ticket being deleted gets 409 `UPLOAD_EXPIRED`.
  - Right before deleting, the worker re-takes its claim in one atomic write. It succeeds only if the claim never lapsed, no save holds a claim, and no edit has queued a removal since (the ticket's `rev`). Otherwise it skips the file.
  - After a failed or uncertain delete, the claim is kept until it expires (10 minutes), so saves of that file get 409 meanwhile.
  - Together these keep saved products from pointing at deleted files, within the timing limits listed in `PROGRESS.md` (Known Limits). A save is refused unless every ticket ends up with a live save claim and no live worker claim (R-14, fixed 2026-11-15).
- **Interrupted runs:** a worker that dies mid-delete leaves an expiring claim that the next run takes over. Cloudinary treats deleting a missing file as success.
- **Retries:** failed deletes are retried after 1, 2, 4, 8 and 16 hours, then daily (`attempts`, `nextAttemptAt` and `lastError` on the ticket). Failing tickets are skipped until due, so they never block newer ones.
- **Lock:** a 10-minute lease renewed after every file. A run that loses it stops with status `lock-lost`.
