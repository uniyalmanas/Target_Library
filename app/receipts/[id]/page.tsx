"use client";
import { getTodayIST } from "@/lib/dates";

import { useEffect, useState, Suspense } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import EditReceiptModal from "@/lib/EditReceiptModal";
import LibraryLogo from "@/lib/LibraryLogo";
import { generateUpiIntentUrl, generateUpiQrCodeUrl } from "@/lib/upi";
import { ShiftConfig } from "@/lib/types";
import { DEFAULT_SHIFTS } from "@/lib/tenant";
import { getShiftDisplayLabel, sortShiftsChronologically } from "@/lib/shifts";

function ReceiptDetails() {
  const params = useParams();
  const id = params.id as string;
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [library, setLibrary] = useState<{
    name: string;
    city: string;
    slug: string;
    logo_url?: string | null;
    upi_id?: string | null;
    upi_name?: string | null;
  } | null>(null);
  const [shiftsConfig, setShiftsConfig] = useState<ShiftConfig[]>(DEFAULT_SHIFTS);
  const [copiedUpi, setCopiedUpi] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    async function fetchReceipt() {
      let { data: receipt, error } = await supabase
        .from("receipts")
        .select(`
          receipt_no,
          subscription_type,
          shift_type,
          has_sheet,
          amount_paid,
          payment_mode,
          start_date,
          end_date,
          created_at,
          student_id,
          library_id,
          members (student_id, name, phone, aadhar_no),
          seats (seat_number)
        `)
        .eq("receipt_no", id)
        .single();

      // Safe fallback if aadhar_no, payment_mode, or library_id column does not exist on DB yet
      if (error && (error.code === "42703" || error.message?.includes("aadhar_no") || error.message?.includes("payment_mode") || error.message?.includes("library_id"))) {
        const retry = await supabase
          .from("receipts")
          .select(`
            receipt_no,
            subscription_type,
            shift_type,
            has_sheet,
            amount_paid,
            start_date,
            end_date,
            created_at,
            student_id,
            members (student_id, name, phone),
            seats (seat_number)
          `)
          .eq("receipt_no", id)
          .single();
        receipt = retry.data as any;
        error = retry.error;
      }

      if (error) {
        console.error("Error fetching receipt:", error);
      } else {
        setData(receipt);
        if (receipt?.library_id) {
          const { data: libData } = await supabase
            .from("libraries")
            .select("name, city, slug, logo_url, upi_id, upi_name")
            .eq("id", receipt.library_id)
            .maybeSingle();
          if (libData) {
            setLibrary(libData);
          }

          const { data: settsData } = await supabase
            .from("library_settings")
            .select("shifts_config")
            .eq("library_id", receipt.library_id)
            .maybeSingle();
          if (settsData?.shifts_config && Array.isArray(settsData.shifts_config)) {
            setShiftsConfig(sortShiftsChronologically(settsData.shifts_config));
          }
        }
      }
      setLoading(false);
    }
    fetchReceipt();
  }, [id]);

  if (loading) {
    return <p className="text-center text-text-muted py-10 animate-pulse">Loading digital receipt...</p>;
  }

  if (!data) {
    return (
      <div className="max-w-md mx-auto text-center py-12 space-y-4">
        <p className="text-rose-500 font-semibold">Receipt #{id} not found in database.</p>
        <Link href="/" className="inline-block text-xs bg-panel-bg hover:bg-neutral-200 dark:hover:bg-neutral-800 px-4 py-2 border border-panel-border rounded-lg text-text-details font-bold">
          &larr; Back to Seat Map
        </Link>
      </div>
    );
  }

  const libName = library?.name?.toUpperCase() || (library?.slug ? library.slug.replace(/-/g, " ").toUpperCase() : "LIBRARY DESK");
  const libCity = library?.city ? library.city : "";
  const libSlug = library?.slug || null;
  const backHref = libSlug ? `/l/${libSlug}` : "/";

  const shiftLabel = getShiftDisplayLabel(
    data.shift_type,
    data.subscription_type,
    shiftsConfig
  );

  const handlePrint = () => {
    window.print();
  };

  const shareUrl = typeof window !== "undefined" ? window.location.href : "";
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(shareUrl)}`;

  const isFloating = data?.shift_type === "floating" || data?.seats?.seat_number === 9999;
  const seatDisplay = isFloating
    ? "Floating / Flexible (Daily Seating on Vacant Desks)"
    : `Seat #${data?.seats?.seat_number || data?.seat_id}`;
  const effectiveShiftLabel = isFloating
    ? "Floating Pass (Daily Vacancy Access)"
    : shiftLabel;

  const phone = data?.members?.phone;
  const manualWhatsappUrl = phone
    ? `https://wa.me/${phone.replace(/\D/g, "").length === 10 ? "91" + phone.replace(/\D/g, "") : phone.replace(/\D/g, "")}?text=${encodeURIComponent(`${libName}\nReceipt No: ${data?.receipt_no}\nName: ${data?.members?.name}\nSeat: ${seatDisplay}\nType: ${effectiveShiftLabel}\nAmount Paid: Rs ${data?.amount_paid}\nValid till: ${data?.end_date}\nDigital Pass & Invoice: ${shareUrl}`)}`
    : null;

  const today = getTodayIST();
  const isOverdue = data.end_date ? data.end_date < today : false;
  const daysOverdue = isOverdue
    ? Math.max(1, Math.ceil((new Date(`${today}T00:00:00`).getTime() - new Date(`${data.end_date}T00:00:00`).getTime()) / (1000 * 60 * 60 * 24)))
    : 0;

  const upiId = library?.upi_id || "targetlibrary@upi";
  const upiName = library?.upi_name || libName;
  const upiIntentUrl = generateUpiIntentUrl({
    upiId,
    payeeName: upiName,
    amount: data.amount_paid || 900,
    note: `Renewal Seat #${data.seats?.seat_number || data.seat_id} - ${libName}`,
    transactionRef: `RNW_${data.receipt_no}`,
  });
  const upiQrCodeUrl = generateUpiQrCodeUrl(
    {
      upiId,
      payeeName: upiName,
      amount: data.amount_paid || 900,
      note: `Renewal Seat #${data.seats?.seat_number || data.seat_id} - ${libName}`,
      transactionRef: `RNW_${data.receipt_no}`,
    },
    220
  );

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      {/* Action Header */}
      <div className="flex justify-between items-center no-print">
        <Link href={backHref} className="text-xs font-semibold text-rose-600 dark:text-rose-500 hover:underline flex items-center gap-1.5">
          &larr; {libSlug ? "Back to Desk Portal" : "Back to Layout"}
        </Link>
        <div className="flex gap-2">
          {manualWhatsappUrl && (
            <a
              href={manualWhatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs px-4.5 py-2.5 rounded-lg shadow-md shadow-emerald-600/10 cursor-pointer flex items-center gap-2 hover:-translate-y-0.5 transition-all"
            >
              <span>💬</span> Send via WhatsApp
            </a>
          )}
          <button
            onClick={() => setIsEditing(true)}
            className="bg-panel-bg hover:bg-neutral-200 dark:hover:bg-neutral-800 text-text-details border border-panel-border font-semibold text-xs px-4 py-2.5 rounded-lg shadow-sm cursor-pointer flex items-center gap-1.5 transition-all hover:-translate-y-0.5"
            title="Owner: Edit plan, fees, or cancel subscription"
          >
            <span>✏️</span> Edit (Owner)
          </button>
          <button
            onClick={handlePrint}
            className="bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs px-4.5 py-2.5 rounded-lg shadow-md shadow-rose-600/10 cursor-pointer flex items-center gap-2 hover:-translate-y-0.5 transition-all"
          >
            <span>🖨️</span> Print Pass &amp; Invoice
          </button>
        </div>
      </div>

      {/* Overdue Renewal Alert Banner with Dynamic UPI Intent & QR */}
      {isOverdue && (
        <div className="bg-panel-bg border border-panel-border rounded-3xl p-5 sm:p-6 shadow-xl no-print animate-in fade-in space-y-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            {/* Left: Renewal Details & 1-Click Pay */}
            <div className="space-y-3 text-left w-full md:flex-1">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold uppercase tracking-wider bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30">
                <span>⚠️</span> Subscription Renewal Due ({daysOverdue} day{daysOverdue === 1 ? "" : "s"} overdue)
              </div>
              <div>
                <h3 className="text-xl font-black text-foreground tracking-tight">
                  Seat #{data.seats?.seat_number} &bull; {data.members?.name}
                </h3>
                <p className="text-sm text-text-muted mt-0.5">
                  Validity ended on <span className="font-semibold text-foreground">{data.end_date}</span> ({effectiveShiftLabel})
                </p>
              </div>

              <div className="p-3.5 rounded-2xl bg-neutral-500/5 border border-panel-border space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-text-muted font-medium">Renewal Amount Due:</span>
                  <span className="font-black text-lg text-emerald-600 dark:text-emerald-400">₹{data.amount_paid}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-text-muted font-medium">UPI ID:</span>
                  <div className="flex items-center gap-2">
                    <code className="font-mono font-bold text-text-main bg-panel-bg px-2 py-0.5 rounded border border-panel-border">{upiId}</code>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(upiId);
                        setCopiedUpi(true);
                        setTimeout(() => setCopiedUpi(false), 2000);
                      }}
                      className="text-[11px] font-bold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                    >
                      {copiedUpi ? "✓ Copied" : "Copy"}
                    </button>
                  </div>
                </div>
              </div>

              <div className="pt-1 flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                <a
                  href={upiIntentUrl}
                  className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-sm shadow-md shadow-emerald-600/20 transition active:scale-95 cursor-pointer"
                >
                  <span>⚡</span> Pay ₹{data.amount_paid} via UPI App (PhonePe / GPay / Paytm)
                </a>
              </div>
            </div>

            {/* Right: Dynamic Scannable QR Code */}
            <div className="flex flex-col items-center justify-center p-4 bg-white rounded-2xl border border-neutral-200 shadow-md shrink-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={upiQrCodeUrl}
                alt="Scan to Pay via UPI"
                width={190}
                height={190}
                className="rounded-lg"
              />
              <div className="text-[11px] font-mono font-black text-neutral-900 mt-2 text-center">
                Scan with any UPI App (<span className="text-emerald-600 font-extrabold">₹{data.amount_paid}</span>)
              </div>
              <div className="text-[10px] text-neutral-500 font-medium text-center">
                PhonePe &bull; GPay &bull; Paytm &bull; BHIM
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-5 gap-6 items-start">
        {/* Left Side: Membership Pass */}
        <div className="md:col-span-2 space-y-4 print-block">
          <h2 className="text-xs font-bold uppercase tracking-wider text-text-muted no-print">Membership Card</h2>
          
          <div className="w-full aspect-[1.586/1] bg-gradient-to-tr from-neutral-900 to-neutral-950 border border-neutral-800 rounded-2xl p-5 relative overflow-hidden shadow-xl text-neutral-100 flex flex-col justify-between font-sans">
            {/* Hologram Design Element */}
            <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-rose-500/10 to-transparent pointer-events-none" />
            <div className="absolute -bottom-10 -left-10 w-28 h-28 rounded-full bg-rose-600/5 blur-xl pointer-events-none" />

            <div className="flex justify-between items-start">
              <div className="flex items-center gap-2">
                <LibraryLogo 
                  slug={libSlug}
                  logoUrl={library?.logo_url}
                  name={libName}
                  size="sm"
                  className="w-6 h-6 object-contain" 
                />
                <div>
                  <p className="text-[7px] tracking-widest text-rose-500 font-extrabold uppercase">{libName}</p>
                  <h3 className="text-[10px] font-extrabold text-neutral-200 mt-0.5">STUDENT PASS</h3>
                </div>
              </div>
              <span className={`text-[9px] px-2 py-0.5 rounded-full border font-semibold uppercase tracking-wider ${
                isFloating
                  ? "bg-indigo-500/15 border-indigo-500/30 text-indigo-400"
                  : "bg-rose-500/10 border border-rose-500/20 text-rose-400"
              }`}>
                {isFloating ? "🌐 Floating Pass" : `Seat ${data.seats?.seat_number}`}
              </span>
            </div>

            <div className="my-auto pt-2">
              <p className="text-[8px] text-neutral-500 uppercase font-semibold">Card Holder</p>
              <p className="text-base font-extrabold text-white tracking-tight leading-tight">{data.members?.name}</p>
              <div className="flex items-center gap-2.5 flex-wrap text-[9px] text-neutral-400 font-mono mt-0.5">
                <span>ID: #{data.student_id}</span>
                <span className={`px-1.5 py-0.5 rounded font-semibold ${
                  data.payment_mode === "online" ? "text-blue-300 bg-blue-500/20" : "text-emerald-300 bg-emerald-500/20"
                }`}>
                  {data.payment_mode === "online" ? "📱 Online" : "💵 Cash"}
                </span>
                {data.members?.aadhar_no && (
                  <span className="text-neutral-300">Aadhaar: •••• •••• {data.members.aadhar_no.replace(/\s+/g, "").slice(-4)}</span>
                )}
              </div>
            </div>

            <div className="flex justify-between items-end border-t border-neutral-900/60 pt-2">
              <div>
                <p className="text-[7px] text-neutral-500 uppercase font-semibold">Valid Period</p>
                <p className="text-[9px] text-neutral-300 font-medium font-mono">{data.start_date} to {data.end_date}</p>
              </div>
              <img
                src={qrUrl}
                alt="Verification QR"
                className="w-10 h-10 bg-white p-0.5 rounded shadow-sm"
              />
            </div>
          </div>
          <p className="text-[10px] text-text-muted text-center italic no-print">Printed pass fits standard ID wallet slots.</p>
        </div>

        {/* Right Side: Professional Invoice */}
        <div className="md:col-span-3 bg-card-bg border border-card-border rounded-2xl p-6 shadow-xl space-y-6 print-full">
          <div className="flex justify-between items-start border-b border-panel-border pb-4">
            <div>
              <h1 className="text-lg font-bold text-foreground">INVOICE / RECEIPT</h1>
              <p className="text-xs text-text-muted mt-1 font-mono">Receipt No: #{data.receipt_no}</p>
              <p className="text-[10px] text-text-muted font-mono">Date: {new Date(data.created_at).toLocaleDateString()}</p>
            </div>
            <div className="flex items-start gap-2 text-right justify-end">
              <div>
                <p className="text-xs font-bold text-rose-600 dark:text-rose-500">{libName}</p>
                <p className="text-[9px] text-text-muted font-medium">{libCity}</p>
                <span className="mt-1.5 inline-block px-2.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-bold uppercase text-[8px] tracking-wider">
                  Paid &middot; {data.payment_mode === "online" ? "Online (UPI)" : "Cash"}
                </span>
              </div>
              <LibraryLogo 
                slug={libSlug}
                logoUrl={library?.logo_url}
                name={libName}
                size="md"
                className="w-7 h-7 object-contain" 
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 text-xs">
            <div>
              <p className="font-semibold text-text-muted mb-1.5">Billed To:</p>
              <p className="font-bold text-foreground">{data.members?.name}</p>
              <p className="text-text-details mt-0.5 font-mono">Student ID: #{data.student_id}</p>
              {data.members?.phone && <p className="text-text-details font-mono">{data.members.phone}</p>}
              {data.members?.aadhar_no && (
                <p className="text-text-details font-mono">Aadhaar: {data.members.aadhar_no}</p>
              )}
            </div>
            <div className="text-right">
              <p className="font-semibold text-text-muted mb-1.5">Reservation details:</p>
              <p className="font-bold text-foreground">Seat Number: {data.seats?.seat_number}</p>
              <p className="text-text-details mt-0.5">{shiftLabel}</p>
              <p className="text-text-details">Sheets Desk: {data.has_sheet ? "Included" : "None"}</p>
              <p className="text-text-details font-semibold text-emerald-600 dark:text-emerald-400 mt-0.5">
                Payment: {data.payment_mode === "online" ? "📱 Online (UPI)" : "💵 Cash Mode"}
              </p>
            </div>
          </div>

          <div className="border border-panel-border rounded-xl overflow-hidden">
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr className="bg-panel-bg text-text-muted border-b border-panel-border">
                  <th className="p-3">Description</th>
                  <th className="p-3 text-right">Validity</th>
                  <th className="p-3 text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-panel-border text-foreground">
                  <td className="p-3 font-medium">
                    {isFloating ? (
                      <>
                        Library Space Access &mdash; Floating / Flexible
                        <p className="text-[10px] text-indigo-600 dark:text-indigo-400 mt-0.5 font-medium">
                          Daily seat allotted upon arrival based on vacancy / absent students
                        </p>
                      </>
                    ) : (
                      <>
                        Study Space Rental &mdash; Seat {data.seats?.seat_number}
                        <p className="text-[10px] text-text-muted mt-0.5">{shiftLabel}</p>
                      </>
                    )}
                  </td>
                  <td className="p-3 text-right font-mono text-text-details">{data.start_date} to {data.end_date}</td>
                  <td className="p-3 text-right font-mono font-semibold">₹{data.amount_paid}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="flex justify-between items-center pt-2">
            <p className="text-[10px] text-text-muted">Thanks for studying with us!</p>
            <div className="text-right">
              <span className="text-xs text-text-muted mr-3">Grand Total Paid:</span>
              <span className="text-xl font-extrabold text-foreground font-mono">₹{data.amount_paid}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Owner Edit Receipt Modal */}
      {isEditing && (
        <EditReceiptModal
          receipt={{
            receipt_no: data.receipt_no,
            student_id: data.student_id,
            student_name: data.members?.name,
            student_phone: data.members?.phone,
            aadhar_no: data.members?.aadhar_no,
            seat_id: data.seat_id,
            seat_number: data.seats?.seat_number || data.seat_id,
            subscription_type: data.subscription_type,
            shift_type: data.shift_type,
            has_sheet: data.has_sheet,
            amount_paid: data.amount_paid,
            payment_mode: data.payment_mode || "cash",
            start_date: data.start_date,
            end_date: data.end_date,
          }}
          isOpen={isEditing}
          onClose={() => setIsEditing(false)}
          onSuccess={() => {
            window.location.reload();
          }}
        />
      )}

      {/* Print Styles CSS */}
      <style jsx global>{`
        @media print {
          body {
            background: white !important;
            color: black !important;
          }
          nav, footer, .no-print, header {
            display: none !important;
          }
          main {
            padding: 0 !important;
            max-width: 100% !important;
          }
          .print-block {
            page-break-inside: avoid;
            margin-bottom: 2rem;
            width: 100% !important;
            display: flex;
            justify-content: center;
          }
          .print-full {
            border: 1px solid #ddd !important;
            box-shadow: none !important;
            background: white !important;
            width: 100% !important;
          }
        }
      `}</style>
    </div>
  );
}

export default function ReceiptPage() {
  return (
    <Suspense fallback={<p>Loading...</p>}>
      <ReceiptDetails />
    </Suspense>
  );
}
