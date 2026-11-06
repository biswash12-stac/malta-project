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
1. Login → backend sets httpOnly secure cookie with JWT.
2. Frontend sends credentials with every request.
3. Backend auth middleware verifies token and loads the user from the DB, so a role change applies at once; admin routes also require role = admin.
4. Each token carries the user's `tokenVersion`. Logout and the admin seed increase it, which cancels all of that user's tokens at once, so logging out on one device logs out every device.

**Cookie and domains:** the cookie is `httpOnly`, `Secure` in production, and `SameSite=Lax`. Host the site and API on one parent domain (`shop.com` and `api.shop.com`) and set `COOKIE_DOMAIN=.shop.com`. Next.js middleware can only see the cookie this way, so route protection fails if the API stays on a separate `*.onrender.com` address. Lax also blocks cross-site POST requests from carrying the cookie, which is the CSRF protection.

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
- Images: Cloudinary
- HTTPS only; separate env variables per environment.
- Production uses its own database, database user and `JWT_SECRET`. Set them only on the hosting server, never in a local `.env` or a folder synced to OneDrive or similar.
- Rate limits: 300 requests per minute per IP across the API (health check excluded), 20 login and register attempts per 15 minutes per IP, and 10 failed logins per 15 minutes per account. Next.js server rendering sends requests from one server IP, so watch the general limit after launch.
- Set `NODE_ENV=production`, `CLIENT_URL`, `COOKIE_DOMAIN` and `TRUST_PROXY_HOPS` on the backend host.
- `TRUST_PROXY_HOPS` is the number of proxies in front of the API, and the server won't start in production without it. Check the chosen host's documentation: too high lets clients fake their IP and dodge rate limits, and too low puts all users under one limit.

## 9. Backend File Structure
See `backend-structure.md`.
