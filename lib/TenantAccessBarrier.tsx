"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Library, SubscriptionRequest } from "./types";
import { LibraryAccessInfo } from "./tenant";
import LibraryLogo from "./LibraryLogo";
import { generateUpiIntentUrl, generateUpiQrCodeUrl } from "./upi";

interface TenantAccessBarrierProps {
  library: Library;
  access: LibraryAccessInfo;
  onRefresh?: () => void;
}

export default function TenantAccessBarrier({
  library,
  access,
  onRefresh,
}: TenantAccessBarrierProps) {
  const [checking, setChecking] = useState(false);
  const [checkMessage, setCheckMessage] = useState<string | null>(null);
  const [showOverride, setShowOverride] = useState(false);
  const [overridePass, setOverridePass] = useState("");
  const [overrideError, setOverrideError] = useState<string | null>(null);

  // SaaS Payment Configuration
  const saasUpiId = process.env.NEXT_PUBLIC_SAAS_UPI_ID || "uniyalmanas@oksbi";
  const saasPayeeName = process.env.NEXT_PUBLIC_SAAS_UPI_NAME || "Manas Uniyal";

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
  const [loadingExistingRequest, setLoadingExistingRequest] = useState(true);
  const [showUploadForm, setShowUploadForm] = useState(false);

  const isTrialExpired = access.status === "trial_expired" || access.isTrial;

  // Fetch existing request on mount
  const fetchLatestRequest = async () => {
    try {
      setLoadingExistingRequest(true);
      const res = await fetch(`/api/subscription-requests?slug=${encodeURIComponent(library.slug)}`);
      const data = await res.json();
      if (res.ok && data.request) {
        setExistingRequest(data.request);
        if (data.request.status === "approved") {
          // If approved, trigger refresh
          if (onRefresh) onRefresh();
        }
      }
    } catch {
      // Ignore network errors on background poll
    } finally {
      setLoadingExistingRequest(false);
    }
  };

  useEffect(() => {
    fetchLatestRequest();
  }, [library.slug]);

  // Handle Refresh Verification
  const handleRefresh = async () => {
    setChecking(true);
    setCheckMessage(null);
    try {
      await fetchLatestRequest();
      if (onRefresh) {
        await onRefresh();
      } else {
        window.location.reload();
      }
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

  // Founder Emergency Override
  const handleEmergencyOverride = async (e: React.FormEvent) => {
    e.preventDefault();
    const pass = overridePass.trim();
    if (
      pass === "Manas@12" ||
      pass === "Target2026" ||
      pass === "AdminTarget2026" ||
      pass === "Founder2026" ||
      pass === "TargetOwner2026"
    ) {
      sessionStorage.setItem("target_lib_admin_override", "true");
      localStorage.setItem("target_lib_admin_override", "true");
      sessionStorage.setItem("libraryos_superadmin_auth", "true");
      localStorage.setItem("libraryos_superadmin_master", "true");
      sessionStorage.setItem("target_lib_owner_auth", "true");
      localStorage.setItem("target_lib_owner_auth", "true");
      alert("Founder master key verified. Unrestricted master access granted.");
      window.location.reload();
    } else {
      setOverrideError("Invalid founder authorization key.");
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

  const waMessage = encodeURIComponent(
    `Hi LibraryOS Admin, I am the owner of ${library.name} (/l/${library.slug}). I have completed the payment of ₹${payAmount} for the ${planName} plan and uploaded my screenshot on the portal. Please approve my workspace.`
  );

  const hasPendingVerification = existingRequest && existingRequest.status === "pending" && !showUploadForm;

  return (
    <div className="min-h-[85vh] flex items-center justify-center p-4 sm:p-6 w-full">
      <div className="w-full max-w-3xl bg-card-bg border-2 border-rose-500/30 rounded-3xl p-6 sm:p-10 shadow-2xl space-y-6 relative overflow-hidden animate-in fade-in zoom-in-95">
        {/* Glow accent */}
        <div className="absolute top-0 right-0 w-80 h-80 bg-rose-500/10 rounded-full blur-3xl pointer-events-none -mr-24 -mt-24"></div>
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-amber-500/10 rounded-full blur-3xl pointer-events-none -ml-24 -mb-24"></div>

        {/* Top Header & Branding */}
        <div className="flex items-center justify-between gap-4 border-b border-panel-border pb-5 relative z-10">
          <div className="flex items-center gap-3">
            <LibraryLogo
              slug={library.slug}
              logoUrl={library.logo_url}
              name={library.name}
              size="lg"
            />
            <div>
              <h1 className="text-xl font-black text-text-main tracking-tight">
                {library.name}
              </h1>
              <p className="text-xs text-text-muted font-medium mt-0.5">
                📍 {library.city || "Dehradun"} • Workspace /l/{library.slug}
              </p>
            </div>
          </div>

          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30 shrink-0">
            <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping"></span>
            {isTrialExpired ? "7-DAY TRIAL EXPIRED" : "SUBSCRIPTION LOCKED"}
          </span>
        </div>

        {/* Critical Guarantee: Data is 100% Safe & Preserved */}
        <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-800 dark:text-emerald-300 flex items-start gap-3 relative z-10">
          <span className="text-2xl shrink-0">🛡️</span>
          <div className="text-xs space-y-1">
            <div className="font-extrabold text-sm text-emerald-700 dark:text-emerald-200">
              Your Data is 100% Safe & Preserved
            </div>
            <p className="leading-relaxed opacity-90">
              Rest assured: <strong>no student data, receipts, seats, or payment records have been deleted</strong>. All your library information remains securely encrypted in the cloud database and will instantly restore upon payment verification.
            </p>
          </div>
        </div>

        {/* Pending Verification Banner If User Already Submitted */}
        {hasPendingVerification ? (
          <div className="p-6 rounded-3xl bg-amber-500/10 border-2 border-amber-500/30 space-y-5 relative z-10 animate-in fade-in">
            <div className="flex items-start gap-4">
              <span className="text-3xl p-3 rounded-2xl bg-amber-500/20 text-amber-600 dark:text-amber-400 shrink-0">
                ⏳
              </span>
              <div className="space-y-1.5 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-lg font-black text-text-main">
                    Payment Verification In Progress
                  </h2>
                  <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                    Under Review
                  </span>
                </div>
                <p className="text-xs text-text-muted leading-relaxed">
                  We received your payment screenshot for <strong>₹{existingRequest.amount}</strong> ({existingRequest.plan_name}). Our team is verifying the transaction details against our bank ledger.
                </p>
              </div>
            </div>

            {/* Submitted Info Preview */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 rounded-2xl bg-card-bg/60 border border-panel-border text-xs">
              <div className="space-y-1">
                <span className="text-[10px] uppercase font-bold text-text-muted">Submitted Plan</span>
                <p className="font-bold text-foreground">{existingRequest.plan_name}</p>
                <p className="text-text-muted text-[11px]">
                  Submitted on: {new Date(existingRequest.created_at).toLocaleString("en-IN")}
                </p>
                {existingRequest.utr_number && (
                  <p className="text-text-muted text-[11px] font-mono">
                    UTR: {existingRequest.utr_number}
                  </p>
                )}
              </div>
              <div className="flex items-center sm:justify-end gap-3">
                {existingRequest.screenshot_url && (
                  <div className="relative group">
                    <img
                      src={existingRequest.screenshot_url}
                      alt="Submitted Payment Screenshot"
                      className="w-16 h-16 object-cover rounded-xl border border-panel-border shadow-2xs"
                    />
                    <a
                      href={existingRequest.screenshot_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="absolute inset-0 bg-black/50 text-white rounded-xl flex items-center justify-center opacity-0 group-hover:opacity-100 transition text-[10px] font-bold"
                    >
                      View
                    </a>
                  </div>
                )}
              </div>
            </div>

            {/* Action Buttons for Pending State */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              <a
                href={`https://wa.me/918535035757?text=${waMessage}`}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs shadow-md shadow-emerald-600/20 transition active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>💬</span> WhatsApp Founder for Fast-Track Activation
              </a>

              <button
                onClick={handleRefresh}
                disabled={checking}
                className="w-full py-3 px-4 rounded-xl bg-card-bg border border-panel-border hover:bg-neutral-100 dark:hover:bg-neutral-800 text-text-main font-bold text-xs shadow-sm transition active:scale-95 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <span>{checking ? "⏳" : "🔄"}</span>
                {checking ? "Checking Approval Status..." : "Check Status / Refresh"}
              </button>
            </div>

            <div className="text-center pt-1">
              <button
                type="button"
                onClick={() => setShowUploadForm(true)}
                className="text-[11px] text-text-muted hover:text-text-main underline cursor-pointer"
              >
                Need to re-upload or choose a different plan?
              </button>
            </div>
          </div>
        ) : (
          /* Payment & Screenshot Submission Form */
          <div className="space-y-6 relative z-10">
            {/* Rejection notice if previously rejected */}
            {existingRequest && existingRequest.status === "rejected" && (
              <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-700 dark:text-rose-300 text-xs space-y-1 animate-in fade-in">
                <div className="font-bold flex items-center gap-2">
                  <span>⚠️</span> Previous Submission Rejected
                </div>
                <p>
                  Reason: <strong>{existingRequest.rejection_reason || "Payment could not be verified."}</strong>
                </p>
                <p className="opacity-80">
                  Please scan the QR below, complete the payment, and upload a valid transaction screenshot.
                </p>
              </div>
            )}

            {/* Header Description */}
            <div className="space-y-2 text-center">
              <h2 className="text-xl sm:text-2xl font-black text-text-main tracking-tight">
                {isTrialExpired
                  ? "Select a Plan & Scan UPI QR to Unlock"
                  : "Renew Subscription & Submit Screenshot"}
              </h2>
              <p className="text-xs sm:text-sm text-text-muted max-w-lg mx-auto leading-relaxed">
                Scan the dynamic UPI QR code with any payment app (GPay, PhonePe, Paytm, BHIM), then upload your payment screenshot below for instant verification.
              </p>
            </div>

            {/* Step 1: Choose Subscription Plan */}
            <div className="space-y-2.5">
              <span className="text-[11px] font-black uppercase tracking-wider text-text-muted">
                Step 1: Select Your Plan
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {/* Option 1: Flat Pro */}
                <button
                  type="button"
                  onClick={() => setSelectedPlan("flat")}
                  className={`p-4 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-3 ${
                    selectedPlan === "flat"
                      ? "border-rose-500 bg-rose-500/10 shadow-md ring-2 ring-rose-500/20"
                      : "border-panel-border bg-card-bg hover:border-neutral-400 dark:hover:border-neutral-600"
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="font-black text-sm text-text-main flex items-center gap-1.5">
                        <span>🚀</span> Flat Monthly Pro
                      </div>
                      <p className="text-[11px] text-text-muted mt-0.5">
                        Unlimited seats up to 500
                      </p>
                    </div>
                    {selectedPlan === "flat" && (
                      <span className="w-5 h-5 rounded-full bg-rose-600 text-white text-xs flex items-center justify-center font-bold">
                        ✓
                      </span>
                    )}
                  </div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-2xl font-black font-mono text-foreground">₹{flatPlanRate}</span>
                    <span className="text-xs text-text-muted font-semibold">/ month</span>
                  </div>
                </button>

                {/* Option 2: Pay Per Seat */}
                <button
                  type="button"
                  onClick={() => setSelectedPlan("seat")}
                  className={`p-4 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-3 ${
                    selectedPlan === "seat"
                      ? "border-rose-500 bg-rose-500/10 shadow-md ring-2 ring-rose-500/20"
                      : "border-panel-border bg-card-bg hover:border-neutral-400 dark:hover:border-neutral-600"
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="font-black text-sm text-text-main flex items-center gap-1.5">
                        <span>🌱</span> Pay-As-You-Grow
                      </div>
                      <p className="text-[11px] text-text-muted mt-0.5">
                        ₹6/seat/month ({totalSeats} total seats)
                      </p>
                    </div>
                    {selectedPlan === "seat" && (
                      <span className="w-5 h-5 rounded-full bg-rose-600 text-white text-xs flex items-center justify-center font-bold">
                        ✓
                      </span>
                    )}
                  </div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-2xl font-black font-mono text-foreground">₹{seatPlanRate}</span>
                    <span className="text-xs text-text-muted font-semibold">/ month</span>
                  </div>
                </button>
              </div>
            </div>

            {/* Step 2: Dynamic UPI QR Code & Direct Intent */}
            <div className="p-5 rounded-3xl bg-neutral-500/5 border border-panel-border space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <span className="text-[11px] font-black uppercase tracking-wider text-text-muted">
                  Step 2: Scan QR & Pay Exact Amount (₹{payAmount})
                </span>
                <span className="text-xs font-black text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                  <span>⚡</span> 0% Extra Charges
                </span>
              </div>

              <div className="flex flex-col md:flex-row items-center justify-center gap-6 pt-1">
                {/* QR Code Canvas */}
                <div className="p-3.5 bg-white rounded-2xl border-2 border-neutral-200 dark:border-neutral-700 shadow-lg text-center shrink-0">
                  <img
                    src={upiQrCodeUrl}
                    alt="SaaS Subscription Dynamic UPI QR Code"
                    className="w-48 h-48 mx-auto rounded-lg object-contain"
                  />
                  <div className="text-[10px] font-mono font-bold text-neutral-800 mt-2">
                    Pay Exactly ₹{payAmount}
                  </div>
                </div>

                {/* Instructions & Mobile Deep Link */}
                <div className="space-y-3.5 text-xs text-left max-w-sm w-full">
                  <div className="p-3 rounded-xl bg-card-bg border border-panel-border space-y-1">
                    <div className="text-[10px] font-bold text-text-muted uppercase">
                      Receiver UPI ID
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono font-bold text-text-main text-sm">
                        {saasUpiId}
                      </span>
                      <button
                        type="button"
                        onClick={handleCopyUpi}
                        className="px-2.5 py-1 rounded-lg bg-neutral-500/10 hover:bg-neutral-500/20 text-text-main font-semibold text-[10px] transition cursor-pointer"
                      >
                        {copiedUpi ? "Copied! ✓" : "Copy"}
                      </button>
                    </div>
                    <div className="text-[11px] text-text-muted pt-1 flex items-center justify-between flex-wrap gap-1 border-t border-panel-border/60">
                      <span>Payee: <strong className="text-foreground">{saasPayeeName}</strong></span>
                      <span>Phone: <strong className="text-foreground font-mono">8535035757</strong></span>
                    </div>
                  </div>

                  <div className="space-y-1.5 text-text-muted leading-relaxed text-[11px]">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-emerald-500">1.</span>
                      <span>Scan with <strong>Google Pay, PhonePe, Paytm, or BHIM</strong>.</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-emerald-500">2.</span>
                      <span>Pay the exact amount of <strong>₹{payAmount}</strong>.</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-emerald-500">3.</span>
                      <span>Take a screenshot of the completed payment receipt.</span>
                    </div>
                  </div>

                  {/* Mobile Direct Intent Button */}
                  <a
                    href={upiIntentUrl}
                    className="w-full py-2.5 px-4 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-white dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-white font-bold text-xs shadow-sm transition active:scale-95 flex items-center justify-center gap-2 text-center"
                  >
                    <span>📱</span> Pay with Installed UPI App
                  </a>
                </div>
              </div>
            </div>

            {/* Step 3: Screenshot Upload Box */}
            <form onSubmit={handleSubmitPayment} className="space-y-4">
              <span className="text-[11px] font-black uppercase tracking-wider text-text-muted">
                Step 3: Attach Payment Screenshot
              </span>

              {/* Upload Dropzone / Preview */}
              <div className="border-2 border-dashed border-panel-border hover:border-rose-500/50 rounded-2xl p-5 text-center transition bg-card-bg">
                {screenshotData ? (
                  <div className="space-y-3 animate-in fade-in">
                    <div className="relative inline-block mx-auto group">
                      <img
                        src={screenshotData}
                        alt="Payment Screenshot Preview"
                        className="max-h-56 max-w-full rounded-xl border border-panel-border shadow-md object-contain mx-auto"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setScreenshotData(null);
                          setScreenshotSizeKb(null);
                        }}
                        className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-rose-600 text-white font-bold flex items-center justify-center text-xs shadow-md hover:scale-105 transition cursor-pointer"
                        title="Remove screenshot"
                      >
                        ✕
                      </button>
                    </div>
                    <div className="flex items-center justify-center gap-2 text-xs text-text-muted">
                      <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                        ✓ Screenshot ready for verification
                      </span>
                      {screenshotSizeKb && (
                        <span>({screenshotSizeKb} KB compressed)</span>
                      )}
                    </div>
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center gap-2.5 cursor-pointer py-4">
                    <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 flex items-center justify-center text-2xl">
                      📸
                    </div>
                    <div className="space-y-0.5">
                      <p className="font-bold text-text-main text-xs sm:text-sm">
                        {uploadingImage ? "Processing image..." : "Upload Payment Screenshot"}
                      </p>
                      <p className="text-[11px] text-text-muted">
                        Select screenshot from gallery or camera (PNG, JPG, WebP)
                      </p>
                    </div>
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
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input
                  type="text"
                  placeholder="12-Digit UPI Ref / UTR No. (Optional)"
                  value={utrNumber}
                  onChange={(e) => setUtrNumber(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-card-bg border border-panel-border text-xs outline-none focus:border-rose-500 font-mono"
                />
                <input
                  type="text"
                  placeholder="Sender Name or Remarks (Optional)"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-card-bg border border-panel-border text-xs outline-none focus:border-rose-500"
                />
              </div>

              {submitError && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-xs font-semibold text-center">
                  {submitError}
                </div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={submittingPayment || uploadingImage || !screenshotData}
                className="w-full py-3.5 px-6 rounded-2xl bg-gradient-to-r from-rose-600 to-rose-500 hover:from-rose-500 hover:to-rose-400 text-white font-black text-sm shadow-lg shadow-rose-600/20 transition active:scale-95 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span>{submittingPayment ? "⏳" : "📤"}</span>
                {submittingPayment
                  ? "Submitting Payment Proof..."
                  : `Submit Payment Screenshot (₹${payAmount})`}
              </button>
            </form>
          </div>
        )}

        {/* Check Status / Refresh Banner */}
        {checkMessage && (
          <div className="text-center text-xs font-semibold text-text-muted pt-1">
            {checkMessage}
          </div>
        )}

        {/* Founder & Payment Support Info */}
        <div className="text-center text-xs text-text-muted space-y-2 relative z-10 pt-2 border-t border-panel-border">
          <div>
            Need instant activation or help? Call or WhatsApp SaaS Support at{" "}
            <a
              href="tel:+918535035757"
              className="font-bold text-rose-600 dark:text-rose-400 hover:underline"
            >
              +91 8535035757
            </a>{" "}
            (Founder Desk).
          </div>
          <div className="flex items-center justify-center gap-4 pt-1">
            <Link
              href="/"
              className="hover:text-text-main underline font-semibold transition"
            >
              ← Back to SaaS Home
            </Link>
            <span>•</span>
            <Link
              href="/l/demo-library"
              className="hover:text-text-main underline font-semibold transition"
            >
              Explore Demo Lounge →
            </Link>
            <span>•</span>
            <button
              onClick={() => setShowOverride(!showOverride)}
              className="text-text-muted hover:text-text-main opacity-50 hover:opacity-100 transition cursor-pointer"
            >
              Founder Key 🔑
            </button>
          </div>
        </div>

        {/* Optional Founder Emergency Key Drawer */}
        {showOverride && (
          <form
            onSubmit={handleEmergencyOverride}
            className="p-4 rounded-2xl bg-neutral-900 text-white space-y-3 relative z-10 text-xs animate-in fade-in"
          >
            <div className="font-bold flex items-center justify-between">
              <span>Super Admin / Developer Bypass Key</span>
              <button
                type="button"
                onClick={() => setShowOverride(false)}
                className="text-neutral-400 hover:text-white cursor-pointer"
              >
                ✕
              </button>
            </div>
            <div className="flex gap-2">
              <input
                type="password"
                placeholder="Enter master key..."
                value={overridePass}
                onChange={(e) => setOverridePass(e.target.value)}
                className="flex-1 px-3 py-2 rounded-xl bg-neutral-800 border border-neutral-700 text-white text-xs outline-none focus:border-rose-500 font-mono"
              />
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 font-bold text-white transition cursor-pointer"
              >
                Unlock
              </button>
            </div>
            {overrideError && (
              <div className="text-rose-400 font-semibold">{overrideError}</div>
            )}
          </form>
        )}
      </div>
    </div>
  );
}
