import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { getLibraryBySlug, isDemoSlug } from "@/lib/tenant";
import { getDemoMembers } from "@/lib/demoData";

// GET /api/members?q=manas&slug=testing-library-1 -> search by name or student_id
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim();
  const slug = searchParams.get("slug");

  if (isDemoSlug(slug)) {
    return NextResponse.json(getDemoMembers(q));
  }

  let libraryId = "00000000-0000-0000-0000-000000000001";
  if (slug) {
    try {
      const lib = await getLibraryBySlug(slug);
      libraryId = lib.id;
    } catch {
      // fallback
    }
  }

  let query = supabase
    .from("members")
    .select("*, receipts(start_date, end_date, seats(seat_number))")
    .eq("library_id", libraryId)
    .order("student_id", { ascending: false });

  if (q) {
    // if numeric, search by exact student_id too
    const isNumeric = /^\d+$/.test(q);
    query = isNumeric
      ? query.eq("student_id", q)
      : query.ilike("name", `%${q}%`);
  }

  const { data, error } = await query.limit(50);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
