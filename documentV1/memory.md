# Project Memory

Paste this at the start of every AI session. Update it at the end of every phase.

## Project Summary
Nepali grocery e-commerce site for a Nepali client in Malta. Customers order and pay by cash on delivery, and track order status. Admin manages products and orders.

## Related Docs
`PRD.md`, `SRS.md`, `architecture.md`, `rules.md`, `design.md`, `phases.md`, `backend-structure.md`

## Stack
- Frontend: Next.js (App Router, TypeScript)
- Backend: Express.js (TypeScript)
- Database: MongoDB + Mongoose
- Auth: JWT in httpOnly cookie
- Validation: zod
- Images: Cloudinary

## Key Decisions
- COD only in v1; payment provider interface prepared for digital payment later.
- Money stored as integer cents, currency EUR.
- Orders store snapshots of product name and price.
- Strict order status state machine; every change logged in statusHistory.
- Products are soft-deleted.
- Admin created by seed script only.
- Login cookie is `SameSite=Lax`; site and API share one parent domain.
- Budget and scope agreed and frozen; new features are change requests.

## Enums
- Order status: `pending`, `confirmed`, `packed`, `out_for_delivery`, `delivered`, `cancelled`
- Payment method: `COD` (CARD later)
- Payment status: `pending`, `paid`, `failed`, `refunded`
- Roles: `customer`, `admin`

## Current Status
- Current phase: Phase 4 (orders), on `feature/orders`.
- Done: Phase 2 (backend foundation, user model, auth routes, JWT cookie, role middleware, admin seed, automated auth tests) and Phase 3 (category and product APIs, indexes, `validateRequest`, signed Cloudinary uploads), merged in PRs #5, #6 and #7.
- Auth upgrade (access and refresh tokens, password reset, email 2FA, Google login) is merged in PR #7. Real email and Google sign-in still need the developer's accounts and a live test.
- Phase 4 order API is built with automated tests on `feature/orders`, and checkout was tested in Postman on Atlas. `GET /admin/stats` (FR-18) waits for Phase 6.
- Next: merge the Phase 4 PR, and test real password reset and 2FA emails. Remaining whole-repo audit findings are in `backend/PROGRESS.md`. Security audit code fixes are done; separating production secrets is a launch task (see `backend/PROGRESS.md`).
- Blocked: backend ESLint (no TypeScript 7 support yet). Frontend coding needs written design approval (Phase 1), and no approval is recorded yet.

## Open Questions for Client
- Who provides product photos and descriptions? (The developer will seed 100 placeholder products; the client updates images in the admin dashboard.)

## Change Log
| Date | Change | Reason |
|---|---|---|
| 2026-11-06 | Use envalid (not zod) for env, bcryptjs (not bcrypt) | Already in the code; envalid suits env checks, bcryptjs needs no native build |
| 2026-11-06 | Removed `async-handler.ts` | Express 5 handles async errors itself |
| 2026-11-06 | Backend has no ESLint for now | `typescript-eslint` does not support TypeScript 7 |
| 2026-11-06 | Site and API must share a parent domain | Next.js middleware can't otherwise read the login cookie |
| 2026-11-06 | Tests use in-memory MongoDB | Tests never touch a real database |
| 2026-11-06 | Products get nameEn + nameNp, offerPrice and an admin-set shopRating | Backend developer's decision; no customer review system in v1 |
| 2026-11-06 | Signed direct uploads to Cloudinary, replacing the Multer plan | Secret stays on the server; files never pass through the API; no extra packages |
| 2026-11-06 | Auth upgrade: access and refresh tokens, password reset, email 2FA, Google login | Backend developer's decision, outside the frozen PRD section 5; tell the client if it's a paid change |
| 2026-11-06 | 2FA login uses a pending httpOnly cookie, not `userId`; reset token goes in the body, not the URL | Hides internal IDs; request logs record URLs |
| 2026-11-06 | Google sign-in removes the password and sessions of an unverified customer account | Stops takeover by someone who registered the victim's email first |
| 2026-11-06 | Added general and per-account rate limits; common passwords rejected; JSON bodies only; `NODE_ENV` required | Security audit fixes |
| 2026-11-06 | Added `tokenVersion`; logout ends sessions on every device | Stolen tokens can now be cancelled |
| 2026-11-06 | Admin seed refuses customer emails and passwords under 12 characters | Stops an attacker gaining admin by registering the owner's email first |
| 2026-11-06 | `TRUST_PROXY_HOPS` is required in production | A wrong fixed value let clients fake their IP and dodge rate limits |
| 2026-11-06 | `averageRating` renamed `shopRating` | "Average" implies customer reviews, which could mislead under EU consumer rules |
| 2026-11-06 | Offers store `priorLowestPrice` from a 30-day price history | EU Omnibus Directive: reductions must reference the lowest recent price |
| 2026-11-06 | Product slugs don't change on rename | Keeps bookmarks and Google links working |
| 2026-11-06 | Hiding a category hides its products publicly | Customers shouldn't reach products from a hidden category; product records stay unchanged |
| 2026-11-06 | Category slug follows its name | Keeps names unique through the slug's index |
| 2026-11-06 | Product images store `{url, publicId}` | Cloudinary needs the id to delete replaced images |
| 2026-11-06 | Register takes username, email, password; no phone on the account | Simpler signup; phone is still collected per order at checkout (FR-9) |
| 2026-11-07 | Ordering requires login; `Order.user` is required; no guest tracking | Developer's decision for v1, replacing the optional guest flow |
| 2026-11-07 | €20.00 minimum order; €5.00 delivery below €30.00, free from €30.00; all of Malta, any locality | Client's final business rules |
| 2026-11-07 | Order items also store `unitSnapshot` | The name and price alone don't say what size was bought, and `unit` can change later |
| 2026-11-07 | Checkout limited to 10 placed orders per 15 minutes per IP | Unpaid orders hold back stock, so this limits deliberate draining |

## Working Rules Reminder
Follow `rules.md`. Do not add features outside `PRD.md`. Keep controllers thin and services smart.
