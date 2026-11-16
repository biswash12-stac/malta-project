# Backend

Express 5 + TypeScript + MongoDB API for the Nepali grocery store. Project docs are in `../documentV1`.

## Setup

```bash
npm install
cp .env.example .env   # then fill in MONGODB_URI and JWT_SECRET
npm run dev            # http://localhost:4000/api/v1/health
```

## Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Runs the server and restarts on changes |
| `npm run build` / `npm start` | Compiles to `dist/` and runs it |
| `npm test` | Runs tests on a temporary in-memory MongoDB (downloads it on first run); never touches `.env`'s database |
| `npm run test:jest` | Runs the Jest and Supertest tests in `tests/jest/`, also on in-memory MongoDB, with `.env`'s database, email and Cloudinary values blanked |
| `npm run format` | Formats with Prettier |
| `npm run seed:admin` | Creates the admin, or resets their password. Needs the `ADMIN_*` values from `.env.example` |
| `npm run seed:dev` | Development only. Inserts 14 categories and 100 placeholder products into the database in `MONGODB_URI`. Safe to re-run: it only inserts what's missing (matched by slug), never updates or deletes, and refuses to run when `NODE_ENV=production`. Prints a summary and exits with code 1 if anything failed |
| `npm run cleanup:uploads` | Runs the abandoned-upload cleanup once. The API already runs it hourly. Deletes only files the server signed that no product saved within 24 hours |

In production, where `tsx` isn't installed, seed with `node dist/scripts/seed-admin.js`.

## Development seed data

- `npm run seed:dev` fills an empty development database so the catalogue, cart, checkout and admin can be tested. The data is in `src/scripts/dev-catalog/catalog-data.ts`.
- **Repeating it:** it matches products by slug and categories by slug, inserts only what's missing, and never touches anything else. So it can't overwrite real products, orders or users.
- **Images:** the products have none. The validator only accepts real images in this store's Cloudinary account, and the frontend shows a placeholder.
- **Not real inventory:** prices, stock and descriptions are placeholders. Alcohol and energy drinks need a Malta legal review before anything is sold.
- **Removing it:** delete the seeded products from the admin later. The seed has no delete mode on purpose.

The full API contract is in `API.md`.

## Auth API (`/api/v1/auth`)

| Route | Notes |
| --- | --- |
| `POST /register` | `username`, `email`, `password` (8+ characters). Sets the login cookies |
| `POST /login` | `email`, `password`. Sets the login cookies, or returns `{ requires2FA: true }` |
| `POST /google` | `credential` from Google's sign-in button. Same result as login |
| `POST /refresh` | Replaces the access and refresh cookies |
| `POST /logout` | Clears the cookies and ends the user's sessions on every device |
| `GET /me` | Returns the logged-in user, or 401 |
| `POST /forgot-password` | `email`. Always returns 200 |
| `POST /reset-password` | `token`, `password`. Ends all sessions |
| `POST /2fa/enable`, `POST /2fa/verify` | Emails a code, then `code` turns 2FA on (needs login) |
| `POST /2fa/validate` | `code`. Finishes a login that returned `requires2FA` |
| `POST /2fa/disable/request`, `POST /2fa/disable` | Emails a code, then `code` turns 2FA off (needs login) |

Sessions use two httpOnly cookies: `access_token` (15 minutes) and `refresh_token` (7 days, sent only to auth routes). Tokens never appear in response bodies.

## Production settings

Set `NODE_ENV=production`, which turns on Secure cookies and makes `CLIENT_URL`, `TRUST_PROXY_HOPS`, `TWO_FACTOR_SECRET`, `GOOGLE_CLIENT_ID` and the `SMTP_*`, `MAIL_FROM` and `CLOUDINARY_*` settings required. Host the site and API on one parent domain, such as `shop.com` and `api.shop.com`, and set `COOKIE_DOMAIN=.shop.com`. `architecture.md` section 4 explains why.
