"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface Stats {
  totalSeats: number;
  occupied: number;
  free: number;
  expiringSoon: number;
  monthRevenue: number;
  lifetimeRevenue: number;
  activeMonthlyRevenue: number;
  revenueTrend: { month: string; revenue: number }[];
  monthlyBreakdown: { month: string; total: number; count: number }[];
  shiftCounts: { full_day: number; shift_1: number; shift_2: number; shift_3: number };
  hourlyOccupancy: { period: string; count: number }[];
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [seats, setSeats] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<"free" | "partial" | "full">("free");
  const [activeDashboardTab, setActiveDashboardTab] = useState<"overview" | "logs">("overview");
  const [loadingSeats, setLoadingSeats] = useState(true);
  const [hoveredPoint, setHoveredPoint] = useState<any | null>(null);

  // Owner Authentication States
  const [ownerPassword, setOwnerPassword] = useState("");
  const [isOwnerAuthenticated, setIsOwnerAuthenticated] = useState(false);
  const [ownerError, setOwnerError] = useState("");
  const [checkingOwner, setCheckingOwner] = useState(true);

  useEffect(() => {
    const ownerAuth = sessionStorage.getItem("target_lib_owner_auth");
    const correctOwnerPassword = process.env.NEXT_PUBLIC_OWNER_PASSWORD || "TargetOwner2026";
    const isValid = ownerAuth === "true" || ownerAuth === correctOwnerPassword;
    
    if (isValid) {
      setIsOwnerAuthenticated(true);
      setCheckingOwner(false);
      
      fetch("/api/dashboard", {
        headers: { "x-owner-auth": ownerAuth || "true" }
      })
        .then((r) => r.json())
        .then(setStats);

      fetch("/api/seats")
        .then((r) => r.json())
        .then((data) => {
          setSeats(Array.isArray(data) ? data : []);
          setLoadingSeats(false);
        });
    } else {
      setCheckingOwner(false);
    }
  }, [isOwnerAuthenticated]);

  if (checkingOwner) {
    return <p className="text-neutral-400 text-center py-10">Verifying dashboard permissions...</p>;
  }

  if (!isOwnerAuthenticated) {
    return (
      <div className="flex items-center justify-center min-h-[50vh] px-4">
        <form 
          onSubmit={(e) => {
            e.preventDefault();
            const correctOwnerPassword = process.env.NEXT_PUBLIC_OWNER_PASSWORD || "TargetOwner2026";
            if (ownerPassword === correctOwnerPassword) {
              sessionStorage.setItem("target_lib_owner_auth", "true");
              setIsOwnerAuthenticated(true);
            } else {
              setOwnerError("Incorrect owner passcode. Access denied.");
            }
          }}
          className="bg-panel-bg border border-panel-border rounded-2xl p-8 w-full max-w-sm shadow-2xl relative overflow-hidden backdrop-blur-md space-y-4"
        >
          <div className="absolute top-0 right-0 w-24 h-24 bg-radial from-rose-500/10 to-transparent pointer-events-none" />
          <div className="text-center">
            <span className="text-2xl">🔒</span>
            <h2 className="text-lg font-bold text-foreground mt-2">Owner Credentials Required</h2>
            <p className="text-xs text-text-muted mt-1">Enter owner password to unlock financial statistics and metrics.</p>
          </div>
          
          <div className="space-y-1.5">
            <label className="block text-[10px] font-extrabold uppercase tracking-wider text-text-muted">
              Owner Password
            </label>
            <input
              type="password"
              value={ownerPassword}
              onChange={(e) => {
                setOwnerPassword(e.target.value);
                setOwnerError("");
              }}
              placeholder="••••••••"
              required
              className="w-full bg-background border border-panel-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-rose-500 transition-all font-mono"
            />
          </div>

          {ownerError && (
            <p className="text-rose-600 dark:text-rose-400 text-xs font-semibold">
              ⚠️ {ownerError}
            </p>
          )}

          <button
            type="submit"
            className="w-full bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs py-2.5 rounded-lg transition-all active:scale-95 cursor-pointer"
          >
            Unlock Dashboard
          </button>
        </form>
      </div>
    );
  }

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
      label: "This Month's Earnings",
      value: `₹${stats.monthRevenue.toLocaleString()}`,
      color: "text-blue-600 dark:text-blue-400",
      bgGlow: "from-blue-500/10 to-transparent",
      borderColor: "border-blue-500/20",
    },
    {
      label: "Monthly Run Rate",
      value: `₹${stats.activeMonthlyRevenue.toLocaleString()}`,
      color: "text-teal-600 dark:text-teal-400",
      bgGlow: "from-teal-500/10 to-transparent",
      borderColor: "border-teal-500/20",
    },
    {
      label: "Total Collections",
      value: `₹${stats.lifetimeRevenue.toLocaleString()}`,
      color: "text-purple-600 dark:text-purple-400",
      bgGlow: "from-purple-500/10 to-transparent",
      borderColor: "border-purple-500/20",
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

  // SVG Area Chart Calculations (Rolling 6-month trends)
  const trend = stats.revenueTrend || [];
  const maxRevenue = Math.max(...trend.map((t) => t.revenue), 1000);
  const chartHeight = 160;
  const chartWidth = 460;
  
  const points = trend.map((t, idx) => {
    const x = trend.length > 1 ? (idx / (trend.length - 1)) * (chartWidth - 80) + 50 : 50;
    const y = chartHeight - (t.revenue / maxRevenue) * 110 - 20;
    return { x, y, label: t.month, value: t.revenue };
  });

  const pathD = points.length > 0 ? `M ${points.map((p) => `${p.x},${p.y}`).join(" L ")}` : "";
  const fillD = points.length > 0 ? `${pathD} L ${points[points.length - 1].x},${chartHeight - 10} L ${points[0].x},${chartHeight - 10} Z` : "";

  // Shift counts progress items
  const shiftList = [
    { name: "Full Day Pass", count: stats.shiftCounts?.full_day || 0, color: "bg-rose-500", text: "text-rose-600 dark:text-rose-400" },
    { name: "Shift 1 (6am - 2pm)", count: stats.shiftCounts?.shift_1 || 0, color: "bg-emerald-500", text: "text-emerald-600 dark:text-emerald-400" },
    { name: "Shift 2 (2pm - 12am)", count: stats.shiftCounts?.shift_2 || 0, color: "bg-amber-500", text: "text-amber-600 dark:text-amber-400" },
    { name: "Shift 3 (4pm - 12am)", count: stats.shiftCounts?.shift_3 || 0, color: "bg-blue-500", text: "text-blue-600 dark:text-blue-400" },
  ];
  const maxShiftCount = Math.max(...shiftList.map((s) => s.count), 1);

  // Hourly load Timeline variables
  const occupancyList = stats.hourlyOccupancy || [];
  const maxOccupancyCount = stats.totalSeats || 297;

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

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-4">
          {cards.map((c) => (
            <div
              key={c.label}
              className={`bg-card-bg border ${c.borderColor} rounded-2xl p-6 relative overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-black/10`}
            >
              <div className={`absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl ${c.bgGlow} pointer-events-none`} />
              <p className="text-text-muted text-xs font-semibold tracking-wider uppercase mb-2">{c.label}</p>
              <p className={`text-3xl font-extrabold tracking-tight ${c.color}`}>{c.value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Analytics Tabs Selector */}
      <div className="flex gap-2 border-b border-panel-border pb-3 flex-wrap">
        <button
          onClick={() => setActiveDashboardTab("overview")}
          className={`px-4 py-2 rounded-lg text-xs font-semibold border transition cursor-pointer flex items-center gap-1.5 ${
            activeDashboardTab === "overview"
              ? "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30"
              : "border-transparent text-text-muted hover:text-foreground"
          }`}
        >
          📊 Analytics Overview
        </button>
        <button
          onClick={() => setActiveDashboardTab("logs")}
          className={`px-4 py-2 rounded-lg text-xs font-semibold border transition cursor-pointer flex items-center gap-1.5 ${
            activeDashboardTab === "logs"
              ? "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30"
              : "border-transparent text-text-muted hover:text-foreground"
          }`}
        >
          📜 Monthly Collection Logs
        </button>
      </div>

      {/* Dynamic Tab Content */}
      {activeDashboardTab === "overview" ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Revenue Growth Trend Chart */}
          <div className="bg-panel-bg border border-panel-border rounded-2xl p-6 backdrop-blur-md flex flex-col justify-between relative overflow-hidden min-h-[300px]">
            <div className="absolute top-0 right-0 w-32 h-32 bg-radial from-blue-500/5 to-transparent pointer-events-none" />
            <div className="mb-4">
              <h2 className="text-base font-bold text-foreground">Revenue Performance &amp; Growth</h2>
              <p className="text-[10px] text-text-muted mt-0.5">Rolling 6-month monthly collections trend.</p>
            </div>

            <div className="relative w-full flex-1 min-h-[160px] flex items-center justify-center">
              {points.length > 0 ? (
                <svg className="w-full h-[160px] overflow-visible" viewBox={`0 0 ${chartWidth} ${chartHeight}`}>
                  <defs>
                    <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.25"/>
                      <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.0"/>
                    </linearGradient>
                  </defs>
                  {/* Horizontal reference grid lines */}
                  <line x1="40" y1="30" x2={chartWidth - 20} y2="30" className="stroke-panel-border/40" strokeDasharray="3 3" />
                  <line x1="40" y1="85" x2={chartWidth - 20} y2="85" className="stroke-panel-border/40" strokeDasharray="3 3" />
                  <line x1="40" y1="140" x2={chartWidth - 20} y2="140" className="stroke-panel-border" />

                  {/* Y-Axis Labels */}
                  <text x="30" y="34" className="text-[8px] font-bold text-text-muted fill-current text-right" textAnchor="end">₹{maxRevenue}</text>
                  <text x="30" y="89" className="text-[8px] font-bold text-text-muted fill-current text-right" textAnchor="end">₹{Math.round(maxRevenue / 2)}</text>
                  <text x="30" y="144" className="text-[8px] font-bold text-text-muted fill-current text-right" textAnchor="end">₹0</text>

                  {/* Gradient Area Fill */}
                  {fillD && <path d={fillD} fill="url(#areaGrad)" />}
                  {/* Stroke Line */}
                  {pathD && <path d={pathD} fill="none" stroke="#3b82f6" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />}

                  {/* Interactive circles */}
                  {points.map((p, idx) => (
                    <g key={idx}>
                      <circle
                        cx={p.x}
                        cy={p.y}
                        r="4"
                        className="fill-blue-500 stroke-card-bg stroke-2 cursor-pointer transition-all duration-150 hover:r-6"
                        onMouseEnter={() => setHoveredPoint(p)}
                        onMouseLeave={() => setHoveredPoint(null)}
                      />
                      <text
                        x={p.x}
                        y="155"
                        className="text-[8px] font-bold text-text-muted fill-current text-center"
                        textAnchor="middle"
                      >
                        {p.label.split(" ")[0]}
                      </text>
                    </g>
                  ))}
                </svg>
              ) : (
                <p className="text-xs text-text-muted">No historical transactions available.</p>
              )}

              {/* Hover values tooltip */}
              {hoveredPoint && (
                <div
                  className="absolute bg-neutral-900 border border-neutral-800 text-white rounded-lg p-2 text-[10px] pointer-events-none shadow-xl flex flex-col font-semibold gap-0.5"
                  style={{
                    left: `${(hoveredPoint.x / chartWidth) * 90}%`,
                    top: `${(hoveredPoint.y / chartHeight) * 50}%`,
                  }}
                >
                  <span>{hoveredPoint.label}</span>
                  <span className="text-blue-400 font-extrabold">₹{hoveredPoint.value}</span>
                </div>
              )}
            </div>
          </div>

          {/* Occupancy Shifts & Timeline Peak */}
          <div className="bg-panel-bg border border-panel-border rounded-2xl p-6 backdrop-blur-md flex flex-col justify-between min-h-[300px]">
            <div>
              <h2 className="text-base font-bold text-foreground">Shift Popularity &amp; Allocations</h2>
              <p className="text-[10px] text-text-muted mt-0.5">Ratio of active study slots booked per shift.</p>
            </div>

            <div className="space-y-4 my-auto">
              {shiftList.map((s) => (
                <div key={s.name} className="space-y-1">
                  <div className="flex justify-between text-xs font-semibold">
                    <span className="text-text-details">{s.name}</span>
                    <span className={`${s.text} font-bold`}>{s.count} active</span>
                  </div>
                  <div className="h-2 w-full bg-neutral-200 dark:bg-neutral-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${s.color} transition-all duration-700 ease-out rounded-full`}
                      style={{ width: `${(s.count / maxShiftCount) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="pt-4 border-t border-panel-border">
              <p className="text-[9px] uppercase font-bold tracking-widest text-text-muted mb-2.5">Hourly Peak Occupancy timeline</p>
              <div className="grid grid-cols-3 gap-2.5">
                {occupancyList.map((o) => {
                  const percentage = Math.round((o.count / maxOccupancyCount) * 100);
                  return (
                    <div key={o.period} className="bg-background border border-card-border p-3.5 rounded-xl flex flex-col justify-between shadow-sm relative overflow-hidden group">
                      <div className="absolute top-0 left-0 h-[2px] bg-gradient-to-r from-blue-500 to-rose-500 transition-all duration-300" style={{ width: `${percentage}%` }} />
                      <p className="text-[9px] font-bold text-foreground truncate">{o.period.split(" ")[0]}</p>
                      <div className="mt-2.5 flex justify-between items-baseline">
                        <span className="text-base font-extrabold tracking-tight text-foreground">{percentage}%</span>
                        <span className="text-[8px] text-text-muted font-bold font-mono">{o.count}/{maxOccupancyCount}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* Monthly Collection Logs Table (Visible only when clicked) */
        <div className="bg-panel-bg border border-panel-border rounded-2xl p-6 backdrop-blur-md relative overflow-hidden space-y-4">
          <div className="absolute top-0 right-0 w-32 h-32 bg-radial from-rose-500/5 to-transparent pointer-events-none" />
          <div>
            <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Monthly Collection Logs
            </h2>
            <p className="text-xs text-text-muted mt-0.5">Chronological summary of all-time sales receipts and pass counts.</p>
          </div>
          
          <div className="overflow-x-auto border border-panel-border/30 rounded-xl">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-panel-border bg-background/50 text-[10px] font-extrabold uppercase text-text-muted tracking-wider">
                  <th className="p-3.5">Billing Month</th>
                  <th className="p-3.5">Passes Sold</th>
                  <th className="p-3.5 text-right">Total Revenue</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-panel-border/30">
                {stats.monthlyBreakdown?.map((item: any) => (
                  <tr key={item.month} className="hover:bg-panel-bg/30 transition-colors">
                    <td className="p-3.5 font-semibold text-foreground">{item.month}</td>
                    <td className="p-3.5 text-text-details">{item.count} receipts</td>
                    <td className="p-3.5 font-mono font-bold text-emerald-600 dark:text-emerald-400 text-right">
                      ₹{item.total.toLocaleString()}
                    </td>
                  </tr>
                ))}
                {(!stats.monthlyBreakdown || stats.monthlyBreakdown.length === 0) && (
                  <tr>
                    <td colSpan={3} className="p-4 text-center text-text-muted">No historical transactions available.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

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
            Half-day Occupied ({partialSeatsList.length})
          </button>
          <button
            onClick={() => setActiveTab("full")}
            className={`px-4 py-2 rounded-lg text-xs font-semibold border transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === "full"
                ? "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30"
                : "border-transparent text-text-muted hover:text-foreground"
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-rose-500" />
            Fully Blocked ({fullSeatsList.length})
          </button>
        </div>

        {/* Tab Panels */}
        {loadingSeats ? (
          <p className="text-xs text-text-muted animate-pulse">Loading seat status index...</p>
        ) : (
          <div className="pt-2">
            {activeTab === "free" && (
              <div className="space-y-4">
                <p className="text-[10px] uppercase font-bold tracking-wider text-text-muted">Unoccupied Seats (Available for all shifts)</p>
                <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-2.5 max-h-[350px] overflow-y-auto p-1">
                  {freeSeatsList.map((s) => (
                    <Link
                      key={s.seat_id}
                      href={`/new-receipt?seat_number=${s.seat_number}`}
                      className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 hover:border-emerald-500/40 px-3 py-2.5 rounded-xl font-bold text-center text-xs transition-all hover:-translate-y-0.5 shadow-sm hover:shadow-emerald-500/10 flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <span className="text-[10px]">🪑</span> Seat {s.seat_number}
                    </Link>
                  ))}
                  {freeSeatsList.length === 0 && (
                    <p className="text-xs text-text-muted py-4 col-span-full">No available seats left!</p>
                  )}
                </div>
              </div>
            )}

            {activeTab === "partial" && (
              <div className="space-y-4">
                <p className="text-[10px] uppercase font-bold tracking-wider text-text-muted">Partially Blocked Seats (Only 1 Shift Occupied)</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5 max-h-[350px] overflow-y-auto p-1">
                  {partialSeatsList.map((s) => {
                    const r = s.receipts[0];
                    return (
                      <Link
                        key={s.seat_id}
                        href={`/members/${r.student_id}`}
                        className="bg-amber-500/5 hover:bg-amber-500/10 border border-amber-500/15 hover:border-amber-500/35 p-4 rounded-2xl flex justify-between items-center transition-all hover:-translate-y-0.5 shadow-sm hover:shadow-amber-500/5 group cursor-pointer"
                      >
                        <div className="space-y-1">
                          <p className="text-xs text-text-muted">Seat number</p>
                          <p className="text-base font-extrabold text-foreground flex items-center gap-1.5">
                            <span className="text-sm">🪑</span> {s.seat_number}
                          </p>
                          <p className="text-[11px] text-text-details font-medium mt-1">
                            Occupant: <span className="font-semibold text-foreground group-hover:text-amber-500 transition-colors">{r.member?.name}</span>
                          </p>
                        </div>
                        <span className="text-[9px] font-extrabold uppercase bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/25 px-2.5 py-1 rounded-full tracking-wider">
                          {r.shift_type === "shift_1" || r.shift_type === "morning" ? "Shift 1" : r.shift_type === "shift_2" || r.shift_type === "evening" ? "Shift 2" : "Shift 3"}
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
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5 max-h-[350px] overflow-y-auto p-1">
                  {fullSeatsList.map((s) => {
                    const isBothShifts = s.receipts?.length === 2;
                    return (
                      <div
                        key={s.seat_id}
                        className="bg-rose-500/5 border border-rose-500/15 p-4 rounded-2xl flex flex-col justify-between gap-3.5 shadow-sm"
                      >
                        <div className="flex justify-between items-center">
                          <p className="text-base font-extrabold text-foreground flex items-center gap-1.5">
                            <span className="text-sm">🪑</span> Seat {s.seat_number}
                          </p>
                          <span className="text-[9px] font-extrabold uppercase bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/25 px-2.5 py-1 rounded-full tracking-wider">
                            {isBothShifts ? "2 Shifts Booked" : "Full Day"}
                          </span>
                        </div>
                        <div className="space-y-2">
                          {s.receipts.map((r: any, idx: number) => (
                            <Link
                              key={r.receipt_no}
                              href={`/members/${r.student_id}`}
                              className="block text-xs p-3 rounded-xl bg-background/50 hover:bg-rose-500/5 border border-panel-border hover:border-rose-500/25 transition group cursor-pointer"
                            >
                              <div className="flex justify-between">
                                <span className="font-bold text-foreground group-hover:text-rose-500 transition-colors">
                                  {r.member?.name}
                                </span>
                                <span className="text-[10px] text-text-muted font-mono">
                                  ID: #{r.student_id}
                                </span>
                              </div>
                              {isBothShifts && (
                                <p className="text-[9px] text-text-muted mt-1.5 uppercase font-bold tracking-wider">
                                  Shift: {r.shift_type === "shift_1" || r.shift_type === "morning" ? "Shift 1" : r.shift_type === "shift_2" || r.shift_type === "evening" ? "Shift 2" : "Shift 3"}
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
