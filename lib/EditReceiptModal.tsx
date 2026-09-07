"use client";

import { useState } from "react";

export interface EditableReceipt {
  receipt_no: number;
  student_id: number;
  student_name?: string;
  student_phone?: string | null;
  aadhar_no?: string | null;
  seat_id?: number;
  seat_number: number;
  subscription_type: "full_day" | "half_day";
  shift_type: string | null;
  has_sheet: boolean;
  amount_paid: number;
  start_date: string;
  end_date: string;
}

interface EditReceiptModalProps {
  receipt: EditableReceipt;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (updatedReceipt?: any) => void;
}

const PRICING: Record<string, any> = {
  full_day: { base: 900, with_sheet: 1200 },
  half_day: {
    shift_1: { base: 600, with_sheet: 900 },
    morning: { base: 600, with_sheet: 900 },
    shift_2: { base: 600, with_sheet: 900 },
    evening: { base: 600, with_sheet: 900 },
    shift_3: { base: 500, with_sheet: 800 },
  },
};

const OWNER_PASSWORD = process.env.NEXT_PUBLIC_OWNER_PASSWORD || "TargetOwner2026";

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

export default function EditReceiptModal({
  receipt,
  isOpen,
  onClose,
  onSuccess,
}: EditReceiptModalProps) {
  // Auth state
  const [isOwnerAuthenticated, setIsOwnerAuthenticated] = useState(() => {
    if (typeof window === "undefined") return false;
    return sessionStorage.getItem("target_lib_owner_auth") === "true";
  });
  const [passcode, setPasscode] = useState("");
  const [passcodeError, setPasscodeError] = useState("");

  // Edit form state
  const [name, setName] = useState(receipt.student_name || "");
  const [phone, setPhone] = useState(receipt.student_phone || "");
  const [aadharNo, setAadharNo] = useState(receipt.aadhar_no || "");
  const [seatNumber, setSeatNumber] = useState(receipt.seat_number.toString());
  const [subscriptionType, setSubscriptionType] = useState<"full_day" | "half_day">(
    receipt.subscription_type
  );
  const [shiftType, setShiftType] = useState<string>(
    receipt.shift_type || "shift_1"
  );
  const [hasSheet, setHasSheet] = useState(receipt.has_sheet);
  const [startDate, setStartDate] = useState(receipt.start_date);
  const [endDate, setEndDate] = useState(receipt.end_date);
  const [amount, setAmount] = useState<number>(receipt.amount_paid);

  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [vacating, setVacating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  // Verify owner password
  const handlePasscodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (passcode.trim() === OWNER_PASSWORD) {
      sessionStorage.setItem("target_lib_owner_auth", "true");
      setIsOwnerAuthenticated(true);
      setPasscodeError("");
    } else {
      setPasscodeError("Invalid Owner passcode. Access restricted to library owner.");
    }
  };

  // Helper to compute standard rate
  const getStandardRate = (subType = subscriptionType, sType = shiftType, sheet = hasSheet) => {
    if (subType === "full_day") {
      return PRICING.full_day[sheet ? "with_sheet" : "base"];
    } else {
      const p = PRICING.half_day[sType] || PRICING.half_day.shift_1;
      return p[sheet ? "with_sheet" : "base"];
    }
  };

  // Auto-suggest fee when plan or tenure is modified
  const handlePlanChange = (newSubType: "full_day" | "half_day", newShift = shiftType, newSheet = hasSheet) => {
    setSubscriptionType(newSubType);
    setShiftType(newShift);
    setHasSheet(newSheet);

    const days = computeDaysBetween(startDate, endDate);
    const monthlyRate = getStandardRate(newSubType, newShift, newSheet);
    if (days >= 28 && days <= 31) {
      setAmount(monthlyRate);
    } else {
      setAmount(Math.round((monthlyRate / 30) * days));
    }
  };

  // Submit edits
  const handleSaveChanges = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const res = await fetch("/api/receipts", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "x-owner-auth": OWNER_PASSWORD,
        },
        body: JSON.stringify({
          receipt_no: receipt.receipt_no,
          seat_number: Number(seatNumber),
          subscription_type: subscriptionType,
          shift_type: subscriptionType === "half_day" ? shiftType : null,
          has_sheet: hasSheet,
          amount_paid: Number(amount),
          start_date: startDate,
          end_date: endDate,
          name: name.trim(),
          phone: phone.trim() || null,
          aadhar_no: aadharNo.trim() || null,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to update receipt");
      }

      onSuccess(data.receipt);
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error saving changes");
    } finally {
      setSaving(false);
    }
  };

  // Early vacate
  const handleVacateEarly = async () => {
    if (!confirm(`Are you sure you want to vacate Seat #${seatNumber} early? The student's validity will end as of yesterday and the seat will become green immediately.`)) {
      return;
    }

    setVacating(true);
    setError(null);
    try {
      const res = await fetch("/api/receipts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ receipt_no: receipt.receipt_no }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to vacate seat");
      onSuccess(data.receipt);
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error vacating seat");
    } finally {
      setVacating(false);
    }
  };

  // Cancel & Delete receipt
  const handleDeleteReceipt = async () => {
    const confirmation = prompt(
      `⚠️ PERMANENT CANCELLATION & INCOME ADJUSTMENT:\n\nDeleting Receipt #${receipt.receipt_no} will:\n1. Free Seat #${seatNumber} immediately.\n2. Deduct ₹${receipt.amount_paid} from your daily, monthly, and lifetime collections.\n\nType DELETE to confirm:`
    );

    if (confirmation !== "DELETE") {
      return;
    }

    setDeleting(true);
    setError(null);
    try {
      const res = await fetch(`/api/receipts?receipt_no=${receipt.receipt_no}`, {
        method: "DELETE",
        headers: {
          "x-owner-auth": OWNER_PASSWORD,
        },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delete receipt");
      onSuccess();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error deleting receipt");
    } finally {
      setDeleting(false);
    }
  };

  const daysCount = computeDaysBetween(startDate, endDate);
  const amountDiff = Number(amount) - Number(receipt.amount_paid);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in overflow-y-auto">
      <div className="bg-card-bg border border-panel-border rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden my-8">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-panel-border bg-neutral-500/5">
          <div className="flex items-center gap-2.5">
            <span className="text-xl">✏️</span>
            <div>
              <h2 className="text-base font-extrabold text-text-main">
                Edit Receipt #{receipt.receipt_no}
              </h2>
              <p className="text-[11px] text-text-muted">
                Owner Control &bull; Candidate #{receipt.student_id} &bull; Seat {receipt.seat_number}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-text-muted hover:text-text-main text-lg font-bold p-1 rounded-lg hover:bg-neutral-500/10 transition cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* OWNER PASSCODE GATE */}
        {!isOwnerAuthenticated ? (
          <form onSubmit={handlePasscodeSubmit} className="p-6 space-y-4 text-center">
            <div className="w-12 h-12 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 flex items-center justify-center text-2xl mx-auto mb-2">
              🔒
            </div>
            <h3 className="text-sm font-bold text-text-main">Owner Passcode Required</h3>
            <p className="text-xs text-text-muted max-w-xs mx-auto">
              Only the Library Owner is authorized to modify student plans, edit fees, or cancel subscriptions.
            </p>

            <div className="max-w-xs mx-auto">
              <input
                type="password"
                placeholder="Enter Owner Passcode"
                value={passcode}
                onChange={(e) => {
                  setPasscode(e.target.value);
                  setPasscodeError("");
                }}
                className="w-full text-center px-4 py-2.5 bg-background border border-panel-border rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-rose-500"
                autoFocus
              />
              {passcodeError && (
                <p className="text-rose-600 dark:text-rose-400 text-xs font-semibold mt-1.5">
                  {passcodeError}
                </p>
              )}
            </div>

            <div className="flex gap-2 justify-center pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-semibold rounded-xl border border-panel-border bg-card-bg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 text-xs font-semibold rounded-xl bg-rose-600 hover:bg-rose-500 text-white transition cursor-pointer shadow-sm"
              >
                Unlock Edit Mode
              </button>
            </div>
          </form>
        ) : (
          /* EDIT FORM */
          <form onSubmit={handleSaveChanges} className="p-6 space-y-4">
            {error && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-600 dark:text-rose-400 font-semibold">
                {error}
              </div>
            )}

            {/* Candidate Name & Phone */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-text-muted mb-1">
                  Candidate Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 bg-background border border-panel-border rounded-xl text-xs font-semibold text-text-main focus:outline-none focus:ring-2 focus:ring-rose-500"
                  required
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-text-muted mb-1">
                  Phone Number
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="10-digit mobile"
                  className="w-full px-3 py-2 bg-background border border-panel-border rounded-xl text-xs font-semibold text-text-main focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>
            </div>

            {/* Aadhaar Number (Optional) */}
            <div>
              <label className="block text-[11px] font-semibold text-text-muted mb-1 flex items-center justify-between">
                <span>Aadhaar Card Number (Optional)</span>
                <span className="text-[10px] text-text-muted font-normal">Candidate Integrity</span>
              </label>
              <input
                type="text"
                value={aadharNo}
                onChange={(e) => {
                  const raw = e.target.value.replace(/\D/g, "").slice(0, 12);
                  const formatted = raw.replace(/(\d{4})(?=\d)/g, "$1 ");
                  setAadharNo(formatted);
                }}
                placeholder="12-digit Aadhaar (e.g. 5432 1098 7654)"
                className="w-full px-3 py-2 bg-background border border-panel-border rounded-xl text-xs font-mono text-text-main focus:outline-none focus:ring-2 focus:ring-rose-500"
              />
            </div>

            {/* Seat Number */}
            <div>
              <label className="block text-[11px] font-semibold text-text-muted mb-1">
                Allocated Seat (1 – 297)
              </label>
              <input
                type="number"
                min={1}
                max={297}
                value={seatNumber}
                onChange={(e) => setSeatNumber(e.target.value)}
                className="w-full px-3 py-2 bg-background border border-panel-border rounded-xl text-xs font-bold text-text-main focus:outline-none focus:ring-2 focus:ring-rose-500 font-mono"
                required
              />
            </div>

            {/* Subscription & Shift */}
            <div className="bg-background border border-panel-border rounded-xl p-3 space-y-2.5">
              <label className="block text-[10px] font-extrabold uppercase tracking-wider text-text-muted">
                Subscription Plan
              </label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 text-xs font-medium cursor-pointer">
                  <input
                    type="radio"
                    name="editSubType"
                    checked={subscriptionType === "full_day"}
                    onChange={() => handlePlanChange("full_day")}
                    className="accent-rose-600"
                  />
                  Full Day (6am – 12am)
                </label>
                <label className="flex items-center gap-2 text-xs font-medium cursor-pointer">
                  <input
                    type="radio"
                    name="editSubType"
                    checked={subscriptionType === "half_day"}
                    onChange={() => handlePlanChange("half_day")}
                    className="accent-rose-600"
                  />
                  Half Day
                </label>
              </div>

              {subscriptionType === "half_day" && (
                <div className="pt-2 border-t border-panel-border/50">
                  <label className="block text-[10px] text-text-muted font-bold mb-1.5">
                    Select Shift
                  </label>
                  <div className="flex gap-3 flex-wrap text-xs">
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="radio"
                        name="editShift"
                        checked={shiftType === "shift_1" || shiftType === "morning"}
                        onChange={() => handlePlanChange("half_day", "shift_1")}
                        className="accent-rose-600"
                      />
                      Shift 1 (6am–2pm)
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="radio"
                        name="editShift"
                        checked={shiftType === "shift_2" || shiftType === "evening"}
                        onChange={() => handlePlanChange("half_day", "shift_2")}
                        className="accent-rose-600"
                      />
                      Shift 2 (2pm–12am)
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="radio"
                        name="editShift"
                        checked={shiftType === "shift_3"}
                        onChange={() => handlePlanChange("half_day", "shift_3")}
                        className="accent-rose-600"
                      />
                      Shift 3 (4pm–12am)
                    </label>
                  </div>
                </div>
              )}

              <div className="pt-2 border-t border-panel-border/50">
                <label className="flex items-center gap-2 text-xs cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={hasSheet}
                    onChange={(e) => handlePlanChange(subscriptionType, shiftType, e.target.checked)}
                    className="accent-rose-600 rounded"
                  />
                  Include sheets / desk space (+₹300)
                </label>
              </div>
            </div>

            {/* Dates & Tenure */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-text-muted mb-1">
                  Start Date
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => {
                    const newS = e.target.value;
                    setStartDate(newS);
                    if (newS) setEndDate(computeEndDate(newS, daysCount));
                  }}
                  className="w-full px-3 py-2 bg-background border border-panel-border rounded-xl text-xs font-mono text-text-main focus:outline-none focus:ring-2 focus:ring-rose-500"
                  required
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-text-muted mb-1">
                  End Date ({daysCount} days tenure)
                </label>
                <input
                  type="date"
                  value={endDate}
                  min={startDate}
                  onChange={(e) => {
                    const newE = e.target.value;
                    setEndDate(newE);
                    if (newE) {
                      const d = computeDaysBetween(startDate, newE);
                      const rate = getStandardRate();
                      setAmount(d >= 28 && d <= 31 ? rate : Math.round((rate / 30) * d));
                    }
                  }}
                  className="w-full px-3 py-2 bg-background border border-panel-border rounded-xl text-xs font-mono text-text-main focus:outline-none focus:ring-2 focus:ring-rose-500"
                  required
                />
              </div>
            </div>

            {/* Amount Paid & Income Impact */}
            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3.5 space-y-2">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-extrabold text-emerald-800 dark:text-emerald-300">
                  Amount Paid (₹)
                </label>
                {amountDiff !== 0 && (
                  <span className={`text-[11px] font-bold px-2 py-0.5 rounded-md ${
                    amountDiff > 0
                      ? "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300"
                      : "bg-rose-500/20 text-rose-700 dark:text-rose-300"
                  }`}>
                    {amountDiff > 0 ? `+₹${amountDiff} Increase` : `-₹${Math.abs(amountDiff)} Decrease`}
                  </span>
                )}
              </div>

              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(Number(e.target.value))}
                className="w-full px-3.5 py-2 bg-card-bg border border-emerald-500/30 rounded-xl text-base font-black text-emerald-600 dark:text-emerald-400 font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500"
                required
              />

              <p className="text-[11px] text-emerald-800/80 dark:text-emerald-300/80">
                💰 <strong>Income Impact:</strong> Saving will update this receipt from ₹{receipt.amount_paid} to ₹{amount}. Your daily and monthly revenue will automatically reflect the change.
              </p>
            </div>

            {/* Modal Actions */}
            <div className="flex flex-col gap-2 pt-2">
              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-xs font-semibold rounded-xl border border-panel-border bg-card-bg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition cursor-pointer"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={saving || deleting || vacating}
                  className="px-5 py-2 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white transition cursor-pointer disabled:opacity-50 shadow-sm"
                >
                  {saving ? "Saving Changes..." : "💾 Save Changes & Update Income"}
                </button>
              </div>

              {/* Danger Zone: Early Vacate or Cancel & Delete */}
              <div className="border-t border-panel-border/50 pt-3 mt-1 flex items-center justify-between flex-wrap gap-2 text-xs">
                <button
                  type="button"
                  onClick={handleVacateEarly}
                  disabled={saving || deleting || vacating}
                  className="text-amber-600 dark:text-amber-400 hover:underline font-semibold cursor-pointer disabled:opacity-50"
                  title="Frees seat immediately while keeping the payment record"
                >
                  {vacating ? "Vacating..." : "🚪 Vacate Seat Early"}
                </button>

                <button
                  type="button"
                  onClick={handleDeleteReceipt}
                  disabled={saving || deleting || vacating}
                  className="text-rose-600 dark:text-rose-400 hover:underline font-bold cursor-pointer disabled:opacity-50"
                  title="Permanently removes receipt and deducts fee from income"
                >
                  {deleting ? "Deleting..." : "🗑️ Cancel & Delete Receipt"}
                </button>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
