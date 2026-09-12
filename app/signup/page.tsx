"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function LibrarySignupPage() {
  const router = useRouter();

  // Form States
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [isSlugEdited, setIsSlugEdited] = useState(false);
  const [city, setCity] = useState("Dehradun");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [totalSeats, setTotalSeats] = useState<number>(60);
  const [upiId, setUpiId] = useState("");
  const [upiName, setUpiName] = useState("");
  const [ownerPassword, setOwnerPassword] = useState("");
  const [staffPassword, setStaffPassword] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [createdLibrary, setCreatedLibrary] = useState<{ slug: string; name: string } | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Auto-generate slug from library name if not manually edited
  const handleNameChange = (val: string) => {
    setName(val);
    if (!isSlugEdited) {
      const generated = val
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9\s-]/g, "")
        .replace(/\s+/g, "-")
        .replace(/-+/g, "-");
      setSlug(generated);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !slug.trim()) {
      setErrorMessage("Please enter both Library Name and a unique Web Slug.");
      return;
    }
    if (!ownerPassword.trim() || !staffPassword.trim()) {
      setErrorMessage("Please set both an Owner Password and a Staff Password.");
      return;
    }

    setSubmitting(true);
    setErrorMessage(null);

    try {
      const res = await fetch("/api/libraries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          slug: slug.trim(),
          city: city.trim(),
          phone: phone.trim(),
          address: address.trim(),
          total_seats: Number(totalSeats),
          upi_id: upiId.trim() || null,
          upi_name: upiName.trim() || name.trim(),
          owner_password: ownerPassword.trim(),
          staff_password: staffPassword.trim(),
          monthly_fee: 600,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to register library");

      setCreatedLibrary({
        slug: data.library.slug,
        name: data.library.name,
      });
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : "Error creating library");
    } finally {
      setSubmitting(false);
    }
  };

  const origin = typeof window !== "undefined" ? window.location.origin : "https://library-ms-three.vercel.app";

  return (
    <main className="min-h-screen bg-background text-foreground py-10 px-4">
      <div className="max-w-xl mx-auto space-y-6">
        {/* Header Branding */}
        <div className="text-center space-y-1.5">
          <Link href="/" className="inline-flex items-center gap-2 mb-2 group">
            <span className="text-2xl p-2 rounded-2xl bg-rose-500/10 border border-rose-500/20 group-hover:scale-105 transition-transform">
              📚
            </span>
            <span className="font-extrabold text-base tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-rose-600 to-amber-500">
              LIBRARYOS
            </span>
          </Link>
          <h1 className="text-2xl md:text-3xl font-black tracking-tight">
            Register Your Library
          </h1>
          <p className="text-xs text-text-muted">
            Start your <span className="text-rose-600 dark:text-rose-400 font-bold">7-Day Free Trial</span>. Set up in 60 seconds with zero credit card required.
          </p>
        </div>

        {createdLibrary ? (
          /* Success Screen */
          <div className="bg-card-bg border-2 border-emerald-500/40 rounded-3xl p-6 sm:p-8 shadow-2xl text-center space-y-5 animate-in zoom-in-95 duration-200">
            <div className="w-16 h-16 bg-emerald-500/15 text-emerald-500 text-3xl rounded-full flex items-center justify-center mx-auto border border-emerald-500/30">
              ✓
            </div>
            <div>
              <h2 className="text-xl font-black text-text-main">
                {createdLibrary.name} is Live!
              </h2>
              <p className="text-xs text-text-muted mt-1">
                Your dedicated workspace and cinema seat matrix are fully pre-configured.
              </p>
            </div>

            {/* Links Box */}
            <div className="p-4 rounded-2xl bg-neutral-500/5 border border-panel-border text-left text-xs space-y-3">
              <div>
                <span className="text-[10px] font-bold text-text-muted uppercase block">
                  1. Your Librarian Desk Portal
                </span>
                <span className="font-mono font-bold text-rose-600 dark:text-rose-400 text-xs break-all">
                  {origin}/l/{createdLibrary.slug}
                </span>
              </div>

              <div>
                <span className="text-[10px] font-bold text-text-muted uppercase block">
                  2. Student Entrance Door QR URL
                </span>
                <span className="font-mono font-semibold text-emerald-600 dark:text-emerald-400 text-xs break-all">
                  {origin}/l/{createdLibrary.slug}/join
                </span>
              </div>

              <div>
                <span className="text-[10px] font-bold text-text-muted uppercase block">
                  3. Library Owner Settings
                </span>
                <span className="font-mono font-semibold text-sky-600 dark:text-sky-400 text-xs break-all">
                  {origin}/l/{createdLibrary.slug}/settings
                </span>
              </div>
            </div>

            {/* Direct Action Buttons */}
            <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
              <Link
                href={`/l/${createdLibrary.slug}`}
                className="w-full py-3 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white font-extrabold text-xs shadow-md transition active:scale-95 text-center"
              >
                Open Desk Portal →
              </Link>
              <Link
                href={`/l/${createdLibrary.slug}/settings`}
                className="w-full py-3 rounded-2xl border border-panel-border bg-card-bg hover:bg-neutral-500/10 text-xs font-bold transition text-center"
              >
                🖨️ Print Door Poster →
              </Link>
            </div>
          </div>
        ) : (
          /* Registration Form */
          <form onSubmit={handleSubmit} className="bg-card-bg border border-panel-border rounded-3xl p-6 sm:p-7 shadow-sm space-y-6">
            {errorMessage && (
              <div className="p-3.5 bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-xs rounded-xl font-medium">
                ⚠️ {errorMessage}
              </div>
            )}

            {/* Section 1: Library Identity */}
            <div className="space-y-4">
              <div className="font-extrabold text-xs uppercase tracking-wider text-text-muted flex items-center gap-1.5 pb-2 border-b border-panel-border">
                <span>🏢</span> 1. Library Information
              </div>

              <div>
                <label className="text-[11px] font-bold text-text-muted uppercase tracking-wider block mb-1">
                  Library Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Apex Study Hub"
                  value={name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  className="w-full bg-background border border-panel-border rounded-xl px-3.5 py-2.5 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>

              {/* URL Slug Preview */}
              <div>
                <label className="text-[11px] font-bold text-text-muted uppercase tracking-wider block mb-1">
                  Your Dedicated Web Address (Slug) *
                </label>
                <div className="flex items-center rounded-xl bg-background border border-panel-border overflow-hidden focus-within:ring-2 focus-within:ring-rose-500">
                  <span className="px-3 py-2 text-xs font-mono text-text-muted bg-neutral-500/5 border-r border-panel-border select-none">
                    /l/
                  </span>
                  <input
                    type="text"
                    required
                    value={slug}
                    onChange={(e) => {
                      setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"));
                      setIsSlugEdited(true);
                    }}
                    placeholder="apex-study-hub"
                    className="w-full bg-transparent px-3 py-2 text-xs font-mono text-text-main focus:outline-none"
                  />
                </div>
                <p className="text-[10px] text-text-muted mt-1 font-mono">
                  Live link will be: <span className="font-bold text-rose-600 dark:text-rose-400">{origin}/l/{slug || "your-library"}</span>
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-text-muted uppercase tracking-wider block mb-1">
                    City / Branch *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Dehradun"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    className="w-full bg-background border border-panel-border rounded-xl px-3.5 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-rose-500"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-text-muted uppercase tracking-wider block mb-1">
                    Official WhatsApp / Phone *
                  </label>
                  <input
                    type="tel"
                    required
                    placeholder="10-digit mobile"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
                    className="w-full bg-background border border-panel-border rounded-xl px-3.5 py-2 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-rose-500"
                  />
                </div>
              </div>
            </div>

            {/* Section 2: Seat Capacity */}
            <div className="space-y-3.5">
              <div className="font-extrabold text-xs uppercase tracking-wider text-text-muted flex items-center justify-between pb-2 border-b border-panel-border">
                <span className="flex items-center gap-1.5"><span>🪑</span> 2. Total Seat Capacity</span>
                <span className="text-base font-black font-mono text-rose-600 dark:text-rose-400">{totalSeats} Seats</span>
              </div>

              <input
                type="range"
                min="10"
                max="500"
                step="5"
                value={totalSeats}
                onChange={(e) => setTotalSeats(Number(e.target.value))}
                className="w-full accent-rose-600 cursor-pointer"
              />

              <div className="flex flex-wrap items-center gap-2">
                {[30, 50, 80, 100, 150, 200, 300].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setTotalSeats(preset)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition cursor-pointer ${
                      totalSeats === preset
                        ? "bg-rose-500/15 border-rose-500 text-rose-600 dark:text-rose-400 font-bold"
                        : "border-panel-border bg-background hover:bg-neutral-500/10 text-text-muted"
                    }`}
                  >
                    {preset}
                  </button>
                ))}
              </div>
            </div>

            {/* Section 3: Direct UPI Soundbox */}
            <div className="space-y-4">
              <div className="font-extrabold text-xs uppercase tracking-wider text-text-muted flex items-center gap-1.5 pb-2 border-b border-panel-border">
                <span>🔊</span> 3. Desk Soundbox &amp; UPI ID (0% Fees)
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-text-muted uppercase tracking-wider block mb-1">
                    Desk UPI ID / VPA
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. apexlibrary@okicici"
                    value={upiId}
                    onChange={(e) => setUpiId(e.target.value)}
                    className="w-full bg-background border border-panel-border rounded-xl px-3.5 py-2 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-rose-500"
                  />
                  <p className="text-[10px] text-text-muted mt-1">
                    Direct deposits into your Paytm or PhonePe Soundbox.
                  </p>
                </div>
                <div>
                  <label className="text-[11px] font-bold text-text-muted uppercase tracking-wider block mb-1">
                    Merchant Name
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Apex Study Hub"
                    value={upiName}
                    onChange={(e) => setUpiName(e.target.value)}
                    className="w-full bg-background border border-panel-border rounded-xl px-3.5 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-rose-500"
                  />
                </div>
              </div>
            </div>

            {/* Section 4: Passwords & Access Separation */}
            <div className="space-y-4">
              <div className="font-extrabold text-xs uppercase tracking-wider text-text-muted flex items-center gap-1.5 pb-2 border-b border-panel-border">
                <span>🔐</span> 4. Owner vs. Staff Passwords
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-text-muted uppercase tracking-wider block mb-1">
                    👑 Owner Master Password *
                  </label>
                  <input
                    type="password"
                    required
                    placeholder="Owner secret passcode"
                    value={ownerPassword}
                    onChange={(e) => setOwnerPassword(e.target.value)}
                    className="w-full bg-background border border-panel-border rounded-xl px-3.5 py-2 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                  <p className="text-[10px] text-text-muted mt-1">
                    For editing seats, pricing, and resetting staff passwords.
                  </p>
                </div>
                <div>
                  <label className="text-[11px] font-bold text-text-muted uppercase tracking-wider block mb-1">
                    👨‍💼 Reception Staff Password *
                  </label>
                  <input
                    type="password"
                    required
                    placeholder="Desk staff passcode"
                    value={staffPassword}
                    onChange={(e) => setStaffPassword(e.target.value)}
                    className="w-full bg-background border border-panel-border rounded-xl px-3.5 py-2 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-rose-500"
                  />
                  <p className="text-[10px] text-text-muted mt-1">
                    Passcode given to your desk staff for daily seat booking.
                  </p>
                </div>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={submitting}
              className="w-full py-4 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white font-extrabold text-sm shadow-lg transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
            >
              {submitting ? "Provisioning Your Library..." : "Launch My Library (Start Free Trial) 🚀"}
            </button>

            <div className="text-center text-[11px] text-text-muted pt-1">
              Already have an account?{" "}
              <Link href="/login" className="font-bold underline hover:text-text-main">
                Sign in to your portal
              </Link>
            </div>
          </form>
        )}
      </div>
    </main>
  );
}
