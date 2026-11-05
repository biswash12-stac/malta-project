# Design — UI/UX Guide

## 1. Design Direction
- Feel: warm, trustworthy, clean; a familiar Nepali grocery vibe without clutter.
- Mobile-first (most customers will order from phones).
- Fast and simple: fewest possible steps from home to order placed.

## 2. Style Tokens (starting point, confirm with client)
| Token | Suggestion |
|---|---|
| Primary | Deep red (e.g. #B42318) — Nepali flag / spice feel |
| Secondary | Warm saffron/yellow (e.g. #F5A524) |
| Neutral | Off-white background (#FAF7F2), dark text (#1F1B16) |
| Success / Warning / Error | Green / amber / red for status badges |
| Font | One clean sans-serif (e.g. Inter or Poppins) |
| Radius | 8–12px cards, 8px buttons |
| Spacing | 4/8/16/24/32 scale |

## 3. Pages and Layout

### Public
- **Home**: header (logo, search, cart, login) → hero banner → category chips → featured products grid → "How ordering works" (3 steps: choose, we deliver, pay cash) → footer (contact, delivery info).
- **Products**: sidebar/top filter by category, search bar, product grid (2 cols mobile, 4 desktop), pagination.
- **Product detail**: image gallery, name, price/unit, stock state, quantity selector, add to cart, description.
- **Cart**: item list, quantity edit, subtotal, delivery fee, total, checkout button.
- **Checkout**: delivery form + order summary + "Cash on Delivery" selected (digital option greyed/hidden for now).
- **Order success**: order number, summary, estimated delivery, link to track.
- **Order status**: status timeline (stepper), estimated delivery date, items, delivery details.
- **Login / Register**: simple single-column forms.

### Admin
- **Layout**: left sidebar (Dashboard, Orders, Products, Categories), top bar with logout.
- **Dashboard**: cards (orders today, pending, revenue) + recent orders table.
- **Orders**: table with filters (status, date), search; row opens detail.
- **Order detail**: items, customer info, status dropdown (only valid next statuses), delivery date picker, "mark paid" action, history log.
- **Products**: table + create/edit form with image upload.
- **Categories**: simple list with add/edit.

## 4. Core Components
Button, Input, Select, Badge (order status colors), ProductCard, CartItem, StatusTimeline, DataTable, Modal/ConfirmDialog, Toast, EmptyState, Skeleton loaders, Pagination.

## 5. Status Badge Colors
| Status | Color |
|---|---|
| pending | grey |
| confirmed | blue |
| packed | purple |
| out_for_delivery | amber |
| delivered | green |
| cancelled | red |

## 6. UX Rules
- Every form shows inline validation errors.
- Every async action has loading and error states.
- Empty states have a helpful message and action.
- Buttons disabled during submit (prevents double orders).
- Accessible: labels, contrast, keyboard focus, alt text.
- Touch targets at least 44px.

## 7. Deliverables
Wireframes (paper or Figma) for each page above, then 1 approved visual mockup for home, product, checkout, order status and admin orders before coding.
