# Development Phases

Budget and scope are agreed, so each phase has a clear deliverable. Anything outside `PRD.md` section 5 is a separate paid change request.

## Phase 0 — Setup (1–2 days)
- Collect brand name, logo, colors, product list, delivery area and fee.
- Create repos, ESLint/Prettier, env files, MongoDB Atlas, Cloudinary.
- **Deliverable:** empty frontend and backend projects running.

## Phase 1 — Design (3–4 days)
- Wireframes, then mockups for home, listing, product, cart, checkout, order status, login, admin screens (see `design.md`).
- **Deliverable:** design approved by client.

## Phase 2 — Backend foundation (3–4 days)
- Express app, config, error handling, logger, DB connection.
- User model, auth routes, JWT cookie, role middleware, admin seed.
- **Deliverable:** auth working in Postman.

## Phase 3 — Catalog (3–4 days)
- Category and Product models, CRUD, image upload, search, pagination.
- **Deliverable:** complete product API.

## Phase 4 — Orders (4–5 days)
- Order model, order number generator, checkout service with stock transaction.
- Status state machine, statusHistory, estimated delivery date, payment status, tracking endpoint.
- **Deliverable:** full order API tested.

## Phase 5 — Public frontend (5–7 days)
- Layout, home, listing, product page, cart, checkout, register, login, my orders, status timeline.
- SEO: metadata, sitemap, robots, slugs.
- **Deliverable:** customer flow works end to end.

## Phase 6 — Admin dashboard (4–5 days)
- Admin layout and guard, stats, product and category CRUD, order list/detail, status and delivery date updates.
- **Deliverable:** owner can run the store.

## Phase 7 — Testing and hardening (2–3 days)
- Manual checklist: out of stock, double submit, invalid status jump, wrong role access.
- Security and performance pass.

## Phase 8 — Deployment and handover (2 days)
- Deploy, domain, HTTPS, backups, seed real products.
- Short admin guide (PDF or video).
- **Deliverable:** live site and handover.

## Phase 9 — Future: digital payment (separate, paid)
- Choose provider, implement provider class, webhook, payment status handling, refunds, receipt email.

## Timeline
Roughly 4–6 weeks part-time. Adjust around your semester schedule.

## Tracking
| Phase | Status | Started | Finished |
|---|---|---|---|
| 0 Setup | | | |
| 1 Design | | | |
| 2 Backend foundation | Completed | 2026-11-05 | 2026-11-06 |
| 3 Catalog | Completed | 2026-11-06 | 2026-11-06 |
| 4 Orders | Completed | 2026-11-07 | 2026-11-07 |
| 5 Public frontend | In Progress | | |
| 6 Admin dashboard | In Progress | | |
| 7 Testing | | | |
| 8 Deployment | | | |
