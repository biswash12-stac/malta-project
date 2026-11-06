# Engineering Rules

## 1. General
1. TypeScript strict mode on frontend and backend.
2. One responsibility per file; keep files under ~200 lines.
3. No business logic in controllers or components.
4. Never trust the client: recompute price, stock and totals on the server.
5. Validate every body, query and param with zod.
6. Money is always integer cents.
7. No secrets in git; use `.env` and commit `.env.example`.

## 2. Naming and Style
- Files: kebab-case (`order.service.ts`). React components: PascalCase.
- Variables and DB fields: camelCase.
- ESLint + Prettier enforced (backend: Prettier only for now, see `backend-structure.md`).

## 3. API Rules
- Plural REST nouns, versioned: `/api/v1/...`.
- Status codes: 201 create, 400 validation, 401 unauthenticated, 403 forbidden, 404 not found, 409 conflict, 413 body too large, 429 rate limited.
- One response envelope; errors thrown as `AppError` and handled by one global middleware.
- Every list endpoint is paginated (page, limit, max 50).

## 4. Security Rules
- Hash passwords (bcrypt); never return `passwordHash`.
- Rate-limit login/register; use helmet; CORS whitelist only.
- Sanitize inputs.
- Soft-delete products that appear in orders.
- Admin is created only by seed script.

## 5. Git Rules
- Branches: `main` (stable), `dev`, `feature/<name>`.
- Conventional commits: `feat:`, `fix:`, `chore:`, `docs:`.
- One feature per PR, even when working solo.
- Tag a release at the end of each phase.

## 6. Definition of Done
- Feature works end to end.
- Input validated, error cases handled.
- Tested manually, plus an automated test for security, money, stock and status rules (`npm test`).
- No console errors.
- `memory.md` updated.

## 7. Client Rules
- Scope is frozen in `PRD.md`; anything new is a change request.
- Share a demo link at the end of each phase.
- Get written approval of design before building the frontend.
