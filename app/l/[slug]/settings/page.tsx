"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { Library, LibrarySettings, ShiftConfig } from "@/lib/types";
import { FALLBACK_TARGET_LIBRARY, FALLBACK_SETTINGS } from "@/lib/tenant";

export default function LibraryOwnerSettingsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params);

  const [library, setLibrary] = useState<Library>(FALLBACK_TARGET_LIBRARY);
  const [settings, setSettings] = useState<LibrarySettings>(FALLBACK_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Editable Form States
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("Dehradun");
  const [address, setAddress] = useState("");
  const [upiId, setUpiId] = useState("");
  const [upiName, setUpiName] = useState("");

  // Seats & Shifts Configuration
  const [totalSeats, setTotalSeats] = useState<number>(297);
  const [shifts, setShifts] = useState<ShiftConfig[]>([]);
  const [hasSheetEnabled, setHasSheetEnabled] = useState(true);
  const [sheetPriceMonthly, setSheetPriceMonthly] = useState(300);

  // New Shift Modal/Form State
  const [showAddShift, setShowAddShift] = useState(false);
  const [newShiftName, setNewShiftName] = useState("");
  const [newShiftStart, setNewShiftStart] = useState("06:00");
  const [newShiftEnd, setNewShiftEnd] = useState("14:00");
  const [newShiftBasePrice, setNewShiftBasePrice] = useState<number>(600);
  const [newShiftSheetPrice, setNewShiftSheetPrice] = useState<number>(900);

  // Active Tab
  const [activeTab, setActiveTab] = useState<"seats_shifts" | "upi_soundbox" | "passwords" | "general" | "poster">("seats_shifts");

  // Password Management State
  const [newStaffPassword, setNewStaffPassword] = useState("");
  const [confirmStaffPassword, setConfirmStaffPassword] = useState("");
  const [savingStaffPass, setSavingStaffPass] = useState(false);
  const [staffPassSuccess, setStaffPassSuccess] = useState(false);

  const [newOwnerPassword, setNewOwnerPassword] = useState("");
  const [savingOwnerPass, setSavingOwnerPass] = useState(false);
  const [ownerPassSuccess, setOwnerPassSuccess] = useState(false);
  const [passwordErrorMessage, setPasswordErrorMessage] = useState<string | null>(null);

  // Fetch initial settings
  useEffect(() => {
    async function loadSettings() {
      try {
        const res = await fetch(`/api/libraries/${slug}/settings`);
        if (res.ok) {
          const data = await res.json();
          const lib = data.library || FALLBACK_TARGET_LIBRARY;
          const sett = data.settings || FALLBACK_SETTINGS;

          setLibrary(lib);
          setSettings(sett);

          setName(lib.name || "");
          setPhone(lib.phone || "");
          setCity(lib.city || "Dehradun");
          setAddress(lib.address || "");
          setUpiId(lib.upi_id || "");
          setUpiName(lib.upi_name || "");

          setTotalSeats(sett.total_seats || 297);
          setShifts(sett.shifts_config || FALLBACK_SETTINGS.shifts_config);
          setHasSheetEnabled(sett.has_sheet_enabled ?? true);
          setSheetPriceMonthly(sett.sheet_price_monthly ?? 300);
        }
      } catch (err) {
        console.error("Failed to load settings:", err);
      } finally {
        setLoading(false);
      }
    }
    loadSettings();
  }, [slug]);

  // Handle Shift Update
  const handleShiftChange = (index: number, field: keyof ShiftConfig, value: any) => {
    const updated = [...shifts];
    updated[index] = { ...updated[index], [field]: value };
    setShifts(updated);
  };

  // Remove Shift
  const handleRemoveShift = (id: string) => {
    if (shifts.length <= 1) {
      alert("At least one shift must be configured.");
      return;
    }
    setShifts(shifts.filter((s) => s.id !== id));
  };

  // Add Custom Shift
  const handleAddShift = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newShiftName.trim()) return;

    const newId = `shift_${Date.now()}`;
    const newShift: ShiftConfig = {
      id: newId,
      name: newShiftName.trim(),
      start_time: newShiftStart,
      end_time: newShiftEnd,
      base_price: Number(newShiftBasePrice),
      sheet_price: Number(newShiftSheetPrice),
    };

    setShifts([...shifts, newShift]);
    setNewShiftName("");
    setShowAddShift(false);
  };

  // Save Settings
  const handleSave = async () => {
    setSaving(true);
    setSaveSuccess(false);
    setErrorMessage(null);

    try {
      const res = await fetch(`/api/libraries/${slug}/settings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          phone,
          city,
          address,
          upi_id: upiId,
          upi_name: upiName,
          total_seats: Number(totalSeats),
          shifts_config: shifts,
          has_sheet_enabled: hasSheetEnabled,
          sheet_price_monthly: Number(sheetPriceMonthly),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update settings");

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 4000);
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : "Error saving settings");
    } finally {
      setSaving(false);
    }
  };

  // Update Staff Password
  const handleUpdateStaffPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStaffPassword.trim()) return;
    if (newStaffPassword !== confirmStaffPassword) {
      setPasswordErrorMessage("Staff passwords do not match.");
      return;
    }

    setSavingStaffPass(true);
    setPasswordErrorMessage(null);
    try {
      const res = await fetch(`/api/libraries/${slug}/staff-password`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          target_role: "staff",
          new_password: newStaffPassword.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update staff password");

      setStaffPassSuccess(true);
      setNewStaffPassword("");
      setConfirmStaffPassword("");
      setTimeout(() => setStaffPassSuccess(false), 4000);
    } catch (err: unknown) {
      setPasswordErrorMessage(err instanceof Error ? err.message : "Error updating staff password");
    } finally {
      setSavingStaffPass(false);
    }
  };

  // Update Owner Password
  const handleUpdateOwnerPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newOwnerPassword.trim()) return;

    setSavingOwnerPass(true);
    setPasswordErrorMessage(null);
    try {
      const res = await fetch(`/api/libraries/${slug}/staff-password`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          target_role: "owner",
          new_password: newOwnerPassword.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update owner password");

      setOwnerPassSuccess(true);
      setNewOwnerPassword("");
      setTimeout(() => setOwnerPassSuccess(false), 4000);
    } catch (err: unknown) {
      setPasswordErrorMessage(err instanceof Error ? err.message : "Error updating owner password");
    } finally {
      setSavingOwnerPass(false);
    }
  };

  // Door QR URL
  const origin = typeof window !== "undefined" ? window.location.origin : "https://library-ms-three.vercel.app";
  const entranceJoinUrl = `${origin}/l/${slug}/join`;
  const entranceQrImage = `https://api.qrserver.com/v1/create-qr-code/?size=350x350&data=${encodeURIComponent(
    entranceJoinUrl
  )}`;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="w-8 h-8 border-3 border-rose-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-background text-text-main pb-24 print:bg-white print:text-black print:p-0">
      {/* Top Navbar */}
      <header className="sticky top-0 z-30 bg-background/80 backdrop-blur-md border-b border-panel-border px-4 py-3 print:hidden">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href={`/l/${slug}`}
              className="px-2.5 py-1.5 rounded-lg border border-panel-border text-xs font-semibold hover:bg-neutral-500/10 transition"
            >
              ← Desk Portal
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-extrabold tracking-tight">{name || library.name}</h1>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-sky-500/15 text-sky-600 dark:text-sky-400 border border-sky-500/20">
                  👑 Owner Settings
                </span>
              </div>
              <p className="text-[11px] text-text-muted">Slug: <span className="font-mono">{slug}</span></p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-sm transition active:scale-95 disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
            >
              {saving ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                  Saving...
                </>
              ) : (
                <>💾 Save All Changes</>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <div className="max-w-5xl mx-auto px-4 pt-6 print:p-0 print:max-w-none">
        {/* Feedback Notifications */}
        {saveSuccess && (
          <div className="mb-5 p-3.5 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-xs font-bold flex items-center gap-2 animate-in fade-in duration-200 print:hidden">
            <span>✅</span> Settings saved successfully! Changes are instantly live for desk staff and students.
          </div>
        )}

        {errorMessage && (
          <div className="mb-5 p-3.5 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-xs font-bold flex items-center gap-2 print:hidden">
            <span>⚠️</span> {errorMessage}
          </div>
        )}

        {/* Navigation Tabs */}
        <div className="flex items-center gap-1.5 p-1.5 bg-card-bg border border-panel-border rounded-2xl mb-6 overflow-x-auto print:hidden">
          <button
            onClick={() => setActiveTab("seats_shifts")}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition cursor-pointer ${
              activeTab === "seats_shifts"
                ? "bg-rose-600 text-white shadow-xs"
                : "text-text-muted hover:text-text-main hover:bg-neutral-500/5"
            }`}
          >
            🪑 Seats & Shift Timings
          </button>
          <button
            onClick={() => setActiveTab("upi_soundbox")}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition cursor-pointer ${
              activeTab === "upi_soundbox"
                ? "bg-rose-600 text-white shadow-xs"
                : "text-text-muted hover:text-text-main hover:bg-neutral-500/5"
            }`}
          >
            🔊 Soundbox & UPI Setup
          </button>
          <button
            onClick={() => setActiveTab("passwords")}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition cursor-pointer ${
              activeTab === "passwords"
                ? "bg-rose-600 text-white shadow-xs"
                : "text-text-muted hover:text-text-main hover:bg-neutral-500/5"
            }`}
          >
            🔐 Staff & Owner Passwords
          </button>
          <button
            onClick={() => setActiveTab("general")}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition cursor-pointer ${
              activeTab === "general"
                ? "bg-rose-600 text-white shadow-xs"
                : "text-text-muted hover:text-text-main hover:bg-neutral-500/5"
            }`}
          >
            🏢 Library Details
          </button>
          <button
            onClick={() => setActiveTab("poster")}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition cursor-pointer ${
              activeTab === "poster"
                ? "bg-rose-600 text-white shadow-xs"
                : "text-text-muted hover:text-text-main hover:bg-neutral-500/5"
            }`}
          >
            🖨️ Entrance QR Door Poster
          </button>
        </div>

        {/* TAB 1: Seats & Shift Timings */}
        {activeTab === "seats_shifts" && (
          <div className="space-y-6">
            {/* Seat Capacity Card */}
            <div className="bg-card-bg border border-panel-border rounded-2xl p-5 shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-panel-border pb-4">
                <div>
                  <h2 className="text-base font-extrabold flex items-center gap-2">
                    <span>🪑</span> Total Seats Capacity
                  </h2>
                  <p className="text-xs text-text-muted mt-0.5">
                    Adjust the exact number of cinema seats available in your study hall.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-2xl font-black text-rose-600 dark:text-rose-400 font-mono">
                    {totalSeats}
                  </span>
                  <span className="text-xs font-bold text-text-muted uppercase">Seats</span>
                </div>
              </div>

              {/* Slider & Quick Presets */}
              <div className="space-y-3">
                <input
                  type="range"
                  min="10"
                  max="500"
                  step="1"
                  value={totalSeats}
                  onChange={(e) => setTotalSeats(Number(e.target.value))}
                  className="w-full accent-rose-600 cursor-pointer"
                />

                <div className="flex items-center justify-between text-[11px] text-text-muted">
                  <span>10 Seats (Co-working Room)</span>
                  <span>500 Seats (Grand Study Campus)</span>
                </div>

                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <span className="text-[11px] font-bold text-text-muted uppercase tracking-wider mr-1">
                    Quick Presets:
                  </span>
                  {[30, 50, 80, 100, 150, 200, 297, 400, 500].map((preset) => (
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
            </div>

            {/* Shifts & Timings Configuration */}
            <div className="bg-card-bg border border-panel-border rounded-2xl p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-panel-border pb-4">
                <div>
                  <h2 className="text-base font-extrabold flex items-center gap-2">
                    <span>🕒</span> Shift Hours & Monthly Fees
                  </h2>
                  <p className="text-xs text-text-muted mt-0.5">
                    Customize slot timings, monthly base fee, and sheet prices for your students.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowAddShift(true)}
                  className="px-3 py-1.5 rounded-xl bg-neutral-500/10 hover:bg-neutral-500/20 border border-panel-border text-xs font-bold transition cursor-pointer"
                >
                  + Add New Shift
                </button>
              </div>

              {/* Shift Rows */}
              <div className="space-y-3">
                {shifts.map((shift, idx) => (
                  <div
                    key={shift.id || idx}
                    className="p-4 rounded-2xl bg-background border border-panel-border space-y-3"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span>
                        <input
                          type="text"
                          value={shift.name}
                          onChange={(e) => handleShiftChange(idx, "name", e.target.value)}
                          className="font-bold text-sm bg-transparent border-b border-dashed border-panel-border focus:outline-none focus:border-rose-500 px-1 py-0.5"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveShift(shift.id)}
                        className="text-text-muted hover:text-rose-600 text-xs px-2 py-1 rounded transition"
                        title="Remove Shift"
                      >
                        ✕ Remove
                      </button>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                      <div>
                        <label className="text-[10px] font-bold text-text-muted uppercase block mb-1">
                          Start Time
                        </label>
                        <input
                          type="time"
                          value={shift.start_time}
                          onChange={(e) => handleShiftChange(idx, "start_time", e.target.value)}
                          className="w-full bg-card-bg border border-panel-border rounded-xl px-2.5 py-1.5 text-xs font-mono"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-text-muted uppercase block mb-1">
                          End Time
                        </label>
                        <input
                          type="time"
                          value={shift.end_time}
                          onChange={(e) => handleShiftChange(idx, "end_time", e.target.value)}
                          className="w-full bg-card-bg border border-panel-border rounded-xl px-2.5 py-1.5 text-xs font-mono"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-text-muted uppercase block mb-1">
                          Base Fee (₹)
                        </label>
                        <input
                          type="number"
                          value={shift.base_price}
                          onChange={(e) => handleShiftChange(idx, "base_price", Number(e.target.value))}
                          className="w-full bg-card-bg border border-panel-border rounded-xl px-2.5 py-1.5 text-xs font-mono font-bold"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-text-muted uppercase block mb-1">
                          With Sheet Fee (₹)
                        </label>
                        <input
                          type="number"
                          value={shift.sheet_price}
                          onChange={(e) => handleShiftChange(idx, "sheet_price", Number(e.target.value))}
                          className="w-full bg-card-bg border border-panel-border rounded-xl px-2.5 py-1.5 text-xs font-mono font-bold text-amber-600 dark:text-amber-400"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Add Shift Modal Form */}
              {showAddShift && (
                <form
                  onSubmit={handleAddShift}
                  className="p-4 rounded-2xl bg-rose-500/5 border border-rose-500/30 space-y-3 animate-in fade-in"
                >
                  <div className="font-extrabold text-xs text-rose-600 dark:text-rose-400 uppercase tracking-wider">
                    Add New Study Shift
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div>
                      <label className="text-[10px] font-bold text-text-muted uppercase block mb-1">
                        Shift Name *
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Night Owl Shift (8 PM - 4 AM)"
                        value={newShiftName}
                        onChange={(e) => setNewShiftName(e.target.value)}
                        className="w-full bg-background border border-panel-border rounded-xl px-3 py-1.5 text-xs"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] font-bold text-text-muted uppercase block mb-1">
                          Start Time
                        </label>
                        <input
                          type="time"
                          value={newShiftStart}
                          onChange={(e) => setNewShiftStart(e.target.value)}
                          className="w-full bg-background border border-panel-border rounded-xl px-2 py-1.5 text-xs font-mono"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-text-muted uppercase block mb-1">
                          End Time
                        </label>
                        <input
                          type="time"
                          value={newShiftEnd}
                          onChange={(e) => setNewShiftEnd(e.target.value)}
                          className="w-full bg-background border border-panel-border rounded-xl px-2 py-1.5 text-xs font-mono"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-text-muted uppercase block mb-1">
                        Base Monthly Price (₹)
                      </label>
                      <input
                        type="number"
                        value={newShiftBasePrice}
                        onChange={(e) => setNewShiftBasePrice(Number(e.target.value))}
                        className="w-full bg-background border border-panel-border rounded-xl px-3 py-1.5 text-xs font-mono font-bold"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-text-muted uppercase block mb-1">
                        Price with Desk Sheet (₹)
                      </label>
                      <input
                        type="number"
                        value={newShiftSheetPrice}
                        onChange={(e) => setNewShiftSheetPrice(Number(e.target.value))}
                        className="w-full bg-background border border-panel-border rounded-xl px-3 py-1.5 text-xs font-mono font-bold"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setShowAddShift(false)}
                      className="px-3 py-1.5 rounded-xl border border-panel-border text-xs font-semibold hover:bg-neutral-500/10 cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold cursor-pointer"
                    >
                      Confirm Add Shift
                    </button>
                  </div>
                </form>
              )}

              {/* Desk Sheet Addon Section */}
              <div className="mt-4 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <input
                      type="checkbox"
                      id="enableSheet"
                      checked={hasSheetEnabled}
                      onChange={(e) => setHasSheetEnabled(e.target.checked)}
                      className="rounded text-amber-600 focus:ring-amber-500 w-4 h-4 cursor-pointer"
                    />
                    <label htmlFor="enableSheet" className="text-xs font-bold text-amber-900 dark:text-amber-200 cursor-pointer">
                      Enable White Desk Sheet Add-on Option
                    </label>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-amber-800/80 dark:text-amber-300/80 font-semibold">
                      Monthly Sheet Surcharge:
                    </span>
                    <div className="flex items-center gap-1 font-mono font-black text-sm text-amber-700 dark:text-amber-300">
                      <span>₹</span>
                      <input
                        type="number"
                        value={sheetPriceMonthly}
                        onChange={(e) => setSheetPriceMonthly(Number(e.target.value))}
                        className="w-20 bg-background border border-panel-border rounded-lg px-2 py-1 text-xs font-mono text-text-main text-right"
                      />
                    </div>
                  </div>
                </div>
                <p className="text-[11px] text-amber-800/70 dark:text-amber-300/70">
                  When enabled, students onboarding at the door QR or front desk can opt into clean desk sheet protection.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: Soundbox & UPI Setup */}
        {activeTab === "upi_soundbox" && (
          <div className="space-y-6">
            <div className="bg-card-bg border border-panel-border rounded-2xl p-5 shadow-sm space-y-4">
              <div>
                <h2 className="text-base font-extrabold flex items-center gap-2">
                  <span>🔊</span> Desk Soundbox & UPI Integration (Method B)
                </h2>
                <p className="text-xs text-text-muted mt-0.5">
                  Direct bank deposits with 0% payment gateway fees. All entrance student payments credit directly to your account.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div>
                  <label className="text-[11px] font-bold text-text-muted uppercase tracking-wider block mb-1">
                    Desk UPI ID / VPA *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. targetlibrary@upi or 9876543210@paytm"
                    value={upiId}
                    onChange={(e) => setUpiId(e.target.value)}
                    className="w-full bg-background border border-panel-border rounded-xl px-3 py-2 text-sm font-mono text-text-main focus:outline-none focus:ring-2 focus:ring-rose-500"
                  />
                  <p className="text-[10px] text-text-muted mt-1">
                    The UPI ID linked to your desk Paytm, PhonePe, or Google Pay Soundbox.
                  </p>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-text-muted uppercase tracking-wider block mb-1">
                    Merchant / Owner Display Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. The Target Library"
                    value={upiName}
                    onChange={(e) => setUpiName(e.target.value)}
                    className="w-full bg-background border border-panel-border rounded-xl px-3 py-2 text-sm text-text-main focus:outline-none focus:ring-2 focus:ring-rose-500"
                  />
                  <p className="text-[10px] text-text-muted mt-1">
                    Displayed in the student&apos;s UPI app when they pay fees.
                  </p>
                </div>
              </div>

              {/* How it works info banner */}
              <div className="p-4 rounded-2xl bg-neutral-500/5 border border-panel-border space-y-2 text-xs">
                <div className="font-bold flex items-center gap-1.5 text-text-main">
                  <span>ℹ️</span> How Soundbox Verification Works:
                </div>
                <ol className="list-decimal list-inside space-y-1 text-text-muted text-[11px] leading-relaxed">
                  <li>Student scans the front door QR poster and pays ₹600 via their UPI app.</li>
                  <li>Your physical desk soundbox speaks aloud: <em>&quot;Paytm par chhe sau rupaye praapt hue&quot;</em>.</li>
                  <li>Student submits their 12-digit UTR reference number into the app.</li>
                  <li>Desk staff sees the incoming request alert on their screen, verifies the UTR, and clicks <strong>Approve</strong> to assign a seat.</li>
                </ol>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: General Library Details */}
        {activeTab === "general" && (
          <div className="space-y-6">
            <div className="bg-card-bg border border-panel-border rounded-2xl p-5 shadow-sm space-y-4">
              <div>
                <h2 className="text-base font-extrabold flex items-center gap-2">
                  <span>🏢</span> Library Brand & Contact Profile
                </h2>
                <p className="text-xs text-text-muted mt-0.5">
                  Information displayed on student digital wallet cards, invoices, and passes.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div>
                  <label className="text-[11px] font-bold text-text-muted uppercase tracking-wider block mb-1">
                    Library Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-background border border-panel-border rounded-xl px-3 py-2 text-sm text-text-main focus:outline-none focus:ring-2 focus:ring-rose-500 font-bold"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-text-muted uppercase tracking-wider block mb-1">
                    City / Branch
                  </label>
                  <input
                    type="text"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    className="w-full bg-background border border-panel-border rounded-xl px-3 py-2 text-sm text-text-main focus:outline-none focus:ring-2 focus:ring-rose-500"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-text-muted uppercase tracking-wider block mb-1">
                    Official Helpdesk Phone
                  </label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full bg-background border border-panel-border rounded-xl px-3 py-2 text-sm font-mono text-text-main focus:outline-none focus:ring-2 focus:ring-rose-500"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-text-muted uppercase tracking-wider block mb-1">
                    Full Address
                  </label>
                  <input
                    type="text"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    className="w-full bg-background border border-panel-border rounded-xl px-3 py-2 text-sm text-text-main focus:outline-none focus:ring-2 focus:ring-rose-500"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB: Staff & Owner Passwords Management */}
        {activeTab === "passwords" && (
          <div className="space-y-6">
            {passwordErrorMessage && (
              <div className="p-3.5 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-xs font-bold flex items-center gap-2">
                <span>⚠️</span> {passwordErrorMessage}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Card 1: Front-Desk Staff Passcode */}
              <div className="bg-card-bg border border-panel-border rounded-2xl p-5 shadow-sm flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xl p-2 rounded-xl bg-rose-500/10 border border-rose-500/20">
                        💻
                      </span>
                      <div>
                        <h3 className="font-extrabold text-sm text-text-main">
                          Desk Staff Passcode
                        </h3>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400">
                          Receptionist Access
                        </span>
                      </div>
                    </div>
                  </div>

                  <p className="text-xs text-text-muted leading-relaxed mb-5">
                    Give this password to your front-desk librarians and staff. They can manage the seat grid, admit students, and create receipts, but <span className="font-semibold text-text-main">cannot</span> change pricing or view owner revenue settings.
                  </p>

                  <form onSubmit={handleUpdateStaffPassword} className="space-y-3.5">
                    <div>
                      <label className="text-[11px] font-bold text-text-muted uppercase tracking-wider block mb-1">
                        New Staff Passcode
                      </label>
                      <input
                        type="password"
                        placeholder="e.g. 1234 or staff2026"
                        value={newStaffPassword}
                        onChange={(e) => setNewStaffPassword(e.target.value)}
                        required
                        className="w-full bg-background border border-panel-border rounded-xl px-3 py-2 text-sm text-text-main focus:outline-none focus:ring-2 focus:ring-rose-500"
                      />
                    </div>

                    <div>
                      <label className="text-[11px] font-bold text-text-muted uppercase tracking-wider block mb-1">
                        Confirm Staff Passcode
                      </label>
                      <input
                        type="password"
                        placeholder="Re-enter passcode"
                        value={confirmStaffPassword}
                        onChange={(e) => setConfirmStaffPassword(e.target.value)}
                        required
                        className="w-full bg-background border border-panel-border rounded-xl px-3 py-2 text-sm text-text-main focus:outline-none focus:ring-2 focus:ring-rose-500"
                      />
                    </div>

                    {staffPassSuccess && (
                      <div className="p-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-xs font-bold flex items-center gap-1.5 animate-in fade-in">
                        <span>✅</span> Staff passcode updated successfully!
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={savingStaffPass || !newStaffPassword.trim()}
                      className="w-full mt-2 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-sm transition active:scale-95 disabled:opacity-50 flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      {savingStaffPass ? (
                        <>
                          <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                          Saving Staff Passcode...
                        </>
                      ) : (
                        <>🔑 Update Staff Passcode</>
                      )}
                    </button>
                  </form>
                </div>

                <div className="mt-4 pt-3 border-t border-panel-border text-[11px] text-text-muted">
                  Default: <span className="font-mono font-semibold">Target2026</span>
                </div>
              </div>

              {/* Card 2: Library Owner Master Password */}
              <div className="bg-card-bg border border-panel-border rounded-2xl p-5 shadow-sm flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xl p-2 rounded-xl bg-sky-500/10 border border-sky-500/20">
                        👑
                      </span>
                      <div>
                        <h3 className="font-extrabold text-sm text-text-main">
                          Owner Master Password
                        </h3>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-sky-600 dark:text-sky-400">
                          Owner Full Access
                        </span>
                      </div>
                    </div>
                  </div>

                  <p className="text-xs text-text-muted leading-relaxed mb-5">
                    This master password unlocks your Library Settings, Shift Timings, Soundbox UPI ID, and Fee Configuration. Keep this strictly private.
                  </p>

                  <form onSubmit={handleUpdateOwnerPassword} className="space-y-3.5">
                    <div>
                      <label className="text-[11px] font-bold text-text-muted uppercase tracking-wider block mb-1">
                        New Owner Password
                      </label>
                      <input
                        type="password"
                        placeholder="Enter secure master password"
                        value={newOwnerPassword}
                        onChange={(e) => setNewOwnerPassword(e.target.value)}
                        required
                        className="w-full bg-background border border-panel-border rounded-xl px-3 py-2 text-sm text-text-main focus:outline-none focus:ring-2 focus:ring-sky-500"
                      />
                    </div>

                    {ownerPassSuccess && (
                      <div className="p-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-xs font-bold flex items-center gap-1.5 animate-in fade-in">
                        <span>✅</span> Owner password updated successfully!
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={savingOwnerPass || !newOwnerPassword.trim()}
                      className="w-full mt-2 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs shadow-sm transition active:scale-95 disabled:opacity-50 flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      {savingOwnerPass ? (
                        <>
                          <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                          Saving Master Password...
                        </>
                      ) : (
                        <>🛡️ Update Master Password</>
                      )}
                    </button>
                  </form>
                </div>

                <div className="mt-4 pt-3 border-t border-panel-border text-[11px] text-text-muted">
                  Default: <span className="font-mono font-semibold">TargetOwner2026</span>
                </div>
              </div>
            </div>

            {/* Security Advisory Callout */}
            <div className="bg-neutral-500/5 border border-panel-border rounded-2xl p-4 text-xs text-text-muted flex items-start gap-3">
              <span className="text-base">💡</span>
              <p className="leading-relaxed">
                <span className="font-bold text-text-main">Instant Credential Sync:</span> Password updates take effect immediately across all sessions. Staff and owner can log in with their newly assigned credentials from the universal login portal or direct library link.
              </p>
            </div>
          </div>
        )}

        {/* TAB 4: Front Door Entrance QR Poster (Printable A4 Sheet) */}
        {activeTab === "poster" && (
          <div className="space-y-5">
            <div className="flex items-center justify-between bg-card-bg border border-panel-border rounded-2xl p-4 shadow-sm print:hidden">
              <div>
                <h3 className="font-extrabold text-sm text-text-main">🖨️ Printable Entrance Door Poster</h3>
                <p className="text-xs text-text-muted mt-0.5">
                  Print this A4 sheet and paste it on your front glass door so students can scan and self-admit.
                </p>
              </div>
              <button
                type="button"
                onClick={() => window.print()}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-sm transition active:scale-95 cursor-pointer flex items-center gap-1.5"
              >
                <span>🖨️</span> Print A4 Poster
              </button>
            </div>

            {/* Poster Sheet View */}
            <div className="bg-white text-neutral-900 border-2 border-neutral-300 rounded-3xl p-8 max-w-xl mx-auto text-center shadow-xl print:border-none print:shadow-none print:p-4 print:max-w-none">
              <div className="w-16 h-16 rounded-2xl bg-neutral-900 text-white text-3xl flex items-center justify-center mx-auto mb-3 shadow-md">
                📖
              </div>

              <h1 className="text-3xl font-black tracking-tight text-neutral-900">
                {name || library.name}
              </h1>
              <p className="text-xs font-semibold text-neutral-500 uppercase tracking-widest mt-1">
                📍 {address || city || "Dehradun"} • Self-Service Admission Desk
              </p>

              <div className="my-6 p-6 rounded-2xl bg-neutral-50 border border-neutral-200 inline-block shadow-inner">
                <img
                  src={entranceQrImage}
                  alt="Entrance QR Code"
                  className="w-64 h-64 mx-auto rounded-xl shadow-sm border border-neutral-200"
                />
                <div className="text-[11px] font-mono text-neutral-500 mt-2">
                  Scan with any Phone Camera or QR Scanner
                </div>
              </div>

              {/* 4 Easy Steps */}
              <div className="text-left bg-neutral-100 rounded-2xl p-4.5 border border-neutral-200 max-w-md mx-auto space-y-2.5">
                <div className="font-extrabold text-xs text-neutral-900 uppercase tracking-wider text-center mb-1">
                  ⚡ 4 Simple Steps to Get Your Seat:
                </div>
                <div className="flex items-start gap-2.5 text-xs text-neutral-700">
                  <span className="font-black text-rose-600">1.</span>
                  <span><strong>Scan this QR</strong> on your phone to open the admission form.</span>
                </div>
                <div className="flex items-start gap-2.5 text-xs text-neutral-700">
                  <span className="font-black text-rose-600">2.</span>
                  <span><strong>Choose your shift</strong> (Morning, Evening, Night, or Full Day).</span>
                </div>
                <div className="flex items-start gap-2.5 text-xs text-neutral-700">
                  <span className="font-black text-rose-600">3.</span>
                  <span><strong>Pay fee via UPI</strong> (GPay, PhonePe, Paytm, or BHIM).</span>
                </div>
                <div className="flex items-start gap-2.5 text-xs text-neutral-700">
                  <span className="font-black text-rose-600">4.</span>
                  <span><strong>Show desk staff</strong> your UTR confirmation to receive your seat number!</span>
                </div>
              </div>

              <div className="text-[10px] text-neutral-400 mt-6 font-mono">
                Direct URL: {entranceJoinUrl}
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
