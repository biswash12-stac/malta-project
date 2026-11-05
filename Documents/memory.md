# Project Memory

Keep this in the repo root. Paste it at the start of every AI session. Update it at the end of every phase.

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
- Budget and scope agreed and frozen; new features are change requests.

## Enums
- Order status: `pending`, `confirmed`, `packed`, `out_for_delivery`, `delivered`, `cancelled`
- Payment method: `COD` (CARD later)
- Payment status: `pending`, `paid`, `failed`, `refunded`
- Roles: `customer`, `admin`

## Current Status
- Current phase: (update)
- Done: (update)
- In progress: (update)
- Blocked: (update)

## Open Questions for Client
- Delivery fee and delivery areas in Malta?
- Guest checkout allowed, or login required?
- Minimum order amount?
- Who provides product photos and descriptions?

## Change Log
| Date | Change | Reason |
|---|---|---|
| | | |

## Working Rules Reminder
Follow `rules.md`. Do not add features outside `PRD.md`. Keep controllers thin and services smart.
