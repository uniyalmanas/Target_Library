import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { getLibraryBySlug, getLibrarySettings, isDemoSlug } from "@/lib/tenant";
import { getDemoSeats } from "@/lib/demoData";

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
    if (slug) {
      const library = await getLibraryBySlug(slug);
      libraryId = library.id;
      const settings = await getLibrarySettings(library.id);
      if (settings?.total_seats) {
        totalSeatsLimit = settings.total_seats;
      }
    } else {
      const settings = await getLibrarySettings(libraryId);
      if (settings?.total_seats) {
        totalSeatsLimit = settings.total_seats;
      }
    }

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
    } else if (totalSeatsLimit && seats.length > totalSeatsLimit) {
      seats = seats.slice(0, totalSeatsLimit);
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
    const cutoffObj = new Date(now);
    cutoffObj.setDate(cutoffObj.getDate() - 45);
    const cutoffDate = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Kolkata",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(cutoffObj);

    // Query non-vacated active and overdue receipts strictly for this library
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

    // Filter out officially vacated receipts
    const activeAndDue = (relevantReceipts ?? []).filter((r) => r.is_vacated !== true);

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
      const isPartialDue = activeReceipts.length > 0 && deduplicatedOverdue.length > 0;
      const isOccupied = visibleReceipts.length > 0;

      const isFullDay = activeReceipts.some((r) => r.subscription_type === "full_day");
      const isDoubleShift = activeReceipts.length >= 2 && !isFullDay;

      let status = "free";
      if (isAllOverdue) {
        status = "due"; // Entire seat is BLUE (due fees)
      } else if (isPartialDue) {
        status = "partial_due"; // 1 active shift + 1 overdue shift
      } else if (activeReceipts.length > 0) {
        if (isFullDay) {
          status = "full_day"; // RED (single full-day student)
        } else if (isDoubleShift) {
          status = "double_shift"; // PURPLE (seat split across 2 active shifts)
        } else {
          status = "half_day"; // AMBER (only 1 shift occupied, 1 shift free)
        }
      }

      return {
        seat_id: seat.seat_id,
        seat_number: seat.seat_number,
        occupied: isOccupied,
        is_overdue: isAllOverdue,
        has_due: deduplicatedOverdue.length > 0,
        is_double_shift: isDoubleShift,
        status,
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
