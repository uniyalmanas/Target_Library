"use client";

import { useEffect, useState, Suspense } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

function ReceiptDetails() {
  const params = useParams();
  const id = params.id as string;
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    async function fetchReceipt() {
      const { data: receipt, error } = await supabase
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

      if (error) {
        console.error("Error fetching receipt:", error);
      } else {
        setData(receipt);
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

  const shiftLabel =
    data.subscription_type === "full_day"
      ? "Full day (6am–12am)"
      : `Half day (${
          data.shift_type === "shift_1" || data.shift_type === "morning"
            ? "Shift 1 (6am–2pm)"
            : data.shift_type === "shift_2" || data.shift_type === "evening"
              ? "Shift 2 (2pm–12am)"
              : "Shift 3 (4pm–12am)"
        })`;

  const handlePrint = () => {
    window.print();
  };

  const shareUrl = typeof window !== "undefined" ? window.location.href : "";
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(shareUrl)}`;

  const phone = data.members?.phone;
  const manualWhatsappUrl = phone
    ? `https://wa.me/${phone.replace(/\D/g, "").length === 10 ? "91" + phone.replace(/\D/g, "") : phone.replace(/\D/g, "")}?text=${encodeURIComponent(`The Target Library\nReceipt No: ${data.receipt_no}\nName: ${data.members?.name}\nSeat No: ${data.seats?.seat_number}\nType: ${shiftLabel}\nAmount Paid: Rs ${data.amount_paid}\nValid till: ${data.end_date}\nDigital Pass & Invoice: ${shareUrl}`)}`
    : null;

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      {/* Action Header */}
      <div className="flex justify-between items-center no-print">
        <Link href="/" className="text-xs font-semibold text-rose-600 dark:text-rose-500 hover:underline flex items-center gap-1.5">
          &larr; Back to Layout
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
            onClick={handlePrint}
            className="bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs px-4.5 py-2.5 rounded-lg shadow-md shadow-rose-600/10 cursor-pointer flex items-center gap-2 hover:-translate-y-0.5 transition-all"
          >
            <span>🖨️</span> Print Pass &amp; Invoice
          </button>
        </div>
      </div>

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
                <img 
                  src="/lib-logo.jpeg" 
                  alt="Logo" 
                  className="w-6 h-6 rounded-md object-cover border border-neutral-800" 
                />
                <div>
                  <p className="text-[7px] tracking-widest text-rose-500 font-extrabold uppercase">THE TARGET LIBRARY</p>
                  <h3 className="text-[10px] font-extrabold text-neutral-200 mt-0.5">STUDENT PASS</h3>
                </div>
              </div>
              <span className="text-[9px] px-2 py-0.5 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-400 font-semibold uppercase tracking-wider">
                Seat {data.seats?.seat_number}
              </span>
            </div>

            <div className="my-auto pt-2">
              <p className="text-[8px] text-neutral-500 uppercase font-semibold">Card Holder</p>
              <p className="text-base font-extrabold text-white tracking-tight leading-tight">{data.members?.name}</p>
              <p className="text-[9px] text-neutral-400 font-mono mt-0.5">ID: #{data.student_id}</p>
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
                <p className="text-xs font-bold text-rose-600 dark:text-rose-500">THE TARGET LIBRARY</p>
                <p className="text-[9px] text-text-muted font-medium">Dehradun, Uttarakhand</p>
                <span className="mt-1.5 inline-block px-2.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-bold uppercase text-[8px] tracking-wider">
                  Paid
                </span>
              </div>
              <img 
                src="/lib-logo.jpeg" 
                alt="Logo" 
                className="w-7 h-7 rounded-md object-cover border border-panel-border" 
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 text-xs">
            <div>
              <p className="font-semibold text-text-muted mb-1.5">Billed To:</p>
              <p className="font-bold text-foreground">{data.members?.name}</p>
              <p className="text-text-details mt-0.5 font-mono">Student ID: #{data.student_id}</p>
              {data.members?.phone && <p className="text-text-details font-mono">{data.members.phone}</p>}
            </div>
            <div className="text-right">
              <p className="font-semibold text-text-muted mb-1.5">Reservation details:</p>
              <p className="font-bold text-foreground">Seat Number: {data.seats?.seat_number}</p>
              <p className="text-text-details mt-0.5">{shiftLabel}</p>
              <p className="text-text-details">Sheets Desk: {data.has_sheet ? "Included" : "None"}</p>
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
                    Study Space Rental &mdash; Seat {data.seats?.seat_number}
                    <p className="text-[10px] text-text-muted mt-0.5">{shiftLabel}</p>
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
