# QRFast — QR-Based Restaurant Dine-In Ordering System

A production-ready QR dine-in ordering platform built with Next.js 15, Supabase, Prisma, and Razorpay. Customers scan a table QR code to browse the menu, customize orders, pay online or at the counter, and track orders in real time. Restaurant staff manage everything from admin, kitchen, and cashier dashboards.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 15, React 19, TypeScript, Tailwind CSS, shadcn/ui |
| State | Zustand (cart), TanStack Query (server data) |
| Backend | Next.js Server Actions & Route Handlers |
| Auth | Supabase Auth (email/password) |
| Database | Supabase PostgreSQL + Prisma ORM |
| Payments | Razorpay (UPI, cards, net banking) |
| Email | Resend (free tier) |
| Charts | Recharts |
| Animations | Framer Motion |
| Forms | React Hook Form + Zod |
| QR | qrcode package |
| Deployment | Vercel + Supabase (free tiers) |
| Notifications | Sonner |

## Features

### Customer
- Scan table QR → menu opens in browser, no app needed
- Browse categories, search, veg/non-veg filters, sorting
- Item customization: variants (sizes), add-ons, special instructions
- Persistent cart with quantity controls, coupon codes
- GST & service charge auto-calculated
- Razorpay online payment OR pay-at-counter
- Live order tracking with status timeline
- Post-meal ratings & reviews

### Admin Dashboard
- Analytics: today's revenue, orders, pending/completed counts, popular items
- 7-day sales chart with Recharts
- Menu CRUD: categories, items, variants, add-ons, availability toggle
- **Image uploads**: Drag-drop image uploads to Supabase Storage (see [SUPABASE_STORAGE_SETUP.md](./SUPABASE_STORAGE_SETUP.md))
- Table management: create, delete, generate QR codes (downloadable)
- Coupon engine: percentage/flat discounts, expiry, usage limits
- Order management: status flow, payment updates
- Settings: restaurant info, GST %, service charge, currency, theme color

### Kitchen Display
- Kanban board: New → Confirmed → Preparing → Ready
- Auto-refresh every 8 seconds
- Sound alert on new order
- Order timers and item notes visible
- One-tap status progression

### Cashier Desk
- Pending payments tab: mark as paid, complete orders
- Completed payments history table
- Works for both Razorpay (already paid) and cash payments

## Getting Started

### 1. Clone & Install

```bash
git clone <repo-url>
cd hotel
npm install
```

### 2. Environment Variables

Copy the example env file and fill in your credentials:

```bash
cp .env.example .env.local
```

**Required variables:**

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | Supabase PostgreSQL connection string |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anonymous key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (server-side staff account creation and image uploads; never expose publicly) |
| `NEXT_PUBLIC_APP_URL` | Your app URL (`http://localhost:3000` for dev) |
| `RAZORPAY_KEY_ID` | Razorpay API key |
| `RAZORPAY_KEY_SECRET` | Razorpay API secret |
| `NEXT_PUBLIC_RAZORPAY_KEY_ID` | Razorpay publishable key (same as key ID) |

**Optional variables:**

| Variable | Description |
|----------|-------------|
| `RAZORPAY_WEBHOOK_SECRET` | Webhook secret for payment events |
| `RESEND_API_KEY` | Resend API key for email receipts |
| `RESEND_FROM_EMAIL` | Sender email for receipts |

### 3. Database Setup

```bash
# Push schema to Supabase
npx prisma db push

# Seed demo data ("The Bistro" with menu, tables, orders)
npx prisma db seed
```

### 4. Supabase Auth Setup

1. Create a Supabase project (free tier)
2. Enable Email auth in Authentication → Sign In / Providers → Email.
3. To disable confirmation for any Supabase-managed email signup, turn off **Confirm email** in the Email provider settings. Accounts created by QRFast's initial-admin and staff flows are created as confirmed users.
4. In Supabase, open **Project Settings → API Keys** and copy the server-only `service_role` key (legacy) or create a Supabase secret key. Add it as `SUPABASE_SERVICE_ROLE_KEY` in `.env.local` and Vercel. Never use the publishable/anon key here, add a `NEXT_PUBLIC_` prefix, or commit this value.
5. Create the initial admin through `/signup`. After signing in, use Dashboard → Staff to create Admin and Kitchen logins. Staff sign in at `/login`.

The Staff page creates accounts using the email and password entered by the admin. Email/password is the supported staff sign-in method; phone-number login requires configuring Supabase phone authentication and is not currently enabled.

### 5. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Demo URLs (After Seeding)

| URL | Description |
|-----|-------------|
| `/` | Marketing landing page with features, pricing, FAQ |
| `/menu/the-bistro/table-1` | Customer menu for Table 1 |
| `/menu/the-bistro/table-1/cart` | Checkout page |
| `/login` | Staff login |
| `/signup` | One-time initial admin registration; public signup closes after the first admin is created |
| `/dashboard` | Admin dashboard (analytics, orders, menu, tables, coupons, settings) |
| `/dashboard/staff` | Admin-only staff account creation and directory |
| `/kitchen` | Kitchen display (order kanban board) |
| `/cashier` | Cashier desk (pending/completed payments) |
| `/order/<id>` | Customer order tracking (paste order ID from dashboard) |

