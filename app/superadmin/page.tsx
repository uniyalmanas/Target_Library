"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { Library } from "@/lib/types";

export default function SuperAdminPage() {
  const [libraries, setLibraries] = useState<Library[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // New Library Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    slug: "",
    city: "Dehradun",
    phone: "",
    address: "",
    total_seats: 50,
    monthly_fee: 600,
    upi_id: "",
    owner_password: "",
  });

  // Edit Pricing Modal State
  const [editingLibrary, setEditingLibrary] = useState<Library | null>(null);
  const [newFee, setNewFee] = useState<number>(600);
  const [isLifetimeFixed, setIsLifetimeFixed] = useState<boolean>(false);

  const fetchLibraries = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/libraries?all=true");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load libraries");
      setLibraries(data.libraries || []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error fetching libraries");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLibraries();
  }, []);

  // Stats Calculations
  const stats = useMemo(() => {
    const total = libraries.length;
    const active = libraries.filter((l) => l.subscription_status === "active").length;
    const mrr = libraries.reduce((sum, l) => sum + (l.monthly_fee || 0), 0);
    const foundingVips = libraries.filter((l) => l.is_lifetime_fixed).length;
    return { total, active, mrr, foundingVips };
  }, [libraries]);

  // Handle Slug Auto-generation
  const handleNameChange = (name: string) => {
    const generatedSlug = name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-");
    setFormData((prev) => ({ ...prev, name, slug: generatedSlug }));
  };

  // Create Library
  const handleCreateLibrary = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.slug) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/libraries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create library");

      setShowAddModal(false);
      setFormData({
        name: "",
        slug: "",
        city: "Dehradun",
        phone: "",
        address: "",
        total_seats: 50,
        monthly_fee: 600,
        upi_id: "",
        owner_password: "",
      });
      fetchLibraries();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Error creating library");
    } finally {
      setSubmitting(false);
    }
  };

  // Update Library Pricing / Status
  const handleSavePrice = async () => {
    if (!editingLibrary) return;
    try {
      const res = await fetch("/api/libraries", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingLibrary.id,
          monthly_fee: newFee,
          is_lifetime_fixed: isLifetimeFixed,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update price");
      setEditingLibrary(null);
      fetchLibraries();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Error updating price");
    }
  };

  // Quick 1-Month Extension (When owner pays via UPI)
  const handleExtendMonth = async (lib: Library) => {
    const confirmExtend = window.confirm(
      `Mark subscription as paid for ${lib.name}? This will extend their access by 30 days.`
    );
    if (!confirmExtend) return;

    try {
      const currentExpiry = lib.subscription_ends_at ? new Date(lib.subscription_ends_at) : new Date();
      const newExpiry = new Date(Math.max(currentExpiry.getTime(), Date.now()) + 30 * 24 * 60 * 60 * 1000);

      const res = await fetch("/api/libraries", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: lib.id,
          subscription_status: "active",
          subscription_ends_at: newExpiry.toISOString(),
        }),
      });
      if (!res.ok) throw new Error("Failed to extend subscription");
      fetchLibraries();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Error extending subscription");
    }
  };

  return (
    <main className="min-h-screen bg-background text-text-main pb-24 pt-8 px-4 md:px-8 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-panel-border pb-6">
        <div>
          <div className="flex items-center gap-3">
            <span className="text-3xl">🛡️</span>
            <div>
              <h1 className="text-2xl md:text-3xl font-black tracking-tight">
                SaaS Founder Control Panel
              </h1>
              <p className="text-xs text-text-muted mt-0.5">
                Centralized management for all subscribed study libraries and reading rooms.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchLibraries}
            className="px-3.5 py-2 text-xs font-semibold rounded-xl bg-card-bg border border-panel-border hover:bg-neutral-100 dark:hover:bg-neutral-800 transition cursor-pointer"
          >
            🔄 Refresh
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2 text-xs font-bold rounded-xl bg-rose-600 hover:bg-rose-500 text-white shadow-sm transition flex items-center gap-1.5 cursor-pointer"
          >
            <span>+</span> Onboard New Library
          </button>
        </div>
      </div>

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 my-6">
        <div className="bg-card-bg border border-panel-border rounded-2xl p-4 shadow-sm">
          <div className="text-xs font-medium text-text-muted uppercase tracking-wider">
            Total Subscribed Libraries
          </div>
          <div className="text-3xl font-black mt-1 text-text-main">{stats.total}</div>
          <div className="text-[11px] text-text-muted mt-1">{stats.active} currently active</div>
        </div>

        <div className="bg-card-bg border border-emerald-500/20 bg-emerald-500/5 rounded-2xl p-4 shadow-sm">
          <div className="text-xs font-medium text-emerald-600 dark:text-emerald-400 uppercase tracking-wider flex items-center justify-between">
            <span>Monthly Recurring Revenue</span>
            <span>💰</span>
          </div>
          <div className="text-3xl font-black mt-1 text-emerald-600 dark:text-emerald-400">
            ₹{stats.mrr.toLocaleString("en-IN")}/mo
          </div>
          <div className="text-[11px] text-emerald-600/70 dark:text-emerald-400/70 mt-1">
            Annual: ₹{(stats.mrr * 12).toLocaleString("en-IN")}/yr
          </div>
        </div>

        <div className="bg-card-bg border border-panel-border rounded-2xl p-4 shadow-sm">
          <div className="text-xs font-medium text-text-muted uppercase tracking-wider">
            Active Hubs
          </div>
          <div className="text-3xl font-black mt-1 text-sky-600 dark:text-sky-400">
            Dehradun
          </div>
          <div className="text-[11px] text-text-muted mt-1">First Target City</div>
        </div>

        <div className="bg-card-bg border border-panel-border rounded-2xl p-4 shadow-sm">
          <div className="text-xs font-medium text-text-muted uppercase tracking-wider flex items-center justify-between">
            <span>Founding VIP Clients</span>
            <span>⭐</span>
          </div>
          <div className="text-3xl font-black mt-1 text-amber-600 dark:text-amber-400">
            {stats.foundingVips}
          </div>
          <div className="text-[11px] text-text-muted mt-1">Target Library (₹400/mo)</div>
        </div>
      </div>

      {/* Libraries Table */}
      {loading ? (
        <div className="bg-card-bg border border-panel-border rounded-2xl p-16 text-center shadow-sm">
          <div className="w-8 h-8 border-3 border-rose-500 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
          <p className="text-xs text-text-muted font-medium">Loading subscribed libraries...</p>
        </div>
      ) : error ? (
        <div className="bg-rose-500/10 border border-rose-500/30 rounded-2xl p-6 text-center text-rose-600 dark:text-rose-400 text-xs">
          {error}
        </div>
      ) : (
        <div className="bg-card-bg border border-panel-border rounded-2xl overflow-hidden shadow-sm">
          <div className="p-4 border-b border-panel-border flex items-center justify-between">
            <h2 className="font-bold text-sm text-text-main">Tenant Libraries Directory</h2>
            <span className="text-xs text-text-muted">{libraries.length} registered</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-panel-border bg-neutral-500/5 text-text-muted font-semibold uppercase tracking-wider">
                  <th className="py-3.5 px-4">Library Name</th>
                  <th className="py-3.5 px-4">Slug / URL</th>
                  <th className="py-3.5 px-4">City</th>
                  <th className="py-3.5 px-4">Monthly Rate</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-panel-border">
                {libraries.map((lib) => (
                  <tr key={lib.id} className="hover:bg-neutral-500/5 transition-colors">
                    {/* Name */}
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-text-main text-sm flex items-center gap-2">
                        {lib.name}
                        {lib.is_lifetime_fixed && (
                          <span className="text-[10px] bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/20 px-1.5 py-0.5 rounded font-bold">
                            ⭐ Founding VIP
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-text-muted mt-0.5">
                        📞 {lib.phone || "No phone"} • UPI: {lib.upi_id || "None"}
                      </div>
                    </td>

                    {/* Slug */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <code className="bg-neutral-500/10 px-2 py-1 rounded text-[11px] font-mono font-semibold text-rose-600 dark:text-rose-400">
                        /l/{lib.slug}
                      </code>
                    </td>

                    {/* City */}
                    <td className="py-3.5 px-4 whitespace-nowrap font-medium text-text-main">
                      📍 {lib.city || "Dehradun"}
                    </td>

                    {/* Monthly Rate */}
                    <td className="py-3.5 px-4 whitespace-nowrap font-black text-sm text-emerald-600 dark:text-emerald-400">
                      ₹{lib.monthly_fee}/mo
                    </td>

                    {/* Status */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1 bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 text-[11px] font-semibold px-2 py-0.5 rounded-full">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                        {lib.subscription_status.toUpperCase()}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 px-4 whitespace-nowrap text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => handleExtendMonth(lib)}
                          className="px-2.5 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-[11px] font-semibold transition cursor-pointer"
                          title="Record monthly ₹ payment and extend 30 days"
                        >
                          💵 Paid +30d
                        </button>

                        <button
                          onClick={() => {
                            setEditingLibrary(lib);
                            setNewFee(lib.monthly_fee);
                            setIsLifetimeFixed(lib.is_lifetime_fixed);
                          }}
                          className="px-2.5 py-1 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-400 border border-amber-500/20 text-[11px] font-semibold transition cursor-pointer"
                          title="Change fee or lock discount"
                        >
                          ✏️ Rate
                        </button>

                        <Link
                          href={`/dashboard`}
                          className="px-2.5 py-1 rounded-lg bg-card-bg border border-panel-border hover:bg-neutral-100 dark:hover:bg-neutral-800 text-[11px] font-semibold transition"
                          title="Visit Library App"
                        >
                          🔗 Open App
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Onboard New Library Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-card-bg border border-panel-border rounded-3xl p-6 max-w-lg w-full shadow-2xl animate-in fade-in zoom-in duration-150">
            <div className="flex items-center justify-between border-b border-panel-border pb-4 mb-4">
              <div>
                <h3 className="font-extrabold text-lg text-text-main">
                  Onboard New Study Library
                </h3>
                <p className="text-xs text-text-muted">
                  Create a new dedicated workspace for a library in Dehradun.
                </p>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-text-muted hover:text-text-main text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateLibrary} className="space-y-3.5 text-xs">
              <div>
                <label className="font-semibold block mb-1">Library Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Apex Reading Room"
                  value={formData.name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  className="w-full bg-background border border-panel-border rounded-xl px-3 py-2 text-sm text-text-main focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>

              <div>
                <label className="font-semibold block mb-1">URL Identifier (Slug) *</label>
                <div className="flex items-center bg-background border border-panel-border rounded-xl px-3 py-2">
                  <span className="text-text-muted font-mono">/l/</span>
                  <input
                    type="text"
                    required
                    placeholder="apex-reading-room"
                    value={formData.slug}
                    onChange={(e) => setFormData((p) => ({ ...p, slug: e.target.value }))}
                    className="w-full bg-transparent font-mono text-text-main focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold block mb-1">City</label>
                  <input
                    type="text"
                    value={formData.city}
                    onChange={(e) => setFormData((p) => ({ ...p, city: e.target.value }))}
                    className="w-full bg-background border border-panel-border rounded-xl px-3 py-2 text-text-main focus:outline-none focus:ring-2 focus:ring-rose-500"
                  />
                </div>
                <div>
                  <label className="font-semibold block mb-1">Owner Phone</label>
                  <input
                    type="tel"
                    placeholder="9876543210"
                    value={formData.phone}
                    onChange={(e) => setFormData((p) => ({ ...p, phone: e.target.value }))}
                    className="w-full bg-background border border-panel-border rounded-xl px-3 py-2 text-text-main focus:outline-none focus:ring-2 focus:ring-rose-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold block mb-1">Total Seats</label>
                  <input
                    type="number"
                    min="10"
                    max="500"
                    value={formData.total_seats}
                    onChange={(e) =>
                      setFormData((p) => ({ ...p, total_seats: Number(e.target.value) }))
                    }
                    className="w-full bg-background border border-panel-border rounded-xl px-3 py-2 text-text-main focus:outline-none focus:ring-2 focus:ring-rose-500"
                  />
                </div>
                <div>
                  <label className="font-semibold block mb-1">Monthly SaaS Fee (₹)</label>
                  <input
                    type="number"
                    step="50"
                    value={formData.monthly_fee}
                    onChange={(e) =>
                      setFormData((p) => ({ ...p, monthly_fee: Number(e.target.value) }))
                    }
                    className="w-full bg-background border border-panel-border rounded-xl px-3 py-2 font-bold text-emerald-600 dark:text-emerald-400 focus:outline-none focus:ring-2 focus:ring-rose-500"
                  />
                </div>
              </div>

              <div>
                <label className="font-semibold block mb-1">
                  Desk Soundbox / Merchant UPI ID (for QR admissions)
                </label>
                <input
                  type="text"
                  placeholder="e.g. libraryname@paytm or @okicici"
                  value={formData.upi_id}
                  onChange={(e) => setFormData((p) => ({ ...p, upi_id: e.target.value }))}
                  className="w-full bg-background border border-panel-border rounded-xl px-3 py-2 text-text-main focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>

              <div className="pt-3 border-t border-panel-border flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-xl border border-panel-border font-semibold hover:bg-neutral-100 dark:hover:bg-neutral-800 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold shadow-sm transition disabled:opacity-50"
                >
                  {submitting ? "Onboarding..." : "Confirm & Launch Library"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Rate Modal */}
      {editingLibrary && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-card-bg border border-panel-border rounded-3xl p-6 max-w-sm w-full shadow-2xl animate-in fade-in zoom-in duration-150">
            <h3 className="font-extrabold text-base text-text-main mb-1">
              Adjust Monthly Rate
            </h3>
            <p className="text-xs text-text-muted mb-4">
              Set custom price or grandfathered discount for {editingLibrary.name}.
            </p>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-semibold block mb-1">Monthly Subscription (₹)</label>
                <input
                  type="number"
                  step="50"
                  value={newFee}
                  onChange={(e) => setNewFee(Number(e.target.value))}
                  className="w-full bg-background border border-panel-border rounded-xl px-3 py-2 text-base font-bold text-emerald-600 dark:text-emerald-400 focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>

              <label className="flex items-center gap-2 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={isLifetimeFixed}
                  onChange={(e) => setIsLifetimeFixed(e.target.checked)}
                  className="rounded text-rose-600 focus:ring-rose-500"
                />
                <span className="font-semibold text-text-main">
                  ⭐ Grandfather Lifetime Rate (VIP)
                </span>
              </label>

              <div className="pt-4 border-t border-panel-border flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingLibrary(null)}
                  className="px-3 py-1.5 rounded-xl border border-panel-border font-semibold hover:bg-neutral-100 dark:hover:bg-neutral-800 transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSavePrice}
                  className="px-4 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold transition"
                >
                  Save Rate
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
