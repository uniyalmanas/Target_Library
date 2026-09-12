import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { getLibraryBySlug, DEFAULT_LIBRARY_ID } from "@/lib/tenant";

interface ImportRow {
  student_id?: number;
  name: string;
  phone?: string;
  seat_number: number;
  subscription_type: "full_day" | "half_day";
  shift_type?: "shift_1" | "shift_2" | "shift_3" | "morning" | "evening";
  has_sheet?: boolean;
  amount_paid: number;
  start_date: string; // YYYY-MM-DD
}

// POST { rows: ImportRow[], slug?: string } -> validates + commits.
export async function POST(req: Request) {
  const { rows, slug }: { rows: ImportRow[]; slug?: string } = await req.json();

  if (!Array.isArray(rows) || rows.length === 0) {
    return NextResponse.json({ error: "No rows provided" }, { status: 400 });
  }

  let libraryId = DEFAULT_LIBRARY_ID;
  if (slug) {
    try {
      const lib = await getLibraryBySlug(slug);
      libraryId = lib.id;
    } catch {
      // fallback
    }
  }

  const results: { row: number; status: "ok" | "error"; message?: string }[] = [];

  // Preload seat_number -> seat_id map for this specific library
  const { data: seats } = await supabase
    .from("seats")
    .select("seat_id, seat_number")
    .eq("library_id", libraryId);

  const seatMap = new Map((seats ?? []).map((s) => [s.seat_number, s.seat_id]));

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    try {
      let seat_id = seatMap.get(row.seat_number);
      if (!seat_id) {
        // Automatically create seat row for this tenant if not pre-seeded
        const { data: createdSeat } = await supabase
          .from("seats")
          .insert({ library_id: libraryId, seat_number: row.seat_number })
          .select("seat_id")
          .maybeSingle();

        if (createdSeat) {
          seat_id = createdSeat.seat_id;
          seatMap.set(row.seat_number, seat_id);
        } else {
          results.push({ row: i, status: "error", message: `Could not allocate seat_number ${row.seat_number}` });
          continue;
        }
      }

      if (!row.name || !row.amount_paid || !row.start_date || !row.subscription_type) {
        results.push({ row: i, status: "error", message: "Missing required field" });
        continue;
      }

      let student_id = row.student_id;
      if (student_id) {
        // Check existing member in this library
        const { data: existing } = await supabase
          .from("members")
          .select("student_id")
          .eq("student_id", student_id)
          .maybeSingle();

        if (!existing) {
          await supabase
            .from("members")
            .insert({ student_id, name: row.name, phone: row.phone || null, library_id: libraryId });
        }
      } else {
        const { data: newMember, error: memberErr } = await supabase
          .from("members")
          .insert({ name: row.name, phone: row.phone || null, library_id: libraryId })
          .select()
          .single();

        if (memberErr) throw memberErr;
        student_id = newMember.student_id;
      }

      const start = new Date(row.start_date);
      const end = new Date(start);
      end.setDate(end.getDate() + 30);

      const { error: receiptErr } = await supabase.from("receipts").insert({
        student_id,
        seat_id,
        subscription_type: row.subscription_type,
        shift_type: row.subscription_type === "half_day" ? row.shift_type : null,
        has_sheet: !!row.has_sheet,
        amount_paid: row.amount_paid,
        start_date: row.start_date,
        end_date: end.toISOString().split("T")[0],
        library_id: libraryId,
      });

      if (receiptErr) throw receiptErr;

      results.push({ row: i, status: "ok" });
    } catch (err: any) {
      results.push({ row: i, status: "error", message: err.message || "Unknown error" });
    }
  }

  return NextResponse.json({ results });
}
