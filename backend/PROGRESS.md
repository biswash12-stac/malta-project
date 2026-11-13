# Backend Progress

Last updated: 2026-11-13

Nepali grocery e-commerce API. Stack: Express 5, TypeScript, MongoDB Atlas (Mongoose), Zod, Envalid, Pino.

## Where We Are

Phase 2 (backend foundation and auth) is finished and merged in [PR #5](https://github.com/biswash12-stac/malta-project/pull/5).

Phase 3 (catalog API) is merged in [PR #6](https://github.com/biswash12-stac/malta-project/pull/6). Signed Cloudinary uploads were tested against the real account.

The auth upgrade, signed uploads and audit fixes 2, 3 and 4 are merged in [PR #7](https://github.com/biswash12-stac/malta-project/pull/7), so `main` is at `b0fa302`, with all 123 tests passing on 2026-11-07. Real Google sign-in hasn't been tried, because it needs your account.

Phase 4 (orders) is merged in [PR #8](https://github.com/biswash12-stac/malta-project/pull/8), so `main` is at `411dcc5`. Checkout was tested in Postman against Atlas: the order saved, fees were correct and stock was deducted. The other order routes have automated tests only.

Real password reset and 2FA emails were tested on 2026-11-07 with a test account: the emails arrived, the reset token worked once, and 2FA login waited for the code. Real Google sign-in is still untested.

Phase 6 (admin dashboard) started on 2026-11-13. The backend part, `GET /admin/stats` (FR-18), is merged in [PR #10](https://github.com/biswash12-stac/malta-project/pull/10), with automated tests only. All 147 tests passed on 2026-11-13.

A whole-repo audit found 20 issues. Findings 2, 3, 4, 8 and 9 are done, and the other 15 are still open (see Still To Do).

The security audit's code fixes are done. Finding 9 (production secrets) is a launch task. Finding 11 (registration reveals taken emails) still waits for email verification at registration.

## What Is Built

### Foundation
- Express app with helmet, CORS for one frontend address, cookie parsing, a 32 KB body limit and request logging
- MongoDB connection, with a clean shutdown when the server stops. The server won't start if an index can't be built
- Environment checks at startup: the server won't start if a required value is missing or invalid
- One error handler for the whole API, using the standard error format
- Health check at `GET /api/v1/health`, and a readiness check at `GET /api/v1/health/ready` that returns 503 when MongoDB doesn't answer a ping. Neither is rate limited or logged
- Every response carries an `X-API-Version: 1.0.0` header, including errors and 404s

### Auth
- User model with `username`, `email` (unique), optional `passwordHash`, `role`, `tokenVersion`, Google, password reset and 2FA fields, and `createdAt`
- Passwords hashed with bcrypt and never returned by the API
- Two httpOnly cookies: `access_token` (15 minutes) and `refresh_token` (7 days, stored only as a hash). Tokens never appear in response bodies
- `POST /auth/refresh` replaces the refresh token each time. Reusing a replaced token after 10 seconds ends all of that user's sessions
- Forgot and reset password: emailed link, valid 30 minutes, works once, ends all sessions. The response doesn't reveal whether the email has an account
- Email 2FA: 6-digit code valid 10 minutes, stored as an HMAC. Five wrong tries cancel it and hold back new codes for 15 minutes. It also applies to Google login
- Google login with `POST /auth/google`: creates a customer for a new email and links existing accounts safely
- Nodemailer mailer: uses SMTP when set, and logs emails in development when it isn't
- `requireAuth` and `requireRole("admin")` middleware
- 20 register and login attempts per 15 minutes per IP address
- 10 failed logins per 15 minutes per account
- 300 requests per minute per IP address across the API, with the health check excluded
- Common passwords and single repeated characters are rejected at registration
- Admin account created only by `npm run seed:admin`
- Register, login, me and logout tested in Postman against Atlas, before the `tokenVersion` and auth upgrade changes
- `tokenVersion` on each user: logout and the admin seed cancel all of that user's tokens
- Admin seed refuses customer emails and passwords under 12 characters
- Admin password changed to a 12+ character one, and the spare `admin@example.com` account is gone
- `TRUST_PROXY_HOPS` setting, required in production, so rate limits can't be dodged with a fake IP

### Catalog
- Category model: `name`, `slug` (unique), `isActive`
- Product model: `nameEn`, `nameNp`, `slug` (unique), `description`, `price` and `offerPrice` (whole cents), `unit`, `stock`, `images[]`, `category`, `shopRating`, `priorLowestPrice`, private `priceHistory`, `isFeatured`, `isActive`, timestamps
- Product create and update Zod schemas
- `offerPrice` must be below `price`, checked by Zod when both are sent and by the model against the stored price on save
- Indexes for public and admin lists, category filters, featured products and search across both names and the description
- `validateRequest` middleware checks body, query and URL params with Zod and gives handlers the parsed values
- Shared schemas: pagination (`page` up to 10,000, `limit` up to 50, default 20) and MongoDB ids
- Bad values such as `?page=abc` and unknown params such as `?price[$ne]=0` return a 400
- Category API: public list, admin create, rename, soft delete, reactivate, and an admin list that includes hidden categories
- Product API: public list with search, category and featured filters, public detail by slug, admin create, edit, soft delete, reactivate, and admin list and detail
- Hiding a category hides its products from the public list, detail, search and filters
- Offers store the lowest price of the previous 30 days as `priorLowestPrice`, and must be below it
- Signed Cloudinary uploads: the backend signs, the browser uploads directly, and the API secret never leaves the server
- Image size and format are enforced on product save: each image no product uses yet is looked up in Cloudinary (Admin API, Basic auth). It must be 5 MB or less (`UPLOAD_MAX_BYTES`) and stored as JPG, PNG or WebP. Otherwise the save returns a 400 with `details.images`, and the file is deleted. If Cloudinary can't be reached or sends a record without a numeric `bytes` and a text `format`, it returns a 503 `IMAGE_CHECK_UNAVAILABLE` and deletes nothing. Editing a product that doesn't exist returns 404 before any image is checked. The signature response also gives the browser `maxFileBytes` and `allowedMimeTypes`. 12 upload tests were added for this on 2026-11-13, so `uploads` went from 10 to 22, all passing locally
- Product images must be in this store's Cloudinary account and `products` folder
- Replaced images are deleted from Cloudinary in the background, unless another product uses them

### Orders
- Login required to order. Guests get a 401 and keep their cart in the browser
- Checkout runs in one MongoDB transaction: checks stock, works out the totals on the server, takes the stock and saves the order, or does none of it
- €20.00 minimum order (`MINIMUM_ORDER_NOT_MET`), €5.00 delivery below €30.00, free from €30.00. Sending a price, fee or total returns a 400
- Sale price is charged when there is one. Each order keeps its own copy of the product name, unit and price
- Unavailable items return a 409 `ITEMS_UNAVAILABLE`, listing each product and how many are left
- Order numbers such as `NG-20261107-0001`, using Malta's date
- Status path enforced in `order.status.ts`. Invalid jumps return a 409 `INVALID_STATUS_TRANSITION`. Cancelling is allowed from `pending` or `confirmed` and returns the stock once
- Every status, delivery date and payment change is logged with who made it. Customers see only each status and its time
- Admin list filters by status and date, and finds an exact order number or phone number. Malta numbers are stored without `+356`
- A delivered order can be marked paid once. COD goes through a `PaymentProvider`, so digital payment can be added later
- 10 placed orders per 15 minutes per IP address. Rejected attempts don't count
- Optional `Idempotency-Key` header on checkout (1 to 255 printable characters, no spaces). Repeating a request with the same key returns the first order instead of placing another, even when the requests arrive at the same time
- The key is saved in the checkout transaction, so it exists only if its order does. A failed checkout leaves the key free to retry. Keys are per user, reusing one for a different cart returns a 422 `IDEMPOTENCY_KEY_REUSED`, and MongoDB deletes them after 24 hours

### Admin stats
- `GET /admin/stats` (admin) returns `totalRevenue`, `ordersToday` and `pendingOrders`
- Revenue is the sum of `total`, in cents, for orders that are delivered or paid. Cancelled and unpaid open orders don't count
- "Today" starts at midnight in Malta, including on the days the clocks change
- The three numbers come from three queries run in parallel. Any query param returns a 400

### Tests and tooling
- 165 automated tests: `orders` (30), `uploads` (22), `products` (15), `two-factor` (14), `startup-and-email` (3), `auth` (12), `auth-tokens` (10), `catalog-models` (10), `google` (10), `categories` (9), `password-reset` (9), `sessions` (9), `validate` (7) and `hardening` (5). Database tests use a temporary in-memory MongoDB
- The catalog tests fail if a list query scans the whole collection or sorts in memory
- Jest and Supertest, run by `npm run test:jest` from `tests/jest/`, with 7 tests: health, readiness, the version header, malformed JSON and an empty category list. `npm test` still runs the node:test suite only
- Jest tests get blank SMTP, Cloudinary and Google values, and a database address that can't connect, before the app loads. Database tests use `startTestDb()` from `tests/jest/helpers/test-db.ts`
- Prettier formatting
- Backend README (local only, not on GitHub)

## API So Far

All routes are under `/api/v1`.

| Route | Body | Success `data` |
| --- | --- | --- |
| `GET /health` | none | `{ status, uptime }` |
| `GET /health/ready` | none | `{ status: "ready" }`, or 503 `DATABASE_UNAVAILABLE` |
| `POST /auth/register` | `username`, `email`, `password` (8+ characters) | `{ user }` (201) |
| `POST /auth/login` | `email`, `password` | `{ user }` or `{ requires2FA: true }` |
| `POST /auth/google` | `credential` | `{ user }` or `{ requires2FA: true }` |
| `POST /auth/refresh` | none (needs the refresh cookie) | `{ user }` |
| `POST /auth/logout` | none | `null` |
| `GET /auth/me` | none (needs the login cookie) | `{ user }` |
| `POST /auth/forgot-password` | `email` | `null`, always 200 |
| `POST /auth/reset-password` | `token`, `password` | `null` |
| `POST /auth/2fa/enable` (login) | none | `null`, emails a code |
| `POST /auth/2fa/verify` (login) | `code` | `{ twoFactorEnabled: true }` |
| `POST /auth/2fa/validate` | `code` (needs the pending cookie) | `{ user }` |
| `POST /auth/2fa/disable/request` (login) | none | `null`, emails a code |
| `POST /auth/2fa/disable` (login) | `code` | `{ twoFactorEnabled: false }` |
| `GET /categories?page=&limit=` | none | `{ items, pagination }` |
| `POST /categories` (admin) | `name` | `{ category }` (201) |
| `PATCH /categories/:id` (admin) | `name` and/or `isActive` | `{ category }` |
| `DELETE /categories/:id` (admin) | none | `null` |
| `GET /admin/categories?page=&limit=` (admin) | none | `{ items, pagination }` |
| `GET /products?page=&limit=&q=&category=&featured=true` | none | `{ items, pagination }` |
| `GET /products/:slug` | none | `{ product }` |
| `POST /products` (admin) | see `product.schema.ts` | `{ product }` (201) |
| `PATCH /products/:id` (admin) | any product fields | `{ product }` |
| `DELETE /products/:id` (admin) | none | `null` |
| `GET /admin/products?page=&limit=&q=&category=&isActive=` (admin) | none | `{ items, pagination }` |
| `GET /admin/products/:id` (admin) | none | `{ product }` |
| `POST /admin/uploads/signature` (admin) | none | `{ uploadUrl, apiKey, timestamp, folder, allowedFormats, signature }` |
| `POST /orders` (login) | `items[]` of `{ productId, qty }`, `delivery` of `{ name, phone, address, locality, note? }`. Optional `Idempotency-Key` header | `{ order }` (201), the same order again for a repeated key |
| `GET /orders/mine?page=&limit=` (login) | none | `{ items, pagination }` |
| `GET /orders/:id` (login, own orders only) | none | `{ order }` |
| `GET /admin/orders?page=&limit=&status=&from=&to=&q=` (admin) | none, `from` and `to` are ISO date-times with an offset | `{ items, pagination }` |
| `GET /admin/orders/:id` (admin) | none | `{ order }` |
| `PATCH /admin/orders/:id/status` (admin) | `status`, `note?` | `{ order }` |
| `PATCH /admin/orders/:id/delivery-date` (admin) | `estimatedDeliveryDate` (`YYYY-MM-DD` or `null`) | `{ order }` |
| `PATCH /admin/orders/:id/payment` (admin) | `paymentStatus: "paid"` | `{ order }` |
| `GET /admin/stats` (admin) | none | `{ totalRevenue, ordersToday, pendingOrders }`, revenue in cents |

`user` is `{ id, username, email, role, twoFactorEnabled }`. A public category is `{ _id, name, slug }`, and admins also get `isActive`.

`pagination` is `{ page, limit, total, totalPages }`.

Success: `{ success: true, data }`

Error: `{ success: false, error: { code, message, details } }`

## Problems Fixed

- The server claimed to be running when its port was already taken. It now stops with an error.
- Broken JSON and oversized requests returned 500. They now return 400 and 413. Since 2026-11-13 a Jest test also checks the standard error envelope for broken JSON.
- A double click or network retry on checkout placed two orders. A repeated `Idempotency-Key` now returns the first order.
- Database validation errors returned 500. They now return 400.
- `.env.example` was in the wrong folder.
- Production could silently fall back to a localhost frontend address. `CLIENT_URL` is now required there.
- Removed the unused `asyncHandler` helper and the unused `pino-pretty` package.
- Validation errors about the whole input, such as an unknown param, came back with empty `details`. They now appear under `details._form`.
- Database validation errors gave no reason. They now list the message for each field in `details`.
- Security: the admin seed could turn an attacker's existing customer login into admin. It now refuses customer emails.
- Security: logout and password resets didn't cancel login tokens. They now do, including for accounts created before this fix.
- Security: `trust proxy` was fixed at 1, so on a direct connection a fake `X-Forwarded-For` header dodged the login limit. It's now set per host.
- Security: the seed accepted short admin passwords. It now requires 12 or more characters.
- Security: only login and register were rate limited. The whole API now has a general limit.
- Security: passwords could be guessed from many IP addresses. Each account now has its own limit on failed logins.
- Security: `12345678` and `password` were accepted. Common passwords are now rejected.
- Security: a server missing `NODE_ENV` ran with production protections off. It now refuses to start.
- Security: the API read HTML form posts, which any site can send. It now reads JSON only.
- A failed unique index was silent, which let three accounts share one email. The server now refuses to start and logs why.
- A mail server that stopped answering left 2FA login waiting. Email now times out after 10 to 20 seconds, and login returns a 503.
- The 10 KB body limit rejected long Nepali descriptions. It's now 32 KB, which fits the largest valid product.

## Decisions

| Decision | Reason |
| --- | --- |
| Register takes `username`, `email` and `password`; login takes `email` and `password` | Simpler signup. Checkout will collect the phone number (FR-9) |
| Usernames don't have to be unique | Login uses email |
| Envalid for environment checks, bcryptjs for hashing | Already in the code; bcryptjs needs no native build |
| Site and API will share a parent domain | Next.js route protection can't otherwise read the login cookie |
| No ESLint on the backend for now | `typescript-eslint` doesn't support TypeScript 7 yet |
| Backend developer only changes `backend/` code | The frontend belongs to the frontend developer |
| `backend/README.md` stays out of commits for now; `backend/PROGRESS.md` is committed from Phase 4 on | The backend developer's choice |
| `PROGRESS.md` is updated after every feature, bug fix or structural decision | Keeps this file current without reminders |
| Products have `nameEn` and `nameNp`, with the slug built from `nameEn` | Bilingual names for customers, with clean English URLs |
| `price` is the regular price and `offerPrice` is the lower sale price | A single optional field covers offers |
| `shopRating` is set by the admin, with no customer reviews in v1 | Full reviews are out of v1 scope. Renamed from `averageRating`, because "average" implies customer reviews |
| Product slugs don't change on rename | Keeps bookmarks and Google links working. A second product with the same `nameEn` gets a 409 |
| Offers reference `priorLowestPrice`, calculated by the server | EU Omnibus Directive: reductions must reference the lowest price of the previous 30 days |
| Changes to `price` or `offerPrice` must go through `doc.save()` | The offer price rule compares against the stored price and only runs on save |
| Signed direct uploads to Cloudinary, using Node's `crypto` and `fetch` with no extra package | Replaces the Multer plan. Files never pass through the API, and the signing is only a few lines |
| Product images must be HTTPS images in this store's Cloudinary account and `products` folder | A product can't point at another site, and deletes can't reach other files |
| Product images are stored as `{ url, publicId }` | Cloudinary needs the id to delete a replaced image |
| Search uses one MongoDB text index, with names ranked above descriptions | A collection can only have one text index |
| Google login verifies the sign-in button's credential with `google-auth-library`, with no Passport | Fewer packages and no server sessions |
| 2FA login uses an httpOnly pending cookie, not `userId` in the response | A code alone can't log in, and no internal ID is exposed |
| The reset token goes in the JSON body, not the URL | Request logs record URLs |
| Google sign-in removes the password and sessions of an unverified customer account | Stops takeover by someone who registered the victim's email first |
| Google login also requires 2FA when it's on | All logins go through one function, so none can skip it |
| `POST /auth/2fa/disable/request` and `/disable` added | Users could otherwise never turn 2FA off |
| Reuse of a replaced refresh token ends all of the user's sessions, not one group | Stronger, and needs no extra field |
| Refresh extends the session by 7 days each time | Active customers stay logged in; idle sessions end after 7 days |
| Failed logins lock an account for up to 15 minutes | Stops guessing from many IP addresses. An attacker can briefly block the real owner, which is the accepted trade-off |
| Registration still says when an email is taken (audit finding 11) | Hiding it properly needs email verification, which isn't in v1 |
| Logging out ends sessions on every device | One `tokenVersion` per user is the smallest way to make tokens cancellable |
| Hiding a category hides its products publicly, without changing them | Customers shouldn't reach products from a hidden category, and reactivating restores everything as it was |
| A category's slug always follows its name | The slug's unique index then also stops two categories sharing a name |
| Admin lists use separate `/admin/...` routes | Public routes stay simple and can't leak hidden items |
| Query schemas reject unknown params instead of ignoring them | Express 5 reads `?page[$gt]=1` as a literal key, so a lenient schema would silently ignore it |
| Handlers read parsed values from `req.query` | Express 5's `req.query` can't be assigned to, so the middleware replaces it with `Object.defineProperty` |
| Ordering requires login, `Order.user` is required, and there's no `GET /orders/track` | Developer's decision for v1. Customers track orders through `GET /orders/:id` |
| €20.00 minimum, €5.00 delivery below €30.00, free from €30.00, all of Malta | Client's final rules. The amounts are constants in `order.service.ts` |
| The order number counter runs outside the checkout transaction | Parallel orders don't conflict on one row. A failed checkout can leave a gap in the numbers |
| Order items also store `unitSnapshot`, and `nameSnapshot` is the English name | The unit says what size was bought and can change later |
| Jest and Supertest added alongside the node:test suite, not replacing it | The developer's choice. The 147 existing tests keep working, and new tests can use either runner |
| Image size and format are checked on product save through Cloudinary's Admin API, not in the signature | Cloudinary's docs say signatures and upload presets can't limit file size. Checking the stored file uses Cloudinary's own size and format, not the file name |
| `.gitignore` ignores `.env*` except `.env.example` | Any new `.env.something` file is safe by default |
| Jest strips TypeScript with SWC, not ts-jest | ts-jest needs TypeScript below 7 |
| `test:jest` runs Node with `--experimental-vm-modules` | MongoDB driver 7.8 loads `os` with a dynamic `import()`, which Jest blocks otherwise, so every connection failed |
| The `Idempotency-Key` is saved inside the checkout transaction, with a unique index on user and key | Checking for the key before creating the order would still let two requests at the same moment both get through. The unique index makes the second one roll back, including its stock change |
| A repeated key returns the order as it is now, not a stored copy of the first response | A double click gets the same result either way, and a later retry shouldn't show an out-of-date status |
| The admin list searches exact order numbers and phone numbers | Both use an index and stay fast on large lists |
| Revenue counts orders that are delivered or paid, and "today" follows Malta's calendar | Developer's rule for FR-18. Under COD only a delivered order can be paid, so today this equals delivered orders. Order numbers already use Malta's date |
| Stats live in the orders module, mounted at `/admin/stats` | They only read orders, so a separate module would add files without adding anything |

## Still To Do

### Auth upgrade
- [ ] Create a free Google OAuth client ID and set `GOOGLE_CLIENT_ID` in `.env`
- [x] Set up Gmail SMTP with an app password and set the `SMTP_*` values in `.env` (real emails tested on 2026-11-07)
- [ ] Check `MAIL_FROM` in `.env`: it doesn't match `SMTP_USER`, and Gmail may replace it
- [x] Try a real reset email and a real 2FA code
- [ ] Try a real Google sign-in

### Phase 3
- [ ] Test the category and product routes in Postman (PR #6 is already merged)

### Whole-repo audit (still open)
- [ ] Must fix, frontend: fake testimonials (1), made-up contact details and offers (5), blank admin pages (6), no login link or phone menu (7)
- [x] `.gitignore` misses `.env.production` (8): `.env.production` and `.env.test` added on 2026-11-13
- [x] No CI (10): `.github/workflows/ci.yml` added on 2026-11-13. It runs the backend type check, `npm test`, `npm run test:jest`, and the frontend lint and build, with no secrets and with actions pinned to commit SHAs. Each command passed locally on 2026-11-13. The workflow itself hasn't run on GitHub yet
- [ ] Should fix, backend and repo: no Secure cookie test (11), `ADMIN_PASSWORD` and the `test` database in `.env` (12), small leftovers (17)
- [ ] Should fix, frontend: dead links (13), product shape doesn't match the API (14), ESLint error (15), unplanned placeholder features (16)
- [ ] Nice to have: reject a trailing slash in `CLIENT_URL` (18), return 409 for parallel product edits (19), fix drifted docs (20)

### Setup
- [ ] Add a database name to `MONGODB_URI` in `.env` if not done yet. Without one, data goes into MongoDB's default `test` database

### Phase 4
- [x] Merge PR #8
- [ ] Temporary script to seed 100 placeholder products (the developer will provide it)

### Before later phases
- [x] Phase 6: build `GET /admin/stats` (FR-18)
- [ ] Try `GET /admin/stats` in Postman against Atlas
- [ ] Frontend: get written design approval, as `documentV1/rules.md` requires

### Legal checks before launch (confirm with a Maltese adviser)
- [ ] Food information before purchase (ingredients, allergens, net quantity): no structured product fields exist yet
- [ ] Unit prices such as price per kg: `unit` is free text, so they can't be calculated yet
- [ ] Privacy policy and GDPR handling of customer accounts, including Google login and sending email through an outside provider
- [ ] Terms, returns and withdrawal wording for online sales

### Before launch
- [ ] Buy the domain and hosting, and host the API on a subdomain such as `api.yourdomain.com`
- [ ] Security audit 9: create a separate production database, database user and secrets, set only on the hosting server. `backend/.env` syncs to OneDrive, so keep only development values in it
- [ ] Set `NODE_ENV=production`, `MONGODB_URI`, a new `JWT_SECRET`, a new `TWO_FACTOR_SECRET`, `CLIENT_URL`, `COOKIE_DOMAIN`, `TRUST_PROXY_HOPS`, `GOOGLE_CLIENT_ID`, `SMTP_*`, `MAIL_FROM` and `CLOUDINARY_*` on the server
- [ ] Add the live site's address to the Google OAuth client's allowed origins
- [ ] Allow the server's IP address in Atlas Network Access

## Known Limits

- `shopRating` is typed in by the admin and doesn't come from customer reviews. The frontend must label it as the shop's own rating, with no review counts.
- An image uploaded but never saved to a product stays in Cloudinary, because the backend doesn't know about it. It only costs storage.
- Cloudinary can't limit file size at upload time, because neither a signature nor an upload preset supports it. So an oversized file is stored until the product save rejects and deletes it, and a file uploaded but never saved still stays, as before. Cloudinary's own plan limit is the hard upper bound.
- Removing an image from one product while another product adds the same image at the same moment can still delete it. The edit checks that no other product uses the image, then deletes it in the background, and a save that lands in between isn't seen. This needs two admins editing a shared image within milliseconds. If the shop gets several admins, delete removed images after a delay, checking again first.
- Password reset and 2FA codes both go to the same inbox, so someone who controls that email can pass both. Authenticator apps would be stronger.
- Logging out ends the user's sessions on every device.
- Password reset links are logged by the frontend's server if it logs URLs, and the reset page should send no referrer.
- Next.js server rendering sends catalog requests from one server IP, so a busy store could reach the 300 per minute limit. Watch this after launch.
- Rate limit counts are kept in the server's memory, so they reset on restart and need a shared store if the API ever runs on more than one server.
- Checkout needs MongoDB transactions, so it fails on a plain local `mongod`. Atlas and the tests support them.
- A double submit is only caught when the frontend sends an `Idempotency-Key`: one new UUID per checkout attempt, reused for retries of that attempt. Without the header, two submits still create two orders.
- Repeated requests with the same key still count toward the 10 orders per 15 minutes limit.
- The browser can't read `X-API-Version`, because CORS doesn't expose it. Add `exposedHeaders` if the frontend ever needs it.
- Checkout charges the current price, so a price change after adding to the cart changes the total. The frontend should show the returned total.
- An admin saving a product's `stock` overwrites the number, so a sale made while the form was open is lost (audit finding 19).
- The revenue total reads every order, because `paymentStatus` has no index, and the `$or` needs both sides indexed to avoid a full scan. That's fine for a small shop. If the dashboard gets slow, add a `paymentStatus` index or keep a running total.
