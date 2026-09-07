import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const dateParam = searchParams.get("date");

    // Compute target date in Indian Standard Time (IST) if not provided
    let targetDate = dateParam;
    if (!targetDate || !/^\d{4}-\d{2}-\d{2}$/.test(targetDate)) {
      const now = new Date();
      targetDate = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Kolkata",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(now);
    }

    // Convert IST day boundaries to UTC for querying created_at
    const startUTC = new Date(`${targetDate}T00:00:00+05:30`).toISOString();
    const endUTC = new Date(`${targetDate}T23:59:59.999+05:30`).toISOString();

    // Query receipts on this day
    const { data: receipts, error: receiptsError } = await supabase
      .from("receipts")
      .select(`
        receipt_no,
        student_id,
        seat_id,
        subscription_type,
        shift_type,
        has_sheet,
        amount_paid,
        start_date,
        end_date,
        created_at,
        members (
          name,
          phone,
          date_of_joining
        ),
        seats (
          seat_number
        )
      `)
      .gte("created_at", startUTC)
      .lte("created_at", endUTC)
      .order("created_at", { ascending: false });

    if (receiptsError) {
      return NextResponse.json({ error: receiptsError.message }, { status: 500 });
    }

    const safeReceipts = receipts || [];

    // Determine whether each receipt is a New Admission or a Renewal
    const studentIds = [...new Set(safeReceipts.map((r) => r.student_id))];
    const earliestReceiptMap = new Map<number, number>();

    if (studentIds.length > 0) {
      const { data: allReceiptsForStudents } = await supabase
        .from("receipts")
        .select("receipt_no, student_id, created_at")
        .in("student_id", studentIds)
        .order("created_at", { ascending: true });

      (allReceiptsForStudents || []).forEach((r) => {
        if (!earliestReceiptMap.has(r.student_id)) {
          earliestReceiptMap.set(r.student_id, r.receipt_no);
        }
      });
    }

    let totalCollected = 0;
    let newAdmissionsCount = 0;
    let renewalsCount = 0;
    let withSheetCount = 0;

    const shiftCounts = {
      full_day: 0,
      shift_1: 0,
      shift_2: 0,
      shift_3: 0,
      other: 0,
    };

    const formattedList = safeReceipts.map((r) => {
      const amount = Number(r.amount_paid) || 0;
      totalCollected += amount;

      const isNew = earliestReceiptMap.get(r.student_id) === r.receipt_no;
      if (isNew) {
        newAdmissionsCount++;
      } else {
        renewalsCount++;
      }

      if (r.has_sheet) {
        withSheetCount++;
      }

      if (r.subscription_type === "full_day") {
        shiftCounts.full_day++;
      } else if (r.shift_type === "shift_1" || r.shift_type === "morning") {
        shiftCounts.shift_1++;
      } else if (r.shift_type === "shift_2" || r.shift_type === "evening") {
        shiftCounts.shift_2++;
      } else if (r.shift_type === "shift_3") {
        shiftCounts.shift_3++;
      } else {
        shiftCounts.other++;
      }

      // Format payment time in IST
      let timeFormatted = "";
      if (r.created_at) {
        try {
          timeFormatted = new Intl.DateTimeFormat("en-IN", {
            timeZone: "Asia/Kolkata",
            hour: "numeric",
            minute: "2-digit",
            hour12: true,
          }).format(new Date(r.created_at));
        } catch {
          timeFormatted = r.created_at.substring(11, 16);
        }
      }

      const memberObj = Array.isArray(r.members) ? r.members[0] : r.members;
      const seatObj = Array.isArray(r.seats) ? r.seats[0] : r.seats;

      return {
        receipt_no: r.receipt_no,
        student_id: r.student_id,
        student_name: memberObj?.name || `Student #${r.student_id}`,
        student_phone: memberObj?.phone || null,
        seat_id: r.seat_id,
        seat_number: seatObj?.seat_number || r.seat_id,
        subscription_type: r.subscription_type,
        shift_type: r.shift_type,
        has_sheet: r.has_sheet,
        amount_paid: amount,
        start_date: r.start_date,
        end_date: r.end_date,
        created_at: r.created_at,
        payment_time: timeFormatted,
        is_new_admission: isNew,
      };
    });

    return NextResponse.json({
      date: targetDate,
      summary: {
        total_students: formattedList.length,
        unique_members: studentIds.length,
        total_collected: totalCollected,
        new_admissions_count: newAdmissionsCount,
        renewals_count: renewalsCount,
        with_sheet_count: withSheetCount,
        shift_counts: shiftCounts,
      },
      payments: formattedList,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
