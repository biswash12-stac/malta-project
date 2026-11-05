# Backend File Structure

```
backend/
├── src/
│   ├── app.ts                      # express app: middleware, routes, error handler
│   ├── server.ts                   # starts server, connects DB
│   ├── routes.ts                   # mounts all module routes under /api/v1
│   ├── config/
│   │   ├── env.ts                  # validated env variables (zod)
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
│   │   ├── async-handler.ts
│   │   ├── api-response.ts
│   │   ├── slugify.ts
│   │   └── money.ts
│   ├── types/
│   │   └── express.d.ts                # req.user typing
│   └── scripts/
│       └── seed-admin.ts
├── tests/                              # service-level tests (optional v1)
├── .env.example
├── eslint.config.js
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

## Suggested Packages
- Runtime: express, mongoose, zod, jsonwebtoken, bcrypt, cookie-parser, cors, helmet, express-rate-limit, multer, cloudinary, dotenv, pino (or morgan)
- Dev: typescript, tsx, eslint, prettier, @types/*
