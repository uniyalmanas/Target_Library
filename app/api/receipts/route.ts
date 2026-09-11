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
    aadhar_no,
    seat_id,
    subscription_type,
    shift_type,
    has_sheet,
    amount_paid,
    payment_mode = "cash",
    start_date,
    end_date: customEndDate,
    duration_days,
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

  // Calculate resolved end_date based on customEndDate, duration_days, or default 30 days
  const start = new Date(start_date);
  let resolvedEndDate: string;

  if (customEndDate && /^\d{4}-\d{2}-\d{2}$/.test(customEndDate)) {
    resolvedEndDate = customEndDate;
  } else if (duration_days && Number(duration_days) > 0) {
    const end = new Date(start);
    end.setDate(end.getDate() + Number(duration_days));
    resolvedEndDate = end.toISOString().split("T")[0];
  } else {
    const end = new Date(start);
    end.setDate(end.getDate() + 30);
    resolvedEndDate = end.toISOString().split("T")[0];
  }

  if (resolvedEndDate < start_date) {
    return NextResponse.json(
      { error: "End date cannot be earlier than start date." },
      { status: 400 }
    );
  }

  // Guard: is this seat already occupied by an active receipt for an overlapping slot?
  const today = new Date().toISOString().split("T")[0];
  const { data: activeOnSeat, error: activeError } = await supabase
    .from("receipts")
    .select("receipt_no, subscription_type, shift_type, start_date, end_date")
    .eq("seat_id", seat_id)
    .gte("end_date", today);

  if (activeError) {
    return NextResponse.json({ error: activeError.message }, { status: 500 });
  }

  const conflict = (activeOnSeat ?? []).some((r) => {
    // Check if the date ranges actually overlap
    const isDateOverlap = r.start_date <= resolvedEndDate && r.end_date >= start_date;
    if (!isDateOverlap) return false;

    if (r.subscription_type === "full_day" || subscription_type === "full_day") return true;
    
    const rShift = r.shift_type;
    const newShift = shift_type;

    // Direct match (same shift)
    if (rShift === newShift) return true;
    if ((rShift === "morning" && newShift === "shift_1") || (rShift === "shift_1" && newShift === "morning")) return true;
    if ((rShift === "evening" && newShift === "shift_2") || (rShift === "shift_2" && newShift === "evening")) return true;

    // Overlap checks: Shift 2 (or legacy "evening") overlaps with Shift 3
    const isRShift2 = rShift === "shift_2" || rShift === "evening";
    const isNewShift2 = newShift === "shift_2" || newShift === "evening";
    const isRShift3 = rShift === "shift_3";
    const isNewShift3 = newShift === "shift_3";

    if ((isRShift2 && isNewShift3) || (isRShift3 && isNewShift2)) return true;

    return false;
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
        const memberData: Record<string, any> = {
          student_id: resolvedStudentId,
          name,
          phone: phone || null,
        };
        if (aadhar_no) memberData.aadhar_no = aadhar_no.trim();

        let { data: newMember, error: memberError } = await supabase
          .from("members")
          .insert(memberData)
          .select()
          .single();

        // Safe fallback if column does not exist yet on DB
        if (memberError && (memberError.code === "42703" || memberError.message?.includes("aadhar_no"))) {
          delete memberData.aadhar_no;
          const retry = await supabase.from("members").insert(memberData).select().single();
          newMember = retry.data;
          memberError = retry.error;
        }

        if (memberError) {
          return NextResponse.json({ error: memberError.message }, { status: 500 });
        }
      } else {
        return NextResponse.json(
          { error: `Member ID #${resolvedStudentId} does not exist.` },
          { status: 400 }
        );
      }
    } else {
      // Existing member: update Aadhaar if provided
      if (aadhar_no) {
        try {
          await supabase
            .from("members")
            .update({ aadhar_no: aadhar_no.trim() })
            .eq("student_id", resolvedStudentId);
        } catch {
          // ignore if column doesn't exist
        }
      }
    }
  } else {
    if (!name) {
      return NextResponse.json(
        { error: "name is required when creating a new member" },
        { status: 400 }
      );
    }
    const memberData: Record<string, any> = {
      name,
      phone: phone || null,
    };
    if (aadhar_no) memberData.aadhar_no = aadhar_no.trim();

    let { data: newMember, error: memberError } = await supabase
      .from("members")
      .insert(memberData)
      .select()
      .single();

    // Safe fallback if column does not exist yet on DB
    if (memberError && (memberError.code === "42703" || memberError.message?.includes("aadhar_no"))) {
      delete memberData.aadhar_no;
      const retry = await supabase.from("members").insert(memberData).select().single();
      newMember = retry.data;
      memberError = retry.error;
    }

    if (memberError) {
      return NextResponse.json({ error: memberError.message }, { status: 500 });
    }
    resolvedStudentId = newMember.student_id;
  }

  const receiptInsertData: Record<string, any> = {
    student_id: resolvedStudentId,
    seat_id,
    subscription_type,
    shift_type: subscription_type === "half_day" ? shift_type : null,
    has_sheet: !!has_sheet,
    amount_paid,
    payment_mode: payment_mode === "online" ? "online" : "cash",
    start_date,
    end_date: resolvedEndDate,
  };

  let { data: receipt, error: receiptError } = await supabase
    .from("receipts")
    .insert(receiptInsertData)
    .select()
    .single();

  // Safe fallback if payment_mode column does not exist on DB yet
  if (receiptError && (receiptError.code === "42703" || receiptError.message?.includes("payment_mode"))) {
    delete receiptInsertData.payment_mode;
    const retry = await supabase.from("receipts").insert(receiptInsertData).select().single();
    receipt = retry.data;
    receiptError = retry.error;
  }

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

  let { data, error } = await supabase
    .from("receipts")
    .update({ is_vacated: true, end_date: yesterdayStr })
    .eq("receipt_no", receipt_no)
    .select()
    .single();

  if (error && (error.code === "42703" || error.message?.includes("is_vacated"))) {
    const fallback = await supabase
      .from("receipts")
      .update({ end_date: yesterdayStr })
      .eq("receipt_no", receipt_no)
      .select()
      .single();
    data = fallback.data;
    error = fallback.error;
  }

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, receipt: data });
}

