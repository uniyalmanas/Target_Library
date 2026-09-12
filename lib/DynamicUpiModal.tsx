"use client";

import { useState, useEffect } from "react";
import { generateUpiIntentUrl, generateUpiQrCodeUrl, generateDueFeeWhatsAppMessage } from "./upi";

interface DynamicUpiModalProps {
  isOpen: boolean;
  onClose: () => void;
  candidate: {
    receipt_no: number;
    student_id: number;
    student_name: string;
    student_phone: string | null;
    seat_number: number;
    shift_type: string | null;
    subscription_type: "full_day" | "half_day";
    amount_paid: number;
    end_date: string;
    days_overdue: number;
  };
  library: {
    name: string;
    slug: string;
    upi_id: string;
    upi_name?: string;
  };
  shiftLabel: string;
}

export default function DynamicUpiModal({
  isOpen,
  onClose,
  candidate,
  library,
  shiftLabel,
}: DynamicUpiModalProps) {
  const [copied, setCopied] = useState(false);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  if (!isOpen) return null;

  const upiId = library.upi_id || "targetlibrary@upi";
  const payeeName = library.upi_name || library.name;
  const amount = candidate.amount_paid;
  const cleanPhone = candidate.student_phone
    ? candidate.student_phone.replace(/[^0-9]/g, "").slice(-10)
    : "";

  // 1. Generate deep link intent URL for UPI mobile apps
  const upiIntentUrl = generateUpiIntentUrl({
    upiId,
    payeeName,
    amount,
    note: `Fee Seat #${candidate.seat_number} - ${library.name}`,
    transactionRef: `REC_${candidate.receipt_no}`,
  });

  // 2. Generate scannable QR Code image URL
  const upiQrCodeUrl = generateUpiQrCodeUrl(
    {
      upiId,
      payeeName,
      amount,
      note: `Fee Seat #${candidate.seat_number} - ${library.name}`,
    },
    260
  );

  // 3. Generate pre-composed WhatsApp message with direct payment details
  const whatsappMessage = generateDueFeeWhatsAppMessage({
    studentName: candidate.student_name,
    studentPhone: cleanPhone,
    seatNumber: candidate.seat_number,
    shiftName: shiftLabel,
    daysOverdue: candidate.days_overdue,
    expiryDate: candidate.end_date,
    amountDue: amount,
    libraryName: library.name,
    upiId: upiId,
    upiName: payeeName,
    digitalPassUrl: typeof window !== "undefined" ? `${window.location.origin}/receipts/${candidate.receipt_no}` : undefined,
  });

  const whatsappUrl = cleanPhone
    ? `https://wa.me/91${cleanPhone}?text=${encodeURIComponent(whatsappMessage)}`
    : "";

  const handleCopy = () => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(upiIntentUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-black/75 backdrop-blur-xs p-3 sm:p-4 md:p-6 flex items-start sm:items-center justify-center animate-in fade-in"
      onClick={onClose}
    >
      <div
        className="my-auto bg-card-bg border border-panel-border rounded-3xl max-w-md w-full shadow-2xl relative overflow-hidden animate-in zoom-in-95 flex flex-col max-h-[calc(100vh-2rem)] sm:max-h-[88vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header: shrink-0 pinned at top */}
        <div className="p-4 sm:p-5 border-b border-panel-border bg-card-bg shrink-0 flex items-center justify-between gap-3">
          <div className="space-y-0.5 text-left min-w-0">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-black bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/30">
              <span>⚡</span> Dynamic UPI Intent & QR
            </div>
            <h2 className="text-lg font-black text-text-main tracking-tight pt-1 truncate">
              Seat #{candidate.seat_number} &bull; {candidate.student_name}
            </h2>
            <p className="text-[11px] text-text-muted truncate">
              {shiftLabel} &bull; {candidate.days_overdue} days overdue
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-neutral-500/10 hover:bg-neutral-500/20 text-text-muted hover:text-text-main flex items-center justify-center text-sm font-bold cursor-pointer transition shrink-0"
            title="Close popup (Esc)"
          >
            ✕
          </button>
        </div>

        {/* Scrollable Modal Body */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-4 text-center overscroll-contain">
          {/* Dynamic Pre-filled QR Code Card */}
          <div className="p-4 rounded-2xl bg-white border border-neutral-200 inline-block shadow-inner mx-auto">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={upiQrCodeUrl}
              alt="Dynamic UPI QR Code"
              width={200}
              height={200}
              className="rounded-lg mx-auto"
            />
            <div className="text-[11px] font-mono font-bold text-neutral-800 mt-2">
              Scan to pay pre-filled <span className="text-emerald-600 font-black">₹{amount}</span>
            </div>
            <div className="text-[9px] text-neutral-500 font-mono">
              {upiId}
            </div>
          </div>

          {/* Amount & UPI Details */}
          <div className="p-3.5 rounded-2xl bg-neutral-500/5 border border-panel-border text-left space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-text-muted font-medium">Payee Name:</span>
              <span className="font-bold text-text-main">{payeeName}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-text-muted font-medium">UPI ID:</span>
              <code className="font-mono font-bold text-rose-600 dark:text-rose-400">{upiId}</code>
            </div>
            <div className="flex items-center justify-between pt-1 border-t border-panel-border">
              <span className="text-text-muted font-bold">Exact Amount Pre-filled:</span>
              <span className="font-black text-base text-emerald-600 dark:text-emerald-400">₹{amount}</span>
            </div>
          </div>

          {/* Actions Grid */}
          <div className="space-y-2.5 pt-1">
            {/* 1-Click WhatsApp with Dynamic Intent */}
            {cleanPhone ? (
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs shadow-md shadow-emerald-600/20 transition active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>💬</span> Send WhatsApp with 1-Click UPI Link
              </a>
            ) : (
              <div className="text-xs text-text-muted italic py-1">
                No phone number registered for this candidate.
              </div>
            )}

            {/* Direct Mobile UPI Intent Button */}
            <div className="grid grid-cols-2 gap-2">
              <a
                href={upiIntentUrl}
                className="py-2.5 px-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-sm transition active:scale-95 flex items-center justify-center gap-1 cursor-pointer"
                title="Opens PhonePe / GPay / Paytm directly on mobile"
              >
                <span>⚡</span> Open UPI App
              </a>

              <button
                onClick={handleCopy}
                className="py-2.5 px-3 rounded-xl bg-card-bg border border-panel-border hover:bg-neutral-100 dark:hover:bg-neutral-800 text-text-main font-bold text-xs shadow-sm transition active:scale-95 flex items-center justify-center gap-1 cursor-pointer"
              >
                <span>{copied ? "✓" : "📋"}</span>
                {copied ? "Link Copied!" : "Copy UPI Link"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
