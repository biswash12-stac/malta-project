# Security Implementation Plan

Date: 2026-11-13. It's based on `SECURITY_AUDIT.md` (findings S-01 to S-09, F-01 to F-03, N-01). Each phase needs your approval. **Status (2026-11-14):** S-01, S-03, S-04, S-05, S-07, S-09 and the tampering suite are implemented and tested, but not committed. S-02, S-06, S-08, F-01, F-02 and F-03 are still open. `SECURITY_AUDIT.md` §10 is the current record.

## How each change is made

- **Test first** (the `tdd` skill): one finding at a time. Write a regression test that fails for the stated reason, then the smallest fix, then run the whole suite.
- **Verify before claiming** (`superpowers:verification-before-completion`). After each phase, run and read:
  - `npm test`, `npm run test:jest`, `npx tsc --noEmit`, `npx prettier --check src tests`
  - plus, for frontend phases, `npm run lint` and `npm run build`.
- **Review:** after each phase, run `/code-review` on the diff. A finding is only marked fixed once its test passes and the review is clean.
- **Guardrails:**
  - no new dependencies, and no response-shape changes except those listed
  - no frontend edits without explicit permission
  - no commits, pushes or merges without approval
  - keep `backend/PROGRESS.md`, `backend/API.md` and `SECURITY_AUDIT.md` (§10) up to date.
- **Tools:** Context7 isn't installed. The installed package versions and the code are the reference.

## Priority rules

The priority follows actual exploitability and impact.
- **No backend finding is Critical or High,** so P0 is the one High issue, F-01, which harms real users as soon as anyone registers.
- **P0 is blocked on your frontend approval.** The backend phases (P1, P2) don't depend on it and can go first.

| Phase | Findings | Owner | Blocked by |
|---|---|---|---|
| P0 | F-01, F-02 (frontend auth integration) | Frontend (with permission) | Your frontend approval |
| P1 | S-01, S-03, S-05, then S-02 | Backend; S-02 is coordinated with the frontend | S-02 needs approval of the link format |
| P2 | S-04, S-07, S-09, F-03, the tampering test suite | Backend; F-03 is frontend | F-03 needs frontend approval |
| P3 | S-06, S-08 decisions; `npm audit` in CI; monitoring; production checklist; shared rate-limit store when scaling | Backend and deployment | Business decisions; hosting choice |

---

## P0: Remove credential storage and fake auth from the frontend (F-01, F-02)

**Why first:** this is the only High finding. Once real people register, their passwords would be readable in the browser.

**Work** (frontend; the files and reasons are listed in the pending frontend proposal):
1. `services/api.ts`: one client with `credentials: "include"` and the standard error format. On a 401, refresh once and retry. It **never returns or stores a token**, because cookies are httpOnly and invisible to JavaScript.
2. `context/AuthContext.tsx`, `hooks/useAuth.ts`:
   - session state from `GET /auth/me` only
   - login, register, logout and the 2FA step through the API
   - delete `DEMO_ACCOUNTS` and every `localStorage` write of a user, password or role.
3. `app/admin/layout.tsx`: guard with `/auth/me` and `role === "admin"`. This only controls the UI; the backend stays the authority.
4. Login, register and forgot-password pages call the API.

**Acceptance criteria:**
- No `localStorage` or `sessionStorage` key contains a password, token or role. No JavaScript variable or API client return value contains a token.
- Setting `role: "admin"` in browser storage changes nothing, in the UI or the API.
- A customer opening `/admin` is redirected, and every admin API still returns 403.
- The backend suites still pass.

**Verification:**
- Frontend `npm run lint` and `npm run build`.
- Manually in DevTools: Application → Local Storage and Cookies. Auth cookies show as `HttpOnly`, and `document.cookie` doesn't include them.
- A browser smoke test of login, logout and refresh.
- The backend `auth`, `auth-tokens` and `sessions` suites.

**Risks:** the account and settings forms lose their fake profile editing and password change; the backend has no endpoint for them yet (gap-analysis Q3 and Q4).