// PUT /api/receipts -> Owner-only Edit of existing receipt (plan, seat, amount, dates, candidate info)
export async function PUT(req: Request) {
  try {
    const ownerAuthHeader = req.headers.get("x-owner-auth");
    const correctOwnerPassword = process.env.NEXT_PUBLIC_OWNER_PASSWORD || "TargetOwner2026";
    if (ownerAuthHeader !== "true" && ownerAuthHeader !== correctOwnerPassword) {
      return NextResponse.json({ error: "Unauthorized. Owner passcode required to edit receipts." }, { status: 401 });
    }

    const body = await req.json();
    const {
      receipt_no,
      seat_id,
      seat_number,
      subscription_type,
      shift_type,
      has_sheet,
      amount_paid,
      payment_mode,
      start_date,
      end_date,
      name,
      phone,
      aadhar_no,
    } = body;

    if (!receipt_no) {
      return NextResponse.json({ error: "Missing receipt_no" }, { status: 400 });
    }

    // Fetch existing receipt
    const { data: existingReceipt, error: fetchError } = await supabase
      .from("receipts")
      .select("*, members(student_id, name, phone)")
      .eq("receipt_no", receipt_no)
      .single();

    if (fetchError || !existingReceipt) {
      return NextResponse.json({ error: "Receipt not found" }, { status: 404 });
    }

    // Resolve target seat_id
    let targetSeatId = seat_id || existingReceipt.seat_id;
    if (seat_number && !seat_id) {
      const { data: seatData } = await supabase
        .from("seats")
        .select("seat_id")
        .eq("seat_number", seat_number)
        .single();
      if (seatData) targetSeatId = seatData.seat_id;
    }

    const targetSubType = subscription_type || existingReceipt.subscription_type;
    const targetShift = targetSubType === "half_day" ? (shift_type || existingReceipt.shift_type) : null;
    const targetStartDate = start_date || existingReceipt.start_date;
    const targetEndDate = end_date || existingReceipt.end_date;
    const targetAmount = amount_paid !== undefined ? Number(amount_paid) : Number(existingReceipt.amount_paid);
    const targetHasSheet = has_sheet !== undefined ? !!has_sheet : !!existingReceipt.has_sheet;

    if (targetEndDate < targetStartDate) {
      return NextResponse.json({ error: "End date cannot be earlier than start date." }, { status: 400 });
    }

    // Check conflict on target seat (excluding this receipt)
    const today = new Date().toISOString().split("T")[0];
    const { data: activeOnSeat, error: activeError } = await supabase
      .from("receipts")
      .select("receipt_no, subscription_type, shift_type, start_date, end_date")
      .eq("seat_id", targetSeatId)
      .gte("end_date", today)
      .neq("receipt_no", receipt_no);

    if (activeError) {
      return NextResponse.json({ error: activeError.message }, { status: 500 });
    }

    const conflict = (activeOnSeat ?? []).some((r) => {
      const isDateOverlap = r.start_date <= targetEndDate && r.end_date >= targetStartDate;
      if (!isDateOverlap) return false;

      if (r.subscription_type === "full_day" || targetSubType === "full_day") return true;

      const rShift = r.shift_type;
      const newShift = targetShift;

      if (rShift === newShift) return true;
      if ((rShift === "morning" && newShift === "shift_1") || (rShift === "shift_1" && newShift === "morning")) return true;
      if ((rShift === "evening" && newShift === "shift_2") || (rShift === "shift_2" && newShift === "evening")) return true;

      const isRShift2 = rShift === "shift_2" || rShift === "evening";
      const isNewShift2 = newShift === "shift_2" || newShift === "evening";
      const isRShift3 = rShift === "shift_3";
      const isNewShift3 = newShift === "shift_3";

      if ((isRShift2 && isNewShift3) || (isRShift3 && isNewShift2)) return true;
      return false;
    });

    if (conflict) {
      return NextResponse.json(
        { error: "The selected seat or shift is occupied by another student for these dates." },
        { status: 409 }
      );
    }

    // If candidate name, phone or aadhar_no updated, update members table
    if ((name || phone !== undefined || aadhar_no !== undefined) && existingReceipt.student_id) {
      const memberUpdates: Record<string, string | null> = {};
      if (name) memberUpdates.name = name;
      if (phone !== undefined) memberUpdates.phone = phone || null;
      if (aadhar_no !== undefined) memberUpdates.aadhar_no = aadhar_no ? aadhar_no.trim() : null;

      try {
        const updateRes = await supabase
          .from("members")
          .update(memberUpdates)
          .eq("student_id", existingReceipt.student_id);

        if (updateRes.error && (updateRes.error.code === "42703" || updateRes.error.message?.includes("aadhar_no"))) {
          delete memberUpdates.aadhar_no;
          if (Object.keys(memberUpdates).length > 0) {
            await supabase
              .from("members")
              .update(memberUpdates)
              .eq("student_id", existingReceipt.student_id);
          }
        }
      } catch {
        // Safe fallback
      }
    }

    const targetPaymentMode = payment_mode !== undefined ? payment_mode : (existingReceipt.payment_mode || "cash");

    // Update receipt
    const updateReceiptData: Record<string, any> = {
      seat_id: targetSeatId,
      subscription_type: targetSubType,
      shift_type: targetShift,
      has_sheet: targetHasSheet,
      amount_paid: targetAmount,
      payment_mode: targetPaymentMode,
      start_date: targetStartDate,
      end_date: targetEndDate,
    };

    let { data: updatedReceipt, error: updateError } = await supabase
      .from("receipts")
      .update(updateReceiptData)
      .eq("receipt_no", receipt_no)
      .select()
      .single();

    if (updateError && (updateError.code === "42703" || updateError.message?.includes("payment_mode"))) {
      delete updateReceiptData.payment_mode;
      const retry = await supabase
        .from("receipts")
        .update(updateReceiptData)
        .eq("receipt_no", receipt_no)
        .select()
        .single();
      updatedReceipt = retry.data;
      updateError = retry.error;
    }

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, receipt: updatedReceipt });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// DELETE /api/receipts -> Owner-only Cancel & Delete a receipt
export async function DELETE(req: Request) {
  try {
    const ownerAuthHeader = req.headers.get("x-owner-auth");
    const correctOwnerPassword = process.env.NEXT_PUBLIC_OWNER_PASSWORD || "TargetOwner2026";
    if (ownerAuthHeader !== "true" && ownerAuthHeader !== correctOwnerPassword) {
      return NextResponse.json({ error: "Unauthorized. Owner passcode required to cancel/delete receipts." }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const receiptNoParam = searchParams.get("receipt_no");
    let receipt_no = receiptNoParam ? Number(receiptNoParam) : null;

    if (!receipt_no) {
      const body = await req.json().catch(() => ({}));
      receipt_no = body.receipt_no ? Number(body.receipt_no) : null;
    }

    if (!receipt_no) {
      return NextResponse.json({ error: "Missing receipt_no" }, { status: 400 });
    }

    const { error: deleteError } = await supabase
      .from("receipts")
      .delete()
      .eq("receipt_no", receipt_no);

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, message: `Receipt #${receipt_no} has been deleted. Seat is now available.` });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
