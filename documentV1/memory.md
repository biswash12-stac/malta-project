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
- Current phase: Phase 2 code complete; register and login checked in Postman; `/me`, logout and the PR still to do.
- Done: backend foundation, user model, auth routes, JWT cookie, role middleware, admin seed, automated auth tests.
- In progress: nothing.
- Next: Phase 3 (catalog API).
- Blocked: backend ESLint (no TypeScript 7 support yet). Frontend coding needs written design approval (Phase 1), and no approval is recorded yet.

## Open Questions for Client
- Delivery fee and delivery areas in Malta?
- Guest checkout allowed, or login required?
- Minimum order amount?
- Who provides product photos and descriptions?

## Change Log
| Date | Change | Reason |
|---|---|---|
| 2026-11-06 | Use envalid (not zod) for env, bcryptjs (not bcrypt) | Already in the code; envalid suits env checks, bcryptjs needs no native build |
| 2026-11-06 | Removed `async-handler.ts` | Express 5 handles async errors itself |
| 2026-11-06 | Backend has no ESLint for now | `typescript-eslint` does not support TypeScript 7 |
| 2026-11-06 | Site and API must share a parent domain | Next.js middleware can't otherwise read the login cookie |
| 2026-11-06 | Tests use in-memory MongoDB | Tests never touch a real database |
| 2026-11-06 | Register takes username, email, password; no phone on the account | Simpler signup; phone is still collected per order at checkout (FR-9) |

## Working Rules Reminder
Follow `rules.md`. Do not add features outside `PRD.md`. Keep controllers thin and services smart.
