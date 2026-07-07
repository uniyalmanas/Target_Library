import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

// GET /api/receipts?student_id=1287  -> full history for a member
// GET /api/receipts?seat_id=12        -> history for a seat
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const studentId = searchParams.get("student_id");
  const seatId = searchParams.get("seat_id");

  let query = supabase
    .from("receipts")
    .select("*")
    .order("start_date", { ascending: false });

  if (studentId) query = query.eq("student_id", studentId);
  if (seatId) query = query.eq("seat_id", seatId);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// POST body:
// {
//   student_id?: number,     // omit if new member
//   name: string,            // required if new member
//   phone?: string,
//   seat_id: number,
//   subscription_type: 'full_day' | 'half_day',
//   shift_type?: 'morning' | 'evening',
//   has_sheet: boolean,
//   amount_paid: number,
//   start_date: string (YYYY-MM-DD)
// }
export async function POST(req: Request) {
  const body = await req.json();
  const {
    student_id,
    name,
    phone,
    seat_id,
    subscription_type,
    shift_type,
    has_sheet,
    amount_paid,
    start_date,
  } = body;

  if (!seat_id || !subscription_type || !amount_paid || !start_date) {
    return NextResponse.json(
      { error: "Missing required fields" },
      { status: 400 }
    );
  }

  if (subscription_type === "half_day" && !shift_type) {
    return NextResponse.json(
      { error: "shift_type is required for half_day subscriptions" },
      { status: 400 }
    );
  }

  // Guard: is this seat already occupied by an active receipt for the
  // SAME slot? (full_day blocks everything; half_day only blocks same shift)
  const today = new Date().toISOString().split("T")[0];
  const { data: activeOnSeat, error: activeError } = await supabase
    .from("receipts")
    .select("receipt_no, subscription_type, shift_type, end_date")
    .eq("seat_id", seat_id)
    .gte("end_date", today);

  if (activeError) {
    return NextResponse.json({ error: activeError.message }, { status: 500 });
  }

  const conflict = (activeOnSeat ?? []).some((r) => {
    if (r.subscription_type === "full_day" || subscription_type === "full_day") return true;
    return r.shift_type === shift_type;
  });

  if (conflict) {
    return NextResponse.json(
      { error: "This seat (or shift) is already occupied for the selected dates." },
      { status: 409 }
    );
  }

  // Resolve member: use existing student_id, or create a new member
  let resolvedStudentId = student_id;
  if (resolvedStudentId) {
    const { data: existingMember, error: checkError } = await supabase
      .from("members")
      .select("student_id")
      .eq("student_id", resolvedStudentId)
      .maybeSingle();

    if (checkError) {
      return NextResponse.json({ error: checkError.message }, { status: 500 });
    }
    if (!existingMember) {
      if (name) {
        // Create new member with custom ID
        const { data: newMember, error: memberError } = await supabase
          .from("members")
          .insert({ student_id: resolvedStudentId, name, phone: phone || null })
          .select()
          .single();

        if (memberError) {
          return NextResponse.json({ error: memberError.message }, { status: 500 });
        }
      } else {
        return NextResponse.json(
          { error: `Member ID #${resolvedStudentId} does not exist.` },
          { status: 400 }
        );
      }
    }
  } else {
    if (!name) {
      return NextResponse.json(
        { error: "name is required when creating a new member" },
        { status: 400 }
      );
    }
    const { data: newMember, error: memberError } = await supabase
      .from("members")
      .insert({ name, phone: phone || null })
      .select()
      .single();

    if (memberError) {
      return NextResponse.json({ error: memberError.message }, { status: 500 });
    }
    resolvedStudentId = newMember.student_id;
  }

  const start = new Date(start_date);
  const end = new Date(start);
  end.setDate(end.getDate() + 30);
  const end_date = end.toISOString().split("T")[0];

  const { data: receipt, error: receiptError } = await supabase
    .from("receipts")
    .insert({
      student_id: resolvedStudentId,
      seat_id,
      subscription_type,
      shift_type: subscription_type === "half_day" ? shift_type : null,
      has_sheet: !!has_sheet,
      amount_paid,
      start_date,
      end_date,
    })
    .select()
    .single();

  if (receiptError) {
    return NextResponse.json({ error: receiptError.message }, { status: 500 });
  }

  return NextResponse.json({ receipt, student_id: resolvedStudentId });
}

// PATCH /api/receipts -> Vacate / end subscription early
export async function PATCH(req: Request) {
  const body = await req.json();
  const { receipt_no } = body;

  if (!receipt_no) {
    return NextResponse.json({ error: "Missing receipt_no" }, { status: 400 });
  }

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split("T")[0];

  const { data, error } = await supabase
    .from("receipts")
    .update({ end_date: yesterdayStr })
    .eq("receipt_no", receipt_no)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, receipt: data });
}
