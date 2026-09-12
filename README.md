# 🏛️ LibraryOS — Multi-Tenant SaaS Platform
> **The Operating System for Study Libraries, Reading Rooms & Co-Working Spaces.**  
> Built for the Indian library ecosystem with real-time seat matrices, UPI soundbox verification, entrance QR self-admission, white-label branding, and multi-tenant security.

---

## 🌟 Overview

**LibraryOS** transforms traditional single-location library management into a modern, scalable **Multi-Tenant SaaS platform**. It eliminates manual paper registers, complex Excel sheets, and missed fee collections by automating front-desk operations, seat allocation, student admissions, and fee renewals.

Whether managing a 50-seat quiet study hall or a 300-seat multi-shift reading library, LibraryOS provides each library owner with an isolated, custom-branded workspace with real-time analytics.

---

## ✨ Key Platform Features

### 🪑 1. Interactive Visual Seat Matrix Engine
- **Dynamic Capacity Support**: Smoothly handles from 20 up to 300+ seats with color-coded live occupancy states:
  - 🟢 **Green**: Free / Available seat
  - 🔴 **Red**: Occupied (Full-day subscription or both shifts booked)
  - 🟡 **Yellow**: Half Day (Single shift occupied, complementary shift available)
  - 🟣 **Purple**: Double Shift (Two distinct students occupying morning/evening slots)
  - 🔵 **Blue**: Overdue / Payment Due alert
- **Auto-Fit Responsive Sizing**: Dynamically calculates tile dimensions to fit up to 300 seats on screen without vertical scrolling. Includes 5 size presets (`fit`, `compact`, `standard`, `large`, `custom`).
- **Fullscreen Reception Display**: 1-click kiosk mode (`Enter Fullscreen`) designed for reception wall displays and librarian counter tablets.
- **Instant Seat Inspection Drawer**: Click any seat to inspect student details, active shift timings, monthly fees, validity range, soundbox UTR, and vacate seats in 1 click.

---

### 🔔 2. Method B: Entrance Door QR Self-Admission & Audio Chimes
- **Student Door Entrance QR (`/l/[slug]/join`)**: Students scan a printable A4 entrance QR code, enter their details, select their preferred shift, and submit their UPI Soundbox UTR number.
- **Soundbox Verification Queue**: Pending admissions appear in real-time on the front desk.
- **Synthesizer Audio Chime**: Uses the browser Web Audio API to play an audible notification chime whenever a student submits an admission request at the door.
- **1-Click Seat Assignment**: Receptionist verifies the soundbox announcement against the student's UTR, picks an available seat, and approves admission with 1 click.
- **Automatic Receipt & Pass Creation**: Automatically generates the member profile, seat booking, and digital pass.

---

### 🎨 3. Zero-Cloud-Cost White-Label Branding
- **Client-Side Canvas Image Compression**: Upload custom library logos (PNG, JPG, SVG, WebP). The browser automatically resizes and compresses images to `< 25KB WebP` stored directly in PostgreSQL — zero third-party AWS S3 / Cloudinary buckets required.
- **8 Curated Study Emblems**: Instant 1-click vector emblems (🏛️ Academy Crest, 📚 Modern Stack, 🎓 Scholar Laurel, 💡 Wisdom Torch, ⚡ Focus Station, 📖 Open Tome, 🌟 Apex Lounge, ☕ Quiet Haven).
- **Luxury Monogram Generator**: Generates 2-letter monogram SVGs with 4 designer palettes: Sunrise (Rose/Amber), Midnight (Indigo/Purple), Emerald (Teal/Emerald), and Obsidian (Dark Titanium).
- **Universal Multi-Screen Propagation**: Custom branding instantly reflects across the Header Navbar, Reception Desk, Student Digital Passes, E-Invoices, and Door Posters.

---

### 🔒 4. Strict Security & Role-Based Isolation
- **Staff vs. Owner Isolation**: Desk staff credentials (`staff`) only permit access to check-ins, member lists, daily collections, and due fees.
- **Owner Credentials Gate**: Sensitive configurations (pricing, shift hours, seat counts, soundbox UPI ID/Name, and staff password resets) are locked behind the **Owner Credentials Gate** (`/l/[slug]/settings`).
- **Zero Session Leaks**: Logging into a staff account automatically purges lingering owner authorizations.

---