---

## P1: Backend fixes for real exposure (S-01, S-03, S-05, then S-02)

Work in this order, one test-first slice each.

### P1.1 S-01: `Cache-Control: no-store`
- **Change:** a small middleware in `backend/src/app.ts` that sets `Cache-Control: no-store` on every `/api/v1` response, before the router.
- **Test first** (Jest, `tests/jest/app.test.ts`): `/api/v1/health`, `/api/v1/no-such-route` and a 401 from `/auth/me` all have `cache-control: no-store`. The node:test suite also checks it on a logged-in `/auth/me`.
- **Acceptance:** every API response, including errors, carries `no-store`.

### P1.2 S-03: reject `..`, `.` and empty segments in image IDs
- **Change:** `backend/src/modules/products/product.schema.ts:13-15`. Tighten the `publicId` pattern to segments of `[\w-]` with dots allowed only inside a segment, and never `.` or `..` as a whole segment.
- **Test first** (`tests/uploads.test.ts`):
  - products with `products/../x`, `products/./x` and `products//x` get a 400
  - a ticketed `products/<uuid>` and the existing test IDs still pass.
- **Acceptance:** the scratch-script repro from the audit is rejected.

### P1.3 S-05: no query strings in request logs
- **Change:** `backend/src/app.ts:50-52`: log `req.path` (the URL without its query) instead of `req.url`, keeping the health-check skip.
- **Test first:** capture the pino-http output (a test logger stream) for `/api/v1/admin/orders?q=79123456`, and assert the line has no `79123456`.
- **Acceptance:** request logs show the path, method and status only.

### P1.4 S-02: password reset link in the URL fragment (coordinated, breaking)
- **Needs:** your approval of the new link format, and frontend permission for a new `app/(auth)/reset-password/page.tsx`.
- **Backend change:** `backend/src/modules/auth/password-reset.service.ts:26` emails `${CLIENT_URL}/reset-password#token=<token>`. The API (`POST /auth/reset-password`, token in the body) doesn't change.
- **Frontend change:** the reset page:
  - reads `location.hash`
  - calls `history.replaceState(null, "", location.pathname)` straight away
  - posts `{ token, password }`
  - sends `Referrer-Policy: no-referrer`
  - shows a clear message for an expired or used link.
- **Test first:** the reset email contains `/reset-password#token=` and no `?token=`. This updates the existing `password-reset.test.ts` assertion.
- **Acceptance:**
  - the reset flow works end to end in a browser
  - after loading, the address bar and history show no token
  - links already sent stop working, which is acceptable because they expire within 30 minutes.
- **Rollout:** release the backend and frontend changes together. If only the backend ships, reset links open a page that doesn't exist.

**P1 verification:**
- `npm test`, `npm run test:jest`, `tsc` and Prettier all pass, with new test counts recorded.
- Manually, `curl -i` an API route and check the `Cache-Control` header.
- `/code-review` on the P1 diff.

---

## P2: Defence in depth (S-04, S-07, S-09, F-03, tampering suite)

### P2.1 S-04: `Origin` check on state-changing requests
- **Change:** a new `backend/src/middlewares/origin.middleware.ts`, mounted in `app.ts` before the router.
  - For `POST`, `PUT`, `PATCH` and `DELETE`: if `Origin` is present and isn't `CLIENT_URL`, respond 403 `FORBIDDEN`.
  - A missing `Origin` is allowed, for curl and server-to-server calls; browsers always send it on these requests.
- **Test first** (Jest):
  - `POST /auth/logout` with `Origin: https://evil.example` gets a 403
  - with `Origin: <CLIENT_URL>` or no `Origin`, it works
  - `GET /products` with a foreign `Origin` still gets a 200.
- **Acceptance:** all existing suites still pass. They send no `Origin`, or the test `CLIENT_URL`.
- **Risk:** a wrong `CLIENT_URL` in production blocks writes. Note it in the deployment checklist.

