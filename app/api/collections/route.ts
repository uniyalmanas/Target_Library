import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { getLibraryBySlug, DEFAULT_LIBRARY_ID, isDemoSlug } from "@/lib/tenant";
import { getDemoCollections } from "@/lib/demoData";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const dateParam = searchParams.get("date");
    const slug = searchParams.get("slug");

    if (isDemoSlug(slug)) {
      return NextResponse.json(getDemoCollections(dateParam));
    }

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

    let libraryId = DEFAULT_LIBRARY_ID;
    if (slug) {
      try {
        const lib = await getLibraryBySlug(slug);
        libraryId = lib.id;
      } catch {
        // ignore
      }
    }

    // Query receipts on this day
    let query = supabase
      .from("receipts")
      .select(`
        receipt_no,
        student_id,
        seat_id,
        subscription_type,
        shift_type,
        has_sheet,
        amount_paid,
        payment_mode,
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
      .eq("library_id", libraryId)
      .order("created_at", { ascending: false });

    let { data: receipts, error: receiptsError } = await query;

    // Fallback if payment_mode column does not exist on DB yet
    if (receiptsError && (receiptsError.code === "42703" || receiptsError.message?.includes("payment_mode"))) {
      let retryQuery = supabase
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
        .eq("library_id", libraryId)
        .order("created_at", { ascending: false });

      const retry = await retryQuery;
      receipts = retry.data as any;
      receiptsError = retry.error;
    }

    if (receiptsError) {
      return NextResponse.json({ error: receiptsError.message }, { status: 500 });
    }

    const safeReceipts = receipts || [];

    // Determine whether each receipt is a New Admission or a Renewal
    const studentIds = [...new Set(safeReceipts.map((r) => r.student_id))];
    const earliestReceiptMap = new Map<number, number>();

    if (studentIds.length > 0) {
      let earliestQuery = supabase
        .from("receipts")
        .select("receipt_no, student_id, created_at")
        .in("student_id", studentIds)
        .eq("library_id", libraryId)
        .order("created_at", { ascending: true });

      const { data: allReceiptsForStudents } = await earliestQuery;

      (allReceiptsForStudents || []).forEach((r) => {
        if (!earliestReceiptMap.has(r.student_id)) {
          earliestReceiptMap.set(r.student_id, r.receipt_no);
        }
      });
    }

    let totalCollected = 0;
    let cashCollected = 0;
    let onlineCollected = 0;
    let cashCount = 0;
    let onlineCount = 0;
    let newAdmissionsCount = 0;
    let renewalsCount = 0;
    let withSheetCount = 0;

    const shiftCounts: Record<string, number> = {
      full_day: 0,
      shift_1: 0,
      shift_2: 0,
      shift_3: 0,
    };

    const formattedList = safeReceipts.map((r) => {
      const amount = Number(r.amount_paid) || 0;
      totalCollected += amount;

      const mode = (r as any).payment_mode === "online" ? "online" : "cash";
      if (mode === "online") {
        onlineCollected += amount;
        onlineCount++;
      } else {
        cashCollected += amount;
      }
      if (mode === "online") {
        // onlineCount handled above
      } else {
        cashCount++;
      }

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
        shiftCounts.full_day = (shiftCounts.full_day || 0) + 1;
      } else {
        const sid = r.shift_type || "unassigned";
        shiftCounts[sid] = (shiftCounts[sid] || 0) + 1;
        if (sid === "morning") shiftCounts.shift_1 = (shiftCounts.shift_1 || 0) + 1;
        if (sid === "evening") shiftCounts.shift_2 = (shiftCounts.shift_2 || 0) + 1;
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
        payment_mode: mode,
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
        cash_collected: cashCollected,
        online_collected: onlineCollected,
        cash_count: cashCount,
        online_count: onlineCount,
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
