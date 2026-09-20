"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { Library, LibrarySettings, ShiftConfig } from "@/lib/types";
import { FALLBACK_TARGET_LIBRARY, FALLBACK_SETTINGS } from "@/lib/tenant";
import LibraryLogo from "@/lib/LibraryLogo";
import { sortShiftsChronologically } from "@/lib/shifts";

export default function StudentEntranceQRJoinPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params);

  const [library, setLibrary] = useState<Library>(FALLBACK_TARGET_LIBRARY);
  const [settings, setSettings] = useState<LibrarySettings>(FALLBACK_SETTINGS);
  const [loading, setLoading] = useState(true);

  // Form State
  const [studentName, setStudentName] = useState("");
  const [studentPhone, setStudentPhone] = useState("");
  const [aadharNo, setAadharNo] = useState("");
  const [selectedPlanType, setSelectedPlanType] = useState<"full_day" | "half_day">("half_day");
  const [selectedShiftId, setSelectedShiftId] = useState<string>("shift_1");
  const [hasSheet, setHasSheet] = useState(false);
  const [utrNumber, setUtrNumber] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [submittedSuccess, setSubmittedSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Fetch Library & Settings dynamically
  useEffect(() => {
    async function loadData() {
      try {
        const res = await fetch(`/api/libraries/${slug}/settings`);
        if (res.ok) {
          const data = await res.json();
          if (data.library) setLibrary(data.library);
          if (data.settings) setSettings(data.settings);
        }
      } catch {
        // Fallback already pre-set
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [slug]);

  // Compute Active Amount
  const shifts: ShiftConfig[] = sortShiftsChronologically(settings.shifts_config || FALLBACK_SETTINGS.shifts_config);
  const currentShift = shifts.find((s) => s.id === (selectedPlanType === "full_day" ? "full_day" : selectedShiftId)) || shifts[0];
  const calculatedAmount = hasSheet ? currentShift.sheet_price : currentShift.base_price;

  // Dynamic UPI URL
  const upiId = library.upi_id || "targetlibrary@upi";
  const upiName = encodeURIComponent(library.upi_name || library.name);
  const upiNote = encodeURIComponent(`Admission_${studentName.replace(/\s+/g, "_") || "Student"}`);
  const upiDeepLink = `upi://pay?pa=${upiId}&pn=${upiName}&am=${calculatedAmount}&cu=INR&tn=${upiNote}`;
  const qrImageSrc = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(
    upiDeepLink
  )}`;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentName.trim() || !studentPhone.trim()) {
      setErrorMessage("Please enter your name and phone number.");
      return;
    }
    if (!utrNumber.trim()) {
      setErrorMessage("Please enter the 12-digit UPI UTR / Reference Number after paying.");
      return;
    }

    setSubmitting(true);
    setErrorMessage(null);

    try {
      const res = await fetch("/api/admission-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug,
          student_name: studentName,
          student_phone: studentPhone,
          aadhar_no: aadharNo,
          subscription_type: selectedPlanType,
          shift_type: selectedPlanType === "half_day" ? selectedShiftId : null,
          has_sheet: hasSheet,
          amount_paid: calculatedAmount,
          payment_mode: "online",
          utr_number: utrNumber,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to submit admission request");

      setSubmittedSuccess(true);
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : "Error submitting request");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="w-8 h-8 border-3 border-rose-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-background text-text-main pb-16 pt-4 px-4 max-w-lg mx-auto">
      {/* Top Banner Branding */}
      <div className="text-center mb-6 border-b border-panel-border pb-5">
        <div className="flex justify-center mb-3">
          <LibraryLogo
            slug={slug}
            logoUrl={library.logo_url}
            name={library.name}
            size="xl"
            className="shadow-sm"
          />
        </div>
        <h1 className="text-2xl font-black tracking-tight">{library.name}</h1>
        <p className="text-xs text-text-muted mt-0.5">
          📍 {library.city || "Dehradun"} • Self-Service Admission & Pass Portal
        </p>
        <div className="mt-2">
          <Link
            href={`/l/${slug}/student`}
            className="text-[11px] font-bold text-rose-600 dark:text-rose-400 hover:underline inline-flex items-center gap-1"
          >
            <span>🪪 Already a member? View My Digital Pass →</span>
          </Link>
        </div>
      </div>

      {submittedSuccess ? (
        /* Success Screen */
        <div className="bg-card-bg border border-emerald-500/30 rounded-3xl p-6 text-center shadow-xl animate-in zoom-in-95 duration-200">
          <div className="w-16 h-16 bg-emerald-500/15 text-emerald-500 text-3xl rounded-full flex items-center justify-center mx-auto mb-4 border border-emerald-500/30">
            ✓
          </div>
          <h2 className="text-xl font-extrabold text-text-main">
            Admission Request Received!
          </h2>
          <p className="text-xs text-text-muted mt-2 leading-relaxed">
            Thank you, <span className="font-bold text-text-main">{studentName}</span>. Your fee payment of{" "}
            <span className="font-bold text-emerald-600 dark:text-emerald-400">₹{calculatedAmount}</span> (UTR: {utrNumber}) has been sent to the front desk.
          </p>

          <div className="my-5 p-4 rounded-2xl bg-neutral-500/5 border border-panel-border text-xs text-left space-y-2">
            <div className="flex justify-between">
              <span className="text-text-muted">Library:</span>
              <span className="font-bold text-text-main">{library.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-muted">Selected Plan:</span>
              <span className="font-semibold text-text-main">{currentShift.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-muted">Status:</span>
              <span className="font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                Awaiting Librarian Desk Verification
              </span>
            </div>
          </div>

          <p className="text-[11px] text-text-muted mb-5">
            The librarian will verify the transaction on the desk soundbox and assign your seat number shortly.
          </p>

          <div className="space-y-2.5">
            <Link
              href={`/l/${slug}/student?phone=${encodeURIComponent(studentPhone)}`}
              className="w-full py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-sm transition active:scale-95 flex items-center justify-center gap-1.5"
            >
              <span>🪪</span> View My Digital Student Pass
            </Link>

            <button
              onClick={() => {
                setSubmittedSuccess(false);
                setUtrNumber("");
              }}
              className="w-full py-2.5 rounded-xl border border-panel-border text-xs font-semibold hover:bg-neutral-100 dark:hover:bg-neutral-800 transition cursor-pointer"
            >
              Submit Another Admission
            </button>
          </div>
        </div>
      ) : (
        /* Multi-Step Admission Form */
        <form onSubmit={handleSubmit} className="space-y-5">
          {errorMessage && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-xs rounded-xl font-medium">
              ⚠️ {errorMessage}
            </div>
          )}

          {/* Section 1: Student Information */}
          <div className="bg-card-bg border border-panel-border rounded-2xl p-4.5 shadow-sm space-y-3.5">
            <h3 className="font-extrabold text-sm flex items-center gap-2 text-text-main">
              <span>👤</span> 1. Your Personal Details
            </h3>

            <div>
              <label className="text-[11px] font-bold text-text-muted uppercase tracking-wider block mb-1">
                Full Name *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Rahul Sharma"
                value={studentName}
                onChange={(e) => setStudentName(e.target.value)}
                className="w-full bg-background border border-panel-border rounded-xl px-3 py-2 text-sm text-text-main focus:outline-none focus:ring-2 focus:ring-rose-500"
              />
            </div>

            <div>
              <label className="text-[11px] font-bold text-text-muted uppercase tracking-wider block mb-1">
                WhatsApp Phone Number *
              </label>
              <input
                type="tel"
                required
                maxLength={10}
                placeholder="10-digit mobile number"
                value={studentPhone}
                onChange={(e) => setStudentPhone(e.target.value.replace(/\D/g, ""))}
                className="w-full bg-background border border-panel-border rounded-xl px-3 py-2 text-sm font-mono text-text-main focus:outline-none focus:ring-2 focus:ring-rose-500"
              />
              <p className="text-[10px] text-text-muted mt-1">
                Your digital pass & fee receipt will be sent here.
              </p>
            </div>

            <div>
              <label className="text-[11px] font-bold text-text-muted uppercase tracking-wider block mb-1">
                Aadhar Number (Optional)
              </label>
              <input
                type="text"
                maxLength={12}
                placeholder="12-digit Aadhar number"
                value={aadharNo}
                onChange={(e) => setAadharNo(e.target.value.replace(/\D/g, ""))}
                className="w-full bg-background border border-panel-border rounded-xl px-3 py-2 text-sm font-mono text-text-main focus:outline-none focus:ring-2 focus:ring-rose-500"
              />
            </div>
          </div>

          {/* Section 2: Choose Plan & Shifts */}
          <div className="bg-card-bg border border-panel-border rounded-2xl p-4.5 shadow-sm space-y-3.5">
            <h3 className="font-extrabold text-sm flex items-center gap-2 text-text-main">
              <span>🕒</span> 2. Choose Shift & Plan
            </h3>

            {/* Plan Type Pills */}
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setSelectedPlanType("half_day")}
                className={`py-2 px-3 rounded-xl border text-xs font-bold transition cursor-pointer ${
                  selectedPlanType === "half_day"
                    ? "bg-rose-500/15 border-rose-500 text-rose-600 dark:text-rose-400"
                    : "border-panel-border bg-background text-text-muted"
                }`}
              >
                Half Day Shift
              </button>

              <button
                type="button"
                onClick={() => setSelectedPlanType("full_day")}
                className={`py-2 px-3 rounded-xl border text-xs font-bold transition cursor-pointer ${
                  selectedPlanType === "full_day"
                    ? "bg-rose-500/15 border-rose-500 text-rose-600 dark:text-rose-400"
                    : "border-panel-border bg-background text-text-muted"
                }`}
              >
                Full Day (6AM - 12AM)
              </button>
            </div>

            {/* Shifts Selection (if half day) */}
            {selectedPlanType === "half_day" && (
              <div className="space-y-2 pt-1">
                {shifts
                  .filter((s) => s.id !== "full_day")
                  .map((shift) => (
                    <label
                      key={shift.id}
                      className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition ${
                        selectedShiftId === shift.id
                          ? "border-rose-500 bg-rose-500/5 shadow-xs"
                          : "border-panel-border bg-background hover:bg-neutral-500/5"
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <input
                          type="radio"
                          name="shiftSelection"
                          checked={selectedShiftId === shift.id}
                          onChange={() => setSelectedShiftId(shift.id)}
                          className="text-rose-600 focus:ring-rose-500"
                        />
                        <div>
                          <div className="font-bold text-xs text-text-main">{shift.name}</div>
                          <div className="text-[10px] text-text-muted">
                            {shift.start_time} to {shift.end_time}
                          </div>
                        </div>
                      </div>
                      <div className="font-black text-sm text-text-main">
                        ₹{hasSheet ? shift.sheet_price : shift.base_price}
                      </div>
                    </label>
                  ))}
              </div>
            )}

            {/* Desk Sheet Checkbox */}
            {settings.has_sheet_enabled && (
              <label className="flex items-center justify-between p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 cursor-pointer pt-2">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={hasSheet}
                    onChange={(e) => setHasSheet(e.target.checked)}
                    className="rounded text-amber-600 focus:ring-amber-500"
                  />
                  <div>
                    <span className="text-xs font-bold text-amber-700 dark:text-amber-400">
                      Reserve Desk Sheet Protection
                    </span>
                    <p className="text-[10px] text-amber-700/70 dark:text-amber-400/70">
                      Ensures your clean white desk sheet is reserved
                    </p>
                  </div>
                </div>
                <span className="text-xs font-black text-amber-700 dark:text-amber-400">
                  +₹{settings.sheet_price_monthly}
                </span>
              </label>
            )}
          </div>

          {/* Section 3: Dynamic UPI Payment */}
          <div className="bg-card-bg border border-panel-border rounded-2xl p-4.5 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-extrabold text-sm flex items-center gap-2 text-text-main">
                <span>📱</span> 3. Pay via UPI
              </h3>
              <div className="text-right">
                <div className="text-[10px] text-text-muted uppercase font-bold">Total Due</div>
                <div className="text-xl font-black text-emerald-600 dark:text-emerald-400">
                  ₹{calculatedAmount}
                </div>
              </div>
            </div>

            {/* QR Code Container */}
            <div className="bg-background border border-panel-border rounded-2xl p-4 text-center">
              <img
                src={qrImageSrc}
                alt="UPI Payment QR Code"
                className="w-48 h-48 mx-auto rounded-xl border border-neutral-300 dark:border-neutral-700 shadow-sm mb-2"
              />
              <div className="text-xs font-bold text-text-main">{library.upi_id || "targetlibrary@upi"}</div>
              <p className="text-[10px] text-text-muted mt-0.5">
                Scan using Google Pay, PhonePe, Paytm, or BHIM
              </p>

              {/* Direct UPI Mobile Deep Links */}
              <div className="flex items-center justify-center gap-2 mt-3 flex-wrap">
                <a
                  href={upiDeepLink}
                  className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold shadow-xs transition"
                >
                  ⚡ Open UPI App (GPay/PhonePe)
                </a>
              </div>
            </div>

            {/* UTR Input */}
            <div>
              <label className="text-[11px] font-bold text-text-muted uppercase tracking-wider block mb-1">
                12-Digit UPI Reference / UTR Number *
              </label>
              <input
                type="text"
                required
                maxLength={12}
                placeholder="e.g. 429108392102"
                value={utrNumber}
                onChange={(e) => setUtrNumber(e.target.value.replace(/\D/g, ""))}
                className="w-full bg-background border border-panel-border rounded-xl px-3 py-2 text-sm font-mono text-text-main focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <p className="text-[10px] text-text-muted mt-1">
                Enter the 12-digit UTR/Ref number shown on your payment receipt after paying.
              </p>
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3.5 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white font-extrabold text-sm shadow-md transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
          >
            {submitting ? "Submitting Admission..." : `Submit Admission & Confirm ₹${calculatedAmount}`}
          </button>
        </form>
      )}

      {/* Footer */}
      <div className="text-center mt-6 text-[11px] text-text-muted space-y-1">
        <div>
          <Link
            href={`/login?slug=${slug}`}
            className="hover:text-text-main hover:underline font-semibold"
          >
            Staff &amp; Owner Login &rarr;
          </Link>
        </div>
        <div>
          Powered by <span className="font-bold">LibraryOS</span>
        </div>
      </div>
    </main>
  );
}
