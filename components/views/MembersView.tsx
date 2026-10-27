"use client";
import { getTodayIST } from "@/lib/dates";

import { useState, useEffect, Suspense, useCallback } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { getStoredSession } from "@/lib/auth";
import { downloadCsv } from "@/lib/exportCsv";
import { ShiftConfig } from "@/lib/types";
import { getShiftDisplayLabel, sortShiftsChronologically } from "@/lib/shifts";
import { DEFAULT_SHIFTS } from "@/lib/tenant";

interface MemberResult {
  student_id: number;
  name: string;
  phone: string | null;
  aadhar_no?: string | null;
  date_of_joining?: string | null;
  receipts?: Array<{
    receipt_no?: number;
    start_date: string;
    end_date: string;
    is_vacated?: boolean;
    shift_type?: string | null;
    subscription_type?: "full_day" | "half_day";
    seats?: {
      seat_number: number;
    };
  }>;
}

interface VacatedRecord {
  receipt_no: number;
  student_id: number;
  start_date: string;
  end_date: string;
  is_vacated: boolean;
  shift_type: string | null;
  subscription_type: "full_day" | "half_day";
  seats: {
    seat_number: number;
  } | null;
  members: {
    name: string;
    phone: string | null;
    student_id: number;
    aadhar_no?: string | null;
    date_of_joining?: string | null;
  } | null;
}

