"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { Library, LibrarySettings, AdmissionRequest } from "@/lib/types";
import { FALLBACK_TARGET_LIBRARY, FALLBACK_SETTINGS } from "@/lib/tenant";
import EditReceiptModal, { EditableReceipt } from "@/lib/EditReceiptModal";

interface MemberData {
  student_id: number;
  name: string;
  phone: string | null;
  aadhar_no?: string | null;
}

interface ReceiptData {
  receipt_no: number;
  student_id: number;
  subscription_type: "full_day" | "half_day";
  shift_type: "shift_1" | "shift_2" | "shift_3" | "morning" | "evening" | null;
  has_sheet: boolean;
  amount_paid: number;
  start_date: string;
  end_date: string;
  is_vacated?: boolean;
  is_overdue?: boolean;
  days_overdue?: number;
  member: MemberData | null;
}

interface SeatData {
  seat_id: number;
  seat_number: number;
  occupied: boolean;
  is_overdue?: boolean;
  has_due?: boolean;
  is_double_shift?: boolean;
  status?: string;
  receipts: ReceiptData[];
}

export default function TenantDeskPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params);

  const [library, setLibrary] = useState<Library>(FALLBACK_TARGET_LIBRARY);
  const [settings, setSettings] = useState<LibrarySettings>(FALLBACK_SETTINGS);
  const [seats, setSeats] = useState<SeatData[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<SeatData | null>(null);
  const [vacating, setVacating] = useState<number | null>(null);
  const [editingReceipt, setEditingReceipt] = useState<EditableReceipt | null>(null);
  const [filterStatus, setFilterStatus] = useState<"all" | "double_shift" | "full_day" | "half_day" | "free" | "due">("all");

  // Incoming Admission Requests (Method B Entrance QR)
  const [admissionRequests, setAdmissionRequests] = useState<AdmissionRequest[]>([]);
  const [approvingRequestId, setApprovingRequestId] = useState<string | null>(null);
  const [selectedSeatForApproval, setSelectedSeatForApproval] = useState<Record<string, number>>({});
  const [approvalFeedback, setApprovalFeedback] = useState<{ id: string; message: string; receiptNo?: number } | null>(null);

  // Load Library & Settings
  useEffect(() => {
    async function loadInfo() {
      try {
        const res = await fetch(`/api/libraries/${slug}/settings`);
        if (res.ok) {
          const data = await res.json();
          if (data.library) setLibrary(data.library);
          if (data.settings) setSettings(data.settings);
        }
      } catch (e) {
        console.error("Error loading tenant info:", e);
      }
    }
    loadInfo();
  }, [slug]);

  // Load Seats
  const fetchSeats = () => {
    fetch(`/api/seats?slug=${slug}`)
      .then((r) => r.json())
      .then((data) => {
        let loadedSeats: SeatData[] = Array.isArray(data) ? data : [];
        if (settings.total_seats && loadedSeats.length > settings.total_seats) {
          loadedSeats = loadedSeats.slice(0, settings.total_seats);
        }
        setSeats(loadedSeats);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    fetchSeats();
  }, [settings.total_seats]);

  // Sound Notification Chime for Incoming Entrance QR Admissions
  const playAdmissionChime = () => {
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
      osc.frequency.setValueAtTime(880, ctx.currentTime + 0.12); // A5
      gain.gain.setValueAtTime(0.25, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.38);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.38);
    } catch {
      // Audio autoplay policy fallback
    }
  };

  // Poll for Incoming Admission Requests
  const fetchAdmissionRequests = async () => {
    try {
      const res = await fetch(`/api/admission-requests?slug=${slug}&status=pending`);
      if (res.ok) {
        const data = await res.json();
        const incoming: AdmissionRequest[] = data.requests || [];
        setAdmissionRequests((prev) => {
          if (incoming.length > prev.length && prev.length > 0) {
            playAdmissionChime();
          }
          return incoming;
        });
      }
    } catch {
      // Table may not exist yet or offline
    }
  };

  useEffect(() => {
    fetchAdmissionRequests();
    const interval = setInterval(fetchAdmissionRequests, 10000); // Check every 10 seconds
    return () => clearInterval(interval);
  }, [slug]);

  // Handle Approve Admission Request
  const handleApproveRequest = async (req: AdmissionRequest) => {
    const seatId = selectedSeatForApproval[req.id];
    if (!seatId) {
      alert("Please select an available seat number for this student.");
      return;
    }

    setApprovingRequestId(req.id);
    try {
      const res = await fetch("/api/admission-requests", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: req.id,
          status: "approved",
          seat_id: seatId,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Approval failed");

      setApprovalFeedback({
        id: req.id,
        message: `Approved! Seat #${seatId} assigned to ${req.student_name}.`,
        receiptNo: data.receipt_no,
      });

      // Refresh seats and admission queue
      fetchSeats();
      fetchAdmissionRequests();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to approve");
    } finally {
      setApprovingRequestId(null);
    }
  };

  // Handle Reject Admission Request
  const handleRejectRequest = async (id: string) => {
    if (!confirm("Are you sure you want to reject this admission request?")) return;
    try {
      const res = await fetch("/api/admission-requests", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status: "rejected" }),
      });
      if (res.ok) {
        fetchAdmissionRequests();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Seat classification helpers
  const isSeatDoubleShift = (s: SeatData) =>
    s.occupied &&
    !s.is_overdue &&
    s.status !== "due" &&
    s.status !== "partial_due" &&
    (s.is_double_shift || s.status === "double_shift" || (s.receipts?.length >= 2 && !s.receipts.some((r) => r.subscription_type === "full_day")));

  const isSeatFullDay = (s: SeatData) =>
    s.occupied &&
    !s.is_overdue &&
    s.status !== "due" &&
    s.status !== "partial_due" &&
    s.receipts?.some((r) => r.subscription_type === "full_day");

  const isSeatHalfDay = (s: SeatData) =>
    s.occupied &&
    !s.is_overdue &&
    s.status !== "due" &&
    s.status !== "partial_due" &&
    s.receipts?.length === 1 &&
    s.receipts[0].subscription_type === "half_day";

  const isSeatDue = (s: SeatData) =>
    s.is_overdue || s.status === "due" || s.status === "partial_due";

  const freeCount = seats.filter((s) => !s.occupied).length;
  const dueCount = seats.filter(isSeatDue).length;
  const partialCount = seats.filter(isSeatHalfDay).length;
  const fullDayCount = seats.filter(isSeatFullDay).length;
  const doubleShiftCount = seats.filter(isSeatDoubleShift).length;

  const matchesFilter = (s: SeatData) => {
    if (filterStatus === "all") return true;
    if (filterStatus === "double_shift") return isSeatDoubleShift(s);
    if (filterStatus === "full_day") return isSeatFullDay(s);
    if (filterStatus === "half_day") return isSeatHalfDay(s);
    if (filterStatus === "free") return !s.occupied;
    if (filterStatus === "due") return isSeatDue(s);
    return true;
  };

  const seatColor = (s: SeatData) => {
    if (!s.occupied) {
      return "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 hover:border-emerald-500/40 hover:shadow-[0_0_10px_rgba(16,185,129,0.15)] hover:-translate-y-0.5";
    }
    if (s.is_overdue || s.status === "due") {
      return "bg-blue-500/15 text-blue-700 dark:text-blue-400 border border-blue-500/40 hover:bg-blue-500/25 hover:border-blue-500/60 hover:shadow-[0_0_12px_rgba(59,130,246,0.3)] hover:-translate-y-0.5";
    }
    if (s.status === "partial_due") {
      return "bg-gradient-to-br from-blue-500/20 to-amber-500/20 text-blue-700 dark:text-blue-300 border border-blue-400/50 hover:border-blue-500/70 hover:shadow-[0_0_12px_rgba(59,130,246,0.25)] hover:-translate-y-0.5";
    }
    if (isSeatDoubleShift(s)) {
      return "bg-purple-500/15 text-purple-700 dark:text-purple-300 border border-purple-500/40 hover:bg-purple-500/25 hover:border-purple-500/60 hover:shadow-[0_0_12px_rgba(168,85,247,0.3)] hover:-translate-y-0.5";
    }
    if (isSeatFullDay(s)) {
      return "bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-500/20 hover:bg-rose-500/20 hover:border-rose-500/40 hover:shadow-[0_0_10px_rgba(244,63,94,0.15)] hover:-translate-y-0.5";
    }
    return "bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20 hover:bg-amber-500/20 hover:border-amber-500/40 hover:shadow-[0_0_10px_rgba(245,158,11,0.15)] hover:-translate-y-0.5";
  };

  const handleVacateSeat = async (receiptNo: number) => {
    if (!confirm("Are you sure you want to officially vacate this student?")) return;
    setVacating(receiptNo);
    try {
      const res = await fetch("/api/seats", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ receipt_no: receiptNo, action: "vacate" }),
      });
      if (res.ok) {
        fetchSeats();
        setSelected(null);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setVacating(null);
    }
  };

  // Free seats list for assigning
  const freeSeats = seats.filter((s) => !s.occupied);

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground pb-20">
      {/* Top Navbar */}
      <header className="sticky top-0 z-30 bg-background/80 backdrop-blur-md border-b border-panel-border px-4 py-3">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="text-xs text-text-muted hover:text-text-main transition px-2 py-1 rounded-lg border border-panel-border"
            >
              🔄 Portals
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-extrabold tracking-tight">{library.name}</h1>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                  Librarian Desk
                </span>
              </div>
              <p className="text-[11px] text-text-muted">
                📍 {library.city || "Dehradun"} • Capacity: {settings.total_seats || 297} Seats
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Link
              href={`/collections?slug=${slug}`}
              className="px-3 py-1.5 rounded-xl border border-panel-border bg-card-bg hover:bg-neutral-500/10 text-xs font-bold transition flex items-center gap-1.5"
            >
              <span>💰</span> Collections
            </Link>
            <Link
              href={`/due-fees?slug=${slug}`}
              className="px-3 py-1.5 rounded-xl border border-blue-500/30 bg-blue-500/10 text-blue-600 dark:text-blue-400 text-xs font-bold hover:bg-blue-500/20 transition flex items-center gap-1.5"
            >
              <span>🔵</span> Due Fees
            </Link>
            <Link
              href={`/l/${slug}/settings`}
              className="px-3 py-1.5 rounded-xl border border-panel-border bg-card-bg hover:bg-neutral-500/10 text-xs font-bold transition flex items-center gap-1.5"
            >
              <span>👑</span> Settings
            </Link>
            <Link
              href={`/l/${slug}/join`}
              target="_blank"
              className="px-3 py-1.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-bold hover:bg-emerald-500/20 transition flex items-center gap-1.5"
            >
              <span>📱</span> Door QR
            </Link>
            <Link
              href={`/new-receipt?slug=${slug}`}
              className="px-3.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-xs transition active:scale-95"
            >
              + Walk-in Admission
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-5 space-y-5">
        {/* Section: Real-Time Incoming Admission Requests Drawer */}
        {admissionRequests.length > 0 && (
          <div className="bg-card-bg border-2 border-emerald-500/40 rounded-3xl p-5 shadow-lg space-y-4 animate-in fade-in slide-in-from-top-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="flex h-3 w-3 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                </span>
                <h2 className="font-black text-sm text-text-main flex items-center gap-2">
                  <span>🔔</span> Incoming Door Admissions Waiting for Soundbox Verification
                </h2>
                <span className="text-xs font-black px-2 py-0.5 rounded-full bg-emerald-500 text-white">
                  {admissionRequests.length}
                </span>
              </div>
              <button
                onClick={fetchAdmissionRequests}
                className="text-xs text-text-muted hover:text-text-main underline cursor-pointer"
              >
                Refresh Queue
              </button>
            </div>

            {/* Request Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {admissionRequests.map((req) => (
                <div
                  key={req.id}
                  className="p-4 rounded-2xl bg-background border border-panel-border shadow-sm space-y-3"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="font-black text-sm text-text-main">{req.student_name}</div>
                      <div className="text-xs font-mono text-text-muted">{req.student_phone}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-base font-black text-emerald-600 dark:text-emerald-400">
                        ₹{req.amount_paid}
                      </div>
                      <div className="text-[10px] font-bold text-text-muted uppercase">
                        {req.subscription_type === "full_day" ? "Full Day" : "Half Day"} {req.has_sheet ? "(+Sheet)" : ""}
                      </div>
                    </div>
                  </div>

                  {/* UTR Soundbox Verification Badge */}
                  <div className="p-2.5 rounded-xl bg-neutral-500/5 border border-dashed border-panel-border flex items-center justify-between text-xs">
                    <div>
                      <span className="text-[10px] font-bold text-text-muted uppercase block">
                        Soundbox UTR Number
                      </span>
                      <span className="font-mono font-black text-rose-600 dark:text-rose-400 tracking-wider text-sm">
                        {req.utr_number || "No UTR Entered"}
                      </span>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-1 rounded-lg bg-amber-500/15 text-amber-700 dark:text-amber-300">
                      Verify on Soundbox
                    </span>
                  </div>

                  {/* Seat Allocation & Action Buttons */}
                  <div className="flex items-center gap-2 pt-1">
                    <select
                      value={selectedSeatForApproval[req.id] || ""}
                      onChange={(e) =>
                        setSelectedSeatForApproval({
                          ...selectedSeatForApproval,
                          [req.id]: Number(e.target.value),
                        })
                      }
                      className="flex-1 bg-card-bg border border-panel-border text-xs rounded-xl px-2.5 py-2 font-semibold text-text-main focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
                    >
                      <option value="">-- Assign Free Seat --</option>
                      {freeSeats.map((fs) => (
                        <option key={fs.seat_id} value={fs.seat_number}>
                          Seat #{fs.seat_number} (Free)
                        </option>
                      ))}
                    </select>

                    <button
                      onClick={() => handleApproveRequest(req)}
                      disabled={approvingRequestId === req.id}
                      className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-extrabold shadow-sm transition active:scale-95 disabled:opacity-50 cursor-pointer"
                    >
                      {approvingRequestId === req.id ? "Assigning..." : "✓ Approve"}
                    </button>

                    <button
                      onClick={() => handleRejectRequest(req.id)}
                      className="px-2.5 py-2 rounded-xl border border-panel-border hover:bg-rose-500/10 hover:text-rose-600 text-xs font-semibold text-text-muted transition cursor-pointer"
                      title="Reject Request"
                    >
                      ✕
                    </button>
                  </div>

                  {approvalFeedback?.id === req.id && (
                    <div className="text-xs text-emerald-600 dark:text-emerald-400 font-bold flex items-center justify-between">
                      <span>{approvalFeedback.message}</span>
                      {approvalFeedback.receiptNo && (
                        <Link
                          href={`/receipts/${approvalFeedback.receiptNo}`}
                          target="_blank"
                          className="underline"
                        >
                          View Pass →
                        </Link>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Stats Metrics Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <button
            onClick={() => setFilterStatus("all")}
            className={`p-3 rounded-2xl border text-left transition ${
              filterStatus === "all" ? "bg-rose-500/15 border-rose-500" : "bg-card-bg border-panel-border"
            }`}
          >
            <div className="text-[10px] uppercase font-bold text-text-muted">Total Seats</div>
            <div className="text-xl font-black font-mono mt-0.5">{seats.length}</div>
          </button>

          <button
            onClick={() => setFilterStatus("free")}
            className={`p-3 rounded-2xl border text-left transition ${
              filterStatus === "free" ? "bg-emerald-500/15 border-emerald-500" : "bg-card-bg border-panel-border"
            }`}
          >
            <div className="text-[10px] uppercase font-bold text-emerald-600 dark:text-emerald-400">🟢 Free Seats</div>
            <div className="text-xl font-black font-mono text-emerald-600 dark:text-emerald-400 mt-0.5">{freeCount}</div>
          </button>

          <button
            onClick={() => setFilterStatus("full_day")}
            className={`p-3 rounded-2xl border text-left transition ${
              filterStatus === "full_day" ? "bg-rose-500/15 border-rose-500" : "bg-card-bg border-panel-border"
            }`}
          >
            <div className="text-[10px] uppercase font-bold text-rose-600 dark:text-rose-400">🔴 Full Day</div>
            <div className="text-xl font-black font-mono text-rose-600 dark:text-rose-400 mt-0.5">{fullDayCount}</div>
          </button>

          <button
            onClick={() => setFilterStatus("half_day")}
            className={`p-3 rounded-2xl border text-left transition ${
              filterStatus === "half_day" ? "bg-amber-500/15 border-amber-500" : "bg-card-bg border-panel-border"
            }`}
          >
            <div className="text-[10px] uppercase font-bold text-amber-600 dark:text-amber-400">🟡 Half Day</div>
            <div className="text-xl font-black font-mono text-amber-600 dark:text-amber-400 mt-0.5">{partialCount}</div>
          </button>

          <button
            onClick={() => setFilterStatus("due")}
            className={`p-3 rounded-2xl border text-left transition ${
              filterStatus === "due" ? "bg-blue-500/15 border-blue-500" : "bg-card-bg border-panel-border"
            }`}
          >
            <div className="text-[10px] uppercase font-bold text-blue-600 dark:text-blue-400">🔵 Overdue Fees</div>
            <div className="text-xl font-black font-mono text-blue-600 dark:text-blue-400 mt-0.5">{dueCount}</div>
          </button>
        </div>

        {/* Cinema Seats Matrix */}
        <div className="bg-card-bg border border-panel-border rounded-3xl p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-panel-border pb-3.5">
            <h2 className="font-black text-sm flex items-center gap-2">
              <span>🎬</span> Real-Time Seat Matrix Layout
            </h2>
            <div className="text-xs text-text-muted font-medium">
              Showing {seats.filter(matchesFilter).length} of {seats.length} seats
            </div>
          </div>

          {loading ? (
            <div className="py-20 flex items-center justify-center">
              <div className="w-8 h-8 border-3 border-rose-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : (
            <div className="grid grid-cols-5 sm:grid-cols-8 md:grid-cols-10 lg:grid-cols-12 gap-2">
              {seats.filter(matchesFilter).map((seat) => (
                <button
                  key={seat.seat_id}
                  onClick={() => setSelected(seat)}
                  className={`aspect-square rounded-xl flex flex-col items-center justify-center p-1 font-bold text-xs cursor-pointer transition-all duration-150 ${seatColor(
                    seat
                  )}`}
                >
                  <span className="font-mono text-sm">{seat.seat_number}</span>
                  {isSeatDoubleShift(seat) && (
                    <span className="text-[8px] font-black uppercase tracking-tighter">2x Shift</span>
                  )}
                  {seat.is_overdue && (
                    <span className="text-[8px] font-black uppercase tracking-tighter">Due</span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Seat Details Modal */}
      {selected && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setSelected(null)}
        >
          <div
            className="bg-card-bg border border-panel-border rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4 animate-in zoom-in-95"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-panel-border pb-3">
              <div>
                <h3 className="text-lg font-black text-text-main">
                  Seat #{selected.seat_number} Details
                </h3>
                <span className="text-xs text-text-muted uppercase font-bold">
                  Status: {selected.status?.replace("_", " ") || (selected.occupied ? "Occupied" : "Free")}
                </span>
              </div>
              <button
                onClick={() => setSelected(null)}
                className="w-8 h-8 rounded-full bg-neutral-500/10 hover:bg-neutral-500/20 text-text-muted flex items-center justify-center text-sm font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            {selected.receipts && selected.receipts.length > 0 ? (
              <div className="space-y-3">
                {selected.receipts.map((r, i) => (
                  <div
                    key={r.receipt_no || i}
                    className="p-3.5 rounded-2xl bg-background border border-panel-border space-y-2 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-extrabold text-sm text-text-main">
                        {r.member?.name || "Student"}
                      </span>
                      <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                        ₹{r.amount_paid}
                      </span>
                    </div>

                    <div className="text-text-muted text-[11px] space-y-0.5">
                      <div>📞 Phone: {r.member?.phone || "N/A"}</div>
                      <div>📅 Period: {r.start_date} to {r.end_date}</div>
                      <div>🏷️ Plan: {r.subscription_type} {r.shift_type ? `(${r.shift_type})` : ""}</div>
                    </div>

                    <div className="flex items-center gap-2 pt-1">
                      <Link
                        href={`/receipts/${r.receipt_no}`}
                        target="_blank"
                        className="px-3 py-1.5 rounded-xl bg-neutral-500/10 hover:bg-neutral-500/20 text-xs font-bold text-text-main transition"
                      >
                        📄 Receipt / Pass
                      </Link>
                      <button
                        onClick={() => handleVacateSeat(r.receipt_no)}
                        disabled={vacating === r.receipt_no}
                        className="px-3 py-1.5 rounded-xl border border-panel-border hover:bg-rose-500/15 hover:text-rose-600 text-xs font-bold transition cursor-pointer"
                      >
                        {vacating === r.receipt_no ? "Vacating..." : "🚪 Vacate Seat"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-6 text-center text-xs text-text-muted space-y-3">
                <p>This seat is currently unassigned and free.</p>
                <Link
                  href={`/new-receipt?seat_number=${selected.seat_number}&slug=${slug}`}
                  className="inline-block px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-xs"
                >
                  Book Seat #{selected.seat_number}
                </Link>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Edit Receipt Modal */}
      {editingReceipt && (
        <EditReceiptModal
          isOpen={!!editingReceipt}
          receipt={editingReceipt}
          onClose={() => setEditingReceipt(null)}
          onSuccess={() => {
            setEditingReceipt(null);
            fetchSeats();
          }}
        />
      )}
    </div>
  );
}
