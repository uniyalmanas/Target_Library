"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";

const PRICING: Record<string, { base: number; with_sheet: number }> = {
  full_day: { base: 900, with_sheet: 1200 },
  half_day: { base: 600, with_sheet: 900 },
};

function NewReceiptForm() {
  const params = useSearchParams();
  const router = useRouter();
  
  // Parse presets from URL (if coming from Renew flow)
  const presetSeat = params.get("seat_number") || "";
  const presetStudentId = params.get("student_id") || "";
  const presetSubscriptionType = params.get("subscription_type") as "full_day" | "half_day" | null;
  const presetShiftType = params.get("shift_type") as "morning" | "evening" | null;
  const presetHasSheet = params.get("has_sheet") === "true";
  const presetAmount = params.get("amount") ? Number(params.get("amount")) : null;
  const presetStartDate = params.get("start_date") || "";

  const [existingStudentId, setExistingStudentId] = useState(presetStudentId);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [seatNumber, setSeatNumber] = useState(presetSeat);
  const [subscriptionType, setSubscriptionType] = useState<"full_day" | "half_day">(
    presetSubscriptionType || "full_day"
  );
  const [shiftType, setShiftType] = useState<"morning" | "evening">(
    presetShiftType || "morning"
  );
  const [hasSheet, setHasSheet] = useState(presetHasSheet);
  const [amount, setAmount] = useState<number>(
    presetAmount ?? PRICING[presetSubscriptionType || "full_day"][presetHasSheet ? "with_sheet" : "base"]
  );
  const [startDate, setStartDate] = useState(
    presetStartDate || new Date().toISOString().split("T")[0]
  );
  
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [whatsappLink, setWhatsappLink] = useState<string | null>(null);
  const [sendingWhatsapp, setSendingWhatsapp] = useState(false);
  const [whatsappStatus, setWhatsappStatus] = useState<"idle" | "sending" | "sent" | "simulated" | "failed">("idle");

  // Live preview for existing members
  const [memberPreview, setMemberPreview] = useState<{ name: string; phone: string | null } | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [isInitialMount, setIsInitialMount] = useState(true);

  // Skip amount auto-suggestion on mount if a preset amount was provided
  useEffect(() => {
    if (isInitialMount && presetAmount !== null) {
      setIsInitialMount(false);
      return;
    }
    setAmount(PRICING[subscriptionType][hasSheet ? "with_sheet" : "base"]);
  }, [subscriptionType, hasSheet]);

  // Fetch member preview when existing student ID is typed/passed
  useEffect(() => {
    if (!existingStudentId) {
      setMemberPreview(null);
      return;
    }
    const delayDebounceFn = setTimeout(() => {
      setLoadingPreview(true);
      fetch(`/api/members/${existingStudentId}`)
        .then((r) => {
          if (r.ok) return r.json();
          throw new Error("Not found");
        })
        .then((data) => {
          if (data.member) {
            setMemberPreview({ name: data.member.name, phone: data.member.phone });
          } else {
            setMemberPreview(null);
          }
          setLoadingPreview(false);
        })
        .catch(() => {
          setMemberPreview(null);
          setLoadingPreview(false);
        });
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [existingStudentId]);

  async function lookupSeatId(seat_number: string) {
    try {
      const res = await fetch("/api/seats");
      const seats = await res.json();
      if (!Array.isArray(seats)) {
        console.error("Seats response is not an array:", seats);
        return null;
      }
      const found = seats.find((s: any) => String(s.seat_number) === String(seat_number));
      return found?.seat_id ?? null;
    } catch (err) {
      console.error("lookupSeatId error:", err);
      return null;
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setResult(null);
    setWhatsappLink(null);

    if (existingStudentId && !memberPreview && !name) {
      setResult({ ok: false, message: `Member ID #${existingStudentId} does not exist. Please fill in the Name field below to register as a new member with this custom ID, or double check the ID.` });
      setSubmitting(false);
      return;
    }

    const seat_id = await lookupSeatId(seatNumber);
    if (!seat_id) {
      setResult({ ok: false, message: `Seat number ${seatNumber} not found.` });
      setSubmitting(false);
      return;
    }

    const payload: any = {
      seat_id,
      subscription_type: subscriptionType,
      shift_type: subscriptionType === "half_day" ? shiftType : undefined,
      has_sheet: hasSheet,
      amount_paid: amount,
      start_date: startDate,
    };
    if (existingStudentId) {
      payload.student_id = Number(existingStudentId);
      if (!memberPreview) {
        payload.name = name;
        payload.phone = phone;
      }
    } else {
      payload.name = name;
      payload.phone = phone;
    }

    const res = await fetch("/api/receipts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    setSubmitting(false);

    if (!res.ok) {
      setResult({ ok: false, message: data.error || "Something went wrong" });
      return;
    }

    const end = new Date(startDate);
    end.setDate(end.getDate() + 30);
    const shiftLabel =
      subscriptionType === "half_day"
        ? shiftType === "morning"
          ? "6am–2pm"
          : "2pm–12am"
        : "Full day (6am–12am)";

    setResult({
      ok: true,
      message: `Receipt #${data.receipt.receipt_no} created for member #${data.student_id}, seat ${seatNumber}.`,
    });

    const activeName = existingStudentId ? (memberPreview?.name || "Member") : name;
    const activePhone = existingStudentId ? (memberPreview?.phone || "") : phone;

    if (activePhone) {
      setSendingWhatsapp(true);
      setWhatsappStatus("sending");
      try {
        const waRes = await fetch("/api/send-whatsapp", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ receipt_no: data.receipt.receipt_no }),
        });
        const waData = await waRes.json();
        if (waRes.ok && waData.success) {
          if (waData.simulated) {
            setWhatsappStatus("simulated");
            const text = waData.payload.text;
            const digits = activePhone.replace(/\D/g, "");
            const withCountryCode = digits.length === 10 ? `91${digits}` : digits;
            setWhatsappLink(`https://wa.me/${withCountryCode}?text=${encodeURIComponent(text)}`);
          } else {
            setWhatsappStatus("sent");
          }
        } else {
          setWhatsappStatus("failed");
          console.error("Auto WhatsApp failed:", waData.error);
          const digitalPassUrl = `${window.location.origin}/receipts/${data.receipt.receipt_no}`;
          const text = `The Target Library\nReceipt No: ${data.receipt.receipt_no}\nName: ${activeName}\nSeat No: ${seatNumber}\nType: ${shiftLabel}\nSheet: ${hasSheet ? "Yes" : "No"}\nAmount: Rs ${amount}\nDate: ${startDate}\nValid till: ${end.toISOString().split("T")[0]}\nDigital Pass & Invoice: ${digitalPassUrl}`;
          const digits = activePhone.replace(/\D/g, "");
          const withCountryCode = digits.length === 10 ? `91${digits}` : digits;
          setWhatsappLink(`https://wa.me/${withCountryCode}?text=${encodeURIComponent(text)}`);
        }
      } catch (err) {
        setWhatsappStatus("failed");
        console.error("Auto WhatsApp error:", err);
        const digitalPassUrl = `${window.location.origin}/receipts/${data.receipt.receipt_no}`;
        const text = `The Target Library\nReceipt No: ${data.receipt.receipt_no}\nName: ${activeName}\nSeat No: ${seatNumber}\nType: ${shiftLabel}\nSheet: ${hasSheet ? "Yes" : "No"}\nAmount: Rs ${amount}\nDate: ${startDate}\nValid till: ${end.toISOString().split("T")[0]}\nDigital Pass & Invoice: ${digitalPassUrl}`;
        const digits = activePhone.replace(/\D/g, "");
        const withCountryCode = digits.length === 10 ? `91${digits}` : digits;
        setWhatsappLink(`https://wa.me/${withCountryCode}?text=${encodeURIComponent(text)}`);
      } finally {
        setSendingWhatsapp(false);
      }
    }

    setName("");
    setPhone("");
    setExistingStudentId("");
    setSeatNumber("");
    setMemberPreview(null);
  }

  return (
    <div className="max-w-lg mx-auto">
      <div className="bg-panel-bg border border-panel-border rounded-2xl p-8 backdrop-blur-md shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-rose-500/[calc(var(--glow-opacity)*0.5)] to-transparent pointer-events-none" />
        
        <h1 className="text-xl font-bold tracking-tight text-foreground mb-6 flex items-center gap-2 pb-3 border-b border-panel-border">
          <span className="w-2.5 h-2.5 rounded-full bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.5)]" />
          Create Receipt &amp; Renewal
        </h1>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-xs font-semibold text-text-muted mb-1.5">
              Existing Member ID (leave blank if new member)
            </label>
            <input
              type="number"
              value={existingStudentId}
              onChange={(e) => setExistingStudentId(e.target.value)}
              placeholder="e.g. 1287"
              className="w-full bg-input-bg border border-input-border focus:border-rose-500/80 focus:ring-1 focus:ring-rose-500/30 rounded-lg px-3.5 py-2.5 text-sm text-foreground placeholder-text-muted transition-all duration-200 outline-none"
            />
            {loadingPreview && <p className="text-xs text-text-muted mt-1.5 animate-pulse">Verifying member ID...</p>}
            {!loadingPreview && memberPreview && (
              <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1.5 bg-emerald-500/10 border border-emerald-500/20 p-2.5 rounded-lg">
                ✅ Member found: <span className="font-semibold">{memberPreview.name}</span>
                {memberPreview.phone ? ` (Phone: ${memberPreview.phone})` : " (No phone on file)"}
              </p>
            )}
            {!loadingPreview && existingStudentId && !memberPreview && (
              <p className="text-xs text-rose-600 dark:text-rose-400 mt-1.5 bg-rose-500/10 border border-rose-500/20 p-2.5 rounded-lg">❌ Member ID not found. Enter a Name below to register a new member with ID {existingStudentId}, or leave blank.</p>
            )}
          </div>

          {(!existingStudentId || (existingStudentId && !memberPreview)) && (
            <div className="space-y-4 pt-2 border-t border-panel-border">
              <div>
                <label className="block text-xs font-semibold text-text-muted mb-1.5">Name</label>
                <input
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Full Name"
                  className="w-full bg-input-bg border border-input-border focus:border-rose-500/80 focus:ring-1 focus:ring-rose-500/30 rounded-lg px-3.5 py-2.5 text-sm text-foreground placeholder-text-muted transition-all duration-200 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-text-muted mb-1.5">
                  Phone (for WhatsApp receipt — optional)
                </label>
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="10-digit mobile number"
                  className="w-full bg-input-bg border border-input-border focus:border-rose-500/80 focus:ring-1 focus:ring-rose-500/30 rounded-lg px-3.5 py-2.5 text-sm text-foreground placeholder-text-muted transition-all duration-200 outline-none"
                />
                {!phone && (
                  <p className="text-[10px] text-amber-600 dark:text-amber-500/85 mt-1.5 flex items-center gap-1.5">
                    <span>⚠️</span> Leaving phone number blank will disable WhatsApp receipt sharing.
                  </p>
                )}
              </div>
            </div>
          )}

          <div className="pt-2 border-t border-panel-border">
            <label className="block text-xs font-semibold text-text-muted mb-1.5">Seat Number</label>
            <input
              required
              type="number"
              min={1}
              max={1000}
              value={seatNumber}
              onChange={(e) => setSeatNumber(e.target.value)}
              placeholder="e.g. 784"
              className="w-full bg-input-bg border border-input-border focus:border-rose-500/80 focus:ring-1 focus:ring-rose-500/30 rounded-lg px-3.5 py-2.5 text-sm text-foreground placeholder-text-muted transition-all duration-200 outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-text-muted mb-2">Subscription Type</label>
            <div className="flex gap-6">
              <label className="flex items-center gap-2 text-sm cursor-pointer select-none text-text-details hover:text-foreground transition-colors">
                <input
                  type="radio"
                  checked={subscriptionType === "full_day"}
                  onChange={() => setSubscriptionType("full_day")}
                  className="accent-rose-600 w-4 h-4"
                />
                Full day (6am–12am)
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer select-none text-text-details hover:text-foreground transition-colors">
                <input
                  type="radio"
                  checked={subscriptionType === "half_day"}
                  onChange={() => setSubscriptionType("half_day")}
                  className="accent-rose-600 w-4 h-4"
                />
                Half day
              </label>
            </div>
          </div>

          {subscriptionType === "half_day" && (
            <div className="bg-background border border-panel-border rounded-lg p-3 space-y-2">
              <label className="block text-[10px] font-extrabold uppercase tracking-wider text-text-muted">Shift Select</label>
              <div className="flex gap-6">
                <label className="flex items-center gap-2 text-sm cursor-pointer select-none text-text-details hover:text-foreground transition-colors">
                  <input
                    type="radio"
                    checked={shiftType === "morning"}
                    onChange={() => setShiftType("morning")}
                    className="accent-rose-600 w-4 h-4"
                  />
                  Morning (6am–2pm)
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer select-none text-text-details hover:text-foreground transition-colors">
                  <input
                    type="radio"
                    checked={shiftType === "evening"}
                    onChange={() => setShiftType("evening")}
                    className="accent-rose-600 w-4 h-4"
                  />
                  Evening (2pm–12am)
                </label>
              </div>
            </div>
          )}

          <div className="bg-background border border-panel-border rounded-lg p-3.5">
            <label className="flex items-center gap-2.5 text-sm cursor-pointer select-none text-text-details hover:text-foreground transition-colors">
              <input
                type="checkbox"
                checked={hasSheet}
                onChange={(e) => setHasSheet(e.target.checked)}
                className="accent-rose-600 w-4 h-4 rounded"
              />
              Include sheets/desk space (+₹300)
            </label>
          </div>

          <div>
            <label className="block text-xs font-semibold text-text-muted mb-1.5">Amount Paid (₹)</label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
              className="w-full bg-input-bg border border-input-border focus:border-rose-500/80 focus:ring-1 focus:ring-rose-500/30 rounded-lg px-3.5 py-2.5 text-sm text-rose-600 dark:text-rose-400 placeholder-text-muted transition-all duration-200 outline-none font-semibold"
            />
            <p className="text-[10px] text-text-muted mt-1.5">Suggested amount auto-filled &mdash; custom editable.</p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-text-muted mb-1.5">Start Date</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              suppressHydrationWarning
              className="w-full bg-input-bg border border-input-border focus:border-rose-500/80 focus:ring-1 focus:ring-rose-500/30 rounded-lg px-3.5 py-2.5 text-sm text-foreground transition-all duration-200 outline-none font-mono"
            />
          </div>

          <div className="flex flex-col gap-3 pt-3">
            <button
              disabled={submitting}
              className="w-full bg-rose-600 hover:bg-rose-500 text-white font-semibold rounded-lg text-sm px-5 py-3 transition-all duration-200 hover:-translate-y-0.5 shadow-md shadow-rose-600/10 cursor-pointer disabled:opacity-50"
            >
              {submitting ? "Saving..." : "Create Receipt / Commit Booking"}
            </button>
          </div>
        </form>

        {result && (
          <div className={`mt-4 p-3 rounded-lg text-sm border ${
            result.ok
              ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/25"
              : "bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/25"
          }`}>
            {result.message}
          </div>
        )}

        {whatsappStatus !== "idle" && (
          <div className="mt-3 p-4 rounded-xl border text-xs flex flex-wrap items-center gap-3 bg-panel-bg border-panel-border transition-all">
            {whatsappStatus === "sending" && (
              <span className="text-text-muted flex items-center gap-2 animate-pulse font-medium">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping inline-block" />
                ⚡ Auto-sending WhatsApp receipt...
              </span>
            )}
            {whatsappStatus === "sent" && (
              <span className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-lg">
                ✅ WhatsApp receipt sent directly to student!
              </span>
            )}
            {whatsappStatus === "simulated" && (
              <div className="flex flex-col gap-2 w-full">
                <span className="text-amber-600 dark:text-amber-400 font-medium flex items-center gap-1.5">
                  ⚠️ Background WhatsApp simulated (no UltraMsg credentials set in env).
                </span>
                {whatsappLink && (
                  <a
                    href={whatsappLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block self-start bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2.5 rounded-lg text-xs font-bold transition-all hover:-translate-y-0.5 shadow-md shadow-emerald-600/10 cursor-pointer"
                  >
                    📲 Open WhatsApp Manual Send
                  </a>
                )}
              </div>
            )}
            {whatsappStatus === "failed" && (
              <div className="flex flex-col gap-2 w-full">
                <span className="text-rose-600 dark:text-rose-400 font-semibold flex items-center gap-1.5">
                  ❌ Background WhatsApp dispatch failed.
                </span>
                {whatsappLink && (
                  <a
                    href={whatsappLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block self-start bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2.5 rounded-lg text-xs font-bold transition-all hover:-translate-y-0.5 shadow-md shadow-emerald-600/10 cursor-pointer"
                  >
                    📲 Send manually via WhatsApp Web
                  </a>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function NewReceiptPage() {
  return (
    <Suspense fallback={<p>Loading...</p>}>
      <NewReceiptForm />
    </Suspense>
  );
}
