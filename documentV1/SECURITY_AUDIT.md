# Security Audit: Malta Grocery Shop

Date: 2026-11-13. Status: **audit only, nothing fixed yet.** The remediation plan is in `SECURITY_IMPLEMENTATION_PLAN.md`.

This application is **not** fully secure and **not** production-ready. This document lists what was verified, what is weak, and what can't be verified from the repository.

## Scope and method

- **Code reviewed:** branch `feature/lifecycle-and-seed`, at `main` `76455f4` (PR #13 merged), plus the uncommitted working-copy changes:
  - upload tickets and cleanup
  - the development seed
  - the CORS `allowedHeaders` list
  - the Jest security tests.

  **Line numbers refer to the working copy** on 2026-11-13. Files changed by uncommitted work (`upload.service.ts`, `product.service.ts`, `app.ts`) have different line numbers at `76455f4`.
- **Method:**
  - read the backend auth, order, upload and admin flows end to end
  - re-checked every finding below against the source
  - ran `npm audit --omit=dev` in both apps
  - tested one finding (S-03) by running the real validation schema from a scratch script.
- **Tools:** Context7 MCP isn't installed and wasn't used. There are no `CLAUDE.md` files in the repo.
- **Threat model:** the attacker controls the browser completely: DevTools, `localStorage`, React state, request editing, and direct calls with curl or Postman.

## Summary

| Category | Findings |
|---|---|
| Confirmed vulnerabilities (backend) | S-01 (Medium), S-02 (Medium), S-03 (Low), S-05 (Low) |
| Defence-in-depth weaknesses (backend) | S-04 (Low), S-07 (Low), S-09 (Info) |
| Business decisions | S-06 (Low), S-08 (Info) |
| Frontend demo weaknesses (they don't give access to the backend) | F-01 (High), F-02 (Medium), F-03 (Medium) |
| Not applicable | N-01 |

**No Critical or High backend vulnerability was found that frontend tampering could exploit.**
- **Roles:** checked on the server against the database on every request.
- **Ownership:** order reads are filtered by the user in the session.
- **Checkout values:** prices, fees and totals come only from the server.
- **Stock and duplicate orders:** protected by a transaction and an idempotency key.

Changing `localStorage`, React state, hidden fields or route guards gives no backend access and changes no authoritative value. Section 6 lists the evidence and the tests that prove it.

**Severity scale:**
- **Critical:** customers' data or money is at risk without special access.
- **High:** a likely route to account takeover, or major data exposure.
- **Medium:** a real weakness with limited reach or that needs user interaction.
- **Low:** needs privileged access, or has only small impact.
- **Info:** no direct security impact.

---

## 1. Confirmed vulnerabilities (backend)

### S-01: Logged-in and admin responses can be cached (Medium, confirmed)
- **Evidence:**
  - No `Cache-Control` header is set anywhere in `backend/src`.
  - Express sends an `ETag` by default.
  - Logged-in data is served by `GET /auth/me` (`backend/src/modules/auth/auth.controller.ts:110-112`), `GET /orders/mine` and `/orders/:id` (`backend/src/modules/orders/order.routes.ts:16-17`), and all `/admin/*` routes.
- **Exploit:**
  - On a shared computer, after a customer logs out, the next person presses Back, or opens the browser cache, and sees the previous user's orders or delivery address.
  - A misconfigured intermediate proxy could also store a logged-in response.
- **Impact:** disclosure of personal data (names, phones, addresses, order history) and of admin data.
- **Fix:** send `Cache-Control: no-store` on every `/api/v1` response (simplest; the API serves no static assets). Optionally add `Pragma: no-cache`.
- **Regression test:** `/auth/me`, `/orders/mine` and `/admin/stats` responses have `Cache-Control: no-store`, and so do public catalogue responses (one rule, applied everywhere).
- **Dependencies and risks:** none. If public catalogue caching is wanted later for performance, add it per route on purpose.

### S-02: The password reset token travels in the URL query string (Medium, confirmed)
- **Evidence:** `backend/src/modules/auth/password-reset.service.ts:26` emails `${CLIENT_URL}/reset-password?token=<64 hex>`.
- **Exploit:**
  - The token stays in browser history and in the frontend server's access logs.
  - If the reset page loads any third-party resource, the token can leak in the `Referer` header.
  - Anyone with the history or logs inside 30 minutes, before the link is used, can set a new password.
- **Impact:** account takeover inside a narrow window. Two things limit it: the token works once and expires in 30 minutes (`password-reset.service.ts:11`), and resetting ends every session.
- **Fix (coordinated backend and frontend change):**
  - The email link becomes `${CLIENT_URL}/reset-password#token=<token>`. The fragment is never sent to any server and never appears in `Referer`.
  - The reset page reads `location.hash`, then immediately calls `history.replaceState` to remove it. It sends the token in the JSON body, as `POST /auth/reset-password` already expects.
  - The page also sends `Referrer-Policy: no-referrer`.
- **Regression tests:**
  - Backend: the reset email contains `/reset-password#token=` and not `?token=`.
  - Frontend, once approved: the reset page reads the fragment, clears it, and posts the token in the body.
- **Dependencies and risks:**
  - It's a **breaking change to the email link format**, and it needs the frontend reset page, which doesn't exist yet (see the frontend proposal).
  - Links sent before the change stop working. They expire within 30 minutes anyway.

### S-03: Image IDs with `..` escape the `products/` folder (Low, confirmed, admin only)
- **Evidence:**
  - `backend/src/modules/products/product.schema.ts:13-15`: `publicId` matches `^products/[\w./-]+$`, which allows `.` and `..` segments.
  - The URL check (`:19-23`) uses `url.includes(publicId)` on the raw string.
  - Test on 2026-11-13: `{ url: ".../image/upload/products/../secret/logo.jpg", publicId: "products/../secret/logo" }` **is accepted**, and the browser loads `/demo/image/upload/secret/logo.jpg`.
  - `getImage` (`backend/src/modules/uploads/upload.service.ts:62-71`) builds an Admin API URL that `fetch` normalises the same way.
- **Exploit:** an admin, or someone who stole an admin session, links any image in the shop's Cloudinary account to a product, bypassing the `products/` rule. Deletion uses `public_id` as a form field, not as a URL path, so this hasn't been shown to delete files outside the folder.
- **Impact:** it breaks the "this store's `products/` folder only" rule. Limited reach, because it needs admin access.
- **Fix:** reject any `publicId` with an empty, `.` or `..` segment, i.e. `^products/(?:[\w-]+/)*[\w-]+$` with dots only inside a segment. Ticketed uploads always match `^products/[0-9a-f-]{36}$`.
- **Regression test:** creating a product with `products/../x`, `products/./x` or `products//x` returns a 400; existing valid IDs still pass.
- **Dependencies:** none.

### S-05: Customer phone numbers end up in request logs (Low, confirmed)
- **Evidence:**
  - `backend/src/app.ts:50-52` logs `req.url`, including the query string.
  - Admin search `GET /admin/orders?q=79123456` (`backend/src/modules/orders/order.schema.ts:44-49`) puts a phone number in that query string.
- **Exploit:** not an attack. Anyone with access to the log store sees customer phone numbers.
- **Impact:** personal data in logs (GDPR data minimisation), and the logs are kept by the hosting provider.
- **Fix:** log `req.path`, without the query string, or redact `q`.
- **Regression test:** a log line for `/admin/orders?q=79123456` doesn't contain `79123456`.

## 2. Defence-in-depth weaknesses (backend)

### S-04: No `Origin` check on POST requests without a body (Low, confirmed)
- **Evidence:**
  - Routes: `backend/src/modules/auth/auth.routes.ts:56-57` (refresh, logout), `:77` (2FA enable), `:79` (2FA disable request), `backend/src/modules/uploads/upload.routes.ts:10-13` (signature).
  - CORS (`app.ts:31-40`) only controls which origins can *read* responses. A simple cross-origin POST is still *sent*.
- **Exploit:**
  - Cross-site requests are mostly blocked:
    - `SameSite=Lax` (`auth.controller.ts:37`) keeps the access cookie off cross-site POSTs
    - bodies must be JSON, and a form can't send that
    - PATCH, PUT and DELETE need a CORS preflight.
  - But a **compromised sibling subdomain** of the shop's domain counts as the same site. From there, an attacker could send body-less POSTs that:
    - log users out (a nuisance)
    - trigger 2FA emails, within the rate limit
    - create upload tickets as an admin.
  - The refresh cookie is `Strict`.
- **Impact:** a nuisance or denial of service. It can't change data or reach another account.
- **Fix:** a middleware for `POST`, `PUT`, `PATCH` and `DELETE` that rejects a request whose `Origin` header is present but isn't `CLIENT_URL`. Requests without `Origin`, from curl or Postman, are allowed: CSRF needs a browser, and browsers always send `Origin` on these requests. No CSRF token or dependency is needed for a JSON-only API.
- **Regression tests:** `POST /auth/logout` with `Origin: https://evil.example` gets a 403. With `Origin: CLIENT_URL`, or with no `Origin`, it works. `GET` is unaffected.
- **Risk:** a wrong `CLIENT_URL` in production would block every state-changing request. The startup check already requires `CLIENT_URL`.

### S-07: No rate limit on upload signatures (Low, confirmed, admin only)
- **Evidence:** `backend/src/modules/uploads/upload.routes.ts:10` has only the general limit of 300 per minute per IP. Each call writes an `UploadTicket` (`upload.service.ts`, `createUploadSignature`).
- **Exploit:** a stolen admin session floods the ticket collection. Cleanup removes them after 24 hours, by calling Cloudinary for each one.
- **Impact:** more database writes and Cloudinary API calls.
- **Fix:** a per-IP limit on `POST /admin/uploads/signature`, e.g. 60 per 15 minutes, matching the existing limiters.
- **Regression test:** request 61 within the window gets a 429.

### S-09: `/health` reports process uptime (Info, confirmed)
- **Evidence:** `backend/src/routes.ts:19-21`.
- **Impact:** a small information leak; restarts can be spotted.
- **Fix (optional):** return only `{ status: "ok" }`.
- **Regression test:** the health body has no `uptime`.

## 3. Findings that need a business decision

### S-06: Development mode logs email text, including reset links and 2FA codes (Low, confirmed, development only)
- **Evidence:** `backend/src/utils/mailer.ts:24-27` logs `{ to, subject, text }` only when `!SMTP_HOST && isDevelopment`.
- **Impact:** none in production. It conflicts with the rule "never log reset tokens", but it's a deliberate way to test email flows without SMTP.
- **Decision:**
  - (a) keep it, documented as development only
  - (b) log only `to` and `subject`, and read codes in tests through the mock mailer as tests already do.
- **Regression test for (b):** in development without SMTP, the log line contains no reset token.

### S-08: Product lists show exact stock (Info)
- **Evidence:** `stock` is in `LIST_FIELDS`, `backend/src/modules/products/product.service.ts:18-19`.
- **Impact:** competitors can see inventory levels. Not an access-control issue.
- **Decision:** keep it, or show only `inStock` and `lowStock` publicly and exact stock to admins. This is gap-analysis Q7, and it changes the API response.

## 4. Frontend demo weaknesses

These don't give access to the backend: the API ignores the browser's role, prices and storage. They're listed separately because they would harm real users if the site went live as it is.

### F-01: Demo login keeps passwords in code and in `localStorage` (High, confirmed)
- **Evidence:**
  - `frontend/context/AuthContext.tsx:59-75`: demo accounts with plain-text passwords, shipped to every browser.
  - `:113-145`: accounts, passwords included, written to `localStorage` key `malta-accounts`.
  - `:195-205`: login compares plain-text passwords in the browser.
  - Earlier check: the demo passwords don't match the real admin account or any value in `backend/.env`.
- **Exploit:** anyone with access to a user's browser, or any XSS on the site, reads every password registered on that browser. Customers often reuse passwords.
- **Impact:** customers' passwords exposed if real users register before the frontend is connected to the API. No backend data is exposed.
- **Fix:** frontend integration, which needs your permission:
  - auth state from `GET /auth/me` only
  - login, register and logout through the API
  - delete `DEMO_ACCOUNTS` and every user or password write to `localStorage`.
- **Regression test:** after integration, a browser test checks that no `localStorage` or `sessionStorage` key contains a password, token or role.

### F-02: The admin route guard trusts the role in `localStorage` (Medium, confirmed)
- **Evidence:** `frontend/app/admin/layout.tsx:60-68` checks `user.role` from `AuthContext`, which reads `localStorage` key `malta-user` (`AuthContext.tsx:56,154`).
- **Exploit:** setting `role: "admin"` in `localStorage` opens the admin screens. They show only browser demo data. Every real admin API returns 401 or 403 (tested).
- **Impact:** confusing UI exposure, but no data access.
- **Fix:** guard the layout using `GET /auth/me` and `role === "admin"`. This controls only what the user sees.
- **Regression tests:**
  - The backend tests already prove a customer gets 403 on every admin API.
  - Frontend: with a customer session, `/admin` redirects.

### F-03: No Content Security Policy on the frontend (Medium, confirmed)
- **Evidence:** `frontend/next.config.ts` has no `headers()`. A policy was tested in a separate build (`FRONTEND_PROGRESS.md`) but not applied.
- **Impact:** no second layer of protection if an XSS bug appears. No `dangerouslySetInnerHTML` was found, and React escapes output.
- **Fix:** apply the tested CSP and security headers, then check it in a browser.
- **Regression test:** a test of the frontend's response headers, plus a manual check for CSP errors in the browser console.

## 5. Not applicable

### N-01: Upload ticket ownership between users
- **Why it doesn't apply:** only admins can sign uploads or save product images, and there's one admin role. Any admin using any admin's upload is the intended behaviour.
- **What's recorded:** tickets store `createdBy` (`backend/src/modules/uploads/upload-ticket.model.ts`) for audit.
- **Revisit if:** staff roles or per-user uploads are added.

## 6. Controls verified, and the tests that prove them

| Area | Control | Evidence | Tests |
|---|---|---|---|
| Tokens | Tokens only in httpOnly cookies, never in JSON | `auth.controller.ts:32-44` (cookie settings); bodies return only `{user}` or `{requires2FA}` | `auth-tokens.test.ts` "login sets both cookies safely and never puts tokens in the body" |
| Cookie flags | `Secure` in production; access `Lax`, refresh `Strict` limited to `/api/v1/auth`, 2FA cookie `Strict` limited to `/api/v1/auth/2fa` | `auth.controller.ts:32-44` | `jest/production-cookies.test.ts` (committed in `34e2afb`) |
| Logout | Ends all sessions on the server: `tokenVersion` bumped, refresh sessions deleted | `auth.service.ts:72-87`; `requireAuth` checks `tokenVersion` (`auth.middleware.ts:14-16`) | `sessions.test.ts` "logout cancels the token on every device" |
| Refresh | Rotated each time; reusing an old one after 10 seconds ends all sessions; stored as a hash; TTL removes expired ones | `session.service.ts:9-14`; `refresh-session.model.ts:17` | `auth-tokens.test.ts` (5 tests) |
| Password reset | Single use, 30 minutes, ends all sessions; same response for known and unknown emails | `password-reset.service.ts:11,19` | `password-reset.test.ts` (9) |
| Roles | Read from the database on every request; changing the role applies to existing tokens | `auth.middleware.ts:15`, `role.middleware.ts:6-10` | `auth.test.ts` "requireRole blocks customers, and a role change applies to existing tokens" |
| Admin routes | Every admin route requires `requireAuth` + `requireRole("admin")` | `product.routes.ts:23`, `category.routes.ts:15`, `order.admin.routes.ts:24`, `upload.routes.ts:10` | 401/403 tests in `orders`, `products`, `categories`, `uploads` |
| Order ownership | A customer sees only their own orders (another customer's returns a 404) | `order.service.ts:175-179` filters by `user` from the session | `orders.test.ts` "customers only see their own orders…" |
| Mass assignment | Strict Zod schemas; register ignores `role` | `order.schema.ts:15`, `product.schema.ts`, `category.schema.ts` | `jest/security.test.ts` (committed in `34e2afb`), strict-schema tests |
| Checkout values | Prices, fees and totals rejected from the client; prices read from MongoDB inside the transaction | `order.schema.ts:14-15`; `order.service.ts` | `orders.test.ts` "the client can't send prices, a delivery fee or a total" |
| Stock and duplicates | Conditional stock decrement in a transaction; `Idempotency-Key` with a unique index per user | `order.service.ts` | parallel oversell and parallel idempotency tests |
| Status and payment | Strict status path; paid only once delivered, and only once | `order.status.ts`; `order.service.ts` | `orders.test.ts` |
| Injection | `strictQuery`, strict query schemas, string types | `config/db.ts`, `utils/common.schema.ts` | `validate.test.ts`, `products.test.ts`, `jest/security.test.ts` |
| Brute force | Per-IP and per-account login limits; 2FA lock after 5 wrong codes. Updated by A-01 (2026-11-15, see §10): at most 5 guesses per account in a fixed 15-minute window, not reset by a new code | `rate-limit.middleware.ts:13-68`; 2FA: `two-factor.service.ts` | rate-limit tests in `auth`, `password-reset`, `two-factor` |
| Errors | Generic 500, no stack trace; secrets hidden in logs | `error.middleware.ts`; `utils/logger.ts` | `auth.test.ts` |
| Google sign-in | Audience and verified email checked; unsafe account linking handled | `google.service.ts:16-20` | `google.test.ts` (10) |
| Uploads | Admin-only signing; one server-named file; size and format checked against Cloudinary's stored data; cleanup never deletes an image in use | `upload.service.ts`, `upload-cleanup.ts` (committed in `34e2afb`) | `uploads.test.ts` (24), `upload-cleanup.test.ts` (8) |
| Dependencies | `npm audit --omit=dev`: 0 advisories in backend and frontend (2026-11-13) | — | CI doesn't run `npm audit` yet (see P3) |

## 7. The five risk areas

| Area | Current state | Open items |
|---|---|---|
| **Sessions** | Sound: httpOnly cookies, rotation, reuse detection, logout and reset revoke on the server, roles re-read every request | S-01 (caching), S-02 (reset link), S-04 (Origin check). Rate-limit counters are kept in memory |
| **Uploads** | Admin only; one server-named file per signature; size and format checked against Cloudinary's data; tickets plus a locked, repeatable cleanup that never deletes images in use | S-03 (`..` IDs), S-07 (signature rate limit). Edit-path and cleanup check-then-delete races, milliseconds wide and admin only. Files uploaded before tickets existed are never cleaned up |
| **Order integrity** | Server-calculated prices, fees and minimum; transactional stock; idempotency; ownership; status path; payment only after delivery | None found in the backend. The frontend still works out its own totals for display only (to be replaced) |
| **Frontend/backend contract** | `backend/API.md` is verified; the frontend isn't connected | F-01, F-02, F-03; integration pending your approval; the S-02 reset page is new frontend work |
| **Seed quality** | Development only, refuses production, inserts only, 100 products, no images or invented ratings | Nepali names unreviewed; alcohol and energy drinks need a Malta legal and age-verification review; placeholder prices and stock must never reach production |

## 8. Residual risks, production configuration and manual verification

**Accepted or documented earlier:**
- Registration reveals whether an email is registered, until email verification exists.
- Rate-limit counters are kept in memory: they reset on restart and aren't shared between instances.
- An admin can lock a customer out with repeated failed logins (accepted trade-off).
- A double submit without an `Idempotency-Key` still creates two orders. The frontend must send the key.
- Logging out ends sessions on every device.

**Depends on production configuration (can't be checked from the repository):**
- **HTTPS everywhere,** with HTTP redirected; `Secure` cookies need it.
- **`CLIENT_URL`** set to the exact HTTPS origin (CORS and the planned S-04 check), and **`COOKIE_DOMAIN`** shared by the site and the API.
- **`TRUST_PROXY_HOPS`** matching the real proxy chain; otherwise the IP rate limits can be dodged or wrongly shared.
- **Secrets:** new production `JWT_SECRET` and `TWO_FACTOR_SECRET`, set only on the host.
- **Atlas:** least-privilege user, IP allowlist, backups (`architecture.md` §8).
- **Cloudinary:** the API secret on the server only. Check whether the account can enforce a size limit.
- **Log retention and access,** for personal data.

**Needs manual verification:**
- Real Google sign-in. `GOOGLE_CLIENT_ID` isn't set locally.
- Real Cloudinary upload, check and delete against the live account.
- The frontend CSP in a browser.
- Cookie behaviour across the real production domains.

## 9. Test gaps

| Gap | For finding |
|---|---|
| `Cache-Control: no-store` on API responses | S-01 |
| Reset email uses the URL fragment | S-02 |
| `..`, `.` and empty segments rejected in image IDs | S-03 |
| Foreign `Origin` rejected on state-changing requests | S-04 |
| Request logs without query strings | S-05 |
| Rate limit on upload signatures | S-07 |
| (Added 2026-11-13: `backend/tests/jest/tampering.test.ts`, 10 tests) One Jest "frontend tampering" suite: a forged `role` (body and cookie), client prices and fees on checkout, another customer's order ID, each admin route called as a customer, no token in any auth response body | regression documentation (most cases are already covered across files) |
| Frontend: no credentials or roles in browser storage; the admin guard uses `/auth/me` | F-01, F-02 (after approval) |

## 9a. Code review of the fixes (2026-11-14)

`/code-review` (high) over the backend changes reported 10 items. Verified and fixed, with tests:

- **R-1 (security):** a signature pinned `public_id` without `overwrite=false`. Within its hour, the same signature could replace an already-checked image with an unchecked one, bypassing the size and format check. `overwrite=false` is now signed and returned.
- **R-2:** an unparseable image URL threw inside the schema and returned a 500. It now returns a 400.
- **R-4:** no index on `images.publicId`. Added.
- **R-6:** the cleanup lock lease (10 minutes) was shorter than a worst-case run. It was raised to 60 minutes, and later replaced by a 10-minute lease renewed after every file (see **Lock renewal** below).
- **R-7:** a ticket-removal failure after a successful save returned a 500. It's now logged and the request succeeds. Superseded by R-11: saves no longer remove tickets, so this step no longer exists.
- **R-9:** CORS and the Origin check read `CLIENT_URL` differently. Both now use `CLIENT_ORIGIN`.
- **R-10:** the seed's hard-coded count. Fixed.

**Fixed 2026-11-14:**
- **R-3:** the race between a save and the cleanup is closed. A save claims its tickets before checking, the cleanup claims each ticket atomically, and a save meeting a ticket being deleted gets 409. A test runs the cleanup in the middle of a save.
- **R-5:** failed deletes back off (1 h doubling to 24 h) and are skipped until due, so they never block newer tickets.
- **Lock renewal:** the lease is renewed after every file, a run that loses it stops, and per-ticket claims stop two workers handling the same file.

**Second review (2026-11-14), after R-3 and R-5:**
- **Fixed:**
  - a database error on one ticket no longer aborts the cleanup run, and a failed lock release no longer hides the real error
  - the lease rule is shared by saves and the cleanup, so they can't drift
  - ticket claim and release are `upload.service` helpers, and the claim sits inside the image check
  - edits without images no longer write to tickets.
- **Still open:**
  - **R-11: fixed 2026-11-14.** Removed images are now queued as removal tickets (written before the product save) and deleted by the cleanup under the same claim, recheck and retry rules, after a 15-minute grace period. No tickets are created for images that are only attached (no backfill). Tests: removal queued, not deleted; grace period; an image still in use is kept; a failed save keeps its image; a save racing the cleanup; a save while deleting gets 409; adding the image back keeps it (the cleanup finds it in use and only drops the ticket); images already on products are never touched; repeat runs are safe. The original description follows.
  - **R-11, edit-path deletion race (High-ish data integrity, admin only).** When an edit removes an image, `deleteUnusedImages` (`product.service.ts`) deletes it straight away, outside the ticket system. A product saved at the same moment with that image could keep a broken link. This was already a documented Phase 3 limit.
    - **Proposed fix:** turn each removed image into an immediately-due cleanup ticket, so it's deleted under the same claim and in-use recheck rules, with retries.
    - **Open design question:** how to treat older images that have no ticket.
  - **R-11 code review (2026-11-14):**
    - **Fixed:**
      - rejected files are queued instead of deleted straight away, so no deletion happens outside the cleanup
      - tickets are settled only by the cleanup's in-use recheck, never removed by a save
      - a stale edit of `images` gets 409 `CONFLICT` (a Mongoose `VersionError`) instead of 500
      - a database error after a successful Cloudinary delete no longer triggers a Cloudinary back-off
      - the upload tests no longer depend on each other
      - a misplaced comment and a parameter name that hid `id`.
    - **Documented, not changed:**
      - a 409 can occur within 10 minutes of a cleanup worker failing, even for an image in use
      - the claim query uses only the `createdAt` index
      - the signature limit is per IP, as you decided
      - parallel edits of price and stock aren't versioned (audit item 19).
  - **R-11 final remediation (2026-11-14),** after the final review and two more code reviews. Each point has a regression test that fails when its guard is removed. The one gap, a test isolating the "claim still in the future" part of the pre-delete check, was closed on 2026-11-15 (see the R-14 fix below):
    - **Ticket revision (`rev`):** `queueImageRemoval` increments `rev`, and every write a cleanup worker makes matches the `rev` it claimed. A removal queued while a worker holds the ticket can no longer be dropped by the worker's older "still in use" decision. Tickets created before `rev` existed match `rev: null`.
    - **Claim give-back ownership:** when its write misses (the image was in use or the delete was skipped), the worker clears only its own claim, matched on its own `deletingUntil`. A newer worker's claim always has a later `deletingUntil`, so it's never cleared.
    - **Pre-delete check:** right before calling Cloudinary, the worker re-takes its claim in one atomic write. It succeeds only if the claim never lapsed (same value, still in the future), no product save holds a claim, and `rev` is unchanged. It renews the claim for 10 minutes. A worker that stalled after its in-use check stops instead of deleting.
    - **Retry back-off:** `queueImageRemoval` uses `$max` on `nextAttemptAt`, so a removal never cuts short a retry back-off already set. A removal still waits at least 15 minutes.
    - **Claim kept after a failed or uncertain delete:** after a Cloudinary error, timeout or unreadable answer, the retry and error are recorded but the claim is kept until it expires (10 minutes). If the delete still goes through, no save can have attached the file meanwhile. Retries are unaffected, because the back-off starts at 1 hour.
    - **Remaining risks (documented, not fixed):**
      - **R-14: fixed 2026-11-15** (see below). `claimUploadTickets` claims and then checks in two separate calls, and a save could continue without a claim.
      - a delete Cloudinary carries out more than 10 minutes after we gave up on it isn't covered, because Cloudinary has no conditional delete
      - a worker that stalls more than 10 minutes between its pre-delete check and Cloudinary acting on the request
      - claims compare server clocks (R-13), and saves are assumed to take under 15 minutes
      - a save can get 409 `UPLOAD_EXPIRED` for up to 10 minutes after a failed delete, by design
      - lower-severity review items left open: a delete counted twice when re-queued mid-delete, attempts lost when a re-queue and a failed delete coincide, and a skipped delete still reported as `ok`.
  - **R-12, signature rate limit: decided 2026-11-14, kept at 60 per 15 minutes per IP.** Each signature now covers one file, so 60 per 15 minutes per IP means 60 images, shared by everyone behind one IP. Decision: raise it (for example to 300).
  - **R-13, clock skew: decided 2026-11-14, document only, no infrastructure change.** Claims compare timestamps written by different servers. Fine with one instance; with several, keep clocks in sync (NTP). Documented in Known Limits.
  - **R-14 fix (2026-11-15, test first).**
    - **Actual trigger:** both calls use the same `now`, so a clock passing the worker's expiry isn't enough on its own. The gap opens when a worker whose pre-delete check fails (its own claim lapsed) gives its claim back between the save's two calls. The ticket is then left with no worker claim and no save claim, and the old check let the save through.
    - **Fix:** the second call refuses the save (409 `UPLOAD_EXPIRED`) unless every ticket holds a live save claim and no live worker claim. It uses the same `leaseIsFree` rule as the cleanup. Images without a ticket are unaffected.
    - **Tests:** the regression test failed ("Missing expected rejection") before the fix and passes after it. Three more tests cover the "claim still in the future" pre-delete condition on its own, a failed delete's retry falling due only after the renewed claim expires, and renewal really extending the claim. Each was checked against a copy with its guard disabled. With the "claim still in the future" condition removed, only the new test fails, out of 31 cleanup tests.
    - **Verified 2026-11-15:** 217/217 node:test, Jest 32/32, `tsc`, production build, `npm audit --omit=dev` (0). Prettier passes with `--end-of-line auto`; a plain local check flags 7 files only because they are CRLF on Windows.
  - **Final `/code-review` (2026-11-15), after the R-14 fix: no new data-integrity defect.** Each item was checked against the code:
    - **Disproved:** "two simultaneous edits can drop an image without queuing it". Tested against Mongoose: an unchanged `images` list isn't written, and a changed list from a stale copy fails with `VersionError` (409 `CONFLICT`). A related "in-use branch doesn't recheck its claim" item depends on that path, so it remains theoretical.
    - **Fixed:** the comment above `assertImagesAllowed` said rejected files are deleted; they are queued.
    - **Accepted (low):** the R-14 check also refuses a save if a ticket for one of its images is created between its two calls (for example a removal of the same image from another product at that moment). Nothing is lost, and a retry works. Not narrowed, to keep the R-14 guarantee.
    - **Accepted (low, no code change):** `queueImageRemoval` queues tickets even when Cloudinary isn't configured, while the cleanup only runs with credentials, so removal tickets build up in such environments until credentials are added.
    - **Already documented:** clock skew between servers (R-13; a later save's `$set` can also shorten another save's claim if its clock is behind), the 409 window after a failed delete, and the `createdAt`-only claim index.
    - **Theoretical:** if a worker deletes a file and its ticket between a save's two calls, the check passes, but the save's Cloudinary lookup then answers "image not found" (400). This relies on Cloudinary's Admin API not still reporting a just-deleted file, which is unverified.
    - **Design note:** merging the save and worker claims into one lease field would remove the two-call window altogether. That would be a future refactor, not done.

**Still open:**
- **R-8:** `no-store` also stops caching of the public catalogue (a performance trade-off). **Decided 2026-11-14: keep `no-store` for now.**

## 10. Remediation status

| ID | Severity | Status |
|---|---|---|
| S-01 | Medium | Fixed 2026-11-13: regression tests, verified locally and on the dev server; committed locally in `34e2afb` (not pushed or merged) |
| S-02 | Medium | Open (needs approval for the link format change, plus frontend work) |
| S-03 | Low | Fixed 2026-11-13: regression tests, verified locally and on the dev server; committed locally in `34e2afb` (not pushed or merged) (allowlist structure, not a `..` blacklist) |
| S-04 | Low | Fixed 2026-11-13: regression tests, verified locally and on the dev server; committed locally in `34e2afb` (not pushed or merged) (policy: writes with a foreign or `null` Origin get 403; no Origin is allowed) |
| S-05 | Low | Fixed 2026-11-13: regression tests, verified locally and on the dev server; committed locally in `34e2afb` (not pushed or merged) (request and error logs) |
| S-06 | Low | Open (decision needed) |
| S-07 | Low | Fixed 2026-11-13: regression tests, verified locally and on the dev server; committed locally in `34e2afb` (not pushed or merged) (60 per 15 minutes per IP) |
| S-08 | Info | Open (decision needed) |
| S-09 | Info | Fixed 2026-11-13: regression tests, verified locally and on the dev server; committed locally in `34e2afb` (not pushed or merged) |
| F-01 | High (frontend) | Open (needs frontend approval) |
| F-02 | Medium (frontend) | Open (needs frontend approval) |
| F-03 | Medium (frontend) | Open (needs frontend approval) |
| N-01 | — | Not applicable |
| R-11 | High-ish (data integrity, admin only) | Fixed 2026-11-14: regression tests, verified locally; committed locally in `34e2afb` (not pushed or merged) (see §9a) |
| R-14 | Low likelihood, high impact (data integrity) | Fixed 2026-11-15: regression test, verified locally; committed locally in `34e2afb` (not pushed or merged) (see §9a) |
| A-01 | Low–Medium (2FA guess limit bypassed by requesting a new code; needs the password) | Implemented and tested 2026-11-15; committed locally in `e18e27a` (not pushed or merged): at most 5 guesses per account in a fixed 15-minute window (`twoFactorWindowStart`), not reset by a new code; no code is sent while the window's guesses are used up; the lock write is tied to the guessed code; 18 regression tests, verified locally. Its §11 review follow-ups were finished 2026-11-16, except item 5 (a separate test-harness task). Accepted edge behaviour is in `PROGRESS.md` Known Limits |

## 11. Production-readiness audit (2026-11-15)

A read-only audit of the whole backend at `34e2afb`, plus a `/code-review` of the branch, checked against the code. **No Critical or High backend findings.** Launch is still blocked by the open items above (F-01 to F-03, S-02, S-06, S-08) and by the operational work in `architecture.md` §8 (Production operations, Atlas checklist).

| ID | Severity | Finding | Status |
|---|---|---|---|
| A-01 | Low–Medium | 2FA guess counter reset whenever a new code was sent | Implemented, tested and committed locally in `e18e27a` (§10). Review items done 2026-11-16, except item 5 (separate task): see below |
| A-02 | Low | Requests refused by the Origin check are never logged (`app.ts`: Origin check before the request logger) | Open |
| A-03 | Low | A 500 error log can't be matched to its request (no request id) | Open |
| A-04 | Low | Delivery-date and "mark paid" updates run outside a transaction: a concurrent cancel can leave a stale history entry, and a double click logs payment twice | Open; plan ready (transactions, as status changes already use) |
| A-05 | Low | Registration reveals whether an email is taken (also whole-repo audit finding 11) | Open; decision: accept or neutral response |
| A-06 | Low | Shutdown doesn't wait for a running upload-cleanup pass | Open |
| A-07 | Low | `npm run seed:dev` only checks `NODE_ENV`, not which database it writes to | Open; plan ready (confirm the database name) |
| A-08 | Info | `GOOGLE_CLIENT_ID` is required in production even if Google sign-in isn't used | Open; depends on the Google sign-in decision |

**To verify (not confirmed defects):**
- **P-01:** Cloudinary Admin API limits for the per-image checks. This matters for a future bulk import.
- **P-02:** whether the host keeps routing requests while the API shuts down.
- **P-03:** the cleanup backlog under abuse (at most 200 tickets per run).
- **P-04:** stock held by unpaid orders. A limit of two active unpaid orders per customer is proposed and awaits the client.
- **P-05:** backups and restore.
- **P-06:** GDPR retention.
- **P-07:** CI hasn't run on `34e2afb` or `e18e27a` (both local only).

**A-01 final review (2026-11-15): items.** None of these are application defects. Items 1, 3, 4, 6 and 8 were done on 2026-11-16. Each new check was shown to fail against a broken guard, then passed again once the source was restored. Details are in `PROGRESS.md`.
1. The owner-race test should also check that the correct code cleared the count and the window. **Done.**
2. The Known Limits text overstated how the owner is alerted. **Corrected in `PROGRESS.md` on 2026-11-16.**
3. The parallel-bursts test should check the count after its first burst. **Done.**
4. The expired-code test should check the specific error, not just a 400. **Done.**
5. A stalled request in a race test can keep the test process alive. This needs request cancellation in the shared test client and a CI timeout (a separate task).
6. Optional: `{ once: true }` on the owner-race abort listener, and a corrected comment. **Done.**
7. The `PROGRESS.md` reference to R-13 didn't say where it's defined. **Corrected on 2026-11-16.**
8. One test comment is 101 characters, 1 over the width. **Done**, along with one service comment of the same width.

**Planned, not started:** 2FA API feedback (`codeSent`, `retryAfterSeconds` on login, Google login and the 2FA on/off requests). These fields are additive, but the JSON needs agreeing with the frontend developer first.
