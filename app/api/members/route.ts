import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { getLibraryBySlug, isDemoSlug } from "@/lib/tenant";
import { getDemoMembers } from "@/lib/demoData";
import { getTodayIST } from "@/lib/dates";

// GET /api/members
// - ?slug=target-library&left_this_month=true -> students who vacated/left in current month
// - ?slug=target-library&q=manas -> search by name, phone, or student_id
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim();
  const slug = searchParams.get("slug");
  const leftThisMonth =
    searchParams.get("left_this_month") === "true" ||
    searchParams.get("filter") === "left_this_month";

  let libraryId = "00000000-0000-0000-0000-000000000001";
  if (slug) {
    try {
      const lib = await getLibraryBySlug(slug);
      libraryId = lib.id;
    } catch {
      // fallback
    }
  }

  // Feature: Students who left this month
  if (leftThisMonth) {
    if (isDemoSlug(slug)) {
      return NextResponse.json([
        {
          receipt_no: 801,
          student_id: 901,
          start_date: "2026-09-25",
          end_date: "2026-10-25",
          is_vacated: true,
          shift_type: "morning",
          subscription_type: "half_day",
          seats: { seat_number: 14 },
          members: {
            name: "Rohit Sharma",
            phone: "9876543210",
            student_id: 901,
            aadhar_no: "XXXX-XXXX-1234",
            date_of_joining: "2026-08-01",
          },
        },
        {
          receipt_no: 802,
          student_id: 902,
          start_date: "2026-09-20",
          end_date: "2026-10-20",
          is_vacated: true,
          shift_type: "evening",
          subscription_type: "half_day",
          seats: { seat_number: 28 },
          members: {
            name: "Pooja Verma",
            phone: "9812345678",
            student_id: 902,
            aadhar_no: "XXXX-XXXX-5678",
            date_of_joining: "2026-08-15",
          },
        },
      ]);
    }

    const today = getTodayIST(); // "YYYY-MM-DD" in IST
    const year = parseInt(today.slice(0, 4), 10);
    const month = parseInt(today.slice(5, 7), 10);
    const monthPadded = String(month).padStart(2, "0");
    const firstDay = `${year}-${monthPadded}-01`;
    const lastDayNum = new Date(year, month, 0).getDate();
    const lastDay = `${year}-${monthPadded}-${String(lastDayNum).padStart(2, "0")}`;

    const { data, error } = await supabase
      .from("receipts")
      .select(
        "receipt_no, student_id, start_date, end_date, is_vacated, shift_type, subscription_type, seats(seat_number), members(name, phone, student_id, aadhar_no, date_of_joining)"
      )
      .eq("library_id", libraryId)
      .eq("is_vacated", true)
      .gte("end_date", firstDay)
      .lte("end_date", lastDay)
      .order("end_date", { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data || []);
  }

  // Search feature: by name, phone, or student_id
  if (q) {
    if (isDemoSlug(slug)) {
      return NextResponse.json(getDemoMembers(q));
    }

    const isNumeric = /^\d+$/.test(q);
    let query = supabase
      .from("members")
      .select("*, receipts(receipt_no, start_date, end_date, is_vacated, shift_type, subscription_type, seats(seat_number))")
      .eq("library_id", libraryId)
      .order("student_id", { ascending: false });

    if (isNumeric && q.length <= 6) {
      query = query.or(`student_id.eq.${q},phone.ilike.%${q}%,name.ilike.%${q}%`);
    } else {
      query = query.or(`name.ilike.%${q}%,phone.ilike.%${q}%`);
    }

    const { data, error } = await query.limit(50);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data || []);
  }

  // If no query and not filtering by left students, do not dump all students
  return NextResponse.json([]);
}
