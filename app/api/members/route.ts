import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

// GET /api/members?q=manas   -> search by name or student_id
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim();

  let query = supabase.from("members").select("*").order("student_id", { ascending: false });

  if (q) {
    // if numeric, search by exact student_id too
    const isNumeric = /^\d+$/.test(q);
    query = isNumeric
      ? supabase.from("members").select("*").eq("student_id", q)
      : supabase.from("members").select("*").ilike("name", `%${q}%`);
  }

  const { data, error } = await query.limit(50);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