### 🧪 5. Isolated 200-Seat Demo Lounge (`/l/demo-library`)
- **Zero Target Library Data Leakage**: The public SaaS marketing homepage (`/`) is completely decoupled from production client databases.
- **High-Fidelity Synthetic Engine**:
  - 200 simulated seats with realistic occupancy distributions (Full Day, Double Shifts, Half Day, Free, Due).
  - 190+ procedural Indian student profiles with realistic shift allocations.
  - Realistic ₹18,600 daily collections ledger and due fee reminders.
  - Interactive admission queue allowing prospective buyers to test soundbox verifications and approval chimes safely.

---

### 🛡️ 6. 7-Day Free Trial Access Enforcement & Data Preservation
- **Commercial Access Rules**:
  - New tenant libraries receive an automatic **7-Day Free Trial**.
  - If the monthly fee (₹600/mo) is not paid after 7 days, **workspace access is locked**.
- **100% Data Preservation Guarantee**:
  - **Zero Data Deletion**: Member ledgers, receipt histories, seat configurations, and shifts remain 100% intact and untouched in the database.
  - Locks behind the **`TenantAccessBarrier`** paywall screen with reassurance, clear fee details, and a 1-click WhatsApp button to Super Admin (`+91 8535035757`) for UPI payment.

---

### 👑 7. Super Admin Founder Control Panel (`/superadmin`)
- **Verified Paid MRR**: Accurately calculates real monthly recurring revenue from paying active accounts (`₹400/mo` from Target Library). Unpaid trial accounts are strictly excluded and counted as ₹0.
- **KPI Metrics Cards**:
  - Verified Paid MRR & Annual Run Rate
  - Total Registered Libraries
  - Testing / 7-Day Trial count
  - Blocked / Expired count
- **1-Click Founder Actions**:
  - `💵 Paid +30d`: Activates subscription for 30 days upon receiving UPI payment.
  - `⏳ +7d Trial`: Extends trial period for clients requesting more testing time.
  - `🔒 Expire Now`: Simulates trial expiration on demand to test the locked paywall barrier.
  - `✏️ Rate`: Modifies monthly subscription fee or assigns lifetime VIP status.
  - `🔗 Open App`: Direct jump to tenant workspace.

---

### 🖥️ 8. Universal Persistent Header & Wide Layout
- **Screen-Filling Canvas (`max-w-[96vw]` / `1750px`)**: Eliminates empty side gutters on 1080p, 1440p, and ultrawide displays.
- **Zero Header Jumps**: Navigating between Desk, Members, Daily Fees, Due Fees, Admission, and Settings keeps the exact same unified navigation bar locked at the top.
- **Mobile-Optimized Navigation**: Horizontal touch-swipe navigation with quick walk-in admission CTAs on mobile screens.

---

### 📊 9. 1-Click Excel & CSV Accounting Export Engine
- **Accountant-Ready Formats**: Full RFC-4180 CSV export designed specifically for Indian Chartered Accountants (CAs), tax filings, and audit books.
- **UTF-8 BOM Encoding**: Pre-encoded with byte order mark (`\uFEFF`) ensuring Microsoft Excel (Windows & macOS) opens Indian names, Hindi text, and rupee currency symbols (`₹`) without character scrambling.
- **Phone Number Text Preservation**: Automatically formats Indian 10-digit phone numbers (`="9876543210"`) so Excel doesn't turn them into scientific notation (like `9.87E+09`) or drop leading zeros.
- **Multi-Module Coverage**:
  - **`/collections`**: Daily fee collections with Cash vs. Soundbox UPI breakdown and total summary calculation rows.
  - **`/members`**: Full permanent member ledger with active seat numbers, shift names, joining dates, and validity windows.
  - **`/due-fees`**: Overdue candidates register with severity classifications (1-3 days, 4-7 days, 7+ days) and estimated pending revenues.
  - **`/superadmin`**: SaaS tenant directory with onboarding dates, monthly rates, seat counts, and trial states.

---

### ⚡ 10. Dynamic UPI Intent & Automated WhatsApp Overdue Recovery
- **Solves the #1 Headache of Library Owners**: Eliminates awkward face-to-face friction and hours wasted chasing students for overdue fees.
- **NPCI-Compliant Dynamic UPI Deep Links**: Generates standard `upi://pay?pa=...&pn=...&am=...&cu=INR&tn=...` deep links:
  - Tapping this link on any mobile phone (Android / iOS) **directly launches PhonePe, Google Pay, Paytm, or BHIM**.
  - The library's UPI ID, payee name, and the **exact overdue fee amount** are pre-filled — students only enter their UPI PIN to complete payment.
