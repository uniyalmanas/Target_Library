import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET(req: Request) {
  try {
    const ownerAuthHeader = req.headers.get("x-owner-auth");
    const correctOwnerPassword = process.env.NEXT_PUBLIC_OWNER_PASSWORD || "TargetOwner2026";
    if (ownerAuthHeader !== "true" && ownerAuthHeader !== correctOwnerPassword) {
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
    const { count: totalSeats, error: seatsError } = await supabase
      .from("seats")
      .select("*", { count: "exact", head: true });

    if (seatsError) return NextResponse.json({ error: seatsError.message }, { status: 500 });

    // Fetch all receipts to compute metrics in a single database round-trip
    const { data: receipts, error: receiptsError } = await supabase
      .from("receipts")
      .select("seat_id, amount_paid, start_date, end_date, subscription_type, shift_type");

    if (receiptsError) return NextResponse.json({ error: receiptsError.message }, { status: 500 });

    const safeReceipts = receipts ?? [];

    // 1. Active receipts
    const activeReceipts = safeReceipts.filter((r) => r.end_date >= todayStr);
    const occupiedSeatIds = new Set(activeReceipts.map((r) => r.seat_id));
    const occupied = occupiedSeatIds.size;
    const free = Math.max(0, (totalSeats ?? 0) - occupied);

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

    // 8. Shift Counts (Active occupancy per shift)
    let fullDayCount = 0;
    let shift1Count = 0;
    let shift2Count = 0;
    let shift3Count = 0;

    for (const r of activeReceipts) {
      if (r.subscription_type === "full_day") {
        fullDayCount++;
      } else {
        if (r.shift_type === "shift_1" || r.shift_type === "morning") {
          shift1Count++;
        } else if (r.shift_type === "shift_2" || r.shift_type === "evening") {
          shift2Count++;
        } else if (r.shift_type === "shift_3") {
          shift3Count++;
        }
      }
    }

    const shiftCounts = {
      full_day: fullDayCount,
      shift_1: shift1Count,
      shift_2: shift2Count,
      shift_3: shift3Count,
    };

    // 9. Hourly load profiles
    const hourlyOccupancy = [
      { period: "Morning (6 AM - 2 PM)", count: fullDayCount + shift1Count },
      { period: "Afternoon (2 PM - 4 PM)", count: fullDayCount + shift2Count },
      { period: "Evening (4 PM - 12 AM)", count: fullDayCount + shift2Count + shift3Count },
    ];

    return NextResponse.json({
      totalSeats: totalSeats ?? 0,
      occupied,
      free,
      expiringSoon,
      monthRevenue,
      lifetimeRevenue,
      activeMonthlyRevenue,
      revenueTrend,
      monthlyBreakdown,
      shiftCounts,
      hourlyOccupancy,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
