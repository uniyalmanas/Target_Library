"use client";

import { useState } from "react";
import Link from "next/link";
import { Library } from "./types";
import { LibraryAccessInfo } from "./tenant";
import LibraryLogo from "./LibraryLogo";

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

  const isTrialExpired = access.status === "trial_expired" || access.isTrial;
  const monthlyRate = library.monthly_fee || 600;

  const handleRefresh = async () => {
    setChecking(true);
    setCheckMessage(null);
    try {
      if (onRefresh) {
        await onRefresh();
      } else {
        window.location.reload();
      }
      setCheckMessage("Status checked. If payment was verified, your workspace will unlock automatically.");
    } catch {
      setCheckMessage("Unable to verify payment status. Please contact Super Admin.");
    } finally {
      setChecking(false);
    }
  };

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
      // Store session and global master override
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

  const waMessage = encodeURIComponent(
    `Hi LibraryOS Admin, I am the owner of ${library.name} (/l/${library.slug}). My 7-day trial has ended and I want to activate my monthly subscription (₹${monthlyRate}/month). Please find my payment details attached.`
  );

  return (
    <div className="min-h-[85vh] flex items-center justify-center p-4 sm:p-6 w-full">
      <div className="w-full max-w-2xl bg-card-bg border-2 border-rose-500/30 rounded-3xl p-6 sm:p-10 shadow-2xl space-y-6 relative overflow-hidden animate-in fade-in zoom-in-95">
        {/* Glow accent */}
        <div className="absolute top-0 right-0 w-72 h-72 bg-rose-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20"></div>
        <div className="absolute bottom-0 left-0 w-72 h-72 bg-amber-500/10 rounded-full blur-3xl pointer-events-none -ml-20 -mb-20"></div>

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
              Rest assured: <strong>no student data, receipts, seats, or payment records have been deleted</strong>. All your library information remains securely encrypted in the cloud database and will instantly restore upon plan activation.
            </p>
          </div>
        </div>

        {/* Main Barrier Explanation */}
        <div className="space-y-3 relative z-10 text-center py-2">
          <div className="w-16 h-16 rounded-3xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 flex items-center justify-center text-3xl mx-auto shadow-sm">
            🔒
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-text-main tracking-tight">
            {isTrialExpired
              ? "Your 7-Day Free Trial Has Concluded"
              : "Subscription Renewal Required"}
          </h2>
          <p className="text-xs sm:text-sm text-text-muted max-w-lg mx-auto leading-relaxed">
            {isTrialExpired
              ? `Thank you for testing LibraryOS! Your 7-day evaluation period for ${library.name} has ended. To continue managing your student desk, QR attendance, and fees, please activate your monthly subscription.`
              : `Your monthly subscription for ${library.name} has expired. Please renew your plan to restore full front-desk operations.`}
          </p>
        </div>

        {/* Subscription Plan Card */}
        <div className="p-5 rounded-2xl bg-neutral-500/5 border border-panel-border space-y-4 relative z-10">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[11px] font-bold text-text-muted uppercase tracking-wider">
                Monthly Subscription Fee
              </div>
              <div className="text-2xl sm:text-3xl font-black text-text-main mt-0.5">
                ₹{monthlyRate}
                <span className="text-xs font-semibold text-text-muted"> / month</span>
              </div>
            </div>
            <div className="text-right">
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 uppercase">
                All Features Included
              </span>
              <div className="text-[11px] text-text-muted mt-1">Unlimited seats & shifts</div>
            </div>
          </div>

          <div className="pt-3 border-t border-panel-border grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Quick WhatsApp Founder Button */}
            <a
              href={`https://wa.me/918535035757?text=${waMessage}`}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs shadow-md shadow-emerald-600/20 transition active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>💬</span> Pay via UPI & WhatsApp Super Admin
            </a>

            {/* Check Payment / Refresh Button */}
            <button
              onClick={handleRefresh}
              disabled={checking}
              className="w-full py-3 px-4 rounded-xl bg-card-bg border border-panel-border hover:bg-neutral-100 dark:hover:bg-neutral-800 text-text-main font-bold text-xs shadow-sm transition active:scale-95 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <span>{checking ? "⏳" : "🔄"}</span>
              {checking ? "Verifying Subscription..." : "I've Paid — Refresh Status"}
            </button>
          </div>

          {checkMessage && (
            <div className="text-center text-xs font-semibold text-text-muted pt-1">
              {checkMessage}
            </div>
          )}
        </div>

        {/* Founder & Payment Support Info */}
        <div className="text-center text-xs text-text-muted space-y-2 relative z-10 pt-2">
          <div>
            Need instant activation? Call or WhatsApp SaaS Support at{" "}
            <a
              href="tel:+918535035757"
              className="font-bold text-rose-600 dark:text-rose-400 hover:underline"
            >
              +91 8535035757
            </a>{" "}
            (Founder Desk).
          </div>
          <div className="flex items-center justify-center gap-4 pt-2">
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
