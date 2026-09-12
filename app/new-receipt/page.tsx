"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";

const PRICING: any = {
  full_day: {
    default: { base: 900, with_sheet: 1200 }
  },
  half_day: {
    shift_1: { base: 600, with_sheet: 900 },
    morning: { base: 600, with_sheet: 900 },
    shift_2: { base: 600, with_sheet: 900 },
    evening: { base: 600, with_sheet: 900 },
    shift_3: { base: 500, with_sheet: 800 },
  }
};

function computeEndDate(startStr: string, days: number): string {
  if (!startStr) return "";
  const d = new Date(`${startStr}T00:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}

function computeDaysBetween(startStr: string, endStr: string): number {
  if (!startStr || !endStr) return 30;
  const s = new Date(`${startStr}T00:00:00`);
  const e = new Date(`${endStr}T00:00:00`);
  const diffTime = e.getTime() - s.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return Math.max(1, diffDays);
}

function NewReceiptForm() {
  const params = useSearchParams();
  const router = useRouter();
  const slug = params.get("slug") || "target-library";
  
  // Parse presets from URL (if coming from Renew flow)
  const presetSeat = params.get("seat_number") || "";
  const presetStudentId = params.get("student_id") || "";
  const presetSubscriptionType = params.get("subscription_type") as "full_day" | "half_day" | null;
  const presetShiftType = params.get("shift_type") || "";
  const presetHasSheet = params.get("has_sheet") === "true";
  const presetAmount = params.get("amount") ? Number(params.get("amount")) : null;
  const presetStartDate = params.get("start_date") || "";

  const [existingStudentId, setExistingStudentId] = useState(presetStudentId);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [aadharNo, setAadharNo] = useState("");
  const [seatNumber, setSeatNumber] = useState(presetSeat);
  const [subscriptionType, setSubscriptionType] = useState<"full_day" | "half_day">(
    presetSubscriptionType || "full_day"
  );
  const [shiftType, setShiftType] = useState<"shift_1" | "shift_2" | "shift_3" | "morning" | "evening">(
    (presetShiftType as any) || "shift_1"
  );
  const [hasSheet, setHasSheet] = useState(presetHasSheet);
  const [amount, setAmount] = useState<number>(() => {
    if (presetAmount !== null) return presetAmount;
    if ((presetSubscriptionType || "full_day") === "full_day") {
      return PRICING.full_day.default[presetHasSheet ? "with_sheet" : "base"];
    } else {
      const sType = presetShiftType || "shift_1";
      const pricingObj = PRICING.half_day[sType] || PRICING.half_day.shift_1;
      return pricingObj[presetHasSheet ? "with_sheet" : "base"];
    }
  });
  const [startDate, setStartDate] = useState(
    presetStartDate || new Date().toISOString().split("T")[0]
  );
  const [tenureMode, setTenureMode] = useState<"1_month" | "custom_days">("1_month");
  const [durationDays, setDurationDays] = useState<number>(30);
  const [endDate, setEndDate] = useState<string>(() => {
    const s = presetStartDate || new Date().toISOString().split("T")[0];
    return computeEndDate(s, 30);
  });
  const [paymentMode, setPaymentMode] = useState<"cash" | "online">("cash");
  
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [createdReceiptNo, setCreatedReceiptNo] = useState<number | null>(null);
  const [whatsappLink, setWhatsappLink] = useState<string | null>(null);
  const [sendingWhatsapp, setSendingWhatsapp] = useState(false);
  const [whatsappStatus, setWhatsappStatus] = useState<"idle" | "sending" | "sent" | "simulated" | "failed">("idle");

  // Live preview for existing members
  const [memberPreview, setMemberPreview] = useState<{
    name: string;
    phone: string | null;
    aadhar_no?: string | null;
  } | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [isInitialMount, setIsInitialMount] = useState(true);

  const getMonthlyBaseRate = (subType = subscriptionType, sType = shiftType, sheet = hasSheet) => {
    if (subType === "full_day") {
      return PRICING.full_day.default[sheet ? "with_sheet" : "base"];
    } else {
      const pricingObj = PRICING.half_day[sType] || PRICING.half_day.shift_1;
      return pricingObj[sheet ? "with_sheet" : "base"];
    }
  };

  // Skip amount auto-suggestion on mount if a preset amount was provided
  useEffect(() => {
    if (isInitialMount && presetAmount !== null) {
      setIsInitialMount(false);
      return;
    }
    const monthlyRate = getMonthlyBaseRate();
    if (tenureMode === "custom_days") {
      setAmount(Math.round((monthlyRate / 30) * durationDays));
    } else {
      setAmount(monthlyRate);
    }
  }, [subscriptionType, shiftType, hasSheet, tenureMode, durationDays]);

  // Fetch member preview when existing student ID is typed/passed
  useEffect(() => {
    if (!existingStudentId) {
      setMemberPreview(null);
      setAadharNo("");
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
            setMemberPreview({
              name: data.member.name,
              phone: data.member.phone,
              aadhar_no: data.member.aadhar_no || null,
            });
            if (data.member.aadhar_no) {
              setAadharNo(data.member.aadhar_no);
            }
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
      const res = await fetch(`/api/seats?slug=${encodeURIComponent(slug)}`);
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

    if (!seatNumber) {
      setResult({ ok: false, message: `Please enter a valid seat number.` });
      setSubmitting(false);
      return;
    }

    const seat_id = await lookupSeatId(seatNumber);

    const payload: any = {
      seat_id: seat_id || Number(seatNumber),
      seat_number: Number(seatNumber),
      subscription_type: subscriptionType,
      shift_type: subscriptionType === "half_day" ? shiftType : undefined,
      has_sheet: hasSheet,
      amount_paid: amount,
      payment_mode: paymentMode,
      start_date: startDate,
      end_date: endDate,
      duration_days: durationDays,
      slug,
    };
    if (aadharNo.trim()) {
      payload.aadhar_no = aadharNo.trim();
    }
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

    const actualEndDate = data.receipt?.end_date || endDate;
    const shiftLabel =
      subscriptionType === "half_day"
        ? shiftType === "shift_1" || shiftType === "morning"
          ? "Shift 1 (6am–2pm)"
          : shiftType === "shift_2" || shiftType === "evening"
            ? "Shift 2 (2pm–12am)"
            : "Shift 3 (4pm–12am)"
        : "Full day (6am–12am)";

    setCreatedReceiptNo(data.receipt.receipt_no);
    setResult({
      ok: true,
      message: `Receipt #${data.receipt.receipt_no} created for member #${data.student_id}, seat ${seatNumber} for ${durationDays} days (valid until ${actualEndDate}).`,
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
          const paymentModeLabel = paymentMode === "online" ? "Online (UPI)" : "Cash";
          const text = `The Target Library\nReceipt No: ${data.receipt.receipt_no}\nName: ${activeName}\nSeat No: ${seatNumber}\nType: ${shiftLabel}\nSheet: ${hasSheet ? "Yes" : "No"}\nAmount: Rs ${amount}\nPayment Mode: ${paymentModeLabel}\nDate: ${startDate}\nValid till: ${actualEndDate}\nDigital Pass & Invoice: ${digitalPassUrl}`;
          const digits = activePhone.replace(/\D/g, "");
          const withCountryCode = digits.length === 10 ? `91${digits}` : digits;
          setWhatsappLink(`https://wa.me/${withCountryCode}?text=${encodeURIComponent(text)}`);
        }
      } catch (err) {
        setWhatsappStatus("failed");
        console.error("Auto WhatsApp error:", err);
        const digitalPassUrl = `${window.location.origin}/receipts/${data.receipt.receipt_no}`;
        const paymentModeLabel = paymentMode === "online" ? "Online (UPI)" : "Cash";
        const text = `The Target Library\nReceipt No: ${data.receipt.receipt_no}\nName: ${activeName}\nSeat No: ${seatNumber}\nType: ${shiftLabel}\nSheet: ${hasSheet ? "Yes" : "No"}\nAmount: Rs ${amount}\nPayment Mode: ${paymentModeLabel}\nDate: ${startDate}\nValid till: ${actualEndDate}\nDigital Pass & Invoice: ${digitalPassUrl}`;
        const digits = activePhone.replace(/\D/g, "");
        const withCountryCode = digits.length === 10 ? `91${digits}` : digits;
        setWhatsappLink(`https://wa.me/${withCountryCode}?text=${encodeURIComponent(text)}`);
      } finally {
        setSendingWhatsapp(false);
      }
    }

    setName("");
    setPhone("");
    setAadharNo("");
    setExistingStudentId("");
    setSeatNumber("");
    setMemberPreview(null);
  }

  return (
    <div className="max-w-lg mx-auto">
      <div className="bg-panel-bg border border-panel-border rounded-2xl p-8 backdrop-blur-md shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-rose-500/[calc(var(--glow-opacity)*0.5)] to-transparent pointer-events-none" />
        
        <div className="flex items-center justify-between mb-6 pb-3 border-b border-panel-border">
          <h1 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.5)]" />
            Create Receipt &amp; Renewal
          </h1>
          <Link
            href={`/l/${slug}`}
            className="px-2.5 py-1 rounded-xl border border-panel-border bg-card-bg hover:bg-neutral-500/10 text-xs font-bold transition"
          >
            ← Desk Portal
          </Link>
        </div>

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
              <div className="text-xs text-emerald-600 dark:text-emerald-400 mt-1.5 bg-emerald-500/10 border border-emerald-500/20 p-2.5 rounded-lg space-y-1">
                <p>✅ Member found: <span className="font-semibold">{memberPreview.name}</span></p>
                <div className="flex gap-4 text-[11px] text-text-muted font-mono">
                  <span>Phone: {memberPreview.phone || "None"}</span>
                  <span>Aadhaar: {memberPreview.aadhar_no || "Not linked"}</span>
                </div>
              </div>
            )}
            {!loadingPreview && existingStudentId && !memberPreview && (
              <p className="text-xs text-rose-600 dark:text-rose-400 mt-1.5 bg-rose-500/10 border border-rose-500/20 p-2.5 rounded-lg">❌ Member ID not found. Enter a Name below to register a new member with ID {existingStudentId}, or leave blank.</p>
            )}
            {!loadingPreview && memberPreview && !memberPreview.aadhar_no && (
              <div className="pt-2">
                <label className="block text-xs font-semibold text-text-muted mb-1.5 flex items-center justify-between">
                  <span>Link Aadhaar Card (Optional)</span>
                  <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">Verify Candidate</span>
                </label>
                <input
                  value={aadharNo}
                  onChange={(e) => {
                    const raw = e.target.value.replace(/\D/g, "").slice(0, 12);
                    const formatted = raw.replace(/(\d{4})(?=\d)/g, "$1 ");
                    setAadharNo(formatted);
                  }}
                  placeholder="12-digit Aadhaar Number (e.g. 5432 1098 7654)"
                  className="w-full bg-input-bg border border-input-border focus:border-rose-500/80 focus:ring-1 focus:ring-rose-500/30 rounded-lg px-3.5 py-2.5 text-sm text-foreground placeholder-text-muted transition-all duration-200 outline-none font-mono"
                />
                <p className="text-[10px] text-text-muted mt-1">
                  🔒 Member currently has no Aadhaar on file. You can attach it optionally now.
                </p>
              </div>
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
              <div>
                <label className="block text-xs font-semibold text-text-muted mb-1.5 flex items-center justify-between">
                  <span>Aadhaar Card Number (Optional)</span>
                  <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">Candidate Integrity</span>
                </label>
                <input
                  value={aadharNo}
                  onChange={(e) => {
                    const raw = e.target.value.replace(/\D/g, "").slice(0, 12);
                    const formatted = raw.replace(/(\d{4})(?=\d)/g, "$1 ");
                    setAadharNo(formatted);
                  }}
                  placeholder="12-digit Aadhaar Number (e.g. 5432 1098 7654)"
                  className="w-full bg-input-bg border border-input-border focus:border-rose-500/80 focus:ring-1 focus:ring-rose-500/30 rounded-lg px-3.5 py-2.5 text-sm text-foreground placeholder-text-muted transition-all duration-200 outline-none font-mono"
                />
                <p className="text-[10px] text-text-muted mt-1">
                  🔒 Stored securely. Appears on the student pass &amp; invoice. Strictly optional.
                </p>
              </div>
            </div>
          )}

          <div className="pt-2 border-t border-panel-border">
            <label className="block text-xs font-semibold text-text-muted mb-1.5">Seat Number</label>
            <input
              required
              type="number"
              min={1}
              max={297}
              value={seatNumber}
              onChange={(e) => setSeatNumber(e.target.value)}
              placeholder="e.g. 154"
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
              <div className="flex gap-6 flex-wrap">
                <label className="flex items-center gap-2 text-sm cursor-pointer select-none text-text-details hover:text-foreground transition-colors">
                  <input
                    type="radio"
                    checked={shiftType === "shift_1" || shiftType === "morning"}
                    onChange={() => setShiftType("shift_1")}
                    className="accent-rose-600 w-4 h-4"
                  />
                  Shift 1 (6am–2pm)
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer select-none text-text-details hover:text-foreground transition-colors">
                  <input
                    type="radio"
                    checked={shiftType === "shift_2" || shiftType === "evening"}
                    onChange={() => setShiftType("shift_2")}
                    className="accent-rose-600 w-4 h-4"
                  />
                  Shift 2 (2pm–12am)
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer select-none text-text-details hover:text-foreground transition-colors">
                  <input
                    type="radio"
                    checked={shiftType === "shift_3"}
                    onChange={() => setShiftType("shift_3")}
                    className="accent-rose-600 w-4 h-4"
                  />
                  Shift 3 (4pm–12am)
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
            <label className="block text-xs font-semibold text-text-muted mb-1.5">Start Date</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => {
                const newStart = e.target.value;
                setStartDate(newStart);
                if (newStart) {
                  setEndDate(computeEndDate(newStart, durationDays));
                }
              }}
              suppressHydrationWarning
              className="w-full bg-input-bg border border-input-border focus:border-rose-500/80 focus:ring-1 focus:ring-rose-500/30 rounded-lg px-3.5 py-2.5 text-sm text-foreground transition-all duration-200 outline-none font-mono"
            />
          </div>

          {/* Study Grant / Booking Tenure */}
          <div className="bg-background border border-panel-border rounded-xl p-4 space-y-3.5">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <label className="text-xs font-bold text-text-main flex items-center gap-1.5">
                <span>⏱️</span> Study Tenure / Booking Duration
              </label>
              <div className="flex bg-card-bg border border-panel-border rounded-lg p-1 text-xs">
                <button
                  type="button"
                  onClick={() => {
                    setTenureMode("1_month");
                    setDurationDays(30);
                    setEndDate(computeEndDate(startDate, 30));
                  }}
                  className={`px-3 py-1 rounded-md font-medium transition cursor-pointer ${
                    tenureMode === "1_month"
                      ? "bg-rose-600 text-white font-semibold shadow-xs"
                      : "text-text-muted hover:text-text-main"
                  }`}
                >
                  Standard 1 Month (30 Days)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setTenureMode("custom_days");
                  }}
                  className={`px-3 py-1 rounded-md font-medium transition cursor-pointer flex items-center gap-1 ${
                    tenureMode === "custom_days"
                      ? "bg-rose-600 text-white font-semibold shadow-xs"
                      : "text-text-muted hover:text-text-main"
                  }`}
                >
                  <span>🎯</span> Custom Days (&apos;n&apos; Days)
                </button>
              </div>
            </div>

            {tenureMode === "custom_days" && (
              <div className="space-y-3 pt-2 border-t border-panel-border/50">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-text-muted mb-1">
                      Number of Days (&apos;n&apos;)
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={365}
                      value={durationDays}
                      onChange={(e) => {
                        const days = Math.max(1, Number(e.target.value) || 1);
                        setDurationDays(days);
                        setEndDate(computeEndDate(startDate, days));
                      }}
                      placeholder="e.g. 7, 10, 15"
                      className="w-full bg-input-bg border border-input-border focus:border-rose-500/80 focus:ring-1 focus:ring-rose-500/30 rounded-lg px-3.5 py-2 text-sm text-foreground transition-all outline-none font-semibold font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-text-muted mb-1">
                      Tenure Ends On (Auto-calculated)
                    </label>
                    <input
                      type="date"
                      value={endDate}
                      min={startDate}
                      onChange={(e) => {
                        const newEnd = e.target.value;
                        setEndDate(newEnd);
                        if (newEnd) {
                          const days = computeDaysBetween(startDate, newEnd);
                          setDurationDays(days);
                        }
                      }}
                      className="w-full bg-input-bg border border-input-border focus:border-rose-500/80 focus:ring-1 focus:ring-rose-500/30 rounded-lg px-3.5 py-2 text-sm text-foreground transition-all outline-none font-mono"
                    />
                  </div>
                </div>

                {/* Quick Presets */}
                <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                  <span className="text-[10px] text-text-muted font-medium mr-1">Quick Presets:</span>
                  {[5, 7, 10, 15, 20, 45, 60].map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => {
                        setDurationDays(d);
                        setEndDate(computeEndDate(startDate, d));
                      }}
                      className={`text-xs px-2.5 py-1 rounded-lg border transition cursor-pointer font-medium ${
                        durationDays === d
                          ? "bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30 font-bold"
                          : "bg-card-bg border-panel-border text-text-muted hover:text-text-main"
                      }`}
                    >
                      {d} Days
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Active Tenure Visual Pill */}
            <div className="bg-neutral-500/10 border border-panel-border/60 rounded-lg px-3 py-2 text-xs flex items-center justify-between flex-wrap gap-2 text-text-details">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                <span>
                  Seat Occupied: <strong className="text-text-main">{durationDays} Days</strong> ({startDate} &rarr; {endDate})
                </span>
              </div>
              <span className="text-[11px] text-text-muted">
                Turns <strong className="text-emerald-600 dark:text-emerald-400">Green (Free)</strong> on {computeEndDate(endDate, 1)}
              </span>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold text-text-muted">Amount Paid (₹)</label>
              {tenureMode === "custom_days" && (
                <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-md">
                  Prorated for {durationDays} days
                </span>
              )}
            </div>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
              className="w-full bg-input-bg border border-input-border focus:border-rose-500/80 focus:ring-1 focus:ring-rose-500/30 rounded-lg px-3.5 py-2.5 text-sm text-rose-600 dark:text-rose-400 placeholder-text-muted transition-all duration-200 outline-none font-semibold"
            />
            <p className="text-[10px] text-text-muted mt-1.5">Suggested amount auto-calculated &mdash; custom editable.</p>
          </div>

          {/* Payment Mode Selector */}
          <div className="bg-background border border-panel-border rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                <span>💳</span> Payment Mode
              </label>
              <span className="text-[10px] text-text-muted font-medium">Record payment method</span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <label
                onClick={() => setPaymentMode("cash")}
                className={`flex items-center justify-center gap-2 p-3 rounded-xl border text-xs font-bold cursor-pointer transition-all select-none ${
                  paymentMode === "cash"
                    ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/40 shadow-xs ring-1 ring-emerald-500/30"
                    : "bg-input-bg border-input-border text-text-muted hover:text-foreground hover:bg-neutral-500/5"
                }`}
              >
                <input
                  type="radio"
                  name="payment_mode"
                  value="cash"
                  checked={paymentMode === "cash"}
                  onChange={() => setPaymentMode("cash")}
                  className="hidden"
                />
                <span className="text-base">💵</span>
                <span>Cash Mode</span>
              </label>

              <label
                onClick={() => setPaymentMode("online")}
                className={`flex items-center justify-center gap-2 p-3 rounded-xl border text-xs font-bold cursor-pointer transition-all select-none ${
                  paymentMode === "online"
                    ? "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/40 shadow-xs ring-1 ring-blue-500/30"
                    : "bg-input-bg border-input-border text-text-muted hover:text-foreground hover:bg-neutral-500/5"
                }`}
              >
                <input
                  type="radio"
                  name="payment_mode"
                  value="online"
                  checked={paymentMode === "online"}
                  onChange={() => setPaymentMode("online")}
                  className="hidden"
                />
                <span className="text-base">📱</span>
                <span>Online / UPI</span>
              </label>
            </div>

            <p className="text-[10px] text-text-muted flex items-center gap-1.5">
              <span>ℹ️</span> Tracked for daily cash drawer reconciliation and printed student invoices.
            </p>
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
          <div className={`mt-4 p-4 rounded-xl text-sm border flex flex-col gap-3 ${
            result.ok
              ? "bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 border-emerald-500/25"
              : "bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/25"
          }`}>
            <div className="font-medium">{result.message}</div>
            {result.ok && createdReceiptNo && (
              <div className="flex items-center gap-2 flex-wrap pt-1">
                <Link
                  href={`/receipts/${createdReceiptNo}`}
                  target="_blank"
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition shadow-xs"
                >
                  🎟️ View Pass & Invoice
                </Link>
                <Link
                  href={`/collections?slug=${slug}`}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-card-bg border border-panel-border hover:bg-neutral-100 dark:hover:bg-neutral-800 text-text-main font-semibold text-xs transition"
                >
                  💰 View Daily Fees Register
                </Link>
              </div>
            )}
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
