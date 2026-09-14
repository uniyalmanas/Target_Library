"use client";

import { useState, useEffect } from "react";
import { Library, SubscriptionRequest } from "./types";
import LibraryLogo from "./LibraryLogo";
import { generateUpiIntentUrl, generateUpiQrCodeUrl } from "./upi";

interface SubscriptionPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  library: Library;
  onSuccess?: () => void;
}

export default function SubscriptionPaymentModal({
  isOpen,
  onClose,
  library,
  onSuccess,
}: SubscriptionPaymentModalProps) {
  // Dynamic SaaS Payment Configuration
  const [saasUpiId, setSaasUpiId] = useState(process.env.NEXT_PUBLIC_SAAS_UPI_ID || "uniyalmanas@oksbi");
  const [saasPayeeName, setSaasPayeeName] = useState(process.env.NEXT_PUBLIC_SAAS_UPI_NAME || "Manas Uniyal");
  const [saasPhone, setSaasPhone] = useState("8535035757");

  // Plan Selection State
  const totalSeats = (library as any).library_settings?.total_seats || 60;
  const seatPlanRate = Math.max(300, totalSeats * 6);
  const flatPlanRate = 599;

  const [selectedPlan, setSelectedPlan] = useState<"flat" | "seat">("flat");
  const payAmount = selectedPlan === "flat" ? flatPlanRate : seatPlanRate;
  const planName =
    selectedPlan === "flat"
      ? "Flat Monthly Pro (₹599)"
      : `Pay-As-You-Grow (₹6 × ${totalSeats} seats = ₹${seatPlanRate})`;

  // Screenshot Upload State
  const [screenshotData, setScreenshotData] = useState<string | null>(null);
  const [screenshotSizeKb, setScreenshotSizeKb] = useState<number | null>(null);
  const [utrNumber, setUtrNumber] = useState("");
  const [notes, setNotes] = useState("");
  const [uploadingImage, setUploadingImage] = useState(false);
  const [submittingPayment, setSubmittingPayment] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [copiedUpi, setCopiedUpi] = useState(false);

  // Existing Subscription Request State
  const [existingRequest, setExistingRequest] = useState<SubscriptionRequest | null>(null);
  const [loadingExistingRequest, setLoadingExistingRequest] = useState(false);
  const [showUploadForm, setShowUploadForm] = useState(false);
  const [checking, setChecking] = useState(false);
  const [checkMessage, setCheckMessage] = useState<string | null>(null);

  // Fetch existing request on open
  const fetchLatestRequest = async () => {
    if (!library.slug) return;
    try {
      setLoadingExistingRequest(true);
      const res = await fetch(`/api/subscription-requests?slug=${encodeURIComponent(library.slug)}`);
      const data = await res.json();
      if (res.ok && data.request) {
        setExistingRequest(data.request);
        if (data.request.status === "approved" && onSuccess) {
          onSuccess();
        }
      }
    } catch {
      // Ignore background poll errors
    } finally {
      setLoadingExistingRequest(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchLatestRequest();
      setSubmitSuccess(false);
      setSubmitError(null);

      // Fetch dynamic platform UPI config from database
      fetch("/api/platform-config")
        .then((res) => res.json())
        .then((data) => {
          if (data?.upi_id) setSaasUpiId(data.upi_id);
          if (data?.upi_name) setSaasPayeeName(data.upi_name);
          if (data?.phone) setSaasPhone(data.phone);
        })
        .catch(() => {});
    }
  }, [isOpen, library.slug]);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Handle Refresh Verification
  const handleRefresh = async () => {
    setChecking(true);
    setCheckMessage(null);
    try {
      await fetchLatestRequest();
      if (onSuccess) onSuccess();
      setCheckMessage("Verification check completed. If approved, your workspace unlocks instantly.");
    } catch {
      setCheckMessage("Unable to verify payment status. Please contact Super Admin.");
    } finally {
      setChecking(false);
    }
  };

  // Handle Client-Side Image Compression to WebP
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      alert("Please select a valid image file (PNG, JPG, WebP, etc.)");
      return;
    }

    setUploadingImage(true);
    setSubmitError(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const maxDim = 1024;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxDim) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          }
        } else {
          if (height > maxDim) {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const compressed = canvas.toDataURL("image/webp", 0.82);
          setScreenshotData(compressed);
          const sizeKb = Math.round((compressed.length * 3) / 4 / 1024);
          setScreenshotSizeKb(sizeKb);
        }
        setUploadingImage(false);
      };
      img.onerror = () => {
        alert("Failed to process payment screenshot.");
        setUploadingImage(false);
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  // Submit Payment Screenshot
  const handleSubmitPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!screenshotData) {
      setSubmitError("Please attach a screenshot of your payment receipt.");
      return;
    }

    setSubmittingPayment(true);
    setSubmitError(null);

    try {
      const res = await fetch("/api/subscription-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          library_id: library.id,
          library_slug: library.slug,
          library_name: library.name,
          amount: payAmount,
          plan_name: planName,
          screenshot_url: screenshotData,
          utr_number: utrNumber.trim() || null,
          notes: notes.trim() || null,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to submit payment screenshot.");

      setSubmitSuccess(true);
      setShowUploadForm(false);
      fetchLatestRequest();
      if (onSuccess) onSuccess();
    } catch (err: unknown) {
      setSubmitError(err instanceof Error ? err.message : "Error submitting payment.");
    } finally {
      setSubmittingPayment(false);
    }
  };

  // Copy UPI ID
  const handleCopyUpi = () => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(saasUpiId);
      setCopiedUpi(true);
      setTimeout(() => setCopiedUpi(false), 2500);
    }
  };

  // Dynamic UPI URLs
  const upiQrCodeUrl = generateUpiQrCodeUrl(
    {
      upiId: saasUpiId,
      payeeName: saasPayeeName,
      amount: payAmount,
      note: `LibraryOS sub ${library.slug}`,
    },
    260
  );

  const upiIntentUrl = generateUpiIntentUrl({
    upiId: saasUpiId,
    payeeName: saasPayeeName,
    amount: payAmount,
    note: `LibraryOS sub ${library.slug}`,
  });

  const cleanWaPhone = saasPhone.replace(/\D/g, "");
  const waPhoneWithCountry = cleanWaPhone.length === 10 ? `91${cleanWaPhone}` : cleanWaPhone;

  const waMessage = encodeURIComponent(
    `Hi LibraryOS Admin, I am the owner of ${library.name} (/l/${library.slug}). I have completed the early payment of ₹${payAmount} for the ${planName} plan and uploaded my screenshot on the portal. Please approve my workspace.`
  );

  const hasPendingVerification = existingRequest && existingRequest.status === "pending" && !showUploadForm;

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5 overflow-y-auto animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-card-bg border-2 border-rose-500/30 rounded-3xl max-w-2xl w-full p-5 sm:p-8 shadow-2xl space-y-5 relative my-8 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Glow accent */}
        <div className="absolute top-0 right-0 w-72 h-72 bg-rose-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20"></div>
        <div className="absolute bottom-0 left-0 w-72 h-72 bg-amber-500/10 rounded-full blur-3xl pointer-events-none -ml-20 -mb-20"></div>

        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-panel-border pb-4 relative z-10">
          <div className="flex items-center gap-3">
            <LibraryLogo
              slug={library.slug}
              logoUrl={library.logo_url}
              name={library.name}
              size="md"
            />
            <div>
              <h2 className="text-lg font-black text-text-main tracking-tight flex items-center gap-1.5">
                <span>⚡</span> Pay & Activate Subscription Early
              </h2>
              <p className="text-xs text-text-muted">
                {library.name} • Workspace /l/{library.slug}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-neutral-500/10 hover:bg-neutral-500/20 text-foreground font-bold flex items-center justify-center transition cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Pending Verification Banner If User Already Submitted */}
        {hasPendingVerification ? (
          <div className="p-5 rounded-2xl bg-amber-500/10 border-2 border-amber-500/30 space-y-4 relative z-10 animate-in fade-in">
            <div className="flex items-start gap-3">
              <span className="text-2xl p-2 rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400 shrink-0">
                ⏳
              </span>
              <div className="space-y-1 flex-1 text-xs">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-sm font-black text-text-main">
                    Payment Verification In Progress
                  </h3>
                  <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                    Under Review
                  </span>
                </div>
                <p className="text-text-muted leading-relaxed">
                  We received your payment screenshot for <strong>₹{existingRequest.amount}</strong> ({existingRequest.plan_name}). Our team is verifying your payment. Once approved, 30 days will be added to your account.
                </p>
              </div>
            </div>

            {/* Submitted Info Preview */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 rounded-xl bg-card-bg/70 border border-panel-border text-xs">
              <div className="space-y-1">
                <span className="text-[10px] uppercase font-bold text-text-muted">Plan Details</span>
                <p className="font-bold text-foreground">{existingRequest.plan_name}</p>
                <p className="text-text-muted text-[11px]">
                  Submitted: {new Date(existingRequest.created_at).toLocaleString("en-IN")}
                </p>
                {existingRequest.utr_number && (
                  <p className="text-text-muted text-[11px] font-mono">
                    UTR: {existingRequest.utr_number}
                  </p>
                )}
              </div>
              <div className="flex items-center sm:justify-end gap-2">
                {existingRequest.screenshot_url && (
                  <img
                    src={existingRequest.screenshot_url}
                    alt="Submitted Screenshot"
                    className="w-16 h-16 object-cover rounded-xl border border-panel-border shadow-2xs"
                  />
                )}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
              <a
                href={`https://wa.me/${waPhoneWithCountry}?text=${waMessage}`}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs shadow-sm transition active:scale-95 flex items-center justify-center gap-1.5 text-center cursor-pointer"
              >
                <span>💬</span> WhatsApp Founder
              </a>

              <button
                onClick={handleRefresh}
                disabled={checking}
                className="w-full py-2.5 px-3 rounded-xl bg-card-bg border border-panel-border hover:bg-neutral-100 dark:hover:bg-neutral-800 text-text-main font-bold text-xs shadow-2xs transition active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <span>{checking ? "⏳" : "🔄"}</span>
                {checking ? "Checking..." : "Refresh Status"}
              </button>
            </div>

            <div className="text-center pt-1">
              <button
                type="button"
                onClick={() => setShowUploadForm(true)}
                className="text-[11px] text-text-muted hover:text-text-main underline cursor-pointer"
              >
                Need to re-upload or select a different plan?
              </button>
            </div>
          </div>
        ) : (
          /* Payment & Screenshot Form */
          <div className="space-y-4 relative z-10 text-xs">
            {/* Rejection notice if previously rejected */}
            {existingRequest && existingRequest.status === "rejected" && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-700 dark:text-rose-300 space-y-0.5 animate-in fade-in">
                <div className="font-bold flex items-center gap-1.5">
                  <span>⚠️</span> Previous Submission Rejected
                </div>
                <p>
                  Reason: <strong>{existingRequest.rejection_reason || "Payment could not be verified."}</strong>
                </p>
              </div>
            )}

            {/* Step 1: Select Plan */}
            <div className="space-y-2">
              <span className="text-[10px] font-black uppercase tracking-wider text-text-muted">
                Step 1: Choose Your Plan
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => setSelectedPlan("flat")}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-1.5 ${
                    selectedPlan === "flat"
                      ? "border-rose-500 bg-rose-500/10 ring-1 ring-rose-500/30"
                      : "border-panel-border bg-card-bg hover:border-neutral-400"
                  }`}
                >
                  <div className="flex justify-between items-center">
                    <span className="font-extrabold text-foreground">🚀 Flat Monthly Pro</span>
                    {selectedPlan === "flat" && <span className="text-rose-600 font-bold">✓</span>}
                  </div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-xl font-black font-mono">₹{flatPlanRate}</span>
                    <span className="text-[10px] text-text-muted">/ month</span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedPlan("seat")}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-1.5 ${
                    selectedPlan === "seat"
                      ? "border-rose-500 bg-rose-500/10 ring-1 ring-rose-500/30"
                      : "border-panel-border bg-card-bg hover:border-neutral-400"
                  }`}
                >
                  <div className="flex justify-between items-center">
                    <span className="font-extrabold text-foreground">🌱 Pay-As-You-Grow</span>
                    {selectedPlan === "seat" && <span className="text-rose-600 font-bold">✓</span>}
                  </div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-xl font-black font-mono">₹{seatPlanRate}</span>
                    <span className="text-[10px] text-text-muted">/ month ({totalSeats} seats)</span>
                  </div>
                </button>
              </div>
            </div>

            {/* Step 2: Dynamic UPI QR Code */}
            <div className="p-4 rounded-2xl bg-neutral-500/5 border border-panel-border space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-wider text-text-muted">
                  Step 2: Scan QR & Pay Exact ₹{payAmount}
                </span>
                <span className="text-[10px] font-black text-emerald-600 dark:text-emerald-400">
                  ⚡ 0% Extra Charges
                </span>
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                {/* QR Code */}
                <div className="p-2.5 bg-white rounded-xl border border-neutral-200 dark:border-neutral-700 shadow-sm shrink-0 text-center">
                  <img
                    src={upiQrCodeUrl}
                    alt="Dynamic UPI QR Code"
                    className="w-36 h-36 mx-auto rounded object-contain"
                  />
                  <div className="text-[9px] font-mono font-bold text-neutral-800 mt-1">
                    Pay ₹{payAmount}
                  </div>
                </div>

                {/* Instructions & Copy UPI */}
                <div className="space-y-2 flex-1 w-full">
                  <div className="p-2.5 rounded-xl bg-card-bg border border-panel-border space-y-1">
                    <div className="text-[9px] font-bold text-text-muted uppercase">Receiver UPI ID</div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono font-bold text-text-main text-xs">{saasUpiId}</span>
                      <button
                        type="button"
                        onClick={handleCopyUpi}
                        className="px-2 py-0.5 rounded bg-neutral-500/10 hover:bg-neutral-500/20 text-[10px] font-semibold transition cursor-pointer"
                      >
                        {copiedUpi ? "Copied! ✓" : "Copy"}
                      </button>
                    </div>
                    <div className="text-[10px] text-text-muted pt-0.5 flex items-center justify-between flex-wrap gap-1 border-t border-panel-border/60">
                      <span>Payee: <strong className="text-foreground">{saasPayeeName}</strong></span>
                      <span>Phone: <strong className="text-foreground font-mono">{saasPhone}</strong></span>
                    </div>
                  </div>

                  <a
                    href={upiIntentUrl}
                    className="w-full py-2 px-3 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-white dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-white font-bold text-[11px] transition flex items-center justify-center gap-1.5 text-center"
                  >
                    <span>📱</span> Pay with Installed UPI App
                  </a>
                </div>
              </div>
            </div>

            {/* Step 3: Screenshot Upload */}
            <form onSubmit={handleSubmitPayment} className="space-y-3">
              <span className="text-[10px] font-black uppercase tracking-wider text-text-muted">
                Step 3: Attach Payment Screenshot
              </span>

              <div className="border-2 border-dashed border-panel-border hover:border-rose-500/50 rounded-2xl p-4 text-center transition bg-card-bg">
                {screenshotData ? (
                  <div className="space-y-2 animate-in fade-in">
                    <div className="relative inline-block mx-auto">
                      <img
                        src={screenshotData}
                        alt="Payment Screenshot Preview"
                        className="max-h-40 max-w-full rounded-lg border border-panel-border shadow-sm object-contain mx-auto"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setScreenshotData(null);
                          setScreenshotSizeKb(null);
                        }}
                        className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-rose-600 text-white font-bold flex items-center justify-center text-[10px] shadow hover:scale-105 transition cursor-pointer"
                      >
                        ✕
                      </button>
                    </div>
                    <div className="text-[11px] text-text-muted flex items-center justify-center gap-1.5">
                      <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                        ✓ Screenshot attached
                      </span>
                      {screenshotSizeKb && <span>({screenshotSizeKb} KB compressed)</span>}
                    </div>
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center gap-1.5 cursor-pointer py-2">
                    <span className="text-xl">📸</span>
                    <span className="font-bold text-foreground text-xs">
                      {uploadingImage ? "Processing image..." : "Upload Payment Screenshot"}
                    </span>
                    <span className="text-[10px] text-text-muted">Tap to select photo from gallery</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleFileChange}
                      disabled={uploadingImage}
                      className="hidden"
                    />
                  </label>
                )}
              </div>

              {/* Optional UTR & Notes */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <input
                  type="text"
                  placeholder="12-Digit UPI Ref / UTR (Optional)"
                  value={utrNumber}
                  onChange={(e) => setUtrNumber(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-card-bg border border-panel-border text-xs outline-none focus:border-rose-500 font-mono"
                />
                <input
                  type="text"
                  placeholder="Remarks (Optional)"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-card-bg border border-panel-border text-xs outline-none focus:border-rose-500"
                />
              </div>

              {submitError && (
                <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 font-semibold text-center">
                  {submitError}
                </div>
              )}

              <button
                type="submit"
                disabled={submittingPayment || uploadingImage || !screenshotData}
                className="w-full py-3 px-5 rounded-2xl bg-gradient-to-r from-rose-600 to-rose-500 hover:from-rose-500 hover:to-rose-400 text-white font-black text-xs shadow-md transition active:scale-95 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span>{submittingPayment ? "⏳" : "📤"}</span>
                {submittingPayment ? "Submitting..." : `Submit Payment Screenshot (₹${payAmount})`}
              </button>
            </form>
          </div>
        )}

        {/* Footer Support Info */}
        <div className="text-center text-[11px] text-text-muted pt-2 border-t border-panel-border">
          Need instant activation on the spot? WhatsApp Founder Desk at{" "}
          <a href={`tel:+${waPhoneWithCountry}`} className="font-bold text-rose-600 hover:underline">
            {saasPhone}
          </a>
        </div>
      </div>
    </div>
  );
}
