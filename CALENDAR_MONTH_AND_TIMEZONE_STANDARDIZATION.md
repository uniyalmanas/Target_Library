# 🗓️ Calendar Month Alignment & Timezone-Safe Date Standardization

> **Document Version:** 1.0.0  
> **Date:** October 27, 2026  
> **Project:** LibraryOS / Target Library Management System  
> **Production Site:** [https://library-ms-three.vercel.app](https://library-ms-three.vercel.app)  
> **Git Commits:** `c3f5ad8`, `69199be`, `8d5993f`, `5e03d32`  

---

## 📋 1. Executive Summary

This document serves as the definitive engineering and operational record of the **Timezone UTC Offset Elimination** and the **True Calendar Month Standardization** implemented across LibraryOS.

These architectural enhancements resolve two critical issues reported directly by The Target Library owner:
1. **The Timezone Shift Bug**: When creating or viewing admissions filled on October 26th, the platform subtracted a day and displayed October 25th due to `.toISOString()` UTC midnight truncation.
2. **The 30-Day Calendar Clash Bug**: The platform rigidly forced all monthly subscriptions to exactly 30 days, causing October 31st to be skipped, date pickers in Collections to freeze on the 30th, and renewal dates to drift backwards every month against the real calendar.

The entire multi-tenant system now operates on a **True Calendar Month model** (adapting seamlessly to 28, 29, 30, or 31 days) grounded in **Indian Standard Time (IST, UTC+05:30)**.

---

## 🔍 2. Problem Statement & Root Cause Analysis

### 2.1 The "Filled on 26-Oct, Platform Showed 25-Oct" Issue

#### The Code That Failed:
```typescript
function computeEndDate(startStr: string, days: number): string {
  if (!startStr) return "";
  const d = new Date(`${startStr}T00:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0]; // ❌ BUG HERE
}
```

#### Why it subtracted 1 day in India:
1. In India (UTC+05:30), `new Date("2026-10-26T00:00:00")` initializes a `Date` object at local midnight: `Mon Oct 26 2026 00:00:00 GMT+0530 (India Standard Time)`.
2. When calling `.toISOString()`, the V8 engine converts the local time back to **Coordinated Universal Time (UTC)** by subtracting 5 hours and 30 minutes.
3. `26 Oct 2026, 00:00:00 IST` minus 5:30 hours is **`25 Oct 2026, 18:30:00 UTC`**.
4. Calling `.split("T")[0]` extracted the UTC date string: **`"2026-10-25"`**.
5. As a consequence:
   - Any 0-day or initial calculation for `26-Oct` returned `2026-10-25`.
   - Adding 30 days to `26-Oct` returned `24-Nov` instead of `25-Nov`.
   - Adding 365 days to `2025-10-26` produced `2026-10-25`.
   - Calling `{computeEndDate(endDate, 1)}` in the Active Tenure badge returned the exact same day instead of tomorrow.

---

### 2.2 The "After 30 the Date Directly Shows 1" Issue

#### The Failure Mechanisms:
1. **Rigid 30-Day Assumption**: In months with 31 days (January, March, May, July, August, October, December), adding 30 days to the 1st of the month landed on the **30th** (e.g. Oct 1 + 30 days = Oct 30 due to the UTC bug). On renewal (`end_date + 1`), the next start date skipped to **November 1st**, completely skipping and orphaning Day 31.
2. **Collections Next-Day Lock**: In `CollectionsView.tsx`:
   ```typescript
   const handleNextDay = () => {
     const current = new Date(`${selectedDate}T00:00:00`);
     current.setDate(current.getDate() + 1);
     setSelectedDate(current.toISOString().split("T")[0]);
   };
   ```
   When `selectedDate` was `2026-10-30`, advancing by 1 day became `2026-10-31 00:00:00 IST`. In UTC, this was `2026-10-30 18:30:00 UTC`. The string set back into state remained `"2026-10-30"`, causing the date navigation to lock up.

---

### 2.3 The Target Library Owner's Business Insight

The owner asked:
> *"While admitting someone, it says: `Seat Occupied: 30 Days (2026-10-27 → 2026-11-26)` and `Turns Green (Free) on 2026-11-27`. Some months have 31 days and some have 30 days, so shouldn't their seating arrangement follow that?"*

The owner pointed out that **Indian study libraries bill by the Calendar Month**:
* If a student joins on **27-Oct**, their monthly fee covers the entire month through **26-Nov** (31 inclusive days in October), and their renewal / next payment is due on **27-Nov** (the exact same calendar date next month).
* If a system forces a rigid 30-day count, the student's renewal date drifts backwards by 1 day every 31-day month (`Oct 27` $\rightarrow$ `Nov 26` $\rightarrow$ `Dec 25` $\rightarrow$ `Jan 24`...). Students and library administrators strongly dislike shifting due dates.

---

## ⚙️ 3. The Centralized Timezone-Safe Date Architecture

A new foundational module was created at [`lib/dates.ts`](file:///D:/library-ms/library-ms/lib/dates.ts) to eliminate `.toISOString()` date corruption across the entire platform.

### Core Mathematical Functions:

```typescript
/**
 * 1. Returns today's date formatted as YYYY-MM-DD in Indian Standard Time (Asia/Kolkata).
 * Eliminates pre-5:30 AM edge cases where UTC returned yesterday's date.
 */
