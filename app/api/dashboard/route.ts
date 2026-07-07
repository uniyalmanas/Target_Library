import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET() {
  const today = new Date();
  const todayStr = today.toISOString().split("T")[0];
  const in7 = new Date(today);
  in7.setDate(in7.getDate() + 7);
  const in7Str = in7.toISOString().split("T")[0];

  const { count: totalSeats, error: seatsError } = await supabase
    .from("seats")
    .select("*", { count: "exact", head: true });

  if (seatsError) return NextResponse.json({ error: seatsError.message }, { status: 500 });

  const { data: activeReceipts, error: activeError } = await supabase
    .from("receipts")
    .select("seat_id, amount_paid, end_date, subscription_type, shift_type")
    .gte("end_date", todayStr);

  if (activeError) return NextResponse.json({ error: activeError.message }, { status: 500 });

  const occupiedSeatIds = new Set((activeReceipts ?? []).map((r) => r.seat_id));
  const occupied = occupiedSeatIds.size;
  const free = (totalSeats ?? 0) - occupied;

  const expiringSoon = (activeReceipts ?? []).filter(
    (r) => r.end_date <= in7Str
  ).length;

  // Revenue: sum of receipts created THIS calendar month
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

  return NextResponse.json({
    totalSeats: totalSeats ?? 0,
    occupied,
    free,
    expiringSoon,
    monthRevenue,
  });
}
