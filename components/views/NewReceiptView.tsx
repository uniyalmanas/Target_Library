"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ShiftConfig } from "@/lib/types";
import { DEFAULT_SHIFTS } from "@/lib/tenant";
import { getShiftDisplayLabel, sortShiftsChronologically, getShiftNameWithTiming } from "@/lib/shifts";

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

export function NewReceiptForm({ tenantSlug }: { tenantSlug?: string }) {
  const params = useSearchParams();
  const router = useRouter();
  const slug = tenantSlug || params.get("slug") || "target-library";
  
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
  const [shiftsConfig, setShiftsConfig] = useState<ShiftConfig[]>(DEFAULT_SHIFTS);
  const [subscriptionType, setSubscriptionType] = useState<"full_day" | "half_day">(
    presetSubscriptionType || "full_day"
  );
  const [shiftType, setShiftType] = useState<string>(
    (presetShiftType as string) || "shift_1"
  );
  const [hasSheet, setHasSheet] = useState(presetHasSheet);
  const [amount, setAmount] = useState<number>(() => {
    if (presetAmount !== null) return presetAmount;
    return presetHasSheet ? 1200 : 900;
  });
  const [priceProtectionEnabled, setPriceProtectionEnabled] = useState<boolean>(true);
  const [previousReceiptInfo, setPreviousReceiptInfo] = useState<{
    amount_paid: number;
    shift_type?: string | null;
    subscription_type?: string;
    has_sheet?: boolean;
    end_date?: string;
  } | null>(null);

  // Fetch library shifts and pricing dynamically from settings
  useEffect(() => {
    fetch(`/api/libraries/${encodeURIComponent(slug)}/settings`)
      .then((r) => r.json())
      .then((data) => {
        if (data.settings?.price_protection_enabled !== undefined) {
          setPriceProtectionEnabled(Boolean(data.settings.price_protection_enabled));
        }
        if (data.settings?.shifts_config && data.settings.shifts_config.length > 0) {
          const sortedShifts = sortShiftsChronologically(data.settings.shifts_config);
          setShiftsConfig(sortedShifts);
          const halfShifts = sortedShifts.filter((s: ShiftConfig) => s.id !== "full_day");
          if (halfShifts.length > 0 && !presetShiftType) {
            setShiftType((prev) => (halfShifts.some((s: ShiftConfig) => s.id === prev) ? prev : halfShifts[0].id));
          }
        }
      })
      .catch(() => {});
  }, [slug, presetShiftType]);
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
      const fullShift = shiftsConfig.find((s) => s.id === "full_day");
      if (fullShift) return sheet ? fullShift.sheet_price : fullShift.base_price;
      return sheet ? 1200 : 900;
    } else {
      const shift = shiftsConfig.find((s) => s.id === sType) || shiftsConfig.find((s) => s.id !== "full_day");
      if (shift) return sheet ? shift.sheet_price : shift.base_price;
      return sheet ? 900 : 600;
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
  }, [subscriptionType, shiftType, hasSheet, tenureMode, durationDays, shiftsConfig]);

  // Fetch member preview when existing student ID is typed/passed
  useEffect(() => {
    if (!existingStudentId) {
      setMemberPreview(null);
      setPreviousReceiptInfo(null);
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
            setName(data.member.name || "");
            setPhone(data.member.phone || "");
            if (data.member.aadhar_no) {
              setAadharNo(data.member.aadhar_no);
            }

            // Also query previous receipts for renewal price protection intelligence
            fetch(`/api/receipts?student_id=${existingStudentId}&slug=${encodeURIComponent(slug)}`)
              .then((r) => (r.ok ? r.json() : []))
              .then((receipts) => {
                if (Array.isArray(receipts) && receipts.length > 0) {
                  const latest = receipts[0];
                  setPreviousReceiptInfo({
                    amount_paid: latest.amount_paid,
                    shift_type: latest.shift_type,
                    subscription_type: latest.subscription_type,
                    has_sheet: latest.has_sheet,
                    end_date: latest.end_date,
                  });
                } else {
                  setPreviousReceiptInfo(null);
                }
              })
              .catch(() => setPreviousReceiptInfo(null));
          } else {
            setMemberPreview(null);
            setPreviousReceiptInfo(null);
          }
          setLoadingPreview(false);
        })
        .catch(() => {
          setMemberPreview(null);
          setPreviousReceiptInfo(null);
          setLoadingPreview(false);
        });
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [existingStudentId, slug]);

  async function lookupSeatId(seat_number: string) {
    const res = await fetch(`/api/seats?slug=${encodeURIComponent(slug)}`);
    const seats = await res.json();
    const found = seats.find(
      (s: any) => s.seat_number.toString() === seat_number.toString()
    );
    return found ? found.seat_id : null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setResult(null);
    setWhatsappStatus("idle");
    setWhatsappLink(null);

    const seat_id = await lookupSeatId(seatNumber);
    if (!seat_id) {
      setResult({ ok: false, message: `Seat #${seatNumber} does not exist in this library.` });
      setSubmitting(false);
      return;
    }

    const trimmedName = (name || memberPreview?.name || "").trim();
    if (!trimmedName) {
      setResult({ ok: false, message: "Please enter Student Full Name." });
      setSubmitting(false);
      return;
    }

    const payload: any = {
      subscription_type: subscriptionType,
      shift_type: subscriptionType === "half_day" ? shiftType : null,
      has_sheet: hasSheet,
      amount_paid: Number(amount),
      payment_mode: paymentMode,
      start_date: startDate,
      end_date: endDate,
      seat_id,
      seat_number: Number(seatNumber),
      slug,
      name: trimmedName,
      phone: (phone || memberPreview?.phone || "").trim() || null,
      aadhar_no: (aadharNo || memberPreview?.aadhar_no || "").trim() || null,
    };

    if (existingStudentId && existingStudentId.trim()) {
      payload.student_id = Number(existingStudentId.trim());
    }

    const res = await fetch("/api/receipts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    setSubmitting(false);

    if (!res.ok) {
      setResult({ ok: false, message: data.error || "Failed to create receipt" });
      return;
    }

    // Fetch library info for dynamic branding
    let library: any = null;
    try {
      const libRes = await fetch(`/api/libraries/${encodeURIComponent(slug)}/settings`);
      if (libRes.ok) {
        const libData = await libRes.json();
        library = libData.library;
      }
    } catch {
      // ignore
    }

    const actualEndDate = endDate || computeEndDate(startDate, 30);
    const shiftLabel = getShiftDisplayLabel(shiftType, subscriptionType, shiftsConfig);

    setCreatedReceiptNo(data.receipt.receipt_no);
    setResult({
      ok: true,
      message: `Receipt #${data.receipt.receipt_no} created for member #${data.student_id}, seat ${seatNumber} for ${durationDays} days (valid until ${actualEndDate}).`,
    });

    const activeName = trimmedName;
    const activePhone = (phone || memberPreview?.phone || "").trim();

    if (activePhone) {
      setSendingWhatsapp(true);
      setWhatsappStatus("sending");
      try {
        const waRes = await fetch("/api/send-whatsapp", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ receipt_no: data.receipt.receipt_no, slug }),
        });
        const waData = await waRes.json();
        if (waRes.ok && waData.success) {
          if (waData.wa_url) {
            setWhatsappLink(waData.wa_url);
          }
          setWhatsappStatus(waData.live ? "sent" : "simulated");
        } else {
          setWhatsappStatus("failed");
          console.error("Auto WhatsApp failed:", waData.error);
          const digitalPassUrl = `${window.location.origin}/receipts/${data.receipt.receipt_no}`;
          const paymentModeLabel = paymentMode === "online" ? "Online (UPI)" : "Cash";
          const text = `${library?.name || "Library Workspace"}\nReceipt No: ${data.receipt.receipt_no}\nName: ${activeName}\nSeat No: ${seatNumber}\nType: ${shiftLabel}\nSheet: ${hasSheet ? "Yes" : "No"}\nAmount: Rs ${amount}\nPayment Mode: ${paymentModeLabel}\nDate: ${startDate}\nValid till: ${actualEndDate}\nDigital Pass & Invoice: ${digitalPassUrl}`;
          const digits = activePhone.replace(/\D/g, "");
          const withCountryCode = digits.length === 10 ? `91${digits}` : digits;
          setWhatsappLink(`https://wa.me/${withCountryCode}?text=${encodeURIComponent(text)}`);
        }
      } catch (err) {
        setWhatsappStatus("failed");
        console.error("Auto WhatsApp error:", err);
        const digitalPassUrl = `${window.location.origin}/receipts/${data.receipt.receipt_no}`;
        const paymentModeLabel = paymentMode === "online" ? "Online (UPI)" : "Cash";
        const text = `${library?.name || "Library Workspace"}\nReceipt No: ${data.receipt.receipt_no}\nName: ${activeName}\nSeat No: ${seatNumber}\nType: ${shiftLabel}\nSheet: ${hasSheet ? "Yes" : "No"}\nAmount: Rs ${amount}\nPayment Mode: ${paymentModeLabel}\nDate: ${startDate}\nValid till: ${actualEndDate}\nDigital Pass & Invoice: ${digitalPassUrl}`;
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
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="bg-panel-bg border border-panel-border rounded-2xl p-6 sm:p-8 backdrop-blur-md shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-rose-500/10 to-transparent pointer-events-none rounded-bl-full" />
        
        <div className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.5)]" />
            Walk-in Admission &amp; Billing
          </h1>
          <p className="text-xs text-text-muted mt-1">
            Generate official fees invoice, reserve desk space, and issue instant digital entry pass.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="border border-panel-border/80 bg-background/50 p-4 rounded-xl space-y-3">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold text-foreground">
                Student / Member ID (Optional)
              </label>
              {loadingPreview && (
                <span className="text-[10px] text-text-muted animate-pulse">
                  Searching directory...
                </span>
              )}
            </div>

            <div className="relative">
              <input
                type="number"
                placeholder="Leave blank to auto-generate ID, or enter custom ID (e.g. 104)"
                value={existingStudentId}
                onChange={(e) => setExistingStudentId(e.target.value)}
                className="w-full bg-input-bg border border-input-border focus:border-rose-500/80 focus:ring-1 focus:ring-rose-500/30 rounded-lg px-3.5 py-2 text-sm text-foreground placeholder-text-muted transition-all duration-200 outline-none font-mono"
              />
              {existingStudentId && (
                <button
                  type="button"
                  onClick={() => {
                    setExistingStudentId("");
                    setMemberPreview(null);
                  }}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[11px] font-semibold text-text-muted hover:text-rose-500 bg-panel-bg/80 px-2 py-0.5 rounded cursor-pointer transition"
                >
                  Clear ID
                </button>
              )}
            </div>

            {memberPreview && (
              <div className="bg-emerald-500/10 border border-emerald-500/25 rounded-lg p-3 text-xs space-y-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 font-bold text-emerald-600 dark:text-emerald-400">
                    <span>✓</span> Existing Member Found: {memberPreview.name} (ID #{existingStudentId})
                  </div>
                </div>
                <div className="text-text-muted text-[11px] flex gap-3 flex-wrap">
                  {memberPreview.phone && <span>Phone: {memberPreview.phone}</span>}
                  {memberPreview.aadhar_no && <span>Aadhaar: •••• {memberPreview.aadhar_no.slice(-4)}</span>}
                </div>
                <p className="text-[10px] text-emerald-600/80 dark:text-emerald-400/80 italic pt-0.5">
                  Profile loaded. You can verify or update student details below.
                </p>
              </div>
            )}

            {!memberPreview && existingStudentId && !loadingPreview && (
              <div className="bg-blue-500/10 border border-blue-500/25 rounded-lg p-2.5 text-xs text-blue-700 dark:text-blue-300">
                <span>
                  ℹ️ New Member ID <strong>#{existingStudentId}</strong>: This ID is available and will be assigned to this student. Please fill in their name and details below.
                </span>
              </div>
            )}

            {!existingStudentId && (
              <p className="text-[11px] text-text-muted">
                Leave blank to automatically assign the next sequential Member ID, or enter an ID from your library register.
              </p>
            )}
          </div>

          {/* Student Profile Information: ALWAYS VISIBLE */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-text-muted mb-1.5">Student Full Name *</label>
              <input
                required
                placeholder="e.g. Rahul Sharma"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-input-bg border border-input-border focus:border-rose-500/80 focus:ring-1 focus:ring-rose-500/30 rounded-lg px-3.5 py-2.5 text-sm text-foreground placeholder-text-muted transition-all duration-200 outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-text-muted mb-1.5">WhatsApp Mobile Number</label>
              <input
                placeholder="e.g. 9876543210"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full bg-input-bg border border-input-border focus:border-rose-500/80 focus:ring-1 focus:ring-rose-500/30 rounded-lg px-3.5 py-2.5 text-sm text-foreground placeholder-text-muted transition-all duration-200 outline-none"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-text-muted mb-1.5">Aadhaar Card Number (Optional)</label>
              <input
                type="text"
                placeholder="e.g. 1234 5678 9012"
                value={aadharNo}
                onChange={(e) => setAadharNo(e.target.value)}
                className="w-full bg-input-bg border border-input-border focus:border-rose-500/80 focus:ring-1 focus:ring-rose-500/30 rounded-lg px-3.5 py-2.5 text-sm text-foreground placeholder-text-muted transition-all duration-200 outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-text-muted mb-1.5">Assigned Seat Number *</label>
            <input
              required
              type="number"
              placeholder="e.g. 42"
              value={seatNumber}
              onChange={(e) => setSeatNumber(e.target.value)}
              className="w-full bg-input-bg border border-input-border focus:border-rose-500/80 focus:ring-1 focus:ring-rose-500/30 rounded-lg px-3.5 py-2.5 text-sm text-foreground placeholder-text-muted transition-all duration-200 outline-none font-mono"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-text-muted mb-1.5">Subscription Plan</label>
              <select
                value={subscriptionType}
                onChange={(e) => setSubscriptionType(e.target.value as any)}
                className="w-full bg-input-bg border border-input-border focus:border-rose-500/80 focus:ring-1 focus:ring-rose-500/30 rounded-lg px-3.5 py-2.5 text-sm text-foreground transition-all duration-200 outline-none"
              >
                <option value="full_day">
                  {(() => {
                    const full = shiftsConfig.find((s) => s.id === "full_day");
                    return full ? getShiftNameWithTiming(full) : "Full Day (6:00 AM - 12:00 AM)";
                  })()}
                </option>
                <option value="half_day">Half Day / Shifted</option>
              </select>
            </div>

            {subscriptionType === "half_day" && (
              <div>
                <label className="block text-xs font-semibold text-text-muted mb-1.5">Shift Window</label>
                <select
                  value={shiftType}
                  onChange={(e) => setShiftType(e.target.value)}
                  className="w-full bg-input-bg border border-input-border focus:border-rose-500/80 focus:ring-1 focus:ring-rose-500/30 rounded-lg px-3.5 py-2.5 text-sm text-foreground transition-all duration-200 outline-none"
                >
                  {shiftsConfig
                    .filter((s) => s.id !== "full_day")
                    .map((s) => (
                      <option key={s.id} value={s.id}>
                        {getShiftNameWithTiming(s)} — ₹{s.base_price}/mo
                      </option>
                    ))}
                </select>
              </div>
            )}
          </div>

          <div className="flex items-center gap-3 p-3 bg-neutral-500/5 border border-panel-border/80 rounded-xl">
            <input
              type="checkbox"
              id="sheet"
              checked={hasSheet}
              onChange={(e) => setHasSheet(e.target.checked)}
              className="w-4 h-4 rounded text-rose-600 focus:ring-rose-500 border-panel-border bg-input-bg cursor-pointer"
            />
            <label htmlFor="sheet" className="text-xs text-text-main cursor-pointer select-none">
              Include Personal Desk Sheet / Book Rest &amp; Pad (+₹300/mo)
            </label>
          </div>

          {/* Flexible Tenure & Start Date Configuration */}
          <div className="border border-panel-border/80 bg-background/50 p-4 rounded-xl space-y-4">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold text-foreground">
                Tenure &amp; Validity Configuration
              </label>
              <div className="flex bg-neutral-500/10 p-0.5 rounded-lg border border-panel-border text-[11px]">
                <button
                  type="button"
                  onClick={() => {
                    setTenureMode("1_month");
                    setDurationDays(30);
                    setEndDate(computeEndDate(startDate, 30));
                  }}
                  className={`px-2.5 py-1 rounded-md font-semibold transition cursor-pointer ${
                    tenureMode === "1_month"
                      ? "bg-card-bg text-rose-600 dark:text-rose-400 shadow-xs"
                      : "text-text-muted hover:text-text-main"
                  }`}
                >
                  Standard 1 Month (30d)
                </button>
                <button
                  type="button"
                  onClick={() => setTenureMode("custom_days")}
                  className={`px-2.5 py-1 rounded-md font-semibold transition cursor-pointer ${
                    tenureMode === "custom_days"
                      ? "bg-card-bg text-rose-600 dark:text-rose-400 shadow-xs"
                      : "text-text-muted hover:text-text-main"
                  }`}
                >
                  Custom Days / Dates
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-text-muted mb-1.5">
                  Admission Start Date *
                </label>
                <input
                  required
                  type="date"
                  value={startDate}
                  onChange={(e) => {
                    setStartDate(e.target.value);
                    setEndDate(computeEndDate(e.target.value, durationDays));
                  }}
                  className="w-full bg-input-bg border border-input-border focus:border-rose-500/80 focus:ring-1 focus:ring-rose-500/30 rounded-lg px-3.5 py-2.5 text-sm text-foreground transition-all duration-200 outline-none font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-text-muted mb-1.5">
                  Subscription Expiry Date *
                </label>
                <input
                  required
                  type="date"
                  value={endDate}
                  onChange={(e) => {
                    setEndDate(e.target.value);
                    const calculatedDays = computeDaysBetween(startDate, e.target.value);
                    setDurationDays(calculatedDays);
                    setTenureMode("custom_days");
                  }}
                  className="w-full bg-input-bg border border-input-border focus:border-rose-500/80 focus:ring-1 focus:ring-rose-500/30 rounded-lg px-3.5 py-2.5 text-sm text-foreground transition-all duration-200 outline-none font-mono"
                />
              </div>
            </div>

            {tenureMode === "custom_days" && (
              <div className="space-y-2 pt-1 border-t border-panel-border/60">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-text-muted">Duration in Days:</span>
                  <span className="font-mono font-bold text-rose-600 dark:text-rose-400 text-sm">
                    {durationDays} Days
                  </span>
                </div>
                <div className="flex gap-2 flex-wrap">
                  {[7, 10, 15, 20, 30, 45, 60, 90].map((d) => (
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

            {/* Renewal Pricing & Grandfathering Intelligence */}
            {previousReceiptInfo && (
              <div className={`mt-2.5 p-3 rounded-xl border text-xs space-y-2 animate-in fade-in ${
                priceProtectionEnabled
                  ? "bg-purple-500/10 border-purple-500/25 text-purple-700 dark:text-purple-300"
                  : "bg-blue-500/10 border-blue-500/25 text-blue-700 dark:text-blue-300"
              }`}>
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="font-bold flex items-center gap-1.5 text-xs">
                    <span>{priceProtectionEnabled ? "🛡️" : "ℹ️"}</span>
                    <span>
                      {priceProtectionEnabled ? "Renewal Price Protection Active" : "Renewal Pricing Notice"}
                    </span>
                  </div>
                  <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-background border border-panel-border text-foreground">
                    Previous Pass: ₹{previousReceiptInfo.amount_paid} {previousReceiptInfo.has_sheet ? "(With Sheet)" : ""}
                  </span>
                </div>

                <p className="text-[11px] leading-relaxed text-text-muted">
                  {priceProtectionEnabled
                    ? `This student previously paid ₹${previousReceiptInfo.amount_paid}. You can honor their loyalty rate or upgrade them to the updated standard rate (₹${getMonthlyBaseRate()}).`
                    : `Student previously paid ₹${previousReceiptInfo.amount_paid}. Current standard shift rate is ₹${getMonthlyBaseRate()}.`}
                </p>

                <div className="flex items-center gap-2 pt-1 flex-wrap">
                  <button
                    type="button"
                    onClick={() => setAmount(previousReceiptInfo.amount_paid)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer border flex items-center gap-1 ${
                      amount === previousReceiptInfo.amount_paid
                        ? "bg-purple-600 text-white border-purple-600 shadow-2xs"
                        : "bg-background border-panel-border text-foreground hover:bg-purple-500/15"
                    }`}
                  >
                    <span>✓</span> Keep Loyalty Rate: ₹{previousReceiptInfo.amount_paid}
                  </button>
                  <button
                    type="button"
                    onClick={() => setAmount(getMonthlyBaseRate())}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer border flex items-center gap-1 ${
                      amount === getMonthlyBaseRate()
                        ? "bg-blue-600 text-white border-blue-600 shadow-2xs"
                        : "bg-background border-panel-border text-foreground hover:bg-blue-500/15"
                    }`}
                  >
                    Standard Rate: ₹{getMonthlyBaseRate()}
                  </button>
                </div>
              </div>
            )}
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
                  href={`/l/${encodeURIComponent(slug)}/collections`}
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

export default function NewReceiptView({ tenantSlug }: { tenantSlug?: string }) {
  return (
    <Suspense fallback={<p>Loading...</p>}>
      <NewReceiptForm tenantSlug={tenantSlug} />
    </Suspense>
  );
}
