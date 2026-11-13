import { computeEndDate } from "@/lib/dates";
import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { getLibraryBySlug, getLibrarySettings, isDemoSlug, DEFAULT_SHIFTS } from "@/lib/tenant";
import { getDemoSeats } from "@/lib/demoData";
import { computeSeatStatus, sortShiftsChronologically } from "@/lib/shifts";

// Returns seats, each annotated with whether it's currently occupied
// (an active receipt with end_date >= today) and by whom.
// Dynamically adjusts to the library tenant's total_seats capacity.
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const slug = searchParams.get("slug");

    if (isDemoSlug(slug)) {
      return NextResponse.json(getDemoSeats());
    }

    let libraryId = "00000000-0000-0000-0000-000000000001";
    let totalSeatsLimit: number | null = null;
    let librarySettings: any = null;
    if (slug) {
      const library = await getLibraryBySlug(slug);
      libraryId = library.id;
      librarySettings = await getLibrarySettings(library.id);
      if (librarySettings?.total_seats) {
        totalSeatsLimit = librarySettings.total_seats;
      }
    } else {
      librarySettings = await getLibrarySettings(libraryId);
      if (librarySettings?.total_seats) {
        totalSeatsLimit = librarySettings.total_seats;
      }
    }
    const shiftsConfig = sortShiftsChronologically(librarySettings?.shifts_config || DEFAULT_SHIFTS);

    const { data: seatsData, error: seatsError } = await supabase
      .from("seats")
      .select("seat_id, seat_number, library_id")
      .eq("library_id", libraryId)
      .order("seat_number", { ascending: true });

    if (seatsError) {
      console.warn("Error querying seats with library_id, falling back:", seatsError.message);
    }

    let seats: any[] = seatsData || [];
    const targetCapacity = totalSeatsLimit || (libraryId === "00000000-0000-0000-0000-000000000001" ? 225 : 50);

    if (seats.length === 0) {
      // Fresh isolated empty seats for new library tenant
      seats = Array.from({ length: targetCapacity }, (_, i) => ({
        seat_id: i + 1,
        seat_number: i + 1,
        library_id: libraryId,
      }));
    } else {
      seats = seats.filter((s) => s.seat_number !== 9999);
      if (totalSeatsLimit && seats.length > totalSeatsLimit) {
        seats = seats.slice(0, totalSeatsLimit);
      }
    }

    // Indian Standard Time (IST) today
    const now = new Date();
    const today = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Kolkata",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(now);

    // Overdue grace window: consider non-vacated receipts up to 45 days past due
    const cutoffDate = computeEndDate(today, -45);

    // Query active and overdue receipts strictly for this library
    let relevantReceipts: any[] | null = null;
    let receiptsError: any = null;

    // Try full query with is_vacated and aadhar_no
    const res1 = await supabase
      .from("receipts")
      .select(
        "receipt_no, student_id, seat_id, subscription_type, shift_type, has_sheet, amount_paid, start_date, end_date, is_vacated, members(student_id, name, phone, aadhar_no)"
      )
      .eq("library_id", libraryId)
      .gte("end_date", cutoffDate);

    if (!res1.error) {
      relevantReceipts = res1.data;
    } else {
      // Fallback without is_vacated or without aadhar_no
      const res2 = await supabase
        .from("receipts")
        .select(
          "receipt_no, student_id, seat_id, subscription_type, shift_type, has_sheet, amount_paid, start_date, end_date, members(student_id, name, phone, aadhar_no)"
        )
        .eq("library_id", libraryId)
        .gte("end_date", cutoffDate);

      if (!res2.error) {
        relevantReceipts = res2.data;
      } else {
        const res3 = await supabase
          .from("receipts")
          .select(
            "receipt_no, student_id, seat_id, subscription_type, shift_type, has_sheet, amount_paid, start_date, end_date, members(student_id, name, phone)"
          )
          .eq("library_id", libraryId)
          .gte("end_date", cutoffDate);
        relevantReceipts = res3.data;
        receiptsError = res3.error;
      }
    }

    if (receiptsError) {
      return NextResponse.json({ error: receiptsError.message }, { status: 500 });
    }

    // Sort all relevant receipts by end_date desc, created_at desc
    const sortedReceipts = [...(relevantReceipts ?? [])].sort((a: any, b: any) => {
      const endCmp = (b.end_date || "").localeCompare(a.end_date || "");
      if (endCmp !== 0) return endCmp;
      return (b.created_at || "").localeCompare(a.created_at || "");
    });

    // Pass 1: Identify students whose latest receipt on a seat is vacated
    const seenStudentSeat = new Set<string>();
    const vacatedStudentSeat = new Set<string>();

    for (const r of sortedReceipts) {
      if (r.shift_type === "floating") continue;
      const key = `${r.student_id}-${r.seat_id}`;
      if (!seenStudentSeat.has(key)) {
        seenStudentSeat.add(key);
        if (r.is_vacated === true) {
          vacatedStudentSeat.add(key);
        }
      }
    }

    // Pass 2: Filter active and due receipts: exclude vacated students and superseded older receipts
    const studentSeatClaimed = new Set<string>();
    const activeAndDue: any[] = [];

    for (const r of sortedReceipts) {
      if (r.shift_type === "floating") continue;
      if (r.is_vacated === true) continue;
      const studentSeatKey = `${r.student_id}-${r.seat_id}`;
      // If student was vacated on this seat in their latest receipt, skip all historical receipts
      if (vacatedStudentSeat.has(studentSeatKey)) continue;

      // Also ensure each student only has their latest receipt attached per shift on a seat
      const shiftKey = `${r.student_id}-${r.seat_id}-${r.shift_type || "default"}`;
      if (studentSeatClaimed.has(shiftKey)) continue;
      studentSeatClaimed.add(shiftKey);

      activeAndDue.push(r);
    }

    // Map seat_id -> array of relevant receipts
    const receiptsBySeat = new Map<number, any[]>();
    for (const r of activeAndDue) {
      const existing = receiptsBySeat.get(r.seat_id) ?? [];
      existing.push(r);
      receiptsBySeat.set(r.seat_id, existing);
    }

    const todayTime = new Date(`${today}T00:00:00`).getTime();

    const result = (seats ?? []).map((seat) => {
      const allSeatReceipts = (receiptsBySeat.get(seat.seat_id) || receiptsBySeat.get(seat.seat_number)) ?? [];

      const activeReceipts = allSeatReceipts.filter((r) => r.end_date >= today);
      const overdueReceipts = allSeatReceipts.filter((r) => {
        if (r.end_date >= today) return false;
        // If seat has active full_day, overdue is superseded
        if (activeReceipts.some((a) => a.subscription_type === "full_day")) return false;
        // If seat has active receipt with same shift, overdue is superseded
        if (activeReceipts.some((a) => a.shift_type && a.shift_type === r.shift_type)) return false;
        return true;
      });

      // Deduplicate: Keep the latest overdue per shift
      const deduplicatedOverdue: any[] = [];
      const seenShifts = new Set<string>();
      overdueReceipts.sort((a, b) => b.end_date.localeCompare(a.end_date));
      for (const ov of overdueReceipts) {
        const key = ov.subscription_type === "full_day" ? "full_day" : (ov.shift_type || "default");
        if (!seenShifts.has(key)) {
          seenShifts.add(key);
          deduplicatedOverdue.push(ov);
        }
      }

      // Display receipts: active ones first, then overdue
      const visibleReceipts = [...activeReceipts, ...deduplicatedOverdue];
      visibleReceipts.sort((a, b) => b.end_date.localeCompare(a.end_date));

      const isAllOverdue = activeReceipts.length === 0 && deduplicatedOverdue.length > 0;
      const isOccupied = visibleReceipts.length > 0;

      const computed = computeSeatStatus(activeReceipts, deduplicatedOverdue, shiftsConfig);
      const isDoubleShift = computed.status === "double_shift";

      return {
        seat_id: seat.seat_id,
        seat_number: seat.seat_number,
        occupied: isOccupied,
        is_overdue: isAllOverdue,
        has_due: deduplicatedOverdue.length > 0,
        is_double_shift: isDoubleShift,
        can_accommodate_another: computed.canAccommodateAnother,
        available_shifts: computed.availableShifts,
        status: computed.status,
        receipts: visibleReceipts.map((r) => {
          const isDue = r.end_date < today;
          const endDateTime = new Date(`${r.end_date}T00:00:00`).getTime();
          const daysOverdue = isDue ? Math.max(1, Math.ceil((todayTime - endDateTime) / (1000 * 60 * 60 * 24))) : 0;

          return {
            receipt_no: r.receipt_no,
            student_id: r.student_id,
            subscription_type: r.subscription_type,
            shift_type: r.shift_type,
            has_sheet: r.has_sheet,
            amount_paid: r.amount_paid,
            start_date: r.start_date,
            end_date: r.end_date,
            is_vacated: !!r.is_vacated,
            is_overdue: isDue,
            days_overdue: daysOverdue,
            member: r.members
              ? {
                  student_id: r.members.student_id,
                  name: r.members.name,
                  phone: r.members.phone,
                  aadhar_no: r.members.aadhar_no || null,
                }
              : null,
          };
        }),
        // Keep backward compatibility fields
        receipt: visibleReceipts[0]
          ? {
              receipt_no: visibleReceipts[0].receipt_no,
              student_id: visibleReceipts[0].student_id,
              subscription_type: visibleReceipts[0].subscription_type,
              shift_type: visibleReceipts[0].shift_type,
              has_sheet: visibleReceipts[0].has_sheet,
              amount_paid: visibleReceipts[0].amount_paid,
              start_date: visibleReceipts[0].start_date,
              end_date: visibleReceipts[0].end_date,
            }
          : null,
        member: visibleReceipts[0]?.members ?? null,
      };
    });

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("GET /api/seats error:", error);
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}
