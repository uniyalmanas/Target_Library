import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { getLibraryBySlug, getLibrarySettings, DEFAULT_LIBRARY_ID, DEFAULT_SHIFTS } from "@/lib/tenant";
import { doShiftsClash, getShiftDisplayLabel } from "@/lib/shifts";

// GET /api/receipts?student_id=1287  -> full history for a member
// GET /api/receipts?seat_id=12        -> history for a seat
// GET /api/receipts?slug=target-library -> filter by library
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const studentId = searchParams.get("student_id");
  const seatId = searchParams.get("seat_id");
  const slug = searchParams.get("slug");

  let query = supabase
    .from("receipts")
    .select("*")
    .order("start_date", { ascending: false });

  if (studentId) query = query.eq("student_id", studentId);
  if (seatId) query = query.eq("seat_id", seatId);
  if (slug) {
    try {
      const lib = await getLibraryBySlug(slug);
      query = query.eq("library_id", lib.id);
    } catch {
      // ignore
    }
  }

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
    slug,
    student_id,
    name,
    phone,
    aadhar_no,
    seat_id,
    seat_number,
    subscription_type,
    shift_type,
    has_sheet,
    amount_paid,
    payment_mode = "cash",
    utr_number,
    start_date,
    end_date: customEndDate,
    duration_days,
  } = body;

  let libraryId = DEFAULT_LIBRARY_ID;
  if (slug) {
    try {
      const lib = await getLibraryBySlug(slug);
      libraryId = lib.id;
    } catch {
      // fallback
    }
  }

  if ((!seat_id && !seat_number) || !subscription_type || !amount_paid || !start_date) {
    return NextResponse.json(
      { error: "Missing required fields" },
      { status: 400 }
    );
  }

  // Resolve target seat for this specific library tenant
  let resolvedSeatId = seat_id;
  const targetSeatNum = seat_number ? Number(seat_number) : null;

  if (targetSeatNum) {
    const { data: existingSeat } = await supabase
      .from("seats")
      .select("seat_id")
      .eq("library_id", libraryId)
      .eq("seat_number", targetSeatNum)
      .maybeSingle();

    if (existingSeat) {
      resolvedSeatId = existingSeat.seat_id;
    } else {
      const { data: newSeat } = await supabase
        .from("seats")
        .insert({ library_id: libraryId, seat_number: targetSeatNum })
        .select("seat_id")
        .maybeSingle();
      if (newSeat) resolvedSeatId = newSeat.seat_id;
    }
  } else if (seat_id) {
    const { data: seatRow } = await supabase
      .from("seats")
      .select("seat_id, seat_number, library_id")
      .eq("seat_id", seat_id)
      .maybeSingle();

    if (seatRow && seatRow.library_id && seatRow.library_id !== libraryId) {
      const { data: correctSeat } = await supabase
        .from("seats")
        .select("seat_id")
        .eq("library_id", libraryId)
        .eq("seat_number", seatRow.seat_number)
        .maybeSingle();

      if (correctSeat) {
        resolvedSeatId = correctSeat.seat_id;
      } else {
        const { data: createdSeat } = await supabase
          .from("seats")
          .insert({ library_id: libraryId, seat_number: seatRow.seat_number })
          .select("seat_id")
          .maybeSingle();
        if (createdSeat) resolvedSeatId = createdSeat.seat_id;
      }
    }
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

  // Guard: is this seat already occupied by an active receipt for an overlapping slot in this library?
  const today = new Date().toISOString().split("T")[0];
  const { data: activeOnSeat, error: activeError } = await supabase
    .from("receipts")
    .select("receipt_no, subscription_type, shift_type, start_date, end_date, members(name)")
    .eq("seat_id", resolvedSeatId)
    .eq("library_id", libraryId)
    .gte("end_date", today);

  if (activeError) {
    return NextResponse.json({ error: activeError.message }, { status: 500 });
  }

  // Load library shift configurations to accurately detect clashes
  let shiftsConfig = DEFAULT_SHIFTS;
  try {
    const settings = await getLibrarySettings(libraryId);
    if (settings?.shifts_config && settings.shifts_config.length > 0) {
      shiftsConfig = settings.shifts_config;
    }
  } catch {
    // fallback
  }

  let conflictingReceipt: any = null;
  const conflict = (activeOnSeat ?? []).some((r) => {
    // Check if the date ranges actually overlap
    const isDateOverlap = r.start_date <= resolvedEndDate && r.end_date >= start_date;
    if (!isDateOverlap) return false;

    // If either is full day, it unconditionally conflicts
    if (r.subscription_type === "full_day" || subscription_type === "full_day") {
      conflictingReceipt = r;
      return true;
    }

    // Dynamic shift interval collision check
    if (doShiftsClash(r.shift_type, shift_type, shiftsConfig)) {
      conflictingReceipt = r;
      return true;
    }

    return false;
  });

  if (conflict) {
    const conflictShiftName = getShiftDisplayLabel(
      conflictingReceipt?.shift_type,
      conflictingReceipt?.subscription_type,
      shiftsConfig
    );
    const occupantName = conflictingReceipt?.members?.name ? ` by ${conflictingReceipt.members.name}` : "";
    return NextResponse.json(
      {
        error: `Seat #${targetSeatNum || resolvedSeatId} is already occupied${occupantName} for conflicting shift: "${conflictShiftName}" during these dates.`,
      },
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
          library_id: libraryId,
        };
        if (aadhar_no) memberData.aadhar_no = aadhar_no.trim();

        let { data: newMember, error: memberError } = await supabase
          .from("members")
          .insert(memberData)
          .select()
          .single();

        // Safe fallback if column does not exist yet on DB
        if (memberError && (memberError.code === "42703" || memberError.message?.includes("library_id") || memberError.message?.includes("aadhar_no"))) {
          delete memberData.library_id;
          delete memberData.aadhar_no;
          const retry = await supabase.from("members").insert(memberData).select().single();
          newMember = retry.data;
          memberError = retry.error;
        }

        if (memberError) {
          // If inserting with custom student_id failed, retry auto-generating student_id
          const fallbackData = { ...memberData };
          delete fallbackData.student_id;
          const retryAuto = await supabase.from("members").insert(fallbackData).select().single();
          if (retryAuto.data) {
            resolvedStudentId = retryAuto.data.student_id;
          } else {
            return NextResponse.json({ error: memberError.message }, { status: 500 });
          }
        }
      } else {
        return NextResponse.json(
          { error: `Member ID #${resolvedStudentId} does not exist. Please enter Student Full Name to create a new profile.` },
          { status: 400 }
        );
      }
    } else {
      // Existing member: update details if provided
      const updateData: Record<string, any> = {};
      if (aadhar_no && typeof aadhar_no === "string" && aadhar_no.trim()) {
        updateData.aadhar_no = aadhar_no.trim();
      }
      if (phone && typeof phone === "string" && phone.trim()) {
        updateData.phone = phone.trim();
      }
      if (name && typeof name === "string" && name.trim()) {
        updateData.name = name.trim();
      }
      if (Object.keys(updateData).length > 0) {
        try {
          const { error: updErr } = await supabase
            .from("members")
            .update(updateData)
            .eq("student_id", resolvedStudentId);
          if (updErr && (updErr.code === "42703" || updErr.message?.includes("aadhar_no"))) {
            delete updateData.aadhar_no;
            if (Object.keys(updateData).length > 0) {
              await supabase
                .from("members")
                .update(updateData)
                .eq("student_id", resolvedStudentId);
            }
          }
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
      library_id: libraryId,
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
    seat_id: resolvedSeatId,
    subscription_type,
    shift_type: subscription_type === "half_day" ? shift_type : null,
    has_sheet: !!has_sheet,
    amount_paid,
    payment_mode: payment_mode === "online" ? "online" : "cash",
    start_date,
    end_date: resolvedEndDate,
    library_id: libraryId,
  };
  if (utr_number) receiptInsertData.utr_number = utr_number.trim();

  let { data: receipt, error: receiptError } = await supabase
    .from("receipts")
    .insert(receiptInsertData)
    .select()
    .single();

  // Safe fallback if payment_mode, library_id, or utr_number column does not exist on DB yet
  if (receiptError && (receiptError.code === "42703" || receiptError.message?.includes("payment_mode") || receiptError.message?.includes("library_id") || receiptError.message?.includes("utr_number"))) {
    delete receiptInsertData.payment_mode;
    delete receiptInsertData.library_id;
    delete receiptInsertData.utr_number;
    const retry = await supabase.from("receipts").insert(receiptInsertData).select().single();
    receipt = retry.data;
    receiptError = retry.error;
  }

  if (receiptError) {
    if (receiptError.code === "23514" && (receiptError.message?.includes("receipts_shift_type_check") || receiptError.message?.includes("shift_type"))) {
      return NextResponse.json({
        error: "Custom shift detected: Please run the 1-click SQL in Supabase SQL Editor to allow custom shifts: ALTER TABLE receipts DROP CONSTRAINT IF EXISTS receipts_shift_type_check; ALTER TABLE receipts ALTER COLUMN shift_type TYPE VARCHAR(100);"
      }, { status: 500 });
    }
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

  if (Number(receipt_no) >= 8000) {
    return NextResponse.json({ ok: true, receipt: { receipt_no, is_vacated: true } });
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

    const receiptLibId = existingReceipt.library_id || DEFAULT_LIBRARY_ID;

    // Resolve target seat_id
    let targetSeatId = seat_id || existingReceipt.seat_id;
    if (seat_number && !seat_id) {
      let seatQuery = supabase
        .from("seats")
        .select("seat_id")
        .eq("seat_number", Number(seat_number));
      if (receiptLibId) {
        seatQuery = seatQuery.eq("library_id", receiptLibId);
      }
      const { data: seatData } = await seatQuery.maybeSingle();
      if (seatData) {
        targetSeatId = seatData.seat_id;
      } else if (receiptLibId) {
        const { data: newSeat } = await supabase
          .from("seats")
          .insert({ library_id: receiptLibId, seat_number: Number(seat_number) })
          .select("seat_id")
          .maybeSingle();
        if (newSeat) targetSeatId = newSeat.seat_id;
      }
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

    // Check conflict on target seat (excluding this receipt) strictly within this library
    const today = new Date().toISOString().split("T")[0];
    let conflictQuery = supabase
      .from("receipts")
      .select("receipt_no, subscription_type, shift_type, start_date, end_date, members(name)")
      .eq("seat_id", targetSeatId)
      .gte("end_date", today)
      .neq("receipt_no", receipt_no);

    if (receiptLibId) {
      conflictQuery = conflictQuery.eq("library_id", receiptLibId);
    }

    const { data: activeOnSeat, error: activeError } = await conflictQuery;

    if (activeError) {
      return NextResponse.json({ error: activeError.message }, { status: 500 });
    }

    let shiftsConfig = DEFAULT_SHIFTS;
    if (receiptLibId) {
      try {
        const settings = await getLibrarySettings(receiptLibId);
        if (settings?.shifts_config && settings.shifts_config.length > 0) {
          shiftsConfig = settings.shifts_config;
        }
      } catch {
        // fallback
      }
    }

    let conflictingReceipt: any = null;
    const conflict = (activeOnSeat ?? []).some((r) => {
      const isDateOverlap = r.start_date <= targetEndDate && r.end_date >= targetStartDate;
      if (!isDateOverlap) return false;

      if (r.subscription_type === "full_day" || targetSubType === "full_day") {
        conflictingReceipt = r;
        return true;
      }

      if (doShiftsClash(r.shift_type, targetShift, shiftsConfig)) {
        conflictingReceipt = r;
        return true;
      }

      return false;
    });

    if (conflict) {
      const conflictShiftName = getShiftDisplayLabel(
        conflictingReceipt?.shift_type,
        conflictingReceipt?.subscription_type,
        shiftsConfig
      );
      return NextResponse.json(
        { error: `The selected seat is occupied for conflicting shift: "${conflictShiftName}" during these dates.` },
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
