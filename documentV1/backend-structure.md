# Backend File Structure

```
backend/
├── src/
│   ├── app.ts                      # express app: middleware, routes, error handler
│   ├── server.ts                   # starts server, connects DB
│   ├── routes.ts                   # mounts all module routes under /api/v1
│   ├── config/
│   │   ├── env.ts                  # validated env variables (envalid)
│   │   ├── db.ts                   # mongoose connection
│   │   └── cloudinary.ts
│   ├── modules/
│   │   ├── auth/
│   │   │   ├── auth.routes.ts
│   │   │   ├── auth.controller.ts
│   │   │   ├── auth.service.ts
│   │   │   └── auth.schema.ts      # zod schemas
│   │   ├── users/
│   │   │   ├── user.model.ts
│   │   │   └── user.service.ts
│   │   ├── categories/
│   │   │   ├── category.model.ts
│   │   │   ├── category.routes.ts
│   │   │   ├── category.controller.ts
│   │   │   ├── category.service.ts
│   │   │   └── category.schema.ts
│   │   ├── products/
│   │   │   ├── product.model.ts
│   │   │   ├── product.routes.ts
│   │   │   ├── product.controller.ts
│   │   │   ├── product.service.ts
│   │   │   └── product.schema.ts
│   │   ├── orders/
│   │   │   ├── order.model.ts
│   │   │   ├── order.routes.ts         # customer routes
│   │   │   ├── order.admin.routes.ts   # admin routes
│   │   │   ├── order.controller.ts
│   │   │   ├── order.service.ts        # checkout, stock, status changes
│   │   │   ├── order.status.ts         # allowed transitions
│   │   │   ├── order-number.ts         # order number generator
│   │   │   └── order.schema.ts
│   │   ├── payments/
│   │   │   ├── payment.types.ts        # PaymentProvider interface
│   │   │   ├── cod.provider.ts
│   │   │   └── payment.registry.ts     # method → provider (Stripe added later)
│   │   ├── admin/
│   │   │   ├── stats.controller.ts
│   │   │   └── stats.service.ts
│   │   └── uploads/
│   │       ├── upload.routes.ts
│   │       └── upload.service.ts
│   ├── middlewares/
│   │   ├── auth.middleware.ts          # verify JWT
│   │   ├── role.middleware.ts          # requireRole('admin')
│   │   ├── validate.middleware.ts      # zod validation
│   │   ├── rate-limit.middleware.ts
│   │   ├── upload.middleware.ts        # multer
│   │   └── error.middleware.ts         # global error handler
│   ├── utils/
│   │   ├── app-error.ts
│   │   ├── api-response.ts
│   │   ├── logger.ts
│   │   ├── slugify.ts
│   │   └── money.ts
│   ├── types/
│   │   └── express.d.ts                # req.user typing
│   └── scripts/
│       └── seed-admin.ts
├── tests/                              # API tests on in-memory MongoDB (npm test)
├── .env.example
├── .prettierrc
├── tsconfig.json
├── package.json
└── README.md
```

## Why This Structure
- **Module-based:** everything for orders lives in one folder, so features are easy to find and change.
- **`payments/` is separate:** adding Stripe later means one new file and one registry line.
- **`order.status.ts`:** transition rules live in one place and are easy to test.
- **`middlewares/` and `utils/`:** generic, reusable, no business logic.

## Request Flow Example (place order)
`POST /api/v1/orders` → `order.routes` (auth + validate) → `order.controller` → `order.service` (check stock, compute totals, create order, decrement stock, call payment provider) → `order.model` → response via `api-response`.

## Express 5 Notes
- Async handlers need no wrapper: Express 5 passes rejected promises to the error middleware.
- `req.query` is read-only, so validated queries can't be assigned back to it. Decide how to pass them to handlers when query validation is added in Phase 3.

## Packages
- Runtime: express, mongoose, zod, envalid, jsonwebtoken, bcryptjs, cookie-parser, cors, helmet, express-rate-limit, dotenv, pino, pino-http. Add multer and cloudinary in Phase 3.
- Dev: typescript, tsx, prettier, mongodb-memory-server, @types/*
- ESLint is not on the backend yet: `typescript-eslint` requires TypeScript below 6.1 and the backend uses TypeScript 7. Add it when support ships. Until then, `tsc` strict mode and its unused-code checks do part of that job.
