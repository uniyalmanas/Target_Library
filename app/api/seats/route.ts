import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

// Returns all 500 seats, each annotated with whether it's currently occupied
// (an active receipt with end_date >= today) and by whom.
export async function GET() {
  try {
    const today = new Date().toISOString().split("T")[0];

    const { data: seats, error: seatsError } = await supabase
      .from("seats")
      .select("seat_id, seat_number")
      .order("seat_number", { ascending: true });

    if (seatsError) {
      return NextResponse.json({ error: seatsError.message }, { status: 500 });
    }

    // Active receipts = end_date >= today, joined with member info
    const { data: activeReceipts, error: receiptsError } = await supabase
      .from("receipts")
      .select(
        "receipt_no, student_id, seat_id, subscription_type, shift_type, has_sheet, amount_paid, start_date, end_date, members(student_id, name, phone)"
      )
      .gte("end_date", today);

    if (receiptsError) {
      return NextResponse.json({ error: receiptsError.message }, { status: 500 });
    }

    // Map seat_id -> array of active receipts
    const receiptsBySeat = new Map<number, any[]>();
    for (const r of activeReceipts ?? []) {
      const existing = receiptsBySeat.get(r.seat_id) ?? [];
      existing.push(r);
      receiptsBySeat.set(r.seat_id, existing);
    }

    const result = (seats ?? []).map((seat) => {
      const receipts = receiptsBySeat.get(seat.seat_id) ?? [];
      // Sort receipts so that full_day is first, or by end_date descending
      receipts.sort((a, b) => b.end_date.localeCompare(a.end_date));

      return {
        seat_id: seat.seat_id,
        seat_number: seat.seat_number,
        occupied: receipts.length > 0,
        receipts: receipts.map((r) => ({
          receipt_no: r.receipt_no,
          student_id: r.student_id,
          subscription_type: r.subscription_type,
          shift_type: r.shift_type,
          has_sheet: r.has_sheet,
          amount_paid: r.amount_paid,
          start_date: r.start_date,
          end_date: r.end_date,
          member: r.members
            ? {
                student_id: r.members.student_id,
                name: r.members.name,
                phone: r.members.phone,
              }
            : null,
        })),
        // Keep backward compatibility fields
        receipt: receipts[0]
          ? {
              receipt_no: receipts[0].receipt_no,
              student_id: receipts[0].student_id,
              subscription_type: receipts[0].subscription_type,
              shift_type: receipts[0].shift_type,
              has_sheet: receipts[0].has_sheet,
              amount_paid: receipts[0].amount_paid,
              start_date: receipts[0].start_date,
              end_date: receipts[0].end_date,
            }
          : null,
        member: receipts[0]?.members ?? null,
      };
    });

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("GET /api/seats error:", error);
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}