export function getTodayIST(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/**
 * 2. Formats a Date object as YYYY-MM-DD using local calendar values (not UTC).
 */
export function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * 3. Timezone-safe addition or subtraction of days.
 */
export function addDaysToDate(dateStr: string, days: number): string {
  const parts = parseDateParts(dateStr);
  if (!parts) return "";
  const date = new Date(parts.year, parts.month - 1, parts.day);
  date.setDate(date.getDate() + Number(days));
  return formatLocalDate(date);
}

/**
 * 4. True inclusive day count between startStr and endStr.
 * E.g., 2026-10-27 to 2026-11-26 => 31 days.
 */
export function computeDaysBetween(startStr: string, endStr: string): number {
  const startParts = parseDateParts(startStr);
  const endParts = parseDateParts(endStr);
  if (!startParts || !endParts) return 30;

  const s = new Date(startParts.year, startParts.month - 1, startParts.day);
  const e = new Date(endParts.year, endParts.month - 1, endParts.day);
  const diffTime = e.getTime() - s.getTime();
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24)) + 1;
  return Math.max(1, diffDays);
}

/**
 * 5. Computes True Calendar Month subscription validity.
 * Next renewal starts on the exact same date next month (or clamped if shorter).
 */
export function computeCalendarMonthEnd(startStr: string, months: number = 1): string {
  const parts = parseDateParts(startStr);
  if (!parts) return "";
  const { year, month, day } = parts;
  const targetYear = year + Math.floor((month - 1 + months) / 12);
  const targetMonth = (month - 1 + months) % 12;
  const daysInTargetMonth = new Date(targetYear, targetMonth + 1, 0).getDate();
  const targetDay = Math.min(day, daysInTargetMonth);
  const targetDate = new Date(targetYear, targetMonth, targetDay);
  targetDate.setDate(targetDate.getDate() - 1);
  return formatLocalDate(targetDate);
}

/**
 * 6. Computes end date for a given number of inclusive days.
 * E.g., for 7 days starting on 27-Oct => ends on 02-Nov (7 days inclusive).
 */