### P2.2 S-07: rate limit on upload signatures
- **Change:** `uploadSignatureRateLimit` (60 per 15 minutes per IP) in `rate-limit.middleware.ts`, applied in `upload.routes.ts:10`.
- **Test first:** request 61 gets a 429 `RATE_LIMITED`.

### P2.3 S-09: `/health` without uptime (optional)
- **Change:** `routes.ts:19-21` returns `{ status: "ok" }`.
- **Test:** update the Jest health test so the body equals `{ success: true, data: { status: "ok" } }`.
- **Contract:** update `backend/API.md` (small response change).

### P2.4 F-03: frontend CSP (needs frontend permission)
- **Change:** apply the tested `headers()` block from `FRONTEND_PROGRESS.md` to `frontend/next.config.ts`.
- **Acceptance:** the headers are present in `next build && next start`, and there are no CSP errors in the browser console on the home page, products, product page, cart, checkout, login or the admin product form.

### P2.5 Tampering regression suite
- **Change:** `backend/tests/jest/tampering.test.ts`, using `startTestDb`. One place documenting that the frontend can't bypass the backend:
  - **forged role:** register with `role: "admin"`, then call `/admin/stats`, which gets a 403
  - **edited cookie:** a hand-edited or unsigned `access_token` gets a 401
  - **client values:** prices, fees and totals sent on checkout get a 400. This needs MongoDB transactions, so this case stays in `orders.test.ts`; the Jest file references it.
  - **ownership:** another user's order ID gets a 404
  - **admin routes:** each one called as a customer gets a 403
  - **no token leaks:** no auth response body contains a JWT-shaped string.
- **Acceptance:** the suite passes and lists each threat from the audit's threat model.

**P2 verification:** the full suites, frontend lint and build for F-03, and `/code-review`.

---

## P3: Decisions, automation and operations

| Item | Work | Acceptance |
|---|---|---|
| S-06 | Per your decision: keep the development email logging (document it), or log only `to` and `subject` | A test shows no reset token in the development log line, if you choose to remove it |
| S-08 | Per your decision (gap-analysis Q7): exact stock, or `inStock`/`lowStock` publicly | `API.md` and the tests updated if it changes |
| `npm audit` in CI | Add `npm audit --omit=dev --audit-level=high` to both CI jobs | CI fails on new high or critical advisories |
| Monitoring | Alert on `"Upload cleanup finished"` with `status: "partial"`, unusual counts of 401/403/429 errors, and `Unhandled error` logs (hosting log alerts) | Alerts configured on the chosen host |
| Shared rate-limit store | Only when running more than one instance: a shared store for `express-rate-limit`. **This needs a new dependency, so ask first** | Limits apply across instances |
| Production checklist | Fill in `architecture.md` §8: HTTPS, `CLIENT_URL`, `COOKIE_DOMAIN`, `TRUST_PROXY_HOPS`, secrets, Atlas, Cloudinary | Checked off at deployment |

---

## Implementation order

1. **P1.1 S-01**, **P1.2 S-03**, **P1.3 S-05**: backend only, safe, no decisions needed.
2. **P2.1 S-04**, **P2.2 S-07**, **P2.5 tampering suite**: backend only. **P2.3 S-09** if you want it.
3. **P0 F-01, F-02** and **P1.4 S-02**: once you approve the frontend work and the reset link format. The S-02 backend and frontend changes ship together.
4. **P2.4 F-03**: with or after the frontend integration.
5. **P3**: after your decisions on S-06 and S-08, and when the hosting choice is known.

## Decisions needed

| # | Decision | Affects |
|---|---|---|
| D1 | Approve backend P1.1 to P1.3 and P2.1, P2.2 and P2.5 (and P2.3) | Start of implementation |
| D2 | Approve the password reset link format change to `#token=` (breaking for links already sent) | S-02 |
| D3 | Frontend permission for the auth integration (P0), the new reset page (S-02) and the CSP (F-03) | F-01, F-02, F-03, S-02 |
| D4 | Development email logging: keep or remove | S-06 |
| D5 | Exact stock publicly, or in-stock and low-stock flags only | S-08 |
