"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface Stats {
  totalSeats: number;
  occupied: number;
  free: number;
  expiringSoon: number;
  monthRevenue: number;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [seats, setSeats] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<"free" | "partial" | "full">("free");
  const [loadingSeats, setLoadingSeats] = useState(true);

  useEffect(() => {
    fetch("/api/dashboard")
      .then((r) => r.json())
      .then(setStats);

    fetch("/api/seats")
      .then((r) => r.json())
      .then((data) => {
        setSeats(Array.isArray(data) ? data : []);
        setLoadingSeats(false);
      });
  }, []);

  if (!stats) return <p className="text-neutral-400 text-center py-10">Loading analytical metrics...</p>;

  const cards = [
    {
      label: "Total Seats",
      value: stats.totalSeats,
      color: "text-foreground",
      bgGlow: "from-neutral-500/5 to-transparent",
      borderColor: "border-card-border",
    },
    {
      label: "Occupied Seats",
      value: stats.occupied,
      color: "text-rose-600 dark:text-rose-400",
      bgGlow: "from-rose-500/10 to-transparent",
      borderColor: "border-rose-500/20",
    },
    {
      label: "Available Seats",
      value: stats.free,
      color: "text-emerald-600 dark:text-emerald-400",
      bgGlow: "from-emerald-500/10 to-transparent",
      borderColor: "border-emerald-500/20",
    },
    {
      label: "Expiring in 7 Days",
      value: stats.expiringSoon,
      color: "text-amber-700 dark:text-amber-400",
      bgGlow: "from-amber-500/10 to-transparent",
      borderColor: "border-amber-500/20",
    },
    {
      label: "This Month's Revenue",
      value: `₹${stats.monthRevenue}`,
      color: "text-blue-600 dark:text-blue-400",
      bgGlow: "from-blue-500/10 to-transparent",
      borderColor: "border-blue-500/20",
    },
  ];

  // Group seats by occupancy type
  const freeSeatsList = seats.filter((s) => !s.occupied);
  
  const partialSeatsList = seats.filter(
    (s) => s.occupied && s.receipts?.length === 1 && s.receipts[0].subscription_type === "half_day"
  );

  const fullSeatsList = seats.filter(
    (s) =>
      s.occupied &&
      (s.receipts?.some((r: any) => r.subscription_type === "full_day") || s.receipts?.length === 2)
  );

  return (
    <div className="space-y-8">
      {/* Metrics Section */}
      <div className="space-y-6">
        <div className="bg-panel-bg border border-panel-border rounded-2xl p-6 backdrop-blur-md">
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.5)]" />
            Executive Dashboard
          </h1>
          <p className="text-xs text-text-muted mt-1">Real-time status metrics and financial performance for The Target Library.</p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {cards.map((c) => (
            <div
              key={c.label}
              className={`bg-card-bg border ${c.borderColor} rounded-2xl p-6 relative overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-black/10`}
            >
              {/* Top-right corner gradient glow */}
              <div className={`absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl ${c.bgGlow} pointer-events-none`} />

              <p className="text-text-muted text-xs font-semibold tracking-wider uppercase mb-2">{c.label}</p>
              <p className={`text-3xl font-extrabold tracking-tight ${c.color}`}>{c.value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Seat Inventory Browser */}
      <div className="bg-panel-bg border border-panel-border rounded-2xl p-6 backdrop-blur-md space-y-4">
        <div>
          <h2 className="text-lg font-bold text-foreground">Seat Inventory Browser</h2>
          <p className="text-xs text-text-muted mt-0.5">Browse list of seat numbers filtered by current occupancy status.</p>
        </div>

        {/* Tab Selection */}
        <div className="flex gap-2 border-b border-panel-border pb-3 flex-wrap">
          <button
            onClick={() => setActiveTab("free")}
            className={`px-4 py-2 rounded-lg text-xs font-semibold border transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === "free"
                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
                : "border-transparent text-text-muted hover:text-foreground"
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            Available Seats ({freeSeatsList.length})
          </button>
          <button
            onClick={() => setActiveTab("partial")}
            className={`px-4 py-2 rounded-lg text-xs font-semibold border transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === "partial"
                ? "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30"
                : "border-transparent text-text-muted hover:text-foreground"
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-amber-500" />
            Half-Day Occupied ({partialSeatsList.length})
          </button>
          <button
            onClick={() => setActiveTab("full")}
            className={`px-4 py-2 rounded-lg text-xs font-semibold border transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === "full"
                ? "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30"
                : "border-transparent text-text-muted hover:text-foreground"
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
            Fully Occupied ({fullSeatsList.length})
          </button>
        </div>

        {loadingSeats ? (
          <p className="text-xs text-text-muted animate-pulse">Loading seat status directory...</p>
        ) : (
          <div>
            {activeTab === "free" && (
              <div className="space-y-2">
                <p className="text-[10px] uppercase font-extrabold tracking-wider text-text-muted">Available Seats</p>
                <div className="grid grid-cols-8 sm:grid-cols-12 md:grid-cols-16 gap-2 max-h-[400px] overflow-y-auto p-1">
                  {freeSeatsList.map((s) => (
                    <Link
                      key={s.seat_id}
                      href={`/?seat=${s.seat_number}`}
                      className="text-center font-mono text-xs font-semibold p-2 rounded-lg bg-emerald-500/5 hover:bg-emerald-500/10 border border-emerald-500/15 text-emerald-600 dark:text-emerald-400 cursor-pointer transition-all hover:scale-105"
                    >
                      {s.seat_number}
                    </Link>
                  ))}
                  {freeSeatsList.length === 0 && (
                    <p className="text-xs text-text-muted py-4 col-span-full">No available seats left.</p>
                  )}
                </div>
              </div>
            )}

            {activeTab === "partial" && (
              <div className="space-y-4">
                <p className="text-[10px] uppercase font-extrabold tracking-wider text-text-muted">Half-Day Seats (1 Active Subscription)</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 max-h-[400px] overflow-y-auto p-1">
                  {partialSeatsList.map((s) => {
                    const r = s.receipts[0];
                    return (
                      <Link
                        key={s.seat_id}
                        href={`/members/${r.student_id}`}
                        className="bg-card-bg border border-card-border hover:border-amber-500/40 p-4 rounded-xl flex justify-between items-center transition-all hover:-translate-y-0.5 shadow-sm group cursor-pointer"
                      >
                        <div>
                          <p className="text-sm font-bold text-foreground">Seat {s.seat_number}</p>
                          <p className="text-xs text-text-muted mt-1">
                            Occupant: <span className="font-semibold text-foreground group-hover:text-rose-600 dark:group-hover:text-rose-400 transition-colors">{r.member?.name}</span>
                          </p>
                        </div>
                        <span className="text-[10px] font-extrabold uppercase bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded">
                          {r.shift_type === "morning" ? "Morning" : "Evening"}
                        </span>
                      </Link>
                    );
                  })}
                  {partialSeatsList.length === 0 && (
                    <p className="text-xs text-text-muted py-4 col-span-full">No half-day seats currently booked.</p>
                  )}
                </div>
              </div>
            )}

            {activeTab === "full" && (
              <div className="space-y-4">
                <p className="text-[10px] uppercase font-extrabold tracking-wider text-text-muted">Fully Blocked Seats (Full-Day or 2 Shifts Booked)</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 max-h-[400px] overflow-y-auto p-1">
                  {fullSeatsList.map((s) => {
                    const isBothShifts = s.receipts?.length === 2;
                    return (
                      <div
                        key={s.seat_id}
                        className="bg-card-bg border border-card-border p-4 rounded-xl flex flex-col justify-between gap-3 shadow-sm hover:shadow-md transition-all"
                      >
                        <div className="flex justify-between items-center">
                          <p className="text-sm font-bold text-foreground">Seat {s.seat_number}</p>
                          <span className="text-[9px] font-extrabold uppercase bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 px-2 py-0.5 rounded tracking-wider">
                            {isBothShifts ? "2 Shifts Booked" : "Full Day"}
                          </span>
                        </div>
                        <div className="space-y-2">
                          {s.receipts.map((r: any, idx: number) => (
                            <Link
                              key={r.receipt_no}
                              href={`/members/${r.student_id}`}
                              className="block text-xs p-2 rounded-lg bg-background hover:bg-panel-bg border border-panel-border transition group cursor-pointer"
                            >
                              <div className="flex justify-between">
                                <span className="font-semibold text-foreground group-hover:text-rose-600 dark:group-hover:text-rose-400 transition-colors">
                                  {r.member?.name}
                                </span>
                                <span className="text-[10px] text-text-muted font-mono">
                                  ID: #{r.student_id}
                                </span>
                              </div>
                              {isBothShifts && (
                                <p className="text-[9px] text-text-muted mt-1 uppercase font-bold tracking-wider">
                                  Shift: {r.shift_type}
                                </p>
                              )}
                            </Link>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                  {fullSeatsList.length === 0 && (
                    <p className="text-xs text-text-muted py-4 col-span-full">No fully occupied seats currently booked.</p>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
