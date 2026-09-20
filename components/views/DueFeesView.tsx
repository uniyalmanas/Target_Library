"use client";

import { Suspense, useEffect, useState, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import EditReceiptModal, { EditableReceipt } from "@/lib/EditReceiptModal";
import { downloadCsv } from "@/lib/exportCsv";
import { generateDueFeeWhatsAppMessage } from "@/lib/upi";
import DynamicUpiModal from "@/lib/DynamicUpiModal";
import { ShiftConfig } from "@/lib/types";
import { getShiftDisplayLabel, sortShiftsChronologically, getShiftNameWithTiming } from "@/lib/shifts";
import { DEFAULT_SHIFTS } from "@/lib/tenant";

interface DueCandidate {
  receipt_no: number;
  student_id: number;
  seat_id: number;
  seat_number: number;
  student_name: string;
  student_phone: string | null;
  aadhar_no: string | null;
  subscription_type: "full_day" | "half_day";
  shift_type: string | null;
  has_sheet: boolean;
  amount_paid: number;
  start_date: string;
  end_date: string;
  days_overdue: number;
  is_vacated: boolean;
  created_at: string;
}

interface DueSummary {
  total_due: number;
  days_1_to_3: number;
  days_4_to_7: number;
  days_7_plus: number;
  estimated_pending_fees: number;
}

export function DueFeesContent({ tenantSlug }: { tenantSlug?: string }) {
  const searchParams = useSearchParams();
  const slug = tenantSlug || searchParams.get("slug") || "target-library";

  const [candidates, setCandidates] = useState<DueCandidate[]>([]);
  const [summary, setSummary] = useState<DueSummary | null>(null);
  const [libraryName, setLibraryName] = useState<string>("");
  const [libraryInfo, setLibraryInfo] = useState<{
    name: string;
    slug: string;
    upi_id: string;
    upi_name?: string;
  }>({
    name: "The Target Library",
    slug: "target-library",
    upi_id: "targetlibrary@upi",
    upi_name: "The Target Library",
  });
  const [selectedUpiCandidate, setSelectedUpiCandidate] = useState<DueCandidate | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [vacatingId, setVacatingId] = useState<number | null>(null);
  const [editingReceipt, setEditingReceipt] = useState<EditableReceipt | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [tabFilter, setTabFilter] = useState<"all" | "1_3" | "4_7" | "7_plus">("all");
  const [shiftFilter, setShiftFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<"overdue_desc" | "overdue_asc" | "seat" | "name">("overdue_desc");

  const [shiftsConfig, setShiftsConfig] = useState<ShiftConfig[]>([]);

  // Fetch library details for dynamic branding, shifts, and UPI configurations
  useEffect(() => {
    fetch(`/api/libraries/${encodeURIComponent(slug)}/settings`)
      .then((r) => r.json())
      .then((d) => {
        if (d.library) {
          setLibraryInfo({
            name: d.library.name || "Study Library",
            slug: d.library.slug || slug,
            upi_id: d.library.upi_id || "targetlibrary@upi",
            upi_name: d.library.upi_name || d.library.name || "Study Library",
          });
          setLibraryName(d.library.name || "");
        }
        if (d.settings?.shifts_config && d.settings.shifts_config.length > 0) {
          setShiftsConfig(sortShiftsChronologically(d.settings.shifts_config));
        }
      })
      .catch(() => {});
  }, [slug]);

  const fetchDueFees = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const res = await fetch(`/api/due-fees?slug=${encodeURIComponent(slug)}`);
      if (res.ok) {
        const data = await res.json();
        setCandidates(data.candidates || []);
        setSummary(data.summary || null);
      }
    } catch (err) {
      console.error("Failed to fetch due fees:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchDueFees();
  }, [slug]);

  const shiftLabel = (shift: string | null, subType: string) => {
    return getShiftDisplayLabel(
      shift,
      subType,
      shiftsConfig.length > 0 ? shiftsConfig : DEFAULT_SHIFTS
    );
  };

  const handleVacate = async (candidate: DueCandidate) => {
    const confirmMsg = `Are you sure you want to officially vacate Seat ${candidate.seat_number} for ${candidate.student_name}?\n\nThe seat will immediately turn GREEN and become available for new bookings.`;
    if (!confirm(confirmMsg)) return;

    setVacatingId(candidate.receipt_no);
    try {
      const res = await fetch("/api/receipts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ receipt_no: candidate.receipt_no }),
      });

      if (res.ok) {
        // Remove vacated candidate from local state immediately
        setCandidates((prev) => prev.filter((c) => c.receipt_no !== candidate.receipt_no));
        // Refresh full data in background
        fetchDueFees(true);
      } else {
        const errorData = await res.json().catch(() => ({}));
        alert(`Error: ${errorData.error || "Failed to vacate seat"}`);
      }
    } catch (err: any) {
      alert(`Error: ${err.message || "Failed to vacate seat"}`);
    } finally {
      setVacatingId(null);
    }
  };

  const getRenewUrl = (c: DueCandidate) => {
    const today = new Date().toISOString().split("T")[0];
    const params = new URLSearchParams({
      student_id: c.student_id.toString(),
      seat_number: c.seat_number.toString(),
      subscription_type: c.subscription_type,
      shift_type: c.shift_type || "",
      has_sheet: c.has_sheet.toString(),
      amount: c.amount_paid.toString(),
      start_date: today,
      slug: slug,
    });
    return `/l/${encodeURIComponent(slug)}/new-receipt?${params.toString()}`;
  };

  const getWhatsAppReminderUrl = (c: DueCandidate) => {
    if (!c.student_phone) return "#";
    const phone = c.student_phone.replace(/[^0-9]/g, "").slice(-10);
    const passUrl = typeof window !== "undefined"
      ? `${window.location.origin}/receipts/${c.receipt_no}`
      : undefined;
    const message = generateDueFeeWhatsAppMessage({
      studentName: c.student_name,
      studentPhone: phone,
      seatNumber: c.seat_number,
      shiftName: shiftLabel(c.shift_type, c.subscription_type),
      daysOverdue: c.days_overdue,
      expiryDate: c.end_date,
      amountDue: c.amount_paid,
      libraryName: libraryInfo.name,
      upiId: libraryInfo.upi_id,
      upiName: libraryInfo.upi_name,
      digitalPassUrl: passUrl,
    });
    return `https://wa.me/91${phone}?text=${encodeURIComponent(message)}`;
  };

  // Filtered & Sorted Candidates
  const filteredCandidates = useMemo(() => {
    return candidates
      .filter((c) => {
        // Search Filter
        const q = searchQuery.toLowerCase().trim();
        const matchesSearch =
          !q ||
          c.student_name.toLowerCase().includes(q) ||
          c.student_id.toString().includes(q) ||
          c.seat_number.toString().includes(q) ||
          (c.student_phone && c.student_phone.includes(q)) ||
          (c.aadhar_no && c.aadhar_no.includes(q));

        if (!matchesSearch) return false;

        // Overdue Interval Tab Filter
        if (tabFilter === "1_3" && (c.days_overdue < 1 || c.days_overdue > 3)) return false;
        if (tabFilter === "4_7" && (c.days_overdue < 4 || c.days_overdue > 7)) return false;
        if (tabFilter === "7_plus" && c.days_overdue < 8) return false;

        // Shift Filter
        if (shiftFilter !== "all") {
          if (shiftFilter === "full_day") {
            if (c.subscription_type !== "full_day") return false;
          } else {
            if (c.subscription_type === "full_day") return false;
            const matches =
              c.shift_type === shiftFilter ||
              (shiftFilter === "shift_1" && c.shift_type === "morning") ||
              (shiftFilter === "shift_2" && c.shift_type === "evening");
            if (!matches) return false;
          }
        }

        return true;
      })
      .sort((a, b) => {
        if (sortBy === "overdue_desc") return b.days_overdue - a.days_overdue;
        if (sortBy === "overdue_asc") return a.days_overdue - b.days_overdue;
        if (sortBy === "seat") return a.seat_number - b.seat_number;
        if (sortBy === "name") return a.student_name.localeCompare(b.student_name);
        return 0;
      });
  }, [candidates, searchQuery, tabFilter, shiftFilter, sortBy]);

  // Export CSV
  const handleExportCSV = () => {
    if (!filteredCandidates.length) {
      alert("No overdue candidates to export.");
      return;
    }

    const headers = [
      "Student ID",
      "Student Name",
      "Phone",
      "Aadhaar No",
      "Seat #",
      "Shift",
      "Last Paid Amount (₹)",
      "Expiry Date",
      "Days Overdue",
      "Receipt #",
    ];

    const rows = filteredCandidates.map((c) => [
      c.student_id,
      c.student_name,
      c.student_phone ? `="${c.student_phone}"` : "",
      c.aadhar_no ? `="${c.aadhar_no}"` : "",
      c.seat_number,
      shiftLabel(c.shift_type, c.subscription_type),
      c.amount_paid,
      c.end_date,
      c.days_overdue,
      c.receipt_no,
    ]);

    const today = new Date().toISOString().split("T")[0];
    const cleanSlug = slug || "library";
    downloadCsv({
      filename: `${cleanSlug}_Overdue_Fees_Report_${today}.csv`,
      headers,
      rows,
    });
  };

  return (
    <div className="w-full max-w-[96vw] 2xl:max-w-[1750px] mx-auto px-4 md:px-8 pb-20 pt-4 space-y-6">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-panel-border pb-6">
        <div>
          <div className="flex items-center gap-3">
            <span className="text-2xl">🔵</span>
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">
              Due Fees & Expired Subscriptions
            </h1>
          </div>
          <p className="text-sm text-text-muted mt-1">
            Track students whose study space validity has expired. Send instant WhatsApp reminders, generate dynamic UPI payment links, or vacate seats.
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={() => fetchDueFees(true)}
            disabled={refreshing}
            className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl bg-card-bg border border-panel-border hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-all cursor-pointer disabled:opacity-50"
            title="Refresh list"
          >
            <span className={`inline-block ${refreshing ? "animate-spin" : ""}`}>🔄</span>
            {refreshing ? "Refreshing..." : "Refresh"}
          </button>

          <button
            onClick={handleExportCSV}
            disabled={!filteredCandidates.length}
            className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl bg-card-bg border border-panel-border hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-all cursor-pointer disabled:opacity-40"
          >
            📥 Export CSV ({filteredCandidates.length})
          </button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-card-bg border border-panel-border rounded-2xl p-4 shadow-sm">
          <div className="text-xs font-medium text-text-muted uppercase tracking-wider">Total Due Seats</div>
          <div className="text-3xl font-black text-blue-600 dark:text-blue-400 mt-1">
            {summary?.total_due || 0}
          </div>
          <div className="text-[11px] text-text-muted mt-1">Expired seats held on desk</div>
        </div>

        <div className="bg-card-bg border border-amber-500/20 bg-amber-500/5 rounded-2xl p-4 shadow-sm">
          <div className="text-xs font-medium text-amber-600 dark:text-amber-400 uppercase tracking-wider">1 - 3 Days Overdue</div>
          <div className="text-3xl font-black text-amber-600 dark:text-amber-400 mt-1">
            {summary?.days_1_to_3 || 0}
          </div>
          <div className="text-[11px] text-amber-600/70 dark:text-amber-400/70 mt-1">Grace period / soft reminder</div>
        </div>

        <div className="bg-card-bg border border-orange-500/20 bg-orange-500/5 rounded-2xl p-4 shadow-sm">
          <div className="text-xs font-medium text-orange-600 dark:text-orange-400 uppercase tracking-wider">4 - 7 Days Overdue</div>
          <div className="text-3xl font-black text-orange-600 dark:text-orange-400 mt-1">
            {summary?.days_4_to_7 || 0}
          </div>
          <div className="text-[11px] text-orange-600/70 dark:text-orange-400/70 mt-1">Urgent reminder needed</div>
        </div>

        <div className="bg-card-bg border border-rose-500/20 bg-rose-500/5 rounded-2xl p-4 shadow-sm">
          <div className="text-xs font-medium text-rose-600 dark:text-rose-400 uppercase tracking-wider">7+ Days Overdue</div>
          <div className="text-3xl font-black text-rose-600 dark:text-rose-400 mt-1">
            {summary?.days_7_plus || 0}
          </div>
          <div className="text-[11px] text-rose-600/70 dark:text-rose-400/70 mt-1">Candidates to vacate seat</div>
        </div>
      </div>

      {/* Filter and Search Toolbar */}
      <div className="bg-card-bg border border-panel-border rounded-2xl p-4 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Search */}
        <div className="relative w-full md:w-80">
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted text-sm">🔍</span>
          <input
            type="text"
            placeholder="Search by student, phone, or seat #..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-background border border-panel-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 text-text-main"
          />
        </div>

        {/* Tab Filters & Shift Filter */}
        <div className="flex items-center gap-2 flex-wrap w-full md:w-auto">
          {/* Overdue Days Pill Tabs */}
          <div className="flex bg-background border border-panel-border rounded-xl p-1 text-xs">
            <button
              onClick={() => setTabFilter("all")}
              className={`px-3 py-1 rounded-lg font-medium transition cursor-pointer ${
                tabFilter === "all"
                  ? "bg-card-bg text-text-main font-semibold shadow-xs"
                  : "text-text-muted hover:text-text-main"
              }`}
            >
              All Overdue ({summary?.total_due || 0})
            </button>
            <button
              onClick={() => setTabFilter("1_3")}
              className={`px-3 py-1 rounded-lg font-medium transition cursor-pointer ${
                tabFilter === "1_3"
                  ? "bg-amber-500/15 text-amber-700 dark:text-amber-400 font-semibold shadow-xs"
                  : "text-text-muted hover:text-text-main"
              }`}
            >
              1-3 Days ({summary?.days_1_to_3 || 0})
            </button>
            <button
              onClick={() => setTabFilter("4_7")}
              className={`px-3 py-1 rounded-lg font-medium transition cursor-pointer ${
                tabFilter === "4_7"
                  ? "bg-orange-500/15 text-orange-700 dark:text-orange-400 font-semibold shadow-xs"
                  : "text-text-muted hover:text-text-main"
              }`}
            >
              4-7 Days ({summary?.days_4_to_7 || 0})
            </button>
            <button
              onClick={() => setTabFilter("7_plus")}
              className={`px-3 py-1 rounded-lg font-medium transition cursor-pointer ${
                tabFilter === "7_plus"
                  ? "bg-rose-500/15 text-rose-700 dark:text-rose-400 font-semibold shadow-xs"
                  : "text-text-muted hover:text-text-main"
              }`}
            >
              7+ Days ({summary?.days_7_plus || 0})
            </button>
          </div>

          {/* Shift Filter */}
          <select
            value={shiftFilter}
            onChange={(e) => setShiftFilter(e.target.value)}
            className="bg-background border border-panel-border rounded-xl px-3 py-1.5 text-xs text-text-main focus:outline-none focus:ring-2 focus:ring-rose-500 cursor-pointer"
          >
            <option value="all">All Shifts</option>
            {shiftsConfig.length > 0 ? (
              shiftsConfig.map((s) => (
                <option key={s.id} value={s.id}>
                  {getShiftNameWithTiming(s)}
                </option>
              ))
            ) : (
              <>
                <option value="full_day">Full Day (6am-12am)</option>
                <option value="shift_1">Shift 1 (6am-2pm)</option>
                <option value="shift_2">Shift 2 (2pm-12am)</option>
                <option value="shift_3">Shift 3 (4pm-12am)</option>
              </>
            )}
          </select>

          {/* Sort By */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="bg-background border border-panel-border rounded-xl px-3 py-1.5 text-xs text-text-main focus:outline-none focus:ring-2 focus:ring-rose-500 cursor-pointer"
          >
            <option value="overdue_desc">Most Overdue First</option>
            <option value="overdue_asc">Least Overdue First</option>
            <option value="seat">Seat Number</option>
            <option value="name">Student Name</option>
          </select>
        </div>
      </div>

      {/* Main Table / Candidates List */}
      {loading ? (
        <div className="bg-card-bg border border-panel-border rounded-2xl p-16 text-center shadow-sm">
          <div className="w-8 h-8 border-3 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
          <p className="text-sm text-text-muted font-medium">Scanning active database for overdue subscriptions...</p>
        </div>
      ) : filteredCandidates.length === 0 ? (
        <div className="bg-card-bg border border-panel-border rounded-2xl p-16 text-center shadow-sm">
          <div className="text-4xl mb-3">🎉</div>
          <h3 className="text-lg font-bold text-text-main">No pending due fees found!</h3>
          <p className="text-xs text-text-muted max-w-sm mx-auto mt-1">
            {candidates.length === 0
              ? "All active students have up-to-date subscriptions. Outstanding dues are zero!"
              : "No overdue students match your current search and filter settings."}
          </p>
        </div>
      ) : (
        <div className="bg-card-bg border border-panel-border rounded-2xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-panel-border bg-neutral-500/5 text-text-muted font-semibold uppercase tracking-wider">
                  <th className="py-3.5 px-4">Seat #</th>
                  <th className="py-3.5 px-4">Student</th>
                  <th className="py-3.5 px-4">Phone / Aadhaar</th>
                  <th className="py-3.5 px-4">Shift &amp; Plan</th>
                  <th className="py-3.5 px-4">Expired On</th>
                  <th className="py-3.5 px-4">Overdue Days</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-panel-border">
                {filteredCandidates.map((c) => {
                  const is1to3 = c.days_overdue <= 3;
                  const is4to7 = c.days_overdue > 3 && c.days_overdue <= 7;

                  return (
                    <tr key={c.receipt_no} className="hover:bg-neutral-500/5 transition-colors group">
                      {/* Seat Number */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className="inline-flex items-center justify-center font-mono font-black text-sm bg-blue-100 text-blue-950 border border-blue-400 dark:bg-blue-500/15 dark:text-blue-300 dark:border-blue-500/30 w-10 h-10 rounded-lg shadow-2xs">
                          {c.seat_number}
                        </span>
                      </td>

                      {/* Candidate Name */}
                      <td className="py-3.5 px-4">
                        <Link
                          href={`/l/${encodeURIComponent(slug)}/members/${c.student_id}`}
                          className="font-bold text-foreground hover:text-blue-500 transition-colors block text-sm"
                        >
                          {c.student_name}
                        </Link>
                        <span className="text-[10px] font-mono text-text-muted">ID: #{c.student_id}</span>
                      </td>

                      {/* Contact & Aadhaar */}
                      <td className="py-3.5 px-4">
                        {c.student_phone ? (
                          <div className="font-mono text-xs font-semibold text-foreground">
                            {c.student_phone}
                          </div>
                        ) : (
                          <span className="text-text-muted italic">No phone</span>
                        )}
                        {c.aadhar_no && (
                          <div className="text-[10px] font-mono text-text-muted mt-0.5">
                            Aadhaar: •••• {c.aadhar_no.replace(/\s+/g, "").slice(-4)}
                          </div>
                        )}
                      </td>

                      {/* Plan & Shift */}
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-foreground">
                          {shiftLabel(c.shift_type, c.subscription_type)}
                        </div>
                        <div className="text-[10px] text-text-muted mt-0.5">
                          Last Paid: ₹{c.amount_paid} {c.has_sheet ? "(With Sheet)" : ""}
                        </div>
                      </td>

                      {/* Expired On */}
                      <td className="py-3.5 px-4 whitespace-nowrap font-mono text-xs">
                        <div className="text-blue-600 dark:text-blue-400 font-semibold">{c.end_date}</div>
                        <div className="text-[10px] text-text-muted mt-0.5">Start: {c.start_date}</div>
                      </td>

                      {/* Overdue Days Badge */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-extrabold border ${
                            is1to3
                              ? "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30"
                              : is4to7
                                ? "bg-orange-500/15 text-orange-700 dark:text-orange-400 border-orange-500/30"
                                : "bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/30 animate-pulse"
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              is1to3 ? "bg-amber-500" : is4to7 ? "bg-orange-500" : "bg-rose-500"
                            }`}
                          />
                          {c.days_overdue} day{c.days_overdue === 1 ? "" : "s"} overdue
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-2">
                          {/* Dynamic UPI Intent & QR Modal */}
                          <button
                            onClick={() => setSelectedUpiCandidate(c)}
                            className="px-2.5 py-1.5 rounded-lg bg-blue-600/15 hover:bg-blue-600/25 text-blue-700 dark:text-blue-400 border border-blue-500/30 font-semibold transition-all hover:-translate-y-0.5 cursor-pointer flex items-center gap-1 text-xs"
                            title="Instant Dynamic UPI Intent & QR Code"
                          >
                            ⚡ UPI QR
                          </button>

                          {/* WhatsApp Reminder */}
                          {c.student_phone && (
                            <a
                              href={getWhatsAppReminderUrl(c)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-2.5 py-1.5 rounded-lg bg-emerald-600/15 hover:bg-emerald-600/25 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30 font-semibold transition-all hover:-translate-y-0.5 cursor-pointer flex items-center gap-1 text-xs"
                              title="Send WhatsApp payment reminder"
                            >
                              💬 WhatsApp
                            </a>
                          )}

                          {/* Renew Button */}
                          <Link
                            href={getRenewUrl(c)}
                            className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-semibold transition-all hover:-translate-y-0.5 shadow-xs shadow-rose-600/20 cursor-pointer"
                            title="Renew subscription for this student"
                          >
                            Renew
                          </Link>

                          {/* Vacate Button */}
                          <button
                            disabled={vacatingId === c.receipt_no}
                            onClick={() => handleVacate(c)}
                            className="px-2.5 py-1.5 rounded-lg bg-panel-bg hover:bg-rose-500/10 text-text-muted hover:text-rose-600 dark:hover:text-rose-400 border border-panel-border text-[11px] font-semibold transition-all cursor-pointer disabled:opacity-50"
                            title="Officially vacate seat and turn it green"
                          >
                            {vacatingId === c.receipt_no ? "Vacating..." : "Vacate"}
                          </button>

                          {/* Owner Edit Plan Button */}
                          <button
                            onClick={() =>
                              setEditingReceipt({
                                receipt_no: c.receipt_no,
                                student_id: c.student_id,
                                student_name: c.student_name,
                                student_phone: c.student_phone,
                                aadhar_no: c.aadhar_no,
                                seat_id: c.seat_id,
                                seat_number: c.seat_number,
                                subscription_type: c.subscription_type,
                                shift_type: c.shift_type,
                                has_sheet: c.has_sheet,
                                amount_paid: c.amount_paid,
                                start_date: c.start_date,
                                end_date: c.end_date,
                              })
                            }
                            className="px-2 py-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-400 border border-amber-500/20 text-[11px] font-semibold transition-all cursor-pointer"
                            title="Owner: Edit dates, fee, or shift"
                          >
                            ✏️
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Owner Edit Receipt Modal */}
      {editingReceipt && (
        <EditReceiptModal
          receipt={editingReceipt}
          isOpen={!!editingReceipt}
          onClose={() => setEditingReceipt(null)}
          onSuccess={() => {
            fetchDueFees(true);
            setEditingReceipt(null);
          }}
          shiftsConfig={shiftsConfig}
          slug={slug}
        />
      )}

      {/* Dynamic UPI & WhatsApp Reminder Modal */}
      {selectedUpiCandidate && (
        <DynamicUpiModal
          isOpen={!!selectedUpiCandidate}
          onClose={() => setSelectedUpiCandidate(null)}
          candidate={selectedUpiCandidate}
          library={libraryInfo}
          shiftLabel={shiftLabel(selectedUpiCandidate.shift_type, selectedUpiCandidate.subscription_type)}
        />
      )}
    </div>
  );
}

export default function DueFeesView({ tenantSlug }: { tenantSlug?: string }) {
  return (
    <Suspense fallback={<div className="p-12 text-center text-xs text-text-muted">Loading due fees register...</div>}>
      <DueFeesContent tenantSlug={tenantSlug} />
    </Suspense>
  );
}
