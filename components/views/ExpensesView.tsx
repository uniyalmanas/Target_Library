"use client";

import { Suspense, useEffect, useState, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { downloadCsv } from "@/lib/exportCsv";
import { getStoredSession, isSuperAdminAuthenticated, isOwnerAuthorizedForSlug } from "@/lib/auth";
import { isDemoSlug } from "@/lib/tenant";

interface ExpenseItem {
  id: string;
  title: string;
  category: "electricity" | "rent" | "wifi" | "water_tea" | "staff_salary" | "maintenance" | "misc";
  amount: number;
  payment_mode: "cash" | "online" | "upi";
  expense_date: string;
  notes?: string | null;
  created_at?: string;
}

interface ExpenseSummary {
  gross_collections: number;
  cash_collections?: number;
  online_collections?: number;
  total_expenses: number;
  net_profit: number;
  profit_margin: string;
  by_category: Record<string, number>;
  count?: number;
}

const CATEGORIES = [
  { id: "all", label: "All Categories", icon: "📋" },
  { id: "electricity", label: "Electricity & AC", icon: "⚡", color: "amber" },
  { id: "rent", label: "Property Rent", icon: "🏢", color: "indigo" },
  { id: "staff_salary", label: "Staff & Cleaning", icon: "🧹", color: "emerald" },
  { id: "wifi", label: "Commercial Wi-Fi", icon: "📶", color: "blue" },
  { id: "water_tea", label: "Drinking Water & Tea", icon: "💧", color: "cyan" },
  { id: "maintenance", label: "Repairs & Maintenance", icon: "🔧", color: "rose" },
  { id: "misc", label: "Miscellaneous", icon: "📦", color: "neutral" },
];

const PRESETS = [
  { title: "Commercial Electricity & AC Bill", category: "electricity", amount: 12500, mode: "online" },
  { title: "Monthly Study Hall Rent", category: "rent", amount: 25000, mode: "online" },
  { title: "Caretaker / Night Supervisor Salary", category: "staff_salary", amount: 9000, mode: "cash" },
  { title: "Housekeeping & Floor Mopping", category: "staff_salary", amount: 5000, mode: "cash" },
  { title: "Airtel / Jio Commercial Fiber Wi-Fi", category: "wifi", amount: 1999, mode: "online" },
  { title: "RO Drinking Water 20L Cans (30 Jars)", category: "water_tea", amount: 900, mode: "upi" },
  { title: "AC Gas Top-Up & Filter Service", category: "maintenance", amount: 2500, mode: "cash" },
  { title: "Desk Cleaning Cloths & Phenyl Supplies", category: "misc", amount: 650, mode: "cash" },
];

export function ExpensesContent({ tenantSlug }: { tenantSlug?: string }) {
  const searchParams = useSearchParams();
  const slug = tenantSlug || searchParams.get("slug") || "target-library";

  const [expenses, setExpenses] = useState<ExpenseItem[]>([]);
  const [summary, setSummary] = useState<ExpenseSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Filters
  const currentMonthStr = new Date().toISOString().slice(0, 7); // YYYY-MM
  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonthStr);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Add Expense Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalTitle, setModalTitle] = useState("");
  const [modalCategory, setModalCategory] = useState<string>("electricity");
  const [modalAmount, setModalAmount] = useState<string>("");
  const [modalMode, setModalMode] = useState<"cash" | "online" | "upi">("cash");
  const [modalDate, setModalDate] = useState<string>(new Date().toISOString().split("T")[0]);
  const [modalNotes, setModalNotes] = useState("");
  const [savingExpense, setSavingExpense] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Owner Authentication Gate (strictly restricts expenses & net profits from staff)
  const [isOwnerAuthenticated, setIsOwnerAuthenticated] = useState(false);
  const [checkingOwnerAuth, setCheckingOwnerAuth] = useState(true);
  const [ownerPassInput, setOwnerPassInput] = useState("");
  const [ownerPassError, setOwnerPassError] = useState("");
  const [unlockingOwner, setUnlockingOwner] = useState(false);

  // Close modal on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isModalOpen) {
        setIsModalOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isModalOpen]);

  useEffect(() => {
    if (isSuperAdminAuthenticated() || isOwnerAuthorizedForSlug(slug) || isDemoSlug(slug)) {
      setIsOwnerAuthenticated(true);
      setCheckingOwnerAuth(false);
      return;
    }

    const session = getStoredSession();
    const ownerAuth = sessionStorage.getItem("target_lib_owner_auth") || localStorage.getItem("target_lib_owner_auth");
    const isStaff = session?.role === "staff" && !session?.isMaster;
    const isOwnerRole = (session?.role === "owner" || session?.role === "superadmin" || session?.isMaster) && !isStaff;
    const isMatchingSlug = session?.librarySlug === slug || session?.role === "superadmin" || session?.isMaster;

    if (!isStaff && ((isOwnerRole && isMatchingSlug) || ownerAuth === "true")) {
      setIsOwnerAuthenticated(true);
    } else {
      setIsOwnerAuthenticated(false);
    }
    setCheckingOwnerAuth(false);
  }, [slug]);

  const handleUnlockOwner = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ownerPassInput.trim()) {
      setOwnerPassError("Please enter your owner passcode.");
      return;
    }

    setUnlockingOwner(true);
    setOwnerPassError("");

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug,
          role: "owner",
          password: ownerPassInput.trim(),
        }),
      });

      const data = await res.json();
      if (res.ok) {
        sessionStorage.setItem("target_lib_owner_auth", "true");
        localStorage.setItem("target_lib_owner_auth", "true");
        setIsOwnerAuthenticated(true);
      } else {
        setOwnerPassError(data.error || "Incorrect owner passcode. Access denied.");
      }
    } catch {
      setOwnerPassError("Authentication error. Please try again.");
    } finally {
      setUnlockingOwner(false);
    }
  };

  const fetchExpenses = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      let url = `/api/expenses?slug=${encodeURIComponent(slug)}`;
      if (selectedMonth && selectedMonth !== "all") {
        url += `&month=${selectedMonth}`;
      }
      if (selectedCategory && selectedCategory !== "all") {
        url += `&category=${selectedCategory}`;
      }

      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setExpenses(data.expenses || []);
        setSummary(data.summary || null);
      }
    } catch (err) {
      console.error("Failed to fetch expenses:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (isOwnerAuthenticated) {
      fetchExpenses();
    }
  }, [slug, selectedMonth, selectedCategory, isOwnerAuthenticated]);

  const handleApplyPreset = (preset: (typeof PRESETS)[0]) => {
    setModalTitle(preset.title);
    setModalCategory(preset.category);
    setModalAmount(preset.amount.toString());
    setModalMode(preset.mode as any);
  };

  const handleCreateExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalTitle.trim() || !modalAmount.trim()) {
      alert("Please enter title and amount.");
      return;
    }

    setSavingExpense(true);
    try {
      const res = await fetch("/api/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: modalTitle.trim(),
          category: modalCategory,
          amount: Number(modalAmount),
          payment_mode: modalMode,
          expense_date: modalDate,
          notes: modalNotes.trim() || null,
          slug,
        }),
      });

      if (res.ok) {
        setIsModalOpen(false);
        setModalTitle("");
        setModalAmount("");
        setModalNotes("");
        fetchExpenses(true);
      } else {
        const data = await res.json();
        alert(data.error || "Failed to record expense");
      }
    } catch (err: any) {
      alert(err.message || "Failed to record expense");
    } finally {
      setSavingExpense(false);
    }
  };

  const handleDeleteExpense = async (id: string, title: string) => {
    if (!confirm(`Are you sure you want to delete expense "${title}"?`)) return;

    setDeletingId(id);
    try {
      const res = await fetch(`/api/expenses?id=${encodeURIComponent(id)}&slug=${encodeURIComponent(slug)}`, {
        method: "DELETE",
      });

      if (res.ok) {
        setExpenses((prev) => prev.filter((e) => e.id !== id));
        fetchExpenses(true);
      } else {
        const data = await res.json();
        alert(data.error || "Failed to delete expense");
      }
    } catch (err: any) {
      alert(err.message || "Failed to delete expense");
    } finally {
      setDeletingId(null);
    }
  };

  // Filtered List
  const filteredExpenses = useMemo(() => {
    return expenses.filter((e) => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const titleMatch = e.title.toLowerCase().includes(q);
        const notesMatch = e.notes ? e.notes.toLowerCase().includes(q) : false;
        const catMatch = e.category.toLowerCase().includes(q);
        if (!titleMatch && !notesMatch && !catMatch) return false;
      }
      return true;
    });
  }, [expenses, searchQuery]);

  // Export CSV
  const exportCSV = () => {
    if (filteredExpenses.length === 0) {
      alert("No expenses to export.");
      return;
    }

    const headers = [
      "Expense Date",
      "Category",
      "Title / Description",
      "Payment Mode",
      "Amount (₹)",
      "Notes",
    ];

    const rows: (string | number)[][] = filteredExpenses.map((e) => [
      e.expense_date,
      CATEGORIES.find((c) => c.id === e.category)?.label || e.category,
      e.title,
      e.payment_mode.toUpperCase(),
      e.amount,
      e.notes || "",
    ]);

    // Add summary row
    const total = filteredExpenses.reduce((sum, e) => sum + Number(e.amount), 0);
    rows.push([]);
    rows.push([
      "TOTAL EXPENSES",
      "",
      `Total Count: ${filteredExpenses.length}`,
      "",
      total,
      `Exported on ${new Date().toISOString().split("T")[0]}`,
    ]);

    if (summary) {
      rows.push([
        "GROSS COLLECTIONS",
        "",
        "",
        "",
        summary.gross_collections,
        "",
      ]);
      rows.push([
        "NET IN-HAND PROFIT",
        "",
        "",
        "",
        summary.net_profit,
        `Margin: ${summary.profit_margin}%`,
      ]);
    }

    downloadCsv({
      filename: `${slug}_Expenses_${selectedMonth || "All"}.csv`,
      headers,
      rows,
    });
  };

  const getCategoryMeta = (cat: string) => {
    return CATEGORIES.find((c) => c.id === cat) || { id: cat, label: cat, icon: "📦", color: "neutral" };
  };

  if (checkingOwnerAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="w-8 h-8 border-3 border-rose-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!isOwnerAuthenticated) {
    return (
      <main className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
        <div className="bg-card-bg border border-panel-border rounded-3xl p-8 max-w-md w-full shadow-2xl space-y-5 text-center animate-in zoom-in-95">
          <div className="w-16 h-16 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-600 dark:text-amber-400 flex items-center justify-center text-3xl mx-auto shadow-inner">
            👑
          </div>

          <div>
            <h1 className="text-xl font-black text-text-main tracking-tight">
              Owner Credentials Required
            </h1>
            <p className="text-xs text-text-muted mt-1.5 leading-relaxed">
              Operational expenses, property rent, salaries, and real net profit margins are restricted strictly to the Library Owner. Desk staff do not have permission to view library profitability.
            </p>
          </div>

          <form onSubmit={handleUnlockOwner} className="space-y-4 text-left pt-1">
            <div className="space-y-1.5">
              <label className="text-[10px] font-extrabold uppercase tracking-wider text-text-muted block">
                Owner Passcode
              </label>
              <input
                type="password"
                placeholder="Enter owner password"
                value={ownerPassInput}
                onChange={(e) => {
                  setOwnerPassInput(e.target.value);
                  setOwnerPassError("");
                }}
                className="w-full bg-background border border-panel-border rounded-xl px-3.5 py-2.5 text-xs text-text-main focus:outline-none focus:ring-2 focus:ring-rose-500"
                autoFocus
              />
              {ownerPassError && (
                <p className="text-xs text-rose-600 dark:text-rose-400 font-bold">{ownerPassError}</p>
              )}
            </div>

            <div className="flex items-center gap-2 pt-2">
              <Link
                href={`/l/${slug}`}
                className="flex-1 px-4 py-2.5 rounded-xl border border-panel-border hover:bg-neutral-500/10 text-xs font-bold text-center text-text-muted hover:text-text-main transition"
              >
                ← Return to Desk
              </Link>
              <button
                type="submit"
                disabled={unlockingOwner}
                className="flex-1 px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-sm transition active:scale-95 disabled:opacity-50 cursor-pointer"
              >
                {unlockingOwner ? "Verifying..." : "Unlock Ledger"}
              </button>
            </div>
          </form>
        </div>
      </main>
    );
  }

  return (
    <div className="w-full max-w-[96vw] 2xl:max-w-[1750px] mx-auto px-4 md:px-8 py-6 space-y-6">
      {/* Top Banner & Header */}
      <div className="flex items-center justify-between flex-wrap gap-4 bg-panel-bg border border-panel-border rounded-2xl p-6 backdrop-blur-md">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.6)] animate-pulse" />
            <h1 className="text-2xl font-black tracking-tight text-foreground">
              Operating Expenses & Net Profit Ledger
            </h1>
          </div>
          <p className="text-xs text-text-muted mt-1">
            Track electricity bills, rent, Wi-Fi, staff salaries, and see your <strong>Real In-Hand Net Profit</strong> after deducting operational costs.
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {/* Month Selector */}
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="px-3.5 py-2 rounded-xl bg-card-bg border border-panel-border text-xs font-bold text-foreground cursor-pointer outline-hidden"
          >
            <option value="all">📅 All Time (Full History)</option>
            <option value="2026-09">📅 September 2026</option>
            <option value="2026-08">📅 August 2026</option>
            <option value="2026-07">📅 July 2026</option>
            <option value="2026-06">📅 June 2026</option>
          </select>

          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition shadow-md shadow-rose-600/20 active:scale-95 cursor-pointer"
          >
            <span>+</span> Record Expense
          </button>

          <button
            onClick={exportCSV}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition shadow-md shadow-emerald-600/20 cursor-pointer"
          >
            📥 Export CSV
          </button>

          <button
            onClick={() => fetchExpenses(true)}
            disabled={refreshing}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-panel-bg hover:bg-neutral-200 dark:hover:bg-neutral-800 text-text-details border border-panel-border text-xs font-bold transition cursor-pointer disabled:opacity-50"
          >
            <span className={refreshing ? "animate-spin" : ""}>🔄</span>
            {refreshing ? "Refreshing..." : "Refresh"}
          </button>
        </div>
      </div>

      {/* 4 Top KPI Cards: Revenue, Expenses, Net Profit, Margin */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Gross Collections */}
        <div className="bg-panel-bg border border-panel-border rounded-2xl p-5 shadow-xs relative overflow-hidden">
          <div className="text-[10px] font-black uppercase tracking-wider text-text-muted">
            1. Gross Fee Collections
          </div>
          <div className="text-3xl font-black text-foreground mt-1">
            ₹{summary?.gross_collections?.toLocaleString("en-IN") ?? 0}
          </div>
          <div className="flex items-center gap-2 text-[11px] text-text-muted mt-1">
            <span>💵 Cash: ₹{summary?.cash_collections?.toLocaleString("en-IN") ?? 0}</span>
            <span>&bull;</span>
            <span>📱 Online: ₹{summary?.online_collections?.toLocaleString("en-IN") ?? 0}</span>
          </div>
        </div>

        {/* Total Operating Expenses */}
        <div className="bg-panel-bg border border-panel-border rounded-2xl p-5 shadow-xs relative overflow-hidden">
          <div className="text-[10px] font-black uppercase tracking-wider text-rose-600 dark:text-rose-400">
            2. Total Operating Expenses
          </div>
          <div className="text-3xl font-black text-rose-600 dark:text-rose-400 mt-1">
            ₹{summary?.total_expenses?.toLocaleString("en-IN") ?? 0}
          </div>
          <div className="text-[11px] text-text-muted mt-1">
            {expenses.length} expense record{expenses.length === 1 ? "" : "s"} logged
          </div>
        </div>

        {/* Real Net In-Hand Profit */}
        <div className="bg-panel-bg border border-panel-border rounded-2xl p-5 shadow-xs relative overflow-hidden">
          <div className="text-[10px] font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
            3. Real Net In-Hand Profit
          </div>
          <div
            className={`text-3xl font-black mt-1 ${
              (summary?.net_profit ?? 0) >= 0
                ? "text-emerald-600 dark:text-emerald-400"
                : "text-rose-600 dark:text-rose-400"
            }`}
          >
            ₹{summary?.net_profit?.toLocaleString("en-IN") ?? 0}
          </div>
          <div className="text-[11px] text-text-muted mt-1">
            Collections minus total operational costs
          </div>
        </div>

        {/* Profit Margin % */}
        <div className="bg-panel-bg border border-panel-border rounded-2xl p-5 shadow-xs relative overflow-hidden">
          <div className="text-[10px] font-black uppercase tracking-wider text-blue-600 dark:text-blue-400">
            4. Net Profit Margin
          </div>
          <div className="text-3xl font-black text-blue-600 dark:text-blue-400 mt-1">
            {summary?.profit_margin ?? "0.0"}%
          </div>
          <div className="text-[11px] text-text-muted mt-1">
            Return on revenue after all bills
          </div>
        </div>
      </div>

      {/* Category Breakdown Tiles */}
      <div className="bg-panel-bg border border-panel-border rounded-2xl p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-black uppercase tracking-wider text-text-muted">
            Cost Breakdown by Category
          </h2>
          <span className="text-[11px] text-text-muted">
            Click any category pill below to filter records
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5">
          {CATEGORIES.filter((c) => c.id !== "all").map((cat) => {
            const amount = summary?.by_category?.[cat.id] || 0;
            const isSelected = selectedCategory === cat.id;

            return (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(isSelected ? "all" : cat.id)}
                className={`p-3 rounded-xl border text-left transition cursor-pointer ${
                  isSelected
                    ? "bg-rose-500/15 border-rose-500/50 shadow-sm"
                    : "bg-card-bg border-panel-border hover:bg-neutral-500/5"
                }`}
              >
                <div className="text-base">{cat.icon}</div>
                <div className="text-[10px] font-bold text-text-muted mt-1 line-clamp-1">
                  {cat.label}
                </div>
                <div className="text-sm font-black text-text-main mt-0.5 font-mono">
                  ₹{amount.toLocaleString("en-IN")}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Toolbar: Category Filters & Search */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-panel-bg border border-panel-border rounded-2xl p-4">
        <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
          {CATEGORIES.map((c) => (
            <button
              key={c.id}
              onClick={() => setSelectedCategory(c.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
                selectedCategory === c.id
                  ? "bg-rose-600 text-white shadow-xs"
                  : "bg-card-bg border border-panel-border text-text-muted hover:text-text-main"
              }`}
            >
              {c.icon} {c.label}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-64">
          <input
            type="text"
            placeholder="Search expenses..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl bg-card-bg border border-panel-border text-foreground placeholder:text-text-muted focus:outline-none focus:border-rose-500"
          />
          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-text-muted">🔍</span>
        </div>
      </div>

      {/* Expense Records List */}
      <div className="bg-panel-bg border border-panel-border rounded-2xl overflow-hidden shadow-xs">
        <div className="px-6 py-4 border-b border-panel-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-xs font-black uppercase tracking-wider text-text-main">
              Expense Transactions ({filteredExpenses.length})
            </h2>
            {selectedCategory !== "all" && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-600 border border-rose-500/20">
                Filtered: {CATEGORIES.find((c) => c.id === selectedCategory)?.label}
              </span>
            )}
          </div>
          <span className="text-xs text-text-muted font-mono">
            Sum: <strong>₹{filteredExpenses.reduce((sum, e) => sum + Number(e.amount), 0).toLocaleString("en-IN")}</strong>
          </span>
        </div>

        {loading ? (
          <div className="py-16 text-center text-xs text-text-muted flex items-center justify-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping inline-block" />
            Loading operating costs...
          </div>
        ) : filteredExpenses.length === 0 ? (
          <div className="py-16 text-center space-y-3">
            <div className="text-4xl">🧾</div>
            <h3 className="text-sm font-black text-text-main">No expense records found</h3>
            <p className="text-xs text-text-muted max-w-sm mx-auto">
              {expenses.length === 0
                ? "You haven't logged any operational expenses for this period yet. Click 'Record Expense' to add electricity, rent, staff salary, etc."
                : "No expenses match the current filter or search criteria."}
            </p>
            {expenses.length === 0 && (
              <button
                onClick={() => setIsModalOpen(true)}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition inline-block cursor-pointer shadow-sm"
              >
                + Record First Expense
              </button>
            )}
          </div>
        ) : (
          <div className="divide-y divide-panel-border">
            {filteredExpenses.map((exp) => {
              const meta = getCategoryMeta(exp.category);

              return (
                <div
                  key={exp.id}
                  className="px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-neutral-500/5 transition group"
                >
                  <div className="flex items-start sm:items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-card-bg border border-panel-border flex items-center justify-center text-xl shrink-0">
                      {meta.icon}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="text-sm font-extrabold text-foreground truncate">{exp.title}</h4>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-neutral-500/10 text-text-muted border border-panel-border">
                          {meta.label}
                        </span>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-md border capitalize ${
                            exp.payment_mode === "online"
                              ? "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20"
                              : exp.payment_mode === "upi"
                              ? "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20"
                              : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                          }`}
                        >
                          {exp.payment_mode === "online" ? "📱 Online" : exp.payment_mode === "upi" ? "⚡ UPI" : "💵 Cash"}
                        </span>
                      </div>

                      <div className="flex items-center gap-3 text-[11px] text-text-muted mt-1">
                        <span>📅 {exp.expense_date}</span>
                        {exp.notes && (
                          <>
                            <span>&bull;</span>
                            <span className="italic truncate max-w-md">“{exp.notes}”</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-4 shrink-0 pl-13 sm:pl-0">
                    <span className="text-base font-black text-rose-600 dark:text-rose-400 font-mono">
                      -₹{Number(exp.amount).toLocaleString("en-IN")}
                    </span>

                    <button
                      onClick={() => handleDeleteExpense(exp.id, exp.title)}
                      disabled={deletingId === exp.id}
                      className="opacity-0 group-hover:opacity-100 p-2 rounded-lg text-text-muted hover:text-rose-600 hover:bg-rose-500/10 text-xs transition cursor-pointer disabled:opacity-50"
                      title="Delete expense"
                    >
                      {deletingId === exp.id ? "..." : "🗑️"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Record Expense Modal */}
      {isModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div className="bg-card-bg border border-panel-border rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden animate-in zoom-in-95">
            <div className="p-6 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-panel-border">
                <div className="flex items-center gap-2">
                  <span className="text-xl">🧾</span>
                  <h3 className="text-base font-extrabold text-foreground">Record Operating Expense</h3>
                </div>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="w-8 h-8 rounded-full bg-neutral-500/10 hover:bg-neutral-500/20 text-text-muted flex items-center justify-center text-xs transition cursor-pointer"
                >
                  ✕
                </button>
              </div>

              {/* Quick Presets Pills */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-wider text-text-muted block">
                  Quick Presets
                </label>
                <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                  {PRESETS.map((p, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleApplyPreset(p)}
                      className="px-2.5 py-1 rounded-lg bg-neutral-500/5 hover:bg-rose-500/10 text-text-main hover:text-rose-600 border border-panel-border text-[11px] font-bold transition whitespace-nowrap cursor-pointer shrink-0"
                    >
                      {p.title.split(" ")[0]} (₹{p.amount})
                    </button>
                  ))}
                </div>
              </div>

              <form onSubmit={handleCreateExpense} className="space-y-3.5 pt-1">
                {/* Title */}
                <div>
                  <label className="block text-xs font-bold text-text-muted mb-1">Expense Title / Description *</label>
                  <input
                    type="text"
                    placeholder="e.g. Commercial Electricity & AC Bill"
                    value={modalTitle}
                    onChange={(e) => setModalTitle(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-background border border-panel-border text-xs text-foreground focus:outline-none focus:border-rose-500"
                    required
                    autoFocus
                  />
                </div>

                {/* Category Selector */}
                <div>
                  <label className="block text-xs font-bold text-text-muted mb-1">Category *</label>
                  <select
                    value={modalCategory}
                    onChange={(e) => setModalCategory(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-background border border-panel-border text-xs text-foreground focus:outline-none focus:border-rose-500 cursor-pointer"
                  >
                    {CATEGORIES.filter((c) => c.id !== "all").map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.icon} {cat.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Amount & Date */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-text-muted mb-1">Amount (₹) *</label>
                    <input
                      type="number"
                      min="1"
                      step="1"
                      placeholder="e.g. 12500"
                      value={modalAmount}
                      onChange={(e) => setModalAmount(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-background border border-panel-border text-xs font-mono font-bold text-foreground focus:outline-none focus:border-rose-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-text-muted mb-1">Expense Date *</label>
                    <input
                      type="date"
                      value={modalDate}
                      onChange={(e) => setModalDate(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-background border border-panel-border text-xs font-mono text-foreground focus:outline-none focus:border-rose-500"
                      required
                    />
                  </div>
                </div>

                {/* Payment Mode */}
                <div>
                  <label className="block text-xs font-bold text-text-muted mb-1">Payment Mode</label>
                  <div className="grid grid-cols-3 gap-2">
                    {(["cash", "online", "upi"] as const).map((mode) => (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => setModalMode(mode)}
                        className={`py-2 px-3 rounded-xl text-xs font-bold border transition cursor-pointer capitalize ${
                          modalMode === mode
                            ? "bg-rose-600 text-white border-rose-600 shadow-xs"
                            : "bg-background border-panel-border text-text-muted hover:text-foreground"
                        }`}
                      >
                        {mode === "cash" ? "💵 Cash" : mode === "upi" ? "⚡ UPI" : "📱 Online"}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Notes */}
                <div>
                  <label className="block text-xs font-bold text-text-muted mb-1">Notes / Receipt Ref (Optional)</label>
                  <textarea
                    rows={2}
                    placeholder="e.g. Electricity bill receipt #EB-92019, paid to landlord"
                    value={modalNotes}
                    onChange={(e) => setModalNotes(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-background border border-panel-border text-xs text-foreground focus:outline-none focus:border-rose-500 resize-none"
                  />
                </div>

                {/* Modal Actions */}
                <div className="flex items-center justify-end gap-2 pt-2 border-t border-panel-border">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-4 py-2 rounded-xl bg-neutral-500/10 hover:bg-neutral-500/20 text-xs font-bold text-text-muted transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={savingExpense}
                    className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition shadow-md shadow-rose-600/20 cursor-pointer disabled:opacity-50"
                  >
                    {savingExpense ? "Saving..." : "Record Expense"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ExpensesView({ tenantSlug }: { tenantSlug?: string }) {
  return (
    <Suspense fallback={<div className="p-12 text-center text-xs text-text-muted">Loading expense ledger...</div>}>
      <ExpensesContent tenantSlug={tenantSlug} />
    </Suspense>
  );
}
