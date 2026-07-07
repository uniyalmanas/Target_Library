# 🏛️ The Target Library — Management System

A premium, modern web application designed to replace manual register logs and Excel sheets for **The Target Library** (Dehradun). Built with Next.js, Tailwind CSS v4, and Supabase, it features an elegant, Apple-inspired interface, support for up to 1000 seats, live seat booking states, custom passes, and automated WhatsApp delivery.

## 🔗 Production URL
*   **Live Web App:** [https://library-ms-three.vercel.app](https://library-ms-three.vercel.app)
*   **GitHub Codebase:** [https://github.com/uniyalmanas/Target_Library](https://github.com/uniyalmanas/Target_Library)

---

## ✨ Key Features

1.  **Cinema-Style Seat Map (`/`)**
    *   Interactive grid layout showing **1000 seats** with real-time status.
    *   🟢 **Green:** Free/Available.
    *   🔴 **Red:** Occupied (Full-day subscription).
    *   🟡 **Yellow:** Occupied (Half-day morning/evening shifts).
    *   Clicking any occupied seat slides open a premium details panel displaying the student's name, active shift timing, validity date, and quick action shortcuts.

2.  **New Receipt & Booking Form (`/new-receipt`)**
    *   Register new members or book seats for existing members using custom Member IDs (e.g. `1287`).
    *   Automatically calculates subscription pricing:
        *   **Full Day (6am - 12am):** ₹900/month (₹1200 with sheet/desk space addon).
        *   **Half Day (6am - 2pm / 2pm - 12am):** ₹600/month (₹900 with sheet/desk space addon).
    *   Allows custom overrides for amounts paid.

3.  **🎟️ High-Class Wallet Card & Invoice Receipt (`/receipts/[id]`)**
    *   **Membership Card:** An Obsidian-black, glassmorphic card (inspired by Apple Wallet passes) featuring the library branding, student details, seat allocation, validity status, and a verification QR code.
    *   **E-Invoice:** A clean, professional billing receipt ready to print or save as a PDF.

4.  **⚡ Automated Background WhatsApp Delivery (`/api/send-whatsapp`)**
    *   When a booking is confirmed, the system automatically tries to send the receipt details and digital pass link directly to the student's phone number on WhatsApp in the background.
    *   **Provider Integration:** Wire up pre-configured **UltraMsg** instance credentials in `.env.local` to enable completely automated background delivery.
    *   **Manual Fallback:** Shows a manual **📲 Open WhatsApp Send** button if background credentials are not configured.

5.  **📊 Member History Timeline (`/members/[id]`)**
    *   Full historic log of all payments, seat leases, and expired subscriptions per student.
    *   Instant **"💬 Share Pass"** and **"🎟️ View Pass"** buttons on past billing entries.

6.  **📥 Bulk Excel Import (`/import`)**
    *   Allows uploading legacy registration data from registers/spreadsheets in bulk.
    *   Features an interactive review grid where errors (e.g., unavailable seats) are highlighted and skipped while clean data is loaded cleanly.

---

## 🛠️ Technical Stack
*   **Frontend:** React, Next.js (App Router, Turbopack)
*   **Styling:** Tailwind CSS v4, Vanilla CSS Custom Variables (Apple-style system)
*   **Database:** Supabase (PostgreSQL)
*   **Hosting & CI/CD:** Vercel

---

## 🚀 Local Development Setup

1.  **Clone the Repository:**
    ```bash
    git clone https://github.com/uniyalmanas/Target_Library.git
    cd Target_Library
    ```

2.  **Configure `.env.local`:**
    Create a `.env.local` file in the root directory:
    ```env
    NEXT_PUBLIC_SUPABASE_URL=https://yokxobybxdhmqijnipyx.supabase.co
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_eFb_J4TDzQqY6UTjUsX5og_UKrcJqa3

    # Optional: Configure UltraMsg for live background WhatsApp delivery
    ULTRAMSG_INSTANCE_ID=your_instance_id
    ULTRAMSG_TOKEN=your_token
    ```

3.  **Install Dependencies & Run:**
    ```bash
    npm install
    npm run dev
    ```
    Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 📦 Database Migrations
The database schema and seeds are stored in `supabase/migration.sql`. To set up a new Supabase environment:
1. Paste the content of `supabase/migration.sql` into the Supabase SQL editor.
2. Run the migration to define tables, setup constraint rules (supporting 1000 seats), and seed initial seat maps.
