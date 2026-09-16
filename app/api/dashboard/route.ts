import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { getLibraryBySlug, getLibrarySettings, DEFAULT_SHIFTS } from "@/lib/tenant";
import { ShiftConfig } from "@/lib/types";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const slug = searchParams.get("slug");

    let libraryId = "00000000-0000-0000-0000-000000000001";
    let configuredTotalSeats: number | null = null;
    let librarySettings: any = null;

    if (slug) {
      try {
        const library = await getLibraryBySlug(slug);
        libraryId = library.id;
        librarySettings = await getLibrarySettings(library.id);
        if (librarySettings?.total_seats) {
          configuredTotalSeats = librarySettings.total_seats;
        }
      } catch {
        // ignore
      }
    } else {
      librarySettings = await getLibrarySettings(libraryId);
      if (librarySettings?.total_seats) {
        configuredTotalSeats = librarySettings.total_seats;
      }
    }

    const ownerAuthHeader = req.headers.get("x-owner-auth");
    const correctOwnerPassword = process.env.NEXT_PUBLIC_OWNER_PASSWORD || "TargetOwner2026";
    if (ownerAuthHeader !== "true" && ownerAuthHeader !== correctOwnerPassword && ownerAuthHeader !== "staff") {
      return NextResponse.json({ error: "Unauthorized access to financial data" }, { status: 401 });
    }

    // Timezone-safe date calculations
    const today = new Date();
    const todayYear = today.getFullYear();
    const todayMonth = String(today.getMonth() + 1).padStart(2, "0");
    const todayStr = `${todayYear}-${todayMonth}-${String(today.getDate()).padStart(2, "0")}`;

    const in7 = new Date(today);
    in7.setDate(in7.getDate() + 7);
    const in7Year = in7.getFullYear();
    const in7Month = String(in7.getMonth() + 1).padStart(2, "0");
    const in7Str = `${in7Year}-${in7Month}-${String(in7.getDate()).padStart(2, "0")}`;

    // Get total seat capacity
    let totalSeats = configuredTotalSeats;
    if (!totalSeats) {
      const { count } = await supabase
        .from("seats")
        .select("*", { count: "exact", head: true })
        .eq("library_id", libraryId);
      totalSeats = count || 50;
    }

    // Fetch receipts strictly for this library
    let query = supabase
      .from("receipts")
      .select("seat_id, amount_paid, start_date, end_date, subscription_type, shift_type, is_vacated")
      .eq("library_id", libraryId);

    let { data: receipts, error: receiptsError } = await query;

    if (receiptsError && (receiptsError.code === "42703" || receiptsError.message?.includes("is_vacated"))) {
      const fallback = await supabase
        .from("receipts")
        .select("seat_id, amount_paid, start_date, end_date, subscription_type, shift_type")
        .eq("library_id", libraryId);
      receipts = fallback.data as any;
      receiptsError = fallback.error;
    }

    if (receiptsError) return NextResponse.json({ error: receiptsError.message }, { status: 500 });

    const safeReceipts = receipts ?? [];

    // Cutoff for overdue candidate tracking (45 days)
    const cutoffDateObj = new Date();
    cutoffDateObj.setDate(cutoffDateObj.getDate() - 45);
    const cutoffDateStr = cutoffDateObj.toISOString().split("T")[0];

    // 1. Active receipts
    const activeReceipts = safeReceipts.filter((r) => r.end_date >= todayStr && (r as any).is_vacated !== true);
    const occupiedSeatIds = new Set(activeReceipts.map((r) => r.seat_id));
    const occupied = occupiedSeatIds.size;
    const free = Math.max(0, (totalSeats ?? 0) - occupied);

    // 2. Overdue receipts (Due Fees)
    const dueReceipts = safeReceipts.filter(
      (r) => r.end_date < todayStr && r.end_date >= cutoffDateStr && (r as any).is_vacated !== true
    );
    const dueFeesCount = dueReceipts.length;

    // 2. Expiring in 7 Days
    const expiringSoon = activeReceipts.filter((r) => r.end_date <= in7Str).length;

    // 3. Current month revenue (First day of month of current year)
    const monthStart = `${todayYear}-${todayMonth}-01`;
    const monthReceipts = safeReceipts.filter((r) => r.start_date >= monthStart);
    const monthRevenue = monthReceipts.reduce((sum, r) => sum + Number(r.amount_paid), 0);

    // 4. Lifetime collections
    const lifetimeRevenue = safeReceipts.reduce((sum, r) => sum + Number(r.amount_paid), 0);

    // 5. Active monthly run rate
    const activeMonthlyRevenue = activeReceipts.reduce((sum, r) => sum + Number(r.amount_paid), 0);

    // 6. Revenue trend (Last 6 Months)
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
    const sixMonthsAgoYear = sixMonthsAgo.getFullYear();
    const sixMonthsAgoMonth = String(sixMonthsAgo.getMonth() + 1).padStart(2, "0");
    const sixMonthsAgoStart = `${sixMonthsAgoYear}-${sixMonthsAgoMonth}-01`;

    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const revenueTrendMap = new Map<string, number>();

    // Pre-populate trend months keys
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const key = `${months[d.getMonth()]} ${d.getFullYear()}`;
      revenueTrendMap.set(key, 0);
    }

    const trendReceipts = safeReceipts.filter((r) => r.start_date >= sixMonthsAgoStart);
    for (const r of trendReceipts) {
      const parts = r.start_date.split("-");
      if (parts.length >= 2) {
        const monthIndex = Number(parts[1]) - 1;
        const year = parts[0];
        const key = `${months[monthIndex]} ${year}`;
        if (revenueTrendMap.has(key)) {
          revenueTrendMap.set(key, (revenueTrendMap.get(key) || 0) + Number(r.amount_paid));
        }
      }
    }

    const revenueTrend = Array.from(revenueTrendMap.entries()).map(([month, revenue]) => ({
      month,
      revenue,
    }));

    // 7. Monthly detailed breakdown table
    const monthlyBreakdownMap = new Map<string, { total: number; count: number; sortKey: string }>();
    for (const r of safeReceipts) {
      const parts = r.start_date.split("-");
      if (parts.length >= 2) {
        const monthIndex = Number(parts[1]) - 1;
        const year = parts[0];
        const monthName = months[monthIndex];
        const displayKey = `${monthName} ${year}`;
        const sortKey = `${year}-${parts[1]}`;
        
        const current = monthlyBreakdownMap.get(displayKey) || { total: 0, count: 0, sortKey };
        current.total += Number(r.amount_paid);
        current.count += 1;
        monthlyBreakdownMap.set(displayKey, current);
      }
    }

    const monthlyBreakdown = Array.from(monthlyBreakdownMap.entries())
      .map(([month, data]) => ({
        month,
        total: data.total,
        count: data.count,
        sortKey: data.sortKey,
      }))
      .sort((a, b) => b.sortKey.localeCompare(a.sortKey));

    // 8. Dynamic Shift Counts (Active occupancy per shift)
    const configuredShifts: ShiftConfig[] =
      librarySettings?.shifts_config && librarySettings.shifts_config.length > 0
        ? librarySettings.shifts_config
        : DEFAULT_SHIFTS;

    let fullDayCount = 0;
    const dynamicCounts: Record<string, number> = {};

    for (const r of activeReceipts) {
      if (r.subscription_type === "full_day") {
        fullDayCount++;
      } else {
        const sid = r.shift_type || "other";
        dynamicCounts[sid] = (dynamicCounts[sid] || 0) + 1;
        if (sid === "morning") dynamicCounts["shift_1"] = (dynamicCounts["shift_1"] || 0) + 1;
        if (sid === "evening") dynamicCounts["shift_2"] = (dynamicCounts["shift_2"] || 0) + 1;
      }
    }

    const shiftBreakdown: Array<{ id: string; name: string; count: number }> = [];
    const fullDayShift = configuredShifts.find((s) => s.id === "full_day");
    shiftBreakdown.push({
      id: "full_day",
      name: fullDayShift?.name || "Full Day Pass",
      count: fullDayCount,
    });

    for (const s of configuredShifts.filter((s) => s.id !== "full_day")) {
      const count = dynamicCounts[s.id] || 0;
      shiftBreakdown.push({
        id: s.id,
        name: s.name,
        count,
      });
    }

    const shiftCounts = {
      full_day: fullDayCount,
      shift_1: dynamicCounts["shift_1"] || 0,
      shift_2: dynamicCounts["shift_2"] || 0,
      shift_3: dynamicCounts["shift_3"] || 0,
      ...dynamicCounts,
    };

    // 9. Hourly load profiles
    const hourlyOccupancy = [
      { period: "Morning Hours (6 AM - 2 PM)", count: fullDayCount + (dynamicCounts["shift_1"] || 0) },
      { period: "Afternoon Hours (2 PM - 4 PM)", count: fullDayCount + (dynamicCounts["shift_2"] || 0) },
      { period: "Evening Hours (4 PM - 12 AM)", count: fullDayCount + (dynamicCounts["shift_2"] || 0) + (dynamicCounts["shift_3"] || 0) },
    ];

    return NextResponse.json({
      totalSeats: totalSeats ?? 0,
      occupied,
      free,
      expiringSoon,
      dueFeesCount,
      monthRevenue,
      lifetimeRevenue,
      activeMonthlyRevenue,
      revenueTrend,
      monthlyBreakdown,
      shiftCounts,
      shiftBreakdown,
      hourlyOccupancy,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
