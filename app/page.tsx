"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
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

export default function SeatsPage() {
  const [seats, setSeats] = useState<SeatData[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<SeatData | null>(null);
  const [vacating, setVacating] = useState<number | null>(null);
  const [editingReceipt, setEditingReceipt] = useState<EditableReceipt | null>(null);
  const [filterStatus, setFilterStatus] = useState<"all" | "double_shift" | "full_day" | "half_day" | "free" | "due">("all");

  const fetchSeats = () => {
    fetch("/api/seats")
      .then((r) => r.json())
      .then((data) => {
        setSeats(Array.isArray(data) ? data : []);
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchSeats();
  }, []);

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

  const doubleShiftSeats = seats.filter(isSeatDoubleShift);

  const matchesFilter = (s: SeatData) => {
    if (filterStatus === "all") return true;
    if (filterStatus === "double_shift") return isSeatDoubleShift(s);
    if (filterStatus === "full_day") return isSeatFullDay(s);
    if (filterStatus === "half_day") return isSeatHalfDay(s);
    if (filterStatus === "free") return !s.occupied;
    if (filterStatus === "due") return isSeatDue(s);
    return true;
  };

  const shiftLabel = (shift: string | null) =>
    shift === "shift_1" || shift === "morning"
      ? "Shift 1 (6am–2pm)"
      : shift === "shift_2" || shift === "evening"
        ? "Shift 2 (2pm–12am)"
        : shift === "shift_3"
          ? "Shift 3 (4pm–12am)"
          : "";

  const seatColor = (s: SeatData) => {
    if (!s.occupied) {
      return "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 hover:border-emerald-500/40 hover:shadow-[0_0_10px_rgba(16,185,129,0.15)] hover:-translate-y-0.5";
    }

    // Overdue seat: Blue
    if (s.is_overdue || s.status === "due") {
      return "bg-blue-500/15 text-blue-700 dark:text-blue-400 border border-blue-500/40 hover:bg-blue-500/25 hover:border-blue-500/60 hover:shadow-[0_0_12px_rgba(59,130,246,0.3)] hover:-translate-y-0.5";
    }

    // Partial due (1 active half-day + 1 overdue shift)
    if (s.status === "partial_due") {
      return "bg-gradient-to-br from-blue-500/20 to-amber-500/20 text-blue-700 dark:text-blue-300 border border-blue-400/50 hover:border-blue-500/70 hover:shadow-[0_0_12px_rgba(59,130,246,0.25)] hover:-translate-y-0.5";
    }

    // Double shifted: 2 different shift students sharing this seat -> Distinct Purple / Violet!
    if (isSeatDoubleShift(s)) {
      return "bg-purple-500/15 text-purple-700 dark:text-purple-300 border border-purple-500/40 hover:bg-purple-500/25 hover:border-purple-500/60 hover:shadow-[0_0_12px_rgba(168,85,247,0.3)] hover:-translate-y-0.5";
    }

    // Single student Full Day: Red
    if (isSeatFullDay(s)) {
      return "bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-500/20 hover:bg-rose-500/20 hover:border-rose-500/40 hover:shadow-[0_0_10px_rgba(244,63,94,0.15)] hover:-translate-y-0.5";
    }

    // Single shift half day: Amber
    return "bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20 hover:bg-amber-500/20 hover:border-amber-500/40 hover:shadow-[0_0_10px_rgba(245,158,11,0.15)] hover:-translate-y-0.5";
  };

  const getRenewUrl = (r: ReceiptData) => {
    const today = new Date().toISOString().split("T")[0];
    let nextStart = today;
    if (r.end_date >= today) {
      const parts = r.end_date.split("-");
      const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
      d.setDate(d.getDate() + 1);
      nextStart = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    }
    
    const params = new URLSearchParams({
      student_id: r.student_id.toString(),
      seat_number: selected?.seat_number.toString() || "",
      subscription_type: r.subscription_type,
      shift_type: r.shift_type || "",
      has_sheet: r.has_sheet.toString(),
      amount: r.amount_paid.toString(),
      start_date: nextStart,
    });
    return `/new-receipt?${params.toString()}`;
  };

  const handleVacate = async (receipt_no: number, isOverdue = false) => {
    const msg = isOverdue
      ? "Are you sure you want to officially vacate this overdue seat? The seat will immediately turn green and become available for booking."
      : "Are you sure you want to vacate this seat/shift early? This will make the seat available for the shift immediately.";
    if (!confirm(msg)) return;
    setVacating(receipt_no);
    try {
      const res = await fetch("/api/receipts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ receipt_no }),
      });
      if (res.ok) {
        // Refresh seats data
        const seatsRes = await fetch("/api/seats");
        const updatedSeats = await seatsRes.json();
        const seatsArr = Array.isArray(updatedSeats) ? updatedSeats : [];
        setSeats(seatsArr);
        
        // Also update the selected seat details in the modal
        if (selected) {
          const updatedSelected = seatsArr.find((s) => s.seat_id === selected.seat_id);
          setSelected(updatedSelected || null);
        }
      } else {
        const error = await res.json();
        alert(`Error: ${error.error || "Failed to vacate seat"}`);
      }
    } catch (err: any) {
      alert(`Error: ${err.message || "Failed to vacate seat"}`);
    } finally {
      setVacating(null);
    }
  };

  if (loading && seats.length === 0) return <p className="text-text-muted text-center py-10">Loading seat layout...</p>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4 bg-panel-bg border border-panel-border rounded-xl p-6 backdrop-blur-md">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.5)]" />
            Interactive Seat Overview
          </h1>
          <p className="text-xs text-text-muted mt-1">Select a seat block to review active subscriptions or book an available shift.</p>
        </div>
        <div className="flex gap-2 text-xs font-semibold bg-background/50 border border-panel-border p-2 rounded-xl shadow-inner flex-wrap items-center">
          <button
            onClick={() => setFilterStatus("all")}
            className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
              filterStatus === "all"
                ? "bg-foreground/10 text-foreground font-bold shadow-xs"
                : "text-text-muted hover:text-foreground"
            }`}
          >
            All ({seats.length})
          </button>
          <button
            onClick={() => setFilterStatus(filterStatus === "free" ? "all" : "free")}
            className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
              filterStatus === "free"
                ? "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 font-bold ring-1 ring-emerald-500/40"
                : "text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10"
            }`}
          >
            <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500/20 border border-emerald-500/40 inline-block" /> Free ({freeCount})
          </button>
          <button
            onClick={() => setFilterStatus(filterStatus === "half_day" ? "all" : "half_day")}
            className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
              filterStatus === "half_day"
                ? "bg-amber-500/20 text-amber-800 dark:text-amber-300 font-bold ring-1 ring-amber-500/40"
                : "text-amber-700 dark:text-amber-400 hover:bg-amber-500/10"
            }`}
          >
            <span className="w-2.5 h-2.5 rounded-sm bg-amber-500/20 border border-amber-500/40 inline-block" /> Half-day ({partialCount})
          </button>
          <button
            onClick={() => setFilterStatus(filterStatus === "full_day" ? "all" : "full_day")}
            className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
              filterStatus === "full_day"
                ? "bg-rose-500/20 text-rose-800 dark:text-rose-300 font-bold ring-1 ring-rose-500/40"
                : "text-rose-600 dark:text-rose-400 hover:bg-rose-500/10"
            }`}
          >
            <span className="w-2.5 h-2.5 rounded-sm bg-rose-500/20 border border-rose-500/40 inline-block" /> Full Day ({fullDayCount})
          </button>
          <button
            onClick={() => setFilterStatus(filterStatus === "double_shift" ? "all" : "double_shift")}
            className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
              filterStatus === "double_shift"
                ? "bg-purple-500/25 text-purple-800 dark:text-purple-200 font-bold ring-2 ring-purple-500/50 shadow-sm"
                : "text-purple-600 dark:text-purple-400 hover:bg-purple-500/10"
            }`}
          >
            <span className="w-2.5 h-2.5 rounded-sm bg-purple-500/30 border border-purple-500/50 inline-block" /> Double Shifted ({doubleShiftCount})
          </button>
          <button
            onClick={() => setFilterStatus(filterStatus === "due" ? "all" : "due")}
            className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
              filterStatus === "due"
                ? "bg-blue-500/20 text-blue-800 dark:text-blue-200 font-bold ring-1 ring-blue-500/40"
                : "text-blue-600 dark:text-blue-400 hover:bg-blue-500/10"
            }`}
          >
            <span className="w-2.5 h-2.5 rounded-sm bg-blue-500/20 border border-blue-500/40 inline-block" /> Fees Due ({dueCount})
          </button>
        </div>
      </div>

      {filterStatus === "double_shift" && (
        <div className="bg-purple-500/10 border border-purple-500/30 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-in fade-in duration-200">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-base">👥</span>
              <h3 className="text-sm font-bold text-foreground">
                Double Shifted Seats ({doubleShiftSeats.length})
              </h3>
            </div>
            <p className="text-xs text-text-muted mt-0.5">
              These seats are split across shifts and occupied by 2 different students. Click any seat below to inspect both occupants:
            </p>
          </div>
          <div className="flex flex-wrap gap-1.5 max-w-lg">
            {doubleShiftSeats.map((s) => (
              <button
                key={s.seat_id}
                onClick={() => setSelected(s)}
                className="px-2.5 py-1 rounded-lg text-xs font-bold bg-purple-500/20 text-purple-700 dark:text-purple-300 border border-purple-500/40 hover:bg-purple-500/35 hover:scale-105 transition cursor-pointer"
              >
                Seat {s.seat_number}
              </button>
            ))}
            {doubleShiftSeats.length === 0 && (
              <span className="text-xs text-text-muted italic py-1">No double shifted seats currently booked.</span>
            )}
          </div>
        </div>
      )}

      <div className="bg-panel-bg border border-panel-border rounded-xl p-6 backdrop-blur-xs">
        <div className="grid grid-cols-10 sm:grid-cols-15 md:grid-cols-20 gap-2">
          {seats.map((s) => {
            const matches = matchesFilter(s);
            const isDouble = isSeatDoubleShift(s);
            const tooltip = s.occupied
              ? s.receipts?.map((r) => `${r.member?.name} (${r.subscription_type === 'full_day' ? 'Full Day' : r.shift_type})`).join(", ")
              : "Free";
            return (
              <button
                key={s.seat_id}
                onClick={() => setSelected(s)}
                className={`aspect-square rounded-lg text-[10px] font-bold flex flex-col items-center justify-center transition-all duration-200 cursor-pointer relative ${seatColor(s)} ${
                  !matches ? "opacity-20 scale-95" : filterStatus !== "all" ? "ring-2 ring-purple-500 shadow-md scale-105 z-10" : ""
                }`}
                title={tooltip}
              >
                <span>{s.seat_number}</span>
                {isDouble && (
                  <span className="flex gap-0.5 pointer-events-none mt-[-2px]">
                    <span className="w-1 h-1 rounded-full bg-purple-600 dark:bg-purple-300 inline-block" />
                    <span className="w-1 h-1 rounded-full bg-purple-600 dark:bg-purple-300 inline-block" />
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {selected && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-xs flex items-center justify-center z-50 p-4" onClick={() => setSelected(null)}>
          <div
            className="bg-card-bg border border-card-border rounded-2xl p-6 w-full max-w-md shadow-2xl relative overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Background design glow */}
            <div className="absolute top-0 right-0 w-28 h-28 bg-radial from-rose-500/10 to-transparent pointer-events-none" />

            <div className="flex justify-between items-center mb-5 pb-3 border-b border-panel-border">
              <div>
                <h2 className="text-xl font-extrabold text-foreground flex items-center gap-2">
                  Seat {selected.seat_number}
                </h2>
                <p className="text-[10px] text-text-muted mt-0.5">Workspace details</p>
              </div>
              <span className={`px-2.5 py-1 rounded-full text-[9px] uppercase font-extrabold tracking-wider border ${
                !selected.occupied 
                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                  : selected.is_overdue || selected.status === "due"
                    ? "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/40"
                    : selected.status === "partial_due"
                      ? "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/40"
                      : isSeatDoubleShift(selected)
                        ? "bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/35"
                        : selected.receipts?.some(r => r.subscription_type === "full_day")
                          ? "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20"
                          : "bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20"
              }`}>
                {!selected.occupied
                  ? "Free"
                  : selected.is_overdue || selected.status === "due"
                    ? `Fees Due (${selected.receipts?.find(r => r.is_overdue)?.days_overdue || 1}d overdue)`
                    : selected.status === "partial_due"
                      ? "Partial Due"
                      : isSeatDoubleShift(selected)
                        ? "👥 Double Shifted"
                        : selected.receipts?.some(r => r.subscription_type === "full_day")
                          ? "Full Day"
                          : `${shiftLabel(selected.receipts[0].shift_type)} Occupied`
              }
              </span>
            </div>

            {selected.occupied ? (
              <div className="space-y-4">
                {isSeatDoubleShift(selected) && (
                  <div className="bg-purple-500/10 border border-purple-500/25 rounded-xl p-3 text-xs text-purple-700 dark:text-purple-300 flex items-center justify-between">
                    <span className="font-bold flex items-center gap-1.5">
                      <span>👥</span> Double Shifted Seat
                    </span>
                    <span className="text-[10px] bg-purple-500/20 text-purple-700 dark:text-purple-200 px-2.5 py-0.5 rounded-full font-extrabold uppercase tracking-wider">
                      2 Active Shifts
                    </span>
                  </div>
                )}
                {selected.receipts?.map((r, idx) => (
                  <div key={r.receipt_no} className="bg-background border border-card-border rounded-xl p-4 relative shadow-inner">
                    {r.is_overdue && (
                      <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-2.5 text-xs text-blue-700 dark:text-blue-300 flex items-center justify-between mb-3">
                        <span className="font-semibold flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse inline-block" />
                          Fees Overdue ({r.days_overdue} day{r.days_overdue === 1 ? "" : "s"})
                        </span>
                        <span className="text-[10px] bg-blue-500/20 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded font-bold">
                          Expired {r.end_date}
                        </span>
                      </div>
                    )}
                    {selected.receipts.length > 1 && (
                      <div className={`text-[9px] font-extrabold uppercase tracking-widest mb-3 flex items-center gap-1.5 ${
                        isSeatDoubleShift(selected) ? "text-purple-600 dark:text-purple-400" : "text-rose-600 dark:text-rose-400"
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full inline-block ${
                          isSeatDoubleShift(selected) ? "bg-purple-500" : "bg-rose-500 animate-pulse"
                        }`} />
                        Occupant {idx + 1} &middot; {shiftLabel(r.shift_type)}
                      </div>
                    )}
                    <div className="space-y-2 text-sm text-text-details">
                      <div className="flex justify-between py-1 border-b border-panel-border/30">
                        <span className="text-text-muted">Name:</span>
                        <span className="font-semibold text-foreground">{r.member?.name}</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-panel-border/30">
                        <span className="text-text-muted">Member ID:</span>
                        <span className="font-mono text-text-details font-semibold">#{r.student_id}</span>
                      </div>
                      {r.member?.phone && (
                        <div className="flex justify-between py-1 border-b border-panel-border/30">
                          <span className="text-text-muted">Phone:</span>
                          <span className="text-text-details">{r.member.phone}</span>
                        </div>
                      )}
                      {r.member?.aadhar_no && (
                        <div className="flex justify-between py-1 border-b border-panel-border/30">
                          <span className="text-text-muted">Aadhaar:</span>
                          <span className="font-mono text-text-details text-xs">
                            •••• •••• {r.member.aadhar_no.replace(/\s+/g, "").slice(-4)}
                          </span>
                        </div>
                      )}
                      <div className="flex justify-between py-1 border-b border-panel-border/30">
                        <span className="text-text-muted">Subscription:</span>
                        <span className="text-text-details font-medium">
                          {r.subscription_type === "full_day"
                            ? "Full day (6am–12am)"
                            : `Half day (${shiftLabel(r.shift_type)})`}
                        </span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-panel-border/30">
                        <span className="text-text-muted">Sheets Desk:</span>
                        <span className="text-text-details">{r.has_sheet ? "Included (₹300)" : "None"}</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-panel-border/30">
                        <span className="text-text-muted">Valid till:</span>
                        <span className="font-semibold text-text-main flex items-center gap-1.5">
                          <span className={r.is_overdue ? "text-blue-600 dark:text-blue-400 font-bold" : "text-rose-600 dark:text-rose-400"}>{r.end_date}</span>
                          {(() => {
                            if (r.is_overdue) {
                              return <span className="text-[10px] bg-blue-500/15 text-blue-600 dark:text-blue-400 px-1.5 py-0.5 rounded font-bold">{r.days_overdue}d overdue</span>;
                            }
                            const today = new Date().toISOString().split("T")[0];
                            const diffTime = new Date(r.end_date).getTime() - new Date(today).getTime();
                            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                            if (diffDays === 0) return <span className="text-[10px] bg-amber-500/15 text-amber-600 dark:text-amber-400 px-1.5 py-0.5 rounded font-bold">Expires Today</span>;
                            if (diffDays > 0) return <span className="text-[10px] bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 px-1.5 py-0.5 rounded font-bold">{diffDays}d left</span>;
                            return <span className="text-[10px] bg-blue-500/15 text-blue-600 dark:text-blue-400 px-1.5 py-0.5 rounded font-bold">Overdue</span>;
                          })()}
                        </span>
                      </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-panel-border/40 flex gap-2 flex-wrap items-center">
                      <Link
                        href={getRenewUrl(r)}
                        className="bg-rose-600 hover:bg-rose-500 text-white text-xs px-3.5 py-2 rounded-lg font-semibold shadow-md shadow-rose-600/20 transition-all duration-200 cursor-pointer hover:-translate-y-0.5"
                      >
                        Renew
                      </Link>
                      {r.member?.phone && r.is_overdue && (
                        <a
                          href={`https://wa.me/91${r.member.phone.replace(/[^0-9]/g, "").slice(-10)}?text=${encodeURIComponent(
                            `Hello ${r.member.name}, this is a gentle reminder from The Target Library regarding Seat ${selected.seat_number}. Your subscription expired on ${r.end_date} (${r.days_overdue} day${r.days_overdue === 1 ? "" : "s"} ago). Please pay your renewal fee to retain your seat. Thank you!`
                          )}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs px-3.5 py-2 rounded-lg font-semibold transition-all duration-200 cursor-pointer flex items-center gap-1 shadow-md shadow-emerald-600/20 hover:-translate-y-0.5"
                          title="Send WhatsApp payment reminder"
                        >
                          💬 WhatsApp
                        </a>
                      )}
                      <button
                        disabled={vacating === r.receipt_no}
                        onClick={() => handleVacate(r.receipt_no, r.is_overdue)}
                        className={`${
                          r.is_overdue
                            ? "bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/30"
                            : "bg-panel-bg hover:bg-neutral-200 dark:hover:bg-neutral-800 text-text-muted hover:text-red-500 border border-card-border"
                        } text-xs px-3.5 py-2 rounded-lg font-semibold transition-all duration-200 cursor-pointer disabled:opacity-50`}
                      >
                        {vacating === r.receipt_no ? "Vacating..." : r.is_overdue ? "Vacate Seat" : "Vacate"}
                      </button>
                      <button
                        onClick={() =>
                          setEditingReceipt({
                            receipt_no: r.receipt_no,
                            student_id: r.student_id,
                            student_name: r.member?.name,
                            student_phone: r.member?.phone,
                            aadhar_no: r.member?.aadhar_no,
                            seat_id: selected.seat_id,
                            seat_number: selected.seat_number,
                            subscription_type: r.subscription_type,
                            shift_type: r.shift_type,
                            has_sheet: r.has_sheet,
                            amount_paid: r.amount_paid,
                            start_date: r.start_date,
                            end_date: r.end_date,
                          })
                        }
                        className="bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-400 border border-amber-500/20 text-xs px-3.5 py-2 rounded-lg font-semibold transition-all duration-200 cursor-pointer"
                        title="Owner: Edit plan, fees, or cancel subscription"
                      >
                        ✏️ Edit Plan
                      </button>
                      <Link
                        href={`/receipts/${r.receipt_no}`}
                        className="bg-panel-bg hover:bg-neutral-200 dark:hover:bg-neutral-800 text-text-details border border-panel-border text-xs px-3.5 py-2 rounded-lg font-semibold transition-all duration-200 cursor-pointer flex items-center gap-1"
                      >
                        🎟️ Pass
                      </Link>
                      <Link
                        href={`/members/${r.student_id}`}
                        className="text-text-muted hover:text-rose-500 dark:hover:text-rose-400 text-xs font-semibold underline flex items-center ml-auto transition-colors"
                      >
                        History &rarr;
                      </Link>
                    </div>
                  </div>
                ))}

                {/* If seat is half_day and has room for another shift */}
                {selected.receipts?.length === 1 && selected.receipts[0].subscription_type === "half_day" && (
                  <div className="bg-panel-bg/35 border border-panel-border border-dashed rounded-xl p-4 text-center space-y-2">
                    <p className="text-xs text-text-muted">
                      Assign another non-overlapping shift to this seat:
                    </p>
                    <div className="flex flex-wrap gap-2 justify-center">
                      {selected.receipts[0].shift_type === "shift_1" || selected.receipts[0].shift_type === "morning" ? (
                        <>
                          <Link
                            href={`/new-receipt?seat_number=${selected.seat_number}&subscription_type=half_day&shift_type=shift_2`}
                            className="bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] px-3 py-1.5 rounded-lg font-semibold transition-all shadow-md shadow-emerald-600/10 cursor-pointer"
                          >
                            + Shift 2 (2pm-12am)
                          </Link>
                          <Link
                            href={`/new-receipt?seat_number=${selected.seat_number}&subscription_type=half_day&shift_type=shift_3`}
                            className="bg-blue-600 hover:bg-blue-500 text-white text-[10px] px-3 py-1.5 rounded-lg font-semibold transition-all shadow-md shadow-blue-600/10 cursor-pointer"
                          >
                            + Shift 3 (4pm-12am)
                          </Link>
                        </>
                      ) : (
                        <Link
                          href={`/new-receipt?seat_number=${selected.seat_number}&subscription_type=half_day&shift_type=shift_1`}
                          className="bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] px-4 py-2 rounded-lg font-semibold transition-all shadow-md shadow-emerald-600/10 cursor-pointer"
                        >
                          + Shift 1 (6am-2pm)
                        </Link>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-text-muted text-sm">This seat is completely unoccupied for both shifts.</p>
                <div className="flex flex-col gap-2">
                  <Link
                    href={`/new-receipt?seat_number=${selected.seat_number}&subscription_type=full_day`}
                    className="block text-center bg-rose-600 hover:bg-rose-500 text-white text-xs px-4 py-2.5 rounded-lg font-semibold shadow-md shadow-rose-600/20 transition-all cursor-pointer hover:-translate-y-0.5"
                  >
                    Assign Full Day (₹900 / ₹1200)
                  </Link>
                  <div className="grid grid-cols-3 gap-1.5">
                    <Link
                      href={`/new-receipt?seat_number=${selected.seat_number}&subscription_type=half_day&shift_type=shift_1`}
                      className="block text-center bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] py-2 rounded-lg font-semibold shadow-md shadow-emerald-600/15 transition-all cursor-pointer hover:-translate-y-0.5"
                    >
                      Shift 1 (₹600)
                    </Link>
                    <Link
                      href={`/new-receipt?seat_number=${selected.seat_number}&subscription_type=half_day&shift_type=shift_2`}
                      className="block text-center bg-amber-500 hover:bg-amber-400 text-neutral-955 text-[10px] py-2 rounded-lg font-semibold shadow-md shadow-amber-500/15 transition-all cursor-pointer hover:-translate-y-0.5"
                    >
                      Shift 2 (₹600)
                    </Link>
                    <Link
                      href={`/new-receipt?seat_number=${selected.seat_number}&subscription_type=half_day&shift_type=shift_3`}
                      className="block text-center bg-blue-600 hover:bg-blue-500 text-white text-[10px] py-2 rounded-lg font-semibold shadow-md shadow-blue-500/15 transition-all cursor-pointer hover:-translate-y-0.5"
                    >
                      Shift 3 (₹500)
                    </Link>
                  </div>
                </div>
              </div>
            )}

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setSelected(null)}
                className="bg-panel-bg hover:bg-neutral-200 dark:hover:bg-neutral-800 text-text-details border border-panel-border px-4 py-2 rounded-lg text-xs font-semibold transition cursor-pointer"
              >
                Close Layout
              </button>
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
          onSuccess={() => {
            fetchSeats();
            setSelected(null);
          }}
        />
      )}
    </div>
  );
}