export function computeCustomDaysEnd(startStr: string, days: number): string {
  if (!startStr) return "";
  const count = Math.max(1, Number(days) || 1);
  return addDaysToDate(startStr, count - 1);
}
```

---

## 📊 4. Real-World Behavior Across Months

| Admission Date | Month Type | Valid Period | Days Count | Turns Green / Next Fee Due |
| :--- | :--- | :--- | :--- | :--- |
| **2026-10-27** | 31-day month | `2026-10-27` $\rightarrow$ `2026-11-26` | **31 Days** | **2026-11-27** (exact same day next month) |
| **2026-10-01** | 31-day month | `2026-10-01` $\rightarrow$ `2026-10-31` | **31 Days** | **2026-11-01** (first of next month) |
| **2026-10-31** | 31-day month (next month 30d) | `2026-10-31` $\rightarrow$ `2026-11-29` | **30 Days** | **2026-11-30** (clamped to Nov end) |
| **2026-11-27** | 30-day month | `2026-11-27` $\rightarrow$ `2026-12-26` | **30 Days** | **2026-12-27** (exact same day next month) |
| **2026-11-01** | 30-day month | `2026-11-01` $\rightarrow$ `2026-11-30` | **30 Days** | **2026-12-01** (first of next month) |
| **2026-02-01** | 28-day month | `2026-02-01` $\rightarrow$ `2026-02-28` | **28 Days** | **2026-03-01** (first of next month) |

---

## 🗺️ 5. Multi-Tenant Codebase Implementation

The timezone-safe date module and calendar month calculations were systematically integrated across all platform views and APIs:

### 1. `components/views/NewReceiptView.tsx`
* **Dynamic Button Label**: `Standard 1 Month (${durationDays}d)` displays **31d** in October, **30d** in November, and **28d** in February.
* **Auto-Calculation**: Start and End date changes trigger `computeCalendarMonthEnd` for month mode and `computeCustomDaysEnd` for custom days mode.
* **Tenure Visual Badge**: Accurately shows `Seat Occupied: 31 Days (2026-10-27 → 2026-11-26) [1 Calendar Month]` and `Turns Green on 2026-11-27`.

### 2. `app/api/receipts/route.ts`
* Replaced `end.setDate(end.getDate() + 30)` with `computeCalendarMonthEnd(start_date, 1)`.
* Resolved custom day bookings with `computeCustomDaysEnd(start_date, duration_days)`.
* Replaced server-side date comparisons with `getTodayIST()`.

### 3. `lib/EditReceiptModal.tsx`
* Start Date edits dynamically preserve calendar month alignment:
  ```typescript
  if (daysCount >= 28 && daysCount <= 31) {
    setEndDate(computeCalendarMonthEnd(newS, 1));
  } else {
    setEndDate(computeCustomDaysEnd(newS, daysCount));
  }
  ```
* Ensures `"use client"` is the first line of the file.

### 4. `components/views/CollectionsView.tsx`
* Stepping forward and backward now works across all months:
  ```typescript
  const handlePrevDay = () => setSelectedDate((prev) => computeEndDate(prev, -1));
  const handleNextDay = () => setSelectedDate((prev) => computeEndDate(prev, 1));
  ```
* Correctly advances from `30-Oct` $\rightarrow$ `31-Oct` $\rightarrow$ `1-Nov`.

### 5. `app/api/admission-requests/route.ts`
* Approving online student self-registrations resolves end dates to `computeCalendarMonthEnd(sDate, 1)`.

### 6. `app/api/import/route.ts`
* Bulk student import from Excel calculates true calendar months instead of flat 30 days.

### 7. `app/api/dashboard/route.ts`
* Overdue cutoff tracking uses `computeEndDate(todayStr, -45)`.
* 6-Month revenue trend historical loop initializes with `new Date(year, month - i, 1)` to eliminate month-skipping bugs on the 31st of any month.

### 8. `app/l/[slug]/page.tsx` & `app/api/seats/route.ts`
* Seat matrix occupancy and overdue calculations use `getTodayIST()`.
* Seats remain occupied through the final validity date and transition to Due / Green on the next day.

### 9. `app/api/libraries/[slug]/student/route.ts`
* Student digital portal calculates `daysRemaining` using `getTodayIST()`.

---

## 🧪 6. Verification & Production Deployment

* **Next.js Turbopack Compilation**: `✓ Compiled successfully`
* **TypeScript Static Analysis**: `✓ Finished TypeScript in 14.2s (0 errors)`
* **Page Generation**: `✓ Generating static pages (25/25)`
* **Git Codebase**: Commits `c3f5ad8`, `69199be`, `8d5993f`, `5e03d32` pushed to `origin/main` and deployed live on Vercel.
