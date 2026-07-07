import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

interface ImportRow {
  student_id?: number;
  name: string;
  phone?: string;
  seat_number: number;
  subscription_type: "full_day" | "half_day";
  shift_type?: "morning" | "evening";
  has_sheet?: boolean;
  amount_paid: number;
  start_date: string; // YYYY-MM-DD
}

// POST { rows: ImportRow[] } -> validates + commits.
// Client does the preview step itself (rendering the parsed rows before
// calling this endpoint), so by the time this is hit, staff has confirmed.
export async function POST(req: Request) {
  const { rows }: { rows: ImportRow[] } = await req.json();

  if (!Array.isArray(rows) || rows.length === 0) {
    return NextResponse.json({ error: "No rows provided" }, { status: 400 });
  }

  const results: { row: number; status: "ok" | "error"; message?: string }[] = [];

  // Preload seat_number -> seat_id map
  const { data: seats } = await supabase.from("seats").select("seat_id, seat_number");
  const seatMap = new Map((seats ?? []).map((s) => [s.seat_number, s.seat_id]));

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    try {
      const seat_id = seatMap.get(row.seat_number);
      if (!seat_id) {
        results.push({ row: i, status: "error", message: `Unknown seat_number ${row.seat_number}` });
        continue;
      }
      if (!row.name || !row.amount_paid || !row.start_date || !row.subscription_type) {
        results.push({ row: i, status: "error", message: "Missing required field" });
        continue;
      }

      let student_id = row.student_id;
      if (student_id) {
        // upsert-ish: check existing member
        const { data: existing } = await supabase
          .from("members")
          .select("student_id")
          .eq("student_id", student_id)
          .maybeSingle();
        if (!existing) {
          await supabase
            .from("members")
            .insert({ student_id, name: row.name, phone: row.phone || null });
        }
      } else {
        const { data: newMember, error: memberErr } = await supabase
          .from("members")
          .insert({ name: row.name, phone: row.phone || null })
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
      });
      if (receiptErr) throw receiptErr;

      results.push({ row: i, status: "ok" });
    } catch (err: any) {
      results.push({ row: i, status: "error", message: err.message || "Unknown error" });
    }
  }

  return NextResponse.json({ results });
}
