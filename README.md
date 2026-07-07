# The Target Library — Management System

Replaces the register/Excel workflow with a seat map, receipt system,
member history, dashboard, and bulk Excel import.

## 1. Set up the database

1. Go to your Supabase project (LibraryMS) → **SQL Editor** → New Query.
2. Paste the entire contents of `supabase/migration.sql` and click **Run**.
   This creates the `members`, `seats`, and `receipts` tables and seeds
   500 seats. Safe to re-run — it won't duplicate data.

## 2. Configure environment variables

A `.env.local` file is already included with your Project URL and
publishable key. If you regenerate keys later, update:

```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=...
```

Both values are safe to use client-side — they are NOT the service role
key, so nothing sensitive is exposed here. If you ever see a "service
role key" or a raw DB password, keep those private and never put them
in this file.

## 3. Install and run locally

```bash
npm install
npm run dev
```

Open http://localhost:3000 — you should see the seat grid.

## 4. What's included

- **Seats (`/`)** — 500-seat grid, green = free, red = full-day occupied,
  yellow = half-day occupied. Click any seat for details or to assign it.
- **New Receipt (`/new-receipt`)** — the core data-entry form. Creates a
  new member (or attaches to an existing Member ID), assigns a seat,
  sets subscription type/shift/sheet add-on, and generates a WhatsApp
  send-link if a phone number is provided.
- **Dashboard (`/dashboard`)** — total/free/occupied seat counts,
  seats expiring within 7 days, and this month's revenue.
- **Members (`/members`)** — search by name or Member ID, view full
  payment history per member (mirrors the old paper tracking card).
- **Bulk Import (`/import`)** — upload an Excel file of existing
  register data. Download the template first, fill it in, upload,
  review the parsed preview (bad rows are flagged and skipped), then
  commit.

## 5. Deploying

This is a standard Next.js app — deploys cleanly to Vercel:

```bash
npx vercel
```

Add the same two environment variables in the Vercel project settings
before deploying.

## Notes / known simplifications for v1

- Single shared login is assumed for staff — no auth/roles are wired up
  yet. Add this if the owner wants staff-level permission separation.
- WhatsApp sending uses the free `wa.me` click-to-chat link (staff taps
  a button, WhatsApp opens pre-filled, they hit send). No paid API
  integration needed for this scale.
- Renewals: currently done by creating a fresh receipt against the same
  seat number via the New Receipt form. A dedicated one-click "Renew"
  button (pre-filling the previous subscription's details) is a natural
  next iteration once this is in daily use.