export function MembersContent({ tenantSlug }: { tenantSlug?: string }) {
  const searchParams = useSearchParams();
  const slug =
    tenantSlug || searchParams.get("slug") || getStoredSession()?.librarySlug || "target-library";

  // Tab state: "search" (default) or "left_this_month"
  const [activeTab, setActiveTab] = useState<"search" | "left_this_month">("search");

  // Search state
  const [q, setQ] = useState("");
  const [searchResults, setSearchResults] = useState<MemberResult[]>([]);
  const [searched, setSearched] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);

  // Left This Month state
  const [leftStudents, setLeftStudents] = useState<VacatedRecord[]>([]);
  const [loadingLeft, setLoadingLeft] = useState(false);
  const [leftLoaded, setLeftLoaded] = useState(false);

  const [shiftsConfig, setShiftsConfig] = useState<ShiftConfig[]>(DEFAULT_SHIFTS);

  // Current month label (e.g. "October 2026")
  const todayStr = getTodayIST();
  const currentMonthName = new Date().toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  // Load library settings for shifts
  useEffect(() => {
    fetch(`/api/libraries/${encodeURIComponent(slug)}/settings`)
      .then((r) => r.json())
      .then((d) => {
        if (d.settings?.shifts_config && d.settings.shifts_config.length > 0) {
          setShiftsConfig(sortShiftsChronologically(d.settings.shifts_config));
        }
      })
      .catch(() => {});
  }, [slug]);

  // Fetch vacated students when Left tab is opened or on mount
  const fetchLeftStudents = useCallback(async () => {
    setLoadingLeft(true);
    try {
      const res = await fetch(`/api/members?slug=${encodeURIComponent(slug)}&left_this_month=true`);
      const data = await res.json();
      setLeftStudents(Array.isArray(data) ? data : []);
      setLeftLoaded(true);
    } catch {
      // ignore
    } finally {
      setLoadingLeft(false);
    }
  }, [slug]);

  useEffect(() => {
    // Pre-fetch count in background
    fetchLeftStudents();
  }, [fetchLeftStudents]);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!q.trim()) return;
    setSearchLoading(true);
    try {
      const res = await fetch(
        `/api/members?q=${encodeURIComponent(q.trim())}&slug=${encodeURIComponent(slug)}`
      );
      const data = await res.json();
      setSearchResults(Array.isArray(data) ? data : []);
      setSearched(true);
    } catch {
      // ignore
    } finally {
      setSearchLoading(false);
    }
  }

  // Export search results
  const handleExportSearchCSV = () => {
    if (!searchResults.length) return;

    const headers = [
      "Member ID",
      "Student Name",
      "Phone Number",
      "Aadhaar Number",
      "Current Status",
      "Active Seat #",
      "Subscription Plan",
      "Shift",
      "Validity Start",
      "Validity End",
      "Date of Joining",
    ];

    const rows = searchResults.map((m) => {
      const activeReceipt = m.receipts?.find(
        (r) => r.start_date <= todayStr && r.end_date >= todayStr && !r.is_vacated
      );
      const isOverdue = m.receipts?.some((r) => r.end_date < todayStr && !r.is_vacated);
      const status = activeReceipt ? "Active" : isOverdue ? "Overdue" : "Inactive / Vacated";

      const seatNum = activeReceipt?.seats?.seat_number || "None";
      const plan = activeReceipt
        ? activeReceipt.subscription_type === "full_day"
          ? "Full Day"
          : "Half Day"
        : "N/A";
      const shift = activeReceipt
        ? getShiftDisplayLabel(activeReceipt.shift_type, activeReceipt.subscription_type, shiftsConfig)
        : "N/A";

      return [
        m.student_id,
        m.name,
        m.phone ? `="${m.phone}"` : "",
        m.aadhar_no ? `="${m.aadhar_no}"` : "",
        status,
        seatNum,
        plan,
        shift,
        activeReceipt?.start_date || "N/A",
        activeReceipt?.end_date || "N/A",
        m.date_of_joining ? m.date_of_joining.split("T")[0] : "",
      ];
    });

    const cleanSlug = slug || "library";
    downloadCsv({
      filename: `${cleanSlug}_Member_Search_${todayStr}.csv`,
      headers,
      rows,
    });
  };

  // Export Left Students CSV
  const handleExportLeftStudentsCSV = () => {
    if (!leftStudents.length) return;

    const headers = [
      "Student ID",
      "Student Name",
      "Phone Number",
      "Vacated Seat #",
      "Shift / Plan",
      "Start Date",
      "Departure / End Date",
      "Receipt No",
    ];

    const rows = leftStudents.map((r) => {
      const plan =
        r.subscription_type === "full_day"
          ? "Full Day"
          : getShiftDisplayLabel(r.shift_type, r.subscription_type, shiftsConfig);

      return [
        r.members?.student_id || r.student_id,
        r.members?.name || "Student",
        r.members?.phone ? `="${r.members.phone}"` : "",
        r.seats?.seat_number || "N/A",
        plan,
        r.start_date || "",
        r.end_date || "",
        r.receipt_no,
      ];
    });

    const cleanSlug = slug || "library";
    downloadCsv({
      filename: `${cleanSlug}_Students_Left_${currentMonthName.replace(/\s+/g, "_")}.csv`,
      headers,
      rows,
    });
  };

  return (
    <div className="w-full max-w-[96vw] 2xl:max-w-[1750px] mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Top Header Card */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-panel-bg border border-panel-border rounded-2xl p-6 backdrop-blur-md">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.5)]" />
            Member Directory & Retention
          </h1>
          <p className="text-xs text-text-muted mt-1">
            Search member records on demand, or inspect students who vacated/left during the current month.
          </p>
        </div>

        {/* Tab Switcher Pills */}
        <div className="flex items-center gap-2 bg-card-bg border border-panel-border rounded-xl p-1 shrink-0">
          <button
            onClick={() => setActiveTab("search")}
            className={`px-3.5 py-2 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
              activeTab === "search"
                ? "bg-rose-500/15 text-rose-600 dark:text-rose-400 font-extrabold shadow-2xs"
                : "text-text-muted hover:text-text-main"
            }`}
          >
            <span>🔍</span> Search Member
          </button>
          <button
            onClick={() => {
              setActiveTab("left_this_month");
              if (!leftLoaded) fetchLeftStudents();
            }}
            className={`px-3.5 py-2 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
              activeTab === "left_this_month"
                ? "bg-amber-500/20 text-amber-600 dark:text-amber-400 font-extrabold shadow-2xs"
                : "text-text-muted hover:text-text-main"
            }`}
          >
            <span>🚪</span> Left This Month
            {leftStudents.length > 0 && (
              <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-rose-500 text-white font-black">
                {leftStudents.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* TAB 1: SEARCH MEMBER */}
      {activeTab === "search" && (
        <div className="space-y-6">
          {/* Search Form Bar */}
          <div className="bg-card-bg border border-panel-border rounded-2xl p-4 shadow-xs">
            <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted text-base">
                  🔍
                </span>
                <input
                  type="text"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Type student name, 10-digit mobile number, or student ID..."
                  className="w-full bg-input-bg border border-input-border focus:border-rose-500/80 focus:ring-2 focus:ring-rose-500/20 rounded-xl pl-11 pr-4 py-3 text-sm text-foreground placeholder-text-muted outline-none transition"
                  autoFocus
                />
                {q && (
                  <button
                    type="button"
                    onClick={() => {
                      setQ("");
                      setSearchResults([]);
                      setSearched(false);
                    }}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-main text-xs px-1.5 py-0.5 rounded-md hover:bg-neutral-500/10 cursor-pointer"
                  >
                    ✕ Clear
                  </button>
                )}
              </div>
              <button
                type="submit"
                disabled={searchLoading || !q.trim()}
                className="bg-rose-600 hover:bg-rose-500 text-white font-bold px-6 py-3 rounded-xl text-sm transition shadow-md shadow-rose-600/15 cursor-pointer disabled:opacity-50 shrink-0"
              >
                {searchLoading ? "Searching..." : "Search"}
              </button>
              {searchResults.length > 0 && (
                <button
                  type="button"
                  onClick={handleExportSearchCSV}
                  className="flex items-center gap-1.5 text-xs font-bold px-4 py-3 rounded-xl bg-panel-bg border border-panel-border hover:bg-neutral-100 dark:hover:bg-neutral-800 transition cursor-pointer shrink-0"
                  title="Download search results as CSV"
                >
                  <span>📥</span> Export CSV ({searchResults.length})
                </button>
              )}
            </form>
          </div>

          {/* Initial Clean State (No search performed yet) */}
          {!searched && (
            <div className="text-center py-16 px-4 bg-card-bg border border-panel-border border-dashed rounded-3xl">
              <span className="text-4xl block mb-3 select-none">🔍</span>
              <h3 className="font-extrabold text-base text-text-main">Search Member Directory</h3>
              <p className="text-xs text-text-muted mt-1.5 max-w-md mx-auto leading-relaxed">
                Lookup any aspirant instantly by name, mobile phone number, or student ID to check
                their active seat, payment receipts, or admission profile.
              </p>
              <div className="flex flex-wrap items-center justify-center gap-2 mt-5">
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab("left_this_month");
                  }}
                  className="px-3.5 py-1.5 rounded-xl bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20 text-xs font-bold hover:bg-amber-500/20 transition cursor-pointer"
                >
                  🚪 View Students Who Left This Month ({leftStudents.length}) →
                </button>
                <Link
                  href={`/l/${encodeURIComponent(slug)}/new-receipt`}
                  className="px-3.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition shadow-xs"
                >
                  + Admit Walk-in Student
                </Link>
              </div>
            </div>
          )}

          {/* No results message */}
          {searched && searchResults.length === 0 && !searchLoading && (
            <div className="text-center py-12 px-4 bg-panel-bg/40 border border-panel-border border-dashed rounded-2xl">
              <span className="text-3xl block mb-2">🔎</span>
              <p className="text-sm font-bold text-text-main">
                No member found matching &ldquo;{q}&rdquo;
              </p>
              <p className="text-xs text-text-muted mt-1">
                Please check for any typos or verify whether the student was enrolled under a different phone number.
              </p>
              <Link
                href={`/l/${encodeURIComponent(slug)}/new-receipt`}
                className="inline-block mt-4 px-4 py-2 rounded-xl bg-rose-600 text-white font-bold text-xs"
              >
                + Admit as New Student
              </Link>
            </div>
          )}

          {/* Search Results Grid */}
          {searchResults.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between px-1">
                <span className="text-xs font-bold text-text-muted">
                  Showing {searchResults.length} {searchResults.length === 1 ? "result" : "results"}
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {searchResults.map((m) => {
                  const activeReceipt = m.receipts?.find(
                    (r) => r.start_date <= todayStr && r.end_date >= todayStr && !r.is_vacated
                  );
                  const isOverdue = m.receipts?.some(
                    (r) => r.end_date < todayStr && !r.is_vacated
                  );
                  const isActive = !!activeReceipt;
                  const activeSeatNumber = activeReceipt?.seats?.seat_number;

                  return (
                    <Link
                      key={m.student_id}
                      href={`/l/${encodeURIComponent(slug)}/members/${m.student_id}`}
                      className="group flex justify-between items-center bg-card-bg border border-card-border hover:border-rose-500/40 rounded-2xl p-4 transition-all duration-200 hover:-translate-y-0.5 shadow-xs cursor-pointer"
                    >
                      <div className="flex-1 min-w-0 pr-4">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-bold text-foreground group-hover:text-rose-600 dark:group-hover:text-rose-400 transition-colors truncate text-sm">
                            {m.name}
                          </p>
                          <span
                            className={`inline-flex items-center gap-1 text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full border shrink-0 ${
                              isActive
                                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                                : isOverdue
                                ? "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20"
                                : "bg-neutral-500/10 text-text-muted border-panel-border"
                            }`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                isActive
                                  ? "bg-emerald-500 animate-pulse"
                                  : isOverdue
                                  ? "bg-blue-500"
                                  : "bg-neutral-400"
                              }`}
                            />
                            {isActive
                              ? `Seat ${activeSeatNumber}`
                              : isOverdue
                              ? "Fee Overdue"
                              : "Vacated / Inactive"}
                          </span>
                        </div>
                        <p className="text-xs text-text-muted mt-1.5 flex items-center gap-2 flex-wrap">
                          <span>
                            ID: <span className="font-mono font-bold text-text-main">#{m.student_id}</span>
                          </span>
                          {m.phone && (
                            <>
                              <span>&middot;</span>
                              <span className="font-mono text-text-main">📱 {m.phone}</span>
                            </>
                          )}
                          {activeReceipt && (
                            <>
                              <span>&middot;</span>
                              <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                                Valid till {activeReceipt.end_date}
                              </span>
                            </>
                          )}
                        </p>
                      </div>
                      <span className="text-text-muted group-hover:text-rose-600 dark:group-hover:text-rose-400 text-xs font-bold tracking-wider transition-colors uppercase shrink-0">
                        View &rarr;
                      </span>
                    </Link>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: STUDENTS WHO LEFT THIS MONTH */}
      {activeTab === "left_this_month" && (
        <div className="space-y-6 animate-in fade-in">
          {/* Action & Info Banner */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-card-bg border border-panel-border rounded-2xl p-5 shadow-xs">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-lg">🚪</span>
                <h2 className="text-base font-extrabold text-foreground">
                  Students Vacated in {currentMonthName}
                </h2>
                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/20">
                  {leftStudents.length} {leftStudents.length === 1 ? "Student" : "Students"}
                </span>
              </div>
              <p className="text-xs text-text-muted mt-1">
                Showing all aspirants who vacated their seats or whose subscriptions finished in {currentMonthName}. Use this list for follow-ups, retention calls, or seat audit.
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={handleExportLeftStudentsCSV}
                disabled={!leftStudents.length}
                className="flex items-center gap-1.5 text-xs font-bold px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white transition cursor-pointer disabled:opacity-40 shadow-xs"
                title="Download this vacated students list as Excel/CSV"
              >
                <span>📥</span> Export Left List ({leftStudents.length})
              </button>
            </div>
          </div>

          {/* Loading state */}
          {loadingLeft && (
            <div className="text-center py-12 bg-card-bg border border-panel-border rounded-2xl">
              <div className="w-6 h-6 border-2 border-rose-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
              <p className="text-xs text-text-muted">Loading vacated students data...</p>
            </div>
          )}

          {/* Empty state */}
          {!loadingLeft && leftStudents.length === 0 && (
            <div className="text-center py-16 px-4 bg-card-bg border border-panel-border border-dashed rounded-3xl">
              <span className="text-4xl block mb-3">🎉</span>
              <h3 className="font-extrabold text-base text-text-main">
                No students vacated in {currentMonthName}
              </h3>
              <p className="text-xs text-text-muted mt-1 max-w-sm mx-auto">
                All admitted members are active or no seats have been marked vacated during this month.
              </p>
            </div>
          )}

          {/* Vacated Students List Grid */}
          {!loadingLeft && leftStudents.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {leftStudents.map((record) => {
                const studentName = record.members?.name || "Student";
                const phone = record.members?.phone;
                const seatNumber = record.seats?.seat_number;
                const studentId = record.members?.student_id || record.student_id;
                const shiftLabel =
                  record.subscription_type === "full_day"
                    ? "Full Day"
                    : getShiftDisplayLabel(record.shift_type, record.subscription_type, shiftsConfig);

                return (
                  <div
                    key={`${record.receipt_no}-${studentId}`}
                    className="bg-card-bg border border-panel-border hover:border-amber-500/40 rounded-2xl p-4 transition-all duration-200 shadow-xs flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <h4 className="font-bold text-foreground text-sm truncate">
                            {studentName}
                          </h4>
                          <p className="text-xs text-text-muted mt-0.5">
                            ID: <span className="font-mono font-bold text-text-main">#{studentId}</span>
                          </p>
                        </div>
                        <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-lg bg-neutral-500/10 text-text-muted border border-panel-border shrink-0">
                          {seatNumber ? `Seat #${seatNumber}` : "No Seat"}
                        </span>
                      </div>

                      <div className="mt-3 pt-3 border-t border-panel-border space-y-1.5 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="text-text-muted">Left Date:</span>
                          <span className="font-bold text-rose-600 dark:text-rose-400 font-mono">
                            {record.end_date}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-text-muted">Plan / Shift:</span>
                          <span className="font-semibold text-text-main">{shiftLabel}</span>
                        </div>
                        {phone && (
                          <div className="flex items-center justify-between">
                            <span className="text-text-muted">Phone:</span>
                            <a
                              href={`tel:${phone}`}
                              className="font-mono text-indigo-600 dark:text-indigo-400 font-bold hover:underline"
                            >
                              {phone}
                            </a>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-panel-border flex items-center justify-between gap-2">
                      {phone ? (
                        <a
                          href={`https://wa.me/91${phone.replace(/\D/g, "")}?text=${encodeURIComponent(
                            `Hello ${studentName}, we noticed your membership at the library ended recently. Let us know if you'd like to re-reserve your seat!`
                          )}`}
                          target="_blank"
                          rel="noreferrer"
                          className="px-2.5 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 text-xs font-bold transition flex items-center gap-1"
                        >
                          <span>💬</span> WhatsApp
                        </a>
                      ) : (
                        <span />
                      )}

                      <Link
                        href={`/l/${encodeURIComponent(slug)}/members/${studentId}`}
                        className="text-xs font-bold text-rose-600 dark:text-rose-400 hover:underline flex items-center gap-1"
                      >
                        Profile &rarr;
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function MembersView({ tenantSlug }: { tenantSlug?: string }) {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center p-4">
          <div className="w-8 h-8 border-3 border-rose-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
      }
    >
      <MembersContent tenantSlug={tenantSlug} />
    </Suspense>
  );
}