- **Interactive Reception UPI Modal (`DynamicUpiModal`)**:
  - Front-desk staff can click `⚡ UPI QR` on any overdue student to pop an on-screen dynamic QR code for instant counter scanning.
  - One-click WhatsApp button with pre-formatted overdue notices and 1-click UPI links.
  - "Open UPI App" and "Copy UPI Link" actions.
- **`⚡ Remind Queue` Batch Launcher**:
  - One-click trigger in `/due-fees` that opens the reminder flow for the most urgent student in the current view with a registered phone number.
- **Multi-Tenant White-Label UPI Routing**:
  - Automatically loads each library's custom UPI ID and Payee Name from the database (e.g. `uniyalmanas@okicici` for testing tenants, `targetlibrary@upi` for Target Library).
- **Self-Service Digital Pass Renewal (`/receipts/[id]`)**:
  - Expired passes display an emergency renewal banner with a 1-click UPI payment button and expandable QR code for self-service renewal.
- **Automated Server Dispatch API (`POST /api/send-whatsapp`)**:
  - Server-side route supporting `type: "due_reminder"` with dynamic UPI link formatting, UltraMsg background dispatch, and simulated logging mode.

---

## 🗺️ Key Routes Directory

| Route | Access Level | Description |
| :--- | :--- | :--- |
| `/` | Public | SaaS Marketing Homepage with feature showcases and demo launcher |
| `/l/demo-library` | Public Sandbox | Isolated 200-seat interactive Demo Lounge with synthetic data |
| `/l/[slug]` | Staff / Owner | Real-time seat matrix desk, admission queues, and check-in portal |
| `/l/[slug]/join` | Public / Students | Entrance door QR self-admission form with UPI Soundbox UTR submission |
| `/l/[slug]/student` | Public / Students | Virtual digital membership pass with live validity badge & QR code |
| `/l/[slug]/settings` | Owner Only | Brand customization, shift configurations, UPI Soundbox, and passwords |
| `/members?slug=[slug]` | Staff / Owner | Permanent member search ledger with seat numbers and payment history |
| `/collections?slug=[slug]` | Staff / Owner | Daily fee collection ledger with cash vs. UPI breakdown and date filtering |
| `/due-fees?slug=[slug]` | Staff / Owner | Overdue student tracker with 1-click WhatsApp reminder generator |
| `/receipts/[id]` | Public | Printable tax invoice receipt and digital pass verification |
| `/superadmin` | Founder / Superadmin | SaaS founder control panel with verified MRR, library directory, and billing actions |

---

## 🛠️ Technology Stack

- **Framework**: [Next.js](https://nextjs.org/) (App Router, React Server & Client Components)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/) with CSS custom properties and light/dark theme toggle
- **Database & Auth**: [Supabase](https://supabase.com/) (PostgreSQL with Row-Level Multi-Tenancy)
- **Audio Engine**: Web Audio API (Native browser synthesizer for admission chime notifications)
- **Image Processing**: HTML5 Canvas API (Client-side WebP compression to `< 25KB`)
- **Hosting & Deployment**: Vercel

---

## 🚀 Getting Started Locally

### 1. Clone the Repository
```bash
git clone https://github.com/uniyalmanas/Target_Library.git
cd Target_Library
git checkout feat/multi-tenant-saas
```

### 2. Configure Environment Variables
Create a `.env.local` file in the root directory:
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-supabase-project.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-supabase-publishable-key

# Master Founder Passcode for Super Admin and emergency overrides
NEXT_PUBLIC_ADMIN_PASSWORD=Target2026

# Optional: Background WhatsApp delivery provider
ULTRAMSG_INSTANCE_ID=your_instance_id
ULTRAMSG_TOKEN=your_token
```

### 3. Install Dependencies & Launch Dev Server
```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the SaaS landing page, or visit:
- **Interactive Demo Lounge**: [http://localhost:3000/l/demo-library](http://localhost:3000/l/demo-library)
- **Target Library Desk**: [http://localhost:3000/l/target-library](http://localhost:3000/l/target-library)
- **Testing Tenant Desk**: [http://localhost:3000/l/testing-library-1](http://localhost:3000/l/testing-library-1)
- **Super Admin Founder Panel**: [http://localhost:3000/superadmin](http://localhost:3000/superadmin)

---

## 📄 License & Intellectual Property
© 2026 LibraryOS / The Target Library. All rights reserved.
Developed for commercial study libraries and co-working reading rooms.
