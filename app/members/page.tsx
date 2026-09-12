"use client";

import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { getStoredSession } from "@/lib/auth";
import { downloadCsv } from "@/lib/exportCsv";

function MembersContent() {
  const searchParams = useSearchParams();
  const slug = searchParams.get("slug") || getStoredSession()?.librarySlug || "target-library";

  const [q, setQ] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(false);

  // Auto-load recent members for this library
  useEffect(() => {
    async function loadInitial() {
      setLoading(true);
      try {
        const res = await fetch(`/api/members?slug=${encodeURIComponent(slug)}`);
        const data = await res.json();
        setResults(Array.isArray(data) ? data : []);
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    }
    loadInitial();
  }, [slug]);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch(`/api/members?q=${encodeURIComponent(q)}&slug=${encodeURIComponent(slug)}`);
      const data = await res.json();
      setResults(Array.isArray(data) ? data : []);
      setSearched(true);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }

  const handleExportMembersCSV = () => {
    if (!results.length) {
      alert("No members to export.");
      return;
    }

    const todayStr = new Date().toISOString().split("T")[0];
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

    const rows = results.map((m) => {
      const activeReceipt = m.receipts?.find(
        (r: any) => r.start_date <= todayStr && r.end_date >= todayStr && !r.is_vacated
      );
      const isOverdue = m.receipts?.some(
        (r: any) => r.end_date < todayStr && !r.is_vacated
      );
      const status = activeReceipt
        ? "Active"
        : isOverdue
        ? "Overdue"
        : "Inactive / Vacated";

      const seatNum = activeReceipt?.seats?.seat_number || "None";
      const plan = activeReceipt
        ? activeReceipt.subscription_type === "full_day"
          ? "Full Day"
          : "Half Day"
        : "N/A";
      const shift = activeReceipt?.shift_type || "N/A";
      const start = activeReceipt?.start_date || "N/A";
      const end = activeReceipt?.end_date || "N/A";

      return [
        m.student_id,
        m.name,
        m.phone ? `="${m.phone}"` : "",
        m.aadhar_no ? `="${m.aadhar_no}"` : "",
        status,
        seatNum,
        plan,
        shift,
        start,
        end,
        m.date_of_joining ? m.date_of_joining.split("T")[0] : "",
      ];
    });

    const today = new Date().toISOString().split("T")[0];
    const cleanSlug = slug || "library";
    downloadCsv({
      filename: `${cleanSlug}_Members_Directory_${today}.csv`,
      headers,
      rows,
    });
  };

  return (
    <div className="w-full max-w-[96vw] 2xl:max-w-[1750px] mx-auto px-4 sm:px-6 py-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-panel-bg border border-panel-border rounded-2xl p-6 backdrop-blur-md">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.5)]" />
            Member Directory
          </h1>
          <p className="text-xs text-text-muted mt-1">
            Search permanent member profiles, active seats, and full payment receipts for this library.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            onClick={handleExportMembersCSV}
            disabled={!results.length}
            className="flex items-center gap-1.5 text-xs font-bold px-4 py-2.5 rounded-xl bg-card-bg border border-panel-border hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-all cursor-pointer disabled:opacity-40 shadow-xs"
            title="Download member directory as Excel/CSV"
          >
            <span>📥</span> Export Members CSV ({results.length})
          </button>
        </div>
      </div>

      <form onSubmit={handleSearch} className="flex gap-3 max-w-lg bg-panel-bg border border-panel-border p-3 rounded-xl backdrop-blur-xs">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by name, phone, or Member ID..."
          className="flex-1 bg-input-bg border border-input-border focus:border-rose-500/80 focus:ring-1 focus:ring-rose-500/30 rounded-lg px-4 py-2.5 text-sm text-foreground placeholder-text-muted outline-none transition-all duration-200"
        />
        <button
          disabled={loading}
          className="bg-rose-600 hover:bg-rose-500 text-white font-semibold px-5 py-2.5 rounded-lg text-sm transition-all duration-200 shadow-md shadow-rose-600/10 cursor-pointer disabled:opacity-50"
        >
          {loading ? "Searching..." : "Search"}
        </button>
      </form>

      {searched && results.length === 0 && !loading && (
        <p className="text-text-muted text-sm py-8 bg-panel-bg/40 border border-panel-border border-dashed rounded-xl text-center">
          No matching members found in this library.
        </p>
      )}

      {results.length === 0 && !searched && !loading && (
        <div className="text-center py-10 bg-card-bg border border-panel-border rounded-2xl p-6">
          <span className="text-3xl block mb-2">👥</span>
          <h3 className="font-bold text-sm text-text-main">No members yet</h3>
          <p className="text-xs text-text-muted mt-1">
            Admit your first student via walk-in receipt or front door QR code.
          </p>
          <Link
            href={`/new-receipt?slug=${slug}`}
            className="inline-block mt-3 px-4 py-2 rounded-xl bg-rose-600 text-white font-bold text-xs"
          >
            + Admit First Member
          </Link>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {results.map((m) => {
          const todayStr = new Date().toISOString().split("T")[0];
          const activeReceipt = m.receipts?.find(
            (r: any) => r.start_date <= todayStr && r.end_date >= todayStr
          );
          const isActive = !!activeReceipt;
          const activeSeatNumber = activeReceipt?.seats?.seat_number;

          return (
            <Link
              key={m.student_id}
              href={`/members/${m.student_id}?slug=${slug}`}
              className="group flex justify-between items-center bg-card-bg border border-card-border hover:border-rose-500/40 rounded-xl p-4 transition-all duration-200 hover:-translate-y-0.5 shadow-md shadow-black/5 cursor-pointer"
            >
              <div className="flex-1 min-w-0 pr-4">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-semibold text-foreground group-hover:text-rose-600 dark:group-hover:text-rose-400 transition-colors truncate">
                    {m.name}
                  </p>
                  <span
                    className={`inline-flex items-center gap-1 text-[8px] font-extrabold uppercase px-2 py-0.5 rounded-full border shrink-0 ${
                      isActive
                        ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                        : "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20"
                    }`}
                  >
                    <span
                      className={`w-1 h-1 rounded-full ${
                        isActive ? "bg-emerald-500 animate-pulse" : "bg-rose-500"
                      }`}
                    />
                    {isActive ? `Seat ${activeSeatNumber}` : "Not Enrolled"}
                  </span>
                </div>
                <p className="text-xs text-text-muted mt-1">
                  Student ID: <span className="font-mono text-text-details">#{m.student_id}</span>
                  {m.phone && <span className="text-text-muted"> &middot; {m.phone}</span>}
                </p>
              </div>
              <span className="text-text-muted group-hover:text-rose-600 dark:group-hover:text-rose-400 text-xs font-semibold tracking-wider transition-colors uppercase shrink-0">
                View Profile &rarr;
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

export default function MembersSearchPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center p-4">
          <div className="w-8 h-8 border-3 border-rose-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
      }
    >
      <MembersContent />
    </Suspense>
  );
}
