"use client";

import { useState } from "react";
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

  if (!isOpen) return null;

  const upiId = library.upi_id || "targetlibrary@upi";
  const payeeName = library.upi_name || library.name || "Library Desk";
  const amount = candidate.amount_paid || 900;
  const note = `Fee Seat #${candidate.seat_number} - ${library.name}`;

  const upiIntentUrl = generateUpiIntentUrl({
    upiId,
    payeeName,
    amount,
    note,
    transactionRef: `REC_${candidate.receipt_no}`,
  });

  const upiQrCodeUrl = generateUpiQrCodeUrl(
    {
      upiId,
      payeeName,
      amount,
      note,
    },
    280
  );

  const cleanPhone = (candidate.student_phone || "").replace(/[^0-9]/g, "").slice(-10);
  const passUrl = typeof window !== "undefined"
    ? `${window.location.origin}/receipts/${candidate.receipt_no}`
    : undefined;

  const whatsappMessage = generateDueFeeWhatsAppMessage({
    studentName: candidate.student_name,
    studentPhone: cleanPhone,
    seatNumber: candidate.seat_number,
    shiftName: shiftLabel,
    daysOverdue: candidate.days_overdue,
    expiryDate: candidate.end_date,
    amountDue: amount,
    libraryName: library.name,
    upiId,
    upiName: payeeName,
    digitalPassUrl: passUrl,
  });

  const whatsappUrl = cleanPhone
    ? `https://wa.me/91${cleanPhone}?text=${encodeURIComponent(whatsappMessage)}`
    : "#";

  const handleCopy = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(upiIntentUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-in fade-in">
      <div className="bg-card-bg border border-panel-border rounded-3xl p-6 sm:p-7 max-w-md w-full shadow-2xl space-y-5 text-center relative overflow-hidden animate-in zoom-in-95">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-xl text-text-muted hover:text-text-main hover:bg-neutral-500/10 transition cursor-pointer"
        >
          ✕
        </button>

        {/* Top Header */}
        <div className="space-y-1">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/30">
            <span>⚡</span> Dynamic UPI Intent & QR
          </div>
          <h2 className="text-xl font-black text-text-main tracking-tight pt-1">
            Seat #{candidate.seat_number} • {candidate.student_name}
          </h2>
          <p className="text-xs text-text-muted">
            {shiftLabel} • {candidate.days_overdue} days overdue
          </p>
        </div>

        {/* Dynamic Pre-filled QR Code Card */}
        <div className="p-4 rounded-2xl bg-white border border-neutral-200 inline-block shadow-inner mx-auto">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={upiQrCodeUrl}
            alt="Dynamic UPI QR Code"
            width={220}
            height={220}
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
  );
}