## Project Structure

```
app/
  (auth)/               # Login, signup, forgot/reset password
  dashboard/            # Admin dashboard (overview, menu, orders, tables, coupons, settings)
  kitchen/              # Kitchen display (kanban board)
  cashier/              # Cashier desk (pending/completed payments)
  menu/[slug]/[table]/  # Customer QR menu (public, no auth)
  order/[id]/           # Order tracking (public, no auth)
  api/payments/         # Razorpay verify & webhook endpoints
  sitemap.ts            # SEO sitemap
  robots.ts             # Robots.txt
  manifest.ts           # PWA manifest
  error.tsx             # Global error boundary
  not-found.tsx         # 404 page
  loading.tsx           # Root loading state
  globals.css           # Tailwind + theme variables
  layout.tsx            # Root layout with providers
  page.tsx              # Landing page
actions/                # Server actions (auth, orders, menu, categories, tables, coupons, etc.)
components/
  features/             # Feature-specific client components
  layout/               # Dashboard sidebar, headers
  providers/            # TanStack Query, Theme, Sonner
  ui/                   # shadcn/ui primitives (button, card, dialog, input, etc.)
hooks/                  # use-cart (Zustand), use-media-query, use-debounce
lib/                    # Prisma client, Supabase, Razorpay, Resend, roles, utils
prisma/                 # Schema & seed script
schemas/                # Zod validation schemas (auth, menu, order, coupon, settings, table)
types/                  # TypeScript type definitions
utils/                  # Constants, validation helpers
services/               # API client layer
```

## Scripts

```bash
npm run dev              # Start dev server (http://localhost:3000)
npm run build            # Production build
npm run start            # Start production server
npm run lint             # ESLint
npx prisma db push       # Push schema to database
npx prisma db seed       # Seed demo data
npx prisma studio        # Database GUI (http://localhost:5555)
npx prisma generate      # Regenerate Prisma client
```

## Deployment (Vercel + Supabase)

### 1. Database

1. Create a Supabase project at [supabase.com](https://supabase.com)
2. Go to Project Settings → Database → Connection string
3. Copy the `psql` connection string → set as `DATABASE_URL`
4. Run `npx prisma db push` against your production database URL

### 2. Vercel Deployment

1. Push code to GitHub
2. Import repository in [Vercel](https://vercel.com)
3. Add all environment variables from `.env.example`
4. Set `NEXT_PUBLIC_APP_URL` to your Vercel domain (e.g. `https://qrfood.vercel.app`)
5. Deploy

### 3. Razorpay Webhook

In Razorpay Dashboard → Settings → Webhooks:
- URL: `https://yourdomain.com/api/payments/webhook`
- Events: `payment.captured`, `payment.failed`
- Secret: set `RAZORPAY_WEBHOOK_SECRET` in Vercel

### 4. Supabase Auth URLs

In Supabase Dashboard → Authentication → URL Configuration:
- Site URL: `https://yourdomain.com`
- Redirect URLs: `https://yourdomain.com/**`

### 5. Supabase Storage Bucket

In Supabase Dashboard → Storage:
1. Create a new bucket named `menu-images`
2. Set it to **Public**
3. See [SUPABASE_STORAGE_SETUP.md](./SUPABASE_STORAGE_SETUP.md) for details

## Production Checklist

- [ ] All environment variables set in Vercel
- [ ] `prisma db push` run against production database
- [ ] Supabase Auth configured with correct redirect URLs
- [ ] **Supabase Storage bucket `menu-images` created and set to Public**
- [ ] Razorpay webhook configured and tested
- [ ] Resend domain verified (if using email receipts)
- [ ] Set `SUPABASE_SERVICE_ROLE_KEY` in Vercel for admin-managed staff account creation and image uploads
- [ ] Create staff logins from Dashboard → Staff
- [ ] Test QR flow end-to-end on mobile device
- [ ] Enable HTTPS (automatic on Vercel)
- [ ] Update `NEXT_PUBLIC_APP_URL` to production domain
- [ ] Test coupon validation
- [ ] Test Razorpay payment flow (use test mode keys)
- [ ] **Test image upload on the menu management page**
- [ ] Configure custom domain in Vercel (optional)

## Security

- **Auth**: All protected routes check Supabase session + role-based access
- **Server Actions**: All mutations verify user authentication and restaurant ownership
- **Payments**: Razorpay signature verification on both frontend (verify API) and backend (webhook)
- **Input Validation**: Zod schemas on all forms
- **Database**: Prisma parameterized queries prevent SQL injection
- **Middleware**: Session refresh and route protection
- **Environment Variables**: All secrets stored in Vercel/Supabase, never in code

## License

MIT
