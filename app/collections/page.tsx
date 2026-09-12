"use client";

import { Suspense, useEffect, useState, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import EditReceiptModal, { EditableReceipt } from "@/lib/EditReceiptModal";

interface DailyPayment {
  receipt_no: number;
  student_id: number;
  student_name: string;
  student_phone: string | null;
  seat_id: number;
  seat_number: number;
  subscription_type: "full_day" | "half_day";
  shift_type: string | null;
  has_sheet: boolean;
  amount_paid: number;
  payment_mode?: "cash" | "online";
  start_date: string;
  end_date: string;
  created_at: string;
  payment_time: string;
  is_new_admission: boolean;
}

interface DailySummary {
  total_students: number;
  unique_members: number;
  total_collected: number;
  cash_collected?: number;
  online_collected?: number;
  cash_count?: number;
  online_count?: number;
  new_admissions_count: number;
  renewals_count: number;
  with_sheet_count: number;
  shift_counts: {
    full_day: number;
    shift_1: number;
    shift_2: number;
    shift_3: number;
    other: number;
  };
}

function getTodayIST(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function DailyCollectionsContent() {
  const searchParams = useSearchParams();
  const slug = searchParams.get("slug") || "target-library";

  const [selectedDate, setSelectedDate] = useState<string>(getTodayIST());
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [lastUpdated, setLastUpdated] = useState<string>("");
  const [summary, setSummary] = useState<DailySummary | null>(null);
  const [payments, setPayments] = useState<DailyPayment[]>([]);
  const [libraryName, setLibraryName] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [editingReceipt, setEditingReceipt] = useState<EditableReceipt | null>(null);

  // Fetch library details for dynamic branding
  useEffect(() => {
    if (slug && slug !== "target-library") {
      fetch(`/api/libraries/${encodeURIComponent(slug)}/settings`)
        .then((r) => r.json())
        .then((d) => {
          if (d.library?.name) setLibraryName(d.library.name);
        })
        .catch(() => {});
    }
  }, [slug]);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | "new" | "renewal">("all");
  const [shiftFilter, setShiftFilter] = useState<string>("all");
  const [modeFilter, setModeFilter] = useState<"all" | "cash" | "online">("all");

  const todayIST = getTodayIST();
  const isToday = selectedDate === todayIST;

  const fetchCollections = async (date: string, isManualRefresh = false) => {
    if (isManualRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/collections?date=${date}&slug=${encodeURIComponent(slug)}`);
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "Failed to load daily collections");
      }
      const data = await res.json();
      setSummary(data.summary);
      setPayments(data.payments || []);
      setLastUpdated(
        new Intl.DateTimeFormat("en-IN", {
          timeZone: "Asia/Kolkata",
          hour: "numeric",
          minute: "2-digit",
          second: "2-digit",
          hour12: true,
        }).format(new Date())
      );
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error fetching data");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchCollections(selectedDate);
  }, [slug, selectedDate]);

  // Date Navigation Helpers
  const handlePrevDay = () => {
    const current = new Date(`${selectedDate}T00:00:00`);
    current.setDate(current.getDate() - 1);
    setSelectedDate(current.toISOString().split("T")[0]);
  };

  const handleNextDay = () => {
    const current = new Date(`${selectedDate}T00:00:00`);
    current.setDate(current.getDate() + 1);
    setSelectedDate(current.toISOString().split("T")[0]);
  };

  const handleResetToday = () => {
    setSelectedDate(todayIST);
  };

  // Filtered Payments
  const filteredPayments = useMemo(() => {
    return payments.filter((p) => {
      // Search
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        p.student_name.toLowerCase().includes(q) ||
        p.student_id.toString().includes(q) ||
        p.seat_number.toString().includes(q) ||
        (p.student_phone && p.student_phone.includes(q));

      if (!matchesSearch) return false;

      // Type Filter
      if (typeFilter === "new" && !p.is_new_admission) return false;
      if (typeFilter === "renewal" && p.is_new_admission) return false;

      // Shift Filter
      if (shiftFilter !== "all") {
        if (shiftFilter === "full_day" && p.subscription_type !== "full_day") return false;
        if (shiftFilter === "shift_1" && p.shift_type !== "shift_1" && p.shift_type !== "morning") return false;
        if (shiftFilter === "shift_2" && p.shift_type !== "shift_2" && p.shift_type !== "evening") return false;
        if (shiftFilter === "shift_3" && p.shift_type !== "shift_3") return false;
      }

      // Payment Mode Filter
      if (modeFilter !== "all") {
        const mode = p.payment_mode || "cash";
        if (modeFilter !== mode) return false;
      }

      return true;
    });
  }, [payments, searchQuery, typeFilter, shiftFilter, modeFilter]);

  // Export CSV
  const handleExportCSV = () => {
    if (!payments.length) return;
    const headers = [
      "Receipt No",
      "Payment Time",
      "Student ID",
      "Student Name",
      "Phone",
      "Seat No",
      "Subscription",
      "Shift",
      "Desk Sheet",
      "Admission Type",
      "Payment Mode",
      "Amount (INR)",
      "Start Date",
      "End Date",
    ];

    const rows = payments.map((p) => [
      p.receipt_no,
      p.payment_time,
      p.student_id,
      `"${p.student_name.replace(/"/g, '""')}"`,
      p.student_phone || "",
      p.seat_number,
      p.subscription_type,
      p.shift_type || "N/A",
      p.has_sheet ? "Yes" : "No",
      p.is_new_admission ? "New Admission" : "Renewal",
      p.payment_mode === "online" ? "Online (UPI)" : "Cash",
      p.amount_paid,
      p.start_date,
      p.end_date,
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `daily_collections_${selectedDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrint = () => {
    window.print();
  };

  // Human readable date
  const displayDateText = (() => {
    try {
      const d = new Date(`${selectedDate}T00:00:00`);
      return new Intl.DateTimeFormat("en-IN", {
        weekday: "short",
        year: "numeric",
        month: "short",
        day: "numeric",
      }).format(d);
    } catch {
      return selectedDate;
    }
  })();

  return (
    <main className="min-h-screen pb-20 pt-6 px-4 md:px-8 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-panel-border pb-6 print:hidden">
        <div>
          <div className="flex items-center gap-3">
            <Link
              href={`/l/${slug}`}
              className="px-2.5 py-1 rounded-xl border border-panel-border bg-card-bg hover:bg-neutral-500/10 text-xs font-bold transition"
            >
              ← Desk Portal
            </Link>
            <span className="text-2xl">💰</span>
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">
              Daily Fee Collections
            </h1>
            {isToday && (
              <span className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-xs px-2.5 py-0.5 rounded-full font-semibold flex items-center gap-1.5 animate-pulse">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                LIVE TODAY
              </span>
            )}
          </div>
          <p className="text-sm text-text-muted mt-1">
            Real-time ledger of all student fee entries, seat renewals, and new admissions.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => fetchCollections(selectedDate, true)}
            disabled={refreshing}
            className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl bg-card-bg border border-panel-border hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-all cursor-pointer disabled:opacity-50"
            title="Refresh list"
          >
            <span className={`inline-block ${refreshing ? "animate-spin" : ""}`}>🔄</span>
            {refreshing ? "Refreshing..." : "Refresh"}
          </button>

          <button
            onClick={handleExportCSV}
            disabled={!payments.length}
            className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl bg-card-bg border border-panel-border hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-all cursor-pointer disabled:opacity-40"
          >
            📥 Export CSV
          </button>

          <button
            onClick={handlePrint}
            disabled={!payments.length}
            className="flex items-center gap-1.5 text-xs font-semibold px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white shadow-sm transition-all cursor-pointer disabled:opacity-40"
          >
            🖨️ Print Daily Slip
          </button>
        </div>
      </div>

      {/* Date Navigation Bar */}
      <div className="my-6 bg-card-bg/60 backdrop-blur-md border border-panel-border rounded-2xl p-4 flex flex-col md:flex-row items-center justify-between gap-4 print:hidden shadow-sm">
        <div className="flex items-center gap-2 w-full md:w-auto justify-between md:justify-start">
          <button
            onClick={handlePrevDay}
            className="px-3 py-1.5 rounded-xl border border-panel-border bg-card-bg hover:bg-neutral-100 dark:hover:bg-neutral-800 text-xs font-medium transition cursor-pointer"
          >
            ← Prev Day
          </button>

          <input
            type="date"
            value={selectedDate}
            onChange={(e) => e.target.value && setSelectedDate(e.target.value)}
            className="bg-card-bg border border-panel-border text-sm font-semibold rounded-xl px-3 py-1.5 text-text-main focus:outline-none focus:ring-2 focus:ring-rose-500"
          />

          <button
            onClick={handleNextDay}
            className="px-3 py-1.5 rounded-xl border border-panel-border bg-card-bg hover:bg-neutral-100 dark:hover:bg-neutral-800 text-xs font-medium transition cursor-pointer"
          >
            Next Day →
          </button>

          {!isToday && (
            <button
              onClick={handleResetToday}
              className="px-3 py-1.5 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 text-xs font-bold hover:bg-rose-500/20 transition cursor-pointer"
            >
              Back to Today
            </button>
          )}
        </div>

        <div className="flex items-center gap-3 text-xs text-text-muted">
          <span className="font-semibold text-text-main text-sm">{displayDateText}</span>
          {lastUpdated && (
            <span className="hidden sm:inline text-neutral-400">
              • Synced at {lastUpdated}
            </span>
          )}
        </div>
      </div>

      {/* Print-Only Header */}
      <div className="hidden print:block mb-6 border-b pb-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black tracking-wider">THE TARGET LIBRARY</h1>
            <p className="text-xs text-neutral-600">Daily Cash Collections & Fee Register</p>
          </div>
          <div className="text-right">
            <p className="font-bold text-sm">Date: {displayDateText}</p>
            <p className="text-xs text-neutral-600">Printed: {new Date().toLocaleTimeString()}</p>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5 mb-6">
        {/* Total Collected */}
        <div className="bg-card-bg border border-panel-border rounded-2xl p-4 shadow-sm relative overflow-hidden">
          <div className="text-xs font-medium text-text-muted uppercase tracking-wider">
            Total Fees
          </div>
          <div className="text-2xl sm:text-3xl font-black text-text-main mt-1 tracking-tight">
            ₹{(summary?.total_collected || 0).toLocaleString("en-IN")}
          </div>
          <div className="text-[11px] text-text-muted mt-1 flex items-center gap-1">
            <span>{summary?.total_students || 0} receipts</span>
            {summary?.with_sheet_count ? (
              <span className="text-amber-600 dark:text-amber-400">
                • {summary.with_sheet_count} sheet
              </span>
            ) : null}
          </div>
        </div>

        {/* Cash in Hand */}
        <div className="bg-card-bg border border-emerald-500/20 bg-emerald-500/5 rounded-2xl p-4 shadow-sm relative overflow-hidden">
          <div className="text-xs font-medium text-emerald-600 dark:text-emerald-400 uppercase tracking-wider flex items-center justify-between">
            <span>Cash in Hand</span>
            <span>💵</span>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-emerald-600 dark:text-emerald-400 mt-1 tracking-tight">
            ₹{(summary?.cash_collected || 0).toLocaleString("en-IN")}
          </div>
          <div className="text-[11px] text-emerald-600/70 dark:text-emerald-400/70 mt-1">
            {summary?.cash_count || 0} cash {summary?.cash_count === 1 ? "payment" : "payments"}
          </div>
        </div>

        {/* Online / UPI */}
        <div className="bg-card-bg border border-indigo-500/20 bg-indigo-500/5 rounded-2xl p-4 shadow-sm relative overflow-hidden">
          <div className="text-xs font-medium text-indigo-600 dark:text-indigo-400 uppercase tracking-wider flex items-center justify-between">
            <span>Online / UPI</span>
            <span>📱</span>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-indigo-600 dark:text-indigo-400 mt-1 tracking-tight">
            ₹{(summary?.online_collected || 0).toLocaleString("en-IN")}
          </div>
          <div className="text-[11px] text-indigo-600/70 dark:text-indigo-400/70 mt-1">
            {summary?.online_count || 0} online {summary?.online_count === 1 ? "payment" : "payments"}
          </div>
        </div>

        {/* Total Students */}
        <div className="bg-card-bg border border-panel-border rounded-2xl p-4 shadow-sm">
          <div className="text-xs font-medium text-text-muted uppercase tracking-wider">
            Students Paid
          </div>
          <div className="text-2xl sm:text-3xl font-black text-text-main mt-1 tracking-tight">
            {summary?.total_students || 0}
          </div>
          <div className="text-[11px] text-text-muted mt-1">
            {summary?.unique_members || 0} unique students
          </div>
        </div>

        {/* New Admissions */}
        <div className="bg-card-bg border border-panel-border rounded-2xl p-4 shadow-sm">
          <div className="text-xs font-medium text-text-muted uppercase tracking-wider flex items-center justify-between">
            <span>New Admission</span>
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-emerald-600 dark:text-emerald-400 mt-1 tracking-tight">
            {summary?.new_admissions_count || 0}
          </div>
          <div className="text-[11px] text-text-muted mt-1">
            New enrollments
          </div>
        </div>

        {/* Renewals */}
        <div className="bg-card-bg border border-panel-border rounded-2xl p-4 shadow-sm">
          <div className="text-xs font-medium text-text-muted uppercase tracking-wider flex items-center justify-between">
            <span>Seat Renewals</span>
            <span className="w-2 h-2 rounded-full bg-sky-500"></span>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-sky-600 dark:text-sky-400 mt-1 tracking-tight">
            {summary?.renewals_count || 0}
          </div>
          <div className="text-[11px] text-text-muted mt-1">
            Renewed members
          </div>
        </div>
      </div>

      {/* Search & Filter Toolbar */}
      <div className="bg-card-bg border border-panel-border rounded-2xl p-4 mb-6 print:hidden shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Search Input */}
        <div className="relative w-full md:w-72">
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted text-sm">
            🔍
          </span>
          <input
            type="text"
            placeholder="Search by name, ID #, or seat..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-background border border-panel-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 text-text-main"
          />
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-2 flex-wrap w-full md:w-auto">
          {/* Payment Mode Filter */}
          <div className="flex bg-background border border-panel-border rounded-xl p-1 text-xs">
            <button
              onClick={() => setModeFilter("all")}
              className={`px-3 py-1 rounded-lg font-medium transition cursor-pointer ${
                modeFilter === "all"
                  ? "bg-card-bg text-text-main font-semibold shadow-xs"
                  : "text-text-muted hover:text-text-main"
              }`}
            >
              All Modes
            </button>
            <button
              onClick={() => setModeFilter("cash")}
              className={`px-3 py-1 rounded-lg font-medium transition cursor-pointer flex items-center gap-1 ${
                modeFilter === "cash"
                  ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-semibold shadow-xs"
                  : "text-text-muted hover:text-text-main"
              }`}
            >
              💵 Cash ({summary?.cash_count || 0})
            </button>
            <button
              onClick={() => setModeFilter("online")}
              className={`px-3 py-1 rounded-lg font-medium transition cursor-pointer flex items-center gap-1 ${
                modeFilter === "online"
                  ? "bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 font-semibold shadow-xs"
                  : "text-text-muted hover:text-text-main"
              }`}
            >
              📱 Online ({summary?.online_count || 0})
            </button>
          </div>

          {/* Type Filter */}
          <div className="flex bg-background border border-panel-border rounded-xl p-1 text-xs">
            <button
              onClick={() => setTypeFilter("all")}
              className={`px-3 py-1 rounded-lg font-medium transition cursor-pointer ${
                typeFilter === "all"
                  ? "bg-card-bg text-text-main font-semibold shadow-xs"
                  : "text-text-muted hover:text-text-main"
              }`}
            >
              All Types
            </button>
            <button
              onClick={() => setTypeFilter("new")}
              className={`px-3 py-1 rounded-lg font-medium transition cursor-pointer flex items-center gap-1 ${
                typeFilter === "new"
                  ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-semibold shadow-xs"
                  : "text-text-muted hover:text-text-main"
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
              New ({summary?.new_admissions_count || 0})
            </button>
            <button
              onClick={() => setTypeFilter("renewal")}
              className={`px-3 py-1 rounded-lg font-medium transition cursor-pointer flex items-center gap-1 ${
                typeFilter === "renewal"
                  ? "bg-sky-500/15 text-sky-600 dark:text-sky-400 font-semibold shadow-xs"
                  : "text-text-muted hover:text-text-main"
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-sky-500"></span>
              Renewals ({summary?.renewals_count || 0})
            </button>
          </div>

          {/* Shift Filter Dropdown */}
          <select
            value={shiftFilter}
            onChange={(e) => setShiftFilter(e.target.value)}
            className="bg-background border border-panel-border rounded-xl px-3 py-1.5 text-xs text-text-main focus:outline-none focus:ring-2 focus:ring-rose-500 cursor-pointer"
          >
            <option value="all">All Shifts</option>
            <option value="full_day">Full Day (6 AM - 12 AM)</option>
            <option value="shift_1">Shift 1 (6 AM - 2 PM)</option>
            <option value="shift_2">Shift 2 (2 PM - 12 AM)</option>
            <option value="shift_3">Shift 3 (4 PM - 12 AM)</option>
          </select>
        </div>
      </div>

      {/* Main Table / Content Section */}
      {loading ? (
        <div className="bg-card-bg border border-panel-border rounded-2xl p-16 text-center shadow-sm">
          <div className="w-8 h-8 border-3 border-rose-500 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
          <p className="text-sm text-text-muted font-medium">Fetching collections for {displayDateText}...</p>
        </div>
      ) : error ? (
        <div className="bg-rose-500/10 border border-rose-500/30 rounded-2xl p-6 text-center text-rose-600 dark:text-rose-400">
          <p className="font-semibold text-sm">Failed to load data: {error}</p>
          <button
            onClick={() => fetchCollections(selectedDate)}
            className="mt-3 px-4 py-1.5 text-xs bg-rose-600 text-white rounded-xl font-semibold hover:bg-rose-500 transition cursor-pointer"
          >
            Try Again
          </button>
        </div>
      ) : filteredPayments.length === 0 ? (
        <div className="bg-card-bg border border-panel-border rounded-2xl p-16 text-center shadow-sm">
          <div className="text-4xl mb-3">📭</div>
          <h3 className="text-lg font-bold text-text-main">No fee payments found</h3>
          <p className="text-xs text-text-muted max-w-sm mx-auto mt-1">
            {payments.length === 0
              ? `No students paid their fees on ${displayDateText}.`
              : "No payments match your current search and filter criteria."}
          </p>
          {isToday && payments.length === 0 && (
            <Link
              href="/new-receipt"
              className="inline-block mt-4 px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold rounded-xl transition"
            >
              + Generate New Receipt
            </Link>
          )}
        </div>
      ) : (
        <div className="bg-card-bg border border-panel-border rounded-2xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-panel-border bg-neutral-500/5 text-text-muted font-semibold uppercase tracking-wider">
                  <th className="py-3.5 px-4">Time</th>
                  <th className="py-3.5 px-4">Student</th>
                  <th className="py-3.5 px-4">ID</th>
                  <th className="py-3.5 px-4">Seat</th>
                  <th className="py-3.5 px-4">Plan / Shift</th>
                  <th className="py-3.5 px-4">Type</th>
                  <th className="py-3.5 px-4">Mode</th>
                  <th className="py-3.5 px-4 text-right">Amount</th>
                  <th className="py-3.5 px-4 text-center print:hidden">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-panel-border">
                {filteredPayments.map((p) => {
                  const shiftLabel =
                    p.subscription_type === "full_day"
                      ? "Full Day (6AM-12AM)"
                      : p.shift_type === "shift_1" || p.shift_type === "morning"
                      ? "Shift 1 (6AM-2PM)"
                      : p.shift_type === "shift_2" || p.shift_type === "evening"
                      ? "Shift 2 (2PM-12AM)"
                      : p.shift_type === "shift_3"
                      ? "Shift 3 (4PM-12AM)"
                      : "Half Day";

                  const modeText = p.payment_mode === "online" ? "Online (UPI)" : "Cash";
                  const libDisplayName = libraryName || (slug !== "target-library" ? slug.replace(/-/g, " ").toUpperCase() : "The Target Library");
                  const whatsappMessage = encodeURIComponent(
                    `Hello ${p.student_name.trim()}! Your fee payment of ₹${p.amount_paid} (${modeText}) for Seat #${p.seat_number} at ${libDisplayName} has been recorded.\n\nView Pass & Receipt: ${window?.location?.origin || ""}/receipts/${p.receipt_no}`
                  );

                  return (
                    <tr
                      key={p.receipt_no}
                      className="hover:bg-neutral-500/5 transition-colors group"
                    >
                      {/* Time */}
                      <td className="py-3.5 px-4 whitespace-nowrap font-medium text-text-muted">
                        {p.payment_time || "—"}
                      </td>

                      {/* Student Name & Phone */}
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-text-main text-sm">
                          {p.student_name}
                        </div>
                        {p.student_phone && (
                          <a
                            href={`tel:${p.student_phone}`}
                            className="text-[11px] text-text-muted hover:text-rose-500 transition"
                          >
                            📞 {p.student_phone}
                          </a>
                        )}
                      </td>

                      {/* Student ID */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className="font-mono bg-neutral-500/10 px-2 py-0.5 rounded-md font-semibold text-text-main text-[11px]">
                          #{p.student_id}
                        </span>
                      </td>

                      {/* Seat Number */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className="font-bold text-xs bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 px-2.5 py-1 rounded-lg">
                          Seat {p.seat_number}
                        </span>
                      </td>

                      {/* Shift & Sheet */}
                      <td className="py-3.5 px-4">
                        <div className="font-medium text-text-main">{shiftLabel}</div>
                        {p.has_sheet && (
                          <span className="inline-block mt-0.5 text-[10px] bg-amber-500/15 text-amber-600 dark:text-amber-400 px-1.5 py-0.5 rounded font-medium">
                            + Desk Sheet
                          </span>
                        )}
                      </td>

                      {/* New vs Renewal */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {p.is_new_admission ? (
                          <span className="inline-flex items-center gap-1 bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 text-[11px] font-semibold px-2 py-0.5 rounded-full">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                            New Admission
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 bg-sky-500/15 text-sky-700 dark:text-sky-400 border border-sky-500/20 text-[11px] font-semibold px-2 py-0.5 rounded-full">
                            <span className="w-1.5 h-1.5 rounded-full bg-sky-500"></span>
                            Renewal
                          </span>
                        )}
                      </td>

                      {/* Payment Mode */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {p.payment_mode === "online" ? (
                          <span className="inline-flex items-center gap-1 bg-indigo-500/15 text-indigo-700 dark:text-indigo-400 border border-indigo-500/20 text-[11px] font-semibold px-2 py-0.5 rounded-full">
                            📱 Online
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 text-[11px] font-semibold px-2 py-0.5 rounded-full">
                            💵 Cash
                          </span>
                        )}
                      </td>

                      {/* Amount Paid */}
                      <td className="py-3.5 px-4 whitespace-nowrap text-right font-black text-sm text-emerald-600 dark:text-emerald-400">
                        ₹{p.amount_paid.toLocaleString("en-IN")}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 whitespace-nowrap text-center print:hidden">
                        <div className="flex items-center justify-center gap-1.5">
                          <Link
                            href={`/receipts/${p.receipt_no}`}
                            target="_blank"
                            className="px-2.5 py-1 rounded-lg bg-card-bg border border-panel-border hover:bg-neutral-100 dark:hover:bg-neutral-800 text-[11px] font-semibold transition"
                            title="View Receipt & Pass"
                          >
                            🎟️ Pass
                          </Link>

                          <button
                            type="button"
                            onClick={() =>
                              setEditingReceipt({
                                receipt_no: p.receipt_no,
                                student_id: p.student_id,
                                student_name: p.student_name,
                                student_phone: p.student_phone,
                                seat_id: p.seat_id,
                                seat_number: p.seat_number,
                                subscription_type: p.subscription_type,
                                shift_type: p.shift_type,
                                has_sheet: p.has_sheet,
                                amount_paid: p.amount_paid,
                                payment_mode: p.payment_mode || "cash",
                                start_date: p.start_date,
                                end_date: p.end_date,
                              })
                            }
                            className="px-2.5 py-1 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-400 border border-amber-500/20 text-[11px] font-semibold transition cursor-pointer"
                            title="Owner: Edit plan, fees, or cancel subscription"
                          >
                            ✏️ Edit
                          </button>

                          {p.student_phone && (
                            <a
                              href={`https://wa.me/91${p.student_phone.replace(/\D/g, "")}?text=${whatsappMessage}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-2 py-1 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 text-[11px] font-semibold transition"
                              title="Share on WhatsApp"
                            >
                              💬 WA
                            </a>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Table Footer */}
          <div className="p-4 bg-neutral-500/5 border-t border-panel-border flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-text-muted">
            <div>
              Showing <span className="font-bold text-text-main">{filteredPayments.length}</span> of{" "}
              <span className="font-bold text-text-main">{payments.length}</span> payments on {displayDateText}
            </div>
            <div className="font-semibold text-text-main text-sm">
              Day Subtotal:{" "}
              <span className="text-emerald-600 dark:text-emerald-400 font-extrabold">
                ₹{filteredPayments.reduce((sum, p) => sum + p.amount_paid, 0).toLocaleString("en-IN")}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Owner Edit Receipt Modal */}
      {editingReceipt && (
        <EditReceiptModal
          receipt={editingReceipt}
          isOpen={!!editingReceipt}
          onClose={() => setEditingReceipt(null)}
          onSuccess={() => fetchCollections(selectedDate, true)}
        />
      )}
    </main>
  );
}

export default function DailyCollectionsPage() {
  return (
    <Suspense fallback={<div className="p-12 text-center text-xs text-text-muted">Loading collections ledger...</div>}>
      <DailyCollectionsContent />
    </Suspense>
  );
}
