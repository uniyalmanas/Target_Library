import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET(req: Request) {
  try {
    const ownerAuthHeader = req.headers.get("x-owner-auth");
    const correctOwnerPassword = process.env.NEXT_PUBLIC_OWNER_PASSWORD || "TargetOwner2026";
    if (ownerAuthHeader !== "true" && ownerAuthHeader !== correctOwnerPassword) {
      return NextResponse.json({ error: "Unauthorized access to financial data" }, { status: 401 });
    }

    const today = new Date();
    const todayStr = today.toISOString().split("T")[0];
    const in7 = new Date(today);
    in7.setDate(in7.getDate() + 7);
    const in7Str = in7.toISOString().split("T")[0];

    // Get total seat capacity
    const { count: totalSeats, error: seatsError } = await supabase
      .from("seats")
      .select("*", { count: "exact", head: true });

    if (seatsError) return NextResponse.json({ error: seatsError.message }, { status: 500 });

    // Fetch active receipts
    const { data: activeReceipts, error: activeError } = await supabase
      .from("receipts")
      .select("seat_id, amount_paid, end_date, subscription_type, shift_type")
      .gte("end_date", todayStr);

    if (activeError) return NextResponse.json({ error: activeError.message }, { status: 500 });

    const occupiedSeatIds = new Set((activeReceipts ?? []).map((r) => r.seat_id));
    const occupied = occupiedSeatIds.size;
    const free = Math.max(0, (totalSeats ?? 0) - occupied);

    const expiringSoon = (activeReceipts ?? []).filter(
      (r) => r.end_date <= in7Str
    ).length;

    // Current month revenue
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1)
      .toISOString()
      .split("T")[0];

    const { data: monthReceipts, error: monthError } = await supabase
      .from("receipts")
      .select("amount_paid")
      .gte("start_date", monthStart);

    if (monthError) return NextResponse.json({ error: monthError.message }, { status: 500 });

    const monthRevenue = (monthReceipts ?? []).reduce(
      (sum, r) => sum + Number(r.amount_paid),
      0
    );

    // --- REVENUE TREND: Group by Month for Last 6 Months ---
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
    const sixMonthsAgoStart = new Date(sixMonthsAgo.getFullYear(), sixMonthsAgo.getMonth(), 1)
      .toISOString()
      .split("T")[0];

    const { data: trendReceipts, error: trendError } = await supabase
      .from("receipts")
      .select("amount_paid, start_date")
      .gte("start_date", sixMonthsAgoStart);

    if (trendError) return NextResponse.json({ error: trendError.message }, { status: 500 });

    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const revenueTrendMap = new Map<string, number>();

    // Pre-populate last 6 months keys
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const key = `${months[d.getMonth()]} ${d.getFullYear()}`;
      revenueTrendMap.set(key, 0);
    }

    for (const r of trendReceipts ?? []) {
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

    // --- SHIFT COUNTS: Active occupancy per shift ---
    let fullDayCount = 0;
    let shift1Count = 0;
    let shift2Count = 0;
    let shift3Count = 0;

    for (const r of activeReceipts ?? []) {
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

    // --- HOURLY OCCUPANCY PROFILE ---
    // Morning (6am-2pm): Full Day + Shift 1
    // Afternoon (2pm-4pm): Full Day + Shift 2
    // Evening (4pm-12am): Full Day + Shift 2 + Shift 3 (max occupancy)
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
      revenueTrend,
      shiftCounts,
      hourlyOccupancy,
    });
  } catch (error: any) {
    console.error("GET /api/dashboard error:", error);
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}
