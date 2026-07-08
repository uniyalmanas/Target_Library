"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

export default function MemberProfilePage() {
  const params = useParams();
  const id = params.id as string;
  const [data, setData] = useState<{ member: any; receipts: any[] } | null>(null);
  const [vacating, setVacating] = useState(false);

  useEffect(() => {
    fetch(`/api/members/${id}`)
      .then((r) => r.json())
      .then(setData);
  }, [id]);

  if (!data) return <p className="text-neutral-400">Loading...</p>;
  if (!data.member) return <p className="text-red-400">Member not found.</p>;

  const { member, receipts } = data;
  const today = new Date().toISOString().split("T")[0];
  const activeReceipt = receipts.find((r) => r.end_date >= today);

  const shiftLabel = (shift: string | null) =>
    shift === "shift_1" || shift === "morning"
      ? "Shift 1 (6am–2pm)"
      : shift === "shift_2" || shift === "evening"
        ? "Shift 2 (2pm–12am)"
        : shift === "shift_3"
          ? "Shift 3 (4pm–12am)"
          : "Full day";

  const phone = member.phone;
  let activeWaUrl = "";
  if (activeReceipt && phone) {
    const text = `The Target Library\nReceipt No: ${activeReceipt.receipt_no}\nName: ${member.name}\nSeat No: ${activeReceipt.seats?.seat_number}\nType: ${shiftLabel(activeReceipt.shift_type)}\nAmount Paid: Rs ${activeReceipt.amount_paid}\nValid till: ${activeReceipt.end_date}\nDigital Pass & Invoice: ${window.location.origin}/receipts/${activeReceipt.receipt_no}`;
    const digits = phone.replace(/\D/g, "");
    const withCountryCode = digits.length === 10 ? `91${digits}` : digits;
    activeWaUrl = `https://wa.me/${withCountryCode}?text=${encodeURIComponent(text)}`;
  }

  const getRenewUrl = () => {
    if (receipts.length === 0) {
      return `/new-receipt?student_id=${member.student_id}`;
    }
    const mostRecent = receipts[0];
    const isExpired = mostRecent.end_date < today;
    let nextStart = today;
    if (!isExpired) {
      const parts = mostRecent.end_date.split("-");
      const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
      d.setDate(d.getDate() + 1);
      nextStart = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    }

    const params = new URLSearchParams({
      student_id: member.student_id.toString(),
      seat_number: mostRecent.seats?.seat_number?.toString() || "",
      subscription_type: mostRecent.subscription_type,
      shift_type: mostRecent.shift_type || "",
      has_sheet: mostRecent.has_sheet.toString(),
      amount: mostRecent.amount_paid.toString(),
      start_date: nextStart,
    });
    return `/new-receipt?${params.toString()}`;
  };

  const handleVacate = async (receipt_no: number) => {
    if (!confirm("Are you sure you want to vacate this seat/shift early? This will make the seat available immediately.")) return;
    setVacating(true);
    try {
      const res = await fetch("/api/receipts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ receipt_no }),
      });
      if (res.ok) {
        // Refetch member details
        const r = await fetch(`/api/members/${id}`);
        const updated = await r.json();
        setData(updated);
      } else {
        const error = await res.json();
        alert(`Error vacating seat: ${error.error || "Unknown error"}`);
      }
    } catch (err: any) {
      alert(`Error vacating seat: ${err.message || "Unknown error"}`);
    } finally {
      setVacating(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="mb-4">
        <Link href="/members" className="text-xs font-semibold text-rose-600 dark:text-rose-500 hover:underline transition-all flex items-center gap-1.5">
          <span>&larr;</span> Back to Member Directory
        </Link>
      </div>

      {/* Profile Header Card */}
      <div className="bg-panel-bg border border-panel-border rounded-2xl p-6 backdrop-blur-md shadow-xl flex justify-between items-center flex-wrap gap-4 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-rose-500/[calc(var(--glow-opacity)*0.5)] to-transparent pointer-events-none" />
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-foreground">{member.name}</h1>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-text-muted mt-2">
            <span className="flex items-center gap-1">
              Member ID: <span className="font-mono text-foreground font-semibold">#{member.student_id}</span>
            </span>
            <span>&bull;</span>
            <span>Joined: <span className="text-text-details font-medium">{member.date_of_joining}</span></span>
            {member.phone && (
              <>
                <span>&bull;</span>
                <span>Phone: <span className="text-text-details font-medium">{member.phone}</span></span>
              </>
            )}
          </div>
        </div>

        <div className="flex gap-3">
          <Link
            href={getRenewUrl()}
            className="bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs px-4 py-2.5 rounded-lg shadow-md shadow-rose-600/10 transition-all duration-200 cursor-pointer hover:-translate-y-0.5"
          >
            {activeReceipt ? "Renew Subscription" : "Add Subscription / Assign Seat"}
          </Link>
        </div>
      </div>

      {/* Active Subscription Banner */}
      {activeReceipt ? (
        <div className="bg-emerald-500/10 border border-emerald-500/25 rounded-2xl p-5 text-sm flex justify-between items-center flex-wrap gap-4">
          <div>
            <div className="text-[10px] font-extrabold uppercase tracking-widest text-emerald-600 dark:text-emerald-400 mb-1 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block animate-pulse" />
              Active Subscription
            </div>
            <p className="text-foreground text-base font-semibold">
              Seat {activeReceipt.seats?.seat_number} &middot; {shiftLabel(activeReceipt.shift_type)}
              {activeReceipt.has_sheet ? " (with sheet)" : ""}
            </p>
            <p className="text-xs text-text-muted mt-1">Valid until {activeReceipt.end_date}</p>
          </div>
          <div className="flex gap-2 items-center">
            {activeWaUrl && (
              <a
                href={activeWaUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs px-4 py-2 rounded-lg font-semibold transition-all duration-200 cursor-pointer flex items-center gap-1 hover:-translate-y-0.5"
              >
                💬 Share Pass
              </a>
            )}
            <Link
              href={`/receipts/${activeReceipt.receipt_no}`}
              className="bg-panel-bg hover:bg-neutral-200 dark:hover:bg-neutral-800 text-text-details border border-panel-border text-xs px-4 py-2 rounded-lg font-semibold transition-all duration-200 cursor-pointer flex items-center gap-1"
            >
              🎟️ View Pass
            </Link>
            <button
              disabled={vacating}
              onClick={() => handleVacate(activeReceipt.receipt_no)}
              className="bg-panel-bg hover:bg-neutral-200 dark:hover:bg-neutral-800 text-text-muted hover:text-red-500 border border-card-border text-xs px-4 py-2 rounded-lg font-semibold transition-all duration-200 cursor-pointer disabled:opacity-50"
            >
              {vacating ? "Vacating..." : "Vacate Seat"}
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-panel-bg border border-panel-border border-dashed rounded-2xl p-6 text-center text-sm text-text-muted">
          ⚠️ This member currently has no active study space subscription.
        </div>
      )}

      {/* Payment History Timeline */}
      <div className="space-y-3">
        <h2 className="text-sm font-bold uppercase tracking-wider text-text-muted">Payment &amp; Billing History</h2>
        <div className="space-y-2.5">
          {receipts.map((r) => (
            <div
              key={r.receipt_no}
              className="bg-card-bg border border-card-border hover:border-rose-500/40 rounded-xl p-4 flex justify-between items-center flex-wrap gap-2 text-sm transition-all duration-200 shadow-sm"
            >
              <div>
                <p className="font-semibold text-foreground">
                  Receipt #{r.receipt_no} &bull; Seat {r.seats?.seat_number}
                </p>
                <p className="text-xs text-text-muted mt-1">
                  Type: {shiftLabel(r.shift_type)} {r.has_sheet && "(with sheet/desk space)"} &bull; Valid: {r.start_date} &rarr; {r.end_date}
                </p>
              </div>
              <div className="text-right flex flex-col items-end">
                <span className="font-mono font-extrabold text-foreground text-base">₹{r.amount_paid}</span>
                <div className="flex gap-3 items-center mt-1">
                  <Link
                    href={`/receipts/${r.receipt_no}`}
                    className="text-[10px] text-rose-600 dark:text-rose-400 font-bold hover:underline"
                  >
                    🎟️ Digital Pass
                  </Link>
                  <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold uppercase tracking-wider">Paid</span>
                </div>
              </div>
            </div>
          ))}
          {receipts.length === 0 && (
            <p className="text-xs text-text-muted text-center py-6">No previous transactions on file.</p>
          )}
        </div>
      </div>
    </div>
  );
}
