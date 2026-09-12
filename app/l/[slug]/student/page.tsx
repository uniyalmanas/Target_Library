"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { Suspense } from "react";

interface StudentPassData {
  success: boolean;
  library: {
    id: string;
    name: string;
    slug: string;
    city: string;
    phone: string;
    address: string;
  };
  member: {
    student_id: number;
    name: string;
    phone: string | null;
    email?: string;
    aadhar_no?: string | null;
    has_sheet?: boolean;
    created_at: string;
  } | null;
  activeSeat: {
    seat_number: number;
    seat_id?: number;
    type?: string;
  } | null;
  latestReceipt: {
    receipt_no: number;
    amount_paid: number;
    amount?: number;
    start_date: string;
    end_date: string;
    payment_mode: string;
    utr_number?: string;
    shift_type?: string;
  } | null;
  receipts: any[];
  pendingAdmissions: any[];
  daysRemaining: number;
  status: "active" | "expiring_soon" | "expired" | "pending_verification" | "not_found";
}

function StudentPortalContent({ slug }: { slug: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryPhone = searchParams.get("phone") || "";

  const [phoneNumber, setPhoneNumber] = useState(queryPhone);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<StudentPassData | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  // Auto-load if phone in query or localStorage
  useEffect(() => {
    const savedPhone = queryPhone || (typeof window !== "undefined" ? localStorage.getItem(`student_phone_${slug}`) : null);
    if (savedPhone) {
      setPhoneNumber(savedPhone);
      fetchStudentPass(savedPhone);
    }
  }, [slug, queryPhone]);

  const fetchStudentPass = async (phoneToLookup: string) => {
    const clean = phoneToLookup.replace(/\D/g, "");
    if (clean.length < 10) {
      setErrorMsg("Please enter a valid 10-digit mobile number.");
      return;
    }

    setLoading(true);
    setErrorMsg(null);
    setHasSearched(true);

    try {
      const res = await fetch(`/api/libraries/${slug}/student?phone=${encodeURIComponent(clean)}`);
      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error || "Failed to find student record.");
      }

      setData(json);
      if (typeof window !== "undefined") {
        localStorage.setItem(`student_phone_${slug}`, clean);
      }
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Error fetching pass");
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchStudentPass(phoneNumber);
  };

  const handleClearSession = () => {
    if (typeof window !== "undefined") {
      localStorage.removeItem(`student_phone_${slug}`);
    }
    setData(null);
    setHasSearched(false);
    setPhoneNumber("");
  };

  // Generate QR for Digital Verification
  const verificationUrl = typeof window !== "undefined" && data?.member
    ? `${window.location.origin}/l/${slug}/student?phone=${data.member.phone}`
    : "";
  const qrImage = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(
    verificationUrl || `STUDENT:${data?.member?.name || "STUDENT"}`
  )}`;

  return (
    <main className="min-h-screen bg-background text-text-main pb-16 pt-4 px-4 max-w-md mx-auto">
      {/* Top Navbar */}
      <div className="flex items-center justify-between mb-4 pb-3 border-b border-panel-border">
        <Link
          href={`/l/${slug}/join`}
          className="text-xs text-text-muted hover:text-text-main flex items-center gap-1 font-semibold transition"
        >
          ← Admission QR
        </Link>
        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
          📱 Student ID Pass
        </span>
        {data && (
          <button
            onClick={handleClearSession}
            className="text-xs text-text-muted hover:text-rose-500 font-semibold cursor-pointer transition"
          >
            Switch
          </button>
        )}
      </div>

      {/* Lookup Card if no student found or before search */}
      {!data?.member && !data?.pendingAdmissions?.length && (
        <div className="bg-card-bg border border-panel-border rounded-3xl p-6 text-center shadow-sm">
          <div className="w-14 h-14 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-2xl flex items-center justify-center mx-auto mb-3 shadow-inner">
            🪪
          </div>
          <h1 className="text-xl font-black tracking-tight">Student Digital Pass</h1>
          <p className="text-xs text-text-muted mt-1 leading-relaxed">
            Enter your registered 10-digit mobile number to view your seat number, shift timings, and fee receipts.
          </p>

          {errorMsg && (
            <div className="mt-4 p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-xs font-bold">
              ⚠️ {errorMsg}
            </div>
          )}

          <form onSubmit={handleSearchSubmit} className="mt-5 space-y-3.5">
            <div>
              <input
                type="tel"
                maxLength={10}
                placeholder="Enter 10-digit mobile number"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                autoFocus
                required
                className="w-full bg-background border border-panel-border rounded-xl px-4 py-3 text-center text-base font-mono tracking-widest text-text-main focus:outline-none focus:ring-2 focus:ring-rose-500"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-sm transition active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
            >
              {loading ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                  Looking up your pass...
                </>
              ) : (
                <>🔍 Open My Library Pass</>
              )}
            </button>
          </form>

          {hasSearched && !loading && (
            <div className="mt-6 pt-4 border-t border-panel-border text-center">
              <p className="text-xs text-text-muted">
                No active membership found for this number.
              </p>
              <Link
                href={`/l/${slug}/join`}
                className="mt-2 inline-block px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-sm transition"
              >
                ⚡ Apply for Admission via Door QR
              </Link>
            </div>
          )}
        </div>
      )}

      {/* Pending Admission Notice */}
      {data?.status === "pending_verification" && !data.member && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-3xl p-5 mb-5 text-left">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xl">⏳</span>
            <h2 className="font-extrabold text-sm text-amber-700 dark:text-amber-300">
              Admission Request Pending
            </h2>
          </div>
          <p className="text-xs text-text-muted leading-relaxed">
            Your admission request of ₹{data.pendingAdmissions[0]?.amount_paid} (UTR:{" "}
            <span className="font-mono font-bold text-text-main">
              {data.pendingAdmissions[0]?.utr_number}
            </span>
            ) has been submitted to the front desk.
          </p>
          <div className="mt-3 p-3 rounded-xl bg-background/60 border border-amber-500/20 text-[11px] text-text-muted">
            The librarian will verify the transaction on the soundbox and allocate your seat. Please show your UTR at the reception desk.
          </div>
        </div>
      )}

      {/* Active Digital Membership Pass */}
      {data?.member && (
        <div className="space-y-4 animate-in fade-in duration-200">
          {/* Virtual ID Card */}
          <div className="relative overflow-hidden rounded-3xl bg-linear-to-br from-neutral-900 via-neutral-800 to-neutral-900 text-white p-6 shadow-2xl border border-neutral-700">
            {/* Background Glow */}
            <div className="absolute -top-12 -right-12 w-36 h-36 bg-rose-500/20 rounded-full blur-2xl pointer-events-none"></div>

            {/* Header: Library Name & Branch */}
            <div className="flex items-center justify-between border-b border-neutral-700/60 pb-3 mb-4">
              <div className="flex items-center gap-2.5">
                <span className="text-2xl">📖</span>
                <div>
                  <h3 className="font-black text-sm tracking-tight text-white">
                    {data.library.name}
                  </h3>
                  <p className="text-[10px] text-neutral-400 uppercase tracking-widest">
                    📍 {data.library.city || "Dehradun"}
                  </p>
                </div>
              </div>

              {/* Status Badge */}
              <div>
                {data.status === "active" && (
                  <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                    ACTIVE
                  </span>
                )}
                {data.status === "expiring_soon" && (
                  <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1">
                    ⚠️ {data.daysRemaining} DAYS LEFT
                  </span>
                )}
                {data.status === "expired" && (
                  <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-rose-500/20 text-rose-400 border border-rose-500/30">
                    EXPIRED
                  </span>
                )}
              </div>
            </div>

            {/* Member Identity Details */}
            <div className="flex items-start justify-between gap-4 mb-5">
              <div>
                <div className="text-[10px] uppercase font-bold text-neutral-400 tracking-wider">
                  Student Name
                </div>
                <h2 className="text-xl font-extrabold text-white mt-0.5 tracking-tight">
                  {data.member.name}
                </h2>
                <div className="text-xs text-neutral-300 font-mono mt-0.5">
                  ID: #{String(data.member.student_id).padStart(4, "0")} • +91 {data.member.phone || "N/A"}
                </div>
              </div>

              {/* QR Code */}
              <div className="p-1.5 bg-white rounded-xl shadow-xs shrink-0">
                <img
                  src={qrImage}
                  alt="Student Pass QR"
                  className="w-16 h-16 rounded-lg"
                />
              </div>
            </div>

            {/* Seat and Shift Allocation Box */}
            <div className="grid grid-cols-2 gap-3 p-3.5 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-xs">
              <div>
                <div className="text-[10px] uppercase font-bold text-neutral-400">
                  Allocated Seat
                </div>
                <div className="text-lg font-black text-rose-400 mt-0.5">
                  {data.activeSeat ? `Seat #${data.activeSeat.seat_number}` : "Unallocated"}
                </div>
                <div className="text-[10px] text-neutral-400 capitalize">
                  {data.activeSeat ? `${data.activeSeat.type || "Standard"} Table` : "Visit desk for seat"}
                </div>
              </div>

              <div>
                <div className="text-[10px] uppercase font-bold text-neutral-400">
                  Plan & Shift
                </div>
                <div className="text-sm font-bold text-white mt-0.5">
                  {data.latestReceipt?.shift_type || (data.activeSeat?.type === "fixed" ? "Full Day" : "Half Day")}
                </div>
                <div className="text-[10px] text-neutral-400">
                  {data.member.has_sheet ? "Bed Sheet: Included" : "Standard Seat"}
                </div>
              </div>
            </div>

            {/* Validity Footer */}
            {data.latestReceipt && (
              <div className="mt-4 pt-3 border-t border-neutral-800 flex items-center justify-between text-[11px] text-neutral-400">
                <div>
                  Valid: <span className="text-white font-medium">{new Date(data.latestReceipt.start_date).toLocaleDateString("en-IN", { month: "short", day: "numeric" })} – {new Date(data.latestReceipt.end_date).toLocaleDateString("en-IN", { month: "short", day: "numeric", year: "numeric" })}</span>
                </div>
                <div>
                  Paid: <span className="font-bold text-emerald-400">₹{data.latestReceipt.amount_paid ?? data.latestReceipt.amount}</span>
                </div>
              </div>
            )}
          </div>

          {/* Quick Action Buttons */}
          <div className="grid grid-cols-2 gap-2.5">
            {data.latestReceipt && (
              <Link
                href={`/receipts/${data.latestReceipt.receipt_no}`}
                target="_blank"
                className="py-2.5 px-3 rounded-xl bg-card-bg border border-panel-border hover:border-rose-500/40 text-text-main text-xs font-bold text-center shadow-xs transition flex items-center justify-center gap-1.5"
              >
                <span>📄</span> View Fee Receipt
              </Link>
            )}

            <Link
              href={`/l/${slug}/join`}
              className="py-2.5 px-3 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold text-center shadow-xs transition active:scale-95 flex items-center justify-center gap-1.5"
            >
              <span>🔄</span> Renew Next Month
            </Link>
          </div>

          {/* Library Amenities & Contact Card */}
          <div className="bg-card-bg border border-panel-border rounded-2xl p-4 shadow-sm space-y-2 text-xs">
            <div className="font-extrabold text-text-main flex items-center justify-between">
              <span>🏛️ Library Information</span>
              {data.library.phone && (
                <a
                  href={`tel:${data.library.phone}`}
                  className="text-rose-600 dark:text-rose-400 font-bold hover:underline"
                >
                  📞 {data.library.phone}
                </a>
              )}
            </div>
            <p className="text-text-muted leading-relaxed">
              📍 {data.library.address || data.library.city || "Dehradun"}
            </p>
            <div className="pt-2 border-t border-panel-border flex items-center justify-between text-[11px] text-text-muted">
              <span>High-speed Wi-Fi • Silent Zone • CCTV</span>
              <span className="font-semibold text-emerald-600 dark:text-emerald-400">Open Daily</span>
            </div>
          </div>

          {/* Past Receipts Section */}
          {data.receipts && data.receipts.length > 0 && (
            <div className="bg-card-bg border border-panel-border rounded-2xl p-4 shadow-sm">
              <h4 className="font-extrabold text-xs uppercase tracking-wider text-text-muted mb-3">
                Receipt History ({data.receipts.length})
              </h4>
              <div className="space-y-2">
                {data.receipts.slice(0, 4).map((r: any) => (
                  <div
                    key={r.id}
                    className="flex items-center justify-between p-2.5 rounded-xl bg-neutral-500/5 border border-panel-border text-xs"
                  >
                    <div>
                      <div className="font-bold text-text-main">
                        Receipt #{r.receipt_no}
                      </div>
                      <div className="text-[10px] text-text-muted">
                        {new Date(r.start_date).toLocaleDateString("en-IN")} to {new Date(r.end_date).toLocaleDateString("en-IN")}
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                        ₹{r.amount_paid ?? r.amount}
                      </span>
                      <Link
                        href={`/receipts/${r.receipt_no}`}
                        target="_blank"
                        className="px-2 py-1 rounded-lg bg-neutral-500/10 hover:bg-neutral-500/20 text-text-main font-semibold text-[11px] transition"
                      >
                        Print ↗
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </main>
  );
}

export default function StudentPortalPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params);

  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center p-4">
          <div className="w-8 h-8 border-3 border-rose-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
      }
    >
      <StudentPortalContent slug={slug} />
    </Suspense>
  );
}
