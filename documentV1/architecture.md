# Architecture

## 1. High-Level
```
Browser → Next.js (SSR + client components) → Express REST API → MongoDB
                                                   └→ Cloudinary (images)
```
Frontend and backend deploy separately.

## 2. Backend Layers
Route → Controller → Service → Model.
- Controllers: HTTP only (read request, call service, send response).
- Services: business rules (stock check, order numbering, status transitions).
- Models: MongoDB access via Mongoose.
- No business logic in routes.

## 3. Frontend (Next.js App Router)
- Public: `/`, `/products`, `/products/[slug]`, `/cart`, `/checkout`, `/orders/[id]`, `/login`, `/register`
- Admin: `/admin`, `/admin/products`, `/admin/orders`, `/admin/orders/[id]`, `/admin/categories`
- Route protection: middleware + server-side role check.
- Data: server components for catalog (SEO); client fetch for mutations.

## 4. Auth Flow
1. Login → backend sets two httpOnly cookies: `access_token` (15-minute JWT) and `refresh_token` (7 days, random, stored only as a hash in `RefreshSession`). With 2FA on, it sets only a 10-minute pending cookie until the emailed code is confirmed.
2. Frontend sends credentials with every request.
3. Backend auth middleware verifies token and loads the user from the DB, so a role change applies at once; admin routes also require role = admin.
4. When a request gets a 401, the frontend calls `POST /auth/refresh` once and retries. Each refresh replaces the refresh token. A replaced token used again after a 10-second grace period counts as theft and ends all of that user's sessions.
5. Access tokens and sessions carry the user's `tokenVersion`. Logout, password reset and the admin seed increase it, which cancels all of that user's tokens at once, so logging out on one device logs out every device.

**Cookie and domains:** all cookies are `httpOnly` and `Secure` in production. The access cookie is `SameSite=Lax`; the refresh and pending cookies are `SameSite=Strict` and sent only to auth routes. Host the site and API on one parent domain (`shop.com` and `api.shop.com`) and set `COOKIE_DOMAIN=.shop.com`. Next.js middleware can only see the cookie this way, so route protection fails if the API stays on a separate `*.onrender.com` address. Lax also blocks cross-site POST requests from carrying the cookie, which is the CSRF protection.

## 5. Order Creation Flow
1. Client sends items (productId, qty) + delivery details.
2. Server loads products, checks active + stock, recomputes prices.
3. Server creates order (status pending, COD) and decrements stock in one transaction. MongoDB transactions need a replica set: Atlas has one, but a plain local `mongod` does not, so develop against Atlas and test with `MongoMemoryReplSet`.
4. Returns order number; client shows confirmation.

## 6. Order Status State Machine
```
pending ──► confirmed ──► packed ──► out_for_delivery ──► delivered
   │            │
   └────────────┴──► cancelled (stock restored)
```
Enforced in the order service only. Every change is logged in statusHistory.

## 7. Payment Extensibility
Define a `PaymentProvider` interface: `createPayment(order)`, `verifyPayment(payload)`, `refund(order)`.
- v1: `CodProvider` (no-op, payment stays pending until delivery).
- Later: add `StripeProvider`, register it in `payment.registry.ts`, add a webhook route.
- Order schema already has paymentMethod and paymentStatus, so no migration needed.

