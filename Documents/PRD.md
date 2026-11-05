# PRD — Nepali Grocery E-commerce

Version 1.0 · Stack: Next.js + Express.js + MongoDB · Payment: COD now, digital later

## 1. Overview
An online store where Nepali people living in Malta can order Nepali groceries and pay by cash on delivery (COD). The owner manages products and orders from an admin dashboard.

## 2. Goals
- Customers can browse, register, order and track an order with no payment friction.
- The owner can manage products and orders without technical help.
- The system is built so digital payment can be added later without rewriting orders.

## 3. Non-goals (v1)
Online payment, coupons, reviews, multi-vendor, mobile app, multi-language, loyalty points, live courier GPS.

## 4. Users
| User | Can do |
|---|---|
| Customer | Browse, register/login, place COD orders, check order status |
| Admin (owner) | Manage products, categories, orders, order status, delivery estimates |

## 5. Features (v1 scope — frozen)
1. Home page: hero, featured products, categories, how-ordering-works.
2. Product listing: category filter, search, pagination.
3. Product detail page.
4. Cart and checkout (name, phone, address, note) with COD.
5. Registration and login (customer); admin login.
6. My Orders and order status page: status timeline + estimated delivery date.
7. Admin dashboard: product CRUD, category CRUD, order list/detail, status update, set estimated delivery date.
8. SEO basics: meta tags, clean slugs, sitemap, Open Graph.

## 6. Future features (design for, do not build)
Digital payment (Stripe or similar), email/SMS notifications, coupons, stock alerts, reviews.

## 7. Success metrics
- Order placed in under 2 minutes.
- Admin updates an order in under 30 seconds.
- Pages load under 3 seconds on mobile.

## 8. Risks
- Scope creep: budget is fixed, so anything outside section 5 is a paid change request.
- Non-technical client: confirm design direction early with mockups.
- Delivery estimate is manual: admin must keep it updated.

## 9. Open questions
- Delivery fee and delivery areas in Malta?
- Guest checkout allowed, or login required?
- Minimum order amount?
- Who provides product photos and descriptions?
