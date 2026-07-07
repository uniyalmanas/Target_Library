"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface MemberData {
  student_id: number;
  name: string;
  phone: string | null;
}

interface ReceiptData {
  receipt_no: number;
  student_id: number;
  subscription_type: "full_day" | "half_day";
  shift_type: "morning" | "evening" | null;
  has_sheet: boolean;
  amount_paid: number;
  start_date: string;
  end_date: string;
  member: MemberData | null;
}

interface SeatData {
  seat_id: number;
  seat_number: number;
  occupied: boolean;
  receipts: ReceiptData[];
}

export default function SeatsPage() {
  const [seats, setSeats] = useState<SeatData[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<SeatData | null>(null);
  const [vacating, setVacating] = useState<number | null>(null);

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

  const freeCount = seats.filter((s) => !s.occupied).length;
  
  const partialCount = seats.filter(
    (s) => s.occupied && s.receipts?.length === 1 && s.receipts[0].subscription_type === "half_day"
  ).length;

  const fullOccupiedCount = seats.filter(
    (s) =>
      s.occupied &&
      (s.receipts?.some((r) => r.subscription_type === "full_day") || s.receipts?.length === 2)
  ).length;

  const shiftLabel = (shift: string | null) =>
    shift === "morning" ? "6am–2pm" : shift === "evening" ? "2pm–12am" : "";

  const seatColor = (s: SeatData) => {
    if (!s.occupied) {
      return "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 hover:border-emerald-500/40 hover:shadow-[0_0_10px_rgba(16,185,129,0.15)] hover:-translate-y-0.5";
    }
    
    const isFullDay = s.receipts?.some((r) => r.subscription_type === "full_day");
    const isBothShifts = s.receipts?.length === 2;

    if (isFullDay || isBothShifts) {
      return "bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-500/20 hover:bg-rose-500/20 hover:border-rose-500/40 hover:shadow-[0_0_10px_rgba(244,63,94,0.15)] hover:-translate-y-0.5";
    }
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

  const handleVacate = async (receipt_no: number) => {
    if (!confirm("Are you sure you want to vacate this seat/shift early? This will make the seat available for the shift immediately.")) return;
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
        <div className="flex gap-4 text-xs font-semibold bg-background/50 border border-panel-border p-3 rounded-lg shadow-inner">
          <span className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
            <span className="w-3 h-3 rounded-md bg-emerald-500/10 border border-emerald-500/25 inline-block" /> Free ({freeCount})
          </span>
          <span className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
            <span className="w-3 h-3 rounded-md bg-amber-500/10 border border-amber-500/25 inline-block" /> Half-day ({partialCount})
          </span>
          <span className="flex items-center gap-2 text-rose-600 dark:text-rose-400">
            <span className="w-3 h-3 rounded-md bg-rose-500/10 border border-rose-500/25 inline-block" /> Fully Occupied ({fullOccupiedCount})
          </span>
        </div>
      </div>

      <div className="bg-panel-bg border border-panel-border rounded-xl p-6 backdrop-blur-xs">
        <div className="grid grid-cols-10 sm:grid-cols-15 md:grid-cols-20 gap-2">
          {seats.map((s) => {
            const tooltip = s.occupied
              ? s.receipts?.map((r) => `${r.member?.name} (${r.subscription_type === 'full_day' ? 'Full Day' : r.shift_type})`).join(", ")
              : "Free";
            return (
              <button
                key={s.seat_id}
                onClick={() => setSelected(s)}
                className={`aspect-square rounded-lg text-[10px] font-bold flex items-center justify-center transition-all duration-200 cursor-pointer ${seatColor(s)}`}
                title={tooltip}
              >
                {s.seat_number}
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
                  : selected.receipts?.some(r => r.subscription_type === "full_day") || selected.receipts?.length === 2
                    ? "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20"
                    : "bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20"
              }`}>
                {!selected.occupied
                  ? "Free"
                  : selected.receipts?.some(r => r.subscription_type === "full_day")
                    ? "Full Day"
                    : selected.receipts?.length === 2
                      ? "Fully Occupied"
                      : `${selected.receipts[0].shift_type === 'morning' ? 'Morning occupied' : 'Evening occupied'}`
              }
              </span>
            </div>

            {selected.occupied ? (
              <div className="space-y-4">
                {selected.receipts?.map((r, idx) => (
                  <div key={r.receipt_no} className="bg-background border border-card-border rounded-xl p-4 relative shadow-inner">
                    {selected.receipts.length > 1 && (
                      <div className="text-[9px] text-rose-600 dark:text-rose-400 font-extrabold uppercase tracking-widest mb-3 flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-500 inline-block animate-pulse" />
                        Occupant {idx + 1} &middot; {r.shift_type === "morning" ? "Morning Shift" : "Evening Shift"}
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
                        <span className="text-rose-600 dark:text-rose-400 font-semibold">{r.end_date}</span>
                      </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-panel-border/40 flex gap-2 flex-wrap items-center">
                      <Link
                        href={getRenewUrl(r)}
                        className="bg-rose-600 hover:bg-rose-500 text-white text-xs px-3.5 py-2 rounded-lg font-semibold shadow-md shadow-rose-600/20 transition-all duration-200 cursor-pointer hover:-translate-y-0.5"
                      >
                        Renew
                      </Link>
                      <button
                        disabled={vacating === r.receipt_no}
                        onClick={() => handleVacate(r.receipt_no)}
                        className="bg-panel-bg hover:bg-neutral-200 dark:hover:bg-neutral-800 text-text-muted hover:text-red-500 border border-card-border text-xs px-3.5 py-2 rounded-lg font-semibold transition-all duration-200 cursor-pointer disabled:opacity-50"
                      >
                        {vacating === r.receipt_no ? "Vacating..." : "Vacate"}
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

                {/* If seat is half_day and only one shift is occupied, allow staff to assign the empty shift */}
                {selected.receipts?.length === 1 && selected.receipts[0].subscription_type === "half_day" && (
                  <div className="bg-panel-bg/35 border border-panel-border border-dashed rounded-xl p-4 text-center">
                    <p className="text-xs text-text-muted mb-3">
                      The{" "}
                      <span className="text-emerald-600 dark:text-emerald-400 font-bold uppercase tracking-wider">
                        {selected.receipts[0].shift_type === "morning" ? "evening" : "morning"}
                      </span>{" "}
                      shift is currently free.
                    </p>
                    <Link
                      href={`/new-receipt?seat_number=${selected.seat_number}&subscription_type=half_day&shift_type=${
                        selected.receipts[0].shift_type === "morning" ? "evening" : "morning"
                      }`}
                      className="inline-block bg-emerald-600 hover:bg-emerald-500 text-white text-xs px-4 py-2 rounded-lg font-semibold transition-all shadow-md shadow-emerald-600/10 cursor-pointer hover:-translate-y-0.5"
                    >
                      Assign {selected.receipts[0].shift_type === "morning" ? "Evening" : "Morning"} Shift
                    </Link>
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
                  <div className="grid grid-cols-2 gap-2">
                    <Link
                      href={`/new-receipt?seat_number=${selected.seat_number}&subscription_type=half_day&shift_type=morning`}
                      className="block text-center bg-emerald-600 hover:bg-emerald-500 text-white text-xs px-3 py-2 rounded-lg font-semibold shadow-md shadow-emerald-600/15 transition-all cursor-pointer hover:-translate-y-0.5"
                    >
                      Assign Morning (₹600)
                    </Link>
                    <Link
                      href={`/new-receipt?seat_number=${selected.seat_number}&subscription_type=half_day&shift_type=evening`}
                      className="block text-center bg-amber-500 hover:bg-amber-400 text-neutral-950 text-xs px-3 py-2 rounded-lg font-semibold shadow-md shadow-amber-500/15 transition-all cursor-pointer hover:-translate-y-0.5"
                    >
                      Assign Evening (₹600)
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
    </div>
  );
}
