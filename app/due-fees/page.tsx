"use client";

import { Suspense, useEffect, useState, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import EditReceiptModal, { EditableReceipt } from "@/lib/EditReceiptModal";

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

function DueFeesContent() {
  const searchParams = useSearchParams();
  const slug = searchParams.get("slug") || "target-library";

  const [candidates, setCandidates] = useState<DueCandidate[]>([]);
  const [summary, setSummary] = useState<DueSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [vacatingId, setVacatingId] = useState<number | null>(null);
  const [editingReceipt, setEditingReceipt] = useState<EditableReceipt | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [tabFilter, setTabFilter] = useState<"all" | "1_3" | "4_7" | "7_plus">("all");
  const [shiftFilter, setShiftFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<"overdue_desc" | "overdue_asc" | "seat" | "name">("overdue_desc");

  const fetchDueFees = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const res = await fetch(`/api/due-fees?slug=${slug}`);
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
  }, []);

  const shiftLabel = (shift: string | null, subType: string) => {
    if (subType === "full_day") return "Full Day (6am–12am)";
    if (shift === "shift_1" || shift === "morning") return "Shift 1 (6am–2pm)";
    if (shift === "shift_2" || shift === "evening") return "Shift 2 (2pm–12am)";
    if (shift === "shift_3") return "Shift 3 (4pm–12am)";
    return "Half Day";
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
    });
    return `/new-receipt?${params.toString()}`;
  };

  const getWhatsAppReminderUrl = (c: DueCandidate) => {
    if (!c.student_phone) return "#";
    const phone = c.student_phone.replace(/[^0-9]/g, "").slice(-10);
    const message = `Hello ${c.student_name}, this is a gentle reminder from The Target Library regarding Seat ${c.seat_number} (${shiftLabel(c.shift_type, c.subscription_type)}). Your subscription expired on ${c.end_date} (${c.days_overdue} day${c.days_overdue === 1 ? "" : "s"} ago). Please complete your fee payment to retain your seat. Thank you! - The Target Library`;
    return `https://wa.me/91${phone}?text=${encodeURIComponent(message)}`;
  };

  // Filtered and sorted candidate list
  const filteredCandidates = useMemo(() => {
    return candidates
      .filter((c) => {
        // Tab severity filter
        if (tabFilter === "1_3" && (c.days_overdue < 1 || c.days_overdue > 3)) return false;
        if (tabFilter === "4_7" && (c.days_overdue < 4 || c.days_overdue > 7)) return false;
        if (tabFilter === "7_plus" && c.days_overdue <= 7) return false;

        // Shift filter
        if (shiftFilter === "full_day" && c.subscription_type !== "full_day") return false;
        if (shiftFilter === "shift_1" && c.shift_type !== "shift_1" && c.shift_type !== "morning") return false;
        if (shiftFilter === "shift_2" && c.shift_type !== "shift_2" && c.shift_type !== "evening") return false;
        if (shiftFilter === "shift_3" && c.shift_type !== "shift_3") return false;

        // Search query
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase().trim();
          const nameMatch = c.student_name.toLowerCase().includes(q);
          const phoneMatch = c.student_phone ? c.student_phone.includes(q) : false;
          const seatMatch = c.seat_number.toString() === q || `seat ${c.seat_number}`.toLowerCase().includes(q);
          const idMatch = c.student_id.toString().includes(q);
          if (!nameMatch && !phoneMatch && !seatMatch && !idMatch) return false;
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
  }, [candidates, tabFilter, shiftFilter, searchQuery, sortBy]);

  const exportCSV = () => {
    if (filteredCandidates.length === 0) {
      alert("No records to export.");
      return;
    }

    const headers = ["Receipt #", "Seat #", "Student ID", "Name", "Phone", "Aadhaar", "Plan", "Shift", "With Sheet", "Amount Paid", "End Date", "Days Overdue"];
    const rows = filteredCandidates.map((c) => [
      c.receipt_no,
      c.seat_number,
      c.student_id,
      `"${c.student_name.replace(/"/g, '""')}"`,
      c.student_phone || "",
      c.aadhar_no || "",
      c.subscription_type,
      c.shift_type || "",
      c.has_sheet ? "Yes" : "No",
      c.amount_paid,
      c.end_date,
      c.days_overdue,
    ]);

    const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    const today = new Date().toISOString().split("T")[0];
    link.setAttribute("download", `Target_Library_Due_Fees_${today}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex items-center justify-between flex-wrap gap-4 bg-panel-bg border border-panel-border rounded-xl p-6 backdrop-blur-md">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.6)] animate-pulse" />
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Due Fees Register
            </h1>
          </div>
          <p className="text-xs text-text-muted mt-1">
            Enrolled candidates whose validity ended without renewal. Seats remain occupied (marked in Blue) until officially vacated.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => fetchDueFees(true)}
            disabled={refreshing}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-panel-bg hover:bg-neutral-200 dark:hover:bg-neutral-800 text-text-details border border-panel-border text-xs font-semibold transition-all cursor-pointer disabled:opacity-50"
            title="Refresh latest due records"
          >
            <span className={refreshing ? "animate-spin" : ""}>🔄</span>
            {refreshing ? "Refreshing..." : "Refresh"}
          </button>
          <button
            onClick={exportCSV}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition-all shadow-md shadow-emerald-600/20 cursor-pointer"
            title="Download CSV for records"
          >
            📥 Export CSV
          </button>
          <Link
            href={`/l/${slug}`}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition-all shadow-md shadow-blue-600/20 cursor-pointer"
          >
            🗺️ View Desk Portal
          </Link>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <div className="bg-panel-bg border border-panel-border rounded-xl p-4 shadow-sm relative overflow-hidden">
          <div className="text-[10px] font-extrabold uppercase tracking-wider text-text-muted">Total Due Students</div>
          <div className="text-2xl font-black text-blue-600 dark:text-blue-400 mt-1">
            {summary?.total_due ?? candidates.length}
          </div>
          <p className="text-[10px] text-text-muted mt-0.5">Currently occupying desks</p>
        </div>

        <div className="bg-panel-bg border border-panel-border rounded-xl p-4 shadow-sm">
          <div className="text-[10px] font-extrabold uppercase tracking-wider text-amber-600 dark:text-amber-400">1–3 Days Overdue</div>
          <div className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-1">
            {summary?.days_1_to_3 ?? 0}
          </div>
          <p className="text-[10px] text-text-muted mt-0.5">Grace period candidates</p>
        </div>

        <div className="bg-panel-bg border border-panel-border rounded-xl p-4 shadow-sm">
          <div className="text-[10px] font-extrabold uppercase tracking-wider text-orange-600 dark:text-orange-400">4–7 Days Overdue</div>
          <div className="text-2xl font-black text-orange-600 dark:text-orange-400 mt-1">
            {summary?.days_4_to_7 ?? 0}
          </div>
          <p className="text-[10px] text-text-muted mt-0.5">Reminder required</p>
        </div>

        <div className="bg-panel-bg border border-panel-border rounded-xl p-4 shadow-sm">
          <div className="text-[10px] font-extrabold uppercase tracking-wider text-rose-600 dark:text-rose-400">7+ Days Overdue</div>
          <div className="text-2xl font-black text-rose-600 dark:text-rose-400 mt-1">
            {summary?.days_7_plus ?? 0}
          </div>
          <p className="text-[10px] text-text-muted mt-0.5">Critical / Vacate action</p>
        </div>

        <div className="bg-panel-bg border border-panel-border rounded-xl p-4 shadow-sm col-span-2 sm:col-span-1">
          <div className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Estimated Dues</div>
          <div className="text-2xl font-black text-foreground mt-1">
            ₹{(summary?.estimated_pending_fees ?? 0).toLocaleString("en-IN")}
          </div>
          <p className="text-[10px] text-text-muted mt-0.5">Pending monthly revenue</p>
        </div>
      </div>

      {/* Filter and Search Controls */}
      <div className="bg-panel-bg border border-panel-border rounded-xl p-4 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Severity Tabs */}
          <div className="flex items-center gap-1.5 p-1 bg-background border border-panel-border rounded-lg text-xs font-semibold">
            <button
              onClick={() => setTabFilter("all")}
              className={`px-3 py-1.5 rounded-md transition-all cursor-pointer ${
                tabFilter === "all" ? "bg-blue-600 text-white shadow-xs" : "text-text-muted hover:text-foreground"
              }`}
            >
              All ({candidates.length})
            </button>
            <button
              onClick={() => setTabFilter("1_3")}
              className={`px-3 py-1.5 rounded-md transition-all cursor-pointer ${
                tabFilter === "1_3" ? "bg-amber-600 text-white shadow-xs" : "text-text-muted hover:text-foreground"
              }`}
            >
              1–3 Days ({summary?.days_1_to_3 ?? 0})
            </button>
            <button
              onClick={() => setTabFilter("4_7")}
              className={`px-3 py-1.5 rounded-md transition-all cursor-pointer ${
                tabFilter === "4_7" ? "bg-orange-600 text-white shadow-xs" : "text-text-muted hover:text-foreground"
              }`}
            >
              4–7 Days ({summary?.days_4_to_7 ?? 0})
            </button>
            <button
              onClick={() => setTabFilter("7_plus")}
              className={`px-3 py-1.5 rounded-md transition-all cursor-pointer ${
                tabFilter === "7_plus" ? "bg-rose-600 text-white shadow-xs" : "text-text-muted hover:text-foreground"
              }`}
            >
              7+ Days ({summary?.days_7_plus ?? 0})
            </button>
          </div>

          {/* Quick Stats Indicator */}
          <div className="text-xs text-text-muted">
            Showing <span className="font-bold text-foreground">{filteredCandidates.length}</span> candidates
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Search Box */}
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by student name, seat #, or phone..."
              className="w-full bg-background border border-panel-border rounded-lg px-3 py-2 text-xs text-foreground placeholder:text-text-muted focus:outline-none focus:border-blue-500 transition-colors"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-text-muted hover:text-foreground cursor-pointer"
              >
                ✕
              </button>
            )}
          </div>

          {/* Shift Filter */}
          <div>
            <select
              value={shiftFilter}
              onChange={(e) => setShiftFilter(e.target.value)}
              className="w-full bg-background border border-panel-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:border-blue-500 transition-colors cursor-pointer"
            >
              <option value="all">All Shifts</option>
              <option value="full_day">Full Day Only</option>
              <option value="shift_1">Shift 1 (6am–2pm)</option>
              <option value="shift_2">Shift 2 (2pm–12am)</option>
              <option value="shift_3">Shift 3 (4pm–12am)</option>
            </select>
          </div>

          {/* Sort By */}
          <div>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="w-full bg-background border border-panel-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:border-blue-500 transition-colors cursor-pointer"
            >
              <option value="overdue_desc">Sort: Most Overdue First</option>
              <option value="overdue_asc">Sort: Least Overdue First</option>
              <option value="seat">Sort: Seat Number (1–297)</option>
              <option value="name">Sort: Candidate Name (A–Z)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Candidate List Table */}
      {loading ? (
        <div className="bg-panel-bg border border-panel-border rounded-xl p-12 text-center text-text-muted text-sm">
          Loading overdue fee records...
        </div>
      ) : filteredCandidates.length === 0 ? (
        <div className="bg-panel-bg border border-panel-border rounded-xl p-12 text-center space-y-3">
          <span className="text-4xl">🎉</span>
          <h3 className="text-lg font-bold text-foreground">No Overdue Candidates Found</h3>
          <p className="text-xs text-text-muted max-w-md mx-auto">
            {searchQuery || tabFilter !== "all" || shiftFilter !== "all"
              ? "No overdue records match your current filter settings. Try adjusting the search or filters."
              : "Great news! All active seats and enrolled candidates are completely up to date with their fees."}
          </p>
        </div>
      ) : (
        <div className="bg-panel-bg border border-panel-border rounded-xl overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-text-details">
              <thead className="bg-background/80 border-b border-panel-border text-[10px] uppercase tracking-wider text-text-muted">
                <tr>
                  <th className="py-3.5 px-4 font-extrabold">Seat #</th>
                  <th className="py-3.5 px-4 font-extrabold">Candidate</th>
                  <th className="py-3.5 px-4 font-extrabold">Contact & Aadhaar</th>
                  <th className="py-3.5 px-4 font-extrabold">Plan & Shift</th>
                  <th className="py-3.5 px-4 font-extrabold">Expired On</th>
                  <th className="py-3.5 px-4 font-extrabold">Status / Overdue</th>
                  <th className="py-3.5 px-4 font-extrabold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-panel-border/50">
                {filteredCandidates.map((c) => {
                  const is1to3 = c.days_overdue <= 3;
                  const is4to7 = c.days_overdue > 3 && c.days_overdue <= 7;
                  const is7Plus = c.days_overdue > 7;

                  return (
                    <tr key={c.receipt_no} className="hover:bg-background/40 transition-colors">
                      {/* Seat Number */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className="inline-flex items-center justify-center font-mono font-black text-sm bg-blue-500/15 text-blue-700 dark:text-blue-300 border border-blue-500/30 w-10 h-10 rounded-lg shadow-inner">
                          {c.seat_number}
                        </span>
                      </td>

                      {/* Candidate Name */}
                      <td className="py-3.5 px-4">
                        <Link
                          href={`/members/${c.student_id}`}
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
                          {/* WhatsApp Reminder */}
                          {c.student_phone && (
                            <a
                              href={getWhatsAppReminderUrl(c)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-2.5 py-1.5 rounded-lg bg-emerald-600/15 hover:bg-emerald-600/25 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30 font-semibold transition-all hover:-translate-y-0.5 cursor-pointer flex items-center gap-1"
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
        />
      )}
    </div>
  );
}

export default function DueFeesPage() {
  return (
    <Suspense fallback={<div className="p-12 text-center text-xs text-text-muted">Loading due fees register...</div>}>
      <DueFeesContent />
    </Suspense>
  );
}
