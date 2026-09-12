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
> **Solves the #1 Headache of Library Owners**: Eliminates awkward face-to-face friction and hours wasted chasing students for overdue monthly fees.

#### 🔄 Complete Working Lifecycle (How It Works End-to-End)
1. **Automated Overdue Detection**:
   - The platform continuously tracks active subscriptions against the current date.
   - Candidates whose validity expired without renewal are flagged on the visual seat matrix (Blue badge) and enrolled into `/due-fees`.
   - Categorized into 3 urgency tiers:
     - 🟡 **1–3 Days Overdue (Grace Period)**: Gentle reminder notification.
     - 🟠 **4–7 Days Overdue (Urgent)**: High-priority renewal notice.
     - 🔴 **7+ Days Overdue (Critical Alert)**: Urgent warning that the seat is pending reallocation to the waiting queue.

2. **Dynamic Multi-Tenant UPI Intent Generation**:
   - Automatically loads each library's custom UPI ID and payee business name from Supabase (e.g. `uniyalmanas@okicici` for testing tenants, `targetlibrary@upi` for Target Library).
   - Constructs an official NPCI-compliant deep-link URL:
     ```
     upi://pay?pa={upi_id}&pn={payee_name}&am={amount.toFixed(2)}&cu=INR&tn=Fee Seat #{seat_number} - {library_name}&tr=REF_{timestamp}
     ```
   - When tapped on **any mobile device (Android / iOS)**, the phone directly launches **PhonePe, Google Pay, Paytm, or BHIM**.
   - Payee name, library UPI ID, and the **exact rupee fee** are 100% pre-filled. The student only enters their UPI PIN to transfer the funds.

3. **Front-Desk Receptionist Tools**:
   - **`⚡ UPI QR` Table Triggers**: Added to every overdue row in `/due-fees`. Clicking opens the **`DynamicUpiModal`**.
   - **On-Screen Counter QR Code**: Renders a dynamic pre-filled QR code so walk-in students can scan the screen with PhonePe/GPay and pay in seconds.
   - **`⚡ Remind Queue` Batch Launcher**: Header button that automatically pulls the most urgent student with a registered phone number for rapid sequential reminder runs.

4. **Self-Service Renewal on Digital Student Passes (`/receipts/[id]`)**:
   - When an overdue student accesses their digital pass via WhatsApp or browser, an emergency **Subscription Overdue Banner** appears.
   - Displays overdue duration, pending fee, and a **`⚡ 1-Click Pay (₹amount)`** button plus expandable QR code, empowering students to renew independently without front-desk intervention.

5. **Automated Server Dispatch API (`POST /api/send-whatsapp`)**:
   - Backend endpoint supporting `type: "due_reminder"` with dynamic UPI link formatting, UltraMsg API background dispatch, and terminal simulation logging.

---

#### 💰 Zero-Cost Architecture (Why Neither You Nor the Library Pays a Single Rupee)

| Component | Standard Paid Market Approach | 🏛️ LibraryOS Zero-Cost Architecture | Your Cost | Library Cost |
| :--- | :--- | :--- | :--- | :--- |
| **Payment Collection** | Payment Gateways (Razorpay / Cashfree) charge **2% + 18% GST** per transaction | **NPCI Dynamic UPI Intent**: Direct bank-to-bank transfer via GPay/PhonePe | **₹0.00** | **₹0.00 (0% Cut)** |
| **WhatsApp Reminders** | Official Meta Cloud API charges **₹0.80 to ₹1.00** per utility message | **Native `wa.me` Deep-Linking**: Pre-formatted WhatsApp Web / App chat launcher | **₹0.00** | **₹0.00 (Unlimited)** |
| **Dynamic QR Codes** | Paid dynamic QR SaaS services ($10–$30/mo) | **Client-Side Dynamic QR Generator**: On-the-fly intent payload encoding | **₹0.00** | **₹0.00** |
| **Deliverability** | Third-party bot numbers (often ignored by students) | **Library's Own Verified WhatsApp**: Sent directly from the receptionist's number | **100% Delivery** | **Immediate Replies** |

> **Optional Headless Bot Upgrade**: If a library owner insists on a 100% headless server bot (e.g. automated 9:00 AM background cron dispatches with zero staff interaction), `POST /api/send-whatsapp` already has UltraMsg / Meta Cloud API hooks built-in. This can be packaged as a premium paid SaaS add-on (e.g. ₹299/mo).

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
| `/expenses?slug=[slug]` | Staff / Owner | Daily operational expense ledger, real net profit, cost breakdown, and presets |
| `/receipts/[id]` | Public | Printable tax invoice receipt and digital pass verification |
| `/superadmin` | Founder / Superadmin | SaaS founder control panel with verified MRR, library directory, and billing actions |

---

### 📉 11. Daily Operational Expenses & Real Net In-Hand Profit Ledger (`/expenses`)
> **True Business Health at a Glance**: Revenue alone is vanity; real net in-hand profit is sanity. LibraryOS tracks every rupee going out alongside every rupee coming in.

- **Real Net In-Hand Profit Calculation**:
  $$\text{Real Net In-Hand Profit} = \text{Gross Collections (Cash + UPI)} - \text{Total Operating Expenses}$$
- **7 Core Operational Cost Categories**:
  - ⚡ **Electricity & AC Power**: Commercial power meter bills, generator fuel, stabilizer servicing.
  - 🏢 **Hall & Premises Rent**: Monthly lease / landlord NEFT transfers.
  - 🌐 **Commercial Wi-Fi Broadband**: High-speed fiber lines (Airtel/Jio Commercial).
  - 💧 **Drinking Water & Tea/Coffee**: 20L chilled RO water cans, tea pantry provisions.
  - 👥 **Staff Salary & Caretakers**: Desk supervisors, sweepers, night caretakers.
  - 🛠️ **Maintenance & Repairs**: AC gas refill, ergonomic chair repairs, lighting fixtures.
  - 📦 **Miscellaneous**: Cleaning supplies, register stationery, first aid supplies.
- **⚡ 1-Click Fast Presets**:
  - One-tap quick presets populate titles, categories, and payment modes for fast routine logging.
- **Live KPI Summary Metric Cards**:
  - **Gross Collections**: Monthly gross broken down by Cash vs. Online/Soundbox UPI.
  - **Operating Expenses**: Total spent across all operational categories.
  - **Real Net In-Hand Profit**: Net cash pocketed by the library owner after settling all bills.
  - **Profit Margin %**: Live profit efficiency percentage.
- **Multi-Tenant Isolation & Local Fallback Engine**:
  - Full data isolation per library tenant (`library_id` / `slug`).
  - Seamless persistent fallback (`lib/localExpenses.ts`) ensuring zero runtime errors or setup friction prior to running `supabase/expenses.sql`.
- **1-Click CA-Ready CSV Export**:
  - RFC-4180 format with UTF-8 BOM encoding for direct opening in Microsoft Excel and Tally accounting.

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