## 8. Deployment
- Frontend: Vercel
- Backend: Render / Railway / small VPS
- Database: MongoDB Atlas
- Images: Cloudinary, with signed direct uploads. The backend signs each upload for the `products` folder and allowed image formats, the browser sends the file to Cloudinary, and the API secret never leaves the server. Removed, replaced and rejected images are queued and later deleted by the cleanup job, never during a request.
- HTTPS only; separate env variables per environment.
- Production uses its own database, database user and `JWT_SECRET`. Set them only on the hosting server, never in a local `.env` or a folder synced to OneDrive or similar.
- Rate limits: 300 requests per minute per IP across the API (health check excluded), 20 attempts per 15 minutes per IP shared by register, login, Google login, password reset and the five 2FA routes (one counter per IP, not one per route), and 10 failed logins per 15 minutes per account. Next.js server rendering sends requests from one server IP, so watch the general limit after launch.
- Set `NODE_ENV=production`, `CLIENT_URL`, `COOKIE_DOMAIN` and `TRUST_PROXY_HOPS` on the backend host.
- `TRUST_PROXY_HOPS` is the number of proxies in front of the API, and the server won't start in production without it. Check the chosen host's documentation: too high lets clients fake their IP and dodge rate limits, and too low puts all users under one limit.

### Production security checklist (added 2026-11-13)
- Upload lifecycle: each signature covers one file at a server-chosen `public_id` and records an upload ticket. A product save only claims its images' tickets. An hourly job in the API (with a MongoDB lease lock) settles the tickets. It deletes files left unattached for over 24 hours, and images an edit removed or the size and format check rejected (after a 15-minute grace period). It never deletes an image a product uses. Orders, products and users never expire. See `backend/API.md` → Data lifecycle.
- Product images: the backend checks each new image with Cloudinary before a product can use it: 5 MB at most (`UPLOAD_MAX_BYTES`), and a stored format of JPG, PNG or WebP. Rejected files are queued for the cleanup job. The upload signature also gives the browser the limit, so it can refuse a file before uploading.
- Frontend: send a Content-Security-Policy and the other security headers (`X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`) from `next.config.ts`. Next.js needs inline scripts unless pages render per request with a nonce, so the policy allows `'unsafe-inline'` scripts but limits scripts, images, connections and framing to known origins. Check it in the browser before launch.
- CI: `.github/workflows/ci.yml` runs the backend type check, both test suites, and the frontend lint and build on every PR and on every push to `main`. It needs no secrets.
- MongoDB Atlas, set up by the developer in the Atlas console:
  - [ ] A production database user just for the API, not the development user. Built-in role `readWrite` on the production database only, never `atlasAdmin` or `readWriteAnyDatabase`. A long random password.
  - [ ] Network access: only the API host's outgoing IP addresses. If the host has no fixed IP, `0.0.0.0/0` is the usual compromise, and it makes the strong password and rotation essential.
  - [ ] Backups: the free M0 tier has no automated backups. Use a paid tier with Cloud Backup, or a scheduled `mongodump` to separate storage. Test a restore before launch, and then every few months.
  - [ ] Connection string: a `mongodb+srv://` address with the database name, set only as an environment variable on the host. Rotate the password when anyone with access leaves, or if it may have leaked. The app already hides it in logs.
  - [ ] Monitoring: turn on Atlas alerts for connections and unusual activity, require 2FA for Atlas accounts, and keep the project member list short.

### Production operations (planned, not started)
Decide these with the hosting choice, and check each one off before launch.
- [ ] Automatic restarts: the host restarts the API if it crashes or fails its health check (`/api/v1/health`, `/api/v1/health/ready`). On a fatal error the API exits instead of running half-broken.
- [ ] Monitoring and alerts: uptime checks on the readiness probe, and log alerts. Which logs to alert on is listed in `SECURITY_IMPLEMENTATION_PLAN.md` P3.
- [ ] Database backups with a tested restore (see Backups above).
- [ ] Deployment rollback: know how to redeploy the previous version on the chosen host, and keep database changes backward compatible so a rollback is safe.
- [ ] DNS recovery: who controls the domain and DNS records, where the records are written down, and the login and 2FA for the registrar.
- [ ] Customer-facing outage handling: what customers see when the site or API is down (a maintenance page or message), and how pending orders are communicated.
- [ ] Incident response: who is contacted, how secrets are rotated after a leak, and a short written runbook.

## 9. Backend File Structure
See `backend-structure.md`.
