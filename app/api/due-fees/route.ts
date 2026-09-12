import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { getLibraryBySlug, DEFAULT_LIBRARY_ID, isDemoSlug } from "@/lib/tenant";
import { getDemoDueFees } from "@/lib/demoData";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const slug = searchParams.get("slug");

    if (isDemoSlug(slug)) {
      return NextResponse.json(getDemoDueFees());
    }

    let libraryId = DEFAULT_LIBRARY_ID;
    if (slug) {
      try {
        const lib = await getLibraryBySlug(slug);
        libraryId = lib.id;
      } catch {
        // ignore
      }
    }

    const today = new Date().toISOString().split("T")[0];
    const todayTime = new Date(`${today}T00:00:00`).getTime();

    // 45-day cutoff window to ignore legacy archived receipts
    const cutoffDateObj = new Date();
    cutoffDateObj.setDate(cutoffDateObj.getDate() - 45);
    const cutoffDate = cutoffDateObj.toISOString().split("T")[0];

    // Fetch active receipts (to exclude renewed students or re-allocated seats)
    let activeQuery = supabase
      .from("receipts")
      .select("receipt_no, student_id, seat_id, subscription_type, shift_type, is_vacated, end_date")
      .gte("end_date", today)
      .eq("library_id", libraryId);

    let { data: activeReceipts, error: activeError } = await activeQuery;

    if (activeError && (activeError.code === "42703" || activeError.message?.includes("is_vacated"))) {
      let fallbackQuery = supabase
        .from("receipts")
        .select("receipt_no, student_id, seat_id, subscription_type, shift_type, end_date")
        .gte("end_date", today)
        .eq("library_id", libraryId);

      const fallback = await fallbackQuery;
      activeReceipts = fallback.data as any;
      activeError = fallback.error;
    }

    if (activeError) {
      return NextResponse.json({ error: activeError.message }, { status: 500 });
    }

    const validActive = (activeReceipts ?? []).filter((r) => (r as any).is_vacated !== true);

    // Fetch overdue receipts within the 45-day window
    let overdueQuery = supabase
      .from("receipts")
      .select(
        "receipt_no, student_id, seat_id, subscription_type, shift_type, has_sheet, amount_paid, start_date, end_date, is_vacated, created_at, members(student_id, name, phone, aadhar_no), seats(seat_id, seat_number)"
      )
      .lt("end_date", today)
      .gte("end_date", cutoffDate)
      .eq("library_id", libraryId)
      .order("end_date", { ascending: false });

    let overdueRes: any = await overdueQuery;

    if (overdueRes.error && (overdueRes.error.code === "42703" || overdueRes.error.message?.includes("is_vacated"))) {
      overdueRes = await supabase
        .from("receipts")
        .select(
          "receipt_no, student_id, seat_id, subscription_type, shift_type, has_sheet, amount_paid, start_date, end_date, created_at, members(student_id, name, phone, aadhar_no), seats(seat_id, seat_number)"
        )
        .lt("end_date", today)
        .gte("end_date", cutoffDate)
        .eq("library_id", libraryId)
        .order("end_date", { ascending: false });
    }

    if (overdueRes.error) {
      return NextResponse.json({ error: overdueRes.error.message }, { status: 500 });
    }

    const rawOverdue = (overdueRes.data ?? []).filter((r: any) => r.is_vacated !== true);

    // Filter out receipts that have already been renewed or replaced by an active receipt
    const filteredOverdue: any[] = [];
    const seenStudentAndSeat = new Set<string>();

    for (const r of rawOverdue) {
      // If student has an active receipt anywhere, they have renewed!
      const studentHasActive = validActive.some((a) => a.student_id === r.student_id);
      if (studentHasActive) continue;

      // If seat has an active receipt for the same shift or full day, seat is re-allocated
      const seatHasConflict = validActive.some((a) => {
        if (a.seat_id !== r.seat_id) return false;
        if (a.subscription_type === "full_day" || r.subscription_type === "full_day") return true;
        if (a.shift_type && r.shift_type && a.shift_type === r.shift_type) return true;
        return false;
      });
      if (seatHasConflict) continue;

      // Deduplicate to keep latest expired receipt per student+seat
      const key = `${r.student_id}-${r.seat_id}-${r.shift_type || "default"}`;
      if (seenStudentAndSeat.has(key)) continue;
      seenStudentAndSeat.add(key);

      const endDateTime = new Date(`${r.end_date}T00:00:00`).getTime();
      const daysOverdue = Math.max(1, Math.ceil((todayTime - endDateTime) / (1000 * 60 * 60 * 24)));

      filteredOverdue.push({
        receipt_no: r.receipt_no,
        student_id: r.student_id,
        seat_id: r.seat_id,
        seat_number: (r.seats as any)?.seat_number || r.seat_id,
        student_name: (r.members as any)?.name || "Unknown Member",
        student_phone: (r.members as any)?.phone || null,
        aadhar_no: (r.members as any)?.aadhar_no || null,
        subscription_type: r.subscription_type,
        shift_type: r.shift_type,
        has_sheet: !!r.has_sheet,
        amount_paid: Number(r.amount_paid) || 0,
        start_date: r.start_date,
        end_date: r.end_date,
        days_overdue: daysOverdue,
        is_vacated: !!r.is_vacated,
        created_at: r.created_at,
      });
    }

    // Sort by days_overdue descending (most urgent first)
    filteredOverdue.sort((a, b) => b.days_overdue - a.days_overdue);

    // Compute summary metrics
    const totalDue = filteredOverdue.length;
    const days1to3 = filteredOverdue.filter((r) => r.days_overdue <= 3).length;
    const days4to7 = filteredOverdue.filter((r) => r.days_overdue > 3 && r.days_overdue <= 7).length;
    const days7Plus = filteredOverdue.filter((r) => r.days_overdue > 7).length;
    const estimatedPendingFees = filteredOverdue.reduce((sum, r) => sum + r.amount_paid, 0);

    return NextResponse.json({
      summary: {
        total_due: totalDue,
        days_1_to_3: days1to3,
        days_4_to_7: days4to7,
        days_7_plus: days7Plus,
        estimated_pending_fees: estimatedPendingFees,
      },
      candidates: filteredOverdue,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
