import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { getLibraryBySlug, getLibrarySettings, FALLBACK_SETTINGS } from "@/lib/tenant";

export const dynamic = "force-dynamic";

/**
 * GET: Returns active student enrollment counts and student list grouped by shift_type
 * for a specific library tenant.
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const library = await getLibraryBySlug(slug);

    // Current date in IST (YYYY-MM-DD)
    const today = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Kolkata",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());

    // Query all active (non-vacated and not past due beyond grace) receipts
    const { data: receipts, error } = await supabase
      .from("receipts")
      .select(`
        receipt_no,
        student_id,
        seat_id,
        subscription_type,
        shift_type,
        amount_paid,
        start_date,
        end_date,
        is_vacated,
        members (
          student_id,
          name,
          phone
        ),
        seats (
          seat_number
        )
      `)
      .eq("library_id", library.id)
      .eq("is_vacated", false)
      .gte("end_date", today);

    if (error) {
      console.error("Error querying active receipts for shifts:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const counts: Record<string, number> = {};
    const studentsByShift: Record<string, any[]> = {};

    (receipts || []).forEach((r: any) => {
      const shiftId = r.subscription_type === "full_day" ? "full_day" : r.shift_type || "unassigned";
      counts[shiftId] = (counts[shiftId] || 0) + 1;

      if (!studentsByShift[shiftId]) {
        studentsByShift[shiftId] = [];
      }

      studentsByShift[shiftId].push({
        receipt_no: r.receipt_no,
        student_id: r.student_id,
        name: r.members?.name || "Student",
        phone: r.members?.phone || null,
        seat_number: r.seats?.seat_number || r.seat_id,
        start_date: r.start_date,
        end_date: r.end_date,
        amount_paid: r.amount_paid,
        subscription_type: r.subscription_type,
        shift_type: r.shift_type,
      });
    });

    return NextResponse.json({
      counts,
      studentsByShift,
      totalActive: (receipts || []).length,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch shift enrollments" },
      { status: 500 }
    );
  }
}

/**
 * POST: Handles bulk operations such as migrating students between shifts.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const library = await getLibraryBySlug(slug);
    const body = await req.json();

    const { action, fromShiftId, toShiftId } = body;

    if (action === "migrate") {
      if (!fromShiftId || !toShiftId) {
        return NextResponse.json(
          { error: "Both fromShiftId and toShiftId are required for migration" },
          { status: 400 }
        );
      }

      if (fromShiftId === toShiftId) {
        return NextResponse.json(
          { error: "Source and destination shifts cannot be the same" },
          { status: 400 }
        );
      }

      const today = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Kolkata",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(new Date());

      // Update matching active receipts to the new shift
      const updatePayload: Record<string, any> = {
        shift_type: toShiftId === "full_day" ? null : toShiftId,
        subscription_type: toShiftId === "full_day" ? "full_day" : "half_day",
      };

      const { data, error } = await supabase
        .from("receipts")
        .update(updatePayload)
        .eq("library_id", library.id)
        .eq("is_vacated", false)
        .eq("shift_type", fromShiftId)
        .gte("end_date", today)
        .select("receipt_no");

      if (error) {
        console.error("Error migrating shift receipts:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      const migratedCount = (data || []).length;

      return NextResponse.json({
        ok: true,
        migratedCount,
        message: `Successfully migrated ${migratedCount} active student(s) to the new shift schedule.`,
      });
    }

    return NextResponse.json({ error: "Unsupported action" }, { status: 400 });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Migration failed" },
      { status: 500 }
    );
  }
}
